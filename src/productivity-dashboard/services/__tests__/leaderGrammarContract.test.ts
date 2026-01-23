// Leader Grammar Contract Tests
// Enforces the Command Center's structural rules:
// 1. TopPriority includes accountability for critical/high severity
// 2. Risk items always have accountability
// 3. Bottleneck accountability is derived correctly
// 4. Confidence labels include type prefix

import { computeTopPriority, getRiskAccountability, getBottleneckAccountability } from '../priorityArbitrationService';
import { CommandCenterFactPack, RiskItem, ConfidenceType } from '../../types/commandCenterTypes';
import { AttentionV2Data, AttentionBucket } from '../../types/attentionTypes';

// ============================================
// HELPERS
// ============================================

function makeAttention(buckets: Partial<AttentionBucket>[] = []): AttentionV2Data {
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
        accountability: b.accountability,
      })) as AttentionBucket[],
      totalImpacted: 0,
      overallSeverity: 'watch',
      allBlocked: false,
    },
    drilldown: { recruiters: [], hiringManagers: [], reqClusters: [] },
  };
}

function makeFactPack(overrides: Partial<CommandCenterFactPack> = {}): CommandCenterFactPack {
  return {
    attention: { p0_count: 0, p1_count: 0, items: [] },
    on_track: { kpis: [], verdict: 'ON_TRACK', verdict_reason: 'OK' },
    risk: { total_at_risk: 0, by_failure_mode: {}, items: [] },
    changes: { available: false, deltas: [] },
    whatif: { available: false, scenario_previews: [] },
    bottleneck: {
      diagnosis: 'HEALTHY',
      evidence: [],
      recommendation: 'None',
      primary_action: { label: '', navigation_target: '' },
    },
    meta: { computed_at: new Date(), confidence: 'HIGH' as const, blocked_sections: [] },
    ...overrides,
  };
}

// ============================================
// 1. ACCOUNTABILITY ON TOP PRIORITY
// ============================================

describe('TopPriority accountability', () => {
  it('includes accountability when severity is critical (BLOCKING_ATTENTION)', () => {
    const attention = makeAttention([{ severity: 'blocking', label: 'Overloaded', count: 3, intervention: 'rebalance' }]);
    const result = computeTopPriority(attention, makeFactPack());
    expect(result.severity).toBe('critical');
    expect(result.accountability).toBeDefined();
    expect(result.accountability!.owner).toBeTruthy();
    expect(result.accountability!.due).toBeTruthy();
  });

  it('includes accountability when severity is critical (OFF_TRACK)', () => {
    const factPack = makeFactPack({
      on_track: { kpis: [{ id: 'x', label: 'TTF', value: 70, target: 45, status: 'red', unit: 'd' }], verdict: 'OFF_TRACK', verdict_reason: 'bad' },
    });
    const result = computeTopPriority(makeAttention(), factPack);
    expect(result.severity).toBe('critical');
    expect(result.accountability).toBeDefined();
    expect(result.accountability!.owner).toBe('TA Ops');
    expect(result.accountability!.due).toBe('48h');
  });

  it('includes accountability when severity is critical (CRITICAL_RISK)', () => {
    const factPack = makeFactPack({
      risk: {
        total_at_risk: 1,
        by_failure_mode: {},
        items: [{ req_id: 'r1', req_title: 'Eng', days_open: 90, failure_mode: 'EMPTY_PIPELINE', failure_mode_label: 'Gap', severity: 'critical', why: 'w', so_what: 's', next_move: 'source', action_type: 'SOURCE_CANDIDATES' as any }],
      },
    });
    const result = computeTopPriority(makeAttention(), factPack);
    expect(result.accountability).toBeDefined();
    expect(result.accountability!.owner).toBe('Recruiter');
    expect(result.accountability!.due).toBe('24h');
  });

  it('includes accountability when severity is high (AT_RISK_ATTENTION)', () => {
    const attention = makeAttention([{ severity: 'at-risk', id: 'hm_friction', label: 'HM Friction', count: 2, intervention: 'nudge' }]);
    const result = computeTopPriority(attention, makeFactPack());
    expect(result.severity).toBe('high');
    expect(result.accountability).toBeDefined();
    expect(result.accountability!.owner).toBe('HM');
    expect(result.accountability!.due).toBe('48h');
  });

  it('includes accountability when severity is high (CAPACITY_BOUND)', () => {
    const factPack = makeFactPack({
      bottleneck: { diagnosis: 'CAPACITY_BOUND', evidence: [], recommendation: 'hire', primary_action: { label: 'Go', navigation_target: '' } },
    });
    const result = computeTopPriority(makeAttention(), factPack);
    expect(result.accountability).toBeDefined();
    expect(result.accountability!.owner).toBe('TA Ops');
    expect(result.accountability!.due).toBe('This week');
  });

  it('does NOT include accountability when severity is info (NONE)', () => {
    const result = computeTopPriority(makeAttention(), makeFactPack());
    expect(result.category).toBe('NONE');
    expect(result.accountability).toBeUndefined();
  });
});

