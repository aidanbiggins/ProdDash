// Resilient Import Types
// Types for fail-open import, capability gating, and guidance system
// See docs/plans/RESILIENT_IMPORT_AND_GUIDANCE_V1.md

// ============================================
// ERROR CLASSIFICATION
// ============================================

export type ErrorSeverity = 'fatal' | 'exclude' | 'warning' | 'info';

export interface ImportError {
  code: string;
  severity: ErrorSeverity;
  message: string;
  row?: number;
  column?: string;
  value?: unknown;
  guidance?: string;
}

// Only fatal errors - everything else is warning
export const FATAL_ERRORS = {
  FATAL_FILE_EMPTY: 'File contains no data rows',
  FATAL_FILE_CORRUPTED: 'File is corrupted or unreadable',
  FATAL_NO_IDENTITY: 'Cannot identify records - no ID column and insufficient data for synthesis'
} as const;

// ============================================
// AUDIT LOG
// ============================================

export type AuditEventType =
  // Detection stage
  | 'DETECT_FORMAT'
  | 'DETECT_REPORT_TYPE'
  | 'DETECT_SNAPSHOT_DATE'
  | 'DETECT_ENCODING_CONVERTED'
  // Mapping stage
  | 'MAP_EXACT'
  | 'MAP_SYNONYM'
  | 'MAP_FUZZY'
  | 'MAP_PATTERN'
  | 'MAP_USER_OVERRIDE'
  | 'MAP_UNMAPPED'
  // Parsing stage
  | 'PARSE_SUCCESS'
  | 'PARSE_NULL'
  | 'PARSE_FALLBACK'
  | 'PARSE_FAILED'
  // Repair stage
  | 'REPAIR_APPLIED'
  | 'REPAIR_SKIPPED'
  // Synthesis
  | 'ID_SYNTHESIZED'
  | 'ID_SYNTHESIS_FAILED'
  // Import
  | 'ROW_EXCLUDED'
  | 'IMPORT_COMPLETE';

export interface ImportAuditEntry {
  timestamp: Date;
  type: AuditEventType;
  stage: 'detect' | 'map' | 'parse' | 'repair' | 'canonicalize' | 'import';
  row?: number;
  column?: string;
  details: Record<string, unknown>;
}

export interface ImportAuditLog {
  importId: string;
  startedAt: Date;
  completedAt?: Date;
  sourceFile: string;
  entries: ImportAuditEntry[];
  summary: {
    totalRows: number;
    importedRows: number;
    excludedRows: number;
    warningCount: number;
    repairsApplied: number;
    idsSynthesized: number;
  };
}

// ============================================
// RECORD PROVENANCE & CONFIDENCE
// ============================================

export interface RecordProvenance {
  source_file: string;
  source_row: number;
  source_columns: Record<string, string>;  // canonical -> source column name
  ingested_at: Date;
  import_id: string;
}

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface RecordConfidence {
  overall: ConfidenceLevel;
  id_synthesized: boolean;
  id_synthesis_method?: string;
  repairs_applied: string[];
  null_fields: string[];
  warnings: string[];
}

// ============================================
// ID SYNTHESIS
// ============================================

export interface SynthesisMethod {
  id: string;
  priority: number;
  confidence: ConfidenceLevel;
  description: string;
}

export interface SynthesizedIdResult {
  id: string;
  method: string;
  confidence: ConfidenceLevel;
  inputs: Record<string, unknown>;
}

// ============================================
// COVERAGE METRICS
// ============================================

export interface CoverageMetrics {
  // Import metadata
  importId: string;
  computedAt: Date;

  // Entity counts
  counts: {
    requisitions: number;
    candidates: number;
    events: number;
    users: number;
    snapshots: number;
  };

  // Field coverage (% of records with non-null value)
  fieldCoverage: {
    // Requisitions
    'req.recruiter_id': number;
    'req.hiring_manager_id': number;
    'req.opened_at': number;
    'req.closed_at': number;
    'req.status': number;

    // Candidates
    'cand.applied_at': number;
    'cand.current_stage': number;
    'cand.hired_at': number;
    'cand.rejected_at': number;
    'cand.source': number;
    'cand.name': number;

    // Events
    'event.from_stage': number;
    'event.to_stage': number;
    'event.actor_user_id': number;
    'event.event_at': number;
  };

