// Smoke Tests for Ask PlatoVue Tab
// Tests component structure, intent routing, and AI/deterministic mode logic

import {
  handleDeterministicQuery,
  matchIntent,
  ALL_HANDLERS,
  generateHelpResponse,
} from '../../../services/askIntentService';
import { buildSimpleFactPack } from '../../../services/askFactPackService';
import { validateAIResponse, parseAIResponseJSON } from '../../../services/askValidationService';
import {
  Requisition,
  Candidate,
  User,
  RequisitionStatus,
  CandidateDisposition,
  CanonicalStage,
  Function,
  LocationType,
  LocationRegion,
  HeadcountType,
  UserRole,
} from '../../../types/entities';
import { AskFactPack, IntentResponse } from '../../../types/askTypes';

// ─────────────────────────────────────────────────────────────
// Test Fixtures
// ─────────────────────────────────────────────────────────────

function createMockRequisition(overrides: Partial<Requisition> = {}): Requisition {
  return {
    req_id: 'REQ-001',
    req_title: 'Software Engineer',
    function: Function.Engineering,
    job_family: 'Engineering',
    level: 'L4',
    location_type: LocationType.Remote,
    location_region: LocationRegion.AMER,
    location_city: null,
    comp_band_min: 100000,
    comp_band_max: 150000,
    opened_at: new Date('2024-01-01'),
    closed_at: null,
    status: RequisitionStatus.Open,
    hiring_manager_id: 'HM-001',
    recruiter_id: 'REC-001',
    business_unit: 'Product',
    headcount_type: HeadcountType.New,
    priority: null,
    candidate_slate_required: false,
    search_firm_used: false,
    ...overrides,
  };
}

function createMockCandidate(overrides: Partial<Candidate> = {}): Candidate {
  return {
    candidate_id: 'CAN-001',
    req_id: 'REQ-001',
    name: 'Test Candidate',
    email: 'test@example.com',
    phone: null,
    source: 'LinkedIn',
    applied_at: new Date('2024-01-15'),
    hired_at: null,
    current_stage: CanonicalStage.SCREEN,
    current_stage_entered_at: new Date('2024-01-16'),
    disposition: CandidateDisposition.Active,
    recruiter_id: 'REC-001',
    first_contacted_at: null,
    offer_extended_at: null,
    rejected_at: null,
    withdrawn_at: null,
    ...overrides,
  };
}

function createMockUser(overrides: Partial<User> = {}): User {
  return {
    user_id: 'REC-001',
    name: 'Jane Recruiter',
    role: UserRole.Recruiter,
    team: 'TA Team',
    manager_user_id: null,
    email: 'jane@company.com',
    ...overrides,
  };
}

function createTestFactPack(): AskFactPack {
  return buildSimpleFactPack({
    requisitions: [createMockRequisition()],
    candidates: [createMockCandidate()],
    events: [],
    users: [createMockUser()],
    aiEnabled: false,
    dataHealthScore: 85,
  });
}

// ─────────────────────────────────────────────────────────────
// AI-OFF Mode Tests
// ─────────────────────────────────────────────────────────────

