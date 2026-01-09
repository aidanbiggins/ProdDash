// HM Fact Tables Builder
// Builds enriched fact tables from raw data for HM analytics

import { differenceInDays } from 'date-fns';
import { Requisition, Candidate, Event, User, CanonicalStage } from '../types/entities';
import {
    HMFactTables,
    ReqFact,
    CandidateFact,
    EventFact,
    HMDecisionBucket
} from '../types/hmTypes';
import { getBucketForStage, isTerminalStage } from '../config/hmStageTaxonomy';
import { StageMappingConfig } from '../types/config';
import { normalizeStage } from './stageNormalization';

/**
 * Build all HM fact tables from raw data.
 * These are the foundation for all HM metrics calculations.
 */
export function buildHMFactTables(
    requisitions: Requisition[],
    candidates: Candidate[],
    events: Event[],
    users: User[],
    stageMappingConfig: StageMappingConfig,
    asOfDate: Date = new Date()
): HMFactTables {
    // Build lookup maps
    const userMap = new Map(users.map(u => [u.user_id, u]));
    const reqMap = new Map(requisitions.map(r => [r.req_id, r]));

    // Build req facts
    const reqFacts = buildReqFacts(requisitions, userMap, asOfDate);
    const reqFactMap = new Map(reqFacts.map(r => [r.req_id, r]));

    // Build candidate facts
    const candidateFacts = buildCandidateFacts(
        candidates,
        events,
        reqFactMap,
        userMap,
        stageMappingConfig,
        asOfDate
    );

    // Build event facts
    const eventFacts = buildEventFacts(
        events,
        candidates,
        reqFactMap,
        userMap,
        stageMappingConfig
    );

    return {
        reqFacts,
        candidateFacts,
        eventFacts,
        asOfDate
    };
}

/**
 * Build enriched requisition facts
 */
function buildReqFacts(
    requisitions: Requisition[],
    userMap: Map<string, User>,
    asOfDate: Date
): ReqFact[] {
    return requisitions.map(req => {
        const isOpen = !req.closed_at && req.status === 'Open';
        const reqAgeDays = isOpen
            ? differenceInDays(asOfDate, req.opened_at)
            : (req.closed_at
                ? differenceInDays(req.closed_at, req.opened_at)
                : 0);

        const hm = userMap.get(req.hiring_manager_id ?? '');
        const recruiter = userMap.get(req.recruiter_id);

        return {
            ...req,
            isOpen,
            reqAgeDays,
            hmName: hm?.name ?? 'Unknown',
            recruiterName: recruiter?.name ?? 'Unknown'
        } as ReqFact;
    });
}

/**
 * Build enriched candidate facts with stage and bucket info
 */
function buildCandidateFacts(
    candidates: Candidate[],
    events: Event[],
    reqFactMap: Map<string, ReqFact>,
    userMap: Map<string, User>,
    stageMappingConfig: StageMappingConfig,
    asOfDate: Date
): CandidateFact[] {
    // Build a map of candidate stage entry times from events
    const stageEntryMap = buildStageEntryMap(events);

    return candidates.map(cand => {
        const req = reqFactMap.get(cand.req_id);

        // Normalize the stage
        const canonicalStage = cand.current_stage
            ? normalizeStage(cand.current_stage, stageMappingConfig)
            : null;

        // Get decision bucket
        const decisionBucket = getBucketForStage(canonicalStage);

        // Determine if candidate is active
        const isActive = determineIfActive(cand, canonicalStage);

        // Get when candidate entered current stage
        const stageEntryKey = `${cand.candidate_id}:${cand.current_stage}`;
        const currentStageEnteredAt = stageEntryMap.get(stageEntryKey) ?? null;

        // Calculate stage age
        const stageAgeDays = currentStageEnteredAt
            ? differenceInDays(asOfDate, currentStageEnteredAt)
            : 0;

        return {
            ...cand,
            reqTitle: req?.req_title ?? 'Unknown Req',
            hmUserId: req?.hiring_manager_id ?? '',
            hmName: req?.hmName ?? 'Unknown',
            recruiterId: req?.recruiter_id ?? '',
            recruiterName: req?.recruiterName ?? 'Unknown',
            canonicalStage: canonicalStage,
            decisionBucket,
            currentStageEnteredAt,
            stageAgeDays,
            isActive
        } as CandidateFact;
    });
}

/**
 * Build a map of when candidates entered each stage
 * Key: "candidateId:stageName" -> Date
 */
function buildStageEntryMap(events: Event[]): Map<string, Date> {
    const entryMap = new Map<string, Date>();

    // Sort events by timestamp
    const sortedEvents = [...events]
        .filter(e => e.event_type === 'STAGE_CHANGE' && e.to_stage)
        .sort((a, b) => a.event_at.getTime() - b.event_at.getTime());

    for (const event of sortedEvents) {
        if (event.to_stage && event.candidate_id) {
            const key = `${event.candidate_id}:${event.to_stage}`;
            // Use the most recent entry into this stage
            entryMap.set(key, event.event_at);
        }
    }

    return entryMap;
}

