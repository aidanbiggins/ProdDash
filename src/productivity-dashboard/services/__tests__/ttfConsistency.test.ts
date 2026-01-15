// TTF Consistency Test
// Ensures all TTF calculations across the codebase use the same methodology:
// TTF = differenceInDays(candidate.hired_at, requisition.opened_at)

import { differenceInDays } from 'date-fns';
import { calculateVelocityMetrics } from '../velocityAnalysis';
import { calculateOutcomeMetrics } from '../metricsEngine';
import { Candidate, Requisition, Event, User, CandidateDisposition, RequisitionStatus, MetricFilters } from '../../types';
import { DashboardConfig, DEFAULT_DASHBOARD_CONFIG } from '../../types/config';

// Helper to create test data with known TTF values
function createTestData() {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

  const requisitions: Requisition[] = [
    {
      req_id: 'req-1',
      title: 'Software Engineer',
      status: RequisitionStatus.Closed,
      opened_at: sixtyDaysAgo,
      closed_at: thirtyDaysAgo, // Req closed 30 days after hire (admin delay)
      recruiter_id: 'rec-1',
      hiring_manager_id: 'hm-1',
      function: 'Engineering',
      location_region: 'US',
      job_family: null,
      level: null,
      location_type: 'Remote'
    },
    {
      req_id: 'req-2',
      title: 'Product Manager',
      status: RequisitionStatus.Closed,
      opened_at: sixtyDaysAgo,
      closed_at: now, // Req closed same day as hire
      recruiter_id: 'rec-1',
      hiring_manager_id: 'hm-1',
      function: 'Product',
      location_region: 'US',
      job_family: null,
      level: null,
      location_type: 'Remote'
    }
  ];

  // Candidate 1: Hired 45 days after req opened (TTF = 45)
  const hired1Date = new Date(sixtyDaysAgo.getTime() + 45 * 24 * 60 * 60 * 1000);
  // Candidate 2: Hired 40 days after req opened (TTF = 40)
  const hired2Date = new Date(sixtyDaysAgo.getTime() + 40 * 24 * 60 * 60 * 1000);

  const candidates: Candidate[] = [
    {
      candidate_id: 'cand-1',
      req_id: 'req-1',
      name: 'John Doe',
      email: 'john@example.com',
      source: 'Referral',
      applied_at: sixtyDaysAgo,
      current_stage: 'HIRED',
      current_stage_entered_at: hired1Date,
      disposition: CandidateDisposition.Hired,
      hired_at: hired1Date,
      offer_extended_at: new Date(hired1Date.getTime() - 5 * 24 * 60 * 60 * 1000),
      offer_accepted_at: hired1Date,
      first_contacted_at: null
    },
    {
      candidate_id: 'cand-2',
      req_id: 'req-2',
      name: 'Jane Smith',
      email: 'jane@example.com',
      source: 'Sourced',
      applied_at: sixtyDaysAgo,
      current_stage: 'HIRED',
      current_stage_entered_at: hired2Date,
      disposition: CandidateDisposition.Hired,
      hired_at: hired2Date,
      offer_extended_at: new Date(hired2Date.getTime() - 5 * 24 * 60 * 60 * 1000),
      offer_accepted_at: hired2Date,
      first_contacted_at: null
    }
  ];

  const events: Event[] = [];
  const users: User[] = [];

  // Expected TTF values: 45d and 40d, median = 42.5
  // Using candidate.hired_at - req.opened_at
  const expectedTTF1 = differenceInDays(hired1Date, sixtyDaysAgo); // 45
  const expectedTTF2 = differenceInDays(hired2Date, sixtyDaysAgo); // 40

  return {
    requisitions,
    candidates,
    events,
    users,
    expectedTTFs: [expectedTTF1, expectedTTF2].sort((a, b) => a - b),
    // Median of [40, 45] = (40 + 45) / 2 = 42.5 (proper median for even arrays)
    expectedMedian: 42.5
  };
}

