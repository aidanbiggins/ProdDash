// Metrics Calculation Engine for the Recruiter Productivity Dashboard

import { differenceInDays, differenceInHours, isWithinInterval, startOfWeek, endOfWeek, eachWeekOfInterval } from 'date-fns';
import {
  Requisition,
  Candidate,
  Event,
  User,
  EventType,
  RequisitionStatus,
  CandidateDisposition,
  CanonicalStage,
  MetricFilters,
  OutcomeMetrics,
  ExecutionVolumeMetrics,
  FunnelConversionMetrics,
  StageConversion,
  AgingMetrics,
  AgingBucket,
  TimeAttribution,
  RecruiterSummary,
  OverviewMetrics,
  WeeklyTrend,
  SourceEffectivenessMetrics,
  SourceMetrics,
  StageFunnelData
} from '../types';
import { DashboardConfig } from '../types/config';
import { NormalizedEvent, normalizeStage } from './stageNormalization';


// ===== UTILITY FUNCTIONS =====

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

function matchesFilters(req: Requisition, filter: MetricFilters): boolean {
  if (filter.recruiterIds?.length && !filter.recruiterIds.includes(req.recruiter_id)) {
    return false;
  }
  if (filter.functions?.length && !filter.functions.includes(req.function)) {
    return false;
  }
  if (filter.jobFamilies?.length && !filter.jobFamilies.includes(req.job_family)) {
    return false;
  }
  if (filter.levels?.length && !filter.levels.includes(req.level)) {
    return false;
  }
  if (filter.regions?.length && !filter.regions.includes(req.location_region)) {
    return false;
  }
  if (filter.locationTypes?.length && !filter.locationTypes.includes(req.location_type)) {
    return false;
  }
  if (filter.hiringManagerIds?.length && !filter.hiringManagerIds.includes(req.hiring_manager_id)) {
    return false;
  }
  return true;
}

function getUserName(userId: string, users: User[]): string {
  return users.find(u => u.user_id === userId)?.name || userId;
}

// ===== OUTCOME METRICS =====

export function calculateOutcomeMetrics(
  candidates: Candidate[],
  requisitions: Requisition[],
  filter: MetricFilters
): OutcomeMetrics {
  // Get reqs that match filters
  const filteredReqIds = new Set(
    requisitions.filter(r => matchesFilters(r, filter)).map(r => r.req_id)
  );

  // Filter candidates to matching reqs
  const relevantCandidates = candidates.filter(c => filteredReqIds.has(c.req_id));

  // Hires in date range
  const hiresInRange = relevantCandidates.filter(c =>
    c.disposition === CandidateDisposition.Hired &&
    isInDateRange(c.hired_at, filter)
  );

  // Offers extended in date range
  const offersInRange = relevantCandidates.filter(c =>
    isInDateRange(c.offer_extended_at, filter)
  );

  // Offers accepted in date range
  const offersAccepted = relevantCandidates.filter(c =>
    isInDateRange(c.offer_accepted_at, filter)
  );

  // Time to fill for reqs closed in range
  const closedReqs = requisitions.filter(r =>
    matchesFilters(r, filter) &&
    r.status === RequisitionStatus.Closed &&
    isInDateRange(r.closed_at, filter)
  );

  const ttfValues = closedReqs
    .filter(r => r.closed_at && r.opened_at)
    .map(r => differenceInDays(r.closed_at!, r.opened_at));

  return {
    hires: hiresInRange.length,
    offersExtended: offersInRange.length,
    offersAccepted: offersAccepted.length,
    offerAcceptanceRate: offersInRange.length > 0
      ? offersAccepted.length / offersInRange.length
      : null,
    timeToFillMedian: median(ttfValues)
  };
}

// ===== EXECUTION VOLUME METRICS =====

