# Command Center CTA QA Checklist

All CTAs route through `commandCenterNavigationService.ts`.
No dead clicks. No redundant CTAs. Every click lands in a focused, actionable destination.

**Design principle:** Primary = "Take action", Details = "Understand more".

---

## Section 1: Attention ("What needs attention right now?")

| CTA | Intent | Destination | Fallback |
|-----|--------|-------------|----------|
| **Details** | `details_actions` | OPEN_DRAWER: Attention drilldown (all sections) | N/A (drawer always available) |

Tile-level CTAs navigate to specific tabs via `attentionNavigationService.ts`.
TopPriorityRibbon provides one-click navigation to the highest-urgency bucket.

## Section 2: On Track ("Are we on track?")

| CTA | Intent | Destination | Fallback |
|-----|--------|-------------|----------|
| **Explain TTF** (Primary) | `explain_kpi` | OPEN_DRAWER: Explain drawer (median_ttf) | Falls back to first available KPI |
| **Details** | `kpi_details` | NAVIGATE: Overview tab | OPEN_DRAWER: Explain drawer (if no KPIs) |

## Section 3: Risk ("What's at risk?")

| CTA | Intent | Destination | Fallback |
|-----|--------|-------------|----------|
| **Triage risks** (Primary) | `triage_risks` | NAVIGATE: Data Health tab | Always resolves (tab exists) |
| **Details** | `risk_details` | OPEN_DRAWER: Explain drawer (stalled_reqs) | Always resolves (drawer available) |

## Section 4: Changes ("What changed since last week?")

| CTA | Intent | Destination | Fallback |
|-----|--------|-------------|----------|
| **Details** | `changes_details` | NAVIGATE: Overview tab | Always resolves (tab exists) |

## Section 5: What-If ("What if we change something?")

| CTA | Intent | Destination | Fallback |
|-----|--------|-------------|----------|
| **Model scenarios** (Primary) | `model_scenarios` | NAVIGATE: Scenarios tab | Always resolves (tab exists) |
| **Details** | `scenario_details` | NAVIGATE: Forecasting tab | Always resolves (tab exists) |

## Section 6: Bottleneck ("Pipeline or capacity?")

| CTA | Intent | Destination | Fallback |
|-----|--------|-------------|----------|
| **Rebalance** (Primary) | `rebalance_capacity` | Depends on diagnosis (see below) | Always resolves |
| **Details** | `bottleneck_details` | Depends on diagnosis (see below) | Always resolves |

### Bottleneck routing by diagnosis:

| Diagnosis | Primary CTA | Details CTA |
|-----------|-------------|-------------|
| CAPACITY_BOUND | Capacity Rebalancer | Capacity Rebalancer |
| PIPELINE_BOUND | Forecasting | Source Mix |
| BOTH | Capacity Rebalancer | Overview |
| HEALTHY | Forecasting | Overview |

---

## Redundancy Audit

| Section | Primary | Details | Distinct? |
|---------|---------|---------|-----------|
| Attention | (none — tiles + ribbon) | Drawer | N/A |
| On Track | Explain drawer | Overview tab | YES |
| Risk | Data Health tab | Explain drawer | YES |
| Changes | (none) | Overview tab | N/A |
| What-If | Scenarios tab | Forecasting tab | YES |
| Bottleneck | Diagnosis-dependent | Diagnosis-dependent | YES |

---

## Acceptance Criteria

- [x] Every Command Center CTA routes through centralized service
- [x] No CTA navigates to a dead end
- [x] No two CTAs in the same section go to the same destination
- [x] Drawer-based CTAs open the correct drawer system (attention vs explain)
- [x] Bottleneck CTAs adapt based on diagnosis
- [x] Missing data states use drawer fallbacks where possible
- [x] Contract tests cover all intents and diagnosis states
- [x] npm test passes
- [x] npm run build compiles successfully
