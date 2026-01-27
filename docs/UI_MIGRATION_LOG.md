# UI Migration Log

**Last updated:** 2026-01-26

This document tracks the V0 design system migration status for all routes and components.

---

## Route Inventory

### Public Routes

| Route | Component | Status | Notes |
|-------|-----------|--------|-------|
| `/` (unauthenticated) | `LandingPage` | ✅ V0 | Custom landing page with scroll animations |
| `/about` | `AboutPage` | ✅ V0 | Company info page |
| `/login` | `Login` | ✅ V0 | Auth flow with Supabase |
| `/invite/:token` | `InviteAcceptPage` | ✅ V0 | Org invitation acceptance |

### Authenticated Routes (V2 Dashboard)

| Route | V2 Container | Sub-component | Status | Notes |
|-------|--------------|---------------|--------|-------|
| `/` (authenticated) | `AppLayoutV2` | `CommandCenterV2` | ✅ V0 | Default landing |
| `/control-tower` | `AppLayoutV2` | `CommandCenterV2` | ✅ V0 | Executive command center |
| `/ask` | `AppLayoutV2` | `AskPlatoVueV2` | ✅ V0 | Conversational interface - Migrated |
| `/diagnose/*` | `AppLayoutV2` | `DiagnoseTabV2` | ✅ V0 | Diagnostics hub - Fixed |
| `/plan/*` | `AppLayoutV2` | `PlanTabV2` | ✅ V0 | Planning tools |
| `/settings/*` | `AppLayoutV2` | `SettingsTabV2` | ✅ V0 | Configuration |
| `/onboarding` | `OnboardingPage` | - | ✅ V0 | Post-signup org setup |

### Diagnose Sub-routes (via DiagnoseTabV2)

| Sub-route | Component | Status | Notes |
|-----------|-----------|--------|-------|
| `/diagnose/overview` | `OverviewTabV2` | ✅ V0 | Migrated - borders/hovers fixed |
| `/diagnose/recruiter` | `RecruiterDetailTabV2` | ✅ V0 | Migrated - tooltips and teal sections fixed |
| `/diagnose/hm-friction` | `HMFrictionTabV2` | ✅ V0 | Migrated - borders/hovers fixed |
| `/diagnose/hiring-managers` | `HiringManagersTabV2` | ✅ V0 | Migrated - borders/hovers fixed |
| `/diagnose/bottlenecks` | `BottleneckPanelV2` | ✅ V0 | Migrated - status colors to Tailwind scale |
| `/diagnose/quality` | `QualityTab` (legacy) | 🔶 Legacy | Uses glass-panel, needs migration |
| `/diagnose/sources` | `SourceEffectivenessTab` (legacy) | 🔶 Legacy | Uses glass-panel, needs migration |
| `/diagnose/velocity` | `VelocityInsightsTab` (legacy) | 🔶 Legacy | Uses glass-panel, needs migration |

### Plan Sub-routes (via PlanTabV2)

| Sub-route | Component | Status | Notes |
|-----------|-----------|--------|-------|
| `/plan/capacity` | `CapacityTab` (legacy) | 🔶 Legacy | Uses glass-panel, needs migration |
| `/plan/rebalancer` | `CapacityRebalancerTab` (legacy) | 🔶 Legacy | Uses glass-panel |
| `/plan/forecast` | `ForecastingTab` (legacy) | 🔶 Legacy | Uses glass-panel |
| `/plan/scenarios` | `ScenarioLibraryTab` (legacy) | 🔶 Legacy | Uses glass-panel |

### Settings Sub-routes (via SettingsTabV2)

| Sub-route | Component | Status | Notes |
|-----------|-----------|--------|-------|
| `/settings/data-health` | `DataHealthTab` (legacy) | 🔶 Legacy | Uses glass-panel |
| `/settings/sla` | `SlaSettingsTab` (legacy) | 🔶 Legacy | Uses glass-panel |
| `/settings/ai` | `AiSettingsTab` (legacy) | 🔶 Legacy | Uses glass-panel |
| `/settings/org` | `OrgSettingsTab` (legacy) | 🔶 Legacy | Uses glass-panel |

### Legacy Routes (Deferred)

| Route | Component | Status | Notes |
|-------|-----------|--------|-------|
| `/v1` | `RecruiterProductivityDashboard` | 🔶 Legacy | V1 dashboard preserved for comparison |
| `/v1/*` | `RecruiterProductivityDashboard` | 🔶 Legacy | Full V1 routing |
| `/legacy-dashboard` | `Dashboard` | ❌ Deprecated | Original pre-productivity dashboard |
| `/compare` | `ComparisonView` | ❌ Deprecated | Legacy comparison view |

