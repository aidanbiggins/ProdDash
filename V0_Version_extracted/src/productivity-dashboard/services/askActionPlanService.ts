// Ask Action Plan Service
// Extracts actionable items from Ask responses and creates Action Queue items

import {
  ActionItem,
  ActionOwnerType,
  ActionPriority,
  ActionType,
  ActionStatus,
  generateActionId,
} from '../types/actionTypes';
import { IntentResponse, FactCitation } from '../types/askTypes';

// ===== TYPES =====

export interface ExtractedAction {
  title: string;
  owner_type: ActionOwnerType;
  owner_name: string;
  priority: ActionPriority;
  req_id?: string;
  req_title?: string;
  reason: string;
  source_citation?: FactCitation;
}

export interface ActionPlanResult {
  actions: ActionItem[];
  duplicatesSkipped: number;
  totalExtracted: number;
}

// ===== ACTION EXTRACTION PATTERNS =====

// Action verb list - imperative verbs that start actionable items
const ACTION_VERBS = [
  'Review', 'Follow up', 'Source', 'Check', 'Investigate', 'Speed up', 'Streamline',
  'Contact', 'Escalate', 'Address', 'Fix', 'Resolve', 'Update', 'Close', 'Revive',
  'Triage', 'Prioritize', 'Increase', 'Reduce', 'Improve', 'Analyze', 'Monitor',
  'Schedule', 'Send', 'Create', 'Add', 'Remove', 'Optimize', 'Track', 'Focus',
  'Identify', 'Target', 'Expand', 'Accelerate', 'Instrument', 'Enable', 'Consider',
];
const ACTION_VERB_PATTERN = ACTION_VERBS.join('|');

// Patterns that indicate action items in markdown
const ACTION_PATTERNS = [
  // Direct imperative patterns
  /(?:^|\n)\s*[-*]\s*\*\*([^*]+)\*\*[:\s]+(.+)/gm,  // **Bold title**: description
  /(?:^|\n)\s*\d+\.\s*\*\*([^*]+)\*\*[:\s]+(.+)/gm, // 1. **Bold title**: description
  new RegExp(`(?:^|\\n)\\s*[-*]\\s*(${ACTION_VERB_PATTERN})(.+)`, 'gim'),
  new RegExp(`(?:^|\\n)\\s*\\d+\\.\\s*(${ACTION_VERB_PATTERN})(.+)`, 'gim'),
];

// Keywords to determine owner type
const OWNER_KEYWORDS: Record<ActionOwnerType, string[]> = {
  'HIRING_MANAGER': ['hm', 'hiring manager', 'manager feedback', 'interview feedback', 'decision', 'approval'],
  'RECRUITER': ['recruiter', 'source', 'pipeline', 'candidate', 'outreach', 'screen', 'follow up', 'offer'],
  'TA_OPS': ['process', 'system', 'data', 'hygiene', 'optimize', 'analyze'],
};

// Keywords to determine priority
const PRIORITY_KEYWORDS: Record<ActionPriority, string[]> = {
  'P0': ['urgent', 'critical', 'blocking', 'overdue', 'fire', 'immediately', 'asap', 'p0', 'zombie', '🔴'],
  'P1': ['high', 'soon', 'risk', 'stalled', 'delayed', 'p1', '🟡'],
  'P2': ['optimize', 'improve', 'consider', 'nice to have', 'p2', '🟢'],
};

