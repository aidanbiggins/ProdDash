# Ultimate Demo Data - Interactive Feature Showcase

**Version:** 1.0
**Status:** PLANNED
**Author:** Claude
**Date:** 2026-01-20

## Overview

The Ultimate Demo provides a complete synthetic dataset that enables EVERY feature in PlatoVue. Users can toggle demo packs on/off to simulate different data coverage scenarios, instantly seeing which features are enabled/disabled based on their selections.

### Goals

1. **Showcase all features** - Load full demo and every tab, widget, chart works
2. **Demonstrate capability gating** - Toggle packs off to show graceful degradation
3. **Prove PII handling** - Synthetic PII triggers detection/anonymization flow
4. **Work without BYOK** - Deterministic AI-off fallbacks for Ask and narratives
5. **Enable testing** - Seeded determinism for reproducible tests

### Hard Constraints

- **No real PII** - Only synthetic PII with safe patterns (`example.com`, `555` numbers)
- **Deterministic** - Same seed produces identical dataset
- **Uses real pipeline** - No special-cased cheating; exercises actual ingestion/capability systems
- **No heavy dependencies** - Pure TypeScript generators
- **Local-first** - No cloud persistence required (optional for snapshots)

---

## 1. Demo Packs Definition

Each pack is a toggleable unit of data generation. Packs have dependencies (e.g., Offers requires Core ATS).

### Pack Definitions

| Pack ID | Name | Description | Dependencies |
|---------|------|-------------|--------------|
| `core_ats` | Core ATS | Requisitions, candidates, basic stage progression | None |
| `recruiter_hm` | Recruiter + HM Assignments | Recruiter ownership, HM assignments per req | `core_ats` |
| `offers_outcomes` | Offers & Outcomes | Offer extended/accepted/declined/withdrawn data | `core_ats` |
| `snapshots_diffs` | Snapshots & Diffs | Multiple import snapshots for dwell/regression/SLA | `core_ats` |
| `capacity_history` | Capacity History | 8+ weeks of throughput data for inference | `core_ats`, `recruiter_hm` |
| `calibration_history` | Calibration History | 20+ completed hires with predictions for backtest | `core_ats`, `offers_outcomes` |
| `scenarios` | Scenarios Library | Hiring freeze, recruiter leaves, spin-up team data | `core_ats`, `recruiter_hm` |
| `synthetic_pii` | Synthetic PII | Fake names/emails/phones to trigger PII detection | `core_ats` |
| `ai_stubs` | AI Fallback Stubs | Deterministic narratives for AI-off mode | None |

### Pack Details

#### `core_ats` - Core ATS Data
**Records generated:**
- 50 requisitions (mix of open/closed/on-hold)
- 600 candidates (~12 per req)
- 2,400 stage events (average 4 per candidate)
- 8 canonical stages: Applied → Screen → HM Screen → Onsite → Offer → Hired/Rejected/Withdrawn

**Key fields populated:**
- `req.opened_at`, `req.closed_at`, `req.status`
- `cand.applied_at`, `cand.current_stage`, `cand.disposition`
- `event.from_stage`, `event.to_stage`, `event.event_at`

#### `recruiter_hm` - Recruiter + HM Assignments
**Records generated:**
- 8 recruiters with unique IDs and names
- 15 hiring managers
- Each req assigned to 1 recruiter and 1 HM

**Key fields populated:**
- `req.recruiter_id`, `req.recruiter_name`
- `req.hiring_manager_id`, `req.hiring_manager_name`
- `user.role` (Recruiter/HiringManager)

#### `offers_outcomes` - Offers & Outcomes
**Records generated:**
- 80 offers extended (from 50 reqs)
- 65 offers accepted (81% accept rate)
- 10 offers declined
- 5 offers withdrawn

**Key fields populated:**
- `cand.offer_extended_at`, `cand.offer_accepted_at`
- `cand.disposition` (Hired/OfferDeclined/Withdrawn)
- `cand.hired_at`, `cand.rejected_at`, `cand.withdrawn_at`

