import React from 'react';
import { CalibrationReport } from '../../services/calibrationService';
import { StatLabel, StatValue, LogoSpinner } from '../common';

interface CalibrationCardProps {
    report: CalibrationReport | null;
    isLoading?: boolean;
    className?: string;
    onRunCalibration?: () => void;
}

export const CalibrationCard: React.FC<CalibrationCardProps> = ({
    report,
    isLoading,
    className,
    onRunCalibration
}) => {
    if (isLoading) {
        return (
            <div className={`card-bespoke p-3 ${className || ''}`}>
                <div className="flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
                    <LogoSpinner size={24} message="Running backtest..." />
                </div>
            </div>
        );
    }

    if (!report) {
        return (
            <div className={`card-bespoke p-3 ${className || ''}`}>
                <div className="flex justify-between items-center">
                    <StatLabel>Model Accuracy</StatLabel>
                    {onRunCalibration && (
                        <button
                            className="btn btn-sm btn-bespoke-secondary py-0"
                            onClick={onRunCalibration}
                            style={{ fontSize: '0.7rem' }}
                        >
                            Verify Model
                        </button>
                    )}
                </div>
                <div style={{ color: 'var(--text-tertiary)', fontSize: '0.7rem', marginTop: '0.5rem' }}>
                    Run a backtest on recent hires to verify Oracle's accuracy.
                </div>
            </div>
        );
    }

    // Determine colors based on accuracy
    const isAccurate = report.accuracy >= 0.7;
    const accuracyColor = isAccurate ? 'var(--color-good)' : 'var(--color-warn)';
    const biasColor = Math.abs(report.bias) <= 3 ? 'var(--color-good)' : report.bias > 0 ? 'var(--color-bad)' : 'var(--color-warn)';

    return (
        <div className={`card-bespoke p-3 ${className || ''}`}>
            <div className="flex justify-between items-center mb-3">
                <StatLabel>Model Trust Score</StatLabel>
                <span
                    className="inline-flex items-center rounded-full"
                    style={{
                        background: 'var(--color-neutral-bg)',
                        color: 'var(--text-secondary)',
                        fontSize: '0.6rem',
                        padding: '0.2rem 0.5rem'
                    }}
                >
                    {report.period}
                </span>
            </div>

            <div className="flex items-center gap-3 mb-3">
                <StatValue size="lg" color={isAccurate ? 'success' : 'warning'}>
                    {(report.accuracy * 100).toFixed(0)}%
                </StatValue>
                <div style={{
                    width: '1px',
                    height: '2rem',
                    background: 'var(--glass-border)'
                }}></div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.3 }}>
                    of recent forecasts<br />were accurate
                </div>
            </div>

            <div
                style={{
                    background: 'var(--color-bg-overlay)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '0.75rem',
                    fontSize: '0.7rem'
                }}
            >
                <div className="flex justify-between mb-2">
                    <span style={{ color: 'var(--text-tertiary)' }}>Bias Trend:</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: biasColor }}>
                        {report.bias > 0 ? '+' : ''}{report.bias.toFixed(1)} days
                        <span style={{ color: 'var(--text-tertiary)', fontWeight: 400, marginLeft: '4px' }}>
                            ({report.bias > 0 ? 'Pessimistic' : report.bias < 0 ? 'Optimistic' : 'Neutral'})
                        </span>
                    </span>
                </div>
                <div className="flex justify-between">
                    <span style={{ color: 'var(--text-tertiary)' }}>Sample Size:</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                        {report.sampleSize} hires
                    </span>
                </div>
            </div>

            {!isAccurate && (
                <div
                    style={{
                        marginTop: '0.75rem',
                        padding: '0.5rem 0.75rem',
                        background: 'var(--color-warn-bg)',
                        borderRadius: 'var(--radius-sm)',
                        borderLeft: '3px solid var(--color-warn)',
                        fontSize: '0.7rem',
                        color: 'var(--color-warn)'
                    }}
                >
                    <i className="bi bi-exclamation-triangle mr-1"></i>
                    Model is currently under-performing. Adjusting constraints recommended.
                </div>
            )}
        </div>
    );
};
