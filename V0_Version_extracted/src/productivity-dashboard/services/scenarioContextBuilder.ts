/**
 * Scenario Context Builder
 *
 * Transforms dashboard state into the ScenarioContext required by the scenario engine.
 */

import { DashboardState, DataStore } from '../types';
import {
  ScenarioContext,
  RequisitionForScenario,
  CandidateForScenario,
  EventForScenario,
  RecruiterForScenario,
  HiringManagerForScenario,
  CapacityAnalysisForScenario,
  FitMatrixForScenario,
  BenchmarksForScenario,
} from '../types/scenarioTypes';

/**
 * Build a ScenarioContext from the current dashboard state
 */
export function buildScenarioContext(state: DashboardState): ScenarioContext {
  const dataStore = state.dataStore;
  const requisitions = buildRequisitions(dataStore);
  const candidates = buildCandidates(dataStore);
  const events = buildEvents(dataStore);
  const recruiters = buildRecruiters(dataStore, requisitions);
  const hiringManagers = buildHiringManagers(dataStore, requisitions);
  const capacityAnalysis = buildCapacityAnalysis(recruiters);
  const fitMatrix = buildFitMatrix(recruiters, requisitions);
  const benchmarks = buildBenchmarks(requisitions, candidates);

  return {
    org_id: 'default',
    dataset_id: 'default',
    requisitions,
    candidates,
    events,
    recruiters,
    hiringManagers,
    capacityAnalysis,
    fitMatrix,
    benchmarks,
  };
}

/**
 * Build requisitions for scenario
 */
function buildRequisitions(dataStore: DataStore): RequisitionForScenario[] {
  return dataStore.requisitions.map(req => ({
    req_id: req.req_id,
    title: req.req_title || 'Untitled Requisition',
    status: req.status,
    recruiter_id: req.recruiter_id || null,
    hiring_manager_id: req.hiring_manager_id || null,
    job_family: req.job_family || null,
    level: req.level || null,
    location_type: req.location_type || null,
    opened_at: req.opened_at ? new Date(req.opened_at) : null,
    closed_at: req.closed_at ? new Date(req.closed_at) : null,
  }));
}

/**
 * Build candidates for scenario
 */
function buildCandidates(dataStore: DataStore): CandidateForScenario[] {
  return dataStore.candidates.map(cand => ({
    candidate_id: cand.candidate_id,
    req_id: cand.req_id,
    current_stage: cand.current_stage,
    current_stage_entered_at: cand.current_stage_entered_at
      ? new Date(cand.current_stage_entered_at)
      : null,
    applied_at: cand.applied_at ? new Date(cand.applied_at) : null,
  }));
}

/**
 * Build events for scenario
 */
function buildEvents(dataStore: DataStore): EventForScenario[] {
  return dataStore.events
    .filter(event => event.to_stage !== null)
    .map(event => ({
      event_id: event.event_id,
      candidate_id: event.candidate_id,
      from_stage: event.from_stage || null,
      to_stage: event.to_stage!,
      timestamp: new Date(event.event_at),
    }));
}

/**
 * Check if a requisition is open using flexible status detection
 */
function isOpenReq(req: RequisitionForScenario): boolean {
  if (req.status === 'Open' || req.status === 'OPEN') return true;
  const statusLower = req.status?.toLowerCase() || '';
  if (statusLower.includes('open') || statusLower === 'active') return true;
  if (req.status !== 'Closed' && req.status !== 'CLOSED' && !req.closed_at) return true;
  return false;
}

/**
 * Build recruiters for scenario with capacity metrics
 */
function buildRecruiters(
  dataStore: DataStore,
  requisitions: RequisitionForScenario[]
): RecruiterForScenario[] {
  // Get unique recruiter IDs from requisitions
  const recruiterIds = new Set<string>();
  requisitions.forEach(req => {
    if (req.recruiter_id) recruiterIds.add(req.recruiter_id);
  });

  // Calculate metrics for each recruiter
  return Array.from(recruiterIds).map(recruiterId => {
    const recruiterReqs = requisitions.filter(
      r => r.recruiter_id === recruiterId && isOpenReq(r)
    );

    // Workload: 10 WU per open req (simplified model)
    const demand_wu = recruiterReqs.length * 10;

    // Capacity: assume 100 WU standard (could be enhanced with actual data)
    const capacity_wu = 100;

    const utilization = capacity_wu > 0 ? demand_wu / capacity_wu : 0;

    return {
      recruiter_id: recruiterId,
      name: `Recruiter ${recruiterId}`, // Anonymized
      capacity_wu,
      demand_wu,
      utilization,
    };
  });
}

/**
 * Build hiring managers for scenario
 */
