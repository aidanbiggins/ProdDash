# Information Architecture Refactor V1

**Status**: Implemented
**Created**: 2026-01-13
**Completed**: 2026-01-14
**Author**: Claude Code

---

## 1. Executive Summary

This plan reorganizes PlatoVue's navigation from 11 top-level tabs into 4 intuitive buckets using progressive disclosure. The goal is to reduce cognitive load while maintaining quick access to all features for power users via a command palette.

---

## 2. Current State Analysis

### 2.1 Existing Top-Level Tabs (11 total)

| Tab ID | Display Name | Primary Purpose |
|--------|--------------|-----------------|
| `control-tower` | Control Tower | Executive command center (default landing) |
| `overview` | Overview | KPIs and high-level metrics |
| `recruiter` | Recruiter Detail | Individual recruiter performance |
| `hm-friction` | HM Friction | Hiring manager latency analysis |
| `hiring-managers` | Hiring Managers | HM scorecard and action queue |
| `capacity` | Capacity | Workload distribution and fit matrix |
| `quality` | Quality Guardrails | Candidate quality metrics |
| `source-mix` | Source Mix | Source ROI analysis |
| `velocity` | Velocity Insights | Pipeline velocity and timing |
| `forecasting` | Forecasting | Pipeline-based hiring predictions |
| `data-health` | Data Health | Data hygiene (zombies, ghosts, TTF) |

### 2.2 Current Pain Points

1. **Cognitive overload**: 11 tabs overwhelm new users
2. **Unclear hierarchy**: Related views scattered (HM Friction + Hiring Managers)
3. **No progressive disclosure**: All complexity visible immediately
4. **Mobile unfriendly**: Tab list truncates on small screens
5. **No quick navigation**: Power users must click through tabs sequentially

---

## 3. Proposed Information Architecture

### 3.1 Four-Bucket Structure

```
┌─────────────────────────────────────────────────────────────────┐
│  [Control Tower]    [Diagnose ▾]    [Plan ▾]    [Settings ▾]   │
└─────────────────────────────────────────────────────────────────┘
        │                  │              │            │
        │                  │              │            │
   Default Landing    Dropdown       Dropdown     Dropdown
   (No submenu)       Submenu        Submenu      Submenu
```

### 3.2 Bucket Definitions

#### Control Tower (Default Landing)
- **Purpose**: Executive command center with health KPIs, risks, actions, forecast
- **URL**: `/` or `/control-tower`
- **Contains**: Single view (no submenu)
- **Philosophy**: "What needs my attention right now?"

#### Diagnose
- **Purpose**: Investigate performance issues and understand current state
- **URL**: `/diagnose/*`
- **Contains**: Views for analyzing what's happening and why
- **Philosophy**: "Help me understand this problem"

#### Plan
- **Purpose**: Forward-looking capacity and pipeline planning
- **URL**: `/plan/*`
- **Contains**: Views for resource allocation and forecasting
- **Philosophy**: "Help me prepare for the future"

#### Settings
- **Purpose**: Configuration, data management, and system health
- **URL**: `/settings/*`
- **Contains**: Data health, AI config, org settings
- **Philosophy**: "Configure and maintain the system"

---

## 4. Complete Tab Mapping

### 4.1 Mapping Table

| Current Tab | New Bucket | New Route | New Display Name | Rationale |
|-------------|------------|-----------|------------------|-----------|
| Control Tower | **Control Tower** | `/` | Command Center | Stays as default landing |
| Overview | **Diagnose** | `/diagnose/overview` | Overview | KPIs are diagnostic |
| Recruiter Detail | **Diagnose** | `/diagnose/recruiter/:id?` | Recruiter Performance | Analyzing recruiter performance |
| HM Friction | **Diagnose** | `/diagnose/hm-friction` | HM Latency | Understanding HM delays |
| Hiring Managers | **Diagnose** | `/diagnose/hiring-managers` | HM Scorecard | Analyzing HM performance |
| Quality | **Diagnose** | `/diagnose/quality` | Quality Guardrails | Understanding candidate quality |
| Source Mix | **Diagnose** | `/diagnose/sources` | Source Effectiveness | Analyzing source ROI |
| Velocity | **Diagnose** | `/diagnose/velocity` | Pipeline Velocity | Understanding timing |
| Capacity | **Plan** | `/plan/capacity` | Capacity Planning | Forward-looking workload |
| Forecasting | **Plan** | `/plan/forecast` | Hiring Forecast | Predicting outcomes |
| Data Health | **Settings** | `/settings/data-health` | Data Health | System maintenance |
| *(new)* | **Settings** | `/settings/ai` | AI Configuration | BYOK key management |
| *(new)* | **Settings** | `/settings/org` | Organization | Org settings from Supabase |

