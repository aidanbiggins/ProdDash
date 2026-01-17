/**
 * Scenario Action Plan Tests
 *
 * Tests for action generation and deduplication.
 */

import {
  deduplicateActions,
  generateRecruiterLeavesActions,
  generateHiringFreezeActions,
  generateSpinUpTeamActions,
} from '../scenarioActionPlanService';
import { ActionItem, generateActionId } from '../../types/actionTypes';
import {
  RecruiterLeavesParams,
  HiringFreezeParams,
  SpinUpTeamParams,
  Bottleneck,
} from '../../types/scenarioTypes';

// Helper to create mock actions
function mockAction(overrides: Partial<ActionItem> = {}): ActionItem {
  const now = new Date();
  return {
    action_id: generateActionId('TA_OPS', 'ta-ops', 'general', 'PROCESS_OPTIMIZATION'),
    owner_type: 'TA_OPS',
    owner_id: 'ta-ops',
    owner_name: 'TA Operations',
    req_id: 'general',
    action_type: 'PROCESS_OPTIMIZATION',
    title: 'Test action',
    priority: 'P1',
    due_in_days: 7,
    due_date: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
    evidence: {
      kpi_key: 'test.metric',
      explain_provider_key: 'test_service',
      short_reason: 'Test reason',
    },
    recommended_steps: ['Step 1', 'Step 2'],
    created_at: now,
    status: 'OPEN',
    ...overrides,
  };
}

describe('ActionPlan Deduplication', () => {
  it('deduplicates actions with same owner+req+type, keeps highest priority', () => {
    const actions = [
      mockAction({
        action_id: generateActionId('RECRUITER', 'r1', 'req1', 'FEEDBACK_DUE'),
        owner_type: 'RECRUITER',
        owner_id: 'r1',
        req_id: 'req1',
        action_type: 'FEEDBACK_DUE',
        priority: 'P1',
      }),
      mockAction({
        action_id: generateActionId('RECRUITER', 'r1', 'req1', 'FEEDBACK_DUE'),
        owner_type: 'RECRUITER',
        owner_id: 'r1',
        req_id: 'req1',
        action_type: 'FEEDBACK_DUE',
        priority: 'P0', // Higher priority
      }),
    ];

    const deduped = deduplicateActions(actions);

    expect(deduped.length).toBe(1);
    expect(deduped[0].priority).toBe('P0'); // Higher priority kept
  });

  it('keeps actions with different types for same owner+req', () => {
    const actions = [
      mockAction({
        action_id: generateActionId('RECRUITER', 'r1', 'req1', 'FEEDBACK_DUE'),
        owner_type: 'RECRUITER',
        owner_id: 'r1',
        req_id: 'req1',
        action_type: 'FEEDBACK_DUE',
      }),
      mockAction({
        action_id: generateActionId('RECRUITER', 'r1', 'req1', 'REVIEW_DUE'),
        owner_type: 'RECRUITER',
        owner_id: 'r1',
        req_id: 'req1',
        action_type: 'REVIEW_DUE',
      }),
    ];

    const deduped = deduplicateActions(actions);

    expect(deduped.length).toBe(2);
  });

  it('keeps actions with different owners for same req+type', () => {
    const actions = [
      mockAction({
        action_id: generateActionId('RECRUITER', 'r1', 'req1', 'FEEDBACK_DUE'),
        owner_type: 'RECRUITER',
        owner_id: 'r1',
        req_id: 'req1',
        action_type: 'FEEDBACK_DUE',
      }),
      mockAction({
        action_id: generateActionId('RECRUITER', 'r2', 'req1', 'FEEDBACK_DUE'),
        owner_type: 'RECRUITER',
        owner_id: 'r2',
        req_id: 'req1',
        action_type: 'FEEDBACK_DUE',
      }),
    ];

    const deduped = deduplicateActions(actions);

    expect(deduped.length).toBe(2);
  });

  it('keeps actions with different reqs for same owner+type', () => {
    const actions = [
      mockAction({
        action_id: generateActionId('RECRUITER', 'r1', 'req1', 'FEEDBACK_DUE'),
        owner_type: 'RECRUITER',
        owner_id: 'r1',
        req_id: 'req1',
        action_type: 'FEEDBACK_DUE',
      }),
      mockAction({
        action_id: generateActionId('RECRUITER', 'r1', 'req2', 'FEEDBACK_DUE'),
        owner_type: 'RECRUITER',
        owner_id: 'r1',
        req_id: 'req2',
        action_type: 'FEEDBACK_DUE',
      }),
    ];

    const deduped = deduplicateActions(actions);

    expect(deduped.length).toBe(2);
  });

  it('generates deterministic action_ids', () => {
    const id1 = generateActionId('RECRUITER', 'r1', 'req1', 'FEEDBACK_DUE');
    const id2 = generateActionId('RECRUITER', 'r1', 'req1', 'FEEDBACK_DUE');

    expect(id1).toBe(id2);
  });

  it('generates different action_ids for different inputs', () => {
    const id1 = generateActionId('RECRUITER', 'r1', 'req1', 'FEEDBACK_DUE');
    const id2 = generateActionId('RECRUITER', 'r2', 'req1', 'FEEDBACK_DUE');

    expect(id1).not.toBe(id2);
  });
});

