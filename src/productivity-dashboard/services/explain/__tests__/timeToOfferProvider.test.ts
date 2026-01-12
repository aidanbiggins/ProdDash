// Unit tests for Time to Offer Explain Provider

import { TimeToOfferProvider } from '../providers/timeToOfferProvider';
import { ExplainContext } from '../types';
import { Candidate, Requisition, Event, User, CandidateDisposition, RequisitionStatus } from '../../../types/entities';
import { MetricFilters } from '../../../types/metrics';
import { DEFAULT_CONFIG } from '../../../types/config';

// Helper to create test context
function createTestContext(overrides: Partial<ExplainContext> = {}): ExplainContext {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
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

// Helper to create a candidate with an offer
function createCandidateWithOffer(
  id: string,
  reqId: string,
  appliedAt: Date,
  offerExtendedAt: Date,
  firstContactedAt?: Date
): Candidate {
  return {
    candidate_id: id,
    name: `Candidate ${id}`,
    req_id: reqId,
    source: 'Referral',
    applied_at: appliedAt,
    first_contacted_at: firstContactedAt || null,
    current_stage: 'Offer',
    current_stage_entered_at: offerExtendedAt,
    disposition: CandidateDisposition.Active,
    hired_at: null,
    offer_extended_at: offerExtendedAt,
    offer_accepted_at: null,
  };
}

// Helper to create a requisition
function createReq(id: string, recruiterId: string = 'rec1'): Requisition {
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
    recruiter_id: recruiterId,
    status: RequisitionStatus.Open,
    opened_at: new Date('2024-01-01'),
    closed_at: null,
  };
}

