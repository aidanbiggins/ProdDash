# Resilient Import & Guidance Plan V1

**Version:** 1.0
**Status:** Draft
**Author:** Claude
**Date:** 2026-01-18

---

## Executive Summary

PlatoVue must ingest messy CSV/XLS/XLSX data without punishing users. The system will:
1. **Fail-open** - Import what we can, never block on fixable issues
2. **Self-heal** - Auto-repair common data problems with full auditability
3. **Gate features** - Enable/disable based on measured data coverage
4. **Guide users** - Show what's possible now and what unlocks with more data

**Core Philosophy:** "With this data, I can do X. If you add Y, I can unlock Z."

Repair suggestions are **optional upgrades**, not demands. The UI is non-punitive.

---

## 1. Import Pipeline Architecture

### 1.1 Pipeline Stages

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        RESILIENT IMPORT PIPELINE                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐  │
│  │  DETECT  │ → │   MAP    │ → │  PARSE   │ → │  REPAIR  │ → │CANONICAL │  │
│  │          │   │          │   │          │   │          │   │   IZE    │  │
│  └────┬─────┘   └────┬─────┘   └────┬─────┘   └────┬─────┘   └────┬─────┘  │
│       │              │              │              │              │         │
│       ▼              ▼              ▼              ▼              ▼         │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                    AUDIT LOG (append-only, immutable)                 │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                      │                                      │
│                        ┌─────────────┴─────────────┐                       │
│                        ▼                           ▼                        │
│               ┌────────────────┐          ┌────────────────┐               │
│               │    COVERAGE    │          │   SNAPSHOT     │               │
│               │    METRICS     │          │   STORAGE      │               │
│               └───────┬────────┘          └────────────────┘               │
│                       │                                                     │
│                       ▼                                                     │
│               ┌────────────────┐                                           │
│               │  CAPABILITY    │                                           │
│               │   REGISTRY     │                                           │
│               └───────┬────────┘                                           │
│                       │                                                     │
│                       ▼                                                     │
│               ┌────────────────┐                                           │
│               │    GUIDANCE    │                                           │
│               │    ENGINE      │                                           │
│               └────────────────┘                                           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Stage: DETECT

**Purpose:** Identify file format, encoding, report type, and basic structure.

**Inputs:**
- Raw file bytes (CSV, XLS, XLSX)
- Filename (for heuristics)

**Outputs:**
```typescript
interface DetectionResult {
  fileFormat: 'csv' | 'xls' | 'xlsx';
  encoding: string;
  reportType: ReportType;
  confidence: 'high' | 'medium' | 'low';
  detectedSheet?: string;  // For Excel
  rowCount: number;
  columnHeaders: string[];
  snapshotDateHint?: Date;  // From filename
}

type ReportType =
  | 'icims_universal'
  | 'icims_submittal'
  | 'icims_requisition'
  | 'greenhouse'
  | 'lever'
  | 'workday'
  | 'generic';
```

**Detection Logic:**
```typescript
// Report type detection by column signature
const REPORT_SIGNATURES: Record<ReportType, ColumnSignature> = {
  icims_universal: {
    required: ['Job ID', 'Person ID'],
    optional: ['Workflow', 'Status', 'Submittal Status'],
    synonyms: {
      'Job ID': ['Req ID', 'Requisition ID'],
      'Person ID': ['Candidate ID', 'Applicant ID']
    }
  },
  greenhouse: {
    required: ['Application ID', 'Candidate ID', 'Job ID'],
    optional: ['Current Stage', 'Source']
  },
  // ... more signatures
};

function detectReportType(headers: string[]): { type: ReportType; confidence: number } {
  for (const [type, sig] of Object.entries(REPORT_SIGNATURES)) {
    const score = calculateSignatureMatch(headers, sig);
    if (score > 0.8) return { type, confidence: 'high' };
    if (score > 0.5) return { type, confidence: 'medium' };
  }
  return { type: 'generic', confidence: 'low' };
}
```

**Snapshot Date Detection from Filename:**
```typescript
const FILENAME_DATE_PATTERNS = [
  /(\d{4}-\d{2}-\d{2})/,                    // 2026-01-18
  /(\d{2}-\d{2}-\d{4})/,                    // 01-18-2026
  /(\d{8})/,                                 // 20260118
  /week[_-]?of[_-]?(\d{4}-\d{2}-\d{2})/i,  // week_of_2026-01-18
  /(\w{3})[_-]?(\d{1,2})[_-]?(\d{4})/i,    // Jan-18-2026
];

function detectSnapshotDate(filename: string): Date | null {
  for (const pattern of FILENAME_DATE_PATTERNS) {
    const match = filename.match(pattern);
    if (match) {
      const parsed = parseFlexibleDate(match[0]);
      if (isValid(parsed) && !isFuture(parsed)) {
        return parsed;
      }
    }
  }
  return null;
}
```

**Audit Events:**
- `DETECT_FORMAT`: File format identified
- `DETECT_REPORT_TYPE`: Report type determined with confidence
- `DETECT_SNAPSHOT_DATE`: Snapshot date inferred from filename
- `DETECT_ENCODING_CONVERTED`: Encoding converted to UTF-8

---

### 1.3 Stage: MAP

**Purpose:** Map source columns to canonical fields.

**Inputs:**
- Column headers from DETECT
- `column_map.yaml` configuration
- User overrides (optional)

**Outputs:**
```typescript
interface MappingResult {
  mappings: Map<string, CanonicalField>;
  unmapped: string[];
  ambiguous: AmbiguousMapping[];
  confidence: number;  // 0-1
}

interface AmbiguousMapping {
  sourceColumn: string;
  candidates: { field: CanonicalField; score: number }[];
  autoSelected: CanonicalField;
}
```

**Mapping Priority:**
1. Exact match against known names
2. Synonym match from `column_map.yaml`
3. Fuzzy match (Levenshtein distance ≤ 3)
4. Pattern match (regex)
5. User override (highest priority)

**Audit Events:**
- `MAP_EXACT`: Column mapped via exact match
- `MAP_SYNONYM`: Column mapped via synonym
- `MAP_FUZZY`: Column mapped via fuzzy match
- `MAP_PATTERN`: Column mapped via pattern
- `MAP_USER_OVERRIDE`: User manually mapped column
- `MAP_UNMAPPED`: Column could not be mapped (info, not error)

---

### 1.4 Stage: PARSE

**Purpose:** Convert raw string values to typed values.

**Inputs:**
- Raw row data
- Column mappings
- Type definitions

**Outputs:**
```typescript
interface ParseResult {
  records: ParsedRecord[];
  parseErrors: ParseError[];  // Per-field errors
}

interface ParsedRecord {
  _rowNumber: number;
  _parseWarnings: string[];
  [field: string]: any;
}
```

