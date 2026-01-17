/**
 * Scenario Engine Tests
 *
 * Tests for gating, confidence calculation, and scenario routing.
 */

import {
  runScenario,
  validateGlobalGates,
  calculateConfidence,
  buildSampleSize,
  createBlockedOutput,
  getScenarioName,
  createRecruiterIndexMap,
  anonymizeRecruiterName,
} from '../scenarioEngine';
import {
  ScenarioInput,
  ScenarioContext,
  RecruiterLeavesParams,
  SpinUpTeamParams,
  HiringFreezeParams,
  MIN_RECRUITERS,
  MIN_OPEN_REQS,
} from '../../types/scenarioTypes';

// Mock helpers
function createMockContext(overrides: Partial<ScenarioContext> = {}): ScenarioContext {
  return {
    org_id: 'test-org',
    dataset_id: 'test-dataset',
    requisitions: [
      { req_id: 'r1', title: 'Engineer', status: 'OPEN', recruiter_id: 'rec1', hiring_manager_id: 'hm1', job_family: 'Engineering', level: 'L4', location_type: 'Hybrid', opened_at: new Date(), closed_at: null },
      { req_id: 'r2', title: 'Designer', status: 'OPEN', recruiter_id: 'rec2', hiring_manager_id: 'hm1', job_family: 'Design', level: 'L3', location_type: 'Remote', opened_at: new Date(), closed_at: null },
      { req_id: 'r3', title: 'PM', status: 'OPEN', recruiter_id: 'rec3', hiring_manager_id: 'hm2', job_family: 'Product', level: 'L4', location_type: 'Onsite', opened_at: new Date(), closed_at: null },
      { req_id: 'r4', title: 'Engineer 2', status: 'OPEN', recruiter_id: 'rec1', hiring_manager_id: 'hm2', job_family: 'Engineering', level: 'L5', location_type: 'Hybrid', opened_at: new Date(), closed_at: null },
      { req_id: 'r5', title: 'Engineer 3', status: 'OPEN', recruiter_id: 'rec2', hiring_manager_id: 'hm1', job_family: 'Engineering', level: 'L4', location_type: 'Hybrid', opened_at: new Date(), closed_at: null },
      { req_id: 'r6', title: 'Engineer 4', status: 'OPEN', recruiter_id: 'rec3', hiring_manager_id: 'hm2', job_family: 'Engineering', level: 'L4', location_type: 'Hybrid', opened_at: new Date(), closed_at: null },
      { req_id: 'r7', title: 'Engineer 5', status: 'OPEN', recruiter_id: 'rec1', hiring_manager_id: 'hm1', job_family: 'Engineering', level: 'L4', location_type: 'Hybrid', opened_at: new Date(), closed_at: null },
      { req_id: 'r8', title: 'Engineer 6', status: 'OPEN', recruiter_id: 'rec2', hiring_manager_id: 'hm2', job_family: 'Engineering', level: 'L4', location_type: 'Hybrid', opened_at: new Date(), closed_at: null },
      { req_id: 'r9', title: 'Engineer 7', status: 'OPEN', recruiter_id: 'rec3', hiring_manager_id: 'hm1', job_family: 'Engineering', level: 'L4', location_type: 'Hybrid', opened_at: new Date(), closed_at: null },
      { req_id: 'r10', title: 'Engineer 8', status: 'OPEN', recruiter_id: 'rec1', hiring_manager_id: 'hm2', job_family: 'Engineering', level: 'L4', location_type: 'Hybrid', opened_at: new Date(), closed_at: null },
    ],
    candidates: [
      { candidate_id: 'c1', req_id: 'r1', current_stage: 'SCREEN', current_stage_entered_at: new Date(), applied_at: new Date() },
    ],
    events: [
      { event_id: 'e1', candidate_id: 'c1', from_stage: null, to_stage: 'SCREEN', timestamp: new Date() },
    ],
    recruiters: [
      { recruiter_id: 'rec1', name: 'Alice', capacity_wu: 100, demand_wu: 80, utilization: 0.8 },
      { recruiter_id: 'rec2', name: 'Bob', capacity_wu: 100, demand_wu: 60, utilization: 0.6 },
      { recruiter_id: 'rec3', name: 'Carol', capacity_wu: 100, demand_wu: 70, utilization: 0.7 },
    ],
    hiringManagers: [
      { hm_id: 'hm1', name: 'Dave', avg_feedback_days: 2 },
      { hm_id: 'hm2', name: 'Eve', avg_feedback_days: 3 },
    ],
    capacityAnalysis: {
      team_capacity: 300,
      team_demand: 210,
      team_utilization: 0.7,
      capacity_gap: 0,
      recruiter_loads: [],
    },
    fitMatrix: {
      scores: {
        rec1: { r1: 0.8, r2: 0.5, r3: 0.6 },
        rec2: { r1: 0.6, r2: 0.9, r3: 0.5 },
        rec3: { r1: 0.5, r2: 0.6, r3: 0.8 },
      },
    },
    benchmarks: {
      median_ttf_days: 45,
      funnel_conversion_rates: { SCREEN: 0.5, ONSITE: 0.3, OFFER: 0.8 },
      accept_rate: 0.85,
      candidates_per_hire: 10,
    },
    ...overrides,
  };
}

