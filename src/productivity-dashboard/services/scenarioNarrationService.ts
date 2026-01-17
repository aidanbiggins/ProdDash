/**
 * Scenario Narration Service
 *
 * AI-powered exec-friendly narratives from scenario output.
 * AI never computes — it only narrates the deterministic results.
 *
 * Features:
 * - BYOK AI integration for generating narratives
 * - Citation validation against scenario output
 * - Deterministic fallback when AI fails
 * - PII redaction before sending to AI
 */

import { sendAiRequest, AiMessage } from './aiService';
import { AiProviderConfig } from '../types/aiTypes';
import {
  ScenarioOutput,
  ScenarioId,
  Feasibility,
  ScenarioDeltas,
  Bottleneck,
  Citation,
  ConfidenceAssessment,
} from '../types/scenarioTypes';

// ===== TYPES =====

/** AI task type identifier */
export const AI_TASK_TYPE = 'scenario_narration';

/** Input sent to AI for narration */
export interface ScenarioNarrationInput {
  scenario_id: ScenarioId;
  scenario_name: string;
  parameters_redacted: {
    headcount?: number;
    function?: string;
    level?: string;
    target_days?: number;
    freeze_weeks?: number;
    candidate_action?: string;
    scope?: string;
    departure_days_from_now?: number;
    affected_req_count?: number;
    reassignment_strategy?: string;
  };
  output: {
    feasibility: Feasibility;
    deltas: ScenarioDeltas;
    bottlenecks: Array<{
      rank: number;
      constraint_type: string;
      description: string;
      severity: string;
      mitigation: string;
    }>;
    resource_impact: {
      team_utilization_delta: number;
    } | null;
    confidence: {
      level: string;
      reasons: string[];
    };
    action_plan_summary: {
      total_actions: number;
      p0_count: number;
      p1_count: number;
      p2_count: number;
    };
  };
  valid_citation_keys: string[];
}

/** AI-generated narration output */
export interface ScenarioNarrationOutput {
  headline: string;
  bullets: Array<{
    text: string;
    citation: string;
  }>;
  asks: string[];
  caveats: string[];
}

/** Validation result */
export interface NarrationValidationResult {
  valid: boolean;
  errors: string[];
}

// ===== AI SYSTEM PROMPT =====

const NARRATION_SYSTEM_PROMPT = `You are a senior executive communications advisor. Take the data provided and make it clear, concise, and impactful.

WRITING RULES:
- Use a 5th grade reading level so all concepts are clear
- Use general business language, not recruiting jargon
- Think like a McKinsey senior partner: "So what?" → "Therefore" → "Next steps"
- Do not exaggerate. Do not make up numbers. Do not add context that isn't there.
- Simply translate the data into concepts busy leaders can understand quickly

STYLE:
- Short sentences. Active voice. No filler words.
- Replace jargon: "pipeline depth" → "candidate pool", "velocity decay" → "hiring slowdown", "capacity gap" → "team bandwidth"
- Lead with the bottom line, then support it
- 3-5 bullets max. Each bullet = one clear point.

CONSTRAINTS:
- Only use numbers from the input data
- Every bullet must have a citation key from valid_citation_keys
- Never say "upstream funnel inputs" or similar consultant-speak

OUTPUT FORMAT (JSON):
{
  "headline": "Bottom line in plain English (10 words or less)",
  "bullets": [
    {"text": "One clear point per bullet", "citation": "valid.citation.key"}
  ],
  "asks": ["What decision do you need? Be specific."],
  "caveats": ["One honest limitation"]
}`;

// ===== MAIN FUNCTIONS =====

/**
 * Generate exec-friendly narration from scenario output
 */
export async function generateExecNarration(
  scenarioOutput: ScenarioOutput,
  aiConfig: AiProviderConfig
): Promise<ScenarioNarrationOutput> {
  try {
    // Step 1: Build AI input with PII redaction
    const narrationInput = buildNarrationInput(scenarioOutput);

    // Step 2: Call AI
    const messages: AiMessage[] = [
      {
        role: 'user',
        content: JSON.stringify(narrationInput, null, 2),
      },
    ];

    const response = await sendAiRequest(aiConfig, messages, {
      taskType: AI_TASK_TYPE,
      systemPrompt: NARRATION_SYSTEM_PROMPT,
    });

    // Step 3: Parse AI response
    const aiOutput = parseAiResponse(response.content);
    if (!aiOutput) {
      console.warn('Failed to parse AI narration response, using deterministic fallback');
      return generateDeterministicNarration(scenarioOutput);
    }

    // Step 4: Validate citations
    const validation = validateNarrationOutput(aiOutput, narrationInput);
    if (!validation.valid) {
      console.warn('AI narration validation failed:', validation.errors);
      return generateDeterministicNarration(scenarioOutput);
    }

    return aiOutput;
  } catch (error) {
    console.error('AI narration error, using deterministic fallback:', error);
    return generateDeterministicNarration(scenarioOutput);
  }
}