// Map action text to ActionType
const ACTION_TYPE_PATTERNS: Array<{ pattern: RegExp; type: ActionType }> = [
  { pattern: /feedback|interview review/i, type: 'FEEDBACK_DUE' },
  { pattern: /resume review|screen/i, type: 'REVIEW_DUE' },
  { pattern: /decision|approve|reject/i, type: 'DECISION_DUE' },
  { pattern: /zombie|inactive.*30/i, type: 'REVIEW_ZOMBIE_REQS' },
  { pattern: /stalled|inactive/i, type: 'REVIEW_STALLED_REQS' },
  { pattern: /source|pipeline empty|candidate/i, type: 'SOURCE_CANDIDATES' },
  { pattern: /speed up|accelerate|outreach/i, type: 'SPEED_UP_ENGAGEMENT' },
  { pattern: /streamline|process/i, type: 'STREAMLINE_PROCESS' },
  { pattern: /offer.*follow|pending offer/i, type: 'FOLLOW_UP_OFFERS' },
  { pattern: /declined|reject.*offer/i, type: 'REVIEW_DECLINED_OFFERS' },
  { pattern: /source.*quality|investigate.*source/i, type: 'INVESTIGATE_SOURCE' },
  { pattern: /pipeline health/i, type: 'PIPELINE_HEALTH_CHECK' },
  { pattern: /data.*hygiene|clean/i, type: 'DATA_HYGIENE' },
];

// ===== EXTRACTION FUNCTIONS =====

/**
 * Determine owner type from action text
 */
function determineOwnerType(text: string): ActionOwnerType {
  const lowerText = text.toLowerCase();

  for (const [ownerType, keywords] of Object.entries(OWNER_KEYWORDS)) {
    if (keywords.some(kw => lowerText.includes(kw))) {
      return ownerType as ActionOwnerType;
    }
  }

  return 'RECRUITER';
}

/**
 * Determine priority from action text
 */
function determinePriority(text: string): ActionPriority {
  const lowerText = text.toLowerCase();

  for (const [priority, keywords] of Object.entries(PRIORITY_KEYWORDS)) {
    if (keywords.some(kw => lowerText.includes(kw))) {
      return priority as ActionPriority;
    }
  }

  return 'P1'; // Default to medium priority
}

/**
 * Map action text to ActionType
 */
function determineActionType(text: string): ActionType {
  for (const { pattern, type } of ACTION_TYPE_PATTERNS) {
    if (pattern.test(text)) {
      return type;
    }
  }
  return 'PROCESS_OPTIMIZATION';
}

/**
 * Extract req ID from citation or text
 */
function extractReqInfo(text: string, citations: FactCitation[]): { req_id?: string; req_title?: string } {
  // Look for REQ-XXX pattern
  const reqMatch = text.match(/REQ[-_]?\d+/i);
  if (reqMatch) {
    return { req_id: reqMatch[0].toUpperCase() };
  }

  // Look in citations for req references
  for (const citation of citations) {
    if (citation.key_path.includes('req')) {
      const idMatch = citation.label.match(/REQ[-_]?\d+/i);
      if (idMatch) {
        return { req_id: idMatch[0].toUpperCase(), req_title: citation.label };
      }
    }
  }

  return {};
}

/**
 * Get owner name from owner type
 */
function getOwnerName(ownerType: ActionOwnerType): string {
  const ownerNames: Record<ActionOwnerType, string> = {
    HIRING_MANAGER: 'Hiring Manager Team',
    RECRUITER: 'Recruiting Team',
    TA_OPS: 'TA Operations',
  };

  return ownerNames[ownerType];
}

/**
 * Extract actions from markdown content
 */
