import React from 'react';
import { CalibrationReport } from '../../services/calibrationService';
import { StatLabel, StatValue } from '../common';

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
                <div className="d-flex align-items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
                    <div className="spinner-border spinner-border-sm" role="status"></div>
                    <span style={{ fontSize: '0.75rem' }}>Running backtest...</span>
                </div>
            </div>
        );
    }

    if (!report) {
        return (
            <div className={`card-bespoke p-3 ${className || ''}`}>
                <div className="d-flex justify-content-between align-items-center">
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
    const accuracyColor = isAccurate ? '#10b981' : '#f59e0b';
    const biasColor = Math.abs(report.bias) <= 3 ? '#10b981' : report.bias > 0 ? '#ef4444' : '#f59e0b';

    return (
        <div className={`card-bespoke p-3 ${className || ''}`}>
            <div className="d-flex justify-content-between align-items-center mb-3">
                <StatLabel>Model Trust Score</StatLabel>
                <span
                    className="badge rounded-pill"
                    style={{
                        background: 'rgba(100, 116, 139, 0.15)',
                        color: 'var(--text-secondary)',
                        fontSize: '0.6rem'
                    }}
                >
                    {report.period}
                </span>
            </div>

            <div className="d-flex align-items-center gap-3 mb-3">
                <StatValue size="lg" color={isAccurate ? 'success' : 'warning'}>
                    {(report.accuracy * 100).toFixed(0)}%
                </StatValue>
                <div style={{
                    width: '1px',
                    height: '2rem',
                    background: 'rgba(255, 255, 255, 0.1)'
                }}></div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.3 }}>
                    of recent forecasts<br />were accurate
                </div>
            </div>

            <div
                style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '0.75rem',
                    fontSize: '0.7rem'
                }}
            >
                <div className="d-flex justify-content-between mb-2">
                    <span style={{ color: 'var(--text-tertiary)' }}>Bias Trend:</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: biasColor }}>
                        {report.bias > 0 ? '+' : ''}{report.bias.toFixed(1)} days
                        <span style={{ color: 'var(--text-tertiary)', fontWeight: 400, marginLeft: '4px' }}>
                            ({report.bias > 0 ? 'Pessimistic' : report.bias < 0 ? 'Optimistic' : 'Neutral'})
                        </span>
                    </span>
                </div>
                <div className="d-flex justify-content-between">
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
                        background: 'rgba(245, 158, 11, 0.1)',
                        borderRadius: 'var(--radius-sm)',
                        borderLeft: '3px solid #f59e0b',
                        fontSize: '0.7rem',
                        color: '#f59e0b'
                    }}
                >
                    <i className="bi bi-exclamation-triangle me-1"></i>
                    Model is currently under-performing. Adjusting constraints recommended.
                </div>
            )}
        </div>
    );
};
