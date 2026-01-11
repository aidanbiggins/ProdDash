// Pipeline Benchmark Service
// Calculates actual pipeline performance vs targets and generates insights

import { differenceInDays, differenceInHours } from 'date-fns';
import {
  Requisition,
  Candidate,
  Event,
  User,
  CanonicalStage,
  CandidateDisposition,
  EventType,
  HiringManagerFriction,
  MetricFilters
} from '../types';
import { DashboardConfig } from '../types/config';
import {
  PipelineBenchmarkConfig,
  PipelineHealthSummary,
  StagePerformance,
  PipelineInsight,
  PerformanceStatus,
  HistoricalBenchmarkResult,
  DEFAULT_PIPELINE_BENCHMARKS,
  getPerformanceStatus,
  InsightSeverity
} from '../types/pipelineTypes';
import { normalizeStage } from './stageNormalization';

// ===== UTILITY FUNCTIONS =====

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

function getCanonicalStageName(stage: CanonicalStage): string {
  const names: Record<CanonicalStage, string> = {
    [CanonicalStage.LEAD]: 'Lead',
    [CanonicalStage.APPLIED]: 'Applied',
    [CanonicalStage.SCREEN]: 'Screen',
    [CanonicalStage.HM_SCREEN]: 'HM Screen',
    [CanonicalStage.ONSITE]: 'Onsite',
    [CanonicalStage.FINAL]: 'Final',
    [CanonicalStage.OFFER]: 'Offer',
    [CanonicalStage.HIRED]: 'Hired',
    [CanonicalStage.REJECTED]: 'Rejected',
    [CanonicalStage.WITHDREW]: 'Withdrawn'
  };
  return names[stage] || stage;
}

function isInDateRange(date: Date | null | undefined, filter: MetricFilters): boolean {
  if (!date) return false;
  return date >= filter.dateRange.startDate && date <= filter.dateRange.endDate;
}

// ===== MAIN CALCULATION FUNCTION =====

export function calculatePipelineHealth(
  requisitions: Requisition[],
  candidates: Candidate[],
  events: Event[],
  users: User[],
  hmFriction: HiringManagerFriction[],
  config: DashboardConfig,
  filter: MetricFilters
): PipelineHealthSummary {
  const benchmarks = config.pipelineBenchmarks || DEFAULT_PIPELINE_BENCHMARKS;

  // Filter data to match current filters
  const filteredReqs = requisitions.filter(r => matchesFilters(r, filter));
  const filteredReqIds = new Set(filteredReqs.map(r => r.req_id));
  const filteredCandidates = candidates.filter(c => filteredReqIds.has(c.req_id));
  const filteredEvents = events.filter(e => filteredReqIds.has(e.req_id));

  // Calculate stage-level performance
  const stagePerformance = calculateStagePerformance(
    filteredCandidates,
    filteredEvents,
    filteredReqs,
    users,
    hmFriction,
    benchmarks,
    config,
    filter
  );

  // Calculate overall TTF
  const ttfValues = calculateTTFValues(filteredCandidates, filteredReqs, filter);
  const actualMedianTTF = median(ttfValues) || 0;
  const targetTTF = benchmarks.targetTotalTTF;
  const ttfVariance = actualMedianTTF - targetTTF;

  // Determine TTF status
  const ttfStatus = getPerformanceStatus(
    actualMedianTTF,
    targetTTF,
    targetTTF * 1.5, // Max is 150% of target
    false
  );

  // Calculate summary counts
  const stagesAhead = stagePerformance.filter(s => s.durationStatus === 'ahead' || s.passRateStatus === 'ahead').length;
  const stagesOnTrack = stagePerformance.filter(s => s.durationStatus === 'on-track' && s.passRateStatus === 'on-track').length;
  const stagesBehind = stagePerformance.filter(s => s.durationStatus === 'behind' || s.passRateStatus === 'behind').length;
  const stagesCritical = stagePerformance.filter(s => s.durationStatus === 'critical' || s.passRateStatus === 'critical').length;

  // Calculate overall health score (0-100)
  const healthScore = calculateOverallHealthScore(stagePerformance, ttfStatus);

  // Determine overall status
  const overallStatus = healthScore >= 80 ? 'ahead' :
    healthScore >= 60 ? 'on-track' :
    healthScore >= 40 ? 'behind' : 'critical';

  // Collect top insights across all stages
  const allInsights = stagePerformance.flatMap(s => s.insights);
  const topInsights = allInsights
    .sort((a, b) => severityOrder(b.severity) - severityOrder(a.severity))
    .slice(0, 5);

  return {
    overallStatus,
    healthScore,
    targetTTF,
    actualMedianTTF,
    ttfVariance,
    ttfStatus,
    stagePerformance,
    stagesAhead,
    stagesOnTrack,
    stagesBehind,
    stagesCritical,
    topInsights,
    periodStart: filter.dateRange.startDate,
    periodEnd: filter.dateRange.endDate,
    sampleSize: ttfValues.length
  };
}

