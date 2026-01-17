// Test fixtures for SLA Attribution Service tests

import { DataSnapshot, SnapshotEvent } from '../../types/snapshotTypes';
import { Requisition, User, UserRole, LocationType, LocationRegion, RequisitionStatus, HeadcountType, Priority } from '../../types/entities';

/**
 * Helper to create a date relative to today
 */
export function day(offset: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  d.setHours(10, 0, 0, 0);
  return d;
}

/**
 * Helper to create a date at a specific hour
 */
export function dayAt(offset: number, hour: number): Date {
  const d = day(offset);
  d.setHours(hour, 0, 0, 0);
  return d;
}

/**
 * Mock snapshots spanning 7 days
 */
export const mockSnapshots: DataSnapshot[] = [
  {
    id: 'snap1',
    organization_id: 'org1',
    snapshot_date: day(-6),
    snapshot_seq: 1,
    source_filename: 'export_jan01.csv',
    source_hash: 'abc123',
    imported_at: day(-6),
    imported_by: 'user1',
    req_count: 10,
    candidate_count: 50,
    user_count: 5,
    status: 'completed',
    diff_completed_at: day(-6),
    events_generated: 0,
    error_message: null,
  },
  {
    id: 'snap2',
    organization_id: 'org1',
    snapshot_date: day(-4),
    snapshot_seq: 2,
    source_filename: 'export_jan03.csv',
    source_hash: 'def456',
    imported_at: day(-4),
    imported_by: 'user1',
    req_count: 10,
    candidate_count: 52,
    user_count: 5,
    status: 'completed',
    diff_completed_at: day(-4),
    events_generated: 15,
    error_message: null,
  },
  {
    id: 'snap3',
    organization_id: 'org1',
    snapshot_date: day(-1),
    snapshot_seq: 3,
    source_filename: 'export_jan06.csv',
    source_hash: 'ghi789',
    imported_at: day(-1),
    imported_by: 'user1',
    req_count: 11,
    candidate_count: 55,
    user_count: 5,
    status: 'completed',
    diff_completed_at: day(-1),
    events_generated: 22,
    error_message: null,
  },
];

/**
 * Mock snapshot events showing candidate progression
 */
