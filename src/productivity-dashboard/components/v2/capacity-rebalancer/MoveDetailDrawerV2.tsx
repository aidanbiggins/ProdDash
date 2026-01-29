/**
 * MoveDetailDrawerV2
 *
 * Shows detailed impact analysis for a suggested move.
 * V2 version using GlassDrawer and Tailwind tokens.
 */

import React from 'react';
import { ArrowRight, ArrowDown, ArrowUp, Check, Info } from 'lucide-react';
import { GlassDrawer } from '../../common';
import {
  ReassignmentSuggestion,
  SimulatedMoveImpact,
  PrivacyMode,
  LOAD_STATUS_LABELS,
} from '../../../types/rebalancerTypes';
import { ORACLE_CAPACITY_STAGE_LABELS } from '../../../types/capacityTypes';

interface MoveDetailDrawerV2Props {
  suggestion: ReassignmentSuggestion;
  impact: SimulatedMoveImpact;
  privacyMode: PrivacyMode;
  onClose: () => void;
  onApply: () => void;
  isApplied: boolean;
}

const statusTextColors: Record<string, string> = {
  critical: 'text-bad',
  overloaded: 'text-warn',
  balanced: 'text-good',
  available: 'text-primary',
  underutilized: 'text-muted-foreground',
};

const confidenceStyles: Record<string, string> = {
  HIGH: 'bg-good/20 text-good',
  MED: 'bg-warn/20 text-warn',
  LOW: 'bg-muted text-muted-foreground',
  INSUFFICIENT: 'bg-muted text-muted-foreground',
};

