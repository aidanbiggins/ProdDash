# UI_INVENTORY.md - Complete UI Element Inventory

**Version:** 2.0
**Status:** Complete
**Created:** 2026-01-23
**Purpose:** Exhaustive inventory of every route, tab, page, component, drawer, modal, and state in PlatoVue for UI_REFRESH_V0_LANGUAGE_SYSTEM_V1.

---

## Routes & Navigation Structure

### Public Routes
| Route | Component | Description |
|-------|-----------|-------------|
| `/` (unauth) | `LandingPage` | Marketing landing page |
| `/login` | `Login` | Authentication page |
| `/about` | `AboutPage` | About page |
| `/invite/:token` | `InviteAcceptPage` | Invite acceptance flow |
| `/onboarding` | `OnboardingPage` | Post-sign-in org selection |

### Authenticated Routes (Dashboard)
| Route | Tab Type | Component | Bucket |
|-------|----------|-----------|--------|
| `/` | `command-center` | `CommandCenterView` | control-tower |
| `/command-center` | `command-center` | `CommandCenterView` | control-tower |
| `/ops` | `control-tower` | `ControlTowerTab` | control-tower |
| `/ask` | `ask` | `AskPlatoVueTab` | control-tower |
| `/diagnose/overview` | `overview` | `OverviewTab` | diagnose |
| `/diagnose/recruiter` | `recruiter` | `RecruiterDetailTab` | diagnose |
| `/diagnose/hm-friction` | `hm-friction` | `HMFrictionTab` | diagnose |
| `/diagnose/hiring-managers` | `hiring-managers` | `HiringManagersTab` | diagnose |
| `/diagnose/bottlenecks` | `bottlenecks` | `BottlenecksTab` | diagnose |
| `/diagnose/quality` | `quality` | `QualityTab` | diagnose |
| `/diagnose/sources` | `source-mix` | `SourceEffectivenessTab` | diagnose |
| `/diagnose/velocity` | `velocity` | `VelocityInsightsTab` | diagnose |
| `/plan/capacity` | `capacity` | `CapacityTab` | plan |
| `/plan/rebalancer` | `capacity-rebalancer` | `CapacityRebalancerTab` | plan |
| `/plan/forecast` | `forecasting` | `ForecastingTab` | plan |
| `/plan/scenarios` | `scenarios` | `ScenarioLibraryTab` | plan |
| `/settings/data-health` | `data-health` | `DataHealthTab` | settings |
| `/settings/sla` | `sla-settings` | `SlaSettingsTab` | settings |
| `/settings/ai` | `ai-settings` | `AiSettingsTab` | settings |
| `/settings/org` | `org-settings` | `OrgSettingsTab` | settings |

---

## Tab Components (19 Total)

### Control Tower Bucket
1. **CommandCenterView** (`command-center/CommandCenterView.tsx`)
   - Sub-components: AttentionSection, AttentionSummaryTiles, RiskSection, BottleneckSection, OnTrackSection, ChangesSection, WhatIfSection, TopPriorityRibbon, CCVisualPrimitives
   - Drawers: AttentionDrilldownDrawer
   - States: Loading (skeleton), No data (EmptyState)

2. **ControlTowerTab** (`control-tower/ControlTowerTab.tsx`)
   - Sub-components: Health KPIs, Risk list, Action queue, Forecast panel
   - States: Loading, No data

3. **AskPlatoVueTab** (`ask-platovue/AskPlatoVueTab.tsx`)
   - Sub-components: AskMainPanel, AskLeftRail
   - States: AskBlockedState (no AI key), Loading, Empty conversation

### Diagnose Bucket
4. **OverviewTab** (`overview/OverviewTab.tsx`)
   - States: No data, Loading

5. **RecruiterDetailTab** (`recruiter-detail/RecruiterDetailTab.tsx`)
   - States: No recruiter selected, Loading

6. **HMFrictionTab** (`hm-friction/HMFrictionTab.tsx`)
   - Drawers: HMDetailDrawer
   - States: No data, Loading

