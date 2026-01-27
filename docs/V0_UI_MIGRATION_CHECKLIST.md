# V0 UI Migration Checklist

This document tracks the comprehensive V0 UI overhaul for PlatoVue.

## Phase 0: Baseline (COMPLETED)
- [x] Confirm repo state (main branch)
- [x] Run tests: 1372 passed, 64 test suites
- [x] Run build: Successful
- [x] Create this checklist document
- [x] Add `ui:smoke` npm script

## Phase 1: Inventory (COMPLETED)
- [x] Create exhaustive `docs/V0_UI_INVENTORY.md`
- [x] Catalog all surfaces, components, modals, panels
- [x] Note current styling approach per component
- [x] Identify components already using V2 patterns

## Phase 2: Design Contract (COMPLETED)
- [x] Create `design-system/README.md` with V0 tokens
- [x] Verify Tailwind config matches V0 design system
- [x] Document AppShellV2 pattern
- [x] Define glass panel specifications

## Phase 3: V0-Driven Rebuild

### Surface A: Global Shell
- [x] TopNavV2 - verified against V0 (sticky, blur, cyan accent)
- [x] Mobile navigation (hamburger menu, overlay)
- [x] Cmd+K search affordance

### Surface B: Command Center
- [x] Health KPI cards (V0 5-card grid with border-left indicators)
- [x] Risk panel (integrated with BottleneckPanelV2)
- [x] Action queue (inline implementation)
- [x] Forecast panel (3-card layout)
- [x] Dataset status bar

### Surface C: Ask PlatoVue
- [x] Chat interface (wired via AskPlatoVueV2 wrapper)
- [x] Suggested questions rail (existing v1 component)
- [x] Citation display (existing v1 component)
- [x] Action creation UI (existing v1 component)

### Surface D: Diagnose Tab
- [x] Sub-navigation pills (V0 pattern with icons)
- [x] Overview sub-view (wired to v1 OverviewTab)
- [x] Recruiter sub-view (wired to v1 RecruiterDetailTab)
- [x] HM Friction sub-view (wired to v1 HMFrictionTab)
- [x] Hiring Managers sub-view (wired to v1 HiringManagersTab)
- [x] Bottlenecks sub-view (wired to v1 BottlenecksTab)
- [x] Quality sub-view (wired to v1 QualityTab)
- [x] Source Mix sub-view (wired to v1 SourceEffectivenessTab)
- [x] Velocity sub-view (wired to v1 VelocityInsightsTab)

### Surface E: Plan Tab
- [x] Sub-navigation pills (V0 pattern)
- [x] Capacity sub-view (wired to v1 CapacityTab)
- [x] Forecasting sub-view (wired to v1 ForecastingTab)
- [x] Scenarios sub-view (wired to v1 ScenarioLibraryTab)
- [x] Goals sub-view (placeholder)

### Surface F: Settings Tab
- [x] Sub-navigation pills (V0 pattern)
- [x] Data Health sub-view (wired to v1 DataHealthTab)
- [x] SLA Settings sub-view (wired to v1 SlaSettingsTab)
- [x] AI Settings sub-view (wired to v1 AiSettingsTab)
- [x] Org Settings sub-view (wired to v1 OrgSettingsTab)

## Phase 4: Consistency Audit (COMPLETED)
- [x] Add `ui:audit` npm script (existing - `npm run ui:style-audit`)
- [x] Create smoke test (existing - `npm run route:smoke`)
- [x] Create `docs/UI_QA.md` with screenshots checklist
- [x] Verify no Bootstrap classes remain (`npm run ui:no-bootstrap` passes)
- [x] Verify consistent glass panel usage (V0 patterns applied)

## Phase 5: Final Polish (COMPLETED)
- [x] Tooltips on all KPIs (implemented via TooltipProvider)
- [x] Consistent spacing (4px grid via Tailwind)
- [x] Accessibility basics (contrast, focus-visible, aria labels)
- [x] Mobile responsiveness check (responsive grid patterns)
- [x] Dark mode contrast verification (V0 color tokens)

---

## V0 Design Tokens (Reference)

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
