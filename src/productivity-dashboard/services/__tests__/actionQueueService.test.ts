// Unit tests for Unified Action Queue Service
// Tests action generation, deduplication, sorting, and localStorage persistence

import {
  generateActionsFromHMQueue,
  generateActionsFromExplain,
  deduplicateActions,
  sortActions,
  filterActionsByOwner,
  generateUnifiedActionQueue,
  getOpenActions,
  getActionCounts,
} from '../actionQueueService';
import {
  ActionItem,
  ActionPriority,
  ActionStatus,
  ActionOwnerType,
  PRIORITY_ORDER,
} from '../../types/actionTypes';
import { HMPendingAction, HMActionType } from '../../types/hmTypes';
import { Explanation, ExplainProviderId, RecommendedAction } from '../../types/explainTypes';
import { Requisition, User, RequisitionStatus, Function, LocationType, LocationRegion, HeadcountType, UserRole } from '../../types/entities';

// Helper to create test HM actions
function createHMAction(overrides: Partial<HMPendingAction> = {}): HMPendingAction {
  return {
    reqId: 'REQ-001',
    reqTitle: 'Software Engineer',
    candidateId: 'CAN-001',
    candidateName: 'John Doe',
    hmUserId: 'HM-001',
    hmName: 'Jane HM',
    actionType: HMActionType.FEEDBACK_DUE,
    daysWaiting: 5,
    daysOverdue: 2,
    suggestedAction: 'Submit interview feedback',
    ...overrides
  };
}

// Helper to create test requisitions
function createReq(overrides: Partial<Requisition> = {}): Requisition {
  return {
    req_id: 'REQ-001',
    req_title: 'Software Engineer',
    function: Function.Engineering,
    job_family: 'Engineering',
    level: 'L4',
    location_type: LocationType.Remote,
    location_region: LocationRegion.AMER,
    location_city: null,
    comp_band_min: 100000,
    comp_band_max: 150000,
    opened_at: new Date('2024-01-01'),
    closed_at: null,
    status: RequisitionStatus.Open,
    hiring_manager_id: 'HM-001',
    recruiter_id: 'REC-001',
    business_unit: 'Product',
    headcount_type: HeadcountType.New,
    priority: null,
    candidate_slate_required: false,
    search_firm_used: false,
    ...overrides
  };
}

// Helper to create test users
function createUser(overrides: Partial<User> = {}): User {
  return {
    user_id: 'REC-001',
    name: 'Jane Recruiter',
    role: UserRole.Recruiter,
    team: 'TA Team',
    manager_user_id: null,
    email: 'jane@company.com',
    ...overrides
  };
}

// Helper to create explanation with recommended actions
function createExplanation(
  providerId: ExplainProviderId,
  recommendedActions: RecommendedAction[]
): Explanation {
  return {
    providerId,
    metricId: providerId,
    metricLabel: providerId.replace('_', ' ').toUpperCase(),
    value: 42,
    unit: 'd',
    status: 'yellow',
    summary: 'Test summary',
    topContributors: [],
    breakdown: {
      title: 'Test breakdown',
      items: []
    },
    recommendation: 'Test recommendation',
    recommendedActions,
    contextDetails: []
  };
}

// Helper to create action items directly
function createAction(overrides: Partial<ActionItem> = {}): ActionItem {
  const now = new Date();
  return {
    action_id: 'act_001',
    owner_type: 'RECRUITER' as ActionOwnerType,
    owner_id: 'REC-001',
    owner_name: 'Jane Recruiter',
    req_id: 'REQ-001',
    req_title: 'Software Engineer',
    action_type: 'FEEDBACK_DUE',
    title: 'Submit feedback',
    priority: 'P1' as ActionPriority,
    due_in_days: 3,
    due_date: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000),
    evidence: {
      kpi_key: 'hm_latency',
      explain_provider_key: 'hm_latency',
      short_reason: 'Feedback pending 5 days'
    },
    recommended_steps: ['Submit feedback'],
    created_at: now,
    status: 'OPEN' as ActionStatus,
    ...overrides
  };
}

