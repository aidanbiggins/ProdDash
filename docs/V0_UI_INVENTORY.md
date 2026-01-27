# V0 UI Component Inventory

**Document**: `V0_UI_INVENTORY.md`
**Generated**: 2026-01-25
**Scope**: All visible UI components across `/src/productivity-dashboard/`, `/src/components/`, and `/src/components/ui/`

---

## Legend

**Styling Approach:**
- `Tailwind` - Tailwind CSS with className utilities
- `CSS Modules` - Component-scoped CSS files
- `Inline Styles` - React style prop
- `Mixed` - Combination of Tailwind + CSS
- `Bootstrap` - Bootstrap 5 classes (legacy)

**Component Type:**
- `Tab` - Full-page tab container (top-level navigation)
- `Panel` - Collapsible/expandable section within a tab
- `Modal/Dialog` - Modal or drawer overlay
- `Card` - Card component for data display
- `Primitive` - Base UI component (button, badge, etc.)
- `Form` - Form component for input
- `Table` - Data table
- `Chart` - Visualization/chart component
- `Header/Navigation` - Page/section headers, nav elements
- `Layout` - Container/wrapper component
- `Feature` - Feature-specific compound component

**V2 Migration Status:**
- `Done` - Fully migrated to Tailwind v2 pattern
- `Partial` - Mixed old/new or in-progress
- `Not Started` - Still Bootstrap or legacy styling

---

## Part 1: Tab Components (Top-Level Navigation)

| Component | Path | Type | Styling | V2 Status |
|---|---|---|---|---|
| Control Tower Tab | `/productivity-dashboard/components/control-tower/ControlTowerTab.tsx` | Tab | Mixed | Done |
| Overview Tab | `/productivity-dashboard/components/overview/OverviewTab.tsx` | Tab | Tailwind | Done |
| Recruiter Detail Tab | `/productivity-dashboard/components/recruiter-detail/RecruiterDetailTab.tsx` | Tab | Tailwind | Done |
| HM Friction Tab | `/productivity-dashboard/components/hm-friction/HMFrictionTab.tsx` | Tab | Tailwind | Done |
| Hiring Managers Tab | `/productivity-dashboard/components/hiring-managers/HiringManagersTab.tsx` | Tab | Tailwind | Done |
| Quality Tab | `/productivity-dashboard/components/quality/QualityTab.tsx` | Tab | Tailwind | Done |
| Source Effectiveness Tab | `/productivity-dashboard/components/source-effectiveness/SourceEffectivenessTab.tsx` | Tab | Tailwind | Done |
| Data Health Tab | `/productivity-dashboard/components/data-health/DataHealthTab.tsx` | Tab | Tailwind | Done |
| Velocity Insights Tab | `/productivity-dashboard/components/velocity-insights/VelocityInsightsTab.tsx` | Tab | Tailwind | Done |
| Bottlenecks Tab | `/productivity-dashboard/components/bottlenecks/BottlenecksTab.tsx` | Tab | Tailwind | Done |
| Forecasting Tab | `/productivity-dashboard/components/forecasting/ForecastingTab.tsx` | Tab | Tailwind | Done |
| Capacity Tab | `/productivity-dashboard/components/capacity/CapacityTab.tsx` | Tab | Tailwind | Done |
| Capacity Rebalancer Tab | `/productivity-dashboard/components/capacity-rebalancer/CapacityRebalancerTab.tsx` | Tab | Tailwind | Done |
| Scenario Library Tab | `/productivity-dashboard/components/scenarios/ScenarioLibraryTab.tsx` | Tab | Tailwind | Done |
| Ask PlatoVue Tab | `/productivity-dashboard/components/ask-platovue/AskPlatoVueTab.tsx` | Tab | CSS Modules | Partial |

---

## Part 2: Command Center Components