### 4.2 Submenu Structure

```typescript
// Navigation structure definition
const NAV_STRUCTURE = {
  'control-tower': {
    label: 'Command Center',
    icon: 'bi-bullseye',
    route: '/',
    submenu: null
  },
  'diagnose': {
    label: 'Diagnose',
    icon: 'bi-search',
    route: '/diagnose',
    submenu: [
      { id: 'overview', label: 'Overview', route: '/diagnose/overview' },
      { id: 'recruiter', label: 'Recruiter Performance', route: '/diagnose/recruiter' },
      { id: 'hm-friction', label: 'HM Latency', route: '/diagnose/hm-friction' },
      { id: 'hiring-managers', label: 'HM Scorecard', route: '/diagnose/hiring-managers' },
      { id: 'quality', label: 'Quality Guardrails', route: '/diagnose/quality' },
      { id: 'sources', label: 'Source Effectiveness', route: '/diagnose/sources' },
      { id: 'velocity', label: 'Pipeline Velocity', route: '/diagnose/velocity' }
    ]
  },
  'plan': {
    label: 'Plan',
    icon: 'bi-calendar3',
    route: '/plan',
    submenu: [
      { id: 'capacity', label: 'Capacity Planning', route: '/plan/capacity' },
      { id: 'forecast', label: 'Hiring Forecast', route: '/plan/forecast' }
    ]
  },
  'settings': {
    label: 'Settings',
    icon: 'bi-gear',
    route: '/settings',
    submenu: [
      { id: 'data-health', label: 'Data Health', route: '/settings/data-health' },
      { id: 'ai', label: 'AI Configuration', route: '/settings/ai' },
      { id: 'org', label: 'Organization', route: '/settings/org' }
    ]
  }
};
```

---

## 5. Routing Plan

### 5.1 Route Definitions

```typescript
// routes.ts
const routes = [
  // Control Tower (default)
  { path: '/', element: <ControlTowerTab />, exact: true },
  { path: '/control-tower', element: <Navigate to="/" replace /> },

  // Diagnose bucket
  { path: '/diagnose', element: <Navigate to="/diagnose/overview" replace /> },
  { path: '/diagnose/overview', element: <OverviewTab /> },
  { path: '/diagnose/recruiter', element: <RecruiterDetailTab /> },
  { path: '/diagnose/recruiter/:recruiterId', element: <RecruiterDetailTab /> },
  { path: '/diagnose/hm-friction', element: <HMFrictionTab /> },
  { path: '/diagnose/hiring-managers', element: <HiringManagersTab /> },
  { path: '/diagnose/quality', element: <QualityTab /> },
  { path: '/diagnose/sources', element: <SourceMixTab /> },
  { path: '/diagnose/velocity', element: <VelocityInsightsTab /> },

  // Plan bucket
  { path: '/plan', element: <Navigate to="/plan/capacity" replace /> },
  { path: '/plan/capacity', element: <CapacityTab /> },
  { path: '/plan/forecast', element: <ForecastingTab /> },

  // Settings bucket
  { path: '/settings', element: <Navigate to="/settings/data-health" replace /> },
  { path: '/settings/data-health', element: <DataHealthTab /> },
  { path: '/settings/ai', element: <AiSettingsTab /> },
  { path: '/settings/org', element: <OrgSettingsTab /> },

  // Legacy route aliases (redirect old bookmarks)
  { path: '/overview', element: <Navigate to="/diagnose/overview" replace /> },
  { path: '/recruiter', element: <Navigate to="/diagnose/recruiter" replace /> },
  { path: '/hm-friction', element: <Navigate to="/diagnose/hm-friction" replace /> },
  { path: '/hiring-managers', element: <Navigate to="/diagnose/hiring-managers" replace /> },
  { path: '/quality', element: <Navigate to="/diagnose/quality" replace /> },
  { path: '/source-mix', element: <Navigate to="/diagnose/sources" replace /> },
  { path: '/velocity', element: <Navigate to="/diagnose/velocity" replace /> },
  { path: '/capacity', element: <Navigate to="/plan/capacity" replace /> },
  { path: '/forecasting', element: <Navigate to="/plan/forecast" replace /> },
  { path: '/data-health', element: <Navigate to="/settings/data-health" replace /> },

  // 404
  { path: '*', element: <NotFound /> }
];
```

