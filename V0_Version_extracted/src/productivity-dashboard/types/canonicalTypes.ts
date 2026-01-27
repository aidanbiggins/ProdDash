// Canonical Data Layer Types
// Decision-grade data model with full traceability
// IMPORTANT: This models a FIRST-OCCURRENCE event dataset, NOT snapshots

// ===== SOURCE TRACE =====
// Every canonical record must trace back to source

export interface SourceTrace {
  source_file: string;
  source_row_id: number;
  source_column?: string;
  ingested_at: Date;
  raw_value?: string;
}

// ===== CONFIDENCE =====
// Confidence grading for inferred/derived values

export type ConfidenceGrade = 'high' | 'medium' | 'low' | 'inferred';

export interface ConfidenceMetadata {
  grade: ConfidenceGrade;
  reasons: string[];
  inferred_fields: string[];
}

// ===== EVENT PROVENANCE =====
// How did we get this event?

export type EventKind = 'POINT_IN_TIME' | 'SNAPSHOT_DIFF';
export type EventProvenance = 'historical_export' | 'live_webhook' | 'snapshot_comparison';

// ===== CANONICAL REQUISITION =====

export interface ReqCanonical {
  req_id: string;
  req_title: string;
  function: string | null;
  level: string | null;
  job_family: string | null;
  department: string | null;
  location: string | null;
  location_type: string | null;
  hiring_manager_id: string | null;
  hiring_manager_name: string | null;
  recruiter_id: string | null;
  recruiter_name: string | null;
  status: 'Open' | 'Closed' | 'On Hold' | 'Cancelled';
  opened_at: Date | null;  // NULL if not in CSV - never fabricate
  closed_at: Date | null;  // NULL if not in CSV - never fabricate

  // Traceability
  source_trace: SourceTrace;
  confidence: ConfidenceMetadata;

  // Computed flags - only from real data
  is_reopened: boolean;
  reopen_count: number;
  last_activity_at: Date | null;  // NULL if no timestamps found
}

// ===== CANONICAL CANDIDATE =====

export interface CandidateCanonical {
  candidate_id: string;
  name: string | null;
  email: string | null;
  source: string;
  source_category: string; // Normalized category (Inbound, Sourced, Referral, etc.)

  // Traceability
  source_trace: SourceTrace;
  confidence: ConfidenceMetadata;
}

// ===== CANONICAL APPLICATION =====
// Candidate + Req combination (the primary fact table)

export interface ApplicationCanonical {
  application_id: string; // candidate_id + req_id
  candidate_id: string;
  req_id: string;

  // Status
  current_stage: string;
  current_stage_canonical: string; // Mapped to canonical stage
  disposition: 'Active' | 'Hired' | 'Rejected' | 'Withdrawn';
  is_terminal: boolean;

  // Timestamps - ALL NULL if not in CSV, NEVER fabricated
  applied_at: Date | null;
  first_contacted_at: Date | null;
  current_stage_entered_at: Date | null;
  hired_at: Date | null;        // Only from "Hire/Rehire Date"
  offer_sent_at: Date | null;   // Only from "Date First Interviewed: Offer Letter"
  rejected_at: Date | null;
  withdrawn_at: Date | null;

  // Stage history - only stages with REAL timestamps from CSV
  stage_timestamps: Record<string, Date>;

  // Traceability
  source_trace: SourceTrace;
  confidence: ConfidenceMetadata;

  // Data availability flags
  has_event_history: boolean;     // True if we have STAGE_ENTERED events
  event_count: number;            // Number of real events
  missing_timestamps: string[];   // Stages we expect but don't have dates for
}

// ===== CANONICAL EVENT =====
// Models FIRST-OCCURRENCE timestamps from iCIMS export

export type CanonicalEventType =
  | 'STAGE_ENTERED'    // First time candidate entered a stage
  | 'OFFER_SENT'       // Offer letter sent
  | 'HIRED'            // Hire confirmed
  | 'REJECTED'         // Candidate rejected
  | 'WITHDRAWN';       // Candidate withdrew

export interface EventCanonical {
  event_id: string;
  application_id: string;
  candidate_id: string;
  req_id: string;

  // Event data
  event_type: CanonicalEventType;
  stage: string;                    // The stage entered
  stage_canonical: string;          // Mapped to canonical stage
  event_at: Date;                   // REAL timestamp from CSV - never fabricated
  actor_user_id: string | null;

  // Event classification
  event_kind: EventKind;            // 'POINT_IN_TIME' for iCIMS first-occurrence
  event_provenance: EventProvenance; // 'historical_export' for CSV imports
  as_of_date: Date | null;          // NULL for point-in-time (not a snapshot)

  // Traceability
  source_trace: SourceTrace;        // Includes source_column that provided this date
  confidence: ConfidenceMetadata;
}

// ===== METRIC CAPABILITIES =====
// What can we compute with available data?

export interface DataCapabilities {
  // What event types do we have?
  has_point_in_time_events: boolean;
  has_snapshot_diff_events: boolean;

  // What can we compute?
  can_compute_stage_velocity: boolean;      // Time between stages (needs entry times)
  can_compute_days_in_stage: boolean;       // Requires exit times (snapshot diffs)
  can_compute_stage_regression: boolean;    // Requires snapshot diffs
  can_compute_sla_timing: boolean;          // Requires snapshot diffs
  can_compute_friction_heatmap: boolean;    // Requires snapshot diffs
  can_compute_forecasting: boolean;         // Requires snapshot diffs

