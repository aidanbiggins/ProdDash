# Explain Engine Implementation Plan

## Overview

The Explain Engine provides transparent, auditable explanations for KPI metrics in PlatoVue. Starting with the 5 Health KPIs in Control Tower, each KPI card gets an "Explain" button that opens a drawer showing:
- What the metric measures
- How it was calculated (formula)
- What data was included/excluded
- Confidence/gating information

## V1 Scope

### In Scope
- 5 Health KPI providers:
  1. **Median TTF** - Time to fill calculation
  2. **HM Latency** - Average hiring manager feedback time
  3. **Stalled Reqs** - Count of stalled/zombie requisitions
  4. **Offer Accept Rate** - Offer acceptance percentage
  5. **Time to Offer** - Time from application to offer
- One shared `Explanation` contract type
- One shared `ExplainDrawer` UI component
- Explain buttons on Control Tower Health KPI cards
- Gating rules for blocked/incomplete data states

### Out of Scope (Non-Goals)
- LLM-generated explanations
- Changes to forecasting logic
- New data ingestion pipelines
- Historical snapshot comparisons
- Drill-down navigation from drawer
- Export functionality from drawer
- Explanations for non-Health KPIs (Risks, Actions, Forecast sections)
- Real-time metric recalculation in drawer

---

## Explanation Contract

### TypeScript Type Definition

```typescript
// src/productivity-dashboard/types/explainTypes.ts

/**
 * Status of an explanation - determines UI rendering
 */
export type ExplanationStatus = 'ready' | 'blocked' | 'partial';

/**
 * Reason why an explanation is blocked
 */
export interface BlockedReason {
  code: string;           // Machine-readable code (e.g., 'MISSING_HIRED_AT')
  message: string;        // User-friendly message
  field?: string;         // Optional: which field is problematic
  sampleCount?: number;   // Optional: how many records affected
}

/**
 * A single data point contributing to the metric
 */
export interface ContributingRecord {
  id: string;             // req_id or candidate_id
  label: string;          // Display label (e.g., "Software Engineer - NYC")
  value: number | null;   // The value this record contributed
  included: boolean;      // Whether it was included in calculation
  excludeReason?: string; // If excluded, why
}

/**
 * Core explanation contract - returned by all providers
 */
export interface Explanation {
  // === Required Fields ===
  metricId: string;                    // Unique metric identifier (e.g., 'median_ttf')
  metricLabel: string;                 // Human-readable label (e.g., 'Median Time to Fill')
  status: ExplanationStatus;           // ready | blocked | partial

  // === Value & Formula (required when status !== 'blocked') ===
  value: string | number | null;       // The computed value (null if blocked)
  unit: string;                        // Unit of measurement (e.g., 'days', '%', 'count')
  formula: string;                     // Human-readable formula
  formulaCode?: string;                // Optional: code-level formula for technical users

  // === Data Context (required) ===
  dateRange: {
    start: Date;
    end: Date;
  };
  filters: string[];                   // Active filters as readable strings

  // === Inclusion/Exclusion Stats (required) ===
  includedCount: number;               // Records included in calculation
  excludedCount: number;               // Records excluded
  exclusionReasons: Array<{
    reason: string;
    count: number;
  }>;

  // === Optional Fields ===
  blockedReasons?: BlockedReason[];    // Why metric is blocked (when status === 'blocked')
  confidenceGrade?: 'high' | 'medium' | 'low';  // Data confidence
  confidenceNote?: string;             // Explanation of confidence grade
  benchmark?: {
    value: number;
    label: string;                     // e.g., "Target", "Industry Average"
  };
  sampleRecords?: ContributingRecord[]; // First N contributing records (max 10)

  // === Timestamps ===
  computedAt: Date;                    // When this explanation was generated
}

/**
 * Provider registration type
 */
export type ExplainProviderId =
  | 'median_ttf'
  | 'hm_latency'
  | 'stalled_reqs'
  | 'offer_accept_rate'
  | 'time_to_offer';
```

---

## Provider Interface

### Provider Contract

```typescript
// src/productivity-dashboard/services/explain/types.ts

import { Explanation, ExplainProviderId } from '../../types/explainTypes';
import { Requisition, Candidate, Event, User } from '../../types/entities';
import { MetricFilters, OverviewMetrics, HiringManagerFriction } from '../../types/metrics';
import { DashboardConfig } from '../../types/config';

/**
 * Data context passed to all providers
 */
export interface ExplainContext {
  requisitions: Requisition[];
  candidates: Candidate[];
  events: Event[];
  users: User[];
  filters: MetricFilters;
  config: DashboardConfig;
  overview: OverviewMetrics | null;
  hmFriction: HiringManagerFriction[];
}

/**
 * Provider interface - each KPI implements this
 */
export interface ExplainProvider {
  id: ExplainProviderId;

  /**
   * Check if provider can generate explanation with current data
   * Returns blocked reasons if data is insufficient
   */
  canExplain(context: ExplainContext): BlockedReason[];

  /**
   * Generate the explanation
   * Should only be called if canExplain returns empty array
   */
  explain(context: ExplainContext): Explanation;
}
```