function severityOrder(severity: InsightSeverity): number {
  return { critical: 3, warning: 2, info: 1 }[severity];
}

// ===== STAGE PERFORMANCE CALCULATION =====

function calculateStagePerformance(
  candidates: Candidate[],
  events: Event[],
  requisitions: Requisition[],
  users: User[],
  hmFriction: HiringManagerFriction[],
  benchmarks: PipelineBenchmarkConfig,
  config: DashboardConfig,
  filter: MetricFilters
): StagePerformance[] {
  const results: StagePerformance[] = [];

  // Group events by candidate for stage duration calculation
  const eventsByCandidate = new Map<string, Event[]>();
  for (const event of events) {
    if (event.event_type !== EventType.STAGE_CHANGE) continue;
    const existing = eventsByCandidate.get(event.candidate_id) || [];
    existing.push(event);
    eventsByCandidate.set(event.candidate_id, existing);
  }

  // Sort events by time for each candidate
  for (const [candId, candEvents] of eventsByCandidate) {
    candEvents.sort((a, b) => a.event_at.getTime() - b.event_at.getTime());
  }

  // Calculate stage durations
  const stageDurations = calculateStageDurations(eventsByCandidate, config);

  // Calculate stage conversion rates
  const stageConversions = calculateStageConversions(candidates, events, config, filter);

  // Build performance for each benchmark stage
  for (const benchmark of benchmarks.stages) {
    const durations = stageDurations.get(benchmark.stage) || [];
    const conversion = stageConversions.get(benchmark.stage);

    const actualMedianDays = median(durations) ?? benchmark.targetDays;
    const actualP25Days = percentile(durations, 25) ?? benchmark.targetDays * 0.7;
    const actualP75Days = percentile(durations, 75) ?? benchmark.targetDays * 1.3;

    const durationVariance = actualMedianDays - benchmark.targetDays;
    const durationStatus = getPerformanceStatus(
      actualMedianDays,
      benchmark.targetDays,
      benchmark.maxDays,
      false
    );

    const actualPassRate = conversion?.passRate ?? benchmark.targetPassRate;
    const passRateVariance = actualPassRate - benchmark.targetPassRate;
    const passRateStatus = getPerformanceStatus(
      actualPassRate,
      benchmark.targetPassRate,
      benchmark.minPassRate,
      true
    );

    // Generate insights for this stage
    const insights = generateStageInsights(
      benchmark.stage,
      actualMedianDays,
      benchmark.targetDays,
      benchmark.maxDays,
      actualPassRate,
      benchmark.targetPassRate,
      benchmark.minPassRate,
      durations.length,
      conversion?.entered || 0,
      conversion?.passed || 0,
      conversion?.rejected || 0,
      conversion?.withdrawn || 0,
      hmFriction,
      users
    );

    const primaryBlocker = insights.find(i => i.severity === 'critical')?.message ||
      insights.find(i => i.severity === 'warning')?.message || null;

    results.push({
      stage: benchmark.stage,
      stageName: getCanonicalStageName(benchmark.stage),
      targetDays: benchmark.targetDays,
      maxDays: benchmark.maxDays,
      actualMedianDays,
      actualP25Days,
      actualP75Days,
      durationVariance,
      durationStatus,
      durationSampleSize: durations.length,
      targetPassRate: benchmark.targetPassRate,
      minPassRate: benchmark.minPassRate,
      actualPassRate,
      passRateVariance,
      passRateStatus,
      passRateSampleSize: conversion?.entered || 0,
      candidatesEntered: conversion?.entered || 0,
      candidatesPassed: conversion?.passed || 0,
      candidatesRejected: conversion?.rejected || 0,
      candidatesWithdrawn: conversion?.withdrawn || 0,
      insights,
      primaryBlocker
    });
  }

  return results;
}

