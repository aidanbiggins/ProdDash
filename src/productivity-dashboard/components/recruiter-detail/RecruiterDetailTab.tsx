import React, { useMemo } from 'react';
import {
  ComposedChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend, ReferenceLine
} from 'recharts';
import { startOfWeek, endOfWeek, eachWeekOfInterval, isSameWeek, subWeeks, format, differenceInDays } from 'date-fns';
import { RecruiterSummary, Requisition, Candidate, Event as DashboardEvent, User, ReqDetail, PriorPeriodMetrics, EventType, CanonicalStage } from '../../types';
import { KPICard } from '../common/KPICard';
import { DashboardConfig } from '../../types/config';
import { exportReqListCSV, normalizeStage } from '../../services';

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
}

// Helper to calculate weekly activity
function calculateWeeklyActivity(events: DashboardEvent[], recruiterId: string | null, config: DashboardConfig, weeksBack = 12) {
  const end = new Date();
  const start = subWeeks(end, weeksBack);
  const weeks = eachWeekOfInterval({ start, end });

  // Filter events by recruiter if selected
  const relevantEvents = recruiterId
    ? events.filter(e => e.actor_user_id === recruiterId)
    : events;

  return weeks.map(weekStart => {
    const weekEvents = relevantEvents.filter(e => isSameWeek(e.event_at, weekStart));
    return {
      name: format(weekStart, 'MMM d'),
      screens: weekEvents.filter(e => e.event_type === EventType.SCREEN_COMPLETED).length,
      submittals: weekEvents.filter(e => {
        if (e.event_type !== EventType.STAGE_CHANGE) return false;
        return normalizeStage(e.to_stage, config.stageMapping) === CanonicalStage.HM_SCREEN;
      }).length,
      hires: weekEvents.filter(e => e.event_type === EventType.OFFER_ACCEPTED).length
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
  recruiterPriorPeriods
}: RecruiterDetailTabProps) {
  // Get selected recruiter or aggregate all
  const detail = useMemo<RecruiterSummary | null>(() => {
    if (selectedRecruiterId) {
      return recruiterSummaries.find(r => r.recruiterId === selectedRecruiterId) || null;
    }
    // Aggregate all recruiters
    if (recruiterSummaries.length === 0) return null;

    const aggregated: RecruiterSummary = {
      recruiterId: 'all',
      recruiterName: 'All Recruiters',
      team: null,
      outcomes: {
        hires: recruiterSummaries.reduce((sum, r) => sum + r.outcomes.hires, 0),
        offersExtended: recruiterSummaries.reduce((sum, r) => sum + r.outcomes.offersExtended, 0),
        offersAccepted: recruiterSummaries.reduce((sum, r) => sum + r.outcomes.offersAccepted, 0),
        offerAcceptanceRate: null,
        timeToFillMedian: null
      },
      executionVolume: {
        outreachSent: recruiterSummaries.reduce((sum, r) => sum + r.executionVolume.outreachSent, 0),
        screensCompleted: recruiterSummaries.reduce((sum, r) => sum + r.executionVolume.screensCompleted, 0),
        submittalsToHM: recruiterSummaries.reduce((sum, r) => sum + r.executionVolume.submittalsToHM, 0),
        interviewLoopsScheduled: recruiterSummaries.reduce((sum, r) => sum + r.executionVolume.interviewLoopsScheduled, 0),
        followUpVelocityMedian: null
      },
      funnelConversion: recruiterSummaries[0]?.funnelConversion || {
        screenToHmScreen: { entered: 0, converted: 0, rate: null, fromStage: 'SCREEN' as any, toStage: 'HM_SCREEN' as any },
        hmScreenToOnsite: { entered: 0, converted: 0, rate: null, fromStage: 'HM_SCREEN' as any, toStage: 'ONSITE' as any },
        onsiteToOffer: { entered: 0, converted: 0, rate: null, fromStage: 'ONSITE' as any, toStage: 'OFFER' as any },
        offerToHired: { entered: 0, converted: 0, rate: null, fromStage: 'OFFER' as any, toStage: 'HIRED' as any }
      },
      aging: {
        openReqCount: recruiterSummaries.reduce((sum, r) => sum + r.aging.openReqCount, 0),
        agingBuckets: [],
        stalledReqs: { count: recruiterSummaries.reduce((sum, r) => sum + r.aging.stalledReqs.count, 0), threshold: 30, reqIds: [] }
      },
      weighted: {
        weightedHires: recruiterSummaries.reduce((sum, r) => sum + r.weighted.weightedHires, 0),
        weightedOffers: recruiterSummaries.reduce((sum, r) => sum + r.weighted.weightedOffers, 0),
        offerMultiplier: 1,
        complexityScores: []
      },
      timeAttribution: recruiterSummaries[0]?.timeAttribution || {
        recruiterControlledTime: { leadToFirstAction: null, screenToSubmittal: null },
        hmControlledTime: { feedbackLatency: null, decisionLatency: null },
        opsControlledTime: { offerApprovalLatency: null, available: false }
      },
      productivityIndex: recruiterSummaries.length > 0
        ? recruiterSummaries.reduce((sum, r) => sum + r.productivityIndex, 0) / recruiterSummaries.length
        : 0,
      activeReqLoad: recruiterSummaries.reduce((sum, r) => sum + r.activeReqLoad, 0)
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
      recruiterSummaries.forEach(r => {
        totalEntered += r.funnelConversion[stage].entered;
        totalConverted += r.funnelConversion[stage].converted;
      });
      aggregated.funnelConversion[stage].entered = totalEntered;
      aggregated.funnelConversion[stage].converted = totalConverted;
      aggregated.funnelConversion[stage].rate = totalEntered > 0 ? totalConverted / totalEntered : 0;
    });

    // Aggregate aging buckets from all recruiters
    const bucketMap = new Map<string, { label: string; min: number; max: number | null; count: number; reqIds: string[] }>();
    recruiterSummaries.forEach(r => {
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
  }, [recruiterSummaries, selectedRecruiterId]);

  // Calculate Team Averages for Benchmarking
  const teamBenchmarks = useMemo(() => {
    if (recruiterSummaries.length === 0) return null;

    // Calculate average rates across all recruiters
    const avgScreenToHm = recruiterSummaries.reduce((sum, r) => sum + (r.funnelConversion.screenToHmScreen.rate || 0), 0) / recruiterSummaries.length;
    const avgHmToOnsite = recruiterSummaries.reduce((sum, r) => sum + (r.funnelConversion.hmScreenToOnsite.rate || 0), 0) / recruiterSummaries.length;
    const avgOnsiteToOffer = recruiterSummaries.reduce((sum, r) => sum + (r.funnelConversion.onsiteToOffer.rate || 0), 0) / recruiterSummaries.length;
    const avgOfferToHired = recruiterSummaries.reduce((sum, r) => sum + (r.funnelConversion.offerToHired.rate || 0), 0) / recruiterSummaries.length;

    return {
      screenToHm: avgScreenToHm * 100,
      hmToOnsite: avgHmToOnsite * 100,
      onsiteToOffer: avgOnsiteToOffer * 100,
      offerToHired: avgOfferToHired * 100
    };
  }, [recruiterSummaries]);

  // Activity Trends Data
  const activityData = useMemo(() => {
    return calculateWeeklyActivity(events, selectedRecruiterId === 'all' ? null : selectedRecruiterId, config);
  }, [events, selectedRecruiterId, config]);

  if (!detail) {
    return <div className="text-center py-5 text-muted">No recruiter data available</div>;
  }

  // Get recruiter's reqs (all if aggregated)
  const recruiterReqs = selectedRecruiterId
    ? requisitions.filter(r => r.recruiter_id === selectedRecruiterId)
    : requisitions;

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
  const funnelData = [
    {
      name: 'Screen → HM',
      rate: detail.funnelConversion.screenToHmScreen.rate !== null
        ? detail.funnelConversion.screenToHmScreen.rate * 100
        : 0,
      benchmark: teamBenchmarks?.screenToHm || 0,
      entered: detail.funnelConversion.screenToHmScreen.entered,
      converted: detail.funnelConversion.screenToHmScreen.converted
    },
    {
      name: 'HM → Onsite',
      rate: detail.funnelConversion.hmScreenToOnsite.rate !== null
        ? detail.funnelConversion.hmScreenToOnsite.rate * 100
        : 0,
      benchmark: teamBenchmarks?.hmToOnsite || 0,
      entered: detail.funnelConversion.hmScreenToOnsite.entered,
      converted: detail.funnelConversion.hmScreenToOnsite.converted
    },
    {
      name: 'Onsite → Offer',
      rate: detail.funnelConversion.onsiteToOffer.rate !== null
        ? detail.funnelConversion.onsiteToOffer.rate * 100
        : 0,
      benchmark: teamBenchmarks?.onsiteToOffer || 0,
      entered: detail.funnelConversion.onsiteToOffer.entered,
      converted: detail.funnelConversion.onsiteToOffer.converted
    },
    {
      name: 'Offer → Hired',
      rate: detail.funnelConversion.offerToHired.rate !== null
        ? detail.funnelConversion.offerToHired.rate * 100
        : 0,
      benchmark: teamBenchmarks?.offerToHired || 0,
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
      {/* Header with Recruiter Selector */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div className="d-flex align-items-center gap-3">
          <select
            className="form-select"
            style={{ width: 'auto', minWidth: '180px', fontWeight: 500, fontSize: '0.9rem' }}
            value={selectedRecruiterId || 'all'}
            onChange={(e) => onSelectRecruiter(e.target.value === 'all' ? null : e.target.value)}
          >
            <option value="all">All Recruiters</option>
            {recruiterSummaries
              .sort((a, b) => a.recruiterName.localeCompare(b.recruiterName))
              .map(r => (
                <option key={r.recruiterId} value={r.recruiterId}>
                  {r.recruiterName}
                </option>
              ))}
          </select>
          {detail.team && <span className="badge bg-secondary">{detail.team}</span>}
        </div>
        <div className="text-end">
          <div className="fs-4 fw-bold text-primary">{detail.productivityIndex.toFixed(2)}</div>
          <small className="text-muted">Avg Productivity Index</small>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="row g-3 mb-4">
        <div className="col-md-2">
          <KPICard
            title="Hires"
            value={detail.outcomes.hires}
            priorPeriod={selectedRecruiterId && recruiterPriorPeriods
              ? (recruiterPriorPeriods[selectedRecruiterId] ? {
                value: recruiterPriorPeriods[selectedRecruiterId].hires,
                label: recruiterPriorPeriods[selectedRecruiterId].label
              } : undefined)
              : (priorPeriod ? {
                value: priorPeriod.hires,
                label: priorPeriod.label
              } : undefined)
            }
          />
        </div>
        <div className="col-md-2">
          <KPICard
            title="Weighted Hires"
            value={parseFloat(detail.weighted.weightedHires.toFixed(1))}
            priorPeriod={selectedRecruiterId && recruiterPriorPeriods
              ? (recruiterPriorPeriods[selectedRecruiterId] ? {
                value: parseFloat(recruiterPriorPeriods[selectedRecruiterId].weightedHires.toFixed(1)),
                label: recruiterPriorPeriods[selectedRecruiterId].label
              } : undefined)
              : (priorPeriod ? {
                value: parseFloat(priorPeriod.weightedHires.toFixed(1)),
                label: priorPeriod.label
              } : undefined)
            }
          />
        </div>
        <div className="col-md-2">
          <KPICard
            title="Offers"
            value={detail.outcomes.offersExtended}
            priorPeriod={selectedRecruiterId && recruiterPriorPeriods
              ? (recruiterPriorPeriods[selectedRecruiterId] ? {
                value: recruiterPriorPeriods[selectedRecruiterId].offers,
                label: recruiterPriorPeriods[selectedRecruiterId].label
              } : undefined)
              : (priorPeriod ? {
                value: priorPeriod.offers,
                label: priorPeriod.label
              } : undefined)
            }
          />
        </div>
        <div className="col-md-2">
          <KPICard
            title="Accept Rate"
            value={detail.outcomes.offerAcceptanceRate !== null
              ? `${(detail.outcomes.offerAcceptanceRate * 100).toFixed(0)}%`
              : 'N/A'}
          />
        </div>
        <div className="col-md-2">
          <KPICard title="Open Reqs" value={detail.aging.openReqCount} />
        </div>
        <div className="col-md-2">
          <KPICard title="Stalled" value={detail.aging.stalledReqs.count} />
        </div>
      </div>

      {/* Charts Row */}
      <div className="row g-3 mb-4">
        {/* Weekly Activity Trend (NEW) */}
        <div className="col-12">
          <div className="card h-100">
            <div className="card-header d-flex justify-content-between align-items-center">
              <h6 className="mb-0">Weekly Activity Volume</h6>
              <small className="text-muted">Last 12 Weeks</small>
            </div>
            <div className="card-body">
              <ResponsiveContainer width="100%" height={260}>
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
        <div className="col-md-6">
          <div className="card h-100">
            <div className="card-header">
              <h6 className="mb-0">Funnel Conversion</h6>
            </div>
            <div className="card-body">
              <ResponsiveContainer width="100%" height={260}>
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
        <div className="col-md-6">
          <div className="card h-100">
            <div className="card-header">
              <h6 className="mb-0">Req Aging Distribution</h6>
            </div>
            <div className="card-body">
              <ResponsiveContainer width="100%" height={200}>
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
      <div className="card mb-4">
        <div className="card-header">
          <h6 className="mb-0">Where Time is Going</h6>
        </div>
        <div className="card-body">
          <div className="row">
            <div className="col-md-4">
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
            <div className="col-md-4">
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
            <div className="col-md-4">
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
    </div>
  );
}
