# SLA Attribution V1 - Technical Specification

## Overview

SLA + Bottleneck Attribution answers **"where did time go"** and **"who is blocking"** using defensible, snapshot-diff-powered metrics. This feature provides:

1. **Stage Dwell Time** - How long candidates spend in each stage
2. **SLA Breach Detection** - Which stages exceed configurable time limits
3. **Owner Attribution** - Who is responsible for delays (HM vs Recruiter vs Ops)
4. **Bottleneck Ranking** - Which stages slow down hiring most

**Data Source**: Snapshot diff event stream (`snapshot_events` table)

**Hard Constraints**:
- No LLM for calculations - deterministic only
- Fail closed if snapshot coverage insufficient
- No duplicated UI - canonical home is Diagnose
- Aggregated views only (no per-person shaming)

---

## 1. Data Contracts (TypeScript Types)

### 1.1 SLA Policy Configuration

```typescript
// types/slaTypes.ts

/**
 * Owner type for SLA attribution
 */
export type SlaOwnerType = 'HM' | 'RECRUITER' | 'OPS' | 'UNKNOWN';

/**
 * Confidence level for attribution
 */
export type AttributionConfidence = 'high' | 'medium' | 'low';

/**
 * SLA Policy - Defines time limits per stage
 * Stored in organization config (org_settings.sla_policies)
 */
export interface SlaPolicy {
  /** Canonical stage key (e.g., 'HM_SCREEN', 'OFFER') */
  stage_key: string;

  /** Maximum hours allowed in this stage before breach */
  sla_hours: number;

  /** Default owner responsible for this stage */
  owner_type: SlaOwnerType;

  /** Whether this SLA is actively tracked */
  enabled: boolean;

  /** Human-readable stage name for display */
  display_name: string;
}

/**
 * Default SLA policies (V1 hardcoded, V2 org-configurable)
 */
export const DEFAULT_SLA_POLICIES: SlaPolicy[] = [
  { stage_key: 'SCREEN', sla_hours: 48, owner_type: 'RECRUITER', enabled: true, display_name: 'Recruiter Screen' },
  { stage_key: 'HM_SCREEN', sla_hours: 72, owner_type: 'HM', enabled: true, display_name: 'HM Screen' },
  { stage_key: 'ONSITE', sla_hours: 120, owner_type: 'HM', enabled: true, display_name: 'Onsite Interview' },
  { stage_key: 'FINAL', sla_hours: 48, owner_type: 'HM', enabled: true, display_name: 'Final Decision' },
  { stage_key: 'OFFER', sla_hours: 72, owner_type: 'RECRUITER', enabled: true, display_name: 'Offer Stage' },
];
```

### 1.2 Stage Dwell Metric

```typescript
/**
 * Measured dwell time for a candidate in a specific stage
 * Computed from snapshot diff events
 */
export interface StageDwellMetric {
  /** Requisition ID */
  req_id: string;

  /** Candidate ID */
  candidate_id: string;

  /** Canonical stage key */
  stage_key: string;

  /** When candidate entered this stage (from STAGE_CHANGE event) */
  entered_at: Date;

  /** When candidate exited this stage (null if still in stage) */
  exited_at: Date | null;

  /** Total hours in stage (computed or ongoing) */
  dwell_hours: number;

  /** Whether SLA was breached */
  breached: boolean;

  /** Hours over SLA limit (0 if not breached) */
  breach_hours: number;

  /** Applicable SLA policy (null if no policy for this stage) */
  sla_policy: SlaPolicy | null;

  // === Attribution ===

  /** Who is responsible for this stage's time */
  attribution_owner_type: SlaOwnerType;

  /** Attribution owner ID (HM user_id, recruiter user_id, or null for OPS) */
  attribution_owner_id: string | null;

  /** Attribution owner name for display */
  attribution_owner_name: string | null;

  /** Confidence in attribution */
  attribution_confidence: AttributionConfidence;

  /** Reasons for attribution decision */
  attribution_reasons: string[];

  // === Provenance ===

  /** Event ID that started this dwell period */
  enter_event_id: string | null;

  /** Event ID that ended this dwell period */
  exit_event_id: string | null;

  /** Whether this is from snapshot diff (true) or inferred (false) */
  is_observed: boolean;
}
```

### 1.3 Bottleneck Summary

