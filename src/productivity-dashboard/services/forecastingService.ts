// Forecasting Service for the Recruiter Productivity Dashboard

import { differenceInDays, addDays } from 'date-fns';
import {
  Requisition,
  Candidate,
  Event,
  User,
  RequisitionStatus,
  CandidateDisposition,
  CanonicalStage,
  HiringManagerFriction,
  RoleProfile,
  RoleForecast,
  TTFPrediction,
  PipelineRequirements,
  PipelineStageRequirement,
  SourceMixRecommendation,
  SourceRecommendation,
  RiskFactor,
  MilestoneTimeline,
  MilestoneEvent,
  RoleHealthMetrics,
  HealthStatus,
  ActionRecommendation,
  ForecastingBenchmarks,
  CohortBenchmark,
  StageDurationBenchmark
} from '../types';
import { DashboardConfig } from '../types/config';
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

function getConfidenceLevel(sampleSize: number): 'high' | 'medium' | 'low' {
  if (sampleSize >= 10) return 'high';
  if (sampleSize >= 5) return 'medium';
  return 'low';
}

function severityOrder(severity: 'high' | 'medium' | 'low'): number {
  return { high: 3, medium: 2, low: 1 }[severity];
}

// ===== BENCHMARK BUILDING =====

/**
 * Build benchmarks from historical data grouped by dimensions
 */
export function buildForecastingBenchmarks(
  requisitions: Requisition[],
  candidates: Candidate[],
  events: Event[],
  users: User[],
  hmFriction: HiringManagerFriction[],
  config: DashboardConfig
): ForecastingBenchmarks {
  // Get closed reqs with hires for TTF calculation
  const closedReqs = requisitions.filter(r =>
    r.status === RequisitionStatus.Closed && r.closed_at
  );

  // Calculate TTF for each closed req (must have both dates)
  const reqTTFs = new Map<string, number>();
  for (const req of closedReqs) {
    if (req.closed_at && req.opened_at) {
      const ttf = differenceInDays(req.closed_at, req.opened_at);
      if (ttf > 0 && ttf < 365) { // Sanity check
        reqTTFs.set(req.req_id, ttf);
      }
    }
  }

  // Get hire counts per req for pipeline depth calculation
  const hiresByReq = new Map<string, number>();
  const candidatesByReq = new Map<string, Candidate[]>();
  for (const cand of candidates) {
    const existing = candidatesByReq.get(cand.req_id) || [];
    existing.push(cand);
    candidatesByReq.set(cand.req_id, existing);

    if (cand.disposition === CandidateDisposition.Hired) {
      hiresByReq.set(cand.req_id, (hiresByReq.get(cand.req_id) || 0) + 1);
    }
  }

  // Calculate stage conversion rates globally
  const stageConversionRates = calculateStageConversionRates(candidates, events, config);

  // Calculate source effectiveness
  const sourceStats = calculateSourceStats(candidates);

  // Calculate global stage durations from all historical data
  const globalStageDurations = calculateStageDurations(events, candidates, config);

  // Build cohort benchmarks
  const byCohort: Record<string, CohortBenchmark> = {};
  const byFunction: Record<string, CohortBenchmark> = {};
  const byLevel: Record<string, CohortBenchmark> = {};
  const byLocationType: Record<string, CohortBenchmark> = {};
  const byJobFamily: Record<string, CohortBenchmark> = {};

  // Group reqs by dimensions
  const reqsByFunction = groupBy(closedReqs, r => r.function);
  const reqsByLevel = groupBy(closedReqs, r => r.level);
  const reqsByLocationType = groupBy(closedReqs, r => r.location_type);
  const reqsByJobFamily = groupBy(closedReqs, r => r.job_family);

  // Build function benchmarks with cohort-specific stage durations where we have enough data
  for (const [func, reqs] of Object.entries(reqsByFunction)) {
    const reqIdSet = new Set(reqs.map(r => r.req_id));
    const cohortStageDurations = calculateStageDurations(events, candidates, config, reqIdSet);
    // Use cohort-specific durations if we have enough data, otherwise fall back to global
    const stageDurations = cohortStageDurations.some(d => d.sampleSize >= 5) ? cohortStageDurations : globalStageDurations;
    byFunction[func] = buildCohortBenchmark(func, reqs, reqTTFs, candidatesByReq, stageConversionRates, sourceStats, stageDurations);
  }

  // Build level benchmarks
  for (const [level, reqs] of Object.entries(reqsByLevel)) {
    const reqIdSet = new Set(reqs.map(r => r.req_id));
    const cohortStageDurations = calculateStageDurations(events, candidates, config, reqIdSet);
    const stageDurations = cohortStageDurations.some(d => d.sampleSize >= 5) ? cohortStageDurations : globalStageDurations;
    byLevel[level] = buildCohortBenchmark(level, reqs, reqTTFs, candidatesByReq, stageConversionRates, sourceStats, stageDurations);
  }

  // Build location type benchmarks
  for (const [locType, reqs] of Object.entries(reqsByLocationType)) {
    const reqIdSet = new Set(reqs.map(r => r.req_id));
    const cohortStageDurations = calculateStageDurations(events, candidates, config, reqIdSet);
    const stageDurations = cohortStageDurations.some(d => d.sampleSize >= 5) ? cohortStageDurations : globalStageDurations;
    byLocationType[locType] = buildCohortBenchmark(locType, reqs, reqTTFs, candidatesByReq, stageConversionRates, sourceStats, stageDurations);
  }

  // Build job family benchmarks
  for (const [jobFamily, reqs] of Object.entries(reqsByJobFamily)) {
    const reqIdSet = new Set(reqs.map(r => r.req_id));
    const cohortStageDurations = calculateStageDurations(events, candidates, config, reqIdSet);
    const stageDurations = cohortStageDurations.some(d => d.sampleSize >= 5) ? cohortStageDurations : globalStageDurations;
    byJobFamily[jobFamily] = buildCohortBenchmark(jobFamily, reqs, reqTTFs, candidatesByReq, stageConversionRates, sourceStats, stageDurations);
  }

  // Build full cohort benchmarks (function|level|locationType|jobFamily)
  const reqsByCohort = groupBy(closedReqs, r =>
    `${r.function}|${r.level}|${r.location_type}|${r.job_family}`
  );
  for (const [cohortKey, reqs] of Object.entries(reqsByCohort)) {
    const reqIdSet = new Set(reqs.map(r => r.req_id));
    const cohortStageDurations = calculateStageDurations(events, candidates, config, reqIdSet);
    const stageDurations = cohortStageDurations.some(d => d.sampleSize >= 5) ? cohortStageDurations : globalStageDurations;
    byCohort[cohortKey] = buildCohortBenchmark(cohortKey, reqs, reqTTFs, candidatesByReq, stageConversionRates, sourceStats, stageDurations);
  }

  // Build HM benchmarks
  const byHM: Record<string, { hmWeight: number; feedbackLatency: number; decisionLatency: number }> = {};
  for (const hm of hmFriction) {
    byHM[hm.hmId] = {
      hmWeight: hm.hmWeight,
      feedbackLatency: hm.feedbackLatencyMedian || 24,
      decisionLatency: hm.decisionLatencyMedian || 48
    };
  }

  // Build global benchmark
  const global = buildCohortBenchmark('global', closedReqs, reqTTFs, candidatesByReq, stageConversionRates, sourceStats, globalStageDurations);

  return {
    byFunction,
    byLevel,
    byLocationType,
    byJobFamily,
    byCohort,
    byHM,
    global
  };
}

