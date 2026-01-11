// URL State Synchronization Hook
// Syncs filter and tab state with URL query parameters

import { useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  filtersToSearchParams,
  searchParamsToFilters,
  getTabFromParams,
  hasUrlState,
  TabSlug
} from '../utils/urlState';
import { MetricFilters } from '../types';

interface UseUrlStateOptions {
  filters: MetricFilters;
  activeTab: string;
  onFiltersChange: (filters: Partial<MetricFilters>) => void;
  onTabChange: (tab: string) => void;
}

/**
 * Hook to synchronize dashboard state with URL query parameters.
 *
 * - On mount: Reads URL and applies state if present
 * - On state change: Updates URL (replace, not push)
 * - Handles browser back/forward via React Router
 */
export function useUrlState({
  filters,
  activeTab,
  onFiltersChange,
  onTabChange
}: UseUrlStateOptions) {
  const [searchParams, setSearchParams] = useSearchParams();

  // Track if this is the initial mount
  const isInitialMount = useRef(true);

  // Track if we're currently applying URL state to prevent loops
  const isApplyingUrlState = useRef(false);

  // Store previous values to detect actual changes
  const prevFiltersRef = useRef<string>('');
  const prevTabRef = useRef<string>('');

  // Apply URL state on initial mount
  useEffect(() => {
    if (!isInitialMount.current) return;
    isInitialMount.current = false;

    // Check if URL has state to apply
    if (hasUrlState(searchParams)) {
      isApplyingUrlState.current = true;

      // Apply tab from URL
      const urlTab = getTabFromParams(searchParams);
      if (urlTab !== null) {
        onTabChange(urlTab);
      }

      // Apply filters from URL
      const urlFilters = searchParamsToFilters(searchParams);
      if (Object.keys(urlFilters).length > 0) {
        onFiltersChange(urlFilters);
      }

      // Reset flag after a tick to allow state to settle
      setTimeout(() => {
        isApplyingUrlState.current = false;
      }, 0);
    }
  }, []); // Only run once on mount

  // Update URL when filters or tab change
  useEffect(() => {
    // Skip during initial mount or when applying URL state
    if (isInitialMount.current || isApplyingUrlState.current) {
      return;
    }

    // Serialize current state
    const filtersJson = JSON.stringify(filters);

    // Check if anything actually changed
    if (filtersJson === prevFiltersRef.current && activeTab === prevTabRef.current) {
      return;
    }

    // Update refs
    prevFiltersRef.current = filtersJson;
    prevTabRef.current = activeTab;

    // Generate new URL params
    const newParams = filtersToSearchParams(filters, activeTab);

    // Update URL without adding to history (replace)
    setSearchParams(newParams, { replace: true });
  }, [filters, activeTab, setSearchParams]);

  // Return helper to generate shareable URL
  const getShareableUrl = useCallback(() => {
    const params = filtersToSearchParams(filters, activeTab);
    const queryString = params.toString();
    return `${window.location.origin}${window.location.pathname}${queryString ? '?' + queryString : ''}`;
  }, [filters, activeTab]);

  return { getShareableUrl };
}
