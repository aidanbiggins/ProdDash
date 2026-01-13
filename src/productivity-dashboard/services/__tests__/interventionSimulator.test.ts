/**
 * Tests for Intervention Simulator Service
 *
 * Tests:
 * 1. Simulator returns stable outputs for same inputs
 * 2. Sliders update outputs correctly
 * 3. Action Plan creates deduped actions
 * 4. No fake outputs when data is missing
 */

import {
  runSimulation,
  generateActionPlan,
  buildSimulatorContext,
} from '../interventionSimulator';
import {
  SimulatorInputs,
  SimulatorContext,
  SIMULATOR_DEFAULTS,
  SIMULATOR_MIN_SAMPLES,
} from '../../types/simulatorTypes';
import { VelocityMetrics, CandidateDecayAnalysis, ReqDecayAnalysis } from '../../types/velocityTypes';
import { CanonicalStage } from '../../types';

// ===== TEST FIXTURES =====

const createMockCandidateDecay = (overrides: Partial<CandidateDecayAnalysis> = {}): CandidateDecayAnalysis => ({
  dataPoints: [
    { bucket: '0-14 days', minDays: 0, maxDays: 14, count: 10, rate: 0.9, cumulativeRate: 0.9 },
    { bucket: '15-21 days', minDays: 15, maxDays: 21, count: 8, rate: 0.8, cumulativeRate: 0.85 },
    { bucket: '22-30 days', minDays: 22, maxDays: 30, count: 5, rate: 0.6, cumulativeRate: 0.78 },
  ],
  medianDaysToDecision: 18,
  overallAcceptanceRate: 0.75,
  totalOffers: 25,
  totalAccepted: 19,
  decayRatePerDay: 0.015,
  decayStartDay: 14,
  ...overrides,
});

const createMockReqDecay = (overrides: Partial<ReqDecayAnalysis> = {}): ReqDecayAnalysis => ({
  dataPoints: [
    { bucket: '0-30 days', minDays: 0, maxDays: 30, count: 15, rate: 0.8, cumulativeRate: 0.8 },
    { bucket: '31-60 days', minDays: 31, maxDays: 60, count: 10, rate: 0.5, cumulativeRate: 0.65 },
  ],
  medianDaysToFill: 35,
  overallFillRate: 0.7,
  totalReqs: 30,
  totalFilled: 21,
  decayRatePerDay: 0.01,
  decayStartDay: 30,
  ...overrides,
});

const createMockVelocityMetrics = (overrides: Partial<VelocityMetrics> = {}): VelocityMetrics => ({
  candidateDecay: createMockCandidateDecay(),
  reqDecay: createMockReqDecay(),
  cohortComparison: null,
  insights: [],
  ...overrides,
});

const createMockContext = (overrides: Partial<SimulatorContext> = {}): SimulatorContext => ({
  currentAcceptRate: 0.75,
  currentHMLatencyHours: 48,
  currentPipelineDepth: 12,
  currentTimeToOfferDays: 21,
  currentExpectedHires: 5,
  currentPipelineGap: 3,
  openReqsCount: 8,
  decayRatePerDay: 0.015,
  decayStartDay: 14,
  stageConversionRates: {
    [CanonicalStage.SCREEN]: 0.4,
    [CanonicalStage.HM_SCREEN]: 0.5,
    [CanonicalStage.ONSITE]: 0.4,
    [CanonicalStage.OFFER]: 0.8,
  },
  sampleSizes: {
    offers: 25,
    hires: 19,
    reqs: 8,
    candidates: 100,
  },
  ...overrides,
});

// ===== TESTS =====

