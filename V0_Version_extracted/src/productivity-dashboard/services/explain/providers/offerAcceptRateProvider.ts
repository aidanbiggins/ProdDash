// Offer Accept Rate Explain Provider
// Shows accept rate with breakdowns by source, function, recruiter

import { ExplainProvider, ExplainContext } from '../types';
import { Explanation, BlockedReason, BreakdownRow, ContributingRecord, RecommendedAction } from '../../../types/explainTypes';
import { Candidate, CandidateDisposition } from '../../../types/entities';
import { isWithinInterval } from 'date-fns';

interface OfferOutcome {
  candidateId: string;
  reqId: string;
  reqTitle: string;
  source: string;
  function: string;
  recruiterId: string;
  recruiterName: string;
  accepted: boolean;
  offerDate: Date;
}

/**
 * Offer Accept Rate Explain Provider
 *
 * Shows offer acceptance rate with breakdowns by:
 * - Source (Referral, LinkedIn, etc.)
 * - Function (Engineering, Sales, etc.)
 * - Recruiter
 */
export class OfferAcceptRateProvider implements ExplainProvider {
  id = 'offer_accept_rate' as const;

  canExplain(context: ExplainContext): BlockedReason[] {
    const reasons: BlockedReason[] = [];

    const offersInRange = this.getOffersInRange(context);

    if (offersInRange.length === 0) {
      reasons.push({
        code: 'NO_OFFERS_IN_RANGE',
        message: 'No offers extended in the selected date range',
      });
    }

    return reasons;
  }

  explain(context: ExplainContext): Explanation {
    const { filters } = context;
    const offers = this.getOffersInRange(context);

    if (offers.length === 0) {
      return this.createBlockedExplanation(context, [
        { code: 'NO_OFFERS_IN_RANGE', message: 'No offers in date range' }
      ]);
    }

    // Calculate overall accept rate
    const accepted = offers.filter(o => o.accepted).length;
    const acceptRate = Math.round((accepted / offers.length) * 100);

    // Breakdown by source
    const bySource = this.groupBy(offers, 'source');
    const sourceBreakdown = Object.entries(bySource)
      .map(([source, sourceOffers]) => {
        const sourceAccepted = sourceOffers.filter(o => o.accepted).length;
        return {
          source,
          total: sourceOffers.length,
          accepted: sourceAccepted,
          rate: Math.round((sourceAccepted / sourceOffers.length) * 100),
        };
      })
      .sort((a, b) => b.total - a.total);

    // Breakdown by function
    const byFunction = this.groupBy(offers, 'function');
    const functionBreakdown = Object.entries(byFunction)
      .map(([func, funcOffers]) => {
        const funcAccepted = funcOffers.filter(o => o.accepted).length;
        return {
          function: func,
          total: funcOffers.length,
          accepted: funcAccepted,
          rate: Math.round((funcAccepted / funcOffers.length) * 100),
        };
      })
      .sort((a, b) => b.total - a.total);

    // Breakdown by recruiter
    const byRecruiter = this.groupBy(offers, 'recruiterName');
    const recruiterBreakdown = Object.entries(byRecruiter)
      .map(([recruiter, recOffers]) => {
        const recAccepted = recOffers.filter(o => o.accepted).length;
        return {
          recruiter,
          total: recOffers.length,
          accepted: recAccepted,
          rate: Math.round((recAccepted / recOffers.length) * 100),
        };
      })
      .sort((a, b) => b.total - a.total);

    // Build breakdown rows (top 3 from each category)
    const breakdown: BreakdownRow[] = [];

    // Add source breakdown
    if (sourceBreakdown.length > 0) {
      breakdown.push({
        label: `By Source (${sourceBreakdown.length} sources)`,
        value: null,
        unit: '',
      });
      sourceBreakdown.slice(0, 3).forEach(s => {
        breakdown.push({
          label: `  ${s.source}`,
          value: s.rate,
          unit: `% (${s.accepted}/${s.total})`,
        });
      });
    }

    // Add function breakdown
    if (functionBreakdown.length > 0) {
      breakdown.push({
        label: `By Function (${functionBreakdown.length} functions)`,
        value: null,
        unit: '',
      });
      functionBreakdown.slice(0, 3).forEach(f => {
        breakdown.push({
          label: `  ${f.function}`,
          value: f.rate,
          unit: `% (${f.accepted}/${f.total})`,
        });
      });
    }

    // Top contributors: offers with lowest accept rates (problem areas)
    const topContributors: ContributingRecord[] = recruiterBreakdown
      .filter(r => r.total >= 2) // At least 2 offers to be meaningful
      .sort((a, b) => a.rate - b.rate) // Lowest rate first
      .slice(0, 5)
      .map(r => ({
        id: r.recruiter,
        label: r.recruiter,
        value: r.rate,
        included: true,
        excludeReason: `${r.accepted}/${r.total} accepted`,
      }));

    // Calculate pending offers
    const pending = offers.filter(o =>
      !o.accepted &&
      context.candidates.find(c =>
        c.candidate_id === o.candidateId &&
        c.disposition === CandidateDisposition.Active
      )
    ).length;

    const exclusionReasons: Array<{ reason: string; count: number }> = [];
    if (pending > 0) {
      exclusionReasons.push({
        reason: 'Offer still pending',
        count: pending,
      });
    }

    // Confidence
    let confidenceGrade: 'high' | 'medium' | 'low' = 'high';
    let confidenceNote = `Based on ${offers.length} offers`;

    if (offers.length < 5) {
      confidenceGrade = 'low';
      confidenceNote = `Only ${offers.length} offer(s) - low sample size`;
    } else if (offers.length < 15) {
      confidenceGrade = 'medium';
      confidenceNote = `Based on ${offers.length} offers - moderate sample`;
    }

    // Generate recommended actions based on data
    const recommendedActions: RecommendedAction[] = [];
    const TARGET_RATE = 80;

    if (acceptRate < TARGET_RATE) {
      recommendedActions.push({
        action: 'Review declined offers for patterns',
        priority: acceptRate < 60 ? 'high' : 'medium',
        reason: `${acceptRate}% accept rate vs ${TARGET_RATE}% target`,
      });
    }

    // Find source with notably low accept rate (at least 2 offers)
    const lowRateSources = sourceBreakdown.filter(s => s.total >= 2 && s.rate < 60);
    if (lowRateSources.length > 0) {
      const worstSource = lowRateSources[0];
      recommendedActions.push({
        action: `Investigate ${worstSource.source} offer quality`,
        priority: worstSource.rate < 40 ? 'high' : 'medium',
        reason: `${worstSource.rate}% accept rate (${worstSource.accepted}/${worstSource.total})`,
      });
    }

    if (pending > 0) {
      recommendedActions.push({
        action: 'Follow up on pending offer decisions',
        priority: pending >= 3 ? 'high' : 'low',
        reason: `${pending} offer(s) awaiting response`,
      });
    }

    // Cap at 3 actions
    const finalActions = recommendedActions.slice(0, 3);

    return {
      metricId: this.id,
      metricLabel: 'Offer Accept Rate',
      status: confidenceGrade === 'low' ? 'partial' : 'ready',
      value: acceptRate,
      unit: '%',
      formula: '(accepted offers / total offers) × 100',
      formulaCode: '(count(offer_accepted_at != null) / count(offer_extended_at != null)) * 100',
      dateRange: {
        start: filters.dateRange.startDate,
        end: filters.dateRange.endDate,
      },
      includedCount: offers.length,
      excludedCount: pending,
      exclusionReasons,
      breakdown: breakdown.length > 0 ? breakdown : undefined,
      confidenceGrade,
      confidenceNote,
      topContributors: topContributors.length > 0 ? topContributors : undefined,
      benchmark: {
        value: 80,
        label: 'Target',
      },
      recommendedActions: finalActions.length > 0 ? finalActions : undefined,
      computedAt: new Date(),
    };
  }

