// Capability Registry
// Defines all feature capabilities and their requirements
// See docs/plans/RESILIENT_IMPORT_AND_GUIDANCE_V1.md

import {
  CapabilityDefinition,
  CapabilityStatus,
  CapabilityRequirement,
  RequirementStatus,
  CoverageMetrics,
} from '../types/resilientImportTypes';

// ============================================
// CAPABILITY DEFINITIONS
// ============================================

export const CAPABILITY_REGISTRY: CapabilityDefinition[] = [
  // ══════════════════════════════════════════════════════════
  // TABS (replace with UnavailablePanel when disabled)
  // ══════════════════════════════════════════════════════════
  {
    id: 'tab_control_tower',
    displayName: 'Control Tower',
    description: 'Executive command center with KPIs, risks, and actions',
    uiType: 'tab',
    requirements: [
      { type: 'count', countField: 'requisitions', minCount: 1 },
    ],
    whenDisabled: {
      behavior: 'replace',
      replacementComponent: 'UnavailableTabPanel',
      message: 'Control Tower requires at least one requisition',
      upgradeHint: 'Import requisition data to enable this view',
    },
  },
  {
    id: 'tab_hm_friction',
    displayName: 'HM Friction',
    description: 'Analyze hiring manager responsiveness',
    uiType: 'tab',
    requirements: [
      { type: 'flag', flag: 'hasHMAssignment' },
      { type: 'flag', flag: 'hasStageEvents' },
      { type: 'count', countField: 'events', minCount: 50 },
    ],
    whenDisabled: {
      behavior: 'replace',
      replacementComponent: 'UnavailableTabPanel',
      message: 'HM Friction analysis requires hiring manager data and stage events',
      upgradeHint: 'Import data with Hiring Manager assignments and workflow events',
    },
  },
  {
    id: 'tab_velocity',
    displayName: 'Velocity Insights',
    description: 'Pipeline velocity and decay analysis',
    uiType: 'tab',
    requirements: [
      { type: 'field_coverage', field: 'cand.applied_at', minValue: 0.6 },
      { type: 'flag', flag: 'hasStageEvents' },
      { type: 'count', countField: 'candidates', minCount: 30 },
    ],
    whenDisabled: {
      behavior: 'replace',
      replacementComponent: 'UnavailableTabPanel',
      message: 'Velocity Insights requires applied dates and stage events',
      upgradeHint: 'Ensure your export includes Applied Date and workflow status changes',
    },
  },
  {
    id: 'tab_source_mix',
    displayName: 'Source Effectiveness',
    description: 'Compare candidate sources by conversion',
    uiType: 'tab',
    requirements: [
      { type: 'flag', flag: 'hasSourceData' },
      { type: 'field_coverage', field: 'cand.source', minValue: 0.4 },
    ],
    whenDisabled: {
      behavior: 'replace',
      replacementComponent: 'UnavailableTabPanel',
      message: 'Source Effectiveness requires source data for candidates',
      upgradeHint: 'Include the Source or Referral Source column in your export',
    },
  },
  {
    id: 'tab_bottlenecks',
    displayName: 'Bottlenecks & SLAs',
    description: 'Track stage durations and SLA violations',
    uiType: 'tab',
    requirements: [
      { type: 'flag', flag: 'hasStageEvents' },
      { type: 'field_coverage', field: 'event.from_stage', minValue: 0.7 },
      { type: 'field_coverage', field: 'event.to_stage', minValue: 0.7 },
    ],
    whenDisabled: {
      behavior: 'replace',
      replacementComponent: 'UnavailableTabPanel',
      message: 'Bottlenecks requires stage transition events with from/to stages',
      upgradeHint: 'Import workflow history or activity data with stage transitions',
    },
  },
  {
    id: 'tab_data_health',
    displayName: 'Data Health',
    description: 'Data quality metrics and hygiene status',
    uiType: 'tab',
    requirements: [
      { type: 'count', countField: 'requisitions', minCount: 1 },
    ],
    whenDisabled: {
      behavior: 'replace',
      replacementComponent: 'UnavailableTabPanel',
      message: 'Data Health requires imported data',
      upgradeHint: 'Import data to see data quality metrics',
    },
  },

  // ══════════════════════════════════════════════════════════
  // SECTIONS (replace with compact unavailable message)
  // ══════════════════════════════════════════════════════════
  {
    id: 'section_ttf_chart',
    displayName: 'Time-to-Fill Chart',
    description: 'Distribution of time to fill',
    uiType: 'section',
    requirements: [
      { type: 'field_coverage', field: 'cand.applied_at', minValue: 0.5 },
      { type: 'field_coverage', field: 'cand.hired_at', minValue: 0.1 },
      { type: 'sample_size', countField: 'candidates', minCount: 5 },
    ],
    whenDisabled: {
      behavior: 'replace',
      replacementComponent: 'UnavailableSectionPanel',
      message: 'Requires applied dates and hire dates',
      upgradeHint: 'Add Applied Date and Hire Date columns',
    },
  },
  {
    id: 'section_trends',
    displayName: 'Historical Trends',
    description: 'Compare metrics across time periods',
    uiType: 'section',
    requirements: [
      { type: 'flag', flag: 'hasMultipleSnapshots' },
    ],
    whenDisabled: {
      behavior: 'replace',
      replacementComponent: 'UnavailableSectionPanel',
      message: 'Historical trends require multiple data snapshots',
      upgradeHint: "Import another week's data to enable trend analysis",
    },
  },
  {
    id: 'section_funnel',
    displayName: 'Funnel Analysis',
    description: 'Stage conversion funnel',
    uiType: 'section',
    requirements: [
      { type: 'field_coverage', field: 'cand.current_stage', minValue: 0.8 },
      { type: 'count', countField: 'candidates', minCount: 10 },
    ],
    whenDisabled: {
      behavior: 'replace',
      replacementComponent: 'UnavailableSectionPanel',
      message: 'Funnel analysis requires candidate stage data',
      upgradeHint: 'Ensure candidates have stage information',
    },
  },

  // ══════════════════════════════════════════════════════════
  // WIDGETS (hide when disabled)
  // ══════════════════════════════════════════════════════════
  {
    id: 'widget_hm_latency',
    displayName: 'HM Latency KPI',
    description: 'Average HM response time',
    uiType: 'widget',
    requirements: [
      { type: 'flag', flag: 'hasHMAssignment' },
      { type: 'flag', flag: 'hasStageEvents' },
    ],
    whenDisabled: {
      behavior: 'hide',
      message: 'HM data not available',
    },
  },
  {
    id: 'widget_source_breakdown',
    displayName: 'Source Breakdown',
    description: 'Pie chart of candidate sources',
    uiType: 'widget',
    requirements: [
      { type: 'flag', flag: 'hasSourceData' },
    ],
    whenDisabled: {
      behavior: 'hide',
      message: 'Source data not available',
    },
  },
  {
    id: 'widget_stalled_reqs',
    displayName: 'Stalled Requisitions',
    description: 'Requisitions with no recent activity',
    uiType: 'widget',
    requirements: [
      { type: 'count', countField: 'requisitions', minCount: 1 },
      { type: 'flag', flag: 'hasTimestamps' },
    ],
    whenDisabled: {
      behavior: 'hide',
      message: 'Timestamp data not available',
    },
  },

  // ══════════════════════════════════════════════════════════
  // METRICS (show N/A when disabled)
  // ══════════════════════════════════════════════════════════
  {
    id: 'metric_median_ttf',
    displayName: 'Median Time-to-Fill',
    description: 'Median days from apply to hire',
    uiType: 'metric',
    requirements: [
      { type: 'field_coverage', field: 'cand.applied_at', minValue: 0.5 },
      { type: 'sample_size', countField: 'candidates', minCount: 3 },
    ],
    whenDisabled: {
      behavior: 'replace',
      message: 'Insufficient data',
      upgradeHint: 'Need applied dates and 3+ hires',
    },
  },
  {
    id: 'metric_accept_rate',
    displayName: 'Offer Accept Rate',
    description: 'Percentage of offers accepted',
    uiType: 'metric',
    requirements: [
      { type: 'sample_size', countField: 'candidates', minCount: 5 },
    ],
    whenDisabled: {
      behavior: 'replace',
      message: 'Need 5+ offers',
      upgradeHint: 'Import data with offer outcomes',
    },
  },
  {
    id: 'metric_pipeline_velocity',
    displayName: 'Pipeline Velocity',
    description: 'Average days per stage',
    uiType: 'metric',
    requirements: [
      { type: 'flag', flag: 'hasStageEvents' },
      { type: 'count', countField: 'events', minCount: 20 },
    ],
    whenDisabled: {
      behavior: 'replace',
      message: 'Need stage events',
      upgradeHint: 'Import workflow activity data',
    },
  },
];

