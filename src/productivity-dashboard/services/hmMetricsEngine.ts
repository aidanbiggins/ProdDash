// HM Metrics Engine
// Core metrics calculations for Hiring Manager analytics

import { differenceInDays } from 'date-fns';
import {
    HMFactTables,
    ReqFact,
    CandidateFact,
    EventFact,
    HMReqRollup,
    HMRollup,
    HMPendingAction,
    HMActionType,
    HMLatencyMetrics,
    LatencyStats,
    StallReason,
    StallReasonCode,
    RiskFlag,
    HMDecisionBucket,
    FillDateForecast,
    PeerComparison,
    PeerComparisonMetric,
    HMRulesConfig
} from '../types/hmTypes';
import { User } from '../types/entities';
import { DEFAULT_HM_RULES, STALL_REASON_EXPLANATIONS, RISK_FLAG_DEFINITIONS, PENDING_ACTION_SUGGESTIONS } from '../config/hmRules';
import { BUCKET_METADATA, getOrderedBuckets } from '../config/hmStageTaxonomy';
import { getLastMovementDate, getCandidatesByBucket, getUniqueHMs, getFurthestProgressedBucket } from './hmFactTables';

// ===== HM REQ ROLLUP =====

/**
 * Build HM req rollups - one row per HM per open req
 */
export function buildHMReqRollups(
    factTables: HMFactTables,
    users: User[],
    rules: HMRulesConfig = DEFAULT_HM_RULES
): HMReqRollup[] {
    const { reqFacts, candidateFacts, eventFacts, asOfDate } = factTables;
    const userMap = new Map(users.map(u => [u.user_id, u]));

    // Only process open reqs
    const openReqs = reqFacts.filter(r => r.isOpen);

    return openReqs.map(req => {
        const hm = userMap.get(req.hiring_manager_id ?? '');
        const recruiter = userMap.get(req.recruiter_id);

        // Get candidates by bucket
        const candidatesByBucket = getCandidatesByBucket(req.req_id, candidateFacts);

        // Calculate pipeline depth (active candidates)
        const pipelineDepth = Object.values(candidatesByBucket)
            .flat()
            .filter(c => c.decisionBucket !== HMDecisionBucket.DONE)
            .length;

        // Get bucket counts
        const bucketCounts: Record<HMDecisionBucket, number> = {} as Record<HMDecisionBucket, number>;
        for (const bucket of Object.values(HMDecisionBucket)) {
            bucketCounts[bucket] = candidatesByBucket[bucket]?.length ?? 0;
        }

        // Get last movement date
        const lastMovementDate = getLastMovementDate(req.req_id, eventFacts);
        const daysSinceLastMovement = lastMovementDate
            ? differenceInDays(asOfDate, lastMovementDate)
            : null;

        // Calculate risk flags
        const riskFlags = calculateRiskFlags(
            req,
            candidatesByBucket,
            eventFacts,
            daysSinceLastMovement,
            asOfDate,
            rules
        );

        // Calculate stall reason
        const primaryStallReason = calculateStallReason(
            req,
            candidatesByBucket,
            eventFacts,
            daysSinceLastMovement,
            asOfDate,
            rules
        );

        return {
            reqId: req.req_id,
            reqTitle: req.req_title,
            hmUserId: req.hiring_manager_id ?? '',
            hmName: hm?.name ?? 'Unknown',
            function: typeof req.function === 'string' ? req.function : String(req.function),
            level: req.level,
            location: req.location_city ?? req.location_region,
            recruiterId: req.recruiter_id,
            recruiterName: recruiter?.name ?? 'Unknown',
            reqAgeDays: req.reqAgeDays,
            lastMovementDate,
            daysSinceLastMovement,
            pipelineDepth,
            candidatesByBucket: bucketCounts,
            riskFlags,
            primaryStallReason,
            forecast: calculateFillDateForecast(req, candidatesByBucket, factTables, rules)
        };
    });
}

