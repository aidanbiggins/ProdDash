// Unified Action Queue Service
// Generates, deduplicates, and persists actions from multiple sources

import {
  ActionItem,
  ActionOwnerType,
  ActionPriority,
  ActionStatus,
  ActionType,
  ActionEvidence,
  ActionStateStore,
  PersistedActionState,
  PRIORITY_ORDER,
  generateActionId,
} from '../types/actionTypes';
import { HMPendingAction, HMActionType } from '../types/hmTypes';
import { Explanation, ExplainProviderId, RecommendedAction } from '../types/explainTypes';
import { Requisition, User, UserRole } from '../types/entities';

// ===== CONSTANTS =====

const STORAGE_KEY_PREFIX = 'platovue_action_states_';

// Map RecommendedAction priority to ActionPriority
function mapRecommendedPriority(priority: 'high' | 'medium' | 'low'): ActionPriority {
  switch (priority) {
    case 'high': return 'P0';
    case 'medium': return 'P1';
    case 'low': return 'P2';
  }
}

// Map HMActionType to ActionType
function mapHMActionType(type: HMActionType): ActionType {
  switch (type) {
    case HMActionType.FEEDBACK_DUE: return 'FEEDBACK_DUE';
    case HMActionType.REVIEW_DUE: return 'REVIEW_DUE';
    case HMActionType.DECISION_DUE: return 'DECISION_DUE';
  }
}

// Map Explain provider actions to ActionType
function mapExplainActionType(action: string, providerId: ExplainProviderId): ActionType {
  const actionLower = action.toLowerCase();

  // Stalled Reqs provider
  if (actionLower.includes('zombie')) return 'REVIEW_ZOMBIE_REQS';
  if (actionLower.includes('stalled') && actionLower.includes('source')) return 'SOURCE_CANDIDATES';
  if (actionLower.includes('stalled')) return 'REVIEW_STALLED_REQS';
  if (actionLower.includes('at-risk') || actionLower.includes('pipeline')) return 'PIPELINE_HEALTH_CHECK';

  // Time to Offer / Median TTF providers
  if (actionLower.includes('engagement') || actionLower.includes('outreach')) return 'SPEED_UP_ENGAGEMENT';
  if (actionLower.includes('streamline') || actionLower.includes('accelerate')) return 'STREAMLINE_PROCESS';
  if (actionLower.includes('review') && actionLower.includes('longest')) return 'REVIEW_STALLED_REQS';

  // Offer Accept Rate provider
  if (actionLower.includes('declined') || actionLower.includes('pattern')) return 'REVIEW_DECLINED_OFFERS';
  if (actionLower.includes('investigate') && actionLower.includes('source')) return 'INVESTIGATE_SOURCE';
  if (actionLower.includes('pending') && actionLower.includes('offer')) return 'FOLLOW_UP_OFFERS';

  // HM Latency provider
  if (actionLower.includes('follow up') && actionLower.includes('hm')) return 'FEEDBACK_DUE';
  if (actionLower.includes('escalate') && actionLower.includes('decision')) return 'DECISION_DUE';
  if (actionLower.includes('recruiter') && actionLower.includes('response')) return 'SPEED_UP_ENGAGEMENT';

  // Default
  return 'PROCESS_OPTIMIZATION';
}

// Determine owner type from explain provider and action
function determineOwnerType(providerId: ExplainProviderId, action: string): ActionOwnerType {
  const actionLower = action.toLowerCase();

  // HM-specific actions
  if (providerId === 'hm_latency') {
    if (actionLower.includes('hm') || actionLower.includes('hiring manager')) return 'HIRING_MANAGER';
    if (actionLower.includes('recruiter')) return 'RECRUITER';
    return 'TA_OPS';
  }

  // Stalled reqs are typically recruiter responsibility
  if (providerId === 'stalled_reqs') return 'RECRUITER';

  // Time-based metrics typically involve recruiting process
  if (providerId === 'median_ttf' || providerId === 'time_to_offer') {
    if (actionLower.includes('hm') || actionLower.includes('interview')) return 'HIRING_MANAGER';
    return 'RECRUITER';
  }

  // Offer accept rate
  if (providerId === 'offer_accept_rate') {
    if (actionLower.includes('pending')) return 'RECRUITER';
    return 'TA_OPS';
  }

  return 'TA_OPS';
}

