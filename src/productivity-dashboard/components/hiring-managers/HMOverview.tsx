// HM Overview Component
// Shows aggregated HM metrics with leaderboard and summary cards

import React, { useMemo, useState } from 'react';
import { HMRollup, HMDecisionBucket } from '../../types/hmTypes';
import { BUCKET_METADATA } from '../../config/hmStageTaxonomy';

interface HMOverviewProps {
    hmRollups: HMRollup[];
    onSelectHM: (hmUserId: string | null) => void;
    selectedHmUserId: string | null;
}

type SortField = 'hmName' | 'totalOpenReqs' | 'pendingActionsCount' | 'totalActiveCandidates';

export function HMOverview({ hmRollups, onSelectHM, selectedHmUserId }: HMOverviewProps) {
    const [sortField, setSortField] = useState<SortField>('pendingActionsCount');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

    // Calculate summary stats
    const summary = useMemo(() => {
        return {
            totalHMs: hmRollups.length,
            totalOpenReqs: hmRollups.reduce((sum, hm) => sum + hm.totalOpenReqs, 0),
            totalPendingActions: hmRollups.reduce((sum, hm) => sum + hm.pendingActionsCount, 0),
            totalActiveCandidates: hmRollups.reduce((sum, hm) => sum + hm.totalActiveCandidates, 0),
            hmsWithRiskFlags: hmRollups.filter(hm => hm.reqsWithRiskFlags > 0).length
        };
    }, [hmRollups]);

    // Sort HMs
    const sortedHMs = useMemo(() => {
        return [...hmRollups].sort((a, b) => {
            let aVal: string | number;
            let bVal: string | number;

            switch (sortField) {
                case 'hmName':
                    aVal = a.hmName.toLowerCase();
                    bVal = b.hmName.toLowerCase();
                    break;
                case 'totalOpenReqs':
                    aVal = a.totalOpenReqs;
                    bVal = b.totalOpenReqs;
                    break;
                case 'pendingActionsCount':
                    aVal = a.pendingActionsCount;
                    bVal = b.pendingActionsCount;
                    break;
                case 'totalActiveCandidates':
                    aVal = a.totalActiveCandidates;
                    bVal = b.totalActiveCandidates;
                    break;
            }

            if (typeof aVal === 'string' && typeof bVal === 'string') {
                return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
            }
            return sortDirection === 'asc'
                ? (aVal as number) - (bVal as number)
                : (bVal as number) - (aVal as number);
        });
    }, [hmRollups, sortField, sortDirection]);

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('desc');
        }
    };

    const SortHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
        <th
            onClick={() => handleSort(field)}
            style={{ cursor: 'pointer', userSelect: 'none' }}
        >
            {children}
            {sortField === field && (
                <span className="ms-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
            )}
        </th>
    );

    return (
        <div>
            {/* Summary Cards */}
            <div className="row g-3 mb-4">
                <div className="col-md-3">
                    <div className="card text-center">
                        <div className="card-body">
                            <h3 className="text-primary mb-0">{summary.totalHMs}</h3>
                            <small className="text-muted">Hiring Managers</small>
                        </div>
                    </div>
                </div>
                <div className="col-md-3">
                    <div className="card text-center">
                        <div className="card-body">
                            <h3 className="text-info mb-0">{summary.totalOpenReqs}</h3>
                            <small className="text-muted">Open Requisitions</small>
                        </div>
                    </div>
                </div>
                <div className="col-md-3">
                    <div className="card text-center">
                        <div className="card-body">
                            <h3 className="text-warning mb-0">{summary.totalPendingActions}</h3>
                            <small className="text-muted">Pending Actions</small>
                        </div>
                    </div>
                </div>
                <div className="col-md-3">
                    <div className="card text-center">
                        <div className="card-body">
                            <h3 className="text-success mb-0">{summary.totalActiveCandidates}</h3>
                            <small className="text-muted">Active Candidates</small>
                        </div>
                    </div>
                </div>
            </div>

            {/* HM Leaderboard */}
            <div className="card">
                <div className="card-header d-flex justify-content-between align-items-center">
                    <h6 className="mb-0">Hiring Manager Leaderboard</h6>
                    {selectedHmUserId && (
                        <button
                            className="btn btn-sm btn-outline-secondary"
                            onClick={() => onSelectHM(null)}
                        >
                            Clear Selection
                        </button>
                    )}
                </div>
                <div className="card-body p-0">
                    <div className="table-responsive">
                        <table className="table table-hover table-sm mb-0">
                            <thead className="table-light">
                                <tr>
                                    <SortHeader field="hmName">Hiring Manager</SortHeader>
                                    <th>Team</th>
                                    <SortHeader field="totalOpenReqs">Open Reqs</SortHeader>
                                    <SortHeader field="totalActiveCandidates">Active Candidates</SortHeader>
                                    <SortHeader field="pendingActionsCount">Pending Actions</SortHeader>
                                    <th>Feedback Due</th>
                                    <th>Review Due</th>
                                    <th>Reqs at Risk</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedHMs.map(hm => (
                                    <tr
                                        key={hm.hmUserId}
                                        onClick={() => onSelectHM(hm.hmUserId)}
                                        style={{ cursor: 'pointer' }}
                                        className={selectedHmUserId === hm.hmUserId ? 'table-primary' : ''}
                                    >
                                        <td className="fw-medium">{hm.hmName}</td>
                                        <td>{hm.team || '—'}</td>
                                        <td>{hm.totalOpenReqs}</td>
                                        <td>{hm.totalActiveCandidates}</td>
                                        <td>
                                            {hm.pendingActionsCount > 0 ? (
                                                <span className="badge bg-warning">{hm.pendingActionsCount}</span>
                                            ) : (
                                                <span className="text-muted">0</span>
                                            )}
                                        </td>
                                        <td>
                                            {hm.feedbackDueCount > 0 ? (
                                                <span className="badge bg-danger">{hm.feedbackDueCount}</span>
                                            ) : (
                                                <span className="text-muted">0</span>
                                            )}
                                        </td>
                                        <td>
                                            {hm.reviewDueCount > 0 ? (
                                                <span className="badge bg-warning">{hm.reviewDueCount}</span>
                                            ) : (
                                                <span className="text-muted">0</span>
                                            )}
                                        </td>
                                        <td>
                                            {hm.reqsWithRiskFlags > 0 ? (
                                                <span className="badge bg-danger">{hm.reqsWithRiskFlags}</span>
                                            ) : (
                                                <span className="text-success">✓</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                {sortedHMs.length === 0 && (
                                    <tr>
                                        <td colSpan={8} className="text-center text-muted py-4">
                                            No hiring managers found
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
