// Snapshot Diff Service - Diff algorithm for generating events from snapshots
// See docs/plans/SNAPSHOT_DIFF_EVENT_STREAM_V1.md for full specification

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { CanonicalStage, CandidateDisposition, RequisitionStatus } from '../types/entities';
import {
  DataSnapshot,
  SnapshotCandidate,
  SnapshotRequisition,
  SnapshotEvent,
  SnapshotEventType,
  EventConfidence,
  DiffResult,
  StageChangeEvent,
  StageRegressionEvent,
  DispositionChangeEvent,
  ReqStatusChangeEvent,
  CandidateAppearedEvent,
  CandidateDisappearedEvent,
  ReqAppearedEvent,
  ReqDisappearedEvent,
  SNAPSHOT_STAGE_ORDER,
  SNAPSHOT_TERMINAL_STAGES,
  SNAPSHOT_LIMITS
} from '../types/snapshotTypes';
import {
  getSnapshot,
  getPreviousSnapshot,
  getSnapshotCandidates,
  getSnapshotRequisitions,
  updateSnapshotStatus
} from './snapshotService';

// Get Supabase client (lazy initialization)
let supabase: SupabaseClient | null = null;

function getSupabase(): SupabaseClient | null {
  if (supabase) return supabase;

  const url = process.env.REACT_APP_SUPABASE_URL;
  const key = process.env.REACT_APP_SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.warn('[SnapshotDiffService] Supabase not configured');
    return null;
  }

  supabase = createClient(url, key);
  return supabase;
}

// ============================================
// STAGE REGRESSION DETECTION
// ============================================

/**
 * Determine if moving from one stage to another is a regression.
 * A regression is moving backward in the funnel (not to a terminal stage).
 */
export function isStageRegression(from: string | null, to: string | null): boolean {
  if (!from || !to) return false;

  // Moving to terminal stage is not a regression
  if (SNAPSHOT_TERMINAL_STAGES.has(to as CanonicalStage)) return false;

  // Moving from terminal back to funnel is a regression (reactivation)
  if (SNAPSHOT_TERMINAL_STAGES.has(from as CanonicalStage) && !SNAPSHOT_TERMINAL_STAGES.has(to as CanonicalStage)) {
    return true;
  }

  const fromIndex = SNAPSHOT_STAGE_ORDER.indexOf(from as CanonicalStage);
  const toIndex = SNAPSHOT_STAGE_ORDER.indexOf(to as CanonicalStage);

  // If either stage is unknown, can't determine regression
  if (fromIndex === -1 || toIndex === -1) return false;

  // Regression if moving to earlier stage
  return toIndex < fromIndex;
}

// ============================================
// EVENT TIME INFERENCE
// ============================================

interface InferredEventTime {
  event_at: Date;
  confidence: EventConfidence;
  confidence_reasons: string[];
}

/**
 * Infer the event time using the best available data.
 */
export function inferEventTime(
  prevCand: SnapshotCandidate | null,
  currCand: SnapshotCandidate,
  prevSnapshot: DataSnapshot | null,
  currSnapshot: DataSnapshot
): InferredEventTime {
  // BEST: current_stage_entered_at changed and is populated
  if (currCand.current_stage_entered_at) {
    const prevEnteredAt = prevCand?.current_stage_entered_at?.getTime();
    const currEnteredAt = currCand.current_stage_entered_at.getTime();

    if (!prevEnteredAt || prevEnteredAt !== currEnteredAt) {
      return {
        event_at: currCand.current_stage_entered_at,
        confidence: 'high',
        confidence_reasons: ['Timestamp from current_stage_entered_at']
      };
    }
  }

  // GOOD: Terminal timestamp matches the change
  if (currCand.disposition === CandidateDisposition.Hired && currCand.hired_at) {
    return {
      event_at: currCand.hired_at,
      confidence: 'high',
      confidence_reasons: ['Timestamp from hired_at']
    };
  }
  if (currCand.disposition === CandidateDisposition.Rejected && currCand.rejected_at) {
    return {
      event_at: currCand.rejected_at,
      confidence: 'high',
      confidence_reasons: ['Timestamp from rejected_at']
    };
  }
  if (currCand.disposition === CandidateDisposition.Withdrawn && currCand.withdrawn_at) {
    return {
      event_at: currCand.withdrawn_at,
      confidence: 'high',
      confidence_reasons: ['Timestamp from withdrawn_at']
    };
  }

  // FALLBACK: Midpoint between snapshots or current snapshot date
  if (prevSnapshot) {
    const midpoint = new Date(
      (prevSnapshot.snapshot_date.getTime() + currSnapshot.snapshot_date.getTime()) / 2
    );
    return {
      event_at: midpoint,
      confidence: 'inferred',
      confidence_reasons: ['Midpoint between snapshot dates']
    };
  }

  // First snapshot - use snapshot date
  return {
    event_at: currSnapshot.snapshot_date,
    confidence: 'inferred',
    confidence_reasons: ['First snapshot date']
  };
}

