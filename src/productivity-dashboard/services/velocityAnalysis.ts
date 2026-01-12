// Velocity Analysis Service
// Calculates decay curves and success factors for hire velocity insights

import { differenceInDays } from 'date-fns';
import {
  Candidate,
  Requisition,
  Event,
  User,
  MetricFilters,
  CandidateDisposition,
  RequisitionStatus,
  EventType,
  VelocityMetrics,
  CandidateDecayAnalysis,
  ReqDecayAnalysis,
  DecayDataPoint,
  VelocityInsight,
  CohortComparison,
  HireCohortStats,
  SuccessFactorComparison
} from '../types';

// Day buckets for decay analysis
const CANDIDATE_DECAY_BUCKETS = [
  { label: '0-14 days', min: 0, max: 14 },
  { label: '15-21 days', min: 15, max: 21 },
  { label: '22-30 days', min: 22, max: 30 },
  { label: '31-45 days', min: 31, max: 45 },
  { label: '46-60 days', min: 46, max: 60 },
  { label: '60+ days', min: 61, max: Infinity }
];

const REQ_DECAY_BUCKETS = [
  { label: '0-30 days', min: 0, max: 30 },
  { label: '31-45 days', min: 31, max: 45 },
  { label: '46-60 days', min: 46, max: 60 },
  { label: '61-90 days', min: 61, max: 90 },
  { label: '91-120 days', min: 91, max: 120 },
  { label: '120+ days', min: 121, max: Infinity }
];

/**
 * Filter requisitions based on metric filters
 */
function filterRequisitions(requisitions: Requisition[], filters: MetricFilters): Requisition[] {
  return requisitions.filter(r => {
    if (filters.recruiterIds?.length && !filters.recruiterIds.includes(r.recruiter_id)) return false;
    if (filters.functions?.length && !filters.functions.includes(r.function)) return false;
    if (filters.jobFamilies?.length && !filters.jobFamilies.includes(r.job_family || '')) return false;
    if (filters.levels?.length && !filters.levels.includes(r.level || '')) return false;
    if (filters.regions?.length && !filters.regions.includes(r.location_region)) return false;
    if (filters.hiringManagerIds?.length && !filters.hiringManagerIds.includes(r.hiring_manager_id)) return false;
    return true;
  });
}

/**
 * Calculate candidate decay analysis
 * Shows how offer acceptance rate declines with time in process
 */
function calculateCandidateDecay(
  candidates: Candidate[],
  requisitions: Requisition[],
  filters: MetricFilters
): CandidateDecayAnalysis {
  const filteredReqIds = new Set(filterRequisitions(requisitions, filters).map(r => r.req_id));

  // Get candidates who received offers (either accepted or declined)
  const offeredCandidates = candidates.filter(c =>
    filteredReqIds.has(c.req_id) &&
    c.offer_extended_at !== null
  );

  // Calculate days from start to offer for each candidate
  const candidatesWithTime = offeredCandidates.map(c => {
    const startDate = c.applied_at || c.first_contacted_at;
    const offerDate = c.offer_extended_at!;
    const daysToOffer = startDate ? differenceInDays(offerDate, startDate) : null;
    const accepted = c.offer_accepted_at !== null;
    return { candidate: c, daysToOffer, accepted };
  }).filter(c => c.daysToOffer !== null && c.daysToOffer >= 0);

  // Group into buckets
  const dataPoints: DecayDataPoint[] = CANDIDATE_DECAY_BUCKETS.map(bucket => {
    const inBucket = candidatesWithTime.filter(
      c => c.daysToOffer! >= bucket.min && c.daysToOffer! <= bucket.max
    );
    const accepted = inBucket.filter(c => c.accepted).length;
    const rate = inBucket.length > 0 ? accepted / inBucket.length : 0;

    return {
      bucket: bucket.label,
      minDays: bucket.min,
      maxDays: bucket.max === Infinity ? 999 : bucket.max,
      count: inBucket.length,
      rate,
      cumulativeRate: 0 // Will calculate below
    };
  });

  // Calculate cumulative rates
  let cumulativeAccepted = 0;
  let cumulativeTotal = 0;
  dataPoints.forEach(dp => {
    cumulativeAccepted += dp.count * dp.rate;
    cumulativeTotal += dp.count;
    dp.cumulativeRate = cumulativeTotal > 0 ? cumulativeAccepted / cumulativeTotal : 0;
  });

  // Calculate overall stats
  const totalOffers = candidatesWithTime.length;
  const totalAccepted = candidatesWithTime.filter(c => c.accepted).length;
  const overallAcceptanceRate = totalOffers > 0 ? totalAccepted / totalOffers : 0;

  // Calculate median days to decision
  const acceptedDays = candidatesWithTime
    .filter(c => c.accepted)
    .map(c => c.daysToOffer!)
    .sort((a, b) => a - b);
  const medianDaysToDecision = acceptedDays.length > 0
    ? acceptedDays[Math.floor(acceptedDays.length / 2)]
    : null;

  // Calculate decay rate (simplified: compare first bucket to last bucket with data)
  const bucketsWithData = dataPoints.filter(dp => dp.count >= 3);
  let decayRatePerDay: number | null = null;
  let decayStartDay: number | null = null;

  if (bucketsWithData.length >= 2) {
    const first = bucketsWithData[0];
    const last = bucketsWithData[bucketsWithData.length - 1];
    const daySpan = last.minDays - first.minDays;
    const rateDrop = first.rate - last.rate;

    if (daySpan > 0 && rateDrop > 0) {
      decayRatePerDay = rateDrop / daySpan;
      // Find where decay becomes significant (>5% drop from peak)
      const peakRate = Math.max(...bucketsWithData.map(b => b.rate));
      const decayBucket = bucketsWithData.find(b => b.rate < peakRate * 0.95);
      decayStartDay = decayBucket ? decayBucket.minDays : null;
    }
  }

  return {
    dataPoints,
    medianDaysToDecision,
    overallAcceptanceRate,
    totalOffers,
    totalAccepted,
    decayRatePerDay,
    decayStartDay
  };
}