describe('Ask PlatoVue - AI-OFF Mode', () => {
  const factPack = createTestFactPack();

  describe('suggested question handling', () => {
    it('handles "what\'s on fire" query', () => {
      const response = handleDeterministicQuery("what's on fire?", factPack);

      expect(response.answer_markdown).toContain('What\'s On Fire');
      expect(response.deep_links.length).toBeGreaterThan(0);
    });

    it('handles "top risks" query', () => {
      const response = handleDeterministicQuery('show me my top risks', factPack);

      expect(response.answer_markdown).toContain('Top Risks');
    });

    it('handles "actions" query', () => {
      const response = handleDeterministicQuery('what should I do today?', factPack);

      expect(response.answer_markdown).toContain('Actions');
    });

    it('handles "time to offer" query', () => {
      const response = handleDeterministicQuery('why is time to offer so high?', factPack);

      expect(response.answer_markdown).toContain('Time to Offer');
    });

    it('handles "HM latency" query', () => {
      const response = handleDeterministicQuery('why is HM latency elevated?', factPack);

      expect(response.answer_markdown).toContain('HM Latency');
    });

    it('handles "stalled reqs" query', () => {
      const response = handleDeterministicQuery('which reqs are stalled?', factPack);

      expect(response.answer_markdown).toContain('Stalled');
    });

    it('handles "forecast" query', () => {
      const response = handleDeterministicQuery('what is my forecast gap?', factPack);

      expect(response.answer_markdown).toContain('Forecast');
    });

    it('handles "velocity" query', () => {
      const response = handleDeterministicQuery('how is my pipeline velocity?', factPack);

      expect(response.answer_markdown).toContain('Velocity');
    });

    it('handles "source mix" query', () => {
      const response = handleDeterministicQuery('how is my source mix performing?', factPack);

      expect(response.answer_markdown).toContain('Source');
    });

    it('handles "capacity" query', () => {
      const response = handleDeterministicQuery('how is recruiter capacity looking?', factPack);

      expect(response.answer_markdown).toContain('Capacity');
    });
  });

  describe('unmatched query handling', () => {
    it('returns help response for random queries', () => {
      const response = handleDeterministicQuery('gibberish xyz random', factPack);

      expect(response.answer_markdown).toContain('Ask PlatoVue');
      expect(response.suggested_questions).toBeDefined();
      expect(response.suggested_questions!.length).toBeGreaterThan(0);
    });
  });

  describe('response structure', () => {
    it('all handlers return valid response structure', () => {
      ALL_HANDLERS.forEach(handler => {
        const response = handler.handler(factPack);

        // Required fields
        expect(response.answer_markdown).toBeDefined();
        expect(typeof response.answer_markdown).toBe('string');
        expect(response.citations).toBeDefined();
        expect(Array.isArray(response.citations)).toBe(true);
        expect(response.deep_links).toBeDefined();
        expect(Array.isArray(response.deep_links)).toBe(true);
      });
    });

    it('citations have valid structure', () => {
      ALL_HANDLERS.forEach(handler => {
        const response = handler.handler(factPack);

        response.citations.forEach(citation => {
          expect(citation.ref).toBeDefined();
          expect(citation.key_path).toBeDefined();
          expect(citation.label).toBeDefined();
        });
      });
    });

    it('deep links have valid structure', () => {
      ALL_HANDLERS.forEach(handler => {
        const response = handler.handler(factPack);

        response.deep_links.forEach(link => {
          expect(link.label).toBeDefined();
          expect(link.tab).toBeDefined();
          expect(link.params).toBeDefined();
        });
      });
    });
  });
});

// ─────────────────────────────────────────────────────────────
// AI-ON Mode Tests (Validation)
// ─────────────────────────────────────────────────────────────

