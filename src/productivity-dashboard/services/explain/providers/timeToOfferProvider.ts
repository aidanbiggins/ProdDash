// Time to Offer Explain Provider
// Calculates median time from application to offer with breakdown

import { ExplainProvider, ExplainContext } from '../types';
import { Explanation, BlockedReason, BreakdownRow, ContributingRecord, RecommendedAction } from '../../../types/explainTypes';
import { Candidate } from '../../../types/entities';
import { isWithinInterval } from 'date-fns';

interface CandidateBreakdown {
  candidateId: string;
  candidateName: string | null;
  reqId: string;
  reqTitle: string;
  totalDays: number;
  appliedToFirstInterviewDays: number | null;
  firstInterviewToOfferDays: number | null;
}

/**
 * Time to Offer Explain Provider
 *
 * Calculates the median time from application to offer extension,
 * with optional breakdown into phases if interview date is available.
 */
export class TimeToOfferProvider implements ExplainProvider {
  id = 'time_to_offer' as const;

  canExplain(context: ExplainContext): BlockedReason[] {
    const reasons: BlockedReason[] = [];

    // Find candidates with offers in date range
    const candidatesWithOffers = this.getCandidatesWithOffers(context);

    if (candidatesWithOffers.length === 0) {
      reasons.push({
        code: 'NO_OFFERS_IN_RANGE',
        message: 'No offers extended in the selected date range',
      });
      return reasons;
    }

    // Check if any have valid start dates
    const withStartDates = candidatesWithOffers.filter(
      c => c.applied_at || c.first_contacted_at
    );

    if (withStartDates.length === 0) {
      reasons.push({
        code: 'MISSING_APPLICATION_DATE',
        message: 'No candidates have application or first contact dates',
        sampleCount: candidatesWithOffers.length,
      });
    }

    return reasons;
  }