/**
 * Calculate requisition decay analysis
 * Shows how fill probability declines with days open
 */
function calculateReqDecay(
  requisitions: Requisition[],
  filters: MetricFilters
): ReqDecayAnalysis {
  const filteredReqs = filterRequisitions(requisitions, filters);

  // Only look at reqs that have been open long enough or are closed
  // Exclude reqs that are too new to judge or missing opened_at
  const analyzableReqs = filteredReqs.filter(r => {
    if (!r.opened_at) return false; // STRICT: skip reqs without opened_at
    if (r.status === RequisitionStatus.Closed) return true;
    if (r.status === RequisitionStatus.Canceled) return false; // Don't count canceled
    // For open reqs, only include if they're old enough
    const daysOpen = differenceInDays(new Date(), r.opened_at);
    return daysOpen >= 30; // At least 30 days old
  });

  // Calculate days open and fill status for each req
  const reqsWithTime = analyzableReqs.map(r => {
    const endDate = r.closed_at || new Date();
    const daysOpen = differenceInDays(endDate, r.opened_at!); // opened_at guaranteed by filter above
    const filled = r.status === RequisitionStatus.Closed && r.closed_at !== null;
    return { req: r, daysOpen, filled };
  });

  // Group into buckets
  const dataPoints: DecayDataPoint[] = REQ_DECAY_BUCKETS.map(bucket => {
    const inBucket = reqsWithTime.filter(
      r => r.daysOpen >= bucket.min && r.daysOpen <= bucket.max
    );
    const filled = inBucket.filter(r => r.filled).length;
    const rate = inBucket.length > 0 ? filled / inBucket.length : 0;

    return {
      bucket: bucket.label,
      minDays: bucket.min,
      maxDays: bucket.max === Infinity ? 999 : bucket.max,
      count: inBucket.length,
      rate,
      cumulativeRate: 0
    };
  });

  // Calculate cumulative rates (for reqs, this is fill rate up to that duration)
  let cumulativeFilled = 0;
  let cumulativeTotal = 0;
  dataPoints.forEach(dp => {
    cumulativeFilled += dp.count * dp.rate;
    cumulativeTotal += dp.count;
    dp.cumulativeRate = cumulativeTotal > 0 ? cumulativeFilled / cumulativeTotal : 0;
  });

  // Calculate overall stats
  const totalReqs = reqsWithTime.length;
  const totalFilled = reqsWithTime.filter(r => r.filled).length;
  const overallFillRate = totalReqs > 0 ? totalFilled / totalReqs : 0;

  // Calculate median days to fill
  const filledDays = reqsWithTime
    .filter(r => r.filled)
    .map(r => r.daysOpen)
    .sort((a, b) => a - b);
  const medianDaysToFill = filledDays.length > 0
    ? filledDays[Math.floor(filledDays.length / 2)]
    : null;

  // Calculate decay rate
  const bucketsWithData = dataPoints.filter(dp => dp.count >= 3);
  let decayRatePerDay: number | null = null;
  let decayStartDay: number | null = null;

  if (bucketsWithData.length >= 2) {
    const first = bucketsWithData[0];
    const last = bucketsWithData[bucketsWithData.length - 1];
    const daySpan = last.minDays - first.minDays;
    const rateDrop = first.rate - last.rate;

    if (daySpan > 0 && rateDrop > 0) {
      decayRatePerDay = rateDrop / daySpan;
      const peakRate = Math.max(...bucketsWithData.map(b => b.rate));
      const decayBucket = bucketsWithData.find(b => b.rate < peakRate * 0.90);
      decayStartDay = decayBucket ? decayBucket.minDays : null;
    }
  }

  return {
    dataPoints,
    medianDaysToFill,
    overallFillRate,
    totalReqs,
    totalFilled,
    decayRatePerDay,
    decayStartDay
  };
}