#### `snapshots_diffs` - Snapshots & Diffs
**Records generated:**
- 15 snapshots over 30 days (every 2 days)
- Stage change events inferred from diffs
- 5-10 stage regressions (candidates moving backward)
- SLA violation data (candidates dwelling 7+ days)

**Key fields populated:**
- `snapshot.captured_at`, `snapshot.sequence_number`
- `snapshot_event.event_type` (STAGE_CHANGE, STAGE_REGRESSION, etc.)
- `snapshot_event.confidence` (high/medium/low)

#### `capacity_history` - Capacity Inference History
**Records generated:**
- 8 weeks of throughput data per recruiter
- Screen/HM Screen/Onsite/Offer transitions tracked
- Variable throughput (2-6 screens/week, 1-3 offers/week)

**Key fields populated:**
- Event timestamps spread over 8 weeks
- Recruiter-specific transition patterns
- Enough variance for meaningful inference

#### `calibration_history` - Oracle Calibration
**Records generated:**
- 25 completed hires with full journey
- Predicted vs actual fill dates
- Bias data (some early, some late predictions)

**Key fields populated:**
- Historical forecasts stored in memory
- Actual `hired_at` dates
- Deviation calculations

#### `scenarios` - Scenario Library Data
**Records generated:**
- 3 recruiters with assignable reqs (for leave simulation)
- 5 reqs in hiring-freeze-ready state
- 10 reqs ready for team spin-up scenario

**Key fields populated:**
- Req clusters by function/level
- Recruiter workload distribution
- Open pipeline counts

#### `synthetic_pii` - Synthetic PII Pack
**Records generated:**
- Candidate names: "Casey Demo", "Jordan Sample", "Alex Test-User"
- Emails: `casey.demo@example.com`, `jordan.sample@example.org`
- Phones: `+1 415 555 0101` through `+1 415 555 0199`

**PII patterns (safe):**
- Domains: `example.com`, `example.org`, `test.example.net`
- Phone prefix: `+1 415 555 01xx` (reserved fictional range)
- Names: Clearly synthetic suffixes (Demo, Sample, Test, Fake)

#### `ai_stubs` - AI Fallback Stubs
**Records generated:**
- Pre-written exec brief narrative
- Deterministic Ask PlatoVue responses for top 10 questions
- Insight card narratives with citations

**Format:**
```typescript
interface AIStub {
  intent: string;
  response: string;
  citations: string[];
  confidence: 'high' | 'medium';
}
```

---

## 2. Deterministic Generator Contract

### Main API

```typescript
// src/productivity-dashboard/services/ultimateDemoGenerator.ts

export interface DemoPackConfig {
  core_ats: boolean;
  recruiter_hm: boolean;
  offers_outcomes: boolean;
  snapshots_diffs: boolean;
  capacity_history: boolean;
  calibration_history: boolean;
  scenarios: boolean;
  synthetic_pii: boolean;
  ai_stubs: boolean;
}

export const DEFAULT_PACK_CONFIG: DemoPackConfig = {
  core_ats: true,
  recruiter_hm: true,
  offers_outcomes: true,
  snapshots_diffs: true,
  capacity_history: true,
  calibration_history: true,
  scenarios: true,
  synthetic_pii: true,
  ai_stubs: true,
};

export interface UltimateDemoBundle {
  // Core data (always present if core_ats enabled)
  requisitions: Requisition[];
  candidates: Candidate[];
  events: Event[];
  users: User[];

  // Optional based on packs
  snapshots?: DataSnapshot[];
  snapshotEvents?: SnapshotEvent[];
  calibrationHistory?: CalibrationRecord[];
  aiStubs?: AIStub[];

  // Metadata
  seed: string;
  packsEnabled: DemoPackConfig;
  generatedAt: Date;

  // Capability preview (what this config enables)
  capabilityPreview: CapabilityPreview;
}

export interface CapabilityPreview {
  enabled: string[];      // Feature names that will work
  disabled: string[];     // Features that won't work
  disabledReasons: Map<string, string>;  // Feature -> reason
}

/**
 * Generate Ultimate Demo data bundle
 *
 * @param seed - Deterministic seed (default: 'ultimate-demo-v1')
 * @param packsEnabled - Which packs to include
 * @returns Complete data bundle ready for import
 */
export function generateUltimateDemo(
  seed: string = 'ultimate-demo-v1',
  packsEnabled: Partial<DemoPackConfig> = {}
): UltimateDemoBundle;
```

