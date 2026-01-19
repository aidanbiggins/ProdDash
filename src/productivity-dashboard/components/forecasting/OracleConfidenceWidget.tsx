import React, { useState, useMemo, useCallback } from 'react';
import { format, differenceInDays, addDays, isValid } from 'date-fns';
import { DistributionChart } from './DistributionChart';
import { ForecastResult, SimulationParameters, runSimulation } from '../../services/probabilisticEngine';
import { CanonicalStage } from '../../types';

interface OracleConfidenceWidgetProps {
    forecast: ForecastResult;
    startDate: Date;
    className?: string;
    targetDate?: Date; // Optional target date from parent
    onTargetDateChange?: (date: Date) => void;
    /** Baseline simulation parameters for interactive what-if analysis */
    simulationParams?: SimulationParameters;
    /** Current stage of the requisition/candidate for re-simulation */
    currentStage?: CanonicalStage;
}

// Stage labels for display
const STAGE_LABELS: Record<string, string> = {
    [CanonicalStage.SCREEN]: 'Screen',
    [CanonicalStage.HM_SCREEN]: 'HM Interview',
    [CanonicalStage.ONSITE]: 'Onsite',
    [CanonicalStage.OFFER]: 'Offer'
};

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

export const OracleConfidenceWidget: React.FC<OracleConfidenceWidgetProps> = ({
    forecast,
    startDate,
    className,
    targetDate: initialTargetDate,
    onTargetDateChange,
    simulationParams,
    currentStage = CanonicalStage.SCREEN
}) => {
    const [userTargetDate, setUserTargetDate] = useState<Date | null>(initialTargetDate || null);
    const [showLevers, setShowLevers] = useState(false);

    // State for user-adjusted levers (deltas from baseline)
    const [conversionAdjustments, setConversionAdjustments] = useState<Record<string, number>>({});
    const [durationAdjustments, setDurationAdjustments] = useState<Record<string, number>>({});

    // Calculate adjusted simulation result when levers change
    const adjustedForecast = useMemo(() => {
        if (!simulationParams) return null;

        // Check if any adjustments are made
        const hasAdjustments =
            Object.values(conversionAdjustments).some(v => v !== 0) ||
            Object.values(durationAdjustments).some(v => v !== 0);

        if (!hasAdjustments) return null;

        // Build adjusted parameters
        const adjustedParams: SimulationParameters = {
            ...simulationParams,
            stageConversionRates: { ...simulationParams.stageConversionRates },
            stageDurations: { ...simulationParams.stageDurations }
        };

        // Apply conversion rate adjustments (percentage points)
        for (const [stage, delta] of Object.entries(conversionAdjustments)) {
            const baseline = simulationParams.stageConversionRates[stage] || 0.5;
            adjustedParams.stageConversionRates[stage] = Math.max(0.05, Math.min(0.99, baseline + delta / 100));
        }

        // Apply duration adjustments (percentage change)
        for (const [stage, pctChange] of Object.entries(durationAdjustments)) {
            const baseDist = simulationParams.stageDurations[stage];
            if (baseDist) {
                const multiplier = 1 + pctChange / 100;
                if (baseDist.type === 'lognormal' && baseDist.mu !== undefined) {
                    // Shift mu to scale median (median = e^mu for lognormal)
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
        return runSimulation(
            { currentStage, startDate, seed: `adjusted-${Date.now()}`, iterations: 500 },
            adjustedParams
        );
    }, [simulationParams, conversionAdjustments, durationAdjustments, currentStage, startDate]);

    // Reset levers to baseline
    const resetLevers = useCallback(() => {
        setConversionAdjustments({});
        setDurationAdjustments({});
    }, []);

    // Calculate probability of hitting user target date
    const activeForecast = adjustedForecast || forecast;
    const probability = useMemo(() => {
        if (!userTargetDate || activeForecast.simulatedDays.length === 0) return null;

        const daysToTarget = differenceInDays(userTargetDate, startDate);

        // Count hits <= daysToTarget
        const hits = activeForecast.simulatedDays.filter(d => d <= daysToTarget).length;
        return (hits / activeForecast.simulatedDays.length) * 100;
    }, [userTargetDate, activeForecast.simulatedDays, startDate]);

    // Use active forecast for display (adjusted if levers are changed)
    const displayForecast = adjustedForecast || forecast;
    const p50Str = isValid(displayForecast.p50Date) ? format(displayForecast.p50Date, 'MMM d, yyyy') : 'N/A';
    const p10Str = isValid(displayForecast.p10Date) ? format(displayForecast.p10Date, 'MMM d') : 'N/A';
    const p90Str = isValid(displayForecast.p90Date) ? format(displayForecast.p90Date, 'MMM d') : 'N/A';

    const rangeDays = isValid(displayForecast.p90Date) && isValid(displayForecast.p10Date)
        ? differenceInDays(displayForecast.p90Date, displayForecast.p10Date)
        : 0;

    // Calculate delta from baseline when adjusted
    const p50Delta = adjustedForecast && isValid(adjustedForecast.p50Date) && isValid(forecast.p50Date)
        ? differenceInDays(adjustedForecast.p50Date, forecast.p50Date)
        : null;

    const badgeStyle = getConfidenceBadgeStyle(displayForecast.confidenceLevel);
    const hasAdjustments = adjustedForecast !== null;

    return (
        <div className={`glass-panel p-4 ${className || ''}`}>
            <div className="d-flex justify-content-between align-items-center mb-3">
                <div className="d-flex align-items-center gap-2">
                    <h5 className="mb-0 fw-bold d-flex align-items-center gap-2">
                        The Oracle
                        {hasAdjustments && (
                            <span
                                className="badge rounded-pill"
                                style={{ fontSize: '0.6rem', background: 'rgba(45, 212, 191, 0.2)', color: '#2dd4bf' }}
                            >
                                ADJUSTED
                            </span>
                        )}
                    </h5>
                    <span
                        className="badge rounded-pill text-uppercase"
                        style={{ fontSize: '0.65rem', ...badgeStyle }}
                    >
                        {displayForecast.confidenceLevel} Confidence
                    </span>
                </div>
                <div className="d-flex align-items-center gap-3">
                    {simulationParams && (
                        <button
                            className="btn btn-sm"
                            style={{
                                background: showLevers ? 'rgba(212, 163, 115, 0.2)' : 'transparent',
                                border: '1px solid rgba(255,255,255,0.2)',
                                color: showLevers ? '#d4a373' : '#94a3b8',
                                fontSize: '0.75rem'
                            }}
                            onClick={() => setShowLevers(!showLevers)}
                        >
                            <i className={`bi bi-sliders me-1`}></i>
                            What-If
                        </button>
                    )}
                    <div className="text-muted small">
                        {displayForecast.debug.iterations} simulations
                    </div>
                </div>
            </div>

            <div className="row g-4">
                {/* Left: Main Prediction */}
                <div className="col-md-5">
                    <div
                        className="text-center p-3 rounded-3 mb-3"
                        style={{
                            background: hasAdjustments ? 'rgba(45, 212, 191, 0.1)' : 'rgba(212, 163, 115, 0.1)',
                            borderLeft: `4px solid ${hasAdjustments ? '#2dd4bf' : 'var(--color-accent-primary, #d4a373)'}`
                        }}
                    >
                        <div className="stat-label mb-1">Most Likely (P50)</div>
                        <div className="stat-value" style={{ fontSize: '1.75rem' }}>{p50Str}</div>
                        <div className="text-muted small mt-1" style={{ whiteSpace: 'nowrap' }}>
                            {differenceInDays(displayForecast.p50Date, startDate)} days from today
                            <span style={{
                                color: p50Delta !== null && p50Delta < 0 ? '#10b981' : p50Delta !== null && p50Delta > 0 ? '#ef4444' : 'transparent',
                                marginLeft: '6px',
                                display: 'inline-block',
                                minWidth: '70px'
                            }}>
                                ({p50Delta !== null && p50Delta > 0 ? '+' : ''}{p50Delta ?? 0} days)
                            </span>
                        </div>
                    </div>

                    {/* P10/P90 Range - Fixed layout */}
                    <div className="d-flex justify-content-between align-items-end text-center small px-2">
                        <div style={{ minWidth: '70px' }}>
                            <div className="fw-bold" style={{ color: '#10b981' }}>{p10Str}</div>
                            <div className="text-muted" style={{ fontSize: '0.7rem' }}>Optimistic (P10)</div>
                        </div>
                        <div className="text-center flex-grow-1 mx-2">
                            <div className="text-muted" style={{ fontSize: '0.7rem' }}>{rangeDays} day range</div>
                            <div style={{ borderBottom: '1px solid rgba(255,255,255,0.2)', marginTop: '4px' }}></div>
                        </div>
                        <div style={{ minWidth: '70px' }}>
                            <div className="fw-bold text-muted">{p90Str}</div>
                            <div className="text-muted" style={{ fontSize: '0.7rem' }}>Conservative (P90)</div>
                        </div>
                    </div>
                </div>

                {/* Middle: Interactive Probability */}
                <div
                    className="col-md-3"
                    style={{ borderLeft: '1px solid rgba(255,255,255,0.1)', borderRight: '1px solid rgba(255,255,255,0.1)' }}
                >
                    <div className="px-2">
                        <label className="stat-label d-block mb-2">Target Date Probability</label>
                        <input
                            type="date"
                            className="form-control form-control-sm mb-2"
                            style={{
                                background: 'rgba(30, 41, 59, 0.8)',
                                border: '1px solid rgba(255,255,255,0.2)',
                                color: '#F8FAFC'
                            }}
                            value={userTargetDate ? format(userTargetDate, 'yyyy-MM-dd') : ''}
                            onChange={(e) => {
                                const d = new Date(e.target.value);
                                if (isValid(d)) {
                                    setUserTargetDate(d);
                                    onTargetDateChange?.(d);
                                }
                            }}
                        />

                        {probability !== null ? (
                            <div className="text-center mt-3">
                                <div
                                    className="stat-value"
                                    style={{
                                        fontSize: '2rem',
                                        color: probability > 75 ? '#10b981' : probability > 40 ? '#f59e0b' : '#ef4444'
                                    }}
                                >
                                    {probability.toFixed(0)}%
                                </div>
                                <div className="text-muted" style={{ fontSize: '0.7rem' }}>chance of hiring by date</div>
                            </div>
                        ) : (
                            <div className="text-center text-muted small mt-4 fst-italic">
                                Select a date to see probability
                            </div>
                        )}
                    </div>
                </div>

                {/* Right: Distribution Chart */}
                <div className="col-md-4">
                    <div className="h-100 d-flex flex-column">
                        <div className="stat-label mb-2">Outcome Distribution</div>
                        <div className="flex-grow-1">
                            <DistributionChart
                                startDate={startDate}
                                simulatedDays={displayForecast.simulatedDays}
                                p10Date={displayForecast.p10Date}
                                p50Date={displayForecast.p50Date}
                                p90Date={displayForecast.p90Date}
                                height={120}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* What-If Levers Section */}
            {showLevers && simulationParams && (
                <div
                    className="mt-4 pt-4"
                    style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}
                >
                    <div className="d-flex justify-content-between align-items-center mb-3">
                        <div>
                            <div className="stat-label">What-If Analysis</div>
                            <div className="text-muted small mt-1">
                                Adjust the levers to see how changes could impact the fill date
                            </div>
                        </div>
                        {hasAdjustments && (
                            <button
                                className="btn btn-sm"
                                style={{
                                    background: 'transparent',
                                    border: '1px solid rgba(255,255,255,0.2)',
                                    color: '#94a3b8',
                                    fontSize: '0.75rem'
                                }}
                                onClick={resetLevers}
                            >
                                <i className="bi bi-arrow-counterclockwise me-1"></i>
                                Reset
                            </button>
                        )}
                    </div>

                    <div className="row g-4">
                        {/* Conversion Rates */}
                        <div className="col-md-6">
                            <div className="stat-label mb-2" style={{ fontSize: '0.7rem' }}>
                                Pass-Through Rates
                                <span className="text-muted ms-2" style={{ fontWeight: 'normal' }}>
                                    (% advancing to next stage)
                                </span>
                            </div>
                            {CONTROLLABLE_STAGES.map(stage => {
                                const baseline = (simulationParams.stageConversionRates[stage] || 0.5) * 100;
                                const adjustment = conversionAdjustments[stage] || 0;
                                const current = baseline + adjustment;

                                return (
                                    <div key={stage} className="mb-3">
                                        <div className="d-flex justify-content-between align-items-center mb-1">
                                            <span style={{ fontSize: '0.75rem', whiteSpace: 'nowrap' }}>{STAGE_LABELS[stage]}</span>
                                            <span
                                                style={{
                                                    fontSize: '0.75rem',
                                                    fontFamily: 'var(--font-mono)',
                                                    color: adjustment !== 0 ? '#2dd4bf' : 'inherit',
                                                    minWidth: '85px',
                                                    textAlign: 'right',
                                                    whiteSpace: 'nowrap'
                                                }}
                                            >
                                                {current.toFixed(0)}%
                                                <span style={{
                                                    color: adjustment > 0 ? '#10b981' : adjustment < 0 ? '#ef4444' : 'transparent',
                                                    marginLeft: '4px',
                                                    display: 'inline-block',
                                                    minWidth: '40px'
                                                }}>
                                                    ({adjustment > 0 ? '+' : ''}{adjustment.toFixed(0)})
                                                </span>
                                            </span>
                                        </div>
                                        <input
                                            type="range"
                                            className="form-range"
                                            min={-30}
                                            max={30}
                                            step={5}
                                            value={adjustment}
                                            onChange={(e) => setConversionAdjustments(prev => ({
                                                ...prev,
                                                [stage]: Number(e.target.value)
                                            }))}
                                            style={{
                                                accentColor: '#d4a373'
                                            }}
                                        />
                                        <div className="d-flex justify-content-between text-muted" style={{ fontSize: '0.65rem' }}>
                                            <span>-30%</span>
                                            <span>Baseline: {baseline.toFixed(0)}%</span>
                                            <span>+30%</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Stage Durations */}
                        <div className="col-md-6">
                            <div className="stat-label mb-2" style={{ fontSize: '0.7rem' }}>
                                Stage Durations
                                <span className="text-muted ms-2" style={{ fontWeight: 'normal' }}>
                                    (days in each stage)
                                </span>
                            </div>
                            {CONTROLLABLE_STAGES.map(stage => {
                                const dist = simulationParams.stageDurations[stage];
                                const baselineDays = dist?.type === 'lognormal' && dist.mu !== undefined
                                    ? Math.round(Math.exp(dist.mu))
                                    : dist?.days || 7;
                                const pctChange = durationAdjustments[stage] || 0;
                                const currentDays = Math.round(baselineDays * (1 + pctChange / 100));

                                return (
                                    <div key={stage} className="mb-3">
                                        <div className="d-flex justify-content-between align-items-center mb-1">
                                            <span style={{ fontSize: '0.75rem', whiteSpace: 'nowrap' }}>{STAGE_LABELS[stage]}</span>
                                            <span
                                                style={{
                                                    fontSize: '0.75rem',
                                                    fontFamily: 'var(--font-mono)',
                                                    color: pctChange !== 0 ? '#2dd4bf' : 'inherit',
                                                    minWidth: '85px',
                                                    textAlign: 'right',
                                                    whiteSpace: 'nowrap'
                                                }}
                                            >
                                                {currentDays}d
                                                <span style={{
                                                    color: pctChange < 0 ? '#10b981' : pctChange > 0 ? '#ef4444' : 'transparent',
                                                    marginLeft: '4px',
                                                    display: 'inline-block',
                                                    minWidth: '45px'
                                                }}>
                                                    ({pctChange > 0 ? '+' : ''}{pctChange}%)
                                                </span>
                                            </span>
                                        </div>
                                        <input
                                            type="range"
                                            className="form-range"
                                            min={-50}
                                            max={50}
                                            step={10}
                                            value={pctChange}
                                            onChange={(e) => setDurationAdjustments(prev => ({
                                                ...prev,
                                                [stage]: Number(e.target.value)
                                            }))}
                                            style={{
                                                accentColor: '#d4a373'
                                            }}
                                        />
                                        <div className="d-flex justify-content-between text-muted" style={{ fontSize: '0.65rem' }}>
                                            <span>-50%</span>
                                            <span>Baseline: {baselineDays}d</span>
                                            <span>+50%</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Impact Summary - Always rendered to reserve space */}
                    <div
                        className="mt-3 p-3 rounded-3"
                        style={{
                            background: hasAdjustments && p50Delta !== null
                                ? (p50Delta < 0 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)')
                                : 'rgba(100, 116, 139, 0.05)',
                            border: hasAdjustments && p50Delta !== null
                                ? `1px solid ${p50Delta < 0 ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
                                : '1px solid rgba(100, 116, 139, 0.1)',
                            opacity: hasAdjustments && p50Delta !== null ? 1 : 0.5,
                            minHeight: '48px'
                        }}
                    >
                        <div className="d-flex align-items-center gap-2">
                            <i
                                className={`bi ${hasAdjustments && p50Delta !== null && p50Delta < 0 ? 'bi-graph-down-arrow' : 'bi-graph-up-arrow'}`}
                                style={{ color: hasAdjustments && p50Delta !== null ? (p50Delta < 0 ? '#10b981' : '#ef4444') : '#64748b' }}
                            ></i>
                            <span style={{ fontSize: '0.85rem' }}>
                                {hasAdjustments && p50Delta !== null ? (
                                    p50Delta < 0 ? (
                                        <>
                                            These changes could <strong style={{ color: '#10b981' }}>speed up hiring by {Math.abs(p50Delta)} days</strong>
                                        </>
                                    ) : p50Delta > 0 ? (
                                        <>
                                            These changes would <strong style={{ color: '#ef4444' }}>delay hiring by {p50Delta} days</strong>
                                        </>
                                    ) : (
                                        <span className="text-muted">No net impact on timeline</span>
                                    )
                                ) : (
                                    <span className="text-muted">Adjust levers above to see impact</span>
                                )}
                            </span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
