# DECK_UI_UX_REFACTOR_V1

## ProdDash Design Language Specification & Refactor Plan

**Version:** 1.0
**Status:** Planning
**Author:** Claude Code
**Date:** 2026-01-17

---

## Executive Summary

This document defines a unified, production-ready design language for ProdDash inspired by the deck aesthetic (dark cockpit + glass panels + teal accent), but optimized for daily use: minimal glow, high readability, consistent spacing, and centralized UI primitives.

### Goals
1. Eliminate visual drift across pages
2. Establish a single source of truth for design tokens
3. Reduce UI bloat via canonical component homes
4. Automate enforcement to prevent future drift

### Hard Constraints
- No new visual systems per page - all pages use shared primitives
- No duplicated capabilities across tabs (e.g., Decision Simulation lives in Plan only)
- No "marketing glow everywhere" - glow only for focus/active states
- No core metric logic changes in this workstream

---

## 1. Design Language Specification

### 1.1 Token Palette

#### Background System
```css
/* Base - Dark Cockpit Foundation */
--color-bg-base: #0f172a;           /* Slate-900 - deepest background */
--color-bg-gradient: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%);

/* Optional subtle grid overlay (use sparingly) */
--color-bg-grid: repeating-linear-gradient(
  0deg,
  transparent,
  transparent 40px,
  rgba(255, 255, 255, 0.02) 40px,
  rgba(255, 255, 255, 0.02) 41px
);

/* Noise texture (optional, for depth) */
--color-bg-noise: url("data:image/svg+xml,..."); /* 2% opacity noise */
```

#### Glass Panel System
```css
/* Primary Glass Surface */
--glass-bg: rgba(30, 41, 59, 0.7);           /* Semi-transparent slate */
--glass-bg-elevated: rgba(30, 41, 59, 0.85); /* Elevated panels/modals */
--glass-bg-hover: rgba(30, 41, 59, 0.9);     /* Hover state */

/* Glass Borders */
--glass-border: rgba(255, 255, 255, 0.08);   /* Default border */
--glass-border-strong: rgba(255, 255, 255, 0.12); /* Emphasized border */
--glass-border-accent: rgba(6, 182, 212, 0.4);    /* Teal accent border */

/* Glass Shadows (NO GLOW by default) */
--glass-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
--glass-shadow-elevated: 0 8px 24px rgba(0, 0, 0, 0.5);

/* FOCUS/ACTIVE GLOW ONLY */
--glass-glow-focus: 0 0 0 2px rgba(6, 182, 212, 0.3);
--glass-glow-active: 0 0 16px rgba(6, 182, 212, 0.2);
```

#### Primary Accent (Teal)
```css
/* Teal - Primary Interactive Color */
--accent: #06b6d4;                   /* Cyan-500 */
--accent-hover: #22d3ee;             /* Cyan-400 - lighter on hover */
--accent-muted: #0891b2;             /* Cyan-600 - muted variant */
--accent-bg: rgba(6, 182, 212, 0.12); /* Background tint */
--accent-border: rgba(6, 182, 212, 0.4); /* Border accent */
```

#### Semantic Colors (Good/Warn/Bad)
```css
/* Success / Good */
--color-good: #22c55e;               /* Green-500 */
--color-good-bg: rgba(34, 197, 94, 0.12);
--color-good-border: rgba(34, 197, 94, 0.4);

/* Warning / Caution */
--color-warn: #f59e0b;               /* Amber-500 */
--color-warn-bg: rgba(245, 158, 11, 0.12);
--color-warn-border: rgba(245, 158, 11, 0.4);

/* Danger / Bad */
--color-bad: #ef4444;                /* Red-500 */
--color-bad-bg: rgba(239, 68, 68, 0.12);
--color-bad-border: rgba(239, 68, 68, 0.4);

/* Neutral / Muted */
--color-neutral: #64748b;            /* Slate-500 */
--color-neutral-bg: rgba(100, 116, 139, 0.12);
```