// ===== ACTION GENERATION =====

/**
 * Generate actions from HM Pending Actions
 */
export function generateActionsFromHMQueue(
  hmActions: HMPendingAction[],
  requisitions: Requisition[]
): ActionItem[] {
  const reqMap = new Map(requisitions.map(r => [r.req_id, r]));
  const now = new Date();

  return hmActions.map(hma => {
    const action_type = mapHMActionType(hma.actionType);
    const action_id = generateActionId('HIRING_MANAGER', hma.hmUserId, hma.reqId, action_type);

    // Determine priority based on days overdue
    let priority: ActionPriority = 'P2';
    if (hma.daysOverdue > 3) priority = 'P0';
    else if (hma.daysOverdue > 0) priority = 'P1';

    // Calculate due date
    const due_in_days = Math.max(0, -hma.daysOverdue); // Negative overdue = still time
    const due_date = new Date(now.getTime() + due_in_days * 24 * 60 * 60 * 1000);

    // Map action type to title
    const titles: Record<ActionType, string> = {
      'FEEDBACK_DUE': 'Interview feedback needed',
      'REVIEW_DUE': 'Resume review needed',
      'DECISION_DUE': 'Hiring decision needed',
      'REVIEW_STALLED_REQS': 'Review stalled reqs',
      'REVIEW_ZOMBIE_REQS': 'Review zombie reqs',
      'SOURCE_CANDIDATES': 'Source candidates',
      'SPEED_UP_ENGAGEMENT': 'Speed up engagement',
      'STREAMLINE_PROCESS': 'Streamline process',
      'FOLLOW_UP_OFFERS': 'Follow up on offers',
      'REVIEW_DECLINED_OFFERS': 'Review declined offers',
      'INVESTIGATE_SOURCE': 'Investigate source quality',
      'PIPELINE_HEALTH_CHECK': 'Pipeline health check',
      'PROCESS_OPTIMIZATION': 'Process optimization',
      'DATA_HYGIENE': 'Data hygiene',
      // SLA Breach Actions
      'SLA_BREACH_SCREEN': 'SLA breach: Recruiter screen',
      'SLA_BREACH_HM_SCREEN': 'SLA breach: HM interview',
      'SLA_BREACH_ONSITE': 'SLA breach: Onsite',
      'SLA_BREACH_FINAL': 'SLA breach: Final round',
      'SLA_BREACH_OFFER': 'SLA breach: Offer stage',
      // Capacity Rebalancer Actions
      'REASSIGN_REQ': 'Reassign requisition',
      'NOTIFY_HM_REASSIGN': 'Notify HM of reassignment',
      'RECRUITER_HANDOFF': 'Complete recruiter handoff',
    };

    const req = reqMap.get(hma.reqId);

    return {
      action_id,
      owner_type: 'HIRING_MANAGER' as ActionOwnerType,
      owner_id: hma.hmUserId,
      owner_name: hma.hmName,
      req_id: hma.reqId,
      req_title: hma.reqTitle,
      application_id: hma.candidateId,
      candidate_name: hma.candidateName,
      action_type,
      title: titles[action_type] || hma.suggestedAction,
      priority,
      due_in_days,
      due_date,
      evidence: {
        kpi_key: 'hm_latency',
        explain_provider_key: 'hm_latency',
        short_reason: `${hma.daysWaiting}d waiting, ${hma.daysOverdue > 0 ? hma.daysOverdue + 'd overdue' : 'due soon'}`,
      },
      recommended_steps: [hma.suggestedAction],
      created_at: now,
      status: 'OPEN' as ActionStatus,
    };
  });
}

/**
 * Generate actions from Explain recommended actions
 */
