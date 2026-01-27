'use client';

import React, { useState, useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, Area, ComposedChart
} from 'recharts';
import { format, isSameWeek } from 'date-fns';
import {
  TrendingUp, TrendingDown, Minus, Settings2, Download, ChevronRight,
  HelpCircle, CheckCircle, AlertTriangle, Clock, Activity
} from 'lucide-react';
import { useDashboard } from '../../hooks/useDashboardContext';
import { RecruiterSummary, WeeklyTrend } from '../../types';
import { DataDrillDownModal, DrillDownType, buildHiresRecords, buildOffersRecords, buildReqsRecords, buildTTFRecords } from '../common/DataDrillDownModal';
import { METRIC_FORMULAS } from '../common/MetricDrillDown';
import { exportRecruiterSummaryCSV, calculatePipelineHealth, generateHistoricalBenchmarks } from '../../services';
import { BespokeTable } from '../common/BespokeTable';
import { useIsMobile } from '../../hooks/useIsMobile';
import { BenchmarkConfigModal } from '../pipeline-health';
import { PipelineBenchmarkConfig, HistoricalBenchmarkResult, PipelineHealthSummary } from '../../types/pipelineTypes';

interface OverviewTabV2Props {
  onSelectRecruiter: (recruiterId: string) => void;
}

// V0 Design: KPI Card Component
function KPICardV2({
  label,
  value,
  subtitle,
  trend,
  priorValue,
  priorLabel,
  contextTotal,
  onClick,
  lowConfidence
}: {
  label: string;
  value: string | number;
  subtitle?: string;
  trend?: 'up' | 'down' | 'neutral';
  priorValue?: string | number;
  priorLabel?: string;
  contextTotal?: number;
  onClick?: () => void;
  lowConfidence?: boolean;
}) {
  const trendColor = trend === 'up' ? 'text-good' : trend === 'down' ? 'text-bad' : 'text-muted-foreground';
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;

  return (
    <button
      type="button"
      onClick={onClick}
      className="glass-panel p-4 text-left transition-all hover:bg-accent/50 hover:border-border flex-1 min-w-0 group"
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        {lowConfidence && (
          <AlertTriangle className="w-3 h-3 text-warn" />
        )}
      </div>

      {/* Accent bar - V0 uses cyan accent prominently */}
      <div className="w-8 h-0.5 bg-primary mb-3" />

      <div className="font-mono text-3xl font-bold text-foreground tracking-tight mb-1">
        {value}
      </div>

      {/* Prior period comparison */}
      {priorValue !== undefined && (
        <div className={`flex items-center gap-1 text-xs ${trendColor}`}>
          {trend && <TrendIcon className="w-3 h-3" />}
          <span>vs {priorValue}</span>
          <span className="text-muted-foreground">{priorLabel || 'prior period'}</span>
        </div>
      )}

      {/* Context total */}
      {contextTotal !== undefined && (
        <div className="text-xs text-muted-foreground">
          of {contextTotal} total
        </div>
      )}

      {/* Subtitle */}
      {subtitle && !priorValue && (
        <div className="text-xs text-muted-foreground">
          {subtitle}
        </div>
      )}
    </button>
  );
}

