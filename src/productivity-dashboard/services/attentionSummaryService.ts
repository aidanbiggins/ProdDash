// Attention Summary Service
// Computes aggregated leader-level attention buckets from existing metrics.
// No candidate-level detail — rolls up into recruiter, HM, and req cluster signals.

import {
  AttentionV2Data,
  AttentionSummaryData,
  AttentionDrilldownData,
  AttentionBucket,
  AttentionBucketId,
  BucketSeverity,
  RecruiterDrilldownItem,
  HMDrilldownItem,
  ReqClusterDrilldownItem,
} from '../types/attentionTypes';
import { ConfidenceLevel } from '../types/capabilityTypes';
import { Requisition, Candidate, User, RequisitionStatus, CandidateDisposition } from '../types/entities';
import { OverviewMetrics, HiringManagerFriction, RecruiterSummary } from '../types/metrics';
import { CoverageMetrics } from '../types/resilientImportTypes';
import { HMPendingAction } from '../types/hmTypes';

// ============================================
// CONTEXT INPUT
// ============================================

export interface AttentionSummaryContext {
  requisitions: Requisition[];
  candidates: Candidate[];
  users: User[];
  overview: OverviewMetrics | null;
  hmFriction: HiringManagerFriction[];
  hmActions: HMPendingAction[];
  coverage: CoverageMetrics | null | undefined;
}

// ============================================
// MAIN COMPUTATION
// ============================================

export function computeAttentionV2(ctx: AttentionSummaryContext): AttentionV2Data {
  const summary = computeSummary(ctx);
  const drilldown = computeDrilldown(ctx);
  return { summary, drilldown };
}

// ============================================
// SUMMARY COMPUTATION
// ============================================

function computeSummary(ctx: AttentionSummaryContext): AttentionSummaryData {
  if (!ctx.coverage || (ctx.coverage.counts.requisitions === 0 && ctx.coverage.counts.candidates === 0)) {
    return {
      buckets: [],
      totalImpacted: 0,
      overallSeverity: 'watch',
      allBlocked: true,
      blockedReason: 'Import requisition and candidate data to see leader alerts.',
    };
  }

  const buckets: AttentionBucket[] = [];

  // Bucket 1: Recruiter Throughput Risk
  const recruiterBucket = computeRecruiterBucket(ctx);
  if (recruiterBucket) buckets.push(recruiterBucket);

  // Bucket 2: HM Friction Risk
  const hmBucket = computeHMBucket(ctx);
  if (hmBucket) buckets.push(hmBucket);

  // Bucket 3: Pipeline Health Risk
  const pipelineBucket = computePipelineBucket(ctx);
  if (pipelineBucket) buckets.push(pipelineBucket);

  // Bucket 4: Aging / Stalled Work
  const agingBucket = computeAgingBucket(ctx);
  if (agingBucket) buckets.push(agingBucket);

  // Bucket 5: Offer / Close Risk (only if offer data exists)
  const offerBucket = computeOfferBucket(ctx);
  if (offerBucket) buckets.push(offerBucket);

  // If no buckets could be computed, show blocked state
  if (buckets.length === 0) {
    return {
      buckets: [],
      totalImpacted: 0,
      overallSeverity: 'watch',
      allBlocked: true,
      blockedReason: 'Not enough data for leader alerts. Import more complete data to enable risk detection.',
    };
  }

  // Sort by severity (blocking first, then at-risk, then watch)
  const severityOrder: Record<BucketSeverity, number> = { 'blocking': 0, 'at-risk': 1, 'watch': 2 };
  buckets.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  const totalImpacted = buckets.reduce((sum, b) => sum + b.count, 0);
  const overallSeverity = buckets[0]?.severity || 'watch';

  return {
    buckets,
    totalImpacted,
    overallSeverity,
    allBlocked: false,
  };
}

// ============================================
// BUCKET BUILDERS
// ============================================

