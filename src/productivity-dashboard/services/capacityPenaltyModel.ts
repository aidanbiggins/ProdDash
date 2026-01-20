/**
 * Capacity Penalty Model for Oracle v1.1
 *
 * Applies queue delay penalties to stage durations when pipeline demand exceeds capacity.
 * Uses a simple and defensible queuing model (not full discrete event simulation).
 *
 * Key formula:
 * queue_delay_days = ((demand - service_rate) / service_rate) * 7 * queueFactor
 *
 * Where:
 * - demand = number of candidates needing service at the stage (v1.1: GLOBAL workload)
 * - service_rate = capacity (candidates/week) for that stage
 * - queueFactor = 1.0 (not user-adjustable in v1)
 * - Capped at MAX_QUEUE_DELAY_DAYS to prevent runaway outputs
 *
 * v1.1 Changes:
 * - Demand is now computed from recruiter/HM's GLOBAL workload across all open reqs
 * - Added OracleGlobalDemand with competing workload context
 * - Tightened confidence scoring
 * - Added prescriptive recommendations
 */

import { CanonicalStage, Candidate, Requisition, User, CandidateDisposition, RequisitionStatus } from '../types';
import { DurationDistribution, SimulationParameters } from './probabilisticEngine';
import {
    OracleCapacityProfile,
    OracleCapacityPenaltyResult,
    OracleStageQueueDiagnostic,
    OracleAdjustedDuration,
    OraclePipelineByStage,
    ConfidenceLevel,
    ORACLE_CAPACITY_CONSTANTS,
    ORACLE_CAPACITY_LIMITED_STAGES,
    ORACLE_STAGE_OWNER_MAP,
    ORACLE_CAPACITY_STAGE_LABELS,
    OracleGlobalDemand,
    OracleGlobalDemandInput,
    OracleCapacityPenaltyResultV11,
    OracleCapacityRecommendation,
    OracleCapacityConfidenceReason
} from '../types/capacityTypes';

const { MAX_QUEUE_DELAY_DAYS, DEFAULT_QUEUE_FACTOR } = ORACLE_CAPACITY_CONSTANTS;

// ============================================
// GLOBAL DEMAND COMPUTATION (v1.1)
// ============================================

/**
 * Compute global demand across all open reqs for the recruiter and HM
 *
 * This is the key fix in v1.1: demand is computed from the recruiter/HM's
 * TOTAL workload across all their open reqs, not just the selected req.
 */
