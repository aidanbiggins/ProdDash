// HM Action Queue Component
// Shows pending actions for HM attention (feedback due, reviews, etc)

import React, { useMemo, useState } from 'react';
import { HMPendingAction, HMActionType } from '../../../types/hmTypes';
import { BespokeTable, BespokeTableColumn } from '../../common/BespokeTable';

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
        icon: 'bi-chat-left-dots',
        color: 'danger',
        hex: '#EF4444'
    },
    [HMActionType.REVIEW_DUE]: {
        label: 'Resume Review',
        icon: 'bi-file-earmark-person',
        color: 'warning',
        hex: '#F59E0B'
    },
    [HMActionType.DECISION_DUE]: {
        label: 'Decision Needed',
        icon: 'bi-clipboard-check',
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
                render: (a) => <span className="cell-primary truncate block" style={{ maxWidth: '100px' }} title={a.hmName}>{a.hmName}</span>
            },
            {
                key: 'reqTitle',
                header: 'Requisition',
                width: '150px',
                sortable: true,
                render: (a) => (
                    <div>
                        <div className="cell-primary text-truncate" style={{ maxWidth: '140px' }} title={a.reqTitle}>{a.reqTitle}</div>
                        <div className="text-sm cell-muted cell-small">{a.reqId}</div>
                    </div>
                )
            },
            {
                key: 'candidateName',
                header: 'Candidate',
                width: '110px',
                render: (a) => <span className="truncate block" style={{ maxWidth: '100px' }} title={a.candidateName}>{a.candidateName}</span>
            },
            {
                key: 'triggerDate',
                header: 'Trigger',
                width: '80px',
                cellClass: 'cell-muted',
                render: (a) => a.triggerDate
                    ? a.triggerDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                    : <span className="text-muted-foreground">--</span>  // STRICT: Show '--' for null dates
            },
            {
                key: 'daysWaiting',
                header: 'Wait',
                width: '50px',
                align: 'right',
                sortable: true,
                render: (a) => <span className="font-semibold">{a.daysWaiting}d</span>
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
                render: (a) => <div className="text-sm cell-muted">→ {a.suggestedAction}</div>
            }
        ];
        return cols;
    }, [showHmColumn]);

    return (
        <div className="animate-fade-in">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                {Object.entries(ACTION_TYPE_META).map(([type, meta]) => {
                    const count = countByType[type as HMActionType] || 0;
                    const isActive = filterType === type;

                    return (
                        <div key={type}>
                            <div
                                className="p-3 text-center cursor-pointer h-full flex flex-col justify-center"
                                onClick={() => setFilterType(filterType === type as HMActionType ? 'ALL' : type as HMActionType)}
                                style={{
                                    background: isActive ? '#2a2a2a' : '#141414',
                                    border: isActive ? `2px solid ${meta.hex}` : '1px solid #27272a',
                                    borderRadius: '0.5rem',
                                    transition: 'all 0.15s ease'
                                }}
                            >
                                <i className={`bi ${meta.icon}`} style={{ fontSize: '1.25rem', color: meta.hex, marginBottom: '0.5rem' }}></i>
                                <h3 style={{
                                    fontFamily: "var(--font-mono)",
                                    fontWeight: 600,
                                    fontSize: '1.75rem',
                                    color: '#F8FAFC',
                                    marginBottom: 0
                                }}>{count}</h3>
                                <div style={{
                                    color: '#71717a',
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
                <div className="flex justify-between items-center mb-4 rounded p-3" style={{ background: '#1a1a1a', border: '1px solid #27272a' }}>
                    <div className="flex items-center">
                        <i className="bi bi-funnel-fill mr-2" style={{ color: '#71717a' }}></i>
                        <span>
                            Showing: <strong>{ACTION_TYPE_META[filterType].label}</strong>
                            <span className="badge-bespoke badge-neutral-soft ml-2">{countByType[filterType]} items</span>
                        </span>
                    </div>
                    <button
                        className="px-3 py-1.5 text-sm bg-card border border-border rounded hover:bg-opacity-80 transition-colors"
                        onClick={() => setFilterType('ALL')}
                    >
                        Clear Filter
                    </button>
                </div>
            )}

            {/* Actions Table */}
            <div className="card-bespoke">
                <div className="card-header flex justify-between items-center">
                    <h6 className="mb-0 text-base font-semibold">Pending Actions Queue</h6>
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
                                <div className="flex flex-col items-center py-4">
                                    <i className="bi bi-check-circle" style={{ fontSize: '2.5rem', color: '#22c55e', marginBottom: '0.75rem' }}></i>
                                    <h5 className="text-lg font-semibold" style={{ color: '#F8FAFC' }}>All Caught Up!</h5>
                                    <p className="text-muted-foreground mb-0">No pending actions requiring attention.</p>
                                </div>
                            ) : (
                                <div className="text-muted-foreground">No actions match the current filter</div>
                            )
                        }
                    />
                </div>
            </div>
        </div>
    );
}
