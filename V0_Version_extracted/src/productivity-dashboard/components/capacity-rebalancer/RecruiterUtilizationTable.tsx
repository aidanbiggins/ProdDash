/**
 * Recruiter Utilization Table
 *
 * Shows all recruiters with their load status and utilization metrics.
 */

import React, { useState } from 'react';
import {
    RecruiterUtilizationRow,
    PrivacyMode,
    LOAD_STATUS_COLORS,
    LOAD_STATUS_LABELS,
    getRecruiterDisplayName
} from '../../types/rebalancerTypes';

interface Props {
    rows: RecruiterUtilizationRow[];
    privacyMode: PrivacyMode;
    onRowClick: (row: RecruiterUtilizationRow) => void;
    selectedRecruiterId?: string;
}

export function RecruiterUtilizationTable({ rows, privacyMode, onRowClick, selectedRecruiterId }: Props) {
    const [sortBy, setSortBy] = useState<'utilization' | 'demand' | 'capacity' | 'reqs'>('utilization');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

    const sortedRows = [...rows].sort((a, b) => {
        let comparison = 0;
        switch (sortBy) {
            case 'utilization':
                comparison = a.utilization - b.utilization;
                break;
            case 'demand':
                comparison = a.totalDemand - b.totalDemand;
                break;
            case 'capacity':
                comparison = a.totalCapacity - b.totalCapacity;
                break;
            case 'reqs':
                comparison = a.reqCount - b.reqCount;
                break;
        }
        return sortDir === 'desc' ? -comparison : comparison;
    });

    const handleSort = (column: typeof sortBy) => {
        if (sortBy === column) {
            setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
        } else {
            setSortBy(column);
            setSortDir('desc');
        }
    };

    const SortIcon = ({ column }: { column: typeof sortBy }) => {
        if (sortBy !== column) return <i className="bi bi-chevron-expand text-muted-foreground text-xs"></i>;
        return sortDir === 'desc'
            ? <i className="bi bi-chevron-down text-xs"></i>
            : <i className="bi bi-chevron-up text-xs"></i>;
    };

    if (rows.length === 0) {
        return (
            <div className="text-center py-4 text-muted-foreground">
                <i className="bi bi-people text-3xl"></i>
                <p className="mt-2 mb-0">No recruiters with assigned requisitions</p>
            </div>
        );
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
                <thead>
                    <tr>
                        <th style={{ cursor: 'pointer' }} onClick={() => handleSort('utilization')}>
                            Recruiter
                        </th>
                        <th style={{ cursor: 'pointer', textAlign: 'center' }} onClick={() => handleSort('reqs')}>
                            Reqs <SortIcon column="reqs" />
                        </th>
                        <th style={{ cursor: 'pointer', textAlign: 'center' }} onClick={() => handleSort('demand')}>
                            Demand <SortIcon column="demand" />
                        </th>
                        <th style={{ cursor: 'pointer', textAlign: 'center' }} onClick={() => handleSort('capacity')}>
                            Capacity <SortIcon column="capacity" />
                        </th>
                        <th style={{ cursor: 'pointer', textAlign: 'center' }} onClick={() => handleSort('utilization')}>
                            Util <SortIcon column="utilization" />
                        </th>
                        <th style={{ textAlign: 'center' }}>Status</th>
                        <th style={{ textAlign: 'center' }}>Conf</th>
                    </tr>
                </thead>
                <tbody>
                    {sortedRows.map((row, index) => (
                        <tr
                            key={row.recruiterId}
                            onClick={() => onRowClick(row)}
                            style={{
                                cursor: 'pointer',
                                background: selectedRecruiterId === row.recruiterId
                                    ? 'var(--accent-bg)'
                                    : 'transparent'
                            }}
                            className="hover:bg-white/5"
                        >
                            <td className="p-2">
                                <div className="flex items-center gap-2">
                                    <span
                                        className="inline-block rounded-full w-2 h-2"
                                        style={{
                                            background: LOAD_STATUS_COLORS[row.status]
                                        }}
                                    ></span>
                                    {privacyMode === 'anonymized'
                                        ? `Recruiter ${index + 1}`
                                        : row.recruiterName}
                                </div>
                            </td>
                            <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)' }}>
                                {row.reqCount}
                            </td>
                            <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)' }}>
                                {row.totalDemand}
                            </td>
                            <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)' }}>
                                {Math.round(row.totalCapacity)}/wk
                            </td>
                            <td style={{
                                textAlign: 'center',
                                fontFamily: 'var(--font-mono)',
                                color: LOAD_STATUS_COLORS[row.status],
                                fontWeight: 600
                            }}>
                                {Math.round(row.utilization * 100)}%
                            </td>
                            <td className="p-2 text-center">
                                <span
                                    className="inline-flex items-center px-2 py-0.5 rounded-full"
                                    style={{
                                        fontSize: '0.65rem',
                                        background: `${LOAD_STATUS_COLORS[row.status]}22`,
                                        color: LOAD_STATUS_COLORS[row.status],
                                        border: `1px solid ${LOAD_STATUS_COLORS[row.status]}44`
                                    }}
                                >
                                    {LOAD_STATUS_LABELS[row.status]}
                                </span>
                            </td>
                            <td className="p-2 text-center">
                                <span
                                    className="inline-flex items-center px-2 py-0.5 rounded-full"
                                    style={{
                                        fontSize: '0.6rem',
                                        background: row.confidence === 'HIGH'
                                            ? 'var(--color-good-bg)'
                                            : row.confidence === 'MED'
                                                ? 'var(--color-warn-bg)'
                                                : 'var(--color-bg-overlay)',
                                        color: row.confidence === 'HIGH'
                                            ? 'var(--color-good)'
                                            : row.confidence === 'MED'
                                                ? 'var(--color-warn)'
                                                : 'var(--text-secondary)'
                                    }}
                                >
                                    {row.confidence}
                                </span>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
