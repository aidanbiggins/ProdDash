# Security and Correctness TODO

**Last updated:** 2026-01-26

---

## NO_FABRICATED_TIMESTAMPS_V1 (C1–C4)

- [x] **C1: dbService opened_at null -> 1970 bug** - Fixed `new Date(r.opened_at)` to check null first. Added unit test in `dbServiceTimestamps.test.ts`.
- [x] **C2: eventGeneration rejected/withdrawn fallback** - Removed `|| new Date()` fallback. Events with missing timestamps are now skipped and tracked in `stats.skippedCandidates`.
- [x] **C3: forecastingService role health 'now' fallbacks** - Changed `daysOpen`, `daysSinceActivity`, `paceVsBenchmark` to return `null` when insufficient data. Updated helper functions to handle null.
- [x] **C4: audit || new Date()** - Reviewed all usages. Removed forbidden usages in `ForecastingTab.tsx` calibration (now requires both `opened_at` AND `closed_at`). Kept allowed UI/render timestamps.

---

## UI_GATES_CLEANUP_V1 (U1–U2)

- [x] **U1: npm run ui:no-bootstrap** - Replaced `flex-shrink-0` → `shrink-0` in 11 files. Updated audit script to exclude Radix UI CSS variables (`--radix-dropdown-menu-trigger-width`). Files: FilterBar.tsx, UltimateDemoModal.tsx, AiProviderSettings.tsx, AskPlatoVueTabV2.tsx, CommandCenterV2.tsx, OverviewTabV2.tsx, BottleneckPanelV2.tsx, HMFrictionTabV2.tsx, no-bootstrap-audit.js.
- [x] **U2: npm run ui:style-audit** - Added V2 components to allowlists in ui-style-audit.js (ALLOWED_TYPOGRAPHY_FILES, ALLOWED_HEADER_FILES, ALLOWED_COLOR_FILES). Added: AppLayoutV2.tsx, AppSidebar.tsx, AskPlatoVueTabV2.tsx, AskPlatoVueV2.tsx, BottleneckPanelV2.tsx, CommandCenterV2.tsx, DiagnoseTabV2.tsx, FilterBarV2.tsx, HiringManagersTabV2.tsx, HMFrictionTabV2.tsx, KPICardV2.tsx, OverviewTabV2.tsx, PipelineFunnelV2.tsx, PlanTabV2.tsx, RecruiterDetailTabV2.tsx, RequisitionsTableV2.tsx, SettingsTabV2.tsx, TeamCapacityPanelV2.tsx, TopNavV2.tsx, PipelineChartV2.tsx, DataCoveragePanel.tsx, AiProviderSettings.tsx.

---

## BUILD_HYGIENE_V1 (B1–B2)

- [x] **B1: @babel/plugin-proposal-private-property-in-object** - Added `@babel/plugin-proposal-private-property-in-object@^7.21.11` to devDependencies. Build no longer shows the deprecation warning.
- [x] **B2: React runtime/types mismatch** - Aligned types with React 18 runtime. Changed `@types/react` from `^19.2.7` → `^18.3.20` and `@types/react-dom` from `^19.2.3` → `^18.3.7`. Fixed ref type compatibility in `useScrollAnimations.ts` (RefObject → MutableRefObject) and `FeaturesSection.tsx`. Final versions: react@^18.2.0, react-dom@^18.2.0, @types/react@^18.3.20, @types/react-dom@^18.3.7.

---

## Authentication & Authorization

- [ ] Auth bypass mode disabled in production builds
- [ ] Service role key tripwire prevents non-localhost usage
- [ ] JWT tokens validated on all protected routes
- [ ] Session expiry handled gracefully
- [ ] Super admin check enforced at app layer (not just RLS)
- [ ] Role-based access control verified for all mutations

## Row Level Security (RLS)

- [ ] All tables have RLS enabled
- [ ] All tables have GRANT statements for authenticated role
- [ ] No circular dependencies in RLS helper functions
- [ ] User-owned data uses `auth.uid() = user_id` pattern
- [ ] Org-owned data uses `user_org_ids()` helper pattern
- [ ] Policies tested with non-admin user
- [ ] Migrations applied to production (CI/CD verified)

## API Keys & Secrets

- [ ] Supabase anon key is safe for client exposure
- [ ] Service role key never exposed to client in production
- [ ] AI BYOK keys encrypted with zero-knowledge pattern
- [ ] API keys not logged or included in error messages
- [ ] Environment variables validated at startup

## Data Integrity

- [ ] CSV parsing validates required fields
- [ ] Duplicate records detected and handled
- [ ] Orphan records identified (candidates without reqs)
- [x] Terminal timestamps never fabricated *(C1-C4 fixes)*
- [ ] Metric calculations have math invariant checks
- [ ] Data quality score computed and displayed

## Input Validation

- [ ] CSV uploads sanitized before processing
- [ ] User inputs escaped before display (XSS prevention)
- [ ] SQL injection prevented via parameterized queries
- [ ] File upload types restricted
- [ ] File size limits enforced

## Client-Side Security

- [ ] No secrets in localStorage except encrypted blobs
- [ ] PII redacted before sending to AI providers
- [ ] Sensitive data cleared on logout
- [ ] No sensitive data in URL parameters
- [ ] Error messages don't leak internal details

## Correctness

- [ ] All metric formulas documented
- [ ] Sample size thresholds enforced (no misleading stats)
- [x] Null propagation for missing timestamps *(C1-C4 fixes)*
- [ ] Stage normalization handles all edge cases
- [ ] Confidence grades reflect actual data quality
- [ ] Audit trail captures all data transformations

## Testing

- [ ] Unit tests for critical metric calculations
- [ ] RLS smoke tests for permission errors
- [ ] Auth flow tested with real Supabase
- [ ] CSV parser tested with malformed input
- [ ] UI displays gracefully with null/missing data

## Infrastructure

- [ ] HTTPS enforced in production
- [ ] CORS configured correctly
- [ ] Rate limiting on sensitive endpoints
- [ ] Error monitoring configured
- [ ] Database backups enabled

---

## Decisions Needed

### D0: Immediate Blockers

_Decision:_
_Owner:_
_Status:_

### D1: Architecture Choices

_Decision:_
_Owner:_
_Status:_

### D2: Future Considerations

_Decision:_
_Owner:_
_Status:_

---

## Audit History

| Date | Auditor | Sections Reviewed | Findings |
|------|---------|-------------------|----------|
| 2026-01-26 | Initial creation | All | Checklist created |