function buildCohortBenchmark(
  cohortKey: string,
  reqs: Requisition[],
  reqTTFs: Map<string, number>,
  candidatesByReq: Map<string, Candidate[]>,
  stageConversionRates: Record<string, number>,
  sourceStats: { hireRates: Record<string, number>; ttfs: Record<string, number> },
  stageDurations: StageDurationBenchmark[]
): CohortBenchmark {
  const ttfs = reqs.map(r => reqTTFs.get(r.req_id)).filter((t): t is number => t !== undefined);
  const pipelineDepths = reqs.map(r => candidatesByReq.get(r.req_id)?.length || 0);

  return {
    cohortKey,
    medianTTF: median(ttfs) || 45,
    p25TTF: percentile(ttfs, 25) || 30,
    p75TTF: percentile(ttfs, 75) || 60,
    sampleSize: ttfs.length,
    medianPipelineDepth: median(pipelineDepths) || 10,
    stageConversionRates,
    sourceHireRates: sourceStats.hireRates,
    sourceTTF: sourceStats.ttfs,
    stageDurations
  };
}

function calculateStageConversionRates(
  candidates: Candidate[],
  events: Event[],
  config: DashboardConfig
): Record<string, number> {
  // Track stage progression per candidate
  const stageReached = new Map<string, Set<CanonicalStage>>();

  for (const event of events) {
    if (event.event_type !== 'STAGE_CHANGE') continue;
    const toCanonical = normalizeStage(event.to_stage, config.stageMapping);
    if (!toCanonical) continue;

    const stages = stageReached.get(event.candidate_id) || new Set();
    stages.add(toCanonical);
    stageReached.set(event.candidate_id, stages);
  }

  // Also count by current stage for candidates
  for (const cand of candidates) {
    const canonical = normalizeStage(cand.current_stage, config.stageMapping);
    if (canonical) {
      const stages = stageReached.get(cand.candidate_id) || new Set();
      stages.add(canonical);
      stageReached.set(cand.candidate_id, stages);
    }
  }

  // Calculate conversion rates
  const stageCounts: Record<string, number> = {};
  for (const stages of stageReached.values()) {
    for (const stage of stages) {
      stageCounts[stage] = (stageCounts[stage] || 0) + 1;
    }
  }

  const total = stageReached.size || 1;
  const rates: Record<string, number> = {};

  // Calculate pass rates from stage to next
  const stageOrder = [
    CanonicalStage.SCREEN,
    CanonicalStage.HM_SCREEN,
    CanonicalStage.ONSITE,
    CanonicalStage.OFFER,
    CanonicalStage.HIRED
  ];

  for (let i = 0; i < stageOrder.length - 1; i++) {
    const from = stageOrder[i];
    const to = stageOrder[i + 1];
    const fromCount = stageCounts[from] || 1;
    const toCount = stageCounts[to] || 0;
    rates[from] = Math.min(1, toCount / fromCount);
  }

  // Default rates if no data
  return {
    [CanonicalStage.SCREEN]: rates[CanonicalStage.SCREEN] || 0.4,
    [CanonicalStage.HM_SCREEN]: rates[CanonicalStage.HM_SCREEN] || 0.5,
    [CanonicalStage.ONSITE]: rates[CanonicalStage.ONSITE] || 0.4,
    [CanonicalStage.OFFER]: rates[CanonicalStage.OFFER] || 0.8
  };
}