export function computeGlobalDemand(input: OracleGlobalDemandInput): OracleGlobalDemand {
    const {
        selectedReqId,
        recruiterId,
        hmId,
        allCandidates,
        allRequisitions,
        users
    } = input;

    const confidenceReasons: OracleCapacityConfidenceReason[] = [];

    // Find open reqs for recruiter and HM
    const openReqs = allRequisitions.filter(r =>
        r.status === RequisitionStatus.Open || (!r.closed_at && r.status !== RequisitionStatus.Closed)
    );

    // Get recruiter's open reqs
    const recruiterReqs = recruiterId
        ? openReqs.filter(r => r.recruiter_id === recruiterId)
        : [];
    const recruiterReqIds = recruiterReqs.map(r => r.req_id);

    // Get HM's open reqs
    const hmReqs = hmId
        ? openReqs.filter(r => r.hiring_manager_id === hmId)
        : [];
    const hmReqIds = hmReqs.map(r => r.req_id);

    // Filter active candidates only (not terminal)
    const activeCandidates = allCandidates.filter(c =>
        c.disposition === CandidateDisposition.Active ||
        !c.disposition // Treat undefined as active
    );

    // Compute recruiter demand: candidates in recruiter-controlled stages across all recruiter reqs
    const recruiterDemand: OraclePipelineByStage = {};
    const recruiterStageCandidates = activeCandidates.filter(c =>
        recruiterReqIds.includes(c.req_id)
    );

    for (const cand of recruiterStageCandidates) {
        const stage = cand.current_stage;
        // Only count stages where recruiter is the bottleneck
        if (stage === CanonicalStage.SCREEN || stage === CanonicalStage.ONSITE || stage === CanonicalStage.OFFER) {
            recruiterDemand[stage] = (recruiterDemand[stage] || 0) + 1;
        }
    }

    // Compute HM demand: candidates in HM-controlled stages across all HM reqs
    const hmDemand: OraclePipelineByStage = {};
    const hmStageCandidates = activeCandidates.filter(c =>
        hmReqIds.includes(c.req_id)
    );

    for (const cand of hmStageCandidates) {
        const stage = cand.current_stage;
        // Only count stages where HM is the bottleneck
        if (stage === CanonicalStage.HM_SCREEN) {
            hmDemand[stage] = (hmDemand[stage] || 0) + 1;
        }
    }

    // Compute selected req pipeline (for display only)
    const selectedReqPipeline: OraclePipelineByStage = {};
    const selectedReqCandidates = activeCandidates.filter(c => c.req_id === selectedReqId);
    for (const cand of selectedReqCandidates) {
        const stage = cand.current_stage;
        selectedReqPipeline[stage] = (selectedReqPipeline[stage] || 0) + 1;
    }

    // Lookup names
    const recruiterName = users?.find(u => u.user_id === recruiterId)?.name || null;
    const hmName = users?.find(u => u.user_id === hmId)?.name || null;

    // Determine demand scope and confidence
    let demandScope: OracleGlobalDemand['demand_scope'] = 'single_req';
    let confidence: ConfidenceLevel = 'MED';

    if (!recruiterId && !hmId) {
        demandScope = 'single_req';
        confidence = 'LOW';
        confidenceReasons.push({
            type: 'missing_data',
            message: 'Both recruiter_id and hm_id missing - using single-req fallback',
            impact: 'negative'
        });
    } else if (recruiterId && hmId) {
        demandScope = 'global_by_recruiter'; // Prefer recruiter scope
        confidence = 'HIGH';
        if (recruiterReqs.length > 1) {
            confidenceReasons.push({
                type: 'sample_size',
                message: `Using global workload: Recruiter has ${recruiterReqs.length} open reqs`,
                impact: 'positive'
            });
        }
    } else if (recruiterId) {
        demandScope = 'global_by_recruiter';
        confidence = 'MED';
        confidenceReasons.push({
            type: 'missing_data',
            message: 'hm_id missing - HM demand using cohort defaults',
            impact: 'neutral'
        });
    } else {
        demandScope = 'global_by_hm';
        confidence = 'MED';
        confidenceReasons.push({
            type: 'missing_data',
            message: 'recruiter_id missing - Recruiter demand using cohort defaults',
            impact: 'neutral'
        });
    }

    // Check for empty pipeline
    const totalSelectedPipeline = Object.values(selectedReqPipeline).reduce((a, b) => a + b, 0);
    if (totalSelectedPipeline === 0) {
        confidence = 'LOW';
        confidenceReasons.push({
            type: 'sample_size',
            message: 'Selected req has 0 active candidates in pipeline',
            impact: 'negative'
        });
    }

    return {
        demand_scope: demandScope,
        recruiter_demand: recruiterDemand,
        hm_demand: hmDemand,
        recruiter_context: {
            recruiter_id: recruiterId,
            recruiter_name: recruiterName,
            open_req_count: recruiterReqs.length,
            total_candidates_in_flight: recruiterStageCandidates.length,
            req_ids: recruiterReqIds
        },
        hm_context: {
            hm_id: hmId,
            hm_name: hmName,
            open_req_count: hmReqs.length,
            total_candidates_in_flight: hmStageCandidates.length,
            req_ids: hmReqIds
        },
        selected_req_pipeline: selectedReqPipeline,
        confidence,
        confidence_reasons: confidenceReasons
    };
}

