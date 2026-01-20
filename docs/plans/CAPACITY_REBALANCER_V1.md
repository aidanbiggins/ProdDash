# CAPACITY_REBALANCER_V1

## Overview

A manager-grade tool that answers three critical capacity planning questions:
1. **Who is overloaded vs has slack?** — Recruiter utilization analysis
2. **Which req moves reduce delay the most?** — Intelligent reassignment suggestions
3. **What is the predicted improvement?** — Capacity-aware impact estimation

**Design Principles:**
- Uses global workload (not per-req) for accurate demand assessment
- Leverages existing capacity infrastructure: `inferCapacity()`, `computeGlobalDemand()`, `applyCapacityPenaltyV11()`
- Explainable and hedged with confidence badges
- Privacy-first: anonymized by default
- Fails closed with clear "unlock more" CTAs when data is insufficient

---

## 1. Formal Problem Definition

### 1.1 Inputs

| Input | Source | Required | Notes |
|-------|--------|----------|-------|
| Open requisitions | `Requisition[]` | Yes | Must have `req_id`; `recruiter_id` optional but critical |
| Candidates | `Candidate[]` | Yes | With `current_stage`, `disposition`, `req_id` |
| Capacity profile per recruiter | `inferCapacity()` | Computed | Throughput per week by stage |
| Global demand per recruiter | `computeGlobalDemand()` | Computed | Candidates in flight by stage |
| Users | `User[]` | Optional | For name lookups |
| Date range | `{ start: Date, end: Date }` | Yes | For capacity inference window |

### 1.2 Outputs

| Output | Type | Description |
|--------|------|-------------|
| Recruiter Utilization Table | `RecruiterUtilizationRow[]` | Per-recruiter demand, capacity, utilization %, status |
| Slack/Overload Classification | `LoadStatus` | GREEN/AMBER/RED with confidence and reasons |
| Suggested Reassignments | `ReassignmentSuggestion[]` | Move req X from A to B, with predicted improvement |
| Predicted Improvement | `ImpactEstimate` | Queue delay reduction, utilization delta |
| Action Plan | `ActionItem[]` | Deduped actions to execute moves |

---

## 2. Utilization Model

### 2.1 Stage-Level Utilization

For each recruiter `r` and stage `s`:

```typescript
interface StageUtilization {
    stage: CanonicalStage;
    demand: number;         // count(candidates in stage s across all open reqs owned by r)
    capacity: number;       // inferred throughput per week for stage s
    utilization: number;    // demand / max(capacity, EPSILON)
    confidence: ConfidenceLevel;
}

// Formula
demand_rs = count(activeCandidates where req.recruiter_id === r AND current_stage === s)
capacity_rs = capacityProfile.recruiter[stageToCapacityKey(s)]?.throughput_per_week ?? COHORT_DEFAULT[s]
utilization_rs = demand_rs / max(capacity_rs, 0.1)  // EPSILON = 0.1 to avoid divide by zero
```

### 2.2 Overall Utilization

```typescript
// Weighted average across capacity-limited stages
const STAGE_WEIGHTS: Record<CanonicalStage, number> = {
    [CanonicalStage.SCREEN]: 0.35,    // Highest volume, recruiter-driven
    [CanonicalStage.HM_SCREEN]: 0.25, // HM-driven but recruiter coordinates
    [CanonicalStage.ONSITE]: 0.25,    // Significant coordination effort
    [CanonicalStage.OFFER]: 0.15      // Lower volume but high stakes
};

overallUtilization_r = Σ (STAGE_WEIGHTS[s] × utilization_rs) / Σ STAGE_WEIGHTS
```

### 2.3 Load Status Classification

```typescript
type LoadStatus = 'critical' | 'overloaded' | 'balanced' | 'available' | 'underutilized';

function getLoadStatus(utilization: number): LoadStatus {
    if (utilization > 1.20) return 'critical';      // RED - > 120%
    if (utilization > 1.10) return 'overloaded';    // AMBER - 110-120%
    if (utilization > 0.90) return 'balanced';      // GREEN - 90-110%
    if (utilization > 0.70) return 'available';     // BLUE - 70-90%
    return 'underutilized';                          // GRAY - < 70%
}

// Color mapping for UI
const LOAD_STATUS_COLORS: Record<LoadStatus, string> = {
    critical: '#ef4444',      // Red
    overloaded: '#f59e0b',    // Amber
    balanced: '#10b981',      // Green
    available: '#3b82f6',     // Blue
    underutilized: '#94a3b8'  // Gray
};
```

### 2.4 Confidence Rules