export function generateActionsFromExplain(
  explanations: Map<ExplainProviderId, Explanation>,
  requisitions: Requisition[],
  users: User[]
): ActionItem[] {
  const actions: ActionItem[] = [];
  const now = new Date();

  // Build user lookup
  const userMap = new Map(users.map(u => [u.user_id, u]));
  const recruiterUsers = users.filter(u => u.role === UserRole.Recruiter);

  // Default owner for TA Ops actions
  const defaultOwnerId = 'ta_ops_team';
  const defaultOwnerName = 'TA Ops';

  explanations.forEach((explanation, providerId) => {
    if (!explanation.recommendedActions || explanation.recommendedActions.length === 0) {
      return;
    }

    for (const recAction of explanation.recommendedActions) {
      const action_type = mapExplainActionType(recAction.action, providerId);
      const owner_type = determineOwnerType(providerId, recAction.action);

      // Determine owner based on type
      let owner_id = defaultOwnerId;
      let owner_name = defaultOwnerName;

      if (owner_type === 'RECRUITER' && recruiterUsers.length > 0) {
        // For recruiter actions, we create one action per recruiter or use a generic
        owner_id = 'all_recruiters';
        owner_name = 'Recruiting Team';
      } else if (owner_type === 'HIRING_MANAGER') {
        owner_id = 'all_hms';
        owner_name = 'HM Team';
      }

      // For actions tied to specific reqs (from top contributors), create specific actions
      if (explanation.topContributors && explanation.topContributors.length > 0) {
        // Create action for top contributor
        const topContrib = explanation.topContributors[0];
        const req = requisitions.find(r => r.req_title === topContrib.label || r.req_id === topContrib.id);

        if (req) {
          const action_id = generateActionId(owner_type, owner_id, req.req_id, action_type);
          const priority = mapRecommendedPriority(recAction.priority);

          // Calculate due days based on priority
          const due_in_days = priority === 'P0' ? 1 : priority === 'P1' ? 3 : 7;
          const due_date = new Date(now.getTime() + due_in_days * 24 * 60 * 60 * 1000);

          actions.push({
            action_id,
            owner_type,
            owner_id,
            owner_name,
            req_id: req.req_id,
            req_title: req.req_title,
            action_type,
            title: recAction.action,
            priority,
            due_in_days,
            due_date,
            evidence: {
              kpi_key: explanation.metricId,
              explain_provider_key: providerId,
              short_reason: recAction.reason || `${explanation.metricLabel}: ${explanation.value}${explanation.unit}`,
            },
            recommended_steps: [recAction.action],
            created_at: now,
            status: 'OPEN' as ActionStatus,
          });
        }
      }

      // Also create a general action for the metric
      const action_id = generateActionId(owner_type, owner_id, 'general', action_type);
      const priority = mapRecommendedPriority(recAction.priority);
      const due_in_days = priority === 'P0' ? 1 : priority === 'P1' ? 3 : 7;
      const due_date = new Date(now.getTime() + due_in_days * 24 * 60 * 60 * 1000);

      actions.push({
        action_id,
        owner_type,
        owner_id,
        owner_name,
        req_id: 'general',
        action_type,
        title: recAction.action,
        priority,
        due_in_days,
        due_date,
        evidence: {
          kpi_key: explanation.metricId,
          explain_provider_key: providerId,
          short_reason: recAction.reason || `${explanation.metricLabel}: ${explanation.value}${explanation.unit}`,
        },
        recommended_steps: [recAction.action],
        created_at: now,
        status: 'OPEN' as ActionStatus,
      });
    }
  });

  return actions;
}

/**
 * Deduplicate actions - keep highest priority for same owner+req+type
 */
export function deduplicateActions(actions: ActionItem[]): ActionItem[] {
  const seen = new Map<string, ActionItem>();

  for (const action of actions) {
    const key = `${action.owner_type}:${action.owner_id}:${action.req_id}:${action.action_type}`;
    const existing = seen.get(key);

    if (!existing) {
      seen.set(key, action);
    } else {
      // Keep the one with higher priority (lower PRIORITY_ORDER value)
      if (PRIORITY_ORDER[action.priority] < PRIORITY_ORDER[existing.priority]) {
        seen.set(key, action);
      }
    }
  }

  return Array.from(seen.values());
}

/**
 * Sort actions by priority then due date
 */
export function sortActions(actions: ActionItem[]): ActionItem[] {
  return [...actions].sort((a, b) => {
    // First by priority
    const priorityDiff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    if (priorityDiff !== 0) return priorityDiff;

    // Then by due date
    return a.due_date.getTime() - b.due_date.getTime();
  });
}

/**
 * Filter actions by owner type
 */
export function filterActionsByOwner(
  actions: ActionItem[],
  filter: 'ALL' | 'RECRUITER' | 'HIRING_MANAGER' | 'TA_OPS'
): ActionItem[] {
  if (filter === 'ALL') return actions;
  return actions.filter(a => a.owner_type === filter);
}

// ===== PERSISTENCE =====