function computeRecruiterBucket(ctx: AttentionSummaryContext): AttentionBucket | null {
  if (!ctx.overview?.recruiterSummaries || ctx.overview.recruiterSummaries.length === 0) {
    return null;
  }

  const recruiters = ctx.overview.recruiterSummaries;
  const overloaded = recruiters.filter(r => r.activeReqLoad > 12);
  const stalled = recruiters.filter(r => r.aging.stalledReqs.count > 0);
  const problematic = new Set([...overloaded.map(r => r.recruiterId), ...stalled.map(r => r.recruiterId)]);

  if (problematic.size === 0) return null;

  const severity: BucketSeverity = overloaded.length >= 2 ? 'blocking' : 'at-risk';
  const confidence: ConfidenceLevel = recruiters.length >= 5 ? 'HIGH' : recruiters.length >= 3 ? 'MED' : 'LOW';

  // Top offender: recruiter with highest req load
  const topOffender = computeTopRecruiterOffender(recruiters);

  return {
    id: 'recruiter_throughput',
    label: 'Recruiter Throughput',
    severity,
    count: problematic.size,
    confidence,
    confidenceReason: `Based on ${recruiters.length} recruiter${recruiters.length > 1 ? 's' : ''} with workload data`,
    intervention: overloaded.length > 0
      ? `Rebalance ${overloaded.length} overloaded recruiters (>12 reqs).`
      : `Review ${stalled.length} with stalled reqs for coaching.`,
    navigationTarget: 'recruiter',
    navigationLabel: 'Rebalance team',
    accountability: { owner: 'TA Ops', due: severity === 'blocking' ? '24h' : '48h' },
    topOffender,
  };
}

function computeHMBucket(ctx: AttentionSummaryContext): AttentionBucket | null {
  if (ctx.hmFriction.length === 0 && ctx.hmActions.length === 0) return null;

  // HMs with high latency (>3 days feedback or >5 days decision)
  const slowHMs = ctx.hmFriction.filter(hm => {
    const fbDays = hm.feedbackLatencyMedian !== null ? hm.feedbackLatencyMedian / 24 : null;
    const decDays = hm.decisionLatencyMedian !== null ? hm.decisionLatencyMedian / 24 : null;
    return (fbDays !== null && fbDays > 3) || (decDays !== null && decDays > 5);
  });

  // HMs with overdue actions
  const hmIdsWithOverdue = new Set(
    ctx.hmActions.filter(a => a.daysOverdue > 0).map(a => a.hmUserId)
  );

  const problematicHMs = new Set([...slowHMs.map(h => h.hmId), ...hmIdsWithOverdue]);

  if (problematicHMs.size === 0) return null;

  const severity: BucketSeverity = hmIdsWithOverdue.size >= 2 ? 'blocking' : 'at-risk';
  const confidence: ConfidenceLevel = ctx.hmFriction.length >= 5 ? 'HIGH' : ctx.hmFriction.length >= 2 ? 'MED' : 'LOW';

  // Top offender: HM with most overdue actions
  const topOffender = computeTopHMOffender(ctx.hmFriction, ctx.hmActions);

  return {
    id: 'hm_friction',
    label: 'HM Friction',
    severity,
    count: problematicHMs.size,
    confidence,
    confidenceReason: `Based on ${ctx.hmFriction.length} HM${ctx.hmFriction.length > 1 ? 's' : ''} with latency data`,
    intervention: hmIdsWithOverdue.size > 0
      ? `Escalate ${hmIdsWithOverdue.size} HM${hmIdsWithOverdue.size > 1 ? 's' : ''} with overdue actions.`
      : `Nudge ${slowHMs.length} slow HM${slowHMs.length > 1 ? 's' : ''} (>3d feedback).`,
    navigationTarget: 'hm-friction',
    navigationLabel: 'Escalate HMs',
    accountability: { owner: 'HM', due: severity === 'blocking' ? '24h' : '48h' },
    topOffender,
  };
}

