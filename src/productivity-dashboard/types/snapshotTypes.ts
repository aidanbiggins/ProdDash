// Snapshot Diff Event Stream Types
// See docs/plans/SNAPSHOT_DIFF_EVENT_STREAM_V1.md for full specification

import { CanonicalStage, CandidateDisposition, RequisitionStatus } from './entities';

// ============================================
// SNAPSHOT TYPES
// ============================================

export type SnapshotStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'superseded';

export interface DataSnapshot {
  id: string;
  organization_id: string;
  snapshot_date: Date;
  snapshot_seq: number;
  source_filename: string | null;
  source_hash: string | null;
  imported_at: Date;
  imported_by: string | null;
  req_count: number;
  candidate_count: number;
  user_count: number;
  status: SnapshotStatus;
  diff_completed_at: Date | null;
  events_generated: number;
  error_message: string | null;
}

export interface SnapshotCandidate {
  id: string;
  snapshot_id: string;
  organization_id: string;
  candidate_id: string;
  req_id: string;
  current_stage: string;
  canonical_stage: CanonicalStage | null;
  disposition: CandidateDisposition | null;
  applied_at: Date | null;
  current_stage_entered_at: Date | null;
  hired_at: Date | null;
  rejected_at: Date | null;
  withdrawn_at: Date | null;
  offer_extended_at: Date | null;
  source_row_number: number | null;
  raw_data: Record<string, unknown> | null;
}

export interface SnapshotRequisition {
  id: string;
  snapshot_id: string;
  organization_id: string;
  req_id: string;
  status: RequisitionStatus | null;
  recruiter_id: string | null;
  hiring_manager_id: string | null;
  opened_at: Date | null;
  closed_at: Date | null;
  source_row_number: number | null;
  raw_data: Record<string, unknown> | null;
}

// ============================================
// SNAPSHOT EVENT TYPES
// ============================================

export type SnapshotEventType =
  | 'STAGE_CHANGE'
  | 'STAGE_REGRESSION'
  | 'DISPOSITION_CHANGE'
  | 'REQ_STATUS_CHANGE'
  | 'CANDIDATE_APPEARED'
  | 'CANDIDATE_DISAPPEARED'
  | 'REQ_APPEARED'
  | 'REQ_DISAPPEARED';

export type EventConfidence = 'high' | 'medium' | 'low' | 'inferred';

export interface SnapshotEvent {
  id: string;
  organization_id: string;
  event_type: SnapshotEventType;
  candidate_id: string | null;
  req_id: string | null;
  from_value: string | null;
  to_value: string | null;
  from_canonical: string | null;
  to_canonical: string | null;
  event_at: Date;
  from_snapshot_id: string | null;
  to_snapshot_id: string;
  from_snapshot_date: Date | null;
  to_snapshot_date: Date;
  confidence: EventConfidence;
  confidence_reasons: string[] | null;
  metadata: Record<string, unknown> | null;
  created_at: Date;
}

// ============================================
// DIFF ALGORITHM TYPES
// ============================================

export interface DiffResult {
  stageChanges: StageChangeEvent[];
  stageRegressions: StageRegressionEvent[];
  dispositionChanges: DispositionChangeEvent[];
  reqStatusChanges: ReqStatusChangeEvent[];
  candidatesAppeared: CandidateAppearedEvent[];
  candidatesDisappeared: CandidateDisappearedEvent[];
  reqsAppeared: ReqAppearedEvent[];
  reqsDisappeared: ReqDisappearedEvent[];
}

interface BaseEvent {
  event_at: Date;
  confidence: EventConfidence;
  confidence_reasons: string[];
}

export interface StageChangeEvent extends BaseEvent {
  candidate_id: string;
  req_id: string;
  from_stage: string;
  to_stage: string;
  from_canonical: CanonicalStage | null;
  to_canonical: CanonicalStage | null;
}

export interface StageRegressionEvent extends StageChangeEvent {
  // Same as StageChangeEvent, but represents backward movement
}

export interface DispositionChangeEvent extends BaseEvent {
  candidate_id: string;
  req_id: string;
  from_disposition: CandidateDisposition | null;
  to_disposition: CandidateDisposition | null;
}