export function calculateExecutionVolumeMetrics(
  events: Event[],
  requisitions: Requisition[],
  recruiterId: string,
  filter: MetricFilters,
  config: DashboardConfig
): ExecutionVolumeMetrics {
  // Get reqs assigned to this recruiter
  const recruiterReqIds = new Set(
    requisitions
      .filter(r => r.recruiter_id === recruiterId && matchesFilters(r, filter))
      .map(r => r.req_id)
  );

  // Events for recruiter's reqs in date range by recruiter
  const recruiterEvents = events.filter(e =>
    recruiterReqIds.has(e.req_id) &&
    e.actor_user_id === recruiterId &&
    isInDateRange(e.event_at, filter)
  );

  // Outreach sent
  const outreachSent = recruiterEvents.filter(e =>
    e.event_type === EventType.OUTREACH_SENT
  ).length;

  // Screens completed
  const screensCompleted = recruiterEvents.filter(e =>
    e.event_type === EventType.SCREEN_COMPLETED
  ).length;

  // Submittals to HM (stage changes to HM_SCREEN)
  const submittals = recruiterEvents.filter(e => {
    if (e.event_type !== EventType.STAGE_CHANGE) return false;
    const canonical = normalizeStage(e.to_stage, config.stageMapping);
    return canonical === CanonicalStage.HM_SCREEN;
  }).length;

  // Interview loops scheduled
  const loopsScheduled = recruiterEvents.filter(e =>
    e.event_type === EventType.INTERVIEW_SCHEDULED
  ).length;

  // Follow-up velocity (time from interview completed to feedback submitted)
  const interviewCompleted = events.filter(e =>
    recruiterReqIds.has(e.req_id) &&
    e.event_type === EventType.INTERVIEW_COMPLETED &&
    isInDateRange(e.event_at, filter)
  );

  const followUpTimes: number[] = [];
  for (const ic of interviewCompleted) {
    // Find first feedback submitted after this interview
    const feedback = events.find(e =>
      e.candidate_id === ic.candidate_id &&
      e.event_type === EventType.FEEDBACK_SUBMITTED &&
      e.event_at > ic.event_at
    );
    if (feedback) {
      followUpTimes.push(differenceInHours(feedback.event_at, ic.event_at));
    }
  }

  return {
    outreachSent,
    screensCompleted,
    submittalsToHM: submittals,
    interviewLoopsScheduled: loopsScheduled,
    followUpVelocityMedian: median(followUpTimes)
  };
}

// ===== FUNNEL CONVERSION METRICS =====

function calculateStageConversion(
  fromStage: CanonicalStage,
  toStage: CanonicalStage,
  events: NormalizedEvent[],
  filter: MetricFilters
): StageConversion {
  // Candidates who entered fromStage in date range
  const enteredFromStage = new Set<string>();
  const convertedToStage = new Set<string>();

  for (const event of events) {
    if (event.event_type !== EventType.STAGE_CHANGE) continue;
    if (!isInDateRange(event.event_at, filter)) continue;

    // Track who entered the fromStage
    if (event.canonicalToStage === fromStage) {
      enteredFromStage.add(event.candidate_id);
    }
  }

  // Now check if those candidates made it to toStage (any time)
  for (const event of events) {
    if (event.event_type !== EventType.STAGE_CHANGE) continue;
    if (event.canonicalToStage !== toStage) continue;

    if (enteredFromStage.has(event.candidate_id)) {
      convertedToStage.add(event.candidate_id);
    }
  }

  const entered = enteredFromStage.size;
  const converted = convertedToStage.size;

  return {
    fromStage,
    toStage,
    entered,
    converted,
    rate: entered > 0 ? converted / entered : null
  };
}

export function calculateFunnelConversionMetrics(
  events: NormalizedEvent[],
  requisitions: Requisition[],
  recruiterId: string | null,
  filter: MetricFilters
): FunnelConversionMetrics {
  // Filter events by recruiter's reqs if specified
  let relevantEvents = events;
  if (recruiterId) {
    const recruiterReqIds = new Set(
      requisitions
        .filter(r => r.recruiter_id === recruiterId && matchesFilters(r, filter))
        .map(r => r.req_id)
    );
    relevantEvents = events.filter(e => recruiterReqIds.has(e.req_id));
  } else {
    const filteredReqIds = new Set(
      requisitions.filter(r => matchesFilters(r, filter)).map(r => r.req_id)
    );
    relevantEvents = events.filter(e => filteredReqIds.has(e.req_id));
  }

  return {
    screenToHmScreen: calculateStageConversion(
      CanonicalStage.SCREEN,
      CanonicalStage.HM_SCREEN,
      relevantEvents,
      filter
    ),
    hmScreenToOnsite: calculateStageConversion(
      CanonicalStage.HM_SCREEN,
      CanonicalStage.ONSITE,
      relevantEvents,
      filter
    ),
    onsiteToOffer: calculateStageConversion(
      CanonicalStage.ONSITE,
      CanonicalStage.OFFER,
      relevantEvents,
      filter
    ),
    offerToHired: calculateStageConversion(
      CanonicalStage.OFFER,
      CanonicalStage.HIRED,
      relevantEvents,
      filter
    )
  };
}

