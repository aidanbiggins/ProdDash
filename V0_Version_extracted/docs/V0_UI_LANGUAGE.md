# V0_UI_LANGUAGE.md - Design Language Source of Truth

**Version:** 1.0
**Generated:** 2026-01-23
**Source:** v0_generate_ui (v0-1.5-lg model)
**Purpose:** Canonical design language for PlatoVue UI refresh. All components must conform to these specifications.

---

## Design Philosophy

Inspired by **Linear**, **Vercel**, and **Stripe** dashboards:
- Clean, minimal, premium dark mode
- Glass morphism with subtle depth
- Restrained use of color (accent for action, semantic for status)
- Data-first typography (monospace numbers, readable labels)
- No decoration for decoration's sake

---

## 1. Color Tokens

### Backgrounds
| Token | Value | Usage |
|-------|-------|-------|
| `--color-bg-base` | `#0f172a` | Page background (slate-900) |
| `--color-bg-gradient` | `linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)` | Body gradient |
| `--color-bg-surface` | `rgba(30, 41, 59, 0.7)` | Card/panel backgrounds |
| `--color-bg-elevated` | `rgba(30, 41, 59, 0.9)` | Elevated panels, modals |
| `--color-bg-overlay` | `rgba(255, 255, 255, 0.05)` | Hover overlays |
| `--color-bg-glass` | `rgba(30, 41, 59, 0.7)` | Glass panel base |

### Borders
| Token | Value | Usage |
|-------|-------|-------|
| `--glass-border` | `rgba(255, 255, 255, 0.08)` | Default panel border |
| `--glass-border-strong` | `rgba(255, 255, 255, 0.12)` | Emphasized border |
| `--glass-border-accent` | `rgba(6, 182, 212, 0.4)` | Accent-highlighted border |

### Accent Colors
| Token | Value | Usage |
|-------|-------|-------|
| `--accent` | `#06b6d4` | Primary accent (Cyan-500) |
| `--accent-hover` | `#22d3ee` | Hover state (Cyan-400) |
| `--accent-muted` | `#0891b2` | Muted variant (Cyan-600) |
| `--accent-bg` | `rgba(6, 182, 212, 0.12)` | Background tint |
| `--color-purple` | `#8b5cf6` | Secondary accent (Violet) |
| `--color-purple-light` | `rgba(139, 92, 246, 0.15)` | Violet background |

### Semantic Colors
| Token | Value | Usage |
|-------|-------|-------|
| `--color-good` | `#22c55e` | Success / on-track |
| `--color-good-bg` | `rgba(34, 197, 94, 0.12)` | Success background |
| `--color-warn` | `#f59e0b` | Warning / at-risk |
| `--color-warn-bg` | `rgba(245, 158, 11, 0.12)` | Warning background |
| `--color-bad` | `#ef4444` | Danger / critical |
| `--color-bad-bg` | `rgba(239, 68, 68, 0.12)` | Danger background |
| `--color-neutral` | `#64748b` | Neutral / muted |

### Text Colors
| Token | Value | Usage |
|-------|-------|-------|
| `--text-primary` | `#f8fafc` | Primary content (Slate-50) |
| `--text-secondary` | `#94a3b8` | Labels, descriptions (Slate-400) |
| `--text-muted` | `#64748b` | Truly muted text (Slate-500) |
| `--text-heading` | `#ffffff` | Headings (pure white) |

### Chart Palette (6 max)
| Token | Value | Role |
|-------|-------|------|
| `--chart-1` | `#06b6d4` | Primary (Teal) |
| `--chart-2` | `#8b5cf6` | Secondary (Violet) |
| `--chart-3` | `#f59e0b` | Tertiary (Amber) |
| `--chart-4` | `#3b82f6` | Quaternary (Blue) |
| `--chart-5` | `#22c55e` | Quinary (Green) |
| `--chart-6` | `#ec4899` | Senary (Pink) |
| `--chart-muted` | `#475569` | "Other" category |

---

## 2. Typography

### Font Families
| Token | Value | Usage |
|-------|-------|-------|
| `--font-heading` | `'Inter', system-ui, sans-serif` | All headings and UI |
| `--font-body` | `'Inter', system-ui, sans-serif` | Body text |
| `--font-mono` | `'JetBrains Mono', monospace` | Data values, metrics, numbers |

### Type Scale
| Token | Size | Usage |
|-------|------|-------|
| `--text-xs` | `0.75rem` (12px) | Footnotes, badges |
| `--text-sm` | `0.875rem` (14px) | Body, UI elements |
| `--text-base` | `1rem` (16px) | Primary body |
| `--text-lg` | `1.125rem` (18px) | Section headers |
| `--text-xl` | `1.25rem` (20px) | Page sub-headers |
| `--text-2xl` | `1.5rem` (24px) | Page headers |
| `--text-3xl` | `1.875rem` (30px) | Hero numbers |
| `--text-4xl` | `2.25rem` (36px) | KPI values |

