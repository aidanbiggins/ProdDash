# Snapshot Diff Event Stream V1 Plan

## Overview

This plan defines a system for computing **true dwell time, regressions, and SLA timing** by treating each CSV import as a dated snapshot and diffing consecutive snapshots to emit granular stage-change events.

### Problem Statement

Currently, PlatoVue relies on:
1. **Current-state timestamps** (`current_stage_entered_at`) which only tell us when a candidate entered their *current* stage
2. **Inferred events** from explicit timestamp columns (e.g., `Date First Interviewed: Phone Screen`)

This approach cannot detect:
- **Regressions**: Candidate moved from ONSITE → SCREEN (kicked back)
- **True dwell time**: How long a candidate spent in *each* stage, not just the current one
- **SLA violations**: Whether stage transitions happened within expected timeframes

### Solution

Convert from a **point-in-time snapshot model** to a **temporal event stream model**:
1. Each CSV import is stored as a **dated snapshot**
2. The system **diffs** snapshot N-1 vs snapshot N to emit **synthetic events**
3. Events are stored with full provenance (which snapshots they came from)
4. Metrics engine can now compute true stage durations, regressions, and SLA compliance

---

## 1. Snapshot Table Schema

### Table: `data_snapshots`

Stores metadata about each imported snapshot (not the raw data itself).

```sql
CREATE TABLE data_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Snapshot identification
  snapshot_date DATE NOT NULL,           -- The "as-of" date this snapshot represents
  snapshot_seq INTEGER NOT NULL,         -- Monotonic sequence within org (1, 2, 3...)

  -- Import metadata
  source_filename TEXT,                  -- Original CSV filename
  source_hash TEXT,                      -- SHA-256 of raw CSV content (dedupe)
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  imported_by UUID REFERENCES auth.users(id),

  -- Record counts (for quick validation)
  req_count INTEGER NOT NULL DEFAULT 0,
  candidate_count INTEGER NOT NULL DEFAULT 0,
  user_count INTEGER NOT NULL DEFAULT 0,

  -- Processing status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'superseded')),
  diff_completed_at TIMESTAMPTZ,
  events_generated INTEGER DEFAULT 0,
  error_message TEXT,

  -- Constraints
  UNIQUE(organization_id, snapshot_seq),
  UNIQUE(organization_id, source_hash)  -- Prevent duplicate imports
);

-- Indexes
CREATE INDEX idx_snapshots_org_date ON data_snapshots(organization_id, snapshot_date DESC);
CREATE INDEX idx_snapshots_org_seq ON data_snapshots(organization_id, snapshot_seq DESC);
CREATE INDEX idx_snapshots_status ON data_snapshots(status) WHERE status IN ('pending', 'processing');
```

### Table: `snapshot_candidates`

Stores the candidate state at each snapshot point. This is the diff source.

```sql
CREATE TABLE snapshot_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id UUID NOT NULL REFERENCES data_snapshots(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Candidate identity (natural key)
  candidate_id TEXT NOT NULL,            -- From CSV
  req_id TEXT NOT NULL,                  -- From CSV

  -- State at this snapshot
  current_stage TEXT NOT NULL,           -- Raw stage name from CSV
  canonical_stage TEXT,                  -- Normalized to CanonicalStage enum
  disposition TEXT,                      -- Active/Rejected/Withdrawn/Hired

  -- Timestamps from CSV (snapshot point-in-time)
  applied_at TIMESTAMPTZ,
  current_stage_entered_at TIMESTAMPTZ,
  hired_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  withdrawn_at TIMESTAMPTZ,
  offer_extended_at TIMESTAMPTZ,

  -- Source tracing
  source_row_number INTEGER,             -- Row in original CSV
  raw_data JSONB,                        -- Full row for audit

  UNIQUE(snapshot_id, candidate_id, req_id)
);

-- Indexes for diff queries
CREATE INDEX idx_snap_cand_snapshot ON snapshot_candidates(snapshot_id);
CREATE INDEX idx_snap_cand_candidate ON snapshot_candidates(candidate_id, req_id);
CREATE INDEX idx_snap_cand_org ON snapshot_candidates(organization_id);
```

### Table: `snapshot_requisitions`