/**
 * Get effective demand for a stage using global demand (v1.1)
 *
 * For recruiter-owned stages (SCREEN, ONSITE, OFFER), use recruiter_demand.
 * For HM-owned stages (HM_SCREEN), use hm_demand.
 */
function getEffectiveDemand(
    stage: CanonicalStage,
    globalDemand: OracleGlobalDemand
): number {
    const ownerType = ORACLE_STAGE_OWNER_MAP[stage];

    switch (ownerType) {
        case 'recruiter':
            return globalDemand.recruiter_demand[stage] || 0;
        case 'hm':
            return globalDemand.hm_demand[stage] || 0;
        case 'shared':
            // For shared stages (ONSITE), use recruiter demand as primary
            return globalDemand.recruiter_demand[stage] || 0;
        default:
            return globalDemand.selected_req_pipeline[stage] || 0;
    }
}

// ============================================
// v1.1 PENALTY APPLICATION WITH GLOBAL DEMAND
// ============================================

/**
 * Apply capacity penalties using global demand (v1.1)
 *
 * This is the main entry point for v1.1. It computes penalties based on
 * the recruiter/HM's total workload, not just the selected req.
 */
export function applyCapacityPenaltyV11(
    stageDurations: Record<string, DurationDistribution>,
    globalDemand: OracleGlobalDemand,
    capacityProfile: OracleCapacityProfile
): OracleCapacityPenaltyResultV11 {
    const stage_diagnostics: OracleStageQueueDiagnostic[] = [];
    const adjusted_durations: Record<string, OracleAdjustedDuration> = {};
    let total_queue_delay_days = 0;

    for (const stage of ORACLE_CAPACITY_LIMITED_STAGES) {
        // v1.1: Use global demand instead of single-req pipeline
        const demand = getEffectiveDemand(stage, globalDemand);
        const serviceRate = getServiceRateForStage(stage, capacityProfile);
        const originalDist = stageDurations[stage];

        // Calculate queue delay
        const queueDelay = calculateQueueDelay(demand, serviceRate);

        // Get original median for reporting
        const originalMedian = getDistributionMedian(originalDist);

        // Build diagnostic
        const diagnostic: OracleStageQueueDiagnostic = {
            stage,
            stage_name: ORACLE_CAPACITY_STAGE_LABELS[stage] || stage,
            demand,
            service_rate: serviceRate,
            queue_delay_days: queueDelay,
            is_bottleneck: queueDelay > 0,
            bottleneck_owner_type: queueDelay > 0 ? (ORACLE_STAGE_OWNER_MAP[stage] || 'shared') : 'none',
            confidence: getStageConfidenceV11(stage, capacityProfile, globalDemand)
        };
        stage_diagnostics.push(diagnostic);

        // Build adjusted duration
        const adjustedDuration = buildAdjustedDuration(
            stage,
            originalDist,
            originalMedian,
            queueDelay
        );
        adjusted_durations[stage] = adjustedDuration;

        total_queue_delay_days += queueDelay;
    }

    // Sort bottlenecks by delay (descending)
    const top_bottlenecks = [...stage_diagnostics]
        .filter(d => d.is_bottleneck)
        .sort((a, b) => b.queue_delay_days - a.queue_delay_days)
        .slice(0, 3);

    // Overall confidence is the minimum of all stage confidences AND global demand confidence
    const confidences = [
        ...stage_diagnostics.map(d => d.confidence),
        globalDemand.confidence
    ];
    const confidence = aggregateConfidencesV11(confidences, capacityProfile, globalDemand);

    // Generate prescriptive recommendations
    const recommendations = generateRecommendations(top_bottlenecks, globalDemand, capacityProfile);

    return {
        adjusted_durations,
        stage_diagnostics,
        top_bottlenecks,
        total_queue_delay_days,
        confidence,
        global_demand: globalDemand,
        recommendations
    };
}

