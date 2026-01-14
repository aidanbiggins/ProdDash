// Capacity Fit Engine Unit Tests
// Tests for WorkloadScore, Demand, SustainableCapacity, Shrinkage, and FitScore

import {
  calculateWorkloadScore,
  calculateDemand,
  calculateRemainingWork,
  calculateAgingMultiplier,
  calculateBaseDifficulty
} from '../workloadScoring';
import { calculateSustainableCapacity, calculateWeeklyWorkloads } from '../sustainableCapacity';
import { applyShrinkage, calculateFitScore } from '../fitScoring';
import { Requisition, Candidate, CanonicalStage } from '../../types';
import { DEFAULT_CONFIG, DashboardConfig } from '../../types/config';
import { CAPACITY_CONSTANTS } from '../../types/capacityTypes';

// ===== MOCK HELPERS =====

function mockReq(overrides: Partial<Requisition> = {}): Requisition {
  return {
    req_id: 'req-1',
    req_title: 'Test Req',
    function: 'Engineering',
    job_family: 'Engineering',
    level: 'IC3',
    location_type: 'Hybrid',
    location_region: 'North America',
    location_city: null,
    comp_band_min: null,
    comp_band_max: null,
    opened_at: new Date('2024-01-01'),
    closed_at: null,
    status: 'open',
    hiring_manager_id: 'hm1',
    recruiter_id: 'r1',
    business_unit: null,
    headcount_type: 'new',
    priority: null,
    candidate_slate_required: false,
    search_firm_used: false,
    ...overrides
  } as Requisition;
}

function mockCandidate(overrides: Partial<Candidate> = {}): Candidate {
  return {
    candidate_id: 'c1',
    req_id: 'req-1',
    name: 'Test Candidate',
    email: null,
    source: 'Referral',
    current_stage: CanonicalStage.SCREEN,
    current_stage_entered_at: new Date(),
    applied_at: new Date(),
    first_contacted_at: null,
    offer_extended_at: null,
    hired_at: null,
    rejected_at: null,
    withdrawn_at: null,
    rejection_reason: null,
    withdrawal_reason: null,
    internal_external: 'External',
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides
  };
}

function mockConfig(overrides: Partial<DashboardConfig> = {}): DashboardConfig {
  return {
    ...DEFAULT_CONFIG,
    ...overrides
  };
}

// ===== WORKLOADSCORE TESTS =====

describe('WorkloadScore', () => {
  describe('calculateBaseDifficulty', () => {
    it('calculates BaseDifficulty from level, market, niche weights', () => {
      const req = mockReq({ level: 'IC5', location_type: 'Hybrid', job_family: 'Engineering' });
      const config = mockConfig({
        levelWeights: { IC5: 1.2 },
        marketWeights: { Hybrid: 1.0, Remote: 0.9, Onsite: 1.1 },
        nicheWeights: { Engineering: 1.1 }
      });
      const result = calculateBaseDifficulty(req, config);
      expect(result).toBeCloseTo(1.32, 1); // 1.2 × 1.0 × 1.1
    });

    it('uses default weights for unknown values', () => {
      const req = mockReq({ level: 'Unknown', job_family: 'Unknown' });
      const config = mockConfig();
      const result = calculateBaseDifficulty(req, config);
      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThan(3);
    });

    it('applies hard market bonus correctly', () => {
      const req = mockReq({ location_type: 'Onsite', location_city: 'San Francisco' });
      const config = mockConfig({
        marketWeights: {
          Remote: 0.9,
          Hybrid: 1.0,
          Onsite: 1.1,
          hardMarketBonus: 0.2,
          hardMarketsList: ['San Francisco']
        }
      });
      const result = calculateBaseDifficulty(req, config);
      expect(result).toBeGreaterThan(1.2); // Should include bonus
    });
  });

  describe('calculateRemainingWork', () => {
    it('returns 1.0 for empty pipeline', () => {
      const result = calculateRemainingWork([]);
      expect(result).toBe(1.0);
    });

    it('returns lower value for advanced pipeline', () => {
      const candidates = [
        mockCandidate({ current_stage: CanonicalStage.ONSITE }),
        mockCandidate({ current_stage: CanonicalStage.FINAL })
      ];
      const result = calculateRemainingWork(candidates);
      expect(result).toBeLessThan(1.0);
      expect(result).toBeGreaterThan(0);
    });

    it('returns lower value for pipeline with offer', () => {
      const candidates = [
        mockCandidate({ current_stage: CanonicalStage.OFFER })
      ];
      const result = calculateRemainingWork(candidates);
      // Offer stage gives 0.1 progress, so remaining = 0.9
      expect(result).toBeLessThan(1.0);
    });
  });

  describe('calculateAgingMultiplier', () => {
    it('returns 1.0 for new req (0 days)', () => {
      expect(calculateAgingMultiplier(0)).toBe(1.0);
    });

    it('returns ~1.3 for 90-day old req', () => {
      expect(calculateAgingMultiplier(90)).toBeCloseTo(1.3, 1);
    });

    it('caps at 1.6 for very old reqs', () => {
      expect(calculateAgingMultiplier(180)).toBe(1.6);
      expect(calculateAgingMultiplier(365)).toBe(1.6);
      expect(calculateAgingMultiplier(1000)).toBe(1.6);
    });
  });

  describe('calculateWorkloadScore', () => {
    it('combines all components correctly', () => {
      const req = mockReq({ level: 'IC3', opened_at: new Date() });
      const candidates: Candidate[] = [];
      const config = mockConfig();

      const result = calculateWorkloadScore(req, candidates, 1.0, config);

      expect(result.score).toBeGreaterThan(0);
      expect(result.components.baseDifficulty).toBeGreaterThan(0);
      expect(result.components.remainingWork).toBe(1.0); // Empty pipeline
      expect(result.components.frictionMultiplier).toBe(1.0); // Default HM weight
      expect(result.components.agingMultiplier).toBeCloseTo(1.0, 1); // New req
    });
  });
});

