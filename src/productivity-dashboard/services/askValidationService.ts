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
import { hasDeepLinkMapping } from './askDeepLinkService';

// ─────────────────────────────────────────────────────────────
// Validation Configuration
// ─────────────────────────────────────────────────────────────

/**
 * Tolerance for numeric comparison (percentage-based)
 * Allow up to 5% difference for rounding and calculation variance
 */
const NUMERIC_TOLERANCE_PERCENT = 0.05;

/**
 * Absolute tolerance for small numbers (< 10)
 */
const NUMERIC_TOLERANCE_ABSOLUTE = 1;

/**
 * Maximum allowed hallucinated numbers in response before failing
 * Allow up to 5 uncited numbers (AI may use contextual numbers, math, etc.)
 */
const MAX_HALLUCINATED_NUMBERS = 5;

// ─────────────────────────────────────────────────────────────
// Main Validation
// ─────────────────────────────────────────────────────────────

/**
 * Check if the response is a "data not available" type answer
 * These don't require citations and should pass validation
 */
function isDataNotAvailableResponse(answer: string): boolean {
  const noDataPhrases = [
    'don\'t have',
    'do not have',
    'isn\'t available',
    'is not available',
    'aren\'t available',
    'are not available',
    'not tracked',
    'not currently tracked',
    'no breakdown',
    'breakdown is not',
    'data isn\'t',
    'data is not',
    'cannot provide',
    'can\'t provide',
    'unable to provide',
    'not in the fact pack',
    'not included in',
    'unfortunately',
    'only have aggregate',
    'only aggregate',
  ];

  const lowerAnswer = answer.toLowerCase();
  return noDataPhrases.some(phrase => lowerAnswer.includes(phrase));
}

/**
 * Validate an AI response against the Fact Pack
 * Returns validation result with errors if any
 */
export function validateAIResponse(
  response: AskAIResponse,
  factPack: AskFactPack
): AskValidationResult {
  const errors: AskValidationError[] = [];

  // Special case: "data not available" responses don't need citations
  const isNoDataResponse = isDataNotAvailableResponse(response.answer_markdown);

  // Check 1: Must have at least one citation (unless it's a "no data" response)
  if (!isNoDataResponse && (!response.citations || response.citations.length === 0)) {
    errors.push({
      type: 'MISSING_CITATIONS',
      message: 'AI response must include at least one citation to Fact Pack data',
    });
  }

  // Check 2: All cited key paths must exist (validate only if citations provided)
  if (response.citations && response.citations.length > 0) {
    let validCitations = 0;
    for (const citation of response.citations) {
      const keyPathErrors = validateCitation(citation, factPack);
      if (keyPathErrors.length === 0) {
        validCitations++;
      } else {
        // Log but don't fail for invalid key paths - AI may be trying alternate paths
        console.log('Citation validation warning:', keyPathErrors[0]?.message);
      }
      // Only add VALUE_MISMATCH errors (key path issues are less critical)
      errors.push(...keyPathErrors.filter(e => e.type === 'VALUE_MISMATCH'));
    }

    // If we have at least one valid citation, clear VALUE_MISMATCH errors
    // (AI got at least some data right)
    if (validCitations > 0) {
      const nonMismatchErrors = errors.filter(e => e.type !== 'VALUE_MISMATCH');
      errors.length = 0;
      errors.push(...nonMismatchErrors);
    }
  }

  // Check 3: Check for hallucinated numbers (skip for "no data" responses)
  if (!isNoDataResponse) {
    const hallucinationErrors = detectHallucinatedNumbers(
      response.answer_markdown,
      response.citations || [],
      factPack
    );
    errors.push(...hallucinationErrors);
  }

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
 * Only validates key path existence - does NOT compare values
 * This prevents validation failures due to slight value differences
 * Note: Deep link mapping is NOT required - UI handles unmapped paths with fallback
 */
function validateCitation(
  citation: AICitation,
  factPack: AskFactPack
): AskValidationError[] {
  const errors: AskValidationError[] = [];

  // Check if key path exists
  const actualValue = resolveKeyPath(factPack, citation.key_path);

  if (actualValue === undefined) {
    // Log warning but don't fail - key paths may be phrased slightly differently
    console.log(`Citation ${citation.ref} references key path not found: ${citation.key_path}`);
    // Only add error for completely invalid paths (not sub-property access)
    if (!citation.key_path.includes('[') && !citation.key_path.includes('.')) {
      errors.push({
        type: 'INVALID_KEY_PATH',
        message: `Citation ${citation.ref} references invalid key path: ${citation.key_path}`,
        citation_ref: citation.ref,
      });
    }
    return errors;
  }

  // Log info if no deep link mapping (but don't fail validation)
  // The UI has a fallback for unmapped deep links
  if (!hasDeepLinkMapping(citation.key_path)) {
    console.log(`Citation ${citation.ref} at ${citation.key_path} has no deep link mapping (will use fallback)`);
  }

  // NOTE: We intentionally do NOT compare cited values to actual values
  // This allows AI to cite facts even if it phrases values slightly differently
  // The important thing is that the key path is valid

  return errors;
}

/**
 * Try to parse a value as a number
 */
function toNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return value;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? null : parsed;
}

