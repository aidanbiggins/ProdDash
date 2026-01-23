// Command Center Service
// Assembles the CommandCenterFactPack from existing services.
// No new metric computations — all data from existing engines.

import {
  CommandCenterFactPack,
  AttentionSection,
  AttentionItem,
  OnTrackSection,
  KPIRow,
  KPIStatus,
  Verdict,
  RiskSection,
  RiskItem,
  ChangesSection,
  DeltaItem,
  WhatIfSection,
  ScenarioPreview,
  BottleneckSection,
  BottleneckDiagnosis,
  SectionId,
  SectionGateResult,
} from '../types/commandCenterTypes';
import { ActionItem } from '../types/actionTypes';
import { CapabilityStatus, ConfidenceLevel } from '../types/capabilityTypes';
import { Requisition, Candidate, Event, User, CanonicalStage } from '../types/entities';
import { OverviewMetrics, MetricFilters, HiringManagerFriction } from '../types/metrics';
import { DashboardConfig } from '../types/config';
import { CoverageMetrics } from '../types/resilientImportTypes';
import { PreMortemResult } from '../types/preMortemTypes';

// ============================================
// SECTION GATING
// ============================================

export function evaluateSectionGates(coverage: CoverageMetrics | null | undefined): SectionGateResult[] {
  if (!coverage) {
    // No data at all — everything blocked
    return ALL_SECTIONS.map(id => ({
      sectionId: id,
      status: 'BLOCKED' as CapabilityStatus,
      confidence: 'LOW' as ConfidenceLevel,
      blockedReason: 'No data imported',
      repairCTA: { label: 'Import Data', action: 'import' as const },
    }));
  }

  return [
    gateAttention(coverage),
    gateOnTrack(coverage),
    gateRisk(coverage),
    gateChanges(coverage),
    gateWhatIf(coverage),
    gateBottleneck(coverage),
  ];
}

const ALL_SECTIONS: SectionId[] = ['cc_attention', 'cc_on_track', 'cc_risk', 'cc_changes', 'cc_whatif', 'cc_bottleneck'];

function gateAttention(c: CoverageMetrics): SectionGateResult {
  if (c.counts.requisitions === 0 && c.counts.candidates === 0) {
    return { sectionId: 'cc_attention', status: 'BLOCKED', confidence: 'LOW', blockedReason: 'No data imported', repairCTA: { label: 'Import Data', action: 'import' } };
  }
  const limited = !c.flags.hasStageEvents;
  return {
    sectionId: 'cc_attention',
    status: limited ? 'LIMITED' : 'ENABLED',
    confidence: limited ? 'MED' : 'HIGH',
    limitedReason: limited ? 'No stage event data — SLA-based actions unavailable' : undefined,
  };
}

function gateOnTrack(c: CoverageMetrics): SectionGateResult {
  if (c.counts.requisitions === 0 || !c.flags.hasTimestamps) {
    return { sectionId: 'cc_on_track', status: 'BLOCKED', confidence: 'LOW', blockedReason: 'Needs application timestamps', repairCTA: { label: 'Map Columns', action: 'map_columns' } };
  }
  const limited = c.sampleSizes.hires < 5;
  return {
    sectionId: 'cc_on_track',
    status: limited ? 'LIMITED' : 'ENABLED',
    confidence: limited ? 'MED' : 'HIGH',
    limitedReason: limited ? 'Limited hire data — verdict may be imprecise' : undefined,
  };
}

function gateRisk(c: CoverageMetrics): SectionGateResult {
  if (c.counts.requisitions === 0) {
    return { sectionId: 'cc_risk', status: 'BLOCKED', confidence: 'LOW', blockedReason: 'No requisitions', repairCTA: { label: 'Import Data', action: 'import' } };
  }
  const limited = !c.flags.hasStageEvents;
  return {
    sectionId: 'cc_risk',
    status: limited ? 'LIMITED' : 'ENABLED',
    confidence: limited ? 'MED' : 'HIGH',
    limitedReason: limited ? 'No stage events — pipeline gap detection limited' : undefined,
  };
}

