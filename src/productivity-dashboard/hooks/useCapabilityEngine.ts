// useCapabilityEngine - React hook for capability engine integration
// Evaluates capabilities whenever coverage metrics change.
// Provides the single source of truth for what features are available.

import { useMemo } from 'react';
import { CoverageMetrics } from '../types/resilientImportTypes';
import {
  CapabilityEngineResult,
  FeatureCoverageEntry,
  CapabilitySummary,
  RepairSuggestionEntry,
  CapabilityStatus,
  FeatureArea,
} from '../types/capabilityTypes';
import {
  evaluateCapabilities,
  isFeatureEnabled,
  isFeatureUsable,
  getFeatureStatus,
  getFeatureRepairs,
  getFeaturesByArea,
  isAreaBlocked,
  getAreaStatus,
} from '../services/capabilityEngine';

export interface UseCapabilityEngineReturn {
  /** Full engine result (null if no coverage data) */
  result: CapabilityEngineResult | null;
  /** Overall summary */
  summary: CapabilitySummary | null;
  /** Check if a feature is fully enabled */
  isEnabled: (featureKey: string) => boolean;
  /** Check if a feature is usable (ENABLED or LIMITED) */
  isUsable: (featureKey: string) => boolean;
  /** Get feature status */
  getStatus: (featureKey: string) => CapabilityStatus | null;
  /** Get feature entry (for FeatureGate component) */
  getFeature: (featureKey: string) => FeatureCoverageEntry | null;
  /** Get repair suggestions for a feature */
  getRepairs: (featureKey: string) => RepairSuggestionEntry[];
  /** Get all features for a tab/area */
  getAreaFeatures: (area: FeatureArea) => FeatureCoverageEntry[];
  /** Check if entire tab/area is blocked */
  isTabBlocked: (area: FeatureArea) => boolean;
  /** Get tab/area overall status */
  getTabStatus: (area: FeatureArea) => CapabilityStatus;
  /** All prioritized repair suggestions */
  repairs: RepairSuggestionEntry[];
}

/**
 * Hook that evaluates capabilities from coverage metrics.
 * Memoized - only re-evaluates when coverage changes.
 */
export function useCapabilityEngine(coverage: CoverageMetrics | null | undefined): UseCapabilityEngineReturn {
  const result = useMemo(() => {
    if (!coverage) return null;
    return evaluateCapabilities(coverage);
  }, [coverage]);

  const summary = result?.summary ?? null;
  const repairs = result?.repair_suggestions ?? [];

  return {
    result,
    summary,
    isEnabled: (key: string) => result ? isFeatureEnabled(key, result) : false,
    isUsable: (key: string) => result ? isFeatureUsable(key, result) : false,
    getStatus: (key: string) => result ? getFeatureStatus(key, result) : null,
    getFeature: (key: string) => result?.feature_coverage.get(key) ?? null,
    getRepairs: (key: string) => result ? getFeatureRepairs(key, result) : [],
    getAreaFeatures: (area: FeatureArea) => result ? getFeaturesByArea(area, result) : [],
    isTabBlocked: (area: FeatureArea) => result ? isAreaBlocked(area, result) : false,
    getTabStatus: (area: FeatureArea) => result ? getAreaStatus(area, result) : 'BLOCKED',
    repairs,
  };
}

export default useCapabilityEngine;