### Seeded Random Number Generator

```typescript
// Mulberry32 PRNG for determinism
function createSeededRandom(seed: string): () => number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(31, h) + seed.charCodeAt(i) | 0;
  }
  return function() {
    h |= 0; h = h + 0x6D2B79F5 | 0;
    let t = Math.imul(h ^ h >>> 15, 1 | h);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
```

### Reuse of Existing Code Paths

The generator reuses existing utilities:

1. **Stage progression** - Uses `FUNNEL_STAGES` from `sampleDataGenerator.ts`
2. **Name generation** - Uses `FIRST_NAMES`, `LAST_NAMES` arrays
3. **ID generation** - Uses `generateId(prefix, index, sessionId)` pattern
4. **Date utilities** - Uses `date-fns` for all date math
5. **Canonical stages** - Uses `CanonicalStage` enum from `entities.ts`

### Import Flow Integration

The generated bundle is designed to be imported through the standard pipeline:

```typescript
// In DataImportSection.tsx or similar
const bundle = generateUltimateDemo(seed, packsEnabled);

// Convert to CSV format (reuses existing csvParser expectations)
const csvData = bundleToCSV(bundle);

// Import through standard flow
await handleDataImport(csvData);

// Capability gating kicks in automatically based on data coverage
const coverage = computeCoverage(state);
const capabilities = getAllCapabilityStatuses(coverage);
```

---

## 3. PII Handling in Demo

### Synthetic PII Formats

When `synthetic_pii` pack is enabled:

#### Names
```
Pattern: {FirstName} {Suffix}
Suffixes: Demo, Sample, Test, Fake, Example, Synthetic
Examples:
  - "Casey Demo"
  - "Jordan Sample"
  - "Alex Test"
  - "Morgan Fake"
  - "Riley Example"
```

#### Emails
```
Pattern: {firstname}.{suffix}@{domain}
Domains: example.com, example.org, test.example.net
Examples:
  - casey.demo@example.com
  - jordan.sample@example.org
  - alex.test@test.example.net
```

#### Phone Numbers
```
Pattern: +1 415 555 01{XX}
Range: +1 415 555 0100 through +1 415 555 0199
Note: 555-01xx is a reserved fictional range (safe for demos)
Examples:
  - +1 415 555 0101
  - +1 415 555 0142
  - +1 415 555 0187
```

### PII Detection Flow

When demo data with synthetic PII is loaded:

1. **Detection** - `detectPII()` in `piiService.ts` scans candidates
2. **Warning Modal** - `PIIWarningModal` displays detected PII with samples
3. **User Choice** - User can:
   - **Continue with PII** - Data loads as-is
   - **Anonymize** - `anonymizeCandidates()` replaces PII
   - **Cancel** - Abort import

### Anonymization Output

After anonymization:
```
Original: "Casey Demo" → Anonymized: "Candidate 001"
Original: "casey.demo@example.com" → "candidate001@masked.example"
Original: "+1 415 555 0101" → "***-***-0101"
```

### Demo Flow

```
[Load Ultimate Demo]
    → generateUltimateDemo(seed, {synthetic_pii: true})
    → detectPII() finds 600 candidates with names/emails/phones
    → PIIWarningModal shows: "600 candidates with PII detected"
    → User clicks "Anonymize All"
    → anonymizeCandidates() runs
    → Data loads with masked values
    → DataMaskingContext toggle allows re-masking in UI
```

---

## 4. Capability Mapping

### Pack → Feature Matrix