function gateChanges(c: CoverageMetrics): SectionGateResult {
  if (!c.flags.hasMultipleSnapshots) {
    return { sectionId: 'cc_changes', status: 'BLOCKED', confidence: 'LOW', blockedReason: 'Requires 2+ data snapshots', repairCTA: { label: 'Import Snapshot', action: 'import_snapshot' } };
  }
  const limited = c.counts.snapshots === 2;
  return {
    sectionId: 'cc_changes',
    status: limited ? 'LIMITED' : 'ENABLED',
    confidence: limited ? 'MED' : 'HIGH',
    limitedReason: limited ? 'Only 2 snapshots — limited comparison window' : undefined,
  };
}

function gateWhatIf(c: CoverageMetrics): SectionGateResult {
  if (!c.flags.hasRecruiterAssignment) {
    return { sectionId: 'cc_whatif', status: 'BLOCKED', confidence: 'LOW', blockedReason: 'Needs recruiter assignment data', repairCTA: { label: 'Map Columns', action: 'map_columns' } };
  }
  const limited = !c.flags.hasCapacityHistory;
  return {
    sectionId: 'cc_whatif',
    status: limited ? 'LIMITED' : 'ENABLED',
    confidence: limited ? 'MED' : 'HIGH',
    limitedReason: limited ? 'No capacity history — impact estimates approximate' : undefined,
  };
}

function gateBottleneck(c: CoverageMetrics): SectionGateResult {
  if (!c.flags.hasRecruiterAssignment) {
    return { sectionId: 'cc_bottleneck', status: 'BLOCKED', confidence: 'LOW', blockedReason: 'Needs recruiter assignment data', repairCTA: { label: 'Map Columns', action: 'map_columns' } };
  }
  const limited = !c.flags.hasCapacityHistory && !c.flags.hasStageEvents;
  return {
    sectionId: 'cc_bottleneck',
    status: limited ? 'LIMITED' : 'ENABLED',
    confidence: limited ? 'MED' : 'HIGH',
    limitedReason: limited ? 'Missing capacity history or stage events' : undefined,
  };
}

// ============================================
// SECTION BUILDERS
// ============================================

export interface CommandCenterContext {
  requisitions: Requisition[];
  candidates: Candidate[];
  events: Event[];
  users: User[];
  overview: OverviewMetrics | null;
  hmFriction: HiringManagerFriction[];
  actions: ActionItem[];
  preMortems: PreMortemResult[];
  filters: MetricFilters;
  config: DashboardConfig;
  coverage: CoverageMetrics | null | undefined;
  snapshots?: Array<{ date: Date; reqCount: number; candidateCount: number; hireCount: number; offerCount: number }>;
}

export function buildCommandCenterFactPack(ctx: CommandCenterContext): CommandCenterFactPack {
  const gates = evaluateSectionGates(ctx.coverage);
  const blockedSections = gates.filter(g => g.status === 'BLOCKED').map(g => g.sectionId);

  const gateMap = new Map(gates.map(g => [g.sectionId, g]));

  const attention = gateMap.get('cc_attention')?.status !== 'BLOCKED'
    ? buildAttention(ctx)
    : { p0_count: 0, p1_count: 0, items: [] };

  const on_track = gateMap.get('cc_on_track')?.status !== 'BLOCKED'
    ? buildOnTrack(ctx)
    : { kpis: [], verdict: null, verdict_reason: '' };

  const risk = gateMap.get('cc_risk')?.status !== 'BLOCKED'
    ? buildRisk(ctx)
    : { total_at_risk: 0, by_failure_mode: {}, items: [] };

  const changes = gateMap.get('cc_changes')?.status !== 'BLOCKED'
    ? buildChanges(ctx)
    : { available: false, deltas: [] };

  const whatif = gateMap.get('cc_whatif')?.status !== 'BLOCKED'
    ? buildWhatIf(ctx)
    : { available: false, scenario_previews: [] };

  const bottleneck = gateMap.get('cc_bottleneck')?.status !== 'BLOCKED'
    ? buildBottleneck(ctx)
    : { diagnosis: 'HEALTHY' as BottleneckDiagnosis, evidence: [], recommendation: '', primary_action: { label: '', navigation_target: '' } };

  // Overall confidence is the floor of all non-blocked sections
  const nonBlockedGates = gates.filter(g => g.status !== 'BLOCKED');
  const confidence: ConfidenceLevel = nonBlockedGates.length === 0 ? 'LOW'
    : nonBlockedGates.some(g => g.confidence === 'LOW') ? 'LOW'
    : nonBlockedGates.some(g => g.confidence === 'MED') ? 'MED'
    : 'HIGH';

  return {
    attention,
    on_track,
    risk,
    changes,
    whatif,
    bottleneck,
    meta: {
      computed_at: new Date(),
      confidence,
      blocked_sections: blockedSections,
    },
  };
}

