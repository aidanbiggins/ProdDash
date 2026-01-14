# Capacity Fit Engine

## Overview

A defensible, data-driven module that answers:
- Do we need more recruiters or are we overstaffed?
- Is req load distributed optimally?
- Which recruiters are more effective for which talent profiles?

**Design Principles:**
- Explainable: Every number has a traceable derivation
- Sample-size gated: No metrics shown without statistical confidence
- Resistant to political misuse: Shrinkage prevents gaming, context is mandatory

---

## 1. Core Objects and Formulas

### 1.1 WorkloadScore(req)

Measures the current effort demand of a single requisition.

```
WorkloadScore(req) = BaseDifficulty(req) × RemainingWork(req) × FrictionMultiplier(req) × AgingMultiplier(req)
```

**Components:**

#### BaseDifficulty(req)
```typescript
BaseDifficulty = LevelWeight × MarketWeight × NicheWeight

// From existing complexityScoring.ts config:
LevelWeight = config.levelWeights[req.level] ?? 1.0        // Range: 0.8 - 1.5
MarketWeight = config.marketWeights[req.location_type]     // Remote: 0.9, Hybrid: 1.0, Onsite: 1.1
             + (isHardMarket ? config.marketWeights.hardMarketBonus : 0)  // +0.2 for hard markets
NicheWeight = config.nicheWeights[req.job_family] ?? 1.0   // Range: 0.8 - 1.4
```

**Example:** L5 Hybrid role in Engineering in SF = 1.2 × 1.0 × 1.1 × 1.0 = 1.32

#### RemainingWork(req)
```typescript
// Normalized 0-1 scale based on pipeline fullness and stage progression
RemainingWork = 1.0 - PipelineProgress

PipelineProgress = weighted_sum([
  (hasLeadsInPipeline ? 0.1 : 0),
  (hasScreenedCandidates ? 0.2 : 0),
  (hasInterviewingCandidates ? 0.3 : 0),
  (hasFinalistCandidates ? 0.3 : 0),
  (hasOfferOutstanding ? 0.1 : 0)
])
```

**Range:** 1.0 (empty pipeline) → 0.0 (offer accepted, nearly done)

#### FrictionMultiplier(req)
```typescript
// Based on HM responsiveness for this req's hiring manager
FrictionMultiplier = hmWeight  // From complexityScoring.ts, range 0.8 - 1.3

// Fallback if HM has insufficient data:
FrictionMultiplier = 1.0
```

#### AgingMultiplier(req)
```typescript
// Older reqs require more effort to revive/manage
AgingMultiplier = 1.0 + (reqAgeDays / 90) × 0.3

// Capped at 1.6 (180+ days)
AgingMultiplier = min(1.6, AgingMultiplier)
```

**Range:** 1.0 (new req) → 1.6 (6+ months old)

---

### 1.2 Demand(recruiter)

Total workload for a recruiter.

```typescript
Demand(recruiter) = Σ WorkloadScore(req) for all reqs where req.recruiter_id === recruiter.user_id
```

**Units:** Workload Units (WU) - dimensionless, relative scale

---

### 1.3 SustainableCapacityUnits

Historical baseline of what a recruiter can sustainably handle.

**Definition of "Stable Week":**
A week is considered "stable" for a recruiter if:
1. They had ≥3 open reqs that week
2. They made ≥1 candidate stage progression that week
3. They did not have a hire or req closure that week (avoiding spikes)
4. They were not on PTO (if PTO data available)

```typescript
// Calculate over trailing 26 weeks (6 months)
StableWeeks = weeks.filter(w => isStableWeek(w, recruiter))

// Sustainable capacity = median workload during stable weeks
SustainableCapacityUnits(recruiter) = median(StableWeeks.map(w =>
  Σ WorkloadScore(req) for reqs owned during week w
))

// Fallback if < 8 stable weeks:
SustainableCapacityUnits = TEAM_MEDIAN_CAPACITY  // Derived from team average
```

**Minimum data requirement:** 8 stable weeks for individual capacity; otherwise use team median

---

### 1.4 CapacityGap

Team-level supply/demand imbalance.

```typescript
TeamDemand = Σ Demand(recruiter) for all active recruiters
TeamCapacity = Σ SustainableCapacityUnits(recruiter) for all active recruiters

CapacityGap = TeamDemand - TeamCapacity

// Interpretation:
// CapacityGap > 0  → Understaffed (need more recruiters or fewer reqs)
// CapacityGap < 0  → Overstaffed (excess capacity)
// CapacityGap ≈ 0  → Balanced
```

**Confidence calculation:**
```typescript
Confidence = calculateConfidence(numRecruitersWithData, MIN_RECRUITERS_FOR_TEAM_METRICS)

// MIN_RECRUITERS_FOR_TEAM_METRICS = 3
// HIGH: ≥6 recruiters with individual capacity data
// MED: 4-5 recruiters
// LOW: 3 recruiters
// INSUFFICIENT: <3 recruiters (do not show)
```

---

### 1.5 PerformanceResidual

Measures how a recruiter performs vs. expectation for their cohort.

```typescript
PerformanceResidual(recruiter, metric, segment) =
  Observed(metric, recruiter, segment) - Expected(metric, segment)

// Where:
Observed = recruiter's actual metric value for that segment
Expected = median of all recruiters for that segment (cohort benchmark)
```

**Metrics tracked:**
| Metric | Definition | Direction |
|--------|------------|-----------|
| `hires_per_wu` | Hires / Demand units | Higher is better |
| `ttf_days` | Median time-to-fill | Lower is better |
| `offer_accept_rate` | Offers accepted / Offers extended | Higher is better |
| `candidate_throughput` | Candidates advanced / Week | Higher is better |

