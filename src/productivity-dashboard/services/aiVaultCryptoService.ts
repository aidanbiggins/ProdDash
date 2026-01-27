/**
 * AI Vault Crypto Service
 *
 * Client service for server-side encryption/decryption of AI API keys.
 * Calls the ai-vault-crypto Edge Function which holds the master encryption key.
 *
 * SECURITY:
 * - Plaintext keys are sent over HTTPS to the Edge Function.
 * - The Edge Function encrypts with a master key stored in Supabase secrets.
 * - Client never has access to the master key.
 * - REQUIRES authenticated user JWT - will fail if user is not signed in.
 */

import { supabase } from '../../lib/supabase';

/**
 * Error thrown when vault operations fail due to missing authentication
 */
export class VaultAuthError extends Error {
  constructor(message: string = 'User must be signed in to use vault operations') {
    super(message);
    this.name = 'VaultAuthError';
  }
}

/**
 * Get the current user's access token for vault operations.
 * Throws VaultAuthError if user is not authenticated.
 */
async function getUserAccessToken(): Promise<string> {
  if (!supabase) {
    throw new VaultAuthError('Supabase not configured');
  }

  const { data: { session }, error } = await supabase.auth.getSession();

  if (error) {
    console.error('[VaultCrypto] Failed to get session:', error.message);
    throw new VaultAuthError('Failed to verify authentication');
  }

  if (!session?.access_token) {
    throw new VaultAuthError('User must be signed in to use vault operations');
  }

  return session.access_token;
}

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
 * SECURITY: Requires authenticated user. Throws VaultAuthError if not signed in.
 *
 * @param plaintext - The API key to encrypt
 * @returns Encrypted blob for storage
 * @throws VaultAuthError if user is not authenticated
 */
export async function encryptApiKey(plaintext: string): Promise<EncryptedBlob | null> {
  if (!supabase) {
    console.error('[VaultCrypto] Supabase not configured');
    return null;
  }

  // Get user's JWT - throws if not authenticated
  const accessToken = await getUserAccessToken();
  const anonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || '';

  try {
    // Add timeout to prevent hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    const response = await fetch(
      `${process.env.REACT_APP_SUPABASE_URL}/functions/v1/ai-vault-crypto`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': anonKey,
          'Authorization': `Bearer ${accessToken}`, // Use user JWT, not anon key
        },
        body: JSON.stringify({
          action: 'encrypt',
          plaintext,
        }),
        signal: controller.signal,
      }
    );

    clearTimeout(timeoutId);

    if (response.status === 401) {
      throw new VaultAuthError('Authentication required for vault operations');
    }

    if (!response.ok) {
      const error = await response.json();
      console.error('[VaultCrypto] Encryption failed:', error.error?.message);
      return null;
    }

    const result = await response.json();
    return result.encrypted_blob;
  } catch (err: any) {
    if (err instanceof VaultAuthError) {
      throw err; // Re-throw auth errors
    }
    if (err.name === 'AbortError') {
      console.error('[VaultCrypto] Encryption timed out');
    } else {
      console.error('[VaultCrypto] Encryption error:', err);
    }
    return null;
  }
}

/**
 * Decrypt an API key using the server-side Edge Function
 *
 * SECURITY: Requires authenticated user. Throws VaultAuthError if not signed in.
 *
 * @param blob - The encrypted blob from storage
 * @returns Decrypted API key, or null on failure
 * @throws VaultAuthError if user is not authenticated
 */
export async function decryptApiKey(blob: EncryptedBlob): Promise<string | null> {
  if (!supabase) {
    console.error('[VaultCrypto] Supabase not configured');
    return null;
  }

  // Get user's JWT - throws if not authenticated
  const accessToken = await getUserAccessToken();
  const anonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || '';

  try {
    const response = await fetch(
      `${process.env.REACT_APP_SUPABASE_URL}/functions/v1/ai-vault-crypto`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': anonKey,
          'Authorization': `Bearer ${accessToken}`, // Use user JWT, not anon key
        },
        body: JSON.stringify({
          action: 'decrypt',
          encrypted_blob: blob,
        }),
      }
    );

    if (response.status === 401) {
      throw new VaultAuthError('Authentication required for vault operations');
    }

    if (!response.ok) {
      const error = await response.json();
      console.error('[VaultCrypto] Decryption failed:', error.error?.message);
      return null;
    }

    const result = await response.json();
    return result.plaintext;
  } catch (err) {
    if (err instanceof VaultAuthError) {
      throw err; // Re-throw auth errors
    }
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