**Date Parsing Strategy:**
```typescript
const DATE_PARSERS = [
  // ISO 8601 (highest priority)
  (v: string) => parseISO(v),
  // US formats
  (v: string) => parse(v, 'MM/dd/yyyy', new Date()),
  (v: string) => parse(v, 'M/d/yyyy', new Date()),
  (v: string) => parse(v, 'MM-dd-yyyy', new Date()),
  // European formats
  (v: string) => parse(v, 'dd/MM/yyyy', new Date()),
  (v: string) => parse(v, 'dd-MM-yyyy', new Date()),
  // Excel serial date
  (v: string) => excelSerialToDate(Number(v)),
  // Natural language (last resort)
  (v: string) => chrono.parseDate(v),
];

function parseDate(value: string): Date | null {
  if (!value || NULL_VALUES.includes(value.trim())) {
    return null;
  }

  for (const parser of DATE_PARSERS) {
    try {
      const result = parser(value);
      if (isValid(result) && !isFuture(result)) {
        return result;
      }
    } catch {}
  }

  return null;  // Return null, not error - date is optional
}
```

**CRITICAL: No Fabricated Timestamps**
```typescript
// NEVER do this:
const applied_at = candidate.applied_at || new Date();  // ❌ WRONG

// ALWAYS do this:
const applied_at = candidate.applied_at || null;  // ✓ CORRECT
```

**Audit Events:**
- `PARSE_SUCCESS`: Value parsed successfully
- `PARSE_NULL`: Value was empty/null (info)
- `PARSE_FALLBACK`: Used non-primary parser
- `PARSE_FAILED`: Could not parse, set to null (warning)

---

### 1.5 Stage: REPAIR

**Purpose:** Auto-fix common data issues. Never fabricate ATS data.

**Allowed Repairs:**
```typescript
interface RepairStrategy {
  id: string;
  description: string;
  canFabricate: false;  // MUST always be false
  confidence: 'high' | 'medium' | 'low';
  condition: (record: any, context: RepairContext) => boolean;
  repair: (record: any, context: RepairContext) => any;
}

const REPAIR_STRATEGIES: RepairStrategy[] = [
  // Normalize stage names (HIGH confidence)
  {
    id: 'NORMALIZE_STAGE',
    description: 'Map raw stage name to canonical stage',
    canFabricate: false,
    confidence: 'high',
    condition: (r) => r.current_stage && !isCanonicalStage(r.current_stage),
    repair: (r, ctx) => ({
      ...r,
      current_stage: ctx.stageMapping.normalize(r.current_stage)
    })
  },

  // Trim whitespace (HIGH confidence)
  {
    id: 'TRIM_WHITESPACE',
    description: 'Trim leading/trailing whitespace from strings',
    canFabricate: false,
    confidence: 'high',
    condition: (r) => hasUntrimmedStrings(r),
    repair: (r) => trimAllStrings(r)
  },

  // Fix encoding issues (HIGH confidence)
  {
    id: 'FIX_ENCODING',
    description: 'Fix mojibake and encoding issues',
    canFabricate: false,
    confidence: 'high',
    condition: (r) => hasMojibake(r),
    repair: (r) => fixEncoding(r)
  },

  // Cap future dates (MEDIUM confidence)
  {
    id: 'CAP_FUTURE_DATE',
    description: 'Cap dates in the future to import date',
    canFabricate: false,
    confidence: 'medium',
    condition: (r) => hasFieldInFuture(r),
    repair: (r, ctx) => capFutureDates(r, ctx.importDate)
  },

  // IMPORTANT: We do NOT infer applied_at or other ATS timestamps
  // Those must come from the source data or remain null
];
```

**Audit Events:**
- `REPAIR_APPLIED`: Repair strategy applied
- `REPAIR_SKIPPED`: Condition not met
- `REPAIR_CONFIDENCE`: Records confidence level

---

### 1.6 Stage: CANONICALIZE

**Purpose:** Transform to canonical schema with provenance tracking.

**Outputs:**
```typescript
interface CanonicalRecord {
  // Identity (required)
  id: string;  // Canonical ID (may be synthesized)

  // Source provenance (always present)
  _provenance: RecordProvenance;

  // Confidence metadata
  _confidence: ConfidenceMetadata;

  // Actual data fields...
  [field: string]: any;
}

interface RecordProvenance {
  source_file: string;
  source_row: number;
  source_columns: Record<string, string>;  // canonical -> source column name
  ingested_at: Date;
  import_id: string;
}

interface ConfidenceMetadata {
  overall: 'high' | 'medium' | 'low';
  id_synthesized: boolean;
  id_synthesis_method?: string;
  repairs_applied: string[];
  null_fields: string[];
  warnings: string[];
}
```

---

## 2. Fatal vs Warning Taxonomy

### 2.1 Philosophy

**Default: WARNING (fail-open)**

Only two conditions are fatal:
1. File is completely unparsable (corrupted, empty, wrong format)
2. Identity cannot be established even with safe synthesis

Everything else is a warning. The import proceeds.

### 2.2 Error Classification

```typescript
enum ErrorSeverity {
  FATAL = 'fatal',       // Blocks entire import
  EXCLUSION = 'exclude', // Drops this row, continues
  WARNING = 'warning',   // Logs warning, keeps row
  INFO = 'info'          // Informational only
}

interface ErrorDefinition {
  code: string;
  severity: ErrorSeverity;
  canOverride: boolean;
  message: string;
  guidance?: string;  // How to fix
}

const ERROR_DEFINITIONS: ErrorDefinition[] = [
  // ══════════════════════════════════════════════════════════
  // FATAL - Import cannot proceed
  // ══════════════════════════════════════════════════════════
  {
    code: 'FATAL_FILE_EMPTY',
    severity: 'fatal',
    canOverride: false,
    message: 'File contains no data rows',
    guidance: 'Please select a file with data'
  },
  {
    code: 'FATAL_FILE_CORRUPTED',
    severity: 'fatal',
    canOverride: false,
    message: 'File is corrupted or unreadable',
    guidance: 'Try re-exporting from your ATS'
  },
  {
    code: 'FATAL_NO_IDENTITY',
    severity: 'fatal',
    canOverride: false,
    message: 'Cannot identify records - no ID column and insufficient data for synthesis',
    guidance: 'Ensure your export includes a Job ID or Requisition ID column'
  },

  // ══════════════════════════════════════════════════════════
  // EXCLUSION - Row dropped, import continues
  // ══════════════════════════════════════════════════════════
  {
    code: 'EXCLUDE_NO_REQ_ID',
    severity: 'exclude',
    canOverride: true,
    message: 'Row has no requisition identifier',
    guidance: null  // Can be included via override
  },
  {
    code: 'EXCLUDE_DUPLICATE',
    severity: 'exclude',
    canOverride: true,
    message: 'Duplicate record detected',
    guidance: 'First occurrence kept, duplicates dropped'
  },

  // ══════════════════════════════════════════════════════════
  // WARNING - Row included, data may be incomplete
  // ══════════════════════════════════════════════════════════
  {
    code: 'WARN_MISSING_DATE',
    severity: 'warning',
    canOverride: false,
    message: 'Date field is missing',
    guidance: 'Some time-based metrics may be unavailable'
  },
  {
    code: 'WARN_UNPARSEABLE_DATE',
    severity: 'warning',
    canOverride: false,
    message: 'Date could not be parsed',
    guidance: 'Field set to null - check date format in source'
  },
  {
    code: 'WARN_UNKNOWN_STAGE',
    severity: 'warning',
    canOverride: false,
    message: 'Stage name not recognized',
    guidance: 'Mapped to UNKNOWN - consider adding to stage mapping'
  },
  {
    code: 'WARN_MISSING_NAME',
    severity: 'warning',
    canOverride: false,
    message: 'Name field is missing',
    guidance: 'Will display as "Unknown"'
  },
  {
    code: 'WARN_FUTURE_DATE',
    severity: 'warning',
    canOverride: false,
    message: 'Date in the future was capped to today',
    guidance: 'Check source data for incorrect dates'
  },

  // ══════════════════════════════════════════════════════════
  // INFO - Just logging, no action needed
  // ══════════════════════════════════════════════════════════
  {
    code: 'INFO_COLUMN_UNMAPPED',
    severity: 'info',
    canOverride: false,
    message: 'Column not mapped to any field',
    guidance: null
  },
  {
    code: 'INFO_ID_SYNTHESIZED',
    severity: 'info',
    canOverride: false,
    message: 'Record ID was synthesized from available data',
    guidance: null
  },
];
```