/**
 * Build narration input from scenario output with PII redaction
 */
export function buildNarrationInput(output: ScenarioOutput): ScenarioNarrationInput {
  // Collect valid citation keys from the output
  const validCitationKeys = output.citations.map(c => c.key_path);

  // Add standard citation keys
  validCitationKeys.push(
    'scenario.feasibility',
    'scenario.confidence',
    'scenario.deltas',
    'scenario.bottlenecks',
    'scenario.action_plan'
  );

  // Count actions by priority
  const actionSummary = {
    total_actions: output.action_plan.length,
    p0_count: output.action_plan.filter(a => a.priority === 'P0').length,
    p1_count: output.action_plan.filter(a => a.priority === 'P1').length,
    p2_count: output.action_plan.filter(a => a.priority === 'P2').length,
  };

  // Build redacted bottlenecks (no recruiter IDs)
  const redactedBottlenecks = output.bottlenecks.map(b => ({
    rank: b.rank,
    constraint_type: b.constraint_type,
    description: b.description,
    severity: b.severity,
    mitigation: b.mitigation,
  }));

  // Build redacted resource impact (no recruiter IDs)
  const redactedResourceImpact = output.resource_impact
    ? { team_utilization_delta: output.resource_impact.team_utilization_delta }
    : null;

  return {
    scenario_id: output.scenario_id,
    scenario_name: output.scenario_name,
    parameters_redacted: extractRedactedParameters(output),
    output: {
      feasibility: output.feasibility,
      deltas: output.deltas,
      bottlenecks: redactedBottlenecks,
      resource_impact: redactedResourceImpact,
      confidence: {
        level: output.confidence.level,
        reasons: output.confidence.reasons,
      },
      action_plan_summary: actionSummary,
    },
    valid_citation_keys: validCitationKeys,
  };
}

/**
 * Extract redacted parameters from scenario output
 */
function extractRedactedParameters(output: ScenarioOutput): ScenarioNarrationInput['parameters_redacted'] {
  // The parameters are embedded in the output metadata
  // We extract only non-PII fields
  const params: ScenarioNarrationInput['parameters_redacted'] = {};

  // These would be extracted from the scenario input if available
  // For now, we use the deltas and other output to infer key parameters
  if (output.scenario_id === 'spin_up_team') {
    params.headcount = output.deltas.expected_hires_delta ?? undefined;
    params.target_days = output.deltas.time_to_offer_delta
      ? Math.abs(output.deltas.time_to_offer_delta)
      : undefined;
  } else if (output.scenario_id === 'hiring_freeze') {
    params.freeze_weeks = undefined; // Would need to be passed through
  } else if (output.scenario_id === 'recruiter_leaves') {
    params.affected_req_count = output.action_plan.length;
  }

  return params;
}

/**
 * Validate AI narration output for citation correctness
 */
