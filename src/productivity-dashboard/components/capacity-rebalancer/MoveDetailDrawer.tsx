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
                <div className="text-muted-foreground mb-1 text-[0.7rem] uppercase tracking-wide">
                    Requisition
                </div>
                <div className="font-semibold text-sm">
                    {suggestion.reqTitle}
                </div>
                <div className="text-muted-foreground text-xs">
                    {suggestion.reqId}
                </div>
            </div>

            {/* Move Direction */}
            <div className="flex items-center justify-center gap-3 mb-4 p-3 rounded-md" style={{ background: 'var(--accent-bg)', border: '1px solid var(--glass-border-accent)' }}>
                <div className="text-center">
                    <div className="text-muted-foreground text-sm">From</div>
                    <div className="font-semibold">{displayFromName}</div>
                </div>
                <i className="bi bi-arrow-right text-blue-500 text-2xl"></i>
                <div className="text-center">
                    <div className="text-muted-foreground text-sm">To</div>
                    <div className="font-semibold">{displayToName}</div>
                </div>
            </div>

            {/* Pipeline Being Moved */}
            <div className="mb-4">
                <div className="text-muted-foreground mb-2 text-[0.7rem] uppercase tracking-wide">
                    Pipeline Being Moved ({impact.move.totalCandidates} candidates)
                </div>
                <div className="flex flex-wrap gap-2">
                    {Object.entries(suggestion.reqDemand).map(([stage, count]) => (
                        <span
                            key={stage}
                            className="inline-flex items-center px-2 py-0.5 rounded text-xs"
                            style={{
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
                <div className="text-muted-foreground mb-2 text-[0.7rem] uppercase tracking-wide">
                    Impact Analysis
                </div>

                {/* Source Impact */}
                <div className="p-3 rounded-md mb-2" style={{ background: 'var(--color-good-bg)', border: '1px solid var(--color-good-border)' }}>
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-muted-foreground text-sm">{displayFromName} (Source)</span>
                        <span className="text-green-500 text-sm">
                            <i className="bi bi-arrow-down mr-1"></i>
                            Relief
                        </span>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                        <div className="text-center">
                            <div className="text-muted-foreground text-sm">Before</div>
                            <div style={{
                                fontFamily: 'var(--font-mono)',
                                fontWeight: 600,
                                color: LOAD_STATUS_COLORS[impact.beforeSource.status]
                            }}>
                                {Math.round(impact.beforeSource.utilization * 100)}%
                            </div>
                            <div className="text-sm text-muted-foreground">{LOAD_STATUS_LABELS[impact.beforeSource.status]}</div>
                        </div>
                        <div className="text-center">
                            <div className="text-muted-foreground text-sm">After</div>
                            <div style={{
                                fontFamily: 'var(--font-mono)',
                                fontWeight: 600,
                                color: LOAD_STATUS_COLORS[impact.afterSource.status]
                            }}>
                                {Math.round(impact.afterSource.utilization * 100)}%
                            </div>
                            <div className="text-sm text-muted-foreground">{LOAD_STATUS_LABELS[impact.afterSource.status]}</div>
                        </div>
                        <div className="text-center">
                            <div className="text-muted-foreground text-sm">Queue Delay</div>
                            <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-good)' }}>
                                -{(impact.beforeSource.queueDelayDays - impact.afterSource.queueDelayDays).toFixed(1)}d
                            </div>
                        </div>
                    </div>
                </div>

                {/* Target Impact */}
                <div className="p-3 rounded-md" style={{ background: 'var(--color-warn-bg)', border: '1px solid var(--color-warn-border)' }}>
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-muted-foreground text-sm">{displayToName} (Target)</span>
                        <span className="text-yellow-500 text-sm">
                            <i className="bi bi-arrow-up mr-1"></i>
                            Impact
                        </span>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                        <div className="text-center">
                            <div className="text-muted-foreground text-sm">Before</div>
                            <div style={{
                                fontFamily: 'var(--font-mono)',
                                fontWeight: 600,
                                color: LOAD_STATUS_COLORS[impact.beforeTarget.status]
                            }}>
                                {Math.round(impact.beforeTarget.utilization * 100)}%
                            </div>
                            <div className="text-sm text-muted-foreground">{LOAD_STATUS_LABELS[impact.beforeTarget.status]}</div>
                        </div>
                        <div className="text-center">
                            <div className="text-muted-foreground text-sm">After</div>
                            <div style={{
                                fontFamily: 'var(--font-mono)',
                                fontWeight: 600,
                                color: LOAD_STATUS_COLORS[impact.afterTarget.status]
                            }}>
                                {Math.round(impact.afterTarget.utilization * 100)}%
                            </div>
                            <div className="text-sm text-muted-foreground">{LOAD_STATUS_LABELS[impact.afterTarget.status]}</div>
                        </div>
                        <div className="text-center">
                            <div className="text-muted-foreground text-sm">Queue Delay</div>
                            <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-warn)' }}>
                                +{(impact.afterTarget.queueDelayDays - impact.beforeTarget.queueDelayDays).toFixed(1)}d
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Net Impact */}
            <div className="p-3 rounded-md mb-4" style={{ background: 'var(--accent-bg)', border: '1px solid var(--glass-border-accent)' }}>
                <div className="flex justify-between items-center">
                    <div>
                        <div className="text-muted-foreground text-sm">Net System Improvement</div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.25rem', fontWeight: 700, color: 'var(--accent)' }}>
                            {impact.netImpact.delayReductionDays > 0 ? '-' : '+'}
                            {Math.abs(impact.netImpact.delayReductionDays).toFixed(1)}d
                        </div>
                    </div>
                    <span
                        className="inline-flex items-center px-2 py-0.5 rounded-full"
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
                <div className="text-muted-foreground text-sm mt-1">{impact.hedgeMessage}</div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
                <button
                    className="grow px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                    onClick={onApply}
                    disabled={isApplied}
                >
                    {isApplied ? (
                        <>
                            <i className="bi bi-check-lg mr-1"></i>
                            Applied
                        </>
                    ) : (
                        <>
                            <i className="bi bi-check-lg mr-1"></i>
                            Apply This Move
                        </>
                    )}
                </button>
                <button className="px-4 py-2 border border-gray-500 text-gray-300 rounded-md hover:bg-gray-700" onClick={onClose}>
                    Close
                </button>
            </div>

            <p className="text-muted-foreground text-sm mt-3 mb-0">
                <i className="bi bi-info-circle mr-1"></i>
                Applying creates action items in the Unified Action Queue. No ATS changes are made automatically.
            </p>
        </GlassDrawer>
    );
}
