# V0 UI Reconnect Inventory

This document tracks what was reconnected to restore full app functionality while keeping the V0 UI shells.

## Reference Files

- **Baseline (last known good)**: `_baseline_good/ProdDash/` (from "ProdDash Before Moving to Tailwind.zip")
- **V0 UI Reference**: `_v0_ui/` (from "original-file.zip")
- **Current Working Tree**: `src/productivity-dashboard/components/v2/`

---

## Surface Inventory

### Top Navigation

| Surface | Current File | Baseline File | Status | Fix Applied |
|---------|--------------|---------------|--------|-------------|
| Top Nav (5 tabs) | `v2/TopNavV2.tsx` | N/A (new shell) | WIRED | Keep - works correctly |
| Tab switching | `v2/AppLayoutV2.tsx` | N/A (new shell) | WIRED | Added handleNavigateToTab callback |

### Command Center (Default Tab)

| Surface | Current File | Baseline File | Status | Fix Applied |
|---------|--------------|---------------|--------|-------------|
| Health KPIs | `v2/CommandCenterV2.tsx` | `control-tower/ControlTowerTab.tsx` | WIRED | Uses real data from useDashboard |
| Risk Panel | `v2/BottleneckPanelV2.tsx` | `control-tower/ControlTowerTab.tsx` | WIRED | Computes from overview + hmFriction |
| Actions Queue | `v2/CommandCenterV2.tsx` | `command-center/AttentionSection.tsx` | PARTIAL | Placeholder - full queue TODO |
| Forecast Panel | `v2/CommandCenterV2.tsx` | `control-tower/ControlTowerTab.tsx` | WIRED | Shows basic metrics |
| CTAs (View Details, etc.) | `v2/CommandCenterV2.tsx` | N/A | WIRED | Added onClick handlers + navigation |
| Dataset Status Bar | `v2/CommandCenterV2.tsx` | `control-tower/ControlTowerTab.tsx` | WIRED | Shows real data |

### Ask PlatoVue Tab

| Surface | Current File | Baseline File | Status | Fix Applied |
|---------|--------------|---------------|--------|-------------|
| Ask shell | `v2/AskPlatoVueV2.tsx` | `ask-platovue/AskPlatoVueTab.tsx` | WIRED | Wraps baseline AskPlatoVueTab |
| Empty state | `v2/AskPlatoVueV2.tsx` | N/A | WIRED | V0-styled empty state |
| Chat interface | via wrapper | `ask-platovue/AskMainPanel.tsx` | WIRED | Works via wrapper |
| Citations | via wrapper | `ask-platovue/` | WIRED | Works via wrapper |

### Diagnose Tab

| Surface | Current File | Baseline File | Status | Fix Applied |
|---------|--------------|---------------|--------|-------------|
| Shell + subnav | `v2/DiagnoseTabV2.tsx` | N/A | WIRED | V0-styled subnavigation |
| Overview subview | via wrapper | `overview/OverviewTab.tsx` | WIRED | Mounts baseline component |
| Recruiter subview | via wrapper | `recruiter-detail/RecruiterDetailTab.tsx` | WIRED | Mounts baseline component |
| HM Friction subview | via wrapper | `hm-friction/HMFrictionTab.tsx` | WIRED | Mounts baseline component |
| Hiring Managers subview | via wrapper | `hiring-managers/HiringManagersTab.tsx` | WIRED | Mounts baseline component |
| Bottlenecks subview | via wrapper | `bottlenecks/BottlenecksTab.tsx` | WIRED | Mounts baseline component |
| Quality subview | via wrapper | `quality/QualityTab.tsx` | WIRED | Mounts baseline component |
| Source Mix subview | via wrapper | `source-effectiveness/SourceEffectivenessTab.tsx` | WIRED | Mounts baseline component |
| Velocity subview | via wrapper | `velocity-insights/VelocityInsightsTab.tsx` | WIRED | Mounts baseline component |

### Plan Tab

| Surface | Current File | Baseline File | Status | Fix Applied |
|---------|--------------|---------------|--------|-------------|
| Shell + subnav | `v2/PlanTabV2.tsx` | N/A | WIRED | V0-styled shell |
| Capacity subview | `<CapacityTab />` | `capacity/CapacityTab.tsx` | WIRED | Replaced inline view with baseline component |
| Rebalancer subview | `<CapacityRebalancerTab />` | `capacity-rebalancer/CapacityRebalancerTab.tsx` | WIRED | Replaced placeholder with baseline component |
| Forecasting subview | `<ForecastingTab />` | `forecasting/ForecastingTab.tsx` | WIRED | Replaced inline view with baseline component (receives props) |
| Scenarios subview | `<ScenarioLibraryTab />` | `scenarios/ScenarioLibraryTab.tsx` | WIRED | Replaced inline view with baseline component |

