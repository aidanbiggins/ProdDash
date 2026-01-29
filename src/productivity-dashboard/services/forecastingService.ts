// Forecasting Service - Builds benchmarks, predicts time-to-fill, and runs probabilistic forecasts

import { differenceInDays, addDays } from 'date-fns';
import {
  Requisition,
  Candidate,
  Event,
  User,
  HiringManagerFriction,
  RoleProfile,
  RoleForecast,
  ForecastingBenchmarks,
  CohortBenchmark,
  TTFPrediction,
  PipelineRequirements,
  PipelineStageRequirement,
  SourceMixRecommendation,
  SourceRecommendation,
  RiskFactor,
  MilestoneTimeline,
  MilestoneEvent,
  StageDurationBenchmark,
  ActionRecommendation,
  RoleHealthMetrics,
  HealthStatus,
  CanonicalStage,
  CandidateDisposition,
  RequisitionStatus
} from '../types';
import { DashboardConfig } from '../types/config';
import { normalizeStage } from './stageNormalization';
import {
  runSimulation,
  ForecastInput,
  SimulationParameters,
  ForecastResult,
  DurationDistribution,
  shrinkRate
} from './probabilisticEngine';

// Helper functions
function severityOrder(severity: 'high' | 'medium' | 'low'): number {
  return severity === 'high' ? 3 : severity === 'medium' ? 2 : 1;
}

function getConfidenceLevel(sampleSize: number): 'high' | 'medium' | 'low' {
  if (sampleSize >= 20) return 'high';
  if (sampleSize >= 10) return 'medium';
  return 'low';
}

// ===== TIME-TO-FILL PREDICTION =====

export function predictTimeToFill(
  roleProfile: RoleProfile,
  benchmarks: ForecastingBenchmarks,
  hmFriction: HiringManagerFriction[],
  config: DashboardConfig
): TTFPrediction {
  const { benchmark, cohortDescription } = getCohortBenchmark(roleProfile, benchmarks);

  // Base prediction from benchmark
  let medianDays = benchmark.medianTTF;
  let p25Days = benchmark.p25TTF;
  let p75Days = benchmark.p75TTF;

  // Apply complexity adjustments
  const complexity = calculateRoleComplexity(roleProfile, config);
  medianDays = Math.round(medianDays * complexity);
  p25Days = Math.round(p25Days * complexity);
  p75Days = Math.round(p75Days * complexity);

  // Apply HM friction if known
  if (roleProfile.hiringManagerId) {
    const hm = hmFriction.find(h => h.hmId === roleProfile.hiringManagerId);
    if (hm && hm.hmWeight) {
      medianDays = Math.round(medianDays * hm.hmWeight);
      p25Days = Math.round(p25Days * hm.hmWeight);
      p75Days = Math.round(p75Days * hm.hmWeight);
    }
  }

  return {
    medianDays,
    p25Days,
    p75Days,
    confidenceLevel: getConfidenceLevel(benchmark.sampleSize),
    sampleSize: benchmark.sampleSize,
    cohortDescription: cohortDescription,
    isFallback: benchmark.sampleSize < 5
  };
}


// ===== PROBABILISTIC FORECASTING =====

// Worker instance (lazy loaded)
let forecastingWorker: Worker | null = null;

function getForecastingWorker(): Worker {
  if (!forecastingWorker) {
    // Initialize worker
    forecastingWorker = new Worker(new URL('../workers/forecasting.worker.ts', import.meta.url));
  }
  return forecastingWorker;
}

/**
 * Run a probabilistic forecast using Monte Carlo simulation
 */
