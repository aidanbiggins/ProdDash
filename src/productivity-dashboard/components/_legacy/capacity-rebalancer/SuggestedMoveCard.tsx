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
} from '../../../types/rebalancerTypes';
import { getLoadStatus } from '../../../types/capacityTypes';

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
                background: isApplied ? 'var(--color-good-bg)' : 'var(--color-bg-overlay)',
                border: isApplied
                    ? '1px solid var(--color-good-border)'
                    : '1px solid var(--glass-border)',
                borderRadius: '0.5rem'
            }}
        >
            {/* Header */}
            <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                    <span
                        className="w-6 h-6 flex items-center justify-center rounded-full bg-blue-600 text-white text-xs"
                    >
                        #{rank}
                    </span>
                    <div>
                        <div className="font-semibold text-sm">
                            Move "{reqTitle.length > 30 ? reqTitle.substring(0, 30) + '...' : reqTitle}"
                        </div>
                        <div className="text-muted-foreground text-xs">
                            {privacyMode === 'anonymized' ? 'Recruiter A' : fromRecruiterName}
                            {' '}<i className="bi bi-arrow-right"></i>{' '}
                            {privacyMode === 'anonymized' ? 'Recruiter B' : toRecruiterName}
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {isApplied && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-green-600 text-white">
                            <i className="bi bi-check mr-1"></i>Applied
                        </span>
                    )}
                    <span
                        className="inline-flex items-center px-2 py-0.5 rounded-full"
                        style={{
                            fontSize: '0.6rem',
                            background: confidence === 'HIGH'
                                ? 'var(--color-good-bg)'
                                : confidence === 'MED'
                                    ? 'var(--color-warn-bg)'
                                    : 'var(--color-bg-overlay)',
                            color: confidence === 'HIGH'
                                ? 'var(--color-good)'
                                : confidence === 'MED'
                                    ? 'var(--color-warn)'
                                    : 'var(--text-secondary)'
                        }}
                    >
                        {confidence}
                    </span>
                </div>
            </div>

            {/* Rationale */}
            <p className="text-muted-foreground mb-3 text-xs">
                {rationale}
            </p>

            {/* Impact Table */}
            <div className="overflow-x-auto mb-3">
                <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
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
                            <td className="text-muted-foreground p-1">Source</td>
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
                                color: 'var(--color-good)'
                            }}>
                                -{sourceRelief}% <i className="bi bi-arrow-down"></i>
                            </td>
                        </tr>
                        <tr>
                            <td className="text-muted-foreground p-1">Target</td>
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
                                color: 'var(--color-warn)'
                            }}>
                                +{targetImpact}% <i className="bi bi-arrow-up"></i>
                            </td>
                        </tr>
                        {estimatedImpact.delayReductionDays > 0 && (
                            <tr>
                                <td className="text-muted-foreground p-1">Net Delay</td>
                                <td colSpan={2}></td>
                                <td style={{
                                    textAlign: 'center',
                                    fontFamily: 'var(--font-mono)',
                                    color: 'var(--color-good)',
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
            <div className="flex justify-end">
                <button
                    className="px-3 py-1 text-sm border border-gray-500 text-gray-300 rounded hover:bg-gray-700"
                    onClick={onViewDetails}
                >
                    View Details <i className="bi bi-chevron-right"></i>
                </button>
            </div>
        </div>
    );
}