describe('generateRecruiterLeavesActions', () => {
  const params: RecruiterLeavesParams = {
    recruiter_id: 'rec1',
    departure_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    reassignment_strategy: 'OPTIMIZE_FIT',
  };

  const affectedReqs = [
    { req_id: 'r1', title: 'Engineer 1', hiring_manager_id: 'hm1' },
    { req_id: 'r2', title: 'Engineer 2', hiring_manager_id: 'hm1' },
  ];

  const reassignmentPlan = [
    {
      req_id: 'r1',
      req_title: 'Engineer 1',
      from_recruiter_id: 'rec1',
      to_recruiter_id: 'rec2',
      demand_impact: 10,
      fit_score: 0.8,
      rationale: 'Best fit',
    },
    {
      req_id: 'r2',
      req_title: 'Engineer 2',
      from_recruiter_id: 'rec1',
      to_recruiter_id: 'rec3',
      demand_impact: 10,
      fit_score: 0.7,
      rationale: 'Second best fit',
    },
  ];

  const recruiterIndexMap = new Map([
    ['rec1', 0],
    ['rec2', 1],
    ['rec3', 2],
  ]);

  it('generates knowledge transfer action as P0', () => {
    const actions = generateRecruiterLeavesActions(
      params,
      affectedReqs,
      reassignmentPlan,
      2,
      recruiterIndexMap
    );

    const ktAction = actions.find(a =>
      a.title.toLowerCase().includes('knowledge transfer')
    );

    expect(ktAction).toBeDefined();
    expect(ktAction?.priority).toBe('P0');
    expect(ktAction?.owner_type).toBe('TA_OPS');
  });

  it('generates reassignment actions for each req', () => {
    const actions = generateRecruiterLeavesActions(
      params,
      affectedReqs,
      reassignmentPlan,
      2,
      recruiterIndexMap
    );

    const reassignActions = actions.filter(a =>
      a.title.toLowerCase().includes('reassign')
    );

    expect(reassignActions.length).toBe(2);
    expect(reassignActions.every(a => a.priority === 'P1')).toBe(true);
  });

  it('generates HM notification action', () => {
    const actions = generateRecruiterLeavesActions(
      params,
      affectedReqs,
      reassignmentPlan,
      2,
      recruiterIndexMap
    );

    // The action title includes "Notify N HMs" which contains "HM" uppercase
    const hmAction = actions.find(a =>
      a.title.includes('Notify') && a.title.includes('HM')
    );

    expect(hmAction).toBeDefined();
    expect(hmAction?.priority).toBe('P1');
    expect(hmAction?.req_id).toBe('general-hm-notify');
  });

  it('anonymizes recruiter names in action titles', () => {
    const actions = generateRecruiterLeavesActions(
      params,
      affectedReqs,
      reassignmentPlan,
      2,
      recruiterIndexMap
    );

    const reassignActions = actions.filter(a =>
      a.title.toLowerCase().includes('reassign')
    );

    // Should use "Recruiter N" format, not real names
    expect(reassignActions.some(a => a.title.includes('Recruiter 2'))).toBe(true);
    expect(reassignActions.some(a => a.title.includes('Recruiter 3'))).toBe(true);
  });

  it('deduplicates actions automatically', () => {
    // Create scenario where same action would be generated twice
    const duplicateParams = {
      ...params,
    };

    const actions = generateRecruiterLeavesActions(
      duplicateParams,
      affectedReqs,
      reassignmentPlan,
      2,
      recruiterIndexMap
    );

    // Each unique action should appear only once
    const actionIds = actions.map(a => a.action_id);
    const uniqueIds = new Set(actionIds);

    expect(uniqueIds.size).toBe(actionIds.length);
  });
});

