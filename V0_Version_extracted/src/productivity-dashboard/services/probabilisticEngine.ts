/**
 * Probabilistic Forecasting Engine ("The Oracle")
 *
 * Runs Monte Carlo simulations to project hiring outcomes with confidence intervals.
 *
 * Core Features:
 * 1. Seeded RNG for determinism (reproducible forecasts)
 * 2. Bayesian Shrinkage for small sample sizes
 * 3. Empirical Duration Distributions (handling "fat tail" delays)
 */

import seedrandom from 'seedrandom';
import { CanonicalStage } from '../types';

export interface ForecastInput {
    currentStage: CanonicalStage;
    startDate: Date;
    seed?: string;
    iterations?: number;
}

export interface SimulationParameters {
    stageConversionRates: Record<string, number>;
    stageDurations: Record<string, DurationDistribution>;
    sampleSizes: Record<string, number>; // For confidence/shrinkage
}

export interface DurationDistribution {
    type: 'empirical' | 'lognormal' | 'constant';
    // For empirical: bucketed days and probabilities
    buckets?: { days: number; probability: number }[];
    // For lognormal:
    mu?: number;
    sigma?: number;
    // For constant (fallback):
    days?: number;
}

export interface ForecastResult {
    p10Date: Date;
    p50Date: Date;
    p90Date: Date;
    simulatedDays: number[]; // Full distribution for histograms
    confidenceLevel: 'HIGH' | 'MEDIUM' | 'LOW';
    debug: {
        iterations: number;
        seed: string;
    };
}

// Stage order for simulation
const STAGE_ORDER = [
    CanonicalStage.SCREEN,
    CanonicalStage.HM_SCREEN,
    CanonicalStage.ONSITE,
    CanonicalStage.OFFER,
    CanonicalStage.HIRED
];

/**
 * Run Monte Carlo simulation for a single candidate journey
 */
export function runSimulation(
    input: ForecastInput,
    params: SimulationParameters
): ForecastResult {
    const iterations = input.iterations || 1000;
    // Use seeded RNG if provided, or randomly generated seed if not
    // IMPORTANT: For UI stability, we should almost always provide a seed derived from the Req ID + Date
    const seed = input.seed || Math.random().toString(36).substring(7);
    const rng = seedrandom(seed);

    const simulatedDays: number[] = [];

    for (let i = 0; i < iterations; i++) {
        const days = simulateCandidateJourney(input.currentStage, params, rng);
        if (days !== null) {
            simulatedDays.push(days);
        }
    }

    // If we have very few successes (e.g. low conversion rates), we might get empty array
    // In that case, we return a "failed" result or max safe integer
    if (simulatedDays.length === 0) {
        const dummyDate = new Date(input.startDate);
        dummyDate.setDate(dummyDate.getDate() + 365); // 1 year out fallback
        return {
            p10Date: dummyDate,
            p50Date: dummyDate,
            p90Date: dummyDate,
            simulatedDays: [],
            confidenceLevel: 'LOW',
            debug: { iterations, seed }
        };
    }

    simulatedDays.sort((a, b) => a - b);

    const p10Index = Math.floor(simulatedDays.length * 0.1);
    const p50Index = Math.floor(simulatedDays.length * 0.5);
    const p90Index = Math.floor(simulatedDays.length * 0.9);

    return {
        p10Date: addDaysToDate(input.startDate, simulatedDays[p10Index]),
        p50Date: addDaysToDate(input.startDate, simulatedDays[p50Index]),
        p90Date: addDaysToDate(input.startDate, simulatedDays[p90Index]),
        simulatedDays,
        confidenceLevel: calculateConfidenceLevel(params.sampleSizes),
        debug: { iterations, seed }
    };
}

/**
 * Simulate one candidate walking through the funnel
 * Returns total days to hire, or NULL if candidate falls out
 */
