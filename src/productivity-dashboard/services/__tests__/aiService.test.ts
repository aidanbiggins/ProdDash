// AI Service Tests
// Tests AI request routing and response handling with mocked fetch
// IMPORTANT: No real API calls are made - all providers are mocked

import { sendAiRequest, askAi, testAiConnection } from '../aiService';
import { AiProviderConfig } from '../../types/aiTypes';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch as jest.Mock;

// Helper to create a mock response with proper headers
const createMockResponse = (ok: boolean, status: number, data: unknown) => ({
  ok,
  status,
  headers: {
    get: (name: string) => name === 'content-type' ? 'application/json' : null,
  },
  json: () => Promise.resolve(data),
});

// Mock configurations for each provider
const createConfig = (provider: 'openai' | 'anthropic' | 'gemini' | 'openai_compatible', overrides: Partial<AiProviderConfig> = {}): AiProviderConfig => ({
  provider,
  model: provider === 'openai' ? 'gpt-4o' :
         provider === 'anthropic' ? 'claude-sonnet-4-20250514' :
         provider === 'gemini' ? 'gemini-1.5-pro' : 'custom-model',
  apiKey: 'test-api-key-never-logged',
  redactPii: true,
  temperature: 0.7,
  maxTokens: 1024,
  baseUrl: provider === 'openai_compatible' ? 'https://api.together.xyz/v1' : undefined,
  ...overrides,
});

// Mock successful responses
const MOCK_RESPONSES = {
  openai: {
    request_id: 'req_123',
    provider: 'openai',
    model: 'gpt-4o',
    content: 'Hello! This is a mock OpenAI response.',
    usage: { prompt_tokens: 10, completion_tokens: 15, total_tokens: 25 },
    latency_ms: 150,
    finish_reason: 'stop',
  },
  anthropic: {
    request_id: 'req_456',
    provider: 'anthropic',
    model: 'claude-sonnet-4-20250514',
    content: 'Hello! This is a mock Anthropic response.',
    usage: { prompt_tokens: 12, completion_tokens: 18, total_tokens: 30 },
    latency_ms: 200,
    finish_reason: 'stop',
  },
  gemini: {
    request_id: 'req_789',
    provider: 'gemini',
    model: 'gemini-1.5-pro',
    content: 'Hello! This is a mock Gemini response.',
    usage: { prompt_tokens: 8, completion_tokens: 12, total_tokens: 20 },
    latency_ms: 180,
    finish_reason: 'stop',
  },
  openai_compatible: {
    request_id: 'req_abc',
    provider: 'openai_compatible',
    model: 'custom-model',
    content: 'Hello! This is a mock OpenAI-compatible response.',
    usage: { prompt_tokens: 10, completion_tokens: 14, total_tokens: 24 },
    latency_ms: 160,
    finish_reason: 'stop',
  },
};