  // Derived flags
  flags: {
    hasStageEvents: boolean;
    hasTimestamps: boolean;
    hasTerminalTimestamps: boolean;
    hasRecruiterAssignment: boolean;
    hasHMAssignment: boolean;
    hasSourceData: boolean;
    hasMultipleSnapshots: boolean;
    hasCapacityHistory?: boolean;
  };

  // Sample sizes for threshold checks
  sampleSizes: {
    hires: number;
    offers: number;
    rejections: number;
    activeReqs: number;
  };
}

// ============================================
// CAPABILITY REGISTRY
// ============================================

export type CapabilityUIType = 'tab' | 'section' | 'widget' | 'metric';

export interface CapabilityRequirement {
  type: 'field_coverage' | 'flag' | 'count' | 'sample_size';
  field?: keyof CoverageMetrics['fieldCoverage'];
  flag?: keyof CoverageMetrics['flags'];
  countField?: keyof CoverageMetrics['counts'];
  minValue?: number;
  minCount?: number;
}

export interface CapabilityDefinition {
  id: string;
  displayName: string;
  description: string;
  uiType: CapabilityUIType;
  requirements: CapabilityRequirement[];
  whenDisabled: {
    behavior: 'hide' | 'replace';
    replacementComponent?: string;
    message: string;
    upgradeHint?: string;
  };
}

export interface RequirementStatus {
  description: string;
  met: boolean;
  currentValue?: number;
  requiredValue?: number;
}

export interface CapabilityStatus {
  id: string;
  displayName: string;
  description: string;
  uiType: CapabilityUIType;
  enabled: boolean;
  requirements: RequirementStatus[];
  disabledReason?: string;
  upgradeHint?: string;
  behavior: 'hide' | 'replace';
}

// ============================================
// REPAIR SUGGESTIONS
// ============================================

export type SuggestionType =
  | 'map_column'
  | 'set_snapshot_date'
  | 'import_snapshot'
  | 'configure_stages'
  | 'fix_data_quality';

export type CTAActionType =
  | 'open_column_mapper'
  | 'open_snapshot_date_picker'
  | 'open_import_modal'
  | 'open_stage_mapper'
  | 'navigate';

export interface CTAAction {
  type: CTAActionType;
  params?: Record<string, unknown>;
}

export interface CallToAction {
  label: string;
  action: CTAAction;
}

export type EffortLevel = 'one-click' | 'quick' | 'moderate';

export interface RepairSuggestion {
  id: string;
  type: SuggestionType;
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  impact: string;
  cta: CallToAction;
  estimatedEffort: EffortLevel;
  affectedCapabilities: string[];
  currentState?: unknown;
  targetState?: unknown;
}

// ============================================
// IMPORT RESULT
// ============================================

export interface ImportResult {
  success: boolean;
  fatal?: boolean;
  fatalError?: string;

  // Import stats
  totalRows: number;
  importedRows: number;
  excludedRows: number;
  warnings: ImportError[];

  // Metadata
  reportType?: string;
  snapshotDate?: Date;
  snapshotDateSource?: 'filename' | 'file_modified' | 'user_specified' | 'import_date';

  // For guidance
  unmappedColumns: string[];
  unmappedStages: string[];

  // Audit trail
  auditLog: ImportAuditLog;

  // Coverage computed after import
  coverage?: CoverageMetrics;

  // Suggestions for improvement
  suggestions?: RepairSuggestion[];
}

// ============================================
// SNAPSHOT DATE INFERENCE
// ============================================

export interface SnapshotDateInference {
  date: Date;
  source: 'filename' | 'file_modified' | 'user_specified' | 'import_date';
  confidence: ConfidenceLevel;
}

// ============================================
// UI STATE
// ============================================

export interface CapabilitiesSummaryState {
  enabledCount: number;
  totalCount: number;
  enabledFeatures: string[];
  partialFeatures: Array<{ name: string; coverage: number }>;
  disabledFeatures: Array<{ name: string; upgradeHint: string }>;
  topSuggestions: RepairSuggestion[];
}
