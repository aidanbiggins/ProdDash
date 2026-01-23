// FeatureGate - Centralized feature gating component
// Wraps content that requires a specific feature. Shows blocked/limited state when unavailable.
// This is THE way to gate features. No one-off "if (missing)" checks.

import React from 'react';
import { CapabilityStatus, FeatureCoverageEntry, RepairSuggestionEntry } from '../../types/capabilityTypes';
import { FeatureBlockedState } from './FeatureBlockedState';
import { FeatureLimitedState } from './FeatureLimitedState';

interface FeatureGateProps {
  /** Feature key from FEATURE_REGISTRY */
  featureKey: string;
  /** Feature coverage entry from capability engine result */
  featureEntry: FeatureCoverageEntry | null | undefined;
  /** Content to render when ENABLED */
  children: React.ReactNode;
  /** Optional: render custom content for LIMITED state (default: shows banner + children) */
  limitedContent?: React.ReactNode;
  /** Variant: how to display the blocked state */
  variant?: 'panel' | 'card' | 'inline';
  /** Optional: custom loading state */
  loading?: boolean;
  /** Optional: override the feature display name */
  displayName?: string;
}

/**
 * FeatureGate - Central gating primitive.
 *
 * Usage:
 * ```tsx
 * <FeatureGate featureKey="ct_health_kpis" featureEntry={getFeature('ct_health_kpis')}>
 *   <HealthKPIs data={...} />
 * </FeatureGate>
 * ```
 */
export function FeatureGate({
  featureKey,
  featureEntry,
  children,
  limitedContent,
  variant = 'panel',
  loading = false,
  displayName,
}: FeatureGateProps) {
  // If engine hasn't run yet, show nothing (will render once data loads)
  if (loading || !featureEntry) {
    return null;
  }

  const status = featureEntry.status;

  if (status === 'BLOCKED') {
    return (
      <FeatureBlockedState
        featureEntry={featureEntry}
        variant={variant}
        displayName={displayName}
      />
    );
  }

  if (status === 'LIMITED') {
    if (limitedContent) {
      return <>{limitedContent}</>;
    }
    return (
      <div className="feature-limited-wrapper">
        <FeatureLimitedState
          featureEntry={featureEntry}
          displayName={displayName}
        />
        {children}
      </div>
    );
  }

  // ENABLED - render children
  return <>{children}</>;
}

// ============================================
// Convenience hook for getting feature entry
// ============================================

/**
 * Helper to get feature status quickly. Use with FeatureGate.
 */
export function getFeatureFromResult(
  featureKey: string,
  featureCoverage: Map<string, FeatureCoverageEntry> | null | undefined
): FeatureCoverageEntry | null {
  if (!featureCoverage) return null;
  return featureCoverage.get(featureKey) ?? null;
}

export default FeatureGate;
