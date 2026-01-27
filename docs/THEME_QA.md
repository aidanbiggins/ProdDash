# Theme QA Checklist

**Last updated:** 2026-01-26

This checklist ensures theme consistency across light and dark modes.

---

## Pre-Release Checklist

### Automated Gates

- [x] `npm test -- --watchAll=false` - All unit tests pass (1379 tests)
- [x] `npm run build` - Production build succeeds
- [x] `npm run ui:no-bootstrap` - No Bootstrap class patterns
- [x] `npm run ui:style-audit` - UI styling follows design system
- [x] `npm run route:smoke` - All routes accessible (16 tests)
- [x] `npm run ui:theme-audit` - No hardcoded non-flipping colors

### Manual Visual QA

#### Light Mode Testing

1. [ ] Toggle theme to Light Mode via header toggle
2. [ ] Verify these elements are readable (no white-on-white):
   - [ ] Page headers (Command Center, Diagnose, Plan, Settings, Ask PlatoVue)
   - [ ] KPI cards (numbers, labels, trends)
   - [ ] Navigation tabs (active/inactive states visible)
   - [ ] Tables (header, rows, alternating colors)
   - [ ] Modals/dialogs have proper backgrounds
   - [ ] Form inputs have visible borders
   - [ ] Buttons have proper contrast

#### Dark Mode Testing

1. [ ] Toggle theme to Dark Mode
2. [ ] Verify these elements are readable (no dark-on-dark):
   - [ ] Same checklist as Light Mode

#### Theme Toggle Behavior

- [ ] Theme toggle in header works correctly
- [ ] Theme persists on page refresh
- [ ] Theme applies to all routes
- [ ] No flash of wrong theme on initial load

---

## Color Token Reference

### Use These (Theme-Aware)

| Tailwind Class | Purpose |
|----------------|---------|
| `bg-background` | Page/app background |
| `bg-card` | Card/panel backgrounds |
| `bg-muted` | Subtle backgrounds |
| `bg-accent` | Hover/active states |
| `bg-primary` | Primary action backgrounds |
| `text-foreground` | Primary text |
| `text-muted-foreground` | Secondary text |
| `text-primary` | Accent text |
| `border-border` | Standard borders |
| `hover:bg-accent` | Hover states |

### Semantic Status Colors (Tailwind Built-in)

Use Tailwind's built-in color scale for status indicators:

| Status | Background | Text | Border |
|--------|------------|------|--------|
| Bad/Error | `bg-red-500/10` | `text-red-400` | `border-red-500` |
| Warning | `bg-amber-500/10` | `text-amber-400` | `border-amber-500` |
| Success | `bg-green-500/10` | `text-green-400` | `border-green-500` |
| Info | `bg-blue-500/10` | `text-blue-400` | `border-blue-500` |
| Neutral | `bg-slate-500/10` | `text-slate-400` | `border-slate-500` |

### Avoid These (Non-Flipping)

| Pattern | Why | Replacement |
|---------|-----|-------------|
| `bg-[#hex]` | Hardcoded color won't flip | Use `bg-card`, `bg-muted`, or Tailwind color scale |
| `text-[#hex]` | Hardcoded color won't flip | Use `text-foreground`, `text-muted-foreground` |
| `bg-white/[opacity]` | White won't flip to dark | Use `bg-muted/30`, `bg-accent/30` |
| `border-white/[opacity]` | White won't flip to dark | Use `border-border` |
| `bg-[rgba(r,g,b)]` | Hardcoded color won't flip | Use Tailwind color scale with opacity |
| `backgroundColor: '#hex'` | CSS hardcoded color | Use `hsl(var(--popover))` or similar |

---

## Route Coverage

| Route | Light Mode | Dark Mode | Status |
|-------|------------|-----------|--------|
| `/` (landing) | ✅ | ✅ | Complete |
| `/` (authenticated) | ✅ | ✅ | Complete |
| `/ask` | ✅ | ✅ | Complete - Migrated |
| `/diagnose/*` | ✅ | ✅ | Complete - Fixed blue header |
| `/plan/*` | ✅ | ✅ | Complete |
| `/settings/*` | ✅ | ✅ | Complete |

---

## Known Issues / Blockers

### Current Blockers
None - All theme violations have been resolved.

### Deferred Items
None - All previously deferred components have been migrated:
- ~~AskPlatoVueV2.tsx~~ - Migrated
- ~~FilterBarV2.tsx~~ - Migrated
- ~~BottleneckPanelV2.tsx~~ - Migrated to Tailwind color scale
- ~~TeamCapacityPanelV2.tsx~~ - Migrated to Tailwind color scale
- ~~RequisitionsTableV2.tsx~~ - Migrated to Tailwind color scale

### Future Improvements
1. Add Playwright tests for visual regression
2. Create screenshot comparison script (`ui:route-screenshot`)
3. Add theme-audit to CI pipeline

---

## Audit History

| Date | Auditor | Result | Notes |
|------|---------|--------|-------|
| 2026-01-26 | Claude | Partial Pass | Theme audit script created; 83 violations in deferred components |
| 2026-01-26 | Claude | **PASS** | All 83 violations fixed; theme audit passes with 0 violations |

---

## Migration Summary

### Components Migrated (2026-01-26)

1. **DiagnoseTabV2.tsx** - Fixed blue header (`bg-[rgba(15,23,42,0.97)]` → `bg-background/95`)
2. **TopNavV2.tsx** - Complete rewrite with theme-aware colors
3. **AskPlatoVueV2.tsx** - Empty state migrated
4. **AskPlatoVueTabV2.tsx** - Complete migration (50+ color replacements)
5. **SettingsTabV2.tsx** - Header colors fixed
6. **PlanTabV2.tsx** - Header and sub-nav fixed
7. **OverviewTabV2.tsx** - Borders and hovers fixed
8. **HiringManagersTabV2.tsx** - Borders and hovers fixed
9. **HMFrictionTabV2.tsx** - Borders, hovers, and backgrounds fixed
10. **RecruiterDetailTabV2.tsx** - Chart tooltips and teal sections fixed
11. **FilterBarV2.tsx** - All white-based patterns replaced
12. **BottleneckPanelV2.tsx** - Status colors converted to Tailwind scale
13. **TeamCapacityPanelV2.tsx** - Utilization colors converted to Tailwind scale
14. **RequisitionsTableV2.tsx** - Priority/status badges converted to Tailwind scale
15. **PipelineFunnelV2.tsx** - Borders and status colors fixed
16. **CommandCenterV2.tsx** - Alternating row backgrounds fixed
17. **toggles.tsx** - Focus ring offset and checkbox colors fixed
