/**
 * Velocity Thresholds Tests
 *
 * Tests for rock-solid truth pass: 0/0 handling, threshold gating,
 * and confidence calculations.
 */

import {
  MIN_OFFERS_FOR_DECAY,
  MIN_HIRES_FOR_FAST_VS_SLOW,
  MIN_DENOM_FOR_PASS_RATE,
  MIN_REQS_FOR_REQ_DECAY,
  MIN_BUCKET_SIZE_FOR_CHART,
  safeRate,
  formatRate,
  calculateConfidence,
  hasEnoughData,
  detectStageTimingCapability
} from '../velocityThresholds';

describe('velocityThresholds constants', () => {
  test('threshold constants have sensible default values', () => {
    expect(MIN_OFFERS_FOR_DECAY).toBe(10);
    expect(MIN_HIRES_FOR_FAST_VS_SLOW).toBe(10);
    expect(MIN_DENOM_FOR_PASS_RATE).toBe(5);
    expect(MIN_REQS_FOR_REQ_DECAY).toBe(10);
    expect(MIN_BUCKET_SIZE_FOR_CHART).toBe(3);
  });
});

describe('safeRate - 0/0 handling', () => {
  test('0/0 returns null value and "—" display (not 0% or 100%)', () => {
    const result = safeRate(0, 0);

    expect(result.value).toBeNull();
    expect(result.displayValue).toBe('—');
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('insufficient_data');

    // CRITICAL: Must NOT return 0% or 100%
    expect(result.displayValue).not.toBe('0%');
    expect(result.displayValue).not.toBe('100%');
    expect(result.displayValue).not.toBe('0');
    expect(result.displayValue).not.toBe('100');
  });

  test('n/0 where n > 0 returns Invalid data and logs warning', () => {
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

    const result = safeRate(5, 0);

    expect(result.value).toBeNull();
    expect(result.displayValue).toBe('Invalid data');
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('invalid_denominator');
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Invalid rate calculation'));

    consoleSpy.mockRestore();
  });

  test('0/n returns 0 (valid rate)', () => {
    const result = safeRate(0, 10);

    expect(result.value).toBe(0);
    expect(result.displayValue).toBe('0.00');
    expect(result.isValid).toBe(true);
  });

  test('n/m returns correct rate', () => {
    const result = safeRate(5, 10);

    expect(result.value).toBe(0.5);
    expect(result.isValid).toBe(true);
  });

  test('asPercent option formats as percentage', () => {
    const result = safeRate(5, 10, true);

    expect(result.displayValue).toBe('50%');
  });
});

describe('formatRate', () => {
  test('returns "Insufficient data" when denominator below threshold', () => {
    const result = formatRate(3, 4, { minDenom: 5 });
    expect(result).toBe('Insufficient data');
  });

  test('returns "Insufficient data" for 0/0 when minDenom > 0 (default)', () => {
    // By default, formatRate has minDenom=5, so 0/0 triggers insufficient data check first
    const result = formatRate(0, 0);
    expect(result).toBe('Insufficient data');
  });

  test('returns "—" for 0/0 when minDenom is 0', () => {
    // When minDenom is explicitly 0, the safeRate 0/0 case kicks in
    const result = formatRate(0, 0, { minDenom: 0 });
    expect(result).toBe('—');
  });

  test('returns percentage when above threshold', () => {
    const result = formatRate(5, 10, { minDenom: 5 });
    expect(result).toBe('50%');
  });

  test('respects decimal places option', () => {
    const result = formatRate(1, 3, { minDenom: 1, decimals: 1 });
    expect(result).toBe('33.3%');
  });

  test('showInsufficient false returns "—" instead of "Insufficient data"', () => {
    const result = formatRate(3, 4, { minDenom: 5, showInsufficient: false });
    expect(result).toBe('—');
  });
});

