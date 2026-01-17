// LLM Proxy Edge Function
// Routes AI requests to various providers (OpenAI, Anthropic, Gemini, OpenAI-compatible)
// API keys are passed per-request and NEVER logged or stored

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

// ===== TYPES =====

type AiProvider = 'openai' | 'anthropic' | 'gemini' | 'openai_compatible';

interface AiMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface AiRequest {
  request_id: string;
  provider: AiProvider;
  model: string;
  messages: AiMessage[];
  system_prompt?: string;
  max_tokens?: number;
  temperature?: number;
  task_type?: string;
  input?: string;
  max_output_tokens?: number;
}

interface AiResponse {
  request_id: string;
  provider: AiProvider;
  model: string;
  content: string;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  latency_ms: number;
  finish_reason: 'stop' | 'max_tokens' | 'error';
  error?: {
    code: string;
    message: string;
    retryable: boolean;
  };
}

// ===== CORS HEADERS =====

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-user-api-key, x-provider-base-url',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// ===== SSRF ALLOWLIST =====

const ALLOWED_OPENAI_COMPATIBLE_HOSTS = [
  'api.together.xyz',
  'api.fireworks.ai',
  'api.groq.com',
  'api.perplexity.ai',
  'api.deepinfra.com',
  'api.anyscale.com',
  'api.mistral.ai',
  'api.cohere.ai',
  'localhost',
  '127.0.0.1',
];

const ALLOWED_HOST_PATTERNS = [
  /^[a-z0-9-]+\.openai\.azure\.com$/,  // Azure OpenAI
];

function isAllowedHost(baseUrl: string | null): boolean {
  if (!baseUrl) return false;

  try {
    const url = new URL(baseUrl);
    const host = url.hostname.toLowerCase();

    // Check exact matches
    if (ALLOWED_OPENAI_COMPATIBLE_HOSTS.includes(host)) {
      return true;
    }

    // Check patterns
    for (const pattern of ALLOWED_HOST_PATTERNS) {
      if (pattern.test(host)) {
        return true;
      }
    }

    return false;
  } catch {
    return false;
  }
}

// ===== PROVIDER ADAPTERS =====

// Helper to check if model uses new-style parameters (max_completion_tokens)
function usesMaxCompletionTokens(model: string): boolean {
  const lowerModel = model.toLowerCase();
  // GPT-5.x, o-series reasoning models use max_completion_tokens
  return lowerModel.startsWith('gpt-5') ||
         lowerModel.startsWith('o1') ||
         lowerModel.startsWith('o3') ||
         lowerModel === 'chatgpt-4o-latest';
}

// Helper to check if model is a reasoning model (no temperature)
function isReasoningModel(model: string): boolean {
  const lowerModel = model.toLowerCase();
  return lowerModel.startsWith('o1') || lowerModel.startsWith('o3');
}

async function handleOpenAI(
  request: AiRequest,
  apiKey: string
): Promise<AiResponse> {
  const startTime = Date.now();

  // Build messages array
  const messages = [...request.messages];
  if (request.system_prompt) {
    messages.unshift({ role: 'system', content: request.system_prompt });
  }

  // Build request body based on model type
  const maxTokens = request.max_tokens ?? request.max_output_tokens ?? 1024;
  const requestBody: Record<string, unknown> = {
    model: request.model,
    messages: messages.map(m => ({ role: m.role, content: m.content })),
  };

  // Use the correct parameter name based on model
  if (usesMaxCompletionTokens(request.model)) {
    requestBody.max_completion_tokens = maxTokens;
  } else {
    requestBody.max_tokens = maxTokens;
  }

  // Reasoning models don't support temperature
  if (!isReasoningModel(request.model)) {
    requestBody.temperature = request.temperature ?? 0.7;
  }

  // Use Chat Completions API (more widely available than Responses API)
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  const data = await response.json();

  if (!response.ok) {
    return {
      request_id: request.request_id,
      provider: 'openai',
      model: request.model,
      content: '',
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      latency_ms: Date.now() - startTime,
      finish_reason: 'error',
      error: {
        code: data.error?.code || 'api_error',
        message: data.error?.message || 'OpenAI API error',
        retryable: response.status === 429 || response.status >= 500,
      },
    };
  }

  // Extract content - handle both Chat Completions API and Responses API formats
  // Chat Completions: choices[0].message.content
  // Responses API: output[0].content[0].text or output_text
  let content = '';
  if (data.choices?.[0]?.message?.content) {
    content = data.choices[0].message.content;
  } else if (data.output_text) {
    // Responses API shorthand
    content = data.output_text;
  } else if (data.output?.[0]?.content?.[0]?.text) {
    // Responses API full format
    content = data.output[0].content[0].text;
  } else if (data.output?.[0]?.content && typeof data.output[0].content === 'string') {
    // Alternative Responses API format
    content = data.output[0].content;
  }

  // Log for debugging if content is empty but we got tokens
  if (!content && (data.usage?.total_tokens || data.usage?.completion_tokens)) {
    console.log('OpenAI response structure (content empty but got tokens):', JSON.stringify(data).slice(0, 1000));
  }

  return {
    request_id: request.request_id,
    provider: 'openai',
    model: data.model || request.model,
    content,
    usage: {
      prompt_tokens: data.usage?.prompt_tokens || data.usage?.input_tokens || 0,
      completion_tokens: data.usage?.completion_tokens || data.usage?.output_tokens || 0,
      total_tokens: data.usage?.total_tokens || 0,
    },
    latency_ms: Date.now() - startTime,
    finish_reason: data.choices?.[0]?.finish_reason === 'length' ? 'max_tokens' : 'stop',
  };
}

