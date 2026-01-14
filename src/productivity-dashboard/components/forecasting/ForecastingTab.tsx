// Forecasting Tab - Role Planning and Health Tracking with Pre-Mortem Risk Analysis

import React, { useState, useMemo, useCallback } from 'react';
import { format, addDays } from 'date-fns';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, ReferenceLine
} from 'recharts';
import {
  Requisition,
  Candidate,
  Event,
  User,
  HiringManagerFriction,
  RoleProfile,
  RoleForecast,
  RoleHealthMetrics,
  HealthStatus
} from '../../types';
import { DashboardConfig } from '../../types/config';
import {
  generateRoleForecast,
  calculateActiveRoleHealth
} from '../../services/forecastingService';
import { useIsMobile } from '../../hooks/useIsMobile';
import {
  PreMortemResult,
  RiskBand,
  getRiskBandColor,
  getFailureModeLabel,
} from '../../types/preMortemTypes';
import { HMPendingAction } from '../../types/hmTypes';
import { runPreMortemBatch, convertToActionItems } from '../../services/preMortemService';
import { PreMortemDrawer } from '../common/PreMortemDrawer';
import { SectionHeader, StatLabel, StatValue } from '../common';
import { ActionItem } from '../../types/actionTypes';

interface ForecastingTabProps {
  requisitions: Requisition[];
  candidates: Candidate[];
  events: Event[];
  users: User[];
  hmFriction: HiringManagerFriction[];
  config: DashboardConfig;
  /** HM pending actions for pre-mortem analysis */
  hmActions?: HMPendingAction[];
  /** Callback to add actions to the unified action queue */
  onAddToActionQueue?: (actions: ActionItem[]) => void;
}

type SubTab = 'planner' | 'health';
type WizardStep = 'profile' | 'hm' | 'results';

