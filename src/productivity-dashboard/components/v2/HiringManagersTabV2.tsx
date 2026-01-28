'use client';

// HiringManagersTabV2 - V0 Design Language
// Hiring Manager Scorecard with Overview, Req Scorecard, Actions, and Forecasts

import React, { useState, useMemo } from 'react';
import {
  TrendingUp, TrendingDown, Minus, Users, FileText, AlertCircle,
  CheckCircle, Clock, MessageSquare, ClipboardCheck, Search, X,
  ChevronDown, ChevronUp, Calendar, Target, Activity
} from 'lucide-react';
import { SubViewHeader } from './SubViewHeader';
import { useDashboard } from '../../hooks/useDashboardContext';
import {
  HMFactTables,
  HMReqRollup,
  HMRollup,
  HMPendingAction,
  HMActionType,
  HMDecisionBucket
} from '../../types/hmTypes';
import { buildHMFactTables } from '../../services/hmFactTables';
import { buildHMReqRollups, buildHMRollupsWithBenchmarks, calculatePendingActions } from '../../services/hmMetricsEngine';
import { DEFAULT_HM_RULES } from '../../config/hmRules';
import { BUCKET_METADATA } from '../../config/hmStageTaxonomy';

type HMSubTab = 'overview' | 'scorecard' | 'actions';

