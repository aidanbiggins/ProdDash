// HM Scorecard Component
// Displays a table of open requisitions for hiring managers with risk flags and metrics

import React, { useMemo, useState } from 'react';
import { HMReqRollup, HMDecisionBucket, StallReasonCode } from '../../../types/hmTypes';
import { StallReasonBadge, RiskFlagBadges } from './StallReasonBadge';
import { BUCKET_METADATA } from '../../../config/hmStageTaxonomy';
import { BespokeTable, BespokeTableColumn } from '../../common/BespokeTable';

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

    const handleSort = (key: string, direction: 'asc' | 'desc') => {
        setSortField(key as SortField);
        setSortDirection(direction);
    };

    // Determine if we should show the HM column
    const showHmColumn = !selectedHmUserIds || selectedHmUserIds.size === 0 || selectedHmUserIds.size > 1;

    // Build columns dynamically
    const columns: BespokeTableColumn<HMReqRollup>[] = useMemo(() => {
        const cols: BespokeTableColumn<HMReqRollup>[] = [
            {
                key: 'reqTitle',
                header: 'Requisition',
                width: '160px',
                sortable: true,
                render: (r) => (
                    <div>
                        <div className="cell-primary text-truncate" style={{ maxWidth: '150px' }} title={r.reqTitle}>{r.reqTitle}</div>
                        <small className="cell-muted cell-small">{r.reqId}</small>
                    </div>
                )
            },
            {
                key: 'hmName',
                header: 'HM',
                width: '100px',
                sortable: true,
                hidden: !showHmColumn,
                render: (r) => <span className="truncate block" style={{ maxWidth: '90px' }} title={r.hmName}>{r.hmName}</span>
            },
            {
                key: 'function',
                header: 'Func',
                width: '70px',
                render: (r) => <span className="badge-bespoke badge-neutral-soft">{r.function}</span>
            },
            {
                key: 'level',
                header: 'Lvl',
                width: '50px',
                render: (r) => <span className="badge-bespoke badge-neutral-soft">{r.level}</span>
            },
            {
                key: 'reqAgeDays',
                header: 'Age',
                width: '50px',
                align: 'right',
                sortable: true,
                render: (r) => r.reqAgeDays > 60
                    ? <span className="badge-bespoke badge-danger-soft">{r.reqAgeDays}d</span>
                    : <span className="cell-muted">{r.reqAgeDays}d</span>
            },
            {
                key: 'daysSinceLastMovement',
                header: 'Stall',
                width: '50px',
                align: 'right',
                sortable: true,
                render: (r) => r.daysSinceLastMovement !== null
                    ? (r.daysSinceLastMovement > 7
                        ? <span className="badge-bespoke badge-warning-soft">{r.daysSinceLastMovement}d</span>
                        : <span className="cell-muted">{r.daysSinceLastMovement}d</span>)
                    : <span className="cell-muted">—</span>
            },
            {
                key: 'pipelineDepth',
                header: 'Pipe',
                width: '45px',
                align: 'right',
                sortable: true,
                render: (r) => r.pipelineDepth < 3
                    ? <span className="badge-bespoke badge-danger-soft">{r.pipelineDepth}</span>
                    : <span className="font-semibold">{r.pipelineDepth}</span>
            }
        ];

        // Add bucket columns with abbreviated headers
        const bucketConfigs: Array<{ bucket: HMDecisionBucket; abbrev: string }> = [
            { bucket: HMDecisionBucket.HM_REVIEW, abbrev: 'Rev' },
            { bucket: HMDecisionBucket.HM_INTERVIEW_DECISION, abbrev: 'Int' },
            { bucket: HMDecisionBucket.HM_FINAL_DECISION, abbrev: 'Dec' },
            { bucket: HMDecisionBucket.OFFER_DECISION, abbrev: 'Off' }
        ];
        bucketConfigs.forEach(({ bucket, abbrev }) => {
            cols.push({
                key: `bucket_${bucket}`,
                header: abbrev,
                width: '40px',
                align: 'center',
                headerClass: 'border-start',
                cellClass: 'border-start',
                render: (r) => r.candidatesByBucket[bucket] > 0
                    ? <span className="badge-bespoke" style={{ backgroundColor: `${BUCKET_METADATA[bucket].color}20`, color: BUCKET_METADATA[bucket].color }}>{r.candidatesByBucket[bucket]}</span>
                    : <span className="cell-muted">•</span>
            });
        });

        // Add remaining columns
        cols.push(
            {
                key: 'forecast',
                header: 'Fill',
                width: '80px',
                headerClass: 'border-start',
                cellClass: 'border-start',
                render: (r) => r.forecast?.likelyDate
                    ? <span className="font-semibold">{new Date(r.forecast.likelyDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                    : <span className="cell-muted">—</span>
            },
            {
                key: 'riskFlags',
                header: 'Risk',
                width: '90px',
                headerClass: 'border-start',
                cellClass: 'border-start',
                render: (r) => <RiskFlagBadges flags={r.riskFlags} compact />
            },
            {
                key: 'stallReason',
                header: 'Reason',
                width: '120px',
                render: (r) => <StallReasonBadge stallReason={r.primaryStallReason} />
            }
        );

        return cols;
    }, [showHmColumn]);

    return (
        <div className="card-bespoke animate-fade-in">
            <div className="card-header flex justify-between items-center">
                <h6 className="mb-0">Open Requisitions Scorecard</h6>
                <div className="flex gap-2 items-center">
                    <span className="badge-bespoke badge-neutral-soft">{sortedRollups.length} reqs</span>
                    <input
                        type="text"
                        className="px-3 py-2 text-sm bg-card border border-border rounded-md"
                        placeholder="Search reqs..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        style={{ width: '160px' }}
                    />
                </div>
            </div>
            <div className="card-body p-0">
                <BespokeTable<HMReqRollup>
                    columns={columns}
                    data={sortedRollups}
                    keyExtractor={(r) => r.reqId}
                    sortColumn={sortField}
                    sortDirection={sortDirection}
                    onSort={handleSort}
                    onRowClick={(r) => onSelectReq?.(r.reqId)}
                    emptyState={
                        <div>
                            <div className="empty-state-icon">🔍</div>
                            <div>No open requisitions found matching criteria</div>
                        </div>
                    }
                />
            </div>
        </div>
    );
}
