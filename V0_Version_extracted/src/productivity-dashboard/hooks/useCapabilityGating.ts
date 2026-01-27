// useCapabilityGating Hook
// Provides capability checking for components based on data coverage
// See docs/plans/RESILIENT_IMPORT_AND_GUIDANCE_V1.md

import React, { useMemo } from 'react';
import { CoverageMetrics, CapabilityStatus } from '../types/resilientImportTypes';
import {
  isCapabilityEnabled,
  checkCapability,
  getCapabilityDefinition,
  getAllCapabilityStatuses,
  getCapabilitiesByType,
} from '../services/capabilityRegistry';
import { createEmptyCoverageMetrics } from '../services/coverageMetricsService';

/**
 * Hook for checking capability status
 */
export function useCapabilityGating(coverage: CoverageMetrics | null | undefined) {
  // Use empty coverage if none provided
  const effectiveCoverage = coverage ?? createEmptyCoverageMetrics();

  return useMemo(() => {
    /**
     * Check if a specific capability is enabled
     */
    function isEnabled(capabilityId: string): boolean {
      return isCapabilityEnabled(capabilityId, effectiveCoverage);
    }

    /**
     * Get full status for a capability
     */
    function getStatus(capabilityId: string): CapabilityStatus | null {
      const definition = getCapabilityDefinition(capabilityId);
      if (!definition) return null;
      return checkCapability(definition, effectiveCoverage);
    }

    /**
     * Get all capability statuses
     */
    function getAllStatuses(): CapabilityStatus[] {
      return getAllCapabilityStatuses(effectiveCoverage);
    }

    /**
     * Get tab capabilities
     */
    function getTabCapabilities(): CapabilityStatus[] {
      return getCapabilitiesByType('tab', effectiveCoverage);
    }

    /**
     * Get section capabilities
     */
    function getSectionCapabilities(): CapabilityStatus[] {
      return getCapabilitiesByType('section', effectiveCoverage);
    }

    /**
     * Get widget capabilities
     */
    function getWidgetCapabilities(): CapabilityStatus[] {
      return getCapabilitiesByType('widget', effectiveCoverage);
    }

    /**
     * Get metric capabilities
     */
    function getMetricCapabilities(): CapabilityStatus[] {
      return getCapabilitiesByType('metric', effectiveCoverage);
    }

    /**
     * Render gated content - returns children if enabled, fallback if not
     */
    function gated<T>(
      capabilityId: string,
      enabledContent: T,
      disabledContent: T
    ): T {
      return isEnabled(capabilityId) ? enabledContent : disabledContent;
    }

    /**
     * Get counts
     */
    function getCounts(): { enabled: number; total: number } {
      const all = getAllStatuses();
      const enabled = all.filter(c => c.enabled).length;
      return { enabled, total: all.length };
    }

    return {
      isEnabled,
      getStatus,
      getAllStatuses,
      getTabCapabilities,
      getSectionCapabilities,
      getWidgetCapabilities,
      getMetricCapabilities,
      gated,
      getCounts,
      coverage: effectiveCoverage,
    };
  }, [effectiveCoverage]);
}

/**
 * Convenience hook for a single capability
 */
export function useCapability(
  capabilityId: string,
  coverage: CoverageMetrics | null | undefined
): {
  enabled: boolean;
  status: CapabilityStatus | null;
} {
  const { isEnabled, getStatus } = useCapabilityGating(coverage);

  return useMemo(() => ({
    enabled: isEnabled(capabilityId),
    status: getStatus(capabilityId),
  }), [capabilityId, isEnabled, getStatus]);
}

/**
 * HOC for gating components based on capability
 */
export function withCapabilityGate<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  capabilityId: string,
  Fallback?: React.ComponentType<{ status: CapabilityStatus }>
): React.FC<P & { coverage: CoverageMetrics | null | undefined }> {
  return function GatedComponent(props: P & { coverage: CoverageMetrics | null | undefined }) {
    const { coverage, ...rest } = props;
    const { enabled, status } = useCapability(capabilityId, coverage);

    if (!enabled && status) {
      if (Fallback) {
        return React.createElement(Fallback, { status });
      }
      // Default: hide component
      return null;
    }

    return React.createElement(WrappedComponent, rest as P);
  };
}

export default useCapabilityGating;
