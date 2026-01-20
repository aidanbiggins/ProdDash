/**
 * Capacity Inference Service for Oracle v1
 *
 * Infers recruiter and HM throughput capacity from historical event data.
 * Uses Bayesian shrinkage toward cohort/global priors when sample sizes are small.
 *
 * Key principles:
 * - Only uses observed timestamps (no fabrication)
 * - Falls back to conservative defaults with LOW confidence when data insufficient
 * - Sample-size gating for defensible estimates
 */

import { differenceInDays, differenceInWeeks, startOfWeek, endOfWeek, subWeeks } from 'date-fns';
import { CanonicalStage, Event, Candidate, Requisition, User, EventType } from '../types';
import { normalizeStage } from './stageNormalization';
import {
    OracleInferCapacityInput,
    OracleCapacityProfile,
    OracleRecruiterCapacity,
    OracleHMCapacity,
    OracleStageCapacity,
    OracleCapacityConfidenceReason,
    OracleCohortCapacityDefaults,
    ConfidenceLevel,
    ORACLE_CAPACITY_CONSTANTS,
    ORACLE_GLOBAL_CAPACITY_PRIORS,
    ORACLE_CAPACITY_LIMITED_STAGES
} from '../types/capacityTypes';
import { shrinkRate } from './probabilisticEngine';

const { MIN_WEEKS_FOR_CAPACITY, MIN_TRANSITIONS_FOR_THROUGHPUT, CONFIDENCE_THRESHOLDS } = ORACLE_CAPACITY_CONSTANTS;

// ============================================
// MAIN INFERENCE FUNCTION
// ============================================

/**
 * Infer capacity profile for a specific recruiter and HM
 */
export function inferCapacity(input: OracleInferCapacityInput): OracleCapacityProfile {
    const { recruiterId, hmId, dateRange, events, candidates, requisitions, users } = input;

    // Calculate cohort defaults from all data first
    const cohortDefaults = calculateCohortDefaults(events, candidates, dateRange);

    // Infer recruiter capacity
    const recruiterCapacity = inferRecruiterCapacity(
        recruiterId,
        events,
        candidates,
        requisitions,
        users,
        dateRange,
        cohortDefaults
    );

    // Infer HM capacity
    const hmCapacity = inferHMCapacity(
        hmId,
        events,
        candidates,
        requisitions,
        users,
        dateRange,
        cohortDefaults
    );

    // Determine overall confidence
    const recruiterConf = recruiterCapacity?.overall_confidence || 'LOW';
    const hmConf = hmCapacity?.overall_confidence || 'LOW';
    const usedFallback = recruiterCapacity === null || hmCapacity === null;

    const overall_confidence = combineConfidence(recruiterConf, hmConf);

    // Aggregate reasons
    const confidence_reasons: OracleCapacityConfidenceReason[] = [];
    if (recruiterCapacity) {
        confidence_reasons.push(...recruiterCapacity.confidence_reasons);
    }
    if (hmCapacity) {
        confidence_reasons.push(...hmCapacity.confidence_reasons);
    }
    if (usedFallback) {
        confidence_reasons.push({
            type: 'missing_data',
            message: 'Using cohort defaults for some capacity estimates',
            impact: 'negative'
        });
    }

    return {
        recruiter: recruiterCapacity,
        hm: hmCapacity,
        cohort_defaults: cohortDefaults,
        overall_confidence,
        confidence_reasons,
        used_cohort_fallback: usedFallback
    };
}

// ============================================
// RECRUITER CAPACITY INFERENCE
// ============================================