```typescript
/**
 * Aggregated bottleneck statistics
 */
export interface StageBottleneck {
  /** Canonical stage key */
  stage_key: string;

  /** Human-readable stage name */
  display_name: string;

  /** Median dwell hours across all candidates */
  median_dwell_hours: number;

  /** P90 dwell hours */
  p90_dwell_hours: number;

  /** Total candidates measured in this stage */
  candidate_count: number;

  /** Candidates who breached SLA */
  breach_count: number;

  /** Breach rate (0-1) */
  breach_rate: number;

  /** Total hours lost to breaches */
  total_breach_hours: number;

  /** Default owner type for this stage */
  owner_type: SlaOwnerType;

  /** Bottleneck score (higher = worse, for ranking) */
  bottleneck_score: number;
}

/**
 * Owner-level breach aggregation
 */
export interface OwnerBreachSummary {
  /** Owner type */
  owner_type: SlaOwnerType;

  /** Owner ID (user_id) */
  owner_id: string;

  /** Owner name for display */
  owner_name: string;

  /** Total breaches attributed to this owner */
  breach_count: number;

  /** Total breach hours */
  total_breach_hours: number;

  /** Average breach hours per instance */
  avg_breach_hours: number;

  /** Stages where breaches occurred */
  breach_stages: string[];

  /** Requisitions with breaches */
  req_ids: string[];
}

/**
 * Requisition-level breach summary
 */
export interface ReqBreachSummary {
  req_id: string;
  req_title: string;
  recruiter_id: string | null;
  recruiter_name: string | null;
  hiring_manager_id: string | null;
  hiring_manager_name: string | null;

  /** Total breaches on this req */
  breach_count: number;

  /** Total breach hours */
  total_breach_hours: number;

  /** Worst breach stage */
  worst_stage: string;

  /** Worst breach hours */
  worst_breach_hours: number;

  /** Days req has been open */
  days_open: number;

  /** Current pipeline count */
  candidate_count: number;
}

/**
 * Coverage statistics for gating
 */
export interface SnapshotCoverage {
  /** Total snapshots in date range */
  snapshot_count: number;

  /** Total diff events generated */
  event_count: number;

  /** Oldest snapshot date */
  oldest_snapshot: Date | null;

  /** Newest snapshot date */
  newest_snapshot: Date | null;

  /** Days spanned by snapshots */
  day_span: number;

  /** Average days between snapshots */
  avg_gap_days: number;

  /** Percentage of days with snapshots */
  coverage_percent: number;

  /** Whether coverage is sufficient for SLA tracking */
  is_sufficient: boolean;

  /** Reasons if insufficient */
  insufficiency_reasons: string[];
}

/**
 * Complete bottleneck summary
 */
export interface BottleneckSummary {
  /** Top bottleneck stages ranked by score */
  top_stages: StageBottleneck[];

  /** Top reqs by breach hours */
  top_reqs: ReqBreachSummary[];

  /** Owner leaderboard (aggregated HMs) */
  top_owners: OwnerBreachSummary[];

  /** Breach counts by stage */
  breach_counts: Record<string, number>;

  /** Breach counts by owner type */
  breach_by_owner_type: Record<SlaOwnerType, number>;

  /** Coverage statistics */
  coverage: SnapshotCoverage;

  /** Date range for this summary */
  date_range: {
    start: Date;
    end: Date;
  };

  /** Total candidates analyzed */
  total_candidates_analyzed: number;

  /** Total dwell records */
  total_dwell_records: number;

  /** Computation timestamp */
  computed_at: Date;
}
```

---

## 2. Computation Steps

### 2.1 Building Stage Enter/Exit Timestamps

**Input**: `snapshot_events` table filtered by `organization_id` and date range

**Algorithm**:

```typescript
/**
 * Build stage dwell periods from snapshot events
 */
function buildStageDwellPeriods(
  events: SnapshotEvent[],
  candidateId: string,
  reqId: string
): StageDwellPeriod[] {
  // 1. Filter to STAGE_CHANGE and STAGE_REGRESSION events for this candidate+req
  const stageEvents = events
    .filter(e =>
      e.candidate_id === candidateId &&
      e.req_id === reqId &&
      (e.event_type === 'STAGE_CHANGE' || e.event_type === 'STAGE_REGRESSION')
    )
    .sort((a, b) => a.event_at.getTime() - b.event_at.getTime());

  // 2. Also get CANDIDATE_APPEARED for initial stage
  const appearedEvent = events.find(e =>
    e.candidate_id === candidateId &&
    e.req_id === reqId &&
    e.event_type === 'CANDIDATE_APPEARED'
  );

  const periods: StageDwellPeriod[] = [];

  // 3. If appeared event exists, first period starts there
  if (appearedEvent && appearedEvent.to_canonical) {
    periods.push({
      stage_key: appearedEvent.to_canonical,
      entered_at: appearedEvent.event_at,
      exited_at: null, // Will be set by first STAGE_CHANGE
      enter_event_id: appearedEvent.id,
      exit_event_id: null
    });
  }

  // 4. Process each stage change
  for (const event of stageEvents) {
    // Close previous period
    if (periods.length > 0 && periods[periods.length - 1].exited_at === null) {
      periods[periods.length - 1].exited_at = event.event_at;
      periods[periods.length - 1].exit_event_id = event.id;
    }

    // Open new period (if moving to non-terminal stage)
    if (event.to_canonical && !isTerminalStage(event.to_canonical)) {
      periods.push({
        stage_key: event.to_canonical,
        entered_at: event.event_at,
        exited_at: null,
        enter_event_id: event.id,
        exit_event_id: null
      });
    }
  }

  return periods;
}
```

### 2.2 Computing Dwell Time per Stage per Req

```typescript
/**
 * Compute dwell hours from a period
 */
function computeDwellHours(period: StageDwellPeriod, asOfDate: Date): number {
  const endTime = period.exited_at ?? asOfDate;
  const durationMs = endTime.getTime() - period.entered_at.getTime();
  return durationMs / (1000 * 60 * 60); // Convert to hours
}

/**
 * Check if SLA is breached
 */
function checkSlaBreach(
  dwellHours: number,
  stageKey: string,
  policies: SlaPolicy[]
): { breached: boolean; breachHours: number; policy: SlaPolicy | null } {
  const policy = policies.find(p => p.stage_key === stageKey && p.enabled);

  if (!policy) {
    return { breached: false, breachHours: 0, policy: null };
  }

  const breached = dwellHours > policy.sla_hours;
  const breachHours = breached ? dwellHours - policy.sla_hours : 0;

  return { breached, breachHours, policy };
}
```

### 2.3 Regression Detection and Handling

```typescript
/**
 * Detect and handle stage regressions
 *
 * Regressions occur when a candidate moves backward in the funnel.
 * This can happen due to:
 * - Reschedules (Onsite -> HM Screen)
 * - Process changes
 * - Data corrections
 *
 * Treatment:
 * - Log regression event
 * - DO NOT double-count dwell time
 * - If candidate returns to same stage, start new dwell period
 * - Mark the dwell period as having a regression
 */
function handleRegression(
  events: SnapshotEvent[],
  candidateId: string,
  reqId: string
): DwellPeriodWithRegressions[] {
  const periods = buildStageDwellPeriods(events, candidateId, reqId);

  // Track stage visits to detect re-entries
  const stageVisits: Map<string, number> = new Map();

  return periods.map(period => {
    const visitCount = (stageVisits.get(period.stage_key) ?? 0) + 1;
    stageVisits.set(period.stage_key, visitCount);

    // Find any regression events during this period
    const regressionEvents = events.filter(e =>
      e.candidate_id === candidateId &&
      e.req_id === reqId &&
      e.event_type === 'STAGE_REGRESSION' &&
      e.event_at >= period.entered_at &&
      (!period.exited_at || e.event_at <= period.exited_at)
    );

    return {
      ...period,
      is_reentry: visitCount > 1,
      visit_number: visitCount,
      has_regression: regressionEvents.length > 0,
      regression_count: regressionEvents.length
    };
  });
}
```