// ===== DEMAND TESTS =====

describe('Demand', () => {
  it('sums WorkloadScores for all recruiter reqs', () => {
    const reqWorkloads = [
      { reqId: 'r1', recruiterId: 'rec1', workloadScore: 10 },
      { reqId: 'r2', recruiterId: 'rec1', workloadScore: 15 },
      { reqId: 'r3', recruiterId: 'rec2', workloadScore: 20 }
    ] as any[];

    expect(calculateDemand('rec1', reqWorkloads)).toBe(25);
    expect(calculateDemand('rec2', reqWorkloads)).toBe(20);
    expect(calculateDemand('rec3', reqWorkloads)).toBe(0);
  });
});

// ===== SUSTAINABLE CAPACITY TESTS =====

describe('SustainableCapacityUnits', () => {
  it('returns median of stable weeks', () => {
    const weeklyLoads = [80, 90, 100, 110, 120, 90, 100, 110];
    const result = calculateSustainableCapacity(weeklyLoads, { minWeeks: 8 });
    expect(result).toBe(100); // Median of sorted array
  });

  it('falls back to team median with insufficient stable weeks', () => {
    const weeklyLoads = [80, 90]; // Only 2 weeks
    const teamMedian = 95;
    const result = calculateSustainableCapacity(weeklyLoads, { minWeeks: 8, teamMedian });
    expect(result).toBe(95);
  });

  it('handles empty array by using fallback', () => {
    const result = calculateSustainableCapacity([], { minWeeks: 8, teamMedian: 100 });
    expect(result).toBe(100);
  });
});

// ===== SHRINKAGE TESTS =====

describe('Shrinkage', () => {
  it('applies correct shrinkage factor for n=1', () => {
    // n=1, k=5: factor = 1/(1+5) = 0.167
    expect(applyShrinkage(1.0, 1, 5)).toBeCloseTo(0.167, 2);
  });

  it('applies correct shrinkage factor for n=5', () => {
    // n=5, k=5: factor = 5/(5+5) = 0.5
    expect(applyShrinkage(1.0, 5, 5)).toBeCloseTo(0.5, 2);
  });

  it('applies correct shrinkage factor for n=20', () => {
    // n=20, k=5: factor = 20/(20+5) = 0.8
    expect(applyShrinkage(1.0, 20, 5)).toBeCloseTo(0.8, 2);
  });

  it('preserves sign of residual', () => {
    expect(applyShrinkage(-0.5, 10, 5)).toBeLessThan(0);
    expect(applyShrinkage(0.5, 10, 5)).toBeGreaterThan(0);
  });

  it('returns 0 for 0 residual', () => {
    expect(applyShrinkage(0, 10, 5)).toBe(0);
  });
});

// ===== FITSCORE TESTS =====

describe('FitScore', () => {
  it('combines weighted residuals correctly', () => {
    const residuals = {
      hires_per_wu: { adjusted: 0.5, weight: 0.4, n: 10 },
      ttf_days: { adjusted: -0.2, weight: 0.25, n: 10 }, // Inverted in calculation
      offer_accept_rate: { adjusted: 0.1, weight: 0.2, n: 10 },
      candidate_throughput: { adjusted: 0.0, weight: 0.15, n: 10 }
    };

    // hires_per_wu: 0.5 * 0.4 = 0.2
    // ttf_days (inverted): 0.2 * 0.25 = 0.05
    // offer_accept_rate: 0.1 * 0.2 = 0.02
    // candidate_throughput: 0 * 0.15 = 0
    // Total: 0.27 / 1.0 = 0.27
    const result = calculateFitScore(residuals);
    expect(result).toBeCloseTo(0.27, 1);
  });

  it('returns null when any metric has insufficient data', () => {
    const residuals = {
      hires_per_wu: { adjusted: 0.5, weight: 0.4, n: 5 },
      ttf_days: { adjusted: -0.2, weight: 0.25, n: 2 } // Below threshold of 3
    };
    const result = calculateFitScore(residuals, { minN: 3 });
    expect(result).toBeNull();
  });

  it('handles partial residuals', () => {
    const residuals = {
      hires_per_wu: { adjusted: 0.5, weight: 0.4, n: 10 }
    };
    const result = calculateFitScore(residuals);
    expect(result).toBeCloseTo(0.5, 1);
  });

  it('returns null for empty residuals', () => {
    const result = calculateFitScore({});
    expect(result).toBeNull();
  });
});

// ===== INTEGRATION TESTS =====

describe('WorkloadScore Integration', () => {
  it('produces reasonable scores for typical reqs', () => {
    const config = mockConfig();
    const req = mockReq({
      level: 'IC4',
      location_type: 'Hybrid',
      job_family: 'Engineering',
      opened_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // 30 days old
    });

    // Empty pipeline
    const result1 = calculateWorkloadScore(req, [], 1.0, config);
    // WorkloadScore = BaseDifficulty * RemainingWork * FrictionMultiplier * AgingMultiplier
    // BaseDifficulty ~1.0-1.5, RemainingWork = 1.0, Friction = 1.0, Aging ~1.1
    expect(result1.score).toBeGreaterThan(0);
    expect(result1.score).toBeLessThan(10);

    // With some candidates
    const candidates = [
      mockCandidate({ current_stage: CanonicalStage.SCREEN }),
      mockCandidate({ current_stage: CanonicalStage.HM_SCREEN })
    ];
    const result2 = calculateWorkloadScore(req, candidates, 1.0, config);
    expect(result2.score).toBeLessThan(result1.score); // Less work remaining
  });
});