/**
 * Calculate risk flags for a requisition
 */
function calculateRiskFlags(
    req: ReqFact,
    candidatesByBucket: Record<HMDecisionBucket, CandidateFact[]>,
    eventFacts: EventFact[],
    daysSinceLastMovement: number | null,
    asOfDate: Date,
    rules: HMRulesConfig
): RiskFlag[] {
    const flags: RiskFlag[] = [];

    // No movement flag
    if (daysSinceLastMovement !== null && daysSinceLastMovement > rules.noMovementDays) {
        flags.push(RISK_FLAG_DEFINITIONS.NO_MOVEMENT);
    }

    // Low pipeline flag
    const activeCandidates = Object.entries(candidatesByBucket)
        .filter(([bucket]) => bucket !== HMDecisionBucket.DONE)
        .reduce((sum, [, cands]) => sum + cands.length, 0);

    if (activeCandidates < rules.lowPipelineThreshold) {
        flags.push(RISK_FLAG_DEFINITIONS.LOW_PIPELINE);
    }

    // Feedback backlog flag
    const feedbackDue = findPendingFeedback(req.req_id, eventFacts, asOfDate, rules);
    if (feedbackDue.length > 0) {
        flags.push(RISK_FLAG_DEFINITIONS.FEEDBACK_BACKLOG);
    }

    // HM review backlog flag
    const reviewBacklog = candidatesByBucket[HMDecisionBucket.HM_REVIEW]
        .filter(c => c.stageAgeDays > rules.hmReviewDueDays);
    if (reviewBacklog.length > 0) {
        flags.push(RISK_FLAG_DEFINITIONS.HM_REVIEW_BACKLOG);
    }

    return flags;
}

/**
 * Calculate the primary stall reason for a requisition
 */
