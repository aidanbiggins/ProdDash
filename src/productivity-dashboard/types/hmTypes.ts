// HM-focused types for the Productivity Dashboard
// These types support the Hiring Manager analytics features

import { Requisition, Candidate, Event, User } from './entities';

// ===== HM DECISION BUCKETS =====

/**
 * Decision buckets represent stages from the HM's perspective.
 * These are used for funnel visualization and action tracking.
 */
export enum HMDecisionBucket {
    HM_REVIEW = 'HM_REVIEW',           // Resume review, HM review, submitted to HM
    HM_INTERVIEW_DECISION = 'HM_INTERVIEW_DECISION', // Move to interview, schedule loop
    HM_FEEDBACK = 'HM_FEEDBACK',       // Feedback due after interview
    HM_FINAL_DECISION = 'HM_FINAL_DECISION', // Debrief, decision pending
    OFFER_DECISION = 'OFFER_DECISION', // Offer approval, comp approval, offer pending
    DONE = 'DONE',                     // Hired, closed, rejected
    OTHER = 'OTHER'                    // Unknown stage, needs mapping
}

// ===== STALL REASON CODES =====

/**
 * Stall reason codes identify why a req is not progressing.
 * Priority order determines which code takes precedence.
 */
export enum StallReasonCode {
    AWAITING_HM_FEEDBACK = 'AWAITING_HM_FEEDBACK',
    AWAITING_HM_REVIEW = 'AWAITING_HM_REVIEW',
    PIPELINE_THIN = 'PIPELINE_THIN',
    NO_ACTIVITY = 'NO_ACTIVITY',
    OFFER_STALL = 'OFFER_STALL',
    LATE_STAGE_EMPTY = 'LATE_STAGE_EMPTY',
    PROCESS_STALL_UNKNOWN = 'PROCESS_STALL_UNKNOWN',
    NONE = 'NONE'
}

export interface StallReason {
    code: StallReasonCode;
    explanation: string;
    evidence: string; // e.g., "3 interviews completed, 0 feedback in 4 days"
    priority: number; // Lower = higher priority
}

// ===== PENDING ACTIONS =====

export enum HMActionType {
    FEEDBACK_DUE = 'FEEDBACK_DUE',
    REVIEW_DUE = 'REVIEW_DUE',
    DECISION_DUE = 'DECISION_DUE'
}

export interface HMPendingAction {
    actionType: HMActionType;
    hmUserId: string;
    hmName: string;
    reqId: string;
    reqTitle: string;
    candidateId: string;
    candidateName: string;
    triggerDate: Date;
    daysWaiting: number;
    daysOverdue: number; // Negative if not overdue yet
    suggestedAction: string;
}

// ===== FILL DATE FORECAST =====

export interface FillDateForecast {
    reqId: string;
    reqTitle: string;
    hmUserId: string;
    currentBucket: HMDecisionBucket;
    activeCandidates: number;

    // Forecast dates
    earliestDate: Date | null;  // P25
    likelyDate: Date | null;    // Median
    lateDate: Date | null;      // P75

    // Confidence
    sampleSize: number;         // How many similar hires used
    cohortDescription: string;  // e.g., "Engineering IC3 Remote"
    isFallback: boolean;        // True if using global medians
}

// ===== LATENCY METRICS =====

export interface LatencyStats {
    median: number | null;  // Days
    p75: number | null;
    p90: number | null;
    max: number | null;
    sampleSize: number;
    openItems: number;      // Items still waiting (not in stats)
}

export interface HMLatencyMetrics {
    hmUserId: string;
    hmName: string;

    feedbackLatency: LatencyStats;
    reviewLatency: LatencyStats;
    finalDecisionLatency: LatencyStats;

    // Overall
    medianDaysSinceMovement: number | null;
}

// ===== PEER COMPARISON =====

export interface PeerComparisonMetric {
    metricName: string;
    hmValue: number | null;
    cohortMedian: number | null;
    cohortP75: number | null;
    percentileRank: number | null;  // 0-100, higher = better (or worse for latency)
    isHigherBetter: boolean;
    insufficientData: boolean;
}

