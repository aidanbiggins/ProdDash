// Unit tests for HM Latency Explain Provider

import { HMLatencyProvider } from '../providers/hmLatencyProvider';
import { ExplainContext } from '../types';
import { HiringManagerFriction, MetricFilters, HMTimeComposition, StageTimeBreakdown } from '../../../types/metrics';
import { DEFAULT_CONFIG } from '../../../types/config';

// Helper to create test context
function createTestContext(overrides: Partial<ExplainContext> = {}): ExplainContext {
  const now = new Date();
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  const defaultFilters: MetricFilters = {
    dateRange: {
      startDate: ninetyDaysAgo,
      endDate: now,
    },
    useWeighted: false,
    normalizeByLoad: false,
  };

  return {
    requisitions: [],
    candidates: [],
    events: [],
    users: [],
    filters: defaultFilters,
    config: DEFAULT_CONFIG,
    overview: null,
    hmFriction: [],
    ...overrides,
  };
}

// Helper to create HM friction record
function createHMFriction(
  hmId: string,
  hmName: string,
  feedbackLatencyHours: number | null,
  decisionLatencyHours: number | null
): HiringManagerFriction {
  const stageBreakdown: StageTimeBreakdown = {
    sourcingHours: 24,
    screeningHours: 48,
    hmReviewHours: 24,
    interviewHours: 72,
    feedbackHours: feedbackLatencyHours || 0,
    decisionHours: decisionLatencyHours || 0,
  };

  const composition: HMTimeComposition = {
    activeTimeHours: 168,
    feedbackLatencyHours: feedbackLatencyHours || 0,
    decisionLatencyHours: decisionLatencyHours || 0,
    totalLatencyHours: (feedbackLatencyHours || 0) + (decisionLatencyHours || 0),
    timeTaxPercent: 20,
    stageBreakdown,
  };

  return {
    hmId,
    hmName,
    reqsInRange: 3,
    feedbackLatencyMedian: feedbackLatencyHours,
    decisionLatencyMedian: decisionLatencyHours,
    offerAcceptanceRate: 0.8,
    hmWeight: 1.0,
    loopCount: 5,
    composition,
  };
}

describe('HMLatencyProvider', () => {
  let provider: HMLatencyProvider;

  beforeEach(() => {
    provider = new HMLatencyProvider();
  });

  describe('canExplain', () => {
    it('returns NO_HM_DATA when hmFriction is empty', () => {
      const context = createTestContext({
        hmFriction: [],
      });

      const result = provider.canExplain(context);

      expect(result).toHaveLength(1);
      expect(result[0].code).toBe('NO_HM_DATA');
    });

    it('returns NO_FEEDBACK_EVENTS when all HMs have null latency', () => {
      const context = createTestContext({
        hmFriction: [
          createHMFriction('hm1', 'John Doe', null, null),
          createHMFriction('hm2', 'Jane Smith', null, null),
        ],
      });

      const result = provider.canExplain(context);

      expect(result).toHaveLength(1);
      expect(result[0].code).toBe('NO_FEEDBACK_EVENTS');
    });

    it('returns empty array when HMs have latency data', () => {
      const context = createTestContext({
        hmFriction: [
          createHMFriction('hm1', 'John Doe', 48, 72),
        ],
      });

      const result = provider.canExplain(context);

      expect(result).toHaveLength(0);
    });
  });

  describe('explain', () => {
    it('calculates breakdown from HM latency data', () => {
      const context = createTestContext({
        hmFriction: [
          createHMFriction('hm1', 'John Doe', 48, 72),    // 2d feedback, 3d decision
          createHMFriction('hm2', 'Jane Smith', 72, 48),  // 3d feedback, 2d decision
          createHMFriction('hm3', 'Bob Brown', 24, 96),   // 1d feedback, 4d decision
        ],
      });

      const result = provider.explain(context);

      expect(result.status).toBe('ready');
      expect(result.includedCount).toBe(3);
      expect(result.breakdown).toBeDefined();
      // Should have HM breakdown rows
      const hmRows = result.breakdown?.filter(b => b.label.includes('HM:'));
      expect(hmRows?.length).toBeGreaterThan(0);
    });

    it('shows top contributors sorted by slowest', () => {
      const context = createTestContext({
        hmFriction: [
          createHMFriction('hm1', 'Fast HM', 24, 24),
          createHMFriction('hm2', 'Slow HM', 120, 120),
          createHMFriction('hm3', 'Medium HM', 72, 72),
        ],
      });

      const result = provider.explain(context);

      expect(result.topContributors).toBeDefined();
      expect(result.topContributors![0].label).toBe('Slow HM');
    });

    it('sets low confidence when few HMs', () => {
      const context = createTestContext({
        hmFriction: [
          createHMFriction('hm1', 'John Doe', 48, 72),
        ],
      });

      const result = provider.explain(context);

      expect(result.confidenceGrade).toBe('low');
      expect(result.status).toBe('partial');
    });
  });
});
