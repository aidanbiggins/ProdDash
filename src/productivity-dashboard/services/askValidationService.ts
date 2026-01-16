// Ask Validation Service
// Validates AI responses against Fact Pack to prevent hallucinations

import {
  AskFactPack,
  AskAIResponse,
  AICitation,
  AskValidationResult,
  AskValidationError,
  AskValidationErrorType,
} from '../types/askTypes';
import { resolveKeyPath } from './askFactPackService';

// ─────────────────────────────────────────────────────────────
// Validation Configuration
// ─────────────────────────────────────────────────────────────

/**
 * Tolerance for numeric comparison (for floating point rounding)
 */
const NUMERIC_TOLERANCE = 0.01;

/**
 * Maximum allowed hallucinated numbers in response before failing
 */
const MAX_HALLUCINATED_NUMBERS = 0;

// ─────────────────────────────────────────────────────────────
// Main Validation
// ─────────────────────────────────────────────────────────────

/**
 * Validate an AI response against the Fact Pack
 * Returns validation result with errors if any
 */
export function validateAIResponse(
  response: AskAIResponse,
  factPack: AskFactPack
): AskValidationResult {
  const errors: AskValidationError[] = [];

  // Check 1: Must have at least one citation
  if (!response.citations || response.citations.length === 0) {
    errors.push({
      type: 'MISSING_CITATIONS',
      message: 'AI response must include at least one citation to Fact Pack data',
    });
  }

  // Check 2: All cited key paths must exist
  if (response.citations) {
    for (const citation of response.citations) {
      const keyPathErrors = validateCitation(citation, factPack);
      errors.push(...keyPathErrors);
    }
  }

  // Check 3: Check for hallucinated numbers in the answer
  const hallucinationErrors = detectHallucinatedNumbers(
    response.answer_markdown,
    response.citations || [],
    factPack
  );
  errors.push(...hallucinationErrors);

  return {
    valid: errors.length === 0,
    errors,
    fallback_triggered: errors.length > 0,
  };
}

// ─────────────────────────────────────────────────────────────
// Citation Validation
// ─────────────────────────────────────────────────────────────

/**
 * Validate a single citation against the Fact Pack
 */
function validateCitation(
  citation: AICitation,
  factPack: AskFactPack
): AskValidationError[] {
  const errors: AskValidationError[] = [];

  // Check if key path exists
  const actualValue = resolveKeyPath(factPack, citation.key_path);

  if (actualValue === undefined) {
    errors.push({
      type: 'INVALID_KEY_PATH',
      message: `Citation ${citation.ref} references invalid key path: ${citation.key_path}`,
      citation_ref: citation.ref,
    });
    return errors;
  }

  // Check if cited value matches actual value
  if (citation.value !== null && citation.value !== undefined) {
    const valueMatches = compareValues(citation.value, actualValue);
    if (!valueMatches) {
      errors.push({
        type: 'VALUE_MISMATCH',
        message: `Citation ${citation.ref} value "${citation.value}" doesn't match Fact Pack value "${actualValue}" at ${citation.key_path}`,
        citation_ref: citation.ref,
      });
    }
  }

  return errors;
}

/**
 * Compare two values with tolerance for numeric types
 */
function compareValues(cited: string | number | null, actual: any): boolean {
  // Handle null/undefined
  if (cited === null || cited === undefined) {
    return actual === null || actual === undefined;
  }

  // Numeric comparison with tolerance
  if (typeof cited === 'number' && typeof actual === 'number') {
    return Math.abs(cited - actual) <= NUMERIC_TOLERANCE;
  }

  // String comparison (case-insensitive)
  if (typeof cited === 'string' && typeof actual === 'string') {
    return cited.toLowerCase() === actual.toLowerCase();
  }

  // For objects, compare the value property if present
  if (typeof actual === 'object' && actual !== null && 'value' in actual) {
    return compareValues(cited, actual.value);
  }

  // Direct comparison for other types
  return cited === actual;
}

// ─────────────────────────────────────────────────────────────
// Hallucination Detection
// ─────────────────────────────────────────────────────────────

/**
 * Detect numbers in the answer that aren't backed by citations
 */