| Pack | Enables Features | Gating Flags Set |
|------|-----------------|------------------|
| `core_ats` | Control Tower, Data Health, Funnel Analysis | `requisitions > 0`, `candidates > 0` |
| `recruiter_hm` | HM Friction, HM Latency KPI, Capacity Rebalancer | `hasHMAssignment`, `hasRecruiterAssignment` |
| `offers_outcomes` | Accept Rate, TTF Chart, Velocity Insights | `hired_at coverage > 10%`, offers sample size > 5 |
| `snapshots_diffs` | Historical Trends, Bottlenecks & SLAs, Regressions | `hasMultipleSnapshots`, `hasStageEvents` |
| `capacity_history` | Capacity Inference, Oracle Capacity Mode | `events > 100`, 8+ weeks of data |
| `calibration_history` | Model Trust Score, Oracle Backtest | `completedHires > 20` |
| `scenarios` | Scenario Library, What-If Analysis | `scenarios.available > 0` |
| `synthetic_pii` | PII Detection Demo, Anonymization Demo | `piiDetected: true` |
| `ai_stubs` | Ask PlatoVue (AI-off), Exec Brief (AI-off) | `aiStubsAvailable: true` |

### Disabled Pack → Gated Features

| Disabled Pack | Features Gated | Gating Message |
|---------------|----------------|----------------|
| `core_ats` | ALL features | "No data loaded" |
| `recruiter_hm` | HM Friction, Capacity tabs | "HM assignments required" |
| `offers_outcomes` | Accept Rate, TTF metrics | "Offer outcome data required" |
| `snapshots_diffs` | Trends, SLA, Bottlenecks | "Multiple snapshots required" |
| `capacity_history` | Capacity Analysis widget | "8 weeks of event data required" |
| `calibration_history` | Model Trust Score | "20+ completed hires required for calibration" |
| `scenarios` | Scenario Library | "Scenario-ready data required" |
| `synthetic_pii` | (No features gated - just demo mode) | N/A |
| `ai_stubs` | (AI features work in reduced mode) | "AI responses use cached stubs" |

### Capability Registry Integration

The generator produces a `CoverageMetrics` object that feeds directly into the existing capability engine:

```typescript
function computeDemoCoverage(bundle: UltimateDemoBundle): CoverageMetrics {
  return {
    counts: {
      requisitions: bundle.requisitions.length,
      candidates: bundle.candidates.length,
      events: bundle.events.length,
      users: bundle.users.length,
    },
    fieldCoverage: {
      'cand.applied_at': computeFieldCoverage(bundle.candidates, 'applied_at'),
      'cand.hired_at': computeFieldCoverage(bundle.candidates, 'hired_at'),
      'cand.current_stage': computeFieldCoverage(bundle.candidates, 'current_stage'),
      'event.from_stage': computeFieldCoverage(bundle.events, 'from_stage'),
      'event.to_stage': computeFieldCoverage(bundle.events, 'to_stage'),
      // ... etc
    },
    flags: {
      hasHMAssignment: bundle.packsEnabled.recruiter_hm,
      hasRecruiterAssignment: bundle.packsEnabled.recruiter_hm,
      hasStageEvents: bundle.events.length > 0,
      hasSourceData: true, // Always included in core_ats
      hasTimestamps: true,
      hasMultipleSnapshots: bundle.packsEnabled.snapshots_diffs,
    },
    sampleSizes: {
      candidates: bundle.candidates.filter(c => c.disposition === 'Hired').length,
      offers: bundle.candidates.filter(c => c.offer_extended_at).length,
    },
  };
}
```

---

## 5. UX Design

### Load Ultimate Demo Modal

**Trigger:** New button in data import area: "🎭 Load Ultimate Demo"

**Modal Layout:**

