// Snapshot Event Service - Query operations for snapshot events
// See docs/plans/SNAPSHOT_DIFF_EVENT_STREAM_V1.md for full specification

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  SnapshotEvent,
  SnapshotEventType,
  EventConfidence,
  SNAPSHOT_LIMITS
} from '../types/snapshotTypes';

// Get Supabase client (lazy initialization)
let supabase: SupabaseClient | null = null;

function getSupabase(): SupabaseClient | null {
  if (supabase) return supabase;

  const url = process.env.REACT_APP_SUPABASE_URL;
  const key = process.env.REACT_APP_SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.warn('[SnapshotEventService] Supabase not configured');
    return null;
  }

  supabase = createClient(url, key);
  return supabase;
}

// ============================================
// EVENT QUERIES
// ============================================

export interface EventQueryOptions {
  eventTypes?: SnapshotEventType[];
  candidateId?: string;
  reqId?: string;
  fromDate?: Date;
  toDate?: Date;
  confidence?: EventConfidence[];
  limit?: number;
  offset?: number;
}

/**
 * Query snapshot events with filters.
 */
export async function queryEvents(
  orgId: string,
  options: EventQueryOptions = {}
): Promise<SnapshotEvent[]> {
  const client = getSupabase();
  if (!client) return [];

  let query = client
    .from('snapshot_events')
    .select('*')
    .eq('organization_id', orgId)
    .order('event_at', { ascending: false });

  if (options.eventTypes && options.eventTypes.length > 0) {
    query = query.in('event_type', options.eventTypes);
  }

  if (options.candidateId) {
    query = query.eq('candidate_id', options.candidateId);
  }

  if (options.reqId) {
    query = query.eq('req_id', options.reqId);
  }

  if (options.fromDate) {
    query = query.gte('event_at', options.fromDate.toISOString());
  }

  if (options.toDate) {
    query = query.lte('event_at', options.toDate.toISOString());
  }

  if (options.confidence && options.confidence.length > 0) {
    query = query.in('confidence', options.confidence);
  }

  const limit = options.limit ?? SNAPSHOT_LIMITS.QUERY_PAGE_SIZE;
  const offset = options.offset ?? 0;
  query = query.range(offset, offset + limit - 1);

  const { data, error } = await query;

  if (error) {
    console.error('[SnapshotEventService] Error querying events:', error);
    return [];
  }

  return (data ?? []).map(mapEventFromDb);
}

/**
 * Get all events for a specific candidate across all reqs.
 */
export async function getCandidateEvents(
  orgId: string,
  candidateId: string
): Promise<SnapshotEvent[]> {
  return queryEvents(orgId, { candidateId });
}

/**
 * Get all events for a specific requisition.
 */
export async function getReqEvents(
  orgId: string,
  reqId: string
): Promise<SnapshotEvent[]> {
  return queryEvents(orgId, { reqId });
}

/**
 * Get stage change events for a candidate on a specific req.
 */
export async function getCandidateStageHistory(
  orgId: string,
  candidateId: string,
  reqId: string
): Promise<SnapshotEvent[]> {
  const client = getSupabase();
  if (!client) return [];

  const { data, error } = await client
    .from('snapshot_events')
    .select('*')
    .eq('organization_id', orgId)
    .eq('candidate_id', candidateId)
    .eq('req_id', reqId)
    .in('event_type', ['STAGE_CHANGE', 'STAGE_REGRESSION', 'CANDIDATE_APPEARED'])
    .order('event_at', { ascending: true });

  if (error) {
    console.error('[SnapshotEventService] Error getting stage history:', error);
    return [];
  }

  return (data ?? []).map(mapEventFromDb);
}

/**
 * Get regression events for an org.
 */
export async function getRegressions(
  orgId: string,
  fromDate?: Date,
  toDate?: Date
): Promise<SnapshotEvent[]> {
  return queryEvents(orgId, {
    eventTypes: ['STAGE_REGRESSION'],
    fromDate,
    toDate
  });
}

/**
 * Count events by type for an org.
 */
