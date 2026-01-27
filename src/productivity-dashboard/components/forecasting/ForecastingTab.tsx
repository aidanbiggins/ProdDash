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
  Event as EntityEvent,
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
  calculateActiveRoleHealth,
  generateProbabilisticForecast,
  buildForecastingBenchmarks,
  prepareSimulationParameters
} from '../../services/forecastingService';
import { ForecastResult, SimulationParameters } from '../../services/probabilisticEngine';
import { OracleConfidenceWidget } from './OracleConfidenceWidget';
import { CalibrationCard } from './CalibrationCard';
import { ReqHealthDrawer } from './ReqHealthDrawer';
import { runCalibration, CalibrationReport } from '../../services/calibrationService';
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
import { SectionHeader, StatLabel, StatValue, HelpButton, HelpDrawer, LogoSpinner } from '../common';
import { ActionItem } from '../../types/actionTypes';
import { PageHeader } from '../layout';
import { FORECASTING_PAGE_HELP } from './forecastingHelpContent';

interface ForecastingTabProps {
  requisitions: Requisition[];
  candidates: Candidate[];
  events: EntityEvent[];
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
  const [showPageHelp, setShowPageHelp] = useState(false);
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
  const [probForecast, setProbForecast] = useState<ForecastResult | null>(null);
  const [simParams, setSimParams] = useState<SimulationParameters | null>(null);
  const [calibrationReport, setCalibrationReport] = useState<CalibrationReport | null>(null);
  const [isCalibrating, setIsCalibrating] = useState(false);

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

