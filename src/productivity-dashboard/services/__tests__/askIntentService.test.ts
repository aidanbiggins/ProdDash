// Unit tests for Ask Intent Service
// Tests intent matching, keyword scoring, and all 10 intent handlers

import {
  matchIntent,
  handleDeterministicQuery,
  generateHelpResponse,
  ALL_HANDLERS,
  whatsOnFireHandler,
  topRisksHandler,
  topActionsHandler,
  whyTimeToOfferHandler,
  whyHMLatencyHandler,
  stalledReqsHandler,
  forecastGapHandler,
  velocitySummaryHandler,
  sourceMixSummaryHandler,
  capacitySummaryHandler,
  mostProductiveRecruiterHandler,
  hmWithMostOpenReqsHandler,
  bottleneckAnalysisHandler,
} from '../askIntentService';
import { AskFactPack, IntentHandler, IntentResponse } from '../../types/askTypes';

// ─────────────────────────────────────────────────────────────
// Test Fixtures
// ─────────────────────────────────────────────────────────────

function createMinimalFactPack(): AskFactPack {
  return {
    meta: {
      generated_at: new Date().toISOString(),
      org_id: 'org-123',
      org_name: 'Test Org',
      data_window: {
        start_date: '2024-01-01',
        end_date: '2024-03-01',
        days: 60,
      },
      sample_sizes: {
        total_reqs: 50,
        total_candidates: 200,
        total_hires: 20,
        total_offers: 25,
        total_events: 1000,
      },
      capability_flags: {
        has_stage_timing: true,
        has_source_data: true,
        has_hm_data: true,
        has_forecast_data: true,
        has_quality_data: false,
        ai_enabled: false,
      },
      data_health_score: 85,
    },
    control_tower: {
      kpis: {
        median_ttf: { value: 42, unit: 'days', threshold: { green: 45, yellow: 60, red: 90 }, status: 'green', n: 20, trend: null },
        offer_count: { value: 25, unit: 'count', threshold: { green: 10, yellow: 5, red: 0 }, status: 'green', n: 25, trend: null },
        accept_rate: { value: 80, unit: '%', threshold: { green: 80, yellow: 60, red: 40 }, status: 'green', n: 25, trend: null },
        stalled_reqs: { value: 5, unit: 'count', threshold: { green: 0, yellow: 5, red: 10 }, status: 'yellow', n: 50, trend: null },
        hm_latency: { value: 3.2, unit: 'days', threshold: { green: 2, yellow: 3, red: 5 }, status: 'yellow', n: 100, trend: null },
      },
      risk_summary: {
        total_at_risk: 8,
        by_type: {
          zombie: 3,
          stalled: 2,
          pipeline_gap: 2,
          hm_delay: 1,
        },
      },
      action_summary: {
        total_open: 15,
        p0_count: 3,
        p1_count: 7,
        p2_count: 5,
      },
    },
    explain: {
      time_to_offer: {
        metric_name: 'Time to Offer',
        value: 28,
        unit: 'days',
        top_drivers: [
          { factor: 'Interview scheduling', impact: '5 days', evidence_key: 'explain.time_to_offer.breakdown[0]' },
          { factor: 'HM feedback delay', impact: '3 days', evidence_key: 'explain.time_to_offer.breakdown[1]' },
        ],
        exclusions: ['Zombie reqs: 3'],
        confidence: 'high',
        n: 50,
      },
      hm_latency: {
        metric_name: 'HM Latency',
        value: 3.2,
        unit: 'days',
        top_drivers: [
          { factor: 'Remote HMs', impact: '0.5 days', evidence_key: 'explain.hm_latency.breakdown[0]' },
        ],
        exclusions: [],
        confidence: 'medium',
        n: 100,
      },
      accept_rate: {
        metric_name: 'Accept Rate',
        value: 80,
        unit: '%',
        top_drivers: [],
        exclusions: [],
        confidence: 'high',
        n: 25,
      },
      pipeline_health: {
        metric_name: 'Pipeline Health',
        value: null,
        unit: '',
        top_drivers: [],
        exclusions: [],
        confidence: 'low',
        n: 0,
      },
      source_effectiveness: {
        metric_name: 'Source Effectiveness',
        value: null,
        unit: '',
        top_drivers: [],
        exclusions: [],
        confidence: 'low',
        n: 0,
      },
    },
    actions: {
      top_p0: [
        {
          action_id: 'a1',
          title: 'Submit feedback for Senior Engineer candidate',
          owner_type: 'HIRING_MANAGER',
          owner_label: 'Manager 1',
          priority: 'P0',
          action_type: 'FEEDBACK_DUE',
          due_in_days: -2,
          req_id: 'REQ-001',
          req_title: 'Senior Engineer',
        },
        {
          action_id: 'a2',
          title: 'Source candidates for Product Manager',
          owner_type: 'RECRUITER',
          owner_label: 'Recruiter 1',
          priority: 'P0',
          action_type: 'SOURCE_CANDIDATES',
          due_in_days: 0,
          req_id: 'REQ-002',
          req_title: 'Product Manager',
        },
      ],
      top_p1: [
        {
          action_id: 'a3',
          title: 'Review stalled req',
          owner_type: 'RECRUITER',
          owner_label: 'Recruiter 2',
          priority: 'P1',
          action_type: 'REVIEW_STALLED_REQ',
          due_in_days: 3,
          req_id: 'REQ-003',
          req_title: 'Data Analyst',
        },
      ],
      by_owner_type: {
        recruiter: 8,
        hiring_manager: 5,
        ta_ops: 2,
      },
    },
    risks: {
      top_risks: [
        {
          risk_id: 'r1',
          req_id: 'REQ-001',
          req_title: 'Senior Engineer',
          risk_type: 'zombie',
          failure_mode: 'No activity for 30+ days',
          days_open: 90,
          candidate_count: 2,
          owner_label: 'Recruiter 1',
          top_driver: 'Stale pipeline',
        },
        {
          risk_id: 'r2',
          req_id: 'REQ-004',
          req_title: 'Designer',
          risk_type: 'pipeline_gap',
          failure_mode: 'Empty pipeline',
          days_open: 45,
          candidate_count: 0,
          owner_label: 'Recruiter 2',
          top_driver: 'No candidates sourced',
        },
      ],
      by_failure_mode: {
        zombie: [],
        stalled: [],
      },
    },
    forecast: {
      expected_hires: 15,
      pipeline_gap: 5,
      confidence: 'medium',
      open_reqs: 20,
      active_candidates: 80,
      probability_weighted_pipeline: 15.5,
    },
    velocity: {
      funnel: [
        { stage: 'APPLIED', candidate_count: 100, conversion_rate: 0.5, avg_days: null, is_bottleneck: false },
        { stage: 'SCREEN', candidate_count: 50, conversion_rate: 0.4, avg_days: null, is_bottleneck: true },
        { stage: 'ONSITE', candidate_count: 20, conversion_rate: 0.75, avg_days: null, is_bottleneck: false },
        { stage: 'OFFER', candidate_count: 15, conversion_rate: 0.8, avg_days: null, is_bottleneck: false },
        { stage: 'HIRED', candidate_count: 12, conversion_rate: null, avg_days: null, is_bottleneck: false },
      ],
      bottleneck_stage: 'SCREEN',
      avg_days_to_offer: 28,
      avg_days_to_hire: 35,
    },
    sources: {
      top_by_volume: [
        { source_name: 'LinkedIn', candidate_count: 80, hire_count: 10, conversion_rate: 0.125, quality_score: null },
        { source_name: 'Referral', candidate_count: 40, hire_count: 8, conversion_rate: 0.2, quality_score: null },
      ],
      top_by_conversion: [
        { source_name: 'Referral', candidate_count: 40, hire_count: 8, conversion_rate: 0.2, quality_score: null },
        { source_name: 'LinkedIn', candidate_count: 80, hire_count: 10, conversion_rate: 0.125, quality_score: null },
      ],
      total_sources: 5,
    },
    capacity: {
      total_recruiters: 5,
      avg_req_load: 10,
      overloaded_count: 1,
      underloaded_count: 1,
    },
    recruiter_performance: {
      available: true,
      top_by_hires: [
        {
          anonymized_id: 'anon_abc123',
          anonymized_label: 'Recruiter 1',
          open_reqs: 5,
          hires_in_period: 8,
          offers_in_period: 10,
          avg_ttf: 35,
          active_candidates: 25,
          productivity_score: 85,
        },
        {
          anonymized_id: 'anon_def456',
          anonymized_label: 'Recruiter 2',
          open_reqs: 4,
          hires_in_period: 6,
          offers_in_period: 8,
          avg_ttf: 40,
          active_candidates: 20,
          productivity_score: 72,
        },
      ],
      top_by_productivity: [
        {
          anonymized_id: 'anon_abc123',
          anonymized_label: 'Recruiter 1',
          open_reqs: 5,
          hires_in_period: 8,
          offers_in_period: 10,
          avg_ttf: 35,
          active_candidates: 25,
          productivity_score: 85,
        },
        {
          anonymized_id: 'anon_def456',
          anonymized_label: 'Recruiter 2',
          open_reqs: 4,
          hires_in_period: 6,
          offers_in_period: 8,
          avg_ttf: 40,
          active_candidates: 20,
          productivity_score: 72,
        },
      ],
      bottom_by_productivity: [
        {
          anonymized_id: 'anon_ghi789',
          anonymized_label: 'Recruiter 3',
          open_reqs: 3,
          hires_in_period: 2,
          offers_in_period: 3,
          avg_ttf: 55,
          active_candidates: 10,
          productivity_score: 45,
        },
      ],
      team_avg_productivity: 67,
      total_recruiters: 5,
      n: 5,
      confidence: 'high',
    },
    hiring_manager_ownership: {
      available: true,
      total_hiring_managers: 5,
      open_reqs_by_hm: [
        {
          anonymized_id: 'anon_hm_abc123',
          hm_label: 'HM 1',
          open_req_count: 8,
          req_ids: ['REQ-001', 'REQ-002', 'REQ-003', 'REQ-004', 'REQ-005', 'REQ-006', 'REQ-007', 'REQ-008'],
          avg_hm_latency: 2.5,
        },
        {
          anonymized_id: 'anon_hm_def456',
          hm_label: 'HM 2',
          open_req_count: 5,
          req_ids: ['REQ-009', 'REQ-010', 'REQ-011', 'REQ-012', 'REQ-013'],
          avg_hm_latency: 3.2,
        },
        {
          anonymized_id: 'anon_hm_ghi789',
          hm_label: 'HM 3',
          open_req_count: 3,
          req_ids: ['REQ-014', 'REQ-015', 'REQ-016'],
          avg_hm_latency: 1.8,
        },
      ],
      n: 5,
      confidence: 'high',
    },
    bottlenecks: {
      available: true,
      top_stages: [
        {
          stage: 'HM_SCREEN',
          display_name: 'HM Interview',
          median_hours: 96,
          sla_hours: 72,
          breach_rate: 0.35,
          bottleneck_score: 1.8,
        },
        {
          stage: 'SCREEN',
          display_name: 'Recruiter Screen',
          median_hours: 48,
          sla_hours: 48,
          breach_rate: 0.15,
          bottleneck_score: 0.9,
        },
        {
          stage: 'ONSITE',
          display_name: 'Onsite Interview',
          median_hours: 120,
          sla_hours: 168,
          breach_rate: 0.08,
          bottleneck_score: 0.5,
        },
      ],
      summary: {
        total_breaches: 25,
        total_breach_hours: 480,
        breaches_by_owner_type: { HM: 18, RECRUITER: 7 },
        worst_stage: 'HM_SCREEN',
        worst_owner_type: 'HM',
      },
      coverage: {
        is_sufficient: true,
        snapshot_count: 15,
        day_span: 30,
        coverage_percent: 85,
      },
      deep_link: '/diagnose/bottlenecks',
    },
    glossary: [
      { term: 'TTF', definition: 'Time to Fill', formula: 'hired_at - opened_at', example: null },
    ],
  } as AskFactPack;
}

