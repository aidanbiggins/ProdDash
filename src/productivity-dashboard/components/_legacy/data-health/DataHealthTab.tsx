// Data Health Tab Component
// Displays data hygiene information: Zombie reqs, Ghost candidates, TTF comparison

import React, { useMemo, useState } from 'react';
import {
  Requisition,
  Candidate,
  Event,
  User,
  RequisitionStatus
} from '../../../types';
import {
  ReqHealthStatus,
  ReqHealthAssessment,
  GhostCandidateAssessment,
  DataHygieneSummary,
  DataHygieneExclusions,
  DEFAULT_HYGIENE_SETTINGS
} from '../../../types/dataHygieneTypes';
import { Checkbox } from '../../../../components/ui/toggles';
import {
  assessAllReqHealth,
  detectGhostCandidates,
  calculateDataHygieneSummary
} from '../../../services/reqHealthService';
import { StatLabel, StatValue } from '../../common';
import { PageHeader, GlassPanel } from '../layout';

interface DataHealthTabProps {
  requisitions: Requisition[];
  candidates: Candidate[];
  events: Event[];
  users: User[];
  excludedReqIds: Set<string>;
  onToggleExclusion: (reqId: string) => void;
}

// Status Tailwind classes for dark mode
const STATUS_CLASSES: Record<ReqHealthStatus, { bg: string; text: string; border: string }> = {
  [ReqHealthStatus.ACTIVE]: { bg: 'bg-good-bg', text: 'text-good', border: 'border-good' },
  [ReqHealthStatus.STALLED]: { bg: 'bg-warn-bg', text: 'text-warn', border: 'border-warn' },
  [ReqHealthStatus.ZOMBIE]: { bg: 'bg-destructive/10', text: 'text-bad', border: 'border-bad' },
  [ReqHealthStatus.AT_RISK]: { bg: 'bg-purple-500/15', text: 'text-purple-400', border: 'border-purple-500' }
};

const STATUS_LABELS: Record<ReqHealthStatus, string> = {
  [ReqHealthStatus.ACTIVE]: 'Active',
  [ReqHealthStatus.STALLED]: 'Stalled',
  [ReqHealthStatus.ZOMBIE]: 'Zombie',
  [ReqHealthStatus.AT_RISK]: 'At Risk'
};

