# AI BYOK Multi-Provider Integration Plan

## Overview

This plan defines a Bring-Your-Own-Key (BYOK) architecture for integrating multiple AI providers into ProdDash. Users can connect their own API keys to enable AI-powered features (e.g., Pre-Mortem analysis, recommendations) without ProdDash storing or managing API keys server-side.

## 1. Internal Contracts

### 1.1 AiRequest Contract

```typescript
interface AiRequest {
  // Required fields
  request_id: string;           // UUID for tracing
  provider: AiProvider;         // Target provider
  model: string;                // Model identifier (e.g., "gpt-4o", "claude-sonnet-4-20250514")
  messages: AiMessage[];        // Conversation messages

  // Optional fields
  system_prompt?: string;       // System-level instructions
  max_tokens?: number;          // Response length limit (default: 1024)
  temperature?: number;         // Creativity setting (default: 0.7)
  stop_sequences?: string[];    // Early termination triggers

  // Metadata (not sent to provider)
  feature_context: string;      // Which feature initiated request (e.g., "premortem", "explain")
  redact_pii: boolean;          // Whether PII was redacted from this request
}

interface AiMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

type AiProvider =
  | 'openai'
  | 'anthropic'
  | 'gemini'
  | 'openai_compatible';
```

### 1.2 AiResponse Contract

```typescript
interface AiResponse {
  // Required fields
  request_id: string;           // Matches AiRequest.request_id
  provider: AiProvider;         // Provider that handled request
  model: string;                // Actual model used
  content: string;              // Generated text response

  // Usage metrics
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };

  // Metadata
  latency_ms: number;           // Round-trip time
  finish_reason: 'stop' | 'max_tokens' | 'error';

  // Error handling
  error?: {
    code: string;               // e.g., "rate_limit", "invalid_key", "model_not_found"
    message: string;
    retryable: boolean;
  };
}
```

## 2. Provider Specifications

### 2.1 Provider List (v1)

| Provider | API | Endpoint | Models (Initial) |
|----------|-----|----------|------------------|
| OpenAI | Responses API | `https://api.openai.com/v1/responses` | gpt-4o, gpt-4o-mini, gpt-4-turbo |
| Anthropic | Messages API | `https://api.anthropic.com/v1/messages` | claude-sonnet-4-20250514, claude-3-5-haiku-20241022, claude-3-opus-20240229 |
| Gemini | GenerateContent | `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent` | gemini-1.5-pro, gemini-1.5-flash |
| OpenAI-Compatible | OpenAI API format | User-specified (allowlisted) | User-specified |

### 2.2 Provider Adapters

Each provider requires an adapter that transforms `AiRequest` to provider-specific format and `AiResponse` back to internal format.

#### OpenAI Adapter

```typescript
// Request transformation
function toOpenAIRequest(req: AiRequest): OpenAIRequestBody {
  return {
    model: req.model,
    input: req.messages.map(m => ({
      role: m.role,
      content: m.content
    })),
    instructions: req.system_prompt,
    max_output_tokens: req.max_tokens,
    temperature: req.temperature,
    stop: req.stop_sequences
  };
}

// Response transformation
function fromOpenAIResponse(resp: OpenAIResponseBody, req: AiRequest): AiResponse {
  return {
    request_id: req.request_id,
    provider: 'openai',
    model: resp.model,
    content: resp.output[0]?.content[0]?.text || '',
    usage: {
      prompt_tokens: resp.usage.input_tokens,
      completion_tokens: resp.usage.output_tokens,
      total_tokens: resp.usage.total_tokens
    },
    latency_ms: /* calculated */,
    finish_reason: mapFinishReason(resp.status)
  };
}
```

#### Anthropic Adapter

