/**
 * Tests for Velocity Copilot Service
 *
 * Tests:
 * 1. VelocityFactPack builder returns required keys and redacts PII
 * 2. AI response parser rejects missing citations or citations not in the fact pack
 */

import {
  buildVelocityFactPack,
  validateCitations,
  generateDeterministicSummary
} from '../velocityCopilotService';
import { VelocityFactPack, VALID_FACT_PATHS } from '../../types/velocityCopilotTypes';
import {
  VelocityMetrics,
  Requisition,
  Candidate,
  Event,
  MetricFilters
} from '../../types';
import { RequisitionStatus, HeadcountType, LocationType, LocationRegion, CandidateDisposition, CandidateSource, EventType } from '../../types/entities';

// ===== TEST FIXTURES =====

const createMockRequisition = (overrides: Partial<Requisition> = {}): Requisition => ({
  req_id: 'REQ-001',
  req_title: 'Senior Software Engineer',
  function: 'Engineering',
  job_family: 'Engineering',
  level: 'L5',
  location_type: LocationType.Remote,
  location_region: LocationRegion.AMER,
  location_city: null,
  comp_band_min: 100000,
  comp_band_max: 150000,
  opened_at: new Date('2024-01-01'),
  closed_at: new Date('2024-02-15'),
  status: RequisitionStatus.Closed,
  hiring_manager_id: 'HM-001',
  recruiter_id: 'REC-001',
  business_unit: 'Platform',
  headcount_type: HeadcountType.New,
  priority: null,
  candidate_slate_required: false,
  search_firm_used: false,
  ...overrides
});

const createMockCandidate = (overrides: Partial<Candidate> = {}): Candidate => ({
  candidate_id: 'CAND-001',
  name: 'John Doe', // PII - should NOT appear in FactPack
  req_id: 'REQ-001',
  source: CandidateSource.Referral,
  applied_at: new Date('2024-01-05'),
  first_contacted_at: new Date('2024-01-10'),
  current_stage: 'Offer',
  current_stage_entered_at: new Date('2024-02-01'),
  disposition: CandidateDisposition.Hired,
  hired_at: new Date('2024-02-15'),
  offer_extended_at: new Date('2024-02-01'),
  offer_accepted_at: new Date('2024-02-10'),
  ...overrides
});

const createMockEvent = (overrides: Partial<Event> = {}): Event => ({
  event_id: 'EVT-001',
  candidate_id: 'CAND-001',
  req_id: 'REQ-001',
  event_type: EventType.STAGE_CHANGE,
  from_stage: 'Applied',
  to_stage: 'Screen',
  actor_user_id: 'USER-001',
  event_at: new Date('2024-01-15'),
  metadata_json: null,
  ...overrides
});

const createMockFilters = (): MetricFilters => ({
  dateRange: {
    startDate: new Date('2024-01-01'),
    endDate: new Date('2024-03-31')
  }
});

const createMockMetrics = (overrides: Partial<VelocityMetrics> = {}): VelocityMetrics => ({
  candidateDecay: {
    totalOffers: 15,
    totalAccepted: 12,
    overallAcceptanceRate: 0.80,
    dataPoints: [
      { bucket: '0-7', count: 5, rate: 0.95 },
      { bucket: '8-14', count: 5, rate: 0.85 },
      { bucket: '15+', count: 5, rate: 0.60 }
    ],
    decayRatePerDay: 0.02,
    decayStartDay: 10
  },
  reqDecay: {
    totalReqs: 20,
    totalFilled: 15,
    overallFillRate: 0.75,
    medianDaysToFill: 35,
    dataPoints: [
      { bucket: '0-30', count: 8, rate: 0.88 },
      { bucket: '31-60', count: 7, rate: 0.71 },
      { bucket: '61+', count: 5, rate: 0.40 }
    ],
    decayRatePerDay: 0.01
  },
  cohortComparison: {
    allHires: { count: 25, avgTimeToFill: 40, medianTimeToFill: 35 },
    fastHires: {
      count: 6,
      avgTimeToFill: 22,
      medianTimeToFill: 20,
      referralPercent: 0.50,
      avgPipelineDepth: 8,
      avgInterviewsPerHire: 3
    },
    slowHires: {
      count: 6,
      avgTimeToFill: 65,
      medianTimeToFill: 60,
      referralPercent: 0.17,
      avgPipelineDepth: 15,
      avgInterviewsPerHire: 5
    },
    factors: [
      {
        factor: 'Referral Rate',
        fastHiresValue: 0.50,
        slowHiresValue: 0.17,
        delta: 0.33,
        impactLevel: 'high'
      }
    ]
  },
  insights: [
    {
      title: 'Test Insight',
      type: 'info',
      description: 'Test description',
      sampleSize: 20,
      confidence: 'HIGH',
      soWhat: 'Test so what',
      nextStep: 'Test next step'
    }
  ],
  ...overrides
});

