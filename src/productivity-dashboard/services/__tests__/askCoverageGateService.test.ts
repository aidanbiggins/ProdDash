// Unit tests for Ask Coverage Gate Service
// Tests the minimum Fact Pack capability requirements for Ask PlatoVue

import {
  checkAskCoverage,
  getCoverageIssueSummary,
  hasCapability,
  CoverageGateResult,
} from '../askCoverageGateService';
import { AskFactPack } from '../../types/askTypes';

// ─────────────────────────────────────────────────────────────
// Test Fixtures
// ─────────────────────────────────────────────────────────────

function createMinimalFactPack(overrides: Partial<AskFactPack> = {}): AskFactPack {
  return {
    meta: {
      generated_at: new Date().toISOString(),
      org_id: 'test-org',
      org_name: 'Test Organization',
      data_window: { start_date: '2024-01-01', end_date: '2024-03-01', days: 60 },
      sample_sizes: {
        total_reqs: 10,
        total_candidates: 50,
        total_hires: 5,
        total_offers: 8,
        total_events: 100,
      },
      filter_context: {
        recruiter_ids: [],
        date_range_start: null,
        date_range_end: null,
        date_range_preset: null,
        functions: [],
        regions: [],
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
        median_ttf: { value: 42, unit: 'days', threshold: { green: 45, yellow: 60, red: 90 }, status: 'green', n: 10, trend: null },
        offer_count: { value: 8, unit: 'count', threshold: { green: 10, yellow: 5, red: 0 }, status: 'yellow', n: 8, trend: null },
        accept_rate: { value: 85, unit: '%', threshold: { green: 80, yellow: 60, red: 40 }, status: 'green', n: 8, trend: null },
        stalled_reqs: { value: 2, unit: 'count', threshold: { green: 0, yellow: 5, red: 10 }, status: 'yellow', n: 10, trend: null },
        hm_latency: { value: 2.5, unit: 'days', threshold: { green: 2, yellow: 3, red: 5 }, status: 'yellow', n: 20, trend: null },
      },
      risk_summary: { total_at_risk: 3, by_type: { zombie: 1, stalled: 2 } },
      action_summary: { total_open: 5, p0_count: 1, p1_count: 2, p2_count: 2 },
    },
    explain: {
      time_to_offer: { metric_name: 'Time to Offer', value: 14, unit: 'days', top_drivers: [], exclusions: [], confidence: 'high', n: 10 },
      hm_latency: { metric_name: 'HM Latency', value: 2.5, unit: 'days', top_drivers: [], exclusions: [], confidence: 'high', n: 20 },
      accept_rate: { metric_name: 'Accept Rate', value: 85, unit: '%', top_drivers: [], exclusions: [], confidence: 'high', n: 8 },
      pipeline_health: { metric_name: 'Pipeline Health', value: null, unit: '', top_drivers: [], exclusions: [], confidence: 'low', n: 0 },
      source_effectiveness: { metric_name: 'Source Effectiveness', value: null, unit: '', top_drivers: [], exclusions: [], confidence: 'low', n: 0 },
    },
    actions: {
      top_p0: [],
      top_p1: [],
      by_owner_type: { recruiter: 3, hiring_manager: 2, ta_ops: 0 },
    },
    risks: {
      top_risks: [],
      by_failure_mode: {},
    },
    forecast: {
      expected_hires: 5,
      pipeline_gap: 2,
      confidence: 'medium',
      open_reqs: 10,
      active_candidates: 25,
      probability_weighted_pipeline: 7.5,
    },
    velocity: {
      funnel: [],
      bottleneck_stage: null,
      avg_days_to_offer: 14,
      avg_days_to_hire: 42,
    },
    sources: {
      top_by_volume: [],
      top_by_conversion: [],
      total_sources: 5,
    },
    capacity: {
      total_recruiters: 3,
      avg_req_load: 3.3,
      overloaded_count: 0,
      underloaded_count: 1,
    },
    recruiter_performance: {
      available: true,
      top_by_hires: [],
      top_by_productivity: [],
      bottom_by_productivity: [],
      team_avg_productivity: 75,
      total_recruiters: 3,
      n: 3,
      confidence: 'medium',
    },
    hiring_manager_ownership: {
      available: true,
      total_hiring_managers: 5,
      open_reqs_by_hm: [],
      n: 5,
      confidence: 'high',
    },
    glossary: [],
    ...overrides,
  } as AskFactPack;
}

// ─────────────────────────────────────────────────────────────
// checkAskCoverage Tests
// ─────────────────────────────────────────────────────────────

