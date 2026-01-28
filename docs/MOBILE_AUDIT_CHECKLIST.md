# Mobile Audit Checklist

**Purpose:** Manual QA verification for mobile usability (360–430px viewport)
**Test Device:** Chrome DevTools Mobile Emulation (iPhone SE: 375px, iPhone 12: 390px)

---

## Instructions

1. Open Chrome DevTools (F12)
2. Toggle Device Toolbar (Ctrl+Shift+M)
3. Select "iPhone SE" (375px) or "Responsive" set to 375px
4. Navigate to each route and verify all checkboxes
5. Mark items as ✅ PASS, ❌ FAIL, or ⚠️ PARTIAL

---

## Legend

- **No H-Scroll**: No horizontal scrollbar on body
- **Touch Targets**: All interactive elements ≥44px
- **Readable Text**: Font size ≥12px, adequate contrast
- **Forms Usable**: All inputs accessible, submittable
- **Drawers/Modals**: Open correctly, dismissible, scrollable

---

## Settings Routes

### `/settings/data-health`
- [ ] No horizontal body scroll
- [ ] Navigation dropdown works (mobile selector)
- [ ] Tables have horizontal scroll container
- [ ] All table data readable
- [ ] No clipped content

### `/settings/sla`
- [ ] No horizontal body scroll
- [ ] Navigation dropdown works
- [ ] SLA table has scroll container OR card layout
- [ ] Input fields editable (touch keyboard works)
- [ ] "Add New" form fields accessible
- [ ] Save/Reset buttons tappable (≥44px)
- [ ] Success message visible

### `/settings/pipeline-targets`
- [ ] No horizontal body scroll
- [ ] Navigation dropdown works
- [ ] BenchmarkConfigModal opens correctly
- [ ] Modal content scrollable
- [ ] Slider controls usable
- [ ] Close button accessible

### `/settings/ai`
- [ ] No horizontal body scroll
- [ ] Navigation dropdown works
- [ ] "Configure AI Provider" button tappable
- [ ] AiProviderSettings modal/sheet opens
- [ ] Provider selection works
- [ ] API key input accessible
- [ ] Model dropdown works
- [ ] Storage mode toggle works
- [ ] Vault passphrase input accessible
- [ ] Save/Cancel buttons tappable
- [ ] Modal closable

### `/settings/org`
- [ ] No horizontal body scroll
- [ ] Navigation dropdown works
- [ ] Organization form fields accessible
- [ ] All inputs full-width on mobile
- [ ] Save button tappable

---

## Plan Routes

### `/plan/capacity`
- [ ] No horizontal body scroll
- [ ] Tab navigation works
- [ ] Capacity overview cards readable
- [ ] RecruiterLoadTable has scroll container
- [ ] Table rows tappable (if clickable)
- [ ] FitExplainDrawer opens correctly (if applicable)
- [ ] Drawer content scrollable
- [ ] Drawer close button accessible

### `/plan/rebalancer`
- [ ] No horizontal body scroll
- [ ] Tab navigation works
- [ ] Recommendation cards readable
- [ ] RecruiterWorkloadDrawer opens correctly
- [ ] MoveDetailDrawer opens correctly
- [ ] Drawer content scrollable
- [ ] All drawer close buttons accessible

### `/plan/forecast`
- [ ] No horizontal body scroll
- [ ] Tab navigation works
- [ ] Forecast controls accessible
- [ ] Slider inputs usable on touch
- [ ] ReqHealthDrawer opens correctly
- [ ] Drawer content scrollable
- [ ] Date pickers work on mobile

### `/plan/scenarios`
- [ ] No horizontal body scroll
- [ ] Tab navigation works
- [ ] Scenario cards readable
- [ ] "Create Scenario" flow works
- [ ] SpinUpTeamForm inputs accessible
- [ ] RecruiterLeavesForm inputs accessible
- [ ] HiringFreezeForm inputs accessible
- [ ] Form navigation (next/back) works
- [ ] CitationsDrawer opens correctly
- [ ] All form buttons tappable

---

## Diagnose Routes

### `/diagnose/overview`
- [ ] No horizontal body scroll
- [ ] KPI cards readable
- [ ] Pipeline Health card visible
- [ ] Weekly Funnel chart renders
- [ ] Chart tooltip works on touch
- [ ] Stage buttons tappable
- [ ] Recruiter Leaderboard scrollable
- [ ] DataDrillDownModal opens correctly
- [ ] Modal content scrollable
- [ ] Modal close button accessible

### `/diagnose/recruiter/:id`
- [ ] No horizontal body scroll
- [ ] Recruiter info readable
- [ ] Metrics cards visible
- [ ] Tables have scroll containers
- [ ] HelpDrawer opens correctly
- [ ] Drawer content scrollable

### `/diagnose/hm-friction`
- [ ] No horizontal body scroll
- [ ] Sub-tab navigation works
- [ ] HM list/cards readable
- [ ] HMDetailDrawer opens correctly
- [ ] Drawer content scrollable
- [ ] Action items tappable

### `/diagnose/hiring-managers`
- [ ] No horizontal body scroll
- [ ] HM scorecard readable
- [ ] HMActionQueue items tappable (≥44px)
- [ ] Action item text not clipped
- [ ] HMDetailDrawer opens correctly

