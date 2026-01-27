// Snapshot Service - CRUD operations for data snapshots
// See docs/plans/SNAPSHOT_DIFF_EVENT_STREAM_V1.md for full specification

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  DataSnapshot,
  SnapshotCandidate,
  SnapshotRequisition,
  SnapshotStatus,
  CreateSnapshotInput,
  SnapshotCandidateInput,
  SnapshotRequisitionInput,
  SnapshotSummary,
  SNAPSHOT_LIMITS
} from '../types/snapshotTypes';

// Get Supabase client (lazy initialization)
let supabase: SupabaseClient | null = null;

function getSupabase(): SupabaseClient | null {
  if (supabase) return supabase;

  const url = process.env.REACT_APP_SUPABASE_URL;
  const key = process.env.REACT_APP_SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.warn('[SnapshotService] Supabase not configured');
    return null;
  }

  supabase = createClient(url, key);
  return supabase;
}

// ============================================
// SNAPSHOT CRUD OPERATIONS
// ============================================

/**
 * Create a new snapshot and return its ID.
 * Automatically assigns the next sequence number.
 */
export async function createSnapshot(input: CreateSnapshotInput): Promise<DataSnapshot> {
  const client = getSupabase();
  if (!client) throw new Error('Supabase not configured');

  // Get the next sequence number for this org
  const { data: maxSeqData } = await client
    .from('data_snapshots')
    .select('snapshot_seq')
    .eq('organization_id', input.organization_id)
    .order('snapshot_seq', { ascending: false })
    .limit(1)
    .single();

  const nextSeq = (maxSeqData?.snapshot_seq ?? 0) + 1;

  const { data, error } = await client
    .from('data_snapshots')
    .insert({
      organization_id: input.organization_id,
      snapshot_date: input.snapshot_date.toISOString().split('T')[0],
      snapshot_seq: nextSeq,
      source_filename: input.source_filename ?? null,
      source_hash: input.source_hash ?? null,
      imported_by: input.imported_by ?? null,
      status: 'pending' as SnapshotStatus
    })
    .select()
    .single();

  if (error) {
    console.error('[SnapshotService] Error creating snapshot:', error);
    throw error;
  }

  return mapSnapshotFromDb(data);
}

/**
 * Get a snapshot by ID.
 */
export async function getSnapshot(snapshotId: string): Promise<DataSnapshot | null> {
  const client = getSupabase();
  if (!client) return null;

  const { data, error } = await client
    .from('data_snapshots')
    .select('*')
    .eq('id', snapshotId)
    .single();

  if (error || !data) return null;
  return mapSnapshotFromDb(data);
}

/**
 * Get the previous snapshot (by sequence number) for an org.
 */
export async function getPreviousSnapshot(
  orgId: string,
  currentSeq: number
): Promise<DataSnapshot | null> {
  const client = getSupabase();
  if (!client) return null;

  const { data, error } = await client
    .from('data_snapshots')
    .select('*')
    .eq('organization_id', orgId)
    .eq('snapshot_seq', currentSeq - 1)
    .single();

  if (error || !data) return null;
  return mapSnapshotFromDb(data);
}

/**
 * Get all completed snapshots for an org, ordered by date.
 */
export async function getCompletedSnapshots(orgId: string): Promise<DataSnapshot[]> {
  const client = getSupabase();
  if (!client) return [];

  const { data, error } = await client
    .from('data_snapshots')
    .select('*')
    .eq('organization_id', orgId)
    .eq('status', 'completed')
    .order('snapshot_date', { ascending: true });

  if (error || !data) return [];
  return data.map(mapSnapshotFromDb);
}

/**
 * Get snapshot summaries for display in UI.
 */
export async function getSnapshotSummaries(orgId: string): Promise<SnapshotSummary[]> {
  const snapshots = await getCompletedSnapshots(orgId);

  return snapshots.map((s, index) => ({
    id: s.id,
    snapshot_date: s.snapshot_date,
    snapshot_seq: s.snapshot_seq,
    candidate_count: s.candidate_count,
    req_count: s.req_count,
    events_generated: s.events_generated,
    status: s.status,
    delta_candidates: index > 0
      ? s.candidate_count - snapshots[index - 1].candidate_count
      : undefined
  }));
}

/**
 * Update snapshot status and metadata.
 */
export async function updateSnapshotStatus(
  snapshotId: string,
  status: SnapshotStatus,
  metadata?: {
    events_generated?: number;
    diff_completed_at?: Date;
    error_message?: string;
    candidate_count?: number;
    req_count?: number;
  }
): Promise<void> {
  const client = getSupabase();
  if (!client) return;

  const updateData: Record<string, unknown> = { status };
  if (metadata?.events_generated !== undefined) {
    updateData.events_generated = metadata.events_generated;
  }
  if (metadata?.diff_completed_at) {
    updateData.diff_completed_at = metadata.diff_completed_at.toISOString();
  }
  if (metadata?.error_message !== undefined) {
    updateData.error_message = metadata.error_message;
  }
  if (metadata?.candidate_count !== undefined) {
    updateData.candidate_count = metadata.candidate_count;
  }
  if (metadata?.req_count !== undefined) {
    updateData.req_count = metadata.req_count;
  }

  const { error } = await client
    .from('data_snapshots')
    .update(updateData)
    .eq('id', snapshotId);

  if (error) {
    console.error('[SnapshotService] Error updating snapshot:', error);
    throw error;
  }
}

