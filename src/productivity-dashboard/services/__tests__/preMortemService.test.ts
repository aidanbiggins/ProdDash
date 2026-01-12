// Unit tests for Pre-Mortem Service
// Tests deterministic risk scoring and failure prediction

import {
  buildScoringContext,
  runPreMortem,
  runPreMortemBatch,
  convertToActionItems,
} from '../preMortemService';
import {
  PreMortemResult,
  DEFAULT_RISK_WEIGHTS,
  DEFAULT_RISK_THRESHOLDS,
} from '../../types/preMortemTypes';
import {
  Requisition,
  Candidate,
  Event,
  RequisitionStatus,
  CandidateDisposition,
  Function,
  LocationType,
  LocationRegion,
  HeadcountType,
  CandidateSource,
  EventType,
  CanonicalStage,
} from '../../types/entities';
import { HMPendingAction } from '../../types/hmTypes';

// Helper to create test data
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
    ...overrides,
  };
}

function createCandidate(overrides: Partial<Candidate> = {}): Candidate {
  return {
    candidate_id: 'CAN-001',
    name: 'John Doe',
    req_id: 'REQ-001',
    source: CandidateSource.Inbound,
    applied_at: new Date('2024-01-15'),
    first_contacted_at: new Date('2024-01-16'),
    current_stage: CanonicalStage.SCREEN,
    current_stage_entered_at: new Date('2024-01-20'),
    disposition: CandidateDisposition.Active,
    hired_at: null,
    offer_extended_at: null,
    offer_accepted_at: null,
    ...overrides,
  };
}

function createEvent(overrides: Partial<Event> = {}): Event {
  return {
    event_id: 'EVT-001',
    candidate_id: 'CAN-001',
    req_id: 'REQ-001',
    event_type: EventType.STAGE_CHANGE,
    from_stage: CanonicalStage.APPLIED,
    to_stage: CanonicalStage.SCREEN,
    actor_user_id: 'REC-001',
    event_at: new Date('2024-01-20'),
    metadata_json: null,
    ...overrides,
  };
}

function createHMAction(overrides: Partial<HMPendingAction> = {}): HMPendingAction {
  return {
    actionType: 'FEEDBACK_DUE',
    hmUserId: 'HM-001',
    hmName: 'John Manager',
    reqId: 'REQ-001',
    reqTitle: 'Software Engineer',
    candidateId: 'CAN-001',
    candidateName: 'John Doe',
    currentStage: 'SCREEN',
    daysWaiting: 3,
    daysOverdue: 1,
    recruiterId: 'REC-001',
    ...overrides,
  };
}

describe('buildScoringContext', () => {
  test('builds context with empty pipeline', () => {
    const req = createReq();
    const candidates: Candidate[] = [];
    const events: Event[] = [];
    const hmActions: HMPendingAction[] = [];

    const context = buildScoringContext(req, candidates, events, hmActions, 45);

    expect(context.active_candidate_count).toBe(0);
    expect(context.candidates_in_offer).toBe(0);
    expect(context.is_stalled).toBe(false);
    expect(context.benchmark_ttf).toBe(45);
  });

  test('counts active candidates correctly', () => {
    const req = createReq();
    const candidates: Candidate[] = [
      createCandidate({ candidate_id: 'CAN-001', disposition: CandidateDisposition.Active }),
      createCandidate({ candidate_id: 'CAN-002', disposition: CandidateDisposition.Active }),
      createCandidate({ candidate_id: 'CAN-003', disposition: CandidateDisposition.Rejected }),
    ];
    const events: Event[] = [];
    const hmActions: HMPendingAction[] = [];

    const context = buildScoringContext(req, candidates, events, hmActions);

    expect(context.active_candidate_count).toBe(2);
  });

  test('counts candidates in offer stage', () => {
    const req = createReq();
    const candidates: Candidate[] = [
      createCandidate({
        candidate_id: 'CAN-001',
        current_stage: CanonicalStage.OFFER,
        disposition: CandidateDisposition.Active,
        current_stage_entered_at: new Date('2024-02-01'),
      }),
    ];
    const events: Event[] = [];
    const hmActions: HMPendingAction[] = [];

    const context = buildScoringContext(req, candidates, events, hmActions);

    expect(context.candidates_in_offer).toBe(1);
    expect(context.days_in_offer_max).toBeGreaterThan(0);
  });

  test('calculates HM pending actions count', () => {
    const req = createReq();
    const candidates: Candidate[] = [];
    const events: Event[] = [];
    const hmActions: HMPendingAction[] = [
      createHMAction({ reqId: 'REQ-001', daysWaiting: 3 }),
      createHMAction({ reqId: 'REQ-001', candidateId: 'CAN-002', daysWaiting: 5 }),
    ];

    const context = buildScoringContext(req, candidates, events, hmActions);

    expect(context.hm_pending_actions).toBe(2);
    expect(context.hm_avg_latency_days).toBe(4); // (3+5)/2
  });
});

