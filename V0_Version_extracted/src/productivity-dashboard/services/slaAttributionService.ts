// services/slaAttributionService.ts
// SLA Attribution V1 - Core computation service for SLA tracking and bottleneck analysis

import { SnapshotEvent, DataSnapshot } from '../types/snapshotTypes';
import { Requisition, User } from '../types/entities';
import {
  SlaPolicy,
  SlaOwnerType,
  AttributionConfidence,
  StageDwellMetric,
  StageBottleneck,
  OwnerBreachSummary,
  ReqBreachSummary,
  SnapshotCoverage,
  BottleneckSummary,
  AttributionResult,
  StageDwellPeriod,
  DwellPeriodWithRegressions,
  DEFAULT_SLA_POLICIES,
  STAGE_OWNER_MAP,
  SLA_THRESHOLDS,
  isTerminalStage,
} from '../types/slaTypes';

// ============================================
// COVERAGE GATING
// ============================================

/**
 * Check if snapshot coverage is sufficient for SLA tracking
 */
export function checkCoverageSufficiency(
  snapshots: DataSnapshot[],
  dateRange: { start: Date; end: Date }
): SnapshotCoverage {
  if (snapshots.length === 0) {
    return {
      snapshot_count: 0,
      event_count: 0,
      oldest_snapshot: null,
      newest_snapshot: null,
      day_span: 0,
      avg_gap_days: 0,
      coverage_percent: 0,
      is_sufficient: false,
      insufficiency_reasons: ['No snapshots found in date range'],
    };
  }

  const sorted = [...snapshots].sort(
    (a, b) => a.snapshot_date.getTime() - b.snapshot_date.getTime()
  );

  const oldest = sorted[0].snapshot_date;
  const newest = sorted[sorted.length - 1].snapshot_date;
  const daySpan = Math.ceil(
    (newest.getTime() - oldest.getTime()) / (1000 * 60 * 60 * 24)
  );

  // Calculate average gap
  let totalGap = 0;
  for (let i = 1; i < sorted.length; i++) {
    const gap =
      (sorted[i].snapshot_date.getTime() - sorted[i - 1].snapshot_date.getTime()) /
      (1000 * 60 * 60 * 24);
    totalGap += gap;
  }
  const avgGapDays = sorted.length > 1 ? totalGap / (sorted.length - 1) : 0;

  // Calculate coverage percent (snapshots / day span)
  const coveragePercent = daySpan > 0 ? (snapshots.length / daySpan) * 100 : 0;

  // Total events generated
  const eventCount = snapshots.reduce((sum, s) => sum + (s.events_generated ?? 0), 0);

  // Check sufficiency
  const reasons: string[] = [];

  if (snapshots.length < SLA_THRESHOLDS.MIN_SNAPSHOTS_FOR_DWELL) {
    reasons.push(
      `Need at least ${SLA_THRESHOLDS.MIN_SNAPSHOTS_FOR_DWELL} snapshots, have ${snapshots.length}`
    );
  }

  if (daySpan < SLA_THRESHOLDS.MIN_DAYS_SPAN_FOR_SLA) {
    reasons.push(
      `Need at least ${SLA_THRESHOLDS.MIN_DAYS_SPAN_FOR_SLA} days of data, have ${daySpan}`
    );
  }

  if (avgGapDays > SLA_THRESHOLDS.MAX_SNAPSHOT_GAP_DAYS && sorted.length > 1) {
    reasons.push(
      `Average gap between snapshots is ${avgGapDays.toFixed(1)} days, should be <${SLA_THRESHOLDS.MAX_SNAPSHOT_GAP_DAYS}`
    );
  }

  if (coveragePercent < SLA_THRESHOLDS.MIN_COVERAGE_PERCENT && daySpan > 0) {
    reasons.push(
      `Coverage is ${coveragePercent.toFixed(0)}%, should be >${SLA_THRESHOLDS.MIN_COVERAGE_PERCENT}%`
    );
  }

  return {
    snapshot_count: snapshots.length,
    event_count: eventCount,
    oldest_snapshot: oldest,
    newest_snapshot: newest,
    day_span: daySpan,
    avg_gap_days: avgGapDays,
    coverage_percent: coveragePercent,
    is_sufficient: reasons.length === 0,
    insufficiency_reasons: reasons,
  };
}