function calculateSourceStats(candidates: Candidate[]): {
  hireRates: Record<string, number>;
  ttfs: Record<string, number>;
} {
  const bySource: Record<string, { total: number; hires: number; ttfs: number[] }> = {};

  for (const cand of candidates) {
    const source = cand.source || 'Unknown';
    if (!bySource[source]) {
      bySource[source] = { total: 0, hires: 0, ttfs: [] };
    }
    bySource[source].total++;
    if (cand.disposition === CandidateDisposition.Hired && cand.hired_at && cand.applied_at) {
      bySource[source].hires++;
      const ttf = differenceInDays(cand.hired_at, cand.applied_at);
      if (ttf > 0) bySource[source].ttfs.push(ttf);
    }
  }

  const hireRates: Record<string, number> = {};
  const ttfs: Record<string, number> = {};

  for (const [source, stats] of Object.entries(bySource)) {
    hireRates[source] = stats.total > 0 ? stats.hires / stats.total : 0;
    ttfs[source] = median(stats.ttfs) || 45;
  }

  return { hireRates, ttfs };
}

function groupBy<T>(items: T[], keyFn: (item: T) => string): Record<string, T[]> {
  const result: Record<string, T[]> = {};
  for (const item of items) {
    const key = keyFn(item);
    if (!result[key]) result[key] = [];
    result[key].push(item);
  }
  return result;
}

/**
 * Calculate actual time candidates spend in each stage from STAGE_CHANGE events
 */
function calculateStageDurations(
  events: Event[],
  candidates: Candidate[],
  config: DashboardConfig,
  reqIds?: Set<string>  // Optional filter to specific reqs
): StageDurationBenchmark[] {
  // Group events by candidate, sorted by time
  const eventsByCandidate = new Map<string, Event[]>();
  for (const event of events) {
    if (event.event_type !== 'STAGE_CHANGE') continue;
    if (reqIds && !reqIds.has(event.req_id)) continue;

    const existing = eventsByCandidate.get(event.candidate_id) || [];
    existing.push(event);
    eventsByCandidate.set(event.candidate_id, existing);
  }

  // Sort each candidate's events by time
  for (const [candId, candEvents] of eventsByCandidate) {
    candEvents.sort((a, b) => a.event_at.getTime() - b.event_at.getTime());
  }

  // Track time spent in each stage
  const stageDurations: Record<string, number[]> = {};

  for (const [candId, candEvents] of eventsByCandidate) {
    // Track stage entry times
    let lastStage: CanonicalStage | null = null;
    let lastEntryTime: Date | null = null;

    for (const event of candEvents) {
      const toCanonical = normalizeStage(event.to_stage, config.stageMapping);

      // If we were in a stage and are now moving to a different one, record duration
      if (lastStage && lastEntryTime && toCanonical && toCanonical !== lastStage) {
        const daysInStage = differenceInDays(event.event_at, lastEntryTime);
        if (daysInStage >= 0 && daysInStage < 180) {  // Sanity check
          if (!stageDurations[lastStage]) stageDurations[lastStage] = [];
          stageDurations[lastStage].push(daysInStage);
        }
      }

      // Update current stage
      if (toCanonical) {
        lastStage = toCanonical;
        lastEntryTime = event.event_at;
      }
    }
  }

  // Build benchmarks for each stage
  const stageOrder = [
    CanonicalStage.SCREEN,
    CanonicalStage.HM_SCREEN,
    CanonicalStage.ONSITE,
    CanonicalStage.OFFER
  ];

  const benchmarks: StageDurationBenchmark[] = [];

  for (const stage of stageOrder) {
    const durations = stageDurations[stage] || [];
    benchmarks.push({
      stage,
      medianDays: median(durations) ?? 7,  // Default 7 days if no data
      p25Days: percentile(durations, 25) ?? 4,
      p75Days: percentile(durations, 75) ?? 14,
      sampleSize: durations.length
    });
  }

  return benchmarks;
}

// ===== GET COHORT BENCHMARK WITH FALLBACK =====

