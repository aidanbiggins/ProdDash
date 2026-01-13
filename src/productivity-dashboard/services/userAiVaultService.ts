/**
 * User AI Vault Service
 *
 * Supabase access layer for encrypted API key vault.
 * Handles CRUD operations for user_ai_vault table.
 * RLS ensures users can only access their own vault entries.
 *
 * IMPORTANT: This service handles encrypted blobs only.
 * Encryption/decryption happens in vaultCrypto.ts client-side.
 */

import { supabase } from '../../lib/supabase';
import { EncryptedBlob, isValidEncryptedBlob } from './vaultCrypto';

export type VaultProvider = 'openai' | 'anthropic' | 'gemini' | 'openai_compatible';

export interface VaultEntry {
  provider: VaultProvider;
  encrypted_blob: EncryptedBlob;
  updated_at: string;
}

/**
 * Fetch all vault entries for the current user
 *
 * @returns Map of provider to encrypted blob, or empty map if none found
 */
export async function fetchVault(): Promise<Map<VaultProvider, EncryptedBlob>> {
  const result = new Map<VaultProvider, EncryptedBlob>();

  if (!supabase) {
    console.warn('[Vault] Supabase not configured');
    return result;
  }

  try {
    const { data, error } = await supabase
      .from('user_ai_vault')
      .select('provider, encrypted_blob, updated_at');

    if (error) {
      // If table doesn't exist yet, return empty map gracefully
      if (error.code === '42P01') {
        console.warn('[Vault] Table not yet created');
        return result;
      }
      console.error('[Vault] Error fetching vault:', error.message);
      return result;
    }

    if (data) {
      for (const row of data) {
        if (isValidEncryptedBlob(row.encrypted_blob)) {
          result.set(row.provider as VaultProvider, row.encrypted_blob);
        }
      }
    }

    return result;
  } catch (err) {
    console.error('[Vault] Unexpected error fetching vault:', err);
    return result;
  }
}

/**
 * Check if the user has any vault entries (without fetching full blobs)
 *
 * @returns true if vault has entries, false otherwise
 */
export async function hasVaultEntries(): Promise<boolean> {
  if (!supabase) return false;

  try {
    const { count, error } = await supabase
      .from('user_ai_vault')
      .select('id', { count: 'exact', head: true });

    if (error) {
      // Table doesn't exist yet
      if (error.code === '42P01') return false;
      return false;
    }

    return (count ?? 0) > 0;
  } catch {
    return false;
  }
}

/**
 * Upsert an encrypted key for a provider
 * Creates or updates the entry for this provider.
 *
 * @param provider - The AI provider (openai, anthropic, etc.)
 * @param encryptedBlob - The encrypted blob from vaultCrypto
 * @returns true on success, false on failure
 */
export async function upsertProviderKey(
  provider: VaultProvider,
  encryptedBlob: EncryptedBlob
): Promise<boolean> {
  if (!supabase) {
    console.warn('[Vault] Supabase not configured');
    return false;
  }

  try {
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.error('[Vault] No authenticated user');
      return false;
    }

    const { error } = await supabase
      .from('user_ai_vault')
      .upsert(
        {
          user_id: user.id,
          provider,
          encrypted_blob: encryptedBlob,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'user_id,provider',
        }
      );

    if (error) {
      console.error('[Vault] Error upserting key:', error.message);
      return false;
    }

    return true;
  } catch (err) {
    console.error('[Vault] Unexpected error upserting key:', err);
    return false;
  }
}

/**
 * Upsert multiple encrypted keys at once
 *
 * @param keys - Map of provider to encrypted blob
 * @returns Number of successful upserts
 */
export async function upsertAllKeys(
  keys: Map<VaultProvider, EncryptedBlob>
): Promise<number> {
  if (!supabase) return 0;

  let successCount = 0;
  for (const [provider, blob] of keys) {
    const success = await upsertProviderKey(provider, blob);
    if (success) successCount++;
  }

  return successCount;
}

/**
 * Delete a single provider key from the vault
 *
 * @param provider - The provider to delete
 * @returns true on success, false on failure
 */
export async function deleteProviderKey(provider: VaultProvider): Promise<boolean> {
  if (!supabase) return false;

  try {
    const { error } = await supabase
      .from('user_ai_vault')
      .delete()
      .eq('provider', provider);

    if (error) {
      console.error('[Vault] Error deleting key:', error.message);
      return false;
    }

    return true;
  } catch (err) {
    console.error('[Vault] Unexpected error deleting key:', err);
    return false;
  }
}

/**
 * Delete all vault entries for the current user
 * Used when user wants to "forget" all stored keys.
 *
 * @returns true on success, false on failure
 */
export async function deleteVault(): Promise<boolean> {
  if (!supabase) {
    console.warn('[Vault] Supabase not configured');
    return false;
  }

  try {
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.error('[Vault] No authenticated user');
      return false;
    }

    // Delete all entries for this user
    // RLS will ensure only user's own entries are affected
    const { error } = await supabase
      .from('user_ai_vault')
      .delete()
      .eq('user_id', user.id);

    if (error) {
      console.error('[Vault] Error deleting vault:', error.message);
      return false;
    }

    return true;
  } catch (err) {
    console.error('[Vault] Unexpected error deleting vault:', err);
    return false;
  }
}

/**
 * Get list of providers that have stored keys
 *
 * @returns Array of providers with vault entries
 */
export async function getStoredProviders(): Promise<VaultProvider[]> {
  if (!supabase) return [];

  try {
    const { data, error } = await supabase
      .from('user_ai_vault')
      .select('provider');

    if (error) {
      if (error.code === '42P01') return []; // Table doesn't exist
      return [];
    }

    return (data || []).map(row => row.provider as VaultProvider);
  } catch {
    return [];
  }
}