### Settings Tab

| Surface | Current File | Baseline File | Status | Fix Applied |
|---------|--------------|---------------|--------|-------------|
| Shell + subnav | `v2/SettingsTabV2.tsx` | N/A | WIRED | V0-styled shell |
| Data Health subview | `<DataHealthTab />` | `data-health/DataHealthTab.tsx` | WIRED | Replaced inline view with baseline component (receives props) |
| SLA Settings subview | `<SlaSettingsTab />` | `settings/SlaSettingsTab.tsx` | WIRED | Replaced inline view with baseline component |
| AI Settings subview | `<AiSettingsTab />` | `settings/AiSettingsTab.tsx` | WIRED | Replaced inline view with baseline component |
| Org Settings subview | `<OrgSettingsTab />` | `settings/OrgSettingsTab.tsx` | WIRED | Replaced inline view with baseline component |

---

## Critical Paths (Must All Work)

### A) Navigation
- [x] Top nav tabs work: Command Center | Ask | Diagnose | Plan | Settings
- [x] Diagnose sub-nav works (all subviews render with real data)
- [x] Plan sub-nav works (all subviews render with baseline components)
- [x] Settings sub-nav works (all subviews render with baseline components)
- [x] Command Center CTAs resolve to actionable destinations

### B) Data Flow
- [x] Demo data loads and populates all tabs
- [x] Import flow works end-to-end
- [x] useDashboard hook provides state to all V2 components
- [ ] Explain drawer works (TODO: verify with BYOK missing)

### C) Key Modules
- [x] Command Center renders with real data
- [x] Command Center CTAs land somewhere actionable (overview, data-health, forecasting)
- [ ] Attention drawer works (TODO: wire to CommandCenterV2)
- [x] Ask works and fails closed when facts missing
- [x] Oracle forecast renders (via ForecastingTab)
- [x] Capacity rebalancer renders (via CapacityRebalancerTab)
- [x] Scenario library renders (via ScenarioLibraryTab)
- [ ] Exec brief export works (TODO: verify)

---

## Verification Results

### Build & Test
| Check | Status | Command |
|-------|--------|---------|
| Build | PASS | `npm run build` |
| Tests | PASS | `npm test -- --watchAll=false` (1372 tests) |
| Reconnect Smoke | PASS | `npm run reconnect:smoke` (25 checks) |

### Files Changed

1. **`src/productivity-dashboard/components/v2/PlanTabV2.tsx`**
   - Removed: Hardcoded sampleTeamCapacity, sampleForecast, sampleScenarios
   - Added: Imports for CapacityTab, CapacityRebalancerTab, ForecastingTab, ScenarioLibraryTab
   - Wired: useDashboard hook for props to ForecastingTab

2. **`src/productivity-dashboard/components/v2/SettingsTabV2.tsx`**
   - Removed: Hardcoded sampleDataHealth, sampleSLAs, sampleAIProviders
   - Added: Imports for DataHealthTab, SlaSettingsTab, AiSettingsTab, OrgSettingsTab
   - Wired: useDashboard hook for props to DataHealthTab

3. **`src/productivity-dashboard/components/v2/CommandCenterV2.tsx`**
   - Added: `onNavigateToTab` prop
   - Added: handleViewHealthDetails, handleViewRisks, handleViewPipeline handlers
   - Wired: onClick handlers to CTA buttons

4. **`src/productivity-dashboard/components/v2/AppLayoutV2.tsx`**
   - Added: handleNavigateToTab function (maps v1 tab names to v2 structure)
   - Wired: Passes onNavigateToTab to CommandCenterV2 and AskPlatoVueV2

5. **`scripts/reconnect-smoke.js`** (NEW)
   - Static analysis test for reconnection verification

6. **`docs/RECONNECT_QA.md`** (NEW)
   - QA checklist with all critical paths

7. **`package.json`**
   - Added: `reconnect:smoke` script

---

## Outstanding Work

1. **Attention Drawer** - Wire AttentionDrilldownDrawer to CommandCenterV2 Actions section
2. **Full Action Queue** - Replace bottleneck placeholder with UnifiedActionQueue
3. **Explain Drawer** - Verify works from V2 surfaces with BYOK missing
4. **Exec Brief Export** - Verify export functionality