// ============================================
// STAGE DWELL PERIOD BUILDING
// ============================================

/**
 * Build stage dwell periods from snapshot events for a single candidate+req
 */
export function buildStageDwellPeriods(
  events: SnapshotEvent[],
  candidateId: string,
  reqId: string
): StageDwellPeriod[] {
  // Filter to relevant events for this candidate+req
  const relevantEvents = events
    .filter(
      (e) =>
        e.candidate_id === candidateId &&
        e.req_id === reqId &&
        (e.event_type === 'STAGE_CHANGE' ||
          e.event_type === 'STAGE_REGRESSION' ||
          e.event_type === 'CANDIDATE_APPEARED')
    )
    .sort((a, b) => a.event_at.getTime() - b.event_at.getTime());

  const periods: StageDwellPeriod[] = [];

  // Find CANDIDATE_APPEARED event for initial stage
  const appearedEvent = relevantEvents.find((e) => e.event_type === 'CANDIDATE_APPEARED');

  // If appeared event exists, first period starts there
  if (appearedEvent && appearedEvent.to_canonical) {
    periods.push({
      stage_key: appearedEvent.to_canonical,
      entered_at: appearedEvent.event_at,
      exited_at: null,
      enter_event_id: appearedEvent.id,
      exit_event_id: null,
    });
  }

  // Process each stage change
  const stageChangeEvents = relevantEvents.filter(
    (e) => e.event_type === 'STAGE_CHANGE' || e.event_type === 'STAGE_REGRESSION'
  );

  for (const event of stageChangeEvents) {
    // Close previous period
    if (periods.length > 0 && periods[periods.length - 1].exited_at === null) {
      periods[periods.length - 1].exited_at = event.event_at;
      periods[periods.length - 1].exit_event_id = event.id;
    }

    // Open new period (if moving to non-terminal stage)
    if (event.to_canonical && !isTerminalStage(event.to_canonical)) {
      periods.push({
        stage_key: event.to_canonical,
        entered_at: event.event_at,
        exited_at: null,
        enter_event_id: event.id,
        exit_event_id: null,
      });
    }
  }

  return periods;
}

/**
 * Detect and handle stage regressions
 */
export function handleRegression(
  events: SnapshotEvent[],
  candidateId: string,
  reqId: string
): DwellPeriodWithRegressions[] {
  const periods = buildStageDwellPeriods(events, candidateId, reqId);

  // Track stage visits to detect re-entries
  const stageVisits: Map<string, number> = new Map();

  return periods.map((period) => {
    const visitCount = (stageVisits.get(period.stage_key) ?? 0) + 1;
    stageVisits.set(period.stage_key, visitCount);

    // Find any regression events during this period
    const regressionEvents = events.filter(
      (e) =>
        e.candidate_id === candidateId &&
        e.req_id === reqId &&
        e.event_type === 'STAGE_REGRESSION' &&
        e.event_at >= period.entered_at &&
        (!period.exited_at || e.event_at <= period.exited_at)
    );

    return {
      ...period,
      is_reentry: visitCount > 1,
      visit_number: visitCount,
      has_regression: regressionEvents.length > 0,
      regression_count: regressionEvents.length,
    };
  });
}

// ============================================
// DWELL TIME COMPUTATION
// ============================================

/**
 * Compute dwell hours from a period
 */
export function computeDwellHours(period: StageDwellPeriod, asOfDate: Date): number {
  const endTime = period.exited_at ?? asOfDate;
  const durationMs = endTime.getTime() - period.entered_at.getTime();
  return durationMs / (1000 * 60 * 60); // Convert to hours
}

/**
 * Check if SLA is breached
 */
