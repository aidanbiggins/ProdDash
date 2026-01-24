// Ask Fact Pack Service
// Builds the deterministic Fact Pack for Ask PlatoVue from dashboard state

import {
  AskFactPack,
  KPIMetric,
  ExplainSummary,
  ExplainDriver,
  ActionSummary,
  RiskSummary,
  RiskType,
  FunnelStage,
  SourceSummary,
  GlossaryEntry,
  AnonymizationMaps,
  RecruiterPerformanceSummary,
  HiringManagerOwnershipSummary,
  HMOwnershipEntry,
  BottleneckFactPack,
} from '../types/askTypes';
import {
  BottleneckSummary,
  SnapshotCoverage,
  DEFAULT_SLA_POLICIES,
} from '../types/slaTypes';
import { DataSnapshot, SnapshotEvent } from '../types/snapshotTypes';
import {
  checkCoverageSufficiency,
  computeBottleneckSummary,
} from './slaAttributionService';
import {
  DashboardState,
  Requisition,
  Candidate,
  User,
  RequisitionStatus,
  CandidateDisposition,
  CanonicalStage,
} from '../types';
import { ActionItem, ActionPriority } from '../types/actionTypes';
import { Explanation, ExplainProviderId } from '../types/explainTypes';
import { PreMortemResult } from '../types/preMortemTypes';
import { differenceInDays } from 'date-fns';

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

const MAX_TOP_ACTIONS = 5;
const MAX_TOP_RISKS = 10;
const MAX_TOP_SOURCES = 5;
const MAX_DRIVERS = 3;

// ─────────────────────────────────────────────────────────────
// Glossary - Static definitions
// ─────────────────────────────────────────────────────────────

const GLOSSARY: GlossaryEntry[] = [
  {
    term: 'TTF',
    definition: 'Time to Fill - days from req open to candidate hired',
    formula: 'hired_at - opened_at',
    example: 'A TTF of 45 days means it takes 45 days on average to fill a role',
  },
  {
    term: 'TTO',
    definition: 'Time to Offer - days from application to offer extended',
    formula: 'offer_extended_at - applied_at',
    example: null,
  },
  {
    term: 'Stalled Req',
    definition: 'Requisition with no candidate activity for 14-30 days',
    formula: 'days_since_last_activity >= 14 AND < 30',
    example: null,
  },
  {
    term: 'Zombie Req',
    definition: 'Requisition with no candidate activity for 30+ days',
    formula: 'days_since_last_activity >= 30',
    example: null,
  },
  {
    term: 'HM Latency',
    definition: 'Average days for hiring manager to provide feedback',
    formula: 'avg(feedback_received_at - feedback_requested_at)',
    example: null,
  },
  {
    term: 'Accept Rate',
    definition: 'Percentage of offers that are accepted',
    formula: 'offers_accepted / offers_extended',
    example: 'An 85% accept rate means 85 of 100 offers were accepted',
  },
  {
    term: 'Pipeline Gap',
    definition: 'Difference between open reqs and expected hires',
    formula: 'open_reqs - probability_weighted_pipeline',
    example: 'A gap of 5 means you may fall 5 hires short of goal',
  },
];

// ─────────────────────────────────────────────────────────────
// Anonymization
// ─────────────────────────────────────────────────────────────

/**
 * Build maps for anonymizing recruiter and HM names
 */
export function buildAnonymizationMaps(
  users: User[],
  requisitions: Requisition[]
): AnonymizationMaps {
  const recruiters = new Map<string, string>();
  const hms = new Map<string, string>();
  const reverse = new Map<string, string>();

  // Sort for deterministic ordering
  const sortedUsers = [...users].sort((a, b) => a.user_id.localeCompare(b.user_id));

  let recruiterCounter = 1;
  let hmCounter = 1;

  sortedUsers.forEach((u) => {
    const anonRecruiter = `Recruiter ${recruiterCounter++}`;
    recruiters.set(u.user_id, anonRecruiter);
    reverse.set(anonRecruiter, u.user_id);
  });

  // Get unique HMs from requisitions
  const hmIds = new Set<string>();
  requisitions.forEach(r => {
    if (r.hiring_manager_id) {
      hmIds.add(r.hiring_manager_id);
    }
  });

  const sortedHmIds = [...hmIds].sort();
  sortedHmIds.forEach(hmId => {
    const anonHm = `Manager ${hmCounter++}`;
    hms.set(hmId, anonHm);
    reverse.set(anonHm, hmId);
  });

  return { recruiters, hms, reverse };
}

/**
 * Redact PII from req title
 */
export function redactReqTitle(title: string): string {
  if (!title) return '';

  return title
    // Remove possessive patterns: "John's", "Sarah's"
    .replace(/\b[A-Z][a-z]+['']s\b/g, '')
    // Remove "for [Name]" patterns
    .replace(/\bfor\s+[A-Z][a-z]+\b/gi, '')
    // Remove team names that look like "[Name]'s Team"
    .replace(/\b[A-Z][a-z]+['']s\s+[Tt]eam\b/g, 'Team')
    // Clean up multiple spaces
    .replace(/\s{2,}/g, ' ')
    // Remove leading/trailing spaces and dashes
    .replace(/^\s*[-–—]\s*|\s*[-–—]\s*$/g, '')
    .trim();
}

/**
 * Anonymize owner label based on owner type
 */
export function anonymizeOwnerLabel(
  ownerType: 'RECRUITER' | 'HIRING_MANAGER' | 'TA_OPS',
  ownerId: string,
  maps: AnonymizationMaps
): string {
  if (ownerType === 'RECRUITER') {
    return maps.recruiters.get(ownerId) || 'Recruiter';
  }
  if (ownerType === 'HIRING_MANAGER') {
    return maps.hms.get(ownerId) || 'Manager';
  }
  return 'TA Ops';
}

// ─────────────────────────────────────────────────────────────
// KPI Helpers
// ─────────────────────────────────────────────────────────────

function calculateKPIStatus(value: number | null, threshold: { green: number; yellow: number; red: number }, higherIsBetter: boolean): 'green' | 'yellow' | 'red' {
  if (value === null) return 'yellow';

  if (higherIsBetter) {
    if (value >= threshold.green) return 'green';
    if (value >= threshold.yellow) return 'yellow';
    return 'red';
  } else {
    if (value <= threshold.green) return 'green';
    if (value <= threshold.yellow) return 'yellow';
    return 'red';
  }
}