### 2.3 Decision Tree

```
Is the file parsable?
├─ NO → FATAL_FILE_CORRUPTED
└─ YES
    │
    Does file have data rows?
    ├─ NO → FATAL_FILE_EMPTY
    └─ YES
        │
        Can we identify records (ID column OR synthesis possible)?
        ├─ NO → FATAL_NO_IDENTITY
        └─ YES
            │
            ┌─────────────────────────────────────────┐
            │ IMPORT PROCEEDS - Process each row:    │
            └─────────────────────────────────────────┘
                │
                For each row:
                ├─ Has req_id? → Include
                ├─ Can synthesize req_id? → Include + INFO
                └─ Cannot identify? → EXCLUDE + log
                    │
                    For each field:
                    ├─ Parsed successfully? → OK
                    ├─ Parse failed? → WARN + set null
                    └─ Field missing? → WARN + set null
```

---

## 3. Safe ID Synthesis Rules

### 3.1 When Synthesis is Allowed

ID synthesis is allowed ONLY when:
1. The source column exists but value is missing for some rows
2. Enough other data exists to create a deterministic, unique ID
3. The synthesis method is fully traceable

### 3.2 Synthesis Methods

```typescript
interface SynthesisMethod {
  id: string;
  priority: number;  // Lower = preferred
  confidence: 'high' | 'medium' | 'low';
  canApply: (record: any) => boolean;
  synthesize: (record: any) => string;
}

const SYNTHESIS_METHODS: SynthesisMethod[] = [
  // ══════════════════════════════════════════════════════════
  // CANDIDATE ID SYNTHESIS
  // ══════════════════════════════════════════════════════════
  {
    id: 'CAND_FROM_EMAIL_REQ',
    priority: 1,
    confidence: 'high',
    canApply: (r) => r.email && r.req_id,
    synthesize: (r) => `synth:${hash(r.email + ':' + r.req_id)}`
  },
  {
    id: 'CAND_FROM_NAME_REQ_DATE',
    priority: 2,
    confidence: 'medium',
    canApply: (r) => r.name && r.req_id && r.applied_at,
    synthesize: (r) => `synth:${hash(r.name + ':' + r.req_id + ':' + formatDate(r.applied_at))}`
  },
  {
    id: 'CAND_FROM_ROW_NUMBER',
    priority: 99,
    confidence: 'low',
    canApply: (r) => r._rowNumber != null,
    synthesize: (r) => `synth:row:${r._rowNumber}`
  },

  // ══════════════════════════════════════════════════════════
  // REQUISITION ID SYNTHESIS
  // ══════════════════════════════════════════════════════════
  {
    id: 'REQ_FROM_TITLE_HM',
    priority: 1,
    confidence: 'high',
    canApply: (r) => r.req_title && r.hiring_manager_id,
    synthesize: (r) => `synth:${hash(r.req_title + ':' + r.hiring_manager_id)}`
  },
  {
    id: 'REQ_FROM_TITLE_OPENED',
    priority: 2,
    confidence: 'medium',
    canApply: (r) => r.req_title && r.opened_at,
    synthesize: (r) => `synth:${hash(r.req_title + ':' + formatDate(r.opened_at))}`
  },
];
```

### 3.3 Provenance Tracking for Synthesized IDs

```typescript
interface SynthesizedIdProvenance {
  original_value: null;
  synthesized_value: string;
  synthesis_method: string;
  synthesis_inputs: Record<string, any>;
  confidence: 'high' | 'medium' | 'low';
  warning: string;
}

// Example:
{
  original_value: null,
  synthesized_value: 'synth:a1b2c3d4',
  synthesis_method: 'CAND_FROM_EMAIL_REQ',
  synthesis_inputs: {
    email: 'john@example.com',
    req_id: 'REQ-123'
  },
  confidence: 'high',
  warning: 'Candidate ID was synthesized from email + req_id'
}
```

---

## 4. Coverage Metrics & Capability Registry

### 4.1 Coverage Metrics Schema

```typescript
interface CoverageMetrics {
  // Import metadata
  import_id: string;
  computed_at: Date;

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
    hasStageEvents: boolean;         // events.length > 0 && event.from_stage coverage > 0.5
    hasTimestamps: boolean;          // cand.applied_at coverage > 0.5
    hasTerminalTimestamps: boolean;  // cand.hired_at OR cand.rejected_at coverage > 0.1
    hasRecruiterAssignment: boolean; // req.recruiter_id coverage > 0.5
    hasHMAssignment: boolean;        // req.hiring_manager_id coverage > 0.5
    hasSourceData: boolean;          // cand.source coverage > 0.3
    hasMultipleSnapshots: boolean;   // counts.snapshots >= 2
  };

  // Sample sizes for threshold checks
  sampleSizes: {
    hires: number;
    offers: number;
    rejections: number;
    activeReqs: number;
  };
}
```

### 4.2 Capability Registry Schema