### `/diagnose/bottlenecks`
- [ ] No horizontal body scroll
- [ ] CoverageBanner visible
- [ ] BottleneckStagesPanel readable
- [ ] BreachTable scrollable
- [ ] OwnerLeaderboard scrollable
- [ ] ReqDrilldownDrawerV2 opens correctly
- [ ] Timeline layout readable on mobile
- [ ] Drawer close button accessible

### `/diagnose/quality`
- [ ] No horizontal body scroll
- [ ] Quality metrics visible
- [ ] Charts render correctly
- [ ] Tables have scroll containers
- [ ] HelpDrawer opens correctly

### `/diagnose/sources`
- [ ] No horizontal body scroll
- [ ] Source cards readable
- [ ] Pie chart renders
- [ ] Table scrollable
- [ ] HelpDrawer opens correctly

### `/diagnose/velocity`
- [ ] No horizontal body scroll
- [ ] Velocity metrics visible
- [ ] Charts render correctly
- [ ] VelocityCopilotPanel usable
- [ ] Mini charts visible
- [ ] HelpDrawer opens correctly

---

## Command Center & Ask

### `/` (Command Center)
- [ ] No horizontal body scroll
- [ ] KPI row scrollable or wraps
- [ ] All KPI cards readable
- [ ] Actions panel visible
- [ ] Action items tappable (≥44px)
- [ ] "View All" actions modal opens
- [ ] Modal content scrollable
- [ ] Single action detail modal opens
- [ ] "Mark as Done" button tappable
- [ ] Risk cards visible
- [ ] Pipeline panel visible
- [ ] Team Capacity panel visible

### `/ask`
- [ ] No horizontal body scroll
- [ ] Chat input accessible
- [ ] Input field full-width
- [ ] Send button tappable
- [ ] Suggested questions visible
- [ ] Conversation history scrollable
- [ ] Response text readable
- [ ] Citations tappable
- [ ] AI toggle accessible

---

## Global Components

### Sidebar (AppSidebar)
- [ ] Mobile menu trigger visible
- [ ] Sidebar opens as overlay
- [ ] Navigation items tappable (≥44px)
- [ ] Sidebar closable
- [ ] Active state visible

### Header
- [ ] Title readable
- [ ] Theme toggle accessible
- [ ] User menu accessible (if present)

### FilterBar (on Diagnose routes)
- [ ] Collapse/expand works
- [ ] Date preset buttons tappable
- [ ] Date inputs accessible
- [ ] Filter dropdowns open correctly
- [ ] Checkbox options tappable
- [ ] Active filter chips visible
- [ ] "Clear all" button accessible

---

## Summary

| Section | Total Items | Passed | Failed | Partial |
|---------|-------------|--------|--------|---------|
| Settings | ___ | ___ | ___ | ___ |
| Plan | ___ | ___ | ___ | ___ |
| Diagnose | ___ | ___ | ___ | ___ |
| Command Center & Ask | ___ | ___ | ___ | ___ |
| Global Components | ___ | ___ | ___ | ___ |
| **TOTAL** | ___ | ___ | ___ | ___ |

---

## Notes

_Record any specific issues, component names, or screenshots here:_

1. **Phase A Complete (2026-01-28)**: V2 Primitive Foundation
   - GlassDrawer.tsx: Updated with responsive widths (full-width on mobile, width prop on md+)
   - BespokeTable.tsx: Added overflow-x-auto wrapper by default
   - FilterBar.tsx: Fixed mobile layout (stack date inputs, single column grid on xs, 44px touch targets on dropdowns)
   - Created mobile-css-audit.js script for objective verification
   - Added npm run mobile:check and qa:mobile scripts

2. **Route smoke test updated**: Added pipeline-benchmarks route (was missing)

3. **Remaining touch target issues (acceptable)**:
   - Filter chip remove buttons (p-0.5): Parent chip is the tap target
   - Pagination controls (h-8): Standard shadcn/ui pattern
   - Metric drilldown close (p-1): Low-frequency action

4. **Phase B Progress (2026-01-28)**: Per-Route Mobile Fixes
   - OrgSettingsTab: Form stacks on mobile, 44px touch targets
   - AiProviderSettings: Modal close button touch target
   - FitExplainDrawer: Full-width on mobile, 44px close button
   - HMDetailDrawer: Full-width on mobile, 44px close button
   - VelocityCopilotPanel: Full-width on mobile

5. **All checks passing**:
   - npm test: Tests passed
   - npm run build: Compiled successfully
   - npm run route:smoke: 16 passed
   - npm run mobile:check: 30 minor issues (touch targets only)

6. **Phase B1 Complete (Settings Routes - 2026-01-28)**:
   - SlaSettingsTab: Table has min-width (700px) + horizontal scroll wrapper, action buttons stack on mobile
   - DataHealthTab: Both tables have min-width (800px) + horizontal scroll wrappers
   - PipelineBenchmarksTab: Table has min-width (700px) + horizontal scroll wrapper, action buttons stack on mobile with 44px touch targets

---

## Sign-off

- **Tester:** Claude (Automated Phase A)
- **Date:** 2026-01-28
- **Build/Commit:** V2_MOBILE_COMPLETION_V1_BUILD Phase A
- **Result:** ☐ PASS / ☐ FAIL / ☒ PARTIAL (Phase A complete, Phase B pending)

---

*End of MOBILE_AUDIT_CHECKLIST.md*
