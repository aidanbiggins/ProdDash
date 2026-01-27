// Priority Arbitration Service
// Computes a single TopPriority from all 6 Command Center sections.
// Strict hierarchy — first match wins.

import {
  TopPriority,
  PriorityCategory,
  Accountability,
  ChangesSummary,
  CommandCenterFactPack,
  ChangesSection,
  RiskItem,
} from '../types/commandCenterTypes';
import { AttentionV2Data, AttentionBucket, AttentionBucketId } from '../types/attentionTypes';

/**
 * Computes the single dominant priority from attention data and the fact pack.
 * Hierarchy (first match wins):
 *  1. BLOCKING_ATTENTION — attention bucket with severity 'blocking'
 *  2. OFF_TRACK — OnTrack verdict is 'OFF_TRACK'
 *  3. CRITICAL_RISK — Risk section has items with severity 'critical'
 *  4. AT_RISK_ATTENTION — attention bucket with severity 'at-risk'
 *  5. CAPACITY_BOUND — Bottleneck diagnosis is 'CAPACITY_BOUND' or 'BOTH'
 *  6. NONE — everything is healthy
 */
export function computeTopPriority(
  attentionV2: AttentionV2Data,
  factPack: CommandCenterFactPack
): TopPriority {
  // 1. BLOCKING_ATTENTION
  const blockingBucket = attentionV2.summary.buckets.find(b => b.severity === 'blocking');
  if (blockingBucket) {
    return {
      category: 'BLOCKING_ATTENTION',
      severity: 'critical',
      headline: buildAttentionHeadline(blockingBucket),
      cta_label: blockingBucket.navigationLabel,
      cta_target: blockingBucket.navigationTarget,
      source_section: 'cc_attention',
      accountability: blockingBucket.accountability || deriveAccountabilityFromBucket(blockingBucket, 'critical'),
    };
  }

  // 2. OFF_TRACK
  if (factPack.on_track.verdict === 'OFF_TRACK') {
    const redKpis = factPack.on_track.kpis.filter(k => k.status === 'red');
    const headline = redKpis.length > 0
      ? `${redKpis.length} KPI${redKpis.length > 1 ? 's' : ''} off track: ${redKpis.map(k => k.label).join(', ')}`
      : 'Key metrics are off track';
    return {
      category: 'OFF_TRACK',
      severity: 'critical',
      headline,
      cta_label: 'Escalate KPIs',
      cta_target: 'overview',
      source_section: 'cc_on_track',
      accountability: { owner: 'TA Ops', due: '48h' },
    };
  }

  // 3. CRITICAL_RISK
  const criticalRisks = factPack.risk.items.filter(r => r.severity === 'critical');
  if (criticalRisks.length > 0) {
    const headline = criticalRisks.length === 1
      ? `Critical risk: ${criticalRisks[0].req_title} — ${criticalRisks[0].failure_mode_label}`
      : `${criticalRisks.length} critical risks: ${criticalRisks.slice(0, 2).map(r => r.failure_mode_label).join(', ')}`;
    return {
      category: 'CRITICAL_RISK',
      severity: 'critical',
      headline,
      cta_label: 'Triage risks',
      cta_target: 'forecasting',
      source_section: 'cc_risk',
      accountability: deriveAccountabilityFromRisk(criticalRisks[0]),
    };
  }

  // 4. AT_RISK_ATTENTION
  const atRiskBucket = attentionV2.summary.buckets.find(b => b.severity === 'at-risk');
  if (atRiskBucket) {
    return {
      category: 'AT_RISK_ATTENTION',
      severity: 'high',
      headline: buildAttentionHeadline(atRiskBucket),
      cta_label: atRiskBucket.navigationLabel,
      cta_target: atRiskBucket.navigationTarget,
      source_section: 'cc_attention',
      accountability: atRiskBucket.accountability || deriveAccountabilityFromBucket(atRiskBucket, 'high'),
    };
  }

  // 5. CAPACITY_BOUND
  if (factPack.bottleneck.diagnosis === 'CAPACITY_BOUND' || factPack.bottleneck.diagnosis === 'BOTH') {
    const diagLabel = factPack.bottleneck.diagnosis === 'BOTH'
      ? 'Pipeline and capacity constraints detected'
      : 'Team is capacity-bound — rebalance or hire';
    return {
      category: 'CAPACITY_BOUND',
      severity: 'high',
      headline: diagLabel,
      cta_label: 'Rebalance now',
      cta_target: 'capacity-rebalancer',
      source_section: 'cc_bottleneck',
      accountability: { owner: 'TA Ops', due: 'This week' },
    };
  }

  // 6. NONE — all clear
  return {
    category: 'NONE',
    severity: 'info',
    headline: 'All systems on track',
    cta_label: '',
    cta_target: 'command-center',
    source_section: 'cc_attention',
  };
}

function buildAttentionHeadline(bucket: AttentionBucket): string {
  const countStr = bucket.count === 1 ? '1 item' : `${bucket.count} items`;
  return `${bucket.label}: ${countStr} — ${bucket.intervention}`;
}

const BUCKET_OWNER_MAP: Record<AttentionBucketId, string> = {
  recruiter_throughput: 'TA Ops',
  hm_friction: 'HM',
  pipeline_health: 'Recruiter',
  aging_stalled: 'Recruiter',
  offer_close_risk: 'Recruiter',
};

function deriveAccountabilityFromBucket(bucket: AttentionBucket, severity: 'critical' | 'high'): Accountability {
  return {
    owner: BUCKET_OWNER_MAP[bucket.id] || 'TA Ops',
    due: severity === 'critical' ? '24h' : '48h',
  };
}

function deriveAccountabilityFromRisk(risk: RiskItem): Accountability {
  const ownerMap: Record<string, string> = {
    EMPTY_PIPELINE: 'Recruiter',
    HM_DELAY: 'HM',
    OFFER_RISK: 'Recruiter',
    AGING_DECAY: 'TA Ops',
    STALLED_PIPELINE: 'Recruiter',
    COMPLEXITY_MISMATCH: 'TA Ops',
  };
  return {
    owner: ownerMap[risk.failure_mode] || 'TA Ops',
    due: risk.severity === 'critical' ? '24h' : '48h',
  };
}

/**
 * Derives accountability for a risk item based on its failure mode and severity.
 * Exported for use by RiskSection component.
 */
export function getRiskAccountability(risk: RiskItem): Accountability {
  return risk.accountability || deriveAccountabilityFromRisk(risk);
}

/**
 * Derives accountability for the bottleneck section based on diagnosis.
 */
export function getBottleneckAccountability(diagnosis: string): Accountability {
  return {
    owner: 'TA Ops',
    due: diagnosis === 'HEALTHY' ? '' : 'This week',
  };
}

/**
 * Computes a one-sentence digest of material changes from the Changes section.
 */
export function computeChangesSummary(changes: ChangesSection): ChangesSummary {
  if (!changes.available || changes.deltas.length === 0) {
    return { sentence: 'No material changes this week.', material_count: 0 };
  }

  const materialDeltas = changes.deltas.filter(d => d.material);
  if (materialDeltas.length === 0) {
    return { sentence: 'No material changes this week.', material_count: 0 };
  }

  const labels = materialDeltas.slice(0, 3).map(d => d.label);
  const summary = labels.join(', ');
  const sentence = `${materialDeltas.length} material change${materialDeltas.length > 1 ? 's' : ''}: ${summary}`;

  return { sentence, material_count: materialDeltas.length };
}
