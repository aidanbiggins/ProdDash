// Req Health Service - Identifies Stalled, Zombie, and At-Risk requisitions
// Part of the Data Hygiene Engine

import { differenceInDays } from 'date-fns';
import {
  Requisition,
  Candidate,
  Event,
  User,
  RequisitionStatus,
  CandidateDisposition
} from '../types/entities';
import {
  ReqHealthStatus,
  ReqHealthAssessment,
  GhostCandidateStatus,
  GhostCandidateAssessment,
  DataHygieneSummary,
  DataHygieneExclusions,
  DEFAULT_HYGIENE_SETTINGS
} from '../types/dataHygieneTypes';

// ===== REQ HEALTH ASSESSMENT =====

/**
 * Determines the health status of a requisition based on activity patterns.
 *
 * Logic:
 * - ZOMBIE: No candidate status change in 30+ days (Red)
 * - STALLED: No candidate status change in 14-30 days (Yellow)
 * - AT_RISK: Open 120+ days with fewer than 5 candidates
 * - ACTIVE: Normal, healthy req
 */
export function assessReqHealth(
  req: Requisition,
  candidates: Candidate[],
  events: Event[],
  settings: DataHygieneExclusions = DEFAULT_HYGIENE_SETTINGS,
  referenceDate: Date = new Date()
): ReqHealthAssessment {
  const reasons: string[] = [];

  // Only assess open reqs
  if (req.status !== RequisitionStatus.Open) {
    return {
      reqId: req.req_id,
      status: ReqHealthStatus.ACTIVE,
      daysSinceLastActivity: null,
      daysOpen: req.opened_at ? differenceInDays(req.closed_at || referenceDate, req.opened_at) : null,
      activeCandidateCount: 0,
      lastActivityDate: req.closed_at,
      reasons: ['Req is closed'],
      excludedFromMetrics: false
    };
  }

  // Get candidates for this req
  const reqCandidates = candidates.filter(c => c.req_id === req.req_id);
  const activeCandidates = reqCandidates.filter(
    c => c.disposition === CandidateDisposition.Active
  );

  // Get events for this req (stage changes indicate activity)
  const reqEvents = events.filter(e => e.req_id === req.req_id);

  // Find the most recent activity date
  // Activity = candidate stage change, new candidate added, or any event
  const candidateDates = reqCandidates.map(c => c.current_stage_entered_at);
  const eventDates = reqEvents.map(e => e.event_at);
  const allDates = [...candidateDates, ...eventDates].filter(d => d != null) as Date[];

  const lastActivityDate = allDates.length > 0
    ? new Date(Math.max(...allDates.map(d => d.getTime())))
    : null;

  const daysSinceLastActivity = lastActivityDate
    ? differenceInDays(referenceDate, lastActivityDate)
    : null;

  const daysOpen = req.opened_at ? differenceInDays(referenceDate, req.opened_at) : null;

  // Determine health status
  let status = ReqHealthStatus.ACTIVE;

  // Check for Zombie (30+ days no activity)
  if (daysSinceLastActivity !== null && daysSinceLastActivity >= settings.zombieThresholdDays) {
    status = ReqHealthStatus.ZOMBIE;
    reasons.push(`No activity for ${daysSinceLastActivity} days (threshold: ${settings.zombieThresholdDays})`);
  }
  // Check for Stalled (14-30 days no activity)
  else if (daysSinceLastActivity !== null && daysSinceLastActivity >= settings.stalledThresholdDays) {
    status = ReqHealthStatus.STALLED;
    reasons.push(`No activity for ${daysSinceLastActivity} days (threshold: ${settings.stalledThresholdDays})`);
  }

  // Check for At Risk (120+ days open with <5 candidates) - can stack with Stalled
  if (daysOpen !== null && daysOpen >= settings.atRiskDaysOpen && reqCandidates.length < settings.atRiskMinCandidates) {
    // At Risk takes precedence over Active, but Zombie trumps all
    if (status === ReqHealthStatus.ACTIVE || status === ReqHealthStatus.STALLED) {
      status = ReqHealthStatus.AT_RISK;
    }
    reasons.push(`Open ${daysOpen} days with only ${reqCandidates.length} candidates (threshold: ${settings.atRiskDaysOpen} days, ${settings.atRiskMinCandidates} candidates)`);
  }

  // Check if manually excluded
  const excludedFromMetrics = settings.excludedReqIds.has(req.req_id) ||
    (settings.excludeZombiesFromTTF && status === ReqHealthStatus.ZOMBIE) ||
    (settings.excludeStalledFromTTF && status === ReqHealthStatus.STALLED);

  return {
    reqId: req.req_id,
    status,
    daysSinceLastActivity,
    daysOpen,
    activeCandidateCount: activeCandidates.length,
    lastActivityDate,
    reasons,
    excludedFromMetrics
  };
}

/**
 * Assess health of all requisitions
 */
