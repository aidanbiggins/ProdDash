// Unit tests for Median TTF Explain Provider

import { MedianTTFProvider } from '../providers/medianTTFProvider';
import { ExplainContext } from '../types';
import { Candidate, Requisition, RequisitionStatus, CandidateDisposition } from '../../../types/entities';
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

// Helper to create a hire with TTF data
function createHire(
  candidateId: string,
  reqId: string,
  reqOpenedAt: Date,
  hiredAt: Date,
  appliedAt?: Date,
  firstContactedAt?: Date
): { candidate: Candidate; requisition: Requisition } {
  return {
    candidate: {
      candidate_id: candidateId,
      name: `Candidate ${candidateId}`,
      req_id: reqId,
      source: 'Referral',
      applied_at: appliedAt || reqOpenedAt,
      first_contacted_at: firstContactedAt || null,
      current_stage: 'Hired',
      current_stage_entered_at: hiredAt,
      disposition: CandidateDisposition.Hired,
      hired_at: hiredAt,
      offer_extended_at: new Date(hiredAt.getTime() - 7 * 24 * 60 * 60 * 1000),
      offer_accepted_at: new Date(hiredAt.getTime() - 3 * 24 * 60 * 60 * 1000),
    },
    requisition: {
      req_id: reqId,
      req_title: `Job ${reqId}`,
      function: 'Engineering',
      job_family: 'Software',
      level: 'L5',
      location_city: 'NYC',
      location_region: 'US-East',
      location_type: 'Hybrid',
      headcount: 1,
      hiring_manager_id: 'hm1',
      recruiter_id: 'rec1',
      status: RequisitionStatus.Filled,
      opened_at: reqOpenedAt,
      closed_at: hiredAt,
    },
  };
}

