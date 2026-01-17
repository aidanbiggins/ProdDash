# Scenario Library V1

## Overview

The Scenario Library provides deterministic "What happens if…" recruiting scenario planning that builds on existing ProdDash modules (Forecasting, Capacity/Fit, Velocity, Action Queue). It enables exec-grade decision support with full explainability and optional BYOK AI narration.

**Design Principles:**
- **Deterministic engine is source of truth** — AI never computes metrics or invents numbers
- **Fail closed** — Missing required data blocks scenario with explicit fix list
- **Explainable** — Every output includes confidence, sample sizes, and citations
- **Actionable** — Scenarios produce deduped ActionItems for Unified Action Queue
- **No PII** — Anonymized recruiter/HM names, redacted candidate identifiers

---

## 1. Scenario Engine Contract

### 1.1 ScenarioInput

```typescript
interface ScenarioInput {
  /** Unique scenario identifier */
  scenario_id: ScenarioId;

  /** Date context for the scenario */
  date_range: {
    /** Scenario start date (typically "today") */
    start_date: Date;
    /** Scenario end date (target completion) */
    end_date: Date;
  };

  /** Scenario-specific parameters (validated per scenario type) */
  parameters: ScenarioParameters;

  /** Current dashboard context (auto-populated) */
  context: {
    org_id: string;
    dataset_id: string;
    current_filters: DashboardFilters;
  };
}

type ScenarioId =
  | 'spin_up_team'      // Spin up a new engineering team
  | 'hiring_freeze'     // Pause hiring for X weeks
  | 'recruiter_leaves'; // A recruiter leaves on date D

type ScenarioParameters =
  | SpinUpTeamParams
  | HiringFreezeParams
  | RecruiterLeavesParams;
```

### 1.2 ScenarioOutput

```typescript
interface ScenarioOutput {
  /** Scenario metadata */
  scenario_id: ScenarioId;
  scenario_name: string;
  generated_at: Date;

  /** Overall feasibility assessment */
  feasibility: Feasibility;

  /** Quantified deltas from baseline (nullable when unavailable) */
  deltas: ScenarioDeltas;

  /** Top constraints blocking/risking success */
  bottlenecks: Bottleneck[];

  /** Recruiter capacity impact (nullable when unavailable) */
  resource_impact: ResourceImpact | null;

  /** Actionable plan items (deduped, ready for Action Queue) */
  action_plan: ActionItem[];

  /** Confidence assessment */
  confidence: ConfidenceAssessment;

  /** Fact keys used for every computed claim */
  citations: Citation[];

  /** Routes to relevant evidence views */
  deep_links: DeepLink[];

  /** Blocking conditions preventing scenario execution */
  blocked: BlockedInfo | null;
}

type Feasibility = 'ON_TRACK' | 'AT_RISK' | 'IMPOSSIBLE' | 'NOT_ENOUGH_DATA';

interface ScenarioDeltas {
  /** Change in expected hires within scenario window */
  expected_hires_delta: number | null;
  /** Change in offer count projection */
  offers_delta: number | null;
  /** Change in pipeline gap (negative = improvement) */
  pipeline_gap_delta: number | null;
  /** Change in time-to-offer days (negative = faster) */
  time_to_offer_delta: number | null;
}

interface Bottleneck {
  rank: 1 | 2 | 3;
  constraint_type: ConstraintType;
  description: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  evidence: {
    metric_key: string;
    current_value: number | string;
    threshold: number | string;
    source_citation: string;
  };
  mitigation: string;
}

type ConstraintType =
  | 'CAPACITY_GAP'           // Insufficient recruiter capacity
  | 'PIPELINE_DEPTH'         // Not enough candidates in funnel
  | 'VELOCITY_DECAY'         // Decay curve too steep
  | 'HM_FRICTION'           // HM latency blocking progress
  | 'FORECAST_CONFIDENCE'   // Low confidence in TTF predictions
  | 'MISSING_DATA';         // Required data not available

interface ResourceImpact {
  /** Team-wide utilization change */
  team_utilization_delta: number;
  /** Per-recruiter impact */
  recruiter_impacts: RecruiterImpact[];
}

interface RecruiterImpact {
  recruiter_id: string;
  recruiter_name_anon: string;  // "Recruiter 1", "Recruiter 2"
  current_utilization: number;
  projected_utilization: number;
  status_change: 'BECOMES_OVERLOADED' | 'BECOMES_AVAILABLE' | 'NO_CHANGE';
}

interface ConfidenceAssessment {
  level: 'HIGH' | 'MED' | 'LOW';
  reasons: string[];
  sample_sizes: {
    metric_key: string;
    n: number;
    threshold: number;
    sufficient: boolean;
  }[];
}

interface Citation {
  key_path: string;           // e.g., "capacity.team_demand"
  label: string;              // Human-readable label
  value: number | string;
  source_service: string;     // Service that computed this value
}

interface DeepLink {
  label: string;
  tab: string;
  params: Record<string, string>;
  rationale: string;
}

interface BlockedInfo {
  reason: string;
  missing_data: MissingDataItem[];
  fix_instructions: string[];
}

interface MissingDataItem {
  field: string;
  description: string;
  required_for: string;
}
```

---

## 2. Data Sources and Dependencies

### 2.1 Service Dependencies by Scenario

| Scenario | Forecasting | Capacity/Fit | Velocity | HM Friction | Action Queue |
|----------|-------------|--------------|----------|-------------|--------------|
| Spin Up Team | ✓ TTF prediction, pipeline reqs | ✓ Team capacity gap | ✓ Funnel conversion | ✓ HM weight | ✓ Generate actions |
| Hiring Freeze | ✓ Expected hires projection | ✓ Utilization recalc | ✓ Decay impact | ○ Optional | ✓ Generate actions |
| Recruiter Leaves | ○ TTF for reassignment | ✓ Rebalance optimizer | ○ Optional | ✓ HM friction for reqs | ✓ Generate actions |

Legend: ✓ = Required, ○ = Optional/enhances output

### 2.2 Data Source Details

#### Forecasting Service (`forecastingService.ts`)
| Function | Used By | Output |
|----------|---------|--------|
| `predictTimeToFill()` | Spin Up, Recruiter Leaves | `TTFPrediction` with median, p25/p75, confidence |
| `calculatePipelineRequirements()` | Spin Up | Candidates needed per stage |
| `identifyRiskFactors()` | Spin Up | Risk factors affecting TTF |
| `generateMilestoneTimeline()` | Spin Up | Stage-by-stage timeline |

#### Capacity/Fit Engine (`capacityFitEngine.ts`)
| Function | Used By | Output |
|----------|---------|--------|
| `analyzeCapacity()` | All scenarios | `CapacityAnalysisResult` with team summary, recruiter loads |
| `checkBlockingConditions()` | All scenarios | Validates min data requirements |
| `buildAllReqWorkloads()` | Hiring Freeze, Recruiter Leaves | Per-req workload scores |
| `generateRebalanceRecommendations()` | Recruiter Leaves | Optimal req reassignments |

#### Velocity Analysis (`velocityAnalysis.ts`)
| Function | Used By | Output |
|----------|---------|--------|
| `calculateVelocityMetrics()` | Spin Up | Funnel conversion rates |
| `calculateCandidateDecay()` | Hiring Freeze | Acceptance decay by days-in-process |
| `compareFastVsSlow()` | Spin Up | Factors differentiating fast hires |

#### HM Metrics (`hmMetricsEngine.ts`)
| Function | Used By | Output |
|----------|---------|--------|
| `calculateHMLatency()` | Spin Up, Recruiter Leaves | Per-HM feedback latency |
| `getPendingHMActions()` | All scenarios | Actions awaiting HM response |

### 2.3 Gating Rules

Scenarios **fail closed with NOT_ENOUGH_DATA** if gating requirements are not met:

#### Global Gates (All Scenarios)
| Gate | Threshold | Fix Instruction |
|------|-----------|-----------------|
| Min recruiters | ≥ 3 active recruiters | "Add recruiter_id to requisition records" |
| Min open reqs | ≥ 10 open requisitions | "Import more requisition data" |
| Recruiter ID coverage | ≥ 50% of reqs have recruiter_id | "Ensure recruiter assignments in source data" |
| Event history | Events table has data | "Import candidate event history" |

#### Scenario-Specific Gates

**Spin Up Team:**
| Gate | Threshold | Fix Instruction |
|------|-----------|-----------------|
| Historical hires | ≥ 5 hires in matching cohort | "Insufficient historical hires for this role profile" |
| TTF data | Valid opened_at and hired_at on hires | "Ensure timestamps on closed requisitions" |
| Velocity data | Funnel conversion rates calculable | "Need stage progression events" |

**Hiring Freeze:**
| Gate | Threshold | Fix Instruction |
|------|-----------|-----------------|
| Active pipeline | ≥ 20 candidates in active stages | "Need active candidate pipeline data" |
| Decay data | ≥ 10 offers for decay curve | "Insufficient offer history for decay model" |

**Recruiter Leaves:**
| Gate | Threshold | Fix Instruction |
|------|-----------|-----------------|
| Recruiter has reqs | Selected recruiter owns ≥ 1 req | "Selected recruiter has no assigned requisitions" |
| Rebalance candidates | ≥ 2 other recruiters available | "Need at least 2 other recruiters for reassignment" |

### 2.4 Minimum Sample Sizes and Confidence

| Metric | MIN_N | LOW Threshold | MED Threshold | HIGH Threshold |
|--------|-------|---------------|---------------|----------------|
| TTF prediction | 5 | 5 | 10 | 20 |
| Funnel conversion | 10 | 10 | 20 | 50 |
| Decay curve | 10 | 10 | 25 | 50 |
| Recruiter capacity | 8 weeks | 8 | 12 | 26 |
| Fit score | 3 | 3 | 5 | 10 |