function extractActionsFromMarkdown(
  markdown: string,
  citations: FactCitation[]
): ExtractedAction[] {
  const actions: ExtractedAction[] = [];
  const seenTitles = new Set<string>();

  // Split into lines and look for action patterns
  const lines = markdown.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Skip empty lines, headers, and non-action content
    if (!line || line.startsWith('#') || line.startsWith('|') || line.startsWith('---')) {
      continue;
    }

    // Check for list items with bold titles (most common pattern)
    const boldMatch = line.match(/^[-*]\s*\*\*([^*]+)\*\*[:\s]*(.*)/) ||
                      line.match(/^\d+\.\s*\*\*([^*]+)\*\*[:\s]*(.*)/);

    if (boldMatch) {
      const title = boldMatch[1].trim();
      const description = boldMatch[2].trim();

      // Skip if we've seen this title
      if (seenTitles.has(title.toLowerCase())) continue;
      seenTitles.add(title.toLowerCase());

      const fullText = `${title} ${description}`;
      const ownerType = determineOwnerType(fullText);
      const priority = determinePriority(fullText);
      const reqInfo = extractReqInfo(fullText, citations);

      actions.push({
        title: title.length > 60 ? title.substring(0, 57) + '...' : title,
        owner_type: ownerType,
        owner_name: getOwnerName(ownerType),
        priority,
        reason: description || `Extracted from: "${title}"`,
        ...reqInfo,
      });
      continue;
    }

    // Check for imperative action lines using expanded verb list
    const actionVerbRegex1 = new RegExp(`^[-*]\\s*(${ACTION_VERB_PATTERN})\\s+(.+)`, 'i');
    const actionVerbRegex2 = new RegExp(`^\\d+\\.\\s*(${ACTION_VERB_PATTERN})\\s+(.+)`, 'i');
    const actionMatch = line.match(actionVerbRegex1) || line.match(actionVerbRegex2);

    if (actionMatch) {
      const verb = actionMatch[1];
      const rest = actionMatch[2].replace(/\[\d+\]/g, '').trim(); // Remove citation refs
      const title = `${verb} ${rest}`.substring(0, 60);

      // Skip if we've seen this title
      if (seenTitles.has(title.toLowerCase())) continue;
      seenTitles.add(title.toLowerCase());

      const ownerType = determineOwnerType(title);
      const priority = determinePriority(title);
      const reqInfo = extractReqInfo(title, citations);

      actions.push({
        title,
        owner_type: ownerType,
        owner_name: getOwnerName(ownerType),
        priority,
        reason: `Action identified from response`,
        ...reqInfo,
      });
    }
  }

  // Also extract from action-related sections (Recommended Actions, Immediate next steps, etc.)
  const actionSectionPatterns = [
    /###?\s*Recommended Actions[\s\S]*?(?=###|\n\n\n|$)/i,
    /###?\s*Immediate next steps[\s\S]*?(?=###|\n\n\n|$)/i,
    /###?\s*Next steps[\s\S]*?(?=###|\n\n\n|$)/i,
    /###?\s*Actions[\s\S]*?(?=###|\n\n\n|$)/i,
    /###?\s*To-?do[\s\S]*?(?=###|\n\n\n|$)/i,
  ];

  for (const pattern of actionSectionPatterns) {
    const sectionMatch = markdown.match(pattern);
    if (sectionMatch) {
      const section = sectionMatch[0];
      const sectionLines = section.split('\n').filter(l => l.match(/^[-*\d]/));

      for (const line of sectionLines) {
        const cleanLine = line.replace(/^[-*\d.]+\s*/, '').replace(/\[\d+\]/g, '').trim();
        if (!cleanLine || seenTitles.has(cleanLine.toLowerCase())) continue;

        const title = cleanLine.length > 60 ? cleanLine.substring(0, 57) + '...' : cleanLine;
        seenTitles.add(cleanLine.toLowerCase());

        const ownerType = determineOwnerType(cleanLine);
        const priority = determinePriority(cleanLine);

        actions.push({
          title,
          owner_type: ownerType,
          owner_name: getOwnerName(ownerType),
          priority,
          reason: 'From action section',
        });
      }
    }
  }

  return actions;
}

/**
 * Convert extracted actions to ActionItems
 */
