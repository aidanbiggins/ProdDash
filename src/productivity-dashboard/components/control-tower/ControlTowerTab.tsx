// Control Tower Tab - Executive command center for recruiting operations
// Provides at-a-glance health, risks, actions, and forecasts

import React, { useMemo, useState, useCallback } from 'react';
import { Requisition, Candidate, Event, User, RequisitionStatus, CandidateDisposition } from '../../types/entities';
import { HiringManagerFriction, OverviewMetrics, MetricFilters } from '../../types';
import { DashboardConfig } from '../../types/config';
import { HMPendingAction } from '../../types/hmTypes';
import { assessReqHealth } from '../../services/reqHealthService';
import { ReqHealthStatus } from '../../types/dataHygieneTypes';
import { ExplainDrawer } from '../common/ExplainDrawer';
import { getExplanation } from '../../services/explain';
import { Explanation, ExplainProviderId } from '../../types/explainTypes';
import { ActionItem } from '../../types/actionTypes';
import { UnifiedActionQueue } from '../common/UnifiedActionQueue';
import { ActionDetailDrawer } from '../common/ActionDetailDrawer';
import {
  generateUnifiedActionQueue,
  saveActionState,
  getOpenActions,
} from '../../services/actionQueueService';
import { runPreMortemBatch } from '../../services/preMortemService';
import { PreMortemResult, getRiskBandColor, getFailureModeLabel } from '../../types/preMortemTypes';
import { PreMortemDrawer } from '../common/PreMortemDrawer';
import { AnimatedStat } from '../common/AnimatedNumber';
import { SectionHeader } from '../common/SectionHeader';

interface ControlTowerTabProps {
  requisitions: Requisition[];
  candidates: Candidate[];
  events: Event[];
  users: User[];
  overview: OverviewMetrics | null;
  hmFriction: HiringManagerFriction[];
  hmActions: HMPendingAction[];
  config: DashboardConfig;
  filters: MetricFilters;
  dataHealth: {
    overallHealthScore: number;
    unmappedStagesCount: number;
  };
  importSource: string | null;
  lastImportAt: Date | null;
  onNavigateToReq: (reqId: string) => void;
  onNavigateToHM: (hmUserId: string) => void;
  onNavigateToTab: (tab: string) => void;
  /** External manual actions from Ask ProdDash or other sources */
  externalManualActions?: ActionItem[];
}