### Provider Registry

```typescript
// src/productivity-dashboard/services/explain/providerRegistry.ts

import { ExplainProvider, ExplainProviderId, ExplainContext } from './types';
import { Explanation, BlockedReason } from '../../types/explainTypes';

// Provider implementations
import { MedianTTFProvider } from './providers/medianTTFProvider';
import { HMLatencyProvider } from './providers/hmLatencyProvider';
import { StalledReqsProvider } from './providers/stalledReqsProvider';
import { OfferAcceptRateProvider } from './providers/offerAcceptRateProvider';
import { TimeToOfferProvider } from './providers/timeToOfferProvider';

const providers: Map<ExplainProviderId, ExplainProvider> = new Map([
  ['median_ttf', new MedianTTFProvider()],
  ['hm_latency', new HMLatencyProvider()],
  ['stalled_reqs', new StalledReqsProvider()],
  ['offer_accept_rate', new OfferAcceptRateProvider()],
  ['time_to_offer', new TimeToOfferProvider()],
]);

/**
 * Get explanation for a metric
 */
export function getExplanation(
  providerId: ExplainProviderId,
  context: ExplainContext
): Explanation {
  const provider = providers.get(providerId);

  if (!provider) {
    throw new Error(`Unknown explain provider: ${providerId}`);
  }

  const blockedReasons = provider.canExplain(context);

  if (blockedReasons.length > 0) {
    return createBlockedExplanation(providerId, blockedReasons, context);
  }

  return provider.explain(context);
}

function createBlockedExplanation(
  metricId: ExplainProviderId,
  blockedReasons: BlockedReason[],
  context: ExplainContext
): Explanation {
  const labels: Record<ExplainProviderId, string> = {
    median_ttf: 'Median Time to Fill',
    hm_latency: 'HM Latency',
    stalled_reqs: 'Stalled Requisitions',
    offer_accept_rate: 'Offer Accept Rate',
    time_to_offer: 'Time to Offer',
  };

  return {
    metricId,
    metricLabel: labels[metricId],
    status: 'blocked',
    value: null,
    unit: '',
    formula: '',
    dateRange: {
      start: context.filters.dateRange.startDate,
      end: context.filters.dateRange.endDate,
    },
    filters: [], // TODO: format active filters
    includedCount: 0,
    excludedCount: 0,
    exclusionReasons: [],
    blockedReasons,
    computedAt: new Date(),
  };
}
```

---

## Data Dependencies Per Provider

### 1. Median TTF Provider

**Required Fields:**
- `requisitions[].opened_at` - Req open date (STRICT: must exist)
- `candidates[].hired_at` - Hire date (STRICT: must exist for TTF calc)
- `candidates[].req_id` - Links candidate to req

**Gating Rules:**
| Condition | Result |
|-----------|--------|
| No hires in date range | status: `blocked`, code: `NO_HIRES_IN_RANGE` |
| All hires missing `hired_at` | status: `blocked`, code: `MISSING_HIRED_AT` |
| All reqs missing `opened_at` | status: `blocked`, code: `MISSING_OPENED_AT` |
| <3 valid TTF values | status: `partial`, confidenceGrade: `low` |
| Some hires excluded (negative TTF) | note in `exclusionReasons` |

**Exclusion Reasons:**
- `ZOMBIE_REQ` - Req marked as zombie (30+ days no activity)
- `NEGATIVE_TTF` - Hired before req opened (data error)
- `MISSING_TIMESTAMP` - Missing opened_at or hired_at

### 2. HM Latency Provider

**Required Fields:**
- `hmFriction[].feedbackLatencyMedian` - Feedback latency per HM
- `hmFriction[].hmId` - HM identifier

**Gating Rules:**
| Condition | Result |
|-----------|--------|
| No HM friction data | status: `blocked`, code: `NO_HM_DATA` |
| All HMs have null latency | status: `blocked`, code: `NO_FEEDBACK_EVENTS` |
| <3 HMs with data | status: `partial`, confidenceGrade: `low` |