Stores requisition state at each snapshot point (for req status change events).

```sql
CREATE TABLE snapshot_requisitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id UUID NOT NULL REFERENCES data_snapshots(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Req identity
  req_id TEXT NOT NULL,

  -- State at this snapshot
  status TEXT,                           -- Open/Closed/OnHold/Canceled
  recruiter_id TEXT,
  hiring_manager_id TEXT,

  -- Timestamps
  opened_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,

  -- Source tracing
  source_row_number INTEGER,
  raw_data JSONB,

  UNIQUE(snapshot_id, req_id)
);

CREATE INDEX idx_snap_req_snapshot ON snapshot_requisitions(snapshot_id);
CREATE INDEX idx_snap_req_req ON snapshot_requisitions(req_id);
```

---

## 2. Snapshot Event Schema

### Table: `snapshot_events`

Events generated by diffing consecutive snapshots.

```sql
CREATE TABLE snapshot_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Event identity
  event_type TEXT NOT NULL CHECK (event_type IN (
    'STAGE_CHANGE',           -- Candidate moved stages
    'STAGE_REGRESSION',       -- Candidate moved backwards
    'DISPOSITION_CHANGE',     -- Active→Rejected, etc.
    'REQ_STATUS_CHANGE',      -- Open→Closed, etc.
    'CANDIDATE_APPEARED',     -- New candidate in snapshot
    'CANDIDATE_DISAPPEARED',  -- Candidate removed (rare, data issue)
    'REQ_APPEARED',           -- New req in snapshot
    'REQ_DISAPPEARED'         -- Req removed
  )),

  -- Entity references
  candidate_id TEXT,
  req_id TEXT,

  -- State change details
  from_value TEXT,                       -- Previous stage/disposition/status
  to_value TEXT,                         -- New stage/disposition/status
  from_canonical TEXT,                   -- Normalized from_value
  to_canonical TEXT,                     -- Normalized to_value

  -- Temporal data
  event_at TIMESTAMPTZ NOT NULL,         -- Inferred event time (see algorithm)

  -- Provenance (critical for trust)
  from_snapshot_id UUID REFERENCES data_snapshots(id),
  to_snapshot_id UUID NOT NULL REFERENCES data_snapshots(id),
  from_snapshot_date DATE,
  to_snapshot_date DATE NOT NULL,

  -- Confidence scoring
  confidence TEXT NOT NULL DEFAULT 'medium' CHECK (confidence IN ('high', 'medium', 'low', 'inferred')),
  confidence_reasons TEXT[],

  -- Metadata
  metadata JSONB,                        -- Additional context (e.g., regression details)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for query patterns
CREATE INDEX idx_snap_events_org ON snapshot_events(organization_id);
CREATE INDEX idx_snap_events_candidate ON snapshot_events(candidate_id, req_id);
CREATE INDEX idx_snap_events_req ON snapshot_events(req_id);
CREATE INDEX idx_snap_events_type ON snapshot_events(event_type);
CREATE INDEX idx_snap_events_time ON snapshot_events(organization_id, event_at DESC);
CREATE INDEX idx_snap_events_to_snap ON snapshot_events(to_snapshot_id);
```

---

## 3. RLS Policies

All new tables follow the existing organization-scoped pattern.