// ============================================
// ATTENTION BUILDER
// ============================================

function buildAttention(ctx: CommandCenterContext): AttentionSection {
  const openActions = ctx.actions.filter(a => a.status === 'OPEN');
  const p0Actions = openActions.filter(a => a.priority === 'P0');
  const p1Actions = openActions.filter(a => a.priority === 'P1');

  // Top 5 items sorted by priority then due date
  const sorted = [...openActions]
    .sort((a, b) => {
      const priorityOrder = { P0: 0, P1: 1, P2: 2 };
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      return a.due_in_days - b.due_in_days;
    })
    .slice(0, 5);

  const items: AttentionItem[] = sorted.map(a => ({
    action_id: a.action_id,
    priority: a.priority,
    title: a.title,
    owner_name: a.owner_name,
    owner_type: a.owner_type,
    due_in_days: a.due_in_days,
    recommended_action: a.recommended_steps[0] || 'Review and take action',
    confidence: a.due_in_days <= 0 ? 'HIGH' : a.due_in_days <= 3 ? 'MED' : 'LOW',
    req_id: a.req_id !== 'general' ? a.req_id : undefined,
    explain_kpi: a.evidence?.explain_provider_key,
  }));

  return {
    p0_count: p0Actions.length,
    p1_count: p1Actions.length,
    items,
  };
}

// ============================================
// ON TRACK BUILDER
// ============================================

function buildOnTrack(ctx: CommandCenterContext): OnTrackSection {
  const kpis: KPIRow[] = [];

  if (ctx.overview) {
    // Median TTF
    if (ctx.overview.medianTTF !== undefined && ctx.overview.medianTTF !== null) {
      const ttfValue = ctx.overview.medianTTF;
      kpis.push({
        id: 'median_ttf',
        label: 'Median TTF',
        value: ttfValue,
        target: 45,
        status: getKPIStatus(ttfValue, 45, 'lower_better'),
        unit: 'days',
        explain_provider: 'median_ttf',
      });
    }

    // Accept Rate
    if (ctx.overview.totalOfferAcceptanceRate !== undefined && ctx.overview.totalOfferAcceptanceRate !== null) {
      const acceptRate = ctx.overview.totalOfferAcceptanceRate * 100;
      kpis.push({
        id: 'accept_rate',
        label: 'Accept Rate',
        value: Math.round(acceptRate),
        target: 80,
        status: getKPIStatus(acceptRate, 80, 'higher_better'),
        unit: '%',
        explain_provider: 'accept_rate',
      });
    }

    // Total Offers
    if (ctx.overview.totalOffers !== undefined) {
      kpis.push({
        id: 'offers',
        label: 'Offers',
        value: ctx.overview.totalOffers,
        target: 0, // No target — just tracking
        status: ctx.overview.totalOffers > 0 ? 'green' : 'amber',
        unit: '',
      });
    }
  }

  // Pipeline Gap (from open reqs vs forecast)
  const openReqs = ctx.requisitions.filter(r => !r.closed_at);
  const hiredCount = ctx.candidates.filter(c => c.hired_at).length;
  if (openReqs.length > 0) {
    // Simplified gap: open reqs still needing hires
    const gap = openReqs.length;
    kpis.push({
      id: 'pipeline_gap',
      label: 'Open Reqs',
      value: gap,
      target: 0,
      status: gap > 10 ? 'red' : gap > 5 ? 'amber' : 'green',
      unit: 'reqs',
    });
  }

  // Compute verdict
  let verdict: Verdict | null = null;
  let verdict_reason = '';

  const computableKPIs = kpis.filter(k => k.value !== null);
  if (computableKPIs.length >= 2) {
    const redCount = computableKPIs.filter(k => k.status === 'red').length;
    const amberCount = computableKPIs.filter(k => k.status === 'amber').length;

    if (redCount >= 2) {
      verdict = 'OFF_TRACK';
      verdict_reason = `${redCount} KPIs are off target`;
    } else if (redCount >= 1 || amberCount >= 2) {
      verdict = 'AT_RISK';
      const issues = computableKPIs.filter(k => k.status !== 'green').map(k => k.label);
      verdict_reason = `Watch: ${issues.join(', ')}`;
    } else {
      verdict = 'ON_TRACK';
      verdict_reason = 'All tracked KPIs within targets';
    }
  }

  return { kpis, verdict, verdict_reason };
}