function calculateStallReason(
    req: ReqFact,
    candidatesByBucket: Record<HMDecisionBucket, CandidateFact[]>,
    eventFacts: EventFact[],
    daysSinceLastMovement: number | null,
    asOfDate: Date,
    rules: HMRulesConfig
): StallReason {
    // Priority order check

    // 1. Awaiting HM Feedback
    const feedbackDue = findPendingFeedback(req.req_id, eventFacts, asOfDate, rules);
    if (feedbackDue.length > 0) {
        const oldestOverdue = Math.max(...feedbackDue.map(f => f.daysOverdue));
        return {
            code: StallReasonCode.AWAITING_HM_FEEDBACK,
            explanation: STALL_REASON_EXPLANATIONS.AWAITING_HM_FEEDBACK.explanation,
            evidence: `${feedbackDue.length} interview(s) awaiting feedback, oldest ${oldestOverdue} days overdue`,
            priority: STALL_REASON_EXPLANATIONS.AWAITING_HM_FEEDBACK.priority
        };
    }

    // 2. Awaiting HM Review
    const reviewBacklog = candidatesByBucket[HMDecisionBucket.HM_REVIEW]
        .filter(c => c.stageAgeDays > rules.hmReviewDueDays);
    if (reviewBacklog.length > 0) {
        const oldestDays = Math.max(...reviewBacklog.map(c => c.stageAgeDays));
        return {
            code: StallReasonCode.AWAITING_HM_REVIEW,
            explanation: STALL_REASON_EXPLANATIONS.AWAITING_HM_REVIEW.explanation,
            evidence: `${reviewBacklog.length} candidate(s) waiting ${oldestDays}+ days for review`,
            priority: STALL_REASON_EXPLANATIONS.AWAITING_HM_REVIEW.priority
        };
    }

    // 3. Pipeline thin
    const activeCandidates = Object.entries(candidatesByBucket)
        .filter(([bucket]) => bucket !== HMDecisionBucket.DONE)
        .reduce((sum, [, cands]) => sum + cands.length, 0);
    if (activeCandidates < rules.lowPipelineThreshold) {
        return {
            code: StallReasonCode.PIPELINE_THIN,
            explanation: STALL_REASON_EXPLANATIONS.PIPELINE_THIN.explanation,
            evidence: `Only ${activeCandidates} active candidate(s) (threshold: ${rules.lowPipelineThreshold})`,
            priority: STALL_REASON_EXPLANATIONS.PIPELINE_THIN.priority
        };
    }

    // 4. No activity
    if (daysSinceLastMovement !== null && daysSinceLastMovement > rules.noMovementDays) {
        return {
            code: StallReasonCode.NO_ACTIVITY,
            explanation: STALL_REASON_EXPLANATIONS.NO_ACTIVITY.explanation,
            evidence: `No pipeline movement in ${daysSinceLastMovement} days`,
            priority: STALL_REASON_EXPLANATIONS.NO_ACTIVITY.priority
        };
    }

    // 5. Offer stall
    const offerCandidates = candidatesByBucket[HMDecisionBucket.OFFER_DECISION];
    const offerStalled = offerCandidates.filter(c => c.stageAgeDays > rules.offerStallDays);
    if (offerStalled.length > 0) {
        return {
            code: StallReasonCode.OFFER_STALL,
            explanation: STALL_REASON_EXPLANATIONS.OFFER_STALL.explanation,
            evidence: `${offerStalled.length} offer(s) pending response for ${Math.max(...offerStalled.map(c => c.stageAgeDays))} days`,
            priority: STALL_REASON_EXPLANATIONS.OFFER_STALL.priority
        };
    }

    // 6. Late stage empty
    const lateStageCount = (candidatesByBucket[HMDecisionBucket.HM_FINAL_DECISION]?.length || 0) +
        (candidatesByBucket[HMDecisionBucket.OFFER_DECISION]?.length || 0);
    if (req.reqAgeDays > rules.lateStageEmptyDays && lateStageCount === 0) {
        return {
            code: StallReasonCode.LATE_STAGE_EMPTY,
            explanation: STALL_REASON_EXPLANATIONS.LATE_STAGE_EMPTY.explanation,
            evidence: `Req open ${req.reqAgeDays} days but no candidates in final stages`,
            priority: STALL_REASON_EXPLANATIONS.LATE_STAGE_EMPTY.priority
        };
    }

    // No stall detected
    return {
        code: StallReasonCode.NONE,
        explanation: STALL_REASON_EXPLANATIONS.NONE.explanation,
        evidence: 'Req is progressing normally',
        priority: STALL_REASON_EXPLANATIONS.NONE.priority
    };
}

// ===== PENDING ACTIONS =====

/**
 * Calculate all pending HM actions
 */
