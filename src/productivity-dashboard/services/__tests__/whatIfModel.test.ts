/**
 * Unit tests for whatIfModel.ts
 * Ensures deterministic, bounded, correct projections
 */

import {
  runWhatIfModel,
  createBaseline,
  WhatIfInputs,
  WhatIfBaseline,
  WHATIF_DEFAULT_INPUTS,
  WHATIF_INPUT_BOUNDS,
} from '../whatIfModel';

// ===== TEST FIXTURES =====

const FULL_BASELINE: WhatIfBaseline = {
  accept_rate: 0.83, // 83%
  expected_hires: 11.3,
  pipeline_gap: 15.7,
  time_to_offer_days: 15,
  open_reqs: 27,
  current_hm_latency_hours: 48,
  decay_rate_per_day: 0.01, // 1% per day
};

const PARTIAL_BASELINE: WhatIfBaseline = {
  accept_rate: 0.75,
  expected_hires: null,
  pipeline_gap: null,
  time_to_offer_days: 20,
  open_reqs: 10,
  current_hm_latency_hours: 24,
  decay_rate_per_day: 0.02,
};

const MINIMAL_BASELINE: WhatIfBaseline = {
  accept_rate: null,
  expected_hires: null,
  pipeline_gap: null,
  time_to_offer_days: null,
  open_reqs: 5,
  current_hm_latency_hours: null,
  decay_rate_per_day: null,
};

// ===== TEST SUITES =====