### 5.2 URL Parameter Preservation

When redirecting legacy routes, preserve query parameters:

```typescript
// Example: /recruiter?id=r1 -> /diagnose/recruiter/r1
function LegacyRecruiterRedirect() {
  const [searchParams] = useSearchParams();
  const recruiterId = searchParams.get('id');
  return <Navigate to={`/diagnose/recruiter${recruiterId ? `/${recruiterId}` : ''}`} replace />;
}
```

---

## 6. Navigation Components

### 6.1 TopNav Component

```
┌─────────────────────────────────────────────────────────────────────────┐
│ [Logo] PlatoVue    [Command Center] [Diagnose▾] [Plan▾] [Settings▾]  [?]│
└─────────────────────────────────────────────────────────────────────────┘
```

**Behavior**:
- Buckets with submenus show dropdown on hover (desktop) or click (mobile)
- Active bucket is highlighted
- Active submenu item shown in dropdown

### 6.2 Dropdown Menu Component

```typescript
interface NavDropdownProps {
  label: string;
  icon: string;
  items: Array<{ id: string; label: string; route: string; }>;
  isActive: boolean;
}
```

**States**:
- Default: Label + chevron-down icon
- Hover/Focus: Show dropdown panel
- Active: Highlighted background, checkmark on active item

### 6.3 Mobile Navigation

```
┌─────────────────────────────────────┐
│ [≡]  PlatoVue              [Quick] │
├─────────────────────────────────────┤
│ ▸ Command Center                    │
│ ▸ Diagnose                          │
│   • Overview                        │
│   • Recruiter Performance           │
│   • HM Latency                      │
│   • ...                             │
│ ▸ Plan                              │
│ ▸ Settings                          │
└─────────────────────────────────────┘
```

**Behavior**:
- Hamburger menu toggles full-height drawer
- Buckets expand/collapse to show submenu items
- Tapping item navigates and closes drawer

---

## 7. Quick Find Command Palette

### 7.1 Activation

- **Keyboard**: `Cmd+K` (Mac) / `Ctrl+K` (Windows)
- **UI**: Search icon in header or "Quick" button on mobile

### 7.2 Features

```
┌───────────────────────────────────────────────────────────────┐
│ 🔍 Quick Find...                                         [Esc]│
├───────────────────────────────────────────────────────────────┤
│ NAVIGATION                                                    │
│   → Command Center                           Cmd+1            │
│   → Overview                                 Cmd+2            │
│   → Recruiter Performance                                     │
│                                                               │
│ RECRUITERS                                                    │
│   👤 Alice Chen (12 reqs)                                    │
│   👤 Bob Smith (8 reqs)                                      │
│                                                               │
│ REQUISITIONS                                                  │
│   📋 REQ-123: Senior Engineer                                │
│   📋 REQ-456: Product Manager                                │
└───────────────────────────────────────────────────────────────┘
```

### 7.3 Search Categories

1. **Navigation**: All pages/views (fuzzy match on label)
2. **Recruiters**: Search by name, navigate to `/diagnose/recruiter/:id`
3. **Requisitions**: Search by ID or title, navigate to req detail
4. **Hiring Managers**: Search by name, navigate to HM scorecard with filter
5. **Actions**: Quick actions like "Import Data", "Export Report"

### 7.4 Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `↑` / `↓` | Navigate results |
| `Enter` | Select highlighted item |
| `Esc` | Close palette |
| `Cmd+1` | Go to Command Center |
| `Cmd+2` | Go to Overview |
| `Cmd+3` | Go to Capacity Planning |

---

## 8. Legacy Navigation Toggle

### 8.1 Purpose

Allow users to switch back to the old 11-tab navigation during transition period. Reduces risk of user confusion and provides rollback option.

### 8.2 Implementation

```typescript
// In Settings > Preferences
interface UserPreferences {
  useNewNavigation: boolean; // Default: true after Phase C
}

// Toggle stored in localStorage
const LEGACY_NAV_KEY = 'platovue_use_legacy_nav';
```

