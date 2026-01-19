/**
 * OracleBackside - Back face of the Oracle flip card
 * Shows simulation inputs, confidence reasoning, and what-if knobs
 */

import React from 'react';
import {
    OracleExplainData,
    OracleKnobSettings,
    PriorWeightPreset,
    MinNPreset,
    PRIOR_WEIGHT_VALUES,
    MIN_N_VALUES,
    ITERATIONS_RANGE,
    STAGE_LABELS
} from './oracleTypes';

interface OracleBacksideProps {
    explainData: OracleExplainData;
    knobSettings: OracleKnobSettings;
    onKnobChange: (settings: OracleKnobSettings) => void;
    hasKnobChanges: boolean;
    onClose: () => void;
}

export const OracleBackside: React.FC<OracleBacksideProps> = ({
    explainData,
    knobSettings,
    onKnobChange,
    hasKnobChanges,
    onClose
}) => {
    const showPerfWarning = knobSettings.iterations >= ITERATIONS_RANGE.performanceWarningThreshold;

    return (
        <div className="oracle-backside p-3">
            {/* Header */}
            <div className="d-flex justify-content-between align-items-center mb-3">
                <div className="d-flex align-items-center gap-2">
                    <span className="fw-bold">Oracle Explained</span>
                    {hasKnobChanges && (
                        <span className="oracle-adjusted-chip">
                            <i className="bi bi-sliders2" style={{ fontSize: '0.5rem' }}></i>
                            Adjusted
                        </span>
                    )}
                </div>
                <button className="oracle-info-btn active" onClick={onClose} title="Back to forecast">
                    <i className="bi bi-x-lg"></i>
                </button>
            </div>

            {/* Section: Inputs Used */}
            <div className="oracle-backside-section">
                <div className="oracle-backside-section-title">Inputs Used</div>

                {/* Pipeline Counts */}
                <div className="mb-2">
                    <div className="text-muted mb-1" style={{ fontSize: '0.65rem' }}>Pipeline by Stage</div>
                    <table className="oracle-data-table">
                        <tbody>
                            {explainData.pipelineCounts.map(pc => (
                                <tr key={pc.stage}>
                                    <th>{pc.stageName}</th>
                                    <td>{pc.count}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Stage Pass Rates */}
                <div className="mb-2">
                    <div className="text-muted mb-1" style={{ fontSize: '0.65rem' }}>Stage Pass Rates</div>
                    <table className="oracle-data-table">
                        <thead>
                            <tr>
                                <th>Stage</th>
                                <th>Obs</th>
                                <th>Prior</th>
                                <th>→ Final</th>
                                <th>n</th>
                            </tr>
                        </thead>
                        <tbody>
                            {explainData.stageRates.map(sr => (
                                <tr key={sr.stage}>
                                    <th>{sr.stageName}</th>
                                    <td>{(sr.observed * 100).toFixed(0)}%</td>
                                    <td style={{ color: 'var(--text-muted)' }}>{(sr.prior * 100).toFixed(0)}%</td>
                                    <td style={{ color: 'var(--accent)' }}>{(sr.shrunk * 100).toFixed(0)}%</td>
                                    <td style={{ color: 'var(--text-muted)' }}>{sr.n}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Stage Durations */}
                <div className="mb-2">
                    <div className="text-muted mb-1" style={{ fontSize: '0.65rem' }}>Stage Durations</div>
                    <table className="oracle-data-table">
                        <thead>
                            <tr>
                                <th>Stage</th>
                                <th>Model</th>
                                <th>Median</th>
                                <th>n</th>
                            </tr>
                        </thead>
                        <tbody>
                            {explainData.stageDurations.map(sd => (
                                <tr key={sd.stage}>
                                    <th>{sd.stageName}</th>
                                    <td style={{ color: sd.model === 'lognormal' ? 'var(--color-good)' : 'var(--text-muted)' }}>
                                        {sd.model === 'lognormal' ? 'Log-N' : sd.model === 'constant' ? 'Const' : sd.model}
                                    </td>
                                    <td>{sd.medianDays}d</td>
                                    <td style={{ color: 'var(--text-muted)' }}>{sd.n}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Simulation params */}
                <div className="d-flex gap-3 mt-2" style={{ fontSize: '0.65rem' }}>
                    <div>
                        <span className="text-muted">Iterations: </span>
                        <span style={{ fontFamily: 'var(--font-mono)' }}>{explainData.iterations.toLocaleString()}</span>
                    </div>
                    <div>
                        <span className="text-muted">Seed: </span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem' }}>
                            {explainData.seed.length > 12 ? explainData.seed.substring(0, 12) + '…' : explainData.seed}
                        </span>
                    </div>
                </div>
            </div>

            {/* Section: Confidence */}
            <div className="oracle-backside-section">
                <div className="oracle-backside-section-title">Confidence Analysis</div>
                <div className="d-flex align-items-center gap-2 mb-2">
                    <span
                        className="badge rounded-pill"
                        style={{
                            fontSize: '0.6rem',
                            background: explainData.confidenceLevel === 'HIGH' ? 'rgba(34, 197, 94, 0.15)' :
                                explainData.confidenceLevel === 'MEDIUM' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                            color: explainData.confidenceLevel === 'HIGH' ? '#22c55e' :
                                explainData.confidenceLevel === 'MEDIUM' ? '#f59e0b' : '#ef4444'
                        }}
                    >
                        {explainData.confidenceLevel}
                    </span>
                </div>
                <div style={{ fontSize: '0.65rem' }}>
                    {explainData.confidenceReasons.map((reason, idx) => (
                        <div key={idx} className="d-flex align-items-start gap-1 mb-1">
                            <i
                                className={`bi ${reason.impact === 'positive' ? 'bi-check-circle-fill' :
                                    reason.impact === 'negative' ? 'bi-exclamation-circle-fill' : 'bi-info-circle-fill'}`}
                                style={{
                                    fontSize: '0.6rem',
                                    color: reason.impact === 'positive' ? 'var(--color-good)' :
                                        reason.impact === 'negative' ? 'var(--color-warn)' : 'var(--text-muted)'
                                }}
                            ></i>
                            <span className="text-muted">{reason.message}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Section: Calibration */}
            <div className="oracle-backside-section">
                <div className="oracle-backside-section-title">Calibration</div>
                {explainData.calibration.isAvailable && explainData.calibration.score !== null ? (
                    <div style={{ fontSize: '0.7rem' }}>
                        <div className="d-flex justify-content-between mb-1">
                            <span className="text-muted">Score:</span>
                            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)' }}>
                                {explainData.calibration.score}/100
                            </span>
                        </div>
                        {explainData.calibration.bias !== null && (
                            <div className="d-flex justify-content-between mb-1">
                                <span className="text-muted">Bias:</span>
                                <span style={{
                                    fontFamily: 'var(--font-mono)',
                                    color: Math.abs(explainData.calibration.bias) < 3 ? 'var(--color-good)' : 'var(--color-warn)'
                                }}>
                                    {explainData.calibration.bias > 0 ? '+' : ''}{explainData.calibration.bias}d
                                    {explainData.calibration.bias > 0 ? ' (late)' : explainData.calibration.bias < 0 ? ' (early)' : ''}
                                </span>
                            </div>
                        )}
                        {explainData.calibration.lastRunAt && (
                            <div className="text-muted" style={{ fontSize: '0.6rem' }}>
                                Last run: {explainData.calibration.lastRunAt.toLocaleDateString()}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="oracle-calibration-cta">
                        <i className="bi bi-info-circle me-1"></i>
                        Calibration not run
                    </div>
                )}
            </div>

            {/* Section: What-If Knobs */}
            <div className="oracle-backside-section">
                <div className="oracle-backside-section-title">Assumptions (What-If)</div>

                {/* Prior Weight (m) */}
                <div className="oracle-knob">
                    <div className="oracle-knob-label">
                        <span className="oracle-knob-name">Prior Weight (m)</span>
                        <span className="oracle-knob-value">{PRIOR_WEIGHT_VALUES[knobSettings.priorWeight]}</span>
                    </div>
                    <div className="oracle-knob-presets">
                        {(['low', 'medium', 'high'] as PriorWeightPreset[]).map(preset => (
                            <button
                                key={preset}
                                className={`oracle-knob-preset ${knobSettings.priorWeight === preset ? 'active' : ''}`}
                                onClick={() => onKnobChange({ ...knobSettings, priorWeight: preset })}
                            >
                                {preset}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Min N Threshold */}
                <div className="oracle-knob">
                    <div className="oracle-knob-label">
                        <span className="oracle-knob-name">Sample Threshold</span>
                        <span className="oracle-knob-value">n≥{MIN_N_VALUES[knobSettings.minNThreshold]}</span>
                    </div>
                    <div className="oracle-knob-presets">
                        {(['relaxed', 'standard', 'strict'] as MinNPreset[]).map(preset => (
                            <button
                                key={preset}
                                className={`oracle-knob-preset ${knobSettings.minNThreshold === preset ? 'active' : ''}`}
                                onClick={() => onKnobChange({ ...knobSettings, minNThreshold: preset })}
                            >
                                {preset}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Iterations */}
                <div className="oracle-knob">
                    <div className="oracle-knob-label">
                        <span className="oracle-knob-name">Iterations</span>
                        <span className="oracle-knob-value">{knobSettings.iterations.toLocaleString()}</span>
                    </div>
                    <input
                        type="range"
                        className="form-range form-range-sm"
                        min={ITERATIONS_RANGE.min}
                        max={ITERATIONS_RANGE.max}
                        step={1000}
                        value={knobSettings.iterations}
                        onChange={(e) => onKnobChange({ ...knobSettings, iterations: Number(e.target.value) })}
                        style={{ accentColor: 'var(--accent)' }}
                    />
                    {showPerfWarning && (
                        <div className="oracle-perf-warning">
                            <i className="bi bi-exclamation-triangle-fill"></i>
                            Higher iterations may slow down updates
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
