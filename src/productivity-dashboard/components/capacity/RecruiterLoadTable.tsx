// Recruiter Load Table Component
// Displays recruiter workload utilization with status indicators

import React, { useState, useMemo } from 'react';
import { RecruiterLoadRow, LoadStatus, ConfidenceLevel } from '../../types/capacityTypes';
import { BespokeTable, BespokeTableColumn } from '../common/BespokeTable';

interface RecruiterLoadTableProps {
  rows: RecruiterLoadRow[];
  onRecruiterClick?: (recruiterId: string) => void;
}

// Map status to badge class - uses CSS classes from dashboard-theme.css
const STATUS_BADGE_CLASS: Record<LoadStatus, { className: string; label: string }> = {
  critical: { className: 'badge-danger-soft', label: 'Critical' },
  overloaded: { className: 'badge-warning-soft', label: 'Overloaded' },
  balanced: { className: 'badge-primary-soft', label: 'Balanced' },
  available: { className: 'badge-success-soft', label: 'Available' },
  underutilized: { className: 'badge-neutral-soft', label: 'Underutilized' }
};

// Map confidence to CSS class for the indicator dots
const CONFIDENCE_CLASS: Record<ConfidenceLevel, string> = {
  HIGH: 'confidence-high',
  MED: 'confidence-med',
  LOW: 'confidence-low',
  INSUFFICIENT: 'confidence-insufficient'
};

function ConfidenceIndicator({ confidence }: { confidence: ConfidenceLevel }) {
  const dots = {
    HIGH: 3,
    MED: 2,
    LOW: 1,
    INSUFFICIENT: 0
  }[confidence];

  return (
    <span title={`${confidence} confidence`} className={`confidence-dots ${CONFIDENCE_CLASS[confidence]}`}>
      {[0, 1, 2].map(i => (
        <span
          key={i}
          className={`confidence-dot ${i < dots ? 'active' : ''}`}
        />
      ))}
    </span>
  );
}

function StatusBadge({ status }: { status: LoadStatus }) {
  const { className, label } = STATUS_BADGE_CLASS[status];
  return (
    <span className={`badge ${className}`}>
      {label}
    </span>
  );
}

function UtilizationBar({ utilization }: { utilization: number }) {
  const percent = Math.min(utilization * 100, 150);
  const colorClass = utilization > 1.2 ? 'utilization-critical' :
                     utilization > 1.1 ? 'utilization-warning' :
                     utilization > 0.9 ? 'utilization-balanced' :
                     utilization > 0.7 ? 'utilization-good' : 'utilization-low';

  return (
    <div className="d-flex align-items-center gap-2">
      <div className="utilization-bar-track">
        <div
          className={`utilization-bar-fill ${colorClass}`}
          style={{ width: `${Math.min(percent, 100)}%` }}
        />
      </div>
      <span className={`utilization-value ${colorClass}`}>
        {Math.round(utilization * 100)}%
      </span>
    </div>
  );
}

export function RecruiterLoadTable({ rows, onRecruiterClick }: RecruiterLoadTableProps) {
  const [sortColumn, setSortColumn] = useState<string>('utilization');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) => {
      let aVal: number | string;
      let bVal: number | string;

      switch (sortColumn) {
        case 'recruiterName':
          aVal = a.recruiterName.toLowerCase();
          bVal = b.recruiterName.toLowerCase();
          break;
        case 'demandWU':
          aVal = a.demandWU;
          bVal = b.demandWU;
          break;
        case 'capacityWU':
          aVal = a.capacityWU;
          bVal = b.capacityWU;
          break;
        case 'utilization':
        default:
          aVal = a.utilization;
          bVal = b.utilization;
          break;
      }

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortDirection === 'asc'
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number);
    });
  }, [rows, sortColumn, sortDirection]);

  const handleSort = (column: string, direction: 'asc' | 'desc') => {
    setSortColumn(column);
    setSortDirection(direction);
  };

  const columns: BespokeTableColumn<RecruiterLoadRow>[] = [
    {
      key: 'recruiterName',
      header: 'Recruiter',
      width: '140px',
      sortable: true,
      render: (row) => (
        <div>
          <div className="cell-primary">{row.recruiterName}</div>
          <div className="cell-muted cell-small">{row.reqCount} reqs</div>
        </div>
      )
    },
    {
      key: 'demandWU',
      header: 'Demand',
      width: '70px',
      align: 'right',
      sortable: true,
      render: (row) => (
        <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{row.demandWU}</span>
      )
    },
    {
      key: 'capacityWU',
      header: 'Capacity',
      width: '70px',
      align: 'right',
      sortable: true,
      render: (row) => (
        <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{row.capacityWU}</span>
      )
    },
    {
      key: 'utilization',
      header: 'Utilization',
      width: '120px',
      sortable: true,
      render: (row) => <UtilizationBar utilization={row.utilization} />
    },
    {
      key: 'status',
      header: 'Status',
      width: '90px',
      align: 'center',
      render: (row) => <StatusBadge status={row.status} />
    },
    {
      key: 'topDriver',
      header: 'Top Driver',
      width: '180px',
      render: (row) => (
        <span className="text-truncate d-block small" style={{ maxWidth: 170 }} title={row.topDriver}>
          {row.topDriver}
        </span>
      )
    },
    {
      key: 'confidence',
      header: '',
      width: '40px',
      align: 'center',
      render: (row) => <ConfidenceIndicator confidence={row.confidence} />
    }
  ];

  return (
    <div className="card-bespoke">
      <div className="card-header">
        <h6 className="mb-0">
          <i className="bi bi-bar-chart me-2"></i>
          Recruiter Workload
        </h6>
      </div>
      <div className="card-body p-0">
        <BespokeTable<RecruiterLoadRow>
          columns={columns}
          data={sortedRows}
          keyExtractor={(row) => row.recruiterId}
          sortColumn={sortColumn}
          sortDirection={sortDirection}
          onSort={handleSort}
          onRowClick={(row) => onRecruiterClick?.(row.recruiterId)}
          emptyState={
            <div className="text-center py-4 text-muted">
              <i className="bi bi-inbox" style={{ fontSize: '2rem' }}></i>
              <div className="mt-2">No recruiter data available</div>
            </div>
          }
        />
      </div>
    </div>
  );
}

export default RecruiterLoadTable;