function calculateMedianTTF(candidates: Candidate[], requisitions: Requisition[]): { value: number | null; n: number } {
  const reqMap = new Map(requisitions.map(r => [r.req_id, r]));
  const ttfs: number[] = [];

  candidates.forEach(c => {
    if (c.disposition === CandidateDisposition.Hired && c.hired_at) {
      const req = reqMap.get(c.req_id);
      if (req?.opened_at) {
        const ttf = differenceInDays(c.hired_at, req.opened_at);
        if (ttf > 0 && ttf < 365) {
          ttfs.push(ttf);
        }
      }
    }
  });

  if (ttfs.length === 0) return { value: null, n: 0 };

  ttfs.sort((a, b) => a - b);
  const mid = Math.floor(ttfs.length / 2);
  const median = ttfs.length % 2 ? ttfs[mid] : (ttfs[mid - 1] + ttfs[mid]) / 2;

  return { value: Math.round(median), n: ttfs.length };
}

function countOffers(candidates: Candidate[]): number {
  return candidates.filter(c =>
    c.current_stage === CanonicalStage.OFFER ||
    c.disposition === CandidateDisposition.Hired
  ).length;
}

function calculateAcceptRate(candidates: Candidate[]): { value: number | null; n: number } {
  // Count candidates who received offers: Hired or those who were Rejected/Withdrawn after reaching offer stage
  const hired = candidates.filter(c => c.disposition === CandidateDisposition.Hired);
  // For simplicity, we'll use hired count as offers accepted
  // Accept rate = hired / (hired + rejected after offer) - but we don't track rejected at offer stage separately
  // So we'll approximate: if we have stage data, count those who reached offer

  const candidatesWhoReachedOffer = candidates.filter(c =>
    c.disposition === CandidateDisposition.Hired ||
    (c.current_stage === CanonicalStage.OFFER && c.disposition !== CandidateDisposition.Active)
  );

  if (candidatesWhoReachedOffer.length === 0) {
    // Fall back to just hired count
    return { value: hired.length > 0 ? 100 : null, n: hired.length };
  }

  const accepted = hired.length;
  return {
    value: Math.round((accepted / candidatesWhoReachedOffer.length) * 100),
    n: candidatesWhoReachedOffer.length,
  };
}

function countStalledReqs(requisitions: Requisition[], candidates: Candidate[]): number {
  const now = new Date();
  const candidatesByReq = new Map<string, Date>();

  // Find last activity per req
  candidates.forEach(c => {
    const lastActivity = c.current_stage_entered_at || c.applied_at;
    if (lastActivity) {
      const existing = candidatesByReq.get(c.req_id);
      if (!existing || lastActivity > existing) {
        candidatesByReq.set(c.req_id, lastActivity);
      }
    }
  });

  let stalledCount = 0;
  requisitions.forEach(r => {
    if (r.status === RequisitionStatus.Open) {
      const lastActivity = candidatesByReq.get(r.req_id);
      if (lastActivity) {
        const daysSince = differenceInDays(now, lastActivity);
        if (daysSince >= 14 && daysSince < 30) {
          stalledCount++;
        }
      }
    }
  });

  return stalledCount;
}

function countZombieReqs(requisitions: Requisition[], candidates: Candidate[]): number {
  const now = new Date();
  const candidatesByReq = new Map<string, Date>();

  candidates.forEach(c => {
    const lastActivity = c.current_stage_entered_at || c.applied_at;
    if (lastActivity) {
      const existing = candidatesByReq.get(c.req_id);
      if (!existing || lastActivity > existing) {
        candidatesByReq.set(c.req_id, lastActivity);
      }
    }
  });

  let zombieCount = 0;
  requisitions.forEach(r => {
    if (r.status === RequisitionStatus.Open) {
      const lastActivity = candidatesByReq.get(r.req_id);
      if (lastActivity) {
        const daysSince = differenceInDays(now, lastActivity);
        if (daysSince >= 30) {
          zombieCount++;
        }
      }
    }
  });

  return zombieCount;
}

// ─────────────────────────────────────────────────────────────
// Main Builder
// ─────────────────────────────────────────────────────────────

export interface FactPackBuilderContext {
  state: DashboardState;
  actions: ActionItem[];
  explanations: Map<ExplainProviderId, Explanation>;
  preMortemResults: PreMortemResult[];
  aiEnabled: boolean;
  orgId?: string;
  orgName?: string;
  // Optional snapshot data for SLA/bottleneck analysis
  snapshots?: DataSnapshot[];
  snapshotEvents?: SnapshotEvent[];
}

/**
 * Build the complete Fact Pack from dashboard state and computed data
 */