| Component | Path | Type | Styling | V2 Status |
|---|---|---|---|---|
| Command Center V2 | `/productivity-dashboard/components/command-center/CommandCenterV2.tsx` | Feature | Mixed | Partial |
| KPI Card V2 | `/productivity-dashboard/components/command-center/KPICardV2.tsx` | Card | Tailwind | Done |
| Pipeline Chart V2 | `/productivity-dashboard/components/command-center/PipelineChartV2.tsx` | Chart | Tailwind | Done |
| Bottleneck Panel V2 | `/productivity-dashboard/components/command-center/BottleneckPanelV2.tsx` | Panel | Tailwind | Done |
| Requisitions Table V2 | `/productivity-dashboard/components/command-center/RequisitionsTableV2.tsx` | Table | Tailwind | Done |
| Team Capacity Panel V2 | `/productivity-dashboard/components/command-center/TeamCapacityPanelV2.tsx` | Panel | Tailwind | Done |
| Attention Summary Tiles | `/productivity-dashboard/components/command-center/AttentionSummaryTiles.tsx` | Panel | Tailwind | Done |
| Attention Drilldown Drawer | `/productivity-dashboard/components/command-center/AttentionDrilldownDrawer.tsx` | Modal | Tailwind | Done |
| Risk Section | `/productivity-dashboard/components/command-center/RiskSection.tsx` | Panel | Tailwind | Done |
| Top Priority Ribbon | `/productivity-dashboard/components/command-center/TopPriorityRibbon.tsx` | Card | Tailwind | Done |
| Section Card | `/productivity-dashboard/components/command-center/SectionCard.tsx` | Card | Tailwind | Done |
| CC Visual Primitives | `/productivity-dashboard/components/command-center/CCVisualPrimitives.tsx` | Primitive | Tailwind | Done |

---

## Part 3: V2 Shell Components

| Component | Path | Type | Styling | V2 Status |
|---|---|---|---|---|
| App Layout V2 | `/productivity-dashboard/components/v2/AppLayoutV2.tsx` | Layout | Tailwind | Done |
| Top Nav V2 | `/productivity-dashboard/components/v2/TopNavV2.tsx` | Header | Tailwind | Done |
| Diagnose Tab V2 | `/productivity-dashboard/components/v2/DiagnoseTabV2.tsx` | Tab | Tailwind | Done |
| Plan Tab V2 | `/productivity-dashboard/components/v2/PlanTabV2.tsx` | Tab | Tailwind | Done |
| Settings Tab V2 | `/productivity-dashboard/components/v2/SettingsTabV2.tsx` | Tab | Tailwind | Done |
| Ask PlatoVue V2 | `/productivity-dashboard/components/v2/AskPlatoVueV2.tsx` | Tab | Tailwind | Done |
| Filter Bar V2 | `/productivity-dashboard/components/v2/FilterBarV2.tsx` | Panel | Tailwind | Partial |
| KPI Card V2 (v2) | `/productivity-dashboard/components/v2/KPICardV2.tsx` | Card | Tailwind | Partial |
| Pipeline Funnel V2 | `/productivity-dashboard/components/v2/PipelineFunnelV2.tsx` | Chart | Tailwind | Partial |
| Requisitions Table V2 (v2) | `/productivity-dashboard/components/v2/RequisitionsTableV2.tsx` | Table | Tailwind | Partial |
| Team Capacity Panel V2 (v2) | `/productivity-dashboard/components/v2/TeamCapacityPanelV2.tsx` | Panel | Tailwind | Partial |
| Bottleneck Panel V2 (v2) | `/productivity-dashboard/components/v2/BottleneckPanelV2.tsx` | Panel | Tailwind | Partial |

---

## Part 4: Common/Shared Components

| Component | Path | Type | Styling | V2 Status |
|---|---|---|---|---|
| Unified Action Queue | `/productivity-dashboard/components/common/UnifiedActionQueue.tsx` | Panel | Tailwind | Done |
| Action Detail Drawer | `/productivity-dashboard/components/common/ActionDetailDrawer.tsx` | Modal | Tailwind | Done |
| KPI Card | `/productivity-dashboard/components/common/KPICard.tsx` | Card | Tailwind | Done |
| GlassPanel | `/productivity-dashboard/components/common/GlassPanel.tsx` | Primitive | CSS | Done |
| Glass Drawer | `/productivity-dashboard/components/common/GlassDrawer.tsx` | Modal | CSS | Done |
| Page Header | `/productivity-dashboard/components/common/PageHeader.tsx` | Primitive | CSS | Done |
| Section Header | `/productivity-dashboard/components/common/SectionHeader.tsx` | Primitive | CSS | Done |
| Stat Label | `/productivity-dashboard/components/common/StatLabel.tsx` | Primitive | CSS | Done |
| Stat Value | `/productivity-dashboard/components/common/StatValue.tsx` | Primitive | CSS | Done |
| Empty State | `/productivity-dashboard/components/common/EmptyState.tsx` | Feature | Tailwind | Done |
| Inline Help | `/productivity-dashboard/components/common/InlineHelp.tsx` | Primitive | Tailwind | Done |
| Filter Bar | `/productivity-dashboard/components/common/FilterBar.tsx` | Panel | Tailwind | Done |
| Multi-Select | `/productivity-dashboard/components/common/MultiSelect.tsx` | Form | Tailwind | Done |
| Date Range Picker | `/productivity-dashboard/components/common/DateRangePicker.tsx` | Form | Tailwind | Done |
| Data Drill Down Modal | `/productivity-dashboard/components/common/DataDrillDownModal.tsx` | Modal | Tailwind | Done |
| Data Health Badge | `/productivity-dashboard/components/common/DataHealthBadge.tsx` | Primitive | Tailwind | Done |
| Bespoke Table | `/productivity-dashboard/components/common/BespokeTable.tsx` | Table | Tailwind | Done |
| Skeletons | `/productivity-dashboard/components/common/Skeletons.tsx` | Primitive | Tailwind | Done |
| Logo Spinner | `/productivity-dashboard/components/common/LogoSpinner.tsx` | Primitive | Tailwind | Done |