```typescript
interface Capability {
  id: string;
  displayName: string;
  description: string;

  // What type of UI element this controls
  uiType: 'tab' | 'section' | 'widget' | 'metric';

  // Gating requirements (ALL must be met)
  requirements: CapabilityRequirement[];

  // What happens when not met
  whenDisabled: {
    behavior: 'hide' | 'replace';
    replacementComponent?: string;  // For 'replace' behavior
    message: string;
    upgradeHint?: string;  // "Add X to unlock this"
  };
}

interface CapabilityRequirement {
  type: 'field_coverage' | 'flag' | 'count' | 'sample_size';
  field?: string;
  flag?: string;
  minValue?: number;
  minCount?: number;
}

const CAPABILITY_REGISTRY: Capability[] = [
  // ══════════════════════════════════════════════════════════
  // TABS (replace with UnavailablePanel when disabled)
  // ══════════════════════════════════════════════════════════
  {
    id: 'tab_hm_friction',
    displayName: 'HM Friction',
    description: 'Analyze hiring manager responsiveness',
    uiType: 'tab',
    requirements: [
      { type: 'flag', flag: 'hasHMAssignment' },
      { type: 'flag', flag: 'hasStageEvents' },
      { type: 'count', field: 'events', minCount: 50 }
    ],
    whenDisabled: {
      behavior: 'replace',
      replacementComponent: 'UnavailableTabPanel',
      message: 'HM Friction analysis requires hiring manager data and stage events',
      upgradeHint: 'Import data with Hiring Manager assignments and workflow events'
    }
  },

  {
    id: 'tab_velocity',
    displayName: 'Velocity Insights',
    description: 'Pipeline velocity and decay analysis',
    uiType: 'tab',
    requirements: [
      { type: 'field_coverage', field: 'cand.applied_at', minValue: 0.6 },
      { type: 'flag', flag: 'hasStageEvents' },
      { type: 'sample_size', field: 'candidates', minCount: 30 }
    ],
    whenDisabled: {
      behavior: 'replace',
      replacementComponent: 'UnavailableTabPanel',
      message: 'Velocity Insights requires applied dates and stage events',
      upgradeHint: 'Ensure your export includes Applied Date and workflow status changes'
    }
  },

  {
    id: 'tab_source_mix',
    displayName: 'Source Effectiveness',
    description: 'Compare candidate sources by conversion',
    uiType: 'tab',
    requirements: [
      { type: 'flag', flag: 'hasSourceData' },
      { type: 'field_coverage', field: 'cand.source', minValue: 0.4 }
    ],
    whenDisabled: {
      behavior: 'replace',
      replacementComponent: 'UnavailableTabPanel',
      message: 'Source Effectiveness requires source data for candidates',
      upgradeHint: 'Include the Source or Referral Source column in your export'
    }
  },

  {
    id: 'tab_bottlenecks',
    displayName: 'Bottlenecks & SLAs',
    description: 'Track stage durations and SLA violations',
    uiType: 'tab',
    requirements: [
      { type: 'flag', flag: 'hasStageEvents' },
      { type: 'field_coverage', field: 'event.from_stage', minValue: 0.7 },
      { type: 'field_coverage', field: 'event.to_stage', minValue: 0.7 }
    ],
    whenDisabled: {
      behavior: 'replace',
      replacementComponent: 'UnavailableTabPanel',
      message: 'Bottlenecks requires stage transition events with from/to stages',
      upgradeHint: 'Import workflow history or activity data with stage transitions'
    }
  },

  // ══════════════════════════════════════════════════════════
  // SECTIONS (replace with compact unavailable message)
  // ══════════════════════════════════════════════════════════
  {
    id: 'section_ttf_chart',
    displayName: 'Time-to-Fill Chart',
    description: 'Distribution of time to fill',
    uiType: 'section',
    requirements: [
      { type: 'field_coverage', field: 'cand.applied_at', minValue: 0.5 },
      { type: 'field_coverage', field: 'cand.hired_at', minValue: 0.1 },
      { type: 'sample_size', field: 'hires', minCount: 5 }
    ],
    whenDisabled: {
      behavior: 'replace',
      replacementComponent: 'UnavailableSectionPanel',
      message: 'Requires applied dates and hire dates',
      upgradeHint: 'Add Applied Date and Hire Date columns'
    }
  },

  {
    id: 'section_trends',
    displayName: 'Historical Trends',
    description: 'Compare metrics across time periods',
    uiType: 'section',
    requirements: [
      { type: 'flag', flag: 'hasMultipleSnapshots' }
    ],
    whenDisabled: {
      behavior: 'replace',
      replacementComponent: 'UnavailableSectionPanel',
      message: 'Historical trends require multiple data snapshots',
      upgradeHint: 'Import another week\'s data to enable trend analysis'
    }
  },

  // ══════════════════════════════════════════════════════════
  // WIDGETS (hide when disabled)
  // ══════════════════════════════════════════════════════════
  {
    id: 'widget_hm_latency',
    displayName: 'HM Latency KPI',
    description: 'Average HM response time',
    uiType: 'widget',
    requirements: [
      { type: 'flag', flag: 'hasHMAssignment' },
      { type: 'flag', flag: 'hasStageEvents' }
    ],
    whenDisabled: {
      behavior: 'hide',
      message: 'HM data not available'
    }
  },

  {
    id: 'widget_source_breakdown',
    displayName: 'Source Breakdown',
    description: 'Pie chart of candidate sources',
    uiType: 'widget',
    requirements: [
      { type: 'flag', flag: 'hasSourceData' }
    ],
    whenDisabled: {
      behavior: 'hide',
      message: 'Source data not available'
    }
  },

  // ══════════════════════════════════════════════════════════
  // METRICS (show N/A when disabled)
  // ══════════════════════════════════════════════════════════
  {
    id: 'metric_median_ttf',
    displayName: 'Median Time-to-Fill',
    description: 'Median days from apply to hire',
    uiType: 'metric',
    requirements: [
      { type: 'field_coverage', field: 'cand.applied_at', minValue: 0.5 },
      { type: 'sample_size', field: 'hires', minCount: 3 }
    ],
    whenDisabled: {
      behavior: 'replace',
      message: 'Insufficient data',
      upgradeHint: 'Need applied dates and 3+ hires'
    }
  },
];
```

### 4.3 Capability Engine API

```typescript
interface CapabilityEngine {
  // Check if capability is enabled
  isEnabled(capabilityId: string): boolean;

  // Get full status for UI rendering
  getStatus(capabilityId: string): CapabilityStatus;

  // Get all capabilities for a specific UI location
  getCapabilitiesForTab(tabId: string): CapabilityStatus[];

  // Refresh after new import
  refresh(coverage: CoverageMetrics): void;

  // Get upgrade suggestions
  getUpgradeSuggestions(): UpgradeSuggestion[];
}

interface CapabilityStatus {
  id: string;
  displayName: string;
  enabled: boolean;
  requirements: RequirementStatus[];
  disabledReason?: string;
  upgradeHint?: string;
}

interface RequirementStatus {
  description: string;
  met: boolean;
  currentValue?: number;
  requiredValue?: number;
}
```

---

## 5. Adaptive UI Composition Rules

### 5.1 Hide vs Replace Decision Matrix

| UI Type | When Disabled | Rationale |
|---------|---------------|-----------|
| Tab | Replace with UnavailableTabPanel | User needs to know the feature exists |
| Section | Replace with UnavailableSectionPanel | Maintains layout, shows what's missing |
| Widget | Hide completely | Reduces clutter, secondary info |
| Metric | Show "—" with tooltip | Shows metric exists but data lacking |

### 5.2 UnavailableTabPanel Component

