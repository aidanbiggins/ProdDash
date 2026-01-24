/**
 * OracleBackside - Back face of the Oracle flip card
 * Shows simulation inputs, confidence reasoning, capacity analysis, and what-if knobs
 *
 * v1.1: Added global demand workload context, bottleneck attribution, and prescriptive recommendations
 */

import React from 'react';
import { format } from 'date-fns';
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
import { ORACLE_CAPACITY_STAGE_LABELS, OracleCapacityRecommendation } from '../../types/capacityTypes';

interface OracleBacksideProps {
    explainData: OracleExplainData;
    knobSettings: OracleKnobSettings;
    onKnobChange: (settings: OracleKnobSettings) => void;
    hasKnobChanges: boolean;
    onClose: () => void;
}

/** Helper function to get icon and color for recommendation types */
function getRecommendationIcon(type: OracleCapacityRecommendation['type']): { icon: string; color: string } {
    switch (type) {
        case 'increase_throughput':
            return { icon: 'bi-speedometer2', color: 'var(--color-blue)' };
        case 'reassign_workload':
            return { icon: 'bi-arrow-left-right', color: 'var(--color-purple)' };
        case 'reduce_demand':
            return { icon: 'bi-funnel', color: 'var(--color-warn)' };
        case 'improve_data':
            return { icon: 'bi-database-check', color: 'var(--color-good)' };
        default:
            return { icon: 'bi-lightbulb', color: 'var(--color-good)' };
    }
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
                            background: explainData.confidenceLevel === 'HIGH' ? 'var(--color-success-light)' :
                                explainData.confidenceLevel === 'MEDIUM' ? 'var(--color-warning-light)' : 'var(--color-danger-light)',
                            color: explainData.confidenceLevel === 'HIGH' ? 'var(--color-good)' :
                                explainData.confidenceLevel === 'MEDIUM' ? 'var(--color-warn)' : 'var(--color-bad)'
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


            {/* Section: Capacity Analysis (v1.1 with global workload context) */}
            {explainData.capacity && (
                <div className="oracle-backside-section">
                    <div className="oracle-backside-section-title">
                        <span>Capacity Analysis</span>
                        <span
                            className="badge rounded-pill ms-2"
                            style={{
                                fontSize: '0.5rem',
                                background: explainData.capacity.isAvailable ? 'var(--color-success-light)' : 'var(--color-neutral-bg)',
                                color: explainData.capacity.isAvailable ? 'var(--color-good)' : 'var(--text-muted)'
                            }}
                        >
                            {explainData.capacity.isAvailable ? 'ACTIVE' : 'UNAVAILABLE'}
                        </span>
                    </div>

                    {explainData.capacity.isAvailable && explainData.capacity.profile ? (
                        <div style={{ fontSize: '0.65rem' }}>
                            {/* Inference Window */}
                            {explainData.capacity.inferenceWindow && (
                                <div className="text-muted mb-2" style={{ fontSize: '0.6rem' }}>
                                    Based on {format(explainData.capacity.inferenceWindow.start, 'MMM d')} – {format(explainData.capacity.inferenceWindow.end, 'MMM d, yyyy')}
                                </div>
                            )}

                            {/* v1.1: Global Workload Context */}
                            {explainData.capacity.globalDemand && (
                                <div
                                    className="mb-2 p-2 rounded"
                                    style={{
                                        background: 'var(--color-blue-light)',
                                        border: '1px solid var(--color-blue-light)'
                                    }}
                                >
                                    <div className="d-flex align-items-center gap-1 mb-1">
                                        <i className="bi bi-people" style={{ fontSize: '0.6rem', color: 'var(--color-blue)' }}></i>
                                        <span style={{ fontWeight: 600 }}>Workload Context</span>
                                    </div>
                                    <div className="d-flex gap-3" style={{ fontSize: '0.6rem' }}>
                                        <div>
                                            <span className="text-muted">Recruiter: </span>
                                            <span style={{ fontFamily: 'var(--font-mono)' }}>
                                                {explainData.capacity.globalDemand.recruiter_context.open_req_count} reqs,{' '}
                                                {explainData.capacity.globalDemand.recruiter_context.total_candidates_in_flight} in-flight
                                            </span>
                                        </div>
                                        {explainData.capacity.globalDemand.hm_context.hm_id && (
                                            <div>
                                                <span className="text-muted">HM: </span>
                                                <span style={{ fontFamily: 'var(--font-mono)' }}>
                                                    {explainData.capacity.globalDemand.hm_context.open_req_count} reqs,{' '}
                                                    {explainData.capacity.globalDemand.hm_context.total_candidates_in_flight} in-flight
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                    {explainData.capacity.globalDemand.demand_scope !== 'single_req' && (
                                        <div className="text-muted mt-1" style={{ fontSize: '0.55rem', fontStyle: 'italic' }}>
                                            Demand computed from {explainData.capacity.globalDemand.demand_scope === 'global_by_recruiter' ? "recruiter's" : "HM's"} full portfolio
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Recruiter Capacity */}
                            {explainData.capacity.profile.recruiter && (
                                <div className="mb-2">
                                    <div className="d-flex align-items-center gap-1 mb-1">
                                        <i className="bi bi-person-badge" style={{ fontSize: '0.6rem', color: 'var(--color-blue)' }}></i>
                                        <span style={{ fontWeight: 600 }}>Recruiter Throughput</span>
                                        <span
                                            className="badge rounded-pill"
                                            style={{
                                                fontSize: '0.5rem',
                                                background: explainData.capacity.profile.recruiter.overall_confidence === 'HIGH'
                                                    ? 'var(--color-success-light)'
                                                    : explainData.capacity.profile.recruiter.overall_confidence === 'MED'
                                                        ? 'var(--color-warning-light)'
                                                        : 'var(--color-danger-light)',
                                                color: explainData.capacity.profile.recruiter.overall_confidence === 'HIGH'
                                                    ? 'var(--color-good)'
                                                    : explainData.capacity.profile.recruiter.overall_confidence === 'MED'
                                                        ? 'var(--color-warn)'
                                                        : 'var(--color-bad)'
                                            }}
                                        >
                                            {explainData.capacity.profile.recruiter.overall_confidence}
                                        </span>
                                    </div>
                                    <table className="oracle-data-table">
                                        <thead>
                                            <tr>
                                                <th>Stage</th>
                                                <th>/wk</th>
                                                <th>n</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr>
                                                <th>Screen</th>
                                                <td>{explainData.capacity.profile.recruiter.screens_per_week.throughput_per_week.toFixed(1)}</td>
                                                <td style={{ color: 'var(--text-muted)' }}>{explainData.capacity.profile.recruiter.screens_per_week.n_transitions}</td>
                                            </tr>
                                            {explainData.capacity.profile.recruiter.hm_screens_per_week && (
                                                <tr>
                                                    <th>HM Screen</th>
                                                    <td>{explainData.capacity.profile.recruiter.hm_screens_per_week.throughput_per_week.toFixed(1)}</td>
                                                    <td style={{ color: 'var(--text-muted)' }}>{explainData.capacity.profile.recruiter.hm_screens_per_week.n_transitions}</td>
                                                </tr>
                                            )}
                                            {explainData.capacity.profile.recruiter.onsites_per_week && (
                                                <tr>
                                                    <th>Onsite</th>
                                                    <td>{explainData.capacity.profile.recruiter.onsites_per_week.throughput_per_week.toFixed(1)}</td>
                                                    <td style={{ color: 'var(--text-muted)' }}>{explainData.capacity.profile.recruiter.onsites_per_week.n_transitions}</td>
                                                </tr>
                                            )}
                                            {explainData.capacity.profile.recruiter.offers_per_week && (
                                                <tr>
                                                    <th>Offer</th>
                                                    <td>{explainData.capacity.profile.recruiter.offers_per_week.throughput_per_week.toFixed(1)}</td>
                                                    <td style={{ color: 'var(--text-muted)' }}>{explainData.capacity.profile.recruiter.offers_per_week.n_transitions}</td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {/* HM Capacity */}
                            {explainData.capacity.profile.hm && explainData.capacity.profile.hm.interviews_per_week && (
                                <div className="mb-2">
                                    <div className="d-flex align-items-center gap-1 mb-1">
                                        <i className="bi bi-person-workspace" style={{ fontSize: '0.6rem', color: 'var(--color-purple)' }}></i>
                                        <span style={{ fontWeight: 600 }}>HM Throughput</span>
                                        <span
                                            className="badge rounded-pill"
                                            style={{
                                                fontSize: '0.5rem',
                                                background: explainData.capacity.profile.hm.overall_confidence === 'HIGH'
                                                    ? 'var(--color-success-light)'
                                                    : explainData.capacity.profile.hm.overall_confidence === 'MED'
                                                        ? 'var(--color-warning-light)'
                                                        : 'var(--color-danger-light)',
                                                color: explainData.capacity.profile.hm.overall_confidence === 'HIGH'
                                                    ? 'var(--color-good)'
                                                    : explainData.capacity.profile.hm.overall_confidence === 'MED'
                                                        ? 'var(--color-warn)'
                                                        : 'var(--color-bad)'
                                            }}
                                        >
                                            {explainData.capacity.profile.hm.overall_confidence}
                                        </span>
                                    </div>
                                    <table className="oracle-data-table">
                                        <thead>
                                            <tr>
                                                <th>Stage</th>
                                                <th>/wk</th>
                                                <th>n</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr>
                                                <th>Interviews</th>
                                                <td>{explainData.capacity.profile.hm.interviews_per_week.throughput_per_week.toFixed(1)}</td>
                                                <td style={{ color: 'var(--text-muted)' }}>{explainData.capacity.profile.hm.interviews_per_week.n_transitions}</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {/* v1.1: Queue Delays with Bottleneck Attribution */}
                            {explainData.capacity.penaltyResultV11 && explainData.capacity.penaltyResultV11.top_bottlenecks.length > 0 ? (
                                <div className="mb-2">
                                    <div className="d-flex align-items-center gap-1 mb-1">
                                        <i className="bi bi-hourglass-split" style={{ fontSize: '0.6rem', color: 'var(--color-warn)' }}></i>
                                        <span style={{ fontWeight: 600 }}>Bottlenecks</span>
                                    </div>
                                    <table className="oracle-data-table">
                                        <thead>
                                            <tr>
                                                <th>Stage</th>
                                                <th>Owner</th>
                                                <th>Demand</th>
                                                <th>Delay</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {explainData.capacity.penaltyResultV11.top_bottlenecks.map(b => (
                                                <tr key={b.stage}>
                                                    <th>{b.stage_name}</th>
                                                    <td>
                                                        <span
                                                            className="badge"
                                                            style={{
                                                                fontSize: '0.5rem',
                                                                background: b.bottleneck_owner_type === 'hm'
                                                                    ? 'var(--color-purple-light)'
                                                                    : 'var(--color-blue-light)',
                                                                color: b.bottleneck_owner_type === 'hm'
                                                                    ? 'var(--color-purple)'
                                                                    : 'var(--color-blue)'
                                                            }}
                                                        >
                                                            {b.bottleneck_owner_type === 'hm' ? 'HM' : b.bottleneck_owner_type === 'recruiter' ? 'RC' : 'Both'}
                                                        </span>
                                                    </td>
                                                    <td style={{ fontFamily: 'var(--font-mono)' }}>{b.demand}</td>
                                                    <td style={{ color: 'var(--color-warn)', fontFamily: 'var(--font-mono)' }}>+{b.queue_delay_days.toFixed(1)}d</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    <div className="d-flex justify-content-between mt-1" style={{ fontWeight: 600 }}>
                                        <span>Total Queue Delay:</span>
                                        <span style={{ color: 'var(--color-warn)' }}>+{explainData.capacity.totalQueueDelayDays.toFixed(1)}d</span>
                                    </div>
                                </div>
                            ) : explainData.capacity.penaltyResult && explainData.capacity.penaltyResult.top_bottlenecks.length > 0 ? (
                                /* Fallback to v1 display if v1.1 not available */
                                <div className="mb-2">
                                    <div className="d-flex align-items-center gap-1 mb-1">
                                        <i className="bi bi-hourglass-split" style={{ fontSize: '0.6rem', color: 'var(--color-warn)' }}></i>
                                        <span style={{ fontWeight: 600 }}>Queue Delays</span>
                                    </div>
                                    <table className="oracle-data-table">
                                        <thead>
                                            <tr>
                                                <th>Stage</th>
                                                <th>Demand</th>
                                                <th>Rate</th>
                                                <th>Delay</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {explainData.capacity.penaltyResult.stage_diagnostics
                                                .filter(d => d.queue_delay_days > 0)
                                                .sort((a, b) => b.queue_delay_days - a.queue_delay_days)
                                                .slice(0, 4)
                                                .map(d => (
                                                    <tr key={d.stage}>
                                                        <th>{d.stage_name}</th>
                                                        <td>{d.demand}</td>
                                                        <td>{d.service_rate.toFixed(1)}/wk</td>
                                                        <td style={{ color: 'var(--color-warn)' }}>+{d.queue_delay_days.toFixed(1)}d</td>
                                                    </tr>
                                                ))}
                                        </tbody>
                                    </table>
                                    <div className="d-flex justify-content-between mt-1" style={{ fontWeight: 600 }}>
                                        <span>Total Queue Delay:</span>
                                        <span style={{ color: 'var(--color-warn)' }}>+{explainData.capacity.totalQueueDelayDays.toFixed(1)}d</span>
                                    </div>
                                </div>
                            ) : null}

                            {/* v1.1: Prescriptive Recommendations with confidence badge */}
                            {explainData.capacity.recommendations && explainData.capacity.recommendations.length > 0 && (
                                <div
                                    className="mb-2 p-2 rounded"
                                    style={{
                                        background: 'var(--color-good-bg)',
                                        border: '1px solid var(--color-success-light)'
                                    }}
                                >
                                    <div className="d-flex align-items-center gap-1 mb-1">
                                        <i className="bi bi-lightbulb" style={{ fontSize: '0.6rem', color: 'var(--color-good)' }}></i>
                                        <span style={{ fontWeight: 600 }}>To Improve</span>
                                        <span
                                            className="badge rounded-pill ms-1"
                                            style={{
                                                fontSize: '0.45rem',
                                                background: explainData.capacity.profile?.overall_confidence === 'HIGH'
                                                    ? 'var(--color-success-light)'
                                                    : explainData.capacity.profile?.overall_confidence === 'MED'
                                                        ? 'var(--color-warning-light)'
                                                        : 'var(--color-danger-light)',
                                                color: explainData.capacity.profile?.overall_confidence === 'HIGH'
                                                    ? 'var(--color-good)'
                                                    : explainData.capacity.profile?.overall_confidence === 'MED'
                                                        ? 'var(--color-warn)'
                                                        : 'var(--color-bad)'
                                            }}
                                        >
                                            {explainData.capacity.profile?.overall_confidence || 'LOW'}
                                        </span>
                                    </div>
                                    <div style={{ fontSize: '0.6rem' }}>
                                        {explainData.capacity.recommendations.slice(0, 2).map((rec, idx) => (
                                            <div key={idx} className="d-flex align-items-start gap-1 mb-1">
                                                <span style={{ color: getRecommendationIcon(rec.type).color }}>
                                                    <i className={`bi ${getRecommendationIcon(rec.type).icon}`} style={{ fontSize: '0.55rem' }}></i>
                                                </span>
                                                <div>
                                                    <span>{rec.description}</span>
                                                    {rec.estimated_impact_days > 0 && (
                                                        <span style={{ color: 'var(--color-good)', marginLeft: '4px', fontStyle: 'italic' }}>
                                                            (est. ~{rec.estimated_impact_days}d faster)
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Cohort Fallback Notice */}
                            {explainData.capacity.profile.used_cohort_fallback && (
                                <div
                                    className="mt-2 p-1 rounded"
                                    style={{
                                        background: 'var(--color-warn-bg)',
                                        fontSize: '0.6rem',
                                        color: 'var(--color-warn)'
                                    }}
                                >
                                    <i className="bi bi-info-circle me-1"></i>
                                    Using cohort averages (insufficient individual data)
                                </div>
                            )}

                            {/* Confidence Reasons (v1.1: includes global demand reasons) */}
                            {((explainData.capacity.profile.confidence_reasons.length > 0) ||
                              (explainData.capacity.globalDemand?.confidence_reasons.length ?? 0) > 0) && (
                                <div className="mt-2" style={{ fontSize: '0.6rem' }}>
                                    {[
                                        ...(explainData.capacity.globalDemand?.confidence_reasons || []),
                                        ...explainData.capacity.profile.confidence_reasons
                                    ].slice(0, 3).map((r, i) => (
                                        <div key={i} className="d-flex align-items-start gap-1 mb-1">
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
                                                        ? 'var(--color-good)'
                                                        : r.impact === 'negative'
                                                            ? 'var(--color-warn)'
                                                            : 'var(--text-secondary)'
                                                }}
                                            ></i>
                                            <span className="text-muted">{r.message}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="oracle-calibration-cta">
                            <i className="bi bi-info-circle me-1"></i>
                            {!explainData.capacity.profile
                                ? 'Capacity data not available'
                                : 'No capacity constraints detected'}
                        </div>
                    )}
                </div>
            )}

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
