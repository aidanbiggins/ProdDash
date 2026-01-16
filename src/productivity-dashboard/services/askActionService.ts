// Ask Action Service
// Create actions from Ask ProdDash suggestions with deduplication and evidence attachment

import { ActionItem, ActionPriority, ActionOwnerType, ActionType, ActionEvidence, generateActionId } from '../types/actionTypes';
import { AskFactPack, FactCitation } from '../types/askTypes';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface ActionSuggestion {
  title: string;
  description: string;
  ownerType: ActionOwnerType;
  ownerId: string;
  ownerName: string;
  reqId: string | null;
  reqTitle: string | null;
  priority: ActionPriority;
  actionType: ActionType;
  citations: FactCitation[];  // Evidence from Ask response
}

export interface ActionCreationResult {
  success: boolean;
  action?: ActionItem;
  isDuplicate: boolean;
  existingActionId?: string;
  error?: string;
}

// ─────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────

/**
 * Map action type to explain provider key for evidence linking
 */
function mapActionTypeToExplainProvider(actionType: ActionType): string {
  const hmLatencyActions: ActionType[] = ['FEEDBACK_DUE', 'REVIEW_DUE', 'DECISION_DUE'];
  const reqHealthActions: ActionType[] = ['REVIEW_STALLED_REQS', 'REVIEW_ZOMBIE_REQS'];

  if (hmLatencyActions.includes(actionType)) return 'hm_latency';
  if (actionType === 'SOURCE_CANDIDATES') return 'pipeline_health';
  if (reqHealthActions.includes(actionType)) return 'req_health';
  return 'general';
}

// ─────────────────────────────────────────────────────────────
// Duplicate Detection
// ─────────────────────────────────────────────────────────────

/**
 * Check if an action already exists in the action queue
 * Duplicates are detected by matching owner + req + action type
 */
export function checkActionDuplicate(
  suggestion: ActionSuggestion,
  existingActions: ActionItem[]
): { isDuplicate: boolean; existingActionId?: string } {
  // Generate the deterministic ID for this suggestion
  const suggestedId = generateActionId(
    suggestion.ownerType,
    suggestion.ownerId,
    suggestion.reqId || 'general',
    suggestion.actionType
  );

  // Check if this ID already exists
  const existing = existingActions.find(a => a.action_id === suggestedId);

  if (existing) {
    return {
      isDuplicate: true,
      existingActionId: existing.action_id,
    };
  }

  // Also check for similar actions (same owner, req, and similar type)
  const similar = existingActions.find(a =>
    a.owner_type === suggestion.ownerType &&
    a.owner_id === suggestion.ownerId &&
    a.req_id === (suggestion.reqId || 'general') &&
    a.status === 'OPEN'
  );

  if (similar) {
    return {
      isDuplicate: true,
      existingActionId: similar.action_id,
    };
  }

  return { isDuplicate: false };
}

// ─────────────────────────────────────────────────────────────
// Action Creation
// ─────────────────────────────────────────────────────────────

/**
 * Create a new action from an Ask ProdDash suggestion
 * Includes evidence from the citations
 */
export function createActionFromSuggestion(
  suggestion: ActionSuggestion,
  existingActions: ActionItem[],
  datasetId: string
): ActionCreationResult {
  // Check for duplicates first
  const duplicateCheck = checkActionDuplicate(suggestion, existingActions);

  if (duplicateCheck.isDuplicate) {
    return {
      success: false,
      isDuplicate: true,
      existingActionId: duplicateCheck.existingActionId,
      error: `Action already exists (${duplicateCheck.existingActionId})`,
    };
  }

  // Generate the action
  const actionId = generateActionId(
    suggestion.ownerType,
    suggestion.ownerId,
    suggestion.reqId || 'general',
    suggestion.actionType
  );

  // Build evidence from citations
  // Map action type to explain provider key
  const explainProviderKey = mapActionTypeToExplainProvider(suggestion.actionType);

  // Build short reason from citations
  const shortReason = suggestion.citations.length > 0
    ? suggestion.citations.map(c => `${c.label}: ${c.value}`).join('; ')
    : suggestion.description;

  const evidence: ActionEvidence = {
    kpi_key: suggestion.actionType.toLowerCase(),
    explain_provider_key: explainProviderKey,
    short_reason: shortReason,
  };

  // Build recommended steps from the suggestion
  const recommendedSteps = buildRecommendedSteps(suggestion);

  const action: ActionItem = {
    action_id: actionId,
    owner_type: suggestion.ownerType,
    owner_id: suggestion.ownerId,
    owner_name: suggestion.ownerName,
    req_id: suggestion.reqId || 'general',
    req_title: suggestion.reqTitle || undefined,
    action_type: suggestion.actionType,
    title: suggestion.title,
    priority: suggestion.priority,
    due_in_days: calculateDueInDays(suggestion.priority),
    due_date: calculateDueDate(suggestion.priority),
    evidence,
    recommended_steps: recommendedSteps,
    created_at: new Date(),
    status: 'OPEN',
  };

  return {
    success: true,
    action,
    isDuplicate: false,
  };
}