export function assessAllReqHealth(
  requisitions: Requisition[],
  candidates: Candidate[],
  events: Event[],
  settings: DataHygieneExclusions = DEFAULT_HYGIENE_SETTINGS,
  referenceDate: Date = new Date()
): ReqHealthAssessment[] {
  return requisitions.map(req =>
    assessReqHealth(req, candidates, events, settings, referenceDate)
  );
}

// ===== GHOST CANDIDATE DETECTION =====

/**
 * Identifies candidates stuck in a status without action.
 *
 * Logic:
 * - ABANDONED: Stuck 30+ days without action
 * - STAGNANT: Stuck 10+ days without action
 * - ACTIVE: Normal progression
 */
export function detectGhostCandidates(
  candidates: Candidate[],
  requisitions: Requisition[],
  events: Event[],
  users: User[],
  settings: DataHygieneExclusions = DEFAULT_HYGIENE_SETTINGS,
  referenceDate: Date = new Date()
): GhostCandidateAssessment[] {
  const reqMap = new Map(requisitions.map(r => [r.req_id, r]));
  const userMap = new Map(users.map(u => [u.user_id, u]));

  return candidates
    .filter(c => c.disposition === CandidateDisposition.Active)
    .map(c => {
      const req = reqMap.get(c.req_id);
      const candidateEvents = events.filter(e => e.candidate_id === c.candidate_id);

      // Find the last action date (stage change or any event)
      const eventDates = candidateEvents.map(e => e.event_at);
      const stageDates = [c.current_stage_entered_at];
      const allDates = [...eventDates, ...stageDates].filter(d => d != null) as Date[];

      const lastActionDate = allDates.length > 0
        ? new Date(Math.max(...allDates.map(d => d.getTime())))
        : c.current_stage_entered_at;

      const daysInCurrentStage = c.current_stage_entered_at
        ? differenceInDays(referenceDate, c.current_stage_entered_at)
        : 0;

      // Determine ghost status
      let status = GhostCandidateStatus.ACTIVE;
      if (c.current_stage_entered_at && daysInCurrentStage >= 30) {
        status = GhostCandidateStatus.ABANDONED;
      } else if (c.current_stage_entered_at && daysInCurrentStage >= settings.ghostThresholdDays) {
        status = GhostCandidateStatus.STAGNANT;
      }

      // Get names
      const recruiter = req ? userMap.get(req.recruiter_id) : null;
      const hm = req ? userMap.get(req.hiring_manager_id) : null;

      return {
        candidateId: c.candidate_id,
        candidateName: c.name,
        reqId: c.req_id,
        reqTitle: req?.req_title || 'Unknown',
        currentStage: c.current_stage,
        status,
        daysInCurrentStage,
        lastActionDate,
        recruiterName: recruiter?.name || 'Unknown',
        hiringManagerName: hm?.name || 'Unknown'
      };
    })
    .filter(assessment =>
      assessment.status !== GhostCandidateStatus.ACTIVE
    );
}

// ===== DATA HYGIENE SUMMARY =====

/**
 * Generates a comprehensive data hygiene summary.
 */
