// Unit tests for Ask Fact Pack Service
// Tests Fact Pack building, anonymization, and KPI calculations

import {
  buildSimpleFactPack,
  buildAnonymizationMaps,
  redactReqTitle,
  resolveKeyPath,
  checkFactPackForPII,
} from '../askFactPackService';
import {
  Requisition,
  Candidate,
  User,
  RequisitionStatus,
  CandidateDisposition,
  CanonicalStage,
  Function,
  LocationType,
  LocationRegion,
  HeadcountType,
  UserRole,
} from '../../types/entities';
import { AskFactPack } from '../../types/askTypes';

// ─────────────────────────────────────────────────────────────
// Test Fixtures
// ─────────────────────────────────────────────────────────────

function createRequisition(overrides: Partial<Requisition> = {}): Requisition {
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
    req_id: 'REQ-001',
    name: 'Test Candidate',
    email: 'test@example.com',
    phone: null,
    source: 'LinkedIn',
    applied_at: new Date('2024-01-15'),
    hired_at: null,
    current_stage: CanonicalStage.SCREEN,
    current_stage_entered_at: new Date('2024-01-16'),
    disposition: CandidateDisposition.Active,
    recruiter_id: 'REC-001',
    first_contacted_at: null,
    offer_extended_at: null,
    rejected_at: null,
    withdrawn_at: null,
    ...overrides,
  };
}