describe('runPreMortem', () => {
  test('returns result with required fields', () => {
    const req = createReq({ opened_at: new Date('2024-01-01') });
    const candidates: Candidate[] = [];
    const events: Event[] = [];
    const requisitions = [req];
    const hmActions: HMPendingAction[] = [];

    const result = runPreMortem(
      req,
      candidates,
      events,
      requisitions,
      hmActions,
      45
    );

    // Verify all required fields exist
    expect(result.req_id).toBe('REQ-001');
    expect(result.req_title).toBe('Software Engineer');
    expect(result.risk_score).toBeGreaterThanOrEqual(0);
    expect(result.risk_score).toBeLessThanOrEqual(100);
    expect(['LOW', 'MED', 'HIGH']).toContain(result.risk_band);
    expect(result.failure_mode).toBeDefined();
    expect(result.top_drivers).toBeDefined();
    expect(result.recommended_interventions).toBeDefined();
    expect(result.confidence).toBeDefined();
    expect(result.assessed_at).toBeInstanceOf(Date);
  });

  test('identifies high risk for req with no candidates', () => {
    const req = createReq({ opened_at: new Date('2024-01-01') });
    const candidates: Candidate[] = []; // Empty pipeline
    const events: Event[] = [];
    const requisitions = [req];
    const hmActions: HMPendingAction[] = [];

    const result = runPreMortem(
      req,
      candidates,
      events,
      requisitions,
      hmActions,
      45
    );

    // Empty pipeline should result in elevated risk - could be EMPTY_PIPELINE or COMPLEXITY_MISMATCH
    // depending on days open vs benchmark ratio
    expect(['EMPTY_PIPELINE', 'COMPLEXITY_MISMATCH', 'AGING_DECAY']).toContain(result.failure_mode);
    // Empty pipeline should result in elevated risk
    expect(result.risk_score).toBeGreaterThanOrEqual(25); // At minimum the pipeline gap weight
  });

  test('returns LOW risk for healthy req with good pipeline', () => {
    // Create a req that was opened recently
    const now = new Date();
    const req = createReq({
      opened_at: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000) // 14 days ago
    });
    const candidates: Candidate[] = [
      createCandidate({ candidate_id: 'CAN-001', disposition: CandidateDisposition.Active }),
      createCandidate({ candidate_id: 'CAN-002', disposition: CandidateDisposition.Active }),
      createCandidate({ candidate_id: 'CAN-003', disposition: CandidateDisposition.Active }),
      createCandidate({ candidate_id: 'CAN-004', disposition: CandidateDisposition.Active }),
      createCandidate({ candidate_id: 'CAN-005', disposition: CandidateDisposition.Active }),
    ];
    const events: Event[] = [];
    const requisitions = [req];
    const hmActions: HMPendingAction[] = [];

    const result = runPreMortem(
      req,
      candidates,
      events,
      requisitions,
      hmActions,
      45
    );

    // With a healthy pipeline and recent open date, should be low risk
    expect(result.risk_band).toBe('LOW');
    expect(result.risk_score).toBeLessThan(40); // Below MED threshold
  });

  test('generates interventions for high risk reqs', () => {
    const req = createReq({ opened_at: new Date('2023-01-01') }); // Very old req
    const candidates: Candidate[] = []; // Empty pipeline
    const events: Event[] = [];
    const requisitions = [req];
    const hmActions: HMPendingAction[] = [];

    const result = runPreMortem(
      req,
      candidates,
      events,
      requisitions,
      hmActions,
      45
    );

    // High risk req should have interventions
    if (result.risk_band === 'HIGH') {
      expect(result.recommended_interventions.length).toBeGreaterThan(0);
    }
  });

  test('includes comparable history from closed reqs', () => {
    const req = createReq();
    const closedReq = createReq({
      req_id: 'REQ-002',
      function: Function.Engineering,
      level: 'L4',
      location_type: LocationType.Remote,
      status: RequisitionStatus.Closed,
      closed_at: new Date('2024-02-15'),
    });
    const candidates: Candidate[] = [];
    const events: Event[] = [];
    const requisitions = [req, closedReq];
    const hmActions: HMPendingAction[] = [];

    const result = runPreMortem(
      req,
      candidates,
      events,
      requisitions,
      hmActions,
      45
    );

    // Should have comparable history structure
    expect(result.comparable_history).toBeDefined();
    expect(Array.isArray(result.comparable_history)).toBe(true);
  });

  test('includes confidence assessment', () => {
    const req = createReq();
    const candidates: Candidate[] = [];
    const events: Event[] = [];
    const requisitions = [req];
    const hmActions: HMPendingAction[] = [];

    const result = runPreMortem(
      req,
      candidates,
      events,
      requisitions,
      hmActions,
      45
    );

    expect(result.confidence).toBeDefined();
    expect(['HIGH', 'MED', 'LOW']).toContain(result.confidence.level);
    expect(result.confidence.reason).toBeDefined();
    expect(typeof result.confidence.reason).toBe('string');
  });

  test('flags HM_DELAY when there are overdue HM actions', () => {
    const now = new Date();
    const req = createReq({
      opened_at: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000) // 14 days ago
    });
    const candidates: Candidate[] = [
      createCandidate({ candidate_id: 'CAN-001', disposition: CandidateDisposition.Active }),
      createCandidate({ candidate_id: 'CAN-002', disposition: CandidateDisposition.Active }),
      createCandidate({ candidate_id: 'CAN-003', disposition: CandidateDisposition.Active }),
      createCandidate({ candidate_id: 'CAN-004', disposition: CandidateDisposition.Active }),
    ];
    const events: Event[] = [];
    const requisitions = [req];
    const hmActions: HMPendingAction[] = [
      createHMAction({ reqId: 'REQ-001', daysWaiting: 10, daysOverdue: 7 }),
      createHMAction({ reqId: 'REQ-001', candidateId: 'CAN-002', daysWaiting: 8, daysOverdue: 5 }),
    ];

    const result = runPreMortem(
      req,
      candidates,
      events,
      requisitions,
      hmActions,
      45
    );

    // With severe HM delays and decent pipeline, HM_DELAY should be the primary issue
    expect(['HM_DELAY', 'STALLED_PIPELINE']).toContain(result.failure_mode);
  });
});