```sql
-- Enable RLS
ALTER TABLE data_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE snapshot_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE snapshot_requisitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE snapshot_events ENABLE ROW LEVEL SECURITY;

-- Grant table access
GRANT SELECT, INSERT, UPDATE, DELETE ON data_snapshots TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON snapshot_candidates TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON snapshot_requisitions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON snapshot_events TO authenticated;

-- data_snapshots policies
CREATE POLICY "snapshots_select" ON data_snapshots
  FOR SELECT USING (is_super_admin() OR organization_id IN (SELECT user_org_ids()));

CREATE POLICY "snapshots_insert" ON data_snapshots
  FOR INSERT WITH CHECK (is_super_admin() OR is_org_admin(organization_id));

CREATE POLICY "snapshots_update" ON data_snapshots
  FOR UPDATE USING (is_super_admin() OR is_org_admin(organization_id));

CREATE POLICY "snapshots_delete" ON data_snapshots
  FOR DELETE USING (is_super_admin() OR is_org_admin(organization_id));

-- snapshot_candidates policies (same pattern)
CREATE POLICY "snap_cand_select" ON snapshot_candidates
  FOR SELECT USING (is_super_admin() OR organization_id IN (SELECT user_org_ids()));

CREATE POLICY "snap_cand_insert" ON snapshot_candidates
  FOR INSERT WITH CHECK (is_super_admin() OR is_org_admin(organization_id));

CREATE POLICY "snap_cand_update" ON snapshot_candidates
  FOR UPDATE USING (is_super_admin() OR is_org_admin(organization_id));

CREATE POLICY "snap_cand_delete" ON snapshot_candidates
  FOR DELETE USING (is_super_admin() OR is_org_admin(organization_id));

-- snapshot_requisitions policies (same pattern)
CREATE POLICY "snap_req_select" ON snapshot_requisitions
  FOR SELECT USING (is_super_admin() OR organization_id IN (SELECT user_org_ids()));

CREATE POLICY "snap_req_insert" ON snapshot_requisitions
  FOR INSERT WITH CHECK (is_super_admin() OR is_org_admin(organization_id));

CREATE POLICY "snap_req_update" ON snapshot_requisitions
  FOR UPDATE USING (is_super_admin() OR is_org_admin(organization_id));

CREATE POLICY "snap_req_delete" ON snapshot_requisitions
  FOR DELETE USING (is_super_admin() OR is_org_admin(organization_id));

-- snapshot_events policies (same pattern)
CREATE POLICY "snap_events_select" ON snapshot_events
  FOR SELECT USING (is_super_admin() OR organization_id IN (SELECT user_org_ids()));

CREATE POLICY "snap_events_insert" ON snapshot_events
  FOR INSERT WITH CHECK (is_super_admin() OR is_org_admin(organization_id));

CREATE POLICY "snap_events_update" ON snapshot_events
  FOR UPDATE USING (is_super_admin() OR is_org_admin(organization_id));

CREATE POLICY "snap_events_delete" ON snapshot_events
  FOR DELETE USING (is_super_admin() OR is_org_admin(organization_id));
```

---

## 4. Diff Algorithm

### 4.1 Overview

```
Snapshot N-1 (previous)     Snapshot N (current)
─────────────────────────   ─────────────────────
Candidate A: SCREEN         Candidate A: ONSITE      → STAGE_CHANGE event
Candidate B: ONSITE         Candidate B: SCREEN      → STAGE_REGRESSION event
Candidate C: Active         Candidate C: Rejected    → DISPOSITION_CHANGE event
Candidate D: exists         (missing)                → CANDIDATE_DISAPPEARED event
(missing)                   Candidate E: exists      → CANDIDATE_APPEARED event
```

### 4.2 Matching Keys

**Candidate matching**: `(candidate_id, req_id)` tuple
- Rationale: Same candidate can apply to multiple reqs; each is tracked separately

**Requisition matching**: `req_id`
- Rationale: Unique identifier for the position

### 4.3 Change Detection Logic

