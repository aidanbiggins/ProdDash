// Unit tests for Ask Validation Service
// Tests AI response validation, citation checking, and hallucination detection

import {
  validateAIResponse,
  parseAIResponseJSON,
  generateFallbackResponse,
} from '../askValidationService';
import { AskAIResponse, AskFactPack, AICitation } from '../../types/askTypes';

// ─────────────────────────────────────────────────────────────
// Test Fixtures
// ─────────────────────────────────────────────────────────────

function createMinimalFactPack(): AskFactPack {
  return {
    meta: {
      generated_at: new Date().toISOString(),
      org_id: 'org-123',
      org_name: 'Test Org',
      data_window: {
        start_date: '2024-01-01',
        end_date: '2024-03-01',
        days: 60,
      },
      sample_sizes: {
        total_reqs: 50,
        total_candidates: 200,
        total_hires: 20,
        total_offers: 25,
        total_events: 1000,
      },
      capability_flags: {
        has_stage_timing: true,
        has_source_data: true,
        has_hm_data: true,
        has_forecast_data: true,
        has_quality_data: false,
        ai_enabled: true,
      },
      data_health_score: 85,
    },
    control_tower: {
      kpis: {
        median_ttf: { value: 42, unit: 'days', threshold: { green: 45, yellow: 60, red: 90 }, status: 'green', n: 20, trend: null },
        offer_count: { value: 25, unit: 'count', threshold: { green: 10, yellow: 5, red: 0 }, status: 'green', n: 25, trend: null },
        accept_rate: { value: 80, unit: '%', threshold: { green: 80, yellow: 60, red: 40 }, status: 'green', n: 25, trend: null },
        stalled_reqs: { value: 5, unit: 'count', threshold: { green: 0, yellow: 5, red: 10 }, status: 'yellow', n: 50, trend: null },
        hm_latency: { value: 3.2, unit: 'days', threshold: { green: 2, yellow: 3, red: 5 }, status: 'yellow', n: 100, trend: null },
      },
      risk_summary: {
        total_at_risk: 8,
        by_type: {
          zombie: 3,
          stalled: 2,
        },
      },
      action_summary: {
        total_open: 15,
        p0_count: 3,
        p1_count: 7,
        p2_count: 5,
      },
    },
    explain: {
      time_to_offer: { metric_name: 'Time to Offer', value: 28, unit: 'days', top_drivers: [], exclusions: [], confidence: 'high', n: 50 },
      hm_latency: { metric_name: 'HM Latency', value: 3.2, unit: 'days', top_drivers: [], exclusions: [], confidence: 'medium', n: 100 },
      accept_rate: { metric_name: 'Accept Rate', value: 80, unit: '%', top_drivers: [], exclusions: [], confidence: 'high', n: 25 },
      pipeline_health: { metric_name: 'Pipeline Health', value: null, unit: '', top_drivers: [], exclusions: [], confidence: 'low', n: 0 },
      source_effectiveness: { metric_name: 'Source Effectiveness', value: null, unit: '', top_drivers: [], exclusions: [], confidence: 'low', n: 0 },
    },
    actions: {
      top_p0: [],
      top_p1: [],
      by_owner_type: { recruiter: 8, hiring_manager: 5, ta_ops: 2 },
    },
    risks: {
      top_risks: [],
      by_failure_mode: {},
    },
    forecast: {
      expected_hires: 15,
      pipeline_gap: 5,
      confidence: 'medium',
      open_reqs: 20,
      active_candidates: 80,
      probability_weighted_pipeline: 15.5,
    },
    velocity: {
      funnel: [],
      bottleneck_stage: 'SCREEN',
      avg_days_to_offer: 28,
      avg_days_to_hire: 35,
    },
    sources: {
      top_by_volume: [],
      top_by_conversion: [],
      total_sources: 5,
    },
    capacity: {
      total_recruiters: 5,
      avg_req_load: 10,
      overloaded_count: 1,
      underloaded_count: 1,
    },
    glossary: [],
  };
}

