// AI Provider Types for BYOK Multi-Provider Integration

export type AiProvider = 'openai' | 'anthropic' | 'gemini' | 'openai_compatible';

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
}

// Provider model options
export interface ModelOption {
  id: string;
  name: string;
  description?: string;
}

export const PROVIDER_MODELS: Record<AiProvider, ModelOption[]> = {
  openai: [
    { id: 'gpt-4o', name: 'GPT-4o', description: 'Most capable, recommended' },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: 'Faster and cheaper' },
    { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', description: 'Previous generation' },
  ],
  anthropic: [
    { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', description: 'Most capable, recommended' },
    { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', description: 'Faster and cheaper' },
    { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', description: 'Most capable previous gen' },
  ],
  gemini: [
    { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', description: 'Most capable, recommended' },
    { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', description: 'Faster and cheaper' },
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
  model: 'gpt-4o',
  redactPii: true,
  temperature: 0.7,
  maxTokens: 1024,
};

// ===== VAULT TYPES =====

/**
 * Storage mode for AI provider keys
 * - 'memory': Keys stored in memory only (default, cleared on page refresh)
 * - 'vault': Keys encrypted and stored in Supabase, unlocked with passphrase
 */
export type AiKeyStorageMode = 'memory' | 'vault';

/**
 * Vault state for UI
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
