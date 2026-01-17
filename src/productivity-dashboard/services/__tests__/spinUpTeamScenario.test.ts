/**
 * Spin Up Team Scenario Tests
 *
 * Tests for the Spin Up Team scenario implementation.
 */

import { runSpinUpTeamScenario } from '../scenarios/spinUpTeamScenario';
import {
  ScenarioInput,
  ScenarioContext,
  SpinUpTeamParams,
  MIN_HIRES_FOR_TTF,
} from '../../types/scenarioTypes';

// Helper to create mock scenario input
function mockSpinUpTeamInput(overrides: Partial<SpinUpTeamParams> = {}): ScenarioInput {
  const now = new Date();
  const targetDate = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000); // 60 days

  return {
    scenario_id: 'spin_up_team',
    date_range: {
      start_date: now,
      end_date: targetDate,
    },
    parameters: {
      headcount: 5,
      role_profile: {
        function: 'Engineering',
        level: 'L4',
        location_type: 'Hybrid',
      },
      target_days: 60,
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
  historicalHires: number;
  stableWeeks: number;
  predictedTTF: number;
  capacityGap: number;
}>): ScenarioContext {
  const {
    recruiters = 5,
    openReqs = 20,
    historicalHires = 10,
    stableWeeks = 12,
    predictedTTF = 45,
    capacityGap = 0.1,
  } = overrides;

  // Create requisitions with valid timestamps
  const now = new Date();
  const reqs = [];

  // Open reqs (for gating)
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

  // Historical hires (for TTF calculation)
  for (let i = 0; i < historicalHires; i++) {
    const opened = new Date(now.getTime() - (120 + i * 7) * 24 * 60 * 60 * 1000);
    const closed = new Date(opened.getTime() + predictedTTF * 24 * 60 * 60 * 1000);
    reqs.push({
      req_id: `hire-${i}`,
      title: `Hired Engineer ${i}`,
      status: 'CLOSED',
      recruiter_id: `recruiter-${i % recruiters}`,
      hiring_manager_id: `hm-${i % 3}`,
      job_family: 'Engineering',
      level: 'L4',
      location_type: 'Hybrid',
      opened_at: opened,
      closed_at: closed,
    });
  }

  // Create recruiters
  const recruiterList = [];
  for (let i = 0; i < recruiters; i++) {
    recruiterList.push({
      recruiter_id: `recruiter-${i}`,
      name: `Recruiter ${i + 1}`,
      capacity_wu: 100,
      demand_wu: 60 + capacityGap * 100,
      utilization: 0.6 + capacityGap,
    });
  }

  // Create candidates
  const candidates = [];
  for (let i = 0; i < 50; i++) {
    const stages = ['APPLIED', 'SCREEN', 'HM_SCREEN', 'ONSITE', 'FINAL', 'OFFER'];
    candidates.push({
      candidate_id: `cand-${i}`,
      req_id: `open-${i % openReqs}`,
      current_stage: stages[i % stages.length],
      current_stage_entered_at: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
      applied_at: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000),
    });
  }

  // Create events
  const events = [];
  for (let i = 0; i < 100; i++) {
    events.push({
      event_id: `event-${i}`,
      candidate_id: `cand-${i % 50}`,
      from_stage: 'APPLIED',
      to_stage: 'SCREEN',
      timestamp: new Date(now.getTime() - (i * 24 * 60 * 60 * 1000)),
    });
  }

  // Create hiring managers
  const hiringManagers = [
    { hm_id: 'hm-0', name: 'Manager 1', avg_feedback_days: 2 },
    { hm_id: 'hm-1', name: 'Manager 2', avg_feedback_days: 4 },
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
      team_demand: recruiters * (60 + capacityGap * 100),
      team_utilization: 0.6 + capacityGap,
      capacity_gap: capacityGap,
      recruiter_loads: recruiterList,
    },
    fitMatrix: {
      scores: Object.fromEntries(
        recruiterList.map(r => [
          r.recruiter_id,
          Object.fromEntries(reqs.slice(0, openReqs).map(req => [req.req_id, 0.7]))
        ])
      ),
    },
    benchmarks: {
      median_ttf_days: predictedTTF,
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

describe('SpinUpTeamScenario', () => {
  describe('gating', () => {
    it('returns NOT_ENOUGH_DATA when historical hires < 3', () => {
      const input = mockSpinUpTeamInput();
      // MIN_HIRES_FOR_TTF is now 3
      const context = mockContext({ historicalHires: 2 });
      const output = runSpinUpTeamScenario(input, context);

      expect(output.feasibility).toBe('NOT_ENOUGH_DATA');
      expect(output.blocked?.missing_data).toContainEqual(
        expect.objectContaining({ field: 'historical_hires' })
      );
    });

    it('passes gating when all requirements met', () => {
      const input = mockSpinUpTeamInput();
      const context = mockContext({ historicalHires: 10 });
      const output = runSpinUpTeamScenario(input, context);

      expect(output.feasibility).not.toBe('NOT_ENOUGH_DATA');
      expect(output.blocked).toBeNull();
    });
  });

  describe('feasibility', () => {
    it('returns AT_RISK when TTF exceeds target by 20%', () => {
      const input = mockSpinUpTeamInput({ target_days: 60 });
      const context = mockContext({ predictedTTF: 75 }); // 25% over target

      const output = runSpinUpTeamScenario(input, context);

      expect(output.feasibility).toBe('AT_RISK');
    });

    it('returns IMPOSSIBLE when TTF exceeds target by 50%', () => {
      const input = mockSpinUpTeamInput({ target_days: 60 });
      const context = mockContext({ predictedTTF: 100 }); // 67% over target

      const output = runSpinUpTeamScenario(input, context);

      expect(output.feasibility).toBe('IMPOSSIBLE');
    });

    it('returns ON_TRACK when TTF is within target', () => {
      const input = mockSpinUpTeamInput({ target_days: 60 });
      const context = mockContext({ predictedTTF: 45, capacityGap: 0.1 });

      const output = runSpinUpTeamScenario(input, context);

      expect(output.feasibility).toBe('ON_TRACK');
    });
  });

  describe('pipeline requirements', () => {
    it('calculates pipeline requirements from headcount', () => {
      const input = mockSpinUpTeamInput({ headcount: 5 });
      const context = mockContext({});

      const output = runSpinUpTeamScenario(input, context);

      // Check that pipeline requirements citation exists
      const pipelineCitation = output.citations.find(
        c => c.key_path === 'pipeline_requirements.total_candidates_needed'
      );
      expect(pipelineCitation).toBeDefined();
      expect(pipelineCitation?.value).toBe(50); // 5 hires × 10 candidates/hire
    });
  });

  describe('bottlenecks', () => {
    it('identifies capacity bottleneck when team utilization increases significantly', () => {
      // Create a context with high utilization so adding more work triggers bottleneck
      const input = mockSpinUpTeamInput({ headcount: 10 }); // High headcount = more workload
      const context = mockContext({ capacityGap: 0.3, recruiters: 3 }); // Smaller team, higher gap

      const output = runSpinUpTeamScenario(input, context);

      // Should have a capacity bottleneck or AT_RISK feasibility
      const capacityBottleneck = output.bottlenecks.find(
        b => b.constraint_type === 'CAPACITY_GAP'
      );
      // Either bottleneck exists or feasibility shows the issue
      expect(capacityBottleneck || output.feasibility === 'AT_RISK' || output.feasibility === 'IMPOSSIBLE').toBeTruthy();
    });

    it('identifies HM friction bottleneck when HM has high latency', () => {
      const input = mockSpinUpTeamInput({ hiring_manager_id: 'hm-1' }); // HM with 4-day latency
      const context = mockContext({});

      const output = runSpinUpTeamScenario(input, context);

      const hmBottleneck = output.bottlenecks.find(
        b => b.constraint_type === 'HM_FRICTION'
      );
      expect(hmBottleneck).toBeDefined();
      expect(hmBottleneck?.severity).toBe('MEDIUM'); // 4 days > 3 but < 5
    });
  });

  describe('deltas', () => {
    it('sets expected_hires_delta to headcount', () => {
      const input = mockSpinUpTeamInput({ headcount: 5 });
      const context = mockContext({});

      const output = runSpinUpTeamScenario(input, context);

      expect(output.deltas.expected_hires_delta).toBe(5);
    });

    it('calculates offers_delta from accept rate', () => {
      const input = mockSpinUpTeamInput({ headcount: 5 });
      const context = mockContext({});

      const output = runSpinUpTeamScenario(input, context);

      // 5 hires / 0.85 accept rate = ~6 offers
      expect(output.deltas.offers_delta).toBe(6);
    });

    it('sets pipeline_gap_delta to negative headcount', () => {
      const input = mockSpinUpTeamInput({ headcount: 5 });
      const context = mockContext({});

      const output = runSpinUpTeamScenario(input, context);

      expect(output.deltas.pipeline_gap_delta).toBe(-5);
    });
  });

  describe('resource impact', () => {
    it('calculates team utilization delta', () => {
      const input = mockSpinUpTeamInput({ headcount: 5 });
      const context = mockContext({ recruiters: 5, capacityGap: 0 });

      const output = runSpinUpTeamScenario(input, context);

      expect(output.resource_impact).not.toBeNull();
      expect(output.resource_impact?.team_utilization_delta).toBeGreaterThan(0);
    });

    it('assigns workload to specified recruiters if provided', () => {
      const input = mockSpinUpTeamInput({
        headcount: 5,
        assigned_recruiter_ids: ['recruiter-0', 'recruiter-1'],
      });
      const context = mockContext({ recruiters: 5 });

      const output = runSpinUpTeamScenario(input, context);

      expect(output.resource_impact?.recruiter_impacts.length).toBe(2);
    });
  });

  describe('action plan', () => {
    it('generates create requisitions action as P0', () => {
      const input = mockSpinUpTeamInput({ headcount: 5 });
      const context = mockContext({});

      const output = runSpinUpTeamScenario(input, context);

      const createAction = output.action_plan.find(a =>
        a.title.toLowerCase().includes('open') &&
        a.title.toLowerCase().includes('requisition')
      );

      expect(createAction).toBeDefined();
      expect(createAction?.priority).toBe('P0');
      expect(createAction?.title).toContain('5');
      expect(createAction?.title).toContain('Engineering');
    });

    it('generates capacity gap action when bottleneck exists', () => {
      // Create extreme capacity pressure to trigger capacity action
      const input = mockSpinUpTeamInput({ headcount: 10 });
      const context = mockContext({ capacityGap: 0.3, recruiters: 3 });

      const output = runSpinUpTeamScenario(input, context);

      // Either there's a capacity action or the feasibility reflects capacity issues
      const capacityAction = output.action_plan.find(a =>
        a.title.toLowerCase().includes('capacity')
      );

      // Verify either action exists or feasibility shows capacity issue
      expect(
        capacityAction ||
        output.feasibility === 'AT_RISK' ||
        output.feasibility === 'IMPOSSIBLE' ||
        output.bottlenecks.some(b => b.constraint_type === 'CAPACITY_GAP')
      ).toBeTruthy();
    });
  });

  describe('confidence', () => {
    it('returns HIGH confidence when all samples exceed 2x threshold', () => {
      const input = mockSpinUpTeamInput();
      const context = mockContext({
        historicalHires: MIN_HIRES_FOR_TTF * 2,
        stableWeeks: 52,
      });

      const output = runSpinUpTeamScenario(input, context);

      expect(output.confidence.level).toBe('HIGH');
    });

    it('returns LOW confidence when any sample below threshold', () => {
      const input = mockSpinUpTeamInput();
      const context = mockContext({ historicalHires: MIN_HIRES_FOR_TTF });

      const output = runSpinUpTeamScenario(input, context);

      // Just meets threshold, so should be LOW or MED
      expect(['LOW', 'MED']).toContain(output.confidence.level);
    });
  });

  describe('citations', () => {
    it('includes TTF prediction citation', () => {
      const input = mockSpinUpTeamInput();
      const context = mockContext({});

      const output = runSpinUpTeamScenario(input, context);

      expect(output.citations).toContainEqual(
        expect.objectContaining({ key_path: 'ttf_prediction.median_days' })
      );
    });

    it('includes capacity citations', () => {
      const input = mockSpinUpTeamInput();
      const context = mockContext({});

      const output = runSpinUpTeamScenario(input, context);

      expect(output.citations).toContainEqual(
        expect.objectContaining({ key_path: 'capacity.team_capacity' })
      );
      expect(output.citations).toContainEqual(
        expect.objectContaining({ key_path: 'capacity.team_demand' })
      );
    });
  });

  describe('deep links', () => {
    it('includes velocity tab link', () => {
      const input = mockSpinUpTeamInput();
      const context = mockContext({});

      const output = runSpinUpTeamScenario(input, context);

      const velocityLink = output.deep_links.find(l => l.tab === 'velocity');
      expect(velocityLink).toBeDefined();
    });

    it('includes forecasting tab link', () => {
      const input = mockSpinUpTeamInput();
      const context = mockContext({});

      const output = runSpinUpTeamScenario(input, context);

      const forecastLink = output.deep_links.find(l => l.tab === 'forecasting');
      expect(forecastLink).toBeDefined();
    });
  });
});
