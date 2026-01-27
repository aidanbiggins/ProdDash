// Shared filter utilities for contextual filtering across tabs
// Provides helpers to check filter matches and styling for greyed-out items

import { Requisition, Candidate, User } from '../types/entities';
import { MetricFilters } from '../types';

/**
 * Check if a requisition matches the current filters
 */
export function reqMatchesFilters(
  req: Requisition,
  filters: MetricFilters
): boolean {
  // Check recruiter filter
  if (filters.recruiterIds && filters.recruiterIds.length > 0) {
    if (!req.recruiter_id || !filters.recruiterIds.includes(req.recruiter_id)) {
      return false;
    }
  }

  // Check hiring manager filter
  if (filters.hiringManagerIds && filters.hiringManagerIds.length > 0) {
    if (!req.hiring_manager_id || !filters.hiringManagerIds.includes(req.hiring_manager_id)) {
      return false;
    }
  }

  // Check function filter
  if (filters.functions && filters.functions.length > 0) {
    if (!req.function || !filters.functions.includes(req.function)) {
      return false;
    }
  }

  // Check job family filter
  if (filters.jobFamilies && filters.jobFamilies.length > 0) {
    if (!req.job_family || !filters.jobFamilies.includes(req.job_family)) {
      return false;
    }
  }

  // Check level filter
  if (filters.levels && filters.levels.length > 0) {
    if (!req.level || !filters.levels.includes(req.level)) {
      return false;
    }
  }

  // Check region filter
  if (filters.regions && filters.regions.length > 0) {
    if (!req.location_region || !filters.regions.includes(req.location_region)) {
      return false;
    }
  }

  return true;
}

/**
 * Check if a requisition matches filters by req_id lookup
 */
export function reqIdMatchesFilters(
  reqId: string,
  requisitions: Requisition[],
  filters: MetricFilters
): boolean {
  const req = requisitions.find(r => r.req_id === reqId);
  if (!req) return false;
  return reqMatchesFilters(req, filters);
}

/**
 * Check if a candidate matches filters (via their requisition)
 */
export function candidateMatchesFilters(
  candidate: Candidate,
  requisitions: Requisition[],
  filters: MetricFilters
): boolean {
  return reqIdMatchesFilters(candidate.req_id, requisitions, filters);
}

/**
 * Check if a hiring manager matches filters
 */
export function hmMatchesFilters(
  hmUserId: string,
  filters: MetricFilters
): boolean {
  if (filters.hiringManagerIds && filters.hiringManagerIds.length > 0) {
    return filters.hiringManagerIds.includes(hmUserId);
  }
  return true;
}

/**
 * Check if a recruiter matches filters
 */
export function recruiterMatchesFilters(
  recruiterId: string,
  filters: MetricFilters
): boolean {
  if (filters.recruiterIds && filters.recruiterIds.length > 0) {
    return filters.recruiterIds.includes(recruiterId);
  }
  return true;
}

/**
 * Check if any dimensional filters are active (excluding date range)
 */
export function hasActiveDimensionalFilters(filters: MetricFilters): boolean {
  return Boolean(
    (filters.recruiterIds && filters.recruiterIds.length > 0) ||
    (filters.hiringManagerIds && filters.hiringManagerIds.length > 0) ||
    (filters.functions && filters.functions.length > 0) ||
    (filters.jobFamilies && filters.jobFamilies.length > 0) ||
    (filters.levels && filters.levels.length > 0) ||
    (filters.regions && filters.regions.length > 0)
  );
}

/**
 * Get a description of active filters for display
 */
export function getActiveFilterDescription(filters: MetricFilters): string {
  const parts: string[] = [];

  if (filters.recruiterIds && filters.recruiterIds.length > 0) {
    parts.push(`${filters.recruiterIds.length} recruiter${filters.recruiterIds.length > 1 ? 's' : ''}`);
  }
  if (filters.hiringManagerIds && filters.hiringManagerIds.length > 0) {
    parts.push(`${filters.hiringManagerIds.length} HM${filters.hiringManagerIds.length > 1 ? 's' : ''}`);
  }
  if (filters.functions && filters.functions.length > 0) {
    parts.push(`${filters.functions.length} function${filters.functions.length > 1 ? 's' : ''}`);
  }
  if (filters.jobFamilies && filters.jobFamilies.length > 0) {
    parts.push(`${filters.jobFamilies.length} job family`);
  }
  if (filters.levels && filters.levels.length > 0) {
    parts.push(`${filters.levels.length} level${filters.levels.length > 1 ? 's' : ''}`);
  }
  if (filters.regions && filters.regions.length > 0) {
    parts.push(`${filters.regions.length} region${filters.regions.length > 1 ? 's' : ''}`);
  }

  return parts.length > 0 ? `Filtered by: ${parts.join(', ')}` : '';
}

// ===== STYLING CONSTANTS =====

/**
 * Styles for greyed-out items that don't match filters
 */
export const GREYED_OUT_STYLES = {
  opacity: 0.4,
  transition: 'opacity 0.2s ease',
  color: 'rgba(100, 116, 139, 0.8)',
  badgeBackground: 'rgba(100, 116, 139, 0.2)',
  badgeColor: 'rgba(100, 116, 139, 0.6)',
  indicatorColor: 'rgba(100, 116, 139, 0.5)',
};

/**
 * Get opacity style based on filter match
 */
export function getFilterOpacity(matchesFilter: boolean, hasActiveFilters: boolean): number {
  if (!hasActiveFilters) return 1;
  return matchesFilter ? 1 : GREYED_OUT_STYLES.opacity;
}