#### Typography Scale
```css
/* Font Families */
--font-heading: 'Inter', system-ui, sans-serif;
--font-body: 'Inter', system-ui, sans-serif;
--font-mono: 'JetBrains Mono', 'SF Mono', monospace;

/* Text Colors */
--text-primary: #f8fafc;             /* Slate-50 - primary content */
--text-secondary: #94a3b8;           /* Slate-400 - labels, descriptions */
--text-muted: #64748b;               /* Slate-500 - truly muted */
--text-heading: #ffffff;             /* Pure white for headings */

/* Typography Scale */
--text-xs: 0.75rem;    /* 12px - footnotes, badges */
--text-sm: 0.875rem;   /* 14px - body, UI elements */
--text-base: 1rem;     /* 16px - primary body */
--text-lg: 1.125rem;   /* 18px - emphasized body */
--text-xl: 1.25rem;    /* 20px - section headers */
--text-2xl: 1.5rem;    /* 24px - page headers */
--text-3xl: 1.875rem;  /* 30px - hero numbers */
--text-4xl: 2.25rem;   /* 36px - KPI values */

/* Font Weights */
--font-normal: 400;
--font-medium: 500;
--font-semibold: 600;
--font-bold: 700;

/* Line Heights */
--leading-tight: 1.2;
--leading-normal: 1.5;
--leading-relaxed: 1.625;

/* Letter Spacing */
--tracking-tight: -0.02em;    /* Headings */
--tracking-normal: 0;          /* Body */
--tracking-wide: 0.05em;       /* Labels, uppercase */
```

#### Spacing & Radius System
```css
/* Spacing Scale (4px base) */
--space-0: 0;
--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-5: 20px;
--space-6: 24px;
--space-8: 32px;
--space-10: 40px;
--space-12: 48px;
--space-16: 64px;

/* Border Radius */
--radius-sm: 4px;      /* Badges, chips */
--radius-md: 6px;      /* Cards, inputs */
--radius-lg: 8px;      /* Panels, modals */
--radius-xl: 12px;     /* Large containers */
--radius-full: 9999px; /* Pills, avatars */

/* Elevation Levels */
--elevation-0: none;
--elevation-1: 0 1px 2px rgba(0, 0, 0, 0.3);
--elevation-2: 0 4px 12px rgba(0, 0, 0, 0.4);
--elevation-3: 0 8px 24px rgba(0, 0, 0, 0.5);
--elevation-4: 0 16px 48px rgba(0, 0, 0, 0.6);
```

### 1.2 Interaction Rules

#### What Gets an Accent Outline
- Primary CTA buttons (always)
- Active tab/nav items
- Focused inputs
- Selected cards/rows
- NEVER: decorative elements, static panels, headers

#### Hover States
```css
/* Interactive Elements */
.interactive:hover {
  background: var(--glass-bg-hover);
  border-color: var(--glass-border-strong);
  /* NO GLOW on hover - only subtle bg change */
}

/* Buttons */
.btn-primary:hover {
  background: var(--accent-hover);
  /* Slight brightness increase, no glow */
}

/* Table Rows */
tr:hover {
  background: rgba(255, 255, 255, 0.03);
}

/* Cards */
.card:hover {
  border-color: var(--glass-border-strong);
  transform: translateY(-1px); /* Subtle lift */
}
```

#### Focus States
```css
/* Focus Ring - ONLY place glow is allowed */
*:focus-visible {
  outline: none;
  box-shadow: var(--glass-glow-focus);
}

/* Active State (clicked/pressed) */
*:active {
  transform: scale(0.98);
}
```

#### Chip/Badge Rules
```css
/* Status Badges - Always use semantic colors */
.badge-good { background: var(--color-good-bg); color: var(--color-good); }
.badge-warn { background: var(--color-warn-bg); color: var(--color-warn); }
.badge-bad { background: var(--color-bad-bg); color: var(--color-bad); }
.badge-neutral { background: var(--color-neutral-bg); color: var(--text-secondary); }

/* Category Chips - Muted, no glow */
.chip {
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  color: var(--text-secondary);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
}

/* Interactive Chips */
.chip-interactive:hover {
  border-color: var(--accent-border);
  color: var(--accent);
}
```

