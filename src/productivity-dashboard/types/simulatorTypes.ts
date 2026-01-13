// What-if Intervention Simulator Types
// For modeling the impact of process changes on velocity metrics

import { ActionOwnerType, ActionPriority } from './actionTypes';

// ===== SIMULATOR INPUTS =====

/**
 * Input levers for the What-if Simulator
 * All levers are "improvement" oriented: sliding right = more intervention = better outcomes
 */
export interface SimulatorInputs {
  /** Days to reduce time-to-offer by (default: 5) */
  offerSpeedReductionDays: number;
  /** Hours to reduce HM feedback latency by (default: 24) */
  hmLatencyReductionHours: number;
  /** Additional leads to add per open req (default: 10) */
  pipelineAddPerReq: number;
}

/**
 * Default values for simulator inputs
 */
export const SIMULATOR_DEFAULTS: SimulatorInputs = {
  offerSpeedReductionDays: 5,
  hmLatencyReductionHours: 24,
  pipelineAddPerReq: 10,
};

/**
 * Min/max bounds for simulator sliders
 * All sliders: left=0 (no change), right=max improvement
 */
export const SIMULATOR_BOUNDS = {
  offerSpeedReductionDays: { min: 0, max: 14, step: 1 },
  hmLatencyReductionHours: { min: 0, max: 72, step: 4 },
  pipelineAddPerReq: { min: 0, max: 50, step: 5 },
} as const;

// ===== SIMULATOR OUTPUTS =====

/**
 * A metric delta with availability flag
 */
export interface MetricDelta {
  /** Current baseline value */
  baseline: number | null;
  /** Projected value after intervention */
  projected: number | null;
  /** Delta (projected - baseline) */
  delta: number | null;
  /** Whether this metric is available (has enough data) */
  available: boolean;
  /** Reason if not available */
  unavailableReason?: string;
  /** Unit for display (e.g., '%', 'days', 'count') */
  unit: string;
  /** Direction: positive delta is good or bad */
  positiveIsGood: boolean;
}

/**
 * Output deltas from the simulator
 */
export interface SimulatorOutputs {
  /** Accept rate change (e.g., +5%) */
  acceptRateDelta: MetricDelta;
  /** Expected hires change (e.g., +3 hires) */
  expectedHiresDelta: MetricDelta;
  /** Pipeline gap change (e.g., -2 gap) */
  pipelineGapDelta: MetricDelta;
  /** Time to offer change (e.g., -4 days) */
  timeToOfferDelta: MetricDelta;
  /** Overall confidence in the projections */
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'INSUFFICIENT';
  /** Explanation of confidence level */
  confidenceReason: string;
}

// ===== ACTION PLAN =====

/**
 * An action generated from the simulator
 */
export interface SimulatorAction {
  /** Unique action identifier */
  id: string;
  /** Action title */
  title: string;
  /** Detailed description */
  description: string;
  /** Owner type */
  ownerType: ActionOwnerType;
  /** Owner name (or role if generic) */
  ownerName: string;
  /** Priority */
  priority: ActionPriority;
  /** Days until due */
  dueInDays: number;
  /** Which lever this action addresses */
  lever: 'offerSpeed' | 'hmLatency' | 'pipeline';
  /** Expected impact description */
  expectedImpact: string;
}

/**
 * Generated action plan from the simulator
 */
export interface SimulatorActionPlan {
  /** List of actions (3-6 typically) */
  actions: SimulatorAction[];
  /** When the plan was generated */
  generatedAt: Date;
  /** Input values that generated this plan */
  inputs: SimulatorInputs;
  /** Summary of expected outcomes */
  expectedOutcomes: string[];
}

// ===== AI NARRATION =====

/**
 * AI-generated narrative for the simulator results
 */
export interface SimulatorNarrative {
  /** 5-bullet summary of the intervention analysis */
  bullets: SimulatorNarrativeBullet[];
  /** When the narrative was generated */
  generatedAt: Date;
  /** Model used for generation */
  model: string;
}

/**
 * A single bullet point in the narrative
 */
export interface SimulatorNarrativeBullet {
  /** The narrative text */
  text: string;
  /** Citation/evidence for this bullet */
  citation: string;
  /** Metric key this bullet references (if any) */
  metricKey?: keyof SimulatorOutputs;
}

// ===== CONTEXT FOR SIMULATOR =====

/**
 * Context data needed by the simulator
 */
export interface SimulatorContext {
  /** Current offer-to-accept rate */
  currentAcceptRate: number | null;
  /** Current HM feedback latency (hours) */
  currentHMLatencyHours: number | null;
  /** Current average pipeline depth */
  currentPipelineDepth: number | null;
  /** Current time to offer (days) */
  currentTimeToOfferDays: number | null;
  /** Expected hires (from forecast) */
  currentExpectedHires: number | null;
  /** Current pipeline gap */
  currentPipelineGap: number | null;
  /** Open reqs count */
  openReqsCount: number;
  /** Decay rate per day (from velocity analysis) */
  decayRatePerDay: number | null;
  /** Decay start day */
  decayStartDay: number | null;
  /** Stage conversion rates */
  stageConversionRates: Record<string, number>;
  /** Sample sizes for confidence calculation */
  sampleSizes: {
    offers: number;
    hires: number;
    reqs: number;
    candidates: number;
  };
}

// ===== LEVER METADATA =====

/**
 * Metadata for a simulator lever
 */
export interface LeverMetadata {
  key: keyof SimulatorInputs;
  label: string;
  description: string;
  unit: string;
  impactDescription: string;
}

/**
 * Lever metadata definitions
 * All levers: sliding right = more intervention = better outcomes
 */
export const LEVER_METADATA: LeverMetadata[] = [
  {
    key: 'offerSpeedReductionDays',
    label: 'Offer Speed Improvement',
    description: 'Days to reduce time from interview to offer',
    unit: 'days faster',
    impactDescription: 'Faster offer decisions reduce candidate decay and improve accept rates',
  },
  {
    key: 'hmLatencyReductionHours',
    label: 'HM Feedback SLA',
    description: 'Hours to reduce HM feedback latency',
    unit: 'hours saved',
    impactDescription: 'Reducing HM delays speeds up the pipeline and reduces candidate drop-off',
  },
  {
    key: 'pipelineAddPerReq',
    label: 'Pipeline Add',
    description: 'Additional leads to add per open requisition',
    unit: 'leads/req',
    impactDescription: 'More pipeline depth improves conversion odds and reduces pipeline gap',
  },
];

// ===== MINIMUM THRESHOLDS =====

/**
 * Minimum sample sizes for reliable simulator outputs
 */
export const SIMULATOR_MIN_SAMPLES = {
  /** Min offers for accept rate modeling */
  offersForAcceptRate: 10,
  /** Min hires for TTF modeling */
  hiresForTTF: 5,
  /** Min reqs for pipeline analysis */
  reqsForPipeline: 3,
  /** Min candidates for decay analysis */
  candidatesForDecay: 20,
} as const;
