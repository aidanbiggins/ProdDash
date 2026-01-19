# UI_INVENTORY.md - Exhaustive UI Element Inventory

**Version:** 1.0
**Status:** ✅ Complete
**Created:** 2026-01-18
**Updated:** 2026-01-18

---

## Purpose

This document provides an exhaustive inventory of every UI element in ProdDash to ensure 100% design system compliance during the DECK_UI_UX_REFACTOR_V1_BUILD_EXHAUSTIVE implementation.

**Legend:**
- [ ] Not started
- [~] In progress
- [x] Completed and verified

---

## 1. Routes & Views Inventory

### 1.1 Control Tower Bucket

| Route | Component | Status | Notes |
|-------|-----------|--------|-------|
| `/` | ControlTowerTab | [x] | Default landing page - uses themed cards |
| `/control-tower` | ControlTowerTab | [x] | Alias - same as above |
| `/ask` | AskProdDashTab | [x] | Conversational interface - themed glass panels |

### 1.2 Diagnose Bucket

| Route | Component | Status | Notes |
|-------|-----------|--------|-------|
| `/diagnose/overview` | OverviewTab | [x] | KPIs, trends - uses KPICard + card-bespoke |
| `/diagnose/recruiter` | RecruiterDetailTab | [x] | Individual performance - themed |
| `/diagnose/hm-friction` | HMFrictionTab | [x] | HM latency - glass panels + chart colors |
| `/diagnose/hiring-managers` | HiringManagersTab | [x] | HM scorecard - card-bespoke themed |
| `/diagnose/bottlenecks` | BottlenecksTab | [x] | SLA breaches - themed table + badges |
| `/diagnose/quality` | QualityTab | [x] | Quality metrics - chart palette |
| `/diagnose/sources` | SourceEffectivenessTab | [x] | Channel ROI - semantic colors |
| `/diagnose/velocity` | VelocityInsightsTab | [x] | Decay analysis - themed charts |

### 1.3 Plan Bucket

| Route | Component | Status | Notes |
|-------|-----------|--------|-------|
| `/plan/capacity` | CapacityTab | [x] | Fit matrix - card-bespoke + semantic colors |
| `/plan/forecast` | ForecastingTab | [x] | Role forecasting - themed panels |
| `/plan/scenarios` | ScenarioLibraryTab | [x] | What-if - glass panels |

### 1.4 Settings Bucket

| Route | Component | Status | Notes |
|-------|-----------|--------|-------|
| `/settings/data-health` | DataHealthTab | [x] | Data hygiene - card-bespoke + badges |
| `/settings/sla` | SlaSettingsTab | [x] | SLA config - form controls themed |
| `/settings/ai` | AiSettingsTab | [x] | AI provider - modal themed |
| `/settings/org` | OrgSettingsTab | [x] | Organization - member table themed |

---

## 2. Overlay Components Inventory

### 2.1 Drawers (Slide-over Panels)

| Component | Location | Themed | Status | Notes |
|-----------|----------|--------|--------|-------|
| ExplainDrawer | `common/ExplainDrawer.tsx` | glass-drawer | [x] | Dark theme with blur backdrop |
| ActionDetailDrawer | `common/ActionDetailDrawer.tsx` | glass-drawer | [x] | Dark theme |
| HelpDrawer | `common/HelpDrawer.tsx` | glass-drawer | [x] | Dark theme |
| PreMortemDrawer | `common/PreMortemDrawer.tsx` | glass-drawer | [x] | Risk analysis |
| HMDetailDrawer | `hm-friction/HMDetailDrawer.tsx` | glass-drawer | [x] | HM details |
| ReqDrilldownDrawer | `bottlenecks/ReqDrilldownDrawer.tsx` | glass-drawer | [x] | Req details |
| FitExplainDrawer | `capacity/FitExplainDrawer.tsx` | Themed | [x] | Fit analysis |
| OverloadExplainDrawer | `capacity/OverloadExplainDrawer.tsx` | Themed | [x] | Overload explanation |
| CitationsDrawer | `scenarios/output/CitationsDrawer.tsx` | glass-drawer | [x] | Citations list |
| MobileDrawer | `navigation/MobileDrawer.tsx` | mobile-drawer | [x] | Mobile navigation |

