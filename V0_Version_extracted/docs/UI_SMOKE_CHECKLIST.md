# UI_SMOKE_CHECKLIST.md - Visual Verification Checklist

**Version:** 1.0
**Created:** 2026-01-23
**Purpose:** Manual verification that all pages render correctly after UI_REFRESH_V0_LANGUAGE_SYSTEM_V1.

---

## Automated Gates (Must Pass First)

- [x] `npm test -- --watchAll=false` - 63 suites, 1365 tests pass
- [x] `npm run build` - Compiles successfully
- [x] `npm run ui:audit` - Zero violations

---

## Tab/Page Rendering

### Control Tower Bucket
- [x] Command Center (`/`) - Renders with all sections (Attention, Risks, Bottlenecks, OnTrack, Changes)
- [x] Ops View (`/ops`) - Control Tower tab renders
- [x] Ask PlatoVue (`/ask`) - Left rail + main panel render

### Diagnose Bucket
- [x] Overview (`/diagnose/overview`) - KPI cards and charts render
- [x] Recruiter Detail (`/diagnose/recruiter`) - Recruiter selector + metrics
- [x] HM Friction (`/diagnose/hm-friction`) - HM latency table renders
- [x] Hiring Managers (`/diagnose/hiring-managers`) - Scorecard + action queue
- [x] Bottlenecks (`/diagnose/bottlenecks`) - Stage panels + breach table
- [x] Quality (`/diagnose/quality`) - Quality metrics render
- [x] Sources (`/diagnose/sources`) - Source effectiveness table
- [x] Velocity (`/diagnose/velocity`) - Mini charts + insights

### Plan Bucket
- [x] Capacity (`/plan/capacity`) - Fit matrix + load table
- [x] Rebalancer (`/plan/rebalancer`) - Utilization table + suggestions
- [x] Forecast (`/plan/forecast`) - Oracle + distribution chart
- [x] Scenarios (`/plan/scenarios`) - Scenario selector + output panel

### Settings Bucket
- [x] Data Health (`/settings/data-health`) - Hygiene metrics
- [x] SLA Settings (`/settings/sla`) - SLA configuration form
- [x] AI Settings (`/settings/ai`) - Provider settings
- [x] Org Settings (`/settings/org`) - Members + invites

### Public Pages
- [x] Landing Page (`/` unauthenticated) - Hero + features + CTA
- [x] Login (`/login`) - Auth form renders
- [x] About (`/about`) - About page renders

---

## Drawers Open/Close Correctly
- [x] AttentionDrilldownDrawer - Opens from Command Center risk items
- [x] ExplainDrawer - Opens from KPI explain CTAs
- [x] ActionDetailDrawer - Opens from action queue items
- [x] HelpDrawer - Opens from help buttons
- [x] PreMortemDrawer - Opens from forecast pre-mortem
- [x] HMDetailDrawer - Opens from HM friction rows
- [x] ReqDrilldownDrawer - Opens from bottleneck breach rows
- [x] FitExplainDrawer - Opens from capacity fit cells
- [x] OverloadExplainDrawer - Opens from overloaded recruiter rows
- [x] RecruiterWorkloadDrawer - Opens from rebalancer recruiter rows
- [x] MoveDetailDrawer - Opens from suggested move cards
- [x] ReqHealthDrawer - Opens from forecast req items
- [x] CitationsDrawer - Opens from scenario citations
- [x] MobileDrawer - Opens from mobile nav hamburger

---

## CTAs Visible and Styled
- [x] CSV Upload button - Primary accent styling
- [x] Import CTA - Visible on empty states
- [x] Explain CTAs - Consistent accent styling
- [x] Action queue "Mark Done" / "Dismiss" - Proper button variants
- [x] Scenario "Generate Action Plan" - Primary button
- [x] Help buttons - Ghost/icon style consistent
- [x] Filter bar controls - Proper active states

---

## Dark Mode Contrast
- [x] Text-primary (#f8fafc) readable on surface backgrounds
- [x] Text-secondary (#94a3b8) readable on surface backgrounds
- [x] Text-muted (#64748b) visible but clearly muted
- [x] Accent (#06b6d4) contrasts well on dark surfaces
- [x] Semantic colors (green/amber/red) readable on dark backgrounds
- [x] Glass panel borders visible but subtle
- [x] Badge text readable on badge backgrounds

---

## Focus States
- [x] Buttons show focus ring (glass-glow-focus)
- [x] Interactive glass panels show focus ring
- [x] Collapsible section headers show focus state
- [x] Filter inputs show focus state
- [x] Nav items show focus indicator

---

## Mobile Layout
- [x] Navigation collapses to hamburger
- [x] PageShell reduces padding on mobile
- [x] Tables scroll horizontally
- [x] Drawers fill 100% width
- [x] KPI cards stack vertically
- [x] Filter bar wraps appropriately

---

## Design System Consistency
- [x] All page titles use PageHeader component
- [x] All section titles use SectionHeader component
- [x] All content panels use GlassPanel styling
- [x] All KPI values use StatValue/monospace font
- [x] All KPI labels use StatLabel/uppercase style
- [x] All empty states use EmptyState component
- [x] All loading states use Skeleton components
- [x] All badges use consistent size and color tokens
- [x] Spacing between sections is consistent (var(--space-6))
- [x] Typography hierarchy is consistent across pages

---

## Verification Complete

All items checked. The UI refresh is consistent across all pages and states.
