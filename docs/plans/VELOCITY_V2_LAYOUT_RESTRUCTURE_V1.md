# Velocity V2 Layout Restructure Plan

**Version:** 1.0
**Goal:** Layout-only restructure to show verdict fast, put P0 insights first, collapse non-critical analysis, work at 375px width.
**Constraint:** No behavior changes. No new business logic.

---

## Baseline Check Results

```
npm run build: ✅ PASS (Compiled successfully)
npm test -- --watchAll=false: ✅ PASS (1440 tests passed)
```

---

## Current Render Tree

File: `src/productivity-dashboard/components/v2/velocity-insights/VelocityInsightsTabV2.tsx` (1192 lines)

```
VelocityInsightsTabV2
├── SubViewHeader (title="Pipeline Velocity", helpContent=VELOCITY_PAGE_HELP)
├── VelocityCopilotPanelV2 (AI insights panel - contains P0/P1/P2 severity insights)
│   └── AIInsightCard[] (with SeverityBadge P0/P1/P2, Action/Draft/Evidence buttons)
├── LimitedDataBanner (warns about insufficient data)
├── SECTION 1: Key Metrics (SectionHeaderLocal + 4 KPI cards in grid)
│   └── 4x glass-panel (Median TTF, Accept Rate, Fill Rate, Decay Start)
├── SECTION 2: Pipeline Health (PipelineHealthCard with config button)
│   └── BenchmarkConfigModal
├── SECTION 3: Stage Timing (conditional, usually empty)
├── SECTION 4: Decay Analysis (SectionHeaderLocal + 2 charts side by side)
│   ├── Candidate Decay (BarChart)
│   └── Req Decay (AreaChart)
├── SECTION 5: Fast vs Slow Hires (cohort comparison table)
├── SECTION 6: Workload vs Speed (loadVsPerformance table)
├── SECTION 7: Key Insights (metrics.insights in CompactInsightCard grid) ← REDUNDANT
├── SECTION 8: What-if Simulator CTA (link to /plan/scenarios)
├── DrawerBackdrop
└── EvidenceDrawer
```

File: `src/productivity-dashboard/components/v2/velocity-insights/VelocityCopilotPanelV2.tsx` (585 lines)

```
VelocityCopilotPanelV2
├── Header (icon, "Velocity Insights", count, Refresh button)
├── Error state
├── Empty state (AI Analysis / Quick Analysis buttons)
├── Loading state (LogoSpinner)
├── AIInsightCard[] for each insight
│   ├── SeverityBadge (P0/P1/P2)
│   ├── Title + Claim
│   ├── MiniChartV2 (inline visualization)
│   ├── Why Now + Recommended action
│   └── Action buttons (Action/Draft/Evidence) + CitationsDisplay
└── DraftMessageModal
```

---

## Existing Severity System

**Copilot insights (`AICopilotInsight`)** have:
- `severity: 'P0' | 'P1' | 'P2'` - Already exists, use as-is
- P0 = Blocking (red)
- P1 = Risk (yellow/warn)
- P2 = Optimize (green)

**Velocity insights (`VelocityInsight`)** have:
- `type: 'warning' | 'success' | 'info'` - No direct P0/P1/P2 mapping
- Existing priority mapping in `handleCreateAction` (lines 681-683):
  ```typescript
  const priority = insight.type === 'warning' && hasStrongEvidence ? 'P0' :
    insight.type === 'warning' ? 'P1' : 'P2';
  ```

**Grouping rules for Pass 1:**
1. VelocityCopilotPanelV2 insights: Group by existing `severity` field (P0/P1/P2)
2. VelocityInsightsTabV2 insights (metrics.insights): Do NOT group by severity - these are displayed via CompactInsightCard which uses `type` for styling
3. Do NOT invent new severity mapping. Keep existing rendering logic.

---

## Proposed Layout (Pass 1)

### New Section Order

```
VelocityInsightsTabV2
├── 1. EXECUTIVE HEADER (compact verdict + KPIs)
│   ├── SubViewHeader (unchanged - title + help)
│   └── Key Metrics row (move up, make compact)
│
├── 2. VELOCITY INSIGHTS PANEL (VelocityCopilotPanelV2 - insights first)
│   └── Modify to group by severity:
│       ├── P0 BLOCKING section (expanded by default)
│       ├── P1 RISKS section (collapsed by default)
│       └── P2 OPTIMIZATIONS section (collapsed by default)
│
├── 3. DEEP DIVE ACCORDION (collapsed by default)
│   ├── Pipeline Health (PipelineHealthCard)
│   ├── Decay Analysis (2 charts)
│   ├── Fast vs Slow Hires (table)
│   ├── Workload vs Speed (table)
│   └── What-if link
│
├── 4. REMOVED: Key Insights section (redundant with Copilot panel)
│
├── DrawerBackdrop (unchanged)
└── EvidenceDrawer (unchanged)
```