```typescript
interface DiffResult {
  stageChanges: StageChangeEvent[];
  stageRegressions: StageRegressionEvent[];
  dispositionChanges: DispositionChangeEvent[];
  reqStatusChanges: ReqStatusChangeEvent[];
  appeared: AppearedEvent[];
  disappeared: DisappearedEvent[];
}

function diffSnapshots(prev: Snapshot | null, curr: Snapshot): DiffResult {
  const result: DiffResult = { ... };

  // Build lookup maps
  const prevCandidates = new Map(prev?.candidates.map(c => [`${c.candidate_id}:${c.req_id}`, c]));
  const currCandidates = new Map(curr.candidates.map(c => [`${c.candidate_id}:${c.req_id}`, c]));

  // Detect changes for existing candidates
  for (const [key, currCand] of currCandidates) {
    const prevCand = prevCandidates.get(key);

    if (!prevCand) {
      // New candidate appeared
      result.appeared.push({ candidate_id, req_id, snapshot_id: curr.id });
      continue;
    }

    // Stage change detection
    if (prevCand.canonical_stage !== currCand.canonical_stage) {
      const isRegression = isStageRegression(prevCand.canonical_stage, currCand.canonical_stage);

      if (isRegression) {
        result.stageRegressions.push({
          candidate_id, req_id,
          from_stage: prevCand.canonical_stage,
          to_stage: currCand.canonical_stage,
          event_at: inferEventTime(prevCand, currCand, prev, curr),
          confidence: 'medium',
          confidence_reasons: ['Inferred from snapshot diff']
        });
      } else {
        result.stageChanges.push({
          candidate_id, req_id,
          from_stage: prevCand.canonical_stage,
          to_stage: currCand.canonical_stage,
          event_at: inferEventTime(prevCand, currCand, prev, curr),
          confidence: determineConfidence(prevCand, currCand)
        });
      }
    }

    // Disposition change detection
    if (prevCand.disposition !== currCand.disposition) {
      result.dispositionChanges.push({ ... });
    }
  }

  // Detect disappeared candidates
  for (const [key, prevCand] of prevCandidates) {
    if (!currCandidates.has(key)) {
      result.disappeared.push({ candidate_id: prevCand.candidate_id, req_id: prevCand.req_id });
    }
  }

  // Similar logic for requisitions...

  return result;
}
```

### 4.4 Stage Regression Detection

```typescript
// Canonical stage ordering (lower index = earlier in funnel)
const STAGE_ORDER: CanonicalStage[] = [
  'LEAD', 'APPLIED', 'SCREEN', 'HM_SCREEN', 'ONSITE', 'FINAL', 'OFFER', 'HIRED'
];

// Terminal stages are not in the funnel
const TERMINAL_STAGES = new Set(['REJECTED', 'WITHDREW']);

function isStageRegression(from: string, to: string): boolean {
  // Moving to terminal stage is not a regression
  if (TERMINAL_STAGES.has(to)) return false;

  // Moving from terminal back to funnel is a regression (reactivation)
  if (TERMINAL_STAGES.has(from) && !TERMINAL_STAGES.has(to)) return true;

  const fromIndex = STAGE_ORDER.indexOf(from as CanonicalStage);
  const toIndex = STAGE_ORDER.indexOf(to as CanonicalStage);

  // If either stage is unknown, can't determine regression
  if (fromIndex === -1 || toIndex === -1) return false;

  // Regression if moving to earlier stage
  return toIndex < fromIndex;
}
```

### 4.5 Event Time Inference

The event time is inferred using the best available data:

```typescript
function inferEventTime(
  prevCand: SnapshotCandidate,
  currCand: SnapshotCandidate,
  prevSnapshot: Snapshot,
  currSnapshot: Snapshot
): { event_at: Date; confidence: Confidence } {

  // BEST: current_stage_entered_at changed and is populated
  if (currCand.current_stage_entered_at &&
      currCand.current_stage_entered_at !== prevCand.current_stage_entered_at) {
    return {
      event_at: currCand.current_stage_entered_at,
      confidence: 'high'
    };
  }

  // GOOD: Terminal timestamp matches the change
  if (currCand.disposition === 'Hired' && currCand.hired_at) {
    return { event_at: currCand.hired_at, confidence: 'high' };
  }
  if (currCand.disposition === 'Rejected' && currCand.rejected_at) {
    return { event_at: currCand.rejected_at, confidence: 'high' };
  }
  if (currCand.disposition === 'Withdrawn' && currCand.withdrawn_at) {
    return { event_at: currCand.withdrawn_at, confidence: 'high' };
  }

  // FALLBACK: Midpoint between snapshots
  const midpoint = new Date(
    (prevSnapshot.snapshot_date.getTime() + currSnapshot.snapshot_date.getTime()) / 2
  );
  return {
    event_at: midpoint,
    confidence: 'inferred'
  };
}
```

---

## 5. Backfill Strategy

### 5.1 Ordering

Snapshots MUST be processed in chronological order by `snapshot_date`:
1. Sort all snapshots for org by `snapshot_date ASC`
2. Assign `snapshot_seq` (1, 2, 3...) based on this order
3. Process diffs: (null → 1), (1 → 2), (2 → 3), ...

### 5.2 Idempotency