describe('MedianTTFProvider', () => {
  let provider: MedianTTFProvider;

  beforeEach(() => {
    provider = new MedianTTFProvider();
  });

  describe('canExplain', () => {
    it('returns NO_HIRES_IN_RANGE when no hires in date range', () => {
      const context = createTestContext({
        candidates: [],
        requisitions: [],
      });

      const result = provider.canExplain(context);

      expect(result).toHaveLength(1);
      expect(result[0].code).toBe('NO_HIRES_IN_RANGE');
    });

    it('returns empty array when hires exist', () => {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

      const { candidate, requisition } = createHire('c1', 'req1', sixtyDaysAgo, thirtyDaysAgo);

      const context = createTestContext({
        candidates: [candidate],
        requisitions: [requisition],
      });

      const result = provider.canExplain(context);

      expect(result).toHaveLength(0);
    });
  });

  describe('explain', () => {
    it('calculates correct median TTF', () => {
      const now = new Date();
      const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);

      // Create 3 hires with TTF of 20, 30, 40 days
      const hires = [
        createHire('c1', 'req1',
          new Date(tenDaysAgo.getTime() - 20 * 24 * 60 * 60 * 1000), // opened 30 days ago
          tenDaysAgo  // hired 10 days ago = 20 day TTF
        ),
        createHire('c2', 'req2',
          new Date(tenDaysAgo.getTime() - 30 * 24 * 60 * 60 * 1000), // opened 40 days ago
          tenDaysAgo  // hired 10 days ago = 30 day TTF
        ),
        createHire('c3', 'req3',
          new Date(tenDaysAgo.getTime() - 40 * 24 * 60 * 60 * 1000), // opened 50 days ago
          tenDaysAgo  // hired 10 days ago = 40 day TTF
        ),
      ];

      const context = createTestContext({
        candidates: hires.map(h => h.candidate),
        requisitions: hires.map(h => h.requisition),
        users: [],
      });

      const result = provider.explain(context);

      expect(result.status).toBe('ready');
      expect(result.value).toBe(30); // Median of [20, 30, 40] = 30
      expect(result.includedCount).toBe(3);
    });

    it('includes breakdown when first_contacted_at available', () => {
      const now = new Date();
      const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
      const fortyDaysAgo = new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000);
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const twentyDaysAgo = new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000);

      const { candidate, requisition } = createHire(
        'c1', 'req1',
        fortyDaysAgo,   // opened
        tenDaysAgo,     // hired (30 day TTF)
        thirtyDaysAgo,  // applied 10 days after open
        twentyDaysAgo   // first contacted 10 days after applied
      );

      const context = createTestContext({
        candidates: [candidate],
        requisitions: [requisition],
        users: [],
      });

      const result = provider.explain(context);

      expect(result.breakdown).toBeDefined();
      // 3 phases: Req Opened to Applied + Applied to First Touch + First Touch to Hire
      expect(result.breakdown?.length).toBe(3);

      const openedToApplied = result.breakdown?.find(b =>
        b.label.includes('Req Opened to Applied')
      );
      const appliedToFirstTouch = result.breakdown?.find(b =>
        b.label.includes('Applied to First Touch')
      );
      const firstTouchToHire = result.breakdown?.find(b =>
        b.label.includes('First Touch to Hire')
      );

      expect(openedToApplied).toBeDefined();
      expect(openedToApplied?.value).toBe(10); // 10 days from open to applied
      expect(appliedToFirstTouch).toBeDefined();
      expect(appliedToFirstTouch?.value).toBe(10); // 10 days from applied to first touch
      expect(firstTouchToHire).toBeDefined();
      expect(firstTouchToHire?.value).toBe(10); // 10 days from first touch to hire
    });

    it('excludes negative TTF values', () => {
      const now = new Date();
      const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);

      // Create hire where req opened AFTER hire (invalid data)
      const { candidate, requisition } = createHire(
        'c1', 'req1',
        tenDaysAgo,  // opened 10 days ago
        new Date(tenDaysAgo.getTime() - 5 * 24 * 60 * 60 * 1000)  // hired 15 days ago (before open!)
      );

      const context = createTestContext({
        candidates: [candidate],
        requisitions: [requisition],
        users: [],
      });

      const result = provider.explain(context);

      expect(result.status).toBe('blocked');
      expect(result.blockedReasons).toBeDefined();
    });

    it('shows top contributors with longest TTF', () => {
      const now = new Date();
      const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);

      const hires = [
        createHire('c1', 'req1',
          new Date(tenDaysAgo.getTime() - 20 * 24 * 60 * 60 * 1000),
          tenDaysAgo
        ),
        createHire('c2', 'req2',
          new Date(tenDaysAgo.getTime() - 50 * 24 * 60 * 60 * 1000),  // Longest TTF
          tenDaysAgo
        ),
        createHire('c3', 'req3',
          new Date(tenDaysAgo.getTime() - 30 * 24 * 60 * 60 * 1000),
          tenDaysAgo
        ),
      ];

      const context = createTestContext({
        candidates: hires.map(h => h.candidate),
        requisitions: hires.map(h => h.requisition),
        users: [],
      });

      const result = provider.explain(context);

      expect(result.topContributors).toBeDefined();
      expect(result.topContributors![0].value).toBe(50); // Longest TTF first
    });

    it('includes benchmark comparison', () => {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

      const { candidate, requisition } = createHire('c1', 'req1', sixtyDaysAgo, thirtyDaysAgo);

      const context = createTestContext({
        candidates: [candidate],
        requisitions: [requisition],
        users: [],
      });

      const result = provider.explain(context);

      expect(result.benchmark).toBeDefined();
      expect(result.benchmark?.label).toBe('Target');
      expect(result.benchmark?.value).toBe(45); // 45 day target
    });

    it('sets low confidence when few hires', () => {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

      const { candidate, requisition } = createHire('c1', 'req1', sixtyDaysAgo, thirtyDaysAgo);

      const context = createTestContext({
        candidates: [candidate],
        requisitions: [requisition],
        users: [],
      });

      const result = provider.explain(context);

      expect(result.confidenceGrade).toBe('low');
      expect(result.status).toBe('partial');
    });
  });
});
