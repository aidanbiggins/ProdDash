// Tests for Snapshot Diff Service
// See docs/plans/SNAPSHOT_DIFF_EVENT_STREAM_V1.md Section 9.1

import {
  isStageRegression,
  inferEventTime,
  diffSnapshots,
  diffResultToEvents
} from '../snapshotDiffService';
import {
  DataSnapshot,
  SnapshotCandidate,
  SnapshotRequisition
} from '../../types/snapshotTypes';
import { CanonicalStage, CandidateDisposition, RequisitionStatus } from '../../types/entities';

// ============================================
// TEST HELPERS
// ============================================

function createSnapshot(overrides: Partial<DataSnapshot> = {}): DataSnapshot {
  return {
    id: 'snapshot-1',
    organization_id: 'org-1',
    snapshot_date: new Date('2025-01-15'),
    snapshot_seq: 1,
    source_filename: 'test.csv',
    source_hash: 'abc123',
    imported_at: new Date(),
    imported_by: 'user-1',
    req_count: 0,
    candidate_count: 0,
    user_count: 0,
    status: 'completed',
    diff_completed_at: new Date(),
    events_generated: 0,
    error_message: null,
    ...overrides
  };
}

function createCandidate(overrides: Partial<SnapshotCandidate> = {}): SnapshotCandidate {
  return {
    id: 'cand-snapshot-1',
    snapshot_id: 'snapshot-1',
    organization_id: 'org-1',
    candidate_id: 'cand-1',
    req_id: 'req-1',
    current_stage: 'Phone Screen',
    canonical_stage: CanonicalStage.SCREEN,
    disposition: CandidateDisposition.Active,
    applied_at: new Date('2025-01-01'),
    current_stage_entered_at: new Date('2025-01-10'),
    hired_at: null,
    rejected_at: null,
    withdrawn_at: null,
    offer_extended_at: null,
    source_row_number: 1,
    raw_data: null,
    ...overrides
  };
}

function createRequisition(overrides: Partial<SnapshotRequisition> = {}): SnapshotRequisition {
  return {
    id: 'req-snapshot-1',
    snapshot_id: 'snapshot-1',
    organization_id: 'org-1',
    req_id: 'req-1',
    status: RequisitionStatus.Open,
    recruiter_id: 'recruiter-1',
    hiring_manager_id: 'hm-1',
    opened_at: new Date('2025-01-01'),
    closed_at: null,
    source_row_number: 1,
    raw_data: null,
    ...overrides
  };
}

// ============================================
// STAGE REGRESSION DETECTION TESTS
// ============================================

describe('isStageRegression', () => {
  test('forward in funnel is not regression', () => {
    expect(isStageRegression(CanonicalStage.SCREEN, CanonicalStage.ONSITE)).toBe(false);
  });

  test('backward in funnel is regression', () => {
    expect(isStageRegression(CanonicalStage.ONSITE, CanonicalStage.SCREEN)).toBe(true);
  });

  test('to terminal stage is not regression', () => {
    expect(isStageRegression(CanonicalStage.ONSITE, CanonicalStage.REJECTED)).toBe(false);
    expect(isStageRegression(CanonicalStage.OFFER, CanonicalStage.WITHDREW)).toBe(false);
  });

  test('from terminal back to funnel is regression (reactivation)', () => {
    expect(isStageRegression(CanonicalStage.REJECTED, CanonicalStage.SCREEN)).toBe(true);
    expect(isStageRegression(CanonicalStage.WITHDREW, CanonicalStage.APPLIED)).toBe(true);
  });

  test('unknown stage is not regression', () => {
    expect(isStageRegression('CUSTOM_STAGE', CanonicalStage.ONSITE)).toBe(false);
    expect(isStageRegression(CanonicalStage.SCREEN, 'CUSTOM_STAGE')).toBe(false);
  });

  test('null values are not regression', () => {
    expect(isStageRegression(null, CanonicalStage.SCREEN)).toBe(false);
    expect(isStageRegression(CanonicalStage.SCREEN, null)).toBe(false);
    expect(isStageRegression(null, null)).toBe(false);
  });

  test('same stage is not regression', () => {
    expect(isStageRegression(CanonicalStage.SCREEN, CanonicalStage.SCREEN)).toBe(false);
  });

  test('APPLIED to SCREEN is forward', () => {
    expect(isStageRegression(CanonicalStage.APPLIED, CanonicalStage.SCREEN)).toBe(false);
  });

  test('HM_SCREEN to SCREEN is regression', () => {
    expect(isStageRegression(CanonicalStage.HM_SCREEN, CanonicalStage.SCREEN)).toBe(true);
  });
});

// ============================================
// EVENT TIME INFERENCE TESTS
// ============================================

