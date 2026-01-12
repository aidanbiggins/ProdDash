// HM Latency Explain Provider
// Shows breakdown of recruiter vs HM vs ops time

import { ExplainProvider, ExplainContext } from '../types';
import { Explanation, BlockedReason, BreakdownRow, ContributingRecord, RecommendedAction } from '../../../types/explainTypes';

/**
 * HM Latency Explain Provider
 *
 * Shows time breakdown by owner:
 * - Recruiter time (lead to first action, screen to submittal)
 * - HM time (feedback latency, decision latency)
 * - Ops time (offer approval) if available
 */
export class HMLatencyProvider implements ExplainProvider {
  id = 'hm_latency' as const;

  canExplain(context: ExplainContext): BlockedReason[] {
    const reasons: BlockedReason[] = [];
    const { hmFriction } = context;

    if (!hmFriction || hmFriction.length === 0) {
      reasons.push({
        code: 'NO_HM_DATA',
        message: 'No hiring manager data available',
      });
      return reasons;
    }

    // Check if any HMs have latency data
    const withLatency = hmFriction.filter(
      hm => hm.feedbackLatencyMedian !== null || hm.decisionLatencyMedian !== null
    );

    if (withLatency.length === 0) {
      reasons.push({
        code: 'NO_FEEDBACK_EVENTS',
        message: 'No interview feedback events recorded for any hiring manager',
      });
    }

    return reasons;
  }