---

## Status Legend

- ✅ **V0** - Fully migrated to V0 design system with theme-aware colors
- 🔶 **Legacy** - Uses `glass-panel` and theme-aware CSS variables (works but not V0 primitives)
- ❌ **Deprecated** - Legacy code preserved but not actively maintained

---

## Migration Completed (2026-01-26)

All V2 components have been migrated to use theme-aware Tailwind classes:

### Components Migrated

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

---

## Common Patterns Replaced

| Pattern | Replaced With | Notes |
|---------|--------------|-------|
| `bg-[rgba(15,23,42,0.97)]` | `bg-background/95` | Dark slate background |
| `bg-[#1e293b]` | `bg-card` | Card backgrounds |
| `bg-[#0f172a]` | `bg-background` | Page backgrounds |
| `text-[#f8fafc]` | `text-foreground` | Primary text |
| `text-[#94a3b8]` | `text-muted-foreground` | Secondary text |
| `text-[#64748b]` | `text-muted-foreground` | Tertiary text |
| `text-[#06b6d4]` | `text-primary` | Accent text |
| `border-white/[0.06]` | `border-border` | Subtle borders |
| `border-white/[0.08]` | `border-border` | Standard borders |
| `bg-white/[0.02]` | `bg-muted/30` | Subtle hover states |
| `bg-white/[0.04]` | `bg-accent/30` | Active states |
| `bg-white/[0.06]` | `bg-muted` | Elevated surfaces |
| `hover:bg-white/[0.06]` | `hover:bg-accent/50` | Hover states |
| `hover:bg-white/[0.04]` | `hover:bg-accent/30` | Subtle hover |
| `backgroundColor: '#0a0a0a'` | `backgroundColor: 'hsl(var(--popover))'` | Chart tooltips |
| `bg-[#ef4444]` | `bg-red-500` | Error/critical status |
| `bg-[#f59e0b]` | `bg-amber-500` | Warning status |
| `bg-[#22c55e]` | `bg-green-500` | Success status |
| `bg-[#3b82f6]` | `bg-blue-500` | Info status |
| `text-[#fca5a5]` | `text-red-400` | Error text |
| `text-[#fcd34d]` | `text-amber-400` | Warning text |
| `text-[#86efac]` | `text-green-400` | Success text |
| `text-[#93c5fd]` | `text-blue-400` | Info text |
| `bg-[rgba(239,68,68,0.15)]` | `bg-red-500/15` | Error badge background |
| `bg-[rgba(245,158,11,0.15)]` | `bg-amber-500/15` | Warning badge background |

---

## Audit History

| Date | Action | Files Changed |
|------|--------|---------------|
| 2026-01-26 | Initial V0 migration | Created V2 components |
| 2026-01-26 | Theme consistency fixes | DiagnoseTabV2, TopNavV2, AskPlatoVueTabV2, SettingsTabV2, PlanTabV2 |
| 2026-01-26 | Created migration log | docs/UI_MIGRATION_LOG.md |
| 2026-01-26 | **Complete migration** | All 17 V2 components migrated; theme-audit passes with 0 violations |
| 2026-01-26 | **Legacy fencing** | Moved 18 legacy directories to `_legacy/`; created legacy-audit script |

---

## Legacy Components Fencing

As of 2026-01-26, legacy V1 components are fenced in `src/productivity-dashboard/components/_legacy/`.

### Why Fencing?

- **Single source of truth**: V0/V2 components in `/v2/` are the active design system
- **Clear boundaries**: Legacy imports are audited and must be explicitly approved
- **Gradual migration**: V2 wrapper tabs can embed legacy sub-components until native V2 versions exist
- **Backward compatibility**: `/v1` route continues to work for testing and comparison

### Fenced Directories

```
_legacy/
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
├── command-center/
└── ProductivityDashboard.tsx
```

### Approved Legacy Imports

V2 components may embed legacy sub-components with explicit approval:

| V2 Component | Approved Legacy Imports |
|--------------|------------------------|
| `DiagnoseTabV2` | bottlenecks, quality, source-effectiveness, velocity-insights |
| `PlanTabV2` | capacity, capacity-rebalancer, forecasting, scenarios |
| `SettingsTabV2` | data-health, settings (SLA, AI, Org) |

### Legacy Audit

Run `npm run ui:legacy-audit` to check for unapproved legacy imports in V2 components.