### 2.4 Attribution Rules

**Stage -> Default Owner Mapping**:

| Canonical Stage | Default Owner | Rationale |
|-----------------|---------------|-----------|
| LEAD | OPS | Pre-application, sourcing |
| APPLIED | RECRUITER | Initial review |
| SCREEN | RECRUITER | Recruiter screen |
| HM_SCREEN | HM | HM interview scheduling & feedback |
| ONSITE | HM | Panel interview coordination |
| FINAL | HM | Final decision |
| OFFER | RECRUITER | Offer creation & negotiation |
| HIRED | OPS | Onboarding |
| REJECTED | RECRUITER | Rejection communication |
| WITHDREW | OPS | Candidate withdrew |

**Attribution Confidence Rules**:

```typescript
/**
 * Attribute delay to an owner with confidence scoring
 */
function attributeDelay(
  stageKey: string,
  reqId: string,
  requisitions: Map<string, Requisition>,
  policies: SlaPolicy[]
): AttributionResult {
  const policy = policies.find(p => p.stage_key === stageKey);
  const req = requisitions.get(reqId);

  // Rule 1: Use policy default owner
  const defaultOwner = policy?.owner_type ?? 'UNKNOWN';

  // Rule 2: Look up actual owner ID from requisition
  let ownerId: string | null = null;
  let ownerName: string | null = null;

  if (defaultOwner === 'HM' && req?.hiring_manager_id) {
    ownerId = req.hiring_manager_id;
    ownerName = req.hiring_manager_name ?? req.hiring_manager_id;
  } else if (defaultOwner === 'RECRUITER' && req?.recruiter_id) {
    ownerId = req.recruiter_id;
    ownerName = req.recruiter_name ?? req.recruiter_id;
  }

  // Rule 3: Determine confidence
  let confidence: AttributionConfidence = 'low';
  const reasons: string[] = [];

  if (policy) {
    reasons.push(`Stage ${stageKey} has SLA policy assigning to ${defaultOwner}`);
    confidence = 'medium';

    if (ownerId) {
      reasons.push(`Requisition has ${defaultOwner} assigned: ${ownerName}`);
      confidence = 'high';
    } else {
      reasons.push(`No ${defaultOwner} assigned to requisition`);
    }
  } else {
    reasons.push(`No SLA policy for stage ${stageKey}, defaulting to UNKNOWN`);
  }

  return {
    owner_type: ownerId ? defaultOwner : 'UNKNOWN',
    owner_id: ownerId,
    owner_name: ownerName,
    confidence,
    reasons
  };
}
```

### 2.5 Minimum Sample Thresholds and Gating

```typescript
/**
 * Thresholds for SLA Attribution feature
 */
export const SLA_THRESHOLDS = {
  /** Minimum snapshots required for any dwell calculation */
  MIN_SNAPSHOTS_FOR_DWELL: 2,

  /** Minimum day span for SLA tracking to be meaningful */
  MIN_DAYS_SPAN_FOR_SLA: 7,

  /** Maximum gap between snapshots (days) before warning */
  MAX_SNAPSHOT_GAP_DAYS: 3,

  /** Minimum candidates per stage for bottleneck ranking */
  MIN_CANDIDATES_PER_STAGE: 5,

  /** Minimum coverage percentage for confident reporting */
  MIN_COVERAGE_PERCENT: 50,

  /** Minimum breaches to show owner in leaderboard */
  MIN_BREACHES_FOR_LEADERBOARD: 3,
};

/**
 * Check if snapshot coverage is sufficient
 */
function checkCoverageSufficiency(
  snapshots: DataSnapshot[],
  dateRange: { start: Date; end: Date }
): SnapshotCoverage {
  if (snapshots.length === 0) {
    return {
      snapshot_count: 0,
      event_count: 0,
      oldest_snapshot: null,
      newest_snapshot: null,
      day_span: 0,
      avg_gap_days: 0,
      coverage_percent: 0,
      is_sufficient: false,
      insufficiency_reasons: ['No snapshots found in date range']
    };
  }

  const sorted = [...snapshots].sort((a, b) =>
    a.snapshot_date.getTime() - b.snapshot_date.getTime()
  );

  const oldest = sorted[0].snapshot_date;
  const newest = sorted[sorted.length - 1].snapshot_date;
  const daySpan = Math.ceil((newest.getTime() - oldest.getTime()) / (1000 * 60 * 60 * 24));

  // Calculate average gap
  let totalGap = 0;
  for (let i = 1; i < sorted.length; i++) {
    const gap = (sorted[i].snapshot_date.getTime() - sorted[i-1].snapshot_date.getTime())
                / (1000 * 60 * 60 * 24);
    totalGap += gap;
  }
  const avgGapDays = sorted.length > 1 ? totalGap / (sorted.length - 1) : 0;

  // Calculate coverage percent (snapshots / day span)
  const coveragePercent = daySpan > 0 ? (snapshots.length / daySpan) * 100 : 0;

  // Check sufficiency
  const reasons: string[] = [];

  if (snapshots.length < SLA_THRESHOLDS.MIN_SNAPSHOTS_FOR_DWELL) {
    reasons.push(`Need at least ${SLA_THRESHOLDS.MIN_SNAPSHOTS_FOR_DWELL} snapshots, have ${snapshots.length}`);
  }

  if (daySpan < SLA_THRESHOLDS.MIN_DAYS_SPAN_FOR_SLA) {
    reasons.push(`Need at least ${SLA_THRESHOLDS.MIN_DAYS_SPAN_FOR_SLA} days of data, have ${daySpan}`);
  }

  if (avgGapDays > SLA_THRESHOLDS.MAX_SNAPSHOT_GAP_DAYS) {
    reasons.push(`Average gap between snapshots is ${avgGapDays.toFixed(1)} days, should be <${SLA_THRESHOLDS.MAX_SNAPSHOT_GAP_DAYS}`);
  }

  if (coveragePercent < SLA_THRESHOLDS.MIN_COVERAGE_PERCENT) {
    reasons.push(`Coverage is ${coveragePercent.toFixed(0)}%, should be >${SLA_THRESHOLDS.MIN_COVERAGE_PERCENT}%`);
  }

  return {
    snapshot_count: snapshots.length,
    event_count: snapshots.reduce((sum, s) => sum + (s.events_generated ?? 0), 0),
    oldest_snapshot: oldest,
    newest_snapshot: newest,
    day_span: daySpan,
    avg_gap_days: avgGapDays,
    coverage_percent: coveragePercent,
    is_sufficient: reasons.length === 0,
    insufficiency_reasons: reasons
  };
}
```

