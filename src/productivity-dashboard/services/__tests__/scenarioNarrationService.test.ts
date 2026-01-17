/**
 * Scenario Narration Service Tests
 *
 * Tests AI narration integration, validation, and fallback behavior.
 */

import {
  buildNarrationInput,
  validateNarrationOutput,
  generateDeterministicNarration,
  isNarrationAvailable,
  ScenarioNarrationInput,
  ScenarioNarrationOutput,
} from '../scenarioNarrationService';
import { ScenarioOutput, Feasibility } from '../../types/scenarioTypes';
import { AiProviderConfig } from '../../types/aiTypes';

// ===== MOCK DATA FACTORIES =====

function mockScenarioOutput(overrides: Partial<ScenarioOutput> = {}): ScenarioOutput {
  return {
    scenario_id: 'spin_up_team',
    scenario_name: 'Spin Up Team: Engineering',
    generated_at: new Date(),
    feasibility: 'ON_TRACK',
    deltas: {
      expected_hires_delta: 5,
      offers_delta: 7,
      pipeline_gap_delta: -10,
      time_to_offer_delta: 3,
    },
    bottlenecks: [
      {
        rank: 1,
        constraint_type: 'CAPACITY_GAP',
        description: 'Recruiting team at 95% utilization',
        severity: 'HIGH',
        evidence: {
          metric_key: 'capacity.team_utilization',
          current_value: 0.95,
          threshold: 0.85,
          source_citation: 'capacity.team_utilization',
        },
        mitigation: 'Consider hiring additional recruiter',
      },
      {
        rank: 2,
        constraint_type: 'PIPELINE_DEPTH',
        description: 'Insufficient senior candidates in pipeline',
        severity: 'MEDIUM',
        evidence: {
          metric_key: 'pipeline.senior_count',
          current_value: 12,
          threshold: 20,
          source_citation: 'pipeline.senior_count',
        },
        mitigation: 'Increase sourcing for senior roles',
      },
    ],
    resource_impact: {
      team_utilization_delta: 0.15,
      recruiter_impacts: [
        {
          recruiter_id: 'rec-123',
          recruiter_name_anon: 'Recruiter 1',
          current_utilization: 0.85,
          projected_utilization: 1.0,
          status_change: 'BECOMES_OVERLOADED',
        },
      ],
    },
    action_plan: [
      {
        action_id: 'act-1',
        owner_type: 'RECRUITER',
        owner_id: 'rec-123',
        owner_name: 'Recruiter 1',
        req_id: 'req-1',
        action_type: 'SOURCE_CANDIDATES',
        title: 'Source senior candidates',
        priority: 'P0',
        due_in_days: 5,
        due_date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        evidence: {
          provider_id: 'spin_up_team',
          metric_key: 'pipeline.senior_count',
          value: 12,
          formatted_value: '12 candidates',
          threshold: 20,
          status: 'below_threshold',
        },
        recommended_steps: ['Expand sourcing channels', 'Consider agency support'],
        status: 'OPEN',
      },
      {
        action_id: 'act-2',
        owner_type: 'TA_OPS',
        owner_id: 'ops-1',
        owner_name: 'TA Ops',
        req_id: 'general',
        action_type: 'PROCESS_OPTIMIZATION',
        title: 'Review hiring process efficiency',
        priority: 'P1',
        due_in_days: 10,
        due_date: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
        evidence: {
          provider_id: 'spin_up_team',
          metric_key: 'velocity.avg_days_to_hire',
          value: 45,
          formatted_value: '45 days',
          threshold: 35,
          status: 'above_threshold',
        },
        recommended_steps: ['Analyze bottleneck stages'],
        status: 'OPEN',
      },
    ],
    confidence: {
      level: 'MED',
      reasons: ['Historical hire data meets minimum threshold', 'Some pipeline stages have limited samples'],
      sample_sizes: [
        { metric_key: 'historical_hires', n: 15, threshold: 5, sufficient: true },
        { metric_key: 'pipeline_conversion', n: 8, threshold: 10, sufficient: false },
      ],
    },
    citations: [
      { key_path: 'capacity.team_utilization', label: 'Team Utilization', value: 0.95, source_service: 'capacity_fit_engine' },
      { key_path: 'pipeline.senior_count', label: 'Senior Candidates', value: 12, source_service: 'forecasting_service' },
    ],
    deep_links: [
      { label: 'View Capacity', tab: 'capacity', params: {}, rationale: 'Review recruiter loads' },
    ],
    blocked: null,
    ...overrides,
  };
}