export interface PeerComparison {
    hmUserId: string;
    hmName: string;
    cohortDescription: string;
    cohortSize: number;
    metrics: PeerComparisonMetric[];
}

// ===== HM REQ ROLLUP =====

/**
 * Per-HM per-Req metrics for the scorecard
 */
export interface HMReqRollup {
    reqId: string;
    reqTitle: string;
    hmUserId: string;
    hmName: string;
    function: string;
    level: string;
    location: string;
    recruiterId: string;
    recruiterName: string;

    // Timing
    reqAgeDays: number;
    lastMovementDate: Date | null;
    daysSinceLastMovement: number | null;

    // Pipeline
    pipelineDepth: number;  // Total active candidates
    candidatesByBucket: Record<HMDecisionBucket, number>;

    // Risk flags
    riskFlags: RiskFlag[];
    primaryStallReason: StallReason;

    // Forecast
    forecast: FillDateForecast | null;
}

export interface RiskFlag {
    code: string;
    label: string;
    severity: 'warning' | 'danger' | 'info';
}

// ===== HM ROLLUP (AGGREGATE) =====

/**
 * Aggregate metrics per HM across all their reqs
 */
export interface HMRollup {
    hmUserId: string;
    hmName: string;
    team: string;
    managerUserId: string | null;

    // Req counts
    totalOpenReqs: number;
    totalClosedReqs: number;
    reqsWithRiskFlags: number;

    // Pipeline totals
    totalActiveCandidates: number;
    candidatesByBucket: Record<HMDecisionBucket, number>;

    // Pending actions
    pendingActionsCount: number;
    feedbackDueCount: number;
    reviewDueCount: number;
    decisionDueCount: number;

    // Latency
    latencyMetrics: HMLatencyMetrics;
    peerComparison: PeerComparison | null;

    // Function/level mix for cohort matching
    functionMix: Record<string, number>;  // function -> req count
    levelMix: Record<string, number>;     // level -> req count
}

// ===== FACT TABLES =====

/**
 * Enriched requisition with derived fields
 */
export interface ReqFact extends Requisition {
    isOpen: boolean;
    reqAgeDays: number;
    hmName: string;
    recruiterName: string;
}

/**
 * Enriched candidate with derived fields
 */
export interface CandidateFact extends Candidate {
    reqTitle: string;
    hmUserId: string;
    hmName: string;
    recruiterId: string;
    recruiterName: string;

    // Stage info
    canonicalStage: string | null;
    decisionBucket: HMDecisionBucket;
    currentStageEnteredAt: Date | null;
    stageAgeDays: number;

    // Status
    isActive: boolean;
}

/**
 * Enriched event with derived fields
 */
export interface EventFact extends Event {
    reqTitle: string;
    candidateName: string;
    actorName: string;
    hmUserId: string;

    // Bucket transitions
    fromBucket: HMDecisionBucket | null;
    toBucket: HMDecisionBucket | null;
}

/**
 * All fact tables bundled together
 */
export interface HMFactTables {
    reqFacts: ReqFact[];
    candidateFacts: CandidateFact[];
    eventFacts: EventFact[];
    asOfDate: Date;
}

// ===== FILTER STATE =====

export interface HMFilterState {
    selectedHmUserId: string | null;  // null = all HMs
    functions: string[];
    levels: string[];
    locations: string[];
    recruiterId: string | null;
    dateWindowDays: number;  // For historical closed reqs (default 180)
}

// ===== CONFIG TYPES =====

export interface HMRulesConfig {
    noMovementDays: number;
    feedbackDueDays: number;
    hmReviewDueDays: number;
    decisionDueDays: number;
    lowPipelineThreshold: number;
    lateStageEmptyDays: number;
    offerStallDays: number;
    cohortKeys: ('function' | 'level' | 'location')[];
    minSampleSize: number;
    minCohortSize: number;
}

export interface StageBucketMapping {
    stage: string;           // Canonical stage name
    bucket: HMDecisionBucket;
    isTerminal: boolean;     // True for hired, rejected, withdrew
}
