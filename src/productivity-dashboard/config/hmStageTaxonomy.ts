// HM Stage Taxonomy
// Maps canonical stages to HM decision buckets

import { CanonicalStage } from '../types/entities';
import { HMDecisionBucket, StageBucketMapping } from '../types/hmTypes';

/**
 * Map canonical stages to HM decision buckets.
 * This determines how stages appear in the HM funnel view.
 */
export const STAGE_TO_BUCKET_MAP: StageBucketMapping[] = [
    // Early stages - not yet with HM
    { stage: CanonicalStage.LEAD, bucket: HMDecisionBucket.OTHER, isTerminal: false },
    { stage: CanonicalStage.APPLIED, bucket: HMDecisionBucket.OTHER, isTerminal: false },
    { stage: CanonicalStage.SCREEN, bucket: HMDecisionBucket.OTHER, isTerminal: false },

    // HM Review - candidates submitted to HM for review
    { stage: CanonicalStage.HM_SCREEN, bucket: HMDecisionBucket.HM_REVIEW, isTerminal: false },

    // Interview decision - candidates approved for interviews
    { stage: CanonicalStage.ONSITE, bucket: HMDecisionBucket.HM_INTERVIEW_DECISION, isTerminal: false },

    // Feedback/Final decision - post-interview
    { stage: CanonicalStage.FINAL, bucket: HMDecisionBucket.HM_FINAL_DECISION, isTerminal: false },

    // Offer decision
    { stage: CanonicalStage.OFFER, bucket: HMDecisionBucket.OFFER_DECISION, isTerminal: false },

    // Terminal states
    { stage: CanonicalStage.HIRED, bucket: HMDecisionBucket.DONE, isTerminal: true },
    { stage: CanonicalStage.REJECTED, bucket: HMDecisionBucket.DONE, isTerminal: true },
    { stage: CanonicalStage.WITHDREW, bucket: HMDecisionBucket.DONE, isTerminal: true }
];

/**
 * Get the HM decision bucket for a canonical stage
 */
export function getBucketForStage(canonicalStage: CanonicalStage | string | null): HMDecisionBucket {
    if (!canonicalStage) return HMDecisionBucket.OTHER;

    const mapping = STAGE_TO_BUCKET_MAP.find(m => m.stage === canonicalStage);
    return mapping?.bucket ?? HMDecisionBucket.OTHER;
}

/**
 * Check if a stage is terminal (hired, rejected, withdrew)
 */
export function isTerminalStage(canonicalStage: CanonicalStage | string | null): boolean {
    if (!canonicalStage) return false;

    const mapping = STAGE_TO_BUCKET_MAP.find(m => m.stage === canonicalStage);
    return mapping?.isTerminal ?? false;
}

/**
 * Get stages that belong to a specific bucket
 */
export function getStagesForBucket(bucket: HMDecisionBucket): string[] {
    return STAGE_TO_BUCKET_MAP
        .filter(m => m.bucket === bucket)
        .map(m => m.stage);
}

/**
 * HM decision bucket metadata for UI display
 */
export const BUCKET_METADATA: Record<HMDecisionBucket, {
    label: string;
    shortLabel: string;
    description: string;
    color: string;
    order: number;
}> = {
    [HMDecisionBucket.OTHER]: {
        label: 'Pre-HM Stages',
        shortLabel: 'Early',
        description: 'Candidates not yet submitted to hiring manager',
        color: '#6c757d',
        order: 0
    },
    [HMDecisionBucket.HM_REVIEW]: {
        label: 'HM Review',
        shortLabel: 'Review',
        description: 'Candidates awaiting hiring manager review',
        color: '#0d6efd',
        order: 1
    },
    [HMDecisionBucket.HM_INTERVIEW_DECISION]: {
        label: 'Interview Decision',
        shortLabel: 'Interview',
        description: 'Candidates in interview process',
        color: '#6610f2',
        order: 2
    },
    [HMDecisionBucket.HM_FEEDBACK]: {
        label: 'Feedback Due',
        shortLabel: 'Feedback',
        description: 'Interviews completed, awaiting feedback',
        color: '#fd7e14',
        order: 3
    },
    [HMDecisionBucket.HM_FINAL_DECISION]: {
        label: 'Final Decision',
        shortLabel: 'Decision',
        description: 'Final round complete, decision pending',
        color: '#dc3545',
        order: 4
    },
    [HMDecisionBucket.OFFER_DECISION]: {
        label: 'Offer Stage',
        shortLabel: 'Offer',
        description: 'Offer extended or pending acceptance',
        color: '#198754',
        order: 5
    },
    [HMDecisionBucket.DONE]: {
        label: 'Complete',
        shortLabel: 'Done',
        description: 'Hired, rejected, or withdrew',
        color: '#20c997',
        order: 6
    }
};

/**
 * Get bucket display order (for sorting)
 */
export function getBucketOrder(bucket: HMDecisionBucket): number {
    return BUCKET_METADATA[bucket]?.order ?? 99;
}

/**
 * Get ordered list of buckets for funnel display
 */
export function getOrderedBuckets(): HMDecisionBucket[] {
    return Object.entries(BUCKET_METADATA)
        .sort(([, a], [, b]) => a.order - b.order)
        .map(([bucket]) => bucket as HMDecisionBucket)
        .filter(bucket => bucket !== HMDecisionBucket.OTHER && bucket !== HMDecisionBucket.DONE);
}

/**
 * Stage order for determining "furthest progressed" candidate
 * Higher number = further in process
 */
export const CANONICAL_STAGE_ORDER: Record<string, number> = {
    [CanonicalStage.LEAD]: 0,
    [CanonicalStage.APPLIED]: 1,
    [CanonicalStage.SCREEN]: 2,
    [CanonicalStage.HM_SCREEN]: 3,
    [CanonicalStage.ONSITE]: 4,
    [CanonicalStage.FINAL]: 5,
    [CanonicalStage.OFFER]: 6,
    [CanonicalStage.HIRED]: 7,
    [CanonicalStage.REJECTED]: -1,  // Terminal states don't count for "furthest"
    [CanonicalStage.WITHDREW]: -1
};

/**
 * Get stage order (for determining furthest progressed candidate)
 */
export function getStageOrder(stage: string | null): number {
    if (!stage) return -1;
    return CANONICAL_STAGE_ORDER[stage] ?? -1;
}
