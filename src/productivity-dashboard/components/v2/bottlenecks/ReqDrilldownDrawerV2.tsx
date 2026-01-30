'use client';

// ReqDrilldownDrawerV2.tsx
// Slide-in drawer showing detailed breach info for a specific requisition (V2 version)

import React from 'react';
import { StageDwellMetric, DEFAULT_SLA_POLICIES } from '../../../types/slaTypes';

interface ReqDrilldownDrawerV2Props {
  isOpen: boolean;
  onClose: () => void;
  reqId: string;
  reqTitle: string;
  recruiterName: string | null;
  hiringManagerName: string | null;
  daysOpen: number;
  dwellMetrics: StageDwellMetric[];
  onViewHMScorecard?: (hmId: string) => void;
  onCreateAction?: (reqId: string) => void;
}

function formatDate(date: Date | null): string {
  if (!date) return 'N/A';
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatHours(hours: number): string {
  if (hours < 24) {
    return `${hours.toFixed(1)}h`;
  }
  const days = hours / 24;
  return `${days.toFixed(1)}d`;
}

function getStageColorClass(breached: boolean, dwellHours: number, slaHours: number): string {
  if (breached) return 'text-red-500';
  if (dwellHours > slaHours * 0.8) return 'text-amber-500';
  return 'text-green-500';
}

function getStageBgClass(breached: boolean, dwellHours: number, slaHours: number): string {
  if (breached) return 'bg-red-500/10 border-t-red-500';
  if (dwellHours > slaHours * 0.8) return 'bg-amber-500/10 border-t-amber-500';
  return 'bg-green-500/10 border-t-green-500';
}

export function ReqDrilldownDrawerV2({
  isOpen,
  onClose,
  reqId,
  reqTitle,
  recruiterName,
  hiringManagerName,
  daysOpen,
  dwellMetrics,
  onViewHMScorecard,
  onCreateAction,
}: ReqDrilldownDrawerV2Props) {
  if (!isOpen) return null;

  // Sort metrics by entered_at
  const sortedMetrics = [...dwellMetrics].sort(
    (a, b) => a.entered_at.getTime() - b.entered_at.getTime()
  );

  // Find the worst breach
  const worstBreach = sortedMetrics
    .filter((m) => m.breached)
    .sort((a, b) => b.breach_hours - a.breach_hours)[0];

  // Aggregate metrics by stage for the timeline visualization
  const stageOrder = ['APPLIED', 'SCREEN', 'HM_SCREEN', 'ONSITE', 'OFFER', 'HIRED'];
  const stageAggregates = sortedMetrics.reduce((acc, metric) => {
    const key = metric.stage_key;
    if (!acc[key]) {
      acc[key] = {
        stage_key: key,
        total_dwell_hours: 0,
        count: 0,
        breach_count: 0,
        attribution_owner_type: metric.attribution_owner_type,
      };
    }
    acc[key].total_dwell_hours += metric.dwell_hours;
    acc[key].count += 1;
    if (metric.breached) acc[key].breach_count += 1;
    return acc;
  }, {} as Record<string, { stage_key: string; total_dwell_hours: number; count: number; breach_count: number; attribution_owner_type: string }>);

  // Sort aggregates by canonical stage order, then alphabetically for unknown stages
  const sortedStageAggregates = Object.values(stageAggregates).sort((a, b) => {
    const aIndex = stageOrder.indexOf(a.stage_key);
    const bIndex = stageOrder.indexOf(b.stage_key);
    if (aIndex === -1 && bIndex === -1) return a.stage_key.localeCompare(b.stage_key);
    if (aIndex === -1) return 1;
    if (bIndex === -1) return -1;
    return aIndex - bIndex;
  });

  return (
    <>
      {/* Backdrop */}
      <div
        className="glass-backdrop fixed top-0 left-0 right-0 bottom-0 z-[999]"
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className="glass-drawer fixed top-0 right-0 w-[500px] max-w-[90vw] h-screen z-[1000] flex flex-col overflow-hidden"
        data-testid="req-drilldown-drawer"
      >
        {/* Header */}
        <div className="glass-drawer-header p-4 flex justify-between items-start">
          <div>
            <div className="text-xs text-muted-foreground/70 uppercase tracking-wide mb-1">
              Req Detail
            </div>
            <div className="font-bold text-lg text-foreground">
              {reqId}
            </div>
            <div className="text-muted-foreground text-sm">
              {reqTitle}
            </div>
          </div>
          <button
            onClick={onClose}
            className="bg-transparent border-none text-muted-foreground cursor-pointer text-xl p-1 hover:text-foreground transition-colors"
          >
            <i className="bi bi-x-lg" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {/* Req Info */}
          <div className="flex gap-4 mb-4 text-sm">
            <div>
              <span className="text-muted-foreground/70">Recruiter:</span>{' '}
              <span className="text-foreground">{recruiterName ?? 'Unassigned'}</span>
            </div>
            <div>
              <span className="text-muted-foreground/70">HM:</span>{' '}
              <span className="text-foreground">{hiringManagerName ?? 'Unassigned'}</span>
            </div>
            <div>
              <span className="text-muted-foreground/70">Days Open:</span>{' '}
              <span className="text-foreground">{daysOpen}</span>
            </div>
          </div>

          {/* Stage Timeline (Aggregated by Stage) */}
          <div className="mb-4">
            <div className="text-xs text-muted-foreground/70 uppercase tracking-wide mb-2">
              Stage Summary
            </div>

            <div className="flex gap-0.5 overflow-auto py-2">
              {sortedStageAggregates.map((agg) => {
                const policy = DEFAULT_SLA_POLICIES.find(
                  (p) => p.stage_key === agg.stage_key
                );
                const slaHours = policy?.sla_hours ?? 72;
                const avgDwellHours = agg.total_dwell_hours / agg.count;
                const hasBreaches = agg.breach_count > 0;
                const colorClass = hasBreaches ? 'text-red-500' : avgDwellHours > slaHours * 0.8 ? 'text-amber-500' : 'text-green-500';
                const bgClass = hasBreaches ? 'bg-red-500/10 border-t-red-500' : avgDwellHours > slaHours * 0.8 ? 'bg-amber-500/10 border-t-amber-500' : 'bg-green-500/10 border-t-green-500';

                return (
                  <div
                    key={agg.stage_key}
                    className={`flex-1 min-w-[90px] p-2 rounded ${bgClass} border-t-[3px] text-center`}
                  >
                    <div className="text-xs font-medium text-foreground mb-1">
                      {agg.stage_key}
                    </div>
                    <div className={`font-mono font-semibold ${colorClass}`}>
                      {formatHours(avgDwellHours)}
                    </div>
                    <div className="text-xs text-muted-foreground/70">
                      {agg.count} candidate{agg.count !== 1 ? 's' : ''}
                      {hasBreaches && (
                        <span className="text-red-500 ml-1">
                          ({agg.breach_count} breached)
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Worst Breach Details */}
          {worstBreach && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-md mb-4">
              <div className="text-xs text-muted-foreground/70 uppercase tracking-wide mb-2">
                Breach Details
              </div>

              <div className="text-sm space-y-2">
                <div>
                  <strong className="text-foreground">Stage:</strong>{' '}
                  <span className="text-muted-foreground">{worstBreach.stage_key} (SLA: {worstBreach.sla_policy?.sla_hours ?? 72}h)</span>
                </div>
                <div>
                  <strong className="text-foreground">Entered:</strong>{' '}
                  <span className="text-muted-foreground">{formatDate(worstBreach.entered_at)}</span>
                </div>
                <div>
                  <strong className="text-foreground">Exited:</strong>{' '}
                  <span className="text-muted-foreground">{worstBreach.exited_at ? formatDate(worstBreach.exited_at) : 'Still in stage'}</span>
                </div>
                <div>
                  <strong className="text-foreground">Duration:</strong>{' '}
                  <span className="text-muted-foreground">{formatHours(worstBreach.dwell_hours)}</span>
                </div>
                <div className="text-red-500 font-semibold">
                  <strong>Breach:</strong> {formatHours(worstBreach.breach_hours)} over SLA
                </div>
                <div>
                  <strong className="text-foreground">Attribution:</strong>{' '}
                  <span className="text-muted-foreground">
                    {worstBreach.attribution_owner_type}
                    {worstBreach.attribution_owner_name && ` (${worstBreach.attribution_owner_name})`}{' '}
                    - {worstBreach.attribution_confidence} confidence
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  <strong className="text-foreground">Reason:</strong> {worstBreach.attribution_reasons.join('; ')}
                </div>
              </div>
            </div>
          )}

          {/* All Dwell Periods */}
          <div>
            <div className="text-xs uppercase tracking-wide mb-2 text-muted-foreground/70">
              All Stage Dwell Periods
            </div>

            <div className="flex flex-col gap-2">
              {sortedMetrics.map((metric, index) => (
                <div
                  key={`${metric.candidate_id}-${metric.stage_key}-${index}`}
                  className="p-2 px-3 rounded text-sm bg-white/[0.02]"
                >
                  <div className="flex justify-between items-center">
                    <div className="text-sm font-medium text-foreground">
                      {metric.stage_key}
                      {metric.breached && (
                        <span className="ml-2 text-red-500 text-xs">
                          BREACH
                        </span>
                      )}
                    </div>
                    <div className="font-mono text-foreground">
                      {formatHours(metric.dwell_hours)}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Candidate: {metric.candidate_id.slice(0, 8)}... | Owner:{' '}
                    {metric.attribution_owner_type}
                    {metric.is_reentry && ' | Re-entry'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-3 px-4 border-t border-border flex gap-2">
          {worstBreach?.attribution_owner_id &&
            worstBreach.attribution_owner_type === 'HM' &&
            onViewHMScorecard && (
              <button
                onClick={() => onViewHMScorecard(worstBreach.attribution_owner_id!)}
                className="flex-1 p-2 text-sm rounded cursor-pointer bg-violet-500/10 border border-violet-500/30 text-violet-500 hover:bg-violet-500/20 transition-colors"
              >
                <i className="bi bi-person-badge mr-1" />
                View HM Scorecard
              </button>
            )}
          {onCreateAction && (
            <button
              onClick={() => onCreateAction(reqId)}
              className="flex-1 p-2 text-sm rounded cursor-pointer bg-green-500/10 border border-green-500/30 text-green-500 hover:bg-green-500/20 transition-colors"
            >
              <i className="bi bi-plus-circle mr-1" />
              Create Action
            </button>
          )}
        </div>
      </div>
    </>
  );
}

export default ReqDrilldownDrawerV2;
