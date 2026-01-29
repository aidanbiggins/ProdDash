/**
 * RecruiterWorkloadDrawerV2
 *
 * Shows detailed workload breakdown for a single recruiter.
 * V2 version using GlassDrawer and Tailwind tokens.
 */

import React from 'react';
import { CheckCircle, AlertCircle, Info, Briefcase, Users } from 'lucide-react';
import { GlassDrawer } from '../../common';
import {
  RecruiterUtilizationRow,
  PrivacyMode,
  LOAD_STATUS_LABELS
} from '../../../types/rebalancerTypes';
import { Requisition, Candidate, CandidateDisposition } from '../../../types/entities';

interface RecruiterWorkloadDrawerV2Props {
  recruiter: RecruiterUtilizationRow;
  requisitions: Requisition[];
  candidates: Candidate[];
  privacyMode: PrivacyMode;
  onClose: () => void;
}

const statusStyles: Record<string, string> = {
  critical: 'bg-bad/20 text-bad border-bad/30',
  overloaded: 'bg-warn/20 text-warn border-warn/30',
  balanced: 'bg-good/20 text-good border-good/30',
  available: 'bg-primary/20 text-primary border-primary/30',
  underutilized: 'bg-muted text-muted-foreground border-border',
};

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

export function RecruiterWorkloadDrawerV2({
  recruiter,
  requisitions,
  candidates,
  privacyMode,
  onClose,
}: RecruiterWorkloadDrawerV2Props) {
  // Get open reqs for this recruiter
  const recruiterReqs = requisitions.filter(
    (r) => r.recruiter_id === recruiter.recruiterId && !r.closed_at
  );

  // Count active candidates per req
  const reqPipelines = recruiterReqs
    .map((req) => {
      const activeCandidates = candidates.filter(
        (c) =>
          c.req_id === req.req_id &&
          (c.disposition === CandidateDisposition.Active || !c.disposition)
      );
      return {
        reqId: req.req_id,
        reqTitle: req.req_title ?? `Req ${req.req_id}`,
        candidateCount: activeCandidates.length,
      };
    })
    .sort((a, b) => b.candidateCount - a.candidateCount);

  const displayName =
    privacyMode === 'anonymized'
      ? `Recruiter ${recruiter.recruiterId.substring(0, 4)}`
      : recruiter.recruiterName;

  const getStageUtilColor = (utilization: number) => {
    if (utilization > 1.2) return 'text-bad';
    if (utilization > 1.1) return 'text-warn';
    if (utilization > 0.9) return 'text-good';
    return 'text-primary';
  };

  return (
    <GlassDrawer title={`${displayName} Workload`} onClose={onClose} width="400px">
      {/* Overall Status */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-muted-foreground text-xs uppercase tracking-wider">
            Overall Status
          </span>
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border ${statusStyles[recruiter.status]}`}
          >
            {LOAD_STATUS_LABELS[recruiter.status]}
          </span>
        </div>
        <div
          className={`p-3 rounded-md border ${statusStyles[recruiter.status]}`}
        >
          <div className="flex justify-between items-center">
            <span
              className={`font-mono text-2xl font-bold ${statusTextColors[recruiter.status]}`}
            >
              {Math.round(recruiter.utilization * 100)}%
            </span>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[0.6rem] ${confidenceStyles[recruiter.confidence]}`}
            >
              {recruiter.confidence}
            </span>
          </div>
          <div className="text-muted-foreground text-xs mt-1">
            {recruiter.totalDemand} candidates / {Math.round(recruiter.totalCapacity)}/wk
            capacity
          </div>
        </div>
      </div>

      {/* Stage Breakdown */}
      <div className="mb-4">
        <div className="text-muted-foreground mb-2 text-xs uppercase tracking-wider">
          Stage Breakdown
        </div>
        <div className="glass-panel overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="px-3 py-2 text-left text-muted-foreground font-medium">
                  Stage
                </th>
                <th className="px-3 py-2 text-center text-muted-foreground font-medium">
                  Demand
                </th>
                <th className="px-3 py-2 text-center text-muted-foreground font-medium">
                  Capacity
                </th>
                <th className="px-3 py-2 text-center text-muted-foreground font-medium">
                  Util
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {recruiter.stageUtilization.map((stage) => (
                <tr key={stage.stage}>
                  <td className="px-3 py-2 text-foreground">{stage.stageName}</td>
                  <td className="px-3 py-2 text-center font-mono text-foreground">
                    {stage.demand}
                  </td>
                  <td className="px-3 py-2 text-center font-mono text-foreground">
                    {Math.round(stage.capacity)}/wk
                  </td>
                  <td
                    className={`px-3 py-2 text-center font-mono font-semibold ${getStageUtilColor(stage.utilization)}`}
                  >
                    {Math.round(stage.utilization * 100)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Open Requisitions */}
      <div>
        <div className="text-muted-foreground mb-2 text-xs uppercase tracking-wider flex items-center gap-1">
          <Briefcase className="w-3 h-3" />
          Open Reqs ({recruiterReqs.length})
        </div>
        <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto">
          {reqPipelines.length === 0 ? (
            <div className="text-muted-foreground text-sm p-3 glass-panel">
              No open requisitions
            </div>
          ) : (
            reqPipelines.map((req) => (
              <div
                key={req.reqId}
                className="flex justify-between items-center p-2 rounded-md bg-muted/30"
              >
                <span className="text-sm text-foreground truncate flex-1 min-w-0 mr-2" title={req.reqTitle}>
                  {req.reqTitle.length > 35
                    ? req.reqTitle.substring(0, 35) + '...'
                    : req.reqTitle}
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-primary/10 text-primary flex-shrink-0">
                  <Users className="w-3 h-3" />
                  {req.candidateCount}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Confidence Reasons */}
      {recruiter.confidenceReasons.length > 0 && (
        <div className="mt-4 pt-3 border-t border-border">
          <div className="text-muted-foreground mb-2 text-[0.7rem] uppercase tracking-wider">
            Confidence Notes
          </div>
          <ul className="space-y-1">
            {recruiter.confidenceReasons.map((reason, i) => (
              <li key={i} className="flex items-start gap-2 text-xs">
                {reason.impact === 'positive' ? (
                  <CheckCircle className="w-3.5 h-3.5 text-good flex-shrink-0 mt-0.5" />
                ) : reason.impact === 'negative' ? (
                  <AlertCircle className="w-3.5 h-3.5 text-warn flex-shrink-0 mt-0.5" />
                ) : (
                  <Info className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />
                )}
                <span className="text-muted-foreground">{reason.message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </GlassDrawer>
  );
}

export default RecruiterWorkloadDrawerV2;