**Exclusion Reasons:**
- `NO_INTERVIEWS` - HM has no interview events
- `NO_FEEDBACK` - Interviews exist but no feedback submitted

### 3. Stalled Reqs Provider

**Required Fields:**
- `requisitions[].status` - Must be 'Open'
- `requisitions[].opened_at` - For age calculation
- `events[]` - For last activity detection
- `candidates[]` - For active candidate count

**Gating Rules:**
| Condition | Result |
|-----------|--------|
| No open requisitions | status: `blocked`, code: `NO_OPEN_REQS` |
| overview is null | status: `blocked`, code: `NO_OVERVIEW_DATA` |

**Exclusion Reasons:**
- N/A - This is a count metric, no exclusions apply

### 4. Offer Accept Rate Provider

**Required Fields:**
- `candidates[].offer_extended_at` - Offer date
- `candidates[].offer_accepted_at` - Accept date (may be null)
- `candidates[].disposition` - For determining declined/withdrawn

**Gating Rules:**
| Condition | Result |
|-----------|--------|
| No offers in date range | status: `blocked`, code: `NO_OFFERS_IN_RANGE` |
| <3 offers | status: `partial`, confidenceGrade: `low` |

**Exclusion Reasons:**
- `OFFER_PENDING` - Offer extended but no response yet
- `OUTSIDE_DATE_RANGE` - Offer extended outside filter range

### 5. Time to Offer Provider

**Required Fields:**
- `candidates[].applied_at` OR `candidates[].first_contacted_at` - Start date
- `candidates[].offer_extended_at` - End date

**Gating Rules:**
| Condition | Result |
|-----------|--------|
| No offers in date range | status: `blocked`, code: `NO_OFFERS_IN_RANGE` |
| All offers missing start date | status: `blocked`, code: `MISSING_APPLICATION_DATE` |
| <3 valid time-to-offer values | status: `partial`, confidenceGrade: `low` |

**Exclusion Reasons:**
- `MISSING_START_DATE` - No applied_at or first_contacted_at
- `NEGATIVE_DURATION` - Offer before application (data error)

---

## Gating and Blocked-State Rules

### Gating Philosophy

1. **Fail Closed**: If required data is missing, show "Blocked" - never fabricate
2. **Partial is OK**: If some data exists but quality is low, show with warning
3. **Transparent Exclusions**: Always show what was excluded and why

### Blocked State UI Behavior

When `status === 'blocked'`:
- Value displays as "--" or "N/A"
- Drawer shows blocked reasons prominently
- No sample records displayed
- Clear call-to-action for data remediation

### Blocked Reason Codes (Complete List)

| Code | Message | Providers |
|------|---------|-----------|
| `NO_HIRES_IN_RANGE` | No hires recorded in the selected date range | median_ttf |
| `NO_OFFERS_IN_RANGE` | No offers extended in the selected date range | offer_accept_rate, time_to_offer |
| `NO_OPEN_REQS` | No open requisitions found | stalled_reqs |
| `NO_HM_DATA` | No hiring manager data available | hm_latency |
| `NO_FEEDBACK_EVENTS` | No interview feedback events recorded | hm_latency |
| `NO_OVERVIEW_DATA` | Overview metrics not computed | stalled_reqs |
| `MISSING_HIRED_AT` | Hire dates missing from candidate records | median_ttf |
| `MISSING_OPENED_AT` | Open dates missing from requisition records | median_ttf |
| `MISSING_APPLICATION_DATE` | Application dates missing from candidate records | time_to_offer |
| `INSUFFICIENT_DATA` | Fewer than 3 records available | all |

---

## UI Pattern

### Explain Button Placement

The Explain button appears on each Health KPI card in Control Tower:

```
┌─────────────────────────────────────┐
│ Median TTF                    [?]   │  <- [?] is Explain button
│ ┌─────────────┐                     │
│ │    42d      │  Target: <45 days   │
│ └─────────────┘                     │
│ ● GREEN                             │
└─────────────────────────────────────┘
```

Button style: Icon-only button with `bi-question-circle` icon, positioned in card header.

### ExplainDrawer Layout

The drawer slides in from the right side (Bootstrap offcanvas pattern):

