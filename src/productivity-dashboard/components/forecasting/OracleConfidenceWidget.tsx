import React, { useState, useMemo } from 'react';
import { format, differenceInDays, addDays, isValid } from 'date-fns';
import { DistributionChart } from './DistributionChart';
import { ForecastResult } from '../../services/probabilisticEngine';

interface OracleConfidenceWidgetProps {
    forecast: ForecastResult;
    startDate: Date;
    className?: string;
    targetDate?: Date; // Optional target date from parent
    onTargetDateChange?: (date: Date) => void;
}

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
    onTargetDateChange
}) => {
    const [userTargetDate, setUserTargetDate] = useState<Date | null>(initialTargetDate || null);

    // Calculate probability of hitting user target date
    const probability = useMemo(() => {
        if (!userTargetDate || forecast.simulatedDays.length === 0) return null;

        const daysToTarget = differenceInDays(userTargetDate, startDate);

        // Count hits <= daysToTarget
        const hits = forecast.simulatedDays.filter(d => d <= daysToTarget).length;
        return (hits / forecast.simulatedDays.length) * 100;
    }, [userTargetDate, forecast.simulatedDays, startDate]);

    const p50Str = isValid(forecast.p50Date) ? format(forecast.p50Date, 'MMM d, yyyy') : 'N/A';
    const p10Str = isValid(forecast.p10Date) ? format(forecast.p10Date, 'MMM d') : 'N/A';
    const p90Str = isValid(forecast.p90Date) ? format(forecast.p90Date, 'MMM d') : 'N/A';

    const rangeDays = isValid(forecast.p90Date) && isValid(forecast.p10Date)
        ? differenceInDays(forecast.p90Date, forecast.p10Date)
        : 0;

    const badgeStyle = getConfidenceBadgeStyle(forecast.confidenceLevel);

    return (
        <div className={`glass-panel p-4 ${className || ''}`}>
            <div className="d-flex justify-content-between align-items-center mb-3">
                <div className="d-flex align-items-center gap-2">
                    <h5 className="mb-0 fw-bold d-flex align-items-center gap-2">
                        The Oracle
                    </h5>
                    <span
                        className="badge rounded-pill text-uppercase"
                        style={{ fontSize: '0.65rem', ...badgeStyle }}
                    >
                        {forecast.confidenceLevel} Confidence
                    </span>
                </div>
                <div className="text-muted small">
                    {forecast.debug.iterations} simulations
                </div>
            </div>

            <div className="row g-4">
                {/* Left: Main Prediction */}
                <div className="col-md-5">
                    <div
                        className="text-center p-3 rounded-3 mb-3"
                        style={{
                            background: 'rgba(212, 163, 115, 0.1)',
                            borderLeft: '4px solid var(--color-accent-primary, #d4a373)'
                        }}
                    >
                        <div className="stat-label mb-1">Most Likely (P50)</div>
                        <div className="stat-value" style={{ fontSize: '1.75rem' }}>{p50Str}</div>
                        <div className="text-muted small mt-1">
                            {differenceInDays(forecast.p50Date, startDate)} days from today
                        </div>
                    </div>

                    <div className="d-flex justify-content-between text-center small px-2">
                        <div>
                            <div className="fw-bold" style={{ color: '#10b981' }}>{p10Str}</div>
                            <div className="text-muted" style={{ fontSize: '0.7rem' }}>Optimistic (P10)</div>
                        </div>
                        <div
                            className="flex-grow-1 mx-2 mb-3 position-relative"
                            style={{ borderBottom: '1px solid rgba(255,255,255,0.2)' }}
                        >
                            <span
                                className="position-absolute top-100 start-50 translate-middle-x text-muted mt-1"
                                style={{ fontSize: '0.7rem' }}
                            >
                                {rangeDays} day range
                            </span>
                        </div>
                        <div>
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
                                simulatedDays={forecast.simulatedDays}
                                p10Date={forecast.p10Date}
                                p50Date={forecast.p50Date}
                                p90Date={forecast.p90Date}
                                height={120}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
