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
      className="filter-active-indicator mb-3 px-3 py-2 rounded d-flex align-items-center justify-content-between"
      style={{
        background: 'rgba(245, 158, 11, 0.1)',
        border: '1px solid rgba(245, 158, 11, 0.3)',
      }}
    >
      <div className="d-flex align-items-center gap-2">
        <i className="bi bi-funnel-fill" style={{ color: '#f59e0b' }}></i>
        <span style={{ color: '#f59e0b', fontWeight: 500, fontSize: '0.85rem' }}>
          Filters Active
        </span>
        <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
          {filterDescription}
        </span>
        {showCounts && (
          <span
            className="badge ms-2"
            style={{
              background: 'rgba(245, 158, 11, 0.2)',
              color: '#f59e0b',
              fontSize: '0.75rem',
            }}
          >
            {filteredCount} of {totalCount} {itemLabel}
          </span>
        )}
      </div>
      {onClearFilters && (
        <button
          type="button"
          className="btn btn-sm"
          onClick={onClearFilters}
          style={{
            color: '#f59e0b',
            fontSize: '0.75rem',
            padding: '0.2rem 0.5rem',
          }}
        >
          <i className="bi bi-x-circle me-1"></i>
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
      className="badge d-inline-flex align-items-center gap-1"
      style={{
        background: 'rgba(245, 158, 11, 0.15)',
        color: '#f59e0b',
        fontSize: '0.7rem',
        padding: '0.25rem 0.5rem',
      }}
      title={getActiveFilterDescription(filters)}
    >
      <i className="bi bi-funnel-fill" style={{ fontSize: '0.65rem' }}></i>
      Filtered
      {showDescription && (
        <span style={{ color: 'rgba(245, 158, 11, 0.8)', marginLeft: '4px' }}>
          {getActiveFilterDescription(filters)}
        </span>
      )}
    </span>
  );
}

export default FilterActiveIndicator;