export function checkSlaBreach(
  dwellHours: number,
  stageKey: string,
  policies: SlaPolicy[] = DEFAULT_SLA_POLICIES
): { breached: boolean; breachHours: number; policy: SlaPolicy | null } {
  const policy = policies.find((p) => p.stage_key === stageKey && p.enabled);

  if (!policy) {
    return { breached: false, breachHours: 0, policy: null };
  }

  const breached = dwellHours > policy.sla_hours;
  const breachHours = breached ? dwellHours - policy.sla_hours : 0;

  return { breached, breachHours, policy };
}

// ============================================
// ATTRIBUTION
// ============================================

/**
 * Attribute delay to an owner with confidence scoring
 */
export function attributeDelay(
  stageKey: string,
  reqId: string,
  requisitions: Map<string, Requisition>,
  users: Map<string, User>,
  policies: SlaPolicy[] = DEFAULT_SLA_POLICIES
): AttributionResult {
  const policy = policies.find((p) => p.stage_key === stageKey);
  const req = requisitions.get(reqId);

  // Rule 1: Use policy default owner, fall back to stage map
  const defaultOwner = policy?.owner_type ?? STAGE_OWNER_MAP[stageKey] ?? 'UNKNOWN';

  // Rule 2: Look up actual owner ID from requisition
  let ownerId: string | null = null;
  let ownerName: string | null = null;

  if (defaultOwner === 'HM' && req?.hiring_manager_id) {
    ownerId = req.hiring_manager_id;
    const user = users.get(req.hiring_manager_id);
    ownerName = user?.name ?? req.hiring_manager_id;
  } else if (defaultOwner === 'RECRUITER' && req?.recruiter_id) {
    ownerId = req.recruiter_id;
    const user = users.get(req.recruiter_id);
    ownerName = user?.name ?? req.recruiter_id;
  }

  // Rule 3: Determine confidence
  let confidence: AttributionConfidence = 'low';
  const reasons: string[] = [];

  if (policy) {
    reasons.push(`Stage ${stageKey} has SLA policy assigning to ${defaultOwner}`);
    confidence = 'medium';

    if (ownerId) {
      reasons.push(`Requisition has ${defaultOwner} assigned: ${ownerName}`);
      confidence = 'high';
    } else {
      reasons.push(`No ${defaultOwner} assigned to requisition`);
    }
  } else {
    reasons.push(`No SLA policy for stage ${stageKey}, defaulting to ${defaultOwner}`);
  }

  return {
    owner_type: ownerId ? defaultOwner : 'UNKNOWN',
    owner_id: ownerId,
    owner_name: ownerName,
    confidence,
    reasons,
  };
}

// ============================================
// STAGE DWELL METRIC COMPUTATION
// ============================================

/**
 * Compute full stage dwell metrics for all candidates from events
 */
export function computeStageDwellMetrics(
  events: SnapshotEvent[],
  requisitions: Map<string, Requisition>,
  users: Map<string, User>,
  policies: SlaPolicy[] = DEFAULT_SLA_POLICIES,
  asOfDate: Date = new Date()
): StageDwellMetric[] {
  // Group events by candidate+req
  const candidateReqPairs = new Map<string, { candidateId: string; reqId: string }>();
  for (const event of events) {
    if (event.candidate_id && event.req_id) {
      const key = `${event.candidate_id}:${event.req_id}`;
      if (!candidateReqPairs.has(key)) {
        candidateReqPairs.set(key, {
          candidateId: event.candidate_id,
          reqId: event.req_id,
        });
      }
    }
  }

  const metrics: StageDwellMetric[] = [];

  for (const { candidateId, reqId } of candidateReqPairs.values()) {
    const periods = handleRegression(events, candidateId, reqId);

    for (const period of periods) {
      const dwellHours = computeDwellHours(period, asOfDate);
      const { breached, breachHours, policy } = checkSlaBreach(
        dwellHours,
        period.stage_key,
        policies
      );
      const attribution = attributeDelay(period.stage_key, reqId, requisitions, users, policies);

      metrics.push({
        req_id: reqId,
        candidate_id: candidateId,
        stage_key: period.stage_key,
        entered_at: period.entered_at,
        exited_at: period.exited_at,
        dwell_hours: dwellHours,
        breached,
        breach_hours: breachHours,
        sla_policy: policy,
        attribution_owner_type: attribution.owner_type,
        attribution_owner_id: attribution.owner_id,
        attribution_owner_name: attribution.owner_name,
        attribution_confidence: attribution.confidence,
        attribution_reasons: attribution.reasons,
        enter_event_id: period.enter_event_id,
        exit_event_id: period.exit_event_id,
        is_observed: true,
        is_reentry: period.is_reentry,
        visit_number: period.visit_number,
        has_regression: period.has_regression,
      });
    }
  }

  return metrics;
}