### 2.2 Modals

| Component | Location | Themed | Status | Notes |
|-----------|----------|--------|--------|-------|
| DataDrillDownModal | `common/DataDrillDownModal.tsx` | CSS themed | [x] | Dark modal-content |
| ClearDataConfirmationModal | `common/ClearDataConfirmationModal.tsx` | danger-styled | [x] | Danger variant |
| ImportProgressModal | `common/ImportProgressModal.tsx` | custom dark | [x] | Import progress |
| PIIWarningModal | `common/PIIWarningModal.tsx` | CSS themed | [x] | Privacy warning |
| StageMappingModal | `StageMappingModal.tsx` | CSS themed | [x] | Stage mapping |
| BenchmarkConfigModal | `pipeline-health/BenchmarkConfigModal.tsx` | CSS themed | [x] | Benchmark config |
| CreateOrgModal | `OrgSwitcher.tsx` | CSS themed | [x] | Org creation |

### 2.3 Dropdowns

| Component | Location | Themed | Status | Notes |
|-----------|----------|--------|--------|-------|
| OrgSwitcher | `OrgSwitcher.tsx` | CSS themed | [x] | dropdown-menu dark |
| NavDropdown | `navigation/NavDropdown.tsx` | CSS themed | [x] | Navigation dropdown |
| MultiSelect | `common/MultiSelect.tsx` | CSS themed | [x] | Multi-select dropdown |
| FilterBar dropdowns | `common/FilterBar.tsx` | CSS themed | [x] | Filter dropdowns |

### 2.4 Alerts/Banners

| Component | Location | Themed | Status | Notes |
|-----------|----------|--------|--------|-------|
| CoverageBanner | `bottlenecks/CoverageBanner.tsx` | custom | [x] | SLA coverage |
| LimitedDataBanner | `velocity-insights/VelocityInsightsTab.tsx` | alert class | [x] | Insufficient data |
| VaultLockedBanner | `settings/AiProviderSettings.tsx` | custom | [x] | Vault locked |
| InfoAlert (SLA) | `settings/SlaSettingsTab.tsx` | alert class | [x] | Information |
| ErrorAlert (Org) | `settings/OrgSettingsTab.tsx` | alert-danger | [x] | Error feedback |
| SuccessAlert (Org) | `settings/OrgSettingsTab.tsx` | alert-success | [x] | Success feedback |
| SuperAdminAlerts | `SuperAdminPanel.tsx` | alert classes | [x] | Admin ops |
| CSVUploadAlerts | `CSVUpload.tsx` | alert-warning/info | [x] | Import guidance |

### 2.5 Tooltips (Native HTML title attributes)

| Location | Usage | Status | Notes |
|----------|-------|--------|-------|
| RecruiterDetailTab | Stalled indicator | [x] | Native title (warning logged) |
| DataHealthTab | Truncated text | [x] | Native title (warning logged) |
| AskMainPanel | Various | [x] | Native title (warning logged) |
| VelocityInsightsTab | Sample size | [x] | Native title (warning logged) |
| HMDetailDrawer | Stage breakdown | [x] | Native title (warning logged) |
| ReqDrilldownDrawer | Stage names | [x] | Native title (warning logged) |

**Note:** 115 native title attributes logged as warnings. These work with browser default tooltips. A themed Tooltip component could be added in a future iteration.

---

## 3. Interactive Elements Inventory

### 3.1 Buttons

| Type | Classes | Themed | Status | Notes |
|------|---------|--------|--------|-------|
| Primary | `.btn.btn-primary` | accent color | [x] | Uses --accent |
| Secondary | `.btn.btn-secondary` | glass bg | [x] | Dark theme |
| Outline Primary | `.btn.btn-outline-primary` | themed | [x] | Border accent |
| Outline Secondary | `.btn.btn-outline-secondary` | themed | [x] | Dark border |
| Outline Danger | `.btn.btn-outline-danger` | themed | [x] | Danger color |
| Link | `.btn.btn-link` | accent text | [x] | Uses --accent |
| Icon Button | `.btn.p-0` | themed | [x] | Inherits |
| Bespoke Secondary | `.btn-bespoke-secondary` | themed | [x] | Custom variant |