export function getCohortBenchmark(
  roleProfile: RoleProfile,
  benchmarks: ForecastingBenchmarks
): { benchmark: CohortBenchmark; isFallback: boolean; cohortDescription: string } {
  const cohortKey = `${roleProfile.function}|${roleProfile.level}|${roleProfile.locationType}|${roleProfile.jobFamily}`;

  // Try exact cohort match
  if (benchmarks.byCohort[cohortKey] && benchmarks.byCohort[cohortKey].sampleSize >= 3) {
    return {
      benchmark: benchmarks.byCohort[cohortKey],
      isFallback: false,
      cohortDescription: `${roleProfile.function} ${roleProfile.level} ${roleProfile.locationType} ${roleProfile.jobFamily}`
    };
  }

  // Try function + level
  const funcLevelKey = `${roleProfile.function}|${roleProfile.level}`;
  const funcLevelReqs = Object.entries(benchmarks.byCohort)
    .filter(([k]) => k.startsWith(funcLevelKey))
    .flatMap(([, v]) => Array(v.sampleSize).fill(v.medianTTF));

  if (funcLevelReqs.length >= 3) {
    const funcBench = benchmarks.byFunction[roleProfile.function];
    const levelBench = benchmarks.byLevel[roleProfile.level];
    return {
      benchmark: {
        ...benchmarks.global,
        medianTTF: median([funcBench?.medianTTF || 45, levelBench?.medianTTF || 45]) || 45,
        sampleSize: funcLevelReqs.length,
        cohortKey: funcLevelKey
      },
      isFallback: true,
      cohortDescription: `${roleProfile.function} ${roleProfile.level} (partial match)`
    };
  }

  // Try function only
  if (benchmarks.byFunction[roleProfile.function]?.sampleSize >= 3) {
    return {
      benchmark: benchmarks.byFunction[roleProfile.function],
      isFallback: true,
      cohortDescription: `${roleProfile.function} (function average)`
    };
  }

  // Fall back to global
  return {
    benchmark: benchmarks.global,
    isFallback: true,
    cohortDescription: 'All roles (global average)'
  };
}

// ===== TTF PREDICTION =====

export function predictTimeToFill(
  roleProfile: RoleProfile,
  benchmarks: ForecastingBenchmarks,
  hmFriction: HiringManagerFriction[],
  config: DashboardConfig
): TTFPrediction {
  const { benchmark, isFallback, cohortDescription } = getCohortBenchmark(roleProfile, benchmarks);

  // Start with cohort median
  let adjustedMedian = benchmark.medianTTF;
  let adjustedP25 = benchmark.p25TTF;
  let adjustedP75 = benchmark.p75TTF;

  // Apply HM weight adjustment if HM selected
  if (roleProfile.hiringManagerId) {
    const hm = hmFriction.find(h => h.hmId === roleProfile.hiringManagerId);
    if (hm && hm.hmWeight !== 1.0) {
      const hmAdjustment = hm.hmWeight; // >1 = slower, <1 = faster
      adjustedMedian *= hmAdjustment;
      adjustedP25 *= hmAdjustment;
      adjustedP75 *= hmAdjustment;
    }
  }

  // Apply complexity score adjustment
  const complexityScore = calculateRoleComplexity(roleProfile, config);
  if (complexityScore > 1.2) {
    const complexityAdjustment = 1 + (complexityScore - 1) * 0.3; // Dampen effect
    adjustedMedian *= complexityAdjustment;
    adjustedP25 *= complexityAdjustment;
    adjustedP75 *= complexityAdjustment;
  }

  return {
    medianDays: Math.round(adjustedMedian),
    p25Days: Math.round(adjustedP25),
    p75Days: Math.round(adjustedP75),
    confidenceLevel: getConfidenceLevel(benchmark.sampleSize),
    sampleSize: benchmark.sampleSize,
    cohortDescription,
    isFallback
  };
}

function calculateRoleComplexity(roleProfile: RoleProfile, config: DashboardConfig): number {
  const levelWeight = config.levelWeights[roleProfile.level] || 1.0;

  // Get market weight for location type (Remote, Hybrid, Onsite)
  const locationType = roleProfile.locationType as 'Remote' | 'Hybrid' | 'Onsite';
  const marketWeight = (['Remote', 'Hybrid', 'Onsite'].includes(roleProfile.locationType)
    ? config.marketWeights[locationType]
    : 1.0) || 1.0;

  const nicheWeight = config.nicheWeights[roleProfile.jobFamily] || 1.0;

  return levelWeight * marketWeight * nicheWeight;
}

// ===== PIPELINE REQUIREMENTS =====

export function calculatePipelineRequirements(
  roleProfile: RoleProfile,
  benchmarks: ForecastingBenchmarks
): PipelineRequirements {
  const { benchmark, cohortDescription } = getCohortBenchmark(roleProfile, benchmarks);

  // Work backwards from 1 hire
  const stages = [
    { key: CanonicalStage.OFFER, name: 'Offer' },
    { key: CanonicalStage.ONSITE, name: 'Onsite' },
    { key: CanonicalStage.HM_SCREEN, name: 'HM Screen' },
    { key: CanonicalStage.SCREEN, name: 'Screen' }
  ];

  const requirements: PipelineStageRequirement[] = [];
  let neededForNextStage = 1; // Start with 1 hire

  for (const stage of stages) {
    const conversionRate = benchmark.stageConversionRates[stage.key] || 0.5;
    const candidatesNeeded = Math.ceil(neededForNextStage / conversionRate);

    requirements.unshift({
      stage: stage.name,
      candidatesNeeded,
      conversionRateUsed: conversionRate,
      confidenceLevel: getConfidenceLevel(benchmark.sampleSize)
    });

    neededForNextStage = candidatesNeeded;
  }

  return {
    totalCandidatesNeeded: neededForNextStage,
    byStage: requirements,
    assumptions: [
      `Based on ${cohortDescription} historical conversion rates`,
      `Sample size: ${benchmark.sampleSize} hires`
    ]
  };
}