// ===== AGING METRICS =====

export function calculateAgingMetrics(
  requisitions: Requisition[],
  events: Event[],
  recruiterId: string,
  filter: MetricFilters,
  stalledDays: number = 14
): AgingMetrics {
  const now = new Date();

  // Open reqs for this recruiter
  const openReqs = requisitions.filter(r =>
    r.recruiter_id === recruiterId &&
    r.status === RequisitionStatus.Open &&
    matchesFilters(r, filter)
  );

  // Calculate age buckets
  const buckets: AgingBucket[] = [
    { label: '0-30 days', min: 0, max: 30, count: 0, reqIds: [] },
    { label: '31-60 days', min: 31, max: 60, count: 0, reqIds: [] },
    { label: '61-90 days', min: 61, max: 90, count: 0, reqIds: [] },
    { label: '91-120 days', min: 91, max: 120, count: 0, reqIds: [] },
    { label: '120+ days', min: 121, max: null, count: 0, reqIds: [] }
  ];

  for (const req of openReqs) {
    const age = differenceInDays(now, req.opened_at);
    for (const bucket of buckets) {
      if (age >= bucket.min && (bucket.max === null || age <= bucket.max)) {
        bucket.count++;
        bucket.reqIds.push(req.req_id);
        break;
      }
    }
  }

  // Find stalled reqs (no candidate stage change in last N days)
  const stalledReqIds: string[] = [];
  for (const req of openReqs) {
    const reqEvents = events.filter(e =>
      e.req_id === req.req_id &&
      e.event_type === EventType.STAGE_CHANGE
    );

    if (reqEvents.length === 0) {
      // No stage changes ever - stalled if req is older than threshold
      if (differenceInDays(now, req.opened_at) > stalledDays) {
        stalledReqIds.push(req.req_id);
      }
    } else {
      // Find most recent stage change
      const lastEvent = reqEvents.reduce((latest, e) =>
        e.event_at > latest.event_at ? e : latest
      );
      if (differenceInDays(now, lastEvent.event_at) > stalledDays) {
        stalledReqIds.push(req.req_id);
      }
    }
  }

  return {
    openReqCount: openReqs.length,
    agingBuckets: buckets,
    stalledReqs: {
      count: stalledReqIds.length,
      threshold: stalledDays,
      reqIds: stalledReqIds
    }
  };
}

// ===== TIME ATTRIBUTION =====