export function MoveDetailDrawerV2({
  suggestion,
  impact,
  privacyMode,
  onClose,
  onApply,
  isApplied,
}: MoveDetailDrawerV2Props) {
  const displayFromName =
    privacyMode === 'anonymized' ? 'Recruiter A' : suggestion.fromRecruiterName;
  const displayToName =
    privacyMode === 'anonymized' ? 'Recruiter B' : suggestion.toRecruiterName;

  const truncatedTitle =
    suggestion.reqTitle.length > 25
      ? suggestion.reqTitle.substring(0, 25) + '...'
      : suggestion.reqTitle;

  return (
    <GlassDrawer title={`Move Detail: ${truncatedTitle}`} onClose={onClose} width="450px">
      {/* Req Info */}
      <div className="mb-4">
        <div className="text-muted-foreground mb-1 text-[0.7rem] uppercase tracking-wider">
          Requisition
        </div>
        <div className="font-semibold text-sm text-foreground">{suggestion.reqTitle}</div>
        <div className="text-muted-foreground text-xs">{suggestion.reqId}</div>
      </div>

      {/* Move Direction */}
      <div className="flex items-center justify-center gap-3 mb-4 p-3 rounded-md bg-primary/10 border border-primary/20">
        <div className="text-center">
          <div className="text-muted-foreground text-sm">From</div>
          <div className="font-semibold text-foreground">{displayFromName}</div>
        </div>
        <ArrowRight className="w-6 h-6 text-primary" />
        <div className="text-center">
          <div className="text-muted-foreground text-sm">To</div>
          <div className="font-semibold text-foreground">{displayToName}</div>
        </div>
      </div>

      {/* Pipeline Being Moved */}
      <div className="mb-4">
        <div className="text-muted-foreground mb-2 text-[0.7rem] uppercase tracking-wider">
          Pipeline Being Moved ({impact.move.totalCandidates} candidates)
        </div>
        <div className="flex flex-wrap gap-2">
          {Object.entries(suggestion.reqDemand).map(([stage, count]) => (
            <span
              key={stage}
              className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-muted border border-border text-foreground"
            >
              {count} at {ORACLE_CAPACITY_STAGE_LABELS[stage] || stage}
            </span>
          ))}
        </div>
      </div>

      {/* Impact Analysis */}
      <div className="mb-4">
        <div className="text-muted-foreground mb-2 text-[0.7rem] uppercase tracking-wider">
          Impact Analysis
        </div>

        {/* Source Impact */}
        <div className="p-3 rounded-md mb-2 bg-good/10 border border-good/20">
          <div className="flex justify-between items-center mb-2">
            <span className="text-muted-foreground text-sm">{displayFromName} (Source)</span>
            <span className="text-good text-sm flex items-center gap-1">
              <ArrowDown className="w-3.5 h-3.5" />
              Relief
            </span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center">
              <div className="text-muted-foreground text-xs">Before</div>
              <div
                className={`font-mono font-semibold ${statusTextColors[impact.beforeSource.status]}`}
              >
                {Math.round(impact.beforeSource.utilization * 100)}%
              </div>
              <div className="text-xs text-muted-foreground">
                {LOAD_STATUS_LABELS[impact.beforeSource.status]}
              </div>
            </div>
            <div className="text-center">
              <div className="text-muted-foreground text-xs">After</div>
              <div
                className={`font-mono font-semibold ${statusTextColors[impact.afterSource.status]}`}
              >
                {Math.round(impact.afterSource.utilization * 100)}%
              </div>
              <div className="text-xs text-muted-foreground">
                {LOAD_STATUS_LABELS[impact.afterSource.status]}
              </div>
            </div>
            <div className="text-center">
              <div className="text-muted-foreground text-xs">Queue Delay</div>
              <div className="font-mono text-good">
                -
                {(
                  impact.beforeSource.queueDelayDays - impact.afterSource.queueDelayDays
                ).toFixed(1)}
                d
              </div>
            </div>
          </div>
        </div>

        {/* Target Impact */}
        <div className="p-3 rounded-md bg-warn/10 border border-warn/20">
          <div className="flex justify-between items-center mb-2">
            <span className="text-muted-foreground text-sm">{displayToName} (Target)</span>
            <span className="text-warn text-sm flex items-center gap-1">
              <ArrowUp className="w-3.5 h-3.5" />
              Impact
            </span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center">
              <div className="text-muted-foreground text-xs">Before</div>
              <div
                className={`font-mono font-semibold ${statusTextColors[impact.beforeTarget.status]}`}
              >
                {Math.round(impact.beforeTarget.utilization * 100)}%
              </div>
              <div className="text-xs text-muted-foreground">
                {LOAD_STATUS_LABELS[impact.beforeTarget.status]}
              </div>
            </div>
            <div className="text-center">
              <div className="text-muted-foreground text-xs">After</div>
              <div
                className={`font-mono font-semibold ${statusTextColors[impact.afterTarget.status]}`}
              >
                {Math.round(impact.afterTarget.utilization * 100)}%
              </div>
              <div className="text-xs text-muted-foreground">
                {LOAD_STATUS_LABELS[impact.afterTarget.status]}
              </div>
            </div>
            <div className="text-center">
              <div className="text-muted-foreground text-xs">Queue Delay</div>
              <div className="font-mono text-warn">
                +
                {(
                  impact.afterTarget.queueDelayDays - impact.beforeTarget.queueDelayDays
                ).toFixed(1)}
                d
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Net Impact */}
      <div className="p-3 rounded-md mb-4 bg-primary/10 border border-primary/20">
        <div className="flex justify-between items-center">
          <div>
            <div className="text-muted-foreground text-sm">Net System Improvement</div>
            <div className="font-mono text-xl font-bold text-primary">
              {impact.netImpact.delayReductionDays > 0 ? '-' : '+'}
              {Math.abs(impact.netImpact.delayReductionDays).toFixed(1)}d
            </div>
          </div>
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[0.65rem] ${confidenceStyles[impact.confidence]}`}
          >
            {impact.confidence}
          </span>
        </div>
        <div className="text-muted-foreground text-sm mt-1">{impact.hedgeMessage}</div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          type="button"
          className="flex-1 px-4 py-3 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors min-h-[48px] flex items-center justify-center gap-2 disabled:opacity-50"
          onClick={onApply}
          disabled={isApplied}
        >
          <Check className="w-4 h-4" />
          {isApplied ? 'Applied' : 'Apply This Move'}
        </button>
        <button
          type="button"
          className="px-4 py-3 rounded-md text-sm font-medium border border-border text-foreground hover:bg-muted transition-colors min-h-[48px]"
          onClick={onClose}
        >
          Close
        </button>
      </div>

      <p className="text-muted-foreground text-sm mt-3 mb-0 flex items-start gap-1">
        <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <span>
          Applying creates action items in the Unified Action Queue. No ATS changes are made
          automatically.
        </span>
      </p>
    </GlassDrawer>
  );
}

export default MoveDetailDrawerV2;