export function calculatePendingActions(
    factTables: HMFactTables,
    users: User[],
    rules: HMRulesConfig = DEFAULT_HM_RULES
): HMPendingAction[] {
    const { reqFacts, candidateFacts, eventFacts, asOfDate } = factTables;
    const userMap = new Map(users.map(u => [u.user_id, u]));
    const reqMap = new Map(reqFacts.map(r => [r.req_id, r]));
    const candidateMap = new Map(candidateFacts.map(c => [`${c.candidate_id}:${c.req_id}`, c]));

    const actions: HMPendingAction[] = [];

    // Only consider open reqs
    const openReqs = reqFacts.filter(r => r.isOpen);

    for (const req of openReqs) {
        const hm = userMap.get(req.hiring_manager_id ?? '');

        // 1. Feedback due
        const feedbackPending = findPendingFeedback(req.req_id, eventFacts, asOfDate, rules);
        for (const feedback of feedbackPending) {
            const cand = candidateMap.get(`${feedback.candidateId}:${req.req_id}`);
            actions.push({
                actionType: HMActionType.FEEDBACK_DUE,
                hmUserId: req.hiring_manager_id ?? '',
                hmName: hm?.name ?? 'Unknown',
                reqId: req.req_id,
                reqTitle: req.req_title,
                candidateId: feedback.candidateId,
                candidateName: cand?.candidate_id ?? 'Unknown',
                triggerDate: feedback.interviewDate,
                daysWaiting: feedback.daysWaiting,
                daysOverdue: feedback.daysOverdue,
                suggestedAction: PENDING_ACTION_SUGGESTIONS.FEEDBACK_DUE
            });
        }

        // 2. Review due
        const reviewCandidates = candidateFacts.filter(
            c => c.req_id === req.req_id &&
                c.decisionBucket === HMDecisionBucket.HM_REVIEW &&
                c.stageAgeDays > rules.hmReviewDueDays &&
                c.isActive
        );
        for (const cand of reviewCandidates) {
            actions.push({
                actionType: HMActionType.REVIEW_DUE,
                hmUserId: req.hiring_manager_id ?? '',
                hmName: hm?.name ?? 'Unknown',
                reqId: req.req_id,
                reqTitle: req.req_title,
                candidateId: cand.candidate_id,
                candidateName: cand.candidate_id ?? 'Unknown',
                triggerDate: cand.currentStageEnteredAt ?? new Date(),
                daysWaiting: cand.stageAgeDays,
                daysOverdue: cand.stageAgeDays - rules.hmReviewDueDays,
                suggestedAction: PENDING_ACTION_SUGGESTIONS.REVIEW_DUE
            });
        }

        // 3. Decision due
        const decisionCandidates = candidateFacts.filter(
            c => c.req_id === req.req_id &&
                c.decisionBucket === HMDecisionBucket.HM_FINAL_DECISION &&
                c.stageAgeDays > rules.decisionDueDays &&
                c.isActive
        );
        for (const cand of decisionCandidates) {
            actions.push({
                actionType: HMActionType.DECISION_DUE,
                hmUserId: req.hiring_manager_id ?? '',
                hmName: hm?.name ?? 'Unknown',
                reqId: req.req_id,
                reqTitle: req.req_title,
                candidateId: cand.candidate_id,
                candidateName: cand.candidate_id ?? 'Unknown',
                triggerDate: cand.currentStageEnteredAt ?? new Date(),
                daysWaiting: cand.stageAgeDays,
                daysOverdue: cand.stageAgeDays - rules.decisionDueDays,
                suggestedAction: PENDING_ACTION_SUGGESTIONS.DECISION_DUE
            });
        }
    }

    // Sort by days overdue (most overdue first)
    return actions.sort((a, b) => b.daysOverdue - a.daysOverdue);
}

/**
 * Find interviews awaiting feedback
 */
function findPendingFeedback(
    reqId: string,
    eventFacts: EventFact[],
    asOfDate: Date,
    rules: HMRulesConfig
): { candidateId: string; interviewDate: Date; daysWaiting: number; daysOverdue: number }[] {
    const pending: { candidateId: string; interviewDate: Date; daysWaiting: number; daysOverdue: number }[] = [];

    // Find all interview_completed events for this req
    const interviewEvents = eventFacts
        .filter(e => e.req_id === reqId && e.event_type === 'INTERVIEW_COMPLETED')
        .sort((a, b) => a.event_at.getTime() - b.event_at.getTime());

    // Find all feedback_submitted events for this req
    const feedbackEvents = eventFacts
        .filter(e => e.req_id === reqId && e.event_type === 'FEEDBACK_SUBMITTED');

    // For each interview, check if there's a corresponding feedback
    for (const interview of interviewEvents) {
        if (!interview.candidate_id) continue;

        const hasFeedback = feedbackEvents.some(
            f => f.candidate_id === interview.candidate_id &&
                f.event_at.getTime() > interview.event_at.getTime()
        );

        if (!hasFeedback) {
            const daysWaiting = differenceInDays(asOfDate, interview.event_at);
            pending.push({
                candidateId: interview.candidate_id,
                interviewDate: interview.event_at,
                daysWaiting,
                daysOverdue: daysWaiting - rules.feedbackDueDays
            });
        }
    }

    return pending;
}

// ===== LATENCY METRICS =====