/**
 * Infer event time for requisition changes.
 */
export function inferReqEventTime(
  prevReq: SnapshotRequisition | null,
  currReq: SnapshotRequisition,
  prevSnapshot: DataSnapshot | null,
  currSnapshot: DataSnapshot
): InferredEventTime {
  // Check if closed_at timestamp is available for status changes to Closed
  if (currReq.status === RequisitionStatus.Closed && currReq.closed_at) {
    return {
      event_at: currReq.closed_at,
      confidence: 'high',
      confidence_reasons: ['Timestamp from closed_at']
    };
  }

  // Check if opened_at timestamp is available for new reqs
  if (!prevReq && currReq.opened_at) {
    return {
      event_at: currReq.opened_at,
      confidence: 'high',
      confidence_reasons: ['Timestamp from opened_at']
    };
  }

  // FALLBACK: Midpoint between snapshots
  if (prevSnapshot) {
    const midpoint = new Date(
      (prevSnapshot.snapshot_date.getTime() + currSnapshot.snapshot_date.getTime()) / 2
    );
    return {
      event_at: midpoint,
      confidence: 'inferred',
      confidence_reasons: ['Midpoint between snapshot dates']
    };
  }

  return {
    event_at: currSnapshot.snapshot_date,
    confidence: 'inferred',
    confidence_reasons: ['First snapshot date']
  };
}

// ============================================
// DIFF ALGORITHM
// ============================================

/**
 * Diff two snapshots and return the detected changes.
 * If prevSnapshot is null, this is the first snapshot (only appeared events).
 */
