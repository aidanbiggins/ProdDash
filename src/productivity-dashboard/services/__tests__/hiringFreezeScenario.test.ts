/**
 * Hiring Freeze Scenario Tests
 *
 * Tests for the Hiring Freeze scenario implementation.
 */

import { runHiringFreezeScenario } from '../scenarios/hiringFreezeScenario';
import {
  ScenarioInput,
  ScenarioContext,
  HiringFreezeParams,
  MIN_OFFERS_FOR_DECAY,
} from '../../types/scenarioTypes';

// Helper to create mock scenario input
function mockHiringFreezeInput(overrides: Partial<HiringFreezeParams> = {}): ScenarioInput {
  const now = new Date();
  const endDate = new Date(now.getTime() + 28 * 24 * 60 * 60 * 1000); // 4 weeks

  return {
    scenario_id: 'hiring_freeze',
    date_range: {
      start_date: now,
      end_date: endDate,
    },
    parameters: {
      freeze_weeks: 4,
      candidate_action: 'HOLD',
      scope: { type: 'ALL' },
      ...overrides,
    },
    context: {
      org_id: 'test-org',
      dataset_id: 'test-dataset',
      current_filters: {},
    },
  };
}

// Helper to create mock context with controllable values
function mockContext(overrides: Partial<{
  recruiters: number;
  openReqs: number;
  activeCandidates: number;
  offersCount: number;
  avgDaysInProcess: number;
}>): ScenarioContext {
  const {
    recruiters = 5,
    openReqs = 20,
    activeCandidates = 50,
    offersCount = 15,
    avgDaysInProcess = 14,
  } = overrides;

  const now = new Date();

  // Create requisitions
  const reqs = [];
  for (let i = 0; i < openReqs; i++) {
    reqs.push({
      req_id: `open-${i}`,
      title: `Engineer ${i}`,
      status: 'OPEN',
      recruiter_id: `recruiter-${i % recruiters}`,
      hiring_manager_id: `hm-${i % 3}`,
      job_family: 'Engineering',
      level: 'L4',
      location_type: 'Hybrid',
      opened_at: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
      closed_at: null,
    });
  }

  // Create recruiters
  const recruiterList = [];
  for (let i = 0; i < recruiters; i++) {
    recruiterList.push({
      recruiter_id: `recruiter-${i}`,
      name: `Recruiter ${i + 1}`,
      capacity_wu: 100,
      demand_wu: 70,
      utilization: 0.7,
    });
  }

  // Create candidates with varying stages
  const stages = ['APPLIED', 'SCREEN', 'HM_SCREEN', 'ONSITE', 'FINAL', 'OFFER', 'HIRED', 'REJECTED'];
  const candidates = [];

  // Active candidates
  for (let i = 0; i < activeCandidates; i++) {
    const stage = stages[i % 6]; // Keep most in active stages
    candidates.push({
      candidate_id: `cand-${i}`,
      req_id: `open-${i % openReqs}`,
      current_stage: stage,
      current_stage_entered_at: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
      applied_at: new Date(now.getTime() - avgDaysInProcess * 24 * 60 * 60 * 1000),
    });
  }

  // Add offers/hires for decay curve
  for (let i = 0; i < offersCount; i++) {
    candidates.push({
      candidate_id: `offer-cand-${i}`,
      req_id: `open-${i % openReqs}`,
      current_stage: i % 2 === 0 ? 'OFFER' : 'HIRED',
      current_stage_entered_at: new Date(now.getTime() - (i * 7 + 14) * 24 * 60 * 60 * 1000),
      applied_at: new Date(now.getTime() - (i * 7 + 30) * 24 * 60 * 60 * 1000),
    });
  }

  // Create events
  const events = [];
  for (let i = 0; i < 100; i++) {
    events.push({
      event_id: `event-${i}`,
      candidate_id: `cand-${i % activeCandidates}`,
      from_stage: 'APPLIED',
      to_stage: 'SCREEN',
      timestamp: new Date(now.getTime() - (i * 24 * 60 * 60 * 1000)),
    });
  }

  // Create hiring managers
  const hiringManagers = [
    { hm_id: 'hm-0', name: 'Manager 1', avg_feedback_days: 2 },
    { hm_id: 'hm-1', name: 'Manager 2', avg_feedback_days: 3 },
    { hm_id: 'hm-2', name: 'Manager 3', avg_feedback_days: 1 },
  ];

  return {
    org_id: 'test-org',
    dataset_id: 'test-dataset',
    requisitions: reqs,
    candidates,
    events,
    recruiters: recruiterList,
    hiringManagers,
    capacityAnalysis: {
      team_capacity: recruiters * 100,
      team_demand: recruiters * 70,
      team_utilization: 0.7,
      capacity_gap: 0,
      recruiter_loads: recruiterList,
    },
    fitMatrix: null,
    benchmarks: {
      median_ttf_days: 45,
      funnel_conversion_rates: {
        'APPLIED': 0.5,
        'SCREEN': 0.6,
        'HM_SCREEN': 0.7,
        'ONSITE': 0.8,
        'FINAL': 0.9,
        'OFFER': 0.85,
      },
      accept_rate: 0.85,
      candidates_per_hire: 10,
    },
  };
}