export async function generateProbabilisticForecast(
  roleProfile: RoleProfile,
  benchmarks: ForecastingBenchmarks,
  config: DashboardConfig,
  currentPipeline: Candidate[], // Candidates currently in funnel
  startDate: Date = new Date()
): Promise<ForecastResult> {
  // 1. Prepare Simulation Parameters
  const params = prepareSimulationParameters(roleProfile, benchmarks, config);

  // 2. Prepare Inputs (Candidates)
  // We simulate "Lead Inflow" as new candidates at SCREEN stage if needed, 
  // but for v1 we only simulate current pipeline.
  const inputs: ForecastInput[] = currentPipeline.map(c => ({
    currentStage: normalizeStage(c.current_stage, config.stageMapping) || CanonicalStage.SCREEN,
    startDate: startDate,
    seed: `${c.candidate_id}-${startDate.getTime()}` // Deterministic seed per candidate
  })).filter(i =>
    i.currentStage !== CanonicalStage.HIRED &&
    i.currentStage !== CanonicalStage.REJECTED &&
    i.currentStage !== CanonicalStage.WITHDREW
  );

  if (inputs.length === 0) {
    // Edge case: Empty pipeline - return far future date with LOW confidence
    // IMPORTANT: Never return iterations: 0 - always show what iterations WOULD be used
    const farFuture = new Date(startDate);
    farFuture.setFullYear(farFuture.getFullYear() + 1);
    return {
      p10Date: farFuture,
      p50Date: farFuture,
      p90Date: farFuture,
      simulatedDays: [],
      confidenceLevel: 'LOW',
      debug: { iterations: 1000, seed: 'empty-pipeline' }
    };
  }

  // 3. Run in Worker
  return new Promise((resolve, reject) => {
    const worker = getForecastingWorker();
    const id = Math.random().toString(36).substring(7);

    const handler = (event: MessageEvent) => {
      if (event.data.id === id) {
        worker.removeEventListener('message', handler);

        if (event.data.error) {
          reject(new Error(event.data.error));
        } else {
          // Worker returns array of results (one per candidate)
          // We need to aggregate them to find the "Hire Date" for the Role
          // For a single hire, it's the MIN date of all successful candidates
          const results = event.data.results as (ForecastResult | null)[];
          const combined = aggregateCandidateForecasts(results, startDate);
          resolve(combined);
        }
      }
    };

    worker.addEventListener('message', handler);
    worker.postMessage({ id, inputs, params });
  });
}

/**
 * Aggregate individual candidate simulations into a role forecast
 * Logic: One role fill = The FIRST candidate to get hired
 */
function aggregateCandidateForecasts(
  results: (ForecastResult | null)[],
  startDate: Date
): ForecastResult {
  // Collect all simulated "days to hire" across all iterations
  // This is tricky: we ran X iterations for EACH candidate.
  // We need to slice "Iteration 1" across all candidates and pick the winner.

  // Assuming worker ran same # of iterations for each
  const iterations = results[0]?.debug.iterations || 1000;
  const roleOutcomeDays: number[] = [];

  for (let i = 0; i < iterations; i++) {
    // For this iteration `i`, find the minimum days-to-hire across all candidates
    let minDays = Infinity;

    for (const res of results) {
      if (res && res.simulatedDays[i] !== undefined) {
        // If this candidate was hired in this iteration
        if (res.simulatedDays[i] < minDays) {
          minDays = res.simulatedDays[i];
        }
      }
    }

    if (minDays !== Infinity) {
      roleOutcomeDays.push(minDays);
    }
  }

  // Calculate percentiles
  roleOutcomeDays.sort((a, b) => a - b);

  if (roleOutcomeDays.length === 0) {
    const dummy = new Date(startDate);
    dummy.setDate(dummy.getDate() + 365);
    return {
      p10Date: dummy, p50Date: dummy, p90Date: dummy,
      simulatedDays: [], confidenceLevel: 'LOW', debug: { iterations, seed: 'agg' }
    };
  }

  return {
    p10Date: addDays(startDate, roleOutcomeDays[Math.floor(roleOutcomeDays.length * 0.1)]),
    p50Date: addDays(startDate, roleOutcomeDays[Math.floor(roleOutcomeDays.length * 0.5)]),
    p90Date: addDays(startDate, roleOutcomeDays[Math.floor(roleOutcomeDays.length * 0.9)]),
    simulatedDays: roleOutcomeDays,
    confidenceLevel: 'MEDIUM', // TODO: Aggregate confidence from inputs
    debug: { iterations, seed: 'aggregated' }
  };
}


