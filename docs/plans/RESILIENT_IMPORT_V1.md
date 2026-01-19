# Resilient Import & Capability Engine Plan

**Version:** 1.0
**Status:** Draft
**Author:** Claude
**Date:** 2026-01-18

---

## Executive Summary

ProdDash must ingest messy CSV/XLS/XLSX data from various ATS systems without punishing users for data quality issues. This plan defines a self-healing import pipeline that repairs data when possible, logs all repairs for auditability, and enables/disables dashboard features based on measured data coverage.

**Core Principles:**
1. **Never block on non-fatal errors** - Import what we can, warn about what we can't
2. **Self-heal when possible** - Auto-fix common issues (date formats, missing values, encoding)
3. **Full auditability** - Every repair, inference, and exclusion is logged
4. **Capability gating** - Features are enabled/disabled based on data coverage, not all-or-nothing
5. **Snapshot-first** - Mega reports are treated as point-in-time snapshots powering diffs

---

## 1. Healing Pipeline Architecture

### 1.1 Pipeline Stages

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           RESILIENT IMPORT PIPELINE                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐  │
│  │  DETECT  │ → │   MAP    │ → │  PARSE   │ → │  REPAIR  │ → │CANONICAL │  │
│  │          │   │          │   │          │   │          │   │   IZE    │  │
│  └──────────┘   └──────────┘   └──────────┘   └──────────┘   └──────────┘  │
│       │              │              │              │              │         │
│       ▼              ▼              ▼              ▼              ▼         │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                         AUDIT LOG (append-only)                       │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                      │                                      │
│                                      ▼                                      │
│                            ┌──────────────────┐                             │
│                            │ CAPABILITY ENGINE │                            │
│                            │  (coverage check) │                            │
│                            └──────────────────┘                             │
│                                      │                                      │
│                                      ▼                                      │
│                            ┌──────────────────┐                             │
│                            │ SNAPSHOT STORAGE │                             │
│                            │   (if enabled)   │                             │
│                            └──────────────────┘                             │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Stage Definitions

#### Stage 1: DETECT
**Purpose:** Identify file format, encoding, and report type

**Inputs:**
- Raw file (CSV, XLS, XLSX)
- Filename (for heuristics)

**Outputs:**
- `fileFormat`: 'csv' | 'xls' | 'xlsx'
- `encoding`: 'utf-8' | 'utf-16' | 'windows-1252' | 'iso-8859-1'
- `reportType`: 'icims_universal' | 'icims_submittal' | 'icims_requisition' | 'greenhouse' | 'lever' | 'workday' | 'generic'
- `detectedSheet`: string (for Excel files)
- `rowCount`: number
- `columnHeaders`: string[]

**Detection Rules:**
```typescript
interface DetectionResult {
  fileFormat: FileFormat;
  encoding: string;
  reportType: ReportType;
  detectedSheet?: string;
  rowCount: number;
  columnHeaders: string[];
  confidence: 'high' | 'medium' | 'low';
  detectionReasons: string[];
}

// Report type detection by column signature
const REPORT_SIGNATURES: Record<ReportType, string[][]> = {
  'icims_universal': [
    ['Job ID', 'Person ID', 'Workflow', 'Status'],
    ['Req ID', 'Candidate ID', 'Current Status']
  ],
  'icims_submittal': [
    ['Person ID', 'Person: Name', 'Job ID', 'Submittal Status']
  ],
  'greenhouse': [
    ['Application ID', 'Candidate ID', 'Job ID', 'Current Stage']
  ],
  'lever': [
    ['Opportunity ID', 'Candidate', 'Posting', 'Stage']
  ],
  // ... more signatures
};
```

**Audit Events:**
- `DETECTION_COMPLETE`: File format and type identified
- `DETECTION_FALLBACK`: Used generic parser due to low confidence
- `ENCODING_CONVERTED`: File encoding was converted

---

#### Stage 2: MAP
**Purpose:** Map source columns to canonical schema using config + heuristics

**Inputs:**
- Column headers from DETECT
- `column_map.yaml` configuration
- User-provided overrides (optional)

**Outputs:**
- `columnMappings`: Map<sourceColumn, canonicalField>
- `unmappedColumns`: string[]
- `ambiguousMappings`: { source: string, candidates: string[] }[]

**Mapping Strategy:**
1. **Exact match** against `column_map.yaml` known names
2. **Synonym match** against configured synonyms
3. **Fuzzy match** with Levenshtein distance < 3
4. **Pattern match** using regex patterns (e.g., `/date.*open/i` → `opened_at`)
5. **User override** takes precedence over all

**Configuration Schema (column_map.yaml):**
```yaml
version: "1.0"

fields:
  req_id:
    canonical_name: req_id
    required: true
    type: string
    synonyms:
      - "Job ID"
      - "Req ID"
      - "Requisition ID"
      - "Job Number"
      - "Position ID"
    patterns:
      - "^(job|req|requisition).*id$"
      - "^position.*number$"

  candidate_id:
    canonical_name: candidate_id
    required: true
    type: string
    synonyms:
      - "Person ID"
      - "Candidate ID"
      - "Applicant ID"
    patterns:
      - "^(person|candidate|applicant).*id$"

  applied_at:
    canonical_name: applied_at
    required: false  # NOT required - becomes warning
    type: datetime
    synonyms:
      - "Applied Date"
      - "Application Date"
      - "Date Applied"
      - "Submit Date"
    patterns:
      - "^(applied|application|submit).*date$"
    fallback_inference:
      - source: "created_at"
        confidence: "medium"
      - source: "first_event_date"
        confidence: "low"

  # ... more fields
```