/**
 * Build recommended steps based on action type
 */
function buildRecommendedSteps(suggestion: ActionSuggestion): string[] {
  const steps: string[] = [];

  switch (suggestion.actionType) {
    case 'FEEDBACK_DUE':
      steps.push('Review candidate profile and interview notes');
      steps.push('Submit feedback in ATS');
      steps.push('Communicate decision to recruiter');
      break;

    case 'REVIEW_DUE':
      steps.push('Review submitted resumes');
      steps.push('Provide feedback on each candidate');
      steps.push('Select candidates for next stage');
      break;

    case 'DECISION_DUE':
      steps.push('Review interview feedback from team');
      steps.push('Make hiring decision');
      steps.push('Communicate decision to recruiter');
      break;

    case 'SOURCE_CANDIDATES':
      steps.push('Review req requirements and ideal candidate profile');
      steps.push('Search LinkedIn and other channels');
      steps.push('Reach out to potential candidates');
      steps.push('Add sourced candidates to ATS');
      break;

    case 'REVIEW_STALLED_REQS':
      steps.push('Check pipeline status and candidate activity');
      steps.push('Identify blockers (HM feedback, sourcing, etc.)');
      steps.push('Take action to unblock or escalate');
      break;

    case 'REVIEW_ZOMBIE_REQS':
      steps.push('Review req status and age');
      steps.push('Discuss with hiring manager');
      steps.push('Decide to revive sourcing or close req');
      break;

    default:
      steps.push('Review the action details');
      steps.push('Take appropriate action');
      steps.push('Update status when complete');
  }

  return steps;
}

/**
 * Calculate due in days based on priority
 */
function calculateDueInDays(priority: ActionPriority): number {
  const dueInDaysMap: Record<ActionPriority, number> = { P0: 0, P1: 3, P2: 7 };
  return dueInDaysMap[priority] ?? 7;
}

/**
 * Calculate due date based on priority
 */
function calculateDueDate(priority: ActionPriority): Date {
  const dueInDays = calculateDueInDays(priority);
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + dueInDays);
  return dueDate;
}

// ─────────────────────────────────────────────────────────────
// Evidence Extraction
// ─────────────────────────────────────────────────────────────

/**
 * Extract an action suggestion from a citation
 * Used when user clicks "Create Action" on a specific citation
 */
export function extractActionFromCitation(
  citation: FactCitation,
  factPack: AskFactPack,
  reverseAnonymizationMap: Map<string, string>
): ActionSuggestion | null {
  const keyPath = citation.key_path;

  // Parse the key path to determine action type
  if (keyPath.startsWith('actions.top_p0') || keyPath.startsWith('actions.top_p1')) {
    // This is already an action - extract it
    const match = keyPath.match(/actions\.top_p(\d)\[(\d+)\]/);
    if (match) {
      const priority = match[1] === '0' ? 'P0' : 'P1';
      const index = parseInt(match[2]);
      const actionList = priority === 'P0' ? factPack.actions.top_p0 : factPack.actions.top_p1;
      const action = actionList[index];

      if (action) {
        // De-anonymize the owner if possible
        const realOwnerId = reverseAnonymizationMap.get(action.owner_label) || action.owner_label;

        return {
          title: action.title,
          description: `Action from Ask ProdDash: ${action.title}`,
          ownerType: action.owner_type,
          ownerId: realOwnerId,
          ownerName: action.owner_label,
          reqId: action.req_id,
          reqTitle: action.req_title,
          priority: action.priority,
          actionType: action.action_type as ActionType,
          citations: [citation],
        };
      }
    }
  }

  if (keyPath.startsWith('risks.top_risks')) {
    // Create action to address this risk
    const match = keyPath.match(/risks\.top_risks\[(\d+)\]/);
    if (match) {
      const index = parseInt(match[1]);
      const risk = factPack.risks.top_risks[index];

      if (risk) {
        const realOwnerId = reverseAnonymizationMap.get(risk.owner_label) || risk.owner_label;

        // Determine action type based on risk type
        let actionType: ActionType = 'REVIEW_STALLED_REQS';
        if (risk.risk_type === 'zombie') {
          actionType = 'REVIEW_ZOMBIE_REQS';
        } else if (risk.risk_type === 'pipeline_gap') {
          actionType = 'SOURCE_CANDIDATES';
        } else if (risk.risk_type === 'hm_delay') {
          actionType = 'FEEDBACK_DUE';
        }

        return {
          title: `Address risk: ${risk.req_title}`,
          description: `${risk.failure_mode} - ${risk.top_driver}`,
          ownerType: 'RECRUITER',
          ownerId: realOwnerId,
          ownerName: risk.owner_label,
          reqId: risk.req_id,
          reqTitle: risk.req_title,
          priority: 'P1',
          actionType,
          citations: [citation],
        };
      }
    }
  }

  // Can't extract an action from this citation
  return null;
}

// ─────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────

export {
  buildRecommendedSteps,
  calculateDueInDays,
  calculateDueDate,
};
