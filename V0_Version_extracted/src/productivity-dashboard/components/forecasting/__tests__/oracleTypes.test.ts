/**
 * Unit tests for oracleTypes.ts
 * Tests knob settings, cache key generation, and constants
 */

import {
    OracleKnobSettings,
    PriorWeightPreset,
    MinNPreset,
    PRIOR_WEIGHT_VALUES,
    MIN_N_VALUES,
    ITERATIONS_RANGE,
    DEFAULT_KNOB_SETTINGS,
    generateCacheKey,
    hashPipelineCounts,
    PipelineCountInfo,
    OracleCacheKey,
    STAGE_LABELS
} from '../oracleTypes';
import { CanonicalStage } from '../../../types';

// ===== TEST FIXTURES =====

const SAMPLE_PIPELINE_COUNTS: PipelineCountInfo[] = [
    { stage: CanonicalStage.SCREEN, stageName: 'Screen', count: 10 },
    { stage: CanonicalStage.HM_SCREEN, stageName: 'HM Interview', count: 5 },
    { stage: CanonicalStage.ONSITE, stageName: 'Onsite', count: 3 },
    { stage: CanonicalStage.OFFER, stageName: 'Offer', count: 1 }
];

const SAMPLE_CACHE_KEY: OracleCacheKey = {
    reqId: 'REQ-001',
    pipelineHash: 'abc123',
    seed: 'seed-456',
    knobSettings: DEFAULT_KNOB_SETTINGS
};

// ===== TEST SUITES =====

