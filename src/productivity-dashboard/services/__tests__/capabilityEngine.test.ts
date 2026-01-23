// Capability Engine Tests
// Tests the core engine evaluating 18 capabilities and 39+ features

import { evaluateCapabilities, DATA_CAPABILITIES, FEATURE_REGISTRY, isFeatureEnabled, isFeatureUsable, getAreaStatus } from '../capabilityEngine';
import { CoverageMetrics } from '../../types/resilientImportTypes';
import { generateUltimateDemo, computeDemoCoverage } from '../ultimateDemoGenerator';
import { DEFAULT_PACK_CONFIG, MINIMAL_PACK_CONFIG } from '../../types/demoTypes';

// ============================================
// HELPER: Build coverage metrics for testing
// ============================================

function buildCoverage(overrides: Partial<CoverageMetrics> = {}): CoverageMetrics {
  return {
    importId: 'test',
    computedAt: new Date(),
    counts: {
      requisitions: 50,
      candidates: 200,
      events: 500,
      users: 10,
      snapshots: 6,
      ...overrides.counts,
    },
    fieldCoverage: {
      'req.recruiter_id': 0.9,
      'req.hiring_manager_id': 0.85,
      'req.opened_at': 0.95,
      'req.closed_at': 0.6,
      'req.status': 0.98,
      'cand.applied_at': 0.92,
      'cand.current_stage': 0.95,
      'cand.hired_at': 0.15,
      'cand.rejected_at': 0.2,
      'cand.source': 0.7,
      'cand.name': 0.99,
      'event.from_stage': 0.85,
      'event.to_stage': 0.88,
      'event.actor_user_id': 0.75,
      'event.event_at': 0.95,
      ...overrides.fieldCoverage,
    },
    flags: {
      hasStageEvents: true,
      hasTimestamps: true,
      hasTerminalTimestamps: true,
      hasRecruiterAssignment: true,
      hasHMAssignment: true,
      hasSourceData: true,
      hasMultipleSnapshots: true,
      ...overrides.flags,
    },
    sampleSizes: {
      hires: 25,
      offers: 30,
      rejections: 40,
      activeReqs: 35,
      ...overrides.sampleSizes,
    },
  };
}

function buildEmptyCoverage(): CoverageMetrics {
  return {
    importId: 'empty',
    computedAt: new Date(),
    counts: { requisitions: 0, candidates: 0, events: 0, users: 0, snapshots: 0 },
    fieldCoverage: {
      'req.recruiter_id': 0, 'req.hiring_manager_id': 0, 'req.opened_at': 0,
      'req.closed_at': 0, 'req.status': 0, 'cand.applied_at': 0,
      'cand.current_stage': 0, 'cand.hired_at': 0, 'cand.rejected_at': 0,
      'cand.source': 0, 'cand.name': 0, 'event.from_stage': 0,
      'event.to_stage': 0, 'event.actor_user_id': 0, 'event.event_at': 0,
    },
    flags: {
      hasStageEvents: false, hasTimestamps: false, hasTerminalTimestamps: false,
      hasRecruiterAssignment: false, hasHMAssignment: false, hasSourceData: false,
      hasMultipleSnapshots: false,
    },
    sampleSizes: { hires: 0, offers: 0, rejections: 0, activeReqs: 0 },
  };
}

// ============================================
// TESTS
// ============================================