function getKPIStatus(value: number, target: number, direction: 'higher_better' | 'lower_better'): KPIStatus {
  if (direction === 'lower_better') {
    if (value <= target) return 'green';
    if (value <= target * 1.3) return 'amber';
    return 'red';
  }
  // higher_better
  if (value >= target) return 'green';
  if (value >= target * 0.7) return 'amber';
  return 'red';
}

// ============================================
// RISK BUILDER
// ============================================

function buildRisk(ctx: CommandCenterContext): RiskSection {
  const items: RiskItem[] = ctx.preMortems
    .filter(pm => pm.risk_band === 'HIGH' || pm.risk_band === 'MED')
    .sort((a, b) => b.risk_score - a.risk_score)
    .slice(0, 5)
    .map(pm => ({
      req_id: pm.req_id,
      req_title: pm.req_title || `Req ${pm.req_id}`,
      days_open: pm.days_open,
      failure_mode: pm.failure_mode,
      failure_mode_label: formatFailureMode(pm.failure_mode),
      severity: pm.risk_score >= 80 ? 'critical' as const : pm.risk_score >= 60 ? 'high' as const : 'medium' as const,
      why: pm.top_drivers[0]?.description || 'Multiple risk factors',
      so_what: `${pm.active_candidate_count} active candidates, ${pm.days_open} days open`,
      next_move: pm.recommended_interventions[0]?.steps[0] || 'Review and take action',
      action_type: mapFailureModeToAction(pm.failure_mode),
    }));

  // Count by failure mode
  const by_failure_mode: Record<string, number> = {};
  for (const pm of ctx.preMortems.filter(p => p.risk_band === 'HIGH' || p.risk_band === 'MED')) {
    by_failure_mode[pm.failure_mode] = (by_failure_mode[pm.failure_mode] || 0) + 1;
  }

  return {
    total_at_risk: ctx.preMortems.filter(p => p.risk_band === 'HIGH' || p.risk_band === 'MED').length,
    by_failure_mode,
    items,
  };
}

function formatFailureMode(mode: string): string {
  const labels: Record<string, string> = {
    EMPTY_PIPELINE: 'Pipeline gap',
    HM_DELAY: 'HM slow',
    OFFER_RISK: 'Offer at risk',
    AGING_DECAY: 'Aging',
    STALLED_PIPELINE: 'Stalled',
    COMPLEXITY_MISMATCH: 'Complexity',
  };
  return labels[mode] || mode;
}

function mapFailureModeToAction(mode: string): ActionItem['action_type'] {
  const mapping: Record<string, ActionItem['action_type']> = {
    EMPTY_PIPELINE: 'SOURCE_CANDIDATES',
    HM_DELAY: 'FEEDBACK_DUE',
    OFFER_RISK: 'FOLLOW_UP_OFFERS',
    AGING_DECAY: 'REVIEW_STALLED_REQS',
    STALLED_PIPELINE: 'REVIEW_STALLED_REQS',
    COMPLEXITY_MISMATCH: 'PIPELINE_HEALTH_CHECK',
  };
  return mapping[mode] || 'PIPELINE_HEALTH_CHECK';
}

// ============================================
// CHANGES BUILDER
// ============================================

