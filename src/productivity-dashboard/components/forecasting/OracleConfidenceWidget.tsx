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
        <div className={`glass-panel p-3 ${className || ''}`}>
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
                    {hasAdjustments && (
                        <span
                            className="badge rounded-pill text-uppercase"
                            style={{
                                fontSize: '0.6rem',
                                background: 'rgba(45, 212, 191, 0.15)',
                                color: '#2dd4bf'
                            }}
                        >
                            Adjusted
                        </span>
                    )}
                </div>
                <span className="text-muted" style={{ fontSize: '0.65rem' }}>
                    {displayForecast.debug.iterations} runs
                </span>
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

            {/* P10/P90 Range - Compact horizontal */}
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
                            <div className="text-muted mb-2" style={{ fontSize: '0.65rem', fontWeight: 600 }}>
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
                            <div className="text-muted mb-2" style={{ fontSize: '0.65rem', fontWeight: 600 }}>
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
    );
};
