'use client';

// HMFrictionTabV2 - V0 Design Language
// Hiring Manager Latency Analysis with Time Tax metrics

import React, { useState, useMemo, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ScatterChart, Scatter, ZAxis, ReferenceLine
} from 'recharts';
import {
  TrendingUp, TrendingDown, Users, Clock, Zap, AlertTriangle,
  ChevronDown, ChevronUp, ChevronRight, Download, HelpCircle, X, Info
} from 'lucide-react';
import { useDashboard } from '../../hooks/useDashboardContext';
import { HiringManagerFriction } from '../../types';
import { exportHMFrictionCSV } from '../../services';
import { useIsMobile } from '../../hooks/useIsMobile';

// Helper to truncate long names
const truncateName = (name: string, maxLen: number) =>
  name.length > maxLen ? name.substring(0, maxLen) + '...' : name;

// V0 Design: Section Header Component
function SectionHeaderV2({
  title,
  subtitle,
  icon,
  actions
}: {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-3">
        {icon && <span className="text-xl">{icon}</span>}
        <div>
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">{title}</h3>
          {subtitle && <span className="text-xs text-muted-foreground">{subtitle}</span>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

// V0 Design: KPI Card Component
function KPICardV2({
  label,
  value,
  subtitle,
  accentColor = '#06b6d4',
  isActive,
  onClick
}: {
  label: string;
  value: string | number;
  subtitle?: string;
  accentColor?: string;
  isActive?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`glass-panel p-4 text-left transition-all hover:bg-white/[0.04] flex-1 min-w-0 ${
        isActive ? 'ring-2 ring-accent bg-white/[0.04]' : ''
      }`}
    >
      <div className="text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
        {label}
      </div>
      <div className="w-8 h-0.5 mb-3" style={{ backgroundColor: accentColor }} />
      <div className="font-mono text-3xl font-bold text-foreground tracking-tight mb-1">
        {value}
      </div>
      {subtitle && (
        <div className="text-xs text-muted-foreground flex items-center gap-1">
          {onClick && <ChevronDown className="w-3 h-3" />}
          {subtitle}
        </div>
      )}
    </button>
  );
}

// V0 Design: Badge Component
function BadgeV2({
  children,
  variant = 'neutral'
}: {
  children: React.ReactNode;
  variant?: 'neutral' | 'success' | 'warning' | 'danger' | 'info';
}) {
  const variantClasses = {
    neutral: 'bg-white/10 text-muted-foreground',
    success: 'bg-good/20 text-good',
    warning: 'bg-warn/20 text-warn',
    danger: 'bg-bad/20 text-bad',
    info: 'bg-accent/20 text-accent'
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${variantClasses[variant]}`}>
      {children}
    </span>
  );
}

// V0 Design: Collapsible Weight Legend
function WeightLegendV2() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="mt-4">
      <button
        className="glass-panel w-full flex items-center gap-2 px-4 py-3 text-sm text-left text-muted-foreground hover:text-foreground transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        <Info className="w-4 h-4" />
        <span>Understanding HM Weight</span>
      </button>
      {isOpen && (
        <div className="glass-panel mt-2 p-4">
          <p className="text-sm text-muted-foreground mb-3">
            HM Weight measures how a hiring manager's decision speed compares to the median.
            It affects the complexity score of their requisitions:
          </p>
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <BadgeV2 variant="success">0.8 - 0.95x</BadgeV2>
              <span className="text-sm text-muted-foreground">Fast - reduces complexity</span>
            </div>
            <div className="flex items-center gap-2">
              <BadgeV2 variant="neutral">0.95 - 1.05x</BadgeV2>
              <span className="text-sm text-muted-foreground">Average</span>
            </div>
            <div className="flex items-center gap-2">
              <BadgeV2 variant="warning">1.05 - 1.2x</BadgeV2>
              <span className="text-sm text-muted-foreground">Slow</span>
            </div>
            <div className="flex items-center gap-2">
              <BadgeV2 variant="danger">1.2 - 1.3x</BadgeV2>
              <span className="text-sm text-muted-foreground">Very slow - increases complexity</span>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mt-3 mb-0">
            * HMs with fewer than 3 interview loops are assigned the default weight of 1.0
          </p>
        </div>
      )}
    </div>
  );
}

// V0 Design: Chart Help Text
function ChartHelpV2({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2 mt-3 p-3 rounded-md bg-white/[0.02] border border-white/[0.05]">
      <HelpCircle className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
      <p className="text-xs text-muted-foreground">{text}</p>
    </div>
  );
}

export function HMFrictionTabV2() {
  const { state } = useDashboard();
  const { dataStore, filters, hmFriction } = state;
  const { candidates, requisitions, users, events, config } = dataStore;

  const isMobile = useIsMobile();
  const mainChartHeight = isMobile ? 280 : 380;
  const smallChartHeight = isMobile ? 220 : 280;

  const [selectedHM, setSelectedHM] = useState<string | null>(null);
  const [sortColumn, setSortColumn] = useState<keyof HiringManagerFriction>('decisionLatencyMedian');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [expandedKPI, setExpandedKPI] = useState<'totalHMs' | 'avgTimeTax' | 'latencyImpact' | 'fastHMs' | null>(null);

  // Use friction data from dashboard state (already computed)
  const friction = hmFriction || [];

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

  // Get HM IDs that have matching requisitions
  const hmIdsWithData = useMemo(() => {
    return new Set(filteredRequisitions.map(r => r.hiring_manager_id).filter(Boolean));
  }, [filteredRequisitions]);

  // Filter friction data
  const filteredFriction = useMemo(() => {
    if (filters?.hiringManagerIds?.length) {
      return friction.filter(f => filters.hiringManagerIds!.includes(f.hmId));
    }
    return friction.filter(f => hmIdsWithData.has(f.hmId));
  }, [friction, filters, hmIdsWithData]);

  const handleSort = (column: keyof HiringManagerFriction) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  const sortedFriction = [...filteredFriction].sort((a, b) => {
    const aVal = a[sortColumn];
    const bVal = b[sortColumn];
    if (aVal === null && bVal === null) return 0;
    if (aVal === null) return 1;
    if (bVal === null) return -1;
    if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  // Chart data
  const compositionChartData = useMemo(() =>
    [...filteredFriction]
      .filter(f => f.composition.totalLatencyHours > 0 || f.composition.activeTimeHours > 0)
      .sort((a, b) => {
        const totalA = a.composition.stageBreakdown.sourcingHours +
          a.composition.stageBreakdown.screeningHours +
          a.composition.stageBreakdown.hmReviewHours +
          a.composition.stageBreakdown.interviewHours +
          a.composition.stageBreakdown.feedbackHours +
          a.composition.stageBreakdown.decisionHours;
        const totalB = b.composition.stageBreakdown.sourcingHours +
          b.composition.stageBreakdown.screeningHours +
          b.composition.stageBreakdown.hmReviewHours +
          b.composition.stageBreakdown.interviewHours +
          b.composition.stageBreakdown.feedbackHours +
          b.composition.stageBreakdown.decisionHours;
        return totalB - totalA || a.hmName.localeCompare(b.hmName);
      })
      .slice(0, 12)
      .map(f => ({
        name: truncateName(f.hmName, 14),
        fullName: f.hmName,
        hmId: f.hmId,
        sourcing: f.composition.stageBreakdown.sourcingHours,
        screening: f.composition.stageBreakdown.screeningHours,
        hmReview: f.composition.stageBreakdown.hmReviewHours,
        interview: f.composition.stageBreakdown.interviewHours,
        feedback: f.composition.stageBreakdown.feedbackHours,
        decision: f.composition.stageBreakdown.decisionHours,
        activeTime: f.composition.activeTimeHours,
        totalLatency: f.composition.totalLatencyHours,
        timeTax: f.composition.timeTaxPercent,
        weight: f.hmWeight
      })),
    [filteredFriction]
  );

  // KPI calculations
  const avgTimeTax = useMemo(() =>
    compositionChartData.length > 0
      ? Math.round(compositionChartData.reduce((sum, d) => sum + d.timeTax, 0) / compositionChartData.length)
      : 0,
    [compositionChartData]
  );

  const totalLatencyImpactDays = useMemo(() =>
    filteredFriction.length > 0
      ? Math.round(filteredFriction.reduce((sum, f) => sum + f.composition.totalLatencyHours, 0) / 24)
      : 0,
    [filteredFriction]
  );

  const fastHMs = useMemo(() =>
    filteredFriction.filter(f => f.hmWeight < 0.9).sort((a, b) => a.hmWeight - b.hmWeight),
    [filteredFriction]
  );

  const hmsByLatencyImpact = useMemo(() =>
    [...filteredFriction]
      .filter(f => f.composition.totalLatencyHours > 0)
      .sort((a, b) => b.composition.totalLatencyHours - a.composition.totalLatencyHours),
    [filteredFriction]
  );

  const timeTaxDistribution = useMemo(() => {
    const buckets = [
      { label: '0-10%', min: 0, max: 10, count: 0, hms: [] as HiringManagerFriction[] },
      { label: '10-20%', min: 10, max: 20, count: 0, hms: [] as HiringManagerFriction[] },
      { label: '20-30%', min: 20, max: 30, count: 0, hms: [] as HiringManagerFriction[] },
      { label: '30-40%', min: 30, max: 40, count: 0, hms: [] as HiringManagerFriction[] },
      { label: '40-50%', min: 40, max: 50, count: 0, hms: [] as HiringManagerFriction[] },
      { label: '50%+', min: 50, max: 100, count: 0, hms: [] as HiringManagerFriction[] }
    ];
    for (const f of filteredFriction) {
      const tax = f.composition.timeTaxPercent;
      const bucket = buckets.find(b => tax >= b.min && tax < b.max) || buckets[buckets.length - 1];
      bucket.count++;
      bucket.hms.push(f);
    }
    return buckets;
  }, [filteredFriction]);

  const handleKPIClick = useCallback((kpi: 'totalHMs' | 'avgTimeTax' | 'latencyImpact' | 'fastHMs') => {
    setExpandedKPI(expandedKPI === kpi ? null : kpi);
  }, [expandedKPI]);

  const handleBarClick = useCallback((data: unknown) => {
    const item = data as { hmId?: string };
    if (item?.hmId) setSelectedHM(item.hmId);
  }, []);

  // Decay curve data
  const decayCurveData = useMemo(() => {
    return filteredFriction
      .filter(f => f.offerAcceptanceRate !== null && f.composition.totalLatencyHours > 0)
      .map(f => ({
        hmName: f.hmName,
        hmId: f.hmId,
        latencyDays: Math.round(f.composition.totalLatencyHours / 24),
        acceptanceRate: Math.round((f.offerAcceptanceRate ?? 0) * 100),
        loopCount: f.loopCount
      }))
      .sort((a, b) => a.latencyDays - b.latencyDays);
  }, [filteredFriction]);

  const avgAcceptanceRate = useMemo(() => {
    const withOffers = filteredFriction.filter(f => f.offerAcceptanceRate !== null);
    if (withOffers.length === 0) return 0;
    return Math.round(withOffers.reduce((sum, f) => sum + (f.offerAcceptanceRate ?? 0) * 100, 0) / withOffers.length);
  }, [filteredFriction]);

  // Heatmap data
  const heatmapData = useMemo(() =>
    filteredFriction
      .filter(f => f.feedbackLatencyMedian !== null || f.decisionLatencyMedian !== null)
      .sort((a, b) => b.composition.totalLatencyHours - a.composition.totalLatencyHours)
      .slice(0, 10)
      .map(f => ({
        hmName: truncateName(f.hmName, 12),
        fullName: f.hmName,
        hmId: f.hmId,
        feedback: f.feedbackLatencyMedian ? Math.round(f.feedbackLatencyMedian) : null,
        decision: f.decisionLatencyMedian ? Math.round(f.decisionLatencyMedian) : null,
        total: f.composition.totalLatencyHours
      })),
    [filteredFriction]
  );

  const getHeatmapColor = (hours: number | null, type: 'feedback' | 'decision') => {
    if (hours === null) return 'bg-white/5';
    const thresholds = type === 'feedback'
      ? { good: 24, warn: 48, bad: 72 }
      : { good: 48, warn: 72, bad: 120 };

    if (hours <= thresholds.good) return 'bg-good/20';
    if (hours <= thresholds.warn) return 'bg-warn/20';
    if (hours <= thresholds.bad) return 'bg-orange-500/20';
    return 'bg-bad/20';
  };

  const handleExport = () => {
    exportHMFrictionCSV(filteredFriction);
  };

  // Sort icon helper
  const SortIcon = ({ column }: { column: keyof HiringManagerFriction }) => {
    if (sortColumn !== column) return null;
    return sortDirection === 'desc' ? <ChevronDown className="w-3 h-3 ml-1" /> : <ChevronUp className="w-3 h-3 ml-1" />;
  };

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICardV2
          label="Total Hiring Managers"
          value={filteredFriction.length}
          subtitle="Click for details"
          accentColor="#94a3b8"
          isActive={expandedKPI === 'totalHMs'}
          onClick={() => handleKPIClick('totalHMs')}
        />
        <KPICardV2
          label="Avg Time Tax"
          value={`${avgTimeTax}%`}
          subtitle="of cycle spent waiting"
          accentColor="#ef4444"
          isActive={expandedKPI === 'avgTimeTax'}
          onClick={() => handleKPIClick('avgTimeTax')}
        />
        <KPICardV2
          label="Latency Impact"
          value={`${totalLatencyImpactDays}d`}
          subtitle="total time lost waiting"
          accentColor="#f59e0b"
          isActive={expandedKPI === 'latencyImpact'}
          onClick={() => handleKPIClick('latencyImpact')}
        />
        <KPICardV2
          label="Fast HMs"
          value={fastHMs.length}
          subtitle="Click for details"
          accentColor="#22c55e"
          isActive={expandedKPI === 'fastHMs'}
          onClick={() => handleKPIClick('fastHMs')}
        />
      </div>

      {/* KPI Drill-Down Panels */}
      {expandedKPI && (
        <div className="glass-panel p-4 border-l-2 border-accent">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">
              {expandedKPI === 'totalHMs' && 'All Hiring Managers Overview'}
              {expandedKPI === 'avgTimeTax' && 'Time Tax Distribution'}
              {expandedKPI === 'latencyImpact' && 'Latency Impact by HM'}
              {expandedKPI === 'fastHMs' && 'Fast Hiring Managers'}
            </h3>
            <button
              className="p-2 text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setExpandedKPI(null)}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Total HMs Panel */}
          {expandedKPI === 'totalHMs' && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-white/[0.02]">
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Hiring Manager</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Reqs</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Loops</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Avg Latency</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Time Tax</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Weight</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.05]">
                  {filteredFriction.slice(0, 20).map(f => (
                    <tr key={f.hmId} onClick={() => setSelectedHM(f.hmId)} className="cursor-pointer hover:bg-white/[0.02] transition-colors">
                      <td className="px-3 py-2 font-medium text-foreground">{f.hmName}</td>
                      <td className="px-3 py-2 text-right text-muted-foreground">{f.reqsInRange}</td>
                      <td className="px-3 py-2 text-right">{f.loopCount}</td>
                      <td className="px-3 py-2 text-right">
                        {f.composition.totalLatencyHours > 0 ? `${Math.round(f.composition.totalLatencyHours / 24)}d` : '-'}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <span className={f.composition.timeTaxPercent > 30 ? 'text-bad font-bold' : f.composition.timeTaxPercent > 15 ? 'text-warn' : ''}>
                          {f.composition.timeTaxPercent}%
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <BadgeV2 variant={f.hmWeight > 1.2 ? 'danger' : f.hmWeight > 1.0 ? 'warning' : f.hmWeight < 0.9 ? 'success' : 'neutral'}>
                          {f.hmWeight.toFixed(2)}x
                        </BadgeV2>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredFriction.length > 20 && (
                <div className="text-center text-muted-foreground text-sm mt-2 py-2">
                  Showing top 20 of {filteredFriction.length} HMs
                </div>
              )}
            </div>
          )}

          {/* Avg Time Tax Panel */}
          {expandedKPI === 'avgTimeTax' && (
            <div>
              <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mb-4">
                {timeTaxDistribution.map(bucket => (
                  <div
                    key={bucket.label}
                    className={`text-center p-3 rounded-lg ${bucket.min >= 30 ? 'bg-bad/15' : bucket.min >= 20 ? 'bg-warn/15' : 'bg-good/15'}`}
                  >
                    <div className="text-xs text-muted-foreground">{bucket.label}</div>
                    <div className="font-mono text-2xl font-bold text-foreground">{bucket.count}</div>
                    <div className="text-xs text-muted-foreground">HMs</div>
                  </div>
                ))}
              </div>
              <ChartHelpV2 text="HMs with >30% Time Tax are costing significant recruiting cycle time. Time Tax = the portion of hiring cycle spent waiting on the HM." />
              {timeTaxDistribution.filter(b => b.min >= 30).flatMap(b => b.hms).length > 0 && (
                <>
                  <h4 className="text-sm font-semibold text-foreground mt-4 mb-2">High Time Tax HMs (&gt;30%)</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-bad/10">
                          <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Hiring Manager</th>
                          <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Time Tax</th>
                          <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Feedback Latency</th>
                          <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Decision Latency</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.05]">
                        {timeTaxDistribution.filter(b => b.min >= 30).flatMap(b => b.hms)
                          .sort((a, b) => b.composition.timeTaxPercent - a.composition.timeTaxPercent)
                          .map(f => (
                            <tr key={f.hmId} onClick={() => setSelectedHM(f.hmId)} className="cursor-pointer hover:bg-white/[0.02] transition-colors">
                              <td className="px-3 py-2 font-medium text-foreground">{f.hmName}</td>
                              <td className="px-3 py-2 text-right text-bad font-bold">{f.composition.timeTaxPercent}%</td>
                              <td className="px-3 py-2 text-right">{f.feedbackLatencyMedian ? `${Math.round(f.feedbackLatencyMedian)} hrs` : '-'}</td>
                              <td className="px-3 py-2 text-right">{f.decisionLatencyMedian ? `${Math.round(f.decisionLatencyMedian)} hrs` : '-'}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Latency Impact Panel */}
          {expandedKPI === 'latencyImpact' && (
            <div>
              <div className="mb-4 p-4 rounded-lg bg-warn/15 flex justify-between items-center">
                <span className="text-foreground">Total latency across all HMs:</span>
                <span className="font-mono text-2xl font-bold text-warn">{totalLatencyImpactDays} days</span>
              </div>
              <h4 className="text-sm font-semibold text-foreground mb-2">Top Contributors to Latency</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-white/[0.02]">
                      <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Hiring Manager</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total Latency</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">% of Total</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Feedback</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Decision</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.05]">
                    {hmsByLatencyImpact.slice(0, 10).map(f => {
                      const pctOfTotal = totalLatencyImpactDays > 0
                        ? Math.round((f.composition.totalLatencyHours / 24) / totalLatencyImpactDays * 100)
                        : 0;
                      return (
                        <tr key={f.hmId} onClick={() => setSelectedHM(f.hmId)} className="cursor-pointer hover:bg-white/[0.02] transition-colors">
                          <td className="px-3 py-2 font-medium text-foreground">{f.hmName}</td>
                          <td className="px-3 py-2 text-right font-mono font-bold">{Math.round(f.composition.totalLatencyHours / 24)}d</td>
                          <td className="px-3 py-2 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-16 h-2 bg-white/10 rounded overflow-hidden">
                                <div className="h-full bg-warn" style={{ width: `${pctOfTotal}%` }} />
                              </div>
                              <span className="w-8">{pctOfTotal}%</span>
                            </div>
                          </td>
                          <td className="px-3 py-2 text-right">{f.composition.feedbackLatencyHours}h</td>
                          <td className="px-3 py-2 text-right">{f.composition.decisionLatencyHours}h</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Fast HMs Panel */}
          {expandedKPI === 'fastHMs' && (
            <div>
              {fastHMs.length > 0 ? (
                <>
                  <div className="mb-4 p-4 rounded-lg bg-good/15 flex justify-between items-center">
                    <span className="text-foreground">HMs with faster-than-median decision speed:</span>
                    <span className="font-mono text-2xl font-bold text-good">{fastHMs.length} HMs</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-good/10">
                          <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Hiring Manager</th>
                          <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Weight</th>
                          <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Avg Feedback</th>
                          <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Avg Decision</th>
                          <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Time Tax</th>
                          <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Offer Accept</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.05]">
                        {fastHMs.map(f => (
                          <tr key={f.hmId} onClick={() => setSelectedHM(f.hmId)} className="cursor-pointer hover:bg-white/[0.02] transition-colors">
                            <td className="px-3 py-2 font-medium text-foreground">{f.hmName}</td>
                            <td className="px-3 py-2 text-right">
                              <BadgeV2 variant="success">{f.hmWeight.toFixed(2)}x</BadgeV2>
                            </td>
                            <td className="px-3 py-2 text-right">{f.feedbackLatencyMedian ? `${Math.round(f.feedbackLatencyMedian)}h` : '-'}</td>
                            <td className="px-3 py-2 text-right">{f.decisionLatencyMedian ? `${Math.round(f.decisionLatencyMedian)}h` : '-'}</td>
                            <td className="px-3 py-2 text-right text-good">{f.composition.timeTaxPercent}%</td>
                            <td className="px-3 py-2 text-right">{f.offerAcceptanceRate ? `${Math.round(f.offerAcceptanceRate * 100)}%` : '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <ChartHelpV2 text="These HMs have lower-than-median decision latency (weight < 0.9), reducing complexity scores on their requisitions. Fast HMs help shorten time-to-fill." />
                </>
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  <Zap className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <div>No HMs currently qualify as "fast" (weight &lt; 0.9)</div>
                  <div className="text-sm mt-1">This requires at least 3 interview loops and faster-than-median decisions</div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Hiring Cycle Breakdown Chart */}
      <div className="glass-panel p-4">
        <SectionHeaderV2
          title="Hiring Cycle Breakdown"
          subtitle="Time composition by HM"
          icon="📊"
          actions={
            <div className="flex items-center gap-2 text-xs flex-wrap">
              <span className="inline-block w-3 h-3 rounded" style={{ background: '#64748b' }} /> Sourcing
              <span className="inline-block w-3 h-3 rounded" style={{ background: '#3b82f6' }} /> Screening
              <span className="inline-block w-3 h-3 rounded" style={{ background: '#14b8a6' }} /> HM Review
              <span className="inline-block w-3 h-3 rounded" style={{ background: '#22c55e' }} /> Interview
              <span className="inline-block w-3 h-3 rounded" style={{ background: '#f59e0b' }} /> Feedback
              <span className="inline-block w-3 h-3 rounded" style={{ background: '#dc2626' }} /> Decision
            </div>
          }
        />
        <ResponsiveContainer width="100%" height={mainChartHeight}>
          <BarChart data={compositionChartData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis type="number" unit=" hrs" fontSize={11} stroke="#64748b" domain={[0, 'dataMax']} />
            <YAxis type="category" dataKey="name" width={110} fontSize={11} stroke="#64748b" />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload || !payload[0]) return null;
                const d = payload[0].payload;
                const totalCycle = d.sourcing + d.screening + d.hmReview + d.interview + d.feedback + d.decision;
                return (
                  <div className="glass-panel p-3 min-w-[240px]">
                    <div className="font-bold text-foreground mb-2">{d.fullName}</div>
                    <div className="text-xs text-muted-foreground mb-2">Pipeline Stage Breakdown</div>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between"><span style={{ color: '#64748b' }}>● Sourcing:</span><strong>{d.sourcing} hrs</strong></div>
                      <div className="flex justify-between"><span style={{ color: '#3b82f6' }}>● Screening:</span><strong>{d.screening} hrs</strong></div>
                      <div className="flex justify-between"><span style={{ color: '#14b8a6' }}>● HM Review:</span><strong>{d.hmReview} hrs</strong></div>
                      <div className="flex justify-between"><span style={{ color: '#22c55e' }}>● Interview:</span><strong>{d.interview} hrs</strong></div>
                      <div className="flex justify-between"><span style={{ color: '#f59e0b' }}>● Feedback Wait:</span><strong>{d.feedback} hrs</strong></div>
                      <div className="flex justify-between"><span style={{ color: '#dc2626' }}>● Decision Wait:</span><strong>{d.decision} hrs</strong></div>
                    </div>
                    <div className="border-t border-white/10 mt-2 pt-2 space-y-1 text-sm">
                      <div className="flex justify-between"><span className="font-semibold">Total Cycle:</span><strong>{totalCycle} hrs ({Math.round(totalCycle / 24)}d)</strong></div>
                      <div className="flex justify-between">
                        <span className="font-semibold">Time Tax:</span>
                        <strong className={d.timeTax > 30 ? 'text-bad' : d.timeTax > 15 ? 'text-warn' : 'text-good'}>{d.timeTax}%</strong>
                      </div>
                    </div>
                  </div>
                );
              }}
            />
            <Bar dataKey="sourcing" stackId="a" fill="#64748b" onClick={handleBarClick} cursor="pointer" />
            <Bar dataKey="screening" stackId="a" fill="#3b82f6" onClick={handleBarClick} cursor="pointer" />
            <Bar dataKey="hmReview" stackId="a" fill="#14b8a6" onClick={handleBarClick} cursor="pointer" />
            <Bar dataKey="interview" stackId="a" fill="#22c55e" onClick={handleBarClick} cursor="pointer" />
            <Bar dataKey="feedback" stackId="a" fill="#f59e0b" onClick={handleBarClick} cursor="pointer" />
            <Bar dataKey="decision" stackId="a" fill="#dc2626" radius={[0, 4, 4, 0]} onClick={handleBarClick} cursor="pointer" />
          </BarChart>
        </ResponsiveContainer>
        <ChartHelpV2 text="Shows time in each pipeline stage. Orange (Feedback Wait) and red (Decision Wait) segments are HM latency - the 'Time Tax'. Click any bar to see that HM's detailed breakdown." />
      </div>

      {/* Advanced Visualizations Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Candidate Decay Curve */}
        <div className="glass-panel p-4">
          <SectionHeaderV2
            title="Candidate Decay Curve"
            subtitle="Offer acceptance rate vs HM latency"
            icon="📉"
          />
          {decayCurveData.length > 0 ? (
            <ResponsiveContainer width="100%" height={smallChartHeight}>
              <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis
                  type="number"
                  dataKey="latencyDays"
                  name="Latency"
                  unit=" days"
                  fontSize={11}
                  stroke="#64748b"
                  label={{ value: 'Total Latency (days)', position: 'bottom', fontSize: 11, fill: '#64748b' }}
                />
                <YAxis
                  type="number"
                  dataKey="acceptanceRate"
                  name="Acceptance"
                  unit="%"
                  fontSize={11}
                  stroke="#64748b"
                  domain={[0, 100]}
                  label={{ value: 'Offer Accept %', angle: -90, position: 'insideLeft', fontSize: 11, fill: '#64748b' }}
                />
                <ZAxis type="number" dataKey="loopCount" range={[50, 400]} name="Interview Loops" />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload || !payload[0]) return null;
                    const d = payload[0].payload;
                    return (
                      <div className="glass-panel p-2">
                        <div className="font-bold text-foreground">{d.hmName}</div>
                        <div className="text-sm">Latency: {d.latencyDays} days</div>
                        <div className="text-sm">Accept Rate: {d.acceptanceRate}%</div>
                        <div className="text-xs text-muted-foreground">({d.loopCount} loops)</div>
                      </div>
                    );
                  }}
                />
                <ReferenceLine
                  y={avgAcceptanceRate}
                  stroke="#6366f1"
                  strokeDasharray="5 5"
                  label={{ value: `Avg: ${avgAcceptanceRate}%`, position: 'right', fontSize: 10, fill: '#6366f1' }}
                />
                <Scatter
                  name="HMs"
                  data={decayCurveData}
                  fill="#059669"
                  onClick={(data) => { if (data?.hmId) setSelectedHM(data.hmId); }}
                  cursor="pointer"
                />
              </ScatterChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <AlertTriangle className="w-8 h-8 mb-2 opacity-50" />
              <div>No offer data available</div>
            </div>
          )}
          <ChartHelpV2 text="Larger dots = more interview loops. Points below the average line indicate declining acceptance as latency increases. HMs in the upper-left quadrant are ideal: fast decisions, high acceptance." />
        </div>

        {/* Stage-by-Stage Heatmap */}
        <div className="glass-panel p-4">
          <SectionHeaderV2
            title="Stage Latency Heatmap"
            subtitle="Top 10 HMs by total latency"
            icon="🗺️"
            actions={
              <div className="flex items-center gap-2 text-xs">
                <span className="inline-block w-3 h-3 rounded bg-good/30" /> Fast
                <span className="inline-block w-3 h-3 rounded bg-warn/30" /> Slow
                <span className="inline-block w-3 h-3 rounded bg-bad/30" /> Very Slow
              </div>
            }
          />
          {heatmapData.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-white/[0.02]">
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">HM</th>
                    <th className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">Feedback (hrs)</th>
                    <th className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">Decision (hrs)</th>
                    <th className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total (hrs)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.05]">
                  {heatmapData.map(row => (
                    <tr
                      key={row.hmId}
                      onClick={() => setSelectedHM(row.hmId)}
                      className={`cursor-pointer transition-colors ${selectedHM === row.hmId ? 'bg-accent/10' : 'hover:bg-white/[0.02]'}`}
                    >
                      <td className="px-3 py-2" title={row.fullName}>
                        <span className="font-medium text-foreground">{row.hmName}</span>
                      </td>
                      <td className={`px-3 py-2 text-center font-mono font-medium ${getHeatmapColor(row.feedback, 'feedback')}`}>
                        {row.feedback ?? '-'}
                      </td>
                      <td className={`px-3 py-2 text-center font-mono font-medium ${getHeatmapColor(row.decision, 'decision')}`}>
                        {row.decision ?? '-'}
                      </td>
                      <td className="px-3 py-2 text-center font-mono font-bold">
                        {Math.round(row.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <AlertTriangle className="w-8 h-8 mb-2 opacity-50" />
              <div>No latency data available</div>
            </div>
          )}
          <ChartHelpV2 text="Color indicates speed: green = fast (≤24h feedback, ≤48h decision), yellow = moderate, orange = slow, red = very slow (>72h feedback, >120h decision). Click a row to see that HM's requisitions." />
        </div>
      </div>

      {/* All Hiring Managers Table */}
      <div className="glass-panel overflow-hidden">
        <div className="p-4 border-b border-white/[0.08] flex justify-between items-center">
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">All Hiring Managers</h3>
          <button
            className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground border border-white/10 rounded hover:bg-white/5 transition-colors flex items-center gap-2"
            onClick={handleExport}
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-white/[0.02]">
                <th
                  className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground cursor-pointer hover:text-foreground"
                  onClick={() => handleSort('hmName')}
                >
                  <span className="flex items-center">Hiring Manager <SortIcon column="hmName" /></span>
                </th>
                <th
                  className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground cursor-pointer hover:text-foreground"
                  onClick={() => handleSort('reqsInRange')}
                >
                  <span className="flex items-center justify-end">Reqs <SortIcon column="reqsInRange" /></span>
                </th>
                <th
                  className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground cursor-pointer hover:text-foreground"
                  onClick={() => handleSort('loopCount')}
                >
                  <span className="flex items-center justify-end">Interview Loops <SortIcon column="loopCount" /></span>
                </th>
                <th
                  className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground cursor-pointer hover:text-foreground"
                  onClick={() => handleSort('feedbackLatencyMedian')}
                >
                  <span className="flex items-center justify-end">Feedback Latency <SortIcon column="feedbackLatencyMedian" /></span>
                </th>
                <th
                  className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground cursor-pointer hover:text-foreground"
                  onClick={() => handleSort('decisionLatencyMedian')}
                >
                  <span className="flex items-center justify-end">Decision Latency <SortIcon column="decisionLatencyMedian" /></span>
                </th>
                <th
                  className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground cursor-pointer hover:text-foreground"
                  onClick={() => handleSort('offerAcceptanceRate')}
                >
                  <span className="flex items-center justify-end">Offer Accept % <SortIcon column="offerAcceptanceRate" /></span>
                </th>
                <th
                  className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground cursor-pointer hover:text-foreground"
                  onClick={() => handleSort('hmWeight')}
                >
                  <span className="flex items-center justify-end">HM Weight <SortIcon column="hmWeight" /></span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {sortedFriction.map(f => (
                <tr
                  key={f.hmId}
                  className={`cursor-pointer transition-colors ${selectedHM === f.hmId ? 'bg-accent/10' : 'hover:bg-white/[0.02]'}`}
                  onClick={() => setSelectedHM(selectedHM === f.hmId ? null : f.hmId)}
                >
                  <td className="px-3 py-3 font-medium text-foreground">{f.hmName}</td>
                  <td className="px-3 py-3 text-right text-muted-foreground">{f.reqsInRange}</td>
                  <td className="px-3 py-3 text-right">{f.loopCount}</td>
                  <td className="px-3 py-3 text-right">
                    {f.feedbackLatencyMedian !== null ? `${Math.round(f.feedbackLatencyMedian)} hrs` : '-'}
                  </td>
                  <td className="px-3 py-3 text-right">
                    <span className={
                      f.decisionLatencyMedian !== null && f.decisionLatencyMedian > 72 ? 'text-bad font-bold' :
                      f.decisionLatencyMedian !== null && f.decisionLatencyMedian > 48 ? 'text-warn font-bold' : ''
                    }>
                      {f.decisionLatencyMedian !== null ? `${Math.round(f.decisionLatencyMedian)} hrs` : '-'}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right">
                    {f.offerAcceptanceRate !== null ? `${(f.offerAcceptanceRate * 100).toFixed(0)}%` : '-'}
                  </td>
                  <td className="px-3 py-3 text-right">
                    <BadgeV2 variant={
                      f.hmWeight > 1.2 ? 'danger' :
                      f.hmWeight > 1.0 ? 'warning' :
                      f.hmWeight < 0.9 ? 'success' : 'neutral'
                    }>
                      {f.hmWeight.toFixed(2)}x
                    </BadgeV2>
                    {f.loopCount < 3 && (
                      <span className="text-xs text-muted-foreground ml-1" title="Low data volume">*</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Weight Legend */}
      <WeightLegendV2 />
    </div>
  );
}

export default HMFrictionTabV2;