```typescript
function calculateConfidence(sampleSizes: SampleSize[]): ConfidenceAssessment {
  const insufficientData = sampleSizes.filter(s => s.n < s.threshold);

  if (insufficientData.length > 0) {
    return {
      level: 'LOW',
      reasons: insufficientData.map(s =>
        `${s.metric_key}: n=${s.n} below minimum ${s.threshold}`
      ),
      sample_sizes: sampleSizes
    };
  }

  const allHigh = sampleSizes.every(s => s.n >= s.threshold * 2);
  const allMed = sampleSizes.every(s => s.n >= s.threshold * 1.5);

  return {
    level: allHigh ? 'HIGH' : allMed ? 'MED' : 'LOW',
    reasons: allHigh
      ? ['All metrics have sufficient sample sizes']
      : ['Some metrics have limited sample sizes'],
    sample_sizes: sampleSizes
  };
}
```

---

## 3. Scenario Definitions

### 3.1 Scenario: Spin Up New Engineering Team

**ID:** `spin_up_team`

**Description:** Model the hiring plan to spin up a new team by a target date.

#### Parameters

```typescript
interface SpinUpTeamParams {
  /** Target team size */
  headcount: number;              // Default: 5, Range: 1-20

  /** Role profile for hires */
  role_profile: {
    function: string;             // Default: 'Engineering', Options from job_family
    level: string;                // Default: 'L4', Options from level
    location_type: 'Remote' | 'Hybrid' | 'Onsite'; // Default: 'Hybrid'
  };

  /** Assigned hiring manager (optional, for HM weight) */
  hiring_manager_id?: string;

  /** Assigned recruiters (optional, for capacity impact) */
  assigned_recruiter_ids?: string[];

  /** Days from start to target completion */
  target_days: number;            // Default: 60, Range: 30-180
}
```

#### Deterministic Computation Steps

```typescript
function runSpinUpTeamScenario(input: ScenarioInput): ScenarioOutput {
  const params = input.parameters as SpinUpTeamParams;
  const { start_date, end_date } = input.date_range;

  // Step 1: Validate gates
  const gates = validateSpinUpGates(params, context);
  if (gates.blocked) {
    return createBlockedOutput(gates);
  }

  // Step 2: Get TTF prediction for role profile
  const roleProfile = buildRoleProfile(params);
  const ttfPrediction = predictTimeToFill(roleProfile, context.benchmarks, context.hmFriction);

  // Citation: ttf_prediction.median_days
  const predictedTTF = ttfPrediction.medianDays;
  const targetDays = differenceInDays(end_date, start_date);

  // Step 3: Calculate pipeline requirements
  const pipelineReqs = calculatePipelineRequirements(roleProfile, context.benchmarks);
  const totalCandidatesNeeded = pipelineReqs.totalCandidatesNeeded * params.headcount;

  // Citation: pipeline_requirements.total_candidates_needed

  // Step 4: Calculate capacity impact
  const newWorkload = estimateWorkloadForReqs(params.headcount, roleProfile);
  const capacityAnalysis = analyzeCapacity(context);
  const capacityGapAfter = capacityAnalysis.capacityGap + newWorkload;

  // Citation: capacity.team_capacity, capacity.team_demand

  // Step 5: Determine feasibility
  const feasibility = determineFeasibility({
    predictedTTF,
    targetDays,
    capacityGapAfter,
    ttfConfidence: ttfPrediction.confidenceLevel
  });

  // Step 6: Identify bottlenecks
  const bottlenecks = identifyBottlenecks({
    ttfPrediction,
    pipelineReqs,
    capacityAnalysis,
    targetDays,
    params
  });

  // Step 7: Calculate deltas
  const deltas: ScenarioDeltas = {
    expected_hires_delta: params.headcount,
    offers_delta: Math.ceil(params.headcount / 0.85), // Using historical accept rate
    pipeline_gap_delta: -params.headcount, // Improvement by filling positions
    time_to_offer_delta: null // Not applicable for new team
  };

  // Step 8: Calculate resource impact
  const resourceImpact = calculateResourceImpact(
    params.assigned_recruiter_ids,
    newWorkload,
    capacityAnalysis
  );

  // Step 9: Generate action plan
  const actionPlan = generateSpinUpActions(params, bottlenecks, context);

  // Step 10: Compile citations and deep links
  const citations = collectCitations();
  const deepLinks = generateDeepLinks(bottlenecks, params);

  return {
    scenario_id: 'spin_up_team',
    scenario_name: `Spin up ${params.headcount}-person ${params.role_profile.function} team`,
    generated_at: new Date(),
    feasibility,
    deltas,
    bottlenecks,
    resource_impact: resourceImpact,
    action_plan: actionPlan,
    confidence: calculateConfidence(sampleSizes),
    citations,
    deep_links: deepLinks,
    blocked: null
  };
}
```

#### Feasibility Determination

```typescript
function determineFeasibility(inputs: {
  predictedTTF: number;
  targetDays: number;
  capacityGapAfter: number;
  ttfConfidence: 'high' | 'medium' | 'low';
}): Feasibility {
  const { predictedTTF, targetDays, capacityGapAfter, ttfConfidence } = inputs;

  // Rule 1: If predicted TTF > target days, impossible
  if (predictedTTF > targetDays * 1.5) {
    return 'IMPOSSIBLE';
  }

  // Rule 2: If significant capacity gap, at risk
  if (capacityGapAfter > 0.3 * capacityBefore) {
    return 'AT_RISK';
  }

  // Rule 3: If TTF within target but low confidence, at risk
  if (predictedTTF <= targetDays && ttfConfidence === 'low') {
    return 'AT_RISK';
  }

  // Rule 4: If TTF within target with good confidence, on track
  if (predictedTTF <= targetDays * 1.2) {
    return 'ON_TRACK';
  }

  return 'AT_RISK';
}
```

#### Action Plan Generation

```typescript
function generateSpinUpActions(
  params: SpinUpTeamParams,
  bottlenecks: Bottleneck[],
  context: ScenarioContext
): ActionItem[] {
  const actions: ActionItem[] = [];

  // Action: Create requisitions
  actions.push({
    action_id: generateActionId('TA_OPS', 'ta-ops', 'general', 'PIPELINE_HEALTH_CHECK'),
    owner_type: 'TA_OPS',
    owner_id: 'ta-ops',
    owner_name: 'TA Operations',
    req_id: 'general',
    action_type: 'PIPELINE_HEALTH_CHECK',
    title: `Open ${params.headcount} ${params.role_profile.function} requisitions`,
    priority: 'P0',
    due_in_days: 7,
    due_date: addDays(new Date(), 7),
    evidence: {
      kpi_key: 'scenario.spin_up_team.headcount',
      explain_provider_key: 'scenario_library',
      short_reason: `${params.headcount} positions needed by target date`
    },
    recommended_steps: [
      'Create job descriptions for each role',
      'Get HM approval on role requirements',
      'Open requisitions in ATS',
      'Assign to recruiters'
    ],
    created_at: new Date(),
    status: 'OPEN'
  });

  // Action for each bottleneck
  for (const bottleneck of bottlenecks) {
    if (bottleneck.constraint_type === 'CAPACITY_GAP') {
      actions.push({
        action_id: generateActionId('TA_OPS', 'ta-ops', 'general', 'PROCESS_OPTIMIZATION'),
        owner_type: 'TA_OPS',
        owner_id: 'ta-ops',
        owner_name: 'TA Operations',
        req_id: 'general',
        action_type: 'PROCESS_OPTIMIZATION',
        title: 'Address recruiter capacity gap',
        priority: bottleneck.severity === 'CRITICAL' ? 'P0' : 'P1',
        due_in_days: 14,
        due_date: addDays(new Date(), 14),
        evidence: {
          kpi_key: 'capacity.capacity_gap',
          explain_provider_key: 'capacity_fit_engine',
          short_reason: bottleneck.description
        },
        recommended_steps: [
          'Review recruiter load distribution',
          'Consider temporary staffing augmentation',
          'Rebalance existing assignments',
          'Evaluate agency support'
        ],
        created_at: new Date(),
        status: 'OPEN'
      });
    }

    if (bottleneck.constraint_type === 'HM_FRICTION') {
      const hmId = params.hiring_manager_id || 'unknown';
      actions.push({
        action_id: generateActionId('HIRING_MANAGER', hmId, 'general', 'FEEDBACK_DUE'),
        owner_type: 'HIRING_MANAGER',
        owner_id: hmId,
        owner_name: `Manager (${params.role_profile.function})`,
        req_id: 'general',
        action_type: 'FEEDBACK_DUE',
        title: 'Establish HM responsiveness SLA',
        priority: 'P1',
        due_in_days: 7,
        due_date: addDays(new Date(), 7),
        evidence: {
          kpi_key: 'hm_friction.feedback_latency',
          explain_provider_key: 'hm_metrics_engine',
          short_reason: bottleneck.description
        },
        recommended_steps: [
          'Meet with HM to set expectations',
          'Agree on 24-hour feedback SLA',
          'Set up automated reminder system'
        ],
        created_at: new Date(),
        status: 'OPEN'
      });
    }
  }

  // Deduplicate actions
  return deduplicateActions(actions);
}
```

#### Supported vs Blocked Outputs

| Output | Supported | Blocked When |
|--------|-----------|--------------|
| feasibility | Always | Never |
| expected_hires_delta | Always | Never |
| offers_delta | Always | Never |
| pipeline_gap_delta | Always | Never |
| time_to_offer_delta | Never | N/A for spin-up |
| resource_impact | When ≥3 recruiters | <3 recruiters with data |
| bottlenecks | Always (may be empty) | Never |
| action_plan | Always (may be empty) | Never |

#### Evidence/Deep Links

| Bottleneck Type | Deep Link | Tab | Params |
|-----------------|-----------|-----|--------|
| CAPACITY_GAP | "View Capacity Analysis" | capacity | {} |
| PIPELINE_DEPTH | "View Velocity Metrics" | velocity | {} |
| HM_FRICTION | "View HM Friction" | hm-friction | { hm_id } |
| FORECAST_CONFIDENCE | "View Forecasting" | forecasting | { role_profile } |

---