// ============================================
// CAPABILITY ENGINE
// ============================================

/**
 * Check if a single requirement is met
 */
function checkRequirement(
  req: CapabilityRequirement,
  coverage: CoverageMetrics
): RequirementStatus {
  switch (req.type) {
    case 'field_coverage': {
      const fieldKey = req.field!;
      const currentValue = coverage.fieldCoverage[fieldKey] ?? 0;
      const met = currentValue >= (req.minValue ?? 0);
      return {
        description: `${fieldKey} coverage >= ${((req.minValue ?? 0) * 100).toFixed(0)}%`,
        met,
        currentValue: Math.round(currentValue * 100),
        requiredValue: Math.round((req.minValue ?? 0) * 100),
      };
    }

    case 'flag': {
      const flagKey = req.flag!;
      const met = coverage.flags[flagKey] ?? false;
      return {
        description: flagKey.replace(/([A-Z])/g, ' $1').toLowerCase().trim(),
        met,
      };
    }

    case 'count': {
      const countField = req.countField!;
      const currentValue = coverage.counts[countField] ?? 0;
      const met = currentValue >= (req.minCount ?? 0);
      return {
        description: `${countField} count >= ${req.minCount}`,
        met,
        currentValue,
        requiredValue: req.minCount,
      };
    }

    case 'sample_size': {
      const countField = req.countField!;
      const currentValue = coverage.sampleSizes[countField as keyof CoverageMetrics['sampleSizes']]
        ?? coverage.counts[countField] ?? 0;
      const met = currentValue >= (req.minCount ?? 0);
      return {
        description: `${countField} sample size >= ${req.minCount}`,
        met,
        currentValue,
        requiredValue: req.minCount,
      };
    }

    default:
      return { description: 'Unknown requirement', met: true };
  }
}