/**
 * Get stage confidence with v1.1 rules (more conservative)
 */
function getStageConfidenceV11(
    stage: CanonicalStage,
    capacityProfile: OracleCapacityProfile,
    globalDemand: OracleGlobalDemand
): ConfidenceLevel {
    const { recruiter, hm } = capacityProfile;

    // Check if stage uses priors (reduces confidence)
    let usesDefault = false;
    let baseConfidence: ConfidenceLevel = 'MED';

    switch (stage) {
        case CanonicalStage.SCREEN:
            baseConfidence = recruiter?.screens_per_week.confidence || 'LOW';
            usesDefault = !recruiter?.screens_per_week;
            break;
        case CanonicalStage.HM_SCREEN:
            baseConfidence = hm?.interviews_per_week?.confidence ||
                recruiter?.hm_screens_per_week?.confidence || 'LOW';
            usesDefault = !hm?.interviews_per_week && !recruiter?.hm_screens_per_week;
            break;
        case CanonicalStage.ONSITE:
            baseConfidence = recruiter?.onsites_per_week?.confidence || 'LOW';
            usesDefault = !recruiter?.onsites_per_week;
            break;
        case CanonicalStage.OFFER:
            baseConfidence = recruiter?.offers_per_week?.confidence || 'LOW';
            usesDefault = !recruiter?.offers_per_week;
            break;
        default:
            baseConfidence = 'LOW';
            usesDefault = true;
    }

    // v1.1: Downgrade if using defaults
    if (usesDefault) {
        return 'LOW';
    }

    // v1.1: Downgrade if recruiter/HM ID is missing for this stage
    const ownerType = ORACLE_STAGE_OWNER_MAP[stage];
    if (ownerType === 'recruiter' && !globalDemand.recruiter_context.recruiter_id) {
        return 'LOW';
    }
    if (ownerType === 'hm' && !globalDemand.hm_context.hm_id) {
        return 'LOW';
    }

    return baseConfidence;
}

/**
 * Aggregate confidences with v1.1 rules (more conservative)
 */
function aggregateConfidencesV11(
    confidences: ConfidenceLevel[],
    capacityProfile: OracleCapacityProfile,
    globalDemand: OracleGlobalDemand
): ConfidenceLevel {
    if (confidences.length === 0) return 'LOW';

    // Count how many stages use priors
    let priorCount = 0;
    if (capacityProfile.used_cohort_fallback) priorCount += 2;
    if (!capacityProfile.recruiter) priorCount += 2;
    if (!capacityProfile.hm) priorCount += 1;

    // v1.1: LOW if >= 2 critical stages use priors
    if (priorCount >= 2) {
        return 'LOW';
    }

    // v1.1: LOW if both recruiter_id and hm_id missing
    if (!globalDemand.recruiter_context.recruiter_id && !globalDemand.hm_context.hm_id) {
        return 'LOW';
    }

    // v1.1: LOW if selected req has 0 pipeline candidates
    const totalPipeline = Object.values(globalDemand.selected_req_pipeline).reduce((a, b) => a + b, 0);
    if (totalPipeline === 0) {
        return 'LOW';
    }

    // Otherwise, take the minimum
    const order: ConfidenceLevel[] = ['INSUFFICIENT', 'LOW', 'MED', 'HIGH'];
    const minIdx = Math.min(...confidences.map(c => order.indexOf(c)));
    return order[minIdx];
}

/**
 * Generate prescriptive recommendations based on bottlenecks
 *
 * v1.1: Added hedging language to all recommendations
 */
