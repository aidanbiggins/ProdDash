# Capability Engine + Ultimate Demo Pack V1

**Version:** 1.0
**Status:** PLANNED
**Date:** 2026-01-22

---

## Overview

PlatoVue's features depend on data domains that vary wildly across user imports. Today, capability detection exists (`capabilityRegistry.ts`, `coverageMetricsService.ts`, `useCapabilityGating.ts`) but is incomplete: some tabs do ad-hoc gating, some crash on missing data, and the demo generator (`ultimateDemoGenerator.ts`) doesn't fully integrate with the capability system.

This plan unifies everything into one Capability Engine that is the **single source of truth** for what PlatoVue can do with the current dataset, and one Ultimate Demo Pack experience that proves every feature works.

### Goals

1. **Single source of truth** - One engine decides what's enabled/limited/blocked everywhere
2. **No scattered gating logic** - Pages consume capability status, never compute it
3. **Fail closed** - Missing inputs show "Not enough data" + fix list, never crash
4. **Ultimate Demo proves everything** - Automated proof all features render at ALL GREEN
5. **Toggleable degradation** - Demo users can disable domains and see live feature impact

### Hard Rules

- Deterministic metrics stay deterministic. AI never computes numbers.
- Fail closed. If inputs are missing, show "Not enough data" + a fix list.
- Demo data may include clearly fake PII ONLY to test PII detection. Fake PII must never be sent to any LLM.
- No real PII gets committed to the repo.
- No duplicate gating logic scattered across pages. Centralize it.

---

## A) Capability Engine Contract

### Architecture

