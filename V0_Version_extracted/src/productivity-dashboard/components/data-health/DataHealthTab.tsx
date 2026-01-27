// Data Health Tab Component
// Displays data hygiene information: Zombie reqs, Ghost candidates, TTF comparison

import React, { useMemo, useState } from 'react';
import {
  Requisition,
  Candidate,
  Event,
  User,
  RequisitionStatus
} from '../../types';
import {
  ReqHealthStatus,
  ReqHealthAssessment,
  GhostCandidateAssessment,
  DataHygieneSummary,
  DataHygieneExclusions,
  DEFAULT_HYGIENE_SETTINGS
} from '../../types/dataHygieneTypes';
import {
  assessAllReqHealth,
  detectGhostCandidates,
  calculateDataHygieneSummary
} from '../../services/reqHealthService';
import { StatLabel, StatValue } from '../common';
import { PageHeader, GlassPanel } from '../layout';

interface DataHealthTabProps {
  requisitions: Requisition[];
  candidates: Candidate[];
  events: Event[];
  users: User[];
  excludedReqIds: Set<string>;
  onToggleExclusion: (reqId: string) => void;
}

// Status colors for dark mode
const STATUS_COLORS: Record<ReqHealthStatus, { bg: string; text: string; border: string }> = {
  [ReqHealthStatus.ACTIVE]: { bg: 'rgba(16, 185, 129, 0.15)', text: '#34d399', border: '#10b981' },
  [ReqHealthStatus.STALLED]: { bg: 'rgba(245, 158, 11, 0.15)', text: '#fbbf24', border: '#f59e0b' },
  [ReqHealthStatus.ZOMBIE]: { bg: 'rgba(239, 68, 68, 0.15)', text: '#f87171', border: '#ef4444' },
  [ReqHealthStatus.AT_RISK]: { bg: 'rgba(168, 85, 247, 0.15)', text: '#c084fc', border: '#a855f7' }
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
          <div className="card-bespoke h-full">
            <div className="card-body text-center py-4">
              <StatLabel className="mb-2">Data Hygiene Score</StatLabel>
              <StatValue
                color={summary.hygieneScore >= 80 ? 'success' :
                  summary.hygieneScore >= 60 ? 'warning' : 'danger'}
              >
                {summary.hygieneScore}
              </StatValue>
              <div className="text-sm text-muted-foreground mt-1">out of 100</div>
            </div>
          </div>
        </div>

        {/* TTF Comparison */}
        <div className="col-span-12 md:col-span-3">
          <div className="card-bespoke h-full">
            <div className="card-body text-center py-4">
              <StatLabel className="mb-2">True TTF vs Raw</StatLabel>
              <div className="flex justify-center items-baseline gap-2">
                <StatValue size="sm" className="text-cyan-500">
                  {summary.trueMedianTTF !== null ? `${summary.trueMedianTTF}d` : '—'}
                </StatValue>
                <span style={{ color: '#71717a' }}>/</span>
                <span className="stat-value stat-value-sm" style={{ color: '#94A3B8' }}>
                  {summary.rawMedianTTF !== null ? `${summary.rawMedianTTF}d` : '—'}
                </span>
              </div>
              {summary.ttfDifferencePercent !== null && (
                <div className="text-sm mt-1 text-success">
                  {summary.ttfDifferencePercent.toFixed(0)}% faster when clean
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Zombie Count */}
        <div className="col-span-12 md:col-span-3">
          <div
            className="card-bespoke h-full cursor-pointer"
            onClick={() => setActiveFilter(activeFilter === ReqHealthStatus.ZOMBIE ? 'ALL' : ReqHealthStatus.ZOMBIE)}
            style={{
              borderLeft: activeFilter === ReqHealthStatus.ZOMBIE ? '3px solid #ef4444' : undefined
            }}
          >
            <div className="card-body text-center py-4">
              <StatLabel className="mb-2">Zombie Reqs</StatLabel>
              <StatValue color="danger">{summary.zombieReqCount}</StatValue>
              <div className="text-sm text-muted-foreground mt-1">30+ days inactive</div>
            </div>
          </div>
        </div>

        {/* Ghost Candidates */}
        <div className="col-span-12 md:col-span-3">
          <div
            className="card-bespoke h-full cursor-pointer"
            onClick={() => setShowGhostCandidates(!showGhostCandidates)}
            style={{
              borderLeft: showGhostCandidates ? '3px solid #a855f7' : undefined
            }}
          >
            <div className="card-body text-center py-4">
              <StatLabel className="mb-2">Ghost Candidates</StatLabel>
              <span className="stat-value" style={{ color: '#c084fc' }}>
                {summary.stagnantCandidateCount + summary.abandonedCandidateCount}
              </span>
              <div className="text-sm text-muted-foreground mt-1">10+ days stuck</div>
            </div>
          </div>
        </div>
      </div>

      {/* Status Filter Pills */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <button
          type="button"
          className={`px-3 py-1.5 text-xs ${activeFilter === 'ALL' ? 'btn-bespoke' : 'btn-bespoke-secondary'}`}
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
          const colors = STATUS_COLORS[status as ReqHealthStatus];
          return (
            <button
              key={status}
              type="button"
              className="px-3 py-1.5 text-xs"
              onClick={() => setActiveFilter(activeFilter === status ? 'ALL' : status as ReqHealthStatus)}
              style={{
                background: activeFilter === status ? colors.bg : 'transparent',
                border: `1px solid ${activeFilter === status ? colors.border : '#27272a'}`,
                color: activeFilter === status ? colors.text : '#94A3B8'
              }}
            >
              {label} ({count})
            </button>
          );
        })}
      </div>

      {/* Ghost Candidates Panel */}
      {showGhostCandidates && (
        <div className="card-bespoke mb-4">
          <div className="card-header flex justify-between items-center">
            <h6 className="mb-0">
              <span style={{ marginRight: '0.5rem' }}>👻</span>
              Ghost Candidates
            </h6>
            <button
              type="button"
              className="btn-bespoke-secondary px-3 py-1.5 text-xs"
              onClick={() => setShowGhostCandidates(false)}
            >
              Close
            </button>
          </div>
          <div className="card-body p-0">
            <div className="overflow-x-auto">
              <table className="table table-bespoke mb-0">
                <thead>
                  <tr>
                    <th>Candidate</th>
                    <th>Requisition</th>
                    <th>Stage</th>
                    <th className="text-right">Days Stuck</th>
                    <th>Recruiter</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {ghostCandidates.slice(0, 50).map(ghost => (
                    <tr key={ghost.candidateId}>
                      <td className="font-medium">{ghost.candidateName || ghost.candidateId}</td>
                      <td>
                        <div className="truncate" style={{ maxWidth: 200 }} title={ghost.reqTitle}>
                          {ghost.reqTitle}
                        </div>
                        <span className="text-sm text-muted-foreground">{ghost.reqId}</span>
                      </td>
                      <td>{ghost.currentStage}</td>
                      <td className="text-right">
                        <span
                          style={{
                            color: ghost.daysInCurrentStage >= 30 ? '#f87171' : '#fbbf24',
                            fontFamily: "'JetBrains Mono', monospace"
                          }}
                        >
                          {ghost.daysInCurrentStage}d
                        </span>
                      </td>
                      <td className="text-muted-foreground">{ghost.recruiterName}</td>
                      <td>
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                          style={{
                            background: ghost.status === 'ABANDONED' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                            color: ghost.status === 'ABANDONED' ? '#f87171' : '#fbbf24'
                          }}
                        >
                          {ghost.status === 'ABANDONED' ? 'Abandoned' : 'Stagnant'}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {ghostCandidates.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center text-muted-foreground py-4">
                        No ghost candidates found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Requisition Health Table */}
      <div className="card-bespoke">
        <div className="card-header flex justify-between items-center">
          <h6 className="mb-0">
            Requisition Health Status
            <span className="badge-bespoke badge-neutral-soft ml-2">
              {displayAssessments.length} reqs
            </span>
          </h6>
          <div className="text-sm text-muted-foreground">
            Toggle "Exclude" to remove from TTF calculations
          </div>
        </div>
        <div className="card-body p-0">
          <div className="overflow-x-auto">
            <table className="table table-bespoke mb-0">
              <thead>
                <tr>
                  <th style={{ width: 80 }}>Status</th>
                  <th>Requisition</th>
                  <th>Recruiter</th>
                  <th>HM</th>
                  <th className="text-right">Days Open</th>
                  <th className="text-right">Last Activity</th>
                  <th className="text-right">Candidates</th>
                  <th className="text-center">Exclude</th>
                </tr>
              </thead>
              <tbody>
                {displayAssessments.slice(0, 100).map(assessment => {
                  const req = reqMap.get(assessment.reqId);
                  if (!req) return null;
                  const recruiter = userMap.get(req.recruiter_id);
                  const hm = userMap.get(req.hiring_manager_id);
                  const colors = STATUS_COLORS[assessment.status];
                  const isExcluded = excludedReqIds.has(assessment.reqId);

                  return (
                    <tr
                      key={assessment.reqId}
                      style={{ opacity: isExcluded ? 0.5 : 1 }}
                    >
                      <td>
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                          style={{
                            background: colors.bg,
                            color: colors.text,
                            border: `1px solid ${colors.border}`
                          }}
                        >
                          {STATUS_LABELS[assessment.status]}
                        </span>
                      </td>
                      <td>
                        <div className="font-medium truncate" style={{ maxWidth: 250 }} title={req.req_title}>
                          {req.req_title}
                        </div>
                        <span className="text-sm text-muted-foreground">{req.req_id}</span>
                      </td>
                      <td className="text-muted-foreground">{recruiter?.name || req.recruiter_id}</td>
                      <td className="text-muted-foreground">{hm?.name || req.hiring_manager_id}</td>
                      <td className="text-right" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                        {assessment.daysOpen}d
                      </td>
                      <td className="text-right">
                        {assessment.daysSinceLastActivity !== null ? (
                          <span
                            style={{
                              color: assessment.daysSinceLastActivity >= 30 ? '#f87171' :
                                assessment.daysSinceLastActivity >= 14 ? '#fbbf24' : '#94A3B8',
                              fontFamily: "'JetBrains Mono', monospace"
                            }}
                          >
                            {assessment.daysSinceLastActivity}d ago
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="text-right" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                        {assessment.activeCandidateCount}
                      </td>
                      <td className="text-center">
                        <input
                          type="checkbox"
                          className="w-4 h-4 cursor-pointer"
                          checked={isExcluded}
                          onChange={() => onToggleExclusion(assessment.reqId)}
                          title={isExcluded ? 'Include in metrics' : 'Exclude from metrics'}
                        />
                      </td>
                    </tr>
                  );
                })}
                {displayAssessments.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center text-muted-foreground py-5">
                      No requisitions match the current filter
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        {displayAssessments.length > 100 && (
          <div className="card-footer text-muted-foreground text-center text-sm">
            Showing first 100 of {displayAssessments.length} requisitions
          </div>
        )}
      </div>

      {/* Interpretation Guide */}
      <div className="card-bespoke mt-4">
        <div className="card-header">
          <h6 className="mb-0" style={{ fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94A3B8' }}>
            Understanding Data Hygiene
          </h6>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-12 gap-3">
            <div className="col-span-12 md:col-span-3">
              <div className="p-3 h-full" style={{ background: '#141414', borderRadius: '2px', borderTop: '2px solid #ef4444' }}>
                <h6 className="text-sm font-semibold mb-2" style={{ color: '#f87171' }}>Zombie Reqs</h6>
                <p className="text-xs text-muted-foreground mb-0" style={{ lineHeight: 1.5 }}>
                  No candidate activity in 30+ days. These inflate your TTF and should be excluded or closed.
                </p>
              </div>
            </div>
            <div className="col-span-12 md:col-span-3">
              <div className="p-3 h-full" style={{ background: '#141414', borderRadius: '2px', borderTop: '2px solid #f59e0b' }}>
                <h6 className="text-sm font-semibold mb-2" style={{ color: '#fbbf24' }}>Stalled Reqs</h6>
                <p className="text-xs text-muted-foreground mb-0" style={{ lineHeight: 1.5 }}>
                  No activity in 14-30 days. May need recruiter attention or HM follow-up to get moving again.
                </p>
              </div>
            </div>
            <div className="col-span-12 md:col-span-3">
              <div className="p-3 h-full" style={{ background: '#141414', borderRadius: '2px', borderTop: '2px solid #a855f7' }}>
                <h6 className="text-sm font-semibold mb-2" style={{ color: '#c084fc' }}>At Risk Reqs</h6>
                <p className="text-xs text-muted-foreground mb-0" style={{ lineHeight: 1.5 }}>
                  Open 120+ days with fewer than 5 candidates. May have unrealistic requirements or poor sourcing.
                </p>
              </div>
            </div>
            <div className="col-span-12 md:col-span-3">
              <div className="p-3 h-full" style={{ background: '#141414', borderRadius: '2px', borderTop: '2px solid #2dd4bf' }}>
                <h6 className="text-sm font-semibold mb-2" style={{ color: '#34d399' }}>True TTF</h6>
                <p className="text-xs text-muted-foreground mb-0" style={{ lineHeight: 1.5 }}>
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