```
┌──────────────────────────────────────────────────┐
│ [×]  Explain: Median Time to Fill                │
├──────────────────────────────────────────────────┤
│                                                  │
│  VALUE                                           │
│  ┌────────────────────┐                          │
│  │       42d          │ ● vs Target: 45d         │
│  └────────────────────┘                          │
│                                                  │
│  FORMULA                                         │
│  ┌────────────────────────────────────────────┐  │
│  │ median(hired_at - opened_at)               │  │
│  │ for all hires in date range                │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│  DATA INCLUDED                                   │
│  23 hires included                               │
│  5 excluded:                                     │
│    • 3 zombie reqs                               │
│    • 2 negative TTF (data error)                 │
│                                                  │
│  CONFIDENCE: High                                │
│  Based on 23 data points                         │
│                                                  │
│  ─────────────────────────────────────────────   │
│                                                  │
│  SAMPLE RECORDS (first 10)                       │
│  ┌──────────────────────────────────────────┐   │
│  │ Req Title            │ TTF  │ Status     │   │
│  │ Software Engineer    │ 35d  │ ✓ included │   │
│  │ Product Manager      │ 52d  │ ✓ included │   │
│  │ Data Analyst         │ --   │ ✗ zombie   │   │
│  └──────────────────────────────────────────┘   │
│                                                  │
│  Date Range: Jan 1 - Mar 31, 2024               │
│  Filters: Engineering, L5+                       │
│                                                  │
└──────────────────────────────────────────────────┘
```

### Blocked State Drawer

```
┌──────────────────────────────────────────────────┐
│ [×]  Explain: Median Time to Fill                │
├──────────────────────────────────────────────────┤
│                                                  │
│  ⚠️ BLOCKED                                      │
│                                                  │
│  This metric cannot be calculated because:       │
│                                                  │
│  ┌────────────────────────────────────────────┐  │
│  │ ⊘ NO_HIRES_IN_RANGE                        │  │
│  │   No hires recorded in the selected        │  │
│  │   date range (Jan 1 - Mar 31, 2024)        │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│  To resolve:                                     │
│  • Expand the date range                         │
│  • Check if hire dates are being imported        │
│                                                  │
└──────────────────────────────────────────────────┘
```

### Component Structure

```
ExplainDrawer (container)
├── ExplainDrawerHeader
│   └── Close button, title
├── ExplainValueSection
│   └── Large value display, benchmark comparison
├── ExplainFormulaSection
│   └── Formula display with code toggle
├── ExplainDataSection
│   └── Included/excluded counts, reasons
├── ExplainConfidenceSection
│   └── Grade badge, explanation
├── ExplainSampleRecords
│   └── Table of first N records
└── ExplainFooter
    └── Date range, active filters
```

---

## File List

### New Files to Create

| File | Purpose |
|------|---------|
| `src/productivity-dashboard/types/explainTypes.ts` | Type definitions for Explanation contract |
| `src/productivity-dashboard/services/explain/types.ts` | Provider interface and context types |
| `src/productivity-dashboard/services/explain/providerRegistry.ts` | Provider registration and lookup |
| `src/productivity-dashboard/services/explain/providers/medianTTFProvider.ts` | Median TTF explanation logic |
| `src/productivity-dashboard/services/explain/providers/hmLatencyProvider.ts` | HM Latency explanation logic |
| `src/productivity-dashboard/services/explain/providers/stalledReqsProvider.ts` | Stalled Reqs explanation logic |
| `src/productivity-dashboard/services/explain/providers/offerAcceptRateProvider.ts` | Offer Accept Rate explanation logic |
| `src/productivity-dashboard/services/explain/providers/timeToOfferProvider.ts` | Time to Offer explanation logic |
| `src/productivity-dashboard/services/explain/index.ts` | Export barrel |
| `src/productivity-dashboard/components/common/ExplainDrawer.tsx` | Drawer UI component |
| `src/productivity-dashboard/components/common/ExplainButton.tsx` | Icon button component |
| `src/productivity-dashboard/hooks/useExplain.ts` | Hook for triggering explanations |

### Files to Modify

| File | Change |
|------|--------|
| `src/productivity-dashboard/components/control-tower/ControlTowerTab.tsx` | Add ExplainButton to HealthIndicator cards |
| `src/productivity-dashboard/types/index.ts` | Export new explain types |
| `src/productivity-dashboard/services/index.ts` | Export explain services |

---

## Implementation Sequence

### Commit 1: Type Definitions
- Create `types/explainTypes.ts` with full type definitions
- Update `types/index.ts` to export new types

### Commit 2: Provider Infrastructure
- Create `services/explain/types.ts` with provider interfaces
- Create `services/explain/providerRegistry.ts` with registry skeleton
- Create `services/explain/index.ts` export barrel

### Commit 3: First Provider (Median TTF)
- Create `services/explain/providers/medianTTFProvider.ts`
- Implement `canExplain()` and `explain()` methods
- Register in providerRegistry

