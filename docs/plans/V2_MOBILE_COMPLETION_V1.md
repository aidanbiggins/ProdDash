# V2 Mobile Completion Plan

**Version:** 1.0
**Date:** 2026-01-27
**Status:** Draft

---

## Overview

This plan addresses the V2 migration completion and mobile usability (360–430px) across all form and interactive surfaces. The goal is to finish V2 migration, fix handset usability, and remove/isolate legacy V1 patterns without changing business logic.

### Hard Constraints
- Do not change business logic or metrics
- Prefer V2 primitives and Tailwind responsive classes
- No one-off styling per page—use shared primitives
- Must not break desktop

---

## 1. Complete Inventory

### 1.1 Routes Summary

| Route | Tab Type | UI System | Has Forms | Has Drawers/Modals | Has Tables |
|-------|----------|-----------|-----------|-------------------|------------|
| `/` | command-center | V2 | No | Yes (Actions modal) | Yes |
| `/ask` | ask | V2 | Yes (chat input) | No | No |
| `/diagnose/overview` | overview | V2 | No | Yes (drill-down) | Yes (leaderboard) |
| `/diagnose/recruiter/:id` | recruiter | V2 | No | Yes (HelpDrawer) | Yes |
| `/diagnose/hm-friction` | hm-friction | V2 wrapper → Legacy | No | Yes (HMDetailDrawer) | Yes |
| `/diagnose/hiring-managers` | hiring-managers | V2 wrapper → Legacy | No | Yes (HMDetailDrawer) | Yes |
| `/diagnose/bottlenecks` | bottlenecks | V2 | No | Yes (ReqDrilldownDrawer) | Yes |
| `/diagnose/quality` | quality | V2 | No | Yes (HelpDrawer) | Yes |
| `/diagnose/sources` | source-mix | V2 | No | Yes (HelpDrawer) | Yes |
| `/diagnose/velocity` | velocity | V2 wrapper → Legacy | No | Yes (Copilot panel) | Yes |
| `/plan/capacity` | capacity | V2 wrapper → Legacy | No | Yes (FitExplainDrawer) | Yes |
| `/plan/rebalancer` | capacity-rebalancer | V2 wrapper → Legacy | No | Yes (MoveDetailDrawer) | Yes |
| `/plan/forecast` | forecasting | V2 wrapper → Legacy | Yes (sliders) | Yes (ReqHealthDrawer) | Yes |
| `/plan/scenarios` | scenarios | V2 wrapper → Legacy | Yes (wizard forms) | Yes (CitationsDrawer) | Yes |
| `/settings/data-health` | data-health | V2 wrapper → Legacy | No | No | Yes |
| `/settings/sla` | sla-settings | V2 wrapper → Legacy | Yes (table inputs) | No | Yes (editable) |
| `/settings/pipeline-targets` | pipeline-benchmarks | V2 | Yes (config modal) | Yes (BenchmarkConfigModal) | No |
| `/settings/ai` | ai-settings | V2 wrapper → Legacy | Yes (BYOK form) | Yes (AiProviderSettings modal) | No |
| `/settings/org` | org-settings | V2 wrapper → Legacy | Yes (org config) | No | Yes |

### 1.2 Forms Inventory