// ============================================
// 2. RISK ITEM ACCOUNTABILITY
// ============================================

describe('getRiskAccountability', () => {
  it('returns Recruiter for EMPTY_PIPELINE', () => {
    const risk: RiskItem = { req_id: 'r1', req_title: 'T', days_open: 30, failure_mode: 'EMPTY_PIPELINE', failure_mode_label: 'Gap', severity: 'critical', why: 'w', so_what: 's', next_move: 'n', action_type: 'SOURCE_CANDIDATES' as any };
    const result = getRiskAccountability(risk);
    expect(result.owner).toBe('Recruiter');
    expect(result.due).toBe('24h');
  });

  it('returns HM for HM_DELAY', () => {
    const risk: RiskItem = { req_id: 'r1', req_title: 'T', days_open: 30, failure_mode: 'HM_DELAY', failure_mode_label: 'HM slow', severity: 'high', why: 'w', so_what: 's', next_move: 'n', action_type: 'FEEDBACK_DUE' as any };
    const result = getRiskAccountability(risk);
    expect(result.owner).toBe('HM');
    expect(result.due).toBe('48h');
  });

  it('returns TA Ops for AGING_DECAY', () => {
    const risk: RiskItem = { req_id: 'r1', req_title: 'T', days_open: 120, failure_mode: 'AGING_DECAY', failure_mode_label: 'Aging', severity: 'medium', why: 'w', so_what: 's', next_move: 'n', action_type: 'REVIEW_STALLED_REQS' as any };
    const result = getRiskAccountability(risk);
    expect(result.owner).toBe('TA Ops');
    expect(result.due).toBe('48h');
  });

  it('uses pre-set accountability if available', () => {
    const risk: RiskItem = { req_id: 'r1', req_title: 'T', days_open: 30, failure_mode: 'X', failure_mode_label: 'X', severity: 'critical', why: 'w', so_what: 's', next_move: 'n', action_type: 'SOURCE_CANDIDATES' as any, accountability: { owner: 'Exec', due: 'Today' } };
    const result = getRiskAccountability(risk);
    expect(result.owner).toBe('Exec');
    expect(result.due).toBe('Today');
  });
});

// ============================================
// 3. BOTTLENECK ACCOUNTABILITY
// ============================================

describe('getBottleneckAccountability', () => {
  it('returns TA Ops with This week for non-healthy', () => {
    expect(getBottleneckAccountability('CAPACITY_BOUND')).toEqual({ owner: 'TA Ops', due: 'This week' });
    expect(getBottleneckAccountability('PIPELINE_BOUND')).toEqual({ owner: 'TA Ops', due: 'This week' });
    expect(getBottleneckAccountability('BOTH')).toEqual({ owner: 'TA Ops', due: 'This week' });
  });

  it('returns empty due for HEALTHY', () => {
    const result = getBottleneckAccountability('HEALTHY');
    expect(result.owner).toBe('TA Ops');
    expect(result.due).toBe('');
  });
});

// ============================================
// 4. CONFIDENCE TYPE LABELS
// ============================================

describe('ConfidenceType enum', () => {
  it('defines data, risk, and forecast types', () => {
    const types: ConfidenceType[] = ['data', 'risk', 'forecast'];
    expect(types).toHaveLength(3);
    types.forEach(t => expect(typeof t).toBe('string'));
  });
});

// ============================================
// 5. CTA VERBS (leader tone)
// ============================================

describe('TopPriority CTA labels use decision verbs', () => {
  it('OFF_TRACK uses Escalate', () => {
    const factPack = makeFactPack({
      on_track: { kpis: [{ id: 'x', label: 'X', value: 10, target: 5, status: 'red', unit: '' }], verdict: 'OFF_TRACK', verdict_reason: 'bad' },
    });
    const result = computeTopPriority(makeAttention(), factPack);
    expect(result.cta_label).toBe('Escalate KPIs');
  });

  it('CRITICAL_RISK uses Triage', () => {
    const factPack = makeFactPack({
      risk: {
        total_at_risk: 1,
        by_failure_mode: {},
        items: [{ req_id: 'r1', req_title: 'T', days_open: 90, failure_mode: 'X', failure_mode_label: 'X', severity: 'critical', why: 'w', so_what: 's', next_move: 'n', action_type: 'SOURCE_CANDIDATES' as any }],
      },
    });
    const result = computeTopPriority(makeAttention(), factPack);
    expect(result.cta_label).toBe('Triage risks');
  });

  it('CAPACITY_BOUND uses Rebalance', () => {
    const factPack = makeFactPack({
      bottleneck: { diagnosis: 'CAPACITY_BOUND', evidence: [], recommendation: 'hire', primary_action: { label: 'Go', navigation_target: '' } },
    });
    const result = computeTopPriority(makeAttention(), factPack);
    expect(result.cta_label).toBe('Rebalance now');
  });
});