export const mockEvents: SnapshotEvent[] = [
  // Candidate 1: Normal flow with HM_SCREEN breach (96 hours in HM_SCREEN, SLA is 72h)
  {
    id: 'e1',
    organization_id: 'org1',
    event_type: 'CANDIDATE_APPEARED',
    candidate_id: 'cand1',
    req_id: 'req1',
    from_value: null,
    to_value: 'Applied',
    from_canonical: null,
    to_canonical: 'APPLIED',
    event_at: day(-6),
    from_snapshot_id: null,
    to_snapshot_id: 'snap1',
    from_snapshot_date: null,
    to_snapshot_date: day(-6),
    confidence: 'high',
    confidence_reasons: null,
    metadata: null,
    created_at: day(-6),
  },
  {
    id: 'e2',
    organization_id: 'org1',
    event_type: 'STAGE_CHANGE',
    candidate_id: 'cand1',
    req_id: 'req1',
    from_value: 'Applied',
    to_value: 'Recruiter Screen',
    from_canonical: 'APPLIED',
    to_canonical: 'SCREEN',
    event_at: dayAt(-6, 14),
    from_snapshot_id: 'snap1',
    to_snapshot_id: 'snap1',
    from_snapshot_date: day(-6),
    to_snapshot_date: day(-6),
    confidence: 'high',
    confidence_reasons: null,
    metadata: null,
    created_at: day(-6),
  },
  {
    id: 'e3',
    organization_id: 'org1',
    event_type: 'STAGE_CHANGE',
    candidate_id: 'cand1',
    req_id: 'req1',
    from_value: 'Recruiter Screen',
    to_value: 'HM Interview',
    from_canonical: 'SCREEN',
    to_canonical: 'HM_SCREEN',
    event_at: day(-5),
    from_snapshot_id: 'snap1',
    to_snapshot_id: 'snap2',
    from_snapshot_date: day(-6),
    to_snapshot_date: day(-4),
    confidence: 'high',
    confidence_reasons: null,
    metadata: null,
    created_at: day(-4),
  },
  {
    id: 'e4',
    organization_id: 'org1',
    event_type: 'STAGE_CHANGE',
    candidate_id: 'cand1',
    req_id: 'req1',
    from_value: 'HM Interview',
    to_value: 'Onsite',
    from_canonical: 'HM_SCREEN',
    to_canonical: 'ONSITE',
    event_at: day(-1),
    from_snapshot_id: 'snap2',
    to_snapshot_id: 'snap3',
    from_snapshot_date: day(-4),
    to_snapshot_date: day(-1),
    confidence: 'high',
    confidence_reasons: null,
    metadata: null,
    created_at: day(-1),
  },

  // Candidate 2: Regression scenario (HM_SCREEN -> SCREEN -> HM_SCREEN)
  {
    id: 'e5',
    organization_id: 'org1',
    event_type: 'CANDIDATE_APPEARED',
    candidate_id: 'cand2',
    req_id: 'req1',
    from_value: null,
    to_value: 'Recruiter Screen',
    from_canonical: null,
    to_canonical: 'SCREEN',
    event_at: day(-6),
    from_snapshot_id: null,
    to_snapshot_id: 'snap1',
    from_snapshot_date: null,
    to_snapshot_date: day(-6),
    confidence: 'high',
    confidence_reasons: null,
    metadata: null,
    created_at: day(-6),
  },
  {
    id: 'e6',
    organization_id: 'org1',
    event_type: 'STAGE_CHANGE',
    candidate_id: 'cand2',
    req_id: 'req1',
    from_value: 'Recruiter Screen',
    to_value: 'HM Interview',
    from_canonical: 'SCREEN',
    to_canonical: 'HM_SCREEN',
    event_at: day(-5),
    from_snapshot_id: 'snap1',
    to_snapshot_id: 'snap2',
    from_snapshot_date: day(-6),
    to_snapshot_date: day(-4),
    confidence: 'high',
    confidence_reasons: null,
    metadata: null,
    created_at: day(-4),
  },
  {
    id: 'e7',
    organization_id: 'org1',
    event_type: 'STAGE_REGRESSION',
    candidate_id: 'cand2',
    req_id: 'req1',
    from_value: 'HM Interview',
    to_value: 'Recruiter Screen',
    from_canonical: 'HM_SCREEN',
    to_canonical: 'SCREEN',
    event_at: day(-4),
    from_snapshot_id: 'snap2',
    to_snapshot_id: 'snap2',
    from_snapshot_date: day(-4),
    to_snapshot_date: day(-4),
    confidence: 'medium',
    confidence_reasons: ['Reschedule detected'],
    metadata: null,
    created_at: day(-4),
  },
  {
    id: 'e8',
    organization_id: 'org1',
    event_type: 'STAGE_CHANGE',
    candidate_id: 'cand2',
    req_id: 'req1',
    from_value: 'Recruiter Screen',
    to_value: 'HM Interview',
    from_canonical: 'SCREEN',
    to_canonical: 'HM_SCREEN',
    event_at: day(-3),
    from_snapshot_id: 'snap2',
    to_snapshot_id: 'snap3',
    from_snapshot_date: day(-4),
    to_snapshot_date: day(-1),
    confidence: 'high',
    confidence_reasons: null,
    metadata: null,
    created_at: day(-1),
  },

  // Candidate 3: Still in SCREEN stage (no breach)
  {
    id: 'e9',
    organization_id: 'org1',
    event_type: 'CANDIDATE_APPEARED',
    candidate_id: 'cand3',
    req_id: 'req2',
    from_value: null,
    to_value: 'Applied',
    from_canonical: null,
    to_canonical: 'APPLIED',
    event_at: day(-2),
    from_snapshot_id: null,
    to_snapshot_id: 'snap3',
    from_snapshot_date: null,
    to_snapshot_date: day(-1),
    confidence: 'high',
    confidence_reasons: null,
    metadata: null,
    created_at: day(-1),
  },
  {
    id: 'e10',
    organization_id: 'org1',
    event_type: 'STAGE_CHANGE',
    candidate_id: 'cand3',
    req_id: 'req2',
    from_value: 'Applied',
    to_value: 'Recruiter Screen',
    from_canonical: 'APPLIED',
    to_canonical: 'SCREEN',
    event_at: day(-1),
    from_snapshot_id: 'snap3',
    to_snapshot_id: 'snap3',
    from_snapshot_date: day(-1),
    to_snapshot_date: day(-1),
    confidence: 'high',
    confidence_reasons: null,
    metadata: null,
    created_at: day(-1),
  },
];

/**
 * Mock requisitions
 */