```typescript
interface UtilizationConfidence {
    confidence: ConfidenceLevel;
    reasons: ConfidenceReason[];
}

function computeUtilizationConfidence(
    recruiterId: string | null,
    capacityProfile: OracleCapacityProfile,
    recruiterIdCoverage: number
): UtilizationConfidence {
    const reasons: ConfidenceReason[] = [];

    // Rule 1: recruiter_id must be present
    if (!recruiterId) {
        return {
            confidence: 'INSUFFICIENT',
            reasons: [{ type: 'missing_data', message: 'No recruiter_id', impact: 'negative' }]
        };
    }

    // Rule 2: Check capacity inference quality
    const recruiterCapacity = capacityProfile.recruiter;
    if (!recruiterCapacity || capacityProfile.used_cohort_fallback) {
        reasons.push({
            type: 'sample_size',
            message: 'Using cohort defaults for capacity',
            impact: 'neutral'
        });
    }

    // Rule 3: Check n_transitions and n_weeks
    if (recruiterCapacity) {
        const minTransitions = Math.min(
            recruiterCapacity.screens_per_week.n_transitions,
            recruiterCapacity.onsites_per_week?.n_transitions ?? 0,
            recruiterCapacity.offers_per_week?.n_transitions ?? 0
        );

        if (minTransitions >= 15) {
            reasons.push({ type: 'sample_size', message: 'Good sample size', impact: 'positive' });
            return { confidence: 'HIGH', reasons };
        } else if (minTransitions >= 5) {
            reasons.push({ type: 'sample_size', message: 'Moderate sample size', impact: 'neutral' });
            return { confidence: 'MED', reasons };
        } else {
            reasons.push({ type: 'sample_size', message: 'Limited sample size', impact: 'negative' });
            return { confidence: 'LOW', reasons };
        }
    }

    // Rule 4: Global recruiter_id coverage check
    if (recruiterIdCoverage < 0.5) {
        return {
            confidence: 'LOW',
            reasons: [...reasons, { type: 'missing_data', message: `Only ${Math.round(recruiterIdCoverage * 100)}% of reqs have recruiter_id`, impact: 'negative' }]
        };
    }

    return { confidence: 'MED', reasons };
}
```

---

## 3. Rebalancing Algorithm

### 3.1 Design Principles

1. **Req-level proxy**: Moving a req moves all its pipeline demand
2. **Simple and defensible**: Single-move greedy optimization, not complex combinatorial
3. **Constraint-aware**: Respect MAX_DEST_UTILIZATION_AFTER_MOVE, MIN_SOURCE_RELIEF
4. **Cohort matching**: Prefer target recruiters with similar job_family/level/location experience

### 3.2 Move Generation

```typescript
interface ReassignmentCandidate {
    reqId: string;
    reqTitle: string;
    fromRecruiterId: string;
    fromRecruiterName: string;
    toRecruiterId: string;
    toRecruiterName: string;
    reqDemand: OraclePipelineByStage;  // Candidates by stage on this req
}

function generateMoveOptions(
    overloadedRecruiters: RecruiterUtilizationRow[],
    availableRecruiters: RecruiterUtilizationRow[],
    requisitions: Requisition[],
    candidates: Candidate[]
): ReassignmentCandidate[] {
    const options: ReassignmentCandidate[] = [];

    for (const source of overloadedRecruiters) {
        // Get reqs owned by this overloaded recruiter
        const sourceReqs = requisitions.filter(r => r.recruiter_id === source.recruiterId);

        for (const req of sourceReqs) {
            // Count pipeline for this req
            const reqCandidates = candidates.filter(c =>
                c.req_id === req.req_id &&
                c.disposition === CandidateDisposition.Active
            );

            // Skip reqs with no active candidates (no demand to move)
            if (reqCandidates.length === 0) continue;

            // Compute demand by stage
            const reqDemand: OraclePipelineByStage = {};
            for (const c of reqCandidates) {
                reqDemand[c.current_stage] = (reqDemand[c.current_stage] || 0) + 1;
            }

            // Find suitable targets
            for (const target of availableRecruiters) {
                // Skip same recruiter
                if (target.recruiterId === source.recruiterId) continue;

                options.push({
                    reqId: req.req_id,
                    reqTitle: req.title,
                    fromRecruiterId: source.recruiterId,
                    fromRecruiterName: source.recruiterName,
                    toRecruiterId: target.recruiterId,
                    toRecruiterName: target.recruiterName,
                    reqDemand
                });
            }
        }
    }

    return options;
}
```

### 3.3 Move Scoring