---

## Part 5: UI Primitives (Radix-based)

| Component | Path | Type | Styling | V2 Status |
|---|---|---|---|---|
| Button | `/components/ui/button.tsx` | Primitive | Tailwind | Done |
| Checkbox | `/components/ui/checkbox.tsx` | Primitive | Tailwind | Done |
| Dropdown Menu | `/components/ui/dropdown-menu.tsx` | Primitive | Tailwind | Done |
| Input | `/components/ui/input.tsx` | Primitive | Tailwind | Done |
| Label | `/components/ui/label.tsx` | Primitive | Tailwind | Done |
| Popover | `/components/ui/popover.tsx` | Primitive | Tailwind | Done |
| Progress | `/components/ui/progress.tsx` | Primitive | Tailwind | Done |
| Separator | `/components/ui/separator.tsx` | Primitive | Tailwind | Done |
| Switch | `/components/ui/switch.tsx` | Primitive | Tailwind | Done |
| Table | `/components/ui/table.tsx` | Primitive | Tailwind | Done |
| Textarea | `/components/ui/textarea.tsx` | Primitive | Tailwind | Done |
| Tooltip | `/components/ui/tooltip.tsx` | Primitive | Tailwind | Done |
| Calendar | `/components/ui/calendar.tsx` | Primitive | Tailwind | Done |

---

## Part 6: Legacy Components (Not Started)

| Component | Path | Type | Styling | V2 Status |
|---|---|---|---|---|
| Landing Page | `/components/landing/LandingPage.tsx` | Tab | CSS | Not Started |
| Hero Section | `/components/landing/HeroSection.tsx` | Feature | CSS | Not Started |
| Login | `/components/Login.js` | Tab | Bootstrap | Not Started |
| Onboarding Page | `/components/OnboardingPage.tsx` | Tab | Bootstrap | Not Started |
| Dashboard (Legacy) | `/components/Dashboard.js` | Tab | Bootstrap | Not Started |

---

## Part 7: Key Statistics

| Metric | Count |
|--------|-------|
| **Total UI Components** | ~175 |
| **Tailwind (Done)** | ~140 |
| **Partial (Mixed)** | ~20 |
| **Not Started** | ~15 |
| **Tab Components** | 16 |
| **Modal/Drawer Components** | ~25 |
| **Card/Panel Components** | ~50 |

---

## Part 8: V0 Design Tokens (Reference)

### Colors
```
Background: #0f172a (slate-900)
Surface: rgba(30, 41, 59, 0.7) (slate-800 with opacity)
Primary Accent: #06b6d4 (cyan-500)
Text Primary: #f8fafc (slate-50)
Text Secondary: #94a3b8 (slate-400)
Border: rgba(255, 255, 255, 0.06)
```

### Glass Panel
```css
.glass-panel {
  background: rgba(30, 41, 59, 0.7);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 0.75rem;
}
```

### Typography
```
Headings: font-bold text-[#f8fafc]
Body: text-sm text-[#94a3b8]
Labels: text-xs uppercase tracking-wider
Metrics: font-mono font-semibold
```

---

## V0 MCP Reference Chats
- "Recruiting Capacity Planner" (cNbyypHn686) - Main app structure
- "Refresh Command Center" (qlhPnUJ36Kk) - Command center panels