export function buildFactPack(context: FactPackBuilderContext): AskFactPack {
  const {
    state,
    actions,
    explanations,
    preMortemResults,
    aiEnabled,
    orgId = 'unknown',
    orgName = 'Organization',
    snapshots = [],
    snapshotEvents = [],
  } = context;

  const { requisitions, candidates, events, users } = state.dataStore;
  const now = new Date();

  // Build anonymization maps
  const anonMaps = buildAnonymizationMaps(users, requisitions);

  // Calculate date range
  const dates = candidates
    .map(c => c.applied_at)
    .filter((d): d is Date => d !== null)
    .sort((a, b) => a.getTime() - b.getTime());

  const startDate = dates.length > 0 ? dates[0] : now;
  const endDate = dates.length > 0 ? dates[dates.length - 1] : now;
  const days = differenceInDays(endDate, startDate);

  // Calculate sample sizes
  const hireCount = candidates.filter(c => c.disposition === CandidateDisposition.Hired).length;
  const offerCount = countOffers(candidates);

  // Calculate KPIs
  const ttfResult = calculateMedianTTF(candidates, requisitions);
  const acceptResult = calculateAcceptRate(candidates);
  const stalledCount = countStalledReqs(requisitions, candidates);
  const zombieCount = countZombieReqs(requisitions, candidates);

  // Get HM latency from explanations
  const hmLatencyExplain = explanations.get('hm_latency');
  const hmLatencyValue = typeof hmLatencyExplain?.value === 'number' ? hmLatencyExplain.value : null;

  // Build Control Tower KPIs
  const kpis: AskFactPack['control_tower']['kpis'] = {
    median_ttf: {
      value: ttfResult.value,
      unit: 'days',
      threshold: { green: 45, yellow: 60, red: 90 },
      status: calculateKPIStatus(ttfResult.value, { green: 45, yellow: 60, red: 90 }, false),
      n: ttfResult.n,
      trend: null,
    },
    offer_count: {
      value: offerCount,
      unit: 'count',
      threshold: { green: 10, yellow: 5, red: 0 },
      status: calculateKPIStatus(offerCount, { green: 10, yellow: 5, red: 0 }, true),
      n: offerCount,
      trend: null,
    },
    accept_rate: {
      value: acceptResult.value,
      unit: '%',
      threshold: { green: 80, yellow: 60, red: 40 },
      status: calculateKPIStatus(acceptResult.value, { green: 80, yellow: 60, red: 40 }, true),
      n: acceptResult.n,
      trend: null,
    },
    stalled_reqs: {
      value: stalledCount,
      unit: 'count',
      threshold: { green: 0, yellow: 5, red: 10 },
      status: calculateKPIStatus(stalledCount, { green: 0, yellow: 5, red: 10 }, false),
      n: requisitions.filter(r => r.status === RequisitionStatus.Open).length,
      trend: null,
    },
    hm_latency: {
      value: hmLatencyValue,
      unit: 'days',
      threshold: { green: 2, yellow: 3, red: 5 },
      status: calculateKPIStatus(hmLatencyValue, { green: 2, yellow: 3, red: 5 }, false),
      n: hmLatencyExplain?.includedCount ?? 0,
      trend: null,
    },
  };

  // Build risk summary
  const riskByType: Partial<Record<RiskType, number>> = {
    zombie: zombieCount,
    stalled: stalledCount,
  };

  // Count risks from preMortemResults
  let pipelineGapCount = 0;
  let hmDelayCount = 0;
  let offerRiskCount = 0;
  let atRiskCount = 0;

  preMortemResults.forEach(pm => {
    if (pm.risk_band === 'HIGH' || pm.risk_band === 'MED') {
      switch (pm.failure_mode) {
        case 'EMPTY_PIPELINE':
        case 'STALLED_PIPELINE':
          pipelineGapCount++;
          break;
        case 'HM_DELAY':
          hmDelayCount++;
          break;
        case 'OFFER_RISK':
          offerRiskCount++;
          break;
        default:
          atRiskCount++;
      }
    }
  });

  riskByType.pipeline_gap = pipelineGapCount;
  riskByType.hm_delay = hmDelayCount;
  riskByType.offer_risk = offerRiskCount;
  riskByType.at_risk = atRiskCount;

  const totalAtRisk = Object.values(riskByType).reduce((sum, v) => sum + (v || 0), 0);

  // Build action summary
  const openActions = actions.filter(a => a.status === 'OPEN');
  const p0Actions = openActions.filter(a => a.priority === 'P0');
  const p1Actions = openActions.filter(a => a.priority === 'P1');
  const p2Actions = openActions.filter(a => a.priority === 'P2');

  // Build top actions (anonymized)
  const topP0: ActionSummary[] = p0Actions.slice(0, MAX_TOP_ACTIONS).map(a => ({
    action_id: a.action_id,
    title: a.title,
    owner_type: a.owner_type,
    owner_label: anonymizeOwnerLabel(a.owner_type, a.owner_id, anonMaps),
    priority: a.priority,
    action_type: a.action_type,
    due_in_days: a.due_in_days,
    req_id: a.req_id === 'general' ? null : a.req_id,
    req_title: a.req_title ? redactReqTitle(a.req_title) : null,
  }));

  const topP1: ActionSummary[] = p1Actions.slice(0, MAX_TOP_ACTIONS).map(a => ({
    action_id: a.action_id,
    title: a.title,
    owner_type: a.owner_type,
    owner_label: anonymizeOwnerLabel(a.owner_type, a.owner_id, anonMaps),
    priority: a.priority,
    action_type: a.action_type,
    due_in_days: a.due_in_days,
    req_id: a.req_id === 'general' ? null : a.req_id,
    req_title: a.req_title ? redactReqTitle(a.req_title) : null,
  }));

  // Build top risks from preMortemResults
  const highRisks = preMortemResults
    .filter(pm => pm.risk_band === 'HIGH')
    .sort((a, b) => b.risk_score - a.risk_score)
    .slice(0, MAX_TOP_RISKS);

  const topRisks: RiskSummary[] = highRisks.map((pm, i) => {
    // Find recruiter for this req
    const req = requisitions.find(r => r.req_id === pm.req_id);
    const recruiterId = req?.recruiter_id || '';

    return {
      risk_id: `risk_${pm.req_id}`,
      req_id: pm.req_id,
      req_title: redactReqTitle(pm.req_title),
      risk_type: mapFailureModeToRiskType(pm.failure_mode),
      failure_mode: pm.failure_mode,
      days_open: pm.days_open,
      candidate_count: pm.active_candidate_count,
      owner_label: anonMaps.recruiters.get(recruiterId) || 'Recruiter',
      top_driver: pm.top_drivers[0]?.description || 'Unknown',
    };
  });

  // Build risks by failure mode
  const risksByFailureMode: Partial<Record<RiskType, RiskSummary[]>> = {};
  topRisks.forEach(r => {
    if (!risksByFailureMode[r.risk_type]) {
      risksByFailureMode[r.risk_type] = [];
    }
    risksByFailureMode[r.risk_type]!.push(r);
  });

  // Build explain summaries
  const explainSummaries = buildExplainSummaries(explanations);

  // Build velocity data
  const velocity = buildVelocityData(candidates, events);

  // Build source data
  const sources = buildSourceData(candidates);

  // Build capacity data
  const capacity = buildCapacityData(users, requisitions);

  // Build recruiter performance data
  const recruiterPerformance = buildRecruiterPerformanceData(users, requisitions, candidates, anonMaps);

  // Build hiring manager ownership data
  // Convert HM friction data to the expected format if available
  // feedbackLatencyMedian is in hours, convert to days
  const hmFrictionData = state.hmFriction?.map(hm => ({
    hm_id: hm.hmId,
    avg_latency_days: hm.feedbackLatencyMedian !== null ? hm.feedbackLatencyMedian / 24 : null,
  }));
  const hiringManagerOwnership = buildHiringManagerOwnershipData(requisitions, anonMaps, hmFrictionData);

  // Build forecast data
  const forecast = buildForecastData(requisitions, candidates, preMortemResults);

  // Detect capability flags
  const capabilityFlags = {
    has_stage_timing: events.some(e => e.from_stage || e.to_stage),
    has_source_data: candidates.some(c => c.source),
    has_hm_data: hmLatencyExplain !== undefined,
    has_forecast_data: true,
    has_quality_data: false, // Quality scoring not yet implemented in Candidate model
    ai_enabled: aiEnabled,
  };

  // Build bottleneck data (SLA analysis)
  const bottlenecks = buildBottleneckData(
    snapshots,
    snapshotEvents,
    requisitions,
    users,
    { start: startDate, end: endDate }
  );

  return {
    meta: {
      generated_at: now.toISOString(),
      org_id: orgId,
      org_name: orgName,
      data_window: {
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0],
        days,
      },
      sample_sizes: {
        total_reqs: requisitions.length,
        total_candidates: candidates.length,
        total_hires: hireCount,
        total_offers: offerCount,
        total_events: events.length,
      },
      filter_context: {
        recruiter_ids: state.filters?.recruiterIds || [],
        date_range_start: state.filters?.dateRange?.startDate?.toISOString().split('T')[0] || null,
        date_range_end: state.filters?.dateRange?.endDate?.toISOString().split('T')[0] || null,
        date_range_preset: null,
        functions: state.filters?.functions || [],
        regions: state.filters?.regions || [],
      },
      capability_flags: capabilityFlags,
      data_health_score: state.dataStore.dataHealth.overallHealthScore,
    },
    control_tower: {
      kpis,
      risk_summary: {
        total_at_risk: totalAtRisk,
        by_type: riskByType,
      },
      action_summary: {
        total_open: openActions.length,
        p0_count: p0Actions.length,
        p1_count: p1Actions.length,
        p2_count: p2Actions.length,
      },
    },
    explain: explainSummaries,
    actions: {
      top_p0: topP0,
      top_p1: topP1,
      by_owner_type: {
        recruiter: openActions.filter(a => a.owner_type === 'RECRUITER').length,
        hiring_manager: openActions.filter(a => a.owner_type === 'HIRING_MANAGER').length,
        ta_ops: openActions.filter(a => a.owner_type === 'TA_OPS').length,
      },
    },
    risks: {
      top_risks: topRisks,
      by_failure_mode: risksByFailureMode,
    },
    forecast,
    velocity,
    sources,
    capacity,
    recruiter_performance: recruiterPerformance,
    hiring_manager_ownership: hiringManagerOwnership,
    bottlenecks,
    glossary: GLOSSARY,
  };
}