function buildChanges(ctx: CommandCenterContext): ChangesSection {
  // Use snapshot data if available, otherwise compute from events in last 7 days
  const deltas: DeltaItem[] = [];
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Recent hires (last 7 days)
  const recentHires = ctx.candidates.filter(c => c.hired_at && c.hired_at >= weekAgo);
  if (recentHires.length > 0) {
    deltas.push({
      direction: 'up',
      label: `${recentHires.length} new hire${recentHires.length > 1 ? 's' : ''} closed`,
      magnitude: `${recentHires.length} this week`,
      material: true,
    });
  }

  // Recent offers extended
  const recentOffers = ctx.candidates.filter(c =>
    c.offer_extended_at && c.offer_extended_at >= weekAgo
  );
  if (recentOffers.length > 0) {
    deltas.push({
      direction: 'up',
      label: `${recentOffers.length} new offer${recentOffers.length > 1 ? 's' : ''} extended`,
      magnitude: `${recentOffers.length} this week`,
      material: true,
    });
  }

  // Recent rejections at offer stage (declines)
  const recentDeclines = ctx.events.filter(e =>
    e.event_at >= weekAgo &&
    (e.event_type === 'OFFER_DECLINED' || e.event_type === 'CANDIDATE_WITHDREW') &&
    e.from_stage === CanonicalStage.OFFER
  );
  if (recentDeclines.length > 0) {
    deltas.push({
      direction: 'down',
      label: `${recentDeclines.length} offer decline${recentDeclines.length > 1 ? 's' : ''}`,
      magnitude: `${recentDeclines.length} this week`,
      material: true,
      action_type: 'REVIEW_DECLINED_OFFERS',
    });
  }

  // New reqs opened
  const recentReqs = ctx.requisitions.filter(r => r.opened_at && r.opened_at >= weekAgo);
  if (recentReqs.length > 0) {
    deltas.push({
      direction: 'up',
      label: `${recentReqs.length} new req${recentReqs.length > 1 ? 's' : ''} opened`,
      magnitude: `${recentReqs.length} this week`,
      material: false,
    });
  }

  // Stalled reqs (no activity 30+ days)
  const stalledReqs = ctx.requisitions.filter(r => {
    if (r.closed_at) return false;
    const lastEvent = ctx.events
      .filter(e => e.req_id === r.req_id)
      .sort((a, b) => b.event_at.getTime() - a.event_at.getTime())[0];
    if (!lastEvent) return true;
    return (now.getTime() - lastEvent.event_at.getTime()) > 30 * 24 * 60 * 60 * 1000;
  });
  if (stalledReqs.length > 0) {
    deltas.push({
      direction: 'down',
      label: `${stalledReqs.length} zombie req${stalledReqs.length > 1 ? 's' : ''} (30+ days inactive)`,
      magnitude: `${stalledReqs.length} total`,
      material: stalledReqs.length >= 3,
      action_type: 'REVIEW_ZOMBIE_REQS',
    });
  }

  // Sort: material first, then by direction (down first for urgency)
  deltas.sort((a, b) => {
    if (a.material !== b.material) return a.material ? -1 : 1;
    if (a.direction === 'down' && b.direction !== 'down') return -1;
    if (b.direction === 'down' && a.direction !== 'down') return 1;
    return 0;
  });

  return { available: true, deltas: deltas.slice(0, 5) };
}

// ============================================
// WHAT-IF BUILDER
// ============================================

