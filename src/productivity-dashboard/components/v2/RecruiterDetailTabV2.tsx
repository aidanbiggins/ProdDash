'use client';

import React, { useMemo, useState } from 'react';
import {
  ComposedChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend, Area
} from 'recharts';
import { startOfWeek, endOfWeek, eachWeekOfInterval, isSameWeek, subWeeks, format, differenceInDays } from 'date-fns';
import {
  TrendingUp, TrendingDown, Minus, Download, HelpCircle, User, Briefcase, Settings,
  ArrowUpDown, ArrowUp, ArrowDown, Activity
} from 'lucide-react';
import { useDashboard } from '../../hooks/useDashboardContext';
import { RecruiterSummary, Requisition, Candidate, Event as DashboardEvent, User as UserType, ReqDetail, EventType, CanonicalStage, RequisitionStatus } from '../../types';
import { DataDrillDownModal, DrillDownType, buildHiresRecords, buildOffersRecords, buildReqsRecords, buildTTFRecords } from '../common/DataDrillDownModal';
import { METRIC_FORMULAS } from '../common/MetricDrillDown';
import { exportReqListCSV, normalizeStage } from '../../services';
import { useIsMobile } from '../../hooks/useIsMobile';

interface RecruiterDetailTabV2Props {
  onSelectRecruiter?: (id: string | null) => void;
}

// V0 Design: KPI Card Component
function KPICardV2({
  label,
  value,
  subtitle,
  trend,
  priorValue,
  priorLabel,
  onClick
}: {
  label: string;
  value: string | number;
  subtitle?: string;
  trend?: 'up' | 'down' | 'neutral';
  priorValue?: string | number;
  priorLabel?: string;
  onClick?: () => void;
}) {
  const trendColor = trend === 'up' ? 'text-good' : trend === 'down' ? 'text-bad' : 'text-muted-foreground';
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;

  return (
    <button
      type="button"
      onClick={onClick}
      className="glass-panel p-4 text-left transition-all hover:bg-white/[0.04] hover:border-white/[0.12] flex-1 min-w-0 group"
    >
      <div className="text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
        {label}
      </div>
      <div className="w-8 h-0.5 bg-[#06b6d4] mb-3" />
      <div className="font-mono text-3xl font-bold text-foreground tracking-tight mb-1">
        {value}
      </div>
      {priorValue !== undefined && (
        <div className={`flex items-center gap-1 text-xs ${trendColor}`}>
          {trend && <TrendIcon className="w-3 h-3" />}
          <span>vs {priorValue}</span>
          <span className="text-muted-foreground">{priorLabel || 'prior period'}</span>
        </div>
      )}
      {subtitle && !priorValue && (
        <div className="text-xs text-muted-foreground">{subtitle}</div>
      )}
    </button>
  );
}

// V0 Design: Section Header (per V0_UI_LANGUAGE.md spec)
function SectionHeaderV2({
  title,
  subtitle,
  actions
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/[0.08]">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">
          {title}
        </h3>
      </div>
      {subtitle && <span className="text-[10px] text-muted-foreground">{subtitle}</span>}
      {actions}
    </div>
  );
}

// Helper to calculate weekly activity
function calculateWeeklyActivity(
  events: DashboardEvent[],
  recruiterId: string | null,
  stageMapping: any,
  requisitions: Requisition[],
  candidates: Candidate[],
  complexityScores?: Map<string, { totalScore: number }>,
  weeksBack = 12
) {
  const end = new Date();
  const start = subWeeks(end, weeksBack);
  const weeks = eachWeekOfInterval({ start, end });

  const relevantEvents = recruiterId
    ? events.filter(e => e.actor_user_id === recruiterId)
    : events;

  const recruiterReqs = recruiterId
    ? requisitions.filter(r => r.recruiter_id === recruiterId)
    : requisitions;
  const recruiterReqIds = new Set(recruiterReqs.map(r => r.req_id));
  const recruiterCandidates = candidates.filter(c => recruiterReqIds.has(c.req_id));

  return weeks.map(weekStart => {
    const weekEnd = endOfWeek(weekStart);
    const weekEvents = relevantEvents.filter(e => isSameWeek(e.event_at, weekStart));

    const hiresThisWeek = recruiterCandidates.filter(c =>
      c.hired_at && isSameWeek(c.hired_at, weekStart)
    );
    const hires = hiresThisWeek.length;

    const weightedHires = hiresThisWeek.reduce((sum, c) => {
      return sum + (complexityScores?.get(c.req_id)?.totalScore || 1);
    }, 0);

    const openReqCount = recruiterReqs.filter(r => {
      if (!r.opened_at) return false;
      const openedBefore = r.opened_at <= weekEnd;
      const notClosedYet = !r.closed_at || r.closed_at >= weekStart;
      return openedBefore && notClosedYet && r.status !== RequisitionStatus.Canceled;
    }).length;

    const productivityIndex = openReqCount > 0 ? weightedHires / openReqCount : null;

    return {
      name: format(weekStart, 'MMM d'),
      screens: weekEvents.filter(e => e.event_type === EventType.SCREEN_COMPLETED).length,
      submittals: weekEvents.filter(e => {
        if (e.event_type !== EventType.STAGE_CHANGE) return false;
        return normalizeStage(e.to_stage, stageMapping) === CanonicalStage.HM_SCREEN;
      }).length,
      hires,
      weightedHires,
      openReqCount,
      productivityIndex
    };
  });
}