describe('Ask PlatoVue - AI-ON Mode', () => {
  const factPack = createTestFactPack();

  describe('valid AI response handling', () => {
    it('accepts response with valid citations', () => {
      const response = {
        answer_markdown: 'Your data has **1 requisition** [1].',
        citations: [
          {
            ref: '[1]',
            key_path: 'meta.sample_sizes.total_reqs',
            label: 'Total Reqs',
            value: 1,
          },
        ],
        suggested_questions: [],
        deep_links: [],
      };

      const result = validateAIResponse(response, factPack);

      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });
  });

  describe('invalid AI response handling', () => {
    it('rejects response with no citations', () => {
      const response = {
        answer_markdown: 'Here is some info.',
        citations: [],
        suggested_questions: [],
        deep_links: [],
      };

      const result = validateAIResponse(response, factPack);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.type === 'MISSING_CITATIONS')).toBe(true);
    });

    it('is lenient with invalid key paths', () => {
      // Validation is now lenient - INVALID_KEY_PATH errors are logged but don't fail
      const response = {
        answer_markdown: 'The value is 42 [1].',
        citations: [
          {
            ref: '[1]',
            key_path: 'invalid.path.here',
            label: 'Invalid',
            value: 42,
          },
        ],
        suggested_questions: [],
        deep_links: [],
      };

      const result = validateAIResponse(response, factPack);

      // Should pass because key path errors are treated leniently
      expect(result.valid).toBe(true);
    });

    it('allows a few uncited numbers (lenient hallucination detection)', () => {
      // Validation allows up to 5 uncited numbers (AI may use contextual numbers)
      const response = {
        answer_markdown: 'You have **999 hires** and **1 req** [1].',
        citations: [
          {
            ref: '[1]',
            key_path: 'meta.sample_sizes.total_reqs',
            label: 'Total Reqs',
            value: 1,
          },
        ],
        suggested_questions: [],
        deep_links: [],
      };

      const result = validateAIResponse(response, factPack);

      // Should pass because only 1 uncited number (999), which is below threshold of 5
      expect(result.valid).toBe(true);
    });
  });

  describe('fallback behavior', () => {
    it('sets fallback_triggered when validation fails', () => {
      const response = {
        answer_markdown: 'Invalid response',
        citations: [],
        suggested_questions: [],
        deep_links: [],
      };

      const result = validateAIResponse(response, factPack);

      expect(result.fallback_triggered).toBe(true);
    });
  });

  describe('JSON parsing', () => {
    it('parses valid JSON response', () => {
      const json = JSON.stringify({
        answer_markdown: 'Test',
        citations: [],
        suggested_questions: [],
        deep_links: [],
      });

      const result = parseAIResponseJSON(json);

      expect(result).not.toBeNull();
      expect(result?.answer_markdown).toBe('Test');
    });

    it('extracts JSON from markdown code blocks', () => {
      const markdown = `\`\`\`json
{
  "answer_markdown": "Extracted",
  "citations": [],
  "suggested_questions": [],
  "deep_links": []
}
\`\`\``;

      const result = parseAIResponseJSON(markdown);

      expect(result).not.toBeNull();
      expect(result?.answer_markdown).toBe('Extracted');
    });

    it('returns null for invalid JSON', () => {
      const result = parseAIResponseJSON('not json');

      expect(result).toBeNull();
    });
  });
});

// ─────────────────────────────────────────────────────────────
// Intent Matching Tests
// ─────────────────────────────────────────────────────────────

describe('Intent Matching', () => {
  describe('pattern matching', () => {
    it.each([
      ["what's on fire", 'whats_on_fire'],
      ['urgent issues', 'whats_on_fire'],
      ['show me risks', 'top_risks'],
      ['my actions', 'top_actions'],
      ['time to offer', 'why_time_to_offer'],
      ['hm latency', 'why_hm_latency'],
      ['stalled reqs', 'stalled_reqs'],
      ['forecast gap', 'forecast_gap'],
      ['velocity', 'velocity_summary'],
      ['sources', 'source_mix_summary'],
      ['capacity', 'capacity_summary'],
    ])('matches "%s" to %s', (query, expectedIntent) => {
      const result = matchIntent(query, ALL_HANDLERS);
      expect(result?.intent_id).toBe(expectedIntent);
    });
  });

  describe('case insensitivity', () => {
    it('matches regardless of case', () => {
      expect(matchIntent("WHAT'S ON FIRE", ALL_HANDLERS)?.intent_id).toBe('whats_on_fire');
      expect(matchIntent('RISKS', ALL_HANDLERS)?.intent_id).toBe('top_risks');
    });
  });

  describe('no match handling', () => {
    it('returns null for unrelated queries', () => {
      expect(matchIntent('what is the weather', ALL_HANDLERS)).toBeNull();
      expect(matchIntent('hello world', ALL_HANDLERS)).toBeNull();
    });
  });
});

// ─────────────────────────────────────────────────────────────
// Fact Pack Building Tests
// ─────────────────────────────────────────────────────────────

