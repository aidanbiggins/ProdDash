// Intervention Simulator Service
// Deterministic model for projecting the impact of process interventions

import {
  SimulatorInputs,
  SimulatorOutputs,
  SimulatorContext,
  SimulatorAction,
  SimulatorActionPlan,
  MetricDelta,
  SIMULATOR_DEFAULTS,
  SIMULATOR_MIN_SAMPLES,
} from '../types/simulatorTypes';
import { ActionPriority } from '../types/actionTypes';
import { VelocityMetrics, CandidateDecayAnalysis } from '../types/velocityTypes';
import { CanonicalStage } from '../types';

// ===== CONTEXT BUILDING =====

/**
 * Build simulator context from existing metrics and data
 */
export function buildSimulatorContext(
  velocityMetrics: VelocityMetrics,
  hmLatencyHours: number | null,
  pipelineDepth: number | null,
  timeToOfferDays: number | null,
  expectedHires: number | null,
  pipelineGap: number | null,
  openReqsCount: number,
  stageConversionRates: Record<string, number>
): SimulatorContext {
  const { candidateDecay } = velocityMetrics;

  return {
    currentAcceptRate: candidateDecay.overallAcceptanceRate,
    currentHMLatencyHours: hmLatencyHours,
    currentPipelineDepth: pipelineDepth,
    currentTimeToOfferDays: timeToOfferDays,
    currentExpectedHires: expectedHires,
    currentPipelineGap: pipelineGap,
    openReqsCount,
    decayRatePerDay: candidateDecay.decayRatePerDay,
    decayStartDay: candidateDecay.decayStartDay,
    stageConversionRates,
    sampleSizes: {
      offers: candidateDecay.totalOffers,
      hires: candidateDecay.totalAccepted,
      reqs: openReqsCount,
      candidates: 0, // Will be populated by caller if needed
    },
  };
}

// ===== IMPACT CALCULATIONS =====

/**
 * Calculate the impact of faster offer speed on acceptance rate
 *
 * Model: Accept rate improves by avoiding decay. Each day earlier = decay_rate_per_day * days saved
 * Formula: new_rate = current_rate + (days_saved * decay_rate_per_day)
 * Capped at realistic maximum of 95%
 */
function calculateOfferSpeedImpact(
  inputs: SimulatorInputs,
  context: SimulatorContext
): { acceptRateDelta: number; timeToOfferDelta: number } {
  const { offerSpeedReductionDays } = inputs;
  const {
    currentAcceptRate,
    currentTimeToOfferDays,
    decayRatePerDay,
    decayStartDay,
  } = context;

  // No impact if no reduction requested or missing data
  if (
    offerSpeedReductionDays === 0 ||
    currentAcceptRate === null ||
    currentTimeToOfferDays === null ||
    decayRatePerDay === null ||
    decayStartDay === null
  ) {
    return { acceptRateDelta: 0, timeToOfferDelta: 0 };
  }

  // Can't reduce more than current time to offer
  const daysSaved = Math.min(offerSpeedReductionDays, currentTimeToOfferDays - 1);

  // Only count days saved that are past the decay start
  const newTimeToOffer = currentTimeToOfferDays - daysSaved;
  const effectiveDaysSaved = Math.max(
    0,
    Math.min(daysSaved, currentTimeToOfferDays - decayStartDay)
  );

  // Calculate accept rate improvement
  const acceptRateImprovement = effectiveDaysSaved * decayRatePerDay;

  // Cap at realistic maximum (95% - current rate)
  const maxImprovement = 0.95 - currentAcceptRate;
  const actualImprovement = Math.min(acceptRateImprovement, maxImprovement);

  return {
    acceptRateDelta: Math.max(0, actualImprovement),
    timeToOfferDelta: -daysSaved,
  };
}

/**
 * Calculate the impact of reducing HM feedback latency
 *
 * Model: Reducing HM latency speeds up pipeline and reduces candidate decay
 * Formula: Each hour saved converts to days saved in TTF
 * Impact on accept rate: faster pipeline = less decay = better acceptance
 */
