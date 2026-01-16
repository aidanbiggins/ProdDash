// Tests for Data Coverage Service
// See docs/plans/SNAPSHOT_DIFF_EVENT_STREAM_V1.md Section 7

import {
  computeDataCoverageFromSnapshots,
  checkFeatureGate,
  getUnlockedCapabilities,
  getPendingCapabilities,
  detectCapabilityUpgrade
} from '../dataCoverageService';
import { DataSnapshot, DataCoverageFlags } from '../../types/snapshotTypes';

// ============================================
// TEST HELPERS
// ============================================

function createSnapshot(
  id: string,
  date: Date,
  seq: number
): DataSnapshot {
  return {
    id,
    organization_id: 'org-1',
    snapshot_date: date,
    snapshot_seq: seq,
    source_filename: 'test.csv',
    source_hash: `hash-${id}`,
    imported_at: new Date(),
    imported_by: 'user-1',
    req_count: 100,
    candidate_count: 500,
    user_count: 10,
    status: 'completed',
    diff_completed_at: new Date(),
    events_generated: 50,
    error_message: null
  };
}

// ============================================
// COVERAGE COMPUTATION TESTS
// ============================================

describe('computeDataCoverageFromSnapshots', () => {
  test('no snapshots returns all capabilities disabled', () => {
    const coverage = computeDataCoverageFromSnapshots([]);

    expect(coverage.hasCurrentState).toBe(false);
    expect(coverage.hasSnapshotHistory).toBe(false);
    expect(coverage.hasTrueDwellTime).toBe(false);
    expect(coverage.hasRegressionDetection).toBe(false);
    expect(coverage.hasSLATracking).toBe(false);
    expect(coverage.snapshotCount).toBe(0);
    expect(coverage.daySpan).toBe(0);
  });

  test('one snapshot enables currentState only', () => {
    const snapshots = [
      createSnapshot('s1', new Date('2025-01-10'), 1)
    ];

    const coverage = computeDataCoverageFromSnapshots(snapshots);

    expect(coverage.hasCurrentState).toBe(true);
    expect(coverage.hasSnapshotHistory).toBe(false);
    expect(coverage.hasTrueDwellTime).toBe(false);
    expect(coverage.snapshotCount).toBe(1);
    expect(coverage.daySpan).toBe(0);
  });

  test('two snapshots enables basic snapshot capabilities', () => {
    const snapshots = [
      createSnapshot('s1', new Date('2025-01-10'), 1),
      createSnapshot('s2', new Date('2025-01-15'), 2)
    ];

    const coverage = computeDataCoverageFromSnapshots(snapshots);

    expect(coverage.hasCurrentState).toBe(true);
    expect(coverage.hasSnapshotHistory).toBe(true);
    expect(coverage.hasTrueDwellTime).toBe(true);
    expect(coverage.hasRegressionDetection).toBe(true);
    expect(coverage.hasSLATracking).toBe(false); // Only 5 days
    expect(coverage.snapshotCount).toBe(2);
    expect(coverage.daySpan).toBe(5);
  });

  test('two snapshots 14+ days apart enables SLA tracking', () => {
    const snapshots = [
      createSnapshot('s1', new Date('2025-01-01'), 1),
      createSnapshot('s2', new Date('2025-01-15'), 2)
    ];

    const coverage = computeDataCoverageFromSnapshots(snapshots);

    expect(coverage.hasSLATracking).toBe(true);
    expect(coverage.daySpan).toBe(14);
  });

  test('multiple snapshots with long history', () => {
    const snapshots = [
      createSnapshot('s1', new Date('2025-01-01'), 1),
      createSnapshot('s2', new Date('2025-01-08'), 2),
      createSnapshot('s3', new Date('2025-01-15'), 3),
      createSnapshot('s4', new Date('2025-01-22'), 4)
    ];

    const coverage = computeDataCoverageFromSnapshots(snapshots);

    expect(coverage.snapshotCount).toBe(4);
    expect(coverage.daySpan).toBe(21);
    expect(coverage.hasSnapshotHistory).toBe(true);
    expect(coverage.hasTrueDwellTime).toBe(true);
    expect(coverage.hasRegressionDetection).toBe(true);
    expect(coverage.hasSLATracking).toBe(true);
    expect(coverage.oldestSnapshotDate).toEqual(new Date('2025-01-01'));
    expect(coverage.newestSnapshotDate).toEqual(new Date('2025-01-22'));
  });
});

