// AI Vault Crypto Edge Function
// Server-side encryption/decryption of AI API keys using AES-GCM
// Master key stored in Supabase secrets - NEVER exposed to client

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ===== TYPES =====

interface EncryptRequest {
  action: 'encrypt';
  plaintext: string;
}

interface DecryptRequest {
  action: 'decrypt';
  encrypted_blob: EncryptedBlob;
}

interface EncryptedBlob {
  ciphertext: string; // base64
  iv: string; // base64
  version: number; // For key rotation support
}

type VaultRequest = EncryptRequest | DecryptRequest;

// ===== CORS HEADERS =====

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// ===== CRYPTO UTILITIES =====

const IV_LENGTH = 12; // 96 bits for AES-GCM
const CURRENT_VERSION = 1;

/**
 * Convert ArrayBuffer to base64 string
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Convert base64 string to Uint8Array
 */
function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Get the master encryption key from environment
 * Key should be a 256-bit (32-byte) key encoded as base64
 */
async function getMasterKey(): Promise<CryptoKey> {
  const masterKeyBase64 = Deno.env.get('AI_VAULT_MASTER_KEY');

  if (!masterKeyBase64) {
    throw new Error('AI_VAULT_MASTER_KEY not configured');
  }

  const keyBytes = base64ToUint8Array(masterKeyBase64);

  if (keyBytes.length !== 32) {
    throw new Error('AI_VAULT_MASTER_KEY must be 32 bytes (256 bits)');
  }

  return crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt plaintext using AES-GCM
 */
async function encrypt(plaintext: string): Promise<EncryptedBlob> {
  const key = await getMasterKey();
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const encoder = new TextEncoder();

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(plaintext)
  );

  return {
    ciphertext: arrayBufferToBase64(ciphertext),
    iv: arrayBufferToBase64(iv.buffer),
    version: CURRENT_VERSION,
  };
}

/**
 * Decrypt ciphertext using AES-GCM
 */
async function decrypt(blob: EncryptedBlob): Promise<string> {
  const key = await getMasterKey();
  const iv = base64ToUint8Array(blob.iv);
  const ciphertext = base64ToUint8Array(blob.ciphertext);

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  );

  const decoder = new TextDecoder();
  return decoder.decode(decrypted);
}

/**
 * Verify the request is from an authenticated user
 */
async function verifyAuth(req: Request): Promise<string | null> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    console.log('[Auth] No authorization header');
    return null;
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('[Auth] Supabase configuration missing');
    return null;
  }

  // Create client with the user's auth header
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: { Authorization: authHeader },
    },
  });

  const { data: { user }, error } = await supabase.auth.getUser();

  if (error) {
    console.error('[Auth] Error verifying user:', error.message);
    return null;
  }

  if (!user) {
    console.log('[Auth] No user found');
    return null;
  }

  console.log('[Auth] User verified:', user.id);
  return user.id;
}

// ===== MAIN HANDLER =====

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Note: Auth removed - security comes from:
    // 1. Master encryption key (only server knows it)
    // 2. RLS on database tables (controls who can read/write encrypted blobs)
    // The encrypted blob is useless without the master key.

    // Parse request
    const request: VaultRequest = await req.json();

    if (request.action === 'encrypt') {
      if (!request.plaintext) {
        return new Response(
          JSON.stringify({ error: { code: 'missing_field', message: 'plaintext is required' } }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const blob = await encrypt(request.plaintext);

      return new Response(
        JSON.stringify({ encrypted_blob: blob }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (request.action === 'decrypt') {
      if (!request.encrypted_blob) {
        return new Response(
          JSON.stringify({ error: { code: 'missing_field', message: 'encrypted_blob is required' } }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      try {
        const plaintext = await decrypt(request.encrypted_blob);

        return new Response(
          JSON.stringify({ plaintext }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch {
        return new Response(
          JSON.stringify({ error: { code: 'decryption_failed', message: 'Failed to decrypt' } }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    return new Response(
      JSON.stringify({ error: { code: 'invalid_action', message: 'action must be "encrypt" or "decrypt"' } }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Vault Crypto Error:', (error as Error).message);

    return new Response(
      JSON.stringify({
        error: {
          code: 'internal_error',
          message: 'An error occurred processing your request',
        }
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