**Segment = (job_family, level_band, location_type)** — see Section 4

---

### 1.6 Shrinkage (Bayesian Regression to Mean)

Prevents small-sample outliers from dominating.

```typescript
AdjustedResidual = (n / (n + k)) × RawResidual

// Where:
n = sample size (number of observations for this recruiter in this segment)
k = shrinkage constant = 5 (tuned for typical recruiter data volumes)
```

**Effect:**
- n=1: AdjustedResidual = 1/6 × RawResidual (83% shrinkage)
- n=5: AdjustedResidual = 5/10 × RawResidual (50% shrinkage)
- n=20: AdjustedResidual = 20/25 × RawResidual (20% shrinkage)
- n=50: AdjustedResidual = 50/55 × RawResidual (9% shrinkage)

---

### 1.7 FitScore(recruiter, segment)

Composite score indicating recruiter effectiveness for a talent segment.

```typescript
FitScore(recruiter, segment) = Σ(weight_i × AdjustedResidual_i) / Σ(weight_i)

// Metric weights:
weights = {
  hires_per_wu: 0.4,        // Primary outcome
  ttf_days: 0.25,           // Speed (inverted: negative residual is good)
  offer_accept_rate: 0.2,   // Closing ability
  candidate_throughput: 0.15 // Activity level
}

// Note: ttf_days residual is inverted (multiplied by -1) before combining
```

**Interpretation:**
| FitScore | Label | Meaning |
|----------|-------|---------|
| > +0.3 | Strong Fit | Significantly outperforms cohort |
| +0.1 to +0.3 | Good Fit | Above average |
| -0.1 to +0.1 | Neutral | Average performance |
| -0.3 to -0.1 | Weak Fit | Below average |
| < -0.3 | Poor Fit | Significantly underperforms |

**Confidence for FitScore:**
```typescript
FitScoreConfidence = min(confidence across all metrics)

// Each metric confidence based on sample size:
// HIGH: n ≥ 10 observations
// MED: n ≥ 5 observations
// LOW: n ≥ 3 observations
// INSUFFICIENT: n < 3 (do not show FitScore)
```

---

## 2. Data Dependencies

### 2.1 Required Fields by Component

#### WorkloadScore
| Field | Source | Required | Fallback |
|-------|--------|----------|----------|
| `req.level` | reqs_canonical | Yes | Default to "IC3" → LevelWeight=1.0 |
| `req.location_type` | reqs_canonical | Yes | Default to "Hybrid" → MarketWeight=1.0 |
| `req.location_city` | reqs_canonical | No | Skip hard market bonus |
| `req.job_family` | reqs_canonical | Yes | Default to "General" → NicheWeight=1.0 |
| `req.recruiter_id` | reqs_canonical | Yes | **BLOCKED** - cannot calculate |
| `req.opened_at` | reqs_canonical | Yes | Use `created_at` or **BLOCKED** |
| `req.hiring_manager_id` | reqs_canonical | No | FrictionMultiplier=1.0 |
| `candidates[].current_stage` | candidates_canonical | Yes | RemainingWork=1.0 (assume empty) |

#### SustainableCapacityUnits
| Field | Source | Required | Fallback |
|-------|--------|----------|----------|
| `events[].event_at` | events_canonical | Yes | **BLOCKED** - need weekly activity |
| `events[].event_type` | events_canonical | Yes | **BLOCKED** |
| `req.recruiter_id` | reqs_canonical | Yes | **BLOCKED** |
| Historical req ownership | Derived from events | Yes | Use current ownership (less accurate) |

#### FitScore
| Field | Source | Required | Fallback |
|-------|--------|----------|----------|
| `req.job_family` | reqs_canonical | Yes | Cannot segment, **BLOCKED** for fit |
| `req.level` | reqs_canonical | Yes | Cannot segment, **BLOCKED** for fit |
| `req.location_type` | reqs_canonical | Yes | Cannot segment, **BLOCKED** for fit |
| `candidate.hired_at` | candidates_canonical | For hires metric | Exclude from hires_per_wu |
| `candidate.offer_sent_at` | candidates_canonical | For accept rate | Exclude from offer_accept_rate |

### 2.2 Blocking Conditions

The Capacity Fit Engine **will not render** if:
1. Fewer than 3 active recruiters with req assignments
2. Fewer than 10 total open reqs
3. No event data available (cannot calculate historical capacity)
4. `recruiter_id` missing on >50% of reqs

**UI behavior when blocked:**
Display banner: "Insufficient data for capacity analysis. Required: [specific missing items]"

---

## 3. Cohorting / Segmentation

### 3.1 V1 Segments

Primary segmentation for FitScore calculations:

| Dimension | Values | Derivation |
|-----------|--------|------------|
| `job_family` | Engineering, Product, Design, Sales, G&A, Operations | From `req.job_family` |
| `level_band` | Junior (L1-L2), Mid (L3-L4), Senior (L5-L6), Leadership (L7+) | From `req.level` |
| `location_type` | Remote, Hybrid, Onsite | From `req.location_type` |

**Total possible segments:** 6 × 4 × 3 = 72 cells

### 3.2 Minimum Sample Thresholds

| Granularity | Min Observations | Use Case |
|-------------|------------------|----------|
| Segment cell (job_family × level × location) | 3 | Show FitScore |
| Segment pair (job_family × level) | 5 | Show aggregated FitScore |
| Segment single (job_family only) | 8 | Show high-level FitScore |
| Team aggregate | 15 | Show team-level metrics |