// ===== STAGE DURATIONS =====

function calculateStageDurations(
  eventsByCandidate: Map<string, Event[]>,
  config: DashboardConfig
): Map<CanonicalStage, number[]> {
  const durations = new Map<CanonicalStage, number[]>();

  for (const [candId, candEvents] of eventsByCandidate) {
    let lastStage: CanonicalStage | null = null;
    let lastEntryTime: Date | null = null;

    for (const event of candEvents) {
      const toCanonical = normalizeStage(event.to_stage, config.stageMapping);

      if (lastStage && lastEntryTime && toCanonical && toCanonical !== lastStage) {
        const daysInStage = differenceInDays(event.event_at, lastEntryTime);
        if (daysInStage >= 0 && daysInStage < 180) {
          const existing = durations.get(lastStage) || [];
          existing.push(daysInStage);
          durations.set(lastStage, existing);
        }
      }

      if (toCanonical) {
        lastStage = toCanonical;
        lastEntryTime = event.event_at;
      }
    }
  }

  return durations;
}

// ===== STAGE CONVERSIONS =====

interface StageConversionData {
  entered: number;
  passed: number;
  rejected: number;
  withdrawn: number;
  passRate: number;
}

function calculateStageConversions(
  candidates: Candidate[],
  events: Event[],
  config: DashboardConfig,
  filter: MetricFilters
): Map<CanonicalStage, StageConversionData> {
  const conversions = new Map<CanonicalStage, StageConversionData>();

  // Track which stages each candidate reached
  const candidateStages = new Map<string, Set<CanonicalStage>>();

  for (const event of events) {
    if (event.event_type !== EventType.STAGE_CHANGE) continue;
    const toCanonical = normalizeStage(event.to_stage, config.stageMapping);
    if (!toCanonical) continue;

    const stages = candidateStages.get(event.candidate_id) || new Set();
    stages.add(toCanonical);
    candidateStages.set(event.candidate_id, stages);
  }

  // Also consider current stage
  for (const cand of candidates) {
    const canonical = normalizeStage(cand.current_stage, config.stageMapping);
    if (canonical) {
      const stages = candidateStages.get(cand.candidate_id) || new Set();
      stages.add(canonical);
      candidateStages.set(cand.candidate_id, stages);
    }
  }

  // Define stage progression order
  const stageOrder = [
    CanonicalStage.SCREEN,
    CanonicalStage.HM_SCREEN,
    CanonicalStage.ONSITE,
    CanonicalStage.OFFER,
    CanonicalStage.HIRED
  ];

  // Calculate conversions for each stage
  for (let i = 0; i < stageOrder.length - 1; i++) {
    const fromStage = stageOrder[i];
    const toStage = stageOrder[i + 1];

    let entered = 0;
    let passed = 0;
    let rejected = 0;
    let withdrawn = 0;

    for (const [candId, stages] of candidateStages) {
      if (stages.has(fromStage)) {
        entered++;
        if (stages.has(toStage)) {
          passed++;
        } else if (stages.has(CanonicalStage.REJECTED)) {
          rejected++;
        } else if (stages.has(CanonicalStage.WITHDREW)) {
          withdrawn++;
        }
      }
    }

    conversions.set(fromStage, {
      entered,
      passed,
      rejected,
      withdrawn,
      passRate: entered > 0 ? passed / entered : 0
    });
  }

  return conversions;
}

