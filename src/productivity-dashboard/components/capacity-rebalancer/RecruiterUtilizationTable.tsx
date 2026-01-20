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
        if (sortBy !== column) return <i className="bi bi-chevron-expand text-muted" style={{ fontSize: '0.7rem' }}></i>;
        return sortDir === 'desc'
            ? <i className="bi bi-chevron-down" style={{ fontSize: '0.7rem' }}></i>
            : <i className="bi bi-chevron-up" style={{ fontSize: '0.7rem' }}></i>;
    };

    if (rows.length === 0) {
        return (
            <div className="text-center py-4 text-muted">
                <i className="bi bi-people" style={{ fontSize: '2rem' }}></i>
                <p className="mt-2 mb-0">No recruiters with assigned requisitions</p>
            </div>
        );
    }

    return (
        <div className="table-responsive">
            <table className="table table-sm oracle-data-table mb-0" style={{ fontSize: '0.8rem' }}>
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
                                    ? 'rgba(6, 182, 212, 0.1)'
                                    : 'transparent'
                            }}
                            className="hover-highlight"
                        >
                            <td>
                                <div className="d-flex align-items-center gap-2">
                                    <span
                                        className="d-inline-block rounded-circle"
                                        style={{
                                            width: '8px',
                                            height: '8px',
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
                            <td style={{ textAlign: 'center' }}>
                                <span
                                    className="badge rounded-pill"
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
                            <td style={{ textAlign: 'center' }}>
                                <span
                                    className="badge rounded-pill"
                                    style={{
                                        fontSize: '0.6rem',
                                        background: row.confidence === 'HIGH'
                                            ? 'rgba(16, 185, 129, 0.15)'
                                            : row.confidence === 'MED'
                                                ? 'rgba(245, 158, 11, 0.15)'
                                                : 'rgba(148, 163, 184, 0.15)',
                                        color: row.confidence === 'HIGH'
                                            ? '#10b981'
                                            : row.confidence === 'MED'
                                                ? '#f59e0b'
                                                : '#94a3b8'
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