function simulateCandidateJourney(
    startStage: CanonicalStage,
    params: SimulationParameters,
    rng: seedrandom.PRNG
): number | null {
    let daysElapsed = 0;
    let currentStageIndex = STAGE_ORDER.indexOf(startStage);

    // If stage not found (e.g. they are already Hired or Rejected), handle edge case
    if (currentStageIndex === -1) {
        if (startStage === CanonicalStage.HIRED) return 0;
        return null; // Already out
    }

    // Iterate through remaining stages
    for (let i = currentStageIndex; i < STAGE_ORDER.length - 1; i++) {
        const currentStageName = STAGE_ORDER[i];
        const nextStageName = STAGE_ORDER[i + 1];

        // 1. Simulate Stage Duration
        const duration = sampleDuration(params.stageDurations[currentStageName], rng);
        daysElapsed += duration;

        // 2. Simulate Conversion (Pass/Fail)
        // We apply shrinkage to the rate before this function is called, so we just use the rate here
        const passRate = params.stageConversionRates[currentStageName] || 0.5;

        // Roll the dice
        if (rng() > passRate) {
            return null; // Candidate rejected/withdrew
        }

        // Candidate advances to next stage
    }

    // If we got here, candidate is Hired
    return daysElapsed;
}

/**
 * Sample a duration from the distribution
 */
function sampleDuration(dist: DurationDistribution | undefined, rng: seedrandom.PRNG): number {
    if (!dist) return 7; // Default 1 week fallback

    if (dist.type === 'constant') {
        return dist.days || 7;
    }

    if (dist.type === 'lognormal') {
        // Generate log-normal sample using Box-Muller transform
        // u, v are uniform(0,1)
        const u = 1.0 - rng(); // avoiding 0
        const v = 1.0 - rng();
        const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);

        // Result is e^(mu + sigma*z)
        return Math.exp((dist.mu || 0) + (dist.sigma || 1) * z);
    }

    if (dist.type === 'empirical' && dist.buckets && dist.buckets.length > 0) {
        // Inverse transform sampling on buckets
        // This assumes buckets are discrete PMF
        const r = rng();
        let cumulative = 0;
        for (const bucket of dist.buckets) {
            cumulative += bucket.probability;
            if (r <= cumulative) {
                return bucket.days;
            }
        }
        return dist.buckets[dist.buckets.length - 1].days;
    }

    return 7;
}

/**
 * Helper to add days to a date
 */
function addDaysToDate(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + Math.round(days));
    return result;
}

/**
 * Estimate global confidence based on data richness
 */
function calculateConfidenceLevel(sampleSizes: Record<string, number>): 'HIGH' | 'MEDIUM' | 'LOW' {
    const sizes = Object.values(sampleSizes);
    if (sizes.length === 0) return 'LOW';

    const avgSize = sizes.reduce((sum, n) => sum + n, 0) / sizes.length;
    const minSize = Math.min(...sizes);

    if (minSize >= 15) return 'HIGH';
    if (minSize >= 5) return 'MEDIUM';
    return 'LOW';
}

/**
 * Empirical Bayes Shrinkage
 * Pulls an observed rate towards a prior based on sample size
 */
export function shrinkRate(
    observedRate: number,
    priorRate: number,
    n: number,
    priorWeight: number = 5
): number {
    if (n === 0) return priorRate;
    // Weighted average: (n*obs + m*prior) / (n+m)
    return (n * observedRate + priorWeight * priorRate) / (n + priorWeight);
}

/**
 * Pipeline-Aware Simulation for What-If Analysis
 *
 * This runs a Monte Carlo simulation that answers: "When will this req be filled
 * given the current pipeline of candidates?"
 *
 * Key difference from single-candidate simulation:
 * - Pass rates DIRECTLY affect time-to-fill because lower rates mean fewer
 *   candidates succeed, extending the expected time to get ANY hire
 * - We simulate all candidates in parallel and take the FIRST success
 *
 * This makes the What-If sliders defensible:
 * - Higher pass rates → More candidates likely to succeed → Faster fill
 * - Lower pass rates → Fewer candidates succeed → Longer wait
 *
 * @param pipelineCandidates Array of candidates with their current stages
 * @param params Simulation parameters (conversion rates, durations)
 * @param seed RNG seed for determinism
 * @param iterations Number of Monte Carlo iterations (default 1000)
 */
export interface PipelineCandidate {
    candidateId: string;
    currentStage: CanonicalStage;
}

