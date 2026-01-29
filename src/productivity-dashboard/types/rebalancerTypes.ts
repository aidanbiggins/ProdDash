/**
 * Capacity Rebalancer Types
 * Types for the recruiter capacity rebalancing module
 */

import { CanonicalStage } from './entities';
import {
    ConfidenceLevel,
    LoadStatus,
    OracleCapacityProfile,
    OracleCapacityConfidenceReason,
    OraclePipelineByStage,
    OracleGlobalDemand
} from './capacityTypes';

// ===== CONSTANTS =====

export const REBALANCER_CONSTANTS = {
    /** Minimum recruiter_id coverage to show full analysis */
    MIN_RECRUITER_ID_COVERAGE: 0.5,

    /** Stage weights for overall utilization calculation */
    STAGE_WEIGHTS: {
        [CanonicalStage.SCREEN]: 0.35,
        [CanonicalStage.HM_SCREEN]: 0.25,
        [CanonicalStage.ONSITE]: 0.25,
        [CanonicalStage.OFFER]: 0.15
    } as Record<string, number>,

    /** Transfer cost penalty in days (context-switch overhead) */
    TRANSFER_COST_DAYS: 2,

    /** Epsilon to avoid divide by zero */
    EPSILON: 0.1,

    /** Max suggestions to return */
    DEFAULT_MAX_SUGGESTIONS: 5,

    /** Confidence ordering for aggregation */
    CONFIDENCE_ORDER: ['INSUFFICIENT', 'LOW', 'MED', 'HIGH'] as ConfidenceLevel[]
} as const;

/** Load status color mapping for UI */
export const LOAD_STATUS_COLORS: Record<LoadStatus, string> = {
    critical: '#ef4444',     // Red
    overloaded: '#f59e0b',   // Amber
    balanced: '#10b981',     // Green
    available: '#3b82f6',    // Blue
    underutilized: '#94a3b8' // Gray
};

/** Load status labels for UI */
export const LOAD_STATUS_LABELS: Record<LoadStatus, string> = {
    critical: 'Critical',
    overloaded: 'Overloaded',
    balanced: 'Balanced',
    available: 'Available',
    underutilized: 'Underutilized'
};

// ===== STAGE UTILIZATION =====

export interface StageUtilization {
    stage: CanonicalStage;
    stageName: string;
    demand: number;
    capacity: number;
    utilization: number;
    confidence: ConfidenceLevel;
}

// ===== RECRUITER UTILIZATION ROW =====

export interface RecruiterUtilizationRow {
    recruiterId: string;
    recruiterName: string;
    /** Number of open requisitions */
    reqCount: number;
    /** Total active candidates in flight */
    totalDemand: number;
    /** Weighted capacity per week */
    totalCapacity: number;
    /** Overall utilization percentage */
    utilization: number;
    /** Load status classification */
    status: LoadStatus;
    /** Per-stage breakdown */
    stageUtilization: StageUtilization[];
    /** Confidence in this row's data */
    confidence: ConfidenceLevel;
    /** Reasons for confidence level */
    confidenceReasons: OracleCapacityConfidenceReason[];
    /** Capacity profile used */
    capacityProfile: OracleCapacityProfile | null;
}

// ===== UTILIZATION RESULT =====

export interface UtilizationResult {
    rows: RecruiterUtilizationRow[];
    /** Overall team summary */
    summary: {
        totalDemand: number;
        totalCapacity: number;
        overallUtilization: number;
        overallStatus: LoadStatus;
        criticalCount: number;
        overloadedCount: number;
        availableCount: number;
        underutilizedCount: number;
    };
    /** Data quality metrics */
    dataQuality: {
        recruiterIdCoverage: number;
        reqsWithoutRecruiter: number;
        totalReqs: number;
    };
    /** Overall confidence */
    confidence: ConfidenceLevel;
    /** Reasons */
    confidenceReasons: OracleCapacityConfidenceReason[];
    /** Hedge message for display */
    hedgeMessage: string;
}

// ===== REASSIGNMENT CANDIDATE =====

export interface ReassignmentCandidate {
    reqId: string;
    reqTitle: string;
    fromRecruiterId: string;
    fromRecruiterName: string;
    toRecruiterId: string;
    toRecruiterName: string;
    /** Candidates by stage on this req */
    reqDemand: OraclePipelineByStage;
    /** Total candidate count on this req */
    totalCandidates: number;
}

// ===== MOVE SCORE =====

export interface MoveBeforeAfterState {
    sourceUtilization: number;
    sourceQueueDelay: number;
    targetUtilization: number;
    targetQueueDelay: number;
}