```
┌─────────────────────────────────────────────────────────┐
│  🎭 Load Ultimate Demo                              [X] │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Load synthetic data to explore all PlatoVue features.  │
│  Toggle packs to simulate different data scenarios.     │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │ PRESETS                                         │   │
│  │ ○ All Features (recommended)                    │   │
│  │ ○ Minimal (Core ATS only)                       │   │
│  │ ○ Custom                                        │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │ DEMO PACKS                                      │   │
│  │ ☑ Core ATS (reqs, candidates, stages)          │   │
│  │ ☑ Recruiter + HM Assignments                   │   │
│  │ ☑ Offers & Outcomes                            │   │
│  │ ☑ Snapshots & Diffs (SLA, dwell)               │   │
│  │ ☑ Capacity History (8 weeks)                   │   │
│  │ ☑ Calibration History (backtest)               │   │
│  │ ☑ Scenarios Library                            │   │
│  │ ☑ Synthetic PII (demo detection)               │   │
│  │ ☑ AI Stubs (no BYOK required)                  │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  Seed: [ultimate-demo-v1        ] (for reproducibility) │
│                                                         │
├─────────────────────────────────────────────────────────┤
│  FEATURES ENABLED WITH THIS CONFIG                      │
│  ┌─────────────────────────────────────────────────┐   │
│  │ ✅ Control Tower          ✅ HM Friction        │   │
│  │ ✅ Velocity Insights      ✅ Source Mix         │   │
│  │ ✅ Bottlenecks & SLAs     ✅ Data Health        │   │
│  │ ✅ Oracle Forecasting     ✅ Capacity Analysis  │   │
│  │ ✅ Ask PlatoVue           ✅ Scenario Library   │   │
│  │ ✅ Exec Brief             ✅ PII Detection      │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ⚠️ DISABLED: None - all features enabled!             │
│                                                         │
├─────────────────────────────────────────────────────────┤
│           [Cancel]              [Load Demo Data]        │
└─────────────────────────────────────────────────────────┘
```

### Live Features Panel

As user toggles packs, the features panel updates in real-time:

```typescript
// When user unchecks "Recruiter + HM Assignments"
FEATURES ENABLED:
  ✅ Control Tower
  ✅ Velocity Insights
  ✅ Source Mix
  ✅ Data Health
  ...

FEATURES DISABLED:
  ❌ HM Friction - "Requires HM assignments"
  ❌ HM Latency KPI - "Requires HM assignments"
  ❌ Capacity Rebalancer - "Requires recruiter assignments"
```

### Post-Load Capabilities Summary

After demo loads, show a toast/banner:

```
┌─────────────────────────────────────────────────────────┐
│ ✅ Demo loaded: 50 reqs, 600 candidates, 15 snapshots   │
│                                                         │
│ WITH THIS DATA YOU CAN:                                 │
│ • Analyze HM friction and latency patterns              │
│ • View velocity insights and pipeline decay             │
│ • Explore 3 what-if scenarios                           │
│ • Ask questions in natural language (AI-off mode)       │
│                                                         │
│ TO UNLOCK MORE:                                         │
│ • Enable BYOK for AI-powered insights                   │
│ • Import real data to see actual metrics                │
│                                                         │
│                                        [Got it]         │
└─────────────────────────────────────────────────────────┘
```

### Pack Toggle Dependencies

When a pack with dependencies is disabled, dependent packs are also disabled:

```typescript
// User unchecks "Core ATS"
// All other packs become disabled and grayed out
// Tooltip: "Requires Core ATS"
```

When a required pack is missing:
```typescript
// User tries to enable "Capacity History" without "Recruiter + HM"
// Show inline warning: "⚠️ Requires Recruiter + HM Assignments"
// Auto-enable dependency OR prevent enable
```

---

## 6. Verification Plan

### `npm run demo:verify` Script

**Location:** `scripts/demo-verify.ts`

**What it does:**