describe('checkAskCoverage', () => {
  it('should return enabled=true when all requirements are met', () => {
    const factPack = createMinimalFactPack();
    const result = checkAskCoverage(factPack);

    expect(result.enabled).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('should return issue when no requisitions exist', () => {
    const factPack = createMinimalFactPack({
      meta: {
        ...createMinimalFactPack().meta,
        sample_sizes: {
          ...createMinimalFactPack().meta.sample_sizes,
          total_reqs: 0,
        },
      },
    });

    const result = checkAskCoverage(factPack);

    expect(result.enabled).toBe(false);
    expect(result.issues.length).toBeGreaterThan(0);
    expect(result.issues.some(i => i.code === 'NO_REQUISITIONS')).toBe(true);
  });

  it('should return issue when recruiter_performance is not available', () => {
    const factPack = createMinimalFactPack({
      recruiter_performance: {
        available: false,
        unavailable_reason: 'No recruiter data',
        top_by_hires: [],
        top_by_productivity: [],
        bottom_by_productivity: [],
        team_avg_productivity: null,
        total_recruiters: 0,
        n: 0,
        confidence: 'low',
      },
    });

    const result = checkAskCoverage(factPack);

    expect(result.enabled).toBe(false);
    expect(result.issues.some(i => i.code === 'NO_RECRUITER_DATA')).toBe(true);
  });

  it('should return issue when hiring_manager_ownership is not available', () => {
    const factPack = createMinimalFactPack({
      hiring_manager_ownership: {
        available: false,
        unavailable_reason: 'No HM data',
        total_hiring_managers: 0,
        open_reqs_by_hm: [],
        n: 0,
        confidence: 'low',
      },
    });

    const result = checkAskCoverage(factPack);

    expect(result.enabled).toBe(false);
    expect(result.issues.some(i => i.code === 'NO_HM_DATA')).toBe(true);
  });

  it('should return multiple issues when multiple requirements fail', () => {
    const factPack = createMinimalFactPack({
      meta: {
        ...createMinimalFactPack().meta,
        sample_sizes: {
          ...createMinimalFactPack().meta.sample_sizes,
          total_reqs: 0,
        },
      },
      recruiter_performance: {
        available: false,
        unavailable_reason: 'No recruiter data',
        top_by_hires: [],
        top_by_productivity: [],
        bottom_by_productivity: [],
        team_avg_productivity: null,
        total_recruiters: 0,
        n: 0,
        confidence: 'low',
      },
      hiring_manager_ownership: {
        available: false,
        unavailable_reason: 'No HM data',
        total_hiring_managers: 0,
        open_reqs_by_hm: [],
        n: 0,
        confidence: 'low',
      },
    });

    const result = checkAskCoverage(factPack);

    expect(result.enabled).toBe(false);
    expect(result.issues.length).toBeGreaterThanOrEqual(3);
  });

  it('should include howToFix for each issue', () => {
    const factPack = createMinimalFactPack({
      hiring_manager_ownership: {
        available: false,
        unavailable_reason: 'No HM data',
        total_hiring_managers: 0,
        open_reqs_by_hm: [],
        n: 0,
        confidence: 'low',
      },
    });

    const result = checkAskCoverage(factPack);

    expect(result.issues.length).toBeGreaterThan(0);
    result.issues.forEach(issue => {
      expect(issue.howToFix).toBeDefined();
      expect(issue.howToFix.length).toBeGreaterThan(0);
    });
  });
});

// ─────────────────────────────────────────────────────────────
// getCoverageIssueSummary Tests
// ─────────────────────────────────────────────────────────────

describe('getCoverageIssueSummary', () => {
  it('should return success message when enabled', () => {
    const result: CoverageGateResult = {
      enabled: true,
      issues: [],
    };

    const summary = getCoverageIssueSummary(result);

    expect(summary).toContain('ready to use');
  });

  it('should return formatted issues when disabled', () => {
    const result: CoverageGateResult = {
      enabled: false,
      issues: [
        { code: 'NO_REQUISITIONS', message: 'No requisitions found', howToFix: 'Import data' },
        { code: 'NO_HM_DATA', message: 'No HM data', howToFix: 'Add HM IDs' },
      ],
    };

    const summary = getCoverageIssueSummary(result);

    expect(summary).toContain('2 data issues');
    expect(summary).toContain('No requisitions found');
    expect(summary).toContain('No HM data');
  });

  it('should use singular "issue" for single issue', () => {
    const result: CoverageGateResult = {
      enabled: false,
      issues: [
        { code: 'NO_HM_DATA', message: 'No HM data', howToFix: 'Add HM IDs' },
      ],
    };

    const summary = getCoverageIssueSummary(result);

    expect(summary).toContain('1 data issue');
    expect(summary).not.toContain('issues');
  });
});

// ─────────────────────────────────────────────────────────────
// hasCapability Tests
// ─────────────────────────────────────────────────────────────

describe('hasCapability', () => {
  const factPack = createMinimalFactPack();

  it('should return true for requisitions when total_reqs > 0', () => {
    expect(hasCapability(factPack, 'requisitions')).toBe(true);
  });

  it('should return false for requisitions when total_reqs = 0', () => {
    const emptyFactPack = createMinimalFactPack({
      meta: {
        ...createMinimalFactPack().meta,
        sample_sizes: {
          ...createMinimalFactPack().meta.sample_sizes,
          total_reqs: 0,
        },
      },
    });

    expect(hasCapability(emptyFactPack, 'requisitions')).toBe(false);
  });

  it('should return true for recruiter_performance when available', () => {
    expect(hasCapability(factPack, 'recruiter_performance')).toBe(true);
  });

  it('should return false for recruiter_performance when not available', () => {
    const noRecruiterFactPack = createMinimalFactPack({
      recruiter_performance: {
        ...createMinimalFactPack().recruiter_performance,
        available: false,
      },
    });

    expect(hasCapability(noRecruiterFactPack, 'recruiter_performance')).toBe(false);
  });

  it('should return true for hiring_manager_ownership when available', () => {
    expect(hasCapability(factPack, 'hiring_manager_ownership')).toBe(true);
  });

  it('should return false for hiring_manager_ownership when not available', () => {
    const noHmFactPack = createMinimalFactPack({
      hiring_manager_ownership: {
        ...createMinimalFactPack().hiring_manager_ownership,
        available: false,
      },
    });

    expect(hasCapability(noHmFactPack, 'hiring_manager_ownership')).toBe(false);
  });

  it('should return true for candidates when total_candidates > 0', () => {
    expect(hasCapability(factPack, 'candidates')).toBe(true);
  });
});