### Font Weights
| Token | Value | Usage |
|-------|-------|-------|
| `--font-normal` | `400` | Body text |
| `--font-medium` | `500` | Emphasized body |
| `--font-semibold` | `600` | Headings, labels |
| `--font-bold` | `700` | Page titles, KPI values |

### Line Heights
| Token | Value | Usage |
|-------|-------|-------|
| `--leading-tight` | `1.2` | Headings |
| `--leading-normal` | `1.5` | Body text |
| `--leading-relaxed` | `1.625` | Long-form text |

### Letter Spacing
| Token | Value | Usage |
|-------|-------|-------|
| `--tracking-tight` | `-0.02em` | Headings, data values |
| `--tracking-normal` | `0` | Body text |
| `--tracking-wide` | `0.05em` | Labels, uppercase text |

---

## 3. Spacing Scale (4px base)

| Token | Value |
|-------|-------|
| `--space-0` | `0` |
| `--space-1` | `4px` |
| `--space-2` | `8px` |
| `--space-3` | `12px` |
| `--space-4` | `16px` |
| `--space-5` | `20px` |
| `--space-6` | `24px` |
| `--space-8` | `32px` |
| `--space-10` | `40px` |
| `--space-12` | `48px` |
| `--space-16` | `64px` |

---

## 4. Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `--radius-sm` | `4px` | Badges, chips |
| `--radius-md` | `6px` | Cards, inputs |
| `--radius-lg` | `8px` | Panels, modals |
| `--radius-xl` | `12px` | Large containers |
| `--radius-full` | `9999px` | Pills, avatars |

**Global override:** `* { border-radius: 6px !important; }` ensures consistent minimal radius.

---

## 5. Elevation & Shadows

| Token | Value | Usage |
|-------|-------|-------|
| `--elevation-0` | `none` | Flat elements |
| `--elevation-1` | `0 1px 2px rgba(0,0,0,0.3)` | Subtle lift |
| `--elevation-2` | `0 4px 12px rgba(0,0,0,0.4)` | Cards |
| `--elevation-3` | `0 8px 24px rgba(0,0,0,0.5)` | Elevated panels |
| `--elevation-4` | `0 16px 48px rgba(0,0,0,0.6)` | Modals |

### Glass Effects
| Token | Value |
|-------|-------|
| `--glass-shadow` | `0 4px 12px rgba(0,0,0,0.4)` |
| `--glass-shadow-elevated` | `0 8px 24px rgba(0,0,0,0.5)` |
| `--glass-glow-focus` | `0 0 0 2px rgba(6,182,212,0.3)` |
| `--glass-glow-active` | `0 0 16px rgba(6,182,212,0.2)` |

---

## 6. Transitions

| Token | Value | Usage |
|-------|-------|-------|
| `--transition-fast` | `100ms ease` | Hover states, small interactions |
| `--transition-base` | `150ms ease` | General transitions |
| `--transition-slow` | `250ms ease` | Drawers, modals, large animations |

---

## 7. Component Specifications

### PageShell
- Max width: `1600px`
- Padding: `var(--space-6)` (24px), mobile: `var(--space-4)` (16px)
- Margin: `0 auto`
- Min-height: `calc(100vh - var(--header-height) - 2rem)`

### SectionCard (GlassPanel)
- Background: `var(--glass-bg)` with `backdrop-filter: blur(12px)`
- Border: `1px solid var(--glass-border)`
- Border-radius: `var(--radius-lg)` (8px)
- Shadow: `var(--glass-shadow)`
- Padding variants: sm=`var(--space-2)`, md=`var(--space-4)`, lg=`var(--space-6)`
- Elevated variant: `var(--glass-bg-elevated)` + `var(--glass-shadow-elevated)`
- Interactive variant: hover shows `var(--glass-bg-hover)` + `var(--glass-border-strong)`

### SectionHeader
- Title: `var(--font-heading)`, `var(--text-lg)`, `var(--font-semibold)`, `var(--text-primary)`
- Subtitle: `var(--text-muted)`, `var(--text-sm)`
- Layout: flex, space-between, center-aligned
- Bottom border: `1px solid var(--glass-border)`
- Margin-bottom: `var(--space-4)`
- Collapsible: Chevron icon with rotate transition

### Button Variants
| Variant | Background | Text | Border | Hover |
|---------|-----------|------|--------|-------|
| Primary | `var(--accent)` | white | none | `var(--accent-hover)` |
| Secondary | `var(--glass-bg)` | `var(--text-primary)` | `var(--glass-border)` | `var(--glass-bg-hover)` |
| Ghost | transparent | `var(--text-secondary)` | none | `var(--color-bg-overlay)` |
| Danger | `var(--color-bad-bg)` | `var(--color-bad)` | `var(--color-bad-border)` | darker red bg |

