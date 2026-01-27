// Event Generation Service
// Generates events from existing candidate data
// Uses REAL stage timestamps from iCIMS when available, falls back to synthetic generation
//
// Event types generated for HM Friction metrics:
// - STAGE_CHANGE events for pipeline progression
// - INTERVIEW_COMPLETED events at interview stages
// - FEEDBACK_SUBMITTED events after interviews
// - OFFER_EXTENDED, OFFER_ACCEPTED events

import { Candidate, Event, EventType, CanonicalStage, CandidateDisposition, Requisition, StageTimestamps } from '../types';

// Generate a valid UUID v4 (avoids uuid dependency)
function generateId(): string {
  // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
  const hex = '0123456789abcdef';
  let uuid = '';

  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) {
      uuid += '-';
    } else if (i === 14) {
      uuid += '4'; // Version 4
    } else if (i === 19) {
      uuid += hex[(Math.random() * 4) | 8]; // Variant bits (8, 9, a, or b)
    } else {
      uuid += hex[(Math.random() * 16) | 0];
    }
  }

  return uuid;
}

// Stage order for progression inference
const STAGE_ORDER = [
  CanonicalStage.APPLIED,
  CanonicalStage.SCREEN,
  CanonicalStage.HM_SCREEN,
  CanonicalStage.ONSITE,
  CanonicalStage.FINAL,
  CanonicalStage.OFFER,
  CanonicalStage.HIRED
];

// Stages that involve interviews (trigger INTERVIEW_COMPLETED events)
const INTERVIEW_STAGES = [
  CanonicalStage.SCREEN,
  CanonicalStage.HM_SCREEN,
  CanonicalStage.ONSITE,
  CanonicalStage.FINAL
];

export interface EventGenerationProgress {
  processed: number;
  total: number;
  eventsGenerated: number;
  currentCandidate?: string;
}

export interface EventGenerationResult {
  events: Event[];
  stats: {
    candidatesProcessed: number;
    eventsGenerated: number;
    appliedEvents: number;
    stageChangeEvents: number;
    interviewCompletedEvents: number;
    feedbackSubmittedEvents: number;
    offerEvents: number;
    hiredEvents: number;
    skippedCandidates: number;  // STRICT: candidates skipped due to missing timestamp data
  };
}

/**
 * Generate synthetic events from candidate milestone timestamps.
 *
 * This creates a comprehensive event history needed for HM Friction metrics:
 * - Full stage progression (APPLIED → SCREEN → HM_SCREEN → etc.)
 * - INTERVIEW_COMPLETED events at interview stages
 * - FEEDBACK_SUBMITTED events (with realistic latency variance per HM)
 * - OFFER_EXTENDED and OFFER_ACCEPTED events
 *
 * @param candidates - Array of candidates to generate events for
 * @param requisitions - Array of requisitions (needed for HM attribution)
 * @param onProgress - Optional callback for progress updates
 */