describe('generateActionsFromHMQueue', () => {
  test('creates actions from HM pending actions', () => {
    const hmActions = [
      createHMAction({
        reqId: 'REQ-001',
        hmUserId: 'HM-001',
        actionType: HMActionType.FEEDBACK_DUE,
        daysOverdue: 2
      })
    ];
    const requisitions = [createReq()];

    const result = generateActionsFromHMQueue(hmActions, requisitions);

    expect(result).toHaveLength(1);
    expect(result[0].owner_type).toBe('HIRING_MANAGER');
    expect(result[0].action_type).toBe('FEEDBACK_DUE');
    expect(result[0].status).toBe('OPEN');
  });

  test('assigns P0 priority for highly overdue actions', () => {
    const hmActions = [
      createHMAction({ daysOverdue: 5 }) // > 3 days overdue = P0
    ];
    const requisitions = [createReq()];

    const result = generateActionsFromHMQueue(hmActions, requisitions);

    expect(result[0].priority).toBe('P0');
  });

  test('assigns P1 priority for moderately overdue actions', () => {
    const hmActions = [
      createHMAction({ daysOverdue: 2 }) // > 0 but <= 3 = P1
    ];
    const requisitions = [createReq()];

    const result = generateActionsFromHMQueue(hmActions, requisitions);

    expect(result[0].priority).toBe('P1');
  });

  test('assigns P2 priority for non-overdue actions', () => {
    const hmActions = [
      createHMAction({ daysOverdue: 0 }) // Not overdue = P2
    ];
    const requisitions = [createReq()];

    const result = generateActionsFromHMQueue(hmActions, requisitions);

    expect(result[0].priority).toBe('P2');
  });

  test('maps different HM action types correctly', () => {
    const hmActions = [
      createHMAction({ actionType: HMActionType.FEEDBACK_DUE }),
      createHMAction({ candidateId: 'CAN-002', actionType: HMActionType.REVIEW_DUE }),
      createHMAction({ candidateId: 'CAN-003', actionType: HMActionType.DECISION_DUE })
    ];
    const requisitions = [createReq()];

    const result = generateActionsFromHMQueue(hmActions, requisitions);

    expect(result.map(a => a.action_type)).toContain('FEEDBACK_DUE');
    expect(result.map(a => a.action_type)).toContain('REVIEW_DUE');
    expect(result.map(a => a.action_type)).toContain('DECISION_DUE');
  });
});

describe('generateActionsFromExplain', () => {
  test('creates actions from explain recommended actions', () => {
    const explanations = new Map<ExplainProviderId, Explanation>();
    explanations.set('stalled_reqs', createExplanation('stalled_reqs', [
      {
        action: 'Review stalled requisitions',
        priority: 'high',
        reason: 'Multiple reqs with no activity'
      }
    ]));

    const requisitions = [createReq()];
    const users = [createUser()];

    const result = generateActionsFromExplain(explanations, requisitions, users);

    expect(result.length).toBeGreaterThan(0);
    expect(result.some(a => a.evidence.explain_provider_key === 'stalled_reqs')).toBe(true);
  });

  test('maps high priority to P0', () => {
    const explanations = new Map<ExplainProviderId, Explanation>();
    explanations.set('median_ttf', createExplanation('median_ttf', [
      { action: 'Speed up engagement', priority: 'high', reason: 'TTF too high' }
    ]));

    const result = generateActionsFromExplain(explanations, [createReq()], [createUser()]);

    expect(result.some(a => a.priority === 'P0')).toBe(true);
  });

  test('maps medium priority to P1', () => {
    const explanations = new Map<ExplainProviderId, Explanation>();
    explanations.set('time_to_offer', createExplanation('time_to_offer', [
      { action: 'Review process', priority: 'medium', reason: 'Room for improvement' }
    ]));

    const result = generateActionsFromExplain(explanations, [createReq()], [createUser()]);

    expect(result.some(a => a.priority === 'P1')).toBe(true);
  });

  test('maps low priority to P2', () => {
    const explanations = new Map<ExplainProviderId, Explanation>();
    explanations.set('offer_accept_rate', createExplanation('offer_accept_rate', [
      { action: 'Minor optimization', priority: 'low', reason: 'Low impact' }
    ]));

    const result = generateActionsFromExplain(explanations, [createReq()], [createUser()]);

    expect(result.some(a => a.priority === 'P2')).toBe(true);
  });

  test('skips explanations without recommended actions', () => {
    const explanations = new Map<ExplainProviderId, Explanation>();
    explanations.set('hm_latency', createExplanation('hm_latency', []));

    const result = generateActionsFromExplain(explanations, [createReq()], [createUser()]);

    expect(result.filter(a => a.evidence.explain_provider_key === 'hm_latency')).toHaveLength(0);
  });
});