export function RecruiterDetailTabV2({ onSelectRecruiter }: RecruiterDetailTabV2Props) {
  const { state, selectRecruiter } = useDashboard();
  const { overview, filters, dataStore } = state;
  const { candidates, requisitions, users, events, config } = dataStore;

  const isMobile = useIsMobile();
  const chartHeight = isMobile ? 200 : 260;

  const [drillDown, setDrillDown] = useState<{
    isOpen: boolean;
    type: DrillDownType;
    title: string;
    formula?: string;
    totalValue?: string | number;
  } | null>(null);

  // Filter requisitions based on master filters
  const filteredRequisitions = useMemo(() => {
    return requisitions.filter(r => {
      if (filters?.recruiterIds?.length && !filters.recruiterIds.includes(r.recruiter_id || '')) return false;
      if (filters?.functions?.length && !filters.functions.includes(r.function)) return false;
      if (filters?.jobFamilies?.length && !filters.jobFamilies.includes(r.job_family || '')) return false;
      if (filters?.levels?.length && !filters.levels.includes(r.level || '')) return false;
      if (filters?.regions?.length && !filters.regions.includes(r.location_region)) return false;
      if (filters?.hiringManagerIds?.length && !filters.hiringManagerIds.includes(r.hiring_manager_id || '')) return false;
      return true;
    });
  }, [requisitions, filters]);

  // Get recruiter IDs that have matching requisitions
  const recruiterIdsWithData = useMemo(() => {
    return new Set(filteredRequisitions.map(r => r.recruiter_id).filter(Boolean));
  }, [filteredRequisitions]);

  // Filter recruiter summaries
  const filteredRecruiterSummaries = useMemo(() => {
    if (!overview?.recruiterSummaries) return [];
    if (filters?.recruiterIds?.length) {
      return overview.recruiterSummaries.filter(r => filters.recruiterIds!.includes(r.recruiterId));
    }
    return overview.recruiterSummaries.filter(r => recruiterIdsWithData.has(r.recruiterId));
  }, [overview?.recruiterSummaries, filters, recruiterIdsWithData]);

  // Effective selected recruiter
  const effectiveSelectedRecruiterId = useMemo(() => {
    if (filters?.recruiterIds?.length === 1) {
      return filters.recruiterIds[0];
    }
    if (state.selectedRecruiterId && !filteredRecruiterSummaries.some(r => r.recruiterId === state.selectedRecruiterId)) {
      return null;
    }
    return state.selectedRecruiterId;
  }, [filters, state.selectedRecruiterId, filteredRecruiterSummaries]);

  // Get selected recruiter or aggregate all
  const detail = useMemo<RecruiterSummary | null>(() => {
    if (effectiveSelectedRecruiterId) {
      return filteredRecruiterSummaries.find(r => r.recruiterId === effectiveSelectedRecruiterId) || null;
    }
    if (filteredRecruiterSummaries.length === 0) return null;

    // Aggregate all filtered recruiters
    const aggregated: RecruiterSummary = {
      recruiterId: 'all',
      recruiterName: 'All Recruiters',
      team: null,
      outcomes: {
        hires: filteredRecruiterSummaries.reduce((sum, r) => sum + r.outcomes.hires, 0),
        offersExtended: filteredRecruiterSummaries.reduce((sum, r) => sum + r.outcomes.offersExtended, 0),
        offersAccepted: filteredRecruiterSummaries.reduce((sum, r) => sum + r.outcomes.offersAccepted, 0),
        offerAcceptanceRate: null,
        timeToFillMedian: null
      },
      executionVolume: {
        outreachSent: filteredRecruiterSummaries.reduce((sum, r) => sum + r.executionVolume.outreachSent, 0),
        screensCompleted: filteredRecruiterSummaries.reduce((sum, r) => sum + r.executionVolume.screensCompleted, 0),
        submittalsToHM: filteredRecruiterSummaries.reduce((sum, r) => sum + r.executionVolume.submittalsToHM, 0),
        interviewLoopsScheduled: filteredRecruiterSummaries.reduce((sum, r) => sum + r.executionVolume.interviewLoopsScheduled, 0),
        followUpVelocityMedian: null
      },
      funnelConversion: filteredRecruiterSummaries[0]?.funnelConversion || {
        screenToHmScreen: { entered: 0, converted: 0, rate: null, fromStage: 'SCREEN' as any, toStage: 'HM_SCREEN' as any },
        hmScreenToOnsite: { entered: 0, converted: 0, rate: null, fromStage: 'HM_SCREEN' as any, toStage: 'ONSITE' as any },
        onsiteToOffer: { entered: 0, converted: 0, rate: null, fromStage: 'ONSITE' as any, toStage: 'OFFER' as any },
        offerToHired: { entered: 0, converted: 0, rate: null, fromStage: 'OFFER' as any, toStage: 'HIRED' as any }
      },
      aging: {
        openReqCount: filteredRecruiterSummaries.reduce((sum, r) => sum + r.aging.openReqCount, 0),
        agingBuckets: [],
        stalledReqs: {
          count: filteredRecruiterSummaries.reduce((sum, r) => sum + r.aging.stalledReqs.count, 0),
          threshold: 30,
          reqIds: filteredRecruiterSummaries.flatMap(r => r.aging.stalledReqs.reqIds)
        }
      },
      weighted: {
        weightedHires: filteredRecruiterSummaries.reduce((sum, r) => sum + r.weighted.weightedHires, 0),
        weightedOffers: filteredRecruiterSummaries.reduce((sum, r) => sum + r.weighted.weightedOffers, 0),
        offerMultiplier: 1,
        complexityScores: filteredRecruiterSummaries.flatMap(r => r.weighted.complexityScores)
      },
      timeAttribution: filteredRecruiterSummaries[0]?.timeAttribution || {
        recruiterControlledTime: { leadToFirstAction: null, screenToSubmittal: null },
        hmControlledTime: { feedbackLatency: null, decisionLatency: null },
        opsControlledTime: { offerApprovalLatency: null, available: false }
      },
      productivityIndex: filteredRecruiterSummaries.length > 0
        ? filteredRecruiterSummaries.reduce((sum, r) => sum + r.productivityIndex, 0) / filteredRecruiterSummaries.length
        : 0,
      activeReqLoad: filteredRecruiterSummaries.reduce((sum, r) => sum + r.activeReqLoad, 0)
    };

    if (aggregated.outcomes.offersExtended > 0) {
      aggregated.outcomes.offerAcceptanceRate = aggregated.outcomes.offersAccepted / aggregated.outcomes.offersExtended;
    }

    // Aggregate funnel rates
    const stages = ['screenToHmScreen', 'hmScreenToOnsite', 'onsiteToOffer', 'offerToHired'] as const;
    stages.forEach(stage => {
      let totalEntered = 0;
      let totalConverted = 0;
      filteredRecruiterSummaries.forEach(r => {
        totalEntered += r.funnelConversion[stage].entered;
        totalConverted += r.funnelConversion[stage].converted;
      });
      aggregated.funnelConversion[stage].entered = totalEntered;
      aggregated.funnelConversion[stage].converted = totalConverted;
      aggregated.funnelConversion[stage].rate = totalEntered > 0 ? totalConverted / totalEntered : 0;
    });

    // Aggregate aging buckets
    const bucketMap = new Map<string, { label: string; min: number; max: number | null; count: number; reqIds: string[] }>();
    filteredRecruiterSummaries.forEach(r => {
      r.aging.agingBuckets.forEach(bucket => {
        const existing = bucketMap.get(bucket.label);
        if (existing) {
          existing.count += bucket.count;
          existing.reqIds.push(...bucket.reqIds);
        } else {
          bucketMap.set(bucket.label, { ...bucket, reqIds: [...bucket.reqIds] });
        }
      });
    });
    aggregated.aging.agingBuckets = Array.from(bucketMap.values()).sort((a, b) => a.min - b.min);

    return aggregated;
  }, [filteredRecruiterSummaries, effectiveSelectedRecruiterId]);

  // Get prior period data for the selected recruiter (or aggregate)
  const priorPeriod = useMemo(() => {
    if (!overview?.recruiterPriorPeriods) return null;

    if (effectiveSelectedRecruiterId && overview.recruiterPriorPeriods[effectiveSelectedRecruiterId]) {
      return overview.recruiterPriorPeriods[effectiveSelectedRecruiterId];
    }

    // For "All Recruiters", use overview-level prior period
    if (!effectiveSelectedRecruiterId && overview.priorPeriod) {
      return overview.priorPeriod;
    }

    return null;
  }, [overview?.recruiterPriorPeriods, overview?.priorPeriod, effectiveSelectedRecruiterId]);

  // Team benchmarks
  const teamBenchmarks = useMemo(() => {
    if (filteredRecruiterSummaries.length === 0) return null;
    const stages = ['screenToHmScreen', 'hmScreenToOnsite', 'onsiteToOffer', 'offerToHired'] as const;
    const aggregates: Record<string, number> = {};
    stages.forEach(stage => {
      let totalEntered = 0;
      let totalConverted = 0;
      filteredRecruiterSummaries.forEach(r => {
        totalEntered += r.funnelConversion[stage].entered;
        totalConverted += r.funnelConversion[stage].converted;
      });
      aggregates[stage] = totalEntered > 0 ? (totalConverted / totalEntered) * 100 : 0;
    });
    return {
      screenToHm: aggregates.screenToHmScreen,
      hmToOnsite: aggregates.hmScreenToOnsite,
      onsiteToOffer: aggregates.onsiteToOffer,
      offerToHired: aggregates.offerToHired
    };
  }, [filteredRecruiterSummaries]);

  // Complexity scores map
  const complexityScoresMap = useMemo(() => {
    const map = new Map<string, { totalScore: number }>();
    const summaries = effectiveSelectedRecruiterId
      ? filteredRecruiterSummaries.filter(r => r.recruiterId === effectiveSelectedRecruiterId)
      : filteredRecruiterSummaries;
    summaries.forEach(r => {
      r.weighted.complexityScores.forEach(cs => {
        map.set(cs.reqId, { totalScore: cs.totalScore });
      });
    });
    return map;
  }, [filteredRecruiterSummaries, effectiveSelectedRecruiterId]);

  // Activity data
  const activityData = useMemo(() => {
    return calculateWeeklyActivity(
      events,
      effectiveSelectedRecruiterId === 'all' ? null : effectiveSelectedRecruiterId,
      config.stageMapping,
      filteredRequisitions,
      candidates,
      complexityScoresMap
    );
  }, [events, effectiveSelectedRecruiterId, config.stageMapping, filteredRequisitions, candidates, complexityScoresMap]);

  const openDrillDown = (type: DrillDownType, title: string, totalValue?: string | number) => {
    const formulaInfo = METRIC_FORMULAS[type] || { formula: 'Custom calculation' };
    setDrillDown({ isOpen: true, type, title, formula: formulaInfo.formula, totalValue });
  };

  // Filter candidates/requisitions for selected recruiter
  const recruiterCandidates = useMemo(() => {
    if (!effectiveSelectedRecruiterId) return candidates;
    const recruiterReqIds = new Set(filteredRequisitions.filter(r => r.recruiter_id === effectiveSelectedRecruiterId).map(r => r.req_id));
    return candidates.filter(c => recruiterReqIds.has(c.req_id));
  }, [candidates, filteredRequisitions, effectiveSelectedRecruiterId]);

  const recruiterRequisitions = useMemo(() => {
    if (!effectiveSelectedRecruiterId) return filteredRequisitions;
    return filteredRequisitions.filter(r => r.recruiter_id === effectiveSelectedRecruiterId);
  }, [filteredRequisitions, effectiveSelectedRecruiterId]);

  // Drill-down records
  const getDrillDownRecords = useMemo(() => {
    if (!drillDown || !detail) return [];
    switch (drillDown.type) {
      case 'hires': return buildHiresRecords(recruiterCandidates, recruiterRequisitions, users);
      case 'weightedHires': return buildHiresRecords(recruiterCandidates, recruiterRequisitions, users, complexityScoresMap as any);
      case 'offers': return buildOffersRecords(recruiterCandidates, recruiterRequisitions, users);
      case 'offerAcceptRate': return buildOffersRecords(recruiterCandidates, recruiterRequisitions, users);
      case 'medianTTF': return buildTTFRecords(recruiterCandidates, recruiterRequisitions, users);
      case 'openReqs': return buildReqsRecords(recruiterRequisitions.filter(r => r.status === 'Open'), users);
      case 'stalledReqs':
        const stalledReqIds = new Set(detail.aging.stalledReqs.reqIds);
        return buildReqsRecords(recruiterRequisitions.filter(r => stalledReqIds.has(r.req_id)), users);
      default: return [];
    }
  }, [drillDown, recruiterCandidates, recruiterRequisitions, users, complexityScoresMap, detail]);

  // Sorting state
  const [sortColumn, setSortColumn] = useState<string>('ageInDays');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection(['ageInDays', 'candidateCount', 'complexityScore'].includes(column) ? 'desc' : 'asc');
    }
  };

  if (!detail) {
    return (
      <div className="glass-panel p-8 text-center">
        <Activity className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-foreground mb-2">Recruiter Performance</h3>
        <p className="text-sm text-muted-foreground">No recruiter data available</p>
      </div>
    );
  }

  // Build req details
  const now = new Date();
  const recruiterReqs = effectiveSelectedRecruiterId
    ? filteredRequisitions.filter(r => r.recruiter_id === effectiveSelectedRecruiterId)
    : filteredRequisitions;

  const reqDetails: ReqDetail[] = recruiterReqs.map(req => {
    const reqCandidates = candidates.filter(c => c.req_id === req.req_id);
    const reqEvents = events.filter(e => e.req_id === req.req_id);
    const lastEvent = reqEvents.length > 0
      ? reqEvents.reduce((latest, e) => e.event_at > latest.event_at ? e : latest)
      : null;

    const stageDistribution: Record<string, number> = {};
    reqCandidates.forEach(c => {
      stageDistribution[c.current_stage] = (stageDistribution[c.current_stage] || 0) + 1;
    });

    const ageInDays = req.opened_at ? differenceInDays(now, req.opened_at) : 0;
    const isStalled = detail.aging.stalledReqs.reqIds.includes(req.req_id);
    const complexityEntry = detail.weighted.complexityScores.find(cs => cs.reqId === req.req_id);
    const hmUser = users.find(u => u.user_id === req.hiring_manager_id);

    return {
      req,
      candidateCount: reqCandidates.length,
      stageDistribution,
      lastActivityAt: lastEvent?.event_at || null,
      lastActivityType: lastEvent?.event_type || null,
      complexityScore: complexityEntry?.totalScore || 1,
      isStalled,
      ageInDays,
      hmName: hmUser?.name || req.hiring_manager_id,
      delayContributor: 'None' as const,
      delayDays: 0
    };
  });

  // Sort req details
  const sortedReqDetails = [...reqDetails].sort((a, b) => {
    let aVal: any, bVal: any;
    switch (sortColumn) {
      case 'title': aVal = a.req.req_title; bVal = b.req.req_title; break;
      case 'level': aVal = a.req.level; bVal = b.req.level; break;
      case 'hmName': aVal = a.hmName; bVal = b.hmName; break;
      case 'ageInDays': aVal = a.ageInDays; bVal = b.ageInDays; break;
      case 'candidateCount': aVal = a.candidateCount; bVal = b.candidateCount; break;
      case 'complexityScore': aVal = a.complexityScore; bVal = b.complexityScore; break;
      case 'status': aVal = a.req.status; bVal = b.req.status; break;
      default: aVal = a.ageInDays; bVal = b.ageInDays;
    }
    if (aVal === bVal) return 0;
    if (aVal === null) return 1;
    if (bVal === null) return -1;
    if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
    return sortDirection === 'asc' ? 1 : -1;
  });

  // Funnel data
  const useDetailAsBenchmark = !effectiveSelectedRecruiterId;
  const funnelData = [
    {
      name: 'Screen → HM',
      rate: (detail.funnelConversion.screenToHmScreen.rate ?? 0) * 100,
      benchmark: useDetailAsBenchmark ? (detail.funnelConversion.screenToHmScreen.rate ?? 0) * 100 : (teamBenchmarks?.screenToHm || 0)
    },
    {
      name: 'HM → Onsite',
      rate: (detail.funnelConversion.hmScreenToOnsite.rate ?? 0) * 100,
      benchmark: useDetailAsBenchmark ? (detail.funnelConversion.hmScreenToOnsite.rate ?? 0) * 100 : (teamBenchmarks?.hmToOnsite || 0)
    },
    {
      name: 'Onsite → Offer',
      rate: (detail.funnelConversion.onsiteToOffer.rate ?? 0) * 100,
      benchmark: useDetailAsBenchmark ? (detail.funnelConversion.onsiteToOffer.rate ?? 0) * 100 : (teamBenchmarks?.onsiteToOffer || 0)
    },
    {
      name: 'Offer → Hired',
      rate: (detail.funnelConversion.offerToHired.rate ?? 0) * 100,
      benchmark: useDetailAsBenchmark ? (detail.funnelConversion.offerToHired.rate ?? 0) * 100 : (teamBenchmarks?.offerToHired || 0)
    }
  ];

  // Aging data
  const agingData = detail.aging.agingBuckets.map(b => ({ name: b.label, count: b.count }));

  const handleExportReqs = () => exportReqListCSV(reqDetails);

  const SortHeader = ({ column, label, align = 'left' }: { column: string; label: string; align?: 'left' | 'right' }) => (
    <th
      className={`px-3 py-2 text-[10px] font-semibold uppercase tracking-wider cursor-pointer select-none ${
        align === 'right' ? 'text-right' : 'text-left'
      } ${sortColumn === column ? 'text-accent' : 'text-muted-foreground'}`}
      onClick={() => handleSort(column)}
    >
      <div className={`flex items-center gap-1 ${align === 'right' ? 'justify-end' : ''}`}>
        {label}
        {sortColumn === column ? (
          sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
        ) : (
          <ArrowUpDown className="w-3 h-3 opacity-40" />
        )}
      </div>
    </th>
  );

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-foreground tracking-tight">
              {detail.recruiterName === 'All Recruiters' ? 'Recruiter Performance' : detail.recruiterName}
            </h2>
            <button type="button" className="p-1 rounded hover:bg-white/[0.06] text-muted-foreground">
              <HelpCircle className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            Analyze individual recruiter metrics and pipeline health
          </p>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="flex gap-3 overflow-x-auto pb-1">
        <KPICardV2
          label="Hires"
          value={detail.outcomes.hires}
          priorValue={priorPeriod ? priorPeriod.hires : undefined}
          priorLabel={priorPeriod?.label}
          trend={priorPeriod ? (detail.outcomes.hires > priorPeriod.hires ? 'up' : detail.outcomes.hires < priorPeriod.hires ? 'down' : 'neutral') : undefined}
          onClick={() => openDrillDown('hires', 'Hires', detail.outcomes.hires)}
        />
        <KPICardV2
          label="Weighted Hires"
          value={detail.weighted.weightedHires.toFixed(1)}
          priorValue={priorPeriod ? priorPeriod.weightedHires.toFixed(1) : undefined}
          priorLabel={priorPeriod?.label}
          trend={priorPeriod ? (detail.weighted.weightedHires > priorPeriod.weightedHires ? 'up' : detail.weighted.weightedHires < priorPeriod.weightedHires ? 'down' : 'neutral') : undefined}
          onClick={() => openDrillDown('weightedHires', 'Weighted Hires', detail.weighted.weightedHires.toFixed(1))}
        />
        <KPICardV2
          label="Offers"
          value={detail.outcomes.offersExtended}
          priorValue={priorPeriod ? priorPeriod.offers : undefined}
          priorLabel={priorPeriod?.label}
          trend={priorPeriod ? (detail.outcomes.offersExtended > priorPeriod.offers ? 'up' : detail.outcomes.offersExtended < priorPeriod.offers ? 'down' : 'neutral') : undefined}
          onClick={() => openDrillDown('offers', 'Offers', detail.outcomes.offersExtended)}
        />
        <KPICardV2
          label="Accept Rate"
          value={detail.outcomes.offerAcceptanceRate !== null
            ? `${(detail.outcomes.offerAcceptanceRate * 100).toFixed(0)}%`
            : 'N/A'}
          priorValue={priorPeriod && priorPeriod.acceptRate !== null
            ? `${(priorPeriod.acceptRate * 100).toFixed(0)}%`
            : undefined}
          priorLabel={priorPeriod?.label}
          trend={priorPeriod && priorPeriod.acceptRate !== null && detail.outcomes.offerAcceptanceRate !== null
            ? (detail.outcomes.offerAcceptanceRate > priorPeriod.acceptRate ? 'up' : detail.outcomes.offerAcceptanceRate < priorPeriod.acceptRate ? 'down' : 'neutral')
            : undefined}
          onClick={() => openDrillDown('offerAcceptRate', 'Offer Accept Rate')}
        />
        <KPICardV2
          label="Open Reqs"
          value={detail.aging.openReqCount}
          onClick={() => openDrillDown('openReqs', 'Open Requisitions', detail.aging.openReqCount)}
        />
        <KPICardV2
          label="Stalled"
          value={detail.aging.stalledReqs.count}
          priorValue={priorPeriod ? priorPeriod.stalledReqCount : undefined}
          priorLabel={priorPeriod?.label}
          trend={priorPeriod
            ? (detail.aging.stalledReqs.count < priorPeriod.stalledReqCount ? 'up' : detail.aging.stalledReqs.count > priorPeriod.stalledReqCount ? 'down' : 'neutral')
            : undefined}
          onClick={() => openDrillDown('stalledReqs', 'Stalled Requisitions', detail.aging.stalledReqs.count)}
        />
        <KPICardV2
          label="Productivity"
          value={detail.productivityIndex.toFixed(2)}
          priorValue={priorPeriod && priorPeriod.avgProductivity !== null
            ? priorPeriod.avgProductivity.toFixed(2)
            : undefined}
          priorLabel={priorPeriod?.label}
          trend={priorPeriod && priorPeriod.avgProductivity !== null
            ? (detail.productivityIndex > priorPeriod.avgProductivity ? 'up' : detail.productivityIndex < priorPeriod.avgProductivity ? 'down' : 'neutral')
            : undefined}
        />
      </div>

      {/* Productivity Trend Chart */}
      <div className="glass-panel p-4">
        <SectionHeaderV2 title="Productivity Trend" subtitle="Weighted Hires / Open Reqs per Week" />
        <ResponsiveContainer width="100%" height={180}>
          <ComposedChart data={activityData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
            <XAxis dataKey="name" fontSize={10} stroke="#94a3b8" axisLine={false} tickLine={false} />
            <YAxis fontSize={10} stroke="#94a3b8" axisLine={false} tickLine={false} domain={[0, 'auto']} tickFormatter={(v) => v.toFixed(2)} />
            <Tooltip
              formatter={(value: number | undefined) => [value != null ? value.toFixed(3) : '-', 'Productivity']}
              contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '6px' }}
            />
            <Area type="monotone" dataKey="productivityIndex" fill="#8b5cf6" fillOpacity={0.15} stroke="#8b5cf6" strokeWidth={2} dot={{ fill: '#8b5cf6', r: 3 }} connectNulls />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Weekly Activity Volume */}
      <div className="glass-panel p-4">
        <SectionHeaderV2 title="Weekly Activity Volume" subtitle="Last 12 Weeks" />
        <ResponsiveContainer width="100%" height={chartHeight}>
          <ComposedChart data={activityData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.06)" />
            <XAxis dataKey="name" fontSize={11} stroke="#94a3b8" axisLine={false} tickLine={false} />
            <YAxis fontSize={11} stroke="#94a3b8" axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '6px' }} />
            <Legend iconType="circle" />
            <Bar dataKey="screens" name="Screens" stackId="a" fill="#3b82f6" barSize={20} radius={[0, 0, 4, 4]} />
            <Bar dataKey="submittals" name="Submittals to HM" stackId="a" fill="#8b5cf6" barSize={20} radius={[4, 4, 0, 0]} />
            <Line type="monotone" dataKey="hires" name="Hires" stroke="#10b981" strokeWidth={3} dot={{ r: 4, fill: '#10b981' }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Funnel + Aging Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Funnel Conversion */}
        <div className="glass-panel p-4">
          <SectionHeaderV2 title="Funnel Conversion" />
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={funnelData} layout="vertical" barGap={2}>
              <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="rgba(255,255,255,0.06)" />
              <XAxis type="number" domain={[0, 100]} unit="%" fontSize={11} stroke="#94a3b8" axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" width={100} fontSize={11} stroke="#94a3b8" axisLine={false} tickLine={false} />
              <Tooltip
                cursor={{ fill: 'transparent' }}
                formatter={(value) => [`${Number(value).toFixed(1)}%`]}
                contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '6px' }}
              />
              <Legend iconType="circle" />
              <Bar dataKey="rate" name="Recruiter" fill="#06b6d4" radius={[0, 4, 4, 0]} barSize={12} />
              <Bar dataKey="benchmark" name="Team Avg" fill="#475569" radius={[0, 4, 4, 0]} barSize={12} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Req Aging */}
        <div className="glass-panel p-4">
          <SectionHeaderV2 title="Req Aging Distribution" />
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={agingData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="name" fontSize={11} stroke="#94a3b8" axisLine={false} tickLine={false} />
              <YAxis fontSize={11} stroke="#94a3b8" axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '6px' }} />
              <Bar dataKey="count" fill="#8b5cf6">
                {agingData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={index <= 1 ? '#22c55e' : index === 2 ? '#f59e0b' : '#ef4444'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Time Attribution */}
      <div className="glass-panel p-4">
        <SectionHeaderV2 title="Where Time is Going" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Recruiter */}
          <div className="rounded-lg bg-accent/10 border-l-[3px] border-accent p-4">
            <div className="flex items-center gap-2 text-[0.65rem] font-semibold uppercase tracking-wider text-accent mb-3">
              <User className="w-3.5 h-3.5" />
              Recruiter
            </div>
            <div className="space-y-3">
              <div>
                <div className="text-[10px] text-muted-foreground mb-0.5">Lead to First Action</div>
                <div className="font-mono text-xl font-semibold text-foreground">
                  {detail.timeAttribution.recruiterControlledTime.leadToFirstAction !== null
                    ? <>{Math.round(detail.timeAttribution.recruiterControlledTime.leadToFirstAction)}<span className="text-sm font-normal ml-1">hrs</span></>
                    : <span className="text-muted-foreground">-</span>}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-muted-foreground mb-0.5">Screen to Submittal</div>
                <div className="font-mono text-xl font-semibold text-foreground">
                  {detail.timeAttribution.recruiterControlledTime.screenToSubmittal !== null
                    ? <>{Math.round(detail.timeAttribution.recruiterControlledTime.screenToSubmittal)}<span className="text-sm font-normal ml-1">hrs</span></>
                    : <span className="text-muted-foreground">-</span>}
                </div>
              </div>
            </div>
          </div>

          {/* Hiring Manager */}
          <div className="rounded-lg bg-[#2dd4bf]/10 border-l-[3px] border-[#2dd4bf] p-4">
            <div className="flex items-center gap-2 text-[0.65rem] font-semibold uppercase tracking-wider text-[#2dd4bf] mb-3">
              <Briefcase className="w-3.5 h-3.5" />
              Hiring Manager
            </div>
            <div className="space-y-3">
              <div>
                <div className="text-[10px] text-muted-foreground mb-0.5">Feedback Latency</div>
                <div className="font-mono text-xl font-semibold text-foreground">
                  {detail.timeAttribution.hmControlledTime.feedbackLatency !== null
                    ? <>{Math.round(detail.timeAttribution.hmControlledTime.feedbackLatency)}<span className="text-sm font-normal ml-1">hrs</span></>
                    : <span className="text-muted-foreground">-</span>}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-muted-foreground mb-0.5">Decision Latency</div>
                <div className="font-mono text-xl font-semibold text-foreground">
                  {detail.timeAttribution.hmControlledTime.decisionLatency !== null
                    ? <>{Math.round(detail.timeAttribution.hmControlledTime.decisionLatency)}<span className="text-sm font-normal ml-1">hrs</span></>
                    : <span className="text-muted-foreground">-</span>}
                </div>
              </div>
            </div>
          </div>

          {/* TA Ops */}
          <div className="rounded-lg bg-white/[0.04] border-l-[3px] border-muted-foreground p-4">
            <div className="flex items-center gap-2 text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              <Settings className="w-3.5 h-3.5" />
              TA Ops
            </div>
            {detail.timeAttribution.opsControlledTime.available ? (
              <div>
                <div className="text-[10px] text-muted-foreground mb-0.5">Offer Approval</div>
                <div className="font-mono text-xl font-semibold text-foreground">
                  {detail.timeAttribution.opsControlledTime.offerApprovalLatency !== null
                    ? <>{Math.round(detail.timeAttribution.opsControlledTime.offerApprovalLatency)}<span className="text-sm font-normal ml-1">hrs</span></>
                    : <span className="text-muted-foreground">-</span>}
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground italic">No data available</div>
            )}
          </div>
        </div>
      </div>

      {/* Requisitions Table */}
      <div className="glass-panel overflow-hidden">
        <div className="p-4 border-b border-white/[0.06] flex items-center justify-between">
          <h3 className="text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">
            Requisitions ({recruiterReqs.length})
          </h3>
          <button
            type="button"
            onClick={handleExportReqs}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md text-muted-foreground hover:text-foreground hover:bg-white/[0.06] transition-colors"
          >
            <Download className="w-3 h-3" />
            Export CSV
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-white/[0.02]">
              <tr className="border-b border-white/[0.06]">
                <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground text-left">Req</th>
                <SortHeader column="title" label="Title" />
                <SortHeader column="level" label="Level" />
                <SortHeader column="hmName" label="HM" />
                <SortHeader column="ageInDays" label="Age" align="right" />
                <SortHeader column="candidateCount" label="Cand" align="right" />
                <SortHeader column="complexityScore" label="Cmplx" align="right" />
                <SortHeader column="status" label="Status" />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {sortedReqDetails.map(rd => (
                <tr key={rd.req.req_id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-3 py-3">
                    <code className="text-xs text-muted-foreground font-mono">{rd.req.req_id}</code>
                  </td>
                  <td className="px-3 py-3 font-medium text-foreground max-w-[200px] truncate">
                    {rd.req.req_title}
                  </td>
                  <td className="px-3 py-3 text-muted-foreground">
                    {rd.req.level}
                  </td>
                  <td className="px-3 py-3 text-muted-foreground truncate max-w-[120px]">
                    {rd.hmName}
                  </td>
                  <td className="px-3 py-3 text-right">
                    <span className={`font-mono ${
                      rd.ageInDays > 90 ? 'text-bad font-semibold' :
                      rd.ageInDays > 60 ? 'text-warn font-semibold' :
                      'text-muted-foreground'
                    }`}>
                      {rd.ageInDays}d
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right text-muted-foreground font-mono">
                    {rd.candidateCount}
                  </td>
                  <td className="px-3 py-3 text-right text-muted-foreground font-mono">
                    {rd.complexityScore.toFixed(2)}
                  </td>
                  <td className="px-3 py-3">
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
                      rd.req.status === 'Open' ? 'bg-good/20 text-good' :
                      rd.req.status === 'Closed' ? 'bg-white/[0.08] text-muted-foreground' :
                      rd.req.status === 'OnHold' ? 'bg-warn/20 text-warn' :
                      'bg-bad/20 text-bad'
                    }`}>
                      {rd.req.status}
                    </span>
                    {rd.isStalled && (
                      <span className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-warn/20 text-warn">
                        Stalled
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Drill Down Modal */}
      {drillDown && (
        <DataDrillDownModal
          isOpen={drillDown.isOpen}
          onClose={() => setDrillDown(null)}
          title={drillDown.title}
          type={drillDown.type}
          records={getDrillDownRecords}
          formula={drillDown.formula}
          totalValue={drillDown.totalValue}
        />
      )}
    </div>
  );
}

export default RecruiterDetailTabV2;