/**
 * Calculate HM latency metrics
 */
export function calculateHMLatencyMetrics(
    hmUserId: string,
    factTables: HMFactTables,
    users: User[],
    rules: HMRulesConfig = DEFAULT_HM_RULES
): HMLatencyMetrics {
    const { reqFacts, candidateFacts, eventFacts, asOfDate } = factTables;
    const userMap = new Map(users.map(u => [u.user_id, u]));
    const hm = userMap.get(hmUserId);

    // Get reqs for this HM
    const hmReqs = reqFacts.filter(r => r.hiring_manager_id === hmUserId);
    const hmReqIds = new Set(hmReqs.map(r => r.req_id));

    // Calculate feedback latency
    const feedbackLatency = calculateFeedbackLatency(hmReqIds, eventFacts, asOfDate);

    // Calculate review latency
    const reviewLatency = calculateReviewLatency(hmReqIds, candidateFacts, eventFacts);

    // Calculate final decision latency
    const finalDecisionLatency = calculateFinalDecisionLatency(hmReqIds, candidateFacts, eventFacts);

    // Calculate median days since movement across all reqs
    const movementDays = hmReqs
        .map(r => {
            const lastMove = getLastMovementDate(r.req_id, eventFacts);
            return lastMove ? differenceInDays(asOfDate, lastMove) : null;
        })
        .filter((d): d is number => d !== null);

    return {
        hmUserId,
        hmName: hm?.name ?? 'Unknown',
        feedbackLatency,
        reviewLatency,
        finalDecisionLatency,
        medianDaysSinceMovement: calculateMedian(movementDays)
    };
}

function calculateFeedbackLatency(
    reqIds: Set<string>,
    eventFacts: EventFact[],
    asOfDate: Date
): LatencyStats {
    const latencies: number[] = [];
    let openItems = 0;

    // For each interview_completed, find matching feedback_submitted
    const interviews = eventFacts.filter(
        e => reqIds.has(e.req_id) && e.event_type === 'INTERVIEW_COMPLETED'
    );

    const feedbacks = eventFacts.filter(
        e => reqIds.has(e.req_id) && e.event_type === 'FEEDBACK_SUBMITTED'
    );

    for (const interview of interviews) {
        if (!interview.candidate_id) continue;

        const matchingFeedback = feedbacks
            .filter(f =>
                f.candidate_id === interview.candidate_id &&
                f.req_id === interview.req_id &&
                f.event_at.getTime() > interview.event_at.getTime()
            )
            .sort((a, b) => a.event_at.getTime() - b.event_at.getTime())[0];

        if (matchingFeedback) {
            const days = differenceInDays(matchingFeedback.event_at, interview.event_at);
            latencies.push(days);
        } else {
            openItems++;
        }
    }

    return computeLatencyStats(latencies, openItems);
}

function calculateReviewLatency(
    reqIds: Set<string>,
    candidateFacts: CandidateFact[],
    eventFacts: EventFact[]
): LatencyStats {
    const latencies: number[] = [];
    let openItems = 0;

    // Find candidates who entered and exited HM_REVIEW
    const hmReviewCandidates = candidateFacts.filter(
        c => reqIds.has(c.req_id)
    );

    for (const cand of hmReviewCandidates) {
        // Find stage changes into HM_REVIEW
        const enterEvents = eventFacts.filter(
            e => e.candidate_id === cand.candidate_id &&
                e.req_id === cand.req_id &&
                e.toBucket === HMDecisionBucket.HM_REVIEW
        ).sort((a, b) => a.event_at.getTime() - b.event_at.getTime());

        for (const enter of enterEvents) {
            // Find first exit from HM_REVIEW after this entry
            const exit = eventFacts.find(
                e => e.candidate_id === cand.candidate_id &&
                    e.req_id === cand.req_id &&
                    e.fromBucket === HMDecisionBucket.HM_REVIEW &&
                    e.event_at.getTime() > enter.event_at.getTime()
            );

            if (exit) {
                latencies.push(differenceInDays(exit.event_at, enter.event_at));
            } else if (cand.decisionBucket === HMDecisionBucket.HM_REVIEW && cand.isActive) {
                openItems++;
            }
        }
    }

    return computeLatencyStats(latencies, openItems);
}

