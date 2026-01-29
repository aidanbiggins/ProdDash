/**
 * ForecastingTabV2
 *
 * Role Planning and Health Tracking with Pre-Mortem Risk Analysis.
 * V2 version using SubViewHeader, glass-panel, and Tailwind tokens.
 */

import React, { useState, useMemo, useCallback } from 'react';
import { format, addDays } from 'date-fns';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';
import {
  Heart,
  Calculator,
  ArrowRight,
  ArrowLeft,
  Zap,
  RotateCcw,
  Filter,
  PieChart,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react';
import {
  Requisition,
  Candidate,
  Event as EntityEvent,
  User,
  HiringManagerFriction,
  RoleProfile,
  RoleForecast,
  RoleHealthMetrics,
  HealthStatus,
} from '../../../types';
import { DashboardConfig } from '../../../types/config';
import {
  generateRoleForecast,
  calculateActiveRoleHealth,
  generateProbabilisticForecast,
  buildForecastingBenchmarks,
  prepareSimulationParameters,
} from '../../../services/forecastingService';
import { ForecastResult, SimulationParameters } from '../../../services/probabilisticEngine';
import { OracleConfidenceWidgetV2 } from './OracleConfidenceWidgetV2';
import { CalibrationCardV2 } from './CalibrationCardV2';
import { ReqHealthDrawerV2 } from './ReqHealthDrawerV2';
import { runCalibration, CalibrationReport } from '../../../services/calibrationService';
import { useIsMobile } from '../../../hooks/useIsMobile';
import {
  PreMortemResult,
  RiskBand,
  getRiskBandColor,
  getFailureModeLabel,
} from '../../../types/preMortemTypes';
import { HMPendingAction } from '../../../types/hmTypes';
import { runPreMortemBatch } from '../../../services/preMortemService';
import { PreMortemDrawer } from '../../common/PreMortemDrawer';
import { SubViewHeader } from '../SubViewHeader';
import { StatLabel, StatValue, LogoSpinner } from '../../common';
import { ActionItem } from '../../../types/actionTypes';
import { FORECASTING_PAGE_HELP } from './forecastingHelpContent';

interface ForecastingTabV2Props {
  requisitions: Requisition[];
  candidates: Candidate[];
  events: EntityEvent[];
  users: User[];
  hmFriction: HiringManagerFriction[];
  config: DashboardConfig;
  hmActions?: HMPendingAction[];
  onAddToActionQueue?: (actions: ActionItem[]) => void;
}

type SubTab = 'planner' | 'health';
type WizardStep = 'profile' | 'hm' | 'results';

export function ForecastingTabV2({
  requisitions,
  candidates,
  events,
  users,
  hmFriction,
  config,
  hmActions = [],
  onAddToActionQueue,
}: ForecastingTabV2Props) {
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
    hiringManagerId: undefined,
  });
  const [forecast, setForecast] = useState<RoleForecast | null>(null);
  const [probForecast, setProbForecast] = useState<ForecastResult | null>(null);
  const [simParams, setSimParams] = useState<SimulationParameters | null>(null);
  // Track which req the simParams/probForecast are for to prevent stale data display
  const [forecastReadyForReqId, setForecastReadyForReqId] = useState<string | null>(null);
  const [calibrationReport, setCalibrationReport] = useState<CalibrationReport | null>(null);
  const [isCalibrating, setIsCalibrating] = useState(false);

  // Health dashboard state
  const [selectedHealthReq, setSelectedHealthReq] = useState<string | null>(null);
  const [healthFilter, setHealthFilter] = useState<HealthStatus | 'all'>('all');
  const [healthPage, setHealthPage] = useState(0);
  const HEALTH_PAGE_SIZE = 25;

  // Pre-mortem drawer state
  const [preMortemDrawerOpen, setPreMortemDrawerOpen] = useState(false);
  const [selectedPreMortem, setSelectedPreMortem] = useState<PreMortemResult | null>(null);

  // Get unique values for dropdowns
  const functions = useMemo(
    () => Array.from(new Set(requisitions.map((r) => r.function))).filter(Boolean).sort(),
    [requisitions]
  );
  const levels = useMemo(
    () => Array.from(new Set(requisitions.map((r) => r.level))).filter(Boolean).sort(),
    [requisitions]
  );
  const locationTypes = useMemo(
    () => Array.from(new Set(requisitions.map((r) => r.location_type))).filter(Boolean).sort(),
    [requisitions]
  );
  const jobFamilies = useMemo(
    () => Array.from(new Set(requisitions.map((r) => r.job_family))).filter(Boolean).sort(),
    [requisitions]
  );
  const hiringManagers = useMemo(
    () =>
      users.filter(
        (u) => u.role === 'HiringManager' || hmFriction.some((h) => h.hmId === u.user_id)
      ),
    [users, hmFriction]
  );

  // Memoize benchmarks
  const benchmarks = useMemo(
    () =>
      buildForecastingBenchmarks(requisitions, candidates, events, users, hmFriction, config),
    [requisitions, candidates, events, users, hmFriction, config]
  );

  // Calculate role health for all open reqs
  const roleHealthMetrics = useMemo(
    () =>
      calculateActiveRoleHealth(requisitions, candidates, events, users, hmFriction, config),
    [requisitions, candidates, events, users, hmFriction, config]
  );

  // Compute pre-mortems for all open reqs
  const preMortemResults = useMemo(() => {
    const benchmarkTTFMap = new Map<string, number>();
    roleHealthMetrics.forEach((r) => {
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

  // Create a map for quick lookup
  const preMortemByReqId = useMemo(() => {
    const map = new Map<string, PreMortemResult>();
    preMortemResults.forEach((pm) => map.set(pm.req_id, pm));
    return map;
  }, [preMortemResults]);

  // Filter health metrics
  const filteredHealthMetrics = useMemo(() => {
    if (healthFilter === 'all') return roleHealthMetrics;
    return roleHealthMetrics.filter((r) => r.healthStatus === healthFilter);
  }, [roleHealthMetrics, healthFilter]);

  // Reset page when filter changes
  React.useEffect(() => {
    setHealthPage(0);
  }, [healthFilter]);

  // Health summary counts
  const healthSummary = useMemo(
    () => ({
      total: roleHealthMetrics.length,
      onTrack: roleHealthMetrics.filter((r) => r.healthStatus === 'on-track').length,
      atRisk: roleHealthMetrics.filter((r) => r.healthStatus === 'at-risk').length,
      offTrack: roleHealthMetrics.filter((r) => r.healthStatus === 'off-track').length,
    }),
    [roleHealthMetrics]
  );

  // Generate forecast
  const handleGenerateForecast = useCallback(() => {
    if (
      !roleProfile.function ||
      !roleProfile.level ||
      !roleProfile.locationType ||
      !roleProfile.jobFamily
    ) {
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

    generateProbabilisticForecast(roleProfile, benchmarks, config, [], new Date()).then((res) =>
      setProbForecast(res)
    );

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
      hiringManagerId: undefined,
    });
    setForecast(null);
    setWizardStep('profile');
  }, []);

  // Get HM metrics for preview
  const selectedHMMetrics = useMemo(() => {
    if (!roleProfile.hiringManagerId) return null;
    return hmFriction.find((h) => h.hmId === roleProfile.hiringManagerId);
  }, [roleProfile.hiringManagerId, hmFriction]);

  // Selected health req details
  const selectedHealthDetails = useMemo(() => {
    if (!selectedHealthReq) return null;
    return roleHealthMetrics.find((r) => r.reqId === selectedHealthReq);
  }, [selectedHealthReq, roleHealthMetrics]);

  // Pipeline candidates for selected req
  const selectedReqPipelineCandidates = useMemo(() => {
    if (!selectedHealthReq) return [];
    return candidates.filter(
      (c) =>
        c.req_id === selectedHealthReq &&
        ['Screen', 'HM Screen', 'Onsite', 'Offer'].includes(c.current_stage)
    );
  }, [selectedHealthReq, candidates]);

  // Run Oracle when selecting a health req
  // IMPORTANT: Clear forecastReadyForReqId immediately when req changes to prevent stale data display
  React.useEffect(() => {
    // Clear ready flag immediately - drawer won't open until we set it after computing params
    setForecastReadyForReqId(null);

    if (selectedHealthReq && selectedHealthDetails) {
      const activeCandidates = candidates.filter(
        (c) =>
          c.req_id === selectedHealthReq &&
          ['Screen', 'HM Screen', 'Onsite', 'Offer'].includes(c.current_stage)
      );

      const profile: RoleProfile = {
        function: selectedHealthDetails.function,
        level: selectedHealthDetails.level,
        locationType: 'Remote',
        jobFamily: selectedHealthDetails.jobFamily,
        hiringManagerId: selectedHealthDetails.hiringManagerId,
      };

      // Compute simulation params synchronously first
      const params = prepareSimulationParameters(profile, benchmarks, config);
      setSimParams(params);

      // Mark forecast as ready for this req (simParams is now set)
      // The OracleConfidenceWidgetV2 will compute baselineForecast from these params
      setForecastReadyForReqId(selectedHealthReq);

      // Also compute probForecast async for the drawer to use as initial value
      generateProbabilisticForecast(profile, benchmarks, config, activeCandidates, new Date()).then(
        (res) => setProbForecast(res)
      );
    } else {
      setProbForecast(null);
      setSimParams(null);
    }
  }, [selectedHealthReq, candidates, selectedHealthDetails, benchmarks, config]);

  const handleRunCalibration = useCallback(async () => {
    setIsCalibrating(true);
    const completedReqs = requisitions
      .filter((r) => r.status === 'Closed' && r.closed_at && r.opened_at)
      .map((r) => ({
        reqId: r.req_id,
        hiredDate: r.closed_at!,
        openedDate: r.opened_at!,
        roleProfile: {
          function: r.function,
          level: r.level,
          locationType: r.location_type,
          jobFamily: r.job_family,
        },
      }));

    const report = await runCalibration(completedReqs, [], config, {} as any);
    setCalibrationReport(report);
    setIsCalibrating(false);
  }, [requisitions, config]);

  // Handle adding interventions to action queue
  const handleAddToQueue = useCallback(
    (actions: ActionItem[]) => {
      if (onAddToActionQueue) {
        onAddToActionQueue(actions);
      }
      setPreMortemDrawerOpen(false);
      setSelectedPreMortem(null);
    },
    [onAddToActionQueue]
  );

  // Risk badge classes
  const getRiskBadgeClass = (band: RiskBand) => {
    switch (band) {
      case 'HIGH':
        return 'bg-bad/20 text-bad border border-bad';
      case 'MED':
        return 'bg-warn/20 text-warn border border-warn';
      case 'LOW':
        return 'bg-good/20 text-good border border-good';
      default:
        return 'bg-muted text-muted-foreground border border-border';
    }
  };

  // Health badge classes
  const getHealthBadgeClass = (status: HealthStatus) => {
    switch (status) {
      case 'on-track':
        return 'bg-good/20 text-good border border-good';
      case 'at-risk':
        return 'bg-warn/20 text-warn border border-warn';
      case 'off-track':
        return 'bg-bad/20 text-bad border border-bad';
    }
  };

  // Milestone chart data
  const milestoneChartData = useMemo(() => {
    if (!forecast) return [];

    const pipelineByStage = forecast.pipelineRequirements.byStage;
    const milestones = forecast.milestoneTimeline.milestones;

    const stageToVolumeMap: Record<string, number> = {};
    pipelineByStage.forEach((s) => {
      stageToVolumeMap[s.stage] = s.candidatesNeeded;
    });

    return milestones.map((m) => {
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
        volume = forecast.pipelineRequirements.totalCandidatesNeeded;
      }

      return {
        day: m.targetDay,
        dayMin: m.rangeMin,
        dayMax: m.rangeMax,
        milestone: m.milestone,
        volume,
        volumeMin: Math.max(1, Math.round(volume * 0.7)),
        volumeMax: Math.round(volume * 1.3),
      };
    });
  }, [forecast]);

  // Pipeline chart data
  const pipelineChartData = useMemo(() => {
    if (!forecast) return [];
    return forecast.pipelineRequirements.byStage.map((s) => ({
      stage: s.stage,
      needed: s.candidatesNeeded,
      rate: Math.round(s.conversionRateUsed * 100),
    }));
  }, [forecast]);

  return (
    <div className="space-y-6">
      <SubViewHeader
        title="Hiring Forecast"
        subtitle="Track role health, plan hiring capacity, and identify risks"
        helpContent={FORECASTING_PAGE_HELP}
      />

      {/* Sub-tab Navigation */}
      <div className="flex gap-2 flex-wrap">
        <button
          type="button"
          className={`px-3 md:px-4 py-3 rounded-md text-sm font-medium transition-colors min-h-[48px] flex items-center gap-2 ${
            activeSubTab === 'health'
              ? 'bg-primary text-primary-foreground'
              : 'glass-panel border border-border text-foreground hover:bg-muted'
          }`}
          onClick={() => setActiveSubTab('health')}
        >
          <Heart className="w-4 h-4 flex-shrink-0" />
          <span className="hidden sm:inline">Active Role</span> Health
          {healthSummary.offTrack > 0 && (
            <span className="inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-medium rounded-full bg-bad text-white">
              {healthSummary.offTrack}
            </span>
          )}
        </button>
        <button
          type="button"
          className={`px-3 md:px-4 py-3 rounded-md text-sm font-medium transition-colors min-h-[48px] flex items-center gap-2 ${
            activeSubTab === 'planner'
              ? 'bg-primary text-primary-foreground'
              : 'glass-panel border border-border text-foreground hover:bg-muted'
          }`}
          onClick={() => setActiveSubTab('planner')}
        >
          <Calculator className="w-4 h-4 flex-shrink-0" />
          <span className="hidden sm:inline">New Role</span> Planner
        </button>
      </div>

      {/* ===== NEW ROLE PLANNER ===== */}
      {activeSubTab === 'planner' && (
        <div className="space-y-4">
          {/* Wizard Progress */}
          <div className="flex justify-center">
            <div className="flex items-center gap-3">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center font-medium ${
                  wizardStep === 'profile'
                    ? 'bg-warn text-white'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                1
              </div>
              <div className="w-10 h-px bg-border" />
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center font-medium ${
                  wizardStep === 'hm'
                    ? 'bg-warn text-white'
                    : wizardStep === 'results'
                      ? 'bg-good text-white'
                      : 'bg-muted text-muted-foreground'
                }`}
              >
                2
              </div>
              <div className="w-10 h-px bg-border" />
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center font-medium ${
                  wizardStep === 'results' ? 'bg-good text-white' : 'bg-muted text-muted-foreground'
                }`}
              >
                3
              </div>
            </div>
          </div>

          {/* Step 1: Role Profile */}
          {wizardStep === 'profile' && (
            <div className="glass-panel">
              <div className="px-4 py-3 border-b border-border">
                <div className="text-sm font-semibold text-foreground">
                  Step 1: Define Role Profile
                </div>
                <div className="text-xs text-muted-foreground">
                  Select the characteristics of the role you're planning to hire
                </div>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">
                      Function *
                    </label>
                    <select
                      className="w-full px-3 py-2 text-sm bg-muted border border-border rounded-md text-foreground min-h-[44px]"
                      value={roleProfile.function}
                      onChange={(e) =>
                        setRoleProfile({ ...roleProfile, function: e.target.value })
                      }
                    >
                      <option value="">Select function...</option>
                      {functions.map((f) => (
                        <option key={f} value={f}>
                          {f}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">
                      Level *
                    </label>
                    <select
                      className="w-full px-3 py-2 text-sm bg-muted border border-border rounded-md text-foreground min-h-[44px]"
                      value={roleProfile.level}
                      onChange={(e) => setRoleProfile({ ...roleProfile, level: e.target.value })}
                    >
                      <option value="">Select level...</option>
                      {levels.map((l) => (
                        <option key={l} value={l}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">
                      Location Type *
                    </label>
                    <select
                      className="w-full px-3 py-2 text-sm bg-muted border border-border rounded-md text-foreground min-h-[44px]"
                      value={roleProfile.locationType}
                      onChange={(e) =>
                        setRoleProfile({ ...roleProfile, locationType: e.target.value })
                      }
                    >
                      <option value="">Select location type...</option>
                      {locationTypes.map((lt) => (
                        <option key={lt} value={lt}>
                          {lt}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">
                      Job Family *
                    </label>
                    <select
                      className="w-full px-3 py-2 text-sm bg-muted border border-border rounded-md text-foreground min-h-[44px]"
                      value={roleProfile.jobFamily}
                      onChange={(e) =>
                        setRoleProfile({ ...roleProfile, jobFamily: e.target.value })
                      }
                    >
                      <option value="">Select job family...</option>
                      {jobFamilies.map((jf) => (
                        <option key={jf} value={jf}>
                          {jf}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex justify-end mt-4">
                  <button
                    type="button"
                    className="px-4 py-3 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 min-h-[48px] flex items-center gap-2"
                    disabled={
                      !roleProfile.function ||
                      !roleProfile.level ||
                      !roleProfile.locationType ||
                      !roleProfile.jobFamily
                    }
                    onClick={() => setWizardStep('hm')}
                  >
                    Next: Select Hiring Manager
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Hiring Manager */}
          {wizardStep === 'hm' && (
            <div className="glass-panel">
              <div className="px-4 py-3 border-b border-border">
                <div className="text-sm font-semibold text-foreground">
                  Step 2: Select Hiring Manager (Optional)
                </div>
                <div className="text-xs text-muted-foreground">
                  HM selection affects time predictions based on their historical latency
                </div>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">
                      Hiring Manager
                    </label>
                    <select
                      className="w-full px-3 py-2 text-sm bg-muted border border-border rounded-md text-foreground min-h-[44px]"
                      value={roleProfile.hiringManagerId || ''}
                      onChange={(e) =>
                        setRoleProfile({
                          ...roleProfile,
                          hiringManagerId: e.target.value || undefined,
                        })
                      }
                    >
                      <option value="">No HM selected (use average)</option>
                      {hiringManagers.map((hm) => (
                        <option key={hm.user_id} value={hm.user_id}>
                          {hm.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    {selectedHMMetrics && (
                      <div className="glass-panel p-4">
                        <h6 className="mb-3 text-foreground font-semibold">HM Insights</h6>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Avg Feedback Latency:</span>
                            <strong
                              className={
                                selectedHMMetrics.feedbackLatencyMedian &&
                                selectedHMMetrics.feedbackLatencyMedian > 48
                                  ? 'text-warn'
                                  : 'text-foreground'
                              }
                            >
                              {selectedHMMetrics.feedbackLatencyMedian
                                ? `${Math.round(selectedHMMetrics.feedbackLatencyMedian)}hrs`
                                : '-'}
                            </strong>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Decision Latency:</span>
                            <strong
                              className={
                                selectedHMMetrics.decisionLatencyMedian &&
                                selectedHMMetrics.decisionLatencyMedian > 72
                                  ? 'text-warn'
                                  : 'text-foreground'
                              }
                            >
                              {selectedHMMetrics.decisionLatencyMedian
                                ? `${Math.round(selectedHMMetrics.decisionLatencyMedian / 24)}d`
                                : '-'}
                            </strong>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Offer Accept Rate:</span>
                            <strong className="text-foreground">
                              {selectedHMMetrics.offerAcceptanceRate !== null
                                ? `${Math.round(selectedHMMetrics.offerAcceptanceRate * 100)}%`
                                : '-'}
                            </strong>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">HM Weight:</span>
                            <span
                              className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${
                                selectedHMMetrics.hmWeight > 1.1
                                  ? 'bg-warn/20 text-warn'
                                  : selectedHMMetrics.hmWeight < 0.9
                                    ? 'bg-good/20 text-good'
                                    : 'bg-muted text-muted-foreground'
                              }`}
                            >
                              {selectedHMMetrics.hmWeight.toFixed(2)}x
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                    {!selectedHMMetrics && roleProfile.hiringManagerId && (
                      <div className="p-3 rounded bg-primary/10 border border-primary text-primary text-sm">
                        No historical data available for this HM
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex justify-between mt-4">
                  <button
                    type="button"
                    className="px-4 py-3 glass-panel border border-border rounded-md text-sm font-medium hover:bg-muted transition-colors min-h-[48px] flex items-center gap-2"
                    onClick={() => setWizardStep('profile')}
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Back
                  </button>
                  <button
                    type="button"
                    className="px-4 py-3 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors min-h-[48px] flex items-center gap-2"
                    onClick={handleGenerateForecast}
                  >
                    Generate Forecast
                    <Zap className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Results */}
          {wizardStep === 'results' && forecast && (
            <div className="space-y-4">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                <div className="md:col-span-5">
                  {probForecast ? (
                    <OracleConfidenceWidgetV2
                      forecast={probForecast}
                      startDate={new Date()}
                      simulationParams={simParams || undefined}
                    />
                  ) : (
                    <div className="glass-panel text-center h-full flex items-center justify-center p-8">
                      <LogoSpinner size={40} layout="stacked" />
                    </div>
                  )}
                </div>
                <div className="md:col-span-3">
                  <div className="glass-panel text-center h-full p-4">
                    <StatLabel className="mb-2">Candidates Needed</StatLabel>
                    <StatValue>{forecast.pipelineRequirements.totalCandidatesNeeded}</StatValue>
                    <div className="text-muted-foreground text-sm">top of funnel</div>
                  </div>
                </div>
                <div className="md:col-span-4">
                  <CalibrationCardV2
                    report={calibrationReport}
                    isLoading={isCalibrating}
                    onRunCalibration={handleRunCalibration}
                    className="h-full"
                  />
                </div>
              </div>

              {/* Milestone Timeline - Funnel over time */}
              <div className="glass-panel">
                <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                  <Filter className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-semibold text-foreground">
                    Pipeline Funnel Over Time
                  </span>
                </div>
                <div className="p-4">
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart
                      data={milestoneChartData}
                      margin={{ top: 10, right: 30, left: 10, bottom: 30 }}
                    >
                      <defs>
                        <linearGradient id="volumeGradient" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="hsl(var(--warn))" stopOpacity={0.6} />
                          <stop offset="100%" stopColor="hsl(var(--secondary))" stopOpacity={0.4} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis
                        dataKey="day"
                        fontSize={11}
                        className="fill-muted-foreground"
                        label={{
                          value: 'Days from Start',
                          position: 'bottom',
                          fontSize: 11,
                          dy: 10,
                        }}
                        tickFormatter={(val) => `Day ${val}`}
                      />
                      <YAxis
                        fontSize={11}
                        className="fill-muted-foreground"
                        label={{
                          value: 'Candidates',
                          angle: -90,
                          position: 'insideLeft',
                          fontSize: 11,
                          dx: -5,
                        }}
                      />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (!active || !payload?.[0]) return null;
                          const d = payload[0].payload;
                          return (
                            <div className="glass-panel p-3 text-sm">
                              <div className="font-semibold text-foreground">{d.milestone}</div>
                              <div className="text-muted-foreground">
                                Day {d.day} (range: {d.dayMin}-{d.dayMax})
                              </div>
                              <div className="text-warn font-medium">
                                {d.volume} candidates remaining
                              </div>
                            </div>
                          );
                        }}
                      />
                      <Area
                        type="stepAfter"
                        dataKey="volume"
                        className="stroke-warn"
                        strokeWidth={2}
                        fill="url(#volumeGradient)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                  <div className="flex justify-center gap-4 mt-2 text-sm text-muted-foreground flex-wrap">
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Pipeline Requirements */}
                <div className="glass-panel">
                  <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                    <Filter className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-semibold text-foreground">
                      Pipeline Requirements
                    </span>
                  </div>
                  <div className="p-4">
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={pipelineChartData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis type="number" fontSize={11} className="fill-muted-foreground" />
                        <YAxis
                          dataKey="stage"
                          type="category"
                          width={80}
                          fontSize={11}
                          className="fill-muted-foreground"
                        />
                        <Tooltip
                          content={({ active, payload }) => {
                            if (!active || !payload?.[0]) return null;
                            const d = payload[0].payload;
                            return (
                              <div className="glass-panel p-3 text-sm">
                                <div className="font-semibold text-foreground">{d.stage}</div>
                                <div className="text-muted-foreground">
                                  Need {d.needed} candidates
                                </div>
                                <div className="text-muted-foreground">
                                  {d.rate}% conversion rate
                                </div>
                              </div>
                            );
                          }}
                        />
                        <Bar dataKey="needed" className="fill-warn" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Source Mix */}
                <div className="glass-panel">
                  <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                    <PieChart className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-semibold text-foreground">
                      Recommended Source Mix
                    </span>
                  </div>
                  <div className="p-4">
                    {forecast.sourceMix.recommendations.slice(0, 4).map((src) => (
                      <div key={src.source} className="flex items-center mb-3">
                        <div className="flex-1">
                          <div className="flex justify-between mb-1">
                            <span className="font-medium text-foreground">{src.source}</span>
                            <span className="text-foreground">{src.targetPercentage}%</span>
                          </div>
                          <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full rounded-full bg-primary"
                              style={{ width: `${src.targetPercentage}%` }}
                            />
                          </div>
                          <div className="text-sm text-muted-foreground mt-1">
                            {(src.historicalHireRate * 100).toFixed(0)}% hire rate,{' '}
                            {src.historicalTTF}d avg TTF
                          </div>
                        </div>
                      </div>
                    ))}
                    {forecast.sourceMix.insights.length > 0 && (
                      <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 text-sm">
                        <div className="flex items-start gap-2">
                          <CheckCircle className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                          <span className="text-foreground">{forecast.sourceMix.insights[0]}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Risk Factors */}
              {forecast.riskFactors.length > 0 && (
                <div className="glass-panel">
                  <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-semibold text-foreground">Risk Factors</span>
                  </div>
                  <div className="divide-y divide-border">
                    {forecast.riskFactors.map((risk, i) => (
                      <div key={i} className="p-3">
                        <div className="flex items-start">
                          <span
                            className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium mr-3 ${
                              risk.severity === 'high'
                                ? 'bg-bad/20 text-bad'
                                : risk.severity === 'medium'
                                  ? 'bg-warn/20 text-warn'
                                  : 'bg-muted text-muted-foreground'
                            }`}
                          >
                            {risk.severity.toUpperCase()}
                          </span>
                          <div className="flex-1">
                            <div className="font-medium text-foreground">{risk.factor}</div>
                            <div className="text-sm text-muted-foreground">{risk.dataPoint}</div>
                            <div className="text-sm mt-1 text-foreground">
                              <strong>Impact:</strong> {risk.impact}
                            </div>
                            <div className="text-sm text-good">
                              <strong>Mitigation:</strong> {risk.mitigation}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-between">
                <button
                  type="button"
                  className="px-4 py-3 glass-panel border border-border rounded-md text-sm font-medium hover:bg-muted transition-colors min-h-[48px] flex items-center gap-2"
                  onClick={handleResetWizard}
                >
                  <RotateCcw className="w-4 h-4" />
                  Start Over
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===== ACTIVE ROLE HEALTH ===== */}
      {activeSubTab === 'health' && (
        <div className="space-y-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div
              className={`glass-panel text-center cursor-pointer transition-colors p-4 ${
                healthFilter === 'all' ? 'ring-2 ring-primary' : 'hover:bg-muted/50'
              }`}
              onClick={() => setHealthFilter('all')}
            >
              <StatLabel className="mb-2">Total Open</StatLabel>
              <StatValue>{healthSummary.total}</StatValue>
            </div>
            <div
              className={`glass-panel text-center cursor-pointer transition-colors p-4 ${
                healthFilter === 'on-track' ? 'ring-2 ring-primary' : 'hover:bg-muted/50'
              }`}
              onClick={() => setHealthFilter('on-track')}
            >
              <StatLabel className="mb-2 text-good">On Track</StatLabel>
              <StatValue color="success">{healthSummary.onTrack}</StatValue>
            </div>
            <div
              className={`glass-panel text-center cursor-pointer transition-colors p-4 ${
                healthFilter === 'at-risk' ? 'ring-2 ring-primary' : 'hover:bg-muted/50'
              }`}
              onClick={() => setHealthFilter('at-risk')}
            >
              <StatLabel className="mb-2 text-warn">At Risk</StatLabel>
              <StatValue color="warning">{healthSummary.atRisk}</StatValue>
            </div>
            <div
              className={`glass-panel text-center cursor-pointer transition-colors p-4 ${
                healthFilter === 'off-track' ? 'ring-2 ring-primary' : 'hover:bg-muted/50'
              }`}
              onClick={() => setHealthFilter('off-track')}
            >
              <StatLabel className="mb-2 text-bad">Off Track</StatLabel>
              <StatValue color="danger">{healthSummary.offTrack}</StatValue>
            </div>
          </div>


          {/* Health List - Cards on mobile, Table on desktop */}
          <div className="glass-panel">
            <div className="px-4 py-3 border-b border-border flex justify-between items-center flex-wrap gap-2">
              <span className="text-sm font-semibold text-foreground">Open Requisitions</span>
              <span className="text-xs text-muted-foreground">
                Tap for details
              </span>
            </div>

            {/* Mobile Card Layout */}
            <div className="md:hidden divide-y divide-border">
              {filteredHealthMetrics
                .sort((a, b) => {
                  const pmA = preMortemByReqId.get(a.reqId);
                  const pmB = preMortemByReqId.get(b.reqId);
                  const riskA = pmA?.risk_score ?? 0;
                  const riskB = pmB?.risk_score ?? 0;
                  if (riskB !== riskA) return riskB - riskA;
                  return a.healthScore - b.healthScore;
                })
                .slice(healthPage * HEALTH_PAGE_SIZE, (healthPage + 1) * HEALTH_PAGE_SIZE)
                .map((req) => {
                  const preMortemItem = preMortemByReqId.get(req.reqId);
                  return (
                    <div
                      key={req.reqId}
                      className={`p-3 cursor-pointer active:bg-muted/50 ${
                        selectedHealthReq === req.reqId ? 'bg-primary/10' : ''
                      }`}
                      onClick={() =>
                        setSelectedHealthReq(selectedHealthReq === req.reqId ? null : req.reqId)
                      }
                    >
                      {/* Row 1: Title + Badges */}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-foreground text-sm leading-tight">{req.reqTitle}</div>
                          <div className="text-xs text-muted-foreground">{req.function} · {req.level}</div>
                        </div>
                        <div className="flex gap-1 flex-shrink-0">
                          <span
                            className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${getHealthBadgeClass(req.healthStatus)}`}
                          >
                            {req.healthScore}
                          </span>
                          {preMortemItem && (
                            <span
                              className={`inline-flex items-center rounded text-xs font-medium px-1.5 py-0.5 ${getRiskBadgeClass(preMortemItem.risk_band)}`}
                            >
                              {preMortemItem.risk_band}
                            </span>
                          )}
                        </div>
                      </div>
                      {/* Row 2: Metrics */}
                      <div className="flex items-center gap-4 text-xs">
                        <div>
                          <span className="text-muted-foreground">Days: </span>
                          <span className={req.daysOpen !== null && req.daysOpen > req.benchmarkTTF ? 'text-bad font-semibold' : 'text-foreground'}>
                            {req.daysOpen ?? 'N/A'}
                          </span>
                          <span className="text-muted-foreground">/{req.benchmarkTTF}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Pipeline: </span>
                          <span className={req.pipelineGap < 0 ? 'text-bad font-semibold' : 'text-foreground'}>
                            {req.currentPipelineDepth}
                          </span>
                          <span className="text-muted-foreground">/{req.benchmarkPipelineDepth}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Fill: </span>
                          <span className="text-foreground">
                            {req.predictedFillDate ? format(req.predictedFillDate, 'MMM d') : '?'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>

            {/* Desktop Table Layout */}
            <div className="hidden md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Role
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Days Open
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Pipeline
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Status
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Risk
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Failure Mode
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Predicted Fill
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground hidden lg:table-cell">
                      Primary Issue
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredHealthMetrics
                    .sort((a, b) => {
                      const pmA = preMortemByReqId.get(a.reqId);
                      const pmB = preMortemByReqId.get(b.reqId);
                      const riskA = pmA?.risk_score ?? 0;
                      const riskB = pmB?.risk_score ?? 0;
                      if (riskB !== riskA) return riskB - riskA;
                      return a.healthScore - b.healthScore;
                    })
                    .slice(healthPage * HEALTH_PAGE_SIZE, (healthPage + 1) * HEALTH_PAGE_SIZE)
                    .map((req) => {
                      const preMortemItem = preMortemByReqId.get(req.reqId);
                      return (
                        <tr
                          key={req.reqId}
                          className={`cursor-pointer hover:bg-muted/50 ${
                            selectedHealthReq === req.reqId ? 'bg-primary/10' : ''
                          }`}
                          onClick={() =>
                            setSelectedHealthReq(selectedHealthReq === req.reqId ? null : req.reqId)
                          }
                        >
                          <td className="px-4 py-3">
                            <div className="font-medium text-foreground">{req.reqTitle}</div>
                            <div className="text-xs text-muted-foreground">
                              {req.function} · {req.level}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            {req.daysOpen !== null ? (
                              <>
                                <span
                                  className={
                                    req.daysOpen > req.benchmarkTTF
                                      ? 'text-bad font-bold'
                                      : 'text-foreground'
                                  }
                                >
                                  {req.daysOpen}d
                                </span>
                                <div className="text-xs text-muted-foreground">
                                  / {req.benchmarkTTF}d benchmark
                                </div>
                              </>
                            ) : (
                              <span className="text-muted-foreground">N/A</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            <span
                              className={
                                req.pipelineGap < 0 ? 'text-bad font-bold' : 'text-foreground'
                              }
                            >
                              {req.currentPipelineDepth}
                            </span>
                            <span className="text-muted-foreground">
                              /{req.benchmarkPipelineDepth}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getHealthBadgeClass(req.healthStatus)}`}
                            >
                              {req.healthScore}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            {preMortemItem ? (
                              <span
                                className={`inline-flex items-center rounded-full font-mono px-2 py-1 text-xs ${getRiskBadgeClass(preMortemItem.risk_band)}`}
                                title={`Risk Score: ${preMortemItem.risk_score}/100`}
                              >
                                {preMortemItem.risk_band} {preMortemItem.risk_score}
                              </span>
                            ) : (
                              <span className="text-muted-foreground text-sm">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {preMortemItem ? (
                              <span
                                className={`text-sm ${
                                  preMortemItem.risk_band === 'HIGH'
                                    ? 'text-bad'
                                    : preMortemItem.risk_band === 'MED'
                                      ? 'text-warn'
                                      : 'text-good'
                                }`}
                              >
                                {getFailureModeLabel(preMortemItem.failure_mode)}
                              </span>
                            ) : (
                              <span className="text-muted-foreground text-sm">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            {req.predictedFillDate ? (
                              <span className="text-foreground">
                                {format(req.predictedFillDate, 'MMM d')}
                              </span>
                            ) : (
                              <span className="text-bad">Unknown</span>
                            )}
                          </td>
                          <td className="px-4 py-3 hidden lg:table-cell">
                            <span className="text-sm text-muted-foreground">
                              {req.primaryIssue || '-'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {filteredHealthMetrics.length > HEALTH_PAGE_SIZE && (
              <div className="px-4 py-3 border-t border-border flex justify-between items-center flex-wrap gap-2">
                <span className="text-muted-foreground text-sm">
                  {healthPage * HEALTH_PAGE_SIZE + 1}-
                  {Math.min((healthPage + 1) * HEALTH_PAGE_SIZE, filteredHealthMetrics.length)} of{' '}
                  {filteredHealthMetrics.length}
                </span>
                <div className="inline-flex rounded-md">
                  <button
                    type="button"
                    className="inline-flex items-center px-3 py-2 text-sm border border-border rounded-l-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-h-[44px]"
                    disabled={healthPage === 0}
                    onClick={() => setHealthPage((p) => p - 1)}
                  >
                    Prev
                  </button>
                  <button
                    type="button"
                    className="inline-flex items-center px-3 py-2 text-sm border border-border border-l-0 rounded-r-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-h-[44px]"
                    disabled={(healthPage + 1) * HEALTH_PAGE_SIZE >= filteredHealthMetrics.length}
                    onClick={() => setHealthPage((p) => p + 1)}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Unified Req Health Detail Drawer */}
      {/* Only open when simParams have been computed for the selected req (forecastReadyForReqId matches) */}
      <ReqHealthDrawerV2
        isOpen={!!selectedHealthReq && !!selectedHealthDetails && forecastReadyForReqId === selectedHealthReq}
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

export default ForecastingTabV2;
