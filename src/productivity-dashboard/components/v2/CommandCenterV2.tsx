import React, { useMemo, useState, useCallback } from 'react';
import { useDashboard } from '../../hooks/useDashboardContext';
import { KPICardV2 } from './KPICardV2';
import { BottleneckPanelV2 } from './BottleneckPanelV2';
import { RequisitionsTableV2 } from './RequisitionsTableV2';
import { TeamCapacityPanelV2 } from './TeamCapacityPanelV2';
import { PipelineFunnelV2 } from './PipelineFunnelV2';
import type { KPIMetric, BottleneckItem, PipelineStage, TeamCapacity, RequisitionV2 } from './types';
import { DataDrillDownModal, buildPipelineStageRecords, buildOffersRecords, buildReqsRecords, buildTTFRecords, buildPipelineCoverageRecords } from '../common/DataDrillDownModal';
import { differenceInDays } from 'date-fns';
import {
  CanonicalStage,
  Candidate,
  CandidateDisposition,
  DEFAULT_HYGIENE_SETTINGS,
  Event,
  EventType,
  HiringManagerFriction,
  OverviewMetrics,
  Requisition,
  RequisitionStatus,
  ReqHealthStatus,
  StageMappingConfig,
} from '../../types';
import { assessAllReqHealth } from '../../services/reqHealthService';
import { normalizeStage } from '../../services/stageNormalization';
import { analyzeCapacity } from '../../services/capacityFitEngine';
import { generateUnifiedActionQueue, saveActionState, getOpenActions } from '../../services/actionQueueService';
import { buildHMFactTables } from '../../services/hmFactTables';
import { calculatePendingActions } from '../../services/hmMetricsEngine';
import { DEFAULT_HM_RULES } from '../../config/hmRules';
import type { RecruiterLoadRow } from '../../types/capacityTypes';
import type { ActionItem } from '../../types/actionTypes';
import {
  Activity,
  AlertTriangle,
  ChevronRight,
  TrendingUp,
  Zap,
  Clock,
  CheckCircle2,
  Database,
  LayoutDashboard,
} from 'lucide-react';