// ============================================
// AGGREGATION / BOTTLENECK COMPUTATION
// ============================================

/**
 * Calculate percentile from sorted array
 */
function percentile(sortedValues: number[], p: number): number {
  if (sortedValues.length === 0) return 0;
  const index = Math.ceil((p / 100) * sortedValues.length) - 1;
  return sortedValues[Math.max(0, Math.min(index, sortedValues.length - 1))];
}

/**
 * Calculate bottleneck score for ranking stages
 * Higher score = worse bottleneck
 *
 * Formula: (median_dwell * breach_rate * ln(candidate_count + 1)) / sla_hours
 */
function calculateBottleneckScore(
  medianDwellHours: number,
  breachRate: number,
  candidateCount: number,
  slaHours: number
): number {
  if (candidateCount === 0) return 0;

  const volumeFactor = Math.log(candidateCount + 1);
  const score = (medianDwellHours * breachRate * volumeFactor) / slaHours;

  return Math.round(score * 100) / 100;
}

/**
 * Compute stage bottleneck statistics
 */
export function computeStageBottlenecks(
  dwellMetrics: StageDwellMetric[],
  policies: SlaPolicy[] = DEFAULT_SLA_POLICIES
): StageBottleneck[] {
  // Group by stage
  const byStage = new Map<string, StageDwellMetric[]>();
  for (const metric of dwellMetrics) {
    const existing = byStage.get(metric.stage_key) ?? [];
    existing.push(metric);
    byStage.set(metric.stage_key, existing);
  }

  const bottlenecks: StageBottleneck[] = [];

  for (const [stageKey, metrics] of byStage) {
    // Skip stages with insufficient sample size
    if (metrics.length < SLA_THRESHOLDS.MIN_CANDIDATES_PER_STAGE) {
      continue;
    }

    const policy = policies.find((p) => p.stage_key === stageKey);
    const sortedDwellHours = metrics.map((m) => m.dwell_hours).sort((a, b) => a - b);

    const medianDwellHours = percentile(sortedDwellHours, 50);
    const p90DwellHours = percentile(sortedDwellHours, 90);
    const breachCount = metrics.filter((m) => m.breached).length;
    const breachRate = breachCount / metrics.length;
    const totalBreachHours = metrics.reduce((sum, m) => sum + m.breach_hours, 0);

    const slaHours = policy?.sla_hours ?? 72; // Default to 72h
    const bottleneckScore = calculateBottleneckScore(
      medianDwellHours,
      breachRate,
      metrics.length,
      slaHours
    );

    bottlenecks.push({
      stage_key: stageKey,
      display_name: policy?.display_name ?? stageKey,
      median_dwell_hours: Math.round(medianDwellHours * 10) / 10,
      p90_dwell_hours: Math.round(p90DwellHours * 10) / 10,
      candidate_count: metrics.length,
      breach_count: breachCount,
      breach_rate: Math.round(breachRate * 1000) / 1000,
      total_breach_hours: Math.round(totalBreachHours * 10) / 10,
      owner_type: policy?.owner_type ?? STAGE_OWNER_MAP[stageKey] ?? 'UNKNOWN',
      bottleneck_score: bottleneckScore,
    });
  }

  // Sort by bottleneck score descending
  return bottlenecks.sort((a, b) => b.bottleneck_score - a.bottleneck_score);
}