// ─────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────

function mapFailureModeToRiskType(failureMode: string): RiskType {
  switch (failureMode) {
    case 'EMPTY_PIPELINE':
    case 'STALLED_PIPELINE':
      return 'pipeline_gap';
    case 'HM_DELAY':
      return 'hm_delay';
    case 'OFFER_RISK':
      return 'offer_risk';
    case 'AGING_DECAY':
      return 'zombie';
    default:
      return 'at_risk';
  }
}

function buildExplainSummaries(
  explanations: Map<ExplainProviderId, Explanation>
): AskFactPack['explain'] {
  const defaultSummary: ExplainSummary = {
    metric_name: 'Unknown',
    value: null,
    unit: '',
    top_drivers: [],
    exclusions: [],
    confidence: 'low',
    n: 0,
  };

  const convertExplanation = (exp: Explanation | undefined, metricName: string): ExplainSummary => {
    if (!exp) return { ...defaultSummary, metric_name: metricName };

    const drivers: ExplainDriver[] = (exp.breakdown || []).slice(0, MAX_DRIVERS).map((b, i) => ({
      factor: b.label,
      impact: `${b.value} ${b.unit}`,
      evidence_key: `explain.${exp.metricId}.breakdown[${i}]`,
    }));

    return {
      metric_name: exp.metricLabel,
      value: typeof exp.value === 'number' ? exp.value : null,
      unit: exp.unit,
      top_drivers: drivers,
      exclusions: exp.exclusionReasons.map(r => `${r.reason}: ${r.count}`),
      confidence: exp.confidenceGrade || 'medium',
      n: exp.includedCount,
    };
  };

  return {
    time_to_offer: convertExplanation(explanations.get('time_to_offer'), 'Time to Offer'),
    hm_latency: convertExplanation(explanations.get('hm_latency'), 'HM Latency'),
    accept_rate: convertExplanation(explanations.get('offer_accept_rate'), 'Accept Rate'),
    pipeline_health: convertExplanation(explanations.get('stalled_reqs'), 'Pipeline Health'),
    source_effectiveness: convertExplanation(explanations.get('median_ttf'), 'Source Effectiveness'),
  };
}

function buildVelocityData(
  candidates: Candidate[],
  events: any[]
): AskFactPack['velocity'] {
  // Build funnel stages
  const stageCounts = new Map<string, number>();
  const stageOrder = [
    CanonicalStage.APPLIED,
    CanonicalStage.SCREEN,
    CanonicalStage.HM_SCREEN,
    CanonicalStage.ONSITE,
    CanonicalStage.OFFER,
    CanonicalStage.HIRED,
  ];

  // Count candidates at each stage
  candidates.forEach(c => {
    if (c.current_stage) {
      stageCounts.set(c.current_stage, (stageCounts.get(c.current_stage) || 0) + 1);
    }
  });

  const funnel: FunnelStage[] = stageOrder.map((stage, i) => {
    const count = stageCounts.get(stage) || 0;
    const nextStage = stageOrder[i + 1];
    const nextCount = nextStage ? stageCounts.get(nextStage) || 0 : 0;

    return {
      stage,
      candidate_count: count,
      conversion_rate: count > 0 ? nextCount / count : null,
      avg_days: null, // Would need event data to calculate
      is_bottleneck: false,
    };
  });

  // Find bottleneck (lowest conversion rate)
  let bottleneckStage: string | null = null;
  let lowestConversion = 1;

  funnel.forEach(f => {
    if (f.conversion_rate !== null && f.conversion_rate < lowestConversion && f.conversion_rate > 0) {
      lowestConversion = f.conversion_rate;
      bottleneckStage = f.stage;
    }
  });

  // Mark bottleneck
  funnel.forEach(f => {
    if (f.stage === bottleneckStage) {
      f.is_bottleneck = true;
    }
  });

  // Calculate avg days to offer/hire
  const hiredCandidates = candidates.filter(c => c.disposition === CandidateDisposition.Hired && c.hired_at && c.applied_at);
  const daysToHire = hiredCandidates.map(c => differenceInDays(c.hired_at!, c.applied_at!)).filter(d => d > 0 && d < 365);

  const avgDaysToHire = daysToHire.length > 0
    ? Math.round(daysToHire.reduce((a, b) => a + b, 0) / daysToHire.length)
    : null;

  return {
    funnel,
    bottleneck_stage: bottleneckStage,
    avg_days_to_offer: avgDaysToHire, // Approximation
    avg_days_to_hire: avgDaysToHire,
  };
}

function buildSourceData(candidates: Candidate[]): AskFactPack['sources'] {
  const sourceStats = new Map<string, { candidates: number; hires: number }>();

  candidates.forEach(c => {
    const source = c.source || 'Unknown';
    const stats = sourceStats.get(source) || { candidates: 0, hires: 0 };
    stats.candidates++;
    if (c.disposition === CandidateDisposition.Hired) {
      stats.hires++;
    }
    sourceStats.set(source, stats);
  });

  const sourceArray: SourceSummary[] = Array.from(sourceStats.entries()).map(([name, stats]) => ({
    source_name: name,
    candidate_count: stats.candidates,
    hire_count: stats.hires,
    conversion_rate: stats.candidates > 0 ? stats.hires / stats.candidates : null,
    quality_score: null,
  }));

  // Sort by volume
  const byVolume = [...sourceArray]
    .sort((a, b) => b.candidate_count - a.candidate_count)
    .slice(0, MAX_TOP_SOURCES);

  // Sort by conversion
  const byConversion = [...sourceArray]
    .filter(s => s.conversion_rate !== null && s.candidate_count >= 5)
    .sort((a, b) => (b.conversion_rate || 0) - (a.conversion_rate || 0))
    .slice(0, MAX_TOP_SOURCES);

  return {
    top_by_volume: byVolume,
    top_by_conversion: byConversion,
    total_sources: sourceStats.size,
  };
}

