/**
 * Recruiter Workload Drawer
 *
 * Shows detailed workload breakdown for a single recruiter.
 */

import React from 'react';
import {
    RecruiterUtilizationRow,
    PrivacyMode,
    LOAD_STATUS_COLORS,
    LOAD_STATUS_LABELS
} from '../../types/rebalancerTypes';
import { Requisition, Candidate, CandidateDisposition } from '../../types/entities';
import { GlassDrawer } from '../common';

interface Props {
    recruiter: RecruiterUtilizationRow;
    requisitions: Requisition[];
    candidates: Candidate[];
    privacyMode: PrivacyMode;
    onClose: () => void;
}

export function RecruiterWorkloadDrawer({ recruiter, requisitions, candidates, privacyMode, onClose }: Props) {
    // Get open reqs for this recruiter
    const recruiterReqs = requisitions.filter(r =>
        r.recruiter_id === recruiter.recruiterId &&
        !r.closed_at
    );

    // Count active candidates per req
    const reqPipelines = recruiterReqs.map(req => {
        const activeCandidates = candidates.filter(c =>
            c.req_id === req.req_id &&
            (c.disposition === CandidateDisposition.Active || !c.disposition)
        );
        return {
            reqId: req.req_id,
            reqTitle: req.req_title ?? `Req ${req.req_id}`,
            candidateCount: activeCandidates.length
        };
    }).sort((a, b) => b.candidateCount - a.candidateCount);

    const displayName = privacyMode === 'anonymized'
        ? `Recruiter ${recruiter.recruiterId.substring(0, 4)}`
        : recruiter.recruiterName;

    return (
        <GlassDrawer
            title={`${displayName} Workload`}
            onClose={onClose}
            width="400px"
        >
            {/* Overall Status */}
            <div className="mb-4">
                <div className="flex justify-between items-center mb-2">
                    <span className="text-muted-foreground text-xs uppercase tracking-wide">
                        Overall Status
                    </span>
                    <span
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-xs"
                        style={{
                            background: `${LOAD_STATUS_COLORS[recruiter.status]}22`,
                            color: LOAD_STATUS_COLORS[recruiter.status],
                            border: `1px solid ${LOAD_STATUS_COLORS[recruiter.status]}44`
                        }}
                    >
                        {LOAD_STATUS_LABELS[recruiter.status]}
                    </span>
                </div>
                <div
                    className="p-3 rounded-md"
                    style={{
                        background: `${LOAD_STATUS_COLORS[recruiter.status]}11`,
                        border: `1px solid ${LOAD_STATUS_COLORS[recruiter.status]}33`
                    }}
                >
                    <div className="flex justify-between items-center">
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '1.5rem', fontWeight: 700, color: LOAD_STATUS_COLORS[recruiter.status] }}>
                            {Math.round(recruiter.utilization * 100)}%
                        </span>
                        <span
                            className="inline-flex items-center px-2 py-0.5 rounded-full"
                            style={{
                                fontSize: '0.6rem',
                                background: recruiter.confidence === 'HIGH'
                                    ? 'var(--color-good-bg)'
                                    : recruiter.confidence === 'MED'
                                        ? 'var(--color-warn-bg)'
                                        : 'var(--color-bg-overlay)',
                                color: recruiter.confidence === 'HIGH'
                                    ? 'var(--color-good)'
                                    : recruiter.confidence === 'MED'
                                        ? 'var(--color-warn)'
                                        : 'var(--text-secondary)'
                            }}
                        >
                            {recruiter.confidence}
                        </span>
                    </div>
                    <div className="text-muted-foreground text-xs">
                        {recruiter.totalDemand} candidates / {Math.round(recruiter.totalCapacity)}/wk capacity
                    </div>
                </div>
            </div>

            {/* Stage Breakdown */}
            <div className="mb-4">
                <div className="text-muted-foreground mb-2 text-xs uppercase tracking-wide">
                    Stage Breakdown
                </div>
                <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
                    <thead>
                        <tr>
                            <th>Stage</th>
                            <th style={{ textAlign: 'center' }}>Demand</th>
                            <th style={{ textAlign: 'center' }}>Capacity</th>
                            <th style={{ textAlign: 'center' }}>Util</th>
                        </tr>
                    </thead>
                    <tbody>
                        {recruiter.stageUtilization.map(stage => {
                            const statusColor = stage.utilization > 1.2 ? LOAD_STATUS_COLORS.critical
                                : stage.utilization > 1.1 ? LOAD_STATUS_COLORS.overloaded
                                    : stage.utilization > 0.9 ? LOAD_STATUS_COLORS.balanced
                                        : LOAD_STATUS_COLORS.available;
                            return (
                                <tr key={stage.stage}>
                                    <td>{stage.stageName}</td>
                                    <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)' }}>
                                        {stage.demand}
                                    </td>
                                    <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)' }}>
                                        {Math.round(stage.capacity)}/wk
                                    </td>
                                    <td style={{
                                        textAlign: 'center',
                                        fontFamily: 'var(--font-mono)',
                                        color: statusColor,
                                        fontWeight: 600
                                    }}>
                                        {Math.round(stage.utilization * 100)}%
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Open Requisitions */}
            <div>
                <div className="text-muted-foreground mb-2 text-xs uppercase tracking-wide">
                    Open Reqs ({recruiterReqs.length})
                </div>
                <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto">
                    {reqPipelines.length === 0 ? (
                        <div className="text-muted-foreground text-sm">No open requisitions</div>
                    ) : (
                        reqPipelines.map(req => (
                            <div
                                key={req.reqId}
                                className="flex justify-between items-center p-2 rounded-md"
                                style={{ background: 'var(--color-bg-overlay)' }}
                            >
                                <span className="text-sm">
                                    {req.reqTitle.length > 35 ? req.reqTitle.substring(0, 35) + '...' : req.reqTitle}
                                </span>
                                <span
                                    className="inline-flex items-center px-2 py-0.5 rounded text-xs"
                                    style={{
                                        background: 'var(--accent-bg)',
                                        color: 'var(--accent)'
                                    }}
                                >
                                    {req.candidateCount} candidates
                                </span>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Confidence Reasons */}
            {recruiter.confidenceReasons.length > 0 && (
                <div className="mt-4 pt-3 border-t border-glass-border">
                    <div className="text-muted-foreground mb-2 text-[0.7rem] uppercase tracking-wide">
                        Confidence Notes
                    </div>
                    <ul className="list-none m-0 p-0">
                        {recruiter.confidenceReasons.map((reason, i) => (
                            <li key={i} className="flex items-start gap-2 mb-1 text-xs">
                                <i className={`bi ${reason.impact === 'positive' ? 'bi-check-circle text-green-500' :
                                        reason.impact === 'negative' ? 'bi-exclamation-circle text-yellow-500' :
                                            'bi-info-circle text-muted-foreground'
                                    }`}></i>
                                <span className="text-muted-foreground">{reason.message}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </GlassDrawer>
    );
}