describe('Fact Pack Building', () => {
  it('builds fact pack from minimal data', () => {
    const factPack = buildSimpleFactPack({
      requisitions: [],
      candidates: [],
      events: [],
      users: [],
      aiEnabled: false,
      dataHealthScore: 100,
    });

    expect(factPack).toBeDefined();
    expect(factPack.meta).toBeDefined();
    expect(factPack.control_tower).toBeDefined();
    expect(factPack.glossary.length).toBeGreaterThan(0);
  });

  it('includes sample sizes', () => {
    const factPack = buildSimpleFactPack({
      requisitions: [createMockRequisition()],
      candidates: [createMockCandidate(), createMockCandidate({ candidate_id: 'CAN-002' })],
      events: [],
      users: [createMockUser()],
      aiEnabled: true,
      dataHealthScore: 85,
    });

    expect(factPack.meta.sample_sizes.total_reqs).toBe(1);
    expect(factPack.meta.sample_sizes.total_candidates).toBe(2);
    expect(factPack.meta.capability_flags.ai_enabled).toBe(true);
  });

  it('does not include PII', () => {
    const factPack = buildSimpleFactPack({
      requisitions: [createMockRequisition({ hiring_manager_id: 'HM-001' })],
      candidates: [createMockCandidate({ email: 'secret@example.com' })],
      events: [],
      users: [createMockUser({ email: 'recruiter@company.com', name: 'Jane Smith' })],
      aiEnabled: false,
      dataHealthScore: 85,
    });

    const json = JSON.stringify(factPack);

    // Should not contain emails
    expect(json).not.toContain('secret@example.com');
    expect(json).not.toContain('recruiter@company.com');

    // Recruiter names should be anonymized
    expect(json).not.toContain('Jane Smith');
  });
});

// ──────────────────────────────────────────────────��──────────
// Deep Link Tests
// ─────────────────────────────────────────────────────────────

describe('Deep Links', () => {
  const factPack = createTestFactPack();

  it('all handlers include deep links', () => {
    ALL_HANDLERS.forEach(handler => {
      const response = handler.handler(factPack);
      expect(response.deep_links.length).toBeGreaterThan(0);
    });
  });

  it('deep links have valid tab values', () => {
    const validTabs = [
      'control-tower',
      'velocity-insights',
      'velocity',
      'hm-friction',
      'hiring-managers',
      'source-effectiveness',
      'source-mix',
      'forecasting',
      'data-health',
      'recruiter',
      'capacity',
      'overview',
    ];

    ALL_HANDLERS.forEach(handler => {
      const response = handler.handler(factPack);
      response.deep_links.forEach(link => {
        expect(validTabs.some(t => link.tab.includes(t) || link.tab === t)).toBe(true);
      });
    });
  });
});

// ─────────────────────────────────────────────────────────────
// Citation Validation - Unresolvable Deep Links
// ─────────────────────────────────────────────────────────────