// V0 Design: Pipeline Health Card
function PipelineHealthCardV2({
  healthSummary,
  onConfigureClick
}: {
  healthSummary: PipelineHealthSummary | null;
  onConfigureClick: () => void;
}) {
  if (!healthSummary) {
    return (
      <div className="glass-panel p-4 h-full">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">
            Pipeline Health
          </span>
        </div>
        <div className="text-center py-8 text-muted-foreground text-sm">
          Insufficient data
        </div>
      </div>
    );
  }

  const score = healthSummary.healthScore;
  const scoreColor = score >= 80 ? 'text-good' : score >= 60 ? 'text-warn' : 'text-bad';
  const statusLabel = healthSummary.overallStatus === 'ahead' ? 'AHEAD' :
                      healthSummary.overallStatus === 'on-track' ? 'ON TRACK' :
                      healthSummary.overallStatus === 'behind' ? 'BEHIND' : 'CRITICAL';
  const statusBg = score >= 80 ? 'bg-good/20 text-good' : score >= 60 ? 'bg-warn/20 text-warn' : 'bg-bad/20 text-bad';

  // Build stage indicators from stagePerformance array
  const getStageStatus = (stageName: string) => {
    const stage = healthSummary.stagePerformance.find(s =>
      s.stageName.toLowerCase().includes(stageName.toLowerCase())
    );
    if (!stage) return 'ahead';
    return stage.durationStatus;
  };

  const stageIndicators = [
    { label: 'Screen', status: getStageStatus('screen') },
    { label: 'HM', status: getStageStatus('hm') },
    { label: 'Onsite', status: getStageStatus('onsite') },
    { label: 'Offer', status: getStageStatus('offer') },
  ];

  const getIndicatorColor = (status: string) => {
    switch (status) {
      case 'ahead': return 'bg-good';
      case 'on-track': return 'bg-accent';
      case 'behind': return 'bg-warn';
      case 'critical': return 'bg-bad';
      default: return 'bg-accent';
    }
  };

  // Get top insight for bottleneck display
  const topInsight = healthSummary.topInsights?.[0];

  return (
    <div className="glass-panel p-4 h-full">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">
          Pipeline Health
        </span>
        <button
          type="button"
          onClick={onConfigureClick}
          className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
        >
          <Settings2 className="w-4 h-4" />
        </button>
      </div>

      {/* Score and status */}
      <div className="flex items-baseline gap-2 mb-3">
        <span className={`font-mono text-4xl font-bold ${scoreColor}`}>
          {score}
        </span>
        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${statusBg}`}>
          {statusLabel}
        </span>
      </div>

      {/* TTF Progress */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-muted-foreground">TTF:</span>
          <span className="text-accent">
            {healthSummary.actualMedianTTF}d / {healthSummary.targetTTF}d target
          </span>
        </div>
      </div>

      {/* Stage indicators */}
      <div className="flex items-center justify-between mb-3">
        {stageIndicators.map((stage) => (
          <div key={stage.label} className="flex flex-col items-center gap-1">
            <div className={`w-3 h-3 rounded-full ${getIndicatorColor(stage.status)}`} />
            <span className="text-[10px] text-muted-foreground">{stage.label}</span>
          </div>
        ))}
      </div>

      {/* Top insight */}
      {topInsight && (
        <div className="rounded-md bg-blue-500/10 border border-blue-500/20 p-2 text-xs">
          <div className="flex items-start gap-2">
            <HelpCircle className="w-3.5 h-3.5 text-blue-400 mt-0.5 shrink-0" />
            <span className="text-blue-300">{topInsight.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// V0 Design: Section Header (per V0_UI_LANGUAGE.md spec)
// Title: text-lg, font-semibold, text-primary
// Subtitle: text-muted, text-sm
// Bottom border: 1px solid glass-border
function SectionHeaderV2({
  title,
  badge,
  actions
}: {
  title: string;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between mb-4 pb-3 border-b border-border">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">
          {title}
        </h3>
        {badge}
      </div>
      {actions}
    </div>
  );
}

export function OverviewTabV2({ onSelectRecruiter }: OverviewTabV2Props) {
  const { state, updateConfig } = useDashboard();
  const { overview, weeklyTrends, filters, dataStore } = state;
  const { candidates, requisitions, users, events, config } = dataStore;
  const hmFriction = state.hmFriction;

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
    { key: 'applicants', label: 'Applicants', dataKey: 'applicants', color: '#71717a' },
    { key: 'screens', label: 'Screens', dataKey: 'screens', color: '#22c55e' },
    { key: 'hmReview', label: 'HM Review', dataKey: 'submissions', color: '#a78bfa' },
    { key: 'onsites', label: 'Onsites', dataKey: 'onsites', color: '#f59e0b' },
    { key: 'offers', label: 'Offers', dataKey: 'offers', color: '#ef4444' },
    { key: 'hires', label: 'Hires', dataKey: 'hires', color: '#10b981' }
  ];

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
    setTimeout(() => {
      const result = generateHistoricalBenchmarks(requisitions, candidates, events, config);
      setHistoricalBenchmarks(result);
      setIsLoadingHistorical(false);
    }, 100);
  };

  // Save benchmark config
  const handleSaveBenchmarks = (newConfig: PipelineBenchmarkConfig) => {
    updateConfig({
      ...config,
      pipelineBenchmarks: newConfig
    });
  };

  // Sorting state for leaderboard
  const [sortColumn, setSortColumn] = useState<string>('productivity');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [selectedRecruiterIds, setSelectedRecruiterIds] = useState<Set<string>>(new Set());

  const handleSort = (key: string, direction: 'asc' | 'desc') => {
    setSortColumn(key);
    setSortDirection(direction);
  };

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

  const sortedRecruiters = useMemo(() => {
    if (!overview?.recruiterSummaries) return [];
    return [...overview.recruiterSummaries].sort((a, b) => {
      const aVal = getSortValue(a, sortColumn);
      const bVal = getSortValue(b, sortColumn);
      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    });
  }, [overview?.recruiterSummaries, sortColumn, sortDirection]);

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

  // Build complexity scores map
  const complexityScoresMap = useMemo(() => {
    if (!overview?.recruiterSummaries) return new Map();
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
  }, [overview?.recruiterSummaries]);

  // Build drill-down records
  const getDrillDownRecords = useMemo(() => {
    if (!drillDown || !overview) return [];
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
        const stalledReqIds = new Set(overview.recruiterSummaries.flatMap(r => r.aging.stalledReqs.reqIds));
        return buildReqsRecords(requisitions.filter(r => stalledReqIds.has(r.req_id)), users);
      default:
        return [];
    }
  }, [drillDown, candidates, requisitions, users, complexityScoresMap, overview]);

  // Format trend data
  const trendData = useMemo(() => {
    if (!weeklyTrends) return [];
    return weeklyTrends.map(t => ({
      week: format(t.weekStart, 'MMM d'),
      weekStart: t.weekStart,
      hires: t.hires,
      offers: t.offers,
      screens: t.screens,
      submissions: t.submissions,
      applicants: t.applicants,
      onsites: t.onsites,
      productivityIndex: t.productivityIndex
    }));
  }, [weeklyTrends]);

  // Custom tooltip for funnel chart
  const FunnelTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || payload.length === 0) return null;
    const data = payload[0]?.payload || {};
    const activeMetrics = funnelMetrics.filter(m => selectedFunnelMetrics.has(m.key));

    return (
      <div className="bg-popover border border-border rounded-md p-3 shadow-xl">
        <div className="font-semibold text-foreground mb-2">{label}</div>
        {activeMetrics.map(metric => {
          const value = data[metric.dataKey] || 0;
          return (
            <div key={metric.key} className="flex justify-between items-center gap-4 text-sm">
              <span style={{ color: metric.color }}>{metric.label}</span>
              <span className="font-mono text-muted-foreground">{value}</span>
            </div>
          );
        })}
      </div>
    );
  };

  const handleExport = () => {
    if (overview) {
      exportRecruiterSummaryCSV(overview.recruiterSummaries, filters);
    }
  };

  const handleViewSelected = () => {
    if (selectedRecruiterIds.size === 1) {
      onSelectRecruiter(Array.from(selectedRecruiterIds)[0]);
    }
  };

  if (!overview) {
    return (
      <div className="glass-panel p-8 text-center">
        <Activity className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-foreground mb-2">Overview</h3>
        <p className="text-sm text-muted-foreground">
          Import data to view overview metrics.
        </p>
      </div>
    );
  }

  const priorPeriod = overview.priorPeriod;

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-foreground tracking-tight">Overview</h2>
            <button
              type="button"
              className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            High-level KPIs, trends, and recruiter performance summary
          </p>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="flex gap-3 overflow-x-auto pb-1">
        <KPICardV2
          label="Hires"
          value={overview.totalHires}
          priorValue={priorPeriod ? priorPeriod.hires : undefined}
          priorLabel={priorPeriod?.label}
          trend={priorPeriod && overview.totalHires > priorPeriod.hires ? 'up' : 'neutral'}
          onClick={() => openDrillDown('hires', 'Hires', overview.totalHires)}
        />
        <KPICardV2
          label="Weighted Hires"
          value={overview.totalWeightedHires.toFixed(1)}
          priorValue={priorPeriod ? priorPeriod.weightedHires.toFixed(1) : undefined}
          priorLabel={priorPeriod?.label}
          trend={priorPeriod && overview.totalWeightedHires > priorPeriod.weightedHires ? 'up' : 'neutral'}
          onClick={() => openDrillDown('weightedHires', 'Weighted Hires', overview.totalWeightedHires.toFixed(1))}
          lowConfidence={false}
        />
        <KPICardV2
          label="Offers"
          value={overview.totalOffers}
          priorValue={priorPeriod ? priorPeriod.offers : undefined}
          priorLabel={priorPeriod?.label}
          trend={priorPeriod && overview.totalOffers > priorPeriod.offers ? 'up' : 'neutral'}
          onClick={() => openDrillDown('offers', 'Offers Extended', overview.totalOffers)}
        />
        <KPICardV2
          label="Accept Rate"
          value={overview.totalOfferAcceptanceRate !== null
            ? `${(overview.totalOfferAcceptanceRate * 100).toFixed(0)}%`
            : 'N/A'}
          priorValue={priorPeriod && priorPeriod.acceptRate !== null
            ? `${(priorPeriod.acceptRate * 100).toFixed(0)}%`
            : undefined}
          priorLabel={priorPeriod?.label}
          trend={priorPeriod && priorPeriod.acceptRate !== null && overview.totalOfferAcceptanceRate !== null
            ? (overview.totalOfferAcceptanceRate > priorPeriod.acceptRate ? 'up' : overview.totalOfferAcceptanceRate < priorPeriod.acceptRate ? 'down' : 'neutral')
            : undefined}
          onClick={() => openDrillDown('offerAcceptRate', 'Offer Accept Rate')}
        />
        <KPICardV2
          label="Median TTF"
          value={overview.medianTTF !== null ? `${overview.medianTTF}d` : 'N/A'}
          priorValue={priorPeriod && priorPeriod.medianTTF !== null
            ? `${priorPeriod.medianTTF}d`
            : undefined}
          priorLabel={priorPeriod?.label}
          trend={priorPeriod && priorPeriod.medianTTF !== null && overview.medianTTF !== null
            ? (overview.medianTTF < priorPeriod.medianTTF ? 'up' : overview.medianTTF > priorPeriod.medianTTF ? 'down' : 'neutral')
            : undefined}
          onClick={() => openDrillDown('medianTTF', 'Time to Fill')}
        />
        <KPICardV2
          label="Stalled Reqs"
          value={overview.stalledReqCount}
          subtitle="no activity 14+ days"
          priorValue={priorPeriod ? priorPeriod.stalledReqCount : undefined}
          priorLabel={priorPeriod?.label}
          trend={priorPeriod
            ? (overview.stalledReqCount < priorPeriod.stalledReqCount ? 'up' : overview.stalledReqCount > priorPeriod.stalledReqCount ? 'down' : 'neutral')
            : undefined}
          onClick={() => openDrillDown('stalledReqs', 'Stalled Requisitions', overview.stalledReqCount)}
        />
        <KPICardV2
          label="Productivity"
          value={overview.recruiterSummaries.length > 0
            ? (overview.recruiterSummaries.reduce((sum, r) => sum + r.productivityIndex, 0) / overview.recruiterSummaries.length).toFixed(2)
            : '0.00'}
          priorValue={priorPeriod && priorPeriod.avgProductivity !== null
            ? priorPeriod.avgProductivity.toFixed(2)
            : undefined}
          priorLabel={priorPeriod?.label}
          trend={priorPeriod && priorPeriod.avgProductivity !== null && overview.recruiterSummaries.length > 0
            ? (() => {
                const currentAvg = overview.recruiterSummaries.reduce((sum, r) => sum + r.productivityIndex, 0) / overview.recruiterSummaries.length;
                return currentAvg > priorPeriod.avgProductivity ? 'up' : currentAvg < priorPeriod.avgProductivity ? 'down' : 'neutral';
              })()
            : undefined}
        />
      </div>

      {/* Pipeline Health + Productivity Trend Row */}
      <div className="grid grid-cols-12 gap-4">
        {/* Pipeline Health Card */}
        <div className="col-span-12 lg:col-span-4">
          <PipelineHealthCardV2
            healthSummary={pipelineHealth}
            onConfigureClick={() => setShowBenchmarkConfig(true)}
          />
        </div>

        {/* Productivity Trend Chart */}
        <div className="col-span-12 lg:col-span-8">
          <div className="glass-panel p-4 h-full">
            <SectionHeaderV2
              title="Productivity Trend"
              actions={
                <span className="text-[10px] text-muted-foreground">
                  Weighted Hires / Open Reqs per Week
                </span>
              }
            />
            <ResponsiveContainer width="100%" height={180}>
              <ComposedChart data={trendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="hsl(var(--border))"
                />
                <XAxis
                  dataKey="week"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }}
                  domain={[0, 'auto']}
                  tickFormatter={(v) => v.toFixed(2)}
                />
                <Tooltip
                  formatter={(value: number | undefined) => [value != null ? value.toFixed(3) : '-', 'Productivity']}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px',
                    color: 'hsl(var(--muted-foreground))',
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: '12px'
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="productivityIndex"
                  fill="#f59e0b"
                  fillOpacity={0.15}
                  stroke="#f59e0b"
                  strokeWidth={2}
                  name="Productivity Index"
                  dot={{ fill: '#f59e0b', strokeWidth: 0, r: 2 }}
                  connectNulls
                />
              </ComposedChart>
            </ResponsiveContainer>
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
      <div className="glass-panel p-4">
        <SectionHeaderV2
          title="Weekly Funnel Activity"
          actions={
            <div className="flex items-center gap-2 flex-wrap">
              {funnelMetrics.map(metric => {
                const isActive = selectedFunnelMetrics.has(metric.key);
                return (
                  <button
                    key={metric.key}
                    type="button"
                    onClick={() => toggleFunnelMetric(metric.key)}
                    className="px-2.5 py-1 text-xs font-medium rounded-full transition-all"
                    style={{
                      border: `1.5px solid ${metric.color}`,
                      backgroundColor: isActive ? metric.color : 'transparent',
                      color: isActive ? 'white' : metric.color
                    }}
                  >
                    {metric.label}
                  </button>
                );
              })}
            </div>
          }
        />
        <ResponsiveContainer width="100%" height={chartHeight + 30}>
          <ComposedChart data={trendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="hsl(var(--border))"
            />
            <XAxis
              dataKey="week"
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }}
              dy={8}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }}
            />
            <Tooltip content={<FunnelTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: '12px', fontFamily: "'Inter', sans-serif" }}
            />
            {funnelMetrics.filter(m => selectedFunnelMetrics.has(m.key)).map(metric => (
              <Area
                key={metric.key}
                type="monotone"
                dataKey={metric.dataKey}
                fill={metric.color}
                fillOpacity={0.15}
                stroke={metric.color}
                strokeWidth={2}
                name={metric.label}
              />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Recruiter Leaderboard */}
      <div className="glass-panel overflow-hidden">
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h3 className="text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">
                Recruiter Leaderboard
              </h3>
              {selectedRecruiterIds.size > 0 && (
                <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-accent/20 text-accent">
                  {selectedRecruiterIds.size} selected
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {selectedRecruiterIds.size === 1 && (
                <button
                  type="button"
                  onClick={handleViewSelected}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md bg-accent text-white hover:bg-accent/90 transition-colors"
                >
                  View Details
                  <ChevronRight className="w-3 h-3" />
                </button>
              )}
              {selectedRecruiterIds.size > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedRecruiterIds(new Set())}
                  className="px-3 py-1.5 text-xs font-medium rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                >
                  Clear
                </button>
              )}
              <button
                type="button"
                onClick={handleExport}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                <Download className="w-3 h-3" />
                Export CSV
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <BespokeTable<RecruiterSummary>
            columns={[
              {
                key: 'recruiterName',
                header: 'Recruiter',
                width: '140px',
                render: (r) => (
                  <div>
                    <div className="text-sm font-medium text-foreground truncate max-w-[130px]" title={r.recruiterName}>
                      {r.recruiterName}
                    </div>
                    {r.team && <span className="text-xs text-muted-foreground">{r.team}</span>}
                  </div>
                )
              },
              { key: 'hires', header: 'Hires', align: 'right', sortable: true, width: '55px', render: (r) => r.outcomes.hires },
              { key: 'weighted', header: 'Wtd', align: 'right', sortable: true, width: '50px', render: (r) => r.weighted.weightedHires.toFixed(1) },
              { key: 'offers', header: 'Offers', align: 'right', sortable: true, width: '55px', render: (r) => r.outcomes.offersExtended },
              { key: 'accept', header: 'Acc%', align: 'right', sortable: true, width: '50px', render: (r) => r.outcomes.offerAcceptanceRate !== null ? `${(r.outcomes.offerAcceptanceRate * 100).toFixed(0)}%` : '-' },
              { key: 'openReqs', header: 'Open', align: 'right', sortable: true, width: '50px', render: (r) => r.aging.openReqCount },
              {
                key: 'stalled',
                header: 'Stall',
                align: 'right',
                sortable: true,
                width: '50px',
                render: (r) => r.aging.stalledReqs.count > 0
                  ? <span className="inline-flex items-center justify-center min-w-[20px] px-1.5 py-0.5 rounded text-[10px] font-medium bg-warn/20 text-warn">{r.aging.stalledReqs.count}</span>
                  : <span className="text-muted-foreground">{r.aging.stalledReqs.count}</span>
              },
              { key: 'outreach', header: 'Out', align: 'right', sortable: true, width: '50px', cellClass: 'text-muted-foreground', render: (r) => r.executionVolume.outreachSent },
              { key: 'screens', header: 'Scr', align: 'right', sortable: true, width: '45px', cellClass: 'text-muted-foreground', render: (r) => r.executionVolume.screensCompleted },
              { key: 'submittals', header: 'Sub', align: 'right', sortable: true, width: '45px', cellClass: 'text-muted-foreground', render: (r) => r.executionVolume.submittalsToHM },
              {
                key: 'productivity',
                header: 'Prod',
                align: 'right',
                sortable: true,
                width: '60px',
                render: (r) => (
                  <span className="inline-flex items-center justify-center min-w-[40px] px-1.5 py-0.5 rounded text-[10px] font-medium bg-accent/20 text-accent font-mono">
                    {r.productivityIndex.toFixed(2)}
                  </span>
                )
              }
            ]}
            data={sortedRecruiters}
            keyExtractor={(r) => r.recruiterId}
            sortColumn={sortColumn}
            sortDirection={sortDirection}
            onSort={handleSort}
            onRowClick={(r) => toggleRecruiterSelection(r.recruiterId)}
            selectable={true}
            selectedKeys={selectedRecruiterIds}
            onSelectionChange={setSelectedRecruiterIds}
            emptyState={
              <div className="text-center py-8">
                <div className="text-2xl mb-2">No recruiters found</div>
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

export default OverviewTabV2;