export function calculateDataHygieneSummary(
  requisitions: Requisition[],
  candidates: Candidate[],
  events: Event[],
  users: User[],
  settings: DataHygieneExclusions = DEFAULT_HYGIENE_SETTINGS
): DataHygieneSummary {
  const reqAssessments = assessAllReqHealth(requisitions, candidates, events, settings);
  const ghostCandidates = detectGhostCandidates(candidates, requisitions, events, users, settings);

  // Count by status (non-closed/canceled reqs)
  // Include any req that isn't explicitly closed or canceled
  // This handles various status values from different ATS systems
  const closedStatuses = [RequisitionStatus.Closed, RequisitionStatus.Canceled, 'Closed', 'Canceled', 'Filled', 'Cancelled'];
  const openReqAssessments = reqAssessments.filter(a => {
    const req = requisitions.find(r => r.req_id === a.reqId);
    return req && !closedStatuses.includes(req.status as any);
  });

  // Fallback: if no reqs match our "active" filter, use all reqs
  const effectiveReqAssessments = openReqAssessments.length > 0 ? openReqAssessments : reqAssessments;

  const activeReqCount = openReqAssessments.filter(a => a.status === ReqHealthStatus.ACTIVE).length;
  const stalledReqCount = openReqAssessments.filter(a => a.status === ReqHealthStatus.STALLED).length;
  const zombieReqCount = openReqAssessments.filter(a => a.status === ReqHealthStatus.ZOMBIE).length;
  const atRiskReqCount = openReqAssessments.filter(a => a.status === ReqHealthStatus.AT_RISK).length;

  // Count ghost candidates
  const stagnantCandidateCount = ghostCandidates.filter(
    g => g.status === GhostCandidateStatus.STAGNANT
  ).length;
  const abandonedCandidateCount = ghostCandidates.filter(
    g => g.status === GhostCandidateStatus.ABANDONED
  ).length;

  // Calculate TTF comparison
  const { rawMedianTTF, trueMedianTTF } = calculateTTFComparison(
    requisitions,
    candidates,
    reqAssessments,
    settings
  );

  const ttfDifferencePercent = (rawMedianTTF !== null && trueMedianTTF !== null && rawMedianTTF > 0)
    ? ((rawMedianTTF - trueMedianTTF) / rawMedianTTF) * 100
    : null;

  // Calculate hygiene score (0-100)
  // If no data, show 0 (not 100) to indicate we can't calculate
  const totalOpenReqs = effectiveReqAssessments.length;
  const effectiveActiveCount = effectiveReqAssessments.filter(a => a.status === ReqHealthStatus.ACTIVE).length;
  const healthyReqRatio = totalOpenReqs > 0 ? effectiveActiveCount / totalOpenReqs : 0;

  const totalActiveCandidates = candidates.filter(c => c.disposition === CandidateDisposition.Active).length;
  const healthyCandidateRatio = totalActiveCandidates > 0
    ? Math.max(0, (totalActiveCandidates - stagnantCandidateCount - abandonedCandidateCount) / totalActiveCandidates)
    : (candidates.length > 0 ? 0.5 : 0); // If no active candidates but some exist, assume 50%

  // If we have no data at all, score is 0 (insufficient data)
  const hasData = requisitions.length > 0 || candidates.length > 0;
  const hygieneScore = hasData
    ? Math.round((healthyReqRatio * 0.6 + healthyCandidateRatio * 0.4) * 100)
    : 0;

  return {
    activeReqCount,
    stalledReqCount,
    zombieReqCount,
    atRiskReqCount,
    stagnantCandidateCount,
    abandonedCandidateCount,
    rawMedianTTF,
    trueMedianTTF,
    ttfDifferencePercent,
    hygieneScore
  };
}

// ===== TTF CALCULATION =====

/**
 * Helper to calculate median value
 */
function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Calculates Raw TTF (all reqs) vs True TTF (excluding zombies)
 */
export function calculateTTFComparison(
  requisitions: Requisition[],
  candidates: Candidate[],
  reqAssessments: ReqHealthAssessment[],
  settings: DataHygieneExclusions = DEFAULT_HYGIENE_SETTINGS
): { rawMedianTTF: number | null; trueMedianTTF: number | null } {
  // Get closed reqs with hires (must have opened_at for TTF calculation)
  const closedReqs = requisitions.filter(r =>
    r.status === RequisitionStatus.Closed && r.closed_at && r.opened_at
  );

  // Calculate TTF for each closed req
  const ttfValues = closedReqs.map(req => {
    const reqCandidates = candidates.filter(
      c => c.req_id === req.req_id && c.disposition === CandidateDisposition.Hired && c.hired_at
    );
    if (reqCandidates.length === 0) return null;

    // Use the first hire date
    const hireDate = reqCandidates
      .map(c => c.hired_at!)
      .sort((a, b) => a.getTime() - b.getTime())[0];

    return differenceInDays(hireDate, req.opened_at!); // opened_at guaranteed by filter above
  }).filter((v): v is number => v !== null && v >= 0);

  const rawMedianTTF = median(ttfValues);

  // Calculate True TTF (excluding zombie reqs from the assessment)
  const zombieReqIds = new Set(
    reqAssessments
      .filter(a => a.status === ReqHealthStatus.ZOMBIE || settings.excludedReqIds.has(a.reqId))
      .map(a => a.reqId)
  );

  const trueTTFValues = closedReqs
    .filter(req => !zombieReqIds.has(req.req_id))
    .map(req => {
      const reqCandidates = candidates.filter(
        c => c.req_id === req.req_id && c.disposition === CandidateDisposition.Hired && c.hired_at
      );
      if (reqCandidates.length === 0) return null;

      const hireDate = reqCandidates
        .map(c => c.hired_at!)
        .sort((a, b) => a.getTime() - b.getTime())[0];

      return differenceInDays(hireDate, req.opened_at!); // opened_at guaranteed by closedReqs filter
    })
    .filter((v): v is number => v !== null && v >= 0);

  const trueMedianTTF = median(trueTTFValues);

  return { rawMedianTTF, trueMedianTTF };
}

/**
 * Get list of active (non-zombie) req IDs for metric calculations
 */
export function getActiveReqIds(
  requisitions: Requisition[],
  candidates: Candidate[],
  events: Event[],
  settings: DataHygieneExclusions = DEFAULT_HYGIENE_SETTINGS
): Set<string> {
  const assessments = assessAllReqHealth(requisitions, candidates, events, settings);

  return new Set(
    assessments
      .filter(a => !a.excludedFromMetrics)
      .map(a => a.reqId)
  );
}
