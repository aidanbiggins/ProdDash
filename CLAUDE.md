# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ProdDash is a React + TypeScript Recruiter Productivity Dashboard for recruitment analytics, hiring manager performance tracking, and capacity planning. Data is imported via CSV and persisted to Supabase.

## Commands

```bash
npm start              # Development server (localhost:3000)
npm run build          # Production build
npm test               # Run Jest tests
npm test -- --watchAll=false  # Single test run (CI mode)
npm run ui:style-audit # Check for UI styling violations
```

## Architecture

### Entry Point Flow
```
src/index.js → App.js → AuthProvider → Router
                                         ↓
                            RecruiterProductivityDashboard (/)
                                         ↓
                         DashboardProvider + DataMaskingProvider
                                         ↓
                              ProductivityDashboard
```

### Main Module: `/src/productivity-dashboard/`

The modern dashboard lives here. Legacy components in `/src/components/` are deprecated.

**State Management**: Context + Reducer pattern in `hooks/useDashboardContext.tsx`
- `DashboardProvider` wraps the app and exposes `useDashboard()` hook
- Actions: `IMPORT_DATA`, `SET_FILTERS`, `SELECT_RECRUITER`, `SET_OVERVIEW`, etc.
- State persists to Supabase via `services/dbService.ts`

**Data Flow**:
```
CSV Upload → csvParser.ts → DashboardState → metricsEngine.ts → Components
                                           → hmMetricsEngine.ts
```

**Services** (business logic in `/services/`):
- `csvParser.ts` - CSV parsing and validation
- `metricsEngine.ts` - Recruiter-level metrics calculations
- `hmMetricsEngine.ts` - Hiring manager analytics
- `stageNormalization.ts` - Maps custom stage names to canonical stages
- `complexityScoring.ts` - Hire complexity scoring algorithm
- `dbService.ts` - Supabase persistence
- `reqHealthService.ts` - Data hygiene: Zombie req detection, Ghost candidate identification, True TTF calculation

**Types** (`/types/`):
- `entities.ts` - Core domain models: `Requisition`, `Candidate`, `Event`, `User`
- `hmTypes.ts` - HM-specific types: `HMRollup`, `HMLatencyMetrics`
- `metrics.ts` - Filter and metric types
- `dataHygieneTypes.ts` - Data health types: `ReqHealthStatus`, `GhostCandidateStatus`, `DataHygieneSummary`

**Tab Components** (`/components/`):
- `ControlTowerTab` - **Default landing page** with executive command center view
- `OverviewTab` - KPIs and high-level metrics
- `RecruiterDetailTab` - Individual recruiter performance
- `HMFrictionTab` - Hiring manager latency analysis
- `HiringManagersTab` - HM scorecard and action queue
- `QualityTab` - Candidate quality metrics
- `SourceEffectivenessTab` - Source ROI analysis
- `DataHealthTab` - Data hygiene: Zombie reqs, Ghost candidates, True TTF vs Raw TTF comparison

### Control Tower (Default Tab)

The Control Tower (`/components/control-tower/`) is the default landing page after data load. It provides an executive command center with four main sections:

**1. Health KPIs** - 5 key indicators with red/yellow/green status:
- Median TTF (target: <45 days)
- Offers count
- Accept Rate (target: >80%)
- Stalled Reqs count
- HM Latency (avg feedback time in days)

**2. Risks** - Top 10 at-risk requisitions with reason labels:
- `zombie` - No activity 30+ days
- `stalled` - No activity 14-30 days
- `pipeline_gap` - Empty candidate pipeline
- `hm_delay` - HM action overdue 3+ days
- `offer_risk` - Candidate in offer stage 7+ days
- `at_risk` - Open 120+ days with <5 candidates

**3. Actions** - Unified queue combining recruiter and HM actions:
- HM actions: Feedback due, Resume review, Decision needed
- Recruiter actions: Source candidates (empty pipeline), Revive or close (zombie reqs)
- Urgency levels: critical (>5d), high (>2d), medium (>0d), low

**4. Forecast** - Pipeline-based hiring predictions:
- Expected hires (probability-weighted from active candidates)
- Gap to goal (open reqs minus expected hires)
- Confidence level (based on req health ratio)

**Dataset Status Bar** - Shows data source info, record counts, health score, unmapped stages, and last refresh time.

**Deep Links** - Clicking items navigates to detailed views (req detail, HM queue, etc.)

### Unified Action Queue