// ===== TTF CALCULATION =====

function calculateTTFValues(
  candidates: Candidate[],
  requisitions: Requisition[],
  filter: MetricFilters
): number[] {
  const reqMap = new Map(requisitions.map(r => [r.req_id, r]));

  return candidates
    .filter(c =>
      c.disposition === CandidateDisposition.Hired &&
      c.hired_at &&
      isInDateRange(c.hired_at, filter)
    )
    .map(c => {
      const req = reqMap.get(c.req_id);
      if (!req?.opened_at || !c.hired_at) return null;
      const ttf = differenceInDays(c.hired_at, req.opened_at);
      return ttf >= 0 ? ttf : null;
    })
    .filter((ttf): ttf is number => ttf !== null);
}

// ===== INSIGHT GENERATION =====

function generateStageInsights(
  stage: CanonicalStage,
  actualDays: number,
  targetDays: number,
  maxDays: number,
  actualPassRate: number,
  targetPassRate: number,
  minPassRate: number,
  durationSampleSize: number,
  candidatesEntered: number,
  candidatesPassed: number,
  candidatesRejected: number,
  candidatesWithdrawn: number,
  hmFriction: HiringManagerFriction[],
  users: User[]
): PipelineInsight[] {
  const insights: PipelineInsight[] = [];
  const stageName = getCanonicalStageName(stage);

  // Duration insights
  if (actualDays > maxDays) {
    insights.push({
      category: 'bottleneck',
      severity: 'critical',
      message: `${stageName} taking ${actualDays.toFixed(0)}d vs ${targetDays}d target`,
      dataPoint: `${((actualDays - targetDays) / targetDays * 100).toFixed(0)}% over target`,
      recommendation: `Investigate ${stageName} bottlenecks - consider process changes or additional resources`
    });
  } else if (actualDays > targetDays) {
    insights.push({
      category: 'bottleneck',
      severity: 'warning',
      message: `${stageName} slightly behind at ${actualDays.toFixed(0)}d vs ${targetDays}d target`,
      dataPoint: `${(actualDays - targetDays).toFixed(1)} days over`,
      recommendation: `Monitor ${stageName} closely for further delays`
    });
  } else if (actualDays < targetDays * 0.7) {
    insights.push({
      category: 'positive',
      severity: 'info',
      message: `${stageName} running efficiently at ${actualDays.toFixed(0)}d`,
      dataPoint: `${((targetDays - actualDays) / targetDays * 100).toFixed(0)}% faster than target`,
      recommendation: 'Consider this stage for best practice documentation'
    });
  }

  // Pass rate insights
  if (actualPassRate < minPassRate) {
    insights.push({
      category: 'rejection-rate',
      severity: 'critical',
      message: `${stageName} pass rate critically low at ${(actualPassRate * 100).toFixed(0)}%`,
      dataPoint: `${candidatesRejected + candidatesWithdrawn} of ${candidatesEntered} candidates didn't advance`,
      recommendation: 'Review rejection reasons and calibrate expectations with stakeholders'
    });
  } else if (actualPassRate < targetPassRate) {
    insights.push({
      category: 'rejection-rate',
      severity: 'warning',
      message: `${stageName} pass rate below target at ${(actualPassRate * 100).toFixed(0)}%`,
      dataPoint: `Target: ${(targetPassRate * 100).toFixed(0)}%, Actual: ${(actualPassRate * 100).toFixed(0)}%`,
      recommendation: 'Review candidate quality entering this stage'
    });
  }

  // HM-specific insights for HM_SCREEN stage
  if (stage === CanonicalStage.HM_SCREEN && actualDays > targetDays) {
    const slowHMs = hmFriction
      .filter(h => h.feedbackLatencyMedian && h.feedbackLatencyMedian > 48)
      .sort((a, b) => (b.feedbackLatencyMedian || 0) - (a.feedbackLatencyMedian || 0))
      .slice(0, 3);

    if (slowHMs.length > 0) {
      insights.push({
        category: 'hm-latency',
        severity: actualDays > maxDays ? 'critical' : 'warning',
        message: `HM feedback delays impacting ${stageName} duration`,
        dataPoint: `${slowHMs.length} HMs averaging 48+ hr feedback time`,
        recommendation: 'Schedule standing feedback syncs with slow HMs',
        affectedEntities: slowHMs.map(h => ({
          id: h.hmId,
          name: h.hmName,
          value: h.feedbackLatencyMedian || 0
        }))
      });
    }
  }

  // Volume insights
  if (candidatesEntered < 10 && durationSampleSize < 5) {
    insights.push({
      category: 'volume',
      severity: 'info',
      message: `Low sample size for ${stageName} (${candidatesEntered} candidates)`,
      dataPoint: 'Metrics may not be statistically significant',
      recommendation: 'Expand date range or wait for more data'
    });
  }

  // Withdrawal insights
  const withdrawalRate = candidatesEntered > 0 ? candidatesWithdrawn / candidatesEntered : 0;
  if (withdrawalRate > 0.15) {
    insights.push({
      category: 'rejection-rate',
      severity: withdrawalRate > 0.25 ? 'critical' : 'warning',
      message: `High withdrawal rate at ${stageName}: ${(withdrawalRate * 100).toFixed(0)}%`,
      dataPoint: `${candidatesWithdrawn} of ${candidatesEntered} candidates withdrew`,
      recommendation: 'Survey withdrawn candidates, review candidate experience'
    });
  }

  return insights;
}