/**
 * Check the status of a capability
 */
export function checkCapability(
  capability: CapabilityDefinition,
  coverage: CoverageMetrics
): CapabilityStatus {
  const requirements = capability.requirements.map((req) =>
    checkRequirement(req, coverage)
  );

  const enabled = requirements.every((r) => r.met);
  const unmetRequirements = requirements.filter((r) => !r.met);

  return {
    id: capability.id,
    displayName: capability.displayName,
    description: capability.description,
    uiType: capability.uiType,
    enabled,
    requirements,
    disabledReason: enabled
      ? undefined
      : unmetRequirements.map((r) => r.description).join(', '),
    upgradeHint: enabled ? undefined : capability.whenDisabled.upgradeHint,
    behavior: capability.whenDisabled.behavior,
  };
}

/**
 * Get status of all capabilities
 */
export function getAllCapabilityStatuses(
  coverage: CoverageMetrics
): CapabilityStatus[] {
  return CAPABILITY_REGISTRY.map((cap) => checkCapability(cap, coverage));
}

/**
 * Check if a specific capability is enabled
 */
export function isCapabilityEnabled(
  capabilityId: string,
  coverage: CoverageMetrics
): boolean {
  const capability = CAPABILITY_REGISTRY.find((c) => c.id === capabilityId);
  if (!capability) return true; // Unknown capabilities are enabled by default

  const status = checkCapability(capability, coverage);
  return status.enabled;
}

/**
 * Get capabilities by UI type
 */
export function getCapabilitiesByType(
  uiType: CapabilityDefinition['uiType'],
  coverage: CoverageMetrics
): CapabilityStatus[] {
  return CAPABILITY_REGISTRY
    .filter((cap) => cap.uiType === uiType)
    .map((cap) => checkCapability(cap, coverage));
}

/**
 * Get enabled features list
 */
export function getEnabledFeatures(coverage: CoverageMetrics): string[] {
  return CAPABILITY_REGISTRY
    .filter((cap) => isCapabilityEnabled(cap.id, coverage))
    .map((cap) => cap.displayName);
}

/**
 * Get disabled features with upgrade hints
 */
export function getDisabledFeatures(
  coverage: CoverageMetrics
): Array<{ name: string; hint: string }> {
  return CAPABILITY_REGISTRY
    .filter((cap) => !isCapabilityEnabled(cap.id, coverage))
    .map((cap) => ({
      name: cap.displayName,
      hint: cap.whenDisabled.upgradeHint ?? cap.whenDisabled.message,
    }));
}

/**
 * Get capability definition by ID
 */
export function getCapabilityDefinition(
  capabilityId: string
): CapabilityDefinition | undefined {
  return CAPABILITY_REGISTRY.find((c) => c.id === capabilityId);
}