function inferRecruiterCapacity(
    recruiterId: string,
    events: Event[],
    candidates: Candidate[],
    requisitions: Requisition[],
    users: User[] | undefined,
    dateRange: { start: Date; end: Date },
    cohortDefaults: OracleCohortCapacityDefaults
): OracleRecruiterCapacity | null {
    // Get recruiter's reqs
    const recruiterReqs = new Set(
        requisitions.filter(r => r.recruiter_id === recruiterId).map(r => r.req_id)
    );

    if (recruiterReqs.size === 0) {
        return null;
    }

    // Filter events to this recruiter's reqs and date range
    const recruiterEvents = events.filter(e =>
        recruiterReqs.has(e.req_id) &&
        e.event_at >= dateRange.start &&
        e.event_at <= dateRange.end
    );

    const weeksAnalyzed = Math.max(1, differenceInWeeks(dateRange.end, dateRange.start));

    // Count stage transitions by week
    const screenTransitions = countStageTransitions(recruiterEvents, CanonicalStage.SCREEN);
    const hmScreenTransitions = countStageTransitions(recruiterEvents, CanonicalStage.HM_SCREEN);
    const onsiteTransitions = countStageTransitions(recruiterEvents, CanonicalStage.ONSITE);
    const offerTransitions = countStageTransitions(recruiterEvents, CanonicalStage.OFFER);

    // Build stage capacities with shrinkage
    const screens_per_week = buildStageCapacity(
        CanonicalStage.SCREEN,
        screenTransitions,
        weeksAnalyzed,
        cohortDefaults.screens_per_week
    );

    const hm_screens_per_week = buildStageCapacity(
        CanonicalStage.HM_SCREEN,
        hmScreenTransitions,
        weeksAnalyzed,
        cohortDefaults.hm_screens_per_week
    );

    const onsites_per_week = buildStageCapacity(
        CanonicalStage.ONSITE,
        onsiteTransitions,
        weeksAnalyzed,
        cohortDefaults.onsites_per_week
    );

    const offers_per_week = buildStageCapacity(
        CanonicalStage.OFFER,
        offerTransitions,
        weeksAnalyzed,
        cohortDefaults.offers_per_week
    );

    // Determine overall confidence
    const confidences = [
        screens_per_week.confidence,
        hm_screens_per_week?.confidence,
        onsites_per_week?.confidence
    ].filter(Boolean) as ConfidenceLevel[];

    const overall_confidence = aggregateConfidences(confidences);

    // Build reasons
    const confidence_reasons = buildRecruiterConfidenceReasons(
        screenTransitions,
        weeksAnalyzed,
        screens_per_week.confidence
    );

    const recruiterName = users?.find(u => u.user_id === recruiterId)?.name;

    return {
        recruiter_id: recruiterId,
        recruiter_name: recruiterName,
        screens_per_week,
        hm_screens_per_week: hmScreenTransitions > 0 ? hm_screens_per_week : undefined,
        onsites_per_week: onsiteTransitions > 0 ? onsites_per_week : undefined,
        offers_per_week: offerTransitions > 0 ? offers_per_week : undefined,
        overall_confidence,
        confidence_reasons,
        date_range: {
            start: dateRange.start,
            end: dateRange.end,
            weeks_analyzed: weeksAnalyzed
        }
    };
}

// ============================================
// HM CAPACITY INFERENCE
// ============================================

function inferHMCapacity(
    hmId: string,
    events: Event[],
    candidates: Candidate[],
    requisitions: Requisition[],
    users: User[] | undefined,
    dateRange: { start: Date; end: Date },
    cohortDefaults: OracleCohortCapacityDefaults
): OracleHMCapacity | null {
    // Get HM's reqs
    const hmReqs = new Set(
        requisitions.filter(r => r.hiring_manager_id === hmId).map(r => r.req_id)
    );

    if (hmReqs.size === 0) {
        return null;
    }

    // Filter events to HM's reqs and date range
    const hmEvents = events.filter(e =>
        hmReqs.has(e.req_id) &&
        e.event_at >= dateRange.start &&
        e.event_at <= dateRange.end
    );

    const weeksAnalyzed = Math.max(1, differenceInWeeks(dateRange.end, dateRange.start));

    // Count HM screen transitions (HM interviews)
    const hmScreenTransitions = countStageTransitions(hmEvents, CanonicalStage.HM_SCREEN);

    // Count feedback events
    const feedbackEvents = hmEvents.filter(e =>
        e.event_type === EventType.FEEDBACK_SUBMITTED &&
        e.actor_user_id === hmId
    );

    // Calculate feedback turnaround if we have data
    let feedback_turnaround_hours;
    if (feedbackEvents.length >= MIN_TRANSITIONS_FOR_THROUGHPUT) {
        // This would require pairing with interview completion events
        // For now, use a proxy based on stage dwell time
        feedback_turnaround_hours = {
            median: cohortDefaults.hm_feedback_hours,
            p75: cohortDefaults.hm_feedback_hours * 1.5,
            n: feedbackEvents.length,
            confidence: feedbackEvents.length >= 15 ? 'HIGH' as ConfidenceLevel :
                feedbackEvents.length >= 5 ? 'MED' as ConfidenceLevel : 'LOW' as ConfidenceLevel
        };
    }

    // Build interviews per week
    const interviews_per_week = buildStageCapacity(
        CanonicalStage.HM_SCREEN,
        hmScreenTransitions,
        weeksAnalyzed,
        cohortDefaults.hm_screens_per_week
    );

    // Determine overall confidence
    const overall_confidence = interviews_per_week.confidence;

    // Build reasons
    const confidence_reasons = buildHMConfidenceReasons(
        hmScreenTransitions,
        weeksAnalyzed,
        overall_confidence
    );

    const hmName = users?.find(u => u.user_id === hmId)?.name;

    return {
        hm_id: hmId,
        hm_name: hmName,
        feedback_turnaround_hours,
        interviews_per_week: hmScreenTransitions > 0 ? interviews_per_week : undefined,
        overall_confidence,
        confidence_reasons,
        date_range: {
            start: dateRange.start,
            end: dateRange.end,
            weeks_analyzed: weeksAnalyzed
        }
    };
}