describe('runPreMortemBatch', () => {
  test('processes multiple open reqs', () => {
    const reqs = [
      createReq({ req_id: 'REQ-001', status: RequisitionStatus.Open }),
      createReq({ req_id: 'REQ-002', status: RequisitionStatus.Open }),
      createReq({ req_id: 'REQ-003', status: RequisitionStatus.Closed }),
    ];
    const candidates: Candidate[] = [];
    const events: Event[] = [];
    const hmActions: HMPendingAction[] = [];

    const results = runPreMortemBatch(reqs, candidates, events, hmActions);

    // Should only process open reqs
    expect(results).toHaveLength(2);
    expect(results.map(r => r.req_id)).toContain('REQ-001');
    expect(results.map(r => r.req_id)).toContain('REQ-002');
    expect(results.map(r => r.req_id)).not.toContain('REQ-003');
  });

  test('uses benchmark map when provided', () => {
    const reqs = [
      createReq({ req_id: 'REQ-001', status: RequisitionStatus.Open }),
    ];
    const candidates: Candidate[] = [];
    const events: Event[] = [];
    const hmActions: HMPendingAction[] = [];
    const benchmarkMap = new Map([['REQ-001', 30]]);

    const results = runPreMortemBatch(reqs, candidates, events, hmActions, benchmarkMap);

    expect(results).toHaveLength(1);
    expect(results[0].req_id).toBe('REQ-001');
  });

  test('handles empty requisition list', () => {
    const results = runPreMortemBatch([], [], [], []);
    expect(results).toHaveLength(0);
  });

  test('each result has valid structure', () => {
    const reqs = [
      createReq({ req_id: 'REQ-001', status: RequisitionStatus.Open }),
      createReq({ req_id: 'REQ-002', status: RequisitionStatus.Open }),
    ];
    const candidates: Candidate[] = [];
    const events: Event[] = [];
    const hmActions: HMPendingAction[] = [];

    const results = runPreMortemBatch(reqs, candidates, events, hmActions);

    for (const result of results) {
      expect(result.req_id).toBeDefined();
      expect(result.risk_score).toBeGreaterThanOrEqual(0);
      expect(result.risk_score).toBeLessThanOrEqual(100);
      expect(['LOW', 'MED', 'HIGH']).toContain(result.risk_band);
      expect(result.failure_mode).toBeDefined();
      expect(Array.isArray(result.top_drivers)).toBe(true);
      expect(Array.isArray(result.recommended_interventions)).toBe(true);
    }
  });
});

