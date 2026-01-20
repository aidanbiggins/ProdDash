/**
 * Suggested Move Card
 *
 * Displays a single reassignment suggestion with impact preview.
 */

import React from 'react';
import {
    ReassignmentSuggestion,
    PrivacyMode,
    LOAD_STATUS_COLORS
} from '../../types/rebalancerTypes';
import { getLoadStatus } from '../../types/capacityTypes';

interface Props {
    suggestion: ReassignmentSuggestion;
    privacyMode: PrivacyMode;
    onViewDetails: () => void;
    isApplied: boolean;
}

export function SuggestedMoveCard({ suggestion, privacyMode, onViewDetails, isApplied }: Props) {
    const {
        rank,
        reqTitle,
        fromRecruiterName,
        toRecruiterName,
        rationale,
        estimatedImpact,
        confidence,
        hedgeMessage
    } = suggestion;

    const sourceStatusBefore = getLoadStatus(estimatedImpact.sourceUtilizationBefore);
    const sourceStatusAfter = getLoadStatus(estimatedImpact.sourceUtilizationAfter);
    const targetStatusBefore = getLoadStatus(estimatedImpact.targetUtilizationBefore);
    const targetStatusAfter = getLoadStatus(estimatedImpact.targetUtilizationAfter);

    const sourceRelief = Math.round((estimatedImpact.sourceUtilizationBefore - estimatedImpact.sourceUtilizationAfter) * 100);
    const targetImpact = Math.round((estimatedImpact.targetUtilizationAfter - estimatedImpact.targetUtilizationBefore) * 100);

    return (
        <div
            className="card-bespoke p-3"
            style={{
                background: isApplied ? 'rgba(16, 185, 129, 0.05)' : 'rgba(255, 255, 255, 0.02)',
                border: isApplied
                    ? '1px solid rgba(16, 185, 129, 0.3)'
                    : '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '0.5rem'
            }}
        >
            {/* Header */}
            <div className="d-flex justify-content-between align-items-start mb-2">
                <div className="d-flex align-items-center gap-2">
                    <span
                        className="badge bg-primary rounded-circle"
                        style={{ width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                        #{rank}
                    </span>
                    <div>
                        <div className="fw-semibold" style={{ fontSize: '0.85rem' }}>
                            Move "{reqTitle.length > 30 ? reqTitle.substring(0, 30) + '...' : reqTitle}"
                        </div>
                        <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                            {privacyMode === 'anonymized' ? 'Recruiter A' : fromRecruiterName}
                            {' '}<i className="bi bi-arrow-right"></i>{' '}
                            {privacyMode === 'anonymized' ? 'Recruiter B' : toRecruiterName}
                        </div>
                    </div>
                </div>
                <div className="d-flex align-items-center gap-2">
                    {isApplied && (
                        <span className="badge bg-success" style={{ fontSize: '0.65rem' }}>
                            <i className="bi bi-check me-1"></i>Applied
                        </span>
                    )}
                    <span
                        className="badge rounded-pill"
                        style={{
                            fontSize: '0.6rem',
                            background: confidence === 'HIGH'
                                ? 'rgba(16, 185, 129, 0.15)'
                                : confidence === 'MED'
                                    ? 'rgba(245, 158, 11, 0.15)'
                                    : 'rgba(148, 163, 184, 0.15)',
                            color: confidence === 'HIGH'
                                ? '#10b981'
                                : confidence === 'MED'
                                    ? '#f59e0b'
                                    : '#94a3b8'
                        }}
                    >
                        {confidence}
                    </span>
                </div>
            </div>

            {/* Rationale */}
            <p className="text-muted mb-3" style={{ fontSize: '0.75rem' }}>
                {rationale}
            </p>

            {/* Impact Table */}
            <div className="table-responsive mb-3">
                <table className="table table-sm mb-0" style={{ fontSize: '0.7rem' }}>
                    <thead>
                        <tr>
                            <th style={{ width: '30%' }}></th>
                            <th style={{ textAlign: 'center' }}>Before</th>
                            <th style={{ textAlign: 'center' }}>After</th>
                            <th style={{ textAlign: 'center' }}>Delta</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td className="text-muted">Source</td>
                            <td style={{
                                textAlign: 'center',
                                fontFamily: 'var(--font-mono)',
                                color: LOAD_STATUS_COLORS[sourceStatusBefore]
                            }}>
                                {Math.round(estimatedImpact.sourceUtilizationBefore * 100)}%
                            </td>
                            <td style={{
                                textAlign: 'center',
                                fontFamily: 'var(--font-mono)',
                                color: LOAD_STATUS_COLORS[sourceStatusAfter]
                            }}>
                                {Math.round(estimatedImpact.sourceUtilizationAfter * 100)}%
                            </td>
                            <td style={{
                                textAlign: 'center',
                                fontFamily: 'var(--font-mono)',
                                color: '#10b981'
                            }}>
                                -{sourceRelief}% <i className="bi bi-arrow-down"></i>
                            </td>
                        </tr>
                        <tr>
                            <td className="text-muted">Target</td>
                            <td style={{
                                textAlign: 'center',
                                fontFamily: 'var(--font-mono)',
                                color: LOAD_STATUS_COLORS[targetStatusBefore]
                            }}>
                                {Math.round(estimatedImpact.targetUtilizationBefore * 100)}%
                            </td>
                            <td style={{
                                textAlign: 'center',
                                fontFamily: 'var(--font-mono)',
                                color: LOAD_STATUS_COLORS[targetStatusAfter]
                            }}>
                                {Math.round(estimatedImpact.targetUtilizationAfter * 100)}%
                            </td>
                            <td style={{
                                textAlign: 'center',
                                fontFamily: 'var(--font-mono)',
                                color: '#f59e0b'
                            }}>
                                +{targetImpact}% <i className="bi bi-arrow-up"></i>
                            </td>
                        </tr>
                        {estimatedImpact.delayReductionDays > 0 && (
                            <tr>
                                <td className="text-muted">Net Delay</td>
                                <td colSpan={2}></td>
                                <td style={{
                                    textAlign: 'center',
                                    fontFamily: 'var(--font-mono)',
                                    color: '#10b981',
                                    fontWeight: 600
                                }}>
                                    -{estimatedImpact.delayReductionDays.toFixed(1)}d
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Actions */}
            <div className="d-flex justify-content-end">
                <button
                    className="btn btn-sm btn-outline-secondary"
                    onClick={onViewDetails}
                >
                    View Details <i className="bi bi-chevron-right"></i>
                </button>
            </div>
        </div>
    );
}