### 8.3 UI Location

Settings dropdown includes "Use Classic Navigation" toggle:

```
Settings ▾
├─ Data Health
├─ AI Configuration
├─ Organization
├─────────────────
└─ ☐ Use Classic Navigation
```

### 8.4 Sunset Timeline

- **Phase A-B**: Toggle available, defaults to new navigation
- **Phase C**: Toggle available, prominent "try new nav" banner on classic
- **Phase D**: Remove toggle, migrate all users to new navigation

---

## 9. Layout Standardization

### 9.1 Layout Primitives

#### PageShell

Wrapper component providing consistent page structure:

```typescript
interface PageShellProps {
  children: React.ReactNode;
  className?: string;
}

// Usage
<PageShell>
  <PageHeader ... />
  <StatusBar ... />
  {/* Page content */}
</PageShell>
```

**CSS**:
```css
.page-shell {
  padding: var(--space-4);
  max-width: 1600px;
  margin: 0 auto;
}

@media (max-width: 768px) {
  .page-shell {
    padding: var(--space-2);
  }
}
```

#### PageHeader

Consistent page header with title, description, and optional actions:

```typescript
interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  breadcrumbs?: Array<{ label: string; href?: string }>;
}
```

**Visual**:
```
┌─────────────────────────────────────────────────────────────┐
│ Diagnose > Recruiter Performance                            │
│                                                             │
│ Recruiter Performance                    [Export] [Filter]  │
│ Analyze individual recruiter metrics and pipeline health    │
└─────────────────────────────────────────────────────────────┘
```

#### SectionHeader

Section divider with title and optional expand/collapse:

```typescript
interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  collapsible?: boolean;
  defaultExpanded?: boolean;
  actions?: React.ReactNode;
}
```

#### GlassPanel

Standard content container with glass morphism styling:

```typescript
interface GlassPanelProps {
  children: React.ReactNode;
  className?: string;
  padding?: 'sm' | 'md' | 'lg';
}
```

**CSS** (matches existing `card-bespoke`):
```css
.glass-panel {
  background: rgba(36, 36, 36, 0.8);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: var(--radius-lg);
}
```

#### EmptyState

Consistent empty state for views with no data:

```typescript
interface EmptyStateProps {
  icon: string;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}
```

**Visual**:
```
┌─────────────────────────────────────────┐
│                  📊                     │
│                                         │
│       No recruiter selected             │
│   Select a recruiter from the list      │
│   to view their performance metrics     │
│                                         │
│        [Browse Recruiters]              │
└─────────────────────────────────────────┘
```

### 9.2 Page Skeleton Standard

Every page follows this structure:

```
┌─────────────────────────────────────────────────────────────┐
│ [PageHeader]                                                │
│   Breadcrumbs (if nested)                                   │
│   Title + Description + Actions                             │
├─────────────────────────────────────────────────────────────┤
│ [StatusBar] (optional - shows data context)                 │
│   Data source • Record count • Health score • Last refresh  │
├─────────────────────────────────────────────────────────────┤
│ [Content Sections]                                          │
│   ┌─────────────────────────────────────────────────────┐  │
│   │ [SectionHeader] Key Metrics                         │  │
│   │ [GlassPanel] Metric cards grid                      │  │
│   └─────────────────────────────────────────────────────┘  │
│                                                             │
│   ┌─────────────────────────────────────────────────────┐  │
│   │ [SectionHeader] Details                             │  │
│   │ [GlassPanel] Data table or chart                    │  │
│   └─────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 9.3 View Pattern: Explain / View Evidence / Create Action

All diagnostic views follow this interaction pattern:

1. **Summary View**: High-level metrics and status indicators
2. **Explain**: Click metric → drawer/modal shows breakdown with evidence
3. **View Evidence**: Drill into specific records contributing to metric
4. **Create Action**: Generate action item from evidence (adds to unified queue)

```
[Metric Card: TTF = 45 days]
        │
        ▼ Click "Explain"