### 1.3 Chart Palette Rules

#### Categorical Palette (6 colors max)
```css
/* Primary series colors - consistent across all charts */
--chart-1: #06b6d4;  /* Teal - Primary */
--chart-2: #8b5cf6;  /* Violet - Secondary */
--chart-3: #f59e0b;  /* Amber - Tertiary */
--chart-4: #3b82f6;  /* Blue */
--chart-5: #22c55e;  /* Green */
--chart-6: #ec4899;  /* Pink */
--chart-muted: #475569; /* Slate-600 - for "Other" */
```

#### Semantic Mapping Rules
```javascript
// Source channels - ALWAYS same colors
const SOURCE_COLORS = {
  Referral: '#22c55e',   // Green - best quality
  Sourced: '#06b6d4',    // Teal - proactive
  Inbound: '#8b5cf6',    // Violet - passive
  Internal: '#3b82f6',   // Blue - internal mobility
  Agency: '#f59e0b',     // Amber - external
  Other: '#475569'       // Muted
};

// Pipeline stages - progression from cool to warm
const STAGE_COLORS = {
  LEAD: '#64748b',       // Slate
  APPLIED: '#3b82f6',    // Blue
  SCREEN: '#06b6d4',     // Teal
  HM_SCREEN: '#8b5cf6',  // Violet
  ONSITE: '#a855f7',     // Purple
  FINAL: '#ec4899',      // Pink
  OFFER: '#f59e0b',      // Amber
  HIRED: '#22c55e'       // Green
};

// Health status - universal
const STATUS_COLORS = {
  healthy: '#22c55e',
  warning: '#f59e0b',
  critical: '#ef4444'
};
```

#### Chart Styling Rules
- Axis lines: `--glass-border` (subtle)
- Grid lines: `rgba(255, 255, 255, 0.05)` (nearly invisible)
- Tooltip: `--glass-bg-elevated` with `--glass-border-strong`
- No 3D effects, no gradients on bars
- Area charts: 20% opacity fill only
- Legends: Use chips/badges, not colored squares

---

## 2. UI Primitives Inventory & Contract

### 2.1 Required Primitives

| Primitive | Location | Status |
|-----------|----------|--------|
| PageShell | `components/layout/PageShell.tsx` | Exists |
| PageHeader | `components/layout/PageHeader.tsx` | Exists |
| SectionHeader | `components/layout/SectionHeader.tsx` | Exists |
| GlassPanel | `components/layout/GlassPanel.tsx` | Exists |
| KPICard | `components/common/KPICard.tsx` | Exists |
| StatLabel | `components/common/StatLabel.tsx` | Exists |
| StatValue | `components/common/StatValue.tsx` | Exists |
| Badge/Chip | `components/common/DavosBadge.tsx` | Exists (needs rename) |
| DataTableShell | `components/common/DataTableShell.tsx` | Exists |
| EmptyState | `components/layout/EmptyState.tsx` | Exists |
| Drawer | `components/common/ExplainDrawer.tsx` | Exists |
| InlineHelp | `components/common/InlineHelp.tsx` | Exists |

### 2.2 Primitive Contracts

#### PageShell
```typescript
interface PageShellProps {
  children: React.ReactNode;
  className?: string;
}

/* CSS Classes Used */
.page-shell {
  padding: var(--space-6);
  max-width: 1600px;
  margin: 0 auto;
}

/* Usage: MUST wrap every tab/page content */
```

#### PageHeader
```typescript
interface PageHeaderProps {
  title: string;                    // Required - page title
  description?: string;             // Optional - subtitle
  actions?: React.ReactNode;        // Optional - right-aligned actions
  breadcrumbs?: Breadcrumb[];       // Optional - navigation trail
}

/* Token Classes */
.page-header-title {
  font-size: var(--text-2xl);
  font-weight: var(--font-bold);
  color: var(--text-heading);
  letter-spacing: var(--tracking-tight);
}

.page-header-description {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  margin-top: var(--space-1);
}

/* Usage: ONE per page, at top of PageShell */
```

