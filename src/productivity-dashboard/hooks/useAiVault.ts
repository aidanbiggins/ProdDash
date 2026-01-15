/**
 * useAiVault Hook
 *
 * Manages AI API key vault operations:
 * - Checking if vault has entries
 * - Unlocking vault with passphrase
 * - Saving keys to vault
 * - Forgetting/clearing vault
 *
 * Zero-knowledge: Server never sees plaintext keys.
 * Keys are encrypted client-side before storage.
 */

import { useState, useCallback, useEffect } from 'react';
import {
  AiProvider,
  AiProviderConfig,
  AiKeyStorageMode,
  AiVaultState,
  INITIAL_VAULT_STATE,
  DEFAULT_AI_CONFIG,
} from '../types/aiTypes';
import {
  encryptKey,
  decryptKey,
  encryptAllKeys,
  decryptAllKeys,
  EncryptedBlob,
} from '../services/vaultCrypto';
import {
  fetchVault,
  hasVaultEntries,
  upsertProviderKey,
  upsertAllKeys,
  deleteVault,
  getStoredProviders,
  VaultProvider,
} from '../services/userAiVaultService';

// Storage key for vault mode preference
const VAULT_MODE_KEY = 'ai-key-storage-mode';

/**
 * Get stored storage mode preference from localStorage
 */
function getStoredStorageMode(): AiKeyStorageMode {
  try {
    const stored = localStorage.getItem(VAULT_MODE_KEY);
    if (stored === 'vault') return 'vault';
  } catch {
    // localStorage not available
  }
  return 'memory';
}

/**
 * Save storage mode preference to localStorage
 */
function setStoredStorageMode(mode: AiKeyStorageMode): void {
  try {
    localStorage.setItem(VAULT_MODE_KEY, mode);
  } catch {
    // localStorage not available
  }
}

export interface UseAiVaultReturn {
  /** Current vault state */
  vaultState: AiVaultState;

  /** Change storage mode (memory or vault) */
  setStorageMode: (mode: AiKeyStorageMode) => void;

  /** Check if vault has any stored keys */
  checkVaultEntries: () => Promise<void>;

  /**
   * Unlock vault with passphrase
   * Returns map of provider -> API key, or null if unlock fails
   */
  unlockVault: (passphrase: string) => Promise<Map<AiProvider, string> | null>;

  /**
   * Save current in-memory keys to vault (encrypts with passphrase)
   * @param keys - Map of provider -> API key
   * @param passphrase - Passphrase to encrypt with
   */
  saveToVault: (keys: Map<AiProvider, string>, passphrase: string) => Promise<boolean>;

  /**
   * Forget all vault keys (deletes from server + clears memory)
   */
  forgetVault: () => Promise<boolean>;

  /** Clear error state */
  clearError: () => void;
}