**Audit Events:**
- `COLUMN_MAPPED`: Source column mapped to canonical field
- `COLUMN_UNMAPPED`: Source column could not be mapped (warning)
- `COLUMN_AMBIGUOUS`: Multiple possible mappings, chose best
- `MAPPING_OVERRIDE`: User override applied

---

#### Stage 3: PARSE
**Purpose:** Parse raw values into typed values, collecting errors

**Inputs:**
- Raw row data
- Column mappings from MAP stage
- Type definitions from schema

**Outputs:**
- Parsed records with typed values
- Parse errors per field per row

**Parsing Rules by Type:**

```typescript
interface ParseRule {
  type: FieldType;
  parsers: Parser[];
  fallbackValue: any;
  nullValues: string[];
}

const PARSE_RULES: Record<FieldType, ParseRule> = {
  datetime: {
    type: 'datetime',
    parsers: [
      // ISO 8601
      (v) => parseISO(v),
      // US format
      (v) => parse(v, 'MM/dd/yyyy', new Date()),
      (v) => parse(v, 'M/d/yyyy', new Date()),
      // European format
      (v) => parse(v, 'dd/MM/yyyy', new Date()),
      // Excel serial date
      (v) => excelSerialToDate(Number(v)),
      // Natural language
      (v) => chrono.parseDate(v),
    ],
    fallbackValue: null,
    nullValues: ['', 'N/A', 'null', 'NULL', '-', 'n/a', 'NA', 'None']
  },

  string: {
    type: 'string',
    parsers: [(v) => String(v).trim()],
    fallbackValue: '',
    nullValues: ['', 'N/A', 'null', 'NULL', '-']
  },

  number: {
    type: 'number',
    parsers: [
      (v) => Number(v),
      (v) => Number(v.replace(/[,$]/g, '')),  // Handle currency/commas
    ],
    fallbackValue: null,
    nullValues: ['', 'N/A', 'null', '-']
  },

  // ... more types
};
```

**Audit Events:**
- `PARSE_SUCCESS`: Value parsed successfully
- `PARSE_FALLBACK`: Used fallback parser (not primary)
- `PARSE_NULL`: Value was null/empty
- `PARSE_ERROR`: Could not parse value (non-fatal)

---

#### Stage 4: REPAIR
**Purpose:** Auto-fix common data issues, log all repairs

**Inputs:**
- Parsed records with potential issues
- Repair rules configuration

**Outputs:**
- Repaired records
- Repair log

**Repair Strategies:**

```typescript
interface RepairStrategy {
  id: string;
  description: string;
  condition: (record: any, field: string) => boolean;
  repair: (record: any, field: string, context: RepairContext) => any;
  confidence: 'high' | 'medium' | 'low';
}

const REPAIR_STRATEGIES: RepairStrategy[] = [
  {
    id: 'INFER_APPLIED_DATE_FROM_FIRST_EVENT',
    description: 'Infer applied_at from earliest event timestamp',
    condition: (r, f) => f === 'applied_at' && !r.applied_at && r.events?.length > 0,
    repair: (r, f, ctx) => {
      const earliest = minBy(r.events, e => e.event_at);
      return earliest?.event_at;
    },
    confidence: 'medium'
  },

  {
    id: 'INFER_HIRED_DATE_FROM_DISPOSITION',
    description: 'Infer hired_at from disposition change to Hired',
    condition: (r, f) => f === 'hired_at' && !r.hired_at && r.disposition === 'Hired',
    repair: (r, f, ctx) => {
      const hireEvent = r.events?.find(e => e.to_stage === 'HIRED');
      return hireEvent?.event_at || null;  // null if can't infer
    },
    confidence: 'low'
  },

  {
    id: 'NORMALIZE_STAGE_NAME',
    description: 'Normalize stage name to canonical form',
    condition: (r, f) => f === 'current_stage' && r.current_stage,
    repair: (r, f, ctx) => {
      return ctx.stageMapping.normalize(r.current_stage);
    },
    confidence: 'high'
  },

  {
    id: 'DEDUPE_CANDIDATE_ID',
    description: 'Generate unique candidate ID when duplicate detected',
    condition: (r, f) => f === 'candidate_id' && ctx.isDuplicate(r.candidate_id),
    repair: (r, f, ctx) => {
      return `${r.candidate_id}_${r.req_id}`;  // Make composite key
    },
    confidence: 'high'
  },

  {
    id: 'FIX_FUTURE_DATE',
    description: 'Cap future dates at import date',
    condition: (r, f) => isDateField(f) && r[f] > new Date(),
    repair: (r, f, ctx) => {
      return ctx.importDate;  // Cap at import date
    },
    confidence: 'medium'
  },

  // ... more strategies
];
```

**Audit Events:**
- `REPAIR_APPLIED`: Repair strategy applied successfully
- `REPAIR_SKIPPED`: Repair condition not met
- `REPAIR_FAILED`: Repair attempted but failed

---

#### Stage 5: CANONICALIZE
**Purpose:** Transform repaired data into canonical schema for storage

**Inputs:**
- Repaired records
- Canonical schema definition

**Outputs:**
- Canonical records ready for storage
- Validation results

**Canonical Schema:**

```typescript
interface CanonicalRequisition {
  req_id: string;           // Required
  req_title: string;        // Required
  recruiter_id: string | null;
  hiring_manager_id: string | null;
  status: ReqStatus;
  opened_at: Date | null;
  closed_at: Date | null;
  // ... metadata
  _source_trace: SourceTrace;
  _confidence: ConfidenceMetadata;
}

interface CanonicalCandidate {
  candidate_id: string;     // Required
  name: string | null;      // NOT required - masked data OK
  req_id: string;           // Required
  current_stage: CanonicalStage;
  applied_at: Date | null;  // NOT required - warning only
  // ... timestamps
  _source_trace: SourceTrace;
  _confidence: ConfidenceMetadata;
}

interface SourceTrace {
  source_file: string;
  source_row: number;
  source_columns: Record<string, string>;
  ingested_at: Date;
}

interface ConfidenceMetadata {
  grade: 'high' | 'medium' | 'low' | 'inferred';
  reasons: string[];
  inferred_fields: string[];
  repairs_applied: string[];
}
```