| Component | File Path | UI System | Mobile Failure Modes | Fix Approach |
|-----------|-----------|-----------|---------------------|--------------|
| **FilterBar** | `components/common/FilterBar.tsx` | V2 | Date inputs overflow on 360px; grid cols too wide; preset buttons wrap poorly | Add `flex-wrap`, stack date inputs vertically on mobile, reduce grid to 1 col on xs |
| **CSVUpload** | `components/CSVUpload.tsx` | Mixed | Dropzone text unreadable, buttons too small | Convert to V2 primitives, increase touch targets to 44px |
| **AiProviderSettings** | `components/_legacy/settings/AiProviderSettings.tsx` | Legacy | Modal overflows viewport, inputs too narrow, vault unlock form cramped | Migrate to V2 Sheet component, full-screen on mobile |
| **SlaSettingsTab** | `components/_legacy/settings/SlaSettingsTab.tsx` | Legacy | Table horizontal scroll breaks, inputs too small, grid layout breaks | Convert table to card stack on mobile, use V2 Input primitives |
| **OrgSettingsTab** | `components/_legacy/settings/OrgSettingsTab.tsx` | Legacy | Form inputs fixed width | Use w-full and responsive padding |
| **BenchmarkConfigModal** | `components/pipeline-health/BenchmarkConfigModal.tsx` | V2 | Modal too wide for mobile, sliders cramped | Convert to full-screen Sheet on mobile, stack controls |
| **SpinUpTeamForm** | `components/_legacy/scenarios/parameters/SpinUpTeamForm.tsx` | Legacy | Fixed widths, inline grids break | Convert to V2 primitives, stack on mobile |
| **RecruiterLeavesForm** | `components/_legacy/scenarios/parameters/RecruiterLeavesForm.tsx` | Legacy | Fixed widths | Convert to V2 primitives |
| **HiringFreezeForm** | `components/_legacy/scenarios/parameters/HiringFreezeForm.tsx` | Legacy | Fixed widths | Convert to V2 primitives |
| **SettingsTabV2 (nav)** | `components/v2/SettingsTabV2.tsx` | V2 | Already fixed—uses mobile dropdown | Verified working |

### 1.3 Drawers/Modals Inventory

| Component | File Path | UI System | Mobile Failure Modes | Fix Approach |
|-----------|-----------|-----------|---------------------|--------------|
| **HelpDrawer** | `components/common/HelpDrawer.tsx` | V2 | Width `max-w-md` may overflow on 360px | Use Sheet full-screen on mobile |
| **DataDrillDownModal** | `components/common/DataDrillDownModal.tsx` | V2 | Table inside modal overflows | Stack layout, horizontal scroll with proper container |
| **ActionDetailDrawer** | `components/common/ActionDetailDrawer.tsx` | V2 | Fixed max-width | Use responsive max-w with mobile full-screen fallback |
| **ExplainDrawer** | `components/common/ExplainDrawer.tsx` | V2 | Content may overflow | Add mobile-safe padding and scroll |
| **GlassDrawer** | `components/common/GlassDrawer.tsx` | V2 | Base drawer primitive—needs responsive widths | Add `w-full md:max-w-md` pattern |
| **HMDetailDrawer** | `components/_legacy/hm-friction/HMDetailDrawer.tsx` | Legacy | Fixed widths, legacy styling | Migrate to V2 Sheet |
| **ReqDrilldownDrawer** | `components/_legacy/bottlenecks/ReqDrilldownDrawer.tsx` | Legacy | Timeline layout breaks on mobile | Migrate to V2 Sheet, stack timeline |
| **ReqDrilldownDrawerV2** | `components/v2/bottlenecks/ReqDrilldownDrawerV2.tsx` | V2 | May need mobile polish | Verify width handling |
| **FitExplainDrawer** | `components/_legacy/capacity/FitExplainDrawer.tsx` | Legacy | Fixed width | Migrate to V2 Sheet |
| **OverloadExplainDrawer** | `components/_legacy/capacity/OverloadExplainDrawer.tsx` | Legacy | Fixed width | Migrate to V2 Sheet |
| **ReqHealthDrawer** | `components/_legacy/forecasting/ReqHealthDrawer.tsx` | Legacy | Fixed width | Migrate to V2 Sheet |
| **RecruiterWorkloadDrawer** | `components/_legacy/capacity-rebalancer/RecruiterWorkloadDrawer.tsx` | Legacy | Fixed width, table overflow | Migrate to V2 Sheet |
| **MoveDetailDrawer** | `components/_legacy/capacity-rebalancer/MoveDetailDrawer.tsx` | Legacy | Fixed width | Migrate to V2 Sheet |
| **CitationsDrawer** | `components/_legacy/scenarios/output/CitationsDrawer.tsx` | Legacy | Fixed width | Migrate to V2 Sheet |
| **StageMappingModal** | `components/StageMappingModal.tsx` | Mixed | Table inside modal overflows | Convert to full-screen on mobile |
| **PIIWarningModal** | `components/common/PIIWarningModal.tsx` | V2 | Likely OK but verify | Verify width handling |
| **ImportProgressModal** | `components/common/ImportProgressModal.tsx` | V2 | Progress bars may need adjustment | Verify width handling |
| **ClearDataConfirmationModal** | `components/common/ClearDataConfirmationModal.tsx` | V2 | Likely OK | Verify width handling |
| **UltimateDemoModal** | `components/common/UltimateDemoModal.tsx` | V2 | Content-heavy modal | Verify scrolling and width |
| **Actions Modal (inline)** | `components/v2/CommandCenterV2.tsx` | V2 | Inline modal code, fixed max-w-2xl | Use responsive max-w, full-screen on mobile |

