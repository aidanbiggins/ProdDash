/**
 * RequisitionsTable V2 - Tailwind Implementation
 * Matches V0 reference design exactly
 */
import React, { useState } from 'react';
import { cn } from '../ui-primitives/utils';

type Priority = 'critical' | 'high' | 'medium' | 'low';
type Status = 'open' | 'sourcing' | 'screening' | 'interviewing' | 'offer' | 'closed' | 'on-hold';

interface Requisition {
  id: string;
  title: string;
  department: string;
  level: string;
  priority: Priority;
  status: Status;
  assignedRecruiter: string | null;
  location: string;
  daysOpen: number;
  healthScore: number;
}

interface Recruiter {
  id: string;
  name: string;
}

interface RequisitionsTableV2Props {
  requisitions: Requisition[];
  recruiters?: Recruiter[];
  onRowClick?: (reqId: string) => void;
}

type SortField = 'title' | 'daysOpen' | 'healthScore';
type SortDirection = 'asc' | 'desc';

const priorityConfig: Record<Priority, { bg: string; text: string; label: string }> = {
  critical: { bg: 'bg-bad-bg', text: 'text-bad-text', label: 'Critical' },
  high: { bg: 'bg-warn-bg', text: 'text-warn-text', label: 'High' },
  medium: { bg: 'bg-[rgba(59,130,246,0.15)]', text: 'text-[#93c5fd]', label: 'Medium' },
  low: { bg: 'bg-[rgba(100,116,139,0.15)]', text: 'text-muted-foreground', label: 'Low' },
};

const statusConfig: Record<Status, { dot: string; label: string }> = {
  open: { dot: 'bg-[#3b82f6]', label: 'Open' },
  sourcing: { dot: 'bg-purple', label: 'Sourcing' },
  screening: { dot: 'bg-warn', label: 'Screening' },
  interviewing: { dot: 'bg-primary', label: 'Interviewing' },
  offer: { dot: 'bg-good', label: 'Offer' },
  closed: { dot: 'bg-dim', label: 'Closed' },
  'on-hold': { dot: 'bg-bad', label: 'On Hold' },
};

function getHealthColor(score: number): string {
  if (score >= 80) return 'text-good';
  if (score >= 60) return 'text-warn';
  return 'text-bad';
}

// Sort icon
const ArrowUpDownIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M7 15l5 5 5-5" />
    <path d="M7 9l5-5 5 5" />
  </svg>
);

export function RequisitionsTableV2({ requisitions, recruiters = [], onRowClick }: RequisitionsTableV2Props) {
  const [sortField, setSortField] = useState<SortField>('daysOpen');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const sortedRequisitions = [...requisitions].sort((a, b) => {
    const aValue = a[sortField];
    const bValue = b[sortField];

    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
    }

    const aStr = String(aValue || '');
    const bStr = String(bValue || '');
    return sortDirection === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
  });

  const getRecruiterName = (recruiterId: string | null): string => {
    if (!recruiterId) return 'Unassigned';
    const recruiter = recruiters.find(r => r.id === recruiterId);
    return recruiter?.name || 'Unknown';
  };

  return (
    <div className="glass-panel">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Open Requisitions</h3>
          <p className="text-xs text-muted-foreground">{requisitions.length} total</p>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full caption-bottom text-sm">
          <thead>
            <tr className="border-b border-white/[0.06]">
              <th className="h-10 px-3 text-left align-middle text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                <button
                  type="button"
                  onClick={() => handleSort('title')}
                  className="flex items-center gap-1 hover:text-foreground"
                >
                  Requisition
                  <ArrowUpDownIcon />
                </button>
              </th>
              <th className="h-10 px-3 text-left align-middle text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Priority
              </th>
              <th className="h-10 px-3 text-left align-middle text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Status
              </th>
              <th className="h-10 px-3 text-left align-middle text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Recruiter
              </th>
              <th className="h-10 px-3 text-right align-middle text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                <button
                  type="button"
                  onClick={() => handleSort('daysOpen')}
                  className="flex items-center gap-1 hover:text-foreground ml-auto"
                >
                  Days Open
                  <ArrowUpDownIcon />
                </button>
              </th>
              <th className="h-10 px-3 text-right align-middle text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                <button
                  type="button"
                  onClick={() => handleSort('healthScore')}
                  className="flex items-center gap-1 hover:text-foreground ml-auto"
                >
                  Health
                  <ArrowUpDownIcon />
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedRequisitions.slice(0, 10).map((req) => {
              const priority = priorityConfig[req.priority];
              const status = statusConfig[req.status];

              return (
                <tr
                  key={req.id}
                  onClick={() => onRowClick?.(req.id)}
                  className={cn(
                    'border-b border-white/[0.04] transition-colors',
                    onRowClick && 'cursor-pointer hover:bg-[rgba(6,182,212,0.04)]'
                  )}
                >
                  <td className="p-3 align-middle">
                    <div>
                      <p className="text-sm font-medium text-foreground">{req.title}</p>
                      <p className="text-xs text-muted-foreground">{req.department} &middot; {req.location}</p>
                    </div>
                  </td>
                  <td className="p-3 align-middle">
                    <span className={cn(
                      'inline-flex px-2 py-0.5 rounded text-[11px] font-semibold uppercase',
                      priority.bg, priority.text
                    )}>
                      {priority.label}
                    </span>
                  </td>
                  <td className="p-3 align-middle">
                    <div className="flex items-center gap-2">
                      <span className={cn('w-2 h-2 rounded-full', status.dot)} />
                      <span className="text-sm text-foreground">{status.label}</span>
                    </div>
                  </td>
                  <td className="p-3 align-middle">
                    <span className="text-sm text-foreground">
                      {getRecruiterName(req.assignedRecruiter)}
                    </span>
                  </td>
                  <td className="p-3 align-middle text-right">
                    <span className={cn(
                      'font-mono text-sm',
                      req.daysOpen > 90 ? 'text-bad' : req.daysOpen > 60 ? 'text-warn' : 'text-foreground'
                    )}>
                      {req.daysOpen}
                    </span>
                  </td>
                  <td className="p-3 align-middle text-right">
                    <span className={cn(
                      'font-mono text-sm font-medium',
                      getHealthColor(req.healthScore)
                    )}>
                      {req.healthScore}%
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default RequisitionsTableV2;
