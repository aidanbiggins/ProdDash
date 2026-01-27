// HM Overview Component
// Shows aggregated HM metrics with leaderboard and summary cards with multi-select support

import React, { useMemo, useState } from 'react';
import { HMRollup } from '../../types/hmTypes';
import { SectionHeader } from '../common/SectionHeader';
import { Checkbox } from '../../../components/ui/toggles';

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
        borderBottom: '2px solid var(--glass-border)',
        padding: '0.625rem 0.5rem',
        fontSize: '0.7rem',
        fontWeight: 600,
        textTransform: 'uppercase' as const,
        letterSpacing: '0.03em',
        color: 'var(--text-secondary)',
        whiteSpace: 'nowrap' as const
    };

    // Sortable header style
    const sortableThStyle = (field: SortField) => ({
        ...thStyle,
        cursor: 'pointer',
        userSelect: 'none' as const,
        color: sortField === field ? 'var(--accent)' : 'var(--text-secondary)'
    });

    // Cell style
    const tdStyle = {
        padding: '0.5rem',
        borderBottom: '1px solid var(--glass-border)',
        color: 'var(--text-primary)',
        fontSize: '0.85rem'
    };

    return (
        <div className="animate-fade-in">
            {/* Filter Indicator */}
            {summary.isFiltered && (
                <div className="flex justify-between items-center mb-3 bg-primary/10 border border-primary/25 rounded p-2 px-3">
                    <div className="flex items-center">
                        <span style={{ color: 'var(--color-primary)', marginRight: '0.5rem' }}>🔽</span>
                        <span className="text-primary font-medium">
                            Showing stats for {selectedHmUserIds.size} selected HM{selectedHmUserIds.size > 1 ? 's' : ''}
                        </span>
                    </div>
                    <button
                        className="px-3 py-1 text-sm border border-blue-500 text-blue-500 rounded hover:bg-blue-500/10 transition-colors"
                        onClick={onClearSelection}
                    >
                        Show All
                    </button>
                </div>
            )}

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
                <div>
                    <div className="p-3 h-full flex flex-col justify-center" style={{ background: '#141414', border: '1px solid #27272a', borderRadius: '2px', borderTop: '2px solid #94A3B8' }}>
                        <div style={{ fontSize: '0.65rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94A3B8', marginBottom: '0.5rem' }}>Hiring Managers</div>
                        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, fontSize: '1.75rem', color: '#94A3B8' }}>{summary.totalHMs}</div>
                        <div style={{ fontSize: '0.7rem', color: '#94A3B8', marginTop: '0.25rem' }}>{summary.isFiltered ? 'Selected' : 'Active users'}</div>
                    </div>
                </div>
                <div>
                    <div className="p-3 h-full flex flex-col justify-center" style={{ background: '#141414', border: '1px solid #27272a', borderRadius: '2px', borderTop: '2px solid #f59e0b' }}>
                        <div style={{ fontSize: '0.65rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94A3B8', marginBottom: '0.5rem' }}>Open Requisitions</div>
                        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, fontSize: '1.75rem', color: '#f59e0b' }}>{summary.totalOpenReqs}</div>
                        <div style={{ fontSize: '0.7rem', color: '#94A3B8', marginTop: '0.25rem' }}>Active positions</div>
                    </div>
                </div>
                <div>
                    <div className="p-3 h-full flex flex-col justify-center" style={{ background: '#141414', border: '1px solid #27272a', borderRadius: '2px', borderTop: '2px solid #F59E0B' }}>
                        <div style={{ fontSize: '0.65rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94A3B8', marginBottom: '0.5rem' }}>Pending Actions</div>
                        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, fontSize: '1.75rem', color: '#F59E0B' }}>{summary.totalPendingActions}</div>
                        <div style={{ fontSize: '0.7rem', color: '#94A3B8', marginTop: '0.25rem' }}>Requiring attention</div>
                    </div>
                </div>
                <div>
                    <div className="p-3 h-full flex flex-col justify-center" style={{ background: '#141414', border: '1px solid #27272a', borderRadius: '2px', borderTop: '2px solid #2dd4bf' }}>
                        <div style={{ fontSize: '0.65rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94A3B8', marginBottom: '0.5rem' }}>Active Candidates</div>
                        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, fontSize: '1.75rem', color: '#2dd4bf' }}>{summary.totalActiveCandidates}</div>
                        <div style={{ fontSize: '0.7rem', color: '#94A3B8', marginTop: '0.25rem' }}>In pipeline</div>
                    </div>
                </div>
            </div>

            {/* Speed & Benchmarks */}
            <div className="card-bespoke mb-4">
                <div className="card-header border-b-0 pb-0">
                    <h6 className="mb-0">Speed & Benchmarks</h6>
                </div>
                <div className="card-body">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <div className="flex items-center gap-3">
                                <div className="p-3 rounded-full bg-primary/10 text-primary">
                                    💬
                                </div>
                                <div className="grow">
                                    <div className="text-muted-foreground text-sm">Median Feedback Speed</div>
                                    <div className="flex items-baseline gap-2">
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
                                            <small className="text-base font-normal text-muted-foreground ml-1">days</small>
                                        </h4>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div>
                            <div className="flex items-center gap-3">
                                <div className="p-3 rounded-full bg-cyan-500/10 text-cyan-500">
                                    🔍
                                </div>
                                <div className="grow">
                                    <div className="text-muted-foreground text-sm">Median Review Speed</div>
                                    <div className="flex items-baseline gap-2">
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
                                            <small className="text-base font-normal text-muted-foreground ml-1">days</small>
                                        </h4>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div>
                            <div className="flex items-center gap-3 text-muted-foreground">
                                <div className="p-3 rounded-full bg-slate-100 text-slate-400">
                                    🎯
                                </div>
                                <div className="grow">
                                    <div className="text-muted-foreground text-sm">Team Median (Global)</div>
                                    <div className="flex items-baseline gap-2">
                                        <h4 className="mb-0">
                                            {/* We can improve this math later */}
                                            {Math.round(hmRollups.reduce((acc, r) => acc + (r.latencyMetrics.feedbackLatency.median || 0), 0) / (hmRollups.filter(r => r.latencyMetrics.feedbackLatency.median !== null).length || 1))}
                                            <small className="text-base font-normal text-muted-foreground ml-1">days</small>
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
                <div className="card-header">
                    <SectionHeader
                        title="Hiring Manager Leaderboard"
                        badge={selectedHmUserIds.size > 0 ? (
                            <span className="px-2 py-1 text-xs bg-primary text-white rounded">{selectedHmUserIds.size} selected</span>
                        ) : undefined}
                        actions={selectedHmUserIds.size > 0 ? (
                            <button
                                className="px-3 py-1 text-sm border border-slate-400 text-slate-400 rounded hover:bg-slate-400/10 transition-colors"
                                onClick={onClearSelection}
                            >
                                Clear Selection
                            </button>
                        ) : undefined}
                    />
                </div>
                <div className="card-body p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full mb-0" style={{ tableLayout: 'fixed', minWidth: '900px' }}>
                            <thead>
                                <tr style={{ background: '#0a0a0a' }}>
                                    <th style={{ width: '40px', ...thStyle }}>
                                        <Checkbox
                                            checked={selectedHmUserIds.size === hmRollups.length && hmRollups.length > 0}
                                            onChange={handleSelectAll}
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
                                        className="text-right"
                                        style={sortableThStyle('totalOpenReqs')}
                                        onClick={() => handleSort('totalOpenReqs')}
                                    >
                                        Open
                                        {sortField === 'totalOpenReqs' && <span style={{ marginLeft: '2px', fontSize: '0.6rem' }}>{sortDirection === 'desc' ? '▼' : '▲'}</span>}
                                    </th>
                                    <th
                                        className="text-right"
                                        style={sortableThStyle('totalActiveCandidates')}
                                        onClick={() => handleSort('totalActiveCandidates')}
                                    >
                                        Pipeline
                                        {sortField === 'totalActiveCandidates' && <span style={{ marginLeft: '2px', fontSize: '0.6rem' }}>{sortDirection === 'desc' ? '▼' : '▲'}</span>}
                                    </th>
                                    <th
                                        className="text-right"
                                        style={sortableThStyle('pendingActionsCount')}
                                        onClick={() => handleSort('pendingActionsCount')}
                                    >
                                        Actions
                                        {sortField === 'pendingActionsCount' && <span style={{ marginLeft: '2px', fontSize: '0.6rem' }}>{sortDirection === 'desc' ? '▼' : '▲'}</span>}
                                    </th>
                                    <th
                                        className="text-right"
                                        style={sortableThStyle('feedbackDueCount')}
                                        onClick={() => handleSort('feedbackDueCount')}
                                    >
                                        Feedback
                                        {sortField === 'feedbackDueCount' && <span style={{ marginLeft: '2px', fontSize: '0.6rem' }}>{sortDirection === 'desc' ? '▼' : '▲'}</span>}
                                    </th>
                                    <th
                                        className="text-right"
                                        style={sortableThStyle('reviewDueCount')}
                                        onClick={() => handleSort('reviewDueCount')}
                                    >
                                        Review
                                        {sortField === 'reviewDueCount' && <span style={{ marginLeft: '2px', fontSize: '0.6rem' }}>{sortDirection === 'desc' ? '▼' : '▲'}</span>}
                                    </th>
                                    <th
                                        className="text-right"
                                        style={sortableThStyle('reqsWithRiskFlags')}
                                        onClick={() => handleSort('reqsWithRiskFlags')}
                                    >
                                        Risk
                                        {sortField === 'reqsWithRiskFlags' && <span style={{ marginLeft: '2px', fontSize: '0.6rem' }}>{sortDirection === 'desc' ? '▼' : '▲'}</span>}
                                    </th>
                                    <th className="text-right" style={thStyle}>FB Speed</th>
                                    <th className="text-right" style={thStyle}>RV Speed</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedHMs.map(hm => {
                                    const isSelected = selectedHmUserIds.has(hm.hmUserId);
                                    return (
                                        <tr
                                            key={hm.hmUserId}
                                            onClick={() => onToggleHM(hm.hmUserId)}
                                            className={`cursor-pointer hover:bg-white hover:bg-opacity-5 transition-colors ${isSelected ? 'table-primary' : ''}`}
                                        >
                                            <td style={tdStyle} onClick={e => e.stopPropagation()}>
                                                <Checkbox
                                                    checked={isSelected}
                                                    onChange={() => onToggleHM(hm.hmUserId)}
                                                />
                                            </td>
                                            <td style={tdStyle}>
                                                <strong style={{ color: 'var(--text-primary)', fontSize: '0.85rem' }}>{hm.hmName}</strong>
                                                {hm.team && <small className="text-muted-foreground block" style={{ fontSize: '0.7rem' }}>{hm.team}</small>}
                                            </td>
                                            <td style={tdStyle} className="text-muted-foreground">{hm.team || '—'}</td>
                                            <td className="text-right" style={tdStyle}>{hm.totalOpenReqs}</td>
                                            <td className="text-right" style={tdStyle}>{hm.totalActiveCandidates}</td>
                                            <td className="text-right" style={tdStyle}>
                                                {hm.pendingActionsCount > 0 ? (
                                                    <span className="badge-bespoke badge-warning-soft" style={{ fontSize: '0.75rem' }}>
                                                        {hm.pendingActionsCount}
                                                    </span>
                                                ) : (
                                                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>0</span>
                                                )}
                                            </td>
                                            <td className="text-right" style={tdStyle}>
                                                {hm.feedbackDueCount > 0 ? (
                                                    <span className="badge-bespoke badge-danger-soft" style={{ fontSize: '0.75rem' }}>
                                                        {hm.feedbackDueCount}
                                                    </span>
                                                ) : (
                                                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>0</span>
                                                )}
                                            </td>
                                            <td className="text-right" style={tdStyle}>
                                                {hm.reviewDueCount > 0 ? (
                                                    <span className="badge-bespoke badge-warning-soft" style={{ fontSize: '0.75rem' }}>
                                                        {hm.reviewDueCount}
                                                    </span>
                                                ) : (
                                                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>0</span>
                                                )}
                                            </td>
                                            <td className="text-right" style={tdStyle}>
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
                                            <td className="text-right" style={tdStyle}>
                                                {hm.latencyMetrics.feedbackLatency.median !== null ? (
                                                    <span style={{
                                                        color: (hm.latencyMetrics.feedbackLatency.median > (hm.peerComparison?.metrics.find(m => m.metricName === 'Feedback Speed')?.cohortP75 ?? 999)) ? 'var(--color-danger)' : 'var(--color-slate-700)',
                                                        fontWeight: 500
                                                    }}>
                                                        {hm.latencyMetrics.feedbackLatency.median}d
                                                    </span>
                                                ) : <span className="text-slate-300">—</span>}
                                            </td>
                                            <td className="text-right" style={tdStyle}>
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
                                        <td colSpan={9} className="text-center text-muted-foreground py-5">
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
