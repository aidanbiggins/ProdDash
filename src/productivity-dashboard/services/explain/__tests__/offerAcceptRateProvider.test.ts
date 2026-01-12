// Unit tests for Offer Accept Rate Explain Provider

import { OfferAcceptRateProvider } from '../providers/offerAcceptRateProvider';
import { ExplainContext } from '../types';
import { Candidate, Requisition, RequisitionStatus, CandidateDisposition, User } from '../../../types/entities';
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

// Helper to create candidate with offer
function createCandidateWithOffer(
  id: string,
  reqId: string,
  offerDate: Date,
  accepted: boolean,
  source: string = 'Referral'
): Candidate {
  return {
    candidate_id: id,
    name: `Candidate ${id}`,
    req_id: reqId,
    source,
    applied_at: new Date(offerDate.getTime() - 30 * 24 * 60 * 60 * 1000),
    first_contacted_at: new Date(offerDate.getTime() - 20 * 24 * 60 * 60 * 1000),
    current_stage: 'Offer',
    current_stage_entered_at: offerDate,
    disposition: accepted ? CandidateDisposition.Hired : CandidateDisposition.Active,
    hired_at: accepted ? new Date(offerDate.getTime() + 7 * 24 * 60 * 60 * 1000) : null,
    offer_extended_at: offerDate,
    offer_accepted_at: accepted ? new Date(offerDate.getTime() + 3 * 24 * 60 * 60 * 1000) : null,
  };
}

// Helper to create requisition
function createReq(id: string, func: string = 'Engineering', recruiterId: string = 'rec1'): Requisition {
  return {
    req_id: id,
    req_title: `Job ${id}`,
    function: func,
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

describe('OfferAcceptRateProvider', () => {
  let provider: OfferAcceptRateProvider;

  beforeEach(() => {
    provider = new OfferAcceptRateProvider();
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

    it('returns empty array when offers exist', () => {
      const now = new Date();
      const context = createTestContext({
        candidates: [
          createCandidateWithOffer('c1', 'req1', now, true),
        ],
        requisitions: [createReq('req1')],
      });

      const result = provider.canExplain(context);

      expect(result).toHaveLength(0);
    });
  });

  describe('explain', () => {
    it('calculates accept rate correctly', () => {
      const now = new Date();
      const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);

      const context = createTestContext({
        candidates: [
          createCandidateWithOffer('c1', 'req1', tenDaysAgo, true),
          createCandidateWithOffer('c2', 'req1', tenDaysAgo, true),
          createCandidateWithOffer('c3', 'req1', tenDaysAgo, false),
          createCandidateWithOffer('c4', 'req1', tenDaysAgo, false),
        ],
        requisitions: [createReq('req1')],
        users: [
          { user_id: 'rec1', name: 'Recruiter 1', role: 'recruiter' as any, team: null, manager_user_id: null, email: null },
        ],
      });

      const result = provider.explain(context);

      // With 4 offers, we have medium sample - status can be partial or ready
      expect(['ready', 'partial']).toContain(result.status);
      expect(result.value).toBe(50); // 2 accepted / 4 total = 50%
      expect(result.includedCount).toBe(4);
    });

    it('shows breakdown by source', () => {
      const now = new Date();
      const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);

      const context = createTestContext({
        candidates: [
          createCandidateWithOffer('c1', 'req1', tenDaysAgo, true, 'Referral'),
          createCandidateWithOffer('c2', 'req1', tenDaysAgo, true, 'Referral'),
          createCandidateWithOffer('c3', 'req1', tenDaysAgo, false, 'LinkedIn'),
          createCandidateWithOffer('c4', 'req1', tenDaysAgo, false, 'LinkedIn'),
        ],
        requisitions: [createReq('req1')],
        users: [],
      });

      const result = provider.explain(context);

      expect(result.breakdown).toBeDefined();
      // Should have source breakdown section
      const sourceHeader = result.breakdown?.find(b => b.label.includes('By Source'));
      expect(sourceHeader).toBeDefined();
    });

    it('includes benchmark comparison', () => {
      const now = new Date();
      const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);

      const context = createTestContext({
        candidates: [
          createCandidateWithOffer('c1', 'req1', tenDaysAgo, true),
        ],
        requisitions: [createReq('req1')],
        users: [],
      });

      const result = provider.explain(context);

      expect(result.benchmark).toBeDefined();
      expect(result.benchmark?.label).toBe('Target');
      expect(result.benchmark?.value).toBe(80); // 80% target
    });

    it('sets low confidence when few offers', () => {
      const now = new Date();

      const context = createTestContext({
        candidates: [
          createCandidateWithOffer('c1', 'req1', now, true),
        ],
        requisitions: [createReq('req1')],
        users: [],
      });

      const result = provider.explain(context);

      expect(result.confidenceGrade).toBe('low');
    });
  });
});