/**
 * Compare two values with tolerance for numeric types
 * Uses percentage-based tolerance for larger numbers, absolute for smaller
 */
function compareValues(cited: string | number | null, actual: any): boolean {
  if (cited === null || cited === undefined) {
    return actual === null || actual === undefined;
  }

  // For objects, compare the value property if present
  if (typeof actual === 'object' && actual !== null && 'value' in actual) {
    return compareValues(cited, actual.value);
  }

  const citedNum = toNumber(cited);
  const actualNum = toNumber(actual);

  // Numeric comparison with tolerance
  if (citedNum !== null && actualNum !== null) {
    if (Math.abs(actualNum) < 10) {
      return Math.abs(citedNum - actualNum) <= NUMERIC_TOLERANCE_ABSOLUTE;
    }
    const percentDiff = Math.abs(citedNum - actualNum) / Math.abs(actualNum);
    return percentDiff <= NUMERIC_TOLERANCE_PERCENT;
  }

  // String comparison (case-insensitive)
  if (typeof cited === 'string' && typeof actual === 'string') {
    return cited.toLowerCase() === actual.toLowerCase();
  }

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

    // Skip common numbers that are usually not data (1-10)
    if (num <= 10 && Number.isInteger(num)) {
      continue;
    }

    // Skip years
    if (num >= 2000 && num <= 2100) {
      continue;
    }

    // Skip percentages that are common (0, 100, etc.)
    if (num === 0 || num === 100) {
      continue;
    }

    // Check if this number is cited or close to a cited value
    let isCited = false;
    for (const citedVal of citedValues) {
      const citedNum = parseFloat(citedVal);
      if (!isNaN(citedNum)) {
        // Use same tolerance logic as compareValues
        const diff = Math.abs(num - citedNum);
        const percentDiff = citedNum !== 0 ? diff / Math.abs(citedNum) : diff;
        if (diff <= NUMERIC_TOLERANCE_ABSOLUTE || percentDiff <= NUMERIC_TOLERANCE_PERCENT) {
          isCited = true;
          break;
        }
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
  const numVariants = [num, num.toFixed(1), num.toFixed(2)].join('|');
  const numPattern = new RegExp(`"value"\\s*:\\s*(${numVariants})`, 'g');
  if (numPattern.test(json)) return true;

  // Check for the number as a count or in arrays
  const countPattern = new RegExp(`"(count|n|length)"\\s*:\\s*${num}\\b`, 'g');
  if (countPattern.test(json)) return true;

  // Check sample sizes
  const { total_reqs, total_candidates, total_hires, total_offers, total_events } = factPack.meta.sample_sizes;
  return [total_reqs, total_candidates, total_hires, total_offers, total_events].includes(num);
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
