/**
 * AI Vault Crypto Service
 *
 * Client service for server-side encryption/decryption of AI API keys.
 * Calls the ai-vault-crypto Edge Function which holds the master encryption key.
 *
 * SECURITY: Plaintext keys are sent over HTTPS to the Edge Function.
 * The Edge Function encrypts with a master key stored in Supabase secrets.
 * Client never has access to the master key.
 */

import { supabase } from '../../lib/supabase';

export interface EncryptedBlob {
  ciphertext: string;
  iv: string;
  version: number;
}

export function isValidEncryptedBlob(obj: unknown): obj is EncryptedBlob {
  if (!obj || typeof obj !== 'object') return false;
  const blob = obj as Record<string, unknown>;
  return (
    typeof blob.ciphertext === 'string' &&
    typeof blob.iv === 'string' &&
    typeof blob.version === 'number'
  );
}

/**
 * Encrypt an API key using the server-side Edge Function
 *
 * @param plaintext - The API key to encrypt
 * @returns Encrypted blob for storage, or null on failure
 */
export async function encryptApiKey(plaintext: string): Promise<EncryptedBlob | null> {
  if (!supabase) {
    console.error('[VaultCrypto] Supabase not configured');
    return null;
  }

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      console.error('[VaultCrypto] No authenticated session');
      return null;
    }

    console.log('[VaultCrypto] Encrypting API key...');
    const url = `${process.env.REACT_APP_SUPABASE_URL}/functions/v1/ai-vault-crypto`;
    console.log('[VaultCrypto] URL:', url);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': process.env.REACT_APP_SUPABASE_ANON_KEY || '',
      },
      body: JSON.stringify({
        action: 'encrypt',
        plaintext,
      }),
    });

    const result = await response.json();
    console.log('[VaultCrypto] Encrypt response status:', response.status);

    if (!response.ok) {
      console.error('[VaultCrypto] Encryption failed:', result.error?.message || result);
      return null;
    }

    console.log('[VaultCrypto] Encryption successful, got blob');
    return result.encrypted_blob;
  } catch (err) {
    console.error('[VaultCrypto] Encryption error:', err);
    return null;
  }
}

/**
 * Decrypt an API key using the server-side Edge Function
 *
 * @param blob - The encrypted blob from storage
 * @returns Decrypted API key, or null on failure
 */
export async function decryptApiKey(blob: EncryptedBlob): Promise<string | null> {
  if (!supabase) {
    console.error('[VaultCrypto] Supabase not configured');
    return null;
  }

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      console.error('[VaultCrypto] No authenticated session');
      return null;
    }

    console.log('[VaultCrypto] Decrypting API key...');
    const response = await fetch(
      `${process.env.REACT_APP_SUPABASE_URL}/functions/v1/ai-vault-crypto`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': process.env.REACT_APP_SUPABASE_ANON_KEY || '',
        },
        body: JSON.stringify({
          action: 'decrypt',
          encrypted_blob: blob,
        }),
      }
    );

    const result = await response.json();
    console.log('[VaultCrypto] Decrypt response status:', response.status);

    if (!response.ok) {
      console.error('[VaultCrypto] Decryption failed:', result.error?.message || result);
      return null;
    }

    console.log('[VaultCrypto] Decryption successful');
    return result.plaintext;
  } catch (err) {
    console.error('[VaultCrypto] Decryption error:', err);
    return null;
  }
}

/**
 * Encrypt multiple API keys
 */
export async function encryptMultipleKeys(
  keys: Map<string, string>
): Promise<Map<string, EncryptedBlob>> {
  const result = new Map<string, EncryptedBlob>();

  for (const [provider, apiKey] of keys) {
    if (apiKey) {
      const blob = await encryptApiKey(apiKey);
      if (blob) {
        result.set(provider, blob);
      }
    }
  }

  return result;
}

/**
 * Decrypt multiple API keys
 */
export async function decryptMultipleKeys(
  blobs: Map<string, EncryptedBlob>
): Promise<Map<string, string>> {
  const result = new Map<string, string>();

  for (const [provider, blob] of blobs) {
    const plaintext = await decryptApiKey(blob);
    if (plaintext) {
      result.set(provider, plaintext);
    }
  }

  return result;
}