/**
 * Delete a snapshot and all related data (cascade).
 */
export async function deleteSnapshot(snapshotId: string): Promise<void> {
  const client = getSupabase();
  if (!client) return;

  const { error } = await client
    .from('data_snapshots')
    .delete()
    .eq('id', snapshotId);

  if (error) {
    console.error('[SnapshotService] Error deleting snapshot:', error);
    throw error;
  }
}

// ============================================
// SNAPSHOT CANDIDATES OPERATIONS
// ============================================

/**
 * Insert snapshot candidates in batches.
 */
export async function insertSnapshotCandidates(
  candidates: SnapshotCandidateInput[]
): Promise<void> {
  const client = getSupabase();
  if (!client) return;

  if (candidates.length > SNAPSHOT_LIMITS.MAX_CANDIDATES_PER_SNAPSHOT) {
    throw new Error(`Exceeded max candidates per snapshot (${SNAPSHOT_LIMITS.MAX_CANDIDATES_PER_SNAPSHOT})`);
  }

  // Insert in batches
  for (let i = 0; i < candidates.length; i += SNAPSHOT_LIMITS.DIFF_BATCH_SIZE) {
    const batch = candidates.slice(i, i + SNAPSHOT_LIMITS.DIFF_BATCH_SIZE);
    const { error } = await client
      .from('snapshot_candidates')
      .insert(batch.map(c => ({
        snapshot_id: c.snapshot_id,
        organization_id: c.organization_id,
        candidate_id: c.candidate_id,
        req_id: c.req_id,
        current_stage: c.current_stage,
        canonical_stage: c.canonical_stage ?? null,
        disposition: c.disposition ?? null,
        applied_at: c.applied_at?.toISOString() ?? null,
        current_stage_entered_at: c.current_stage_entered_at?.toISOString() ?? null,
        hired_at: c.hired_at?.toISOString() ?? null,
        rejected_at: c.rejected_at?.toISOString() ?? null,
        withdrawn_at: c.withdrawn_at?.toISOString() ?? null,
        offer_extended_at: c.offer_extended_at?.toISOString() ?? null,
        source_row_number: c.source_row_number ?? null,
        raw_data: c.raw_data ?? null
      })));

    if (error) {
      console.error('[SnapshotService] Error inserting candidates:', error);
      throw error;
    }
  }
}

/**
 * Get all candidates for a snapshot.
 */
export async function getSnapshotCandidates(snapshotId: string): Promise<SnapshotCandidate[]> {
  const client = getSupabase();
  if (!client) return [];

  const candidates: SnapshotCandidate[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await client
      .from('snapshot_candidates')
      .select('*')
      .eq('snapshot_id', snapshotId)
      .range(offset, offset + SNAPSHOT_LIMITS.QUERY_PAGE_SIZE - 1);

    if (error) {
      console.error('[SnapshotService] Error fetching candidates:', error);
      throw error;
    }

    if (!data || data.length === 0) break;

    candidates.push(...data.map(mapCandidateFromDb));
    offset += SNAPSHOT_LIMITS.QUERY_PAGE_SIZE;

    if (data.length < SNAPSHOT_LIMITS.QUERY_PAGE_SIZE) break;
  }

  return candidates;
}

// ============================================
// SNAPSHOT REQUISITIONS OPERATIONS
// ============================================

/**
 * Insert snapshot requisitions in batches.
 */
export async function insertSnapshotRequisitions(
  requisitions: SnapshotRequisitionInput[]
): Promise<void> {
  const client = getSupabase();
  if (!client) return;

  if (requisitions.length > SNAPSHOT_LIMITS.MAX_REQS_PER_SNAPSHOT) {
    throw new Error(`Exceeded max reqs per snapshot (${SNAPSHOT_LIMITS.MAX_REQS_PER_SNAPSHOT})`);
  }

  // Insert in batches
  for (let i = 0; i < requisitions.length; i += SNAPSHOT_LIMITS.DIFF_BATCH_SIZE) {
    const batch = requisitions.slice(i, i + SNAPSHOT_LIMITS.DIFF_BATCH_SIZE);
    const { error } = await client
      .from('snapshot_requisitions')
      .insert(batch.map(r => ({
        snapshot_id: r.snapshot_id,
        organization_id: r.organization_id,
        req_id: r.req_id,
        status: r.status ?? null,
        recruiter_id: r.recruiter_id ?? null,
        hiring_manager_id: r.hiring_manager_id ?? null,
        opened_at: r.opened_at?.toISOString() ?? null,
        closed_at: r.closed_at?.toISOString() ?? null,
        source_row_number: r.source_row_number ?? null,
        raw_data: r.raw_data ?? null
      })));

    if (error) {
      console.error('[SnapshotService] Error inserting requisitions:', error);
      throw error;
    }
  }
}