function calculateFinalDecisionLatency(
    reqIds: Set<string>,
    candidateFacts: CandidateFact[],
    eventFacts: EventFact[]
): LatencyStats {
    const latencies: number[] = [];
    let openItems = 0;

    const candidates = candidateFacts.filter(c => reqIds.has(c.req_id));

    for (const cand of candidates) {
        // Find stage changes into HM_FINAL_DECISION
        const enterEvents = eventFacts.filter(
            e => e.candidate_id === cand.candidate_id &&
                e.req_id === cand.req_id &&
                e.toBucket === HMDecisionBucket.HM_FINAL_DECISION
        ).sort((a, b) => a.event_at.getTime() - b.event_at.getTime());

        for (const enter of enterEvents) {
            const exit = eventFacts.find(
                e => e.candidate_id === cand.candidate_id &&
                    e.req_id === cand.req_id &&
                    e.fromBucket === HMDecisionBucket.HM_FINAL_DECISION &&
                    e.event_at.getTime() > enter.event_at.getTime()
            );

            if (exit) {
                latencies.push(differenceInDays(exit.event_at, enter.event_at));
            } else if (cand.decisionBucket === HMDecisionBucket.HM_FINAL_DECISION && cand.isActive) {
                openItems++;
            }
        }
    }

    return computeLatencyStats(latencies, openItems);
}

// ===== FORECASTING =====

/**
 * Calculate expected fill date for a req
 */
function calculateFillDateForecast(
    req: ReqFact,
    candidatesByBucket: Record<HMDecisionBucket, CandidateFact[]>,
    factTables: HMFactTables,
    rules: HMRulesConfig
): FillDateForecast | null {
    const { candidateFacts, eventFacts, asOfDate } = factTables;

    // Get currently active bucket (furthest progressed)
    const activeBuckets = Object.values(HMDecisionBucket)
        .filter(b => b !== HMDecisionBucket.DONE && (candidatesByBucket[b]?.length || 0) > 0);

    if (activeBuckets.length === 0) return null;

    const currentBucket = getFurthestProgressedBucket(req.req_id, candidateFacts);
    const activeCandidateCount = Object.values(candidatesByBucket).flat().length;

    // Use historical velocity (in days) per bucket
    // For now, using rough industry/internal medians if we don't have enough history
    const historicalMedians: Record<HMDecisionBucket, number> = {
        [HMDecisionBucket.HM_REVIEW]: 3,
        [HMDecisionBucket.HM_INTERVIEW_DECISION]: 2,
        [HMDecisionBucket.HM_FEEDBACK]: 4,
        [HMDecisionBucket.HM_FINAL_DECISION]: 5,
        [HMDecisionBucket.OFFER_DECISION]: 7,
        [HMDecisionBucket.DONE]: 0,
        [HMDecisionBucket.OTHER]: 5
    };

    // Calculate remaining days based on current bucket
    const orderedBuckets = getOrderedBuckets();
    const currentIndex = orderedBuckets.indexOf(currentBucket);

    let remainingDays = 0;
    if (currentIndex !== -1) {
        for (let i = currentIndex; i < orderedBuckets.length; i++) {
            const bucket = orderedBuckets[i];
            if (bucket !== HMDecisionBucket.DONE) {
                remainingDays += historicalMedians[bucket];
            }
        }
    }

    // Adjust based on pipeline density: if many candidates, it's more likely to fill faster
    const pipelineAdjustment = activeCandidateCount > 5 ? 0.8 : (activeCandidateCount < 2 ? 1.5 : 1.0);
    const likelyDays = Math.round(remainingDays * pipelineAdjustment);

    const addDays = (date: Date, days: number) => {
        const result = new Date(date);
        result.setDate(result.getDate() + days);
        return result;
    };

    return {
        reqId: req.req_id,
        reqTitle: req.req_title,
        hmUserId: req.hiring_manager_id ?? '',
        currentBucket,
        activeCandidates: activeCandidateCount,
        earliestDate: addDays(asOfDate, Math.max(1, Math.round(likelyDays * 0.7))),
        likelyDate: addDays(asOfDate, likelyDays),
        lateDate: addDays(asOfDate, Math.round(likelyDays * 1.5)),
        sampleSize: 0, // Placeholder
        cohortDescription: 'Global Medians',
        isFallback: true
    };
}