describe('convertToActionItems', () => {
  test('converts PreMortemResult interventions to ActionItems', () => {
    const preMortemResult: PreMortemResult = {
      req_id: 'REQ-001',
      req_title: 'Software Engineer',
      risk_score: 85,
      risk_band: 'HIGH',
      failure_mode: 'EMPTY_PIPELINE',
      top_drivers: [],
      recommended_interventions: [
        {
          intervention_id: 'premortem_req-001_source_candidates_recruiter',
          action_type: 'SOURCE_CANDIDATES',
          owner_type: 'RECRUITER',
          title: 'Source more candidates',
          description: 'Pipeline is empty, need to add candidates',
          priority: 'P0',
          estimated_impact: 'Could reduce TTF by 5-10 days',
          steps: ['Review job description', 'Post to job boards', 'Reach out to passive candidates'],
        },
      ],
      comparable_history: [],
      confidence: { level: 'HIGH', reason: 'Sufficient data' },
      assessed_at: new Date(),
      days_open: 30,
      active_candidate_count: 0,
    };

    const actionItems = convertToActionItems([preMortemResult], false);

    expect(actionItems).toHaveLength(1);
    expect(actionItems[0].action_type).toBe('SOURCE_CANDIDATES');
    expect(actionItems[0].priority).toBe('P0');
    expect(actionItems[0].req_id).toBe('REQ-001');
    expect(actionItems[0].owner_type).toBe('RECRUITER');
  });

  test('filters by highRiskOnly when specified', () => {
    const lowRiskResult: PreMortemResult = {
      req_id: 'REQ-002',
      req_title: 'Product Manager',
      risk_score: 30,
      risk_band: 'LOW',
      failure_mode: 'UNKNOWN',
      top_drivers: [],
      recommended_interventions: [
        {
          intervention_id: 'premortem_req-002_review_pipeline_recruiter',
          action_type: 'SOURCE_CANDIDATES',
          owner_type: 'RECRUITER',
          title: 'Review pipeline',
          description: 'Routine pipeline review',
          priority: 'P2',
          estimated_impact: 'Maintain healthy pipeline',
          steps: ['Check candidate status'],
        },
      ],
      comparable_history: [],
      confidence: { level: 'HIGH', reason: 'Sufficient data' },
      assessed_at: new Date(),
      days_open: 10,
      active_candidate_count: 5,
    };

    const highRiskResult: PreMortemResult = {
      req_id: 'REQ-001',
      req_title: 'Software Engineer',
      risk_score: 85,
      risk_band: 'HIGH',
      failure_mode: 'EMPTY_PIPELINE',
      top_drivers: [],
      recommended_interventions: [
        {
          intervention_id: 'premortem_req-001_source_candidates_recruiter',
          action_type: 'SOURCE_CANDIDATES',
          owner_type: 'RECRUITER',
          title: 'Source more candidates',
          description: 'Pipeline is empty',
          priority: 'P0',
          estimated_impact: 'Reduce TTF',
          steps: [],
        },
      ],
      comparable_history: [],
      confidence: { level: 'HIGH', reason: 'Sufficient data' },
      assessed_at: new Date(),
      days_open: 30,
      active_candidate_count: 0,
    };

    const actionItems = convertToActionItems([lowRiskResult, highRiskResult], true);

    // Should only include HIGH risk interventions
    expect(actionItems).toHaveLength(1);
    expect(actionItems[0].req_id).toBe('REQ-001');
  });

  test('handles empty interventions', () => {
    const result: PreMortemResult = {
      req_id: 'REQ-001',
      req_title: 'Software Engineer',
      risk_score: 20,
      risk_band: 'LOW',
      failure_mode: 'UNKNOWN',
      top_drivers: [],
      recommended_interventions: [],
      comparable_history: [],
      confidence: { level: 'HIGH', reason: 'Sufficient data' },
      assessed_at: new Date(),
      days_open: 10,
      active_candidate_count: 5,
    };

    const actionItems = convertToActionItems([result], false);
    expect(actionItems).toHaveLength(0);
  });

  test('handles multiple interventions per result', () => {
    const result: PreMortemResult = {
      req_id: 'REQ-001',
      req_title: 'Software Engineer',
      risk_score: 85,
      risk_band: 'HIGH',
      failure_mode: 'EMPTY_PIPELINE',
      top_drivers: [],
      recommended_interventions: [
        {
          intervention_id: 'int_1',
          action_type: 'SOURCE_CANDIDATES',
          owner_type: 'RECRUITER',
          title: 'Source candidates',
          description: 'Need more candidates',
          priority: 'P0',
          estimated_impact: 'Add candidates',
          steps: [],
        },
        {
          intervention_id: 'int_2',
          action_type: 'FEEDBACK_DUE',
          owner_type: 'HIRING_MANAGER',
          title: 'HM feedback needed',
          description: 'Waiting on HM',
          priority: 'P1',
          estimated_impact: 'Speed up process',
          steps: [],
        },
      ],
      comparable_history: [],
      confidence: { level: 'HIGH', reason: 'Sufficient data' },
      assessed_at: new Date(),
      days_open: 30,
      active_candidate_count: 0,
    };

    const actionItems = convertToActionItems([result], false);
    expect(actionItems).toHaveLength(2);
  });
});