### 3.2 Scenario: Hiring Freeze

**ID:** `hiring_freeze`

**Description:** Model the impact of pausing hiring for X weeks.

#### Parameters

```typescript
interface HiringFreezeParams {
  /** Number of weeks to freeze hiring */
  freeze_weeks: number;           // Default: 4, Range: 1-26

  /** What happens to candidates during freeze */
  candidate_action: 'HOLD' | 'REJECT_SOFT' | 'WITHDRAW';  // Default: 'HOLD'

  /** Scope of freeze */
  scope: {
    type: 'ALL' | 'FUNCTION' | 'LEVEL' | 'SPECIFIC_REQS';
    filter_value?: string;        // Function name, level, or req IDs
  };
}
```

#### Deterministic Computation Steps

```typescript
function runHiringFreezeScenario(input: ScenarioInput): ScenarioOutput {
  const params = input.parameters as HiringFreezeParams;

  // Step 1: Validate gates
  const gates = validateFreezeGates(params, context);
  if (gates.blocked) {
    return createBlockedOutput(gates);
  }

  // Step 2: Identify affected pipeline
  const affectedReqs = filterReqsByScope(context.requisitions, params.scope);
  const affectedCandidates = getCandidatesForReqs(affectedReqs, context.candidates);

  // Citation: freeze_scope.affected_reqs_count, freeze_scope.affected_candidates_count

  // Step 3: Calculate decay impact
  const decayAnalysis = calculateCandidateDecay(context.candidates, context.requisitions);
  const currentDaysInProcess = calculateAverageDaysInProcess(affectedCandidates);
  const projectedDaysInProcess = currentDaysInProcess + (params.freeze_weeks * 7);

  // Find decay rate at projected days
  const currentAcceptRate = getAcceptRateAtDays(decayAnalysis, currentDaysInProcess);
  const projectedAcceptRate = getAcceptRateAtDays(decayAnalysis, projectedDaysInProcess);
  const acceptRateDelta = projectedAcceptRate - currentAcceptRate;

  // Citation: velocity.decay_curve, velocity.current_accept_rate

  // Step 4: Calculate expected hires impact
  const currentExpectedHires = calculateExpectedHires(affectedCandidates, currentAcceptRate);
  const projectedExpectedHires = calculateExpectedHires(
    affectedCandidates,
    projectedAcceptRate
  );
  const expectedHiresDelta = projectedExpectedHires - currentExpectedHires;

  // Citation: forecast.expected_hires_current, forecast.expected_hires_projected

  // Step 5: Calculate pipeline gap impact
  const currentPipelineGap = affectedReqs.length - currentExpectedHires;
  const projectedPipelineGap = affectedReqs.length - projectedExpectedHires;
  const pipelineGapDelta = projectedPipelineGap - currentPipelineGap;

  // Citation: forecast.pipeline_gap_current, forecast.pipeline_gap_projected

  // Step 6: Calculate capacity impact (positive = freed capacity)
  const freedCapacity = calculateFreedCapacity(affectedReqs, context.capacityAnalysis);

  // Citation: capacity.freed_wu

  // Step 7: Determine feasibility
  const feasibility = determineFreezeImpact({
    acceptRateDelta,
    expectedHiresDelta,
    candidateAction: params.candidate_action
  });

  // Step 8: Identify bottlenecks
  const bottlenecks = identifyFreezeBottlenecks({
    decayAnalysis,
    projectedDaysInProcess,
    acceptRateDelta,
    affectedCandidates
  });

  // Step 9: Generate action plan
  const actionPlan = generateFreezeActions(params, affectedReqs, affectedCandidates);

  return {
    scenario_id: 'hiring_freeze',
    scenario_name: `${params.freeze_weeks}-week hiring freeze`,
    generated_at: new Date(),
    feasibility,
    deltas: {
      expected_hires_delta: expectedHiresDelta,
      offers_delta: Math.round(expectedHiresDelta / 0.85),
      pipeline_gap_delta: pipelineGapDelta,
      time_to_offer_delta: params.freeze_weeks * 7  // Days added to all timelines
    },
    bottlenecks,
    resource_impact: {
      team_utilization_delta: -freedCapacity / context.capacityAnalysis.teamCapacity,
      recruiter_impacts: []  // Detailed breakdown not needed for freeze
    },
    action_plan: actionPlan,
    confidence: calculateConfidence(sampleSizes),
    citations: collectCitations(),
    deep_links: generateFreezeDeepLinks(bottlenecks),
    blocked: null
  };
}
```

#### Feasibility Determination

```typescript
function determineFreezeImpact(inputs: {
  acceptRateDelta: number;
  expectedHiresDelta: number;
  candidateAction: CandidateAction;
}): Feasibility {
  const { acceptRateDelta, expectedHiresDelta, candidateAction } = inputs;

  // Rule 1: If losing >50% of expected hires, impossible to recover
  if (expectedHiresDelta < -0.5 * currentExpectedHires) {
    return 'IMPOSSIBLE';
  }

  // Rule 2: If accept rate drops >20%, high risk
  if (acceptRateDelta < -0.20) {
    return 'AT_RISK';
  }

  // Rule 3: If rejecting candidates, higher risk
  if (candidateAction !== 'HOLD' && acceptRateDelta < -0.10) {
    return 'AT_RISK';
  }

  // Rule 4: Moderate impact is on track with caveats
  return 'ON_TRACK';
}
```

#### Action Plan Generation

```typescript
function generateFreezeActions(
  params: HiringFreezeParams,
  affectedReqs: Requisition[],
  affectedCandidates: Candidate[]
): ActionItem[] {
  const actions: ActionItem[] = [];

  // Action: Communicate with active candidates
  const candidatesInActiveStages = affectedCandidates.filter(c =>
    ['SCREEN', 'HM_SCREEN', 'ONSITE', 'FINAL'].includes(c.current_stage)
  );

  if (candidatesInActiveStages.length > 0) {
    actions.push({
      action_id: generateActionId('TA_OPS', 'ta-ops', 'general', 'PROCESS_OPTIMIZATION'),
      owner_type: 'TA_OPS',
      owner_id: 'ta-ops',
      owner_name: 'TA Operations',
      req_id: 'general',
      action_type: 'PROCESS_OPTIMIZATION',
      title: `Communicate freeze to ${candidatesInActiveStages.length} active candidates`,
      priority: 'P0',
      due_in_days: 3,
      due_date: addDays(new Date(), 3),
      evidence: {
        kpi_key: 'freeze_scope.active_candidates',
        explain_provider_key: 'scenario_library',
        short_reason: `${candidatesInActiveStages.length} candidates in interview stages`
      },
      recommended_steps: [
        'Draft candidate communication template',
        'Get legal/HR approval on messaging',
        'Send personalized outreach to each candidate',
        'Log communication in ATS'
      ],
      created_at: new Date(),
      status: 'OPEN'
    });
  }

  // Action: Notify hiring managers
  const uniqueHMs = [...new Set(affectedReqs.map(r => r.hiring_manager_id).filter(Boolean))];
  if (uniqueHMs.length > 0) {
    actions.push({
      action_id: generateActionId('TA_OPS', 'ta-ops', 'general', 'PROCESS_OPTIMIZATION'),
      owner_type: 'TA_OPS',
      owner_id: 'ta-ops',
      owner_name: 'TA Operations',
      req_id: 'general',
      action_type: 'PROCESS_OPTIMIZATION',
      title: `Brief ${uniqueHMs.length} hiring managers on freeze impact`,
      priority: 'P0',
      due_in_days: 2,
      due_date: addDays(new Date(), 2),
      evidence: {
        kpi_key: 'freeze_scope.affected_hms',
        explain_provider_key: 'scenario_library',
        short_reason: `${uniqueHMs.length} HMs have affected requisitions`
      },
      recommended_steps: [
        'Schedule brief sync with each HM',
        'Share timeline and expected delays',
        'Discuss re-engagement strategy post-freeze',
        'Document revised hiring timelines'
      ],
      created_at: new Date(),
      status: 'OPEN'
    });
  }

  // Action: Plan re-engagement
  actions.push({
    action_id: generateActionId('TA_OPS', 'ta-ops', 'general', 'PIPELINE_HEALTH_CHECK'),
    owner_type: 'TA_OPS',
    owner_id: 'ta-ops',
    owner_name: 'TA Operations',
    req_id: 'general',
    action_type: 'PIPELINE_HEALTH_CHECK',
    title: 'Prepare post-freeze re-engagement plan',
    priority: 'P1',
    due_in_days: params.freeze_weeks * 7 - 7,  // 1 week before freeze ends
    due_date: addDays(new Date(), params.freeze_weeks * 7 - 7),
    evidence: {
      kpi_key: 'scenario.freeze_end_date',
      explain_provider_key: 'scenario_library',
      short_reason: 'Prepare to restart hiring efficiently'
    },
    recommended_steps: [
      'Audit candidate pipeline status',
      'Identify candidates likely to have moved on',
      'Prioritize warm candidates for re-engagement',
      'Schedule HM re-calibration meetings'
    ],
    created_at: new Date(),
    status: 'OPEN'
  });

  return deduplicateActions(actions);
}
```

#### Supported vs Blocked Outputs

| Output | Supported | Blocked When |
|--------|-----------|--------------|
| feasibility | Always | Never |
| expected_hires_delta | When decay data exists | <10 historical offers |
| offers_delta | When decay data exists | <10 historical offers |
| pipeline_gap_delta | When decay data exists | <10 historical offers |
| time_to_offer_delta | Always | Never |
| resource_impact | Always | Never |
| bottlenecks | Always | Never |
| action_plan | Always | Never |

---

### 3.3 Scenario: Recruiter Leaves

**ID:** `recruiter_leaves`

**Description:** Model the impact when a recruiter leaves and plan for requisition reassignment.

#### Parameters