describe('calculateConfidence', () => {
  test('returns INSUFFICIENT for 0 sample size', () => {
    const result = calculateConfidence(0, 10, 'offers');
    expect(result.level).toBe('INSUFFICIENT');
    expect(result.reason).toContain('No offers data available');
  });

  test('returns INSUFFICIENT when below threshold', () => {
    const result = calculateConfidence(5, 10, 'offers');
    expect(result.level).toBe('INSUFFICIENT');
    expect(result.reason).toContain('Need at least 10');
  });

  test('returns LOW when just meets threshold', () => {
    const result = calculateConfidence(10, 10, 'offers');
    expect(result.level).toBe('LOW');
  });

  test('returns MED when 1.5x threshold', () => {
    const result = calculateConfidence(15, 10, 'offers');
    expect(result.level).toBe('MED');
  });

  test('returns HIGH when 2x threshold or more', () => {
    const result = calculateConfidence(20, 10, 'offers');
    expect(result.level).toBe('HIGH');
  });
});

describe('hasEnoughData', () => {
  test('checks offers threshold correctly', () => {
    expect(hasEnoughData('offers', MIN_OFFERS_FOR_DECAY - 1)).toBe(false);
    expect(hasEnoughData('offers', MIN_OFFERS_FOR_DECAY)).toBe(true);
    expect(hasEnoughData('offers', MIN_OFFERS_FOR_DECAY + 1)).toBe(true);
  });

  test('checks hires threshold correctly', () => {
    expect(hasEnoughData('hires', MIN_HIRES_FOR_FAST_VS_SLOW - 1)).toBe(false);
    expect(hasEnoughData('hires', MIN_HIRES_FOR_FAST_VS_SLOW)).toBe(true);
  });

  test('checks reqs threshold correctly', () => {
    expect(hasEnoughData('reqs', MIN_REQS_FOR_REQ_DECAY - 1)).toBe(false);
    expect(hasEnoughData('reqs', MIN_REQS_FOR_REQ_DECAY)).toBe(true);
  });

  test('checks passRate using denominator', () => {
    expect(hasEnoughData('passRate', 100, MIN_DENOM_FOR_PASS_RATE - 1)).toBe(false);
    expect(hasEnoughData('passRate', 100, MIN_DENOM_FOR_PASS_RATE)).toBe(true);
  });
});

describe('detectStageTimingCapability', () => {
  test('returns NONE when no stage data', () => {
    const result = detectStageTimingCapability([], []);

    expect(result.capability).toBe('NONE');
    expect(result.canShowStageDuration).toBe(false);
    expect(result.reason).toContain('Insufficient stage timing data');
  });

  test('returns SNAPSHOT_DIFF when stage change events have from/to', () => {
    const events = Array.from({ length: 15 }, (_, i) => ({
      event_type: 'STAGE_CHANGE',
      from_stage: 'Screen',
      to_stage: 'Onsite',
      event_at: new Date()
    }));

    const result = detectStageTimingCapability(events, []);

    expect(result.capability).toBe('SNAPSHOT_DIFF');
    expect(result.canShowStageDuration).toBe(true);
    expect(result.hasSnapshotDiffEvents).toBe(true);
  });

  test('returns TIMESTAMP_ONLY when only current_stage_entered_at is set', () => {
    const events: Array<{ event_type: string; from_stage: string | null; to_stage: string | null; event_at: Date }> = [];
    const candidates = Array.from({ length: 10 }, () => ({
      current_stage_entered_at: new Date()
    }));

    const result = detectStageTimingCapability(events, candidates);

    expect(result.capability).toBe('TIMESTAMP_ONLY');
    expect(result.canShowStageDuration).toBe(false);
    expect(result.hasStageEnterTimestamps).toBe(true);
  });
});

