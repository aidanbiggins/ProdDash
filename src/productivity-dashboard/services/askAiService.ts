// Ask AI Service
// Sends free-form queries to AI with Fact Pack grounding

import { AiProviderConfig, AiMessage } from '../types/aiTypes';
import { AskFactPack, AskAIResponse, IntentResponse, FactCitation } from '../types/askTypes';
import { sendAiRequest } from './aiService';
import { validateAIResponse, parseAIResponseJSON, generateFallbackResponse } from './askValidationService';
import { handleDeterministicQuery } from './askIntentService';

// ─────────────────────────────────────────────────────────────
// System Prompt Template
// ─────────────────────────────────────────────────────────────

function buildSystemPrompt(factPack: AskFactPack): string {
  return `You are an AI assistant for ProdDash, a recruiting analytics dashboard. Your role is to answer questions about the user's recruiting data using ONLY the Fact Pack provided below.

## CRITICAL RULES

1. **CITATIONS REQUIRED**: Every factual claim must cite a specific Fact Pack key path using [N] notation.
2. **NO HALLUCINATION**: Do not invent numbers. Only use values from the Fact Pack.
3. **STRUCTURED RESPONSE**: Always respond with valid JSON matching the schema below.

## Response Schema

\`\`\`json
{
  "answer_markdown": "Your response with [1][2] citation markers...",
  "citations": [
    {
      "ref": "[1]",
      "key_path": "control_tower.kpis.median_ttf.value",
      "label": "Median TTF",
      "value": 42
    }
  ],
  "suggested_questions": ["Follow-up question 1?", "Follow-up question 2?"],
  "deep_links": [
    { "label": "View Details", "tab": "control-tower", "params": {} }
  ]
}
\`\`\`

## Valid Key Paths

Use dot notation to cite Fact Pack values:
- control_tower.kpis.median_ttf.value - Median time to fill
- control_tower.kpis.offer_count.value - Number of offers
- control_tower.kpis.accept_rate.value - Offer accept rate %
- control_tower.kpis.stalled_reqs.value - Stalled requisition count
- control_tower.kpis.hm_latency.value - HM feedback latency
- control_tower.risk_summary.total_at_risk - Total at-risk reqs
- forecast.expected_hires - Expected hires
- forecast.pipeline_gap - Gap to goal
- velocity.bottleneck_stage - Pipeline bottleneck
- capacity.avg_req_load - Average recruiter load
- meta.sample_sizes.total_reqs - Total requisitions
- meta.sample_sizes.total_candidates - Total candidates

## Fact Pack Data

\`\`\`json
${JSON.stringify(factPack, null, 2)}
\`\`\`

## Guidelines

- Be concise and actionable
- Focus on insights, not just data regurgitation
- Suggest concrete next steps when appropriate
- Use bullet points for lists
- Bold key numbers with **value**
- Always include 2-3 suggested follow-up questions
- Include at least one deep_link to relevant dashboard tab`;
}

// ─────────────────────────────────────────────────────────────
// AI Query Execution
// ─────────────────────────────────────────────────────────────

export interface AskAIQueryResult {
  success: boolean;
  response: IntentResponse;
  validationPassed: boolean;
  usedFallback: boolean;
  error?: string;
}

/**
 * Send a query to the AI and validate the response
 * Falls back to deterministic handler if AI fails or validation fails
 */
export async function sendAskQuery(
  query: string,
  factPack: AskFactPack,
  aiConfig: AiProviderConfig
): Promise<AskAIQueryResult> {
  const systemPrompt = buildSystemPrompt(factPack);

  const messages: AiMessage[] = [
    { role: 'user', content: query },
  ];

  try {
    // Send request to AI
    const aiResponse = await sendAiRequest(aiConfig, messages, {
      systemPrompt,
      taskType: 'ask_proddash',
    });

    // Check for errors
    if (aiResponse.error || !aiResponse.content) {
      console.warn('AI request failed, falling back to deterministic:', aiResponse.error);
      return createFallbackResult(query, factPack, 'AI request failed');
    }

    // Parse AI response
    const parsedResponse = parseAIResponseJSON(aiResponse.content);
    if (!parsedResponse) {
      console.warn('Failed to parse AI response, falling back to deterministic');
      return createFallbackResult(query, factPack, 'Failed to parse AI response');
    }

    // Validate response against Fact Pack
    const validationResult = validateAIResponse(parsedResponse, factPack);

    if (!validationResult.valid) {
      console.warn('AI response failed validation:', validationResult.errors);
      return createFallbackResult(
        query,
        factPack,
        `Validation failed: ${validationResult.errors.map(e => e.type).join(', ')}`
      );
    }

    // Convert to IntentResponse format
    const intentResponse: IntentResponse = {
      answer_markdown: parsedResponse.answer_markdown,
      citations: parsedResponse.citations.map(c => ({
        ref: c.ref,
        key_path: c.key_path,
        label: c.label,
        value: c.value,
      })),
      deep_links: parsedResponse.deep_links.map(d => ({
        label: d.label,
        tab: d.tab,
        params: d.params,
      })),
      suggested_questions: parsedResponse.suggested_questions,
    };

    return {
      success: true,
      response: intentResponse,
      validationPassed: true,
      usedFallback: false,
    };
  } catch (error) {
    console.error('Unexpected error in AI query:', error);
    return createFallbackResult(
      query,
      factPack,
      error instanceof Error ? error.message : 'Unknown error'
    );
  }
}

/**
 * Create a fallback result using deterministic query handling
 */
function createFallbackResult(
  query: string,
  factPack: AskFactPack,
  errorReason: string
): AskAIQueryResult {
  // Try to use deterministic handler
  const deterministicResponse = handleDeterministicQuery(query, factPack);

  // Add a note that this is a fallback
  const modifiedResponse: IntentResponse = {
    ...deterministicResponse,
    answer_markdown: deterministicResponse.answer_markdown +
      '\n\n*Note: This response was generated using guided mode due to a processing issue.*',
  };

  return {
    success: true, // Still successful, just using fallback
    response: modifiedResponse,
    validationPassed: false,
    usedFallback: true,
    error: errorReason,
  };
}

// ─────────────────────────────────────────────────────────────
// Retry Logic
// ─────────────────────────────────────────────────────────────

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;

/**
 * Send query with retry logic for transient failures
 */
export async function sendAskQueryWithRetry(
  query: string,
  factPack: AskFactPack,
  aiConfig: AiProviderConfig
): Promise<AskAIQueryResult> {
  let lastError: string | undefined;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * attempt));
    }

    const result = await sendAskQuery(query, factPack, aiConfig);

    // If successful without fallback, return immediately
    if (result.success && !result.usedFallback) {
      return result;
    }

    // If we used fallback, save the error and try again
    if (result.usedFallback) {
      lastError = result.error;
      console.log(`Ask query attempt ${attempt + 1} used fallback, retrying...`);
      continue;
    }

    // If not successful, return immediately
    return result;
  }

  // All retries exhausted, use deterministic fallback
  console.warn(`All ${MAX_RETRIES + 1} AI attempts failed, using deterministic response`);
  return createFallbackResult(query, factPack, lastError || 'All retry attempts failed');
}

// ─────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────

export { buildSystemPrompt };