function convertToActionItems(
  extracted: ExtractedAction[],
  query: string
): ActionItem[] {
  const now = new Date();

  return extracted.map(action => {
    const action_type = determineActionType(action.title);
    const owner_id = action.owner_type.toLowerCase() + '_team';
    const req_id = action.req_id || 'general';

    const action_id = generateActionId(
      action.owner_type,
      owner_id,
      req_id,
      action_type
    );

    // Calculate due date based on priority
    const due_in_days = action.priority === 'P0' ? 1 : action.priority === 'P1' ? 3 : 7;
    const due_date = new Date(now.getTime() + due_in_days * 24 * 60 * 60 * 1000);

    return {
      action_id,
      owner_type: action.owner_type,
      owner_id,
      owner_name: action.owner_name,
      req_id,
      req_title: action.req_title,
      action_type,
      title: action.title,
      priority: action.priority,
      due_in_days,
      due_date,
      evidence: {
        kpi_key: 'ask_generated',
        explain_provider_key: 'ask_platovue',
        short_reason: action.reason,
      },
      recommended_steps: [action.title],
      created_at: now,
      status: 'OPEN' as ActionStatus,
    };
  });
}

/**
 * Normalize title for deduplication comparison
 * Removes punctuation, extra spaces, and lowercases
 */
function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .replace(/\s+/g, ' ')    // Collapse whitespace
    .trim()
    .substring(0, 40);       // Use first 40 chars for comparison
}

/**
 * Deduplicate against existing actions
 * Uses title + owner_type for comparison to allow different actions of same type
 */
function deduplicateAgainstExisting(
  newActions: ActionItem[],
  existingActions: ActionItem[]
): { actions: ActionItem[]; duplicatesSkipped: number } {
  // Use normalized title + owner_type for more specific matching
  const existingKeys = new Set(
    existingActions.map(a => `${a.owner_type}:${normalizeTitle(a.title)}`)
  );

  const unique: ActionItem[] = [];
  let duplicatesSkipped = 0;

  for (const action of newActions) {
    const key = `${action.owner_type}:${normalizeTitle(action.title)}`;
    if (!existingKeys.has(key)) {
      unique.push(action);
      existingKeys.add(key); // Prevent duplicates within new actions too
    } else {
      duplicatesSkipped++;
    }
  }

  return { actions: unique, duplicatesSkipped };
}

// ===== MAIN EXPORT =====

/**
 * Create an action plan from an Ask response
 *
 * @param response - The IntentResponse from Ask PlatoVue
 * @param existingActions - Current actions in the queue for deduplication
 * @param query - The original query for context
 * @param maxActions - Maximum actions to return (default 5)
 * @returns ActionPlanResult with deduplicated actions
 */
export function createActionPlanFromResponse(
  response: IntentResponse,
  existingActions: ActionItem[],
  query: string,
  maxActions: number = 5
): ActionPlanResult {
  // Extract actions from the response markdown
  const extracted = extractActionsFromMarkdown(
    response.answer_markdown,
    response.citations
  );

  const totalExtracted = extracted.length;

  // Convert to ActionItems
  const actionItems = convertToActionItems(extracted, query);

  // Deduplicate against existing
  const { actions: dedupedActions, duplicatesSkipped } = deduplicateAgainstExisting(
    actionItems,
    existingActions
  );

  // Sort by priority and limit
  const sortedActions = dedupedActions
    .sort((a, b) => {
      const priorityOrder = { 'P0': 0, 'P1': 1, 'P2': 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    })
    .slice(0, maxActions);

  return {
    actions: sortedActions,
    duplicatesSkipped,
    totalExtracted,
  };
}

/**
 * Check if a response is likely to have extractable actions
 */
export function responseHasActionableContent(response: IntentResponse): boolean {
  const markdown = response.answer_markdown.toLowerCase();

  // Check for action-indicating patterns
  const hasActions =
    markdown.includes('recommend') ||
    markdown.includes('action') ||
    markdown.includes('should') ||
    markdown.includes('follow up') ||
    markdown.includes('review') ||
    markdown.includes('investigate') ||
    markdown.includes('source') ||
    markdown.includes('address') ||
    /[-*]\s*\*\*/.test(response.answer_markdown) || // Bold list items
    /\d+\.\s*\*\*/.test(response.answer_markdown);   // Numbered bold items

  return hasActions;
}