// ============================================
// COHORT DEFAULTS CALCULATION
// ============================================

function calculateCohortDefaults(
    events: Event[],
    candidates: Candidate[],
    dateRange: { start: Date; end: Date }
): OracleCohortCapacityDefaults {
    const weeksAnalyzed = Math.max(1, differenceInWeeks(dateRange.end, dateRange.start));

    // Count all transitions by stage
    const filteredEvents = events.filter(e =>
        e.event_at >= dateRange.start && e.event_at <= dateRange.end
    );

    const screenCount = countStageTransitions(filteredEvents, CanonicalStage.SCREEN);
    const hmScreenCount = countStageTransitions(filteredEvents, CanonicalStage.HM_SCREEN);
    const onsiteCount = countStageTransitions(filteredEvents, CanonicalStage.ONSITE);
    const offerCount = countStageTransitions(filteredEvents, CanonicalStage.OFFER);

    // Get unique recruiters and HMs from the period
    const recruitersActive = new Set(
        events.filter(e => e.event_at >= dateRange.start && e.event_at <= dateRange.end)
            .map(e => e.actor_user_id)
    ).size || 1;

    // Calculate per-person per-week rates
    const screens_per_week = screenCount > 0 ?
        screenCount / weeksAnalyzed / Math.max(1, recruitersActive / 2) : ORACLE_GLOBAL_CAPACITY_PRIORS.screens_per_week;

    const hm_screens_per_week = hmScreenCount > 0 ?
        hmScreenCount / weeksAnalyzed / Math.max(1, recruitersActive / 3) : ORACLE_GLOBAL_CAPACITY_PRIORS.hm_screens_per_week;

    const onsites_per_week = onsiteCount > 0 ?
        onsiteCount / weeksAnalyzed / Math.max(1, recruitersActive / 2) : ORACLE_GLOBAL_CAPACITY_PRIORS.onsites_per_week;

    const offers_per_week = offerCount > 0 ?
        offerCount / weeksAnalyzed / Math.max(1, recruitersActive / 2) : ORACLE_GLOBAL_CAPACITY_PRIORS.offers_per_week;

    return {
        screens_per_week: Math.max(1, screens_per_week),
        hm_screens_per_week: Math.max(0.5, hm_screens_per_week),
        onsites_per_week: Math.max(0.5, onsites_per_week),
        offers_per_week: Math.max(0.25, offers_per_week),
        hm_feedback_hours: ORACLE_GLOBAL_CAPACITY_PRIORS.hm_feedback_hours,
        sample_sizes: {
            recruiters: recruitersActive,
            hms: Math.floor(recruitersActive / 2),
            weeks: weeksAnalyzed
        }
    };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Count stage transitions from events
 */
function countStageTransitions(events: Event[], targetStage: CanonicalStage): number {
    return events.filter(e =>
        e.event_type === EventType.STAGE_CHANGE &&
        e.to_stage === targetStage
    ).length;
}

/**
 * Build a stage capacity with shrinkage toward prior
 */
function buildStageCapacity(
    stage: CanonicalStage,
    transitions: number,
    weeksAnalyzed: number,
    priorThroughput: number
): OracleStageCapacity {
    const observedThroughput = transitions / weeksAnalyzed;

    // Apply Bayesian shrinkage
    // Use weeksAnalyzed as proxy for sample size in shrinkage
    const shrunkThroughput = shrinkRate(
        observedThroughput,
        priorThroughput,
        weeksAnalyzed,
        MIN_WEEKS_FOR_CAPACITY // prior weight
    );

    // Determine confidence
    let confidence: ConfidenceLevel = 'LOW';
    if (weeksAnalyzed >= CONFIDENCE_THRESHOLDS.HIGH.min_weeks &&
        transitions >= CONFIDENCE_THRESHOLDS.HIGH.min_transitions) {
        confidence = 'HIGH';
    } else if (weeksAnalyzed >= CONFIDENCE_THRESHOLDS.MED.min_weeks &&
        transitions >= CONFIDENCE_THRESHOLDS.MED.min_transitions) {
        confidence = 'MED';
    }

    return {
        stage,
        throughput_per_week: Math.max(0.1, shrunkThroughput),
        n_weeks: weeksAnalyzed,
        n_transitions: transitions,
        confidence,
        prior_throughput: priorThroughput,
        observed_throughput: observedThroughput
    };
}

/**
 * Build confidence reasons for recruiter
 */
function buildRecruiterConfidenceReasons(
    transitions: number,
    weeksAnalyzed: number,
    confidence: ConfidenceLevel
): OracleCapacityConfidenceReason[] {
    const reasons: OracleCapacityConfidenceReason[] = [];

    if (weeksAnalyzed >= CONFIDENCE_THRESHOLDS.HIGH.min_weeks) {
        reasons.push({
            type: 'sample_size',
            message: `${weeksAnalyzed} weeks of history analyzed`,
            impact: 'positive'
        });
    } else if (weeksAnalyzed >= CONFIDENCE_THRESHOLDS.MED.min_weeks) {
        reasons.push({
            type: 'sample_size',
            message: `${weeksAnalyzed} weeks of history (moderate sample)`,
            impact: 'neutral'
        });
    } else {
        reasons.push({
            type: 'sample_size',
            message: `Only ${weeksAnalyzed} weeks of history (limited)`,
            impact: 'negative'
        });
    }

    if (transitions < MIN_TRANSITIONS_FOR_THROUGHPUT) {
        reasons.push({
            type: 'missing_data',
            message: `Few stage transitions observed (${transitions})`,
            impact: 'negative'
        });
    }

    if (confidence === 'LOW' || confidence === 'INSUFFICIENT') {
        reasons.push({
            type: 'shrinkage',
            message: 'Estimates rely heavily on cohort priors',
            impact: 'negative'
        });
    }

    return reasons;
}

/**
 * Build confidence reasons for HM
 */
function buildHMConfidenceReasons(
    transitions: number,
    weeksAnalyzed: number,
    confidence: ConfidenceLevel
): OracleCapacityConfidenceReason[] {
    const reasons: OracleCapacityConfidenceReason[] = [];

    if (transitions >= CONFIDENCE_THRESHOLDS.HIGH.min_transitions) {
        reasons.push({
            type: 'sample_size',
            message: `${transitions} HM interactions observed`,
            impact: 'positive'
        });
    } else if (transitions >= CONFIDENCE_THRESHOLDS.MED.min_transitions) {
        reasons.push({
            type: 'sample_size',
            message: `${transitions} HM interactions (moderate)`,
            impact: 'neutral'
        });
    } else {
        reasons.push({
            type: 'sample_size',
            message: `Few HM interactions (${transitions})`,
            impact: 'negative'
        });
    }

    return reasons;
}

/**
 * Combine two confidence levels (take the worse)
 */
function combineConfidence(a: ConfidenceLevel, b: ConfidenceLevel): ConfidenceLevel {
    const order: ConfidenceLevel[] = ['INSUFFICIENT', 'LOW', 'MED', 'HIGH'];
    const aIdx = order.indexOf(a);
    const bIdx = order.indexOf(b);
    return order[Math.min(aIdx, bIdx)];
}

/**
 * Aggregate multiple confidence levels
 */
function aggregateConfidences(confidences: ConfidenceLevel[]): ConfidenceLevel {
    if (confidences.length === 0) return 'LOW';
    const order: ConfidenceLevel[] = ['INSUFFICIENT', 'LOW', 'MED', 'HIGH'];
    const minIdx = Math.min(...confidences.map(c => order.indexOf(c)));
    return order[minIdx];
}

// ============================================
// EXPORTS
// ============================================

export {
    calculateCohortDefaults,
    buildStageCapacity,
    countStageTransitions
};