Each diff operation is idempotent:
1. Before processing diff (A → B), delete any existing events where `to_snapshot_id = B.id`
2. Generate new events
3. Mark snapshot B as `status = 'completed'`

```typescript
async function processDiff(orgId: string, toSnapshotId: string): Promise<void> {
  // 1. Clear any existing events for this target snapshot (idempotent)
  await supabase
    .from('snapshot_events')
    .delete()
    .eq('organization_id', orgId)
    .eq('to_snapshot_id', toSnapshotId);

  // 2. Get current and previous snapshots
  const curr = await getSnapshot(toSnapshotId);
  const prev = await getPreviousSnapshot(orgId, curr.snapshot_seq);

  // 3. Run diff algorithm
  const events = diffSnapshots(prev, curr);

  // 4. Batch insert events
  await batchInsertEvents(events);

  // 5. Update snapshot status
  await supabase
    .from('data_snapshots')
    .update({ status: 'completed', diff_completed_at: new Date(), events_generated: events.length })
    .eq('id', toSnapshotId);
}
```

### 5.3 Deduplication

**Import-level dedupe**: `source_hash` (SHA-256 of CSV content) prevents importing the same file twice.

**Event-level dedupe**: Not needed because we delete existing events before regenerating.

### 5.4 Backfill Trigger

Backfill runs when:
1. **New import**: User imports a CSV → create snapshot → diff against previous
2. **Manual re-process**: Admin triggers re-diff for a snapshot
3. **Initial migration**: One-time job to convert existing events table data into snapshot format

---

## 6. Performance Strategy

### 6.1 Batching

**Snapshot storage**: Insert candidates/reqs in batches of 500 rows:
```typescript
const BATCH_SIZE = 500;
for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
  const batch = candidates.slice(i, i + BATCH_SIZE);
  await supabase.from('snapshot_candidates').insert(batch);
}
```

**Event insertion**: Same pattern for generated events.

### 6.2 Pagination

**Diff query**: Load candidates in pages to avoid memory issues:
```typescript
async function* loadSnapshotCandidates(snapshotId: string): AsyncGenerator<SnapshotCandidate[]> {
  let offset = 0;
  const pageSize = 1000;

  while (true) {
    const { data } = await supabase
      .from('snapshot_candidates')
      .select('*')
      .eq('snapshot_id', snapshotId)
      .range(offset, offset + pageSize - 1);

    if (!data || data.length === 0) break;
    yield data;
    offset += pageSize;
    if (data.length < pageSize) break;
  }
}
```

### 6.3 Limits

| Limit | Value | Rationale |
|-------|-------|-----------|
| Max candidates per snapshot | 50,000 | Memory constraint for diff map |
| Max reqs per snapshot | 10,000 | Reasonable upper bound |
| Max snapshots per org | 365 | One year of daily snapshots |
| Diff batch size | 500 | Supabase insert performance |
| Query page size | 1,000 | Balance memory vs round trips |

### 6.4 Background Processing

For large imports (>10,000 candidates):
1. Mark snapshot as `status = 'processing'`
2. Process diff asynchronously (Supabase Edge Function or job queue)
3. UI shows progress indicator
4. Mark as `status = 'completed'` when done

---

## 7. Gating Rules

Features that require snapshot events are gated until sufficient data exists.

### 7.1 Data Coverage Capability Flags

```typescript
interface DataCoverageFlags {
  // Basic capabilities (always available)
  hasCurrentState: boolean;           // Always true if data imported

  // Snapshot-dependent capabilities
  hasSnapshotHistory: boolean;        // At least 2 snapshots exist
  hasTrueDwellTime: boolean;          // Can compute actual stage durations
  hasRegressionDetection: boolean;    // Can detect stage regressions
  hasSLATracking: boolean;            // Can compute SLA compliance

  // Sample size requirements
  minSnapshotsForDwell: number;       // 2 snapshots minimum
  minDaysSpanForSLA: number;          // 14 days of snapshot history
}

function computeDataCoverage(orgId: string): DataCoverageFlags {
  const snapshots = await getCompletedSnapshots(orgId);
  const daySpan = snapshots.length > 1
    ? daysBetween(snapshots[0].snapshot_date, snapshots[snapshots.length - 1].snapshot_date)
    : 0;

  return {
    hasCurrentState: true,
    hasSnapshotHistory: snapshots.length >= 2,
    hasTrueDwellTime: snapshots.length >= 2,
    hasRegressionDetection: snapshots.length >= 2,
    hasSLATracking: snapshots.length >= 2 && daySpan >= 14,
    minSnapshotsForDwell: 2,
    minDaysSpanForSLA: 14
  };
}
```