The action queue system (`/types/actionTypes.ts`, `/services/actionQueueService.ts`) consolidates actions from multiple sources into a prioritized, filterable queue:

**ActionItem Type:**
```typescript
interface ActionItem {
  action_id: string;          // Deterministic ID: hash(owner_type + owner_id + req_id + action_type)
  owner_type: 'RECRUITER' | 'HIRING_MANAGER' | 'TA_OPS';
  owner_id: string;
  owner_name: string;
  req_id: string;             // 'general' for portfolio-level actions
  action_type: ActionType;    // FEEDBACK_DUE, REVIEW_STALLED_REQS, SOURCE_CANDIDATES, etc.
  title: string;
  priority: 'P0' | 'P1' | 'P2';  // P0=blocking, P1=risk, P2=optimization
  due_in_days: number;
  due_date: Date;
  evidence: ActionEvidence;   // Links back to Explain provider
  recommended_steps: string[];
  status: 'OPEN' | 'DONE' | 'DISMISSED';
}
```

**Action Sources:**
1. **HM Queue** (`generateActionsFromHMQueue`): Maps `HMPendingAction` to `ActionItem`
   - Priority based on days overdue: >3d = P0, >0d = P1, else P2
2. **Explain Engine** (`generateActionsFromExplain`): Maps `RecommendedAction` from all 5 providers
   - high → P0, medium → P1, low → P2

**Deduplication:** Same owner_type + owner_id + req_id + action_type keeps highest priority action.

**Persistence:** localStorage keyed by `proddash_action_states_{datasetId}`:
- `saveActionState(datasetId, actionId, status)` - Marks action as DONE/DISMISSED
- `loadActionStates(datasetId)` - Loads persisted states
- `applyPersistedStates(actions, datasetId)` - Applies stored states to generated actions

**UI Components:**
- `UnifiedActionQueue` - Filter tabs (All | Recruiter | HM | Ops) with action list
- `ActionDetailDrawer` - Action detail with evidence linking and Mark Done/Dismiss buttons

### Key Patterns

**Canonical Stages**: Raw stage names from CSV are normalized via `stageNormalization.ts` to `CanonicalStage` enum values (LEAD, APPLIED, SCREEN, HM_SCREEN, ONSITE, FINAL, OFFER, HIRED, REJECTED, WITHDRAWN).

**Fact Tables**: Services create enriched/denormalized records (`ReqFact`, `CandidateFact`, `EventFact`) for efficient metric computation.

**Imports**: `tsconfig.json` sets `baseUrl: "src"`, so imports use absolute paths from src (e.g., `import { X } from 'productivity-dashboard/types'`).

### Authentication

Supabase auth with dev bypass: set `localStorage.setItem('dev-auth-bypass', JSON.stringify({user: {id: 'dev', email: 'dev@test.com'}}))` to skip login during development.

### Styling

Technical Editorial dark theme in `dashboard-theme.css`. Uses Bootstrap 5.3 as base with dark mode overrides.
- Base: #1a1a1a (Deep Charcoal), Surface: #242424
- Primary accent: #d4a373 (Muted Copper), Secondary: #2dd4bf (Electric Teal)
- Fonts: Cormorant Garamond (headers), Space Mono (data/metrics), Inter (UI)

### UI Primitives & Design System

Centralized UI components live in `/components/common/`. Use these instead of inline styling:

**Typography Primitives:**
- `StatLabel` - KPI labels (uppercase, secondary color, 0.6875rem)
- `StatValue` - KPI values (monospace, bold, 2.25rem), supports `size` and `color` props

**Layout Primitives:**
- `PageHeader` - Page-level title + subtitle + actions
- `SectionHeader` - Section title + optional badge + actions (use instead of raw `<h3>`)
- `GlassPanel` - Glass container with blur, supports `elevated` and `padding` props

**Interactive Primitives:**
- `InlineHelp` - Info icon with tooltip or collapsible text
- `KPICard` - Full KPI card with trend, prior period comparison

**UI Style Audit:**
```bash
npm run ui:style-audit  # Check for styling violations
```

The audit script (`scripts/ui-style-audit.js`) scans for:
1. Inline `style={{...}}` with typography props (`fontSize`, `fontWeight`, `letterSpacing`, `lineHeight`) outside allowed components
2. Raw `<h1>/<h2>/<h3>` usage outside `PageHeader`/`SectionHeader`
3. `.stat-label`/`.stat-value` class definitions outside `dashboard-theme.css`

Run `npm run ui:style-audit` alongside tests to catch styling drift early.

### Data Hygiene Engine