```typescript
interface MoveScore {
    move: ReassignmentCandidate;
    score: number;
    beforeState: {
        sourceUtilization: number;
        sourceQueueDelay: number;
        targetUtilization: number;
        targetQueueDelay: number;
    };
    afterState: {
        sourceUtilization: number;
        sourceQueueDelay: number;
        targetUtilization: number;
        targetQueueDelay: number;
    };
    expectedDelayReduction: number;
    utilizationBalanceImprovement: number;
    confidence: ConfidenceLevel;
    hedgeMessage: string;
}

function scoreMove(
    move: ReassignmentCandidate,
    allCandidates: Candidate[],
    allRequisitions: Requisition[],
    capacityProfiles: Map<string, OracleCapacityProfile>
): MoveScore {
    // 1. Compute BEFORE state for source recruiter
    const beforeSourceDemand = computeGlobalDemand({
        selectedReqId: move.reqId,  // arbitrary, not used for global calc
        recruiterId: move.fromRecruiterId,
        hmId: null,
        allCandidates,
        allRequisitions
    });

    const sourceProfile = capacityProfiles.get(move.fromRecruiterId) ?? DEFAULT_PROFILE;
    const beforeSourcePenalty = applyCapacityPenaltyV11(
        DEFAULT_STAGE_DURATIONS,
        beforeSourceDemand,
        sourceProfile
    );

    // 2. Compute BEFORE state for target recruiter
    const beforeTargetDemand = computeGlobalDemand({
        selectedReqId: move.reqId,
        recruiterId: move.toRecruiterId,
        hmId: null,
        allCandidates,
        allRequisitions
    });

    const targetProfile = capacityProfiles.get(move.toRecruiterId) ?? DEFAULT_PROFILE;
    const beforeTargetPenalty = applyCapacityPenaltyV11(
        DEFAULT_STAGE_DURATIONS,
        beforeTargetDemand,
        targetProfile
    );

    // 3. Simulate AFTER state (move req from source to target)
    const simulatedRequisitions = allRequisitions.map(r =>
        r.req_id === move.reqId
            ? { ...r, recruiter_id: move.toRecruiterId }
            : r
    );

    const afterSourceDemand = computeGlobalDemand({
        selectedReqId: move.reqId,
        recruiterId: move.fromRecruiterId,
        hmId: null,
        allCandidates,
        allRequisitions: simulatedRequisitions
    });

    const afterTargetDemand = computeGlobalDemand({
        selectedReqId: move.reqId,
        recruiterId: move.toRecruiterId,
        hmId: null,
        allCandidates,
        allRequisitions: simulatedRequisitions
    });

    const afterSourcePenalty = applyCapacityPenaltyV11(
        DEFAULT_STAGE_DURATIONS,
        afterSourceDemand,
        sourceProfile
    );

    const afterTargetPenalty = applyCapacityPenaltyV11(
        DEFAULT_STAGE_DURATIONS,
        afterTargetDemand,
        targetProfile
    );

    // 4. Calculate deltas
    const sourceDelayReduction = beforeSourcePenalty.total_queue_delay_days - afterSourcePenalty.total_queue_delay_days;
    const targetDelayIncrease = afterTargetPenalty.total_queue_delay_days - beforeTargetPenalty.total_queue_delay_days;
    const netDelayReduction = sourceDelayReduction - targetDelayIncrease;

    // 5. Check constraints
    const afterTargetUtilization = computeOverallUtilization(afterTargetDemand, targetProfile);
    const violatesConstraint = afterTargetUtilization > CAPACITY_CONSTANTS.MAX_DEST_UTILIZATION_AFTER_MOVE;

    // 6. Compute score
    // Score = expected_delay_reduction - transfer_cost_penalty
    const TRANSFER_COST_DAYS = 2;  // Penalty for context-switch overhead
    const score = violatesConstraint ? -1000 : (netDelayReduction - TRANSFER_COST_DAYS);

    // 7. Determine confidence and hedge message
    const minConfidence = [
        beforeSourcePenalty.confidence,
        beforeTargetPenalty.confidence,
        sourceProfile.overall_confidence,
        targetProfile.overall_confidence
    ].sort((a, b) => CONFIDENCE_ORDER.indexOf(a) - CONFIDENCE_ORDER.indexOf(b))[0];

    const hedgeMessage = minConfidence === 'HIGH'
        ? 'Based on observed patterns'
        : minConfidence === 'MED'
            ? 'Based on similar cohorts'
            : 'Estimated (limited data)';

    return {
        move,
        score,
        beforeState: {
            sourceUtilization: computeOverallUtilization(beforeSourceDemand, sourceProfile),
            sourceQueueDelay: beforeSourcePenalty.total_queue_delay_days,
            targetUtilization: computeOverallUtilization(beforeTargetDemand, targetProfile),
            targetQueueDelay: beforeTargetPenalty.total_queue_delay_days
        },
        afterState: {
            sourceUtilization: computeOverallUtilization(afterSourceDemand, sourceProfile),
            sourceQueueDelay: afterSourcePenalty.total_queue_delay_days,
            targetUtilization: afterTargetUtilization,
            targetQueueDelay: afterTargetPenalty.total_queue_delay_days
        },
        expectedDelayReduction: netDelayReduction,
        utilizationBalanceImprovement:
            Math.abs(beforeSourcePenalty.total_queue_delay_days - beforeTargetPenalty.total_queue_delay_days) -
            Math.abs(afterSourcePenalty.total_queue_delay_days - afterTargetPenalty.total_queue_delay_days),
        confidence: minConfidence,
        hedgeMessage
    };
}
```

