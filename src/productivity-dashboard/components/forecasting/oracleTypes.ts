/**
 * Oracle Explainability Types
 * Types for the Oracle flip card back side and what-if knobs
 */

import { CanonicalStage } from '../../types';
import { SimulationParameters, ForecastResult, DurationDistribution } from '../../services/probabilisticEngine';

/** Preset values for prior weight (m) knob */
export type PriorWeightPreset = 'low' | 'medium' | 'high';
export const PRIOR_WEIGHT_VALUES: Record<PriorWeightPreset, number> = {
    low: 2,
    medium: 5,
    high: 10
};

/** Preset values for min_n threshold */
export type MinNPreset = 'relaxed' | 'standard' | 'strict';
export const MIN_N_VALUES: Record<MinNPreset, number> = {
    relaxed: 3,
    standard: 5,
    strict: 10
};

/** Iterations range */
export const ITERATIONS_RANGE = {
    min: 1000,
    max: 10000,
    default: 1000,
    performanceWarningThreshold: 5000
};

/** Knob settings for what-if analysis */
export interface OracleKnobSettings {
    priorWeight: PriorWeightPreset;
    minNThreshold: MinNPreset;
    iterations: number;
}

/** Default knob settings */
export const DEFAULT_KNOB_SETTINGS: OracleKnobSettings = {
    priorWeight: 'medium',
    minNThreshold: 'standard',
    iterations: 1000
};

/** Stage rate information for display */
export interface StageRateInfo {
    stage: CanonicalStage;
    stageName: string;
    observed: number;  // Raw observed rate (0-1)
    prior: number;     // Prior rate used (0-1)
    m: number;         // Prior weight used
    shrunk: number;    // Final shrunk rate (0-1)
    n: number;         // Sample size
}

/** Stage duration info for display */
export interface StageDurationInfo {
    stage: CanonicalStage;
    stageName: string;
    model: 'empirical' | 'lognormal' | 'constant' | 'global';
    medianDays: number;
    n: number;
    distribution?: DurationDistribution;
}

/** Pipeline count by stage */
export interface PipelineCountInfo {
    stage: CanonicalStage;
    stageName: string;
    count: number;
}

/** Confidence reason */
export interface ConfidenceReason {
    type: 'coverage' | 'shrinkage' | 'sample_size' | 'duration_model';
    message: string;
    impact: 'positive' | 'negative' | 'neutral';
}

/** Calibration data (if available) */
export interface CalibrationData {
    lastRunAt: Date | null;
    score: number | null;  // 0-100
    bias: number | null;   // Negative = predicts too early, Positive = too late
    isAvailable: boolean;
}

/** Full explainability data for Oracle backside */
export interface OracleExplainData {
    // Inputs used
    pipelineCounts: PipelineCountInfo[];
    stageRates: StageRateInfo[];
    stageDurations: StageDurationInfo[];
    iterations: number;
    seed: string;

    // Confidence
    confidenceLevel: 'HIGH' | 'MEDIUM' | 'LOW';
    confidenceReasons: ConfidenceReason[];

    // Calibration
    calibration: CalibrationData;
}

/** Cache key components */
export interface OracleCacheKey {
    reqId: string;
    pipelineHash: string;  // Hash of pipeline counts
    seed: string;
    knobSettings: OracleKnobSettings;
}

/**
 * Generate a deterministic cache key
 */
export function generateCacheKey(key: OracleCacheKey): string {
    const knobStr = `${key.knobSettings.priorWeight}-${key.knobSettings.minNThreshold}-${key.knobSettings.iterations}`;
    return `oracle-${key.reqId}-${key.pipelineHash}-${key.seed}-${knobStr}`;
}

/**
 * Generate a hash for pipeline counts
 */
export function hashPipelineCounts(counts: PipelineCountInfo[]): string {
    const sorted = [...counts].sort((a, b) => a.stage.localeCompare(b.stage));
    const str = sorted.map(c => `${c.stage}:${c.count}`).join('|');
    // Simple hash
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
}

/** Stage labels for display */
export const STAGE_LABELS: Record<string, string> = {
    [CanonicalStage.SCREEN]: 'Screen',
    [CanonicalStage.HM_SCREEN]: 'HM Interview',
    [CanonicalStage.ONSITE]: 'Onsite',
    [CanonicalStage.OFFER]: 'Offer',
    [CanonicalStage.HIRED]: 'Hired'
};
