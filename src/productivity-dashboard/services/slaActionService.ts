// services/slaActionService.ts
// SLA Attribution V1 - Action generation service for SLA breaches

import {
  ActionItem,
  ActionOwnerType,
  ActionPriority,
  ActionType,
  generateActionId,
} from '../types/actionTypes';
import {
  BottleneckSummary,
  ReqBreachSummary,
  SlaOwnerType,
} from '../types/slaTypes';
import { getSlaOwnerType } from './slaAttributionService';

/**
 * Map SLA owner type to action owner type
 */
function mapOwnerType(slaOwner: SlaOwnerType): ActionOwnerType {
  switch (slaOwner) {
    case 'HM':
      return 'HIRING_MANAGER';
    case 'RECRUITER':
      return 'RECRUITER';
    case 'OPS':
    case 'UNKNOWN':
    default:
      return 'TA_OPS';
  }
}

/**
 * Get action type from stage key
 */
function getActionType(stageKey: string): ActionType {
  switch (stageKey) {
    case 'SCREEN':
      return 'SLA_BREACH_SCREEN';
    case 'HM_SCREEN':
      return 'SLA_BREACH_HM_SCREEN';
    case 'ONSITE':
      return 'SLA_BREACH_ONSITE';
    case 'FINAL':
      return 'SLA_BREACH_FINAL';
    case 'OFFER':
      return 'SLA_BREACH_OFFER';
    default:
      // Default to HM_SCREEN for unknown stages
      return 'SLA_BREACH_HM_SCREEN';
  }
}

/**
 * Determine priority based on breach hours
 * >48h = P0 (blocking)
 * >24h = P1 (risk)
 * else = P2 (optimize)
 */
function getPriorityFromBreachHours(breachHours: number): ActionPriority {
  if (breachHours > 48) return 'P0';
  if (breachHours > 24) return 'P1';
  return 'P2';
}

/**
 * Get due date offset based on priority
 */
function getDueDateOffset(priority: ActionPriority): number {
  switch (priority) {
    case 'P0':
      return 0; // Due today
    case 'P1':
      return 1; // Due tomorrow
    case 'P2':
      return 3; // Due in 3 days
  }
}

/**
 * Get recommended steps for an SLA breach action
 */
function getRecommendedSteps(stageKey: string, ownerType: SlaOwnerType): string[] {
  const hmSteps = [
    `Review candidates stuck in ${stageKey} stage`,
    'Provide feedback or schedule interviews promptly',
    'Communicate expected timeline to recruiting team',
    'Consider delegating if bandwidth is the issue',
  ];

  const recruiterSteps = [
    `Review candidates in ${stageKey} stage`,
    'Expedite processing or follow up with candidates',
    'Communicate timeline updates to candidates',
    'Flag any blockers to TA leadership',
  ];

  const opsSteps = [
    `Review process for ${stageKey} stage`,
    'Identify systemic bottlenecks',
    'Consider process improvements',
    'Work with team to address recurring delays',
  ];

  switch (ownerType) {
    case 'HM':
      return hmSteps;
    case 'RECRUITER':
      return recruiterSteps;
    case 'OPS':
    case 'UNKNOWN':
    default:
      return opsSteps;
  }
}

/**
 * Generate SLA breach actions from bottleneck summary
 */