function calculateHMLatencyImpact(
  inputs: SimulatorInputs,
  context: SimulatorContext
): { acceptRateDelta: number; timeToOfferDelta: number } {
  const { hmLatencyReductionHours } = inputs;
  const {
    currentHMLatencyHours,
    currentTimeToOfferDays,
    decayRatePerDay,
  } = context;

  // No impact if we don't have HM latency data
  if (
    currentHMLatencyHours === null ||
    currentTimeToOfferDays === null ||
    hmLatencyReductionHours === 0
  ) {
    return { acceptRateDelta: 0, timeToOfferDelta: 0 };
  }

  // Can't reduce more than current latency
  const effectiveReduction = Math.min(
    hmLatencyReductionHours,
    currentHMLatencyHours
  );

  // Convert hours to days (typically 2-3 HM touchpoints per hire)
  const hmTouchpoints = 2.5;
  const daysSavedFromHMLatency = (effectiveReduction / 24) * hmTouchpoints;

  // Calculate accept rate impact (if we have decay data)
  let acceptRateDelta = 0;
  if (decayRatePerDay !== null) {
    acceptRateDelta = daysSavedFromHMLatency * decayRatePerDay;
    // Cap at 10% improvement from HM latency alone
    acceptRateDelta = Math.min(acceptRateDelta, 0.1);
  }

  return {
    acceptRateDelta,
    timeToOfferDelta: -daysSavedFromHMLatency,
  };
}

/**
 * Calculate the impact of adding pipeline
 *
 * Model: More pipeline = more conversion opportunities = more expected hires
 * Uses a CONSERVATIVE model - adding top-of-funnel leads has limited impact
 *
 * Key assumptions:
 * - New leads are raw/unqualified - much lower conversion than existing pipeline
 * - Strong diminishing returns as pipeline depth increases
 * - Maximum impact capped at realistic levels (~25% increase max)
 * - Most value comes from process improvements, not just more leads
 */
function calculatePipelineImpact(
  inputs: SimulatorInputs,
  context: SimulatorContext
): { expectedHiresDelta: number; pipelineGapDelta: number } {
  const { pipelineAddPerReq } = inputs;
  const {
    openReqsCount,
    stageConversionRates,
    currentPipelineGap,
    currentExpectedHires,
    currentPipelineDepth,
  } = context;

  if (pipelineAddPerReq === 0 || openReqsCount === 0) {
    return { expectedHiresDelta: 0, pipelineGapDelta: 0 };
  }

  // Calculate expected conversion rate through funnel (for NEW raw leads)
  // New leads convert at lower rates than existing pipeline
  const screenRate = stageConversionRates[CanonicalStage.SCREEN] || 0.4;
  const hmScreenRate = stageConversionRates[CanonicalStage.HM_SCREEN] || 0.5;
  const onsiteRate = stageConversionRates[CanonicalStage.ONSITE] || 0.4;
  const offerRate = stageConversionRates[CanonicalStage.OFFER] || 0.8;

  // Raw leads convert at ~50% of normal pipeline rate (they're unqualified)
  const rawLeadDiscount = 0.5;
  const overallConversionRate = screenRate * hmScreenRate * onsiteRate * offerRate * rawLeadDiscount;

  // Strong diminishing returns - more pipeline means less marginal value
  const currentDepth = currentPipelineDepth ?? 10;
  const diminishingFactor = Math.max(0.2, 1 - (currentDepth / 30)); // Drops faster

  // Effective conversion for new leads (typically 1-3%)
  const effectiveConversionRate = overallConversionRate * diminishingFactor;

  // Calculate delta per req - cap at 0.1 hires per req (not 0.5)
  // Adding pipeline shouldn't add more than ~10% of a hire per req
  const hiresPerReqFromNewLeads = pipelineAddPerReq * effectiveConversionRate;
  const cappedHiresPerReq = Math.min(hiresPerReqFromNewLeads, 0.1);

  let expectedHiresDelta = cappedHiresPerReq * openReqsCount;

  // Cap total expected hires delta at ~25% of current expected
  // Adding raw pipeline alone can't dramatically change expected hires
  const maxDelta = currentExpectedHires !== null
    ? currentExpectedHires * 0.25  // Max 25% increase
    : openReqsCount * 0.1;         // Or 0.1 per req if no baseline
  expectedHiresDelta = Math.min(expectedHiresDelta, maxDelta);

  // Pipeline gap reduction - proportional but conservative
  // Adding pipeline closes gap but not dramatically
  let pipelineGapDelta = 0;
  if (currentPipelineGap !== null && currentPipelineGap > 0) {
    const maxGapReduction = currentPipelineGap * 0.15; // Max 15% gap closure
    pipelineGapDelta = -Math.min(expectedHiresDelta, maxGapReduction);
  }

  return {
    expectedHiresDelta: Math.round(expectedHiresDelta * 10) / 10,
    pipelineGapDelta: Math.round(pipelineGapDelta * 10) / 10,
  };
}