#### SectionHeader
```typescript
interface SectionHeaderProps {
  title: string;                    // Required - section title
  subtitle?: string;                // Optional - description
  collapsible?: boolean;            // Optional - expand/collapse
  defaultExpanded?: boolean;        // Default: true
  actions?: React.ReactNode;        // Optional - right-aligned actions
  children?: React.ReactNode;       // Content below header
}

/* Token Classes */
.section-header-title {
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
}

.section-header-subtitle {
  font-size: var(--text-sm);
  color: var(--text-muted);
}

/* Usage: For logical content groupings */
```

#### GlassPanel
```typescript
interface GlassPanelProps {
  children: React.ReactNode;
  className?: string;
  elevated?: boolean;               // Higher contrast for modals
  padding?: 'none' | 'sm' | 'md' | 'lg';
  onClick?: () => void;             // Makes panel interactive
}

/* Token Classes */
.glass-panel {
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--glass-shadow);
}

.glass-panel-elevated {
  background: var(--glass-bg-elevated);
  box-shadow: var(--glass-shadow-elevated);
}

/* Padding variants */
.p-sm { padding: var(--space-2); }  /* 8px */
.p-md { padding: var(--space-4); }  /* 16px - default */
.p-lg { padding: var(--space-6); }  /* 24px */

/* Usage: ALL content cards use GlassPanel */
```

#### KPICard
```typescript
interface KPICardProps {
  title: string;                    // Label above value
  value: string | number;           // Main metric
  subtitle?: string;                // Context below
  trend?: { value: number; isPositive: boolean };
  priorPeriod?: { value: number; label?: string };
  contextTotal?: string | number;   // For "X / Y" display
  onClick?: () => void;             // Navigate to detail
  lowConfidence?: boolean;          // Warning indicator
}

/* Inherits GlassPanel + adds */
.kpi-value {
  font-family: var(--font-mono);
  font-size: var(--text-4xl);
  font-weight: var(--font-bold);
  font-variant-numeric: tabular-nums;
}

/* Usage: Top-level metrics only (5-7 max per view) */
```

#### StatLabel + StatValue
```typescript
// For inline metrics within content
interface StatLabelProps {
  children: React.ReactNode;
  className?: string;
}

interface StatValueProps {
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  color?: 'default' | 'good' | 'warn' | 'bad';
  className?: string;
}

/* Token Classes */
.stat-label {
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: var(--tracking-wide);
}

.stat-value {
  font-family: var(--font-mono);
  font-weight: var(--font-semibold);
  font-variant-numeric: tabular-nums;
}
.stat-value-sm { font-size: var(--text-lg); }
.stat-value-md { font-size: var(--text-2xl); }
.stat-value-lg { font-size: var(--text-3xl); }
```

#### Badge/Chip (DavosBadge)
```typescript
interface BadgeProps {
  variant: 'good' | 'warn' | 'bad' | 'neutral' | 'accent';
  size?: 'sm' | 'md';
  children: React.ReactNode;
}

/* Token Classes */
.badge {
  display: inline-flex;
  align-items: center;
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  text-transform: uppercase;
  letter-spacing: var(--tracking-wide);
}

/* Variants use semantic colors from 1.1 */
```

#### DataTableShell
```typescript
interface DataTableShellProps {
  columns: Column[];
  data: any[];
  sortable?: boolean;
  onRowClick?: (row: any) => void;
  emptyState?: React.ReactNode;
}

/* Token Classes */
.data-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
}

.data-table th {
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: var(--tracking-wide);
  padding: var(--space-3);
  border-bottom: 1px solid var(--glass-border);
  text-align: left;
}

.data-table td {
  padding: var(--space-3);
  border-bottom: 1px solid var(--glass-border-subtle);
  color: var(--text-primary);
}

.data-table tr:hover {
  background: rgba(255, 255, 255, 0.02);
}
```

