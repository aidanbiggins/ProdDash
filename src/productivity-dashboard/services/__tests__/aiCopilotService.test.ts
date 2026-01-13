// AI Copilot Service Tests
// Tests redaction, summary generation, and draft message creation
// IMPORTANT: No real API calls are made - aiService is mocked

import {
  explanationToRedactedText,
  actionToRedactedText,
  generateExplanationSummary,
  generateDraftMessage,
} from '../aiCopilotService';
import * as aiService from '../aiService';
import { Explanation } from '../../types/explainTypes';
import { ActionItem } from '../../types/actionTypes';
import { AiProviderConfig, AiResponse } from '../../types/aiTypes';

// Mock the aiService module
jest.mock('../aiService');
const mockSendAiRequest = aiService.sendAiRequest as jest.MockedFunction<typeof aiService.sendAiRequest>;

// Sample Explanation for testing
const createMockExplanation = (overrides: Partial<Explanation> = {}): Explanation => ({
  metricId: 'time_to_offer',
  metricLabel: 'Time to Offer',
  status: 'ready',
  value: 42,
  unit: 'days',
  formula: 'Median(offer_sent_at - applied_at)',
  dateRange: {
    start: new Date('2024-01-01'),
    end: new Date('2024-03-31'),
  },
  includedCount: 50,
  excludedCount: 10,
  exclusionReasons: [
    { reason: 'missing offer date', count: 5 },
    { reason: 'zombie requisition', count: 5 },
  ],
  confidenceGrade: 'high',
  confidenceNote: 'Large sample size with complete data',
  breakdown: [
    { label: 'Application to Interview', value: 14, unit: 'days' },
    { label: 'Interview to Offer', value: 28, unit: 'days' },
  ],
  topContributors: [
    { id: 'app-123', label: 'John Smith - Senior Engineer', value: 60, included: true },
    { id: 'app-456', label: 'Jane Doe - Product Manager', value: 55, included: true },
    { id: 'app-789', label: 'Bob Johnson - Designer', value: 50, included: true },
  ],
  recommendedActions: [
    { action: 'Review interview scheduling process', priority: 'high', reason: 'Long interview phase' },
    { action: 'Speed up offer approval workflow', priority: 'medium' },
  ],
  computedAt: new Date('2024-04-01T10:00:00Z'),
  ...overrides,
});

// Sample ActionItem for testing
const createMockAction = (overrides: Partial<ActionItem> = {}): ActionItem => ({
  action_id: 'action_abc123',
  owner_type: 'HIRING_MANAGER',
  owner_id: 'user-456',
  owner_name: 'Alice Manager',
  req_id: 'req-789',
  req_title: 'Senior Software Engineer',
  candidate_name: 'John Candidate',
  action_type: 'FEEDBACK_DUE',
  title: 'Provide interview feedback',
  priority: 'P1',
  due_in_days: 2,
  due_date: new Date('2024-04-05'),
  evidence: {
    kpi_key: 'hm_latency',
    explain_provider_key: 'hm_latency',
    short_reason: 'Feedback overdue by 3 days',
  },
  recommended_steps: [
    'Review interview notes',
    'Submit feedback form',
    'Discuss with recruiting team if concerns',
  ],
  created_at: new Date('2024-04-01'),
  status: 'OPEN',
  ...overrides,
});

// Sample AI config
const mockConfig: AiProviderConfig = {
  provider: 'openai',
  model: 'gpt-4o',
  apiKey: 'test-key-never-logged',
  redactPii: true,
  temperature: 0.7,
  maxTokens: 1024,
};