/**
 * Prepare simulation parameters with Bayesian shrinkage
 * Exported for What-If analysis in OracleConfidenceWidget
 */
export function prepareSimulationParameters(
  roleProfile: RoleProfile,
  benchmarks: ForecastingBenchmarks,
  config: DashboardConfig
): SimulationParameters {
  const { benchmark } = getCohortBenchmark(roleProfile, benchmarks);

  // Prior: Global Averages (most stable)
  const priorRates = benchmarks.global.stageConversionRates;
  const priorDurations = benchmarks.global.stageDurations;

  // Obsidian: Shrink rates
  const stages = [CanonicalStage.SCREEN, CanonicalStage.HM_SCREEN, CanonicalStage.ONSITE, CanonicalStage.OFFER];
  const shrunkRates: Record<string, number> = {};
  const shrunkDurations: Record<string, DurationDistribution> = {};
  const sampleSizes: Record<string, number> = {};

  for (const stage of stages) {
    // 1. Rates
    const obsRate = benchmark.stageConversionRates[stage];
    // n for rates isn't explicitly stored in benchmark, using generic sampleSize
    // In v1.1 we should store n per stage transition
    const n = benchmark.sampleSize;

    shrunkRates[stage] = shrinkRate(obsRate, priorRates[stage] || 0.5, n);
    sampleSizes[`${stage}_rate`] = n;

    // 2. Durations (Empirical -> Lognormal -> Global)
    const stageBench = benchmark.stageDurations.find(s => s.stage === stage);
    const globalStageBench = priorDurations.find(s => s.stage === stage);

    // We assume 7 days default if missing
    const obsMedian = stageBench?.medianDays || 7;
    const globalMedian = globalStageBench?.medianDays || 7;

    // Construct distribution
    // Ideally we'd pass full buckets, but benchmarks only have quartiles currently.
    // We will simulate a lognormal distribution fitting the quartiles.
    // NOTE: In v1.1 we will load raw snapshot diffs to get true empirical buckets.

    if (n > 5 && stageBench) {
      // Fit Log-Normal: estimated from median and p75
      // mu = ln(median)
      // p75 corresponds to z=0.674 roughly
      // ln(p75) = mu + sigma * 0.674 => sigma = (ln(p75) - mu) / 0.674
      const mu = Math.log(Math.max(1, stageBench.medianDays));
      const sigmaHat = (Math.log(Math.max(1, stageBench.p75Days)) - mu) / 0.674;

      shrunkDurations[stage] = {
        type: 'lognormal',
        mu: mu,
        sigma: Math.max(0.1, sigmaHat) // Clamp sigma
      };
    } else {
      // Fallback to global constant or tighter lognormal
      shrunkDurations[stage] = {
        type: 'constant',
        days: globalMedian
      };
    }
  }

  return {
    stageConversionRates: shrunkRates,
    stageDurations: shrunkDurations,
    sampleSizes
  };
}