/**
 * Determine if a candidate is still active in the pipeline
 */
function determineIfActive(
    candidate: Candidate,
    canonicalStage: CanonicalStage | string | null
): boolean {
    // Check disposition first
    if (candidate.disposition) {
        const disposition = candidate.disposition.toLowerCase();
        if (['rejected', 'withdrawn', 'hired'].includes(disposition)) {
            return false;
        }
    }

    // Check if in terminal stage
    if (isTerminalStage(canonicalStage)) {
        return false;
    }

    // Default to active
    return true;
}

/**
 * Build enriched event facts
 */
function buildEventFacts(
    events: Event[],
    candidates: Candidate[],
    reqFactMap: Map<string, ReqFact>,
    userMap: Map<string, User>,
    stageMappingConfig: StageMappingConfig
): EventFact[] {
    const candidateMap = new Map(candidates.map(c => [c.candidate_id, c]));

    return events.map(event => {
        const req = reqFactMap.get(event.req_id);
        const candidate = candidateMap.get(event.candidate_id ?? '');
        const actor = userMap.get(event.actor_user_id ?? '');

        // Normalize stages to buckets
        const fromCanonical = event.from_stage
            ? normalizeStage(event.from_stage, stageMappingConfig)
            : null;
        const toCanonical = event.to_stage
            ? normalizeStage(event.to_stage, stageMappingConfig)
            : null;

        return {
            ...event,
            reqTitle: req?.req_title ?? 'Unknown Req',
            candidateName: candidate?.candidate_id ?? 'Unknown Candidate',
            actorName: actor?.name ?? 'Unknown',
            hmUserId: req?.hiring_manager_id ?? '',
            fromBucket: fromCanonical ? getBucketForStage(fromCanonical) : null,
            toBucket: toCanonical ? getBucketForStage(toCanonical) : null
        } as EventFact;
    });
}

/**
 * Get the last movement date for a requisition
 * Movement = stage_change, interview_completed, offer_extended, offer_accepted
 */
export function getLastMovementDate(
    reqId: string,
    eventFacts: EventFact[]
): Date | null {
    const movementTypes = [
        'STAGE_CHANGE',
        'INTERVIEW_COMPLETED',
        'OFFER_EXTENDED',
        'OFFER_ACCEPTED'
    ];

    const movementEvents = eventFacts
        .filter(e => e.req_id === reqId && movementTypes.includes(e.event_type))
        .sort((a, b) => b.event_at.getTime() - a.event_at.getTime());

    return movementEvents.length > 0 ? movementEvents[0].event_at : null;
}

/**
 * Get active candidates for a requisition by bucket
 */
export function getCandidatesByBucket(
    reqId: string,
    candidateFacts: CandidateFact[]
): Record<HMDecisionBucket, CandidateFact[]> {
    const result: Record<HMDecisionBucket, CandidateFact[]> = {
        [HMDecisionBucket.OTHER]: [],
        [HMDecisionBucket.HM_REVIEW]: [],
        [HMDecisionBucket.HM_INTERVIEW_DECISION]: [],
        [HMDecisionBucket.HM_FEEDBACK]: [],
        [HMDecisionBucket.HM_FINAL_DECISION]: [],
        [HMDecisionBucket.OFFER_DECISION]: [],
        [HMDecisionBucket.DONE]: []
    };

    for (const cand of candidateFacts) {
        if (cand.req_id === reqId && cand.isActive) {
            result[cand.decisionBucket].push(cand);
        }
    }

    return result;
}

/**
 * Get the furthest progressed active candidate for a req
 */
export function getFurthestProgressedBucket(
    reqId: string,
    candidateFacts: CandidateFact[]
): HMDecisionBucket {
    const bucketOrder = [
        HMDecisionBucket.OFFER_DECISION,
        HMDecisionBucket.HM_FINAL_DECISION,
        HMDecisionBucket.HM_FEEDBACK,
        HMDecisionBucket.HM_INTERVIEW_DECISION,
        HMDecisionBucket.HM_REVIEW,
        HMDecisionBucket.OTHER
    ];

    const activeCandidates = candidateFacts.filter(
        c => c.req_id === reqId && c.isActive
    );

    for (const bucket of bucketOrder) {
        if (activeCandidates.some(c => c.decisionBucket === bucket)) {
            return bucket;
        }
    }

    return HMDecisionBucket.OTHER;
}

/**
 * Get all unique HM user IDs from reqs
 */
export function getUniqueHMs(reqFacts: ReqFact[]): string[] {
    const hmIds = new Set<string>();
    for (const req of reqFacts) {
        if (req.hiring_manager_id) {
            hmIds.add(req.hiring_manager_id);
        }
    }
    return Array.from(hmIds);
}
