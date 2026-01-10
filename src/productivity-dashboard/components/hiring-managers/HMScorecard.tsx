// HM Scorecard Component
// Displays a table of open requisitions for hiring managers with risk flags and metrics

import React, { useMemo, useState } from 'react';
import { HMReqRollup, HMDecisionBucket, StallReasonCode } from '../../types/hmTypes';
import { StallReasonBadge, RiskFlagBadges } from './StallReasonBadge';
import { BUCKET_METADATA } from '../../config/hmStageTaxonomy';

interface HMScorecardProps {
    reqRollups: HMReqRollup[];
    selectedHmUserIds?: Set<string>;
    onSelectReq?: (reqId: string) => void;
}

type SortField = 'reqTitle' | 'reqAgeDays' | 'daysSinceLastMovement' | 'pipelineDepth' | 'hmName';
type SortDirection = 'asc' | 'desc';

export function HMScorecard({ reqRollups, selectedHmUserIds, onSelectReq }: HMScorecardProps) {
    const [sortField, setSortField] = useState<SortField>('daysSinceLastMovement');
    const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
    const [searchTerm, setSearchTerm] = useState('');

    // Filter by search term only (HM filtering is done in parent now)
    const filteredRollups = useMemo(() => {
        let result = reqRollups;

        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            result = result.filter(r =>
                r.reqTitle.toLowerCase().includes(term) ||
                r.hmName.toLowerCase().includes(term) ||
                r.reqId.toLowerCase().includes(term)
            );
        }

        return result;
    }, [reqRollups, searchTerm]);

    // Sort
    const sortedRollups = useMemo(() => {
        const sorted = [...filteredRollups].sort((a, b) => {
            let aVal: string | number | null = null;
            let bVal: string | number | null = null;

            switch (sortField) {
                case 'reqTitle':
                    aVal = a.reqTitle.toLowerCase();
                    bVal = b.reqTitle.toLowerCase();
                    break;
                case 'reqAgeDays':
                    aVal = a.reqAgeDays;
                    bVal = b.reqAgeDays;
                    break;
                case 'daysSinceLastMovement':
                    aVal = a.daysSinceLastMovement ?? 999;
                    bVal = b.daysSinceLastMovement ?? 999;
                    break;
                case 'pipelineDepth':
                    aVal = a.pipelineDepth;
                    bVal = b.pipelineDepth;
                    break;
                case 'hmName':
                    aVal = a.hmName.toLowerCase();
                    bVal = b.hmName.toLowerCase();
                    break;
            }

            if (aVal === null || bVal === null) return 0;
            if (typeof aVal === 'string' && typeof bVal === 'string') {
                return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
            }
            return sortDirection === 'asc'
                ? (aVal as number) - (bVal as number)
                : (bVal as number) - (aVal as number);
        });

        return sorted;
    }, [filteredRollups, sortField, sortDirection]);

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('desc');
        }
    };

    // Get bucket columns to show
    const bucketColumns: HMDecisionBucket[] = [
        HMDecisionBucket.HM_REVIEW,
        HMDecisionBucket.HM_INTERVIEW_DECISION,
        HMDecisionBucket.HM_FINAL_DECISION,
        HMDecisionBucket.OFFER_DECISION
    ];

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
        <div className="card-bespoke animate-fade-in">
            <div className="card-header d-flex justify-content-between align-items-center">
                <h6 className="mb-0">Open Requisitions Scorecard</h6>
                <div className="d-flex gap-2 align-items-center">
                    <span className="badge bg-slate-200 text-slate-600">{sortedRollups.length} reqs</span>
                    <input
                        type="text"
                        className="form-control form-control-sm"
                        placeholder="Search reqs..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        style={{ width: '200px' }}
                    />
                </div>
            </div>
            <div className="card-body p-0">
                <div className="table-responsive">
                    <table className="table table-hover mb-0" style={{ tableLayout: 'fixed', minWidth: '1250px' }}>
                        <thead>
                            <tr style={{ background: 'var(--color-slate-50, #f8fafc)' }}>
                                <th
                                    style={{ width: '200px', ...sortableThStyle('reqTitle') }}
                                    onClick={() => handleSort('reqTitle')}
                                >
                                    Requisition
                                    {sortField === 'reqTitle' && <span style={{ marginLeft: '2px', fontSize: '0.6rem' }}>{sortDirection === 'desc' ? '▼' : '▲'}</span>}
                                </th>
                                {showHmColumn && (
                                    <th
                                        style={{ width: '120px', ...sortableThStyle('hmName') }}
                                        onClick={() => handleSort('hmName')}
                                    >
                                        HM
                                        {sortField === 'hmName' && <span style={{ marginLeft: '2px', fontSize: '0.6rem' }}>{sortDirection === 'desc' ? '▼' : '▲'}</span>}
                                    </th>
                                )}
                                <th style={thStyle}>Function</th>
                                <th style={thStyle}>Level</th>
                                <th
                                    className="text-end"
                                    style={sortableThStyle('reqAgeDays')}
                                    onClick={() => handleSort('reqAgeDays')}
                                >
                                    Age
                                    {sortField === 'reqAgeDays' && <span style={{ marginLeft: '2px', fontSize: '0.6rem' }}>{sortDirection === 'desc' ? '▼' : '▲'}</span>}
                                </th>
                                <th
                                    className="text-end"
                                    style={sortableThStyle('daysSinceLastMovement')}
                                    onClick={() => handleSort('daysSinceLastMovement')}
                                >
                                    Stall
                                    {sortField === 'daysSinceLastMovement' && <span style={{ marginLeft: '2px', fontSize: '0.6rem' }}>{sortDirection === 'desc' ? '▼' : '▲'}</span>}
                                </th>
                                <th
                                    className="text-end"
                                    style={sortableThStyle('pipelineDepth')}
                                    onClick={() => handleSort('pipelineDepth')}
                                >
                                    Pipeline
                                    {sortField === 'pipelineDepth' && <span style={{ marginLeft: '2px', fontSize: '0.6rem' }}>{sortDirection === 'desc' ? '▼' : '▲'}</span>}
                                </th>
                                {bucketColumns.map(bucket => (
                                    <th
                                        key={bucket}
                                        className="text-center"
                                        title={BUCKET_METADATA[bucket].description}
                                        style={{ ...thStyle, minWidth: '60px', borderLeft: '1px solid var(--color-slate-200)' }}
                                    >
                                        <div className="d-flex flex-column align-items-center">
                                            <span style={{ fontSize: '0.5em', color: BUCKET_METADATA[bucket].color }}>●</span>
                                            <span>{BUCKET_METADATA[bucket].shortLabel}</span>
                                        </div>
                                    </th>
                                ))}
                                <th style={{ ...thStyle, width: '120px', borderLeft: '1px solid var(--color-slate-200)' }}>Forecasted Fill</th>
                                <th style={{ ...thStyle, borderLeft: '1px solid var(--color-slate-200)' }}>Risk</th>
                                <th style={thStyle}>Stall Reason</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedRollups.map(rollup => (
                                <tr
                                    key={rollup.reqId}
                                    onClick={() => onSelectReq?.(rollup.reqId)}
                                    className="cursor-pointer"
                                >
                                    <td style={{ ...tdStyle, maxWidth: '200px' }}>
                                        <strong style={{ color: 'var(--color-slate-800)', fontSize: '0.85rem' }} className="text-truncate d-block" title={rollup.reqTitle}>
                                            {rollup.reqTitle}
                                        </strong>
                                        <small className="text-muted" style={{ fontSize: '0.7rem' }}>{rollup.reqId}</small>
                                    </td>
                                    {showHmColumn && (
                                        <td style={tdStyle}>
                                            <span style={{ color: 'var(--color-slate-800)', fontSize: '0.85rem' }}>{rollup.hmName}</span>
                                        </td>
                                    )}
                                    <td style={tdStyle}>
                                        <span className="badge-bespoke" style={{ background: 'var(--color-slate-100)', color: 'var(--color-slate-600)', fontSize: '0.7rem' }}>
                                            {rollup.function}
                                        </span>
                                    </td>
                                    <td style={tdStyle}>
                                        <span className="badge-bespoke" style={{ background: 'var(--color-slate-100)', color: 'var(--color-slate-600)', fontSize: '0.7rem' }}>
                                            {rollup.level}
                                        </span>
                                    </td>
                                    <td className="text-end" style={tdStyle}>
                                        {rollup.reqAgeDays > 60 ? (
                                            <span className="badge-bespoke badge-danger-soft" style={{ fontSize: '0.75rem' }}>{rollup.reqAgeDays}d</span>
                                        ) : (
                                            <span style={{ color: 'var(--color-slate-700)' }}>{rollup.reqAgeDays}d</span>
                                        )}
                                    </td>
                                    <td className="text-end" style={tdStyle}>
                                        {rollup.daysSinceLastMovement !== null ? (
                                            rollup.daysSinceLastMovement > 7 ? (
                                                <span className="badge-bespoke badge-warning-soft" style={{ fontSize: '0.75rem' }}>{rollup.daysSinceLastMovement}d</span>
                                            ) : (
                                                <span style={{ color: 'var(--color-slate-700)' }}>{rollup.daysSinceLastMovement}d</span>
                                            )
                                        ) : (
                                            <span style={{ color: 'var(--color-slate-400)' }}>—</span>
                                        )}
                                    </td>
                                    <td className="text-end" style={tdStyle}>
                                        {rollup.pipelineDepth < 3 ? (
                                            <span className="badge-bespoke badge-danger-soft" style={{ fontSize: '0.75rem' }}>{rollup.pipelineDepth}</span>
                                        ) : (
                                            <span style={{ color: 'var(--color-slate-700)', fontWeight: 600 }}>{rollup.pipelineDepth}</span>
                                        )}
                                    </td>
                                    {bucketColumns.map(bucket => (
                                        <td
                                            key={bucket}
                                            className="text-center"
                                            style={{ ...tdStyle, borderLeft: '1px solid var(--color-slate-100)', backgroundColor: 'rgba(248, 250, 252, 0.5)' }}
                                        >
                                            {rollup.candidatesByBucket[bucket] > 0 ? (
                                                <span
                                                    className="badge"
                                                    style={{
                                                        backgroundColor: `${BUCKET_METADATA[bucket].color}20`,
                                                        color: BUCKET_METADATA[bucket].color,
                                                        fontWeight: 600,
                                                        fontSize: '0.75rem'
                                                    }}
                                                >
                                                    {rollup.candidatesByBucket[bucket]}
                                                </span>
                                            ) : (
                                                <span style={{ color: 'var(--color-slate-300)' }}>•</span>
                                            )}
                                        </td>
                                    ))}
                                    <td style={{ ...tdStyle, borderLeft: '1px solid var(--color-slate-100)', backgroundColor: 'rgba(248, 250, 252, 0.3)' }}>
                                        {rollup.forecast?.likelyDate ? (
                                            <div className="d-flex flex-column">
                                                <span style={{ fontWeight: 600, color: 'var(--color-slate-800)' }}>
                                                    {new Date(rollup.forecast.likelyDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                                </span>
                                                <small className="text-muted" style={{ fontSize: '0.65rem' }}>
                                                    {new Date(rollup.forecast.earliestDate!).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {new Date(rollup.forecast.lateDate!).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                                </small>
                                            </div>
                                        ) : (
                                            <span className="text-slate-300">—</span>
                                        )}
                                    </td>
                                    <td style={{ ...tdStyle, borderLeft: '1px solid var(--color-slate-200)' }}>
                                        <RiskFlagBadges flags={rollup.riskFlags} />
                                    </td>
                                    <td style={tdStyle}>
                                        <StallReasonBadge
                                            stallReason={rollup.primaryStallReason}
                                            showEvidence={rollup.primaryStallReason.code !== StallReasonCode.NONE}
                                        />
                                    </td>
                                </tr>
                            ))}
                            {sortedRollups.length === 0 && (
                                <tr>
                                    <td colSpan={showHmColumn ? 12 : 11} className="text-center text-muted py-5">
                                        <div className="mb-2" style={{ fontSize: '2rem' }}>🔍</div>
                                        No open requisitions found matching criteria
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