export async function generateEventsFromCandidates(
  candidates: Candidate[],
  requisitions?: Requisition[],
  onProgress?: (progress: EventGenerationProgress) => void
): Promise<EventGenerationResult> {
  const events: Event[] = [];
  const stats = {
    candidatesProcessed: 0,
    eventsGenerated: 0,
    appliedEvents: 0,
    stageChangeEvents: 0,
    interviewCompletedEvents: 0,
    feedbackSubmittedEvents: 0,
    offerEvents: 0,
    hiredEvents: 0,
    skippedCandidates: 0  // STRICT: candidates skipped due to missing timestamp data
  };

  // Build a map of req_id to hiring_manager_id for HM attribution
  const reqToHM = new Map<string, string>();
  if (requisitions) {
    for (const req of requisitions) {
      if (req.hiring_manager_id) {
        reqToHM.set(req.req_id, req.hiring_manager_id);
      }
    }
  }

  // Create per-HM latency profiles (to create variance between HMs)
  // This gives each HM a consistent "personality" for feedback speed
  const hmLatencyProfiles = new Map<string, { feedbackHours: number; decisionHours: number }>();

  const total = candidates.length;
  const progressInterval = Math.max(100, Math.floor(total / 100)); // Report every ~1%

  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    const candidateEvents: Event[] = [];
    const hmId = reqToHM.get(candidate.req_id) || 'unknown-hm';

    // Get or create HM latency profile
    if (!hmLatencyProfiles.has(hmId)) {
      // Random but consistent latency profile per HM
      // Base: 12-72 hours for feedback, 24-120 hours for decisions
      const hash = simpleHash(hmId);
      hmLatencyProfiles.set(hmId, {
        feedbackHours: 12 + (hash % 60),          // 12-72 hours
        decisionHours: 24 + ((hash * 2) % 96)     // 24-120 hours
      });
    }
    const hmProfile = hmLatencyProfiles.get(hmId)!;

    // Check if we have REAL stage timestamps from iCIMS
    const hasRealTimestamps = candidate.stage_timestamps &&
      (candidate.stage_timestamps.screen_at ||
       candidate.stage_timestamps.hm_screen_at ||
       candidate.stage_timestamps.onsite_at ||
       candidate.stage_timestamps.final_at ||
       (candidate.stage_timestamps.interviews && candidate.stage_timestamps.interviews.length > 0));

    // Build timeline of stage dates - either from real data or synthesized
    const stageTimeline: Array<{ stage: CanonicalStage; date: Date }> = [];

    if (hasRealTimestamps && candidate.stage_timestamps) {
      // USE REAL TIMESTAMPS from iCIMS
      const st = candidate.stage_timestamps;

      // Add applied
      if (candidate.applied_at) {
        stageTimeline.push({ stage: CanonicalStage.APPLIED, date: candidate.applied_at });
      }

      // Add known stage timestamps
      if (st.screen_at) stageTimeline.push({ stage: CanonicalStage.SCREEN, date: st.screen_at });
      if (st.hm_screen_at) stageTimeline.push({ stage: CanonicalStage.HM_SCREEN, date: st.hm_screen_at });
      if (st.onsite_at) stageTimeline.push({ stage: CanonicalStage.ONSITE, date: st.onsite_at });
      if (st.final_at) stageTimeline.push({ stage: CanonicalStage.FINAL, date: st.final_at });
      if (st.offer_at) stageTimeline.push({ stage: CanonicalStage.OFFER, date: st.offer_at });

      // Sort by date
      stageTimeline.sort((a, b) => a.date.getTime() - b.date.getTime());
    } else {
      // SYNTHESIZE timeline (fallback for candidates without stage_timestamps)
      // STRICT TIMESTAMP POLICY: Only synthesize if we have at least one real anchor date
      const startDate = candidate.applied_at || candidate.current_stage_entered_at;
      const endDate = candidate.current_stage_entered_at || candidate.hired_at;

      // If no real dates exist, skip synthesis entirely - don't fabricate
      if (!startDate) {
        // No anchor date available, cannot synthesize events without fabricating
        stats.skippedCandidates = (stats.skippedCandidates || 0) + 1;
        continue;
      }

      const currentStageIndex = STAGE_ORDER.indexOf(candidate.current_stage as CanonicalStage);
      const targetStageIndex = currentStageIndex >= 0 ? currentStageIndex : 0;

      const effectiveEndDate = endDate || startDate;  // Use startDate as fallback
      const totalMs = Math.max(effectiveEndDate.getTime() - startDate.getTime(), 24 * 60 * 60 * 1000); // Min 1 day

      // Weighted stage durations
      const STAGE_WEIGHTS: Record<CanonicalStage, number> = {
        [CanonicalStage.APPLIED]: 0.05, [CanonicalStage.SCREEN]: 0.15,
        [CanonicalStage.HM_SCREEN]: 0.20, [CanonicalStage.ONSITE]: 0.30,
        [CanonicalStage.FINAL]: 0.15, [CanonicalStage.OFFER]: 0.10,
        [CanonicalStage.HIRED]: 0.05, [CanonicalStage.LEAD]: 0.05,
        [CanonicalStage.REJECTED]: 0, [CanonicalStage.WITHDREW]: 0
      };

      let totalWeight = 0;
      for (let i = 0; i <= targetStageIndex; i++) {
        totalWeight += STAGE_WEIGHTS[STAGE_ORDER[i]] || 0.1;
      }

      const candidateHash = simpleHash(candidate.candidate_id);
      let currentTime = startDate.getTime();

      for (let i = 0; i <= targetStageIndex; i++) {
        const stage = STAGE_ORDER[i];
        stageTimeline.push({ stage, date: new Date(currentTime) });

        const weight = STAGE_WEIGHTS[stage] || 0.1;
        const variance = 0.8 + ((candidateHash + i * 17) % 40) / 100;
        currentTime += (totalMs * weight / totalWeight) * variance;
      }
    }

    // Generate events from timeline
    let previousStage: CanonicalStage | null = null;

    for (let i = 0; i < stageTimeline.length; i++) {
      const { stage, date } = stageTimeline[i];
      const nextEntry = stageTimeline[i + 1];
      const stageEndTime = nextEntry ? nextEntry.date.getTime() : (candidate.current_stage_entered_at?.getTime() || date.getTime() + 24 * 60 * 60 * 1000);
      const stageDurationMs = stageEndTime - date.getTime();

      // 1. STAGE_CHANGE event
      candidateEvents.push(createEvent({
        candidateId: candidate.candidate_id,
        reqId: candidate.req_id,
        eventType: EventType.STAGE_CHANGE,
        fromStage: previousStage,
        toStage: stage,
        eventAt: date
      }));
      stats.stageChangeEvents++;
      if (stage === CanonicalStage.APPLIED) stats.appliedEvents++;

      // 2. For interview stages, generate INTERVIEW_COMPLETED and FEEDBACK_SUBMITTED
      if (INTERVIEW_STAGES.includes(stage) && nextEntry) {
        // Interview completed partway through the stage
        const candidateHash = simpleHash(candidate.candidate_id);
        const interviewOffset = 0.2 + ((candidateHash + i) % 20) / 100;
        const interviewTime = new Date(date.getTime() + stageDurationMs * interviewOffset);

        candidateEvents.push(createEvent({
          candidateId: candidate.candidate_id,
          reqId: candidate.req_id,
          eventType: EventType.INTERVIEW_COMPLETED,
          toStage: stage,
          eventAt: interviewTime
        }));
        stats.interviewCompletedEvents++;

        // Feedback submitted after interview
        const feedbackVariance = 0.7 + Math.random() * 0.6;
        const feedbackDelayMs = hmProfile.feedbackHours * feedbackVariance * 60 * 60 * 1000;
        const feedbackTime = new Date(interviewTime.getTime() + feedbackDelayMs);

        if (feedbackTime.getTime() < stageEndTime) {
          candidateEvents.push(createEvent({
            candidateId: candidate.candidate_id,
            reqId: candidate.req_id,
            eventType: EventType.FEEDBACK_SUBMITTED,
            toStage: stage,
            eventAt: feedbackTime,
            actorUserId: hmId
          }));
          stats.feedbackSubmittedEvents++;
        }
      }

      previousStage = stage;
    }

    // 3. OFFER_EXTENDED event
    if (candidate.offer_extended_at) {
      candidateEvents.push(createEvent({
        candidateId: candidate.candidate_id,
        reqId: candidate.req_id,
        eventType: EventType.OFFER_EXTENDED,
        toStage: CanonicalStage.OFFER,
        eventAt: candidate.offer_extended_at
      }));
      stats.offerEvents++;
    } else if (candidate.disposition === CandidateDisposition.Hired && candidate.hired_at) {
      // Infer offer extended ~7 days before hire
      const offerDate = new Date(candidate.hired_at.getTime() - 7 * 24 * 60 * 60 * 1000);
      candidateEvents.push(createEvent({
        candidateId: candidate.candidate_id,
        reqId: candidate.req_id,
        eventType: EventType.OFFER_EXTENDED,
        toStage: CanonicalStage.OFFER,
        eventAt: offerDate
      }));
      stats.offerEvents++;
    }

    // 4. OFFER_ACCEPTED event
    if (candidate.offer_accepted_at) {
      candidateEvents.push(createEvent({
        candidateId: candidate.candidate_id,
        reqId: candidate.req_id,
        eventType: EventType.OFFER_ACCEPTED,
        toStage: CanonicalStage.OFFER,
        eventAt: candidate.offer_accepted_at
      }));
    } else if (candidate.disposition === CandidateDisposition.Hired && candidate.hired_at) {
      // Infer offer accepted ~3 days before hire
      const acceptDate = new Date(candidate.hired_at.getTime() - 3 * 24 * 60 * 60 * 1000);
      candidateEvents.push(createEvent({
        candidateId: candidate.candidate_id,
        reqId: candidate.req_id,
        eventType: EventType.OFFER_ACCEPTED,
        toStage: CanonicalStage.OFFER,
        eventAt: acceptDate
      }));
    }

    // 5. HIRED event
    if (candidate.hired_at && candidate.disposition === CandidateDisposition.Hired) {
      candidateEvents.push(createEvent({
        candidateId: candidate.candidate_id,
        reqId: candidate.req_id,
        eventType: EventType.STAGE_CHANGE,
        fromStage: CanonicalStage.OFFER,
        toStage: CanonicalStage.HIRED,
        eventAt: candidate.hired_at
      }));
      stats.hiredEvents++;
    }

    // 6. Handle rejected candidates - different events depending on stage
    if (candidate.disposition === CandidateDisposition.Rejected && !candidate.hired_at) {
      const rejectionDate = candidate.current_stage_entered_at || new Date();
      const lastStage = stageTimeline.length > 0
        ? stageTimeline[stageTimeline.length - 1].stage
        : CanonicalStage.APPLIED;

      // Check if they were rejected after offer (OFFER_DECLINED)
      const wasInOffer = lastStage === CanonicalStage.OFFER ||
        candidate.offer_extended_at !== null;

      if (wasInOffer) {
        // Offer was declined
        candidateEvents.push(createEvent({
          candidateId: candidate.candidate_id,
          reqId: candidate.req_id,
          eventType: EventType.OFFER_DECLINED,
          fromStage: CanonicalStage.OFFER,
          toStage: CanonicalStage.REJECTED,
          eventAt: rejectionDate
        }));
      } else {
        // Regular rejection - create STAGE_CHANGE with proper from_stage
        candidateEvents.push(createEvent({
          candidateId: candidate.candidate_id,
          reqId: candidate.req_id,
          eventType: EventType.STAGE_CHANGE,
          fromStage: lastStage,
          toStage: CanonicalStage.REJECTED,
          eventAt: rejectionDate
        }));
      }
    }

    // 7. Handle withdrawn candidates - use CANDIDATE_WITHDREW event type
    if (candidate.disposition === CandidateDisposition.Withdrawn) {
      const withdrawnDate = candidate.current_stage_entered_at || new Date();
      const lastStage = stageTimeline.length > 0
        ? stageTimeline[stageTimeline.length - 1].stage
        : CanonicalStage.APPLIED;

      candidateEvents.push(createEvent({
        candidateId: candidate.candidate_id,
        reqId: candidate.req_id,
        eventType: EventType.CANDIDATE_WITHDREW,
        fromStage: lastStage,
        toStage: CanonicalStage.WITHDREW,
        eventAt: withdrawnDate
      }));
    }

    // Sort events by date and add to main array
    candidateEvents.sort((a, b) =>
      new Date(a.event_at).getTime() - new Date(b.event_at).getTime()
    );
    events.push(...candidateEvents);
    stats.eventsGenerated += candidateEvents.length;
    stats.candidatesProcessed++;

    // Report progress
    if (onProgress && (i % progressInterval === 0 || i === candidates.length - 1)) {
      onProgress({
        processed: i + 1,
        total,
        eventsGenerated: stats.eventsGenerated,
        currentCandidate: candidate.name || candidate.candidate_id
      });
      // Yield to allow UI updates
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }

  return { events, stats };
}

/**
 * Simple hash function to create consistent "random" values per HM
 */
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Create a synthetic event
 */
function createEvent(params: {
  candidateId: string;
  reqId: string;
  eventType: EventType;
  fromStage?: string | null;
  toStage: string;
  eventAt: Date;
  actorUserId?: string;
}): Event {
  return {
    event_id: generateId(),
    candidate_id: params.candidateId,
    req_id: params.reqId,
    event_type: params.eventType,
    from_stage: params.fromStage || null,
    to_stage: params.toStage,
    event_at: params.eventAt,
    actor_user_id: params.actorUserId || '',
    metadata_json: JSON.stringify({ synthetic: true, generated_at: new Date().toISOString() })
  };
}

/**
 * Check if event generation is needed
 * Returns true if there are candidates but few/no events
 */
export function isEventGenerationNeeded(
  candidateCount: number,
  eventCount: number
): boolean {
  if (candidateCount === 0) return false;
  // If we have less than 1 event per candidate on average, generation is needed
  return eventCount < candidateCount;
}
