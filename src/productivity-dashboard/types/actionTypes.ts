// Unified Action Queue Types
// Types for the consolidated action queue across Recruiter, HM, and TA Ops

/**
 * Owner type for actions
 */
export type ActionOwnerType = 'RECRUITER' | 'HIRING_MANAGER' | 'TA_OPS';

/**
 * Priority levels for actions
 * P0: Blocking - immediate attention required
 * P1: Risk - should be addressed soon
 * P2: Optimization - nice to have improvements
 */
export type ActionPriority = 'P0' | 'P1' | 'P2';

/**
 * Status of an action
 */
export type ActionStatus = 'OPEN' | 'DONE' | 'DISMISSED';

/**
 * Action types - mapped from various sources
 */
export type ActionType =
  // HM Actions (mapped from HMActionType)
  | 'FEEDBACK_DUE'
  | 'REVIEW_DUE'
  | 'DECISION_DUE'
  // Recruiter Actions (from Explain providers)
  | 'REVIEW_STALLED_REQS'
  | 'REVIEW_ZOMBIE_REQS'
  | 'SOURCE_CANDIDATES'
  | 'SPEED_UP_ENGAGEMENT'
  | 'STREAMLINE_PROCESS'
  | 'FOLLOW_UP_OFFERS'
  | 'REVIEW_DECLINED_OFFERS'
  | 'INVESTIGATE_SOURCE'
  // TA Ops Actions
  | 'PIPELINE_HEALTH_CHECK'
  | 'PROCESS_OPTIMIZATION'
  | 'DATA_HYGIENE';

/**
 * Evidence linking an action to an Explain KPI
 */
export interface ActionEvidence {
  kpi_key: string;              // e.g., 'median_ttf', 'stalled_reqs'
  explain_provider_key: string; // Maps to ExplainProviderId
  short_reason: string;         // Brief explanation (e.g., "Median 46d exceeds 45d target")
}

/**
 * Core ActionItem type - used throughout the unified queue
 */
export interface ActionItem {
  // === Identity ===
  action_id: string;            // Stable, deterministic ID (hash of key fields)

  // === Owner ===
  owner_type: ActionOwnerType;
  owner_id: string;             // User ID of owner
  owner_name: string;           // Display name

  // === Context ===
  req_id: string;               // Associated requisition
  req_title?: string;           // Requisition title for display
  application_id?: string;      // Optional: specific application/candidate
  candidate_name?: string;      // Optional: candidate name for display

  // === Action Details ===
  action_type: ActionType;
  title: string;                // Short action title (e.g., "Review stalled reqs")

  // === Priority & Timing ===
  priority: ActionPriority;
  due_in_days: number;          // Days until action is due/overdue
  due_date: Date;               // Computed due date

  // === Evidence ===
  evidence: ActionEvidence;

  // === Guidance ===
  recommended_steps: string[];  // List of suggested steps to resolve

  // === Status & Timestamps ===
  created_at: Date;
  status: ActionStatus;

  // === Filter State (optional, set by UI) ===
  matchesFilter?: boolean;  // Whether this action matches current dashboard filters
}

/**
 * Persisted action state (stored in localStorage)
 */
export interface PersistedActionState {
  action_id: string;
  status: ActionStatus;
  updated_at: string;           // ISO date string
}

/**
 * LocalStorage structure for action states
 * Keyed by dataset_id to isolate different data sets
 */
export interface ActionStateStore {
  dataset_id: string;
  actions: Record<string, PersistedActionState>;  // action_id -> state
  last_updated: string;         // ISO date string
}

/**
 * Filter options for the unified action queue
 */
export type ActionQueueFilter = 'ALL' | 'RECRUITER' | 'HIRING_MANAGER' | 'TA_OPS';

/**
 * Sort options for the action queue
 */
export type ActionQueueSort = 'PRIORITY_DUE' | 'DUE_DATE' | 'OWNER';

/**
 * Mapping from action priority to sort order
 */
export const PRIORITY_ORDER: Record<ActionPriority, number> = {
  'P0': 0,
  'P1': 1,
  'P2': 2,
};

/**
 * Priority display metadata
 */
export const PRIORITY_META: Record<ActionPriority, { label: string; color: string; bgColor: string }> = {
  'P0': { label: 'Blocking', color: '#ef4444', bgColor: 'rgba(239, 68, 68, 0.15)' },
  'P1': { label: 'Risk', color: '#f59e0b', bgColor: 'rgba(245, 158, 11, 0.15)' },
  'P2': { label: 'Optimize', color: '#22c55e', bgColor: 'rgba(34, 197, 94, 0.15)' },
};

/**
 * Owner type display metadata
 */
export const OWNER_TYPE_META: Record<ActionOwnerType, { label: string; shortLabel: string; color: string }> = {
  'RECRUITER': { label: 'Recruiter', shortLabel: 'Rec', color: '#3b82f6' },
  'HIRING_MANAGER': { label: 'Hiring Manager', shortLabel: 'HM', color: '#8b5cf6' },
  'TA_OPS': { label: 'TA Ops', shortLabel: 'Ops', color: '#06b6d4' },
};

/**
 * Generate a deterministic action ID from key fields
 */
export function generateActionId(
  owner_type: ActionOwnerType,
  owner_id: string,
  req_id: string,
  action_type: ActionType
): string {
  // Simple hash - stable and deterministic
  const key = `${owner_type}:${owner_id}:${req_id}:${action_type}`;
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    const char = key.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return `action_${Math.abs(hash).toString(36)}`;
}