export function diffSnapshots(
  prevCandidates: SnapshotCandidate[],
  currCandidates: SnapshotCandidate[],
  prevRequisitions: SnapshotRequisition[],
  currRequisitions: SnapshotRequisition[],
  prevSnapshot: DataSnapshot | null,
  currSnapshot: DataSnapshot
): DiffResult {
  const result: DiffResult = {
    stageChanges: [],
    stageRegressions: [],
    dispositionChanges: [],
    reqStatusChanges: [],
    candidatesAppeared: [],
    candidatesDisappeared: [],
    reqsAppeared: [],
    reqsDisappeared: []
  };

  // Build lookup maps for candidates
  const prevCandMap = new Map<string, SnapshotCandidate>();
  for (const c of prevCandidates) {
    prevCandMap.set(`${c.candidate_id}:${c.req_id}`, c);
  }

  const currCandMap = new Map<string, SnapshotCandidate>();
  for (const c of currCandidates) {
    currCandMap.set(`${c.candidate_id}:${c.req_id}`, c);
  }

  // Detect changes for current candidates
  for (const [key, currCand] of currCandMap) {
    const prevCand = prevCandMap.get(key);

    if (!prevCand) {
      // New candidate appeared
      const eventTime = inferEventTime(null, currCand, prevSnapshot, currSnapshot);
      result.candidatesAppeared.push({
        candidate_id: currCand.candidate_id,
        req_id: currCand.req_id,
        current_stage: currCand.current_stage,
        canonical_stage: currCand.canonical_stage,
        disposition: currCand.disposition,
        event_at: eventTime.event_at
      });
      continue;
    }

    // Stage change detection
    const prevCanonical = prevCand.canonical_stage;
    const currCanonical = currCand.canonical_stage;

    if (prevCanonical !== currCanonical) {
      const regression = isStageRegression(prevCanonical, currCanonical);
      const eventTime = inferEventTime(prevCand, currCand, prevSnapshot, currSnapshot);

      const stageEvent: StageChangeEvent = {
        candidate_id: currCand.candidate_id,
        req_id: currCand.req_id,
        from_stage: prevCand.current_stage,
        to_stage: currCand.current_stage,
        from_canonical: prevCanonical,
        to_canonical: currCanonical,
        event_at: eventTime.event_at,
        confidence: eventTime.confidence,
        confidence_reasons: eventTime.confidence_reasons
      };

      if (regression) {
        result.stageRegressions.push(stageEvent as StageRegressionEvent);
      } else {
        result.stageChanges.push(stageEvent);
      }
    }

    // Disposition change detection
    if (prevCand.disposition !== currCand.disposition) {
      const eventTime = inferEventTime(prevCand, currCand, prevSnapshot, currSnapshot);
      result.dispositionChanges.push({
        candidate_id: currCand.candidate_id,
        req_id: currCand.req_id,
        from_disposition: prevCand.disposition,
        to_disposition: currCand.disposition,
        event_at: eventTime.event_at,
        confidence: eventTime.confidence,
        confidence_reasons: eventTime.confidence_reasons
      });
    }
  }

  // Detect disappeared candidates
  for (const [key, prevCand] of prevCandMap) {
    if (!currCandMap.has(key)) {
      result.candidatesDisappeared.push({
        candidate_id: prevCand.candidate_id,
        req_id: prevCand.req_id,
        last_stage: prevCand.current_stage,
        last_canonical_stage: prevCand.canonical_stage,
        last_disposition: prevCand.disposition
      });
    }
  }

  // Build lookup maps for requisitions
  const prevReqMap = new Map<string, SnapshotRequisition>();
  for (const r of prevRequisitions) {
    prevReqMap.set(r.req_id, r);
  }

  const currReqMap = new Map<string, SnapshotRequisition>();
  for (const r of currRequisitions) {
    currReqMap.set(r.req_id, r);
  }

  // Detect changes for current requisitions
  for (const [reqId, currReq] of currReqMap) {
    const prevReq = prevReqMap.get(reqId);

    if (!prevReq) {
      // New req appeared
      const eventTime = inferReqEventTime(null, currReq, prevSnapshot, currSnapshot);
      result.reqsAppeared.push({
        req_id: currReq.req_id,
        status: currReq.status,
        event_at: eventTime.event_at
      });
      continue;
    }

    // Status change detection
    if (prevReq.status !== currReq.status) {
      const eventTime = inferReqEventTime(prevReq, currReq, prevSnapshot, currSnapshot);
      result.reqStatusChanges.push({
        req_id: currReq.req_id,
        from_status: prevReq.status,
        to_status: currReq.status,
        event_at: eventTime.event_at,
        confidence: eventTime.confidence,
        confidence_reasons: eventTime.confidence_reasons
      });
    }
  }

  // Detect disappeared requisitions
  for (const [reqId, prevReq] of prevReqMap) {
    if (!currReqMap.has(reqId)) {
      result.reqsDisappeared.push({
        req_id: prevReq.req_id,
        last_status: prevReq.status
      });
    }
  }

  return result;
}

// ============================================
// EVENT PERSISTENCE
// ============================================

/**
 * Convert DiffResult to SnapshotEvent records for database insertion.
 */