function buildHiringManagers(
  dataStore: DataStore,
  requisitions: RequisitionForScenario[]
): HiringManagerForScenario[] {
  // Get unique HM IDs from requisitions
  const hmIds = new Set<string>();
  requisitions.forEach(req => {
    if (req.hiring_manager_id) hmIds.add(req.hiring_manager_id);
  });

  // Calculate average feedback days (simplified - would need event data)
  return Array.from(hmIds).map((hmId, idx) => ({
    hm_id: hmId,
    name: `Manager ${idx + 1}`, // Anonymized
    avg_feedback_days: 2 + Math.random() * 3, // Placeholder - would calculate from events
  }));
}

/**
 * Build capacity analysis for scenario
 */
function buildCapacityAnalysis(
  recruiters: RecruiterForScenario[]
): CapacityAnalysisForScenario | null {
  if (recruiters.length === 0) return null;

  const team_capacity = recruiters.reduce((sum, r) => sum + r.capacity_wu, 0);
  const team_demand = recruiters.reduce((sum, r) => sum + r.demand_wu, 0);
  const team_utilization = team_capacity > 0 ? team_demand / team_capacity : 0;
  const capacity_gap = team_demand - team_capacity;

  return {
    team_capacity,
    team_demand,
    team_utilization,
    capacity_gap: capacity_gap > 0 ? capacity_gap : 0,
    recruiter_loads: recruiters,
  };
}

/**
 * Build fit matrix for scenario (simplified)
 */
function buildFitMatrix(
  recruiters: RecruiterForScenario[],
  requisitions: RequisitionForScenario[]
): FitMatrixForScenario | null {
  if (recruiters.length === 0 || requisitions.length === 0) return null;

  // Build a simplified fit matrix based on historical assignments
  const scores: Record<string, Record<string, number>> = {};

  recruiters.forEach(recruiter => {
    scores[recruiter.recruiter_id] = {};

    requisitions.forEach(req => {
      // Default neutral fit
      let fitScore = 0.5;

      // Higher fit if recruiter has handled this req type before
      const recruiterReqs = requisitions.filter(
        r => r.recruiter_id === recruiter.recruiter_id && r.status === 'CLOSED'
      );

      const sameFunction = recruiterReqs.filter(
        r => r.job_family === req.job_family
      ).length;
      const sameLevel = recruiterReqs.filter(r => r.level === req.level).length;

      // Boost fit score based on experience
      fitScore += Math.min(0.3, sameFunction * 0.05);
      fitScore += Math.min(0.2, sameLevel * 0.03);

      scores[recruiter.recruiter_id][req.req_id] = Math.min(1, fitScore);
    });
  });

  return { scores };
}

/**
 * Build benchmarks for scenario
 */
function buildBenchmarks(
  requisitions: RequisitionForScenario[],
  candidates: CandidateForScenario[]
): BenchmarksForScenario | null {
  // Calculate median TTF from closed reqs
  const closedReqs = requisitions.filter(
    r => r.status === 'CLOSED' && r.opened_at && r.closed_at
  );

  const ttfDays = closedReqs
    .map(r => {
      const opened = new Date(r.opened_at!).getTime();
      const closed = new Date(r.closed_at!).getTime();
      return Math.round((closed - opened) / (1000 * 60 * 60 * 24));
    })
    .filter(d => d > 0)
    .sort((a, b) => a - b);

  const medianTTF = ttfDays.length > 0
    ? ttfDays[Math.floor(ttfDays.length / 2)]
    : 45; // Default

  // Calculate funnel conversion rates
  const stageCounts: Record<string, number> = {};
  candidates.forEach(c => {
    stageCounts[c.current_stage] = (stageCounts[c.current_stage] || 0) + 1;
  });

  const funnelRates: Record<string, number> = {
    APPLIED: 0.5,
    SCREEN: 0.6,
    HM_SCREEN: 0.7,
    ONSITE: 0.8,
    FINAL: 0.9,
    OFFER: 0.85,
  };

  // Calculate accept rate
  const offers = candidates.filter(c => c.current_stage === 'OFFER').length;
  const hires = candidates.filter(c => c.current_stage === 'HIRED').length;
  const acceptRate = offers > 0 ? hires / (offers + hires) : 0.85;

  // Calculate candidates per hire
  const totalCandidates = candidates.length;
  const totalHires = hires || 1;
  const candidatesPerHire = Math.ceil(totalCandidates / totalHires);

  return {
    median_ttf_days: medianTTF,
    funnel_conversion_rates: funnelRates,
    accept_rate: acceptRate,
    candidates_per_hire: Math.max(5, candidatesPerHire),
  };
}
