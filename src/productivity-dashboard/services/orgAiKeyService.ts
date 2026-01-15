// Organization AI Key Service
// Manages organization-level AI API keys that are shared with all org members
// Only admins and super admins can set org-level keys
// Keys are encrypted server-side using the ai-vault-crypto Edge Function

import { supabase } from '../../lib/supabase';
import { AiProvider, StoredAiKey } from '../types/aiTypes';
import {
  encryptApiKey,
  decryptApiKey,
  EncryptedBlob,
  isValidEncryptedBlob,
} from './aiVaultCryptoService';

interface OrgAiKeyRow {
  id: string;
  organization_id: string;
  provider: AiProvider;
  encrypted_key: EncryptedBlob | null;
  model: string | null;
  base_url: string | null;
  set_by: string | null;
  updated_at: string;
  created_at: string;
}

/**
 * Fetch all AI keys for an organization (with server-side decryption)
 */
export async function fetchOrgAiKeys(orgId: string): Promise<Map<AiProvider, StoredAiKey>> {
  if (!supabase || !orgId) {
    return new Map();
  }

  try {
    const { data, error } = await supabase
      .from('org_ai_keys')
      .select('*')
      .eq('organization_id', orgId);

    if (error) {
      // Table might not exist yet
      if (error.code === '42P01') {
        console.log('[OrgAiKeyService] org_ai_keys table not found, returning empty');
        return new Map();
      }
      throw error;
    }

    const keys = new Map<AiProvider, StoredAiKey>();

    // Decrypt keys in parallel
    const decryptionPromises: Promise<void>[] = [];

    for (const row of (data || []) as OrgAiKeyRow[]) {
      if (row.encrypted_key && isValidEncryptedBlob(row.encrypted_key)) {
        const promise = (async () => {
          const apiKey = await decryptApiKey(row.encrypted_key!);
          if (apiKey) {
            keys.set(row.provider, {
              provider: row.provider,
              apiKey,
              model: row.model ?? undefined,
              baseUrl: row.base_url ?? undefined,
              scope: 'org',
              setBy: row.set_by ?? undefined,
              updatedAt: new Date(row.updated_at),
            });
          }
        })();
        decryptionPromises.push(promise);
      }
    }

    await Promise.all(decryptionPromises);

    return keys;
  } catch (err) {
    console.error('[OrgAiKeyService] fetchOrgAiKeys error:', err);
    return new Map();
  }
}

/**
 * Check if organization has any AI keys stored
 */
export async function hasOrgAiKeys(orgId: string): Promise<boolean> {
  if (!supabase || !orgId) {
    return false;
  }

  try {
    const { count, error } = await supabase
      .from('org_ai_keys')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .not('encrypted_key', 'is', null);

    if (error) {
      if (error.code === '42P01') return false;
      throw error;
    }

    return (count ?? 0) > 0;
  } catch (err) {
    console.error('[OrgAiKeyService] hasOrgAiKeys error:', err);
    return false;
  }
}

/**
 * Save or update an organization AI key (with server-side encryption)
 * Only admins and super admins can do this (enforced by RLS)
 */
export async function upsertOrgAiKey(
  orgId: string,
  provider: AiProvider,
  apiKey: string,
  userId: string,
  options?: { model?: string; baseUrl?: string }
): Promise<void> {
  if (!supabase || !orgId) {
    throw new Error('Supabase not configured');
  }

  // Encrypt the API key server-side
  const encryptedKey = await encryptApiKey(apiKey);
  if (!encryptedKey) {
    throw new Error('Failed to encrypt API key');
  }

  const { error } = await supabase
    .from('org_ai_keys')
    .upsert(
      {
        organization_id: orgId,
        provider,
        encrypted_key: encryptedKey,
        model: options?.model ?? null,
        base_url: options?.baseUrl ?? null,
        set_by: userId,
      },
      {
        onConflict: 'organization_id,provider',
      }
    );

  if (error) {
    console.error('[OrgAiKeyService] upsertOrgAiKey error:', error);
    throw new Error(error.message);
  }
}

/**
 * Delete an organization AI key
 * Only admins and super admins can do this (enforced by RLS)
 */
export async function deleteOrgAiKey(orgId: string, provider: AiProvider): Promise<void> {
  if (!supabase || !orgId) {
    throw new Error('Supabase not configured');
  }

  const { error } = await supabase
    .from('org_ai_keys')
    .delete()
    .eq('organization_id', orgId)
    .eq('provider', provider);

  if (error) {
    console.error('[OrgAiKeyService] deleteOrgAiKey error:', error);
    throw new Error(error.message);
  }
}

/**
 * Delete all organization AI keys
 * Only admins and super admins can do this (enforced by RLS)
 */
export async function deleteAllOrgAiKeys(orgId: string): Promise<void> {
  if (!supabase || !orgId) {
    throw new Error('Supabase not configured');
  }

  const { error } = await supabase
    .from('org_ai_keys')
    .delete()
    .eq('organization_id', orgId);

  if (error) {
    console.error('[OrgAiKeyService] deleteAllOrgAiKeys error:', error);
    throw new Error(error.message);
  }
}

/**
 * Get list of providers that have org-level keys
 */
export async function getOrgStoredProviders(orgId: string): Promise<AiProvider[]> {
  if (!supabase || !orgId) {
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('org_ai_keys')
      .select('provider')
      .eq('organization_id', orgId)
      .not('encrypted_key', 'is', null);

    if (error) {
      if (error.code === '42P01') return [];
      throw error;
    }

    return (data || []).map((row: { provider: AiProvider }) => row.provider);
  } catch (err) {
    console.error('[OrgAiKeyService] getOrgStoredProviders error:', err);
    return [];
  }
}