export function generateSlaBreachActions(
  bottleneckSummary: BottleneckSummary,
  existingActionIds: Set<string> = new Set()
): ActionItem[] {
  const newActions: ActionItem[] = [];
  const now = new Date();

  for (const req of bottleneckSummary.top_reqs) {
    // Get owner for worst breach stage
    const ownerType = getSlaOwnerType(req.worst_stage);
    const actionOwnerType = mapOwnerType(ownerType);

    // Determine owner ID and name
    let ownerId: string;
    let ownerName: string;

    if (ownerType === 'HM' && req.hiring_manager_id) {
      ownerId = req.hiring_manager_id;
      ownerName = req.hiring_manager_name ?? req.hiring_manager_id;
    } else if (ownerType === 'RECRUITER' && req.recruiter_id) {
      ownerId = req.recruiter_id;
      ownerName = req.recruiter_name ?? req.recruiter_id;
    } else {
      // Skip if no owner can be determined
      continue;
    }

    // Get action type
    const actionType = getActionType(req.worst_stage);

    // Generate deterministic action ID
    const actionId = generateActionId(actionOwnerType, ownerId, req.req_id, actionType);

    // Skip if action already exists
    if (existingActionIds.has(actionId)) {
      continue;
    }

    // Determine priority
    const priority = getPriorityFromBreachHours(req.worst_breach_hours);
    const dueDays = getDueDateOffset(priority);
    const dueDate = new Date(now.getTime() + dueDays * 24 * 60 * 60 * 1000);

    newActions.push({
      action_id: actionId,
      owner_type: actionOwnerType,
      owner_id: ownerId,
      owner_name: ownerName,
      req_id: req.req_id,
      req_title: req.req_title,
      action_type: actionType,
      title: `SLA breach: ${req.worst_stage} (${req.worst_breach_hours.toFixed(0)}h over)`,
      priority,
      due_in_days: dueDays,
      due_date: dueDate,
      evidence: {
        kpi_key: 'sla_breach',
        explain_provider_key: 'sla_attribution',
        short_reason: `${req.worst_stage} exceeded SLA by ${req.worst_breach_hours.toFixed(0)} hours`,
      },
      recommended_steps: getRecommendedSteps(req.worst_stage, ownerType),
      created_at: now,
      status: 'OPEN',
    });
  }

  return newActions;
}

/**
 * Generate actions from a single req breach summary
 */
export function generateActionFromReqBreach(req: ReqBreachSummary): ActionItem | null {
  const ownerType = getSlaOwnerType(req.worst_stage);
  const actionOwnerType = mapOwnerType(ownerType);

  let ownerId: string;
  let ownerName: string;

  if (ownerType === 'HM' && req.hiring_manager_id) {
    ownerId = req.hiring_manager_id;
    ownerName = req.hiring_manager_name ?? req.hiring_manager_id;
  } else if (ownerType === 'RECRUITER' && req.recruiter_id) {
    ownerId = req.recruiter_id;
    ownerName = req.recruiter_name ?? req.recruiter_id;
  } else {
    return null;
  }

  const actionType = getActionType(req.worst_stage);
  const actionId = generateActionId(actionOwnerType, ownerId, req.req_id, actionType);

  const priority = getPriorityFromBreachHours(req.worst_breach_hours);
  const dueDays = getDueDateOffset(priority);
  const now = new Date();
  const dueDate = new Date(now.getTime() + dueDays * 24 * 60 * 60 * 1000);

  return {
    action_id: actionId,
    owner_type: actionOwnerType,
    owner_id: ownerId,
    owner_name: ownerName,
    req_id: req.req_id,
    req_title: req.req_title,
    action_type: actionType,
    title: `SLA breach: ${req.worst_stage} (${req.worst_breach_hours.toFixed(0)}h over)`,
    priority,
    due_in_days: dueDays,
    due_date: dueDate,
    evidence: {
      kpi_key: 'sla_breach',
      explain_provider_key: 'sla_attribution',
      short_reason: `${req.worst_stage} exceeded SLA by ${req.worst_breach_hours.toFixed(0)} hours`,
    },
    recommended_steps: getRecommendedSteps(req.worst_stage, ownerType),
    created_at: now,
    status: 'OPEN',
  };
}

/**
 * Get summary statistics for SLA breach actions
 */
export function getSlaActionSummary(actions: ActionItem[]): {
  total: number;
  byPriority: Record<ActionPriority, number>;
  byOwnerType: Record<ActionOwnerType, number>;
  byStage: Record<string, number>;
} {
  const byPriority: Record<ActionPriority, number> = { P0: 0, P1: 0, P2: 0 };
  const byOwnerType: Record<ActionOwnerType, number> = {
    RECRUITER: 0,
    HIRING_MANAGER: 0,
    TA_OPS: 0,
  };
  const byStage: Record<string, number> = {};

  for (const action of actions) {
    byPriority[action.priority]++;
    byOwnerType[action.owner_type]++;

    // Extract stage from action type
    const stage = action.action_type.replace('SLA_BREACH_', '');
    byStage[stage] = (byStage[stage] ?? 0) + 1;
  }

  return {
    total: actions.length,
    byPriority,
    byOwnerType,
    byStage,
  };
}
