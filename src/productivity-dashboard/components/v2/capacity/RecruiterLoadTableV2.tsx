/**
 * RecruiterLoadTableV2
 *
 * Card-based display showing recruiter workload and capacity status.
 * V2 version using glass-panel and Tailwind tokens.
 * Uses the real RecruiterLoadRow type from capacityTypes.
 *
 * Card layout avoids horizontal scroll and is mobile-friendly.
 */

import React, { useState, useMemo } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, CheckCircle, MinusCircle, AlertCircle, ArrowUpDown } from 'lucide-react';
import { RecruiterLoadRow, LoadStatus, ConfidenceLevel } from '../../../types/capacityTypes';

interface RecruiterLoadTableV2Props {
  rows: RecruiterLoadRow[];
  onRecruiterClick?: (recruiterId: string) => void;
  privacyMode?: 'normal' | 'anonymized';
}

type SortKey = 'recruiterName' | 'utilization' | 'demandWU';
type SortDir = 'asc' | 'desc';

// Convert ID like "emily_watson" to "Emily Watson"
function formatIdAsName(id: string): string {
  return id
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

export function RecruiterLoadTableV2({
  rows,
  onRecruiterClick,
  privacyMode = 'normal',
}: RecruiterLoadTableV2Props) {
  const [sortKey, setSortKey] = useState<SortKey>('utilization');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const sortedData = useMemo(() => {
    return [...rows].sort((a, b) => {
      let aVal = a[sortKey];
      let bVal = b[sortKey];

      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase() as any;
        bVal = (bVal as string).toLowerCase() as any;
      }

      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [rows, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const getStatusIcon = (status: LoadStatus) => {
    switch (status) {
      case 'critical':
        return <AlertCircle className="w-4 h-4 text-bad" />;
      case 'overloaded':
        return <AlertTriangle className="w-4 h-4 text-bad" />;
      case 'available':
      case 'underutilized':
        return <CheckCircle className="w-4 h-4 text-good" />;
      default:
        return <MinusCircle className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getStatusColor = (status: LoadStatus) => {
    switch (status) {
      case 'critical':
      case 'overloaded':
        return 'bg-bad';
      case 'available':
        return 'bg-good';
      case 'underutilized':
        return 'bg-warn';
      default:
        return 'bg-muted-foreground';
    }
  };

  const getConfidenceBadge = (confidence: ConfidenceLevel) => {
    // Only show badge for low/insufficient confidence - high/med is the default expectation
    if (confidence === 'HIGH' || confidence === 'MED') {
      return null;
    }

    const label = confidence === 'INSUFFICIENT' ? 'Limited Data' : 'Est.';
    const color = confidence === 'INSUFFICIENT' ? 'text-warn' : 'text-muted-foreground';
    const tooltip = confidence === 'INSUFFICIENT'
      ? 'Not enough historical data to estimate capacity accurately'
      : 'Estimate based on limited historical data';

    return (
      <span
        className={`text-xs ${color}`}
        title={tooltip}
      >
        {label}
      </span>
    );
  };

  const getDisplayName = (row: RecruiterLoadRow, index: number) => {
    if (privacyMode === 'anonymized') {
      return `Recruiter ${index + 1}`;
    }
    // If the name looks like an ID (contains underscores, no spaces), format it
    const name = row.recruiterName;
    if (name.includes('_') && !name.includes(' ')) {
      return formatIdAsName(name);
    }
    return name;
  };

  const formatUtilization = (util: number) => {
    return `${Math.round(util * 100)}%`;
  };

  const getUtilizationColor = (util: number) => {
    if (util > 1.2) return 'text-bad';
    if (util > 1.1) return 'text-warn';
    if (util < 0.7) return 'text-good';
    return 'text-foreground';
  };

  const getUtilizationBarColor = (util: number) => {
    if (util > 1.1) return 'bg-bad';
    if (util > 0.9) return 'bg-warn';
    return 'bg-good';
  };

  return (
    <div className="glass-panel overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-4 py-3">
                <button
                  type="button"
                  onClick={() => handleSort('recruiterName')}
                  className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
                >
                  Recruiter
                  {sortKey === 'recruiterName' && (
                    sortDir === 'desc' ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />
                  )}
                </button>
              </th>
              <th className="text-center px-4 py-3 w-48">
                <button
                  type="button"
                  onClick={() => handleSort('utilization')}
                  className="flex items-center justify-center gap-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors w-full"
                >
                  Utilization
                  {sortKey === 'utilization' && (
                    sortDir === 'desc' ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />
                  )}
                </button>
              </th>
              <th className="text-right px-4 py-3">
                <button
                  type="button"
                  onClick={() => handleSort('demandWU')}
                  className="flex items-center justify-end gap-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors w-full"
                >
                  Demand
                  {sortKey === 'demandWU' && (
                    sortDir === 'desc' ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />
                  )}
                </button>
              </th>
              <th className="text-right px-4 py-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Capacity
                </span>
              </th>
              <th className="text-right px-4 py-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Reqs
                </span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sortedData.map((row, idx) => (
              <tr
                key={row.recruiterId}
                className={`transition-colors ${
                  onRecruiterClick ? 'cursor-pointer hover:bg-muted/30' : ''
                }`}
                onClick={() => onRecruiterClick?.(row.recruiterId)}
              >
                {/* Recruiter Name */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(row.status)}
                    <span className="font-medium text-foreground">
                      {getDisplayName(row, idx)}
                    </span>
                    {getConfidenceBadge(row.confidence)}
                  </div>
                </td>

                {/* Utilization with bar */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${getUtilizationBarColor(row.utilization)}`}
                        style={{ width: `${Math.min(row.utilization * 100, 100)}%` }}
                      />
                    </div>
                    <span className={`font-mono text-sm font-bold min-w-[3rem] text-right ${getUtilizationColor(row.utilization)}`}>
                      {formatUtilization(row.utilization)}
                    </span>
                  </div>
                </td>

                {/* Demand */}
                <td className="px-4 py-3 text-right">
                  <span className="font-mono text-sm text-foreground">{row.demandWU}</span>
                </td>

                {/* Capacity */}
                <td className="px-4 py-3 text-right">
                  <span className="font-mono text-sm text-muted-foreground">{row.capacityWU}</span>
                </td>

                {/* Reqs */}
                <td className="px-4 py-3 text-right">
                  <span className="font-mono text-sm text-muted-foreground">{row.reqCount}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rows.length === 0 && (
        <div className="p-8 text-center text-muted-foreground">
          No recruiter data available
        </div>
      )}
    </div>
  );
}

export default RecruiterLoadTableV2;
