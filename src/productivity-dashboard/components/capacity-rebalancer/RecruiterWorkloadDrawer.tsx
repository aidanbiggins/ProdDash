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
                <div className="d-flex justify-content-between align-items-center mb-2">
                    <span className="text-muted" style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Overall Status
                    </span>
                    <span
                        className="badge rounded-pill"
                        style={{
                            fontSize: '0.7rem',
                            background: `${LOAD_STATUS_COLORS[recruiter.status]}22`,
                            color: LOAD_STATUS_COLORS[recruiter.status],
                            border: `1px solid ${LOAD_STATUS_COLORS[recruiter.status]}44`
                        }}
                    >
                        {LOAD_STATUS_LABELS[recruiter.status]}
                    </span>
                </div>
                <div
                    className="p-3 rounded"
                    style={{
                        background: `${LOAD_STATUS_COLORS[recruiter.status]}11`,
                        border: `1px solid ${LOAD_STATUS_COLORS[recruiter.status]}33`
                    }}
                >
                    <div className="d-flex justify-content-between align-items-center">
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '1.5rem', fontWeight: 700, color: LOAD_STATUS_COLORS[recruiter.status] }}>
                            {Math.round(recruiter.utilization * 100)}%
                        </span>
                        <span
                            className="badge rounded-pill"
                            style={{
                                fontSize: '0.6rem',
                                background: recruiter.confidence === 'HIGH'
                                    ? 'rgba(16, 185, 129, 0.15)'
                                    : recruiter.confidence === 'MED'
                                        ? 'rgba(245, 158, 11, 0.15)'
                                        : 'rgba(148, 163, 184, 0.15)',
                                color: recruiter.confidence === 'HIGH'
                                    ? '#10b981'
                                    : recruiter.confidence === 'MED'
                                        ? '#f59e0b'
                                        : '#94a3b8'
                            }}
                        >
                            {recruiter.confidence}
                        </span>
                    </div>
                    <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                        {recruiter.totalDemand} candidates / {Math.round(recruiter.totalCapacity)}/wk capacity
                    </div>
                </div>
            </div>

            {/* Stage Breakdown */}
            <div className="mb-4">
                <div className="text-muted mb-2" style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Stage Breakdown
                </div>
                <table className="table table-sm mb-0" style={{ fontSize: '0.75rem' }}>
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
                <div className="text-muted mb-2" style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Open Reqs ({recruiterReqs.length})
                </div>
                <div className="d-flex flex-column gap-2" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                    {reqPipelines.length === 0 ? (
                        <div className="text-muted small">No open requisitions</div>
                    ) : (
                        reqPipelines.map(req => (
                            <div
                                key={req.reqId}
                                className="d-flex justify-content-between align-items-center p-2 rounded"
                                style={{ background: 'rgba(255, 255, 255, 0.03)' }}
                            >
                                <span style={{ fontSize: '0.8rem' }}>
                                    {req.reqTitle.length > 35 ? req.reqTitle.substring(0, 35) + '...' : req.reqTitle}
                                </span>
                                <span
                                    className="badge"
                                    style={{
                                        fontSize: '0.7rem',
                                        background: 'rgba(6, 182, 212, 0.15)',
                                        color: '#06b6d4'
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
                <div className="mt-4 pt-3 border-top" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
                    <div className="text-muted mb-2" style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Confidence Notes
                    </div>
                    <ul className="list-unstyled mb-0">
                        {recruiter.confidenceReasons.map((reason, i) => (
                            <li key={i} className="d-flex align-items-start gap-2 mb-1" style={{ fontSize: '0.75rem' }}>
                                <i className={`bi ${reason.impact === 'positive' ? 'bi-check-circle text-success' :
                                        reason.impact === 'negative' ? 'bi-exclamation-circle text-warning' :
                                            'bi-info-circle text-muted'
                                    }`}></i>
                                <span className="text-muted">{reason.message}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </GlassDrawer>
    );
}