function computePipelineBucket(ctx: AttentionSummaryContext): AttentionBucket | null {
  const openReqs = ctx.requisitions.filter(r => r.status === RequisitionStatus.Open);
  if (openReqs.length === 0) return null;

  // Reqs with thin pipeline (< 3 active candidates)
  const reqCandidateCounts = new Map<string, number>();
  for (const c of ctx.candidates) {
    if (c.disposition === CandidateDisposition.Hired || c.disposition === CandidateDisposition.Rejected || c.disposition === CandidateDisposition.Withdrawn) continue;
    const count = reqCandidateCounts.get(c.req_id) || 0;
    reqCandidateCounts.set(c.req_id, count + 1);
  }

  const thinPipeline = openReqs.filter(r => (reqCandidateCounts.get(r.req_id) || 0) < 3);

  if (thinPipeline.length === 0) return null;

  const severity: BucketSeverity = thinPipeline.length >= Math.ceil(openReqs.length * 0.5) ? 'blocking' : 'at-risk';
  const confidence: ConfidenceLevel = ctx.coverage?.flags.hasStageEvents ? 'HIGH' : 'MED';

  // Top offender: req with 0 candidates (worst pipeline gap)
  const topOffender = computeTopPipelineOffender(thinPipeline, reqCandidateCounts);

  return {
    id: 'pipeline_health',
    label: 'Pipeline Health',
    severity,
    count: thinPipeline.length,
    confidence,
    confidenceReason: ctx.coverage?.flags.hasStageEvents
      ? `Based on ${openReqs.length} open reqs with stage data`
      : `Based on ${openReqs.length} open reqs (no stage events)`,
    intervention: `Increase sourcing on ${thinPipeline.length} req${thinPipeline.length > 1 ? 's' : ''} with <3 candidates.`,
    navigationTarget: 'overview',
    navigationLabel: 'Source candidates',
    accountability: { owner: 'Recruiter', due: severity === 'blocking' ? '24h' : '48h' },
    topOffender,
  };
}

function computeAgingBucket(ctx: AttentionSummaryContext): AttentionBucket | null {
  const openReqs = ctx.requisitions.filter(r => r.status === RequisitionStatus.Open);
  if (openReqs.length === 0) return null;

  const now = new Date();
  const stalledReqs = openReqs.filter(r => {
    if (!r.opened_at) return false;
    const daysOpen = (now.getTime() - r.opened_at.getTime()) / (1000 * 60 * 60 * 24);
    return daysOpen > 45;
  });

  const zombieReqs = openReqs.filter(r => {
    if (!r.opened_at) return false;
    const daysOpen = (now.getTime() - r.opened_at.getTime()) / (1000 * 60 * 60 * 24);
    return daysOpen > 90;
  });

  const problematic = stalledReqs.length;
  if (problematic === 0) return null;

  const severity: BucketSeverity = zombieReqs.length >= 3 ? 'blocking' : stalledReqs.length >= 3 ? 'at-risk' : 'watch';
  const confidence: ConfidenceLevel = ctx.coverage?.flags.hasTimestamps ? 'HIGH' : 'MED';

  // Top offender: oldest open req
  const topOffender = computeTopAgingOffender(stalledReqs);

  return {
    id: 'aging_stalled',
    label: 'Aging / Stalled',
    severity,
    count: problematic,
    confidence,
    confidenceReason: ctx.coverage?.flags.hasTimestamps
      ? `Based on opened dates for ${openReqs.length} reqs`
      : `Based on available date data (some dates missing)`,
    intervention: zombieReqs.length > 0
      ? `Close or revive ${zombieReqs.length} zombie req${zombieReqs.length > 1 ? 's' : ''} (>90d).`
      : `Reset scope on ${stalledReqs.length} aging req${stalledReqs.length > 1 ? 's' : ''} (>45d).`,
    navigationTarget: 'data-health',
    navigationLabel: 'Decide stalled',
    accountability: { owner: 'Recruiter', due: severity === 'blocking' ? '24h' : 'This week' },
    topOffender,
  };
}