### 1.4 Tables with Filters Inventory

| Component | File Path | UI System | Mobile Failure Modes | Fix Approach |
|-----------|-----------|-----------|---------------------|--------------|
| **RequisitionsTableV2** | `components/v2/RequisitionsTableV2.tsx` | V2 | Table overflows, needs horizontal scroll container | Add `overflow-x-auto` wrapper, min-widths on cols |
| **RecruiterLoadTable** | `components/_legacy/capacity/RecruiterLoadTable.tsx` | V2 (updated) | Already converted to V2 styling | Verify mobile scroll behavior |
| **Recruiter Leaderboard** | `components/v2/OverviewTabV2.tsx` (inline BespokeTable) | V2 | Uses BespokeTable—may overflow | Add scroll container, verify touch targets |
| **BespokeTable** | `components/common/BespokeTable.tsx` | Mixed | Generic table—all consumers need scroll wrappers | Add default overflow-x-auto wrapper |
| **SLA Table** | `components/_legacy/settings/SlaSettingsTab.tsx` | Legacy | Horizontal scroll, inputs clipped | Convert to card stack on mobile |
| **Data Health Tables** | `components/_legacy/data-health/DataHealthTab.tsx` | Legacy | Multiple tables overflow | Add scroll containers |
| **HM Scorecard Table** | `components/_legacy/hiring-managers/HMScorecard.tsx` | Legacy | Table overflow | Migrate to V2 with scroll container |
| **HM Action Queue** | `components/_legacy/hiring-managers/HMActionQueue.tsx` | Legacy | List items may have clipped text | Increase touch targets, wrap text |
| **BreachTableV2** | `components/v2/bottlenecks/BreachTableV2.tsx` | V2 | Needs verification | Verify scroll handling |
| **OwnerLeaderboardV2** | `components/v2/bottlenecks/OwnerLeaderboardV2.tsx` | V2 | Needs verification | Verify scroll handling |

---

## 2. V2 Definition of Done for Form Surfaces

A form surface is considered V2-complete and mobile-ready when ALL of the following are true:

### 2.1 Layout Requirements
- [ ] Uses V2 layout primitives: `glass-panel`, `SectionHeader`, `SubViewHeader`
- [ ] No `PageShell`/`PageHeader` from legacy layout (use V2 equivalents)
- [ ] All containers use Tailwind responsive classes (not fixed px widths)
- [ ] No fixed widths exceeding 430px without responsive override
- [ ] Uses `space-y-*` or `gap-*` for vertical spacing (not margin hacks)

### 2.2 Form Input Requirements
- [ ] Uses V2/Radix UI form primitives from `components/ui/`:
  - `Input` for text inputs
  - `Button` for actions
  - `Checkbox` / `Switch` for toggles
  - `Popover` / `DropdownMenu` for selects
  - `Textarea` for multiline
- [ ] All inputs have minimum touch target of 44×44px
- [ ] Labels use `text-xs font-medium text-muted-foreground`
- [ ] Error states use `text-bad` or `border-bad`

### 2.3 Responsive Behavior
- [ ] No horizontal scroll on `<body>` at 360px viewport
- [ ] Form fields stack vertically at `<md` breakpoint
- [ ] Grid layouts use `grid-cols-1 md:grid-cols-2` (or similar)
- [ ] Date inputs stack vertically on mobile
- [ ] Buttons are full-width on mobile (`w-full md:w-auto`)