// ─────────────────────────────────────────────────────────────
// Intent Matching Tests
// ─────────────────────────────────────────────────────────────

describe('matchIntent', () => {
  describe('pattern matching (Phase 1)', () => {
    it('should match "what\'s on fire"', () => {
      const result = matchIntent("what's on fire", ALL_HANDLERS);
      expect(result?.intent_id).toBe('whats_on_fire');
    });

    it('should match "what is on fire"', () => {
      const result = matchIntent('what is on fire', ALL_HANDLERS);
      expect(result?.intent_id).toBe('whats_on_fire');
    });

    it('should match urgent/critical queries', () => {
      const result = matchIntent('show me urgent issues', ALL_HANDLERS);
      expect(result?.intent_id).toBe('whats_on_fire');
    });

    it('should match risk queries', () => {
      const result = matchIntent('show me my risks', ALL_HANDLERS);
      expect(result?.intent_id).toBe('top_risks');
    });

    it('should match action queries', () => {
      const result = matchIntent('what should I do today?', ALL_HANDLERS);
      expect(result?.intent_id).toBe('top_actions');
    });

    it('should match time to offer queries', () => {
      const result = matchIntent('why is time to offer so high?', ALL_HANDLERS);
      expect(result?.intent_id).toBe('why_time_to_offer');
    });

    it('should match HM latency queries', () => {
      const result = matchIntent('why is HM latency high?', ALL_HANDLERS);
      expect(result?.intent_id).toBe('why_hm_latency');
    });

    it('should match stalled req queries', () => {
      const result = matchIntent('show me stalled reqs', ALL_HANDLERS);
      expect(result?.intent_id).toBe('stalled_reqs');
    });

    it('should match forecast queries', () => {
      const result = matchIntent('show me the forecast', ALL_HANDLERS);
      expect(result?.intent_id).toBe('forecast_gap');
    });

    it('should match velocity queries', () => {
      const result = matchIntent('how is velocity?', ALL_HANDLERS);
      expect(result?.intent_id).toBe('velocity_summary');
    });

    it('should match source queries', () => {
      const result = matchIntent('which sources are performing?', ALL_HANDLERS);
      expect(result?.intent_id).toBe('source_mix_summary');
    });

    it('should match capacity queries', () => {
      const result = matchIntent('how is team capacity?', ALL_HANDLERS);
      expect(result?.intent_id).toBe('capacity_summary');
    });

    it('should match bottleneck queries', () => {
      const result = matchIntent('show me bottleneck analysis', ALL_HANDLERS);
      expect(result?.intent_id).toBe('bottleneck_analysis');
    });

    it('should match SLA breach queries', () => {
      const result = matchIntent('show me SLA breaches', ALL_HANDLERS);
      expect(result?.intent_id).toBe('bottleneck_analysis');
    });

    it('should match stage delay queries', () => {
      const result = matchIntent('which stage has the most delay?', ALL_HANDLERS);
      expect(result?.intent_id).toBe('bottleneck_analysis');
    });

    it('should match "most productive recruiter" queries', () => {
      const result = matchIntent('who is the most productive recruiter?', ALL_HANDLERS);
      expect(result?.intent_id).toBe('most_productive_recruiter');
    });

    it('should match "top recruiter" queries', () => {
      const result = matchIntent('show me the top recruiter', ALL_HANDLERS);
      expect(result?.intent_id).toBe('most_productive_recruiter');
    });

    it('should match "best recruiter" queries', () => {
      const result = matchIntent('who is the best recruiter?', ALL_HANDLERS);
      expect(result?.intent_id).toBe('most_productive_recruiter');
    });

    it('should match "recruiter leaderboard" queries', () => {
      const result = matchIntent('show me the recruiter leaderboard', ALL_HANDLERS);
      expect(result?.intent_id).toBe('most_productive_recruiter');
    });

    it('should match "which HM has most reqs" queries', () => {
      const result = matchIntent('which hiring manager has the most reqs?', ALL_HANDLERS);
      expect(result?.intent_id).toBe('hm_with_most_open_reqs');
    });

    it('should match "hm with most open requisitions" queries', () => {
      const result = matchIntent('which manager has the most open requisitions?', ALL_HANDLERS);
      expect(result?.intent_id).toBe('hm_with_most_open_reqs');
    });

    it('should match "show me HM with most reqs" queries', () => {
      const result = matchIntent('hm with most reqs', ALL_HANDLERS);
      expect(result?.intent_id).toBe('hm_with_most_open_reqs');
    });
  });

  describe('keyword matching (Phase 2)', () => {
    it('should fall back to keyword matching when no pattern matches', () => {
      // This query doesn't match exact patterns but has keywords
      const result = matchIntent('tell me about my urgent critical burning things', ALL_HANDLERS);
      expect(result?.intent_id).toBe('whats_on_fire');
    });

    it('should return null for completely unrelated queries', () => {
      const result = matchIntent('what is the weather like?', ALL_HANDLERS);
      expect(result).toBeNull();
    });

    it('should require 40% keyword match threshold', () => {
      // "risk" alone should match (1/5 keywords for top_risks = 20%)
      // But "risks problems" should (2/5 = 40%)
      const result = matchIntent('show all risks and problems', ALL_HANDLERS);
      expect(result?.intent_id).toBe('top_risks');
    });
  });

  describe('case insensitivity', () => {
    it('should match regardless of case', () => {
      expect(matchIntent("WHAT'S ON FIRE", ALL_HANDLERS)?.intent_id).toBe('whats_on_fire');
      expect(matchIntent('Show Me My RISKS', ALL_HANDLERS)?.intent_id).toBe('top_risks');
    });
  });
});

