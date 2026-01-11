// Overview Tab Component

import React, { useState, useMemo } from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, Area, ComposedChart
} from 'recharts';
import { format, startOfWeek, isSameWeek } from 'date-fns';
import { OverviewMetrics, RecruiterSummary, WeeklyTrend, DataHealth, Candidate, Requisition, User, Event, HiringManagerFriction } from '../../types';
import { DashboardConfig } from '../../types/config';
import { KPICard } from '../common/KPICard';
import { DataDrillDownModal, DrillDownType, buildHiresRecords, buildOffersRecords, buildReqsRecords, buildTTFRecords } from '../common/DataDrillDownModal';
import { METRIC_FORMULAS } from '../common/MetricDrillDown';
import { exportRecruiterSummaryCSV, calculatePipelineHealth, generateHistoricalBenchmarks } from '../../services';
import { MetricFilters } from '../../types';
import { BespokeTable, BespokeTableColumn } from '../common/BespokeTable';
import { useIsMobile } from '../../hooks/useIsMobile';
import { PipelineHealthCard, BenchmarkConfigModal } from '../pipeline-health';
import { PipelineBenchmarkConfig, HistoricalBenchmarkResult } from '../../types/pipelineTypes';

interface OverviewTabProps {
  overview: OverviewMetrics;
  weeklyTrends: WeeklyTrend[];
  dataHealth: DataHealth;
  filters: MetricFilters;
  onSelectRecruiter: (recruiterId: string) => void;
  // Raw data for drill-down and pipeline health
  candidates: Candidate[];
  requisitions: Requisition[];
  users: User[];
  events: Event[];
  hmFriction: HiringManagerFriction[];
  config: DashboardConfig;
  onUpdateConfig: (config: DashboardConfig) => void;
}

