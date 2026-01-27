# PlatoVue Design System

This document defines the V0-derived design system for PlatoVue.

## Design Philosophy

**Dark Glassmorphism** - A sophisticated dark theme with semi-transparent glass panels, subtle borders, and cyan accents. Designed for data-dense interfaces where readability and focus are paramount.

---

## Color Tokens

### Background System
| Token | Value | Usage |
|-------|-------|-------|
| `bg-base` | `#0f172a` | Page background |
| `bg-surface` | `rgba(30, 41, 59, 0.8)` | Card/panel backgrounds |
| `bg-elevated` | `rgba(30, 41, 59, 0.9)` | Elevated cards, modals |
| `bg-glass` | `rgba(30, 41, 59, 0.7)` | Glass panel backgrounds |

### Primary Accent (Cyan)
| Token | Value | Usage |
|-------|-------|-------|
| `accent` | `#06b6d4` | Primary buttons, links, active states |
| `accent-hover` | `#22d3ee` | Hover states |
| `accent-muted` | `#0891b2` | Subdued accent |
| `accent-light` | `rgba(6, 182, 212, 0.15)` | Accent backgrounds |

### Semantic Colors
| Token | Value | Usage |
|-------|-------|-------|
| `good` | `#22c55e` | Success, positive metrics |
| `good-bg` | `rgba(34, 197, 94, 0.12)` | Success backgrounds |
| `warn` | `#f59e0b` | Warning, caution |
| `warn-bg` | `rgba(245, 158, 11, 0.12)` | Warning backgrounds |
| `bad` | `#ef4444` | Error, negative metrics |
| `bad-bg` | `rgba(239, 68, 68, 0.12)` | Error backgrounds |

### Text Colors
| Token | Value | Usage |
|-------|-------|-------|
| `foreground` | `#f8fafc` | Primary text |
| `muted-foreground` | `#94a3b8` | Secondary text |
| `dim` | `#64748b` | Disabled/tertiary text |

### Glass Border
| Token | Value | Usage |
|-------|-------|-------|
| `glass-border` | `rgba(255, 255, 255, 0.08)` | Standard panel borders |
| `glass-border-strong` | `rgba(255, 255, 255, 0.12)` | Emphasized borders |

---

## Typography

### Font Families
```css
--font-sans: 'Inter', system-ui, -apple-system, sans-serif;
--font-mono: 'JetBrains Mono', 'SF Mono', Consolas, monospace;
```

### Type Scale
| Class | Size | Line Height | Usage |
|-------|------|-------------|-------|
| `text-xs` | 0.75rem | 1rem | Labels, badges |
| `text-sm` | 0.875rem | 1.25rem | Body text, table cells |
| `text-base` | 1rem | 1.5rem | Default body |
| `text-lg` | 1.125rem | 1.75rem | Section titles |
| `text-xl` | 1.25rem | 1.75rem | Page subtitles |
| `text-2xl` | 1.5rem | 2rem | Page titles |
| `text-3xl` | 1.875rem | 2.25rem | Hero text |
| `text-4xl` | 2.25rem | 2.5rem | Large metrics |

### Text Patterns
```jsx
// Page title
<h1 className="text-lg md:text-xl font-bold text-foreground tracking-tight">

// Section title
<h2 className="text-base font-semibold text-foreground">

// Body text
<p className="text-sm text-muted-foreground">

// Label (uppercase)
<span className="text-xs uppercase tracking-wider text-muted-foreground">

// Metric value
<span className="text-2xl font-mono font-semibold text-foreground">
```

---

## Glass Panel System

### Standard Glass Panel
```jsx
<div className="bg-bg-glass backdrop-blur-glass border border-glass-border rounded-lg p-4">
  {/* Content */}
</div>
```

### CSS Definition
```css
.glass-panel {
  background: rgba(30, 41, 59, 0.7);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 0.75rem;
}
```

### Tailwind Utility Classes
```jsx
// Basic glass panel
className="bg-bg-glass backdrop-blur-glass border border-glass-border rounded-lg"

// Elevated glass panel (modals, drawers)
className="bg-bg-elevated backdrop-blur-glass-lg border border-glass-border-strong rounded-xl shadow-glass-elevated"

// Interactive glass panel (hover states)
className="bg-bg-glass backdrop-blur-glass border border-glass-border rounded-lg hover:bg-bg-surface hover:border-glass-border-strong transition-colors"
```

---

## Component Patterns