/**
 * Calculate cohort comparison between fast and slow hires
 * Identifies what factors differentiate successful fast hires from slow ones
 */
function calculateCohortComparison(
  candidates: Candidate[],
  requisitions: Requisition[],
  events: Event[],
  filters: MetricFilters
): CohortComparison | null {
  const filteredReqs = filterRequisitions(requisitions, filters);
  const filteredReqIds = new Set(filteredReqs.map(r => r.req_id));

  // Get only filled reqs (successful hires)
  const filledReqs = filteredReqs.filter(r =>
    r.status === RequisitionStatus.Closed && r.closed_at !== null && r.opened_at !== null
  );

  if (filledReqs.length < 6) {
    // Need at least 6 hires to split into meaningful cohorts
    return null;
  }

  // Calculate time-to-fill for each req
  const reqsWithTTF = filledReqs.map(r => {
    const ttf = differenceInDays(r.closed_at!, r.opened_at!); // Both guaranteed by filter above
    return { req: r, ttf };
  }).sort((a, b) => a.ttf - b.ttf);

  // Split into quartiles - fast (bottom 25%) and slow (top 25%)
  const quartileSize = Math.max(Math.floor(reqsWithTTF.length / 4), 1);
  const fastReqs = reqsWithTTF.slice(0, quartileSize);
  const slowReqs = reqsWithTTF.slice(-quartileSize);
  const allReqs = reqsWithTTF;

  // Helper to calculate cohort stats
  function calculateCohortStats(reqs: { req: Requisition; ttf: number }[]): HireCohortStats {
    const reqIds = new Set(reqs.map(r => r.req.req_id));
    const hmIds = new Set(reqs.map(r => r.req.hiring_manager_id));

    // Get candidates for these reqs
    const cohortCandidates = candidates.filter(c => reqIds.has(c.req_id));
    const hiredCandidates = cohortCandidates.filter(c => c.disposition === CandidateDisposition.Hired);

    // Calculate referral percentage
    const referralCount = hiredCandidates.filter(c =>
      c.source === 'Referral' || c.source === 'referral'
    ).length;
    const referralPercent = hiredCandidates.length > 0
      ? (referralCount / hiredCandidates.length) * 100
      : 0;

    // Calculate average pipeline depth (candidates per req)
    const avgPipelineDepth = reqs.length > 0
      ? cohortCandidates.length / reqs.length
      : 0;

    // Calculate HM latency from events
    // Look for feedback events and calculate time from interview to feedback
    const feedbackEvents = events.filter(e =>
      reqIds.has(e.req_id) &&
      (e.event_type === EventType.FEEDBACK_SUBMITTED)
    );

    const interviewEvents = events.filter(e =>
      reqIds.has(e.req_id) &&
      (e.event_type === EventType.INTERVIEW_COMPLETED)
    );

    // Calculate average HM latency (simplified: time between interview and feedback)
    let avgHMLatency = 0;
    if (interviewEvents.length > 0 && feedbackEvents.length > 0) {
      // Group by candidate and find pairs
      const candidateFeedbackTimes: number[] = [];
      const interviewByCandidate = new Map<string, Date>();

      interviewEvents.forEach(e => {
        const existing = interviewByCandidate.get(e.candidate_id);
        if (!existing || e.event_at > existing) {
          interviewByCandidate.set(e.candidate_id, e.event_at);
        }
      });

      feedbackEvents.forEach(e => {
        const interviewDate = interviewByCandidate.get(e.candidate_id);
        if (interviewDate && e.event_at > interviewDate) {
          const latencyHours = (e.event_at.getTime() - interviewDate.getTime()) / (1000 * 60 * 60);
          if (latencyHours > 0 && latencyHours < 720) { // Cap at 30 days
            candidateFeedbackTimes.push(latencyHours);
          }
        }
      });

      if (candidateFeedbackTimes.length > 0) {
        avgHMLatency = candidateFeedbackTimes.reduce((a, b) => a + b, 0) / candidateFeedbackTimes.length;
      }
    }

    // Calculate interviews per hire
    const interviewCount = interviewEvents.filter(e => reqIds.has(e.req_id)).length;
    const avgInterviewsPerHire = hiredCandidates.length > 0
      ? interviewCount / hiredCandidates.length
      : 0;

    // Calculate submittals per hire (candidates that reached HM_SCREEN or beyond)
    const hmScreenEvents = events.filter(e =>
      reqIds.has(e.req_id) &&
      e.event_type === EventType.STAGE_CHANGE &&
      (e.to_stage?.toLowerCase().includes('hm') || e.to_stage?.toLowerCase().includes('hiring manager'))
    );
    const uniqueSubmittals = new Set(hmScreenEvents.map(e => e.candidate_id)).size;
    const avgSubmittalsPerHire = hiredCandidates.length > 0
      ? uniqueSubmittals / hiredCandidates.length
      : 0;

    // Calculate TTF stats
    const ttfValues = reqs.map(r => r.ttf);
    const avgTimeToFill = ttfValues.length > 0
      ? ttfValues.reduce((a, b) => a + b, 0) / ttfValues.length
      : 0;
    const sortedTTF = [...ttfValues].sort((a, b) => a - b);
    const medianTimeToFill = sortedTTF.length > 0
      ? sortedTTF[Math.floor(sortedTTF.length / 2)]
      : 0;

    return {
      count: reqs.length,
      avgTimeToFill,
      medianTimeToFill,
      avgHMLatency,
      referralPercent,
      avgPipelineDepth,
      avgInterviewsPerHire,
      avgSubmittalsPerHire
    };
  }

  const fastStats = calculateCohortStats(fastReqs);
  const slowStats = calculateCohortStats(slowReqs);
  const allStats = calculateCohortStats(allReqs);

  // Build factor comparisons
  const factors: SuccessFactorComparison[] = [];

  // HM Latency (lower is better)
  if (fastStats.avgHMLatency > 0 || slowStats.avgHMLatency > 0) {
    const delta = slowStats.avgHMLatency - fastStats.avgHMLatency;
    factors.push({
      factor: 'HM Feedback Latency',
      fastHiresValue: Math.round(fastStats.avgHMLatency),
      slowHiresValue: Math.round(slowStats.avgHMLatency),
      delta: delta > 0 ? `+${Math.round(delta)}` : Math.round(delta),
      unit: 'hrs',
      impactLevel: Math.abs(delta) > 24 ? 'high' : Math.abs(delta) > 8 ? 'medium' : 'low'
    });
  }

  // Referral percentage (higher is better)
  const referralDelta = fastStats.referralPercent - slowStats.referralPercent;
  factors.push({
    factor: 'Referral Source %',
    fastHiresValue: Math.round(fastStats.referralPercent),
    slowHiresValue: Math.round(slowStats.referralPercent),
    delta: referralDelta > 0 ? `+${Math.round(referralDelta)}` : Math.round(referralDelta),
    unit: '%',
    impactLevel: Math.abs(referralDelta) > 20 ? 'high' : Math.abs(referralDelta) > 10 ? 'medium' : 'low'
  });

  // Pipeline depth (more candidates = more options, usually better)
  const pipelineDelta = fastStats.avgPipelineDepth - slowStats.avgPipelineDepth;
  factors.push({
    factor: 'Pipeline Depth',
    fastHiresValue: fastStats.avgPipelineDepth.toFixed(1),
    slowHiresValue: slowStats.avgPipelineDepth.toFixed(1),
    delta: pipelineDelta > 0 ? `+${pipelineDelta.toFixed(1)}` : pipelineDelta.toFixed(1),
    unit: 'candidates/req',
    impactLevel: Math.abs(pipelineDelta) > 5 ? 'high' : Math.abs(pipelineDelta) > 2 ? 'medium' : 'low'
  });

  // Interviews per hire (fewer is more efficient)
  if (fastStats.avgInterviewsPerHire > 0 || slowStats.avgInterviewsPerHire > 0) {
    const interviewDelta = slowStats.avgInterviewsPerHire - fastStats.avgInterviewsPerHire;
    factors.push({
      factor: 'Interviews per Hire',
      fastHiresValue: fastStats.avgInterviewsPerHire.toFixed(1),
      slowHiresValue: slowStats.avgInterviewsPerHire.toFixed(1),
      delta: interviewDelta > 0 ? `+${interviewDelta.toFixed(1)}` : interviewDelta.toFixed(1),
      unit: 'interviews',
      impactLevel: Math.abs(interviewDelta) > 3 ? 'high' : Math.abs(interviewDelta) > 1.5 ? 'medium' : 'low'
    });
  }

  // Submittals per hire (fewer is better calibration)
  if (fastStats.avgSubmittalsPerHire > 0 || slowStats.avgSubmittalsPerHire > 0) {
    const submittalDelta = slowStats.avgSubmittalsPerHire - fastStats.avgSubmittalsPerHire;
    factors.push({
      factor: 'Submittals per Hire',
      fastHiresValue: fastStats.avgSubmittalsPerHire.toFixed(1),
      slowHiresValue: slowStats.avgSubmittalsPerHire.toFixed(1),
      delta: submittalDelta > 0 ? `+${submittalDelta.toFixed(1)}` : submittalDelta.toFixed(1),
      unit: 'submittals',
      impactLevel: Math.abs(submittalDelta) > 3 ? 'high' : Math.abs(submittalDelta) > 1.5 ? 'medium' : 'low'
    });
  }

  // Time to fill comparison
  const ttfDelta = slowStats.avgTimeToFill - fastStats.avgTimeToFill;
  factors.push({
    factor: 'Avg Time to Fill',
    fastHiresValue: Math.round(fastStats.avgTimeToFill),
    slowHiresValue: Math.round(slowStats.avgTimeToFill),
    delta: `+${Math.round(ttfDelta)}`,
    unit: 'days',
    impactLevel: 'high' // This is the outcome metric
  });

  // Sort factors by impact level
  const impactOrder = { high: 0, medium: 1, low: 2 };
  factors.sort((a, b) => impactOrder[a.impactLevel] - impactOrder[b.impactLevel]);

  return {
    fastHires: fastStats,
    slowHires: slowStats,
    allHires: allStats,
    factors
  };
}