export function useAiVault(): UseAiVaultReturn {
  const [vaultState, setVaultState] = useState<AiVaultState>(() => ({
    ...INITIAL_VAULT_STATE,
    storageMode: getStoredStorageMode(),
  }));

  // Check for vault entries on mount and when storage mode changes to vault
  useEffect(() => {
    if (vaultState.storageMode === 'vault') {
      checkVaultEntries();
    }
  }, [vaultState.storageMode]);

  const setStorageMode = useCallback((mode: AiKeyStorageMode) => {
    setStoredStorageMode(mode);
    setVaultState(prev => ({
      ...prev,
      storageMode: mode,
      // Reset unlock state when switching modes
      isUnlocked: mode === 'memory' ? false : prev.isUnlocked,
    }));
  }, []);

  const checkVaultEntries = useCallback(async () => {
    setVaultState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const [hasEntries, providers] = await Promise.all([
        hasVaultEntries(),
        getStoredProviders(),
      ]);

      setVaultState(prev => ({
        ...prev,
        hasVaultEntries: hasEntries,
        storedProviders: providers as AiProvider[],
        isLoading: false,
      }));
    } catch (err) {
      setVaultState(prev => ({
        ...prev,
        isLoading: false,
        error: 'Failed to check vault status',
      }));
    }
  }, []);

  const unlockVault = useCallback(async (passphrase: string): Promise<Map<AiProvider, string> | null> => {
    setVaultState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // Fetch encrypted blobs from vault
      const encryptedBlobs = await fetchVault();

      if (encryptedBlobs.size === 0) {
        setVaultState(prev => ({
          ...prev,
          isLoading: false,
          hasVaultEntries: false,
          isUnlocked: false,
          error: 'No keys found in vault',
        }));
        return null;
      }

      // Decrypt all keys with passphrase
      const decryptedKeys = await decryptAllKeys(encryptedBlobs, passphrase);

      if (decryptedKeys.size === 0) {
        // Decryption failed - wrong passphrase
        setVaultState(prev => ({
          ...prev,
          isLoading: false,
          error: 'Incorrect passphrase',
        }));
        return null;
      }

      // Successfully unlocked
      setVaultState(prev => ({
        ...prev,
        isLoading: false,
        isUnlocked: true,
        storedProviders: Array.from(decryptedKeys.keys()) as AiProvider[],
        error: null,
      }));

      return decryptedKeys as Map<AiProvider, string>;
    } catch (err) {
      setVaultState(prev => ({
        ...prev,
        isLoading: false,
        error: 'Failed to unlock vault',
      }));
      return null;
    }
  }, []);

  const saveToVault = useCallback(async (
    keys: Map<AiProvider, string>,
    passphrase: string
  ): Promise<boolean> => {
    if (keys.size === 0) {
      setVaultState(prev => ({ ...prev, error: 'No keys to save' }));
      return false;
    }

    setVaultState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // Encrypt all keys with passphrase
      const encryptedBlobs = await encryptAllKeys(keys, passphrase);

      // Save to vault
      const successCount = await upsertAllKeys(encryptedBlobs as Map<VaultProvider, EncryptedBlob>);

      if (successCount === 0) {
        setVaultState(prev => ({
          ...prev,
          isLoading: false,
          error: 'Failed to save keys to vault',
        }));
        return false;
      }

      // Update state
      setVaultState(prev => ({
        ...prev,
        isLoading: false,
        hasVaultEntries: true,
        isUnlocked: true,
        storedProviders: Array.from(keys.keys()),
        error: null,
      }));

      return true;
    } catch (err) {
      setVaultState(prev => ({
        ...prev,
        isLoading: false,
        error: 'Failed to encrypt and save keys',
      }));
      return false;
    }
  }, []);

  const forgetVault = useCallback(async (): Promise<boolean> => {
    setVaultState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const success = await deleteVault();

      if (!success) {
        setVaultState(prev => ({
          ...prev,
          isLoading: false,
          error: 'Failed to delete vault',
        }));
        return false;
      }

      // Reset vault state
      setVaultState(prev => ({
        ...prev,
        isLoading: false,
        hasVaultEntries: false,
        isUnlocked: false,
        storedProviders: [],
        error: null,
      }));

      return true;
    } catch (err) {
      setVaultState(prev => ({
        ...prev,
        isLoading: false,
        error: 'Failed to forget vault',
      }));
      return false;
    }
  }, []);

  const clearError = useCallback(() => {
    setVaultState(prev => ({ ...prev, error: null }));
  }, []);

  return {
    vaultState,
    setStorageMode,
    checkVaultEntries,
    unlockVault,
    saveToVault,
    forgetVault,
    clearError,
  };
}

/**
 * Helper to convert configs to a keys map for vault operations
 */
export function configsToKeysMap(configs: Map<AiProvider, AiProviderConfig>): Map<AiProvider, string> {
  const keysMap = new Map<AiProvider, string>();
  for (const [provider, config] of configs) {
    if (config.apiKey) {
      keysMap.set(provider, config.apiKey);
    }
  }
  return keysMap;
}

/**
 * Helper to hydrate configs from vault keys
 */