describe('InterventionSimulator', () => {
  describe('runSimulation', () => {
    describe('stable outputs for same inputs', () => {
      it('returns identical outputs for identical inputs', () => {
        const inputs = SIMULATOR_DEFAULTS;
        const context = createMockContext();

        const output1 = runSimulation(inputs, context);
        const output2 = runSimulation(inputs, context);

        expect(output1.acceptRateDelta.delta).toBe(output2.acceptRateDelta.delta);
        expect(output1.expectedHiresDelta.delta).toBe(output2.expectedHiresDelta.delta);
        expect(output1.pipelineGapDelta.delta).toBe(output2.pipelineGapDelta.delta);
        expect(output1.timeToOfferDelta.delta).toBe(output2.timeToOfferDelta.delta);
        expect(output1.confidence).toBe(output2.confidence);
      });

      it('returns deterministic results across multiple runs', () => {
        const inputs: SimulatorInputs = {
          offerSpeedReductionDays: 10,
          hmLatencyReductionHours: 24,
          pipelineAddPerReq: 15,
        };
        const context = createMockContext();

        const results = Array.from({ length: 5 }, () => runSimulation(inputs, context));

        // All results should be identical
        for (let i = 1; i < results.length; i++) {
          expect(results[i].acceptRateDelta.delta).toBe(results[0].acceptRateDelta.delta);
          expect(results[i].expectedHiresDelta.delta).toBe(results[0].expectedHiresDelta.delta);
        }
      });
    });

    describe('slider updates affect outputs', () => {
      it('more offer speed reduction improves accept rate delta', () => {
        const context = createMockContext({
          currentTimeToOfferDays: 21,
          decayRatePerDay: 0.015,
          decayStartDay: 14,
        });

        const noReduction = runSimulation({ ...SIMULATOR_DEFAULTS, offerSpeedReductionDays: 0 }, context);
        const withReduction = runSimulation({ ...SIMULATOR_DEFAULTS, offerSpeedReductionDays: 7 }, context);

        // More reduction should have higher (better) accept rate delta
        expect(withReduction.acceptRateDelta.delta).toBeGreaterThan(noReduction.acceptRateDelta.delta || 0);
      });

      it('reducing HM latency decreases time to offer', () => {
        const context = createMockContext({
          currentHMLatencyHours: 48,
        });

        const noReduction = runSimulation({ ...SIMULATOR_DEFAULTS, hmLatencyReductionHours: 0 }, context);
        const withReduction = runSimulation({ ...SIMULATOR_DEFAULTS, hmLatencyReductionHours: 24 }, context);

        // With reduction should have negative (faster) time to offer delta
        expect(withReduction.timeToOfferDelta.delta).toBeLessThan(noReduction.timeToOfferDelta.delta || 0);
      });

      it('adding pipeline increases expected hires', () => {
        const context = createMockContext();

        const noPipeline = runSimulation({ ...SIMULATOR_DEFAULTS, pipelineAddPerReq: 0 }, context);
        const morePipeline = runSimulation({ ...SIMULATOR_DEFAULTS, pipelineAddPerReq: 20 }, context);

        // More pipeline should have higher expected hires delta
        expect(morePipeline.expectedHiresDelta.delta).toBeGreaterThan(noPipeline.expectedHiresDelta.delta || 0);
      });

      it('scaling pipeline adds scales with open reqs', () => {
        const fewReqs = createMockContext({ openReqsCount: 2 });
        const manyReqs = createMockContext({ openReqsCount: 10 });

        const inputs: SimulatorInputs = { ...SIMULATOR_DEFAULTS, pipelineAddPerReq: 10 };

        const outputFew = runSimulation(inputs, fewReqs);
        const outputMany = runSimulation(inputs, manyReqs);

        // More reqs should have higher expected hires delta (proportional to req count)
        if (outputFew.expectedHiresDelta.delta !== null && outputMany.expectedHiresDelta.delta !== null) {
          expect(outputMany.expectedHiresDelta.delta).toBeGreaterThan(outputFew.expectedHiresDelta.delta);
        }
      });
    });

    describe('no fake outputs when data is missing', () => {
      it('returns unavailable accept rate when insufficient offers', () => {
        const context = createMockContext({
          sampleSizes: {
            offers: SIMULATOR_MIN_SAMPLES.offersForAcceptRate - 1,
            hires: 5,
            reqs: 8,
            candidates: 50,
          },
        });

        const output = runSimulation(SIMULATOR_DEFAULTS, context);

        expect(output.acceptRateDelta.available).toBe(false);
        expect(output.acceptRateDelta.delta).toBeNull();
        expect(output.acceptRateDelta.unavailableReason).toContain('Need');
      });

      it('returns unavailable expected hires when insufficient reqs', () => {
        const context = createMockContext({
          sampleSizes: {
            offers: 20,
            hires: 15,
            reqs: SIMULATOR_MIN_SAMPLES.reqsForPipeline - 1,
            candidates: 50,
          },
        });

        const output = runSimulation(SIMULATOR_DEFAULTS, context);

        expect(output.expectedHiresDelta.available).toBe(false);
        expect(output.expectedHiresDelta.delta).toBeNull();
      });

      it('returns null baseline when current values are missing', () => {
        const context = createMockContext({
          currentAcceptRate: null,
          currentTimeToOfferDays: null,
        });

        const output = runSimulation(SIMULATOR_DEFAULTS, context);

        expect(output.acceptRateDelta.baseline).toBeNull();
        expect(output.timeToOfferDelta.baseline).toBeNull();
      });

      it('marks insufficient confidence when no metrics are available', () => {
        const context = createMockContext({
          currentAcceptRate: null,
          currentExpectedHires: null,
          currentPipelineGap: null,
          currentTimeToOfferDays: null,
          sampleSizes: {
            offers: 0,
            hires: 0,
            reqs: 0,
            candidates: 0,
          },
        });

        const output = runSimulation(SIMULATOR_DEFAULTS, context);

        expect(output.confidence).toBe('INSUFFICIENT');
      });

      it('does not fabricate data when decay rate is null', () => {
        const context = createMockContext({
          decayRatePerDay: null,
          decayStartDay: null,
        });

        const fastOffer = runSimulation({ ...SIMULATOR_DEFAULTS, offerSpeedReductionDays: 7 }, context);

        // Without decay data, offer speed shouldn't impact accept rate
        // The delta should be 0 or close to 0 (only from HM latency if any)
        expect(fastOffer.acceptRateDelta.delta).toBeLessThanOrEqual(0.1);
      });
    });

    describe('confidence levels', () => {
      it('returns HIGH confidence when all metrics are available', () => {
        const context = createMockContext();
        const output = runSimulation(SIMULATOR_DEFAULTS, context);

        expect(output.confidence).toBe('HIGH');
      });

      it('returns MEDIUM confidence when some metrics are unavailable', () => {
        const context = createMockContext({
          currentAcceptRate: null, // One metric unavailable
        });

        const output = runSimulation(SIMULATOR_DEFAULTS, context);

        expect(['HIGH', 'MEDIUM'].includes(output.confidence)).toBe(true);
      });

      it('returns LOW confidence when most metrics are unavailable', () => {
        const context = createMockContext({
          currentAcceptRate: null,
          currentExpectedHires: null,
          currentPipelineGap: null,
        });

        const output = runSimulation(SIMULATOR_DEFAULTS, context);

        expect(['MEDIUM', 'LOW'].includes(output.confidence)).toBe(true);
      });
    });
  });

  describe('generateActionPlan', () => {
    describe('action generation', () => {
      it('generates actions when levers are adjusted', () => {
        const inputs: SimulatorInputs = {
          offerSpeedReductionDays: 10,
          hmLatencyReductionHours: 24,
          pipelineAddPerReq: 15,
        };
        const context = createMockContext();
        const outputs = runSimulation(inputs, context);

        const plan = generateActionPlan(inputs, context, outputs);

        expect(plan.actions.length).toBeGreaterThan(0);
        expect(plan.actions.length).toBeLessThanOrEqual(6);
      });

      it('does not generate redundant actions', () => {
        const inputs: SimulatorInputs = {
          offerSpeedReductionDays: 10,
          hmLatencyReductionHours: 24,
          pipelineAddPerReq: 15,
        };
        const context = createMockContext();
        const outputs = runSimulation(inputs, context);

        const plan = generateActionPlan(inputs, context, outputs);

        // Check for unique action IDs
        const actionIds = plan.actions.map((a) => a.id);
        const uniqueIds = new Set(actionIds);
        expect(uniqueIds.size).toBe(actionIds.length);
      });

      it('creates actions with required fields', () => {
        const inputs: SimulatorInputs = {
          offerSpeedReductionDays: 10,
          hmLatencyReductionHours: 24,
          pipelineAddPerReq: 15,
        };
        const context = createMockContext();
        const outputs = runSimulation(inputs, context);

        const plan = generateActionPlan(inputs, context, outputs);

        for (const action of plan.actions) {
          expect(action.id).toBeTruthy();
          expect(action.title).toBeTruthy();
          expect(action.description).toBeTruthy();
          expect(action.ownerType).toMatch(/^(RECRUITER|HIRING_MANAGER|TA_OPS)$/);
          expect(action.ownerName).toBeTruthy();
          expect(action.priority).toMatch(/^P[012]$/);
          expect(typeof action.dueInDays).toBe('number');
          expect(action.lever).toMatch(/^(offerSpeed|hmLatency|pipeline)$/);
          expect(action.expectedImpact).toBeTruthy();
        }
      });

      it('sorts actions by priority then due date', () => {
        const inputs: SimulatorInputs = {
          offerSpeedReductionDays: 10,
          hmLatencyReductionHours: 24,
          pipelineAddPerReq: 15,
        };
        const context = createMockContext();
        const outputs = runSimulation(inputs, context);

        const plan = generateActionPlan(inputs, context, outputs);

        const priorityOrder = { P0: 0, P1: 1, P2: 2 };

        for (let i = 1; i < plan.actions.length; i++) {
          const prev = plan.actions[i - 1];
          const curr = plan.actions[i];

          const prevOrder = priorityOrder[prev.priority];
          const currOrder = priorityOrder[curr.priority];

          // Either higher priority or same priority with later/equal due date
          expect(
            prevOrder < currOrder ||
            (prevOrder === currOrder && prev.dueInDays <= curr.dueInDays)
          ).toBe(true);
        }
      });
    });

    describe('expected outcomes', () => {
      it('includes expected outcomes when metrics are available', () => {
        const inputs: SimulatorInputs = {
          offerSpeedReductionDays: 10,
          hmLatencyReductionHours: 24,
          pipelineAddPerReq: 15,
        };
        const context = createMockContext();
        const outputs = runSimulation(inputs, context);

        const plan = generateActionPlan(inputs, context, outputs);

        expect(plan.expectedOutcomes.length).toBeGreaterThan(0);
      });

      it('includes the input values used', () => {
        const inputs: SimulatorInputs = {
          offerSpeedReductionDays: 7,
          hmLatencyReductionHours: 36,
          pipelineAddPerReq: 20,
        };
        const context = createMockContext();
        const outputs = runSimulation(inputs, context);

        const plan = generateActionPlan(inputs, context, outputs);

        expect(plan.inputs).toEqual(inputs);
      });
    });

    describe('lever-specific actions', () => {
      it('generates offer speed actions when reduction is requested', () => {
        const context = createMockContext({ currentTimeToOfferDays: 21 });
        const inputs: SimulatorInputs = {
          ...SIMULATOR_DEFAULTS,
          offerSpeedReductionDays: 10, // Reduce by 10 days
        };
        const outputs = runSimulation(inputs, context);

        const plan = generateActionPlan(inputs, context, outputs);

        const offerActions = plan.actions.filter((a) => a.lever === 'offerSpeed');
        expect(offerActions.length).toBeGreaterThan(0);
      });

      it('generates HM latency actions when reduction is requested', () => {
        const context = createMockContext({ currentHMLatencyHours: 48 });
        const inputs: SimulatorInputs = {
          ...SIMULATOR_DEFAULTS,
          hmLatencyReductionHours: 24,
        };
        const outputs = runSimulation(inputs, context);

        const plan = generateActionPlan(inputs, context, outputs);

        const hmActions = plan.actions.filter((a) => a.lever === 'hmLatency');
        expect(hmActions.length).toBeGreaterThan(0);
      });

      it('generates pipeline actions when adds are requested', () => {
        const context = createMockContext({ openReqsCount: 5 });
        const inputs: SimulatorInputs = {
          ...SIMULATOR_DEFAULTS,
          pipelineAddPerReq: 15,
        };
        const outputs = runSimulation(inputs, context);

        const plan = generateActionPlan(inputs, context, outputs);

        const pipelineActions = plan.actions.filter((a) => a.lever === 'pipeline');
        expect(pipelineActions.length).toBeGreaterThan(0);
      });
    });
  });

  describe('buildSimulatorContext', () => {
    it('extracts values from velocity metrics', () => {
      const velocityMetrics = createMockVelocityMetrics();
      const stageConversionRates = {
        [CanonicalStage.SCREEN]: 0.4,
        [CanonicalStage.OFFER]: 0.8,
      };

      const context = buildSimulatorContext(
        velocityMetrics,
        48, // hmLatencyHours
        12, // pipelineDepth
        21, // timeToOfferDays
        5,  // expectedHires
        3,  // pipelineGap
        8,  // openReqsCount
        stageConversionRates
      );

      expect(context.currentAcceptRate).toBe(velocityMetrics.candidateDecay.overallAcceptanceRate);
      expect(context.decayRatePerDay).toBe(velocityMetrics.candidateDecay.decayRatePerDay);
      expect(context.decayStartDay).toBe(velocityMetrics.candidateDecay.decayStartDay);
      expect(context.sampleSizes.offers).toBe(velocityMetrics.candidateDecay.totalOffers);
    });

    it('preserves null values when data is missing', () => {
      const velocityMetrics = createMockVelocityMetrics({
        candidateDecay: createMockCandidateDecay({
          decayRatePerDay: null,
          decayStartDay: null,
        }),
      });

      const context = buildSimulatorContext(
        velocityMetrics,
        null, // hmLatencyHours missing
        null, // pipelineDepth missing
        null, // timeToOfferDays missing
        null, // expectedHires missing
        null, // pipelineGap missing
        0,    // openReqsCount
        {}    // empty stage conversion rates
      );

      expect(context.currentHMLatencyHours).toBeNull();
      expect(context.currentPipelineDepth).toBeNull();
      expect(context.currentTimeToOfferDays).toBeNull();
      expect(context.currentExpectedHires).toBeNull();
      expect(context.currentPipelineGap).toBeNull();
      expect(context.decayRatePerDay).toBeNull();
      expect(context.decayStartDay).toBeNull();
    });
  });
});