```typescript
// Request transformation
function toAnthropicRequest(req: AiRequest): AnthropicRequestBody {
  return {
    model: req.model,
    messages: req.messages.filter(m => m.role !== 'system').map(m => ({
      role: m.role,
      content: m.content
    })),
    system: req.system_prompt || req.messages.find(m => m.role === 'system')?.content,
    max_tokens: req.max_tokens || 1024,
    temperature: req.temperature,
    stop_sequences: req.stop_sequences
  };
}

// Response transformation
function fromAnthropicResponse(resp: AnthropicResponseBody, req: AiRequest): AiResponse {
  return {
    request_id: req.request_id,
    provider: 'anthropic',
    model: resp.model,
    content: resp.content[0]?.text || '',
    usage: {
      prompt_tokens: resp.usage.input_tokens,
      completion_tokens: resp.usage.output_tokens,
      total_tokens: resp.usage.input_tokens + resp.usage.output_tokens
    },
    latency_ms: /* calculated */,
    finish_reason: mapFinishReason(resp.stop_reason)
  };
}
```

#### Gemini Adapter

```typescript
// Request transformation
function toGeminiRequest(req: AiRequest): GeminiRequestBody {
  return {
    contents: req.messages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    })),
    systemInstruction: req.system_prompt ? {
      parts: [{ text: req.system_prompt }]
    } : undefined,
    generationConfig: {
      maxOutputTokens: req.max_tokens,
      temperature: req.temperature,
      stopSequences: req.stop_sequences
    }
  };
}

// Response transformation
function fromGeminiResponse(resp: GeminiResponseBody, req: AiRequest): AiResponse {
  return {
    request_id: req.request_id,
    provider: 'gemini',
    model: req.model,
    content: resp.candidates[0]?.content?.parts[0]?.text || '',
    usage: {
      prompt_tokens: resp.usageMetadata?.promptTokenCount || 0,
      completion_tokens: resp.usageMetadata?.candidatesTokenCount || 0,
      total_tokens: resp.usageMetadata?.totalTokenCount || 0
    },
    latency_ms: /* calculated */,
    finish_reason: mapFinishReason(resp.candidates[0]?.finishReason)
  };
}
```

#### OpenAI-Compatible Adapter

Uses OpenAI adapter with custom base URL. See SSRF guardrails in Section 7.

## 3. Key Handling

### 3.1 Session-Only Storage (Default)

**Principle**: API keys are NEVER stored server-side. They exist only in the browser session.

```typescript
// Client-side key storage
interface AiKeyStore {
  provider: AiProvider;
  apiKey: string;                    // Stored in sessionStorage only
  baseUrl?: string;                  // For openai_compatible only
  expiresAt?: number;                // Optional session timeout
}

// Storage implementation
const AI_KEY_STORAGE_KEY = 'proddash_ai_keys';

function storeKey(config: AiKeyStore): void {
  const existing = getStoredKeys();
  existing[config.provider] = config;
  sessionStorage.setItem(AI_KEY_STORAGE_KEY, JSON.stringify(existing));
}

function getKey(provider: AiProvider): AiKeyStore | null {
  const stored = sessionStorage.getItem(AI_KEY_STORAGE_KEY);
  if (!stored) return null;
  return JSON.parse(stored)[provider] || null;
}

function clearKeys(): void {
  sessionStorage.removeItem(AI_KEY_STORAGE_KEY);
}
```

### 3.2 Key Transmission

Keys are sent with each request in the `Authorization` header to the Edge Function:

```typescript
// Client sends key with request
async function sendAiRequest(request: AiRequest): Promise<AiResponse> {
  const keyConfig = getKey(request.provider);
  if (!keyConfig) {
    throw new Error(`No API key configured for ${request.provider}`);
  }

  const response = await fetch(`${SUPABASE_URL}/functions/v1/llm-proxy`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseAnonKey}`,
      'X-AI-Provider-Key': keyConfig.apiKey,  // Provider key in custom header
      'X-AI-Provider-Base-URL': keyConfig.baseUrl || ''  // For openai_compatible
    },
    body: JSON.stringify(request)
  });

  return response.json();
}
```

### 3.3 Key Security Requirements

1. **No Logging**: Edge Function MUST NOT log the `X-AI-Provider-Key` header
2. **No Storage**: Key is used for single request, then discarded
3. **No Caching**: Response caching MUST NOT include the key
4. **HTTPS Only**: All requests use TLS
5. **Memory Only**: Key never touches disk on server

## 4. PII Redaction Rules

### 4.1 Redaction Scope

PII is redacted from AI requests by default. Redaction applies to:

| Field Type | Pattern | Replacement |
|------------|---------|-------------|
| Names | Detected via name fields | `[REDACTED_NAME]` |
| Emails | `/.+@.+\..+/` | `[REDACTED_EMAIL]` |
| Phone Numbers | `/\+?[\d\s\-\(\)]{10,}/` | `[REDACTED_PHONE]` |
| Candidate IDs | `candidate_id` field references | `[CANDIDATE_###]` |
| Requisition IDs | Real req IDs | `[REQ_###]` |
| Hiring Manager Names | `hm_name` field | `[REDACTED_HM]` |
| Recruiter Names | `recruiter_name` field | `[REDACTED_RECRUITER]` |

### 4.2 Redaction Implementation

```typescript
interface RedactionConfig {
  enabled: boolean;               // Master toggle
  redactNames: boolean;           // Names (candidates, HMs, recruiters)
  redactContactInfo: boolean;     // Emails, phones
  redactIds: boolean;             // Replace real IDs with sequential placeholders
}

interface RedactionResult {
  redactedText: string;
  redactionMap: Map<string, string>;  // For potential de-redaction in response
  redactedFieldCount: number;
}

function redactPII(text: string, config: RedactionConfig): RedactionResult {
  const redactionMap = new Map<string, string>();
  let redactedText = text;
  let counter = { name: 0, email: 0, phone: 0, id: 0 };

  if (config.redactNames) {
    // Name patterns - applied to known name fields
    redactedText = redactedText.replace(
      /(?:candidate[_\s]?name|hm[_\s]?name|recruiter[_\s]?name):\s*["']?([^"'\n,]+)["']?/gi,
      (match, name) => {
        const placeholder = `[REDACTED_NAME_${++counter.name}]`;
        redactionMap.set(placeholder, name);
        return match.replace(name, placeholder);
      }
    );
  }

  if (config.redactContactInfo) {
    // Email pattern
    redactedText = redactedText.replace(
      /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
      (email) => {
        const placeholder = `[REDACTED_EMAIL_${++counter.email}]`;
        redactionMap.set(placeholder, email);
        return placeholder;
      }
    );

    // Phone pattern
    redactedText = redactedText.replace(
      /\+?[\d\s\-\(\)]{10,}/g,
      (phone) => {
        const placeholder = `[REDACTED_PHONE_${++counter.phone}]`;
        redactionMap.set(placeholder, phone);
        return placeholder;
      }
    );
  }

  return {
    redactedText,
    redactionMap,
    redactedFieldCount: redactionMap.size
  };
}
```

### 4.3 Redaction Toggle Behavior

- **Default**: Redaction ON
- **Toggle OFF**: User acknowledges data will be sent to third-party AI provider
- **Audit**: Log redaction status with each request (not the actual PII)

## 5. Relay Design: Supabase Edge Function

### 5.1 Architecture

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Client    │────▶│  llm-proxy       │────▶│  AI Provider    │
│  (Browser)  │◀────│  Edge Function   │◀────│  (OpenAI, etc)  │
└─────────────┘     └──────────────────┘     └─────────────────┘
                           │
                           ▼
                    ┌──────────────┐
                    │  Provider    │
                    │  Adapters    │
                    └──────────────┘
```

### 5.2 Edge Function: `llm-proxy`

Location: `supabase/functions/llm-proxy/index.ts`

```typescript
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';

// Provider adapters
import { handleOpenAI } from './adapters/openai.ts';
import { handleAnthropic } from './adapters/anthropic.ts';
import { handleGemini } from './adapters/gemini.ts';
import { handleOpenAICompatible } from './adapters/openai-compatible.ts';

// SSRF allowlist
import { ALLOWED_OPENAI_COMPATIBLE_HOSTS } from './security/allowlist.ts';

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Extract headers (DO NOT LOG THESE)
    const providerKey = req.headers.get('X-AI-Provider-Key');
    const providerBaseUrl = req.headers.get('X-AI-Provider-Base-URL');

    if (!providerKey) {
      return new Response(
        JSON.stringify({ error: { code: 'missing_key', message: 'No API key provided' } }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const aiRequest: AiRequest = await req.json();

    // Validate request
    const validationError = validateAiRequest(aiRequest);
    if (validationError) {
      return new Response(
        JSON.stringify({ error: validationError }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Route to appropriate provider adapter
    let response: AiResponse;
    const startTime = Date.now();

    switch (aiRequest.provider) {
      case 'openai':
        response = await handleOpenAI(aiRequest, providerKey);
        break;

      case 'anthropic':
        response = await handleAnthropic(aiRequest, providerKey);
        break;

      case 'gemini':
        response = await handleGemini(aiRequest, providerKey);
        break;

      case 'openai_compatible':
        // SSRF check
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
        response = await handleOpenAICompatible(aiRequest, providerKey, providerBaseUrl!);
        break;

      default:
        return new Response(
          JSON.stringify({ error: { code: 'unknown_provider', message: `Unknown provider: ${aiRequest.provider}` } }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    // Add latency
    response.latency_ms = Date.now() - startTime;

    // Return response (key is NOT included)
    return new Response(
      JSON.stringify(response),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('LLM Proxy Error:', error.message); // Log message only, not stack with sensitive data

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

function validateAiRequest(req: AiRequest): { code: string; message: string } | null {
  if (!req.request_id) return { code: 'missing_field', message: 'request_id is required' };
  if (!req.provider) return { code: 'missing_field', message: 'provider is required' };
  if (!req.model) return { code: 'missing_field', message: 'model is required' };
  if (!req.messages || req.messages.length === 0) return { code: 'missing_field', message: 'messages is required' };
  return null;
}
```

### 5.3 Provider Adapter File Structure

```
supabase/functions/llm-proxy/
├── index.ts                    # Main handler
├── adapters/
│   ├── openai.ts              # OpenAI Responses API adapter
│   ├── anthropic.ts           # Anthropic Messages API adapter
│   ├── gemini.ts              # Gemini GenerateContent adapter
│   └── openai-compatible.ts   # Generic OpenAI-compatible adapter
├── security/
│   ├── allowlist.ts           # SSRF allowlist config
│   └── validation.ts          # Request validation
└── types.ts                   # Shared types
```

## 6. UI Settings

### 6.1 Settings Component

Location: `src/productivity-dashboard/components/settings/AiProviderSettings.tsx`

```typescript
interface AiProviderSettingsProps {
  onSave: (config: AiProviderConfig) => void;
  onTest: (config: AiProviderConfig) => Promise<boolean>;
}

interface AiProviderConfig {
  provider: AiProvider;
  model: string;
  apiKey: string;
  baseUrl?: string;           // For openai_compatible only
  redactPii: boolean;
}

// UI Layout
/*
┌─────────────────────────────────────────────────────────────┐
│ AI Provider Settings                                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Provider:  [OpenAI          ▼]                              │
│                                                             │
│ Model:     [gpt-4o          ▼]   (dropdown based on provider)│
│                                                             │
│ API Key:   [••••••••••••••••]   [Test Connection]           │
│            ℹ️ Key stored in browser session only             │
│                                                             │
│ ─────────────────────────────────────────────────────────── │
│                                                             │
│ Privacy Settings                                            │
│                                                             │
│ [✓] Redact PII before sending to AI                        │
│     Names, emails, phone numbers will be replaced           │
│     with placeholders before sending to the AI provider.    │
│                                                             │
│ ─────────────────────────────────────────────────────────── │
│                                                             │
│ (For OpenAI-Compatible only)                                │
│ Base URL:  [https://api.together.xyz/v1    ]               │
│            ℹ️ Must be on approved host list                  │
│                                                             │
│                                    [Cancel]  [Save Settings]│
└─────────────────────────────────────────────────────────────┘
*/
```

### 6.2 Provider-Specific Model Lists

```typescript
const PROVIDER_MODELS: Record<AiProvider, { id: string; name: string }[]> = {
  openai: [
    { id: 'gpt-4o', name: 'GPT-4o (Recommended)' },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini (Faster)' },
    { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
  ],
  anthropic: [
    { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4 (Recommended)' },
    { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku (Faster)' },
    { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus' },
  ],
  gemini: [
    { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro (Recommended)' },
    { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash (Faster)' },
  ],
  openai_compatible: [
    // User enters custom model name
  ],
};
```

### 6.3 Settings State Management

```typescript
// Context for AI settings
interface AiSettingsContextValue {
  config: AiProviderConfig | null;
  isConfigured: boolean;
  setConfig: (config: AiProviderConfig) => void;
  clearConfig: () => void;
  testConnection: () => Promise<{ success: boolean; error?: string }>;
}

// Hook for components that need AI
function useAiProvider(): {
  isAvailable: boolean;
  sendRequest: (request: Omit<AiRequest, 'provider' | 'model'>) => Promise<AiResponse>;
} {
  const { config, isConfigured } = useAiSettings();

  return {
    isAvailable: isConfigured,
    sendRequest: async (partialRequest) => {
      if (!config) throw new Error('AI provider not configured');

      const fullRequest: AiRequest = {
        ...partialRequest,
        provider: config.provider,
        model: config.model,
        redact_pii: config.redactPii,
      };

      return sendAiRequest(fullRequest);
    }
  };
}
```

## 7. SSRF Guardrails

### 7.1 OpenAI-Compatible Allowlist

Only these hosts are permitted for `openai_compatible` provider:

```typescript
// supabase/functions/llm-proxy/security/allowlist.ts

export const ALLOWED_OPENAI_COMPATIBLE_HOSTS = [
  // Major cloud AI providers
  'api.together.xyz',
  'api.fireworks.ai',
  'api.groq.com',
  'api.perplexity.ai',
  'api.deepinfra.com',
  'api.anyscale.com',
  'api.mistral.ai',
  'api.cohere.ai',

  // Self-hosted options (common patterns)
  'localhost',
  '127.0.0.1',

  // Enterprise patterns (wildcards processed separately)
  // '*.openai.azure.com' - Azure OpenAI
];

// Wildcard patterns for enterprise deployments
export const ALLOWED_HOST_PATTERNS = [
  /^[a-z0-9-]+\.openai\.azure\.com$/,  // Azure OpenAI
];

export function isAllowedHost(baseUrl: string | null): boolean {
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
    return false; // Invalid URL
  }
}
```

### 7.2 Additional SSRF Protections

```typescript
function validateBaseUrl(baseUrl: string): { valid: boolean; error?: string } {
  try {
    const url = new URL(baseUrl);

    // Must be HTTPS (except localhost)
    if (url.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(url.hostname)) {
      return { valid: false, error: 'HTTPS required for non-localhost URLs' };
    }

    // No internal IP ranges
    if (isPrivateIP(url.hostname)) {
      return { valid: false, error: 'Private IP addresses not allowed' };
    }

    // No ports other than 443/80 for external hosts
    if (url.port && !['localhost', '127.0.0.1'].includes(url.hostname)) {
      return { valid: false, error: 'Custom ports not allowed for external hosts' };
    }

    // Check allowlist
    if (!isAllowedHost(baseUrl)) {
      return { valid: false, error: 'Host not in allowlist' };
    }

    return { valid: true };
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }
}

function isPrivateIP(hostname: string): boolean {
  // Check for private IP ranges
  const privateRanges = [
    /^10\./,
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
    /^192\.168\./,
    /^169\.254\./,
    /^fc00:/,
    /^fe80:/,
  ];

  return privateRanges.some(range => range.test(hostname));
}
```

## 8. Testing Strategy

### 8.1 Mock Provider Responses

All tests use mocked provider responses. No real API calls are made.

```typescript
// src/productivity-dashboard/services/__tests__/aiService.test.ts

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { sendAiRequest } from '../aiService';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock responses for each provider
const MOCK_RESPONSES = {
  openai: {
    id: 'resp_123',
    model: 'gpt-4o',
    output: [{ content: [{ text: 'Mocked OpenAI response' }] }],
    usage: { input_tokens: 10, output_tokens: 20, total_tokens: 30 }
  },
  anthropic: {
    id: 'msg_123',
    model: 'claude-sonnet-4-20250514',
    content: [{ type: 'text', text: 'Mocked Anthropic response' }],
    usage: { input_tokens: 10, output_tokens: 20 },
    stop_reason: 'end_turn'
  },
  gemini: {
    candidates: [{
      content: { parts: [{ text: 'Mocked Gemini response' }] },
      finishReason: 'STOP'
    }],
    usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 20, totalTokenCount: 30 }
  }
};

describe('AI Service', () => {
  beforeEach(() => {
    mockFetch.mockClear();
    sessionStorage.clear();
  });

  describe('sendAiRequest', () => {
    it('should send request to OpenAI and parse response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          request_id: 'test-123',
          provider: 'openai',
          model: 'gpt-4o',
          content: 'Mocked OpenAI response',
          usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
          latency_ms: 150,
          finish_reason: 'stop'
        })
      });

      // Set up session key
      sessionStorage.setItem('proddash_ai_keys', JSON.stringify({
        openai: { provider: 'openai', apiKey: 'test-key' }
      }));

      const response = await sendAiRequest({
        request_id: 'test-123',
        provider: 'openai',
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Test message' }],
        feature_context: 'test',
        redact_pii: false
      });

      expect(response.content).toBe('Mocked OpenAI response');
      expect(response.provider).toBe('openai');
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should throw error when no API key configured', async () => {
      await expect(sendAiRequest({
        request_id: 'test-123',
        provider: 'openai',
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Test' }],
        feature_context: 'test',
        redact_pii: false
      })).rejects.toThrow('No API key configured');
    });
  });

  describe('PII Redaction', () => {
    it('should redact emails from request', () => {
      const result = redactPII(
        'Contact john.doe@example.com for details',
        { enabled: true, redactNames: true, redactContactInfo: true, redactIds: true }
      );

      expect(result.redactedText).not.toContain('john.doe@example.com');
      expect(result.redactedText).toContain('[REDACTED_EMAIL_');
    });

    it('should redact phone numbers', () => {
      const result = redactPII(
        'Call (555) 123-4567',
        { enabled: true, redactNames: true, redactContactInfo: true, redactIds: true }
      );

      expect(result.redactedText).not.toContain('555');
      expect(result.redactedText).toContain('[REDACTED_PHONE_');
    });
  });
});
```

### 8.2 Edge Function Tests

```typescript
// supabase/functions/llm-proxy/__tests__/index.test.ts

import { assertEquals, assertExists } from 'https://deno.land/std@0.177.0/testing/asserts.ts';
import { isAllowedHost, validateBaseUrl } from '../security/allowlist.ts';

Deno.test('SSRF Allowlist', async (t) => {
  await t.step('should allow approved hosts', () => {
    assertEquals(isAllowedHost('https://api.together.xyz/v1'), true);
    assertEquals(isAllowedHost('https://api.groq.com/v1'), true);
    assertEquals(isAllowedHost('https://api.mistral.ai/v1'), true);
  });

  await t.step('should block non-approved hosts', () => {
    assertEquals(isAllowedHost('https://evil.com/v1'), false);
    assertEquals(isAllowedHost('https://internal.company.local/v1'), false);
  });

  await t.step('should allow Azure OpenAI pattern', () => {
    assertEquals(isAllowedHost('https://mycompany.openai.azure.com/v1'), true);
  });

  await t.step('should block private IPs', () => {
    const result = validateBaseUrl('http://192.168.1.1/v1');
    assertEquals(result.valid, false);
    assertEquals(result.error, 'Private IP addresses not allowed');
  });
});

Deno.test('Provider Adapters', async (t) => {
  await t.step('should transform request to OpenAI format', () => {
    // Test OpenAI adapter transformation
  });

  await t.step('should transform request to Anthropic format', () => {
    // Test Anthropic adapter transformation
  });

  await t.step('should transform request to Gemini format', () => {
    // Test Gemini adapter transformation
  });
});
```

### 8.3 Integration Test Mocks

```typescript
// src/productivity-dashboard/services/__mocks__/aiService.ts

export const mockAiResponse = {
  request_id: 'mock-123',
  provider: 'openai',
  model: 'gpt-4o',
  content: 'This is a mocked AI response for testing.',
  usage: { prompt_tokens: 50, completion_tokens: 100, total_tokens: 150 },
  latency_ms: 200,
  finish_reason: 'stop' as const
};

export const sendAiRequest = vi.fn().mockResolvedValue(mockAiResponse);
export const isAiConfigured = vi.fn().mockReturnValue(true);
```

## 9. Implementation Phases

### Phase 1: Foundation
1. Create `AiRequest`/`AiResponse` types
2. Implement `llm-proxy` Edge Function skeleton
3. Add OpenAI adapter (primary provider)
4. Create basic UI settings component

### Phase 2: Providers
1. Add Anthropic adapter
2. Add Gemini adapter
3. Add OpenAI-compatible adapter with SSRF checks
4. Update UI with provider selection

### Phase 3: Security
1. Implement PII redaction service
2. Add redaction toggle to UI
3. Add comprehensive tests
4. Security audit of key handling

### Phase 4: Integration
1. Wire up PreMortem to use AI service
2. Add AI-powered explain features
3. Add connection testing UI
4. Performance optimization

## 10. File Manifest

### New Files to Create

```
src/productivity-dashboard/
├── services/
│   ├── aiService.ts              # Client-side AI request handling
│   ├── aiRedaction.ts            # PII redaction logic
│   └── __tests__/
│       ├── aiService.test.ts
│       └── aiRedaction.test.ts
├── types/
│   └── aiTypes.ts                # AiRequest, AiResponse, etc.
├── contexts/
│   └── AiSettingsContext.tsx     # Settings state management
└── components/
    └── settings/
        └── AiProviderSettings.tsx # Settings UI

supabase/functions/
└── llm-proxy/
    ├── index.ts                  # Main handler
    ├── types.ts                  # Shared types
    ├── adapters/
    │   ├── openai.ts
    │   ├── anthropic.ts
    │   ├── gemini.ts
    │   └── openai-compatible.ts
    ├── security/
    │   ├── allowlist.ts
    │   └── validation.ts
    └── __tests__/
        └── index.test.ts
```

## 11. Success Criteria Checklist

- [ ] `AiRequest` and `AiResponse` contracts implemented with all fields
- [ ] OpenAI adapter working with Responses API
- [ ] Anthropic adapter working with Messages API
- [ ] Gemini adapter working with GenerateContent API
- [ ] OpenAI-compatible adapter with SSRF allowlist
- [ ] Session-only key storage (no server persistence)
- [ ] PII redaction with toggle
- [ ] `llm-proxy` Edge Function deployed and routing
- [ ] UI settings with provider/model/key/redact controls
- [ ] All provider calls mocked in tests
- [ ] Zero real API calls in test suite
- [ ] SSRF allowlist enforced for openai_compatible