### 3.4 Ranking and Selection

```typescript
function suggestReassignments(
    canonicalData: CanonicalData,
    dateRange: DateRange,
    options: RebalancerOptions = { maxSuggestions: 5 }
): ReassignmentSuggestion[] {
    // 1. Compute utilization for all recruiters
    const utilizationRows = computeRecruiterUtilization(canonicalData, dateRange);

    // 2. Identify overloaded and available recruiters
    const overloaded = utilizationRows.filter(r =>
        r.status === 'critical' || r.status === 'overloaded'
    );
    const available = utilizationRows.filter(r =>
        r.status === 'available' || r.status === 'underutilized' || r.status === 'balanced'
    );

    // 3. Generate all move options
    const moveOptions = generateMoveOptions(
        overloaded,
        available,
        canonicalData.requisitions,
        canonicalData.candidates
    );

    // 4. Score each move
    const scoredMoves = moveOptions.map(move =>
        scoreMove(move, canonicalData.candidates, canonicalData.requisitions, capacityProfiles)
    );

    // 5. Sort by score (descending) and take top N
    const rankedMoves = scoredMoves
        .filter(m => m.score > 0)  // Only positive improvements
        .sort((a, b) => b.score - a.score)
        .slice(0, options.maxSuggestions);

    // 6. Convert to suggestions with explainability
    return rankedMoves.map((scored, rank) => ({
        rank: rank + 1,
        reqId: scored.move.reqId,
        reqTitle: scored.move.reqTitle,
        fromRecruiterId: scored.move.fromRecruiterId,
        fromRecruiterName: scored.move.fromRecruiterName,
        toRecruiterId: scored.move.toRecruiterId,
        toRecruiterName: scored.move.toRecruiterName,
        rationale: buildRationale(scored),
        estimatedImpact: {
            delayReductionDays: scored.expectedDelayReduction,
            sourceUtilizationBefore: scored.beforeState.sourceUtilization,
            sourceUtilizationAfter: scored.afterState.sourceUtilization,
            targetUtilizationBefore: scored.beforeState.targetUtilization,
            targetUtilizationAfter: scored.afterState.targetUtilization
        },
        confidence: scored.confidence,
        hedgeMessage: scored.hedgeMessage
    }));
}

function buildRationale(scored: MoveScore): string {
    const parts: string[] = [];

    // Source relief
    const sourceRelief = scored.beforeState.sourceUtilization - scored.afterState.sourceUtilization;
    parts.push(`Reduces ${scored.move.fromRecruiterName}'s load by ${Math.round(sourceRelief * 100)}%`);

    // Target has capacity
    parts.push(`${scored.move.toRecruiterName} has capacity (${Math.round(scored.afterState.targetUtilization * 100)}% after)`);

    // Delay improvement
    if (scored.expectedDelayReduction > 0) {
        parts.push(`Expected ${scored.expectedDelayReduction.toFixed(1)}d faster time-to-hire`);
    }

    return parts.join('. ');
}
```

---

## 4. UI Plan

### 4.1 Navigation

- **Location**: Plan tab → Capacity Rebalancer (new sub-tab)
- **Route**: `/plan/capacity-rebalancer`
- **Component**: `CapacityRebalancerPage.tsx`

### 4.2 Page Sections

#### 4.2.1 Overview Summary

```
┌─────────────────────────────────────────────────────────────────┐
│ Capacity Overview                                    [MED] ⓘ   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Total Demand     Total Capacity    Utilization    Status       │
│  ─────────────    ──────────────    ───────────    ──────       │
│  47 candidates    40/week           118%           ⚠ AMBER     │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 2 recruiters overloaded • 1 critical • 3 with slack    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  [Based on similar cohorts. Add recruiter_id to more reqs to   │
│   unlock better estimates.]                                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### 4.2.2 Recruiter Utilization Table

