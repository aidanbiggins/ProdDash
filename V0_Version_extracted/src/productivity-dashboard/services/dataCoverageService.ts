// Data Coverage Service - Gating logic for snapshot-dependent features
// See docs/plans/SNAPSHOT_DIFF_EVENT_STREAM_V1.md for full specification

import { DataCoverageFlags, DataSnapshot } from '../types/snapshotTypes';
import { getCompletedSnapshots } from './snapshotService';

// ============================================
// CONSTANTS
// ============================================

const MIN_SNAPSHOTS_FOR_DWELL = 2;
const MIN_DAYS_SPAN_FOR_SLA = 14;
const MIN_DAYS_SPAN_FOR_VELOCITY_CURVES = 30;

// ============================================
// DATA COVERAGE COMPUTATION
// ============================================

/**
 * Compute data coverage flags for an organization.
 * These flags determine which features are available based on snapshot history.
 */
export async function computeDataCoverage(orgId: string): Promise<DataCoverageFlags> {
  const snapshots = await getCompletedSnapshots(orgId);
  return computeDataCoverageFromSnapshots(snapshots);
}

/**
 * Pure function to compute coverage from a list of snapshots.
 * Useful for testing and when snapshots are already loaded.
 */
export function computeDataCoverageFromSnapshots(snapshots: DataSnapshot[]): DataCoverageFlags {
  const snapshotCount = snapshots.length;

  // Calculate day span between oldest and newest snapshot
  let daySpan = 0;
  let oldestSnapshotDate: Date | null = null;
  let newestSnapshotDate: Date | null = null;

  if (snapshotCount > 0) {
    // Snapshots should already be sorted by date from getCompletedSnapshots
    oldestSnapshotDate = snapshots[0].snapshot_date;
    newestSnapshotDate = snapshots[snapshotCount - 1].snapshot_date;

    if (snapshotCount > 1) {
      daySpan = Math.floor(
        (newestSnapshotDate.getTime() - oldestSnapshotDate.getTime()) / (1000 * 60 * 60 * 24)
      );
    }
  }

  return {
    // Basic capabilities
    hasCurrentState: snapshotCount > 0,

    // Snapshot-dependent capabilities
    hasSnapshotHistory: snapshotCount >= MIN_SNAPSHOTS_FOR_DWELL,
    hasTrueDwellTime: snapshotCount >= MIN_SNAPSHOTS_FOR_DWELL,
    hasRegressionDetection: snapshotCount >= MIN_SNAPSHOTS_FOR_DWELL,
    hasSLATracking: snapshotCount >= MIN_SNAPSHOTS_FOR_DWELL && daySpan >= MIN_DAYS_SPAN_FOR_SLA,

    // Metadata
    snapshotCount,
    daySpan,
    oldestSnapshotDate,
    newestSnapshotDate,

    // Thresholds (for UI display)
    minSnapshotsForDwell: MIN_SNAPSHOTS_FOR_DWELL,
    minDaysSpanForSLA: MIN_DAYS_SPAN_FOR_SLA
  };
}

// ============================================
// FEATURE GATING HELPERS
// ============================================

export type GatedFeature =
  | 'stage_dwell_time'
  | 'regression_detection'
  | 'sla_tracking'
  | 'velocity_curves'
  | 'hm_latency_distribution';

export interface FeatureGateResult {
  isAvailable: boolean;
  reason: string | null;
  requirements: {
    current: number;
    needed: number;
    unit: string;
  } | null;
}

/**
 * Check if a specific feature is available based on coverage flags.
 */
export function checkFeatureGate(
  feature: GatedFeature,
  coverage: DataCoverageFlags
): FeatureGateResult {
  switch (feature) {
    case 'stage_dwell_time':
      return {
        isAvailable: coverage.hasTrueDwellTime,
        reason: coverage.hasTrueDwellTime
          ? null
          : 'Requires snapshot history to compute true stage durations',
        requirements: coverage.hasTrueDwellTime
          ? null
          : {
              current: coverage.snapshotCount,
              needed: coverage.minSnapshotsForDwell,
              unit: 'snapshots'
            }
      };

    case 'regression_detection':
      return {
        isAvailable: coverage.hasRegressionDetection,
        reason: coverage.hasRegressionDetection
          ? null
          : 'Requires snapshot history to detect stage regressions',
        requirements: coverage.hasRegressionDetection
          ? null
          : {
              current: coverage.snapshotCount,
              needed: coverage.minSnapshotsForDwell,
              unit: 'snapshots'
            }
      };

    case 'sla_tracking':
      if (coverage.snapshotCount < coverage.minSnapshotsForDwell) {
        return {
          isAvailable: false,
          reason: 'Requires snapshot history to track SLA compliance',
          requirements: {
            current: coverage.snapshotCount,
            needed: coverage.minSnapshotsForDwell,
            unit: 'snapshots'
          }
        };
      }
      if (coverage.daySpan < coverage.minDaysSpanForSLA) {
        return {
          isAvailable: false,
          reason: `Requires ${coverage.minDaysSpanForSLA}+ days of snapshot history`,
          requirements: {
            current: coverage.daySpan,
            needed: coverage.minDaysSpanForSLA,
            unit: 'days'
          }
        };
      }
      return { isAvailable: true, reason: null, requirements: null };

    case 'velocity_curves':
      if (coverage.snapshotCount < coverage.minSnapshotsForDwell) {
        return {
          isAvailable: false,
          reason: 'Requires snapshot history for velocity tracking',
          requirements: {
            current: coverage.snapshotCount,
            needed: coverage.minSnapshotsForDwell,
            unit: 'snapshots'
          }
        };
      }
      if (coverage.daySpan < MIN_DAYS_SPAN_FOR_VELOCITY_CURVES) {
        return {
          isAvailable: false,
          reason: `Requires ${MIN_DAYS_SPAN_FOR_VELOCITY_CURVES}+ days of snapshot history`,
          requirements: {
            current: coverage.daySpan,
            needed: MIN_DAYS_SPAN_FOR_VELOCITY_CURVES,
            unit: 'days'
          }
        };
      }
      return { isAvailable: true, reason: null, requirements: null };

    case 'hm_latency_distribution':
      return {
        isAvailable: coverage.hasTrueDwellTime,
        reason: coverage.hasTrueDwellTime
          ? null
          : 'Requires snapshot history to compute HM response times',
        requirements: coverage.hasTrueDwellTime
          ? null
          : {
              current: coverage.snapshotCount,
              needed: coverage.minSnapshotsForDwell,
              unit: 'snapshots'
            }
      };

    default:
      return { isAvailable: true, reason: null, requirements: null };
  }
}