// Props interface
interface CommandCenterV2Props {
  onNavigateToTab?: (tab: string) => void;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function reqHealthStatusToScore(status: ReqHealthStatus): number {
  // Deterministic, user-facing score derived from hygiene status (no randomness).
  switch (status) {
    case ReqHealthStatus.ACTIVE:
      return 85;
    case ReqHealthStatus.STALLED:
      return 55;
    case ReqHealthStatus.AT_RISK:
      return 45;
    case ReqHealthStatus.ZOMBIE:
      return 20;
    default:
      return 50;
  }
}

// Helper to map dashboard state to V2 KPI metrics (V0 Health KPI pattern)
function mapOverviewToKPIs(
  overview: OverviewMetrics | null,
  openReqCount: number,
  hmFriction: HiringManagerFriction[],
  activeCandidateCount: number
): KPIMetric[] {
  if (!overview) return [];

  const totalHires = overview.totalHires ?? 0;
  const totalOffers = overview.totalOffers ?? 0;
  const medianTTF = overview.medianTTF ?? null; // days
  const acceptRate = overview.totalOfferAcceptanceRate ?? null; // ratio (0-1)
  const acceptRatePct = acceptRate !== null ? Math.round(acceptRate * 100) : null;
  const stalledReqCount = overview.stalledReqCount ?? 0;

  // Try medianHMDecisionLatency first, fallback to hmFriction average
  let hmDecisionLatencyDays: number | null = null;

  const hmDecisionLatencyHours = overview.medianHMDecisionLatency ?? null;
  if (hmDecisionLatencyHours !== null) {
    hmDecisionLatencyDays = hmDecisionLatencyHours / 24;
  } else {
    // Fallback: compute from hmFriction feedbackLatencyMedian (like legacy ControlTowerTab)
    const hmLatencyValues = hmFriction
      .map(hm => hm.feedbackLatencyMedian !== null ? hm.feedbackLatencyMedian / 24 : null)
      .filter((v): v is number => v !== null);
    if (hmLatencyValues.length > 0) {
      hmDecisionLatencyDays = hmLatencyValues.reduce((a, b) => a + b, 0) / hmLatencyValues.length;
    }
  }

  // If HM latency is still unavailable, use Pipeline Ratio as 5th KPI instead
  const hasHMLatencyData = hmDecisionLatencyDays !== null;
  const pipelineRatio = openReqCount > 0 ? activeCandidateCount / openReqCount : 0;

  return [
    {
      id: 'ttf',
      label: 'Median TTF',
      value: medianTTF !== null ? `${Math.round(medianTTF)}d` : '--',
      subtitle: 'Target: <45 days',
      status: medianTTF === null ? 'neutral' : medianTTF > 45 ? 'bad' : medianTTF > 30 ? 'warn' : 'good',
      helpText: 'Median time to fill in days',
    },
    {
      id: 'offers',
      label: 'Offers',
      value: totalOffers,
      subtitle: `${totalHires} hires in period`,
      status: totalOffers > 0 ? 'good' : 'neutral',
      helpText: 'Active offers pending acceptance',
    },
    {
      id: 'accept-rate',
      label: 'Accept Rate',
      value: acceptRatePct !== null ? `${acceptRatePct}%` : '--',
      subtitle: 'Target: >80%',
      status: acceptRatePct === null ? 'neutral' : acceptRatePct >= 80 ? 'good' : acceptRatePct >= 60 ? 'warn' : 'bad',
      helpText: 'Offer acceptance rate',
    },
    {
      id: 'stalled',
      label: 'Stalled Reqs',
      value: stalledReqCount,
      subtitle: `of ${openReqCount} open reqs`,
      status: stalledReqCount > 5 ? 'bad' : stalledReqCount > 2 ? 'warn' : 'good',
      helpText: 'Requisitions with no activity in 14+ days',
    },
    // 5th KPI: HM Latency if data exists, otherwise Pipeline Ratio
    hasHMLatencyData
      ? {
          id: 'hm-latency',
          label: 'HM Latency',
          value: `${hmDecisionLatencyDays!.toFixed(1)}d`,
          subtitle: 'Avg feedback time',
          status: hmDecisionLatencyDays! > 5 ? 'bad' : hmDecisionLatencyDays! > 3 ? 'warn' : 'good',
          helpText: 'Median decision latency after last interview (days)',
        }
      : {
          id: 'pipeline-ratio',
          label: 'Pipeline Ratio',
          value: `${pipelineRatio.toFixed(1)}x`,
          subtitle: `${activeCandidateCount} active / ${openReqCount} reqs`,
          status: pipelineRatio >= 8 ? 'good' : pipelineRatio >= 4 ? 'warn' : 'bad',
          helpText: 'Active candidates per open requisition. Target: 8x or higher for healthy pipeline.',
        },
  ];
}

// Helper to map requisitions to V2 format
function mapRequisitionsToV2(
  requisitions: Requisition[],
  candidates: Candidate[],
  events: Event[],
  healthScoreByReqId: Map<string, number>
): RequisitionV2[] {
  const candidateCounts = new Map<string, number>();
  const offerCounts = new Map<string, number>();

  for (const c of candidates) {
    candidateCounts.set(c.req_id, (candidateCounts.get(c.req_id) || 0) + 1);
    if (c.offer_extended_at) {
      offerCounts.set(c.req_id, (offerCounts.get(c.req_id) || 0) + 1);
    }
  }

  const interviewCounts = new Map<string, number>();
  for (const e of events) {
    if (e.event_type === EventType.INTERVIEW_COMPLETED) {
      interviewCounts.set(e.req_id, (interviewCounts.get(e.req_id) || 0) + 1);
    }
  }

  return requisitions.map((req) => ({
    id: req.req_id,
    title: req.req_title || 'Untitled',
    department: String(req.function || 'Unknown'),
    level: req.level || '',
    priority: mapPriority(req.priority),
    status: mapStatus(req.status),
    openDate: req.opened_at ? req.opened_at.toISOString() : '',
    targetCloseDate: req.closed_at ? req.closed_at.toISOString() : '',
    assignedRecruiter: req.recruiter_id || null,
    hiringManager: req.hiring_manager_id || '',
    location: req.location_city || String(req.location_region || ''),
    candidates: candidateCounts.get(req.req_id) || 0,
    interviews: interviewCounts.get(req.req_id) || 0,
    offers: offerCounts.get(req.req_id) || 0,
    daysOpen: req.opened_at ? differenceInDays(new Date(), req.opened_at) : 0,
    healthScore: healthScoreByReqId.get(req.req_id) ?? null,
  }));
}

function mapPriority(priority: Requisition['priority']): 'critical' | 'high' | 'medium' | 'low' {
  const p = String(priority || '').toLowerCase();
  if (p === 'p0' || p.includes('critical') || p.includes('urgent')) return 'critical';
  if (p === 'p1' || p.includes('high')) return 'high';
  if (p === 'p3' || p.includes('low')) return 'low';
  return 'medium';
}

function mapStatus(status: Requisition['status']): RequisitionV2['status'] {
  const s = String(status || '').toLowerCase();
  if (s.includes('closed') || s.includes('filled') || s.includes('cancel')) return 'closed';
  if (s.includes('hold')) return 'on-hold';
  return 'open';
}

// Helper to create sample bottlenecks from dashboard data
function createBottlenecks(overview: OverviewMetrics | null, hmFriction: HiringManagerFriction[]): BottleneckItem[] {
  const bottlenecks: BottleneckItem[] = [];

  // Check for slow stages
  if (overview?.medianTTF !== null && overview?.medianTTF !== undefined && overview.medianTTF > 45) {
    bottlenecks.push({
      id: 'ttf-slow',
      type: 'stage',
      name: 'Time to Fill',
      severity: 'bad',
      metric: 'Median Days',
      value: Math.round(overview.medianTTF),
      impact: 'Extended hiring timeline impacts team velocity',
      recommendation: 'Review interview scheduling and decision turnaround times',
    });
  }

  // Check for HM friction
  if (hmFriction && hmFriction.length > 0) {
    const slowHMs = hmFriction
      .filter(hm => hm.feedbackLatencyMedian !== null)
      .map(hm => ({ ...hm, feedbackDays: (hm.feedbackLatencyMedian || 0) / 24 }))
      .filter(hm => hm.feedbackDays > 3);

    slowHMs.slice(0, 2).forEach((hm, idx) => {
      bottlenecks.push({
        id: `hm-slow-${idx}`,
        type: 'department',
        name: hm.hmName || 'Unknown HM',
        severity: hm.feedbackDays > 5 ? 'bad' : 'warn',
        metric: 'Median Feedback (Days)',
        value: Math.round(hm.feedbackDays),
        impact: 'Slow feedback extends candidate wait time',
        recommendation: 'Schedule recurring feedback sync with HM',
      });
    });
  }

  // Check for low accept rate
  if (
    overview?.totalOfferAcceptanceRate !== null &&
    overview?.totalOfferAcceptanceRate !== undefined &&
    overview.totalOfferAcceptanceRate < 0.7
  ) {
    const acceptRatePct = Math.round(overview.totalOfferAcceptanceRate * 100);
    bottlenecks.push({
      id: 'accept-rate-low',
      type: 'stage',
      name: 'Offer Stage',
      severity: acceptRatePct < 50 ? 'bad' : 'warn',
      metric: 'Accept Rate',
      value: acceptRatePct,
      impact: 'Low acceptance rate wastes recruiting effort',
      recommendation: 'Review compensation benchmarking and candidate experience',
    });
  }

  return bottlenecks;
}

function createPipelineStages(candidates: Candidate[], stageMapping: StageMappingConfig): PipelineStage[] {
  const order: Array<{ stage: CanonicalStage; label: string }> = [
    { stage: CanonicalStage.APPLIED, label: 'Applied' },
    { stage: CanonicalStage.SCREEN, label: 'Screen' },
    { stage: CanonicalStage.HM_SCREEN, label: 'HM Screen' },
    { stage: CanonicalStage.ONSITE, label: 'Onsite' },
    { stage: CanonicalStage.OFFER, label: 'Offer' },
    { stage: CanonicalStage.HIRED, label: 'Hired' },
  ];

  const reachedCounts = new Map<CanonicalStage, number>();
  order.forEach(s => reachedCounts.set(s.stage, 0));

  const durations: Record<string, number[]> = {
    [CanonicalStage.APPLIED]: [],
    [CanonicalStage.SCREEN]: [],
    [CanonicalStage.HM_SCREEN]: [],
    [CanonicalStage.ONSITE]: [],
    [CanonicalStage.OFFER]: [],
  };

  for (const c of candidates) {
    // Determine "max stage reached" using explicit timestamps first, then fall back to current stage mapping.
    let maxStage: CanonicalStage | null = null;

    if (c.disposition === CandidateDisposition.Hired || c.hired_at) {
      maxStage = CanonicalStage.HIRED;
    } else if (c.offer_extended_at || c.stage_timestamps?.offer_at) {
      maxStage = CanonicalStage.OFFER;
    } else if (c.stage_timestamps?.onsite_at) {
      maxStage = CanonicalStage.ONSITE;
    } else if (c.stage_timestamps?.hm_screen_at) {
      maxStage = CanonicalStage.HM_SCREEN;
    } else if (c.stage_timestamps?.screen_at) {
      maxStage = CanonicalStage.SCREEN;
    } else {
      const normalized = normalizeStage(c.current_stage, stageMapping);
      maxStage = normalized ?? (c.applied_at || c.current_stage_entered_at ? CanonicalStage.APPLIED : null);
    }

    if (maxStage) {
      const maxIdx = order.findIndex(s => s.stage === maxStage);
      if (maxIdx >= 0) {
        for (let i = 0; i <= maxIdx; i++) {
          const s = order[i].stage;
          reachedCounts.set(s, (reachedCounts.get(s) || 0) + 1);
        }
      }
    }

    // Stage duration medians (only when we have explicit timestamps)
    const appliedAt = c.applied_at;
    const screenAt = c.stage_timestamps?.screen_at;
    const hmScreenAt = c.stage_timestamps?.hm_screen_at;
    const onsiteAt = c.stage_timestamps?.onsite_at;
    const offerAt = c.stage_timestamps?.offer_at || c.offer_extended_at;
    const hiredAt = c.hired_at;

    if (appliedAt && screenAt) {
      const d = differenceInDays(screenAt, appliedAt);
      if (d >= 0 && d <= 365) durations[CanonicalStage.APPLIED].push(d);
    }
    if (screenAt && hmScreenAt) {
      const d = differenceInDays(hmScreenAt, screenAt);
      if (d >= 0 && d <= 365) durations[CanonicalStage.SCREEN].push(d);
    }
    if (hmScreenAt && onsiteAt) {
      const d = differenceInDays(onsiteAt, hmScreenAt);
      if (d >= 0 && d <= 365) durations[CanonicalStage.HM_SCREEN].push(d);
    }
    if (onsiteAt && offerAt) {
      const d = differenceInDays(offerAt, onsiteAt);
      if (d >= 0 && d <= 365) durations[CanonicalStage.ONSITE].push(d);
    }
    if (offerAt && hiredAt) {
      const d = differenceInDays(hiredAt, offerAt);
      if (d >= 0 && d <= 365) durations[CanonicalStage.OFFER].push(d);
    }
  }

  return order.map((s, i) => {
    const count = reachedCounts.get(s.stage) || 0;
    const next = order[i + 1];
    const nextCount = next ? reachedCounts.get(next.stage) || 0 : 0;

    return {
      name: s.label,
      count,
      avgDays: s.stage === CanonicalStage.HIRED ? 0 : Math.round(median(durations[s.stage]) || 0),
      conversionRate: next && count > 0 ? Math.round((nextCount / count) * 100) : 0,
    };
  });
}

// Helper to create team capacity from capacity analysis results
// Uses actual WorkloadUnits from the complexity scoring engine
function createTeamCapacityFromAnalysis(
  recruiterLoads: RecruiterLoadRow[],
  teamLookup: Map<string, string> // recruiterId -> team name
): TeamCapacity[] {
  if (!recruiterLoads.length) return [];

  const teamMap = new Map<string, TeamCapacity>();

  for (const recruiter of recruiterLoads) {
    const team = teamLookup.get(recruiter.recruiterId) || 'Talent Acquisition';
    const existing = teamMap.get(team);

    if (existing) {
      existing.totalCapacity += recruiter.capacityWU;
      existing.usedCapacity += recruiter.demandWU;
      existing.headcount += 1;
      existing.openReqs += recruiter.reqCount;
      existing.utilization = existing.totalCapacity > 0
        ? Math.round((existing.usedCapacity / existing.totalCapacity) * 100)
        : 0;
    } else {
      teamMap.set(team, {
        team,
        totalCapacity: recruiter.capacityWU,
        usedCapacity: recruiter.demandWU,
        utilization: recruiter.utilization,
        headcount: 1,
        openReqs: recruiter.reqCount,
      });
    }
  }

  return Array.from(teamMap.values());
}

export function CommandCenterV2({ onNavigateToTab }: CommandCenterV2Props) {
  const { state } = useDashboard();

  // Navigation handlers for CTAs
  const handleViewHealthDetails = useCallback(() => {
    onNavigateToTab?.('overview');
  }, [onNavigateToTab]);

  const handleViewRisks = useCallback(() => {
    onNavigateToTab?.('bottlenecks');
  }, [onNavigateToTab]);

  const handleViewPipeline = useCallback(() => {
    onNavigateToTab?.('forecasting');
  }, [onNavigateToTab]);

  const handleViewBottlenecks = useCallback(() => {
    onNavigateToTab?.('bottlenecks');
  }, [onNavigateToTab]);

  const handlePipelineStageClick = useCallback((stageName: string, count: number) => {
    setPipelineDrillDown({ isOpen: true, stageName, stageCount: count });
  }, []);

  const handleClosePipelineDrillDown = useCallback(() => {
    setPipelineDrillDown(prev => ({ ...prev, isOpen: false }));
  }, []);

  const handleForecastClick = useCallback((type: 'offers' | 'openReqs') => {
    setForecastDrillDown({ isOpen: true, type });
  }, []);

  const handleCloseForecastDrillDown = useCallback(() => {
    setForecastDrillDown(prev => ({ ...prev, isOpen: false }));
  }, []);

  const { dataStore, overview, hmFriction, filters } = state;

  // Pipeline drill-down state
  const [pipelineDrillDown, setPipelineDrillDown] = useState<{
    isOpen: boolean;
    stageName: string;
    stageCount: number;
  }>({ isOpen: false, stageName: '', stageCount: 0 });

  // Forecast drill-down state
  const [forecastDrillDown, setForecastDrillDown] = useState<{
    isOpen: boolean;
    type: 'offers' | 'openReqs' | null;
  }>({ isOpen: false, type: null });

  // KPI drill-down state
  const [kpiDrillDown, setKpiDrillDown] = useState<{
    isOpen: boolean;
    type: 'ttf' | 'offers' | 'acceptRate' | 'stalledReqs' | 'hmLatency' | 'pipelineRatio' | null;
  }>({ isOpen: false, type: null });

  // Action update counter to force re-render when actions change
  const [actionUpdateCounter, setActionUpdateCounter] = useState(0);

  // Actions drawer state
  const [showAllActions, setShowAllActions] = useState(false);
  const [selectedAction, setSelectedAction] = useState<ActionItem | null>(null);

  const handleKpiClick = useCallback((kpiId: string) => {
    const typeMap: Record<string, 'ttf' | 'offers' | 'acceptRate' | 'stalledReqs' | 'hmLatency' | 'pipelineRatio'> = {
      'ttf': 'ttf',
      'offers': 'offers',
      'accept-rate': 'acceptRate',
      'stalled': 'stalledReqs',
      'hm-latency': 'hmLatency',
      'pipeline-ratio': 'pipelineRatio',
    };
    const type = typeMap[kpiId];
    if (type) {
      setKpiDrillDown({ isOpen: true, type });
    }
  }, []);

  const handleCloseKpiDrillDown = useCallback(() => {
    setKpiDrillDown(prev => ({ ...prev, isOpen: false }));
  }, []);

  // Map data to V2 formats
  const openReqCount = useMemo(
    () =>
      dataStore.requisitions.filter(
        (r) => r.status === RequisitionStatus.Open || r.status === RequisitionStatus.OnHold
      ).length,
    [dataStore.requisitions]
  );

  // Active candidate count for KPIs (candidates not yet hired/rejected/withdrawn)
  const activeCandidateCount = useMemo(() => {
    return dataStore.candidates.filter(c =>
      !c.hired_at &&
      c.disposition !== CandidateDisposition.Rejected &&
      c.disposition !== CandidateDisposition.Withdrawn
    ).length;
  }, [dataStore.candidates]);

  const kpiMetrics = useMemo(
    () => mapOverviewToKPIs(overview, openReqCount, hmFriction || [], activeCandidateCount),
    [overview, openReqCount, hmFriction, activeCandidateCount]
  );

  const reqHealthScoreByReqId = useMemo(() => {
    const scores = new Map<string, number>();
    if (!dataStore.requisitions.length) return scores;

    const assessments = assessAllReqHealth(
      dataStore.requisitions,
      dataStore.candidates,
      dataStore.events,
      DEFAULT_HYGIENE_SETTINGS
    );
    for (const a of assessments) {
      scores.set(a.reqId, reqHealthStatusToScore(a.status));
    }
    return scores;
  }, [dataStore.requisitions, dataStore.candidates, dataStore.events]);

  // Create filtered data based on dashboard context filters - this is the source of truth for all metrics
  const filteredRequisitions = useMemo(() => {
    let reqs = dataStore.requisitions;

    // Filter by function/department
    if (filters.functions && filters.functions.length > 0) {
      reqs = reqs.filter(r => {
        const fn = String(r.function || '');
        return filters.functions!.includes(fn);
      });
    }

    // Filter by recruiter
    if (filters.recruiterIds && filters.recruiterIds.length > 0) {
      reqs = reqs.filter(r => r.recruiter_id && filters.recruiterIds!.includes(r.recruiter_id));
    }

    // Filter by job family
    if (filters.jobFamilies && filters.jobFamilies.length > 0) {
      reqs = reqs.filter(r => r.job_family && filters.jobFamilies!.includes(r.job_family));
    }

    // Filter by level
    if (filters.levels && filters.levels.length > 0) {
      reqs = reqs.filter(r => r.level && filters.levels!.includes(r.level));
    }

    // Filter by region
    if (filters.regions && filters.regions.length > 0) {
      reqs = reqs.filter(r => filters.regions!.includes(r.location_region));
    }

    // Filter by hiring manager
    if (filters.hiringManagerIds && filters.hiringManagerIds.length > 0) {
      reqs = reqs.filter(r => r.hiring_manager_id && filters.hiringManagerIds!.includes(r.hiring_manager_id));
    }

    return reqs;
  }, [dataStore.requisitions, filters.functions, filters.recruiterIds, filters.jobFamilies, filters.levels, filters.regions, filters.hiringManagerIds]);

  const filteredReqIds = useMemo(() => new Set(filteredRequisitions.map(r => r.req_id)), [filteredRequisitions]);

  const filteredCandidates = useMemo(() => {
    // Only include candidates for filtered requisitions
    return dataStore.candidates.filter(c => filteredReqIds.has(c.req_id));
  }, [dataStore.candidates, filteredReqIds]);

  const requisitionsV2 = useMemo(() => {
    let reqs = mapRequisitionsToV2(
      filteredRequisitions,
      filteredCandidates,
      dataStore.events,
      reqHealthScoreByReqId
    );

    // Command Center table is for active reqs.
    reqs = reqs.filter(r => r.status !== 'closed');

    return reqs;
  }, [filteredRequisitions, filteredCandidates, dataStore.events, reqHealthScoreByReqId]);

  const bottlenecks = useMemo(() => createBottlenecks(overview, hmFriction), [overview, hmFriction]);

  // Generate unified action queue (includes HM actions, Explain actions, and manual actions from Ask)
  const datasetId = useMemo(() => {
    if (dataStore.lastImportAt) {
      return `dataset_${dataStore.lastImportAt.getTime()}`;
    }
    return 'dataset_default';
  }, [dataStore.lastImportAt]);

  const unifiedActions = useMemo(() => {
    if (!dataStore.requisitions.length) return [];

    // Calculate HM pending actions
    const factTables = buildHMFactTables(
      dataStore.requisitions,
      dataStore.candidates,
      dataStore.events,
      dataStore.users,
      dataStore.config.stageMapping,
      dataStore.lastImportAt || new Date()
    );
    const hmPendingActions = calculatePendingActions(factTables, dataStore.users, DEFAULT_HM_RULES);

    // Generate unified queue (includes manual actions from localStorage)
    return generateUnifiedActionQueue({
      hmActions: hmPendingActions,
      explanations: new Map(), // Explain actions would need full Explain engine integration
      requisitions: dataStore.requisitions,
      users: dataStore.users,
      datasetId,
      includeManualActions: true,
    });
  }, [dataStore, datasetId, actionUpdateCounter]);

  const openActions = useMemo(() => getOpenActions(unifiedActions), [unifiedActions]);

  const pipelineStages = useMemo(
    () => createPipelineStages(filteredCandidates, dataStore.config.stageMapping),
    [filteredCandidates, dataStore.config.stageMapping]
  );

  // Build pipeline drill-down records filtered by selected stage
  // Uses the SAME logic as createPipelineStages to ensure counts match
  const pipelineDrillDownRecords = useMemo(() => {
    if (!pipelineDrillDown.isOpen || !pipelineDrillDown.stageName) return [];

    // Stage order must match createPipelineStages exactly
    const stageOrder = [
      { stage: CanonicalStage.APPLIED, label: 'Applied' },
      { stage: CanonicalStage.SCREEN, label: 'Screen' },
      { stage: CanonicalStage.HM_SCREEN, label: 'HM Screen' },
      { stage: CanonicalStage.ONSITE, label: 'Onsite' },
      { stage: CanonicalStage.OFFER, label: 'Offer' },
      { stage: CanonicalStage.HIRED, label: 'Hired' },
    ];

    const targetIdx = stageOrder.findIndex(s => s.label === pipelineDrillDown.stageName);
    if (targetIdx < 0) return [];

    // Filter candidates using the same "maxStage" logic as the funnel
    // Use filteredCandidates (already filtered by department/recruiter)
    const stageCandidates = filteredCandidates.filter(c => {
      // Determine maxStage exactly as createPipelineStages does
      let maxStage: CanonicalStage | null = null;

      if (c.disposition === CandidateDisposition.Hired || c.hired_at) {
        maxStage = CanonicalStage.HIRED;
      } else if (c.offer_extended_at || c.stage_timestamps?.offer_at) {
        maxStage = CanonicalStage.OFFER;
      } else if (c.stage_timestamps?.onsite_at) {
        maxStage = CanonicalStage.ONSITE;
      } else if (c.stage_timestamps?.hm_screen_at) {
        maxStage = CanonicalStage.HM_SCREEN;
      } else if (c.stage_timestamps?.screen_at) {
        maxStage = CanonicalStage.SCREEN;
      } else {
        const normalized = normalizeStage(c.current_stage, dataStore.config.stageMapping);
        maxStage = normalized ?? (c.applied_at || c.current_stage_entered_at ? CanonicalStage.APPLIED : null);
      }

      if (!maxStage) return false;

      // Check if maxStage is in the funnel's stage order
      const maxIdx = stageOrder.findIndex(s => s.stage === maxStage);
      if (maxIdx < 0) return false; // Terminal stages like REJECTED aren't in funnel

      // Include if candidate reached at least the target stage
      return maxIdx >= targetIdx;
    });

    return buildPipelineStageRecords(stageCandidates, filteredRequisitions, dataStore.users);
  }, [pipelineDrillDown.isOpen, pipelineDrillDown.stageName, filteredCandidates, filteredRequisitions, dataStore.users, dataStore.config.stageMapping]);

  // Build forecast drill-down records
  const forecastDrillDownRecords = useMemo(() => {
    if (!forecastDrillDown.isOpen || !forecastDrillDown.type) return [];

    if (forecastDrillDown.type === 'offers') {
      // Active offers - candidates with offer extended but not yet hired/rejected
      const activeOfferCandidates = filteredCandidates.filter(c =>
        c.offer_extended_at && !c.hired_at && c.disposition !== CandidateDisposition.Rejected
      );
      return buildOffersRecords(activeOfferCandidates, filteredRequisitions, dataStore.users);
    }

    if (forecastDrillDown.type === 'openReqs') {
      // Open reqs needing hires
      const openReqs = filteredRequisitions.filter(r => !r.closed_at);
      return buildReqsRecords(openReqs, dataStore.users);
    }

    return [];
  }, [forecastDrillDown.isOpen, forecastDrillDown.type, filteredCandidates, filteredRequisitions, dataStore.users]);

  // Build KPI drill-down records
  const kpiDrillDownRecords = useMemo(() => {
    if (!kpiDrillDown.isOpen || !kpiDrillDown.type) return [];

    switch (kpiDrillDown.type) {
      case 'ttf':
        // Hired candidates with their time-to-fill
        return buildTTFRecords(filteredCandidates, filteredRequisitions, dataStore.users);

      case 'offers':
        // All candidates who received offers
        const offerCandidates = filteredCandidates.filter(c => c.offer_extended_at);
        return buildOffersRecords(offerCandidates, filteredRequisitions, dataStore.users);

      case 'acceptRate':
        // Candidates with offers, showing accept/reject status
        const offersWithOutcome = filteredCandidates.filter(c => c.offer_extended_at);
        return buildOffersRecords(offersWithOutcome, filteredRequisitions, dataStore.users);

      case 'stalledReqs':
        // Stalled requisitions (no activity in 14+ days)
        const stalledReqs = filteredRequisitions.filter(r => {
          if (r.closed_at) return false;
          const healthScore = reqHealthScoreByReqId.get(r.req_id);
          // Stalled reqs have score around 55, zombies around 20
          return healthScore !== undefined && healthScore <= 55;
        });
        return buildReqsRecords(stalledReqs, dataStore.users);

      case 'hmLatency':
        // Show open reqs as context for HM latency
        const reqsWithHMDelay = filteredRequisitions.filter(r => !r.closed_at);
        return buildReqsRecords(reqsWithHMDelay, dataStore.users);

      case 'pipelineRatio':
        // Show open reqs with their candidate counts, sorted by lowest first
        return buildPipelineCoverageRecords(filteredRequisitions, filteredCandidates, dataStore.users);

      default:
        return [];
    }
  }, [kpiDrillDown.isOpen, kpiDrillDown.type, filteredCandidates, filteredRequisitions, dataStore.users, reqHealthScoreByReqId]);

  // Get drill-down type and title for KPI
  const kpiDrillDownConfig = useMemo(() => {
    const configs: Record<string, { title: string; type: 'medianTTF' | 'offers' | 'offerAcceptRate' | 'stalledReqs' | 'openReqs' | 'pipelineCoverage' }> = {
      ttf: { title: 'Time to Fill Breakdown', type: 'medianTTF' },
      offers: { title: 'All Offers Extended', type: 'offers' },
      acceptRate: { title: 'Offer Accept/Reject Status', type: 'offerAcceptRate' },
      stalledReqs: { title: 'Stalled Requisitions', type: 'stalledReqs' },
      hmLatency: { title: 'Open Requisitions', type: 'openReqs' },
      pipelineRatio: { title: 'Reqs by Pipeline Coverage', type: 'pipelineCoverage' },
    };
    return kpiDrillDown.type ? configs[kpiDrillDown.type] : null;
  }, [kpiDrillDown.type]);

  // Run capacity analysis using the complexity-weighted engine
  const capacityAnalysis = useMemo(() => {
    if (!dataStore.requisitions.length || !dataStore.config) {
      return null;
    }
    return analyzeCapacity(
      dataStore.requisitions,
      dataStore.candidates,
      dataStore.events,
      dataStore.users,
      filters,
      dataStore.config
    );
  }, [dataStore.requisitions, dataStore.candidates, dataStore.events, dataStore.users, filters, dataStore.config]);

  // Build team lookup map from overview recruiter summaries
  const recruiterTeamLookup = useMemo(() => {
    const lookup = new Map<string, string>();
    if (overview?.recruiterSummaries) {
      for (const r of overview.recruiterSummaries) {
        lookup.set(r.recruiterId, r.team || 'Talent Acquisition');
      }
    }
    return lookup;
  }, [overview]);

  // Build team capacity from complexity-weighted analysis
  const teamCapacity = useMemo(() => {
    if (!capacityAnalysis || capacityAnalysis.blocked) {
      // Fallback to simple req count if capacity analysis blocked
      if (!overview?.recruiterSummaries) return [];
      const teamMap = new Map<string, TeamCapacity>();
      for (const r of overview.recruiterSummaries) {
        const team = r.team || 'Talent Acquisition';
        const existing = teamMap.get(team);
        const reqLoad = r.activeReqLoad || 0;
        if (existing) {
          existing.headcount += 1;
          existing.openReqs += reqLoad;
        } else {
          teamMap.set(team, {
            team,
            totalCapacity: 0, // Unknown without analysis
            usedCapacity: 0,
            utilization: 0,
            headcount: 1,
            openReqs: reqLoad,
          });
        }
      }
      return Array.from(teamMap.values());
    }
    return createTeamCapacityFromAnalysis(capacityAnalysis.recruiterLoads, recruiterTeamLookup);
  }, [capacityAnalysis, overview, recruiterTeamLookup]);

  // Build recruiter details from capacity analysis (complexity-weighted)
  const recruiterDetails = useMemo(() => {
    if (!capacityAnalysis || capacityAnalysis.blocked) {
      // Fallback: show raw req counts if analysis blocked
      if (!overview?.recruiterSummaries) return [];
      return overview.recruiterSummaries.map(r => ({
        recruiterId: r.recruiterId,
        recruiterName: r.recruiterName,
        team: r.team || 'Talent Acquisition',
        openReqs: r.activeReqLoad || 0,
        demandWU: 0,
        capacityWU: 0,
        utilization: 0,
      }));
    }
    // Use complexity-weighted WorkloadUnits from capacity engine
    return capacityAnalysis.recruiterLoads.map(r => ({
      recruiterId: r.recruiterId,
      recruiterName: r.recruiterName,
      team: recruiterTeamLookup.get(r.recruiterId) || 'Talent Acquisition',
      openReqs: r.reqCount,
      demandWU: Math.round(r.demandWU),
      capacityWU: Math.round(r.capacityWU),
      utilization: r.utilization,
    }));
  }, [capacityAnalysis, overview, recruiterTeamLookup]);

  // Handler for capacity planning navigation
  const handleViewCapacityPlanning = useCallback(() => {
    onNavigateToTab?.('capacity');
  }, [onNavigateToTab]);

  // Check if any filters are active
  const hasActiveFilters = useMemo(() => {
    return (
      (filters.functions && filters.functions.length > 0) ||
      (filters.recruiterIds && filters.recruiterIds.length > 0) ||
      (filters.jobFamilies && filters.jobFamilies.length > 0) ||
      (filters.levels && filters.levels.length > 0) ||
      (filters.regions && filters.regions.length > 0) ||
      (filters.hiringManagerIds && filters.hiringManagerIds.length > 0)
    );
  }, [filters]);

  // Count active (pending) offers - uses FILTERED data
  const activeOffersCount = useMemo(() => {
    return filteredCandidates.filter(c =>
      c.offer_extended_at && !c.hired_at && c.disposition !== CandidateDisposition.Rejected
    ).length;
  }, [filteredCandidates]);

  // Count open reqs - uses FILTERED data
  const openReqsCount = useMemo(() => {
    return filteredRequisitions.filter(r => !r.closed_at).length;
  }, [filteredRequisitions]);

  // Calculate pipeline confidence with breakdown - uses FILTERED data
  const confidenceBreakdown = useMemo(() => {
    const factors: Array<{
      label: string;
      value: string;
      score: number; // 0-100
      status: 'good' | 'warn' | 'bad';
      explanation: string;
    }> = [];

    // Factor 1: Pipeline coverage (candidates per open req)
    const activeCandidates = filteredCandidates.filter(c =>
      !c.hired_at && c.disposition !== CandidateDisposition.Rejected && c.disposition !== CandidateDisposition.Withdrawn
    ).length;
    const filteredOpenReqs = filteredRequisitions.filter(r => !r.closed_at).length;
    const coverageRatio = filteredOpenReqs > 0 ? activeCandidates / filteredOpenReqs : 0;
    const coverageScore = Math.min(100, coverageRatio * 10); // 10 candidates per req = 100%
    factors.push({
      label: 'Pipeline Coverage',
      value: `${coverageRatio.toFixed(1)}x`,
      score: coverageScore,
      status: coverageRatio >= 8 ? 'good' : coverageRatio >= 4 ? 'warn' : 'bad',
      explanation: `${activeCandidates} active candidates for ${filteredOpenReqs} open reqs`,
    });

    // Factor 2: Offer-to-hire conversion (pending offers vs recent hires)
    const recentHires = filteredCandidates.filter(c => c.hired_at).length;
    const totalOffersMade = filteredCandidates.filter(c => c.offer_extended_at).length;
    const acceptRate = totalOffersMade > 0 ? (recentHires / totalOffersMade) * 100 : 0;
    factors.push({
      label: 'Offer Accept Rate',
      value: `${Math.round(acceptRate)}%`,
      score: acceptRate,
      status: acceptRate >= 70 ? 'good' : acceptRate >= 50 ? 'warn' : 'bad',
      explanation: `${recentHires} hires from ${totalOffersMade} offers extended`,
    });

    // Factor 3: Req health (% active vs stalled/zombie) - for filtered reqs only
    const filteredReqHealthScores = filteredRequisitions
      .map(r => reqHealthScoreByReqId.get(r.req_id))
      .filter((score): score is number => score !== undefined);
    const healthyReqs = filteredReqHealthScores.filter(score => score >= 70).length;
    const totalOpenReqs = filteredOpenReqs || 1;
    const healthRatio = (healthyReqs / totalOpenReqs) * 100;
    factors.push({
      label: 'Req Health',
      value: `${Math.round(healthRatio)}%`,
      score: healthRatio,
      status: healthRatio >= 70 ? 'good' : healthRatio >= 50 ? 'warn' : 'bad',
      explanation: `${healthyReqs} of ${totalOpenReqs} reqs are healthy (not stalled/zombie)`,
    });

    // Factor 4: Funnel conversion (applied to offer)
    const appliedCount = pipelineStages[0]?.count || 0;
    const offerCount = pipelineStages[4]?.count || 0;
    const funnelConversion = appliedCount > 0 ? (offerCount / appliedCount) * 100 : 0;
    factors.push({
      label: 'Funnel Conversion',
      value: `${funnelConversion.toFixed(1)}%`,
      score: Math.min(100, funnelConversion * 5), // 20% conversion = 100 score
      status: funnelConversion >= 15 ? 'good' : funnelConversion >= 8 ? 'warn' : 'bad',
      explanation: `${offerCount} offers from ${appliedCount} applications`,
    });

    // Overall confidence score (weighted average)
    const avgScore = factors.reduce((sum, f) => sum + f.score, 0) / factors.length;
    const level: 'HIGH' | 'MED' | 'LOW' = avgScore >= 65 ? 'HIGH' : avgScore >= 40 ? 'MED' : 'LOW';

    return { factors, avgScore, level };
  }, [filteredCandidates, filteredRequisitions, reqHealthScoreByReqId, pipelineStages]);

  // State for confidence breakdown modal
  const [showConfidenceBreakdown, setShowConfidenceBreakdown] = useState(false);

  // Show empty state if no data
  if (dataStore.requisitions.length === 0) {
    return (
      <div className="p-4 md:p-6 max-w-[1600px] mx-auto">
        <div className="glass-panel p-8 text-center">
          <h2 className="text-xl font-semibold text-foreground mb-2">No Data Available</h2>
          <p className="text-muted-foreground">
            Import CSV data to see the Command Center dashboard.
          </p>
        </div>
      </div>
    );
  }

  // Count risks by severity
  const highRiskCount = bottlenecks.filter(b => b.severity === 'bad').length;
  // Action count from unified action queue
  const actionCount = openActions.length;

  return (
    <div className="min-h-screen bg-background">
      {/* Page Header */}
      <header className="border-b border-glass-border bg-background/80">
        <div className="mx-auto flex h-14 max-w-[1600px] items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-light">
              <LayoutDashboard className="h-5 w-5 text-accent" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-foreground">Command Center</h1>
              <p className="text-xs text-muted-foreground">Executive overview of recruiting operations</p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-4 md:px-6 py-6">
        {/* Dataset Status Bar */}
        <div className="mb-6 flex flex-wrap items-center gap-3 rounded-lg border border-glass-border bg-bg-glass px-4 py-3">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-accent" />
            <span className="text-sm font-medium text-foreground">
              {filteredCandidates.length.toLocaleString()} candidates
            </span>
            <span className="text-muted-foreground">•</span>
            <span className="text-sm text-muted-foreground">
              {filteredRequisitions.length.toLocaleString()} reqs
            </span>
            {hasActiveFilters && (
              <>
                <span className="text-muted-foreground">•</span>
                <span className="text-xs text-primary">
                  Filtered from {dataStore.candidates.length.toLocaleString()} / {dataStore.requisitions.length.toLocaleString()}
                </span>
              </>
            )}
          </div>
          <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
            <span>Last updated: {dataStore.lastImportAt ? new Date(dataStore.lastImportAt).toLocaleDateString() : 'Never'}</span>
          </div>
        </div>

        {/* Health KPIs Section (V0 pattern) */}
        <section className="mb-8">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-accent" />
              <h2 className="text-base font-semibold text-foreground">Health</h2>
            </div>
            <button
              type="button"
              onClick={handleViewHealthDetails}
              className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              View Details
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
            {kpiMetrics.map((metric) => (
              <KPICardV2
                key={metric.id || metric.label}
                label={metric.label}
                value={metric.value}
                subtitle={metric.subtitle}
                change={metric.change}
                trend={metric.trend}
                status={metric.status}
                helpText={metric.helpText}
                onClick={() => metric.id && handleKpiClick(metric.id)}
              />
            ))}
          </div>
        </section>

        {/* Two Column Layout: Risks | Actions */}
        <div className="grid gap-6 lg:grid-cols-2 mb-8">
          {/* Risks Panel */}
          <section>
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-warn" />
                <h2 className="text-base font-semibold text-foreground">Risks</h2>
                {highRiskCount > 0 && (
                  <span className="rounded-full bg-bad-bg px-2 py-0.5 text-xs font-medium text-bad">
                    {highRiskCount} HIGH
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={handleViewRisks}
                className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                View All
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <BottleneckPanelV2 bottlenecks={bottlenecks} onViewAll={handleViewBottlenecks} />
          </section>

          {/* Actions Section */}
          <section>
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-accent" />
                <h2 className="text-base font-semibold text-foreground">Actions</h2>
                <span className="rounded-full bg-accent-light px-2 py-0.5 text-xs font-medium text-accent">
                  {actionCount} Open
                </span>
              </div>
              {actionCount > 5 && (
                <button
                  type="button"
                  onClick={() => setShowAllActions(true)}
                  className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  View All
                  <ChevronRight className="h-4 w-4" />
                </button>
              )}
            </div>
            {/* Unified Action Queue */}
            <div className="rounded-lg border border-glass-border bg-bg-glass">
              <div className="max-h-[360px] divide-y divide-glass-border overflow-y-auto">
                {openActions.length === 0 ? (
                  <div className="p-6 text-center text-sm text-muted-foreground">
                    No open actions. Great work!
                  </div>
                ) : (
                  openActions.slice(0, 5).map((action, idx) => {
                    const priorityColor = action.priority === 'P0' ? 'bg-bad' : action.priority === 'P1' ? 'bg-warn' : 'bg-good';
                    const ownerLabel = action.owner_type === 'HIRING_MANAGER' ? 'HM' : action.owner_type === 'RECRUITER' ? 'Recruiter' : 'Ops';
                    return (
                      <div
                        key={action.action_id}
                        className={`group flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/30 ${idx % 2 === 0 ? 'bg-muted/30' : ''}`}
                      >
                        <div className={`mt-1 h-9 w-1 shrink-0 rounded-full ${priorityColor}`} />
                        <button
                          type="button"
                          onClick={() => setSelectedAction(action)}
                          className="min-w-0 flex-1 text-left"
                        >
                          <div className="mb-1 truncate text-sm font-medium text-foreground group-hover:text-accent transition-colors">{action.title}</div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold bg-accent-light text-accent">
                              {action.priority}
                            </span>
                            <span className="rounded px-1.5 py-0.5 text-[10px] font-medium bg-muted text-muted-foreground">
                              {ownerLabel}
                            </span>
                            {action.req_title && (
                              <span className="truncate text-xs text-muted-foreground">{action.req_title}</span>
                            )}
                          </div>
                          {action.evidence?.short_reason && (
                            <div className="mt-1 text-xs text-muted-foreground/80">{action.evidence.short_reason}</div>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            // Mark action as done
                            saveActionState(datasetId, action.action_id, 'DONE');
                            // Trigger re-render
                            setActionUpdateCounter(c => c + 1);
                          }}
                          className="mt-1 shrink-0 rounded px-2 py-1 text-[10px] font-medium text-muted-foreground hover:bg-good/20 hover:text-good transition-colors"
                          title="Mark as done"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </section>
        </div>

        {/* Forecast Section */}
        <section className="mb-8">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-good" />
              <h2 className="text-base font-semibold text-foreground">Forecast</h2>
            </div>
            <button
              type="button"
              onClick={handleViewPipeline}
              className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Pipeline Details
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <button
              type="button"
              onClick={() => handleForecastClick('offers')}
              className="rounded-lg border border-glass-border bg-bg-glass p-4 text-left transition-colors hover:bg-accent/10 hover:border-accent/50 focus:outline-none focus:ring-2 focus:ring-accent"
              title="View active offers"
            >
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Pending Offers</div>
              <div className="text-3xl font-mono font-semibold text-foreground">{activeOffersCount}</div>
              <div className="text-xs text-muted-foreground mt-1">Awaiting candidate decision</div>
            </button>
            <button
              type="button"
              onClick={() => handleForecastClick('openReqs')}
              className="rounded-lg border border-glass-border bg-bg-glass p-4 text-left transition-colors hover:bg-accent/10 hover:border-accent/50 focus:outline-none focus:ring-2 focus:ring-accent"
              title="View open requisitions"
            >
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Open Reqs</div>
              <div className="text-3xl font-mono font-semibold text-warn">{openReqsCount}</div>
              <div className="text-xs text-muted-foreground mt-1">Requisitions needing hires</div>
            </button>
            <button
              type="button"
              onClick={() => setShowConfidenceBreakdown(true)}
              className="rounded-lg border border-glass-border bg-bg-glass p-4 text-left transition-colors hover:bg-accent/10 hover:border-accent/50 focus:outline-none focus:ring-2 focus:ring-accent"
              title="View confidence breakdown"
            >
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Confidence</div>
              <div className={`text-3xl font-mono font-semibold ${
                confidenceBreakdown.level === 'HIGH' ? 'text-good' :
                confidenceBreakdown.level === 'MED' ? 'text-warn' : 'text-bad'
              }`}>
                {confidenceBreakdown.level}
              </div>
              <div className="text-xs text-muted-foreground mt-1">Click to see breakdown</div>
            </button>
          </div>
        </section>

        {/* Pipeline & Capacity Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <PipelineFunnelV2
              stages={pipelineStages}
              benchmarks={dataStore.config?.pipelineBenchmarks}
              onStageClick={handlePipelineStageClick}
            />
          </div>
          <div>
            <TeamCapacityPanelV2
              teams={teamCapacity}
              recruiters={recruiterDetails}
              onViewAll={handleViewCapacityPlanning}
              isComplexityWeighted={!!(capacityAnalysis && !capacityAnalysis.blocked)}
            />
          </div>
        </div>
      </main>

      {/* Pipeline Stage Drill-Down Modal */}
      <DataDrillDownModal
        isOpen={pipelineDrillDown.isOpen}
        onClose={handleClosePipelineDrillDown}
        title={`${pipelineDrillDown.stageName} Stage Candidates`}
        type="pipelineStage"
        records={pipelineDrillDownRecords}
        totalValue={pipelineDrillDown.stageCount}
      />

      {/* Forecast Drill-Down Modal */}
      <DataDrillDownModal
        isOpen={forecastDrillDown.isOpen}
        onClose={handleCloseForecastDrillDown}
        title={forecastDrillDown.type === 'offers' ? 'Active Offers' : 'Open Requisitions'}
        type={forecastDrillDown.type === 'offers' ? 'offers' : 'openReqs'}
        records={forecastDrillDownRecords}
      />

      {/* KPI Drill-Down Modal */}
      {kpiDrillDownConfig && (
        <DataDrillDownModal
          isOpen={kpiDrillDown.isOpen}
          onClose={handleCloseKpiDrillDown}
          title={kpiDrillDownConfig.title}
          type={kpiDrillDownConfig.type}
          records={kpiDrillDownRecords}
        />
      )}

      {/* Confidence Breakdown Modal */}
      {showConfidenceBreakdown && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={(e) => e.target === e.currentTarget && setShowConfidenceBreakdown(false)}
        >
          <div className="w-full max-w-md mx-4 bg-[var(--color-bg-surface)] rounded-lg overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 border-b border-glass-border flex justify-between items-center">
              <div>
                <h5 className="text-lg font-semibold">Pipeline Confidence</h5>
                <p className="text-xs text-muted-foreground">How we calculate forecast reliability</p>
              </div>
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground"
                onClick={() => setShowConfidenceBreakdown(false)}
              >
                <span className="text-2xl">&times;</span>
              </button>
            </div>

            {/* Overall Score */}
            <div className="px-4 py-4 border-b border-glass-border bg-muted/30">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">Overall Score</span>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground">{Math.round(confidenceBreakdown.avgScore)}/100</span>
                  <span className={`text-2xl font-mono font-bold ${
                    confidenceBreakdown.level === 'HIGH' ? 'text-good' :
                    confidenceBreakdown.level === 'MED' ? 'text-warn' : 'text-bad'
                  }`}>
                    {confidenceBreakdown.level}
                  </span>
                </div>
              </div>
            </div>

            {/* Factors */}
            <div className="px-4 py-3 space-y-3 max-h-[400px] overflow-y-auto">
              {confidenceBreakdown.factors.map((factor, idx) => (
                <div key={idx} className="p-3 rounded-lg bg-muted/20 border border-glass-border">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-foreground">{factor.label}</span>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-mono font-semibold ${
                        factor.status === 'good' ? 'text-good' :
                        factor.status === 'warn' ? 'text-warn' : 'text-bad'
                      }`}>
                        {factor.value}
                      </span>
                      <div className={`w-2 h-2 rounded-full ${
                        factor.status === 'good' ? 'bg-good' :
                        factor.status === 'warn' ? 'bg-warn' : 'bg-bad'
                      }`} />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">{factor.explanation}</p>
                  {/* Progress bar */}
                  <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        factor.status === 'good' ? 'bg-good' :
                        factor.status === 'warn' ? 'bg-warn' : 'bg-bad'
                      }`}
                      style={{ width: `${Math.min(100, factor.score)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="px-4 py-3 border-t border-glass-border">
              <p className="text-xs text-muted-foreground">
                Confidence reflects how reliable the forecast is based on pipeline health, conversion rates, and req status.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* All Actions Modal */}
      {showAllActions && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
          onClick={(e) => e.target === e.currentTarget && setShowAllActions(false)}
        >
          <div className="w-full max-w-3xl bg-[var(--color-bg-surface)] rounded-xl overflow-hidden max-h-[85vh] flex flex-col shadow-2xl">
            {/* Header */}
            <div className="px-6 py-4 border-b border-glass-border flex justify-between items-center shrink-0 bg-muted/30">
              <div>
                <h5 className="text-xl font-semibold flex items-center gap-2 text-foreground">
                  <Zap className="h-5 w-5 text-accent" />
                  Action Queue
                </h5>
                <p className="text-sm text-muted-foreground mt-0.5">{actionCount} actions requiring attention</p>
              </div>
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-muted/50 transition-colors"
                onClick={() => setShowAllActions(false)}
              >
                <span className="text-2xl leading-none">&times;</span>
              </button>
            </div>

            {/* Actions List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {openActions.map((action) => {
                const priorityColor = action.priority === 'P0' ? 'border-l-bad' : action.priority === 'P1' ? 'border-l-warn' : 'border-l-good';
                const priorityBg = action.priority === 'P0' ? 'bg-bad/5' : action.priority === 'P1' ? 'bg-warn/5' : 'bg-good/5';
                const priorityLabel = action.priority === 'P0' ? 'Urgent' : action.priority === 'P1' ? 'High' : 'Normal';
                const ownerLabel = action.owner_type === 'HIRING_MANAGER' ? 'Hiring Manager' : action.owner_type === 'RECRUITER' ? 'Recruiter' : 'TA Ops';
                return (
                  <div
                    key={action.action_id}
                    className={`rounded-lg border border-glass-border ${priorityBg} border-l-4 ${priorityColor} overflow-hidden`}
                  >
                    {/* Card Header */}
                    <div className="px-4 py-3 flex items-center justify-between gap-4 bg-muted/20">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-base font-semibold text-foreground truncate">{action.title}</span>
                        <span className={`shrink-0 px-2 py-0.5 rounded text-xs font-medium ${
                          action.priority === 'P0' ? 'bg-bad/20 text-bad' :
                          action.priority === 'P1' ? 'bg-warn/20 text-warn' : 'bg-good/20 text-good'
                        }`}>
                          {priorityLabel}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          saveActionState(datasetId, action.action_id, 'DONE');
                          setActionUpdateCounter(c => c + 1);
                        }}
                        className="shrink-0 rounded-lg px-4 py-2 text-sm font-medium bg-good/10 text-good hover:bg-good/20 transition-colors flex items-center gap-2"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        Mark Done
                      </button>
                    </div>

                    {/* Card Body */}
                    <div className="px-4 py-3 space-y-3">
                      {/* Key details in a clean row */}
                      <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
                        {action.candidate_name && (
                          <div>
                            <span className="text-muted-foreground">Candidate:</span>{' '}
                            <span className="text-foreground font-medium">{action.candidate_name}</span>
                          </div>
                        )}
                        {action.req_title && (
                          <div>
                            <span className="text-muted-foreground">Req:</span>{' '}
                            <span className="text-foreground font-medium">{action.req_title}</span>
                          </div>
                        )}
                        <div>
                          <span className="text-muted-foreground">Owner:</span>{' '}
                          <span className="text-foreground">{action.owner_name || ownerLabel}</span>
                        </div>
                      </div>

                      {/* Status badge */}
                      {action.evidence?.short_reason && (
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-muted/40 text-sm">
                          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-foreground">{action.evidence.short_reason}</span>
                        </div>
                      )}

                      {/* Recommended action */}
                      {action.recommended_steps && action.recommended_steps.length > 0 && (
                        <div className="pt-2 border-t border-glass-border/50">
                          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Next Step</div>
                          {action.recommended_steps.map((step, stepIdx) => (
                            <p key={stepIdx} className="text-sm text-foreground leading-relaxed">
                              {step}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-glass-border shrink-0 bg-muted/20">
              <p className="text-xs text-muted-foreground">
                Actions are generated from HM pending reviews, system recommendations, and Ask PlatoVue action plans.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Single Action Detail Modal */}
      {selectedAction && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
          onClick={(e) => e.target === e.currentTarget && setSelectedAction(null)}
        >
          <div className="w-full max-w-lg bg-[var(--color-bg-surface)] rounded-xl overflow-hidden shadow-2xl">
            {/* Header with priority indicator */}
            <div className={`px-6 py-4 border-b-4 ${
              selectedAction.priority === 'P0' ? 'border-b-bad bg-bad/10' :
              selectedAction.priority === 'P1' ? 'border-b-warn bg-warn/10' : 'border-b-good bg-good/10'
            }`}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                      selectedAction.priority === 'P0' ? 'bg-bad/20 text-bad' :
                      selectedAction.priority === 'P1' ? 'bg-warn/20 text-warn' : 'bg-good/20 text-good'
                    }`}>
                      {selectedAction.priority === 'P0' ? 'Urgent' : selectedAction.priority === 'P1' ? 'High Priority' : 'Normal'}
                    </span>
                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-muted text-muted-foreground">
                      {selectedAction.owner_type === 'HIRING_MANAGER' ? 'Hiring Manager' : selectedAction.owner_type === 'RECRUITER' ? 'Recruiter' : 'TA Ops'}
                    </span>
                  </div>
                  <h3 className="text-xl font-semibold text-foreground">{selectedAction.title}</h3>
                </div>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-muted/50 transition-colors"
                  onClick={() => setSelectedAction(null)}
                >
                  <span className="text-2xl leading-none">&times;</span>
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="px-6 py-5 space-y-5">
              {/* Context Section */}
              <div className="space-y-3">
                {selectedAction.candidate_name && (
                  <div className="flex items-center gap-3">
                    <div className="w-24 text-sm text-muted-foreground">Candidate</div>
                    <div className="text-sm font-medium text-foreground">{selectedAction.candidate_name}</div>
                  </div>
                )}
                {selectedAction.req_title && (
                  <div className="flex items-center gap-3">
                    <div className="w-24 text-sm text-muted-foreground">Requisition</div>
                    <div className="text-sm font-medium text-foreground">{selectedAction.req_title}</div>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <div className="w-24 text-sm text-muted-foreground">Owner</div>
                  <div className="text-sm text-foreground">{selectedAction.owner_name || 'Unassigned'}</div>
                </div>
              </div>

              {/* Status */}
              {selectedAction.evidence?.short_reason && (
                <div className="p-4 rounded-lg bg-muted/30 border border-glass-border">
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Status:</span>
                    <span className="font-medium text-foreground">{selectedAction.evidence.short_reason}</span>
                  </div>
                </div>
              )}

              {/* What to do */}
              {selectedAction.recommended_steps && selectedAction.recommended_steps.length > 0 && (
                <div>
                  <div className="text-sm font-semibold text-foreground mb-3">What to do</div>
                  <div className="space-y-2">
                    {selectedAction.recommended_steps.map((step, idx) => (
                      <div key={idx} className="flex items-start gap-3 p-3 rounded-lg bg-accent/5 border border-accent/20">
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-accent/20 text-accent text-xs font-semibold flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <p className="text-sm text-foreground leading-relaxed pt-0.5">{step}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="px-6 py-4 border-t border-glass-border bg-muted/20 flex items-center justify-between gap-4">
              <button
                type="button"
                onClick={() => setSelectedAction(null)}
                className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  saveActionState(datasetId, selectedAction.action_id, 'DONE');
                  setActionUpdateCounter(c => c + 1);
                  setSelectedAction(null);
                }}
                className="px-5 py-2.5 rounded-lg text-sm font-semibold bg-good text-white hover:bg-good/90 transition-colors flex items-center gap-2"
              >
                <CheckCircle2 className="h-4 w-4" />
                Mark as Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
