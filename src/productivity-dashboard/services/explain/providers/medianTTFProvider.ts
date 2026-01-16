// Median TTF Explain Provider
// Shows time to fill with applied_to_first_touch breakdown

import { ExplainProvider, ExplainContext } from '../types';
import { Explanation, BlockedReason, BreakdownRow, ContributingRecord, RecommendedAction } from '../../../types/explainTypes';
import { Candidate, Requisition } from '../../../types/entities';
import { isWithinInterval } from 'date-fns';

interface TTFRecord {
  candidateId: string;
  reqId: string;
  reqTitle: string;
  recruiterName: string;
  totalDays: number;
  openedToApplied: number | null;
  appliedToFirstTouch: number | null;
  firstTouchToHire: number | null;
  openedAt: Date;
  hiredAt: Date;
}

/**
 * Median TTF Explain Provider
 *
 * Shows time to fill with breakdown:
 * - Applied to First Touch (first_contacted_at - applied_at)
 * - First Touch to Hire (hired_at - first_contacted_at)
 */
export class MedianTTFProvider implements ExplainProvider {
  id = 'median_ttf' as const;

  canExplain(context: ExplainContext): BlockedReason[] {
    const reasons: BlockedReason[] = [];

    const hires = this.getHiresInRange(context);

    if (hires.length === 0) {
      reasons.push({
        code: 'NO_HIRES_IN_RANGE',
        message: 'No hires recorded in the selected date range',
      });
      return reasons;
    }

    // Check if we have valid TTF data
    const withValidTTF = hires.filter(h => h.totalDays >= 0);
    if (withValidTTF.length === 0) {
      reasons.push({
        code: 'MISSING_TIMESTAMPS',
        message: 'All hires are missing required timestamps (opened_at or hired_at)',
      });
    }

    return reasons;
  }