### 3.3 Confidence Rules

```typescript
function calculateSegmentConfidence(n: number, minThreshold: number): ConfidenceLevel {
  if (n < minThreshold) return 'INSUFFICIENT';
  if (n < minThreshold * 1.5) return 'LOW';
  if (n < minThreshold * 2) return 'MED';
  return 'HIGH';
}
```

| Sample Size (n) | Confidence | Display Behavior |
|-----------------|------------|------------------|
| n < 3 | INSUFFICIENT | Do not show |
| 3 ≤ n < 5 | LOW | Show with warning badge |
| 5 ≤ n < 8 | MED | Show with yellow confidence |
| n ≥ 8 | HIGH | Show with green confidence |

---

## 4. V1 Outputs

### 4.1 Team Capacity Summary

**Card display:**
```
┌─────────────────────────────────────────────────┐
│ Team Capacity Overview           [HIGH confidence]│
├─────────────────────────────────────────────────┤
│                                                 │
│   Team Demand        │  Team Capacity           │
│   ████████████ 142   │  ██████████ 120          │
│                                                 │
│   Capacity Gap: +22 WU (18% understaffed)       │
│                                                 │
│   Top Drivers:                                  │
│   • 8 reqs with empty pipelines (+24 WU)        │
│   • 3 high-friction HMs (+12 WU)                │
│   • 5 aging reqs (90+ days) (+8 WU)             │
│                                                 │
└─────────────────────────────────────────────────┘
```

**Fields:**
| Field | Type | Description |
|-------|------|-------------|
| `teamDemand` | number | Sum of all WorkloadScores |
| `teamCapacity` | number | Sum of SustainableCapacityUnits |
| `capacityGap` | number | teamDemand - teamCapacity |
| `capacityGapPercent` | number | (gap / capacity) × 100 |
| `confidence` | ConfidenceLevel | Based on data coverage |
| `topDrivers` | CapacityDriver[] | Top 3 factors contributing to gap |

**CapacityDriver type:**
```typescript
interface CapacityDriver {
  type: 'empty_pipeline' | 'high_friction_hm' | 'aging_reqs' | 'niche_roles' | 'understaffed_function';
  description: string;
  impactWU: number;
  reqIds: string[];  // For drill-down
}
```

---

### 4.2 Recruiter Load Table

**Table columns:**
| Column | Description |
|--------|-------------|
| Recruiter | Name |
| Demand (WU) | Current workload score |
| Capacity (WU) | Sustainable capacity |
| Utilization | Demand / Capacity as % |
| Status | Overloaded (>110%), Balanced (90-110%), Available (<90%) |
| Top Driver | Primary reason for load |

**Status thresholds:**
```typescript
function getLoadStatus(utilization: number): LoadStatus {
  if (utilization > 1.2) return 'critical';    // >120%
  if (utilization > 1.1) return 'overloaded';  // 110-120%
  if (utilization > 0.9) return 'balanced';    // 90-110%
  if (utilization > 0.7) return 'available';   // 70-90%
  return 'underutilized';                       // <70%
}
```

**Row data type:**
```typescript
interface RecruiterLoadRow {
  odRecruiterId: string;
  recruiterName: string;
  demandWU: number;
  capacityWU: number;
  utilization: number;
  status: 'critical' | 'overloaded' | 'balanced' | 'available' | 'underutilized';
  topDriver: string;
  reqCount: number;
  confidence: ConfidenceLevel;
}
```

---

### 4.3 Rebalance Recommendations

**Display:** Collapsible section with top 5 suggested moves

```
┌─────────────────────────────────────────────────┐
│ Suggested Rebalances                    [5 moves]│
├─────────────────────────────────────────────────┤
│                                                 │
│ 1. Move "Sr. Engineer - Platform" (REQ-123)    │
│    From: Alice Chen (142% utilized)            │
│    To: Bob Smith (78% utilized)                │
│    Rationale: Bob has +0.4 FitScore for        │
│    Engineering/Senior/Remote segment           │
│    Impact: -8 WU for Alice, +8 WU for Bob      │
│                                        [Apply] │
│                                                 │
│ 2. Move "Product Designer" (REQ-456)           │
│    ...                                         │
└─────────────────────────────────────────────────┘
```

**RebalanceRecommendation type:**
```typescript
interface RebalanceRecommendation {
  reqId: string;
  reqTitle: string;
  fromRecruiterId: string;
  fromRecruiterName: string;
  fromUtilization: number;
  toRecruiterId: string;
  toRecruiterName: string;
  toUtilization: number;
  rationale: string;
  fitScoreImprovement: number | null;  // null if no fit data
  demandImpact: number;  // WU transferred
  rank: number;
}
```

---

### 4.4 Fit Matrix

**Heatmap display:** Recruiters (rows) × Segments (columns)

Only show cells where confidence ≥ LOW (n ≥ 3)

```
┌──────────────────────────────────────────────────────────────┐
│ Recruiter Fit by Segment                                     │
├──────────────────────────────────────────────────────────────┤
│              │ Eng/Senior │ Eng/Mid │ Product │ Sales │ ... │
├──────────────┼────────────┼─────────┼─────────┼───────┼─────┤
│ Alice Chen   │ +0.4 ●●●   │ +0.1 ●● │   —     │ -0.2 ●│     │
│ Bob Smith    │ +0.2 ●●    │ -0.1 ●● │ +0.3 ●●●│   —   │     │
│ Carol Davis  │   —        │ +0.5 ●●●│ +0.1 ●● │ +0.4 ●│     │
└──────────────────────────────────────────────────────────────┘

Legend: ●●● = HIGH confidence, ●● = MED, ● = LOW, — = insufficient data
Colors: Green (+0.3+), Light green (+0.1 to +0.3), Gray (-0.1 to +0.1),
        Light red (-0.3 to -0.1), Red (<-0.3)
```