export function diffResultToEvents(
  result: DiffResult,
  orgId: string,
  fromSnapshotId: string | null,
  toSnapshotId: string,
  fromSnapshotDate: Date | null,
  toSnapshotDate: Date
): Omit<SnapshotEvent, 'id' | 'created_at'>[] {
  const events: Omit<SnapshotEvent, 'id' | 'created_at'>[] = [];

  // Stage changes
  for (const e of result.stageChanges) {
    events.push({
      organization_id: orgId,
      event_type: 'STAGE_CHANGE',
      candidate_id: e.candidate_id,
      req_id: e.req_id,
      from_value: e.from_stage,
      to_value: e.to_stage,
      from_canonical: e.from_canonical,
      to_canonical: e.to_canonical,
      event_at: e.event_at,
      from_snapshot_id: fromSnapshotId,
      to_snapshot_id: toSnapshotId,
      from_snapshot_date: fromSnapshotDate,
      to_snapshot_date: toSnapshotDate,
      confidence: e.confidence,
      confidence_reasons: e.confidence_reasons,
      metadata: null
    });
  }

  // Stage regressions
  for (const e of result.stageRegressions) {
    events.push({
      organization_id: orgId,
      event_type: 'STAGE_REGRESSION',
      candidate_id: e.candidate_id,
      req_id: e.req_id,
      from_value: e.from_stage,
      to_value: e.to_stage,
      from_canonical: e.from_canonical,
      to_canonical: e.to_canonical,
      event_at: e.event_at,
      from_snapshot_id: fromSnapshotId,
      to_snapshot_id: toSnapshotId,
      from_snapshot_date: fromSnapshotDate,
      to_snapshot_date: toSnapshotDate,
      confidence: e.confidence,
      confidence_reasons: e.confidence_reasons,
      metadata: { is_regression: true }
    });
  }

  // Disposition changes
  for (const e of result.dispositionChanges) {
    events.push({
      organization_id: orgId,
      event_type: 'DISPOSITION_CHANGE',
      candidate_id: e.candidate_id,
      req_id: e.req_id,
      from_value: e.from_disposition,
      to_value: e.to_disposition,
      from_canonical: null,
      to_canonical: null,
      event_at: e.event_at,
      from_snapshot_id: fromSnapshotId,
      to_snapshot_id: toSnapshotId,
      from_snapshot_date: fromSnapshotDate,
      to_snapshot_date: toSnapshotDate,
      confidence: e.confidence,
      confidence_reasons: e.confidence_reasons,
      metadata: null
    });
  }

  // Req status changes
  for (const e of result.reqStatusChanges) {
    events.push({
      organization_id: orgId,
      event_type: 'REQ_STATUS_CHANGE',
      candidate_id: null,
      req_id: e.req_id,
      from_value: e.from_status,
      to_value: e.to_status,
      from_canonical: null,
      to_canonical: null,
      event_at: e.event_at,
      from_snapshot_id: fromSnapshotId,
      to_snapshot_id: toSnapshotId,
      from_snapshot_date: fromSnapshotDate,
      to_snapshot_date: toSnapshotDate,
      confidence: e.confidence,
      confidence_reasons: e.confidence_reasons,
      metadata: null
    });
  }

  // Candidates appeared
  for (const e of result.candidatesAppeared) {
    events.push({
      organization_id: orgId,
      event_type: 'CANDIDATE_APPEARED',
      candidate_id: e.candidate_id,
      req_id: e.req_id,
      from_value: null,
      to_value: e.current_stage,
      from_canonical: null,
      to_canonical: e.canonical_stage,
      event_at: e.event_at,
      from_snapshot_id: fromSnapshotId,
      to_snapshot_id: toSnapshotId,
      from_snapshot_date: fromSnapshotDate,
      to_snapshot_date: toSnapshotDate,
      confidence: 'medium',
      confidence_reasons: ['New candidate in snapshot'],
      metadata: { disposition: e.disposition }
    });
  }

  // Candidates disappeared
  for (const e of result.candidatesDisappeared) {
    // Use midpoint or current snapshot date for disappeared candidates
    const eventAt = fromSnapshotDate
      ? new Date((fromSnapshotDate.getTime() + toSnapshotDate.getTime()) / 2)
      : toSnapshotDate;

    events.push({
      organization_id: orgId,
      event_type: 'CANDIDATE_DISAPPEARED',
      candidate_id: e.candidate_id,
      req_id: e.req_id,
      from_value: e.last_stage,
      to_value: null,
      from_canonical: e.last_canonical_stage,
      to_canonical: null,
      event_at: eventAt,
      from_snapshot_id: fromSnapshotId,
      to_snapshot_id: toSnapshotId,
      from_snapshot_date: fromSnapshotDate,
      to_snapshot_date: toSnapshotDate,
      confidence: 'low',
      confidence_reasons: ['Candidate missing from snapshot'],
      metadata: { last_disposition: e.last_disposition }
    });
  }

  // Reqs appeared
  for (const e of result.reqsAppeared) {
    events.push({
      organization_id: orgId,
      event_type: 'REQ_APPEARED',
      candidate_id: null,
      req_id: e.req_id,
      from_value: null,
      to_value: e.status,
      from_canonical: null,
      to_canonical: null,
      event_at: e.event_at,
      from_snapshot_id: fromSnapshotId,
      to_snapshot_id: toSnapshotId,
      from_snapshot_date: fromSnapshotDate,
      to_snapshot_date: toSnapshotDate,
      confidence: 'medium',
      confidence_reasons: ['New req in snapshot'],
      metadata: null
    });
  }

  // Reqs disappeared
  for (const e of result.reqsDisappeared) {
    const eventAt = fromSnapshotDate
      ? new Date((fromSnapshotDate.getTime() + toSnapshotDate.getTime()) / 2)
      : toSnapshotDate;

    events.push({
      organization_id: orgId,
      event_type: 'REQ_DISAPPEARED',
      candidate_id: null,
      req_id: e.req_id,
      from_value: e.last_status,
      to_value: null,
      from_canonical: null,
      to_canonical: null,
      event_at: eventAt,
      from_snapshot_id: fromSnapshotId,
      to_snapshot_id: toSnapshotId,
      from_snapshot_date: fromSnapshotDate,
      to_snapshot_date: toSnapshotDate,
      confidence: 'low',
      confidence_reasons: ['Req missing from snapshot'],
      metadata: null
    });
  }

  return events;
}

