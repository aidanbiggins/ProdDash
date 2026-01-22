# Demo Data Guide

This guide explains how to use the Ultimate Demo data generator in PlatoVue.

## Overview

The Ultimate Demo system generates realistic recruiting data with deterministic seeding. Same seed = same data, every time.

## Quick Start

1. Click **"Load Ultimate Demo"** in the data import section
2. Choose a preset: All Features (recommended), Minimal, or Custom
3. Click **Load Demo Data**

## Demo Packs

Toggle individual data packs to simulate different scenarios:

| Pack | Description | Dependencies |
|------|-------------|--------------|
| **Core ATS** | Requisitions, candidates, stage progression | None (required) |
| **Recruiter + HM** | Recruiter ownership, HM assignments | Core ATS |
| **Offers & Outcomes** | Offer extended/accepted/declined data | Core ATS |
| **Snapshots & Diffs** | Multiple snapshots for SLA/dwell tracking | Core ATS |
| **Capacity History** | 8+ weeks of throughput data | Core ATS, Recruiter+HM |
| **Calibration History** | 20+ hires with predictions for backtest | Core ATS, Offers |
| **Scenarios Library** | Hiring freeze, recruiter leaves scenarios | Core ATS, Recruiter+HM |
| **Synthetic PII** | Fake names/emails to trigger PII detection | Core ATS |
| **AI Stubs** | Pre-computed narratives (no BYOK needed) | None |

## Feature Gating

Disabling packs gates related features:

- Disable **Recruiter + HM** → Hides HM Friction tab, HM Latency KPIs
- Disable **Snapshots & Diffs** → Hides trend features, SLA tracking
- Disable **Capacity History** → Hides recruiter capacity analysis
- Disable **Calibration History** → Can't run Oracle backtest

## Deterministic Seeding

Same seed always produces identical data:

```
Seed: "ultimate-demo-v1"
→ Same 50 reqs, same 600 candidates, same 2400 events
→ Same names, dates, stages
→ Same "random" journeys through funnel
```

Change the seed to get different (but still deterministic) data.

## Safe PII Patterns

The Synthetic PII pack uses patterns that are obviously fake:

- **Emails**: `@example.com`, `@example.org`, `@test.example.net` (RFC 2606 reserved)
- **Phones**: `+1 415 555 01XX` (555-01XX is the fictional range)
- **Names**: Real first names + fake suffixes (Demo, Sample, Test, etc.)

## Generated Data Counts

With all packs enabled (default):

| Entity | Count |
|--------|-------|
| Requisitions | 50 |
| Candidates | ~600 |
| Events | ~2400 |
| Users (Recruiters/HMs) | ~23 |
| Snapshots | 15 (30 days) |
| Calibration Records | 25 |
| AI Stubs | 10 intents |

## AI Stubs (No BYOK Mode)

When AI is disabled, the AI stubs provide deterministic narratives for common queries:

- `whats_on_fire` - Current risks and hotspots
- `top_actions` - Priority action items
- `forecast_gap` - Hiring forecast vs goal
- `hm_latency` - HM responsiveness analysis
- `velocity_summary` - Pipeline velocity metrics
- `source_effectiveness` - Source ROI breakdown
- `capacity_summary` - Recruiter workload
- `stalled_reqs` - Stalled requisition analysis
- `exec_brief` - Executive summary
- `worst_recruiter` - Lowest performer (for demo)

## Testing & Verification

Run the verification script:

```bash
npm run demo:verify
```

This validates:
- Determinism (same seed = same output)
- Referential integrity (all FKs valid)
- Required fields (no nulls where required)
- Pack dependencies (auto-enabled correctly)
- Safe PII patterns (no real data)

## Integration Points

### Import to Dashboard

The demo bundle exports directly to the dashboard state:

```typescript
import { generateUltimateDemo } from 'services/ultimateDemoGenerator';
import { DEFAULT_PACK_CONFIG } from 'types/demoTypes';

const bundle = generateUltimateDemo('my-seed', DEFAULT_PACK_CONFIG);

// bundle.requisitions → Requisition[]
// bundle.candidates → Candidate[]
// bundle.events → Event[]
// bundle.users → User[]
// bundle.snapshots → DataSnapshot[] (if enabled)
// bundle.aiStubs → AIStub[] (if enabled)
```

### Capability Preview

The bundle includes a capability preview showing what features are enabled/disabled:

```typescript
bundle.capabilityPreview = {
  enabled: ['Control Tower', 'HM Friction', 'Velocity Insights', ...],
  disabled: ['Trend Analysis'],
  disabledReasons: {
    'Trend Analysis': 'Requires snapshots_diffs pack'
  }
};
```

## Troubleshooting

**Q: Data looks different than expected**
- Check the seed value - different seeds produce different data
- Verify pack configuration matches expectations

**Q: Some features are grayed out**
- Check which packs are enabled
- Enable required dependencies (shown in modal)

**Q: PII detection triggered on demo data**
- This is expected with Synthetic PII pack enabled
- Use anonymization or disable synthetic_pii pack

## Manual Smoke Test Checklist

Use this checklist to verify the Ultimate Demo feature after changes:

### Modal Flow
- [ ] Click "Load Ultimate Demo" button in import area → Modal opens
- [ ] Modal shows pack toggles with dependency indicators
- [ ] Capability preview updates when toggling packs
- [ ] Disabling a pack disables its dependents (e.g., disabling Core ATS disables all)
- [ ] Preset buttons work: "All Features", "Minimal", "Custom"
- [ ] Click "Load Demo Data" → Modal closes and import begins

### PII Detection Flow (with Synthetic PII enabled)
- [ ] Loading demo with synthetic_pii=true → PII Warning Modal appears
- [ ] Modal shows sample PII fields detected (names, emails, phones)
- [ ] "Anonymize & Import" → Data imports with anonymized names
- [ ] "Import As-Is" → Data imports with original fake PII

### Post-Import Verification
- [ ] Navigates to Control Tower after successful import
- [ ] Control Tower shows KPIs with data
- [ ] Requisitions tab shows ~50 reqs
- [ ] Recruiter Detail shows recruiter data
- [ ] HM Friction tab shows HM latency data (if recruiter_hm enabled)
- [ ] Tabs gated by disabled packs are hidden or show empty state

### Determinism Check
- [ ] Load demo with seed "test-seed-1" → Note req count
- [ ] Clear data → Load again with same seed → Same exact data

### Error Handling
- [ ] Load demo while already loading → Button disabled
- [ ] Cancel modal mid-load → Clean state, no errors

## Related Files

- `/src/productivity-dashboard/types/demoTypes.ts` - Type definitions
- `/src/productivity-dashboard/services/ultimateDemoGenerator.ts` - Generator logic
- `/src/productivity-dashboard/components/common/UltimateDemoModal.tsx` - UI component
- `/src/productivity-dashboard/components/CSVUpload.tsx` - Import integration
- `/docs/plans/ULTIMATE_DEMO_DATA_INTERACTIVE_V1.md` - Full design spec