async function handleAnthropic(
  request: AiRequest,
  apiKey: string
): Promise<AiResponse> {
  const startTime = Date.now();

  // Anthropic requires system prompt separate from messages
  const systemPrompt = request.system_prompt ||
    request.messages.find(m => m.role === 'system')?.content;
  const messages = request.messages.filter(m => m.role !== 'system');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: request.model,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      system: systemPrompt,
      max_tokens: request.max_tokens ?? request.max_output_tokens ?? 1024,
      temperature: request.temperature ?? 0.7,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    return {
      request_id: request.request_id,
      provider: 'anthropic',
      model: request.model,
      content: '',
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      latency_ms: Date.now() - startTime,
      finish_reason: 'error',
      error: {
        code: data.error?.type || 'api_error',
        message: data.error?.message || 'Anthropic API error',
        retryable: response.status === 429 || response.status >= 500,
      },
    };
  }

  return {
    request_id: request.request_id,
    provider: 'anthropic',
    model: data.model || request.model,
    content: data.content?.[0]?.text || '',
    usage: {
      prompt_tokens: data.usage?.input_tokens || 0,
      completion_tokens: data.usage?.output_tokens || 0,
      total_tokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
    },
    latency_ms: Date.now() - startTime,
    finish_reason: data.stop_reason === 'max_tokens' ? 'max_tokens' : 'stop',
  };
}