function computeOfferBucket(ctx: AttentionSummaryContext): AttentionBucket | null {
  // Only show if we have offer data
  const candidatesWithOffers = ctx.candidates.filter(c => c.offer_extended_at);
  if (candidatesWithOffers.length === 0) return null;

  const now = new Date();
  const pendingOffers = candidatesWithOffers.filter(c =>
    !c.hired_at && c.disposition !== CandidateDisposition.Rejected && c.disposition !== CandidateDisposition.Withdrawn
  );

  // Stale offers: extended >7 days ago without resolution
  const staleOffers = pendingOffers.filter(c => {
    if (!c.offer_extended_at) return false;
    const daysSince = (now.getTime() - c.offer_extended_at.getTime()) / (1000 * 60 * 60 * 24);
    return daysSince > 7;
  });

  if (staleOffers.length === 0) return null;

  const severity: BucketSeverity = staleOffers.length >= 3 ? 'blocking' : 'at-risk';
  const confidence: ConfidenceLevel = 'HIGH'; // If we have offer dates, confidence is high

  // Top offender: longest-pending offer
  const topOffender = computeTopOfferOffender(staleOffers);

  return {
    id: 'offer_close_risk',
    label: 'Offer / Close Risk',
    severity,
    count: staleOffers.length,
    confidence,
    confidenceReason: `${staleOffers.length} offer${staleOffers.length > 1 ? 's' : ''} pending >7 days`,
    intervention: `Close ${staleOffers.length} pending offer${staleOffers.length > 1 ? 's' : ''} (>7d). Follow up or withdraw.`,
    navigationTarget: 'overview',
    navigationLabel: 'Close offers',
    accountability: { owner: 'Recruiter', due: severity === 'blocking' ? '24h' : '48h' },
    topOffender,
  };
}

// ============================================
// TOP OFFENDER HELPERS (anonymized, no PII)
// ============================================

function anonymizeIndex(list: any[], item: any): number {
  return list.indexOf(item) + 1;
}

function computeTopRecruiterOffender(recruiters: RecruiterSummary[]): string | undefined {
  if (recruiters.length === 0) return undefined;
  // Find recruiter with highest req load
  const sorted = [...recruiters].sort((a, b) => b.activeReqLoad - a.activeReqLoad);
  const worst = sorted[0];
  if (worst.activeReqLoad <= 12) return undefined; // Only surface if overloaded
  const idx = anonymizeIndex(sorted, worst);
  return `Recruiter ${idx} (${worst.activeReqLoad} reqs)`;
}

function computeTopHMOffender(hmFriction: HiringManagerFriction[], hmActions: HMPendingAction[]): string | undefined {
  // Count overdue actions per HM
  const overdueByHM = new Map<string, number>();
  for (const a of hmActions) {
    if (a.daysOverdue > 0) {
      overdueByHM.set(a.hmUserId, (overdueByHM.get(a.hmUserId) || 0) + 1);
    }
  }

  if (overdueByHM.size === 0) {
    // Fall back to slowest HM by feedback latency
    if (hmFriction.length === 0) return undefined;
    const sorted = [...hmFriction].sort((a, b) => {
      const aLat = a.feedbackLatencyMedian ?? 0;
      const bLat = b.feedbackLatencyMedian ?? 0;
      return bLat - aLat;
    });
    const worst = sorted[0];
    const latDays = worst.feedbackLatencyMedian !== null ? Math.round(worst.feedbackLatencyMedian / 24) : null;
    if (latDays === null || latDays <= 3) return undefined;
    return `HM ${anonymizeIndex(sorted, worst)} (${latDays}d feedback)`;
  }

  // Find HM with most overdue actions
  let worstId = '';
  let worstCount = 0;
  for (const [id, count] of overdueByHM) {
    if (count > worstCount) {
      worstId = id;
      worstCount = count;
    }
  }

  // Anonymize: use position in friction list
  const hmIdx = hmFriction.findIndex(h => h.hmId === worstId);
  const displayIdx = hmIdx >= 0 ? hmIdx + 1 : 1;
  return `HM ${displayIdx} (${worstCount} overdue)`;
}