/**
 * Get localStorage key for a dataset
 */
function getStorageKey(datasetId: string): string {
  return `${STORAGE_KEY_PREFIX}${datasetId}`;
}

/**
 * Load persisted action states from localStorage
 */
export function loadActionStates(datasetId: string): ActionStateStore | null {
  try {
    const key = getStorageKey(datasetId);
    const data = localStorage.getItem(key);
    if (!data) return null;
    return JSON.parse(data) as ActionStateStore;
  } catch (e) {
    console.warn('Failed to load action states:', e);
    return null;
  }
}

/**
 * Save action state to localStorage
 */
export function saveActionState(
  datasetId: string,
  actionId: string,
  status: ActionStatus
): void {
  try {
    const key = getStorageKey(datasetId);
    const existing = loadActionStates(datasetId) || {
      dataset_id: datasetId,
      actions: {},
      last_updated: new Date().toISOString(),
    };

    existing.actions[actionId] = {
      action_id: actionId,
      status,
      updated_at: new Date().toISOString(),
    };
    existing.last_updated = new Date().toISOString();

    localStorage.setItem(key, JSON.stringify(existing));
  } catch (e) {
    console.warn('Failed to save action state:', e);
  }
}

/**
 * Apply persisted states to actions
 */
export function applyPersistedStates(
  actions: ActionItem[],
  datasetId: string
): ActionItem[] {
  const store = loadActionStates(datasetId);
  if (!store) return actions;

  return actions.map(action => {
    const persisted = store.actions[action.action_id];
    if (persisted) {
      return { ...action, status: persisted.status };
    }
    return action;
  });
}

/**
 * Clear all persisted states for a dataset
 */
export function clearActionStates(datasetId: string): void {
  try {
    const key = getStorageKey(datasetId);
    localStorage.removeItem(key);
  } catch (e) {
    console.warn('Failed to clear action states:', e);
  }
}

// ===== MAIN GENERATION FUNCTION =====

export interface ActionGenerationContext {
  hmActions: HMPendingAction[];
  explanations: Map<ExplainProviderId, Explanation>;
  requisitions: Requisition[];
  users: User[];
  datasetId: string;
}

/**
 * Generate unified action queue from all sources
 */
export function generateUnifiedActionQueue(context: ActionGenerationContext): ActionItem[] {
  const { hmActions, explanations, requisitions, users, datasetId } = context;

  // Generate from both sources
  const hmGeneratedActions = generateActionsFromHMQueue(hmActions, requisitions);
  const explainGeneratedActions = generateActionsFromExplain(explanations, requisitions, users);

  // Combine and deduplicate
  const allActions = [...hmGeneratedActions, ...explainGeneratedActions];
  const dedupedActions = deduplicateActions(allActions);

  // Apply persisted states
  const withStates = applyPersistedStates(dedupedActions, datasetId);

  // Sort by priority then due date
  const sortedActions = sortActions(withStates);

  return sortedActions;
}

/**
 * Get actions filtered to only OPEN status
 */
export function getOpenActions(actions: ActionItem[]): ActionItem[] {
  return actions.filter(a => a.status === 'OPEN');
}

/**
 * Get action counts by owner type
 */
export function getActionCounts(actions: ActionItem[]): Record<ActionOwnerType | 'ALL', number> {
  const open = getOpenActions(actions);
  return {
    ALL: open.length,
    RECRUITER: open.filter(a => a.owner_type === 'RECRUITER').length,
    HIRING_MANAGER: open.filter(a => a.owner_type === 'HIRING_MANAGER').length,
    TA_OPS: open.filter(a => a.owner_type === 'TA_OPS').length,
  };
}

/**
 * Merge scenario-generated actions into the persisted store
 * Only adds new actions (by action_id) that don't already exist
 */
export async function mergeScenarioActions(
  scenarioActions: ActionItem[],
  datasetId: string
): Promise<void> {
  const existing = loadActionStates(datasetId);
  const existingIds = existing ? new Set(Object.keys(existing.actions)) : new Set<string>();

  // Filter to only new actions
  const newActions = scenarioActions.filter(a => !existingIds.has(a.action_id));

  if (newActions.length === 0) {
    return;
  }

  // Save each new action as OPEN
  for (const action of newActions) {
    saveActionState(datasetId, action.action_id, 'OPEN');
  }
}
