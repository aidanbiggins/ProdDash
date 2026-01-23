// Ask Answerability Gate Service
// Deterministic check: can Ask answer a given intent with the current data?
// If required fact keys are missing, returns "Not enough data" + unlock steps.
// This is a reliability gate - Ask must NEVER guess when data is insufficient.

import { AskFactPack } from '../types/askTypes';
import { CoverageMetrics } from '../types/resilientImportTypes';
import {
  CapabilityEngineResult,
  RepairSuggestionEntry,
} from '../types/capabilityTypes';
import { evaluateCapabilities, REPAIR_SUGGESTIONS } from './capabilityEngine';

// ============================================
// INTENT → REQUIRED CAPABILITIES MAP
// ============================================

/**
 * Maps each intent to the data capabilities it requires.
 * If any required capability is BLOCKED, the intent is unanswerable.
 */
export const INTENT_CAPABILITY_REQUIREMENTS: Record<string, string[]> = {
  whats_on_fire: ['cap_requisitions', 'cap_candidates'],
  top_risks: ['cap_requisitions', 'cap_candidates', 'cap_stage_events'],
  top_actions: ['cap_requisitions', 'cap_recruiter_assignment'],
  why_time_to_offer: ['cap_timestamps', 'cap_hires'],
  why_hm_latency: ['cap_hm_assignment', 'cap_stage_events'],
  stalled_reqs: ['cap_requisitions', 'cap_stage_events'],
  forecast_gap: ['cap_requisitions', 'cap_candidates', 'cap_hires'],
  velocity_summary: ['cap_candidates', 'cap_funnel_stages'],
  source_mix_summary: ['cap_source_data'],
  capacity_summary: ['cap_recruiter_assignment'],
  most_productive_recruiter: ['cap_recruiter_assignment', 'cap_candidates'],
  lowest_performing_recruiter: ['cap_recruiter_assignment', 'cap_candidates'],
  hm_with_most_open_reqs: ['cap_hm_assignment', 'cap_requisitions'],
  bottleneck_analysis: ['cap_stage_events', 'cap_snapshot_dwell'],
};

// ============================================
// ANSWERABILITY CHECK RESULT
// ============================================

export interface AnswerabilityResult {
  /** Whether the intent can be answered with current data */
  answerable: boolean;
  /** If not answerable: which capabilities are blocked */
  blocked_capabilities: string[];
  /** If not answerable: repair suggestions to unlock */
  unlock_steps: RepairSuggestionEntry[];
  /** Human-readable reason */
  reason: string;
}

// ============================================
// MAIN GATE FUNCTION
// ============================================

/**
 * Check if a given intent can be answered with the current data.
 * This is the reliability gate - fail closed.
 *
 * @param intentId - The matched intent ID
 * @param coverage - Current coverage metrics
 * @returns AnswerabilityResult with unlock steps if unanswerable
 */
export function checkAnswerability(
  intentId: string,
  coverage: CoverageMetrics | null | undefined
): AnswerabilityResult {
  // No data at all = nothing is answerable
  if (!coverage) {
    return {
      answerable: false,
      blocked_capabilities: [],
      unlock_steps: [REPAIR_SUGGESTIONS['cap_requisitions']].filter(Boolean),
      reason: 'No data imported yet. Import data to start asking questions.',
    };
  }

  // Get required capabilities for this intent
  const required = INTENT_CAPABILITY_REQUIREMENTS[intentId];
  if (!required) {
    // Unknown intent - allow it (will be handled by matchIntent returning null)
    return { answerable: true, blocked_capabilities: [], unlock_steps: [], reason: '' };
  }

  // Evaluate capabilities
  const engineResult = evaluateCapabilities(coverage);

  // Check which required capabilities are BLOCKED
  const blockedCaps: string[] = [];
  for (const capKey of required) {
    const capEntry = engineResult.capability_report.get(capKey);
    if (!capEntry || capEntry.status === 'BLOCKED') {
      blockedCaps.push(capKey);
    }
  }

  if (blockedCaps.length === 0) {
    return { answerable: true, blocked_capabilities: [], unlock_steps: [], reason: '' };
  }

  // Build unlock steps from repair suggestions
  const unlockSteps: RepairSuggestionEntry[] = [];
  for (const capKey of blockedCaps) {
    const repair = REPAIR_SUGGESTIONS[capKey];
    if (repair) unlockSteps.push(repair);
  }

  // Build reason
  const capNames = blockedCaps.map(k => {
    const entry = engineResult.capability_report.get(k);
    return entry?.display_name || k;
  });

  return {
    answerable: false,
    blocked_capabilities: blockedCaps,
    unlock_steps: unlockSteps,
    reason: `Not enough data to answer this question. Missing: ${capNames.join(', ')}.`,
  };
}

/**
 * Build the "Not enough data" response for Ask UI.
 * Returns markdown + unlock steps formatted for display.
 */
export function buildBlockedResponse(result: AnswerabilityResult): {
  answer_markdown: string;
  unlock_steps: Array<{ title: string; description: string; action: string }>;
} {
  let md = `## Not Enough Data\n\n`;
  md += `${result.reason}\n\n`;

  if (result.unlock_steps.length > 0) {
    md += `### How to unlock this answer:\n\n`;
    result.unlock_steps.forEach((step, i) => {
      md += `${i + 1}. **${step.ui_copy.short_title}** — ${step.why_it_matters}\n`;
      md += `   Columns needed: ${step.required_columns.join(', ')}\n\n`;
    });
  }

  const unlock_steps = result.unlock_steps.map(s => ({
    title: s.ui_copy.short_title,
    description: s.why_it_matters,
    action: s.ui_copy.cta_action,
  }));

  return { answer_markdown: md, unlock_steps };
}

/**
 * Validate that a Fact Pack has the required keys for an intent.
 * This is a runtime safety check on the actual Fact Pack data.
 */
export function validateFactPackForIntent(
  intentId: string,
  factPack: AskFactPack | null
): { valid: boolean; missing_keys: string[] } {
  if (!factPack) {
    return { valid: false, missing_keys: ['(no fact pack)'] };
  }

  // Check that critical top-level sections exist
  const requiredSections: Record<string, string[]> = {
    whats_on_fire: ['actions.top_p0', 'control_tower.kpis'],
    top_risks: ['risks.top_risks'],
    top_actions: ['actions.top_p0', 'actions.top_p1'],
    why_time_to_offer: ['explain.time_to_offer'],
    why_hm_latency: ['explain.hm_latency'],
    stalled_reqs: ['control_tower.kpis.stalled_reqs'],
    forecast_gap: ['forecast'],
    velocity_summary: ['velocity'],
    source_mix_summary: ['sources'],
    capacity_summary: ['capacity'],
    most_productive_recruiter: ['recruiter_performance'],
    lowest_performing_recruiter: ['recruiter_performance'],
    hm_with_most_open_reqs: ['hiring_manager_ownership'],
    bottleneck_analysis: ['bottlenecks'],
  };

  const paths = requiredSections[intentId];
  if (!paths) return { valid: true, missing_keys: [] };

  const missing: string[] = [];
  for (const path of paths) {
    if (!resolveFactPackPath(factPack, path)) {
      missing.push(path);
    }
  }

  return { valid: missing.length === 0, missing_keys: missing };
}

/**
 * Resolve a dot-notation path on the fact pack.
 */
function resolveFactPackPath(obj: unknown, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as { [key: string]: unknown })[part];
  }
  return current;
}