// ===== MAIN SIMULATION =====

/**
 * Run the intervention simulator with given inputs
 * Returns deterministic outputs based on historical data
 */
export function runSimulation(
  inputs: SimulatorInputs,
  context: SimulatorContext
): SimulatorOutputs {
  const { sampleSizes } = context;

  // Check data sufficiency
  const hasEnoughOffers = sampleSizes.offers >= SIMULATOR_MIN_SAMPLES.offersForAcceptRate;
  const hasEnoughHires = sampleSizes.hires >= SIMULATOR_MIN_SAMPLES.hiresForTTF;
  const hasEnoughReqs = sampleSizes.reqs >= SIMULATOR_MIN_SAMPLES.reqsForPipeline;

  // Calculate individual lever impacts
  const offerSpeedImpact = calculateOfferSpeedImpact(inputs, context);
  const hmLatencyImpact = calculateHMLatencyImpact(inputs, context);
  const pipelineImpact = calculatePipelineImpact(inputs, context);

  // Combine accept rate impacts (additive, but capped)
  const combinedAcceptRateDelta =
    offerSpeedImpact.acceptRateDelta + hmLatencyImpact.acceptRateDelta;
  const cappedAcceptRateDelta = Math.min(combinedAcceptRateDelta, 0.2); // Max 20% improvement

  // Combine time to offer impacts
  const combinedTimeToOfferDelta =
    offerSpeedImpact.timeToOfferDelta + hmLatencyImpact.timeToOfferDelta;

  // Build output metrics
  const acceptRateDelta: MetricDelta = {
    baseline: context.currentAcceptRate,
    projected:
      context.currentAcceptRate !== null
        ? Math.min(0.95, context.currentAcceptRate + cappedAcceptRateDelta)
        : null,
    delta: hasEnoughOffers ? cappedAcceptRateDelta : null,
    available: hasEnoughOffers && context.currentAcceptRate !== null,
    unavailableReason: !hasEnoughOffers
      ? `Need ${SIMULATOR_MIN_SAMPLES.offersForAcceptRate} offers (have ${sampleSizes.offers})`
      : context.currentAcceptRate === null
        ? 'No baseline accept rate available'
        : undefined,
    unit: '%',
    positiveIsGood: true,
  };

  // Expected hires delta considers both pipeline addition and accept rate improvement
  const acceptRateBoostToHires =
    context.currentExpectedHires !== null && cappedAcceptRateDelta > 0
      ? context.currentExpectedHires * cappedAcceptRateDelta
      : 0;
  const totalExpectedHiresDelta =
    pipelineImpact.expectedHiresDelta + acceptRateBoostToHires;

  const expectedHiresDelta: MetricDelta = {
    baseline: context.currentExpectedHires,
    projected:
      context.currentExpectedHires !== null
        ? context.currentExpectedHires + totalExpectedHiresDelta
        : null,
    delta: hasEnoughReqs ? totalExpectedHiresDelta : null,
    available: hasEnoughReqs && context.currentExpectedHires !== null,
    unavailableReason: !hasEnoughReqs
      ? `Need ${SIMULATOR_MIN_SAMPLES.reqsForPipeline} open reqs (have ${sampleSizes.reqs})`
      : context.currentExpectedHires === null
        ? 'No baseline expected hires available'
        : undefined,
    unit: 'hires',
    positiveIsGood: true,
  };

  const pipelineGapDelta: MetricDelta = {
    baseline: context.currentPipelineGap,
    projected:
      context.currentPipelineGap !== null
        ? context.currentPipelineGap + pipelineImpact.pipelineGapDelta
        : null,
    delta: hasEnoughReqs ? pipelineImpact.pipelineGapDelta : null,
    available: hasEnoughReqs && context.currentPipelineGap !== null,
    unavailableReason: !hasEnoughReqs
      ? `Need ${SIMULATOR_MIN_SAMPLES.reqsForPipeline} open reqs (have ${sampleSizes.reqs})`
      : context.currentPipelineGap === null
        ? 'No baseline pipeline gap available'
        : undefined,
    unit: 'gap',
    positiveIsGood: false, // Negative delta is good (reducing gap)
  };

  const timeToOfferDelta: MetricDelta = {
    baseline: context.currentTimeToOfferDays,
    projected:
      context.currentTimeToOfferDays !== null
        ? Math.max(1, context.currentTimeToOfferDays + combinedTimeToOfferDelta)
        : null,
    delta: hasEnoughOffers ? combinedTimeToOfferDelta : null,
    available: hasEnoughOffers && context.currentTimeToOfferDays !== null,
    unavailableReason: !hasEnoughOffers
      ? `Need ${SIMULATOR_MIN_SAMPLES.offersForAcceptRate} offers (have ${sampleSizes.offers})`
      : context.currentTimeToOfferDays === null
        ? 'No baseline time to offer available'
        : undefined,
    unit: 'days',
    positiveIsGood: false, // Negative delta is good (faster)
  };

  // Calculate overall confidence
  const availableMetrics = [
    acceptRateDelta,
    expectedHiresDelta,
    pipelineGapDelta,
    timeToOfferDelta,
  ].filter((m) => m.available).length;

  let confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'INSUFFICIENT';
  let confidenceReason: string;

  if (availableMetrics === 0) {
    confidence = 'INSUFFICIENT';
    confidenceReason = 'Not enough data to make projections';
  } else if (availableMetrics <= 1) {
    confidence = 'LOW';
    confidenceReason = 'Limited data available for projections';
  } else if (availableMetrics <= 2) {
    confidence = 'MEDIUM';
    confidenceReason = 'Some metrics may be less reliable';
  } else {
    confidence = 'HIGH';
    confidenceReason = 'Sufficient historical data for reliable projections';
  }

  return {
    acceptRateDelta,
    expectedHiresDelta,
    pipelineGapDelta,
    timeToOfferDelta,
    confidence,
    confidenceReason,
  };
}