describe('AI Copilot Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('explanationToRedactedText', () => {
    it('should include metric name and status', () => {
      const explanation = createMockExplanation();
      const redacted = explanationToRedactedText(explanation);

      expect(redacted).toContain('METRIC: Time to Offer');
      expect(redacted).toContain('STATUS: READY');
    });

    it('should include value and formula', () => {
      const explanation = createMockExplanation();
      const redacted = explanationToRedactedText(explanation);

      expect(redacted).toContain('VALUE: 42 days');
      expect(redacted).toContain('FORMULA: Median(offer_sent_at - applied_at)');
    });

    it('should redact contributor names', () => {
      const explanation = createMockExplanation();
      const redacted = explanationToRedactedText(explanation);

      // Should NOT contain actual names
      expect(redacted).not.toContain('John Smith');
      expect(redacted).not.toContain('Jane Doe');
      expect(redacted).not.toContain('Bob Johnson');

      // Should contain redacted format
      expect(redacted).toContain('Record 1:');
      expect(redacted).toContain('Record 2:');
      expect(redacted).toContain('60 days');
    });

    it('should include breakdown phases', () => {
      const explanation = createMockExplanation();
      const redacted = explanationToRedactedText(explanation);

      expect(redacted).toContain('Application to Interview: 14 days');
      expect(redacted).toContain('Interview to Offer: 28 days');
    });

    it('should include exclusion reasons', () => {
      const explanation = createMockExplanation();
      const redacted = explanationToRedactedText(explanation);

      expect(redacted).toContain('50 records included');
      expect(redacted).toContain('10 excluded');
      expect(redacted).toContain('5 missing offer date');
    });

    it('should include recommended actions', () => {
      const explanation = createMockExplanation();
      const redacted = explanationToRedactedText(explanation);

      expect(redacted).toContain('[HIGH] Review interview scheduling process');
      expect(redacted).toContain('[MEDIUM] Speed up offer approval workflow');
    });

    it('should handle blocked status', () => {
      const explanation = createMockExplanation({
        status: 'blocked',
        value: null,
        blockedReasons: [
          { code: 'MISSING_DATES', message: 'No offer dates found', sampleCount: 100 },
        ],
      });
      const redacted = explanationToRedactedText(explanation);

      expect(redacted).toContain('STATUS: BLOCKED');
      expect(redacted).toContain('MISSING_DATES: No offer dates found (100 records)');
    });
  });

  describe('actionToRedactedText', () => {
    it('should include action title and type', () => {
      const action = createMockAction();
      const redacted = actionToRedactedText(action);

      expect(redacted).toContain('ACTION: Provide interview feedback');
      expect(redacted).toContain('TYPE: FEEDBACK DUE');
    });

    it('should include priority and due info', () => {
      const action = createMockAction();
      const redacted = actionToRedactedText(action);

      expect(redacted).toContain('PRIORITY: P1 (Risk)');
      expect(redacted).toContain('DUE: In 2 days');
    });

    it('should NOT include actual names', () => {
      const action = createMockAction();
      const redacted = actionToRedactedText(action);

      // Should NOT contain actual names
      expect(redacted).not.toContain('Alice Manager');
      expect(redacted).not.toContain('John Candidate');
      expect(redacted).not.toContain('Senior Software Engineer');

      // Should contain generic owner type
      expect(redacted).toContain('OWNER TYPE: HIRING MANAGER');
    });

    it('should include evidence', () => {
      const action = createMockAction();
      const redacted = actionToRedactedText(action);

      expect(redacted).toContain('KPI: hm_latency');
      expect(redacted).toContain('Reason: Feedback overdue by 3 days');
    });

    it('should include recommended steps', () => {
      const action = createMockAction();
      const redacted = actionToRedactedText(action);

      expect(redacted).toContain('1. Review interview notes');
      expect(redacted).toContain('2. Submit feedback form');
    });

    it('should handle overdue actions', () => {
      const action = createMockAction({ due_in_days: -1 });
      const redacted = actionToRedactedText(action);

      expect(redacted).toContain('DUE: OVERDUE');
    });
  });

  describe('generateExplanationSummary', () => {
    it('should call sendAiRequest with correct parameters', async () => {
      const mockResponse: AiResponse = {
        request_id: 'req_123',
        provider: 'openai',
        model: 'gpt-4o',
        content: `SUMMARY: The time to offer is 42 days, which is within target.

KEY INSIGHTS:
- Interview phase takes 14 days on average
- Offer approval phase takes 28 days, which is the longest
- Consider streamlining the approval process`,
        usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
        latency_ms: 1000,
        finish_reason: 'stop',
      };
      mockSendAiRequest.mockResolvedValueOnce(mockResponse);

      const explanation = createMockExplanation();
      const result = await generateExplanationSummary(mockConfig, explanation);

      // Verify sendAiRequest was called
      expect(mockSendAiRequest).toHaveBeenCalledTimes(1);
      expect(mockSendAiRequest).toHaveBeenCalledWith(
        mockConfig,
        expect.any(Array),
        expect.objectContaining({
          systemPrompt: expect.stringContaining('recruiting analytics assistant'),
          taskType: 'explain_summary',
        })
      );

      // Verify result parsing
      expect(result.summary).toContain('42 days');
      expect(result.bullets.length).toBe(3);
      expect(result.error).toBeUndefined();
    });

    it('should return error on API failure', async () => {
      const mockResponse: AiResponse = {
        request_id: 'req_123',
        provider: 'openai',
        model: 'gpt-4o',
        content: '',
        usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
        latency_ms: 500,
        finish_reason: 'error',
        error: {
          code: 'rate_limit',
          message: 'Rate limit exceeded',
          retryable: true,
        },
      };
      mockSendAiRequest.mockResolvedValueOnce(mockResponse);

      const explanation = createMockExplanation();
      const result = await generateExplanationSummary(mockConfig, explanation);

      expect(result.error).toBe('Rate limit exceeded');
      expect(result.summary).toBe('');
      expect(result.bullets).toEqual([]);
    });

    it('should not include PII in the prompt', async () => {
      const mockResponse: AiResponse = {
        request_id: 'req_123',
        provider: 'openai',
        model: 'gpt-4o',
        content: 'SUMMARY: Test\n\nKEY INSIGHTS:\n- Point 1\n- Point 2\n- Point 3',
        usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
        latency_ms: 1000,
        finish_reason: 'stop',
      };
      mockSendAiRequest.mockResolvedValueOnce(mockResponse);

      const explanation = createMockExplanation();
      await generateExplanationSummary(mockConfig, explanation);

      // Get the messages that were sent
      const callArgs = mockSendAiRequest.mock.calls[0];
      const messages = callArgs[1];
      const userMessage = messages.find(m => m.role === 'user');

      // Verify no PII in the prompt
      expect(userMessage?.content).not.toContain('John Smith');
      expect(userMessage?.content).not.toContain('Jane Doe');
      expect(userMessage?.content).not.toContain('Bob Johnson');
    });
  });

  describe('generateDraftMessage', () => {
    it('should call sendAiRequest with correct parameters for Slack', async () => {
      const mockResponse: AiResponse = {
        request_id: 'req_123',
        provider: 'openai',
        model: 'gpt-4o',
        content: `Hi [OWNER_NAME]! 👋

Quick reminder: interview feedback for [CANDIDATE_NAME] is due. Could you submit it today?

The recruiting team is waiting to move forward with the [REQ_TITLE] role.

Thanks!`,
        usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
        latency_ms: 1000,
        finish_reason: 'stop',
      };
      mockSendAiRequest.mockResolvedValueOnce(mockResponse);

      const action = createMockAction();
      const result = await generateDraftMessage(mockConfig, action, 'slack');

      // Verify sendAiRequest was called
      expect(mockSendAiRequest).toHaveBeenCalledTimes(1);
      expect(mockSendAiRequest).toHaveBeenCalledWith(
        mockConfig,
        expect.any(Array),
        expect.objectContaining({
          systemPrompt: expect.stringContaining('recruiting operations assistant'),
          taskType: 'draft_message',
        })
      );

      // Verify result
      expect(result.draft).toContain('[OWNER_NAME]');
      expect(result.draft).toContain('[CANDIDATE_NAME]');
      expect(result.error).toBeUndefined();
    });

    it('should call sendAiRequest with correct parameters for Email', async () => {
      const mockResponse: AiResponse = {
        request_id: 'req_123',
        provider: 'openai',
        model: 'gpt-4o',
        content: `Subject: Interview Feedback Needed - [REQ_TITLE]

Hi [OWNER_NAME],

I hope this email finds you well. I'm reaching out regarding the interview feedback for [CANDIDATE_NAME].

The feedback is now due, and the recruiting team is ready to move forward once we receive your input.

Could you please submit your feedback at your earliest convenience?

Thank you,
Recruiting Team`,
        usage: { prompt_tokens: 100, completion_tokens: 80, total_tokens: 180 },
        latency_ms: 1200,
        finish_reason: 'stop',
      };
      mockSendAiRequest.mockResolvedValueOnce(mockResponse);

      const action = createMockAction();
      const result = await generateDraftMessage(mockConfig, action, 'email');

      // Verify prompt includes email instructions
      const callArgs = mockSendAiRequest.mock.calls[0];
      const messages = callArgs[1];
      const userMessage = messages.find(m => m.role === 'user');
      expect(userMessage?.content).toContain('email');
      expect(userMessage?.content).toContain('Subject:');

      // Verify result has subject line
      expect(result.draft).toContain('Subject:');
      expect(result.error).toBeUndefined();
    });

    it('should return error on API failure', async () => {
      const mockResponse: AiResponse = {
        request_id: 'req_123',
        provider: 'openai',
        model: 'gpt-4o',
        content: '',
        usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
        latency_ms: 500,
        finish_reason: 'error',
        error: {
          code: 'invalid_key',
          message: 'Invalid API key',
          retryable: false,
        },
      };
      mockSendAiRequest.mockResolvedValueOnce(mockResponse);

      const action = createMockAction();
      const result = await generateDraftMessage(mockConfig, action, 'slack');

      expect(result.error).toBe('Invalid API key');
      expect(result.draft).toBe('');
    });

    it('should not include PII in the prompt', async () => {
      const mockResponse: AiResponse = {
        request_id: 'req_123',
        provider: 'openai',
        model: 'gpt-4o',
        content: 'Test draft message',
        usage: { prompt_tokens: 100, completion_tokens: 20, total_tokens: 120 },
        latency_ms: 800,
        finish_reason: 'stop',
      };
      mockSendAiRequest.mockResolvedValueOnce(mockResponse);

      const action = createMockAction();
      await generateDraftMessage(mockConfig, action, 'slack');

      // Get the messages that were sent
      const callArgs = mockSendAiRequest.mock.calls[0];
      const messages = callArgs[1];
      const userMessage = messages.find(m => m.role === 'user');

      // Verify no PII in the prompt
      expect(userMessage?.content).not.toContain('Alice Manager');
      expect(userMessage?.content).not.toContain('John Candidate');
      expect(userMessage?.content).not.toContain('Senior Software Engineer');
    });
  });

  describe('Provider selection', () => {
    it('should respect provider selection in config', async () => {
      const anthropicConfig: AiProviderConfig = {
        ...mockConfig,
        provider: 'anthropic',
        model: 'claude-sonnet-4-20250514',
      };

      const mockResponse: AiResponse = {
        request_id: 'req_123',
        provider: 'anthropic',
        model: 'claude-sonnet-4-20250514',
        content: 'SUMMARY: Test\n\nKEY INSIGHTS:\n- Point 1\n- Point 2\n- Point 3',
        usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
        latency_ms: 1000,
        finish_reason: 'stop',
      };
      mockSendAiRequest.mockResolvedValueOnce(mockResponse);

      const explanation = createMockExplanation();
      await generateExplanationSummary(anthropicConfig, explanation);

      // Verify the correct config was passed
      const callArgs = mockSendAiRequest.mock.calls[0];
      expect(callArgs[0].provider).toBe('anthropic');
      expect(callArgs[0].model).toBe('claude-sonnet-4-20250514');
    });
  });
});