### 7.2 Gated Features

| Feature | Gate Condition | Fallback Behavior |
|---------|---------------|-------------------|
| Stage dwell time breakdown | `hasTrueDwellTime` | Show "N/A - requires 2+ imports" |
| Regression count metric | `hasRegressionDetection` | Hide metric entirely |
| SLA compliance % | `hasSLATracking` | Show "Insufficient history" |
| Velocity decay curves | `hasTrueDwellTime` | Use current-state timestamps |
| HM latency distribution | `hasTrueDwellTime` | Use current-state timestamps |

### 7.3 Upgrade Path

When user imports a second snapshot:
1. System detects `hasSnapshotHistory` changed from false → true
2. Show toast: "Stage timing now available! View detailed dwell times."
3. Gated features automatically unlock

---

## 8. UI Changes

### 8.1 Data Coverage Panel

Add a new panel to Settings → Data Health (or Control Tower):

```
┌─────────────────────────────────────────────────────────────┐
│ Data Coverage                                               │
├─────────────────────────────────────────────────────────────┤
│ Snapshots: 3 imports over 21 days                          │
│ ├─ 2025-12-15 (baseline)     4,521 candidates              │
│ ├─ 2025-12-22 (+7 days)      4,687 candidates (+166)       │
│ └─ 2025-12-29 (+14 days)     4,892 candidates (+205)       │
│                                                             │
│ Capabilities Unlocked:                                      │
│ ✅ Stage dwell time tracking                                │
│ ✅ Regression detection                                     │
│ ✅ SLA compliance tracking                                  │
│ ⚠️  Velocity decay curves (need 30+ days)                   │
│                                                             │
│ [Import New Snapshot]                                       │
└─────────────────────────────────────────────────────────────┘
```

### 8.2 Import Flow Changes

1. **Import modal** shows:
   - "This will create Snapshot #4 (as of 2025-01-05)"
   - "Previous snapshot: 2025-12-29"
   - Warning if gap > 14 days: "Large gap may reduce accuracy"

2. **Post-import** shows:
   - "Processing diff... 205 stage changes detected"
   - "12 regressions found"
   - Success: "Snapshot imported. Stage timing updated."

### 8.3 Gated Feature Messaging

When a gated feature is accessed without required data:

```
┌────────────────────────────────────────────────────┐
│ Stage Dwell Time                                   │
├────────────────────────────────────────────────────┤
│ 📊 This feature requires snapshot history          │
│                                                    │
│ Import at least 2 data snapshots to unlock:        │
│ • True stage duration tracking                     │
│ • Regression detection                             │
│ • SLA compliance metrics                           │
│                                                    │
│ You have: 1 snapshot                               │
│ Need: 2 snapshots (minimum 7 days apart)           │
│                                                    │
│ [Import New Snapshot]  [Learn More]                │
└────────────────────────────────────────────────────┘
```

---

## 9. Test Plan

### 9.1 Unit Tests

**File**: `services/__tests__/snapshotDiffService.test.ts`

| Test Case | Input | Expected Output |
|-----------|-------|-----------------|
| Stage forward change | SCREEN → ONSITE | `STAGE_CHANGE` event |
| Stage regression | ONSITE → SCREEN | `STAGE_REGRESSION` event |
| Disposition change | Active → Rejected | `DISPOSITION_CHANGE` event |
| New candidate | Not in prev, in curr | `CANDIDATE_APPEARED` event |
| Missing candidate | In prev, not in curr | `CANDIDATE_DISAPPEARED` event |
| Req status change | Open → Closed | `REQ_STATUS_CHANGE` event |
| No change | Same state | No event |
| Multiple changes | Stage + disposition | Two events |
| First snapshot (no prev) | null → snapshot | Only `APPEARED` events |
| Event time from timestamp | `current_stage_entered_at` present | High confidence |
| Event time inferred | No timestamp | Midpoint, low confidence |