// ===== OVERALL HEALTH SCORE =====

function calculateOverallHealthScore(
  stagePerformance: StagePerformance[],
  ttfStatus: PerformanceStatus
): number {
  let score = 100;

  // TTF impact (30% weight)
  const ttfPenalty = {
    ahead: 0,
    'on-track': 5,
    behind: 15,
    critical: 30
  }[ttfStatus];
  score -= ttfPenalty;

  // Stage performance impact (70% weight, split evenly)
  const stageWeight = 70 / stagePerformance.length;

  for (const stage of stagePerformance) {
    // Duration penalty
    const durationPenalty = {
      ahead: 0,
      'on-track': 0.1,
      behind: 0.4,
      critical: 0.7
    }[stage.durationStatus];

    // Pass rate penalty
    const passRatePenalty = {
      ahead: 0,
      'on-track': 0.1,
      behind: 0.4,
      critical: 0.7
    }[stage.passRateStatus];

    const stagePenalty = ((durationPenalty + passRatePenalty) / 2) * stageWeight;
    score -= stagePenalty;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

// ===== FILTER MATCHING =====

function matchesFilters(req: Requisition, filter: MetricFilters): boolean {
  if (filter.recruiterIds?.length && !filter.recruiterIds.includes(req.recruiter_id)) {
    return false;
  }
  if (filter.functions?.length && !filter.functions.includes(req.function)) {
    return false;
  }
  if (filter.levels?.length && !filter.levels.includes(req.level)) {
    return false;
  }
  if (filter.jobFamilies?.length && req.job_family && !filter.jobFamilies.includes(req.job_family)) {
    return false;
  }
  if (filter.regions?.length && req.location_region && !filter.regions.includes(req.location_region)) {
    return false;
  }
  if (filter.locationTypes?.length && !filter.locationTypes.includes(req.location_type)) {
    return false;
  }
  if (filter.hiringManagerIds?.length && !filter.hiringManagerIds.includes(req.hiring_manager_id)) {
    return false;
  }
  return true;
}

// ===== GENERATE HISTORICAL BENCHMARKS =====

export function generateHistoricalBenchmarks(
  requisitions: Requisition[],
  candidates: Candidate[],
  events: Event[],
  config: DashboardConfig
): HistoricalBenchmarkResult {
  const notes: string[] = [];

  // Get closed reqs for TTF
  const closedReqs = requisitions.filter(r => r.closed_at && r.opened_at);
  const ttfValues = closedReqs
    .map(r => differenceInDays(r.closed_at!, r.opened_at))
    .filter(t => t > 0 && t < 365);

  const medianTTF = median(ttfValues) || 45;
  notes.push(`Based on ${ttfValues.length} closed requisitions`);

  // Calculate stage durations
  const eventsByCandidate = new Map<string, Event[]>();
  for (const event of events) {
    if (event.event_type !== EventType.STAGE_CHANGE) continue;
    const existing = eventsByCandidate.get(event.candidate_id) || [];
    existing.push(event);
    eventsByCandidate.set(event.candidate_id, existing);
  }

  for (const [candId, candEvents] of eventsByCandidate) {
    candEvents.sort((a, b) => a.event_at.getTime() - b.event_at.getTime());
  }

  const stageDurations = calculateStageDurations(eventsByCandidate, config);

  // Build stage benchmarks
  const stages = [
    CanonicalStage.SCREEN,
    CanonicalStage.HM_SCREEN,
    CanonicalStage.ONSITE,
    CanonicalStage.OFFER
  ];

  const stageBenchmarks = stages.map(stage => {
    const durations = stageDurations.get(stage) || [];
    const medianDays = median(durations);
    const p75Days = percentile(durations, 75);

    // Calculate pass rate
    const candidateStages = new Map<string, Set<CanonicalStage>>();
    for (const event of events) {
      if (event.event_type !== EventType.STAGE_CHANGE) continue;
      const toCanonical = normalizeStage(event.to_stage, config.stageMapping);
      if (!toCanonical) continue;
      const stages = candidateStages.get(event.candidate_id) || new Set();
      stages.add(toCanonical);
      candidateStages.set(event.candidate_id, stages);
    }

    const stageIndex = stages.indexOf(stage);
    const nextStage = stageIndex < stages.length - 1 ? stages[stageIndex + 1] : CanonicalStage.HIRED;

    let entered = 0;
    let passed = 0;
    for (const [candId, candStages] of candidateStages) {
      if (candStages.has(stage)) {
        entered++;
        if (candStages.has(nextStage)) passed++;
      }
    }

    const passRate = entered > 0 ? passed / entered : 0.5;

    return {
      stage,
      targetDays: medianDays ?? DEFAULT_PIPELINE_BENCHMARKS.stages.find(s => s.stage === stage)?.targetDays ?? 5,
      maxDays: p75Days ?? (medianDays ? medianDays * 1.5 : 10),
      targetPassRate: passRate,
      minPassRate: Math.max(0.1, passRate - 0.15)
    };
  });

  // Determine confidence
  const sampleSize = ttfValues.length;
  const confidence = sampleSize >= 50 ? 'high' : sampleSize >= 20 ? 'medium' : 'low';

  if (confidence === 'low') {
    notes.push('Limited data - consider using defaults until more data is available');
  }

  // Get date range
  const allDates = [
    ...closedReqs.map(r => r.opened_at),
    ...closedReqs.filter(r => r.closed_at).map(r => r.closed_at!)
  ].filter(Boolean);

  const dataRange = {
    start: allDates.length > 0 ? new Date(Math.min(...allDates.map(d => d.getTime()))) : new Date(),
    end: allDates.length > 0 ? new Date(Math.max(...allDates.map(d => d.getTime()))) : new Date()
  };

  return {
    benchmarks: {
      stages: stageBenchmarks,
      targetTotalTTF: medianTTF,
      lastUpdated: new Date(),
      source: 'historical'
    },
    confidence,
    sampleSize,
    dataRange,
    notes
  };
}
