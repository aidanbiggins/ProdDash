/**
 * OracleConfidenceWidgetV2
 *
 * Flip-card widget showing probabilistic hiring forecast with what-if analysis.
 * V2 version using Tailwind tokens and lucide-react icons.
 */

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { format, differenceInDays, isValid, subWeeks } from 'date-fns';
import {
  Info,
  ChevronUp,
  ChevronDown,
  SlidersHorizontal,
  ArrowRight,
  ArrowDown,
  ArrowUp,
  Gauge,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import {
  ForecastResult,
  SimulationParameters,
  runSimulation,
  runPipelineSimulation,
  runCapacityAwareForecast,
  shrinkRate,
  PipelineCandidate,
} from '../../../services/probabilisticEngine';
import { CanonicalStage, Candidate, Event, Requisition, User } from '../../../types';
import { OracleBacksideV2 } from './OracleBacksideV2';
import {
  OracleKnobSettings,
  OracleExplainData,
  PipelineCountInfo,
  StageRateInfo,
  StageDurationInfo,
  ConfidenceReason,
  CapacityExplainData,
  DEFAULT_KNOB_SETTINGS,
  PRIOR_WEIGHT_VALUES,
  MIN_N_VALUES,
  STAGE_LABELS,
  generateCacheKey,
  hashPipelineCounts,
} from './oracleTypes';
import { inferCapacity } from '../../../services/capacityInferenceService';
import {
  applyCapacityPenalty,
  computeGlobalDemand,
  applyCapacityPenaltyV11,
} from '../../../services/capacityPenaltyModel';
import {
  OracleCapacityProfile,
  OracleCapacityAwareForecastResult,
  OraclePipelineByStage,
  OracleGlobalDemand,
} from '../../../types/capacityTypes';

/**
 * Convert title-case or any-case stage name to CanonicalStage
 */
function toCanonicalStage(stage: string | null | undefined): CanonicalStage | null {
  if (!stage) return null;

  if (Object.values(CanonicalStage).includes(stage as CanonicalStage)) {
    return stage as CanonicalStage;
  }

  const normalized = stage.toUpperCase().replace(/\s+/g, '_');
  if (Object.values(CanonicalStage).includes(normalized as CanonicalStage)) {
    return normalized as CanonicalStage;
  }

  return null;
}

interface OracleConfidenceWidgetV2Props {
  forecast: ForecastResult;
  startDate: Date;
  className?: string;
  targetDate?: Date;
  onTargetDateChange?: (date: Date) => void;
  simulationParams?: SimulationParameters;
  currentStage?: CanonicalStage;
  pipelineCandidates?: Candidate[];
  reqId?: string;
  observedRates?: Record<string, number>;
  priorRates?: Record<string, number>;
  events?: Event[];
  requisitions?: Requisition[];
  users?: User[];
  recruiterId?: string;
  hmId?: string;
  allCandidates?: Candidate[];
}

const CONTROLLABLE_STAGES = [
  CanonicalStage.SCREEN,
  CanonicalStage.HM_SCREEN,
  CanonicalStage.ONSITE,
  CanonicalStage.OFFER,
];

const confidenceStyles: Record<string, string> = {
  HIGH: 'bg-good/20 text-good',
  MEDIUM: 'bg-warn/20 text-warn',
  LOW: 'bg-bad/20 text-bad',
};

// Simple in-memory cache for simulation results
const simulationCache = new Map<string, ForecastResult>();

export function OracleConfidenceWidgetV2({
  forecast,
  startDate,
  className,
  targetDate: initialTargetDate,
  onTargetDateChange,
  simulationParams,
  currentStage = CanonicalStage.SCREEN,
  pipelineCandidates = [],
  reqId = 'unknown',
  observedRates = {},
  priorRates = {},
  events = [],
  requisitions = [],
  users = [],
  recruiterId,
  hmId,
  allCandidates = [],
}: OracleConfidenceWidgetV2Props) {
  const [userTargetDate, setUserTargetDate] = useState<Date | null>(initialTargetDate || null);
  const [showLevers, setShowLevers] = useState(false);
  const [isFlipped, setIsFlipped] = useState(false);
  const [knobSettings, setKnobSettings] = useState<OracleKnobSettings>(DEFAULT_KNOB_SETTINGS);
  const frontRef = useRef<HTMLDivElement>(null);
  const [frontHeight, setFrontHeight] = useState<number | undefined>(undefined);
  const [showCapacityView, setShowCapacityView] = useState(false);

  // State for user-adjusted levers (deltas from baseline)
  const [conversionAdjustments, setConversionAdjustments] = useState<Record<string, number>>({});
  const [durationAdjustments, setDurationAdjustments] = useState<Record<string, number>>({});

  // Generate STABLE seed for Monte Carlo consistency
  // CRITICAL: This seed must NOT include lever values!
  // Both baseline and adjusted forecasts use the same random sequence,
  // so the difference reflects only parameter changes, not Monte Carlo noise.
  const stableSeed = useMemo(() => {
    const pipelineHash = hashPipelineCounts(
      pipelineCandidates.map((c) => ({
        stage: c.current_stage as CanonicalStage,
        stageName: c.current_stage || '',
        count: 1,
      }))
    );
    return `oracle-${reqId}-${pipelineHash}-${knobSettings.iterations}`;
  }, [reqId, pipelineCandidates, knobSettings.iterations]);

  // Compute baseline forecast from pipelineCandidates if available
  // This ensures we use fresh data even if the forecast prop is stale
  const baselineForecast = useMemo((): ForecastResult | null => {
    // Need simulation params to run any forecast
    if (!simulationParams) return null;

    const pipelineCandidatesForSim: PipelineCandidate[] = pipelineCandidates
      .map((c) => ({
        candidateId: c.candidate_id,
        currentStage: toCanonicalStage(c.current_stage),
      }))
      .filter((c): c is PipelineCandidate => c.currentStage !== null);

    // If we have candidates, run pipeline simulation
    if (pipelineCandidatesForSim.length > 0) {
      return runPipelineSimulation(
        pipelineCandidatesForSim,
        simulationParams,
        startDate,
        stableSeed,
        knobSettings.iterations
      );
    }

    // Fallback: single candidate at currentStage (same as adjustedForecast)
    return runSimulation(
      {
        currentStage,
        startDate,
        seed: stableSeed,
        iterations: knobSettings.iterations,
      },
      simulationParams
    );
  }, [simulationParams, pipelineCandidates, startDate, stableSeed, knobSettings.iterations, currentStage]);

  // Track front height for backside sizing
  useEffect(() => {
    if (frontRef.current && !isFlipped) {
      setFrontHeight(frontRef.current.offsetHeight);
    }
  }, [isFlipped, showLevers]);

  // Check if knobs have been changed from defaults
  const hasKnobChanges = useMemo(() => {
    return (
      knobSettings.priorWeight !== DEFAULT_KNOB_SETTINGS.priorWeight ||
      knobSettings.minNThreshold !== DEFAULT_KNOB_SETTINGS.minNThreshold ||
      knobSettings.iterations !== DEFAULT_KNOB_SETTINGS.iterations
    );
  }, [knobSettings]);

  // Calculate pipeline counts by stage
  const pipelineCounts = useMemo((): PipelineCountInfo[] => {
    const counts: Record<string, number> = {};
    for (const cand of pipelineCandidates) {
      const stage = cand.current_stage;
      counts[stage] = (counts[stage] || 0) + 1;
    }
    return CONTROLLABLE_STAGES.map((stage) => ({
      stage,
      stageName: STAGE_LABELS[stage] || stage,
      count: counts[stage] || 0,
    }));
  }, [pipelineCandidates]);

  // Pipeline by stage for capacity model
  const pipelineByStage = useMemo((): OraclePipelineByStage => {
    const counts: OraclePipelineByStage = {};
    for (const cand of pipelineCandidates) {
      const stage = cand.current_stage;
      counts[stage] = (counts[stage] || 0) + 1;
    }
    return counts;
  }, [pipelineCandidates]);

  // Compute global demand across recruiter/HM's full workload
  const globalDemand = useMemo((): OracleGlobalDemand | null => {
    const candidatesForDemand = allCandidates.length > 0 ? allCandidates : pipelineCandidates;

    return computeGlobalDemand({
      selectedReqId: reqId,
      recruiterId: recruiterId || null,
      hmId: hmId || null,
      allCandidates: candidatesForDemand,
      allRequisitions: requisitions,
      users,
    });
  }, [reqId, recruiterId, hmId, allCandidates, pipelineCandidates, requisitions, users]);

  // Check if capacity-aware mode is available
  const capacityModeAvailable = events.length > 0 && simulationParams && (recruiterId || hmId);

  // Infer capacity profile (memoized)
  const capacityProfile = useMemo((): OracleCapacityProfile | null => {
    if (!capacityModeAvailable) return null;

    const dateRange = {
      start: subWeeks(startDate, 12),
      end: startDate,
    };

    return inferCapacity({
      reqId,
      recruiterId: recruiterId || '',
      hmId: hmId || '',
      dateRange,
      events,
      candidates: pipelineCandidates,
      requisitions,
      users,
    });
  }, [
    capacityModeAvailable,
    reqId,
    recruiterId,
    hmId,
    startDate,
    events,
    pipelineCandidates,
    requisitions,
    users,
  ]);

  // Compute penalty result with global demand
  const capacityPenaltyV11 = useMemo(() => {
    if (!capacityProfile || !simulationParams || !globalDemand) return null;

    return applyCapacityPenaltyV11(simulationParams.stageDurations, globalDemand, capacityProfile);
  }, [capacityProfile, simulationParams, globalDemand]);

  // Run capacity-aware forecast
  const capacityAwareForecast = useMemo((): OracleCapacityAwareForecastResult | null => {
    if (!capacityProfile || !simulationParams || pipelineCandidates.length === 0 || !globalDemand)
      return null;

    const pipelineCandidatesForSim: PipelineCandidate[] = pipelineCandidates
      .map((c) => ({
        candidateId: c.candidate_id,
        currentStage: toCanonicalStage(c.current_stage),
      }))
      .filter((c): c is PipelineCandidate => c.currentStage !== null);

    const globalDemandPipeline: OraclePipelineByStage = {};
    for (const stage of CONTROLLABLE_STAGES) {
      const recruiterDemand = globalDemand.recruiter_demand[stage] || 0;
      const hmDemand = globalDemand.hm_demand[stage] || 0;
      globalDemandPipeline[stage] = Math.max(recruiterDemand, hmDemand);
    }

    return runCapacityAwareForecast(
      pipelineCandidatesForSim,
      globalDemandPipeline,
      simulationParams,
      capacityProfile,
      startDate,
      forecast.debug.seed,
      knobSettings.iterations
    );
  }, [
    capacityProfile,
    simulationParams,
    pipelineCandidates,
    globalDemand,
    startDate,
    forecast.debug.seed,
    knobSettings.iterations,
  ]);

  // Generate cache key (includes lever values for memoization, but NOT for the seed)
  const cacheKey = useMemo(() => {
    const leverHash = JSON.stringify({
      conv: conversionAdjustments,
      dur: durationAdjustments,
    });
    return generateCacheKey({
      reqId,
      pipelineHash: hashPipelineCounts(pipelineCounts) + '-' + leverHash,
      seed: forecast.debug.seed,
      knobSettings,
    });
  }, [reqId, pipelineCounts, forecast.debug.seed, knobSettings, conversionAdjustments, durationAdjustments]);

  // Calculate adjusted simulation result when levers or knobs change
  const adjustedForecast = useMemo(() => {
    if (!simulationParams) return null;

    const hasLeverAdjustments =
      Object.values(conversionAdjustments).some((v) => v !== 0) ||
      Object.values(durationAdjustments).some((v) => v !== 0);

    if (!hasLeverAdjustments && !hasKnobChanges) return null;

    const cached = simulationCache.get(cacheKey);
    if (cached) return cached;

    const adjustedParams: SimulationParameters = {
      ...simulationParams,
      stageConversionRates: { ...simulationParams.stageConversionRates },
      stageDurations: { ...simulationParams.stageDurations },
      sampleSizes: { ...simulationParams.sampleSizes },
    };

    const priorWeight = PRIOR_WEIGHT_VALUES[knobSettings.priorWeight];
    const minN = MIN_N_VALUES[knobSettings.minNThreshold];
    const priorWeightChanged = knobSettings.priorWeight !== DEFAULT_KNOB_SETTINGS.priorWeight;

    // Apply rate adjustments
    for (const stage of CONTROLLABLE_STAGES) {
      let baseRate: number;
      if (priorWeightChanged) {
        const obs = observedRates[stage] ?? simulationParams.stageConversionRates[stage] ?? 0.5;
        const prior = priorRates[stage] ?? 0.5;
        const n = simulationParams.sampleSizes[`${stage}_rate`] || 0;
        baseRate = shrinkRate(obs, prior, n, priorWeight);
      } else {
        baseRate = simulationParams.stageConversionRates[stage] ?? 0.5;
      }

      const delta = conversionAdjustments[stage] || 0;
      const adjusted = Math.max(0.05, Math.min(0.99, baseRate + delta / 100));
      adjustedParams.stageConversionRates[stage] = adjusted;
    }

    // Apply duration adjustments
    for (const stage of CONTROLLABLE_STAGES) {
      const baseDist = simulationParams.stageDurations[stage];
      const n =
        simulationParams.sampleSizes[`${stage}_duration`] ||
        simulationParams.sampleSizes[`${stage}_rate`] ||
        0;
      const pctChange = durationAdjustments[stage] || 0;

      if (baseDist) {
        const multiplier = 1 + pctChange / 100;

        if (n < minN && baseDist.type === 'lognormal') {
          adjustedParams.stageDurations[stage] = {
            type: 'constant',
            days: Math.max(1, Math.round(7 * multiplier)),
          };
        } else if (baseDist.type === 'lognormal' && baseDist.mu !== undefined) {
          adjustedParams.stageDurations[stage] = {
            ...baseDist,
            mu: baseDist.mu + Math.log(multiplier),
          };
        } else if (baseDist.type === 'constant' && baseDist.days !== undefined) {
          adjustedParams.stageDurations[stage] = {
            ...baseDist,
            days: Math.max(1, Math.round(baseDist.days * multiplier)),
          };
        }
      }
    }

    const pipelineCandidatesForSim: PipelineCandidate[] = pipelineCandidates
      .map((c) => ({
        candidateId: c.candidate_id,
        currentStage: toCanonicalStage(c.current_stage),
      }))
      .filter((c): c is PipelineCandidate => c.currentStage !== null);

    // CRITICAL: Use stableSeed (not cacheKey) so baseline and adjusted
    // use the SAME random sequence. The delta reflects only parameter changes.
    const result =
      pipelineCandidatesForSim.length > 0
        ? runPipelineSimulation(
            pipelineCandidatesForSim,
            adjustedParams,
            startDate,
            stableSeed,
            knobSettings.iterations
          )
        : runSimulation(
            {
              currentStage,
              startDate,
              seed: stableSeed,
              iterations: knobSettings.iterations,
            },
            adjustedParams
          );

    simulationCache.set(cacheKey, result);

    if (simulationCache.size > 50) {
      const firstKey = simulationCache.keys().next().value;
      if (firstKey) simulationCache.delete(firstKey);
    }

    return result;
  }, [
    simulationParams,
    conversionAdjustments,
    durationAdjustments,
    currentStage,
    startDate,
    hasKnobChanges,
    knobSettings,
    cacheKey,
    stableSeed,
    observedRates,
    priorRates,
    pipelineCandidates,
  ]);

  // Reset levers to baseline
  const resetLevers = useCallback(() => {
    setConversionAdjustments({});
    setDurationAdjustments({});
  }, []);

  // Build explainability data for backside
  const explainData = useMemo((): OracleExplainData => {
    const stageRates: StageRateInfo[] = CONTROLLABLE_STAGES.map((stage) => {
      const obs = observedRates[stage] ?? simulationParams?.stageConversionRates[stage] ?? 0.5;
      const prior = priorRates[stage] ?? 0.5;
      const n = simulationParams?.sampleSizes[`${stage}_rate`] || 0;
      const m = PRIOR_WEIGHT_VALUES[knobSettings.priorWeight];
      const shrunk = shrinkRate(obs, prior, n, m);

      return {
        stage,
        stageName: STAGE_LABELS[stage] || stage,
        observed: obs,
        prior,
        m,
        shrunk,
        n,
      };
    });

    const stageDurations: StageDurationInfo[] = CONTROLLABLE_STAGES.map((stage) => {
      const dist = simulationParams?.stageDurations[stage];
      const n =
        simulationParams?.sampleSizes[`${stage}_duration`] ||
        simulationParams?.sampleSizes[`${stage}_rate`] ||
        0;
      const minN = MIN_N_VALUES[knobSettings.minNThreshold];

      let model: 'empirical' | 'lognormal' | 'constant' | 'global' = 'constant';
      let medianDays = 7;

      if (dist) {
        if (dist.type === 'lognormal' && dist.mu !== undefined) {
          model = n >= minN ? 'lognormal' : 'global';
          medianDays = Math.round(Math.exp(dist.mu));
        } else if (dist.type === 'empirical') {
          model = 'empirical';
          medianDays = 7;
        } else if (dist.type === 'constant') {
          model = 'constant';
          medianDays = dist.days || 7;
        }
      }

      return {
        stage,
        stageName: STAGE_LABELS[stage] || stage,
        model,
        medianDays,
        n,
        distribution: dist,
      };
    });

    // Build confidence reasons
    const confidenceReasons: ConfidenceReason[] = [];
    const minSampleSize = Math.min(...stageRates.map((sr) => sr.n));

    if (minSampleSize >= 15) {
      confidenceReasons.push({
        type: 'sample_size',
        message: `Good sample sizes (min ${minSampleSize} per stage)`,
        impact: 'positive',
      });
    } else if (minSampleSize >= 5) {
      confidenceReasons.push({
        type: 'sample_size',
        message: `Moderate sample sizes (min ${minSampleSize})`,
        impact: 'neutral',
      });
    } else {
      confidenceReasons.push({
        type: 'sample_size',
        message: `Limited data (min ${minSampleSize} samples)`,
        impact: 'negative',
      });
    }

    const shrinkageReliance = stageRates.filter((sr) => sr.n < 10).length;
    if (shrinkageReliance > 0) {
      confidenceReasons.push({
        type: 'shrinkage',
        message: `${shrinkageReliance} stage(s) rely on prior assumptions`,
        impact: shrinkageReliance > 2 ? 'negative' : 'neutral',
      });
    }

    const lognormalCount = stageDurations.filter((sd) => sd.model === 'lognormal').length;
    if (lognormalCount >= 3) {
      confidenceReasons.push({
        type: 'duration_model',
        message: 'Using fitted duration distributions',
        impact: 'positive',
      });
    } else {
      confidenceReasons.push({
        type: 'duration_model',
        message: `${4 - lognormalCount} stage(s) use fallback durations`,
        impact: 'neutral',
      });
    }

    const explainDisplayForecast = adjustedForecast || baselineForecast || forecast;

    // Build capacity explain data if available
    let capacityData: CapacityExplainData | undefined;
    if (capacityProfile && simulationParams && globalDemand) {
      const legacyPenaltyResult = applyCapacityPenalty(
        simulationParams.stageDurations,
        pipelineByStage,
        capacityProfile
      );

      const inferenceWindow = {
        start: subWeeks(startDate, 12),
        end: startDate,
      };

      capacityData = {
        isAvailable: true,
        profile: capacityProfile,
        penaltyResult: legacyPenaltyResult,
        totalQueueDelayDays:
          capacityPenaltyV11?.total_queue_delay_days || legacyPenaltyResult.total_queue_delay_days,
        inferenceWindow,
        globalDemand,
        penaltyResultV11: capacityPenaltyV11,
        recommendations: capacityPenaltyV11?.recommendations || [],
      };
    } else if (!capacityModeAvailable) {
      capacityData = {
        isAvailable: false,
        profile: null,
        penaltyResult: null,
        totalQueueDelayDays: 0,
        inferenceWindow: null,
        globalDemand: null,
        recommendations: [],
      };
    }

    // IMPORTANT: Never display iterations as 0 - use knob setting or default 1000
    const displayIterations = explainDisplayForecast.debug.iterations > 0
      ? explainDisplayForecast.debug.iterations
      : knobSettings.iterations || 1000;

    return {
      pipelineCounts,
      stageRates,
      stageDurations,
      iterations: displayIterations,
      seed: explainDisplayForecast.debug.seed || 'default',
      confidenceLevel: explainDisplayForecast.confidenceLevel,
      confidenceReasons,
      calibration: {
        lastRunAt: null,
        score: null,
        bias: null,
        isAvailable: false,
      },
      capacity: capacityData,
    };
  }, [
    simulationParams,
    pipelineCounts,
    pipelineByStage,
    knobSettings,
    observedRates,
    priorRates,
    adjustedForecast,
    baselineForecast,
    forecast,
    capacityProfile,
    capacityModeAvailable,
    startDate,
    globalDemand,
    capacityPenaltyV11,
  ]);

  // Use the best available forecast:
  // 1. adjustedForecast (if user made What-If changes)
  // 2. baselineForecast (computed from current pipeline data)
  // 3. forecast prop (fallback from parent)
  const activeForecast = adjustedForecast || baselineForecast || forecast;
  const probability = useMemo(() => {
    if (!userTargetDate || activeForecast.simulatedDays.length === 0) return null;
    const daysToTarget = differenceInDays(userTargetDate, startDate);
    const hits = activeForecast.simulatedDays.filter((d) => d <= daysToTarget).length;
    return (hits / activeForecast.simulatedDays.length) * 100;
  }, [userTargetDate, activeForecast.simulatedDays, startDate]);

  // Use active forecast for display
  // Priority: adjusted > baseline (fresh) > prop (potentially stale)
  const displayForecast = adjustedForecast || baselineForecast || forecast;
  const p50Str = isValid(displayForecast.p50Date) ? format(displayForecast.p50Date, 'MMM d, yyyy') : 'N/A';
  const p10Str = isValid(displayForecast.p10Date) ? format(displayForecast.p10Date, 'MMM d') : 'N/A';
  const p90Str = isValid(displayForecast.p90Date) ? format(displayForecast.p90Date, 'MMM d') : 'N/A';

  const rangeDays =
    isValid(displayForecast.p90Date) && isValid(displayForecast.p10Date)
      ? differenceInDays(displayForecast.p90Date, displayForecast.p10Date)
      : 0;

  // CRITICAL: Compare delta against baselineForecast (fresh), NOT forecast prop (stale)
  // The forecast prop may be stale/null from parent's async computation
  // baselineForecast is computed synchronously from simulationParams
  const baselineForDelta = baselineForecast || forecast;
  const p50Delta =
    adjustedForecast && isValid(adjustedForecast.p50Date) && isValid(baselineForDelta.p50Date)
      ? differenceInDays(adjustedForecast.p50Date, baselineForDelta.p50Date)
      : null;

  const hasAdjustments = adjustedForecast !== null;

  return (
    <div className={`oracle-flip-container ${className || ''}`}>
      <div
        className={`oracle-flip-inner ${isFlipped ? 'flipped' : ''}`}
        style={{ minHeight: frontHeight }}
      >
        {/* Front Face */}
        <div ref={frontRef} className="oracle-flip-front">
          <div className="oracle-glass-inner rounded-lg">
          <div className="p-3">
            {/* Compact Header */}
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center gap-2">
                <span className="font-bold text-foreground">The Oracle</span>
                <span
                  className={`inline-flex items-center rounded-full uppercase text-[0.6rem] px-2 py-0.5 ${
                    confidenceStyles[displayForecast.confidenceLevel]
                  }`}
                >
                  {displayForecast.confidenceLevel}
                </span>
                {(hasAdjustments || hasKnobChanges) && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[0.55rem] bg-primary/20 text-primary">
                    Adjusted
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-[0.65rem]">
                  {displayForecast.debug.iterations > 0 ? displayForecast.debug.iterations : knobSettings.iterations} runs
                </span>
                <button
                  type="button"
                  className={`w-8 h-8 min-w-[32px] min-h-[32px] flex items-center justify-center rounded transition-colors ${
                    isFlipped
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                  onClick={() => setIsFlipped(!isFlipped)}
                  title="Explain this forecast"
                >
                  <Info className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* P50 - Main Prediction */}
            <div className="text-center p-3 rounded-lg mb-3 bg-primary/10 border-l-4 border-primary">
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                Most Likely (P50)
              </div>
              <div className="font-mono text-2xl font-bold text-foreground">{p50Str}</div>
              <div className="text-muted-foreground text-sm mt-1">
                {differenceInDays(displayForecast.p50Date, startDate)} days from today
                {p50Delta !== null && p50Delta !== 0 && (
                  <span className={`ml-1.5 ${p50Delta < 0 ? 'text-good' : 'text-bad'}`}>
                    ({p50Delta > 0 ? '+' : ''}
                    {p50Delta}d)
                  </span>
                )}
              </div>
            </div>

            {/* P10/P90 Range */}
            <div className="flex justify-between items-center text-center mb-3 px-2">
              <div>
                <div className="font-bold text-good text-sm">{p10Str}</div>
                <div className="text-muted-foreground text-[0.65rem]">Optimistic</div>
              </div>
              <div className="flex-1 mx-3 text-center">
                <div className="text-muted-foreground text-[0.65rem]">{rangeDays}d range</div>
                <div className="border-b border-border/40 mt-0.5" />
              </div>
              <div>
                <div className="font-bold text-muted-foreground text-sm">{p90Str}</div>
                <div className="text-muted-foreground text-[0.65rem]">Conservative</div>
              </div>
            </div>

            {/* Capacity Comparison View */}
            {capacityAwareForecast && capacityAwareForecast.capacity_constrained && (
              <div className="mb-3 p-2 rounded-lg bg-warn/10 border border-warn/20">
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center gap-2">
                    <Gauge className="w-4 h-4 text-warn" />
                    <span className="text-xs font-semibold text-foreground">Capacity Impact</span>
                    <span
                      className={`inline-flex items-center rounded-full text-[0.55rem] px-1.5 py-0.5 ${
                        confidenceStyles[capacityAwareForecast.capacity_confidence] ||
                        'bg-muted text-muted-foreground'
                      }`}
                    >
                      {capacityAwareForecast.capacity_confidence}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="text-xs font-medium bg-transparent border-none p-0 text-muted-foreground hover:text-primary flex items-center gap-0.5"
                    onClick={() => setShowCapacityView(!showCapacityView)}
                  >
                    {showCapacityView ? 'Hide' : 'Details'}
                    {showCapacityView ? (
                      <ChevronUp className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>

                {/* Quick Summary */}
                <div className="flex justify-between items-center text-xs">
                  <div>
                    <span className="text-muted-foreground">Pipeline-only: </span>
                    <span className="font-mono text-foreground">
                      {format(capacityAwareForecast.pipeline_only.p50_date, 'MMM d')}
                    </span>
                  </div>
                  <div>
                    <ArrowRight className="w-4 h-4 text-warn mx-2" />
                  </div>
                  <div>
                    <span className="text-muted-foreground">With capacity: </span>
                    <span className="font-mono text-warn">
                      {format(capacityAwareForecast.capacity_aware.p50_date, 'MMM d')}
                    </span>
                    {capacityAwareForecast.p50_delta_days > 0 && (
                      <span className="text-bad text-[0.65rem] ml-1">
                        +{capacityAwareForecast.p50_delta_days}d
                      </span>
                    )}
                  </div>
                </div>

                {/* Expanded Details */}
                {showCapacityView && (
                  <div className="mt-2 pt-2 border-t border-border/20">
                    {/* Bottlenecks */}
                    {capacityAwareForecast.capacity_bottlenecks.length > 0 && (
                      <div className="mb-2">
                        <div className="text-muted-foreground mb-1 text-[0.65rem]">Bottlenecks</div>
                        {capacityAwareForecast.capacity_bottlenecks.slice(0, 3).map((b, i) => (
                          <div
                            key={i}
                            className="flex justify-between items-center mb-1 text-xs"
                          >
                            <div className="flex items-center gap-1">
                              <span
                                className={`inline-flex items-center px-1.5 py-0.5 rounded text-[0.55rem] font-medium ${
                                  b.bottleneck_owner_type === 'hm'
                                    ? 'bg-purple-500/20 text-purple-500'
                                    : 'bg-primary/20 text-primary'
                                }`}
                              >
                                {b.bottleneck_owner_type === 'hm' ? 'HM' : 'RC'}
                              </span>
                              <span className="text-foreground">{b.stage_name}</span>
                            </div>
                            <div className="font-mono text-warn">+{Math.round(b.queue_delay_days)}d</div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Capacity Reasons */}
                    {capacityAwareForecast.capacity_reasons.length > 0 && (
                      <div className="text-[0.65rem] text-muted-foreground/80">
                        {capacityAwareForecast.capacity_reasons.slice(0, 2).map((r, i) => (
                          <div key={i} className="flex items-start gap-1 mb-1">
                            {r.impact === 'positive' ? (
                              <CheckCircle className="w-3 h-3 text-good flex-shrink-0 mt-0.5" />
                            ) : r.impact === 'negative' ? (
                              <AlertCircle className="w-3 h-3 text-warn flex-shrink-0 mt-0.5" />
                            ) : (
                              <Info className="w-3 h-3 text-muted-foreground flex-shrink-0 mt-0.5" />
                            )}
                            <span>{r.message}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="text-muted-foreground mt-2 text-[0.6rem] italic">
                      Based on observed throughput over past 12 weeks
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* What-If Toggle Button */}
            {simulationParams && (
              <button
                type="button"
                className={`w-full px-3 py-2 text-sm font-medium rounded border transition-colors min-h-[44px] flex items-center justify-center gap-1 ${
                  showLevers
                    ? 'bg-primary/15 border-primary/40 text-primary'
                    : 'bg-transparent border-border text-muted-foreground hover:bg-muted'
                }`}
                onClick={() => setShowLevers(!showLevers)}
              >
                {showLevers ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <SlidersHorizontal className="w-4 h-4" />
                )}
                {showLevers ? 'Hide What-If' : 'What-If Analysis'}
              </button>
            )}

            {/* What-If Levers Section */}
            {showLevers && simulationParams && (
              <div className="pt-3 mt-2 border-t border-border">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-muted-foreground text-sm">Adjust levers to see impact</span>
                  {hasAdjustments && (
                    <button
                      type="button"
                      className="px-2 py-1 text-xs font-medium rounded bg-transparent border border-border text-muted-foreground hover:bg-muted min-h-[28px]"
                      onClick={resetLevers}
                    >
                      Reset
                    </button>
                  )}
                </div>

                {/* Two-column layout for sliders */}
                <div className="grid grid-cols-2 gap-3">
                  {/* Conversion Rates */}
                  <div>
                    <div className="mb-3 pb-1 text-center text-[0.7rem] font-semibold text-primary border-b border-primary/30 uppercase tracking-wider">
                      Pass Rates
                    </div>
                    {CONTROLLABLE_STAGES.map((stage) => {
                      const baseline =
                        (simulationParams.stageConversionRates[stage] || 0.5) * 100;
                      const adjustment = conversionAdjustments[stage] || 0;
                      const current = baseline + adjustment;

                      return (
                        <div key={stage} className="mb-2">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-xs text-foreground">{STAGE_LABELS[stage]}</span>
                            <span className="text-xs font-mono min-w-[50px] text-right">
                              <span className={adjustment !== 0 ? 'text-secondary' : 'text-foreground'}>
                                {current.toFixed(0)}%
                              </span>
                              {adjustment !== 0 && (
                                <span
                                  className={`text-[0.65rem] ml-0.5 ${
                                    adjustment > 0 ? 'text-good' : 'text-bad'
                                  }`}
                                >
                                  {adjustment > 0 ? '+' : ''}
                                  {adjustment}
                                </span>
                              )}
                            </span>
                          </div>
                          <input
                            type="range"
                            className="w-full h-1.5 rounded-lg appearance-none cursor-pointer bg-muted accent-primary"
                            min={-30}
                            max={30}
                            step={5}
                            value={adjustment}
                            onChange={(e) =>
                              setConversionAdjustments((prev) => ({
                                ...prev,
                                [stage]: Number(e.target.value),
                              }))
                            }
                          />
                        </div>
                      );
                    })}
                  </div>

                  {/* Stage Durations */}
                  <div>
                    <div className="mb-3 pb-1 text-center text-[0.7rem] font-semibold text-primary border-b border-primary/30 uppercase tracking-wider">
                      Durations
                    </div>
                    {CONTROLLABLE_STAGES.map((stage) => {
                      const dist = simulationParams.stageDurations[stage];
                      const baselineDays =
                        dist?.type === 'lognormal' && dist.mu !== undefined
                          ? Math.round(Math.exp(dist.mu))
                          : dist?.days || 7;
                      const pctChange = durationAdjustments[stage] || 0;
                      const currentDays = Math.round(baselineDays * (1 + pctChange / 100));

                      return (
                        <div key={stage} className="mb-2">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-xs text-foreground">{STAGE_LABELS[stage]}</span>
                            <span className="text-xs font-mono min-w-[50px] text-right">
                              <span className={pctChange !== 0 ? 'text-secondary' : 'text-foreground'}>
                                {currentDays}d
                              </span>
                              {pctChange !== 0 && (
                                <span
                                  className={`text-[0.65rem] ml-0.5 ${
                                    pctChange < 0 ? 'text-good' : 'text-bad'
                                  }`}
                                >
                                  {pctChange > 0 ? '+' : ''}
                                  {pctChange}%
                                </span>
                              )}
                            </span>
                          </div>
                          <input
                            type="range"
                            className="w-full h-1.5 rounded-lg appearance-none cursor-pointer bg-muted accent-primary"
                            min={-50}
                            max={50}
                            step={10}
                            value={pctChange}
                            onChange={(e) =>
                              setDurationAdjustments((prev) => ({
                                ...prev,
                                [stage]: Number(e.target.value),
                              }))
                            }
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Impact Summary */}
                {hasAdjustments && p50Delta !== null && p50Delta !== 0 && (
                  <div
                    className={`mt-3 p-2 rounded text-center text-sm ${
                      p50Delta < 0 ? 'bg-good/15' : 'bg-bad/15'
                    }`}
                  >
                    {p50Delta < 0 ? (
                      <span className="text-good flex items-center justify-center gap-1">
                        <ArrowDown className="w-4 h-4" />
                        {Math.abs(p50Delta)} days faster
                      </span>
                    ) : (
                      <span className="text-bad flex items-center justify-center gap-1">
                        <ArrowUp className="w-4 h-4" />
                        {p50Delta} days slower
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
          </div>
        </div>

        {/* Back Face */}
        <div className="oracle-flip-back">
          <div className="oracle-glass-inner rounded-lg" style={{ minHeight: frontHeight }}>
            <OracleBacksideV2
              explainData={explainData}
              knobSettings={knobSettings}
              onKnobChange={setKnobSettings}
              hasKnobChanges={hasKnobChanges}
              onClose={() => setIsFlipped(false)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default OracleConfidenceWidgetV2;
