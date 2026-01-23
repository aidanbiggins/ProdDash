import { computeTopPriority, computeChangesSummary } from '../priorityArbitrationService';
import { CommandCenterFactPack, ChangesSection } from '../../types/commandCenterTypes';
import { AttentionV2Data, AttentionBucket } from '../../types/attentionTypes';

// ============================================
// HELPERS
// ============================================

function makeAttentionV2(buckets: Partial<AttentionBucket>[] = []): AttentionV2Data {
  return {
    summary: {
      buckets: buckets.map((b, i) => ({
        id: b.id || 'recruiter_throughput',
        label: b.label || `Bucket ${i}`,
        severity: b.severity || 'watch',
        count: b.count || 1,
        confidence: 'HIGH' as const,
        confidenceReason: 'test',
        intervention: b.intervention || 'Do something',
        navigationTarget: b.navigationTarget || 'overview',
        navigationLabel: b.navigationLabel || 'View',
      })) as AttentionBucket[],
      totalImpacted: buckets.reduce((sum, b) => sum + (b.count || 1), 0),
      overallSeverity: 'watch',
      allBlocked: false,
    },
    drilldown: { recruiters: [], hiringManagers: [], reqClusters: [] },
  };
}

function makeFactPack(overrides: Partial<CommandCenterFactPack> = {}): CommandCenterFactPack {
  return {
    attention: { p0_count: 0, p1_count: 0, items: [] },
    on_track: {
      kpis: [
        { id: 'ttf', label: 'Median TTF', value: 40, target: 45, status: 'green', unit: 'd' },
        { id: 'offers', label: 'Offers', value: 10, target: 8, status: 'green', unit: '' },
      ],
      verdict: 'ON_TRACK',
      verdict_reason: 'All KPIs on target',
    },
    risk: { total_at_risk: 0, by_failure_mode: {}, items: [] },
    changes: { available: false, deltas: [] },
    whatif: { available: false, scenario_previews: [] },
    bottleneck: {
      diagnosis: 'HEALTHY',
      evidence: [],
      recommendation: 'No action needed',
      primary_action: { label: '', navigation_target: '' },
    },
    meta: { computed_at: new Date(), confidence: 'HIGH' as const, blocked_sections: [] },
    ...overrides,
  };
}

// ============================================
// HIERARCHY TESTS
// ============================================