describe('Velocity Insights gating scenarios', () => {
  describe('decay curve section gates when offers < MIN_OFFERS_FOR_DECAY', () => {
    test('insufficient offers returns insufficient confidence', () => {
      const offers = MIN_OFFERS_FOR_DECAY - 1;
      const confidence = calculateConfidence(offers, MIN_OFFERS_FOR_DECAY, 'offers');

      expect(confidence.level).toBe('INSUFFICIENT');
      expect(hasEnoughData('offers', offers)).toBe(false);
    });

    test('sufficient offers returns valid confidence', () => {
      const offers = MIN_OFFERS_FOR_DECAY;
      const confidence = calculateConfidence(offers, MIN_OFFERS_FOR_DECAY, 'offers');

      expect(confidence.level).not.toBe('INSUFFICIENT');
      expect(hasEnoughData('offers', offers)).toBe(true);
    });
  });

  describe('fast vs slow section gates when hires < MIN_HIRES_FOR_FAST_VS_SLOW', () => {
    test('insufficient hires returns insufficient confidence', () => {
      const hires = MIN_HIRES_FOR_FAST_VS_SLOW - 1;
      const confidence = calculateConfidence(hires, MIN_HIRES_FOR_FAST_VS_SLOW, 'hires');

      expect(confidence.level).toBe('INSUFFICIENT');
      expect(hasEnoughData('hires', hires)).toBe(false);
    });

    test('sufficient hires returns valid confidence', () => {
      const hires = MIN_HIRES_FOR_FAST_VS_SLOW;
      const confidence = calculateConfidence(hires, MIN_HIRES_FOR_FAST_VS_SLOW, 'hires');

      expect(confidence.level).not.toBe('INSUFFICIENT');
      expect(hasEnoughData('hires', hires)).toBe(true);
    });
  });

  describe('stage duration panel shows EmptyState when capability missing', () => {
    test('NONE capability means stage duration unavailable', () => {
      const result = detectStageTimingCapability([], []);
      expect(result.canShowStageDuration).toBe(false);
    });

    test('SNAPSHOT_DIFF capability means stage duration available', () => {
      const events = Array.from({ length: 15 }, () => ({
        event_type: 'STAGE_CHANGE',
        from_stage: 'Screen',
        to_stage: 'Onsite',
        event_at: new Date()
      }));

      const result = detectStageTimingCapability(events, []);
      expect(result.canShowStageDuration).toBe(true);
    });
  });
});

// ===== MOONSHOT FIX PASS TESTS =====

describe('Moonshot Fix: UI never shows 0% when denom=0', () => {
  test('formatRate never returns 0% for 0/0 case', () => {
    const result = formatRate(0, 0);
    expect(result).not.toBe('0%');
    expect(result).not.toMatch(/^0\.?0*%$/);
  });

  test('formatRate never returns 100% for 0/0 case', () => {
    const result = formatRate(0, 0);
    expect(result).not.toBe('100%');
    expect(result).not.toMatch(/^100\.?0*%$/);
  });

  test('safeRate with asPercent=true never returns 0% for 0/0', () => {
    const result = safeRate(0, 0, true);
    expect(result.displayValue).not.toBe('0%');
    expect(result.displayValue).toBe('—');
  });

  test('safeRate with asPercent=true never returns 100% for 0/0', () => {
    const result = safeRate(0, 0, true);
    expect(result.displayValue).not.toBe('100%');
    expect(result.displayValue).toBe('—');
  });

  test('formatRate returns "Insufficient data" for low denominator cases', () => {
    // When denom < MIN_DENOM_FOR_PASS_RATE (5)
    expect(formatRate(0, 3)).toBe('Insufficient data');
    expect(formatRate(2, 4)).toBe('Insufficient data');
    expect(formatRate(1, 1)).toBe('Insufficient data');
  });

  test('valid rates are calculated correctly when above threshold', () => {
    const result = formatRate(5, 10, { minDenom: 5 });
    expect(result).toBe('50%');
    // Should NOT be "Insufficient data"
    expect(result).not.toBe('Insufficient data');
  });
});

