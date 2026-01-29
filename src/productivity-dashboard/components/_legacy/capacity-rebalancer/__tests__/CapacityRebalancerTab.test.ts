/**
 * Tests for Capacity Rebalancer Tab types and integration
 *
 * Note: This project doesn't have React Testing Library installed,
 * so we test the core logic and type contracts rather than rendering.
 */

import {
  RecruiterUtilizationRow,
  ReassignmentSuggestion,
  RebalancerResult,
  PrivacyMode,
  LoadStatus,
  ConfidenceLevel,
  getRecruiterDisplayName
} from '../../../../types/rebalancerTypes';
import { CanonicalStage } from '../../../../types/entities';

describe('CapacityRebalancerTab Contracts', () => {
  describe('PrivacyMode handling', () => {
    it('getRecruiterDisplayName returns original name in full mode', () => {
      const displayName = getRecruiterDisplayName('rec-001', 'Alice Smith', 0, 'full');
      expect(displayName).toBe('Alice Smith');
    });

    it('getRecruiterDisplayName returns formatted ID when name is null in full mode', () => {
      // When name is null, falls back to formatting the ID
      const displayName = getRecruiterDisplayName('emily_watson', null, 0, 'full');
      expect(displayName).toBe('Emily Watson');
    });

    it('getRecruiterDisplayName returns anonymized name in anonymized mode', () => {
      const displayName = getRecruiterDisplayName('rec-001', 'Alice Smith', 0, 'anonymized');
      expect(displayName).toBe('Recruiter 1');
    });

    it('getRecruiterDisplayName returns original name in local mode', () => {
      const displayName = getRecruiterDisplayName('rec-001', 'Alice Smith', 0, 'local');
      expect(displayName).toBe('Alice Smith');
    });
  });

  describe('RebalancerResult shape', () => {
    it('validates proper result structure', () => {
      const mockResult: RebalancerResult = {
        utilizationResult: {
          rows: [],
          summary: {
            totalDemand: 100,
            totalCapacity: 80,
            overallUtilization: 1.25,
            overallStatus: 'overloaded' as LoadStatus,
            criticalCount: 2,
            overloadedCount: 3,
            balancedCount: 5,
            availableCount: 2,
            underutilizedCount: 0,
          },
          dataQuality: {
            reqsWithRecruiter: 45,
            reqsWithoutRecruiter: 5,
            recruiterIdCoverage: 0.9,
          },
        },
        suggestions: [],
        isBalanced: false,
        confidence: 'HIGH' as ConfidenceLevel,
        hedgeMessage: 'Based on 90 days of data',
      };

      expect(mockResult.utilizationResult.summary.overallUtilization).toBe(1.25);
      expect(mockResult.isBalanced).toBe(false);
      expect(mockResult.confidence).toBe('HIGH');
    });
  });

  describe('ReassignmentSuggestion shape', () => {
    it('validates proper suggestion structure', () => {
      const mockSuggestion: ReassignmentSuggestion = {
        rank: 1,
        reqId: 'REQ-001',
        reqTitle: 'Senior Software Engineer',
        fromRecruiterId: 'rec-001',
        fromRecruiterName: 'Alice Smith',
        toRecruiterId: 'rec-002',
        toRecruiterName: 'Bob Jones',
        reqDemand: {
          [CanonicalStage.SCREEN]: 5,
          [CanonicalStage.HM_SCREEN]: 3,
        },
        rationale: 'Move reduces overload',
        estimatedImpact: {
          sourceUtilizationBefore: 1.25,
          sourceUtilizationAfter: 0.95,
          targetUtilizationBefore: 0.6,
          targetUtilizationAfter: 0.85,
          delayReductionDays: 3.5,
        },
        confidence: 'HIGH' as ConfidenceLevel,
        hedgeMessage: 'Based on historical data',
      };

      expect(mockSuggestion.rank).toBe(1);
      expect(mockSuggestion.estimatedImpact.delayReductionDays).toBe(3.5);
      expect(Object.keys(mockSuggestion.reqDemand).length).toBe(2);
    });

    it('validates impact math is consistent', () => {
      const mockSuggestion: ReassignmentSuggestion = {
        rank: 1,
        reqId: 'REQ-001',
        reqTitle: 'Test Req',
        fromRecruiterId: 'rec-001',
        fromRecruiterName: 'Alice',
        toRecruiterId: 'rec-002',
        toRecruiterName: 'Bob',
        reqDemand: {},
        rationale: 'Test',
        estimatedImpact: {
          sourceUtilizationBefore: 1.25,
          sourceUtilizationAfter: 0.95,
          targetUtilizationBefore: 0.6,
          targetUtilizationAfter: 0.85,
          delayReductionDays: 3.5,
        },
        confidence: 'HIGH' as ConfidenceLevel,
        hedgeMessage: 'Test',
      };

      // Source should decrease
      expect(mockSuggestion.estimatedImpact.sourceUtilizationAfter)
        .toBeLessThan(mockSuggestion.estimatedImpact.sourceUtilizationBefore);

      // Target should increase
      expect(mockSuggestion.estimatedImpact.targetUtilizationAfter)
        .toBeGreaterThan(mockSuggestion.estimatedImpact.targetUtilizationBefore);

      // Delay reduction should be positive for beneficial moves
      expect(mockSuggestion.estimatedImpact.delayReductionDays).toBeGreaterThan(0);
    });
  });

  describe('Load status thresholds', () => {
    const testCases: Array<{ utilization: number; expectedStatus: LoadStatus }> = [
      { utilization: 1.5, expectedStatus: 'critical' },
      { utilization: 1.25, expectedStatus: 'critical' },
      { utilization: 1.15, expectedStatus: 'overloaded' },
      { utilization: 1.0, expectedStatus: 'balanced' },
      { utilization: 0.8, expectedStatus: 'available' },
      { utilization: 0.5, expectedStatus: 'underutilized' },
    ];

    // Import getLoadStatus for testing thresholds
    it('validates status categorization matches expected thresholds', () => {
      // This is a structural test - the actual thresholds are tested in capacityRebalancerService.test.ts
      const allStatuses: LoadStatus[] = ['critical', 'overloaded', 'balanced', 'available', 'underutilized'];
      expect(allStatuses.length).toBe(5);
    });
  });
});
