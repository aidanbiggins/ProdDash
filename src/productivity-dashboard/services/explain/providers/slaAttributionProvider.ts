// SLA Attribution Explain Provider
// Shows SLA breach analysis and bottleneck identification

import { ExplainProvider, ExplainContext } from '../types';
import { Explanation, BlockedReason, BreakdownRow, RecommendedAction } from '../../../types/explainTypes';
import {
  computeBottleneckSummary,
  checkCoverageSufficiency,
} from '../../slaAttributionService';
import { DEFAULT_SLA_POLICIES, BottleneckSummary } from '../../../types/slaTypes';
import { DataSnapshot, SnapshotEvent } from '../../../types/snapshotTypes';

/**
 * SLA Attribution Explain Provider
 *
 * Analyzes stage dwell times and SLA breaches to identify bottlenecks.
 * Requires snapshot diff data for accurate attribution.
 */
export class SlaAttributionProvider implements ExplainProvider {
  id = 'sla_attribution' as const;

  canExplain(context: ExplainContext): BlockedReason[] {
    const reasons: BlockedReason[] = [];

    // Check if we have access to snapshot data via extended context
    const extendedContext = context as ExplainContext & {
      snapshots?: DataSnapshot[];
      snapshotEvents?: SnapshotEvent[];
    };

    if (!extendedContext.snapshots || extendedContext.snapshots.length === 0) {
      reasons.push({
        code: 'NO_SNAPSHOT_DATA',
        message: 'No snapshot data available for SLA analysis',
      });
      return reasons;
    }

    if (!extendedContext.snapshotEvents || extendedContext.snapshotEvents.length === 0) {
      reasons.push({
        code: 'NO_SNAPSHOT_EVENTS',
        message: 'No snapshot diff events available for stage tracking',
      });
      return reasons;
    }

    // Check coverage sufficiency
    const dateRange = this.getDateRange(context);
    const coverage = checkCoverageSufficiency(extendedContext.snapshots, dateRange);

    if (!coverage.is_sufficient) {
      reasons.push({
        code: 'INSUFFICIENT_COVERAGE',
        message: `Insufficient snapshot coverage: ${coverage.insufficiency_reasons.join(', ')}`,
      });
    }

    return reasons;
  }

  explain(context: ExplainContext): Explanation {
    const extendedContext = context as ExplainContext & {
      snapshots?: DataSnapshot[];
      snapshotEvents?: SnapshotEvent[];
    };

    // Build maps for quick lookup
    const requisitionMap = new Map(context.requisitions.map(r => [r.req_id, r]));
    const userMap = new Map(context.users.map(u => [u.user_id, u]));

    const dateRange = this.getDateRange(context);

    // Check coverage first
    const coverage = checkCoverageSufficiency(extendedContext.snapshots || [], dateRange);

    if (!coverage.is_sufficient || !extendedContext.snapshotEvents?.length) {
      return this.createBlockedExplanation(context, [
        { code: 'INSUFFICIENT_DATA', message: 'Not enough snapshot data for SLA analysis' }
      ]);
    }

    // Compute bottleneck summary
    const bottleneckSummary = computeBottleneckSummary(
      extendedContext.snapshotEvents,
      extendedContext.snapshots || [],
      requisitionMap,
      userMap,
      dateRange,
      DEFAULT_SLA_POLICIES
    );

    // Build breakdown rows for top stages
    const breakdown: BreakdownRow[] = bottleneckSummary.top_stages.slice(0, 5).map(stage => ({
      label: stage.display_name,
      value: stage.median_dwell_hours,
      unit: 'hours',
    }));

    // Build recommended actions
    const recommendedActions: RecommendedAction[] = this.buildRecommendedActions(bottleneckSummary);

    // Determine status based on breach counts
    const totalBreaches = Object.values(bottleneckSummary.breach_counts).reduce((a, b) => a + b, 0);
    const worstStage = bottleneckSummary.top_stages[0];

    return {
      metricId: 'sla_attribution',
      metricLabel: 'SLA & Bottleneck Analysis',
      status: 'ready',
      value: worstStage?.median_dwell_hours ?? null,
      unit: 'hours',
      formula: 'Median dwell time per stage from snapshot diff events',
      formulaCode: 'median(exit_timestamp - enter_timestamp) per stage',
      dateRange,
      includedCount: bottleneckSummary.total_candidates_analyzed,
      excludedCount: 0,
      exclusionReasons: [],
      breakdown,
      confidenceGrade: coverage.coverage_percent >= 70 ? 'high' : coverage.coverage_percent >= 50 ? 'medium' : 'low',
      confidenceNote: `Based on ${coverage.snapshot_count} snapshots over ${coverage.day_span} days (${coverage.coverage_percent.toFixed(0)}% coverage)`,
      benchmark: worstStage ? {
        value: this.getSlaForStage(worstStage.stage_key),
        label: 'SLA Threshold',
      } : undefined,
      recommendedActions,
      computedAt: new Date(),
    };
  }

