// AI Provider Types for BYOK Multi-Provider Integration

export type AiProvider = 'openai' | 'anthropic' | 'gemini' | 'openai_compatible';

/**
 * Standard writing guidelines for all AI-generated content.
 * Append this to all system prompts to ensure consistent, clear communication.
 */
export const AI_WRITING_GUIDELINES = `
WRITING STYLE (MANDATORY):
- Use a 5th grade reading level so all concepts are clear
- Use general business language, not recruiting jargon
- Think like a McKinsey senior partner: lead with "So what?", then evidence, then next steps
- Do not exaggerate. Do not make up numbers. Do not add context that isn't there.
- Simply translate the data into concepts busy leaders can understand quickly

STYLE RULES:
- Short sentences. Active voice. No filler words.
- Replace jargon: "pipeline depth" → "candidate pool", "velocity decay" → "hiring slowdown", "capacity gap" → "team bandwidth"
- Lead with the bottom line, then support it
- Be direct and actionable
`;

export interface AiMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface AiRequest {
  // Required fields
  request_id: string;
  provider: AiProvider;
  model: string;
  messages: AiMessage[];

  // Optional fields
  system_prompt?: string;
  max_tokens?: number;
  temperature?: number;
  stop_sequences?: string[];

  // Metadata (not sent to provider)
  feature_context: string;
  redact_pii: boolean;
}