  explain(context: ExplainContext): Explanation {
    const { filters } = context;
    const hires = this.getHiresInRange(context);

    if (hires.length === 0) {
      return this.createBlockedExplanation(context, [
        { code: 'NO_HIRES_IN_RANGE', message: 'No hires in date range' }
      ]);
    }

    // Filter valid TTF records (non-negative)
    const validHires = hires.filter(h => h.totalDays >= 0);
    const invalidCount = hires.length - validHires.length;

    if (validHires.length === 0) {
      return this.createBlockedExplanation(context, [
        { code: 'ALL_INVALID', message: 'All hires have invalid TTF data (negative or missing)' }
      ]);
    }

    // Calculate median TTF
    const sortedTTF = validHires.map(h => h.totalDays).sort((a, b) => a - b);
    const medianTTF = this.median(sortedTTF);

    // Calculate phase medians
    // Phase 1: Opened to Applied (time before candidate applied)
    const withOpenedToApplied = validHires.filter(h => h.openedToApplied !== null && h.openedToApplied >= 0);
    let medianOpenedToApplied: number | null = null;
    if (withOpenedToApplied.length > 0) {
      const sorted = withOpenedToApplied.map(h => h.openedToApplied!).sort((a, b) => a - b);
      medianOpenedToApplied = this.median(sorted);
    }

    // Phase 2 & 3: Applied to First Touch, First Touch to Hire
    const withPhases = validHires.filter(
      h => h.appliedToFirstTouch !== null && h.firstTouchToHire !== null
    );

    let medianAppliedToFirstTouch: number | null = null;
    let medianFirstTouchToHire: number | null = null;

    if (withPhases.length > 0) {
      const sortedPhase1 = withPhases
        .map(h => h.appliedToFirstTouch!)
        .filter(v => v >= 0)
        .sort((a, b) => a - b);
      const sortedPhase2 = withPhases
        .map(h => h.firstTouchToHire!)
        .filter(v => v >= 0)
        .sort((a, b) => a - b);

      if (sortedPhase1.length > 0) {
        medianAppliedToFirstTouch = this.median(sortedPhase1);
      }
      if (sortedPhase2.length > 0) {
        medianFirstTouchToHire = this.median(sortedPhase2);
      }
    }

    // Build breakdown - all 3 phases that add up to total TTF
    const breakdown: BreakdownRow[] = [];

    if (medianOpenedToApplied !== null) {
      breakdown.push({
        label: 'Req Opened to Applied',
        value: medianOpenedToApplied,
        unit: 'days',
      });
    }

    if (medianAppliedToFirstTouch !== null) {
      breakdown.push({
        label: 'Applied to First Touch',
        value: medianAppliedToFirstTouch,
        unit: 'days',
      });
    }

    if (medianFirstTouchToHire !== null) {
      breakdown.push({
        label: 'First Touch to Hire',
        value: medianFirstTouchToHire,
        unit: 'days',
      });
    }

    // Math invariant check - phase sum vs total
    // Note: Medians don't add up (median(A) + median(B) ≠ median(A+B))
    // We flag any difference so the UI can show an explanatory note
    let mathInvariantValid = true;
    if (medianTTF !== null && breakdown.length > 0) {
      const phaseSum = (medianOpenedToApplied || 0) + (medianAppliedToFirstTouch || 0) + (medianFirstTouchToHire || 0);
      mathInvariantValid = phaseSum === medianTTF;
    }

    // Top contributors (longest TTF)
    const topContributors: ContributingRecord[] = [...validHires]
      .sort((a, b) => b.totalDays - a.totalDays)
      .slice(0, 5)
      .map(h => ({
        id: h.candidateId,
        label: h.reqTitle,
        value: h.totalDays,
        included: true,
      }));

    // Exclusion reasons
    const exclusionReasons: Array<{ reason: string; count: number }> = [];
    if (invalidCount > 0) {
      exclusionReasons.push({
        reason: 'Negative TTF (data error)',
        count: invalidCount,
      });
    }

    const missingPhases = validHires.length - withPhases.length;
    if (missingPhases > 0) {
      exclusionReasons.push({
        reason: 'Missing first_contacted_at (no breakdown available)',
        count: missingPhases,
      });
    }

    // Confidence
    let confidenceGrade: 'high' | 'medium' | 'low' = 'high';
    let confidenceNote = `Based on ${validHires.length} hires`;

    if (validHires.length < 3) {
      confidenceGrade = 'low';
      confidenceNote = `Only ${validHires.length} hire(s) - low sample size`;
    } else if (validHires.length < 10) {
      confidenceGrade = 'medium';
      confidenceNote = `Based on ${validHires.length} hires - moderate sample`;
    }

    if (breakdown.length === 0) {
      confidenceNote += '. No breakdown available (missing first contact dates).';
    }

    // Generate recommended actions based on data
    const recommendedActions: RecommendedAction[] = [];
    const TARGET_DAYS = 45;

    if (medianTTF !== null && medianTTF > TARGET_DAYS) {
      recommendedActions.push({
        action: 'Review longest-fill reqs for bottlenecks',
        priority: medianTTF > TARGET_DAYS * 1.5 ? 'high' : 'medium',
        reason: `Median ${medianTTF}d exceeds ${TARGET_DAYS}d target`,
      });
    }

    if (medianAppliedToFirstTouch !== null && medianAppliedToFirstTouch > 7) {
      recommendedActions.push({
        action: 'Speed up initial candidate outreach',
        priority: medianAppliedToFirstTouch > 14 ? 'high' : 'medium',
        reason: `${medianAppliedToFirstTouch}d to first touch`,
      });
    }

    if (medianFirstTouchToHire !== null && medianFirstTouchToHire > 30) {
      recommendedActions.push({
        action: 'Accelerate interview and decision process',
        priority: medianFirstTouchToHire > 45 ? 'high' : 'medium',
        reason: `${medianFirstTouchToHire}d from first touch to hire`,
      });
    }

    // Cap at 3 actions
    const finalActions = recommendedActions.slice(0, 3);

    return {
      metricId: this.id,
      metricLabel: 'Median Time to Fill',
      status: confidenceGrade === 'low' ? 'partial' : 'ready',
      value: medianTTF,
      unit: 'days',
      formula: 'median(hired_at - req.opened_at) for all hires in date range',
      formulaCode: 'median(hired_at - opened_at)',
      dateRange: {
        start: filters.dateRange.startDate,
        end: filters.dateRange.endDate,
      },
      includedCount: validHires.length,
      excludedCount: invalidCount,
      exclusionReasons,
      breakdown: breakdown.length > 0 ? breakdown : undefined,
      confidenceGrade,
      confidenceNote,
      topContributors,
      mathInvariantValid: breakdown.length > 0 ? mathInvariantValid : undefined,
      benchmark: {
        value: 45,
        label: 'Target',
      },
      recommendedActions: finalActions.length > 0 ? finalActions : undefined,
      computedAt: new Date(),
    };
  }