  private getDateRange(context: ExplainContext): { start: Date; end: Date } {
    const { filters } = context;
    const end = filters.dateRange?.endDate ? new Date(filters.dateRange.endDate) : new Date();
    const start = filters.dateRange?.startDate ? new Date(filters.dateRange.startDate) : (() => {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      return d;
    })();
    return { start, end };
  }

  private getSlaForStage(stageKey: string): number {
    const policy = DEFAULT_SLA_POLICIES.find(p => p.stage_key === stageKey);
    return policy?.sla_hours ?? 72;
  }

  private buildRecommendedActions(summary: BottleneckSummary): RecommendedAction[] {
    const actions: RecommendedAction[] = [];

    // Action for worst stage
    if (summary.top_stages.length > 0) {
      const worst = summary.top_stages[0];
      const slaHours = this.getSlaForStage(worst.stage_key);

      if (worst.breach_rate > 0.3) {
        actions.push({
          action: `Urgent: Address ${worst.display_name} bottleneck (${(worst.breach_rate * 100).toFixed(0)}% breach rate)`,
          priority: 'high',
          reason: `Median dwell time of ${worst.median_dwell_hours.toFixed(0)}h exceeds SLA of ${slaHours}h`,
        });
      } else if (worst.breach_rate > 0.1) {
        actions.push({
          action: `Monitor ${worst.display_name} stage closely`,
          priority: 'medium',
          reason: `${(worst.breach_rate * 100).toFixed(0)}% of candidates breaching SLA`,
        });
      }
    }

    // Action based on owner type breakdown
    const hmBreaches = summary.breach_by_owner_type['HM'] ?? 0;
    const recruiterBreaches = summary.breach_by_owner_type['RECRUITER'] ?? 0;

    if (hmBreaches > recruiterBreaches && hmBreaches > 5) {
      actions.push({
        action: 'Review HM feedback processes',
        priority: hmBreaches > 10 ? 'high' : 'medium',
        reason: `${hmBreaches} breaches attributed to Hiring Managers`,
      });
    } else if (recruiterBreaches > 5) {
      actions.push({
        action: 'Review recruiter screen scheduling',
        priority: recruiterBreaches > 10 ? 'high' : 'medium',
        reason: `${recruiterBreaches} breaches attributed to Recruiters`,
      });
    }

    // Action for specific reqs with most breaches
    if (summary.top_reqs.length > 3) {
      actions.push({
        action: `Focus on top ${Math.min(5, summary.top_reqs.length)} reqs with SLA breaches`,
        priority: 'medium',
        reason: `${summary.top_reqs.length} requisitions have active SLA breaches`,
      });
    }

    return actions.slice(0, 3); // Max 3 actions
  }

  private createBlockedExplanation(context: ExplainContext, blockedReasons: BlockedReason[]): Explanation {
    const dateRange = this.getDateRange(context);

    return {
      metricId: 'sla_attribution',
      metricLabel: 'SLA & Bottleneck Analysis',
      status: 'blocked',
      value: null,
      unit: 'hours',
      formula: 'Median dwell time per stage from snapshot diff events',
      dateRange,
      includedCount: 0,
      excludedCount: 0,
      exclusionReasons: [],
      blockedReasons,
      computedAt: new Date(),
    };
  }
}

export const slaAttributionProvider = new SlaAttributionProvider();