function buildCapacityData(users: User[], requisitions: Requisition[]): AskFactPack['capacity'] {
  const recruiterReqs = new Map<string, number>();

  requisitions.forEach(r => {
    if (r.status === RequisitionStatus.Open && r.recruiter_id) {
      recruiterReqs.set(
        r.recruiter_id,
        (recruiterReqs.get(r.recruiter_id) || 0) + 1
      );
    }
  });

  const loads = Array.from(recruiterReqs.values());
  const avgLoad = loads.length > 0 ? loads.reduce((a, b) => a + b, 0) / loads.length : 0;

  return {
    total_recruiters: users.length,
    avg_req_load: Math.round(avgLoad * 10) / 10,
    overloaded_count: loads.filter(l => l > 15).length,
    underloaded_count: loads.filter(l => l < 5).length,
  };
}

/**
 * Generate a stable anonymized ID for deep links
 * Uses a simple hash to ensure the same user always gets the same ID
 */
function generateAnonymizedId(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    const char = userId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return `anon_${Math.abs(hash).toString(36)}`;
}

function buildRecruiterPerformanceData(
  users: User[],
  requisitions: Requisition[],
  candidates: Candidate[],
  anonMaps: AnonymizationMaps
): AskFactPack['recruiter_performance'] {
  // Check if we have recruiter data at all
  const hasRecruiterIds = requisitions.some(r => r.recruiter_id);

  if (users.length === 0 && !hasRecruiterIds) {
    return {
      available: false,
      unavailable_reason: 'No recruiter data in dataset. Ensure requisitions have recruiter_id field populated.',
      top_by_hires: [],
      top_by_productivity: [],
      bottom_by_productivity: [],
      team_avg_productivity: null,
      total_recruiters: 0,
      n: 0,
      confidence: 'low',
    };
  }

  // Build performance stats for each recruiter
  const recruiterStats = new Map<string, {
    userId: string;
    openReqs: number;
    hires: number;
    offers: number;
    ttfs: number[];
    activeCandidates: number;
  }>();

  // Collect all recruiter IDs from users and requisitions
  const allRecruiterIds = new Set<string>();
  users.forEach(u => allRecruiterIds.add(u.user_id));
  requisitions.forEach(r => {
    if (r.recruiter_id) allRecruiterIds.add(r.recruiter_id);
  });

  // Initialize stats for all recruiters
  allRecruiterIds.forEach(recruiterId => {
    recruiterStats.set(recruiterId, {
      userId: recruiterId,
      openReqs: 0,
      hires: 0,
      offers: 0,
      ttfs: [],
      activeCandidates: 0,
    });
  });

  // Count open reqs per recruiter
  requisitions.forEach(r => {
    if (r.recruiter_id && recruiterStats.has(r.recruiter_id)) {
      const stats = recruiterStats.get(r.recruiter_id)!;
      if (r.status === RequisitionStatus.Open) {
        stats.openReqs++;
      }
    }
  });

  // Build map of req -> recruiter for candidate attribution
  const reqRecruiterMap = new Map<string, string>();
  requisitions.forEach(r => {
    if (r.recruiter_id) {
      reqRecruiterMap.set(r.req_id, r.recruiter_id);
    }
  });

  // Build map of req -> opened_at for TTF calculation
  const reqOpenedMap = new Map<string, Date>();
  requisitions.forEach(r => {
    if (r.opened_at) {
      reqOpenedMap.set(r.req_id, r.opened_at);
    }
  });

  // Count hires, offers, and active candidates per recruiter
  candidates.forEach(c => {
    const recruiterId = reqRecruiterMap.get(c.req_id);
    if (!recruiterId || !recruiterStats.has(recruiterId)) return;

    const stats = recruiterStats.get(recruiterId)!;

    if (c.disposition === CandidateDisposition.Hired) {
      stats.hires++;
      // Calculate TTF if we have hire date and req opened date
      const reqOpened = reqOpenedMap.get(c.req_id);
      if (c.hired_at && reqOpened) {
        const ttf = differenceInDays(c.hired_at, reqOpened);
        if (ttf > 0 && ttf < 365) {
          stats.ttfs.push(ttf);
        }
      }
    }

    if (c.current_stage === CanonicalStage.OFFER || c.disposition === CandidateDisposition.Hired) {
      stats.offers++;
    }

    if (!c.disposition || c.disposition === CandidateDisposition.Active) {
      stats.activeCandidates++;
    }
  });

  // Convert to performance summaries with anonymized labels
  const performanceList: RecruiterPerformanceSummary[] = [];
  let recruiterIndex = 1;

  // Sort by userId for deterministic ordering
  const sortedRecruiterIds = Array.from(recruiterStats.keys()).sort();

  sortedRecruiterIds.forEach(userId => {
    const stats = recruiterStats.get(userId)!;
    const avgTtf = stats.ttfs.length > 0
      ? Math.round(stats.ttfs.reduce((a, b) => a + b, 0) / stats.ttfs.length)
      : null;

    // Productivity score: weighted combo of hires (60%) + offers (40%), normalized
    // Higher scores = more productive
    const rawScore = (stats.hires * 10) + (stats.offers * 5);
    const productivityScore = rawScore > 0 ? Math.min(100, rawScore) : null;

    performanceList.push({
      anonymized_id: generateAnonymizedId(userId),
      anonymized_label: anonMaps.recruiters.get(userId) || `Recruiter ${recruiterIndex}`,
      open_reqs: stats.openReqs,
      hires_in_period: stats.hires,
      offers_in_period: stats.offers,
      avg_ttf: avgTtf,
      active_candidates: stats.activeCandidates,
      productivity_score: productivityScore,
    });
    recruiterIndex++;
  });

  // Sort by different criteria for top lists
  const byHires = [...performanceList]
    .filter(r => r.hires_in_period > 0)
    .sort((a, b) => b.hires_in_period - a.hires_in_period)
    .slice(0, 5);

  const byProductivity = [...performanceList]
    .filter(r => r.productivity_score !== null)
    .sort((a, b) => (b.productivity_score ?? 0) - (a.productivity_score ?? 0))
    .slice(0, 5);

  const bottomByProductivity = [...performanceList]
    .filter(r => r.productivity_score !== null && r.productivity_score < 50)
    .sort((a, b) => (a.productivity_score ?? 0) - (b.productivity_score ?? 0))
    .slice(0, 3);

  // Calculate team average
  const scoresWithValues = performanceList
    .map(r => r.productivity_score)
    .filter((s): s is number => s !== null);
  const teamAvg = scoresWithValues.length > 0
    ? Math.round(scoresWithValues.reduce((a, b) => a + b, 0) / scoresWithValues.length)
    : null;

  // Determine confidence based on sample size
  const recruitersWithActivity = performanceList.filter(r =>
    r.hires_in_period > 0 || r.offers_in_period > 0 || r.open_reqs > 0
  ).length;

  let confidence: 'high' | 'medium' | 'low' = 'low';
  if (recruitersWithActivity >= 5) confidence = 'high';
  else if (recruitersWithActivity >= 2) confidence = 'medium';

  // If no recruiters have any activity, mark as unavailable
  if (recruitersWithActivity === 0) {
    return {
      available: false,
      unavailable_reason: 'No recruiter activity found in the current data window.',
      top_by_hires: [],
      top_by_productivity: [],
      bottom_by_productivity: [],
      team_avg_productivity: null,
      total_recruiters: allRecruiterIds.size,
      n: 0,
      confidence: 'low',
    };
  }

  return {
    available: true,
    top_by_hires: byHires,
    top_by_productivity: byProductivity,
    bottom_by_productivity: bottomByProductivity,
    team_avg_productivity: teamAvg,
    total_recruiters: allRecruiterIds.size,
    n: recruitersWithActivity,
    confidence,
  };
}

