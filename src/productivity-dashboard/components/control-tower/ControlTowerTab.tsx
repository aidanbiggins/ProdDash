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
// Forecasting imports - simplified for Control Tower summary
import { differenceInDays } from 'date-fns';

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
}

// Risk reason types for the Risks section
type RiskReason = 'stalled' | 'zombie' | 'pipeline_gap' | 'hm_delay' | 'offer_risk' | 'at_risk';

interface AtRiskReq {
  reqId: string;
  reqTitle: string;
  recruiterName: string;
  hmName: string;
  reason: RiskReason;
  reasonLabel: string;
  daysAtRisk: number;
  severity: 'high' | 'medium' | 'low';
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
      <div className="stat-value" style={{ fontSize: '1.75rem', color: 'var(--text-primary)' }}>
        {value}
      </div>
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
  onNavigateToTab
}: ControlTowerTabProps) {

  // ===== EXPLAIN DRAWER STATE =====
  const [explainDrawerOpen, setExplainDrawerOpen] = useState(false);
  const [currentExplanation, setCurrentExplanation] = useState<Explanation | null>(null);

  // ===== ACTION DETAIL DRAWER STATE =====
  const [actionDrawerOpen, setActionDrawerOpen] = useState(false);
  const [selectedAction, setSelectedAction] = useState<ActionItem | null>(null);

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
    setExplainDrawerOpen(true);
  }, [requisitions, candidates, events, users, filters, config, overview, hmFriction]);

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
  const [actionQueue, setActionQueue] = useState<ActionItem[]>([]);

  // Generate unified actions
  useMemo(() => {
    const actions = generateUnifiedActionQueue({
      hmActions,
      explanations: allExplanations,
      requisitions,
      users,
      datasetId,
    });
    setActionQueue(actions);
  }, [hmActions, allExplanations, requisitions, users, datasetId]);

  // Action handlers
  const handleActionClick = useCallback((action: ActionItem) => {
    setSelectedAction(action);
    setActionDrawerOpen(true);
  }, []);

  const handleMarkDone = useCallback((actionId: string) => {
    saveActionState(datasetId, actionId, 'DONE');
    setActionQueue(prev => prev.map(a =>
      a.action_id === actionId ? { ...a, status: 'DONE' } : a
    ));
    setActionDrawerOpen(false);
  }, [datasetId]);

  const handleDismiss = useCallback((actionId: string) => {
    saveActionState(datasetId, actionId, 'DISMISSED');
    setActionQueue(prev => prev.map(a =>
      a.action_id === actionId ? { ...a, status: 'DISMISSED' } : a
    ));
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

  // ===== AT-RISK REQUISITIONS =====
  const atRiskReqs = useMemo((): AtRiskReq[] => {
    const risks: AtRiskReq[] = [];
    const openReqs = requisitions.filter(r => r.status === RequisitionStatus.Open);
    const now = new Date();

    for (const req of openReqs) {
      const health = assessReqHealth(req, candidates, events);
      const recruiter = users.find(u => u.user_id === req.recruiter_id);
      const hm = users.find(u => u.user_id === req.hiring_manager_id);
      const reqCandidates = candidates.filter(c => c.req_id === req.req_id);
      const activeCandidates = reqCandidates.filter(c => c.disposition === CandidateDisposition.Active);

      let reason: RiskReason | null = null;
      let reasonLabel = '';
      let severity: 'high' | 'medium' | 'low' = 'medium';
      let daysAtRisk = 0;

      // Check for zombie
      if (health.status === ReqHealthStatus.ZOMBIE) {
        reason = 'zombie';
        reasonLabel = 'Zombie Req';
        severity = 'high';
        daysAtRisk = health.daysSinceLastActivity || 0;
      }
      // Check for stalled
      else if (health.status === ReqHealthStatus.STALLED) {
        reason = 'stalled';
        reasonLabel = 'Stalled';
        severity = 'medium';
        daysAtRisk = health.daysSinceLastActivity || 0;
      }
      // Check for at-risk
      else if (health.status === ReqHealthStatus.AT_RISK) {
        reason = 'at_risk';
        reasonLabel = 'At Risk';
        severity = 'medium';
        daysAtRisk = health.daysOpen || 0;
      }

      // Check for pipeline gap (no active candidates in funnel)
      if (!reason && activeCandidates.length === 0 && req.opened_at) {
        const daysOpen = differenceInDays(now, req.opened_at);
        if (daysOpen > 14) {
          reason = 'pipeline_gap';
          reasonLabel = 'Empty Pipeline';
          severity = daysOpen > 30 ? 'high' : 'medium';
          daysAtRisk = daysOpen;
        }
      }

      // Check for HM delay - look for pending HM actions on this req
      if (!reason) {
        const reqHmActions = hmActions.filter(a => a.reqId === req.req_id);
        const overdueAction = reqHmActions.find(a => a.daysOverdue > 3);
        if (overdueAction) {
          reason = 'hm_delay';
          reasonLabel = 'HM Delay';
          severity = overdueAction.daysOverdue > 7 ? 'high' : 'medium';
          daysAtRisk = overdueAction.daysOverdue;
        }
      }

      // Check for offer risk - candidate in offer stage for too long
      if (!reason) {
        const offerCandidates = reqCandidates.filter(c =>
          c.current_stage?.toLowerCase().includes('offer') &&
          c.disposition === CandidateDisposition.Active
        );
        for (const oc of offerCandidates) {
          if (oc.current_stage_entered_at) {
            const daysInOffer = differenceInDays(now, oc.current_stage_entered_at);
            if (daysInOffer > 7) {
              reason = 'offer_risk';
              reasonLabel = 'Offer at Risk';
              severity = daysInOffer > 14 ? 'high' : 'medium';
              daysAtRisk = daysInOffer;
              break;
            }
          }
        }
      }

      if (reason) {
        risks.push({
          reqId: req.req_id,
          reqTitle: req.req_title,
          recruiterName: recruiter?.name || 'Unknown',
          hmName: hm?.name || 'Unknown',
          reason,
          reasonLabel,
          daysAtRisk,
          severity
        });
      }
    }

    // Sort by severity then days at risk
    return risks
      .sort((a, b) => {
        const severityOrder = { high: 3, medium: 2, low: 1 };
        if (severityOrder[b.severity] !== severityOrder[a.severity]) {
          return severityOrder[b.severity] - severityOrder[a.severity];
        }
        return b.daysAtRisk - a.daysAtRisk;
      })
      .slice(0, 10);
  }, [requisitions, candidates, events, users, hmActions]);

  // ===== FORECAST =====
  // Simplified pipeline-based forecast for Control Tower summary
  const forecastData = useMemo(() => {
    const openReqs = requisitions.filter(r => r.status === RequisitionStatus.Open);
    let expectedHires = 0;
    let healthyReqs = 0;
    let riskyReqs = 0;

    for (const req of openReqs) {
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

    // Hiring goal is number of open reqs
    const hiringGoal = openReqs.length;
    const gap = Math.max(0, hiringGoal - Math.round(expectedHires));

    // Confidence based on how many reqs are healthy vs risky
    const healthRatio = openReqs.length > 0 ? healthyReqs / openReqs.length : 0;
    const confidence: 'high' | 'medium' | 'low' =
      healthRatio >= 0.7 ? 'high' : healthRatio >= 0.4 ? 'medium' : 'low';

    return {
      expectedHires: Math.round(expectedHires),
      hiringGoal,
      gap,
      confidence,
      openReqCount: openReqs.length
    };
  }, [requisitions, candidates, events]);

  // Risk badge colors
  const riskBadgeColors: Record<RiskReason, { bg: string; text: string }> = {
    zombie: { bg: 'rgba(239, 68, 68, 0.2)', text: '#ef4444' },
    stalled: { bg: 'rgba(245, 158, 11, 0.2)', text: '#f59e0b' },
    pipeline_gap: { bg: 'rgba(168, 85, 247, 0.2)', text: '#a855f7' },
    hm_delay: { bg: 'rgba(59, 130, 246, 0.2)', text: '#3b82f6' },
    offer_risk: { bg: 'rgba(236, 72, 153, 0.2)', text: '#ec4899' },
    at_risk: { bg: 'rgba(249, 115, 22, 0.2)', text: '#f97316' }
  };

  const confidenceColors: Record<string, string> = {
    high: '#22c55e',
    medium: '#f59e0b',
    low: '#ef4444'
  };

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
        <div className="section-header">
          <h3 className="section-header-title">Health</h3>
          <button
            className="btn btn-sm btn-bespoke-secondary"
            onClick={() => onNavigateToTab('overview')}
          >
            View Details <i className="bi bi-arrow-right ms-1"></i>
          </button>
        </div>
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

      {/* Two column layout for Risks and Actions */}
      <div className="row g-4 mb-4">
        {/* Section 2: Risks */}
        <div className="col-lg-6">
          <div className="glass-panel p-3 h-100">
            <div className="section-header">
              <h3 className="section-header-title">
                Risks
                {atRiskReqs.length > 0 && (
                  <span
                    className="badge ms-2"
                    style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', fontSize: '0.7rem' }}
                  >
                    {atRiskReqs.length}
                  </span>
                )}
              </h3>
              <button
                className="btn btn-sm btn-bespoke-secondary"
                onClick={() => onNavigateToTab('data-health')}
              >
                View All
              </button>
            </div>

            {atRiskReqs.length === 0 ? (
              <div className="text-center py-4" style={{ color: 'var(--text-secondary)' }}>
                <i className="bi bi-shield-check" style={{ fontSize: '2rem', color: '#22c55e' }}></i>
                <p className="mt-2 mb-0">No at-risk requisitions</p>
              </div>
            ) : (
              <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
                {atRiskReqs.map((risk, idx) => (
                  <div
                    key={risk.reqId}
                    className="d-flex align-items-center py-2 px-2 rounded mb-1"
                    style={{
                      background: idx % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent',
                      cursor: 'pointer'
                    }}
                    onClick={() => onNavigateToReq(risk.reqId)}
                  >
                    <div className="flex-grow-1 min-width-0">
                      <div className="d-flex align-items-center gap-2 mb-1">
                        <span
                          className="badge"
                          style={{
                            background: riskBadgeColors[risk.reason].bg,
                            color: riskBadgeColors[risk.reason].text,
                            fontSize: '0.65rem'
                          }}
                        >
                          {risk.reasonLabel}
                        </span>
                        <span className="text-truncate" style={{ color: 'var(--text-primary)', fontSize: '0.85rem', fontWeight: 500 }}>
                          {risk.reqTitle}
                        </span>
                      </div>
                      <div className="d-flex gap-3" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        <span><i className="bi bi-person me-1"></i>{risk.recruiterName}</span>
                        <span><i className="bi bi-briefcase me-1"></i>{risk.hmName}</span>
                        <span className="font-mono">{risk.daysAtRisk}d</span>
                      </div>
                    </div>
                    <i className="bi bi-chevron-right" style={{ color: 'var(--text-secondary)' }}></i>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Section 3: Unified Actions */}
        <div className="col-lg-6">
          <div className="glass-panel p-3 h-100">
            <div className="section-header">
              <h3 className="section-header-title">
                Unified Actions
                {getOpenActions(actionQueue).length > 0 && (
                  <span
                    className="badge ms-2"
                    style={{ background: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b', fontSize: '0.7rem' }}
                  >
                    {getOpenActions(actionQueue).length}
                  </span>
                )}
              </h3>
              <button
                className="btn btn-sm btn-bespoke-secondary"
                onClick={() => onNavigateToTab('hiring-managers')}
              >
                HM Queue
              </button>
            </div>

            <UnifiedActionQueue
              actions={actionQueue}
              onActionClick={handleActionClick}
              maxDisplay={8}
            />
          </div>
        </div>
      </div>

      {/* Section 4: Forecast */}
      <div className="glass-panel p-3">
        <div className="section-header">
          <h3 className="section-header-title">Forecast</h3>
          <button
            className="btn btn-sm btn-bespoke-secondary"
            onClick={() => onNavigateToTab('forecasting')}
          >
            View Details <i className="bi bi-arrow-right ms-1"></i>
          </button>
        </div>

        <div className="row g-4">
          <div className="col-md-4">
            <div className="text-center">
              <div className="stat-label mb-2" style={{ color: 'var(--text-secondary)' }}>Expected Hires</div>
              <div className="stat-value" style={{ fontSize: '2.5rem', color: 'var(--text-primary)' }}>
                {forecastData.expectedHires}
              </div>
              <div className="small" style={{ color: 'var(--text-secondary)' }}>
                of {forecastData.openReqCount} open reqs
              </div>
            </div>
          </div>
          <div className="col-md-4">
            <div className="text-center">
              <div className="stat-label mb-2" style={{ color: 'var(--text-secondary)' }}>Pipeline Gap</div>
              <div
                className="stat-value"
                style={{
                  fontSize: '2.5rem',
                  color: forecastData.gap === 0 ? '#22c55e' : forecastData.gap <= 5 ? '#f59e0b' : '#ef4444'
                }}
              >
                {forecastData.gap}
              </div>
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
    </div>
  );
}