### Commit 4: Remaining Providers
- Create `hmLatencyProvider.ts`
- Create `stalledReqsProvider.ts`
- Create `offerAcceptRateProvider.ts`
- Create `timeToOfferProvider.ts`
- Register all in providerRegistry

### Commit 5: UI Components
- Create `components/common/ExplainDrawer.tsx`
- Create `components/common/ExplainButton.tsx`
- Create `hooks/useExplain.ts`

### Commit 6: Integration
- Modify `ControlTowerTab.tsx` to add ExplainButton to HealthIndicator
- Wire up drawer state management
- Add drawer to ControlTowerTab render tree

### Commit 7: Tests
- Add unit tests for each provider
- Add render test for ExplainDrawer

---

## Test Plan

### Unit Tests (Per Provider)

Location: `src/productivity-dashboard/services/explain/__tests__/`

#### medianTTFProvider.test.ts
```typescript
describe('MedianTTFProvider', () => {
  describe('canExplain', () => {
    it('returns NO_HIRES_IN_RANGE when no hires in date range');
    it('returns MISSING_HIRED_AT when all hires lack hired_at');
    it('returns MISSING_OPENED_AT when all reqs lack opened_at');
    it('returns empty array when sufficient data exists');
  });

  describe('explain', () => {
    it('calculates correct median from valid hires');
    it('excludes zombie reqs from calculation');
    it('excludes negative TTF values');
    it('includes sample records in output');
    it('sets confidenceGrade to low when <3 records');
  });
});
```

#### hmLatencyProvider.test.ts
```typescript
describe('HMLatencyProvider', () => {
  describe('canExplain', () => {
    it('returns NO_HM_DATA when hmFriction is empty');
    it('returns NO_FEEDBACK_EVENTS when all latencies are null');
    it('returns empty array when sufficient data exists');
  });

  describe('explain', () => {
    it('calculates average from valid HM latencies');
    it('converts hours to days for display');
    it('includes HM breakdown in sample records');
  });
});
```

#### stalledReqsProvider.test.ts
```typescript
describe('StalledReqsProvider', () => {
  describe('canExplain', () => {
    it('returns NO_OPEN_REQS when no open requisitions');
    it('returns NO_OVERVIEW_DATA when overview is null');
    it('returns empty array when data exists');
  });

  describe('explain', () => {
    it('counts stalled and zombie reqs correctly');
    it('includes breakdown by health status');
  });
});
```

#### offerAcceptRateProvider.test.ts
```typescript
describe('OfferAcceptRateProvider', () => {
  describe('canExplain', () => {
    it('returns NO_OFFERS_IN_RANGE when no offers');
    it('returns empty array when offers exist');
  });

  describe('explain', () => {
    it('calculates rate from accepted/extended');
    it('excludes pending offers from rate');
    it('includes offer outcomes in sample records');
  });
});
```

#### timeToOfferProvider.test.ts
```typescript
describe('TimeToOfferProvider', () => {
  describe('canExplain', () => {
    it('returns NO_OFFERS_IN_RANGE when no offers');
    it('returns MISSING_APPLICATION_DATE when no start dates');
    it('returns empty array when sufficient data exists');
  });

  describe('explain', () => {
    it('calculates median time from application to offer');
    it('uses first_contacted_at as fallback for applied_at');
    it('excludes negative durations');
  });
});
```

### UI Render Test

Location: `src/productivity-dashboard/components/common/__tests__/ExplainDrawer.test.tsx`

```typescript
describe('ExplainDrawer', () => {
  it('renders closed when isOpen is false');
  it('renders value and formula when status is ready');
  it('renders blocked message when status is blocked');
  it('renders exclusion reasons list');
  it('renders sample records table');
  it('calls onClose when close button clicked');
  it('renders confidence badge with correct color');
});
```

### Test Data Fixtures

Location: `src/productivity-dashboard/services/explain/__tests__/fixtures.ts`

Create mock data fixtures:
- `mockRequisitionsWithHires` - Reqs with valid TTF data
- `mockRequisitionsZombie` - Zombie reqs for exclusion testing
- `mockCandidatesWithOffers` - Candidates with offer data
- `mockHMFrictionData` - HM latency data
- `mockEmptyContext` - Context with no data (for blocked tests)

---

## Summary

This plan provides a complete blueprint for implementing the Explain Engine:

1. **Type-safe contract** ensuring all providers return consistent data
2. **Provider pattern** allowing easy addition of future KPI explanations
3. **Fail-closed gating** preventing misleading metrics display
4. **Consistent UI** via shared drawer component
5. **Comprehensive tests** covering each provider and UI component

The implementation can proceed commit-by-commit with each step being independently testable and deployable.