7. **HiringManagersTab** (`hiring-managers/HiringManagersTab.tsx`)
   - Sub-components: HMScorecard, HMOverview, HMActionQueue, HMForecastsTab, StallReasonBadge
   - States: No data, Loading

8. **BottlenecksTab** (`bottlenecks/BottlenecksTab.tsx`)
   - Sub-components: BottleneckStagesPanel, BreachTable, OwnerLeaderboard, CoverageBanner
   - Drawers: ReqDrilldownDrawer
   - States: No SLA data, No coverage, Loading

9. **QualityTab** (`quality/QualityTab.tsx`)
   - States: No data, Loading

10. **SourceEffectivenessTab** (`source-effectiveness/SourceEffectivenessTab.tsx`)
    - States: No source data, Loading

11. **VelocityInsightsTab** (`velocity-insights/VelocityInsightsTab.tsx`)
    - Sub-components: MiniCharts, VelocityCopilotPanel, WhatIfSimulatorPanel
    - States: Insufficient data (LimitedDataBanner), No stage timing, Loading

### Plan Bucket
12. **CapacityTab** (`capacity/CapacityTab.tsx`)
    - Sub-components: FitMatrix, RecruiterLoadTable, TeamCapacitySummary, RebalanceRecommendations
    - Drawers: FitExplainDrawer, OverloadExplainDrawer
    - States: No data, Loading

13. **CapacityRebalancerTab** (`capacity-rebalancer/CapacityRebalancerTab.tsx`)
    - Sub-components: RecruiterUtilizationTable, SuggestedMoveCard
    - Drawers: RecruiterWorkloadDrawer, MoveDetailDrawer
    - States: No data, Loading

14. **ForecastingTab** (`forecasting/ForecastingTab.tsx`)
    - Sub-components: OracleBackside, OracleConfidenceWidget, DistributionChart, CalibrationCard
    - Drawers: ReqHealthDrawer
    - States: Insufficient data, Loading

15. **ScenarioLibraryTab** (`scenarios/ScenarioLibraryTab.tsx`)
    - Sub-components: ScenarioSelector, SpinUpTeamForm, HiringFreezeForm, RecruiterLeavesForm
    - Output: ScenarioOutputPanel, DeltasCard, FeasibilityBadge, ConfidenceCard, BottlenecksCard, ActionPlanCard
    - Drawers: CitationsDrawer
    - Actions: GenerateActionPlanButton, ExplainForExecsButton
    - States: No scenario selected, Loading

### Settings Bucket
16. **DataHealthTab** (`data-health/DataHealthTab.tsx`)
    - States: No data imported, Loading

17. **SlaSettingsTab** (`settings/SlaSettingsTab.tsx`)
    - States: No SLAs configured, Loading

18. **AiSettingsTab** (`settings/AiSettingsTab.tsx`)
    - Sub-components: AiProviderSettings modal
    - States: No key configured, Vault locked

19. **OrgSettingsTab** (`settings/OrgSettingsTab.tsx`)
    - States: No org, Loading

---

## Global Components

### Navigation
- `TopNav` (`navigation/TopNav.tsx`) - Main top navigation bar
- `NavDropdown` (`navigation/NavDropdown.tsx`) - Navigation dropdown menus
- `QuickFind` (`navigation/QuickFind.tsx`) - Quick search/find
- `MobileDrawer` (`navigation/MobileDrawer.tsx`) - Mobile navigation drawer
- `LegacyToggle` (`navigation/LegacyToggle.tsx`) - New/legacy nav toggle

### Layout Primitives
- `PageShell` (`layout/PageShell.tsx`) - Page wrapper
- `PageHeader` (`layout/PageHeader.tsx`) - Page header with breadcrumbs
- `SectionHeader` (`layout/SectionHeader.tsx`) - Section title with badge/actions
- `GlassPanel` (`layout/GlassPanel.tsx`) - Glass container
- `EmptyState` (`layout/EmptyState.tsx`) - Empty state display

