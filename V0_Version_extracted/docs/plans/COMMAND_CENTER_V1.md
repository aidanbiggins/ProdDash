# Command Center V1

**Status**: Planning
**Created**: 2026-01-22
**Author**: Claude Code
**Supersedes**: Control Tower (current default landing)

---

## Executive Summary

The Command Center replaces the Control Tower as the default landing page. It answers six leader questions in under 60 seconds. Every card ends in a decision or an action. Detailed analytics remain available as appendix evidence via Explain/Diagnose links.

**Primary user**: Head of Talent / Recruiting Leader.

**Hard rules**:
- Leader-first by default.
- No new metrics unless tied to a leader question.
- All cards must end in either a decision or an action.
- Detailed reports live behind Explain or Appendix links.
- Capability gating applies to every card.

---

## 1. The Six Leader Questions

| # | Question | Section ID | Card Type |
|---|----------|-----------|-----------|
| 1 | What needs attention right now? | `cc_attention` | Action queue + traffic lights |
| 2 | Are we on track? | `cc_on_track` | Traffic light + delta summary |
| 3 | What's at risk? | `cc_risk` | Ranked risk list |
| 4 | What changed since last week? | `cc_changes` | Delta bullets |
| 5 | What happens if we change something? | `cc_whatif` | Scenario summary cards |
| 6 | Pipeline or capacity — what do we need more of? | `cc_bottleneck` | Constraint diagnosis |

---

## 2. Section Specifications

---

### 2.1 — What needs attention right now? (`cc_attention`)

**Purpose**: Surface the highest-priority actions that require a leader's decision or delegation today.

#### Required inputs
| Source | Fact keys | Capabilities |
|--------|-----------|--------------|
| Action queue | `actions.top_p0`, `actions.top_p1` | `cap_requisitions`, `cap_candidates` |
| Health KPIs | `control_tower.kpis` | `cap_timestamps`, `cap_hires` |
| SLA breaches | SLA breach actions (`SLA_BREACH_*`) | `cap_snapshot_dwell` |