function createMockInput(
  scenarioId: 'recruiter_leaves' | 'spin_up_team' | 'hiring_freeze',
  params: ScenarioInput['parameters']
): ScenarioInput {
  return {
    scenario_id: scenarioId,
    date_range: {
      start_date: new Date(),
      end_date: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days
    },
    parameters: params,
    context: {
      org_id: 'test-org',
      dataset_id: 'test-dataset',
      current_filters: { requisitions: [], recruiters: [] },
    },
  };
}

describe('ScenarioEngine', () => {
  describe('gating', () => {
    it('returns NOT_ENOUGH_DATA when only 1 recruiter remains after departure', () => {
      // With MIN_RECRUITERS=2, having only 2 recruiters means only 1 remains after departure
      const context = createMockContext({
        recruiters: [
          { recruiter_id: 'rec1', name: 'Alice', capacity_wu: 100, demand_wu: 80, utilization: 0.8 },
          { recruiter_id: 'rec2', name: 'Bob', capacity_wu: 100, demand_wu: 60, utilization: 0.6 },
        ],
      });

      const input = createMockInput('recruiter_leaves', {
        recruiter_id: 'rec1',
        departure_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        reassignment_strategy: 'OPTIMIZE_FIT',
      } as RecruiterLeavesParams);

      const output = runScenario(input, context);

      expect(output.feasibility).toBe('NOT_ENOUGH_DATA');
      // The error is now 'remaining_recruiters' from scenario-specific gating
      expect(output.blocked?.missing_data).toContainEqual(
        expect.objectContaining({ field: 'remaining_recruiters' })
      );
    });

    it('returns NOT_ENOUGH_DATA when reqs < 5', () => {
      // MIN_OPEN_REQS is now 5
      const context = createMockContext({
        requisitions: [
          { req_id: 'r1', title: 'Engineer', status: 'OPEN', recruiter_id: 'rec1', hiring_manager_id: 'hm1', job_family: 'Engineering', level: 'L4', location_type: 'Hybrid', opened_at: new Date(), closed_at: null },
          { req_id: 'r2', title: 'Designer', status: 'OPEN', recruiter_id: 'rec2', hiring_manager_id: 'hm1', job_family: 'Design', level: 'L3', location_type: 'Remote', opened_at: new Date(), closed_at: null },
        ],
      });

      const input = createMockInput('recruiter_leaves', {
        recruiter_id: 'rec1',
        departure_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        reassignment_strategy: 'OPTIMIZE_FIT',
      } as RecruiterLeavesParams);

      const output = runScenario(input, context);

      expect(output.feasibility).toBe('NOT_ENOUGH_DATA');
      expect(output.blocked?.missing_data).toContainEqual(
        expect.objectContaining({ field: 'open_reqs' })
      );
    });

    it('returns NOT_ENOUGH_DATA when recruiter coverage < 30%', () => {
      // MIN_RECRUITER_ID_COVERAGE is now 0.3 (30%)
      const context = createMockContext({
        requisitions: [
          { req_id: 'r1', title: 'Engineer', status: 'OPEN', recruiter_id: 'rec1', hiring_manager_id: 'hm1', job_family: 'Engineering', level: 'L4', location_type: 'Hybrid', opened_at: new Date(), closed_at: null },
          { req_id: 'r2', title: 'Designer', status: 'OPEN', recruiter_id: null, hiring_manager_id: 'hm1', job_family: 'Design', level: 'L3', location_type: 'Remote', opened_at: new Date(), closed_at: null },
          { req_id: 'r3', title: 'PM', status: 'OPEN', recruiter_id: null, hiring_manager_id: 'hm2', job_family: 'Product', level: 'L4', location_type: 'Onsite', opened_at: new Date(), closed_at: null },
          { req_id: 'r4', title: 'Eng2', status: 'OPEN', recruiter_id: null, hiring_manager_id: 'hm1', job_family: 'Engineering', level: 'L4', location_type: 'Hybrid', opened_at: new Date(), closed_at: null },
          { req_id: 'r5', title: 'Eng3', status: 'OPEN', recruiter_id: null, hiring_manager_id: 'hm1', job_family: 'Engineering', level: 'L4', location_type: 'Hybrid', opened_at: new Date(), closed_at: null },
          { req_id: 'r6', title: 'Eng4', status: 'OPEN', recruiter_id: null, hiring_manager_id: 'hm1', job_family: 'Engineering', level: 'L4', location_type: 'Hybrid', opened_at: new Date(), closed_at: null },
          { req_id: 'r7', title: 'Eng5', status: 'OPEN', recruiter_id: null, hiring_manager_id: 'hm1', job_family: 'Engineering', level: 'L4', location_type: 'Hybrid', opened_at: new Date(), closed_at: null },
        ],
        // Only 1 of 7 reqs has recruiter_id = ~14% coverage < 30%
      });

      const input = createMockInput('recruiter_leaves', {
        recruiter_id: 'rec1',
        departure_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        reassignment_strategy: 'OPTIMIZE_FIT',
      } as RecruiterLeavesParams);

      const output = runScenario(input, context);

      expect(output.feasibility).toBe('NOT_ENOUGH_DATA');
      expect(output.blocked?.missing_data).toContainEqual(
        expect.objectContaining({ field: 'recruiter_id_coverage' })
      );
    });

    it('returns NOT_ENOUGH_DATA when no events exist', () => {
      const context = createMockContext({
        events: [],
      });

      const input = createMockInput('recruiter_leaves', {
        recruiter_id: 'rec1',
        departure_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        reassignment_strategy: 'OPTIMIZE_FIT',
      } as RecruiterLeavesParams);

      const output = runScenario(input, context);

      expect(output.feasibility).toBe('NOT_ENOUGH_DATA');
      expect(output.blocked?.missing_data).toContainEqual(
        expect.objectContaining({ field: 'events' })
      );
    });

    it('passes gating when all requirements met', () => {
      const context = createMockContext();
      const input = createMockInput('recruiter_leaves', {
        recruiter_id: 'rec1',
        departure_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        reassignment_strategy: 'OPTIMIZE_FIT',
      } as RecruiterLeavesParams);

      const output = runScenario(input, context);

      expect(output.feasibility).not.toBe('NOT_ENOUGH_DATA');
    });
  });

  describe('confidence', () => {
    it('returns LOW confidence when any sample below threshold', () => {
      const sampleSizes = [
        buildSampleSize('metric_a', 10, 5), // Sufficient
        buildSampleSize('metric_b', 3, 5),  // Below threshold
      ];

      const confidence = calculateConfidence(sampleSizes);

      expect(confidence.level).toBe('LOW');
      expect(confidence.reasons).toContainEqual(
        expect.stringContaining('metric_b: n=3 below minimum 5')
      );
    });

    it('returns HIGH confidence when all samples exceed 2x threshold', () => {
      const sampleSizes = [
        buildSampleSize('metric_a', 20, 5), // 4x threshold
        buildSampleSize('metric_b', 12, 5), // 2.4x threshold
      ];

      const confidence = calculateConfidence(sampleSizes);

      expect(confidence.level).toBe('HIGH');
    });

    it('returns MED confidence when all samples exceed 1.5x but not 2x threshold', () => {
      const sampleSizes = [
        buildSampleSize('metric_a', 8, 5),  // 1.6x threshold
        buildSampleSize('metric_b', 9, 5),  // 1.8x threshold
      ];

      const confidence = calculateConfidence(sampleSizes);

      expect(confidence.level).toBe('MED');
    });

    it('returns LOW confidence when samples meet but dont exceed 1.5x threshold', () => {
      const sampleSizes = [
        buildSampleSize('metric_a', 5, 5),  // 1x threshold
        buildSampleSize('metric_b', 6, 5),  // 1.2x threshold
      ];

      const confidence = calculateConfidence(sampleSizes);

      expect(confidence.level).toBe('LOW');
    });
  });

  describe('scenario routing', () => {
    it('routes to recruiter_leaves scenario', () => {
      const context = createMockContext();
      const input = createMockInput('recruiter_leaves', {
        recruiter_id: 'rec1',
        departure_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        reassignment_strategy: 'OPTIMIZE_FIT',
      } as RecruiterLeavesParams);

      const output = runScenario(input, context);

      expect(output.scenario_id).toBe('recruiter_leaves');
      expect(output.blocked).toBeNull();
    });

    it('routes to spin_up_team scenario', () => {
      // Add historical hires for TTF calculation
      const now = new Date();
      const context = createMockContext({
        requisitions: [
          ...createMockContext().requisitions,
          // Add 10 historical hires
          ...Array.from({ length: 10 }, (_, i) => ({
            req_id: `hire-${i}`,
            title: `Hired Engineer ${i}`,
            status: 'CLOSED',
            recruiter_id: `rec${(i % 3) + 1}`,
            hiring_manager_id: `hm${(i % 2) + 1}`,
            job_family: 'Engineering',
            level: 'L4',
            location_type: 'Hybrid',
            opened_at: new Date(now.getTime() - (120 + i * 7) * 24 * 60 * 60 * 1000),
            closed_at: new Date(now.getTime() - (75 + i * 7) * 24 * 60 * 60 * 1000),
          })),
        ],
      });
      const input = createMockInput('spin_up_team', {
        headcount: 5,
        role_profile: { function: 'Engineering', level: 'L4', location_type: 'Hybrid' },
        target_days: 60,
      } as SpinUpTeamParams);

      const output = runScenario(input, context);

      expect(output.scenario_id).toBe('spin_up_team');
      // May be blocked by scenario-specific gating, but should not be "not implemented"
      if (output.blocked) {
        expect(output.blocked.reason).not.toContain('not yet implemented');
      }
    });

    it('routes to hiring_freeze scenario', () => {
      // Add enough candidates for freeze scenario
      const now = new Date();
      const context = createMockContext({
        candidates: [
          ...Array.from({ length: 30 }, (_, i) => ({
            candidate_id: `cand-${i}`,
            req_id: `r${(i % 10) + 1}`,
            current_stage: ['SCREEN', 'HM_SCREEN', 'ONSITE', 'FINAL'][i % 4],
            current_stage_entered_at: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
            applied_at: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000),
          })),
          // Add offers/hires for decay curve
          ...Array.from({ length: 15 }, (_, i) => ({
            candidate_id: `offer-cand-${i}`,
            req_id: `r${(i % 10) + 1}`,
            current_stage: i % 2 === 0 ? 'OFFER' : 'HIRED',
            current_stage_entered_at: new Date(now.getTime() - (i * 7 + 14) * 24 * 60 * 60 * 1000),
            applied_at: new Date(now.getTime() - (i * 7 + 30) * 24 * 60 * 60 * 1000),
          })),
        ],
      });
      const input = createMockInput('hiring_freeze', {
        freeze_weeks: 4,
        candidate_action: 'HOLD',
        scope: { type: 'ALL' },
      } as HiringFreezeParams);

      const output = runScenario(input, context);

      expect(output.scenario_id).toBe('hiring_freeze');
      // May be blocked by scenario-specific gating, but should not be "not implemented"
      if (output.blocked) {
        expect(output.blocked.reason).not.toContain('not yet implemented');
      }
    });
  });

  describe('utility functions', () => {
    it('getScenarioName generates correct names', () => {
      expect(getScenarioName('spin_up_team', {
        headcount: 5,
        role_profile: { function: 'Engineering', level: 'L4', location_type: 'Hybrid' },
        target_days: 60,
      } as SpinUpTeamParams)).toBe('Spin up 5-person Engineering team');

      expect(getScenarioName('hiring_freeze', {
        freeze_weeks: 4,
        candidate_action: 'HOLD',
        scope: { type: 'ALL' },
      } as HiringFreezeParams)).toBe('4-week hiring freeze');

      expect(getScenarioName('recruiter_leaves', {
        recruiter_id: 'rec1',
        departure_date: new Date(),
        reassignment_strategy: 'OPTIMIZE_FIT',
      } as RecruiterLeavesParams)).toBe('Recruiter departure');
    });

    it('createRecruiterIndexMap creates correct mapping', () => {
      const recruiters = [
        { recruiter_id: 'rec1' },
        { recruiter_id: 'rec2' },
        { recruiter_id: 'rec3' },
      ];

      const map = createRecruiterIndexMap(recruiters);

      expect(map.get('rec1')).toBe(0);
      expect(map.get('rec2')).toBe(1);
      expect(map.get('rec3')).toBe(2);
    });

    it('anonymizeRecruiterName uses index map when available', () => {
      const map = new Map([['rec1', 0], ['rec2', 1]]);

      expect(anonymizeRecruiterName('rec1', map)).toBe('Recruiter 1');
      expect(anonymizeRecruiterName('rec2', map)).toBe('Recruiter 2');
    });

    it('anonymizeRecruiterName falls back to hash when not in map', () => {
      const map = new Map<string, number>();

      const name = anonymizeRecruiterName('unknown-recruiter', map);

      expect(name).toMatch(/^Recruiter \d+$/);
    });
  });
});