/**
 * Get a user-friendly message for a gated feature.
 */
export function getGateMessage(feature: GatedFeature, coverage: DataCoverageFlags): string {
  const gate = checkFeatureGate(feature, coverage);

  if (gate.isAvailable) {
    return 'Feature available';
  }

  const req = gate.requirements;
  if (!req) {
    return gate.reason ?? 'Feature not available';
  }

  return `${gate.reason}. You have ${req.current} ${req.unit}, need ${req.needed}.`;
}

/**
 * Get the list of capabilities that are unlocked with current coverage.
 */
export function getUnlockedCapabilities(coverage: DataCoverageFlags): string[] {
  const capabilities: string[] = [];

  if (coverage.hasCurrentState) {
    capabilities.push('Current state metrics');
  }

  if (coverage.hasTrueDwellTime) {
    capabilities.push('Stage dwell time tracking');
  }

  if (coverage.hasRegressionDetection) {
    capabilities.push('Regression detection');
  }

  if (coverage.hasSLATracking) {
    capabilities.push('SLA compliance tracking');
  }

  return capabilities;
}

/**
 * Get the list of capabilities that require more data.
 */
export function getPendingCapabilities(coverage: DataCoverageFlags): Array<{
  name: string;
  requirement: string;
}> {
  const pending: Array<{ name: string; requirement: string }> = [];

  if (!coverage.hasTrueDwellTime) {
    pending.push({
      name: 'Stage dwell time tracking',
      requirement: `Need ${coverage.minSnapshotsForDwell}+ snapshots`
    });
  }

  if (!coverage.hasRegressionDetection) {
    pending.push({
      name: 'Regression detection',
      requirement: `Need ${coverage.minSnapshotsForDwell}+ snapshots`
    });
  }

  if (!coverage.hasSLATracking) {
    if (coverage.snapshotCount < coverage.minSnapshotsForDwell) {
      pending.push({
        name: 'SLA compliance tracking',
        requirement: `Need ${coverage.minSnapshotsForDwell}+ snapshots`
      });
    } else {
      pending.push({
        name: 'SLA compliance tracking',
        requirement: `Need ${coverage.minDaysSpanForSLA}+ days of history`
      });
    }
  }

  // Velocity curves need 30+ days
  if (coverage.daySpan < MIN_DAYS_SPAN_FOR_VELOCITY_CURVES) {
    pending.push({
      name: 'Velocity decay curves',
      requirement: `Need ${MIN_DAYS_SPAN_FOR_VELOCITY_CURVES}+ days of history`
    });
  }

  return pending;
}

// ============================================
// UPGRADE DETECTION
// ============================================

/**
 * Check if a capability was just unlocked by comparing old vs new coverage.
 */
export function detectCapabilityUpgrade(
  oldCoverage: DataCoverageFlags,
  newCoverage: DataCoverageFlags
): string[] {
  const newlyUnlocked: string[] = [];

  if (!oldCoverage.hasSnapshotHistory && newCoverage.hasSnapshotHistory) {
    newlyUnlocked.push('Snapshot history');
  }

  if (!oldCoverage.hasTrueDwellTime && newCoverage.hasTrueDwellTime) {
    newlyUnlocked.push('Stage dwell time tracking');
  }

  if (!oldCoverage.hasRegressionDetection && newCoverage.hasRegressionDetection) {
    newlyUnlocked.push('Regression detection');
  }

  if (!oldCoverage.hasSLATracking && newCoverage.hasSLATracking) {
    newlyUnlocked.push('SLA compliance tracking');
  }

  return newlyUnlocked;
}