export function runPipelineSimulation(
    pipelineCandidates: PipelineCandidate[],
    params: SimulationParameters,
    startDate: Date,
    seed: string,
    iterations: number = 1000
): ForecastResult {
    const rng = seedrandom(seed);

    // Track outcomes: for each iteration, what's the time to FIRST hire?
    const firstHireDays: number[] = [];

    // Edge case: empty pipeline
    if (pipelineCandidates.length === 0) {
        const dummyDate = new Date(startDate);
        dummyDate.setDate(dummyDate.getDate() + 365);
        return {
            p10Date: dummyDate,
            p50Date: dummyDate,
            p90Date: dummyDate,
            simulatedDays: [],
            confidenceLevel: 'LOW',
            debug: { iterations, seed }
        };
    }

    // Filter to only active candidates (not already hired/rejected)
    const activeCandidates = pipelineCandidates.filter(c =>
        c.currentStage !== CanonicalStage.HIRED &&
        c.currentStage !== CanonicalStage.REJECTED &&
        c.currentStage !== CanonicalStage.WITHDREW
    );

    if (activeCandidates.length === 0) {
        const dummyDate = new Date(startDate);
        dummyDate.setDate(dummyDate.getDate() + 365);
        return {
            p10Date: dummyDate,
            p50Date: dummyDate,
            p90Date: dummyDate,
            simulatedDays: [],
            confidenceLevel: 'LOW',
            debug: { iterations, seed }
        };
    }

    for (let i = 0; i < iterations; i++) {
        let minHireDays = Infinity;

        // Simulate each candidate in parallel
        for (const cand of activeCandidates) {
            const days = simulateCandidateJourney(cand.currentStage, params, rng);
            if (days !== null && days < minHireDays) {
                minHireDays = days;
            }
        }

        // If at least one candidate was hired, record the time
        if (minHireDays !== Infinity) {
            firstHireDays.push(minHireDays);
        }
        // If NO candidate was hired in this iteration, we DON'T add anything
        // This represents a "failed" fill - pipeline exhausted without a hire
    }

    // Calculate percentiles
    if (firstHireDays.length === 0) {
        // No successful fills in any iteration - very low conversion rates
        const dummyDate = new Date(startDate);
        dummyDate.setDate(dummyDate.getDate() + 365);
        return {
            p10Date: dummyDate,
            p50Date: dummyDate,
            p90Date: dummyDate,
            simulatedDays: [],
            confidenceLevel: 'LOW',
            debug: { iterations, seed }
        };
    }

    firstHireDays.sort((a, b) => a - b);

    const p10Index = Math.floor(firstHireDays.length * 0.1);
    const p50Index = Math.floor(firstHireDays.length * 0.5);
    const p90Index = Math.floor(firstHireDays.length * 0.9);

    // Calculate confidence based on success rate
    const successRate = firstHireDays.length / iterations;
    let confidenceLevel: 'HIGH' | 'MEDIUM' | 'LOW';
    if (successRate >= 0.8) {
        confidenceLevel = calculateConfidenceLevel(params.sampleSizes);
    } else if (successRate >= 0.5) {
        confidenceLevel = 'MEDIUM';
    } else {
        confidenceLevel = 'LOW';
    }

    return {
        p10Date: addDaysToDate(startDate, firstHireDays[p10Index]),
        p50Date: addDaysToDate(startDate, firstHireDays[p50Index]),
        p90Date: addDaysToDate(startDate, firstHireDays[p90Index]),
        simulatedDays: firstHireDays,
        confidenceLevel,
        debug: { iterations, seed }
    };
}

// ============================================
// CAPACITY-AWARE FORECAST
// ============================================

import {
    OracleCapacityProfile,
    OracleCapacityAwareForecastResult,
    OraclePipelineByStage,
    ConfidenceLevel
} from '../types/capacityTypes';
import { applyCapacityPenalty, createCapacityAdjustedParams } from './capacityPenaltyModel';

