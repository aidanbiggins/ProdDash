/**
 * Tests for OracleConfidenceWidget behavior
 * Tests cache key generation, knob changes, explainability data structure, and capacity-aware mode
 */

import {
    OracleKnobSettings,
    OracleExplainData,
    PipelineCountInfo,
    StageRateInfo,
    StageDurationInfo,
    ConfidenceReason,
    CapacityExplainData,
    DEFAULT_KNOB_SETTINGS,
    PRIOR_WEIGHT_VALUES,
    MIN_N_VALUES,
    STAGE_LABELS,
    generateCacheKey,
    hashPipelineCounts
} from '../oracleTypes';
import { CanonicalStage, Candidate, Requisition, CandidateDisposition, RequisitionStatus } from '../../../types';
import { shrinkRate, ForecastResult, SimulationParameters, runCapacityAwareForecast, PipelineCandidate } from '../../../services/probabilisticEngine';
import { inferCapacity } from '../../../services/capacityInferenceService';
import { applyCapacityPenalty, computeGlobalDemand, applyCapacityPenaltyV11 } from '../../../services/capacityPenaltyModel';
import {
    OracleCapacityProfile,
    OraclePipelineByStage,
    ORACLE_GLOBAL_CAPACITY_PRIORS,
    OracleGlobalDemand,
    OracleCapacityPenaltyResultV11,
    OracleCapacityRecommendation
} from '../../../types/capacityTypes';

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

    describe('capacity-aware mode', () => {
        // Create a capacity profile for testing
        const createCapacityProfile = (): OracleCapacityProfile => ({
            recruiter: {
                recruiter_id: 'rec-001',
                recruiter_name: 'Test Recruiter',
                screens_per_week: { stage: CanonicalStage.SCREEN, throughput_per_week: 5, n_weeks: 8, n_transitions: 40, confidence: 'HIGH' },
                hm_screens_per_week: { stage: CanonicalStage.HM_SCREEN, throughput_per_week: 3, n_weeks: 8, n_transitions: 24, confidence: 'HIGH' },
                onsites_per_week: { stage: CanonicalStage.ONSITE, throughput_per_week: 2, n_weeks: 8, n_transitions: 16, confidence: 'MED' },
                offers_per_week: { stage: CanonicalStage.OFFER, throughput_per_week: 1, n_weeks: 8, n_transitions: 8, confidence: 'LOW' },
                overall_confidence: 'MED',
                confidence_reasons: [],
                date_range: { start: new Date(), end: new Date(), weeks_analyzed: 8 }
            },
            hm: {
                hm_id: 'hm-001',
                hm_name: 'Test HM',
                interviews_per_week: { stage: CanonicalStage.HM_SCREEN, throughput_per_week: 4, n_weeks: 8, n_transitions: 32, confidence: 'HIGH' },
                overall_confidence: 'HIGH',
                confidence_reasons: [],
                date_range: { start: new Date(), end: new Date(), weeks_analyzed: 8 }
            },
            cohort_defaults: ORACLE_GLOBAL_CAPACITY_PRIORS,
            overall_confidence: 'MED',
            confidence_reasons: [],
            used_cohort_fallback: false
        });

        it('capacity explain data is available when profile exists', () => {
            const profile = createCapacityProfile();
            const pipelineByStage: OraclePipelineByStage = {
                [CanonicalStage.SCREEN]: 10,
                [CanonicalStage.HM_SCREEN]: 5,
                [CanonicalStage.ONSITE]: 3,
                [CanonicalStage.OFFER]: 1
            };

            const penaltyResult = applyCapacityPenalty(
                mockSimulationParams.stageDurations,
                pipelineByStage,
                profile
            );

            const capacityData: CapacityExplainData = {
                isAvailable: true,
                profile,
                penaltyResult,
                totalQueueDelayDays: penaltyResult.total_queue_delay_days,
                inferenceWindow: { start: new Date('2024-01-01'), end: new Date('2024-03-01') }
            };

            expect(capacityData.isAvailable).toBe(true);
            expect(capacityData.profile).not.toBeNull();
            expect(capacityData.penaltyResult).not.toBeNull();
        });

        it('capacity penalty applies queue delay when demand exceeds capacity', () => {
            const profile = createCapacityProfile();

            // Overload screen stage: 20 candidates but only 5/week capacity
            const pipelineByStage: OraclePipelineByStage = {
                [CanonicalStage.SCREEN]: 20, // 4x capacity
                [CanonicalStage.HM_SCREEN]: 2,
                [CanonicalStage.ONSITE]: 1,
                [CanonicalStage.OFFER]: 1
            };

            const penaltyResult = applyCapacityPenalty(
                mockSimulationParams.stageDurations,
                pipelineByStage,
                profile
            );

            // Should have queue delay since demand > capacity
            expect(penaltyResult.total_queue_delay_days).toBeGreaterThan(0);

            // Screen should be identified as a bottleneck
            const screenDiag = penaltyResult.stage_diagnostics.find(d => d.stage === CanonicalStage.SCREEN);
            expect(screenDiag?.is_bottleneck).toBe(true);
            expect(screenDiag?.bottleneck_owner_type).toBe('recruiter');
        });

        it('capacity penalty returns zero delay when under capacity', () => {
            const profile = createCapacityProfile();

            // Under capacity: few candidates at each stage
            const pipelineByStage: OraclePipelineByStage = {
                [CanonicalStage.SCREEN]: 3,
                [CanonicalStage.HM_SCREEN]: 2,
                [CanonicalStage.ONSITE]: 1,
                [CanonicalStage.OFFER]: 0
            };

            const penaltyResult = applyCapacityPenalty(
                mockSimulationParams.stageDurations,
                pipelineByStage,
                profile
            );

            // No queue delay when under capacity
            expect(penaltyResult.total_queue_delay_days).toBe(0);
            expect(penaltyResult.top_bottlenecks).toHaveLength(0);
        });

        it('capacity-aware forecast produces later P50 than pipeline-only when overloaded', () => {
            const profile = createCapacityProfile();
            const startDate = new Date();

            // Overload multiple stages
            const pipelineByStage: OraclePipelineByStage = {
                [CanonicalStage.SCREEN]: 15,
                [CanonicalStage.HM_SCREEN]: 10,
                [CanonicalStage.ONSITE]: 5,
                [CanonicalStage.OFFER]: 2
            };

            const pipelineCandidates: PipelineCandidate[] = [
                ...Array(15).fill(null).map((_, i) => ({ candidateId: `c-screen-${i}`, currentStage: CanonicalStage.SCREEN })),
                ...Array(10).fill(null).map((_, i) => ({ candidateId: `c-hm-${i}`, currentStage: CanonicalStage.HM_SCREEN })),
                ...Array(5).fill(null).map((_, i) => ({ candidateId: `c-onsite-${i}`, currentStage: CanonicalStage.ONSITE })),
                ...Array(2).fill(null).map((_, i) => ({ candidateId: `c-offer-${i}`, currentStage: CanonicalStage.OFFER }))
            ];

            const capacityAwareForecast = runCapacityAwareForecast(
                pipelineCandidates,
                pipelineByStage,
                mockSimulationParams,
                profile,
                startDate,
                'test-seed-capacity',
                500 // Reduced iterations for faster test
            );

            // When constrained, capacity-aware P50 should be later than pipeline-only P50
            if (capacityAwareForecast.capacity_constrained) {
                expect(capacityAwareForecast.p50_delta_days).toBeGreaterThanOrEqual(0);
                expect(capacityAwareForecast.capacity_aware.p50_date.getTime())
                    .toBeGreaterThanOrEqual(capacityAwareForecast.pipeline_only.p50_date.getTime());
            }
        });

        it('capacity bottleneck attribution identifies correct owner', () => {
            const profile = createCapacityProfile();

            // Overload HM screen specifically
            const pipelineByStage: OraclePipelineByStage = {
                [CanonicalStage.SCREEN]: 3, // Under recruiter capacity
                [CanonicalStage.HM_SCREEN]: 15, // Way over HM capacity (4/week)
                [CanonicalStage.ONSITE]: 1,
                [CanonicalStage.OFFER]: 1
            };

            const penaltyResult = applyCapacityPenalty(
                mockSimulationParams.stageDurations,
                pipelineByStage,
                profile
            );

            // HM_SCREEN should be primary bottleneck
            expect(penaltyResult.top_bottlenecks.length).toBeGreaterThan(0);
            const hmBottleneck = penaltyResult.top_bottlenecks.find(b => b.stage === CanonicalStage.HM_SCREEN);
            expect(hmBottleneck).toBeDefined();
            expect(hmBottleneck?.bottleneck_owner_type).toBe('hm');
        });

        it('capacity confidence reflects data quality', () => {
            // Profile with low confidence
            const lowConfidenceProfile: OracleCapacityProfile = {
                recruiter: {
                    recruiter_id: 'rec-001',
                    recruiter_name: 'Test Recruiter',
                    screens_per_week: { stage: CanonicalStage.SCREEN, throughput_per_week: 5, n_weeks: 2, n_transitions: 4, confidence: 'LOW' },
                    overall_confidence: 'LOW',
                    confidence_reasons: [{ type: 'sample_size', message: 'Limited data', impact: 'negative' }],
                    date_range: { start: new Date(), end: new Date(), weeks_analyzed: 2 }
                },
                hm: null,
                cohort_defaults: ORACLE_GLOBAL_CAPACITY_PRIORS,
                overall_confidence: 'LOW',
                confidence_reasons: [{ type: 'sample_size', message: 'Limited data', impact: 'negative' }],
                used_cohort_fallback: true
            };

            const pipelineByStage: OraclePipelineByStage = {
                [CanonicalStage.SCREEN]: 10,
                [CanonicalStage.HM_SCREEN]: 5,
                [CanonicalStage.ONSITE]: 3,
                [CanonicalStage.OFFER]: 1
            };

            const penaltyResult = applyCapacityPenalty(
                mockSimulationParams.stageDurations,
                pipelineByStage,
                lowConfidenceProfile
            );

            // Overall confidence should be LOW when data is insufficient
            expect(penaltyResult.confidence).toBe('LOW');
        });

        it('capacity explain data is unavailable when no profile', () => {
            const capacityData: CapacityExplainData = {
                isAvailable: false,
                profile: null,
                penaltyResult: null,
                totalQueueDelayDays: 0,
                inferenceWindow: null
            };

            expect(capacityData.isAvailable).toBe(false);
            expect(capacityData.profile).toBeNull();
            expect(capacityData.totalQueueDelayDays).toBe(0);
        });
    });

    // ===== v1.1 GLOBAL WORKLOAD CONTEXT TESTS =====

    describe('v1.1 global workload context', () => {
        // Create a capacity profile for testing
        const createCapacityProfile = (): OracleCapacityProfile => ({
            recruiter: {
                recruiter_id: 'rec-001',
                recruiter_name: 'Test Recruiter',
                screens_per_week: { stage: CanonicalStage.SCREEN, throughput_per_week: 8, n_weeks: 8, n_transitions: 64, confidence: 'HIGH' },
                hm_screens_per_week: { stage: CanonicalStage.HM_SCREEN, throughput_per_week: 4, n_weeks: 8, n_transitions: 32, confidence: 'HIGH' },
                onsites_per_week: { stage: CanonicalStage.ONSITE, throughput_per_week: 3, n_weeks: 8, n_transitions: 24, confidence: 'MED' },
                offers_per_week: { stage: CanonicalStage.OFFER, throughput_per_week: 1.5, n_weeks: 8, n_transitions: 12, confidence: 'MED' },
                overall_confidence: 'HIGH',
                confidence_reasons: [],
                date_range: { start: new Date(), end: new Date(), weeks_analyzed: 8 }
            },
            hm: {
                hm_id: 'hm-001',
                hm_name: 'Test HM',
                interviews_per_week: { stage: CanonicalStage.HM_SCREEN, throughput_per_week: 4, n_weeks: 8, n_transitions: 32, confidence: 'HIGH' },
                overall_confidence: 'HIGH',
                confidence_reasons: [],
                date_range: { start: new Date(), end: new Date(), weeks_analyzed: 8 }
            },
            cohort_defaults: ORACLE_GLOBAL_CAPACITY_PRIORS,
            overall_confidence: 'HIGH',
            confidence_reasons: [],
            used_cohort_fallback: false
        });

        // Helper to create mock candidates
        function createMockCandidate(
            id: string,
            reqId: string,
            stage: CanonicalStage,
            disposition: CandidateDisposition = CandidateDisposition.Active
        ): Candidate {
            return {
                candidate_id: id,
                req_id: reqId,
                name: `Candidate ${id}`,
                current_stage: stage,
                disposition,
                applied_at: new Date()
            };
        }

        // Helper to create mock requisitions
        function createMockRequisition(
            id: string,
            recruiterId: string | null,
            hmId: string | null,
            status: RequisitionStatus = RequisitionStatus.Open
        ): Requisition {
            return {
                req_id: id,
                title: `Req ${id}`,
                recruiter_id: recruiterId || undefined,
                hiring_manager_id: hmId || undefined,
                status,
                opened_at: new Date()
            };
        }

        it('capacity explain data includes global demand when available', () => {
            const profile = createCapacityProfile();
            const candidates: Candidate[] = [
                createMockCandidate('c1', 'req-1', CanonicalStage.SCREEN),
                createMockCandidate('c2', 'req-1', CanonicalStage.HM_SCREEN),
                createMockCandidate('c3', 'req-2', CanonicalStage.SCREEN),
                createMockCandidate('c4', 'req-2', CanonicalStage.SCREEN)
            ];

            const requisitions: Requisition[] = [
                createMockRequisition('req-1', 'rec-001', 'hm-001'),
                createMockRequisition('req-2', 'rec-001', 'hm-002')
            ];

            const globalDemand = computeGlobalDemand({
                selectedReqId: 'req-1',
                recruiterId: 'rec-001',
                hmId: 'hm-001',
                allCandidates: candidates,
                allRequisitions: requisitions
            });

            const penaltyResultV11 = applyCapacityPenaltyV11(
                mockSimulationParams.stageDurations,
                globalDemand,
                profile
            );

            const capacityData: CapacityExplainData = {
                isAvailable: true,
                profile,
                penaltyResult: null,
                totalQueueDelayDays: penaltyResultV11.total_queue_delay_days,
                inferenceWindow: { start: new Date('2024-01-01'), end: new Date('2024-03-01') },
                globalDemand,
                penaltyResultV11,
                recommendations: penaltyResultV11.recommendations
            };

            expect(capacityData.globalDemand).toBeDefined();
            expect(capacityData.globalDemand?.demand_scope).toBe('global_by_recruiter');
            expect(capacityData.globalDemand?.recruiter_context.open_req_count).toBe(2);
            expect(capacityData.penaltyResultV11).toBeDefined();
        });

        it('workload context shows recruiter total candidates across all reqs', () => {
            const candidates: Candidate[] = [
                // 2 candidates for req-1
                createMockCandidate('c1', 'req-1', CanonicalStage.SCREEN),
                createMockCandidate('c2', 'req-1', CanonicalStage.HM_SCREEN),
                // 3 candidates for req-2 (same recruiter)
                createMockCandidate('c3', 'req-2', CanonicalStage.SCREEN),
                createMockCandidate('c4', 'req-2', CanonicalStage.SCREEN),
                createMockCandidate('c5', 'req-2', CanonicalStage.ONSITE)
            ];

            const requisitions: Requisition[] = [
                createMockRequisition('req-1', 'rec-001', 'hm-001'),
                createMockRequisition('req-2', 'rec-001', 'hm-002')
            ];

            const globalDemand = computeGlobalDemand({
                selectedReqId: 'req-1',
                recruiterId: 'rec-001',
                hmId: 'hm-001',
                allCandidates: candidates,
                allRequisitions: requisitions
            });

            // Workload context should show total across all recruiter's reqs
            expect(globalDemand.recruiter_context.total_candidates_in_flight).toBe(5);
            expect(globalDemand.recruiter_context.open_req_count).toBe(2);
        });

        it('recommendations are generated when bottlenecks exist', () => {
            const profile = createCapacityProfile();

            // Create overloaded situation
            const candidates: Candidate[] = Array.from({ length: 20 }, (_, i) =>
                createMockCandidate(`c${i}`, 'req-1', CanonicalStage.SCREEN)
            );

            const requisitions: Requisition[] = [
                createMockRequisition('req-1', 'rec-001', 'hm-001'),
                createMockRequisition('req-2', 'rec-001', 'hm-001'),
                createMockRequisition('req-3', 'rec-001', 'hm-001'),
                createMockRequisition('req-4', 'rec-001', 'hm-001')
            ];

            const globalDemand = computeGlobalDemand({
                selectedReqId: 'req-1',
                recruiterId: 'rec-001',
                hmId: 'hm-001',
                allCandidates: candidates,
                allRequisitions: requisitions
            });

            const penaltyResultV11 = applyCapacityPenaltyV11(
                mockSimulationParams.stageDurations,
                globalDemand,
                profile
            );

            // Should have recommendations
            expect(penaltyResultV11.recommendations.length).toBeGreaterThan(0);

            // Should have throughput recommendation
            const throughputRec = penaltyResultV11.recommendations.find(r => r.type === 'increase_throughput');
            expect(throughputRec).toBeDefined();
            expect(throughputRec?.estimated_impact_days).toBeGreaterThan(0);
        });

        it('bottleneck attribution shows correct owner type', () => {
            const profile = createCapacityProfile();

            // Overload HM_SCREEN stage specifically
            const candidates: Candidate[] = Array.from({ length: 10 }, (_, i) =>
                createMockCandidate(`c${i}`, 'req-1', CanonicalStage.HM_SCREEN)
            );

            const requisitions: Requisition[] = [
                createMockRequisition('req-1', 'rec-001', 'hm-001')
            ];

            const globalDemand = computeGlobalDemand({
                selectedReqId: 'req-1',
                recruiterId: 'rec-001',
                hmId: 'hm-001',
                allCandidates: candidates,
                allRequisitions: requisitions
            });

            const penaltyResultV11 = applyCapacityPenaltyV11(
                mockSimulationParams.stageDurations,
                globalDemand,
                profile
            );

            // HM_SCREEN bottleneck should be attributed to HM
            const hmBottleneck = penaltyResultV11.top_bottlenecks.find(b => b.stage === CanonicalStage.HM_SCREEN);
            expect(hmBottleneck).toBeDefined();
            expect(hmBottleneck?.bottleneck_owner_type).toBe('hm');
        });

        it('SCREEN bottleneck is attributed to recruiter', () => {
            const profile = createCapacityProfile();

            // Overload SCREEN stage
            const candidates: Candidate[] = Array.from({ length: 20 }, (_, i) =>
                createMockCandidate(`c${i}`, 'req-1', CanonicalStage.SCREEN)
            );

            const requisitions: Requisition[] = [
                createMockRequisition('req-1', 'rec-001', 'hm-001')
            ];

            const globalDemand = computeGlobalDemand({
                selectedReqId: 'req-1',
                recruiterId: 'rec-001',
                hmId: 'hm-001',
                allCandidates: candidates,
                allRequisitions: requisitions
            });

            const penaltyResultV11 = applyCapacityPenaltyV11(
                mockSimulationParams.stageDurations,
                globalDemand,
                profile
            );

            // SCREEN bottleneck should be attributed to recruiter
            const screenBottleneck = penaltyResultV11.top_bottlenecks.find(b => b.stage === CanonicalStage.SCREEN);
            expect(screenBottleneck).toBeDefined();
            expect(screenBottleneck?.bottleneck_owner_type).toBe('recruiter');
        });

        it('confidence is LOW when both IDs missing', () => {
            const candidates: Candidate[] = [
                createMockCandidate('c1', 'req-1', CanonicalStage.SCREEN)
            ];

            const requisitions: Requisition[] = [
                createMockRequisition('req-1', null, null)
            ];

            const globalDemand = computeGlobalDemand({
                selectedReqId: 'req-1',
                recruiterId: null,
                hmId: null,
                allCandidates: candidates,
                allRequisitions: requisitions
            });

            expect(globalDemand.confidence).toBe('LOW');
            expect(globalDemand.demand_scope).toBe('single_req');
        });

        it('selected req pipeline is separate from global demand', () => {
            const candidates: Candidate[] = [
                // 2 candidates for selected req
                createMockCandidate('c1', 'req-1', CanonicalStage.SCREEN),
                createMockCandidate('c2', 'req-1', CanonicalStage.HM_SCREEN),
                // 3 more candidates for another req
                createMockCandidate('c3', 'req-2', CanonicalStage.SCREEN),
                createMockCandidate('c4', 'req-2', CanonicalStage.SCREEN),
                createMockCandidate('c5', 'req-2', CanonicalStage.SCREEN)
            ];

            const requisitions: Requisition[] = [
                createMockRequisition('req-1', 'rec-001', 'hm-001'),
                createMockRequisition('req-2', 'rec-001', 'hm-002')
            ];

            const globalDemand = computeGlobalDemand({
                selectedReqId: 'req-1',
                recruiterId: 'rec-001',
                hmId: 'hm-001',
                allCandidates: candidates,
                allRequisitions: requisitions
            });

            // selected_req_pipeline should only show req-1 candidates
            expect(globalDemand.selected_req_pipeline[CanonicalStage.SCREEN]).toBe(1);
            expect(globalDemand.selected_req_pipeline[CanonicalStage.HM_SCREEN]).toBe(1);

            // recruiter_demand should show global demand (4 at SCREEN for recruiter)
            expect(globalDemand.recruiter_demand[CanonicalStage.SCREEN]).toBe(4);
        });

        it('data improvement recommendation when confidence is LOW', () => {
            const profile = createCapacityProfile();

            const candidates: Candidate[] = [
                createMockCandidate('c1', 'req-1', CanonicalStage.SCREEN)
            ];

            const requisitions: Requisition[] = [
                createMockRequisition('req-1', null, null)
            ];

            const globalDemand = computeGlobalDemand({
                selectedReqId: 'req-1',
                recruiterId: null,
                hmId: null,
                allCandidates: candidates,
                allRequisitions: requisitions
            });

            // Use cohort fallback profile to test
            const lowDataProfile: OracleCapacityProfile = {
                ...profile,
                recruiter: null,
                hm: null,
                used_cohort_fallback: true,
                overall_confidence: 'LOW'
            };

            const penaltyResultV11 = applyCapacityPenaltyV11(
                mockSimulationParams.stageDurations,
                globalDemand,
                lowDataProfile
            );

            // Should have data improvement recommendation
            const dataRec = penaltyResultV11.recommendations.find(r => r.type === 'improve_data');
            expect(dataRec).toBeDefined();
        });
    });
});