**Audit Events:**
- `CANONICALIZE_SUCCESS`: Record canonicalized successfully
- `CANONICALIZE_PARTIAL`: Record canonicalized with missing optional fields
- `CANONICALIZE_EXCLUDED`: Record excluded (fatal validation error)

---

### 1.3 Audit Log Schema

```typescript
interface AuditLogEntry {
  id: string;                    // UUID
  import_id: string;             // Links to import session
  timestamp: Date;
  stage: PipelineStage;
  event_type: AuditEventType;
  severity: 'info' | 'warning' | 'error';

  // Context
  source_file: string;
  source_row?: number;
  source_column?: string;

  // Details
  message: string;
  details: Record<string, any>;

  // For repairs
  original_value?: any;
  repaired_value?: any;
  repair_strategy?: string;
  confidence?: string;
}

// Queryable audit summary
interface ImportAuditSummary {
  import_id: string;
  total_rows_input: number;
  total_rows_output: number;
  rows_excluded: number;

  repairs_applied: number;
  repairs_by_strategy: Record<string, number>;

  warnings: number;
  warnings_by_type: Record<string, number>;

  errors: number;
  errors_by_type: Record<string, number>;

  coverage_metrics: CoverageMetrics;
}
```

---

## 2. Fatal vs Non-Fatal Error Classification

### 2.1 Philosophy

**Default stance: NON-FATAL**

Most data issues should result in warnings, not import failures. Users should be able to import partial data and see which features are affected.

### 2.2 Error Classification

```typescript
enum ErrorSeverity {
  FATAL = 'fatal',         // Blocks import entirely
  EXCLUSION = 'exclusion', // Excludes this row, continues import
  WARNING = 'warning',     // Logs warning, includes row with degraded data
  INFO = 'info'            // Informational only
}

interface ErrorClassification {
  code: string;
  defaultSeverity: ErrorSeverity;
  canOverride: boolean;
  description: string;
}

const ERROR_CLASSIFICATIONS: ErrorClassification[] = [
  // FATAL - Cannot proceed at all
  {
    code: 'NO_DATA_ROWS',
    defaultSeverity: 'fatal',
    canOverride: false,
    description: 'File contains no data rows'
  },
  {
    code: 'NO_REQ_ID_COLUMN',
    defaultSeverity: 'fatal',
    canOverride: false,
    description: 'Cannot identify requisition ID column'
  },
  {
    code: 'FILE_CORRUPTED',
    defaultSeverity: 'fatal',
    canOverride: false,
    description: 'File is corrupted or unreadable'
  },

  // EXCLUSION - Row is dropped but import continues
  {
    code: 'MISSING_REQ_ID',
    defaultSeverity: 'exclusion',
    canOverride: true,
    description: 'Row missing required req_id'
  },
  {
    code: 'DUPLICATE_PRIMARY_KEY',
    defaultSeverity: 'exclusion',
    canOverride: true,
    description: 'Duplicate candidate_id + req_id combination'
  },

  // WARNING - Row included with degraded data
  {
    code: 'MISSING_APPLIED_DATE',
    defaultSeverity: 'warning',
    canOverride: false,
    description: 'Applied date missing - TTF metrics unavailable for this candidate'
  },
  {
    code: 'MISSING_CANDIDATE_NAME',
    defaultSeverity: 'warning',
    canOverride: false,
    description: 'Candidate name missing - will display as "Unknown"'
  },
  {
    code: 'UNPARSEABLE_DATE',
    defaultSeverity: 'warning',
    canOverride: false,
    description: 'Date could not be parsed - field set to null'
  },
  {
    code: 'UNKNOWN_STAGE',
    defaultSeverity: 'warning',
    canOverride: false,
    description: 'Stage name not recognized - mapped to UNKNOWN'
  },
  {
    code: 'FUTURE_DATE_CAPPED',
    defaultSeverity: 'warning',
    canOverride: false,
    description: 'Future date detected and capped to import date'
  },

  // INFO - Just logging
  {
    code: 'VALUE_INFERRED',
    defaultSeverity: 'info',
    canOverride: false,
    description: 'Value inferred from other data'
  },
  {
    code: 'COLUMN_UNMAPPED',
    defaultSeverity: 'info',
    canOverride: false,
    description: 'Column not mapped to any canonical field'
  },
];
```

### 2.3 User Override Rules

Users can override certain error severities in the import UI:

```typescript
interface ImportOptions {
  // Downgrade exclusions to warnings (include bad rows)
  includeInvalidRows: boolean;

  // Specific overrides
  overrides: {
    [errorCode: string]: ErrorSeverity;
  };

  // Stop after N exclusions (safety valve)
  maxExclusions: number;  // Default: unlimited

  // Stop after N warnings (safety valve)
  maxWarnings: number;    // Default: unlimited
}
```

---

## 3. Capability Engine

### 3.1 Purpose

The Capability Engine measures data coverage and gates features accordingly. Instead of all-or-nothing imports, features are individually enabled/disabled based on whether sufficient data exists.

### 3.2 Coverage Metrics Schema

