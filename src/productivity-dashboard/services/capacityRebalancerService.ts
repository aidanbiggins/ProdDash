/**
 * Capacity Rebalancer Service
 *
 * Provides analysis and recommendations for rebalancing recruiter workloads.
 * Answers three key questions:
 * 1. Who is overloaded vs has slack? (computeRecruiterUtilization)
 * 2. Which req moves reduce delay the most? (suggestReassignments)
 * 3. What is the predicted improvement? (simulateMoveImpact)
 *
 * Uses global workload (not per-req) for accurate demand assessment.
 * Leverages existing capacity infrastructure: inferCapacity(), computeGlobalDemand(), applyCapacityPenaltyV11()
 */

import { Candidate, Requisition, User, Event, CandidateDisposition, RequisitionStatus, CanonicalStage } from '../types/entities';
import {
    ConfidenceLevel,
    LoadStatus,
    getLoadStatus,
    OracleCapacityProfile,
    OraclePipelineByStage,
    OracleCapacityConfidenceReason,
    ORACLE_CAPACITY_LIMITED_STAGES,
    ORACLE_CAPACITY_STAGE_LABELS,
    CAPACITY_CONSTANTS,
    ORACLE_GLOBAL_CAPACITY_PRIORS
} from '../types/capacityTypes';
import {
    RecruiterUtilizationRow,
    UtilizationResult,
    ReassignmentCandidate,
    ReassignmentSuggestion,
    MoveScore,
    RebalancerOptions,
    RebalancerResult,
    SimulatedMoveImpact,
    StageUtilization,
    REBALANCER_CONSTANTS,
    getHedgeMessage,
    aggregateConfidences,
    LOAD_STATUS_LABELS
} from '../types/rebalancerTypes';
import { inferCapacity } from './capacityInferenceService';
import { computeGlobalDemand, applyCapacityPenaltyV11 } from './capacityPenaltyModel';
import { DurationDistribution } from './probabilisticEngine';

// ============================================
// CONSTANTS
// ============================================

const DEFAULT_STAGE_DURATIONS: Record<string, DurationDistribution> = {
    [CanonicalStage.SCREEN]: { type: 'lognormal', mu: 1.1, sigma: 0.5 },
    [CanonicalStage.HM_SCREEN]: { type: 'lognormal', mu: 1.4, sigma: 0.5 },
    [CanonicalStage.ONSITE]: { type: 'lognormal', mu: 1.6, sigma: 0.5 },
    [CanonicalStage.OFFER]: { type: 'lognormal', mu: 1.4, sigma: 0.5 }
};

// ============================================
// MAIN FUNCTIONS
// ============================================

export interface RebalancerInput {
    candidates: Candidate[];
    requisitions: Requisition[];
    events: Event[];
    users: User[];
    dateRange: { start: Date; end: Date };
}

/**
 * Compute utilization for all recruiters
 *
 * @returns Utilization table with all recruiters and their load status
 */