function computeLatencyStats(latencies: number[], openItems: number): LatencyStats {
    if (latencies.length === 0) {
        return {
            median: null,
            p75: null,
            p90: null,
            max: null,
            sampleSize: 0,
            openItems
        };
    }

    const sorted = [...latencies].sort((a, b) => a - b);

    return {
        median: calculateMedian(sorted),
        p75: calculatePercentile(sorted, 75),
        p90: calculatePercentile(sorted, 90),
        max: Math.max(...sorted),
        sampleSize: sorted.length,
        openItems
    };
}

// ===== HM ROLLUP (AGGREGATE) =====

/**
 * Build aggregate HM rollups
 */
export function buildHMRollups(
    factTables: HMFactTables,
    users: User[],
    hmReqRollups: HMReqRollup[],
    rules: HMRulesConfig = DEFAULT_HM_RULES
): HMRollup[] {
    const userMap = new Map(users.map(u => [u.user_id, u]));
    const hmIds = getUniqueHMs(factTables.reqFacts);

    return hmIds.map(hmUserId => {
        const hm = userMap.get(hmUserId);
        const hmReqs = hmReqRollups.filter(r => r.hmUserId === hmUserId);

        // Aggregate bucket counts
        const bucketTotals: Record<HMDecisionBucket, number> = {} as Record<HMDecisionBucket, number>;
        for (const bucket of Object.values(HMDecisionBucket)) {
            bucketTotals[bucket] = hmReqs.reduce((sum, r) => sum + (r.candidatesByBucket[bucket] ?? 0), 0);
        }

        // Count pending actions
        const pendingActions = calculatePendingActions(factTables, users, rules)
            .filter(a => a.hmUserId === hmUserId);

        // Calculate function/level mix
        const functionMix: Record<string, number> = {};
        const levelMix: Record<string, number> = {};
        for (const req of hmReqs) {
            functionMix[req.function] = (functionMix[req.function] ?? 0) + 1;
            levelMix[req.level] = (levelMix[req.level] ?? 0) + 1;
        }

        // Get closed reqs count
        const closedReqs = factTables.reqFacts.filter(
            r => r.hiring_manager_id === hmUserId && !r.isOpen
        ).length;

        return {
            hmUserId,
            hmName: hm?.name ?? 'Unknown',
            team: hm?.team ?? 'Unknown',
            managerUserId: hm?.manager_user_id ?? null,
            totalOpenReqs: hmReqs.length,
            totalClosedReqs: closedReqs,
            reqsWithRiskFlags: hmReqs.filter(r => r.riskFlags.length > 0).length,
            totalActiveCandidates: Object.entries(bucketTotals)
                .filter(([bucket]) => bucket !== HMDecisionBucket.DONE)
                .reduce((sum, [, count]) => sum + count, 0),
            candidatesByBucket: bucketTotals,
            pendingActionsCount: pendingActions.length,
            feedbackDueCount: pendingActions.filter(a => a.actionType === HMActionType.FEEDBACK_DUE).length,
            reviewDueCount: pendingActions.filter(a => a.actionType === HMActionType.REVIEW_DUE).length,
            decisionDueCount: pendingActions.filter(a => a.actionType === HMActionType.DECISION_DUE).length,
            latencyMetrics: calculateHMLatencyMetrics(hmUserId, factTables, users, rules),
            peerComparison: null, // Calculated in next pass
            functionMix,
            levelMix
        };
    });
}