### 2.4 Drawer/Modal Requirements
- [ ] Uses `Sheet` component from `components/ui/sheet.tsx` for drawers
- [ ] Drawers are full-screen (`w-full h-full`) on mobile (`<md`)
- [ ] Drawers have proper backdrop and close button
- [ ] Modal content has `max-h-[90vh]` with internal scroll
- [ ] Close button is ≥44px touch target

### 2.5 Table Requirements
- [ ] Tables wrapped in `overflow-x-auto` container
- [ ] Uses `min-w-*` on table for proper scroll behavior
- [ ] Row actions have ≥44px touch targets
- [ ] Consider card layout alternative for mobile (optional)

---

## 3. Objective Verification

### 3.1 Testing Strategy

Since **Playwright is NOT installed**, we use a fallback verification approach:

#### A. Route Smoke Tests (Existing)
```bash
npm run route:smoke
```
- Verifies all routes render without crash
- Located at: `src/productivity-dashboard/routes/__tests__/route-smoke.test.ts`

#### B. CSS Audit Script (New)
Create `scripts/mobile-css-audit.js` to detect:
- Elements with `min-width` > 430px
- `overflow-x: hidden` on body (hides problems)
- Fixed `width` values > 430px without responsive fallback
- `position: fixed` elements without mobile handling

```bash
npm run audit:mobile-css
```

#### C. Component Render Tests (New)
For each form surface, add a render test that:
- Mounts component at 375px viewport width
- Asserts no horizontal overflow
- Asserts all interactive elements have ≥44px touch target

Located at: `src/productivity-dashboard/components/**/__tests__/`

#### D. Manual Visual QA Checklist
Use `docs/MOBILE_AUDIT_CHECKLIST.md` (see Section 5)

### 3.2 CI Integration

Add to `package.json`:
```json
{
  "scripts": {
    "qa:all": "npm test && npm run ui:style-audit && npm run ui:legacy-audit && npm run route:smoke",
    "qa:mobile": "npm run audit:mobile-css && npm run test:mobile-forms",
    "audit:mobile-css": "node scripts/mobile-css-audit.js",
    "test:mobile-forms": "jest --testPathPattern='mobile\\.test\\.tsx?$'"
  }
}
```

### 3.3 Success Metrics
- [ ] `npm run qa:all` passes
- [ ] `npm run qa:mobile` passes
- [ ] All items in `docs/MOBILE_AUDIT_CHECKLIST.md` checked off
- [ ] No console errors at 375px viewport in dev tools

---

## 4. Deliverables

### 4.1 Documentation
- [x] `docs/plans/V2_MOBILE_COMPLETION_V1.md` (this document)
- [ ] `docs/MOBILE_AUDIT_CHECKLIST.md` (manual QA checklist)

### 4.2 Scripts
- [ ] `scripts/mobile-css-audit.js` (CSS violation detector)

### 4.3 Tests
- [ ] Mobile form render tests for each form surface
- [ ] Update `route-smoke.test.ts` to include viewport assertions

---

## 5. Implementation Phases

### Phase A: V2 Primitive Foundation (Pre-requisite)

**Goal:** Ensure all V2 primitives are mobile-ready before per-route fixes.

| Task | Component | Priority |
|------|-----------|----------|
| A1 | Add responsive width handling to `GlassDrawer.tsx` | P0 |
| A2 | Update `BespokeTable.tsx` to include overflow-x-auto wrapper by default | P0 |
| A3 | Create `MobileSheet` wrapper component that uses Sheet full-screen on mobile | P1 |
| A4 | Audit `FilterBar.tsx` for mobile—stack date inputs, 1-col grid on xs | P0 |
| A5 | Verify all `components/ui/*` primitives have 44px min touch targets | P1 |

**Definition of Done Phase A:**
- All V2 primitives pass mobile CSS audit
- No changes to business logic
- Desktop behavior unchanged