export interface MoveScore {
    move: ReassignmentCandidate;
    score: number;
    beforeState: MoveBeforeAfterState;
    afterState: MoveBeforeAfterState;
    expectedDelayReduction: number;
    utilizationBalanceImprovement: number;
    confidence: ConfidenceLevel;
    hedgeMessage: string;
}

// ===== REASSIGNMENT SUGGESTION =====

export interface ReassignmentSuggestion {
    rank: number;
    reqId: string;
    reqTitle: string;
    fromRecruiterId: string;
    fromRecruiterName: string;
    toRecruiterId: string;
    toRecruiterName: string;
    rationale: string;
    estimatedImpact: {
        delayReductionDays: number;
        sourceUtilizationBefore: number;
        sourceUtilizationAfter: number;
        targetUtilizationBefore: number;
        targetUtilizationAfter: number;
    };
    confidence: ConfidenceLevel;
    hedgeMessage: string;
    /** Demand breakdown by stage for this req */
    reqDemand: OraclePipelineByStage;
}

// ===== REBALANCER OPTIONS =====

export interface RebalancerOptions {
    maxSuggestions?: number;
    /** Include moves that create slight overload on target */
    allowModestOverload?: boolean;
}

// ===== REBALANCER RESULT =====

export interface RebalancerResult {
    utilizationResult: UtilizationResult;
    suggestions: ReassignmentSuggestion[];
    /** Whether there are moves to suggest */
    hasSuggestions: boolean;
    /** Whether all recruiters are balanced */
    isBalanced: boolean;
    /** Overall confidence */
    confidence: ConfidenceLevel;
    hedgeMessage: string;
}

// ===== MOVE IMPACT SIMULATION =====

export interface SimulatedMoveImpact {
    move: ReassignmentCandidate;
    beforeSource: {
        utilization: number;
        queueDelayDays: number;
        status: LoadStatus;
        demandByStage: OraclePipelineByStage;
    };
    afterSource: {
        utilization: number;
        queueDelayDays: number;
        status: LoadStatus;
        demandByStage: OraclePipelineByStage;
    };
    beforeTarget: {
        utilization: number;
        queueDelayDays: number;
        status: LoadStatus;
        demandByStage: OraclePipelineByStage;
    };
    afterTarget: {
        utilization: number;
        queueDelayDays: number;
        status: LoadStatus;
        demandByStage: OraclePipelineByStage;
    };
    netImpact: {
        delayReductionDays: number;
        sourceReliefPercent: number;
        targetImpactPercent: number;
    };
    confidence: ConfidenceLevel;
    hedgeMessage: string;
}

// ===== PRIVACY MODE =====

export type PrivacyMode = 'full' | 'anonymized' | 'local';

// ===== REBALANCER ACTION TYPES =====

/** Additional action types for capacity rebalancer */
export type RebalancerActionType =
    | 'REASSIGN_REQ'
    | 'NOTIFY_HM_REASSIGN'
    | 'RECRUITER_HANDOFF';

/** Evidence for rebalancer actions */
export interface RebalancerActionEvidence {
    source: 'capacity_rebalancer';
    move_rank: number;
    expected_improvement_days: number;
    confidence: ConfidenceLevel;
    from_recruiter_id: string;
    to_recruiter_id: string;
    before_after_snapshot?: {
        source_util_before: number;
        source_util_after: number;
        target_util_before: number;
        target_util_after: number;
    };
}

// ===== HELPER FUNCTIONS =====

/**
 * Get hedge message based on confidence level
 */
export function getHedgeMessage(confidence: ConfidenceLevel): string {
    switch (confidence) {
        case 'HIGH':
            return 'Based on observed patterns';
        case 'MED':
            return 'Based on similar cohorts';
        case 'LOW':
        case 'INSUFFICIENT':
        default:
            return 'Estimated (limited data)';
    }
}

/**
 * Aggregate multiple confidence levels (take worst)
 */
export function aggregateConfidences(confidences: ConfidenceLevel[]): ConfidenceLevel {
    if (confidences.length === 0) return 'LOW';
    const order = REBALANCER_CONSTANTS.CONFIDENCE_ORDER;
    const minIdx = Math.min(...confidences.map(c => order.indexOf(c)));
    return order[minIdx];
}

/**
 * Convert ID like "emily_watson" to "Emily Watson"
 */
function formatIdAsName(id: string): string {
    return id
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
}

/**
 * Get recruiter display name with privacy
 */
export function getRecruiterDisplayName(
    recruiterId: string,
    recruiterName: string | null,
    index: number,
    privacyMode: PrivacyMode
): string {
    if (privacyMode === 'full' || privacyMode === 'local') {
        // Use || to also catch empty strings, with fallback to formatted ID
        return recruiterName || formatIdAsName(recruiterId);
    }
    return `Recruiter ${index + 1}`;
}
