// Stalled Reqs Explain Provider
// Shows top 10 stalled/zombie reqs with stall reasons

import { ExplainProvider, ExplainContext } from '../types';
import { Explanation, BlockedReason, ContributingRecord, RecommendedAction } from '../../../types/explainTypes';
import { RequisitionStatus } from '../../../types/entities';
import { assessReqHealth } from '../../reqHealthService';
import { ReqHealthStatus } from '../../../types/dataHygieneTypes';

interface StalledReq {
  reqId: string;
  reqTitle: string;
  recruiterName: string;
  hmName: string;
  status: ReqHealthStatus;
  daysSinceActivity: number | null;
  reason: string;
}

/**
 * Stalled Reqs Explain Provider
 *
 * Shows count and details of stalled/zombie requisitions:
 * - STALLED: No activity in 14-30 days
 * - ZOMBIE: No activity in 30+ days
 */
export class StalledReqsProvider implements ExplainProvider {
  id = 'stalled_reqs' as const;

  canExplain(context: ExplainContext): BlockedReason[] {
    const reasons: BlockedReason[] = [];
    const { requisitions } = context;

    const openReqs = requisitions.filter(r => r.status === RequisitionStatus.Open);

    if (openReqs.length === 0) {
      reasons.push({
        code: 'NO_OPEN_REQS',
        message: 'No open requisitions found',
      });
    }

    return reasons;
  }

  explain(context: ExplainContext): Explanation {
    const { requisitions, candidates, events, users, filters } = context;

    // Build user lookup
    const userMap = new Map(users.map(u => [u.user_id, u.name]));

    // Get open reqs and assess health
    const openReqs = requisitions.filter(r => r.status === RequisitionStatus.Open);

    const stalledReqs: StalledReq[] = [];
    const zombieReqs: StalledReq[] = [];
    let healthyCount = 0;
    let atRiskCount = 0;

    for (const req of openReqs) {
      const health = assessReqHealth(req, candidates, events);

      const reqData: StalledReq = {
        reqId: req.req_id,
        reqTitle: req.req_title,
        recruiterName: userMap.get(req.recruiter_id) || req.recruiter_id,
        hmName: userMap.get(req.hiring_manager_id) || req.hiring_manager_id,
        status: health.status,
        daysSinceActivity: health.daysSinceLastActivity,
        reason: health.reasons.join('; ') || 'No specific reason',
      };

      switch (health.status) {
        case ReqHealthStatus.STALLED:
          stalledReqs.push(reqData);
          break;
        case ReqHealthStatus.ZOMBIE:
          zombieReqs.push(reqData);
          break;
        case ReqHealthStatus.AT_RISK:
          atRiskCount++;
          break;
        case ReqHealthStatus.ACTIVE:
        default:
          healthyCount++;
          break;
      }
    }

    const totalStalledOrZombie = stalledReqs.length + zombieReqs.length;

    // Top 10 stalled/zombie reqs (zombies first, then stalled, by days since activity)
    const allStalled = [
      ...zombieReqs.sort((a, b) => (b.daysSinceActivity || 0) - (a.daysSinceActivity || 0)),
      ...stalledReqs.sort((a, b) => (b.daysSinceActivity || 0) - (a.daysSinceActivity || 0)),
    ].slice(0, 10);

    const topContributors: ContributingRecord[] = allStalled.map(req => ({
      id: req.reqId,
      label: `${req.reqTitle} (${req.status === ReqHealthStatus.ZOMBIE ? 'Zombie' : 'Stalled'})`,
      value: req.daysSinceActivity,
      included: true,
      excludeReason: req.reason,
    }));

    // Build breakdown
    const breakdown = [
      {
        label: 'Zombie Reqs (30+ days inactive)',
        value: zombieReqs.length,
        unit: 'reqs',
      },
      {
        label: 'Stalled Reqs (14-30 days inactive)',
        value: stalledReqs.length,
        unit: 'reqs',
      },
      {
        label: 'At-Risk Reqs',
        value: atRiskCount,
        unit: 'reqs',
      },
      {
        label: 'Healthy Reqs',
        value: healthyCount,
        unit: 'reqs',
      },
    ];

    // Determine status color logic
    const status: 'green' | 'yellow' | 'red' = totalStalledOrZombie === 0 ? 'green' :
      zombieReqs.length > 0 ? 'red' : 'yellow';

    // Confidence
    let confidenceGrade: 'high' | 'medium' | 'low' = 'high';
    let confidenceNote = `Analyzed ${openReqs.length} open requisitions`;

    if (openReqs.length < 5) {
      confidenceGrade = 'low';
      confidenceNote = `Only ${openReqs.length} open req(s) - limited data`;
    }

    // Generate recommended actions based on data
    const recommendedActions: RecommendedAction[] = [];

    if (zombieReqs.length > 0) {
      recommendedActions.push({
        action: 'Review zombie reqs: close or revive with sourcing',
        priority: zombieReqs.length >= 3 ? 'high' : 'medium',
        reason: `${zombieReqs.length} req(s) with no activity in 30+ days`,
      });
    }

    if (stalledReqs.length > 0) {
      recommendedActions.push({
        action: 'Source candidates for stalled reqs',
        priority: stalledReqs.length >= 5 ? 'high' : 'medium',
        reason: `${stalledReqs.length} req(s) stalled 14-30 days`,
      });
    }

    if (atRiskCount > 0) {
      recommendedActions.push({
        action: 'Check pipeline health for at-risk reqs',
        priority: atRiskCount >= 3 ? 'high' : 'low',
        reason: `${atRiskCount} req(s) open 120+ days with thin pipeline`,
      });
    }

    // Cap at 3 actions
    const finalActions = recommendedActions.slice(0, 3);

    return {
      metricId: this.id,
      metricLabel: 'Stalled Requisitions',
      status: 'ready',
      value: totalStalledOrZombie,
      unit: 'reqs',
      formula: 'count(reqs with no activity in 14+ days)',
      formulaCode: 'count(status IN [STALLED, ZOMBIE])',
      dateRange: {
        start: filters.dateRange.startDate,
        end: filters.dateRange.endDate,
      },
      includedCount: openReqs.length,
      excludedCount: 0,
      exclusionReasons: [],
      breakdown,
      confidenceGrade,
      confidenceNote,
      topContributors: topContributors.length > 0 ? topContributors : undefined,
      recommendedActions: finalActions.length > 0 ? finalActions : undefined,
      computedAt: new Date(),
    };
  }
}
