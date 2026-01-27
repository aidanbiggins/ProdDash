# UI_CONTRACT.md - Design System Contract

**Version:** 1.0
**Created:** 2026-01-23
**Purpose:** Binding rules for all PlatoVue UI implementation. No component may violate these rules.

---

## Required Primitives

Every page MUST use these primitives. No ad-hoc alternatives allowed.

| Primitive | Location | Purpose |
|-----------|----------|---------|
| `PageShell` | `layout/PageShell.tsx` | Page wrapper (padding, max-width) |
| `SectionCard` | `common/GlassPanel.tsx` | Glass container for content sections |
| `SectionHeader` | `layout/SectionHeader.tsx` | Section title + badge + actions |
| `PageHeader` | `layout/PageHeader.tsx` | Page-level title + breadcrumbs |
| `Button` | Bootstrap `btn` + theme classes | Interactive actions |
| `Badge` | Theme-styled badges | Status indicators |
| `BespokeTable` | `common/BespokeTable.tsx` | Data tables |
| `GlassDrawer` | `common/GlassDrawer.tsx` | Slide-in panels |
| `Modal` | Bootstrap modal + theme | Overlay dialogs |
| `EmptyState` | `layout/EmptyState.tsx` | Empty/blocked/error states |
| `KPICard` | `common/KPICard.tsx` | Metric display cards |
| `StatLabel` | `common/StatLabel.tsx` | KPI labels |
| `StatValue` | `common/StatValue.tsx` | KPI values |
| `FilterBar` | `common/FilterBar.tsx` | Filter controls |
| `ConfidenceBadge` | velocity-insights | Confidence indicators |
| `Skeleton` | `common/Skeletons.tsx` | Loading states |

---

## Typography Rules

### Allowed Sizes (NO ad-hoc font sizes)
| Usage | Token | Size |
|-------|-------|------|
| Page title | `--text-2xl` | 24px |
| Section title | `--text-lg` | 18px |
| Body / UI | `--text-sm` | 14px |
| Labels (uppercase) | `--text-xs` | 12px |
| KPI values | `--text-4xl` | 36px |
| Hero numbers | `--text-3xl` | 30px |
| Emphasized body | `--text-base` | 16px |

### Font Family Rules
| Content Type | Font | Token |
|--------------|------|-------|
| Headings | Inter | `--font-heading` |
| Body text | Inter | `--font-body` |
| Data values, metrics, numbers | JetBrains Mono | `--font-mono` |
| Code snippets | JetBrains Mono | `--font-mono` |

### Weight Rules
| Usage | Weight |
|-------|--------|
| Body text | `400` (normal) |
| Emphasized text | `500` (medium) |
| Headings, labels | `600` (semibold) |
| Page titles, KPI values | `700` (bold) |

---

## Spacing Rules

### Section Spacing
- Between sections: `var(--space-6)` (24px)
- Page padding: `var(--space-6)` (24px), mobile: `var(--space-4)` (16px)
- Card padding default: `var(--space-4)` (16px)

### Internal Spacing
- Header to content: `var(--space-4)` (16px)
- Label to value: `var(--space-2)` (8px)
- Grid gaps: `var(--space-4)` (16px)
- Button gaps: `var(--space-2)` (8px)
- Icon to text: `var(--space-2)` (8px)

### FORBIDDEN
- No `margin-top` hacks - use consistent `margin-bottom` on sections
- No pixel values outside the spacing scale
- No `em` units for spacing (use `rem` via tokens or `px` via tokens)

---

## Color Rules

### Allowed Colors
Only these color tokens may be used. No hex/rgb literals in component code.

**Backgrounds:** `--color-bg-base`, `--color-bg-surface`, `--color-bg-elevated`, `--color-bg-overlay`, `--glass-bg`, `--glass-bg-elevated`, `--glass-bg-hover`

**Text:** `--text-primary`, `--text-secondary`, `--text-muted`, `--text-heading`

**Accent:** `--accent`, `--accent-hover`, `--accent-muted`, `--accent-bg`

**Semantic:** `--color-good`, `--color-good-bg`, `--color-warn`, `--color-warn-bg`, `--color-bad`, `--color-bad-bg`, `--color-neutral`, `--color-neutral-bg`