function detectHallucinatedNumbers(
  answerMarkdown: string,
  citations: AICitation[],
  factPack: AskFactPack
): AskValidationError[] {
  const errors: AskValidationError[] = [];

  // Build set of cited values
  const citedValues = new Set<string>();
  for (const citation of citations) {
    if (citation.value !== null && citation.value !== undefined) {
      citedValues.add(String(citation.value));
    }
    // Also add the actual value from Fact Pack
    const actualValue = resolveKeyPath(factPack, citation.key_path);
    if (actualValue !== undefined) {
      if (typeof actualValue === 'object' && actualValue !== null && 'value' in actualValue) {
        citedValues.add(String(actualValue.value));
      } else {
        citedValues.add(String(actualValue));
      }
    }
  }

  // Find all numbers in the answer
  const numberPattern = /\b(\d+(?:\.\d+)?)\s*(?:%|days?|d|count|reqs?|candidates?|hires?|offers?)?\b/gi;
  const matches = answerMarkdown.matchAll(numberPattern);

  for (const match of matches) {
    const numStr = match[1];
    const num = parseFloat(numStr);

    // Skip common numbers that are usually not data (1, 2, 3, etc.)
    if (num < 3 && Number.isInteger(num)) {
      continue;
    }

    // Skip years
    if (num >= 2000 && num <= 2100) {
      continue;
    }

    // Check if this number is cited or close to a cited value
    let isCited = false;
    for (const citedVal of citedValues) {
      const citedNum = parseFloat(citedVal);
      if (!isNaN(citedNum) && Math.abs(num - citedNum) <= NUMERIC_TOLERANCE) {
        isCited = true;
        break;
      }
    }

    // Also check if this number exists somewhere in the Fact Pack
    if (!isCited) {
      isCited = numberExistsInFactPack(num, factPack);
    }

    if (!isCited) {
      errors.push({
        type: 'HALLUCINATED_NUMBER',
        message: `Number "${numStr}" in answer is not backed by any citation`,
      });
    }
  }

  // Only fail if too many hallucinated numbers
  if (errors.length > MAX_HALLUCINATED_NUMBERS) {
    return errors;
  }

  return [];
}

/**
 * Check if a number exists anywhere in the Fact Pack
 */
function numberExistsInFactPack(num: number, factPack: AskFactPack): boolean {
  const json = JSON.stringify(factPack);

  // Check for exact or close numeric values
  const numPattern = new RegExp(`"value"\\s*:\\s*(${num}|${num.toFixed(1)}|${num.toFixed(2)})`, 'g');
  if (numPattern.test(json)) {
    return true;
  }

  // Check for the number as a count or in arrays
  const countPattern = new RegExp(`"(count|n|length)"\\s*:\\s*${num}\\b`, 'g');
  if (countPattern.test(json)) {
    return true;
  }

  // Check sample sizes
  const sampleSizes = factPack.meta.sample_sizes;
  if (
    num === sampleSizes.total_reqs ||
    num === sampleSizes.total_candidates ||
    num === sampleSizes.total_hires ||
    num === sampleSizes.total_offers ||
    num === sampleSizes.total_events
  ) {
    return true;
  }

  return false;
}

// ─────────────────────────────────────────────────────────────
// Response Parsing
// ─────────────────────────────────────────────────────────────

/**
 * Parse AI response JSON and validate structure
 */
export function parseAIResponseJSON(responseText: string): AskAIResponse | null {
  try {
    // Try to find JSON in the response (it might be wrapped in markdown)
    let jsonText = responseText;

    // Check for markdown code block
    const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      jsonText = jsonMatch[1];
    }

    const parsed = JSON.parse(jsonText);

    // Validate required fields
    if (!parsed.answer_markdown || typeof parsed.answer_markdown !== 'string') {
      console.warn('AI response missing answer_markdown');
      return null;
    }

    if (!Array.isArray(parsed.citations)) {
      console.warn('AI response missing citations array');
      return null;
    }

    // Normalize the response
    return {
      answer_markdown: parsed.answer_markdown,
      citations: parsed.citations.map((c: any) => ({
        ref: c.ref || '[?]',
        key_path: c.key_path || '',
        label: c.label || '',
        value: c.value ?? null,
      })),
      suggested_questions: Array.isArray(parsed.suggested_questions)
        ? parsed.suggested_questions.slice(0, 3)
        : [],
      deep_links: Array.isArray(parsed.deep_links)
        ? parsed.deep_links
        : [],
    };
  } catch (e) {
    console.error('Failed to parse AI response JSON:', e);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// Fallback Response Generation
// ─────────────────────────────────────────────────────────────

/**
 * Generate a fallback response when AI validation fails
 */
export function generateFallbackResponse(
  query: string,
  validationErrors: AskValidationError[]
): AskAIResponse {
  const errorSummary = validationErrors
    .slice(0, 3)
    .map(e => e.type)
    .join(', ');

  return {
    answer_markdown: `I couldn't verify my response against your data (${errorSummary}). Let me give you a more reliable answer based on what I can confirm.\n\nPlease try one of the suggested questions below for accurate insights.`,
    citations: [],
    suggested_questions: [
      "What's on fire?",
      'Show me my top risks',
      'Why is time-to-offer high?',
    ],
    deep_links: [],
  };
}

// ─────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────

export {
  validateCitation,
  detectHallucinatedNumbers,
  numberExistsInFactPack,
};