describe('TimeToOfferProvider', () => {
  let provider: TimeToOfferProvider;

  beforeEach(() => {
    provider = new TimeToOfferProvider();
  });

  describe('canExplain', () => {
    it('returns NO_OFFERS_IN_RANGE when no offers in date range', () => {
      const context = createTestContext({
        candidates: [],
        requisitions: [createReq('req1')],
      });

      const result = provider.canExplain(context);

      expect(result).toHaveLength(1);
      expect(result[0].code).toBe('NO_OFFERS_IN_RANGE');
    });

    it('returns MISSING_APPLICATION_DATE when offers lack start dates', () => {
      const now = new Date();
      const candidate: Candidate = {
        candidate_id: 'c1',
        name: 'Test',
        req_id: 'req1',
        source: 'Referral',
        applied_at: null,  // Missing
        first_contacted_at: null,  // Missing
        current_stage: 'Offer',
        current_stage_entered_at: now,
        disposition: CandidateDisposition.Active,
        hired_at: null,
        offer_extended_at: now,
        offer_accepted_at: null,
      };

      const context = createTestContext({
        candidates: [candidate],
        requisitions: [createReq('req1')],
      });

      const result = provider.canExplain(context);

      expect(result).toHaveLength(1);
      expect(result[0].code).toBe('MISSING_APPLICATION_DATE');
    });

    it('returns empty array when sufficient data exists', () => {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const context = createTestContext({
        candidates: [
          createCandidateWithOffer('c1', 'req1', thirtyDaysAgo, now),
        ],
        requisitions: [createReq('req1')],
      });

      const result = provider.canExplain(context);

      expect(result).toHaveLength(0);
    });
  });

  describe('explain', () => {
    it('calculates correct median from valid offers', () => {
      const now = new Date();
      const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
      const twentyDaysAgo = new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000);
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      // Create 3 candidates with different time-to-offer values
      // c1: 20 days (applied 30 days ago, offer 10 days ago)
      // c2: 10 days (applied 20 days ago, offer 10 days ago)
      // c3: 30 days (applied 40 days ago, offer 10 days ago)
      const fortyDaysAgo = new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000);

      const context = createTestContext({
        candidates: [
          createCandidateWithOffer('c1', 'req1', thirtyDaysAgo, tenDaysAgo),  // 20 days
          createCandidateWithOffer('c2', 'req1', twentyDaysAgo, tenDaysAgo),  // 10 days
          createCandidateWithOffer('c3', 'req1', fortyDaysAgo, tenDaysAgo),   // 30 days
        ],
        requisitions: [createReq('req1')],
      });

      const result = provider.explain(context);

      expect(result.status).toBe('ready');
      expect(result.value).toBe(20);  // Median of [10, 20, 30] = 20
      expect(result.unit).toBe('days');
      expect(result.includedCount).toBe(3);
      expect(result.excludedCount).toBe(0);
    });

    it('includes breakdown when interview dates available', () => {
      const now = new Date();
      const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
      const twentyDaysAgo = new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000);
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      // Candidate with full timestamps: applied 30 days ago, interviewed 20 days ago, offer 10 days ago
      const context = createTestContext({
        candidates: [
          createCandidateWithOffer('c1', 'req1', thirtyDaysAgo, tenDaysAgo, twentyDaysAgo),
        ],
        requisitions: [createReq('req1')],
      });

      const result = provider.explain(context);

      expect(result.status).toBe('partial');  // Only 1 record = low confidence
      expect(result.breakdown).toBeDefined();
      expect(result.breakdown).toHaveLength(2);
      expect(result.breakdown![0].label).toBe('Application to First Interview');
      expect(result.breakdown![0].value).toBe(10);  // 30 - 20 = 10 days
      expect(result.breakdown![1].label).toBe('First Interview to Offer');
      expect(result.breakdown![1].value).toBe(10);  // 20 - 10 = 10 days
    });

    it('excludes negative durations', () => {
      const now = new Date();
      const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
      const twentyDaysAgo = new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000);

      // Invalid: offer extended before application
      const invalidCandidate = createCandidateWithOffer('c1', 'req1', tenDaysAgo, twentyDaysAgo);

      const context = createTestContext({
        candidates: [invalidCandidate],
        requisitions: [createReq('req1')],
      });

      const result = provider.explain(context);

      expect(result.status).toBe('blocked');
      expect(result.includedCount).toBe(0);
    });

    it('includes top contributors sorted by longest time', () => {
      const now = new Date();
      const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
      const fifteenDaysAgo = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000);
      const twentyDaysAgo = new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000);
      const twentyFiveDaysAgo = new Date(now.getTime() - 25 * 24 * 60 * 60 * 1000);
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      // Create multiple offers with different TTOs
      const context = createTestContext({
        candidates: [
          createCandidateWithOffer('c1', 'req1', thirtyDaysAgo, tenDaysAgo),  // 20 days
          createCandidateWithOffer('c2', 'req2', twentyFiveDaysAgo, tenDaysAgo),  // 15 days
          createCandidateWithOffer('c3', 'req3', fifteenDaysAgo, tenDaysAgo),  // 5 days
        ],
        requisitions: [
          createReq('req1'),
          createReq('req2'),
          createReq('req3'),
        ],
      });

      const result = provider.explain(context);

      expect(result.topContributors).toBeDefined();
      expect(result.topContributors).toHaveLength(3);
      // Should be sorted by longest first
      expect(result.topContributors![0].value).toBe(20);
      expect(result.topContributors![1].value).toBe(15);
      expect(result.topContributors![2].value).toBe(5);
    });

    it('sets low confidence when fewer than 3 records', () => {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const context = createTestContext({
        candidates: [
          createCandidateWithOffer('c1', 'req1', thirtyDaysAgo, now),
        ],
        requisitions: [createReq('req1')],
      });

      const result = provider.explain(context);

      expect(result.confidenceGrade).toBe('low');
      expect(result.status).toBe('partial');
    });

    it('respects filter by recruiter', () => {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const context = createTestContext({
        candidates: [
          createCandidateWithOffer('c1', 'req1', thirtyDaysAgo, now),  // rec1
          createCandidateWithOffer('c2', 'req2', thirtyDaysAgo, now),  // rec2
        ],
        requisitions: [
          createReq('req1', 'rec1'),
          createReq('req2', 'rec2'),
        ],
        filters: {
          dateRange: {
            startDate: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000),
            endDate: now,
          },
          recruiterIds: ['rec1'],  // Only include rec1
          useWeighted: false,
          normalizeByLoad: false,
        },
      });

      const result = provider.explain(context);

      expect(result.includedCount).toBe(1);
    });
  });
});
