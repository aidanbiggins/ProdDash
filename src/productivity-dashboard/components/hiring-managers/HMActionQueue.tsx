// HM Action Queue Component
// Shows pending actions for HM attention (feedback due, reviews, etc)

import React, { useMemo, useState } from 'react';
import { HMPendingAction, HMActionType } from '../../types/hmTypes';

interface HMActionQueueProps {
    actions: HMPendingAction[];
    selectedHmUserIds?: Set<string>;
}

type SortField = 'actionType' | 'daysOverdue' | 'reqTitle' | 'hmName' | 'daysWaiting';
type SortDirection = 'asc' | 'desc';

// Metadata for action types - MUST match HMActionType enum in hmTypes.ts
const ACTION_TYPE_META: Record<HMActionType, { label: string; icon: string; color: string }> = {
    [HMActionType.FEEDBACK_DUE]: {
        label: 'Feedback Due',
        icon: '💬',
        color: 'danger'
    },
    [HMActionType.REVIEW_DUE]: {
        label: 'Resume Review',
        icon: '👀',
        color: 'warning'
    },
    [HMActionType.DECISION_DUE]: {
        label: 'Decision Needed',
        icon: '⚖️',
        color: 'primary'
    }
};

export function HMActionQueue({ actions, selectedHmUserIds }: HMActionQueueProps) {
    const [filterType, setFilterType] = useState<HMActionType | 'ALL'>('ALL');
    const [sortField, setSortField] = useState<SortField>('daysOverdue');
    const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

    // Count by type
    const countByType = useMemo(() => {
        const counts: Record<string, number> = {};
        Object.values(HMActionType).forEach(t => counts[t] = 0);

        actions.forEach(a => {
            counts[a.actionType] = (counts[a.actionType] || 0) + 1;
        });
        return counts;
    }, [actions]);

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
                case 'actionType':
                    aVal = a.actionType;
                    bVal = b.actionType;
                    break;
                case 'reqTitle':
                    aVal = a.reqTitle;
                    bVal = b.reqTitle;
                    break;
                case 'hmName':
                    aVal = a.hmName;
                    bVal = b.hmName;
                    break;
                case 'daysWaiting':
                    aVal = a.daysWaiting;
                    bVal = b.daysWaiting;
                    break;
                case 'daysOverdue':
                default:
                    aVal = a.daysOverdue;
                    bVal = b.daysOverdue;
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

    // Determine if we should show the HM column
    const showHmColumn = !selectedHmUserIds || selectedHmUserIds.size === 0 || selectedHmUserIds.size > 1;

    // Header style matching Recruiter Leaderboard
    const thStyle = {
        borderBottom: '2px solid var(--color-slate-200)',
        padding: '0.625rem 0.5rem',
        fontSize: '0.7rem',
        fontWeight: 600,
        textTransform: 'uppercase' as const,
        letterSpacing: '0.03em',
        color: 'var(--color-slate-600)',
        whiteSpace: 'nowrap' as const
    };

    // Sortable header style
    const sortableThStyle = (field: SortField) => ({
        ...thStyle,
        cursor: 'pointer',
        userSelect: 'none' as const,
        color: sortField === field ? 'var(--color-accent)' : 'var(--color-slate-600)'
    });

    // Cell style
    const tdStyle = {
        padding: '0.5rem',
        borderBottom: '1px solid var(--color-slate-100)',
        color: 'var(--color-slate-700)',
        fontSize: '0.85rem'
    };

    return (
        <div className="animate-fade-in">
            {/* Summary Cards */}
            <div className="row g-4 mb-4">
                {Object.entries(ACTION_TYPE_META).map(([type, meta]) => {
                    const count = countByType[type as HMActionType] || 0;
                    const isActive = filterType === type;

                    return (
                        <div className="col-md-4" key={type}>
                            <div
                                className={`glass-panel p-3 text-center cursor-pointer transition-base h-100 d-flex flex-column justify-content-center`}
                                onClick={() => setFilterType(filterType === type as HMActionType ? 'ALL' : type as HMActionType)}
                                style={{
                                    borderColor: isActive ? `var(--color-${meta.color})` : undefined,
                                    backgroundColor: isActive ? 'white' : undefined,
                                    boxShadow: isActive ? 'var(--shadow-md)' : undefined,
                                    border: isActive ? `2px solid var(--color-${meta.color})` : undefined
                                }}
                            >
                                <div className="fs-3 mb-2">{meta.icon}</div>
                                <h3 className={`mb-0 text-${meta.color}`}>{count}</h3>
                                <div className="text-muted small fw-medium text-uppercase tracking-wide mt-1">{meta.label}</div>
                                {isActive && <div className="mt-2 badge bg-slate-100 text-slate-600 rounded-pill">Active Filter</div>}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Filter indicator */}
            {filterType !== 'ALL' && (
                <div className="d-flex justify-content-between align-items-center mb-4 bg-slate-50 border border-slate-200 rounded p-3">
                    <div className="d-flex align-items-center">
                        <span style={{ color: 'var(--color-slate-500)', marginRight: '0.5rem' }}>🔽</span>
                        <span>
                            Showing: <strong>{ACTION_TYPE_META[filterType].label}</strong>
                            <span className="badge bg-slate-200 text-slate-700 ms-2">{countByType[filterType]} items</span>
                        </span>
                    </div>
                    <button
                        className="btn btn-sm btn-outline-secondary"
                        onClick={() => setFilterType('ALL')}
                    >
                        Clear Filter
                    </button>
                </div>
            )}

            {/* Actions Table */}
            <div className="card-bespoke">
                <div className="card-header d-flex justify-content-between align-items-center">
                    <h6 className="mb-0">Pending Actions Queue</h6>
                    <span className="badge bg-slate-200 text-slate-600">{sortedActions.length} actions</span>
                </div>
                <div className="card-body p-0">
                    <div className="table-responsive">
                        <table className="table table-hover mb-0" style={{ tableLayout: 'fixed', minWidth: '900px' }}>
                            <thead>
                                <tr style={{ background: 'var(--color-slate-50, #f8fafc)' }}>
                                    <th
                                        style={{ width: '120px', ...sortableThStyle('actionType') }}
                                        onClick={() => handleSort('actionType')}
                                    >
                                        Type
                                        {sortField === 'actionType' && <span style={{ marginLeft: '2px', fontSize: '0.6rem' }}>{sortDirection === 'desc' ? '▼' : '▲'}</span>}
                                    </th>
                                    {showHmColumn && (
                                        <th
                                            style={{ width: '140px', ...sortableThStyle('hmName') }}
                                            onClick={() => handleSort('hmName')}
                                        >
                                            Hiring Manager
                                            {sortField === 'hmName' && <span style={{ marginLeft: '2px', fontSize: '0.6rem' }}>{sortDirection === 'desc' ? '▼' : '▲'}</span>}
                                        </th>
                                    )}
                                    <th
                                        style={{ width: '180px', ...sortableThStyle('reqTitle') }}
                                        onClick={() => handleSort('reqTitle')}
                                    >
                                        Requisition
                                        {sortField === 'reqTitle' && <span style={{ marginLeft: '2px', fontSize: '0.6rem' }}>{sortDirection === 'desc' ? '▼' : '▲'}</span>}
                                    </th>
                                    <th style={{ width: '140px', ...thStyle }}>Candidate</th>
                                    <th style={{ width: '100px', ...thStyle }}>Trigger</th>
                                    <th
                                        className="text-end"
                                        style={{ width: '80px', ...sortableThStyle('daysWaiting') }}
                                        onClick={() => handleSort('daysWaiting')}
                                    >
                                        Wait
                                        {sortField === 'daysWaiting' && <span style={{ marginLeft: '2px', fontSize: '0.6rem' }}>{sortDirection === 'desc' ? '▼' : '▲'}</span>}
                                    </th>
                                    <th
                                        className="text-end"
                                        style={{ width: '100px', ...sortableThStyle('daysOverdue') }}
                                        onClick={() => handleSort('daysOverdue')}
                                    >
                                        Status
                                        {sortField === 'daysOverdue' && <span style={{ marginLeft: '2px', fontSize: '0.6rem' }}>{sortDirection === 'desc' ? '▼' : '▲'}</span>}
                                    </th>
                                    <th style={thStyle}>Suggested Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedActions.map((action, idx) => {
                                    const meta = ACTION_TYPE_META[action.actionType];
                                    return (
                                        <tr
                                            key={`${action.reqId}-${action.candidateId}-${action.actionType}-${idx}`}
                                            className="cursor-pointer"
                                        >
                                            <td style={tdStyle}>
                                                <span
                                                    className="badge-bespoke"
                                                    style={{
                                                        background: meta.color === 'danger' ? 'var(--color-red-50)' :
                                                            meta.color === 'warning' ? 'var(--color-amber-50)' :
                                                                'var(--color-blue-50)',
                                                        color: meta.color === 'danger' ? 'var(--color-red-600)' :
                                                            meta.color === 'warning' ? 'var(--color-amber-600)' :
                                                                'var(--color-blue-600)',
                                                        fontSize: '0.7rem'
                                                    }}
                                                >
                                                    {meta.label}
                                                </span>
                                            </td>
                                            {showHmColumn && (
                                                <td style={tdStyle}>
                                                    <strong style={{ color: 'var(--color-slate-800)', fontSize: '0.85rem' }}>{action.hmName}</strong>
                                                </td>
                                            )}
                                            <td style={{ ...tdStyle, maxWidth: '180px' }}>
                                                <strong style={{ color: 'var(--color-slate-800)', fontSize: '0.85rem' }} className="text-truncate d-block" title={action.reqTitle}>
                                                    {action.reqTitle}
                                                </strong>
                                                <small className="text-muted" style={{ fontSize: '0.7rem' }}>{action.reqId}</small>
                                            </td>
                                            <td style={tdStyle}>
                                                <span style={{ color: 'var(--color-slate-800)', fontSize: '0.85rem' }}>{action.candidateName}</span>
                                            </td>
                                            <td style={tdStyle}>
                                                <span style={{ color: 'var(--color-slate-500)', fontSize: '0.85rem' }}>{action.triggerDate.toLocaleDateString()}</span>
                                            </td>
                                            <td className="text-end" style={tdStyle}>
                                                <span style={{ color: 'var(--color-slate-700)', fontWeight: 600 }}>{action.daysWaiting}d</span>
                                            </td>
                                            <td className="text-end" style={tdStyle}>
                                                {action.daysOverdue > 0 ? (
                                                    action.daysOverdue > 5 ? (
                                                        <span className="badge-bespoke badge-danger-soft" style={{ fontSize: '0.75rem' }}>
                                                            {action.daysOverdue}d overdue
                                                        </span>
                                                    ) : (
                                                        <span className="badge-bespoke badge-warning-soft" style={{ fontSize: '0.75rem' }}>
                                                            {action.daysOverdue}d overdue
                                                        </span>
                                                    )
                                                ) : (
                                                    <span className="badge-bespoke" style={{ background: 'linear-gradient(135deg, #0f766e 0%, #14b8a6 100%)', color: 'white', fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}>
                                                        On Track
                                                    </span>
                                                )}
                                            </td>
                                            <td style={tdStyle}>
                                                <small style={{ color: 'var(--color-slate-600)', fontSize: '0.8rem' }}>
                                                    → {action.suggestedAction}
                                                </small>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {sortedActions.length === 0 && (
                                    <tr>
                                        <td colSpan={showHmColumn ? 8 : 7} className="text-center text-muted py-5">
                                            {actions.length === 0 ? (
                                                <div className="d-flex flex-column align-items-center">
                                                    <div className="mb-3" style={{ fontSize: '2.5rem' }}>🎉</div>
                                                    <h5 className="text-dark">All Caught Up!</h5>
                                                    <p className="text-muted">No pending actions requiring attention.</p>
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