export interface AiResponse {
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

// UI Configuration - stored in memory only (no persistence)
export interface AiProviderConfig {
  provider: AiProvider;
  model: string;
  apiKey: string;              // In-memory only, never persisted
  baseUrl?: string;            // For openai_compatible only
  redactPii: boolean;          // Default: true
  temperature: number;         // Default: 0.7
  maxTokens: number;           // Default: 1024
  aiEnabled: boolean;          // Default: true - master toggle for AI features
}

// Provider model options
export interface ModelOption {
  id: string;
  name: string;
  description?: string;
  category?: string;
}

export const PROVIDER_MODELS: Record<AiProvider, ModelOption[]> = {
  openai: [
    // GPT-5 Series (Latest)
    { id: 'gpt-5.2', name: 'GPT-5.2', description: 'Latest flagship model', category: 'GPT-5' },
    { id: 'gpt-5.1', name: 'GPT-5.1', description: 'Previous GPT-5 release', category: 'GPT-5' },
    { id: 'gpt-5', name: 'GPT-5', description: 'Initial GPT-5 release', category: 'GPT-5' },
    // o-Series Reasoning Models
    { id: 'o3', name: 'o3', description: 'Most capable reasoning model', category: 'Reasoning' },
    { id: 'o3-mini', name: 'o3-mini', description: 'Fast reasoning model', category: 'Reasoning' },
    { id: 'o1', name: 'o1', description: 'Advanced reasoning', category: 'Reasoning' },
    { id: 'o1-mini', name: 'o1-mini', description: 'Efficient reasoning', category: 'Reasoning' },
    { id: 'o1-preview', name: 'o1-preview', description: 'Reasoning preview', category: 'Reasoning' },
    // GPT-4o Series
    { id: 'gpt-4o', name: 'GPT-4o', description: 'Multimodal flagship', category: 'GPT-4o' },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: 'Fast and affordable', category: 'GPT-4o' },
    { id: 'gpt-4o-2024-11-20', name: 'GPT-4o (Nov 2024)', description: 'Specific snapshot', category: 'GPT-4o' },
    { id: 'gpt-4o-2024-08-06', name: 'GPT-4o (Aug 2024)', description: 'Specific snapshot', category: 'GPT-4o' },
    { id: 'chatgpt-4o-latest', name: 'ChatGPT-4o Latest', description: 'ChatGPT optimized', category: 'GPT-4o' },
    // GPT-4 Turbo
    { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', description: '128k context', category: 'GPT-4' },
    { id: 'gpt-4-turbo-preview', name: 'GPT-4 Turbo Preview', description: 'Preview version', category: 'GPT-4' },
    { id: 'gpt-4-turbo-2024-04-09', name: 'GPT-4 Turbo (Apr 2024)', description: 'Specific snapshot', category: 'GPT-4' },
    // GPT-4
    { id: 'gpt-4', name: 'GPT-4', description: 'Original GPT-4', category: 'GPT-4' },
    { id: 'gpt-4-32k', name: 'GPT-4 32k', description: '32k context window', category: 'GPT-4' },
    // GPT-3.5
    { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', description: 'Fast and economical', category: 'GPT-3.5' },
    { id: 'gpt-3.5-turbo-16k', name: 'GPT-3.5 Turbo 16k', description: 'Extended context', category: 'GPT-3.5' },
  ],
  anthropic: [
    // Claude 4 Series
    { id: 'claude-opus-4-20250514', name: 'Claude Opus 4', description: 'Most capable', category: 'Claude 4' },
    { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', description: 'Balanced performance', category: 'Claude 4' },
    // Claude 3.5 Series
    { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', description: 'Latest 3.5', category: 'Claude 3.5' },
    { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', description: 'Fast and efficient', category: 'Claude 3.5' },
    // Claude 3 Series
    { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', description: 'Previous flagship', category: 'Claude 3' },
    { id: 'claude-3-sonnet-20240229', name: 'Claude 3 Sonnet', description: 'Balanced', category: 'Claude 3' },
    { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku', description: 'Fastest', category: 'Claude 3' },
  ],
  gemini: [
    // Gemini 2.0
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', description: 'Latest fast model', category: 'Gemini 2.0' },
    { id: 'gemini-2.0-flash-thinking', name: 'Gemini 2.0 Flash Thinking', description: 'With reasoning', category: 'Gemini 2.0' },
    // Gemini 1.5
    { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', description: '2M context window', category: 'Gemini 1.5' },
    { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', description: 'Fast and efficient', category: 'Gemini 1.5' },
    { id: 'gemini-1.5-flash-8b', name: 'Gemini 1.5 Flash 8B', description: 'Smallest/fastest', category: 'Gemini 1.5' },
    // Gemini 1.0
    { id: 'gemini-1.0-pro', name: 'Gemini 1.0 Pro', description: 'Previous generation', category: 'Gemini 1.0' },
  ],
  openai_compatible: [
    // User enters custom model name
  ],
};

export const PROVIDER_LABELS: Record<AiProvider, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  gemini: 'Google Gemini',
  openai_compatible: 'OpenAI-Compatible',
};

// Default configuration
export const DEFAULT_AI_CONFIG: Omit<AiProviderConfig, 'apiKey'> = {
  provider: 'openai',
  model: 'gpt-5.2',
  redactPii: true,
  temperature: 0.7,
  maxTokens: 4096,
  aiEnabled: true,
};

// ===== KEY STORAGE TYPES =====

/**
 * Scope for AI API key storage
 * - 'user': Key saved for the current user only
 * - 'org': Key shared with all members of the organization (admin only)
 */
export type AiKeyScope = 'user' | 'org';

/**
 * Storage mode for AI provider keys (legacy, kept for backwards compatibility)
 * - 'memory': Keys stored in memory only (default, cleared on page refresh)
 * - 'vault': Keys encrypted and stored in Supabase, unlocked with passphrase
 * @deprecated Use 'persisted' mode with AiKeyScope instead
 */
export type AiKeyStorageMode = 'memory' | 'vault' | 'persisted';

/**
 * Stored AI key record (from database)
 */
export interface StoredAiKey {
  provider: AiProvider;
  apiKey: string;
  model?: string;
  baseUrl?: string;
  scope: AiKeyScope;
  setBy?: string; // user_id who set the key (for org keys)
  updatedAt: Date;
}

/**
 * AI key state for UI
 */
export interface AiKeyState {
  /** Whether keys are being loaded */
  isLoading: boolean;
  /** Error from last operation */
  error: string | null;
  /** User's own stored keys (by provider) */
  userKeys: Map<AiProvider, StoredAiKey>;
  /** Organization's shared keys (by provider) */
  orgKeys: Map<AiProvider, StoredAiKey>;
  /** List of providers with user keys */
  userProviders: AiProvider[];
  /** List of providers with org keys */
  orgProviders: AiProvider[];
}

/**
 * Initial key state
 */
export const INITIAL_KEY_STATE: AiKeyState = {
  isLoading: false,
  error: null,
  userKeys: new Map(),
  orgKeys: new Map(),
  userProviders: [],
  orgProviders: [],
};

/**
 * Vault state for UI (legacy, kept for backwards compatibility)
 * @deprecated Use AiKeyState instead
 */
export interface AiVaultState {
  /** Current storage mode */
  storageMode: AiKeyStorageMode;
  /** Whether vault has stored entries (checked on login) */
  hasVaultEntries: boolean;
  /** Whether vault is currently unlocked (keys decrypted in memory) */
  isUnlocked: boolean;
  /** List of providers with keys stored in vault */
  storedProviders: AiProvider[];
  /** Loading state for vault operations */
  isLoading: boolean;
  /** Error from last vault operation */
  error: string | null;
}

/**
 * Initial vault state
 */
export const INITIAL_VAULT_STATE: AiVaultState = {
  storageMode: 'memory',
  hasVaultEntries: false,
  isUnlocked: false,
  storedProviders: [],
  isLoading: false,
  error: null,
};