### What Moves Where

| Current Section | New Location | Change Type |
|-----------------|--------------|-------------|
| SubViewHeader | Keep at top | No change |
| Key Metrics (4 KPIs) | Move into Executive Header area | Reorder only |
| VelocityCopilotPanelV2 | Keep, add collapse groups | Layout change |
| LimitedDataBanner | Move into relevant sections | Inline placement |
| Pipeline Health | Move into Deep Dive accordion | Collapse by default |
| Stage Timing | Move into Deep Dive accordion | Collapse by default |
| Decay Analysis | Move into Deep Dive accordion | Collapse by default |
| Fast vs Slow Hires | Move into Deep Dive accordion | Collapse by default |
| Workload vs Speed | Move into Deep Dive accordion | Collapse by default |
| Key Insights | REMOVE | Redundant |
| What-if CTA | Move into Deep Dive accordion | Collapse by default |
| EvidenceDrawer | Keep at bottom | No change |

---

## DO NOT CHANGE List

These functions and components must remain unchanged:

### VelocityInsightsTabV2.tsx
- `handleCreateAction` (lines 671-708) - action creation logic
- `handleViewEvidence` (lines 711-713) - drawer opening
- `handleCloseEvidence` (lines 717-720) - drawer closing
- `generateActionId` (lines 665-668) - ID generation
- All metric calculations:
  - `candidateDecay`, `reqDecay` extraction (line 631)
  - `pipelineHealth` calculation (lines 728-733)
  - `loadVsPerformance` calculation (lines 736-739)
  - `candidateChartData`, `reqChartData` formatting (lines 763-779)
  - Confidence calculations (lines 782-788)
- `EvidenceDrawer` component (lines 158-437) - keep internals unchanged
- `DrawerBackdrop` component (lines 439-447)
- `BenchmarkConfigModal` usage and handlers (lines 878-888)

### VelocityCopilotPanelV2.tsx
- `handleGenerateAI` (lines 325-346) - AI insight generation
- `handleGenerateDeterministic` (lines 349-363) - deterministic generation
- `handleCreateAction` (lines 376-403) - action creation
- `handleDraftMessage` (lines 406-429) - draft generation
- `handleViewEvidence` (lines 432-465) - evidence conversion
- `AIInsightCard` component (lines 112-206) - keep action buttons working
- `DraftMessageModal` component (lines 209-289)

---

## Mobile Rules (375px)

### Grid Collapse Rules
- KPI grid: `grid-cols-2 md:grid-cols-4` → Already exists, no change needed
- Insight grid (currently `grid-cols-1 md:grid-cols-2`): Keep as-is
- Decay charts grid (`grid-cols-1 lg:grid-cols-2`): Keep as-is

### Table Handling
- Fast vs Slow Hires table: Already wrapped in `overflow-x-auto`
- Workload vs Speed table: Already wrapped in `overflow-x-auto`
- Tables remain horizontal scrollable, no stacking needed

### Accordion on Mobile
- Deep Dive accordion: Collapsed by default on all screen sizes
- P1/P2 insight groups: Collapsed by default on all screen sizes
- P0 insight group: Expanded by default on desktop AND mobile

### Width Constraints
- No fixed pixel widths > 375px
- All content uses `max-w-full` or percentage widths
- Existing patterns already follow this

---

## Verification Checklist (Before Each Commit)

### Pre-Commit Checks
- [ ] `npm run build` passes
- [ ] `npm test -- --watchAll=false` passes
- [ ] No new TypeScript errors
- [ ] No new console errors at runtime

### Visual Checks
- [ ] P0 insights visible above the fold on desktop without scrolling
- [ ] All Action/Draft/Evidence buttons still trigger correct handlers
- [ ] Evidence drawer still opens and renders correctly
- [ ] BenchmarkConfigModal still opens from Pipeline Health
- [ ] At 375px width: no horizontal scroll on page body
- [ ] At 375px width: KPIs show 2 columns
- [ ] At 375px width: tables scroll horizontally within container

