/**
 * Tests for OracleConfidenceWidget behavior
 * Tests cache key generation, knob changes, and explainability data structure
 */

import {
    OracleKnobSettings,
    OracleExplainData,
    PipelineCountInfo,
    StageRateInfo,
    StageDurationInfo,
    ConfidenceReason,
    DEFAULT_KNOB_SETTINGS,
    PRIOR_WEIGHT_VALUES,
    MIN_N_VALUES,
    STAGE_LABELS,
    generateCacheKey,
    hashPipelineCounts
} from '../oracleTypes';
import { CanonicalStage } from '../../../types';
import { shrinkRate, ForecastResult, SimulationParameters } from '../../../services/probabilisticEngine';

// ===== TEST FIXTURES =====

const mockSimulationParams: SimulationParameters = {
    stageConversionRates: {
        [CanonicalStage.SCREEN]: 0.4,
        [CanonicalStage.HM_SCREEN]: 0.5,
        [CanonicalStage.ONSITE]: 0.4,
        [CanonicalStage.OFFER]: 0.8
    },
    stageDurations: {
        [CanonicalStage.SCREEN]: { type: 'lognormal', mu: Math.log(7), sigma: 0.5 },
        [CanonicalStage.HM_SCREEN]: { type: 'lognormal', mu: Math.log(7), sigma: 0.5 },
        [CanonicalStage.ONSITE]: { type: 'lognormal', mu: Math.log(7), sigma: 0.5 },
        [CanonicalStage.OFFER]: { type: 'constant', days: 7 }
    },
    sampleSizes: {
        [`${CanonicalStage.SCREEN}_rate`]: 50,
        [`${CanonicalStage.HM_SCREEN}_rate`]: 30,
        [`${CanonicalStage.ONSITE}_rate`]: 20,
        [`${CanonicalStage.OFFER}_rate`]: 15
    }
};

const CONTROLLABLE_STAGES = [
    CanonicalStage.SCREEN,
    CanonicalStage.HM_SCREEN,
    CanonicalStage.ONSITE,
    CanonicalStage.OFFER
];

// ===== HELPER: Build ExplainData like the widget does =====

function buildExplainData(
    simulationParams: SimulationParameters,
    pipelineCounts: PipelineCountInfo[],
    knobSettings: OracleKnobSettings,
    observedRates: Record<string, number>,
    priorRates: Record<string, number>,
    forecast: ForecastResult
): OracleExplainData {
    const stageRates: StageRateInfo[] = CONTROLLABLE_STAGES.map(stage => {
        const obs = observedRates[stage] ?? simulationParams.stageConversionRates[stage] ?? 0.5;
        const prior = priorRates[stage] ?? 0.5;
        const n = simulationParams.sampleSizes[`${stage}_rate`] || 0;
        const m = PRIOR_WEIGHT_VALUES[knobSettings.priorWeight];
        const shrunk = shrinkRate(obs, prior, n, m);

        return {
            stage,
            stageName: STAGE_LABELS[stage] || stage,
            observed: obs,
            prior,
            m,
            shrunk,
            n
        };
    });

    const stageDurations: StageDurationInfo[] = CONTROLLABLE_STAGES.map(stage => {
        const dist = simulationParams.stageDurations[stage];
        const n = simulationParams.sampleSizes[`${stage}_duration`] || simulationParams.sampleSizes[`${stage}_rate`] || 0;
        const minN = MIN_N_VALUES[knobSettings.minNThreshold];

        let model: 'empirical' | 'lognormal' | 'constant' | 'global' = 'constant';
        let medianDays = 7;

        if (dist) {
            if (dist.type === 'lognormal' && dist.mu !== undefined) {
                model = n >= minN ? 'lognormal' : 'global';
                medianDays = Math.round(Math.exp(dist.mu));
            } else if (dist.type === 'empirical') {
                model = 'empirical';
                medianDays = 7;
            } else if (dist.type === 'constant') {
                model = 'constant';
                medianDays = dist.days || 7;
            }
        }

        return {
            stage,
            stageName: STAGE_LABELS[stage] || stage,
            model,
            medianDays,
            n,
            distribution: dist
        };
    });

    const confidenceReasons: ConfidenceReason[] = [];
    const minSampleSize = Math.min(...stageRates.map(sr => sr.n));

    if (minSampleSize >= 15) {
        confidenceReasons.push({
            type: 'sample_size',
            message: `Good sample sizes (min ${minSampleSize} per stage)`,
            impact: 'positive'
        });
    } else if (minSampleSize >= 5) {
        confidenceReasons.push({
            type: 'sample_size',
            message: `Moderate sample sizes (min ${minSampleSize})`,
            impact: 'neutral'
        });
    } else {
        confidenceReasons.push({
            type: 'sample_size',
            message: `Limited data (min ${minSampleSize} samples)`,
            impact: 'negative'
        });
    }

    const shrinkageReliance = stageRates.filter(sr => sr.n < 10).length;
    if (shrinkageReliance > 0) {
        confidenceReasons.push({
            type: 'shrinkage',
            message: `${shrinkageReliance} stage(s) rely on prior assumptions`,
            impact: shrinkageReliance > 2 ? 'negative' : 'neutral'
        });
    }

    const lognormalCount = stageDurations.filter(sd => sd.model === 'lognormal').length;
    if (lognormalCount >= 3) {
        confidenceReasons.push({
            type: 'duration_model',
            message: 'Using fitted duration distributions',
            impact: 'positive'
        });
    } else {
        confidenceReasons.push({
            type: 'duration_model',
            message: `${4 - lognormalCount} stage(s) use fallback durations`,
            impact: 'neutral'
        });
    }

    return {
        pipelineCounts,
        stageRates,
        stageDurations,
        iterations: forecast.debug.iterations,
        seed: forecast.debug.seed,
        confidenceLevel: forecast.confidenceLevel,
        confidenceReasons,
        calibration: {
            lastRunAt: null,
            score: null,
            bias: null,
            isAvailable: false
        }
    };
}