The `reqHealthService.ts` provides data quality filtering to get accurate metrics from noisy legacy data:

**Req Health Status:**
- `ACTIVE` - Normal, healthy requisition
- `STALLED` - No candidate activity in 14-30 days (Yellow)
- `ZOMBIE` - No activity in 30+ days (Red) - excluded from TTF by default
- `AT_RISK` - Open 120+ days with fewer than 5 candidates

**Ghost Candidates:** Candidates stuck in a stage for 10+ days without action (STAGNANT) or 30+ days (ABANDONED)

**True TTF:** Time-to-fill calculated excluding zombie reqs, giving accurate performance metrics.

### Canonical Data Layer

The `canonicalDataLayer.ts` provides decision-grade data ingestion with full traceability:

**Config Files** (`/config/`):
- `column_map.yaml` - Maps source columns to canonical fields with synonyms
- `status_map.yaml` - Maps iCIMS status values to canonical stages and terminal states

**Canonical Tables:**
- `reqs_canonical` - Requisitions with source tracing and confidence metadata
- `candidates_canonical` - Candidates with normalized sources
- `applications_canonical` - Candidate+Req combinations (primary fact table)
- `events_canonical` - Stage changes (actual or synthetic from timestamps)

**Source Tracing:** Every record includes `source_trace` with `source_file`, `source_row_id`, `ingested_at`

**Confidence Grading:** Records have `confidence` metadata with `grade` (high/medium/low/inferred), `reasons`, and `inferred_fields`

**Data Quality Report (`data_quality_report.json`):**
- Missingness stats per field
- Duplicate detection and resolution
- Orphan rates (applications without reqs)
- Unmapped statuses with sample traces
- Overall quality score (0-100)

**Metric Inspector:** `getMetric(metric_name, filters)` returns:
- `value` - Calculated metric value
- `definition` - Formula and aggregation method
- `exclusions` - What was excluded and why
- `confidence_grade` - How reliable the metric is
- `sample_source_traces` - Traceable back to source rows

**Report Type Detection:** Auto-detects `icims_submittal`, `icims_requisition`, `icims_activity`, or `generic_ats` formats

**Audit Log:** Captures rows in/out per step, dropped rows with reason codes, merges, and inferred values

**Terminal Timestamps:** Terminal event timestamps (`hired_at`, `rejected_at`, `withdrawn_at`) are NEVER fabricated:
- `hired_at` - Only populated from explicit "Hire/Rehire Date" column in CSV
- `rejected_at` - Only populated from "Rejection Date" / "Date Rejected" columns
- `withdrawn_at` - Only populated from "Withdrawn Date" / "Withdrawal Date" columns
- When terminal disposition exists but no timestamp column found, `MISSING_TERMINAL_TIMESTAMP` is logged to audit and confidence is downgraded to 'medium'

### Strict Timestamp Policy

**CRITICAL: Data cannot lie. All timestamps are STRICT - never fabricated.**

**Core Principles:**
1. **No Fallback Dates** - If a timestamp is missing in the source CSV, the value MUST be `null`. Never use `new Date()` as a default.
2. **Null Propagation** - When a required date is null, derived metrics must also be null (not 0, not inferred).
3. **UI Graceful Handling** - Display "N/A" or "--" for null dates, never crash or show misleading values.

**`explainTimeToOffer` Function:**
- **Math Invariant**: `(applied_to_first_interview) + (first_interview_to_offer)` MUST equal `total_days`
- Tolerance: 1 day deviation (due to rounding)
- If sum deviates by >1 day, flagged as `math_invariant_error`
- Returns `null` if intermediate steps (`first_contacted_at`) are missing - cannot compute breakdown without interview date

**Timestamp Fields That Must Never Be Fabricated:**
- `applied_at` - From "Applied Date" / source submission columns
- `first_contacted_at` - From "Date First Interviewed: *" columns
- `offer_sent_at` - From "Date First Interviewed: Offer Letter"
- `hired_at` - From "Hire/Rehire Date" only
- `rejected_at` - From "Rejection Date" / "Date Rejected"
- `withdrawn_at` - From "Withdrawn Date" / "Withdrawal Date"
- `opened_at` - From "Date Opened" / "Open Date"
- `current_stage_entered_at` - From stage event timestamps

**Edge Cases:**
- Candidate with Offer but no Interview date: Returns `null` metrics, not 0 days
- Negative duration (offer before application): Excluded from metrics, flagged as data error
- Missing terminal timestamp: Confidence downgraded, `MISSING_TERMINAL_TIMESTAMP` in audit log