// ===== SOURCE MIX RECOMMENDATION =====

export function recommendSourceMix(
  roleProfile: RoleProfile,
  benchmarks: ForecastingBenchmarks
): SourceMixRecommendation {
  const { benchmark } = getCohortBenchmark(roleProfile, benchmarks);

  const sources = Object.keys(benchmark.sourceHireRates);
  if (sources.length === 0) {
    // Default recommendations
    return {
      recommendations: [
        { source: 'Referral', targetPercentage: 35, historicalHireRate: 0.12, historicalTTF: 32, rationale: 'Highest quality candidates' },
        { source: 'Sourced', targetPercentage: 40, historicalHireRate: 0.08, historicalTTF: 45, rationale: 'Best for volume' },
        { source: 'Inbound', targetPercentage: 15, historicalHireRate: 0.05, historicalTTF: 38, rationale: 'Low effort' },
        { source: 'Agency', targetPercentage: 10, historicalHireRate: 0.15, historicalTTF: 28, rationale: 'Fast but costly' }
      ],
      topRecommendation: 'Referral',
      insights: ['Using default source mix - limited historical data']
    };
  }

  // Score sources by (hire rate * speed factor)
  const scored = sources.map(source => {
    const hireRate = benchmark.sourceHireRates[source] || 0;
    const ttf = benchmark.sourceTTF[source] || 45;
    const speedFactor = 45 / Math.max(ttf, 20); // Normalize to ~45 day baseline
    const score = hireRate * speedFactor;
    return { source, hireRate, ttf, score };
  }).sort((a, b) => b.score - a.score);

  // Calculate optimal mix based on scores
  const totalScore = scored.reduce((sum, s) => sum + s.score, 0) || 1;
  const recommendations: SourceRecommendation[] = scored.map(s => ({
    source: s.source,
    targetPercentage: Math.round((s.score / totalScore) * 100),
    historicalHireRate: s.hireRate,
    historicalTTF: s.ttf,
    rationale: generateSourceRationale(s.source, s.hireRate, s.ttf)
  }));

  return {
    recommendations,
    topRecommendation: recommendations[0]?.source || 'Referral',
    insights: generateSourceInsights(recommendations)
  };
}

function generateSourceRationale(source: string, hireRate: number, ttf: number): string {
  const rateDesc = hireRate >= 0.1 ? 'High conversion' : hireRate >= 0.05 ? 'Moderate conversion' : 'Lower conversion';
  const speedDesc = ttf <= 35 ? 'Fast' : ttf <= 50 ? 'Average speed' : 'Slower';
  return `${rateDesc} (${(hireRate * 100).toFixed(0)}%), ${speedDesc} (${ttf}d avg)`;
}

function generateSourceInsights(recommendations: SourceRecommendation[]): string[] {
  const insights: string[] = [];

  const referral = recommendations.find(r => r.source.toLowerCase().includes('referral'));
  if (referral && referral.historicalHireRate > 0.1) {
    insights.push('Referrals have highest conversion - prioritize employee referral program');
  }

  const fastest = [...recommendations].sort((a, b) => a.historicalTTF - b.historicalTTF)[0];
  if (fastest && fastest.historicalTTF < 35) {
    insights.push(`${fastest.source} is fastest source (${fastest.historicalTTF}d avg)`);
  }

  return insights;
}

// ===== RISK FACTORS =====

