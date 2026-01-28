'use client';

// BreachTableV2.tsx
// Displays SLA breach table with requisition-level details (V2 version)

import React, { useState } from 'react';
import { ReqBreachSummary } from '../../../types/slaTypes';
import { SectionHeader } from '../../common/SectionHeader';
import { HelpButton, HelpDrawer } from '../../common';
import { BREACH_TABLE_HELP } from '../../_legacy/bottlenecks/bottlenecksHelpContent';

interface BreachTableV2Props {
  breaches: ReqBreachSummary[];
  onReqClick?: (reqId: string) => void;
  onExport?: () => void;
}

const PAGE_SIZE = 10;

function formatHours(hours: number): string {
  if (hours < 24) {
    return `${hours.toFixed(1)}h`;
  }
  const days = hours / 24;
  return `${days.toFixed(1)}d`;
}

function getBreachSeverity(hours: number): { colorClass: string; bgClass: string; label: string } {
  if (hours > 48) return { colorClass: 'text-red-500', bgClass: 'bg-red-500/10', label: 'Critical' };
  if (hours > 24) return { colorClass: 'text-amber-500', bgClass: 'bg-amber-500/10', label: 'High' };
  return { colorClass: 'text-green-500', bgClass: 'bg-green-500/10', label: 'Medium' };
}

export function BreachTableV2({ breaches, onReqClick, onExport }: BreachTableV2Props) {
  const [showAll, setShowAll] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const displayedBreaches = showAll ? breaches : breaches.slice(0, PAGE_SIZE);
  const totalBreaches = breaches.length;
  const totalBreachHours = breaches.reduce((sum, b) => sum + b.total_breach_hours, 0);

  if (breaches.length === 0) {
    return (
      <div className="glass-panel p-4">
        <SectionHeader
          title="SLA Breaches by Requisition"
          actions={
            <div className="flex gap-2 items-center">
              {onExport && (
                <button
                  className="px-3 py-1 text-sm border border-gray-500 text-gray-300 rounded hover:bg-gray-700 transition-colors"
                  onClick={onExport}
                >
                  <i className="bi bi-download mr-1" />
                  Export
                </button>
              )}
              <HelpButton onClick={() => setShowHelp(true)} ariaLabel="Help for breach table" />
            </div>
          }
        />
        <HelpDrawer
          isOpen={showHelp}
          onClose={() => setShowHelp(false)}
          title="SLA Breaches by Requisition"
          content={BREACH_TABLE_HELP}
        />
        <div className="py-6 text-center text-muted-foreground">
          <i className="bi bi-shield-check text-3xl opacity-50" />
          <p className="mt-2">
            No SLA breaches detected. All stages within limits.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-panel p-4">
      <SectionHeader
        title="SLA Breaches by Requisition"
        badge={`${totalBreaches} breaches`}
        actions={
          <div className="flex gap-2 items-center">
            <span className="text-xs px-2 py-1 rounded text-muted-foreground bg-red-500/10">
              Total: {formatHours(totalBreachHours)} over SLA
            </span>
            {onExport && (
              <button
                className="px-2 py-1 text-xs border border-gray-500 text-gray-300 rounded hover:bg-gray-700 transition-colors"
                onClick={onExport}
              >
                <i className="bi bi-download mr-1" />
                Export
              </button>
            )}
            <HelpButton onClick={() => setShowHelp(true)} ariaLabel="Help for breach table" />
          </div>
        }
      />
      <HelpDrawer
        isOpen={showHelp}
        onClose={() => setShowHelp(false)}
        title="SLA Breaches by Requisition"
        content={BREACH_TABLE_HELP}
      />

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="px-3 py-2 text-xs text-muted-foreground/70 uppercase tracking-wide font-semibold">
                Requisition
              </th>
              <th className="px-3 py-2 text-xs text-muted-foreground/70 uppercase tracking-wide font-semibold">
                Worst Stage
              </th>
              <th className="px-3 py-2 text-xs text-muted-foreground/70 uppercase tracking-wide font-semibold text-right">
                Breach Hours
              </th>
              <th className="px-3 py-2 text-xs text-muted-foreground/70 uppercase tracking-wide font-semibold">
                Owner
              </th>
              <th className="px-3 py-2 text-xs text-muted-foreground/70 uppercase tracking-wide font-semibold text-right">
                Days Open
              </th>
              <th className="px-3 py-2 text-xs text-muted-foreground/70 uppercase tracking-wide font-semibold text-center">
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {displayedBreaches.map((breach) => {
              const severity = getBreachSeverity(breach.worst_breach_hours);
              const ownerName =
                breach.hiring_manager_name ?? breach.recruiter_name ?? 'Unknown';

              return (
                <tr
                  key={breach.req_id}
                  className={`border-b border-white/5 ${
                    onReqClick ? 'cursor-pointer hover:bg-white/[0.03]' : ''
                  } transition-colors`}
                  onClick={() => onReqClick?.(breach.req_id)}
                >
                  <td className="px-3 py-3 align-middle">
                    <div className="font-medium text-foreground">
                      {breach.req_id}
                    </div>
                    <div className="text-xs text-muted-foreground max-w-[200px] overflow-hidden text-ellipsis whitespace-nowrap">
                      {breach.req_title}
                    </div>
                  </td>
                  <td className="px-3 py-3 align-middle">
                    <span
                      className={`px-2 py-0.5 ${severity.bgClass} ${severity.colorClass} rounded text-xs font-medium`}
                    >
                      {breach.worst_stage}
                    </span>
                  </td>
                  <td className={`px-3 py-3 align-middle text-right font-mono font-semibold ${severity.colorClass}`}>
                    {formatHours(breach.worst_breach_hours)}
                  </td>
                  <td className="px-3 py-3 align-middle">
                    <div className="text-sm text-foreground">{ownerName}</div>
                    <div className="text-xs text-muted-foreground">
                      {breach.breach_count} breach{breach.breach_count !== 1 ? 'es' : ''}
                    </div>
                  </td>
                  <td className="px-3 py-3 align-middle text-right font-mono text-foreground">
                    {breach.days_open}d
                  </td>
                  <td className="px-3 py-3 align-middle text-center">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onReqClick?.(breach.req_id);
                      }}
                      className="bg-transparent border-none text-accent-primary cursor-pointer px-2 py-1 hover:opacity-80 transition-opacity"
                    >
                      <i className="bi bi-arrow-right" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Show More / Show Less */}
      {totalBreaches > PAGE_SIZE && (
        <div className="text-center mt-3">
          <button
            onClick={() => setShowAll(!showAll)}
            className="bg-transparent border border-border text-muted-foreground px-4 py-1.5 rounded text-xs cursor-pointer hover:bg-white/5 transition-colors"
          >
            {showAll
              ? 'Show Less'
              : `Show All (${totalBreaches - PAGE_SIZE} more)`}
          </button>
        </div>
      )}
    </div>
  );
}

export default BreachTableV2;