export interface ReqStatusChangeEvent extends BaseEvent {
  req_id: string;
  from_status: RequisitionStatus | null;
  to_status: RequisitionStatus | null;
}

export interface CandidateAppearedEvent {
  candidate_id: string;
  req_id: string;
  current_stage: string;
  canonical_stage: CanonicalStage | null;
  disposition: CandidateDisposition | null;
  event_at: Date;
}

export interface CandidateDisappearedEvent {
  candidate_id: string;
  req_id: string;
  last_stage: string;
  last_canonical_stage: CanonicalStage | null;
  last_disposition: CandidateDisposition | null;
}

export interface ReqAppearedEvent {
  req_id: string;
  status: RequisitionStatus | null;
  event_at: Date;
}

export interface ReqDisappearedEvent {
  req_id: string;
  last_status: RequisitionStatus | null;
}

// ============================================
// DATA COVERAGE / GATING TYPES
// ============================================

export interface DataCoverageFlags {
  // Basic capabilities (always available)
  hasCurrentState: boolean;

  // Snapshot-dependent capabilities
  hasSnapshotHistory: boolean;
  hasTrueDwellTime: boolean;
  hasRegressionDetection: boolean;
  hasSLATracking: boolean;

  // Metadata
  snapshotCount: number;
  daySpan: number;
  oldestSnapshotDate: Date | null;
  newestSnapshotDate: Date | null;

  // Thresholds
  minSnapshotsForDwell: number;
  minDaysSpanForSLA: number;
}

export interface SnapshotSummary {
  id: string;
  snapshot_date: Date;
  snapshot_seq: number;
  candidate_count: number;
  req_count: number;
  events_generated: number;
  status: SnapshotStatus;
  delta_candidates?: number; // Difference from previous snapshot
}

// ============================================
// SERVICE INPUT TYPES
// ============================================

export interface CreateSnapshotInput {
  organization_id: string;
  snapshot_date: Date;
  source_filename?: string;
  source_hash?: string;
  imported_by?: string;
}

export interface SnapshotCandidateInput {
  snapshot_id: string;
  organization_id: string;
  candidate_id: string;
  req_id: string;
  current_stage: string;
  canonical_stage?: CanonicalStage | null;
  disposition?: CandidateDisposition | null;
  applied_at?: Date | null;
  current_stage_entered_at?: Date | null;
  hired_at?: Date | null;
  rejected_at?: Date | null;
  withdrawn_at?: Date | null;
  offer_extended_at?: Date | null;
  source_row_number?: number;
  raw_data?: Record<string, unknown>;
}

export interface SnapshotRequisitionInput {
  snapshot_id: string;
  organization_id: string;
  req_id: string;
  status?: RequisitionStatus | null;
  recruiter_id?: string | null;
  hiring_manager_id?: string | null;
  opened_at?: Date | null;
  closed_at?: Date | null;
  source_row_number?: number;
  raw_data?: Record<string, unknown>;
}

// ============================================
// CONSTANTS
// ============================================

// Canonical stage ordering for snapshot diff (lower index = earlier in funnel)
export const SNAPSHOT_STAGE_ORDER: CanonicalStage[] = [
  CanonicalStage.LEAD,
  CanonicalStage.APPLIED,
  CanonicalStage.SCREEN,
  CanonicalStage.HM_SCREEN,
  CanonicalStage.ONSITE,
  CanonicalStage.FINAL,
  CanonicalStage.OFFER,
  CanonicalStage.HIRED
];

// Terminal stages are not in the funnel
export const SNAPSHOT_TERMINAL_STAGES = new Set<CanonicalStage>([
  CanonicalStage.REJECTED,
  CanonicalStage.WITHDREW
]);

// Performance limits per plan
export const SNAPSHOT_LIMITS = {
  MAX_CANDIDATES_PER_SNAPSHOT: 50000,
  MAX_REQS_PER_SNAPSHOT: 10000,
  MAX_SNAPSHOTS_PER_ORG: 365,
  DIFF_BATCH_SIZE: 500,
  QUERY_PAGE_SIZE: 1000
};