export function computeRecruiterUtilization(input: RebalancerInput): UtilizationResult {
    const { candidates, requisitions, events, users, dateRange } = input;

    // Filter to active candidates and open reqs
    const activeCandidates = candidates.filter(c =>
        c.disposition === CandidateDisposition.Active || !c.disposition
    );
    const openReqs = requisitions.filter(r =>
        r.status === RequisitionStatus.Open || (!r.closed_at && r.status !== RequisitionStatus.Closed)
    );

    // Calculate recruiter_id coverage
    const reqsWithRecruiter = openReqs.filter(r => r.recruiter_id);
    const recruiterIdCoverage = openReqs.length > 0
        ? reqsWithRecruiter.length / openReqs.length
        : 0;

    // Group reqs by recruiter
    const recruiterReqs = new Map<string, Requisition[]>();
    for (const req of openReqs) {
        if (!req.recruiter_id) continue;
        const existing = recruiterReqs.get(req.recruiter_id) || [];
        existing.push(req);
        recruiterReqs.set(req.recruiter_id, existing);
    }

    const rows: RecruiterUtilizationRow[] = [];
    const capacityProfiles = new Map<string, OracleCapacityProfile>();

    // Process each recruiter
    for (const [recruiterId, reqs] of recruiterReqs) {
        const reqIds = reqs.map(r => r.req_id);

        // Infer capacity for this recruiter
        const capacityProfile = inferCapacity({
            reqId: reqIds[0],
            recruiterId,
            hmId: reqs[0].hiring_manager_id ?? '',
            dateRange,
            events,
            candidates: activeCandidates,
            requisitions,
            users
        });
        capacityProfiles.set(recruiterId, capacityProfile);

        // Compute global demand for this recruiter
        const globalDemand = computeGlobalDemand({
            selectedReqId: reqIds[0],
            recruiterId,
            hmId: null,
            allCandidates: activeCandidates,
            allRequisitions: openReqs,
            users
        });

        // Compute stage-level utilization
        const stageUtilization: StageUtilization[] = [];
        let weightedUtilSum = 0;
        let weightSum = 0;
        let totalDemand = 0;
        let totalCapacity = 0;

        for (const stage of ORACLE_CAPACITY_LIMITED_STAGES) {
            const demand = globalDemand.recruiter_demand[stage] || 0;
            const capacity = getCapacityForStage(stage, capacityProfile);
            const utilization = demand / Math.max(capacity, REBALANCER_CONSTANTS.EPSILON);

            const weight = REBALANCER_CONSTANTS.STAGE_WEIGHTS[stage] || 0;
            weightedUtilSum += utilization * weight;
            weightSum += weight;

            totalDemand += demand;
            totalCapacity += capacity;

            stageUtilization.push({
                stage,
                stageName: ORACLE_CAPACITY_STAGE_LABELS[stage] || stage,
                demand,
                capacity,
                utilization,
                confidence: capacityProfile.overall_confidence
            });
        }

        const overallUtilization = weightSum > 0 ? weightedUtilSum / weightSum : 0;
        const status = getLoadStatus(overallUtilization);

        // Build confidence reasons
        const confidenceReasons = buildConfidenceReasons(
            recruiterId,
            capacityProfile,
            recruiterIdCoverage
        );
        const confidence = computeUtilizationConfidence(
            recruiterId,
            capacityProfile,
            recruiterIdCoverage
        );

        // Get recruiter name
        const recruiterUser = users.find(u => u.user_id === recruiterId);
        const recruiterName = recruiterUser?.name ?? `Recruiter (${recruiterId.substring(0, 6)})`;

        rows.push({
            recruiterId,
            recruiterName,
            reqCount: reqs.length,
            totalDemand,
            totalCapacity,
            utilization: overallUtilization,
            status,
            stageUtilization,
            confidence,
            confidenceReasons,
            capacityProfile
        });
    }

    // Sort by utilization (descending)
    rows.sort((a, b) => b.utilization - a.utilization);

    // Compute summary
    const summary = {
        totalDemand: rows.reduce((sum, r) => sum + r.totalDemand, 0),
        totalCapacity: rows.reduce((sum, r) => sum + r.totalCapacity, 0),
        overallUtilization: rows.length > 0
            ? rows.reduce((sum, r) => sum + r.utilization, 0) / rows.length
            : 0,
        overallStatus: getLoadStatus(
            rows.length > 0 ? rows.reduce((sum, r) => sum + r.utilization, 0) / rows.length : 0
        ),
        criticalCount: rows.filter(r => r.status === 'critical').length,
        overloadedCount: rows.filter(r => r.status === 'overloaded').length,
        availableCount: rows.filter(r => r.status === 'available').length,
        underutilizedCount: rows.filter(r => r.status === 'underutilized').length
    };

    // Overall confidence
    const rowConfidences = rows.map(r => r.confidence);
    const confidence = rowConfidences.length > 0
        ? aggregateConfidences(rowConfidences)
        : 'LOW';

    const confidenceReasons: OracleCapacityConfidenceReason[] = [];
    if (recruiterIdCoverage < REBALANCER_CONSTANTS.MIN_RECRUITER_ID_COVERAGE) {
        confidenceReasons.push({
            type: 'missing_data',
            message: `Only ${Math.round(recruiterIdCoverage * 100)}% of reqs have recruiter_id`,
            impact: 'negative'
        });
    }

    return {
        rows,
        summary,
        dataQuality: {
            recruiterIdCoverage,
            reqsWithoutRecruiter: openReqs.length - reqsWithRecruiter.length,
            totalReqs: openReqs.length
        },
        confidence,
        confidenceReasons,
        hedgeMessage: getHedgeMessage(confidence)
    };
}

/**
 * Suggest reassignments to rebalance workload
 *
 * @returns Ranked list of suggested req moves
 */