export function identifyRiskFactors(
  roleProfile: RoleProfile,
  benchmarks: ForecastingBenchmarks,
  hmFriction: HiringManagerFriction[],
  config: DashboardConfig
): RiskFactor[] {
  const risks: RiskFactor[] = [];

  // Check HM friction
  if (roleProfile.hiringManagerId) {
    const hm = hmFriction.find(h => h.hmId === roleProfile.hiringManagerId);
    if (hm) {
      // High feedback latency
      if (hm.feedbackLatencyMedian && hm.feedbackLatencyMedian > 48) {
        risks.push({
          factor: 'HM Feedback Latency',
          severity: hm.feedbackLatencyMedian > 72 ? 'high' : 'medium',
          impact: `+${Math.round((hm.feedbackLatencyMedian - 24) / 24)} days potential delay`,
          mitigation: 'Set SLA expectations upfront, schedule standing sync',
          dataPoint: `${Math.round(hm.feedbackLatencyMedian)}hr avg vs 24hr benchmark`
        });
      }

      // High decision latency
      if (hm.decisionLatencyMedian && hm.decisionLatencyMedian > 72) {
        risks.push({
          factor: 'HM Decision Latency',
          severity: hm.decisionLatencyMedian > 120 ? 'high' : 'medium',
          impact: `+${Math.round((hm.decisionLatencyMedian - 48) / 24)} days potential delay`,
          mitigation: 'Pre-align on decision criteria, schedule debrief immediately after final',
          dataPoint: `${Math.round(hm.decisionLatencyMedian)}hr avg vs 48hr benchmark`
        });
      }

      // Low offer acceptance
      if (hm.offerAcceptanceRate !== null && hm.offerAcceptanceRate < 0.7) {
        risks.push({
          factor: 'HM Offer Acceptance Rate',
          severity: hm.offerAcceptanceRate < 0.5 ? 'high' : 'medium',
          impact: 'May need more candidates in pipeline',
          mitigation: 'Review comp calibration, improve candidate experience',
          dataPoint: `${Math.round(hm.offerAcceptanceRate * 100)}% acceptance rate`
        });
      }
    }
  }

  // Check complexity factors
  const complexityScore = calculateRoleComplexity(roleProfile, config);
  if (complexityScore > 1.5) {
    risks.push({
      factor: 'High Complexity Role',
      severity: complexityScore > 2.0 ? 'high' : 'medium',
      impact: `Expected ${Math.round((complexityScore - 1) * 30)}% longer TTF`,
      mitigation: 'Prioritize referrals, consider search firm, expand compensation band',
      dataPoint: `Complexity score: ${complexityScore.toFixed(1)}x`
    });
  }

  // Check historical sample size
  const { benchmark } = getCohortBenchmark(roleProfile, benchmarks);
  if (benchmark.sampleSize < 5) {
    risks.push({
      factor: 'Limited Historical Data',
      severity: benchmark.sampleSize < 3 ? 'high' : 'medium',
      impact: 'Predictions may be less accurate',
      mitigation: 'Use broader cohort benchmarks, monitor closely',
      dataPoint: `Only ${benchmark.sampleSize} similar hires in history`
    });
  }

  return risks.sort((a, b) => severityOrder(b.severity) - severityOrder(a.severity));
}

// ===== MILESTONE TIMELINE =====

/**
 * Generate milestone timeline using actual historical stage durations from benchmarks
 */
export function generateMilestoneTimeline(
  ttfPrediction: TTFPrediction,
  stageDurations: StageDurationBenchmark[]
): MilestoneTimeline {
  // Get actual stage durations from historical data
  const getDuration = (stageKey: CanonicalStage) => {
    const found = stageDurations.find(s => s.stage === stageKey);
    return found || { medianDays: 7, p25Days: 4, p75Days: 14, sampleSize: 0 };
  };

  const screenDuration = getDuration(CanonicalStage.SCREEN);
  const hmScreenDuration = getDuration(CanonicalStage.HM_SCREEN);
  const onsiteDuration = getDuration(CanonicalStage.ONSITE);
  const offerDuration = getDuration(CanonicalStage.OFFER);

  // Calculate cumulative timeline using actual historical durations
  // Start with pipeline building - estimate as 20% of first stage duration
  const pipelineDays = Math.max(3, Math.round(screenDuration.medianDays * 0.5));
  const pipelineP25 = Math.max(2, Math.round(screenDuration.p25Days * 0.5));
  const pipelineP75 = Math.max(5, Math.round(screenDuration.p75Days * 0.5));

  let cumulative = pipelineDays;
  let cumulativeP25 = pipelineP25;
  let cumulativeP75 = pipelineP75;

  const pipeline = { target: cumulative, min: cumulativeP25, max: cumulativeP75 };

  cumulative += screenDuration.medianDays;
  cumulativeP25 += screenDuration.p25Days;
  cumulativeP75 += screenDuration.p75Days;
  const screens = { target: cumulative, min: cumulativeP25, max: cumulativeP75 };

  cumulative += hmScreenDuration.medianDays;
  cumulativeP25 += hmScreenDuration.p25Days;
  cumulativeP75 += hmScreenDuration.p75Days;
  const hmInt = { target: cumulative, min: cumulativeP25, max: cumulativeP75 };

  cumulative += onsiteDuration.medianDays;
  cumulativeP25 += onsiteDuration.p25Days;
  cumulativeP75 += onsiteDuration.p75Days;
  const onsite = { target: cumulative, min: cumulativeP25, max: cumulativeP75 };

  cumulative += offerDuration.medianDays;
  cumulativeP25 += offerDuration.p25Days;
  cumulativeP75 += offerDuration.p75Days;
  const offer = { target: cumulative, min: cumulativeP25, max: cumulativeP75 };

  const milestones: MilestoneEvent[] = [
    {
      milestone: 'Pipeline Building',
      targetDay: pipeline.target,
      rangeMin: pipeline.min,
      rangeMax: pipeline.max,
      isCriticalPath: true
    },
    {
      milestone: 'Screens Complete',
      targetDay: screens.target,
      rangeMin: screens.min,
      rangeMax: screens.max,
      isCriticalPath: true
    },
    {
      milestone: 'HM Interviews',
      targetDay: hmInt.target,
      rangeMin: hmInt.min,
      rangeMax: hmInt.max,
      isCriticalPath: true
    },
    {
      milestone: 'Onsite Loop',
      targetDay: onsite.target,
      rangeMin: onsite.min,
      rangeMax: onsite.max,
      isCriticalPath: true
    },
    {
      milestone: 'Offer Extended',
      targetDay: offer.target,
      rangeMin: offer.min,
      rangeMax: offer.max,
      isCriticalPath: true
    },
    {
      milestone: 'Hire Complete',
      targetDay: ttfPrediction.medianDays,
      rangeMin: ttfPrediction.p25Days,
      rangeMax: ttfPrediction.p75Days,
      isCriticalPath: true
    }
  ];

  return {
    milestones,
    totalDays: ttfPrediction.medianDays,
    criticalPathDays: ttfPrediction.medianDays
  };
}