describe('computeTopPriority', () => {
  describe('hierarchy order', () => {
    it('returns NONE when everything is healthy', () => {
      const result = computeTopPriority(makeAttentionV2(), makeFactPack());
      expect(result.category).toBe('NONE');
      expect(result.severity).toBe('info');
    });

    it('returns BLOCKING_ATTENTION when a bucket has blocking severity', () => {
      const attention = makeAttentionV2([{ severity: 'blocking', label: 'Pipeline Health', count: 3, intervention: 'fix sourcing' }]);
      const result = computeTopPriority(attention, makeFactPack());
      expect(result.category).toBe('BLOCKING_ATTENTION');
      expect(result.severity).toBe('critical');
      expect(result.source_section).toBe('cc_attention');
    });

    it('returns OFF_TRACK when verdict is OFF_TRACK (no blocking attention)', () => {
      const factPack = makeFactPack({
        on_track: {
          kpis: [
            { id: 'ttf', label: 'Median TTF', value: 65, target: 45, status: 'red', unit: 'd' },
          ],
          verdict: 'OFF_TRACK',
          verdict_reason: 'TTF above target',
        },
      });
      const result = computeTopPriority(makeAttentionV2(), factPack);
      expect(result.category).toBe('OFF_TRACK');
      expect(result.severity).toBe('critical');
      expect(result.headline).toContain('Median TTF');
    });

    it('returns CRITICAL_RISK when risk items have critical severity', () => {
      const factPack = makeFactPack({
        risk: {
          total_at_risk: 2,
          by_failure_mode: { EMPTY_PIPELINE: 2 },
          items: [
            { req_id: 'r1', req_title: 'Sr Engineer', days_open: 90, failure_mode: 'EMPTY_PIPELINE', failure_mode_label: 'Pipeline gap', severity: 'critical', why: 'empty', so_what: 'bad', next_move: 'source', action_type: 'SOURCE_CANDIDATES' as any },
          ],
        },
      });
      const result = computeTopPriority(makeAttentionV2(), factPack);
      expect(result.category).toBe('CRITICAL_RISK');
      expect(result.severity).toBe('critical');
      expect(result.headline).toContain('Sr Engineer');
    });

    it('returns AT_RISK_ATTENTION when a bucket has at-risk severity', () => {
      const attention = makeAttentionV2([{ severity: 'at-risk', label: 'HM Friction', count: 2, intervention: 'nudge HMs' }]);
      const result = computeTopPriority(attention, makeFactPack());
      expect(result.category).toBe('AT_RISK_ATTENTION');
      expect(result.severity).toBe('high');
      expect(result.source_section).toBe('cc_attention');
    });

    it('returns CAPACITY_BOUND when diagnosis is CAPACITY_BOUND', () => {
      const factPack = makeFactPack({
        bottleneck: {
          diagnosis: 'CAPACITY_BOUND',
          evidence: ['Avg load: 22 reqs'],
          recommendation: 'Hire or rebalance',
          primary_action: { label: 'Rebalance', navigation_target: 'capacity-rebalancer' },
        },
      });
      const result = computeTopPriority(makeAttentionV2(), factPack);
      expect(result.category).toBe('CAPACITY_BOUND');
      expect(result.severity).toBe('high');
      expect(result.cta_target).toBe('capacity-rebalancer');
    });

    it('returns CAPACITY_BOUND when diagnosis is BOTH', () => {
      const factPack = makeFactPack({
        bottleneck: {
          diagnosis: 'BOTH',
          evidence: [],
          recommendation: 'Address both',
          primary_action: { label: 'Plan', navigation_target: 'capacity-rebalancer' },
        },
      });
      const result = computeTopPriority(makeAttentionV2(), factPack);
      expect(result.category).toBe('CAPACITY_BOUND');
    });
  });

  describe('hierarchy precedence', () => {
    it('BLOCKING_ATTENTION wins over OFF_TRACK', () => {
      const attention = makeAttentionV2([{ severity: 'blocking', label: 'Overloaded', count: 3, intervention: 'rebalance' }]);
      const factPack = makeFactPack({
        on_track: { kpis: [], verdict: 'OFF_TRACK', verdict_reason: 'bad' },
      });
      const result = computeTopPriority(attention, factPack);
      expect(result.category).toBe('BLOCKING_ATTENTION');
    });

    it('OFF_TRACK wins over CRITICAL_RISK', () => {
      const factPack = makeFactPack({
        on_track: { kpis: [{ id: 'x', label: 'X', value: 10, target: 5, status: 'red', unit: '' }], verdict: 'OFF_TRACK', verdict_reason: 'bad' },
        risk: {
          total_at_risk: 1,
          by_failure_mode: {},
          items: [{ req_id: 'r1', req_title: 'T', days_open: 90, failure_mode: 'X', failure_mode_label: 'X', severity: 'critical', why: 'w', so_what: 's', next_move: 'n', action_type: 'SOURCE_CANDIDATES' as any }],
        },
      });
      const result = computeTopPriority(makeAttentionV2(), factPack);
      expect(result.category).toBe('OFF_TRACK');
    });

    it('CRITICAL_RISK wins over AT_RISK_ATTENTION', () => {
      const attention = makeAttentionV2([{ severity: 'at-risk', label: 'At risk', count: 1, intervention: 'act' }]);
      const factPack = makeFactPack({
        risk: {
          total_at_risk: 1,
          by_failure_mode: {},
          items: [{ req_id: 'r1', req_title: 'T', days_open: 90, failure_mode: 'X', failure_mode_label: 'X', severity: 'critical', why: 'w', so_what: 's', next_move: 'n', action_type: 'SOURCE_CANDIDATES' as any }],
        },
      });
      const result = computeTopPriority(attention, factPack);
      expect(result.category).toBe('CRITICAL_RISK');
    });

    it('AT_RISK_ATTENTION wins over CAPACITY_BOUND', () => {
      const attention = makeAttentionV2([{ severity: 'at-risk', label: 'HM Friction', count: 2, intervention: 'nudge' }]);
      const factPack = makeFactPack({
        bottleneck: {
          diagnosis: 'CAPACITY_BOUND',
          evidence: [],
          recommendation: 'hire',
          primary_action: { label: 'Go', navigation_target: 'capacity-rebalancer' },
        },
      });
      const result = computeTopPriority(attention, factPack);
      expect(result.category).toBe('AT_RISK_ATTENTION');
    });
  });

  describe('edge cases', () => {
    it('handles empty attention buckets', () => {
      const result = computeTopPriority(makeAttentionV2([]), makeFactPack());
      expect(result.category).toBe('NONE');
    });

    it('handles null verdict', () => {
      const factPack = makeFactPack({
        on_track: { kpis: [], verdict: null, verdict_reason: '' },
      });
      const result = computeTopPriority(makeAttentionV2(), factPack);
      expect(result.category).toBe('NONE');
    });

    it('handles risk items with only high severity (not critical)', () => {
      const factPack = makeFactPack({
        risk: {
          total_at_risk: 2,
          by_failure_mode: {},
          items: [
            { req_id: 'r1', req_title: 'T', days_open: 30, failure_mode: 'X', failure_mode_label: 'X', severity: 'high', why: 'w', so_what: 's', next_move: 'n', action_type: 'SOURCE_CANDIDATES' as any },
          ],
        },
      });
      const result = computeTopPriority(makeAttentionV2(), factPack);
      expect(result.category).toBe('NONE'); // high risk does NOT trigger CRITICAL_RISK
    });

    it('PIPELINE_BOUND does not trigger CAPACITY_BOUND', () => {
      const factPack = makeFactPack({
        bottleneck: {
          diagnosis: 'PIPELINE_BOUND',
          evidence: [],
          recommendation: 'Source more',
          primary_action: { label: 'Go', navigation_target: 'overview' },
        },
      });
      const result = computeTopPriority(makeAttentionV2(), factPack);
      expect(result.category).toBe('NONE');
    });

    it('multiple blocking buckets: first one wins', () => {
      const attention = makeAttentionV2([
        { severity: 'blocking', label: 'First', count: 1, intervention: 'fix A', navigationTarget: 'overview' },
        { severity: 'blocking', label: 'Second', count: 2, intervention: 'fix B', navigationTarget: 'capacity-rebalancer' },
      ]);
      const result = computeTopPriority(attention, makeFactPack());
      expect(result.headline).toContain('First');
    });

    it('multiple critical risks: headline mentions count', () => {
      const factPack = makeFactPack({
        risk: {
          total_at_risk: 3,
          by_failure_mode: {},
          items: [
            { req_id: 'r1', req_title: 'A', days_open: 90, failure_mode: 'X', failure_mode_label: 'Gap', severity: 'critical', why: 'w', so_what: 's', next_move: 'n', action_type: 'SOURCE_CANDIDATES' as any },
            { req_id: 'r2', req_title: 'B', days_open: 80, failure_mode: 'Y', failure_mode_label: 'Slow', severity: 'critical', why: 'w', so_what: 's', next_move: 'n', action_type: 'SOURCE_CANDIDATES' as any },
          ],
        },
      });
      const result = computeTopPriority(makeAttentionV2(), factPack);
      expect(result.headline).toContain('2 critical risks');
    });
  });
});

