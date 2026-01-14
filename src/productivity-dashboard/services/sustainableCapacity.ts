// Sustainable Capacity Service
// Calculates SustainableCapacityUnits based on historical "stable weeks"

import { startOfWeek, endOfWeek, isWithinInterval, subWeeks } from 'date-fns';
import {
  RecruiterCapacity,
  CAPACITY_CONSTANTS,
  calculateConfidence
} from '../types/capacityTypes';
import { Requisition, Event, EventType, User } from '../types';

// ===== STABLE WEEK DETECTION =====

interface WeekData {
  weekStart: Date;
  weekEnd: Date;
  openReqCount: number;
  stageProgressions: number;
  hiresOrClosures: number;
}

/**
 * Determines if a week is "stable" for a recruiter
 * A stable week has:
 * 1. ≥3 open reqs
 * 2. ≥1 candidate stage progression
 * 3. No hires or req closures (avoiding spikes)
 */
function isStableWeek(week: WeekData): boolean {
  return (
    week.openReqCount >= 3 &&
    week.stageProgressions >= 1 &&
    week.hiresOrClosures === 0
  );
}

/**
 * Groups events into weeks for a recruiter
 */
function groupEventsByWeek(
  events: Event[],
  requisitions: Requisition[],
  recruiterId: string,
  weeksBack: number = 26
): WeekData[] {
  const weeks: WeekData[] = [];
  const now = new Date();

  // Get reqs owned by this recruiter
  const recruiterReqIds = new Set(
    requisitions
      .filter(r => r.recruiter_id === recruiterId)
      .map(r => r.req_id)
  );

  // Filter events for this recruiter's reqs
  const recruiterEvents = events.filter(e => recruiterReqIds.has(e.req_id));

  // Generate week intervals going back
  for (let i = 0; i < weeksBack; i++) {
    const weekEnd = endOfWeek(subWeeks(now, i), { weekStartsOn: 1 });
    const weekStart = startOfWeek(subWeeks(now, i), { weekStartsOn: 1 });

    // Count open reqs during this week
    const openReqCount = requisitions.filter(r => {
      if (r.recruiter_id !== recruiterId) return false;
      const opened = r.opened_at || new Date(0);
      const closed = r.closed_at || new Date(9999, 11, 31);
      return opened <= weekEnd && closed >= weekStart;
    }).length;

    // Count stage progressions this week
    const stageProgressions = recruiterEvents.filter(e =>
      e.event_type === EventType.STAGE_CHANGE &&
      isWithinInterval(e.event_at, { start: weekStart, end: weekEnd })
    ).length;

    // Count hires this week (req closures tracked via OFFER_ACCEPTED)
    const hiresOrClosures = recruiterEvents.filter(e =>
      e.event_type === EventType.OFFER_ACCEPTED &&
      isWithinInterval(e.event_at, { start: weekStart, end: weekEnd })
    ).length;

    weeks.push({
      weekStart,
      weekEnd,
      openReqCount,
      stageProgressions,
      hiresOrClosures
    });
  }

  return weeks;
}

// ===== CAPACITY CALCULATION =====

/**
 * Calculates median of an array of numbers
 */
function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Calculates sustainable capacity from an array of weekly loads
 * Falls back to team median if insufficient stable weeks
 */
export function calculateSustainableCapacity(
  weeklyLoads: number[],
  options?: { minWeeks?: number; teamMedian?: number }
): number {
  const minWeeks = options?.minWeeks ?? CAPACITY_CONSTANTS.MIN_STABLE_WEEKS;
  const teamMedian = options?.teamMedian ?? 10; // Default fallback

  if (weeklyLoads.length < minWeeks) {
    return teamMedian;
  }

  const med = median(weeklyLoads);
  return med ?? teamMedian;
}

/**
 * Calculates SustainableCapacityUnits for a single recruiter
 */
export function calculateRecruiterCapacity(
  recruiterId: string,
  recruiterName: string,
  requisitions: Requisition[],
  events: Event[],
  weeklyWorkloads: Map<string, number[]>, // recruiterId -> array of weekly WU
  teamMedianCapacity: number
): RecruiterCapacity {
  const weeklyLoads = weeklyWorkloads.get(recruiterId) || [];
  const stableWeeksCount = weeklyLoads.length;

  const usedTeamMedian = stableWeeksCount < CAPACITY_CONSTANTS.MIN_STABLE_WEEKS;
  const sustainableCapacityUnits = calculateSustainableCapacity(weeklyLoads, {
    minWeeks: CAPACITY_CONSTANTS.MIN_STABLE_WEEKS,
    teamMedian: teamMedianCapacity
  });

  const confidence = calculateConfidence(
    stableWeeksCount,
    CAPACITY_CONSTANTS.MIN_STABLE_WEEKS
  );

  return {
    recruiterId,
    recruiterName,
    sustainableCapacityUnits,
    stableWeeksCount,
    usedTeamMedian,
    confidence
  };
}

/**
 * Calculates weekly workloads for all recruiters over trailing weeks
 * This is a simplified version that estimates based on req count and base difficulty
 */
export function calculateWeeklyWorkloads(
  requisitions: Requisition[],
  events: Event[],
  recruiterIds: string[],
  weeksBack: number = 26
): Map<string, number[]> {
  const result = new Map<string, number[]>();

  for (const recruiterId of recruiterIds) {
    const weeks = groupEventsByWeek(events, requisitions, recruiterId, weeksBack);
    const stableWeeks = weeks.filter(isStableWeek);

    // For stable weeks, estimate workload based on open req count
    // This is a simplification - in reality we'd recalculate full WorkloadScore
    const weeklyLoads = stableWeeks.map(w => w.openReqCount * 10); // ~10 WU per req average

    result.set(recruiterId, weeklyLoads);
  }

  return result;
}

/**
 * Calculates all recruiter capacities
 */
export function calculateAllRecruiterCapacities(
  requisitions: Requisition[],
  events: Event[],
  users: User[]
): RecruiterCapacity[] {
  // Get unique recruiters from requisitions
  const recruiterIds = Array.from(new Set(
    requisitions
      .map(r => r.recruiter_id)
      .filter((id): id is string => id !== null && id !== undefined && id !== '')
  ));

  // Calculate weekly workloads
  const weeklyWorkloads = calculateWeeklyWorkloads(requisitions, events, recruiterIds);

  // Calculate team median capacity
  const allWeeklyLoads: number[] = [];
  for (const loads of weeklyWorkloads.values()) {
    allWeeklyLoads.push(...loads);
  }
  const teamMedianCapacity = median(allWeeklyLoads) ?? 100; // Default 100 WU

  // Calculate capacity for each recruiter
  return recruiterIds.map(recruiterId => {
    const user = users.find(u => u.user_id === recruiterId);
    const recruiterName = user?.name || recruiterId;

    return calculateRecruiterCapacity(
      recruiterId,
      recruiterName,
      requisitions,
      events,
      weeklyWorkloads,
      teamMedianCapacity
    );
  });
}