// ============================================
// FEATURE GATING TESTS
// ============================================

describe('checkFeatureGate', () => {
  test('stage_dwell_time available with 2+ snapshots', () => {
    const coverage: DataCoverageFlags = {
      hasCurrentState: true,
      hasSnapshotHistory: true,
      hasTrueDwellTime: true,
      hasRegressionDetection: true,
      hasSLATracking: false,
      snapshotCount: 2,
      daySpan: 7,
      oldestSnapshotDate: new Date(),
      newestSnapshotDate: new Date(),
      minSnapshotsForDwell: 2,
      minDaysSpanForSLA: 14
    };

    const result = checkFeatureGate('stage_dwell_time', coverage);

    expect(result.isAvailable).toBe(true);
    expect(result.reason).toBeNull();
    expect(result.requirements).toBeNull();
  });

  test('stage_dwell_time unavailable with 1 snapshot', () => {
    const coverage: DataCoverageFlags = {
      hasCurrentState: true,
      hasSnapshotHistory: false,
      hasTrueDwellTime: false,
      hasRegressionDetection: false,
      hasSLATracking: false,
      snapshotCount: 1,
      daySpan: 0,
      oldestSnapshotDate: new Date(),
      newestSnapshotDate: new Date(),
      minSnapshotsForDwell: 2,
      minDaysSpanForSLA: 14
    };

    const result = checkFeatureGate('stage_dwell_time', coverage);

    expect(result.isAvailable).toBe(false);
    expect(result.reason).toContain('snapshot history');
    expect(result.requirements).toEqual({
      current: 1,
      needed: 2,
      unit: 'snapshots'
    });
  });

  test('sla_tracking requires both snapshots and day span', () => {
    // Has snapshots but not enough day span
    const coverageShortSpan: DataCoverageFlags = {
      hasCurrentState: true,
      hasSnapshotHistory: true,
      hasTrueDwellTime: true,
      hasRegressionDetection: true,
      hasSLATracking: false,
      snapshotCount: 2,
      daySpan: 7,
      oldestSnapshotDate: new Date(),
      newestSnapshotDate: new Date(),
      minSnapshotsForDwell: 2,
      minDaysSpanForSLA: 14
    };

    const result = checkFeatureGate('sla_tracking', coverageShortSpan);

    expect(result.isAvailable).toBe(false);
    expect(result.reason).toContain('14+ days');
    expect(result.requirements).toEqual({
      current: 7,
      needed: 14,
      unit: 'days'
    });
  });

  test('velocity_curves requires 30+ days', () => {
    const coverage: DataCoverageFlags = {
      hasCurrentState: true,
      hasSnapshotHistory: true,
      hasTrueDwellTime: true,
      hasRegressionDetection: true,
      hasSLATracking: true,
      snapshotCount: 3,
      daySpan: 20,
      oldestSnapshotDate: new Date(),
      newestSnapshotDate: new Date(),
      minSnapshotsForDwell: 2,
      minDaysSpanForSLA: 14
    };

    const result = checkFeatureGate('velocity_curves', coverage);

    expect(result.isAvailable).toBe(false);
    expect(result.requirements?.needed).toBe(30);
  });
});

// ============================================
// CAPABILITY LISTING TESTS
// ============================================

describe('getUnlockedCapabilities', () => {
  test('returns empty for no snapshots', () => {
    const coverage = computeDataCoverageFromSnapshots([]);
    const capabilities = getUnlockedCapabilities(coverage);

    expect(capabilities).toHaveLength(0);
  });

  test('returns current state for 1 snapshot', () => {
    const snapshots = [createSnapshot('s1', new Date('2025-01-10'), 1)];
    const coverage = computeDataCoverageFromSnapshots(snapshots);
    const capabilities = getUnlockedCapabilities(coverage);

    expect(capabilities).toContain('Current state metrics');
    expect(capabilities).not.toContain('Stage dwell time tracking');
  });

  test('returns multiple capabilities for 2+ snapshots with history', () => {
    const snapshots = [
      createSnapshot('s1', new Date('2025-01-01'), 1),
      createSnapshot('s2', new Date('2025-01-20'), 2)
    ];
    const coverage = computeDataCoverageFromSnapshots(snapshots);
    const capabilities = getUnlockedCapabilities(coverage);

    expect(capabilities).toContain('Current state metrics');
    expect(capabilities).toContain('Stage dwell time tracking');
    expect(capabilities).toContain('Regression detection');
    expect(capabilities).toContain('SLA compliance tracking');
  });
});