// ============================================
// CHANGES SUMMARY TESTS
// ============================================

describe('computeChangesSummary', () => {
  it('returns "No material changes" for unavailable data', () => {
    const result = computeChangesSummary({ available: false, deltas: [] });
    expect(result.material_count).toBe(0);
    expect(result.sentence).toContain('No material changes');
  });

  it('returns "No material changes" when no deltas are material', () => {
    const data: ChangesSection = {
      available: true,
      deltas: [
        { direction: 'up', label: 'Minor thing', magnitude: '+1', material: false },
      ],
    };
    const result = computeChangesSummary(data);
    expect(result.material_count).toBe(0);
  });

  it('counts material deltas correctly', () => {
    const data: ChangesSection = {
      available: true,
      deltas: [
        { direction: 'up', label: 'TTF up 8d', magnitude: '+8d', material: true },
        { direction: 'down', label: 'Pipeline shrinking', magnitude: '-15%', material: true },
        { direction: 'up', label: 'Minor noise', magnitude: '+1', material: false },
      ],
    };
    const result = computeChangesSummary(data);
    expect(result.material_count).toBe(2);
    expect(result.sentence).toContain('2 material changes');
    expect(result.sentence).toContain('TTF up 8d');
    expect(result.sentence).toContain('Pipeline shrinking');
  });

  it('truncates labels to 3 in the sentence', () => {
    const data: ChangesSection = {
      available: true,
      deltas: [
        { direction: 'up', label: 'A', magnitude: '+1', material: true },
        { direction: 'down', label: 'B', magnitude: '-1', material: true },
        { direction: 'up', label: 'C', magnitude: '+2', material: true },
        { direction: 'down', label: 'D', magnitude: '-2', material: true },
      ],
    };
    const result = computeChangesSummary(data);
    expect(result.material_count).toBe(4);
    expect(result.sentence).toContain('A');
    expect(result.sentence).toContain('B');
    expect(result.sentence).toContain('C');
    expect(result.sentence).not.toContain('D');
  });

  it('singular form for 1 material change', () => {
    const data: ChangesSection = {
      available: true,
      deltas: [
        { direction: 'up', label: 'TTF up', magnitude: '+5d', material: true },
      ],
    };
    const result = computeChangesSummary(data);
    expect(result.sentence).toContain('1 material change:');
  });
});