### 2.6 Bottleneck Score Calculation

```typescript
/**
 * Calculate bottleneck score for ranking stages
 * Higher score = worse bottleneck
 *
 * Formula: (median_dwell * breach_rate * ln(candidate_count + 1)) / sla_hours
 *
 * Rationale:
 * - Median dwell: how slow the stage is
 * - Breach rate: how often it fails SLA
 * - ln(candidate_count): volume impact (log to avoid domination by high-volume stages)
 * - Divided by SLA hours: normalize across stages with different expectations
 */
function calculateBottleneckScore(stage: StageBottleneck): number {
  if (stage.candidate_count === 0) return 0;

  const policy = DEFAULT_SLA_POLICIES.find(p => p.stage_key === stage.stage_key);
  const slaHours = policy?.sla_hours ?? 72; // Default to 72h if no policy

  const volumeFactor = Math.log(stage.candidate_count + 1);
  const score = (stage.median_dwell_hours * stage.breach_rate * volumeFactor) / slaHours;

  return Math.round(score * 100) / 100; // Round to 2 decimals
}
```

---

## 3. UI Placement and UX

### 3.1 Navigation

Add to `navStructure.ts` under Diagnose bucket:

```typescript
// In NAV_STRUCTURE.diagnose.submenu:
{ id: 'bottlenecks', label: 'Bottlenecks & SLAs', route: '/diagnose/bottlenecks' }
```

Position: After "HM Scorecard", before "Quality Guardrails"

### 3.2 Page Layout

```
┌─────────────────────────────────────────────────────────────────────────┐
│ [Coverage Banner - Yellow if insufficient, Green if OK]                  │
│ "Snapshot Coverage: 85% (23 snapshots over 27 days) ✓ SLA tracking OK"  │
│ or                                                                       │
│ "⚠️ Insufficient data for SLA tracking. Fix: [Import more snapshots]"   │
└─────────────────────────────────────────────────────────────────────────┘

┌───────────────────────────────┐  ┌───────────────────────────────────────┐
│  TOP BOTTLENECK STAGES        │  │  SLA BREACH SUMMARY                   │
│  ─────────────────────────    │  │  ───────────────────                  │
│  1. HM Screen     🔴 42%      │  │  Total Breaches: 47                   │
│     Median: 96h  (SLA: 72h)   │  │  Total Hours Lost: 312h               │
│     Score: 2.4                │  │  ─────────────────────                │
│                               │  │  By Owner Type:                       │
│  2. Final         🟡 28%      │  │  • HM: 31 breaches (66%)              │
│     Median: 52h  (SLA: 48h)   │  │  • Recruiter: 12 breaches (26%)       │
│     Score: 1.8                │  │  • Ops: 4 breaches (8%)               │
│                               │  │                                       │
│  3. Onsite        🟢 12%      │  │  [Create Actions] [View Evidence]     │
│     Median: 98h  (SLA: 120h)  │  │                                       │
│     Score: 0.9                │  │                                       │
└───────────────────────────────┘  └───────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│  SLA BREACH TABLE                                              [Export] │
│  ───────────────────────────────────────────────────────────────────    │
│  Req              Stage      Breach Hours  Owner      Days Open  Action │
│  ─────────────────────────────────────────────────────────────────────  │
│  ENG-1234         HM Screen      48.5h     J. Smith        34    [→]    │
│  PM-5678          Final          24.0h     A. Lee          28    [→]    │
│  DESIGN-9012      HM Screen      18.2h     J. Smith        21    [→]    │
│  ...                                                                     │
│  Showing 10 of 47 breaches                            [Show More]        │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│  OWNER LEADERBOARD (HMs with most breaches)                             │
│  ───────────────────────────────────────────────────────────────────    │
│  Owner           Breaches   Avg Breach Hours   Stages                   │
│  ─────────────────────────────────────────────────────────────────────  │
│  J. Smith            12          32.5h         HM Screen, Final         │
│  A. Lee               8          28.0h         Final, Onsite            │
│  M. Johnson           6          18.5h         HM Screen                │
│  ─────────────────────────────────────────────────────────────────────  │
│  Note: Shows HMs with 3+ breaches. Recruiter/Ops aggregated by type.    │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.3 Req Drilldown Drawer

When clicking a req row, slide-in drawer shows:

```
┌─────────────────────────────────────────────────────────────────────────┐
│  REQ DETAIL: ENG-1234 - Senior Engineer                         [X]    │
│  ───────────────────────────────────────────────────────────────────    │
│  Recruiter: Jane Doe    HM: John Smith    Days Open: 34                 │
│                                                                          │
│  STAGE TIMELINE                                                          │
│  ─────────────────────────────────────────────────────────────────────  │
│  ┌─────────┬─────────┬─────────┬─────────┬─────────┐                    │
│  │ Applied │ Screen  │HM Screen│ Onsite  │  Final  │                    │
│  │  2.1h   │  12.4h  │ 96.5h 🔴│  24.0h  │ In Prog │                    │
│  │ Rec     │  Rec    │   HM    │   HM    │   HM    │                    │
│  └─────────┴─────────┴─────────┴─────────┴─────────┘                    │
│                         ↑ BREACH: 24.5h over SLA                        │
│                                                                          │
│  BREACH DETAILS                                                          │
│  Stage: HM Screen (SLA: 72h)                                            │
│  Entered: Jan 5, 2026 10:00 AM                                          │
│  Exited: Jan 9, 2026 10:30 AM                                           │
│  Duration: 96.5h                                                         │
│  Breach: 24.5h over SLA                                                 │
│  Attribution: HM (John Smith) - High confidence                         │
│  Reason: Stage has SLA policy assigning to HM; Req has HM assigned      │
│                                                                          │
│  [View in HM Scorecard] [Create Action for HM] [View Candidate]         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.4 Buttons and Actions