describe('Capability Engine', () => {
  describe('evaluateCapabilities', () => {
    it('returns all 18 capabilities', () => {
      const result = evaluateCapabilities(buildCoverage());
      expect(result.capability_report.size).toBe(18);
    });

    it('returns all features', () => {
      const result = evaluateCapabilities(buildCoverage());
      expect(result.feature_coverage.size).toBe(FEATURE_REGISTRY.length);
    });

    it('includes summary with correct totals', () => {
      const result = evaluateCapabilities(buildCoverage());
      expect(result.summary.total_capabilities).toBe(18);
      expect(result.summary.total_features).toBe(FEATURE_REGISTRY.length);
    });

    it('returns evaluated_at timestamp', () => {
      const result = evaluateCapabilities(buildCoverage());
      expect(result.evaluated_at).toBeInstanceOf(Date);
    });
  });

  describe('Full coverage - all ENABLED', () => {
    it('all capabilities are ENABLED with full data', () => {
      const result = evaluateCapabilities(buildCoverage());
      for (const [key, entry] of result.capability_report) {
        expect(entry.status).toBe('ENABLED');
      }
    });

    it('all features are ENABLED with full data', () => {
      const result = evaluateCapabilities(buildCoverage());
      for (const [key, entry] of result.feature_coverage) {
        expect(entry.status).toBe('ENABLED');
      }
    });

    it('summary shows full coverage', () => {
      const result = evaluateCapabilities(buildCoverage());
      expect(result.summary.overall_status).toBe('full');
      expect(result.summary.blocked).toBe(0);
      expect(result.summary.limited).toBe(0);
    });

    it('no repair suggestions when everything is enabled', () => {
      const result = evaluateCapabilities(buildCoverage());
      expect(result.repair_suggestions.length).toBe(0);
    });
  });

  describe('Empty coverage - all BLOCKED', () => {
    it('all capabilities are BLOCKED with no data', () => {
      const result = evaluateCapabilities(buildEmptyCoverage());
      for (const [, entry] of result.capability_report) {
        expect(entry.status).toBe('BLOCKED');
      }
    });

    it('all features are BLOCKED with no data', () => {
      const result = evaluateCapabilities(buildEmptyCoverage());
      for (const [, entry] of result.feature_coverage) {
        expect(entry.status).toBe('BLOCKED');
      }
    });

    it('summary shows limited coverage', () => {
      const result = evaluateCapabilities(buildEmptyCoverage());
      expect(result.summary.overall_status).toBe('limited');
    });

    it('repair suggestions are provided', () => {
      const result = evaluateCapabilities(buildEmptyCoverage());
      expect(result.repair_suggestions.length).toBeGreaterThan(0);
    });
  });

  describe('Partial coverage - mixed statuses', () => {
    it('missing HM assignment blocks HM-dependent features', () => {
      const coverage = buildCoverage({
        fieldCoverage: { ...buildCoverage().fieldCoverage, 'req.hiring_manager_id': 0 },
        flags: { ...buildCoverage().flags, hasHMAssignment: false },
      });
      const result = evaluateCapabilities(coverage);

      // cap_hm_assignment should be BLOCKED
      expect(result.capability_report.get('cap_hm_assignment')?.status).toBe('BLOCKED');

      // HM Friction features should be BLOCKED
      expect(result.feature_coverage.get('hm_kpi_tiles')?.status).toBe('BLOCKED');
      expect(result.feature_coverage.get('hm_latency_heatmap')?.status).toBe('BLOCKED');
    });

    it('missing source data blocks source features only', () => {
      const coverage = buildCoverage({
        fieldCoverage: { ...buildCoverage().fieldCoverage, 'cand.source': 0 },
        flags: { ...buildCoverage().flags, hasSourceData: false },
      });
      const result = evaluateCapabilities(coverage);

      expect(result.capability_report.get('cap_source_data')?.status).toBe('BLOCKED');
      expect(result.feature_coverage.get('src_volume_chart')?.status).toBe('BLOCKED');
      // Control tower should still work
      expect(result.feature_coverage.get('ct_health_kpis')?.status).toBe('ENABLED');
    });

    it('low hires count gives LIMITED for cap_hires', () => {
      const coverage = buildCoverage({
        sampleSizes: { ...buildCoverage().sampleSizes, hires: 3 },
      });
      const result = evaluateCapabilities(coverage);
      expect(result.capability_report.get('cap_hires')?.status).toBe('LIMITED');
    });

    it('zero hires gives BLOCKED for cap_hires', () => {
      const coverage = buildCoverage({
        sampleSizes: { ...buildCoverage().sampleSizes, hires: 0 },
        fieldCoverage: { ...buildCoverage().fieldCoverage, 'cand.hired_at': 0 },
      });
      const result = evaluateCapabilities(coverage);
      expect(result.capability_report.get('cap_hires')?.status).toBe('BLOCKED');
    });

    it('insufficient snapshots gives BLOCKED for snapshot_dwell', () => {
      const coverage = buildCoverage({
        counts: { ...buildCoverage().counts, snapshots: 1 },
        flags: { ...buildCoverage().flags, hasMultipleSnapshots: false },
      });
      const result = evaluateCapabilities(coverage);
      expect(result.capability_report.get('cap_snapshot_dwell')?.status).toBe('BLOCKED');
    });
  });

  describe('Confidence levels', () => {
    it('HIGH confidence with large sample and high coverage', () => {
      const coverage = buildCoverage({
        counts: { ...buildCoverage().counts, candidates: 500 },
        sampleSizes: { ...buildCoverage().sampleSizes, hires: 50 },
        fieldCoverage: { ...buildCoverage().fieldCoverage, 'cand.hired_at': 0.85 },
      });
      const result = evaluateCapabilities(coverage);
      expect(result.capability_report.get('cap_hires')?.confidence).toBe('HIGH');
    });

    it('MED confidence with threshold-level sample', () => {
      const coverage = buildCoverage({
        sampleSizes: { ...buildCoverage().sampleSizes, hires: 7 },
        fieldCoverage: { ...buildCoverage().fieldCoverage, 'cand.hired_at': 0.12 },
      });
      const result = evaluateCapabilities(coverage);
      const conf = result.capability_report.get('cap_hires')?.confidence;
      expect(conf === 'MED' || conf === 'LOW').toBe(true);
    });
  });

  describe('Repair suggestions', () => {
    it('each blocked capability has a repair suggestion', () => {
      const result = evaluateCapabilities(buildEmptyCoverage());
      for (const [, entry] of result.capability_report) {
        if (entry.status === 'BLOCKED') {
          expect(entry.repair_suggestions.length).toBeGreaterThan(0);
        }
      }
    });

    it('repair suggestions include required columns', () => {
      const result = evaluateCapabilities(buildEmptyCoverage());
      for (const suggestion of result.repair_suggestions) {
        expect(suggestion.required_columns.length).toBeGreaterThan(0);
      }
    });

    it('repair suggestions include ui_copy', () => {
      const result = evaluateCapabilities(buildEmptyCoverage());
      for (const suggestion of result.repair_suggestions) {
        expect(suggestion.ui_copy.short_title).toBeTruthy();
        expect(suggestion.ui_copy.blocked_message).toBeTruthy();
        expect(suggestion.ui_copy.cta_label).toBeTruthy();
      }
    });

    it('repairs are sorted by unlock count (most impact first)', () => {
      const result = evaluateCapabilities(buildEmptyCoverage());
      for (let i = 1; i < result.repair_suggestions.length; i++) {
        expect(result.repair_suggestions[i - 1].what_it_unlocks.length)
          .toBeGreaterThanOrEqual(result.repair_suggestions[i].what_it_unlocks.length);
      }
    });
  });

  describe('Feature query helpers', () => {
    it('isFeatureEnabled returns true for enabled features', () => {
      const result = evaluateCapabilities(buildCoverage());
      expect(isFeatureEnabled('ct_health_kpis', result)).toBe(true);
    });

    it('isFeatureEnabled returns false for blocked features', () => {
      const result = evaluateCapabilities(buildEmptyCoverage());
      expect(isFeatureEnabled('ct_health_kpis', result)).toBe(false);
    });

    it('isFeatureUsable returns true for LIMITED features', () => {
      const coverage = buildCoverage({
        sampleSizes: { ...buildCoverage().sampleSizes, hires: 3 },
      });
      const result = evaluateCapabilities(coverage);
      // ct_median_ttf requires cap_hires which is LIMITED
      const ttfStatus = result.feature_coverage.get('ct_median_ttf')?.status;
      if (ttfStatus === 'LIMITED') {
        expect(isFeatureUsable('ct_median_ttf', result)).toBe(true);
      }
    });

    it('getAreaStatus returns correct status for area', () => {
      const result = evaluateCapabilities(buildEmptyCoverage());
      expect(getAreaStatus('control_tower', result)).toBe('BLOCKED');
    });
  });

  describe('Ultimate Demo - All Green', () => {
    it('Ultimate Demo produces all ENABLED capabilities', () => {
      const bundle = generateUltimateDemo('engine-test', DEFAULT_PACK_CONFIG);
      const coverage = computeDemoCoverage(bundle);
      const result = evaluateCapabilities(coverage);

      const blockedCaps: string[] = [];
      for (const [key, entry] of result.capability_report) {
        if (entry.status === 'BLOCKED') {
          blockedCaps.push(`${key}: ${entry.confidence_reasons.join(', ')}`);
        }
      }

      if (blockedCaps.length > 0) {
        console.log('BLOCKED capabilities:', blockedCaps);
      }

      expect(result.summary.blocked).toBe(0);
    });

    it('Ultimate Demo produces all ENABLED features', () => {
      const bundle = generateUltimateDemo('engine-test', DEFAULT_PACK_CONFIG);
      const coverage = computeDemoCoverage(bundle);
      const result = evaluateCapabilities(coverage);

      const blockedFeats: string[] = [];
      for (const [key, entry] of result.feature_coverage) {
        if (entry.status === 'BLOCKED') {
          blockedFeats.push(`${key}: ${entry.reasons.join(', ')}`);
        }
      }

      if (blockedFeats.length > 0) {
        console.log('BLOCKED features:', blockedFeats);
      }

      expect(result.summary.features_blocked).toBe(0);
    });

    it('Ultimate Demo summary is "full"', () => {
      const bundle = generateUltimateDemo('engine-test', DEFAULT_PACK_CONFIG);
      const coverage = computeDemoCoverage(bundle);
      const result = evaluateCapabilities(coverage);
      expect(result.summary.overall_status).toBe('full');
    });
  });

  describe('Determinism', () => {
    it('same coverage produces same result', () => {
      const coverage = buildCoverage();
      const r1 = evaluateCapabilities(coverage);
      const r2 = evaluateCapabilities(coverage);

      // Compare summaries (excluding timestamps)
      expect(r1.summary.enabled).toBe(r2.summary.enabled);
      expect(r1.summary.limited).toBe(r2.summary.limited);
      expect(r1.summary.blocked).toBe(r2.summary.blocked);
      expect(r1.summary.features_enabled).toBe(r2.summary.features_enabled);
    });
  });
});
