// Repair Suggestions Service
// Generates actionable suggestions to improve data quality and unlock features
// See docs/plans/RESILIENT_IMPORT_AND_GUIDANCE_V1.md

import {
  RepairSuggestion,
  CoverageMetrics,
  ImportResult,
} from '../types/resilientImportTypes';
import {
  CAPABILITY_REGISTRY,
  isCapabilityEnabled,
} from './capabilityRegistry';

/**
 * Generate repair suggestions based on import result and coverage
 */
export function generateRepairSuggestions(
  importResult: Partial<ImportResult>,
  coverage: CoverageMetrics
): RepairSuggestion[] {
  const suggestions: RepairSuggestion[] = [];

  // Check for unmapped columns that could unlock features
  if (importResult.unmappedColumns) {
    for (const column of importResult.unmappedColumns) {
      const suggestion = checkUnmappedColumn(column, coverage);
      if (suggestion) {
        suggestions.push(suggestion);
      }
    }
  }

  // Suggest snapshot date if not detected
  if (!importResult.snapshotDate || importResult.snapshotDateSource === 'import_date') {
    suggestions.push({
      id: 'set_snapshot_date',
      type: 'set_snapshot_date',
      priority: 'medium',
      title: 'Set snapshot date',
      description: 'Specify when this data was exported for accurate trend tracking',
      impact: 'Enables: accurate historical comparisons',
      cta: {
        label: 'Set Date',
        action: { type: 'open_snapshot_date_picker' },
      },
      estimatedEffort: 'one-click',
      affectedCapabilities: ['section_trends'],
    });
  }

  // Suggest importing another snapshot
  if (coverage.counts.snapshots === 1) {
    suggestions.push({
      id: 'import_another_snapshot',
      type: 'import_snapshot',
      priority: 'medium',
      title: "Import another week's data",
      description: 'Add historical data to enable trend analysis',
      impact: 'Unlocks: Historical Trends, Week-over-Week comparisons',
      cta: {
        label: 'Import Data',
        action: { type: 'open_import_modal' },
      },
      estimatedEffort: 'quick',
      affectedCapabilities: ['section_trends'],
    });
  }

  // Suggest mapping unknown stages
  if (importResult.unmappedStages && importResult.unmappedStages.length > 0) {
    suggestions.push({
      id: 'map_stages',
      type: 'configure_stages',
      priority: 'low',
      title: `Map ${importResult.unmappedStages.length} unknown stage names`,
      description: `Stages like "${importResult.unmappedStages[0]}" need mapping to canonical stages`,
      impact: 'Improves: funnel accuracy, stage duration metrics',
      cta: {
        label: 'Map Stages',
        action: {
          type: 'open_stage_mapper',
          params: { stages: importResult.unmappedStages },
        },
      },
      estimatedEffort: 'moderate',
      affectedCapabilities: ['section_funnel', 'metric_pipeline_velocity'],
    });
  }

  // Check for low coverage fields that would unlock capabilities
  const lowCoverageHints = checkLowCoverageForCapabilities(coverage);
  suggestions.push(...lowCoverageHints);

  return prioritizeSuggestions(suggestions, coverage);
}

/**
 * Check if an unmapped column could be useful
 */
function checkUnmappedColumn(
  column: string,
  coverage: CoverageMetrics
): RepairSuggestion | null {
  const columnLower = column.toLowerCase();

  // Check for hiring manager column
  if (
    !coverage.flags.hasHMAssignment &&
    (columnLower.includes('hiring') ||
      columnLower.includes('manager') ||
      columnLower.includes('hm'))
  ) {
    return {
      id: `map_${column}`,
      type: 'map_column',
      priority: 'high',
      title: `Map "${column}" column`,
      description: 'This column looks like it contains hiring manager data',
      impact: 'Unlocks: HM Friction Analysis, HM Latency KPI',
      cta: {
        label: 'Map Column',
        action: { type: 'open_column_mapper', params: { column } },
      },
      estimatedEffort: 'one-click',
      affectedCapabilities: ['tab_hm_friction', 'widget_hm_latency'],
    };
  }

  // Check for source column
  if (
    !coverage.flags.hasSourceData &&
    (columnLower.includes('source') ||
      columnLower.includes('referral') ||
      columnLower.includes('origin'))
  ) {
    return {
      id: `map_${column}`,
      type: 'map_column',
      priority: 'high',
      title: `Map "${column}" column`,
      description: 'This column looks like it contains candidate source data',
      impact: 'Unlocks: Source Effectiveness, Source Breakdown',
      cta: {
        label: 'Map Column',
        action: { type: 'open_column_mapper', params: { column } },
      },
      estimatedEffort: 'one-click',
      affectedCapabilities: ['tab_source_mix', 'widget_source_breakdown'],
    };
  }

  // Check for applied date column
  if (
    coverage.fieldCoverage['cand.applied_at'] < 0.5 &&
    (columnLower.includes('applied') ||
      columnLower.includes('submit') ||
      columnLower.includes('application date'))
  ) {
    return {
      id: `map_${column}`,
      type: 'map_column',
      priority: 'high',
      title: `Map "${column}" column`,
      description: 'This column looks like it contains application dates',
      impact: 'Unlocks: Time-to-Fill metrics, Velocity Insights',
      cta: {
        label: 'Map Column',
        action: { type: 'open_column_mapper', params: { column } },
      },
      estimatedEffort: 'one-click',
      affectedCapabilities: ['tab_velocity', 'metric_median_ttf', 'section_ttf_chart'],
    };
  }

  return null;
}