function generateRecommendations(
    bottlenecks: OracleStageQueueDiagnostic[],
    globalDemand: OracleGlobalDemand,
    capacityProfile: OracleCapacityProfile
): OracleCapacityRecommendation[] {
    const recommendations: OracleCapacityRecommendation[] = [];

    // Determine confidence level for hedging
    const confidenceHedge = capacityProfile.overall_confidence === 'HIGH'
        ? 'Based on observed patterns'
        : capacityProfile.overall_confidence === 'MED'
            ? 'Based on similar cohorts'
            : 'Estimated (limited data)';

    for (const bottleneck of bottlenecks.slice(0, 2)) {
        const { stage, demand, service_rate, queue_delay_days, bottleneck_owner_type } = bottleneck;

        // Recommendation 1: Increase throughput
        const targetRate = Math.ceil(demand / 0.9); // Target 90% utilization
        if (targetRate > service_rate) {
            const impactDays = Math.round(queue_delay_days * 0.7); // Conservative estimate

            recommendations.push({
                type: 'increase_throughput',
                description: `${confidenceHedge}: Increase ${ORACLE_CAPACITY_STAGE_LABELS[stage]} throughput to ~${targetRate}/week`,
                estimated_impact_days: impactDays,
                details: {
                    stage,
                    current_value: service_rate,
                    target_value: targetRate,
                    owner_type: bottleneck_owner_type as 'recruiter' | 'hm'
                }
            });
        }

        // Recommendation 2: Reduce demand (if recruiter has multiple reqs)
        const context = bottleneck_owner_type === 'hm'
            ? globalDemand.hm_context
            : globalDemand.recruiter_context;

        if (context.open_req_count > 3) {
            const reqsToReassign = Math.ceil((demand - service_rate) / (demand / context.open_req_count));
            if (reqsToReassign > 0 && reqsToReassign < context.open_req_count) {
                recommendations.push({
                    type: 'reassign_workload',
                    description: `${confidenceHedge}: Reassign ~${reqsToReassign} req(s) to reduce ${bottleneck_owner_type === 'hm' ? 'HM' : 'Recruiter'} load`,
                    estimated_impact_days: Math.round(queue_delay_days * 0.5),
                    details: {
                        stage,
                        current_value: context.open_req_count,
                        target_value: context.open_req_count - reqsToReassign,
                        owner_type: bottleneck_owner_type as 'recruiter' | 'hm'
                    }
                });
            }
        }
    }

    // Add data quality recommendation if confidence is low
    if (globalDemand.confidence === 'LOW') {
        recommendations.push({
            type: 'improve_data',
            description: 'Add recruiter_id and hm_id to improve forecast accuracy',
            estimated_impact_days: 0,
            details: {}
        });
    }

    return recommendations;
}

// ============================================
// MAIN PENALTY APPLICATION FUNCTION
// ============================================

/**
 * Apply capacity penalties to stage durations
 *
 * @param stageDurations Original stage duration distributions
 * @param pipelineByStage Count of candidates at each stage
 * @param capacityProfile Inferred capacity profile
 * @returns Adjusted durations and diagnostics
 */