function mockNarrationInput(overrides: Partial<ScenarioNarrationInput> = {}): ScenarioNarrationInput {
  return {
    scenario_id: 'spin_up_team',
    scenario_name: 'Spin Up Team: Engineering',
    parameters_redacted: {
      headcount: 5,
      target_days: 60,
    },
    output: {
      feasibility: 'ON_TRACK',
      deltas: {
        expected_hires_delta: 5,
        offers_delta: 7,
        pipeline_gap_delta: -10,
        time_to_offer_delta: 3,
      },
      bottlenecks: [
        {
          rank: 1,
          constraint_type: 'CAPACITY_GAP',
          description: 'Team at capacity',
          severity: 'HIGH',
          mitigation: 'Add recruiter',
        },
      ],
      resource_impact: { team_utilization_delta: 0.15 },
      confidence: { level: 'MED', reasons: ['Limited samples'] },
      action_plan_summary: {
        total_actions: 2,
        p0_count: 1,
        p1_count: 1,
        p2_count: 0,
      },
    },
    valid_citation_keys: [
      'capacity.team_utilization',
      'pipeline.senior_count',
      'scenario.feasibility',
      'scenario.confidence',
      'scenario.deltas',
      'scenario.bottlenecks',
      'scenario.action_plan',
    ],
    ...overrides,
  };
}

function mockAiConfig(): AiProviderConfig {
  return {
    provider: 'openai',
    model: 'gpt-4',
    apiKey: 'test-key',
    baseUrl: 'https://api.openai.com/v1',
  };
}

// ===== TESTS =====