function buildWhatIf(ctx: CommandCenterContext): WhatIfSection {
  const previews: ScenarioPreview[] = [];

  // Get recruiter utilization context
  const recruiters = ctx.users.filter(u => {
    const recruiterReqs = ctx.requisitions.filter(r => r.recruiter_id === u.user_id && !r.closed_at);
    return recruiterReqs.length > 0;
  });

  const avgLoad = recruiters.length > 0
    ? ctx.requisitions.filter(r => !r.closed_at && r.recruiter_id).length / recruiters.length
    : 0;

  const overloadedRecruiters = recruiters.filter(u => {
    const reqCount = ctx.requisitions.filter(r => r.recruiter_id === u.user_id && !r.closed_at).length;
    return reqCount > avgLoad * 1.3;
  });

  const openReqs = ctx.requisitions.filter(r => !r.closed_at);
  const pipelineGap = openReqs.length - ctx.candidates.filter(c => c.hired_at).length;

  // Always show "Recruiter Leaves" if overloaded recruiters exist
  if (overloadedRecruiters.length > 0 || recruiters.length >= 2) {
    previews.push({
      scenario_id: 'recruiter_leaves',
      title: 'A recruiter leaves?',
      impact_summary: overloadedRecruiters.length > 0
        ? `${overloadedRecruiters.length} recruiter${overloadedRecruiters.length > 1 ? 's' : ''} already overloaded — departure would strand ${Math.round(avgLoad)} reqs`
        : `Team of ${recruiters.length} — losing one affects ${Math.round(avgLoad)} reqs avg`,
      relevance_reason: overloadedRecruiters.length > 0 ? 'Overloaded recruiters increase departure risk' : 'Proactive capacity planning',
      decision_ask: 'Should we pre-plan redistribution?',
    });
  }

  // Show "Hiring Freeze" if there's a pipeline gap or significant open reqs
  if (pipelineGap > 0 || openReqs.length > 5) {
    previews.push({
      scenario_id: 'hiring_freeze',
      title: 'We freeze hiring for 4 weeks?',
      impact_summary: `${openReqs.length} open reqs would stall — pipeline dries up in ~3 weeks`,
      relevance_reason: pipelineGap > 0 ? 'Already behind on hiring goals' : 'Active pipeline at risk',
      decision_ask: 'What would we lose vs save?',
    });
  }

  // Show "Spin Up Team" if more reqs than capacity
  if (previews.length < 2 && openReqs.length > recruiters.length * 8) {
    previews.push({
      scenario_id: 'spin_up_team',
      title: 'We add a recruiter?',
      impact_summary: `Current load: ${avgLoad.toFixed(1)} reqs/recruiter — new hire takes ~${Math.round(avgLoad)} reqs`,
      relevance_reason: 'Above sustainable req load per recruiter',
      decision_ask: 'Is it time to grow the team?',
    });
  }

  return { available: previews.length > 0, scenario_previews: previews.slice(0, 2) };
}

// ============================================
// BOTTLENECK BUILDER
// ============================================

function buildBottleneck(ctx: CommandCenterContext): BottleneckSection {
  const evidence: string[] = [];
  const openReqs = ctx.requisitions.filter(r => !r.closed_at);

  // Capacity metrics
  const recruiters = ctx.users.filter(u => {
    return ctx.requisitions.some(r => r.recruiter_id === u.user_id && !r.closed_at);
  });

  const avgLoad = recruiters.length > 0
    ? openReqs.filter(r => r.recruiter_id).length / recruiters.length
    : 0;

  const overloadedCount = recruiters.filter(u => {
    const reqCount = ctx.requisitions.filter(r => r.recruiter_id === u.user_id && !r.closed_at).length;
    return reqCount > avgLoad * 1.3;
  }).length;

  // Pipeline metrics
  const activeCandidates = ctx.candidates.filter(c =>
    !c.hired_at && c.current_stage !== CanonicalStage.REJECTED && c.current_stage !== CanonicalStage.WITHDREW
  );
  const candsPerReq = openReqs.length > 0 ? activeCandidates.length / openReqs.length : 0;
  const pipelineHealthy = candsPerReq >= 3;

  // Determine diagnosis
  let diagnosis: BottleneckDiagnosis;
  let recommendation: string;
  let primary_action: { label: string; navigation_target: string };

  if (overloadedCount > 0 && !pipelineHealthy) {
    diagnosis = 'BOTH';
    evidence.push(`${overloadedCount} of ${recruiters.length} recruiters overloaded (>${Math.round(avgLoad * 1.3)} reqs)`);
    evidence.push(`Pipeline thin: ${candsPerReq.toFixed(1)} candidates/req avg (need 3+)`);
    recommendation = 'Rebalance overloaded recruiters AND source more candidates for thin pipelines.';
    primary_action = { label: 'View capacity plan', navigation_target: 'capacity-rebalancer' };
  } else if (overloadedCount > 0 && pipelineHealthy) {
    diagnosis = 'CAPACITY_BOUND';
    evidence.push(`${overloadedCount} of ${recruiters.length} recruiters overloaded`);
    evidence.push(`Pipeline is healthy: ${candsPerReq.toFixed(1)} candidates/req avg`);
    recommendation = `Rebalance ${Math.min(overloadedCount * 2, openReqs.length)} reqs from overloaded recruiters before sourcing more candidates.`;
    primary_action = { label: 'Rebalance reqs', navigation_target: 'capacity-rebalancer' };
  } else if (!pipelineHealthy && openReqs.length > 0) {
    diagnosis = 'PIPELINE_BOUND';
    evidence.push(`Pipeline thin: ${candsPerReq.toFixed(1)} candidates/req avg (need 3+)`);
    evidence.push(`Capacity balanced: avg ${avgLoad.toFixed(1)} reqs/recruiter`);
    recommendation = 'Source more candidates — capacity is available but pipeline is insufficient.';
    primary_action = { label: 'View pipeline health', navigation_target: 'overview' };
  } else {
    diagnosis = 'HEALTHY';
    evidence.push(`Capacity balanced: avg ${avgLoad.toFixed(1)} reqs/recruiter`);
    evidence.push(`Pipeline adequate: ${candsPerReq.toFixed(1)} candidates/req avg`);
    recommendation = 'No immediate bottleneck. Continue monitoring velocity.';
    primary_action = { label: 'View pipeline velocity', navigation_target: 'velocity' };
  }

  // Add bottleneck stage if available
  if (ctx.events.length > 0) {
    const stageDurations = computeStageDurations(ctx.events);
    const slowestStage = Object.entries(stageDurations)
      .filter(([_, days]) => days > 0)
      .sort((a, b) => b[1] - a[1])[0];
    if (slowestStage) {
      evidence.push(`Slowest stage: ${formatStageName(slowestStage[0])} (avg ${Math.round(slowestStage[1])} days)`);
    }
  }

  return { diagnosis, evidence, recommendation, primary_action };
}