#### Output format
\`\`\`
┌─────────────────────────────────────────────────┐
│  ATTENTION NOW                                  │
│                                                 │
│  🔴 3 blocking actions    🟡 7 at-risk items   │
│                                                 │
│  1. [P0] Feedback overdue: Req #1234 (3 days)  │
│     → Decide: Escalate to HM or reassign       │
│                                                 │
│  2. [P0] SLA breach: Screen stage (Req #5678)  │
│     → Action: Review with recruiter             │
│                                                 │
│  3. [P1] Offer pending 5 days (Req #9012)      │
│     → Action: Follow up or withdraw            │
│                                                 │
│  [View all 10 actions →]                        │
└─────────────────────────────────────────────────┘
\`\`\`

- **Top section**: Traffic light summary (P0 count = red, P1 count = amber)
- **List**: Top 3 actions, each with one-line decision/action prompt
- **Footer**: Link to full action queue (Diagnose > Overview)

#### Confidence handling
| Level | Behavior |
|-------|----------|
| HIGH | Full list with counts |
| MED | Show actions, add note: "Some actions based on partial data" |
| LOW | Show available actions, banner: "Import more data for complete picture" |
| BLOCKED | See Section 4 (blocked behavior) |

#### Action hooks
- Each item creates/links to an `ActionItem` in the unified queue
- "Decide" items open ActionDetailDrawer with recommended_steps
- "View all" navigates to unified action queue view

#### Explain/Evidence links
- Each action links to its `evidence.explain_kpi` (ExplainDrawer)
- P0 actions link to relevant req detail or HM scorecard

---

### 2.2 — Are we on track? (`cc_on_track`)

**Purpose**: Answer whether the team is meeting its hiring goals and velocity benchmarks.

#### Required inputs
| Source | Fact keys | Capabilities |
|--------|-----------|--------------|
| Forecast | `forecast.expected_hires`, `forecast.pipeline_gap`, `forecast.confidence` | `cap_hires`, `cap_stage_events` |
| KPIs | `control_tower.kpis` (Median TTF, Accept Rate) | `cap_timestamps`, `cap_offers` |
| Velocity | `velocity.avg_days_to_hire`, `velocity.bottleneck_stage` | `cap_stage_velocity` |

#### Output format
\`\`\`
┌─────────────────────────────────────────────────┐
│  ON TRACK?                                      │
│                                                 │
│  🟢 Median TTF     34 days   (target: <45)     │
│  🟡 Accept Rate    76%       (target: >80%)    │
│  🟢 Expected Hires 12        (goal: 14)        │
│  🔴 Pipeline Gap   -4 offers (need 6 more)     │
│                                                 │
│  Verdict: AT RISK — pipeline insufficient       │
│           for Q1 hiring goals                   │
│                                                 │
│  [Explain TTF →]  [Explain Gap →]              │
└─────────────────────────────────────────────────┘
\`\`\`

- **Traffic lights**: 3-5 KPIs with green/amber/red against targets
- **Verdict**: One-line synthesis: ON TRACK / AT RISK / OFF TRACK
- **Links**: Explain drawers for each KPI

#### Confidence handling
| Level | Behavior |
|-------|----------|
| HIGH | Show all KPIs with verdict |
| MED | Show available KPIs, verdict includes "(based on limited hire data)" |
| LOW | Show only KPIs that can be computed, no verdict |
| BLOCKED | See Section 4 |

#### Action hooks
- If verdict is AT RISK or OFF TRACK, generate `PIPELINE_HEALTH_CHECK` action (P1)
- If Accept Rate is red, generate `REVIEW_DECLINED_OFFERS` action (P1)

#### Explain/Evidence links
- Each KPI links to its explain provider (MedianTTFProvider, OfferAcceptRateProvider)
- Pipeline Gap links to ForecastingTab role health view
- Verdict links to OracleConfidenceWidget explanation

---

### 2.3 — What's at risk? (`cc_risk`)

**Purpose**: Surface the top requisitions most likely to miss their targets, ranked by severity.

#### Required inputs
| Source | Fact keys | Capabilities |
|--------|-----------|--------------|
| Pre-mortem | `risks.top_risks`, `risks.by_failure_mode` | `cap_requisitions`, `cap_stage_events` |
| Req health | ReqHealthAssessment (zombie, stalled, at_risk) | `cap_timestamps` |
| Role health | RoleHealthMetrics (pace vs benchmark) | `cap_hires`, `cap_opened_dates` |

#### Output format
\`\`\`
┌─────────────────────────────────────────────────┐
│  AT RISK                                        │
│                                                 │
│  5 reqs at risk  │  2 zombie  │  1 pipeline gap │
│                                                 │
│  1. [🔴] Senior Engineer — 45 days, 0 onsites  │
│     Risk: Pipeline gap (2 screens, 0 beyond)    │
│     → Action: Source 5+ candidates              │
│                                                 │
│  2. [🔴] Product Manager — 67 days, stalled    │
│     Risk: No activity 18 days                   │
│     → Decide: Revive or close                   │
│                                                 │
│  3. [🟡] Data Analyst — 32 days, HM slow       │
│     Risk: HM feedback overdue 5 days            │
│     → Action: Escalate to HM                    │
│                                                 │
│  [View all risks →]  [Pre-mortem analysis →]    │
└─────────────────────────────────────────────────┘
\`\`\`

- **Summary bar**: Count by failure mode (stalled, zombie, pipeline gap, HM delay)
- **Ranked list**: Top 3-5 risks, each with failure mode label and action
- **Links**: Full risk view, pre-mortem analysis

#### Confidence handling
| Level | Behavior |
|-------|----------|
| HIGH | Full ranked list with failure modes |
| MED | Show risks, add hedge: "Risk scoring based on available stage data" |
| LOW | Show only zombie/stalled (date-based, no stage data needed) |
| BLOCKED | See Section 4 |

#### Action hooks
- Each risk generates an ActionItem: `SOURCE_CANDIDATES`, `REVIEW_STALLED_REQS`, `REVIEW_ZOMBIE_REQS`, or `FEEDBACK_DUE`
- Zombie reqs: `REVIEW_ZOMBIE_REQS` (P1)
- Pipeline gaps: `SOURCE_CANDIDATES` (P0 if 0 candidates past screen)

#### Explain/Evidence links
- Each risk links to PreMortemDrawer for that req
- Failure mode links to relevant explain provider
- "View all" navigates to Diagnose > Overview (risks section)

---

### 2.4 — What changed since last week? (`cc_changes`)

**Purpose**: Highlight the most material week-over-week movements in pipeline, velocity, and outcomes.

#### Required inputs
| Source | Fact keys | Capabilities |
|--------|-----------|--------------|
| Snapshot diffs | Week-over-week deltas | `cap_snapshots` (2+ snapshots required) |
| KPI deltas | Prior period comparisons | `cap_timestamps`, `cap_hires` |
| Event stream | New hires, offers, rejections in last 7 days | `cap_stage_events` |

#### Output format
\`\`\`
┌─────────────────────────────────────────────────┐
│  SINCE LAST WEEK                                │
│                                                 │
│  ▲ 3 new hires closed (total: 12 this quarter) │
│  ▲ 2 new offers extended                       │
│  ▼ Accept rate dropped 85% → 76% (1 decline)   │
│  ▲ 4 reqs moved from stalled → active          │
│  ▼ 2 new zombie reqs (no activity 30+ days)    │
│  — Pipeline depth unchanged (47 active cands)   │
│                                                 │
│  [View full changelog →]                        │
└─────────────────────────────────────────────────┘
\`\`\`

- **Delta bullets**: Up/down/flat arrows with plain-language descriptions
- **Prioritized**: Material changes first (hires, offers, declines), housekeeping last
- **Link**: Full changelog or snapshot diff view

#### Confidence handling
| Level | Behavior |
|-------|----------|
| HIGH | Full delta list with prior period comparisons |
| MED | Show event-based changes only (hires/offers/rejections in last 7 days) |
| LOW | Show only count-based changes (reqs opened/closed) |
| BLOCKED | See Section 4 — requires `cap_snapshots` |

#### Action hooks
- Accept rate drop generates `REVIEW_DECLINED_OFFERS` (P1)
- New zombie reqs generate `REVIEW_ZOMBIE_REQS` (P1)
- No actions for positive changes (hires, offers)

#### Explain/Evidence links
- Each delta links to the relevant KPI explain provider
- "View full changelog" navigates to Diagnose > Overview (with date range filter set to 7 days)

---

### 2.5 — What happens if we change something? (`cc_whatif`)

**Purpose**: Let the leader quickly preview the impact of common what-if scenarios without navigating to the full scenario library.

#### Required inputs
| Source | Fact keys | Capabilities |
|--------|-----------|--------------|
| Scenario engine | Pre-computed scenario summaries | `cap_recruiter_assignment`, `cap_stage_events` |
| Capacity | `capacity.total_recruiters`, `capacity.avg_req_load` | `cap_capacity_history` |
| Forecast | `forecast.expected_hires`, `forecast.pipeline_gap` | `cap_hires` |

**Gating**: Requires `cap_recruiter_assignment` AND (`cap_capacity_history` OR `cap_stage_events`)

#### Output format
\`\`\`
┌─────────────────────────────────────────────────┐
│  WHAT IF...                                     │
│                                                 │
│  ┌─────────────────┐  ┌─────────────────────┐  │
│  │ A recruiter     │  │ We freeze hiring    │  │
│  │ leaves?         │  │ for 4 weeks?        │  │
│  │                 │  │                     │  │
│  │ Impact: +12 day │  │ Impact: -6 offers   │  │
│  │ avg TTF across  │  │ pipeline dries up   │  │
│  │ 8 affected reqs │  │ in 3 weeks          │  │
│  │                 │  │                     │  │
│  │ [Explore →]     │  │ [Explore →]         │  │
│  └─────────────────┘  └─────────────────────┘  │
│                                                 │
│  [Open Scenario Library →]                      │
└─────────────────────────────────────────────────┘
\`\`\`

- **Summary cards**: 2-3 pre-computed scenario previews (most relevant based on current state)
- **Each card**: Scenario name, one-line impact summary, "Explore" link
- **Link**: Full scenario library (Plan > Scenarios)

**Scenario selection logic** (show most relevant 2-3):
1. Always show "Recruiter Leaves" if overloaded recruiters exist
2. Show "Hiring Freeze" if pipeline gap > 0
3. Show "Spin Up Team" if open reqs > recruiter capacity

#### Confidence handling
| Level | Behavior |
|-------|----------|
| HIGH | Show scenario cards with impact numbers |
| MED | Show scenario cards with hedged language ("estimated impact") |
| LOW | Show scenario cards as "Explore what-if" without pre-computed numbers |
| BLOCKED | See Section 4 |

#### Action hooks
- No actions generated from preview cards
- Actions generated only when user runs full scenario in library

#### Explain/Evidence links
- "Explore" opens ScenarioLibraryTab with pre-filled parameters
- Impact numbers link to scenario output citations
- "Open Scenario Library" navigates to Plan > Scenarios

---

### 2.6 — Pipeline or capacity — what do we need more of? (`cc_bottleneck`)

**Purpose**: Diagnose whether the binding constraint is insufficient pipeline (source harder) or insufficient capacity (hire/reassign recruiters).

#### Required inputs
| Source | Fact keys | Capabilities |
|--------|-----------|--------------|
| Capacity | `capacity.total_recruiters`, `capacity.avg_req_load`, `capacity.overloaded_count` | `cap_recruiter_assignment` |
| Pipeline | `velocity.funnel`, pipeline depth per stage | `cap_funnel_stages`, `cap_stage_events` |
| Forecast | `forecast.pipeline_gap` | `cap_hires` |
| Rebalancer | UtilizationResult.summary | `cap_capacity_history` |

#### Output format
\`\`\`
┌─────────────────────────────────────────────────┐
│  BINDING CONSTRAINT                             │
│                                                 │
│  Diagnosis: CAPACITY-BOUND                      │
│                                                 │
│  Evidence:                                      │
│  �� 3 of 8 recruiters overloaded (>100% util)   │
│  • Pipeline is healthy: 4.2 cands/req avg      │
│  • Bottleneck stage: HM Screen (avg 8 days)    │
│                                                 │
│  Recommendation:                                │
│  Rebalance 4 reqs from overloaded recruiters    │
│  before sourcing more candidates.               │
│                                                 │
│  [View capacity plan →]  [Rebalance reqs →]    │
└─────────────────────────────────────────────────┘
\`\`\`

**Diagnosis logic**:
- `PIPELINE-BOUND`: pipeline_gap > 0 AND avg utilization < 80% → need more candidates
- `CAPACITY-BOUND`: overloaded_count > 0 AND pipeline healthy → need more/better distributed capacity
- `BOTH`: pipeline_gap > 0 AND overloaded_count > 0 → constrained on both fronts
- `HEALTHY`: no gap AND no overload → on track

#### Confidence handling
| Level | Behavior |
|-------|----------|
| HIGH | Full diagnosis with evidence bullets and recommendation |
| MED | Diagnosis with hedge: "Based on available data — import capacity history for precision" |
| LOW | Show only what's computable (e.g., pipeline depth without capacity) |
| BLOCKED | See Section 4 |

#### Action hooks
- CAPACITY-BOUND: Generate `REASSIGN_REQ` actions (P1) for top rebalance candidates
- PIPELINE-BOUND: Generate `SOURCE_CANDIDATES` actions (P1) for reqs with pipeline gaps
- BOTH: Generate both action types

#### Explain/Evidence links
- "View capacity plan" → Plan > Capacity Planning
- "Rebalance reqs" → Plan > Capacity Rebalancer
- Evidence bullets link to relevant explain providers
- Bottleneck stage links to Diagnose > Pipeline Velocity

---

## 3. Data Sources & Computation

### 3.1 Fact Pack Integration

The Command Center renders from a `CommandCenterFactPack` computed once on data load and on filter changes. This is a subset/view of the existing `AskFactPack`.

\`\`\`typescript
interface CommandCenterFactPack {
  // Section 1: Attention
  attention: {
    p0_count: number;
    p1_count: number;
    top_actions: ActionItem[];  // max 3, from actions.top_p0 + actions.top_p1
  };

  // Section 2: On Track
  on_track: {
    kpis: Array<{
      id: string;
      label: string;
      value: number | null;
      target: number;
      status: 'green' | 'amber' | 'red';
      unit: string;
    }>;
    verdict: 'ON_TRACK' | 'AT_RISK' | 'OFF_TRACK';
    verdict_reason: string;
  };

  // Section 3: Risk
  risk: {
    total_at_risk: number;
    by_failure_mode: Record<string, number>;
    top_risks: Array<{
      req_id: string;
      req_title: string;
      days_open: number;
      failure_mode: string;
      severity: 'critical' | 'high' | 'medium';
      action_label: string;
      action_type: ActionType;
    }>;
  };

  // Section 4: Changes
  changes: {
    available: boolean;  // false if no prior snapshot
    deltas: Array<{
      direction: 'up' | 'down' | 'flat';
      label: string;
      magnitude: string;  // e.g., "3 new hires" or "85% → 76%"
      material: boolean;  // true = show first
    }>;
  };

  // Section 5: What-If
  whatif: {
    available: boolean;
    scenario_previews: Array<{
      scenario_id: ScenarioId;
      title: string;
      impact_summary: string;
      relevance_reason: string;
    }>;
  };

  // Section 6: Bottleneck
  bottleneck: {
    diagnosis: 'PIPELINE_BOUND' | 'CAPACITY_BOUND' | 'BOTH' | 'HEALTHY';
    evidence: string[];
    recommendation: string;
    primary_action: {
      label: string;
      navigation_target: string;  // route to navigate to
    };
  };

  // Meta
  meta: {
    computed_at: Date;
    confidence: 'HIGH' | 'MED' | 'LOW';
    blocked_sections: string[];  // section IDs that couldn't compute
  };
}
\`\`\`

### 3.2 Computation Pipeline

\`\`\`
DashboardState (on data load / filter change)
  → metricsEngine.ts (KPIs, health indicators)
  → actionQueueService.ts (P0/P1 actions)
  → preMortemService.ts (risks)
  → forecastingService.ts (expected hires, gap)
  → capacityRebalancerService.ts (utilization)
  → snapshotDiffService (weekly deltas)
  → scenarioEngine.ts (pre-computed previews)
  → CommandCenterFactPack (assembled, passed to sections)
\`\`\`

No new metric engines. All data comes from existing services.

---

## 4. Blocked & Limited Behavior

### 4.1 Section-Level Gating

Each section has a minimum capability set. When not met, the section renders a blocked state.

| Section | Minimum Capabilities | Limited When | Blocked When |
|---------|---------------------|--------------|--------------|
| `cc_attention` | `cap_requisitions` | Missing `cap_stage_events` (no SLA actions) | No data imported |
| `cc_on_track` | `cap_requisitions`, `cap_timestamps` | Missing `cap_hires` (no TTF/verdict) | No timestamps |
| `cc_risk` | `cap_requisitions` | Missing `cap_stage_events` (no pipeline gap detection) | No reqs |
| `cc_changes` | `cap_snapshots` | Only 2 snapshots (limited comparison) | < 2 snapshots |
| `cc_whatif` | `cap_recruiter_assignment`, `cap_stage_events` | Missing `cap_capacity_history` (no utilization impact) | No recruiter data |
| `cc_bottleneck` | `cap_recruiter_assignment` | Missing `cap_capacity_history` OR `cap_funnel_stages` | No recruiter assignment |

### 4.2 Blocked State Template

All blocked sections use the same structural template:

\`\`\`
┌─────────────────────────────────────────────────┐
│  [SECTION TITLE]                                │
│                                                 │
│  ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐ │
│  │                                           │ │
│  │  [Icon]                                   │ │
│  │                                           │ │
│  │  [Blocked title]                          │ │
│  │  [What's needed]                          │ │
│  │                                           │ │
│  │  [Unlock CTA button]                      │ │
│  │                                           │ │
│  └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘ │
└─────────────────────────────────────────────────┘
\`\`\`

### 4.3 Copy Templates (per section)

| Section | Blocked Title | What's Needed | CTA |
|---------|--------------|---------------|-----|
| `cc_attention` | "No data to surface actions" | "Import a CSV with requisition and candidate data to see what needs your attention." | "Import Data" |
| `cc_on_track` | "Can't assess progress" | "Needs application dates and hire outcomes. Map the 'Applied Date' and 'Hire Date' columns." | "Map Columns" |
| `cc_risk` | "No requisitions to assess" | "Import requisition data to see which roles are at risk." | "Import Data" |
| `cc_changes` | "Need a prior snapshot" | "Import a second data snapshot to see week-over-week changes. PlatoVue compares your latest import against the previous one." | "Import Snapshot" |
| `cc_whatif` | "Can't model scenarios" | "Needs recruiter assignment data. Map the 'Recruiter' column to see what-if analysis." | "Map Columns" |
| `cc_bottleneck` | "Can't diagnose constraints" | "Needs recruiter assignment data to distinguish pipeline vs capacity bottlenecks." | "Map Columns" |

### 4.4 Limited State Banner

When a section is LIMITED (not fully blocked), show an inline banner within the card:

\`\`\`
⚠ Partial data — [missing capability description]. [Unlock full analysis →]
\`\`\`

The banner is dismissible per session. The link navigates to the repair suggestion.

---

## 5. Information Architecture & Navigation

### 5.1 New Navigation Structure

\`\`\`
┌─────────────────────────────────────────────────────────────────────┐
│  [Command Center]    [Diagnose ▾]    [Plan ▾]    [Settings ▾]      │
└─────────────────────────────────────────────────────────────────────┘
\`\`\`

**Command Center** becomes the renamed, redesigned landing page (replaces Control Tower).

### 5.2 Updated Bucket Mapping

#### Command Center (Default Landing — this plan)
- **Route**: `/` or `/command-center`
- **Contains**: Six leader question sections
- **No submenu** (single view)

#### Diagnose (Appendix + Explain)
- **Route**: `/diagnose/*`
- **Purpose**: Drill-down evidence for leader questions
- **Submenu**:
  - Overview (`/diagnose/overview`) — KPI detail + action queue
  - Recruiter Performance (`/diagnose/recruiter/:id?`)
  - HM Latency (`/diagnose/hm-friction`)
  - HM Scorecard (`/diagnose/hiring-managers`)
  - Quality Guardrails (`/diagnose/quality`)
  - Source Effectiveness (`/diagnose/sources`)
  - Pipeline Velocity (`/diagnose/velocity`)
  - Bottleneck Analysis (`/diagnose/bottlenecks`) — SLA dwell times

#### Plan (Scenarios, Oracle, Rebalancer)
- **Route**: `/plan/*`
- **Purpose**: Forward-looking decisions and resource allocation
- **Submenu**:
  - Hiring Forecast (`/plan/forecast`) — Oracle, role health, pre-mortem
  - Scenarios (`/plan/scenarios`) — What-if library
  - Capacity Rebalancer (`/plan/rebalancer`) — Load optimization

#### Settings (Data Health, Repairs, Config)
- **Route**: `/settings/*`
- **Purpose**: Data management, system configuration
- **Submenu**:
  - Data Health (`/settings/data-health`) — Zombies, ghosts, hygiene score
  - Coverage & Repairs (`/settings/coverage`) — Coverage map, repair suggestions
  - AI Configuration (`/settings/ai`) — BYOK key management
  - Organization (`/settings/org`) — Org settings

### 5.3 Ops View

An explicit "Ops View" toggle or separate route provides the operational recruiter-by-recruiter perspective for TA Ops users who need row-level detail:

- **Route**: `/ops` or toggled via affordance in Command Center header
- **Contains**: The current Control Tower layout (health KPIs, full action queue, risks table)
- **Purpose**: Day-to-day operational monitoring for TA coordinators
- **NOT the default**: Leaders see Command Center; Ops is opt-in

### 5.4 Ask PlatoVue

Ask PlatoVue remains accessible via a persistent affordance (floating button or header icon) from any view. It is not a navigation bucket — it's a cross-cutting interface.

---

## 6. Export: Weekly TA Brief

### 6.1 Structure

The "Weekly TA Brief" mirrors the Command Center structure exactly:

\`\`\`markdown
# Weekly TA Brief — [Org Name]
## Generated: [Date]

### 1. What needs attention
[Top 5 P0/P1 actions with decision prompts]

### 2. Are we on track?
[KPI table with traffic lights]
[Verdict: ON TRACK / AT RISK / OFF TRACK]

### 3. What's at risk
[Top 5 at-risk reqs with failure modes]

### 4. What changed this week
[Delta bullets: hires, offers, declines, stalls]

### 5. What-if scenarios
[Top 2 scenario previews with impact]

### 6. Binding constraint
[Diagnosis + recommendation]

---
_Generated by PlatoVue. Data as of [snapshot date]._
\`\`\`

### 6.2 Rendering Targets

| Target | Format | Trigger |
|--------|--------|---------|
| In-app | Command Center view | Default landing |
| PDF | Downloadable report | "Generate Exec Brief" button |
| Markdown | Copyable text | "Copy as Markdown" option |
| Clipboard | Formatted summary | "Copy Summary" quick action |

### 6.3 "Generate Exec Brief" Button

- Located in Command Center header (top-right)
- Opens a preview modal with format selection (PDF / Markdown / Clipboard)
- Uses the same `CommandCenterFactPack` that powers the live view
- Blocked sections show "[Section blocked — import X to unlock]" in the brief
- No AI generation required — purely template-based from computed data

### 6.4 Capability Gating

The brief includes only sections that are ENABLED or LIMITED. Blocked sections show:

\`\`\`markdown
### 4. What changed this week
_Not available — requires a second data snapshot. Import another CSV to enable._
\`\`\`

---

## 7. Test Plan

### 7.1 Section-Level Gating Tests

For each of the 6 sections, test:

\`\`\`typescript
describe('CommandCenter section gating', () => {
  // Per section:
  it('[section_id] renders ENABLED when all capabilities met');
  it('[section_id] renders LIMITED when optional capabilities missing');
  it('[section_id] renders BLOCKED when minimum capabilities not met');
  it('[section_id] blocked state shows correct copy and CTA');
  it('[section_id] limited state shows dismissible banner');
});
\`\`\`

**Total**: 6 sections * 5 tests = **30 gating tests**

### 7.2 Ultimate Demo (All Sections Enabled)

\`\`\`typescript
describe('CommandCenter with Ultimate Demo data', () => {
  it('all 6 sections render in ENABLED state');
  it('attention section shows P0 and P1 counts > 0');
  it('on_track section shows verdict (ON_TRACK, AT_RISK, or OFF_TRACK)');
  it('risk section shows at least 1 at-risk req');
  it('changes section shows delta bullets');
  it('whatif section shows 2+ scenario preview cards');
  it('bottleneck section shows diagnosis and recommendation');
  it('no section shows blocked state');
  it('no section shows placeholder or zero values');
  it('Generate Exec Brief button is enabled');
});
\`\`\`

### 7.3 Partial Data (Mixed States)

\`\`\`typescript
describe('CommandCenter with partial data', () => {
  // Core ATS only (reqs + candidates, no events/snapshots)
  it('attention renders LIMITED (no SLA actions)');
  it('on_track renders LIMITED (no velocity)');
  it('risk renders LIMITED (no pipeline gap detection)');
  it('changes renders BLOCKED (no snapshots)');
  it('whatif renders BLOCKED (no recruiter assignment)');
  it('bottleneck renders BLOCKED (no recruiter assignment)');

  // With recruiter assignment added
  it('whatif renders ENABLED when recruiter data present');
  it('bottleneck renders ENABLED when recruiter data present');

  // With snapshots added
  it('changes renders ENABLED when 2+ snapshots present');
});
\`\`\`

### 7.4 No Meaningless Placeholders

\`\`\`typescript
describe('CommandCenter placeholder safety', () => {
  it('no section renders "0 actions" when data is missing (shows blocked instead)');
  it('no section renders "0%" or "0 days" when metric cannot be computed');
  it('verdict is never shown when < 2 KPIs are computable');
  it('delta section never shows "no changes" when snapshots are missing');
  it('bottleneck never shows diagnosis when recruiter data is absent');
});
\`\`\`

### 7.5 Export Tests

\`\`\`typescript
describe('Weekly TA Brief export', () => {
  it('generates markdown with all 6 sections from demo data');
  it('blocked sections show unlock message, not empty');
  it('all numeric values in brief match live Command Center values');
  it('brief includes generation timestamp and data window');
  it('brief handles partial data gracefully (no crashes)');
});
\`\`\`

### 7.6 Navigation Tests

\`\`\`typescript
describe('Command Center navigation', () => {
  it('/ route renders Command Center (not old Control Tower)');
  it('/command-center redirects to /');
  it('/ops route renders Ops view (old Control Tower layout)');
  it('Explain links navigate to correct Diagnose sub-routes');
  it('Action links open ActionDetailDrawer');
  it('Scenario "Explore" links navigate to Plan > Scenarios with params');
  it('Bottleneck links navigate to Plan > Rebalancer or Plan > Capacity');
});
\`\`\`

---

## 8. Acceptance Criteria Checklist

### Must-Have (P0)

- [ ] Command Center is the default landing page at `/`
- [ ] All 6 leader question sections render with Ultimate Demo data
- [ ] Every section shows decision or action (no orphan data displays)
- [ ] Blocked sections show correct copy + CTA (never empty/zero placeholders)
- [ ] Limited sections show dismissible inline banner
- [ ] Explain/Evidence links navigate to correct Diagnose views
- [ ] Action items integrate with unified action queue
- [ ] "Generate Exec Brief" produces markdown matching live view
- [ ] Ops view accessible via `/ops` route
- [ ] Navigation structure matches Section 5.2 (Command Center, Diagnose, Plan, Settings)
- [ ] 30+ gating tests pass
- [ ] Demo data produces non-zero values in every ENABLED section
- [ ] No section renders when its minimum capabilities are BLOCKED
- [ ] Capability engine evaluates all 6 section gates

### Should-Have (P1)

- [ ] PDF export for Weekly TA Brief
- [ ] Scenario preview cards show pre-computed impact numbers
- [ ] "What changed" section shows proper snapshot diffs
- [ ] Bottleneck diagnosis distinguishes PIPELINE_BOUND vs CAPACITY_BOUND
- [ ] Verdict synthesis uses correct logic (not just first red KPI)
- [ ] Mobile-responsive layout (stacked cards, no horizontal scroll)

### Nice-to-Have (P2)

- [ ] Animated transitions between blocked → limited → enabled states
- [ ] Clipboard copy for individual section cards
- [ ] Deep link from external (Slack/email) to specific section
- [ ] Auto-refresh on new import (without page reload)
- [ ] Keyboard shortcuts for section navigation

---

## 9. Implementation Sequence

### Phase 1: Core Infrastructure
1. Define `CommandCenterFactPack` type in `types/commandCenterTypes.ts`
2. Create `services/commandCenterService.ts` — assembles fact pack from existing services
3. Create `hooks/useCommandCenter.ts` — React hook wrapping service + capability gates
4. Define section-level capability gates in capability engine

### Phase 2: Section Components
5. Create `components/command-center/CommandCenterView.tsx` — layout shell
6. Implement each section as a standalone component:
   - `AttentionSection.tsx`
   - `OnTrackSection.tsx`
   - `RiskSection.tsx`
   - `ChangesSection.tsx`
   - `WhatIfSection.tsx`
   - `BottleneckSection.tsx`
7. Wrap each in `FeatureGate` with section-specific blocked/limited states

### Phase 3: Navigation
8. Update routing: `/` → CommandCenterView, `/ops` → ControlTowerTab
9. Update nav structure: rename "Control Tower" → "Command Center"
10. Move Scenarios, Rebalancer into Plan bucket
11. Move Data Health, Coverage into Settings bucket
12. Add Bottleneck Analysis to Diagnose bucket

### Phase 4: Export
13. Create `services/weeklyBriefService.ts` — template-based markdown generation
14. Create `components/command-center/ExecBriefModal.tsx` — preview + format selection
15. Add "Generate Exec Brief" button to Command Center header

### Phase 5: Testing
16. Write section-level gating tests (30+)
17. Write Ultimate Demo integration tests
18. Write partial data tests
19. Write export tests
20. Write navigation tests
21. Run `npm run demo:check` — verify Command Center fact pack in gate tests

---

## 10. Non-Goals (Explicit Exclusions)

- **No new metrics**: Every number shown already exists in a service
- **No AI generation**: Brief is template-based, not LLM-generated
- **No real-time updates**: Refresh on import or filter change only
- **No user customization**: Section order and content are fixed for V1
- **No multi-tenant views**: Single org context per session
- **No historical Command Center**: No "show me last week's Command Center"
- **No alert/notification system**: Actions surface in-app only
