/**
 * Scenario Library Types
 *
 * TypeScript interfaces for the Scenario Library feature.
 * These define the contract between scenario engine, services, and UI.
 */

import { MetricFilters } from './metrics';
import { ActionItem, ActionType } from './actionTypes';

// =============================================================================
// Scenario Identifiers and Parameters
// =============================================================================

export type ScenarioId = 'spin_up_team' | 'hiring_freeze' | 'recruiter_leaves';

export type ScenarioParameters =
  | SpinUpTeamParams
  | HiringFreezeParams
  | RecruiterLeavesParams;

export interface SpinUpTeamParams {
  /** Target team size */
  headcount: number; // Default: 5, Range: 1-20

  /** Role profile for hires */
  role_profile: {
    function: string; // Default: 'Engineering', Options from job_family
    level: string; // Default: 'L4', Options from level
    location_type: 'Remote' | 'Hybrid' | 'Onsite'; // Default: 'Hybrid'
  };

  /** Assigned hiring manager (optional, for HM weight) */
  hiring_manager_id?: string;

  /** Assigned recruiters (optional, for capacity impact) */
  assigned_recruiter_ids?: string[];

  /** Days from start to target completion */
  target_days: number; // Default: 60, Range: 30-180
}

export interface HiringFreezeParams {
  /** Number of weeks to freeze hiring */
  freeze_weeks: number; // Default: 4, Range: 1-26

  /** What happens to candidates during freeze */
  candidate_action: 'HOLD' | 'REJECT_SOFT' | 'WITHDRAW'; // Default: 'HOLD'

  /** Scope of freeze */
  scope: {
    type: 'ALL' | 'FUNCTION' | 'LEVEL' | 'SPECIFIC_REQS';
    filter_value?: string; // Function name, level, or req IDs
  };
}

export interface RecruiterLeavesParams {
  /** ID of the departing recruiter */
  recruiter_id: string; // Required

  /** Last day of the recruiter */
  departure_date: Date; // Default: 14 days from now

  /** Reassignment strategy */
  reassignment_strategy: 'OPTIMIZE_FIT' | 'BALANCE_LOAD' | 'MANUAL'; // Default: 'OPTIMIZE_FIT'

  /** If MANUAL, specific assignments */
  manual_assignments?: {
    req_id: string;
    to_recruiter_id: string;
  }[];
}

// =============================================================================
// Scenario Input
// =============================================================================

export interface ScenarioInput {
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
    current_filters: MetricFilters;
  };
}

// =============================================================================
// Scenario Output
// =============================================================================

export type Feasibility = 'ON_TRACK' | 'AT_RISK' | 'IMPOSSIBLE' | 'NOT_ENOUGH_DATA';

