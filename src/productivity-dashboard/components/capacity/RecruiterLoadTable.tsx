// Recruiter Load Table Component
// Displays recruiter workload utilization with status indicators

import React, { useState, useMemo } from 'react';
import { RecruiterLoadRow, LoadStatus, ConfidenceLevel } from '../../types/capacityTypes';
import { BespokeTable, BespokeTableColumn } from '../common/BespokeTable';

interface RecruiterLoadTableProps {
  rows: RecruiterLoadRow[];
  onRecruiterClick?: (recruiterId: string) => void;
}

const STATUS_STYLES: Record<LoadStatus, { bg: string; text: string; label: string }> = {
  critical: { bg: 'rgba(239, 68, 68, 0.15)', text: '#f87171', label: 'Critical' },
  overloaded: { bg: 'rgba(245, 158, 11, 0.15)', text: '#fbbf24', label: 'Overloaded' },
  balanced: { bg: 'rgba(59, 130, 246, 0.15)', text: '#60a5fa', label: 'Balanced' },
  available: { bg: 'rgba(34, 197, 94, 0.15)', text: '#34d399', label: 'Available' },
  underutilized: { bg: 'rgba(148, 163, 184, 0.15)', text: '#94a3b8', label: 'Underutilized' }
};

function ConfidenceIndicator({ confidence }: { confidence: ConfidenceLevel }) {
  const dots = {
    HIGH: 3,
    MED: 2,
    LOW: 1,
    INSUFFICIENT: 0
  }[confidence];

  const color = {
    HIGH: '#34d399',
    MED: '#fbbf24',
    LOW: '#94a3b8',
    INSUFFICIENT: '#ef4444'
  }[confidence];

  return (
    <span title={`${confidence} confidence`}>
      {[0, 1, 2].map(i => (
        <span
          key={i}
          style={{
            display: 'inline-block',
            width: 6,
            height: 6,
            borderRadius: '50%',
            marginRight: 2,
            background: i < dots ? color : 'rgba(255,255,255,0.1)'
          }}
        />
      ))}
    </span>
  );
}

function StatusBadge({ status }: { status: LoadStatus }) {
  const style = STATUS_STYLES[status];
  return (
    <span
      className="badge"
      style={{
        background: style.bg,
        color: style.text,
        fontSize: '0.7rem'
      }}
    >
      {style.label}
    </span>
  );
}

function UtilizationBar({ utilization }: { utilization: number }) {
  const percent = Math.min(utilization * 100, 150);
  const color = utilization > 1.2 ? '#f87171' :
                utilization > 1.1 ? '#fbbf24' :
                utilization > 0.9 ? '#60a5fa' :
                utilization > 0.7 ? '#34d399' : '#94a3b8';

  return (
    <div className="d-flex align-items-center gap-2">
      <div style={{ width: 60, height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 3 }}>
        <div
          style={{
            width: `${Math.min(percent, 100)}%`,
            height: '100%',
            background: color,
            borderRadius: 3
          }}
        />
      </div>
      <span style={{ color, fontSize: '0.8rem', fontFamily: "'JetBrains Mono', monospace" }}>
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
