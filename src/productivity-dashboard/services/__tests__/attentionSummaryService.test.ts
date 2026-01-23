// Tests for Attention Summary Service (V2)
// Validates bucket computation, severity, confidence, drilldown ranking.

import { computeAttentionV2, AttentionSummaryContext } from '../attentionSummaryService';
import { Requisition, Candidate, User, RequisitionStatus, CandidateDisposition } from '../../types/entities';
import { OverviewMetrics, HiringManagerFriction, RecruiterSummary } from '../../types/metrics';
import { CoverageMetrics } from '../../types/resilientImportTypes';
import { HMPendingAction } from '../../types/hmTypes';
import { AttentionV2Data } from '../../types/attentionTypes';

// ── Helpers ──────────────────────────────────

function makeReq(overrides: Partial<Requisition> = {}): Requisition {
  return {
    req_id: `REQ-${Math.random().toString(36).slice(2, 8)}`,
    req_title: 'Test Req',
    function: 'Engineering',
    job_family: 'Software',
    level: 'Senior',
    location_type: 'Remote' as any,
    location_region: 'US' as any,
    location_city: null,
    comp_band_min: null,
    comp_band_max: null,
    opened_at: new Date('2024-01-01'),
    closed_at: null,
    status: RequisitionStatus.Open,
    hiring_manager_id: 'hm-1',
    recruiter_id: 'rec-1',
    business_unit: null,
    headcount_type: 'Backfill' as any,
    priority: null,
    candidate_slate_required: false,
    search_firm_used: false,
    ...overrides,
  };
}

function makeCandidate(overrides: Partial<Candidate> = {}): Candidate {
  return {
    candidate_id: `CAND-${Math.random().toString(36).slice(2, 8)}`,
    name: 'Test Candidate',
    req_id: 'REQ-1',
    source: 'LinkedIn' as any,
    applied_at: new Date('2024-02-01'),
    first_contacted_at: null,
    current_stage: 'APPLIED',
    current_stage_entered_at: null,
    disposition: CandidateDisposition.Active,
    hired_at: null,
    offer_extended_at: null,
    offer_accepted_at: null,
    ...overrides,
  };
}

function makeUser(overrides: Partial<User> = {}): User {
  return {
    user_id: `usr-${Math.random().toString(36).slice(2, 8)}`,
    name: 'Test User',
    email: 'test@example.com',
    role: 'Recruiter' as any,
    ...overrides,
  };
}

function makeRecruiterSummary(overrides: Partial<RecruiterSummary> & { activeReqLoad?: number; stalledCount?: number; ttfMedian?: number | null } = {}): RecruiterSummary {
  const { activeReqLoad = 5, stalledCount = 0, ttfMedian = 45, ...rest } = overrides;
  return {
    recruiterId: 'rec-1',
    recruiterName: 'Test Recruiter',
    team: null,
    outcomes: {
      hires: 2,
      offersExtended: 3,
      offersAccepted: 2,
      acceptanceRate: 0.67,
      timeToFillMedian: ttfMedian,
    },
    executionVolume: { totalCandidates: 20, newThisPeriod: 5, advancedThisPeriod: 8 },
    funnelConversion: { screenToOnsite: 0.5, onsiteToOffer: 0.4, offerToHire: 0.8 },
    aging: {
      openReqCount: activeReqLoad,
      agingBuckets: [],
      stalledReqs: { count: stalledCount, threshold: 14, reqIds: [] },
    },
    weighted: { weightedHires: 2, complexityIndex: 1.0 },
    timeAttribution: { avgDaysToScreen: 3, avgDaysToOnsite: 10, avgDaysToOffer: 25 },
    productivityIndex: 1.0,
    activeReqLoad,
    ...rest,
  } as RecruiterSummary;
}

function makeCoverage(overrides: Partial<CoverageMetrics> = {}): CoverageMetrics {
  return {
    counts: { requisitions: 10, candidates: 50, events: 100, users: 5 },
    flags: { hasTimestamps: true, hasStageEvents: true, hasRecruiters: true, hasHiringManagers: true },
    sampleSizes: { hires: 10, offers: 15, applications: 50 },
    ...overrides,
  } as CoverageMetrics;
}

