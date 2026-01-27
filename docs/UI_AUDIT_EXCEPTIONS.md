# UI Audit Exceptions

This document lists all files exempt from the UI style audit (`npm run ui:style-audit`) and the justification for each exception.

## Exception Categories

### 1. UI Primitives (Typography Allowlist)

These files **define** the typography system and are allowed to use inline styles.

| File | Justification | Planned Removal |
|------|---------------|-----------------|
| `PageHeader.tsx` | Defines page header typography | Never - core primitive |
| `SectionHeader.tsx` | Defines section header typography | Never - core primitive |
| `StatLabel.tsx` | Defines stat label typography | Never - core primitive |
| `StatValue.tsx` | Defines stat value typography | Never - core primitive |
| `KPICard.tsx` | Defines KPI card typography | Never - core primitive |
| `AnimatedNumber.tsx` | Number animation sizing | Never - core primitive |
| `HeadingsV2.tsx` | V2 heading primitives | Never - core primitive |
| `EmptyState.tsx` | Empty state typography | Never - core primitive |
| `Skeletons.tsx` | Loading state sizing | Never - core primitive |

### 2. Header Tag Allowlist

These files are allowed to use raw `<h1>`, `<h2>`, `<h3>` tags.

| File | Justification | Planned Removal |
|------|---------------|-----------------|
| UI Primitives | Define header components | Never |
| `MetricDrillDown.tsx` | h2 for metric values in data display | Q2 2025 - migrate to V2 |
| `DataDrillDownModal.tsx` | Modal headers | Q2 2025 - migrate to V2 |
| Command Center `*V2.tsx` | V2 design system with tokens | Never - V2 standard |
| `SectionCard.tsx` | Section card with BEM title | Q2 2025 - migrate to V2 |
| Guidance components | Intentional h2/h3 for UX | Q2 2025 - migrate to V2 |
| `AppLayoutV2.tsx` | Layout title | Never - V2 standard |

### 3. Hardcoded Color Allowlist

These files are allowed to use hardcoded hex colors (`#abc123`) or `rgb()`/`rgba()`.

**Theme/Config Files:**
| File | Justification |
|------|---------------|
| `dashboard-theme.css` | Defines the color theme |
| `chartColors.ts` | Chart color palette |
| `chartPalette.ts` | Chart color palette |
| `navigation.css` | Navigation styling |
| `layout.css` | Layout styling |

**V2 Chart Components:**
| File | Justification |
|------|---------------|
| `HMFrictionTabV2.tsx` | Recharts data visualization - stacked bar colors |
| `HiringManagersTabV2.tsx` | Dashboard charts |
| `OverviewTabV2.tsx` | Overview charts |
| `RecruiterDetailTabV2.tsx` | Performance charts |
| `PipelineFunnelV2.tsx` | Funnel visualization |
| `PipelineChartV2.tsx` | Pipeline chart colors |

**Status/Badge Components:**
| File | Justification |
|------|---------------|
| `ActionDetailDrawer.tsx` | Status colors (done/overdue) |
| `DataHealthBadge.tsx` | Health status colors |
| `DavosBadge.tsx` | Badge semantic colors |
| `ConfidenceBadge.tsx` | Confidence level colors |
| `CoverageBanner.tsx` | Coverage status colors |
| `ProgressIndicator.tsx` | Step indicator colors |
| `UnifiedActionQueue.tsx` | Action status colors |
| `FilterActiveIndicator.tsx` | Filter state colors |

**Modal/Drawer Components:**
| File | Justification |
|------|---------------|
| `PIIWarningModal.tsx` | Warning colors |
| `ImportProgressModal.tsx` | Progress phase colors |
| `BenchmarkConfigModal.tsx` | Config UI colors |
| `StageMappingModal.tsx` | Mapping UI colors |
| `ClearDataConfirmationModal.tsx` | Delete confirmation |
| `ExplainDrawer.tsx` | Explanation panel colors |
| `HelpDrawer.tsx` | Help content colors |
| `PreMortemDrawer.tsx` | Analysis colors |
| `HMDetailDrawer.tsx` | HM detail colors |
| `ReqDrilldownDrawer.tsx` | Requisition detail colors |

**Other Components:**
| File | Justification |
|------|---------------|
| `Skeletons.tsx` | Loading state gradients |
| `DataCoveragePanel.tsx` | Coverage visualization |
| `PipelineHealthCard.tsx` | Health chart colors |
| `ChartHelp.tsx` | Chart tooltip styling |
| `DataDrillDownModal.tsx` | Data display colors |
| `DataHealthPanel.tsx` | Health panel colors |
| `MetricDrillDown.tsx` | Metric display colors |
| `FeatureBlockedState.tsx` | Blocked feature colors |
| `FeatureLimitedState.tsx` | Limited feature colors |
| `OrgSwitcher.tsx` | Org selector colors |

### 4. card-bespoke Allowlist

These files are allowed to use the `card-bespoke` class.

| File | Justification | Planned Removal |
|------|---------------|-----------------|
| `DataHealthPanel.tsx` | Data health card styling | Q2 2025 - migrate to glass-panel |
| `PipelineHealthCard.tsx` | Pipeline health card | Q2 2025 - migrate to glass-panel |

## Design System Notes

### V1 Design System (Legacy)
- Uses CSS classes from `dashboard-theme.css`
- Headers: `PageHeader`, `SectionHeader` components
- Typography: `StatLabel`, `StatValue` components
- Cards: `card-bespoke`, `GlassPanel`

### V2 Design System (Current)
- Uses Tailwind CSS with design tokens
- Headers: Raw `<h1>`, `<h2>`, `<h3>` with `text-foreground` / `text-muted-foreground`
- Typography: Tailwind classes (`text-sm`, `font-semibold`, etc.)
- Cards: `glass-panel`, shadcn/ui `Card`
- Colors: Tailwind tokens (`bg-background`, `border-border`, etc.)

V2 components are allowed to use raw headers **if** they use V2 design tokens (`text-foreground`, `text-muted-foreground`, etc.). Headers without design tokens will fail the audit.

## Reviewing Exceptions

When adding a new exception:
1. Add the file to the appropriate allowlist in `scripts/ui-style-audit.js`
2. Document the exception in this file
3. Set a "Planned Removal" date if the exception is temporary
4. Review exceptions quarterly and migrate where possible

## Running the Audit

```bash
npm run ui:style-audit
```

The audit will pass if all styling violations are either fixed or in the documented allowlists.
