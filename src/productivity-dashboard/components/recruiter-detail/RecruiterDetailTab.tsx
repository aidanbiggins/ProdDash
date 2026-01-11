import React, { useMemo, useState } from 'react';
import {
  ComposedChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend, ReferenceLine, Area
} from 'recharts';
import { startOfWeek, endOfWeek, eachWeekOfInterval, isSameWeek, subWeeks, format, differenceInDays } from 'date-fns';
import { RecruiterSummary, Requisition, Candidate, Event as DashboardEvent, User, ReqDetail, PriorPeriodMetrics, EventType, CanonicalStage, MetricFilters, RequisitionStatus } from '../../types';
import { KPICard } from '../common/KPICard';
import { DashboardConfig } from '../../types/config';
import { exportReqListCSV, normalizeStage } from '../../services';
import { useIsMobile } from '../../hooks/useIsMobile';
import { DataDrillDownModal, DrillDownType, buildHiresRecords, buildOffersRecords, buildReqsRecords, buildTTFRecords } from '../common/DataDrillDownModal';
import { METRIC_FORMULAS } from '../common/MetricDrillDown';

export interface RecruiterDetailTabProps {
  recruiterSummaries: RecruiterSummary[];
  selectedRecruiterId: string | null;
  onSelectRecruiter: (id: string | null) => void;
  requisitions: Requisition[];
  candidates: Candidate[];
  events: DashboardEvent[];
  users: User[];
  config: DashboardConfig;
  priorPeriod?: PriorPeriodMetrics;
  recruiterPriorPeriods?: Record<string, PriorPeriodMetrics>;
  filters?: MetricFilters;
}

// Helper to calculate weekly activity including productivity
function calculateWeeklyActivity(
  events: DashboardEvent[],
  recruiterId: string | null,
  config: DashboardConfig,
  requisitions: Requisition[],
  candidates: Candidate[],
  complexityScores?: Map<string, { totalScore: number; levelWeight: number; hmWeight: number }>,
  weeksBack = 12
) {
  const end = new Date();
  const start = subWeeks(end, weeksBack);
  const weeks = eachWeekOfInterval({ start, end });

  // Filter events by recruiter if selected
  const relevantEvents = recruiterId
    ? events.filter(e => e.actor_user_id === recruiterId)
    : events;

  // Filter requisitions and candidates by recruiter
  const recruiterReqs = recruiterId
    ? requisitions.filter(r => r.recruiter_id === recruiterId)
    : requisitions;
  const recruiterReqIds = new Set(recruiterReqs.map(r => r.req_id));
  const recruiterCandidates = candidates.filter(c => recruiterReqIds.has(c.req_id));

  return weeks.map(weekStart => {
    const weekEnd = endOfWeek(weekStart);
    const weekEvents = relevantEvents.filter(e => isSameWeek(e.event_at, weekStart));

    // Hires this week
    const hiresThisWeek = recruiterCandidates.filter(c =>
      c.hired_at && isSameWeek(c.hired_at, weekStart)
    );
    const hires = hiresThisWeek.length;

    // Weighted hires
    const weightedHires = hiresThisWeek.reduce((sum, c) => {
      return sum + (complexityScores?.get(c.req_id)?.totalScore || 1);
    }, 0);

    // Open reqs during this week
    const openReqCount = recruiterReqs.filter(r => {
      const openedBefore = r.opened_at <= weekEnd;
      const notClosedYet = !r.closed_at || r.closed_at >= weekStart;
      return openedBefore && notClosedYet && r.status !== RequisitionStatus.Canceled;
    }).length;

    // Productivity index
    const productivityIndex = openReqCount > 0 ? weightedHires / openReqCount : null;

    return {
      name: format(weekStart, 'MMM d'),
      screens: weekEvents.filter(e => e.event_type === EventType.SCREEN_COMPLETED).length,
      submittals: weekEvents.filter(e => {
        if (e.event_type !== EventType.STAGE_CHANGE) return false;
        return normalizeStage(e.to_stage, config.stageMapping) === CanonicalStage.HM_SCREEN;
      }).length,
      hires,
      weightedHires,
      openReqCount,
      productivityIndex
    };
  });
}