#### EmptyState
```typescript
interface EmptyStateProps {
  icon?: string;                    // Bootstrap icon name
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}

/* Token Classes */
.empty-state {
  text-align: center;
  padding: var(--space-12) var(--space-6);
}

.empty-state-icon {
  font-size: var(--text-4xl);
  color: var(--text-muted);
  margin-bottom: var(--space-4);
}

.empty-state-title {
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
}
```

### 2.3 Banned Patterns

#### Inline Typography Styling
```typescript
// BANNED - inline font styling
<span style={{ fontSize: '1.5rem', fontWeight: 600 }}>42d</span>

// CORRECT - use primitives
<StatValue size="lg">42d</StatValue>
```

#### Ad-hoc Headers
```typescript
// BANNED - raw header tags outside primitives
<h2>Pipeline Health</h2>

// CORRECT - use SectionHeader
<SectionHeader title="Pipeline Health" />
```

#### Bespoke Card Systems
```typescript
// BANNED - custom card styling
<div className="card-bespoke custom-card" style={{ background: '...' }}>

// CORRECT - use GlassPanel
<GlassPanel elevated padding="lg">
```

#### Hardcoded Colors
```typescript
// BANNED - hardcoded colors
style={{ color: '#22c55e' }}

// CORRECT - use tokens
style={{ color: 'var(--color-good)' }}
// OR
className="text-good"
```

---

## 3. Route-by-Route Audit Checklist

### 3.1 Control Tower (`/`, `/control-tower`)
**Current Issues:**
- [ ] `HealthIndicator` component uses inline styles for colors
- [ ] Badge colors hardcoded in component
- [ ] Mixed use of `stat-label` class and inline styling
- [ ] KPI cards have inconsistent padding

**Required Changes:**
- [ ] Extract `HealthIndicator` to use Badge component
- [ ] Replace inline color styles with CSS variables
- [ ] Standardize all KPIs to use KPICard primitive
- [ ] Add PageHeader with proper title/description

### 3.2 Ask ProdDash (`/ask`)
**Current Issues:**
- [ ] Custom CSS file (`ask-proddash.css`) with unique styling
- [ ] Chat-style layout doesn't use GlassPanel
- [ ] Typography uses custom sizing
- [ ] No PageHeader

**Required Changes:**
- [ ] Wrap response cards in GlassPanel
- [ ] Add PageHeader with "Ask ProdDash" title
- [ ] Consolidate custom CSS into theme or primitives
- [ ] Ensure StatValue used for metrics in responses

### 3.3 Scenario Library (`/plan/scenarios`)
**Current Issues:**
- [ ] Custom CSS file (`scenario-library.css`)
- [ ] Uses PageHeader and GlassPanel (good)
- [ ] Output panels have custom card styling
- [ ] Confidence badges use inline colors

**Required Changes:**
- [ ] Replace custom output cards with GlassPanel
- [ ] Use Badge primitive for confidence/feasibility
- [ ] Consolidate scenario-library.css into theme
- [ ] Ensure chart colors follow palette rules

### 3.4 Velocity Insights (`/diagnose/velocity`)
**Current Issues:**
- [ ] `ConfidenceBadge` component uses inline styles
- [ ] `ChartFooter` has custom typography
- [ ] VelocityCopilotPanel has unique styling
- [ ] WhatIfSimulatorPanel duplicates Decision Simulation from Plan

**Required Changes:**
- [ ] Replace ConfidenceBadge with Badge primitive
- [ ] Standardize ChartFooter typography with StatLabel
- [ ] Remove WhatIfSimulatorPanel (link to Plan > Scenarios instead)
- [ ] Add "Run Scenario" CTA linking to /plan/scenarios

### 3.5 Source Effectiveness (`/diagnose/sources`)
**Current Issues:**
- [ ] `ChannelCard` uses custom card styling
- [ ] Color palette defined locally (not from theme)
- [ ] Uses card-bespoke class instead of GlassPanel
- [ ] Typography inconsistent with primitives

