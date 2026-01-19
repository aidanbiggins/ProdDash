import React from 'react';
import { CalibrationReport } from '../../services/calibrationService';

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
            <div className={`card-bespoke p-3 ${className}`}>
                <div className="d-flex align-items-center gap-2 text-muted">
                    <div className="spinner-border spinner-border-sm" role="status"></div>
                    <span className="small">Running backtest...</span>
                </div>
            </div>
        );
    }

    if (!report) {
        return (
            <div className={`card-bespoke p-3 ${className}`}>
                <div className="d-flex justify-content-between align-items-center">
                    <h6 className="mb-0 fw-bold small text-uppercase text-muted">Model Accuracy</h6>
                    {onRunCalibration && (
                        <button className="btn btn-sm btn-outline-secondary py-0" onClick={onRunCalibration} style={{ fontSize: '0.75rem' }}>
                            Verify Model
                        </button>
                    )}
                </div>
                <div className="text-muted xsmall mt-2">
                    Run a backtest on recent hires to verify Oracle's accuracy.
                </div>
            </div>
        );
    }

    // Determine badge color
    const isAccurate = report.accuracy >= 0.7;
    const isBiased = Math.abs(report.bias) > 7;

    return (
        <div className={`card-bespoke p-3 ${className}`}>
            <div className="d-flex justify-content-between align-items-center mb-2">
                <h6 className="mb-0 fw-bold small text-uppercase text-muted">Model Trust Score</h6>
                <span className="badge bg-light text-dark border">
                    {report.period}
                </span>
            </div>

            <div className="d-flex align-items-center gap-3 mb-2">
                <div className={`display-6 fw-bold ${isAccurate ? 'text-success' : 'text-warning'}`}>
                    {(report.accuracy * 100).toFixed(0)}%
                </div>
                <div className="vr"></div>
                <div className="small lh-sm">
                    of recent forecasts<br />were accurate
                </div>
            </div>

            <div className="bg-light rounded p-2 xsmall">
                <div className="d-flex justify-content-between mb-1">
                    <span className="text-muted">Bias Trend:</span>
                    <span className={`fw-bold ${report.bias < 0 ? 'text-success' : 'text-danger'}`}>
                        {report.bias > 0 ? `+${report.bias.toFixed(1)} days (Pessimistic)` : `${report.bias.toFixed(1)} days (Optimistic)`}
                    </span>
                </div>
                <div className="d-flex justify-content-between">
                    <span className="text-muted">Sample Size:</span>
                    <span className="fw-bold">{report.sampleSize} hires</span>
                </div>
            </div>

            {!isAccurate && (
                <div className="mt-2 text-warning xsmall">
                    <i className="bi bi-exclamation-triangle me-1"></i>
                    Model is currently under-performing. Adjusting constraints recommended.
                </div>
            )}
        </div>
    );
};
