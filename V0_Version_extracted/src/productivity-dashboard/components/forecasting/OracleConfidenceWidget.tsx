import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { format, differenceInDays, isValid, subWeeks } from 'date-fns';
import { ForecastResult, SimulationParameters, runSimulation, runPipelineSimulation, runCapacityAwareForecast, shrinkRate, DurationDistribution, PipelineCandidate } from '../../services/probabilisticEngine';
import { CanonicalStage, Candidate, Event, Requisition, User } from '../../types';
import { OracleBackside } from './OracleBackside';
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
    hashPipelineCounts
} from './oracleTypes';
import { inferCapacity } from '../../services/capacityInferenceService';
import { applyCapacityPenalty, computeGlobalDemand, applyCapacityPenaltyV11 } from '../../services/capacityPenaltyModel';
import {
    OracleCapacityProfile,
    OracleCapacityAwareForecastResult,
    OraclePipelineByStage,
    OracleGlobalDemand,
    OracleCapacityPenaltyResultV11,
    OracleCapacityRecommendation,
    ConfidenceLevel,
    ORACLE_CAPACITY_STAGE_LABELS
} from '../../types/capacityTypes';

/**
 * Convert title-case or any-case stage name to CanonicalStage
 * Handles: 'Screen' -> 'SCREEN', 'HM Screen' -> 'HM_SCREEN', etc.
 */
function toCanonicalStage(stage: string | null | undefined): CanonicalStage | null {
    if (!stage) return null;

    // If already canonical (all uppercase enum value), return directly
    if (Object.values(CanonicalStage).includes(stage as CanonicalStage)) {
        return stage as CanonicalStage;
    }

    // Map common title-case variations to canonical by uppercasing and replacing spaces with underscores
    const normalized = stage.toUpperCase().replace(/\s+/g, '_');
    if (Object.values(CanonicalStage).includes(normalized as CanonicalStage)) {
        return normalized as CanonicalStage;
    }

    return null;
}

interface OracleConfidenceWidgetProps {
    forecast: ForecastResult;
    startDate: Date;
    className?: string;
    targetDate?: Date;
    onTargetDateChange?: (date: Date) => void;
    /** Baseline simulation parameters for interactive what-if analysis */
    simulationParams?: SimulationParameters;
    /** Current stage of the requisition/candidate for re-simulation */
    currentStage?: CanonicalStage;
    /** Pipeline candidates for explainability */
    pipelineCandidates?: Candidate[];
    /** Req ID for caching */
    reqId?: string;
    /** Base observed rates before shrinkage (for explainability) */
    observedRates?: Record<string, number>;
    /** Prior rates used (for explainability) */
    priorRates?: Record<string, number>;
    /** Events for capacity inference (optional - enables capacity-aware mode) */
    events?: Event[];
    /** Requisitions for capacity inference */
    requisitions?: Requisition[];
    /** Users for name lookup */
    users?: User[];
    /** Recruiter ID for capacity inference */
    recruiterId?: string;
    /** HM ID for capacity inference */
    hmId?: string;
    /** All candidates (v1.1) - for global demand computation across recruiter/HM workload */
    allCandidates?: Candidate[];
}

const CONTROLLABLE_STAGES = [
    CanonicalStage.SCREEN,
    CanonicalStage.HM_SCREEN,
    CanonicalStage.ONSITE,
    CanonicalStage.OFFER
];