**Required Changes:**
- [ ] Replace ChannelCard with GlassPanel + SectionHeader
- [ ] Move SOURCE_COLORS to theme constants
- [ ] Replace card-bespoke with GlassPanel
- [ ] Use StatLabel/StatValue for metrics

### 3.6 Overview (`/diagnose/overview`)
**Current Issues:**
- [ ] Uses PageHeader (good)
- [ ] KPIs use KPICard (good)
- [ ] Some inline styling in chart components
- [ ] Mixed card patterns

**Required Changes:**
- [ ] Audit all cards for GlassPanel consistency
- [ ] Ensure chart colors from theme palette
- [ ] Remove any inline typography

### 3.7 Recruiter Detail (`/diagnose/recruiter`)
**Current Issues:**
- [ ] Complex layout with multiple card types
- [ ] Inline styling for metrics
- [ ] Custom table styling

**Required Changes:**
- [ ] Standardize metric displays with StatValue
- [ ] Use DataTableShell for tables
- [ ] Wrap sections in GlassPanel

### 3.8 HM Friction (`/diagnose/hm-friction`)
**Current Issues:**
- [ ] Custom styling for latency indicators
- [ ] Inline colors for status

**Required Changes:**
- [ ] Use Badge for status indicators
- [ ] Replace inline colors with semantic tokens

### 3.9 Hiring Managers (`/diagnose/hiring-managers`)
**Current Issues:**
- [ ] HMScorecard, HMActionQueue have custom styling
- [ ] Multiple card patterns

**Required Changes:**
- [ ] Standardize scorecards with GlassPanel + KPICard
- [ ] Use UnifiedActionQueue pattern consistently

### 3.10 Quality (`/diagnose/quality`)
**Current Issues:**
- [ ] Uses PageHeader (good)
- [ ] Some custom chart styling

**Required Changes:**
- [ ] Ensure chart palette consistency
- [ ] Audit for inline styling

### 3.11 Capacity (`/plan/capacity`)
**Current Issues:**
- [ ] FitMatrix has complex custom styling
- [ ] RecruiterLoadTable uses custom patterns
- [ ] RebalanceRecommendations unique cards

**Required Changes:**
- [ ] Wrap FitMatrix in GlassPanel with standard header
- [ ] RecruiterLoadTable → DataTableShell
- [ ] RebalanceRecommendations → GlassPanel cards

### 3.12 Forecasting (`/plan/forecast`)
**Current Issues:**
- [ ] Custom chart styling
- [ ] Projection cards

**Required Changes:**
- [ ] Standard GlassPanel for projection displays
- [ ] Chart palette alignment

### 3.13 Data Health (`/settings/data-health`)
**Current Issues:**
- [ ] DataHealthPanel has unique styling
- [ ] Status badges inline

**Required Changes:**
- [ ] Use Badge for status
- [ ] Standardize panel styling

### 3.14 AI Settings (`/settings/ai`)
**Current Issues:**
- [ ] Modal styling different from theme
- [ ] Form inputs inconsistent

**Required Changes:**
- [ ] Standard GlassPanel for settings cards
- [ ] Form input styling from theme

### 3.15 Org Settings (`/settings/org`)
**Current Issues:**
- [ ] Custom settings cards
- [ ] Member list styling

**Required Changes:**
- [ ] GlassPanel for all settings sections
- [ ] DataTableShell for member lists

---

## 4. UX Declutter Decisions

### 4.1 Canonical Homes for Capabilities

| Capability | Canonical Home | Other Locations → Action |
|------------|----------------|--------------------------|
| **Explain Metric** | Diagnose (any tab) | Remove duplicates; use ExplainDrawer everywhere |
| **Action Queue** | Control Tower | HM tab shows filtered view; link back to CT for full queue |
| **Scenarios / What-If** | Plan > Scenarios | Remove WhatIfSimulatorPanel from Velocity; add CTA link |
| **Ask / Chat** | Ask tab | Remove any inline chat widgets; link to /ask |
| **Data Health** | Settings > Data Health | Summary badge in CT; click → Settings |
| **Pipeline Health** | Diagnose > Velocity | Remove duplicates from other tabs |
| **Forecast** | Plan > Forecast | CT shows summary; click → full view |