export function DataHealthTab({
  requisitions,
  candidates,
  events,
  users,
  excludedReqIds,
  onToggleExclusion
}: DataHealthTabProps) {
  const [activeFilter, setActiveFilter] = useState<ReqHealthStatus | 'ALL'>('ALL');
  const [showGhostCandidates, setShowGhostCandidates] = useState(false);

  // Build settings with current exclusions
  const settings: DataHygieneExclusions = useMemo(() => ({
    ...DEFAULT_HYGIENE_SETTINGS,
    excludedReqIds
  }), [excludedReqIds]);

  // Calculate all assessments
  const reqAssessments = useMemo(() =>
    assessAllReqHealth(requisitions, candidates, events, settings),
    [requisitions, candidates, events, settings]
  );

  const ghostCandidates = useMemo(() =>
    detectGhostCandidates(candidates, requisitions, events, users, settings),
    [candidates, requisitions, events, users, settings]
  );

  const summary = useMemo(() =>
    calculateDataHygieneSummary(requisitions, candidates, events, users, settings),
    [requisitions, candidates, events, users, settings]
  );

  // Filter assessments for display (non-closed/canceled reqs)
  const displayAssessments = useMemo(() => {
    // Include any req that isn't explicitly closed or canceled
    // This handles various status values from different ATS systems
    const closedStatuses = [RequisitionStatus.Closed, RequisitionStatus.Canceled, 'Closed', 'Canceled', 'Filled', 'Cancelled'];
    const activeReqIds = new Set(
      requisitions.filter(r => !closedStatuses.includes(r.status as any)).map(r => r.req_id)
    );

    // If no reqs match our "active" filter, show all reqs (better than showing nothing)
    const targetReqIds = activeReqIds.size > 0 ? activeReqIds : new Set(requisitions.map(r => r.req_id));
    let filtered = reqAssessments.filter(a => targetReqIds.has(a.reqId));

    if (activeFilter !== 'ALL') {
      filtered = filtered.filter(a => a.status === activeFilter);
    }

    // Sort: Zombies first, then by days since activity
    return filtered.sort((a, b) => {
      const statusOrder = { ZOMBIE: 0, STALLED: 1, AT_RISK: 2, ACTIVE: 3 };
      const statusDiff = statusOrder[a.status] - statusOrder[b.status];
      if (statusDiff !== 0) return statusDiff;
      return (b.daysSinceLastActivity || 0) - (a.daysSinceLastActivity || 0);
    });
  }, [reqAssessments, requisitions, activeFilter]);

  // Get req details for display
  const reqMap = useMemo(() =>
    new Map(requisitions.map(r => [r.req_id, r])),
    [requisitions]
  );

  const userMap = useMemo(() =>
    new Map(users.map(u => [u.user_id, u])),
    [users]
  );

  return (
    <div className="animate-fade-in">
      {/* Page Header */}
      <PageHeader
        title="Data Health"
        description="Monitor data hygiene: zombie reqs, ghost candidates, and TTF accuracy"
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-12 gap-3 mb-4">
        {/* Hygiene Score */}
        <div className="col-span-12 md:col-span-3">
          <div className="rounded-lg border border-border bg-card h-full">
            <div className="text-center py-6 px-4">
              <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">Data Hygiene Score</div>
              <div className={`font-mono text-4xl font-bold ${summary.hygieneScore >= 80 ? 'text-good' : summary.hygieneScore >= 60 ? 'text-warn' : 'text-bad'}`}>
                {summary.hygieneScore}
              </div>
              <div className="text-sm text-muted-foreground mt-1">out of 100</div>
            </div>
          </div>
        </div>

        {/* TTF Comparison */}
        <div className="col-span-12 md:col-span-3">
          <div className="rounded-lg border border-border bg-card h-full">
            <div className="text-center py-6 px-4">
              <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">True TTF vs Raw</div>
              <div className="flex justify-center items-baseline gap-2">
                <span className="font-mono text-3xl font-bold text-cyan-400">
                  {summary.trueMedianTTF !== null ? `${summary.trueMedianTTF}d` : '—'}
                </span>
                <span className="text-zinc-500">/</span>
                <span className="font-mono text-xl text-slate-400">
                  {summary.rawMedianTTF !== null ? `${summary.rawMedianTTF}d` : '—'}
                </span>
              </div>
              {summary.ttfDifferencePercent !== null && (
                <div className="text-sm mt-1 text-good">
                  {summary.ttfDifferencePercent.toFixed(0)}% faster when clean
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Zombie Count */}
        <div className="col-span-12 md:col-span-3">
          <div
            className={`rounded-lg border bg-card h-full cursor-pointer transition-colors hover:bg-white/5 ${activeFilter === ReqHealthStatus.ZOMBIE ? 'border-l-[3px] border-l-bad border-border' : 'border-border'}`}
            onClick={() => setActiveFilter(activeFilter === ReqHealthStatus.ZOMBIE ? 'ALL' : ReqHealthStatus.ZOMBIE)}
          >
            <div className="text-center py-6 px-4">
              <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">Zombie Reqs</div>
              <div className="font-mono text-4xl font-bold text-bad">{summary.zombieReqCount}</div>
              <div className="text-sm text-muted-foreground mt-1">30+ days inactive</div>
            </div>
          </div>
        </div>

        {/* Ghost Candidates */}
        <div className="col-span-12 md:col-span-3">
          <div
            className={`rounded-lg border bg-card h-full cursor-pointer transition-colors hover:bg-white/5 ${showGhostCandidates ? 'border-l-[3px] border-l-purple-500 border-border' : 'border-border'}`}
            onClick={() => setShowGhostCandidates(!showGhostCandidates)}
          >
            <div className="text-center py-6 px-4">
              <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">Ghost Candidates</div>
              <div className="font-mono text-4xl font-bold text-purple-400">
                {summary.stagnantCandidateCount + summary.abandonedCandidateCount}
              </div>
              <div className="text-sm text-muted-foreground mt-1">10+ days stuck</div>
            </div>
          </div>
        </div>
      </div>

      {/* Status Filter Pills */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <button
          type="button"
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${activeFilter === 'ALL' ? 'bg-accent text-accent-foreground' : 'bg-white/5 text-muted-foreground hover:text-foreground hover:bg-white/10 border border-white/10'}`}
          onClick={() => setActiveFilter('ALL')}
        >
          All ({displayAssessments.length})
        </button>
        {Object.entries(STATUS_LABELS).map(([status, label]) => {
          const count = reqAssessments.filter(a => {
            const req = reqMap.get(a.reqId);
            return req?.status === RequisitionStatus.Open && a.status === status;
          }).length;
          if (count === 0) return null;
          const classes = STATUS_CLASSES[status as ReqHealthStatus];
          return (
            <button
              key={status}
              type="button"
              className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${activeFilter === status ? `${classes.bg} ${classes.border} ${classes.text}` : 'bg-transparent border-zinc-700 text-slate-400 hover:border-zinc-600'}`}
              onClick={() => setActiveFilter(activeFilter === status ? 'ALL' : status as ReqHealthStatus)}
            >
              {label} ({count})
            </button>
          );
        })}
      </div>

      {/* Ghost Candidates Panel */}
      {showGhostCandidates && (
        <div className="rounded-lg border border-border bg-card mb-4">
          <div className="flex justify-between items-center px-4 py-3 border-b border-white/10">
            <h6 className="text-sm font-semibold text-foreground">
              <span className="mr-2">👻</span>
              Ghost Candidates
            </h6>
            <button
              type="button"
              className="px-3 py-1.5 text-xs font-medium rounded-md bg-white/5 text-muted-foreground hover:text-foreground hover:bg-white/10 border border-white/10 transition-colors"
              onClick={() => setShowGhostCandidates(false)}
            >
              Close
            </button>
          </div>
          <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
            <table className="w-full text-sm" style={{ minWidth: '700px' }}>
              <thead>
                <tr className="border-b border-white/10">
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground whitespace-nowrap">Candidate</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground whitespace-nowrap">Requisition</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground whitespace-nowrap">Stage</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground whitespace-nowrap">Days Stuck</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground whitespace-nowrap">Recruiter</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground whitespace-nowrap">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {ghostCandidates.slice(0, 50).map(ghost => (
                  <tr key={ghost.candidateId} className="hover:bg-white/5">
                    <td className="px-4 py-3 font-medium text-foreground">{ghost.candidateName || ghost.candidateId}</td>
                    <td className="px-4 py-3">
                      <div className="truncate max-w-[200px]" title={ghost.reqTitle}>
                        {ghost.reqTitle}
                      </div>
                      <span className="text-xs text-muted-foreground">{ghost.reqId}</span>
                    </td>
                    <td className="px-4 py-3 text-foreground">{ghost.currentStage}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-mono ${ghost.daysInCurrentStage >= 30 ? 'text-bad' : 'text-warn'}`}>
                        {ghost.daysInCurrentStage}d
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{ghost.recruiterName}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${ghost.status === 'ABANDONED' ? 'bg-destructive/10 text-bad' : 'bg-warn-bg text-warn'}`}>
                        {ghost.status === 'ABANDONED' ? 'Abandoned' : 'Stagnant'}
                      </span>
                    </td>
                  </tr>
                ))}
                {ghostCandidates.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center text-muted-foreground py-8">
                      No ghost candidates found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Requisition Health Table */}
      <div className="rounded-lg border border-border bg-card">
        <div className="flex justify-between items-center px-4 py-3 border-b border-white/10">
          <h6 className="text-sm font-semibold text-foreground">
            Requisition Health Status
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-white/10 text-muted-foreground ml-2">
              {displayAssessments.length} reqs
            </span>
          </h6>
          <div className="text-sm text-muted-foreground">
            Toggle "Exclude" to remove from TTF calculations
          </div>
        </div>
        <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
          <table className="w-full text-sm" style={{ minWidth: '800px' }}>
            <thead>
              <tr className="border-b border-white/10">
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground whitespace-nowrap w-[80px]">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground whitespace-nowrap">Requisition</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground whitespace-nowrap">Recruiter</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground whitespace-nowrap">HM</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground whitespace-nowrap">Days Open</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground whitespace-nowrap">Last Activity</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground whitespace-nowrap">Candidates</th>
                <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground whitespace-nowrap">Exclude</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {displayAssessments.slice(0, 100).map(assessment => {
                const req = reqMap.get(assessment.reqId);
                if (!req) return null;
                const recruiter = userMap.get(req.recruiter_id);
                const hm = userMap.get(req.hiring_manager_id);
                const classes = STATUS_CLASSES[assessment.status];
                const isExcluded = excludedReqIds.has(assessment.reqId);

                return (
                  <tr
                    key={assessment.reqId}
                    className={`hover:bg-white/5 ${isExcluded ? 'opacity-50' : ''}`}
                  >
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${classes.bg} ${classes.text} border ${classes.border}`}>
                        {STATUS_LABELS[assessment.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground truncate max-w-[250px]" title={req.req_title}>
                        {req.req_title}
                      </div>
                      <span className="text-xs text-muted-foreground">{req.req_id}</span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{recruiter?.name || req.recruiter_id}</td>
                    <td className="px-4 py-3 text-muted-foreground">{hm?.name || req.hiring_manager_id}</td>
                    <td className="px-4 py-3 text-right font-mono text-foreground">
                      {assessment.daysOpen}d
                    </td>
                    <td className="px-4 py-3 text-right">
                      {assessment.daysSinceLastActivity !== null ? (
                        <span className={`font-mono ${assessment.daysSinceLastActivity >= 30 ? 'text-bad' : assessment.daysSinceLastActivity >= 14 ? 'text-warn' : 'text-muted-foreground'}`}>
                          {assessment.daysSinceLastActivity}d ago
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-foreground">
                      {assessment.activeCandidateCount}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Checkbox
                        checked={isExcluded}
                        onChange={() => onToggleExclusion(assessment.reqId)}
                      />
                    </td>
                  </tr>
                );
              })}
              {displayAssessments.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center text-muted-foreground py-8">
                    No requisitions match the current filter
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {displayAssessments.length > 100 && (
          <div className="px-4 py-3 border-t border-white/10 text-muted-foreground text-center text-sm">
            Showing first 100 of {displayAssessments.length} requisitions
          </div>
        )}
      </div>

      {/* Interpretation Guide */}
      <div className="rounded-lg border border-border bg-card mt-4">
        <div className="px-4 py-3 border-b border-white/10">
          <h6 className="text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground">
            Understanding Data Hygiene
          </h6>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-12 gap-3">
            <div className="col-span-12 md:col-span-3">
              <div className="p-3 h-full bg-[#141414] rounded border-t-2 border-bad">
                <h6 className="text-sm font-semibold mb-2 text-bad">Zombie Reqs</h6>
                <p className="text-xs text-muted-foreground leading-relaxed m-0">
                  No candidate activity in 30+ days. These inflate your TTF and should be excluded or closed.
                </p>
              </div>
            </div>
            <div className="col-span-12 md:col-span-3">
              <div className="p-3 h-full bg-[#141414] rounded border-t-2 border-warn">
                <h6 className="text-sm font-semibold mb-2 text-warn">Stalled Reqs</h6>
                <p className="text-xs text-muted-foreground leading-relaxed m-0">
                  No activity in 14-30 days. May need recruiter attention or HM follow-up to get moving again.
                </p>
              </div>
            </div>
            <div className="col-span-12 md:col-span-3">
              <div className="p-3 h-full bg-[#141414] rounded border-t-2 border-purple-500">
                <h6 className="text-sm font-semibold mb-2 text-purple-400">At Risk Reqs</h6>
                <p className="text-xs text-muted-foreground leading-relaxed m-0">
                  Open 120+ days with fewer than 5 candidates. May have unrealistic requirements or poor sourcing.
                </p>
              </div>
            </div>
            <div className="col-span-12 md:col-span-3">
              <div className="p-3 h-full bg-[#141414] rounded border-t-2 border-teal-400">
                <h6 className="text-sm font-semibold mb-2 text-good">True TTF</h6>
                <p className="text-xs text-muted-foreground leading-relaxed m-0">
                  Time-to-fill calculated excluding zombie reqs. Gives a more accurate picture of actual performance.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DataHealthTab;