```typescript
interface UnavailablePanelProps {
  capability: CapabilityStatus;
  onUpgradeClick?: () => void;  // Opens guidance drawer
}

// Renders as:
┌─────────────────────────────────────────────────────────────┐
│  ┌─────────────────────────────────────────────────────┐   │
│  │                    📊                                │   │
│  │                                                      │   │
│  │         HM Friction Analysis                        │   │
│  │                                                      │   │
│  │   This feature requires hiring manager data         │   │
│  │   and stage transition events.                      │   │
│  │                                                      │   │
│  │   ┌────────────────────────────────────────────┐    │   │
│  │   │  What you need:                            │    │   │
│  │   │  • Hiring Manager column (0% → 50%)        │    │   │
│  │   │  • Stage events (0 events → 50+)           │    │   │
│  │   └────────────────────────────────────────────┘    │   │
│  │                                                      │   │
│  │          [ How to unlock this feature ]             │   │
│  │                                                      │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### 5.3 UnavailableSectionPanel Component

```typescript
// Compact inline replacement for sections
┌─────────────────────────────────────────────────────────────┐
│  Time-to-Fill Distribution                                   │
│  ────────────────────────────────────────────────────────── │
│  ⚠️ Requires applied dates (45% coverage) and 5+ hires      │
│     [ Add applied dates ]                                    │
└─────────────────────────────────────────────────────────────┘
```

### 5.4 UI Composition Flow

```typescript
function composeTabContent(tabId: string, coverage: CoverageMetrics): ReactNode {
  const capabilities = capabilityEngine.getCapabilitiesForTab(tabId);

  return (
    <>
      {capabilities.map(cap => {
        if (cap.enabled) {
          return <EnabledComponent key={cap.id} />;
        }

        switch (cap.uiType) {
          case 'tab':
            return <UnavailableTabPanel key={cap.id} capability={cap} />;
          case 'section':
            return <UnavailableSectionPanel key={cap.id} capability={cap} />;
          case 'widget':
            return null;  // Hidden
          case 'metric':
            return <MetricPlaceholder key={cap.id} label={cap.displayName} />;
        }
      })}
    </>
  );
}
```

---

## 6. Capabilities Summary & Guidance

### 6.1 Copy Template

**Header:**
```
With your data, PlatoVue can:
```

**Enabled Features (green checkmarks):**
```
✓ Track {candidateCount} candidates across {reqCount} requisitions
✓ Calculate offer acceptance rates ({acceptRate}%)
✓ Monitor recruiter workload and performance
```

**Partially Enabled (yellow):**
```
◐ Time-to-Fill metrics (82% of candidates have dates)
◐ Recruiter comparison (3 of 5 recruiters identified)
```

**Disabled with Upgrade Path (gray with link):**
```
○ HM Friction Analysis → Add Hiring Manager column
○ Source Effectiveness → Add Source column
○ Historical Trends → Import another week's data
```

**Call to Action:**
```
[ See what you can unlock ] → Opens Upgrade Suggestions drawer
```

### 6.2 UI Placement

**Location 1: Post-Import Summary Screen**
- Full capabilities summary
- Prominent upgrade suggestions
- "Go to Dashboard" and "Import More Data" buttons

**Location 2: Dashboard Header (collapsed)**
- Compact status: "12 features enabled, 3 upgrades available"
- Expand arrow opens drawer

**Location 3: Tab-Specific Context**
- Each disabled tab shows relevant suggestion
- One-click CTA to resolve

### 6.3 Capabilities Summary Component

```typescript
interface CapabilitiesSummaryProps {
  coverage: CoverageMetrics;
  capabilities: CapabilityStatus[];
  suggestions: UpgradeSuggestion[];
  variant: 'full' | 'compact' | 'drawer';
}

// Full variant (post-import screen):
┌─────────────────────────────────────────────────────────────┐
│  ✨ Import Complete                                          │
│                                                              │
│  With your data, PlatoVue can:                              │
│  ───────────────────────────────────────────────────────── │
│  ✓ Track 1,247 candidates across 45 requisitions           │
│  ✓ Calculate time-to-fill (median: 32 days)                │
│  ✓ Monitor 6 recruiters' performance                        │
│  ◐ HM responsiveness (60% of reqs have HM assigned)        │
│                                                              │
│  Unlock more features:                                       │
│  ───────────────────────────────────────────────────────── │
│  ○ Source Effectiveness → [ Add Source column ]             │
│  ○ Historical Trends → [ Import another snapshot ]          │
│                                                              │
│  ┌──────────────────┐  ┌──────────────────────────────┐    │
│  │  Go to Dashboard │  │  Import More Data            │    │
│  └──────────────────┘  └──────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

---

## 7. Repair Suggestions Schema

### 7.1 Suggestion Object

```typescript
interface RepairSuggestion {
  id: string;
  type: SuggestionType;
  priority: 'high' | 'medium' | 'low';

  // Display
  title: string;
  description: string;
  impact: string;  // What this unlocks

  // Actionability
  cta: CallToAction;
  estimatedEffort: 'one-click' | 'quick' | 'moderate';

  // Context
  affectedCapabilities: string[];
  currentState: any;
  targetState: any;
}

type SuggestionType =
  | 'map_column'        // Map an unmapped column
  | 'set_snapshot_date' // Set/adjust snapshot date
  | 'import_snapshot'   // Import another data file
  | 'configure_stages'  // Map stage names
  | 'fix_data_quality'; // Address data quality issue

interface CallToAction {
  label: string;
  action: CTAAction;
  params?: Record<string, any>;
}

type CTAAction =
  | { type: 'open_column_mapper'; column: string }
  | { type: 'open_snapshot_date_picker' }
  | { type: 'open_import_modal' }
  | { type: 'open_stage_mapper'; stages: string[] }
  | { type: 'navigate'; path: string };
```

### 7.2 Prioritization Rules

```typescript
function prioritizeSuggestions(
  suggestions: RepairSuggestion[],
  coverage: CoverageMetrics
): RepairSuggestion[] {
  return suggestions.sort((a, b) => {
    // 1. One-click actions first
    if (a.estimatedEffort === 'one-click' && b.estimatedEffort !== 'one-click') return -1;
    if (b.estimatedEffort === 'one-click' && a.estimatedEffort !== 'one-click') return 1;

    // 2. Higher priority
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    }

    // 3. More capabilities unlocked
    return b.affectedCapabilities.length - a.affectedCapabilities.length;
  });
}

// Example prioritized list:
// 1. [one-click] Set snapshot date → Unlocks: trend analysis
// 2. [one-click] Map "Hiring Mgr" column to hiring_manager_id → Unlocks: HM Friction
// 3. [quick] Import last week's data → Unlocks: historical comparison
// 4. [moderate] Map 5 unknown stage names → Unlocks: better funnel analysis
```

### 7.3 Suggestion Generation