describe('ScenarioNarrationService', () => {
  describe('buildNarrationInput', () => {
    it('redacts recruiter IDs from resource impact', () => {
      const output = mockScenarioOutput();
      const input = buildNarrationInput(output);

      // Resource impact should have team delta but no recruiter IDs
      expect(input.output.resource_impact).not.toBeNull();
      expect(input.output.resource_impact?.team_utilization_delta).toBe(0.15);
      expect(input.output.resource_impact).not.toHaveProperty('recruiter_impacts');
    });

    it('includes valid citation keys from output citations', () => {
      const output = mockScenarioOutput();
      const input = buildNarrationInput(output);

      expect(input.valid_citation_keys).toContain('capacity.team_utilization');
      expect(input.valid_citation_keys).toContain('pipeline.senior_count');
    });

    it('includes standard citation keys', () => {
      const output = mockScenarioOutput();
      const input = buildNarrationInput(output);

      expect(input.valid_citation_keys).toContain('scenario.feasibility');
      expect(input.valid_citation_keys).toContain('scenario.confidence');
      expect(input.valid_citation_keys).toContain('scenario.deltas');
    });

    it('summarizes action plan by priority', () => {
      const output = mockScenarioOutput();
      const input = buildNarrationInput(output);

      expect(input.output.action_plan_summary.total_actions).toBe(2);
      expect(input.output.action_plan_summary.p0_count).toBe(1);
      expect(input.output.action_plan_summary.p1_count).toBe(1);
    });

    it('redacts bottleneck recruiter IDs', () => {
      const output = mockScenarioOutput();
      const input = buildNarrationInput(output);

      // Bottlenecks should not have any recruiter IDs
      for (const bottleneck of input.output.bottlenecks) {
        expect(bottleneck).not.toHaveProperty('recruiter_id');
        expect(JSON.stringify(bottleneck)).not.toContain('rec-');
      }
    });
  });

  describe('validateNarrationOutput', () => {
    it('validates that all citations exist in input', () => {
      const input = mockNarrationInput();
      const output: ScenarioNarrationOutput = {
        headline: 'Test headline',
        bullets: [
          { text: 'Valid citation', citation: 'capacity.team_utilization' },
          { text: 'Invalid citation', citation: 'nonexistent.key' },
        ],
        asks: ['Ask 1', 'Ask 2'],
        caveats: ['Caveat 1'],
      };

      const result = validateNarrationOutput(output, input);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid citation: nonexistent.key');
    });

    it('passes validation with all valid citations', () => {
      const input = mockNarrationInput();
      const output: ScenarioNarrationOutput = {
        headline: 'Test headline',
        bullets: [
          { text: 'Valid citation', citation: 'capacity.team_utilization' },
          { text: 'Another valid', citation: 'scenario.feasibility' },
        ],
        asks: ['Ask 1'],
        caveats: ['Caveat 1'],
      };

      const result = validateNarrationOutput(output, input);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('fails validation for missing headline', () => {
      const input = mockNarrationInput();
      const output: ScenarioNarrationOutput = {
        headline: '',
        bullets: [{ text: 'Bullet', citation: 'scenario.feasibility' }],
        asks: ['Ask 1'],
        caveats: ['Caveat 1'],
      };

      const result = validateNarrationOutput(output, input);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing headline');
    });

    it('fails validation for empty bullets', () => {
      const input = mockNarrationInput();
      const output: ScenarioNarrationOutput = {
        headline: 'Test',
        bullets: [],
        asks: ['Ask 1'],
        caveats: ['Caveat 1'],
      };

      const result = validateNarrationOutput(output, input);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('No bullets provided');
    });

    it('fails validation for bullet without citation', () => {
      const input = mockNarrationInput();
      const output: ScenarioNarrationOutput = {
        headline: 'Test',
        bullets: [{ text: 'Bullet', citation: '' }],
        asks: ['Ask 1'],
        caveats: ['Caveat 1'],
      };

      const result = validateNarrationOutput(output, input);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Bullet missing citation');
    });
  });

  describe('generateDeterministicNarration', () => {
    it('generates headline with feasibility', () => {
      const output = mockScenarioOutput({ feasibility: 'AT_RISK' });
      const narration = generateDeterministicNarration(output);

      // Uses formatted text, not raw enum - "Needs attention" for AT_RISK
      expect(narration.headline).toContain('Needs attention');
    });

    it('generates bullets for feasibility', () => {
      const output = mockScenarioOutput({ feasibility: 'ON_TRACK' });
      const narration = generateDeterministicNarration(output);

      const feasibilityBullet = narration.bullets.find(b => b.citation === 'scenario.feasibility');
      expect(feasibilityBullet).toBeDefined();
      // Uses plain English: "This plan looks doable"
      expect(feasibilityBullet?.text).toContain('doable');
    });

    it('generates bullets for top bottlenecks', () => {
      const output = mockScenarioOutput();
      const narration = generateDeterministicNarration(output);

      const bottleneckBullets = narration.bullets.filter(
        b => b.text.includes('risk') || b.citation.includes('bottleneck')
      );
      expect(bottleneckBullets.length).toBeGreaterThanOrEqual(1);
    });

    it('generates bullet for action plan when actions exist', () => {
      const output = mockScenarioOutput();
      const narration = generateDeterministicNarration(output);

      const actionBullet = narration.bullets.find(b => b.citation === 'scenario.action_plan');
      expect(actionBullet).toBeDefined();
      // Uses "Next step:" prefix
      expect(actionBullet?.text).toContain('Next step');
    });

    it('generates appropriate asks for IMPOSSIBLE feasibility', () => {
      const output = mockScenarioOutput({ feasibility: 'IMPOSSIBLE' });
      const narration = generateDeterministicNarration(output);

      expect(narration.asks.length).toBeGreaterThan(0);
      // Asks about adjusting target or adding recruiters
      expect(narration.asks.some(a => a.toLowerCase().includes('adjust') || a.toLowerCase().includes('recruiter'))).toBe(true);
    });

    it('generates appropriate asks for ON_TRACK feasibility', () => {
      const output = mockScenarioOutput({ feasibility: 'ON_TRACK' });
      const narration = generateDeterministicNarration(output);

      expect(narration.asks.length).toBeGreaterThan(0);
      // Asks "Ready to kick this off?"
      expect(narration.asks.some(a => a.toLowerCase().includes('ready') || a.toLowerCase().includes('kick'))).toBe(true);
    });

    it('always includes data caveat', () => {
      const output = mockScenarioOutput();
      const narration = generateDeterministicNarration(output);

      // Uses plain English: "Based on past performance. Results may vary."
      expect(narration.caveats.some(c => c.toLowerCase().includes('past performance') || c.toLowerCase().includes('results may vary'))).toBe(true);
    });

    it('includes confidence-based caveat for LOW confidence', () => {
      const output = mockScenarioOutput({ confidence: { level: 'LOW', reasons: ['Test'], sample_sizes: [] } });
      const narration = generateDeterministicNarration(output);

      // Uses plain English: "Limited data makes this estimate rough."
      expect(narration.caveats.some(c => c.toLowerCase().includes('limited data') || c.toLowerCase().includes('rough'))).toBe(true);
    });

    it('has minimum required bullets', () => {
      const output = mockScenarioOutput();
      const narration = generateDeterministicNarration(output);

      // Should have at least 3 bullets (feasibility, bottleneck, action/deltas)
      expect(narration.bullets.length).toBeGreaterThanOrEqual(3);
    });

    it('includes deltas summary when deltas exist', () => {
      const output = mockScenarioOutput({
        deltas: {
          expected_hires_delta: 5,
          offers_delta: null,
          pipeline_gap_delta: -10,
          time_to_offer_delta: null,
        },
      });
      const narration = generateDeterministicNarration(output);

      const deltasBullet = narration.bullets.find(b => b.citation === 'scenario.deltas');
      expect(deltasBullet).toBeDefined();
      // Uses plain English: "This would add 5 hires."
      expect(deltasBullet?.text).toContain('hires');
    });
  });

  describe('isNarrationAvailable', () => {
    it('returns false for null config', () => {
      expect(isNarrationAvailable(null)).toBe(false);
    });

    it('returns false for empty API key', () => {
      const config = { ...mockAiConfig(), apiKey: '' };
      expect(isNarrationAvailable(config)).toBe(false);
    });

    it('returns false for whitespace-only API key', () => {
      const config = { ...mockAiConfig(), apiKey: '   ' };
      expect(isNarrationAvailable(config)).toBe(false);
    });

    it('returns true for valid config with API key', () => {
      const config = mockAiConfig();
      expect(isNarrationAvailable(config)).toBe(true);
    });
  });

  describe('PII redaction', () => {
    it('does not leak recruiter IDs in narration input', () => {
      const output = mockScenarioOutput();
      const input = buildNarrationInput(output);

      const inputString = JSON.stringify(input);
      expect(inputString).not.toContain('rec-123');
    });

    it('uses anonymized names in bottleneck descriptions', () => {
      const output = mockScenarioOutput({
        bottlenecks: [
          {
            rank: 1,
            constraint_type: 'CAPACITY_GAP',
            description: 'Recruiter 1 is overloaded',
            severity: 'HIGH',
            evidence: {
              metric_key: 'capacity.rec1_utilization',
              current_value: 1.1,
              threshold: 0.85,
              source_citation: 'capacity.rec1_utilization',
            },
            mitigation: 'Redistribute load',
          },
        ],
      });

      const input = buildNarrationInput(output);

      // Description may contain anonymized names (Recruiter 1) but not real IDs
      for (const bottleneck of input.output.bottlenecks) {
        expect(bottleneck.description).not.toMatch(/rec-[a-zA-Z0-9]+/);
      }
    });
  });
});