/**
 * Generate insights from decay analysis and cohort comparison
 */
function generateInsights(
  candidateDecay: CandidateDecayAnalysis,
  reqDecay: ReqDecayAnalysis,
  cohortComparison: CohortComparison | null
): VelocityInsight[] {
  const insights: VelocityInsight[] = [];

  // Candidate decay insights
  if (candidateDecay.decayRatePerDay && candidateDecay.decayStartDay) {
    const dailyDropPercent = (candidateDecay.decayRatePerDay * 100).toFixed(1);
    insights.push({
      type: 'warning',
      title: 'Candidate Interest Decays Over Time',
      description: `Offer acceptance rate drops ~${dailyDropPercent}% per day after day ${candidateDecay.decayStartDay}. Speed matters.`,
      metric: `${dailyDropPercent}%/day decay`,
      action: 'Prioritize candidates who have been in process longest'
    });
  }

  if (candidateDecay.medianDaysToDecision) {
    const fastBucket = candidateDecay.dataPoints.find(dp => dp.minDays === 0);
    if (fastBucket && fastBucket.rate > candidateDecay.overallAcceptanceRate * 1.2) {
      insights.push({
        type: 'success',
        title: 'Fast Processes Win',
        description: `Candidates who receive offers within 14 days accept at ${Math.round(fastBucket.rate * 100)}% vs ${Math.round(candidateDecay.overallAcceptanceRate * 100)}% overall.`,
        metric: `+${Math.round((fastBucket.rate - candidateDecay.overallAcceptanceRate) * 100)}% acceptance`,
        action: 'Target 14-day offer timeline'
      });
    }
  }

  // Req decay insights
  if (reqDecay.decayRatePerDay && reqDecay.decayStartDay) {
    const dailyDropPercent = (reqDecay.decayRatePerDay * 100).toFixed(1);
    insights.push({
      type: 'warning',
      title: 'Req Fill Probability Declines',
      description: `After day ${reqDecay.decayStartDay}, fill probability drops ~${dailyDropPercent}% per day. Stale reqs are harder to close.`,
      metric: `${dailyDropPercent}%/day decay`,
      action: 'Reassess strategy on reqs open >60 days'
    });
  }

  // Compare fast vs slow buckets for reqs
  const fastReqBucket = reqDecay.dataPoints.find(dp => dp.minDays === 0);
  const slowReqBucket = reqDecay.dataPoints.find(dp => dp.minDays === 91);
  if (fastReqBucket && slowReqBucket && fastReqBucket.count >= 3 && slowReqBucket.count >= 3) {
    if (fastReqBucket.rate > slowReqBucket.rate * 1.5) {
      insights.push({
        type: 'info',
        title: 'First 30 Days Are Critical',
        description: `Reqs filled within 30 days have ${Math.round(fastReqBucket.rate * 100)}% success vs ${Math.round(slowReqBucket.rate * 100)}% for 90+ day reqs.`,
        metric: `${Math.round(fastReqBucket.rate * 100)}% vs ${Math.round(slowReqBucket.rate * 100)}%`
      });
    }
  }

  // Cohort comparison insights
  if (cohortComparison) {
    const { fastHires, slowHires, factors } = cohortComparison;
    const ttfDiff = slowHires.avgTimeToFill - fastHires.avgTimeToFill;

    // Overall speed difference
    insights.push({
      type: 'info',
      title: 'Speed Gap Between Cohorts',
      description: `Your fastest 25% of hires close in ${Math.round(fastHires.avgTimeToFill)} days vs ${Math.round(slowHires.avgTimeToFill)} days for the slowest 25% — a ${Math.round(ttfDiff)} day difference.`,
      metric: `${Math.round(ttfDiff)} day gap`
    });

    // Find the most impactful differentiating factor
    const highImpactFactors = factors.filter(f => f.impactLevel === 'high' && f.factor !== 'Avg Time to Fill');
    if (highImpactFactors.length > 0) {
      const topFactor = highImpactFactors[0];
      insights.push({
        type: 'success',
        title: `Key Differentiator: ${topFactor.factor}`,
        description: `Fast hires: ${topFactor.fastHiresValue} ${topFactor.unit} vs slow hires: ${topFactor.slowHiresValue} ${topFactor.unit}. This factor shows a ${topFactor.delta} ${topFactor.unit} difference.`,
        metric: `${topFactor.delta} ${topFactor.unit}`,
        action: topFactor.factor.includes('Referral') ? 'Increase referral pipeline' :
          topFactor.factor.includes('HM') ? 'Coach HMs on faster feedback' :
            topFactor.factor.includes('Interview') ? 'Streamline interview process' :
              'Focus on this metric'
      });
    }

    // Referral insight if significant
    const referralDiff = fastHires.referralPercent - slowHires.referralPercent;
    if (referralDiff > 15) {
      insights.push({
        type: 'success',
        title: 'Referrals Drive Speed',
        description: `Fast hires have ${Math.round(fastHires.referralPercent)}% referrals vs ${Math.round(slowHires.referralPercent)}% for slow hires. Referral candidates close faster.`,
        metric: `+${Math.round(referralDiff)}% referrals`,
        action: 'Push for referrals on stalled reqs'
      });
    }
  }

  // Sample size warning
  if (candidateDecay.totalOffers < 20) {
    insights.push({
      type: 'info',
      title: 'Limited Data',
      description: `Analysis based on ${candidateDecay.totalOffers} offers. Trends may not be statistically significant.`,
    });
  }

  return insights;
}

/**
 * Main function to calculate all velocity metrics
 */
export function calculateVelocityMetrics(
  candidates: Candidate[],
  requisitions: Requisition[],
  events: Event[],
  users: User[],
  filters: MetricFilters
): VelocityMetrics {
  const candidateDecay = calculateCandidateDecay(candidates, requisitions, filters);
  const reqDecay = calculateReqDecay(requisitions, filters);
  const cohortComparison = calculateCohortComparison(candidates, requisitions, events, filters);
  const insights = generateInsights(candidateDecay, reqDecay, cohortComparison);

  return {
    candidateDecay,
    reqDecay,
    cohortComparison,
    insights
  };
}
