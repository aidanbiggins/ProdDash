// URL State Serialization Utilities
// Enables shareable URLs with filter and tab state

import { format, parseISO, isValid } from 'date-fns';
import { MetricFilters } from '../types';

// Valid tab names (matches TabType in ProductivityDashboard)
export const VALID_TABS = [
  'overview',
  'recruiter',
  'hm-friction',
  'quality',
  'source-mix',
  'hiring-managers',
  'velocity'
] as const;

export type TabSlug = typeof VALID_TABS[number];

// Map filter keys to shorter URL param names
const PARAM_MAP: Record<string, string> = {
  recruiterIds: 'recruiters',
  functions: 'functions',
  jobFamilies: 'jobFamilies',
  levels: 'levels',
  regions: 'regions',
  locationTypes: 'locations',
  hiringManagerIds: 'hms'
};

// Reverse mapping for parsing
const PARAM_MAP_REVERSE: Record<string, string> = Object.fromEntries(
  Object.entries(PARAM_MAP).map(([key, param]) => [param, key])
);

/**
 * Serialize filters and tab to URL search params
 */
export function filtersToSearchParams(
  filters: MetricFilters,
  tab: string
): URLSearchParams {
  const params = new URLSearchParams();

  // Tab (omit if overview/default)
  if (tab && tab !== 'overview') {
    params.set('tab', tab);
  }

  // Dates - always include for clarity
  if (filters.dateRange?.startDate) {
    params.set('start', format(filters.dateRange.startDate, 'yyyy-MM-dd'));
  }
  if (filters.dateRange?.endDate) {
    params.set('end', format(filters.dateRange.endDate, 'yyyy-MM-dd'));
  }

  // Array filters - only include if set
  for (const [filterKey, paramName] of Object.entries(PARAM_MAP)) {
    const value = filters[filterKey as keyof MetricFilters] as string[] | undefined;
    if (value?.length) {
      params.set(paramName, value.join(','));
    }
  }

  // Boolean flags - only include if true
  if (filters.useWeighted) {
    params.set('weighted', '1');
  }
  if (filters.normalizeByLoad) {
    params.set('normalize', '1');
  }

  return params;
}

/**
 * Parse URL search params to partial filter state
 */
export function searchParamsToFilters(
  params: URLSearchParams
): Partial<MetricFilters> {
  const filters: Partial<MetricFilters> = {};

  // Dates
  const startStr = params.get('start');
  const endStr = params.get('end');

  if (startStr && endStr) {
    const startDate = parseISO(startStr);
    const endDate = parseISO(endStr);

    if (isValid(startDate) && isValid(endDate)) {
      filters.dateRange = { startDate, endDate };
    }
  }

  // Array filters
  for (const [paramName, filterKey] of Object.entries(PARAM_MAP_REVERSE)) {
    const value = params.get(paramName);
    if (value) {
      const values = value.split(',').map(v => v.trim()).filter(Boolean);
      if (values.length > 0) {
        (filters as any)[filterKey] = values;
      }
    }
  }

  // Boolean flags
  if (params.get('weighted') === '1') {
    filters.useWeighted = true;
  }
  if (params.get('normalize') === '1') {
    filters.normalizeByLoad = true;
  }

  return filters;
}

/**
 * Get tab from URL params
 */
export function getTabFromParams(params: URLSearchParams): TabSlug | null {
  const tabSlug = params.get('tab');
  if (tabSlug && VALID_TABS.includes(tabSlug as TabSlug)) {
    return tabSlug as TabSlug;
  }
  return null; // Use default
}

/**
 * Check if URL has any filter/tab params
 */
export function hasUrlState(params: URLSearchParams): boolean {
  return params.has('tab') ||
         params.has('start') ||
         params.has('end') ||
         Array.from(params.keys()).some(k => Object.values(PARAM_MAP).includes(k));
}
