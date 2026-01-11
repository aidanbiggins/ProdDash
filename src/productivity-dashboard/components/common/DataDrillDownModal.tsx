// Data Drill-Down Modal Component
// Shows actual candidate/requisition data when clicking on KPI numbers

import React, { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { Candidate, Requisition, Event as DashboardEvent, User, EventType } from '../../types';

// Types of drill-down views
export type DrillDownType =
    | 'hires'
    | 'weightedHires'
    | 'offers'
    | 'offerAcceptRate'
    | 'medianTTF'
    | 'screens'
    | 'submittals'
    | 'openReqs'
    | 'stalledReqs';

interface DrillDownRecord {
    id: string;
    candidateName?: string;
    candidateId?: string;
    reqId: string;
    reqTitle: string;
    level?: string;
    recruiter?: string;
    hiringManager?: string;
    source?: string;
    date?: Date;
    stage?: string;
    complexityScore?: number;
    levelWeight?: number;
    hmWeight?: number;
    status?: string;
    ageInDays?: number;
    daysToFill?: number;
    openDate?: Date;
    hireDate?: Date;
}

interface DataDrillDownModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    type: DrillDownType;
    records: DrillDownRecord[];
    formula?: string;
    totalValue?: string | number;
}

export function DataDrillDownModal({
    isOpen,
    onClose,
    title,
    type,
    records,
    formula,
    totalValue
}: DataDrillDownModalProps) {
    const [sortColumn, setSortColumn] = useState<string>('date');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
    const [searchTerm, setSearchTerm] = useState('');
    const [page, setPage] = useState(0);
    const PAGE_SIZE = 50; // Show 50 rows at a time for performance

    // Filter records by search term
    const filteredRecords = useMemo(() => {
        if (!searchTerm.trim()) return records;
        const term = searchTerm.toLowerCase();
        return records.filter(r =>
            r.reqTitle?.toLowerCase().includes(term) ||
            r.candidateName?.toLowerCase().includes(term) ||
            r.candidateId?.toLowerCase().includes(term) ||
            r.reqId?.toLowerCase().includes(term) ||
            r.recruiter?.toLowerCase().includes(term) ||
            r.source?.toLowerCase().includes(term)
        );
    }, [records, searchTerm]);

    // Sort records
    const sortedRecords = useMemo(() => {
        return [...filteredRecords].sort((a, b) => {
            let aVal: any = (a as any)[sortColumn];
            let bVal: any = (b as any)[sortColumn];

            // Handle dates
            if (aVal instanceof Date && bVal instanceof Date) {
                return sortDirection === 'asc'
                    ? aVal.getTime() - bVal.getTime()
                    : bVal.getTime() - aVal.getTime();
            }

            // Handle nulls
            if (aVal == null) return 1;
            if (bVal == null) return -1;

            // Handle numbers
            if (typeof aVal === 'number' && typeof bVal === 'number') {
                return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
            }

            // Handle strings
            const strA = String(aVal).toLowerCase();
            const strB = String(bVal).toLowerCase();
            return sortDirection === 'asc'
                ? strA.localeCompare(strB)
                : strB.localeCompare(strA);
        });
    }, [filteredRecords, sortColumn, sortDirection]);

    const handleSort = (column: string) => {
        if (sortColumn === column) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortColumn(column);
            setSortDirection('desc');
        }
        setPage(0); // Reset to first page on sort change
    };

    // Reset page when search term changes
    React.useEffect(() => {
        setPage(0);
    }, [searchTerm]);

    // Paginated records for display
    const paginatedRecords = useMemo(() => {
        return sortedRecords.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
    }, [sortedRecords, page]);

    const totalPages = Math.ceil(sortedRecords.length / PAGE_SIZE);

    const exportCSV = () => {
        const headers = getColumns(type).map(c => c.label);
        const rows = sortedRecords.map(r =>
            getColumns(type).map(c => {
                const val = (r as any)[c.key];
                if (val instanceof Date) return format(val, 'yyyy-MM-dd');
                return val ?? '';
            })
        );

        const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${title.replace(/\s+/g, '_').toLowerCase()}_export.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    if (!isOpen) return null;

    const columns = getColumns(type);

    const SortableHeader = ({ column, label }: { column: string; label: string }) => (
        <th
            onClick={() => handleSort(column)}
            style={{
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                borderBottom: '2px solid var(--color-slate-200)',
                padding: '0.625rem 0.5rem',
                fontSize: '0.7rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.03em',
                color: sortColumn === column ? 'var(--color-accent)' : 'var(--color-slate-600)'
            }}
        >
            {label}
            {sortColumn === column && (
                <i className={`bi bi-arrow-${sortDirection === 'asc' ? 'up' : 'down'}-short ms-1`}></i>
            )}
        </th>
    );

    return (
        <div
            className="modal show d-block"
            style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
            onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            <div className="modal-dialog modal-xl modal-dialog-scrollable">
                <div className="modal-content">
                    <div className="modal-header">
                        <div>
                            <h5 className="modal-title mb-1">{title}</h5>
                            <div className="d-flex align-items-center gap-3">
                                <span className="badge bg-primary fs-6">{totalValue ?? records.length}</span>
                                <span className="text-muted small">{records.length} records</span>
                            </div>
                        </div>
                        <button type="button" className="btn-close" onClick={onClose} />
                    </div>

                    <div className="modal-body p-0">
                        {/* Search and Export */}
                        <div className="d-flex justify-content-between align-items-center p-3 border-bottom">
                            <input
                                type="text"
                                className="form-control form-control-sm"
                                style={{ maxWidth: '300px' }}
                                placeholder="Search..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                            <button
                                className="btn btn-bespoke-secondary btn-sm"
                                onClick={exportCSV}
                            >
                                <i className="bi bi-download me-1"></i>
                                Export CSV
                            </button>
                        </div>

                        {/* Formula (if provided) */}
                        {formula && (
                            <div className="px-3 py-2 bg-light border-bottom">
                                <small className="text-muted">
                                    <strong>Formula:</strong> <code>{formula}</code>
                                </small>
                            </div>
                        )}

                        {/* Data Table */}
                        <div className="table-responsive">
                            <table className="table table-hover mb-0">
                                <thead>
                                    <tr style={{ background: 'var(--color-slate-50)' }}>
                                        {columns.map(col => (
                                            <SortableHeader key={col.key} column={col.key} label={col.label} />
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedRecords.length === 0 ? (
                                        <tr>
                                            <td colSpan={columns.length} className="text-center text-muted py-4">
                                                No records found
                                            </td>
                                        </tr>
                                    ) : (
                                        paginatedRecords.map((record, idx) => (
                                            <tr key={record.id || idx}>
                                                {columns.map(col => (
                                                    <td
                                                        key={col.key}
                                                        style={{
                                                            padding: '0.5rem',
                                                            borderBottom: '1px solid var(--color-slate-100)',
                                                            fontSize: '0.85rem'
                                                        }}
                                                    >
                                                        {formatCell((record as any)[col.key], col.key)}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="modal-footer">
                        <span className="text-muted small">
                            Showing {page * PAGE_SIZE + 1}-{Math.min((page + 1) * PAGE_SIZE, sortedRecords.length)} of {sortedRecords.length} records
                        </span>
                        {totalPages > 1 && (
                            <div className="btn-group btn-group-sm mx-auto">
                                <button
                                    className="btn btn-outline-secondary"
                                    disabled={page === 0}
                                    onClick={() => setPage(0)}
                                    title="First page"
                                >
                                    <i className="bi bi-chevron-bar-left"></i>
                                </button>
                                <button
                                    className="btn btn-outline-secondary"
                                    disabled={page === 0}
                                    onClick={() => setPage(p => p - 1)}
                                >
                                    Previous
                                </button>
                                <span className="btn btn-outline-secondary disabled">
                                    {page + 1} / {totalPages}
                                </span>
                                <button
                                    className="btn btn-outline-secondary"
                                    disabled={page >= totalPages - 1}
                                    onClick={() => setPage(p => p + 1)}
                                >
                                    Next
                                </button>
                                <button
                                    className="btn btn-outline-secondary"
                                    disabled={page >= totalPages - 1}
                                    onClick={() => setPage(totalPages - 1)}
                                    title="Last page"
                                >
                                    <i className="bi bi-chevron-bar-right"></i>
                                </button>
                            </div>
                        )}
                        <button type="button" className="btn btn-secondary" onClick={onClose}>
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Column definitions for each drill-down type
function getColumns(type: DrillDownType): { key: string; label: string }[] {
    switch (type) {
        case 'hires':
            return [
                { key: 'candidateId', label: 'Candidate' },
                { key: 'reqId', label: 'Req ID' },
                { key: 'reqTitle', label: 'Job Title' },
                { key: 'source', label: 'Source' },
                { key: 'recruiter', label: 'Recruiter' },
                { key: 'date', label: 'Hire Date' }
            ];
        case 'weightedHires':
            return [
                { key: 'candidateId', label: 'Candidate' },
                { key: 'reqTitle', label: 'Job Title' },
                { key: 'level', label: 'Level' },
                { key: 'levelWeight', label: 'Level Wt' },
                { key: 'hmWeight', label: 'HM Wt' },
                { key: 'complexityScore', label: 'Total Score' },
                { key: 'date', label: 'Hire Date' }
            ];
        case 'offers':
            return [
                { key: 'candidateId', label: 'Candidate' },
                { key: 'reqId', label: 'Req ID' },
                { key: 'reqTitle', label: 'Job Title' },
                { key: 'recruiter', label: 'Recruiter' },
                { key: 'status', label: 'Status' },
                { key: 'date', label: 'Offer Date' }
            ];
        case 'offerAcceptRate':
            return [
                { key: 'candidateId', label: 'Candidate' },
                { key: 'reqTitle', label: 'Job Title' },
                { key: 'recruiter', label: 'Recruiter' },
                { key: 'date', label: 'Offer Date' },
                { key: 'status', label: 'Outcome' }
            ];
        case 'medianTTF':
            return [
                { key: 'candidateId', label: 'Candidate' },
                { key: 'reqTitle', label: 'Job Title' },
                { key: 'recruiter', label: 'Recruiter' },
                { key: 'openDate', label: 'Req Opened' },
                { key: 'hireDate', label: 'Hired' },
                { key: 'daysToFill', label: 'Days to Fill' }
            ];
        case 'screens':
        case 'submittals':
            return [
                { key: 'candidateId', label: 'Candidate' },
                { key: 'reqId', label: 'Req ID' },
                { key: 'reqTitle', label: 'Job Title' },
                { key: 'stage', label: 'Stage' },
                { key: 'recruiter', label: 'Recruiter' },
                { key: 'date', label: 'Date' }
            ];
        case 'openReqs':
        case 'stalledReqs':
            return [
                { key: 'reqId', label: 'Req ID' },
                { key: 'reqTitle', label: 'Job Title' },
                { key: 'level', label: 'Level' },
                { key: 'recruiter', label: 'Recruiter' },
                { key: 'hiringManager', label: 'HM' },
                { key: 'ageInDays', label: 'Age (days)' },
                { key: 'status', label: 'Status' }
            ];
        default:
            return [
                { key: 'reqId', label: 'Req ID' },
                { key: 'reqTitle', label: 'Job Title' }
            ];
    }
}

// Format cell values for display
function formatCell(value: any, key: string): React.ReactNode {
    if (value == null) return <span className="text-muted">—</span>;

    if (value instanceof Date) {
        return format(value, 'MMM d, yyyy');
    }

    if (key === 'complexityScore' || key === 'levelWeight' || key === 'hmWeight') {
        return typeof value === 'number' ? value.toFixed(2) : value;
    }

    if (key === 'status') {
        const statusClass = value === 'Accepted' ? 'success' :
            value === 'Declined' ? 'danger' :
                value === 'Open' ? 'primary' : 'secondary';
        return <span className={`badge bg-${statusClass}`}>{value}</span>;
    }

    if (key === 'ageInDays') {
        const color = value > 90 ? 'text-danger fw-bold' : value > 60 ? 'text-warning' : '';
        return <span className={color}>{value}d</span>;
    }

    if (key === 'daysToFill') {
        const color = value > 90 ? 'text-danger fw-bold' : value > 60 ? 'text-warning' : 'text-success';
        return <span className={color}>{value}d</span>;
    }

    if (key === 'openDate' || key === 'hireDate') {
        return value instanceof Date ? format(value, 'MMM d, yyyy') : <span className="text-muted">—</span>;
    }

    return String(value);
}

// Helper function to build drill-down records from raw data
export function buildHiresRecords(
    candidates: Candidate[],
    requisitions: Requisition[],
    users: User[],
    complexityScores?: Map<string, { totalScore: number; levelWeight: number; hmWeight: number }>
): DrillDownRecord[] {
    const reqMap = new Map(requisitions.map(r => [r.req_id, r]));
    const userMap = new Map(users.map(u => [u.user_id, u.name]));

    return candidates
        .filter(c => c.hired_at)
        .map(c => {
            const req = reqMap.get(c.req_id);
            const complexity = complexityScores?.get(c.req_id);
            return {
                id: c.candidate_id,
                candidateId: c.candidate_id,
                reqId: c.req_id,
                reqTitle: req?.req_title || 'Unknown',
                level: req?.level,
                recruiter: userMap.get(req?.recruiter_id || '') || req?.recruiter_id,
                hiringManager: userMap.get(req?.hiring_manager_id || '') || req?.hiring_manager_id,
                source: c.source,
                date: c.hired_at!,
                complexityScore: complexity?.totalScore,
                levelWeight: complexity?.levelWeight,
                hmWeight: complexity?.hmWeight
            };
        });
}

export function buildOffersRecords(
    candidates: Candidate[],
    requisitions: Requisition[],
    users: User[]
): DrillDownRecord[] {
    const reqMap = new Map(requisitions.map(r => [r.req_id, r]));
    const userMap = new Map(users.map(u => [u.user_id, u.name]));

    return candidates
        .filter(c => c.offer_extended_at)
        .map(c => {
            const req = reqMap.get(c.req_id);
            return {
                id: c.candidate_id,
                candidateId: c.candidate_id,
                reqId: c.req_id,
                reqTitle: req?.req_title || 'Unknown',
                recruiter: userMap.get(req?.recruiter_id || '') || req?.recruiter_id,
                date: c.offer_extended_at!,
                status: c.offer_accepted_at ? 'Accepted' :
                    c.disposition === 'Withdrawn' ? 'Declined' : 'Pending'
            };
        });
}

export function buildReqsRecords(
    requisitions: Requisition[],
    users: User[],
    stalledReqIds?: Set<string>
): DrillDownRecord[] {
    const userMap = new Map(users.map(u => [u.user_id, u.name]));
    const now = new Date();

    return requisitions.map(r => ({
        id: r.req_id,
        reqId: r.req_id,
        reqTitle: r.req_title,
        level: r.level,
        recruiter: userMap.get(r.recruiter_id) || r.recruiter_id,
        hiringManager: userMap.get(r.hiring_manager_id) || r.hiring_manager_id,
        status: r.status,
        ageInDays: Math.floor((now.getTime() - r.opened_at.getTime()) / (1000 * 60 * 60 * 24)),
        date: r.opened_at
    }));
}

export function buildTTFRecords(
    candidates: Candidate[],
    requisitions: Requisition[],
    users: User[]
): DrillDownRecord[] {
    const reqMap = new Map(requisitions.map(r => [r.req_id, r]));
    const userMap = new Map(users.map(u => [u.user_id, u.name]));

    return candidates
        .filter(c => c.hired_at)
        .map(c => {
            const req = reqMap.get(c.req_id);
            const openDate = req?.opened_at;
            const hireDate = c.hired_at!;
            const daysToFill = openDate
                ? Math.floor((hireDate.getTime() - openDate.getTime()) / (1000 * 60 * 60 * 24))
                : null;

            return {
                id: c.candidate_id,
                candidateId: c.candidate_id,
                reqId: c.req_id,
                reqTitle: req?.req_title || 'Unknown',
                recruiter: userMap.get(req?.recruiter_id || '') || req?.recruiter_id,
                openDate: openDate,
                hireDate: hireDate,
                daysToFill: daysToFill ?? undefined,
                date: hireDate
            };
        })
        .sort((a, b) => (a.daysToFill ?? 0) - (b.daysToFill ?? 0)); // Sort by TTF
}