```
┌────────────────────────────────────────────────────────────────────────────┐
│ Recruiter Utilization                          [Filter ▾] [Sort by: Util ▾]│
├────────────────────────────────────────────────────────────────────────────┤
│ Recruiter       Reqs  Demand  Capacity  Util    Status      Confidence     │
│ ─────────────   ────  ──────  ────────  ────    ──────      ──────────     │
│ Recruiter 1     8     24      18/wk     133%    🔴 CRITICAL  [HIGH]        │
│ Recruiter 2     6     15      12/wk     125%    🟠 OVERLOAD  [MED]         │
│ Recruiter 3     5     10      12/wk     83%     🟢 BALANCED  [HIGH]        │
│ Recruiter 4     3     5       10/wk     50%     🔵 AVAILABLE [MED]         │
│ Recruiter 5     2     3       8/wk      38%     ⚪ UNDERUTIL [LOW]         │
├────────────────────────────────────────────────────────────────────────────┤
│ ⓘ 3 reqs missing recruiter_id (not shown). [Improve data coverage →]      │
└────────────────────────────────────────────────────────────────────────────┘
```

**Columns:**
| Column | Description |
|--------|-------------|
| Recruiter | Anonymized by default ("Recruiter 1") unless admin mode |
| Reqs | Count of open requisitions |
| Demand | Total active candidates in flight |
| Capacity | Inferred throughput per week (all stages weighted) |
| Util | Overall utilization percentage |
| Status | Load status with color indicator |
| Confidence | Badge showing data quality |

**Interactions:**
- Click row → opens Recruiter Workload Drawer (stage breakdown, req list)
- Sortable by any column
- Filterable by status