**Borders:** `--glass-border`, `--glass-border-strong`, `--glass-border-accent`

**Charts:** `--chart-1` through `--chart-6`, `--chart-muted`

### Confidence Colors
| Level | Text Color | Background |
|-------|-----------|-----------|
| HIGH | `--color-good` | `--color-good-bg` |
| MED | `--color-warn` | `--color-warn-bg` |
| LOW | `--color-neutral` | `--color-neutral-bg` |
| INSUFFICIENT | `--color-bad` | `--color-bad-bg` |

---

## State Rules

### ENABLED (Full Data)
- Show all metrics, charts, and actions
- No banners or warnings needed

### LIMITED (Partial Data)
- Show available data normally
- Show `FeatureLimitedState` explaining what's missing
- Do NOT hide the entire section
- Include confidence badges where applicable

### BLOCKED (Missing Requirements)
- Show `FeatureBlockedState` with clear explanation
- Include repair suggestions (link to settings, upload data, etc.)
- Never show an empty page without explanation

### LOADING
- Show `Skeleton` components matching expected layout shape
- Never show empty space while loading
- Use `TabSkeleton` for full-page loading
- Use `KPISkeleton`, `ChartSkeleton`, `TableSkeleton` for section-level loading

### ERROR
- Show `EmptyState` with `type="error"`
- Include actionable error message
- Include retry button where applicable

---

## Component Usage Rules

### Headers
- Page-level: MUST use `PageHeader` from layout/
- Section-level: MUST use `SectionHeader` from layout/
- NO raw `<h1>`, `<h2>`, `<h3>` tags outside these components
- NO inline font-size on headings

### Cards/Panels
- All content sections: MUST use `GlassPanel` or equivalent glass-styled container
- NO bare `<div>` with ad-hoc background/border styling
- Padding via `padding` prop (sm/md/lg), not inline styles

### Tables
- All data tables: MUST use `BespokeTable` or the themed Bootstrap table classes
- NO custom table styling outside the theme
- Empty tables: MUST show `EmptyState` inside table body

### Drawers
- All slide-in panels: MUST use `GlassDrawer` as base
- Width: 420px desktop, 100% mobile
- MUST have: header (title + close), scrollable body
- Backdrop: semi-transparent with blur

### Modals
- Use Bootstrap modal with theme CSS overrides
- MUST have: header (title + close), body, optional footer
- Glass background with blur

### Buttons
- Use Bootstrap `btn` classes with theme overrides
- Primary: `btn-primary` (teal)
- Secondary: `btn-outline-secondary` (glass border)
- Ghost: `btn-link` (transparent)
- Danger: `btn-danger`
- MUST use decision verbs: "Save", "Delete", "Import", "Cancel" (not "OK", "Submit")

### Badges
- Success: green background + text
- Warning: amber background + text
- Danger: red background + text
- Neutral: slate background + text
- Info: blue/teal background + text
- Size: `--text-xs`, uppercase, `--tracking-wide`

### Empty States
- MUST use `EmptyState` component
- MUST include: icon, title, description
- SHOULD include: action button when user can resolve

### Loading States
- MUST use Skeleton components
- Match expected content layout shape
- Never show blank space during load

---

## Forbidden Patterns

1. **No inline styles** with typography props (`fontSize`, `fontWeight`, `letterSpacing`, `lineHeight`) except in chart components where unavoidable
2. **No raw heading tags** (`<h1>` through `<h6>`) outside PageHeader/SectionHeader
3. **No hex/rgb color literals** in component JSX or component CSS (use tokens)
4. **No pixel spacing values** outside the spacing scale
5. **No ad-hoc font families** - only the three declared families
6. **No custom shadows** - use elevation tokens
7. **No border-radius literals** - theme handles globally
8. **No z-index values** outside the declared layers (100/200/300/400)
9. **No `!important`** in component CSS (only in theme overrides)
10. **No duplicate primitives** - use the canonical version from `layout/`

---

## Audit Compliance

The `npm run ui:audit` script will check for:
1. Inline style typography violations
2. Raw heading usage outside primitives
3. Ad-hoc color definitions outside theme
4. Missing EmptyState in empty views
5. Missing Skeleton in loading views

Violations MUST be fixed before merge. Zero tolerance.