```typescript
function generateSuggestions(
  importResult: ImportResult,
  coverage: CoverageMetrics
): RepairSuggestion[] {
  const suggestions: RepairSuggestion[] = [];

  // Check for unmapped columns that could unlock features
  for (const column of importResult.unmappedColumns) {
    const potentialMapping = detectPotentialMapping(column);
    if (potentialMapping && wouldUnlockCapabilities(potentialMapping)) {
      suggestions.push({
        id: `map_${column}`,
        type: 'map_column',
        priority: 'high',
        title: `Map "${column}" column`,
        description: `This column looks like it contains ${potentialMapping.displayName}`,
        impact: `Unlocks: ${getUnlockedCapabilities(potentialMapping).join(', ')}`,
        cta: {
          label: 'Map Column',
          action: { type: 'open_column_mapper', column }
        },
        estimatedEffort: 'one-click',
        affectedCapabilities: getUnlockedCapabilities(potentialMapping)
      });
    }
  }

  // Suggest snapshot date if not detected
  if (!importResult.snapshotDate) {
    suggestions.push({
      id: 'set_snapshot_date',
      type: 'set_snapshot_date',
      priority: 'medium',
      title: 'Set snapshot date',
      description: 'Specify when this data was exported for accurate trend tracking',
      impact: 'Enables: accurate historical comparisons',
      cta: {
        label: 'Set Date',
        action: { type: 'open_snapshot_date_picker' }
      },
      estimatedEffort: 'one-click',
      affectedCapabilities: ['section_trends']
    });
  }

  // Suggest importing another snapshot
  if (coverage.counts.snapshots === 1) {
    suggestions.push({
      id: 'import_another_snapshot',
      type: 'import_snapshot',
      priority: 'medium',
      title: 'Import another week\'s data',
      description: 'Add historical data to enable trend analysis',
      impact: 'Unlocks: Historical Trends, Week-over-Week comparisons',
      cta: {
        label: 'Import Data',
        action: { type: 'open_import_modal' }
      },
      estimatedEffort: 'quick',
      affectedCapabilities: ['section_trends', 'metric_wow_change']
    });
  }

  // Suggest mapping unknown stages
  const unknownStages = importResult.unmappedStages;
  if (unknownStages.length > 0) {
    suggestions.push({
      id: 'map_stages',
      type: 'configure_stages',
      priority: 'low',
      title: `Map ${unknownStages.length} unknown stage names`,
      description: `Stages like "${unknownStages[0]}" need mapping to canonical stages`,
      impact: 'Improves: funnel accuracy, stage duration metrics',
      cta: {
        label: 'Map Stages',
        action: { type: 'open_stage_mapper', stages: unknownStages }
      },
      estimatedEffort: 'moderate',
      affectedCapabilities: ['section_funnel', 'metric_stage_duration']
    });
  }

  return prioritizeSuggestions(suggestions, coverage);
}
```

---

## 8. One-Click CTAs

### 8.1 CTA Definitions

```typescript
const CTA_HANDLERS: Record<CTAAction['type'], CTAHandler> = {
  open_column_mapper: {
    component: 'ColumnMapperDrawer',
    props: (params) => ({
      column: params.column,
      suggestions: getColumnSuggestions(params.column),
      onMap: (target) => applyColumnMapping(params.column, target)
    })
  },

  open_snapshot_date_picker: {
    component: 'SnapshotDatePicker',
    props: () => ({
      defaultDate: detectSnapshotDate() || new Date(),
      onConfirm: (date) => setSnapshotDate(date)
    })
  },

  open_import_modal: {
    component: 'ImportModal',
    props: () => ({
      mode: 'additional_snapshot',
      onComplete: () => refreshCapabilities()
    })
  },

  open_stage_mapper: {
    component: 'StageMapperDrawer',
    props: (params) => ({
      unmappedStages: params.stages,
      onSave: (mappings) => applyStageMapping(mappings)
    })
  },

  navigate: {
    handler: (params) => {
      router.push(params.path);
    }
  }
};
```

### 8.2 CTA Button Component

```typescript
interface CTAButtonProps {
  cta: CallToAction;
  variant: 'primary' | 'secondary' | 'link';
  size: 'sm' | 'md' | 'lg';
}

function CTAButton({ cta, variant, size }: CTAButtonProps) {
  const handler = CTA_HANDLERS[cta.action.type];

  const handleClick = () => {
    if ('handler' in handler) {
      handler.handler(cta.params);
    } else {
      openDrawer(handler.component, handler.props(cta.params));
    }
  };

  return (
    <button
      className={`cta-btn cta-btn-${variant} cta-btn-${size}`}
      onClick={handleClick}
    >
      {cta.label}
    </button>
  );
}
```

---

## 9. Snapshot XLSX Rules

### 9.1 Snapshot Date Inference

```typescript
interface SnapshotDateInference {
  date: Date;
  source: 'filename' | 'file_modified' | 'user_specified' | 'import_date';
  confidence: 'high' | 'medium' | 'low';
}

function inferSnapshotDate(file: File, userDate?: Date): SnapshotDateInference {
  // 1. User explicitly set date (highest priority)
  if (userDate) {
    return {
      date: userDate,
      source: 'user_specified',
      confidence: 'high'
    };
  }

  // 2. Parse from filename
  const filenameDate = parseFilenameDate(file.name);
  if (filenameDate) {
    return {
      date: filenameDate,
      source: 'filename',
      confidence: 'high'
    };
  }

  // 3. Use file modification date (if recent)
  const modDate = new Date(file.lastModified);
  if (isWithinLastMonth(modDate)) {
    return {
      date: startOfDay(modDate),
      source: 'file_modified',
      confidence: 'medium'
    };
  }

  // 4. Default to import date
  return {
    date: startOfDay(new Date()),
    source: 'import_date',
    confidence: 'low'
  };
}

// Filename patterns
function parseFilenameDate(filename: string): Date | null {
  const patterns = [
    // Explicit date patterns
    /(\d{4})-(\d{2})-(\d{2})/,           // 2026-01-18
    /(\d{2})-(\d{2})-(\d{4})/,           // 01-18-2026
    /(\d{4})(\d{2})(\d{2})/,             // 20260118

    // Week-of patterns
    /week[_-]?of[_-]?(\d{4})-(\d{2})-(\d{2})/i,
    /wk[_-]?(\d{4})-(\d{2})-(\d{2})/i,

    // Month patterns
    /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[_-]?(\d{1,2})[_-]?(\d{4})/i,
  ];

  for (const pattern of patterns) {
    const match = filename.match(pattern);
    if (match) {
      const parsed = parseMatchToDate(match, pattern);
      if (isValid(parsed) && !isFuture(parsed)) {
        return parsed;
      }
    }
  }

  return null;
}
```

### 9.2 Snapshot Diff Rules

