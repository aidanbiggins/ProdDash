// Coverage Metrics Service
// Computes coverage metrics from imported data
// See docs/plans/RESILIENT_IMPORT_AND_GUIDANCE_V1.md

import { Requisition, Candidate, Event, User, CanonicalStage, CandidateDisposition, RequisitionStatus } from '../types/entities';
import { CoverageMetrics } from '../types/resilientImportTypes';

/**
 * Compute coverage metrics from imported data
 */
export function computeCoverageMetrics(
  requisitions: Requisition[],
  candidates: Candidate[],
  events: Event[],
  users: User[],
  snapshotCount: number = 1
): CoverageMetrics {
  const importId = `coverage_${Date.now().toString(36)}`;
  const now = new Date();

  // Count field coverage for requisitions
  const reqRecruiterCoverage = countNonNull(requisitions, r => r.recruiter_id);
  const reqHMCoverage = countNonNull(requisitions, r => r.hiring_manager_id);
  const reqOpenedCoverage = countNonNull(requisitions, r => r.opened_at);
  const reqClosedCoverage = countNonNull(requisitions, r => r.closed_at);
  const reqStatusCoverage = countNonNull(requisitions, r => r.status);

  // Count field coverage for candidates
  const candAppliedCoverage = countNonNull(candidates, c => c.applied_at);
  const candStageCoverage = countNonNull(candidates, c => c.current_stage);
  const candHiredCoverage = countNonNull(candidates, c => c.hired_at);
  // rejected_at is derived from disposition, not a direct field on Candidate
  const candRejectedCoverage = candidates.length > 0
    ? candidates.filter(c => c.disposition === CandidateDisposition.Rejected).length / candidates.length
    : 0;
  const candSourceCoverage = countNonNull(candidates, c => c.source);
  const candNameCoverage = countNonNull(candidates, c => c.name);

  // Count field coverage for events
  const eventFromStageCoverage = countNonNull(events, e => e.from_stage);
  const eventToStageCoverage = countNonNull(events, e => e.to_stage);
  const eventActorCoverage = countNonNull(events, e => e.actor_user_id);
  const eventAtCoverage = countNonNull(events, e => e.event_at);

  // Compute sample sizes
  const hires = candidates.filter(c =>
    c.current_stage === CanonicalStage.HIRED ||
    c.hired_at != null
  ).length;

  const offers = candidates.filter(c =>
    c.current_stage === CanonicalStage.OFFER ||
    c.current_stage === CanonicalStage.HIRED
  ).length;

  const rejections = candidates.filter(c =>
    c.current_stage === CanonicalStage.REJECTED ||
    c.disposition === CandidateDisposition.Rejected
  ).length;

  const activeReqs = requisitions.filter(r =>
    r.status === RequisitionStatus.Open || !r.closed_at
  ).length;

  // Compute derived flags
  const hasStageEvents = events.length > 0 && eventFromStageCoverage > 0.5;
  const hasTimestamps = candAppliedCoverage > 0.5;
  const hasTerminalTimestamps = candHiredCoverage > 0.1 || candRejectedCoverage > 0.1;
  const hasRecruiterAssignment = reqRecruiterCoverage > 0.5;
  const hasHMAssignment = reqHMCoverage > 0.5;
  const hasSourceData = candSourceCoverage > 0.3;
  const hasMultipleSnapshots = snapshotCount >= 2;

  return {
    importId,
    computedAt: now,

    counts: {
      requisitions: requisitions.length,
      candidates: candidates.length,
      events: events.length,
      users: users.length,
      snapshots: snapshotCount,
    },

    fieldCoverage: {
      'req.recruiter_id': reqRecruiterCoverage,
      'req.hiring_manager_id': reqHMCoverage,
      'req.opened_at': reqOpenedCoverage,
      'req.closed_at': reqClosedCoverage,
      'req.status': reqStatusCoverage,

      'cand.applied_at': candAppliedCoverage,
      'cand.current_stage': candStageCoverage,
      'cand.hired_at': candHiredCoverage,
      'cand.rejected_at': candRejectedCoverage,
      'cand.source': candSourceCoverage,
      'cand.name': candNameCoverage,

      'event.from_stage': eventFromStageCoverage,
      'event.to_stage': eventToStageCoverage,
      'event.actor_user_id': eventActorCoverage,
      'event.event_at': eventAtCoverage,
    },

    flags: {
      hasStageEvents,
      hasTimestamps,
      hasTerminalTimestamps,
      hasRecruiterAssignment,
      hasHMAssignment,
      hasSourceData,
      hasMultipleSnapshots,
    },

    sampleSizes: {
      hires,
      offers,
      rejections,
      activeReqs,
    },
  };
}