describe('whatIfModel', () => {
  describe('baseline returns expected values', () => {
    it('returns baseline values unchanged when all inputs are zero', () => {
      const result = runWhatIfModel(WHATIF_DEFAULT_INPUTS, FULL_BASELINE);

      // Baseline should match input
      expect(result.baseline).toEqual(FULL_BASELINE);

      // Projected should equal baseline when no intervention
      expect(result.projected.accept_rate).toBeCloseTo(FULL_BASELINE.accept_rate!, 2);
      expect(result.projected.expected_hires).toBeCloseTo(FULL_BASELINE.expected_hires!, 1);
      expect(result.projected.pipeline_gap).toBeCloseTo(FULL_BASELINE.pipeline_gap!, 1);
      expect(result.projected.time_to_offer_days).toBeCloseTo(FULL_BASELINE.time_to_offer_days!, 1);

      // Deltas should be zero or very close
      expect(result.deltas.accept_rate_delta).toBeCloseTo(0, 2);
      expect(result.deltas.expected_hires_delta).toBeCloseTo(0, 1);
      expect(result.deltas.pipeline_gap_delta).toBeCloseTo(0, 1);
      expect(result.deltas.time_to_offer_delta).toBeCloseTo(0, 1);
    });

    it('returns HIGH confidence with full baseline data', () => {
      const result = runWhatIfModel(WHATIF_DEFAULT_INPUTS, FULL_BASELINE);

      expect(result.confidence).toBe('HIGH');
      expect(result.confidence_reason).toContain('All baseline metrics available');
    });
  });

  describe('each lever changes only expected outputs', () => {
    it('offer_speed_days_faster only affects accept_rate and time_to_offer', () => {
      const inputs: WhatIfInputs = {
        offer_speed_days_faster: 5,
        hm_feedback_hours_saved: 0,
        pipeline_add_leads_per_req: 0,
      };
      const result = runWhatIfModel(inputs, FULL_BASELINE);

      // Accept rate should increase
      expect(result.deltas.accept_rate_delta).toBeGreaterThan(0);

      // Time to offer should decrease
      expect(result.deltas.time_to_offer_delta).toBeLessThan(0);

      // Expected hires and pipeline gap should NOT change
      expect(result.deltas.expected_hires_delta).toBe(0);
      expect(result.deltas.pipeline_gap_delta).toBe(0);
    });

    it('hm_feedback_hours_saved only affects accept_rate and time_to_offer', () => {
      const inputs: WhatIfInputs = {
        offer_speed_days_faster: 0,
        hm_feedback_hours_saved: 24,
        pipeline_add_leads_per_req: 0,
      };
      const result = runWhatIfModel(inputs, FULL_BASELINE);

      // Accept rate should increase
      expect(result.deltas.accept_rate_delta).toBeGreaterThan(0);

      // Time to offer should decrease
      expect(result.deltas.time_to_offer_delta).toBeLessThan(0);

      // Expected hires and pipeline gap should NOT change
      expect(result.deltas.expected_hires_delta).toBe(0);
      expect(result.deltas.pipeline_gap_delta).toBe(0);
    });

    it('pipeline_add_leads_per_req only affects expected_hires and pipeline_gap', () => {
      const inputs: WhatIfInputs = {
        offer_speed_days_faster: 0,
        hm_feedback_hours_saved: 0,
        pipeline_add_leads_per_req: 25,
      };
      const result = runWhatIfModel(inputs, FULL_BASELINE);

      // Expected hires should increase
      expect(result.deltas.expected_hires_delta).toBeGreaterThan(0);

      // Pipeline gap should decrease
      expect(result.deltas.pipeline_gap_delta).toBeLessThan(0);

      // Accept rate and time to offer should NOT change
      expect(result.deltas.accept_rate_delta).toBe(0);
      expect(result.deltas.time_to_offer_delta).toBe(0);
    });

    it('pipeline slider scales smoothly across its range', () => {
      // Test that different slider positions give different outputs
      const results = [10, 20, 30, 40, 50].map(leads => {
        const inputs: WhatIfInputs = {
          offer_speed_days_faster: 0,
          hm_feedback_hours_saved: 0,
          pipeline_add_leads_per_req: leads,
        };
        return runWhatIfModel(inputs, FULL_BASELINE);
      });

      // Each position should give a DIFFERENT expected_hires_delta
      const deltas = results.map(r => r.deltas.expected_hires_delta);

      // Verify all deltas are unique (no flat sections)
      const uniqueDeltas = new Set(deltas);
      expect(uniqueDeltas.size).toBe(deltas.length);

      // Verify deltas increase with slider position
      for (let i = 1; i < deltas.length; i++) {
        expect(deltas[i]).toBeGreaterThan(deltas[i - 1]!);
      }
    });
  });

  describe('bounds are enforced', () => {
    it('accept_rate stays in [0, 1] range', () => {
      // Very high intervention to try to push past bounds
      const inputs: WhatIfInputs = {
        offer_speed_days_faster: 14,
        hm_feedback_hours_saved: 72,
        pipeline_add_leads_per_req: 0,
      };

      // Start with already high accept rate
      const highAcceptBaseline: WhatIfBaseline = {
        ...FULL_BASELINE,
        accept_rate: 0.92, // 92%
      };

      const result = runWhatIfModel(inputs, highAcceptBaseline);

      // Should not exceed 1 (100%)
      expect(result.projected.accept_rate).toBeLessThanOrEqual(1);
      expect(result.projected.accept_rate).toBeGreaterThanOrEqual(0);
    });

    it('expected_hires cannot exceed open_reqs', () => {
      const inputs: WhatIfInputs = {
        offer_speed_days_faster: 0,
        hm_feedback_hours_saved: 0,
        pipeline_add_leads_per_req: 50,
      };

      // Baseline with expected hires close to open reqs
      const nearCapBaseline: WhatIfBaseline = {
        ...FULL_BASELINE,
        expected_hires: 25,
        open_reqs: 27,
      };

      const result = runWhatIfModel(inputs, nearCapBaseline);

      // Should not exceed open reqs
      expect(result.projected.expected_hires).toBeLessThanOrEqual(nearCapBaseline.open_reqs);
      expect(result.projected.expected_hires).toBeGreaterThanOrEqual(0);
    });

    it('pipeline_gap >= 0', () => {
      const inputs: WhatIfInputs = {
        offer_speed_days_faster: 0,
        hm_feedback_hours_saved: 0,
        pipeline_add_leads_per_req: 50,
      };

      // Baseline with small pipeline gap
      const smallGapBaseline: WhatIfBaseline = {
        ...FULL_BASELINE,
        pipeline_gap: 2,
      };

      const result = runWhatIfModel(inputs, smallGapBaseline);

      // Should not go negative
      expect(result.projected.pipeline_gap).toBeGreaterThanOrEqual(0);
    });

    it('time_to_offer_days >= 1', () => {
      const inputs: WhatIfInputs = {
        offer_speed_days_faster: 14,
        hm_feedback_hours_saved: 72,
        pipeline_add_leads_per_req: 0,
      };

      // Baseline with short time to offer
      const shortTimeBaseline: WhatIfBaseline = {
        ...FULL_BASELINE,
        time_to_offer_days: 5,
      };

      const result = runWhatIfModel(inputs, shortTimeBaseline);

      // Should not go below 1 day
      expect(result.projected.time_to_offer_days).toBeGreaterThanOrEqual(1);
    });

    it('input values are clamped to valid bounds', () => {
      // Out of bounds inputs
      const badInputs: WhatIfInputs = {
        offer_speed_days_faster: 100, // Max is 14
        hm_feedback_hours_saved: -10, // Min is 0
        pipeline_add_leads_per_req: 1000, // Max is 50
      };

      // Should not throw, should clamp
      const result = runWhatIfModel(badInputs, FULL_BASELINE);

      // Time to offer delta should be bounded by what's achievable
      // With 15 day baseline and max 14 day reduction, can reduce by at most 14 days
      expect(result.deltas.time_to_offer_delta).toBeGreaterThanOrEqual(-14);
    });
  });

  describe('missing data produces LOW confidence and null fields', () => {
    it('returns null projected fields when baseline is missing', () => {
      const result = runWhatIfModel(WHATIF_DEFAULT_INPUTS, MINIMAL_BASELINE);

      expect(result.projected.accept_rate).toBeNull();
      expect(result.projected.expected_hires).toBeNull();
      expect(result.projected.pipeline_gap).toBeNull();
      expect(result.projected.time_to_offer_days).toBeNull();
    });

    it('returns LOW confidence with minimal baseline', () => {
      const result = runWhatIfModel(WHATIF_DEFAULT_INPUTS, MINIMAL_BASELINE);

      expect(result.confidence).toBe('LOW');
      expect(result.confidence_reason).toContain('Insufficient');
    });

    it('returns MED confidence with partial baseline', () => {
      const result = runWhatIfModel(WHATIF_DEFAULT_INPUTS, PARTIAL_BASELINE);

      expect(result.confidence).toBe('MED');
    });

    it('provides reasons for unavailable fields', () => {
      const result = runWhatIfModel(WHATIF_DEFAULT_INPUTS, MINIMAL_BASELINE);

      expect(Object.keys(result.unavailable_reasons).length).toBeGreaterThan(0);
      expect(result.unavailable_reasons['accept_rate']).toBeDefined();
      expect(result.unavailable_reasons['expected_hires']).toBeDefined();
    });
  });

  describe('no absurd jumps', () => {
    it('expected_hires increases by at most 30% with max pipeline intervention', () => {
      const inputs: WhatIfInputs = {
        offer_speed_days_faster: 0,
        hm_feedback_hours_saved: 0,
        pipeline_add_leads_per_req: 50, // Max
      };

      const result = runWhatIfModel(inputs, FULL_BASELINE);

      // Delta should be at most 30% of baseline
      const maxDelta = FULL_BASELINE.expected_hires! * 0.30;
      expect(result.deltas.expected_hires_delta).toBeLessThanOrEqual(maxDelta + 0.1); // Small tolerance
    });

    it('accept_rate increases by at most 20% with max interventions', () => {
      const inputs: WhatIfInputs = {
        offer_speed_days_faster: 14,
        hm_feedback_hours_saved: 72,
        pipeline_add_leads_per_req: 50,
      };

      const result = runWhatIfModel(inputs, FULL_BASELINE);

      // Delta should be at most 20% (0.20)
      expect(result.deltas.accept_rate_delta).toBeLessThanOrEqual(0.20 + 0.01); // Small tolerance
    });
  });

  describe('deterministic outputs', () => {
    it('returns identical outputs for identical inputs', () => {
      const inputs: WhatIfInputs = {
        offer_speed_days_faster: 5,
        hm_feedback_hours_saved: 24,
        pipeline_add_leads_per_req: 25,
      };

      const result1 = runWhatIfModel(inputs, FULL_BASELINE);
      const result2 = runWhatIfModel(inputs, FULL_BASELINE);

      expect(result1.projected).toEqual(result2.projected);
      expect(result1.deltas).toEqual(result2.deltas);
      expect(result1.confidence).toEqual(result2.confidence);
    });

    it('multiple runs produce identical results', () => {
      const inputs: WhatIfInputs = {
        offer_speed_days_faster: 7,
        hm_feedback_hours_saved: 48,
        pipeline_add_leads_per_req: 30,
      };

      const results = Array.from({ length: 10 }, () =>
        runWhatIfModel(inputs, FULL_BASELINE)
      );

      // All results should be identical
      const first = results[0];
      results.forEach(result => {
        expect(result.projected).toEqual(first.projected);
        expect(result.deltas).toEqual(first.deltas);
      });
    });
  });

  describe('createBaseline helper', () => {
    it('maps context fields correctly', () => {
      const context = {
        currentAcceptRate: 0.8,
        currentExpectedHires: 10,
        currentPipelineGap: 5,
        currentTimeToOfferDays: 12,
        openReqsCount: 15,
        currentHMLatencyHours: 36,
        decayRatePerDay: 0.015,
      };

      const baseline = createBaseline(context);

      expect(baseline.accept_rate).toBe(0.8);
      expect(baseline.expected_hires).toBe(10);
      expect(baseline.pipeline_gap).toBe(5);
      expect(baseline.time_to_offer_days).toBe(12);
      expect(baseline.open_reqs).toBe(15);
      expect(baseline.current_hm_latency_hours).toBe(36);
      expect(baseline.decay_rate_per_day).toBe(0.015);
    });

    it('preserves null values', () => {
      const context = {
        currentAcceptRate: null,
        currentExpectedHires: null,
        currentPipelineGap: null,
        currentTimeToOfferDays: null,
        openReqsCount: 5,
        currentHMLatencyHours: null,
        decayRatePerDay: null,
      };

      const baseline = createBaseline(context);

      expect(baseline.accept_rate).toBeNull();
      expect(baseline.expected_hires).toBeNull();
      expect(baseline.pipeline_gap).toBeNull();
      expect(baseline.time_to_offer_days).toBeNull();
    });
  });
});