export const mockRequisitions: Requisition[] = [
  {
    req_id: 'req1',
    req_title: 'Senior Engineer',
    function: 'Engineering',
    job_family: 'Software Engineering',
    level: 'L5',
    location_type: LocationType.Remote,
    location_region: LocationRegion.AMER,
    location_city: null,
    comp_band_min: 150000,
    comp_band_max: 200000,
    opened_at: day(-30),
    closed_at: null,
    status: RequisitionStatus.Open,
    hiring_manager_id: 'hm1',
    recruiter_id: 'rec1',
    business_unit: 'Product',
    headcount_type: HeadcountType.New,
    priority: Priority.P0,
    candidate_slate_required: true,
    search_firm_used: false,
  },
  {
    req_id: 'req2',
    req_title: 'Product Manager',
    function: 'Product',
    job_family: 'Product Management',
    level: 'L4',
    location_type: LocationType.Hybrid,
    location_region: LocationRegion.AMER,
    location_city: 'New York',
    comp_band_min: 120000,
    comp_band_max: 160000,
    opened_at: day(-15),
    closed_at: null,
    status: RequisitionStatus.Open,
    hiring_manager_id: 'hm2',
    recruiter_id: 'rec1',
    business_unit: 'Product',
    headcount_type: HeadcountType.Backfill,
    priority: Priority.P1,
    candidate_slate_required: false,
    search_firm_used: false,
  },
];

/**
 * Mock requisitions without owners (for testing attribution edge cases)
 */
export const mockRequisitionsNoOwner: Requisition[] = [
  {
    ...mockRequisitions[0],
    req_id: 'req_no_hm',
    hiring_manager_id: '',
    recruiter_id: '',
  },
];

/**
 * Mock users
 */
export const mockUsers: User[] = [
  {
    user_id: 'rec1',
    name: 'Jane Doe',
    role: 'RECRUITER' as UserRole,
    team: 'Engineering Recruiting',
    manager_user_id: null,
    email: 'jane@example.com',
  },
  {
    user_id: 'hm1',
    name: 'John Smith',
    role: 'HIRING_MANAGER' as UserRole,
    team: 'Engineering',
    manager_user_id: null,
    email: 'john@example.com',
  },
  {
    user_id: 'hm2',
    name: 'Alice Lee',
    role: 'HIRING_MANAGER' as UserRole,
    team: 'Product',
    manager_user_id: null,
    email: 'alice@example.com',
  },
];

/**
 * Create requisition map for testing
 */
export function createRequisitionMap(reqs: Requisition[] = mockRequisitions): Map<string, Requisition> {
  const map = new Map<string, Requisition>();
  reqs.forEach((req) => map.set(req.req_id, req));
  return map;
}

/**
 * Create user map for testing
 */
export function createUserMap(users: User[] = mockUsers): Map<string, User> {
  const map = new Map<string, User>();
  users.forEach((user) => map.set(user.user_id, user));
  return map;
}

/**
 * Create a mock snapshot with custom overrides
 */
export function mockSnapshot(overrides: Partial<DataSnapshot> = {}): DataSnapshot {
  return {
    id: `snap_${Math.random().toString(36).substr(2, 9)}`,
    organization_id: 'org1',
    snapshot_date: new Date(),
    snapshot_seq: 1,
    source_filename: 'test.csv',
    source_hash: 'hash123',
    imported_at: new Date(),
    imported_by: 'user1',
    req_count: 10,
    candidate_count: 50,
    user_count: 5,
    status: 'completed',
    diff_completed_at: new Date(),
    events_generated: 0,
    error_message: null,
    ...overrides,
  };
}

/**
 * Create a mock event with custom overrides
 */
export function mockEvent(overrides: Partial<SnapshotEvent>): SnapshotEvent {
  return {
    id: `evt_${Math.random().toString(36).substr(2, 9)}`,
    organization_id: 'org1',
    event_type: 'STAGE_CHANGE',
    candidate_id: 'cand1',
    req_id: 'req1',
    from_value: null,
    to_value: null,
    from_canonical: null,
    to_canonical: null,
    event_at: new Date(),
    from_snapshot_id: null,
    to_snapshot_id: 'snap1',
    from_snapshot_date: null,
    to_snapshot_date: new Date(),
    confidence: 'high',
    confidence_reasons: null,
    metadata: null,
    created_at: new Date(),
    ...overrides,
  };
}