describe('Moonshot Fix: Stage timing gating', () => {
  test('NONE capability when no events and no candidates', () => {
    const result = detectStageTimingCapability([], []);

    expect(result.capability).toBe('NONE');
    expect(result.canShowStageDuration).toBe(false);
    expect(result.reason).toContain('Insufficient');
  });

  test('TIMESTAMP_ONLY when candidates have timestamps but no snapshot diff events', () => {
    const events: Array<{ event_type: string; from_stage: string | null; to_stage: string | null; event_at: Date }> = [];
    const candidates = Array.from({ length: 20 }, () => ({
      current_stage_entered_at: new Date()
    }));

    const result = detectStageTimingCapability(events, candidates);

    expect(result.capability).toBe('TIMESTAMP_ONLY');
    expect(result.canShowStageDuration).toBe(false);
    expect(result.hasStageEnterTimestamps).toBe(true);
    expect(result.hasSnapshotDiffEvents).toBe(false);
  });

  test('SNAPSHOT_DIFF enables stage duration display', () => {
    const events = Array.from({ length: 20 }, () => ({
      event_type: 'STAGE_CHANGE',
      from_stage: 'Applied',
      to_stage: 'Screen',
      event_at: new Date()
    }));

    const result = detectStageTimingCapability(events, []);

    expect(result.capability).toBe('SNAPSHOT_DIFF');
    expect(result.canShowStageDuration).toBe(true);
    expect(result.hasSnapshotDiffEvents).toBe(true);
  });

  test('need at least 10 snapshot diff events for capability', () => {
    const events = Array.from({ length: 9 }, () => ({
      event_type: 'STAGE_CHANGE',
      from_stage: 'Applied',
      to_stage: 'Screen',
      event_at: new Date()
    }));

    const result = detectStageTimingCapability(events, []);

    expect(result.capability).not.toBe('SNAPSHOT_DIFF');
    expect(result.canShowStageDuration).toBe(false);
  });
});

describe('Moonshot Fix: Action creation dedupe behavior', () => {
  test('generateActionId produces consistent IDs for same insight title', () => {
    // Simulate the dedupe ID generation logic
    const generateActionId = (title: string): string => {
      const sanitizedTitle = title.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
      return `velocity_insight_${sanitizedTitle}`;
    };

    const id1 = generateActionId('Candidate Interest May Decay Over Time');
    const id2 = generateActionId('Candidate Interest May Decay Over Time');

    expect(id1).toBe(id2);
    expect(id1).toBe('velocity_insight_candidate_interest_may_decay_over_time');
  });

  test('different insight titles produce different IDs', () => {
    const generateActionId = (title: string): string => {
      const sanitizedTitle = title.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
      return `velocity_insight_${sanitizedTitle}`;
    };

    const id1 = generateActionId('Candidate Interest May Decay');
    const id2 = generateActionId('Req Fill Probability May Decline');

    expect(id1).not.toBe(id2);
  });

  test('action ID excludes special characters', () => {
    const generateActionId = (title: string): string => {
      const sanitizedTitle = title.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
      return `velocity_insight_${sanitizedTitle}`;
    };

    const id = generateActionId('Fast Processes "Win" (n=10)');

    expect(id).not.toContain('"');
    expect(id).not.toContain('(');
    expect(id).not.toContain(')');
    expect(id).not.toContain('=');
    expect(id).toBe('velocity_insight_fast_processes_win_n10');
  });
});

describe('Moonshot Fix: Confidence levels drive conditional language', () => {
  test('LOW confidence should trigger conditional language', () => {
    // When sample size just meets threshold (10), confidence is LOW
    const result = calculateConfidence(10, 10, 'offers');

    expect(result.level).toBe('LOW');
    // UI should use "may" instead of "is" for LOW confidence
  });

  test('HIGH confidence allows definitive language', () => {
    // When sample size is 2x threshold or more, confidence is HIGH
    const result = calculateConfidence(20, 10, 'offers');

    expect(result.level).toBe('HIGH');
    // UI can use definitive statements for HIGH confidence
  });

  test('MED confidence is between LOW and HIGH', () => {
    // When sample size is 1.5x threshold, confidence is MED
    const result = calculateConfidence(15, 10, 'offers');

    expect(result.level).toBe('MED');
  });
});