// ===== FULL ROLE FORECAST =====

export function generateRoleForecast(
  roleProfile: RoleProfile,
  requisitions: Requisition[],
  candidates: Candidate[],
  events: Event[],
  users: User[],
  hmFriction: HiringManagerFriction[],
  config: DashboardConfig
): RoleForecast {
  const benchmarks = buildForecastingBenchmarks(
    requisitions, candidates, events, users, hmFriction, config
  );

  const { benchmark } = getCohortBenchmark(roleProfile, benchmarks);
  const ttfPrediction = predictTimeToFill(roleProfile, benchmarks, hmFriction, config);
  const pipelineRequirements = calculatePipelineRequirements(roleProfile, benchmarks);
  const sourceMix = recommendSourceMix(roleProfile, benchmarks);
  const riskFactors = identifyRiskFactors(roleProfile, benchmarks, hmFriction, config);
  const milestoneTimeline = generateMilestoneTimeline(ttfPrediction, benchmark.stageDurations);
  const complexityScore = calculateRoleComplexity(roleProfile, config);

  return {
    roleProfile,
    ttfPrediction,
    pipelineRequirements,
    sourceMix,
    riskFactors,
    milestoneTimeline,
    complexityScore,
    generatedAt: new Date()
  };
}

// ===== ACTIVE ROLE HEALTH =====

export function calculateActiveRoleHealth(
  requisitions: Requisition[],
  candidates: Candidate[],
  events: Event[],
  users: User[],
  hmFriction: HiringManagerFriction[],
  config: DashboardConfig
): RoleHealthMetrics[] {
  const benchmarks = buildForecastingBenchmarks(
    requisitions, candidates, events, users, hmFriction, config
  );

  // More flexible detection of "open" requisitions:
  // 1. Status is explicitly "Open"
  // 2. Status is NOT "Closed" and req has no closed_at date
  // 3. Status contains "open" or "active" (case-insensitive, for different ATS formats)
  const openReqs = requisitions.filter(r => {
    // Explicit Open status
    if (r.status === RequisitionStatus.Open) return true;

    // Status contains "open" or "active" (case-insensitive)
    const statusLower = r.status?.toLowerCase() || '';
    if (statusLower.includes('open') || statusLower === 'active') return true;

    // Not explicitly closed and has no close date - treat as open
    if (r.status !== RequisitionStatus.Closed && !r.closed_at) return true;

    return false;
  });

  return openReqs.map(req => {
    const roleProfile: RoleProfile = {
      function: req.function,
      level: req.level,
      locationType: req.location_type,
      jobFamily: req.job_family,
      hiringManagerId: req.hiring_manager_id
    };

    const { benchmark } = getCohortBenchmark(roleProfile, benchmarks);
    const daysOpen = req.opened_at ? differenceInDays(new Date(), req.opened_at) : 0;
    const reqCandidates = candidates.filter(c => c.req_id === req.req_id);
    const activeCandidates = reqCandidates.filter(c => c.disposition === CandidateDisposition.Active);

    // Calculate velocity
    const reqEvents = events.filter(e => e.req_id === req.req_id);
    const lastActivity = reqEvents.length > 0
      ? new Date(Math.max(...reqEvents.map(e => e.event_at.getTime())))
      : (req.opened_at || new Date());  // Fallback to now if no opened_at
    const daysSinceActivity = differenceInDays(new Date(), lastActivity);

    // Group candidates by stage
    const candidatesByStage: Record<string, number> = {};
    for (const cand of activeCandidates) {
      const canonical = normalizeStage(cand.current_stage, config.stageMapping);
      const stage = canonical || cand.current_stage;
      candidatesByStage[stage] = (candidatesByStage[stage] || 0) + 1;
    }

    // Calculate health metrics
    const paceVsBenchmark = benchmark.medianTTF > 0 ? daysOpen / benchmark.medianTTF : 1;
    const healthScore = calculateHealthScore(daysOpen, activeCandidates.length, daysSinceActivity, benchmark);
    const healthStatus = getHealthStatus(healthScore);

    // Predict fill date
    const remainingDays = Math.max(0, benchmark.medianTTF - daysOpen);
    const predictedFillDate = remainingDays > 0 ? addDays(new Date(), remainingDays) : null;
    const predictedFillDateRange = remainingDays > 0 ? {
      min: addDays(new Date(), Math.max(0, benchmark.p25TTF - daysOpen)),
      max: addDays(new Date(), Math.max(0, benchmark.p75TTF - daysOpen))
    } : null;

    // Identify velocity trend
    const velocityTrend = calculateVelocityTrend(reqEvents, daysSinceActivity);

    // Identify primary issue
    const primaryIssue = identifyPrimaryIssue(activeCandidates, daysSinceActivity, paceVsBenchmark, benchmark);

    // Generate action recommendations
    const actionRecommendations = generateActionRecommendations(
      activeCandidates, daysSinceActivity, paceVsBenchmark, benchmark
    );

    const hm = users.find(u => u.user_id === req.hiring_manager_id);
    const recruiter = users.find(u => u.user_id === req.recruiter_id);

    return {
      reqId: req.req_id,
      reqTitle: req.req_title,
      function: req.function,
      level: req.level,
      jobFamily: req.job_family,
      hiringManagerId: req.hiring_manager_id,
      hiringManagerName: hm?.name || 'Unknown',
      recruiterId: req.recruiter_id,
      recruiterName: recruiter?.name || 'Unknown',
      daysOpen,
      predictedFillDate,
      predictedFillDateRange,
      benchmarkTTF: benchmark.medianTTF,
      paceVsBenchmark,
      currentPipelineDepth: activeCandidates.length,
      benchmarkPipelineDepth: benchmark.medianPipelineDepth,
      pipelineGap: activeCandidates.length - benchmark.medianPipelineDepth,
      candidatesByStage,
      lastActivityDate: lastActivity,
      daysSinceActivity,
      velocityTrend,
      healthStatus,
      healthScore,
      primaryIssue,
      actionRecommendations
    };
  });
}