  // Summary
  available_metrics: string[];
  unavailable_metrics: { metric: string; reason: string }[];
}

// ===== AUDIT LOG =====

export type AuditAction =
  | 'INGEST_FILE'
  | 'DETECT_REPORT_TYPE'
  | 'NORMALIZE_COLUMNS'
  | 'PARSE_DATES'
  | 'MAP_STATUS'
  | 'BUILD_REQ'
  | 'BUILD_CANDIDATE'
  | 'BUILD_APPLICATION'
  | 'BUILD_EVENT'
  | 'DEDUPLICATE'
  | 'MERGE'
  | 'DROP_ROW'
  | 'EMIT_STAGE_ENTERED'
  | 'EMIT_TERMINAL_EVENT';

export interface AuditLogEntry {
  entry_id: string;
  timestamp: Date;
  action: AuditAction;
  entity_type: 'req' | 'candidate' | 'application' | 'event' | 'file';
  entity_id: string | null;

  // Counts
  rows_in: number;
  rows_out: number;
  rows_dropped: number;
  rows_merged: number;

  // Details
  reason_code?: string;
  details?: Record<string, unknown>;
  source_trace?: SourceTrace;
}

// ===== DATA QUALITY REPORT =====

export interface MissingnessStats {
  field: string;
  total_records: number;
  missing_count: number;
  missing_percent: number;
  sample_ids: string[];
}

export interface DuplicateStats {
  entity_type: string;
  duplicate_count: number;
  unique_count: number;
  duplicate_keys: string[];
  resolution: string;
}

export interface OrphanStats {
  entity_type: string;
  orphan_count: number;
  total_count: number;
  orphan_percent: number;
  orphan_ids: string[];
  missing_parent_type: string;
}

export interface UnmappedStatus {
  raw_value: string;
  count: number;
  sample_source_traces: SourceTrace[];
  suggested_mapping?: string;
}

export interface ConfidenceRuleResult {
  rule_name: string;
  rule_description: string;
  passed: boolean;
  affected_count: number;
  total_count: number;
  sample_ids: string[];
}

export interface CanonicalQualityReport {
  generated_at: Date;

  // Summary
  total_files_processed: number;
  total_rows_processed: number;
  total_rows_accepted: number;
  total_rows_dropped: number;

  // Entity counts
  reqs_count: number;
  candidates_count: number;
  applications_count: number;
  events_count: number;

  // Quality metrics
  overall_quality_score: number;

  // Detailed stats
  missingness: MissingnessStats[];
  duplicates: DuplicateStats[];
  orphans: OrphanStats[];
  unmapped_statuses: UnmappedStatus[];
  unmapped_columns: string[];

  // Confidence grading
  confidence_rules: ConfidenceRuleResult[];
  low_confidence_count: number;
  inferred_values_count: number;

  // Data capabilities
  capabilities: DataCapabilities;

  // Warnings
  warnings: string[];
  errors: string[];
}

// ===== METRIC INSPECTOR =====

export interface MetricDefinition {
  name: string;
  description: string;
  formula: string;
  unit: string;
  aggregation: 'count' | 'sum' | 'avg' | 'median' | 'p75' | 'p90';
  requires_event_diffs: boolean;  // True = needs snapshot diffs, not just point-in-time
}

export interface MetricExclusion {
  reason: string;
  count: number;
  sample_ids: string[];
}

export interface MetricResult {
  metric_name: string;
  value: number | null;

  // Definition
  definition: MetricDefinition;

  // Counts
  included_count: number;
  excluded_count: number;
  total_count: number;

  // Exclusions breakdown
  exclusions: MetricExclusion[];

  // Confidence
  confidence_grade: ConfidenceGrade;
  confidence_reasons: string[];
  low_confidence_contribution_percent: number;

  // Data provenance
  event_kind: EventKind | null;
  event_provenance: EventProvenance | null;
  source_columns_used: string[];  // Which CSV columns contributed

  // Traceability
  sample_source_traces: SourceTrace[];

  // Filters applied
  filters_applied: Record<string, unknown>;

  // Computation metadata
  computed_at: Date;
  computation_possible: boolean;
  computation_blocked_reason?: string;
}

// ===== INGESTION RESULT =====

export interface CanonicalIngestionResult {
  success: boolean;

  // Canonical tables
  reqs: ReqCanonical[];
  candidates: CandidateCanonical[];
  applications: ApplicationCanonical[];
  events: EventCanonical[];

  // Data capabilities
  capabilities: DataCapabilities;

  // Audit trail
  audit_log: AuditLogEntry[];

  // Quality report
  quality_report: CanonicalQualityReport;

  // Summary
  stats: {
    files_processed: number;
    total_rows: number;
    processing_time_ms: number;
    report_types_detected: string[];
    events_emitted: number;
    point_in_time_events: number;
    snapshot_diff_events: number;
  };

  // Errors/Warnings
  errors: string[];
  warnings: string[];
}

// ===== CONFIG TYPES =====

export interface ColumnMapping {
  canonical_field: string;
  synonyms: string[];
  required: boolean;
  date_format?: string;
}

export interface StatusMapping {
  raw_status: string;
  canonical_stage: string;
  is_terminal: boolean;
  disposition: string;
  confidence?: ConfidenceGrade;
}

export interface CanonicalLayerConfig {
  column_mappings: Record<string, ColumnMapping>;
  status_mappings: Record<string, StatusMapping>;
  source_mappings: Record<string, string>;
  stage_order: Record<string, number>;
}