export function ForecastingTab({
  requisitions,
  candidates,
  events,
  users,
  hmFriction,
  config,
  hmActions = [],
  onAddToActionQueue,
}: ForecastingTabProps) {
  const isMobile = useIsMobile();

  // Sub-tab state - default to health as it's more immediately useful
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('health');

  // Wizard state
  const [wizardStep, setWizardStep] = useState<WizardStep>('profile');
  const [roleProfile, setRoleProfile] = useState<RoleProfile>({
    function: '',
    level: '',
    locationType: '',
    jobFamily: '',
    hiringManagerId: undefined
  });
  const [forecast, setForecast] = useState<RoleForecast | null>(null);

  // Health dashboard state
  const [selectedHealthReq, setSelectedHealthReq] = useState<string | null>(null);
  const [healthFilter, setHealthFilter] = useState<HealthStatus | 'all'>('all');
  const [healthPage, setHealthPage] = useState(0);
  const HEALTH_PAGE_SIZE = 25; // Show 25 rows at a time for performance

  // Pre-mortem drawer state
  const [preMortemDrawerOpen, setPreMortemDrawerOpen] = useState(false);
  const [selectedPreMortem, setSelectedPreMortem] = useState<PreMortemResult | null>(null);

  // Get unique values for dropdowns
  const functions = useMemo(() =>
    Array.from(new Set(requisitions.map(r => r.function))).filter(Boolean).sort(),
    [requisitions]
  );
  const levels = useMemo(() =>
    Array.from(new Set(requisitions.map(r => r.level))).filter(Boolean).sort(),
    [requisitions]
  );
  const locationTypes = useMemo(() =>
    Array.from(new Set(requisitions.map(r => r.location_type))).filter(Boolean).sort(),
    [requisitions]
  );
  const jobFamilies = useMemo(() =>
    Array.from(new Set(requisitions.map(r => r.job_family))).filter(Boolean).sort(),
    [requisitions]
  );
  const hiringManagers = useMemo(() =>
    users.filter(u => u.role === 'HiringManager' || hmFriction.some(h => h.hmId === u.user_id)),
    [users, hmFriction]
  );

  // Calculate role health for all open reqs
  const roleHealthMetrics = useMemo(() =>
    calculateActiveRoleHealth(requisitions, candidates, events, users, hmFriction, config),
    [requisitions, candidates, events, users, hmFriction, config]
  );

  // Compute pre-mortems for all open reqs (memoized by dataset)
  // Uses deterministic preMortemService - no LLM
  const preMortemResults = useMemo(() => {
    // Build benchmark TTF map from role health metrics
    const benchmarkTTFMap = new Map<string, number>();
    roleHealthMetrics.forEach(r => {
      if (r.benchmarkTTF) {
        benchmarkTTFMap.set(r.reqId, r.benchmarkTTF);
      }
    });

    return runPreMortemBatch(
      requisitions,
      candidates,
      events,
      hmActions,
      benchmarkTTFMap
    );
  }, [requisitions, candidates, events, hmActions, roleHealthMetrics]);

  // Create a map for quick lookup of pre-mortem by req_id
  const preMortemByReqId = useMemo(() => {
    const map = new Map<string, PreMortemResult>();
    preMortemResults.forEach(pm => map.set(pm.req_id, pm));
    return map;
  }, [preMortemResults]);

  // Risk summary counts
  const riskSummary = useMemo(() => ({
    high: preMortemResults.filter(r => r.risk_band === 'HIGH').length,
    med: preMortemResults.filter(r => r.risk_band === 'MED').length,
    low: preMortemResults.filter(r => r.risk_band === 'LOW').length,
  }), [preMortemResults]);

  // Filter health metrics
  const filteredHealthMetrics = useMemo(() => {
    if (healthFilter === 'all') return roleHealthMetrics;
    return roleHealthMetrics.filter(r => r.healthStatus === healthFilter);
  }, [roleHealthMetrics, healthFilter]);

  // Reset page when filter changes
  React.useEffect(() => {
    setHealthPage(0);
  }, [healthFilter]);

  // Health summary counts
  const healthSummary = useMemo(() => ({
    total: roleHealthMetrics.length,
    onTrack: roleHealthMetrics.filter(r => r.healthStatus === 'on-track').length,
    atRisk: roleHealthMetrics.filter(r => r.healthStatus === 'at-risk').length,
    offTrack: roleHealthMetrics.filter(r => r.healthStatus === 'off-track').length
  }), [roleHealthMetrics]);

  // Generate forecast
  const handleGenerateForecast = useCallback(() => {
    if (!roleProfile.function || !roleProfile.level || !roleProfile.locationType || !roleProfile.jobFamily) {
      return;
    }
    const result = generateRoleForecast(
      roleProfile,
      requisitions,
      candidates,
      events,
      users,
      hmFriction,
      config
    );
    setForecast(result);
    setWizardStep('results');
  }, [roleProfile, requisitions, candidates, events, users, hmFriction, config]);

  // Reset wizard
  const handleResetWizard = useCallback(() => {
    setRoleProfile({
      function: '',
      level: '',
      locationType: '',
      jobFamily: '',
      hiringManagerId: undefined
    });
    setForecast(null);
    setWizardStep('profile');
  }, []);

  // Get HM metrics for preview
  const selectedHMMetrics = useMemo(() => {
    if (!roleProfile.hiringManagerId) return null;
    return hmFriction.find(h => h.hmId === roleProfile.hiringManagerId);
  }, [roleProfile.hiringManagerId, hmFriction]);

  // Selected health req details
  const selectedHealthDetails = useMemo(() => {
    if (!selectedHealthReq) return null;
    return roleHealthMetrics.find(r => r.reqId === selectedHealthReq);
  }, [selectedHealthReq, roleHealthMetrics]);

  // Open pre-mortem drawer for a req
  const handleViewPreMortem = useCallback((reqId: string) => {
    const pm = preMortemByReqId.get(reqId);
    if (pm) {
      setSelectedPreMortem(pm);
      setPreMortemDrawerOpen(true);
    }
  }, [preMortemByReqId]);

  // Handle adding interventions to action queue
  const handleAddToQueue = useCallback((actions: ActionItem[]) => {
    if (onAddToActionQueue) {
      onAddToActionQueue(actions);
    }
    setPreMortemDrawerOpen(false);
    setSelectedPreMortem(null);
  }, [onAddToActionQueue]);

  // Get risk badge style
  const getRiskBadgeStyle = (band: RiskBand) => {
    const color = getRiskBandColor(band);
    return {
      background: `${color}20`,
      color: color,
      border: `1px solid ${color}40`,
    };
  };

  // Milestone chart data - shows candidate volume decreasing over time (funnel)
  const milestoneChartData = useMemo(() => {
    if (!forecast) return [];

    // Build funnel data: time on X-axis, volume on Y-axis
    const pipelineByStage = forecast.pipelineRequirements.byStage;
    const milestones = forecast.milestoneTimeline.milestones;

    // Map milestones to pipeline stages and candidate volumes
    const stageToVolumeMap: Record<string, number> = {};
    pipelineByStage.forEach(s => {
      stageToVolumeMap[s.stage] = s.candidatesNeeded;
    });

    // Create data points combining timeline with volume
    const dataPoints = milestones.map((m, idx) => {
      // Map milestone to volume - work backwards through funnel
      let volume: number;
      if (m.milestone === 'Hire Complete') {
        volume = 1;
      } else if (m.milestone === 'Offer Extended') {
        volume = stageToVolumeMap['Offer'] || 2;
      } else if (m.milestone === 'Onsite Loop') {
        volume = stageToVolumeMap['Onsite'] || 4;
      } else if (m.milestone === 'HM Interviews') {
        volume = stageToVolumeMap['HM Screen'] || 8;
      } else if (m.milestone === 'Screens Complete') {
        volume = stageToVolumeMap['Screen'] || 15;
      } else {
        // Pipeline Building - top of funnel
        volume = forecast.pipelineRequirements.totalCandidatesNeeded;
      }

      return {
        day: m.targetDay,
        dayMin: m.rangeMin,
        dayMax: m.rangeMax,
        milestone: m.milestone,
        volume,
        volumeMin: Math.max(1, Math.round(volume * 0.7)),
        volumeMax: Math.round(volume * 1.3)
      };
    });

    return dataPoints;
  }, [forecast]);

  // Pipeline chart data
  const pipelineChartData = useMemo(() => {
    if (!forecast) return [];
    return forecast.pipelineRequirements.byStage.map(s => ({
      stage: s.stage,
      needed: s.candidatesNeeded,
      rate: Math.round(s.conversionRateUsed * 100)
    }));
  }, [forecast]);

  const getHealthColor = (status: HealthStatus) => {
    switch (status) {
      case 'on-track': return '#22c55e';
      case 'at-risk': return '#f59e0b';
      case 'off-track': return '#dc2626';
    }
  };

  const getHealthBadgeClass = (status: HealthStatus) => {
    switch (status) {
      case 'on-track': return 'badge-success-soft';
      case 'at-risk': return 'badge-warning-soft';
      case 'off-track': return 'badge-danger-soft';
    }
  };

  return (
    <div>
      {/* Sub-tab Navigation */}
      <div className="d-flex gap-2 mb-4">
        <button
          className={`btn ${activeSubTab === 'health' ? 'btn-bespoke-primary' : 'btn-bespoke-secondary'}`}
          onClick={() => setActiveSubTab('health')}
        >
          <i className="bi bi-heart-pulse me-2"></i>
          Active Role Health
          {healthSummary.offTrack > 0 && (
            <span className="badge bg-danger ms-2">{healthSummary.offTrack}</span>
          )}
        </button>
        <button
          className={`btn ${activeSubTab === 'planner' ? 'btn-bespoke-primary' : 'btn-bespoke-secondary'}`}
          onClick={() => setActiveSubTab('planner')}
        >
          <i className="bi bi-calculator me-2"></i>
          New Role Planner
        </button>
      </div>

      {/* ===== NEW ROLE PLANNER ===== */}
      {activeSubTab === 'planner' && (
        <div>
          {/* Wizard Progress */}
          <div className="d-flex justify-content-center mb-4">
            <div className="d-flex align-items-center gap-3">
              <div className={`rounded-circle d-flex align-items-center justify-content-center ${wizardStep === 'profile' ? 'text-white' : ''}`} style={{ width: 36, height: 36, background: wizardStep === 'profile' ? '#f59e0b' : '#27272a', color: wizardStep === 'profile' ? 'white' : '#94A3B8' }}>
                1
              </div>
              <div style={{ width: 40, height: 1, background: '#3f3f46' }}></div>
              <div className={`rounded-circle d-flex align-items-center justify-content-center`} style={{ width: 36, height: 36, background: wizardStep === 'hm' ? '#f59e0b' : wizardStep === 'results' ? '#10b981' : '#27272a', color: wizardStep === 'hm' || wizardStep === 'results' ? 'white' : '#94A3B8' }}>
                2
              </div>
              <div style={{ width: 40, height: 1, background: '#3f3f46' }}></div>
              <div className={`rounded-circle d-flex align-items-center justify-content-center`} style={{ width: 36, height: 36, background: wizardStep === 'results' ? '#10b981' : '#27272a', color: wizardStep === 'results' ? 'white' : '#94A3B8' }}>
                3
              </div>
            </div>
          </div>

          {/* Step 1: Role Profile */}
          {wizardStep === 'profile' && (
            <div className="card-bespoke">
              <div className="card-header">
                <SectionHeader
                  title="Step 1: Define Role Profile"
                  subtitle="Select the characteristics of the role you're planning to hire"
                />
              </div>
              <div className="card-body">
                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label fw-medium">Function *</label>
                    <select
                      className="form-select"
                      value={roleProfile.function}
                      onChange={e => setRoleProfile({ ...roleProfile, function: e.target.value })}
                    >
                      <option value="">Select function...</option>
                      {functions.map(f => (
                        <option key={f} value={f}>{f}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label fw-medium">Level *</label>
                    <select
                      className="form-select"
                      value={roleProfile.level}
                      onChange={e => setRoleProfile({ ...roleProfile, level: e.target.value })}
                    >
                      <option value="">Select level...</option>
                      {levels.map(l => (
                        <option key={l} value={l}>{l}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label fw-medium">Location Type *</label>
                    <select
                      className="form-select"
                      value={roleProfile.locationType}
                      onChange={e => setRoleProfile({ ...roleProfile, locationType: e.target.value })}
                    >
                      <option value="">Select location type...</option>
                      {locationTypes.map(lt => (
                        <option key={lt} value={lt}>{lt}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label fw-medium">Job Family *</label>
                    <select
                      className="form-select"
                      value={roleProfile.jobFamily}
                      onChange={e => setRoleProfile({ ...roleProfile, jobFamily: e.target.value })}
                    >
                      <option value="">Select job family...</option>
                      {jobFamilies.map(jf => (
                        <option key={jf} value={jf}>{jf}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="d-flex justify-content-end mt-4">
                  <button
                    className="btn btn-bespoke-primary"
                    disabled={!roleProfile.function || !roleProfile.level || !roleProfile.locationType || !roleProfile.jobFamily}
                    onClick={() => setWizardStep('hm')}
                  >
                    Next: Select Hiring Manager <i className="bi bi-arrow-right ms-2"></i>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Hiring Manager */}
          {wizardStep === 'hm' && (
            <div className="card-bespoke">
              <div className="card-header">
                <SectionHeader
                  title="Step 2: Select Hiring Manager (Optional)"
                  subtitle="HM selection affects time predictions based on their historical latency"
                />
              </div>
              <div className="card-body">
                <div className="row">
                  <div className="col-md-6">
                    <label className="form-label fw-medium">Hiring Manager</label>
                    <select
                      className="form-select"
                      value={roleProfile.hiringManagerId || ''}
                      onChange={e => setRoleProfile({ ...roleProfile, hiringManagerId: e.target.value || undefined })}
                    >
                      <option value="">No HM selected (use average)</option>
                      {hiringManagers.map(hm => (
                        <option key={hm.user_id} value={hm.user_id}>{hm.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-md-6">
                    {selectedHMMetrics && (
                      <div style={{ background: '#141414', border: '1px solid #27272a', borderRadius: '2px' }}>
                        <div className="card-body">
                          <h6 className="mb-3" style={{ color: '#f5f5f5' }}>HM Insights</h6>
                          <div className="d-flex justify-content-between mb-2">
                            <span className="text-muted">Avg Feedback Latency:</span>
                            <strong className={selectedHMMetrics.feedbackLatencyMedian && selectedHMMetrics.feedbackLatencyMedian > 48 ? 'text-warning' : ''}>
                              {selectedHMMetrics.feedbackLatencyMedian ? `${Math.round(selectedHMMetrics.feedbackLatencyMedian)}hrs` : '-'}
                            </strong>
                          </div>
                          <div className="d-flex justify-content-between mb-2">
                            <span className="text-muted">Decision Latency:</span>
                            <strong className={selectedHMMetrics.decisionLatencyMedian && selectedHMMetrics.decisionLatencyMedian > 72 ? 'text-warning' : ''}>
                              {selectedHMMetrics.decisionLatencyMedian ? `${Math.round(selectedHMMetrics.decisionLatencyMedian / 24)}d` : '-'}
                            </strong>
                          </div>
                          <div className="d-flex justify-content-between mb-2">
                            <span className="text-muted">Offer Accept Rate:</span>
                            <strong>
                              {selectedHMMetrics.offerAcceptanceRate !== null ? `${Math.round(selectedHMMetrics.offerAcceptanceRate * 100)}%` : '-'}
                            </strong>
                          </div>
                          <div className="d-flex justify-content-between">
                            <span className="text-muted">HM Weight:</span>
                            <span className={`badge-bespoke ${selectedHMMetrics.hmWeight > 1.1 ? 'badge-warning-soft' : selectedHMMetrics.hmWeight < 0.9 ? 'badge-success-soft' : 'badge-neutral-soft'}`}>
                              {selectedHMMetrics.hmWeight.toFixed(2)}x
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                    {!selectedHMMetrics && roleProfile.hiringManagerId && (
                      <div style={{ background: 'rgba(45, 212, 191, 0.1)', border: '1px solid #2dd4bf', borderRadius: '2px', padding: '0.75rem', color: '#2dd4bf' }}>
                        No historical data available for this HM
                      </div>
                    )}
                  </div>
                </div>
                <div className="d-flex justify-content-between mt-4">
                  <button
                    className="btn btn-bespoke-secondary"
                    onClick={() => setWizardStep('profile')}
                  >
                    <i className="bi bi-arrow-left me-2"></i> Back
                  </button>
                  <button
                    className="btn btn-bespoke-primary"
                    onClick={handleGenerateForecast}
                  >
                    Generate Forecast <i className="bi bi-lightning ms-2"></i>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Results */}
          {wizardStep === 'results' && forecast && (
            <div>
              {/* Summary Cards */}
              <div className="row g-3 mb-4">
                <div className="col-md-4">
                  <div className="card-bespoke text-center">
                    <div className="card-body">
                      <StatLabel className="mb-2">Expected Time-to-Fill</StatLabel>
                      <StatValue color="primary">{forecast.ttfPrediction.medianDays} days</StatValue>
                      <div className="text-muted small">
                        Range: {forecast.ttfPrediction.p25Days}-{forecast.ttfPrediction.p75Days} days
                      </div>
                      <div className={`badge-bespoke mt-2 ${forecast.ttfPrediction.confidenceLevel === 'high' ? 'badge-success-soft' : forecast.ttfPrediction.confidenceLevel === 'medium' ? 'badge-warning-soft' : 'badge-danger-soft'}`}>
                        {forecast.ttfPrediction.confidenceLevel} confidence
                      </div>
                    </div>
                  </div>
                </div>
                <div className="col-md-4">
                  <div className="card-bespoke text-center">
                    <div className="card-body">
                      <StatLabel className="mb-2">Candidates Needed</StatLabel>
                      <StatValue>{forecast.pipelineRequirements.totalCandidatesNeeded}</StatValue>
                      <div className="text-muted small">top of funnel</div>
                    </div>
                  </div>
                </div>
                <div className="col-md-4">
                  <div className="card-bespoke text-center">
                    <div className="card-body">
                      <StatLabel className="mb-2">Complexity Score</StatLabel>
                      <StatValue color={forecast.complexityScore > 1.5 ? 'warning' : 'default'}>
                        {forecast.complexityScore.toFixed(1)}x
                      </StatValue>
                      <div className="text-muted small">vs baseline role</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Milestone Timeline - Funnel over time */}
              <div className="card-bespoke mb-4">
                <div className="card-header">
                  <h6 className="mb-0"><i className="bi bi-funnel me-2"></i> Pipeline Funnel Over Time</h6>
                </div>
                <div className="card-body">
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={milestoneChartData} margin={{ top: 10, right: 30, left: 10, bottom: 30 }}>
                      <defs>
                        <linearGradient id="volumeGradient" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.6} />
                          <stop offset="100%" stopColor="#2dd4bf" stopOpacity={0.4} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
                      <XAxis
                        dataKey="day"
                        fontSize={11}
                        stroke="#94A3B8"
                        tick={{ fontFamily: "'JetBrains Mono', monospace", fill: '#94A3B8' }}
                        label={{ value: 'Days from Start', position: 'bottom', fontSize: 11, dy: 10, fill: '#94A3B8' }}
                        tickFormatter={(val) => `Day ${val}`}
                      />
                      <YAxis
                        fontSize={11}
                        stroke="#94A3B8"
                        tick={{ fontFamily: "'JetBrains Mono', monospace", fill: '#94A3B8' }}
                        label={{ value: 'Candidates', angle: -90, position: 'insideLeft', fontSize: 11, dx: -5, fill: '#94A3B8' }}
                      />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (!active || !payload?.[0]) return null;
                          const d = payload[0].payload;
                          return (
                            <div style={{ background: '#0a0a0a', border: '1px solid #3f3f46', borderRadius: '4px', padding: '8px 12px' }}>
                              <div style={{ fontWeight: 600, color: '#f5f5f5' }}>{d.milestone}</div>
                              <div style={{ fontSize: '0.85rem', color: '#94A3B8' }}>Day {d.day} (range: {d.dayMin}-{d.dayMax})</div>
                              <div style={{ fontSize: '0.85rem', color: '#f59e0b', fontWeight: 500 }}>{d.volume} candidates remaining</div>
                            </div>
                          );
                        }}
                      />
                      <Area
                        type="stepAfter"
                        dataKey="volume"
                        stroke="#f59e0b"
                        strokeWidth={2}
                        fill="url(#volumeGradient)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                  <div className="d-flex justify-content-center gap-4 mt-2 small text-muted">
                    {milestoneChartData.map((d, i) => (
                      <span key={i} className="d-flex align-items-center gap-1">
                        <span className="fw-medium">{d.volume}</span>
                        <span>→ {d.milestone}</span>
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Pipeline & Sources Row */}
              <div className="row g-4 mb-4">
                {/* Pipeline Requirements */}
                <div className="col-md-6">
                  <div className="card-bespoke h-100">
                    <div className="card-header">
                      <h6 className="mb-0"><i className="bi bi-funnel me-2"></i> Pipeline Requirements</h6>
                    </div>
                    <div className="card-body">
                      <ResponsiveContainer width="100%" height={180}>
                        <BarChart data={pipelineChartData} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
                          <XAxis type="number" fontSize={11} stroke="#94A3B8" tick={{ fontFamily: "'JetBrains Mono', monospace", fill: '#94A3B8' }} />
                          <YAxis dataKey="stage" type="category" width={80} fontSize={11} stroke="#94A3B8" tick={{ fill: '#94A3B8' }} />
                          <Tooltip
                            content={({ active, payload }) => {
                              if (!active || !payload?.[0]) return null;
                              const d = payload[0].payload;
                              return (
                                <div style={{ background: '#0a0a0a', border: '1px solid #3f3f46', borderRadius: '4px', padding: '8px 12px' }}>
                                  <div style={{ fontWeight: 600, color: '#f5f5f5' }}>{d.stage}</div>
                                  <div style={{ fontSize: '0.85rem', color: '#94A3B8' }}>Need {d.needed} candidates</div>
                                  <div style={{ fontSize: '0.85rem', color: '#94A3B8' }}>{d.rate}% conversion rate</div>
                                </div>
                              );
                            }}
                          />
                          <Bar dataKey="needed" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                {/* Source Mix */}
                <div className="col-md-6">
                  <div className="card-bespoke h-100">
                    <div className="card-header">
                      <h6 className="mb-0"><i className="bi bi-pie-chart me-2"></i> Recommended Source Mix</h6>
                    </div>
                    <div className="card-body">
                      {forecast.sourceMix.recommendations.slice(0, 4).map(src => (
                        <div key={src.source} className="d-flex align-items-center mb-3">
                          <div className="flex-grow-1">
                            <div className="d-flex justify-content-between mb-1">
                              <span className="fw-medium">{src.source}</span>
                              <span>{src.targetPercentage}%</span>
                            </div>
                            <div className="progress" style={{ height: 8 }}>
                              <div
                                className="progress-bar bg-primary"
                                style={{ width: `${src.targetPercentage}%` }}
                              ></div>
                            </div>
                            <div className="small text-muted mt-1">
                              {(src.historicalHireRate * 100).toFixed(0)}% hire rate, {src.historicalTTF}d avg TTF
                            </div>
                          </div>
                        </div>
                      ))}
                      {forecast.sourceMix.insights.length > 0 && (
                        <div className="alert alert-info small mb-0 mt-3">
                          <i className="bi bi-lightbulb me-2"></i>
                          {forecast.sourceMix.insights[0]}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Risk Factors */}
              {forecast.riskFactors.length > 0 && (
                <div className="card-bespoke mb-4">
                  <div className="card-header">
                    <h6 className="mb-0"><i className="bi bi-exclamation-triangle me-2"></i> Risk Factors</h6>
                  </div>
                  <div className="card-body p-0">
                    <div className="list-group list-group-flush">
                      {forecast.riskFactors.map((risk, i) => (
                        <div key={i} className="list-group-item">
                          <div className="d-flex align-items-start">
                            <span className={`badge-bespoke me-3 ${risk.severity === 'high' ? 'badge-danger-soft' : risk.severity === 'medium' ? 'badge-warning-soft' : 'badge-neutral-soft'}`}>
                              {risk.severity.toUpperCase()}
                            </span>
                            <div className="flex-grow-1">
                              <div className="fw-medium">{risk.factor}</div>
                              <div className="small text-muted">{risk.dataPoint}</div>
                              <div className="small mt-1">
                                <strong>Impact:</strong> {risk.impact}
                              </div>
                              <div className="small text-success">
                                <strong>Mitigation:</strong> {risk.mitigation}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="d-flex justify-content-between">
                <button className="btn btn-bespoke-secondary" onClick={handleResetWizard}>
                  <i className="bi bi-arrow-counterclockwise me-2"></i> Start Over
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===== ACTIVE ROLE HEALTH ===== */}
      {activeSubTab === 'health' && (
        <div>
          {/* Summary Cards */}
          <div className="row g-3 mb-4">
            <div className="col-6 col-md-3">
              <div
                className={`card-bespoke text-center cursor-pointer ${healthFilter === 'all' ? 'border-primary shadow' : ''}`}
                onClick={() => setHealthFilter('all')}
                style={{ cursor: 'pointer' }}
              >
                <div className="card-body">
                  <StatLabel className="mb-2">Total Open</StatLabel>
                  <StatValue>{healthSummary.total}</StatValue>
                </div>
              </div>
            </div>
            <div className="col-6 col-md-3">
              <div
                className={`card-bespoke text-center cursor-pointer ${healthFilter === 'on-track' ? 'border-primary shadow' : ''}`}
                onClick={() => setHealthFilter('on-track')}
                style={{ cursor: 'pointer' }}
              >
                <div className="card-body">
                  <StatLabel className="mb-2 text-success">On Track</StatLabel>
                  <StatValue color="success">{healthSummary.onTrack}</StatValue>
                </div>
              </div>
            </div>
            <div className="col-6 col-md-3">
              <div
                className={`card-bespoke text-center cursor-pointer ${healthFilter === 'at-risk' ? 'border-primary shadow' : ''}`}
                onClick={() => setHealthFilter('at-risk')}
                style={{ cursor: 'pointer' }}
              >
                <div className="card-body">
                  <StatLabel className="mb-2 text-warning">At Risk</StatLabel>
                  <StatValue color="warning">{healthSummary.atRisk}</StatValue>
                </div>
              </div>
            </div>
            <div className="col-6 col-md-3">
              <div
                className={`card-bespoke text-center cursor-pointer ${healthFilter === 'off-track' ? 'border-primary shadow' : ''}`}
                onClick={() => setHealthFilter('off-track')}
                style={{ cursor: 'pointer' }}
              >
                <div className="card-body">
                  <StatLabel className="mb-2 text-danger">Off Track</StatLabel>
                  <StatValue color="danger">{healthSummary.offTrack}</StatValue>
                </div>
              </div>
            </div>
          </div>

          {/* Pre-Mortem Risk Summary */}
          <div className="d-flex gap-2 mb-4 flex-wrap align-items-center">
            <span className="text-muted small me-2">Pre-Mortem Risk:</span>
            <span
              className="badge rounded-pill d-flex align-items-center gap-1"
              style={{
                ...getRiskBadgeStyle('HIGH'),
                padding: '0.4rem 0.75rem',
                fontSize: '0.8rem',
              }}
            >
              <i className="bi bi-exclamation-triangle-fill"></i>
              {riskSummary.high} High
            </span>
            <span
              className="badge rounded-pill d-flex align-items-center gap-1"
              style={{
                ...getRiskBadgeStyle('MED'),
                padding: '0.4rem 0.75rem',
                fontSize: '0.8rem',
              }}
            >
              <i className="bi bi-exclamation-circle"></i>
              {riskSummary.med} Medium
            </span>
            <span
              className="badge rounded-pill d-flex align-items-center gap-1"
              style={{
                ...getRiskBadgeStyle('LOW'),
                padding: '0.4rem 0.75rem',
                fontSize: '0.8rem',
              }}
            >
              <i className="bi bi-check-circle"></i>
              {riskSummary.low} Low
            </span>
          </div>

          {/* Health Table */}
          <div className="card-bespoke mb-4">
            <div className="card-header d-flex justify-content-between align-items-center">
              <h6 className="mb-0">Open Requisitions</h6>
              <span className="small text-muted">Click row for details, or "View" for pre-mortem analysis</span>
            </div>
            <div className="card-body p-0">
              <div className="table-responsive">
                <table className="table table-bespoke table-hover mb-0">
                  <thead>
                    <tr>
                      <th>Role</th>
                      <th className="text-end">Days Open</th>
                      <th className="text-end">Pipeline</th>
                      <th className="text-center">Status</th>
                      <th className="text-center">Risk</th>
                      <th>Failure Mode</th>
                      <th className="text-end">Predicted Fill</th>
                      <th>Primary Issue</th>
                      <th className="text-center" style={{ width: '60px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredHealthMetrics
                      .sort((a, b) => {
                        // Sort by pre-mortem risk score (highest first) then health score
                        const pmA = preMortemByReqId.get(a.reqId);
                        const pmB = preMortemByReqId.get(b.reqId);
                        const riskA = pmA?.risk_score ?? 0;
                        const riskB = pmB?.risk_score ?? 0;
                        if (riskB !== riskA) return riskB - riskA;
                        return a.healthScore - b.healthScore;
                      })
                      .slice(healthPage * HEALTH_PAGE_SIZE, (healthPage + 1) * HEALTH_PAGE_SIZE)
                      .map(req => {
                        const preMortem = preMortemByReqId.get(req.reqId);
                        return (
                        <tr
                          key={req.reqId}
                          className={selectedHealthReq === req.reqId ? 'bg-soft-primary' : ''}
                          style={{ cursor: 'pointer' }}
                          onClick={() => setSelectedHealthReq(selectedHealthReq === req.reqId ? null : req.reqId)}
                        >
                          <td>
                            <div className="fw-medium">{req.reqTitle}</div>
                            <div className="small text-muted">{req.function} {req.level}</div>
                          </td>
                          <td className="text-end">
                            <span className={req.daysOpen > req.benchmarkTTF ? 'text-danger fw-bold' : ''}>
                              {req.daysOpen}d
                            </span>
                            <div className="small text-muted">/ {req.benchmarkTTF}d benchmark</div>
                          </td>
                          <td className="text-end">
                            <span className={req.pipelineGap < 0 ? 'text-danger fw-bold' : ''}>
                              {req.currentPipelineDepth}
                            </span>
                            <span className="text-muted">/{req.benchmarkPipelineDepth}</span>
                          </td>
                          <td className="text-center">
                            <span className={`badge-bespoke ${getHealthBadgeClass(req.healthStatus)}`}>
                              {req.healthScore}
                            </span>
                          </td>
                          {/* Risk Score + Band */}
                          <td className="text-center">
                            {preMortem ? (
                              <span
                                className="badge rounded-pill font-monospace"
                                style={{
                                  ...getRiskBadgeStyle(preMortem.risk_band),
                                  padding: '0.35rem 0.6rem',
                                  fontSize: '0.75rem',
                                }}
                                title={`Risk Score: ${preMortem.risk_score}/100`}
                              >
                                {preMortem.risk_band} {preMortem.risk_score}
                              </span>
                            ) : (
                              <span className="text-muted small">-</span>
                            )}
                          </td>
                          {/* Failure Mode */}
                          <td>
                            {preMortem ? (
                              <span
                                className="small"
                                style={{ color: getRiskBandColor(preMortem.risk_band) }}
                              >
                                {getFailureModeLabel(preMortem.failure_mode)}
                              </span>
                            ) : (
                              <span className="text-muted small">-</span>
                            )}
                          </td>
                          <td className="text-end">
                            {req.predictedFillDate ? (
                              <span>{format(req.predictedFillDate, 'MMM d')}</span>
                            ) : (
                              <span className="text-danger">Unknown</span>
                            )}
                          </td>
                          <td>
                            <span className="small text-muted">{req.primaryIssue || '-'}</span>
                          </td>
                          {/* View Pre-Mortem Button */}
                          <td className="text-center">
                            {preMortem && (
                              <button
                                type="button"
                                className="btn btn-sm btn-bespoke-secondary"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleViewPreMortem(req.reqId);
                                }}
                                title="View Pre-Mortem Analysis"
                                style={{ padding: '0.25rem 0.5rem' }}
                              >
                                <i className="bi bi-eye"></i>
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                      })}
                  </tbody>
                </table>
              </div>
              {/* Pagination */}
              {filteredHealthMetrics.length > HEALTH_PAGE_SIZE && (
                <div className="card-footer d-flex justify-content-between align-items-center">
                  <span className="text-muted small">
                    Showing {healthPage * HEALTH_PAGE_SIZE + 1}-{Math.min((healthPage + 1) * HEALTH_PAGE_SIZE, filteredHealthMetrics.length)} of {filteredHealthMetrics.length}
                  </span>
                  <div className="btn-group btn-group-sm">
                    <button
                      className="btn btn-outline-secondary"
                      disabled={healthPage === 0}
                      onClick={() => setHealthPage(p => p - 1)}
                    >
                      Previous
                    </button>
                    <button
                      className="btn btn-outline-secondary"
                      disabled={(healthPage + 1) * HEALTH_PAGE_SIZE >= filteredHealthMetrics.length}
                      onClick={() => setHealthPage(p => p + 1)}
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Selected Role Detail */}
          {selectedHealthDetails && (
            <div className="card-bespoke border-primary">
              <div className="card-header d-flex justify-content-between align-items-center">
                <h6 className="mb-0">
                  {selectedHealthDetails.reqTitle}
                  <span className={`badge-bespoke ms-2 ${getHealthBadgeClass(selectedHealthDetails.healthStatus)}`}>
                    Score: {selectedHealthDetails.healthScore}
                  </span>
                </h6>
                <button className="btn btn-sm btn-bespoke-secondary" onClick={() => setSelectedHealthReq(null)}>
                  <i className="bi bi-x-lg"></i>
                </button>
              </div>
              <div className="card-body">
                <div className="row g-4">
                  {/* Metrics */}
                  <div className="col-md-6">
                    <h6 className="mb-3">Metrics</h6>
                    <div className="d-flex justify-content-between mb-2">
                      <span className="text-muted">Recruiter:</span>
                      <span>{selectedHealthDetails.recruiterName}</span>
                    </div>
                    <div className="d-flex justify-content-between mb-2">
                      <span className="text-muted">Hiring Manager:</span>
                      <span>{selectedHealthDetails.hiringManagerName}</span>
                    </div>
                    <div className="d-flex justify-content-between mb-2">
                      <span className="text-muted">Days Open:</span>
                      <span>{selectedHealthDetails.daysOpen}d (benchmark: {selectedHealthDetails.benchmarkTTF}d)</span>
                    </div>
                    <div className="d-flex justify-content-between mb-2">
                      <span className="text-muted">Pipeline Depth:</span>
                      <span className={selectedHealthDetails.pipelineGap < 0 ? 'text-danger' : ''}>
                        {selectedHealthDetails.currentPipelineDepth} ({selectedHealthDetails.pipelineGap >= 0 ? '+' : ''}{selectedHealthDetails.pipelineGap} vs benchmark)
                      </span>
                    </div>
                    <div className="d-flex justify-content-between mb-2">
                      <span className="text-muted">Last Activity:</span>
                      <span className={selectedHealthDetails.daysSinceActivity > 7 ? 'text-warning' : ''}>
                        {selectedHealthDetails.daysSinceActivity}d ago
                      </span>
                    </div>
                    <div className="d-flex justify-content-between">
                      <span className="text-muted">Velocity Trend:</span>
                      <span className={`badge-bespoke ${selectedHealthDetails.velocityTrend === 'improving' ? 'badge-success-soft' :
                        selectedHealthDetails.velocityTrend === 'stalled' ? 'badge-danger-soft' :
                          selectedHealthDetails.velocityTrend === 'declining' ? 'badge-warning-soft' : 'badge-neutral-soft'
                        }`}>
                        {selectedHealthDetails.velocityTrend}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="col-md-6">
                    <h6 className="mb-3">Recommended Actions</h6>
                    {selectedHealthDetails.actionRecommendations.length > 0 ? (
                      <div className="list-group list-group-flush">
                        {selectedHealthDetails.actionRecommendations.map((action, i) => (
                          <div key={i} className="list-group-item px-0">
                            <div className="d-flex align-items-start">
                              <span className={`badge-bespoke me-2 ${action.priority === 'urgent' ? 'badge-danger-soft' :
                                action.priority === 'important' ? 'badge-warning-soft' : 'badge-neutral-soft'
                                }`}>
                                {action.priority}
                              </span>
                              <div>
                                <div className="fw-medium">{action.action}</div>
                                <div className="small text-muted">
                                  {action.expectedImpact} <span className="text-primary">({action.owner})</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-muted">No specific actions recommended - role is on track!</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Pre-Mortem Detail Drawer */}
      <PreMortemDrawer
        isOpen={preMortemDrawerOpen}
        onClose={() => {
          setPreMortemDrawerOpen(false);
          setSelectedPreMortem(null);
        }}
        result={selectedPreMortem}
        onAddToQueue={onAddToActionQueue ? handleAddToQueue : undefined}
      />
    </div>
  );
}