// ... (keep rest of file)


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
    // STRICT: null opened_at means insufficient data - don't fabricate with 0
    const daysOpen = req.opened_at ? differenceInDays(new Date(), req.opened_at) : null;
    const reqCandidates = candidates.filter(c => c.req_id === req.req_id);
    const activeCandidates = reqCandidates.filter(c => c.disposition === CandidateDisposition.Active);

    // Calculate velocity
    const reqEvents = events.filter(e => e.req_id === req.req_id);
    // STRICT: Use actual last activity, or opened_at. If neither exists, lastActivity is null (insufficient data)
    const lastActivity = reqEvents.length > 0
      ? new Date(Math.max(...reqEvents.map(e => e.event_at.getTime())))
      : req.opened_at;  // null if no opened_at - indicates insufficient data
    const daysSinceActivity = lastActivity ? differenceInDays(new Date(), lastActivity) : null;

    // Group candidates by stage
    const candidatesByStage: Record<string, number> = {};
    for (const cand of activeCandidates) {
      const canonical = normalizeStage(cand.current_stage, config.stageMapping);
      const stage = canonical || cand.current_stage;
      candidatesByStage[stage] = (candidatesByStage[stage] || 0) + 1;
    }

    // Calculate health metrics
    // STRICT: If daysOpen is null (missing opened_at), set paceVsBenchmark to null (insufficient data)
    const paceVsBenchmark = daysOpen !== null && benchmark.medianTTF > 0 ? daysOpen / benchmark.medianTTF : null;
    const healthScore = calculateHealthScore(daysOpen, activeCandidates.length, daysSinceActivity, benchmark);
    const healthStatus = getHealthStatus(healthScore);

    // Predict fill date - STRICT: if daysOpen is null, cannot predict
    const remainingDays = daysOpen !== null ? Math.max(0, benchmark.medianTTF - daysOpen) : null;
    const predictedFillDate = remainingDays !== null && remainingDays > 0 ? addDays(new Date(), remainingDays) : null;
    const predictedFillDateRange = remainingDays !== null && remainingDays > 0 && daysOpen !== null ? {
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
  daysOpen: number | null,
  pipelineDepth: number,
  daysSinceActivity: number | null,
  benchmark: CohortBenchmark
): number {
  // STRICT: If we don't have daysOpen, we can't calculate pace properly - use neutral score
  let paceScore = 50; // Neutral default for insufficient data
  if (daysOpen !== null && benchmark.medianTTF > 0) {
    // Pace score (40%): How far along vs expected
    const expectedProgress = daysOpen / benchmark.medianTTF;
    paceScore = expectedProgress <= 1
      ? 100 - (expectedProgress * 30) // Gradually decrease as we approach benchmark
      : Math.max(0, 100 - ((expectedProgress - 1) * 100)); // Sharply decrease if over
  }

  // Pipeline score (35%): Pipeline depth vs benchmark
  const pipelineRatio = pipelineDepth / Math.max(benchmark.medianPipelineDepth, 1);
  const pipelineScore = Math.min(100, pipelineRatio * 100);

  // STRICT: If we don't have daysSinceActivity, use neutral score
  let activityScore = 50; // Neutral default for insufficient data
  if (daysSinceActivity !== null) {
    // Activity score (25%): Recency of activity
    activityScore = daysSinceActivity <= 3 ? 100
      : daysSinceActivity <= 7 ? 80
        : daysSinceActivity <= 14 ? 50
          : Math.max(0, 100 - daysSinceActivity * 5);
  }

  return Math.round(paceScore * 0.4 + pipelineScore * 0.35 + activityScore * 0.25);
}

function getHealthStatus(score: number): HealthStatus {
  if (score >= 70) return 'on-track';
  if (score >= 40) return 'at-risk';
  return 'off-track';
}

function calculateVelocityTrend(
  events: Event[],
  daysSinceActivity: number | null
): 'improving' | 'stable' | 'declining' | 'stalled' {
  // STRICT: If we don't have activity data, we can't determine trend
  if (daysSinceActivity === null) return 'stable'; // Return neutral when insufficient data
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
  daysSinceActivity: number | null,
  paceVsBenchmark: number | null,
  benchmark: CohortBenchmark
): string | null {
  // STRICT: Only check daysSinceActivity if we have valid data
  if (daysSinceActivity !== null && daysSinceActivity > 14) {
    return 'Stalled - no activity in 14+ days';
  }

  if (activeCandidates.length < benchmark.medianPipelineDepth * 0.5) {
    return `Pipeline too thin (${activeCandidates.length} vs ${benchmark.medianPipelineDepth} needed)`;
  }

  // STRICT: Only check paceVsBenchmark if we have valid data
  if (paceVsBenchmark !== null && paceVsBenchmark > 1.3) {
    return 'Behind pace - taking longer than similar roles';
  }

  return null;
}

function generateActionRecommendations(
  activeCandidates: Candidate[],
  daysSinceActivity: number | null,
  paceVsBenchmark: number | null,
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

  // Activity actions - STRICT: only if we have valid daysSinceActivity
  if (daysSinceActivity !== null && daysSinceActivity > 7) {
    actions.push({
      action: 'Follow up on pending candidates',
      priority: daysSinceActivity > 14 ? 'urgent' : 'important',
      expectedImpact: 'Restart pipeline momentum',
      owner: 'recruiter'
    });
  }

  // HM alignment actions - STRICT: only if we have valid paceVsBenchmark
  if (paceVsBenchmark !== null && paceVsBenchmark > 1.2) {
    actions.push({
      action: 'Schedule HM calibration call',
      priority: 'important',
      expectedImpact: 'Align on requirements, remove blockers',
      owner: 'recruiter'
    });
  }

  return actions;
}

