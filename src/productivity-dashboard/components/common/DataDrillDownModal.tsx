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
    | 'stalledReqs'
    | 'zombieReqs'
    | 'pipelineStage'
    | 'pipelineCoverage';

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
    candidateCount?: number;
    coverageStatus?: string;
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
                <i className={`bi bi-arrow-${sortDirection === 'asc' ? 'up' : 'down'}-short ml-1`}></i>
            )}
        </th>
    );

    return (
        <div
            className="fixed inset-0 z-50 flex items-start justify-center pt-20 pb-4 overflow-y-auto bg-black/60 backdrop-blur-sm"
            onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            <div className="w-full max-w-4xl mx-4 max-h-[calc(100vh-6rem)] flex flex-col">
                <div className="glass-panel overflow-hidden flex flex-col max-h-full">
                    <div className="px-4 py-3 border-b border-glass-border flex justify-between items-start">
                        <div>
                            <h5 className="text-lg font-semibold mb-1">{title}</h5>
                            <div className="flex items-center gap-3">
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-lg font-medium bg-primary text-white">{totalValue ?? records.length}</span>
                                <span className="text-muted-foreground text-sm">{records.length} records</span>
                            </div>
                        </div>
                        <button type="button" className="text-muted-foreground hover:text-white" onClick={onClose}>
                            <i className="bi bi-x text-2xl"></i>
                        </button>
                    </div>

                    <div className="flex-1 overflow-auto">
                        {/* Search and Export */}
                        <div className="flex justify-between items-center p-3 border-b border-glass-border">
                            <input
                                type="text"
                                className="w-full max-w-xs px-3 py-1.5 text-sm bg-transparent border border-glass-border rounded-md focus:outline-none focus:ring-1 focus:ring-accent-primary"
                                placeholder="Search..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                            <button
                                className="px-3 py-1.5 text-sm font-medium rounded-md bg-[var(--color-bg-surface)] hover:bg-[var(--color-bg-base)] border border-glass-border"
                                onClick={exportCSV}
                            >
                                <i className="bi bi-download mr-1"></i>
                                Export CSV
                            </button>
                        </div>

                        {/* Formula (if provided) */}
                        {formula && (
                            <div className="px-3 py-2 border-b border-glass-border" style={{ background: 'rgba(30, 41, 59, 0.6)' }}>
                                <small style={{ color: '#94A3B8' }}>
                                    <strong style={{ color: '#F8FAFC' }}>Formula:</strong> <code style={{ color: '#2dd4bf' }}>{formula}</code>
                                </small>
                            </div>
                        )}

                        {/* Data Table */}
                        <div className="overflow-x-auto">
                            <table className="w-full mb-0 table-fixed">
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
                                            <td colSpan={columns.length} className="text-center text-muted-foreground py-4">
                                                No records found
                                            </td>
                                        </tr>
                                    ) : (
                                        paginatedRecords.map((record, idx) => (
                                            <tr key={record.id || idx}>
                                                {columns.map(col => (
                                                    <td
                                                        key={col.key}
                                                        className="truncate"
                                                        style={{
                                                            padding: '0.5rem',
                                                            borderBottom: '1px solid var(--color-slate-100)',
                                                            fontSize: '0.8rem',
                                                            maxWidth: '150px'
                                                        }}
                                                        title={String((record as any)[col.key] ?? '')}
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

                    <div className="px-4 py-3 border-t border-glass-border flex justify-between items-center">
                        <span className="text-muted-foreground text-sm">
                            Showing {page * PAGE_SIZE + 1}-{Math.min((page + 1) * PAGE_SIZE, sortedRecords.length)} of {sortedRecords.length} records
                        </span>
                        {totalPages > 1 && (
                            <div className="inline-flex rounded-md shadow-sm mx-auto">
                                <button
                                    className="px-3 py-1.5 text-sm border border-glass-border rounded-l-md hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed"
                                    disabled={page === 0}
                                    onClick={() => setPage(0)}
                                    title="First page"
                                >
                                    <i className="bi bi-chevron-bar-left"></i>
                                </button>
                                <button
                                    className="px-3 py-1.5 text-sm border-y border-glass-border hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed"
                                    disabled={page === 0}
                                    onClick={() => setPage(p => p - 1)}
                                >
                                    Previous
                                </button>
                                <span className="px-3 py-1.5 text-sm border-y border-glass-border bg-white/5">
                                    {page + 1} / {totalPages}
                                </span>
                                <button
                                    className="px-3 py-1.5 text-sm border-y border-glass-border hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed"
                                    disabled={page >= totalPages - 1}
                                    onClick={() => setPage(p => p + 1)}
                                >
                                    Next
                                </button>
                                <button
                                    className="px-3 py-1.5 text-sm border border-glass-border rounded-r-md hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed"
                                    disabled={page >= totalPages - 1}
                                    onClick={() => setPage(totalPages - 1)}
                                    title="Last page"
                                >
                                    <i className="bi bi-chevron-bar-right"></i>
                                </button>
                            </div>
                        )}
                        <button type="button" className="px-4 py-2 text-sm font-medium rounded-md bg-[var(--color-bg-surface)] hover:bg-[var(--color-bg-base)] border border-glass-border" onClick={onClose}>
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
        case 'zombieReqs':
            return [
                { key: 'reqId', label: 'Req ID' },
                { key: 'reqTitle', label: 'Job Title' },
                { key: 'level', label: 'Level' },
                { key: 'recruiter', label: 'Recruiter' },
                { key: 'hiringManager', label: 'HM' },
                { key: 'ageInDays', label: 'Age (days)' },
                { key: 'status', label: 'Status' }
            ];
        case 'pipelineStage':
            return [
                { key: 'candidateId', label: 'Candidate' },
                { key: 'reqId', label: 'Req ID' },
                { key: 'reqTitle', label: 'Job Title' },
                { key: 'stage', label: 'Current Stage' },
                { key: 'source', label: 'Source' },
                { key: 'recruiter', label: 'Recruiter' },
                { key: 'date', label: 'Stage Entered' }
            ];
        case 'pipelineCoverage':
            return [
                { key: 'reqId', label: 'Req ID' },
                { key: 'reqTitle', label: 'Job Title' },
                { key: 'candidateCount', label: 'Candidates' },
                { key: 'coverageStatus', label: 'Coverage' },
                { key: 'recruiter', label: 'Recruiter' },
                { key: 'hiringManager', label: 'HM' },
                { key: 'ageInDays', label: 'Age (days)' }
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
    if (value == null) return <span className="text-muted-foreground">—</span>;

    if (value instanceof Date) {
        return format(value, 'MMM d, yyyy');
    }

    if (key === 'complexityScore' || key === 'levelWeight' || key === 'hmWeight') {
        return typeof value === 'number' ? value.toFixed(2) : value;
    }

    if (key === 'status') {
        const statusBg = value === 'Accepted' ? 'bg-success' :
            value === 'Declined' ? 'bg-danger' :
                value === 'Open' ? 'bg-primary' : 'bg-secondary';
        return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${statusBg} text-white`}>{value}</span>;
    }

    if (key === 'ageInDays') {
        const color = value > 90 ? 'text-danger font-bold' : value > 60 ? 'text-warning' : '';
        return <span className={color}>{value}d</span>;
    }

    if (key === 'daysToFill') {
        // Negative values indicate data quality issues (hired before req opened)
        if (value < 0) {
            return <span className="text-danger font-bold" title="Data issue: Hired before req opened">{value}d</span>;
        }
        const color = value > 90 ? 'text-danger font-bold' : value > 60 ? 'text-warning' : 'text-success';
        return <span className={color}>{value}d</span>;
    }

    if (key === 'openDate' || key === 'hireDate') {
        return value instanceof Date ? format(value, 'MMM d, yyyy') : <span className="text-muted-foreground">—</span>;
    }

    if (key === 'coverageStatus') {
        const statusColor = value === 'Empty' ? 'bg-red-500' :
            value === 'Critical' ? 'bg-orange-500' :
                value === 'Low' ? 'bg-yellow-500' : 'bg-green-500';
        return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${statusColor} text-white`}>{value}</span>;
    }

    if (key === 'candidateCount') {
        const color = value === 0 ? 'text-red-500 font-bold' :
            value < 4 ? 'text-orange-500 font-semibold' :
                value < 8 ? 'text-yellow-500' : 'text-green-500';
        return <span className={color}>{value}</span>;
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

    return requisitions
        .filter(r => r.opened_at)  // STRICT: only include reqs with opened_at
        .map(r => ({
            id: r.req_id,
            reqId: r.req_id,
            reqTitle: r.req_title,
            level: r.level,
            recruiter: userMap.get(r.recruiter_id) || r.recruiter_id,
            hiringManager: userMap.get(r.hiring_manager_id) || r.hiring_manager_id,
            status: r.status,
            ageInDays: Math.floor((now.getTime() - r.opened_at!.getTime()) / (1000 * 60 * 60 * 24)),
            date: r.opened_at ?? undefined
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
                openDate: openDate ?? undefined,  // STRICT: convert null to undefined for type compat
                hireDate: hireDate,
                daysToFill: daysToFill ?? undefined,
                date: hireDate
            };
        })
        // Sort: valid positive TTF first (ascending), then invalid/negative at the end
        .sort((a, b) => {
            const aValid = (a.daysToFill ?? -1) >= 0;
            const bValid = (b.daysToFill ?? -1) >= 0;
            // If one is valid and one isn't, valid comes first
            if (aValid && !bValid) return -1;
            if (!aValid && bValid) return 1;
            // Otherwise sort by TTF value
            return (a.daysToFill ?? 0) - (b.daysToFill ?? 0);
        });
}

export function buildPipelineStageRecords(
    candidates: Candidate[],
    requisitions: Requisition[],
    users: User[]
): DrillDownRecord[] {
    const reqMap = new Map(requisitions.map(r => [r.req_id, r]));
    const userMap = new Map(users.map(u => [u.user_id, u.name]));

    return candidates.map(c => {
        const req = reqMap.get(c.req_id);
        return {
            id: c.candidate_id,
            candidateId: c.candidate_id,
            reqId: c.req_id,
            reqTitle: req?.req_title || 'Unknown',
            stage: c.current_stage || 'Unknown',
            source: c.source,
            recruiter: userMap.get(req?.recruiter_id || '') || req?.recruiter_id,
            date: c.current_stage_entered_at ?? c.applied_at ?? undefined
        };
    });
}

/**
 * Build pipeline coverage records - shows open reqs with their candidate counts
 * Sorted by candidate count ascending (reqs needing attention first)
 */
export function buildPipelineCoverageRecords(
    requisitions: Requisition[],
    candidates: Candidate[],
    users: User[],
    targetCandidatesPerReq: number = 8
): DrillDownRecord[] {
    const userMap = new Map(users.map(u => [u.user_id, u.name]));
    const now = new Date();

    // Count active candidates per req
    const candidateCountByReq = new Map<string, number>();
    for (const c of candidates) {
        // Only count active candidates (not hired, rejected, or withdrawn)
        if (!c.hired_at &&
            c.disposition !== 'Rejected' &&
            c.disposition !== 'Withdrawn') {
            candidateCountByReq.set(c.req_id, (candidateCountByReq.get(c.req_id) || 0) + 1);
        }
    }

    // Filter to open reqs only
    const openReqs = requisitions.filter(r => !r.closed_at && r.opened_at);

    return openReqs
        .map(r => {
            const count = candidateCountByReq.get(r.req_id) || 0;
            let coverageStatus: string;
            if (count === 0) {
                coverageStatus = 'Empty';
            } else if (count < targetCandidatesPerReq / 2) {
                coverageStatus = 'Critical';
            } else if (count < targetCandidatesPerReq) {
                coverageStatus = 'Low';
            } else {
                coverageStatus = 'Healthy';
            }

            return {
                id: r.req_id,
                reqId: r.req_id,
                reqTitle: r.req_title,
                candidateCount: count,
                coverageStatus,
                recruiter: userMap.get(r.recruiter_id) || r.recruiter_id,
                hiringManager: userMap.get(r.hiring_manager_id) || r.hiring_manager_id,
                ageInDays: Math.floor((now.getTime() - r.opened_at!.getTime()) / (1000 * 60 * 60 * 24)),
                level: r.level,
                status: r.status
            };
        })
        // Sort by candidate count ascending (lowest first = needs attention)
        .sort((a, b) => (a.candidateCount ?? 0) - (b.candidateCount ?? 0));
}