  // Memoize benchmarks - crucial for performance and correctness of Oracle
  const benchmarks = useMemo(() =>
    buildForecastingBenchmarks(requisitions, candidates, events, users, hmFriction, config),
    [requisitions, candidates, events, users, hmFriction, config]
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

    // Run Oracle Forecast (will likely be low confidence/empty for new roles without pipeline)
    // We simulate an empty pipeline or specific "simulated candidates" could be added here in v2
    generateProbabilisticForecast(
      roleProfile,
      benchmarks, // benchmarks source
      config,
      [], // Empty pipeline for new role
      new Date()
    ).then(res => setProbForecast(res));

    // Set simulation params for What-If analysis
    const params = prepareSimulationParameters(roleProfile, benchmarks, config);
    setSimParams(params);

  }, [roleProfile, requisitions, candidates, events, users, hmFriction, config, benchmarks]);

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

  // Pipeline candidates for selected req (for What-If analysis)
  const selectedReqPipelineCandidates = useMemo(() => {
    if (!selectedHealthReq) return [];
    return candidates.filter(c =>
      c.req_id === selectedHealthReq &&
      ['Screen', 'HM Screen', 'Onsite', 'Offer'].includes(c.current_stage)
    );
  }, [selectedHealthReq, candidates]);

  // Run Oracle when selecting a health req
  React.useEffect(() => {
    if (selectedHealthReq && selectedHealthDetails) {
      // Find candidates for this req
      const activeCandidates = candidates.filter(c =>
        c.req_id === selectedHealthReq &&
        ['Screen', 'HM Screen', 'Onsite', 'Offer'].includes(c.current_stage) // active only
      );

      // Reconstruct role profile
      const profile: RoleProfile = {
        function: selectedHealthDetails.function,
        level: selectedHealthDetails.level,
        locationType: 'Remote', // Todo: get from req
        jobFamily: selectedHealthDetails.jobFamily,
        hiringManagerId: selectedHealthDetails.hiringManagerId
      };

      generateProbabilisticForecast(
        profile,
        benchmarks, // Correct: Pass calculated benchmarks
        config,
        activeCandidates,
        new Date()
      ).then(res => setProbForecast(res));

      // Set simulation params for What-If analysis
      const params = prepareSimulationParameters(profile, benchmarks, config);
      setSimParams(params);
    } else {
      setProbForecast(null);
      setSimParams(null);
    }
  }, [selectedHealthReq, candidates, selectedHealthDetails, benchmarks, config]);

  const handleRunCalibration = useCallback(async () => {
    setIsCalibrating(true);
    // Find completed reqs - STRICT: require both closed_at AND opened_at (no fabrication)
    const completedReqs = requisitions
      .filter(r => r.status === 'Closed' && r.closed_at && r.opened_at)
      .map(r => ({
        reqId: r.req_id,
        hiredDate: r.closed_at!,
        openedDate: r.opened_at!, // STRICT: guaranteed by filter above
        roleProfile: {
          function: r.function,
          level: r.level,
          locationType: r.location_type,
          jobFamily: r.job_family
        }
      }));

    // Run calibration (mocked services)
    // We pass empty snapshot list for now as we don't have them loaded in client
    const report = await runCalibration(completedReqs, [], config, {} as any);
    setCalibrationReport(report);
    setIsCalibrating(false);
  }, [requisitions, config]);

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

  // Get risk badge classes (Tailwind)
  const getRiskBadgeClass = (band: RiskBand) => {
    switch (band) {
      case 'HIGH': return 'bg-bad-bg text-bad border border-bad';
      case 'MED': return 'bg-warn-bg text-warn border border-warn';
      case 'LOW': return 'bg-good-bg text-good border border-good';
      default: return 'bg-white/10 text-muted-foreground border border-white/10';
    }
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
      case 'on-track': return 'bg-good-bg text-good border border-good';
      case 'at-risk': return 'bg-warn-bg text-warn border border-warn';
      case 'off-track': return 'bg-bad-bg text-bad border border-bad';
    }
  };

  return (
    <div>
      {/* Page Header */}
      <PageHeader
        title="Hiring Forecast"
        description="Track role health, plan hiring capacity, and identify risks"
        actions={<HelpButton onClick={() => setShowPageHelp(true)} ariaLabel="Open page help" />}
      />
      <HelpDrawer
        isOpen={showPageHelp}
        onClose={() => setShowPageHelp(false)}
        title="Hiring Forecast"
        content={FORECASTING_PAGE_HELP}
      />

      {/* Sub-tab Navigation */}
      <div className="flex gap-2 mb-4">
        <button
          className={activeSubTab === 'health' ? 'px-4 py-2 bg-accent text-white rounded hover:bg-accent/90' : 'px-4 py-2 bg-bg-glass border border-glass-border rounded hover:bg-white/10'}
          onClick={() => setActiveSubTab('health')}
        >
          <i className="bi bi-heart-pulse mr-2"></i>
          Active Role Health
          {healthSummary.offTrack > 0 && (
            <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-medium rounded-full bg-red-500 text-white ml-2">{healthSummary.offTrack}</span>
          )}
        </button>
        <button
          className={activeSubTab === 'planner' ? 'px-4 py-2 bg-accent text-white rounded hover:bg-accent/90' : 'px-4 py-2 bg-bg-glass border border-glass-border rounded hover:bg-white/10'}
          onClick={() => setActiveSubTab('planner')}
        >
          <i className="bi bi-calculator mr-2"></i>
          New Role Planner
        </button>
      </div>

      {/* ===== NEW ROLE PLANNER ===== */}
      {activeSubTab === 'planner' && (
        <div>
          {/* Wizard Progress */}
          <div className="flex justify-center mb-4">
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center font-medium ${wizardStep === 'profile' ? 'bg-warn text-white' : 'bg-zinc-800 text-muted-foreground'}`}>
                1
              </div>
              <div className="w-10 h-px bg-zinc-700"></div>
              <div className={`w-9 h-9 rounded-full flex items-center justify-center font-medium ${wizardStep === 'hm' ? 'bg-warn text-white' : wizardStep === 'results' ? 'bg-good text-white' : 'bg-zinc-800 text-muted-foreground'}`}>
                2
              </div>
              <div className="w-10 h-px bg-zinc-700"></div>
              <div className={`w-9 h-9 rounded-full flex items-center justify-center font-medium ${wizardStep === 'results' ? 'bg-good text-white' : 'bg-zinc-800 text-muted-foreground'}`}>
                3
              </div>
            </div>
          </div>

          {/* Step 1: Role Profile */}
          {wizardStep === 'profile' && (
            <div className="rounded-lg border border-glass-border bg-bg-glass">
              <div className="px-4 py-3 border-b border-white/10">
                <SectionHeader
                  title="Step 1: Define Role Profile"
                  subtitle="Select the characteristics of the role you're planning to hire"
                />
              </div>
              <div className="p-4">
                <div className="grid grid-cols-12 gap-3">
                  <div className="col-span-12 md:col-span-6">
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Function *</label>
                    <select
                      className="w-full px-3 py-2 text-sm bg-bg-glass border border-glass-border rounded-md"
                      value={roleProfile.function}
                      onChange={e => setRoleProfile({ ...roleProfile, function: e.target.value })}
                    >
                      <option value="">Select function...</option>
                      {functions.map(f => (
                        <option key={f} value={f}>{f}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-12 md:col-span-6">
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Level *</label>
                    <select
                      className="w-full px-3 py-2 text-sm bg-bg-glass border border-glass-border rounded-md"
                      value={roleProfile.level}
                      onChange={e => setRoleProfile({ ...roleProfile, level: e.target.value })}
                    >
                      <option value="">Select level...</option>
                      {levels.map(l => (
                        <option key={l} value={l}>{l}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-12 md:col-span-6">
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Location Type *</label>
                    <select
                      className="w-full px-3 py-2 text-sm bg-bg-glass border border-glass-border rounded-md"
                      value={roleProfile.locationType}
                      onChange={e => setRoleProfile({ ...roleProfile, locationType: e.target.value })}
                    >
                      <option value="">Select location type...</option>
                      {locationTypes.map(lt => (
                        <option key={lt} value={lt}>{lt}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-12 md:col-span-6">
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Job Family *</label>
                    <select
                      className="w-full px-3 py-2 text-sm bg-bg-glass border border-glass-border rounded-md"
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
                <div className="flex justify-end mt-4">
                  <button
                    className="px-4 py-2 bg-accent text-white rounded hover:bg-accent/90 disabled:opacity-50"
                    disabled={!roleProfile.function || !roleProfile.level || !roleProfile.locationType || !roleProfile.jobFamily}
                    onClick={() => setWizardStep('hm')}
                  >
                    Next: Select Hiring Manager <i className="bi bi-arrow-right ml-2"></i>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Hiring Manager */}
          {wizardStep === 'hm' && (
            <div className="rounded-lg border border-glass-border bg-bg-glass">
              <div className="px-4 py-3 border-b border-white/10">
                <SectionHeader
                  title="Step 2: Select Hiring Manager (Optional)"
                  subtitle="HM selection affects time predictions based on their historical latency"
                />
              </div>
              <div className="p-4">
                <div className="grid grid-cols-12 gap-4">
                  <div className="col-span-12 md:col-span-6">
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Hiring Manager</label>
                    <select
                      className="w-full px-3 py-2 text-sm bg-bg-glass border border-glass-border rounded-md"
                      value={roleProfile.hiringManagerId || ''}
                      onChange={e => setRoleProfile({ ...roleProfile, hiringManagerId: e.target.value || undefined })}
                    >
                      <option value="">No HM selected (use average)</option>
                      {hiringManagers.map(hm => (
                        <option key={hm.user_id} value={hm.user_id}>{hm.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-12 md:col-span-6">
                    {selectedHMMetrics && (
                      <div className="rounded bg-zinc-900 border border-zinc-800">
                        <div className="p-4">
                          <h6 className="mb-3 text-foreground">HM Insights</h6>
                          <div className="flex justify-between mb-2">
                            <span className="text-muted-foreground">Avg Feedback Latency:</span>
                            <strong className={selectedHMMetrics.feedbackLatencyMedian && selectedHMMetrics.feedbackLatencyMedian > 48 ? 'text-warn' : 'text-foreground'}>
                              {selectedHMMetrics.feedbackLatencyMedian ? `${Math.round(selectedHMMetrics.feedbackLatencyMedian)}hrs` : '-'}
                            </strong>
                          </div>
                          <div className="flex justify-between mb-2">
                            <span className="text-muted-foreground">Decision Latency:</span>
                            <strong className={selectedHMMetrics.decisionLatencyMedian && selectedHMMetrics.decisionLatencyMedian > 72 ? 'text-warn' : 'text-foreground'}>
                              {selectedHMMetrics.decisionLatencyMedian ? `${Math.round(selectedHMMetrics.decisionLatencyMedian / 24)}d` : '-'}
                            </strong>
                          </div>
                          <div className="flex justify-between mb-2">
                            <span className="text-muted-foreground">Offer Accept Rate:</span>
                            <strong className="text-foreground">
                              {selectedHMMetrics.offerAcceptanceRate !== null ? `${Math.round(selectedHMMetrics.offerAcceptanceRate * 100)}%` : '-'}
                            </strong>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">HM Weight:</span>
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${selectedHMMetrics.hmWeight > 1.1 ? 'bg-warn-bg text-warn' : selectedHMMetrics.hmWeight < 0.9 ? 'bg-good-bg text-good' : 'bg-white/10 text-muted-foreground'}`}>
                              {selectedHMMetrics.hmWeight.toFixed(2)}x
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                    {!selectedHMMetrics && roleProfile.hiringManagerId && (
                      <div className="rounded p-3 bg-accent/10 border border-accent text-accent">
                        No historical data available for this HM
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex justify-between mt-4">
                  <button
                    className="px-4 py-2 bg-bg-glass border border-glass-border rounded hover:bg-white/10"
                    onClick={() => setWizardStep('profile')}
                  >
                    <i className="bi bi-arrow-left mr-2"></i> Back
                  </button>
                  <button
                    className="px-4 py-2 bg-accent text-white rounded hover:bg-accent/90"
                    onClick={handleGenerateForecast}
                  >
                    Generate Forecast <i className="bi bi-lightning ml-2"></i>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Results */}
          {wizardStep === 'results' && forecast && (
            <div>
              {/* Summary Cards */}
              <div className="grid grid-cols-12 gap-3 mb-4">
                <div className="col-span-12 md:col-span-5">
                  {/* Oracle Widget replaces simple TTF card */}
                  {probForecast ? (
                    <OracleConfidenceWidget
                      forecast={probForecast}
                      startDate={new Date()}
                      simulationParams={simParams || undefined}
                    />
                  ) : (
                    <div className="rounded-lg border border-glass-border bg-bg-glass text-center h-full flex items-center justify-center">
                      <LogoSpinner size={40} layout="stacked" />
                    </div>
                  )}
                </div>
                <div className="col-span-12 md:col-span-3">
                  <div className="rounded-lg border border-glass-border bg-bg-glass text-center h-full">
                    <div className="p-4">
                      <StatLabel className="mb-2">Candidates Needed</StatLabel>
                      <StatValue>{forecast.pipelineRequirements.totalCandidatesNeeded}</StatValue>
                      <div className="text-muted-foreground text-sm">top of funnel</div>
                    </div>
                  </div>
                </div>
                <div className="col-span-12 md:col-span-4">
                  <CalibrationCard
                    report={calibrationReport}
                    isLoading={isCalibrating}
                    onRunCalibration={handleRunCalibration}
                    className="h-full"
                  />
                </div>
              </div>

              {/* Milestone Timeline - Funnel over time */}
              <div className="rounded-lg border border-glass-border bg-bg-glass mb-4">
                <div className="px-4 py-3 border-b border-white/10">
                  <h6 className="mb-0 text-foreground"><i className="bi bi-funnel mr-2"></i> Pipeline Funnel Over Time</h6>
                </div>
                <div className="p-4">
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
                            <div className="bg-zinc-950 border border-zinc-700 rounded p-3">
                              <div className="font-semibold text-foreground">{d.milestone}</div>
                              <div className="text-sm text-muted-foreground">Day {d.day} (range: {d.dayMin}-{d.dayMax})</div>
                              <div className="text-sm text-warn font-medium">{d.volume} candidates remaining</div>
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
                  <div className="flex justify-center gap-4 mt-2 text-sm text-muted-foreground">
                    {milestoneChartData.map((d, i) => (
                      <span key={i} className="flex items-center gap-1">
                        <span className="font-medium">{d.volume}</span>
                        <span>→ {d.milestone}</span>
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Pipeline & Sources Row */}
              <div className="grid grid-cols-12 gap-4 mb-4">
                {/* Pipeline Requirements */}
                <div className="col-span-12 md:col-span-6">
                  <div className="rounded-lg border border-glass-border bg-bg-glass h-full">
                    <div className="px-4 py-3 border-b border-white/10">
                      <h6 className="mb-0 text-foreground"><i className="bi bi-funnel mr-2"></i> Pipeline Requirements</h6>
                    </div>
                    <div className="p-4">
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
                                <div className="bg-zinc-950 border border-zinc-700 rounded p-3">
                                  <div className="font-semibold text-foreground">{d.stage}</div>
                                  <div className="text-sm text-muted-foreground">Need {d.needed} candidates</div>
                                  <div className="text-sm text-muted-foreground">{d.rate}% conversion rate</div>
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
                <div className="col-span-12 md:col-span-6">
                  <div className="rounded-lg border border-glass-border bg-bg-glass h-full">
                    <div className="px-4 py-3 border-b border-white/10">
                      <h6 className="mb-0 text-foreground"><i className="bi bi-pie-chart mr-2"></i> Recommended Source Mix</h6>
                    </div>
                    <div className="p-4">
                      {forecast.sourceMix.recommendations.slice(0, 4).map(src => (
                        <div key={src.source} className="flex items-center mb-3">
                          <div className="grow">
                            <div className="flex justify-between mb-1">
                              <span className="font-medium">{src.source}</span>
                              <span>{src.targetPercentage}%</span>
                            </div>
                            <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-primary"
                                style={{ width: `${src.targetPercentage}%` }}
                              ></div>
                            </div>
                            <div className="text-sm text-muted-foreground mt-1">
                              {(src.historicalHireRate * 100).toFixed(0)}% hire rate, {src.historicalTTF}d avg TTF
                            </div>
                          </div>
                        </div>
                      ))}
                      {forecast.sourceMix.insights.length > 0 && (
                        <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-sm mb-0 mt-3">
                          <i className="bi bi-lightbulb mr-2"></i>
                          {forecast.sourceMix.insights[0]}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Risk Factors */}
              {forecast.riskFactors.length > 0 && (
                <div className="rounded-lg border border-glass-border bg-bg-glass mb-4">
                  <div className="px-4 py-3 border-b border-white/10">
                    <h6 className="mb-0 text-foreground"><i className="bi bi-exclamation-triangle mr-2"></i> Risk Factors</h6>
                  </div>
                  <div className="p-0">
                    <div className="divide-y divide-white/5">
                      {forecast.riskFactors.map((risk, i) => (
                        <div key={i} className="p-3">
                          <div className="flex items-start">
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium mr-3 ${risk.severity === 'high' ? 'bg-bad-bg text-bad' : risk.severity === 'medium' ? 'bg-warn-bg text-warn' : 'bg-white/10 text-muted-foreground'}`}>
                              {risk.severity.toUpperCase()}
                            </span>
                            <div className="grow">
                              <div className="font-medium">{risk.factor}</div>
                              <div className="text-sm text-muted-foreground">{risk.dataPoint}</div>
                              <div className="text-sm mt-1">
                                <strong>Impact:</strong> {risk.impact}
                              </div>
                              <div className="text-sm text-green-500">
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
              <div className="flex justify-between">
                <button className="px-4 py-2 bg-bg-glass border border-glass-border rounded hover:bg-white/10" onClick={handleResetWizard}>
                  <i className="bi bi-arrow-counterclockwise mr-2"></i> Start Over
                </button>
              </div>
            </div>
          )}
        </div>
      )
      }

      {/* ===== ACTIVE ROLE HEALTH ===== */}
      {
        activeSubTab === 'health' && (
          <div>
            {/* Summary Cards */}
            <div className="grid grid-cols-12 gap-3 mb-4">
              <div className="col-span-6 md:col-span-3">
                <div
                  className={`rounded-lg border bg-bg-glass text-center cursor-pointer transition-colors ${healthFilter === 'all' ? 'border-accent shadow-lg' : 'border-glass-border hover:border-white/20'}`}
                  onClick={() => setHealthFilter('all')}
                >
                  <div className="p-4">
                    <StatLabel className="mb-2">Total Open</StatLabel>
                    <StatValue>{healthSummary.total}</StatValue>
                  </div>
                </div>
              </div>
              <div className="col-span-6 md:col-span-3">
                <div
                  className={`rounded-lg border bg-bg-glass text-center cursor-pointer transition-colors ${healthFilter === 'on-track' ? 'border-accent shadow-lg' : 'border-glass-border hover:border-white/20'}`}
                  onClick={() => setHealthFilter('on-track')}
                >
                  <div className="p-4">
                    <StatLabel className="mb-2 text-good">On Track</StatLabel>
                    <StatValue color="success">{healthSummary.onTrack}</StatValue>
                  </div>
                </div>
              </div>
              <div className="col-span-6 md:col-span-3">
                <div
                  className={`rounded-lg border bg-bg-glass text-center cursor-pointer transition-colors ${healthFilter === 'at-risk' ? 'border-accent shadow-lg' : 'border-glass-border hover:border-white/20'}`}
                  onClick={() => setHealthFilter('at-risk')}
                >
                  <div className="p-4">
                    <StatLabel className="mb-2 text-warn">At Risk</StatLabel>
                    <StatValue color="warning">{healthSummary.atRisk}</StatValue>
                  </div>
                </div>
              </div>
              <div className="col-span-6 md:col-span-3">
                <div
                  className={`rounded-lg border bg-bg-glass text-center cursor-pointer transition-colors ${healthFilter === 'off-track' ? 'border-accent shadow-lg' : 'border-glass-border hover:border-white/20'}`}
                  onClick={() => setHealthFilter('off-track')}
                >
                  <div className="p-4">
                    <StatLabel className="mb-2 text-bad">Off Track</StatLabel>
                    <StatValue color="danger">{healthSummary.offTrack}</StatValue>
                  </div>
                </div>
              </div>
            </div>

            {/* Pre-Mortem Risk Summary */}
            <div className="flex gap-2 mb-4 flex-wrap items-center">
              <span className="text-muted-foreground text-sm mr-2">Pre-Mortem Risk:</span>
              <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm ${getRiskBadgeClass('HIGH')}`}>
                <i className="bi bi-exclamation-triangle-fill"></i>
                {riskSummary.high} High
              </span>
              <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm ${getRiskBadgeClass('MED')}`}>
                <i className="bi bi-exclamation-circle"></i>
                {riskSummary.med} Medium
              </span>
              <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm ${getRiskBadgeClass('LOW')}`}>
                <i className="bi bi-check-circle"></i>
                {riskSummary.low} Low
              </span>
            </div>

            {/* Health Table */}
            <div className="rounded-lg border border-glass-border bg-bg-glass mb-4">
              <div className="px-4 py-3 border-b border-white/10 flex justify-between items-center">
                <h6 className="mb-0 text-foreground">Open Requisitions</h6>
                <span className="text-sm text-muted-foreground">Click any row for forecast details and risk analysis</span>
              </div>
              <div className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Role</th>
                        <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">Days Open</th>
                        <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">Pipeline</th>
                        <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">Status</th>
                        <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">Risk</th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Failure Mode</th>
                        <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">Predicted Fill</th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Primary Issue</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
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
                              className={`cursor-pointer hover:bg-white/5 ${selectedHealthReq === req.reqId ? 'bg-accent/10' : ''}`}
                              onClick={() => setSelectedHealthReq(selectedHealthReq === req.reqId ? null : req.reqId)}
                            >
                              <td className="px-4 py-3">
                                <div className="font-medium text-foreground">{req.reqTitle}</div>
                                <div className="text-sm text-muted-foreground">{req.function} {req.level}</div>
                              </td>
                              <td className="px-4 py-3 text-right">
                                {req.daysOpen !== null ? (
                                  <>
                                    <span className={req.daysOpen > req.benchmarkTTF ? 'text-bad font-bold' : 'text-foreground'}>
                                      {req.daysOpen}d
                                    </span>
                                    <div className="text-sm text-muted-foreground">/ {req.benchmarkTTF}d benchmark</div>
                                  </>
                                ) : (
                                  <span className="text-muted-foreground">N/A</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-right">
                                <span className={req.pipelineGap < 0 ? 'text-bad font-bold' : 'text-foreground'}>
                                  {req.currentPipelineDepth}
                                </span>
                                <span className="text-muted-foreground">/{req.benchmarkPipelineDepth}</span>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getHealthBadgeClass(req.healthStatus)}`}>
                                  {req.healthScore}
                                </span>
                              </td>
                              {/* Risk Score + Band */}
                              <td className="px-4 py-3 text-center">
                                {preMortem ? (
                                  <span
                                    className={`inline-flex items-center rounded-full font-mono px-2 py-1 text-xs ${getRiskBadgeClass(preMortem.risk_band)}`}
                                    title={`Risk Score: ${preMortem.risk_score}/100`}
                                  >
                                    {preMortem.risk_band} {preMortem.risk_score}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground text-sm">-</span>
                                )}
                              </td>
                              {/* Failure Mode */}
                              <td className="px-4 py-3">
                                {preMortem ? (
                                  <span className={`text-sm ${preMortem.risk_band === 'HIGH' ? 'text-bad' : preMortem.risk_band === 'MED' ? 'text-warn' : 'text-good'}`}>
                                    {getFailureModeLabel(preMortem.failure_mode)}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground text-sm">-</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-right">
                                {req.predictedFillDate ? (
                                  <span className="text-foreground">{format(req.predictedFillDate, 'MMM d')}</span>
                                ) : (
                                  <span className="text-bad">Unknown</span>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                <span className="text-sm text-muted-foreground">{req.primaryIssue || '-'}</span>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
                {/* Pagination */}
                {filteredHealthMetrics.length > HEALTH_PAGE_SIZE && (
                  <div className="px-4 py-3 border-t border-white/10 flex justify-between items-center">
                    <span className="text-muted-foreground text-sm">
                      Showing {healthPage * HEALTH_PAGE_SIZE + 1}-{Math.min((healthPage + 1) * HEALTH_PAGE_SIZE, filteredHealthMetrics.length)} of {filteredHealthMetrics.length}
                    </span>
                    <div className="inline-flex rounded-md shadow-sm">
                      <button
                        className="inline-flex items-center px-3 py-1.5 text-sm border border-glass-border rounded-l-md text-muted-foreground hover:bg-white/5 hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        disabled={healthPage === 0}
                        onClick={() => setHealthPage(p => p - 1)}
                      >
                        Previous
                      </button>
                      <button
                        className="inline-flex items-center px-3 py-1.5 text-sm border border-glass-border border-l-0 rounded-r-md text-muted-foreground hover:bg-white/5 hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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

          </div>
        )}

      {/* Unified Req Health Detail Drawer (includes Oracle + Pre-Mortem) */}
      <ReqHealthDrawer
        isOpen={!!selectedHealthReq && !!selectedHealthDetails}
        onClose={() => setSelectedHealthReq(null)}
        healthData={selectedHealthDetails}
        forecast={probForecast}
        preMortem={selectedHealthReq ? preMortemByReqId.get(selectedHealthReq) : null}
        simulationParams={simParams}
        pipelineCandidates={selectedReqPipelineCandidates}
        reqId={selectedHealthReq || undefined}
      />
    </div>
  );
}

export default ForecastingTab;