async function handleGemini(
  request: AiRequest,
  apiKey: string
): Promise<AiResponse> {
  const startTime = Date.now();

  // Build contents array for Gemini
  const contents = request.messages
    .filter(m => m.role !== 'system')
    .map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

  const systemInstruction = request.system_prompt ||
    request.messages.find(m => m.role === 'system')?.content;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${request.model}:generateContent?key=${apiKey}`;

  const requestBody: Record<string, unknown> = {
    contents,
    generationConfig: {
      maxOutputTokens: request.max_tokens ?? request.max_output_tokens ?? 1024,
      temperature: request.temperature ?? 0.7,
    },
  };

  if (systemInstruction) {
    requestBody.systemInstruction = { parts: [{ text: systemInstruction }] };
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  const data = await response.json();

  if (!response.ok || data.error) {
    return {
      request_id: request.request_id,
      provider: 'gemini',
      model: request.model,
      content: '',
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      latency_ms: Date.now() - startTime,
      finish_reason: 'error',
      error: {
        code: data.error?.code?.toString() || 'api_error',
        message: data.error?.message || 'Gemini API error',
        retryable: response.status === 429 || response.status >= 500,
      },
    };
  }

  return {
    request_id: request.request_id,
    provider: 'gemini',
    model: request.model,
    content: data.candidates?.[0]?.content?.parts?.[0]?.text || '',
    usage: {
      prompt_tokens: data.usageMetadata?.promptTokenCount || 0,
      completion_tokens: data.usageMetadata?.candidatesTokenCount || 0,
      total_tokens: data.usageMetadata?.totalTokenCount || 0,
    },
    latency_ms: Date.now() - startTime,
    finish_reason: data.candidates?.[0]?.finishReason === 'MAX_TOKENS' ? 'max_tokens' : 'stop',
  };
}

async function handleOpenAICompatible(
  request: AiRequest,
  apiKey: string,
  baseUrl: string
): Promise<AiResponse> {
  const startTime = Date.now();

  // Build messages array
  const messages = [...request.messages];
  if (request.system_prompt) {
    messages.unshift({ role: 'system', content: request.system_prompt });
  }

  // Normalize base URL
  const normalizedBaseUrl = baseUrl.replace(/\/$/, '');
  const endpoint = `${normalizedBaseUrl}/chat/completions`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: request.model,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      max_tokens: request.max_tokens ?? request.max_output_tokens ?? 1024,
      temperature: request.temperature ?? 0.7,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    return {
      request_id: request.request_id,
      provider: 'openai_compatible',
      model: request.model,
      content: '',
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      latency_ms: Date.now() - startTime,
      finish_reason: 'error',
      error: {
        code: data.error?.code || 'api_error',
        message: data.error?.message || 'API error',
        retryable: response.status === 429 || response.status >= 500,
      },
    };
  }

  return {
    request_id: request.request_id,
    provider: 'openai_compatible',
    model: data.model || request.model,
    content: data.choices?.[0]?.message?.content || '',
    usage: {
      prompt_tokens: data.usage?.prompt_tokens || 0,
      completion_tokens: data.usage?.completion_tokens || 0,
      total_tokens: data.usage?.total_tokens || 0,
    },
    latency_ms: Date.now() - startTime,
    finish_reason: data.choices?.[0]?.finish_reason === 'length' ? 'max_tokens' : 'stop',
  };
}

// ===== REQUEST VALIDATION =====

function validateRequest(req: AiRequest): { code: string; message: string } | null {
  if (!req.request_id) return { code: 'missing_field', message: 'request_id is required' };
  if (!req.provider) return { code: 'missing_field', message: 'provider is required' };
  if (!req.model) return { code: 'missing_field', message: 'model is required' };
  if (!req.messages || req.messages.length === 0) {
    // Allow input field as alternative to messages
    if (!req.input) {
      return { code: 'missing_field', message: 'messages or input is required' };
    }
  }
  return null;
}

// ===== MAIN HANDLER =====

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Extract API key from header (NEVER log this)
    const apiKey = req.headers.get('x-user-api-key');
    const providerBaseUrl = req.headers.get('x-provider-base-url');

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: { code: 'missing_key', message: 'x-user-api-key header is required' } }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const aiRequest: AiRequest = await req.json();

    // Convert input field to messages if provided
    if (aiRequest.input && (!aiRequest.messages || aiRequest.messages.length === 0)) {
      aiRequest.messages = [{ role: 'user', content: aiRequest.input }];
    }

    // Validate request
    const validationError = validateRequest(aiRequest);
    if (validationError) {
      return new Response(
        JSON.stringify({ error: validationError }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Route to appropriate provider adapter
    let response: AiResponse;

    switch (aiRequest.provider) {
      case 'openai':
        response = await handleOpenAI(aiRequest, apiKey);
        break;

      case 'anthropic':
        response = await handleAnthropic(aiRequest, apiKey);
        break;

      case 'gemini':
        response = await handleGemini(aiRequest, apiKey);
        break;

      case 'openai_compatible':
        // SSRF check
        if (!providerBaseUrl) {
          return new Response(
            JSON.stringify({
              error: {
                code: 'missing_base_url',
                message: 'x-provider-base-url header is required for openai_compatible provider',
              }
            }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (!isAllowedHost(providerBaseUrl)) {
          return new Response(
            JSON.stringify({
              error: {
                code: 'forbidden_host',
                message: 'Base URL host not in allowlist',
                retryable: false
              }
            }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        response = await handleOpenAICompatible(aiRequest, apiKey, providerBaseUrl);
        break;

      default:
        return new Response(
          JSON.stringify({ error: { code: 'unknown_provider', message: `Unknown provider: ${aiRequest.provider}` } }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    // Return response (key is NOT included)
    return new Response(
      JSON.stringify(response),
      { status: response.error ? 502 : 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    // Log error message only, never the key
    console.error('LLM Proxy Error:', (error as Error).message);

    return new Response(
      JSON.stringify({
        error: {
          code: 'internal_error',
          message: 'An error occurred processing your request',
          retryable: true
        }
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