┌─────────────────────────────────────────┐
│ Time to Fill Breakdown                  │
│                                         │
│ Applied → Screen: 5 days                │
│ Screen → Interview: 12 days             │
│ Interview → Offer: 18 days              │
│ Offer → Hired: 10 days                  │
│                                         │
│ [View 23 hires] [Create Action]         │
└─────────────────────────────────────────┘
```

---

## 10. Migration Phases

### Phase A: Foundation (Non-Breaking)

**Scope**: Build new components without changing existing behavior

**Tasks**:
1. Create `components/layout/` directory with primitives:
   - `PageShell.tsx`
   - `PageHeader.tsx`
   - `SectionHeader.tsx`
   - `GlassPanel.tsx`
   - `EmptyState.tsx`
2. Create `components/navigation/` directory:
   - `TopNav.tsx` (new 4-bucket nav)
   - `NavDropdown.tsx`
   - `MobileDrawer.tsx`
   - `QuickFind.tsx` (command palette)
3. Create `routes.ts` with all route definitions
4. Add feature flag: `FEATURE_NEW_NAV = false`
5. Write unit tests for all new components

**Exit Criteria**:
- All primitives render correctly in Storybook/tests
- No changes to existing user experience
- Feature flag keeps old nav active

### Phase B: Parallel Navigation

**Scope**: Both navigation systems coexist

**Tasks**:
1. Wrap existing `ProductivityDashboard` tabs in React Router
2. Add legacy route redirects (old URLs → new URLs)
3. Enable feature flag for internal testing
4. Add "Try New Navigation" banner for beta testers
5. Implement localStorage preference for nav choice
6. Add analytics to track nav usage patterns

**Exit Criteria**:
- Users can toggle between old and new nav
- All old bookmarks/links still work via redirects
- No 404s on any previously valid URL
- Analytics show nav preference distribution

### Phase C: Layout Migration

**Scope**: Migrate each tab to use new layout primitives

**Migration Order** (least → most complex):
1. Data Health (simple, low traffic)
2. Overview (read-only KPIs)
3. Source Mix (simple charts)
4. Quality Guardrails (similar to Overview)
5. Velocity Insights (charts + thresholds)
6. HM Friction (moderate complexity)
7. Hiring Managers (action queue integration)
8. Forecasting (What-If complexity)
9. Capacity (Fit Matrix complexity)
10. Recruiter Detail (most complex, many sections)
11. Control Tower (last - default landing)

**Per-Tab Migration**:
1. Create new `Tab.v2.tsx` using layout primitives
2. Add route that renders v2 when feature flag enabled
3. QA test both versions in parallel
4. Once stable, replace original with v2
5. Delete v1 file

**Exit Criteria**:
- All tabs use consistent layout primitives
- Visual regression tests pass
- No functionality lost in migration
- PageHeader breadcrumbs work correctly

### Phase D: Cleanup & Sunset

**Scope**: Remove legacy code and finalize migration

**Tasks**:
1. Remove feature flag (new nav is default)
2. Remove legacy nav toggle from Settings
3. Delete old `ProductivityDashboard` tab switching logic
4. Remove legacy route redirect (after 90 days)
5. Archive old component files
6. Update documentation
7. Remove analytics for nav preference (no longer needed)

**Exit Criteria**:
- Single navigation system
- No dead code
- Documentation updated
- Clean git history with migration commits

---

## 11. Risk Assessment

### Risk 1: User Confusion During Transition

**Severity**: High
**Likelihood**: Medium

**Mitigation**:
- Legacy toggle available throughout Phase B-C
- "What's New" tooltip on first visit
- Help documentation with side-by-side comparison
- Gradual rollout (internal → beta → all users)

**Test**: User testing with 5 existing users during Phase B

### Risk 2: Broken Bookmarks/Links

**Severity**: High
**Likelihood**: Low (with redirects)

**Mitigation**:
- All legacy routes have redirects
- Redirect preserves query parameters
- Analytics track redirect usage to identify popular old URLs
- 90-day grace period before removing redirects

**Test**: Automated test hits all legacy URLs, verifies redirect

### Risk 3: Mobile Navigation Regression

**Severity**: Medium
**Likelihood**: Medium

**Mitigation**:
- Mobile-first design for new nav components
- Dedicated mobile drawer with collapsible sections
- Touch-friendly dropdown menus
- Cross-browser mobile testing (iOS Safari, Chrome Android)

**Test**: Manual testing on iPhone SE, iPad, Android phone

### Risk 4: Performance Degradation

**Severity**: Medium
**Likelihood**: Low

**Mitigation**:
- Code-split each tab route (lazy loading)
- QuickFind uses debounced search
- Dropdown menus use CSS transitions (not JS animation)
- Bundle size monitoring in CI

**Test**: Lighthouse performance score >= 90 after migration

### Risk 5: Accessibility Regression

**Severity**: High
**Likelihood**: Medium

**Mitigation**:
- All nav components use semantic HTML
- Dropdown menus keyboard navigable
- QuickFind supports full keyboard navigation
- ARIA labels on all interactive elements
- Focus management on drawer open/close

**Test**: axe-core automated scan, manual screen reader testing

### Risk 6: Route Conflicts

**Severity**: Medium
**Likelihood**: Low

**Mitigation**:
- Comprehensive route table in this document
- Explicit route ordering (specific before wildcards)
- 404 catch-all as last route
- Integration tests for all routes

**Test**: Route unit tests verify no conflicts

### Risk 7: State Loss on Navigation

**Severity**: High
**Likelihood**: Low

**Mitigation**:
- Dashboard state in context (not component state)
- URL params for filterable state (recruiter ID, date range)
- LocalStorage for preferences
- Navigation doesn't unmount DashboardProvider

**Test**: E2E test: navigate away and back, verify filters preserved

### Risk 8: Quick Find Performance

**Severity**: Low
**Likelihood**: Medium

**Mitigation**:
- Debounce search input (300ms)
- Limit results to 10 per category
- Virtual scrolling if > 100 results
- Memoize search index

**Test**: Performance test with 1000 recruiters, 5000 reqs

### Risk 9: Analytics Data Discontinuity

**Severity**: Low
**Likelihood**: High

**Mitigation**:
- Map old page names to new routes in analytics
- Document route name changes in analytics changelog
- Dual-emit events during transition (old + new names)

**Test**: Verify analytics events fire correctly for all routes

### Risk 10: Incomplete Migration (Stuck in Phase B)

**Severity**: Medium
**Likelihood**: Medium

**Mitigation**:
- Clear exit criteria for each phase
- Weekly migration progress review
- Automated test coverage requirements before phase advancement
- Deadline commitment in project plan

**Test**: Phase checklist with required sign-offs

---

## 12. Test Plan

### 12.1 Unit Tests

**Layout Primitives**:
- `PageShell` renders children with correct padding
- `PageHeader` displays title, description, breadcrumbs, actions
- `SectionHeader` toggles collapse state
- `GlassPanel` applies correct CSS classes
- `EmptyState` renders icon, title, description, action button

**Navigation Components**:
- `TopNav` highlights active bucket
- `NavDropdown` shows/hides on interaction
- `NavDropdown` keyboard navigation (↑/↓/Enter/Esc)
- `MobileDrawer` opens/closes on hamburger click
- `MobileDrawer` navigates and closes on item click
- `QuickFind` filters results on input
- `QuickFind` keyboard navigation
- `QuickFind` navigates on Enter

**Routing**:
- All routes render correct component
- Legacy redirects work with/without query params
- 404 catches unknown routes
- Bucket default routes redirect correctly

### 12.2 Integration Tests

**Navigation Flow**:
- Click through all nav items, verify correct page renders
- Verify breadcrumbs update correctly
- Verify URL updates on navigation
- Verify back/forward browser buttons work

**Quick Find**:
- Search for recruiter by name, verify navigation
- Search for req by ID, verify navigation
- Search for page name, verify navigation

**Legacy Toggle**:
- Toggle to legacy nav, verify old tabs appear
- Toggle back, verify new nav appears
- Verify preference persists across sessions

### 12.3 E2E Tests

**Critical Paths**:
1. Load app → Command Center displays
2. Navigate to Diagnose > Recruiter → Select recruiter → View metrics
3. Navigate to Plan > Capacity → View fit matrix → Click cell → Drawer opens
4. Navigate to Settings > Data Health → View zombie reqs
5. Use Quick Find to navigate directly to recruiter
6. Mobile: Open drawer, navigate to Plan > Forecast

**Regression Tests**:
- All existing E2E tests pass with new navigation
- Data import flow works
- Action queue CRUD operations work
- AI Copilot features work

### 12.4 Visual Regression Tests

**Snapshots**:
- Each page at desktop (1920x1080) and mobile (375x812)
- Navigation dropdown open state
- Mobile drawer open state
- Quick Find with results
- Empty states

### 12.5 Accessibility Tests

**Automated (axe-core)**:
- Run on all pages
- Zero critical/serious violations

**Manual**:
- Full keyboard navigation through nav
- Screen reader announces nav items correctly
- Focus visible on all interactive elements

---

## 13. Acceptance Criteria

### Phase A Complete When:

- [ ] All layout primitive components created and tested
- [ ] All navigation components created and tested
- [ ] Route definitions complete
- [ ] Feature flag implemented and defaults to `false`
- [ ] Unit test coverage > 80% for new components
- [ ] No changes to existing user experience

### Phase B Complete When:

- [ ] React Router integrated with existing app
- [ ] All legacy route redirects implemented
- [ ] Feature flag can be toggled via Settings
- [ ] "Try New Navigation" banner implemented
- [ ] Analytics tracking nav preference
- [ ] All legacy URLs verified working via redirects
- [ ] Internal team using new nav for 1 week without issues

### Phase C Complete When:

- [ ] All 11 tabs migrated to use layout primitives
- [ ] Visual regression tests passing
- [ ] No functionality lost (all features work as before)
- [ ] Breadcrumbs display correctly on all pages
- [ ] Mobile layout tested on iOS and Android
- [ ] Accessibility scan shows zero critical issues
- [ ] Performance score >= 90 on Lighthouse

### Phase D Complete When:

- [ ] Feature flag removed
- [ ] Legacy toggle removed from Settings
- [ ] Legacy route redirects removed (or scheduled for removal)
- [ ] Old navigation code deleted
- [ ] Documentation updated
- [ ] Clean git history (squashed migration commits)
- [ ] Team trained on new architecture

---

## 14. Open Questions

1. **Quick Find scope**: Should Quick Find include candidates, or is that too much?
   - *Recommendation*: Start with nav + recruiters + reqs. Add candidates in v2.

2. **Keyboard shortcuts**: Should we reserve Cmd+1/2/3 for navigation?
   - *Recommendation*: Yes, but make them configurable in Settings.

3. **Settings organization**: Should AI Config and Org Settings be top-level tabs?
   - *Recommendation*: No, keep under Settings to reduce top-level clutter.

4. **Diagnose default**: What's the default view when clicking "Diagnose"?
   - *Recommendation*: Overview (most commonly used diagnostic view).

5. **Plan default**: What's the default view when clicking "Plan"?
   - *Recommendation*: Capacity Planning (primary planning tool).

---

## 15. Appendix

### A. Component File Structure

```
src/productivity-dashboard/
├── components/
│   ├── layout/
│   │   ├── PageShell.tsx
│   │   ├── PageHeader.tsx
│   │   ├── SectionHeader.tsx
│   │   ├── GlassPanel.tsx
│   │   ├── EmptyState.tsx
│   │   └── index.ts
│   ├── navigation/
│   │   ├── TopNav.tsx
│   │   ├── NavDropdown.tsx
│   │   ├── MobileDrawer.tsx
│   │   ├── QuickFind.tsx
│   │   ├── LegacyToggle.tsx
│   │   └── index.ts
│   └── [existing tab components]
├── routes/
│   ├── routes.tsx
│   ├── legacyRedirects.tsx
│   └── index.ts
└── [existing directories]
```

### B. CSS Variables for Layout

```css
:root {
  /* Spacing */
  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 0.75rem;
  --space-4: 1rem;
  --space-6: 1.5rem;
  --space-8: 2rem;

  /* Border radius */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;

  /* Layout */
  --page-max-width: 1600px;
  --header-height: 56px;
  --mobile-drawer-width: 280px;

  /* Z-index layers */
  --z-dropdown: 100;
  --z-drawer: 200;
  --z-modal: 300;
  --z-quickfind: 400;
}
```

### C. Analytics Events

| Event | Properties | Trigger |
|-------|------------|---------|
| `nav_bucket_click` | `bucket`, `from_page` | Click top-level nav bucket |
| `nav_item_click` | `bucket`, `item`, `from_page` | Click submenu item |
| `quickfind_open` | `trigger` (keyboard/click) | Open Quick Find |
| `quickfind_search` | `query`, `results_count` | Search in Quick Find |
| `quickfind_navigate` | `category`, `item_id` | Select Quick Find result |
| `legacy_toggle` | `enabled` | Toggle legacy nav preference |
| `breadcrumb_click` | `level`, `target` | Click breadcrumb link |

---

*End of IA Refactor V1 Plan*