### Velocity Insights Thresholds

The Velocity Insights tab (`/components/velocity-insights/`) uses explicit minimum sample thresholds to prevent misleading metrics from insufficient data. The `velocityThresholds.ts` service provides:

**Minimum Sample Thresholds:**
- `MIN_OFFERS_FOR_DECAY = 10` - Candidate offer decay curve requires 10+ offers
- `MIN_HIRES_FOR_FAST_VS_SLOW = 10` - Fast vs slow cohort comparison requires 10+ hires
- `MIN_DENOM_FOR_PASS_RATE = 5` - Any percentage calculation requires 5+ in denominator
- `MIN_REQS_FOR_REQ_DECAY = 10` - Req decay analysis requires 10+ reqs
- `MIN_BUCKET_SIZE_FOR_CHART = 3` - Decay chart data points require 3+ per bucket

**0/0 Handling:**
- `safeRate(0, 0)` returns `null` value and `'—'` display (never 0% or 100%)
- `safeRate(n, 0)` where n > 0 returns `'Invalid data'` with console warning
- `formatRate()` returns `'Insufficient data'` when below threshold

**Confidence Levels:** `calculateConfidence(sampleSize, threshold, context)` returns:
- `INSUFFICIENT` - Below threshold (metric not shown)
- `LOW` - Meets threshold but barely
- `MED` - 1.5x threshold
- `HIGH` - 2x threshold or more

**Stage Timing Capability:** `detectStageTimingCapability()` determines if stage duration charts can be shown:
- `SNAPSHOT_DIFF` - Can show stage durations (has from/to stage events)
- `TIMESTAMP_ONLY` - Cannot show durations (only current_stage_entered_at)
- `NONE` - No stage timing data available

**UI Components:**
- `LimitedDataBanner` - Shows at top when sections have insufficient data
- `ChartFooter` - Shows data window, sample size (n), and confidence badge
- `ConfidenceBadge` - Color-coded badge (HIGH=green, MED=yellow, LOW=gray)

### AI BYOK Integration

The AI Copilot feature provides AI-powered summaries and draft messages using a BYOK (Bring Your Own Key) architecture.

**Services:**
- `aiService.ts` - Routes AI requests through Supabase Edge Function (LLM proxy)
- `aiCopilotService.ts` - AI-powered features (Explain Summary, Draft Message) with PII redaction
- `vaultCrypto.ts` - Zero-knowledge encryption for API keys (PBKDF2 + AES-GCM)
- `userAiVaultService.ts` - Supabase CRUD for encrypted key vault

**Key Types** (`types/aiTypes.ts`):
- `AiProvider`: 'openai' | 'anthropic' | 'gemini' | 'openai_compatible'
- `AiProviderConfig`: Provider, model, API key, and settings
- `AiKeyStorageMode`: 'memory' (default) | 'vault' (cross-device sync)

**AI Key Vault (Zero-Knowledge):**
```
User enters API key → Client encrypts with passphrase (PBKDF2 + AES-GCM)
    → Encrypted blob stored in Supabase (user_ai_vault table)
    → Server NEVER sees plaintext keys
    → User unlocks vault with passphrase on any device → Keys decrypted in memory
```

**Vault Table:** `user_ai_vault`
- `user_id`, `provider`, `encrypted_blob`, `updated_at`
- RLS: Users can only access their own rows
- Unique constraint: (user_id, provider)

**Encrypted Blob Structure:**
```json
{
  "ciphertext": "<base64>",
  "iv": "<base64>",
  "salt": "<base64>",
  "kdf": { "alg": "pbkdf2", "iterations": 100000, "hash": "SHA-256" },
  "alg": { "name": "aes-gcm" }
}
```

**Important Security Properties:**
- Passphrase is NEVER stored (not even hashed) - user must remember it
- If passphrase is forgotten, user must re-enter API keys (no recovery)
- Decrypted keys live in React state memory only - cleared on page close
- PII is redacted before sending to AI providers (names replaced with placeholders)

**Mobile Workflow:**
1. Configure AI keys on desktop, save to vault with passphrase
2. Log in on mobile device
3. Open AI Settings, enter passphrase to unlock vault
4. Keys are decrypted in memory, AI features work

**Components:**
- `AiProviderSettings.tsx` - Modal with storage mode toggle, vault lock/unlock UI
- `VaultLockedBanner` - Banner shown when vault has keys but is locked
- `useAiVault` hook - Manages vault state and operations