describe('oracleTypes', () => {
    describe('constants', () => {
        describe('PRIOR_WEIGHT_VALUES', () => {
            it('has correct values for each preset', () => {
                expect(PRIOR_WEIGHT_VALUES.low).toBe(2);
                expect(PRIOR_WEIGHT_VALUES.medium).toBe(5);
                expect(PRIOR_WEIGHT_VALUES.high).toBe(10);
            });

            it('low < medium < high', () => {
                expect(PRIOR_WEIGHT_VALUES.low).toBeLessThan(PRIOR_WEIGHT_VALUES.medium);
                expect(PRIOR_WEIGHT_VALUES.medium).toBeLessThan(PRIOR_WEIGHT_VALUES.high);
            });
        });

        describe('MIN_N_VALUES', () => {
            it('has correct values for each preset', () => {
                expect(MIN_N_VALUES.relaxed).toBe(3);
                expect(MIN_N_VALUES.standard).toBe(5);
                expect(MIN_N_VALUES.strict).toBe(10);
            });

            it('relaxed < standard < strict', () => {
                expect(MIN_N_VALUES.relaxed).toBeLessThan(MIN_N_VALUES.standard);
                expect(MIN_N_VALUES.standard).toBeLessThan(MIN_N_VALUES.strict);
            });
        });

        describe('ITERATIONS_RANGE', () => {
            it('has valid bounds', () => {
                expect(ITERATIONS_RANGE.min).toBe(1000);
                expect(ITERATIONS_RANGE.max).toBe(10000);
                expect(ITERATIONS_RANGE.default).toBe(1000);
            });

            it('default is within range', () => {
                expect(ITERATIONS_RANGE.default).toBeGreaterThanOrEqual(ITERATIONS_RANGE.min);
                expect(ITERATIONS_RANGE.default).toBeLessThanOrEqual(ITERATIONS_RANGE.max);
            });

            it('performance warning threshold is within range', () => {
                expect(ITERATIONS_RANGE.performanceWarningThreshold).toBeGreaterThan(ITERATIONS_RANGE.min);
                expect(ITERATIONS_RANGE.performanceWarningThreshold).toBeLessThanOrEqual(ITERATIONS_RANGE.max);
            });
        });

        describe('DEFAULT_KNOB_SETTINGS', () => {
            it('has medium prior weight', () => {
                expect(DEFAULT_KNOB_SETTINGS.priorWeight).toBe('medium');
            });

            it('has standard min_n threshold', () => {
                expect(DEFAULT_KNOB_SETTINGS.minNThreshold).toBe('standard');
            });

            it('has default iterations', () => {
                expect(DEFAULT_KNOB_SETTINGS.iterations).toBe(ITERATIONS_RANGE.default);
            });
        });

        describe('STAGE_LABELS', () => {
            it('has labels for all controllable stages', () => {
                expect(STAGE_LABELS[CanonicalStage.SCREEN]).toBe('Screen');
                expect(STAGE_LABELS[CanonicalStage.HM_SCREEN]).toBe('HM Interview');
                expect(STAGE_LABELS[CanonicalStage.ONSITE]).toBe('Onsite');
                expect(STAGE_LABELS[CanonicalStage.OFFER]).toBe('Offer');
            });

            it('has label for hired stage', () => {
                expect(STAGE_LABELS[CanonicalStage.HIRED]).toBe('Hired');
            });
        });
    });

    describe('hashPipelineCounts', () => {
        it('returns a string hash', () => {
            const hash = hashPipelineCounts(SAMPLE_PIPELINE_COUNTS);
            expect(typeof hash).toBe('string');
            expect(hash.length).toBeGreaterThan(0);
        });

        it('returns deterministic hash for same input', () => {
            const hash1 = hashPipelineCounts(SAMPLE_PIPELINE_COUNTS);
            const hash2 = hashPipelineCounts(SAMPLE_PIPELINE_COUNTS);
            expect(hash1).toBe(hash2);
        });

        it('returns same hash regardless of array order', () => {
            const reordered = [...SAMPLE_PIPELINE_COUNTS].reverse();
            const hash1 = hashPipelineCounts(SAMPLE_PIPELINE_COUNTS);
            const hash2 = hashPipelineCounts(reordered);
            expect(hash1).toBe(hash2);
        });

        it('returns different hash for different counts', () => {
            const modified = SAMPLE_PIPELINE_COUNTS.map(pc => ({
                ...pc,
                count: pc.count + 1
            }));
            const hash1 = hashPipelineCounts(SAMPLE_PIPELINE_COUNTS);
            const hash2 = hashPipelineCounts(modified);
            expect(hash1).not.toBe(hash2);
        });

        it('handles empty array', () => {
            const hash = hashPipelineCounts([]);
            expect(typeof hash).toBe('string');
        });
    });

    describe('generateCacheKey', () => {
        it('returns a string key', () => {
            const key = generateCacheKey(SAMPLE_CACHE_KEY);
            expect(typeof key).toBe('string');
            expect(key.length).toBeGreaterThan(0);
        });

        it('includes oracle prefix', () => {
            const key = generateCacheKey(SAMPLE_CACHE_KEY);
            expect(key.startsWith('oracle-')).toBe(true);
        });

        it('returns deterministic key for same input', () => {
            const key1 = generateCacheKey(SAMPLE_CACHE_KEY);
            const key2 = generateCacheKey(SAMPLE_CACHE_KEY);
            expect(key1).toBe(key2);
        });

        it('returns different key for different reqId', () => {
            const key1 = generateCacheKey(SAMPLE_CACHE_KEY);
            const key2 = generateCacheKey({ ...SAMPLE_CACHE_KEY, reqId: 'REQ-002' });
            expect(key1).not.toBe(key2);
        });

        it('returns different key for different pipelineHash', () => {
            const key1 = generateCacheKey(SAMPLE_CACHE_KEY);
            const key2 = generateCacheKey({ ...SAMPLE_CACHE_KEY, pipelineHash: 'xyz789' });
            expect(key1).not.toBe(key2);
        });

        it('returns different key for different seed', () => {
            const key1 = generateCacheKey(SAMPLE_CACHE_KEY);
            const key2 = generateCacheKey({ ...SAMPLE_CACHE_KEY, seed: 'other-seed' });
            expect(key1).not.toBe(key2);
        });

        it('returns different key for different priorWeight', () => {
            const key1 = generateCacheKey(SAMPLE_CACHE_KEY);
            const key2 = generateCacheKey({
                ...SAMPLE_CACHE_KEY,
                knobSettings: { ...DEFAULT_KNOB_SETTINGS, priorWeight: 'low' }
            });
            expect(key1).not.toBe(key2);
        });

        it('returns different key for different minNThreshold', () => {
            const key1 = generateCacheKey(SAMPLE_CACHE_KEY);
            const key2 = generateCacheKey({
                ...SAMPLE_CACHE_KEY,
                knobSettings: { ...DEFAULT_KNOB_SETTINGS, minNThreshold: 'strict' }
            });
            expect(key1).not.toBe(key2);
        });

        it('returns different key for different iterations', () => {
            const key1 = generateCacheKey(SAMPLE_CACHE_KEY);
            const key2 = generateCacheKey({
                ...SAMPLE_CACHE_KEY,
                knobSettings: { ...DEFAULT_KNOB_SETTINGS, iterations: 5000 }
            });
            expect(key1).not.toBe(key2);
        });

        it('includes knob settings in key', () => {
            const key = generateCacheKey(SAMPLE_CACHE_KEY);
            // Key should contain knob settings representation
            expect(key).toContain('medium');
            expect(key).toContain('standard');
            expect(key).toContain('1000');
        });
    });

    describe('knob settings type safety', () => {
        it('PriorWeightPreset accepts valid values', () => {
            const presets: PriorWeightPreset[] = ['low', 'medium', 'high'];
            presets.forEach(preset => {
                expect(PRIOR_WEIGHT_VALUES[preset]).toBeDefined();
            });
        });

        it('MinNPreset accepts valid values', () => {
            const presets: MinNPreset[] = ['relaxed', 'standard', 'strict'];
            presets.forEach(preset => {
                expect(MIN_N_VALUES[preset]).toBeDefined();
            });
        });

        it('OracleKnobSettings has all required fields', () => {
            const settings: OracleKnobSettings = {
                priorWeight: 'medium',
                minNThreshold: 'standard',
                iterations: 1000
            };
            expect(settings.priorWeight).toBeDefined();
            expect(settings.minNThreshold).toBeDefined();
            expect(settings.iterations).toBeDefined();
        });
    });

    describe('cache key includes all knob settings', () => {
        it('changing any knob setting produces different cache key', () => {
            const baseKey = generateCacheKey(SAMPLE_CACHE_KEY);

            // Change priorWeight
            const keyWithLowPrior = generateCacheKey({
                ...SAMPLE_CACHE_KEY,
                knobSettings: { ...DEFAULT_KNOB_SETTINGS, priorWeight: 'low' }
            });
            const keyWithHighPrior = generateCacheKey({
                ...SAMPLE_CACHE_KEY,
                knobSettings: { ...DEFAULT_KNOB_SETTINGS, priorWeight: 'high' }
            });

            // Change minNThreshold
            const keyWithRelaxed = generateCacheKey({
                ...SAMPLE_CACHE_KEY,
                knobSettings: { ...DEFAULT_KNOB_SETTINGS, minNThreshold: 'relaxed' }
            });
            const keyWithStrict = generateCacheKey({
                ...SAMPLE_CACHE_KEY,
                knobSettings: { ...DEFAULT_KNOB_SETTINGS, minNThreshold: 'strict' }
            });

            // Change iterations
            const keyWith5000 = generateCacheKey({
                ...SAMPLE_CACHE_KEY,
                knobSettings: { ...DEFAULT_KNOB_SETTINGS, iterations: 5000 }
            });
            const keyWith10000 = generateCacheKey({
                ...SAMPLE_CACHE_KEY,
                knobSettings: { ...DEFAULT_KNOB_SETTINGS, iterations: 10000 }
            });

            // All should be different from base and from each other
            const allKeys = [
                baseKey,
                keyWithLowPrior,
                keyWithHighPrior,
                keyWithRelaxed,
                keyWithStrict,
                keyWith5000,
                keyWith10000
            ];

            const uniqueKeys = new Set(allKeys);
            expect(uniqueKeys.size).toBe(allKeys.length);
        });
    });
});