export function calculateTimeAttribution(
  events: Event[],
  candidates: Candidate[],
  requisitions: Requisition[],
  recruiterId: string,
  filter: MetricFilters,
  config: DashboardConfig
): TimeAttribution {
  const recruiterReqIds = new Set(
    requisitions
      .filter(r => r.recruiter_id === recruiterId && matchesFilters(r, filter))
      .map(r => r.req_id)
  );

  // Recruiter-controlled: time from lead/applied to first action
  const leadToFirstActionTimes: number[] = [];
  const relevantCandidates = candidates.filter(c => recruiterReqIds.has(c.req_id));

  for (const cand of relevantCandidates) {
    const startDate = cand.applied_at || cand.first_contacted_at;
    if (!startDate) continue;

    // Find first recruiter action (outreach or screen)
    const firstAction = events
      .filter(e =>
        e.candidate_id === cand.candidate_id &&
        e.actor_user_id === recruiterId &&
        (e.event_type === EventType.OUTREACH_SENT || e.event_type === EventType.SCREEN_COMPLETED)
      )
      .sort((a, b) => a.event_at.getTime() - b.event_at.getTime())[0];

    if (firstAction) {
      leadToFirstActionTimes.push(differenceInHours(firstAction.event_at, startDate));
    }
  }

  // Recruiter-controlled: time from screen complete to submittal
  const screenToSubmittalTimes: number[] = [];
  const screenEvents = events.filter(e =>
    recruiterReqIds.has(e.req_id) &&
    e.event_type === EventType.SCREEN_COMPLETED
  );

  for (const screen of screenEvents) {
    const submittal = events.find(e =>
      e.candidate_id === screen.candidate_id &&
      e.event_type === EventType.STAGE_CHANGE &&
      normalizeStage(e.to_stage, config.stageMapping) === CanonicalStage.HM_SCREEN &&
      e.event_at > screen.event_at
    );
    if (submittal) {
      screenToSubmittalTimes.push(differenceInHours(submittal.event_at, screen.event_at));
    }
  }

  // HM-controlled: feedback latency
  const feedbackLatencies: number[] = [];
  const interviewCompleted = events.filter(e =>
    recruiterReqIds.has(e.req_id) &&
    e.event_type === EventType.INTERVIEW_COMPLETED
  );

  for (const ic of interviewCompleted) {
    const feedback = events.find(e =>
      e.candidate_id === ic.candidate_id &&
      e.event_type === EventType.FEEDBACK_SUBMITTED &&
      e.event_at > ic.event_at
    );
    if (feedback) {
      feedbackLatencies.push(differenceInHours(feedback.event_at, ic.event_at));
    }
  }

  // HM-controlled: decision latency (last interview to offer/reject)
  const decisionLatencies: number[] = [];
  const candidateLastInterviews = new Map<string, Date>();

  for (const e of interviewCompleted) {
    const existing = candidateLastInterviews.get(e.candidate_id);
    if (!existing || e.event_at > existing) {
      candidateLastInterviews.set(e.candidate_id, e.event_at);
    }
  }

  for (const [candId, lastInterview] of candidateLastInterviews) {
    const decision = events.find(e =>
      e.candidate_id === candId &&
      (e.event_type === EventType.OFFER_EXTENDED ||
        e.event_type === EventType.REJECTION_SENT) &&
      e.event_at > lastInterview
    );
    if (decision) {
      decisionLatencies.push(differenceInHours(decision.event_at, lastInterview));
    }
  }

  // Ops-controlled: offer approval latency
  const offerApprovalLatencies: number[] = [];
  const offerRequests = events.filter(e =>
    recruiterReqIds.has(e.req_id) &&
    e.event_type === EventType.OFFER_REQUESTED
  );

  for (const req of offerRequests) {
    const approval = events.find(e =>
      e.candidate_id === req.candidate_id &&
      e.event_type === EventType.OFFER_APPROVED &&
      e.event_at > req.event_at
    );
    if (approval) {
      offerApprovalLatencies.push(differenceInHours(approval.event_at, req.event_at));
    }
  }

  return {
    recruiterControlledTime: {
      leadToFirstAction: median(leadToFirstActionTimes),
      screenToSubmittal: median(screenToSubmittalTimes)
    },
    hmControlledTime: {
      feedbackLatency: median(feedbackLatencies),
      decisionLatency: median(decisionLatencies)
    },
    opsControlledTime: {
      offerApprovalLatency: median(offerApprovalLatencies),
      available: offerRequests.length > 0
    }
  };
}

// ===== WEEKLY TRENDS =====

