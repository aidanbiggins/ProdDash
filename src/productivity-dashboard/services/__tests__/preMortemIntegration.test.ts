// Pre-Mortem Integration Tests
// Tests for risk banding and forecasting integration

import {
  runPreMortemBatch,
  convertToActionItems,
} from '../preMortemService';
import {
  PreMortemResult,
  scoreToRiskBand,
  getFailureModeLabel,
  getRiskBandColor,
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

describe('Pre-Mortem Risk Banding', () => {
  describe('scoreToRiskBand', () => {
    test('returns HIGH for scores >= 70', () => {
      expect(scoreToRiskBand(70)).toBe('HIGH');
      expect(scoreToRiskBand(85)).toBe('HIGH');
      expect(scoreToRiskBand(100)).toBe('HIGH');
    });

    test('returns MED for scores between 40 and 69', () => {
      expect(scoreToRiskBand(40)).toBe('MED');
      expect(scoreToRiskBand(55)).toBe('MED');
      expect(scoreToRiskBand(69)).toBe('MED');
    });

    test('returns LOW for scores < 40', () => {
      expect(scoreToRiskBand(0)).toBe('LOW');
      expect(scoreToRiskBand(20)).toBe('LOW');
      expect(scoreToRiskBand(39)).toBe('LOW');
    });
  });

  describe('getFailureModeLabel', () => {
    test('returns correct labels for all failure modes', () => {
      expect(getFailureModeLabel('EMPTY_PIPELINE')).toBe('Empty Pipeline');
      expect(getFailureModeLabel('HM_DELAY')).toBe('HM Bottleneck');
      expect(getFailureModeLabel('OFFER_RISK')).toBe('Offer at Risk');
      expect(getFailureModeLabel('COMPLEXITY_MISMATCH')).toBe('Complexity Issue');
      expect(getFailureModeLabel('AGING_DECAY')).toBe('Age Decay');
      expect(getFailureModeLabel('STALLED_PIPELINE')).toBe('Stalled Pipeline');
      expect(getFailureModeLabel('UNKNOWN')).toBe('Unknown Risk');
    });
  });

  describe('getRiskBandColor', () => {
    test('returns correct colors for each band', () => {
      expect(getRiskBandColor('HIGH')).toBe('#ef4444');
      expect(getRiskBandColor('MED')).toBe('#f59e0b');
      expect(getRiskBandColor('LOW')).toBe('#22c55e');
    });
  });
});

describe('Pre-Mortem Batch Processing for Forecasting', () => {
  test('processes set of open reqs and returns risk data for each', () => {
    const reqs = [
      createReq({ req_id: 'REQ-001', status: RequisitionStatus.Open }),
      createReq({ req_id: 'REQ-002', status: RequisitionStatus.Open }),
      createReq({ req_id: 'REQ-003', status: RequisitionStatus.Open }),
    ];
    const candidates: Candidate[] = [];
    const events: Event[] = [];
    const hmActions: HMPendingAction[] = [];

    const results = runPreMortemBatch(reqs, candidates, events, hmActions);

    // Should have result for each open req
    expect(results).toHaveLength(3);

    // Each result should have valid risk band
    for (const result of results) {
      expect(['LOW', 'MED', 'HIGH']).toContain(result.risk_band);
    }
  });

  test('computes risk bands consistently for identical inputs', () => {
    const reqs = [createReq({ req_id: 'REQ-001', status: RequisitionStatus.Open })];
    const candidates: Candidate[] = [];
    const events: Event[] = [];
    const hmActions: HMPendingAction[] = [];

    // Run twice - should get same results (deterministic)
    const results1 = runPreMortemBatch(reqs, candidates, events, hmActions);
    const results2 = runPreMortemBatch(reqs, candidates, events, hmActions);

    expect(results1[0].risk_score).toBe(results2[0].risk_score);
    expect(results1[0].risk_band).toBe(results2[0].risk_band);
    expect(results1[0].failure_mode).toBe(results2[0].failure_mode);
  });

  test('skips closed reqs', () => {
    const reqs = [
      createReq({ req_id: 'REQ-001', status: RequisitionStatus.Open }),
      createReq({ req_id: 'REQ-002', status: RequisitionStatus.Closed }),
    ];
    const candidates: Candidate[] = [];
    const events: Event[] = [];
    const hmActions: HMPendingAction[] = [];

    const results = runPreMortemBatch(reqs, candidates, events, hmActions);

    expect(results).toHaveLength(1);
    expect(results[0].req_id).toBe('REQ-001');
  });

  test('can create a lookup map by req_id for UI integration', () => {
    const reqs = [
      createReq({ req_id: 'REQ-001', status: RequisitionStatus.Open }),
      createReq({ req_id: 'REQ-002', status: RequisitionStatus.Open }),
    ];
    const candidates: Candidate[] = [];
    const events: Event[] = [];
    const hmActions: HMPendingAction[] = [];

    const results = runPreMortemBatch(reqs, candidates, events, hmActions);

    // Create map like ForecastingTab does
    const map = new Map<string, PreMortemResult>();
    results.forEach(pm => map.set(pm.req_id, pm));

    expect(map.get('REQ-001')).toBeDefined();
    expect(map.get('REQ-002')).toBeDefined();
    expect(map.get('REQ-001')?.req_id).toBe('REQ-001');
    expect(map.get('REQ-002')?.req_id).toBe('REQ-002');
  });
});

describe('Pre-Mortem to Action Queue Integration', () => {
  test('converts high risk pre-mortems to action items', () => {
    const highRiskResult: PreMortemResult = {
      req_id: 'REQ-001',
      req_title: 'Software Engineer',
      risk_score: 85,
      risk_band: 'HIGH',
      failure_mode: 'EMPTY_PIPELINE',
      top_drivers: [
        {
          driver_key: 'pipeline_gap',
          description: 'No active candidates',
          severity: 'critical',
          weight: 25,
          evidence: {
            metric_key: 'pipeline_health',
            actual_value: 0,
            benchmark_value: 5,
            variance: -100,
            unit: 'candidates',
            description: 'No active candidates',
          },
        },
      ],
      recommended_interventions: [
        {
          intervention_id: 'premortem_req-001_source_candidates_recruiter',
          action_type: 'SOURCE_CANDIDATES',
          owner_type: 'RECRUITER',
          title: 'Emergency Pipeline Sourcing',
          description: 'Pipeline is critically thin or empty.',
          priority: 'P0',
          estimated_impact: 'Could add 3-5 candidates within 1 week',
          steps: ['Review job posting', 'Activate sourcing channels'],
        },
      ],
      comparable_history: [],
      confidence: { level: 'HIGH', reason: 'Sufficient data' },
      assessed_at: new Date(),
      days_open: 60,
      active_candidate_count: 0,
    };

    const actions = convertToActionItems([highRiskResult], false);

    expect(actions.length).toBe(1);
    expect(actions[0].action_type).toBe('SOURCE_CANDIDATES');
    expect(actions[0].owner_type).toBe('RECRUITER');
    expect(actions[0].req_id).toBe('REQ-001');
    expect(actions[0].priority).toBe('P0');
    expect(actions[0].evidence?.short_reason).toContain('Risk Score: 85');
  });

  test('deduplication by action_id works across multiple results', () => {
    const result1: PreMortemResult = {
      req_id: 'REQ-001',
      req_title: 'Software Engineer',
      risk_score: 85,
      risk_band: 'HIGH',
      failure_mode: 'EMPTY_PIPELINE',
      top_drivers: [],
      recommended_interventions: [
        {
          intervention_id: 'int_001',
          action_type: 'SOURCE_CANDIDATES',
          owner_type: 'RECRUITER',
          title: 'Source candidates',
          description: 'Need candidates',
          priority: 'P0',
          estimated_impact: 'Impact',
          steps: [],
        },
      ],
      comparable_history: [],
      confidence: { level: 'HIGH', reason: 'Data' },
      assessed_at: new Date(),
      days_open: 60,
      active_candidate_count: 0,
    };

    const result2: PreMortemResult = {
      req_id: 'REQ-002',
      req_title: 'Product Manager',
      risk_score: 75,
      risk_band: 'HIGH',
      failure_mode: 'HM_DELAY',
      top_drivers: [],
      recommended_interventions: [
        {
          intervention_id: 'int_002',
          action_type: 'FEEDBACK_DUE',
          owner_type: 'HIRING_MANAGER',
          title: 'HM Response Needed',
          description: 'HM overdue',
          priority: 'P1',
          estimated_impact: 'Impact',
          steps: [],
        },
      ],
      comparable_history: [],
      confidence: { level: 'HIGH', reason: 'Data' },
      assessed_at: new Date(),
      days_open: 45,
      active_candidate_count: 3,
    };

    const actions = convertToActionItems([result1, result2], false);

    // Should have 2 unique actions
    expect(actions.length).toBe(2);
    const actionIds = new Set(actions.map(a => a.action_id));
    expect(actionIds.size).toBe(2);
  });
});

describe('Risk Summary Calculation', () => {
  test('can compute risk band counts from batch results', () => {
    // Simulate various risk levels
    const reqs = [
      createReq({ req_id: 'REQ-001', status: RequisitionStatus.Open, opened_at: new Date('2023-01-01') }), // Old, should be high risk
      createReq({
        req_id: 'REQ-002',
        status: RequisitionStatus.Open,
        opened_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      }), // Recent
      createReq({
        req_id: 'REQ-003',
        status: RequisitionStatus.Open,
        opened_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      }), // Recent
    ];
    const candidates: Candidate[] = [
      // Add candidates to REQ-002 and REQ-003 to make them lower risk
      createCandidate({ req_id: 'REQ-002', candidate_id: 'CAN-001', disposition: CandidateDisposition.Active }),
      createCandidate({ req_id: 'REQ-002', candidate_id: 'CAN-002', disposition: CandidateDisposition.Active }),
      createCandidate({ req_id: 'REQ-002', candidate_id: 'CAN-003', disposition: CandidateDisposition.Active }),
      createCandidate({ req_id: 'REQ-002', candidate_id: 'CAN-004', disposition: CandidateDisposition.Active }),
      createCandidate({ req_id: 'REQ-002', candidate_id: 'CAN-005', disposition: CandidateDisposition.Active }),
      createCandidate({ req_id: 'REQ-003', candidate_id: 'CAN-011', disposition: CandidateDisposition.Active }),
      createCandidate({ req_id: 'REQ-003', candidate_id: 'CAN-012', disposition: CandidateDisposition.Active }),
      createCandidate({ req_id: 'REQ-003', candidate_id: 'CAN-013', disposition: CandidateDisposition.Active }),
      createCandidate({ req_id: 'REQ-003', candidate_id: 'CAN-014', disposition: CandidateDisposition.Active }),
      createCandidate({ req_id: 'REQ-003', candidate_id: 'CAN-015', disposition: CandidateDisposition.Active }),
    ];
    const events: Event[] = [];
    const hmActions: HMPendingAction[] = [];

    const results = runPreMortemBatch(reqs, candidates, events, hmActions);

    // Calculate risk summary like ForecastingTab does
    const riskSummary = {
      high: results.filter(r => r.risk_band === 'HIGH').length,
      med: results.filter(r => r.risk_band === 'MED').length,
      low: results.filter(r => r.risk_band === 'LOW').length,
    };

    // Verify counts add up
    expect(riskSummary.high + riskSummary.med + riskSummary.low).toBe(3);

    // REQ-001 (old, empty pipeline) should be HIGH risk
    const req001Result = results.find(r => r.req_id === 'REQ-001');
    expect(req001Result?.risk_band).toBe('HIGH');

    // REQ-002 and REQ-003 (recent, healthy pipeline) should be LOW risk
    const req002Result = results.find(r => r.req_id === 'REQ-002');
    const req003Result = results.find(r => r.req_id === 'REQ-003');
    expect(req002Result?.risk_band).toBe('LOW');
    expect(req003Result?.risk_band).toBe('LOW');
  });
});