describe('AI Service', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('sendAiRequest', () => {
    it('should route OpenAI requests correctly', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse(true, 200, MOCK_RESPONSES.openai));

      const config = createConfig('openai');
      const response = await sendAiRequest(config, [{ role: 'user', content: 'Hello' }]);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(response.provider).toBe('openai');
      expect(response.content).toBe('Hello! This is a mock OpenAI response.');
      expect(response.error).toBeUndefined();

      // Verify the request was made with correct headers
      const fetchCall = mockFetch.mock.calls[0];
      const headers = fetchCall[1].headers;
      expect(headers['x-user-api-key']).toBe('test-api-key-never-logged');
      expect(headers['Content-Type']).toBe('application/json');
    });

    it('should route Anthropic requests correctly', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse(true, 200, MOCK_RESPONSES.anthropic));

      const config = createConfig('anthropic');
      const response = await sendAiRequest(config, [{ role: 'user', content: 'Hello' }]);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(response.provider).toBe('anthropic');
      expect(response.content).toBe('Hello! This is a mock Anthropic response.');
    });

    it('should route Gemini requests correctly', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse(true, 200, MOCK_RESPONSES.gemini));

      const config = createConfig('gemini');
      const response = await sendAiRequest(config, [{ role: 'user', content: 'Hello' }]);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(response.provider).toBe('gemini');
      expect(response.content).toBe('Hello! This is a mock Gemini response.');
    });

    it('should route OpenAI-compatible requests with base URL header', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse(true, 200, MOCK_RESPONSES.openai_compatible));

      const config = createConfig('openai_compatible');
      const response = await sendAiRequest(config, [{ role: 'user', content: 'Hello' }]);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(response.provider).toBe('openai_compatible');

      // Verify base URL header is included
      const fetchCall = mockFetch.mock.calls[0];
      const headers = fetchCall[1].headers;
      expect(headers['x-provider-base-url']).toBe('https://api.together.xyz/v1');
    });

    it('should include system prompt in request body', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse(true, 200, MOCK_RESPONSES.openai));

      const config = createConfig('openai');
      await sendAiRequest(
        config,
        [{ role: 'user', content: 'Hello' }],
        { systemPrompt: 'You are a helpful assistant.' }
      );

      const fetchCall = mockFetch.mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);
      expect(body.system_prompt).toBe('You are a helpful assistant.');
    });

    it('should handle error responses gracefully', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse(false, 401, {
        error: {
          code: 'invalid_api_key',
          message: 'Invalid API key provided',
          retryable: false,
        },
      }));

      const config = createConfig('openai');
      const response = await sendAiRequest(config, [{ role: 'user', content: 'Hello' }]);

      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe('invalid_api_key');
      expect(response.finish_reason).toBe('error');
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network failure'));

      const config = createConfig('openai');
      const response = await sendAiRequest(config, [{ role: 'user', content: 'Hello' }]);

      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe('network_error');
      expect(response.error?.retryable).toBe(true);
    });

    it('should include temperature and maxTokens from config', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse(true, 200, MOCK_RESPONSES.openai));

      const config = createConfig('openai', { temperature: 0.9, maxTokens: 2048 });
      await sendAiRequest(config, [{ role: 'user', content: 'Hello' }]);

      const fetchCall = mockFetch.mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);
      expect(body.temperature).toBe(0.9);
      expect(body.max_tokens).toBe(2048);
    });
  });

  describe('askAi', () => {
    it('should return text on success', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse(true, 200, MOCK_RESPONSES.openai));

      const config = createConfig('openai');
      const result = await askAi(config, 'What is 2+2?');

      expect(result.text).toBe('Hello! This is a mock OpenAI response.');
      expect(result.error).toBeUndefined();
    });

    it('should return error on failure', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse(false, 500, {
        error: { code: 'server_error', message: 'Internal server error', retryable: true },
      }));

      const config = createConfig('openai');
      const result = await askAi(config, 'What is 2+2?');

      expect(result.text).toBe('');
      expect(result.error).toBe('Internal server error');
    });
  });

  describe('testAiConnection', () => {
    it('should return success on valid connection', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse(true, 200, {
        ...MOCK_RESPONSES.openai,
        content: 'OK',
        latency_ms: 100,
      }));

      const config = createConfig('openai');
      const result = await testAiConnection(config);

      expect(result.success).toBe(true);
      expect(result.latency_ms).toBeDefined();
      expect(result.error).toBeUndefined();
    });

    it('should return failure on invalid key', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse(false, 401, {
        error: { code: 'invalid_key', message: 'Invalid API key', retryable: false },
      }));

      const config = createConfig('openai');
      const result = await testAiConnection(config);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid API key');
    });
  });

  describe('Security: API Key Handling', () => {
    it('should pass API key in header, not in body', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse(true, 200, MOCK_RESPONSES.openai));

      const config = createConfig('openai');
      await sendAiRequest(config, [{ role: 'user', content: 'Hello' }]);

      const fetchCall = mockFetch.mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);
      const headers = fetchCall[1].headers;

      // Key should be in header
      expect(headers['x-user-api-key']).toBe('test-api-key-never-logged');

      // Key should NOT be in body
      expect(body.apiKey).toBeUndefined();
      expect(body.api_key).toBeUndefined();
    });

    it('should not include API key in request body for any provider', async () => {
      const providers: Array<'openai' | 'anthropic' | 'gemini' | 'openai_compatible'> = [
        'openai', 'anthropic', 'gemini', 'openai_compatible'
      ];

      for (const provider of providers) {
        mockFetch.mockClear();
        mockFetch.mockResolvedValueOnce(createMockResponse(true, 200, MOCK_RESPONSES[provider]));

        const config = createConfig(provider);
        await sendAiRequest(config, [{ role: 'user', content: 'Test' }]);

        const fetchCall = mockFetch.mock.calls[0];
        const body = JSON.parse(fetchCall[1].body);

        // Verify no key-like fields in body
        expect(body.apiKey).toBeUndefined();
        expect(body.api_key).toBeUndefined();
        expect(body.key).toBeUndefined();
        expect(body.secret).toBeUndefined();
      }
    });
  });
});
