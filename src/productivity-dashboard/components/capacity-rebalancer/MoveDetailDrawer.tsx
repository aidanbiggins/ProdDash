/**
 * Move Detail Drawer
 *
 * Shows detailed impact analysis for a suggested move.
 */

import React from 'react';
import {
    ReassignmentSuggestion,
    SimulatedMoveImpact,
    PrivacyMode,
    LOAD_STATUS_COLORS,
    LOAD_STATUS_LABELS
} from '../../types/rebalancerTypes';
import { CanonicalStage } from '../../types/entities';
import { ORACLE_CAPACITY_STAGE_LABELS } from '../../types/capacityTypes';
import { GlassDrawer } from '../common';

interface Props {
    suggestion: ReassignmentSuggestion;
    impact: SimulatedMoveImpact;
    privacyMode: PrivacyMode;
    onClose: () => void;
    onApply: () => void;
    isApplied: boolean;
}

export function MoveDetailDrawer({ suggestion, impact, privacyMode, onClose, onApply, isApplied }: Props) {
    const displayFromName = privacyMode === 'anonymized' ? 'Recruiter A' : suggestion.fromRecruiterName;
    const displayToName = privacyMode === 'anonymized' ? 'Recruiter B' : suggestion.toRecruiterName;

    return (
        <GlassDrawer
            title={`Move Detail: ${suggestion.reqTitle.substring(0, 25)}...`}
            onClose={onClose}
            width="450px"
        >
            {/* Req Info */}
            <div className="mb-4">
                <div className="text-muted mb-1" style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Requisition
                </div>
                <div className="fw-semibold" style={{ fontSize: '0.9rem' }}>
                    {suggestion.reqTitle}
                </div>
                <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                    {suggestion.reqId}
                </div>
            </div>

            {/* Move Direction */}
            <div className="d-flex align-items-center justify-content-center gap-3 mb-4 p-3 rounded" style={{ background: 'var(--accent-bg)', border: '1px solid var(--glass-border-accent)' }}>
                <div className="text-center">
                    <div className="text-muted small">From</div>
                    <div className="fw-semibold">{displayFromName}</div>
                </div>
                <i className="bi bi-arrow-right text-primary" style={{ fontSize: '1.5rem' }}></i>
                <div className="text-center">
                    <div className="text-muted small">To</div>
                    <div className="fw-semibold">{displayToName}</div>
                </div>
            </div>

            {/* Pipeline Being Moved */}
            <div className="mb-4">
                <div className="text-muted mb-2" style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Pipeline Being Moved ({impact.move.totalCandidates} candidates)
                </div>
                <div className="d-flex flex-wrap gap-2">
                    {Object.entries(suggestion.reqDemand).map(([stage, count]) => (
                        <span
                            key={stage}
                            className="badge"
                            style={{
                                fontSize: '0.7rem',
                                background: 'var(--color-bg-overlay)',
                                border: '1px solid var(--glass-border)'
                            }}
                        >
                            {count} at {ORACLE_CAPACITY_STAGE_LABELS[stage] || stage}
                        </span>
                    ))}
                </div>
            </div>

            {/* Impact Analysis */}
            <div className="mb-4">
                <div className="text-muted mb-2" style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Impact Analysis
                </div>

                {/* Source Impact */}
                <div className="p-3 rounded mb-2" style={{ background: 'var(--color-good-bg)', border: '1px solid var(--color-good-border)' }}>
                    <div className="d-flex justify-content-between align-items-center mb-2">
                        <span className="text-muted small">{displayFromName} (Source)</span>
                        <span className="text-success small">
                            <i className="bi bi-arrow-down me-1"></i>
                            Relief
                        </span>
                    </div>
                    <div className="row g-3">
                        <div className="col-4 text-center">
                            <div className="text-muted small">Before</div>
                            <div style={{
                                fontFamily: 'var(--font-mono)',
                                fontWeight: 600,
                                color: LOAD_STATUS_COLORS[impact.beforeSource.status]
                            }}>
                                {Math.round(impact.beforeSource.utilization * 100)}%
                            </div>
                            <div className="small text-muted">{LOAD_STATUS_LABELS[impact.beforeSource.status]}</div>
                        </div>
                        <div className="col-4 text-center">
                            <div className="text-muted small">After</div>
                            <div style={{
                                fontFamily: 'var(--font-mono)',
                                fontWeight: 600,
                                color: LOAD_STATUS_COLORS[impact.afterSource.status]
                            }}>
                                {Math.round(impact.afterSource.utilization * 100)}%
                            </div>
                            <div className="small text-muted">{LOAD_STATUS_LABELS[impact.afterSource.status]}</div>
                        </div>
                        <div className="col-4 text-center">
                            <div className="text-muted small">Queue Delay</div>
                            <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-good)' }}>
                                -{(impact.beforeSource.queueDelayDays - impact.afterSource.queueDelayDays).toFixed(1)}d
                            </div>
                        </div>
                    </div>
                </div>

                {/* Target Impact */}
                <div className="p-3 rounded" style={{ background: 'var(--color-warn-bg)', border: '1px solid var(--color-warn-border)' }}>
                    <div className="d-flex justify-content-between align-items-center mb-2">
                        <span className="text-muted small">{displayToName} (Target)</span>
                        <span className="text-warning small">
                            <i className="bi bi-arrow-up me-1"></i>
                            Impact
                        </span>
                    </div>
                    <div className="row g-3">
                        <div className="col-4 text-center">
                            <div className="text-muted small">Before</div>
                            <div style={{
                                fontFamily: 'var(--font-mono)',
                                fontWeight: 600,
                                color: LOAD_STATUS_COLORS[impact.beforeTarget.status]
                            }}>
                                {Math.round(impact.beforeTarget.utilization * 100)}%
                            </div>
                            <div className="small text-muted">{LOAD_STATUS_LABELS[impact.beforeTarget.status]}</div>
                        </div>
                        <div className="col-4 text-center">
                            <div className="text-muted small">After</div>
                            <div style={{
                                fontFamily: 'var(--font-mono)',
                                fontWeight: 600,
                                color: LOAD_STATUS_COLORS[impact.afterTarget.status]
                            }}>
                                {Math.round(impact.afterTarget.utilization * 100)}%
                            </div>
                            <div className="small text-muted">{LOAD_STATUS_LABELS[impact.afterTarget.status]}</div>
                        </div>
                        <div className="col-4 text-center">
                            <div className="text-muted small">Queue Delay</div>
                            <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-warn)' }}>
                                +{(impact.afterTarget.queueDelayDays - impact.beforeTarget.queueDelayDays).toFixed(1)}d
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Net Impact */}
            <div className="p-3 rounded mb-4" style={{ background: 'var(--accent-bg)', border: '1px solid var(--glass-border-accent)' }}>
                <div className="d-flex justify-content-between align-items-center">
                    <div>
                        <div className="text-muted small">Net System Improvement</div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.25rem', fontWeight: 700, color: 'var(--accent)' }}>
                            {impact.netImpact.delayReductionDays > 0 ? '-' : '+'}
                            {Math.abs(impact.netImpact.delayReductionDays).toFixed(1)}d
                        </div>
                    </div>
                    <span
                        className="badge rounded-pill"
                        style={{
                            fontSize: '0.65rem',
                            background: impact.confidence === 'HIGH'
                                ? 'var(--color-good-bg)'
                                : impact.confidence === 'MED'
                                    ? 'var(--color-warn-bg)'
                                    : 'var(--color-bg-overlay)',
                            color: impact.confidence === 'HIGH'
                                ? 'var(--color-good)'
                                : impact.confidence === 'MED'
                                    ? 'var(--color-warn)'
                                    : 'var(--text-secondary)'
                        }}
                    >
                        {impact.confidence}
                    </span>
                </div>
                <div className="text-muted small mt-1">{impact.hedgeMessage}</div>
            </div>

            {/* Actions */}
            <div className="d-flex gap-2">
                <button
                    className="btn btn-primary flex-grow-1"
                    onClick={onApply}
                    disabled={isApplied}
                >
                    {isApplied ? (
                        <>
                            <i className="bi bi-check-lg me-1"></i>
                            Applied
                        </>
                    ) : (
                        <>
                            <i className="bi bi-check-lg me-1"></i>
                            Apply This Move
                        </>
                    )}
                </button>
                <button className="btn btn-outline-secondary" onClick={onClose}>
                    Close
                </button>
            </div>

            <p className="text-muted small mt-3 mb-0">
                <i className="bi bi-info-circle me-1"></i>
                Applying creates action items in the Unified Action Queue. No ATS changes are made automatically.
            </p>
        </GlassDrawer>
    );
}