export function calculateWeeklyTrends(
  candidates: Candidate[],
  events: Event[],
  requisitions: Requisition[],
  filter: MetricFilters,
  complexityScores?: Map<string, number>
): WeeklyTrend[] {
  const weeks = eachWeekOfInterval({
    start: filter.dateRange.startDate,
    end: filter.dateRange.endDate
  });

  const filteredReqIds = new Set(
    requisitions.filter(r => matchesFilters(r, filter)).map(r => r.req_id)
  );

  // Get filtered requisitions for open req calculations
  const filteredReqs = requisitions.filter(r => matchesFilters(r, filter));

  return weeks.map(weekStart => {
    const weekEnd = endOfWeek(weekStart);
    const weekInterval = { start: weekStart, end: weekEnd };

    // Hires in this week
    const hiresThisWeek = candidates.filter(c =>
      filteredReqIds.has(c.req_id) &&
      c.hired_at &&
      isWithinInterval(c.hired_at, weekInterval)
    );
    const hires = hiresThisWeek.length;

    // Weighted hires - sum of complexity scores for hires this week
    const weightedHires = hiresThisWeek.reduce((sum, c) => {
      return sum + (complexityScores?.get(c.req_id) || 1);
    }, 0);

    // Open reqs during this week (opened before week end, not closed before week start)
    const openReqCount = filteredReqs.filter(r => {
      const openedBefore = r.opened_at <= weekEnd;
      const notClosedYet = !r.closed_at || r.closed_at >= weekStart;
      return openedBefore && notClosedYet && r.status !== RequisitionStatus.Canceled;
    }).length;

    // Productivity index
    const productivityIndex = openReqCount > 0 ? weightedHires / openReqCount : null;

    // Offers in this week
    const offers = candidates.filter(c =>
      filteredReqIds.has(c.req_id) &&
      c.offer_extended_at &&
      isWithinInterval(c.offer_extended_at, weekInterval)
    ).length;

    // HM latency for this week
    const interviewsThisWeek = events.filter(e =>
      filteredReqIds.has(e.req_id) &&
      e.event_type === EventType.INTERVIEW_COMPLETED &&
      isWithinInterval(e.event_at, weekInterval)
    );

    const latencies: number[] = [];
    for (const ic of interviewsThisWeek) {
      const feedback = events.find(e =>
        e.candidate_id === ic.candidate_id &&
        e.event_type === EventType.FEEDBACK_SUBMITTED &&
        e.event_at > ic.event_at
      );
      if (feedback) {
        latencies.push(differenceInHours(feedback.event_at, ic.event_at));
      }
    }

    // Outreach in this week
    const outreach = events.filter(e =>
      filteredReqIds.has(e.req_id) &&
      e.event_type === EventType.OUTREACH_SENT &&
      isWithinInterval(e.event_at, weekInterval)
    ).length;

    // Screens completed this week
    const screens = events.filter(e =>
      filteredReqIds.has(e.req_id) &&
      e.event_type === EventType.SCREEN_COMPLETED &&
      isWithinInterval(e.event_at, weekInterval)
    ).length;

    // Submissions to HM (stage changes to HM Screen or similar)
    const submissions = events.filter(e =>
      filteredReqIds.has(e.req_id) &&
      e.event_type === EventType.STAGE_CHANGE &&
      isWithinInterval(e.event_at, weekInterval) &&
      e.to_stage && ['HM Screen', 'HM Review', 'Hiring Manager Review', 'Submitted to HM'].some(
        stage => e.to_stage?.toLowerCase().includes(stage.toLowerCase())
      )
    ).length;

    // Total pipeline movement (all stage changes)
    const stageChanges = events.filter(e =>
      filteredReqIds.has(e.req_id) &&
      e.event_type === EventType.STAGE_CHANGE &&
      isWithinInterval(e.event_at, weekInterval)
    ).length;

    // New applicants this week (by applied_at date)
    const applicants = candidates.filter(c =>
      filteredReqIds.has(c.req_id) &&
      c.applied_at &&
      isWithinInterval(c.applied_at, weekInterval)
    ).length;

    // Onsites - candidates entering onsite/interview loop stage
    const onsites = events.filter(e =>
      filteredReqIds.has(e.req_id) &&
      e.event_type === EventType.STAGE_CHANGE &&
      isWithinInterval(e.event_at, weekInterval) &&
      e.to_stage && ['Onsite', 'On-site', 'Interview', 'Interview Loop', 'First Round', '1st Round', 'Virtual Onsite'].some(
        stage => e.to_stage?.toLowerCase().includes(stage.toLowerCase())
      )
    ).length;

    return {
      weekStart,
      weekEnd,
      hires,
      offers,
      hmLatencyMedian: median(latencies),
      outreachSent: outreach,
      screens,
      submissions,
      stageChanges,
      applicants,
      onsites,
      weightedHires,
      openReqCount,
      productivityIndex
    };
  });
}

// ===== RECRUITER SUMMARY =====

