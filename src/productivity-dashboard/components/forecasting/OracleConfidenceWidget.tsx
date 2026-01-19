import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { format, differenceInDays, isValid } from 'date-fns';
import { ForecastResult, SimulationParameters, runSimulation, shrinkRate, DurationDistribution } from '../../services/probabilisticEngine';
import { CanonicalStage, Candidate } from '../../types';
import { OracleBackside } from './OracleBackside';
import {
    OracleKnobSettings,
    OracleExplainData,
    PipelineCountInfo,
    StageRateInfo,
    StageDurationInfo,
    ConfidenceReason,
    DEFAULT_KNOB_SETTINGS,
    PRIOR_WEIGHT_VALUES,
    MIN_N_VALUES,
    STAGE_LABELS,
    generateCacheKey,
    hashPipelineCounts
} from './oracleTypes';

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
    priorRates = {}
}) => {
    const [userTargetDate, setUserTargetDate] = useState<Date | null>(initialTargetDate || null);
    const [showLevers, setShowLevers] = useState(false);
    const [isFlipped, setIsFlipped] = useState(false);
    const [knobSettings, setKnobSettings] = useState<OracleKnobSettings>(DEFAULT_KNOB_SETTINGS);
    const frontRef = useRef<HTMLDivElement>(null);
    const [frontHeight, setFrontHeight] = useState<number | undefined>(undefined);

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

    // Generate cache key
    const cacheKey = useMemo(() => {
        return generateCacheKey({
            reqId,
            pipelineHash: hashPipelineCounts(pipelineCounts),
            seed: forecast.debug.seed,
            knobSettings
        });
    }, [reqId, pipelineCounts, forecast.debug.seed, knobSettings]);

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

        // Re-apply shrinkage with new prior weight
        for (const stage of CONTROLLABLE_STAGES) {
            const obs = observedRates[stage] ?? simulationParams.stageConversionRates[stage] ?? 0.5;
            const prior = priorRates[stage] ?? 0.5;
            const n = simulationParams.sampleSizes[`${stage}_rate`] || 0;

            // Apply shrinkage with adjusted prior weight
            let shrunk = shrinkRate(obs, prior, n, priorWeight);

            // Apply lever adjustments (percentage points)
            const delta = conversionAdjustments[stage] || 0;
            shrunk = Math.max(0.05, Math.min(0.99, shrunk + delta / 100));

            adjustedParams.stageConversionRates[stage] = shrunk;
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

        // Run simulation with adjusted params
        const result = runSimulation(
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
            }
        };
    }, [simulationParams, pipelineCounts, knobSettings, observedRates, priorRates, adjustedForecast, forecast]);

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
                <div className="oracle-flip-front glass-panel p-3" ref={frontRef}>
                    {/* Compact Header */}
                    <div className="d-flex justify-content-between align-items-center mb-3">
                        <div className="d-flex align-items-center gap-2">
                            <span className="fw-bold">The Oracle</span>
                            <span
                                className="badge rounded-pill text-uppercase"
                                style={{ fontSize: '0.6rem', ...badgeStyle }}
                            >
                                {displayForecast.confidenceLevel}
                            </span>
                            {(hasAdjustments || hasKnobChanges) && (
                                <span className="oracle-adjusted-chip">
                                    Adjusted
                                </span>
                            )}
                        </div>
                        <div className="d-flex align-items-center gap-2">
                            <span className="text-muted" style={{ fontSize: '0.65rem' }}>
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
                        className="text-center p-3 rounded-3 mb-3"
                        style={{
                            background: 'rgba(212, 163, 115, 0.1)',
                            borderLeft: '4px solid var(--color-accent-primary, #d4a373)'
                        }}
                    >
                        <div className="stat-label mb-1">Most Likely (P50)</div>
                        <div className="stat-value" style={{ fontSize: '1.5rem' }}>{p50Str}</div>
                        <div className="text-muted small mt-1">
                            {differenceInDays(displayForecast.p50Date, startDate)} days from today
                            {p50Delta !== null && p50Delta !== 0 && (
                                <span style={{ color: p50Delta < 0 ? '#10b981' : '#ef4444', marginLeft: '6px' }}>
                                    ({p50Delta > 0 ? '+' : ''}{p50Delta}d)
                                </span>
                            )}
                        </div>
                    </div>

                    {/* P10/P90 Range */}
                    <div className="d-flex justify-content-between align-items-center text-center mb-3 px-2">
                        <div>
                            <div className="fw-bold" style={{ color: '#10b981', fontSize: '0.85rem' }}>{p10Str}</div>
                            <div className="text-muted" style={{ fontSize: '0.65rem' }}>Optimistic</div>
                        </div>
                        <div className="flex-grow-1 mx-3 text-center">
                            <div className="text-muted" style={{ fontSize: '0.65rem' }}>{rangeDays}d range</div>
                            <div style={{ borderBottom: '1px solid rgba(255,255,255,0.2)', marginTop: '2px' }}></div>
                        </div>
                        <div>
                            <div className="fw-bold text-muted" style={{ fontSize: '0.85rem' }}>{p90Str}</div>
                            <div className="text-muted" style={{ fontSize: '0.65rem' }}>Conservative</div>
                        </div>
                    </div>

                    {/* What-If Toggle Button */}
                    {simulationParams && (
                        <button
                            className="btn btn-sm w-100"
                            style={{
                                background: showLevers ? 'rgba(212, 163, 115, 0.15)' : 'transparent',
                                border: `1px solid ${showLevers ? 'rgba(212, 163, 115, 0.4)' : 'rgba(255,255,255,0.15)'}`,
                                color: showLevers ? '#d4a373' : '#94a3b8',
                                fontSize: '0.75rem'
                            }}
                            onClick={() => setShowLevers(!showLevers)}
                        >
                            <i className={`bi ${showLevers ? 'bi-chevron-up' : 'bi-sliders2'} me-1`}></i>
                            {showLevers ? 'Hide What-If' : 'What-If Analysis'}
                        </button>
                    )}

                    {/* What-If Levers Section */}
                    {showLevers && simulationParams && (
                        <div
                            className="pt-3 mt-2"
                            style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}
                        >
                            <div className="d-flex justify-content-between align-items-center mb-2">
                                <span className="text-muted small">Adjust levers to see impact</span>
                                {hasAdjustments && (
                                    <button
                                        className="btn btn-sm"
                                        style={{
                                            background: 'transparent',
                                            border: '1px solid rgba(255,255,255,0.2)',
                                            color: '#94a3b8',
                                            fontSize: '0.65rem',
                                            padding: '0.15rem 0.4rem'
                                        }}
                                        onClick={resetLevers}
                                    >
                                        Reset
                                    </button>
                                )}
                            </div>

                            {/* Two-column layout for sliders */}
                            <div className="row g-3">
                                {/* Conversion Rates */}
                                <div className="col-6">
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
                                                <div className="d-flex justify-content-between align-items-center mb-1">
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
                                                    className="form-range form-range-sm"
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
                                <div className="col-6">
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
                                                <div className="d-flex justify-content-between align-items-center mb-1">
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
                                                    className="form-range form-range-sm"
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
                                    className="mt-3 p-2 rounded-2 text-center"
                                    style={{
                                        background: p50Delta < 0 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                        fontSize: '0.8rem'
                                    }}
                                >
                                    {p50Delta < 0 ? (
                                        <span style={{ color: '#10b981' }}>
                                            <i className="bi bi-arrow-down me-1"></i>
                                            {Math.abs(p50Delta)} days faster
                                        </span>
                                    ) : (
                                        <span style={{ color: '#ef4444' }}>
                                            <i className="bi bi-arrow-up me-1"></i>
                                            {p50Delta} days slower
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Back Face */}
                <div
                    className="oracle-flip-back"
                    style={{ minHeight: frontHeight }}
                >
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
    );
};