```typescript
interface CoverageMetrics {
  // Computed after import
  import_id: string;
  computed_at: Date;

  // Entity counts
  total_requisitions: number;
  total_candidates: number;
  total_events: number;
  total_users: number;

  // Field coverage (percentage of non-null values)
  field_coverage: {
    // Requisitions
    'req.recruiter_id': number;      // 0.0 - 1.0
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

    // Events
    'event.from_stage': number;
    'event.to_stage': number;
    'event.actor_user_id': number;
  };

  // Derived capabilities
  has_stage_events: boolean;          // Events have from_stage/to_stage
  has_timestamps: boolean;            // Candidates have applied_at
  has_terminal_timestamps: boolean;   // Candidates have hired_at/rejected_at
  has_recruiter_assignment: boolean;  // Reqs have recruiter_id
  has_hm_assignment: boolean;         // Reqs have hiring_manager_id
  has_source_data: boolean;           // Candidates have source

  // Confidence grade
  overall_grade: 'high' | 'medium' | 'low' | 'minimal';
}
```

### 3.3 Capability Gating Rules

```typescript
interface CapabilityRule {
  capability_id: string;
  display_name: string;
  description: string;

  // Gating conditions (ALL must be met)
  requirements: CapabilityRequirement[];

  // What happens when not met
  fallback_behavior: 'hide' | 'disable' | 'show_warning';
  fallback_message: string;
}

interface CapabilityRequirement {
  type: 'field_coverage' | 'entity_count' | 'boolean_flag' | 'min_sample';
  field?: string;
  min_value?: number;
  flag?: string;
}

const CAPABILITY_RULES: CapabilityRule[] = [
  // Time-to-Fill metrics
  {
    capability_id: 'ttf_metrics',
    display_name: 'Time-to-Fill Metrics',
    description: 'Calculate days from application to hire',
    requirements: [
      { type: 'field_coverage', field: 'cand.applied_at', min_value: 0.5 },
      { type: 'field_coverage', field: 'cand.hired_at', min_value: 0.1 },
      { type: 'min_sample', field: 'hires', min_value: 5 }
    ],
    fallback_behavior: 'show_warning',
    fallback_message: 'TTF metrics require applied dates (50%+ coverage) and at least 5 hires with hire dates'
  },

  // HM Friction tab
  {
    capability_id: 'hm_friction',
    display_name: 'HM Friction Analysis',
    description: 'Track hiring manager responsiveness',
    requirements: [
      { type: 'boolean_flag', flag: 'has_hm_assignment' },
      { type: 'boolean_flag', flag: 'has_stage_events' },
      { type: 'entity_count', field: 'events', min_value: 100 }
    ],
    fallback_behavior: 'disable',
    fallback_message: 'HM Friction requires hiring manager assignments and stage change events'
  },

  // Velocity Insights
  {
    capability_id: 'velocity_insights',
    display_name: 'Velocity Insights',
    description: 'Analyze pipeline velocity and decay',
    requirements: [
      { type: 'field_coverage', field: 'cand.applied_at', min_value: 0.7 },
      { type: 'boolean_flag', flag: 'has_stage_events' },
      { type: 'min_sample', field: 'candidates', min_value: 50 }
    ],
    fallback_behavior: 'show_warning',
    fallback_message: 'Velocity Insights requires 70%+ applied date coverage and stage events'
  },

  // Source Effectiveness
  {
    capability_id: 'source_effectiveness',
    display_name: 'Source Effectiveness',
    description: 'Compare candidate sources by conversion',
    requirements: [
      { type: 'boolean_flag', flag: 'has_source_data' },
      { type: 'field_coverage', field: 'cand.source', min_value: 0.5 }
    ],
    fallback_behavior: 'hide',
    fallback_message: 'Source Effectiveness requires source data for 50%+ of candidates'
  },

  // Bottlenecks & SLAs
  {
    capability_id: 'bottlenecks_sla',
    display_name: 'Bottlenecks & SLA Tracking',
    description: 'Track stage durations and SLA violations',
    requirements: [
      { type: 'boolean_flag', flag: 'has_stage_events' },
      { type: 'field_coverage', field: 'event.from_stage', min_value: 0.8 },
      { type: 'field_coverage', field: 'event.to_stage', min_value: 0.8 }
    ],
    fallback_behavior: 'disable',
    fallback_message: 'Bottlenecks requires stage transition events with from/to stages'
  },

  // Snapshot Diff / Trends
  {
    capability_id: 'snapshot_trends',
    display_name: 'Historical Trends',
    description: 'Compare metrics across snapshots',
    requirements: [
      { type: 'entity_count', field: 'snapshots', min_value: 2 }
    ],
    fallback_behavior: 'hide',
    fallback_message: 'Historical Trends requires at least 2 data snapshots'
  },

  // ... more capabilities
];
```

### 3.4 Capability Engine API

```typescript
interface CapabilityEngine {
  // Check single capability
  isEnabled(capabilityId: string): boolean;

  // Get capability status with details
  getStatus(capabilityId: string): CapabilityStatus;

  // Get all capabilities for UI
  getAllCapabilities(): CapabilityStatus[];

  // Get capabilities for a specific tab
  getTabCapabilities(tabId: string): CapabilityStatus[];

  // Refresh after import
  refresh(coverageMetrics: CoverageMetrics): void;
}

interface CapabilityStatus {
  capability_id: string;
  display_name: string;
  enabled: boolean;

  // Why enabled/disabled
  requirements_met: RequirementStatus[];

  // User-facing message
  status_message: string;

  // For UI display
  coverage_percentage?: number;
  missing_data?: string[];
}
```

---

## 4. Snapshot Ingestion Rules

### 4.1 Snapshot Detection

When a file is imported, determine if it should create a new snapshot:

```typescript
interface SnapshotDetectionResult {
  should_create_snapshot: boolean;
  snapshot_date: Date;
  snapshot_reason: SnapshotReason;
}

enum SnapshotReason {
  EXPLICIT_DATE = 'explicit_date',       // User specified date
  FILENAME_DATE = 'filename_date',       // Parsed from filename
  MODIFIED_DATE = 'modified_date',       // File modification date
  IMPORT_DATE = 'import_date',           // Default to today
  WEEKLY_REPORT = 'weekly_report'        // Detected as recurring report
}

function detectSnapshotDate(file: File, options: ImportOptions): SnapshotDetectionResult {
  // 1. User explicitly provided date
  if (options.snapshotDate) {
    return {
      should_create_snapshot: true,
      snapshot_date: options.snapshotDate,
      snapshot_reason: 'explicit_date'
    };
  }

  // 2. Parse from filename patterns
  const filenamePatterns = [
    /(\d{4}-\d{2}-\d{2})/,                    // 2026-01-18
    /(\d{2}-\d{2}-\d{4})/,                    // 01-18-2026
    /(\d{8})/,                                 // 20260118
    /week[_-]?of[_-]?(\d{4}-\d{2}-\d{2})/i,  // week_of_2026-01-18
    /(\w+[_-]\d{1,2}[_-]\d{4})/,              // Jan_18_2026
  ];

  for (const pattern of filenamePatterns) {
    const match = file.name.match(pattern);
    if (match) {
      const parsed = parseDate(match[1]);
      if (parsed && isValid(parsed)) {
        return {
          should_create_snapshot: true,
          snapshot_date: parsed,
          snapshot_reason: 'filename_date'
        };
      }
    }
  }

  // 3. Use file modification date if available
  if (file.lastModified) {
    const modDate = new Date(file.lastModified);
    if (isWithinLastWeek(modDate)) {
      return {
        should_create_snapshot: true,
        snapshot_date: modDate,
        snapshot_reason: 'modified_date'
      };
    }
  }

  // 4. Default to import date
  return {
    should_create_snapshot: true,
    snapshot_date: new Date(),
    snapshot_reason: 'import_date'
  };
}
```

### 4.2 Snapshot Storage

```typescript
interface DataSnapshot {
  id: string;
  organization_id: string;
  snapshot_date: Date;
  snapshot_seq: number;           // Sequential number within org

  // Source metadata
  source_filename: string;
  source_hash: string;            // SHA-256 of file content

  // Import metadata
  imported_at: Date;
  imported_by: string;
  import_options: ImportOptions;

  // Counts
  req_count: number;
  candidate_count: number;
  event_count: number;
  user_count: number;

  // Status
  status: 'pending' | 'processing' | 'completed' | 'failed';

  // Diff status
  diff_completed_at: Date | null;
  events_generated: number;
}
```

### 4.3 Diff Generation

After snapshot storage, generate diff events:

```typescript
interface SnapshotDiffConfig {
  // What to compare
  compare_fields: {
    candidates: string[];   // ['current_stage', 'disposition', 'recruiter_id']
    requisitions: string[]; // ['status', 'recruiter_id', 'hiring_manager_id']
  };

  // Event generation
  generate_events: boolean;
  event_confidence: 'high' | 'medium';  // Diff events are 'medium' confidence

  // Deduplication
  dedupe_window_hours: number;  // Skip if identical event within N hours
}

interface DiffResult {
  from_snapshot_id: string;
  to_snapshot_id: string;

  // Changes detected
  candidates_added: number;
  candidates_removed: number;
  candidates_changed: number;

  reqs_added: number;
  reqs_removed: number;
  reqs_changed: number;

  // Events generated
  events_created: SnapshotEvent[];
}

// Diff algorithm
async function computeSnapshotDiff(
  fromSnapshot: DataSnapshot,
  toSnapshot: DataSnapshot,
  config: SnapshotDiffConfig
): Promise<DiffResult> {
  // 1. Load candidate data from both snapshots
  const fromCandidates = await loadSnapshotCandidates(fromSnapshot.id);
  const toCandidates = await loadSnapshotCandidates(toSnapshot.id);

  // 2. Index by primary key
  const fromIndex = keyBy(fromCandidates, c => `${c.candidate_id}:${c.req_id}`);
  const toIndex = keyBy(toCandidates, c => `${c.candidate_id}:${c.req_id}`);

  // 3. Find changes
  const events: SnapshotEvent[] = [];

  for (const [key, toCandidate] of Object.entries(toIndex)) {
    const fromCandidate = fromIndex[key];

    if (!fromCandidate) {
      // New candidate appeared
      events.push({
        event_type: 'CANDIDATE_APPEARED',
        candidate_id: toCandidate.candidate_id,
        req_id: toCandidate.req_id,
        to_value: toCandidate.current_stage,
        event_at: toSnapshot.snapshot_date,
        confidence: 'medium'
      });
      continue;
    }

    // Check for stage change
    if (fromCandidate.current_stage !== toCandidate.current_stage) {
      events.push({
        event_type: 'STAGE_CHANGE',
        candidate_id: toCandidate.candidate_id,
        req_id: toCandidate.req_id,
        from_value: fromCandidate.current_stage,
        to_value: toCandidate.current_stage,
        event_at: toSnapshot.snapshot_date,
        confidence: 'medium'
      });
    }

    // Check for disposition change
    if (fromCandidate.disposition !== toCandidate.disposition) {
      events.push({
        event_type: 'DISPOSITION_CHANGE',
        candidate_id: toCandidate.candidate_id,
        req_id: toCandidate.req_id,
        from_value: fromCandidate.disposition,
        to_value: toCandidate.disposition,
        event_at: toSnapshot.snapshot_date,
        confidence: 'medium'
      });
    }
  }

  // 4. Find removed candidates
  for (const [key, fromCandidate] of Object.entries(fromIndex)) {
    if (!toIndex[key]) {
      events.push({
        event_type: 'CANDIDATE_DISAPPEARED',
        candidate_id: fromCandidate.candidate_id,
        req_id: fromCandidate.req_id,
        from_value: fromCandidate.current_stage,
        event_at: toSnapshot.snapshot_date,
        confidence: 'low'  // Disappearance is uncertain
      });
    }
  }

  return {
    from_snapshot_id: fromSnapshot.id,
    to_snapshot_id: toSnapshot.id,
    candidates_added: events.filter(e => e.event_type === 'CANDIDATE_APPEARED').length,
    candidates_removed: events.filter(e => e.event_type === 'CANDIDATE_DISAPPEARED').length,
    candidates_changed: events.filter(e => e.event_type === 'STAGE_CHANGE').length,
    reqs_added: 0,  // TODO: implement req diff
    reqs_removed: 0,
    reqs_changed: 0,
    events_created: events
  };
}
```