describe('generateHiringFreezeActions', () => {
  const params: HiringFreezeParams = {
    freeze_weeks: 4,
    candidate_action: 'HOLD',
    scope: { type: 'ALL' },
  };

  const affectedReqs = [
    { req_id: 'r1', hiring_manager_id: 'hm1' },
    { req_id: 'r2', hiring_manager_id: 'hm2' },
  ];

  it('generates candidate communication action as P0 when candidates exist', () => {
    const actions = generateHiringFreezeActions(params, affectedReqs, 15);

    const commAction = actions.find(a =>
      a.title.toLowerCase().includes('communicate') &&
      a.title.toLowerCase().includes('candidate')
    );

    expect(commAction).toBeDefined();
    expect(commAction?.priority).toBe('P0');
    expect(commAction?.title).toContain('15');
  });

  it('does not generate candidate communication when no active candidates', () => {
    const actions = generateHiringFreezeActions(params, affectedReqs, 0);

    const commAction = actions.find(a =>
      a.title.toLowerCase().includes('communicate') &&
      a.title.toLowerCase().includes('candidate')
    );

    expect(commAction).toBeUndefined();
  });

  it('generates HM briefing action as P0', () => {
    const actions = generateHiringFreezeActions(params, affectedReqs, 15);

    // Title is "Brief N hiring managers on freeze impact"
    const briefAction = actions.find(a =>
      a.title.toLowerCase().includes('brief') &&
      a.title.toLowerCase().includes('hiring manager')
    );

    expect(briefAction).toBeDefined();
    expect(briefAction?.priority).toBe('P0');
    expect(briefAction?.req_id).toBe('general-hm-brief');
  });

  it('generates re-engagement plan action as P1', () => {
    const actions = generateHiringFreezeActions(params, affectedReqs, 15);

    const reengageAction = actions.find(a =>
      a.title.toLowerCase().includes('re-engagement')
    );

    expect(reengageAction).toBeDefined();
    expect(reengageAction?.priority).toBe('P1');
    // Due date should be 1 week before freeze ends
    expect(reengageAction?.due_in_days).toBe(params.freeze_weeks * 7 - 7);
  });
});

describe('generateSpinUpTeamActions', () => {
  const params: SpinUpTeamParams = {
    headcount: 5,
    role_profile: {
      function: 'Engineering',
      level: 'L4',
      location_type: 'Hybrid',
    },
    target_days: 60,
  };

  it('generates create requisitions action as P0', () => {
    const actions = generateSpinUpTeamActions(params, []);

    const createAction = actions.find(a =>
      a.title.toLowerCase().includes('open') &&
      a.title.toLowerCase().includes('requisition')
    );

    expect(createAction).toBeDefined();
    expect(createAction?.priority).toBe('P0');
    expect(createAction?.title).toContain('5');
    expect(createAction?.title).toContain('Engineering');
  });

  it('generates capacity gap action when bottleneck exists', () => {
    const bottlenecks: Bottleneck[] = [
      {
        rank: 1,
        constraint_type: 'CAPACITY_GAP',
        description: 'Team capacity is insufficient',
        severity: 'CRITICAL',
        evidence: {
          metric_key: 'capacity.gap',
          current_value: 0.35,
          threshold: 0.3,
          source_citation: 'capacity_fit_engine',
        },
        mitigation: 'Add more recruiters',
      },
    ];

    const actions = generateSpinUpTeamActions(params, bottlenecks);

    const capacityAction = actions.find(a =>
      a.title.toLowerCase().includes('capacity')
    );

    expect(capacityAction).toBeDefined();
    expect(capacityAction?.priority).toBe('P0'); // CRITICAL severity = P0
  });

  it('generates HM friction action when bottleneck exists', () => {
    const paramsWithHM: SpinUpTeamParams = {
      ...params,
      hiring_manager_id: 'hm1',
    };

    const bottlenecks: Bottleneck[] = [
      {
        rank: 2,
        constraint_type: 'HM_FRICTION',
        description: 'HM feedback latency is high',
        severity: 'HIGH',
        evidence: {
          metric_key: 'hm_friction.latency',
          current_value: 5,
          threshold: 2,
          source_citation: 'hm_metrics_engine',
        },
        mitigation: 'Establish SLA with HM',
      },
    ];

    const actions = generateSpinUpTeamActions(paramsWithHM, bottlenecks);

    const hmAction = actions.find(a =>
      a.title.toLowerCase().includes('sla') ||
      a.action_type === 'FEEDBACK_DUE'
    );

    expect(hmAction).toBeDefined();
    expect(hmAction?.owner_type).toBe('HIRING_MANAGER');
  });

  it('generates pipeline sourcing action when bottleneck exists', () => {
    const bottlenecks: Bottleneck[] = [
      {
        rank: 3,
        constraint_type: 'PIPELINE_DEPTH',
        description: 'Pipeline too shallow for target',
        severity: 'HIGH',
        evidence: {
          metric_key: 'pipeline.depth',
          current_value: 20,
          threshold: 50,
          source_citation: 'scenario_library',
        },
        mitigation: 'Activate sourcing channels',
      },
    ];

    const actions = generateSpinUpTeamActions(params, bottlenecks);

    const sourcingAction = actions.find(a =>
      a.title.toLowerCase().includes('pipeline') ||
      a.action_type === 'SOURCE_CANDIDATES'
    );

    expect(sourcingAction).toBeDefined();
  });
});
