# Legacy Components (V1)

> **WARNING**: Do not add new features here. Use `/components/v2/` for new development.

## What This Contains

V1 tab components maintained for:
1. Backward compatibility with `/v1` route
2. Embedded use in V2 wrapper tabs until native V2 versions exist

## Migration Status

| Component | V2 Native | Notes |
|-----------|-----------|-------|
| `OverviewTab` | `OverviewTabV2` | V2 primary |
| `RecruiterDetailTab` | `RecruiterDetailTabV2` | V2 primary |
| `HMFrictionTab` | `HMFrictionTabV2` | V2 primary |
| `HiringManagersTab` | `HiringManagersTabV2` | V2 primary |
| `BottlenecksTab` | - | Embedded in DiagnoseTabV2 |
| `QualityTab` | - | Embedded in DiagnoseTabV2 |
| `SourceEffectivenessTab` | - | Embedded in DiagnoseTabV2 |
| `VelocityInsightsTab` | - | Embedded in DiagnoseTabV2 |
| `CapacityTab` | - | Embedded in PlanTabV2 |
| `CapacityRebalancerTab` | - | Embedded in PlanTabV2 |
| `ForecastingTab` | - | Embedded in PlanTabV2 |
| `ScenarioLibraryTab` | - | Embedded in PlanTabV2 |
| `DataHealthTab` | - | Embedded in SettingsTabV2 |
| `SlaSettingsTab` | - | Embedded in SettingsTabV2 |
| `AiSettingsTab` | - | Embedded in SettingsTabV2 |
| `OrgSettingsTab` | - | Embedded in SettingsTabV2 |
| `ControlTowerTab` | `CommandCenterV2` | V2 primary |
| `AskPlatoVueTab` | `AskPlatoVueV2` | V2 primary |
| `CommandCenterView` | `CommandCenterV2` | V2 primary |
| `ProductivityDashboard` | `AppLayoutV2` | V2 primary |

## Directory Structure

```
_legacy/
├── README.md                    # This file
├── index.ts                     # Re-exports with @deprecated JSDoc
├── ProductivityDashboard.tsx    # Legacy V1 dashboard entry point
├── overview/
├── recruiter-detail/
├── hm-friction/
├── hiring-managers/
├── bottlenecks/
├── quality/
├── source-effectiveness/
├── velocity-insights/
├── capacity/
├── capacity-rebalancer/
├── forecasting/
├── scenarios/
├── data-health/
├── settings/
├── control-tower/
├── ask-platovue/
└── command-center/              # Legacy CommandCenterView (not V2)
```

## Approved Legacy Imports

The following V2 components are allowed to import from `_legacy/`:

- `DiagnoseTabV2` - Embeds BottlenecksTab, QualityTab, SourceEffectivenessTab, VelocityInsightsTab
- `PlanTabV2` - Embeds CapacityTab, CapacityRebalancerTab, ForecastingTab, ScenarioLibraryTab
- `SettingsTabV2` - Embeds DataHealthTab, SlaSettingsTab, AiSettingsTab, OrgSettingsTab

Any other imports from `_legacy/` in V2 components will fail the legacy audit (`npm run ui:legacy-audit`).

## When to Create Native V2 Versions

Create a native V2 version when:
1. The legacy component needs significant changes
2. Theme/styling inconsistencies need fixing
3. The component is frequently accessed and performance matters

Do NOT create V2 versions just to have V2 versions. The current embedding approach works and avoids code duplication.

## Deprecation Timeline

- **Phase 1 (Current)**: Legacy components fenced in `_legacy/`, imports audited
- **Phase 2 (Future)**: Native V2 versions for remaining embedded components
- **Phase 3 (Future)**: Remove `/v1` route and delete `_legacy/` directory
