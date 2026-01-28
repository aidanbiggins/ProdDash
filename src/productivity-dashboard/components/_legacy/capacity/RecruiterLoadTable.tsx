// Recruiter Load Table Component
// Displays recruiter workload utilization with status indicators

import React, { useState, useMemo } from 'react';
import { BarChart3, ChevronDown, ChevronUp } from 'lucide-react';
import { RecruiterLoadRow, LoadStatus } from '../../../types/capacityTypes';

interface RecruiterLoadTableProps {
  rows: RecruiterLoadRow[];
  onRecruiterClick?: (recruiterId: string) => void;
}

// Map status to Tailwind badge classes
const STATUS_BADGE_CLASS: Record<LoadStatus, { className: string; label: string }> = {
  critical: { className: 'bg-red-500/20 text-red-400', label: 'Critical' },
  overloaded: { className: 'bg-amber-500/20 text-amber-400', label: 'Overloaded' },
  balanced: { className: 'bg-blue-500/20 text-blue-400', label: 'Balanced' },
  available: { className: 'bg-green-500/20 text-green-400', label: 'Available' },
  underutilized: { className: 'bg-slate-500/20 text-slate-400', label: 'Underutilized' }
};

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
  const barColor = utilization > 1.2 ? 'bg-red-500' :
                   utilization > 1.1 ? 'bg-amber-500' :
                   utilization > 0.9 ? 'bg-blue-500' :
                   utilization > 0.7 ? 'bg-green-500' : 'bg-slate-500';
  const textColor = utilization > 1.2 ? 'text-red-400' :
                    utilization > 1.1 ? 'text-amber-400' :
                    utilization > 0.9 ? 'text-blue-400' :
                    utilization > 0.7 ? 'text-green-400' : 'text-slate-400';

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${Math.min(percent, 100)}%` }}
        />
      </div>
      <span className={`font-mono text-xs w-10 text-right ${textColor}`}>
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

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'desc' ? 'asc' : 'desc');
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  const SortIcon = ({ column }: { column: string }) => {
    if (sortColumn !== column) return null;
    return sortDirection === 'desc'
      ? <ChevronDown className="w-3 h-3 inline ml-1" />
      : <ChevronUp className="w-3 h-3 inline ml-1" />;
  };

  return (
    <div className="glass-panel">
      <div className="px-4 py-3 border-b border-border">
        <h6 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-primary" />
          Recruiter Workload
        </h6>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th
                className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground"
                onClick={() => handleSort('recruiterName')}
              >
                Recruiter<SortIcon column="recruiterName" />
              </th>
              <th
                className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground w-20"
                onClick={() => handleSort('demandWU')}
              >
                Demand<SortIcon column="demandWU" />
              </th>
              <th
                className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground w-20"
                onClick={() => handleSort('capacityWU')}
              >
                Capacity<SortIcon column="capacityWU" />
              </th>
              <th
                className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground w-36"
                onClick={() => handleSort('utilization')}
              >
                Utilization<SortIcon column="utilization" />
              </th>
              <th className="text-center px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider w-28">
                Status
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Top Driver
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  No recruiter data available
                </td>
              </tr>
            ) : (
              sortedRows.map((row) => (
                <tr
                  key={row.recruiterId}
                  className="border-b border-border/50 hover:bg-muted/30 cursor-pointer transition-colors"
                  onClick={() => onRecruiterClick?.(row.recruiterId)}
                >
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium text-foreground">{row.recruiterName}</div>
                    <div className="text-xs text-muted-foreground">{row.reqCount} reqs</div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="font-mono text-sm text-foreground">{row.demandWU}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="font-mono text-sm text-foreground">{row.capacityWU}</span>
                  </td>
                  <td className="px-4 py-3">
                    <UtilizationBar utilization={row.utilization} />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <StatusBadge status={row.status} />
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-muted-foreground truncate block max-w-[200px]" title={row.topDriver}>
                      {row.topDriver}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default RecruiterLoadTable;