// Health indicator component
function HealthIndicator({ status, label, value, subtitle, onExplain }: {
  status: 'green' | 'yellow' | 'red';
  label: string;
  value: string | number;
  subtitle?: string;
  onExplain?: () => void;
}) {
  const colors = {
    green: { bg: 'rgba(34, 197, 94, 0.15)', border: '#22c55e', text: '#22c55e' },
    yellow: { bg: 'rgba(245, 158, 11, 0.15)', border: '#f59e0b', text: '#f59e0b' },
    red: { bg: 'rgba(239, 68, 68, 0.15)', border: '#ef4444', text: '#ef4444' }
  };

  const c = colors[status];

  return (
    <div
      className="glass-panel p-3 h-100"
      style={{ borderLeft: `3px solid ${c.border}` }}
    >
      <div className="d-flex justify-content-between align-items-start mb-2">
        <span className="stat-label" style={{ color: 'var(--text-secondary)' }}>{label}</span>
        <div className="d-flex align-items-center gap-1">
          {onExplain && (
            <button
              className="btn btn-sm p-0"
              onClick={(e) => { e.stopPropagation(); onExplain(); }}
              title="Explain this metric"
              style={{ color: 'var(--text-secondary)', lineHeight: 1 }}
            >
              <i className="bi bi-question-circle" style={{ fontSize: '0.85rem' }}></i>
            </button>
          )}
          <span
            className="badge"
            style={{ background: c.bg, color: c.text, fontSize: '0.65rem', textTransform: 'uppercase' }}
          >
            {status}
          </span>
        </div>
      </div>
      <AnimatedStat
        value={value}
        className="stat-value"
        style={{ fontSize: '1.75rem', color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}
      />
      {subtitle && (
        <div className="small" style={{ color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
          {subtitle}
        </div>
      )}
    </div>
  );
}

// Dataset Status Bar component
function DatasetStatusBar({
  importSource,
  lastImportAt,
  reqCount,
  candidateCount,
  eventCount,
  dataHealthScore,
  unmappedStages
}: {
  importSource: string | null;
  lastImportAt: Date | null;
  reqCount: number;
  candidateCount: number;
  eventCount: number;
  dataHealthScore: number;
  unmappedStages: number;
}) {
  const formatName = importSource === 'demo' ? 'Demo Data' :
    importSource?.includes('icims') ? 'iCIMS Format' :
    importSource ? 'CSV Import' : 'Unknown';

  const healthColor = dataHealthScore >= 90 ? '#22c55e' :
    dataHealthScore >= 70 ? '#f59e0b' : '#ef4444';

  return (
    <div
      className="glass-panel mb-4 px-4 py-2"
      style={{
        background: 'rgba(15, 23, 42, 0.8)',
        borderColor: 'rgba(255, 255, 255, 0.1)'
      }}
    >
      <div className="d-flex flex-wrap align-items-center gap-4" style={{ fontSize: '0.8rem' }}>
        <div className="d-flex align-items-center gap-2">
          <i className="bi bi-database" style={{ color: 'var(--accent)' }}></i>
          <span style={{ color: 'var(--text-secondary)' }}>Dataset:</span>
          <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{formatName}</span>
        </div>

        <div className="d-flex align-items-center gap-2">
          <span style={{ color: 'var(--text-secondary)' }}>Reqs:</span>
          <span className="font-mono" style={{ color: 'var(--text-primary)' }}>{reqCount.toLocaleString()}</span>
        </div>

        <div className="d-flex align-items-center gap-2">
          <span style={{ color: 'var(--text-secondary)' }}>Candidates:</span>
          <span className="font-mono" style={{ color: 'var(--text-primary)' }}>{candidateCount.toLocaleString()}</span>
        </div>

        <div className="d-flex align-items-center gap-2">
          <span style={{ color: 'var(--text-secondary)' }}>Events:</span>
          <span className="font-mono" style={{ color: 'var(--text-primary)' }}>{eventCount.toLocaleString()}</span>
        </div>

        <div className="d-flex align-items-center gap-2">
          <span style={{ color: 'var(--text-secondary)' }}>Health:</span>
          <span className="font-mono" style={{ color: healthColor, fontWeight: 600 }}>{dataHealthScore}%</span>
        </div>

        {unmappedStages > 0 && (
          <div className="d-flex align-items-center gap-1">
            <i className="bi bi-exclamation-triangle" style={{ color: '#f59e0b' }}></i>
            <span style={{ color: '#f59e0b' }}>{unmappedStages} unmapped stages</span>
          </div>
        )}

        {lastImportAt && (
          <div className="d-flex align-items-center gap-2 ms-auto">
            <i className="bi bi-clock-history" style={{ color: 'var(--text-secondary)' }}></i>
            <span style={{ color: 'var(--text-secondary)' }}>
              Last refresh: {lastImportAt.toLocaleDateString()} {lastImportAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export function ControlTowerTab({
  requisitions,
  candidates,
  events,
  users,
  overview,
  hmFriction,
  hmActions,
  config,
  filters,
  dataHealth,
  importSource,
  lastImportAt,
  onNavigateToReq,
  onNavigateToHM,
  onNavigateToTab,
  externalManualActions = [],
}: ControlTowerTabProps) {

  // ===== EXPLAIN DRAWER STATE =====
  const [explainDrawerOpen, setExplainDrawerOpen] = useState(false);
  const [currentExplanation, setCurrentExplanation] = useState<Explanation | null>(null);
  // History for back/forward navigation
  const [explainHistory, setExplainHistory] = useState<Explanation[]>([]);
  const [explainHistoryIndex, setExplainHistoryIndex] = useState(-1);

  // ===== ACTION DETAIL DRAWER STATE =====
  const [actionDrawerOpen, setActionDrawerOpen] = useState(false);
  const [selectedAction, setSelectedAction] = useState<ActionItem | null>(null);

  // ===== PRE-MORTEM DRAWER STATE =====
  const [preMortemDrawerOpen, setPreMortemDrawerOpen] = useState(false);
  const [selectedPreMortem, setSelectedPreMortem] = useState<PreMortemResult | null>(null);

  // Generate dataset ID for localStorage persistence
  const datasetId = useMemo(() => {
    // Create a stable ID from dataset characteristics
    return `ds_${requisitions.length}_${candidates.length}_${lastImportAt?.getTime() || 0}`;
  }, [requisitions.length, candidates.length, lastImportAt]);

  const handleExplain = useCallback((providerId: ExplainProviderId) => {
    const context = {
      requisitions,
      candidates,
      events,
      users,
      filters,
      config,
      overview,
      hmFriction,
    };
    const explanation = getExplanation(providerId, context);
    setCurrentExplanation(explanation);

    // Add to history (truncate forward history if navigating from middle)
    setExplainHistory(prev => {
      const newHistory = [...prev.slice(0, explainHistoryIndex + 1), explanation];
      return newHistory;
    });
    setExplainHistoryIndex(prev => prev + 1);

    setExplainDrawerOpen(true);
  }, [requisitions, candidates, events, users, filters, config, overview, hmFriction, explainHistoryIndex]);

  // Navigation handlers for explain history
  const handleExplainGoBack = useCallback(() => {
    if (explainHistoryIndex > 0) {
      const newIndex = explainHistoryIndex - 1;
      setExplainHistoryIndex(newIndex);
      setCurrentExplanation(explainHistory[newIndex]);
    }
  }, [explainHistoryIndex, explainHistory]);

  const handleExplainGoForward = useCallback(() => {
    if (explainHistoryIndex < explainHistory.length - 1) {
      const newIndex = explainHistoryIndex + 1;
      setExplainHistoryIndex(newIndex);
      setCurrentExplanation(explainHistory[newIndex]);
    }
  }, [explainHistoryIndex, explainHistory]);

  const canGoBack = explainHistoryIndex > 0;
  const canGoForward = explainHistoryIndex < explainHistory.length - 1;

  // ===== GENERATE ALL EXPLANATIONS =====
  const allExplanations = useMemo(() => {
    const context = {
      requisitions,
      candidates,
      events,
      users,
      filters,
      config,
      overview,
      hmFriction,
    };

    const explanations = new Map<ExplainProviderId, Explanation>();
    const providerIds: ExplainProviderId[] = ['median_ttf', 'hm_latency', 'stalled_reqs', 'offer_accept_rate', 'time_to_offer'];

    for (const id of providerIds) {
      explanations.set(id, getExplanation(id, context));
    }

    return explanations;
  }, [requisitions, candidates, events, users, filters, config, overview, hmFriction]);

  // ===== UNIFIED ACTION QUEUE =====
  const [manualActions, setManualActions] = useState<ActionItem[]>([]);
  const [actionStatuses, setActionStatuses] = useState<Map<string, 'DONE' | 'DISMISSED'>>(new Map());

  // Generate unified actions from data sources
  const generatedActions = useMemo(() => {
    return generateUnifiedActionQueue({
      hmActions,
      explanations: allExplanations,
      requisitions,
      users,
      datasetId,
    });
  }, [hmActions, allExplanations, requisitions, users, datasetId]);

  // Merge generated actions with manually added actions (from PreMortem and Ask) and apply statuses
  const actionQueue = useMemo(() => {
    const generatedIds = new Set(generatedActions.map(a => a.action_id));
    // Combine local and external manual actions
    const allManualActions = [...manualActions, ...externalManualActions];
    // Keep manual actions that don't duplicate generated ones
    const uniqueManualActions = allManualActions.filter(a => !generatedIds.has(a.action_id));
    const allActions = [...generatedActions, ...uniqueManualActions];
    // Apply any status overrides
    return allActions.map(action => {
      const status = actionStatuses.get(action.action_id);
      return status ? { ...action, status } : action;
    });
  }, [generatedActions, manualActions, externalManualActions, actionStatuses]);

  // Action handlers
  const handleActionClick = useCallback((action: ActionItem) => {
    setSelectedAction(action);
    setActionDrawerOpen(true);
  }, []);

  const handleMarkDone = useCallback((actionId: string) => {
    saveActionState(datasetId, actionId, 'DONE');
    setActionStatuses(prev => new Map(prev).set(actionId, 'DONE'));
    setActionDrawerOpen(false);
  }, [datasetId]);

  const handleDismiss = useCallback((actionId: string) => {
    saveActionState(datasetId, actionId, 'DISMISSED');
    setActionStatuses(prev => new Map(prev).set(actionId, 'DISMISSED'));
    setActionDrawerOpen(false);
  }, [datasetId]);

  const handleViewEvidence = useCallback((providerId: ExplainProviderId) => {
    setActionDrawerOpen(false);
    handleExplain(providerId);
  }, [handleExplain]);

  // ===== HEALTH KPIs =====
  const healthKPIs = useMemo(() => {
    if (!overview) {
      return {
        ttf: { value: '--', status: 'yellow' as const, subtitle: 'No data' },
        offers: { value: 0, status: 'yellow' as const, subtitle: 'No data' },
        acceptRate: { value: '--', status: 'yellow' as const, subtitle: 'No data' },
        stalledReqs: { value: 0, status: 'green' as const, subtitle: 'No stalled reqs' },
        hmLatency: { value: '--', status: 'yellow' as const, subtitle: 'No data' }
      };
    }

    // TTF - target is <45 days
    const ttfValue = overview.medianTTF;
    const ttfStatus = ttfValue === null ? 'yellow' : ttfValue <= 35 ? 'green' : ttfValue <= 45 ? 'yellow' : 'red';

    // Offers
    const offersValue = overview.totalOffers;
    const offersStatus = offersValue >= 5 ? 'green' : offersValue >= 2 ? 'yellow' : 'red';

    // Accept Rate - target is >80% (stored as decimal 0-1, convert to percentage)
    const acceptRateRaw = overview.totalOfferAcceptanceRate;
    const acceptRateValue = acceptRateRaw !== null ? Math.round(acceptRateRaw * 100) : null;
    const acceptRateStatus = acceptRateValue === null ? 'yellow' :
      acceptRateValue >= 80 ? 'green' : acceptRateValue >= 60 ? 'yellow' : 'red';

    // Stalled Reqs - derived from reqHealthService
    const openReqs = requisitions.filter(r => r.status === RequisitionStatus.Open);
    let stalledCount = 0;
    openReqs.forEach(req => {
      const health = assessReqHealth(req, candidates, events);
      if (health.status === ReqHealthStatus.STALLED || health.status === ReqHealthStatus.ZOMBIE) {
        stalledCount++;
      }
    });
    const stalledStatus = stalledCount === 0 ? 'green' : stalledCount <= 3 ? 'yellow' : 'red';

    // HM Latency - average feedback time (convert from hours to days)
    const hmLatencyValues = hmFriction
      .map(hm => hm.feedbackLatencyMedian !== null ? hm.feedbackLatencyMedian / 24 : null)
      .filter((v): v is number => v !== null && v !== undefined);
    const avgHmLatency = hmLatencyValues.length > 0
      ? Math.round(hmLatencyValues.reduce((a, b) => a + b, 0) / hmLatencyValues.length)
      : null;
    const hmLatencyStatus = avgHmLatency === null ? 'yellow' :
      avgHmLatency <= 2 ? 'green' : avgHmLatency <= 4 ? 'yellow' : 'red';

    return {
      ttf: {
        value: ttfValue !== null ? `${ttfValue}d` : '--',
        status: ttfStatus as 'green' | 'yellow' | 'red',
        subtitle: ttfValue !== null ? `Target: <45 days` : 'Insufficient data'
      },
      offers: {
        value: offersValue,
        status: offersStatus as 'green' | 'yellow' | 'red',
        subtitle: `${overview.totalHires} hires in period`
      },
      acceptRate: {
        value: acceptRateValue !== null ? `${acceptRateValue}%` : '--',
        status: acceptRateStatus as 'green' | 'yellow' | 'red',
        subtitle: acceptRateValue !== null ? `Target: >80%` : 'Insufficient data'
      },
      stalledReqs: {
        value: stalledCount,
        status: stalledStatus as 'green' | 'yellow' | 'red',
        subtitle: stalledCount > 0 ? `of ${openReqs.length} open reqs` : 'All reqs healthy'
      },
      hmLatency: {
        value: avgHmLatency !== null ? `${avgHmLatency}d` : '--',
        status: hmLatencyStatus as 'green' | 'yellow' | 'red',
        subtitle: avgHmLatency !== null ? `Avg feedback time` : 'Insufficient data'
      }
    };
  }, [overview, requisitions, candidates, events, hmFriction]);

  // ===== FILTER HELPERS =====
  // Helper to check if a req matches current filters
  const reqMatchesFilters = useCallback((reqId: string): boolean => {
    const req = requisitions.find(r => r.req_id === reqId);
    if (!req) return false;

    // Check recruiter filter
    if (filters.recruiterIds && filters.recruiterIds.length > 0) {
      if (!req.recruiter_id || !filters.recruiterIds.includes(req.recruiter_id)) {
        return false;
      }
    }

    // Check hiring manager filter
    if (filters.hiringManagerIds && filters.hiringManagerIds.length > 0) {
      if (!req.hiring_manager_id || !filters.hiringManagerIds.includes(req.hiring_manager_id)) {
        return false;
      }
    }

    // Check function filter
    if (filters.functions && filters.functions.length > 0) {
      if (!req.function || !filters.functions.includes(req.function)) {
        return false;
      }
    }

    // Check job family filter
    if (filters.jobFamilies && filters.jobFamilies.length > 0) {
      if (!req.job_family || !filters.jobFamilies.includes(req.job_family)) {
        return false;
      }
    }

    // Check level filter
    if (filters.levels && filters.levels.length > 0) {
      if (!req.level || !filters.levels.includes(req.level)) {
        return false;
      }
    }

    // Check region filter
    if (filters.regions && filters.regions.length > 0) {
      if (!req.location_region || !filters.regions.includes(req.location_region)) {
        return false;
      }
    }

    return true;
  }, [requisitions, filters]);

  // Check if any filters are active
  const hasActiveFilters = useMemo(() => {
    return (
      (filters.recruiterIds && filters.recruiterIds.length > 0) ||
      (filters.hiringManagerIds && filters.hiringManagerIds.length > 0) ||
      (filters.functions && filters.functions.length > 0) ||
      (filters.jobFamilies && filters.jobFamilies.length > 0) ||
      (filters.levels && filters.levels.length > 0) ||
      (filters.regions && filters.regions.length > 0)
    );
  }, [filters]);

  // ===== FORECAST =====
  // Simplified pipeline-based forecast for Control Tower summary
  const forecastData = useMemo(() => {
    const allOpenReqs = requisitions.filter(r => r.status === RequisitionStatus.Open);

    // Filter reqs based on active filters
    const filteredOpenReqs = hasActiveFilters
      ? allOpenReqs.filter(r => reqMatchesFilters(r.req_id))
      : allOpenReqs;

    let expectedHires = 0;
    let healthyReqs = 0;
    let riskyReqs = 0;

    for (const req of filteredOpenReqs) {
      const health = assessReqHealth(req, candidates, events);
      const activeCandidates = candidates.filter(c =>
        c.req_id === req.req_id && c.disposition === CandidateDisposition.Active
      );

      // Simple heuristic: reqs with active candidates have hire probability
      // More candidates = higher probability (up to 1.0)
      if (health.status !== ReqHealthStatus.ZOMBIE) {
        if (activeCandidates.length > 0) {
          // Base probability + bonus for more candidates
          const probability = Math.min(0.3 + activeCandidates.length * 0.1, 0.9);
          expectedHires += probability;
          healthyReqs++;
        } else {
          riskyReqs++;
        }
      } else {
        riskyReqs++;
      }
    }

    // Hiring goal is number of filtered open reqs
    const hiringGoal = filteredOpenReqs.length;
    const gap = Math.max(0, hiringGoal - Math.round(expectedHires));

    // Confidence based on how many reqs are healthy vs risky
    const healthRatio = filteredOpenReqs.length > 0 ? healthyReqs / filteredOpenReqs.length : 0;
    const confidence: 'high' | 'medium' | 'low' =
      healthRatio >= 0.7 ? 'high' : healthRatio >= 0.4 ? 'medium' : 'low';

    return {
      expectedHires: Math.round(expectedHires),
      hiringGoal,
      gap,
      confidence,
      openReqCount: filteredOpenReqs.length,
      totalOpenReqCount: allOpenReqs.length,
      isFiltered: hasActiveFilters,
    };
  }, [requisitions, candidates, events, hasActiveFilters, reqMatchesFilters]);

  const confidenceColors: Record<string, string> = {
    high: '#22c55e',
    medium: '#f59e0b',
    low: '#ef4444'
  };

  // ===== PRE-MORTEM ANALYSIS =====
  const preMortemResults = useMemo(() => {
    return runPreMortemBatch(requisitions, candidates, events, hmActions);
  }, [requisitions, candidates, events, hmActions]);

  // Get top at-risk reqs for display (HIGH and MED), with filter awareness
  const atRiskPreMortems = useMemo(() => {
    const atRisk = preMortemResults
      .filter(r => r.risk_band === 'HIGH' || r.risk_band === 'MED')
      .map(r => ({
        ...r,
        matchesFilter: reqMatchesFilters(r.req_id),
      }))
      .sort((a, b) => {
        // Sort matching items first, then by risk score
        if (a.matchesFilter !== b.matchesFilter) {
          return a.matchesFilter ? -1 : 1;
        }
        return b.risk_score - a.risk_score;
      })
      .slice(0, 10);
    return atRisk;
  }, [preMortemResults, reqMatchesFilters]);

  // Count high risk that match filters
  const highRiskCount = useMemo(() => {
    if (hasActiveFilters) {
      return preMortemResults.filter(r => r.risk_band === 'HIGH' && reqMatchesFilters(r.req_id)).length;
    }
    return preMortemResults.filter(r => r.risk_band === 'HIGH').length;
  }, [preMortemResults, reqMatchesFilters, hasActiveFilters]);

  // Handler for opening PreMortem drawer
  const handlePreMortemClick = useCallback((result: PreMortemResult) => {
    setSelectedPreMortem(result);
    setPreMortemDrawerOpen(true);
  }, []);

  // Handler for adding PreMortem actions to queue
  const handleAddPreMortemToQueue = useCallback((actions: ActionItem[]) => {
    setManualActions(prev => {
      // Deduplicate by action_id (check both manual and generated actions)
      const existingManualIds = new Set(prev.map(a => a.action_id));
      const existingGeneratedIds = new Set(generatedActions.map(a => a.action_id));
      const newActions = actions.filter(a =>
        !existingManualIds.has(a.action_id) && !existingGeneratedIds.has(a.action_id)
      );
      return [...prev, ...newActions];
    });
  }, [generatedActions]);

  // Check if an action matches current filters
  const actionMatchesFilters = useCallback((action: ActionItem): boolean => {
    // Check req-based filters
    if (action.req_id && action.req_id !== 'general') {
      if (!reqMatchesFilters(action.req_id)) {
        return false;
      }
    }

    // Check HM filter for HM actions
    if (action.owner_type === 'HIRING_MANAGER' && filters.hiringManagerIds && filters.hiringManagerIds.length > 0) {
      if (!filters.hiringManagerIds.includes(action.owner_id)) {
        return false;
      }
    }

    return true;
  }, [reqMatchesFilters, filters.hiringManagerIds]);

  // Enrich action queue with filter match status
  const enrichedActionQueue = useMemo(() => {
    if (!hasActiveFilters) {
      return actionQueue.map(a => ({ ...a, matchesFilter: true }));
    }

    return actionQueue
      .map(a => ({
        ...a,
        matchesFilter: actionMatchesFilters(a),
      }))
      .sort((a, b) => {
        // Sort matching items first
        if (a.matchesFilter !== b.matchesFilter) {
          return a.matchesFilter ? -1 : 1;
        }
        // Then by priority and due date (existing sort)
        return 0;
      });
  }, [actionQueue, hasActiveFilters, actionMatchesFilters]);

  return (
    <div className="animate-fade-in">
      {/* Dataset Status Bar */}
      <DatasetStatusBar
        importSource={importSource}
        lastImportAt={lastImportAt}
        reqCount={requisitions.length}
        candidateCount={candidates.length}
        eventCount={events.length}
        dataHealthScore={dataHealth.overallHealthScore}
        unmappedStages={dataHealth.unmappedStagesCount}
      />

      {/* Section 1: Health KPIs */}
      <div className="mb-4">
        <SectionHeader
          title="Health"
          actions={
            <button
              className="btn btn-sm btn-bespoke-secondary"
              onClick={() => onNavigateToTab('overview')}
            >
              View Details <i className="bi bi-arrow-right ms-1"></i>
            </button>
          }
        />
        <div className="row g-3">
          <div className="col-6 col-md">
            <HealthIndicator
              status={healthKPIs.ttf.status}
              label="Median TTF"
              value={healthKPIs.ttf.value}
              subtitle={healthKPIs.ttf.subtitle}
              onExplain={() => handleExplain('median_ttf')}
            />
          </div>
          <div className="col-6 col-md">
            <HealthIndicator
              status={healthKPIs.offers.status}
              label="Offers"
              value={healthKPIs.offers.value}
              subtitle={healthKPIs.offers.subtitle}
              onExplain={() => handleExplain('time_to_offer')}
            />
          </div>
          <div className="col-6 col-md">
            <HealthIndicator
              status={healthKPIs.acceptRate.status}
              label="Accept Rate"
              value={healthKPIs.acceptRate.value}
              subtitle={healthKPIs.acceptRate.subtitle}
              onExplain={() => handleExplain('offer_accept_rate')}
            />
          </div>
          <div className="col-6 col-md">
            <HealthIndicator
              status={healthKPIs.stalledReqs.status}
              label="Stalled Reqs"
              value={healthKPIs.stalledReqs.value}
              subtitle={healthKPIs.stalledReqs.subtitle}
              onExplain={() => handleExplain('stalled_reqs')}
            />
          </div>
          <div className="col-6 col-md">
            <HealthIndicator
              status={healthKPIs.hmLatency.status}
              label="HM Latency"
              value={healthKPIs.hmLatency.value}
              subtitle={healthKPIs.hmLatency.subtitle}
              onExplain={() => handleExplain('hm_latency')}
            />
          </div>
        </div>
      </div>

      {/* Two column layout for Pre-Mortem and Actions */}
      <div className="row g-4 mb-4">
        {/* Section 2: Pre-Mortem (Risks) */}
        <div className="col-lg-6">
          <div className="glass-panel p-3 h-100">
            <SectionHeader
              title="Risks"
              badge={highRiskCount > 0 ? (
                <span
                  className="badge badge-danger-soft"
                  style={{ fontSize: '0.7rem' }}
                >
                  {highRiskCount} HIGH
                </span>
              ) : undefined}
              actions={
                <button
                  className="btn btn-sm btn-bespoke-secondary"
                  onClick={() => onNavigateToTab('data-health')}
                >
                  View All
                </button>
              }
            />

            {atRiskPreMortems.length === 0 ? (
              <div className="text-center py-4" style={{ color: 'var(--text-secondary)' }}>
                <i className="bi bi-shield-check" style={{ fontSize: '2rem', color: '#22c55e' }}></i>
                <p className="mt-2 mb-0">No at-risk requisitions</p>
              </div>
            ) : (
              <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
                {atRiskPreMortems.map((result, idx) => {
                  const isGreyedOut = hasActiveFilters && !result.matchesFilter;
                  return (
                    <div
                      key={result.req_id}
                      className="d-flex align-items-center py-2 px-2 rounded mb-1"
                      style={{
                        background: idx % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent',
                        cursor: 'pointer',
                        opacity: isGreyedOut ? 0.4 : 1,
                        transition: 'opacity 0.2s ease',
                      }}
                      onClick={() => handlePreMortemClick(result)}
                    >
                      <div className="flex-grow-1 min-width-0">
                        <div className="d-flex align-items-center gap-2 mb-1">
                          <span
                            className="badge font-mono"
                            style={{
                              background: isGreyedOut ? 'rgba(100, 116, 139, 0.5)' : getRiskBandColor(result.risk_band),
                              fontSize: '0.65rem',
                              minWidth: '28px',
                              textAlign: 'center'
                            }}
                          >
                            {result.risk_score}
                          </span>
                          <span
                            className="badge"
                            style={{
                              background: isGreyedOut ? 'rgba(100, 116, 139, 0.2)' : `${getRiskBandColor(result.risk_band)}20`,
                              color: isGreyedOut ? 'rgba(100, 116, 139, 0.8)' : getRiskBandColor(result.risk_band),
                              fontSize: '0.6rem'
                            }}
                          >
                            {getFailureModeLabel(result.failure_mode)}
                          </span>
                          <span className="text-truncate" style={{ color: isGreyedOut ? 'var(--text-secondary)' : 'var(--text-primary)', fontSize: '0.85rem', fontWeight: 500 }}>
                            {result.req_title}
                          </span>
                        </div>
                        <div className="d-flex gap-3" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                          <span><i className="bi bi-calendar me-1"></i>{result.days_open}d open</span>
                          <span><i className="bi bi-people me-1"></i>{result.active_candidate_count} active</span>
                        </div>
                      </div>
                      <i className="bi bi-chevron-right" style={{ color: 'var(--text-secondary)' }}></i>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Section 3: Unified Actions */}
        <div className="col-lg-6">
          <div className="glass-panel p-3 h-100">
            <SectionHeader
              title="Unified Actions"
              badge={getOpenActions(actionQueue).length > 0 ? (
                <span
                  className="badge badge-warning-soft"
                  style={{ fontSize: '0.7rem' }}
                >
                  {getOpenActions(actionQueue).length}
                </span>
              ) : undefined}
              actions={
                <button
                  className="btn btn-sm btn-bespoke-secondary"
                  onClick={() => onNavigateToTab('hiring-managers')}
                >
                  HM Queue
                </button>
              }
            />

            <UnifiedActionQueue
              actions={enrichedActionQueue}
              onActionClick={handleActionClick}
              maxDisplay={8}
            />
          </div>
        </div>
      </div>

      {/* Section 4: Forecast */}
      <div className="glass-panel p-3">
        <SectionHeader
          title="Forecast"
          actions={
            <button
              className="btn btn-sm btn-bespoke-secondary"
              onClick={() => onNavigateToTab('forecasting')}
            >
              View Details <i className="bi bi-arrow-right ms-1"></i>
            </button>
          }
        />

        <div className="row g-4">
          <div className="col-md-4">
            <div className="text-center">
              <div className="stat-label mb-2" style={{ color: 'var(--text-secondary)' }}>Expected Hires</div>
              <AnimatedStat
                value={forecastData.expectedHires}
                className="stat-value"
                style={{ fontSize: '2.5rem', color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}
              />
              <div className="small" style={{ color: 'var(--text-secondary)' }}>
                of {forecastData.openReqCount} open reqs
                {forecastData.isFiltered && forecastData.totalOpenReqCount !== forecastData.openReqCount && (
                  <span style={{ color: 'var(--text-secondary)', opacity: 0.6 }}>
                    {' '}({forecastData.totalOpenReqCount} total)
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="col-md-4">
            <div className="text-center">
              <div className="stat-label mb-2" style={{ color: 'var(--text-secondary)' }}>Pipeline Gap</div>
              <AnimatedStat
                value={forecastData.gap}
                className="stat-value"
                style={{
                  fontSize: '2.5rem',
                  color: forecastData.gap === 0 ? '#22c55e' : forecastData.gap <= 5 ? '#f59e0b' : '#ef4444',
                  fontVariantNumeric: 'tabular-nums'
                }}
              />
              <div className="small" style={{ color: 'var(--text-secondary)' }}>
                {forecastData.gap === 0 ? 'pipeline covers all reqs' : 'reqs need more sourcing'}
              </div>
            </div>
          </div>
          <div className="col-md-4">
            <div className="text-center">
              <div className="stat-label mb-2" style={{ color: 'var(--text-secondary)' }}>Confidence</div>
              <div
                className="stat-value text-uppercase"
                style={{
                  fontSize: '1.5rem',
                  color: confidenceColors[forecastData.confidence],
                  letterSpacing: '0.05em'
                }}
              >
                {forecastData.confidence}
              </div>
              <div className="small" style={{ color: 'var(--text-secondary)' }}>
                based on pipeline data
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Explain Drawer */}
      <ExplainDrawer
        isOpen={explainDrawerOpen}
        onClose={() => setExplainDrawerOpen(false)}
        explanation={currentExplanation}
        canGoBack={canGoBack}
        canGoForward={canGoForward}
        onGoBack={handleExplainGoBack}
        onGoForward={handleExplainGoForward}
        currentIndex={explainHistoryIndex}
        totalCount={explainHistory.length}
      />

      {/* Action Detail Drawer */}
      <ActionDetailDrawer
        isOpen={actionDrawerOpen}
        onClose={() => setActionDrawerOpen(false)}
        action={selectedAction}
        onMarkDone={handleMarkDone}
        onDismiss={handleDismiss}
        onViewEvidence={handleViewEvidence}
      />

      {/* Pre-Mortem Drawer */}
      <PreMortemDrawer
        isOpen={preMortemDrawerOpen}
        onClose={() => setPreMortemDrawerOpen(false)}
        result={selectedPreMortem}
        onAddToQueue={handleAddPreMortemToQueue}
      />
    </div>
  );
}

export default ControlTowerTab;