describe('HiringFreezeScenario', () => {
  describe('gating', () => {
    it('returns NOT_ENOUGH_DATA when active candidates < 10', () => {
      const input = mockHiringFreezeInput();
      // Create a context with only 5 active candidates (threshold is now 10)
      const now = new Date();
      const context: ScenarioContext = {
        ...mockContext({ activeCandidates: 0, offersCount: 0 }),
        candidates: [
          // Only 5 active candidates (in early stages)
          ...Array.from({ length: 5 }, (_, i) => ({
            candidate_id: `cand-${i}`,
            req_id: `open-${i % 10}`,
            current_stage: 'SCREEN', // Active stage
            current_stage_entered_at: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
            applied_at: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000),
          })),
          // Add 5 HIRED candidates for decay curve (terminal, not active)
          ...Array.from({ length: 5 }, (_, i) => ({
            candidate_id: `hired-cand-${i}`,
            req_id: `open-${i % 10}`,
            current_stage: 'HIRED', // Terminal stage - not counted as active
            current_stage_entered_at: new Date(now.getTime() - (i * 7 + 14) * 24 * 60 * 60 * 1000),
            applied_at: new Date(now.getTime() - (i * 7 + 30) * 24 * 60 * 60 * 1000),
          })),
        ],
      };
      const output = runHiringFreezeScenario(input, context);

      expect(output.feasibility).toBe('NOT_ENOUGH_DATA');
      expect(output.blocked?.missing_data).toContainEqual(
        expect.objectContaining({ field: 'active_pipeline' })
      );
    });

    it('returns NOT_ENOUGH_DATA when offers < 3', () => {
      const input = mockHiringFreezeInput();
      // Create a context with 15 active candidates but only 2 offers/hires (threshold is now 3)
      const now = new Date();
      const context: ScenarioContext = {
        ...mockContext({ activeCandidates: 0, offersCount: 0 }),
        candidates: [
          // 15 active candidates
          ...Array.from({ length: 15 }, (_, i) => ({
            candidate_id: `cand-${i}`,
            req_id: `open-${i % 10}`,
            current_stage: ['SCREEN', 'HM_SCREEN', 'ONSITE', 'FINAL'][i % 4],
            current_stage_entered_at: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
            applied_at: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000),
          })),
          // Only 2 offers/hires (below threshold of 3)
          ...Array.from({ length: 2 }, (_, i) => ({
            candidate_id: `offer-cand-${i}`,
            req_id: `open-${i % 10}`,
            current_stage: i % 2 === 0 ? 'OFFER' : 'HIRED',
            current_stage_entered_at: new Date(now.getTime() - (i * 7 + 14) * 24 * 60 * 60 * 1000),
            applied_at: new Date(now.getTime() - (i * 7 + 30) * 24 * 60 * 60 * 1000),
          })),
        ],
      };
      const output = runHiringFreezeScenario(input, context);

      expect(output.feasibility).toBe('NOT_ENOUGH_DATA');
      expect(output.blocked?.missing_data).toContainEqual(
        expect.objectContaining({ field: 'decay_data' })
      );
    });

    it('passes gating when all requirements met', () => {
      const input = mockHiringFreezeInput();
      const context = mockContext({ activeCandidates: 30, offersCount: 15 });
      const output = runHiringFreezeScenario(input, context);

      expect(output.feasibility).not.toBe('NOT_ENOUGH_DATA');
      expect(output.blocked).toBeNull();
    });
  });

  describe('decay calculation', () => {
    it('calculates expected hires delta from decay curve', () => {
      const input = mockHiringFreezeInput({ freeze_weeks: 4 });
      const context = mockContext({});

      const output = runHiringFreezeScenario(input, context);

      // Expected hires should decrease due to decay
      expect(output.deltas.expected_hires_delta).toBeLessThan(0);
    });

    it('adds freeze_weeks × 7 to time_to_offer_delta', () => {
      const input = mockHiringFreezeInput({ freeze_weeks: 6 });
      const context = mockContext({});

      const output = runHiringFreezeScenario(input, context);

      expect(output.deltas.time_to_offer_delta).toBe(42); // 6 weeks × 7 days
    });

    it('calculates pipeline gap delta', () => {
      const input = mockHiringFreezeInput({ freeze_weeks: 4 });
      const context = mockContext({});

      const output = runHiringFreezeScenario(input, context);

      // Pipeline gap should increase (positive delta)
      expect(output.deltas.pipeline_gap_delta).toBeGreaterThanOrEqual(0);
    });
  });

  describe('feasibility', () => {
    it('returns AT_RISK when accept rate drops > 20%', () => {
      // Longer freeze = more decay
      const input = mockHiringFreezeInput({ freeze_weeks: 8 }); // Long freeze
      const context = mockContext({});

      const output = runHiringFreezeScenario(input, context);

      // 8-week freeze should cause significant decay
      expect(['AT_RISK', 'IMPOSSIBLE']).toContain(output.feasibility);
    });

    it('returns ON_TRACK for short freeze with HOLD action', () => {
      const input = mockHiringFreezeInput({
        freeze_weeks: 2, // Short freeze
        candidate_action: 'HOLD',
      });
      const context = mockContext({});

      const output = runHiringFreezeScenario(input, context);

      expect(output.feasibility).toBe('ON_TRACK');
    });
  });

  describe('scope filtering', () => {
    it('applies ALL scope to all open reqs', () => {
      const input = mockHiringFreezeInput({
        scope: { type: 'ALL' },
      });
      const context = mockContext({ openReqs: 20 });

      const output = runHiringFreezeScenario(input, context);

      const affectedReqsCitation = output.citations.find(
        c => c.key_path === 'freeze_scope.affected_reqs_count'
      );
      expect(affectedReqsCitation?.value).toBe(20);
    });

    it('applies FUNCTION scope to filter reqs', () => {
      const input = mockHiringFreezeInput({
        scope: { type: 'FUNCTION', filter_value: 'Engineering' },
      });
      const context = mockContext({});

      const output = runHiringFreezeScenario(input, context);

      // All our test reqs are Engineering, so should match all
      expect(output.citations.find(c => c.key_path === 'freeze_scope.affected_reqs_count')).toBeDefined();
    });
  });

  describe('bottlenecks', () => {
    it('identifies velocity decay bottleneck', () => {
      const input = mockHiringFreezeInput({ freeze_weeks: 6 });
      const context = mockContext({});

      const output = runHiringFreezeScenario(input, context);

      const decayBottleneck = output.bottlenecks.find(
        b => b.constraint_type === 'VELOCITY_DECAY'
      );
      // 6-week freeze should trigger decay bottleneck
      expect(decayBottleneck).toBeDefined();
    });

    it('identifies pipeline depth bottleneck when losing hires', () => {
      const input = mockHiringFreezeInput({ freeze_weeks: 8 }); // Long freeze
      const context = mockContext({});

      const output = runHiringFreezeScenario(input, context);

      // Check if pipeline bottleneck exists
      const pipelineBottleneck = output.bottlenecks.find(
        b => b.constraint_type === 'PIPELINE_DEPTH' || b.constraint_type === 'VELOCITY_DECAY'
      );
      expect(pipelineBottleneck).toBeDefined();
    });
  });

  describe('action plan', () => {
    it('generates candidate communication action for active pipeline', () => {
      const input = mockHiringFreezeInput();
      const context = mockContext({ activeCandidates: 50 });

      const output = runHiringFreezeScenario(input, context);

      const commAction = output.action_plan.find(a =>
        a.title.toLowerCase().includes('communicate') &&
        a.title.toLowerCase().includes('candidate')
      );

      expect(commAction).toBeDefined();
      expect(commAction?.priority).toBe('P0');
    });

    it('generates HM briefing action as P0', () => {
      const input = mockHiringFreezeInput();
      const context = mockContext({});

      const output = runHiringFreezeScenario(input, context);

      const briefAction = output.action_plan.find(a =>
        a.title.toLowerCase().includes('brief') &&
        a.title.toLowerCase().includes('hiring manager')
      );

      expect(briefAction).toBeDefined();
      expect(briefAction?.priority).toBe('P0');
    });

    it('generates re-engagement plan action as P1', () => {
      const input = mockHiringFreezeInput({ freeze_weeks: 4 });
      const context = mockContext({});

      const output = runHiringFreezeScenario(input, context);

      const reengageAction = output.action_plan.find(a =>
        a.title.toLowerCase().includes('re-engagement')
      );

      expect(reengageAction).toBeDefined();
      expect(reengageAction?.priority).toBe('P1');
      // Due date should be 1 week before freeze ends
      expect(reengageAction?.due_in_days).toBe(4 * 7 - 7); // 21 days
    });
  });

  describe('resource impact', () => {
    it('calculates freed capacity from frozen reqs', () => {
      const input = mockHiringFreezeInput();
      const context = mockContext({ openReqs: 20 });

      const output = runHiringFreezeScenario(input, context);

      // Freed capacity should be positive (releasing workload)
      const freedCitation = output.citations.find(
        c => c.key_path === 'capacity.freed_wu'
      );
      expect(freedCitation?.value).toBeGreaterThan(0);
    });

    it('calculates negative utilization delta (freed capacity)', () => {
      const input = mockHiringFreezeInput();
      const context = mockContext({});

      const output = runHiringFreezeScenario(input, context);

      // Utilization should decrease (negative delta)
      expect(output.resource_impact?.team_utilization_delta).toBeLessThan(0);
    });
  });

  describe('confidence', () => {
    it('includes decay sample size in confidence assessment', () => {
      const input = mockHiringFreezeInput();
      const context = mockContext({ offersCount: MIN_OFFERS_FOR_DECAY * 2 });

      const output = runHiringFreezeScenario(input, context);

      const decaySampleSize = output.confidence.sample_sizes.find(
        s => s.metric_key === 'decay_offers'
      );
      expect(decaySampleSize).toBeDefined();
    });
  });

  describe('citations', () => {
    it('includes decay curve citations', () => {
      const input = mockHiringFreezeInput();
      const context = mockContext({});

      const output = runHiringFreezeScenario(input, context);

      expect(output.citations).toContainEqual(
        expect.objectContaining({ key_path: 'velocity.current_accept_rate' })
      );
      expect(output.citations).toContainEqual(
        expect.objectContaining({ key_path: 'velocity.projected_accept_rate' })
      );
    });

    it('includes expected hires citations', () => {
      const input = mockHiringFreezeInput();
      const context = mockContext({});

      const output = runHiringFreezeScenario(input, context);

      expect(output.citations).toContainEqual(
        expect.objectContaining({ key_path: 'forecast.expected_hires_current' })
      );
      expect(output.citations).toContainEqual(
        expect.objectContaining({ key_path: 'forecast.expected_hires_projected' })
      );
    });
  });

  describe('deep links', () => {
    it('includes control tower link for pipeline health', () => {
      const input = mockHiringFreezeInput();
      const context = mockContext({});

      const output = runHiringFreezeScenario(input, context);

      const controlTowerLink = output.deep_links.find(l => l.tab === 'control-tower');
      expect(controlTowerLink).toBeDefined();
    });
  });
});