  private getHiresInRange(context: ExplainContext): TTFRecord[] {
    const { candidates, requisitions, users, filters } = context;

    const reqMap = new Map(requisitions.map(r => [r.req_id, r]));
    const userMap = new Map(users.map(u => [u.user_id, u.name]));

    return candidates
      .filter(c => {
        if (!c.hired_at) return false;
        return isWithinInterval(c.hired_at, {
          start: filters.dateRange.startDate,
          end: filters.dateRange.endDate,
        });
      })
      .map(c => {
        const req = reqMap.get(c.req_id);
        const hiredAt = c.hired_at!;
        const openedAt = req?.opened_at;

        // Calculate total TTF (from req opened to hire)
        const totalDays = openedAt
          ? Math.floor((hiredAt.getTime() - openedAt.getTime()) / (1000 * 60 * 60 * 24))
          : -1; // Invalid if no opened_at

        // Calculate phase breakdown - 3 phases that should sum to totalDays
        let openedToApplied: number | null = null;
        let appliedToFirstTouch: number | null = null;
        let firstTouchToHire: number | null = null;

        // Phase 1: Req Opened to Applied
        if (openedAt && c.applied_at) {
          openedToApplied = Math.floor(
            (c.applied_at.getTime() - openedAt.getTime()) / (1000 * 60 * 60 * 24)
          );
        }

        // Phase 2 & 3: Applied to First Touch, First Touch to Hire
        const candidateStartDate = c.applied_at || openedAt;
        if (candidateStartDate && c.first_contacted_at) {
          appliedToFirstTouch = Math.floor(
            (c.first_contacted_at.getTime() - candidateStartDate.getTime()) / (1000 * 60 * 60 * 24)
          );
          firstTouchToHire = Math.floor(
            (hiredAt.getTime() - c.first_contacted_at.getTime()) / (1000 * 60 * 60 * 24)
          );
        }

        return {
          candidateId: c.candidate_id,
          reqId: c.req_id,
          reqTitle: req?.req_title || 'Unknown',
          recruiterName: userMap.get(req?.recruiter_id || '') || req?.recruiter_id || 'Unknown',
          totalDays,
          openedToApplied,
          appliedToFirstTouch,
          firstTouchToHire,
          openedAt: openedAt || new Date(0),
          hiredAt,
        };
      });
  }

  private median(sortedValues: number[]): number | null {
    if (sortedValues.length === 0) return null;
    const mid = Math.floor(sortedValues.length / 2);
    return sortedValues.length % 2
      ? sortedValues[mid]
      : Math.round((sortedValues[mid - 1] + sortedValues[mid]) / 2);
  }

  private createBlockedExplanation(
    context: ExplainContext,
    blockedReasons: BlockedReason[]
  ): Explanation {
    return {
      metricId: this.id,
      metricLabel: 'Median Time to Fill',
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
