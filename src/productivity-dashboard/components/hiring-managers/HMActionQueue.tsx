// HM Action Queue Component
// Displays pending actions grouped by type, sortable by days overdue

import React, { useMemo, useState } from 'react';
import { HMPendingAction, HMActionType } from '../../types/hmTypes';

interface HMActionQueueProps {
    actions: HMPendingAction[];
    selectedHmUserId?: string | null;
}

const ACTION_TYPE_META: Record<HMActionType, { label: string; color: string; icon: string }> = {
    [HMActionType.FEEDBACK_DUE]: {
        label: 'Feedback Due',
        color: 'danger',
        icon: '📝'
    },
    [HMActionType.REVIEW_DUE]: {
        label: 'Review Due',
        color: 'warning',
        icon: '👀'
    },
    [HMActionType.DECISION_DUE]: {
        label: 'Decision Due',
        color: 'info',
        icon: '✅'
    }
};

type SortField = 'daysOverdue' | 'hmName' | 'reqTitle' | 'actionType';

export function HMActionQueue({ actions, selectedHmUserId }: HMActionQueueProps) {
    const [sortField, setSortField] = useState<SortField>('daysOverdue');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
    const [filterType, setFilterType] = useState<HMActionType | 'ALL'>('ALL');

    // Filter
    const filteredActions = useMemo(() => {
        if (filterType === 'ALL') return actions;
        return actions.filter(a => a.actionType === filterType);
    }, [actions, filterType]);

    // Sort
    const sortedActions = useMemo(() => {
        return [...filteredActions].sort((a, b) => {
            let aVal: string | number;
            let bVal: string | number;

            switch (sortField) {
                case 'daysOverdue':
                    aVal = a.daysOverdue;
                    bVal = b.daysOverdue;
                    break;
                case 'hmName':
                    aVal = a.hmName.toLowerCase();
                    bVal = b.hmName.toLowerCase();
                    break;
                case 'reqTitle':
                    aVal = a.reqTitle.toLowerCase();
                    bVal = b.reqTitle.toLowerCase();
                    break;
                case 'actionType':
                    aVal = a.actionType;
                    bVal = b.actionType;
                    break;
            }

            if (typeof aVal === 'string' && typeof bVal === 'string') {
                return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
            }
            return sortDirection === 'asc'
                ? (aVal as number) - (bVal as number)
                : (bVal as number) - (aVal as number);
        });
    }, [filteredActions, sortField, sortDirection]);

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('desc');
        }
    };

    // Count by type
    const countByType = useMemo(() => {
        const counts: Record<HMActionType, number> = {
            [HMActionType.FEEDBACK_DUE]: 0,
            [HMActionType.REVIEW_DUE]: 0,
            [HMActionType.DECISION_DUE]: 0
        };
        for (const action of actions) {
            counts[action.actionType]++;
        }
        return counts;
    }, [actions]);

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
                {Object.entries(ACTION_TYPE_META).map(([type, meta]) => (
                    <div className="col-md-4" key={type}>
                        <div
                            className={`card ${filterType === type ? 'border-primary border-2' : ''}`}
                            style={{ cursor: 'pointer' }}
                            onClick={() => setFilterType(filterType === type as HMActionType ? 'ALL' : type as HMActionType)}
                        >
                            <div className="card-body text-center">
                                <span className="fs-4">{meta.icon}</span>
                                <h3 className={`text-${meta.color} mb-0`}>
                                    {countByType[type as HMActionType]}
                                </h3>
                                <small className="text-muted">{meta.label}</small>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Filter indicator */}
            {filterType !== 'ALL' && (
                <div className="alert alert-info d-flex justify-content-between align-items-center mb-3">
                    <span>
                        Showing: <strong>{ACTION_TYPE_META[filterType].label}</strong> ({countByType[filterType]} items)
                    </span>
                    <button
                        className="btn btn-sm btn-outline-info"
                        onClick={() => setFilterType('ALL')}
                    >
                        Show All
                    </button>
                </div>
            )}

            {/* Actions Table */}
            <div className="card">
                <div className="card-header">
                    <h6 className="mb-0">Pending Actions Queue</h6>
                </div>
                <div className="card-body p-0">
                    <div className="table-responsive">
                        <table className="table table-hover table-sm mb-0">
                            <thead className="table-light">
                                <tr>
                                    <SortHeader field="actionType">Type</SortHeader>
                                    {!selectedHmUserId && <SortHeader field="hmName">Hiring Manager</SortHeader>}
                                    <SortHeader field="reqTitle">Requisition</SortHeader>
                                    <th>Candidate</th>
                                    <th>Trigger Date</th>
                                    <th>Days Waiting</th>
                                    <SortHeader field="daysOverdue">Days Overdue</SortHeader>
                                    <th>Suggested Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedActions.map((action, idx) => {
                                    const meta = ACTION_TYPE_META[action.actionType];
                                    return (
                                        <tr
                                            key={`${action.reqId}-${action.candidateId}-${action.actionType}-${idx}`}
                                            className={action.daysOverdue > 5 ? 'table-danger' : action.daysOverdue > 0 ? 'table-warning' : ''}
                                        >
                                            <td>
                                                <span className={`badge bg-${meta.color}`}>
                                                    {meta.icon} {meta.label}
                                                </span>
                                            </td>
                                            {!selectedHmUserId && <td>{action.hmName}</td>}
                                            <td>
                                                <div className="fw-medium">{action.reqTitle}</div>
                                                <small className="text-muted">{action.reqId}</small>
                                            </td>
                                            <td>{action.candidateName}</td>
                                            <td>{action.triggerDate.toLocaleDateString()}</td>
                                            <td>{action.daysWaiting}d</td>
                                            <td>
                                                {action.daysOverdue > 0 ? (
                                                    <span className="badge bg-danger">{action.daysOverdue}d overdue</span>
                                                ) : (
                                                    <span className="text-muted">Not yet</span>
                                                )}
                                            </td>
                                            <td>
                                                <small className="text-muted">{action.suggestedAction}</small>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {sortedActions.length === 0 && (
                                    <tr>
                                        <td colSpan={8} className="text-center text-muted py-4">
                                            {actions.length === 0 ? (
                                                <div>
                                                    <span className="fs-4">🎉</span>
                                                    <div>No pending actions!</div>
                                                </div>
                                            ) : (
                                                'No actions match the current filter'
                                            )}
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
