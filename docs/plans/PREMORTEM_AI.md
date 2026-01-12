# Pre-Mortem Risk Prediction System

## Overview

The Pre-Mortem system is a deterministic risk scoring engine that identifies requisitions likely to fail before they do, enabling proactive intervention. Unlike reactive metrics that flag problems after the fact, Pre-Mortem predicts failure modes early and recommends specific interventions.

## Key Principles

1. **Deterministic** - No LLM inference; pure rule-based scoring with explicit weights
2. **Explainable** - Every risk score is backed by traceable evidence and metrics
3. **Actionable** - Generates specific interventions linked to the Action Queue
4. **Auditable** - Full transparency into scoring weights, thresholds, and calculations

## Architecture

### Data Flow

```
Requisitions + Candidates + Events + HM Actions
                    ↓
          buildScoringContext()
                    ↓
          calculateRiskFactors()
                    ↓
          determineFailureMode()
                    ↓
          generateInterventions()
                    ↓
              PreMortemResult
                    ↓
        Control Tower UI + Action Queue
```

### Core Types

**PreMortemResult** - The complete assessment for a requisition:
- `req_id`, `req_title` - Requisition identity
- `risk_score` (0-100) - Overall risk score
- `risk_band` - LOW (0-39), MED (40-69), HIGH (70+)
- `failure_mode` - Primary predicted failure cause
- `top_drivers` - Sorted risk factors with evidence
- `recommended_interventions` - Specific actions to take
- `comparable_history` - Historical cohort comparison
- `confidence` - Assessment reliability

**FailureMode** - Predicted primary failure cause:
- `EMPTY_PIPELINE` - No active candidates
- `HM_DELAY` - Hiring manager bottleneck
- `OFFER_RISK` - Offer acceptance at risk
- `COMPLEXITY_MISMATCH` - Role complexity exceeds capacity
- `AGING_DECAY` - Req open too long, conversion declining
- `STALLED_PIPELINE` - Pipeline exists but not progressing
- `UNKNOWN` - Cannot determine failure mode

**RiskDriver** - Individual risk factor:
- `driver_key` - Factor identifier (e.g., 'pipeline_gap')
- `description` - Human-readable explanation
- `severity` - critical | high | medium | low
- `weight` - Contribution to total score (0-100)
- `evidence` - Metric link with actual vs benchmark values

## Risk Scoring Model

### Default Weights (Total = 100)

| Factor | Weight | Description |
|--------|--------|-------------|
| pipeline_gap | 25 | Empty/thin candidate pipeline |
| days_open | 20 | Age vs benchmark TTF |
| stage_velocity | 15 | Slow stage progression |
| hm_latency | 15 | HM response delays |
| offer_decay | 15 | Offer stage risk |
| req_health | 10 | Stalled/zombie status |

### Thresholds

**Pipeline:**
- Empty (0 candidates) = Critical
- Thin (<3 candidates) = High

**Age vs Benchmark:**
- >1.5x benchmark = Warning
- >2.0x benchmark = Critical

**HM Latency:**
- >3 days = Warning
- >5 days = Critical

**Offer Decay:**
- >5 days in offer = Warning
- >10 days in offer = Critical

**Risk Bands:**
- HIGH: score >= 70
- MED: score >= 40
- LOW: score < 40

### Critical Condition Multipliers

The base scoring model can undercount risk when factors are N/A (e.g., no candidates means offer_decay = 0). To address this, minimum risk floors are applied for critical combinations:

| Condition | Minimum Score |
|-----------|---------------|
| Empty pipeline + critically aging (2x+ TTF) | 85 (HIGH) |
| Empty pipeline + aging (1x+ TTF) | 75 (HIGH) |
| Empty pipeline alone | 50 (MED) |
| Thin pipeline + critically aging | 70 (HIGH) |
| Thin pipeline + aging | 55 (MED) |

## UI Components

### Control Tower Panel