function computeTopPipelineOffender(thinReqs: Requisition[], candCounts: Map<string, number>): string | undefined {
  if (thinReqs.length === 0) return undefined;
  // Find req with fewest candidates (worst pipeline gap)
  const sorted = [...thinReqs].sort((a, b) => (candCounts.get(a.req_id) || 0) - (candCounts.get(b.req_id) || 0));
  const worst = sorted[0];
  const candCount = candCounts.get(worst.req_id) || 0;
  // Use sanitized title (truncate, no names)
  const title = sanitizeReqTitle(worst.req_title);
  return `${title} (${candCount} candidates)`;
}

function computeTopAgingOffender(stalledReqs: Requisition[]): string | undefined {
  if (stalledReqs.length === 0) return undefined;
  const now = new Date();
  const sorted = [...stalledReqs]
    .filter(r => r.opened_at)
    .sort((a, b) => (a.opened_at!.getTime()) - (b.opened_at!.getTime())); // oldest first
  if (sorted.length === 0) return undefined;
  const worst = sorted[0];
  const daysOpen = Math.round((now.getTime() - worst.opened_at!.getTime()) / (1000 * 60 * 60 * 24));
  const title = sanitizeReqTitle(worst.req_title);
  return `${title} (${daysOpen}d open)`;
}

function computeTopOfferOffender(staleOffers: Candidate[]): string | undefined {
  if (staleOffers.length === 0) return undefined;
  const now = new Date();
  const sorted = [...staleOffers]
    .filter(c => c.offer_extended_at)
    .sort((a, b) => a.offer_extended_at!.getTime() - b.offer_extended_at!.getTime()); // oldest first
  if (sorted.length === 0) return undefined;
  const worst = sorted[0];
  const daysPending = Math.round((now.getTime() - worst.offer_extended_at!.getTime()) / (1000 * 60 * 60 * 24));
  return `Offer ${anonymizeIndex(sorted, worst)} (${daysPending}d pending)`;
}