### KPI Card
```jsx
<div className="glass-panel p-4">
  <div className="flex items-center justify-between mb-2">
    <span className="text-xs uppercase tracking-wider text-muted-foreground">
      {label}
    </span>
    <StatusIcon className="w-4 h-4 text-good" />
  </div>
  <div className="text-2xl font-mono font-semibold text-foreground">
    {value}
  </div>
  <div className="text-xs text-muted-foreground mt-1">
    {trend}
  </div>
</div>
```

### Section Header
```jsx
<div className="flex items-center justify-between mb-4">
  <div>
    <h2 className="text-base font-semibold text-foreground">{title}</h2>
    {subtitle && (
      <p className="text-xs text-muted-foreground">{subtitle}</p>
    )}
  </div>
  {actions && <div className="flex gap-2">{actions}</div>}
</div>
```

### Sub-Navigation Pills
```jsx
<div className="flex gap-1 overflow-x-auto pb-1">
  {items.map((item) => (
    <button
      key={item.id}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${
        active === item.id
          ? 'bg-accent-light text-accent'
          : 'text-muted-foreground hover:bg-white/[0.06] hover:text-foreground'
      }`}
    >
      {item.icon}
      <span>{item.label}</span>
    </button>
  ))}
</div>
```

### Button Variants
```jsx
// Primary (filled)
className="bg-accent hover:bg-accent-hover text-white font-medium px-4 py-2 rounded-md transition-colors"

// Secondary (outline)
className="border border-glass-border-strong text-foreground hover:bg-white/[0.06] px-4 py-2 rounded-md transition-colors"

// Ghost
className="text-muted-foreground hover:text-foreground hover:bg-white/[0.06] px-4 py-2 rounded-md transition-colors"
```

### Badge Variants
```jsx
// Default
className="bg-white/[0.06] text-muted-foreground text-xs px-2 py-0.5 rounded"

// Accent
className="bg-accent-light text-accent text-xs px-2 py-0.5 rounded"

// Good
className="bg-good-bg text-good-text text-xs px-2 py-0.5 rounded"

// Warn
className="bg-warn-bg text-warn-text text-xs px-2 py-0.5 rounded"

// Bad
className="bg-bad-bg text-bad-text text-xs px-2 py-0.5 rounded"
```

---

## Spacing

### Base Unit
4px (0.25rem) - All spacing should be multiples of this base unit.

### Common Spacing
| Usage | Value | Tailwind |
|-------|-------|----------|
| Tight | 4px | `p-1`, `gap-1` |
| Default | 8px | `p-2`, `gap-2` |
| Comfortable | 12px | `p-3`, `gap-3` |
| Spacious | 16px | `p-4`, `gap-4` |
| Section | 24px | `p-6`, `gap-6` |

### Layout
- Page padding: `px-4 md:px-6`
- Max content width: `max-w-[1600px]`
- Card padding: `p-4` or `p-6`
- Grid gaps: `gap-4` or `gap-6`

---

## Responsive Breakpoints

| Breakpoint | Width | Usage |
|------------|-------|-------|
| `sm` | 640px | Mobile landscape |
| `md` | 768px | Tablet |
| `lg` | 1024px | Desktop |
| `xl` | 1280px | Large desktop |
| `2xl` | 1536px | Extra large |

### Mobile-First Patterns
```jsx
// Responsive grid
className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"

// Responsive text
className="text-lg md:text-xl"

// Responsive padding
className="p-4 md:p-6"

// Hide on mobile
className="hidden md:flex"

// Stack on mobile, row on desktop
className="flex flex-col sm:flex-row"
```

---

## Animation

### Transitions
```css
transition-colors  /* Color changes */
transition-all     /* All properties */
duration-200       /* 200ms (fast) */
duration-300       /* 300ms (default) */
```

### Built-in Animations
```jsx
// Fade in
className="animate-fade-in"

// Slide in (from right)
className="animate-slide-in"

// Pulse
className="animate-pulse"
```

---

## Z-Index Layers

| Layer | Value | Usage |
|-------|-------|-------|
| Base | 0 | Default content |
| Sticky | 40 | Sticky headers |
| Dropdown | 50 | Dropdowns, popovers |
| Drawer | 100 | Side drawers |
| Modal | 200 | Modal dialogs |
| Toast | 300 | Toast notifications |
| Tooltip | 400 | Tooltips |

---

## V0 MCP Reference

When in doubt about design decisions, consult these V0 chats:
- **Main App Structure**: "Recruiting Capacity Planner" (cNbyypHn686)
- **Command Center**: "Refresh Command Center" (qlhPnUJ36Kk)

Use V0 MCP to:
1. Generate new component designs
2. Validate design patterns
3. Get responsive layout recommendations
4. Ensure consistency with the established design language