  private getOffersInRange(context: ExplainContext): OfferOutcome[] {
    const { candidates, requisitions, users, filters } = context;

    const reqMap = new Map(requisitions.map(r => [r.req_id, r]));
    const userMap = new Map(users.map(u => [u.user_id, u.name]));

    return candidates
      .filter(c => {
        if (!c.offer_extended_at) return false;
        return isWithinInterval(c.offer_extended_at, {
          start: filters.dateRange.startDate,
          end: filters.dateRange.endDate,
        });
      })
      .map(c => {
        const req = reqMap.get(c.req_id);
        return {
          candidateId: c.candidate_id,
          reqId: c.req_id,
          reqTitle: req?.req_title || 'Unknown',
          source: String(c.source || 'Unknown'),
          function: req?.function || 'Unknown',
          recruiterId: req?.recruiter_id || '',
          recruiterName: userMap.get(req?.recruiter_id || '') || req?.recruiter_id || 'Unknown',
          accepted: c.offer_accepted_at !== null,
          offerDate: c.offer_extended_at!,
        };
      });
  }

  private groupBy<T>(items: T[], key: keyof T): Record<string, T[]> {
    return items.reduce((acc, item) => {
      const groupKey = String(item[key] || 'Unknown');
      if (!acc[groupKey]) acc[groupKey] = [];
      acc[groupKey].push(item);
      return acc;
    }, {} as Record<string, T[]>);
  }

  private createBlockedExplanation(
    context: ExplainContext,
    blockedReasons: BlockedReason[]
  ): Explanation {
    return {
      metricId: this.id,
      metricLabel: 'Offer Accept Rate',
      status: 'blocked',
      value: null,
      unit: '%',
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