#### 4.2.3 Suggested Moves

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Suggested Moves                                              [MED] ⓘ       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐│
│ │ #1  Move "Sr Engineer - Platform"                            [HIGH]     ││
│ │     Recruiter 1 → Recruiter 4                                           ││
│ │                                                                         ││
│ │     Why: Reduces Recruiter 1's load by 15%. Recruiter 4 has capacity    ││
│ │          (60% after). Expected ~3.5d faster time-to-hire.               ││
│ │                                                                         ││
│ │     ┌─────────────────────────────────────────────────────────────────┐ ││
│ │     │ Before          After           Delta                           │ ││
│ │     │ ─────────────   ────────────    ──────────────────────────────  │ ││
│ │     │ R1: 133%        R1: 118%        Source: -15% ↓                  │ ││
│ │     │ R4: 50%         R4: 65%         Target: +15% ↑                  │ ││
│ │     │ Delay: +8.2d    Delay: +4.7d    Net: -3.5d faster               │ ││
│ │     └─────────────────────────────────────────────────────────────────┘ ││
│ │                                                                         ││
│ │     [View Details]                                                      ││
│ └─────────────────────────────────────────────────────────────────────────┘│
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐│
│ │ #2  Move "Product Designer"                                  [MED]      ││
│ │     Recruiter 2 → Recruiter 3                                           ││
│ │     ...                                                                 ││
│ └─────────────────────────────────────────────────────────────────────────┘│
│                                                                             │
│ [Based on similar cohorts. Estimates are approximate.]                      │
│                                                                             │
│ ┌───────────────────────┐  ┌────────────────────────┐                      │
│ │ ✓ Apply Plan          │  │ ⬇ Export Plan (CSV)    │                      │
│ └───────────────────────┘  └────────────────────────┘                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Move Card Contents:**
- Rank badge (#1, #2, etc.)
- Req title
- From → To recruiter (anonymized)
- Rationale text
- Before/After comparison table
- Confidence badge with hedge message
- "View Details" link → opens Move Detail Drawer

#### 4.2.4 Drilldowns

**Recruiter Workload Drawer:**
```
┌─────────────────────────────────────────────────────────────────┐
│ Recruiter 1 Workload                                      [✕]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ Overall: 133% utilization (CRITICAL)          [HIGH]            │
│                                                                 │
│ Stage Breakdown:                                                │
│ ─────────────────────────────────────────────────────────────── │
│ Stage        Demand    Capacity    Util    Status               │
│ Screen       12        8/wk        150%    🔴                   │
│ HM Screen    6         4/wk        150%    🔴                   │
│ Onsite       4         3/wk        133%    🟠                   │
│ Offer        2         2/wk        100%    🟢                   │
│                                                                 │
│ Open Reqs (8):                                                  │
│ ─────────────────────────────────────────────────────────────── │
│ • Sr Engineer - Platform (4 candidates)                         │
│ • Staff Engineer - Infra (3 candidates)                         │
│ • Engineering Manager (2 candidates)                            │
│ • ...                                                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Move Detail Drawer:**
```
┌─────────────────────────────────────────────────────────────────┐
│ Move Detail: Sr Engineer - Platform                       [✕]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ Req: REQ-123 "Sr Engineer - Platform"                           │
│ HM: Manager 1 (not affected)                                    │
│                                                                 │
│ Pipeline (4 candidates):                                        │
│ ─────────────────────────────────────────────────────────────── │
│ • 2 at Screen                                                   │
│ • 1 at HM Screen                                                │
│ • 1 at Onsite                                                   │
│                                                                 │
│ Impact Analysis:                                                │
│ ─────────────────────────────────────────────────────────────── │
│                                                                 │
│ Recruiter 1 (Source):                                           │
│   Before: 133% util, +8.2d queue delay                          │
│   After:  118% util, +5.5d queue delay                          │
│   Relief: 15%, 2.7d faster                                      │
│                                                                 │
│ Recruiter 4 (Target):                                           │
│   Before: 50% util, 0d queue delay                              │
│   After:  65% util, +0.8d queue delay                           │
│   Impact: +15%, 0.8d slower                                     │
│                                                                 │
│ Net System Improvement: 1.9d faster                             │
│                                                                 │
│ Confidence: [MED] Based on similar cohorts                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 5. Action Queue Integration

### 5.1 Action Item Types

When "Apply Plan" is clicked, create the following `ActionItem`s:

```typescript
// For each suggested move in the plan:
const actions: ActionItem[] = [
    // 1. Primary: Reassign req
    {
        action_id: hash('REASSIGN_REQ', reqId, fromRecruiterId, toRecruiterId),
        owner_type: 'TA_OPS',
        owner_id: 'ta-ops',  // or current user
        req_id: reqId,
        action_type: 'REASSIGN_REQ',
        title: `Reassign "${reqTitle}" from ${fromName} to ${toName}`,
        priority: 'P1',
        due_in_days: 3,
        due_date: addDays(new Date(), 3),
        evidence: {
            source: 'capacity_rebalancer',
            move_rank: rank,
            expected_improvement_days: delayReduction,
            confidence: confidence
        },
        recommended_steps: [
            `Update ATS ownership: ${reqId} → ${toName}`,
            'Notify hiring manager of recruiter change',
            'Schedule handoff call between recruiters',
            'Transfer candidate context notes'
        ],
        status: 'OPEN'
    },

    // 2. Follow-up: HM notification
    {
        action_id: hash('NOTIFY_HM_REASSIGN', reqId, hmId),
        owner_type: 'TA_OPS',
        owner_id: 'ta-ops',
        req_id: reqId,
        action_type: 'NOTIFY_HM',
        title: `Notify HM of recruiter change for "${reqTitle}"`,
        priority: 'P2',
        due_in_days: 5,
        due_date: addDays(new Date(), 5),
        evidence: {
            source: 'capacity_rebalancer',
            related_action: 'REASSIGN_REQ'
        },
        recommended_steps: [
            'Send HM notification email/Slack',
            'Introduce new recruiter',
            'Confirm handoff is smooth'
        ],
        status: 'OPEN'
    }
];
```

### 5.2 Deduplication

Use deterministic `action_id` based on:
- `hash(action_type, req_id, from_recruiter_id, to_recruiter_id)`

If an action with the same `action_id` already exists:
- If status is `OPEN`, keep existing (don't create duplicate)
- If status is `DONE` or `DISMISSED`, still don't recreate (user made a decision)

### 5.3 Evidence Links

Every action includes `evidence` with:
- `source: 'capacity_rebalancer'`
- `move_rank`: position in suggested moves list
- `expected_improvement_days`: estimated delay reduction
- `confidence`: confidence level of the estimate
- `before_after_snapshot`: optional full state comparison

---

## 6. Privacy

### 6.1 Anonymization Rules

```typescript
function getRecruiterDisplayName(
    recruiterId: string,
    recruiterName: string | null,
    index: number,
    privacyMode: PrivacyMode
): string {
    // Privacy modes:
    // - 'full': Show real names (admin only)
    // - 'anonymized': Show "Recruiter 1", "Recruiter 2", etc.
    // - 'local': Show real names (local/demo mode)

    if (privacyMode === 'full' || privacyMode === 'local') {
        return recruiterName ?? `Recruiter ${index + 1}`;
    }

    return `Recruiter ${index + 1}`;
}
```

**Default**: `anonymized`
**Admin override**: Check `AuthContext.isAdmin`
**Local mode**: Check `window.location.hostname === 'localhost'`

### 6.2 No Candidate PII

- Never show candidate names in rebalancer views
- Show candidate counts only
- Req titles may be shown (not PII)

---

## 7. Degraded Mode & Fallbacks

### 7.1 Missing recruiter_id

When recruiter_id coverage is < 50%:

```
┌─────────────────────────────────────────────────────────────────┐
│ ⚠ Limited Data Coverage                                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ Only 35% of requisitions have recruiter_id assigned.            │
│ Showing partial results for {N} recruiters.                     │
│                                                                 │
│ To unlock full rebalancing analysis:                            │
│ • Map the "Owner" or "Recruiter" column during import           │
│ • Or add recruiter assignments in your ATS                      │
│                                                                 │
│ [Re-import with recruiter mapping →]                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 7.2 Capacity Confidence LOW

When capacity confidence is LOW for most recruiters:

- Still show utilization table (with LOW badges)
- Still suggest moves (with prominent hedging)
- Add banner: "Estimates are approximate due to limited historical data. Track more stage transitions to improve accuracy."

### 7.3 No Overloaded Recruiters

When no recruiters are overloaded:

```
┌─────────────────────────────────────────────────────────────────┐
│ ✓ Capacity Balanced                                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ No recruiters are currently overloaded.                         │
│ All recruiters are operating within capacity.                   │
│                                                                 │
│ Team utilization: 85% (balanced)                                │
│                                                                 │
│ No moves suggested at this time.                                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 8. Test Plan

### 8.1 Unit Tests

**File**: `services/__tests__/capacityRebalancerService.test.ts`

```typescript
describe('capacityRebalancerService', () => {
    describe('computeRecruiterUtilization', () => {
        it('calculates stage-level utilization correctly', () => {
            // Given: recruiter with 12 candidates at SCREEN, capacity 8/week
            // When: compute utilization
            // Then: SCREEN utilization = 12/8 = 150%
        });

        it('computes overall utilization as weighted average', () => {
            // Given: known stage utilizations and weights
            // When: compute overall
            // Then: matches weighted average formula
        });

        it('returns INSUFFICIENT confidence when recruiter_id missing', () => {
            // Given: recruiter with no recruiter_id
            // When: compute utilization
            // Then: confidence = INSUFFICIENT
        });

        it('uses cohort defaults when capacity inference fails', () => {
            // Given: recruiter with no historical transitions
            // When: compute utilization
            // Then: uses COHORT_DEFAULT values
        });

        it('classifies load status correctly at boundaries', () => {
            // Test: 119% = overloaded, 120% = critical, 121% = critical
            // Test: 89% = available, 90% = balanced, 91% = balanced
        });
    });

    describe('suggestReassignments', () => {
        it('suggests moves from overloaded to available', () => {
            // Given: recruiter A at 130%, recruiter B at 50%
            // When: suggest reassignments
            // Then: suggests move from A to B
        });

        it('does not suggest moves that would overload target', () => {
            // Given: target would exceed MAX_DEST_UTILIZATION_AFTER_MOVE
            // When: suggest reassignments
            // Then: move is excluded or scored negatively
        });

        it('ranks moves by expected delay reduction', () => {
            // Given: multiple possible moves
            // When: suggest reassignments
            // Then: ranked by score descending
        });

        it('returns empty list when no overloaded recruiters', () => {
            // Given: all recruiters balanced or available
            // When: suggest reassignments
            // Then: empty list
        });
    });

    describe('simulateMoveImpact', () => {
        it('recomputes global demand after simulated move', () => {
            // Given: req with 5 candidates
            // When: simulate move from A to B
            // Then: A's demand decreases by 5, B's increases by 5
        });

        it('uses applyCapacityPenaltyV11 for before/after queue delay', () => {
            // Verify integration with capacity penalty model
        });

        it('calculates net delay reduction correctly', () => {
            // net = sourceReduction - targetIncrease
        });
    });

    describe('confidence and hedging', () => {
        it('propagates minimum confidence from all sources', () => {
            // Given: source=HIGH, target=LOW
            // When: score move
            // Then: overall confidence = LOW
        });

        it('generates appropriate hedge messages', () => {
            // HIGH → "Based on observed patterns"
            // MED → "Based on similar cohorts"
            // LOW → "Estimated (limited data)"
        });
    });
});
```

### 8.2 UI Tests

**File**: `components/__tests__/CapacityRebalancerPage.test.tsx`

```typescript
describe('CapacityRebalancerPage', () => {
    it('renders overview summary', () => {
        render(<CapacityRebalancerPage />);
        expect(screen.getByText('Capacity Overview')).toBeInTheDocument();
    });

    it('renders utilization table with all recruiters', () => {
        // Given: 5 recruiters in data
        // When: render
        // Then: 5 rows in table
    });

    it('renders suggested moves when imbalance exists', () => {
        // Given: overloaded recruiters
        // When: render
        // Then: move cards appear
    });

    it('shows "no moves needed" when balanced', () => {
        // Given: no overloaded recruiters
        // When: render
        // Then: balanced message appears
    });

    it('shows degraded mode banner when recruiter_id coverage low', () => {
        // Given: <50% recruiter_id coverage
        // When: render
        // Then: banner with CTA appears
    });

    it('anonymizes recruiter names by default', () => {
        // Given: recruiter with real name
        // When: render without admin mode
        // Then: shows "Recruiter 1" not real name
    });

    it('Apply Plan creates action items', async () => {
        // Given: suggested moves
        // When: click Apply Plan
        // Then: ActionItems created (mock actionQueueService)
    });

    it('dedupes action items on repeat Apply', async () => {
        // Given: Apply Plan already clicked
        // When: click Apply Plan again
        // Then: no duplicate actions created
    });

    it('opens recruiter drawer on row click', async () => {
        // When: click recruiter row
        // Then: drawer opens with stage breakdown
    });

    it('opens move detail drawer on View Details', async () => {
        // When: click View Details on move card
        // Then: drawer opens with before/after
    });
});
```

### 8.3 Integration Tests

```typescript
describe('CapacityRebalancer Integration', () => {
    it('end-to-end: compute utilization → suggest moves → apply plan', async () => {
        // Full flow test with realistic data
    });

    it('actions appear in Unified Action Queue after Apply', async () => {
        // Verify integration with actionQueueService
    });
});
```

---

## 9. Non-Goals (v1)

1. **Automatic reassignment** — Apply Plan creates actions but does NOT change ATS data
2. **HM reassignment** — v1 only reassigns recruiters, not hiring managers
3. **Multi-move optimization** — v1 is greedy single-move; no complex combinatorial solver
4. **Skill/fit matching** — v1 uses utilization only; no FitMatrix integration
5. **Real-time updates** — Page refreshes on navigation; no WebSocket push
6. **Mobile-optimized layout** — Desktop-first; mobile is readable but not optimized

---

## 10. Future Enhancements (v2+)

1. **FitMatrix integration**: Prefer targets with better fit scores for the req's segment
2. **Multi-move optimization**: Solve for globally optimal assignment
3. **What-if simulation**: Interactive "drag req to recruiter" with live impact preview
4. **Capacity forecasting**: Predict future overload based on planned hires
5. **Auto-balance mode**: Suggest ongoing load distribution as reqs open/close
6. **Slack/Teams notifications**: Notify recruiters of planned changes

---

## 11. File Structure

```
src/productivity-dashboard/
├── services/
│   ├── capacityRebalancerService.ts      # Core logic
│   └── __tests__/
│       └── capacityRebalancerService.test.ts
├── components/
│   ├── plan/
│   │   ├── CapacityRebalancerPage.tsx    # Main page
│   │   ├── RecruiterUtilizationTable.tsx
│   │   ├── SuggestedMoveCard.tsx
│   │   ├── RecruiterWorkloadDrawer.tsx
│   │   ├── MoveDetailDrawer.tsx
│   │   └── __tests__/
│   │       └── CapacityRebalancerPage.test.tsx
├── types/
│   └── rebalancerTypes.ts                # Type definitions
```

---

## 12. Success Criteria Checklist

- [ ] **Utilization model** implemented with explicit formulas matching spec
- [ ] **Load status** classification uses correct thresholds (120/110/90/70)
- [ ] **Move scoring** picks slack recruiter over overloaded
- [ ] **Global demand** recomputation when req moved (not per-req only)
- [ ] **Confidence** propagated correctly with hedge messages
- [ ] **UI** matches wireframes with all sections
- [ ] **Privacy** anonymizes by default
- [ ] **Degraded mode** works with partial data and shows unlock CTAs
- [ ] **Apply Plan** creates deduped ActionItems
- [ ] **Actions** appear in Unified Action Queue
- [ ] **Unit tests** pass (utilization, scoring, simulation)
- [ ] **UI tests** pass (render, interactions, actions)
- [ ] `npm test -- --watchAll=false` passes
- [ ] `npm run build` passes