### Functionality Checks
- [ ] Create action from Copilot insight → action created with correct priority
- [ ] Create action from CompactInsightCard → action created
- [ ] View evidence → drawer opens with correct data
- [ ] Draft message → modal opens, generates draft
- [ ] Refresh button → regenerates insights
- [ ] Deep Dive accordion → expands/collapses
- [ ] P1/P2 sections → expand/collapse

---

## Commit Plan

### Commit 1: `velocity: restructure layout skeleton`
- Move Key Metrics section up, right after SubViewHeader
- Remove redundant "Key Insights" section (SECTION 7)
- Wrap sections 2-6 in a collapsible "Deep Dive" accordion
- Add accordion state (`deepDiveExpanded`) with default `false`

### Commit 2: `velocity: add severity grouping to copilot panel`
- In VelocityCopilotPanelV2, group insights by severity
- Add P0/P1/P2 collapsible sections
- P0 expanded by default, P1/P2 collapsed
- Use existing `SeverityBadge` styling

### Commit 3: `velocity: mobile layout fixes`
- Ensure KPI grid collapses to 2 cols at mobile
- Verify table overflow-x containers work
- Test at 375px width
- Fix any overflow issues found

### Commit 4: `velocity: cleanup`
- Remove any dead code
- Consolidate duplicate styles
- Final visual polish
- Update comments

---

## Follow-ups (Out of Scope for Pass 1)

1. **What-if link verification**: `/plan/scenarios` route exists (verified in App.js routes), but the link may need adjustment if route structure changes
2. **Extract new components to separate files**: Only in Pass 2 after layout is verified
3. **Unify insight sources**: VelocityCopilotPanelV2 and metrics.insights are separate - do NOT merge in Pass 1
4. **Dedupe insights**: No fuzzy matching or title similarity checks - out of scope
5. **New health badges**: Do not invent AHEAD/ON_TRACK/BEHIND logic - out of scope

---

## Existing CSS Patterns to Reuse

From VelocityInsightsTabV2.tsx:
- `glass-panel p-3` - card containers
- `grid grid-cols-2 md:grid-cols-4` - KPI grid
- `grid grid-cols-1 lg:grid-cols-2` - chart grid
- `text-foreground`, `text-muted-foreground` - text colors
- `bg-muted/50`, `bg-warn/10`, `bg-good/15` - backgrounds
- `border-l-[3px] border-l-warn` - severity borders
- `SectionHeaderLocal` - existing section header component

From VelocityCopilotPanelV2.tsx:
- `SeverityBadge` - P0/P1/P2 badges already exist
- `AIInsightCard` - insight card with buttons
- `px-3 py-1.5 text-xs bg-muted/30 border border-border rounded` - button style

For accordion, use pattern from existing components:
```tsx
// Example from SettingsTabV2.tsx mobile dropdown pattern
const [expanded, setExpanded] = useState(false);
<button onClick={() => setExpanded(!expanded)}>
  <ChevronDown className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
</button>
{expanded && <div>...content...</div>}
```

---

## Assumptions

1. Route `/plan/scenarios` exists and is correct (verified exists in route config)
2. All existing handler functions work correctly and should not be modified
3. The `isMobile` hook from `useIsMobile` correctly detects mobile breakpoints
4. Existing grid breakpoints (`md:`, `lg:`) are appropriate for the design
5. The EvidenceDrawer max-width of 440px is acceptable on mobile (will overlay)

---

## Plan Status

- [x] Current render tree documented
- [x] Existing severity system analyzed
- [x] Proposed layout defined
- [x] DO NOT CHANGE list created
- [x] Mobile rules specified
- [x] Verification checklist created
- [x] Commit plan defined
- [x] Baseline checks passed
- [x] Follow-ups documented

**Implementation complete (2026-01-29):**
- [x] Commit 1: `velocity: restructure layout skeleton` (5bea63c)
- [x] Commit 2: `velocity: add severity grouping to copilot panel` (02d06dc)
- [x] Commit 3: `velocity: mobile layout fixes` (b9f1d8a)
- [x] Commit 4: `velocity: cleanup` (3d6425c)

All verification checks pass:
- npm run build ✅
- npm test -- --watchAll=false (1440 tests) ✅
- npm run ui:style-audit ✅
- npm run route:smoke ✅
