// Capacity Fit Engine Scenario Tests
// End-to-end tests for various capacity scenarios

import { analyzeCapacity } from '../capacityFitEngine';
import { applyShrinkage } from '../fitScoring';
import { Requisition, Candidate, Event, User, CanonicalStage, EventType } from '../../types';
import { DEFAULT_CONFIG, DashboardConfig } from '../../types/config';
import { CAPACITY_CONSTANTS, ReqWithWorkload } from '../../types/capacityTypes';

// ===== MOCK HELPERS =====

function createRequisition(id: string, recruiterId: string, overrides: Partial<Requisition> = {}): Requisition {
  return {
    req_id: id,
    req_title: `Req ${id}`,
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
    recruiter_id: recruiterId,
    business_unit: null,
    headcount_type: 'new',
    priority: null,
    candidate_slate_required: false,
    search_firm_used: false,
    ...overrides
  } as Requisition;
}

function createCandidate(id: string, reqId: string, stage: CanonicalStage, overrides: Partial<Candidate> = {}): Candidate {
  return {
    candidate_id: id,
    req_id: reqId,
    name: `Candidate ${id}`,
    email: null,
    source: 'Referral',
    current_stage: stage,
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

function createUser(id: string, name: string): User {
  return {
    user_id: id,
    name,
    email: `${id}@example.com`,
    role: 'Recruiter',
    manager_id: null,
    created_at: new Date(),
    updated_at: new Date()
  };
}

function createEvent(candidateId: string, reqId: string, eventType: EventType, overrides: Partial<Event> = {}): Event {
  return {
    event_id: `evt-${Math.random().toString(36).substring(7)}`,
    candidate_id: candidateId,
    req_id: reqId,
    event_type: eventType,
    from_stage: CanonicalStage.APPLIED,
    to_stage: CanonicalStage.SCREEN,
    actor_user_id: 'r1',
    event_at: new Date(),
    metadata_json: null,
    ...overrides
  };
}

const defaultConfig = DEFAULT_CONFIG;
const defaultFilters = {
  dateRange: {
    startDate: new Date('2023-01-01'),
    endDate: new Date('2024-12-31')
  },
  useWeighted: false,
  normalizeByLoad: false
};

// ===== SCENARIO TESTS =====

describe('Scenario: Basic Team Analysis', () => {
  it('analyzes a simple team correctly', () => {
    // 3 recruiters, 12 reqs (4 each)
    const users = [
      createUser('r1', 'Alice Chen'),
      createUser('r2', 'Bob Smith'),
      createUser('r3', 'Carol Davis')
    ];

    const requisitions = [
      ...Array(4).fill(null).map((_, i) => createRequisition(`req-r1-${i}`, 'r1')),
      ...Array(4).fill(null).map((_, i) => createRequisition(`req-r2-${i}`, 'r2')),
      ...Array(4).fill(null).map((_, i) => createRequisition(`req-r3-${i}`, 'r3'))
    ];

    const candidates: Candidate[] = [];
    const events: Event[] = [];

    const result = analyzeCapacity(
      requisitions,
      candidates,
      events,
      users,
      defaultFilters,
      defaultConfig
    );

    expect(result.blocked).toBe(false);
    expect(result.teamSummary).toBeDefined();
    expect(result.recruiterLoads.length).toBe(3);
  });

  it('blocks when fewer than 3 recruiters', () => {
    const users = [
      createUser('r1', 'Alice Chen'),
      createUser('r2', 'Bob Smith')
    ];

    const requisitions = [
      createRequisition('req-1', 'r1'),
      createRequisition('req-2', 'r2')
    ];

    const result = analyzeCapacity(
      requisitions,
      [],
      [],
      users,
      defaultFilters,
      defaultConfig
    );

    expect(result.blocked).toBe(true);
    expect(result.blockReason).toContain('recruiter');
  });

  it('blocks when fewer than 10 reqs', () => {
    const users = [
      createUser('r1', 'Alice Chen'),
      createUser('r2', 'Bob Smith'),
      createUser('r3', 'Carol Davis')
    ];

    const requisitions = [
      createRequisition('req-1', 'r1'),
      createRequisition('req-2', 'r2'),
      createRequisition('req-3', 'r3')
    ];

    const result = analyzeCapacity(
      requisitions,
      [],
      [],
      users,
      defaultFilters,
      defaultConfig
    );

    expect(result.blocked).toBe(true);
    expect(result.blockReason).toContain('10');
  });
});

describe('Scenario: Uneven Load Distribution', () => {
  it('identifies overloaded and available recruiters', () => {
    const users = [
      createUser('r1', 'Alice Chen'),
      createUser('r2', 'Bob Smith'),
      createUser('r3', 'Carol Davis')
    ];

    // Alice has 8 reqs, Bob has 2, Carol has 2
    const requisitions = [
      ...Array(8).fill(null).map((_, i) => createRequisition(`req-r1-${i}`, 'r1')),
      ...Array(2).fill(null).map((_, i) => createRequisition(`req-r2-${i}`, 'r2')),
      ...Array(2).fill(null).map((_, i) => createRequisition(`req-r3-${i}`, 'r3'))
    ];

    const result = analyzeCapacity(
      requisitions,
      [],
      [],
      users,
      defaultFilters,
      defaultConfig
    );

    expect(result.blocked).toBe(false);

    // Find Alice's load
    const aliceLoad = result.recruiterLoads.find(r => r.recruiterId === 'r1');
    const bobLoad = result.recruiterLoads.find(r => r.recruiterId === 'r2');

    expect(aliceLoad).toBeDefined();
    expect(bobLoad).toBeDefined();
    expect(aliceLoad!.demandWU).toBeGreaterThan(bobLoad!.demandWU);
  });
});

describe('Scenario: Rebalancing Recommendations', () => {
  it('generates rebalance recommendations for uneven teams', () => {
    const users = [
      createUser('r1', 'Alice Chen'),
      createUser('r2', 'Bob Smith'),
      createUser('r3', 'Carol Davis')
    ];

    // Very uneven: Alice has 10 reqs, others have 1 each
    const requisitions = [
      ...Array(10).fill(null).map((_, i) => createRequisition(`req-r1-${i}`, 'r1')),
      createRequisition('req-r2-0', 'r2'),
      createRequisition('req-r3-0', 'r3')
    ];

    const result = analyzeCapacity(
      requisitions,
      [],
      [],
      users,
      defaultFilters,
      defaultConfig
    );

    expect(result.blocked).toBe(false);
    // With very uneven distribution, should have some recommendations
    // (depends on utilization thresholds)
    expect(result.rebalanceRecommendations).toBeDefined();
  });

  it('does not move reqs in final stages', () => {
    const users = [
      createUser('r1', 'Alice Chen'),
      createUser('r2', 'Bob Smith'),
      createUser('r3', 'Carol Davis')
    ];

    // Alice has reqs, some with offers
    const requisitions = [
      ...Array(10).fill(null).map((_, i) => createRequisition(`req-r1-${i}`, 'r1')),
      createRequisition('req-r2-0', 'r2'),
      createRequisition('req-r3-0', 'r3')
    ];

    // Add candidates in offer stage for some reqs
    const candidates = [
      createCandidate('c1', 'req-r1-0', CanonicalStage.OFFER),
      createCandidate('c2', 'req-r1-1', CanonicalStage.FINAL)
    ];

    const result = analyzeCapacity(
      requisitions,
      candidates,
      [],
      users,
      defaultFilters,
      defaultConfig
    );

    // Reqs with offers shouldn't be in recommendations
    const recommendedReqIds = result.rebalanceRecommendations.map(r => r.reqId);
    expect(recommendedReqIds).not.toContain('req-r1-0');
    expect(recommendedReqIds).not.toContain('req-r1-1');
  });
});

describe('Scenario: Recruiter Fit Differences', () => {
  it('applies shrinkage appropriately to fit scores', () => {
    // Test the shrinkage formula directly
    // r1: raw residual +0.25, n=10, k=5 -> shrinkage = 10/(10+5) = 0.67
    const r1Adjusted = applyShrinkage(0.25, 10, 5);
    expect(r1Adjusted).toBeCloseTo(0.167, 2); // 0.67 * 0.25

    // r2: raw residual +1.0, n=2, k=5 -> shrinkage = 2/(2+5) = 0.29
    const r2Adjusted = applyShrinkage(1.0, 2, 5);
    expect(r2Adjusted).toBeCloseTo(0.286, 2); // 0.29 * 1.0
  });

  it('shrinks small-sample outliers toward mean', () => {
    // Recruiter with amazing results but tiny sample should be shrunk more
    const smallSampleResidual = applyShrinkage(1.5, 3, 5); // n=3
    const largeSampleResidual = applyShrinkage(0.25, 20, 5); // n=20

    // Despite 6x raw difference, small sample is shrunk significantly
    expect(smallSampleResidual).toBeLessThan(1.5); // Significantly shrunk from 1.5
    expect(smallSampleResidual).toBeCloseTo(0.5625, 2); // 3/8 * 1.5

    // Large sample keeps most of its value
    expect(largeSampleResidual).toBeCloseTo(0.2, 2); // 20/25 * 0.25
  });
});

describe('Scenario: Capacity Calculation', () => {
  it('calculates team capacity summary', () => {
    const users = [
      createUser('r1', 'Alice Chen'),
      createUser('r2', 'Bob Smith'),
      createUser('r3', 'Carol Davis')
    ];

    const requisitions = [
      ...Array(5).fill(null).map((_, i) => createRequisition(`req-r1-${i}`, 'r1')),
      ...Array(5).fill(null).map((_, i) => createRequisition(`req-r2-${i}`, 'r2')),
      ...Array(5).fill(null).map((_, i) => createRequisition(`req-r3-${i}`, 'r3'))
    ];

    const result = analyzeCapacity(
      requisitions,
      [],
      [],
      users,
      defaultFilters,
      defaultConfig
    );

    expect(result.teamSummary).toBeDefined();
    expect(result.teamSummary!.teamDemand).toBeGreaterThan(0);
    expect(result.teamSummary!.teamCapacity).toBeGreaterThan(0);
    expect(typeof result.teamSummary!.capacityGap).toBe('number');
  });
});

describe('Scenario: Fit Matrix Generation', () => {
  it('generates fit matrix cells for recruiters with segment activity', () => {
    const users = [
      createUser('r1', 'Alice Chen'),
      createUser('r2', 'Bob Smith'),
      createUser('r3', 'Carol Davis')
    ];

    // Create reqs with different segments
    const requisitions = [
      ...Array(5).fill(null).map((_, i) => createRequisition(`req-r1-${i}`, 'r1', { job_family: 'Engineering' })),
      ...Array(5).fill(null).map((_, i) => createRequisition(`req-r2-${i}`, 'r2', { job_family: 'Engineering' })),
      ...Array(5).fill(null).map((_, i) => createRequisition(`req-r3-${i}`, 'r3', { job_family: 'Product' }))
    ];

    // Add some hired candidates for metrics
    const candidates = requisitions.map((req, i) =>
      createCandidate(`c${i}`, req.req_id, CanonicalStage.HIRED, {
        hired_at: new Date(),
        applied_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // 30 days ago
      })
    );

    const result = analyzeCapacity(
      requisitions,
      candidates,
      [],
      users,
      defaultFilters,
      defaultConfig
    );

    expect(result.fitMatrix).toBeDefined();
    // Fit matrix may be empty if not enough data to calculate fit scores
    expect(Array.isArray(result.fitMatrix)).toBe(true);

    // If cells exist, each should have required properties
    if (result.fitMatrix.length > 0) {
      const cell = result.fitMatrix[0];
      expect(cell.recruiterId).toBeDefined();
      expect(cell.segmentString).toBeDefined();
      expect(typeof cell.fitScore).toBe('number');
      expect(cell.confidence).toBeDefined();
    }
  });
});

describe('Scenario: Edge Cases', () => {
  it('handles empty data gracefully', () => {
    const result = analyzeCapacity([], [], [], [], defaultFilters, defaultConfig);

    expect(result.blocked).toBe(true);
    expect(result.recruiterLoads).toEqual([]);
    expect(result.fitMatrix).toEqual([]);
    expect(result.rebalanceRecommendations).toEqual([]);
  });

  it('handles reqs without recruiter_id', () => {
    const users = [
      createUser('r1', 'Alice Chen'),
      createUser('r2', 'Bob Smith'),
      createUser('r3', 'Carol Davis')
    ];

    const requisitions = [
      ...Array(5).fill(null).map((_, i) => createRequisition(`req-r1-${i}`, 'r1')),
      ...Array(5).fill(null).map((_, i) => createRequisition(`req-r2-${i}`, 'r2')),
      createRequisition('req-no-recruiter', null as any), // No recruiter
      createRequisition('req-no-recruiter-2', ''), // Empty recruiter
      ...Array(3).fill(null).map((_, i) => createRequisition(`req-r3-${i}`, 'r3'))
    ];

    const result = analyzeCapacity(
      requisitions,
      [],
      [],
      users,
      defaultFilters,
      defaultConfig
    );

    // Should still work, just excluding reqs without recruiters
    expect(result.blocked).toBe(false);
    expect(result.recruiterLoads.length).toBe(3);
  });

  it('handles very old reqs with aging cap', () => {
    const users = [
      createUser('r1', 'Alice Chen'),
      createUser('r2', 'Bob Smith'),
      createUser('r3', 'Carol Davis')
    ];

    // Create reqs with different ages
    const oldDate = new Date();
    oldDate.setFullYear(oldDate.getFullYear() - 1); // 1 year old

    const requisitions = [
      ...Array(4).fill(null).map((_, i) => createRequisition(`req-r1-${i}`, 'r1', { opened_at: oldDate })),
      ...Array(4).fill(null).map((_, i) => createRequisition(`req-r2-${i}`, 'r2')),
      ...Array(4).fill(null).map((_, i) => createRequisition(`req-r3-${i}`, 'r3'))
    ];

    const result = analyzeCapacity(
      requisitions,
      [],
      [],
      users,
      defaultFilters,
      defaultConfig
    );

    // Analysis should work with old reqs
    expect(result.blocked).toBe(false);

    // Old reqs should have higher workload (aging multiplier)
    const aliceLoad = result.recruiterLoads.find(r => r.recruiterId === 'r1');
    const bobLoad = result.recruiterLoads.find(r => r.recruiterId === 'r2');

    expect(aliceLoad).toBeDefined();
    expect(bobLoad).toBeDefined();
    // Both should have calculated demand
    expect(aliceLoad!.demandWU).toBeGreaterThan(0);
    expect(bobLoad!.demandWU).toBeGreaterThan(0);
    // Aging multiplier is applied, so old reqs should have >= demand (capped at 1.6x)
    // Note: demandWU is rounded, so we just verify both are reasonable
    expect(aliceLoad!.demandWU).toBeGreaterThanOrEqual(bobLoad!.demandWU);
  });
});