```typescript
interface RecruiterLeavesParams {
  /** ID of the departing recruiter */
  recruiter_id: string;           // Required

  /** Last day of the recruiter */
  departure_date: Date;           // Default: 14 days from now

  /** Reassignment strategy */
  reassignment_strategy: 'OPTIMIZE_FIT' | 'BALANCE_LOAD' | 'MANUAL';  // Default: 'OPTIMIZE_FIT'

  /** If MANUAL, specific assignments */
  manual_assignments?: {
    req_id: string;
    to_recruiter_id: string;
  }[];
}
```

#### Deterministic Computation Steps

```typescript
function runRecruiterLeavesScenario(input: ScenarioInput): ScenarioOutput {
  const params = input.parameters as RecruiterLeavesParams;

  // Step 1: Validate gates
  const gates = validateRecruiterLeavesGates(params, context);
  if (gates.blocked) {
    return createBlockedOutput(gates);
  }

  // Step 2: Get recruiter's current load
  const departingRecruiter = context.capacityAnalysis.recruiterLoads.find(
    r => r.recruiterId === params.recruiter_id
  );
  const affectedReqs = context.requisitions.filter(
    r => r.recruiter_id === params.recruiter_id && r.status === 'OPEN'
  );

  // Citation: departing_recruiter.current_demand_wu, departing_recruiter.req_count
  const workloadToReassign = departingRecruiter.demandWU;

  // Step 3: Calculate team capacity after departure
  const remainingRecruiters = context.capacityAnalysis.recruiterLoads.filter(
    r => r.recruiterId !== params.recruiter_id
  );
  const remainingCapacity = remainingRecruiters.reduce(
    (sum, r) => sum + r.capacityWU, 0
  );
  const remainingDemand = context.capacityAnalysis.teamDemand - workloadToReassign;
  const newTeamUtilization = remainingDemand / remainingCapacity;

  // Citation: capacity.remaining_capacity, capacity.remaining_demand

  // Step 4: Generate reassignment plan
  const reassignmentPlan = params.reassignment_strategy === 'MANUAL'
    ? validateManualAssignments(params.manual_assignments, context)
    : generateRebalanceRecommendations(
        remainingRecruiters,
        affectedReqs.map(r => buildReqWorkload(r, context)),
        context.fitMatrix,
        affectedReqs.length
      );

  // Citation: reassignment_plan.recommendations

  // Step 5: Calculate per-recruiter impact
  const recruiterImpacts: RecruiterImpact[] = remainingRecruiters.map(r => {
    const assignedReqs = reassignmentPlan.filter(p => p.toRecruiterId === r.recruiterId);
    const additionalWorkload = assignedReqs.reduce((sum, p) => sum + p.demandImpact, 0);
    const projectedUtilization = (r.demandWU + additionalWorkload) / r.capacityWU;

    return {
      recruiter_id: r.recruiterId,
      recruiter_name_anon: `Recruiter ${anonymizeIndex(r.recruiterId)}`,
      current_utilization: r.utilization,
      projected_utilization: projectedUtilization,
      status_change: getStatusChange(r.utilization, projectedUtilization)
    };
  });

  // Step 6: Determine feasibility
  const feasibility = determineReassignmentFeasibility({
    newTeamUtilization,
    recruiterImpacts,
    unassignableReqs: affectedReqs.length - reassignmentPlan.length
  });

  // Step 7: Identify bottlenecks
  const bottlenecks = identifyReassignmentBottlenecks({
    recruiterImpacts,
    newTeamUtilization,
    affectedReqs,
    reassignmentPlan
  });

  // Step 8: Generate action plan
  const actionPlan = generateRecruiterLeavesActions(
    params,
    affectedReqs,
    reassignmentPlan,
    departingRecruiter
  );

  // Step 9: Calculate deltas
  const deltas: ScenarioDeltas = {
    expected_hires_delta: null,  // Not directly impacted
    offers_delta: null,          // Not directly impacted
    pipeline_gap_delta: null,    // Not directly impacted
    time_to_offer_delta: estimateTTODelayFromReassignment(reassignmentPlan)
  };

  return {
    scenario_id: 'recruiter_leaves',
    scenario_name: `Recruiter ${anonymizeIndex(params.recruiter_id)} departure`,
    generated_at: new Date(),
    feasibility,
    deltas,
    bottlenecks,
    resource_impact: {
      team_utilization_delta: newTeamUtilization - context.capacityAnalysis.teamUtilization,
      recruiter_impacts: recruiterImpacts
    },
    action_plan: actionPlan,
    confidence: calculateConfidence(sampleSizes),
    citations: collectCitations(),
    deep_links: generateRecruiterLeavesDeepLinks(bottlenecks, params),
    blocked: null
  };
}
```

#### Feasibility Determination

```typescript
function determineReassignmentFeasibility(inputs: {
  newTeamUtilization: number;
  recruiterImpacts: RecruiterImpact[];
  unassignableReqs: number;
}): Feasibility {
  const { newTeamUtilization, recruiterImpacts, unassignableReqs } = inputs;

  // Rule 1: If any reqs can't be assigned, impossible
  if (unassignableReqs > 0) {
    return 'IMPOSSIBLE';
  }

  // Rule 2: If team becomes critically overloaded, impossible
  if (newTeamUtilization > 1.3) {
    return 'IMPOSSIBLE';
  }

  // Rule 3: If multiple recruiters become overloaded, at risk
  const newlyOverloaded = recruiterImpacts.filter(
    r => r.status_change === 'BECOMES_OVERLOADED'
  );
  if (newlyOverloaded.length >= 2) {
    return 'AT_RISK';
  }

  // Rule 4: If team utilization increases significantly, at risk
  if (newTeamUtilization > 1.1) {
    return 'AT_RISK';
  }

  return 'ON_TRACK';
}
```

#### Action Plan Generation

```typescript
function generateRecruiterLeavesActions(
  params: RecruiterLeavesParams,
  affectedReqs: Requisition[],
  reassignmentPlan: RebalanceRecommendation[],
  departingRecruiter: RecruiterLoadRow
): ActionItem[] {
  const actions: ActionItem[] = [];
  const daysUntilDeparture = differenceInDays(params.departure_date, new Date());

  // Action: Knowledge transfer
  actions.push({
    action_id: generateActionId('TA_OPS', 'ta-ops', 'general', 'PROCESS_OPTIMIZATION'),
    owner_type: 'TA_OPS',
    owner_id: 'ta-ops',
    owner_name: 'TA Operations',
    req_id: 'general',
    action_type: 'PROCESS_OPTIMIZATION',
    title: 'Conduct knowledge transfer with departing recruiter',
    priority: 'P0',
    due_in_days: Math.min(daysUntilDeparture - 3, 7),
    due_date: addDays(new Date(), Math.min(daysUntilDeparture - 3, 7)),
    evidence: {
      kpi_key: 'departing_recruiter.req_count',
      explain_provider_key: 'scenario_library',
      short_reason: `${affectedReqs.length} requisitions need handoff`
    },
    recommended_steps: [
      'Schedule 1:1 with departing recruiter',
      'Document status of each active requisition',
      'Identify candidates in critical stages',
      'Note any HM preferences or quirks',
      'Transfer any candidate relationships'
    ],
    created_at: new Date(),
    status: 'OPEN'
  });

  // Action: Execute reassignments
  for (const assignment of reassignmentPlan) {
    actions.push({
      action_id: generateActionId('TA_OPS', 'ta-ops', assignment.reqId, 'PROCESS_OPTIMIZATION'),
      owner_type: 'TA_OPS',
      owner_id: 'ta-ops',
      owner_name: 'TA Operations',
      req_id: assignment.reqId,
      req_title: assignment.reqTitle,
      action_type: 'PROCESS_OPTIMIZATION',
      title: `Reassign ${assignment.reqTitle} to ${anonymizeRecruiter(assignment.toRecruiterId)}`,
      priority: 'P1',
      due_in_days: Math.max(daysUntilDeparture - 1, 1),
      due_date: addDays(new Date(), Math.max(daysUntilDeparture - 1, 1)),
      evidence: {
        kpi_key: 'reassignment_plan.fit_improvement',
        explain_provider_key: 'capacity_fit_engine',
        short_reason: assignment.rationale
      },
      recommended_steps: [
        'Update req assignment in ATS',
        'Notify new recruiter owner',
        'Brief on current pipeline status',
        'Introduce to HM if needed'
      ],
      created_at: new Date(),
      status: 'OPEN'
    });
  }

  // Action: Notify affected HMs
  const uniqueHMs = [...new Set(affectedReqs.map(r => r.hiring_manager_id).filter(Boolean))];
  if (uniqueHMs.length > 0) {
    actions.push({
      action_id: generateActionId('TA_OPS', 'ta-ops', 'general', 'PROCESS_OPTIMIZATION'),
      owner_type: 'TA_OPS',
      owner_id: 'ta-ops',
      owner_name: 'TA Operations',
      req_id: 'general',
      action_type: 'PROCESS_OPTIMIZATION',
      title: `Notify ${uniqueHMs.length} HMs of recruiter change`,
      priority: 'P1',
      due_in_days: Math.max(daysUntilDeparture, 1),
      due_date: addDays(new Date(), Math.max(daysUntilDeparture, 1)),
      evidence: {
        kpi_key: 'affected_hms.count',
        explain_provider_key: 'scenario_library',
        short_reason: `${uniqueHMs.length} hiring managers affected`
      },
      recommended_steps: [
        'Draft communication about transition',
        'Introduce new recruiter assignments',
        'Set expectations for brief ramp-up period'
      ],
      created_at: new Date(),
      status: 'OPEN'
    });
  }

  return deduplicateActions(actions);
}
```

#### Supported vs Blocked Outputs

| Output | Supported | Blocked When |
|--------|-----------|--------------|
| feasibility | Always | Never |
| expected_hires_delta | Never | N/A for this scenario |
| offers_delta | Never | N/A for this scenario |
| pipeline_gap_delta | Never | N/A for this scenario |
| time_to_offer_delta | When fit data exists | No fit matrix data |
| resource_impact | Always | Never |
| bottlenecks | Always | Never |
| action_plan | Always | Never |