```typescript
interface SnapshotDiffConfig {
  // Minimum snapshots needed for diff
  minSnapshots: 2;

  // Fields to compare for changes
  candidateFields: ['current_stage', 'disposition', 'recruiter_id'];
  reqFields: ['status', 'recruiter_id', 'hiring_manager_id'];

  // Event confidence for diff-generated events
  eventConfidence: 'medium';

  // Dedupe window (don't create duplicate events within N hours)
  dedupeWindowHours: 24;
}

function shouldRunDiff(coverage: CoverageMetrics): boolean {
  return coverage.counts.snapshots >= 2;
}

function runSnapshotDiff(
  fromSnapshot: Snapshot,
  toSnapshot: Snapshot,
  config: SnapshotDiffConfig
): DiffResult {
  const events: GeneratedEvent[] = [];

  // Compare candidates
  const fromCandidates = indexBy(fromSnapshot.candidates, c => `${c.candidate_id}:${c.req_id}`);
  const toCandidates = indexBy(toSnapshot.candidates, c => `${c.candidate_id}:${c.req_id}`);

  for (const [key, toCandidate] of Object.entries(toCandidates)) {
    const fromCandidate = fromCandidates[key];

    if (!fromCandidate) {
      // New candidate
      events.push({
        type: 'CANDIDATE_APPEARED',
        candidate_id: toCandidate.candidate_id,
        req_id: toCandidate.req_id,
        to_value: toCandidate.current_stage,
        event_at: toSnapshot.snapshot_date,
        confidence: 'medium',
        source: 'snapshot_diff'
      });
      continue;
    }

    // Check for changes
    for (const field of config.candidateFields) {
      if (fromCandidate[field] !== toCandidate[field]) {
        events.push({
          type: fieldToEventType(field),
          candidate_id: toCandidate.candidate_id,
          req_id: toCandidate.req_id,
          from_value: fromCandidate[field],
          to_value: toCandidate[field],
          event_at: toSnapshot.snapshot_date,
          confidence: 'medium',
          source: 'snapshot_diff'
        });
      }
    }
  }

  // Check for disappeared candidates
  for (const [key, fromCandidate] of Object.entries(fromCandidates)) {
    if (!toCandidates[key]) {
      events.push({
        type: 'CANDIDATE_DISAPPEARED',
        candidate_id: fromCandidate.candidate_id,
        req_id: fromCandidate.req_id,
        from_value: fromCandidate.current_stage,
        event_at: toSnapshot.snapshot_date,
        confidence: 'low',  // Disappearance is uncertain
        source: 'snapshot_diff'
      });
    }
  }

  return {
    fromSnapshot: fromSnapshot.id,
    toSnapshot: toSnapshot.id,
    events,
    summary: {
      added: events.filter(e => e.type === 'CANDIDATE_APPEARED').length,
      changed: events.filter(e => e.type === 'STAGE_CHANGE').length,
      removed: events.filter(e => e.type === 'CANDIDATE_DISAPPEARED').length
    }
  };
}
```

---

## 10. Tests & Fixtures

### 10.1 Test Structure

```
tests/
├── unit/
│   ├── pipeline/
│   │   ├── detect.test.ts
│   │   ├── map.test.ts
│   │   ├── parse.test.ts
│   │   ├── repair.test.ts
│   │   └── canonicalize.test.ts
│   ├── coverage/
│   │   ├── metrics.test.ts
│   │   └── capabilities.test.ts
│   ├── synthesis/
│   │   └── id-synthesis.test.ts
│   ├── snapshot/
│   │   ├── date-detection.test.ts
│   │   └── diff.test.ts
│   └── suggestions/
│       ├── generation.test.ts
│       └── prioritization.test.ts
├── integration/
│   ├── import-flow.test.ts
│   ├── capability-gating.test.ts
│   └── guidance-flow.test.ts
├── ui-smoke/
│   ├── unavailable-panels.test.tsx
│   ├── capabilities-summary.test.tsx
│   └── cta-buttons.test.tsx
└── fixtures/
    ├── csv/
    │   ├── icims_clean.csv
    │   ├── icims_messy.csv
    │   ├── greenhouse_export.csv
    │   ├── missing_all_dates.csv
    │   ├── no_req_id_column.csv
    │   └── empty_file.csv
    ├── xlsx/
    │   ├── weekly_report_2026-01-18.xlsx
    │   ├── weekly_report_2026-01-11.xlsx
    │   └── multi_sheet.xlsx
    └── expected/
        ├── icims_clean_canonical.json
        ├── icims_messy_audit.json
        └── capability_states.json
```

### 10.2 Unit Test Examples

```typescript
// tests/unit/pipeline/repair.test.ts
describe('Repair Stage', () => {
  describe('NORMALIZE_STAGE', () => {
    it('normalizes known stage names', () => {
      const record = { current_stage: 'Phone Scrn' };
      const result = applyRepairs(record, stageMapping);

      expect(result.current_stage).toBe('SCREEN');
      expect(result._confidence.repairs_applied).toContain('NORMALIZE_STAGE');
    });

    it('does not fabricate stage when missing', () => {
      const record = { current_stage: null };
      const result = applyRepairs(record, stageMapping);

      expect(result.current_stage).toBeNull();
      expect(result._confidence.repairs_applied).not.toContain('NORMALIZE_STAGE');
    });
  });

  describe('No Timestamp Fabrication', () => {
    it('never fabricates applied_at', () => {
      const record = { candidate_id: 'C1', applied_at: null };
      const result = applyRepairs(record, context);

      expect(result.applied_at).toBeNull();
    });

    it('never fabricates hired_at', () => {
      const record = { candidate_id: 'C1', hired_at: null, disposition: 'Hired' };
      const result = applyRepairs(record, context);

      expect(result.hired_at).toBeNull();  // Even though disposition says Hired
    });
  });
});

// tests/unit/synthesis/id-synthesis.test.ts
describe('ID Synthesis', () => {
  it('synthesizes candidate ID from email + req_id', () => {
    const record = { email: 'test@example.com', req_id: 'REQ-123' };
    const result = synthesizeCandidateId(record);

    expect(result.id).toMatch(/^synth:/);
    expect(result.confidence).toBe('high');
    expect(result.method).toBe('CAND_FROM_EMAIL_REQ');
  });

  it('tracks provenance for synthesized IDs', () => {
    const record = { email: 'test@example.com', req_id: 'REQ-123' };
    const result = synthesizeCandidateId(record);

    expect(result._provenance.id_synthesized).toBe(true);
    expect(result._provenance.synthesis_inputs).toEqual({
      email: 'test@example.com',
      req_id: 'REQ-123'
    });
  });

  it('fails gracefully when synthesis not possible', () => {
    const record = { name: null, req_id: null };
    const result = synthesizeCandidateId(record);

    expect(result).toBeNull();
  });
});
```

### 10.3 UI Smoke Tests

```typescript
// tests/ui-smoke/unavailable-panels.test.tsx
describe('UnavailableTabPanel', () => {
  it('renders with correct message and CTA', () => {
    const capability: CapabilityStatus = {
      id: 'tab_hm_friction',
      displayName: 'HM Friction',
      enabled: false,
      disabledReason: 'Missing HM data and stage events',
      upgradeHint: 'Add Hiring Manager column'
    };

    render(<UnavailableTabPanel capability={capability} />);

    expect(screen.getByText('HM Friction')).toBeInTheDocument();
    expect(screen.getByText(/Missing HM data/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /How to unlock/ })).toBeInTheDocument();
  });

  it('opens guidance drawer on CTA click', async () => {
    const onUpgradeClick = jest.fn();

    render(
      <UnavailableTabPanel
        capability={mockCapability}
        onUpgradeClick={onUpgradeClick}
      />
    );

    await userEvent.click(screen.getByRole('button', { name: /How to unlock/ }));

    expect(onUpgradeClick).toHaveBeenCalled();
  });
});

// tests/ui-smoke/capabilities-summary.test.tsx
describe('CapabilitiesSummary', () => {
  it('shows enabled features with checkmarks', () => {
    const coverage = mockCoverageWithGoodData();

    render(<CapabilitiesSummary coverage={coverage} variant="full" />);

    expect(screen.getByText(/✓.*Track.*candidates/)).toBeInTheDocument();
    expect(screen.getByText(/✓.*Calculate time-to-fill/)).toBeInTheDocument();
  });

  it('shows upgrade suggestions with CTAs', () => {
    const coverage = mockCoverageWithMissingSource();

    render(<CapabilitiesSummary coverage={coverage} variant="full" />);

    expect(screen.getByText(/○.*Source Effectiveness/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add Source column/ })).toBeInTheDocument();
  });
});
```