function computeStageDurations(events: Event[]): Record<string, number> {
  const stageEntryTimes = new Map<string, Map<string, Date>>(); // candidateId -> stage -> entry time
  const stageDurations: Record<string, number[]> = {};

  const sorted = [...events]
    .filter(e => e.event_type === 'STAGE_CHANGE' && e.to_stage)
    .sort((a, b) => a.event_at.getTime() - b.event_at.getTime());

  for (const event of sorted) {
    if (!stageEntryTimes.has(event.candidate_id)) {
      stageEntryTimes.set(event.candidate_id, new Map());
    }
    const candStages = stageEntryTimes.get(event.candidate_id)!;

    // Record exit from previous stage
    if (event.from_stage && candStages.has(event.from_stage)) {
      const enteredAt = candStages.get(event.from_stage)!;
      const duration = (event.event_at.getTime() - enteredAt.getTime()) / (1000 * 60 * 60 * 24);
      if (duration > 0 && duration < 365) {
        if (!stageDurations[event.from_stage]) stageDurations[event.from_stage] = [];
        stageDurations[event.from_stage].push(duration);
      }
    }

    // Record entry to new stage
    if (event.to_stage) {
      candStages.set(event.to_stage, event.event_at);
    }
  }

  // Compute averages
  const result: Record<string, number> = {};
  for (const [stage, durations] of Object.entries(stageDurations)) {
    if (durations.length >= 3) {
      result[stage] = durations.reduce((s, d) => s + d, 0) / durations.length;
    }
  }
  return result;
}

function formatStageName(stage: string): string {
  const names: Record<string, string> = {
    SCREEN: 'Screen',
    HM_SCREEN: 'HM Screen',
    ONSITE: 'Onsite',
    OFFER: 'Offer',
    FINAL: 'Final',
    APPLIED: 'Applied',
  };
  return names[stage] || stage;
}

// ============================================
// WEEKLY BRIEF EXPORT
// ============================================