```typescript
async function verifyUltimateDemo() {
  console.log('🧪 Ultimate Demo Verification');

  // 1. Generate demo with all packs ON
  console.log('1. Generating demo data...');
  const bundle = generateUltimateDemo('test-seed-12345', DEFAULT_PACK_CONFIG);

  // 2. Verify determinism
  console.log('2. Verifying determinism...');
  const bundle2 = generateUltimateDemo('test-seed-12345', DEFAULT_PACK_CONFIG);
  assert(JSON.stringify(bundle) === JSON.stringify(bundle2), 'Determinism failed');

  // 3. Verify record counts
  console.log('3. Verifying record counts...');
  assert(bundle.requisitions.length >= 50, 'Not enough requisitions');
  assert(bundle.candidates.length >= 500, 'Not enough candidates');
  assert(bundle.events.length >= 2000, 'Not enough events');
  assert(bundle.snapshots?.length >= 10, 'Not enough snapshots');

  // 4. Verify capability coverage
  console.log('4. Verifying capability coverage...');
  const coverage = computeDemoCoverage(bundle);
  const capabilities = getAllCapabilityStatuses(coverage);
  const disabledCaps = capabilities.filter(c => !c.enabled);
  assert(disabledCaps.length === 0, `Capabilities disabled: ${disabledCaps.map(c => c.id).join(', ')}`);

  // 5. Verify Ask Fact Pack population
  console.log('5. Verifying Ask Fact Pack...');
  const factPack = buildAskFactPack(bundle);
  assert(factPack.hiring_manager_ownership, 'Missing HM ownership');
  assert(factPack.recruiter_performance, 'Missing recruiter performance');
  assert(factPack.top_actions.length > 0, 'Missing actions');
  assert(factPack.top_risks.length > 0, 'Missing risks');
  assert(factPack.forecast, 'Missing forecast');

  // 6. Verify PII detection
  console.log('6. Verifying PII detection...');
  const piiResult = detectPII(bundle.candidates);
  assert(piiResult.hasPII, 'PII not detected');
  assert(piiResult.detectedFields.some(f => f.type === 'email'), 'Email PII not detected');

  // 7. Run route smoke tests
  console.log('7. Running route smoke tests...');
  // (Reuse existing route-smoke.test.ts logic)

  console.log('✅ All verifications passed!');
}
```

### Test Cases

**Location:** `src/productivity-dashboard/services/__tests__/ultimateDemoGenerator.test.ts`

```typescript
describe('Ultimate Demo Generator', () => {
  describe('Determinism', () => {
    it('same seed produces identical output', () => {
      const a = generateUltimateDemo('seed-123');
      const b = generateUltimateDemo('seed-123');
      expect(a.requisitions).toEqual(b.requisitions);
      expect(a.candidates).toEqual(b.candidates);
    });

    it('different seeds produce different output', () => {
      const a = generateUltimateDemo('seed-123');
      const b = generateUltimateDemo('seed-456');
      expect(a.requisitions).not.toEqual(b.requisitions);
    });
  });

  describe('Pack Toggles → Capability Gating', () => {
    it('disabling snapshots_diffs gates SLA features', () => {
      const bundle = generateUltimateDemo('test', { snapshots_diffs: false });
      const coverage = computeDemoCoverage(bundle);
      expect(isCapabilityEnabled('tab_bottlenecks', coverage)).toBe(false);
      expect(isCapabilityEnabled('section_trends', coverage)).toBe(false);
    });

    it('disabling recruiter_hm gates capacity features', () => {
      const bundle = generateUltimateDemo('test', { recruiter_hm: false });
      const coverage = computeDemoCoverage(bundle);
      expect(isCapabilityEnabled('tab_hm_friction', coverage)).toBe(false);
      expect(isCapabilityEnabled('widget_hm_latency', coverage)).toBe(false);
    });

    it('all packs ON enables all capabilities', () => {
      const bundle = generateUltimateDemo('test', DEFAULT_PACK_CONFIG);
      const coverage = computeDemoCoverage(bundle);
      const capabilities = getAllCapabilityStatuses(coverage);
      const disabled = capabilities.filter(c => !c.enabled);
      expect(disabled).toHaveLength(0);
    });
  });

  describe('PII Detection', () => {
    it('synthetic_pii pack triggers PII detection', () => {
      const bundle = generateUltimateDemo('test', { synthetic_pii: true });
      const result = detectPII(bundle.candidates);
      expect(result.hasPII).toBe(true);
      expect(result.detectedFields.length).toBeGreaterThan(0);
    });

    it('synthetic PII uses safe patterns', () => {
      const bundle = generateUltimateDemo('test', { synthetic_pii: true });
      for (const cand of bundle.candidates) {
        if (cand.email) {
          expect(cand.email).toMatch(/@(example\.com|example\.org|test\.example\.net)$/);
        }
        if (cand.phone) {
          expect(cand.phone).toMatch(/\+1 415 555 01\d{2}/);
        }
      }
    });

    it('anonymization works on synthetic PII', () => {
      const bundle = generateUltimateDemo('test', { synthetic_pii: true });
      const { candidates: anonymized } = anonymizeCandidatesWithSummary(bundle.candidates);
      expect(anonymized[0].name).toMatch(/^Candidate \d+$/);
    });
  });

  describe('AI Stubs', () => {
    it('ai_stubs pack provides fallback responses', () => {
      const bundle = generateUltimateDemo('test', { ai_stubs: true });
      expect(bundle.aiStubs).toBeDefined();
      expect(bundle.aiStubs!.length).toBeGreaterThan(0);
    });

    it('Ask intent handlers can use stubs', () => {
      const bundle = generateUltimateDemo('test', { ai_stubs: true });
      const stub = bundle.aiStubs!.find(s => s.intent === 'whats_on_fire');
      expect(stub).toBeDefined();
      expect(stub!.response).toContain('risks');
    });
  });
});
```

