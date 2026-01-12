// HM Overview Component
// Shows aggregated HM metrics with leaderboard and summary cards with multi-select support

import React, { useMemo, useState } from 'react';
import { HMRollup } from '../../types/hmTypes';

interface HMOverviewProps {
    hmRollups: HMRollup[];
    onToggleHM: (hmUserId: string) => void;
    selectedHmUserIds: Set<string>;
    onClearSelection: () => void;
}

type SortField = 'hmName' | 'totalOpenReqs' | 'pendingActionsCount' | 'totalActiveCandidates' | 'feedbackDueCount' | 'reviewDueCount' | 'reqsWithRiskFlags';

export function HMOverview({ hmRollups, onToggleHM, selectedHmUserIds, onClearSelection }: HMOverviewProps) {
    const [sortField, setSortField] = useState<SortField>('pendingActionsCount');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

    // Calculate summary stats - filtered by selection if any
    const summary = useMemo(() => {
        const filteredHMs = selectedHmUserIds.size > 0
            ? hmRollups.filter(hm => selectedHmUserIds.has(hm.hmUserId))
            : hmRollups;

        return {
            totalHMs: filteredHMs.length,
            totalOpenReqs: filteredHMs.reduce((sum, hm) => sum + hm.totalOpenReqs, 0),
            totalPendingActions: filteredHMs.reduce((sum, hm) => sum + hm.pendingActionsCount, 0),
            totalActiveCandidates: filteredHMs.reduce((sum, hm) => sum + hm.totalActiveCandidates, 0),
            hmsWithRiskFlags: filteredHMs.filter(hm => hm.reqsWithRiskFlags > 0).length,
            isFiltered: selectedHmUserIds.size > 0
        };
    }, [hmRollups, selectedHmUserIds]);

    // Sort HMs
    const sortedHMs = useMemo(() => {
        return [...hmRollups].sort((a, b) => {
            let aVal: string | number;
            let bVal: string | number;

            switch (sortField) {
                case 'hmName':
                    aVal = a.hmName.toLowerCase();
                    bVal = b.hmName.toLowerCase();
                    break;
                case 'totalOpenReqs':
                    aVal = a.totalOpenReqs;
                    bVal = b.totalOpenReqs;
                    break;
                case 'pendingActionsCount':
                    aVal = a.pendingActionsCount;
                    bVal = b.pendingActionsCount;
                    break;
                case 'totalActiveCandidates':
                    aVal = a.totalActiveCandidates;
                    bVal = b.totalActiveCandidates;
                    break;
                case 'feedbackDueCount':
                    aVal = a.feedbackDueCount;
                    bVal = b.feedbackDueCount;
                    break;
                case 'reviewDueCount':
                    aVal = a.reviewDueCount;
                    bVal = b.reviewDueCount;
                    break;
                case 'reqsWithRiskFlags':
                    aVal = a.reqsWithRiskFlags;
                    bVal = b.reqsWithRiskFlags;
                    break;
            }

            if (typeof aVal === 'string' && typeof bVal === 'string') {
                return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
            }
            return sortDirection === 'asc'
                ? (aVal as number) - (bVal as number)
                : (bVal as number) - (aVal as number);
        });
    }, [hmRollups, sortField, sortDirection]);

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('desc');
        }
    };

    // Select/deselect all
    const handleSelectAll = () => {
        if (selectedHmUserIds.size === hmRollups.length) {
            onClearSelection();
        } else {
            hmRollups.forEach(hm => {
                if (!selectedHmUserIds.has(hm.hmUserId)) {
                    onToggleHM(hm.hmUserId);
                }
            });
        }
    };

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
            {/* Filter Indicator */}
            {summary.isFiltered && (
                <div className="d-flex justify-content-between align-items-center mb-3 bg-primary bg-opacity-10 border border-primary border-opacity-25 rounded p-2 px-3">
                    <div className="d-flex align-items-center">
                        <span style={{ color: 'var(--color-primary)', marginRight: '0.5rem' }}>🔽</span>
                        <span className="text-primary fw-medium">
                            Showing stats for {selectedHmUserIds.size} selected HM{selectedHmUserIds.size > 1 ? 's' : ''}
                        </span>
                    </div>
                    <button
                        className="btn btn-sm btn-outline-primary"
                        onClick={onClearSelection}
                    >
                        Show All
                    </button>
                </div>
            )}

            {/* Summary Cards */}
            <div className="row g-3 mb-4">
                <div className="col-md-3">
                    <div className="p-3 h-100 d-flex flex-column justify-content-center" style={{ background: '#141414', border: '1px solid #27272a', borderRadius: '2px', borderTop: '2px solid #94A3B8' }}>
                        <div style={{ fontSize: '0.65rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94A3B8', marginBottom: '0.5rem' }}>Hiring Managers</div>
                        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, fontSize: '1.75rem', color: '#94A3B8' }}>{summary.totalHMs}</div>
                        <div style={{ fontSize: '0.7rem', color: '#94A3B8', marginTop: '0.25rem' }}>{summary.isFiltered ? 'Selected' : 'Active users'}</div>
                    </div>
                </div>
                <div className="col-md-3">
                    <div className="p-3 h-100 d-flex flex-column justify-content-center" style={{ background: '#141414', border: '1px solid #27272a', borderRadius: '2px', borderTop: '2px solid #f59e0b' }}>
                        <div style={{ fontSize: '0.65rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94A3B8', marginBottom: '0.5rem' }}>Open Requisitions</div>
                        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, fontSize: '1.75rem', color: '#f59e0b' }}>{summary.totalOpenReqs}</div>
                        <div style={{ fontSize: '0.7rem', color: '#94A3B8', marginTop: '0.25rem' }}>Active positions</div>
                    </div>
                </div>
                <div className="col-md-3">
                    <div className="p-3 h-100 d-flex flex-column justify-content-center" style={{ background: '#141414', border: '1px solid #27272a', borderRadius: '2px', borderTop: '2px solid #F59E0B' }}>
                        <div style={{ fontSize: '0.65rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94A3B8', marginBottom: '0.5rem' }}>Pending Actions</div>
                        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, fontSize: '1.75rem', color: '#F59E0B' }}>{summary.totalPendingActions}</div>
                        <div style={{ fontSize: '0.7rem', color: '#94A3B8', marginTop: '0.25rem' }}>Requiring attention</div>
                    </div>
                </div>
                <div className="col-md-3">
                    <div className="p-3 h-100 d-flex flex-column justify-content-center" style={{ background: '#141414', border: '1px solid #27272a', borderRadius: '2px', borderTop: '2px solid #2dd4bf' }}>
                        <div style={{ fontSize: '0.65rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94A3B8', marginBottom: '0.5rem' }}>Active Candidates</div>
                        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, fontSize: '1.75rem', color: '#2dd4bf' }}>{summary.totalActiveCandidates}</div>
                        <div style={{ fontSize: '0.7rem', color: '#94A3B8', marginTop: '0.25rem' }}>In pipeline</div>
                    </div>
                </div>
            </div>

            {/* Speed & Benchmarks */}
            <div className="card-bespoke mb-4">
                <div className="card-header border-bottom-0 pb-0">
                    <h6 className="mb-0">Speed & Benchmarks</h6>
                </div>
                <div className="card-body">
                    <div className="row g-4">
                        <div className="col-md-4">
                            <div className="d-flex align-items-center gap-3">
                                <div className="p-3 rounded-circle bg-primary bg-opacity-10 text-primary">
                                    💬
                                </div>
                                <div className="flex-grow-1">
                                    <div className="text-muted small">Median Feedback Speed</div>
                                    <div className="d-flex align-items-baseline gap-2">
                                        <h4 className="mb-0">
                                            {(() => {
                                                const targetHMs = selectedHmUserIds.size > 0
                                                    ? hmRollups.filter(r => selectedHmUserIds.has(r.hmUserId))
                                                    : hmRollups;

                                                const validSpeeds = targetHMs
                                                    .map(r => r.latencyMetrics.feedbackLatency.median)
                                                    .filter((n): n is number => n !== null && n > 0)
                                                    .sort((a, b) => a - b);

                                                if (validSpeeds.length === 0) return '—';

                                                const mid = Math.floor(validSpeeds.length / 2);
                                                const median = validSpeeds.length % 2 !== 0
                                                    ? validSpeeds[mid]
                                                    : (validSpeeds[mid - 1] + validSpeeds[mid]) / 2;

                                                return Math.round(median * 10) / 10;
                                            })()}
                                            <small className="fs-6 fw-normal text-muted ms-1">days</small>
                                        </h4>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="col-md-4">
                            <div className="d-flex align-items-center gap-3">
                                <div className="p-3 rounded-circle bg-info bg-opacity-10 text-info">
                                    🔍
                                </div>
                                <div className="flex-grow-1">
                                    <div className="text-muted small">Median Review Speed</div>
                                    <div className="d-flex align-items-baseline gap-2">
                                        <h4 className="mb-0">
                                            {(() => {
                                                const targetHMs = selectedHmUserIds.size > 0
                                                    ? hmRollups.filter(r => selectedHmUserIds.has(r.hmUserId))
                                                    : hmRollups;

                                                const validSpeeds = targetHMs
                                                    .map(r => r.latencyMetrics.reviewLatency.median)
                                                    .filter((n): n is number => n !== null && n > 0)
                                                    .sort((a, b) => a - b);

                                                if (validSpeeds.length === 0) return '—';

                                                const mid = Math.floor(validSpeeds.length / 2);
                                                const median = validSpeeds.length % 2 !== 0
                                                    ? validSpeeds[mid]
                                                    : (validSpeeds[mid - 1] + validSpeeds[mid]) / 2;

                                                return Math.round(median * 10) / 10;
                                            })()}
                                            <small className="fs-6 fw-normal text-muted ms-1">days</small>
                                        </h4>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="col-md-4">
                            <div className="d-flex align-items-center gap-3 text-muted">
                                <div className="p-3 rounded-circle bg-slate-100 text-slate-400">
                                    🎯
                                </div>
                                <div className="flex-grow-1">
                                    <div className="text-muted small">Team Median (Global)</div>
                                    <div className="d-flex align-items-baseline gap-2">
                                        <h4 className="mb-0">
                                            {/* We can improve this math later */}
                                            {Math.round(hmRollups.reduce((acc, r) => acc + (r.latencyMetrics.feedbackLatency.median || 0), 0) / (hmRollups.filter(r => r.latencyMetrics.feedbackLatency.median !== null).length || 1))}
                                            <small className="fs-6 fw-normal text-muted ms-1">days</small>
                                        </h4>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* HM Leaderboard */}
            <div className="card-bespoke">
                <div className="card-header d-flex justify-content-between align-items-center">
                    <h6 className="mb-0">Hiring Manager Leaderboard</h6>
                    <div className="d-flex align-items-center gap-2">
                        {selectedHmUserIds.size > 0 && (
                            <span className="badge bg-primary">{selectedHmUserIds.size} selected</span>
                        )}
                        {selectedHmUserIds.size > 0 && (
                            <button
                                className="btn btn-sm btn-outline-secondary"
                                onClick={onClearSelection}
                            >
                                Clear Selection
                            </button>
                        )}
                    </div>
                </div>
                <div className="card-body p-0">
                    <div className="table-responsive">
                        <table className="table table-hover mb-0" style={{ tableLayout: 'fixed', minWidth: '900px' }}>
                            <thead>
                                <tr style={{ background: '#0a0a0a' }}>
                                    <th style={{ width: '40px', ...thStyle }}>
                                        <input
                                            type="checkbox"
                                            className="form-check-input"
                                            checked={selectedHmUserIds.size === hmRollups.length && hmRollups.length > 0}
                                            onChange={handleSelectAll}
                                            title="Select all"
                                        />
                                    </th>
                                    <th
                                        style={{ width: '160px', ...sortableThStyle('hmName') }}
                                        onClick={() => handleSort('hmName')}
                                    >
                                        Hiring Manager
                                        {sortField === 'hmName' && <span style={{ marginLeft: '2px', fontSize: '0.6rem' }}>{sortDirection === 'desc' ? '▼' : '▲'}</span>}
                                    </th>
                                    <th style={thStyle}>Team</th>
                                    <th
                                        className="text-end"
                                        style={sortableThStyle('totalOpenReqs')}
                                        onClick={() => handleSort('totalOpenReqs')}
                                    >
                                        Open
                                        {sortField === 'totalOpenReqs' && <span style={{ marginLeft: '2px', fontSize: '0.6rem' }}>{sortDirection === 'desc' ? '▼' : '▲'}</span>}
                                    </th>
                                    <th
                                        className="text-end"
                                        style={sortableThStyle('totalActiveCandidates')}
                                        onClick={() => handleSort('totalActiveCandidates')}
                                    >
                                        Pipeline
                                        {sortField === 'totalActiveCandidates' && <span style={{ marginLeft: '2px', fontSize: '0.6rem' }}>{sortDirection === 'desc' ? '▼' : '▲'}</span>}
                                    </th>
                                    <th
                                        className="text-end"
                                        style={sortableThStyle('pendingActionsCount')}
                                        onClick={() => handleSort('pendingActionsCount')}
                                    >
                                        Actions
                                        {sortField === 'pendingActionsCount' && <span style={{ marginLeft: '2px', fontSize: '0.6rem' }}>{sortDirection === 'desc' ? '▼' : '▲'}</span>}
                                    </th>
                                    <th
                                        className="text-end"
                                        style={sortableThStyle('feedbackDueCount')}
                                        onClick={() => handleSort('feedbackDueCount')}
                                    >
                                        Feedback
                                        {sortField === 'feedbackDueCount' && <span style={{ marginLeft: '2px', fontSize: '0.6rem' }}>{sortDirection === 'desc' ? '▼' : '▲'}</span>}
                                    </th>
                                    <th
                                        className="text-end"
                                        style={sortableThStyle('reviewDueCount')}
                                        onClick={() => handleSort('reviewDueCount')}
                                    >
                                        Review
                                        {sortField === 'reviewDueCount' && <span style={{ marginLeft: '2px', fontSize: '0.6rem' }}>{sortDirection === 'desc' ? '▼' : '▲'}</span>}
                                    </th>
                                    <th
                                        className="text-end"
                                        style={sortableThStyle('reqsWithRiskFlags')}
                                        onClick={() => handleSort('reqsWithRiskFlags')}
                                    >
                                        Risk
                                        {sortField === 'reqsWithRiskFlags' && <span style={{ marginLeft: '2px', fontSize: '0.6rem' }}>{sortDirection === 'desc' ? '▼' : '▲'}</span>}
                                    </th>
                                    <th className="text-end" style={thStyle}>FB Speed</th>
                                    <th className="text-end" style={thStyle}>RV Speed</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedHMs.map(hm => {
                                    const isSelected = selectedHmUserIds.has(hm.hmUserId);
                                    return (
                                        <tr
                                            key={hm.hmUserId}
                                            onClick={() => onToggleHM(hm.hmUserId)}
                                            className={`cursor-pointer ${isSelected ? 'table-primary' : ''}`}
                                        >
                                            <td style={tdStyle} onClick={e => e.stopPropagation()}>
                                                <input
                                                    type="checkbox"
                                                    className="form-check-input"
                                                    checked={isSelected}
                                                    onChange={() => onToggleHM(hm.hmUserId)}
                                                />
                                            </td>
                                            <td style={tdStyle}>
                                                <strong style={{ color: 'var(--color-slate-800)', fontSize: '0.85rem' }}>{hm.hmName}</strong>
                                                {hm.team && <small className="text-muted d-block" style={{ fontSize: '0.7rem' }}>{hm.team}</small>}
                                            </td>
                                            <td style={tdStyle} className="text-muted">{hm.team || '—'}</td>
                                            <td className="text-end" style={tdStyle}>{hm.totalOpenReqs}</td>
                                            <td className="text-end" style={tdStyle}>{hm.totalActiveCandidates}</td>
                                            <td className="text-end" style={tdStyle}>
                                                {hm.pendingActionsCount > 0 ? (
                                                    <span className="badge-bespoke badge-warning-soft" style={{ fontSize: '0.75rem' }}>
                                                        {hm.pendingActionsCount}
                                                    </span>
                                                ) : (
                                                    <span style={{ color: 'var(--color-slate-700)', fontSize: '0.85rem' }}>0</span>
                                                )}
                                            </td>
                                            <td className="text-end" style={tdStyle}>
                                                {hm.feedbackDueCount > 0 ? (
                                                    <span className="badge-bespoke badge-danger-soft" style={{ fontSize: '0.75rem' }}>
                                                        {hm.feedbackDueCount}
                                                    </span>
                                                ) : (
                                                    <span style={{ color: 'var(--color-slate-700)', fontSize: '0.85rem' }}>0</span>
                                                )}
                                            </td>
                                            <td className="text-end" style={tdStyle}>
                                                {hm.reviewDueCount > 0 ? (
                                                    <span className="badge-bespoke badge-warning-soft" style={{ fontSize: '0.75rem' }}>
                                                        {hm.reviewDueCount}
                                                    </span>
                                                ) : (
                                                    <span style={{ color: 'var(--color-slate-700)', fontSize: '0.85rem' }}>0</span>
                                                )}
                                            </td>
                                            <td className="text-end" style={tdStyle}>
                                                {hm.reqsWithRiskFlags > 0 ? (
                                                    <span className="badge-bespoke badge-danger-soft" style={{ fontSize: '0.75rem' }}>
                                                        {hm.reqsWithRiskFlags}
                                                    </span>
                                                ) : (
                                                    <span className="badge-bespoke" style={{ background: 'linear-gradient(135deg, #0f766e 0%, #14b8a6 100%)', color: 'white', fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}>
                                                        ✓
                                                    </span>
                                                )}
                                            </td>
                                            <td className="text-end" style={tdStyle}>
                                                {hm.latencyMetrics.feedbackLatency.median !== null ? (
                                                    <span style={{
                                                        color: (hm.latencyMetrics.feedbackLatency.median > (hm.peerComparison?.metrics.find(m => m.metricName === 'Feedback Speed')?.cohortP75 ?? 999)) ? 'var(--color-danger)' : 'var(--color-slate-700)',
                                                        fontWeight: 500
                                                    }}>
                                                        {hm.latencyMetrics.feedbackLatency.median}d
                                                    </span>
                                                ) : <span className="text-slate-300">—</span>}
                                            </td>
                                            <td className="text-end" style={tdStyle}>
                                                {hm.latencyMetrics.reviewLatency.median !== null ? (
                                                    <span style={{
                                                        color: (hm.latencyMetrics.reviewLatency.median > (hm.peerComparison?.metrics.find(m => m.metricName === 'Review Speed')?.cohortP75 ?? 999)) ? 'var(--color-danger)' : 'var(--color-slate-700)',
                                                        fontWeight: 500
                                                    }}>
                                                        {hm.latencyMetrics.reviewLatency.median}d
                                                    </span>
                                                ) : <span className="text-slate-300">—</span>}
                                            </td>
                                        </tr>
                                    );
                                })}
                                {sortedHMs.length === 0 && (
                                    <tr>
                                        <td colSpan={9} className="text-center text-muted py-5">
                                            No hiring managers found matching criteria
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