### 10.4 Fixture Requirements

Each fixture must include:

```typescript
interface FixtureDefinition {
  id: string;
  description: string;
  sourceFile: string;  // Path to CSV/XLSX
  expectedOutput: string;  // Path to expected canonical JSON
  expectedAudit: string;  // Path to expected audit log
  testCases: string[];  // What this fixture tests
  expectedCoverage: Partial<CoverageMetrics>;
  expectedCapabilities: Record<string, boolean>;
}

// Example:
{
  id: 'icims_messy',
  description: 'iCIMS export with common data quality issues',
  sourceFile: 'fixtures/csv/icims_messy.csv',
  expectedOutput: 'fixtures/expected/icims_messy_canonical.json',
  expectedAudit: 'fixtures/expected/icims_messy_audit.json',
  testCases: [
    'Detects iCIMS universal report type',
    'Maps 12 of 14 columns',
    'Repairs 5 future dates',
    'Normalizes 8 stage names',
    'Excludes 2 rows with no req_id',
    'Generates 15 warnings',
    'Synthesizes 3 candidate IDs'
  ],
  expectedCoverage: {
    'cand.applied_at': 0.85,
    'cand.source': 0,
    'req.hiring_manager_id': 0.6
  },
  expectedCapabilities: {
    'tab_overview': true,
    'tab_hm_friction': true,
    'tab_source_mix': false,
    'metric_median_ttf': true
  }
}
```

---

## 11. Verification Commands

### 11.1 Build Loop Requirements

Add these commands to the build/CI pipeline:

```bash
# Must pass before merge:
npm run test:unit           # All unit tests
npm run test:integration    # Integration tests
npm run test:ui-smoke       # UI component tests
npm run lint                # ESLint
npm run typecheck           # TypeScript

# Coverage requirements:
npm run test:coverage       # Must be > 80%

# Specific verification:
npm run verify:no-date-fabrication   # Ensure no fallback dates
npm run verify:fatal-only-blocking   # Ensure only fatal errors block
npm run verify:capability-gating     # Ensure UI respects gating
```

### 11.2 Custom Verification Scripts

```typescript
// scripts/verify-no-date-fabrication.ts
/**
 * Scans codebase for patterns that might fabricate dates.
 * Fails if any are found.
 */
const FORBIDDEN_PATTERNS = [
  /applied_at.*\|\|.*new Date\(\)/,
  /hired_at.*\?\?.*Date\.now/,
  /fallback.*=.*new Date/,
  /default.*timestamp.*Date/,
];

// scripts/verify-fatal-only-blocking.ts
/**
 * Ensures only FATAL errors can block import.
 * Checks that all other errors are warnings/exclusions.
 */

// scripts/verify-capability-gating.ts
/**
 * Ensures all capability-gated components check isEnabled().
 * Warns if components render without gating check.
 */
```

### 11.3 Pre-commit Hook

```bash
#!/bin/bash
# .husky/pre-commit

npm run lint
npm run typecheck
npm run verify:no-date-fabrication
npm run test:unit -- --bail
```

---

## 12. Implementation Phases

### Phase 1: Core Pipeline (Week 1-2)
- [ ] Implement DETECT stage
- [ ] Implement MAP stage with column_map.yaml
- [ ] Implement PARSE stage (no date fabrication)
- [ ] Implement REPAIR stage (allowed repairs only)
- [ ] Implement CANONICALIZE stage with provenance
- [ ] Add audit logging

### Phase 2: Coverage & Capabilities (Week 2-3)
- [ ] Implement CoverageMetrics calculation
- [ ] Implement CapabilityRegistry
- [ ] Implement capability gating in existing tabs
- [ ] Create UnavailableTabPanel component
- [ ] Create UnavailableSectionPanel component

### Phase 3: Guidance System (Week 3-4)
- [ ] Implement suggestion generation
- [ ] Implement suggestion prioritization
- [ ] Create CapabilitiesSummary component
- [ ] Implement one-click CTAs
- [ ] Create ColumnMapperDrawer
- [ ] Create SnapshotDatePicker

### Phase 4: Snapshot Integration (Week 4-5)
- [ ] Implement snapshot date inference from filename
- [ ] Implement snapshot storage
- [ ] Implement snapshot diff algorithm
- [ ] Generate events from diffs
- [ ] Enable historical trends when 2+ snapshots

### Phase 5: Testing & Polish (Week 5-6)
- [ ] Write all unit tests
- [ ] Write UI smoke tests
- [ ] Create test fixtures
- [ ] Add verification scripts to CI
- [ ] Documentation

---

## Appendix A: Error Codes

| Code | Severity | Message |
|------|----------|---------|
| FATAL_FILE_EMPTY | fatal | File contains no data rows |
| FATAL_FILE_CORRUPTED | fatal | File is corrupted or unreadable |
| FATAL_NO_IDENTITY | fatal | Cannot identify records |
| EXCLUDE_NO_REQ_ID | exclude | Row has no requisition identifier |
| EXCLUDE_DUPLICATE | exclude | Duplicate record detected |
| WARN_MISSING_DATE | warning | Date field is missing |
| WARN_UNPARSEABLE_DATE | warning | Date could not be parsed |
| WARN_UNKNOWN_STAGE | warning | Stage name not recognized |
| WARN_MISSING_NAME | warning | Name field is missing |
| WARN_FUTURE_DATE | warning | Future date capped to today |
| INFO_COLUMN_UNMAPPED | info | Column not mapped |
| INFO_ID_SYNTHESIZED | info | Record ID was synthesized |

---

## Appendix B: Capability Quick Reference

| Capability | Type | Key Requirements |
|------------|------|------------------|
| tab_hm_friction | tab | HM assignment + stage events |
| tab_velocity | tab | 60% applied dates + stage events |
| tab_source_mix | tab | 40% source data |
| tab_bottlenecks | tab | Stage events with from/to |
| section_ttf_chart | section | 50% applied dates + 5 hires |
| section_trends | section | 2+ snapshots |
| widget_hm_latency | widget | HM assignment + stage events |
| widget_source_breakdown | widget | Source data present |
| metric_median_ttf | metric | 50% applied dates + 3 hires |

---

*End of Plan*