### Package.json Script

```json
{
  "scripts": {
    "demo:verify": "ts-node scripts/demo-verify.ts"
  }
}
```

---

## 7. Implementation Phases

### Phase 1: Core Generator (2-3 hours)
- [ ] Create `ultimateDemoGenerator.ts`
- [ ] Implement seeded PRNG
- [ ] Implement `core_ats` pack
- [ ] Implement `recruiter_hm` pack
- [ ] Implement `offers_outcomes` pack
- [ ] Add determinism tests

### Phase 2: Advanced Packs (2-3 hours)
- [ ] Implement `snapshots_diffs` pack
- [ ] Implement `capacity_history` pack
- [ ] Implement `calibration_history` pack
- [ ] Implement `scenarios` pack
- [ ] Add pack dependency logic

### Phase 3: PII & AI Stubs (1-2 hours)
- [ ] Implement `synthetic_pii` pack with safe patterns
- [ ] Verify PII detection integration
- [ ] Implement `ai_stubs` pack
- [ ] Add AI-off fallback integration

### Phase 4: UI (2-3 hours)
- [ ] Create `UltimateDemoModal` component
- [ ] Add pack toggles with dependencies
- [ ] Add live features preview panel
- [ ] Add post-load capabilities summary
- [ ] Style with glass panel dark theme

### Phase 5: Verification (1-2 hours)
- [ ] Create `demo:verify` script
- [ ] Add comprehensive test suite
- [ ] Create `DEMO_DATA_GUIDE.md` documentation
- [ ] Final integration testing

---

## 8. File Structure

```
src/productivity-dashboard/
├── services/
│   ├── ultimateDemoGenerator.ts      # Main generator
│   └── __tests__/
│       └── ultimateDemoGenerator.test.ts
├── components/
│   └── data-import/
│       └── UltimateDemoModal.tsx     # Modal UI
├── types/
│   └── demoTypes.ts                  # Demo-specific types
scripts/
└── demo-verify.ts                    # Verification script
docs/
└── DEMO_DATA_GUIDE.md               # User documentation
```

---

## 9. Success Criteria

1. **All features work** - Loading with all packs ON enables every tab, widget, chart
2. **Graceful degradation** - Toggling packs OFF disables correct features with clear messages
3. **PII demo works** - Synthetic PII triggers detection modal, anonymization succeeds
4. **AI-off mode works** - Ask PlatoVue answers questions without BYOK using stubs
5. **Tests pass** - `npm test` and `npm run build` succeed
6. **Verification passes** - `npm run demo:verify` completes without errors
7. **Deterministic** - Same seed produces byte-identical output
8. **Documentation complete** - `DEMO_DATA_GUIDE.md` explains all packs and schemas