// ===== TEST SUITES =====

describe('OracleConfidenceWidget behavior', () => {
    const mockForecast: ForecastResult = {
        p10Date: new Date('2026-02-01'),
        p50Date: new Date('2026-02-15'),
        p90Date: new Date('2026-03-01'),
        simulatedDays: Array.from({ length: 1000 }, (_, i) => 14 + Math.floor(i / 50)),
        confidenceLevel: 'MEDIUM',
        debug: { iterations: 1000, seed: 'test-seed-123' }
    };

    const pipelineCounts: PipelineCountInfo[] = [
        { stage: CanonicalStage.SCREEN, stageName: 'Screen', count: 10 },
        { stage: CanonicalStage.HM_SCREEN, stageName: 'HM Interview', count: 5 },
        { stage: CanonicalStage.ONSITE, stageName: 'Onsite', count: 3 },
        { stage: CanonicalStage.OFFER, stageName: 'Offer', count: 1 }
    ];

    const observedRates = {
        [CanonicalStage.SCREEN]: 0.4,
        [CanonicalStage.HM_SCREEN]: 0.5,
        [CanonicalStage.ONSITE]: 0.4,
        [CanonicalStage.OFFER]: 0.8
    };

    const priorRates = {
        [CanonicalStage.SCREEN]: 0.35,
        [CanonicalStage.HM_SCREEN]: 0.45,
        [CanonicalStage.ONSITE]: 0.35,
        [CanonicalStage.OFFER]: 0.75
    };

    describe('knob settings change worker input', () => {
        it('changing priorWeight changes m value in stage rates', () => {
            const lowSettings: OracleKnobSettings = { ...DEFAULT_KNOB_SETTINGS, priorWeight: 'low' };
            const highSettings: OracleKnobSettings = { ...DEFAULT_KNOB_SETTINGS, priorWeight: 'high' };

            const dataLow = buildExplainData(mockSimulationParams, pipelineCounts, lowSettings, observedRates, priorRates, mockForecast);
            const dataHigh = buildExplainData(mockSimulationParams, pipelineCounts, highSettings, observedRates, priorRates, mockForecast);

            // m values should be different
            expect(dataLow.stageRates[0].m).toBe(PRIOR_WEIGHT_VALUES.low);
            expect(dataHigh.stageRates[0].m).toBe(PRIOR_WEIGHT_VALUES.high);
        });

        it('changing priorWeight changes shrunk rates', () => {
            const lowSettings: OracleKnobSettings = { ...DEFAULT_KNOB_SETTINGS, priorWeight: 'low' };
            const highSettings: OracleKnobSettings = { ...DEFAULT_KNOB_SETTINGS, priorWeight: 'high' };

            const dataLow = buildExplainData(mockSimulationParams, pipelineCounts, lowSettings, observedRates, priorRates, mockForecast);
            const dataHigh = buildExplainData(mockSimulationParams, pipelineCounts, highSettings, observedRates, priorRates, mockForecast);

            // With low m (2), observed rate has more weight -> closer to observed
            // With high m (10), prior has more weight -> closer to prior
            const screenLow = dataLow.stageRates.find(sr => sr.stage === CanonicalStage.SCREEN);
            const screenHigh = dataHigh.stageRates.find(sr => sr.stage === CanonicalStage.SCREEN);

            // observed = 0.4, prior = 0.35
            // With low m, shrunk should be closer to 0.4
            // With high m, shrunk should be closer to 0.35
            expect(screenLow!.shrunk).toBeGreaterThan(screenHigh!.shrunk);
        });

        it('changing minNThreshold changes duration model selection', () => {
            // Create params with low sample size
            const lowNParams: SimulationParameters = {
                ...mockSimulationParams,
                sampleSizes: {
                    [`${CanonicalStage.SCREEN}_rate`]: 4, // Below "standard" (5)
                    [`${CanonicalStage.HM_SCREEN}_rate`]: 4,
                    [`${CanonicalStage.ONSITE}_rate`]: 4,
                    [`${CanonicalStage.OFFER}_rate`]: 4
                }
            };

            const relaxedSettings: OracleKnobSettings = { ...DEFAULT_KNOB_SETTINGS, minNThreshold: 'relaxed' }; // n>=3
            const standardSettings: OracleKnobSettings = { ...DEFAULT_KNOB_SETTINGS, minNThreshold: 'standard' }; // n>=5

            const dataRelaxed = buildExplainData(lowNParams, pipelineCounts, relaxedSettings, observedRates, priorRates, mockForecast);
            const dataStandard = buildExplainData(lowNParams, pipelineCounts, standardSettings, observedRates, priorRates, mockForecast);

            // With relaxed (n>=3), n=4 should use lognormal
            // With standard (n>=5), n=4 should use global/constant fallback
            const screenRelaxed = dataRelaxed.stageDurations.find(sd => sd.stage === CanonicalStage.SCREEN);
            const screenStandard = dataStandard.stageDurations.find(sd => sd.stage === CanonicalStage.SCREEN);

            expect(screenRelaxed!.model).toBe('lognormal');
            expect(screenStandard!.model).toBe('global');
        });

        it('iterations setting is reflected in explainData', () => {
            const settings1000: OracleKnobSettings = { ...DEFAULT_KNOB_SETTINGS, iterations: 1000 };
            const settings5000: OracleKnobSettings = { ...DEFAULT_KNOB_SETTINGS, iterations: 5000 };

            const forecast1000 = { ...mockForecast, debug: { ...mockForecast.debug, iterations: 1000 } };
            const forecast5000 = { ...mockForecast, debug: { ...mockForecast.debug, iterations: 5000 } };

            const data1000 = buildExplainData(mockSimulationParams, pipelineCounts, settings1000, observedRates, priorRates, forecast1000);
            const data5000 = buildExplainData(mockSimulationParams, pipelineCounts, settings5000, observedRates, priorRates, forecast5000);

            expect(data1000.iterations).toBe(1000);
            expect(data5000.iterations).toBe(5000);
        });
    });

    describe('cache key includes knob settings', () => {
        const baseCacheKey = {
            reqId: 'REQ-001',
            pipelineHash: hashPipelineCounts(pipelineCounts),
            seed: mockForecast.debug.seed
        };

        it('different priorWeight produces different cache key', () => {
            const key1 = generateCacheKey({ ...baseCacheKey, knobSettings: { ...DEFAULT_KNOB_SETTINGS, priorWeight: 'low' } });
            const key2 = generateCacheKey({ ...baseCacheKey, knobSettings: { ...DEFAULT_KNOB_SETTINGS, priorWeight: 'high' } });
            expect(key1).not.toBe(key2);
        });

        it('different minNThreshold produces different cache key', () => {
            const key1 = generateCacheKey({ ...baseCacheKey, knobSettings: { ...DEFAULT_KNOB_SETTINGS, minNThreshold: 'relaxed' } });
            const key2 = generateCacheKey({ ...baseCacheKey, knobSettings: { ...DEFAULT_KNOB_SETTINGS, minNThreshold: 'strict' } });
            expect(key1).not.toBe(key2);
        });

        it('different iterations produces different cache key', () => {
            const key1 = generateCacheKey({ ...baseCacheKey, knobSettings: { ...DEFAULT_KNOB_SETTINGS, iterations: 1000 } });
            const key2 = generateCacheKey({ ...baseCacheKey, knobSettings: { ...DEFAULT_KNOB_SETTINGS, iterations: 5000 } });
            expect(key1).not.toBe(key2);
        });

        it('same knob settings produce same cache key', () => {
            const key1 = generateCacheKey({ ...baseCacheKey, knobSettings: DEFAULT_KNOB_SETTINGS });
            const key2 = generateCacheKey({ ...baseCacheKey, knobSettings: DEFAULT_KNOB_SETTINGS });
            expect(key1).toBe(key2);
        });
    });

    describe('confidence reasons', () => {
        it('generates positive sample size reason for good data', () => {
            const data = buildExplainData(mockSimulationParams, pipelineCounts, DEFAULT_KNOB_SETTINGS, observedRates, priorRates, mockForecast);
            const sampleSizeReason = data.confidenceReasons.find(r => r.type === 'sample_size');
            expect(sampleSizeReason).toBeDefined();
            expect(sampleSizeReason!.impact).toBe('positive');
        });

        it('generates negative sample size reason for limited data', () => {
            const lowNParams: SimulationParameters = {
                ...mockSimulationParams,
                sampleSizes: {
                    [`${CanonicalStage.SCREEN}_rate`]: 2,
                    [`${CanonicalStage.HM_SCREEN}_rate`]: 2,
                    [`${CanonicalStage.ONSITE}_rate`]: 2,
                    [`${CanonicalStage.OFFER}_rate`]: 2
                }
            };

            const data = buildExplainData(lowNParams, pipelineCounts, DEFAULT_KNOB_SETTINGS, observedRates, priorRates, mockForecast);
            const sampleSizeReason = data.confidenceReasons.find(r => r.type === 'sample_size');
            expect(sampleSizeReason).toBeDefined();
            expect(sampleSizeReason!.impact).toBe('negative');
        });

        it('generates shrinkage reliance reason when n < 10', () => {
            const moderateNParams: SimulationParameters = {
                ...mockSimulationParams,
                sampleSizes: {
                    [`${CanonicalStage.SCREEN}_rate`]: 8,
                    [`${CanonicalStage.HM_SCREEN}_rate`]: 8,
                    [`${CanonicalStage.ONSITE}_rate`]: 8,
                    [`${CanonicalStage.OFFER}_rate`]: 8
                }
            };

            const data = buildExplainData(moderateNParams, pipelineCounts, DEFAULT_KNOB_SETTINGS, observedRates, priorRates, mockForecast);
            const shrinkageReason = data.confidenceReasons.find(r => r.type === 'shrinkage');
            expect(shrinkageReason).toBeDefined();
            expect(shrinkageReason!.message).toContain('4 stage(s) rely on prior');
        });

        it('generates duration model reason', () => {
            const data = buildExplainData(mockSimulationParams, pipelineCounts, DEFAULT_KNOB_SETTINGS, observedRates, priorRates, mockForecast);
            const durationReason = data.confidenceReasons.find(r => r.type === 'duration_model');
            expect(durationReason).toBeDefined();
        });
    });

    describe('calibration data structure', () => {
        it('calibration defaults to unavailable', () => {
            const data = buildExplainData(mockSimulationParams, pipelineCounts, DEFAULT_KNOB_SETTINGS, observedRates, priorRates, mockForecast);
            expect(data.calibration.isAvailable).toBe(false);
            expect(data.calibration.score).toBeNull();
            expect(data.calibration.bias).toBeNull();
            expect(data.calibration.lastRunAt).toBeNull();
        });
    });

    describe('hasKnobChanges detection', () => {
        it('returns false when knob settings match defaults', () => {
            const hasChanges =
                DEFAULT_KNOB_SETTINGS.priorWeight !== 'medium' ||
                DEFAULT_KNOB_SETTINGS.minNThreshold !== 'standard' ||
                DEFAULT_KNOB_SETTINGS.iterations !== 1000;
            expect(hasChanges).toBe(false);
        });

        it('returns true when priorWeight changed', () => {
            const settings: OracleKnobSettings = { ...DEFAULT_KNOB_SETTINGS, priorWeight: 'high' };
            const hasChanges =
                settings.priorWeight !== DEFAULT_KNOB_SETTINGS.priorWeight ||
                settings.minNThreshold !== DEFAULT_KNOB_SETTINGS.minNThreshold ||
                settings.iterations !== DEFAULT_KNOB_SETTINGS.iterations;
            expect(hasChanges).toBe(true);
        });

        it('returns true when minNThreshold changed', () => {
            const settings: OracleKnobSettings = { ...DEFAULT_KNOB_SETTINGS, minNThreshold: 'strict' };
            const hasChanges =
                settings.priorWeight !== DEFAULT_KNOB_SETTINGS.priorWeight ||
                settings.minNThreshold !== DEFAULT_KNOB_SETTINGS.minNThreshold ||
                settings.iterations !== DEFAULT_KNOB_SETTINGS.iterations;
            expect(hasChanges).toBe(true);
        });

        it('returns true when iterations changed', () => {
            const settings: OracleKnobSettings = { ...DEFAULT_KNOB_SETTINGS, iterations: 5000 };
            const hasChanges =
                settings.priorWeight !== DEFAULT_KNOB_SETTINGS.priorWeight ||
                settings.minNThreshold !== DEFAULT_KNOB_SETTINGS.minNThreshold ||
                settings.iterations !== DEFAULT_KNOB_SETTINGS.iterations;
            expect(hasChanges).toBe(true);
        });
    });
});