/**
 * Build hiring manager ownership data
 * Shows which HMs have the most open reqs
 */
function buildHiringManagerOwnershipData(
  requisitions: Requisition[],
  anonMaps: AnonymizationMaps,
  hmFriction?: Array<{ hm_id: string; avg_latency_days: number | null }>
): HiringManagerOwnershipSummary {
  // Check if we have HM data in requisitions
  const hasHmIds = requisitions.some(r => r.hiring_manager_id);

  if (!hasHmIds) {
    return {
      available: false,
      unavailable_reason: 'No hiring manager data in dataset. Ensure requisitions have hiring_manager_id field populated.',
      total_hiring_managers: 0,
      open_reqs_by_hm: [],
      n: 0,
      confidence: 'low',
    };
  }

  // Group open reqs by hiring manager
  const hmReqMap = new Map<string, string[]>();
  requisitions.forEach(r => {
    if (r.hiring_manager_id && r.status === RequisitionStatus.Open) {
      const existing = hmReqMap.get(r.hiring_manager_id) || [];
      existing.push(r.req_id);
      hmReqMap.set(r.hiring_manager_id, existing);
    }
  });

  // Get all unique HM IDs (including those without open reqs for total count)
  const allHmIds = new Set<string>();
  requisitions.forEach(r => {
    if (r.hiring_manager_id) {
      allHmIds.add(r.hiring_manager_id);
    }
  });

  if (hmReqMap.size === 0) {
    return {
      available: false,
      unavailable_reason: 'No open requisitions with hiring manager assignments found.',
      total_hiring_managers: allHmIds.size,
      open_reqs_by_hm: [],
      n: 0,
      confidence: 'low',
    };
  }

  // Build HM latency lookup if available
  const hmLatencyMap = new Map<string, number>();
  if (hmFriction) {
    hmFriction.forEach(hm => {
      if (hm.avg_latency_days !== null) {
        hmLatencyMap.set(hm.hm_id, hm.avg_latency_days);
      }
    });
  }

  // Convert to ownership entries sorted by open req count (descending)
  const entries: HMOwnershipEntry[] = Array.from(hmReqMap.entries())
    .map(([hmId, reqIds]) => ({
      anonymized_id: generateAnonymizedId(hmId),
      hm_label: anonMaps.hms.get(hmId) || 'Manager',
      open_req_count: reqIds.length,
      req_ids: reqIds.slice(0, 10), // Limit to 10 req IDs
      avg_hm_latency: hmLatencyMap.get(hmId) ?? null,
    }))
    .sort((a, b) => b.open_req_count - a.open_req_count)
    .slice(0, 10); // Top 10 HMs

  // Determine confidence
  const hmsWithOpenReqs = hmReqMap.size;
  let confidence: 'high' | 'medium' | 'low' = 'low';
  if (hmsWithOpenReqs >= 5) confidence = 'high';
  else if (hmsWithOpenReqs >= 2) confidence = 'medium';

  return {
    available: true,
    total_hiring_managers: allHmIds.size,
    open_reqs_by_hm: entries,
    n: hmsWithOpenReqs,
    confidence,
  };
}

function buildForecastData(
  requisitions: Requisition[],
  candidates: Candidate[],
  preMortemResults: PreMortemResult[]
): AskFactPack['forecast'] {
  const openReqs = requisitions.filter(r => r.status === RequisitionStatus.Open);
  const activeCandidates = candidates.filter(c =>
    !c.disposition ||
    c.disposition === CandidateDisposition.Active
  );

  // Simple probability-weighted pipeline
  const stageProbabilities: Record<string, number> = {
    [CanonicalStage.APPLIED]: 0.05,
    [CanonicalStage.SCREEN]: 0.1,
    [CanonicalStage.HM_SCREEN]: 0.2,
    [CanonicalStage.ONSITE]: 0.4,
    [CanonicalStage.OFFER]: 0.8,
  };

  let probabilityWeighted = 0;
  activeCandidates.forEach(c => {
    if (c.current_stage && stageProbabilities[c.current_stage]) {
      probabilityWeighted += stageProbabilities[c.current_stage];
    }
  });

  const expectedHires = Math.round(probabilityWeighted);
  const pipelineGap = openReqs.length - expectedHires;

  // Confidence based on risk distribution
  const highRiskCount = preMortemResults.filter(r => r.risk_band === 'HIGH').length;
  const totalAssessed = preMortemResults.length;
  const highRiskRatio = totalAssessed > 0 ? highRiskCount / totalAssessed : 0;

  let confidence: 'high' | 'medium' | 'low' = 'medium';
  if (highRiskRatio < 0.2) confidence = 'high';
  else if (highRiskRatio > 0.4) confidence = 'low';

  return {
    expected_hires: expectedHires,
    pipeline_gap: Math.max(0, pipelineGap),
    confidence,
    open_reqs: openReqs.length,
    active_candidates: activeCandidates.length,
    probability_weighted_pipeline: Math.round(probabilityWeighted * 10) / 10,
  };
}

/**
 * Build bottleneck/SLA analysis data for Fact Pack
 */