export function keysToConfigs(
  keys: Map<AiProvider, string>,
  existingConfigs?: Map<AiProvider, Partial<AiProviderConfig>>
): Map<AiProvider, AiProviderConfig> {
  const configs = new Map<AiProvider, AiProviderConfig>();

  for (const [provider, apiKey] of keys) {
    const existing = existingConfigs?.get(provider);
    configs.set(provider, {
      provider,
      model: existing?.model ?? getDefaultModelForProvider(provider),
      apiKey,
      baseUrl: existing?.baseUrl,
      redactPii: existing?.redactPii ?? DEFAULT_AI_CONFIG.redactPii,
      temperature: existing?.temperature ?? DEFAULT_AI_CONFIG.temperature,
      maxTokens: existing?.maxTokens ?? DEFAULT_AI_CONFIG.maxTokens,
    });
  }

  return configs;
}

function getDefaultModelForProvider(provider: AiProvider): string {
  switch (provider) {
    case 'openai': return 'gpt-4o';
    case 'anthropic': return 'claude-sonnet-4-20250514';
    case 'gemini': return 'gemini-1.5-pro';
    case 'openai_compatible': return 'custom';
    default: return 'gpt-4o';
  }
}

// ============================================
// NEW: useAiKeys hook (no passphrase required)
// ============================================

import {
  AiKeyScope,
  AiKeyState,
  StoredAiKey,
  INITIAL_KEY_STATE,
} from '../types/aiTypes';
import {
  fetchUserAiKeys,
  saveUserAiKey,
  deleteUserAiKey,
  deleteAllUserAiKeys,
  getUserStoredProviders,
} from '../services/userAiVaultService';
import {
  fetchOrgAiKeys,
  upsertOrgAiKey,
  deleteOrgAiKey,
  deleteAllOrgAiKeys,
  getOrgStoredProviders,
} from '../services/orgAiKeyService';

export interface UseAiKeysReturn {
  /** Current key state */
  keyState: AiKeyState;

  /** Load all keys (user + org) */
  loadKeys: (orgId: string | null) => Promise<void>;

  /**
   * Save an API key
   * @param provider - AI provider
   * @param apiKey - The API key to save
   * @param scope - 'user' for user-only, 'org' for organization-wide
   * @param orgId - Required if scope is 'org'
   * @param userId - Required if scope is 'org' (for audit trail)
   * @param options - Optional model and baseUrl
   */
  saveKey: (
    provider: AiProvider,
    apiKey: string,
    scope: AiKeyScope,
    orgId?: string | null,
    userId?: string,
    options?: { model?: string; baseUrl?: string }
  ) => Promise<boolean>;

  /**
   * Delete a stored key
   * @param provider - AI provider
   * @param scope - Which scope to delete from
   * @param orgId - Required if scope is 'org'
   */
  deleteKey: (provider: AiProvider, scope: AiKeyScope, orgId?: string | null) => Promise<boolean>;

  /**
   * Get the effective key for a provider (user key takes precedence over org key)
   */
  getEffectiveKey: (provider: AiProvider) => StoredAiKey | null;

  /**
   * Get all effective keys (user keys take precedence)
   */
  getEffectiveKeys: () => Map<AiProvider, StoredAiKey>;

  /** Clear error state */
  clearError: () => void;
}