// Confidence badge styling for dark theme
const getConfidenceBadgeStyle = (level: string) => {
    switch (level) {
        case 'HIGH':
            return { background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' };
        case 'MEDIUM':
            return { background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' };
        default:
            return { background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' };
    }
};

// Simple in-memory cache for simulation results
const simulationCache = new Map<string, ForecastResult>();

export const OracleConfidenceWidget: React.FC<OracleConfidenceWidgetProps> = ({
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
    allCandidates = []
}) => {
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

    // Track front height for backside sizing
    useEffect(() => {
        if (frontRef.current && !isFlipped) {
            setFrontHeight(frontRef.current.offsetHeight);
        }
    }, [isFlipped, showLevers]);

    // Check if knobs have been changed from defaults
    const hasKnobChanges = useMemo(() => {
        return knobSettings.priorWeight !== DEFAULT_KNOB_SETTINGS.priorWeight ||
            knobSettings.minNThreshold !== DEFAULT_KNOB_SETTINGS.minNThreshold ||
            knobSettings.iterations !== DEFAULT_KNOB_SETTINGS.iterations;
    }, [knobSettings]);

    // Calculate pipeline counts by stage
    const pipelineCounts = useMemo((): PipelineCountInfo[] => {
        const counts: Record<string, number> = {};
        for (const cand of pipelineCandidates) {
            const stage = cand.current_stage;
            counts[stage] = (counts[stage] || 0) + 1;
        }
        return CONTROLLABLE_STAGES.map(stage => ({
            stage,
            stageName: STAGE_LABELS[stage] || stage,
            count: counts[stage] || 0
        }));
    }, [pipelineCandidates]);

    // Pipeline by stage for capacity model (selected req only)
    const pipelineByStage = useMemo((): OraclePipelineByStage => {
        const counts: OraclePipelineByStage = {};
        for (const cand of pipelineCandidates) {
            const stage = cand.current_stage;
            counts[stage] = (counts[stage] || 0) + 1;
        }
        return counts;
    }, [pipelineCandidates]);

    // v1.1: Compute global demand across recruiter/HM's full workload
    const globalDemand = useMemo((): OracleGlobalDemand | null => {
        // Use allCandidates if provided, otherwise fall back to pipelineCandidates
        const candidatesForDemand = allCandidates.length > 0 ? allCandidates : pipelineCandidates;

        return computeGlobalDemand({
            selectedReqId: reqId,
            recruiterId: recruiterId || null,
            hmId: hmId || null,
            allCandidates: candidatesForDemand,
            allRequisitions: requisitions,
            users
        });
    }, [reqId, recruiterId, hmId, allCandidates, pipelineCandidates, requisitions, users]);

    // Check if capacity-aware mode is available (v1.1: relaxed - works with partial data)
    const capacityModeAvailable = events.length > 0 && simulationParams && (recruiterId || hmId);

    // Infer capacity profile (memoized) - v1.1: works with partial data
    const capacityProfile = useMemo((): OracleCapacityProfile | null => {
        if (!capacityModeAvailable) return null;

        const dateRange = {
            start: subWeeks(startDate, 12), // Look back 12 weeks
            end: startDate
        };

        return inferCapacity({
            reqId,
            recruiterId: recruiterId || '',
            hmId: hmId || '',
            dateRange,
            events,
            candidates: pipelineCandidates,
            requisitions,
            users
        });
    }, [capacityModeAvailable, reqId, recruiterId, hmId, startDate, events, pipelineCandidates, requisitions, users]);

    // v1.1: Compute penalty result with global demand
    const capacityPenaltyV11 = useMemo((): OracleCapacityPenaltyResultV11 | null => {
        if (!capacityProfile || !simulationParams || !globalDemand) return null;

        return applyCapacityPenaltyV11(
            simulationParams.stageDurations,
            globalDemand,
            capacityProfile
        );
    }, [capacityProfile, simulationParams, globalDemand]);

    // Run capacity-aware forecast (memoized) - v1.1: use global demand for penalties
    const capacityAwareForecast = useMemo((): OracleCapacityAwareForecastResult | null => {
        if (!capacityProfile || !simulationParams || pipelineCandidates.length === 0 || !globalDemand) return null;

        const pipelineCandidatesForSim: PipelineCandidate[] = pipelineCandidates
            .map(c => ({
                candidateId: c.candidate_id,
                currentStage: toCanonicalStage(c.current_stage)
            }))
            .filter((c): c is PipelineCandidate => c.currentStage !== null);

        // v1.1: Pass global demand-derived pipeline counts for capacity penalty
        // but keep per-req candidates for pipeline-only forecast
        const globalDemandPipeline: OraclePipelineByStage = {};
        for (const stage of CONTROLLABLE_STAGES) {
            // Use max of recruiter and HM demand for each stage
            const recruiterDemand = globalDemand.recruiter_demand[stage] || 0;
            const hmDemand = globalDemand.hm_demand[stage] || 0;
            globalDemandPipeline[stage] = Math.max(recruiterDemand, hmDemand);
        }

        return runCapacityAwareForecast(
            pipelineCandidatesForSim,
            globalDemandPipeline, // v1.1: Use global demand
            simulationParams,
            capacityProfile,
            startDate,
            forecast.debug.seed,
            knobSettings.iterations
        );
    }, [capacityProfile, simulationParams, pipelineCandidates, globalDemand, startDate, forecast.debug.seed, knobSettings.iterations]);

    // Generate cache key - must include ALL adjustment factors
    const cacheKey = useMemo(() => {
        // Include lever adjustments in cache key
        const leverHash = JSON.stringify({
            conv: conversionAdjustments,
            dur: durationAdjustments
        });
        return generateCacheKey({
            reqId,
            pipelineHash: hashPipelineCounts(pipelineCounts) + '-' + leverHash,
            seed: forecast.debug.seed,
            knobSettings
        });
    }, [reqId, pipelineCounts, forecast.debug.seed, knobSettings, conversionAdjustments, durationAdjustments]);

    // Calculate adjusted simulation result when levers or knobs change
    const adjustedForecast = useMemo(() => {
        if (!simulationParams) return null;

        // Check if any adjustments are made
        const hasLeverAdjustments =
            Object.values(conversionAdjustments).some(v => v !== 0) ||
            Object.values(durationAdjustments).some(v => v !== 0);

        if (!hasLeverAdjustments && !hasKnobChanges) return null;

        // Check cache first
        const cached = simulationCache.get(cacheKey);
        if (cached) return cached;

        // Build adjusted parameters
        const adjustedParams: SimulationParameters = {
            ...simulationParams,
            stageConversionRates: { ...simulationParams.stageConversionRates },
            stageDurations: { ...simulationParams.stageDurations },
            sampleSizes: { ...simulationParams.sampleSizes }
        };

        const priorWeight = PRIOR_WEIGHT_VALUES[knobSettings.priorWeight];
        const minN = MIN_N_VALUES[knobSettings.minNThreshold];
        const priorWeightChanged = knobSettings.priorWeight !== DEFAULT_KNOB_SETTINGS.priorWeight;

        // Apply rate adjustments
        for (const stage of CONTROLLABLE_STAGES) {
            // Start from the BASELINE rate (what the original forecast used)
            // Only re-apply shrinkage if the prior weight knob has been changed
            let baseRate: number;
            if (priorWeightChanged) {
                // User changed prior weight - recalculate shrinkage with new m
                const obs = observedRates[stage] ?? simulationParams.stageConversionRates[stage] ?? 0.5;
                const prior = priorRates[stage] ?? 0.5;
                const n = simulationParams.sampleSizes[`${stage}_rate`] || 0;
                baseRate = shrinkRate(obs, prior, n, priorWeight);
            } else {
                // Use the same rate as the baseline forecast
                baseRate = simulationParams.stageConversionRates[stage] ?? 0.5;
            }

            // Apply lever adjustments (percentage points)
            const delta = conversionAdjustments[stage] || 0;
            const adjusted = Math.max(0.05, Math.min(0.99, baseRate + delta / 100));

            adjustedParams.stageConversionRates[stage] = adjusted;
        }

        // Apply duration adjustments (percentage change) and min_n threshold
        for (const stage of CONTROLLABLE_STAGES) {
            const baseDist = simulationParams.stageDurations[stage];
            const n = simulationParams.sampleSizes[`${stage}_duration`] || simulationParams.sampleSizes[`${stage}_rate`] || 0;
            const pctChange = durationAdjustments[stage] || 0;

            if (baseDist) {
                const multiplier = 1 + pctChange / 100;

                // If n < minN threshold, fall back to constant/global
                if (n < minN && baseDist.type === 'lognormal') {
                    adjustedParams.stageDurations[stage] = {
                        type: 'constant',
                        days: Math.max(1, Math.round(7 * multiplier)) // Default 7 days
                    };
                } else if (baseDist.type === 'lognormal' && baseDist.mu !== undefined) {
                    adjustedParams.stageDurations[stage] = {
                        ...baseDist,
                        mu: baseDist.mu + Math.log(multiplier)
                    };
                } else if (baseDist.type === 'constant' && baseDist.days !== undefined) {
                    adjustedParams.stageDurations[stage] = {
                        ...baseDist,
                        days: Math.max(1, Math.round(baseDist.days * multiplier))
                    };
                }
            }
        }

        // Run PIPELINE-AWARE simulation with adjusted params
        // This is critical: we simulate all candidates in parallel and take the FIRST success
        // This makes pass rates meaningful - lower rates = fewer candidates succeed = longer fill time
        const pipelineCandidatesForSim: PipelineCandidate[] = pipelineCandidates
            .map(c => ({
                candidateId: c.candidate_id,
                currentStage: toCanonicalStage(c.current_stage)
            }))
            .filter((c): c is PipelineCandidate => c.currentStage !== null);

        // Fall back to single-candidate simulation if no pipeline (backward compatibility)
        const result = pipelineCandidatesForSim.length > 0
            ? runPipelineSimulation(
                pipelineCandidatesForSim,
                adjustedParams,
                startDate,
                `adjusted-${cacheKey}`,
                knobSettings.iterations
            )
            : runSimulation(
                { currentStage, startDate, seed: `adjusted-${cacheKey}`, iterations: knobSettings.iterations },
                adjustedParams
            );

        // Cache the result
        simulationCache.set(cacheKey, result);

        // Limit cache size
        if (simulationCache.size > 50) {
            const firstKey = simulationCache.keys().next().value;
            if (firstKey) simulationCache.delete(firstKey);
        }

        return result;
    }, [simulationParams, conversionAdjustments, durationAdjustments, currentStage, startDate, hasKnobChanges, knobSettings, cacheKey, observedRates, priorRates]);

    // Reset levers to baseline
    const resetLevers = useCallback(() => {
        setConversionAdjustments({});
        setDurationAdjustments({});
    }, []);

    // Build explainability data for backside
    const explainData = useMemo((): OracleExplainData => {
        const stageRates: StageRateInfo[] = CONTROLLABLE_STAGES.map(stage => {
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
                n
            };
        });

        const stageDurations: StageDurationInfo[] = CONTROLLABLE_STAGES.map(stage => {
            const dist = simulationParams?.stageDurations[stage];
            const n = simulationParams?.sampleSizes[`${stage}_duration`] || simulationParams?.sampleSizes[`${stage}_rate`] || 0;
            const minN = MIN_N_VALUES[knobSettings.minNThreshold];

            let model: 'empirical' | 'lognormal' | 'constant' | 'global' = 'constant';
            let medianDays = 7;

            if (dist) {
                if (dist.type === 'lognormal' && dist.mu !== undefined) {
                    model = n >= minN ? 'lognormal' : 'global';
                    medianDays = Math.round(Math.exp(dist.mu));
                } else if (dist.type === 'empirical') {
                    model = 'empirical';
                    // Calculate median from buckets if available
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
                distribution: dist
            };
        });

        // Build confidence reasons
        const confidenceReasons: ConfidenceReason[] = [];
        const minSampleSize = Math.min(...stageRates.map(sr => sr.n));
        const avgSampleSize = stageRates.reduce((sum, sr) => sum + sr.n, 0) / stageRates.length;

        if (minSampleSize >= 15) {
            confidenceReasons.push({
                type: 'sample_size',
                message: `Good sample sizes (min ${minSampleSize} per stage)`,
                impact: 'positive'
            });
        } else if (minSampleSize >= 5) {
            confidenceReasons.push({
                type: 'sample_size',
                message: `Moderate sample sizes (min ${minSampleSize})`,
                impact: 'neutral'
            });
        } else {
            confidenceReasons.push({
                type: 'sample_size',
                message: `Limited data (min ${minSampleSize} samples)`,
                impact: 'negative'
            });
        }

        const shrinkageReliance = stageRates.filter(sr => sr.n < 10).length;
        if (shrinkageReliance > 0) {
            confidenceReasons.push({
                type: 'shrinkage',
                message: `${shrinkageReliance} stage(s) rely on prior assumptions`,
                impact: shrinkageReliance > 2 ? 'negative' : 'neutral'
            });
        }

        const lognormalCount = stageDurations.filter(sd => sd.model === 'lognormal').length;
        if (lognormalCount >= 3) {
            confidenceReasons.push({
                type: 'duration_model',
                message: 'Using fitted duration distributions',
                impact: 'positive'
            });
        } else {
            confidenceReasons.push({
                type: 'duration_model',
                message: `${4 - lognormalCount} stage(s) use fallback durations`,
                impact: 'neutral'
            });
        }

        const displayForecast = adjustedForecast || forecast;

        // Build capacity explain data if available (v1.1: use global demand)
        let capacityData: CapacityExplainData | undefined;
        if (capacityProfile && simulationParams && globalDemand) {
            // v1.1: Use global demand-based penalty calculation
            const penaltyResultV11 = capacityPenaltyV11;

            // Also compute legacy penalty result for backward compatibility
            const legacyPenaltyResult = applyCapacityPenalty(
                simulationParams.stageDurations,
                pipelineByStage,
                capacityProfile
            );

            const inferenceWindow = {
                start: subWeeks(startDate, 12),
                end: startDate
            };

            capacityData = {
                isAvailable: true,
                profile: capacityProfile,
                penaltyResult: legacyPenaltyResult,
                totalQueueDelayDays: penaltyResultV11?.total_queue_delay_days || legacyPenaltyResult.total_queue_delay_days,
                inferenceWindow,
                // v1.1 additions
                globalDemand,
                penaltyResultV11,
                recommendations: penaltyResultV11?.recommendations || []
            };
        } else if (!capacityModeAvailable) {
            capacityData = {
                isAvailable: false,
                profile: null,
                penaltyResult: null,
                totalQueueDelayDays: 0,
                inferenceWindow: null,
                globalDemand: null,
                recommendations: []
            };
        }

        return {
            pipelineCounts,
            stageRates,
            stageDurations,
            iterations: displayForecast.debug.iterations,
            seed: displayForecast.debug.seed,
            confidenceLevel: displayForecast.confidenceLevel,
            confidenceReasons,
            calibration: {
                lastRunAt: null,
                score: null,
                bias: null,
                isAvailable: false
            },
            capacity: capacityData
        };
    }, [simulationParams, pipelineCounts, pipelineByStage, knobSettings, observedRates, priorRates, adjustedForecast, forecast, capacityProfile, capacityModeAvailable, startDate, globalDemand, capacityPenaltyV11]);

    // Calculate probability of hitting user target date
    const activeForecast = adjustedForecast || forecast;
    const probability = useMemo(() => {
        if (!userTargetDate || activeForecast.simulatedDays.length === 0) return null;
        const daysToTarget = differenceInDays(userTargetDate, startDate);
        const hits = activeForecast.simulatedDays.filter(d => d <= daysToTarget).length;
        return (hits / activeForecast.simulatedDays.length) * 100;
    }, [userTargetDate, activeForecast.simulatedDays, startDate]);

    // Use active forecast for display
    const displayForecast = adjustedForecast || forecast;
    const p50Str = isValid(displayForecast.p50Date) ? format(displayForecast.p50Date, 'MMM d, yyyy') : 'N/A';
    const p10Str = isValid(displayForecast.p10Date) ? format(displayForecast.p10Date, 'MMM d') : 'N/A';
    const p90Str = isValid(displayForecast.p90Date) ? format(displayForecast.p90Date, 'MMM d') : 'N/A';

    const rangeDays = isValid(displayForecast.p90Date) && isValid(displayForecast.p10Date)
        ? differenceInDays(displayForecast.p90Date, displayForecast.p10Date)
        : 0;

    const p50Delta = adjustedForecast && isValid(adjustedForecast.p50Date) && isValid(forecast.p50Date)
        ? differenceInDays(adjustedForecast.p50Date, forecast.p50Date)
        : null;

    const badgeStyle = getConfidenceBadgeStyle(displayForecast.confidenceLevel);
    const hasAdjustments = adjustedForecast !== null;

    return (
        <div className={`oracle-flip-container ${className || ''}`}>
            <div
                className={`oracle-flip-inner ${isFlipped ? 'flipped' : ''}`}
                style={{ minHeight: frontHeight }}
            >
                {/* Front Face */}
                <div className="oracle-flip-front" ref={frontRef}>
                    <div className="oracle-glass-inner p-3">
                    {/* Compact Header */}
                    <div className="flex justify-between items-center mb-3">
                        <div className="flex items-center gap-2">
                            <span className="font-bold">The Oracle</span>
                            <span
                                className="inline-flex items-center rounded-full uppercase"
                                style={{ fontSize: '0.6rem', padding: '0.2rem 0.5rem', ...badgeStyle }}
                            >
                                {displayForecast.confidenceLevel}
                            </span>
                            {(hasAdjustments || hasKnobChanges) && (
                                <span className="oracle-adjusted-chip">
                                    Adjusted
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-muted-foreground" style={{ fontSize: '0.65rem' }}>
                                {displayForecast.debug.iterations} runs
                            </span>
                            <button
                                className={`oracle-info-btn ${isFlipped ? 'active' : ''}`}
                                onClick={() => setIsFlipped(!isFlipped)}
                                title="Explain this forecast"
                            >
                                <i className="bi bi-info-circle"></i>
                            </button>
                        </div>
                    </div>

                    {/* P50 - Main Prediction */}
                    <div
                        className="text-center p-3 rounded-lg mb-3"
                        style={{
                            background: 'rgba(212, 163, 115, 0.1)',
                            borderLeft: '4px solid var(--color-accent-primary, #d4a373)'
                        }}
                    >
                        <div className="stat-label mb-1">Most Likely (P50)</div>
                        <div className="stat-value" style={{ fontSize: '1.5rem' }}>{p50Str}</div>
                        <div className="text-muted-foreground text-sm mt-1">
                            {differenceInDays(displayForecast.p50Date, startDate)} days from today
                            {p50Delta !== null && p50Delta !== 0 && (
                                <span style={{ color: p50Delta < 0 ? '#10b981' : '#ef4444', marginLeft: '6px' }}>
                                    ({p50Delta > 0 ? '+' : ''}{p50Delta}d)
                                </span>
                            )}
                        </div>
                    </div>

                    {/* P10/P90 Range */}
                    <div className="flex justify-between items-center text-center mb-3 px-2">
                        <div>
                            <div className="font-bold" style={{ color: '#10b981', fontSize: '0.85rem' }}>{p10Str}</div>
                            <div className="text-muted-foreground" style={{ fontSize: '0.65rem' }}>Optimistic</div>
                        </div>
                        <div className="grow mx-3 text-center">
                            <div className="text-muted-foreground" style={{ fontSize: '0.65rem' }}>{rangeDays}d range</div>
                            <div style={{ borderBottom: '1px solid rgba(255,255,255,0.2)', marginTop: '2px' }}></div>
                        </div>
                        <div>
                            <div className="font-bold text-muted-foreground" style={{ fontSize: '0.85rem' }}>{p90Str}</div>
                            <div className="text-muted-foreground" style={{ fontSize: '0.65rem' }}>Conservative</div>
                        </div>
                    </div>

                    {/* Capacity Comparison View */}
                    {capacityAwareForecast && capacityAwareForecast.capacity_constrained && (
                        <div
                            className="mb-3 p-2 rounded-lg"
                            style={{
                                background: 'rgba(245, 158, 11, 0.1)',
                                border: '1px solid rgba(245, 158, 11, 0.2)'
                            }}
                        >
                            <div className="flex justify-between items-center mb-2">
                                <div className="flex items-center gap-2">
                                    <i className="bi bi-speedometer2" style={{ color: '#f59e0b' }}></i>
                                    <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>Capacity Impact</span>
                                    <span
                                        className="inline-flex items-center rounded-full"
                                        style={{
                                            fontSize: '0.55rem',
                                            padding: '0.15rem 0.4rem',
                                            background: capacityAwareForecast.capacity_confidence === 'HIGH'
                                                ? 'rgba(16, 185, 129, 0.15)'
                                                : capacityAwareForecast.capacity_confidence === 'MED'
                                                    ? 'rgba(245, 158, 11, 0.15)'
                                                    : 'rgba(239, 68, 68, 0.15)',
                                            color: capacityAwareForecast.capacity_confidence === 'HIGH'
                                                ? '#10b981'
                                                : capacityAwareForecast.capacity_confidence === 'MED'
                                                    ? '#f59e0b'
                                                    : '#ef4444'
                                        }}
                                    >
                                        {capacityAwareForecast.capacity_confidence}
                                    </span>
                                </div>
                                <button
                                    className="text-xs font-medium"
                                    style={{
                                        background: 'transparent',
                                        border: 'none',
                                        padding: '0',
                                        color: showCapacityView ? '#d4a373' : '#94a3b8'
                                    }}
                                    onClick={() => setShowCapacityView(!showCapacityView)}
                                >
                                    {showCapacityView ? 'Hide' : 'Details'}
                                    <i className={`bi bi-chevron-${showCapacityView ? 'up' : 'down'} ml-1`}></i>
                                </button>
                            </div>

                            {/* Quick Summary */}
                            <div className="flex justify-between items-center" style={{ fontSize: '0.75rem' }}>
                                <div>
                                    <span className="text-muted-foreground">Pipeline-only: </span>
                                    <span style={{ fontFamily: 'var(--font-mono)' }}>
                                        {format(capacityAwareForecast.pipeline_only.p50_date, 'MMM d')}
                                    </span>
                                </div>
                                <div>
                                    <i className="bi bi-arrow-right mx-2" style={{ color: '#f59e0b' }}></i>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">With capacity: </span>
                                    <span style={{ fontFamily: 'var(--font-mono)', color: '#f59e0b' }}>
                                        {format(capacityAwareForecast.capacity_aware.p50_date, 'MMM d')}
                                    </span>
                                    {capacityAwareForecast.p50_delta_days > 0 && (
                                        <span style={{ color: '#ef4444', fontSize: '0.65rem', marginLeft: '4px' }}>
                                            +{capacityAwareForecast.p50_delta_days}d
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Expanded Details */}
                            {showCapacityView && (
                                <div className="mt-2 pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                                    {/* Bottlenecks */}
                                    {capacityAwareForecast.capacity_bottlenecks.length > 0 && (
                                        <div className="mb-2">
                                            <div className="text-muted-foreground mb-1" style={{ fontSize: '0.65rem' }}>Bottlenecks</div>
                                            {capacityAwareForecast.capacity_bottlenecks.slice(0, 3).map((b, i) => (
                                                <div
                                                    key={i}
                                                    className="flex justify-between items-center mb-1"
                                                    style={{ fontSize: '0.7rem' }}
                                                >
                                                    <div className="flex items-center gap-1">
                                                        <span
                                                            className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                                                            style={{
                                                                fontSize: '0.55rem',
                                                                padding: '0.1rem 0.3rem',
                                                                background: b.bottleneck_owner_type === 'hm'
                                                                    ? 'rgba(139, 92, 246, 0.15)'
                                                                    : 'rgba(59, 130, 246, 0.15)',
                                                                color: b.bottleneck_owner_type === 'hm'
                                                                    ? '#8b5cf6'
                                                                    : '#3b82f6'
                                                            }}
                                                        >
                                                            {b.bottleneck_owner_type === 'hm' ? 'HM' : 'RC'}
                                                        </span>
                                                        <span>{b.stage_name}</span>
                                                    </div>
                                                    <div style={{ fontFamily: 'var(--font-mono)', color: '#f59e0b' }}>
                                                        +{Math.round(b.queue_delay_days)}d
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Capacity Reasons */}
                                    {capacityAwareForecast.capacity_reasons.length > 0 && (
                                        <div style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)' }}>
                                            {capacityAwareForecast.capacity_reasons.slice(0, 2).map((r, i) => (
                                                <div key={i} className="flex items-start gap-1 mb-1">
                                                    <i
                                                        className={`bi ${r.impact === 'positive'
                                                            ? 'bi-check-circle-fill'
                                                            : r.impact === 'negative'
                                                                ? 'bi-exclamation-circle-fill'
                                                                : 'bi-info-circle-fill'
                                                            }`}
                                                        style={{
                                                            fontSize: '0.55rem',
                                                            color: r.impact === 'positive'
                                                                ? '#10b981'
                                                                : r.impact === 'negative'
                                                                    ? '#f59e0b'
                                                                    : '#94a3b8'
                                                        }}
                                                    ></i>
                                                    <span>{r.message}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    <div className="text-muted-foreground mt-2" style={{ fontSize: '0.6rem', fontStyle: 'italic' }}>
                                        Based on observed throughput over past 12 weeks
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* What-If Toggle Button */}
                    {simulationParams && (
                        <button
                            className="px-3 py-1.5 text-sm font-medium rounded w-full"
                            style={{
                                background: showLevers ? 'rgba(212, 163, 115, 0.15)' : 'transparent',
                                border: `1px solid ${showLevers ? 'rgba(212, 163, 115, 0.4)' : 'rgba(255,255,255,0.15)'}`,
                                color: showLevers ? '#d4a373' : '#94a3b8'
                            }}
                            onClick={() => setShowLevers(!showLevers)}
                        >
                            <i className={`bi ${showLevers ? 'bi-chevron-up' : 'bi-sliders2'} mr-1`}></i>
                            {showLevers ? 'Hide What-If' : 'What-If Analysis'}
                        </button>
                    )}

                    {/* What-If Levers Section */}
                    {showLevers && simulationParams && (
                        <div
                            className="pt-3 mt-2"
                            style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}
                        >
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-muted-foreground text-sm">Adjust levers to see impact</span>
                                {hasAdjustments && (
                                    <button
                                        className="px-2 py-0.5 text-xs font-medium rounded"
                                        style={{
                                            background: 'transparent',
                                            border: '1px solid rgba(255,255,255,0.2)',
                                            color: '#94a3b8'
                                        }}
                                        onClick={resetLevers}
                                    >
                                        Reset
                                    </button>
                                )}
                            </div>

                            {/* Two-column layout for sliders */}
                            <div className="grid grid-cols-12 gap-3">
                                {/* Conversion Rates */}
                                <div className="col-span-6">
                                    <div
                                        className="mb-3 pb-1 text-center"
                                        style={{
                                            fontSize: '0.7rem',
                                            fontWeight: 600,
                                            color: '#d4a373',
                                            borderBottom: '1px solid rgba(212, 163, 115, 0.3)',
                                            letterSpacing: '0.05em',
                                            textTransform: 'uppercase'
                                        }}
                                    >
                                        Pass Rates
                                    </div>
                                    {CONTROLLABLE_STAGES.map(stage => {
                                        const baseline = (simulationParams.stageConversionRates[stage] || 0.5) * 100;
                                        const adjustment = conversionAdjustments[stage] || 0;
                                        const current = baseline + adjustment;

                                        return (
                                            <div key={stage} className="mb-2">
                                                <div className="flex justify-between items-center mb-1">
                                                    <span style={{ fontSize: '0.75rem' }}>{STAGE_LABELS[stage]}</span>
                                                    <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', minWidth: '50px', textAlign: 'right' }}>
                                                        <span style={{ color: adjustment !== 0 ? '#2dd4bf' : 'inherit' }}>{current.toFixed(0)}%</span>
                                                        {adjustment !== 0 && (
                                                            <span style={{ color: adjustment > 0 ? '#10b981' : '#ef4444', fontSize: '0.65rem', marginLeft: '2px' }}>
                                                                {adjustment > 0 ? '+' : ''}{adjustment}
                                                            </span>
                                                        )}
                                                    </span>
                                                </div>
                                                <input
                                                    type="range"
                                                    className="w-full h-1.5 rounded-lg appearance-none cursor-pointer bg-gray-700"
                                                    min={-30}
                                                    max={30}
                                                    step={5}
                                                    value={adjustment}
                                                    onChange={(e) => setConversionAdjustments(prev => ({
                                                        ...prev,
                                                        [stage]: Number(e.target.value)
                                                    }))}
                                                    style={{ accentColor: '#d4a373' }}
                                                />
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Stage Durations */}
                                <div className="col-span-6">
                                    <div
                                        className="mb-3 pb-1 text-center"
                                        style={{
                                            fontSize: '0.7rem',
                                            fontWeight: 600,
                                            color: '#d4a373',
                                            borderBottom: '1px solid rgba(212, 163, 115, 0.3)',
                                            letterSpacing: '0.05em',
                                            textTransform: 'uppercase'
                                        }}
                                    >
                                        Durations
                                    </div>
                                    {CONTROLLABLE_STAGES.map(stage => {
                                        const dist = simulationParams.stageDurations[stage];
                                        const baselineDays = dist?.type === 'lognormal' && dist.mu !== undefined
                                            ? Math.round(Math.exp(dist.mu))
                                            : dist?.days || 7;
                                        const pctChange = durationAdjustments[stage] || 0;
                                        const currentDays = Math.round(baselineDays * (1 + pctChange / 100));

                                        return (
                                            <div key={stage} className="mb-2">
                                                <div className="flex justify-between items-center mb-1">
                                                    <span style={{ fontSize: '0.75rem' }}>{STAGE_LABELS[stage]}</span>
                                                    <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', minWidth: '50px', textAlign: 'right' }}>
                                                        <span style={{ color: pctChange !== 0 ? '#2dd4bf' : 'inherit' }}>{currentDays}d</span>
                                                        {pctChange !== 0 && (
                                                            <span style={{ color: pctChange < 0 ? '#10b981' : '#ef4444', fontSize: '0.65rem', marginLeft: '2px' }}>
                                                                {pctChange > 0 ? '+' : ''}{pctChange}%
                                                            </span>
                                                        )}
                                                    </span>
                                                </div>
                                                <input
                                                    type="range"
                                                    className="w-full h-1.5 rounded-lg appearance-none cursor-pointer bg-gray-700"
                                                    min={-50}
                                                    max={50}
                                                    step={10}
                                                    value={pctChange}
                                                    onChange={(e) => setDurationAdjustments(prev => ({
                                                        ...prev,
                                                        [stage]: Number(e.target.value)
                                                    }))}
                                                    style={{ accentColor: '#d4a373' }}
                                                />
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Impact Summary */}
                            {hasAdjustments && p50Delta !== null && p50Delta !== 0 && (
                                <div
                                    className="mt-3 p-2 rounded text-center"
                                    style={{
                                        background: p50Delta < 0 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                        fontSize: '0.8rem'
                                    }}
                                >
                                    {p50Delta < 0 ? (
                                        <span style={{ color: '#10b981' }}>
                                            <i className="bi bi-arrow-down mr-1"></i>
                                            {Math.abs(p50Delta)} days faster
                                        </span>
                                    ) : (
                                        <span style={{ color: '#ef4444' }}>
                                            <i className="bi bi-arrow-up mr-1"></i>
                                            {p50Delta} days slower
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                    </div>
                </div>

                {/* Back Face */}
                <div
                    className="oracle-flip-back"
                    style={{ minHeight: frontHeight }}
                >
                    <div className="oracle-glass-inner">
                        <OracleBackside
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
};