---

## 5. Import UX Flow

### 5.1 Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            IMPORT UX FLOW                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐  │
│  │  SELECT  │ → │  PREVIEW │ → │ WARNINGS │ → │  IMPORT  │ → │ SUMMARY  │  │
│  │  FILES   │   │  & MAP   │   │  REVIEW  │   │ PROGRESS │   │ & AUDIT  │  │
│  └──────────┘   └──────────┘   └──────────┘   └──────────┘   └──────────┘  │
│       │              │              │              │              │         │
│       │              │              │              │              │         │
│  - Drag/drop    - Auto-detect   - Show all      - Stage        - Rows      │
│  - Browse       - Column map     warnings       progress       imported   │
│  - CSV/XLS/XLSX - Preview rows  - Fatal vs     - Repairs      - Warnings  │
│                 - Edit mapping   non-fatal      happening     - Errors    │
│                 - Snapshot date - Override     - Audit log    - Coverage  │
│                                  options        building      - Features  │
│                                - "Import                        enabled   │
│                                  Anyway"                                  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 Screen 1: File Selection

**Components:**
- Drag-and-drop zone
- File browser button
- Supported formats indicator (CSV, XLS, XLSX)
- Recent imports list (optional)

**Actions:**
- Select file(s) → Proceed to Preview

### 5.3 Screen 2: Preview & Mapping

**Components:**
- Detected file info (format, rows, columns)
- Auto-detected report type with confidence
- Column mapping table:
  ```
  | Source Column     | → | Canonical Field    | Status    |
  |-------------------|---|-------------------|-----------|
  | Job ID            | → | req_id            | ✓ Mapped  |
  | Person ID         | → | candidate_id      | ✓ Mapped  |
  | Applied Date      | → | applied_at        | ✓ Mapped  |
  | Custom Field 1    | → | (unmapped)        | ⚠ Skipped |
  | Wrkflw Status     | → | current_stage     | ✓ Fuzzy   |
  ```
- Data preview table (first 10 rows)
- Snapshot date picker with auto-detected default

**Actions:**
- Edit column mappings (dropdown to change target field)
- Mark column as "ignore"
- Adjust snapshot date
- Proceed to Warnings Review

### 5.4 Screen 3: Warnings Review

**Components:**
- Summary cards:
  ```
  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
  │  ✓ 1,247 Rows   │  │  ⚠ 23 Warnings  │  │  ✗ 5 Excluded   │
  │    to import    │  │    (see below)  │  │    (see below)  │
  └─────────────────┘  └─────────────────┘  └─────────────────┘
  ```
- Warnings list (grouped by type):
  ```
  ⚠ Missing Applied Date (18 candidates)
    → These candidates won't appear in TTF metrics
    [View affected rows] [Exclude these rows instead]

  ⚠ Unknown Stage Names (5 candidates)
    → Mapped to "UNKNOWN" stage: "Phone Scrn", "Tech Int 2"
    [Map these stages] [Keep as UNKNOWN]

  ⚠ Future Dates Detected (2 rows)
    → Dates capped to today: row 45, row 892
    [View details]
  ```
- Exclusions list:
  ```
  ✗ Missing Requisition ID (3 rows)
    → Rows 12, 456, 789 have no Job ID
    [Include anyway with generated ID] [Keep excluded]

  ✗ Duplicate Candidate (2 rows)
    → Same person_id + job_id appears twice
    [Keep first occurrence] [Keep last occurrence]
  ```
- Feature impact preview:
  ```
  Based on this data:
  ✓ Overview Tab - Full functionality
  ✓ Recruiter Detail - Full functionality
  ⚠ Time-to-Fill - 82% coverage (18 candidates missing dates)
  ⚠ HM Friction - Limited (only 60% of reqs have HM assigned)
  ✗ Source Effectiveness - Disabled (no source data)
  ```

**Actions:**
- Expand warning groups to see affected rows
- Override exclusions (include anyway)
- Map unknown stages inline
- **"Import Anyway"** button - proceeds despite warnings
- **"Cancel"** - return to Preview

### 5.5 Screen 4: Import Progress

**Components:**
- Stage progress indicator
- Current operation label
- Progress bar (rows processed)
- Live repair log (scrolling):
  ```
  ✓ Detected: iCIMS Universal Report (high confidence)
  ✓ Mapped 12/14 columns
  ⚠ Row 45: Future date capped (2027-01-01 → 2026-01-18)
  ✓ Row 46: Stage normalized (Phone Scrn → SCREEN)
  ⚠ Row 47: Applied date inferred from first event
  ...
  ```
- Cancel button (with confirmation)

### 5.6 Screen 5: Import Summary & Audit

**Components:**
- Success banner with counts
- Coverage metrics visualization
- Feature enablement summary
- Audit log download button
- "View Dashboard" / "Import More Data" actions

---

## 6. Required Dates as Warnings

### 6.1 Current Problem