function createUser(overrides: Partial<User> = {}): User {
  return {
    user_id: 'REC-001',
    name: 'Jane Recruiter',
    role: UserRole.Recruiter,
    team: 'TA Team',
    manager_user_id: null,
    email: 'jane@company.com',
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────
// Anonymization Tests
// ─────────────────────────────────────────────────────────────

describe('buildAnonymizationMaps', () => {
  it('should create sequential recruiter labels', () => {
    const users = [
      createUser({ user_id: 'REC-001', name: 'Alice' }),
      createUser({ user_id: 'REC-002', name: 'Bob' }),
    ];
    const reqs: Requisition[] = [];

    const maps = buildAnonymizationMaps(users, reqs);

    expect(maps.recruiters.get('REC-001')).toBe('Recruiter 1');
    expect(maps.recruiters.get('REC-002')).toBe('Recruiter 2');
  });

  it('should create sequential manager labels from requisitions', () => {
    const users: User[] = [];
    const reqs = [
      createRequisition({ req_id: 'REQ-001', hiring_manager_id: 'HM-001' }),
      createRequisition({ req_id: 'REQ-002', hiring_manager_id: 'HM-002' }),
      createRequisition({ req_id: 'REQ-003', hiring_manager_id: 'HM-001' }), // Duplicate
    ];

    const maps = buildAnonymizationMaps(users, reqs);

    expect(maps.hms.get('HM-001')).toBe('Manager 1');
    expect(maps.hms.get('HM-002')).toBe('Manager 2');
  });

  it('should build reverse mapping', () => {
    const users = [createUser({ user_id: 'REC-001' })];
    const reqs = [createRequisition({ hiring_manager_id: 'HM-001' })];

    const maps = buildAnonymizationMaps(users, reqs);

    expect(maps.reverse.get('Recruiter 1')).toBe('REC-001');
    expect(maps.reverse.get('Manager 1')).toBe('HM-001');
  });

  it('should produce deterministic output regardless of input order', () => {
    const users = [
      createUser({ user_id: 'REC-002' }),
      createUser({ user_id: 'REC-001' }),
    ];
    const reqs: Requisition[] = [];

    const maps = buildAnonymizationMaps(users, reqs);

    // Should sort by ID, so REC-001 gets Recruiter 1
    expect(maps.recruiters.get('REC-001')).toBe('Recruiter 1');
    expect(maps.recruiters.get('REC-002')).toBe('Recruiter 2');
  });
});

describe('redactReqTitle', () => {
  it('should remove possessive names', () => {
    expect(redactReqTitle("John's Team Lead")).toBe('Team Lead');
    expect(redactReqTitle("Sarah's Assistant")).toBe('Assistant');
  });

  it('should remove "for [Name]" patterns', () => {
    expect(redactReqTitle('Engineer for John')).toBe('Engineer');
    expect(redactReqTitle('PM for Sarah')).toBe('PM');
  });

  it('should handle team name patterns', () => {
    expect(redactReqTitle("Mike's Team Engineer")).toBe('Team Engineer');
  });

  it('should clean up extra whitespace', () => {
    expect(redactReqTitle('Senior   Engineer')).toBe('Senior Engineer');
    expect(redactReqTitle('  Lead  ')).toBe('Lead');
  });

  it('should handle empty and null-like inputs', () => {
    expect(redactReqTitle('')).toBe('');
    expect(redactReqTitle('   ')).toBe('');
  });

  it('should preserve normal titles', () => {
    expect(redactReqTitle('Software Engineer')).toBe('Software Engineer');
    expect(redactReqTitle('Product Manager')).toBe('Product Manager');
  });
});

// ─────────────────────────────────────────────────────────────
// Fact Pack Building Tests
// ─────────────────────────────────────────────────────────────

describe('buildSimpleFactPack', () => {
  it('should build a valid Fact Pack from minimal data', () => {
    const factPack = buildSimpleFactPack({
      requisitions: [],
      candidates: [],
      events: [],
      users: [],
      aiEnabled: false,
      dataHealthScore: 100,
    });

    expect(factPack).toBeDefined();
    expect(factPack.meta).toBeDefined();
    expect(factPack.control_tower).toBeDefined();
    expect(factPack.explain).toBeDefined();
    expect(factPack.actions).toBeDefined();
    expect(factPack.risks).toBeDefined();
    expect(factPack.forecast).toBeDefined();
    expect(factPack.velocity).toBeDefined();
    expect(factPack.sources).toBeDefined();
    expect(factPack.capacity).toBeDefined();
    expect(factPack.glossary).toBeDefined();
  });

  it('should correctly populate sample sizes', () => {
    const factPack = buildSimpleFactPack({
      requisitions: [createRequisition(), createRequisition({ req_id: 'REQ-002' })],
      candidates: [
        createCandidate(),
        createCandidate({ candidate_id: 'CAN-002' }),
        createCandidate({ candidate_id: 'CAN-003', disposition: CandidateDisposition.Hired, hired_at: new Date() }),
      ],
      events: [{}, {}, {}] as any[],
      users: [createUser()],
      aiEnabled: true,
      dataHealthScore: 85,
    });

    expect(factPack.meta.sample_sizes.total_reqs).toBe(2);
    expect(factPack.meta.sample_sizes.total_candidates).toBe(3);
    expect(factPack.meta.sample_sizes.total_hires).toBe(1);
    expect(factPack.meta.sample_sizes.total_events).toBe(3);
  });

  it('should calculate stalled reqs correctly', () => {
    const now = new Date();
    const fifteenDaysAgo = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000);

    const factPack = buildSimpleFactPack({
      requisitions: [
        createRequisition({ req_id: 'REQ-001', status: RequisitionStatus.Open }),
        createRequisition({ req_id: 'REQ-002', status: RequisitionStatus.Open }),
      ],
      candidates: [
        createCandidate({ req_id: 'REQ-001', current_stage_entered_at: fifteenDaysAgo }),
        createCandidate({ req_id: 'REQ-002', current_stage_entered_at: now }),
      ],
      events: [],
      users: [],
      aiEnabled: false,
      dataHealthScore: 80,
    });

    // REQ-001 should be stalled (15 days), REQ-002 should be active (0 days)
    expect(factPack.control_tower.kpis.stalled_reqs.value).toBe(1);
  });

  it('should set capability flags correctly', () => {
    const factPack = buildSimpleFactPack({
      requisitions: [],
      candidates: [createCandidate({ source: 'Referral' })],
      events: [{ from_stage: 'APPLIED', to_stage: 'SCREEN' }] as any[],
      users: [],
      aiEnabled: true,
      dataHealthScore: 90,
    });

    expect(factPack.meta.capability_flags.ai_enabled).toBe(true);
    expect(factPack.meta.capability_flags.has_source_data).toBe(true);
    expect(factPack.meta.capability_flags.has_stage_timing).toBe(true);
  });

  it('should include glossary definitions', () => {
    const factPack = buildSimpleFactPack({
      requisitions: [],
      candidates: [],
      events: [],
      users: [],
      aiEnabled: false,
      dataHealthScore: 100,
    });

    expect(factPack.glossary.length).toBeGreaterThan(0);
    expect(factPack.glossary.some(g => g.term === 'TTF')).toBe(true);
    expect(factPack.glossary.some(g => g.term === 'HM Latency')).toBe(true);
  });

  it('should build source data from candidates', () => {
    const factPack = buildSimpleFactPack({
      requisitions: [],
      candidates: [
        createCandidate({ source: 'LinkedIn' }),
        createCandidate({ candidate_id: 'CAN-002', source: 'LinkedIn' }),
        createCandidate({ candidate_id: 'CAN-003', source: 'Referral' }),
        createCandidate({
          candidate_id: 'CAN-004',
          source: 'LinkedIn',
          disposition: CandidateDisposition.Hired,
          hired_at: new Date(),
        }),
      ],
      events: [],
      users: [],
      aiEnabled: false,
      dataHealthScore: 100,
    });

    expect(factPack.sources.total_sources).toBe(2);
    expect(factPack.sources.top_by_volume.length).toBeGreaterThan(0);
    expect(factPack.sources.top_by_volume[0].source_name).toBe('LinkedIn');
    expect(factPack.sources.top_by_volume[0].candidate_count).toBe(3);
  });

  it('should build capacity data from users and requisitions', () => {
    const factPack = buildSimpleFactPack({
      requisitions: [
        createRequisition({ req_id: 'REQ-001', recruiter_id: 'REC-001' }),
        createRequisition({ req_id: 'REQ-002', recruiter_id: 'REC-001' }),
        createRequisition({ req_id: 'REQ-003', recruiter_id: 'REC-002' }),
      ],
      candidates: [],
      events: [],
      users: [
        createUser({ user_id: 'REC-001' }),
        createUser({ user_id: 'REC-002' }),
      ],
      aiEnabled: false,
      dataHealthScore: 100,
    });

    expect(factPack.capacity.total_recruiters).toBe(2);
    expect(factPack.capacity.avg_req_load).toBe(1.5); // 3 reqs / 2 recruiters
  });
});

// ─────────────────────────────────────────────────────────────
// Key Path Resolution Tests
// ─────────────────────────────────────────────────────────────

describe('resolveKeyPath', () => {
  const testObj = {
    control_tower: {
      kpis: {
        median_ttf: { value: 42, unit: 'days' },
        stalled_reqs: { value: 5 },
      },
    },
    risks: {
      top_risks: [
        { risk_id: 'r1', req_title: 'Risk 1' },
        { risk_id: 'r2', req_title: 'Risk 2' },
      ],
    },
    actions: {
      top_p0: [
        { action_id: 'a1', title: 'Action 1' },
      ],
    },
  };

  it('should resolve simple paths', () => {
    expect(resolveKeyPath(testObj, 'control_tower.kpis.median_ttf.value')).toBe(42);
    expect(resolveKeyPath(testObj, 'control_tower.kpis.stalled_reqs.value')).toBe(5);
  });

  it('should resolve nested object paths', () => {
    expect(resolveKeyPath(testObj, 'control_tower.kpis.median_ttf')).toEqual({ value: 42, unit: 'days' });
  });

  it('should resolve array indices', () => {
    expect(resolveKeyPath(testObj, 'risks.top_risks[0].req_title')).toBe('Risk 1');
    expect(resolveKeyPath(testObj, 'risks.top_risks[1].req_title')).toBe('Risk 2');
    expect(resolveKeyPath(testObj, 'actions.top_p0[0].title')).toBe('Action 1');
  });

  it('should return undefined for invalid paths', () => {
    expect(resolveKeyPath(testObj, 'invalid.path')).toBeUndefined();
    expect(resolveKeyPath(testObj, 'control_tower.kpis.invalid')).toBeUndefined();
    expect(resolveKeyPath(testObj, 'risks.top_risks[99]')).toBeUndefined();
  });

  it('should handle null-like values', () => {
    expect(resolveKeyPath(null, 'any.path')).toBeUndefined();
    expect(resolveKeyPath(undefined, 'any.path')).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────
// PII Check Tests
// ─────────────────────────────────────────────────────────────

describe('checkFactPackForPII', () => {
  it('should detect email addresses', () => {
    const factPack = {
      meta: { org_name: 'test@company.com' },
    } as unknown as AskFactPack;

    const violations = checkFactPackForPII(factPack);
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0]).toContain('email');
  });

  it('should detect phone numbers', () => {
    const factPack = {
      meta: { org_name: '555-123-4567' },
    } as unknown as AskFactPack;

    const violations = checkFactPackForPII(factPack);
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0]).toContain('phone');
  });

  it('should detect non-anonymized owner labels', () => {
    const factPack = {
      actions: {
        top_p0: [{ owner_label: 'John Smith' }],
      },
    } as unknown as AskFactPack;

    const violations = checkFactPackForPII(factPack);
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0]).toContain('non-anonymized');
  });

  it('should accept properly anonymized data', () => {
    const factPack = {
      meta: { org_name: 'Organization' },
      actions: {
        top_p0: [{ owner_label: 'Recruiter 1' }],
        top_p1: [{ owner_label: 'Manager 2' }],
      },
    } as unknown as AskFactPack;

    const violations = checkFactPackForPII(factPack);
    expect(violations.length).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────
// KPI Calculation Tests
// ─────────────────────────────────────────────────────────────

describe('KPI Calculations', () => {
  it('should calculate median TTF correctly', () => {
    const candidates = [
      createCandidate({
        candidate_id: 'CAN-001',
        disposition: CandidateDisposition.Hired,
        hired_at: new Date('2024-02-15'),
      }),
      createCandidate({
        candidate_id: 'CAN-002',
        disposition: CandidateDisposition.Hired,
        hired_at: new Date('2024-03-01'),
      }),
      createCandidate({
        candidate_id: 'CAN-003',
        disposition: CandidateDisposition.Hired,
        hired_at: new Date('2024-02-20'),
      }),
    ];

    const requisitions = [
      createRequisition({ req_id: 'REQ-001', opened_at: new Date('2024-01-01') }),
    ];

    const factPack = buildSimpleFactPack({
      requisitions,
      candidates,
      events: [],
      users: [],
      aiEnabled: false,
      dataHealthScore: 100,
    });

    // TTFs: 45, 59, 50 days -> median = 50
    expect(factPack.control_tower.kpis.median_ttf.value).toBe(50);
    expect(factPack.control_tower.kpis.median_ttf.n).toBe(3);
  });

  it('should handle empty TTF data', () => {
    const factPack = buildSimpleFactPack({
      requisitions: [createRequisition()],
      candidates: [createCandidate({ disposition: CandidateDisposition.Active })],
      events: [],
      users: [],
      aiEnabled: false,
      dataHealthScore: 100,
    });

    expect(factPack.control_tower.kpis.median_ttf.value).toBeNull();
    expect(factPack.control_tower.kpis.median_ttf.n).toBe(0);
  });

  it('should calculate accept rate correctly', () => {
    const candidates = [
      createCandidate({ candidate_id: 'CAN-001', disposition: CandidateDisposition.Hired, hired_at: new Date() }),
      createCandidate({ candidate_id: 'CAN-002', disposition: CandidateDisposition.Hired, hired_at: new Date() }),
      createCandidate({ candidate_id: 'CAN-003', disposition: CandidateDisposition.Hired, hired_at: new Date() }),
      createCandidate({ candidate_id: 'CAN-004', disposition: CandidateDisposition.Hired, hired_at: new Date() }),
    ];

    const factPack = buildSimpleFactPack({
      requisitions: [],
      candidates,
      events: [],
      users: [],
      aiEnabled: false,
      dataHealthScore: 100,
    });

    expect(factPack.control_tower.kpis.accept_rate.value).toBe(100);
  });

  it('should set KPI status based on thresholds', () => {
    const factPack = buildSimpleFactPack({
      requisitions: [],
      candidates: [],
      events: [],
      users: [],
      aiEnabled: false,
      dataHealthScore: 100,
    });

    // With no data, stalled_reqs should be 0 (green)
    expect(factPack.control_tower.kpis.stalled_reqs.status).toBe('green');
  });
});
