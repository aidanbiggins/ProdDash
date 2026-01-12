// HM Action Queue Component
// Shows pending actions for HM attention (feedback due, reviews, etc)

import React, { useMemo, useState } from 'react';
import { HMPendingAction, HMActionType } from '../../types/hmTypes';
import { BespokeTable, BespokeTableColumn } from '../common/BespokeTable';

interface HMActionQueueProps {
    actions: HMPendingAction[];
    selectedHmUserIds?: Set<string>;
}

type SortField = 'actionType' | 'daysOverdue' | 'reqTitle' | 'hmName' | 'daysWaiting';
type SortDirection = 'asc' | 'desc';

// Metadata for action types - MUST match HMActionType enum in hmTypes.ts
const ACTION_TYPE_META: Record<HMActionType, { label: string; icon: string; color: string; hex: string }> = {
    [HMActionType.FEEDBACK_DUE]: {
        label: 'Feedback Due',
        icon: '💬',
        color: 'danger',
        hex: '#EF4444'
    },
    [HMActionType.REVIEW_DUE]: {
        label: 'Resume Review',
        icon: '👀',
        color: 'warning',
        hex: '#F59E0B'
    },
    [HMActionType.DECISION_DUE]: {
        label: 'Decision Needed',
        icon: '⚖️',
        color: 'primary',
        hex: '#3B82F6'
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

    const handleSort = (key: string, direction: 'asc' | 'desc') => {
        setSortField(key as SortField);
        setSortDirection(direction);
    };

    // Determine if we should show the HM column
    const showHmColumn = !selectedHmUserIds || selectedHmUserIds.size === 0 || selectedHmUserIds.size > 1;

    // Build columns dynamically
    const columns: BespokeTableColumn<HMPendingAction>[] = useMemo(() => {
        const cols: BespokeTableColumn<HMPendingAction>[] = [
            {
                key: 'actionType',
                header: 'Type',
                width: '100px',
                sortable: true,
                render: (a) => {
                    const meta = ACTION_TYPE_META[a.actionType];
                    return <span className={`badge-bespoke ${meta.color === 'danger' ? 'badge-danger-soft' : meta.color === 'warning' ? 'badge-warning-soft' : 'badge-primary-soft'}`}>{meta.label}</span>;
                }
            },
            {
                key: 'hmName',
                header: 'HM',
                width: '110px',
                sortable: true,
                hidden: !showHmColumn,
                render: (a) => <span className="cell-primary text-truncate d-block" style={{ maxWidth: '100px' }} title={a.hmName}>{a.hmName}</span>
            },
            {
                key: 'reqTitle',
                header: 'Requisition',
                width: '150px',
                sortable: true,
                render: (a) => (
                    <div>
                        <div className="cell-primary text-truncate" style={{ maxWidth: '140px' }} title={a.reqTitle}>{a.reqTitle}</div>
                        <small className="cell-muted cell-small">{a.reqId}</small>
                    </div>
                )
            },
            {
                key: 'candidateName',
                header: 'Candidate',
                width: '110px',
                render: (a) => <span className="text-truncate d-block" style={{ maxWidth: '100px' }} title={a.candidateName}>{a.candidateName}</span>
            },
            {
                key: 'triggerDate',
                header: 'Trigger',
                width: '80px',
                cellClass: 'cell-muted',
                render: (a) => a.triggerDate
                    ? a.triggerDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                    : <span className="text-muted">--</span>  // STRICT: Show '--' for null dates
            },
            {
                key: 'daysWaiting',
                header: 'Wait',
                width: '50px',
                align: 'right',
                sortable: true,
                render: (a) => <span className="fw-semibold">{a.daysWaiting}d</span>
            },
            {
                key: 'daysOverdue',
                header: 'Status',
                width: '90px',
                align: 'right',
                sortable: true,
                render: (a) => a.daysOverdue > 0
                    ? (a.daysOverdue > 5
                        ? <span className="badge-bespoke badge-danger-soft">{a.daysOverdue}d over</span>
                        : <span className="badge-bespoke badge-warning-soft">{a.daysOverdue}d over</span>)
                    : <span className="badge-bespoke badge-success-soft">On Track</span>
            },
            {
                key: 'suggestedAction',
                header: 'Action',
                render: (a) => <small className="cell-muted">→ {a.suggestedAction}</small>
            }
        ];
        return cols;
    }, [showHmColumn]);

    return (
        <div className="animate-fade-in">
            {/* Summary Cards */}
            <div className="row g-3 mb-4">
                {Object.entries(ACTION_TYPE_META).map(([type, meta]) => {
                    const count = countByType[type as HMActionType] || 0;
                    const isActive = filterType === type;

                    return (
                        <div className="col-md-4" key={type}>
                            <div
                                className="p-3 text-center cursor-pointer h-100 d-flex flex-column justify-content-center"
                                onClick={() => setFilterType(filterType === type as HMActionType ? 'ALL' : type as HMActionType)}
                                style={{
                                    background: isActive ? '#2a2a2a' : '#141414',
                                    border: isActive ? `2px solid ${meta.hex}` : '1px solid #27272a',
                                    borderRadius: '2px',
                                    transition: 'all 0.15s ease'
                                }}
                            >
                                <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>{meta.icon}</div>
                                <h3 style={{
                                    fontFamily: "'JetBrains Mono', monospace",
                                    fontWeight: 600,
                                    fontSize: '1.75rem',
                                    color: meta.hex,
                                    marginBottom: 0
                                }}>{count}</h3>
                                <div style={{
                                    color: '#94A3B8',
                                    fontSize: '0.65rem',
                                    fontWeight: 600,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em',
                                    marginTop: '0.25rem'
                                }}>{meta.label}</div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Filter indicator */}
            {filterType !== 'ALL' && (
                <div className="d-flex justify-content-between align-items-center mb-4 bg-slate-50 border border-slate-200 rounded p-3">
                    <div className="d-flex align-items-center">
                        <span className="cell-muted me-2">🔽</span>
                        <span>
                            Showing: <strong>{ACTION_TYPE_META[filterType].label}</strong>
                            <span className="badge-bespoke badge-neutral-soft ms-2">{countByType[filterType]} items</span>
                        </span>
                    </div>
                    <button
                        className="btn btn-bespoke-secondary btn-sm"
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
                    <span className="badge-bespoke badge-neutral-soft">{sortedActions.length} actions</span>
                </div>
                <div className="card-body p-0">
                    <BespokeTable<HMPendingAction>
                        columns={columns}
                        data={sortedActions}
                        keyExtractor={(a) => `${a.reqId}-${a.candidateId}-${a.actionType}`}
                        sortColumn={sortField}
                        sortDirection={sortDirection}
                        onSort={handleSort}
                        emptyState={
                            actions.length === 0 ? (
                                <div className="d-flex flex-column align-items-center">
                                    <div className="empty-state-icon">🎉</div>
                                    <h5>All Caught Up!</h5>
                                    <p className="cell-muted">No pending actions requiring attention.</p>
                                </div>
                            ) : (
                                <div>No actions match the current filter</div>
                            )
                        }
                    />
                </div>
            </div>
        </div>
    );
}