/**
 * Compute owner breach summaries
 */
export function computeOwnerBreachSummaries(
  dwellMetrics: StageDwellMetric[]
): OwnerBreachSummary[] {
  // Only include breached metrics with attribution
  const breachedMetrics = dwellMetrics.filter(
    (m) => m.breached && m.attribution_owner_id
  );

  // Group by owner
  const byOwner = new Map<string, StageDwellMetric[]>();
  for (const metric of breachedMetrics) {
    const key = `${metric.attribution_owner_type}:${metric.attribution_owner_id}`;
    const existing = byOwner.get(key) ?? [];
    existing.push(metric);
    byOwner.set(key, existing);
  }

  const summaries: OwnerBreachSummary[] = [];

  for (const [_key, metrics] of byOwner) {
    // Skip owners with insufficient breaches
    if (metrics.length < SLA_THRESHOLDS.MIN_BREACHES_FOR_LEADERBOARD) {
      continue;
    }

    const first = metrics[0];
    const totalBreachHours = metrics.reduce((sum, m) => sum + m.breach_hours, 0);
    const breachStages = [...new Set(metrics.map((m) => m.stage_key))];
    const reqIds = [...new Set(metrics.map((m) => m.req_id))];

    summaries.push({
      owner_type: first.attribution_owner_type,
      owner_id: first.attribution_owner_id!,
      owner_name: first.attribution_owner_name ?? first.attribution_owner_id!,
      breach_count: metrics.length,
      total_breach_hours: Math.round(totalBreachHours * 10) / 10,
      avg_breach_hours: Math.round((totalBreachHours / metrics.length) * 10) / 10,
      breach_stages: breachStages,
      req_ids: reqIds,
    });
  }

  // Sort by breach count descending
  return summaries.sort((a, b) => b.breach_count - a.breach_count);
}

/**
 * Compute requisition breach summaries
 */