### 4.2 Duplicate UI to Remove

1. **WhatIfSimulatorPanel in VelocityInsightsTab**
   - Action: Remove component
   - Replace with: "Model Scenarios" CTA → `/plan/scenarios?from=velocity`

2. **Inline Action Queue in HM Tab**
   - Action: Keep filtered view
   - Add: "View All Actions" CTA → `/control-tower#actions`

3. **Data Health Summary in Multiple Tabs**
   - Action: Remove inline summaries
   - Replace with: DataHealthBadge (icon only) → `/settings/data-health`

4. **Pipeline Health Card Duplicates**
   - Action: Single canonical PipelineHealthCard
   - Other tabs: Link or small summary widget

### 4.3 CTA Link Patterns

```typescript
// Standard CTA link to another tab
<button
  className="btn btn-link text-accent"
  onClick={() => navigate('/plan/scenarios')}
>
  <i className="bi bi-arrow-right-circle me-1" />
  Model Scenarios
</button>

// Inline reference with icon
<span className="text-muted">
  For detailed analysis, see{' '}
  <Link to="/diagnose/velocity" className="text-accent">
    Velocity Insights
  </Link>
</span>
```

---

## 5. Automated Enforcement

### 5.1 Extended ui:style-audit Rules

Update `scripts/ui-style-audit.js` with additional rules:

```javascript
// NEW RULES TO ADD

// Rule 4: Hardcoded color values
const HARDCODED_COLOR_REGEX = /#[0-9a-fA-F]{3,6}|rgb\(|rgba\(/g;
// Allowed in: dashboard-theme.css, chart config files
const ALLOWED_COLOR_FILES = ['dashboard-theme.css', 'chartColors.ts'];

// Rule 5: card-bespoke usage (should use GlassPanel)
const CARD_BESPOKE_REGEX = /className=["'][^"']*card-bespoke[^"']*["']/g;
// Should be flagged for migration to GlassPanel

// Rule 6: Custom CSS files in components
const COMPONENT_CSS_REGEX = /import\s+['"]\.\/[^'"]+\.css['"]/g;
// Allowed: Only in approved component directories

// Rule 7: Glow/shadow outside focus states
const GLOW_REGEX = /box-shadow:.*glow|0\s+0\s+\d+px.*rgba\(6,\s*182,\s*212/g;
// Should only appear in :focus-visible selectors
```

### 5.2 New Rules Summary

| Rule ID | Check | Severity | Allowed Exceptions |
|---------|-------|----------|-------------------|
| HARDCODED_COLOR | Hex/rgb colors in TSX | Error | Chart configs |
| CARD_BESPOKE | card-bespoke class | Warning | None (migrate) |
| COMPONENT_CSS | Local CSS imports | Warning | Approved list |
| GLOW_USAGE | Glow outside focus | Error | Focus states only |
| INLINE_PADDING | style={{ padding }} | Warning | Dynamic values |
| CUSTOM_SHADOW | Non-token shadows | Error | None |

### 5.3 Route Smoke Test Expectations

```yaml
# Expected structure per route
smoke_test:
  every_route:
    - has: PageShell wrapper
    - has: PageHeader at top
    - has_not: raw h1/h2/h3 tags
    - has_not: inline fontSize/fontWeight
    - has_not: hardcoded colors

  control_tower:
    - kpi_count: 5
    - section_count: 4 (KPIs, Risks, Actions, Forecast)
    - uses: SectionHeader for each section

  ask:
    - has: PageHeader
    - chat_cards: GlassPanel
    - citations: Badge component

  scenarios:
    - has: PageHeader
    - selector: GlassPanel cards
    - output: GlassPanel with SectionHeader

  velocity:
    - has: PageHeader
    - charts: Theme palette
    - has_not: WhatIfSimulatorPanel
```