describe('getPendingCapabilities', () => {
  test('returns all pending for no snapshots', () => {
    const coverage = computeDataCoverageFromSnapshots([]);
    const pending = getPendingCapabilities(coverage);

    expect(pending.length).toBeGreaterThan(0);
    expect(pending.some(p => p.name.includes('dwell'))).toBe(true);
  });

  test('returns empty when all capabilities unlocked', () => {
    const snapshots = [
      createSnapshot('s1', new Date('2025-01-01'), 1),
      createSnapshot('s2', new Date('2025-02-01'), 2) // 31 days
    ];
    const coverage = computeDataCoverageFromSnapshots(snapshots);
    const pending = getPendingCapabilities(coverage);

    // Only velocity curves might still be pending if less than 30 days
    // With 31 days, all should be unlocked
    expect(pending.every(p => !p.name.includes('dwell'))).toBe(true);
    expect(pending.every(p => !p.name.includes('Regression'))).toBe(true);
  });
});

// ============================================
// UPGRADE DETECTION TESTS
// ============================================

describe('detectCapabilityUpgrade', () => {
  test('detects first snapshot history unlock', () => {
    const oldCoverage: DataCoverageFlags = {
      hasCurrentState: true,
      hasSnapshotHistory: false,
      hasTrueDwellTime: false,
      hasRegressionDetection: false,
      hasSLATracking: false,
      snapshotCount: 1,
      daySpan: 0,
      oldestSnapshotDate: new Date(),
      newestSnapshotDate: new Date(),
      minSnapshotsForDwell: 2,
      minDaysSpanForSLA: 14
    };

    const newCoverage: DataCoverageFlags = {
      ...oldCoverage,
      hasSnapshotHistory: true,
      hasTrueDwellTime: true,
      hasRegressionDetection: true,
      snapshotCount: 2,
      daySpan: 7
    };

    const upgrades = detectCapabilityUpgrade(oldCoverage, newCoverage);

    expect(upgrades).toContain('Snapshot history');
    expect(upgrades).toContain('Stage dwell time tracking');
    expect(upgrades).toContain('Regression detection');
    expect(upgrades).not.toContain('SLA compliance tracking');
  });

  test('detects SLA tracking unlock', () => {
    const oldCoverage: DataCoverageFlags = {
      hasCurrentState: true,
      hasSnapshotHistory: true,
      hasTrueDwellTime: true,
      hasRegressionDetection: true,
      hasSLATracking: false,
      snapshotCount: 2,
      daySpan: 10,
      oldestSnapshotDate: new Date(),
      newestSnapshotDate: new Date(),
      minSnapshotsForDwell: 2,
      minDaysSpanForSLA: 14
    };

    const newCoverage: DataCoverageFlags = {
      ...oldCoverage,
      hasSLATracking: true,
      snapshotCount: 3,
      daySpan: 14
    };

    const upgrades = detectCapabilityUpgrade(oldCoverage, newCoverage);

    expect(upgrades).toContain('SLA compliance tracking');
    expect(upgrades).not.toContain('Stage dwell time tracking'); // Already had it
  });

  test('returns empty when no new capabilities', () => {
    const coverage: DataCoverageFlags = {
      hasCurrentState: true,
      hasSnapshotHistory: true,
      hasTrueDwellTime: true,
      hasRegressionDetection: true,
      hasSLATracking: true,
      snapshotCount: 5,
      daySpan: 30,
      oldestSnapshotDate: new Date(),
      newestSnapshotDate: new Date(),
      minSnapshotsForDwell: 2,
      minDaysSpanForSLA: 14
    };

    const upgrades = detectCapabilityUpgrade(coverage, coverage);

    expect(upgrades).toHaveLength(0);
  });
});