Currently, missing dates like `applied_at` can cause:
- Import failures
- Metrics returning 0 instead of N/A
- Incorrect time calculations

### 6.2 Solution: Graceful Degradation

**Principle:** Missing dates are WARNINGS, not ERRORS. Affected metrics show "Insufficient Data" instead of wrong values.

**Implementation:**

```typescript
// When applied_at is missing for a candidate:
interface CandidateWithMissingDate {
  candidate_id: string;
  applied_at: null;  // Explicitly null, not fabricated
  _confidence: {
    grade: 'low',
    reasons: ['MISSING_APPLIED_DATE'],
    inferred_fields: []  // NOT inferred - left as null
  };
}

// In metrics calculation:
function calculateTTF(candidates: Candidate[]): TTFResult {
  const withDates = candidates.filter(c => c.applied_at && c.hired_at);
  const withoutDates = candidates.filter(c => !c.applied_at || !c.hired_at);

  if (withDates.length < MIN_SAMPLE_SIZE) {
    return {
      value: null,
      display: 'Insufficient data',
      sampleSize: withDates.length,
      excluded: withoutDates.length,
      reason: `Only ${withDates.length} candidates have both applied and hired dates`
    };
  }

  // Calculate with valid data only
  const ttfValues = withDates.map(c => daysBetween(c.applied_at, c.hired_at));
  return {
    value: median(ttfValues),
    display: `${median(ttfValues)} days`,
    sampleSize: withDates.length,
    excluded: withoutDates.length,
    confidence: withDates.length > 20 ? 'high' : 'medium'
  };
}
```

**UI Display:**

```
┌────────────────────────────────────┐
│  Median Time-to-Fill               │
│  ┌──────────────────────────────┐  │
│  │       32 days                │  │
│  │  (n=45, 18 excluded)         │  │
│  └──────────────────────────────┘  │
│  ⚠ 18 candidates missing dates    │
└────────────────────────────────────┘
```

### 6.3 Field-Specific Handling

```typescript
const DATE_FIELD_HANDLING: Record<string, DateFieldConfig> = {
  applied_at: {
    required_for: ['ttf_metrics', 'velocity_insights', 'funnel_analysis'],
    fallback_inference: [
      { source: 'first_event_at', confidence: 'medium' },
      { source: 'created_at', confidence: 'low' }
    ],
    if_missing: 'exclude_from_metrics',  // Not from import!
    warning_message: 'Applied date missing - candidate excluded from TTF calculations'
  },

  hired_at: {
    required_for: ['ttf_metrics', 'hire_counts'],
    fallback_inference: [
      { source: 'disposition_changed_at', condition: 'disposition=Hired', confidence: 'medium' }
    ],
    if_missing: 'exclude_from_metrics',
    warning_message: 'Hire date missing - hire may not appear in TTF metrics'
  },

  opened_at: {
    required_for: ['req_age', 'time_to_first_candidate'],
    fallback_inference: [
      { source: 'first_candidate_applied_at', confidence: 'low' }
    ],
    if_missing: 'exclude_from_metrics',
    warning_message: 'Open date missing - req age cannot be calculated'
  }
};
```

---

## 7. Tests & Fixtures Strategy

### 7.1 Test Categories

```
tests/
├── unit/
│   ├── pipeline/
│   │   ├── detect.test.ts       # File format detection
│   │   ├── map.test.ts          # Column mapping
│   │   ├── parse.test.ts        # Value parsing
│   │   ├── repair.test.ts       # Auto-repair strategies
│   │   └── canonicalize.test.ts # Schema transformation
│   ├── capability/
│   │   ├── coverage.test.ts     # Coverage calculation
│   │   └── gating.test.ts       # Feature gating logic
│   └── snapshot/
│       ├── detection.test.ts    # Snapshot date detection
│       └── diff.test.ts         # Diff algorithm
├── integration/
│   ├── import-flow.test.ts      # Full import pipeline
│   ├── healing.test.ts          # End-to-end healing scenarios
│   └── capability-refresh.test.ts
└── fixtures/
    ├── csv/
    │   ├── icims_universal_clean.csv
    │   ├── icims_universal_messy.csv
    │   ├── greenhouse_export.csv
    │   ├── missing_dates.csv
    │   ├── bad_encoding.csv
    │   └── duplicate_rows.csv
    ├── excel/
    │   ├── weekly_report.xlsx
    │   ├── multi_sheet.xlsx
    │   └── corrupted.xlsx
    └── expected/
        ├── icims_universal_clean.json  # Expected canonical output
        ├── icims_universal_messy.json
        └── audit_logs/
            └── icims_universal_messy_audit.json
```

### 7.2 Fixture Requirements

Each fixture file should have:
1. **Source file** - The actual CSV/XLS file
2. **Expected output** - JSON with canonical records
3. **Expected audit log** - JSON with all warnings/repairs
4. **Test metadata** - What this fixture tests

**Fixture Metadata Example:**
```json
{
  "fixture_id": "icims_universal_messy",
  "description": "iCIMS universal report with common data quality issues",
  "tests": [
    "detects report type as icims_universal",
    "maps 12 of 14 columns",
    "repairs 5 future dates",
    "infers 3 applied dates from events",
    "excludes 2 rows with missing req_id",
    "generates 15 warnings"
  ],
  "expected_coverage": {
    "cand.applied_at": 0.92,
    "cand.hired_at": 0.15
  },
  "expected_capabilities": {
    "ttf_metrics": true,
    "hm_friction": false
  }
}
```

### 7.3 Test Patterns