function sanitizeReqTitle(title: string | undefined): string {
  if (!title) return 'Req';
  // Remove potential PII: names in "for Name" pattern
  let sanitized = title.replace(/\s+for\s+\w+('s)?\s+(team|group)?/gi, '');
  // Truncate to 25 chars
  if (sanitized.length > 25) sanitized = sanitized.slice(0, 22) + '...';
  return sanitized || 'Req';
}

// ============================================
// DRILLDOWN COMPUTATION
// ============================================

function computeDrilldown(ctx: AttentionSummaryContext): AttentionDrilldownData {
  return {
    recruiters: computeRecruiterDrilldown(ctx),
    hiringManagers: computeHMDrilldown(ctx),
    reqClusters: computeReqClusterDrilldown(ctx),
  };
}

function computeRecruiterDrilldown(ctx: AttentionSummaryContext): RecruiterDrilldownItem[] {
  if (!ctx.overview?.recruiterSummaries || ctx.overview.recruiterSummaries.length === 0) {
    return [];
  }

  const recruiters = ctx.overview.recruiterSummaries;

  // Score each recruiter by risk factors
  const scored = recruiters.map(r => {
    let score = 0;
    if (r.activeReqLoad > 12) score += 3;
    else if (r.activeReqLoad > 8) score += 1;
    if (r.aging.stalledReqs.count > 0) score += r.aging.stalledReqs.count;
    if (r.outcomes.timeToFillMedian !== null && r.outcomes.timeToFillMedian > 60) score += 2;
    return { recruiter: r, score };
  });

  // Only show recruiters with some risk signal
  const atRisk = scored.filter(s => s.score > 0);
  atRisk.sort((a, b) => b.score - a.score);

  return atRisk.slice(0, 5).map(({ recruiter: r }) => {
    const severity: BucketSeverity = r.activeReqLoad > 12 ? 'blocking' : r.aging.stalledReqs.count > 0 ? 'at-risk' : 'watch';

    // Key lag metric: prefer stalled reqs, then TTF
    let keyLagMetric = 'No lag signals';
    if (r.aging.stalledReqs.count > 0) {
      keyLagMetric = `${r.aging.stalledReqs.count} stalled req${r.aging.stalledReqs.count > 1 ? 's' : ''}`;
    } else if (r.outcomes.timeToFillMedian !== null && r.outcomes.timeToFillMedian > 45) {
      keyLagMetric = `TTF: ${Math.round(r.outcomes.timeToFillMedian)}d (above target)`;
    }

    // Utilization label
    let utilizationLabel: string | null = null;
    if (r.activeReqLoad > 0) {
      const utilPct = Math.round((r.activeReqLoad / 10) * 100); // assume 10 reqs = 100% capacity
      utilizationLabel = `${utilPct}% capacity (${r.activeReqLoad} reqs)`;
    }

    // Suggested intervention
    let suggestedIntervention = 'Review workload in 1:1';
    if (r.activeReqLoad > 12) {
      suggestedIntervention = 'Rebalance: offload lowest-priority reqs';
    } else if (r.aging.stalledReqs.count >= 2) {
      suggestedIntervention = 'Coach on stalled reqs: revive or request closure';
    }

    return {
      recruiterId: r.recruiterId,
      recruiterName: r.recruiterName,
      openReqCount: r.aging.openReqCount,
      utilizationLabel,
      keyLagMetric,
      suggestedIntervention,
      severity,
    };
  });
}

function computeHMDrilldown(ctx: AttentionSummaryContext): HMDrilldownItem[] {
  if (ctx.hmFriction.length === 0) return [];

  // Score HMs by friction signals
  const scored = ctx.hmFriction.map(hm => {
    let score = 0;
    const fbDays = hm.feedbackLatencyMedian !== null ? hm.feedbackLatencyMedian / 24 : null;
    const decDays = hm.decisionLatencyMedian !== null ? hm.decisionLatencyMedian / 24 : null;

    if (fbDays !== null && fbDays > 5) score += 3;
    else if (fbDays !== null && fbDays > 3) score += 2;
    if (decDays !== null && decDays > 7) score += 3;
    else if (decDays !== null && decDays > 5) score += 2;

    // Count overdue actions for this HM
    const overdueActions = ctx.hmActions.filter(a => a.hmUserId === hm.hmId && a.daysOverdue > 0);
    score += overdueActions.length * 2;

    return { hm, score, overdueActions };
  });

  const atRisk = scored.filter(s => s.score > 0);
  atRisk.sort((a, b) => b.score - a.score);

  return atRisk.slice(0, 5).map(({ hm, overdueActions }) => {
    const fbDays = hm.feedbackLatencyMedian !== null ? Math.round(hm.feedbackLatencyMedian / 24 * 10) / 10 : null;
    const decDays = hm.decisionLatencyMedian !== null ? Math.round(hm.decisionLatencyMedian / 24 * 10) / 10 : null;
    const openItems = overdueActions.length;

    const severity: BucketSeverity = openItems >= 3 ? 'blocking' : (fbDays !== null && fbDays > 5) ? 'at-risk' : 'watch';

    let suggestedIntervention = 'Discuss response times in skip-level';
    if (openItems >= 3) {
      suggestedIntervention = 'Escalate: multiple overdue decisions blocking pipeline';
    } else if (fbDays !== null && fbDays > 5) {
      suggestedIntervention = 'Set expectations: feedback SLA needed';
    }

    return {
      hmId: hm.hmId,
      hmName: hm.hmName,
      feedbackLatencyDays: fbDays,
      decisionLatencyDays: decDays,
      openItemCount: openItems,
      suggestedIntervention,
      severity,
    };
  });
}

function computeReqClusterDrilldown(ctx: AttentionSummaryContext): ReqClusterDrilldownItem[] {
  const openReqs = ctx.requisitions.filter(r => r.status === RequisitionStatus.Open);
  if (openReqs.length === 0) return [];

  const now = new Date();

  // Group reqs by best available clustering field
  // Priority: function > department > location > "All Reqs"
  const clusters = new Map<string, Requisition[]>();

  for (const req of openReqs) {
    const clusterKey = (typeof req.function === 'string' ? req.function : '') || req.business_unit || req.location_city || 'Uncategorized';
    const existing = clusters.get(clusterKey) || [];
    existing.push(req);
    clusters.set(clusterKey, existing);
  }

  // Compute metrics per cluster
  const clusterItems: ReqClusterDrilldownItem[] = [];

  for (const [label, reqs] of clusters) {
    if (reqs.length < 2) continue; // Skip singletons — not a meaningful cluster

    const daysOpenValues = reqs
      .filter(r => r.opened_at)
      .map(r => (now.getTime() - r.opened_at!.getTime()) / (1000 * 60 * 60 * 24));

    const avgDaysOpen = daysOpenValues.length > 0
      ? Math.round(daysOpenValues.reduce((a, b) => a + b, 0) / daysOpenValues.length)
      : 0;

    // Pipeline gap: count reqs with < 3 active candidates
    const reqCandCounts = new Map<string, number>();
    for (const c of ctx.candidates) {
      if (c.disposition === CandidateDisposition.Hired || c.disposition === CandidateDisposition.Rejected || c.disposition === CandidateDisposition.Withdrawn) continue;
      if (reqs.some(r => r.req_id === c.req_id)) {
        reqCandCounts.set(c.req_id, (reqCandCounts.get(c.req_id) || 0) + 1);
      }
    }
    const thinReqs = reqs.filter(r => (reqCandCounts.get(r.req_id) || 0) < 3);
    const pipelineGap = thinReqs.length > 0 ? thinReqs.length : null;

    // Risk labels
    const zombieCount = reqs.filter(r => {
      if (!r.opened_at) return false;
      return (now.getTime() - r.opened_at.getTime()) / (1000 * 60 * 60 * 24) > 90;
    }).length;
    const stalledCount = reqs.filter(r => {
      if (!r.opened_at) return false;
      const days = (now.getTime() - r.opened_at.getTime()) / (1000 * 60 * 60 * 24);
      return days > 45 && days <= 90;
    }).length;

    const riskParts: string[] = [];
    if (zombieCount > 0) riskParts.push(`${zombieCount} zombie`);
    if (stalledCount > 0) riskParts.push(`${stalledCount} stalled`);
    if (pipelineGap) riskParts.push(`${pipelineGap} thin pipeline`);
    const riskLabel = riskParts.length > 0 ? riskParts.join(', ') : 'Aging';

    // Severity
    const severity: BucketSeverity = zombieCount >= 2 ? 'blocking' : stalledCount >= 2 || (pipelineGap && pipelineGap >= 2) ? 'at-risk' : 'watch';

    // Only include clusters with actual risk
    if (zombieCount === 0 && stalledCount === 0 && (!pipelineGap || pipelineGap === 0) && avgDaysOpen < 45) {
      continue;
    }

    let suggestedIntervention = 'Review cluster health with team';
    if (zombieCount >= 2) {
      suggestedIntervention = 'Triage zombie reqs: close or restart with new strategy';
    } else if (pipelineGap && pipelineGap >= 2) {
      suggestedIntervention = 'Source blitz: multiple reqs in this cluster need candidates';
    } else if (stalledCount >= 2) {
      suggestedIntervention = 'Investigate stalls: hiring manager alignment or market issue?';
    }

    clusterItems.push({
      clusterLabel: label,
      reqCount: reqs.length,
      avgDaysOpen,
      pipelineGap,
      riskLabel,
      suggestedIntervention,
      severity,
    });
  }

  // Sort by severity then by count descending
  const severityOrder: Record<BucketSeverity, number> = { 'blocking': 0, 'at-risk': 1, 'watch': 2 };
  clusterItems.sort((a, b) => {
    if (severityOrder[a.severity] !== severityOrder[b.severity]) {
      return severityOrder[a.severity] - severityOrder[b.severity];
    }
    return b.reqCount - a.reqCount;
  });

  return clusterItems.slice(0, 5);
}
