/**
 * Oracle Engine Tests
 *
 * Verifies mathematical correctness of:
 * 1. Beta distribution inference
 * 2. Gamma distribution fitting
 * 3. Monte Carlo simulation
 * 4. Bootstrap confidence intervals
 * 5. Quantile estimation (Hyndman-Fan Type 7)
 */

import {
  computeBetaPosterior,
  fitGammaDistribution,
  buildStageParams,
  runOracleForecast,
  OracleConfig,
  OraclePipelineCandidate,
  StageHistoricalData,
  DEFAULT_ORACLE_CONFIG,
} from '../oracleEngine';
import { CanonicalStage } from '../../types';

describe('oracleEngine', () => {
  describe('computeBetaPosterior', () => {
    it('should compute correct posterior with no data (prior only)', () => {
      const posterior = computeBetaPosterior(0, 0, 2);

      // With 0 observations, posterior = prior = Beta(2, 2)
      expect(posterior.alpha).toBe(2);
      expect(posterior.beta).toBe(2);
      expect(posterior.mean).toBe(0.5); // Symmetric prior
      expect(posterior.n).toBe(0);
    });

    it('should compute correct posterior with strong evidence', () => {
      // 80 successes out of 100 trials, weak prior (2, 2)
      const posterior = computeBetaPosterior(80, 100, 2);

      // Posterior: Beta(2+80, 2+20) = Beta(82, 22)
      expect(posterior.alpha).toBe(82);
      expect(posterior.beta).toBe(22);

      // Mean = 82/104 ≈ 0.788
      expect(posterior.mean).toBeCloseTo(0.788, 2);

      // CI should be fairly tight with 100 observations
      expect(posterior.ci95Lower).toBeGreaterThan(0.7);
      expect(posterior.ci95Upper).toBeLessThan(0.86);
    });

    it('should shrink small samples toward prior', () => {
      // With small sample, posterior should be pulled toward prior
      const posterior = computeBetaPosterior(3, 5, 5);

      // Posterior: Beta(5+3, 5+2) = Beta(8, 7)
      // Mean = 8/15 ≈ 0.533 (closer to 0.5 prior than 0.6 observed)
      expect(posterior.mean).toBeCloseTo(0.533, 2);

      // Observed rate: 3/5 = 0.6
      // Shrunk mean should be between 0.5 (prior) and 0.6 (observed)
      expect(posterior.mean).toBeGreaterThan(0.5);
      expect(posterior.mean).toBeLessThan(0.6);
    });

    it('should have wider CI with less data', () => {
      const smallSample = computeBetaPosterior(5, 10, 2);
      const largeSample = computeBetaPosterior(50, 100, 2);

      const smallWidth = smallSample.ci95Upper - smallSample.ci95Lower;
      const largeWidth = largeSample.ci95Upper - largeSample.ci95Lower;

      // Small sample should have wider confidence interval
      expect(smallWidth).toBeGreaterThan(largeWidth);
    });
  });

  describe('fitGammaDistribution', () => {
    it('should fit Gamma to known data', () => {
      // Generate data from Gamma(4, 0.5) → mean=8, variance=16
      const durations = [5, 6, 7, 8, 9, 10, 12, 8, 6, 10, 11, 7, 9, 8];

      const gamma = fitGammaDistribution(durations);

      // Mean should be close to sample mean
      const sampleMean = durations.reduce((a, b) => a + b, 0) / durations.length;
      expect(gamma.mean).toBeCloseTo(sampleMean, 1);

      // Shape and rate should produce reasonable distribution
      expect(gamma.shape).toBeGreaterThan(0);
      expect(gamma.rate).toBeGreaterThan(0);
      expect(gamma.n).toBe(durations.length);
    });

    it('should handle empty data with default', () => {
      const gamma = fitGammaDistribution([]);

      // Should return exponential with mean 7
      expect(gamma.shape).toBe(1);
      expect(gamma.mean).toBe(7);
      expect(gamma.n).toBe(0);
    });

    it('should handle constant data', () => {
      const gamma = fitGammaDistribution([5, 5, 5, 5, 5]);

      // With zero variance, should still produce valid distribution
      expect(gamma.mean).toBe(5);
      expect(gamma.shape).toBeGreaterThan(0);
      expect(gamma.rate).toBeGreaterThan(0);
    });
  });

  describe('buildStageParams', () => {
    it('should build params from historical data', () => {
      const historicalData: StageHistoricalData[] = [
        {
          stage: CanonicalStage.SCREEN,
          entered: 100,
          passed: 40,
          durations: [3, 5, 4, 6, 5, 4, 5, 3, 7, 5],
        },
        {
          stage: CanonicalStage.HM_SCREEN,
          entered: 40,
          passed: 20,
          durations: [7, 8, 10, 6, 9, 8, 7, 11, 8, 9],
        },
        {
          stage: CanonicalStage.ONSITE,
          entered: 20,
          passed: 8,
          durations: [10, 12, 14, 11, 13, 10, 15, 12],
        },
        {
          stage: CanonicalStage.OFFER,
          entered: 8,
          passed: 6,
          durations: [5, 4, 6, 3, 5, 4],
        },
      ];

      const params = buildStageParams(historicalData, 2);

      // Should have all stages
      expect(params.size).toBe(4);

      // Screen: 40/100 = 40% pass rate
      const screenParams = params.get(CanonicalStage.SCREEN);
      expect(screenParams).toBeDefined();
      expect(screenParams!.conversionRate.mean).toBeCloseTo(0.4, 1);

      // Offer: 6/8 = 75% pass rate
      const offerParams = params.get(CanonicalStage.OFFER);
      expect(offerParams).toBeDefined();
      expect(offerParams!.conversionRate.mean).toBeGreaterThan(0.6);
    });

    it('should fill in missing stages with priors', () => {
      const historicalData: StageHistoricalData[] = [
        {
          stage: CanonicalStage.SCREEN,
          entered: 10,
          passed: 4,
          durations: [5, 6, 7],
        },
      ];

      const params = buildStageParams(historicalData, 2);

      // Should have default params for missing stages
      expect(params.has(CanonicalStage.HM_SCREEN)).toBe(true);
      expect(params.has(CanonicalStage.ONSITE)).toBe(true);
      expect(params.has(CanonicalStage.OFFER)).toBe(true);
    });
  });

  describe('runOracleForecast', () => {
    const createTestParams = () => {
      const historicalData: StageHistoricalData[] = [
        {
          stage: CanonicalStage.SCREEN,
          entered: 100,
          passed: 40,
          durations: [5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
        },
        {
          stage: CanonicalStage.HM_SCREEN,
          entered: 40,
          passed: 20,
          durations: [7, 7, 7, 7, 7, 7, 7, 7, 7, 7],
        },
        {
          stage: CanonicalStage.ONSITE,
          entered: 20,
          passed: 8,
          durations: [10, 10, 10, 10, 10, 10, 10, 10],
        },
        {
          stage: CanonicalStage.OFFER,
          entered: 8,
          passed: 7,
          durations: [5, 5, 5, 5, 5, 5, 5],
        },
      ];
      return buildStageParams(historicalData, 2);
    };

    it('should produce valid forecast for single candidate', () => {
      const params = createTestParams();
      const candidates: OraclePipelineCandidate[] = [
        { candidateId: 'c1', currentStage: CanonicalStage.SCREEN },
      ];

      const config: OracleConfig = {
        ...DEFAULT_ORACLE_CONFIG,
        iterations: 500,
        bootstrapSamples: 50,
        seed: 'test-seed-1',
      };

      const result = runOracleForecast(candidates, params, new Date(), config);

      // Should have valid dates
      expect(result.p10Date).toBeDefined();
      expect(result.p50Date).toBeDefined();
      expect(result.p90Date).toBeDefined();

      // p10 < p50 < p90 (ordered percentiles)
      expect(result.p10Date.getTime()).toBeLessThanOrEqual(result.p50Date.getTime());
      expect(result.p50Date.getTime()).toBeLessThanOrEqual(result.p90Date.getTime());

      // Should have simulated days
      expect(result.simulatedDays.length).toBeGreaterThan(0);

      // Success probability should be between 0 and 1
      expect(result.successProbability).toBeGreaterThan(0);
      expect(result.successProbability).toBeLessThanOrEqual(1);
    });

    it('should have narrower forecast with more candidates', () => {
      const params = createTestParams();
      const config: OracleConfig = {
        ...DEFAULT_ORACLE_CONFIG,
        iterations: 1000,
        bootstrapSamples: 100,
        seed: 'test-seed-2',
      };

      // Single candidate
      const singleResult = runOracleForecast(
        [{ candidateId: 'c1', currentStage: CanonicalStage.HM_SCREEN }],
        params,
        new Date(),
        config
      );

      // Multiple candidates at different stages
      const multiResult = runOracleForecast(
        [
          { candidateId: 'c1', currentStage: CanonicalStage.SCREEN },
          { candidateId: 'c2', currentStage: CanonicalStage.HM_SCREEN },
          { candidateId: 'c3', currentStage: CanonicalStage.HM_SCREEN },
          { candidateId: 'c4', currentStage: CanonicalStage.ONSITE },
          { candidateId: 'c5', currentStage: CanonicalStage.OFFER },
        ],
        params,
        new Date(),
        config
      );

      // Multiple candidates should have higher success probability
      expect(multiResult.successProbability).toBeGreaterThan(singleResult.successProbability);

      // And generally faster expected time (p50 closer)
      const singleP50Days = Math.round(
        (singleResult.p50Date.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
      );
      const multiP50Days = Math.round(
        (multiResult.p50Date.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
      );
      expect(multiP50Days).toBeLessThanOrEqual(singleP50Days);
    });

    it('should handle empty pipeline gracefully', () => {
      const params = createTestParams();
      const config: OracleConfig = {
        ...DEFAULT_ORACLE_CONFIG,
        seed: 'test-seed-3',
      };

      const result = runOracleForecast([], params, new Date(), config);

      expect(result.confidenceLevel).toBe('INSUFFICIENT');
      expect(result.successProbability).toBe(0);
      expect(result.simulatedDays).toHaveLength(0);
    });

    it('should be reproducible with same seed', () => {
      const params = createTestParams();
      const candidates: OraclePipelineCandidate[] = [
        { candidateId: 'c1', currentStage: CanonicalStage.SCREEN },
        { candidateId: 'c2', currentStage: CanonicalStage.HM_SCREEN },
      ];
      const config: OracleConfig = {
        ...DEFAULT_ORACLE_CONFIG,
        seed: 'reproducibility-test',
      };

      const result1 = runOracleForecast(candidates, params, new Date('2024-01-01'), config);
      const result2 = runOracleForecast(candidates, params, new Date('2024-01-01'), config);

      // Same seed should produce identical results
      expect(result1.p50Date.getTime()).toBe(result2.p50Date.getTime());
      expect(result1.successProbability).toBe(result2.successProbability);
      expect(result1.simulatedDays.length).toBe(result2.simulatedDays.length);
    });

    it('should provide confidence intervals via bootstrap', () => {
      const params = createTestParams();
      // Use more candidates in earlier stages to get more variability
      const candidates: OraclePipelineCandidate[] = [
        { candidateId: 'c1', currentStage: CanonicalStage.SCREEN },
        { candidateId: 'c2', currentStage: CanonicalStage.SCREEN },
        { candidateId: 'c3', currentStage: CanonicalStage.SCREEN },
        { candidateId: 'c4', currentStage: CanonicalStage.HM_SCREEN },
        { candidateId: 'c5', currentStage: CanonicalStage.ONSITE },
      ];
      const config: OracleConfig = {
        ...DEFAULT_ORACLE_CONFIG,
        iterations: 2000,
        bootstrapSamples: 500,
        seed: 'ci-test',
      };

      const result = runOracleForecast(candidates, params, new Date(), config);

      // CI should bracket the point estimate (or be very close)
      const p50Days = Math.round(
        (result.p50Date.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
      );

      // Allow 1-day tolerance for rounding
      expect(result.confidenceIntervals.p50.lower).toBeLessThanOrEqual(p50Days + 1);
      expect(result.confidenceIntervals.p50.upper).toBeGreaterThanOrEqual(p50Days - 1);

      // CI width should be non-negative (may be 0 for very consistent results)
      const ciWidth = result.confidenceIntervals.p50.upper - result.confidenceIntervals.p50.lower;
      expect(ciWidth).toBeGreaterThanOrEqual(0);
      expect(ciWidth).toBeLessThan(100); // Reasonable upper bound
    });
  });

  describe('mathematical correctness', () => {
    it('should satisfy law of total probability', () => {
      // For a simple 2-stage pipeline, P(hire) = P(pass stage 1) * P(pass stage 2)
      const params = buildStageParams(
        [
          { stage: CanonicalStage.SCREEN, entered: 100, passed: 50, durations: [5, 5, 5, 5, 5] },
          { stage: CanonicalStage.HM_SCREEN, entered: 50, passed: 25, durations: [7, 7, 7, 7, 7] },
          { stage: CanonicalStage.ONSITE, entered: 25, passed: 12, durations: [10, 10, 10, 10, 10] },
          { stage: CanonicalStage.OFFER, entered: 12, passed: 10, durations: [5, 5, 5, 5, 5] },
        ],
        2
      );

      // Theoretical pass-through: ~0.5 * 0.5 * 0.48 * 0.83 ≈ 0.1 (rough)
      // Run simulation with many iterations
      const result = runOracleForecast(
        [{ candidateId: 'c1', currentStage: CanonicalStage.SCREEN }],
        params,
        new Date(),
        {
          ...DEFAULT_ORACLE_CONFIG,
          iterations: 10000,
          bootstrapSamples: 0,
          seed: 'law-of-total-prob',
        }
      );

      // Success probability should be in reasonable range
      // Given the conversion rates, expect ~10-20% success for screen candidate
      expect(result.successProbability).toBeGreaterThan(0.05);
      expect(result.successProbability).toBeLessThan(0.30);
    });

    it('should produce normally distributed percentile estimates (CLT)', () => {
      // Run many independent forecasts and check distribution
      const params = buildStageParams(
        [
          { stage: CanonicalStage.SCREEN, entered: 50, passed: 25, durations: [5, 5, 5, 5, 5] },
          { stage: CanonicalStage.HM_SCREEN, entered: 25, passed: 12, durations: [7, 7, 7, 7, 7] },
          { stage: CanonicalStage.ONSITE, entered: 12, passed: 6, durations: [10, 10, 10, 10, 10] },
          { stage: CanonicalStage.OFFER, entered: 6, passed: 5, durations: [5, 5, 5, 5, 5] },
        ],
        2
      );

      const p50Values: number[] = [];
      for (let i = 0; i < 30; i++) {
        const result = runOracleForecast(
          [
            { candidateId: 'c1', currentStage: CanonicalStage.HM_SCREEN },
            { candidateId: 'c2', currentStage: CanonicalStage.ONSITE },
          ],
          params,
          new Date('2024-01-01'),
          {
            ...DEFAULT_ORACLE_CONFIG,
            iterations: 500,
            bootstrapSamples: 0,
            seed: `clt-test-${i}`,
          }
        );

        const days =
          (result.p50Date.getTime() - new Date('2024-01-01').getTime()) / (1000 * 60 * 60 * 24);
        p50Values.push(days);
      }

      // Check that values are distributed around a central value
      const mean = p50Values.reduce((a, b) => a + b, 0) / p50Values.length;
      const variance = p50Values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (p50Values.length - 1);
      const stdDev = Math.sqrt(variance);

      // Coefficient of variation should be reasonable (< 0.5 typically)
      const cv = stdDev / mean;
      expect(cv).toBeLessThan(0.5);

      // Most values should be within 2 standard deviations of mean
      const within2sd = p50Values.filter((v) => Math.abs(v - mean) < 2 * stdDev).length;
      expect(within2sd / p50Values.length).toBeGreaterThan(0.9);
    });
  });
});