export function applyCapacityPenalty(
    stageDurations: Record<string, DurationDistribution>,
    pipelineByStage: OraclePipelineByStage,
    capacityProfile: OracleCapacityProfile
): OracleCapacityPenaltyResult {
    const stage_diagnostics: OracleStageQueueDiagnostic[] = [];
    const adjusted_durations: Record<string, OracleAdjustedDuration> = {};
    let total_queue_delay_days = 0;

    for (const stage of ORACLE_CAPACITY_LIMITED_STAGES) {
        const demand = pipelineByStage[stage] || 0;
        const serviceRate = getServiceRateForStage(stage, capacityProfile);
        const originalDist = stageDurations[stage];

        // Calculate queue delay
        const queueDelay = calculateQueueDelay(demand, serviceRate);

        // Get original median for reporting
        const originalMedian = getDistributionMedian(originalDist);

        // Build diagnostic
        const diagnostic: OracleStageQueueDiagnostic = {
            stage,
            stage_name: ORACLE_CAPACITY_STAGE_LABELS[stage] || stage,
            demand,
            service_rate: serviceRate,
            queue_delay_days: queueDelay,
            is_bottleneck: queueDelay > 0,
            bottleneck_owner_type: queueDelay > 0 ? (ORACLE_STAGE_OWNER_MAP[stage] || 'shared') : 'none',
            confidence: getStageConfidence(stage, capacityProfile)
        };
        stage_diagnostics.push(diagnostic);

        // Build adjusted duration
        const adjustedDuration = buildAdjustedDuration(
            stage,
            originalDist,
            originalMedian,
            queueDelay
        );
        adjusted_durations[stage] = adjustedDuration;

        total_queue_delay_days += queueDelay;
    }

    // Sort bottlenecks by delay (descending)
    const top_bottlenecks = [...stage_diagnostics]
        .filter(d => d.is_bottleneck)
        .sort((a, b) => b.queue_delay_days - a.queue_delay_days)
        .slice(0, 3);

    // Overall confidence is the minimum of all stage confidences
    const confidences = stage_diagnostics.map(d => d.confidence);
    const confidence = aggregateConfidences(confidences);

    return {
        adjusted_durations,
        stage_diagnostics,
        top_bottlenecks,
        total_queue_delay_days,
        confidence
    };
}

// ============================================
// QUEUE DELAY CALCULATION
// ============================================

/**
 * Calculate queue delay for a stage
 *
 * Formula: ((demand - capacity) / capacity) * 7 * queueFactor
 * Capped at MAX_QUEUE_DELAY_DAYS
 */
export function calculateQueueDelay(
    demand: number,
    serviceRate: number,
    queueFactor: number = DEFAULT_QUEUE_FACTOR
): number {
    // No delay if demand <= capacity
    if (demand <= serviceRate || serviceRate <= 0) {
        return 0;
    }

    // Calculate raw delay
    const excessDemand = demand - serviceRate;
    const rawDelay = (excessDemand / serviceRate) * 7 * queueFactor;

    // Cap at maximum
    return Math.min(rawDelay, MAX_QUEUE_DELAY_DAYS);
}

/**
 * Get the service rate (capacity) for a stage
 */
function getServiceRateForStage(
    stage: CanonicalStage,
    capacityProfile: OracleCapacityProfile
): number {
    const { recruiter, hm, cohort_defaults } = capacityProfile;

    switch (stage) {
        case CanonicalStage.SCREEN:
            return recruiter?.screens_per_week.throughput_per_week ||
                cohort_defaults.screens_per_week;

        case CanonicalStage.HM_SCREEN:
            // HM capacity takes precedence if available
            return hm?.interviews_per_week?.throughput_per_week ||
                recruiter?.hm_screens_per_week?.throughput_per_week ||
                cohort_defaults.hm_screens_per_week;

        case CanonicalStage.ONSITE:
            return recruiter?.onsites_per_week?.throughput_per_week ||
                cohort_defaults.onsites_per_week;

        case CanonicalStage.OFFER:
            return recruiter?.offers_per_week?.throughput_per_week ||
                cohort_defaults.offers_per_week;

        default:
            return 5; // Default fallback
    }
}

// ============================================
// DURATION ADJUSTMENT
// ============================================

/**
 * Build adjusted duration distribution
 */
function buildAdjustedDuration(
    stage: CanonicalStage,
    originalDist: DurationDistribution | undefined,
    originalMedian: number,
    queueDelay: number
): OracleAdjustedDuration {
    const adjustedMedian = originalMedian + queueDelay;

    const result: OracleAdjustedDuration = {
        stage,
        original_median_days: originalMedian,
        queue_delay_days: queueDelay,
        adjusted_median_days: adjustedMedian
    };

    // Calculate adjusted distribution parameters
    if (originalDist?.type === 'lognormal' && originalDist.mu !== undefined) {
        // For lognormal, we add the delay to the median, which means adjusting mu
        // New median = exp(new_mu) = old_median + queue_delay
        // new_mu = ln(old_median + queue_delay)
        const newMedian = Math.exp(originalDist.mu) + queueDelay;
        result.adjusted_mu = Math.log(Math.max(1, newMedian));
    } else if (originalDist?.type === 'constant') {
        result.adjusted_days = (originalDist.days || 7) + queueDelay;
    } else {
        // For undefined or empirical, we'll add a constant adjustment
        result.adjusted_days = originalMedian + queueDelay;
    }

    return result;
}