/**
 * Run capacity-aware forecast that shows both pipeline-only and capacity-aware results
 *
 * This is the main entry point for the Oracle's capacity-aware mode.
 * It runs two parallel simulations:
 * 1. Pipeline-only: Pure statistical model (pass rates + durations)
 * 2. Capacity-aware: Adds queue delays based on capacity constraints
 *
 * @param pipelineCandidates Candidates in the pipeline with their stages
 * @param pipelineByStage Count of candidates at each stage
 * @param params Base simulation parameters (rates, durations)
 * @param capacityProfile Inferred capacity profile
 * @param startDate Forecast start date
 * @param seed RNG seed for determinism
 * @param iterations Number of Monte Carlo iterations
 * @param targetDate Optional target date for probability calculation
 */
export function runCapacityAwareForecast(
    pipelineCandidates: PipelineCandidate[],
    pipelineByStage: OraclePipelineByStage,
    params: SimulationParameters,
    capacityProfile: OracleCapacityProfile,
    startDate: Date,
    seed: string,
    iterations: number = 1000,
    targetDate?: Date
): OracleCapacityAwareForecastResult {
    // 1. Run pipeline-only forecast
    const pipelineOnlyResult = runPipelineSimulation(
        pipelineCandidates,
        params,
        startDate,
        `${seed}-pipeline`,
        iterations
    );

    // 2. Apply capacity penalties
    const penaltyResult = applyCapacityPenalty(
        params.stageDurations,
        pipelineByStage,
        capacityProfile
    );

    // 3. Create adjusted params with queue delays
    const capacityAdjustedParams = createCapacityAdjustedParams(params, penaltyResult);

    // 4. Run capacity-aware forecast
    const capacityAwareResult = runPipelineSimulation(
        pipelineCandidates,
        capacityAdjustedParams,
        startDate,
        `${seed}-capacity`,
        iterations
    );

    // 5. Calculate delta
    const p50DeltaDays = Math.round(
        (capacityAwareResult.p50Date.getTime() - pipelineOnlyResult.p50Date.getTime()) / (1000 * 60 * 60 * 24)
    );

    // 6. Calculate probability by target date if provided
    let pipelineProbByTarget: number | undefined;
    let capacityProbByTarget: number | undefined;

    if (targetDate) {
        const targetDays = Math.round(
            (targetDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
        );

        if (pipelineOnlyResult.simulatedDays.length > 0) {
            const successesByTarget = pipelineOnlyResult.simulatedDays.filter(d => d <= targetDays).length;
            pipelineProbByTarget = successesByTarget / pipelineOnlyResult.simulatedDays.length;
        }

        if (capacityAwareResult.simulatedDays.length > 0) {
            const successesByTarget = capacityAwareResult.simulatedDays.filter(d => d <= targetDays).length;
            capacityProbByTarget = successesByTarget / capacityAwareResult.simulatedDays.length;
        }
    }

    // 7. Determine if capacity constraints significantly affect the forecast
    const capacityConstrained = p50DeltaDays >= 3 || penaltyResult.total_queue_delay_days >= 5;

    // 8. Map confidence level
    const mapConfidence = (c: ConfidenceLevel): ConfidenceLevel => {
        if (c === 'INSUFFICIENT') return 'LOW';
        return c;
    };

    return {
        pipeline_only: {
            p10_date: pipelineOnlyResult.p10Date,
            p50_date: pipelineOnlyResult.p50Date,
            p90_date: pipelineOnlyResult.p90Date,
            probability_by_target: pipelineProbByTarget,
            simulated_days: pipelineOnlyResult.simulatedDays
        },
        capacity_aware: {
            p10_date: capacityAwareResult.p10Date,
            p50_date: capacityAwareResult.p50Date,
            p90_date: capacityAwareResult.p90Date,
            probability_by_target: capacityProbByTarget,
            simulated_days: capacityAwareResult.simulatedDays
        },
        p50_delta_days: p50DeltaDays,
        capacity_bottlenecks: penaltyResult.top_bottlenecks,
        capacity_confidence: mapConfidence(penaltyResult.confidence),
        capacity_reasons: capacityProfile.confidence_reasons,
        capacity_constrained: capacityConstrained,
        capacity_profile: capacityProfile,
        debug: {
            iterations,
            seed,
            queue_model_version: 'v1.0'
        }
    };
}

// Export helper for external use
export { addDaysToDate, calculateConfidenceLevel, simulateCandidateJourney, sampleDuration };
