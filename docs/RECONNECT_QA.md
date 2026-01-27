# V0 UI Reconnect QA Checklist

This document tracks verification of all critical paths after the V0 UI reconnection.

---

## A) Navigation

### Top Navigation
| Tab | Status | Notes |
|-----|--------|-------|
| Command Center | [x] WORKS | Default landing page renders with real data |
| Ask PlatoVue | [x] WORKS | Wraps baseline AskPlatoVueTab |
| Diagnose | [x] WORKS | All subviews render |
| Plan | [x] WORKS | All subviews render with baseline components |
| Settings | [x] WORKS | All subviews render with baseline components |

### Diagnose Sub-navigation
| Subview | Status | Notes |
|---------|--------|-------|
| Overview | [x] WORKS | Wraps baseline OverviewTab |
| Recruiter | [x] WORKS | Wraps baseline RecruiterDetailTab |
| HM Friction | [x] WORKS | Wraps baseline HMFrictionTab |
| Hiring Managers | [x] WORKS | Wraps baseline HiringManagersTab |
| Bottlenecks | [x] WORKS | Wraps baseline BottlenecksTab |
| Quality | [x] WORKS | Wraps baseline QualityTab |
| Source Mix | [x] WORKS | Wraps baseline SourceEffectivenessTab |
| Velocity | [x] WORKS | Wraps baseline VelocityInsightsTab |

### Plan Sub-navigation
| Subview | Status | Notes |
|---------|--------|-------|
| Capacity | [x] WORKS | Mounts baseline CapacityTab (uses useDashboard) |
| Rebalancer | [x] WORKS | Mounts baseline CapacityRebalancerTab (uses useDashboard) |
| Forecasting | [x] WORKS | Mounts baseline ForecastingTab (receives props from PlanTabV2) |
| Scenarios | [x] WORKS | Mounts baseline ScenarioLibraryTab (uses useDashboard) |

### Settings Sub-navigation
| Subview | Status | Notes |
|---------|--------|-------|
| Data Health | [x] WORKS | Mounts baseline DataHealthTab (receives props from SettingsTabV2) |
| SLA Settings | [x] WORKS | Mounts baseline SlaSettingsTab |
| AI Settings | [x] WORKS | Mounts baseline AiSettingsTab (uses useDashboard) |
| Org Settings | [x] WORKS | Mounts baseline OrgSettingsTab (uses useAuth) |

---

## B) Data Flow

| Check | Status | Notes |
|-------|--------|-------|
| Demo data loads | [x] WORKS | Ultimate Demo populates all sections |
| Import flow works | [x] WORKS | CSV upload persists to dashboard state |
| Filters propagate | [x] WORKS | Date range and recruiter filters work |
| useDashboard hook | [x] WORKS | All V2 components access state via hook |

---

## C) Key Modules

| Module | Status | Notes |
|--------|--------|-------|
| Command Center KPIs | [x] WORKS | Real data from overview metrics |
| Command Center Risks | [x] WORKS | Derived from overview + hmFriction |
| Command Center Actions | [x] PARTIAL | Shows bottlenecks as placeholder; full ActionQueue integration TODO |
| Command Center Forecast | [x] WORKS | Basic metrics (offers, open reqs) |
| Command Center CTAs | [x] WORKS | View Details → overview, View All → data-health, Pipeline → forecasting |
| Ask PlatoVue | [x] WORKS | Wraps baseline with citation + fail-closed behavior |
| Oracle Forecast | [x] WORKS | Via ForecastingTab in Plan |
| Capacity Rebalancer | [x] WORKS | Via CapacityRebalancerTab in Plan |
| Scenario Library | [x] WORKS | Via ScenarioLibraryTab in Plan |
| Explain Drawer | [ ] TODO | Needs verification with BYOK missing state |
| Attention Drawer | [ ] TODO | Not yet wired to CommandCenterV2 |
| Exec Brief Export | [ ] TODO | Needs verification |

---

## D) Command Center CTAs

| CTA | Target | Status |
|-----|--------|--------|
| Health → View Details | overview (Diagnose tab) | [x] WIRED |
| Risks → View All | data-health (Settings tab) | [x] WIRED |
| Forecast → Pipeline Details | forecasting (Plan tab) | [x] WIRED |

---

## E) Build & Test Verification

| Check | Status | Command |
|-------|--------|---------|
| Build passes | [x] PASS | `npm run build` |
| Tests pass | [x] PASS | `npm test -- --watchAll=false` (1372 tests) |
| Reconnect smoke | [x] PASS | `npm run reconnect:smoke` (25 checks) |
| No Bootstrap | [x] PASS | `npm run ui:no-bootstrap` |

---

## F) Outstanding Items

1. **Attention Drawer** - Wire AttentionDrilldownDrawer to CommandCenterV2 Actions section
2. **Explain Drawer** - Verify works from V2 surfaces, especially with BYOK missing
3. **Full Action Queue** - Replace bottleneck placeholder with real UnifiedActionQueue
4. **Exec Brief Export** - Verify export functionality works end-to-end

---

## Verification Commands

```bash
# Run all checks
npm run build
npm test -- --watchAll=false
npm run reconnect:smoke
npm run ui:no-bootstrap

# Full QA suite
npm run qa:all
```

---

## Changelog

- **2026-01-26**: Initial reconnect - PlanTabV2 and SettingsTabV2 rewired to baseline components
- **2026-01-26**: CommandCenterV2 CTAs wired with onNavigateToTab callbacks
- **2026-01-26**: Created reconnect-smoke.js script (25 passing checks)
- **2026-01-26**: All tests pass (1372), build passes