export function calculateRecruiterSummary(
  recruiterId: string,
  requisitions: Requisition[],
  candidates: Candidate[],
  events: Event[],
  normalizedEvents: NormalizedEvent[],
  users: User[],
  filter: MetricFilters,
  config: DashboardConfig,
  complexityScores: Map<string, number>,
  hmWeights: Map<string, number>
): RecruiterSummary {
  const recruiter = users.find(u => u.user_id === recruiterId);

  const outcomes = calculateOutcomeMetrics(candidates, requisitions, {
    ...filter,
    recruiterIds: [recruiterId]
  });

  const executionVolume = calculateExecutionVolumeMetrics(
    events,
    requisitions,
    recruiterId,
    filter,
    config
  );

  const funnelConversion = calculateFunnelConversionMetrics(
    normalizedEvents,
    requisitions,
    recruiterId,
    filter
  );

  const aging = calculateAgingMetrics(
    requisitions,
    events,
    recruiterId,
    filter,
    config.thresholds.stalledReqDays
  );

  const timeAttribution = calculateTimeAttribution(
    events,
    candidates,
    requisitions,
    recruiterId,
    filter,
    config
  );

  // Calculate weighted metrics
  const recruiterReqs = requisitions.filter(r => r.recruiter_id === recruiterId);
  const hiredCandidates = candidates.filter(c =>
    c.disposition === CandidateDisposition.Hired &&
    isInDateRange(c.hired_at, filter) &&
    recruiterReqs.some(r => r.req_id === c.req_id && matchesFilters(r, filter))
  );

  const offeredCandidates = candidates.filter(c =>
    isInDateRange(c.offer_extended_at, filter) &&
    recruiterReqs.some(r => r.req_id === c.req_id && matchesFilters(r, filter))
  );

  let weightedHires = 0;
  for (const hire of hiredCandidates) {
    weightedHires += complexityScores.get(hire.req_id) || 1;
  }

  let weightedOffers = 0;
  for (const offer of offeredCandidates) {
    weightedOffers += (complexityScores.get(offer.req_id) || 1) * config.thresholds.offerMultiplier;
  }

  // Active req load
  const activeReqLoad = recruiterReqs.filter(r =>
    matchesFilters(r, filter) &&
    (r.status === RequisitionStatus.Open ||
      (r.opened_at <= filter.dateRange.endDate &&
        (!r.closed_at || r.closed_at >= filter.dateRange.startDate)))
  ).length;

  // Productivity index
  const productivityIndex = (weightedHires + weightedOffers * 0.5) / (activeReqLoad + 1);

  return {
    recruiterId,
    recruiterName: recruiter?.name || recruiterId,
    team: recruiter?.team || null,
    outcomes,
    executionVolume,
    funnelConversion,
    aging,
    weighted: {
      weightedHires,
      weightedOffers,
      offerMultiplier: config.thresholds.offerMultiplier,
      complexityScores: Array.from(complexityScores.entries())
        .filter(([reqId]) => recruiterReqs.some(r => r.req_id === reqId))
        .map(([reqId, score]) => ({
          reqId,
          levelWeight: 1,
          marketWeight: 1,
          nicheWeight: 1,
          hmWeight: hmWeights.get(requisitions.find(r => r.req_id === reqId)?.hiring_manager_id || '') || 1,
          totalScore: score
        }))
    },
    timeAttribution,
    productivityIndex,
    activeReqLoad
  };
}

// ===== OVERVIEW METRICS =====

export function calculateOverviewMetrics(
  requisitions: Requisition[],
  candidates: Candidate[],
  events: Event[],
  normalizedEvents: NormalizedEvent[],
  users: User[],
  filter: MetricFilters,
  config: DashboardConfig,
  complexityScores: Map<string, number>,
  hmWeights: Map<string, number>
): OverviewMetrics {
  const outcomes = calculateOutcomeMetrics(candidates, requisitions, filter);

  // Get unique recruiters
  const recruiterIds = Array.from(new Set(requisitions.map(r => r.recruiter_id)));

  // Calculate weighted totals
  let totalWeightedHires = 0;
  const hiredCandidates = candidates.filter(c =>
    c.disposition === CandidateDisposition.Hired &&
    isInDateRange(c.hired_at, filter) &&
    requisitions.some(r => r.req_id === c.req_id && matchesFilters(r, filter))
  );

  for (const hire of hiredCandidates) {
    totalWeightedHires += complexityScores.get(hire.req_id) || 1;
  }

  // Median HM decision latency
  const interviewCompleted = events.filter(e =>
    e.event_type === EventType.INTERVIEW_COMPLETED
  );

  const candidateLastInterviews = new Map<string, Date>();
  for (const e of interviewCompleted) {
    const existing = candidateLastInterviews.get(e.candidate_id);
    if (!existing || e.event_at > existing) {
      candidateLastInterviews.set(e.candidate_id, e.event_at);
    }
  }

  const decisionLatencies: number[] = [];
  for (const [candId, lastInterview] of candidateLastInterviews) {
    const decision = events.find(e =>
      e.candidate_id === candId &&
      (e.event_type === EventType.OFFER_EXTENDED || e.event_type === EventType.REJECTION_SENT)
    );
    if (decision && decision.event_at > lastInterview) {
      decisionLatencies.push(differenceInHours(decision.event_at, lastInterview));
    }
  }

  // Stalled req count
  const now = new Date();
  const openReqs = requisitions.filter(r => r.status === RequisitionStatus.Open && matchesFilters(r, filter));
  let stalledCount = 0;

  for (const req of openReqs) {
    const reqEvents = events.filter(e =>
      e.req_id === req.req_id &&
      e.event_type === EventType.STAGE_CHANGE
    );
    if (reqEvents.length === 0) {
      if (differenceInDays(now, req.opened_at) > config.thresholds.stalledReqDays) {
        stalledCount++;
      }
    } else {
      const lastEvent = reqEvents.reduce((latest, e) =>
        e.event_at > latest.event_at ? e : latest
      );
      if (differenceInDays(now, lastEvent.event_at) > config.thresholds.stalledReqDays) {
        stalledCount++;
      }
    }
  }

  // Calculate summaries for each recruiter
  const recruiterSummaries = recruiterIds.map(rid =>
    calculateRecruiterSummary(
      rid,
      requisitions,
      candidates,
      events,
      normalizedEvents,
      users,
      filter,
      config,
      complexityScores,
      hmWeights
    )
  );

  return {
    totalHires: outcomes.hires,
    totalWeightedHires,
    totalOffers: outcomes.offersExtended,
    totalOfferAcceptanceRate: outcomes.offerAcceptanceRate,
    medianTTF: outcomes.timeToFillMedian,
    medianHMDecisionLatency: median(decisionLatencies),
    stalledReqCount: stalledCount,
    recruiterSummaries: recruiterSummaries.filter(s =>
      s.outcomes.hires > 0 ||
      s.outcomes.offersExtended > 0 ||
      s.activeReqLoad > 0 ||
      s.executionVolume.outreachSent > 0
    )
  };
}