export function suggestReassignments(
    input: RebalancerInput,
    options: RebalancerOptions = {}
): RebalancerResult {
    const { maxSuggestions = REBALANCER_CONSTANTS.DEFAULT_MAX_SUGGESTIONS } = options;

    // First compute utilization
    const utilizationResult = computeRecruiterUtilization(input);

    // Check if we have enough data
    if (utilizationResult.dataQuality.recruiterIdCoverage < REBALANCER_CONSTANTS.MIN_RECRUITER_ID_COVERAGE) {
        return {
            utilizationResult,
            suggestions: [],
            hasSuggestions: false,
            isBalanced: false,
            confidence: 'LOW',
            hedgeMessage: `Limited data: Only ${Math.round(utilizationResult.dataQuality.recruiterIdCoverage * 100)}% of reqs have recruiter_id assigned`
        };
    }

    // Identify overloaded and available recruiters
    const overloaded = utilizationResult.rows.filter(r =>
        r.status === 'critical' || r.status === 'overloaded'
    );
    const available = utilizationResult.rows.filter(r =>
        r.status === 'available' || r.status === 'underutilized' || r.status === 'balanced'
    );

    // If no overloaded recruiters, we're balanced
    if (overloaded.length === 0) {
        return {
            utilizationResult,
            suggestions: [],
            hasSuggestions: false,
            isBalanced: true,
            confidence: utilizationResult.confidence,
            hedgeMessage: 'All recruiters are operating within capacity'
        };
    }

    // If no available targets, can't suggest moves
    if (available.length === 0) {
        return {
            utilizationResult,
            suggestions: [],
            hasSuggestions: false,
            isBalanced: false,
            confidence: utilizationResult.confidence,
            hedgeMessage: 'All recruiters are at or above capacity - no rebalancing targets available'
        };
    }

    // Generate move options
    const moveOptions = generateMoveOptions(
        overloaded,
        available,
        input.requisitions,
        input.candidates
    );

    // Score each move
    const scoredMoves = moveOptions.map(move =>
        scoreMove(move, input, utilizationResult)
    );

    // Filter and rank
    const rankedMoves = scoredMoves
        .filter(m => m.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, maxSuggestions);

    // Convert to suggestions
    const suggestions: ReassignmentSuggestion[] = rankedMoves.map((scored, index) => ({
        rank: index + 1,
        reqId: scored.move.reqId,
        reqTitle: scored.move.reqTitle,
        fromRecruiterId: scored.move.fromRecruiterId,
        fromRecruiterName: scored.move.fromRecruiterName,
        toRecruiterId: scored.move.toRecruiterId,
        toRecruiterName: scored.move.toRecruiterName,
        rationale: buildRationale(scored),
        estimatedImpact: {
            delayReductionDays: scored.expectedDelayReduction,
            sourceUtilizationBefore: scored.beforeState.sourceUtilization,
            sourceUtilizationAfter: scored.afterState.sourceUtilization,
            targetUtilizationBefore: scored.beforeState.targetUtilization,
            targetUtilizationAfter: scored.afterState.targetUtilization
        },
        confidence: scored.confidence,
        hedgeMessage: scored.hedgeMessage,
        reqDemand: scored.move.reqDemand
    }));

    const overallConfidence = suggestions.length > 0
        ? aggregateConfidences(suggestions.map(s => s.confidence))
        : utilizationResult.confidence;

    return {
        utilizationResult,
        suggestions,
        hasSuggestions: suggestions.length > 0,
        isBalanced: false,
        confidence: overallConfidence,
        hedgeMessage: getHedgeMessage(overallConfidence)
    };
}

/**
 * Simulate the impact of a specific move
 *
 * @returns Detailed before/after impact analysis
 */