The Pre-Mortem section appears in the Control Tower when there are HIGH risk requisitions. It displays:
- Badge showing count of HIGH risk reqs
- Grid of risk cards (up to 10)
- Each card shows: risk score, failure mode, req title, days open, active candidates, top driver

Clicking a card opens the detail drawer.

### Pre-Mortem Detail Drawer

Full risk analysis view showing:
- Risk score with visual indicator
- Failure mode explanation
- All risk drivers with evidence and weights
- Recommended interventions with steps
- Comparable historical cohorts
- Confidence assessment
- "Add to Action Queue" button

### Action Queue Integration

Pre-Mortem interventions can be converted to ActionItems:
- Maintains all intervention context
- Sets appropriate priority (P0/P1/P2)
- Links evidence back to Pre-Mortem analysis
- Deduplicates when adding to existing queue

## Service Functions

### Primary Functions

```typescript
// Run Pre-Mortem for a single req
runPreMortem(
  req: Requisition,
  candidates: Candidate[],
  events: Event[],
  allRequisitions: Requisition[],
  hmActions: HMPendingAction[],
  benchmarkTTF?: number
): PreMortemResult

// Run Pre-Mortem for all open reqs
runPreMortemBatch(
  requisitions: Requisition[],
  candidates: Candidate[],
  events: Event[],
  hmActions: HMPendingAction[],
  benchmarkTTFMap?: Map<string, number>
): PreMortemResult[]

// Convert to Action Queue items
convertToActionItems(
  preMortems: PreMortemResult[],
  onlyHighRisk?: boolean
): ActionItem[]
```

### Helper Functions

```typescript
// Build scoring context from raw data
buildScoringContext(
  req: Requisition,
  candidates: Candidate[],
  events: Event[],
  hmActions: HMPendingAction[],
  benchmarkTTF?: number
): PreMortemScoringContext

// Get high risk results only
getHighRiskPreMortems(results: PreMortemResult[]): PreMortemResult[]
```

## Usage Example

```typescript
import { runPreMortemBatch, convertToActionItems } from './services/preMortemService';

// In Control Tower
const preMortemResults = useMemo(() => {
  return runPreMortemBatch(requisitions, candidates, events, hmActions);
}, [requisitions, candidates, events, hmActions]);

// Get HIGH risk for display
const highRiskPreMortems = preMortemResults
  .filter(r => r.risk_band === 'HIGH')
  .slice(0, 10);

// Convert to actions and add to queue
const handleAddPreMortemToQueue = (actions: ActionItem[]) => {
  setActionQueue(prev => {
    const existingIds = new Set(prev.map(a => a.action_id));
    const newActions = actions.filter(a => !existingIds.has(a.action_id));
    return [...prev, ...newActions];
  });
};
```

## Testing

Unit tests are in `services/__tests__/preMortemService.test.ts`:

- `buildScoringContext` - Context building from raw data
- `runPreMortem` - Single req analysis
- `runPreMortemBatch` - Batch processing
- `convertToActionItems` - Action Queue integration

Run tests:
```bash
npm test -- --testPathPattern="preMortemService"
```

## Future Enhancements

1. **Custom Weights** - Allow users to adjust risk factor weights
2. **ML Enhancement** - Train on historical outcomes to improve prediction
3. **Cohort Benchmarks** - Dynamic benchmarks based on role cohorts
4. **Trend Tracking** - Track risk score changes over time
5. **Notifications** - Alert when req enters HIGH risk band

## Files

| File | Purpose |
|------|---------|
| `types/preMortemTypes.ts` | Type definitions, constants, helper functions |
| `services/preMortemService.ts` | Risk scoring model, interventions |
| `components/common/PreMortemDrawer.tsx` | Detail drawer component |
| `components/control-tower/ControlTowerTab.tsx` | Pre-Mortem panel integration |
| `services/__tests__/preMortemService.test.ts` | Unit tests |
