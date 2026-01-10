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

    return (
        <div className="card-bespoke animate-fade-in">
            <div className="card-header d-flex justify-content-between align-items-center">
                <h6 className="mb-0">Open Requisitions Scorecard</h6>
                <div className="d-flex gap-2 align-items-center">
                    <span className="badge-bespoke badge-neutral-soft">{sortedRollups.length} reqs</span>
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
                    <table className="table table-bespoke table-hover mb-0" style={{ tableLayout: 'fixed', minWidth: '1250px' }}>
                        <thead>
                            <tr>
                                <th
                                    style={{ width: '200px' }}
                                    className={`cursor-pointer user-select-none ${sortField === 'reqTitle' ? 'text-primary' : ''}`}
                                    onClick={() => handleSort('reqTitle')}
                                >
                                    Requisition
                                    {sortField === 'reqTitle' && <span className="ms-1" style={{ fontSize: '0.6rem' }}>{sortDirection === 'desc' ? '▼' : '▲'}</span>}
                                </th>
                                {showHmColumn && (
                                    <th
                                        style={{ width: '120px' }}
                                        className={`cursor-pointer user-select-none ${sortField === 'hmName' ? 'text-primary' : ''}`}
                                        onClick={() => handleSort('hmName')}
                                    >
                                        HM
                                        {sortField === 'hmName' && <span className="ms-1" style={{ fontSize: '0.6rem' }}>{sortDirection === 'desc' ? '▼' : '▲'}</span>}
                                    </th>
                                )}
                                <th>Function</th>
                                <th>Level</th>
                                <th
                                    className={`text-end cursor-pointer user-select-none ${sortField === 'reqAgeDays' ? 'text-primary' : ''}`}
                                    onClick={() => handleSort('reqAgeDays')}
                                >
                                    Age
                                    {sortField === 'reqAgeDays' && <span className="ms-1" style={{ fontSize: '0.6rem' }}>{sortDirection === 'desc' ? '▼' : '▲'}</span>}
                                </th>
                                <th
                                    className={`text-end cursor-pointer user-select-none ${sortField === 'daysSinceLastMovement' ? 'text-primary' : ''}`}
                                    onClick={() => handleSort('daysSinceLastMovement')}
                                >
                                    Stall
                                    {sortField === 'daysSinceLastMovement' && <span className="ms-1" style={{ fontSize: '0.6rem' }}>{sortDirection === 'desc' ? '▼' : '▲'}</span>}
                                </th>
                                <th
                                    className={`text-end cursor-pointer user-select-none ${sortField === 'pipelineDepth' ? 'text-primary' : ''}`}
                                    onClick={() => handleSort('pipelineDepth')}
                                >
                                    Pipeline
                                    {sortField === 'pipelineDepth' && <span className="ms-1" style={{ fontSize: '0.6rem' }}>{sortDirection === 'desc' ? '▼' : '▲'}</span>}
                                </th>
                                {bucketColumns.map(bucket => (
                                    <th
                                        key={bucket}
                                        className="text-center"
                                        title={BUCKET_METADATA[bucket].description}
                                        style={{ minWidth: '60px', borderLeft: '1px solid var(--color-slate-200)' }}
                                    >
                                        <div className="d-flex flex-column align-items-center">
                                            <span style={{ fontSize: '0.5em', color: BUCKET_METADATA[bucket].color }}>●</span>
                                            <span>{BUCKET_METADATA[bucket].shortLabel}</span>
                                        </div>
                                    </th>
                                ))}
                                <th style={{ width: '120px', borderLeft: '1px solid var(--color-slate-200)' }}>Forecasted Fill</th>
                                <th style={{ borderLeft: '1px solid var(--color-slate-200)' }}>Risk</th>
                                <th>Stall Reason</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedRollups.map(rollup => (
                                <tr
                                    key={rollup.reqId}
                                    onClick={() => onSelectReq?.(rollup.reqId)}
                                    className="cursor-pointer"
                                >
                                    <td style={{ maxWidth: '200px' }}>
                                        <strong className="text-truncate d-block fw-medium" title={rollup.reqTitle}>
                                            {rollup.reqTitle}
                                        </strong>
                                        <small className="text-muted">{rollup.reqId}</small>
                                    </td>
                                    {showHmColumn && (
                                        <td>
                                            <span>{rollup.hmName}</span>
                                        </td>
                                    )}
                                    <td>
                                        <span className="badge-bespoke badge-neutral-soft">
                                            {rollup.function}
                                        </span>
                                    </td>
                                    <td>
                                        <span className="badge-bespoke badge-neutral-soft">
                                            {rollup.level}
                                        </span>
                                    </td>
                                    <td className="text-end">
                                        {rollup.reqAgeDays > 60 ? (
                                            <span className="badge-bespoke badge-danger-soft">{rollup.reqAgeDays}d</span>
                                        ) : (
                                            <span className="text-muted">{rollup.reqAgeDays}d</span>
                                        )}
                                    </td>
                                    <td className="text-end">
                                        {rollup.daysSinceLastMovement !== null ? (
                                            rollup.daysSinceLastMovement > 7 ? (
                                                <span className="badge-bespoke badge-warning-soft">{rollup.daysSinceLastMovement}d</span>
                                            ) : (
                                                <span className="text-muted">{rollup.daysSinceLastMovement}d</span>
                                            )
                                        ) : (
                                            <span className="text-muted">—</span>
                                        )}
                                    </td>
                                    <td className="text-end">
                                        {rollup.pipelineDepth < 3 ? (
                                            <span className="badge-bespoke badge-danger-soft">{rollup.pipelineDepth}</span>
                                        ) : (
                                            <span className="fw-semibold">{rollup.pipelineDepth}</span>
                                        )}
                                    </td>
                                    {bucketColumns.map(bucket => (
                                        <td
                                            key={bucket}
                                            className="text-center"
                                            style={{ borderLeft: '1px solid var(--color-slate-100)' }}
                                        >
                                            {rollup.candidatesByBucket[bucket] > 0 ? (
                                                <span
                                                    className="badge-bespoke"
                                                    style={{
                                                        backgroundColor: `${BUCKET_METADATA[bucket].color}20`,
                                                        color: BUCKET_METADATA[bucket].color
                                                    }}
                                                >
                                                    {rollup.candidatesByBucket[bucket]}
                                                </span>
                                            ) : (
                                                <span className="text-muted">•</span>
                                            )}
                                        </td>
                                    ))}
                                    <td style={{ borderLeft: '1px solid var(--color-slate-100)' }}>
                                        {rollup.forecast?.likelyDate ? (
                                            <div className="d-flex flex-column">
                                                <span className="fw-semibold">
                                                    {new Date(rollup.forecast.likelyDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                                </span>
                                                <small className="text-muted" style={{ fontSize: '0.65rem' }}>
                                                    {new Date(rollup.forecast.earliestDate!).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {new Date(rollup.forecast.lateDate!).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                                </small>
                                            </div>
                                        ) : (
                                            <span className="text-muted">—</span>
                                        )}
                                    </td>
                                    <td style={{ borderLeft: '1px solid var(--color-slate-200)' }}>
                                        <RiskFlagBadges flags={rollup.riskFlags} />
                                    </td>
                                    <td>
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
