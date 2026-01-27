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
 * - On tab change: Pushes new history entry (enables browser back/forward)
 * - On filter change: Replaces URL (avoids cluttering history)
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

  // Track previous URL to detect browser navigation
  const prevUrlRef = useRef<string>('');

  // Apply URL state on mount and browser back/forward navigation
  useEffect(() => {
    const currentUrl = searchParams.toString();

    // Skip if URL hasn't changed (prevents loops)
    if (currentUrl === prevUrlRef.current && !isInitialMount.current) {
      return;
    }

    // Skip if we're currently pushing our own changes
    if (isApplyingUrlState.current) {
      return;
    }

    const isInitial = isInitialMount.current;
    isInitialMount.current = false;
    prevUrlRef.current = currentUrl;

    // Check if URL has state to apply
    if (hasUrlState(searchParams)) {
      isApplyingUrlState.current = true;

      // Apply tab from URL
      const urlTab = getTabFromParams(searchParams);
      if (urlTab !== null) {
        onTabChange(urlTab);
        // Update refs to prevent re-pushing the same state
        prevTabRef.current = urlTab;
      }

      // Apply filters from URL (only on initial load, not on back/forward for tabs)
      if (isInitial) {
        const urlFilters = searchParamsToFilters(searchParams);
        if (Object.keys(urlFilters).length > 0) {
          onFiltersChange(urlFilters);
          prevFiltersRef.current = JSON.stringify(urlFilters);
        }
      }

      // Reset flag after a tick to allow state to settle
      setTimeout(() => {
        isApplyingUrlState.current = false;
      }, 0);
    }
  }, [searchParams, onTabChange, onFiltersChange]);

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

    // Detect if tab changed (push to history) vs only filters changed (replace)
    const tabChanged = activeTab !== prevTabRef.current;

    // Update refs
    prevFiltersRef.current = filtersJson;
    prevTabRef.current = activeTab;

    // Generate new URL params
    const newParams = filtersToSearchParams(filters, activeTab);

    // Update prevUrlRef to prevent the first effect from re-triggering
    prevUrlRef.current = newParams.toString();

    // Set flag to prevent first effect from reacting to this change
    isApplyingUrlState.current = true;

    // Push to history when tab changes (enables browser back button)
    // Replace when only filters change (avoids cluttering history)
    setSearchParams(newParams, { replace: !tabChanged });

    // Reset flag after the URL update settles
    setTimeout(() => {
      isApplyingUrlState.current = false;
    }, 0);
  }, [filters, activeTab, setSearchParams]);

  // Return helper to generate shareable URL
  const getShareableUrl = useCallback(() => {
    const params = filtersToSearchParams(filters, activeTab);
    const queryString = params.toString();
    return `${window.location.origin}${window.location.pathname}${queryString ? '?' + queryString : ''}`;
  }, [filters, activeTab]);

  return { getShareableUrl };
}