export async function getEventCounts(
  orgId: string,
  fromDate?: Date,
  toDate?: Date
): Promise<Record<SnapshotEventType, number>> {
  const client = getSupabase();
  if (!client) {
    return {
      STAGE_CHANGE: 0,
      STAGE_REGRESSION: 0,
      DISPOSITION_CHANGE: 0,
      REQ_STATUS_CHANGE: 0,
      CANDIDATE_APPEARED: 0,
      CANDIDATE_DISAPPEARED: 0,
      REQ_APPEARED: 0,
      REQ_DISAPPEARED: 0
    };
  }

  let query = client
    .from('snapshot_events')
    .select('event_type', { count: 'exact' })
    .eq('organization_id', orgId);

  if (fromDate) {
    query = query.gte('event_at', fromDate.toISOString());
  }

  if (toDate) {
    query = query.lte('event_at', toDate.toISOString());
  }

  // Group by event type manually since Supabase doesn't support GROUP BY in JS client
  const eventTypes: SnapshotEventType[] = [
    'STAGE_CHANGE',
    'STAGE_REGRESSION',
    'DISPOSITION_CHANGE',
    'REQ_STATUS_CHANGE',
    'CANDIDATE_APPEARED',
    'CANDIDATE_DISAPPEARED',
    'REQ_APPEARED',
    'REQ_DISAPPEARED'
  ];

  const counts: Record<SnapshotEventType, number> = {
    STAGE_CHANGE: 0,
    STAGE_REGRESSION: 0,
    DISPOSITION_CHANGE: 0,
    REQ_STATUS_CHANGE: 0,
    CANDIDATE_APPEARED: 0,
    CANDIDATE_DISAPPEARED: 0,
    REQ_APPEARED: 0,
    REQ_DISAPPEARED: 0
  };

  for (const eventType of eventTypes) {
    let countQuery = client
      .from('snapshot_events')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .eq('event_type', eventType);

    if (fromDate) {
      countQuery = countQuery.gte('event_at', fromDate.toISOString());
    }

    if (toDate) {
      countQuery = countQuery.lte('event_at', toDate.toISOString());
    }

    const { count } = await countQuery;
    counts[eventType] = count ?? 0;
  }

  return counts;
}

/**
 * Get total event count for an org.
 */
export async function getTotalEventCount(orgId: string): Promise<number> {
  const client = getSupabase();
  if (!client) return 0;

  const { count, error } = await client
    .from('snapshot_events')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', orgId);

  if (error) return 0;
  return count ?? 0;
}

/**
 * Get the most recent events for an org.
 */
export async function getRecentEvents(
  orgId: string,
  limit: number = 20
): Promise<SnapshotEvent[]> {
  return queryEvents(orgId, { limit });
}

/**
 * Calculate stage dwell time for a candidate from events.
 * Returns an array of { stage, dwell_days } objects.
 */
export interface StageDwellTime {
  stage: string;
  canonical_stage: string | null;
  entered_at: Date;
  exited_at: Date | null;
  dwell_days: number | null;
}

export async function calculateStageDwellTimes(
  orgId: string,
  candidateId: string,
  reqId: string
): Promise<StageDwellTime[]> {
  const events = await getCandidateStageHistory(orgId, candidateId, reqId);

  if (events.length === 0) return [];

  const dwellTimes: StageDwellTime[] = [];
  let currentStage: string | null = null;
  let currentCanonical: string | null = null;
  let stageEnteredAt: Date | null = null;

  for (const event of events) {
    if (event.event_type === 'CANDIDATE_APPEARED') {
      // Initial stage entry
      currentStage = event.to_value;
      currentCanonical = event.to_canonical;
      stageEnteredAt = event.event_at;
    } else if (event.event_type === 'STAGE_CHANGE' || event.event_type === 'STAGE_REGRESSION') {
      // Stage transition - record dwell time for previous stage
      if (currentStage && stageEnteredAt) {
        const dwellDays = (event.event_at.getTime() - stageEnteredAt.getTime()) / (1000 * 60 * 60 * 24);
        dwellTimes.push({
          stage: currentStage,
          canonical_stage: currentCanonical,
          entered_at: stageEnteredAt,
          exited_at: event.event_at,
          dwell_days: Math.round(dwellDays * 10) / 10 // Round to 1 decimal
        });
      }

      // Update current stage
      currentStage = event.to_value;
      currentCanonical = event.to_canonical;
      stageEnteredAt = event.event_at;
    }
  }

  // Add current stage (still in progress)
  if (currentStage && stageEnteredAt) {
    dwellTimes.push({
      stage: currentStage,
      canonical_stage: currentCanonical,
      entered_at: stageEnteredAt,
      exited_at: null,
      dwell_days: null // Still in this stage
    });
  }

  return dwellTimes;
}

// ============================================
// MAPPING HELPERS
// ============================================

function mapEventFromDb(row: Record<string, unknown>): SnapshotEvent {
  return {
    id: row.id as string,
    organization_id: row.organization_id as string,
    event_type: row.event_type as SnapshotEventType,
    candidate_id: row.candidate_id as string | null,
    req_id: row.req_id as string | null,
    from_value: row.from_value as string | null,
    to_value: row.to_value as string | null,
    from_canonical: row.from_canonical as string | null,
    to_canonical: row.to_canonical as string | null,
    event_at: new Date(row.event_at as string),
    from_snapshot_id: row.from_snapshot_id as string | null,
    to_snapshot_id: row.to_snapshot_id as string,
    from_snapshot_date: row.from_snapshot_date ? new Date(row.from_snapshot_date as string) : null,
    to_snapshot_date: new Date(row.to_snapshot_date as string),
    confidence: row.confidence as EventConfidence,
    confidence_reasons: row.confidence_reasons as string[] | null,
    metadata: row.metadata as Record<string, unknown> | null,
    created_at: new Date(row.created_at as string)
  };
}