**FitMatrixCell type:**
```typescript
interface FitMatrixCell {
  recruiterId: string;
  segment: SegmentKey;
  fitScore: number;
  confidence: ConfidenceLevel;
  sampleSize: number;
  metrics: {
    hires_per_wu: { value: number; residual: number; n: number };
    ttf_days: { value: number; residual: number; n: number };
    offer_accept_rate: { value: number; residual: number; n: number };
    candidate_throughput: { value: number; residual: number; n: number };
  };
}
```

---

### 4.5 Explain Drawers

#### "Why is recruiter X overloaded?"

**Trigger:** Click on overloaded recruiter row

**Content:**
```typescript
interface OverloadExplanation {
  recruiterId: string;
  recruiterName: string;
  currentDemand: number;
  sustainableCapacity: number;
  utilization: number;

  demandBreakdown: {
    reqId: string;
    reqTitle: string;
    workloadScore: number;
    components: {
      baseDifficulty: number;
      remainingWork: number;
      frictionMultiplier: number;
      agingMultiplier: number;
    };
  }[];

  capacityDerivation: {
    stableWeeksCount: number;
    medianWeeklyLoad: number;
    confidenceNote: string;
  };

  recommendations: string[];
}
```

**Display:**
```
┌─────────────────────────────────────────────────┐
│ Why is Alice Chen overloaded?                   │
├─────────────────────────────────────────────────┤
│ Current Load: 142 WU │ Capacity: 100 WU │ 142%  │
├─────────────────────────────────────────────────┤
│ Workload Breakdown (top reqs by WU):            │
│                                                 │
│ REQ-123 Sr. Engineer - Platform     18.2 WU    │
│   └─ BaseDifficulty: 1.32 (L5/Hybrid/Eng)      │
│   └─ RemainingWork: 0.9 (pipeline nearly empty)│
│   └─ FrictionMultiplier: 1.2 (slow HM)         │
│   └─ AgingMultiplier: 1.3 (95 days old)        │
│                                                 │
│ REQ-456 Engineering Manager         15.8 WU    │
│   └─ ...                                       │
│                                                 │
├─────────────────────────────────────────────────┤
│ Capacity Calculation:                           │
│ Based on 12 stable weeks in past 6 months      │
│ Median weekly load during stable periods: 100 WU│
│ Confidence: HIGH (sufficient history)          │
├─────────────────────────────────────────────────┤
│ Recommendations:                                │
│ • Consider moving REQ-123 to Bob Smith (+0.4 fit)│
│ • Escalate HM responsiveness on REQ-123        │
└─────────────────────────────────────────────────┘
```

#### "Why is recruiter X strong for segment Y?"

**Trigger:** Click on fit matrix cell

**Content:**
```typescript
interface FitExplanation {
  recruiterId: string;
  recruiterName: string;
  segment: SegmentKey;
  fitScore: number;
  confidence: ConfidenceLevel;

  metricBreakdown: {
    metric: string;
    observed: number;
    expected: number;
    rawResidual: number;
    sampleSize: number;
    shrinkageFactor: number;
    adjustedResidual: number;
    weight: number;
    contribution: number;  // weight × adjustedResidual
  }[];

  sampleReqs: {
    reqId: string;
    reqTitle: string;
    outcome: 'hired' | 'open' | 'closed_no_hire';
    ttfDays: number | null;
  }[];

  caveat: string | null;  // e.g., "Small sample size - interpret with caution"
}
```

**Display:**
```
┌─────────────────────────────────────────────────┐
│ Why is Bob Smith strong for Eng/Senior/Remote?  │
├─────────────────────────────────────────────────┤
│ FitScore: +0.42 │ Confidence: MED (n=7)        │
├─────────────────────────────────────────────────┤
│ Metric Breakdown:                               │
│                                                 │
│ Hires/WU (weight: 40%)                         │
│   Observed: 0.15 │ Expected: 0.11 │ +36%       │
│   Raw residual: +0.04                          │
│   After shrinkage (n=7, k=5): +0.023           │
│   Contribution: +0.23                          │
│                                                 │
│ TTF Days (weight: 25%)                         │
│   Observed: 38d │ Expected: 52d │ -27%         │
│   Raw residual: -14 days (good!)               │
│   After shrinkage: -8.2 days                   │
│   Contribution: +0.16                          │
│                                                 │
│ ...                                            │
├─────────────────────────────────────────────────┤
│ Sample Reqs (7 total):                         │
│ • REQ-789 Staff Engineer - Hired in 32d        │
│ • REQ-012 Sr. SRE - Hired in 41d               │
│ • REQ-345 Sr. Backend - Open (45d)             │
│ • ...                                          │
├─────────────────────────────────────────────────┤
│ ⚠️  Sample size of 7 is below HIGH threshold.   │
│    Interpret with appropriate caution.         │
└─────────────────────────────────────────────────┘
```

---

## 5. Rebalancing Optimization Algorithm

### 5.1 Greedy Algorithm (V1)