// ===== SOURCE EFFECTIVENESS =====

export function calculateSourceEffectiveness(
  candidates: Candidate[],
  requisitions: Requisition[],
  events: NormalizedEvent[],
  filter: MetricFilters
): SourceEffectivenessMetrics {
  // Get reqs that match filters
  const filteredReqIds = new Set(
    requisitions.filter(r => matchesFilters(r, filter)).map(r => r.req_id)
  );

  // Filter candidates to matching reqs and within date range
  const relevantCandidates = candidates.filter(c =>
    filteredReqIds.has(c.req_id) &&
    (isInDateRange(c.applied_at, filter) ||
      isInDateRange(c.first_contacted_at, filter) ||
      isInDateRange(c.hired_at, filter))
  );

  // Group candidates by source
  const candidatesBySource = new Map<string, Candidate[]>();
  for (const c of relevantCandidates) {
    const source = c.source || 'Unknown';
    if (!candidatesBySource.has(source)) {
      candidatesBySource.set(source, []);
    }
    candidatesBySource.get(source)!.push(c);
  }

  // Calculate metrics per source
  const bySource: SourceMetrics[] = [];

  // Define funnel stages in order
  const funnelStages = [
    CanonicalStage.SCREEN,
    CanonicalStage.HM_SCREEN,
    CanonicalStage.ONSITE,
    CanonicalStage.OFFER,
    CanonicalStage.HIRED
  ];

  for (const [source, sourceCandidates] of candidatesBySource) {
    const total = sourceCandidates.length;
    const sourceCandidateIds = new Set(sourceCandidates.map(c => c.candidate_id));

    // Hires
    const hires = sourceCandidates.filter(c =>
      c.disposition === CandidateDisposition.Hired
    );

    // Offers
    const offered = sourceCandidates.filter(c => c.offer_extended_at !== null);
    const accepted = sourceCandidates.filter(c => c.offer_accepted_at !== null);

    // Time to hire
    const timeToHireDays = hires
      .filter(c => c.hired_at && (c.applied_at || c.first_contacted_at))
      .map(c => {
        const startDate = c.applied_at || c.first_contacted_at!;
        return differenceInDays(c.hired_at!, startDate);
      });

    // Calculate full funnel data
    const funnel: StageFunnelData[] = [];

    for (let i = 0; i < funnelStages.length; i++) {
      const stage = funnelStages[i];
      const entered = new Set<string>();
      const passed = new Set<string>();

      for (const event of events) {
        if (event.event_type !== EventType.STAGE_CHANGE) continue;
        if (!sourceCandidateIds.has(event.candidate_id)) continue;

        // Count candidates who entered this stage
        if (event.canonicalToStage === stage) {
          entered.add(event.candidate_id);
        }

        // Count candidates who moved on from this stage (not rejected/withdrew)
        if (event.canonicalFromStage === stage &&
          event.canonicalToStage !== CanonicalStage.REJECTED &&
          event.canonicalToStage !== CanonicalStage.WITHDREW) {
          passed.add(event.candidate_id);
        }
      }

      // For HIRED stage, entered = passed (they made it!)
      if (stage === CanonicalStage.HIRED) {
        funnel.push({
          stage: 'Hired',
          entered: entered.size,
          passed: entered.size,
          passRate: 1
        });
      } else {
        const stageName = stage === CanonicalStage.SCREEN ? 'Screen' :
          stage === CanonicalStage.HM_SCREEN ? 'HM Screen' :
            stage === CanonicalStage.ONSITE ? 'Onsite' :
              stage === CanonicalStage.OFFER ? 'Offer' : stage;

        funnel.push({
          stage: stageName,
          entered: entered.size,
          passed: passed.size,
          passRate: entered.size > 0 ? passed.size / entered.size : null
        });
      }
    }

    // Screen pass rate (for backward compatibility)
    const screenedCandidateIds = new Set<string>();
    const passedScreenIds = new Set<string>();

    for (const event of events) {
      if (event.event_type !== EventType.STAGE_CHANGE) continue;
      if (!sourceCandidateIds.has(event.candidate_id)) continue;

      if (event.canonicalToStage === CanonicalStage.SCREEN) {
        screenedCandidateIds.add(event.candidate_id);
      }
      if (event.canonicalFromStage === CanonicalStage.SCREEN &&
        event.canonicalToStage !== CanonicalStage.REJECTED &&
        event.canonicalToStage !== CanonicalStage.WITHDREW) {
        passedScreenIds.add(event.candidate_id);
      }
    }

    // Onsite pass rate
    const onsiteCandidateIds = new Set<string>();
    const passedOnsiteIds = new Set<string>();

    for (const event of events) {
      if (event.event_type !== EventType.STAGE_CHANGE) continue;
      if (!sourceCandidateIds.has(event.candidate_id)) continue;

      if (event.canonicalToStage === CanonicalStage.ONSITE) {
        onsiteCandidateIds.add(event.candidate_id);
      }
      if (event.canonicalFromStage === CanonicalStage.ONSITE &&
        (event.canonicalToStage === CanonicalStage.OFFER ||
          event.canonicalToStage === CanonicalStage.HIRED)) {
        passedOnsiteIds.add(event.candidate_id);
      }
    }

    bySource.push({
      source,
      totalCandidates: total,
      hires: hires.length,
      hireRate: total > 0 ? hires.length / total : null,
      offers: offered.length,
      offerAcceptRate: offered.length > 0 ? accepted.length / offered.length : null,
      medianTimeToHire: median(timeToHireDays),
      screenPassRate: screenedCandidateIds.size > 0
        ? passedScreenIds.size / screenedCandidateIds.size
        : null,
      onsitePassRate: onsiteCandidateIds.size > 0
        ? passedOnsiteIds.size / onsiteCandidateIds.size
        : null,
      funnel
    });
  }

  // Sort by hire rate descending (sources with hires first)
  bySource.sort((a, b) => {
    if (a.hireRate === null && b.hireRate === null) return 0;
    if (a.hireRate === null) return 1;
    if (b.hireRate === null) return -1;
    return b.hireRate - a.hireRate;
  });

  // Source distribution - calculate first so we can use totalCandidates
  const totalCandidates = relevantCandidates.length;

  // Find best and worst performing sources (with at least some volume)
  // Use dynamic threshold - lower when filtered data is small
  const minVolumeThreshold = totalCandidates < 50 ? 1 : 5;
  const sourcesWithVolume = bySource.filter(s => s.totalCandidates >= minVolumeThreshold && s.hireRate !== null);
  const bestSource = sourcesWithVolume.length > 0
    ? { name: sourcesWithVolume[0].source, hireRate: sourcesWithVolume[0].hireRate! }
    : null;
  const worstSource = sourcesWithVolume.length > 1
    ? { name: sourcesWithVolume[sourcesWithVolume.length - 1].source, hireRate: sourcesWithVolume[sourcesWithVolume.length - 1].hireRate! }
    : null;
  const sourceDistribution = bySource.map(s => ({
    source: s.source,
    percentage: totalCandidates > 0 ? (s.totalCandidates / totalCandidates) * 100 : 0
  }));

  return {
    bySource,
    bestSource,
    worstSource,
    totalCandidates,
    sourceDistribution
  };
}