---

## 4. UI Plan

### 4.1 Location

**Tab:** `/plan/scenarios` (new route)
**Bucket:** Plan
**Position:** After Forecasting in navigation

```typescript
// Add to routes.tsx
{ path: '/plan/scenarios', tab: 'scenarios', bucket: 'plan' },
```

### 4.2 Page Structure

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Scenario Library                                              [? Help]  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ SCENARIO SELECTOR                                                │   │
│  │ ┌─────────────┐ ┌─────────────┐ ┌─────────────────┐             │   │
│  │ │ Spin Up     │ │ Hiring      │ │ Recruiter       │             │   │
│  │ │ New Team    │ │ Freeze      │ │ Leaves          │             │   │
│  │ └─────────────┘ └─────────────┘ └─────────────────┘             │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────┐ ┌─────────────────────────────────┐   │
│  │ PARAMETER FORM              │ │ OUTPUT PANEL                    │   │
│  │                             │ │                                 │   │
│  │ [Scenario-specific inputs]  │ │ Feasibility: [ON_TRACK]         │   │
│  │                             │ │                                 │   │
│  │ Target Date: [____]         │ │ ┌─────────────────────────────┐ │   │
│  │ Headcount: [___]            │ │ │ DELTAS                      │ │   │
│  │ Function: [Engineering ▼]   │ │ │ Expected Hires: +5          │ │   │
│  │ Level: [L4 ▼]               │ │ │ Pipeline Gap: -5            │ │   │
│  │ ...                         │ │ │ Time to Offer: +14d         │ │   │
│  │                             │ │ └─────────────────────────────┘ │   │
│  │                             │ │                                 │   │
│  │ [Run Scenario]              │ │ ┌─────────────────────────────┐ │   │
│  │                             │ │ │ BOTTLENECKS                 │ │   │
│  │                             │ │ │ 1. Capacity gap (CRITICAL)  │ │   │
│  │                             │ │ │ 2. HM friction (HIGH)       │ │   │
│  │                             │ │ │ 3. Pipeline depth (MEDIUM)  │ │   │
│  │                             │ │ └─────────────────────────────┘ │   │
│  │                             │ │                                 │   │
│  │                             │ │ ┌─────────────────────────────┐ │   │
│  │                             │ │ │ ACTION PLAN (5 items)       │ │   │
│  │                             │ │ │ [View Details]              │ │   │
│  │                             │ │ └─────────────────────────────┘ │   │
│  │                             │ │                                 │   │
│  │                             │ │ ┌─────────────────────────────┐ │   │
│  │                             │ │ │ CONFIDENCE: MED             │ │   │
│  │                             │ │ │ • TTF sample: n=12 (ok)     │ │   │
│  │                             │ │ │ • Capacity: n=8 (ok)        │ │   │
│  │                             │ │ └─────────────────────────────┘ │   │
│  └─────────────────────────────┘ └─────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ [Generate Action Plan]              [Explain for Execs] (AI)    │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 4.3 Component Hierarchy

```typescript
// components/scenarios/
├── ScenarioLibraryTab.tsx        // Main tab container
├── ScenarioSelector.tsx          // Scenario type cards
├── parameters/
│   ├── SpinUpTeamForm.tsx        // Spin Up Team params
│   ├── HiringFreezeForm.tsx      // Hiring Freeze params
│   └── RecruiterLeavesForm.tsx   // Recruiter Leaves params
├── output/
│   ├── ScenarioOutputPanel.tsx   // Output container
│   ├── FeasibilityBadge.tsx      // ON_TRACK/AT_RISK/etc badge
│   ├── DeltasCard.tsx            // Metrics deltas display
│   ├── BottlenecksCard.tsx       // Bottleneck list with evidence
│   ├── ActionPlanCard.tsx        // Action summary with expand
│   ├── ConfidenceCard.tsx        // Confidence with sample sizes
│   └── CitationsDrawer.tsx       // Full citations list
├── actions/
│   ├── GenerateActionPlanButton.tsx  // Writes to Action Queue
│   └── ExplainForExecsButton.tsx     // BYOK AI narration
└── __tests__/
    ├── ScenarioLibraryTab.test.tsx
    └── scenarioEngine.test.ts
```

### 4.4 Cross-Tab Linking

Other tabs link TO Scenario Library (not vice versa):

| Source Tab | Link Location | Link Text | Target |
|------------|---------------|-----------|--------|
| Capacity | Team Capacity Summary | "Model a team change" | `/plan/scenarios?scenario=spin_up_team` |
| Capacity | Recruiter Load Table | "Model departure" | `/plan/scenarios?scenario=recruiter_leaves&recruiter_id={id}` |
| Forecasting | Role Forecast | "Plan hiring for this role" | `/plan/scenarios?scenario=spin_up_team&function={fn}&level={lvl}` |
| Control Tower | Risk Alerts | "Model freeze impact" | `/plan/scenarios?scenario=hiring_freeze` |

### 4.5 Button Behaviors

#### "Generate Action Plan" Button

```typescript
async function handleGenerateActionPlan(output: ScenarioOutput) {
  // Step 1: Filter to new actions (not already in queue)
  const existingActions = await loadActionStates(context.datasetId);
  const newActions = output.action_plan.filter(
    a => !existingActions.has(a.action_id)
  );

  if (newActions.length === 0) {
    showToast('All actions already in your queue');
    return;
  }

  // Step 2: Confirm with user
  const confirmed = await confirmDialog({
    title: 'Add to Action Queue',
    message: `Add ${newActions.length} actions from this scenario to your Action Queue?`,
    actions: newActions.slice(0, 3).map(a => a.title),
    confirmText: 'Add Actions'
  });

  if (!confirmed) return;

  // Step 3: Merge into unified queue
  await mergeScenarioActions(newActions, context.datasetId);

  // Step 4: Navigate to action queue
  navigate('/control-tower', { state: { highlightActions: newActions.map(a => a.action_id) } });
}
```

#### "Explain for Execs" Button

See Section 5 (AI Narration Plan).

### 4.6 UI Consolidation Addendum

This section establishes strict rules to prevent scenario UI from being duplicated across the application. Scenario functionality **must** be consolidated in the Plan bucket.

#### 4.6.1 UI Ownership Map

| Module | Scenario Ownership | Allowed UI |
|--------|-------------------|------------|
| **Plan → Scenarios** (`/plan/scenarios`) | **OWNER** — Full scenario configuration, execution, and output display | Parameter forms, output panels, action generation, AI narration |
| **Plan → Forecasting** | CTA-only | "Plan hiring for this role" link → navigates to `/plan/scenarios?scenario=spin_up_team` |
| **Plan → Capacity** | CTA-only | "Model a team change" link, "Model departure" link → navigates to Scenarios |
| **Control Tower** | CTA-only | "Model freeze impact" link → navigates to Scenarios |
| **Diagnose tabs** | CTA-only | Deep links only; no scenario UI |
| **All other tabs** | **NONE** | No scenario-related UI whatsoever |

**Ownership Rules:**
- **Only `/plan/scenarios` may render:** `ScenarioSelector`, parameter forms, `ScenarioOutputPanel`, `FeasibilityBadge`, `BottlenecksCard`, `ActionPlanCard`, `ConfidenceCard`, `CitationsDrawer`
- **Other tabs may only render:** A `<Link>` or `<Button onClick={navigate}>` that routes to `/plan/scenarios` with query params
- **No tab outside Plan/Scenarios may:** Import scenario components, call `runScenario()`, or display scenario outputs inline

#### 4.6.2 Reuse-Only Component Rule

All Scenario Library UI **must** use existing shared primitives from `/components/common/`. Bespoke styling is prohibited.

| UI Element | Required Primitive | Prohibited |
|------------|-------------------|------------|
| Page title | `PageHeader` | Raw `<h1>`, inline `fontSize` |
| Section titles | `SectionHeader` | Raw `<h2>`/`<h3>`, custom headers |
| KPI displays | `StatValue`, `StatLabel`, `KPICard` | Inline `fontFamily: monospace` |
| Glass containers | `GlassPanel` | Custom `backdrop-filter` divs |
| Info tooltips | `InlineHelp` | Custom tooltip implementations |
| Status badges | Existing badge classes from `dashboard-theme.css` | New badge CSS |

**Enforcement:**
- PR reviews must verify no new CSS classes for typography, layout, or glass effects
- `npm run ui:style-audit` must pass before merge (catches inline styles, raw headers)
- Scenario components must import from `components/common/`, not define local primitives

#### 4.6.3 Anti-Duplication Verification

To prevent scenario UI from appearing outside the Plan bucket, the following verification mechanisms are required:

**1. Import Boundary Test**

```typescript
// File: services/__tests__/scenarioImportBoundary.test.ts

describe('Scenario Import Boundary', () => {
  const ALLOWED_IMPORTERS = [
    'components/scenarios/',           // Scenario Library tab
    'services/scenarios/',             // Scenario services
    'services/scenarioEngine.ts',
    'services/scenarioNarrationService.ts',
    'services/__tests__/'              // Tests
  ];

  it('scenario components are only imported by allowed modules', async () => {
    const scenarioExports = [
      'ScenarioSelector',
      'ScenarioOutputPanel',
      'FeasibilityBadge',
      'BottlenecksCard',
      'ActionPlanCard',
      'runScenario',
      'SpinUpTeamForm',
      'HiringFreezeForm',
      'RecruiterLeavesForm'
    ];

    for (const exportName of scenarioExports) {
      const importers = await findImporters(exportName);
      const violations = importers.filter(
        path => !ALLOWED_IMPORTERS.some(allowed => path.includes(allowed))
      );

      expect(violations).toEqual([]);
    }
  });

  it('scenario types can be imported anywhere (types are safe)', () => {
    // ScenarioOutput, ScenarioInput, etc. are data types — safe to import
    // This test documents that types are NOT restricted
  });
});
```

**2. Route Audit Test**