// ─────────────────────────────────────────────────────────────
// Handler Tests
// ─────────────────────────────────────────────────────────────

describe('Intent Handlers', () => {
  const factPack = createMinimalFactPack();

  describe('whatsOnFireHandler', () => {
    it('should return markdown with P0 actions', () => {
      const response = whatsOnFireHandler.handler(factPack);

      expect(response.answer_markdown).toContain('What\'s On Fire');
      expect(response.answer_markdown).toContain('Critical Actions');
      expect(response.citations.length).toBeGreaterThan(0);
    });

    it('should cite P0 actions correctly', () => {
      const response = whatsOnFireHandler.handler(factPack);

      expect(response.citations.some(c => c.key_path.includes('actions.top_p0'))).toBe(true);
    });

    it('should include zombie and stalled counts', () => {
      const response = whatsOnFireHandler.handler(factPack);

      expect(response.answer_markdown).toContain('zombie');
      expect(response.answer_markdown).toContain('stalled');
    });

    it('should include deep links', () => {
      const response = whatsOnFireHandler.handler(factPack);

      expect(response.deep_links.length).toBeGreaterThan(0);
      expect(response.deep_links.some(d => d.tab === 'control-tower')).toBe(true);
    });

    it('should handle empty P0 actions gracefully', () => {
      const emptyFactPack = {
        ...factPack,
        actions: { ...factPack.actions, top_p0: [] },
        control_tower: {
          ...factPack.control_tower,
          risk_summary: { total_at_risk: 0, by_type: {} },
          kpis: {
            ...factPack.control_tower.kpis,
            stalled_reqs: { ...factPack.control_tower.kpis.stalled_reqs, value: 0 },
          },
        },
      };

      const response = whatsOnFireHandler.handler(emptyFactPack);
      expect(response.answer_markdown).toContain('Good news');
    });
  });

  describe('topRisksHandler', () => {
    it('should return risk summary', () => {
      const response = topRisksHandler.handler(factPack);

      expect(response.answer_markdown).toContain('Top Risks');
      expect(response.answer_markdown).toContain('8 requisitions at risk');
    });

    it('should list top risks', () => {
      const response = topRisksHandler.handler(factPack);

      expect(response.answer_markdown).toContain('Senior Engineer');
      expect(response.answer_markdown).toContain('Designer');
    });

    it('should include risk breakdown by type', () => {
      const response = topRisksHandler.handler(factPack);

      expect(response.answer_markdown).toContain('Risk Breakdown');
    });
  });

  describe('topActionsHandler', () => {
    it('should return action summary', () => {
      const response = topActionsHandler.handler(factPack);

      expect(response.answer_markdown).toContain('Top Actions');
      expect(response.answer_markdown).toContain('15 open actions');
    });

    it('should show P0 and P1 actions', () => {
      const response = topActionsHandler.handler(factPack);

      expect(response.answer_markdown).toContain('Critical (P0)');
      expect(response.answer_markdown).toContain('High Priority (P1)');
    });

    it('should show actions by owner type', () => {
      const response = topActionsHandler.handler(factPack);

      expect(response.answer_markdown).toContain('By Owner');
      expect(response.answer_markdown).toContain('Recruiter: 8');
      expect(response.answer_markdown).toContain('Hiring Manager: 5');
    });
  });

  describe('whyTimeToOfferHandler', () => {
    it('should explain time to offer metric', () => {
      const response = whyTimeToOfferHandler.handler(factPack);

      expect(response.answer_markdown).toContain('Time to Offer');
      expect(response.answer_markdown).toContain('28');
    });

    it('should list top drivers', () => {
      const response = whyTimeToOfferHandler.handler(factPack);

      expect(response.answer_markdown).toContain('Top Drivers');
      expect(response.answer_markdown).toContain('Interview scheduling');
    });

    it('should identify bottleneck stage', () => {
      const response = whyTimeToOfferHandler.handler(factPack);

      expect(response.answer_markdown).toContain('SCREEN');
      expect(response.answer_markdown).toContain('bottleneck');
    });
  });

  describe('whyHMLatencyHandler', () => {
    it('should explain HM latency', () => {
      const response = whyHMLatencyHandler.handler(factPack);

      expect(response.answer_markdown).toContain('HM Latency');
      expect(response.answer_markdown).toContain('3.2');
    });

    it('should show pending HM actions', () => {
      const response = whyHMLatencyHandler.handler(factPack);

      expect(response.answer_markdown).toContain('Pending HM Actions');
      expect(response.answer_markdown).toContain('5 actions');
    });

    it('should include threshold guidance', () => {
      const response = whyHMLatencyHandler.handler(factPack);

      expect(response.answer_markdown).toContain('Target Thresholds');
      expect(response.answer_markdown).toContain('Green');
    });
  });

  describe('stalledReqsHandler', () => {
    it('should summarize stalled and zombie reqs', () => {
      const response = stalledReqsHandler.handler(factPack);

      expect(response.answer_markdown).toContain('Stalled Requisitions');
      expect(response.answer_markdown).toContain('5'); // stalled
      expect(response.answer_markdown).toContain('3'); // zombie
    });

    it('should include recommended actions', () => {
      const response = stalledReqsHandler.handler(factPack);

      expect(response.answer_markdown).toContain('Recommended Actions');
    });
  });

  describe('forecastGapHandler', () => {
    it('should show forecast summary', () => {
      const response = forecastGapHandler.handler(factPack);

      expect(response.answer_markdown).toContain('Hiring Forecast');
      expect(response.answer_markdown).toContain('Expected Hires');
      expect(response.answer_markdown).toContain('15');
    });

    it('should show pipeline gap', () => {
      const response = forecastGapHandler.handler(factPack);

      expect(response.answer_markdown).toContain('Pipeline Gap');
      expect(response.answer_markdown).toContain('5');
    });

    it('should include recommendations when gap exists', () => {
      const response = forecastGapHandler.handler(factPack);

      expect(response.answer_markdown).toContain('Gap Analysis');
      expect(response.answer_markdown).toContain('5 hires short');
    });
  });

  describe('velocitySummaryHandler', () => {
    it('should show velocity metrics', () => {
      const response = velocitySummaryHandler.handler(factPack);

      expect(response.answer_markdown).toContain('Velocity Summary');
      expect(response.answer_markdown).toContain('35 days');
    });

    it('should show funnel stages', () => {
      const response = velocitySummaryHandler.handler(factPack);

      expect(response.answer_markdown).toContain('Funnel');
      expect(response.answer_markdown).toContain('APPLIED');
      expect(response.answer_markdown).toContain('SCREEN');
    });

    it('should highlight bottleneck', () => {
      const response = velocitySummaryHandler.handler(factPack);

      expect(response.answer_markdown).toContain('SCREEN');
    });
  });

  describe('sourceMixSummaryHandler', () => {
    it('should show source breakdown', () => {
      const response = sourceMixSummaryHandler.handler(factPack);

      expect(response.answer_markdown).toContain('Source Mix Summary');
      expect(response.answer_markdown).toContain('LinkedIn');
      expect(response.answer_markdown).toContain('Referral');
    });

    it('should show both volume and conversion rankings', () => {
      const response = sourceMixSummaryHandler.handler(factPack);

      expect(response.answer_markdown).toContain('Top Sources by Volume');
      expect(response.answer_markdown).toContain('Top Sources by Conversion');
    });
  });

  describe('capacitySummaryHandler', () => {
    it('should show capacity overview', () => {
      const response = capacitySummaryHandler.handler(factPack);

      expect(response.answer_markdown).toContain('Capacity Summary');
      expect(response.answer_markdown).toContain('5'); // total recruiters
      expect(response.answer_markdown).toContain('10'); // avg load
    });

    it('should show load distribution', () => {
      const response = capacitySummaryHandler.handler(factPack);

      expect(response.answer_markdown).toContain('Load Distribution');
      expect(response.answer_markdown).toContain('Overloaded');
      expect(response.answer_markdown).toContain('Underloaded');
    });
  });

  describe('mostProductiveRecruiterHandler', () => {
    it('should return recruiter leaderboard with citations', () => {
      const response = mostProductiveRecruiterHandler.handler(factPack);

      expect(response.answer_markdown).toContain('Recruiter 1');
      expect(response.answer_markdown).toContain('85'); // productivity score
      expect(response.citations.length).toBeGreaterThan(0);
    });

    it('should cite recruiter_performance key paths', () => {
      const response = mostProductiveRecruiterHandler.handler(factPack);

      expect(response.citations.some(c => c.key_path.includes('recruiter_performance'))).toBe(true);
    });

    it('should include deep links', () => {
      const response = mostProductiveRecruiterHandler.handler(factPack);

      expect(response.deep_links.length).toBeGreaterThan(0);
    });

    it('should handle unavailable recruiter data gracefully', () => {
      const unavailableFactPack = {
        ...factPack,
        recruiter_performance: {
          available: false,
          unavailable_reason: 'No recruiter data in dataset',
          top_by_hires: [],
          top_by_productivity: [],
          bottom_by_productivity: [],
          team_avg_productivity: null,
          total_recruiters: 0,
          n: 0,
          confidence: 'low' as const,
        },
      };

      const response = mostProductiveRecruiterHandler.handler(unavailableFactPack);

      expect(response.answer_markdown).toContain('Data not available');
    });

    it('should show team average productivity', () => {
      const response = mostProductiveRecruiterHandler.handler(factPack);

      expect(response.answer_markdown).toContain('Team average productivity');
      expect(response.answer_markdown).toContain('67'); // team avg
    });

    it('should include suggested questions', () => {
      const response = mostProductiveRecruiterHandler.handler(factPack);

      expect(response.suggested_questions).toBeDefined();
      expect(response.suggested_questions!.length).toBeGreaterThan(0);
    });
  });

  describe('hmWithMostOpenReqsHandler', () => {
    it('should return HM leaderboard with citations', () => {
      const response = hmWithMostOpenReqsHandler.handler(factPack);

      expect(response.answer_markdown).toContain('HM 1');
      expect(response.answer_markdown).toContain('8'); // open req count
      expect(response.citations.length).toBeGreaterThan(0);
    });

    it('should cite hiring_manager_ownership key paths', () => {
      const response = hmWithMostOpenReqsHandler.handler(factPack);

      expect(response.citations.some(c => c.key_path.includes('hiring_manager_ownership'))).toBe(true);
    });

    it('should include deep links', () => {
      const response = hmWithMostOpenReqsHandler.handler(factPack);

      expect(response.deep_links.length).toBeGreaterThan(0);
    });

    it('should handle unavailable HM data gracefully', () => {
      const unavailableFactPack = {
        ...factPack,
        hiring_manager_ownership: {
          available: false,
          unavailable_reason: 'No HM data in dataset',
          total_hiring_managers: 0,
          open_reqs_by_hm: [],
          n: 0,
          confidence: 'low' as const,
        },
      };

      const response = hmWithMostOpenReqsHandler.handler(unavailableFactPack);

      expect(response.answer_markdown).toContain('Data not available');
    });

    it('should show total hiring manager count', () => {
      const response = hmWithMostOpenReqsHandler.handler(factPack);

      expect(response.answer_markdown).toContain('5'); // total HMs
    });

    it('should include suggested questions', () => {
      const response = hmWithMostOpenReqsHandler.handler(factPack);

      expect(response.suggested_questions).toBeDefined();
      expect(response.suggested_questions!.length).toBeGreaterThan(0);
    });

    it('should show HM latency if available', () => {
      const response = hmWithMostOpenReqsHandler.handler(factPack);

      // HM 1 has avg_hm_latency of 2.5
      expect(response.answer_markdown).toContain('2.5');
    });
  });

  describe('bottleneckAnalysisHandler', () => {
    it('should return bottleneck summary with citations', () => {
      const response = bottleneckAnalysisHandler.handler(factPack);

      expect(response.answer_markdown).toContain('Bottleneck');
      expect(response.answer_markdown).toContain('HM Interview');
      expect(response.citations.length).toBeGreaterThan(0);
    });

    it('should cite bottlenecks key paths', () => {
      const response = bottleneckAnalysisHandler.handler(factPack);

      expect(response.citations.some(c => c.key_path.includes('bottlenecks'))).toBe(true);
    });

    it('should include deep links to bottlenecks page', () => {
      const response = bottleneckAnalysisHandler.handler(factPack);

      expect(response.deep_links.length).toBeGreaterThan(0);
      expect(response.deep_links.some(d => d.tab === 'bottlenecks')).toBe(true);
    });

    it('should handle unavailable bottleneck data gracefully', () => {
      const unavailableFactPack = {
        ...factPack,
        bottlenecks: {
          available: false,
          unavailable_reason: 'No snapshot data available',
          top_stages: [],
          summary: {
            total_breaches: 0,
            total_breach_hours: 0,
            breaches_by_owner_type: {},
            worst_stage: null,
            worst_owner_type: null,
          },
          coverage: {
            is_sufficient: false,
            snapshot_count: 0,
            day_span: 0,
            coverage_percent: 0,
          },
          deep_link: '/diagnose/bottlenecks' as const,
        },
      };

      const response = bottleneckAnalysisHandler.handler(unavailableFactPack);

      expect(response.answer_markdown).toContain('don\'t have enough snapshot data');
    });

    it('should show breach counts and owner attribution', () => {
      const response = bottleneckAnalysisHandler.handler(factPack);

      expect(response.answer_markdown).toContain('25'); // total breaches
      expect(response.answer_markdown).toContain('HM'); // worst owner type
    });

    it('should include suggested questions', () => {
      const response = bottleneckAnalysisHandler.handler(factPack);

      expect(response.suggested_questions).toBeDefined();
      expect(response.suggested_questions!.length).toBeGreaterThan(0);
    });
  });
});