describe('inferEventTime', () => {
  const prevSnapshot = createSnapshot({
    id: 'snapshot-1',
    snapshot_date: new Date('2025-01-10'),
    snapshot_seq: 1
  });

  const currSnapshot = createSnapshot({
    id: 'snapshot-2',
    snapshot_date: new Date('2025-01-17'),
    snapshot_seq: 2
  });

  test('uses current_stage_entered_at when changed', () => {
    const prevCand = createCandidate({
      current_stage_entered_at: new Date('2025-01-05')
    });
    const currCand = createCandidate({
      current_stage_entered_at: new Date('2025-01-12')
    });

    const result = inferEventTime(prevCand, currCand, prevSnapshot, currSnapshot);

    expect(result.event_at).toEqual(new Date('2025-01-12'));
    expect(result.confidence).toBe('high');
    expect(result.confidence_reasons).toContain('Timestamp from current_stage_entered_at');
  });

  test('uses hired_at for Hired disposition', () => {
    const prevCand = createCandidate({ disposition: CandidateDisposition.Active });
    const currCand = createCandidate({
      disposition: CandidateDisposition.Hired,
      hired_at: new Date('2025-01-15'),
      current_stage_entered_at: null
    });

    const result = inferEventTime(prevCand, currCand, prevSnapshot, currSnapshot);

    expect(result.event_at).toEqual(new Date('2025-01-15'));
    expect(result.confidence).toBe('high');
    expect(result.confidence_reasons).toContain('Timestamp from hired_at');
  });

  test('uses rejected_at for Rejected disposition', () => {
    const prevCand = createCandidate({ disposition: CandidateDisposition.Active });
    const currCand = createCandidate({
      disposition: CandidateDisposition.Rejected,
      rejected_at: new Date('2025-01-14'),
      current_stage_entered_at: null
    });

    const result = inferEventTime(prevCand, currCand, prevSnapshot, currSnapshot);

    expect(result.event_at).toEqual(new Date('2025-01-14'));
    expect(result.confidence).toBe('high');
  });

  test('uses withdrawn_at for Withdrawn disposition', () => {
    const prevCand = createCandidate({ disposition: CandidateDisposition.Active });
    const currCand = createCandidate({
      disposition: CandidateDisposition.Withdrawn,
      withdrawn_at: new Date('2025-01-13'),
      current_stage_entered_at: null
    });

    const result = inferEventTime(prevCand, currCand, prevSnapshot, currSnapshot);

    expect(result.event_at).toEqual(new Date('2025-01-13'));
    expect(result.confidence).toBe('high');
  });

  test('falls back to midpoint when no timestamp available', () => {
    const prevCand = createCandidate({ current_stage_entered_at: null });
    const currCand = createCandidate({ current_stage_entered_at: null });

    const result = inferEventTime(prevCand, currCand, prevSnapshot, currSnapshot);

    // Midpoint of Jan 10 and Jan 17 is Jan 13.5 (rounded)
    expect(result.confidence).toBe('inferred');
    expect(result.confidence_reasons).toContain('Midpoint between snapshot dates');
  });

  test('uses snapshot date for first snapshot', () => {
    const currCand = createCandidate({ current_stage_entered_at: null });

    const result = inferEventTime(null, currCand, null, currSnapshot);

    expect(result.event_at).toEqual(currSnapshot.snapshot_date);
    expect(result.confidence).toBe('inferred');
    expect(result.confidence_reasons).toContain('First snapshot date');
  });
});

// ============================================
// DIFF ALGORITHM TESTS
// ============================================