function buildBottleneckData(
  snapshots: DataSnapshot[],
  snapshotEvents: SnapshotEvent[],
  requisitions: Requisition[],
  users: User[],
  dateRange: { start: Date; end: Date }
): BottleneckFactPack {
  // Check if we have snapshot data
  if (snapshots.length === 0 || snapshotEvents.length === 0) {
    return {
      available: false,
      unavailable_reason: 'No snapshot data available for SLA analysis. Import data snapshots regularly.',
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
        snapshot_count: snapshots.length,
        day_span: 0,
        coverage_percent: 0,
      },
      deep_link: '/diagnose/bottlenecks',
    };
  }

  // Check coverage sufficiency
  const coverage = checkCoverageSufficiency(snapshots, dateRange);

  if (!coverage.is_sufficient) {
    return {
      available: false,
      unavailable_reason: `Insufficient snapshot coverage: ${coverage.insufficiency_reasons.join(', ')}`,
      top_stages: [],
      summary: {
        total_breaches: 0,
        total_breach_hours: 0,
        breaches_by_owner_type: {},
        worst_stage: null,
        worst_owner_type: null,
      },
      coverage: {
        is_sufficient: coverage.is_sufficient,
        snapshot_count: coverage.snapshot_count,
        day_span: coverage.day_span,
        coverage_percent: coverage.coverage_percent,
      },
      deep_link: '/diagnose/bottlenecks',
    };
  }

  // Build maps for computation
  const requisitionMap = new Map<string, Requisition>();
  requisitions.forEach(r => requisitionMap.set(r.req_id, r));

  const userMap = new Map<string, User>();
  users.forEach(u => userMap.set(u.user_id, u));

  // Compute bottleneck summary
  const bottleneckSummary = computeBottleneckSummary(
    snapshotEvents,
    snapshots,
    requisitionMap,
    userMap,
    dateRange,
    DEFAULT_SLA_POLICIES
  );

  // Find worst owner type
  let worstOwnerType: string | null = null;
  let maxOwnerBreaches = 0;
  Object.entries(bottleneckSummary.breach_by_owner_type).forEach(([ownerType, count]) => {
    if (count > maxOwnerBreaches) {
      maxOwnerBreaches = count;
      worstOwnerType = ownerType;
    }
  });

  return {
    available: true,
    top_stages: bottleneckSummary.top_stages.slice(0, 5).map(stage => ({
      stage: stage.stage_key,
      display_name: stage.display_name,
      median_hours: stage.median_dwell_hours,
      sla_hours: DEFAULT_SLA_POLICIES.find(p => p.stage_key === stage.stage_key)?.sla_hours ?? 72,
      breach_rate: stage.breach_rate,
      bottleneck_score: stage.bottleneck_score,
    })),
    summary: {
      total_breaches: Object.values(bottleneckSummary.breach_counts).reduce((a, b) => a + b, 0),
      total_breach_hours: bottleneckSummary.top_reqs.reduce((sum, r) => sum + r.worst_breach_hours, 0),
      breaches_by_owner_type: bottleneckSummary.breach_by_owner_type,
      worst_stage: bottleneckSummary.top_stages[0]?.stage_key ?? null,
      worst_owner_type: worstOwnerType,
    },
    coverage: {
      is_sufficient: coverage.is_sufficient,
      snapshot_count: coverage.snapshot_count,
      day_span: coverage.day_span,
      coverage_percent: coverage.coverage_percent,
    },
    deep_link: '/diagnose/bottlenecks',
  };
}

// ─────────────────────────────────────────────────────────────
// Validation Helpers
// ─────────────────────────────────────────────────────────────

/**
 * Resolve a dot-notation key path to a value in the Fact Pack
 */
export function resolveKeyPath(obj: any, path: string): any {
  const parts = path.split('.');
  let current = obj;

  for (const part of parts) {
    // Handle array indexing: "top_p0[0]"
    const arrayMatch = part.match(/^(\w+)\[(\d+)\]$/);
    if (arrayMatch) {
      current = current?.[arrayMatch[1]]?.[parseInt(arrayMatch[2])];
    } else {
      current = current?.[part];
    }
    if (current === undefined) return undefined;
  }

  return current;
}

/**
 * Check if the Fact Pack contains any PII
 * Returns list of violations if found
 */
export function checkFactPackForPII(factPack: AskFactPack): string[] {
  const violations: string[] = [];
  const json = JSON.stringify(factPack);

  // Check for email patterns
  const emailPattern = /[\w.-]+@[\w.-]+\.\w+/g;
  const emails = json.match(emailPattern);
  if (emails) {
    violations.push(`Found email addresses: ${emails.join(', ')}`);
  }

  // Check for phone patterns
  const phonePattern = /\d{3}[-.]?\d{3}[-.]?\d{4}/g;
  const phones = json.match(phonePattern);
  if (phones) {
    violations.push(`Found phone numbers: ${phones.join(', ')}`);
  }

  // Check for non-anonymized names in owner_label
  const nonAnonPattern = /"owner_label":\s*"(?!Recruiter|Manager|TA Ops)[^"]+"/g;
  const nonAnon = json.match(nonAnonPattern);
  if (nonAnon) {
    violations.push(`Found non-anonymized owner labels: ${nonAnon.join(', ')}`);
  }

  return violations;
}

// ─────────────────────────────────────────────────────────────
// Simple Builder (from raw data, no computed values)
// ─────────────────────────────────────────────────────────────

export interface SimpleFactPackContext {
  requisitions: Requisition[];
  candidates: Candidate[];
  events: any[];
  users: User[];
  aiEnabled: boolean;
  dataHealthScore: number;
  orgId?: string;
  orgName?: string;
  // Filter context for deep link preservation
  filters?: {
    recruiterIds?: string[];
    dateRange?: { startDate: Date; endDate: Date } | null;
    dateRangePreset?: string;
    functions?: string[];
    regions?: string[];
  };
  // Optional snapshot data for SLA/bottleneck analysis (used in demo mode)
  snapshots?: DataSnapshot[];
  snapshotEvents?: SnapshotEvent[];
}

/**
 * Build a Fact Pack from raw data without requiring pre-computed metrics
 * Used when full DashboardState context is not available
 */