\`\`\`
CSV Upload → csvParser → Canonical Data Layer
                              ↓
                    CoverageMetricsService
                              ↓
                      CapabilityEngine         ← SINGLE SOURCE OF TRUTH
                     /                \
          capability_report      feature_coverage
                |                       |
       (per-capability)         (per-feature)
                |                       |
       useCapabilityGating       Component gating
\`\`\`

### Inputs

| Input | Source | Description |
|-------|--------|-------------|
| `CoverageMetrics` | `coverageMetricsService.ts` | Field coverage %, record counts, boolean flags, sample sizes |
| `DashboardConfig` | Context | Stage mappings, thresholds, weights |
| `DataHygieneSummary` | `reqHealthService.ts` | Zombie/stalled/ghost counts, hygiene score |
| `FeatureFlags` | localStorage / org settings | Optional overrides (e.g., force-enable beta features) |

### Outputs

#### `capability_report: Map<CapabilityKey, CapabilityResult>`

\`\`\`typescript
interface CapabilityResult {
  capability_key: string;           // e.g., 'stage_events'
  status: 'ENABLED' | 'LIMITED' | 'BLOCKED';
  confidence: 'HIGH' | 'MED' | 'LOW';
  confidence_reasons: string[];     // Why this confidence level
  evidence: CapabilityEvidence;
  repair_suggestions: RepairSuggestion[];
}

interface CapabilityEvidence {
  field_coverages: Record<string, number>;  // field → % coverage
  sample_sizes: Record<string, number>;     // metric → n
  flags_met: string[];                      // Boolean flags satisfied
  flags_missing: string[];                  // Boolean flags NOT satisfied
  thresholds: ThresholdCheck[];             // Threshold comparisons
}

interface ThresholdCheck {
  field: string;
  required: number;
  actual: number;
  met: boolean;
}
\`\`\`

#### `feature_coverage: Map<FeatureKey, FeatureCoverageResult>`

\`\`\`typescript
interface FeatureCoverageResult {
  feature_key: string;              // e.g., 'tab_velocity_insights'
  display_name: string;             // 'Velocity Insights'
  status: 'ENABLED' | 'LIMITED' | 'BLOCKED';
  required_capabilities: string[];  // capability_keys needed
  blocked_by: string[];             // capability_keys that are BLOCKED
  limited_by: string[];             // capability_keys that are LIMITED
  reasons: string[];                // Human-readable explanations
  repair_suggestions: RepairSuggestion[];  // How to unlock
  sections: SectionCoverage[];      // Sub-feature granularity
}

interface SectionCoverage {
  section_key: string;
  display_name: string;
  status: 'ENABLED' | 'LIMITED' | 'BLOCKED';
  blocked_by: string[];
}
\`\`\`

### Status Determination Rules

| Status | Definition |
|--------|-----------|
| `ENABLED` | All required capabilities are ENABLED with HIGH or MED confidence |
| `LIMITED` | At least one capability is LIMITED (partial data) but core function works |
| `BLOCKED` | At least one required capability is BLOCKED (insufficient data) |

### Confidence Determination

| Level | Rule |
|-------|------|
| `HIGH` | Sample size ≥ 2× threshold AND field coverage ≥ 80% |
| `MED` | Sample size ≥ threshold AND field coverage ≥ required minimum |
| `LOW` | Sample size ≥ 50% of threshold OR coverage ≥ 50% of required minimum |

---

## B) Complete Feature Inventory + Dependency Map

### Data Capabilities (18 total)

These are the atomic data "ingredients" that features require.

| Capability Key | Display Name | Required Fields/Flags | Threshold |
|---------------|--------------|----------------------|-----------|
| `cap_requisitions` | Requisitions | counts.requisitions ≥ 1 | 1 req |
| `cap_candidates` | Candidates | counts.candidates ≥ 1 | 1 candidate |
| `cap_stage_events` | Stage Events | flags.hasStageEvents, event.from_stage ≥ 50% | 50+ events |
| `cap_timestamps` | Application Timestamps | cand.applied_at ≥ 50% | 50% coverage |
| `cap_terminal_timestamps` | Terminal Timestamps | cand.hired_at ≥ 10% OR cand.rejected_at ≥ 10% | 10% coverage |
| `cap_recruiter_assignment` | Recruiter Assignment | req.recruiter_id ≥ 50% | 50% coverage |
| `cap_hm_assignment` | HM Assignment | req.hiring_manager_id ≥ 50% | 50% coverage |
| `cap_source_data` | Source Data | cand.source ≥ 30% | 30% coverage |
| `cap_snapshots` | Multiple Snapshots | flags.hasMultipleSnapshots (≥ 2 snapshots) | 2 snapshots |
| `cap_snapshot_dwell` | Snapshot Dwell Times | snapshots ≥ 4, span ≥ 21 days, gap < 7 days | 4 snapshots |
| `cap_hires` | Hire Outcomes | sampleSizes.hires ≥ 5 | 5 hires |
| `cap_offers` | Offer Outcomes | sampleSizes.offers ≥ 5 | 5 offers |
| `cap_sufficient_hires` | Statistical Hire Data | sampleSizes.hires ≥ 10 | 10 hires |
| `cap_sufficient_offers` | Statistical Offer Data | sampleSizes.offers ≥ 10 | 10 offers |
| `cap_opened_dates` | Req Open Dates | req.opened_at ≥ 60% | 60% coverage |
| `cap_capacity_history` | Capacity History | 8+ weeks stable data, 2+ recruiters with ≥4 stable weeks | 8 weeks |
| `cap_funnel_stages` | Complete Funnel | cand.current_stage ≥ 80% AND ≥ 4 canonical stages mapped | 80% coverage |
| `cap_stage_velocity` | Stage Velocity | event.from_stage ≥ 70% AND event.to_stage ≥ 70% AND events ≥ 20 | 70% coverage |

### Feature Inventory (39 features across 13 tabs + engines)

#### Tab: Control Tower (`tab_control_tower`)
| Feature Key | Feature Name | Required Capabilities | When BLOCKED |
|-------------|-------------|----------------------|--------------|
| `ct_health_kpis` | Health KPIs | `cap_requisitions`, `cap_hires`, `cap_offers` | No KPI cards shown |
| `ct_median_ttf` | Median TTF KPI | `cap_timestamps`, `cap_terminal_timestamps`, `cap_hires` | Shows "--" |
| `ct_offers_count` | Offers Count | `cap_offers` | Shows "--" |
| `ct_accept_rate` | Accept Rate KPI | `cap_offers`, `cap_hires` | Shows "--" |
| `ct_stalled_reqs` | Stalled Reqs KPI | `cap_requisitions`, `cap_stage_events` | Shows "--" |
| `ct_hm_latency` | HM Latency KPI | `cap_hm_assignment`, `cap_stage_events` | Shows "--" |
| `ct_risks` | Risk List | `cap_requisitions`, `cap_candidates`, `cap_stage_events` | Empty risks panel |
| `ct_actions` | Unified Action Queue | `cap_requisitions`, `cap_candidates`, `cap_recruiter_assignment` | Empty actions panel |
| `ct_forecast` | Forecast Widget | `cap_requisitions`, `cap_candidates`, `cap_hires` | Shows "Insufficient data" |

#### Tab: Overview (`tab_overview`)
| Feature Key | Feature Name | Required Capabilities | When BLOCKED |
|-------------|-------------|----------------------|--------------|
| `ov_kpi_cards` | KPI Cards | `cap_requisitions`, `cap_hires` | No cards |
| `ov_weekly_trends` | Weekly Trends Chart | `cap_timestamps`, `cap_hires`, `cap_opened_dates` | Chart hidden |
| `ov_funnel_chart` | Funnel Chart | `cap_funnel_stages`, `cap_candidates` | Chart hidden |
| `ov_recruiter_table` | Recruiter Summary | `cap_recruiter_assignment`, `cap_requisitions` | Table hidden |
| `ov_pipeline_health` | Pipeline Health | `cap_funnel_stages`, `cap_stage_events` | Section hidden |

#### Tab: Velocity Insights (`tab_velocity`)
| Feature Key | Feature Name | Required Capabilities | When BLOCKED |
|-------------|-------------|----------------------|--------------|
| `vi_decay_candidate` | Candidate Decay Curve | `cap_sufficient_offers`, `cap_timestamps` | "Need 10+ offers" |
| `vi_decay_req` | Req Decay Analysis | `cap_requisitions` (≥10), `cap_opened_dates` | "Need 10+ reqs" |
| `vi_fast_vs_slow` | Fast vs Slow Cohort | `cap_sufficient_hires`, `cap_timestamps` | "Need 10+ hires" |
| `vi_pipeline_health` | Pipeline Health | `cap_funnel_stages`, `cap_stage_events` | Section hidden |
| `vi_confidence_badges` | Confidence Badges | (always available, shows INSUFFICIENT) | N/A |

#### Tab: HM Friction (`tab_hm_friction`)
| Feature Key | Feature Name | Required Capabilities | When BLOCKED |
|-------------|-------------|----------------------|--------------|
| `hm_kpi_tiles` | HM KPI Tiles | `cap_hm_assignment`, `cap_stage_events` | Tab blocked |
| `hm_hiring_cycle` | Hiring Cycle Breakdown | `cap_stage_events`, `cap_hm_assignment`, `cap_timestamps` | Chart hidden |
| `hm_decay_curve` | Candidate Decay Curve | `cap_offers`, `cap_hm_assignment` | Chart hidden |
| `hm_latency_heatmap` | Stage Latency Heatmap | `cap_stage_velocity`, `cap_hm_assignment` | Chart hidden |

#### Tab: Hiring Managers (`tab_hiring_managers`)
| Feature Key | Feature Name | Required Capabilities | When BLOCKED |
|-------------|-------------|----------------------|--------------|
| `hm_scorecard` | HM Scorecard | `cap_hm_assignment`, `cap_requisitions`, `cap_opened_dates` | Tab blocked |
| `hm_pending_actions` | Pending Actions | `cap_hm_assignment`, `cap_stage_events` | Sub-tab hidden |
| `hm_forecasts` | HM Forecasts | `cap_hm_assignment`, `cap_hires`, `cap_timestamps` | Sub-tab hidden |

#### Tab: Quality (`tab_quality`)
| Feature Key | Feature Name | Required Capabilities | When BLOCKED |
|-------------|-------------|----------------------|--------------|
| `q_acceptance_by_recruiter` | Acceptance by Recruiter | `cap_offers`, `cap_recruiter_assignment` | Section hidden |
| `q_late_stage_fallout` | Late-Stage Fallout | `cap_candidates`, `cap_funnel_stages` | Section hidden |
| `q_funnel_pass_through` | Funnel Pass-Through | `cap_funnel_stages`, `cap_source_data` | Section hidden |

#### Tab: Source Effectiveness (`tab_sources`)
| Feature Key | Feature Name | Required Capabilities | When BLOCKED |
|-------------|-------------|----------------------|--------------|
| `src_hire_rate` | Hire Rate by Source | `cap_source_data`, `cap_hires` | Tab blocked |
| `src_mirage_detection` | Mirage Channel Detection | `cap_source_data`, `cap_candidates` (≥50) | Section hidden |
| `src_efficiency` | Efficiency Analysis | `cap_source_data`, `cap_hires` | Section hidden |

#### Tab: Data Health (`tab_data_health`)
| Feature Key | Feature Name | Required Capabilities | When BLOCKED |
|-------------|-------------|----------------------|--------------|
| `dh_hygiene_score` | Hygiene Score | `cap_requisitions` | Shows 0 |
| `dh_zombie_reqs` | Zombie Reqs | `cap_requisitions`, `cap_stage_events` | Count = 0 |
| `dh_ghost_candidates` | Ghost Candidates | `cap_candidates`, `cap_timestamps` | Count = 0 |
| `dh_ttf_comparison` | True vs Raw TTF | `cap_hires`, `cap_timestamps` | Section hidden |

#### Tab: Forecasting / Active Role Health (`tab_forecasting`)
| Feature Key | Feature Name | Required Capabilities | When BLOCKED |
|-------------|-------------|----------------------|--------------|
| `fc_role_health` | Active Role Health | `cap_requisitions`, `cap_candidates`, `cap_stage_events` | Tab blocked |
| `fc_pre_mortem` | Pre-Mortem Risk | `cap_requisitions`, `cap_candidates`, `cap_stage_events` | Section hidden |
| `fc_new_role_planner` | New Role Planner | `cap_hires`, `cap_timestamps`, `cap_funnel_stages` | Sub-tab disabled |
| `fc_oracle` | Oracle Confidence | `cap_sufficient_hires`, `cap_stage_velocity` | Widget hidden |

#### Tab: Capacity (`tab_capacity`)
| Feature Key | Feature Name | Required Capabilities | When BLOCKED |
|-------------|-------------|----------------------|--------------|
| `cap_load_table` | Recruiter Load Table | `cap_recruiter_assignment`, `cap_requisitions` (≥10) | Tab blocked |
| `cap_fit_matrix` | Fit Matrix | `cap_recruiter_assignment`, `cap_capacity_history` | Section hidden |
| `cap_rebalance` | Rebalance Recommendations | `cap_capacity_history`, `cap_recruiter_assignment` | Section hidden |

#### Tab: Scenarios (`tab_scenarios`)
| Feature Key | Feature Name | Required Capabilities | When BLOCKED |
|-------------|-------------|----------------------|--------------|
| `sc_recruiter_leaves` | Recruiter Leaves | `cap_recruiter_assignment`, `cap_requisitions` (≥10), `cap_stage_events` | Scenario disabled |
| `sc_hiring_freeze` | Hiring Freeze | `cap_requisitions` (≥10), `cap_candidates`, `cap_stage_events` | Scenario disabled |
| `sc_spin_up_team` | Spin Up Team | `cap_recruiter_assignment`, `cap_capacity_history` | Scenario disabled |

#### Tab: Ask PlatoVue (`tab_ask`)
| Feature Key | Feature Name | Required Capabilities | When BLOCKED |
|-------------|-------------|----------------------|--------------|
| `ask_deterministic` | AI-OFF Intents | `cap_requisitions`, `cap_candidates` | Tab shows AskBlockedState |
| `ask_ai_mode` | AI-ON Free-Form | `cap_requisitions`, `cap_candidates` + AI key configured | Falls back to AI-OFF |

#### Engine: SLA/Bottleneck Attribution (`engine_sla`)
| Feature Key | Feature Name | Required Capabilities | When BLOCKED |
|-------------|-------------|----------------------|--------------|
| `sla_dwell_times` | Stage Dwell Times | `cap_snapshot_dwell` | Provider returns `blocked` |
| `sla_breach_detection` | SLA Breach Detection | `cap_snapshot_dwell`, `cap_stage_velocity` | Provider returns `blocked` |
| `sla_owner_attribution` | Owner Attribution | `cap_snapshot_dwell`, `cap_recruiter_assignment`, `cap_hm_assignment` | Provider returns `blocked` |

#### Engine: Explain Providers (`engine_explain`)
| Feature Key | Feature Name | Required Capabilities | When BLOCKED |
|-------------|-------------|----------------------|--------------|
| `explain_ttf` | Median TTF Explain | `cap_hires`, `cap_timestamps` | Provider blocked |
| `explain_tto` | Time to Offer Explain | `cap_offers`, `cap_timestamps` | Provider blocked |
| `explain_hm_latency` | HM Latency Explain | `cap_hm_assignment`, `cap_stage_events` | Provider blocked |
| `explain_accept_rate` | Accept Rate Explain | `cap_offers`, `cap_hires` | Provider blocked |
| `explain_stalled` | Stalled Reqs Explain | `cap_requisitions`, `cap_stage_events` | Provider blocked |

#### Exec Briefs / Exports (`engine_exports`)
| Feature Key | Feature Name | Required Capabilities | When BLOCKED |
|-------------|-------------|----------------------|--------------|
| `export_pdf` | PDF Export | (any tab enabled) | Export button hidden |
| `export_csv` | CSV Export | `cap_requisitions` | Export button hidden |
| `export_exec_brief` | Exec Brief | `cap_hires`, `cap_offers`, `cap_recruiter_assignment` | Brief option hidden |

---

## C) Repair Suggestions Model

### Suggestion Structure

\`\`\`typescript
interface RepairSuggestion {
  id: string;                      // Deterministic from capability + issue
  capability_key: string;          // Which capability this fixes
  priority: 'high' | 'medium' | 'low';
  type: SuggestionType;           // Action type
  title: string;                   // Short action label
  description: string;             // What to do
  why_it_matters: string;          // Plain language impact
  unlocks: string[];               // feature_keys that become enabled
  upload_hint: UploadHint;         // What file/columns to provide
  effort: 'one-click' | 'quick' | 'moderate';
  ui_copy: UICopyTemplate;         // Ready-to-use UI text
}

type SuggestionType =
  | 'import_report'       // Upload a specific ATS export
  | 'map_column'          // Map an existing column
  | 'import_snapshot'     // Import additional snapshot file
  | 'configure_stages'    // Complete stage mapping
  | 'add_field'           // Add missing field to export
  | 'increase_coverage';  // Re-export with more complete data

interface UploadHint {
  report_name: string;           // e.g., "iCIMS Submittal Export"
  required_columns: string[];    // Column names needed
  column_aliases: string[][];    // Accepted alternatives per column
  example_values?: string[];     // Sample data (no real PII)
}

interface UICopyTemplate {
  banner_title: string;          // "Unlock Velocity Insights"
  banner_body: string;           // "Upload your iCIMS Activity Report..."
  cta_label: string;             // "Upload Activity Report"
  tooltip: string;               // Hover text for info icons
  blocked_message: string;       // In-place message when feature blocked
}
\`\`\`

### Repair Suggestion Catalog

#### Missing: Stage Events (`cap_stage_events`)
\`\`\`yaml
title: "Import stage change history"
why_it_matters: "Stage events power risk detection, velocity analysis, and HM latency tracking"
unlocks:
  - tab_velocity, tab_hm_friction, ct_risks, ct_stalled_reqs
  - fc_role_health, fc_pre_mortem
  - explain_hm_latency, explain_stalled
upload_hint:
  report_name: "iCIMS Activity Report OR Candidate History Export"
  required_columns: ["Candidate ID", "From Status", "To Status", "Date Changed"]
  column_aliases:
    - ["From Status", "Previous Stage", "Old Status", "from_stage"]
    - ["To Status", "New Status", "Current Stage", "to_stage"]
    - ["Date Changed", "Activity Date", "Change Date", "event_date"]
ui_copy:
  banner_title: "Unlock Pipeline Velocity"
  banner_body: "Stage history data enables risk detection, bottleneck analysis, and HM latency tracking."
  cta_label: "Upload Activity Report"
  blocked_message: "Stage event history required. Upload your ATS activity export to enable this feature."
\`\`\`

#### Missing: Application Timestamps (`cap_timestamps`)
\`\`\`yaml
title: "Include application dates in your export"
why_it_matters: "Application dates power TTF calculation, weekly trends, and decay analysis"
unlocks:
  - ct_median_ttf, ov_weekly_trends, vi_decay_candidate, vi_fast_vs_slow
  - dh_ttf_comparison, explain_ttf, explain_tto
upload_hint:
  report_name: "iCIMS Submittal Export with Dates"
  required_columns: ["Applied Date", "Submission Date"]
  column_aliases:
    - ["Applied Date", "Application Date", "Date Applied", "Submitted Date", "applied_at"]
ui_copy:
  banner_title: "Unlock Time-to-Fill Metrics"
  banner_body: "Application dates enable median TTF, decay curves, and trend analysis."
  cta_label: "Re-export with Dates"
  blocked_message: "Application dates needed. Ensure your export includes 'Applied Date' or 'Submission Date' column."
\`\`\`

#### Missing: Terminal Timestamps (`cap_terminal_timestamps`)
\`\`\`yaml
title: "Include hire/rejection dates"
why_it_matters: "Terminal dates give accurate TTF and enable True TTF vs Raw TTF comparison"
unlocks:
  - ct_median_ttf (HIGH confidence), dh_ttf_comparison, vi_fast_vs_slow
  - explain_ttf (full breakdown)
upload_hint:
  report_name: "iCIMS Hire Report or Submittal Export"
  required_columns: ["Hire/Rehire Date"]
  column_aliases:
    - ["Hire/Rehire Date", "Hired Date", "Date Hired", "Start Date", "hired_at"]
    - ["Rejection Date", "Date Rejected", "Rejected Date", "rejected_at"]
ui_copy:
  banner_title: "Improve TTF Accuracy"
  banner_body: "Hire and rejection dates enable precise time-to-fill and data quality comparison."
  cta_label: "Upload Hire Report"
  blocked_message: "Hire dates required for accurate TTF. Include 'Hire/Rehire Date' in your export."
\`\`\`

#### Missing: Recruiter Assignment (`cap_recruiter_assignment`)
\`\`\`yaml
title: "Add recruiter ownership to requisition data"
why_it_matters: "Recruiter assignment powers workload analysis, capacity planning, and individual performance"
unlocks:
  - ov_recruiter_table, tab_capacity, ct_actions
  - sc_recruiter_leaves, cap_rebalance
  - export_exec_brief
upload_hint:
  report_name: "iCIMS Requisition Export"
  required_columns: ["Recruiter", "Assigned Recruiter"]
  column_aliases:
    - ["Recruiter", "Assigned Recruiter", "Primary Recruiter", "recruiter_name", "Recruiter Name"]
ui_copy:
  banner_title: "Unlock Capacity Planning"
  banner_body: "Recruiter assignments enable workload analysis, rebalancing, and performance tracking."
  cta_label: "Upload Req Export with Recruiter"
  blocked_message: "Recruiter assignment needed. Include 'Recruiter' column in your requisition export."
\`\`\`

#### Missing: HM Assignment (`cap_hm_assignment`)
\`\`\`yaml
title: "Add hiring manager to requisition data"
why_it_matters: "HM assignment powers latency tracking, friction analysis, and action prioritization"
unlocks:
  - tab_hm_friction, tab_hiring_managers, ct_hm_latency
  - explain_hm_latency, sla_owner_attribution
upload_hint:
  report_name: "iCIMS Requisition Export"
  required_columns: ["Hiring Manager"]
  column_aliases:
    - ["Hiring Manager", "HM", "Manager", "hiring_manager_name", "Hiring Mgr"]
ui_copy:
  banner_title: "Unlock HM Analytics"
  banner_body: "Hiring manager data enables latency tracking, friction scoring, and decision speed analysis."
  cta_label: "Upload Req Export with HM"
  blocked_message: "Hiring manager assignment needed. Include 'Hiring Manager' in your requisition export."
\`\`\`

#### Missing: Source Data (`cap_source_data`)
\`\`\`yaml
title: "Include candidate source in your export"
why_it_matters: "Source data reveals which channels produce the most hires at the lowest cost"
unlocks:
  - tab_sources, q_funnel_pass_through, src_mirage_detection
upload_hint:
  report_name: "iCIMS Submittal Export"
  required_columns: ["Source", "Candidate Source"]
  column_aliases:
    - ["Source", "Candidate Source", "Source Type", "Recruiting Source", "source"]
ui_copy:
  banner_title: "Unlock Source Analytics"
  banner_body: "Candidate source data reveals top-performing channels and mirage sources."
  cta_label: "Re-export with Source Column"
  blocked_message: "Candidate source field needed. Include 'Source' in your submittal export."
\`\`\`

#### Missing: Multiple Snapshots (`cap_snapshots`)
\`\`\`yaml
title: "Import additional data snapshots"
why_it_matters: "Multiple snapshots enable SLA tracking, stage dwell analysis, and regression detection"
unlocks:
  - engine_sla, sla_dwell_times, sla_breach_detection
  - vi_pipeline_health (enhanced)
upload_hint:
  report_name: "iCIMS Submittal Export (re-import weekly)"
  required_columns: ["Same export, imported at different dates"]
  column_aliases: []
ui_copy:
  banner_title: "Unlock SLA Tracking"
  banner_body: "Import the same report weekly to enable stage dwell times and SLA breach detection."
  cta_label: "Import Another Snapshot"
  blocked_message: "Multiple snapshots needed. Re-import your report at least weekly to enable SLA tracking."
\`\`\`

#### Missing: Capacity History (`cap_capacity_history`)
\`\`\`yaml
title: "Build 8+ weeks of import history"
why_it_matters: "Capacity inference needs historical throughput to calculate sustainable workload"
unlocks:
  - cap_fit_matrix, cap_rebalance, sc_spin_up_team
upload_hint:
  report_name: "Continue weekly imports for 8+ weeks"
  required_columns: ["Ongoing imports with recruiter assignments"]
  column_aliases: []
ui_copy:
  banner_title: "Unlock Capacity Modeling"
  banner_body: "8+ weeks of data enables sustainable capacity calculation and rebalancing."
  cta_label: "Keep Importing Weekly"
  blocked_message: "Need 8+ weeks of history. Continue weekly imports to unlock capacity features."
\`\`\`

#### Missing: Sufficient Hires/Offers (`cap_sufficient_hires`, `cap_sufficient_offers`)
\`\`\`yaml
title: "Include more completed hires in your date range"
why_it_matters: "Statistical analysis needs 10+ hires for reliable decay curves and cohort comparisons"
unlocks:
  - vi_decay_candidate, vi_fast_vs_slow, fc_oracle
upload_hint:
  report_name: "Expand your date range or import historical data"
  required_columns: ["Hire/Rehire Date", extended date range]
  column_aliases: []
ui_copy:
  banner_title: "Need More Hire Data"
  banner_body: "Expand your date range to include 10+ hires for statistical analysis."
  cta_label: "Adjust Date Range"
  blocked_message: "Need 10+ hires for reliable analysis. Try expanding your date range."
\`\`\`

---

## D) Ultimate Demo Pack Design

### Experience Flow

\`\`\`
Settings → Demo Data → "Load Demo Data" button
                             ↓
                    UltimateDemoModal opens
                             ↓
              ┌─────────────────────────────────────┐
              │  Demo Data Domains                   │
              │                                     │
              │  ■ Core ATS (reqs/cands/stages)     │
              │  ■ Recruiter + HM Assignments       │
              │  ■ Offers & Outcomes                │
              │  ■ Snapshots & Diffs                │
              │  ■ Capacity History (8+ weeks)      │
              │  ■ Calibration History              │
              │  ■ Scenarios                        │
              │  ■ Synthetic PII (for testing)      │
              │  ■ AI Fallback Stubs                │
              │                                     │
              │  [Live Preview: 39/39 features ✓]   │
              │                                     │
              │  [Load All]  [Load Selected]        │
              └─────────────────────────────────────┘
\`\`\`

### Demo Data Domains (9 packs)

| Pack ID | Domain | Records Generated | Dependencies |
|---------|--------|-------------------|--------------|
| `core_ats` | Requisitions, Candidates, Stage Events | 50 reqs, 600 cands, 2400 events | None |
| `recruiter_hm` | Recruiter + HM Assignments | 8 recruiters, 15 HMs, all reqs assigned | `core_ats` |
| `offers_outcomes` | Offers, Hires, Rejections, Withdrawals | 80 offers, 65 hires, 10 declined, 5 withdrawn | `core_ats` |
| `snapshots_diffs` | Multiple Snapshots for SLA/Dwell | 15 snapshots over 30 days | `core_ats` |
| `capacity_history` | 8+ Weeks Throughput Data | 8 weeks × 8 recruiters weekly loads | `core_ats`, `recruiter_hm` |
| `calibration_history` | Completed Hires with Predictions | 20+ hires with actual vs predicted TTF | `core_ats`, `offers_outcomes` |
| `scenarios` | Scenario Context Data | Overloaded recruiter, thin pipeline, freeze signals | `core_ats`, `recruiter_hm` |
| `synthetic_pii` | Fake PII for Detection Testing | Names (with "Demo" suffix), example.com emails, 555 phones | `core_ats` |
| `ai_stubs` | Deterministic AI-OFF Responses | Pre-computed Ask responses, Explain narratives | None |

### Determinism Guarantee

- **Seeding:** Mulberry32 PRNG with configurable string seed (default: `'platovue-demo-v1'`)
- **Same seed → identical dataset** every run
- **Record IDs:** Deterministic from seed + index (e.g., `req_demo_001`)
- **Dates:** Fixed relative to a configurable `demoBaseDate` (default: 90 days before today)
- **Names:** From fixed arrays, selected by seeded index

### Demo Story Patterns (embedded in data)

| Pattern | Purpose | Signals |
|---------|---------|---------|
| 3 Stalled Reqs | Tests stalled detection | No activity 14-25 days |
| 2 Zombie Reqs | Tests zombie detection | No activity 35+ days |
| 2 Slow HMs | Tests HM latency | Feedback 5+ days |
| 1 Overloaded Recruiter | Tests capacity | 12 reqs vs capacity 5 |
| 1 Top Performer | Tests benchmarking | 95% accept rate, fast TTF |
| 1 Offer Stall | Tests offer risk | 10+ days in offer stage |
| 1 Pipeline Gap | Tests pipeline risk | 0 candidates in funnel |
| 3 Source Mirages | Tests mirage detection | High volume, 0 hires |
| 5 Ghost Candidates | Tests ghost detection | Stuck 10-30+ days |

### Pack Toggle → Live Feature Preview

When a pack is toggled OFF, the modal instantly shows which features become LIMITED or BLOCKED:

\`\`\`typescript
function previewCapabilities(enabledPacks: Set<string>): FeatureCoverageResult[] {
  // 1. Generate coverage metrics for the enabled pack combination
  // 2. Run CapabilityEngine with those metrics
  // 3. Return feature_coverage map
  // No actual data generation needed — just capability simulation
}
\`\`\`

Display in modal:
\`\`\`
✓ 35/39 features enabled
⚠ 2 features limited  (Capacity: need capacity_history)
✗ 2 features blocked   (SLA Tracking: need snapshots_diffs)
\`\`\`

### PII Safety

- All synthetic names include identifiable suffixes: "Demo", "Sample", "Test"
- Emails use RFC 2606 reserved domains: `@example.com`, `@test.example.org`
- Phone numbers use fictional range: `+1 415 555 01XX`
- PII stress fields are NEVER included in AI payloads (filtered by PII service)
- PII pack can be toggled OFF without affecting other features

---

## E) UX Placement

### 1. Coverage Map Location

**Primary:** Settings → Data Coverage tab (existing `DataCoveragePanel`)

Shows:
- Overall score (0-100) with color badge
- Per-capability status (ENABLED/LIMITED/BLOCKED) with progress bars
- Per-feature status grouped by tab
- Repair suggestions ranked by unlock impact

**Secondary:** Dataset Status Bar (Control Tower header)

Shows:
- Compact indicator: "Coverage: 85%" with color
- Click → opens Data Coverage panel

### 2. Demo Data Location

**Entry Point:** Settings → Demo Data section OR first-run empty state

- "Load Demo Data" button opens `UltimateDemoModal`
- Modal shows pack toggles + live feature preview
- "Load All" for instant all-green experience
- When demo data is active: amber "DEMO" badge in header (existing)

### 3. Blocked State Component

**Single consistent component across all blocked features:**

\`\`\`tsx
<FeatureBlockedState
  featureKey="vi_decay_candidate"
  title="Candidate Decay Analysis"
  blockedBy={['cap_sufficient_offers']}
  repairSuggestions={suggestions}
  layout="inline" | "panel" | "card"
/>
\`\`\`

**Variants:**
- `inline`: Single line with icon + message + CTA link (for widgets/metrics)
- `panel`: Card with title, reason list, primary CTA button (for sections)
- `card`: Full card replacement with illustration (for tab-level blocks)

**Visual:**
- Muted glass panel with lock icon
- List of missing requirements with coverage bars
- Primary CTA: "Upload [Report Name]" or "Expand Date Range"
- Secondary: "Learn more" → opens coverage panel

### 4. "What to Upload" Guidance Location

**In-context:** Directly in `FeatureBlockedState` component (suggestions embedded)

**Dedicated view:** Settings → Data Coverage → "How to Unlock" section

Shows prioritized list:
1. **High impact first** - Suggestions that unlock the most features
2. **Effort level** - "One-click" / "Quick" / "Moderate" badges
3. **Column aliases** - All accepted column names for each field
4. **Example** - What a valid value looks like

---

## F) Test Plan (Objective Gates)

### Unit Tests: Capability Engine

| Test | Assertion |
|------|-----------|
| `capability_engine.test.ts` | |
| Empty dataset → all caps BLOCKED | All 18 capabilities return BLOCKED |
| Minimal dataset (1 req, 1 cand) → only cap_requisitions ENABLED | Exactly 1 ENABLED |
| Full demo dataset → all caps ENABLED | All 18 ENABLED with HIGH confidence |
| Partial data → correct LIMITED status | Remove offers → offer-dependent caps BLOCKED |
| Confidence levels correct | 2× threshold → HIGH, 1× → MED, 0.5× → LOW |
| Feature dependency resolution | Blocking cap → all dependent features BLOCKED |
| Repair suggestions generated | Each BLOCKED cap has ≥1 repair suggestion |
| Suggestion deduplication | Same capability doesn't generate duplicate suggestions |

### Unit Tests: Feature Coverage

| Test | Assertion |
|------|-----------|
| `feature_coverage.test.ts` | |
| All 39 features defined | Registry has exactly 39 entries |
| Each feature has required_capabilities | No empty dependency lists |
| Circular dependencies prevented | No capability depends on itself |
| Tab blocked → sections blocked | Section can't be ENABLED if parent tab BLOCKED |
| LIMITED vs BLOCKED distinction | Partial cap coverage → LIMITED not BLOCKED |

### Integration Test: Ultimate Demo All-Green

\`\`\`typescript
// demo_all_green.integration.test.ts
describe('Ultimate Demo Pack - All Green', () => {
  it('generates data that enables ALL 39 features', () => {
    const bundle = generateUltimateDemo('test-seed', ALL_PACKS_ENABLED);
    const coverage = computeCoverage(bundle);
    const report = capabilityEngine.evaluate(coverage);
    const features = report.feature_coverage;

    const blocked = features.filter(f => f.status === 'BLOCKED');
    expect(blocked).toHaveLength(0);
  });

  it('all tabs render without crash', () => {
    // Mount each tab component with demo data
    // Assert no error boundary triggered
    // Assert no "Not enough data" messages shown
    TABS.forEach(tabId => {
      const { container } = render(<TabComponent data={demoData} />);
      expect(container.querySelector('.feature-blocked-state')).toBeNull();
    });
  });

  it('all Explain providers return ready status', () => {
    PROVIDERS.forEach(provider => {
      const result = provider.explain(demoContext);
      expect(result.status).toBe('ready');
    });
  });

  it('Ask deterministic mode answers all 10 intents', () => {
    INTENTS.forEach(intent => {
      const response = handleDeterministicQuery(intent.query, factPack);
      expect(response.citations.length).toBeGreaterThan(0);
      expect(response.answer_markdown).toBeTruthy();
    });
  });

  it('demo data determinism: same seed = identical output', () => {
    const a = generateUltimateDemo('seed-42', ALL_PACKS_ENABLED);
    const b = generateUltimateDemo('seed-42', ALL_PACKS_ENABLED);
    expect(a).toEqual(b);
  });
});
\`\`\`

### Integration Test: Pack Toggle Degradation

\`\`\`typescript
describe('Pack Toggle → Feature Degradation', () => {
  PACKS.forEach(packId => {
    it(`disabling ${packId} blocks expected features`, () => {
      const config = { ...ALL_PACKS_ENABLED, [packId]: false };
      const bundle = generateUltimateDemo('test', config);
      const coverage = computeCoverage(bundle);
      const report = capabilityEngine.evaluate(coverage);

      const blockedFeatures = report.feature_coverage
        .filter(f => f.status === 'BLOCKED')
        .map(f => f.feature_key);

      // Each pack has a known set of features it blocks
      expect(blockedFeatures).toEqual(expect.arrayContaining(
        PACK_BLOCKS_MAP[packId]
      ));
    });
  });
});
\`\`\`

### Ask Reliability Gates

\`\`\`typescript
describe('Ask Coverage Gates', () => {
  it('blocks Ask when insufficient data', () => {
    const minimalCoverage = { counts: { requisitions: 0 } };
    const result = checkAskCoverage(minimalCoverage);
    expect(result.enabled).toBe(false);
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it('returns "Not enough data" + unlock steps for blocked intents', () => {
    const partialData = buildPartialFactPack({ noOffers: true });
    const response = handleDeterministicQuery('why is time to offer high?', partialData);
    expect(response.answer_markdown).toContain('Not enough data');
    expect(response.unlock_steps).toBeDefined();
    expect(response.unlock_steps.length).toBeGreaterThan(0);
  });

  it('never returns hallucinated numbers when data missing', () => {
    const partialPack = buildPartialFactPack({ noHires: true });
    const response = handleDeterministicQuery('what is median TTF?', partialPack);
    // Must not contain any number that isn't in the Fact Pack
    response.citations.forEach(c => {
      const packValue = getNestedValue(partialPack, c.key_path);
      expect(packValue).toBeDefined();
    });
  });
});
\`\`\`

### Render Smoke Tests

\`\`\`typescript
describe('Tab Render Smoke Tests', () => {
  const scenarios = [
    { name: 'all-green', config: ALL_PACKS_ENABLED },
    { name: 'core-only', config: { core_ats: true } },
    { name: 'no-events', config: { core_ats: true, offers_outcomes: true } },
    { name: 'empty', config: {} },
  ];

  scenarios.forEach(({ name, config }) => {
    describe(`Scenario: ${name}`, () => {
      ALL_TABS.forEach(tab => {
        it(`${tab} renders without crash`, () => {
          const bundle = generateUltimateDemo(name, config);
          expect(() => render(<Tab data={bundle} />)).not.toThrow();
        });
      });
    });
  });
});
\`\`\`

---

## G) Incremental Phases

### Phase A: Capability Engine + Coverage UI
**Scope:** Core engine, coverage panel, blocked state component

| Step | Deliverable | Files |
|------|-------------|-------|
| A1 | Extend `CapabilityResult` type with status/confidence/evidence | `types/capabilityTypes.ts` |
| A2 | Extend capability registry to 18 capabilities with thresholds | `services/capabilityRegistry.ts` |
| A3 | Implement 3-status (ENABLED/LIMITED/BLOCKED) evaluation | `services/capabilityEngine.ts` |
| A4 | Implement confidence grading (HIGH/MED/LOW) | `services/capabilityEngine.ts` |
| A5 | Implement feature→capability dependency resolution (39 features) | `services/featureCoverageService.ts` |
| A6 | Implement repair suggestion generation per blocked capability | `services/repairSuggestionsService.ts` |
| A7 | Create `FeatureBlockedState` component (3 variants) | `components/common/FeatureBlockedState.tsx` |
| A8 | Update DataCoveragePanel with full coverage map UI | `components/common/DataCoveragePanel.tsx` |
| A9 | Update `useCapabilityGating` hook with new engine output | `hooks/useCapabilityGating.ts` |
| A10 | Unit tests for capability engine + feature coverage | `services/__tests__/` |

### Phase B: Ultimate Demo Pack + Toggles
**Scope:** Demo generator, toggle UI, live preview

| Step | Deliverable | Files |
|------|-------------|-------|
| B1 | Audit existing `ultimateDemoGenerator.ts` against 18 capabilities | `services/ultimateDemoGenerator.ts` |
| B2 | Fill generator gaps (ensure all 18 caps covered at ALL GREEN) | `services/ultimateDemoGenerator.ts` |
| B3 | Implement `previewCapabilities()` for live toggle preview | `services/demoPreviewService.ts` |
| B4 | Update `UltimateDemoModal` with pack toggles + live preview | `components/common/UltimateDemoModal.tsx` |
| B5 | Verify demo story patterns produce expected signals | `services/__tests__/demoStories.test.ts` |
| B6 | Integration test: all-green assertion (39/39 features ENABLED) | `services/__tests__/demoAllGreen.integration.test.ts` |
| B7 | Integration test: pack toggle degradation matrix | `services/__tests__/demoToggle.integration.test.ts` |
| B8 | Demo determinism test (same seed = identical output) | `services/__tests__/demoDeterminism.test.ts` |

### Phase C: Integrate Gating into All Pages
**Scope:** Replace ad-hoc guards with centralized `FeatureBlockedState`

| Step | Deliverable | Files |
|------|-------------|-------|
| C1 | Control Tower: wrap 9 features with capability checks | `components/control-tower/ControlTowerTab.tsx` |
| C2 | Overview: wrap 5 features | `components/overview/OverviewTab.tsx` |
| C3 | Velocity Insights: wrap 5 features | `components/velocity-insights/VelocityInsightsTab.tsx` |
| C4 | HM Friction + Hiring Managers: wrap 7 features | `components/hm-friction/`, `components/hiring-managers/` |
| C5 | Quality + Sources: wrap 6 features | `components/quality/`, `components/source-effectiveness/` |
| C6 | Forecasting + Scenarios: wrap 6 features | `components/forecasting/`, `components/scenarios/` |
| C7 | Capacity: wrap 3 features | `components/capacity/CapacityTab.tsx` |
| C8 | Data Health: wrap 4 features | `components/data-health/DataHealthTab.tsx` |
| C9 | Remove all ad-hoc capability checks from tabs | All tab files |
| C10 | Render smoke tests: all 4 scenarios × 13 tabs = 52 assertions | `__tests__/renderSmoke.test.ts` |

### Phase D: Ask Reliability Gates + Question Coverage Tests
**Scope:** Ask gating, intent coverage, hallucination prevention

| Step | Deliverable | Files |
|------|-------------|-------|
| D1 | Ask coverage gate uses CapabilityEngine output | `services/askCoverageGateService.ts` |
| D2 | Each intent handler checks required facts before answering | `services/askIntentService.ts` |
| D3 | Blocked intents return "Not enough data" + unlock_steps | `services/askIntentService.ts` |
| D4 | AI-ON mode validates all cited values exist in Fact Pack | `services/askValidationService.ts` |
| D5 | Test: all 10 intents answer correctly with demo data | `services/__tests__/askIntents.test.ts` |
| D6 | Test: blocked intents never return hallucinated numbers | `services/__tests__/askBlocked.test.ts` |
| D7 | Test: Ask tab shows AskBlockedState when coverage insufficient | `components/__tests__/askBlocked.test.tsx` |

---

## Acceptance Criteria

### Phase A: Capability Engine + Coverage UI
- [ ] `CapabilityEngine.evaluate(coverage)` returns status for all 18 capabilities
- [ ] Status is ENABLED, LIMITED, or BLOCKED (never undefined)
- [ ] Confidence is HIGH, MED, or LOW with reasons array
- [ ] `featureCoverageService` maps all 39 features to capability dependencies
- [ ] Feature status derived correctly from capability statuses
- [ ] `FeatureBlockedState` renders in 3 variants (inline, panel, card)
- [ ] Blocked state shows repair suggestions with upload hints
- [ ] DataCoveragePanel displays full capability + feature map
- [ ] `useCapabilityGating` hook provides `isEnabled(featureKey)` API
- [ ] Unit tests pass for all 18 capabilities × 3 statuses = 54 test cases
- [ ] No capability logic exists outside `capabilityEngine.ts` / `featureCoverageService.ts`

### Phase B: Ultimate Demo Pack + Toggles
- [ ] Demo generator produces data that enables ALL 39 features (0 BLOCKED)
- [ ] All 18 capabilities report ENABLED with HIGH confidence on demo data
- [ ] Pack toggles in UltimateDemoModal show live feature impact preview
- [ ] Disabling each pack blocks only the expected features (regression matrix)
- [ ] Same seed produces byte-identical output on repeated runs
- [ ] PII fields use only RFC 2606 domains and 555-01XX phone range
- [ ] Demo story patterns produce expected risk/stall/overload signals
- [ ] `npm run demo:verify` passes with 0 failures
- [ ] No real PII in generated data or committed fixtures

### Phase C: Integrate Gating into All Pages
- [ ] All 13 tabs use `FeatureBlockedState` for missing-data scenarios
- [ ] No tab crashes with empty dataset (renders blocked state instead)
- [ ] No tab crashes with core-only dataset
- [ ] No duplicate capability checks (grep confirms single source)
- [ ] Render smoke tests pass: 4 scenarios × 13 tabs = 52 green
- [ ] All ad-hoc guards (`if (!data)`, `if (hires < 10)`) replaced with centralized gating

### Phase D: Ask Reliability Gates
- [ ] Ask tab shows AskBlockedState when coverage gate fails
- [ ] All 10 deterministic intents answer correctly with demo data
- [ ] Blocked intents return "Not enough data" + `unlock_steps[]`
- [ ] No intent ever returns a number that doesn't exist in the Fact Pack
- [ ] AI-ON mode rejects responses where cited values don't match Fact Pack
- [ ] Fallback to deterministic mode triggers on AI validation failure
- [ ] Ask tests pass with partial data (3 scenarios: no-offers, no-events, no-hm)

### Overall Success Gates
- [ ] `npm test -- --watchAll=false` passes with 0 failures
- [ ] `npm run ui:style-audit` passes
- [ ] `npm run demo:verify` passes
- [ ] No `console.error` output during all-green demo render
- [ ] Plan is implementable without further design decisions
- [ ] Complete feature map covers all 13 tabs + 5 engines + exports
- [ ] Gating rules are clear and unambiguous for every feature
- [ ] "Ultimate Demo enables everything" is provable via automated test

---

## Appendix: Capability → Feature Matrix (Quick Reference)

| Capability | Features Unlocked When ENABLED |
|-----------|-------------------------------|
| `cap_requisitions` | ct_health_kpis, ct_risks, ct_forecast, ov_kpi_cards, dh_hygiene_score, dh_zombie_reqs, fc_role_health, ask_deterministic |
| `cap_candidates` | ct_risks, ct_forecast, q_late_stage_fallout, dh_ghost_candidates, fc_role_health, ask_deterministic |
| `cap_stage_events` | ct_stalled_reqs, ct_risks, hm_kpi_tiles, hm_hiring_cycle, dh_zombie_reqs, fc_role_health, fc_pre_mortem, explain_hm_latency, explain_stalled |
| `cap_timestamps` | ct_median_ttf, ov_weekly_trends, vi_decay_candidate, vi_fast_vs_slow, dh_ghost_candidates, dh_ttf_comparison, explain_ttf, explain_tto |
| `cap_terminal_timestamps` | ct_median_ttf (HIGH), dh_ttf_comparison, vi_fast_vs_slow |
| `cap_recruiter_assignment` | ct_actions, ov_recruiter_table, cap_load_table, sc_recruiter_leaves, sla_owner_attribution, export_exec_brief |
| `cap_hm_assignment` | ct_hm_latency, tab_hm_friction, tab_hiring_managers, explain_hm_latency, sla_owner_attribution |
| `cap_source_data` | tab_sources, src_mirage_detection, q_funnel_pass_through |
| `cap_snapshots` | engine_sla (partial) |
| `cap_snapshot_dwell` | sla_dwell_times, sla_breach_detection, sla_owner_attribution |
| `cap_hires` | ct_median_ttf, ct_accept_rate, ct_forecast, ov_kpi_cards, src_hire_rate, dh_ttf_comparison, explain_ttf |
| `cap_offers` | ct_offers_count, ct_accept_rate, hm_decay_curve, q_acceptance_by_recruiter, explain_accept_rate |
| `cap_sufficient_hires` | vi_fast_vs_slow, fc_oracle |
| `cap_sufficient_offers` | vi_decay_candidate |
| `cap_opened_dates` | ov_weekly_trends, vi_decay_req, hm_scorecard |
| `cap_capacity_history` | cap_fit_matrix, cap_rebalance, sc_spin_up_team |
| `cap_funnel_stages` | ov_funnel_chart, ov_pipeline_health, vi_pipeline_health, q_late_stage_fallout, fc_new_role_planner |
| `cap_stage_velocity` | hm_latency_heatmap, fc_oracle, sla_breach_detection |