### Phase B: Per-Route Mobile Fixes

**Goal:** Apply V2 primitives and responsive patterns to each route.

#### B1: Settings Routes (Priority: HIGH)
Settings are critical for onboarding and configuration.

| Route | Tasks | Files |
|-------|-------|-------|
| `/settings/sla` | Convert table to card stack on mobile; use V2 Input; responsive grid for "Add New" form | `SlaSettingsTab.tsx` |
| `/settings/ai` | Convert AiProviderSettings modal to Sheet; full-screen on mobile; responsive form layout | `AiProviderSettings.tsx`, `AiSettingsTab.tsx` |
| `/settings/org` | Responsive form layout; full-width inputs on mobile | `OrgSettingsTab.tsx` |
| `/settings/pipeline-targets` | Verify BenchmarkConfigModal mobile behavior | `BenchmarkConfigModal.tsx` |
| `/settings/data-health` | Add scroll containers to tables | `DataHealthTab.tsx` |

#### B2: Plan Routes (Priority: HIGH)
Complex forms and wizards that break on mobile.

| Route | Tasks | Files |
|-------|-------|-------|
| `/plan/capacity` | Migrate FitExplainDrawer to V2 Sheet | `FitExplainDrawer.tsx`, `OverloadExplainDrawer.tsx` |
| `/plan/rebalancer` | Migrate drawers; fix table overflow | `RecruiterWorkloadDrawer.tsx`, `MoveDetailDrawer.tsx` |
| `/plan/forecast` | Migrate ReqHealthDrawer; responsive slider controls | `ReqHealthDrawer.tsx`, forecasting forms |
| `/plan/scenarios` | Migrate CitationsDrawer; convert wizard forms to V2 | `SpinUpTeamForm.tsx`, `RecruiterLeavesForm.tsx`, `HiringFreezeForm.tsx`, `CitationsDrawer.tsx` |

#### B3: Diagnose Routes (Priority: MEDIUM)
Mostly working but drawers need migration.

| Route | Tasks | Files |
|-------|-------|-------|
| `/diagnose/overview` | Verify DataDrillDownModal mobile behavior | `DataDrillDownModal.tsx` |
| `/diagnose/hm-friction` | Migrate HMDetailDrawer to V2 Sheet | `HMDetailDrawer.tsx` |
| `/diagnose/hiring-managers` | Migrate HMDetailDrawer; fix HMActionQueue touch targets | `HMDetailDrawer.tsx`, `HMActionQueue.tsx` |
| `/diagnose/bottlenecks` | Verify V2 ReqDrilldownDrawerV2 mobile behavior | `ReqDrilldownDrawerV2.tsx` |
| `/diagnose/velocity` | Verify Copilot panel mobile behavior | `VelocityCopilotPanelV2.tsx` |

#### B4: Command Center & Ask (Priority: MEDIUM)
Core landing pages—mostly working.

| Route | Tasks | Files |
|-------|-------|-------|
| `/` | Fix Actions modal width; verify all panels | `CommandCenterV2.tsx` |
| `/ask` | Verify chat input responsive behavior | `AskPlatoVueV2.tsx` |

**Definition of Done Phase B:**
- Each route passes mobile visual QA
- All drawers/modals usable on 375px viewport
- All forms submittable on mobile
- No horizontal body scroll

### Phase C: Verification Tooling & Regression Gates

**Goal:** Prevent mobile regressions.

| Task | Description |
|------|-------------|
| C1 | Create `scripts/mobile-css-audit.js` |
| C2 | Add mobile form render tests |
| C3 | Update CI to run `npm run qa:mobile` |
| C4 | Complete `docs/MOBILE_AUDIT_CHECKLIST.md` manual verification |
| C5 | Add Playwright (optional future) for screenshot regression |

**Definition of Done Phase C:**
- `npm run qa:mobile` passes
- All checklist items verified
- CI gates in place

---

## 6. Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Breaking desktop while fixing mobile | Use responsive classes (`md:*`) not mobile-only overrides |
| Legacy components deeply embedded | Use V2 wrapper pattern—don't refactor business logic |
| Time constraints | Prioritize Settings and Plan (most broken) first |
| Missing test coverage | Manual QA checklist as fallback |