// ===== ACTION PLAN GENERATION =====

/**
 * Generate action plan based on simulator inputs
 * Creates 3-6 specific, actionable items with owners and due dates
 */
export function generateActionPlan(
  inputs: SimulatorInputs,
  context: SimulatorContext,
  outputs: SimulatorOutputs
): SimulatorActionPlan {
  const actions: SimulatorAction[] = [];
  const now = new Date();

  // Generate unique action ID
  const generateId = (prefix: string) =>
    `${prefix}-${now.getTime()}-${Math.random().toString(36).substr(2, 9)}`;

  // Offer Speed Actions
  if (inputs.offerSpeedReductionDays > 0 && context.currentTimeToOfferDays !== null) {
    const targetDays = Math.max(1, context.currentTimeToOfferDays - inputs.offerSpeedReductionDays);

    // Action 1: Set offer timeline SLA
    actions.push({
      id: generateId('offer-sla'),
      title: `Reduce offer timeline to ${targetDays} days`,
      description: `Compress time from interview to offer by ${inputs.offerSpeedReductionDays} days through streamlined approvals and faster scheduling.`,
      ownerType: 'TA_OPS',
      ownerName: 'TA Operations',
      priority: 'P1',
      dueInDays: 7,
      lever: 'offerSpeed',
      expectedImpact: outputs.acceptRateDelta.available
        ? `+${Math.round((outputs.acceptRateDelta.delta || 0) * 100)}% accept rate`
        : 'Improved offer acceptance',
    });

    // Action 2: Streamline approval process
    if (targetDays <= 10) {
      actions.push({
        id: generateId('approval'),
        title: 'Streamline offer approval chain',
        description:
          'Review and reduce approval steps. Consider pre-approved comp bands for standard roles.',
        ownerType: 'TA_OPS',
        ownerName: 'TA Operations',
        priority: 'P2',
        dueInDays: 14,
        lever: 'offerSpeed',
        expectedImpact: '1-2 days off approval cycle',
      });
    }
  }

  // HM Latency Actions
  if (inputs.hmLatencyReductionHours > 0 && context.currentHMLatencyHours !== null) {
    const targetLatency = Math.max(
      24,
      context.currentHMLatencyHours - inputs.hmLatencyReductionHours
    );

    // Action 3: HM SLA communication
    actions.push({
      id: generateId('hm-sla'),
      title: `Establish ${targetLatency}hr HM feedback SLA`,
      description: `Communicate new feedback SLA to all hiring managers. Set up automated reminders at 50% and 80% of SLA.`,
      ownerType: 'RECRUITER',
      ownerName: 'Recruiting Team',
      priority: 'P1',
      dueInDays: 5,
      lever: 'hmLatency',
      expectedImpact: outputs.timeToOfferDelta.available
        ? `${Math.abs(Math.round(outputs.timeToOfferDelta.delta || 0))} days faster`
        : 'Faster pipeline velocity',
    });

    // Action 4: Schedule standing HM syncs
    if (inputs.hmLatencyReductionHours >= 24) {
      actions.push({
        id: generateId('hm-sync'),
        title: 'Schedule standing HM calibration syncs',
        description:
          'Set up weekly 15-min check-ins with each active HM to review candidate pipeline and ensure timely feedback.',
        ownerType: 'RECRUITER',
        ownerName: 'Recruiting Team',
        priority: 'P2',
        dueInDays: 7,
        lever: 'hmLatency',
        expectedImpact: 'Proactive blockers removal',
      });
    }
  }

  // Pipeline Actions
  if (inputs.pipelineAddPerReq > 0) {
    const totalLeads = inputs.pipelineAddPerReq * context.openReqsCount;

    // Action 5: Source additional candidates
    actions.push({
      id: generateId('source'),
      title: `Source ${inputs.pipelineAddPerReq} additional candidates per req`,
      description: `Add ${totalLeads} total candidates across ${context.openReqsCount} open reqs. Prioritize referrals and warm outreach.`,
      ownerType: 'RECRUITER',
      ownerName: 'Recruiting Team',
      priority: 'P0',
      dueInDays: 14,
      lever: 'pipeline',
      expectedImpact: outputs.expectedHiresDelta.available
        ? `+${(outputs.expectedHiresDelta.delta || 0).toFixed(1)} expected hires`
        : 'Increased pipeline depth',
    });

    // Action 6: Referral push
    if (inputs.pipelineAddPerReq >= 10) {
      actions.push({
        id: generateId('referral'),
        title: 'Launch referral campaign',
        description:
          'Send targeted referral request to employees in relevant departments. Consider referral bonus boost for hard-to-fill roles.',
        ownerType: 'TA_OPS',
        ownerName: 'TA Operations',
        priority: 'P1',
        dueInDays: 7,
        lever: 'pipeline',
        expectedImpact: 'Higher quality candidates, faster close rates',
      });
    }
  }

  // Sort by priority, then by due date
  const priorityOrder: Record<ActionPriority, number> = { P0: 0, P1: 1, P2: 2 };
  actions.sort((a, b) => {
    const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (priorityDiff !== 0) return priorityDiff;
    return a.dueInDays - b.dueInDays;
  });

  // Limit to 6 actions max
  const limitedActions = actions.slice(0, 6);

  // Generate expected outcomes
  const expectedOutcomes: string[] = [];
  if (outputs.acceptRateDelta.available && outputs.acceptRateDelta.delta) {
    expectedOutcomes.push(
      `Accept rate: ${Math.round((outputs.acceptRateDelta.baseline || 0) * 100)}% → ${Math.round((outputs.acceptRateDelta.projected || 0) * 100)}%`
    );
  }
  if (outputs.expectedHiresDelta.available && outputs.expectedHiresDelta.delta) {
    expectedOutcomes.push(
      `Expected hires: ${outputs.expectedHiresDelta.baseline?.toFixed(1)} → ${outputs.expectedHiresDelta.projected?.toFixed(1)}`
    );
  }
  if (outputs.timeToOfferDelta.available && outputs.timeToOfferDelta.delta) {
    expectedOutcomes.push(
      `Time to offer: ${outputs.timeToOfferDelta.baseline?.toFixed(0)}d → ${outputs.timeToOfferDelta.projected?.toFixed(0)}d`
    );
  }

  return {
    actions: limitedActions,
    generatedAt: now,
    inputs,
    expectedOutcomes,
  };
}

