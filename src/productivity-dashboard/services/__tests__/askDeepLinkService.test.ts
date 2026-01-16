// Unit tests for Ask Deep Link Service
// Tests key path to deep link mapping

import {
  hasDeepLinkMapping,
  keyPathToDeepLink,
  keyPathToDeepLinkWithFallback,
} from '../askDeepLinkService';

// ─────────────────────────────────────────────────────────────
// Deep Link Mapping Tests
// ─────────────────────────────────────────────────────────────

describe('hasDeepLinkMapping', () => {
  it('should return true for control_tower key paths', () => {
    expect(hasDeepLinkMapping('control_tower.kpis.median_ttf')).toBe(true);
    expect(hasDeepLinkMapping('control_tower.kpis.offer_count')).toBe(true);
    expect(hasDeepLinkMapping('control_tower.risk_summary')).toBe(true);
  });

  it('should return true for recruiter_performance key paths', () => {
    expect(hasDeepLinkMapping('recruiter_performance.top_by_hires[0]')).toBe(true);
    expect(hasDeepLinkMapping('recruiter_performance.top_by_productivity[0]')).toBe(true);
    expect(hasDeepLinkMapping('recruiter_performance.bottom_by_productivity[0]')).toBe(true);
    expect(hasDeepLinkMapping('recruiter_performance.team_avg_productivity')).toBe(true);
  });

  it('should return false for completely invalid paths', () => {
    expect(hasDeepLinkMapping('completely.invalid.path')).toBe(false);
    expect(hasDeepLinkMapping('random_key')).toBe(false);
  });
});

describe('keyPathToDeepLink', () => {
  describe('recruiter_performance mappings', () => {
    it('should map top_by_hires to recruiter tab', () => {
      const result = keyPathToDeepLink('recruiter_performance.top_by_hires[0]');

      expect(result).not.toBeNull();
      expect(result?.tab).toBe('recruiter');
      expect(result?.params.recruiterIndex).toBe('0');
      expect(result?.params.sortBy).toBe('hires');
    });

    it('should map top_by_productivity to recruiter tab', () => {
      const result = keyPathToDeepLink('recruiter_performance.top_by_productivity[2]');

      expect(result).not.toBeNull();
      expect(result?.tab).toBe('recruiter');
      expect(result?.params.recruiterIndex).toBe('2');
      expect(result?.params.sortBy).toBe('productivity');
    });

    it('should map bottom_by_productivity to recruiter tab', () => {
      const result = keyPathToDeepLink('recruiter_performance.bottom_by_productivity[0]');

      expect(result).not.toBeNull();
      expect(result?.tab).toBe('recruiter');
      expect(result?.params.sortBy).toBe('productivity');
    });

    it('should map team_avg to recruiter tab', () => {
      const result = keyPathToDeepLink('recruiter_performance.team_avg_productivity');

      expect(result).not.toBeNull();
      expect(result?.tab).toBe('recruiter');
    });

    it('should map generic recruiter_performance paths to recruiter tab', () => {
      const result = keyPathToDeepLink('recruiter_performance.n');

      expect(result).not.toBeNull();
      expect(result?.tab).toBe('recruiter');
    });
  });

  describe('control_tower mappings', () => {
    it('should map median_ttf to control-tower', () => {
      const result = keyPathToDeepLink('control_tower.kpis.median_ttf');

      expect(result).not.toBeNull();
      expect(result?.tab).toBe('control-tower');
      expect(result?.highlightSelector).toBe('[data-kpi="median-ttf"]');
    });

    it('should map stalled_reqs to data-health', () => {
      const result = keyPathToDeepLink('control_tower.kpis.stalled_reqs');

      expect(result).not.toBeNull();
      expect(result?.tab).toBe('data-health');
    });
  });

  describe('risks mappings', () => {
    it('should map top_risks array to control-tower', () => {
      const result = keyPathToDeepLink('risks.top_risks[0]');

      expect(result).not.toBeNull();
      expect(result?.tab).toBe('control-tower');
      expect(result?.params.riskIndex).toBe('0');
    });

    it('should map zombie risks to data-health', () => {
      const result = keyPathToDeepLink('risks.by_failure_mode.zombie');

      expect(result).not.toBeNull();
      expect(result?.tab).toBe('data-health');
    });
  });

  describe('velocity mappings', () => {
    it('should map velocity paths to velocity tab', () => {
      const result = keyPathToDeepLink('velocity.funnel');

      expect(result).not.toBeNull();
      expect(result?.tab).toBe('velocity');
    });

    it('should map bottleneck to velocity tab', () => {
      const result = keyPathToDeepLink('velocity.bottleneck_stage');

      expect(result).not.toBeNull();
      expect(result?.tab).toBe('velocity');
    });
  });

  describe('sources mappings', () => {
    it('should map sources paths to source-mix tab', () => {
      const result = keyPathToDeepLink('sources.top_by_volume');

      expect(result).not.toBeNull();
      expect(result?.tab).toBe('source-mix');
    });
  });

  describe('capacity mappings', () => {
    it('should map capacity paths to capacity tab', () => {
      const result = keyPathToDeepLink('capacity.total_recruiters');

      expect(result).not.toBeNull();
      expect(result?.tab).toBe('capacity');
    });
  });

  describe('forecast mappings', () => {
    it('should map forecast paths to forecasting tab', () => {
      const result = keyPathToDeepLink('forecast.expected_hires');

      expect(result).not.toBeNull();
      expect(result?.tab).toBe('forecasting');
    });
  });

  describe('explain mappings', () => {
    it('should map time_to_offer to velocity tab', () => {
      const result = keyPathToDeepLink('explain.time_to_offer');

      expect(result).not.toBeNull();
      expect(result?.tab).toBe('velocity');
    });

    it('should map hm_latency to hm-friction tab', () => {
      const result = keyPathToDeepLink('explain.hm_latency');

      expect(result).not.toBeNull();
      expect(result?.tab).toBe('hm-friction');
    });
  });
});

describe('keyPathToDeepLinkWithFallback', () => {
  it('should return specific mapping when available', () => {
    const result = keyPathToDeepLinkWithFallback('recruiter_performance.top_by_hires[0]');

    expect(result.tab).toBe('recruiter');
  });

  it('should fallback to control-tower for unmapped paths', () => {
    const result = keyPathToDeepLinkWithFallback('completely.invalid.path');

    expect(result.tab).toBe('control-tower');
    expect(result.url).toBe('/control-tower');
  });
});