export function computeReqBreachSummaries(
  dwellMetrics: StageDwellMetric[],
  requisitions: Map<string, Requisition>,
  users: Map<string, User>,
  asOfDate: Date = new Date()
): ReqBreachSummary[] {
  // Only include breached metrics
  const breachedMetrics = dwellMetrics.filter((m) => m.breached);

  // Group by req
  const byReq = new Map<string, StageDwellMetric[]>();
  for (const metric of breachedMetrics) {
    const existing = byReq.get(metric.req_id) ?? [];
    existing.push(metric);
    byReq.set(metric.req_id, existing);
  }

  const summaries: ReqBreachSummary[] = [];

  for (const [reqId, metrics] of byReq) {
    const req = requisitions.get(reqId);

    const totalBreachHours = metrics.reduce((sum, m) => sum + m.breach_hours, 0);
    const worstMetric = metrics.reduce((worst, m) =>
      m.breach_hours > worst.breach_hours ? m : worst
    );

    // Count unique candidates for this req across all dwell metrics
    const candidateCount = new Set(
      dwellMetrics.filter((m) => m.req_id === reqId).map((m) => m.candidate_id)
    ).size;

    // Days open
    const openedAt = req?.opened_at;
    const daysOpen = openedAt
      ? Math.floor((asOfDate.getTime() - openedAt.getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    const recruiterName = req?.recruiter_id
      ? users.get(req.recruiter_id)?.name ?? req.recruiter_id
      : null;
    const hmName = req?.hiring_manager_id
      ? users.get(req.hiring_manager_id)?.name ?? req.hiring_manager_id
      : null;

    summaries.push({
      req_id: reqId,
      req_title: req?.req_title ?? reqId,
      recruiter_id: req?.recruiter_id ?? null,
      recruiter_name: recruiterName,
      hiring_manager_id: req?.hiring_manager_id ?? null,
      hiring_manager_name: hmName,
      breach_count: metrics.length,
      total_breach_hours: Math.round(totalBreachHours * 10) / 10,
      worst_stage: worstMetric.stage_key,
      worst_breach_hours: Math.round(worstMetric.breach_hours * 10) / 10,
      days_open: daysOpen,
      candidate_count: candidateCount,
    });
  }

  // Sort by total breach hours descending
  return summaries.sort((a, b) => b.total_breach_hours - a.total_breach_hours);
}

// ============================================
// MAIN BOTTLENECK SUMMARY
// ============================================

/**
 * Compute full bottleneck summary
 */
export function computeBottleneckSummary(
  events: SnapshotEvent[],
  snapshots: DataSnapshot[],
  requisitions: Map<string, Requisition>,
  users: Map<string, User>,
  dateRange: { start: Date; end: Date },
  policies: SlaPolicy[] = DEFAULT_SLA_POLICIES
): BottleneckSummary {
  const asOfDate = new Date();

  // Check coverage
  const coverage = checkCoverageSufficiency(snapshots, dateRange);

  // Compute dwell metrics
  const dwellMetrics = computeStageDwellMetrics(
    events,
    requisitions,
    users,
    policies,
    asOfDate
  );

  // Compute aggregations
  const topStages = computeStageBottlenecks(dwellMetrics, policies);
  const topOwners = computeOwnerBreachSummaries(dwellMetrics);
  const topReqs = computeReqBreachSummaries(dwellMetrics, requisitions, users, asOfDate);

  // Breach counts by stage
  const breachCounts: Record<string, number> = {};
  for (const metric of dwellMetrics.filter((m) => m.breached)) {
    breachCounts[metric.stage_key] = (breachCounts[metric.stage_key] ?? 0) + 1;
  }

  // Breach counts by owner type
  const breachByOwnerType: Record<SlaOwnerType, number> = {
    HM: 0,
    RECRUITER: 0,
    OPS: 0,
    UNKNOWN: 0,
  };
  for (const metric of dwellMetrics.filter((m) => m.breached)) {
    breachByOwnerType[metric.attribution_owner_type] += 1;
  }

  // Unique candidates analyzed
  const uniqueCandidates = new Set(dwellMetrics.map((m) => m.candidate_id));

  return {
    top_stages: topStages,
    top_reqs: topReqs.slice(0, 20), // Top 20 reqs
    top_owners: topOwners.slice(0, 10), // Top 10 owners
    breach_counts: breachCounts,
    breach_by_owner_type: breachByOwnerType,
    coverage,
    date_range: dateRange,
    total_candidates_analyzed: uniqueCandidates.size,
    total_dwell_records: dwellMetrics.length,
    computed_at: asOfDate,
  };
}

/**
 * Get SLA owner type for a stage
 */
export function getSlaOwnerType(
  stageKey: string,
  policies: SlaPolicy[] = DEFAULT_SLA_POLICIES
): SlaOwnerType {
  const policy = policies.find((p) => p.stage_key === stageKey);
  return policy?.owner_type ?? STAGE_OWNER_MAP[stageKey] ?? 'UNKNOWN';
}

/**
 * Check if a stage movement is a regression
 */
export function isStageRegression(fromStage: string, toStage: string): boolean {
  // Terminal stages are never regressions
  if (isTerminalStage(toStage)) {
    return false;
  }

  // Define stage order for comparison
  const stageOrder = [
    'LEAD',
    'APPLIED',
    'SCREEN',
    'HM_SCREEN',
    'ONSITE',
    'FINAL',
    'OFFER',
    'HIRED',
  ];

  const fromIndex = stageOrder.indexOf(fromStage);
  const toIndex = stageOrder.indexOf(toStage);

  // If either stage is not in the order, we can't determine regression
  if (fromIndex === -1 || toIndex === -1) {
    return false;
  }

  // It's a regression if moving backward in the funnel
  return toIndex < fromIndex;
}