export function useAiKeys(): UseAiKeysReturn {
  const [keyState, setKeyState] = useState<AiKeyState>(INITIAL_KEY_STATE);

  const loadKeys = useCallback(async (orgId: string | null) => {
    setKeyState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const [userKeys, orgKeys] = await Promise.all([
        fetchUserAiKeys(),
        orgId ? fetchOrgAiKeys(orgId) : Promise.resolve(new Map<AiProvider, StoredAiKey>()),
      ]);

      setKeyState({
        isLoading: false,
        error: null,
        userKeys,
        orgKeys,
        userProviders: Array.from(userKeys.keys()),
        orgProviders: Array.from(orgKeys.keys()),
      });
    } catch (err: any) {
      console.error('[useAiKeys] loadKeys error:', err);
      setKeyState(prev => ({
        ...prev,
        isLoading: false,
        error: err.message || 'Failed to load AI keys',
      }));
    }
  }, []);

  const saveKey = useCallback(async (
    provider: AiProvider,
    apiKey: string,
    scope: AiKeyScope,
    orgId?: string | null,
    userId?: string,
    options?: { model?: string; baseUrl?: string }
  ): Promise<boolean> => {
    setKeyState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      if (scope === 'user') {
        const success = await saveUserAiKey(provider, apiKey, options);
        if (!success) {
          throw new Error('Failed to save user key');
        }

        // Update local state
        setKeyState(prev => {
          const newUserKeys = new Map(prev.userKeys);
          newUserKeys.set(provider, {
            provider,
            apiKey,
            model: options?.model,
            baseUrl: options?.baseUrl,
            scope: 'user',
            updatedAt: new Date(),
          });
          return {
            ...prev,
            isLoading: false,
            userKeys: newUserKeys,
            userProviders: Array.from(newUserKeys.keys()),
          };
        });
      } else {
        // scope === 'org'
        if (!orgId || !userId) {
          throw new Error('Organization ID and user ID required for org-level keys');
        }

        await upsertOrgAiKey(orgId, provider, apiKey, userId, options);

        // Update local state
        setKeyState(prev => {
          const newOrgKeys = new Map(prev.orgKeys);
          newOrgKeys.set(provider, {
            provider,
            apiKey,
            model: options?.model,
            baseUrl: options?.baseUrl,
            scope: 'org',
            setBy: userId,
            updatedAt: new Date(),
          });
          return {
            ...prev,
            isLoading: false,
            orgKeys: newOrgKeys,
            orgProviders: Array.from(newOrgKeys.keys()),
          };
        });
      }

      return true;
    } catch (err: any) {
      console.error('[useAiKeys] saveKey error:', err);
      setKeyState(prev => ({
        ...prev,
        isLoading: false,
        error: err.message || 'Failed to save key',
      }));
      return false;
    }
  }, []);

  const deleteKey = useCallback(async (
    provider: AiProvider,
    scope: AiKeyScope,
    orgId?: string | null
  ): Promise<boolean> => {
    setKeyState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      if (scope === 'user') {
        const success = await deleteUserAiKey(provider);
        if (!success) {
          throw new Error('Failed to delete user key');
        }

        // Update local state
        setKeyState(prev => {
          const newUserKeys = new Map(prev.userKeys);
          newUserKeys.delete(provider);
          return {
            ...prev,
            isLoading: false,
            userKeys: newUserKeys,
            userProviders: Array.from(newUserKeys.keys()),
          };
        });
      } else {
        // scope === 'org'
        if (!orgId) {
          throw new Error('Organization ID required for org-level keys');
        }

        await deleteOrgAiKey(orgId, provider);

        // Update local state
        setKeyState(prev => {
          const newOrgKeys = new Map(prev.orgKeys);
          newOrgKeys.delete(provider);
          return {
            ...prev,
            isLoading: false,
            orgKeys: newOrgKeys,
            orgProviders: Array.from(newOrgKeys.keys()),
          };
        });
      }

      return true;
    } catch (err: any) {
      console.error('[useAiKeys] deleteKey error:', err);
      setKeyState(prev => ({
        ...prev,
        isLoading: false,
        error: err.message || 'Failed to delete key',
      }));
      return false;
    }
  }, []);

  const getEffectiveKey = useCallback((provider: AiProvider): StoredAiKey | null => {
    // User key takes precedence over org key
    return keyState.userKeys.get(provider) || keyState.orgKeys.get(provider) || null;
  }, [keyState.userKeys, keyState.orgKeys]);

  const getEffectiveKeys = useCallback((): Map<AiProvider, StoredAiKey> => {
    const effective = new Map<AiProvider, StoredAiKey>();

    // Start with org keys
    for (const [provider, key] of keyState.orgKeys) {
      effective.set(provider, key);
    }

    // Override with user keys (user takes precedence)
    for (const [provider, key] of keyState.userKeys) {
      effective.set(provider, key);
    }

    return effective;
  }, [keyState.userKeys, keyState.orgKeys]);

  const clearError = useCallback(() => {
    setKeyState(prev => ({ ...prev, error: null }));
  }, []);

  return {
    keyState,
    loadKeys,
    saveKey,
    deleteKey,
    getEffectiveKey,
    getEffectiveKeys,
    clearError,
  };
}