export function buildSimpleFactPack(context: SimpleFactPackContext): AskFactPack {
  const {
    requisitions,
    candidates,
    events,
    users,
    aiEnabled,
    dataHealthScore,
    orgId = 'unknown',
    orgName = 'Organization',
    filters,
    snapshots = [],
    snapshotEvents = [],
  } = context;

  const now = new Date();
  const anonMaps = buildAnonymizationMaps(users, requisitions);

  // Calculate date range
  const dates = candidates
    .map(c => c.applied_at)
    .filter((d): d is Date => d !== null)
    .sort((a, b) => a.getTime() - b.getTime());

  const startDate = dates.length > 0 ? dates[0] : now;
  const endDate = dates.length > 0 ? dates[dates.length - 1] : now;
  const days = differenceInDays(endDate, startDate);

  // Calculate sample sizes
  const hireCount = candidates.filter(c => c.disposition === CandidateDisposition.Hired).length;
  const offerCount = countOffers(candidates);

  // Calculate KPIs
  const ttfResult = calculateMedianTTF(candidates, requisitions);
  const acceptResult = calculateAcceptRate(candidates);
  const stalledCount = countStalledReqs(requisitions, candidates);
  const zombieCount = countZombieReqs(requisitions, candidates);

  // Build Control Tower KPIs
  const kpis: AskFactPack['control_tower']['kpis'] = {
    median_ttf: {
      value: ttfResult.value,
      unit: 'days',
      threshold: { green: 45, yellow: 60, red: 90 },
      status: calculateKPIStatus(ttfResult.value, { green: 45, yellow: 60, red: 90 }, false),
      n: ttfResult.n,
      trend: null,
    },
    offer_count: {
      value: offerCount,
      unit: 'count',
      threshold: { green: 10, yellow: 5, red: 0 },
      status: calculateKPIStatus(offerCount, { green: 10, yellow: 5, red: 0 }, true),
      n: offerCount,
      trend: null,
    },
    accept_rate: {
      value: acceptResult.value,
      unit: '%',
      threshold: { green: 80, yellow: 60, red: 40 },
      status: calculateKPIStatus(acceptResult.value, { green: 80, yellow: 60, red: 40 }, true),
      n: acceptResult.n,
      trend: null,
    },
    stalled_reqs: {
      value: stalledCount,
      unit: 'count',
      threshold: { green: 0, yellow: 5, red: 10 },
      status: calculateKPIStatus(stalledCount, { green: 0, yellow: 5, red: 10 }, false),
      n: requisitions.filter(r => r.status === RequisitionStatus.Open).length,
      trend: null,
    },
    hm_latency: {
      value: null,
      unit: 'days',
      threshold: { green: 2, yellow: 3, red: 5 },
      status: 'yellow',
      n: 0,
      trend: null,
    },
  };

  // Build risk summary from basic analysis
  const riskByType: Partial<Record<RiskType, number>> = {
    zombie: zombieCount,
    stalled: stalledCount,
    pipeline_gap: requisitions.filter(r => {
      const reqCandidates = candidates.filter(c => c.req_id === r.req_id);
      return r.status === RequisitionStatus.Open && reqCandidates.length === 0;
    }).length,
  };

  // Build top risks from zombies and stalled
  const topRisks: RiskSummary[] = [];

  // Add zombie reqs
  requisitions
    .filter(r => r.status === RequisitionStatus.Open)
    .forEach(r => {
      const reqCandidates = candidates.filter(c => c.req_id === r.req_id);
      const lastActivity = reqCandidates.reduce((latest, c) => {
        const candidateLatest = c.applied_at || c.first_contacted_at;
        if (candidateLatest && (!latest || candidateLatest > latest)) return candidateLatest;
        return latest;
      }, null as Date | null);

      const daysSinceActivity = lastActivity ? differenceInDays(now, lastActivity) : 999;

      if (daysSinceActivity >= 30) {
        const recruiter = users.find(u => u.user_id === r.recruiter_id);
        topRisks.push({
          risk_id: `zombie-${r.req_id}`,
          req_id: r.req_id,
          req_title: redactReqTitle(r.req_title || 'Untitled'),
          risk_type: 'zombie',
          failure_mode: 'No activity for 30+ days',
          days_open: r.opened_at ? differenceInDays(now, r.opened_at) : 0,
          candidate_count: reqCandidates.length,
          owner_label: recruiter ? anonMaps.recruiters.get(recruiter.user_id) || 'Recruiter' : 'Unassigned',
          top_driver: 'Stale pipeline',
        });
      }
    });

  // Sort and limit risks
  topRisks.sort((a, b) => b.days_open - a.days_open);
  const limitedRisks = topRisks.slice(0, MAX_TOP_RISKS);

  // Empty explanations (simplified builder)
  const defaultSummary: ExplainSummary = {
    metric_name: 'Unknown',
    value: null,
    unit: '',
    top_drivers: [],
    exclusions: [],
    confidence: 'low',
    n: 0,
  };

  return {
    meta: {
      generated_at: now.toISOString(),
      org_id: orgId,
      org_name: orgName,
      data_window: {
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0],
        days: Math.max(days, 1),
      },
      sample_sizes: {
        total_reqs: requisitions.length,
        total_candidates: candidates.length,
        total_hires: hireCount,
        total_offers: offerCount,
        total_events: events.length,
      },
      filter_context: {
        recruiter_ids: filters?.recruiterIds || [],
        date_range_start: filters?.dateRange?.startDate?.toISOString().split('T')[0] || null,
        date_range_end: filters?.dateRange?.endDate?.toISOString().split('T')[0] || null,
        date_range_preset: filters?.dateRangePreset || null,
        functions: filters?.functions || [],
        regions: filters?.regions || [],
      },
      capability_flags: {
        has_stage_timing: events.length > 0,
        has_source_data: candidates.some(c => c.source),
        has_hm_data: false,
        has_forecast_data: true,
        has_quality_data: false,
        ai_enabled: aiEnabled,
      },
      data_health_score: dataHealthScore,
    },
    control_tower: {
      kpis,
      risk_summary: {
        total_at_risk: limitedRisks.length,
        by_type: riskByType,
      },
      action_summary: {
        total_open: 0,
        p0_count: 0,
        p1_count: 0,
        p2_count: 0,
      },
    },
    explain: {
      time_to_offer: { ...defaultSummary, metric_name: 'Time to Offer' },
      hm_latency: { ...defaultSummary, metric_name: 'HM Latency' },
      accept_rate: { ...defaultSummary, metric_name: 'Accept Rate' },
      pipeline_health: { ...defaultSummary, metric_name: 'Pipeline Health' },
      source_effectiveness: { ...defaultSummary, metric_name: 'Source Effectiveness' },
    },
    actions: {
      top_p0: [],
      top_p1: [],
      by_owner_type: {
        recruiter: 0,
        hiring_manager: 0,
        ta_ops: 0,
      },
    },
    risks: {
      top_risks: limitedRisks,
      by_failure_mode: {
        zombie: limitedRisks.filter(r => r.risk_type === 'zombie'),
        stalled: limitedRisks.filter(r => r.risk_type === 'stalled'),
      },
    },
    forecast: buildForecastData(requisitions, candidates, []),
    velocity: buildVelocityData(candidates, events),
    sources: buildSourceData(candidates),
    capacity: buildCapacityData(users, requisitions),
    recruiter_performance: buildRecruiterPerformanceData(users, requisitions, candidates, anonMaps),
    hiring_manager_ownership: buildHiringManagerOwnershipData(requisitions, anonMaps),
    bottlenecks: buildBottleneckData(snapshots, snapshotEvents, requisitions, users, { start: startDate, end: endDate }),
    glossary: GLOSSARY,
  };
}