  explain(context: ExplainContext): Explanation {
    const { hmFriction, filters, overview } = context;

    // Get HMs with latency data
    const withLatency = hmFriction.filter(
      hm => hm.feedbackLatencyMedian !== null || hm.decisionLatencyMedian !== null
    );

    if (withLatency.length === 0) {
      return this.createBlockedExplanation(context, [
        { code: 'NO_FEEDBACK_EVENTS', message: 'No latency data available' }
      ]);
    }

    // Calculate average HM latency (in days, converting from hours)
    const feedbackLatencies = withLatency
      .map(hm => hm.feedbackLatencyMedian)
      .filter((l): l is number => l !== null);

    const decisionLatencies = withLatency
      .map(hm => hm.decisionLatencyMedian)
      .filter((l): l is number => l !== null);

    // Overall HM latency is from overview if available
    const hmLatencyDays = overview?.medianHMDecisionLatency !== null
      ? Math.round((overview?.medianHMDecisionLatency || 0) / 24)
      : null;

    // Calculate medians for breakdown
    const avgFeedbackHours = feedbackLatencies.length > 0
      ? feedbackLatencies.reduce((a, b) => a + b, 0) / feedbackLatencies.length
      : null;
    const avgDecisionHours = decisionLatencies.length > 0
      ? decisionLatencies.reduce((a, b) => a + b, 0) / decisionLatencies.length
      : null;

    // Build breakdown
    const breakdown: BreakdownRow[] = [];

    // Get time attribution from first recruiter summary if available
    const timeAttribution = overview?.recruiterSummaries?.[0]?.timeAttribution;

    // Recruiter time
    if (timeAttribution?.recruiterControlledTime) {
      const recruiterTime = timeAttribution.recruiterControlledTime;
      if (recruiterTime.leadToFirstAction !== null) {
        breakdown.push({
          label: 'Recruiter: Lead to First Action',
          value: Math.round(recruiterTime.leadToFirstAction / 24 * 10) / 10,
          unit: 'days',
        });
      }
      if (recruiterTime.screenToSubmittal !== null) {
        breakdown.push({
          label: 'Recruiter: Screen to Submittal',
          value: Math.round(recruiterTime.screenToSubmittal / 24 * 10) / 10,
          unit: 'days',
        });
      }
    }

    // HM time
    if (avgFeedbackHours !== null) {
      breakdown.push({
        label: 'HM: Feedback Latency',
        value: Math.round(avgFeedbackHours / 24 * 10) / 10,
        unit: 'days',
      });
    }
    if (avgDecisionHours !== null) {
      breakdown.push({
        label: 'HM: Decision Latency',
        value: Math.round(avgDecisionHours / 24 * 10) / 10,
        unit: 'days',
      });
    }

    // Ops time (if available)
    if (timeAttribution?.opsControlledTime?.available && timeAttribution.opsControlledTime.offerApprovalLatency !== null) {
      breakdown.push({
        label: 'Ops: Offer Approval',
        value: Math.round(timeAttribution.opsControlledTime.offerApprovalLatency / 24 * 10) / 10,
        unit: 'days',
      });
    }

    // Top HMs by latency (slowest first)
    const topContributors: ContributingRecord[] = [...withLatency]
      .filter(hm => hm.feedbackLatencyMedian !== null)
      .sort((a, b) => (b.feedbackLatencyMedian || 0) - (a.feedbackLatencyMedian || 0))
      .slice(0, 5)
      .map(hm => ({
        id: hm.hmId,
        label: hm.hmName,
        value: hm.feedbackLatencyMedian !== null
          ? Math.round(hm.feedbackLatencyMedian / 24 * 10) / 10
          : null,
        included: true,
      }));

    // Exclusion reasons
    const withoutLatency = hmFriction.filter(
      hm => hm.feedbackLatencyMedian === null && hm.decisionLatencyMedian === null
    );
    const exclusionReasons: Array<{ reason: string; count: number }> = [];
    if (withoutLatency.length > 0) {
      exclusionReasons.push({
        reason: 'No interview events recorded',
        count: withoutLatency.length,
      });
    }

    // Check what data is missing
    const missingDataNotes: string[] = [];
    if (!timeAttribution?.recruiterControlledTime?.leadToFirstAction) {
      missingDataNotes.push('recruiter lead-to-action time');
    }
    if (!timeAttribution?.opsControlledTime?.available) {
      missingDataNotes.push('ops approval time');
    }

    // Confidence
    let confidenceGrade: 'high' | 'medium' | 'low' = 'high';
    let confidenceNote = `Based on ${withLatency.length} hiring managers`;

    if (withLatency.length < 3) {
      confidenceGrade = 'low';
      confidenceNote = `Only ${withLatency.length} HM(s) with data - low sample size`;
    } else if (withLatency.length < 10) {
      confidenceGrade = 'medium';
    }

    if (missingDataNotes.length > 0) {
      confidenceNote += `. Missing: ${missingDataNotes.join(', ')}`;
    }

    // Generate recommended actions based on data
    const recommendedActions: RecommendedAction[] = [];

    // Check for slow feedback (> 2 days = 48 hours)
    if (avgFeedbackHours !== null && avgFeedbackHours > 48) {
      const slowHMs = withLatency.filter(hm => (hm.feedbackLatencyMedian || 0) > 72);
      recommendedActions.push({
        action: 'Follow up with slow HMs on pending feedback',
        priority: avgFeedbackHours > 72 ? 'high' : 'medium',
        reason: slowHMs.length > 0
          ? `${slowHMs.length} HM(s) averaging 3+ days feedback time`
          : `Avg feedback latency ${Math.round(avgFeedbackHours / 24)}d`,
      });
    }

    // Check for slow decisions (> 3 days = 72 hours)
    if (avgDecisionHours !== null && avgDecisionHours > 72) {
      recommendedActions.push({
        action: 'Escalate overdue HM decisions',
        priority: avgDecisionHours > 120 ? 'high' : 'medium',
        reason: `Avg decision latency ${Math.round(avgDecisionHours / 24)}d`,
      });
    }

    // If recruiter time is tracked and high
    if (timeAttribution?.recruiterControlledTime?.leadToFirstAction) {
      const leadToAction = timeAttribution.recruiterControlledTime.leadToFirstAction;
      if (leadToAction > 48) {
        recommendedActions.push({
          action: 'Improve recruiter response time to new leads',
          priority: leadToAction > 72 ? 'high' : 'medium',
          reason: `${Math.round(leadToAction / 24)}d avg lead to first action`,
        });
      }
    }

    // Cap at 3 actions
    const finalActions = recommendedActions.slice(0, 3);

    return {
      metricId: this.id,
      metricLabel: 'HM Latency',
      status: confidenceGrade === 'low' ? 'partial' : 'ready',
      value: hmLatencyDays !== null ? `${hmLatencyDays}d` : '--',
      unit: 'days',
      formula: 'avg(HM feedback latency + decision latency) across all hiring managers',
      formulaCode: 'avg(feedbackLatencyMedian + decisionLatencyMedian) / 24',
      dateRange: {
        start: filters.dateRange.startDate,
        end: filters.dateRange.endDate,
      },
      includedCount: withLatency.length,
      excludedCount: withoutLatency.length,
      exclusionReasons,
      breakdown: breakdown.length > 0 ? breakdown : undefined,
      confidenceGrade,
      confidenceNote,
      topContributors: topContributors.length > 0 ? topContributors : undefined,
      recommendedActions: finalActions.length > 0 ? finalActions : undefined,
      computedAt: new Date(),
    };
  }

  private createBlockedExplanation(
    context: ExplainContext,
    blockedReasons: BlockedReason[]
  ): Explanation {
    return {
      metricId: this.id,
      metricLabel: 'HM Latency',
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