/**
 * Insert events in batches.
 */
async function batchInsertEvents(
  events: Omit<SnapshotEvent, 'id' | 'created_at'>[]
): Promise<void> {
  const client = getSupabase();
  if (!client || events.length === 0) return;

  for (let i = 0; i < events.length; i += SNAPSHOT_LIMITS.DIFF_BATCH_SIZE) {
    const batch = events.slice(i, i + SNAPSHOT_LIMITS.DIFF_BATCH_SIZE);
    const { error } = await client
      .from('snapshot_events')
      .insert(batch.map(e => ({
        organization_id: e.organization_id,
        event_type: e.event_type,
        candidate_id: e.candidate_id,
        req_id: e.req_id,
        from_value: e.from_value,
        to_value: e.to_value,
        from_canonical: e.from_canonical,
        to_canonical: e.to_canonical,
        event_at: e.event_at.toISOString(),
        from_snapshot_id: e.from_snapshot_id,
        to_snapshot_id: e.to_snapshot_id,
        from_snapshot_date: e.from_snapshot_date?.toISOString().split('T')[0] ?? null,
        to_snapshot_date: e.to_snapshot_date.toISOString().split('T')[0],
        confidence: e.confidence,
        confidence_reasons: e.confidence_reasons,
        metadata: e.metadata
      })));

    if (error) {
      console.error('[SnapshotDiffService] Error inserting events:', error);
      throw error;
    }
  }
}

/**
 * Delete existing events for a target snapshot (idempotency).
 */
async function deleteEventsForSnapshot(orgId: string, toSnapshotId: string): Promise<void> {
  const client = getSupabase();
  if (!client) return;

  const { error } = await client
    .from('snapshot_events')
    .delete()
    .eq('organization_id', orgId)
    .eq('to_snapshot_id', toSnapshotId);

  if (error) {
    console.error('[SnapshotDiffService] Error deleting events:', error);
    throw error;
  }
}

// ============================================
// MAIN DIFF PROCESSING
// ============================================

