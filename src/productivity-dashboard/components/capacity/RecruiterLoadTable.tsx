// Recruiter Load Table Component
// Displays recruiter workload utilization with status indicators

import React, { useState, useMemo } from 'react';
import { RecruiterLoadRow, LoadStatus, ConfidenceLevel } from '../../types/capacityTypes';
import { BespokeTable, BespokeTableColumn } from '../common/BespokeTable';

interface RecruiterLoadTableProps {
  rows: RecruiterLoadRow[];
  onRecruiterClick?: (recruiterId: string) => void;
}

// Map status to Tailwind badge classes
const STATUS_BADGE_CLASS: Record<LoadStatus, { className: string; label: string }> = {
  critical: { className: 'bg-bad-bg text-bad', label: 'Critical' },
  overloaded: { className: 'bg-warn-bg text-warn', label: 'Overloaded' },
  balanced: { className: 'bg-accent/15 text-accent', label: 'Balanced' },
  available: { className: 'bg-good-bg text-good', label: 'Available' },
  underutilized: { className: 'bg-white/10 text-muted-foreground', label: 'Underutilized' }
};

// Map confidence to Tailwind color
const CONFIDENCE_COLOR: Record<ConfidenceLevel, string> = {
  HIGH: 'text-good',
  MED: 'text-warn',
  LOW: 'text-muted-foreground',
  INSUFFICIENT: 'text-bad'
};

function ConfidenceIndicator({ confidence }: { confidence: ConfidenceLevel }) {
  const dots = {
    HIGH: 3,
    MED: 2,
    LOW: 1,
    INSUFFICIENT: 0
  }[confidence];

  return (
    <span title={`${confidence} confidence`} className={`inline-flex gap-0.5 ${CONFIDENCE_COLOR[confidence]}`}>
      {[0, 1, 2].map(i => (
        <span
          key={i}
          className={`w-1.5 h-1.5 rounded-full ${i < dots ? 'bg-current' : 'bg-white/20'}`}
        />
      ))}
    </span>
  );
}

function StatusBadge({ status }: { status: LoadStatus }) {
  const { className, label } = STATUS_BADGE_CLASS[status];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${className}`}>
      {label}
    </span>
  );
}

function UtilizationBar({ utilization }: { utilization: number }) {
  const percent = Math.min(utilization * 100, 150);
  const barColor = utilization > 1.2 ? 'bg-bad' :
                   utilization > 1.1 ? 'bg-warn' :
                   utilization > 0.9 ? 'bg-accent' :
                   utilization > 0.7 ? 'bg-good' : 'bg-muted-foreground';
  const textColor = utilization > 1.2 ? 'text-bad' :
                    utilization > 1.1 ? 'text-warn' :
                    utilization > 0.9 ? 'text-accent' :
                    utilization > 0.7 ? 'text-good' : 'text-muted-foreground';

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${Math.min(percent, 100)}%` }}
        />
      </div>
      <span className={`font-mono text-xs ${textColor}`}>
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
          <div className="text-sm font-medium text-foreground">{row.recruiterName}</div>
          <div className="text-xs text-muted-foreground">{row.reqCount} reqs</div>
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
        <span className="font-mono text-sm">{row.demandWU}</span>
      )
    },
    {
      key: 'capacityWU',
      header: 'Capacity',
      width: '70px',
      align: 'right',
      sortable: true,
      render: (row) => (
        <span className="font-mono text-sm">{row.capacityWU}</span>
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
        <span className="truncate block text-sm max-w-[170px]" title={row.topDriver}>
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
    <div className="rounded-lg border border-glass-border bg-bg-glass">
      <div className="px-4 py-3 border-b border-white/10">
        <h6 className="text-sm font-semibold text-foreground">
          <i className="bi bi-bar-chart mr-2"></i>
          Recruiter Workload
        </h6>
      </div>
      <div className="p-0">
        <BespokeTable<RecruiterLoadRow>
          columns={columns}
          data={sortedRows}
          keyExtractor={(row) => row.recruiterId}
          sortColumn={sortColumn}
          sortDirection={sortDirection}
          onSort={handleSort}
          onRowClick={(row) => onRecruiterClick?.(row.recruiterId)}
          emptyState={
            <div className="text-center py-8 text-muted-foreground">
              <i className="bi bi-inbox text-3xl"></i>
              <div className="mt-2">No recruiter data available</div>
            </div>
          }
        />
      </div>
    </div>
  );
}

export default RecruiterLoadTable;