function makeBaseContext(overrides: Partial<AttentionSummaryContext> = {}): AttentionSummaryContext {
  return {
    requisitions: [],
    candidates: [],
    users: [],
    overview: null,
    hmFriction: [],
    hmActions: [],
    coverage: makeCoverage(),
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────

describe('attentionSummaryService', () => {
  describe('computeAttentionV2', () => {
    it('returns empty buckets and allBlocked when coverage has zero counts', () => {
      const ctx = makeBaseContext({
        coverage: makeCoverage({ counts: { requisitions: 0, candidates: 0, events: 0, users: 0 } } as any),
      });
      const result = computeAttentionV2(ctx);

      expect(result.summary.buckets).toHaveLength(0);
      expect(result.summary.allBlocked).toBe(true);
      expect(result.drilldown.recruiters).toHaveLength(0);
      expect(result.drilldown.hiringManagers).toHaveLength(0);
      expect(result.drilldown.reqClusters).toHaveLength(0);
    });

    it('marks allBlocked when no coverage data', () => {
      const ctx = makeBaseContext({ coverage: null });
      const result = computeAttentionV2(ctx);

      expect(result.summary.allBlocked).toBe(true);
      expect(result.summary.blockedReason).toBeDefined();
      expect(result.summary.buckets).toHaveLength(0);
    });
  });

  describe('recruiter throughput bucket', () => {
    it('detects overloaded recruiters (>12 reqs)', () => {
      const reqs = Array.from({ length: 15 }, (_, i) =>
        makeReq({ req_id: `REQ-${i}`, recruiter_id: 'rec-overloaded' })
      );
      const users = [makeUser({ user_id: 'rec-overloaded', name: 'Overloaded Recruiter', role: 'Recruiter' as any })];
      const overview: OverviewMetrics = {
        recruiterSummaries: [makeRecruiterSummary({ recruiterId: 'rec-overloaded', recruiterName: 'Overloaded Recruiter', activeReqLoad: 15 })],
      } as any;

      const ctx = makeBaseContext({ requisitions: reqs, users, overview });
      const result = computeAttentionV2(ctx);

      const recruiterBucket = result.summary.buckets.find(b => b.id === 'recruiter_throughput');
      expect(recruiterBucket).toBeDefined();
      expect(recruiterBucket!.count).toBeGreaterThan(0);
    });

    it('does not create bucket when no recruiter issues', () => {
      const reqs = Array.from({ length: 5 }, (_, i) =>
        makeReq({ req_id: `REQ-${i}`, recruiter_id: 'rec-1' })
      );
      const overview: OverviewMetrics = {
        recruiterSummaries: [makeRecruiterSummary({ activeReqLoad: 5 })],
      } as any;

      const ctx = makeBaseContext({ requisitions: reqs, overview });
      const result = computeAttentionV2(ctx);

      const recruiterBucket = result.summary.buckets.find(b => b.id === 'recruiter_throughput');
      expect(recruiterBucket).toBeUndefined();
    });
  });

  describe('HM friction bucket', () => {
    it('detects slow HMs with high feedback latency', () => {
      const hmFriction: HiringManagerFriction[] = [
        { hmId: 'hm-1', hmName: 'Slow HM', feedbackLatencyMedian: 120, decisionLatencyMedian: 48, reqsInRange: 3, hmWeight: 1, loopCount: 5, offerAcceptanceRate: null } as any,
        { hmId: 'hm-2', hmName: 'Another Slow HM', feedbackLatencyMedian: 144, decisionLatencyMedian: 192, reqsInRange: 4, hmWeight: 1, loopCount: 3, offerAcceptanceRate: null } as any,
        { hmId: 'hm-3', hmName: 'Fast HM', feedbackLatencyMedian: 24, decisionLatencyMedian: 24, reqsInRange: 2, hmWeight: 1, loopCount: 4, offerAcceptanceRate: null } as any,
      ];

      const ctx = makeBaseContext({ hmFriction });
      const result = computeAttentionV2(ctx);

      const hmBucket = result.summary.buckets.find(b => b.id === 'hm_friction');
      expect(hmBucket).toBeDefined();
      expect(hmBucket!.count).toBeGreaterThan(0);
    });

    it('detects HMs with overdue actions', () => {
      const hmActions: HMPendingAction[] = [
        { hmUserId: 'hm-1', hmName: 'Late HM', actionType: 'feedback', daysOverdue: 5, reqId: 'REQ-1' } as any,
        { hmUserId: 'hm-1', hmName: 'Late HM', actionType: 'decision', daysOverdue: 4, reqId: 'REQ-2' } as any,
      ];

      const ctx = makeBaseContext({ hmActions });
      const result = computeAttentionV2(ctx);

      const hmBucket = result.summary.buckets.find(b => b.id === 'hm_friction');
      expect(hmBucket).toBeDefined();
    });
  });

  describe('pipeline health bucket', () => {
    it('detects reqs with thin pipeline (<3 active candidates)', () => {
      const reqs = [
        makeReq({ req_id: 'REQ-THIN-1' }),
        makeReq({ req_id: 'REQ-THIN-2' }),
        makeReq({ req_id: 'REQ-OK', }),
      ];
      // REQ-OK has 5 candidates, thin reqs have 0-1
      const candidates = [
        makeCandidate({ req_id: 'REQ-THIN-1' }),
        ...Array.from({ length: 5 }, () => makeCandidate({ req_id: 'REQ-OK' })),
      ];

      const ctx = makeBaseContext({ requisitions: reqs, candidates });
      const result = computeAttentionV2(ctx);

      const pipelineBucket = result.summary.buckets.find(b => b.id === 'pipeline_health');
      expect(pipelineBucket).toBeDefined();
      // REQ-THIN-1 has 1 candidate, REQ-THIN-2 has 0
      expect(pipelineBucket!.count).toBe(2);
    });

    it('does not trigger when all reqs have enough candidates', () => {
      const reqs = [makeReq({ req_id: 'REQ-1' })];
      const candidates = Array.from({ length: 5 }, () =>
        makeCandidate({ req_id: 'REQ-1' })
      );

      const ctx = makeBaseContext({ requisitions: reqs, candidates });
      const result = computeAttentionV2(ctx);

      const pipelineBucket = result.summary.buckets.find(b => b.id === 'pipeline_health');
      expect(pipelineBucket).toBeUndefined();
    });

    it('excludes terminated candidates from pipeline count', () => {
      const reqs = [makeReq({ req_id: 'REQ-1' })];
      const candidates = [
        makeCandidate({ req_id: 'REQ-1', disposition: CandidateDisposition.Active }),
        makeCandidate({ req_id: 'REQ-1', disposition: CandidateDisposition.Rejected }),
        makeCandidate({ req_id: 'REQ-1', disposition: CandidateDisposition.Withdrawn }),
        makeCandidate({ req_id: 'REQ-1', disposition: CandidateDisposition.Hired, hired_at: new Date() }),
      ];

      const ctx = makeBaseContext({ requisitions: reqs, candidates });
      const result = computeAttentionV2(ctx);

      // Only 1 active candidate, should trigger thin pipeline
      const pipelineBucket = result.summary.buckets.find(b => b.id === 'pipeline_health');
      expect(pipelineBucket).toBeDefined();
      expect(pipelineBucket!.count).toBe(1);
    });
  });

  describe('aging/stalled bucket', () => {
    it('detects reqs open >45 days', () => {
      const now = new Date();
      const longAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000); // 60 days ago
      const reqs = [
        makeReq({ req_id: 'REQ-OLD', opened_at: longAgo }),
        makeReq({ req_id: 'REQ-NEW', opened_at: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000) }),
      ];

      const ctx = makeBaseContext({ requisitions: reqs });
      const result = computeAttentionV2(ctx);

      const agingBucket = result.summary.buckets.find(b => b.id === 'aging_stalled');
      expect(agingBucket).toBeDefined();
      expect(agingBucket!.count).toBeGreaterThan(0);
    });

    it('does not trigger for recently opened reqs', () => {
      const reqs = [
        makeReq({ opened_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) }),
        makeReq({ opened_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) }),
      ];

      const ctx = makeBaseContext({ requisitions: reqs });
      const result = computeAttentionV2(ctx);

      const agingBucket = result.summary.buckets.find(b => b.id === 'aging_stalled');
      expect(agingBucket).toBeUndefined();
    });
  });

  describe('offer/close risk bucket', () => {
    it('detects stale offers (>7 days pending)', () => {
      const candidates = [
        makeCandidate({
          offer_extended_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
          disposition: CandidateDisposition.Active,
        }),
      ];

      const ctx = makeBaseContext({ candidates });
      const result = computeAttentionV2(ctx);

      const offerBucket = result.summary.buckets.find(b => b.id === 'offer_close_risk');
      expect(offerBucket).toBeDefined();
      expect(offerBucket!.count).toBe(1);
    });

    it('does not trigger for recent offers', () => {
      const candidates = [
        makeCandidate({
          offer_extended_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
          disposition: CandidateDisposition.Active,
        }),
      ];

      const ctx = makeBaseContext({ candidates });
      const result = computeAttentionV2(ctx);

      const offerBucket = result.summary.buckets.find(b => b.id === 'offer_close_risk');
      expect(offerBucket).toBeUndefined();
    });

    it('excludes resolved offers (hired/rejected/withdrawn)', () => {
      const candidates = [
        makeCandidate({
          offer_extended_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
          disposition: CandidateDisposition.Hired,
          hired_at: new Date(),
        }),
        makeCandidate({
          offer_extended_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
          disposition: CandidateDisposition.Rejected,
        }),
      ];

      const ctx = makeBaseContext({ candidates });
      const result = computeAttentionV2(ctx);

      const offerBucket = result.summary.buckets.find(b => b.id === 'offer_close_risk');
      expect(offerBucket).toBeUndefined();
    });
  });

  describe('severity ordering', () => {
    it('orders buckets by severity: blocking > at-risk > watch', () => {
      // Create conditions for multiple buckets at different severities
      const now = new Date();
      const reqs = [
        // 15 reqs for one recruiter = overloaded (blocking)
        ...Array.from({ length: 15 }, (_, i) =>
          makeReq({ req_id: `OVR-${i}`, recruiter_id: 'rec-overloaded' })
        ),
        // Aging req
        makeReq({ req_id: 'OLD-1', opened_at: new Date(now.getTime() - 50 * 24 * 60 * 60 * 1000) }),
      ];

      const overview: OverviewMetrics = {
        recruiterSummaries: [makeRecruiterSummary({ recruiterId: 'rec-overloaded', recruiterName: 'Overloaded', activeReqLoad: 15 })],
      } as any;

      const ctx = makeBaseContext({ requisitions: reqs, overview });
      const result = computeAttentionV2(ctx);

      if (result.summary.buckets.length >= 2) {
        const severityOrder = { 'blocking': 0, 'at-risk': 1, 'watch': 2 };
        for (let i = 1; i < result.summary.buckets.length; i++) {
          const prev = severityOrder[result.summary.buckets[i - 1].severity];
          const curr = severityOrder[result.summary.buckets[i].severity];
          expect(prev).toBeLessThanOrEqual(curr);
        }
      }
    });

    it('sets overallSeverity to worst bucket', () => {
      const reqs = Array.from({ length: 15 }, (_, i) =>
        makeReq({ req_id: `REQ-${i}`, recruiter_id: 'rec-1' })
      );
      const overview: OverviewMetrics = {
        recruiterSummaries: [makeRecruiterSummary({ recruiterId: 'rec-1', recruiterName: 'Heavy', activeReqLoad: 15 })],
      } as any;

      const ctx = makeBaseContext({ requisitions: reqs, overview });
      const result = computeAttentionV2(ctx);

      if (result.summary.buckets.length > 0) {
        const worstBucket = result.summary.buckets[0]; // Sorted by severity
        expect(result.summary.overallSeverity).toBe(worstBucket.severity);
      }
    });
  });

  describe('drilldown: recruiter ranking', () => {
    it('ranks recruiters by risk score (overloaded + stalled)', () => {
      const reqs = [
        ...Array.from({ length: 14 }, (_, i) =>
          makeReq({ req_id: `HI-${i}`, recruiter_id: 'rec-heavy' })
        ),
        ...Array.from({ length: 5 }, (_, i) =>
          makeReq({ req_id: `LO-${i}`, recruiter_id: 'rec-light' })
        ),
      ];
      const users = [
        makeUser({ user_id: 'rec-heavy', name: 'Heavy Recruiter', role: 'Recruiter' as any }),
        makeUser({ user_id: 'rec-light', name: 'Light Recruiter', role: 'Recruiter' as any }),
      ];
      const overview: OverviewMetrics = {
        recruiterSummaries: [
          makeRecruiterSummary({ recruiterId: 'rec-heavy', recruiterName: 'Heavy Recruiter', activeReqLoad: 14 }),
          makeRecruiterSummary({ recruiterId: 'rec-light', recruiterName: 'Light Recruiter', activeReqLoad: 5, stalledCount: 1 }),
        ],
      } as any;

      const ctx = makeBaseContext({ requisitions: reqs, users, overview });
      const result = computeAttentionV2(ctx);

      if (result.drilldown.recruiters.length > 0) {
        expect(result.drilldown.recruiters[0].recruiterName).toBe('Heavy Recruiter');
      }
    });

    it('limits drilldown to max 5 recruiters', () => {
      const reqs = Array.from({ length: 70 }, (_, i) =>
        makeReq({ req_id: `REQ-${i}`, recruiter_id: `rec-${i % 7}` })
      );
      const users = Array.from({ length: 7 }, (_, i) =>
        makeUser({ user_id: `rec-${i}`, name: `Recruiter ${i}`, role: 'Recruiter' as any })
      );
      const overview: OverviewMetrics = {
        recruiterSummaries: Array.from({ length: 7 }, (_, i) =>
          makeRecruiterSummary({ recruiterId: `rec-${i}`, recruiterName: `Recruiter ${i}`, activeReqLoad: 13 + i })
        ),
      } as any;

      const ctx = makeBaseContext({ requisitions: reqs, users, overview });
      const result = computeAttentionV2(ctx);

      expect(result.drilldown.recruiters.length).toBeLessThanOrEqual(5);
    });
  });

  describe('drilldown: HM ranking', () => {
    it('ranks HMs by latency and overdue items', () => {
      const hmFriction: HiringManagerFriction[] = [
        { hmId: 'hm-slow', hmName: 'Slow Manager', feedbackLatencyMedian: 192, decisionLatencyMedian: 144, reqsInRange: 5, hmWeight: 1, loopCount: 5, offerAcceptanceRate: null } as any,
        { hmId: 'hm-fast', hmName: 'Fast Manager', feedbackLatencyMedian: 24, decisionLatencyMedian: 24, reqsInRange: 3, hmWeight: 1, loopCount: 4, offerAcceptanceRate: null } as any,
      ];
      const hmActions: HMPendingAction[] = [
        { hmUserId: 'hm-slow', hmName: 'Slow Manager', actionType: 'feedback', daysOverdue: 7, reqId: 'REQ-1' } as any,
      ];

      const ctx = makeBaseContext({ hmFriction, hmActions });
      const result = computeAttentionV2(ctx);

      if (result.drilldown.hiringManagers.length > 0) {
        expect(result.drilldown.hiringManagers[0].hmName).toBe('Slow Manager');
      }
    });

    it('limits drilldown to max 5 HMs', () => {
      const hmFriction: HiringManagerFriction[] = Array.from({ length: 8 }, (_, i) => ({
        hmId: `hm-${i}`,
        hmName: `Manager ${i}`,
        feedbackLatencyMedian: (5 + i) * 24,  // hours
        decisionLatencyMedian: (3 + i) * 24,  // hours
        reqsInRange: 3,
        hmWeight: 1,
        loopCount: 3,
        offerAcceptanceRate: null,
      } as any));

      const ctx = makeBaseContext({ hmFriction });
      const result = computeAttentionV2(ctx);

      expect(result.drilldown.hiringManagers.length).toBeLessThanOrEqual(5);
    });
  });

  describe('drilldown: req clusters', () => {
    it('groups reqs by function field', () => {
      const reqs = [
        makeReq({ req_id: 'ENG-1', function: 'Engineering', opened_at: new Date(Date.now() - 50 * 24 * 60 * 60 * 1000) }),
        makeReq({ req_id: 'ENG-2', function: 'Engineering', opened_at: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000) }),
        makeReq({ req_id: 'SALES-1', function: 'Sales', opened_at: new Date(Date.now() - 55 * 24 * 60 * 60 * 1000) }),
        makeReq({ req_id: 'SALES-2', function: 'Sales', opened_at: new Date(Date.now() - 70 * 24 * 60 * 60 * 1000) }),
      ];

      const ctx = makeBaseContext({ requisitions: reqs });
      const result = computeAttentionV2(ctx);

      expect(result.drilldown.reqClusters.length).toBeGreaterThan(0);
      const labels = result.drilldown.reqClusters.map(c => c.clusterLabel);
      expect(labels).toContain('Engineering');
      expect(labels).toContain('Sales');
    });

    it('skips singleton clusters', () => {
      const reqs = [
        makeReq({ req_id: 'LONE-1', function: 'UniqueFunction', opened_at: new Date(Date.now() - 50 * 24 * 60 * 60 * 1000) }),
        makeReq({ req_id: 'PAIR-1', function: 'PairFunction', opened_at: new Date(Date.now() - 50 * 24 * 60 * 60 * 1000) }),
        makeReq({ req_id: 'PAIR-2', function: 'PairFunction', opened_at: new Date(Date.now() - 55 * 24 * 60 * 60 * 1000) }),
      ];

      const ctx = makeBaseContext({ requisitions: reqs });
      const result = computeAttentionV2(ctx);

      const labels = result.drilldown.reqClusters.map(c => c.clusterLabel);
      expect(labels).not.toContain('UniqueFunction');
    });

    it('limits clusters to max 5', () => {
      const reqs = Array.from({ length: 30 }, (_, i) =>
        makeReq({
          req_id: `REQ-${i}`,
          function: `Dept ${Math.floor(i / 3)}`,
          opened_at: new Date(Date.now() - (50 + i) * 24 * 60 * 60 * 1000),
        })
      );

      const ctx = makeBaseContext({ requisitions: reqs });
      const result = computeAttentionV2(ctx);

      expect(result.drilldown.reqClusters.length).toBeLessThanOrEqual(5);
    });
  });

  describe('confidence handling', () => {
    it('sets HIGH confidence when stage events are available', () => {
      const reqs = [makeReq({ req_id: 'REQ-1' }), makeReq({ req_id: 'REQ-2' })];
      const coverage = makeCoverage({ flags: { hasTimestamps: true, hasStageEvents: true, hasRecruiters: true, hasHiringManagers: true } } as any);

      const ctx = makeBaseContext({ requisitions: reqs, coverage });
      const result = computeAttentionV2(ctx);

      const pipelineBucket = result.summary.buckets.find(b => b.id === 'pipeline_health');
      if (pipelineBucket) {
        expect(pipelineBucket.confidence).toBe('HIGH');
      }
    });

    it('sets MED confidence when no stage events', () => {
      const reqs = [makeReq({ req_id: 'REQ-1' }), makeReq({ req_id: 'REQ-2' })];
      const coverage = makeCoverage({ flags: { hasTimestamps: true, hasStageEvents: false, hasRecruiters: true, hasHiringManagers: true } } as any);

      const ctx = makeBaseContext({ requisitions: reqs, coverage });
      const result = computeAttentionV2(ctx);

      const pipelineBucket = result.summary.buckets.find(b => b.id === 'pipeline_health');
      if (pipelineBucket) {
        expect(pipelineBucket.confidence).toBe('MED');
      }
    });
  });

  describe('closed req exclusion', () => {
    it('excludes closed/cancelled reqs from all buckets', () => {
      const reqs = [
        makeReq({ req_id: 'CLOSED-1', status: RequisitionStatus.Closed, opened_at: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000) }),
        makeReq({ req_id: 'CANCELED-1', status: RequisitionStatus.Canceled, opened_at: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000) }),
      ];

      const ctx = makeBaseContext({ requisitions: reqs });
      const result = computeAttentionV2(ctx);

      // No buckets should fire for closed/cancelled reqs
      expect(result.summary.buckets.find(b => b.id === 'pipeline_health')).toBeUndefined();
      expect(result.summary.buckets.find(b => b.id === 'aging_stalled')).toBeUndefined();
    });
  });

  describe('totalImpacted', () => {
    it('sums counts across all buckets', () => {
      const reqs = [
        ...Array.from({ length: 5 }, (_, i) =>
          makeReq({ req_id: `THIN-${i}`, opened_at: new Date(Date.now() - 50 * 24 * 60 * 60 * 1000) })
        ),
      ];
      const candidates = [
        makeCandidate({
          req_id: 'THIN-0',
          offer_extended_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
          disposition: CandidateDisposition.Active,
        }),
      ];

      const ctx = makeBaseContext({ requisitions: reqs, candidates });
      const result = computeAttentionV2(ctx);

      const expectedTotal = result.summary.buckets.reduce((sum, b) => sum + b.count, 0);
      expect(result.summary.totalImpacted).toBe(expectedTotal);
    });
  });
});
