// HM Rules Configuration
// Default thresholds for HM metrics and risk detection

import { HMRulesConfig } from '../types/hmTypes';

/**
 * Default HM rules configuration.
 * These values can be overridden by function/level in the future.
 */
export const DEFAULT_HM_RULES: HMRulesConfig = {
    // Days without activity before flagging as "no movement"
    noMovementDays: 7,

    // Days after interview_completed before feedback is overdue
    feedbackDueDays: 2,

    // Days in HM_REVIEW bucket before flagging as overdue
    hmReviewDueDays: 3,

    // Days in HM_FINAL_DECISION bucket before flagging as overdue
    decisionDueDays: 3,

    // Minimum candidates in non-terminal stages to avoid "thin pipeline" flag
    lowPipelineThreshold: 3,

    // Days an open req can have no candidates beyond screen before warning
    lateStageEmptyDays: 10,

    // Days after offer_extended without offer_accepted/declined
    offerStallDays: 5,

    // Dimensions used to build peer comparison cohorts
    cohortKeys: ['function', 'level', 'location'],

    // Minimum events/data points for a metric to be considered valid
    minSampleSize: 5,

    // Minimum HMs in cohort for peer comparison (else relax cohort keys)
    minCohortSize: 5
};

/**
 * Stall reason code explanations and suggested next steps
 */
export const STALL_REASON_EXPLANATIONS: Record<string, {
    explanation: string;
    suggestedAction: string;
    priority: number;
}> = {
    AWAITING_HM_FEEDBACK: {
        explanation: 'Interviews have been completed but feedback has not been submitted.',
        suggestedAction: 'Submit interview feedback in your ATS.',
        priority: 1
    },
    AWAITING_HM_REVIEW: {
        explanation: 'Candidates are waiting for hiring manager review.',
        suggestedAction: 'Review submitted candidates and provide disposition.',
        priority: 2
    },
    PIPELINE_THIN: {
        explanation: 'There are fewer active candidates than recommended for this req.',
        suggestedAction: 'Work with your recruiter to source more candidates.',
        priority: 3
    },
    NO_ACTIVITY: {
        explanation: 'No pipeline movement has occurred in the threshold period.',
        suggestedAction: 'Check in with your recruiter on req status.',
        priority: 4
    },
    OFFER_STALL: {
        explanation: 'An offer has been extended but no response has been recorded.',
        suggestedAction: 'Follow up with the candidate or update offer status.',
        priority: 5
    },
    LATE_STAGE_EMPTY: {
        explanation: 'The req has been open for 10+ days but has no candidates in final decision stages.',
        suggestedAction: 'Review the candidate funnel with your recruiter to identify where the drop-off is occurring.',
        priority: 6
    },
    PROCESS_STALL_UNKNOWN: {
        explanation: 'The req appears stalled but the specific reason is unclear.',
        suggestedAction: 'Review the pipeline and identify blockers.',
        priority: 6
    },
    NONE: {
        explanation: 'The req is progressing normally.',
        suggestedAction: '',
        priority: 99
    }
};

/**
 * Suggested action text for pending HM actions
 */
export const PENDING_ACTION_SUGGESTIONS: Record<string, string> = {
    FEEDBACK_DUE: 'Submit interview feedback for this candidate.',
    REVIEW_DUE: 'Review this candidate and move forward or decline.',
    DECISION_DUE: 'Make a final hiring decision for this candidate.'
};

/**
 * Risk flag definitions
 */
export const RISK_FLAG_DEFINITIONS = {
    NO_MOVEMENT: {
        code: 'NO_MOVEMENT',
        label: 'No Movement',
        severity: 'warning' as const,
        description: 'No pipeline activity in threshold days'
    },
    LOW_PIPELINE: {
        code: 'LOW_PIPELINE',
        label: 'Low Pipeline',
        severity: 'danger' as const,
        description: 'Fewer active candidates than threshold'
    },
    FEEDBACK_BACKLOG: {
        code: 'FEEDBACK_BACKLOG',
        label: 'Feedback Due',
        severity: 'warning' as const,
        description: 'Interviews awaiting feedback'
    },
    HM_REVIEW_BACKLOG: {
        code: 'HM_REVIEW_BACKLOG',
        label: 'Review Backlog',
        severity: 'warning' as const,
        description: 'Candidates awaiting HM review'
    },
    OFFER_PENDING: {
        code: 'OFFER_PENDING',
        label: 'Offer Pending',
        severity: 'info' as const,
        description: 'Offer extended, awaiting response'
    }
};