function calculateHealthScore(
  daysOpen: number,
  pipelineDepth: number,
  daysSinceActivity: number,
  benchmark: CohortBenchmark
): number {
  // Pace score (40%): How far along vs expected
  const expectedProgress = daysOpen / benchmark.medianTTF;
  const paceScore = expectedProgress <= 1
    ? 100 - (expectedProgress * 30) // Gradually decrease as we approach benchmark
    : Math.max(0, 100 - ((expectedProgress - 1) * 100)); // Sharply decrease if over

  // Pipeline score (35%): Pipeline depth vs benchmark
  const pipelineRatio = pipelineDepth / Math.max(benchmark.medianPipelineDepth, 1);
  const pipelineScore = Math.min(100, pipelineRatio * 100);

  // Activity score (25%): Recency of activity
  const activityScore = daysSinceActivity <= 3 ? 100
    : daysSinceActivity <= 7 ? 80
    : daysSinceActivity <= 14 ? 50
    : Math.max(0, 100 - daysSinceActivity * 5);

  return Math.round(paceScore * 0.4 + pipelineScore * 0.35 + activityScore * 0.25);
}

function getHealthStatus(score: number): HealthStatus {
  if (score >= 70) return 'on-track';
  if (score >= 40) return 'at-risk';
  return 'off-track';
}

function calculateVelocityTrend(
  events: Event[],
  daysSinceActivity: number
): 'improving' | 'stable' | 'declining' | 'stalled' {
  if (daysSinceActivity > 14) return 'stalled';
  if (daysSinceActivity > 7) return 'declining';

  // Look at event frequency in last 2 weeks vs prior 2 weeks
  const now = new Date();
  const twoWeeksAgo = addDays(now, -14);
  const fourWeeksAgo = addDays(now, -28);

  const recentEvents = events.filter(e => e.event_at > twoWeeksAgo).length;
  const priorEvents = events.filter(e => e.event_at > fourWeeksAgo && e.event_at <= twoWeeksAgo).length;

  if (recentEvents > priorEvents * 1.2) return 'improving';
  if (recentEvents < priorEvents * 0.8) return 'declining';
  return 'stable';
}

function identifyPrimaryIssue(
  activeCandidates: Candidate[],
  daysSinceActivity: number,
  paceVsBenchmark: number,
  benchmark: CohortBenchmark
): string | null {
  if (daysSinceActivity > 14) {
    return 'Stalled - no activity in 14+ days';
  }

  if (activeCandidates.length < benchmark.medianPipelineDepth * 0.5) {
    return `Pipeline too thin (${activeCandidates.length} vs ${benchmark.medianPipelineDepth} needed)`;
  }

  if (paceVsBenchmark > 1.3) {
    return 'Behind pace - taking longer than similar roles';
  }

  return null;
}

function generateActionRecommendations(
  activeCandidates: Candidate[],
  daysSinceActivity: number,
  paceVsBenchmark: number,
  benchmark: CohortBenchmark
): ActionRecommendation[] {
  const actions: ActionRecommendation[] = [];

  // Pipeline actions
  if (activeCandidates.length < benchmark.medianPipelineDepth * 0.5) {
    const needed = Math.ceil(benchmark.medianPipelineDepth - activeCandidates.length);
    actions.push({
      action: `Source ${needed} more candidates`,
      priority: 'urgent',
      expectedImpact: 'Restore pipeline to healthy level',
      owner: 'recruiter'
    });
  }

  // Activity actions
  if (daysSinceActivity > 7) {
    actions.push({
      action: 'Follow up on pending candidates',
      priority: daysSinceActivity > 14 ? 'urgent' : 'important',
      expectedImpact: 'Restart pipeline momentum',
      owner: 'recruiter'
    });
  }

  // HM alignment actions
  if (paceVsBenchmark > 1.2) {
    actions.push({
      action: 'Schedule HM calibration call',
      priority: 'important',
      expectedImpact: 'Align on requirements, remove blockers',
      owner: 'recruiter'
    });
  }

  return actions;
}