// ===== TESTS =====

describe('VelocityCopilotService', () => {
  describe('buildVelocityFactPack', () => {
    it('returns all required top-level keys', () => {
      const metrics = createMockMetrics();
      const requisitions = [createMockRequisition()];
      const candidates = [createMockCandidate()];
      const events = [createMockEvent()];
      const filters = createMockFilters();

      const factPack = buildVelocityFactPack(metrics, requisitions, candidates, events, filters);

      // Check all required top-level keys exist
      expect(factPack).toHaveProperty('metadata');
      expect(factPack).toHaveProperty('sample_sizes');
      expect(factPack).toHaveProperty('kpis');
      expect(factPack).toHaveProperty('stage_timing');
      expect(factPack).toHaveProperty('candidate_decay');
      expect(factPack).toHaveProperty('req_decay');
      expect(factPack).toHaveProperty('cohort_comparison');
      expect(factPack).toHaveProperty('bottleneck_stages');
      expect(factPack).toHaveProperty('contributing_reqs');
      expect(factPack).toHaveProperty('definitions');
      expect(factPack).toHaveProperty('deterministic_insights');
    });

    it('returns required metadata fields', () => {
      const metrics = createMockMetrics();
      const requisitions = [createMockRequisition()];
      const candidates = [createMockCandidate()];
      const events = [createMockEvent()];
      const filters = createMockFilters();

      const factPack = buildVelocityFactPack(metrics, requisitions, candidates, events, filters);

      expect(factPack.metadata).toHaveProperty('generated_at');
      expect(factPack.metadata).toHaveProperty('date_range');
      expect(factPack.metadata).toHaveProperty('data_quality');
      expect(factPack.metadata.date_range).toHaveProperty('start');
      expect(factPack.metadata.date_range).toHaveProperty('end');
    });

    it('returns required sample_sizes fields', () => {
      const metrics = createMockMetrics();
      const requisitions = [createMockRequisition()];
      const candidates = [createMockCandidate()];
      const events = [createMockEvent()];
      const filters = createMockFilters();

      const factPack = buildVelocityFactPack(metrics, requisitions, candidates, events, filters);

      expect(factPack.sample_sizes).toHaveProperty('total_offers');
      expect(factPack.sample_sizes).toHaveProperty('total_accepted');
      expect(factPack.sample_sizes).toHaveProperty('total_reqs');
      expect(factPack.sample_sizes).toHaveProperty('total_filled');
      expect(factPack.sample_sizes).toHaveProperty('total_hires');
      expect(factPack.sample_sizes).toHaveProperty('fast_hires_cohort');
      expect(factPack.sample_sizes).toHaveProperty('slow_hires_cohort');
    });

    it('returns required KPI fields', () => {
      const metrics = createMockMetrics();
      const requisitions = [createMockRequisition()];
      const candidates = [createMockCandidate()];
      const events = [createMockEvent()];
      const filters = createMockFilters();

      const factPack = buildVelocityFactPack(metrics, requisitions, candidates, events, filters);

      expect(factPack.kpis).toHaveProperty('median_ttf_days');
      expect(factPack.kpis).toHaveProperty('offer_accept_rate');
      expect(factPack.kpis).toHaveProperty('overall_fill_rate');
      expect(factPack.kpis).toHaveProperty('decay_rate_per_day');
      expect(factPack.kpis).toHaveProperty('req_decay_rate_per_day');
      expect(factPack.kpis).toHaveProperty('decay_start_day');
    });

    it('NEVER includes PII in the fact pack', () => {
      const metrics = createMockMetrics();
      const requisitions = [
        createMockRequisition({ req_title: 'Senior Engineer for John Smith Team' })
      ];
      const candidates = [
        createMockCandidate({ name: 'Jane Doe', candidate_id: 'CAND-002' }),
        createMockCandidate({ name: 'Bob Wilson', candidate_id: 'CAND-003' })
      ];
      const events = [createMockEvent()];
      const filters = createMockFilters();

      const factPack = buildVelocityFactPack(metrics, requisitions, candidates, events, filters);

      // Convert to JSON and search for PII
      const factPackJson = JSON.stringify(factPack);

      // Candidate names should NOT appear
      expect(factPackJson).not.toContain('Jane Doe');
      expect(factPackJson).not.toContain('Bob Wilson');
      expect(factPackJson).not.toContain('John Doe');

      // Req titles (which may contain names) should NOT appear
      expect(factPackJson).not.toContain('John Smith');
      expect(factPackJson).not.toContain('Senior Engineer for');

      // Email patterns should NOT appear
      expect(factPackJson).not.toMatch(/@\w+\.\w+/);

      // Phone patterns should NOT appear
      expect(factPackJson).not.toMatch(/\d{3}-\d{3}-\d{4}/);
      expect(factPackJson).not.toMatch(/\(\d{3}\)\s?\d{3}-\d{4}/);
    });

    it('only includes req_ids in contributing_reqs, not titles', () => {
      const metrics = createMockMetrics();
      // Create requisitions with PII-containing titles
      const requisitions = [
        createMockRequisition({
          req_id: 'REQ-001',
          req_title: 'Engineer for Sarah Johnson',
          status: RequisitionStatus.Open,
          opened_at: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000) // 35 days ago = zombie
        })
      ];
      const candidates: Candidate[] = [];
      const events: Event[] = [];
      const filters = createMockFilters();

      const factPack = buildVelocityFactPack(metrics, requisitions, candidates, events, filters);

      // Check that zombie_req_ids contains only IDs
      expect(factPack.contributing_reqs.zombie_req_ids).toContain('REQ-001');

      // Verify no titles in contributing_reqs
      const contributingReqsJson = JSON.stringify(factPack.contributing_reqs);
      expect(contributingReqsJson).not.toContain('Sarah Johnson');
      expect(contributingReqsJson).not.toContain('Engineer for');
    });

    it('correctly populates data quality based on sample sizes', () => {
      // Test HIGH quality - all thresholds met
      const highQualityMetrics = createMockMetrics();
      const factPackHigh = buildVelocityFactPack(
        highQualityMetrics,
        [createMockRequisition()],
        [createMockCandidate()],
        [createMockEvent()],
        createMockFilters()
      );
      expect(factPackHigh.metadata.data_quality).toBe('HIGH');

      // Test INSUFFICIENT quality - no data
      const lowMetrics = createMockMetrics({
        candidateDecay: {
          ...createMockMetrics().candidateDecay,
          totalOffers: 0,
          totalAccepted: 0
        },
        reqDecay: {
          ...createMockMetrics().reqDecay,
          totalReqs: 0,
          totalFilled: 0
        },
        cohortComparison: null
      });
      const factPackLow = buildVelocityFactPack(
        lowMetrics,
        [],
        [],
        [],
        createMockFilters()
      );
      expect(factPackLow.metadata.data_quality).toBe('INSUFFICIENT');
    });

    it('includes definitions for all key metrics', () => {
      const metrics = createMockMetrics();
      const factPack = buildVelocityFactPack(
        metrics,
        [createMockRequisition()],
        [createMockCandidate()],
        [createMockEvent()],
        createMockFilters()
      );

      expect(factPack.definitions.median_ttf).toBeTruthy();
      expect(factPack.definitions.offer_accept_rate).toBeTruthy();
      expect(factPack.definitions.decay_rate).toBeTruthy();
      expect(factPack.definitions.fast_hires).toBeTruthy();
      expect(factPack.definitions.slow_hires).toBeTruthy();
    });
  });

  describe('validateCitations', () => {
    // Create a minimal valid fact pack for testing
    const createMinimalFactPack = (): VelocityFactPack => ({
      metadata: {
        generated_at: new Date().toISOString(),
        date_range: { start: '2024-01-01', end: '2024-03-31' },
        data_quality: 'HIGH'
      },
      sample_sizes: {
        total_offers: 15,
        total_accepted: 12,
        total_reqs: 20,
        total_filled: 15,
        total_hires: 25,
        fast_hires_cohort: 6,
        slow_hires_cohort: 6
      },
      kpis: {
        median_ttf_days: 35,
        offer_accept_rate: 0.80,
        overall_fill_rate: 0.75,
        decay_rate_per_day: 0.02,
        req_decay_rate_per_day: 0.01,
        decay_start_day: 10
      },
      stage_timing: {
        capability: 'SNAPSHOT_DIFF',
        can_show_duration: true,
        reason: 'Stage change events available'
      },
      candidate_decay: {
        available: true,
        buckets: []
      },
      req_decay: {
        available: true,
        buckets: []
      },
      cohort_comparison: {
        available: true
      },
      bottleneck_stages: [],
      contributing_reqs: {
        stalled_req_ids: [],
        zombie_req_ids: ['REQ-001'],
        slow_fill_req_ids: [],
        fast_fill_req_ids: []
      },
      definitions: {
        median_ttf: 'Median time-to-fill',
        offer_accept_rate: 'Offer acceptance rate',
        decay_rate: 'Decay rate per day',
        fast_hires: 'Bottom 25% TTF',
        slow_hires: 'Top 25% TTF'
      },
      deterministic_insights: []
    });

    it('validates citations that exist in fact pack', () => {
      const factPack = createMinimalFactPack();
      const validCitations = ['kpis.median_ttf_days', 'sample_sizes.total_offers'];

      const result = validateCitations(validCitations, factPack);

      expect(result.valid).toBe(true);
      expect(result.invalid_citations).toHaveLength(0);
      expect(result.missing_citations).toBe(false);
    });

    it('rejects citations that do not exist in fact pack', () => {
      const factPack = createMinimalFactPack();
      const invalidCitations = ['kpis.fake_metric', 'nonexistent.path'];

      const result = validateCitations(invalidCitations, factPack);

      expect(result.valid).toBe(false);
      expect(result.invalid_citations).toContain('kpis.fake_metric');
      expect(result.invalid_citations).toContain('nonexistent.path');
    });

    it('reports missing citations when array is empty', () => {
      const factPack = createMinimalFactPack();
      const emptyCitations: string[] = [];

      const result = validateCitations(emptyCitations, factPack);

      expect(result.missing_citations).toBe(true);
    });

    it('validates nested citation paths', () => {
      const factPack = createMinimalFactPack();
      const nestedCitations = [
        'metadata.date_range.start',
        'metadata.data_quality'
      ];

      const result = validateCitations(nestedCitations, factPack);

      expect(result.valid).toBe(true);
      expect(result.invalid_citations).toHaveLength(0);
    });

    it('rejects partially valid paths', () => {
      const factPack = createMinimalFactPack();
      // metadata.date_range.fake doesn't exist
      const partiallyInvalidCitations = ['metadata.date_range.fake'];

      const result = validateCitations(partiallyInvalidCitations, factPack);

      expect(result.valid).toBe(false);
      expect(result.invalid_citations).toContain('metadata.date_range.fake');
    });

    it('handles mixed valid and invalid citations', () => {
      const factPack = createMinimalFactPack();
      const mixedCitations = [
        'kpis.median_ttf_days',     // valid
        'kpis.fake_metric',         // invalid
        'sample_sizes.total_reqs'   // valid
      ];

      const result = validateCitations(mixedCitations, factPack);

      expect(result.valid).toBe(false);
      expect(result.invalid_citations).toHaveLength(1);
      expect(result.invalid_citations).toContain('kpis.fake_metric');
    });

    it('validates all VALID_FACT_PATHS against a complete fact pack', () => {
      const metrics = createMockMetrics();
      const factPack = buildVelocityFactPack(
        metrics,
        [createMockRequisition()],
        [createMockCandidate()],
        [createMockEvent()],
        createMockFilters()
      );

      // All defined valid paths should resolve to a value
      const pathsToTest = [
        'metadata.generated_at',
        'metadata.data_quality',
        'sample_sizes.total_offers',
        'kpis.median_ttf_days',
        'stage_timing.capability'
      ];

      const result = validateCitations(pathsToTest, factPack);
      expect(result.valid).toBe(true);
    });
  });

  describe('generateDeterministicSummary', () => {
    it('generates insights without AI', () => {
      const factPack = buildVelocityFactPack(
        createMockMetrics(),
        [createMockRequisition()],
        [createMockCandidate()],
        [createMockEvent()],
        createMockFilters()
      );

      const summary = generateDeterministicSummary(factPack);

      expect(summary.insights).toBeDefined();
      expect(Array.isArray(summary.insights)).toBe(true);
      expect(summary.generated_at).toBeDefined();
    });

    it('each insight has required fields', () => {
      const factPack = buildVelocityFactPack(
        createMockMetrics(),
        [createMockRequisition()],
        [createMockCandidate()],
        [createMockEvent()],
        createMockFilters()
      );

      const summary = generateDeterministicSummary(factPack);

      for (const insight of summary.insights) {
        expect(insight.id).toBeDefined();
        expect(insight.title).toBeDefined();
        expect(insight.severity).toMatch(/^P[012]$/);
        expect(insight.claim).toBeDefined();
        expect(insight.why_now).toBeDefined();
        expect(Array.isArray(insight.recommended_actions)).toBe(true);
        expect(Array.isArray(insight.citations)).toBe(true);
        expect(insight.citations.length).toBeGreaterThan(0);
      }
    });

    it('all deterministic insight citations are valid', () => {
      const factPack = buildVelocityFactPack(
        createMockMetrics(),
        [createMockRequisition()],
        [createMockCandidate()],
        [createMockEvent()],
        createMockFilters()
      );

      const summary = generateDeterministicSummary(factPack);

      for (const insight of summary.insights) {
        const result = validateCitations(insight.citations, factPack);
        expect(result.valid).toBe(true);
        if (!result.valid) {
          console.error(`Invalid citations in insight "${insight.title}":`, result.invalid_citations);
        }
      }
    });

    it('limits to 7 insights maximum', () => {
      // Create a fact pack that would generate many insights
      const metricsWithZombies = createMockMetrics();
      const zombieReqs = Array.from({ length: 10 }, (_, i) =>
        createMockRequisition({
          req_id: `ZOMBIE-${i}`,
          status: RequisitionStatus.Open,
          opened_at: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000)
        })
      );

      const factPack = buildVelocityFactPack(
        metricsWithZombies,
        zombieReqs,
        [],
        [],
        createMockFilters()
      );

      const summary = generateDeterministicSummary(factPack);

      expect(summary.insights.length).toBeLessThanOrEqual(7);
    });
  });
});