describe('Citation Validation - Deep Link Resolution', () => {
  const factPack = createTestFactPack();

  it('is lenient with all key paths to allow AI flexibility', () => {
    // Validation is now lenient with key paths - INVALID_KEY_PATH errors are logged but don't fail
    const response = {
      answer_markdown: 'Test [1].',
      citations: [
        {
          ref: '[1]',
          key_path: 'some.unresolvable.path',  // Invalid path - treated leniently
          label: 'Test',
          value: 1,
        },
      ],
      suggested_questions: [],
      deep_links: [],
    };

    const result = validateAIResponse(response, factPack);

    // Should pass because validation is lenient with key paths
    expect(result.valid).toBe(true);
  });

  it('is lenient with simple invalid key paths too', () => {
    // Even simple key paths without dots are treated leniently (logged but not failed)
    const response = {
      answer_markdown: 'Test [1].',
      citations: [
        {
          ref: '[1]',
          key_path: 'invalid_single_key',  // No dots or brackets - still lenient
          label: 'Test',
          value: 1,
        },
      ],
      suggested_questions: [],
      deep_links: [],
    };

    const result = validateAIResponse(response, factPack);

    // Should pass because INVALID_KEY_PATH errors are logged but not added to fail validation
    expect(result.valid).toBe(true);
  });

  it('accepts citations with valid mappable key paths', () => {
    const response = {
      answer_markdown: 'You have **1 req** [1].',
      citations: [
        {
          ref: '[1]',
          key_path: 'control_tower.kpis.stalled_reqs.value',
          label: 'Stalled Reqs',
          value: factPack.control_tower.kpis.stalled_reqs.value,
        },
      ],
      suggested_questions: [],
      deep_links: [],
    };

    const result = validateAIResponse(response, factPack);

    expect(result.valid).toBe(true);
    expect(result.errors.length).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────
// Fallback Response - No Internal Error Details
// ─────────────────────────────────────────────────────────────

describe('Fallback Response - Clean User Output', () => {
  it('fallback response does not expose internal error types', () => {
    const errors = [
      { type: 'INVALID_KEY_PATH' as const, message: 'Internal error details here' },
    ];

    // The fallback response should be clean
    const fallback = require('../../../services/askValidationService').generateFallbackResponse(
      'test query',
      errors
    );

    // Should not contain stack traces or detailed error messages
    expect(fallback.answer_markdown).not.toContain('stack');
    expect(fallback.answer_markdown).not.toContain('Error:');
    expect(fallback.answer_markdown).not.toContain('Internal');

    // Should have suggested questions for user to try
    expect(fallback.suggested_questions.length).toBeGreaterThan(0);
  });

  it('deterministic handlers produce clean markdown without internal notes', () => {
    const factPack = createTestFactPack();

    ALL_HANDLERS.forEach(handler => {
      const response = handler.handler(factPack);

      // Should not contain internal error text
      expect(response.answer_markdown).not.toContain('processing issue');
      expect(response.answer_markdown).not.toContain('guided mode due to');
      expect(response.answer_markdown).not.toContain('*Note:');
    });
  });
});

// ─────────────────────────────────────────────────────────────
// Filter Context Preservation
// ─────────────────────────────────────────────────────────────

describe('Filter Context Preservation', () => {
  it('fact pack includes filter context', () => {
    const factPackWithFilters = buildSimpleFactPack({
      requisitions: [createMockRequisition()],
      candidates: [createMockCandidate()],
      events: [],
      users: [createMockUser()],
      aiEnabled: false,
      dataHealthScore: 85,
      filters: {
        recruiterIds: ['REC-001'],
        dateRange: { startDate: new Date('2024-01-01'), endDate: new Date('2024-06-30') },
        functions: ['Engineering'],
        regions: ['AMER'],
      },
    });

    expect(factPackWithFilters.meta.filter_context).toBeDefined();
    expect(factPackWithFilters.meta.filter_context.recruiter_ids).toContain('REC-001');
    expect(factPackWithFilters.meta.filter_context.date_range_start).toBe('2024-01-01');
    expect(factPackWithFilters.meta.filter_context.date_range_end).toBe('2024-06-30');
    expect(factPackWithFilters.meta.filter_context.functions).toContain('Engineering');
    expect(factPackWithFilters.meta.filter_context.regions).toContain('AMER');
  });

  it('deep links include filter params when context has filters', () => {
    const factPackWithFilters = buildSimpleFactPack({
      requisitions: [createMockRequisition()],
      candidates: [createMockCandidate()],
      events: [],
      users: [createMockUser()],
      aiEnabled: false,
      dataHealthScore: 85,
      filters: {
        recruiterIds: ['REC-001', 'REC-002'],
        functions: ['Engineering'],
      },
    });

    // Generate a response using a handler
    const response = ALL_HANDLERS[0].handler(factPackWithFilters);

    // Deep links should have params that include filter context
    expect(response.deep_links.length).toBeGreaterThan(0);
    const deepLink = response.deep_links[0];

    // Filter params should be present in the deep link
    expect(deepLink.params.recruiterIds).toBe('REC-001,REC-002');
    expect(deepLink.params.functions).toBe('Engineering');
  });
});