**File**: `services/__tests__/stageRegressionDetection.test.ts`

| Test Case | From → To | Expected |
|-----------|-----------|----------|
| Forward in funnel | SCREEN → ONSITE | Not regression |
| Backward in funnel | ONSITE → SCREEN | Regression |
| To terminal | ONSITE → REJECTED | Not regression |
| From terminal | REJECTED → SCREEN | Regression (reactivation) |
| Unknown stage | CUSTOM → ONSITE | Not regression (unknown) |

### 9.2 Integration Tests

**File**: `services/__tests__/snapshotDiffIntegration.test.ts`

| Test Case | Description |
|-----------|-------------|
| End-to-end import | Import CSV → snapshot stored → diff runs → events created |
| Idempotent re-run | Run diff twice → same events (no duplicates) |
| Batch processing | 10,000 candidates → completes without timeout |
| RLS enforcement | User A can't see User B's snapshots |
| Backfill ordering | Import out-of-order → events still chronological |

### 9.3 Smoke Tests

Manual checklist for QA:

- [ ] Import first CSV → snapshot created, status = completed
- [ ] Import second CSV → diff runs, events appear in UI
- [ ] View Data Coverage panel → shows 2 snapshots
- [ ] Stage dwell time metric → shows actual values (not N/A)
- [ ] Regression count → displays correctly
- [ ] Clear database → snapshots and events deleted
- [ ] Different org → cannot see other org's data

---

## 10. Non-Goals (V1 Scope)

The following are explicitly **out of scope** for V1:

| Non-Goal | Rationale |
|----------|-----------|
| ML-based anomaly detection | V2 feature; need baseline data first |
| New chart visualizations | Focus on data layer; charts reuse existing patterns |
| Real-time streaming | Batch import model is sufficient |
| Webhook ingestion | CSV upload is current integration method |
| Multi-file import in one snapshot | Single file per snapshot for simplicity |
| Partial snapshot updates | Full snapshot replacement only |
| Snapshot comparison UI | V2 feature; focus on event stream first |
| Custom stage ordering per org | Use global canonical stage order |
| Retroactive event editing | Events are immutable once generated |
| Export snapshot data | Standard CSV export covers this |

---

## 11. Migration Path

### 11.1 Phase 1: Schema Creation (Migration 008)

1. Create all new tables (data_snapshots, snapshot_candidates, snapshot_requisitions, snapshot_events)
2. Create RLS policies
3. Create indexes

### 11.2 Phase 2: Service Implementation

1. `snapshotService.ts` - CRUD for snapshots
2. `snapshotDiffService.ts` - Diff algorithm
3. `snapshotEventService.ts` - Event queries
4. Update `csvParser.ts` to create snapshot on import

### 11.3 Phase 3: UI Integration

1. Add Data Coverage panel
2. Update import flow
3. Gate features based on coverage flags

### 11.4 Phase 4: Backfill Existing Data (Optional)

For orgs with existing data:
1. Treat current data as "Snapshot 1"
2. Next import becomes "Snapshot 2"
3. Diff generates first batch of events

---

## 12. Open Questions (Resolved)

| Question | Resolution |
|----------|------------|
| Store raw CSV or parsed? | Store parsed (snapshot_candidates) with raw_data JSONB for audit |
| What if snapshot dates overlap? | Unique constraint on (org_id, source_hash) prevents exact duplicates; same-day imports increment seq |
| How to handle timezone? | All timestamps stored in UTC; snapshot_date is DATE (no time) |
| What about candidate ID changes? | Candidate ID from ATS is immutable; changes treated as new candidate |

---

## 13. Success Metrics

After V1 launch, measure:

| Metric | Target |
|--------|--------|
| Orgs with 2+ snapshots | 50% within 30 days |
| Avg days between snapshots | < 14 days |
| Regression detection rate | Baseline measurement |
| Stage dwell accuracy vs manual audit | > 95% match |
| Diff processing time (10k candidates) | < 30 seconds |
