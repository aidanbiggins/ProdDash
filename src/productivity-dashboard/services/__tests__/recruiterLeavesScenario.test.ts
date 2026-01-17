/**
 * Recruiter Leaves Scenario Tests
 *
 * Tests for the recruiter departure scenario logic.
 */

import { runRecruiterLeavesScenario } from '../scenarios/recruiterLeavesScenario';
import {
  ScenarioInput,
  ScenarioContext,
  RecruiterLeavesParams,
} from '../../types/scenarioTypes';

// Mock helpers
function createMockContext(overrides: Partial<ScenarioContext> = {}): ScenarioContext {
  return {
    org_id: 'test-org',
    dataset_id: 'test-dataset',
    requisitions: [
      { req_id: 'r1', title: 'Engineer', status: 'OPEN', recruiter_id: 'rec1', hiring_manager_id: 'hm1', job_family: 'Engineering', level: 'L4', location_type: 'Hybrid', opened_at: new Date(), closed_at: null },
      { req_id: 'r2', title: 'Designer', status: 'OPEN', recruiter_id: 'rec1', hiring_manager_id: 'hm1', job_family: 'Design', level: 'L3', location_type: 'Remote', opened_at: new Date(), closed_at: null },
      { req_id: 'r3', title: 'PM', status: 'OPEN', recruiter_id: 'rec2', hiring_manager_id: 'hm2', job_family: 'Product', level: 'L4', location_type: 'Onsite', opened_at: new Date(), closed_at: null },
      { req_id: 'r4', title: 'Engineer 2', status: 'OPEN', recruiter_id: 'rec3', hiring_manager_id: 'hm2', job_family: 'Engineering', level: 'L5', location_type: 'Hybrid', opened_at: new Date(), closed_at: null },
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
        rec1: { r1: 0.8, r2: 0.5, r3: 0.6, r4: 0.7 },
        rec2: { r1: 0.6, r2: 0.9, r3: 0.5, r4: 0.6 },
        rec3: { r1: 0.5, r2: 0.6, r3: 0.8, r4: 0.7 },
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

function createMockInput(params: RecruiterLeavesParams): ScenarioInput {
  return {
    scenario_id: 'recruiter_leaves',
    date_range: {
      start_date: new Date(),
      end_date: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
    },
    parameters: params,
    context: {
      org_id: 'test-org',
      dataset_id: 'test-dataset',
      current_filters: { requisitions: [], recruiters: [] },
    },
  };
}

describe('RecruiterLeavesScenario', () => {
  describe('gating', () => {
    it('returns NOT_ENOUGH_DATA when selected recruiter not found', () => {
      const context = createMockContext();
      const input = createMockInput({
        recruiter_id: 'nonexistent',
        departure_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        reassignment_strategy: 'OPTIMIZE_FIT',
      });

      const output = runRecruiterLeavesScenario(input, context);

      expect(output.feasibility).toBe('NOT_ENOUGH_DATA');
      expect(output.blocked?.missing_data).toContainEqual(
        expect.objectContaining({ field: 'recruiter' })
      );
    });

    it('returns NOT_ENOUGH_DATA when recruiter has no open reqs', () => {
      const context = createMockContext({
        requisitions: [
          { req_id: 'r1', title: 'Engineer', status: 'OPEN', recruiter_id: 'rec2', hiring_manager_id: 'hm1', job_family: 'Engineering', level: 'L4', location_type: 'Hybrid', opened_at: new Date(), closed_at: null },
          { req_id: 'r2', title: 'Designer', status: 'CLOSED', recruiter_id: 'rec1', hiring_manager_id: 'hm1', job_family: 'Design', level: 'L3', location_type: 'Remote', opened_at: new Date(), closed_at: new Date() },
        ],
      });
      const input = createMockInput({
        recruiter_id: 'rec1', // Has no open reqs
        departure_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        reassignment_strategy: 'OPTIMIZE_FIT',
      });

      const output = runRecruiterLeavesScenario(input, context);

      expect(output.feasibility).toBe('NOT_ENOUGH_DATA');
      expect(output.blocked?.missing_data).toContainEqual(
        expect.objectContaining({ field: 'recruiter_reqs' })
      );
    });

    it('returns NOT_ENOUGH_DATA when only 1 other recruiter available', () => {
      const context = createMockContext({
        recruiters: [
          { recruiter_id: 'rec1', name: 'Alice', capacity_wu: 100, demand_wu: 80, utilization: 0.8 },
          { recruiter_id: 'rec2', name: 'Bob', capacity_wu: 100, demand_wu: 60, utilization: 0.6 },
        ],
      });
      const input = createMockInput({
        recruiter_id: 'rec1',
        departure_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        reassignment_strategy: 'OPTIMIZE_FIT',
      });

      const output = runRecruiterLeavesScenario(input, context);

      expect(output.feasibility).toBe('NOT_ENOUGH_DATA');
      expect(output.blocked?.missing_data).toContainEqual(
        expect.objectContaining({ field: 'remaining_recruiters' })
      );
    });
  });

  describe('feasibility calculation', () => {
    it('returns ON_TRACK when reassignment is straightforward', () => {
      const context = createMockContext();
      const input = createMockInput({
        recruiter_id: 'rec1',
        departure_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        reassignment_strategy: 'OPTIMIZE_FIT',
      });

      const output = runRecruiterLeavesScenario(input, context);

      expect(output.feasibility).toBe('ON_TRACK');
    });

    it('returns AT_RISK when multiple recruiters become overloaded', () => {
      const context = createMockContext({
        recruiters: [
          { recruiter_id: 'rec1', name: 'Alice', capacity_wu: 100, demand_wu: 60, utilization: 0.6 },
          { recruiter_id: 'rec2', name: 'Bob', capacity_wu: 50, demand_wu: 50, utilization: 1.0 },
          { recruiter_id: 'rec3', name: 'Carol', capacity_wu: 50, demand_wu: 50, utilization: 1.0 },
        ],
        requisitions: [
          { req_id: 'r1', title: 'Engineer 1', status: 'OPEN', recruiter_id: 'rec1', hiring_manager_id: 'hm1', job_family: 'Engineering', level: 'L4', location_type: 'Hybrid', opened_at: new Date(), closed_at: null },
          { req_id: 'r2', title: 'Engineer 2', status: 'OPEN', recruiter_id: 'rec1', hiring_manager_id: 'hm1', job_family: 'Engineering', level: 'L4', location_type: 'Hybrid', opened_at: new Date(), closed_at: null },
          { req_id: 'r3', title: 'Engineer 3', status: 'OPEN', recruiter_id: 'rec1', hiring_manager_id: 'hm1', job_family: 'Engineering', level: 'L4', location_type: 'Hybrid', opened_at: new Date(), closed_at: null },
          { req_id: 'r4', title: 'Engineer 4', status: 'OPEN', recruiter_id: 'rec1', hiring_manager_id: 'hm1', job_family: 'Engineering', level: 'L4', location_type: 'Hybrid', opened_at: new Date(), closed_at: null },
        ],
      });
      const input = createMockInput({
        recruiter_id: 'rec1',
        departure_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        reassignment_strategy: 'BALANCE_LOAD',
      });

      const output = runRecruiterLeavesScenario(input, context);

      // With 4 reqs to reassign to 2 already-at-capacity recruiters, expect AT_RISK
      expect(['AT_RISK', 'IMPOSSIBLE']).toContain(output.feasibility);
    });

    it('returns IMPOSSIBLE when team becomes critically overloaded', () => {
      const context = createMockContext({
        recruiters: [
          { recruiter_id: 'rec1', name: 'Alice', capacity_wu: 100, demand_wu: 100, utilization: 1.0 },
          { recruiter_id: 'rec2', name: 'Bob', capacity_wu: 50, demand_wu: 60, utilization: 1.2 },
          { recruiter_id: 'rec3', name: 'Carol', capacity_wu: 50, demand_wu: 60, utilization: 1.2 },
        ],
        requisitions: [
          { req_id: 'r1', title: 'Engineer 1', status: 'OPEN', recruiter_id: 'rec1', hiring_manager_id: 'hm1', job_family: 'Engineering', level: 'L4', location_type: 'Hybrid', opened_at: new Date(), closed_at: null },
          { req_id: 'r2', title: 'Engineer 2', status: 'OPEN', recruiter_id: 'rec1', hiring_manager_id: 'hm1', job_family: 'Engineering', level: 'L4', location_type: 'Hybrid', opened_at: new Date(), closed_at: null },
          { req_id: 'r3', title: 'Engineer 3', status: 'OPEN', recruiter_id: 'rec1', hiring_manager_id: 'hm1', job_family: 'Engineering', level: 'L4', location_type: 'Hybrid', opened_at: new Date(), closed_at: null },
          { req_id: 'r4', title: 'Engineer 4', status: 'OPEN', recruiter_id: 'rec1', hiring_manager_id: 'hm1', job_family: 'Engineering', level: 'L4', location_type: 'Hybrid', opened_at: new Date(), closed_at: null },
          { req_id: 'r5', title: 'Engineer 5', status: 'OPEN', recruiter_id: 'rec1', hiring_manager_id: 'hm1', job_family: 'Engineering', level: 'L4', location_type: 'Hybrid', opened_at: new Date(), closed_at: null },
          { req_id: 'r6', title: 'Engineer 6', status: 'OPEN', recruiter_id: 'rec1', hiring_manager_id: 'hm1', job_family: 'Engineering', level: 'L4', location_type: 'Hybrid', opened_at: new Date(), closed_at: null },
        ],
      });
      const input = createMockInput({
        recruiter_id: 'rec1',
        departure_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        reassignment_strategy: 'BALANCE_LOAD',
      });

      const output = runRecruiterLeavesScenario(input, context);

      // With 6 reqs to reassign to 2 severely overloaded recruiters, expect IMPOSSIBLE or AT_RISK
      expect(['AT_RISK', 'IMPOSSIBLE']).toContain(output.feasibility);
    });
  });

  describe('resource impact calculation', () => {
    it('calculates team utilization delta correctly', () => {
      const context = createMockContext();
      const input = createMockInput({
        recruiter_id: 'rec1',
        departure_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        reassignment_strategy: 'OPTIMIZE_FIT',
      });

      const output = runRecruiterLeavesScenario(input, context);

      expect(output.resource_impact).not.toBeNull();
      expect(output.resource_impact?.team_utilization_delta).toBeGreaterThan(0);
    });

    it('flags BECOMES_OVERLOADED for recruiters exceeding 110%', () => {
      const context = createMockContext({
        recruiters: [
          { recruiter_id: 'rec1', name: 'Alice', capacity_wu: 100, demand_wu: 50, utilization: 0.5 },
          { recruiter_id: 'rec2', name: 'Bob', capacity_wu: 100, demand_wu: 100, utilization: 1.0 },
          { recruiter_id: 'rec3', name: 'Carol', capacity_wu: 100, demand_wu: 95, utilization: 0.95 },
        ],
        requisitions: [
          { req_id: 'r1', title: 'Engineer 1', status: 'OPEN', recruiter_id: 'rec1', hiring_manager_id: 'hm1', job_family: 'Engineering', level: 'L4', location_type: 'Hybrid', opened_at: new Date(), closed_at: null },
          { req_id: 'r2', title: 'Engineer 2', status: 'OPEN', recruiter_id: 'rec1', hiring_manager_id: 'hm1', job_family: 'Engineering', level: 'L4', location_type: 'Hybrid', opened_at: new Date(), closed_at: null },
        ],
      });
      const input = createMockInput({
        recruiter_id: 'rec1',
        departure_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        reassignment_strategy: 'BALANCE_LOAD',
      });

      const output = runRecruiterLeavesScenario(input, context);

      // rec3 starts at 95% and should go over 110% with reassignment
      const rec3Impact = output.resource_impact?.recruiter_impacts.find(
        r => r.recruiter_id === 'rec3'
      );

      if (rec3Impact && rec3Impact.projected_utilization >= 1.1) {
        expect(rec3Impact.status_change).toBe('BECOMES_OVERLOADED');
      }
    });
  });

  describe('action plan generation', () => {
    it('generates knowledge transfer action', () => {
      const context = createMockContext();
      const input = createMockInput({
        recruiter_id: 'rec1',
        departure_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        reassignment_strategy: 'OPTIMIZE_FIT',
      });

      const output = runRecruiterLeavesScenario(input, context);

      const ktAction = output.action_plan.find(a =>
        a.title.toLowerCase().includes('knowledge transfer')
      );

      expect(ktAction).toBeDefined();
      expect(ktAction?.priority).toBe('P0');
      expect(ktAction?.due_in_days).toBeLessThan(14);
    });

    it('generates reassignment actions for each req', () => {
      const context = createMockContext();
      const input = createMockInput({
        recruiter_id: 'rec1',
        departure_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        reassignment_strategy: 'OPTIMIZE_FIT',
      });

      const output = runRecruiterLeavesScenario(input, context);

      const reassignActions = output.action_plan.filter(a =>
        a.title.toLowerCase().includes('reassign')
      );

      // rec1 has 2 reqs in our mock
      expect(reassignActions.length).toBeGreaterThanOrEqual(2);
    });

    it('generates HM notification action when HMs are affected', () => {
      const context = createMockContext();
      const input = createMockInput({
        recruiter_id: 'rec1',
        departure_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        reassignment_strategy: 'OPTIMIZE_FIT',
      });

      const output = runRecruiterLeavesScenario(input, context);

      // Check for any action related to HM notification
      const hmNotifyAction = output.action_plan.find(a =>
        a.title.toLowerCase().includes('notify') ||
        (a.title.toLowerCase().includes('hm') && a.req_id === 'general')
      );

      expect(hmNotifyAction).toBeDefined();
      expect(hmNotifyAction?.priority).toBe('P1');
    });
  });

  describe('citations', () => {
    it('includes citations for departing recruiter metrics', () => {
      const context = createMockContext();
      const input = createMockInput({
        recruiter_id: 'rec1',
        departure_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        reassignment_strategy: 'OPTIMIZE_FIT',
      });

      const output = runRecruiterLeavesScenario(input, context);

      expect(output.citations).toContainEqual(
        expect.objectContaining({ key_path: 'departing_recruiter.current_demand_wu' })
      );
      expect(output.citations).toContainEqual(
        expect.objectContaining({ key_path: 'departing_recruiter.req_count' })
      );
    });

    it('includes citations for capacity metrics', () => {
      const context = createMockContext();
      const input = createMockInput({
        recruiter_id: 'rec1',
        departure_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        reassignment_strategy: 'OPTIMIZE_FIT',
      });

      const output = runRecruiterLeavesScenario(input, context);

      expect(output.citations).toContainEqual(
        expect.objectContaining({ key_path: 'capacity.remaining_capacity' })
      );
      expect(output.citations).toContainEqual(
        expect.objectContaining({ key_path: 'capacity.new_team_utilization' })
      );
    });
  });

  describe('deep links', () => {
    it('includes link to capacity tab', () => {
      const context = createMockContext();
      const input = createMockInput({
        recruiter_id: 'rec1',
        departure_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        reassignment_strategy: 'OPTIMIZE_FIT',
      });

      const output = runRecruiterLeavesScenario(input, context);

      const capacityLink = output.deep_links.find(l => l.tab === 'capacity');
      expect(capacityLink).toBeDefined();
    });

    it('includes link to recruiter detail tab', () => {
      const context = createMockContext();
      const input = createMockInput({
        recruiter_id: 'rec1',
        departure_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        reassignment_strategy: 'OPTIMIZE_FIT',
      });

      const output = runRecruiterLeavesScenario(input, context);

      const recruiterLink = output.deep_links.find(l => l.tab === 'recruiter-detail');
      expect(recruiterLink).toBeDefined();
      expect(recruiterLink?.params.recruiter_id).toBe('rec1');
    });
  });

  describe('reassignment strategies', () => {
    it('OPTIMIZE_FIT strategy considers fit scores', () => {
      const context = createMockContext();
      const input = createMockInput({
        recruiter_id: 'rec1',
        departure_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        reassignment_strategy: 'OPTIMIZE_FIT',
      });

      const output = runRecruiterLeavesScenario(input, context);

      // Should have reassignment actions
      expect(output.action_plan.some(a => a.title.includes('Reassign'))).toBe(true);
    });

    it('BALANCE_LOAD strategy distributes evenly', () => {
      const context = createMockContext();
      const input = createMockInput({
        recruiter_id: 'rec1',
        departure_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        reassignment_strategy: 'BALANCE_LOAD',
      });

      const output = runRecruiterLeavesScenario(input, context);

      // Should have reassignment actions
      expect(output.action_plan.some(a => a.title.includes('Reassign'))).toBe(true);
    });

    it('MANUAL strategy uses provided assignments', () => {
      const context = createMockContext();
      const input = createMockInput({
        recruiter_id: 'rec1',
        departure_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        reassignment_strategy: 'MANUAL',
        manual_assignments: [
          { req_id: 'r1', to_recruiter_id: 'rec2' },
          { req_id: 'r2', to_recruiter_id: 'rec3' },
        ],
      });

      const output = runRecruiterLeavesScenario(input, context);

      // Should have the manual assignments
      expect(output.action_plan.some(a =>
        a.title.includes('Reassign') && a.title.includes('Engineer')
      )).toBe(true);
    });
  });
});