describe('diffSnapshots', () => {
  const prevSnapshot = createSnapshot({
    id: 'snapshot-1',
    snapshot_date: new Date('2025-01-10'),
    snapshot_seq: 1
  });

  const currSnapshot = createSnapshot({
    id: 'snapshot-2',
    snapshot_date: new Date('2025-01-17'),
    snapshot_seq: 2
  });

  test('detects stage forward change', () => {
    const prevCandidates = [
      createCandidate({
        canonical_stage: CanonicalStage.SCREEN,
        current_stage: 'Phone Screen'
      })
    ];
    const currCandidates = [
      createCandidate({
        canonical_stage: CanonicalStage.ONSITE,
        current_stage: 'Onsite Interview',
        current_stage_entered_at: new Date('2025-01-15')
      })
    ];

    const result = diffSnapshots(
      prevCandidates,
      currCandidates,
      [],
      [],
      prevSnapshot,
      currSnapshot
    );

    expect(result.stageChanges).toHaveLength(1);
    expect(result.stageChanges[0].from_canonical).toBe(CanonicalStage.SCREEN);
    expect(result.stageChanges[0].to_canonical).toBe(CanonicalStage.ONSITE);
    expect(result.stageRegressions).toHaveLength(0);
  });

  test('detects stage regression', () => {
    const prevCandidates = [
      createCandidate({
        canonical_stage: CanonicalStage.ONSITE,
        current_stage: 'Onsite Interview'
      })
    ];
    const currCandidates = [
      createCandidate({
        canonical_stage: CanonicalStage.SCREEN,
        current_stage: 'Phone Screen',
        current_stage_entered_at: new Date('2025-01-15')
      })
    ];

    const result = diffSnapshots(
      prevCandidates,
      currCandidates,
      [],
      [],
      prevSnapshot,
      currSnapshot
    );

    expect(result.stageRegressions).toHaveLength(1);
    expect(result.stageRegressions[0].from_canonical).toBe(CanonicalStage.ONSITE);
    expect(result.stageRegressions[0].to_canonical).toBe(CanonicalStage.SCREEN);
    expect(result.stageChanges).toHaveLength(0);
  });

  test('detects disposition change', () => {
    const prevCandidates = [
      createCandidate({ disposition: CandidateDisposition.Active })
    ];
    const currCandidates = [
      createCandidate({
        disposition: CandidateDisposition.Rejected,
        rejected_at: new Date('2025-01-14')
      })
    ];

    const result = diffSnapshots(
      prevCandidates,
      currCandidates,
      [],
      [],
      prevSnapshot,
      currSnapshot
    );

    expect(result.dispositionChanges).toHaveLength(1);
    expect(result.dispositionChanges[0].from_disposition).toBe(CandidateDisposition.Active);
    expect(result.dispositionChanges[0].to_disposition).toBe(CandidateDisposition.Rejected);
  });

  test('detects new candidate appeared', () => {
    const prevCandidates: SnapshotCandidate[] = [];
    const currCandidates = [createCandidate()];

    const result = diffSnapshots(
      prevCandidates,
      currCandidates,
      [],
      [],
      prevSnapshot,
      currSnapshot
    );

    expect(result.candidatesAppeared).toHaveLength(1);
    expect(result.candidatesAppeared[0].candidate_id).toBe('cand-1');
  });

  test('detects candidate disappeared', () => {
    const prevCandidates = [createCandidate()];
    const currCandidates: SnapshotCandidate[] = [];

    const result = diffSnapshots(
      prevCandidates,
      currCandidates,
      [],
      [],
      prevSnapshot,
      currSnapshot
    );

    expect(result.candidatesDisappeared).toHaveLength(1);
    expect(result.candidatesDisappeared[0].candidate_id).toBe('cand-1');
  });

  test('detects req status change', () => {
    const prevReqs = [createRequisition({ status: RequisitionStatus.Open })];
    const currReqs = [
      createRequisition({
        status: RequisitionStatus.Closed,
        closed_at: new Date('2025-01-16')
      })
    ];

    const result = diffSnapshots(
      [],
      [],
      prevReqs,
      currReqs,
      prevSnapshot,
      currSnapshot
    );

    expect(result.reqStatusChanges).toHaveLength(1);
    expect(result.reqStatusChanges[0].from_status).toBe(RequisitionStatus.Open);
    expect(result.reqStatusChanges[0].to_status).toBe(RequisitionStatus.Closed);
  });

  test('no events when no changes', () => {
    const candidates = [createCandidate()];
    const reqs = [createRequisition()];

    const result = diffSnapshots(
      candidates,
      candidates,
      reqs,
      reqs,
      prevSnapshot,
      currSnapshot
    );

    expect(result.stageChanges).toHaveLength(0);
    expect(result.stageRegressions).toHaveLength(0);
    expect(result.dispositionChanges).toHaveLength(0);
    expect(result.reqStatusChanges).toHaveLength(0);
    expect(result.candidatesAppeared).toHaveLength(0);
    expect(result.candidatesDisappeared).toHaveLength(0);
  });

  test('multiple changes for same candidate', () => {
    const prevCandidates = [
      createCandidate({
        canonical_stage: CanonicalStage.SCREEN,
        disposition: CandidateDisposition.Active
      })
    ];
    const currCandidates = [
      createCandidate({
        canonical_stage: CanonicalStage.OFFER,
        disposition: CandidateDisposition.Active,
        current_stage_entered_at: new Date('2025-01-15')
      })
    ];

    const result = diffSnapshots(
      prevCandidates,
      currCandidates,
      [],
      [],
      prevSnapshot,
      currSnapshot
    );

    // Should have stage change but no disposition change
    expect(result.stageChanges).toHaveLength(1);
    expect(result.dispositionChanges).toHaveLength(0);
  });

  test('first snapshot produces only appeared events', () => {
    const currCandidates = [
      createCandidate({ candidate_id: 'cand-1' }),
      createCandidate({ candidate_id: 'cand-2', req_id: 'req-2' })
    ];
    const currReqs = [
      createRequisition({ req_id: 'req-1' }),
      createRequisition({ req_id: 'req-2' })
    ];

    const result = diffSnapshots(
      [],
      currCandidates,
      [],
      currReqs,
      null,
      currSnapshot
    );

    expect(result.candidatesAppeared).toHaveLength(2);
    expect(result.reqsAppeared).toHaveLength(2);
    expect(result.stageChanges).toHaveLength(0);
    expect(result.candidatesDisappeared).toHaveLength(0);
  });

  test('matches candidates by candidate_id and req_id tuple', () => {
    // Same candidate on different reqs should be tracked separately
    const prevCandidates = [
      createCandidate({ candidate_id: 'cand-1', req_id: 'req-1', canonical_stage: CanonicalStage.SCREEN }),
      createCandidate({ candidate_id: 'cand-1', req_id: 'req-2', canonical_stage: CanonicalStage.APPLIED })
    ];
    const currCandidates = [
      createCandidate({
        candidate_id: 'cand-1',
        req_id: 'req-1',
        canonical_stage: CanonicalStage.ONSITE,
        current_stage_entered_at: new Date('2025-01-15')
      }),
      createCandidate({
        candidate_id: 'cand-1',
        req_id: 'req-2',
        canonical_stage: CanonicalStage.APPLIED
      }) // No change
    ];

    const result = diffSnapshots(
      prevCandidates,
      currCandidates,
      [],
      [],
      prevSnapshot,
      currSnapshot
    );

    // Only one stage change (req-1), req-2 had no change
    expect(result.stageChanges).toHaveLength(1);
    expect(result.stageChanges[0].req_id).toBe('req-1');
  });
});