/**
 * Check for low coverage that affects capabilities
 */
function checkLowCoverageForCapabilities(
  coverage: CoverageMetrics
): RepairSuggestion[] {
  const suggestions: RepairSuggestion[] = [];

  // Check each capability and see if we're close to enabling it
  for (const capability of CAPABILITY_REGISTRY) {
    if (isCapabilityEnabled(capability.id, coverage)) continue;

    // Check if we're "close" to enabling (at least 50% of requirements met)
    const metCount = capability.requirements.filter((req) => {
      switch (req.type) {
        case 'field_coverage':
          return (coverage.fieldCoverage[req.field!] ?? 0) >= (req.minValue ?? 0);
        case 'flag':
          return coverage.flags[req.flag!] ?? false;
        case 'count':
          return (coverage.counts[req.countField!] ?? 0) >= (req.minCount ?? 0);
        case 'sample_size':
          return (coverage.sampleSizes[req.countField as keyof typeof coverage.sampleSizes] ?? 0) >= (req.minCount ?? 0);
        default:
          return true;
      }
    }).length;

    const metRatio = metCount / capability.requirements.length;

    // Only suggest if we're at least 50% there
    if (metRatio >= 0.5 && metRatio < 1) {
      const unmetReqs = capability.requirements.filter((req) => {
        switch (req.type) {
          case 'field_coverage':
            return (coverage.fieldCoverage[req.field!] ?? 0) < (req.minValue ?? 0);
          case 'flag':
            return !(coverage.flags[req.flag!] ?? false);
          default:
            return false;
        }
      });

      if (unmetReqs.length > 0) {
        const firstUnmet = unmetReqs[0];
        let description = '';
        let title = '';

        if (firstUnmet.type === 'field_coverage') {
          const currentPct = Math.round((coverage.fieldCoverage[firstUnmet.field!] ?? 0) * 100);
          const neededPct = Math.round((firstUnmet.minValue ?? 0) * 100);
          title = `Improve ${firstUnmet.field!.split('.')[1]} coverage`;
          description = `Currently ${currentPct}%, need ${neededPct}%`;
        } else if (firstUnmet.type === 'flag') {
          title = `Add ${firstUnmet.flag!.replace(/([A-Z])/g, ' $1').toLowerCase().trim()}`;
          description = 'Missing data for this capability';
        }

        if (title) {
          suggestions.push({
            id: `improve_${capability.id}`,
            type: 'fix_data_quality',
            priority: 'low',
            title,
            description,
            impact: `Unlocks: ${capability.displayName}`,
            cta: {
              label: 'Learn More',
              action: { type: 'navigate', params: { path: '/settings/data-health' } },
            },
            estimatedEffort: 'moderate',
            affectedCapabilities: [capability.id],
          });
        }
      }
    }
  }

  return suggestions;
}

/**
 * Prioritize suggestions by effort and impact
 */
function prioritizeSuggestions(
  suggestions: RepairSuggestion[],
  _coverage: CoverageMetrics
): RepairSuggestion[] {
  return suggestions.sort((a, b) => {
    // 1. One-click actions first
    const effortOrder = { 'one-click': 0, quick: 1, moderate: 2 };
    if (effortOrder[a.estimatedEffort] !== effortOrder[b.estimatedEffort]) {
      return effortOrder[a.estimatedEffort] - effortOrder[b.estimatedEffort];
    }

    // 2. Higher priority
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    }

    // 3. More capabilities unlocked
    return b.affectedCapabilities.length - a.affectedCapabilities.length;
  });
}

/**
 * Get top N suggestions
 */
export function getTopSuggestions(
  suggestions: RepairSuggestion[],
  count: number = 3
): RepairSuggestion[] {
  return suggestions.slice(0, count);
}

/**
 * Get suggestions by type
 */
export function getSuggestionsByType(
  suggestions: RepairSuggestion[],
  type: RepairSuggestion['type']
): RepairSuggestion[] {
  return suggestions.filter((s) => s.type === type);
}

/**
 * Get suggestion by ID
 */
export function getSuggestionById(
  suggestions: RepairSuggestion[],
  id: string
): RepairSuggestion | undefined {
  return suggestions.find((s) => s.id === id);
}

/**
 * Count suggestions by priority
 */
export function countSuggestionsByPriority(
  suggestions: RepairSuggestion[]
): { high: number; medium: number; low: number } {
  return {
    high: suggestions.filter((s) => s.priority === 'high').length,
    medium: suggestions.filter((s) => s.priority === 'medium').length,
    low: suggestions.filter((s) => s.priority === 'low').length,
  };
}