/**
 * Count non-null values and return coverage ratio
 */
function countNonNull<T>(items: T[], accessor: (item: T) => unknown): number {
  if (items.length === 0) return 0;
  const nonNullCount = items.filter(item => {
    const value = accessor(item);
    return value !== null && value !== undefined && value !== '';
  }).length;
  return nonNullCount / items.length;
}

/**
 * Create empty coverage metrics (for initial state)
 */
export function createEmptyCoverageMetrics(): CoverageMetrics {
  return {
    importId: 'empty',
    computedAt: new Date(),

    counts: {
      requisitions: 0,
      candidates: 0,
      events: 0,
      users: 0,
      snapshots: 0,
    },

    fieldCoverage: {
      'req.recruiter_id': 0,
      'req.hiring_manager_id': 0,
      'req.opened_at': 0,
      'req.closed_at': 0,
      'req.status': 0,
      'cand.applied_at': 0,
      'cand.current_stage': 0,
      'cand.hired_at': 0,
      'cand.rejected_at': 0,
      'cand.source': 0,
      'cand.name': 0,
      'event.from_stage': 0,
      'event.to_stage': 0,
      'event.actor_user_id': 0,
      'event.event_at': 0,
    },

    flags: {
      hasStageEvents: false,
      hasTimestamps: false,
      hasTerminalTimestamps: false,
      hasRecruiterAssignment: false,
      hasHMAssignment: false,
      hasSourceData: false,
      hasMultipleSnapshots: false,
    },

    sampleSizes: {
      hires: 0,
      offers: 0,
      rejections: 0,
      activeReqs: 0,
    },
  };
}

/**
 * Get a human-readable summary of coverage
 */
export function getCoverageSummary(coverage: CoverageMetrics): string {
  const parts: string[] = [];

  parts.push(`${coverage.counts.requisitions} requisitions`);
  parts.push(`${coverage.counts.candidates} candidates`);

  if (coverage.counts.events > 0) {
    parts.push(`${coverage.counts.events} events`);
  }

  const enabledFlags = Object.entries(coverage.flags)
    .filter(([_, v]) => v)
    .map(([k]) => k);

  if (enabledFlags.length > 0) {
    parts.push(`Capabilities: ${enabledFlags.length}`);
  }

  return parts.join(' | ');
}

/**
 * Get coverage percentage for display
 */
export function getCoveragePercentage(coverage: CoverageMetrics): number {
  const fieldValues = Object.values(coverage.fieldCoverage);
  const avgCoverage = fieldValues.reduce((sum, v) => sum + v, 0) / fieldValues.length;
  return Math.round(avgCoverage * 100);
}

/**
 * Get low coverage fields (< 50%)
 */
export function getLowCoverageFields(
  coverage: CoverageMetrics
): Array<{ field: string; coverage: number }> {
  return Object.entries(coverage.fieldCoverage)
    .filter(([_, v]) => v < 0.5 && v > 0)
    .map(([field, value]) => ({
      field,
      coverage: Math.round(value * 100),
    }))
    .sort((a, b) => a.coverage - b.coverage);
}

/**
 * Get missing fields (0% coverage)
 */
export function getMissingFields(coverage: CoverageMetrics): string[] {
  return Object.entries(coverage.fieldCoverage)
    .filter(([_, v]) => v === 0)
    .map(([field]) => field);
}