// ===== HELPER FUNCTIONS (Restored) =====

function groupBy<T>(items: T[], keyFn: (item: T) => string): Record<string, T[]> {
  const result: Record<string, T[]> = {};
  for (const item of items) {
    const key = keyFn(item);
    if (!result[key]) result[key] = [];
    result[key].push(item);
  }
  return result;
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

    // Build Histogram (Buckets of 1 day)
    // We limit to 0-120 days for histogram to avoid outliers blowing up the view
    const histogramMap = new Map<number, number>();
    for (const d of durations) {
      if (d >= 0 && d <= 120) {
        const bucket = Math.round(d);
        histogramMap.set(bucket, (histogramMap.get(bucket) || 0) + 1);
      }
    }
    const histogram: { days: number; count: number }[] = [];
    histogramMap.forEach((count, days) => histogram.push({ days, count }));
    histogram.sort((a, b) => a.days - b.days);

    benchmarks.push({
      stage,
      medianDays: median(durations) ?? 7,  // Default 7 days if no data
      p25Days: percentile(durations, 25) ?? 4,
      p75Days: percentile(durations, 75) ?? 14,
      sampleSize: durations.length,
      histogram
    });
  }

  return benchmarks;
}

function median(values: number[]): number | undefined {
  if (values.length === 0) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

function percentile(values: number[], p: number): number | undefined {
  if (values.length === 0) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const index = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;
  if (lower === upper) return sorted[index];
  return (1 - weight) * sorted[lower] + weight * sorted[upper];
}

export function getCohortBenchmark(
  roleProfile: RoleProfile,
  benchmarks: ForecastingBenchmarks
): { benchmark: CohortBenchmark; cohortDescription: string } {
  // 1. Try Function + Level (Most Specific)
  const funcLevelKey = `${roleProfile.function}:${roleProfile.level}`;
  if (benchmarks.byFunction[funcLevelKey]) { // Ideally byFunctionLevel but using flat structure for now
    // Fallback to simpler lookups if needed
  }

  // Real implementation of hierarchy:
  // 1. Specific Function Benchmark
  if (benchmarks.byFunction[roleProfile.function] && benchmarks.byFunction[roleProfile.function].sampleSize >= 5) {
    return { benchmark: benchmarks.byFunction[roleProfile.function], cohortDescription: `similar ${roleProfile.function} roles` };
  }

  // 2. Family Benchmark
  if (benchmarks.byJobFamily[roleProfile.jobFamily] && benchmarks.byJobFamily[roleProfile.jobFamily].sampleSize >= 5) {
    return { benchmark: benchmarks.byJobFamily[roleProfile.jobFamily], cohortDescription: `${roleProfile.jobFamily} roles` };
  }

  // 3. Level Benchmark (weak signal but better than global)
  if (benchmarks.byLevel[roleProfile.level] && benchmarks.byLevel[roleProfile.level].sampleSize >= 10) {
    return { benchmark: benchmarks.byLevel[roleProfile.level], cohortDescription: `${roleProfile.level} level roles` };
  }

  // 4. Global Fallback
  return { benchmark: benchmarks.global, cohortDescription: 'all roles (global average)' };
}

export function buildForecastingBenchmarks(
  requisitions: Requisition[],
  candidates: Candidate[],
  events: Event[],
  users: User[],
  hmFriction: HiringManagerFriction[],
  config: DashboardConfig
): ForecastingBenchmarks {

  // Helper to build a single benchmark from a set of reqs/candidates
  const buildBenchmark = (
    subsetReqs: Requisition[],
    subsetCandidates: Candidate[],
    subsetEvents: Event[],
    cohortKey: string = 'global'
  ): CohortBenchmark => {
    const closedReqs = subsetReqs.filter(r => r.status === 'Closed' && r.closed_at);
    const completedCandidates = subsetCandidates.filter(c => c.disposition === 'Hired');

    // TTFs
    const ttfs = closedReqs
      .map(r => r.closed_at && r.opened_at ? differenceInDays(r.closed_at, r.opened_at) : 0)
      .filter(d => d > 0).sort((a, b) => a - b);

    // Pipeline Depth
    const depths = closedReqs.map(r =>
      subsetCandidates.filter(c => c.req_id === r.req_id && c.disposition === 'Hired').length +
      subsetCandidates.filter(c => c.req_id === r.req_id && c.disposition === 'Rejected').length
    ).sort((a, b) => a - b);

    const sourceStats = calculateSourceStats(completedCandidates);
    const stageRates = calculateStageConversionRates(subsetCandidates, subsetEvents, config);
    const stageDurations = calculateStageDurations(subsetEvents, subsetCandidates, config);

    return {
      cohortKey,
      sampleSize: closedReqs.length,
      medianTTF: median(ttfs) || 45,
      p25TTF: percentile(ttfs, 25) || 30,
      p75TTF: percentile(ttfs, 75) || 60,
      medianPipelineDepth: median(depths) || 20,
      stageConversionRates: stageRates,
      sourceHireRates: sourceStats.hireRates,
      sourceTTF: sourceStats.ttfs,
      stageDurations: stageDurations
    };
  };

  // 1. Global Benchmark
  const globalBenchmark = buildBenchmark(requisitions, candidates, events);

  // 2. By Function
  const byFunction: Record<string, CohortBenchmark> = {};
  const functions = new Set(requisitions.map(r => r.function).filter(Boolean));
  functions.forEach(f => {
    const reqs = requisitions.filter(r => r.function === f);
    const reqIds = new Set(reqs.map(r => r.req_id));
    const cands = candidates.filter(c => reqIds.has(c.req_id));
    const evts = events.filter(e => reqIds.has(e.req_id));
    byFunction[f] = buildBenchmark(reqs, cands, evts, `function:${f}`);
  });

  // 3. By Level
  const byLevel: Record<string, CohortBenchmark> = {};
  const levels = new Set(requisitions.map(r => r.level).filter(Boolean));
  levels.forEach(l => {
    const reqs = requisitions.filter(r => r.level === l);
    const reqIds = new Set(reqs.map(r => r.req_id));
    const cands = candidates.filter(c => reqIds.has(c.req_id));
    const evts = events.filter(e => reqIds.has(e.req_id));
    byLevel[l] = buildBenchmark(reqs, cands, evts, `level:${l}`);
  });

  // 4. By Job Family
  const byJobFamily: Record<string, CohortBenchmark> = {};
  const families = new Set(requisitions.map(r => r.job_family).filter(Boolean));
  families.forEach(f => {
    const reqs = requisitions.filter(r => r.job_family === f);
    const reqIds = new Set(reqs.map(r => r.req_id));
    const cands = candidates.filter(c => reqIds.has(c.req_id));
    const evts = events.filter(e => reqIds.has(e.req_id));
    byJobFamily[f] = buildBenchmark(reqs, cands, evts, `family:${f}`);
  });

  // 5. By Location Type
  const byLocationType: Record<string, CohortBenchmark> = {};
  const types = new Set(requisitions.map(r => r.location_type).filter(Boolean));
  types.forEach(t => {
    const reqs = requisitions.filter(r => r.location_type === t);
    const reqIds = new Set(reqs.map(r => r.req_id));
    const cands = candidates.filter(c => reqIds.has(c.req_id));
    const evts = events.filter(e => reqIds.has(e.req_id));
    byLocationType[t] = buildBenchmark(reqs, cands, evts, `location:${t}`);
  });

  return {
    global: globalBenchmark,
    byFunction,
    byLevel,
    byJobFamily,
    byLocationType,
    byCohort: {}, // TODO: Full cohort combinations
    byHM: {}      // TODO: HM-specific benchmarks
  };
}