  explain(context: ExplainContext): Explanation {
    const { filters, requisitions, users } = context;
    const candidatesWithOffers = this.getCandidatesWithOffers(context);

    // Build lookup maps
    const reqMap = new Map(requisitions.map(r => [r.req_id, r]));
    const userMap = new Map(users.map(u => [u.user_id, u.name]));

    // Calculate breakdowns for each candidate
    const breakdowns: CandidateBreakdown[] = [];
    const exclusionCounts: Record<string, number> = {};

    for (const candidate of candidatesWithOffers) {
      const startDate = candidate.applied_at || candidate.first_contacted_at;
      const offerDate = candidate.offer_extended_at;

      if (!startDate) {
        exclusionCounts['Missing application date'] = (exclusionCounts['Missing application date'] || 0) + 1;
        continue;
      }

      if (!offerDate) {
        // Should not happen since we filtered, but be safe
        exclusionCounts['Missing offer date'] = (exclusionCounts['Missing offer date'] || 0) + 1;
        continue;
      }

      const totalDays = Math.floor(
        (offerDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (totalDays < 0) {
        exclusionCounts['Negative duration (data error)'] = (exclusionCounts['Negative duration (data error)'] || 0) + 1;
        continue;
      }

      // Calculate phase breakdown if interview date available
      let appliedToFirstInterviewDays: number | null = null;
      let firstInterviewToOfferDays: number | null = null;

      if (candidate.first_contacted_at && candidate.applied_at) {
        appliedToFirstInterviewDays = Math.floor(
          (candidate.first_contacted_at.getTime() - candidate.applied_at.getTime()) / (1000 * 60 * 60 * 24)
        );
        firstInterviewToOfferDays = Math.floor(
          (offerDate.getTime() - candidate.first_contacted_at.getTime()) / (1000 * 60 * 60 * 24)
        );
      }

      const req = reqMap.get(candidate.req_id);
      breakdowns.push({
        candidateId: candidate.candidate_id,
        candidateName: candidate.name,
        reqId: candidate.req_id,
        reqTitle: req?.req_title || 'Unknown Req',
        totalDays,
        appliedToFirstInterviewDays,
        firstInterviewToOfferDays,
      });
    }

    // Calculate medians
    const excludedCount = candidatesWithOffers.length - breakdowns.length;

    if (breakdowns.length === 0) {
      return this.createBlockedExplanation(
        context,
        [{ code: 'ALL_EXCLUDED', message: 'All offers were excluded due to data issues' }]
      );
    }

    const sortedTotals = breakdowns.map(b => b.totalDays).sort((a, b) => a - b);
    const medianTotal = this.median(sortedTotals);

    // Phase medians (only from candidates with both dates)
    const withPhases = breakdowns.filter(
      b => b.appliedToFirstInterviewDays !== null && b.firstInterviewToOfferDays !== null
    );

    let medianPhase1: number | null = null;
    let medianPhase2: number | null = null;
    let mathInvariantValid = true;

    if (withPhases.length > 0) {
      const sortedPhase1 = withPhases
        .map(b => b.appliedToFirstInterviewDays!)
        .sort((a, b) => a - b);
      const sortedPhase2 = withPhases
        .map(b => b.firstInterviewToOfferDays!)
        .sort((a, b) => a - b);

      medianPhase1 = this.median(sortedPhase1);
      medianPhase2 = this.median(sortedPhase2);

      // Math invariant check: phase sum vs total
      // Note: Medians don't add up (median(A) + median(B) ≠ median(A+B))
      // We flag any difference so the UI can show an explanatory note
      if (medianPhase1 !== null && medianPhase2 !== null && medianTotal !== null) {
        const phaseSum = medianPhase1 + medianPhase2;
        mathInvariantValid = phaseSum === medianTotal;
      }
    }

    // Top 5 contributors (longest time to offer)
    const topContributors: ContributingRecord[] = [...breakdowns]
      .sort((a, b) => b.totalDays - a.totalDays)
      .slice(0, 5)
      .map(b => ({
        id: b.candidateId,
        label: b.reqTitle,
        value: b.totalDays,
        included: true,
      }));

    // Build exclusion reasons array
    const exclusionReasons = Object.entries(exclusionCounts).map(([reason, count]) => ({
      reason,
      count,
    }));

    // Build breakdown rows
    const breakdown: BreakdownRow[] = [];
    if (medianPhase1 !== null) {
      breakdown.push({
        label: 'Application to First Interview',
        value: medianPhase1,
        unit: 'days',
      });
    }
    if (medianPhase2 !== null) {
      breakdown.push({
        label: 'First Interview to Offer',
        value: medianPhase2,
        unit: 'days',
      });
    }

    // Determine confidence grade
    let confidenceGrade: 'high' | 'medium' | 'low' = 'high';
    let confidenceNote = `Based on ${breakdowns.length} offers`;

    if (breakdowns.length < 3) {
      confidenceGrade = 'low';
      confidenceNote = `Only ${breakdowns.length} offer(s) - low sample size`;
    } else if (breakdowns.length < 10) {
      confidenceGrade = 'medium';
      confidenceNote = `Based on ${breakdowns.length} offers - moderate sample size`;
    }

    if (withPhases.length < breakdowns.length) {
      const missing = breakdowns.length - withPhases.length;
      confidenceNote += `. ${missing} candidate(s) missing interview dates for breakdown.`;
    }

    // Generate recommended actions based on data
    const recommendedActions: RecommendedAction[] = [];
    const TARGET_DAYS = 45;

    if (medianTotal !== null && medianTotal > TARGET_DAYS) {
      recommendedActions.push({
        action: 'Review reqs with longest time to offer',
        priority: medianTotal > TARGET_DAYS * 1.5 ? 'high' : 'medium',
        reason: `Median ${medianTotal}d exceeds ${TARGET_DAYS}d target`,
      });
    }

    if (medianPhase1 !== null && medianPhase1 > 14) {
      recommendedActions.push({
        action: 'Speed up initial candidate engagement',
        priority: medianPhase1 > 21 ? 'high' : 'medium',
        reason: `${medianPhase1}d from application to first interview`,
      });
    }

    if (medianPhase2 !== null && medianPhase2 > 21) {
      recommendedActions.push({
        action: 'Streamline interview to offer process',
        priority: medianPhase2 > 30 ? 'high' : 'medium',
        reason: `${medianPhase2}d from first interview to offer`,
      });
    }

    // Cap at 3 actions
    const finalActions = recommendedActions.slice(0, 3);

    return {
      metricId: this.id,
      metricLabel: 'Time to Offer',
      status: confidenceGrade === 'low' ? 'partial' : 'ready',
      value: medianTotal,
      unit: 'days',
      formula: 'median(offer_extended_at - applied_at) for all offers in date range',
      formulaCode: 'median(offer_extended_at - (applied_at || first_contacted_at))',
      dateRange: {
        start: filters.dateRange.startDate,
        end: filters.dateRange.endDate,
      },
      includedCount: breakdowns.length,
      excludedCount,
      exclusionReasons,
      breakdown: breakdown.length > 0 ? breakdown : undefined,
      confidenceGrade,
      confidenceNote,
      topContributors,
      mathInvariantValid,
      recommendedActions: finalActions.length > 0 ? finalActions : undefined,
      computedAt: new Date(),
    };
  }

  private getCandidatesWithOffers(context: ExplainContext): Candidate[] {
    const { candidates, requisitions, filters } = context;

    // Build set of req IDs that match filters
    const matchingReqIds = new Set(
      requisitions
        .filter(r => this.matchesFilters(r, filters))
        .map(r => r.req_id)
    );

    // Filter to candidates with offers in date range
    return candidates.filter(c => {
      if (!matchingReqIds.has(c.req_id)) return false;
      if (!c.offer_extended_at) return false;

      return isWithinInterval(c.offer_extended_at, {
        start: filters.dateRange.startDate,
        end: filters.dateRange.endDate,
      });
    });
  }

  private matchesFilters(req: { recruiter_id: string; function: string; job_family: string; level: string; location_region: string; location_type: string; hiring_manager_id: string }, filters: ExplainContext['filters']): boolean {
    if (filters.recruiterIds?.length && !filters.recruiterIds.includes(req.recruiter_id)) {
      return false;
    }
    if (filters.functions?.length && !filters.functions.includes(req.function)) {
      return false;
    }
    if (filters.jobFamilies?.length && !filters.jobFamilies.includes(req.job_family)) {
      return false;
    }
    if (filters.levels?.length && !filters.levels.includes(req.level)) {
      return false;
    }
    if (filters.regions?.length && !filters.regions.includes(req.location_region)) {
      return false;
    }
    if (filters.locationTypes?.length && !filters.locationTypes.includes(req.location_type)) {
      return false;
    }
    if (filters.hiringManagerIds?.length && !filters.hiringManagerIds.includes(req.hiring_manager_id)) {
      return false;
    }
    return true;
  }

  private median(sortedValues: number[]): number | null {
    if (sortedValues.length === 0) return null;
    const mid = Math.floor(sortedValues.length / 2);
    return sortedValues.length % 2
      ? sortedValues[mid]
      : (sortedValues[mid - 1] + sortedValues[mid]) / 2;
  }

  private createBlockedExplanation(
    context: ExplainContext,
    blockedReasons: BlockedReason[]
  ): Explanation {
    return {
      metricId: this.id,
      metricLabel: 'Time to Offer',
      status: 'blocked',
      value: null,
      unit: 'days',
      formula: '',
      dateRange: {
        start: context.filters.dateRange.startDate,
        end: context.filters.dateRange.endDate,
      },
      includedCount: 0,
      excludedCount: 0,
      exclusionReasons: [],
      blockedReasons,
      computedAt: new Date(),
    };
  }
}