function createValidAIResponse(): AskAIResponse {
  return {
    answer_markdown: 'Your median TTF is **42 days** [1], which is within the target range.',
    citations: [
      {
        ref: '[1]',
        key_path: 'control_tower.kpis.median_ttf.value',
        label: 'Median TTF',
        value: 42,
      },
    ],
    suggested_questions: ['What actions should I take?', 'Show me risks'],
    deep_links: [{ label: 'View Control Tower', tab: 'control-tower', params: {} }],
  };
}

// ─────────────────────────────────────────────────────────────
// Validation Tests
// ─────────────────────────────────────────────────────────────

describe('validateAIResponse', () => {
  const factPack = createMinimalFactPack();

  describe('citation validation', () => {
    it('should pass for valid citations with correct key paths', () => {
      const response = createValidAIResponse();
      const result = validateAIResponse(response, factPack);

      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('should fail when citations are missing', () => {
      const response: AskAIResponse = {
        answer_markdown: 'Your TTF is 42 days.',
        citations: [],
        suggested_questions: [],
        deep_links: [],
      };

      const result = validateAIResponse(response, factPack);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.type === 'MISSING_CITATIONS')).toBe(true);
    });

    it('should fail for invalid key paths', () => {
      const response: AskAIResponse = {
        answer_markdown: 'Your TTF is 42 days [1].',
        citations: [
          {
            ref: '[1]',
            key_path: 'invalid.nonexistent.path',
            label: 'Invalid',
            value: 42,
          },
        ],
        suggested_questions: [],
        deep_links: [],
      };

      const result = validateAIResponse(response, factPack);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.type === 'INVALID_KEY_PATH')).toBe(true);
    });

    it('should fail when cited value does not match Fact Pack value', () => {
      const response: AskAIResponse = {
        answer_markdown: 'Your TTF is 99 days [1].',
        citations: [
          {
            ref: '[1]',
            key_path: 'control_tower.kpis.median_ttf.value',
            label: 'Median TTF',
            value: 99, // Wrong value - actual is 42
          },
        ],
        suggested_questions: [],
        deep_links: [],
      };

      const result = validateAIResponse(response, factPack);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.type === 'VALUE_MISMATCH')).toBe(true);
    });

    it('should allow numeric tolerance for floating point values', () => {
      const response: AskAIResponse = {
        answer_markdown: 'HM latency is 3.2 days [1].',
        citations: [
          {
            ref: '[1]',
            key_path: 'control_tower.kpis.hm_latency.value',
            label: 'HM Latency',
            value: 3.21, // Close enough within tolerance
          },
        ],
        suggested_questions: [],
        deep_links: [],
      };

      const result = validateAIResponse(response, factPack);

      expect(result.valid).toBe(true);
    });
  });

  describe('hallucination detection', () => {
    it('should detect hallucinated numbers not in Fact Pack', () => {
      const response: AskAIResponse = {
        answer_markdown: 'Your TTF is **42 days** [1], and you have **999 candidates** waiting.',
        citations: [
          {
            ref: '[1]',
            key_path: 'control_tower.kpis.median_ttf.value',
            label: 'Median TTF',
            value: 42,
          },
        ],
        suggested_questions: [],
        deep_links: [],
      };

      const result = validateAIResponse(response, factPack);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.type === 'HALLUCINATED_NUMBER')).toBe(true);
    });

    it('should allow numbers that exist in the Fact Pack', () => {
      const response: AskAIResponse = {
        answer_markdown: 'You have **200 candidates** [1] across **50 reqs** [2].',
        citations: [
          {
            ref: '[1]',
            key_path: 'meta.sample_sizes.total_candidates',
            label: 'Total Candidates',
            value: 200,
          },
          {
            ref: '[2]',
            key_path: 'meta.sample_sizes.total_reqs',
            label: 'Total Reqs',
            value: 50,
          },
        ],
        suggested_questions: [],
        deep_links: [],
      };

      const result = validateAIResponse(response, factPack);

      expect(result.valid).toBe(true);
    });

    it('should skip common small numbers (1, 2, 3)', () => {
      const response: AskAIResponse = {
        answer_markdown: 'Here are 3 key points about your TTF of **42 days** [1].',
        citations: [
          {
            ref: '[1]',
            key_path: 'control_tower.kpis.median_ttf.value',
            label: 'Median TTF',
            value: 42,
          },
        ],
        suggested_questions: [],
        deep_links: [],
      };

      const result = validateAIResponse(response, factPack);

      expect(result.valid).toBe(true);
    });

    it('should skip years (2000-2100)', () => {
      const response: AskAIResponse = {
        answer_markdown: 'Data from 2024 shows TTF of **42 days** [1].',
        citations: [
          {
            ref: '[1]',
            key_path: 'control_tower.kpis.median_ttf.value',
            label: 'Median TTF',
            value: 42,
          },
        ],
        suggested_questions: [],
        deep_links: [],
      };

      const result = validateAIResponse(response, factPack);

      expect(result.valid).toBe(true);
    });
  });

  describe('validation result', () => {
    it('should set fallback_triggered when validation fails', () => {
      const response: AskAIResponse = {
        answer_markdown: 'Invalid response',
        citations: [],
        suggested_questions: [],
        deep_links: [],
      };

      const result = validateAIResponse(response, factPack);

      expect(result.fallback_triggered).toBe(true);
    });

    it('should not set fallback_triggered when validation passes', () => {
      const response = createValidAIResponse();
      const result = validateAIResponse(response, factPack);

      expect(result.fallback_triggered).toBe(false);
    });
  });
});