export function OverviewTab({
  overview,
  weeklyTrends,
  dataHealth,
  filters,
  onSelectRecruiter,
  candidates,
  requisitions,
  users,
  events,
  hmFriction,
  config,
  onUpdateConfig
}: OverviewTabProps) {
  const isMobile = useIsMobile();
  const chartHeight = isMobile ? 180 : 220;

  const [drillDown, setDrillDown] = useState<{
    isOpen: boolean;
    type: DrillDownType;
    title: string;
    formula?: string;
    totalValue?: string | number;
  } | null>(null);

  // Funnel chart metric selection
  type FunnelMetricKey = 'applicants' | 'screens' | 'hmReview' | 'onsites' | 'offers' | 'hires';

  const funnelMetrics: { key: FunnelMetricKey; label: string; dataKey: string; color: string }[] = [
    { key: 'applicants', label: 'Applicants', dataKey: 'applicants', color: '#64748b' },
    { key: 'screens', label: 'Screens', dataKey: 'screens', color: '#0f766e' },
    { key: 'hmReview', label: 'HM Review', dataKey: 'submissions', color: '#7c3aed' },
    { key: 'onsites', label: 'Onsites', dataKey: 'onsites', color: '#d97706' },
    { key: 'offers', label: 'Offers', dataKey: 'offers', color: '#6366f1' },
    { key: 'hires', label: 'Hires', dataKey: 'hires', color: '#059669' }
  ];

  // Default to showing Offers and Hires
  const [selectedFunnelMetrics, setSelectedFunnelMetrics] = useState<Set<FunnelMetricKey>>(
    new Set(['offers', 'hires'])
  );

  const toggleFunnelMetric = (key: FunnelMetricKey) => {
    setSelectedFunnelMetrics(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const resetFunnelMetrics = () => {
    setSelectedFunnelMetrics(new Set(['offers', 'hires']));
  };

  // Pipeline Health state
  const [showBenchmarkConfig, setShowBenchmarkConfig] = useState(false);
  const [historicalBenchmarks, setHistoricalBenchmarks] = useState<HistoricalBenchmarkResult | null>(null);
  const [isLoadingHistorical, setIsLoadingHistorical] = useState(false);

  // Calculate pipeline health
  const pipelineHealth = useMemo(() => {
    if (!requisitions.length || !candidates.length) return null;
    return calculatePipelineHealth(
      requisitions,
      candidates,
      events,
      users,
      hmFriction,
      config,
      filters
    );
  }, [requisitions, candidates, events, users, hmFriction, config, filters]);

  // Load historical benchmarks
  const handleLoadHistorical = () => {
    setIsLoadingHistorical(true);
    // Simulate async for UI feedback
    setTimeout(() => {
      const result = generateHistoricalBenchmarks(requisitions, candidates, events, config);
      setHistoricalBenchmarks(result);
      setIsLoadingHistorical(false);
    }, 100);
  };

  // Save benchmark config
  const handleSaveBenchmarks = (newConfig: PipelineBenchmarkConfig) => {
    onUpdateConfig({
      ...config,
      pipelineBenchmarks: newConfig
    });
  };

  // Custom tooltip with funnel conversion ratios
  const FunnelTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || payload.length === 0) return null;

    // Get the data point values
    const data = payload[0]?.payload || {};

    // Get active metrics in funnel order
    const activeMetrics = funnelMetrics.filter(m => selectedFunnelMetrics.has(m.key));

    // Calculate conversion ratios between adjacent stages
    const ratios: { from: string; to: string; ratio: number | null }[] = [];
    for (let i = 0; i < activeMetrics.length - 1; i++) {
      const fromMetric = activeMetrics[i];
      const toMetric = activeMetrics[i + 1];
      const fromValue = data[fromMetric.dataKey] || 0;
      const toValue = data[toMetric.dataKey] || 0;
      const ratio = fromValue > 0 ? (toValue / fromValue) * 100 : null;
      ratios.push({
        from: fromMetric.label,
        to: toMetric.label,
        ratio
      });
    }

    return (
      <div style={{
        backgroundColor: 'white',
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        padding: '12px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        minWidth: '180px',
        zIndex: 9999,
        position: 'relative'
      }}>
        <div style={{ fontWeight: 600, marginBottom: '8px', color: '#1e293b' }}>{label}</div>

        {/* Values */}
        {activeMetrics.map(metric => {
          const value = data[metric.dataKey] || 0;
          return (
            <div key={metric.key} style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '2px 0',
              fontSize: '0.85rem'
            }}>
              <span style={{ color: metric.color, fontWeight: 500 }}>{metric.label}</span>
              <span style={{ fontWeight: 600 }}>{value}</span>
            </div>
          );
        })}

        {/* Conversion ratios */}
        {ratios.length > 0 && (
          <>
            <div style={{
              borderTop: '1px solid #e2e8f0',
              marginTop: '8px',
              paddingTop: '8px',
              fontSize: '0.75rem',
              color: '#64748b'
            }}>
              <div style={{ fontWeight: 500, marginBottom: '4px' }}>Conversion Rates</div>
              {ratios.map((r, idx) => (
                <div key={idx} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '1px 0'
                }}>
                  <span>{r.from} → {r.to}</span>
                  <span style={{ fontWeight: 600, color: r.ratio !== null && r.ratio >= 50 ? '#059669' : '#64748b' }}>
                    {r.ratio !== null ? `${r.ratio.toFixed(0)}%` : '—'}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    );
  };

  // Sorting state for leaderboard
  const [sortColumn, setSortColumn] = useState<string>('productivity');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Multi-select state for recruiters
  const [selectedRecruiterIds, setSelectedRecruiterIds] = useState<Set<string>>(new Set());

  const handleSort = (key: string, direction: 'asc' | 'desc') => {
    setSortColumn(key);
    setSortDirection(direction);
  };

  // Toggle recruiter selection
  const toggleRecruiterSelection = (recruiterId: string) => {
    setSelectedRecruiterIds(prev => {
      const next = new Set(prev);
      if (next.has(recruiterId)) {
        next.delete(recruiterId);
      } else {
        next.add(recruiterId);
      }
      return next;
    });
  };

  // Select all / clear all
  const handleSelectAll = () => {
    if (selectedRecruiterIds.size === sortedRecruiters.length) {
      setSelectedRecruiterIds(new Set());
    } else {
      setSelectedRecruiterIds(new Set(sortedRecruiters.map(r => r.recruiterId)));
    }
  };

  // Navigate to selected recruiter(s)
  const handleViewSelected = () => {
    if (selectedRecruiterIds.size === 1) {
      onSelectRecruiter(Array.from(selectedRecruiterIds)[0]);
    }
  };

  // Clear selection
  const clearSelection = () => setSelectedRecruiterIds(new Set());

  // Check if any top-level filters are active (from filter bar)
  const hasTopFilters = useMemo(() => {
    return (
      (filters.recruiterIds?.length || 0) > 0 ||
      (filters.functions?.length || 0) > 0 ||
      (filters.jobFamilies?.length || 0) > 0 ||
      (filters.levels?.length || 0) > 0 ||
      (filters.regions?.length || 0) > 0 ||
      (filters.hiringManagerIds?.length || 0) > 0 ||
      (filters.sources?.length || 0) > 0 ||
      (filters.locationTypes?.length || 0) > 0
    );
  }, [filters]);

  // Calculate unfiltered totals from raw data (for showing context when top filters active)
  const unfilteredTotals = useMemo(() => {
    if (!hasTopFilters) return null;

    // Count all hires
    const hires = candidates.filter(c =>
      c.current_stage === 'Hired' || c.disposition === 'Hired'
    ).length;

    // Count all offers
    const offers = candidates.filter(c => c.offer_extended_at).length;

    // Calculate weighted hires from all requisitions with hires
    const hiredCandidates = candidates.filter(c =>
      c.current_stage === 'Hired' || c.disposition === 'Hired'
    );
    // Simple weighted calculation - sum of complexity scores for hired candidates
    // For now use a simple 1:1 ratio, could be enhanced with complexity scoring
    const weightedHires = hires; // Simplified for now

    // Count open reqs for baseline comparison (stalled calc requires event data)
    const openReqs = requisitions.filter(r => r.status === 'Open').length;

    return {
      hires,
      offers,
      weightedHires,
      openReqs
    };
  }, [hasTopFilters, candidates, requisitions]);

  // Calculate filtered stats when recruiters are selected from leaderboard
  const filteredStats = useMemo(() => {
    if (selectedRecruiterIds.size === 0) return null;

    const filteredRecruiters = overview.recruiterSummaries.filter(r =>
      selectedRecruiterIds.has(r.recruiterId)
    );

    const hires = filteredRecruiters.reduce((sum, r) => sum + r.outcomes.hires, 0);
    const offers = filteredRecruiters.reduce((sum, r) => sum + r.outcomes.offersExtended, 0);
    const weighted = filteredRecruiters.reduce((sum, r) => sum + r.weighted.weightedHires, 0);
    const openReqs = filteredRecruiters.reduce((sum, r) => sum + r.aging.openReqCount, 0);
    const screens = filteredRecruiters.reduce((sum, r) => sum + r.executionVolume.screensCompleted, 0);
    const stalled = filteredRecruiters.reduce((sum, r) => sum + r.aging.stalledReqs.count, 0);

    return {
      count: filteredRecruiters.length,
      hires,
      offers,
      weightedHires: weighted,
      openReqs,
      screens,
      stalled
    };
  }, [selectedRecruiterIds, overview.recruiterSummaries]);

  const getSortValue = (r: RecruiterSummary, column: string): number => {
    switch (column) {
      case 'hires': return r.outcomes.hires;
      case 'weighted': return r.weighted.weightedHires;
      case 'offers': return r.outcomes.offersExtended;
      case 'accept': return r.outcomes.offerAcceptanceRate ?? 0;
      case 'openReqs': return r.aging.openReqCount;
      case 'stalled': return r.aging.stalledReqs.count;
      case 'outreach': return r.executionVolume.outreachSent;
      case 'screens': return r.executionVolume.screensCompleted;
      case 'submittals': return r.executionVolume.submittalsToHM;
      case 'productivity': return r.productivityIndex;
      default: return 0;
    }
  };

  const sortedRecruiters = [...overview.recruiterSummaries].sort((a, b) => {
    const aVal = getSortValue(a, sortColumn);
    const bVal = getSortValue(b, sortColumn);
    return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
  });

  const isLowConfidence = (metric: string) =>
    dataHealth.lowConfidenceMetrics.includes(metric);

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

  // Build complexity scores map from all recruiter summaries
  const complexityScoresMap = useMemo(() => {
    const map = new Map<string, { totalScore: number; levelWeight: number; hmWeight: number }>();
    overview.recruiterSummaries.forEach(r => {
      r.weighted.complexityScores.forEach(cs => {
        map.set(cs.reqId, {
          totalScore: cs.totalScore,
          levelWeight: cs.levelWeight,
          hmWeight: cs.hmWeight
        });
      });
    });
    return map;
  }, [overview.recruiterSummaries]);

  // Build drill-down records based on type
  const getDrillDownRecords = useMemo(() => {
    if (!drillDown) return [];
    switch (drillDown.type) {
      case 'hires':
        return buildHiresRecords(candidates, requisitions, users);
      case 'weightedHires':
        return buildHiresRecords(candidates, requisitions, users, complexityScoresMap);
      case 'offers':
        return buildOffersRecords(candidates, requisitions, users);
      case 'offerAcceptRate':
        return buildOffersRecords(candidates, requisitions, users);
      case 'medianTTF':
        return buildTTFRecords(candidates, requisitions, users);
      case 'openReqs':
        return buildReqsRecords(requisitions.filter(r => r.status === 'Open'), users);
      case 'stalledReqs':
        // Get stalled req IDs from all recruiter summaries
        const stalledReqIds = new Set(overview.recruiterSummaries.flatMap(r => r.aging.stalledReqs.reqIds));
        return buildReqsRecords(requisitions.filter(r => stalledReqIds.has(r.req_id)), users);
      default:
        return [];
    }
  }, [drillDown, candidates, requisitions, users, complexityScoresMap, overview.recruiterSummaries]);

  // Format trend data for charts (team totals)
  const trendData = useMemo(() => weeklyTrends.map(t => ({
    week: format(t.weekStart, 'MMM d'),
    weekStart: t.weekStart,
    hires: t.hires,
    offers: t.offers,
    hmLatency: t.hmLatencyMedian ? Math.round(t.hmLatencyMedian) : 0,
    outreach: t.outreachSent,
    screens: t.screens,
    submissions: t.submissions,
    stageChanges: t.stageChanges,
    applicants: t.applicants,
    onsites: t.onsites,
    weightedHires: t.weightedHires,
    openReqCount: t.openReqCount,
    productivityIndex: t.productivityIndex
  })), [weeklyTrends]);

  // Calculate filtered trend data when recruiters are selected
  const chartData = useMemo(() => {
    if (selectedRecruiterIds.size === 0) {
      // No selection - just use team data with null selected values
      return trendData.map(d => ({
        ...d,
        selectedHires: null,
        selectedOffers: null,
        selectedApplicants: null,
        selectedScreens: null,
        selectedSubmissions: null,
        selectedOnsites: null
      }));
    }

    // Get requisition IDs for selected recruiters
    const selectedReqIds = new Set(
      requisitions
        .filter(r => selectedRecruiterIds.has(r.recruiter_id))
        .map(r => r.req_id)
    );

    // Calculate per-week metrics for selected recruiters
    const openReqCount = requisitions.filter(r => r.status === 'Open').length || 1;
    const selectionRatio = selectedReqIds.size / openReqCount;

    return trendData.map(d => {
      // Count hires for selected recruiters in this week
      const weekHires = candidates.filter(c => {
        if (!selectedReqIds.has(c.req_id)) return false;
        if (c.current_stage !== 'Hired' && c.disposition !== 'Hired') return false;
        const hireDate = c.hired_at ? new Date(c.hired_at) : null;
        return hireDate && isSameWeek(hireDate, d.weekStart, { weekStartsOn: 1 });
      }).length;

      // Count offers for selected recruiters in this week
      const weekOffers = candidates.filter(c => {
        if (!selectedReqIds.has(c.req_id)) return false;
        const offerDate = c.offer_extended_at ? new Date(c.offer_extended_at) : null;
        return offerDate && isSameWeek(offerDate, d.weekStart, { weekStartsOn: 1 });
      }).length;

      // Count applicants for selected recruiters in this week
      const weekApplicants = candidates.filter(c => {
        if (!selectedReqIds.has(c.req_id)) return false;
        const appliedDate = c.applied_at ? new Date(c.applied_at) : null;
        return appliedDate && isSameWeek(appliedDate, d.weekStart, { weekStartsOn: 1 });
      }).length;

      // Activity metrics: approximate using req ratio for events
      const selectedScreens = Math.round(d.screens * selectionRatio);
      const selectedSubmissions = Math.round(d.submissions * selectionRatio);
      const selectedOnsites = Math.round(d.onsites * selectionRatio);

      return {
        ...d,
        selectedHires: weekHires,
        selectedOffers: weekOffers,
        selectedApplicants: weekApplicants,
        selectedScreens,
        selectedSubmissions,
        selectedOnsites,
        // For layered view, calculate "team" (non-selected) values
        teamHires: d.hires - weekHires,
        teamOffers: d.offers - weekOffers,
        teamApplicants: d.applicants - weekApplicants,
        teamScreens: d.screens - selectedScreens,
        teamSubmissions: d.submissions - selectedSubmissions,
        teamOnsites: d.onsites - selectedOnsites
      };
    });
  }, [trendData, selectedRecruiterIds, requisitions, candidates]);

  const isFiltered = selectedRecruiterIds.size > 0 || hasTopFilters;

  // Determine which recruiters to show as "selected" based on filter context
  const effectiveSelectedKeys = useMemo(() => {
    // If user has manually selected recruiters from the leaderboard, use that
    if (selectedRecruiterIds.size > 0) {
      return selectedRecruiterIds;
    }

    // If specific recruiters are selected via top filter bar, show those as checked
    if (filters.recruiterIds?.length) {
      return new Set(filters.recruiterIds);
    }

    // If other top filters are active (function, level, etc.) but not recruiterIds,
    // show all visible recruiters as checked to indicate they match the filter
    if (hasTopFilters) {
      return new Set(sortedRecruiters.map(r => r.recruiterId));
    }

    return selectedRecruiterIds;
  }, [hasTopFilters, selectedRecruiterIds, sortedRecruiters, filters.recruiterIds]);

  const handleExport = () => {
    exportRecruiterSummaryCSV(overview.recruiterSummaries, filters);
  };

  return (
    <div>
      {/* KPI Cards - 7 cards using flex for equal width */}
      <div className="d-flex gap-3 mb-4" style={{ flexWrap: 'nowrap', overflowX: 'auto' }}>
        <div style={{ flex: '1 1 0', minWidth: '120px' }}>
          <KPICard
            title="Hires"
            value={filteredStats ? filteredStats.hires : overview.totalHires}
            contextTotal={
              filteredStats ? overview.totalHires :
              (hasTopFilters && unfilteredTotals) ? unfilteredTotals.hires : undefined
            }
            priorPeriod={!filteredStats && !hasTopFilters && overview.priorPeriod ? {
              value: overview.priorPeriod.hires,
              label: overview.priorPeriod.label
            } : undefined}
            onClick={() => openDrillDown('hires', 'Hires', overview.totalHires)}
          />
        </div>
        <div style={{ flex: '1 1 0', minWidth: '120px' }}>
          <KPICard
            title="Weighted Hires"
            value={filteredStats ? parseFloat(filteredStats.weightedHires.toFixed(1)) : parseFloat(overview.totalWeightedHires.toFixed(1))}
            contextTotal={
              filteredStats ? parseFloat(overview.totalWeightedHires.toFixed(1)) :
              (hasTopFilters && unfilteredTotals) ? unfilteredTotals.weightedHires : undefined
            }
            priorPeriod={!filteredStats && !hasTopFilters && overview.priorPeriod ? {
              value: parseFloat(overview.priorPeriod.weightedHires.toFixed(1)),
              label: overview.priorPeriod.label
            } : undefined}
            lowConfidence={isLowConfidence('Weighted Metrics')}
            onClick={() => openDrillDown('weightedHires', 'Weighted Hires', overview.totalWeightedHires.toFixed(1))}
          />
        </div>
        <div style={{ flex: '1 1 0', minWidth: '120px' }}>
          <KPICard
            title="Offers"
            value={filteredStats ? filteredStats.offers : overview.totalOffers}
            contextTotal={
              filteredStats ? overview.totalOffers :
              (hasTopFilters && unfilteredTotals) ? unfilteredTotals.offers : undefined
            }
            priorPeriod={!filteredStats && !hasTopFilters && overview.priorPeriod ? {
              value: overview.priorPeriod.offers,
              label: overview.priorPeriod.label
            } : undefined}
            onClick={() => openDrillDown('offers', 'Offers Extended', overview.totalOffers)}
          />
        </div>
        <div style={{ flex: '1 1 0', minWidth: '120px' }}>
          <KPICard
            title="Accept Rate"
            value={overview.totalOfferAcceptanceRate !== null
              ? `${(overview.totalOfferAcceptanceRate * 100).toFixed(0)}%`
              : 'N/A'}
            onClick={() => openDrillDown('offerAcceptRate', 'Offer Accept Rate', overview.totalOfferAcceptanceRate !== null ? `${(overview.totalOfferAcceptanceRate * 100).toFixed(0)}%` : 'N/A')}
          />
        </div>
        <div style={{ flex: '1 1 0', minWidth: '120px' }}>
          <KPICard
            title="Median TTF"
            value={overview.medianTTF !== null ? `${overview.medianTTF}d` : 'N/A'}
            subtitle="days"
            onClick={() => openDrillDown('medianTTF', 'Time to Fill', overview.medianTTF !== null ? `${overview.medianTTF}d` : 'N/A')}
          />
        </div>
        <div style={{ flex: '1 1 0', minWidth: '120px' }}>
          <KPICard
            title="Stalled Reqs"
            value={filteredStats ? filteredStats.stalled : overview.stalledReqCount}
            contextTotal={filteredStats ? overview.stalledReqCount : undefined}
            subtitle="no activity 14+ days"
            onClick={() => openDrillDown('stalledReqs', 'Stalled Requisitions', overview.stalledReqCount)}
          />
        </div>
        <div style={{ flex: '1 1 0', minWidth: '120px' }}>
          <KPICard
            title="Productivity"
            value={overview.recruiterSummaries.length > 0
              ? (overview.recruiterSummaries.reduce((sum, r) => sum + r.productivityIndex, 0) / overview.recruiterSummaries.length).toFixed(2)
              : '0.00'}
            subtitle="Weighted Hires ÷ Open Reqs"
          />
        </div>
      </div>

      {/* Pipeline Health + Productivity Trend Row */}
      <div className="row g-4 mb-4">
        {/* Pipeline Health Card (Compact) */}
        <div className="col-lg-4">
          <PipelineHealthCard
            healthSummary={pipelineHealth}
            compact={true}
            onConfigureClick={() => setShowBenchmarkConfig(true)}
          />
        </div>

        {/* Productivity Trend Chart */}
        <div className="col-lg-8">
          <div className="card-bespoke h-100">
            <div className="card-header">
              <div className="d-flex justify-content-between align-items-center">
                <h6 className="mb-0">Productivity Trend</h6>
                <small className="text-muted">Weighted Hires ÷ Open Reqs per Week</small>
              </div>
            </div>
            <div className="card-body">
              <ResponsiveContainer width="100%" height={180}>
                <ComposedChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="week" fontSize={11} stroke="#64748b" />
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
        </div>
      </div>

      {/* Benchmark Config Modal */}
      <BenchmarkConfigModal
        isOpen={showBenchmarkConfig}
        onClose={() => setShowBenchmarkConfig(false)}
        currentConfig={config.pipelineBenchmarks}
        historicalBenchmarks={historicalBenchmarks}
        onSave={handleSaveBenchmarks}
        onLoadHistorical={handleLoadHistorical}
        isLoadingHistorical={isLoadingHistorical}
      />

      {/* Weekly Funnel Activity Chart */}
      <div className="card-bespoke mb-4">
        <div className="card-header">
          <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
            <div className="d-flex align-items-center gap-2">
              <h6 className="mb-0">Weekly Funnel Activity</h6>
              {isFiltered && <span className="badge-bespoke badge-primary-soft small">Filtered</span>}
            </div>
            <div className="d-flex align-items-center gap-2 flex-wrap">
              {/* Metric toggle chips */}
              {funnelMetrics.map(metric => {
                const isActive = selectedFunnelMetrics.has(metric.key);
                return (
                  <button
                    key={metric.key}
                    type="button"
                    onClick={() => toggleFunnelMetric(metric.key)}
                    className="btn btn-sm"
                    style={{
                      fontSize: '0.75rem',
                      padding: '0.25rem 0.6rem',
                      borderRadius: '12px',
                      border: `1.5px solid ${metric.color}`,
                      backgroundColor: isActive ? metric.color : 'transparent',
                      color: isActive ? 'white' : metric.color,
                      fontWeight: 500,
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {metric.label}
                  </button>
                );
              })}
              {/* Reset button */}
              {selectedFunnelMetrics.size !== 2 || !selectedFunnelMetrics.has('offers') || !selectedFunnelMetrics.has('hires') ? (
                <button
                  type="button"
                  onClick={resetFunnelMetrics}
                  className="btn btn-sm btn-bespoke-ghost"
                  style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem' }}
                >
                  Reset
                </button>
              ) : null}
            </div>
          </div>
        </div>
        <div className="card-body">
          <ResponsiveContainer width="100%" height={chartHeight + 30}>
            <ComposedChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="week" fontSize={12} stroke="#64748b" />
              <YAxis fontSize={12} stroke="#64748b" />
              <Tooltip content={<FunnelTooltip />} />
              <Legend />
              {/* Render selected metrics */}
              {funnelMetrics.filter(m => selectedFunnelMetrics.has(m.key)).map(metric => {
                const selectedKey = `selected${metric.dataKey.charAt(0).toUpperCase() + metric.dataKey.slice(1)}`;

                return (
                  <React.Fragment key={metric.key}>
                    {/* Team data as faded area */}
                    <Area
                      type="monotone"
                      dataKey={metric.dataKey}
                      fill={metric.color}
                      fillOpacity={isFiltered ? 0.1 : 0.2}
                      stroke={metric.color}
                      strokeWidth={isFiltered ? 1 : 2.5}
                      strokeOpacity={isFiltered ? 0.3 : 1}
                      name={isFiltered ? `Team ${metric.label}` : metric.label}
                    />
                    {/* Selected data as solid line (only when filtered) */}
                    {isFiltered && (
                      <Line
                        type="monotone"
                        dataKey={selectedKey}
                        stroke={metric.color}
                        strokeWidth={3}
                        name={`Selected ${metric.label}`}
                        dot={{ fill: metric.color, strokeWidth: 0, r: 3 }}
                      />
                    )}
                  </React.Fragment>
                );
              })}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recruiter Leaderboard */}
      <div className="card-bespoke">
        <div className="card-header d-flex justify-content-between align-items-center">
          <div className="d-flex align-items-center gap-3">
            <h6 className="mb-0">Recruiter Leaderboard</h6>
            {hasTopFilters && selectedRecruiterIds.size === 0 && (
              <span className="badge-bespoke badge-primary-soft">{sortedRecruiters.length} filtered</span>
            )}
            {selectedRecruiterIds.size > 0 && (
              <span className="badge-bespoke badge-primary-soft">{selectedRecruiterIds.size} selected</span>
            )}
          </div>
          <div className="d-flex gap-2">
            {selectedRecruiterIds.size > 0 && (
              <>
                {selectedRecruiterIds.size === 1 && (
                  <button className="btn btn-bespoke-primary btn-sm" onClick={handleViewSelected}>
                    View Details
                  </button>
                )}
                <button className="btn btn-bespoke-secondary btn-sm" onClick={clearSelection}>
                  Clear Selection
                </button>
              </>
            )}
            <button className="btn btn-bespoke-secondary btn-sm" onClick={handleExport}>
              Export CSV
            </button>
          </div>
        </div>
        <div className="card-body p-0">
          <BespokeTable<RecruiterSummary>
            columns={[
              {
                key: 'recruiterName',
                header: 'Recruiter',
                width: '140px',
                render: (r) => (
                  <div>
                    <div className="cell-primary text-truncate" style={{ maxWidth: '130px' }} title={r.recruiterName}>{r.recruiterName}</div>
                    {r.team && <small className="cell-muted cell-small">{r.team}</small>}
                  </div>
                )
              },
              { key: 'hires', header: 'Hires', align: 'right', sortable: true, width: '55px', render: (r) => r.outcomes.hires },
              { key: 'weighted', header: 'Wtd', align: 'right', sortable: true, width: '50px', render: (r) => r.weighted.weightedHires.toFixed(1) },
              { key: 'offers', header: 'Offers', align: 'right', sortable: true, width: '55px', render: (r) => r.outcomes.offersExtended },
              { key: 'accept', header: 'Acc%', align: 'right', sortable: true, width: '50px', render: (r) => r.outcomes.offerAcceptanceRate !== null ? `${(r.outcomes.offerAcceptanceRate * 100).toFixed(0)}%` : '—' },
              { key: 'openReqs', header: 'Open', align: 'right', sortable: true, width: '50px', render: (r) => r.aging.openReqCount },
              {
                key: 'stalled',
                header: 'Stall',
                align: 'right',
                sortable: true,
                width: '50px',
                render: (r) => r.aging.stalledReqs.count > 0
                  ? <span className="badge-bespoke badge-warning-soft">{r.aging.stalledReqs.count}</span>
                  : <span className="cell-muted">{r.aging.stalledReqs.count}</span>
              },
              { key: 'outreach', header: 'Out', align: 'right', sortable: true, width: '50px', cellClass: 'cell-muted', render: (r) => r.executionVolume.outreachSent },
              { key: 'screens', header: 'Scr', align: 'right', sortable: true, width: '45px', cellClass: 'cell-muted', render: (r) => r.executionVolume.screensCompleted },
              { key: 'submittals', header: 'Sub', align: 'right', sortable: true, width: '45px', cellClass: 'cell-muted', render: (r) => r.executionVolume.submittalsToHM },
              {
                key: 'productivity',
                header: 'Prod',
                align: 'right',
                sortable: true,
                width: '60px',
                render: (r) => <span className="badge-bespoke badge-accent-soft">{r.productivityIndex.toFixed(2)}</span>
              }
            ]}
            data={sortedRecruiters}
            keyExtractor={(r) => r.recruiterId}
            sortColumn={sortColumn}
            sortDirection={sortDirection}
            onSort={handleSort}
            onRowClick={(r) => toggleRecruiterSelection(r.recruiterId)}
            selectable={true}
            selectedKeys={effectiveSelectedKeys}
            onSelectionChange={setSelectedRecruiterIds}
            emptyState={
              <div>
                <div className="empty-state-icon">👥</div>
                <div>No recruiters found</div>
              </div>
            }
          />
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