describe('TTF Calculation Consistency', () => {
  const { requisitions, candidates, events, users, expectedTTFs, expectedMedian } = createTestData();

  const filters: MetricFilters = {
    dateRange: {
      startDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
      endDate: new Date()
    }
  };

  describe('metricsEngine.calculateOutcomeMetrics', () => {
    it('should calculate TTF using candidate.hired_at - req.opened_at', () => {
      const result = calculateOutcomeMetrics(
        candidates,
        requisitions,
        filters,
        DEFAULT_DASHBOARD_CONFIG
      );

      // Should use candidate hire dates, not req close dates
      expect(result.timeToFillMedian).toBeDefined();
      // Median of [40, 45] = (40 + 45) / 2 = 42.5
      expect(result.timeToFillMedian).toBe(42.5);
    });
  });

  describe('velocityAnalysis.calculateVelocityMetrics', () => {
    it('should calculate medianDaysToFill using candidate.hired_at - req.opened_at', () => {
      const result = calculateVelocityMetrics(
        candidates,
        requisitions,
        events,
        users,
        filters
      );

      // Should match metricsEngine methodology
      expect(result.reqDecay.medianDaysToFill).toBeDefined();
      // Median of [40, 45] = (40 + 45) / 2 = 42.5
      expect(result.reqDecay.medianDaysToFill).toBe(42.5);
    });
  });

  describe('Cross-service consistency', () => {
    it('should have identical TTF values between metricsEngine and velocityAnalysis', () => {
      const outcomeMetrics = calculateOutcomeMetrics(
        candidates,
        requisitions,
        filters,
        DEFAULT_DASHBOARD_CONFIG
      );

      const velocityMetrics = calculateVelocityMetrics(
        candidates,
        requisitions,
        events,
        users,
        filters
      );

      // THE CRITICAL CHECK: Both services must return the same TTF
      expect(velocityMetrics.reqDecay.medianDaysToFill).toBe(outcomeMetrics.timeToFillMedian);
    });

    it('should NOT use req.closed_at for TTF calculation', () => {
      // Create a scenario where req.closed_at differs significantly from hired_at
      const reqOpenedAt = new Date('2024-01-01');
      const candidateHiredAt = new Date('2024-01-20'); // Hired after 19 days
      const reqClosedAt = new Date('2024-02-15'); // Req closed 26 days AFTER hire

      const testReqs: Requisition[] = [{
        req_id: 'test-req',
        title: 'Test Role',
        status: RequisitionStatus.Closed,
        opened_at: reqOpenedAt,
        closed_at: reqClosedAt,
        recruiter_id: 'rec-1',
        hiring_manager_id: 'hm-1',
        function: 'Test',
        location_region: 'US',
        job_family: null,
        level: null,
        location_type: 'Remote'
      }];

      const testCandidates: Candidate[] = [{
        candidate_id: 'test-cand',
        req_id: 'test-req',
        name: 'Test Person',
        email: 'test@example.com',
        source: 'Referral',
        applied_at: reqOpenedAt,
        current_stage: 'HIRED',
        current_stage_entered_at: candidateHiredAt,
        disposition: CandidateDisposition.Hired,
        hired_at: candidateHiredAt,
        offer_extended_at: new Date(candidateHiredAt.getTime() - 5 * 24 * 60 * 60 * 1000),
        offer_accepted_at: candidateHiredAt,
        first_contacted_at: null
      }];

      const testFilters: MetricFilters = {
        dateRange: {
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-03-01')
        }
      };

      const wrongTTF = differenceInDays(reqClosedAt, reqOpenedAt); // 45 days (WRONG)
      const correctTTF = differenceInDays(candidateHiredAt, reqOpenedAt); // 19 days (CORRECT)

      // Verify we're testing a meaningful difference
      expect(wrongTTF).toBe(45);
      expect(correctTTF).toBe(19);
      expect(wrongTTF).not.toBe(correctTTF);

      // metricsEngine should use correct methodology
      const outcomeResult = calculateOutcomeMetrics(
        testCandidates,
        testReqs,
        testFilters,
        DEFAULT_DASHBOARD_CONFIG
      );
      expect(outcomeResult.timeToFillMedian).toBe(correctTTF);

      // velocityAnalysis should also use correct methodology
      const velocityResult = calculateVelocityMetrics(
        testCandidates,
        testReqs,
        [],
        [],
        testFilters
      );
      expect(velocityResult.reqDecay.medianDaysToFill).toBe(correctTTF);
    });
  });
});