### 3.2 Badges/Chips

| Type | Classes | Themed | Status | Notes |
|------|---------|--------|--------|-------|
| Bootstrap bg-* | `.badge.bg-*` | themed | [x] | Dark backgrounds |
| Bespoke | `.badge-bespoke` | themed | [x] | Glass styling |
| Success-soft | `.badge-success-soft` | themed | [x] | Semantic color |
| Warning-soft | `.badge-warning-soft` | themed | [x] | Semantic color |
| Danger-soft | `.badge-danger-soft` | themed | [x] | Semantic color |
| DavosBadge | Component | themed | [x] | Centralized |
| ConfidenceBadge | Component | themed | [x] | Centralized |
| DataHealthBadge | Component | themed | [x] | Centralized |

### 3.3 Form Controls

| Type | Classes | Themed | Status | Notes |
|------|---------|--------|--------|-------|
| Text Input | `.form-control` | CSS themed | [x] | Dark background |
| Select | `.form-select` | CSS themed | [x] | Dark background |
| Checkbox | `.form-check-input` | CSS themed | [x] | Accent color |
| Radio | `.form-check-input` | CSS themed | [x] | Accent color |
| DateRangePicker | Component | themed | [x] | Custom styling |
| MultiSelect | Component | themed | [x] | Glass dropdown |

### 3.4 Tables

| Type | Classes | Themed | Status | Notes |
|------|---------|--------|--------|-------|
| BespokeTable | Component | themed | [x] | Swiss Modern styling |
| Bootstrap table | `.table` | CSS themed | [x] | Dark theme |
| Striped | `.table-striped` | CSS themed | [x] | Alternating rows |

### 3.5 Charts (Recharts)

| Type | Status | Notes |
|------|--------|-------|
| LineChart | [x] | Uses theme palette |
| BarChart | [x] | Uses theme palette |
| PieChart | [x] | Uses theme palette |
| ComposedChart | [x] | Uses theme palette |
| ScatterChart | [x] | Uses theme palette |
| AreaChart | [x] | Uses theme palette |
| Tooltip styling | [x] | Dark glass background |
| Legend styling | [x] | Theme colors |
| Axis styling | [x] | Subtle grid lines |

### 3.6 Loading States

| Type | Location | Themed | Status | Notes |
|------|----------|--------|--------|-------|
| SkeletonBlock | Skeletons.tsx | themed | [x] | Shimmer animation |
| TabSkeleton | Skeletons.tsx | themed | [x] | Full tab loading |
| KPISkeleton | Skeletons.tsx | themed | [x] | KPI card loading |
| ChartSkeleton | Skeletons.tsx | themed | [x] | Chart area loading |
| TableSkeleton | Skeletons.tsx | themed | [x] | Table loading |
| AnimatedNumber | AnimatedNumber.tsx | themed | [x] | Value animation |
| ProgressIndicator | ProgressIndicator.tsx | themed | [x] | Operation progress |
| Spinner | Various | CSS themed | [x] | Bootstrap spinner |

### 3.7 Empty States

| Component | Location | Themed | Status | Notes |
|-----------|----------|--------|--------|-------|
| EmptyState | common/EmptyState.tsx | themed | [x] | Generic empty state |
| No data states | Various tabs | themed | [x] | Per-tab empty states |
| Blocked states | AskProdDash | themed | [x] | Capability gated |

---

## 4. Shared Primitives Inventory

### 4.1 Layout Primitives

| Component | Location | Themed | Status | Notes |
|-----------|----------|--------|--------|-------|
| PageShell | layout/PageShell.tsx | [x] | Page wrapper |
| PageHeader | common/PageHeader.tsx | [x] | Page title |
| SectionHeader | common/SectionHeader.tsx | [x] | Section title |
| GlassPanel | common/GlassPanel.tsx | [x] | Glass container |

### 4.2 Data Display Primitives

