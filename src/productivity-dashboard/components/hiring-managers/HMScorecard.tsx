// HM Scorecard Component
// Displays a table of open requisitions for hiring managers with risk flags and metrics

import React, { useMemo, useState } from 'react';
import { HMReqRollup, HMDecisionBucket } from '../../types/hmTypes';
import { StallReasonBadge, RiskFlagBadges } from './StallReasonBadge';
import { BUCKET_METADATA } from '../../config/hmStageTaxonomy';

interface HMScorecardProps {
    reqRollups: HMReqRollup[];
    selectedHmUserId?: string | null;
    onSelectReq?: (reqId: string) => void;
}

type SortField = 'reqTitle' | 'reqAgeDays' | 'daysSinceLastMovement' | 'pipelineDepth' | 'hmName';
type SortDirection = 'asc' | 'desc';

export function HMScorecard({ reqRollups, selectedHmUserId, onSelectReq }: HMScorecardProps) {
    const [sortField, setSortField] = useState<SortField>('daysSinceLastMovement');
    const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
    const [searchTerm, setSearchTerm] = useState('');

    // Filter by HM if selected
    const filteredRollups = useMemo(() => {
        let result = reqRollups;

        if (selectedHmUserId) {
            result = result.filter(r => r.hmUserId === selectedHmUserId);
        }

        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            result = result.filter(r =>
                r.reqTitle.toLowerCase().includes(term) ||
                r.hmName.toLowerCase().includes(term) ||
                r.reqId.toLowerCase().includes(term)
            );
        }

        return result;
    }, [reqRollups, selectedHmUserId, searchTerm]);

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

    const SortHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
        <th
            onClick={() => handleSort(field)}
            style={{ cursor: 'pointer', userSelect: 'none' }}
            className="text-nowrap"
        >
            {children}
            {sortField === field && (
                <span className="ms-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
            )}
        </th>
    );

    // Get bucket columns to show
    const bucketColumns: HMDecisionBucket[] = [
        HMDecisionBucket.HM_REVIEW,
        HMDecisionBucket.HM_INTERVIEW_DECISION,
        HMDecisionBucket.HM_FINAL_DECISION,
        HMDecisionBucket.OFFER_DECISION
    ];

    return (
        <div className="card">
            <div className="card-header d-flex justify-content-between align-items-center">
                <h6 className="mb-0">Open Requisitions Scorecard</h6>
                <div className="d-flex gap-2 align-items-center">
                    <span className="badge bg-secondary">{sortedRollups.length} reqs</span>
                    <input
                        type="text"
                        className="form-control form-control-sm"
                        placeholder="Search..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        style={{ width: '150px' }}
                    />
                </div>
            </div>
            <div className="card-body p-0">
                <div className="table-responsive">
                    <table className="table table-hover table-sm mb-0">
                        <thead className="table-light">
                            <tr>
                                <SortHeader field="reqTitle">Requisition</SortHeader>
                                {!selectedHmUserId && <SortHeader field="hmName">HM</SortHeader>}
                                <th>Function</th>
                                <th>Level</th>
                                <SortHeader field="reqAgeDays">Age</SortHeader>
                                <SortHeader field="daysSinceLastMovement">Last Move</SortHeader>
                                <SortHeader field="pipelineDepth">Pipeline</SortHeader>
                                {bucketColumns.map(bucket => (
                                    <th key={bucket} className="text-center" title={BUCKET_METADATA[bucket].description}>
                                        {BUCKET_METADATA[bucket].shortLabel}
                                    </th>
                                ))}
                                <th>Risk Flags</th>
                                <th>Stall Reason</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedRollups.map(rollup => (
                                <tr
                                    key={rollup.reqId}
                                    onClick={() => onSelectReq?.(rollup.reqId)}
                                    style={{ cursor: onSelectReq ? 'pointer' : 'default' }}
                                    className={rollup.riskFlags.length > 0 ? 'table-warning' : ''}
                                >
                                    <td>
                                        <div className="fw-medium">{rollup.reqTitle}</div>
                                        <small className="text-muted">{rollup.reqId}</small>
                                    </td>
                                    {!selectedHmUserId && <td>{rollup.hmName}</td>}
                                    <td>{rollup.function}</td>
                                    <td>{rollup.level}</td>
                                    <td>
                                        <span className={rollup.reqAgeDays > 60 ? 'text-danger fw-bold' : ''}>
                                            {rollup.reqAgeDays}d
                                        </span>
                                    </td>
                                    <td>
                                        {rollup.daysSinceLastMovement !== null ? (
                                            <span className={rollup.daysSinceLastMovement > 7 ? 'text-warning fw-bold' : ''}>
                                                {rollup.daysSinceLastMovement}d ago
                                            </span>
                                        ) : (
                                            <span className="text-muted">—</span>
                                        )}
                                    </td>
                                    <td>
                                        <span className={rollup.pipelineDepth < 3 ? 'text-danger fw-bold' : ''}>
                                            {rollup.pipelineDepth}
                                        </span>
                                    </td>
                                    {bucketColumns.map(bucket => (
                                        <td key={bucket} className="text-center">
                                            {rollup.candidatesByBucket[bucket] > 0 ? (
                                                <span
                                                    className="badge"
                                                    style={{
                                                        backgroundColor: BUCKET_METADATA[bucket].color,
                                                        color: 'white'
                                                    }}
                                                >
                                                    {rollup.candidatesByBucket[bucket]}
                                                </span>
                                            ) : (
                                                <span className="text-muted">—</span>
                                            )}
                                        </td>
                                    ))}
                                    <td>
                                        <RiskFlagBadges flags={rollup.riskFlags} />
                                    </td>
                                    <td>
                                        <StallReasonBadge stallReason={rollup.primaryStallReason} />
                                    </td>
                                </tr>
                            ))}
                            {sortedRollups.length === 0 && (
                                <tr>
                                    <td colSpan={12} className="text-center text-muted py-4">
                                        No open requisitions found
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
