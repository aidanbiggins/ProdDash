# Command Center CTA QA Checklist

All CTAs route through `commandCenterNavigationService.ts`.
No dead clicks. Every click lands in a focused, actionable destination.

---

## Section 1: Attention ("What needs attention right now?")

| CTA | Intent | Destination | Fallback |
|-----|--------|-------------|----------|
| **Triage actions** (Primary) | `triage_actions` | OPEN_DRAWER: Attention drilldown (all sections) | N/A (drawer always available) |
| **Details** | `details_actions` | OPEN_DRAWER: Attention drilldown (all sections) | N/A (drawer always available) |

## Section 2: On Track ("Are we on track?")

| CTA | Intent | Destination | Fallback |
|-----|--------|-------------|----------|
| **Explain TTF** (Primary) | `explain_kpi` | OPEN_DRAWER: Explain drawer (median_ttf) | Falls back to first available KPI |
| **Details** | `kpi_details` | NAVIGATE: Overview tab | OPEN_DRAWER: Explain drawer (if no KPIs) |

## Section 3: Risk ("What's at risk?")

| CTA | Intent | Destination | Fallback |
|-----|--------|-------------|----------|
| **Triage risks** (Primary) | `triage_risks` | NAVIGATE: Data Health tab | Always resolves (tab exists) |
| **Details** | `risk_details` | NAVIGATE: Data Health tab | Always resolves (tab exists) |

## Section 4: Changes ("What changed since last week?")

| CTA | Intent | Destination | Fallback |
|-----|--------|-------------|----------|
| **Details** | `changes_details` | NAVIGATE: Overview tab | Always resolves (tab exists) |

## Section 5: What-If ("What if we change something?")

| CTA | Intent | Destination | Fallback |
|-----|--------|-------------|----------|
| **Model scenarios** (Primary) | `model_scenarios` | NAVIGATE: Scenarios tab | Always resolves (tab exists) |
| **Details** | `scenario_details` | NAVIGATE: Scenarios tab | Always resolves (tab exists) |

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

## Acceptance Criteria

- [x] Every Command Center CTA routes through centralized service
- [x] No CTA navigates to a dead end
- [x] Drawer-based CTAs open the correct drawer system (attention vs explain)
- [x] Bottleneck CTAs adapt based on diagnosis
- [x] Missing data states use drawer fallbacks where possible
- [x] Contract tests cover all intents and diagnosis states
- [x] npm test passes (63 suites, 1366 tests)
- [x] npm run build compiles successfully