export interface ProcessDiffResult {
  eventsGenerated: number;
  stageChanges: number;
  stageRegressions: number;
  dispositionChanges: number;
  reqStatusChanges: number;
  candidatesAppeared: number;
  candidatesDisappeared: number;
}

/**
 * Process the diff for a snapshot. This is idempotent.
 */
export async function processDiff(
  orgId: string,
  toSnapshotId: string
): Promise<ProcessDiffResult> {
  console.log(`[SnapshotDiffService] Processing diff for snapshot ${toSnapshotId}`);

  // 1. Mark snapshot as processing
  await updateSnapshotStatus(toSnapshotId, 'processing');

  try {
    // 2. Clear any existing events for this target snapshot (idempotent)
    await deleteEventsForSnapshot(orgId, toSnapshotId);

    // 3. Get current snapshot
    const currSnapshot = await getSnapshot(toSnapshotId);
    if (!currSnapshot) {
      throw new Error(`Snapshot ${toSnapshotId} not found`);
    }

    // 4. Get previous snapshot (may be null for first snapshot)
    const prevSnapshot = await getPreviousSnapshot(orgId, currSnapshot.snapshot_seq);

    // 5. Load candidates and requisitions
    const currCandidates = await getSnapshotCandidates(toSnapshotId);
    const prevCandidates = prevSnapshot
      ? await getSnapshotCandidates(prevSnapshot.id)
      : [];

    const currRequisitions = await getSnapshotRequisitions(toSnapshotId);
    const prevRequisitions = prevSnapshot
      ? await getSnapshotRequisitions(prevSnapshot.id)
      : [];

    // 6. Run diff algorithm
    const diffResult = diffSnapshots(
      prevCandidates,
      currCandidates,
      prevRequisitions,
      currRequisitions,
      prevSnapshot,
      currSnapshot
    );

    // 7. Convert to events
    const events = diffResultToEvents(
      diffResult,
      orgId,
      prevSnapshot?.id ?? null,
      toSnapshotId,
      prevSnapshot?.snapshot_date ?? null,
      currSnapshot.snapshot_date
    );

    // 8. Batch insert events
    await batchInsertEvents(events);

    // 9. Update snapshot status
    await updateSnapshotStatus(toSnapshotId, 'completed', {
      events_generated: events.length,
      diff_completed_at: new Date()
    });

    console.log(`[SnapshotDiffService] Diff complete: ${events.length} events generated`);

    return {
      eventsGenerated: events.length,
      stageChanges: diffResult.stageChanges.length,
      stageRegressions: diffResult.stageRegressions.length,
      dispositionChanges: diffResult.dispositionChanges.length,
      reqStatusChanges: diffResult.reqStatusChanges.length,
      candidatesAppeared: diffResult.candidatesAppeared.length,
      candidatesDisappeared: diffResult.candidatesDisappeared.length
    };
  } catch (error) {
    console.error('[SnapshotDiffService] Error processing diff:', error);
    await updateSnapshotStatus(toSnapshotId, 'failed', {
      error_message: error instanceof Error ? error.message : 'Unknown error'
    });
    throw error;
  }
}

/**
 * Reprocess all snapshots for an org (backfill).
 * Processes in chronological order by snapshot_seq.
 */
export async function backfillSnapshots(orgId: string): Promise<void> {
  const client = getSupabase();
  if (!client) return;

  // Get all snapshots ordered by seq
  const { data: snapshots, error } = await client
    .from('data_snapshots')
    .select('id, snapshot_seq')
    .eq('organization_id', orgId)
    .order('snapshot_seq', { ascending: true });

  if (error || !snapshots) {
    console.error('[SnapshotDiffService] Error fetching snapshots for backfill:', error);
    return;
  }

  console.log(`[SnapshotDiffService] Backfilling ${snapshots.length} snapshots for org ${orgId}`);

  for (const snapshot of snapshots) {
    await processDiff(orgId, snapshot.id);
  }

  console.log(`[SnapshotDiffService] Backfill complete for org ${orgId}`);
}