```typescript
function generateRebalanceRecommendations(
  recruiters: RecruiterLoadRow[],
  reqs: ReqWithWorkload[],
  fitMatrix: FitMatrixCell[],
  maxRecommendations: number = 5
): RebalanceRecommendation[] {

  const recommendations: RebalanceRecommendation[] = [];

  // Sort recruiters by utilization descending
  const overloaded = recruiters
    .filter(r => r.utilization > 1.1)
    .sort((a, b) => b.utilization - a.utilization);

  const available = recruiters
    .filter(r => r.utilization < 0.9)
    .sort((a, b) => a.utilization - b.utilization);

  for (const source of overloaded) {
    if (recommendations.length >= maxRecommendations) break;

    // Get moveable reqs (not in final stages)
    const moveableReqs = reqs
      .filter(r => r.recruiterId === source.recruiterId)
      .filter(r => !isInFinalStages(r))
      .sort((a, b) => b.workloadScore - a.workloadScore);

    for (const req of moveableReqs) {
      if (recommendations.length >= maxRecommendations) break;

      // Find best destination
      const segment = getSegment(req);
      const bestDest = findBestDestination(req, segment, available, fitMatrix);

      if (bestDest && isValidMove(source, bestDest, req)) {
        recommendations.push({
          reqId: req.reqId,
          reqTitle: req.reqTitle,
          fromRecruiterId: source.recruiterId,
          fromRecruiterName: source.recruiterName,
          fromUtilization: source.utilization,
          toRecruiterId: bestDest.recruiterId,
          toRecruiterName: bestDest.recruiterName,
          toUtilization: bestDest.utilization,
          rationale: generateRationale(source, bestDest, req, fitMatrix),
          fitScoreImprovement: getFitImprovement(source, bestDest, segment, fitMatrix),
          demandImpact: req.workloadScore,
          rank: recommendations.length + 1
        });

        // Update simulated utilizations for next iteration
        source.utilization -= req.workloadScore / source.capacityWU;
        bestDest.utilization += req.workloadScore / bestDest.capacityWU;
      }
    }
  }

  return recommendations;
}
```

### 5.2 Constraints

```typescript
function isValidMove(source: RecruiterLoadRow, dest: RecruiterLoadRow, req: ReqWithWorkload): boolean {
  // Constraint 1: Don't overload destination
  const newDestUtil = dest.utilization + (req.workloadScore / dest.capacityWU);
  if (newDestUtil > 1.05) return false;  // Max 105% after move

  // Constraint 2: Must meaningfully help source
  const newSourceUtil = source.utilization - (req.workloadScore / source.capacityWU);
  if (source.utilization - newSourceUtil < 0.05) return false;  // Must reduce by at least 5%

  // Constraint 3: Don't move if destination has poor fit
  const destFit = getFitScore(dest.recruiterId, getSegment(req));
  if (destFit !== null && destFit < -0.2) return false;  // Don't assign to poor fit

  // Constraint 4: Limit churn per recruiter
  // (tracked externally - max 2 moves away from any recruiter)

  return true;
}

function isInFinalStages(req: ReqWithWorkload): boolean {
  // Don't move reqs with candidates in offer or final interview
  return req.hasOfferOut || req.hasFinalist;
}
```

### 5.3 Destination Selection

```typescript
function findBestDestination(
  req: ReqWithWorkload,
  segment: SegmentKey,
  available: RecruiterLoadRow[],
  fitMatrix: FitMatrixCell[]
): RecruiterLoadRow | null {

  let bestDest: RecruiterLoadRow | null = null;
  let bestScore = -Infinity;

  for (const dest of available) {
    const fitCell = fitMatrix.find(c =>
      c.recruiterId === dest.recruiterId &&
      c.segment === segment
    );

    // Score = fit bonus + availability bonus
    const fitBonus = fitCell?.fitScore ?? 0;  // -1 to +1 range
    const availBonus = (1 - dest.utilization) * 0.5;  // 0 to 0.5 range
    const score = fitBonus + availBonus;

    if (score > bestScore) {
      bestScore = score;
      bestDest = dest;
    }
  }

  return bestDest;
}
```

---

## 6. UI Placement

### 6.1 Location

**New Tab: "Capacity"** — placed after "Hiring Managers" tab

Rationale:
- Control Tower is for quick daily triage; capacity planning is periodic
- Separate tab allows full-page visualizations
- Clear mental model: "I'm doing capacity planning now"

### 6.2 Design Principles (Non-Punitive)

1. **Lead with team health, not individual blame**
   - First section is always "Team Capacity Overview"
   - Individual recruiter table sorted by utilization, not "performance"

2. **Frame as workload distribution, not ranking**
   - Avoid terms like "best/worst recruiter"
   - Use "Fit" not "Performance" for segment scores
   - Show shrinkage visibly to emphasize statistical uncertainty

3. **Require context for all numbers**
   - Every metric has an explain drawer
   - Confidence badges are mandatory
   - Sample sizes shown inline

4. **Recommendations are suggestions, not mandates**
   - "Suggested Rebalances" not "Required Actions"
   - [Apply] button is optional, not automatic
   - Rationale always shown

5. **Hide low-confidence data by default**
   - Fit matrix cells with n < 3 show "—"
   - Toggle to "Show all (including low confidence)" available but off by default

### 6.3 Required Charts/Tables

| Component | Type | Location |
|-----------|------|----------|
| Team Capacity Summary | Card | Top of page |
| Capacity Gap Gauge | Gauge chart | In summary card |
| Recruiter Load Table | Sortable table | Below summary |
| Load Distribution | Horizontal bar chart | Beside table |
| Fit Matrix | Heatmap | Collapsible section |
| Rebalance Recommendations | List | Collapsible section |
| Explain Drawer (Overload) | Drawer/modal | On row click |
| Explain Drawer (Fit) | Drawer/modal | On cell click |