/**
 * Get median from a duration distribution
 */
function getDistributionMedian(dist: DurationDistribution | undefined): number {
    if (!dist) return 7; // Default

    if (dist.type === 'lognormal' && dist.mu !== undefined) {
        return Math.exp(dist.mu);
    }

    if (dist.type === 'constant') {
        return dist.days || 7;
    }

    if (dist.type === 'empirical' && dist.buckets && dist.buckets.length > 0) {
        // Find median from buckets
        let cumulative = 0;
        for (const bucket of dist.buckets) {
            cumulative += bucket.probability;
            if (cumulative >= 0.5) {
                return bucket.days;
            }
        }
        return dist.buckets[0].days;
    }

    return 7;
}

/**
 * Get confidence for a specific stage
 */
function getStageConfidence(
    stage: CanonicalStage,
    capacityProfile: OracleCapacityProfile
): ConfidenceLevel {
    const { recruiter, hm } = capacityProfile;

    switch (stage) {
        case CanonicalStage.SCREEN:
            return recruiter?.screens_per_week.confidence || 'LOW';

        case CanonicalStage.HM_SCREEN:
            return hm?.interviews_per_week?.confidence ||
                recruiter?.hm_screens_per_week?.confidence || 'LOW';

        case CanonicalStage.ONSITE:
            return recruiter?.onsites_per_week?.confidence || 'LOW';

        case CanonicalStage.OFFER:
            return recruiter?.offers_per_week?.confidence || 'LOW';

        default:
            return 'LOW';
    }
}

/**
 * Aggregate confidence levels (take the worst)
 */
function aggregateConfidences(confidences: ConfidenceLevel[]): ConfidenceLevel {
    if (confidences.length === 0) return 'LOW';
    const order: ConfidenceLevel[] = ['INSUFFICIENT', 'LOW', 'MED', 'HIGH'];
    const minIdx = Math.min(...confidences.map(c => order.indexOf(c)));
    return order[minIdx];
}

// ============================================
// SIMULATION PARAMETER ADJUSTMENT
// ============================================

/**
 * Create adjusted simulation parameters with capacity delays applied
 */
export function createCapacityAdjustedParams(
    baseParams: SimulationParameters,
    penaltyResult: OracleCapacityPenaltyResult
): SimulationParameters {
    const adjustedDurations: Record<string, DurationDistribution> = {
        ...baseParams.stageDurations
    };

    for (const [stageStr, adjustment] of Object.entries(penaltyResult.adjusted_durations)) {
        const stage = stageStr as CanonicalStage;
        const baseDist = baseParams.stageDurations[stage];

        if (adjustment.queue_delay_days > 0) {
            if (baseDist?.type === 'lognormal' && adjustment.adjusted_mu !== undefined) {
                adjustedDurations[stage] = {
                    ...baseDist,
                    mu: adjustment.adjusted_mu
                };
            } else if (adjustment.adjusted_days !== undefined) {
                adjustedDurations[stage] = {
                    type: 'constant',
                    days: adjustment.adjusted_days
                };
            }
        }
    }

    return {
        ...baseParams,
        stageDurations: adjustedDurations
    };
}

// ============================================
// EXPORTS (non-inline exports only)
// ============================================

export {
    getServiceRateForStage,
    getDistributionMedian,
    buildAdjustedDuration
};
