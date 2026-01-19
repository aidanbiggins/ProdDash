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