---

## 7. Test Plan

### 7.1 Unit Tests

**File:** `services/__tests__/capacityFitEngine.test.ts`

```typescript
describe('WorkloadScore', () => {
  it('calculates BaseDifficulty from level, market, niche weights', () => {
    const req = mockReq({ level: 'L5', location_type: 'Hybrid', job_family: 'Engineering' });
    const config = mockConfig({ levelWeights: { L5: 1.2 }, marketWeights: { Hybrid: 1.0 }, nicheWeights: { Engineering: 1.1 } });
    expect(calculateBaseDifficulty(req, config)).toBeCloseTo(1.32);
  });

  it('applies hard market bonus correctly', () => {
    const req = mockReq({ location_type: 'Onsite', location_city: 'San Francisco' });
    const config = mockConfig({ hardMarketsList: ['San Francisco'], hardMarketBonus: 0.2 });
    expect(calculateBaseDifficulty(req, config)).toBeCloseTo(1.3);  // 1.1 + 0.2
  });

  it('calculates RemainingWork based on pipeline stages', () => {
    expect(calculateRemainingWork(mockReq({ pipeline: [] }))).toBe(1.0);
    expect(calculateRemainingWork(mockReq({ pipeline: [{ stage: 'OFFER' }] }))).toBe(0.1);
  });

  it('caps AgingMultiplier at 1.6', () => {
    expect(calculateAgingMultiplier(0)).toBe(1.0);
    expect(calculateAgingMultiplier(90)).toBeCloseTo(1.3);
    expect(calculateAgingMultiplier(180)).toBe(1.6);
    expect(calculateAgingMultiplier(365)).toBe(1.6);  // Capped
  });
});

describe('Demand', () => {
  it('sums WorkloadScores for all recruiter reqs', () => {
    const reqs = [
      mockReqWithScore('r1', 10),
      mockReqWithScore('r1', 15),
      mockReqWithScore('r2', 20)
    ];
    expect(calculateDemand('r1', reqs)).toBe(25);
  });
});

describe('SustainableCapacityUnits', () => {
  it('returns median of stable weeks', () => {
    const weeklyLoads = [80, 90, 100, 110, 120];
    expect(calculateSustainableCapacity(weeklyLoads)).toBe(100);
  });

  it('falls back to team median with insufficient stable weeks', () => {
    const weeklyLoads = [80, 90];  // Only 2 weeks
    const teamMedian = 95;
    expect(calculateSustainableCapacity(weeklyLoads, { minWeeks: 8, teamMedian })).toBe(95);
  });
});

describe('Shrinkage', () => {
  it('applies correct shrinkage factor', () => {
    expect(applyShrinkage(1.0, 1, 5)).toBeCloseTo(0.167);  // 1/6
    expect(applyShrinkage(1.0, 5, 5)).toBeCloseTo(0.5);    // 5/10
    expect(applyShrinkage(1.0, 20, 5)).toBeCloseTo(0.8);   // 20/25
  });
});

describe('FitScore', () => {
  it('combines weighted residuals correctly', () => {
    const residuals = {
      hires_per_wu: { adjusted: 0.5, weight: 0.4 },
      ttf_days: { adjusted: -0.2, weight: 0.25 },  // Inverted
      offer_accept_rate: { adjusted: 0.1, weight: 0.2 },
      candidate_throughput: { adjusted: 0.0, weight: 0.15 }
    };
    // (0.5*0.4) + (0.2*0.25) + (0.1*0.2) + (0*0.15) = 0.2 + 0.05 + 0.02 = 0.27
    expect(calculateFitScore(residuals)).toBeCloseTo(0.27);
  });

  it('returns null when any metric has insufficient data', () => {
    const residuals = {
      hires_per_wu: { adjusted: 0.5, weight: 0.4, n: 5 },
      ttf_days: { adjusted: -0.2, weight: 0.25, n: 2 }  // Below threshold
    };
    expect(calculateFitScore(residuals, { minN: 3 })).toBeNull();
  });
});
```

### 7.2 Synthetic Scenario Tests

**File:** `services/__tests__/capacityFitEngine.scenarios.test.ts`