export function validateNarrationOutput(
  output: ScenarioNarrationOutput,
  input: ScenarioNarrationInput
): NarrationValidationResult {
  const errors: string[] = [];
  const validKeys = new Set(input.valid_citation_keys);

  // Check headline exists
  if (!output.headline || output.headline.trim().length === 0) {
    errors.push('Missing headline');
  }

  // Check bullets have valid citations
  if (!output.bullets || output.bullets.length === 0) {
    errors.push('No bullets provided');
  } else {
    for (const bullet of output.bullets) {
      if (!bullet.text || bullet.text.trim().length === 0) {
        errors.push('Empty bullet text');
      }
      if (!bullet.citation) {
        errors.push('Bullet missing citation');
      } else if (!validKeys.has(bullet.citation)) {
        errors.push(`Invalid citation: ${bullet.citation}`);
      }
    }
  }

  // Check asks
  if (!output.asks || output.asks.length === 0) {
    errors.push('No asks provided');
  }

  // Check caveats
  if (!output.caveats || output.caveats.length === 0) {
    errors.push('No caveats provided');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Parse AI response string to ScenarioNarrationOutput
 */
function parseAiResponse(response: string): ScenarioNarrationOutput | null {
  try {
    // Try to extract JSON from the response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn('No JSON found in AI response');
      return null;
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Validate structure
    if (typeof parsed.headline !== 'string') return null;
    if (!Array.isArray(parsed.bullets)) return null;
    if (!Array.isArray(parsed.asks)) return null;
    if (!Array.isArray(parsed.caveats)) return null;

    return parsed as ScenarioNarrationOutput;
  } catch (e) {
    console.error('Failed to parse AI narration response:', e);
    return null;
  }
}

/**
 * Generate deterministic narration when AI fails or is unavailable
 * Written for humans, not robots - clear, concise, 5th grade reading level
 */
export function generateDeterministicNarration(output: ScenarioOutput): ScenarioNarrationOutput {
  const bullets: ScenarioNarrationOutput['bullets'] = [];

  // Bullet 1: What we're trying to do and if it's doable
  const feasibilityText = formatFeasibility(output.feasibility);
  bullets.push({
    text: feasibilityText,
    citation: 'scenario.feasibility',
  });

  // Bullet 2: The main blocker (if any)
  if (output.bottlenecks.length > 0) {
    const topBlocker = output.bottlenecks[0];
    bullets.push({
      text: formatBlocker(topBlocker),
      citation: 'scenario.bottlenecks',
    });
  }

  // Bullet 3: Key numbers (only if meaningful)
  const numbers = formatKeyNumbers(output.deltas);
  if (numbers) {
    bullets.push({
      text: numbers,
      citation: 'scenario.deltas',
    });
  }

  // Bullet 4: What to do about it
  if (output.action_plan.length > 0) {
    const topAction = output.action_plan.find(a => a.priority === 'P0') || output.action_plan[0];
    bullets.push({
      text: `Next step: ${topAction.title.replace(/^(Open|Create|Add|Review)\s+/i, '')}`,
      citation: 'scenario.action_plan',
    });
  }

  // Build asks - what decision is needed
  const asks = generateAsks(output);

  // Build caveats - one honest limitation
  const caveats = generateCaveats(output);

  return {
    headline: generateHeadline(output),
    bullets,
    asks,
    caveats,
  };
}

/**
 * Generate a short, clear headline
 */
function generateHeadline(output: ScenarioOutput): string {
  // Extract the key info from scenario name (e.g., "5-person Engineering team")
  const match = output.scenario_name.match(/(\d+)-person\s+(\w+)/i);
  const teamDesc = match ? `${match[1]} ${match[2]} hires` : output.scenario_name;

  switch (output.feasibility) {
    case 'ON_TRACK':
      return `${teamDesc}: Doable`;
    case 'AT_RISK':
      return `${teamDesc}: Needs attention`;
    case 'IMPOSSIBLE':
      return `${teamDesc}: Not doable as planned`;
    case 'NOT_ENOUGH_DATA':
      return `${teamDesc}: Need more data`;
  }
}

/**
 * Format feasibility in plain English
 */
function formatFeasibility(feasibility: Feasibility): string {
  switch (feasibility) {
    case 'ON_TRACK':
      return 'This plan looks doable with our current team.';
    case 'AT_RISK':
      return 'This plan is possible but has some risks we need to address.';
    case 'IMPOSSIBLE':
      return 'This plan won\'t work as written. We need to adjust targets or add resources.';
    case 'NOT_ENOUGH_DATA':
      return 'We don\'t have enough data to give you a confident answer.';
  }
}

/**
 * Format a blocker in plain English
 */
function formatBlocker(bottleneck: Bottleneck): string {
  // Translate constraint types to plain English
  const typeMap: Record<string, string> = {
    'VELOCITY_DECAY': 'Hiring is slower than our target',
    'CAPACITY_GAP': 'Our recruiting team is stretched thin',
    'PIPELINE_DEPTH': 'We don\'t have enough candidates in the pipeline',
    'HM_FRICTION': 'Hiring manager feedback is slow',
    'ACCEPT_RATE_DECLINE': 'Candidates are declining our offers',
  };

  const plainType = typeMap[bottleneck.constraint_type] || bottleneck.constraint_type;
  return `Main risk: ${plainType}.`;
}

/**
 * Format key numbers simply
 */
function formatKeyNumbers(deltas: ScenarioDeltas): string | null {
  if (deltas.expected_hires_delta !== null && deltas.expected_hires_delta !== 0) {
    const direction = deltas.expected_hires_delta > 0 ? 'add' : 'lose';
    return `This would ${direction} ${Math.abs(deltas.expected_hires_delta)} hires.`;
  }

  if (deltas.offers_delta !== null && deltas.offers_delta !== 0) {
    return `We'll need to make ${Math.abs(deltas.offers_delta)} offers to hit the goal.`;
  }

  return null;
}

/**
 * Generate asks - what decision is needed (keep it simple)
 */
function generateAsks(output: ScenarioOutput): string[] {
  if (output.feasibility === 'IMPOSSIBLE') {
    return ['Do we adjust the target or add more recruiters?'];
  } else if (output.feasibility === 'AT_RISK') {
    return ['Green light with the risks noted?'];
  } else if (output.feasibility === 'NOT_ENOUGH_DATA') {
    return ['Can we get better data before deciding?'];
  } else {
    return ['Ready to kick this off?'];
  }
}

/**
 * Generate caveats - one honest limitation
 */
function generateCaveats(output: ScenarioOutput): string[] {
  // Keep it to one caveat - most important limitation
  if (output.confidence.level === 'LOW') {
    return ['Limited data makes this estimate rough.'];
  }

  if (output.deltas.time_to_offer_delta === null) {
    return ['Timeline impact not calculated.'];
  }

  return ['Based on past performance. Results may vary.'];
}

/**
 * Check if AI narration is available (config is valid)
 */
export function isNarrationAvailable(aiConfig: AiProviderConfig | null): boolean {
  if (!aiConfig) return false;
  return !!aiConfig.apiKey && aiConfig.apiKey.trim().length > 0;
}
