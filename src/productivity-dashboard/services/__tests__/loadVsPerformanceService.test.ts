/**
 * Tests for Load vs Performance Analysis
 *
 * Verifies the analysis that tests: "Recruiters hire faster with fewer reqs"
 */

import { analyzeLoadVsPerformance, formatLoadVsPerformanceSummary } from '../loadVsPerformanceService';
import { generateUltimateDemo } from '../ultimateDemoGenerator';

describe('loadVsPerformanceService', () => {
  describe('analyzeLoadVsPerformance', () => {
    it('should analyze correlation between workload and TTF', () => {
      // Generate demo data
      const demoData = generateUltimateDemo();
      const { requisitions, candidates } = demoData;

      const result = analyzeLoadVsPerformance(requisitions, candidates);

      // Should have bucket data
      expect(result.buckets).toHaveLength(4);
      expect(result.sampleSize).toBeGreaterThan(0);

      // Should have a correlation assessment
      expect(['positive', 'negative', 'none']).toContain(result.correlation.direction);
      expect(result.confidence).toBeDefined();
      expect(result.insight).toBeDefined();

      // Log the actual results for inspection
      console.log('\n========================================');
      console.log('LOAD VS PERFORMANCE ANALYSIS RESULTS');
      console.log('========================================\n');
      console.log(formatLoadVsPerformanceSummary(result));
      console.log('\n----------------------------------------');
      console.log('Bucket Details:');
      for (const bucket of result.buckets) {
        if (bucket.hireCount > 0) {
          console.log(`  ${bucket.label}: median=${bucket.medianTTF?.toFixed(1)}d, avg=${bucket.avgTTF?.toFixed(1)}d, n=${bucket.hireCount}`);
        }
      }
      console.log('----------------------------------------');
      console.log(`Correlation: ${result.correlation.direction} (${result.correlation.strength})`);
      console.log(`Confidence: ${result.confidence}`);
      console.log('========================================\n');
    });

    it('should handle empty data gracefully', () => {
      const result = analyzeLoadVsPerformance([], []);

      expect(result.buckets).toHaveLength(4);
      expect(result.sampleSize).toBe(0);
      expect(result.confidence).toBe('INSUFFICIENT');
    });

    it('should categorize workloads into correct buckets', () => {
      const demoData = generateUltimateDemo();
      const { requisitions, candidates } = demoData;

      const result = analyzeLoadVsPerformance(requisitions, candidates);

      // Total hires across buckets should equal sample size
      const totalInBuckets = result.buckets.reduce((sum, b) => sum + b.hireCount, 0);
      expect(totalInBuckets).toBe(result.sampleSize);
    });
  });
});
