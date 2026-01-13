// AI Service - Client-side service for calling LLM providers via Edge Function
// Keys are passed per-request, stored in memory only, never persisted

import { AiProvider, AiProviderConfig, AiRequest, AiResponse, AiMessage } from '../types/aiTypes';

// Supabase Edge Function URL - will be configured via environment
const getLlmProxyUrl = (): string => {
  // Check for Supabase URL in environment or use local development URL
  const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || 'http://localhost:54321';
  return `${supabaseUrl}/functions/v1/llm-proxy`;
};

// Generate a unique request ID
const generateRequestId = (): string => {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
};

/**
 * Send a request to an AI provider via the LLM proxy Edge Function
 *
 * @param config - The AI provider configuration (includes API key in memory)
 * @param messages - The conversation messages
 * @param options - Additional options (system prompt, task type, etc.)
 * @returns The AI response
 */
export async function sendAiRequest(
  config: AiProviderConfig,
  messages: AiMessage[],
  options: {
    systemPrompt?: string;
    taskType?: string;
    requestId?: string;
  } = {}
): Promise<AiResponse> {
  const requestId = options.requestId || generateRequestId();

  const request: AiRequest = {
    request_id: requestId,
    provider: config.provider,
    model: config.model,
    messages,
    system_prompt: options.systemPrompt,
    max_tokens: config.maxTokens,
    temperature: config.temperature,
    feature_context: options.taskType || 'general',
    redact_pii: config.redactPii,
  };

  // Supabase anon key is required to invoke Edge Functions
  const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || '';

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-user-api-key': config.apiKey, // Key passed in header, never logged
    'apikey': supabaseAnonKey, // Required for Supabase Edge Function auth
    'Authorization': `Bearer ${supabaseAnonKey}`, // Alternative auth header
  };

  // Add base URL header for OpenAI-compatible providers
  if (config.provider === 'openai_compatible' && config.baseUrl) {
    headers['x-provider-base-url'] = config.baseUrl;
  }

  const startTime = Date.now();

  try {
    const response = await fetch(getLlmProxyUrl(), {
      method: 'POST',
      headers,
      body: JSON.stringify(request),
    });

    const data = await response.json();

    // Handle error responses
    if (!response.ok || data.error) {
      return {
        request_id: requestId,
        provider: config.provider,
        model: config.model,
        content: '',
        usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
        latency_ms: Date.now() - startTime,
        finish_reason: 'error',
        error: data.error || {
          code: 'request_failed',
          message: `Request failed with status ${response.status}`,
          retryable: response.status >= 500,
        },
      };
    }

    return data as AiResponse;
  } catch (error) {
    // Network or parsing error
    return {
      request_id: requestId,
      provider: config.provider,
      model: config.model,
      content: '',
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      latency_ms: Date.now() - startTime,
      finish_reason: 'error',
      error: {
        code: 'network_error',
        message: error instanceof Error ? error.message : 'Network error',
        retryable: true,
      },
    };
  }
}

/**
 * Simple helper to send a single prompt and get a response
 *
 * @param config - The AI provider configuration
 * @param prompt - The user prompt
 * @param systemPrompt - Optional system prompt
 * @returns The AI response text
 */
export async function askAi(
  config: AiProviderConfig,
  prompt: string,
  systemPrompt?: string
): Promise<{ text: string; error?: string }> {
  const response = await sendAiRequest(
    config,
    [{ role: 'user', content: prompt }],
    { systemPrompt }
  );

  if (response.error) {
    return { text: '', error: response.error.message };
  }

  return { text: response.content };
}

/**
 * Test the AI configuration by sending a simple request
 *
 * @param config - The AI provider configuration to test
 * @returns Success status and optional error message
 */
export async function testAiConnection(
  config: AiProviderConfig
): Promise<{ success: boolean; error?: string; latency_ms?: number }> {
  const response = await sendAiRequest(
    config,
    [{ role: 'user', content: 'Hello, please respond with just "OK" to confirm the connection works.' }],
    { taskType: 'connection_test' }
  );

  if (response.error) {
    return { success: false, error: response.error.message };
  }

  return { success: true, latency_ms: response.latency_ms };
}

// Export types for convenience
export type { AiProvider, AiProviderConfig, AiRequest, AiResponse, AiMessage };