/**
 * Calculate global benchmarks from all HMs
 */
export function calculateGlobalBenchmarks(hmRollups: HMRollup[]): Record<string, LatencyStats> {
    const feedbackMedians = hmRollups.map(r => r.latencyMetrics.feedbackLatency.median).filter((m): m is number => m !== null);
    const reviewMedians = hmRollups.map(r => r.latencyMetrics.reviewLatency.median).filter((m): m is number => m !== null);
    const decisionMedians = hmRollups.map(r => r.latencyMetrics.finalDecisionLatency.median).filter((m): m is number => m !== null);

    return {
        feedback: computeLatencyStats(feedbackMedians, 0),
        review: computeLatencyStats(reviewMedians, 0),
        decision: computeLatencyStats(decisionMedians, 0)
    };
}

/**
 * Enhanced HM rollups with peer comparisons
 */
export function buildHMRollupsWithBenchmarks(
    factTables: HMFactTables,
    users: User[],
    hmReqRollups: HMReqRollup[],
    rules: HMRulesConfig = DEFAULT_HM_RULES
): HMRollup[] {
    const rollups = buildHMRollups(factTables, users, hmReqRollups, rules);
    const globalBenchmarks = calculateGlobalBenchmarks(rollups);

    return rollups.map(rollup => ({
        ...rollup,
        peerComparison: calculatePeerComparison(rollup, globalBenchmarks)
    }));
}

/**
 * Compare an HM to global benchmarks
 */
function calculatePeerComparison(
    rollup: HMRollup,
    benchmarks: Record<string, LatencyStats>
): PeerComparison {
    const metrics: PeerComparisonMetric[] = [];

    // 1. Feedback Latency
    const fb = rollup.latencyMetrics.feedbackLatency;
    const fbBench = benchmarks.feedback;
    metrics.push({
        metricName: 'Feedback Speed',
        hmValue: fb.median,
        cohortMedian: fbBench.median,
        cohortP75: fbBench.p75,
        percentileRank: calculatePercentileRank(fb.median, fbBench),
        isHigherBetter: false,
        insufficientData: fb.sampleSize < 3
    });

    // 2. Review Latency
    const rv = rollup.latencyMetrics.reviewLatency;
    const rvBench = benchmarks.review;
    metrics.push({
        metricName: 'Review Speed',
        hmValue: rv.median,
        cohortMedian: rvBench.median,
        cohortP75: rvBench.p75,
        percentileRank: calculatePercentileRank(rv.median, rvBench),
        isHigherBetter: false,
        insufficientData: rv.sampleSize < 3
    });

    return {
        hmUserId: rollup.hmUserId,
        hmName: rollup.hmName,
        cohortDescription: 'All Hiring Managers',
        cohortSize: benchmarks.feedback.sampleSize,
        metrics
    };
}

function calculatePercentileRank(value: number | null, stats: LatencyStats): number | null {
    if (value === null || stats.median === null) return null;
    // Simple heuristic for now: 100 if below median, 50 if at median, 0 if at max
    if (value <= stats.median) return 75; // "Above average" (faster)
    if (stats.p90 !== null && value > stats.p90) return 10; // Slow
    return 40; // Average
}

// ===== UTILITY FUNCTIONS =====

function calculateMedian(numbers: number[]): number | null {
    if (numbers.length === 0) return null;
    const sorted = [...numbers].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0
        ? sorted[mid]
        : (sorted[mid - 1] + sorted[mid]) / 2;
}

function calculatePercentile(sortedNumbers: number[], percentile: number): number | null {
    if (sortedNumbers.length === 0) return null;
    const index = Math.ceil((percentile / 100) * sortedNumbers.length) - 1;
    return sortedNumbers[Math.max(0, Math.min(index, sortedNumbers.length - 1))];
}