### Common UI Components
- `PageHeader` (`common/PageHeader.tsx`) - Original page header
- `SectionHeader` (`common/SectionHeader.tsx`) - Original section header
- `GlassPanel` (`common/GlassPanel.tsx`) - Glass panel (original)
- `GlassDrawer` (`common/GlassDrawer.tsx`) - Glass drawer base
- `EmptyState` (`common/EmptyState.tsx`) - Empty state (original)
- `StatLabel` (`common/StatLabel.tsx`) - KPI labels
- `StatValue` (`common/StatValue.tsx`) - KPI values
- `KPICard` (`common/KPICard.tsx`) - KPI card with trend
- `AnimatedNumber` (`common/AnimatedNumber.tsx`) - Animated number display
- `BespokeTable` (`common/BespokeTable.tsx`) - Custom table
- `DataTableShell` (`common/DataTableShell.tsx`) - Table skeleton
- `FilterBar` (`common/FilterBar.tsx`) - Main filter bar
- `DateRangePicker` (`common/DateRangePicker.tsx`) - Date range picker
- `MultiSelect` (`common/MultiSelect.tsx`) - Multi-select dropdown
- `FilterActiveIndicator` (`common/FilterActiveIndicator.tsx`) - Active filter badge
- `InlineHelp` (`common/InlineHelp.tsx`) - Info icon + tooltip
- `ChartHelp` (`common/ChartHelp.tsx`) - Chart help text
- `HelpButton` (`common/HelpButton.tsx`) - Help button
- `HelpDrawer` (`common/HelpDrawer.tsx`) - Help content drawer
- `ProgressIndicator` (`common/ProgressIndicator.tsx`) - Progress indicator
- `LogoSpinner` (`common/LogoSpinner.tsx`) - Animated spinner
- `DataHealthPanel` (`common/DataHealthPanel.tsx`) - Data health status
- `DataHealthBadge` (`common/DataHealthBadge.tsx`) - Compact health badge
- `DavosBadge` (`common/DavosBadge.tsx`) - Davos event badge
- `CoverageBanner` (`common/CoverageBanner.tsx`) - Coverage status
- `CoverageMapPanel` (`common/CoverageMapPanel.tsx`) - Coverage detail
- `MetricDrillDown` (`common/MetricDrillDown.tsx`) - Metric drill-down
- `UnifiedActionQueue` (`common/UnifiedActionQueue.tsx`) - Action queue
- `ActionDetailDrawer` (`common/ActionDetailDrawer.tsx`) - Action detail

### Feature Gates
- `FeatureGate` (`common/FeatureGate.tsx`) - Capability gate wrapper
- `FeatureBlockedState` (`common/FeatureBlockedState.tsx`) - Feature blocked
- `FeatureLimitedState` (`common/FeatureLimitedState.tsx`) - Feature limited

### Skeletons
- `TabSkeleton` (`common/Skeletons.tsx`) - Full tab loading
- `KPISkeleton` (`common/Skeletons.tsx`) - KPI loading
- `ChartSkeleton` (`common/Skeletons.tsx`) - Chart loading
- `TableSkeleton` (`common/Skeletons.tsx`) - Table loading
- `SkeletonBlock` (`common/Skeletons.tsx`) - Generic block

### Guidance Components
- `CapabilitiesSummary` (`guidance/CapabilitiesSummary.tsx`)
- `RepairSuggestions` (`guidance/RepairSuggestions.tsx`)
- `UnavailablePanels` (`guidance/UnavailablePanels.tsx`)

---

## Modals (8)
| Modal | File | Purpose |
|-------|------|---------|
| ClearDataConfirmationModal | `common/ClearDataConfirmationModal.tsx` | Confirm data clear |
| ImportProgressModal | `common/ImportProgressModal.tsx` | Import progress |
| PIIWarningModal | `common/PIIWarningModal.tsx` | PII masking warning |
| UltimateDemoModal | `common/UltimateDemoModal.tsx` | Demo mode alert |
| StageMappingModal | `StageMappingModal.tsx` | Stage mapping config |
| BenchmarkConfigModal | `pipeline-health/BenchmarkConfigModal.tsx` | Benchmark config |
| CreateOrgModal | `OrgSwitcher.tsx` (inline) | Create organization |
| AiProviderSettings | `settings/AiProviderSettings.tsx` | AI settings modal |
| DataDrillDownModal | `common/DataDrillDownModal.tsx` | Drill-down data view |