**"Create Actions" Button**:
- Generates `ActionItem` records for each unresolved breach
- Deduplicates by `(owner_type, owner_id, req_id, action_type)`
- Action types: `SLA_BREACH_HM_SCREEN`, `SLA_BREACH_FINAL`, etc.
- Priority mapping: breach_hours > 48h = P0, > 24h = P1, else P2

**"View Evidence" Button**:
- Opens deep link to relevant view:
  - HM breaches → HM Scorecard filtered to that HM
  - Recruiter breaches → Recruiter Performance filtered
  - Req breaches → Req detail drawer

### 3.5 Coverage Banner States

| State | Color | Message | Actions |
|-------|-------|---------|---------|
| Sufficient | Green | "✓ SLA tracking enabled (85% coverage)" | None |
| Warning | Yellow | "⚠️ Limited SLA data (3-day gaps detected)" | "Import more frequently" |
| Insufficient | Red | "❌ Cannot track SLAs (only 1 snapshot)" | "Import at least 2 snapshots" |
| No Data | Gray | "No snapshot data available" | "Start by importing data" |

---

## 4. Integration Plan

### 4.1 Explain Engine Integration

Add new provider: `slaAttributionProvider.ts`

```typescript
// services/explain/providers/slaAttributionProvider.ts

export const slaAttributionProvider: ExplainProvider = {
  id: 'sla_attribution',

  canExplain(context: ExplainContext): BlockedReason[] {
    const reasons: BlockedReason[] = [];

    // Check for snapshot data availability
    // This would need to be added to ExplainContext
    if (!context.snapshotCoverage?.is_sufficient) {
      reasons.push({
        type: 'insufficient_data',
        message: 'Not enough snapshot data for SLA analysis',
        fix: 'Import data snapshots more frequently (at least every 3 days)'
      });
    }

    return reasons;
  },

  explain(context: ExplainContext): Explanation {
    const bottleneckSummary = computeBottleneckSummary(context);

    return {
      kpi_key: 'sla_attribution',
      title: 'SLA & Bottleneck Analysis',
      value: bottleneckSummary.top_stages[0]?.median_dwell_hours ?? null,
      unit: 'hours',
      status: bottleneckSummary.breach_counts['HM_SCREEN'] > 10 ? 'red' :
              bottleneckSummary.breach_counts['HM_SCREEN'] > 5 ? 'yellow' : 'green',
      drivers: bottleneckSummary.top_stages.slice(0, 3).map(stage => ({
        factor: stage.display_name,
        impact: `${stage.breach_rate * 100}% breach rate, ${stage.median_dwell_hours}h median`,
        evidence_key: `bottleneck_summary.top_stages[${stage.stage_key}]`
      })),
      recommended_actions: generateSlaActions(bottleneckSummary),
      sample_size: bottleneckSummary.total_candidates_analyzed,
      confidence: bottleneckSummary.coverage.is_sufficient ? 'high' : 'low'
    };
  }
};
```

### 4.2 Unified Action Queue Integration

Add new action types to `actionTypes.ts`:

```typescript
// Add to ActionType union
export type ActionType =
  // ... existing types ...
  // SLA Breach Actions (new)
  | 'SLA_BREACH_SCREEN'
  | 'SLA_BREACH_HM_SCREEN'
  | 'SLA_BREACH_ONSITE'
  | 'SLA_BREACH_FINAL'
  | 'SLA_BREACH_OFFER';
```

**Action Generation Function**:

```typescript
// services/slaActionService.ts

export function generateSlaBreachActions(
  bottleneckSummary: BottleneckSummary,
  existingActions: ActionItem[]
): ActionItem[] {
  const newActions: ActionItem[] = [];

  for (const req of bottleneckSummary.top_reqs) {
    // Get worst breach for this req
    const actionType = `SLA_BREACH_${req.worst_stage}` as ActionType;

    // Determine owner
    const ownerType = getSlaOwnerType(req.worst_stage);
    const ownerId = ownerType === 'HM' ? req.hiring_manager_id : req.recruiter_id;
    const ownerName = ownerType === 'HM' ? req.hiring_manager_name : req.recruiter_name;

    if (!ownerId) continue;

    // Check for duplicate
    const actionId = generateActionId(ownerType, ownerId, req.req_id, actionType);
    if (existingActions.some(a => a.action_id === actionId)) continue;

    // Determine priority
    const priority: ActionPriority =
      req.worst_breach_hours > 48 ? 'P0' :
      req.worst_breach_hours > 24 ? 'P1' : 'P2';

    newActions.push({
      action_id: actionId,
      owner_type: ownerType,
      owner_id: ownerId,
      owner_name: ownerName ?? ownerId,
      req_id: req.req_id,
      req_title: req.req_title,
      action_type: actionType,
      title: `SLA breach: ${req.worst_stage} (${req.worst_breach_hours.toFixed(0)}h over)`,
      priority,
      due_in_days: priority === 'P0' ? 0 : priority === 'P1' ? 1 : 3,
      due_date: new Date(Date.now() + (priority === 'P0' ? 0 : priority === 'P1' ? 86400000 : 259200000)),
      evidence: {
        kpi_key: 'sla_breach',
        explain_provider_key: 'sla_attribution',
        short_reason: `${req.worst_stage} exceeded SLA by ${req.worst_breach_hours.toFixed(0)} hours`
      },
      recommended_steps: [
        `Review candidates in ${req.worst_stage} stage`,
        `Expedite feedback or decision`,
        `Communicate timeline to candidates`
      ],
      created_at: new Date(),
      status: 'OPEN'
    });
  }

  return newActions;
}
```

### 4.3 Ask PlatoVue Integration

Add to `AskFactPack`:

```typescript
// types/askTypes.ts - Add to AskFactPack interface

export interface AskFactPack {
  // ... existing fields ...

  /** SLA & Bottleneck data */
  bottlenecks: {
    /** Top 5 bottleneck stages */
    top_stages: {
      stage: string;
      display_name: string;
      median_hours: number;
      sla_hours: number;
      breach_rate: number;
      bottleneck_score: number;
    }[];

    /** Summary stats */
    summary: {
      total_breaches: number;
      total_breach_hours: number;
      breaches_by_owner_type: Record<string, number>;
      worst_stage: string;
      worst_owner_type: string;
    };

    /** Coverage status */
    coverage: {
      is_sufficient: boolean;
      snapshot_count: number;
      day_span: number;
      coverage_percent: number;
    };

    /** Deep link to bottleneck page */
    deep_link: '/diagnose/bottlenecks';
  };
}
```

**Intent Handlers** - Add to `askIntentService.ts`:

```typescript
// New intent: 'bottleneck_analysis'
// Trigger phrases: "where is time going", "what's the bottleneck", "why so slow", "SLA breaches"

{
  intent: 'bottleneck_analysis',
  patterns: ['bottleneck', 'sla', 'slow', 'time going', 'delay', 'breach'],
  handler: (factPack) => {
    const { bottlenecks } = factPack;

    if (!bottlenecks.coverage.is_sufficient) {
      return {
        answer: `I don't have enough snapshot data to analyze bottlenecks. ` +
                `You have ${bottlenecks.coverage.snapshot_count} snapshots over ` +
                `${bottlenecks.coverage.day_span} days. Import more frequently for SLA tracking.`,
        citations: [{ key_path: 'bottlenecks.coverage', value: bottlenecks.coverage }]
      };
    }

    const top = bottlenecks.top_stages[0];
    return {
      answer: `Your biggest bottleneck is **${top.display_name}** with a ` +
              `${(top.breach_rate * 100).toFixed(0)}% SLA breach rate. ` +
              `Median dwell time is ${top.median_hours.toFixed(0)}h vs SLA of ${top.sla_hours}h. ` +
              `Total of ${bottlenecks.summary.total_breaches} breaches (` +
              `${bottlenecks.summary.breaches_by_owner_type.HM ?? 0} HM, ` +
              `${bottlenecks.summary.breaches_by_owner_type.RECRUITER ?? 0} Recruiter).`,
      citations: [
        { key_path: 'bottlenecks.top_stages[0]', value: top },
        { key_path: 'bottlenecks.summary', value: bottlenecks.summary }
      ],
      deep_link: bottlenecks.deep_link
    };
  }
}
```

---

## 5. Configuration Plan

### 5.1 V1: Hardcoded Defaults

In V1, SLA policies are hardcoded in `types/slaTypes.ts`:

```typescript
export const DEFAULT_SLA_POLICIES: SlaPolicy[] = [
  { stage_key: 'SCREEN', sla_hours: 48, owner_type: 'RECRUITER', enabled: true, display_name: 'Recruiter Screen' },
  { stage_key: 'HM_SCREEN', sla_hours: 72, owner_type: 'HM', enabled: true, display_name: 'HM Screen' },
  { stage_key: 'ONSITE', sla_hours: 120, owner_type: 'HM', enabled: true, display_name: 'Onsite Interview' },
  { stage_key: 'FINAL', sla_hours: 48, owner_type: 'HM', enabled: true, display_name: 'Final Decision' },
  { stage_key: 'OFFER', sla_hours: 72, owner_type: 'RECRUITER', enabled: true, display_name: 'Offer Stage' },
];
```

**Location**: `src/productivity-dashboard/types/slaTypes.ts`

### 5.2 V2: Org-Configurable (Future)

Store in Supabase `organization_settings` table:

```sql
-- Add to org_settings JSONB column
{
  "sla_policies": [
    { "stage_key": "HM_SCREEN", "sla_hours": 48, "owner_type": "HM", "enabled": true },
    ...
  ]
}
```

UI would be added under Settings > Organization with an SLA configuration section.

---

## 6. Test Plan

### 6.1 Unit Tests

**File**: `services/__tests__/slaAttributionService.test.ts`

```typescript
describe('SLA Attribution Service', () => {
  describe('buildStageDwellPeriods', () => {
    it('builds dwell periods from two consecutive snapshots', () => {
      const events = [
        mockEvent({ type: 'CANDIDATE_APPEARED', to_canonical: 'APPLIED', event_at: day(0) }),
        mockEvent({ type: 'STAGE_CHANGE', from_canonical: 'APPLIED', to_canonical: 'SCREEN', event_at: day(1) }),
        mockEvent({ type: 'STAGE_CHANGE', from_canonical: 'SCREEN', to_canonical: 'HM_SCREEN', event_at: day(3) }),
      ];

      const periods = buildStageDwellPeriods(events, 'cand1', 'req1');

      expect(periods).toHaveLength(3);
      expect(periods[0].stage_key).toBe('APPLIED');
      expect(periods[0].dwell_hours).toBeCloseTo(24); // 1 day
      expect(periods[1].stage_key).toBe('SCREEN');
      expect(periods[1].dwell_hours).toBeCloseTo(48); // 2 days
    });

    it('handles ongoing dwell (no exit event)', () => {
      const events = [
        mockEvent({ type: 'STAGE_CHANGE', to_canonical: 'HM_SCREEN', event_at: day(-2) }),
      ];

      const periods = buildStageDwellPeriods(events, 'cand1', 'req1');

      expect(periods[0].exited_at).toBeNull();
      expect(periods[0].dwell_hours).toBeGreaterThan(48); // At least 2 days
    });
  });

  describe('regression detection', () => {
    it('detects backward stage movement', () => {
      const events = [
        mockEvent({ type: 'STAGE_CHANGE', from_canonical: 'SCREEN', to_canonical: 'HM_SCREEN', event_at: day(0) }),
        mockEvent({ type: 'STAGE_REGRESSION', from_canonical: 'HM_SCREEN', to_canonical: 'SCREEN', event_at: day(2) }),
      ];

      const periods = handleRegression(events, 'cand1', 'req1');

      expect(periods[1].is_reentry).toBe(true);
      expect(periods[1].visit_number).toBe(2);
    });

    it('does not count terminal stage as regression', () => {
      expect(isStageRegression('OFFER', 'REJECTED')).toBe(false);
      expect(isStageRegression('OFFER', 'WITHDREW')).toBe(false);
    });
  });

  describe('attribution mapping', () => {
    it('attributes HM_SCREEN to HM with high confidence when HM assigned', () => {
      const result = attributeDelay('HM_SCREEN', 'req1', mockReqs, DEFAULT_SLA_POLICIES);

      expect(result.owner_type).toBe('HM');
      expect(result.confidence).toBe('high');
    });

    it('returns UNKNOWN with low confidence when no owner assigned', () => {
      const result = attributeDelay('HM_SCREEN', 'req_no_hm', mockReqsNoOwner, DEFAULT_SLA_POLICIES);

      expect(result.owner_type).toBe('UNKNOWN');
      expect(result.confidence).toBe('low');
    });
  });

  describe('coverage gating', () => {
    it('returns insufficient when only 1 snapshot', () => {
      const coverage = checkCoverageSufficiency([mockSnapshot()], dateRange);

      expect(coverage.is_sufficient).toBe(false);
      expect(coverage.insufficiency_reasons).toContain(expect.stringContaining('at least 2 snapshots'));
    });

    it('returns sufficient with 7+ days and 50%+ coverage', () => {
      const snapshots = Array(10).fill(0).map((_, i) => mockSnapshot({ day: i }));
      const coverage = checkCoverageSufficiency(snapshots, { start: day(0), end: day(14) });

      expect(coverage.is_sufficient).toBe(true);
      expect(coverage.insufficiency_reasons).toHaveLength(0);
    });
  });
});
```

### 6.2 UI Smoke Tests

**File**: `components/__tests__/BottlenecksTab.test.tsx`

```typescript
describe('BottlenecksTab', () => {
  it('renders coverage banner with status', () => {
    render(<BottlenecksTab />);
    expect(screen.getByTestId('coverage-banner')).toBeInTheDocument();
  });

  it('shows insufficient data message when coverage low', () => {
    mockCoverage({ is_sufficient: false, insufficiency_reasons: ['Need 2+ snapshots'] });
    render(<BottlenecksTab />);

    expect(screen.getByText(/insufficient data/i)).toBeInTheDocument();
    expect(screen.getByText(/need 2\+ snapshots/i)).toBeInTheDocument();
  });

  it('renders top bottleneck stages when data sufficient', () => {
    mockCoverage({ is_sufficient: true });
    mockBottleneckSummary({ top_stages: [mockStage({ stage_key: 'HM_SCREEN', breach_rate: 0.42 })] });

    render(<BottlenecksTab />);

    expect(screen.getByText('HM Screen')).toBeInTheDocument();
    expect(screen.getByText('42%')).toBeInTheDocument();
  });

  it('opens drilldown drawer when clicking req row', async () => {
    render(<BottlenecksTab />);

    await userEvent.click(screen.getByText('ENG-1234'));

    expect(screen.getByTestId('req-drilldown-drawer')).toBeVisible();
    expect(screen.getByText('Stage Timeline')).toBeInTheDocument();
  });

  it('creates deduped actions when clicking Create Actions', async () => {
    const mockCreateActions = jest.fn();
    render(<BottlenecksTab onCreateActions={mockCreateActions} />);

    await userEvent.click(screen.getByText('Create Actions'));

    expect(mockCreateActions).toHaveBeenCalled();
    const actions = mockCreateActions.mock.calls[0][0];
    // Check no duplicate action_ids
    const ids = actions.map(a => a.action_id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
```

### 6.3 Data Fixtures

**File**: `services/__tests__/fixtures/slaFixtures.ts`

```typescript
export const mockSnapshots = [
  {
    id: 'snap1',
    snapshot_date: new Date('2026-01-01'),
    snapshot_seq: 1,
    candidate_count: 50,
    req_count: 10,
    events_generated: 0,
    status: 'completed'
  },
  {
    id: 'snap2',
    snapshot_date: new Date('2026-01-03'),
    snapshot_seq: 2,
    candidate_count: 52,
    req_count: 10,
    events_generated: 15,
    status: 'completed'
  },
  {
    id: 'snap3',
    snapshot_date: new Date('2026-01-06'),
    snapshot_seq: 3,
    candidate_count: 55,
    req_count: 11,
    events_generated: 22,
    status: 'completed'
  }
];

export const mockEvents: SnapshotEvent[] = [
  // Candidate 1: Normal flow with HM_SCREEN breach
  { id: 'e1', event_type: 'CANDIDATE_APPEARED', candidate_id: 'cand1', req_id: 'req1', to_canonical: 'APPLIED', event_at: new Date('2026-01-01T10:00:00Z') },
  { id: 'e2', event_type: 'STAGE_CHANGE', candidate_id: 'cand1', req_id: 'req1', from_canonical: 'APPLIED', to_canonical: 'SCREEN', event_at: new Date('2026-01-01T14:00:00Z') },
  { id: 'e3', event_type: 'STAGE_CHANGE', candidate_id: 'cand1', req_id: 'req1', from_canonical: 'SCREEN', to_canonical: 'HM_SCREEN', event_at: new Date('2026-01-02T10:00:00Z') },
  { id: 'e4', event_type: 'STAGE_CHANGE', candidate_id: 'cand1', req_id: 'req1', from_canonical: 'HM_SCREEN', to_canonical: 'ONSITE', event_at: new Date('2026-01-06T10:00:00Z') }, // 96h = breach!

  // Candidate 2: Regression scenario
  { id: 'e5', event_type: 'CANDIDATE_APPEARED', candidate_id: 'cand2', req_id: 'req1', to_canonical: 'SCREEN', event_at: new Date('2026-01-01T10:00:00Z') },
  { id: 'e6', event_type: 'STAGE_CHANGE', candidate_id: 'cand2', req_id: 'req1', from_canonical: 'SCREEN', to_canonical: 'HM_SCREEN', event_at: new Date('2026-01-02T10:00:00Z') },
  { id: 'e7', event_type: 'STAGE_REGRESSION', candidate_id: 'cand2', req_id: 'req1', from_canonical: 'HM_SCREEN', to_canonical: 'SCREEN', event_at: new Date('2026-01-03T10:00:00Z') },
  { id: 'e8', event_type: 'STAGE_CHANGE', candidate_id: 'cand2', req_id: 'req1', from_canonical: 'SCREEN', to_canonical: 'HM_SCREEN', event_at: new Date('2026-01-04T10:00:00Z') },
];

export const mockRequisitions: Requisition[] = [
  {
    req_id: 'req1',
    title: 'Senior Engineer',
    recruiter_id: 'rec1',
    recruiter_name: 'Jane Doe',
    hiring_manager_id: 'hm1',
    hiring_manager_name: 'John Smith',
    status: 'Open',
    opened_at: new Date('2025-12-15')
  }
];
```

---

## 7. Non-Goals

1. **No external market data** - We don't compare to industry benchmarks
2. **No causal claims** - We measure dwell time and breaches, not root causes
3. **No per-person public shaming** - HM leaderboard is aggregated, requires 3+ breaches to appear
4. **No real-time alerting** - This is batch analysis on snapshot data
5. **No LLM explanations in V1** - BYOK AI may narrate results later but must cite deterministic outputs
6. **No custom SLA config UI in V1** - Policies are hardcoded, org config comes in V2

---

## 8. File Structure

```
src/productivity-dashboard/
├── types/
│   └── slaTypes.ts                    # New: SLA type definitions
├── services/
│   ├── slaAttributionService.ts       # New: Core computation service
│   ├── slaActionService.ts            # New: Action generation
│   └── explain/providers/
│       └── slaAttributionProvider.ts  # New: Explain engine provider
├── components/
│   └── bottlenecks/
│       ├── BottlenecksTab.tsx         # New: Main tab component
│       ├── CoverageBanner.tsx         # New: Coverage status banner
│       ├── BottleneckStagesPanel.tsx  # New: Top stages panel
│       ├── BreachTable.tsx            # New: SLA breach table
│       ├── OwnerLeaderboard.tsx       # New: Owner aggregation
│       └── ReqDrilldownDrawer.tsx     # New: Req detail drawer
└── services/__tests__/
    ├── slaAttributionService.test.ts  # New: Unit tests
    └── fixtures/
        └── slaFixtures.ts             # New: Test fixtures
```

---

## 9. Success Criteria

- [ ] `docs/plans/SLA_ATTRIBUTION_V1.md` is comprehensive and implementation-ready
- [ ] Types defined: `SlaPolicy`, `StageDwellMetric`, `BottleneckSummary`, `SnapshotCoverage`
- [ ] Computation rules explicit: dwell time, regression handling, attribution, confidence
- [ ] Thresholds defined: MIN_SNAPSHOTS=2, MIN_DAYS=7, MAX_GAP=3, MIN_COVERAGE=50%
- [ ] UI mockups: Coverage banner, Top stages, Breach table, Owner leaderboard, Drilldown
- [ ] Integration points: Explain Engine provider, Action Queue types, Ask PlatoVue fact pack
- [ ] Config plan: V1 hardcoded defaults, V2 Supabase org_settings
- [ ] Test plan: Unit tests for computation, UI smoke tests, fixtures provided

---

## Appendix: Glossary

| Term | Definition |
|------|------------|
| **Dwell Time** | Hours a candidate spends in a single stage |
| **SLA** | Service Level Agreement - maximum allowed time in a stage |
| **Breach** | When dwell time exceeds SLA threshold |
| **Regression** | Candidate moving backward in the funnel (e.g., Onsite → HM Screen) |
| **Attribution** | Assigning responsibility for delay to HM, Recruiter, or Ops |
| **Bottleneck Score** | Composite metric ranking stages by impact on hiring speed |
| **Snapshot** | Point-in-time capture of all candidates and requisitions |
| **Diff Event** | Change detected between two consecutive snapshots |
