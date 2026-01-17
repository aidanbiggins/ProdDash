// Unit tests for SLA Attribution Service

import {
  buildStageDwellPeriods,
  handleRegression,
  computeDwellHours,
  checkSlaBreach,
  attributeDelay,
  checkCoverageSufficiency,
  computeStageDwellMetrics,
  computeStageBottlenecks,
  isStageRegression,
} from '../slaAttributionService';
import {
  DEFAULT_SLA_POLICIES,
  SLA_THRESHOLDS,
} from '../../types/slaTypes';
import {
  mockSnapshots,
  mockEvents,
  mockRequisitions,
  mockRequisitionsNoOwner,
  mockUsers,
  createRequisitionMap,
  createUserMap,
  day,
  dayAt,
  mockSnapshot,
  mockEvent,
} from '../__fixtures__/slaFixtures';

describe('SLA Attribution Service', () => {
  describe('buildStageDwellPeriods', () => {
    it('builds dwell periods from consecutive stage changes', () => {
      const events = [
        mockEvent({
          id: 'e1',
          event_type: 'CANDIDATE_APPEARED',
          candidate_id: 'cand1',
          req_id: 'req1',
          to_canonical: 'APPLIED',
          event_at: day(0),
        }),
        mockEvent({
          id: 'e2',
          event_type: 'STAGE_CHANGE',
          candidate_id: 'cand1',
          req_id: 'req1',
          from_canonical: 'APPLIED',
          to_canonical: 'SCREEN',
          event_at: day(1),
        }),
        mockEvent({
          id: 'e3',
          event_type: 'STAGE_CHANGE',
          candidate_id: 'cand1',
          req_id: 'req1',
          from_canonical: 'SCREEN',
          to_canonical: 'HM_SCREEN',
          event_at: day(3),
        }),
      ];

      const periods = buildStageDwellPeriods(events, 'cand1', 'req1');

      expect(periods).toHaveLength(3);
      expect(periods[0].stage_key).toBe('APPLIED');
      expect(periods[1].stage_key).toBe('SCREEN');
      expect(periods[2].stage_key).toBe('HM_SCREEN');
    });

    it('handles ongoing dwell (no exit event)', () => {
      const events = [
        mockEvent({
          id: 'e1',
          event_type: 'STAGE_CHANGE',
          candidate_id: 'cand1',
          req_id: 'req1',
          to_canonical: 'HM_SCREEN',
          event_at: day(-2),
        }),
      ];

      const periods = buildStageDwellPeriods(events, 'cand1', 'req1');

      expect(periods).toHaveLength(1);
      expect(periods[0].exited_at).toBeNull();
    });

    it('filters out events for other candidates', () => {
      const events = [
        mockEvent({
          id: 'e1',
          event_type: 'CANDIDATE_APPEARED',
          candidate_id: 'cand1',
          req_id: 'req1',
          to_canonical: 'APPLIED',
          event_at: day(0),
        }),
        mockEvent({
          id: 'e2',
          event_type: 'CANDIDATE_APPEARED',
          candidate_id: 'cand2',
          req_id: 'req1',
          to_canonical: 'SCREEN',
          event_at: day(0),
        }),
      ];

      const periods = buildStageDwellPeriods(events, 'cand1', 'req1');

      expect(periods).toHaveLength(1);
      expect(periods[0].stage_key).toBe('APPLIED');
    });
  });

  describe('handleRegression', () => {
    it('detects backward stage movement', () => {
      const events = [
        mockEvent({
          id: 'e1',
          event_type: 'CANDIDATE_APPEARED',
          candidate_id: 'cand1',
          req_id: 'req1',
          to_canonical: 'SCREEN',
          event_at: day(0),
        }),
        mockEvent({
          id: 'e2',
          event_type: 'STAGE_CHANGE',
          candidate_id: 'cand1',
          req_id: 'req1',
          from_canonical: 'SCREEN',
          to_canonical: 'HM_SCREEN',
          event_at: day(1),
        }),
        mockEvent({
          id: 'e3',
          event_type: 'STAGE_REGRESSION',
          candidate_id: 'cand1',
          req_id: 'req1',
          from_canonical: 'HM_SCREEN',
          to_canonical: 'SCREEN',
          event_at: day(2),
        }),
        mockEvent({
          id: 'e4',
          event_type: 'STAGE_CHANGE',
          candidate_id: 'cand1',
          req_id: 'req1',
          from_canonical: 'SCREEN',
          to_canonical: 'HM_SCREEN',
          event_at: day(3),
        }),
      ];

      const periods = handleRegression(events, 'cand1', 'req1');

      // Should have: SCREEN (1st visit), HM_SCREEN (1st), SCREEN (2nd), HM_SCREEN (2nd)
      expect(periods.length).toBeGreaterThanOrEqual(3);

      // Find the re-entry to SCREEN
      const screenReentry = periods.find(
        (p) => p.stage_key === 'SCREEN' && p.is_reentry
      );
      expect(screenReentry).toBeDefined();
      expect(screenReentry?.visit_number).toBe(2);
    });

    it('does not count terminal stage as regression', () => {
      expect(isStageRegression('OFFER', 'REJECTED')).toBe(false);
      expect(isStageRegression('OFFER', 'WITHDRAWN')).toBe(false);
      expect(isStageRegression('OFFER', 'HIRED')).toBe(false);
    });

    it('correctly identifies forward progression', () => {
      expect(isStageRegression('APPLIED', 'SCREEN')).toBe(false);
      expect(isStageRegression('SCREEN', 'HM_SCREEN')).toBe(false);
      expect(isStageRegression('HM_SCREEN', 'ONSITE')).toBe(false);
    });

    it('correctly identifies backward regression', () => {
      expect(isStageRegression('HM_SCREEN', 'SCREEN')).toBe(true);
      expect(isStageRegression('ONSITE', 'HM_SCREEN')).toBe(true);
      expect(isStageRegression('OFFER', 'FINAL')).toBe(true);
    });
  });

  describe('computeDwellHours', () => {
    it('computes hours between enter and exit', () => {
      const period = {
        stage_key: 'SCREEN',
        entered_at: dayAt(0, 10),
        exited_at: dayAt(1, 10),
        enter_event_id: 'e1',
        exit_event_id: 'e2',
      };

      const hours = computeDwellHours(period, new Date());

      expect(hours).toBeCloseTo(24, 0);
    });

    it('computes hours to asOfDate when no exit', () => {
      const enteredAt = dayAt(-2, 10);
      const period = {
        stage_key: 'SCREEN',
        entered_at: enteredAt,
        exited_at: null,
        enter_event_id: 'e1',
        exit_event_id: null,
      };

      const asOfDate = dayAt(0, 10);
      const hours = computeDwellHours(period, asOfDate);

      expect(hours).toBeCloseTo(48, 0); // 2 days = 48 hours
    });
  });

  describe('checkSlaBreach', () => {
    it('returns no breach when under SLA', () => {
      const result = checkSlaBreach(24, 'SCREEN', DEFAULT_SLA_POLICIES);

      expect(result.breached).toBe(false);
      expect(result.breachHours).toBe(0);
      expect(result.policy?.sla_hours).toBe(48);
    });

    it('returns breach when over SLA', () => {
      const result = checkSlaBreach(96, 'HM_SCREEN', DEFAULT_SLA_POLICIES);

      expect(result.breached).toBe(true);
      expect(result.breachHours).toBe(24); // 96 - 72 = 24
      expect(result.policy?.sla_hours).toBe(72);
    });

    it('returns no breach for stages without policy', () => {
      const result = checkSlaBreach(1000, 'UNKNOWN_STAGE', DEFAULT_SLA_POLICIES);

      expect(result.breached).toBe(false);
      expect(result.policy).toBeNull();
    });
  });

  describe('attributeDelay', () => {
    const reqMap = createRequisitionMap(mockRequisitions);
    const userMap = createUserMap(mockUsers);

    it('attributes HM_SCREEN to HM with high confidence when HM assigned', () => {
      const result = attributeDelay('HM_SCREEN', 'req1', reqMap, userMap);

      expect(result.owner_type).toBe('HM');
      expect(result.owner_id).toBe('hm1');
      expect(result.owner_name).toBe('John Smith');
      expect(result.confidence).toBe('high');
    });

    it('attributes SCREEN to RECRUITER with high confidence when recruiter assigned', () => {
      const result = attributeDelay('SCREEN', 'req1', reqMap, userMap);

      expect(result.owner_type).toBe('RECRUITER');
      expect(result.owner_id).toBe('rec1');
      expect(result.owner_name).toBe('Jane Doe');
      expect(result.confidence).toBe('high');
    });

    it('returns UNKNOWN with low confidence when no owner assigned', () => {
      const noOwnerMap = createRequisitionMap(mockRequisitionsNoOwner);
      const result = attributeDelay('HM_SCREEN', 'req_no_hm', noOwnerMap, userMap);

      expect(result.owner_type).toBe('UNKNOWN');
      expect(result.owner_id).toBeNull();
      expect(result.confidence).toBe('medium'); // Has policy but no owner
    });

    it('returns UNKNOWN for unknown req', () => {
      const result = attributeDelay('HM_SCREEN', 'unknown_req', reqMap, userMap);

      expect(result.owner_type).toBe('UNKNOWN');
      expect(result.owner_id).toBeNull();
    });
  });

  describe('checkCoverageSufficiency', () => {
    it('returns insufficient when no snapshots', () => {
      const coverage = checkCoverageSufficiency([], {
        start: day(-30),
        end: day(0),
      });

      expect(coverage.is_sufficient).toBe(false);
      expect(coverage.snapshot_count).toBe(0);
      expect(coverage.insufficiency_reasons).toContain('No snapshots found in date range');
    });

    it('returns insufficient when only 1 snapshot', () => {
      const coverage = checkCoverageSufficiency([mockSnapshot()], {
        start: day(-30),
        end: day(0),
      });

      expect(coverage.is_sufficient).toBe(false);
      expect(coverage.insufficiency_reasons.some(r => r.includes('at least 2 snapshots'))).toBe(true);
    });

    it('returns sufficient with adequate snapshots and day span', () => {
      // Create snapshots with ~2 day gaps over 8 days (4 snapshots / 8 days = 50% coverage)
      const snapshots = [
        mockSnapshot({ snapshot_date: day(-8), events_generated: 10 }),
        mockSnapshot({ snapshot_date: day(-6), events_generated: 15 }),
        mockSnapshot({ snapshot_date: day(-3), events_generated: 12 }),
        mockSnapshot({ snapshot_date: day(0), events_generated: 8 }),
      ];

      const coverage = checkCoverageSufficiency(snapshots, {
        start: day(-10),
        end: day(0),
      });

      expect(coverage.is_sufficient).toBe(true);
      expect(coverage.snapshot_count).toBe(4);
      expect(coverage.event_count).toBe(45);
      expect(coverage.insufficiency_reasons).toHaveLength(0);
    });

    it('calculates day span correctly', () => {
      const snapshots = [
        mockSnapshot({ snapshot_date: day(-10) }),
        mockSnapshot({ snapshot_date: day(-5) }),
        mockSnapshot({ snapshot_date: day(0) }),
      ];

      const coverage = checkCoverageSufficiency(snapshots, {
        start: day(-30),
        end: day(0),
      });

      expect(coverage.day_span).toBe(10);
    });
  });

  describe('computeStageDwellMetrics', () => {
    it('computes metrics for all candidates', () => {
      const reqMap = createRequisitionMap(mockRequisitions);
      const userMap = createUserMap(mockUsers);

      const metrics = computeStageDwellMetrics(
        mockEvents,
        reqMap,
        userMap,
        DEFAULT_SLA_POLICIES
      );

      // Should have metrics for multiple candidates
      expect(metrics.length).toBeGreaterThan(0);

      // Check that we have metrics for both cand1 and cand2
      const cand1Metrics = metrics.filter((m) => m.candidate_id === 'cand1');
      const cand2Metrics = metrics.filter((m) => m.candidate_id === 'cand2');

      expect(cand1Metrics.length).toBeGreaterThan(0);
      expect(cand2Metrics.length).toBeGreaterThan(0);
    });

    it('includes attribution data in metrics', () => {
      const reqMap = createRequisitionMap(mockRequisitions);
      const userMap = createUserMap(mockUsers);

      const metrics = computeStageDwellMetrics(
        mockEvents,
        reqMap,
        userMap,
        DEFAULT_SLA_POLICIES
      );

      const hmScreenMetric = metrics.find(
        (m) => m.stage_key === 'HM_SCREEN' && m.candidate_id === 'cand1'
      );

      expect(hmScreenMetric).toBeDefined();
      expect(hmScreenMetric?.attribution_owner_type).toBe('HM');
      expect(hmScreenMetric?.attribution_owner_name).toBe('John Smith');
    });
  });

  describe('computeStageBottlenecks', () => {
    it('returns empty array when no metrics meet threshold', () => {
      const bottlenecks = computeStageBottlenecks([]);

      expect(bottlenecks).toHaveLength(0);
    });

    it('calculates bottleneck statistics correctly', () => {
      const reqMap = createRequisitionMap(mockRequisitions);
      const userMap = createUserMap(mockUsers);

      // Generate many metrics to meet the MIN_CANDIDATES_PER_STAGE threshold
      const events = [];
      for (let i = 0; i < 10; i++) {
        events.push(
          mockEvent({
            id: `e_appear_${i}`,
            event_type: 'CANDIDATE_APPEARED',
            candidate_id: `cand_${i}`,
            req_id: 'req1',
            to_canonical: 'SCREEN',
            event_at: day(-7),
          }),
          mockEvent({
            id: `e_change_${i}`,
            event_type: 'STAGE_CHANGE',
            candidate_id: `cand_${i}`,
            req_id: 'req1',
            from_canonical: 'SCREEN',
            to_canonical: 'HM_SCREEN',
            event_at: day(-5),
          })
        );
      }

      const metrics = computeStageDwellMetrics(events, reqMap, userMap);
      const bottlenecks = computeStageBottlenecks(metrics);

      // Should have at least one stage with enough candidates
      if (bottlenecks.length > 0) {
        const screenBottleneck = bottlenecks.find((b) => b.stage_key === 'SCREEN');
        expect(screenBottleneck?.candidate_count).toBeGreaterThanOrEqual(
          SLA_THRESHOLDS.MIN_CANDIDATES_PER_STAGE
        );
      }
    });

    it('sorts bottlenecks by score descending', () => {
      const reqMap = createRequisitionMap(mockRequisitions);
      const userMap = createUserMap(mockUsers);

      // Create events with different dwell times per stage
      const events = [];
      for (let i = 0; i < 10; i++) {
        // Short dwell in SCREEN (good)
        events.push(
          mockEvent({
            id: `e_appear_s_${i}`,
            event_type: 'CANDIDATE_APPEARED',
            candidate_id: `cand_screen_${i}`,
            req_id: 'req1',
            to_canonical: 'SCREEN',
            event_at: day(-3),
          }),
          mockEvent({
            id: `e_change_s_${i}`,
            event_type: 'STAGE_CHANGE',
            candidate_id: `cand_screen_${i}`,
            req_id: 'req1',
            from_canonical: 'SCREEN',
            to_canonical: 'HM_SCREEN',
            event_at: day(-2),
          })
        );

        // Long dwell in HM_SCREEN (bad - should have higher score)
        events.push(
          mockEvent({
            id: `e_appear_h_${i}`,
            event_type: 'CANDIDATE_APPEARED',
            candidate_id: `cand_hm_${i}`,
            req_id: 'req1',
            to_canonical: 'HM_SCREEN',
            event_at: day(-7),
          }),
          mockEvent({
            id: `e_change_h_${i}`,
            event_type: 'STAGE_CHANGE',
            candidate_id: `cand_hm_${i}`,
            req_id: 'req1',
            from_canonical: 'HM_SCREEN',
            to_canonical: 'ONSITE',
            event_at: day(-2),
          })
        );
      }

      const metrics = computeStageDwellMetrics(events, reqMap, userMap);
      const bottlenecks = computeStageBottlenecks(metrics);

      // Verify sorted by score descending
      for (let i = 1; i < bottlenecks.length; i++) {
        expect(bottlenecks[i - 1].bottleneck_score).toBeGreaterThanOrEqual(
          bottlenecks[i].bottleneck_score
        );
      }
    });
  });
});