```typescript
// File: components/__tests__/scenarioRouteAudit.test.ts

describe('Scenario Route Audit', () => {
  it('scenario UI only renders at /plan/scenarios route', () => {
    const SCENARIO_COMPONENTS = [
      'ScenarioLibraryTab',
      'ScenarioSelector',
      'ScenarioOutputPanel'
    ];

    // Parse routes.tsx and verify scenario components only appear in /plan/scenarios
    const routes = parseRouteConfig();
    const scenarioRoutes = routes.filter(r =>
      SCENARIO_COMPONENTS.some(c => r.component?.includes(c))
    );

    expect(scenarioRoutes).toHaveLength(1);
    expect(scenarioRoutes[0].path).toBe('/plan/scenarios');
  });

  it('no inline scenario rendering in other tabs', () => {
    const NON_SCENARIO_TABS = [
      'ControlTowerTab',
      'CapacityTab',
      'ForecastingTab',
      'VelocityTab',
      'HMFrictionTab'
    ];

    for (const tabFile of NON_SCENARIO_TABS) {
      const content = readFileSync(`components/${tabFile}.tsx`, 'utf-8');

      // Must not import scenario UI components
      expect(content).not.toMatch(/import.*from.*scenarios\/(Scenario|Feasibility|Bottleneck|ActionPlan)/);

      // Must not call runScenario
      expect(content).not.toMatch(/runScenario\(/);

      // Must not render scenario output inline
      expect(content).not.toMatch(/<ScenarioOutputPanel/);
      expect(content).not.toMatch(/<FeasibilityBadge/);
    }
  });
});
```

**3. CI Pipeline Check**

Add to `.github/workflows/ci.yml`:

```yaml
- name: Scenario UI Boundary Check
  run: |
    # Fail if scenario components are imported outside allowed paths
    VIOLATIONS=$(grep -r "from.*scenarios/" src/components src/productivity-dashboard \
      --include="*.tsx" --include="*.ts" \
      | grep -v "scenarios/" \
      | grep -v "__tests__" \
      | grep -v "// @allowed-scenario-import" \
      || true)

    if [ -n "$VIOLATIONS" ]; then
      echo "❌ Scenario UI boundary violation detected:"
      echo "$VIOLATIONS"
      echo ""
      echo "Scenario components may only be imported within:"
      echo "  - components/scenarios/"
      echo "  - services/scenarios/"
      echo "  - Test files"
      echo ""
      echo "Other tabs should use deep links, not inline scenario UI."
      exit 1
    fi
    echo "✅ Scenario UI boundary check passed"
```

**4. Pre-commit Hook (Optional)**

```bash
# .husky/pre-commit (add to existing)
npm run test -- --testPathPattern="scenarioImportBoundary|scenarioRouteAudit" --passWithNoTests
```

#### 4.6.4 Allowed CTA Patterns

Other tabs may link TO scenarios using these approved patterns:

```tsx
// ✅ ALLOWED: Simple navigation link
<Link to="/plan/scenarios?scenario=spin_up_team">
  Plan hiring for this role
</Link>

// ✅ ALLOWED: Button with navigate
<Button onClick={() => navigate('/plan/scenarios?scenario=recruiter_leaves&recruiter_id=' + id)}>
  Model departure
</Button>

// ✅ ALLOWED: Deep link with pre-filled params
const scenarioLink = buildScenarioDeepLink('hiring_freeze', { freeze_weeks: 4 });
<a href={scenarioLink}>Model freeze impact</a>

// ❌ PROHIBITED: Inline scenario execution
const output = runScenario({ scenario_id: 'spin_up_team', ... });
<FeasibilityBadge status={output.feasibility} />

// ❌ PROHIBITED: Importing scenario UI components
import { ScenarioOutputPanel } from '../scenarios/output/ScenarioOutputPanel';
```

#### 4.6.5 Verification Checklist (PR Review)

Before approving any PR that touches scenario-related code:

- [ ] Scenario UI components only exist in `components/scenarios/`
- [ ] No other tab imports from `components/scenarios/` (except types)
- [ ] No other tab calls `runScenario()` directly
- [ ] CTA links use `navigate()` or `<Link>`, not inline rendering
- [ ] `npm run ui:style-audit` passes
- [ ] Import boundary test passes: `npm test -- scenarioImportBoundary`
- [ ] Route audit test passes: `npm test -- scenarioRouteAudit`

---

## 5. AI Narration Plan

### 5.1 Overview

Optional BYOK AI feature that generates exec-friendly narrative from scenario output. AI never computes—it only narrates the deterministic results.

### 5.2 Task Type

```typescript
const AI_TASK_TYPE = 'scenario_narration';
```

### 5.3 Input Schema

```typescript
interface ScenarioNarrationInput {
  /** Scenario type */
  scenario_id: ScenarioId;
  scenario_name: string;

  /** Redacted scenario parameters (no PII) */
  parameters_redacted: {
    // Spin Up Team
    headcount?: number;
    function?: string;
    level?: string;
    target_days?: number;
    // Hiring Freeze
    freeze_weeks?: number;
    candidate_action?: string;
    scope?: string;
    // Recruiter Leaves
    departure_days_from_now?: number;
    affected_req_count?: number;
    reassignment_strategy?: string;
  };

  /** Deterministic output to narrate */
  output: {
    feasibility: Feasibility;
    deltas: ScenarioDeltas;
    bottlenecks: Array<{
      rank: number;
      constraint_type: string;
      description: string;
      severity: string;
      mitigation: string;
    }>;
    resource_impact: {
      team_utilization_delta: number;
    } | null;
    confidence: {
      level: string;
      reasons: string[];
    };
    action_plan_summary: {
      total_actions: number;
      p0_count: number;
      p1_count: number;
      p2_count: number;
    };
  };

  /** Citations for AI to reference */
  citations: Citation[];
}
```

### 5.4 System Prompt

```typescript
const SCENARIO_NARRATION_PROMPT = `You are an executive communication assistant for ProdDash, a recruiting analytics platform. Your task is to narrate scenario planning results for executive stakeholders.

## CRITICAL RULES

1. **NO COMPUTATION**: You are narrating pre-computed results. Never calculate or invent numbers.
2. **CITATIONS REQUIRED**: Every factual claim must cite a key_path from the provided citations.
3. **EXEC TONE**: Write for time-pressed executives who need the "so what" and "now what".
4. **NO PII**: Never include names, emails, or identifiable information.

## Output Schema

Respond with valid JSON:
\`\`\`json
{
  "headline": "1-sentence executive summary",
  "bullets": [
    {
      "text": "Insight or finding",
      "citation": "key_path from citations array"
    }
  ],
  "asks": [
    "Specific request or decision needed from exec"
  ],
  "caveats": [
    "Important limitation or assumption"
  ]
}
\`\`\`

## Guidelines

- **Headline**: Start with feasibility verdict, then key implication
- **Bullets**: 5-10 bullets covering:
  - What happens if we proceed (deltas)
  - What's blocking success (bottlenecks)
  - What the team needs (resource impact)
  - What we're confident about vs uncertain (confidence)
- **Asks**: 2-4 specific decisions or approvals needed from leadership
- **Caveats**: 1-3 limitations (e.g., "Based on historical data; market conditions may vary")

## Tone Examples

✓ "Hiring 5 engineers in 60 days is AT_RISK—our recruiter capacity is 18% short."
✓ "The freeze will reduce our expected hires by ~3 (from 11 to 8) due to candidate decay."
✓ "Reassigning Sarah's 8 reqs will push 2 recruiters into overload territory."

✗ "This is a challenging scenario that requires careful consideration..."
✗ "Based on our analysis, we believe that..."
✗ "It's worth noting that there may be some uncertainty..."
`;
```

### 5.5 Output Validation

```typescript
interface ScenarioNarrationOutput {
  headline: string;
  bullets: Array<{
    text: string;
    citation: string;
  }>;
  asks: string[];
  caveats: string[];
}

