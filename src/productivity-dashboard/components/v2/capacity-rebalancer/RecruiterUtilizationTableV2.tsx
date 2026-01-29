/**
 * RecruiterUtilizationTableV2
 *
 * Table showing recruiter utilization with sortable columns.
 * V2 version using glass-panel and Tailwind tokens.
 */

import React, { useState, useMemo } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, AlertCircle, CheckCircle, MinusCircle } from 'lucide-react';
import {
  RecruiterUtilizationRow,
  PrivacyMode,
  getRecruiterDisplayName
} from '../../../types/rebalancerTypes';
import { LoadStatus } from '../../../types/capacityTypes';

interface RecruiterUtilizationTableProps {
  rows: RecruiterUtilizationRow[];
  privacyMode: PrivacyMode;
  onRowClick?: (row: RecruiterUtilizationRow) => void;
  selectedRecruiterId?: string;
}

type SortKey = 'recruiterName' | 'demand' | 'capacity' | 'utilization';
type SortDir = 'asc' | 'desc';

const statusColors: Record<LoadStatus, string> = {
  critical: 'text-bad',
  overloaded: 'text-warn',
  balanced: 'text-foreground',
  available: 'text-good',
  underutilized: 'text-muted-foreground',
};

const statusBadgeStyles: Record<LoadStatus, string> = {
  critical: 'bg-bad/20 text-bad',
  overloaded: 'bg-warn/20 text-warn',
  balanced: 'bg-muted text-muted-foreground',
  available: 'bg-good/20 text-good',
  underutilized: 'bg-muted text-muted-foreground',
};

const statusIcons: Record<LoadStatus, React.ReactNode> = {
  critical: <AlertCircle className="w-3.5 h-3.5" />,
  overloaded: <AlertTriangle className="w-3.5 h-3.5" />,
  balanced: <MinusCircle className="w-3.5 h-3.5" />,
  available: <CheckCircle className="w-3.5 h-3.5" />,
  underutilized: <MinusCircle className="w-3.5 h-3.5" />,
};

const statusLabels: Record<LoadStatus, string> = {
  critical: 'Critical',
  overloaded: 'Overloaded',
  balanced: 'Balanced',
  available: 'Available',
  underutilized: 'Underutilized',
};

export function RecruiterUtilizationTableV2({
  rows,
  privacyMode,
  onRowClick,
  selectedRecruiterId,
}: RecruiterUtilizationTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('utilization');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // Helper to get display name with privacy mode
  const getDisplayName = (row: RecruiterUtilizationRow, index: number) => {
    return getRecruiterDisplayName(
      row.recruiterId,
      row.recruiterName,
      index,
      privacyMode
    );
  };

  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) => {
      let comparison = 0;

      switch (sortKey) {
        case 'recruiterName':
          const aName = getRecruiterDisplayName(a.recruiterId, a.recruiterName, 0, privacyMode).toLowerCase();
          const bName = getRecruiterDisplayName(b.recruiterId, b.recruiterName, 0, privacyMode).toLowerCase();
          comparison = aName.localeCompare(bName);
          break;
        case 'demand':
          comparison = a.totalDemand - b.totalDemand;
          break;
        case 'capacity':
          comparison = a.totalCapacity - b.totalCapacity;
          break;
        case 'utilization':
          comparison = a.utilization - b.utilization;
          break;
      }

      return sortDir === 'desc' ? -comparison : comparison;
    });
  }, [rows, sortKey, sortDir, privacyMode]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortKey !== column) return null;
    return sortDir === 'asc' ? (
      <ChevronUp className="w-3 h-3 inline ml-1" />
    ) : (
      <ChevronDown className="w-3 h-3 inline ml-1" />
    );
  };

  if (rows.length === 0) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        No recruiter utilization data available
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border">
            <th
              className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
              onClick={() => handleSort('recruiterName')}
            >
              Recruiter
              <SortIcon column="recruiterName" />
            </th>
            <th
              className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
              onClick={() => handleSort('demand')}
            >
              Demand
              <SortIcon column="demand" />
            </th>
            <th
              className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
              onClick={() => handleSort('capacity')}
            >
              Capacity
              <SortIcon column="capacity" />
            </th>
            <th
              className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
              onClick={() => handleSort('utilization')}
            >
              Utilization
              <SortIcon column="utilization" />
            </th>
            <th className="px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Status
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {sortedRows.map((row, index) => (
            <tr
              key={row.recruiterId}
              className={`hover:bg-muted/50 transition-colors cursor-pointer ${
                selectedRecruiterId === row.recruiterId ? 'bg-muted/70' : ''
              }`}
              onClick={() => onRowClick?.(row)}
            >
              <td className="px-3 py-2.5 text-sm font-medium text-foreground">
                {getDisplayName(row, index)}
              </td>
              <td className="px-3 py-2.5 text-sm font-mono text-right text-foreground">
                {row.totalDemand}
              </td>
              <td className="px-3 py-2.5 text-sm font-mono text-right text-foreground">
                {row.totalCapacity.toFixed(1)}
              </td>
              <td className={`px-3 py-2.5 text-sm font-mono text-right font-semibold ${statusColors[row.status]}`}>
                {Math.round(row.utilization * 100)}%
              </td>
              <td className="px-3 py-2.5 text-center">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${statusBadgeStyles[row.status]}`}>
                  {statusIcons[row.status]}
                  {statusLabels[row.status]}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default RecruiterUtilizationTableV2;