### 5.4 Acceptance Criteria

Before marking refactor complete:

1. **Zero ui:style-audit Violations**
   - Run `npm run ui:style-audit`
   - All rules pass with 0 violations

2. **Visual Regression Tests**
   - Screenshot comparison for each route
   - No unintended visual changes

3. **Token Coverage**
   - 100% of colors from CSS variables
   - 100% of typography from primitives

4. **Component Usage**
   - Every page uses PageShell + PageHeader
   - Every card uses GlassPanel
   - Every metric uses StatValue or KPICard

5. **No Duplicate Capabilities**
   - WhatIfSimulatorPanel removed from Velocity
   - Cross-tab links verified

---

## 6. Migration Phases

### Phase 1: Token Consolidation (Week 1)
- [ ] Update dashboard-theme.css with complete token palette
- [ ] Add missing CSS variables
- [ ] Create chartColors.ts with semantic mappings
- [ ] Update ui:style-audit with new rules

### Phase 2: Primitive Hardening (Week 1-2)
- [ ] Audit and fix PageShell/PageHeader usage
- [ ] Standardize GlassPanel props and styling
- [ ] Create Badge component (rename DavosBadge)
- [ ] Ensure StatLabel/StatValue cover all cases

### Phase 3: Route Migration (Week 2-4)
Priority order (by usage/visibility):
1. Control Tower
2. Ask ProdDash
3. Velocity Insights
4. Scenario Library
5. Source Effectiveness
6. Overview
7. Capacity
8. Remaining routes

### Phase 4: Declutter & Link (Week 4)
- [ ] Remove WhatIfSimulatorPanel from Velocity
- [ ] Add CTA links between related features
- [ ] Remove duplicate UI elements
- [ ] Verify canonical homes

### Phase 5: Enforcement & QA (Week 5)
- [ ] Run full ui:style-audit
- [ ] Visual regression review
- [ ] Update CLAUDE.md with new patterns
- [ ] Create QA report document

---

## 7. QA Report Template

```markdown
# UI/UX Refactor QA Report

**Date:** [DATE]
**Reviewer:** [NAME]
**Commit:** [HASH]

## Audit Results

### ui:style-audit
- Total violations: X
- Inline typography: X
- Raw headers: X
- Hardcoded colors: X

### Route Checklist

| Route | PageShell | PageHeader | GlassPanel | No Violations |
|-------|-----------|------------|------------|---------------|
| / | ✓ | ✓ | ✓ | ✓ |
| /ask | ✓ | ✓ | ✓ | ✓ |
| ... | | | | |

### Visual Regression

| Route | Baseline Match | Notes |
|-------|----------------|-------|
| / | ✓ | |
| /ask | ⚠️ | Chat bubble spacing |
| ... | | |

### Duplicate Check

- [ ] WhatIfSimulatorPanel removed
- [ ] Cross-tab links working
- [ ] No duplicate action queues

### Sign-off

- [ ] All violations resolved
- [ ] Visual review complete
- [ ] Stakeholder approval
```

---

## Appendix A: File Reference

### CSS Files to Update
- `src/productivity-dashboard/dashboard-theme.css` - Main tokens
- `src/productivity-dashboard/components/layout/layout.css` - Primitives

### CSS Files to Consolidate/Remove
- `src/productivity-dashboard/components/ask-proddash/ask-proddash.css`
- `src/productivity-dashboard/components/scenarios/scenario-library.css`

### Component Files to Update
- All files listed in Section 3 audit checklist

### Script Files to Update
- `scripts/ui-style-audit.js` - Add new rules

---

## Appendix B: Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-01-17 | Teal as primary accent | Matches deck aesthetic, distinct from status colors |
| 2026-01-17 | No glow except focus | Production readability > flashiness |
| 2026-01-17 | 6-color chart palette | Cognitive limit, ensures consistency |
| 2026-01-17 | Scenarios canonical in Plan | Natural IA grouping for forward-looking features |

---

*End of Document*