/**
 * Get all requisitions for a snapshot.
 */
export async function getSnapshotRequisitions(snapshotId: string): Promise<SnapshotRequisition[]> {
  const client = getSupabase();
  if (!client) return [];

  const requisitions: SnapshotRequisition[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await client
      .from('snapshot_requisitions')
      .select('*')
      .eq('snapshot_id', snapshotId)
      .range(offset, offset + SNAPSHOT_LIMITS.QUERY_PAGE_SIZE - 1);

    if (error) {
      console.error('[SnapshotService] Error fetching requisitions:', error);
      throw error;
    }

    if (!data || data.length === 0) break;

    requisitions.push(...data.map(mapRequisitionFromDb));
    offset += SNAPSHOT_LIMITS.QUERY_PAGE_SIZE;

    if (data.length < SNAPSHOT_LIMITS.QUERY_PAGE_SIZE) break;
  }

  return requisitions;
}

// ============================================
// UTILITY: CHECK FOR DUPLICATE IMPORT
// ============================================

/**
 * Check if a file with the same hash has already been imported.
 */
export async function isDuplicateImport(orgId: string, sourceHash: string): Promise<boolean> {
  const client = getSupabase();
  if (!client) return false;

  const { data, error } = await client
    .from('data_snapshots')
    .select('id')
    .eq('organization_id', orgId)
    .eq('source_hash', sourceHash)
    .limit(1);

  if (error) return false;
  return (data?.length ?? 0) > 0;
}

/**
 * Count snapshots for an org (for limit checking).
 */
export async function getSnapshotCount(orgId: string): Promise<number> {
  const client = getSupabase();
  if (!client) return 0;

  const { count, error } = await client
    .from('data_snapshots')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', orgId);

  if (error) return 0;
  return count ?? 0;
}

// ============================================
// MAPPING HELPERS
// ============================================

function mapSnapshotFromDb(row: Record<string, unknown>): DataSnapshot {
  return {
    id: row.id as string,
    organization_id: row.organization_id as string,
    snapshot_date: new Date(row.snapshot_date as string),
    snapshot_seq: row.snapshot_seq as number,
    source_filename: row.source_filename as string | null,
    source_hash: row.source_hash as string | null,
    imported_at: new Date(row.imported_at as string),
    imported_by: row.imported_by as string | null,
    req_count: row.req_count as number,
    candidate_count: row.candidate_count as number,
    user_count: row.user_count as number,
    status: row.status as SnapshotStatus,
    diff_completed_at: row.diff_completed_at ? new Date(row.diff_completed_at as string) : null,
    events_generated: row.events_generated as number,
    error_message: row.error_message as string | null
  };
}

function mapCandidateFromDb(row: Record<string, unknown>): SnapshotCandidate {
  return {
    id: row.id as string,
    snapshot_id: row.snapshot_id as string,
    organization_id: row.organization_id as string,
    candidate_id: row.candidate_id as string,
    req_id: row.req_id as string,
    current_stage: row.current_stage as string,
    canonical_stage: row.canonical_stage as SnapshotCandidate['canonical_stage'],
    disposition: row.disposition as SnapshotCandidate['disposition'],
    applied_at: row.applied_at ? new Date(row.applied_at as string) : null,
    current_stage_entered_at: row.current_stage_entered_at ? new Date(row.current_stage_entered_at as string) : null,
    hired_at: row.hired_at ? new Date(row.hired_at as string) : null,
    rejected_at: row.rejected_at ? new Date(row.rejected_at as string) : null,
    withdrawn_at: row.withdrawn_at ? new Date(row.withdrawn_at as string) : null,
    offer_extended_at: row.offer_extended_at ? new Date(row.offer_extended_at as string) : null,
    source_row_number: row.source_row_number as number | null,
    raw_data: row.raw_data as Record<string, unknown> | null
  };
}

function mapRequisitionFromDb(row: Record<string, unknown>): SnapshotRequisition {
  return {
    id: row.id as string,
    snapshot_id: row.snapshot_id as string,
    organization_id: row.organization_id as string,
    req_id: row.req_id as string,
    status: row.status as SnapshotRequisition['status'],
    recruiter_id: row.recruiter_id as string | null,
    hiring_manager_id: row.hiring_manager_id as string | null,
    opened_at: row.opened_at ? new Date(row.opened_at as string) : null,
    closed_at: row.closed_at ? new Date(row.closed_at as string) : null,
    source_row_number: row.source_row_number as number | null,
    raw_data: row.raw_data as Record<string, unknown> | null
  };
}

// ============================================
// HASH GENERATION UTILITY
// ============================================

/**
 * Generate SHA-256 hash of CSV content for deduplication.
 */
export async function generateContentHash(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