| Component | Location | Themed | Status | Notes |
|-----------|----------|--------|--------|-------|
| KPICard | common/KPICard.tsx | [x] | KPI metric card |
| StatLabel | common/StatLabel.tsx | [x] | Metric label |
| StatValue | common/StatValue.tsx | [x] | Metric value |
| BespokeTable | common/BespokeTable.tsx | [x] | Data table |
| EmptyState | common/EmptyState.tsx | [x] | No data state |

### 4.3 Interactive Primitives

| Component | Location | Themed | Status | Notes |
|-----------|----------|--------|--------|-------|
| InlineHelp | common/InlineHelp.tsx | [x] | Help tooltip |
| HelpButton | common/HelpButton.tsx | [x] | Help trigger |
| FilterBar | common/FilterBar.tsx | [x] | Global filters |
| DateRangePicker | common/DateRangePicker.tsx | [x] | Date selection |
| MultiSelect | common/MultiSelect.tsx | [x] | Multi-select |

---

## 5. CSS Files Status

| File | Purpose | Status | Notes |
|------|---------|--------|-------|
| dashboard-theme.css | Main design tokens | [x] | Complete token set |
| layout/layout.css | Layout primitives | [x] | Consistent with theme |
| navigation/navigation.css | Nav styling | [x] | Mobile + desktop |
| ask-proddash/ask-proddash.css | Ask tab styling | [x] | Themed |
| scenarios/scenario-library.css | Scenario styling | [x] | Themed |

---

## 6. Audit Scripts Status

| Script | Purpose | Status | Notes |
|--------|---------|--------|-------|
| ui-style-audit.js | Design system enforcement | [x] | Extended with new rules |
| ui-overlay-audit.js | Overlay theming check | [x] | New script created |
| route-smoke.js | Route verification | [x] | All tests passing |

---

## 7. Verification Results

### 7.1 Automated Checks

| Check | Command | Status | Result |
|-------|---------|--------|--------|
| Tests pass | `npm test -- --watchAll=false` | [x] | 929 tests passed |
| Build passes | `npm run build` | [x] | Success |
| Style audit | `npm run ui:style-audit` | [x] | 0 violations |
| Overlay audit | `npm run ui:overlay-audit` | [x] | 0 violations, 115 warnings |
| Route smoke | `npm run route:smoke` | [x] | 15 tests passed |

### 7.2 Manual Verification

| Route | Overlays Checked | Status | Notes |
|-------|------------------|--------|-------|
| Control Tower | Drawers, modals | [x] | ExplainDrawer, ActionDetailDrawer |
| Ask ProdDash | Blocked state | [x] | Capability gating works |
| Overview | KPI drilldown | [x] | DataDrillDownModal themed |
| Recruiter Detail | Help drawer | [x] | HelpDrawer themed |
| HM Friction | HM detail drawer | [x] | HMDetailDrawer themed |
| Hiring Managers | Action drawer | [x] | ActionDetailDrawer themed |
| Bottlenecks | Req drilldown | [x] | ReqDrilldownDrawer themed |
| Quality | Help drawer | [x] | HelpDrawer themed |
| Sources | Help drawer | [x] | HelpDrawer themed |
| Velocity | Confidence badges | [x] | Themed badges |
| Capacity | Fit/Overload drawers | [x] | Both drawers themed |
| Forecast | Pre-mortem drawer | [x] | PreMortemDrawer themed |
| Scenarios | Citations drawer | [x] | CitationsDrawer themed |
| Data Health | Ghost modal | [x] | Modal themed |
| SLA Settings | Alerts | [x] | Alert classes themed |
| AI Settings | Vault banner | [x] | Custom banner themed |
| Org Settings | Alerts, modal | [x] | All themed |

---

## 8. Completion Criteria

All items below have been verified:

- [x] All routes in Section 1 marked complete
- [x] All overlays in Section 2 marked complete
- [x] All interactive elements in Section 3 verified
- [x] All primitives in Section 4 use design tokens
- [x] All CSS files in Section 5 updated/verified
- [x] All scripts in Section 6 created/updated
- [x] All automated checks in Section 7.1 pass
- [x] All manual verifications in Section 7.2 completed
- [x] docs/QA_UI_UX_REPORT.md created with results

---

*Completed: 2026-01-18*
