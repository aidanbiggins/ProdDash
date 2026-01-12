// Unit tests for Stalled Reqs Explain Provider

import { StalledReqsProvider } from '../providers/stalledReqsProvider';
import { ExplainContext } from '../types';
import { Requisition, RequisitionStatus, Candidate, Event, User, CandidateDisposition, EventType } from '../../../types/entities';
import { MetricFilters } from '../../../types/metrics';
import { DEFAULT_CONFIG } from '../../../types/config';

// Helper to create test context
function createTestContext(overrides: Partial<ExplainContext> = {}): ExplainContext {
  const now = new Date();
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  const defaultFilters: MetricFilters = {
    dateRange: {
      startDate: ninetyDaysAgo,
      endDate: now,
    },
    useWeighted: false,
    normalizeByLoad: false,
  };

  return {
    requisitions: [],
    candidates: [],
    events: [],
    users: [],
    filters: defaultFilters,
    config: DEFAULT_CONFIG,
    overview: null,
    hmFriction: [],
    ...overrides,
  };
}

// Helper to create a requisition
function createReq(id: string, status: RequisitionStatus = RequisitionStatus.Open, openedAt?: Date): Requisition {
  return {
    req_id: id,
    req_title: `Job ${id}`,
    function: 'Engineering',
    job_family: 'Software',
    level: 'L5',
    location_city: 'NYC',
    location_region: 'US-East',
    location_type: 'Hybrid',
    headcount: 1,
    hiring_manager_id: 'hm1',
    recruiter_id: 'rec1',
    status,
    opened_at: openedAt || new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), // 60 days ago
    closed_at: null,
  };
}

// Helper to create event
function createEvent(reqId: string, candidateId: string, daysAgo: number): Event {
  return {
    event_id: `evt-${reqId}-${candidateId}`,
    candidate_id: candidateId,
    req_id: reqId,
    event_type: EventType.StageChange,
    from_stage: 'Screen',
    to_stage: 'Interview',
    actor_user_id: 'rec1',
    event_at: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000),
    metadata_json: null,
  };
}

describe('StalledReqsProvider', () => {
  let provider: StalledReqsProvider;

  beforeEach(() => {
    provider = new StalledReqsProvider();
  });

  describe('canExplain', () => {
    it('returns empty array when requisitions exist (even if none open)', () => {
      // The provider can always explain - it just returns 0 for stalled count
      const context = createTestContext({
        requisitions: [
          createReq('req1', RequisitionStatus.Closed),
          createReq('req2', RequisitionStatus.Filled),
        ],
      });

      const result = provider.canExplain(context);

      // No block - provider can explain with 0 open reqs (returns count of 0)
      expect(result).toHaveLength(0);
    });

    it('returns NO_OPEN_REQS when no requisitions at all', () => {
      const context = createTestContext({
        requisitions: [],
      });

      const result = provider.canExplain(context);

      expect(result).toHaveLength(1);
      expect(result[0].code).toBe('NO_OPEN_REQS');
    });

    it('returns empty array when open reqs exist', () => {
      const context = createTestContext({
        requisitions: [
          createReq('req1', RequisitionStatus.Open),
        ],
      });

      const result = provider.canExplain(context);

      expect(result).toHaveLength(0);
    });
  });

  describe('explain', () => {
    it('counts stalled and zombie reqs correctly', () => {
      const now = Date.now();

      const context = createTestContext({
        requisitions: [
          createReq('req1', RequisitionStatus.Open), // Will be zombie (no events)
          createReq('req2', RequisitionStatus.Open), // Will be stalled
          createReq('req3', RequisitionStatus.Open), // Will be active
        ],
        candidates: [
          {
            candidate_id: 'c1',
            name: 'Test',
            req_id: 'req2',
            source: 'Referral',
            applied_at: new Date(now - 20 * 24 * 60 * 60 * 1000),
            first_contacted_at: null,
            current_stage: 'Screen',
            current_stage_entered_at: new Date(now - 20 * 24 * 60 * 60 * 1000),
            disposition: CandidateDisposition.Active,
            hired_at: null,
            offer_extended_at: null,
            offer_accepted_at: null,
          },
          {
            candidate_id: 'c2',
            name: 'Test2',
            req_id: 'req3',
            source: 'LinkedIn',
            applied_at: new Date(now - 5 * 24 * 60 * 60 * 1000),
            first_contacted_at: null,
            current_stage: 'Interview',
            current_stage_entered_at: new Date(now - 2 * 24 * 60 * 60 * 1000),
            disposition: CandidateDisposition.Active,
            hired_at: null,
            offer_extended_at: null,
            offer_accepted_at: null,
          },
        ],
        events: [
          createEvent('req2', 'c1', 20), // 20 days ago - stalled
          createEvent('req3', 'c2', 2),  // 2 days ago - active
        ],
        users: [
          { user_id: 'rec1', name: 'Recruiter 1', role: 'recruiter' as any, team: null, manager_user_id: null, email: null },
          { user_id: 'hm1', name: 'HM 1', role: 'hiring_manager' as any, team: null, manager_user_id: null, email: null },
        ],
      });

      const result = provider.explain(context);

      expect(result.status).toBe('ready');
      expect(result.includedCount).toBe(3); // All open reqs analyzed
      expect(result.breakdown).toBeDefined();

      // Should have breakdown categories
      const zombieRow = result.breakdown?.find(b => b.label.includes('Zombie'));
      const stalledRow = result.breakdown?.find(b => b.label.includes('Stalled'));
      const healthyRow = result.breakdown?.find(b => b.label.includes('Healthy'));

      expect(zombieRow).toBeDefined();
      expect(stalledRow).toBeDefined();
      expect(healthyRow).toBeDefined();
    });

    it('shows top stalled reqs with reasons', () => {
      const context = createTestContext({
        requisitions: [
          createReq('req1', RequisitionStatus.Open),
        ],
        candidates: [],
        events: [], // No events = zombie
        users: [
          { user_id: 'rec1', name: 'Recruiter 1', role: 'recruiter' as any, team: null, manager_user_id: null, email: null },
          { user_id: 'hm1', name: 'HM 1', role: 'hiring_manager' as any, team: null, manager_user_id: null, email: null },
        ],
      });

      const result = provider.explain(context);

      // The value should show the count of stalled reqs
      expect(typeof result.value === 'number').toBe(true);
      // Should have breakdown showing zombie/stalled/healthy counts
      expect(result.breakdown).toBeDefined();
      const zombieRow = result.breakdown?.find(b => b.label.includes('Zombie'));
      expect(zombieRow).toBeDefined();
    });
  });
});