export function simulateMoveImpact(
    move: ReassignmentCandidate,
    input: RebalancerInput
): SimulatedMoveImpact {
    const { candidates, requisitions, users, events, dateRange } = input;

    const activeCandidates = candidates.filter(c =>
        c.disposition === CandidateDisposition.Active || !c.disposition
    );
    const openReqs = requisitions.filter(r =>
        r.status === RequisitionStatus.Open || (!r.closed_at && r.status !== RequisitionStatus.Closed)
    );

    // BEFORE state - Source recruiter
    const beforeSourceDemand = computeGlobalDemand({
        selectedReqId: move.reqId,
        recruiterId: move.fromRecruiterId,
        hmId: null,
        allCandidates: activeCandidates,
        allRequisitions: openReqs,
        users
    });

    const sourceProfile = inferCapacity({
        reqId: move.reqId,
        recruiterId: move.fromRecruiterId,
        hmId: '',
        dateRange,
        events,
        candidates: activeCandidates,
        requisitions: openReqs,
        users
    });

    const beforeSourcePenalty = applyCapacityPenaltyV11(
        DEFAULT_STAGE_DURATIONS,
        beforeSourceDemand,
        sourceProfile
    );

    const beforeSourceUtilization = computeOverallUtilization(
        beforeSourceDemand.recruiter_demand,
        sourceProfile
    );

    // BEFORE state - Target recruiter
    const beforeTargetDemand = computeGlobalDemand({
        selectedReqId: move.reqId,
        recruiterId: move.toRecruiterId,
        hmId: null,
        allCandidates: activeCandidates,
        allRequisitions: openReqs,
        users
    });

    const targetProfile = inferCapacity({
        reqId: move.reqId,
        recruiterId: move.toRecruiterId,
        hmId: '',
        dateRange,
        events,
        candidates: activeCandidates,
        requisitions: openReqs,
        users
    });

    const beforeTargetPenalty = applyCapacityPenaltyV11(
        DEFAULT_STAGE_DURATIONS,
        beforeTargetDemand,
        targetProfile
    );

    const beforeTargetUtilization = computeOverallUtilization(
        beforeTargetDemand.recruiter_demand,
        targetProfile
    );

    // AFTER state - Simulate move
    const simulatedReqs = openReqs.map(r =>
        r.req_id === move.reqId
            ? { ...r, recruiter_id: move.toRecruiterId }
            : r
    );

    // AFTER state - Source (req moved away)
    const afterSourceDemand = computeGlobalDemand({
        selectedReqId: move.reqId,
        recruiterId: move.fromRecruiterId,
        hmId: null,
        allCandidates: activeCandidates,
        allRequisitions: simulatedReqs,
        users
    });

    const afterSourcePenalty = applyCapacityPenaltyV11(
        DEFAULT_STAGE_DURATIONS,
        afterSourceDemand,
        sourceProfile
    );

    const afterSourceUtilization = computeOverallUtilization(
        afterSourceDemand.recruiter_demand,
        sourceProfile
    );

    // AFTER state - Target (req received)
    const afterTargetDemand = computeGlobalDemand({
        selectedReqId: move.reqId,
        recruiterId: move.toRecruiterId,
        hmId: null,
        allCandidates: activeCandidates,
        allRequisitions: simulatedReqs,
        users
    });

    const afterTargetPenalty = applyCapacityPenaltyV11(
        DEFAULT_STAGE_DURATIONS,
        afterTargetDemand,
        targetProfile
    );

    const afterTargetUtilization = computeOverallUtilization(
        afterTargetDemand.recruiter_demand,
        targetProfile
    );

    // Calculate deltas
    const sourceDelayReduction = beforeSourcePenalty.total_queue_delay_days - afterSourcePenalty.total_queue_delay_days;
    const targetDelayIncrease = afterTargetPenalty.total_queue_delay_days - beforeTargetPenalty.total_queue_delay_days;
    const netDelayReduction = sourceDelayReduction - targetDelayIncrease;

    const minConfidence = aggregateConfidences([
        sourceProfile.overall_confidence,
        targetProfile.overall_confidence,
        beforeSourceDemand.confidence,
        beforeTargetDemand.confidence
    ]);

    return {
        move,
        beforeSource: {
            utilization: beforeSourceUtilization,
            queueDelayDays: beforeSourcePenalty.total_queue_delay_days,
            status: getLoadStatus(beforeSourceUtilization),
            demandByStage: beforeSourceDemand.recruiter_demand
        },
        afterSource: {
            utilization: afterSourceUtilization,
            queueDelayDays: afterSourcePenalty.total_queue_delay_days,
            status: getLoadStatus(afterSourceUtilization),
            demandByStage: afterSourceDemand.recruiter_demand
        },
        beforeTarget: {
            utilization: beforeTargetUtilization,
            queueDelayDays: beforeTargetPenalty.total_queue_delay_days,
            status: getLoadStatus(beforeTargetUtilization),
            demandByStage: beforeTargetDemand.recruiter_demand
        },
        afterTarget: {
            utilization: afterTargetUtilization,
            queueDelayDays: afterTargetPenalty.total_queue_delay_days,
            status: getLoadStatus(afterTargetUtilization),
            demandByStage: afterTargetDemand.recruiter_demand
        },
        netImpact: {
            delayReductionDays: netDelayReduction,
            sourceReliefPercent: (beforeSourceUtilization - afterSourceUtilization) * 100,
            targetImpactPercent: (afterTargetUtilization - beforeTargetUtilization) * 100
        },
        confidence: minConfidence,
        hedgeMessage: getHedgeMessage(minConfidence)
    };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Generate all possible move options
 */
function generateMoveOptions(
    overloadedRecruiters: RecruiterUtilizationRow[],
    availableRecruiters: RecruiterUtilizationRow[],
    requisitions: Requisition[],
    candidates: Candidate[]
): ReassignmentCandidate[] {
    const options: ReassignmentCandidate[] = [];

    const activeCandidates = candidates.filter(c =>
        c.disposition === CandidateDisposition.Active || !c.disposition
    );

    for (const source of overloadedRecruiters) {
        // Get reqs owned by this overloaded recruiter
        const sourceReqs = requisitions.filter(r =>
            r.recruiter_id === source.recruiterId &&
            (r.status === RequisitionStatus.Open || (!r.closed_at && r.status !== RequisitionStatus.Closed))
        );

        for (const req of sourceReqs) {
            // Count pipeline for this req
            const reqCandidates = activeCandidates.filter(c => c.req_id === req.req_id);

            // Skip reqs with no active candidates (no demand to move)
            if (reqCandidates.length === 0) continue;

            // Compute demand by stage
            const reqDemand: OraclePipelineByStage = {};
            for (const c of reqCandidates) {
                if (c.current_stage) {
                    reqDemand[c.current_stage] = (reqDemand[c.current_stage] || 0) + 1;
                }
            }

            // Find suitable targets
            for (const target of availableRecruiters) {
                // Skip same recruiter
                if (target.recruiterId === source.recruiterId) continue;

                options.push({
                    reqId: req.req_id,
                    reqTitle: req.req_title ?? `Req ${req.req_id}`,
                    fromRecruiterId: source.recruiterId,
                    fromRecruiterName: source.recruiterName,
                    toRecruiterId: target.recruiterId,
                    toRecruiterName: target.recruiterName,
                    reqDemand,
                    totalCandidates: reqCandidates.length
                });
            }
        }
    }

    return options;
}

/**
 * Score a potential move
 */
function scoreMove(
    move: ReassignmentCandidate,
    input: RebalancerInput,
    utilizationResult: UtilizationResult
): MoveScore {
    const impact = simulateMoveImpact(move, input);

    // Check constraint: target should not become overloaded
    const violatesConstraint = impact.afterTarget.utilization > CAPACITY_CONSTANTS.MAX_DEST_UTILIZATION_AFTER_MOVE;

    // Score = expected_delay_reduction - transfer_cost_penalty
    const score = violatesConstraint
        ? -1000
        : (impact.netImpact.delayReductionDays - REBALANCER_CONSTANTS.TRANSFER_COST_DAYS);

    return {
        move,
        score,
        beforeState: {
            sourceUtilization: impact.beforeSource.utilization,
            sourceQueueDelay: impact.beforeSource.queueDelayDays,
            targetUtilization: impact.beforeTarget.utilization,
            targetQueueDelay: impact.beforeTarget.queueDelayDays
        },
        afterState: {
            sourceUtilization: impact.afterSource.utilization,
            sourceQueueDelay: impact.afterSource.queueDelayDays,
            targetUtilization: impact.afterTarget.utilization,
            targetQueueDelay: impact.afterTarget.queueDelayDays
        },
        expectedDelayReduction: impact.netImpact.delayReductionDays,
        utilizationBalanceImprovement: Math.abs(impact.beforeSource.utilization - impact.beforeTarget.utilization) -
            Math.abs(impact.afterSource.utilization - impact.afterTarget.utilization),
        confidence: impact.confidence,
        hedgeMessage: impact.hedgeMessage
    };
}

/**
 * Build human-readable rationale for a move
 */
function buildRationale(scored: MoveScore): string {
    const parts: string[] = [];

    // Source relief
    const sourceRelief = scored.beforeState.sourceUtilization - scored.afterState.sourceUtilization;
    parts.push(`Reduces ${scored.move.fromRecruiterName}'s load by ${Math.round(sourceRelief * 100)}%`);

    // Target has capacity
    parts.push(`${scored.move.toRecruiterName} has capacity (${Math.round(scored.afterState.targetUtilization * 100)}% after)`);

    // Delay improvement
    if (scored.expectedDelayReduction > 0) {
        parts.push(`Expected ~${scored.expectedDelayReduction.toFixed(1)}d faster time-to-hire`);
    }

    return parts.join('. ') + '.';
}

/**
 * Get capacity for a stage from profile
 */
function getCapacityForStage(stage: CanonicalStage, profile: OracleCapacityProfile): number {
    const recruiter = profile.recruiter;
    const defaults = profile.cohort_defaults;

    switch (stage) {
        case CanonicalStage.SCREEN:
            return recruiter?.screens_per_week.throughput_per_week ?? defaults.screens_per_week;
        case CanonicalStage.HM_SCREEN:
            return recruiter?.hm_screens_per_week?.throughput_per_week ?? defaults.hm_screens_per_week;
        case CanonicalStage.ONSITE:
            return recruiter?.onsites_per_week?.throughput_per_week ?? defaults.onsites_per_week;
        case CanonicalStage.OFFER:
            return recruiter?.offers_per_week?.throughput_per_week ?? defaults.offers_per_week;
        default:
            return defaults.screens_per_week;
    }
}

/**
 * Compute overall utilization from demand and capacity
 */
function computeOverallUtilization(
    demand: OraclePipelineByStage,
    profile: OracleCapacityProfile
): number {
    let weightedSum = 0;
    let weightSum = 0;

    for (const stage of ORACLE_CAPACITY_LIMITED_STAGES) {
        const d = demand[stage] || 0;
        const c = getCapacityForStage(stage, profile);
        const util = d / Math.max(c, REBALANCER_CONSTANTS.EPSILON);

        const weight = REBALANCER_CONSTANTS.STAGE_WEIGHTS[stage] || 0;
        weightedSum += util * weight;
        weightSum += weight;
    }

    return weightSum > 0 ? weightedSum / weightSum : 0;
}

/**
 * Compute utilization confidence
 */
function computeUtilizationConfidence(
    recruiterId: string | null,
    capacityProfile: OracleCapacityProfile,
    recruiterIdCoverage: number
): ConfidenceLevel {
    // Rule 1: recruiter_id must be present
    if (!recruiterId) {
        return 'INSUFFICIENT';
    }

    // Rule 2: Check capacity inference quality
    const recruiterCapacity = capacityProfile.recruiter;
    if (!recruiterCapacity || capacityProfile.used_cohort_fallback) {
        return 'LOW';
    }

    // Rule 3: Check n_transitions
    const minTransitions = Math.min(
        recruiterCapacity.screens_per_week.n_transitions,
        recruiterCapacity.onsites_per_week?.n_transitions ?? 0,
        recruiterCapacity.offers_per_week?.n_transitions ?? 0
    );

    if (minTransitions >= 15) {
        return 'HIGH';
    } else if (minTransitions >= 5) {
        return 'MED';
    } else {
        return 'LOW';
    }
}

/**
 * Build confidence reasons
 */
function buildConfidenceReasons(
    recruiterId: string | null,
    capacityProfile: OracleCapacityProfile,
    recruiterIdCoverage: number
): OracleCapacityConfidenceReason[] {
    const reasons: OracleCapacityConfidenceReason[] = [];

    if (!recruiterId) {
        reasons.push({
            type: 'missing_data',
            message: 'No recruiter_id',
            impact: 'negative'
        });
        return reasons;
    }

    const recruiterCapacity = capacityProfile.recruiter;
    if (!recruiterCapacity || capacityProfile.used_cohort_fallback) {
        reasons.push({
            type: 'sample_size',
            message: 'Using cohort defaults for capacity',
            impact: 'neutral'
        });
    }

    if (recruiterCapacity) {
        const minTransitions = Math.min(
            recruiterCapacity.screens_per_week.n_transitions,
            recruiterCapacity.onsites_per_week?.n_transitions ?? 0,
            recruiterCapacity.offers_per_week?.n_transitions ?? 0
        );

        if (minTransitions >= 15) {
            reasons.push({
                type: 'sample_size',
                message: 'Good sample size',
                impact: 'positive'
            });
        } else if (minTransitions >= 5) {
            reasons.push({
                type: 'sample_size',
                message: 'Moderate sample size',
                impact: 'neutral'
            });
        } else {
            reasons.push({
                type: 'sample_size',
                message: 'Limited sample size',
                impact: 'negative'
            });
        }
    }

    if (recruiterIdCoverage < 0.5) {
        reasons.push({
            type: 'missing_data',
            message: `Only ${Math.round(recruiterIdCoverage * 100)}% of reqs have recruiter_id`,
            impact: 'negative'
        });
    }

    return reasons;
}