describe('deduplicateActions', () => {
  test('removes duplicate actions keeping highest priority', () => {
    const actions = [
      createAction({
        action_id: 'act_001',
        owner_type: 'RECRUITER',
        owner_id: 'REC-001',
        req_id: 'REQ-001',
        action_type: 'FEEDBACK_DUE',
        priority: 'P2' // Lower priority
      }),
      createAction({
        action_id: 'act_002',
        owner_type: 'RECRUITER',
        owner_id: 'REC-001',
        req_id: 'REQ-001',
        action_type: 'FEEDBACK_DUE',
        priority: 'P0' // Higher priority - should be kept
      })
    ];

    const result = deduplicateActions(actions);

    expect(result).toHaveLength(1);
    expect(result[0].priority).toBe('P0');
  });

  test('keeps actions with different owner_type', () => {
    const actions = [
      createAction({
        action_id: 'act_001',
        owner_type: 'RECRUITER',
        owner_id: 'REC-001',
        req_id: 'REQ-001',
        action_type: 'FEEDBACK_DUE'
      }),
      createAction({
        action_id: 'act_002',
        owner_type: 'HIRING_MANAGER',
        owner_id: 'REC-001',
        req_id: 'REQ-001',
        action_type: 'FEEDBACK_DUE'
      })
    ];

    const result = deduplicateActions(actions);

    expect(result).toHaveLength(2);
  });

  test('keeps actions with different req_id', () => {
    const actions = [
      createAction({
        action_id: 'act_001',
        owner_type: 'RECRUITER',
        owner_id: 'REC-001',
        req_id: 'REQ-001',
        action_type: 'FEEDBACK_DUE'
      }),
      createAction({
        action_id: 'act_002',
        owner_type: 'RECRUITER',
        owner_id: 'REC-001',
        req_id: 'REQ-002',
        action_type: 'FEEDBACK_DUE'
      })
    ];

    const result = deduplicateActions(actions);

    expect(result).toHaveLength(2);
  });
});

describe('sortActions', () => {
  test('sorts by priority first (P0 before P1 before P2)', () => {
    const now = new Date();
    const actions = [
      createAction({ action_id: 'act_p2', priority: 'P2', due_date: now }),
      createAction({ action_id: 'act_p0', priority: 'P0', due_date: now }),
      createAction({ action_id: 'act_p1', priority: 'P1', due_date: now })
    ];

    const result = sortActions(actions);

    expect(result[0].priority).toBe('P0');
    expect(result[1].priority).toBe('P1');
    expect(result[2].priority).toBe('P2');
  });

  test('sorts by due date within same priority', () => {
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const actions = [
      createAction({ action_id: 'act_later', priority: 'P1', due_date: nextWeek }),
      createAction({ action_id: 'act_sooner', priority: 'P1', due_date: tomorrow }),
      createAction({ action_id: 'act_soonest', priority: 'P1', due_date: now })
    ];

    const result = sortActions(actions);

    expect(result[0].action_id).toBe('act_soonest');
    expect(result[1].action_id).toBe('act_sooner');
    expect(result[2].action_id).toBe('act_later');
  });
});