```typescript
describe('Scenario: Understaffed Team', () => {
  it('correctly identifies understaffing', () => {
    const scenario = createScenario({
      recruiters: 3,
      openReqs: 30,  // 10 reqs per recruiter
      avgWorkloadPerReq: 10,
      avgCapacityPerRecruiter: 80
    });
    // Demand: 30 * 10 = 300, Capacity: 3 * 80 = 240
    const result = analyzeCapacity(scenario);
    expect(result.capacityGap).toBe(60);
    expect(result.capacityGapPercent).toBeCloseTo(25);
    expect(result.status).toBe('understaffed');
  });
});

describe('Scenario: Overstaffed Team', () => {
  it('correctly identifies overstaffing', () => {
    const scenario = createScenario({
      recruiters: 5,
      openReqs: 15,
      avgWorkloadPerReq: 10,
      avgCapacityPerRecruiter: 100
    });
    // Demand: 15 * 10 = 150, Capacity: 5 * 100 = 500
    const result = analyzeCapacity(scenario);
    expect(result.capacityGap).toBe(-350);
    expect(result.status).toBe('overstaffed');
  });
});

describe('Scenario: Uneven Load Distribution', () => {
  it('identifies overloaded and available recruiters', () => {
    const scenario = createScenario({
      recruiters: [
        { id: 'r1', reqs: 12, capacity: 80 },   // 150% utilized
        { id: 'r2', reqs: 3, capacity: 100 },   // 30% utilized
        { id: 'r3', reqs: 5, capacity: 90 }     // 56% utilized
      ]
    });
    const result = analyzeCapacity(scenario);
    expect(result.recruiterLoads.find(r => r.id === 'r1')?.status).toBe('critical');
    expect(result.recruiterLoads.find(r => r.id === 'r2')?.status).toBe('underutilized');
    expect(result.rebalanceRecommendations.length).toBeGreaterThan(0);
    expect(result.rebalanceRecommendations[0].fromRecruiterId).toBe('r1');
    expect(result.rebalanceRecommendations[0].toRecruiterId).toBe('r2');
  });
});

describe('Scenario: Recruiter Fit Differences', () => {
  it('applies shrinkage appropriately to fit scores', () => {
    const scenario = createScenario({
      recruiters: [
        { id: 'r1', segment: 'Eng/Senior', hires: 10, expected: 8 },  // +25% raw, n=10
        { id: 'r2', segment: 'Eng/Senior', hires: 2, expected: 1 }    // +100% raw, n=2
      ]
    });
    const result = analyzeCapacity(scenario);

    // r1: raw residual +0.25, shrinkage 10/(10+5) = 0.67, adjusted = 0.167
    // r2: raw residual +1.0, shrinkage 2/(2+5) = 0.29, adjusted = 0.29
    // But r2 should be hidden due to n < 3
    const r1Fit = result.fitMatrix.find(c => c.recruiterId === 'r1');
    const r2Fit = result.fitMatrix.find(c => c.recruiterId === 'r2');

    expect(r1Fit?.confidence).toBe('HIGH');
    expect(r2Fit?.confidence).toBe('INSUFFICIENT');
  });

  it('shrinks small-sample outliers toward mean', () => {
    // Recruiter with amazing results but tiny sample should be shrunk
    const r1 = { hires: 5, expected: 2, n: 3 };  // +150% raw
    const r2 = { hires: 20, expected: 16, n: 20 };  // +25% raw

    const r1Adjusted = applyShrinkage(1.5, 3, 5);  // 3/8 * 1.5 = 0.56
    const r2Adjusted = applyShrinkage(0.25, 20, 5);  // 20/25 * 0.25 = 0.20

    // Despite r1 having 6x the raw performance, after shrinkage r2 should be trusted more
    expect(r2Adjusted).toBeLessThan(r1Adjusted);  // Still true
    expect(r1Adjusted).toBeLessThan(1.5);  // Significantly shrunk
  });
});

describe('Scenario: Rebalancing Respects Constraints', () => {
  it('does not move reqs in final stages', () => {
    const scenario = createScenario({
      recruiters: [
        { id: 'r1', utilization: 1.5 },
        { id: 'r2', utilization: 0.5 }
      ],
      reqs: [
        { id: 'req1', recruiter: 'r1', hasOfferOut: true },
        { id: 'req2', recruiter: 'r1', hasOfferOut: false }
      ]
    });
    const result = analyzeCapacity(scenario);
    expect(result.rebalanceRecommendations.map(r => r.reqId)).not.toContain('req1');
    expect(result.rebalanceRecommendations.map(r => r.reqId)).toContain('req2');
  });

  it('does not overload destination recruiter', () => {
    const scenario = createScenario({
      recruiters: [
        { id: 'r1', demand: 150, capacity: 100 },  // 150%
        { id: 'r2', demand: 95, capacity: 100 }    // 95% - near full
      ],
      reqs: [
        { id: 'req1', recruiter: 'r1', workload: 20 }  // Would push r2 to 115%
      ]
    });
    const result = analyzeCapacity(scenario);
    // Should not recommend moving to r2 since it would exceed 105%
    expect(result.rebalanceRecommendations.find(r => r.toRecruiterId === 'r2')).toBeUndefined();
  });
});
```

### 7.3 UI Render Tests

**File:** `components/__tests__/CapacityTab.test.tsx`

```typescript
describe('CapacityTab', () => {
  it('renders team capacity summary card', () => {
    render(<CapacityTab data={mockCapacityData()} />);
    expect(screen.getByText('Team Capacity Overview')).toBeInTheDocument();
    expect(screen.getByText(/Team Demand/)).toBeInTheDocument();
    expect(screen.getByText(/Team Capacity/)).toBeInTheDocument();
  });

  it('shows insufficient data banner when blocked', () => {
    render(<CapacityTab data={mockCapacityData({ blocked: true, reason: 'fewer than 3 recruiters' })} />);
    expect(screen.getByText(/Insufficient data/)).toBeInTheDocument();
    expect(screen.getByText(/fewer than 3 recruiters/)).toBeInTheDocument();
  });

  it('renders recruiter load table with correct statuses', () => {
    const data = mockCapacityData({
      recruiters: [
        { name: 'Alice', utilization: 1.3, status: 'critical' },
        { name: 'Bob', utilization: 0.6, status: 'underutilized' }
      ]
    });
    render(<CapacityTab data={data} />);

    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('130%')).toBeInTheDocument();
    expect(screen.getByText('critical')).toHaveClass('badge-danger');

    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('60%')).toBeInTheDocument();
  });

  it('opens explain drawer on recruiter row click', async () => {
    render(<CapacityTab data={mockCapacityData()} />);

    fireEvent.click(screen.getByText('Alice'));

    await waitFor(() => {
      expect(screen.getByText('Why is Alice overloaded?')).toBeInTheDocument();
    });
  });

  it('hides low-confidence fit matrix cells by default', () => {
    const data = mockCapacityData({
      fitMatrix: [
        { recruiter: 'Alice', segment: 'Eng/Senior', fitScore: 0.4, confidence: 'HIGH' },
        { recruiter: 'Alice', segment: 'Sales', fitScore: 0.8, confidence: 'INSUFFICIENT' }
      ]
    });
    render(<CapacityTab data={data} />);

    expect(screen.getByText('+0.4')).toBeInTheDocument();
    expect(screen.queryByText('+0.8')).not.toBeInTheDocument();  // Hidden
    expect(screen.getByText('—')).toBeInTheDocument();  // Placeholder for insufficient
  });

  it('shows confidence badges on all metrics', () => {
    render(<CapacityTab data={mockCapacityData({ teamConfidence: 'MED' })} />);
    expect(screen.getByText('MED confidence')).toBeInTheDocument();
  });
});
```