**Sizes:** sm=`var(--text-xs)` + `var(--space-1) var(--space-2)`, md=`var(--text-sm)` + `var(--space-2) var(--space-4)`, lg=`var(--text-base)` + `var(--space-3) var(--space-6)`

### Badge
- Font: `var(--text-xs)`, `var(--font-semibold)`, uppercase, `var(--tracking-wide)`
- Padding: `var(--space-1) var(--space-2)`
- Border-radius: `var(--radius-sm)`
- Variants: success (green bg+text), warning (amber), danger (red), neutral (slate), info (blue)

### DataTable
- Header: `var(--glass-bg-elevated)` background, `var(--text-secondary)` text, uppercase, `var(--text-xs)`
- Rows: alternating `transparent` / `rgba(255,255,255,0.02)`
- Hover: `rgba(255,255,255,0.05)`
- Border: bottom `1px solid var(--glass-border)` on each row
- Empty: centered EmptyState component

### Drawer
- Width: `420px` (mobile: `100%`)
- Background: `var(--glass-bg-elevated)` + `backdrop-filter: blur(16px)`
- Border-left: `1px solid var(--glass-border)`
- Header: flex between title and close button, border-bottom
- Body: overflow-y auto, padding `var(--space-6)`
- Backdrop: `rgba(0,0,0,0.5)` + blur(4px)
- Animation: slide from right, `var(--transition-slow)`

### Modal
- Background: `var(--glass-bg-elevated)` + `backdrop-filter: blur(12px)`
- Border: `1px solid var(--glass-border)`
- Shadow: `var(--glass-shadow-elevated)`
- Header: `rgba(15, 23, 42, 0.5)` bg, border-bottom
- Footer: same as header, border-top
- Backdrop: `rgba(0,0,0,0.6)` + blur(4px)

### EmptyState
- Layout: flex column, center aligned, center justified
- Padding: `var(--space-12) var(--space-6)`
- Icon: `var(--text-4xl)`, `var(--text-muted)`, opacity 0.6
- Title: `var(--font-heading)`, `var(--text-lg)`, `var(--font-semibold)`
- Description: `var(--text-secondary)`, `var(--text-sm)`, max-width 300px

### KPICard
- Label: `StatLabel` component (uppercase, `var(--text-xs)`, `var(--text-secondary)`)
- Value: `StatValue` component (`var(--font-mono)`, `var(--text-4xl)`, `var(--font-bold)`)
- Trend: small arrow + percentage, colored by direction (green up, red down, neutral gray)

### ConfidenceBadge
| Level | Color | Background |
|-------|-------|-----------|
| HIGH | `var(--color-good)` | `var(--color-good-bg)` |
| MED | `var(--color-warn)` | `var(--color-warn-bg)` |
| LOW | `var(--color-neutral)` | `var(--color-neutral-bg)` |
| INSUFFICIENT | `var(--color-bad)` | `var(--color-bad-bg)` |

### Skeleton (Loading States)
- Background: `var(--glass-bg)`
- Animation: shimmer pulse (opacity 0.5 → 1 → 0.5), 1.5s infinite
- Variants: block (rectangle), circle (avatar), text (narrow lines)

### NavBar
- Height: `56px` (`var(--header-height)`)
- Background: `var(--glass-bg-elevated)` + blur
- Border-bottom: `1px solid var(--glass-border)`
- Items: `var(--text-sm)`, `var(--text-secondary)`, hover: `var(--text-primary)`
- Active: `var(--accent)` text + bottom border indicator

---

## 8. Layout Rules

1. **Page padding**: Always `var(--space-6)` (24px), mobile `var(--space-4)` (16px)
2. **Section spacing**: `var(--space-6)` (24px) between sections (margin-bottom on section-wrapper)
3. **Card internal padding**: Default `var(--space-4)` (16px)
4. **Header-to-content gap**: `var(--space-4)` (16px) below SectionHeader
5. **Grid gaps**: `var(--space-4)` (16px) for card grids
6. **Label-to-value gap**: `var(--space-2)` (8px)
7. **Max content width**: 1600px centered

---

## 9. State Rules

### Loading
- Use Skeleton components matching the expected layout shape
- Never show empty content while loading

### Empty (No Data)
- Use EmptyState component with appropriate icon and description
- Include CTA when user can take action to resolve

### Blocked (Feature Unavailable)
- Use FeatureBlockedState with explanation of requirements
- Include repair suggestions or links to settings

### Limited (Partial Data)
- Use FeatureLimitedState explaining what works and what doesn't
- Show available data, don't hide the entire section

### Error
- Use EmptyState with type="error"
- Include actionable error message