// ─────────────────────────────────────────────────────────────
// Deterministic Query Handler Tests
// ─────────────────────────────────────────────────────────────

describe('handleDeterministicQuery', () => {
  const factPack = createMinimalFactPack();

  it('should route to correct handler', () => {
    const response = handleDeterministicQuery("what's on fire?", factPack);
    expect(response.answer_markdown).toContain('What\'s On Fire');
  });

  it('should return help response for unmatched queries', () => {
    const response = handleDeterministicQuery('random unrelated question', factPack);
    expect(response.answer_markdown).toContain('Ask PlatoVue');
    expect(response.answer_markdown).toContain('Try asking');
  });

  it('should always include suggested questions', () => {
    const response = handleDeterministicQuery('show me risks', factPack);
    expect(response.suggested_questions).toBeDefined();
    expect(response.suggested_questions!.length).toBeGreaterThan(0);
  });

  it('should always include deep links', () => {
    const response = handleDeterministicQuery('what should I do?', factPack);
    expect(response.deep_links).toBeDefined();
    expect(response.deep_links.length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
// Help Response Tests
// ─────────────────────────────────────────────────────────────

describe('generateHelpResponse', () => {
  const factPack = createMinimalFactPack();

  it('should list all available intents', () => {
    const response = generateHelpResponse(factPack);

    expect(response.answer_markdown).toContain('What\'s on fire');
    expect(response.answer_markdown).toContain('risks');
    expect(response.answer_markdown).toContain('actions');
    expect(response.answer_markdown).toContain('time to offer');
    expect(response.answer_markdown).toContain('HM latency');
    expect(response.answer_markdown).toContain('Stalled');
    expect(response.answer_markdown).toContain('Forecast');
    expect(response.answer_markdown).toContain('Velocity');
    expect(response.answer_markdown).toContain('Sources');
    expect(response.answer_markdown).toContain('Capacity');
    expect(response.answer_markdown).toContain('Bottlenecks');
  });

  it('should include suggested questions', () => {
    const response = generateHelpResponse(factPack);
    expect(response.suggested_questions?.length).toBeGreaterThan(0);
  });

  it('should link to control tower', () => {
    const response = generateHelpResponse(factPack);
    expect(response.deep_links.some(d => d.tab === 'control-tower')).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────
// Response Structure Tests
// ─────────────────────────────────────────────────────────────

describe('Response Structure', () => {
  const factPack = createMinimalFactPack();

  it('should always include required fields', () => {
    ALL_HANDLERS.forEach(handler => {
      const response = handler.handler(factPack);

      expect(response).toHaveProperty('answer_markdown');
      expect(response).toHaveProperty('citations');
      expect(response).toHaveProperty('deep_links');
      expect(typeof response.answer_markdown).toBe('string');
      expect(Array.isArray(response.citations)).toBe(true);
      expect(Array.isArray(response.deep_links)).toBe(true);
    });
  });

  it('should have valid citation structure', () => {
    ALL_HANDLERS.forEach(handler => {
      const response = handler.handler(factPack);

      response.citations.forEach(citation => {
        expect(citation).toHaveProperty('ref');
        expect(citation).toHaveProperty('key_path');
        expect(citation).toHaveProperty('label');
        expect(citation.ref).toMatch(/^\[\d+\]$/);
      });
    });
  });

  it('should have valid deep link structure', () => {
    ALL_HANDLERS.forEach(handler => {
      const response = handler.handler(factPack);

      response.deep_links.forEach(link => {
        expect(link).toHaveProperty('label');
        expect(link).toHaveProperty('tab');
        expect(link).toHaveProperty('params');
      });
    });
  });
});
