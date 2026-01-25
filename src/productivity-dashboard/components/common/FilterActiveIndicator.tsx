// Filter Active Indicator Component
// Displays a prominent bar when dashboard filters are active
// Helps users understand that they're viewing filtered data

import React from 'react';
import { MetricFilters } from '../../types';
import { hasActiveDimensionalFilters, getActiveFilterDescription } from '../../services/filterUtils';

interface FilterActiveIndicatorProps {
  filters: MetricFilters;
  totalCount?: number;
  filteredCount?: number;
  itemLabel?: string; // e.g., "requisitions", "candidates", "recruiters"
  onClearFilters?: () => void;
}

export function FilterActiveIndicator({
  filters,
  totalCount,
  filteredCount,
  itemLabel = 'items',
  onClearFilters,
}: FilterActiveIndicatorProps) {
  const hasFilters = hasActiveDimensionalFilters(filters);

  if (!hasFilters) return null;

  const filterDescription = getActiveFilterDescription(filters);
  const showCounts = totalCount !== undefined && filteredCount !== undefined && totalCount !== filteredCount;

  return (
    <div
      className="filter-active-indicator mb-3 px-3 py-2 rounded flex items-center justify-between bg-amber-500/10 border border-amber-500/30"
    >
      <div className="flex items-center gap-2">
        <i className="bi bi-funnel-fill text-amber-500"></i>
        <span className="text-amber-500 font-medium text-[0.85rem]">
          Filters Active
        </span>
        <span className="text-[0.8rem]" style={{ color: 'var(--text-secondary)' }}>
          {filterDescription}
        </span>
        {showCounts && (
          <span
            className="ml-2 px-2 py-0.5 rounded bg-amber-500/20 text-amber-500 text-[0.75rem]"
          >
            {filteredCount} of {totalCount} {itemLabel}
          </span>
        )}
      </div>
      {onClearFilters && (
        <button
          type="button"
          className="text-amber-500 text-[0.75rem] px-2 py-1"
          onClick={onClearFilters}
        >
          <i className="bi bi-x-circle mr-1"></i>
          Clear
        </button>
      )}
    </div>
  );
}

/**
 * Compact version for use in section headers
 */
export function FilterActiveBadge({
  filters,
  showDescription = false,
}: {
  filters: MetricFilters;
  showDescription?: boolean;
}) {
  const hasFilters = hasActiveDimensionalFilters(filters);

  if (!hasFilters) return null;

  return (
    <span
      className="inline-flex items-center gap-1 bg-amber-500/15 text-amber-500 text-[0.7rem] px-2 py-1 rounded"
      title={getActiveFilterDescription(filters)}
    >
      <i className="bi bi-funnel-fill text-[0.65rem]"></i>
      Filtered
      {showDescription && (
        <span className="text-amber-500/80 ml-1">
          {getActiveFilterDescription(filters)}
        </span>
      )}
    </span>
  );
}

export default FilterActiveIndicator;