// ============================================
// EVENT CONVERSION TESTS
// ============================================

describe('diffResultToEvents', () => {
  test('converts stage change to event', () => {
    const diffResult = {
      stageChanges: [{
        candidate_id: 'cand-1',
        req_id: 'req-1',
        from_stage: 'Phone Screen',
        to_stage: 'Onsite',
        from_canonical: CanonicalStage.SCREEN,
        to_canonical: CanonicalStage.ONSITE,
        event_at: new Date('2025-01-15'),
        confidence: 'high' as const,
        confidence_reasons: ['Timestamp from current_stage_entered_at']
      }],
      stageRegressions: [],
      dispositionChanges: [],
      reqStatusChanges: [],
      candidatesAppeared: [],
      candidatesDisappeared: [],
      reqsAppeared: [],
      reqsDisappeared: []
    };

    const events = diffResultToEvents(
      diffResult,
      'org-1',
      'snapshot-1',
      'snapshot-2',
      new Date('2025-01-10'),
      new Date('2025-01-17')
    );

    expect(events).toHaveLength(1);
    expect(events[0].event_type).toBe('STAGE_CHANGE');
    expect(events[0].candidate_id).toBe('cand-1');
    expect(events[0].from_value).toBe('Phone Screen');
    expect(events[0].to_value).toBe('Onsite');
    expect(events[0].from_canonical).toBe(CanonicalStage.SCREEN);
    expect(events[0].to_canonical).toBe(CanonicalStage.ONSITE);
    expect(events[0].confidence).toBe('high');
    expect(events[0].from_snapshot_id).toBe('snapshot-1');
    expect(events[0].to_snapshot_id).toBe('snapshot-2');
  });

  test('converts stage regression with metadata', () => {
    const diffResult = {
      stageChanges: [],
      stageRegressions: [{
        candidate_id: 'cand-1',
        req_id: 'req-1',
        from_stage: 'Onsite',
        to_stage: 'Phone Screen',
        from_canonical: CanonicalStage.ONSITE,
        to_canonical: CanonicalStage.SCREEN,
        event_at: new Date('2025-01-15'),
        confidence: 'medium' as const,
        confidence_reasons: ['Inferred from snapshot diff']
      }],
      dispositionChanges: [],
      reqStatusChanges: [],
      candidatesAppeared: [],
      candidatesDisappeared: [],
      reqsAppeared: [],
      reqsDisappeared: []
    };

    const events = diffResultToEvents(
      diffResult,
      'org-1',
      'snapshot-1',
      'snapshot-2',
      new Date('2025-01-10'),
      new Date('2025-01-17')
    );

    expect(events).toHaveLength(1);
    expect(events[0].event_type).toBe('STAGE_REGRESSION');
    expect(events[0].metadata).toEqual({ is_regression: true });
  });
});
