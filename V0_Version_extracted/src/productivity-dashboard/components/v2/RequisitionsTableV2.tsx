import React, { useState } from 'react';
import { ArrowUpDown, ChevronDown, MoreHorizontal } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../../components/ui/dropdown-menu';
import { Button } from '../../../components/ui/button';
import type { RequisitionV2 } from './types';

interface RequisitionsTableV2Props {
  requisitions: RequisitionV2[];
  recruiters?: Array<{ id: string; name: string }>;
}

const priorityConfig = {
  critical: { bg: 'bg-[rgba(239,68,68,0.15)]', text: 'text-[#fca5a5]', label: 'Critical' },
  high: { bg: 'bg-[rgba(245,158,11,0.15)]', text: 'text-[#fcd34d]', label: 'High' },
  medium: { bg: 'bg-[rgba(59,130,246,0.15)]', text: 'text-[#93c5fd]', label: 'Medium' },
  low: { bg: 'bg-[rgba(100,116,139,0.15)]', text: 'text-[#94a3b8]', label: 'Low' },
};

const statusConfig = {
  open: { dot: 'bg-[#3b82f6]', label: 'Open' },
  sourcing: { dot: 'bg-[#8b5cf6]', label: 'Sourcing' },
  screening: { dot: 'bg-[#f59e0b]', label: 'Screening' },
  interviewing: { dot: 'bg-[#06b6d4]', label: 'Interviewing' },
  offer: { dot: 'bg-[#22c55e]', label: 'Offer' },
  closed: { dot: 'bg-[#64748b]', label: 'Closed' },
  'on-hold': { dot: 'bg-[#ef4444]', label: 'On Hold' },
};

function getHealthColor(score: number): string {
  if (score >= 80) return 'text-[#22c55e]';
  if (score >= 60) return 'text-[#f59e0b]';
  return 'text-[#ef4444]';
}

export function RequisitionsTableV2({ requisitions, recruiters = [] }: RequisitionsTableV2Props) {
  const [sortField, setSortField] = useState<keyof RequisitionV2>('daysOpen');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const handleSort = (field: keyof RequisitionV2) => {
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

  return (
    <div className="glass-panel">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Open Requisitions</h3>
          <p className="text-xs text-muted-foreground">{requisitions.length} total</p>
        </div>
        <Button variant="outline" size="sm" className="text-xs gap-2 bg-transparent border-white/[0.08]">
          <span>All Statuses</span>
          <ChevronDown className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-white/[0.06] hover:bg-transparent">
              <TableHead className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                <button
                  type="button"
                  onClick={() => handleSort('title')}
                  className="flex items-center gap-1 hover:text-foreground"
                >
                  Requisition
                  <ArrowUpDown className="w-3 h-3" />
                </button>
              </TableHead>
              <TableHead className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground hidden sm:table-cell">
                Priority
              </TableHead>
              <TableHead className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground hidden md:table-cell">
                Status
              </TableHead>
              <TableHead className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground hidden lg:table-cell">
                Recruiter
              </TableHead>
              <TableHead className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground text-right">
                <button
                  type="button"
                  onClick={() => handleSort('daysOpen')}
                  className="flex items-center gap-1 hover:text-foreground ml-auto"
                >
                  <span className="hidden sm:inline">Days Open</span>
                  <span className="sm:hidden">Days</span>
                  <ArrowUpDown className="w-3 h-3" />
                </button>
              </TableHead>
              <TableHead className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground text-right hidden sm:table-cell">
                <button
                  type="button"
                  onClick={() => handleSort('healthScore')}
                  className="flex items-center gap-1 hover:text-foreground ml-auto"
                >
                  Health
                  <ArrowUpDown className="w-3 h-3" />
                </button>
              </TableHead>
              <TableHead className="w-[40px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedRequisitions.map((req) => {
              const recruiter = recruiters.find(r => r.id === req.assignedRecruiter);
              const priority = priorityConfig[req.priority] || priorityConfig.medium;
              const status = statusConfig[req.status] || statusConfig.open;

              return (
                <TableRow
                  key={req.id}
                  className="border-white/[0.04] hover:bg-[rgba(6,182,212,0.04)] cursor-pointer"
                >
                  <TableCell>
                    <div>
                      <p className="text-sm font-medium text-foreground line-clamp-1">{req.title}</p>
                      <p className="text-xs text-muted-foreground">{req.department} <span className="hidden sm:inline">&middot; {req.location}</span></p>
                      {/* Mobile-only: show priority inline */}
                      <div className="flex items-center gap-2 mt-1 sm:hidden">
                        <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${priority.bg} ${priority.text}`}>
                          {priority.label}
                        </span>
                        <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                        <span className="text-[10px] text-muted-foreground">{status.label}</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <span className={`inline-flex px-2 py-0.5 rounded text-[11px] font-semibold uppercase ${priority.bg} ${priority.text}`}>
                      {priority.label}
                    </span>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${status.dot}`} />
                      <span className="text-sm text-foreground">{status.label}</span>
                    </div>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <span className="text-sm text-foreground">{recruiter?.name || 'Unassigned'}</span>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className={`font-mono text-xs sm:text-sm ${req.daysOpen > 90 ? 'text-[#ef4444]' : req.daysOpen > 60 ? 'text-[#f59e0b]' : 'text-foreground'}`}>
                      {req.daysOpen}
                    </span>
                  </TableCell>
                  <TableCell className="text-right hidden sm:table-cell">
                    <span className={`font-mono text-sm font-medium ${getHealthColor(req.healthScore)}`}>
                      {req.healthScore}%
                    </span>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>View Details</DropdownMenuItem>
                        <DropdownMenuItem>Edit Requisition</DropdownMenuItem>
                        <DropdownMenuItem>Change Recruiter</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
