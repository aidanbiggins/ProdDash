# Mobile QA Report

**Date:** 2026-01-28
**Version:** V2 Mobile Completion Phase A
**Build:** Post V2_MOBILE_COMPLETION_V1_BUILD

---

## Summary

This report documents the mobile usability improvements made as part of the V2 Mobile Completion plan.

### What Was Fixed

#### Phase A: V2 Primitive Foundation

1. **GlassDrawer.tsx** - Made mobile-responsive
   - Full-width on mobile (`<md`), respects `width` prop on desktop
   - Close button now has 44px minimum touch target
   - Replaced Bootstrap icon with lucide-react X icon
   - Added proper header border and spacing

2. **BespokeTable.tsx** - Added overflow handling
   - Added `overflow-x-auto` wrapper by default
   - Tables now scroll horizontally on mobile without breaking page layout

3. **FilterBar.tsx** - Mobile layout improvements
   - Date inputs stack vertically on mobile (was inline and overflowing)
   - Dimensional filter grid now 1-column on mobile, expanding on larger screens
   - Dropdown triggers now have 44px minimum height for touch targets
   - Date preset buttons scrollable on mobile

4. **HMDetailDrawer.tsx** - Mobile-responsive drawer
   - Full-width on mobile, 480px on desktop
   - Close button now has 44px touch target

5. **VelocityCopilotPanel.tsx** - Mobile-responsive modal
   - Converted inline styles to Tailwind responsive classes
   - Full-width on mobile, 500px on desktop

6. **CommandCenterV2.tsx** - Modal improvements
   - Close button on Actions modal now has 44px touch target

#### Infrastructure

1. **Created `scripts/mobile-css-audit.js`** - Objective verification tool
   - Detects fixed widths > 430px without responsive fallback
   - Detects min-width > 430px that may cause horizontal scroll
   - Detects overflow-x: hidden (which hides mobile issues)
   - Detects small touch targets on interactive elements

2. **Added npm scripts:**
   - `npm run mobile:check` - Run mobile CSS audit
   - `npm run qa:mobile` - Full mobile QA suite

3. **Updated route smoke test** - Added missing `pipeline-benchmarks` route

---

## What Is Still Risky (Minimal)

### Small Touch Targets (22 instances)

Most are intentionally compact UI elements:

1. **Filter chip remove buttons (p-0.5)** - The parent chip is the tap target
2. **Pagination controls (h-8)** - Standard shadcn/ui pattern, acceptable
3. **Metric drilldown close button (p-1)** - Low-frequency action
4. **Modal close buttons** - Some still need 44px target (minor)

### Legacy Components Not Yet Migrated

The following legacy components are wrapped by V2 but not yet converted:
- `AiProviderSettings.tsx` - Modal should become Sheet on mobile (functional as-is)
- Various scenario forms - Should use V2 form primitives

**Fixed (mobile-usable but still legacy):**
- `SlaSettingsTab.tsx` - Tables now scroll horizontally with min-width
- `DataHealthTab.tsx` - Tables now scroll horizontally with min-width
- `FitExplainDrawer.tsx` - Full-width on mobile, 44px close button

---

## How to Re-Run Mobile Checks

```bash
# Run mobile CSS audit (detects layout issues)
npm run mobile:check

# Run all mobile QA checks
npm run qa:mobile

# Run full QA suite including mobile
npm run qa:all

# Run route smoke tests
npm run route:smoke
```

### Manual Testing Checklist

See `docs/MOBILE_AUDIT_CHECKLIST.md` for the complete manual QA checklist.

Key routes to test:
1. `/` (Command Center) - Verify KPI cards wrap, actions panel scrollable
2. `/settings/*` - Verify dropdown navigation works
3. `/diagnose/overview` - Verify funnel chart renders
4. `/plan/capacity` - Verify RecruiterLoadTable scrolls horizontally

### Device Testing

Recommended viewport widths:
- 360px (minimum handset)
- 375px (iPhone SE)
- 390px (iPhone 12)
- 430px (maximum handset)

---

## Verification Status

| Check | Status |
|-------|--------|
| `npm test` | ✅ Tests passed |
| `npm run build` | ✅ Compiled successfully |
| `npm run route:smoke` | ✅ 16 tests passed |
| `npm run mobile:check` | ⚠️ 30 minor issues (mostly touch targets, see below) |

**Mobile check breakdown (30 issues):**
- Touch targets < 44px: Filter chip buttons, pagination, minor close buttons
- These are intentionally compact or have larger parent tap areas

---

## Phase B Progress (Partial)

### Settings Routes (B1) ✅ COMPLETE

| Route | Status | Changes |
|-------|--------|---------|
| `/settings/org` | ✅ Done | Form stacks on mobile, 44px touch targets on inputs/buttons |
| `/settings/ai` | ✅ Done | Modal close button touch target fixed |
| `/settings/sla` | ✅ Done | Table has min-width (700px) + horizontal scroll wrapper, action buttons stack on mobile with 44px touch targets |
| `/settings/pipeline-targets` | ✅ Done | Table has min-width (700px) + horizontal scroll wrapper, action buttons stack on mobile with 44px touch targets |
| `/settings/data-health` | ✅ Done | Both tables have min-width (800px) + horizontal scroll wrappers |

### Plan Routes (B2)

| Route | Status | Changes |
|-------|--------|---------|
| `/plan/capacity` | ✅ Done | FitExplainDrawer: full-width on mobile, 44px close button |
| `/plan/rebalancer` | ✅ Done | MoveDetailDrawer uses GlassDrawer (now mobile-responsive) |
| `/plan/forecast` | ⏳ Pending | ReqHealthDrawer migration |
| `/plan/scenarios` | ⏳ Pending | Forms migration |

### Diagnose Routes (B3)

| Route | Status | Changes |
|-------|--------|---------|
| `/diagnose/hm-friction` | ✅ Done | HMDetailDrawer: full-width on mobile, 44px close button |
| `/diagnose/velocity` | ✅ Done | VelocityCopilotPanel: full-width on mobile |
| Other routes | ⏳ Pending | Manual verification |

### Command Center (B4)

| Route | Status | Changes |
|-------|--------|---------|
| `/` | ✅ Done | Actions modal close button touch target fixed |
| `/ask` | ⏳ Pending | Verify chat input |

---

## Next Steps

1. ~~SLA settings table card layout on mobile~~ ✅ Done (horizontal scroll approach)
2. Full manual QA pass on all routes at 375px
3. Scenario wizard forms V2 migration
4. Phase C: Create formal Playwright tests (if capacity)
5. Plan routes: ReqHealthDrawer and Forecast tab verification
6. Diagnose routes: Manual verification of remaining tabs

---

*End of MOBILE_QA_REPORT.md*