// ─────────────────────────────────────────────────────────────
// JSON Parsing Tests
// ─────────────────────────────────────────────────────────────

describe('parseAIResponseJSON', () => {
  it('should parse valid JSON response', () => {
    const jsonStr = JSON.stringify({
      answer_markdown: 'Test answer',
      citations: [{ ref: '[1]', key_path: 'test.path', label: 'Test', value: 123 }],
      suggested_questions: ['Q1?'],
      deep_links: [{ label: 'Link', tab: 'control-tower', params: {} }],
    });

    const result = parseAIResponseJSON(jsonStr);

    expect(result).not.toBeNull();
    expect(result?.answer_markdown).toBe('Test answer');
    expect(result?.citations.length).toBe(1);
  });

  it('should extract JSON from markdown code blocks', () => {
    const markdownWrapped = `Here is my response:
\`\`\`json
{
  "answer_markdown": "Extracted from markdown",
  "citations": [],
  "suggested_questions": [],
  "deep_links": []
}
\`\`\``;

    const result = parseAIResponseJSON(markdownWrapped);

    expect(result).not.toBeNull();
    expect(result?.answer_markdown).toBe('Extracted from markdown');
  });

  it('should return null for invalid JSON', () => {
    const result = parseAIResponseJSON('not valid json at all');
    expect(result).toBeNull();
  });

  it('should return null when answer_markdown is missing', () => {
    const jsonStr = JSON.stringify({
      citations: [],
      suggested_questions: [],
    });

    const result = parseAIResponseJSON(jsonStr);
    expect(result).toBeNull();
  });

  it('should return null when citations is not an array', () => {
    const jsonStr = JSON.stringify({
      answer_markdown: 'Test',
      citations: 'not an array',
    });

    const result = parseAIResponseJSON(jsonStr);
    expect(result).toBeNull();
  });

  it('should normalize citation fields with defaults', () => {
    const jsonStr = JSON.stringify({
      answer_markdown: 'Test',
      citations: [
        { key_path: 'test.path' }, // Missing ref, label, value
      ],
      suggested_questions: [],
      deep_links: [],
    });

    const result = parseAIResponseJSON(jsonStr);

    expect(result).not.toBeNull();
    expect(result?.citations[0].ref).toBe('[?]');
    expect(result?.citations[0].label).toBe('');
    expect(result?.citations[0].value).toBeNull();
  });

  it('should limit suggested questions to 3', () => {
    const jsonStr = JSON.stringify({
      answer_markdown: 'Test',
      citations: [],
      suggested_questions: ['Q1?', 'Q2?', 'Q3?', 'Q4?', 'Q5?'],
      deep_links: [],
    });

    const result = parseAIResponseJSON(jsonStr);

    expect(result?.suggested_questions?.length).toBe(3);
  });

  it('should handle missing optional fields', () => {
    const jsonStr = JSON.stringify({
      answer_markdown: 'Test',
      citations: [],
    });

    const result = parseAIResponseJSON(jsonStr);

    expect(result).not.toBeNull();
    expect(result?.suggested_questions).toEqual([]);
    expect(result?.deep_links).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────
// Fallback Response Tests
// ─────────────────────────────────────────────────────────────

describe('generateFallbackResponse', () => {
  it('should generate a response with error summary', () => {
    const errors = [
      { type: 'INVALID_KEY_PATH' as const, message: 'Bad path' },
      { type: 'VALUE_MISMATCH' as const, message: 'Wrong value' },
    ];

    const response = generateFallbackResponse('test query', errors);

    expect(response.answer_markdown).toContain('INVALID_KEY_PATH');
    expect(response.answer_markdown).toContain('VALUE_MISMATCH');
  });

  it('should include suggested questions', () => {
    const response = generateFallbackResponse('test', []);

    expect(response.suggested_questions.length).toBeGreaterThan(0);
  });

  it('should return empty citations and deep_links', () => {
    const response = generateFallbackResponse('test', []);

    expect(response.citations).toEqual([]);
    expect(response.deep_links).toEqual([]);
  });

  it('should limit error types shown to 3', () => {
    const errors = [
      { type: 'INVALID_KEY_PATH' as const, message: '1' },
      { type: 'VALUE_MISMATCH' as const, message: '2' },
      { type: 'HALLUCINATED_NUMBER' as const, message: '3' },
      { type: 'MISSING_CITATIONS' as const, message: '4' },
    ];

    const response = generateFallbackResponse('test', errors);

    // Should only show first 3
    expect(response.answer_markdown).not.toContain('MISSING_CITATIONS');
  });
});

// ─────────────────────────────────────────────────────────────
// Edge Cases
// ─────────────────────────────────────────────────────────────

describe('Edge Cases', () => {
  const factPack = createMinimalFactPack();

  it('should handle null citation values', () => {
    const response: AskAIResponse = {
      answer_markdown: 'Pipeline health is not available [1].',
      citations: [
        {
          ref: '[1]',
          key_path: 'explain.pipeline_health.value',
          label: 'Pipeline Health',
          value: null,
        },
      ],
      suggested_questions: [],
      deep_links: [],
    };

    const result = validateAIResponse(response, factPack);

    expect(result.valid).toBe(true);
  });

  it('should handle deeply nested key paths', () => {
    const response: AskAIResponse = {
      answer_markdown: 'Risk breakdown shows 3 zombie reqs [1].',
      citations: [
        {
          ref: '[1]',
          key_path: 'control_tower.risk_summary.by_type.zombie',
          label: 'Zombie Reqs',
          value: 3,
        },
      ],
      suggested_questions: [],
      deep_links: [],
    };

    const result = validateAIResponse(response, factPack);

    expect(result.valid).toBe(true);
  });

  it('should handle string comparisons case-insensitively', () => {
    // This tests the string comparison logic in the validation
    const response: AskAIResponse = {
      answer_markdown: 'Bottleneck stage is SCREEN [1].',
      citations: [
        {
          ref: '[1]',
          key_path: 'velocity.bottleneck_stage',
          label: 'Bottleneck',
          value: 'screen', // lowercase, should match SCREEN
        },
      ],
      suggested_questions: [],
      deep_links: [],
    };

    const result = validateAIResponse(response, factPack);

    expect(result.valid).toBe(true);
  });

  it('should handle percentage values correctly', () => {
    const response: AskAIResponse = {
      answer_markdown: 'Accept rate is **80%** [1].',
      citations: [
        {
          ref: '[1]',
          key_path: 'control_tower.kpis.accept_rate.value',
          label: 'Accept Rate',
          value: 80,
        },
      ],
      suggested_questions: [],
      deep_links: [],
    };

    const result = validateAIResponse(response, factPack);

    expect(result.valid).toBe(true);
  });
});