**Unit Test Pattern:**
```typescript
describe('RepairStrategy: INFER_APPLIED_DATE_FROM_FIRST_EVENT', () => {
  it('infers applied_at when missing and events exist', () => {
    const record = {
      candidate_id: 'C1',
      applied_at: null,
      events: [
        { event_at: new Date('2026-01-10'), event_type: 'STAGE_CHANGE' },
        { event_at: new Date('2026-01-15'), event_type: 'STAGE_CHANGE' }
      ]
    };

    const result = applyRepair(record, 'applied_at', REPAIR_STRATEGIES);

    expect(result.applied_at).toEqual(new Date('2026-01-10'));
    expect(result._confidence.inferred_fields).toContain('applied_at');
    expect(result._confidence.repairs_applied).toContain('INFER_APPLIED_DATE_FROM_FIRST_EVENT');
  });

  it('does not infer when no events exist', () => {
    const record = {
      candidate_id: 'C1',
      applied_at: null,
      events: []
    };

    const result = applyRepair(record, 'applied_at', REPAIR_STRATEGIES);

    expect(result.applied_at).toBeNull();
    expect(result._confidence.inferred_fields).not.toContain('applied_at');
  });
});
```

**Integration Test Pattern:**
```typescript
describe('Full Import Pipeline', () => {
  it('handles messy iCIMS data gracefully', async () => {
    const fixture = loadFixture('icims_universal_messy');

    const result = await importPipeline.run(fixture.sourceFile, {
      createSnapshot: true
    });

    // Import succeeds despite issues
    expect(result.success).toBe(true);

    // Correct counts
    expect(result.candidates.length).toBe(fixture.expected.candidateCount);
    expect(result.excluded.length).toBe(fixture.expected.excludedCount);

    // Correct repairs
    expect(result.audit.repairs_applied).toBe(fixture.expected.repairsCount);

    // Correct warnings
    expect(result.audit.warnings).toBe(fixture.expected.warningsCount);

    // Capabilities enabled as expected
    for (const [cap, expected] of Object.entries(fixture.expected.capabilities)) {
      expect(capabilityEngine.isEnabled(cap)).toBe(expected);
    }
  });
});
```

### 7.4 Fixture Generation

Create a fixture generator for common scenarios:

```typescript
// scripts/generate-test-fixtures.ts
const fixtures = [
  {
    name: 'clean_small',
    config: {
      rows: 100,
      dataQuality: 'perfect',
      reportType: 'icims_universal'
    }
  },
  {
    name: 'messy_medium',
    config: {
      rows: 500,
      dataQuality: {
        missingDates: 0.1,
        unknownStages: 0.05,
        futureDates: 0.02,
        duplicates: 0.01
      },
      reportType: 'icims_universal'
    }
  },
  {
    name: 'minimal_data',
    config: {
      rows: 50,
      dataQuality: {
        missingDates: 0.5,
        missingSources: 1.0,
        missingHMs: 0.8
      },
      reportType: 'generic'
    }
  }
];
```

---

## 8. Implementation Phases

### Phase 1: Core Pipeline (Week 1-2)
- [ ] Implement DETECT stage with report type detection
- [ ] Implement MAP stage with column_map.yaml
- [ ] Implement PARSE stage with multi-format date parsing
- [ ] Implement basic REPAIR strategies (5 most common)
- [ ] Implement CANONICALIZE stage
- [ ] Add audit logging infrastructure

### Phase 2: Capability Engine (Week 2-3)
- [ ] Define coverage metrics schema
- [ ] Implement coverage calculation after import
- [ ] Define capability rules for all tabs
- [ ] Integrate gating into UI components
- [ ] Add "feature not available" states to tabs

### Phase 3: Snapshot Integration (Week 3-4)
- [ ] Implement snapshot date detection
- [ ] Integrate snapshot storage with import
- [ ] Implement diff algorithm
- [ ] Generate events from diffs
- [ ] Add snapshot management UI

### Phase 4: Import UX (Week 4-5)
- [ ] Build Preview & Mapping screen
- [ ] Build Warnings Review screen
- [ ] Build Import Progress screen
- [ ] Build Summary & Audit screen
- [ ] Add "Import Anyway" flows

### Phase 5: Testing & Polish (Week 5-6)
- [ ] Generate test fixtures
- [ ] Write unit tests for all stages
- [ ] Write integration tests
- [ ] Performance testing with large files
- [ ] Documentation and error messages

---

## 9. Success Metrics

1. **Import Success Rate**: >95% of files import without fatal errors
2. **Repair Rate**: >80% of common issues auto-repaired
3. **User Override Rate**: <10% of imports require user intervention
4. **Feature Coverage**: Users understand why features are disabled
5. **Audit Traceability**: 100% of data modifications are logged

---

## Appendix A: Error Code Reference

| Code | Severity | Description |
|------|----------|-------------|
| E001 | Fatal | File is empty or corrupted |
| E002 | Fatal | No data rows found |
| E003 | Fatal | Cannot identify req_id column |
| E004 | Exclusion | Row missing req_id value |
| E005 | Exclusion | Duplicate primary key |
| E006 | Warning | Date could not be parsed |
| E007 | Warning | Stage name not recognized |
| E008 | Warning | Future date detected |
| E009 | Warning | Applied date missing |
| E010 | Warning | Hire date missing |
| E011 | Info | Value inferred from other data |
| E012 | Info | Column not mapped |

---

## Appendix B: Repair Strategy Reference

| Strategy ID | Description | Confidence |
|-------------|-------------|------------|
| R001 | Infer applied_at from first event | Medium |
| R002 | Infer hired_at from disposition | Low |
| R003 | Normalize stage name | High |
| R004 | Fix duplicate candidate ID | High |
| R005 | Cap future date at import | Medium |
| R006 | Fix encoding issues | High |
| R007 | Parse non-standard date format | Medium |
| R008 | Infer recruiter from email | Low |

---

*End of Plan*