---

## 8. Non-Goals (V1)

1. **No LLM for calculations** — All formulas are deterministic and explainable
2. **No external market data** — No salary benchmarks, no competitor intel
3. **No hidden/opaque scoring** — Every number has visible derivation
4. **No auto-reassignment** — Recommendations only, human approval required
5. **No real-time updates** — Batch calculation on data refresh
6. **No cross-team comparisons** — Single org/team scope only
7. **No historical trending** — Point-in-time snapshot only (trending in V2)

---

## 9. File List (Implementation)

### Services
| File | Purpose |
|------|---------|
| `services/capacityFitEngine.ts` | Core calculation engine |
| `services/workloadScoring.ts` | WorkloadScore calculation |
| `services/sustainableCapacity.ts` | Historical capacity analysis |
| `services/fitScoring.ts` | FitScore and shrinkage |
| `services/rebalanceOptimizer.ts` | Greedy rebalancing algorithm |

### Types
| File | Purpose |
|------|---------|
| `types/capacityTypes.ts` | All capacity-related interfaces |

### Components
| File | Purpose |
|------|---------|
| `components/capacity/CapacityTab.tsx` | Main tab container |
| `components/capacity/TeamCapacitySummary.tsx` | Summary card |
| `components/capacity/RecruiterLoadTable.tsx` | Load table |
| `components/capacity/FitMatrix.tsx` | Heatmap component |
| `components/capacity/RebalanceRecommendations.tsx` | Suggestions list |
| `components/capacity/OverloadExplainDrawer.tsx` | Explain drawer |
| `components/capacity/FitExplainDrawer.tsx` | Explain drawer |

### Tests
| File | Purpose |
|------|---------|
| `services/__tests__/capacityFitEngine.test.ts` | Unit tests |
| `services/__tests__/capacityFitEngine.scenarios.test.ts` | Scenario tests |
| `components/__tests__/CapacityTab.test.tsx` | UI render tests |

---

## 10. Implementation Order

1. **Types** — Define all interfaces first
2. **workloadScoring.ts** — WorkloadScore calculation
3. **sustainableCapacity.ts** — Historical capacity
4. **fitScoring.ts** — FitScore with shrinkage
5. **capacityFitEngine.ts** — Orchestration layer
6. **Unit tests** — Validate calculations
7. **TeamCapacitySummary** — First UI component
8. **RecruiterLoadTable** — Second UI component
9. **Scenario tests** — Validate end-to-end
10. **rebalanceOptimizer.ts** — Optimization
11. **FitMatrix** — Heatmap UI
12. **Explain drawers** — Detail views
13. **UI tests** — Validate rendering
14. **CapacityTab** — Final assembly

---

## Appendix A: Constants

```typescript
// Shrinkage constant
const SHRINKAGE_K = 5;

// Capacity thresholds
const MIN_STABLE_WEEKS = 8;
const MIN_RECRUITERS_FOR_TEAM = 3;
const MIN_REQS_FOR_ANALYSIS = 10;

// Utilization thresholds
const UTILIZATION_CRITICAL = 1.2;
const UTILIZATION_OVERLOADED = 1.1;
const UTILIZATION_BALANCED_HIGH = 1.1;
const UTILIZATION_BALANCED_LOW = 0.9;
const UTILIZATION_AVAILABLE = 0.7;

// Fit thresholds
const FIT_STRONG = 0.3;
const FIT_GOOD = 0.1;
const FIT_WEAK = -0.1;
const FIT_POOR = -0.3;

// Sample thresholds
const MIN_N_FOR_FIT_CELL = 3;
const MIN_N_FOR_FIT_PAIR = 5;
const MIN_N_FOR_FIT_SINGLE = 8;
const MIN_N_FOR_TEAM = 15;

// Aging multiplier
const AGING_CAP = 1.6;
const AGING_SCALE_DAYS = 90;
const AGING_SCALE_FACTOR = 0.3;

// Rebalancing constraints
const MAX_DEST_UTILIZATION_AFTER_MOVE = 1.05;
const MIN_SOURCE_RELIEF = 0.05;
const MAX_MOVES_PER_RECRUITER = 2;
const MIN_FIT_FOR_ASSIGNMENT = -0.2;
```

---

## Appendix B: Glossary

| Term | Definition |
|------|------------|
| **WU** | Workload Units — dimensionless measure of req effort |
| **Shrinkage** | Statistical technique to pull small-sample estimates toward population mean |
| **Residual** | Difference between observed and expected performance |
| **Segment** | Cohort defined by (job_family, level_band, location_type) |
| **Stable Week** | Week with normal recruiting activity, no spikes |
| **FitScore** | Composite measure of recruiter effectiveness for a segment |
| **Time Tax** | Percentage of hiring cycle lost to waiting (from HM friction) |
