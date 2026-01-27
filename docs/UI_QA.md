# UI Quality Assurance Checklist

This document tracks UI quality verification for the V0 UI migration.

## Screenshots Checklist

### Desktop (1440px width)

| Screen | Status | Notes |
|--------|--------|-------|
| Command Center | ✅ | Health KPIs, Risks, Actions, Forecast sections |
| Ask PlatoVue | ✅ | Chat interface with suggested questions |
| Diagnose > Overview | ✅ | KPI cards, weekly trends |
| Diagnose > Recruiter | ✅ | Recruiter detail view |
| Diagnose > HM Friction | ✅ | HM latency analysis |
| Diagnose > Hiring Managers | ✅ | HM scorecard |
| Diagnose > Bottlenecks | ✅ | SLA enforcement |
| Diagnose > Quality | ✅ | Quality metrics |
| Diagnose > Source Mix | ✅ | Source effectiveness |
| Diagnose > Velocity | ✅ | Velocity insights |
| Plan > Capacity | ✅ | Team capacity |
| Plan > Forecasting | ✅ | Role forecasting |
| Plan > Scenarios | ✅ | What-if scenarios |
| Plan > Goals | ✅ | Placeholder |
| Settings > Data Health | ✅ | Data hygiene |
| Settings > SLA Settings | ✅ | SLA configuration |
| Settings > AI Settings | ✅ | AI provider config |
| Settings > Org Settings | ✅ | Organization settings |

### Mobile (375px width)

| Screen | Status | Notes |
|--------|--------|-------|
| Command Center | ✅ | Responsive grid, stacked layout |
| Top Navigation | ✅ | Hamburger menu, overlay |
| Sub-navigation pills | ✅ | Horizontal scroll |
| KPI Cards | ✅ | 2-column grid on mobile |

---

## Focus Ring & Keyboard Navigation

| Element | Focus Visible | Tab Order | Notes |
|---------|---------------|-----------|-------|
| Top Nav tabs | ✅ | ✅ | Clear focus ring |
| Sub-nav pills | ✅ | ✅ | Proper tab order |
| KPI Cards (clickable) | ✅ | ✅ | focus:ring-2 |
| Buttons | ✅ | ✅ | Default focus styles |
| Form inputs | ✅ | ✅ | Border highlight on focus |
| Dropdown menus | ✅ | ✅ | Arrow key navigation |
| Modal dialogs | ✅ | ✅ | Focus trap implemented |

---

## Drawer/Modal Z-Index

| Component | Z-Index | Notes |
|-----------|---------|-------|
| Base content | 0 | Default |
| Sticky headers | z-40 | TopNavV2, sub-nav |
| Dropdowns | z-50 | Popover, select menus |
| Drawers | z-100 | Side panels |
| Modals | z-200 | Dialog overlays |
| Toasts | z-300 | Notification toasts |
| Tooltips | z-400 | Tooltip overlays |

---

## Accessibility Basics

| Check | Status | Notes |
|-------|--------|-------|
| Color contrast (WCAG AA) | ✅ | V0 tokens verified |
| focus-visible rings | ✅ | Implemented on interactive elements |
| aria-labels on icon buttons | ✅ | Search, menu, close buttons |
| Semantic headings | ✅ | h1 > h2 > h3 hierarchy |
| Alt text on images | ✅ | No decorative images without alt="" |
| Skip links | ⚠️ | Future improvement |
| Screen reader tested | ⚠️ | Future improvement |

---

## Console Error Check

Run `npm run route:smoke` to verify no console errors during navigation.

| Route | Console Errors | Status |
|-------|----------------|--------|
| / (Command Center) | None | ✅ |
| /ask | None | ✅ |
| /diagnose/* | None | ✅ |
| /plan/* | None | ✅ |
| /settings/* | None | ✅ |

---

## V0 Design Consistency

| Pattern | Consistent | Notes |
|---------|------------|-------|
| Glass panel styling | ✅ | `bg-bg-glass backdrop-blur-glass border-glass-border` |
| Section headers | ✅ | Icon + title + badge + action pattern |
| Typography scale | ✅ | `text-xs` to `text-3xl` |
| Spacing | ✅ | 4px base unit, consistent gaps |
| Border radius | ✅ | `rounded-md` to `rounded-lg` |
| Hover states | ✅ | Subtle background changes |
| Active states | ✅ | Cyan accent highlighting |

---

## Known Issues / Future Improvements

1. **Skip links** - Add skip-to-content link for screen readers
2. **Screen reader testing** - Full VoiceOver/NVDA audit pending
3. **Motion preferences** - Respect `prefers-reduced-motion`
4. **High contrast mode** - Windows high contrast testing pending

---

## Verification Commands

```bash
# Run all UI checks
npm run ui:smoke

# Check for Bootstrap patterns
npm run ui:no-bootstrap

# Run style audit
npm run ui:style-audit

# Run route smoke test
npm run route:smoke
```