export interface ScenarioOutput {
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

export interface ScenarioDeltas {
  /** Change in expected hires within scenario window */
  expected_hires_delta: number | null;
  /** Change in offer count projection */
  offers_delta: number | null;
  /** Change in pipeline gap (negative = improvement) */
  pipeline_gap_delta: number | null;
  /** Change in time-to-offer days (negative = faster) */
  time_to_offer_delta: number | null;
}

export interface Bottleneck {
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

export type ConstraintType =
  | 'CAPACITY_GAP' // Insufficient recruiter capacity
  | 'PIPELINE_DEPTH' // Not enough candidates in funnel
  | 'VELOCITY_DECAY' // Decay curve too steep
  | 'HM_FRICTION' // HM latency blocking progress
  | 'FORECAST_CONFIDENCE' // Low confidence in TTF predictions
  | 'MISSING_DATA'; // Required data not available

export interface ResourceImpact {
  /** Team-wide utilization change */
  team_utilization_delta: number;
  /** Per-recruiter impact */
  recruiter_impacts: RecruiterImpact[];
}

export interface RecruiterImpact {
  recruiter_id: string;
  recruiter_name_anon: string; // "Recruiter 1", "Recruiter 2"
  current_utilization: number;
  projected_utilization: number;
  status_change: 'BECOMES_OVERLOADED' | 'BECOMES_AVAILABLE' | 'NO_CHANGE';
}

export interface ConfidenceAssessment {
  level: 'HIGH' | 'MED' | 'LOW';
  reasons: string[];
  sample_sizes: SampleSize[];
}

export interface SampleSize {
  metric_key: string;
  n: number;
  threshold: number;
  sufficient: boolean;
}

export interface Citation {
  key_path: string; // e.g., "capacity.team_demand"
  label: string; // Human-readable label
  value: number | string;
  source_service: string; // Service that computed this value
}

export interface DeepLink {
  label: string;
  tab: string;
  params: Record<string, string>;
  rationale: string;
}

export interface BlockedInfo {
  reason: string;
  missing_data: MissingDataItem[];
  fix_instructions: string[];
}

export interface MissingDataItem {
  field: string;
  description: string;
  required_for: string;
}

// =============================================================================
// Scenario Context (Internal)
// =============================================================================

export interface ScenarioContext {
  org_id: string;
  dataset_id: string;
  requisitions: RequisitionForScenario[];
  candidates: CandidateForScenario[];
  events: EventForScenario[];
  recruiters: RecruiterForScenario[];
  hiringManagers: HiringManagerForScenario[];
  capacityAnalysis: CapacityAnalysisForScenario | null;
  fitMatrix: FitMatrixForScenario | null;
  benchmarks: BenchmarksForScenario | null;
}

export interface RequisitionForScenario {
  req_id: string;
  title: string;
  status: string;
  recruiter_id: string | null;
  hiring_manager_id: string | null;
  job_family: string | null;
  level: string | null;
  location_type: string | null;
  opened_at: Date | null;
  closed_at: Date | null;
}

export interface CandidateForScenario {
  candidate_id: string;
  req_id: string;
  current_stage: string;
  current_stage_entered_at: Date | null;
  applied_at: Date | null;
}

export interface EventForScenario {
  event_id: string;
  candidate_id: string;
  from_stage: string | null;
  to_stage: string;
  timestamp: Date;
}

export interface RecruiterForScenario {
  recruiter_id: string;
  name: string;
  capacity_wu: number;
  demand_wu: number;
  utilization: number;
}

export interface HiringManagerForScenario {
  hm_id: string;
  name: string;
  avg_feedback_days: number;
}

export interface CapacityAnalysisForScenario {
  team_capacity: number;
  team_demand: number;
  team_utilization: number;
  capacity_gap: number;
  recruiter_loads: RecruiterForScenario[];
}

export interface FitMatrixForScenario {
  scores: Record<string, Record<string, number>>; // recruiter_id -> req_id -> fit_score
}

export interface BenchmarksForScenario {
  median_ttf_days: number;
  funnel_conversion_rates: Record<string, number>; // stage -> rate
  accept_rate: number;
  candidates_per_hire: number;
}

// =============================================================================
// Gating
// =============================================================================

export interface GatingResult {
  passed: boolean;
  blocked: BlockedInfo | null;
}

export interface GatingRequirement {
  name: string;
  check: (context: ScenarioContext, params: ScenarioParameters) => boolean;
  fix_instruction: string;
  missing_data_item: MissingDataItem;
}

// =============================================================================
// Reassignment Plan (for Recruiter Leaves)
// =============================================================================

export interface RebalanceRecommendation {
  req_id: string;
  req_title: string;
  from_recruiter_id: string;
  to_recruiter_id: string;
  demand_impact: number;
  fit_score: number;
  rationale: string;
}

// =============================================================================
// AI Narration Types
// =============================================================================

export interface ScenarioNarrationInput {
  /** Scenario type */
  scenario_id: ScenarioId;
  scenario_name: string;

  /** Redacted scenario parameters (no PII) */
  parameters_redacted: Record<string, unknown>;

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

export interface ScenarioNarrationOutput {
  headline: string;
  bullets: Array<{
    text: string;
    citation: string;
  }>;
  asks: string[];
  caveats: string[];
}

// =============================================================================
// Constants
// =============================================================================

// Gating thresholds - relaxed for real-world data
export const MIN_RECRUITERS = 2; // Lowered from 3
export const MIN_OPEN_REQS = 5;  // Lowered from 10
export const MIN_RECRUITER_ID_COVERAGE = 0.3; // 30% - lowered from 50%

// Sample size thresholds - relaxed to produce insights with less data
export const MIN_HIRES_FOR_TTF = 3;   // Lowered from 5
export const MIN_OFFERS_FOR_DECAY = 3; // Lowered from 10
export const MIN_STABLE_WEEKS_FOR_CAPACITY = 8;
export const MIN_FIT_OBSERVATIONS = 3;

// Confidence multipliers
export const HIGH_CONFIDENCE_MULTIPLIER = 2.0;
export const MED_CONFIDENCE_MULTIPLIER = 1.5;

// Feasibility thresholds
export const TTF_IMPOSSIBLE_MULTIPLIER = 1.5; // TTF > target × 1.5 = IMPOSSIBLE
export const TTF_AT_RISK_MULTIPLIER = 1.2; // TTF > target × 1.2 = AT_RISK
export const CAPACITY_AT_RISK_THRESHOLD = 0.3; // Gap > 30% of current = AT_RISK
export const TEAM_UTILIZATION_IMPOSSIBLE = 1.3; // >130% = IMPOSSIBLE
export const TEAM_UTILIZATION_AT_RISK = 1.1; // >110% = AT_RISK

// Accept rate thresholds
export const ACCEPT_RATE_DROP_IMPOSSIBLE = -0.5; // -50% = IMPOSSIBLE
export const ACCEPT_RATE_DROP_AT_RISK = -0.2; // -20% = AT_RISK

// Recruiter status thresholds
export const UTILIZATION_OVERLOADED = 1.1; // 110%