// V0 Design: Section Header Component
function SectionHeaderV2({
  title,
  subtitle,
  badge,
  actions
}: {
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between mb-4 pb-3 border-b border-border">
      <div className="flex items-center gap-3">
        <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">{title}</h3>
        {badge}
      </div>
      {subtitle && <span className="text-xs text-muted-foreground">{subtitle}</span>}
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
  onClick,
  isActive
}: {
  label: string;
  value: string | number;
  subtitle?: string;
  accentColor?: string;
  onClick?: () => void;
  isActive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`glass-panel p-4 text-left transition-all hover:bg-accent/50 flex-1 min-w-0 ${
        isActive ? 'ring-1 ring-accent bg-accent/30' : ''
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
        <div className="text-xs text-muted-foreground">{subtitle}</div>
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

// V0 Design: HM Overview Sub-component
function HMOverviewV2({
  hmRollups,
  onToggleHM,
  selectedHmUserIds,
  onClearSelection
}: {
  hmRollups: HMRollup[];
  onToggleHM: (hmUserId: string) => void;
  selectedHmUserIds: Set<string>;
  onClearSelection: () => void;
}) {
  const [sortField, setSortField] = useState<string>('pendingActionsCount');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Calculate summary stats
  const summary = useMemo(() => {
    const filteredHMs = selectedHmUserIds.size > 0
      ? hmRollups.filter(hm => selectedHmUserIds.has(hm.hmUserId))
      : hmRollups;

    return {
      totalHMs: filteredHMs.length,
      totalOpenReqs: filteredHMs.reduce((sum, hm) => sum + hm.totalOpenReqs, 0),
      totalPendingActions: filteredHMs.reduce((sum, hm) => sum + hm.pendingActionsCount, 0),
      totalActiveCandidates: filteredHMs.reduce((sum, hm) => sum + hm.totalActiveCandidates, 0),
      hmsWithRiskFlags: filteredHMs.filter(hm => hm.reqsWithRiskFlags > 0).length,
      isFiltered: selectedHmUserIds.size > 0
    };
  }, [hmRollups, selectedHmUserIds]);

  // Calculate median speeds
  const medianFeedbackSpeed = useMemo(() => {
    const targetHMs = selectedHmUserIds.size > 0
      ? hmRollups.filter(r => selectedHmUserIds.has(r.hmUserId))
      : hmRollups;
    const validSpeeds = targetHMs
      .map(r => r.latencyMetrics.feedbackLatency.median)
      .filter((n): n is number => n !== null && n > 0)
      .sort((a, b) => a - b);
    if (validSpeeds.length === 0) return null;
    const mid = Math.floor(validSpeeds.length / 2);
    return validSpeeds.length % 2 !== 0 ? validSpeeds[mid] : (validSpeeds[mid - 1] + validSpeeds[mid]) / 2;
  }, [hmRollups, selectedHmUserIds]);

  const medianReviewSpeed = useMemo(() => {
    const targetHMs = selectedHmUserIds.size > 0
      ? hmRollups.filter(r => selectedHmUserIds.has(r.hmUserId))
      : hmRollups;
    const validSpeeds = targetHMs
      .map(r => r.latencyMetrics.reviewLatency.median)
      .filter((n): n is number => n !== null && n > 0)
      .sort((a, b) => a - b);
    if (validSpeeds.length === 0) return null;
    const mid = Math.floor(validSpeeds.length / 2);
    return validSpeeds.length % 2 !== 0 ? validSpeeds[mid] : (validSpeeds[mid - 1] + validSpeeds[mid]) / 2;
  }, [hmRollups, selectedHmUserIds]);

  // Sort HMs
  const sortedHMs = useMemo(() => {
    return [...hmRollups].sort((a, b) => {
      let aVal: string | number = 0;
      let bVal: string | number = 0;

      switch (sortField) {
        case 'hmName':
          aVal = a.hmName.toLowerCase();
          bVal = b.hmName.toLowerCase();
          break;
        case 'totalOpenReqs':
          aVal = a.totalOpenReqs;
          bVal = b.totalOpenReqs;
          break;
        case 'pendingActionsCount':
          aVal = a.pendingActionsCount;
          bVal = b.pendingActionsCount;
          break;
        case 'totalActiveCandidates':
          aVal = a.totalActiveCandidates;
          bVal = b.totalActiveCandidates;
          break;
        case 'feedbackDueCount':
          aVal = a.feedbackDueCount;
          bVal = b.feedbackDueCount;
          break;
        case 'reqsWithRiskFlags':
          aVal = a.reqsWithRiskFlags;
          bVal = b.reqsWithRiskFlags;
          break;
      }

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortDirection === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });
  }, [hmRollups, sortField, sortDirection]);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field) return null;
    return sortDirection === 'desc' ? <ChevronDown className="w-3 h-3 ml-1" /> : <ChevronUp className="w-3 h-3 ml-1" />;
  };

  return (
    <div className="space-y-4">
      {/* Filter Indicator */}
      {summary.isFiltered && (
        <div className="glass-panel p-3 flex justify-between items-center border-l-2 border-accent">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-accent" />
            <span className="text-sm">
              Showing stats for <span className="font-semibold text-foreground">{selectedHmUserIds.size}</span> selected HM{selectedHmUserIds.size > 1 ? 's' : ''}
            </span>
          </div>
          <button
            className="px-3 py-1 text-sm text-muted-foreground hover:text-foreground border border-white/10 rounded hover:bg-white/5 transition-colors"
            onClick={onClearSelection}
          >
            Show All
          </button>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICardV2
          label="Hiring Managers"
          value={summary.totalHMs}
          subtitle={summary.isFiltered ? 'Selected' : 'Active users'}
          accentColor="#94a3b8"
        />
        <KPICardV2
          label="Open Requisitions"
          value={summary.totalOpenReqs}
          subtitle="Active positions"
          accentColor="#f59e0b"
        />
        <KPICardV2
          label="Pending Actions"
          value={summary.totalPendingActions}
          subtitle="Requiring attention"
          accentColor="#ef4444"
        />
        <KPICardV2
          label="Active Candidates"
          value={summary.totalActiveCandidates}
          subtitle="In pipeline"
          accentColor="#06b6d4"
        />
      </div>

      {/* Speed & Benchmarks */}
      <div className="glass-panel p-4">
        <SectionHeaderV2 title="Speed & Benchmarks" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-accent/10">
              <MessageSquare className="w-5 h-5 text-accent" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Median Feedback Speed</div>
              <div className="font-mono text-2xl font-bold text-foreground">
                {medianFeedbackSpeed !== null ? `${Math.round(medianFeedbackSpeed * 10) / 10}` : '—'}
                <span className="text-sm font-normal text-muted-foreground ml-1">days</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-purple-500/10">
              <Search className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Median Review Speed</div>
              <div className="font-mono text-2xl font-bold text-foreground">
                {medianReviewSpeed !== null ? `${Math.round(medianReviewSpeed * 10) / 10}` : '—'}
                <span className="text-sm font-normal text-muted-foreground ml-1">days</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-slate-500/10">
              <Target className="w-5 h-5 text-slate-400" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Team Median (Global)</div>
              <div className="font-mono text-2xl font-bold text-foreground">
                {(() => {
                  const avg = hmRollups.reduce((acc, r) => acc + (r.latencyMetrics.feedbackLatency.median || 0), 0) /
                    (hmRollups.filter(r => r.latencyMetrics.feedbackLatency.median !== null).length || 1);
                  return Math.round(avg);
                })()}
                <span className="text-sm font-normal text-muted-foreground ml-1">days</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* HM Leaderboard Table */}
      <div className="glass-panel overflow-hidden">
        <div className="p-4 border-b border-border">
          <SectionHeaderV2
            title="Hiring Manager Leaderboard"
            badge={selectedHmUserIds.size > 0 ? (
              <BadgeV2 variant="info">{selectedHmUserIds.size} selected</BadgeV2>
            ) : undefined}
            actions={selectedHmUserIds.size > 0 ? (
              <button
                className="px-3 py-1 text-sm text-muted-foreground hover:text-foreground border border-white/10 rounded hover:bg-white/5 transition-colors"
                onClick={onClearSelection}
              >
                Clear Selection
              </button>
            ) : undefined}
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/30">
                <th className="w-10 px-3 py-3 text-left">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded border-white/20 bg-transparent"
                    checked={selectedHmUserIds.size === hmRollups.length && hmRollups.length > 0}
                    onChange={() => {
                      if (selectedHmUserIds.size === hmRollups.length) {
                        onClearSelection();
                      } else {
                        hmRollups.forEach(hm => {
                          if (!selectedHmUserIds.has(hm.hmUserId)) {
                            onToggleHM(hm.hmUserId);
                          }
                        });
                      }
                    }}
                  />
                </th>
                <th
                  className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground cursor-pointer hover:text-foreground"
                  onClick={() => handleSort('hmName')}
                >
                  <span className="flex items-center">Hiring Manager <SortIcon field="hmName" /></span>
                </th>
                <th
                  className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground cursor-pointer hover:text-foreground"
                  onClick={() => handleSort('totalOpenReqs')}
                >
                  <span className="flex items-center justify-end">Open <SortIcon field="totalOpenReqs" /></span>
                </th>
                <th
                  className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground cursor-pointer hover:text-foreground"
                  onClick={() => handleSort('totalActiveCandidates')}
                >
                  <span className="flex items-center justify-end">Pipeline <SortIcon field="totalActiveCandidates" /></span>
                </th>
                <th
                  className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground cursor-pointer hover:text-foreground"
                  onClick={() => handleSort('pendingActionsCount')}
                >
                  <span className="flex items-center justify-end">Actions <SortIcon field="pendingActionsCount" /></span>
                </th>
                <th
                  className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground cursor-pointer hover:text-foreground"
                  onClick={() => handleSort('feedbackDueCount')}
                >
                  <span className="flex items-center justify-end">Feedback <SortIcon field="feedbackDueCount" /></span>
                </th>
                <th
                  className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground cursor-pointer hover:text-foreground"
                  onClick={() => handleSort('reqsWithRiskFlags')}
                >
                  <span className="flex items-center justify-end">Risk <SortIcon field="reqsWithRiskFlags" /></span>
                </th>
                <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  FB Speed
                </th>
                <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  RV Speed
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sortedHMs.map(hm => {
                const isSelected = selectedHmUserIds.has(hm.hmUserId);
                return (
                  <tr
                    key={hm.hmUserId}
                    onClick={() => onToggleHM(hm.hmUserId)}
                    className={`cursor-pointer transition-colors ${isSelected ? 'bg-accent/10' : 'hover:bg-muted/30'}`}
                  >
                    <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        className="w-4 h-4 rounded border-white/20 bg-transparent"
                        checked={isSelected}
                        onChange={() => onToggleHM(hm.hmUserId)}
                      />
                    </td>
                    <td className="px-3 py-3">
                      <div className="font-medium text-foreground">{hm.hmName}</div>
                      {hm.team && <div className="text-xs text-muted-foreground">{hm.team}</div>}
                    </td>
                    <td className="px-3 py-3 text-right font-mono">{hm.totalOpenReqs}</td>
                    <td className="px-3 py-3 text-right font-mono">{hm.totalActiveCandidates}</td>
                    <td className="px-3 py-3 text-right">
                      {hm.pendingActionsCount > 0 ? (
                        <BadgeV2 variant="warning">{hm.pendingActionsCount}</BadgeV2>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right">
                      {hm.feedbackDueCount > 0 ? (
                        <BadgeV2 variant="danger">{hm.feedbackDueCount}</BadgeV2>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right">
                      {hm.reqsWithRiskFlags > 0 ? (
                        <BadgeV2 variant="danger">{hm.reqsWithRiskFlags}</BadgeV2>
                      ) : (
                        <BadgeV2 variant="success">✓</BadgeV2>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right">
                      {hm.latencyMetrics.feedbackLatency.median !== null ? (
                        <span className={`font-mono ${hm.latencyMetrics.feedbackLatency.median > 3 ? 'text-bad' : 'text-foreground'}`}>
                          {hm.latencyMetrics.feedbackLatency.median}d
                        </span>
                      ) : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-3 py-3 text-right">
                      {hm.latencyMetrics.reviewLatency.median !== null ? (
                        <span className={`font-mono ${hm.latencyMetrics.reviewLatency.median > 3 ? 'text-bad' : 'text-foreground'}`}>
                          {hm.latencyMetrics.reviewLatency.median}d
                        </span>
                      ) : <span className="text-muted-foreground">—</span>}
                    </td>
                  </tr>
                );
              })}
              {sortedHMs.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-3 py-8 text-center text-muted-foreground">
                    No hiring managers found matching criteria
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// V0 Design: HM Scorecard Sub-component
function HMScorecardV2({
  reqRollups,
  selectedHmUserIds,
  onSelectReq
}: {
  reqRollups: HMReqRollup[];
  selectedHmUserIds: Set<string>;
  onSelectReq?: (reqId: string) => void;
}) {
  const [sortField, setSortField] = useState<string>('daysSinceLastMovement');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [searchTerm, setSearchTerm] = useState('');

  // Filter by search term
  const filteredRollups = useMemo(() => {
    if (!searchTerm) return reqRollups;
    const term = searchTerm.toLowerCase();
    return reqRollups.filter(r =>
      r.reqTitle.toLowerCase().includes(term) ||
      r.hmName.toLowerCase().includes(term) ||
      r.reqId.toLowerCase().includes(term)
    );
  }, [reqRollups, searchTerm]);

  // Sort
  const sortedRollups = useMemo(() => {
    return [...filteredRollups].sort((a, b) => {
      let aVal: string | number | null = null;
      let bVal: string | number | null = null;

      switch (sortField) {
        case 'reqTitle':
          aVal = a.reqTitle.toLowerCase();
          bVal = b.reqTitle.toLowerCase();
          break;
        case 'reqAgeDays':
          aVal = a.reqAgeDays;
          bVal = b.reqAgeDays;
          break;
        case 'daysSinceLastMovement':
          aVal = a.daysSinceLastMovement ?? 999;
          bVal = b.daysSinceLastMovement ?? 999;
          break;
        case 'pipelineDepth':
          aVal = a.pipelineDepth;
          bVal = b.pipelineDepth;
          break;
        case 'hmName':
          aVal = a.hmName.toLowerCase();
          bVal = b.hmName.toLowerCase();
          break;
      }

      if (aVal === null || bVal === null) return 0;
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortDirection === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });
  }, [filteredRollups, sortField, sortDirection]);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field) return null;
    return sortDirection === 'desc' ? <ChevronDown className="w-3 h-3 ml-1" /> : <ChevronUp className="w-3 h-3 ml-1" />;
  };

  const showHmColumn = !selectedHmUserIds || selectedHmUserIds.size === 0 || selectedHmUserIds.size > 1;

  return (
    <div className="glass-panel overflow-hidden">
      <div className="p-4 border-b border-border flex justify-between items-center">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">Open Requisitions Scorecard</h3>
          <BadgeV2 variant="neutral">{sortedRollups.length} reqs</BadgeV2>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            className="pl-9 pr-3 py-2 text-sm bg-white/5 border border-white/10 rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-accent w-40"
            placeholder="Search reqs..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm" style={{ minWidth: '900px' }}>
          <thead>
            <tr className="bg-muted/30">
              <th
                className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground cursor-pointer hover:text-foreground w-40"
                onClick={() => handleSort('reqTitle')}
              >
                <span className="flex items-center">Requisition <SortIcon field="reqTitle" /></span>
              </th>
              {showHmColumn && (
                <th
                  className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground cursor-pointer hover:text-foreground w-24"
                  onClick={() => handleSort('hmName')}
                >
                  <span className="flex items-center">HM <SortIcon field="hmName" /></span>
                </th>
              )}
              <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground w-16">Func</th>
              <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground w-12">Lvl</th>
              <th
                className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground cursor-pointer hover:text-foreground w-14"
                onClick={() => handleSort('reqAgeDays')}
              >
                <span className="flex items-center justify-end">Age <SortIcon field="reqAgeDays" /></span>
              </th>
              <th
                className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground cursor-pointer hover:text-foreground w-14"
                onClick={() => handleSort('daysSinceLastMovement')}
              >
                <span className="flex items-center justify-end">Stall <SortIcon field="daysSinceLastMovement" /></span>
              </th>
              <th
                className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground cursor-pointer hover:text-foreground w-12"
                onClick={() => handleSort('pipelineDepth')}
              >
                <span className="flex items-center justify-end">Pipe <SortIcon field="pipelineDepth" /></span>
              </th>
              <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground border-l border-border w-10">Rev</th>
              <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground w-10">Int</th>
              <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground w-10">Dec</th>
              <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground w-10">Off</th>
              <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground border-l border-border w-20">Fill</th>
              <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground w-20">Risk</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sortedRollups.map(r => (
              <tr
                key={r.reqId}
                onClick={() => onSelectReq?.(r.reqId)}
                className="cursor-pointer hover:bg-muted/30 transition-colors"
              >
                <td className="px-3 py-3">
                  <div className="font-medium text-foreground truncate max-w-[150px]" title={r.reqTitle}>{r.reqTitle}</div>
                  <div className="text-xs text-muted-foreground">{r.reqId}</div>
                </td>
                {showHmColumn && (
                  <td className="px-3 py-3">
                    <span className="truncate block max-w-[90px]" title={r.hmName}>{r.hmName}</span>
                  </td>
                )}
                <td className="px-3 py-3">
                  <BadgeV2 variant="neutral">{r.function}</BadgeV2>
                </td>
                <td className="px-3 py-3">
                  <BadgeV2 variant="neutral">{r.level}</BadgeV2>
                </td>
                <td className="px-3 py-3 text-right">
                  {r.reqAgeDays > 60 ? (
                    <BadgeV2 variant="danger">{r.reqAgeDays}d</BadgeV2>
                  ) : (
                    <span className="text-muted-foreground">{r.reqAgeDays}d</span>
                  )}
                </td>
                <td className="px-3 py-3 text-right">
                  {r.daysSinceLastMovement !== null ? (
                    r.daysSinceLastMovement > 7 ? (
                      <BadgeV2 variant="warning">{r.daysSinceLastMovement}d</BadgeV2>
                    ) : (
                      <span className="text-muted-foreground">{r.daysSinceLastMovement}d</span>
                    )
                  ) : <span className="text-muted-foreground">—</span>}
                </td>
                <td className="px-3 py-3 text-right">
                  {r.pipelineDepth < 3 ? (
                    <BadgeV2 variant="danger">{r.pipelineDepth}</BadgeV2>
                  ) : (
                    <span className="font-semibold">{r.pipelineDepth}</span>
                  )}
                </td>
                {/* Bucket columns */}
                {[HMDecisionBucket.HM_REVIEW, HMDecisionBucket.HM_INTERVIEW_DECISION, HMDecisionBucket.HM_FINAL_DECISION, HMDecisionBucket.OFFER_DECISION].map((bucket, idx) => (
                  <td key={bucket} className={`px-3 py-3 text-center ${idx === 0 ? 'border-l border-border' : ''}`}>
                    {r.candidatesByBucket[bucket] > 0 ? (
                      <span
                        className="inline-flex items-center justify-center px-2 py-0.5 rounded text-xs font-medium"
                        style={{
                          backgroundColor: `${BUCKET_METADATA[bucket]?.color || '#64748b'}20`,
                          color: BUCKET_METADATA[bucket]?.color || '#64748b'
                        }}
                      >
                        {r.candidatesByBucket[bucket]}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">•</span>
                    )}
                  </td>
                ))}
                <td className="px-3 py-3 border-l border-border">
                  {r.forecast?.likelyDate ? (
                    <span className="font-semibold">
                      {new Date(r.forecast.likelyDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  ) : <span className="text-muted-foreground">—</span>}
                </td>
                <td className="px-3 py-3">
                  {r.riskFlags && r.riskFlags.length > 0 ? (
                    <div className="flex gap-1">
                      {r.riskFlags.slice(0, 2).map((flag, i) => (
                        <BadgeV2 key={i} variant={flag.severity === 'danger' ? 'danger' : 'warning'}>{flag.label}</BadgeV2>
                      ))}
                    </div>
                  ) : (
                    <BadgeV2 variant="success">OK</BadgeV2>
                  )}
                </td>
              </tr>
            ))}
            {sortedRollups.length === 0 && (
              <tr>
                <td colSpan={showHmColumn ? 13 : 12} className="px-3 py-8 text-center text-muted-foreground">
                  <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <div>No open requisitions found matching criteria</div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// V0 Design: HM Action Queue Sub-component
const ACTION_TYPE_META: Record<HMActionType, { label: string; icon: React.ReactNode; color: string }> = {
  [HMActionType.FEEDBACK_DUE]: {
    label: 'Feedback Due',
    icon: <MessageSquare className="w-5 h-5" />,
    color: '#ef4444'
  },
  [HMActionType.REVIEW_DUE]: {
    label: 'Resume Review',
    icon: <FileText className="w-5 h-5" />,
    color: '#f59e0b'
  },
  [HMActionType.DECISION_DUE]: {
    label: 'Decision Needed',
    icon: <ClipboardCheck className="w-5 h-5" />,
    color: '#3b82f6'
  }
};

function HMActionQueueV2({
  actions,
  selectedHmUserIds
}: {
  actions: HMPendingAction[];
  selectedHmUserIds: Set<string>;
}) {
  const [filterType, setFilterType] = useState<HMActionType | 'ALL'>('ALL');
  const [sortField, setSortField] = useState<string>('daysOverdue');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Count by type
  const countByType = useMemo(() => {
    const counts: Record<string, number> = {};
    Object.values(HMActionType).forEach(t => counts[t] = 0);
    actions.forEach(a => {
      counts[a.actionType] = (counts[a.actionType] || 0) + 1;
    });
    return counts;
  }, [actions]);

  // Filter
  const filteredActions = useMemo(() => {
    if (filterType === 'ALL') return actions;
    return actions.filter(a => a.actionType === filterType);
  }, [actions, filterType]);

  // Sort
  const sortedActions = useMemo(() => {
    return [...filteredActions].sort((a, b) => {
      let aVal: string | number = 0;
      let bVal: string | number = 0;

      switch (sortField) {
        case 'actionType':
          aVal = a.actionType;
          bVal = b.actionType;
          break;
        case 'reqTitle':
          aVal = a.reqTitle;
          bVal = b.reqTitle;
          break;
        case 'hmName':
          aVal = a.hmName;
          bVal = b.hmName;
          break;
        case 'daysWaiting':
          aVal = a.daysWaiting;
          bVal = b.daysWaiting;
          break;
        case 'daysOverdue':
        default:
          aVal = a.daysOverdue;
          bVal = b.daysOverdue;
          break;
      }

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortDirection === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });
  }, [filteredActions, sortField, sortDirection]);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field) return null;
    return sortDirection === 'desc' ? <ChevronDown className="w-3 h-3 ml-1" /> : <ChevronUp className="w-3 h-3 ml-1" />;
  };

  const showHmColumn = !selectedHmUserIds || selectedHmUserIds.size === 0 || selectedHmUserIds.size > 1;

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {Object.entries(ACTION_TYPE_META).map(([type, meta]) => {
          const count = countByType[type as HMActionType] || 0;
          const isActive = filterType === type;

          return (
            <button
              key={type}
              type="button"
              onClick={() => setFilterType(filterType === type as HMActionType ? 'ALL' : type as HMActionType)}
              className={`glass-panel p-4 text-center transition-all ${isActive ? 'ring-2' : 'hover:bg-accent/50'}`}
              style={{ borderColor: isActive ? meta.color : undefined }}
            >
              <div className="mb-2" style={{ color: meta.color }}>{meta.icon}</div>
              <div className="font-mono text-3xl font-bold text-foreground">{count}</div>
              <div className="text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground mt-1">
                {meta.label}
              </div>
            </button>
          );
        })}
      </div>

      {/* Filter indicator */}
      {filterType !== 'ALL' && (
        <div className="glass-panel p-3 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm">
              Showing: <span className="font-semibold text-foreground">{ACTION_TYPE_META[filterType].label}</span>
              <BadgeV2 variant="neutral">{countByType[filterType]} items</BadgeV2>
            </span>
          </div>
          <button
            className="px-3 py-1 text-sm text-muted-foreground hover:text-foreground border border-white/10 rounded hover:bg-white/5 transition-colors"
            onClick={() => setFilterType('ALL')}
          >
            Clear Filter
          </button>
        </div>
      )}

      {/* Actions Table */}
      <div className="glass-panel overflow-hidden">
        <div className="p-4 border-b border-border flex justify-between items-center">
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">Pending Actions Queue</h3>
          <BadgeV2 variant="neutral">{sortedActions.length} actions</BadgeV2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/30">
                <th
                  className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground cursor-pointer hover:text-foreground"
                  onClick={() => handleSort('actionType')}
                >
                  <span className="flex items-center">Type <SortIcon field="actionType" /></span>
                </th>
                {showHmColumn && (
                  <th
                    className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground cursor-pointer hover:text-foreground"
                    onClick={() => handleSort('hmName')}
                  >
                    <span className="flex items-center">HM <SortIcon field="hmName" /></span>
                  </th>
                )}
                <th
                  className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground cursor-pointer hover:text-foreground"
                  onClick={() => handleSort('reqTitle')}
                >
                  <span className="flex items-center">Requisition <SortIcon field="reqTitle" /></span>
                </th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Candidate
                </th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Trigger
                </th>
                <th
                  className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground cursor-pointer hover:text-foreground"
                  onClick={() => handleSort('daysWaiting')}
                >
                  <span className="flex items-center justify-end">Wait <SortIcon field="daysWaiting" /></span>
                </th>
                <th
                  className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground cursor-pointer hover:text-foreground"
                  onClick={() => handleSort('daysOverdue')}
                >
                  <span className="flex items-center justify-end">Status <SortIcon field="daysOverdue" /></span>
                </th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sortedActions.map(a => {
                const meta = ACTION_TYPE_META[a.actionType];
                return (
                  <tr key={`${a.reqId}-${a.candidateId}-${a.actionType}`} className="hover:bg-muted/30 transition-colors">
                    <td className="px-3 py-3">
                      <BadgeV2 variant={a.actionType === HMActionType.FEEDBACK_DUE ? 'danger' : a.actionType === HMActionType.REVIEW_DUE ? 'warning' : 'info'}>
                        {meta.label}
                      </BadgeV2>
                    </td>
                    {showHmColumn && (
                      <td className="px-3 py-3">
                        <span className="truncate block max-w-[100px]" title={a.hmName}>{a.hmName}</span>
                      </td>
                    )}
                    <td className="px-3 py-3">
                      <div className="font-medium text-foreground truncate max-w-[140px]" title={a.reqTitle}>{a.reqTitle}</div>
                      <div className="text-xs text-muted-foreground">{a.reqId}</div>
                    </td>
                    <td className="px-3 py-3">
                      <span className="truncate block max-w-[100px]" title={a.candidateName}>{a.candidateName}</span>
                    </td>
                    <td className="px-3 py-3 text-muted-foreground">
                      {a.triggerDate
                        ? a.triggerDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                        : '—'}
                    </td>
                    <td className="px-3 py-3 text-right font-mono font-semibold">{a.daysWaiting}d</td>
                    <td className="px-3 py-3 text-right">
                      {a.daysOverdue > 0 ? (
                        a.daysOverdue > 5 ? (
                          <BadgeV2 variant="danger">{a.daysOverdue}d over</BadgeV2>
                        ) : (
                          <BadgeV2 variant="warning">{a.daysOverdue}d over</BadgeV2>
                        )
                      ) : (
                        <BadgeV2 variant="success">On Track</BadgeV2>
                      )}
                    </td>
                    <td className="px-3 py-3 text-muted-foreground text-sm">
                      → {a.suggestedAction}
                    </td>
                  </tr>
                );
              })}
              {sortedActions.length === 0 && (
                <tr>
                  <td colSpan={showHmColumn ? 8 : 7} className="px-3 py-8 text-center">
                    {actions.length === 0 ? (
                      <div>
                        <CheckCircle className="w-10 h-10 mx-auto mb-2 text-good" />
                        <div className="text-lg font-semibold text-foreground">All Caught Up!</div>
                        <div className="text-muted-foreground">No pending actions requiring attention.</div>
                      </div>
                    ) : (
                      <div className="text-muted-foreground">No actions match the current filter</div>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// Main Component
export function HiringManagersTabV2() {
  const { state } = useDashboard();
  const { dataStore, filters } = state;
  const { candidates, requisitions, users, events, config } = dataStore;

  const [activeSubTab, setActiveSubTab] = useState<HMSubTab>('overview');
  const [selectedHmUserIds, setSelectedHmUserIds] = useState<Set<string>>(new Set());

  const stageMappingConfig = config?.stageMapping || { mappings: [], unmappedStages: [] };
  const lastImportAt = state.dataStore.lastImportAt ? new Date(state.dataStore.lastImportAt) : null;
  const asOfDate = lastImportAt ?? new Date();

  // Filter requisitions based on global filters
  const filteredGlobalReqs = useMemo(() => {
    if (!filters) return requisitions;
    const { dateRange, functions, jobFamilies, levels, regions, recruiterIds, hiringManagerIds } = filters;

    return requisitions.filter(req => {
      if (!req.opened_at) return false;
      const openedAt = new Date(req.opened_at);
      const closedAt = req.closed_at ? new Date(req.closed_at) : null;
      const isOpenInRange = openedAt <= dateRange.endDate && (!closedAt || closedAt >= dateRange.startDate);
      if (!isOpenInRange) return false;

      if (functions && functions.length > 0 && !functions.includes(String(req.function))) return false;
      if (jobFamilies && jobFamilies.length > 0 && !jobFamilies.includes(req.job_family)) return false;
      if (levels && levels.length > 0 && !levels.includes(req.level)) return false;
      if (regions && regions.length > 0 && !regions.includes(req.location_region)) return false;
      if (recruiterIds && recruiterIds.length > 0 && !recruiterIds.includes(req.recruiter_id)) return false;
      if (hiringManagerIds && hiringManagerIds.length > 0 && !hiringManagerIds.includes(req.hiring_manager_id)) return false;

      return true;
    });
  }, [requisitions, filters]);

  // Filter candidates
  const filteredCandidates = useMemo(() => {
    const filteredReqIds = new Set(filteredGlobalReqs.map(r => r.req_id));
    return candidates.filter(c => filteredReqIds.has(c.req_id));
  }, [candidates, filteredGlobalReqs]);

  // Filter events
  const filteredEvents = useMemo(() => {
    if (!filters?.dateRange) return events;
    const { startDate, endDate } = filters.dateRange;
    const filteredReqIds = new Set(filteredGlobalReqs.map(r => r.req_id));

    return events.filter(e => {
      if (!filteredReqIds.has(e.req_id)) return false;
      const eventDate = new Date(e.event_at);
      return eventDate >= startDate && eventDate <= endDate;
    });
  }, [events, filters?.dateRange, filteredGlobalReqs]);

  // Build fact tables
  const factTables: HMFactTables = useMemo(() => {
    return buildHMFactTables(filteredGlobalReqs, filteredCandidates, filteredEvents, users, stageMappingConfig, asOfDate);
  }, [filteredGlobalReqs, filteredCandidates, filteredEvents, users, stageMappingConfig, asOfDate]);

  const reqRollups: HMReqRollup[] = useMemo(() => {
    return buildHMReqRollups(factTables, users, DEFAULT_HM_RULES);
  }, [factTables, users]);

  const hmRollups: HMRollup[] = useMemo(() => {
    return buildHMRollupsWithBenchmarks(factTables, users, reqRollups, DEFAULT_HM_RULES);
  }, [factTables, users, reqRollups]);

  const pendingActions: HMPendingAction[] = useMemo(() => {
    return calculatePendingActions(factTables, users, DEFAULT_HM_RULES);
  }, [factTables, users]);

  // Filter by local selection
  const filteredReqRollups = useMemo(() => {
    if (selectedHmUserIds.size === 0) return reqRollups;
    return reqRollups.filter(r => selectedHmUserIds.has(r.hmUserId));
  }, [reqRollups, selectedHmUserIds]);

  const filteredActions = useMemo(() => {
    if (selectedHmUserIds.size === 0) return pendingActions;
    return pendingActions.filter(a => selectedHmUserIds.has(a.hmUserId));
  }, [pendingActions, selectedHmUserIds]);

  const toggleHmSelection = (hmUserId: string) => {
    setSelectedHmUserIds(prev => {
      const next = new Set(prev);
      if (next.has(hmUserId)) {
        next.delete(hmUserId);
      } else {
        next.add(hmUserId);
      }
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedHmUserIds(new Set());
  };

  const selectedHmNames = useMemo(() => {
    return hmRollups.filter(h => selectedHmUserIds.has(h.hmUserId)).map(h => h.hmName);
  }, [hmRollups, selectedHmUserIds]);

  const daysSinceImport = lastImportAt
    ? Math.floor((new Date().getTime() - lastImportAt.getTime()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <div className="space-y-4">
      <SubViewHeader
        title="Hiring Managers"
        subtitle="Track hiring manager responsiveness, pending actions, and requisition health"
        helpContent={{
          description: "This is your accountability dashboard for hiring managers. Use it to identify who needs follow-up, which reqs are at risk, and what actions are overdue.",
          howItWorks: "We track pending actions per HM based on candidates waiting for feedback, resume reviews, and decisions. The scorecard shows req-level health metrics. Speed benchmarks compare each HM to team medians.",
          whatToLookFor: [
            "HMs with high pending action counts",
            "Requisitions with multiple overdue actions",
            "Feedback speed significantly slower than team median",
            "Patterns of delay on specific req types"
          ],
          watchOutFor: [
            "Some HMs delegate to coordinators (actions may not reflect reality)",
            "High-volume HMs naturally have more pending items",
            "Recent data imports may show inflated pending counts",
            "Closed reqs still showing in pending actions need data refresh"
          ]
        }}
      />

      {/* Sub-Navigation */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
        <div className="flex gap-1 p-1 rounded-lg bg-muted/20 border border-border">
          {[
            { id: 'overview' as HMSubTab, label: 'Overview', count: hmRollups.length },
            { id: 'scorecard' as HMSubTab, label: 'Req Scorecard', count: selectedHmUserIds.size > 0 ? filteredReqRollups.length : reqRollups.length },
            { id: 'actions' as HMSubTab, label: 'Pending Actions', count: filteredActions.length, highlight: filteredActions.length > 0 }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                activeSubTab === tab.id
                  ? 'bg-white/10 text-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
              }`}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
                  tab.highlight ? 'bg-warn text-black font-semibold' : 'bg-white/10'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          {/* Selected HMs Indicator */}
          {selectedHmUserIds.size > 0 && (
            <div className="glass-panel px-3 py-2 flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Comparing:</span>
              <span className="font-semibold text-foreground">
                {selectedHmUserIds.size === 1 ? selectedHmNames[0] : `${selectedHmUserIds.size} HMs`}
              </span>
              <button
                className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                onClick={clearSelection}
                title="Clear selection"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Data Refresh Indicator */}
          <div
            className={`glass-panel px-3 py-2 text-right ${
              daysSinceImport !== null && daysSinceImport > 3 ? 'border-l-2 border-warn' : 'border-l-2 border-good'
            }`}
          >
            <div className="text-[0.6rem] uppercase font-semibold text-muted-foreground">Data Refresh</div>
            <div className={`font-semibold text-sm flex items-center justify-end gap-1 ${
              daysSinceImport !== null && daysSinceImport > 3 ? 'text-warn' : 'text-good'
            }`}>
              {lastImportAt ? lastImportAt.toLocaleDateString() : 'Unknown'}
              {daysSinceImport !== null && daysSinceImport <= 3 && <CheckCircle className="w-3 h-3" />}
            </div>
          </div>
        </div>
      </div>

      {/* Tab Content */}
      {activeSubTab === 'overview' && (
        <HMOverviewV2
          hmRollups={hmRollups}
          onToggleHM={toggleHmSelection}
          selectedHmUserIds={selectedHmUserIds}
          onClearSelection={clearSelection}
        />
      )}

      {activeSubTab === 'scorecard' && (
        <HMScorecardV2
          reqRollups={filteredReqRollups}
          selectedHmUserIds={selectedHmUserIds}
          onSelectReq={(reqId) => console.log('Selected req:', reqId)}
        />
      )}

      {activeSubTab === 'actions' && (
        <HMActionQueueV2
          actions={filteredActions}
          selectedHmUserIds={selectedHmUserIds}
        />
      )}
    </div>
  );
}

export default HiringManagersTabV2;