export function RecruiterDetailTab({
  recruiterSummaries,
  selectedRecruiterId,
  onSelectRecruiter,
  requisitions,
  candidates,
  events,
  users,
  config,
  priorPeriod,
  recruiterPriorPeriods,
  filters
}: RecruiterDetailTabProps) {
  const isMobile = useIsMobile();
  const chartHeight = isMobile ? 200 : 260;
  const chartHeightSmall = isMobile ? 160 : 200;

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

  // Filter recruiter summaries to only those with matching data
  const filteredRecruiterSummaries = useMemo(() => {
    // If recruiterIds filter is set, only show those recruiters
    if (filters?.recruiterIds?.length) {
      return recruiterSummaries.filter(r => filters.recruiterIds!.includes(r.recruiterId));
    }
    // Otherwise, show recruiters that have requisitions matching other filters
    return recruiterSummaries.filter(r => recruiterIdsWithData.has(r.recruiterId));
  }, [recruiterSummaries, filters, recruiterIdsWithData]);

  // Determine effective selected recruiter
  // If master filter has a single recruiter selected, use that
  const effectiveSelectedRecruiterId = useMemo(() => {
    if (filters?.recruiterIds?.length === 1) {
      return filters.recruiterIds[0];
    }
    // If the currently selected recruiter isn't in the filtered list, clear selection
    if (selectedRecruiterId && !filteredRecruiterSummaries.some(r => r.recruiterId === selectedRecruiterId)) {
      return null;
    }
    return selectedRecruiterId;
  }, [filters, selectedRecruiterId, filteredRecruiterSummaries]);

  // Get selected recruiter or aggregate all (using filtered data)
  const detail = useMemo<RecruiterSummary | null>(() => {
    if (effectiveSelectedRecruiterId) {
      return filteredRecruiterSummaries.find(r => r.recruiterId === effectiveSelectedRecruiterId) || null;
    }
    // Aggregate all filtered recruiters
    if (filteredRecruiterSummaries.length === 0) return null;

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
      funnelConversion: recruiterSummaries[0]?.funnelConversion || {
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
      timeAttribution: recruiterSummaries[0]?.timeAttribution || {
        recruiterControlledTime: { leadToFirstAction: null, screenToSubmittal: null },
        hmControlledTime: { feedbackLatency: null, decisionLatency: null },
        opsControlledTime: { offerApprovalLatency: null, available: false }
      },
      productivityIndex: filteredRecruiterSummaries.length > 0
        ? filteredRecruiterSummaries.reduce((sum, r) => sum + r.productivityIndex, 0) / filteredRecruiterSummaries.length
        : 0,
      activeReqLoad: filteredRecruiterSummaries.reduce((sum, r) => sum + r.activeReqLoad, 0)
    };

    // Calculate aggregate offer acceptance rate
    if (aggregated.outcomes.offersExtended > 0) {
      aggregated.outcomes.offerAcceptanceRate = aggregated.outcomes.offersAccepted / aggregated.outcomes.offersExtended;
    }

    // Re-calculate aggregated funnel rates (approximate by summing entered/converted)
    // In a real app, you'd sum entered and converted for each stage
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

    // Aggregate aging buckets from all recruiters
    const bucketMap = new Map<string, { label: string; min: number; max: number | null; count: number; reqIds: string[] }>();
    filteredRecruiterSummaries.forEach(r => {
      r.aging.agingBuckets.forEach(bucket => {
        const existing = bucketMap.get(bucket.label);
        if (existing) {
          existing.count += bucket.count;
          existing.reqIds.push(...bucket.reqIds);
        } else {
          bucketMap.set(bucket.label, {
            label: bucket.label,
            min: bucket.min,
            max: bucket.max,
            count: bucket.count,
            reqIds: [...bucket.reqIds]
          });
        }
      });
    });
    // Convert map to array and sort by min value
    aggregated.aging.agingBuckets = Array.from(bucketMap.values()).sort((a, b) => a.min - b.min);


    return aggregated;
  }, [filteredRecruiterSummaries, effectiveSelectedRecruiterId]);

  // Calculate Team Averages for Benchmarking
  // Use aggregate (total converted / total entered) not average of rates
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

  // Build complexity scores map from selected recruiter(s) - needed for activity data
  const complexityScoresMap = useMemo(() => {
    const map = new Map<string, { totalScore: number; levelWeight: number; hmWeight: number }>();
    const summaries = effectiveSelectedRecruiterId
      ? filteredRecruiterSummaries.filter(r => r.recruiterId === effectiveSelectedRecruiterId)
      : filteredRecruiterSummaries;
    summaries.forEach(r => {
      r.weighted.complexityScores.forEach(cs => {
        map.set(cs.reqId, {
          totalScore: cs.totalScore,
          levelWeight: cs.levelWeight,
          hmWeight: cs.hmWeight
        });
      });
    });
    return map;
  }, [filteredRecruiterSummaries, effectiveSelectedRecruiterId]);

  // Activity Trends Data
  const activityData = useMemo(() => {
    return calculateWeeklyActivity(
      events,
      effectiveSelectedRecruiterId === 'all' ? null : effectiveSelectedRecruiterId,
      config,
      filteredRequisitions,
      candidates,
      complexityScoresMap
    );
  }, [events, effectiveSelectedRecruiterId, config, filteredRequisitions, candidates, complexityScoresMap]);

  // Drill-down state
  const [drillDown, setDrillDown] = useState<{
    isOpen: boolean;
    type: DrillDownType;
    title: string;
    formula?: string;
    totalValue?: string | number;
  } | null>(null);

  const openDrillDown = (type: DrillDownType, title: string, totalValue?: string | number) => {
    const formulaInfo = METRIC_FORMULAS[type] || { formula: 'Custom calculation' };
    setDrillDown({
      isOpen: true,
      type,
      title,
      formula: formulaInfo.formula,
      totalValue
    });
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

  // Build drill-down records based on type
  const getDrillDownRecords = useMemo(() => {
    if (!drillDown) return [];
    switch (drillDown.type) {
      case 'hires':
        return buildHiresRecords(recruiterCandidates, recruiterRequisitions, users);
      case 'weightedHires':
        return buildHiresRecords(recruiterCandidates, recruiterRequisitions, users, complexityScoresMap);
      case 'offers':
        return buildOffersRecords(recruiterCandidates, recruiterRequisitions, users);
      case 'offerAcceptRate':
        return buildOffersRecords(recruiterCandidates, recruiterRequisitions, users);
      case 'medianTTF':
        return buildTTFRecords(recruiterCandidates, recruiterRequisitions, users);
      case 'openReqs':
        return buildReqsRecords(recruiterRequisitions.filter(r => r.status === 'Open'), users);
      case 'stalledReqs':
        // Use the stalled req IDs from the detail
        const stalledReqIds = new Set(detail?.aging.stalledReqs.reqIds || []);
        return buildReqsRecords(recruiterRequisitions.filter(r => stalledReqIds.has(r.req_id)), users);
      default:
        return [];
    }
  }, [drillDown, recruiterCandidates, recruiterRequisitions, users, complexityScoresMap, detail]);

  if (!detail) {
    return <div className="text-center py-5 text-muted">No recruiter data available</div>;
  }

  // Get recruiter's reqs (filtered by master filters, then by selected recruiter)
  const recruiterReqs = effectiveSelectedRecruiterId
    ? filteredRequisitions.filter(r => r.recruiter_id === effectiveSelectedRecruiterId)
    : filteredRequisitions;

  // Build req details
  const now = new Date();
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

    const ageInDays = differenceInDays(now, req.opened_at);
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

  // Funnel conversion data for chart
  // When no recruiter selected, rate === benchmark (comparing all to all is meaningless)
  const useDetailAsBenchmark = !effectiveSelectedRecruiterId;

  const funnelData = [
    {
      name: 'Screen → HM',
      rate: detail.funnelConversion.screenToHmScreen.rate !== null
        ? detail.funnelConversion.screenToHmScreen.rate * 100
        : 0,
      benchmark: useDetailAsBenchmark
        ? (detail.funnelConversion.screenToHmScreen.rate !== null ? detail.funnelConversion.screenToHmScreen.rate * 100 : 0)
        : (teamBenchmarks?.screenToHm || 0),
      entered: detail.funnelConversion.screenToHmScreen.entered,
      converted: detail.funnelConversion.screenToHmScreen.converted
    },
    {
      name: 'HM → Onsite',
      rate: detail.funnelConversion.hmScreenToOnsite.rate !== null
        ? detail.funnelConversion.hmScreenToOnsite.rate * 100
        : 0,
      benchmark: useDetailAsBenchmark
        ? (detail.funnelConversion.hmScreenToOnsite.rate !== null ? detail.funnelConversion.hmScreenToOnsite.rate * 100 : 0)
        : (teamBenchmarks?.hmToOnsite || 0),
      entered: detail.funnelConversion.hmScreenToOnsite.entered,
      converted: detail.funnelConversion.hmScreenToOnsite.converted
    },
    {
      name: 'Onsite → Offer',
      rate: detail.funnelConversion.onsiteToOffer.rate !== null
        ? detail.funnelConversion.onsiteToOffer.rate * 100
        : 0,
      benchmark: useDetailAsBenchmark
        ? (detail.funnelConversion.onsiteToOffer.rate !== null ? detail.funnelConversion.onsiteToOffer.rate * 100 : 0)
        : (teamBenchmarks?.onsiteToOffer || 0),
      entered: detail.funnelConversion.onsiteToOffer.entered,
      converted: detail.funnelConversion.onsiteToOffer.converted
    },
    {
      name: 'Offer → Hired',
      rate: detail.funnelConversion.offerToHired.rate !== null
        ? detail.funnelConversion.offerToHired.rate * 100
        : 0,
      benchmark: useDetailAsBenchmark
        ? (detail.funnelConversion.offerToHired.rate !== null ? detail.funnelConversion.offerToHired.rate * 100 : 0)
        : (teamBenchmarks?.offerToHired || 0),
      entered: detail.funnelConversion.offerToHired.entered,
      converted: detail.funnelConversion.offerToHired.converted
    }
  ];

  // Aging bucket data for chart
  const agingData = detail.aging.agingBuckets.map(b => ({
    name: b.label,
    count: b.count
  }));

  const handleExportReqs = () => {
    exportReqListCSV(reqDetails);
  };

  // Sort state for Req list
  const [sortColumn, setSortColumn] = React.useState<keyof ReqDetail | 'status'>('ageInDays');
  const [sortDirection, setSortDirection] = React.useState<'asc' | 'desc'>('desc');

  const handleSort = (column: keyof ReqDetail | 'status') => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      // Default to desc for age and numeric, asc for text
      if (['ageInDays', 'candidateCount', 'complexityScore'].includes(column)) {
        setSortDirection('desc');
      } else {
        setSortDirection('asc');
      }
    }
  };

  const sortedReqDetails = [...reqDetails].sort((a, b) => {
    let aVal: any = a[sortColumn as keyof ReqDetail];
    let bVal: any = b[sortColumn as keyof ReqDetail];

    // Handle nested/special properties if needed, or simple property access
    if (sortColumn === 'status') {
      aVal = a.req.status;
      bVal = b.req.status;
    }

    if (aVal === bVal) return 0;
    if (aVal === null) return 1;
    if (bVal === null) return -1;

    if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  const renderSortIcon = (column: string) => {
    if (sortColumn !== column) return <i className="bi bi-arrow-down-up text-muted opacity-25 ms-1" style={{ fontSize: '0.7rem' }}></i>;
    return sortDirection === 'asc'
      ? <i className="bi bi-arrow-up-short ms-1 text-primary"></i>
      : <i className="bi bi-arrow-down-short ms-1 text-primary"></i>;
  };

  const SortableHeader = ({ column, label, align = 'text-start' }: { column: keyof ReqDetail | 'status', label: string, align?: string }) => (
    <th
      className={`${align} cursor-pointer user-select-none`}
      onClick={() => handleSort(column)}
      style={{
        borderBottom: '2px solid var(--color-slate-200)',
        padding: '0.625rem 0.5rem',
        fontSize: '0.7rem',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.03em',
        color: sortColumn === column ? 'var(--color-accent)' : 'var(--color-slate-600)',
        cursor: 'pointer',
        whiteSpace: 'nowrap'
      }}
    >
      <div className={`d-flex align-items-center ${align === 'text-end' ? 'justify-content-end' : ''}`}>
        {label}
        {renderSortIcon(column)}
      </div>
    </th>
  );

  return (
    <div>
      {/* KPI Cards - 7 cards using flex for equal width */}
      <div className="d-flex gap-3 mb-4" style={{ flexWrap: 'nowrap', overflowX: 'auto' }}>
        <div style={{ flex: '1 1 0', minWidth: '120px' }}>
          <KPICard
            title="Hires"
            value={detail.outcomes.hires}
            priorPeriod={effectiveSelectedRecruiterId && recruiterPriorPeriods
              ? (recruiterPriorPeriods[effectiveSelectedRecruiterId!] ? {
                value: recruiterPriorPeriods[effectiveSelectedRecruiterId!].hires,
                label: recruiterPriorPeriods[effectiveSelectedRecruiterId!].label
              } : undefined)
              : (priorPeriod ? {
                value: priorPeriod.hires,
                label: priorPeriod.label
              } : undefined)
            }
            onClick={() => openDrillDown('hires', 'Hires', detail.outcomes.hires)}
          />
        </div>
        <div style={{ flex: '1 1 0', minWidth: '120px' }}>
          <KPICard
            title="Weighted Hires"
            value={parseFloat(detail.weighted.weightedHires.toFixed(1))}
            priorPeriod={effectiveSelectedRecruiterId && recruiterPriorPeriods
              ? (recruiterPriorPeriods[effectiveSelectedRecruiterId!] ? {
                value: parseFloat(recruiterPriorPeriods[effectiveSelectedRecruiterId!].weightedHires.toFixed(1)),
                label: recruiterPriorPeriods[effectiveSelectedRecruiterId!].label
              } : undefined)
              : (priorPeriod ? {
                value: parseFloat(priorPeriod.weightedHires.toFixed(1)),
                label: priorPeriod.label
              } : undefined)
            }
            onClick={() => openDrillDown('weightedHires', 'Weighted Hires', detail.weighted.weightedHires.toFixed(1))}
          />
        </div>
        <div style={{ flex: '1 1 0', minWidth: '120px' }}>
          <KPICard
            title="Offers"
            value={detail.outcomes.offersExtended}
            priorPeriod={effectiveSelectedRecruiterId && recruiterPriorPeriods
              ? (recruiterPriorPeriods[effectiveSelectedRecruiterId!] ? {
                value: recruiterPriorPeriods[effectiveSelectedRecruiterId!].offers,
                label: recruiterPriorPeriods[effectiveSelectedRecruiterId!].label
              } : undefined)
              : (priorPeriod ? {
                value: priorPeriod.offers,
                label: priorPeriod.label
              } : undefined)
            }
            onClick={() => openDrillDown('offers', 'Offers Extended', detail.outcomes.offersExtended)}
          />
        </div>
        <div style={{ flex: '1 1 0', minWidth: '120px' }}>
          <KPICard
            title="Accept Rate"
            value={detail.outcomes.offerAcceptanceRate !== null
              ? `${(detail.outcomes.offerAcceptanceRate * 100).toFixed(0)}%`
              : 'N/A'}
            onClick={() => openDrillDown('offerAcceptRate', 'Offer Accept Rate', detail.outcomes.offerAcceptanceRate !== null ? `${(detail.outcomes.offerAcceptanceRate * 100).toFixed(0)}%` : 'N/A')}
          />
        </div>
        <div style={{ flex: '1 1 0', minWidth: '120px' }}>
          <KPICard
            title="Open Reqs"
            value={detail.aging.openReqCount}
            onClick={() => openDrillDown('openReqs', 'Open Requisitions', detail.aging.openReqCount)}
          />
        </div>
        <div style={{ flex: '1 1 0', minWidth: '120px' }}>
          <KPICard
            title="Stalled"
            value={detail.aging.stalledReqs.count}
            subtitle="no activity 14+ days"
            onClick={() => openDrillDown('stalledReqs', 'Stalled Requisitions', detail.aging.stalledReqs.count)}
          />
        </div>
        <div style={{ flex: '1 1 0', minWidth: '120px' }}>
          <KPICard
            title="Productivity"
            value={detail.productivityIndex.toFixed(2)}
            subtitle="Weighted Hires ÷ Open Reqs"
          />
        </div>
      </div>

      {/* Productivity Trend Chart */}
      <div className="card-bespoke mb-4">
        <div className="card-header">
          <div className="d-flex justify-content-between align-items-center">
            <h6 className="mb-0">Productivity Trend</h6>
            <small className="text-muted">Weighted Hires ÷ Open Reqs per Week</small>
          </div>
        </div>
        <div className="card-body">
          <ResponsiveContainer width="100%" height={180}>
            <ComposedChart data={activityData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" fontSize={11} stroke="#64748b" />
              <YAxis
                fontSize={11}
                stroke="#64748b"
                domain={[0, 'auto']}
                tickFormatter={(v) => v.toFixed(2)}
              />
              <Tooltip
                formatter={(value: number | undefined) => [value != null ? value.toFixed(3) : '—', 'Productivity']}
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}
              />
              <Area
                type="monotone"
                dataKey="productivityIndex"
                fill="#8b5cf6"
                fillOpacity={0.15}
                stroke="#8b5cf6"
                strokeWidth={2.5}
                name="Productivity Index"
                dot={{ fill: '#8b5cf6', strokeWidth: 0, r: 3 }}
                connectNulls
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts Row */}
      <div className="row g-3 mb-4">
        {/* Weekly Activity Trend */}
        <div className="col-12">
          <div className="card-bespoke h-100">
            <div className="card-header d-flex justify-content-between align-items-center">
              <h6 className="mb-0">Weekly Activity Volume</h6>
              <small className="text-muted">Last 12 Weeks</small>
            </div>
            <div className="card-body">
              <ResponsiveContainer width="100%" height={chartHeight}>
                <ComposedChart data={activityData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" fontSize={12} stroke="#64748b" tickMargin={10} />
                  <YAxis fontSize={12} stroke="#64748b" />
                  <Tooltip
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  />
                  <Legend iconType="circle" />
                  <Bar dataKey="screens" name="Screens" stackId="a" fill="#3b82f6" barSize={20} radius={[0, 0, 4, 4]} />
                  <Bar dataKey="submittals" name="Submittals to HM" stackId="a" fill="#8b5cf6" barSize={20} radius={[4, 4, 0, 0]} />
                  <Line type="monotone" dataKey="hires" name="Hires" stroke="#10b981" strokeWidth={3} dot={{ r: 4, strokeWidth: 0, fill: '#10b981' }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      <div className="row g-3 mb-4">
        {/* Funnel Conversion */}
        <div className="col-12 col-md-6">
          <div className="card-bespoke h-100">
            <div className="card-header">
              <h6 className="mb-0">Funnel Conversion</h6>
            </div>
            <div className="card-body">
              <ResponsiveContainer width="100%" height={chartHeight}>
                <BarChart data={funnelData} layout="vertical" barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                  <XAxis type="number" domain={[0, 100]} unit="%" fontSize={12} stroke="#64748b" />
                  <YAxis type="category" dataKey="name" width={110} fontSize={12} stroke="#64748b" />
                  <Tooltip
                    cursor={{ fill: 'transparent' }}
                    formatter={(value, name) => [`${Number(value).toFixed(1)}%`, name]}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ paddingTop: '10px' }} />
                  <Bar dataKey="rate" name="Recruiter Rate" fill="#0ea5e9" radius={[0, 4, 4, 0]} barSize={12} />
                  <Bar dataKey="benchmark" name="Team Avg" fill="#cbd5e1" radius={[0, 4, 4, 0]} barSize={12} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Req Aging */}
        <div className="col-12 col-md-6">
          <div className="card-bespoke h-100">
            <div className="card-header">
              <h6 className="mb-0">Req Aging Distribution</h6>
            </div>
            <div className="card-body">
              <ResponsiveContainer width="100%" height={chartHeightSmall}>
                <BarChart data={agingData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#6f42c1">
                    {agingData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={index <= 1 ? '#28a745' : index === 2 ? '#ffc107' : '#dc3545'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* Time Attribution */}
      <div className="card-bespoke mb-4">
        <div className="card-header">
          <h6 className="mb-0">Where Time is Going</h6>
        </div>
        <div className="card-body">
          <div className="row g-3">
            <div className="col-12 col-md-4">
              <h6 className="text-muted mb-3">Recruiter-Controlled</h6>
              <div className="d-flex justify-content-between mb-2">
                <span>Lead to First Action</span>
                <strong>
                  {detail.timeAttribution.recruiterControlledTime.leadToFirstAction !== null
                    ? `${Math.round(detail.timeAttribution.recruiterControlledTime.leadToFirstAction)} hrs`
                    : 'N/A'}
                </strong>
              </div>
              <div className="d-flex justify-content-between">
                <span>Screen to Submittal</span>
                <strong>
                  {detail.timeAttribution.recruiterControlledTime.screenToSubmittal !== null
                    ? `${Math.round(detail.timeAttribution.recruiterControlledTime.screenToSubmittal)} hrs`
                    : 'N/A'}
                </strong>
              </div>
            </div>
            <div className="col-12 col-md-4">
              <h6 className="text-muted mb-3">HM-Controlled</h6>
              <div className="d-flex justify-content-between mb-2">
                <span>Feedback Latency</span>
                <strong>
                  {detail.timeAttribution.hmControlledTime.feedbackLatency !== null
                    ? `${Math.round(detail.timeAttribution.hmControlledTime.feedbackLatency)} hrs`
                    : 'N/A'}
                </strong>
              </div>
              <div className="d-flex justify-content-between">
                <span>Decision Latency</span>
                <strong>
                  {detail.timeAttribution.hmControlledTime.decisionLatency !== null
                    ? `${Math.round(detail.timeAttribution.hmControlledTime.decisionLatency)} hrs`
                    : 'N/A'}
                </strong>
              </div>
            </div>
            <div className="col-12 col-md-4">
              <h6 className="text-muted mb-3">Ops-Controlled</h6>
              {detail.timeAttribution.opsControlledTime.available ? (
                <div className="d-flex justify-content-between">
                  <span>Offer Approval</span>
                  <strong>
                    {detail.timeAttribution.opsControlledTime.offerApprovalLatency !== null
                      ? `${Math.round(detail.timeAttribution.opsControlledTime.offerApprovalLatency)} hrs`
                      : 'N/A'}
                  </strong>
                </div>
              ) : (
                <span className="text-muted">Not available from data</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Req List */}
      <div className="card-bespoke">
        <div className="card-header d-flex justify-content-between align-items-center">
          <h6 className="mb-0">Requisitions ({recruiterReqs.length})</h6>
          <button className="btn btn-bespoke-secondary btn-sm" onClick={handleExportReqs}>
            Export CSV
          </button>
        </div>
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table table-bespoke table-hover mb-0">
              <thead>
                <tr>
                  <SortableHeader column="req" label="Req" />
                  <SortableHeader column="req" label="Title" />
                  <SortableHeader column="req" label="Level" />
                  <SortableHeader column="hmName" label="HM" />
                  <SortableHeader column="ageInDays" label="Age" align="text-end" />
                  <SortableHeader column="candidateCount" label="Candidates" align="text-end" />
                  <SortableHeader column="complexityScore" label="Complexity" align="text-end" />
                  <SortableHeader column="status" label="Status" />
                </tr>
              </thead>
              <tbody>
                {sortedReqDetails.map(rd => (
                  <tr key={rd.req.req_id}>
                    <td style={{ padding: '0.875rem 1rem' }}>
                      <code className="small text-muted">{rd.req.req_id}</code>
                    </td>
                    <td className="fw-medium">
                      {rd.req.req_title}
                    </td>
                    <td className="text-muted">
                      {rd.req.level}
                    </td>
                    <td className="text-secondary text-truncate-2" style={{ maxWidth: '150px' }}>
                      {rd.hmName}
                    </td>
                    <td className="text-end">
                      <span className={rd.ageInDays > 90 ? 'text-danger fw-bold' : rd.ageInDays > 60 ? 'text-warning fw-bold' : 'text-slate-700'}>
                        {rd.ageInDays}d
                      </span>
                    </td>
                    <td className="text-end text-muted">
                      {rd.candidateCount}
                    </td>
                    <td className="text-end text-muted">
                      {rd.complexityScore.toFixed(2)}
                    </td>
                    <td>
                      <span className={`badge-bespoke ${rd.req.status === 'Open' ? 'badge-success-soft' :
                        rd.req.status === 'Closed' ? 'badge-neutral-soft' :
                          rd.req.status === 'OnHold' ? 'badge-warning-soft' : 'badge-danger-soft'
                        }`}>
                        {rd.req.status}
                      </span>
                      {rd.isStalled && (
                        <span className="badge-bespoke badge-warning-soft ms-1" title="No activity in 14+ days">
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
