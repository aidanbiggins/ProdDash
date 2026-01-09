// Quality Metrics Service for the Recruiter Productivity Dashboard

import { differenceInHours, isWithinInterval } from 'date-fns';
import {
  Requisition,
  Candidate,
  Event,
  User,
  EventType,
  CanonicalStage,
  QualityMetrics,
  MetricFilters
} from '../types';
import { DashboardConfig } from '../types/config';
import { normalizeStage } from './stageNormalization';

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function isInDateRange(date: Date | null, filter: MetricFilters): boolean {
  if (!date) return false;
  return isWithinInterval(date, { start: filter.dateRange.startDate, end: filter.dateRange.endDate });
}

/**
 * Calculates quality guardrail metrics
 */
export function calculateQualityMetrics(
  requisitions: Requisition[],
  candidates: Candidate[],
  events: Event[],
  users: User[],
  filter: MetricFilters,
  config: DashboardConfig
): QualityMetrics {
  // Get unique recruiters
  const recruiterIds = Array.from(new Set(requisitions.map(r => r.recruiter_id)));

  // Offer acceptance by recruiter
  const offerAcceptanceByRecruiter = recruiterIds.map(rid => {
    const recruiterReqIds = new Set(
      requisitions.filter(r => r.recruiter_id === rid).map(r => r.req_id)
    );

    const offers = candidates.filter(c =>
      recruiterReqIds.has(c.req_id) &&
      isInDateRange(c.offer_extended_at, filter)
    );

    const accepted = candidates.filter(c =>
      recruiterReqIds.has(c.req_id) &&
      isInDateRange(c.offer_accepted_at, filter)
    );

    const user = users.find(u => u.user_id === rid);

    return {
      recruiterId: rid,
      recruiterName: user?.name || rid,
      acceptanceRate: offers.length > 0 ? accepted.length / offers.length : null,
      offerCount: offers.length
    };
  });

  // Offer acceptance by function
  const functions = Array.from(new Set(requisitions.map(r => r.function)));
  const offerAcceptanceByFunction = functions.map(func => {
    const funcReqIds = new Set(
      requisitions.filter(r => r.function === func).map(r => r.req_id)
    );

    const offers = candidates.filter(c =>
      funcReqIds.has(c.req_id) &&
      isInDateRange(c.offer_extended_at, filter)
    );

    const accepted = candidates.filter(c =>
      funcReqIds.has(c.req_id) &&
      isInDateRange(c.offer_accepted_at, filter)
    );

    return {
      function: func,
      acceptanceRate: offers.length > 0 ? accepted.length / offers.length : null,
      offerCount: offers.length
    };
  });

  // Late-stage fallout rates
  // Onsite -> Reject
  const onsiteRejects = events.filter(e => {
    if (e.event_type !== EventType.STAGE_CHANGE) return false;
    if (!isInDateRange(e.event_at, filter)) return false;
    const fromCanonical = normalizeStage(e.from_stage, config.stageMapping);
    const toCanonical = normalizeStage(e.to_stage, config.stageMapping);
    return fromCanonical === CanonicalStage.ONSITE && toCanonical === CanonicalStage.REJECTED;
  });

  const onsiteEntries = events.filter(e => {
    if (e.event_type !== EventType.STAGE_CHANGE) return false;
    if (!isInDateRange(e.event_at, filter)) return false;
    const toCanonical = normalizeStage(e.to_stage, config.stageMapping);
    return toCanonical === CanonicalStage.ONSITE;
  });

  // Offer -> Decline
  const offerDeclines = events.filter(e =>
    e.event_type === EventType.OFFER_DECLINED &&
    isInDateRange(e.event_at, filter)
  );

  const offerExtended = events.filter(e =>
    e.event_type === EventType.OFFER_EXTENDED &&
    isInDateRange(e.event_at, filter)
  );

  // Offer -> Withdraw
  const offerWithdraws = events.filter(e => {
    if (e.event_type !== EventType.CANDIDATE_WITHDREW) return false;
    if (!isInDateRange(e.event_at, filter)) return false;

    // Check if candidate was in offer stage
    const candEvents = events.filter(ev => ev.candidate_id === e.candidate_id);
    const wasInOffer = candEvents.some(ev => {
      const toCanonical = normalizeStage(ev.to_stage, config.stageMapping);
      return toCanonical === CanonicalStage.OFFER && ev.event_at < e.event_at;
    });
    return wasInOffer;
  });

  // Candidate experience metrics
  // Time from application to first touch
  const appToFirstTouchTimes: number[] = [];
  for (const cand of candidates) {
    if (!cand.applied_at || !cand.first_contacted_at) continue;
    if (!isInDateRange(cand.applied_at, filter)) continue;
    appToFirstTouchTimes.push(differenceInHours(cand.first_contacted_at, cand.applied_at));
  }

  // Time between steps (median of all stage transitions)
  const stageTransitions = events
    .filter(e =>
      e.event_type === EventType.STAGE_CHANGE &&
      isInDateRange(e.event_at, filter)
    )
    .sort((a, b) => a.event_at.getTime() - b.event_at.getTime());

  const timeBetweenSteps: number[] = [];
  const candidateLastEvent = new Map<string, Date>();

  for (const event of stageTransitions) {
    const lastEvent = candidateLastEvent.get(event.candidate_id);
    if (lastEvent) {
      timeBetweenSteps.push(differenceInHours(event.event_at, lastEvent));
    }
    candidateLastEvent.set(event.candidate_id, event.event_at);
  }

  return {
    offerAcceptanceByRecruiter,
    offerAcceptanceByFunction,
    lateStageFallout: {
      onsiteToReject: {
        count: onsiteRejects.length,
        rate: onsiteEntries.length > 0 ? onsiteRejects.length / onsiteEntries.length : null
      },
      offerToDecline: {
        count: offerDeclines.length,
        rate: offerExtended.length > 0 ? offerDeclines.length / offerExtended.length : null
      },
      offerToWithdraw: {
        count: offerWithdraws.length,
        rate: offerExtended.length > 0 ? offerWithdraws.length / offerExtended.length : null
      }
    },
    candidateExperience: {
      applicationToFirstTouchMedian: median(appToFirstTouchTimes),
      timeBetweenStepsMedian: median(timeBetweenSteps)
    }
  };
}