## Drawers (15)
| Drawer | File | Purpose |
|--------|------|---------|
| ActionDetailDrawer | `common/ActionDetailDrawer.tsx` | Action detail |
| ExplainDrawer | `common/ExplainDrawer.tsx` | Metric explanation |
| GlassDrawer | `common/GlassDrawer.tsx` | Glass drawer base |
| HelpDrawer | `common/HelpDrawer.tsx` | Help content |
| PreMortemDrawer | `common/PreMortemDrawer.tsx` | Pre-mortem analysis |
| AttentionDrilldownDrawer | `command-center/AttentionDrilldownDrawer.tsx` | CC risk drill |
| ReqDrilldownDrawer | `bottlenecks/ReqDrilldownDrawer.tsx` | Req details |
| HMDetailDrawer | `hm-friction/HMDetailDrawer.tsx` | HM details |
| FitExplainDrawer | `capacity/FitExplainDrawer.tsx` | Fit scoring |
| OverloadExplainDrawer | `capacity/OverloadExplainDrawer.tsx` | Overload explain |
| RecruiterWorkloadDrawer | `capacity-rebalancer/RecruiterWorkloadDrawer.tsx` | Workload detail |
| MoveDetailDrawer | `capacity-rebalancer/MoveDetailDrawer.tsx` | Move detail |
| ReqHealthDrawer | `forecasting/ReqHealthDrawer.tsx` | Req health |
| CitationsDrawer | `scenarios/output/CitationsDrawer.tsx` | Scenario citations |
| MobileDrawer | `navigation/MobileDrawer.tsx` | Mobile nav |

---

## Landing Page Components
| Component | File | Purpose |
|-----------|------|---------|
| LandingPage | `landing/LandingPage.tsx` | Main orchestrator |
| HeroSection | `landing/HeroSection.tsx` | Hero banner |
| FeaturesSection | `landing/FeaturesSection.tsx` | Features overview |
| ProblemsSection | `landing/ProblemsSection.tsx` | Problem statement |
| HowItWorksSection | `landing/HowItWorksSection.tsx` | How it works |
| MetricsShowcase | `landing/MetricsShowcase.tsx` | Metrics display |
| DataTransformSection | `landing/DataTransformSection.tsx` | Data transformation |
| ScreenshotsSection | `landing/ScreenshotsSection.tsx` | Screenshots carousel |
| CTASection | `landing/CTASection.tsx` | Call-to-action |
| NetworkBackground | `landing/NetworkBackground.tsx` | Animated background |
| AnimatedSection | `landing/components/AnimatedSection.tsx` | Scroll animations |

---

## CSS Files
| File | Purpose |
|------|---------|
| `dashboard-theme.css` | Main theme tokens and global styles |
| `navigation/navigation.css` | Navigation styling |
| `layout/layout.css` | Layout primitive styles |
| `common/HelpDrawer.css` | Help drawer styling |
| `ask-platovue/ask-platovue.css` | Ask PlatoVue styling |
| `scenarios/scenario-library.css` | Scenario library styling |
| `guidance/guidance.css` | Guidance component styling |
| `command-center/CommandCenter.css` | Command center styling |

---

## Known Duplication Issues
1. `PageHeader` exists in both `common/` and `layout/` - need to consolidate
2. `SectionHeader` exists in both `common/` and `layout/` - need to consolidate
3. `GlassPanel` exists in both `common/` and `layout/` - need to consolidate
4. `EmptyState` exists in both `common/` and `layout/` - need to consolidate
5. Multiple CSS files with overlapping responsibilities