// ===== AI NARRATION PROMPT =====

/**
 * Generate prompt for AI narration of simulator results
 * The actual AI call is handled by the component using the user's API key
 */
export function generateNarrationPrompt(
  inputs: SimulatorInputs,
  context: SimulatorContext,
  outputs: SimulatorOutputs
): string {
  const sections: string[] = [];

  sections.push('## Intervention Simulator Analysis');
  sections.push('');
  sections.push('### Current State');

  if (context.currentAcceptRate !== null) {
    sections.push(`- Accept Rate: ${Math.round(context.currentAcceptRate * 100)}%`);
  }
  if (context.currentTimeToOfferDays !== null) {
    sections.push(`- Time to Offer: ${context.currentTimeToOfferDays} days`);
  }
  if (context.currentHMLatencyHours !== null) {
    sections.push(`- HM Feedback Latency: ${Math.round(context.currentHMLatencyHours)} hours`);
  }
  if (context.currentPipelineGap !== null) {
    sections.push(`- Pipeline Gap: ${context.currentPipelineGap}`);
  }

  sections.push('');
  sections.push('### Proposed Interventions');
  sections.push(`- Offer Speed Improvement: ${inputs.offerSpeedReductionDays} days faster`);
  sections.push(`- HM Latency Reduction: ${inputs.hmLatencyReductionHours} hours`);
  sections.push(`- Pipeline Add per Req: ${inputs.pipelineAddPerReq} leads`);

  sections.push('');
  sections.push('### Projected Outcomes');

  if (outputs.acceptRateDelta.available) {
    sections.push(
      `- Accept Rate: ${Math.round((outputs.acceptRateDelta.baseline || 0) * 100)}% → ${Math.round((outputs.acceptRateDelta.projected || 0) * 100)}% (+${Math.round((outputs.acceptRateDelta.delta || 0) * 100)}%)`
    );
  }
  if (outputs.expectedHiresDelta.available) {
    sections.push(
      `- Expected Hires: ${outputs.expectedHiresDelta.baseline?.toFixed(1)} → ${outputs.expectedHiresDelta.projected?.toFixed(1)} (+${(outputs.expectedHiresDelta.delta || 0).toFixed(1)})`
    );
  }
  if (outputs.timeToOfferDelta.available) {
    sections.push(
      `- Time to Offer: ${outputs.timeToOfferDelta.baseline}d → ${outputs.timeToOfferDelta.projected?.toFixed(0)}d (${outputs.timeToOfferDelta.delta?.toFixed(0)}d)`
    );
  }
  if (outputs.pipelineGapDelta.available) {
    sections.push(
      `- Pipeline Gap: ${outputs.pipelineGapDelta.baseline} → ${outputs.pipelineGapDelta.projected} (${outputs.pipelineGapDelta.delta})`
    );
  }

  sections.push('');
  sections.push(`Confidence: ${outputs.confidence} - ${outputs.confidenceReason}`);

  sections.push('');
  sections.push('---');
  sections.push('');
  sections.push(
    'Please provide a 5-bullet executive summary of this intervention analysis. Each bullet should:'
  );
  sections.push('1. Be concise (one sentence)');
  sections.push('2. Include a specific citation to the data above');
  sections.push('3. Focus on actionable insights');
  sections.push('4. Avoid speculation - only reference the data provided');
  sections.push('');
  sections.push('Format each bullet as: "• [Insight] (Citation: [specific metric/value])"');

  return sections.join('\n');
}