function validateNarrationOutput(
  output: ScenarioNarrationOutput,
  input: ScenarioNarrationInput
): ValidationResult {
  const errors: string[] = [];
  const validKeyPaths = new Set(input.citations.map(c => c.key_path));

  // Rule 1: All citations must be valid
  for (const bullet of output.bullets) {
    if (!validKeyPaths.has(bullet.citation)) {
      errors.push(`Invalid citation: ${bullet.citation}`);
    }
  }

  // Rule 2: Must have 5-10 bullets
  if (output.bullets.length < 5 || output.bullets.length > 10) {
    errors.push(`Expected 5-10 bullets, got ${output.bullets.length}`);
  }

  // Rule 3: Must have 2-4 asks
  if (output.asks.length < 2 || output.asks.length > 4) {
    errors.push(`Expected 2-4 asks, got ${output.asks.length}`);
  }

  // Rule 4: Headlines must not be generic
  const genericPhrases = ['challenging', 'careful consideration', 'worth noting'];
  if (genericPhrases.some(p => output.headline.toLowerCase().includes(p))) {
    errors.push('Headline uses generic phrasing');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
```

### 5.6 Fallback Behavior

If AI narration fails validation or errors:

```typescript
function generateDeterministicNarration(output: ScenarioOutput): ScenarioNarrationOutput {
  const bullets = [];

  // Bullet 1: Feasibility
  bullets.push({
    text: `Scenario is ${output.feasibility.replace('_', ' ').toLowerCase()}`,
    citation: 'scenario.feasibility'
  });

  // Bullet 2-4: Top bottlenecks
  for (const bottleneck of output.bottlenecks.slice(0, 3)) {
    bullets.push({
      text: `${bottleneck.severity} constraint: ${bottleneck.description}`,
      citation: bottleneck.evidence.source_citation
    });
  }

  // Bullet 5: Confidence
  bullets.push({
    text: `Confidence is ${output.confidence.level} (${output.confidence.reasons[0]})`,
    citation: 'scenario.confidence'
  });

  return {
    headline: `Scenario: ${output.scenario_name} — ${output.feasibility}`,
    bullets,
    asks: ['Review scenario results', 'Decide on next steps'],
    caveats: ['Results based on historical data']
  };
}
```

---

## 6. Implementation Phases

### Phase A: Engine Scaffolding + Recruiter Leaves Scenario

**Duration:** 1 sprint

**Deliverables:**
1. `types/scenarioTypes.ts` — All TypeScript interfaces
2. `services/scenarioEngine.ts` — Core engine with gating framework
3. `services/scenarios/recruiterLeavesScenario.ts` — First scenario implementation
4. `services/__tests__/recruiterLeavesScenario.test.ts` — Unit tests
5. Basic CLI/console runner for testing

**Success Criteria:**
- `runScenario({ scenario_id: 'recruiter_leaves', ... })` returns valid `ScenarioOutput`
- Gating correctly returns `NOT_ENOUGH_DATA` when data is missing
- Confidence correctly reflects sample sizes

### Phase B: Remaining Scenarios

**Duration:** 1 sprint

**Deliverables:**
1. `services/scenarios/spinUpTeamScenario.ts`
2. `services/scenarios/hiringFreezeScenario.ts`
3. Unit tests for each scenario
4. Integration tests with real data fixtures

**Success Criteria:**
- All 3 scenarios produce valid outputs with synthetic fixtures
- Bottleneck identification works correctly
- Action plan generation produces deduped ActionItems

### Phase C: UI + Action Queue Integration

**Duration:** 1 sprint

**Deliverables:**
1. `components/scenarios/*` — Full UI component tree
2. Route registration and navigation
3. Action Queue integration
4. Cross-tab deep linking

**Success Criteria:**
- Scenario Library page renders and runs scenarios
- "Generate Action Plan" successfully writes to Action Queue
- Deep links from other tabs work correctly

### Phase D: AI Narration + Validation

**Duration:** 0.5 sprint

**Deliverables:**
1. `services/scenarioNarrationService.ts` — AI integration
2. Narration validation and fallback
3. "Explain for Execs" button implementation

**Success Criteria:**
- AI narration generates valid output with citations
- Fallback to deterministic narration works when AI fails
- No PII leakage in AI prompts

---

## 7. Test Plan

### 7.1 Unit Tests

**File:** `services/__tests__/scenarioEngine.test.ts`

```typescript
describe('ScenarioEngine', () => {
  describe('gating', () => {
    it('returns NOT_ENOUGH_DATA when recruiters < 3', () => {
      const input = mockScenarioInput({ recruiters: 2 });
      const output = runScenario(input);
      expect(output.feasibility).toBe('NOT_ENOUGH_DATA');
      expect(output.blocked?.missing_data).toContainEqual(
        expect.objectContaining({ field: 'recruiters' })
      );
    });

    it('returns NOT_ENOUGH_DATA when reqs < 10', () => {
      const input = mockScenarioInput({ openReqs: 5 });
      const output = runScenario(input);
      expect(output.feasibility).toBe('NOT_ENOUGH_DATA');
    });

    it('passes gating when all requirements met', () => {
      const input = mockScenarioInput({ recruiters: 5, openReqs: 20 });
      const output = runScenario(input);
      expect(output.feasibility).not.toBe('NOT_ENOUGH_DATA');
    });
  });

  describe('confidence', () => {
    it('returns LOW confidence when any sample below threshold', () => {
      const input = mockScenarioInput({ historicalHires: 4 }); // Below 5
      const output = runScenario(input);
      expect(output.confidence.level).toBe('LOW');
    });

    it('returns HIGH confidence when all samples exceed 2x threshold', () => {
      const input = mockScenarioInput({
        historicalHires: 40,
        stableWeeks: 52
      });
      const output = runScenario(input);
      expect(output.confidence.level).toBe('HIGH');
    });
  });
});
```

**File:** `services/__tests__/recruiterLeavesScenario.test.ts`

```typescript
describe('RecruiterLeavesScenario', () => {
  it('calculates team utilization after departure', () => {
    const input = mockRecruiterLeavesInput({
      departingRecruiterDemand: 100,
      remainingTeamCapacity: 400,
      remainingTeamDemand: 300
    });
    const output = runRecruiterLeavesScenario(input);

    // (300 - 0 reassigned) / 400 = 75% before reassignment
    // After reassigning 100 WU: (300 + 100) / 400 = 100%
    expect(output.resource_impact?.team_utilization_delta).toBeCloseTo(0.25);
  });

  it('flags BECOMES_OVERLOADED for recruiters exceeding 110%', () => {
    const input = mockRecruiterLeavesInput({
      remainingRecruiters: [
        { id: 'r1', utilization: 0.95, capacity: 100 },  // Will become 115%
        { id: 'r2', utilization: 0.70, capacity: 100 }   // Will become 80%
      ],
      reqsToReassign: [
        { workload: 20, bestFit: 'r1' },  // 20 WU to r1
        { workload: 10, bestFit: 'r2' }   // 10 WU to r2
      ]
    });
    const output = runRecruiterLeavesScenario(input);

    const r1Impact = output.resource_impact?.recruiter_impacts.find(r => r.recruiter_id === 'r1');
    expect(r1Impact?.status_change).toBe('BECOMES_OVERLOADED');
  });

  it('returns IMPOSSIBLE when no recruiters available for reassignment', () => {
    const input = mockRecruiterLeavesInput({
      remainingRecruiters: [
        { id: 'r1', utilization: 1.2 }  // Already overloaded
      ],
      reqsToReassign: [{ workload: 50 }]
    });
    const output = runRecruiterLeavesScenario(input);
    expect(output.feasibility).toBe('IMPOSSIBLE');
  });

  it('generates knowledge transfer action', () => {
    const input = mockRecruiterLeavesInput({ departureDaysFromNow: 14 });
    const output = runRecruiterLeavesScenario(input);

    const ktAction = output.action_plan.find(a =>
      a.title.includes('knowledge transfer')
    );
    expect(ktAction).toBeDefined();
    expect(ktAction?.priority).toBe('P0');
    expect(ktAction?.due_in_days).toBeLessThan(14);
  });
});
```

**File:** `services/__tests__/spinUpTeamScenario.test.ts`

```typescript
describe('SpinUpTeamScenario', () => {
  it('calculates pipeline requirements from headcount', () => {
    const input = mockSpinUpTeamInput({ headcount: 5 });
    const output = runSpinUpTeamScenario(input);

    // If funnel yields 10 candidates per hire
    expect(output.citations).toContainEqual(
      expect.objectContaining({
        key_path: 'pipeline_requirements.total_candidates_needed',
        value: 50  // 5 hires × 10 candidates/hire
      })
    );
  });

  it('returns AT_RISK when TTF exceeds target by 20%', () => {
    const input = mockSpinUpTeamInput({
      targetDays: 60,
      predictedTTF: 75  // 25% over target
    });
    const output = runSpinUpTeamScenario(input);
    expect(output.feasibility).toBe('AT_RISK');
  });

  it('returns IMPOSSIBLE when TTF exceeds target by 50%', () => {
    const input = mockSpinUpTeamInput({
      targetDays: 60,
      predictedTTF: 100  // 67% over target
    });
    const output = runSpinUpTeamScenario(input);
    expect(output.feasibility).toBe('IMPOSSIBLE');
  });

  it('identifies capacity bottleneck when gap > 30%', () => {
    const input = mockSpinUpTeamInput({
      currentCapacityGap: 0.1,  // 10% gap before
      newWorkload: 0.25         // 25% additional
    });
    const output = runSpinUpTeamScenario(input);

    const capacityBottleneck = output.bottlenecks.find(
      b => b.constraint_type === 'CAPACITY_GAP'
    );
    expect(capacityBottleneck).toBeDefined();
    expect(capacityBottleneck?.severity).toBe('CRITICAL');
  });
});
```

**File:** `services/__tests__/hiringFreezeScenario.test.ts`

```typescript
describe('HiringFreezeScenario', () => {
  it('calculates expected hires delta from decay curve', () => {
    const input = mockHiringFreezeInput({
      freezeWeeks: 4,
      decayCurve: [
        { days: 14, acceptRate: 0.90 },
        { days: 42, acceptRate: 0.70 }  // After 4 weeks
      ],
      activeCandidates: 20,
      currentAvgDaysInProcess: 14
    });
    const output = runHiringFreezeScenario(input);

    // Before: 20 × 0.90 = 18 expected
    // After: 20 × 0.70 = 14 expected
    expect(output.deltas.expected_hires_delta).toBe(-4);
  });

  it('adds freeze_weeks × 7 to time_to_offer_delta', () => {
    const input = mockHiringFreezeInput({ freezeWeeks: 6 });
    const output = runHiringFreezeScenario(input);
    expect(output.deltas.time_to_offer_delta).toBe(42);
  });

  it('generates candidate communication action for active pipeline', () => {
    const input = mockHiringFreezeInput({
      activeCandidatesInInterviews: 15
    });
    const output = runHiringFreezeScenario(input);

    const commAction = output.action_plan.find(a =>
      a.title.includes('active candidates')
    );
    expect(commAction).toBeDefined();
    expect(commAction?.priority).toBe('P0');
  });
});
```

### 7.2 Action Plan Deduplication Tests

**File:** `services/__tests__/scenarioActionPlan.test.ts`

```typescript
describe('ActionPlan Deduplication', () => {
  it('deduplicates actions with same owner+req+type', () => {
    const actions = [
      mockAction({ owner: 'r1', req: 'req1', type: 'FEEDBACK_DUE', priority: 'P1' }),
      mockAction({ owner: 'r1', req: 'req1', type: 'FEEDBACK_DUE', priority: 'P0' })
    ];
    const deduped = deduplicateActions(actions);
    expect(deduped.length).toBe(1);
    expect(deduped[0].priority).toBe('P0');  // Higher priority kept
  });

  it('keeps actions with different types for same owner+req', () => {
    const actions = [
      mockAction({ owner: 'r1', req: 'req1', type: 'FEEDBACK_DUE' }),
      mockAction({ owner: 'r1', req: 'req1', type: 'REVIEW_DUE' })
    ];
    const deduped = deduplicateActions(actions);
    expect(deduped.length).toBe(2);
  });

  it('generates deterministic action_ids', () => {
    const id1 = generateActionId('RECRUITER', 'r1', 'req1', 'FEEDBACK_DUE');
    const id2 = generateActionId('RECRUITER', 'r1', 'req1', 'FEEDBACK_DUE');
    expect(id1).toBe(id2);
  });
});
```

### 7.3 UI Smoke Tests

**File:** `components/__tests__/ScenarioLibraryTab.test.tsx`

```typescript
describe('ScenarioLibraryTab', () => {
  it('renders scenario selector with 3 options', () => {
    render(<ScenarioLibraryTab />);
    expect(screen.getByText('Spin Up New Team')).toBeInTheDocument();
    expect(screen.getByText('Hiring Freeze')).toBeInTheDocument();
    expect(screen.getByText('Recruiter Leaves')).toBeInTheDocument();
  });

  it('shows parameter form when scenario selected', async () => {
    render(<ScenarioLibraryTab />);
    fireEvent.click(screen.getByText('Spin Up New Team'));

    await waitFor(() => {
      expect(screen.getByLabelText('Headcount')).toBeInTheDocument();
      expect(screen.getByLabelText('Target Days')).toBeInTheDocument();
    });
  });

  it('shows output panel after running scenario', async () => {
    render(<ScenarioLibraryTab />);

    // Select scenario and fill params
    fireEvent.click(screen.getByText('Recruiter Leaves'));
    fireEvent.change(screen.getByLabelText('Recruiter'), { target: { value: 'r1' } });
    fireEvent.click(screen.getByText('Run Scenario'));

    await waitFor(() => {
      expect(screen.getByText(/Feasibility:/)).toBeInTheDocument();
      expect(screen.getByText(/Bottlenecks/)).toBeInTheDocument();
    });
  });

  it('shows NOT_ENOUGH_DATA state when blocked', async () => {
    // Mock scenario engine to return blocked
    jest.spyOn(scenarioEngine, 'runScenario').mockReturnValue(
      mockBlockedOutput({ reason: 'Insufficient recruiters' })
    );

    render(<ScenarioLibraryTab />);
    fireEvent.click(screen.getByText('Run Scenario'));

    await waitFor(() => {
      expect(screen.getByText('Not Enough Data')).toBeInTheDocument();
      expect(screen.getByText(/Insufficient recruiters/)).toBeInTheDocument();
    });
  });

  it('disables "Explain for Execs" when no AI key', () => {
    render(<ScenarioLibraryTab aiConfig={null} />);

    const explainButton = screen.getByText('Explain for Execs');
    expect(explainButton).toBeDisabled();
  });
});
```

### 7.4 AI Narration Tests

**File:** `services/__tests__/scenarioNarrationService.test.ts`

```typescript
describe('ScenarioNarrationService', () => {
  it('validates that all citations exist in input', async () => {
    const input = mockNarrationInput({
      citations: [{ key_path: 'capacity.team_demand' }]
    });

    const output: ScenarioNarrationOutput = {
      headline: 'Test',
      bullets: [
        { text: 'Valid', citation: 'capacity.team_demand' },
        { text: 'Invalid', citation: 'nonexistent.key' }  // Bad!
      ],
      asks: ['Ask 1', 'Ask 2'],
      caveats: ['Caveat']
    };

    const result = validateNarrationOutput(output, input);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Invalid citation: nonexistent.key');
  });

  it('falls back to deterministic when AI fails', async () => {
    jest.spyOn(aiService, 'sendAiRequest').mockRejectedValue(new Error('AI error'));

    const scenarioOutput = mockScenarioOutput();
    const narration = await generateExecNarration(scenarioOutput, mockAiConfig());

    expect(narration.headline).toContain(scenarioOutput.feasibility);
    expect(narration.bullets.length).toBeGreaterThanOrEqual(5);
  });

  it('redacts PII from AI input', async () => {
    const scenarioOutput = mockScenarioOutput({
      resource_impact: {
        recruiter_impacts: [
          { recruiter_id: 'real-uuid', recruiter_name_anon: 'Recruiter 1' }
        ]
      }
    });

    let capturedInput: any;
    jest.spyOn(aiService, 'sendAiRequest').mockImplementation(async (config, messages) => {
      capturedInput = JSON.parse(messages[0].content);
      return mockAiResponse();
    });

    await generateExecNarration(scenarioOutput, mockAiConfig());

    expect(capturedInput.output.resource_impact.recruiter_impacts[0])
      .not.toHaveProperty('recruiter_id');
    expect(capturedInput.output.resource_impact.recruiter_impacts[0].recruiter_name_anon)
      .toBe('Recruiter 1');
  });
});
```

---

## 8. Non-Goals (V1)

1. **No external market data** — No salary benchmarks, competitor intel, or labor market trends
2. **No ML causal claims** — Use "estimated" language with confidence levels, not "will cause"
3. **No auto-executing actions** — User must click to add to Action Queue
4. **No historical scenario comparison** — Can't compare "what if we had done X last quarter"
5. **No multi-scenario composition** — Can't chain "freeze + then spin up"
6. **No scenario persistence** — Scenarios are ephemeral; re-run to see current state
7. **No custom scenario builder** — V1 has fixed 3 scenarios

---

## 9. File List

### Types
| File | Purpose |
|------|---------|
| `types/scenarioTypes.ts` | All scenario interfaces |

### Services
| File | Purpose |
|------|---------|
| `services/scenarioEngine.ts` | Core engine, gating, orchestration |
| `services/scenarios/spinUpTeamScenario.ts` | Spin Up Team logic |
| `services/scenarios/hiringFreezeScenario.ts` | Hiring Freeze logic |
| `services/scenarios/recruiterLeavesScenario.ts` | Recruiter Leaves logic |
| `services/scenarioActionPlanService.ts` | Action generation and deduplication |
| `services/scenarioNarrationService.ts` | AI narration integration |

### Components
| File | Purpose |
|------|---------|
| `components/scenarios/ScenarioLibraryTab.tsx` | Main tab container |
| `components/scenarios/ScenarioSelector.tsx` | Scenario cards |
| `components/scenarios/parameters/*.tsx` | Parameter forms |
| `components/scenarios/output/*.tsx` | Output display components |
| `components/scenarios/actions/*.tsx` | Button components |

### Tests
| File | Purpose |
|------|---------|
| `services/__tests__/scenarioEngine.test.ts` | Engine unit tests |
| `services/__tests__/*Scenario.test.ts` | Per-scenario tests |
| `services/__tests__/scenarioActionPlan.test.ts` | Action dedup tests |
| `services/__tests__/scenarioNarrationService.test.ts` | AI tests |
| `components/__tests__/ScenarioLibraryTab.test.tsx` | UI smoke tests |

---

## Appendix A: Constants

```typescript
// Gating thresholds
const MIN_RECRUITERS = 3;
const MIN_OPEN_REQS = 10;
const MIN_RECRUITER_ID_COVERAGE = 0.5;  // 50%

// Sample size thresholds
const MIN_HIRES_FOR_TTF = 5;
const MIN_OFFERS_FOR_DECAY = 10;
const MIN_STABLE_WEEKS_FOR_CAPACITY = 8;
const MIN_FIT_OBSERVATIONS = 3;

// Confidence multipliers
const HIGH_CONFIDENCE_MULTIPLIER = 2.0;
const MED_CONFIDENCE_MULTIPLIER = 1.5;

// Feasibility thresholds
const TTF_IMPOSSIBLE_MULTIPLIER = 1.5;  // TTF > target × 1.5 = IMPOSSIBLE
const TTF_AT_RISK_MULTIPLIER = 1.2;     // TTF > target × 1.2 = AT_RISK
const CAPACITY_AT_RISK_THRESHOLD = 0.3; // Gap > 30% of current = AT_RISK
const TEAM_UTILIZATION_IMPOSSIBLE = 1.3;// >130% = IMPOSSIBLE
const TEAM_UTILIZATION_AT_RISK = 1.1;   // >110% = AT_RISK

// Accept rate thresholds
const ACCEPT_RATE_DROP_IMPOSSIBLE = -0.5; // -50% = IMPOSSIBLE
const ACCEPT_RATE_DROP_AT_RISK = -0.2;    // -20% = AT_RISK

// Recruiter status thresholds
const UTILIZATION_OVERLOADED = 1.1;  // 110%
```

---

## Appendix B: Glossary

| Term | Definition |
|------|------------|
| **Scenario** | A "what if" model with parameters, deterministic computation, and actionable output |
| **Feasibility** | Overall assessment: ON_TRACK, AT_RISK, IMPOSSIBLE, or NOT_ENOUGH_DATA |
| **Bottleneck** | A constraint limiting scenario success, ranked by severity |
| **Delta** | Change in metric from baseline to projected state |
| **Gating** | Required data checks that block scenario execution if not met |
| **Citation** | Reference to a specific data point used in computation |
| **Action Plan** | List of ActionItems generated by scenario for Unified Action Queue |
| **Narration** | AI-generated exec-friendly summary of scenario results |
| **WU** | Workload Units — dimensionless measure of recruiting effort |

---

## Appendix C: Deep Link Routes

| Link | Route | Query Params |
|------|-------|--------------|
| Scenario Library | `/plan/scenarios` | `?scenario={id}` |
| Spin Up Team | `/plan/scenarios` | `?scenario=spin_up_team&function={fn}&level={lvl}` |
| Hiring Freeze | `/plan/scenarios` | `?scenario=hiring_freeze` |
| Recruiter Leaves | `/plan/scenarios` | `?scenario=recruiter_leaves&recruiter_id={id}` |
| Capacity Tab | `/plan/capacity` | — |
| Velocity Tab | `/diagnose/velocity` | — |
| HM Friction Tab | `/diagnose/hm-friction` | `?hm_id={id}` |
| Forecasting Tab | `/plan/forecast` | — |
| Control Tower | `/control-tower` | `?highlightActions={ids}` |
