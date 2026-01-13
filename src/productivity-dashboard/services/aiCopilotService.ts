// AI Copilot Service
// Handles AI-powered features: Explain Summary and Draft Message
// IMPORTANT: All data is redacted before sending to AI providers

import { Explanation, ContributingRecord, RecommendedAction } from '../types/explainTypes';
import { ActionItem } from '../types/actionTypes';
import { AiProviderConfig, AiMessage } from '../types/aiTypes';
import { sendAiRequest } from './aiService';

// ===== REDACTION =====

/**
 * Redact PII from a contributor record for AI context
 * Replaces names with generic identifiers
 */
function redactContributor(contributor: ContributingRecord, index: number): string {
  return `Record ${index + 1}: ${contributor.value !== null ? `${contributor.value} days` : 'N/A'}`;
}

/**
 * Redact names from recommended actions
 */
function redactAction(action: RecommendedAction): string {
  return `[${action.priority.toUpperCase()}] ${action.action}${action.reason ? ` - ${action.reason}` : ''}`;
}

/**
 * Convert an Explanation object to redacted text for AI input
 * This removes all PII (names, IDs) while preserving metric insights
 */
export function explanationToRedactedText(explanation: Explanation): string {
  const lines: string[] = [];

  // Header
  lines.push(`METRIC: ${explanation.metricLabel}`);
  lines.push(`STATUS: ${explanation.status.toUpperCase()}`);
  lines.push('');

  // Value section
  if (explanation.status !== 'blocked' && explanation.value !== null) {
    lines.push(`VALUE: ${explanation.value} ${explanation.unit}`);
    if (explanation.benchmark) {
      lines.push(`BENCHMARK (${explanation.benchmark.label}): ${explanation.benchmark.value} ${explanation.unit}`);
    }
    lines.push('');
  }

  // Formula
  lines.push(`FORMULA: ${explanation.formula}`);
  lines.push('');

  // Breakdown (if available)
  if (explanation.breakdown && explanation.breakdown.length > 0) {
    lines.push('BREAKDOWN:');
    explanation.breakdown.forEach(row => {
      lines.push(`  - ${row.label}: ${row.value !== null ? `${row.value} ${row.unit}` : 'N/A'}`);
    });
    lines.push('');
  }

  // Data inclusion stats
  lines.push(`DATA: ${explanation.includedCount} records included, ${explanation.excludedCount} excluded`);
  if (explanation.exclusionReasons.length > 0) {
    lines.push('EXCLUSION REASONS:');
    explanation.exclusionReasons.forEach(er => {
      lines.push(`  - ${er.count} ${er.reason}`);
    });
  }
  lines.push('');

  // Confidence
  if (explanation.confidenceGrade) {
    lines.push(`CONFIDENCE: ${explanation.confidenceGrade.toUpperCase()}${explanation.confidenceNote ? ` - ${explanation.confidenceNote}` : ''}`);
    lines.push('');
  }

  // Top contributors (redacted)
  if (explanation.topContributors && explanation.topContributors.length > 0) {
    lines.push('TOP CONTRIBUTORS (longest durations):');
    explanation.topContributors.slice(0, 5).forEach((contrib, idx) => {
      lines.push(`  ${redactContributor(contrib, idx)}`);
    });
    lines.push('');
  }

  // Recommended actions
  if (explanation.recommendedActions && explanation.recommendedActions.length > 0) {
    lines.push('RECOMMENDED ACTIONS:');
    explanation.recommendedActions.forEach(action => {
      lines.push(`  ${redactAction(action)}`);
    });
    lines.push('');
  }

  // Blocked reasons
  if (explanation.status === 'blocked' && explanation.blockedReasons) {
    lines.push('BLOCKED REASONS:');
    explanation.blockedReasons.forEach(reason => {
      lines.push(`  - ${reason.code}: ${reason.message}${reason.sampleCount ? ` (${reason.sampleCount} records)` : ''}`);
    });
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Convert an ActionItem to redacted text for AI input
 * Removes candidate names, req titles, and owner names
 */
export function actionToRedactedText(action: ActionItem): string {
  const lines: string[] = [];

  lines.push(`ACTION: ${action.title}`);
  lines.push(`TYPE: ${action.action_type.replace(/_/g, ' ')}`);
  lines.push(`PRIORITY: ${action.priority} (${action.priority === 'P0' ? 'Blocking' : action.priority === 'P1' ? 'Risk' : 'Optimize'})`);
  lines.push(`OWNER TYPE: ${action.owner_type.replace(/_/g, ' ')}`);
  lines.push(`DUE: ${action.due_in_days <= 0 ? 'OVERDUE' : `In ${action.due_in_days} days`}`);
  lines.push('');

  lines.push('EVIDENCE:');
  lines.push(`  KPI: ${action.evidence.kpi_key}`);
  lines.push(`  Reason: ${action.evidence.short_reason}`);
  lines.push('');

  if (action.recommended_steps.length > 0) {
    lines.push('RECOMMENDED STEPS:');
    action.recommended_steps.forEach((step, idx) => {
      lines.push(`  ${idx + 1}. ${step}`);
    });
  }

  return lines.join('\n');
}

// ===== AI SUMMARY =====

export interface AiSummaryResult {
  summary: string;
  bullets: string[];
  error?: string;
}

/**
 * Generate an AI summary of an Explanation
 * Returns a short summary + 3 bullet points
 */
export async function generateExplanationSummary(
  config: AiProviderConfig,
  explanation: Explanation
): Promise<AiSummaryResult> {
  // Redact the explanation to remove PII
  const redactedText = explanationToRedactedText(explanation);

  const systemPrompt = `You are a recruiting analytics assistant. Your job is to summarize metric explanations for talent acquisition leaders in a clear, actionable way.

Guidelines:
- Be concise and direct
- Focus on what matters for decision-making
- Use plain language, avoid jargon
- Highlight any concerning trends or issues
- If the metric is blocked, explain what's missing and why it matters`;

  const userPrompt = `Please summarize this recruiting metric explanation:

${redactedText}

Respond in exactly this format:
SUMMARY: [One sentence summary of the metric and its current state]

KEY INSIGHTS:
- [First key insight or takeaway]
- [Second key insight or concern]
- [Third recommended action or note]`;

  const messages: AiMessage[] = [
    { role: 'user', content: userPrompt }
  ];

  try {
    const response = await sendAiRequest(config, messages, {
      systemPrompt,
      taskType: 'explain_summary'
    });

    if (response.error) {
      return {
        summary: '',
        bullets: [],
        error: response.error.message
      };
    }

    // Parse the response
    const content = response.content;
    // Note: Using [\s\S] instead of 's' flag for broader compatibility
    const summaryMatch = content.match(/SUMMARY:\s*([^\n]+)/i);
    const bulletsMatch = content.match(/KEY INSIGHTS:\s*([\s\S]+)/i);

    const summary = summaryMatch ? summaryMatch[1].trim() : content.split('\n')[0].trim();
    const bullets: string[] = [];

    if (bulletsMatch) {
      const bulletText = bulletsMatch[1];
      const bulletLines = bulletText.split('\n').filter(line => line.trim().startsWith('-'));
      bulletLines.forEach(line => {
        const cleaned = line.replace(/^-\s*/, '').trim();
        if (cleaned) bullets.push(cleaned);
      });
    }

    // Fallback: if parsing failed, extract any content
    if (!summary && bullets.length === 0) {
      return {
        summary: content.trim().substring(0, 200),
        bullets: [],
        error: undefined
      };
    }

    return {
      summary,
      bullets: bullets.slice(0, 3),
      error: undefined
    };
  } catch (err) {
    return {
      summary: '',
      bullets: [],
      error: err instanceof Error ? err.message : 'Unknown error'
    };
  }
}

// ===== DRAFT MESSAGE =====

export interface DraftMessageResult {
  draft: string;
  error?: string;
}

export type MessageChannel = 'slack' | 'email';

/**
 * Get action-specific context for better message generation
 */
function getActionContext(action: ActionItem): { senderRole: string; recipientRole: string; urgencyContext: string; specificAsk: string } {
  const isOverdue = action.due_in_days <= 0;
  const urgencyContext = isOverdue
    ? `This is OVERDUE by ${Math.abs(action.due_in_days)} day(s) - communicate urgency without being aggressive.`
    : action.due_in_days <= 2
    ? 'This is time-sensitive - convey importance.'
    : 'This is a friendly reminder.';

  // Determine sender/recipient based on owner type and action type
  const ownerType = action.owner_type;
  const actionType = action.action_type;

  let senderRole = 'a recruiter or TA operations team member';
  let recipientRole = 'the action owner';
  let specificAsk = 'complete the requested action';

  if (ownerType === 'HIRING_MANAGER' || actionType.includes('hm_')) {
    recipientRole = 'a hiring manager or HM team lead';
    if (actionType.includes('feedback')) {
      specificAsk = 'provide interview feedback or follow up with their team on pending feedback';
    } else if (actionType.includes('review')) {
      specificAsk = 'review resumes or candidate profiles';
    } else if (actionType.includes('decision')) {
      specificAsk = 'make a hiring decision';
    }
  } else if (ownerType === 'RECRUITER') {
    recipientRole = 'a fellow recruiter';
    if (actionType.includes('source')) {
      specificAsk = 'source candidates for an empty pipeline';
    } else if (actionType.includes('zombie') || actionType.includes('revive')) {
      specificAsk = 'review a stale requisition and either revive it or recommend closing';
    } else if (actionType.includes('follow_up')) {
      specificAsk = 'follow up with candidates or hiring managers';
    }
  } else if (ownerType === 'TA_OPS') {
    recipientRole = 'a TA operations team member';
    specificAsk = 'address this operational issue';
  }

  return { senderRole, recipientRole, urgencyContext, specificAsk };
}

/**
 * Generate a draft message for an action item
 * Creates a Slack or email message with placeholders
 */
export async function generateDraftMessage(
  config: AiProviderConfig,
  action: ActionItem,
  channel: MessageChannel = 'slack'
): Promise<DraftMessageResult> {
  // Redact the action to remove PII
  const redactedText = actionToRedactedText(action);
  const context = getActionContext(action);

  const systemPrompt = `You are a recruiting operations assistant drafting internal messages for talent acquisition workflows.

CONTEXT:
- You are writing FROM ${context.senderRole}
- You are writing TO ${context.recipientRole}
- The specific ask is to: ${context.specificAsk}
- ${context.urgencyContext}

GUIDELINES:
- Be direct and specific - state exactly what's needed and why
- Include the specific metrics/data from the evidence (e.g., "7 HMs averaging 3+ days")
- Give a clear timeframe for when action is needed
- Keep a professional but collegial tone - you're on the same team
- Don't be preachy or lecture - just state facts and the ask
- For Slack: 2-3 sentences max, casual but professional
- For Email: 3-4 sentences, slightly more formal with a subject line

PLACEHOLDERS (use exactly as shown):
- [OWNER_NAME] - recipient's name
- [CANDIDATE_NAME] - candidate name (if applicable)
- [REQ_TITLE] - requisition/role title (if applicable)`;

  const channelInstructions = channel === 'slack'
    ? 'Write a Slack DM. Be brief and conversational. No greeting fluff - get to the point.'
    : 'Write an email. Start with "Subject: " line, then a brief greeting, the ask, and a simple sign-off.';

  const userPrompt = `${channelInstructions}

ACTION DETAILS:
${redactedText}

Write a message to [OWNER_NAME] about this. Use the specific numbers from the evidence. Be direct about what you need and by when.`;

  const messages: AiMessage[] = [
    { role: 'user', content: userPrompt }
  ];

  try {
    const response = await sendAiRequest(config, messages, {
      systemPrompt,
      taskType: 'draft_message'
    });

    if (response.error) {
      return {
        draft: '',
        error: response.error.message
      };
    }

    return {
      draft: response.content.trim(),
      error: undefined
    };
  } catch (err) {
    return {
      draft: '',
      error: err instanceof Error ? err.message : 'Unknown error'
    };
  }
}

// ===== HOOKS FOR REACT =====

import { useState, useCallback, useMemo } from 'react';

export interface UseAiSummaryState {
  isLoading: boolean;
  result: AiSummaryResult | null;
  error: string | null;
}

export interface UseAiSummaryReturn extends UseAiSummaryState {
  generate: (config: AiProviderConfig, explanation: Explanation) => Promise<AiSummaryResult>;
  reset: () => void;
}

export function useAiSummary(): UseAiSummaryReturn {
  const [state, setState] = useState<UseAiSummaryState>({
    isLoading: false,
    result: null,
    error: null
  });

  const generate = useCallback(async (
    config: AiProviderConfig,
    explanation: Explanation
  ) => {
    setState({ isLoading: true, result: null, error: null });

    const result = await generateExplanationSummary(config, explanation);

    if (result.error) {
      setState({ isLoading: false, result: null, error: result.error });
    } else {
      setState({ isLoading: false, result, error: null });
    }

    return result;
  }, []);

  const reset = useCallback(() => {
    setState({ isLoading: false, result: null, error: null });
  }, []);

  // Return a stable object reference
  return useMemo(() => ({
    ...state,
    generate,
    reset
  }), [state, generate, reset]);
}

export interface UseDraftMessageState {
  isLoading: boolean;
  result: DraftMessageResult | null;
  error: string | null;
}

export interface UseDraftMessageReturn extends UseDraftMessageState {
  generate: (config: AiProviderConfig, action: ActionItem, channel?: MessageChannel) => Promise<DraftMessageResult>;
  reset: () => void;
}

export function useDraftMessage(): UseDraftMessageReturn {
  const [state, setState] = useState<UseDraftMessageState>({
    isLoading: false,
    result: null,
    error: null
  });

  const generate = useCallback(async (
    config: AiProviderConfig,
    action: ActionItem,
    channel: MessageChannel = 'slack'
  ) => {
    setState({ isLoading: true, result: null, error: null });

    const result = await generateDraftMessage(config, action, channel);

    if (result.error) {
      setState({ isLoading: false, result: null, error: result.error });
    } else {
      setState({ isLoading: false, result, error: null });
    }

    return result;
  }, []);

  const reset = useCallback(() => {
    setState({ isLoading: false, result: null, error: null });
  }, []);

  // Return a stable object reference
  return useMemo(() => ({
    ...state,
    generate,
    reset
  }), [state, generate, reset]);
}