export function generateWeeklyBrief(pack: CommandCenterFactPack, orgName: string = 'Your Organization'): string {
  const lines: string[] = [];
  const dateStr = pack.meta.computed_at.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  lines.push(`# Weekly TA Brief — ${orgName}`);
  lines.push(`## Generated: ${dateStr}`);
  lines.push('');

  // Section 1: Attention
  lines.push('### 1. What needs attention');
  if (pack.meta.blocked_sections.includes('cc_attention')) {
    lines.push('_Not available — import requisition and candidate data to enable._');
  } else if (pack.attention.items.length === 0) {
    lines.push('No blocking actions this week.');
  } else {
    lines.push(`**${pack.attention.p0_count} blocking** | **${pack.attention.p1_count} at-risk**`);
    lines.push('');
    for (const item of pack.attention.items) {
      lines.push(`- **[${item.priority}]** ${item.title} (${item.owner_name}) — ${item.recommended_action}`);
    }
  }
  lines.push('');

  // Section 2: On Track
  lines.push('### 2. Are we on track?');
  if (pack.meta.blocked_sections.includes('cc_on_track')) {
    lines.push('_Not available — needs application timestamps and hire outcomes._');
  } else {
    lines.push('| KPI | Value | Target | Status |');
    lines.push('|-----|-------|--------|--------|');
    for (const kpi of pack.on_track.kpis) {
      const statusEmoji = kpi.status === 'green' ? 'OK' : kpi.status === 'amber' ? 'WATCH' : 'MISS';
      lines.push(`| ${kpi.label} | ${kpi.value ?? '—'}${kpi.unit} | ${kpi.target > 0 ? kpi.target + kpi.unit : '—'} | ${statusEmoji} |`);
    }
    if (pack.on_track.verdict) {
      lines.push('');
      lines.push(`**Verdict: ${pack.on_track.verdict.replace('_', ' ')}** — ${pack.on_track.verdict_reason}`);
    }
  }
  lines.push('');

  // Section 3: Risk
  lines.push("### 3. What's at risk");
  if (pack.meta.blocked_sections.includes('cc_risk')) {
    lines.push('_Not available — import requisition data to enable._');
  } else if (pack.risk.items.length === 0) {
    lines.push('No high-risk requisitions identified.');
  } else {
    lines.push(`**${pack.risk.total_at_risk} reqs at risk**`);
    lines.push('');
    for (const item of pack.risk.items) {
      lines.push(`- **${item.req_title}** (${item.days_open}d) — ${item.failure_mode_label}: ${item.why}`);
      lines.push(`  - Next: ${item.next_move}`);
    }
  }
  lines.push('');

  // Section 4: Changes
  lines.push('### 4. What changed this week');
  if (pack.meta.blocked_sections.includes('cc_changes')) {
    lines.push('_Not available — requires a second data snapshot._');
  } else if (pack.changes.deltas.length === 0) {
    lines.push('No material changes this week.');
  } else {
    for (const delta of pack.changes.deltas) {
      const arrow = delta.direction === 'up' ? '▲' : delta.direction === 'down' ? '▼' : '—';
      lines.push(`- ${arrow} ${delta.label}`);
    }
  }
  lines.push('');

  // Section 5: What-If
  lines.push('### 5. What-if scenarios');
  if (pack.meta.blocked_sections.includes('cc_whatif')) {
    lines.push('_Not available — needs recruiter assignment data._');
  } else if (pack.whatif.scenario_previews.length === 0) {
    lines.push('No relevant scenarios identified.');
  } else {
    for (const s of pack.whatif.scenario_previews) {
      lines.push(`- **${s.title}** — ${s.impact_summary}`);
      lines.push(`  - Decision: ${s.decision_ask}`);
    }
  }
  lines.push('');

  // Section 6: Bottleneck
  lines.push('### 6. Binding constraint');
  if (pack.meta.blocked_sections.includes('cc_bottleneck')) {
    lines.push('_Not available — needs recruiter assignment data._');
  } else {
    lines.push(`**Diagnosis: ${pack.bottleneck.diagnosis.replace('_', '-')}**`);
    lines.push('');
    for (const e of pack.bottleneck.evidence) {
      lines.push(`- ${e}`);
    }
    lines.push('');
    lines.push(`**Recommendation:** ${pack.bottleneck.recommendation}`);
  }
  lines.push('');

  lines.push('---');
  lines.push(`_Generated by PlatoVue. Data as of ${dateStr}. Confidence: ${pack.meta.confidence}._`);

  return lines.join('\n');
}