---

## 7. Appendix: File Paths Quick Reference

### V2 Components (25 files)
```
src/productivity-dashboard/components/v2/
├── AppLayoutV2.tsx
├── AppSidebar.tsx
├── AskPlatoVueTabV2.tsx
├── AskPlatoVueV2.tsx
├── BottleneckPanelV2.tsx
├── CommandCenterV2.tsx
├── DiagnoseTabV2.tsx
├── FilterBarV2.tsx
├── HeadingsV2.tsx
├── HMFrictionTabV2.tsx
├── HiringManagersTabV2.tsx
├── KPICardV2.tsx
├── OverviewTabV2.tsx
├── PipelineBenchmarksTab.tsx
├── PipelineFunnelV2.tsx
├── PlanTabV2.tsx
├── QualityTabV2.tsx
├── RecruiterDetailTabV2.tsx
├── RequisitionsTableV2.tsx
├── SettingsTabV2.tsx
├── SourceEffectivenessTabV2.tsx
├── SubViewHeader.tsx
├── TeamCapacityPanelV2.tsx
├── TopNavV2.tsx
└── bottlenecks/
    ├── BottleneckStagesPanelV2.tsx
    ├── BottlenecksTabV2.tsx
    ├── BreachTableV2.tsx
    ├── CoverageBannerV2.tsx
    ├── OwnerLeaderboardV2.tsx
    ├── ReqDrilldownDrawerV2.tsx
    └── index.ts
└── velocity-insights/
    ├── MiniChartsV2.tsx
    ├── VelocityCopilotPanelV2.tsx
    ├── VelocityInsightsTabV2.tsx
    └── index.ts
```

### Legacy Components Requiring Migration (Key Files)
```
src/productivity-dashboard/components/_legacy/
├── settings/
│   ├── AiProviderSettings.tsx      # HIGH priority
│   ├── AiSettingsTab.tsx
│   ├── SlaSettingsTab.tsx          # HIGH priority
│   └── OrgSettingsTab.tsx
├── capacity/
│   ├── FitExplainDrawer.tsx        # HIGH priority
│   └── OverloadExplainDrawer.tsx
├── capacity-rebalancer/
│   ├── RecruiterWorkloadDrawer.tsx # HIGH priority
│   └── MoveDetailDrawer.tsx
├── forecasting/
│   └── ReqHealthDrawer.tsx         # HIGH priority
├── scenarios/
│   ├── parameters/
│   │   ├── SpinUpTeamForm.tsx      # HIGH priority
│   │   ├── RecruiterLeavesForm.tsx
│   │   └── HiringFreezeForm.tsx
│   └── output/
│       └── CitationsDrawer.tsx
├── hm-friction/
│   └── HMDetailDrawer.tsx          # MEDIUM priority
├── hiring-managers/
│   ├── HMActionQueue.tsx
│   └── HMScorecard.tsx
└── data-health/
    └── DataHealthTab.tsx
```

### UI Primitives (Available for Use)
```
src/components/ui/
├── button.tsx
├── input.tsx
├── label.tsx
├── textarea.tsx
├── checkbox.tsx
├── switch.tsx
├── dropdown-menu.tsx
├── popover.tsx
├── tooltip.tsx
├── progress.tsx
├── separator.tsx
├── table.tsx
├── tabs.tsx
├── card.tsx
├── badge.tsx
├── calendar.tsx
├── sidebar.tsx
├── sheet.tsx          # Use for mobile drawers
├── skeleton.tsx
└── toggles.tsx
```

---

## 8. Next Steps

1. Review and approve this plan
2. Create `docs/MOBILE_AUDIT_CHECKLIST.md`
3. Begin Phase A: V2 Primitive Foundation
4. Execute Phase B: Per-Route Mobile Fixes (parallel tracks possible)
5. Execute Phase C: Verification Tooling

---

*End of V2_MOBILE_COMPLETION_V1.md*