describe('filterActionsByOwner', () => {
  const actions = [
    createAction({ action_id: 'act_rec', owner_type: 'RECRUITER' }),
    createAction({ action_id: 'act_hm', owner_type: 'HIRING_MANAGER' }),
    createAction({ action_id: 'act_ops', owner_type: 'TA_OPS' })
  ];

  test('returns all actions when filter is ALL', () => {
    const result = filterActionsByOwner(actions, 'ALL');
    expect(result).toHaveLength(3);
  });

  test('filters to RECRUITER only', () => {
    const result = filterActionsByOwner(actions, 'RECRUITER');
    expect(result).toHaveLength(1);
    expect(result[0].owner_type).toBe('RECRUITER');
  });

  test('filters to HIRING_MANAGER only', () => {
    const result = filterActionsByOwner(actions, 'HIRING_MANAGER');
    expect(result).toHaveLength(1);
    expect(result[0].owner_type).toBe('HIRING_MANAGER');
  });

  test('filters to TA_OPS only', () => {
    const result = filterActionsByOwner(actions, 'TA_OPS');
    expect(result).toHaveLength(1);
    expect(result[0].owner_type).toBe('TA_OPS');
  });
});

describe('getOpenActions', () => {
  test('filters to only OPEN status actions', () => {
    const actions = [
      createAction({ action_id: 'act_open', status: 'OPEN' }),
      createAction({ action_id: 'act_done', status: 'DONE' }),
      createAction({ action_id: 'act_dismissed', status: 'DISMISSED' })
    ];

    const result = getOpenActions(actions);

    expect(result).toHaveLength(1);
    expect(result[0].action_id).toBe('act_open');
  });
});

describe('getActionCounts', () => {
  test('counts open actions by owner type', () => {
    const actions = [
      createAction({ action_id: 'act_rec1', owner_type: 'RECRUITER', status: 'OPEN' }),
      createAction({ action_id: 'act_rec2', owner_type: 'RECRUITER', status: 'OPEN' }),
      createAction({ action_id: 'act_hm', owner_type: 'HIRING_MANAGER', status: 'OPEN' }),
      createAction({ action_id: 'act_ops', owner_type: 'TA_OPS', status: 'OPEN' }),
      createAction({ action_id: 'act_done', owner_type: 'RECRUITER', status: 'DONE' }) // Should not count
    ];

    const result = getActionCounts(actions);

    expect(result.ALL).toBe(4);
    expect(result.RECRUITER).toBe(2);
    expect(result.HIRING_MANAGER).toBe(1);
    expect(result.TA_OPS).toBe(1);
  });
});

describe('generateUnifiedActionQueue', () => {
  test('combines HM and Explain actions', () => {
    const hmActions = [createHMAction()];
    const explanations = new Map<ExplainProviderId, Explanation>();
    explanations.set('stalled_reqs', createExplanation('stalled_reqs', [
      { action: 'Review stalled reqs', priority: 'medium', reason: 'Test' }
    ]));
    const requisitions = [createReq()];
    const users = [createUser()];

    const result = generateUnifiedActionQueue({
      hmActions,
      explanations,
      requisitions,
      users,
      datasetId: 'test_dataset'
    });

    // Should have both HM-generated and Explain-generated actions
    expect(result.length).toBeGreaterThan(0);
    // Should be sorted by priority
    for (let i = 1; i < result.length; i++) {
      const prevPriority = PRIORITY_ORDER[result[i-1].priority];
      const currPriority = PRIORITY_ORDER[result[i].priority];
      expect(prevPriority).toBeLessThanOrEqual(currPriority);
    }
  });

  test('returns empty array when no inputs', () => {
    const result = generateUnifiedActionQueue({
      hmActions: [],
      explanations: new Map(),
      requisitions: [],
      users: [],
      datasetId: 'test_dataset'
    });

    expect(result).toEqual([]);
  });
});
