// Coverage Metrics Service
// Computes data coverage metrics for capability gating
// See docs/plans/RESILIENT_IMPORT_AND_GUIDANCE_V1.md

import { CoverageMetrics } from '../types/resilientImportTypes';
import { Requisition, Candidate, Event, User } from '../types/entities';

// Coverage threshold for flags (50% = 0.5)
const COVERAGE_THRESHOLD = 0.5;

/**
 * Compute coverage metrics from imported data.
 * Used for capability gating - determines which features are available.
 */
export function computeCoverageMetrics(
  requisitions: Requisition[],
  candidates: Candidate[],
  events: Event[],
  users: User[],
  snapshotCount: number = 1
): CoverageMetrics {
  const importId = `import_${Date.now().toString(36)}`;
  
  // Helper to compute coverage percentage
  const coverage = (items: any[], predicate: (item: any) => boolean): number => {
    if (items.length === 0) return 0;
    const count = items.filter(predicate).length;
    return count / items.length;
  };

  // Requisition field coverage
  const reqRecruiterCoverage = coverage(requisitions, r => !!r.recruiter_id);
  const reqHMCoverage = coverage(requisitions, r => !!r.hiring_manager_id);
  const reqOpenedAtCoverage = coverage(requisitions, r => !!r.opened_at);
  const reqClosedAtCoverage = coverage(requisitions, r => !!r.closed_at);
  const reqStatusCoverage = coverage(requisitions, r => !!r.status);

  // Candidate field coverage
  const candAppliedAtCoverage = coverage(candidates, c => !!c.applied_at);
  const candCurrentStageCoverage = coverage(candidates, c => !!c.current_stage);
  const candHiredAtCoverage = coverage(candidates, c => !!c.hired_at);
  const candRejectedAtCoverage = coverage(candidates, c => 
    c.disposition === 'rejected' || c.disposition === 'withdrawn'
  );
  const candSourceCoverage = coverage(candidates, c => !!c.source);
  const candNameCoverage = coverage(candidates, c => !!c.name);

  // Event field coverage
  const eventFromStageCoverage = coverage(events, e => !!e.from_stage);
  const eventToStageCoverage = coverage(events, e => !!e.to_stage);
  const eventActorCoverage = coverage(events, e => !!e.actor_user_id);
  const eventAtCoverage = coverage(events, e => !!e.event_at);

  // Sample sizes
  const hires = candidates.filter(c => !!c.hired_at).length;
  const offers = candidates.filter(c => !!c.offer_extended_at).length;
  const rejections = candidates.filter(c => 
    c.disposition === 'rejected' || c.disposition === 'withdrawn'
  ).length;
  const activeReqs = requisitions.filter(r => r.status === 'open').length;

  // Derived flags based on thresholds
  const hasStageEvents = events.length > 0 && eventToStageCoverage >= COVERAGE_THRESHOLD;
  const hasTimestamps = candAppliedAtCoverage >= COVERAGE_THRESHOLD || eventAtCoverage >= COVERAGE_THRESHOLD;
  const hasTerminalTimestamps = candHiredAtCoverage >= COVERAGE_THRESHOLD || candRejectedAtCoverage >= COVERAGE_THRESHOLD;
  const hasRecruiterAssignment = reqRecruiterCoverage >= COVERAGE_THRESHOLD;
  const hasHMAssignment = reqHMCoverage >= COVERAGE_THRESHOLD;
  const hasSourceData = candSourceCoverage >= COVERAGE_THRESHOLD;
  const hasMultipleSnapshots = snapshotCount > 1;

  return {
    importId,
    computedAt: new Date(),
    
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
      'req.opened_at': reqOpenedAtCoverage,
      'req.closed_at': reqClosedAtCoverage,
      'req.status': reqStatusCoverage,
      
      'cand.applied_at': candAppliedAtCoverage,
      'cand.current_stage': candCurrentStageCoverage,
      'cand.hired_at': candHiredAtCoverage,
      'cand.rejected_at': candRejectedAtCoverage,
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
 * Create empty coverage metrics for initial state or when no data exists.
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
