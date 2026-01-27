/**
 * Vault Crypto Service
 *
 * Zero-knowledge encryption for API keys using WebCrypto.
 * - PBKDF2 for key derivation from passphrase
 * - AES-GCM for symmetric encryption
 * - All crypto happens client-side; server never sees plaintext
 *
 * SECURITY: Never log secrets. Never store passphrase. Decrypted keys live in memory only.
 */

// Default KDF parameters - high iterations for security
const DEFAULT_ITERATIONS = 100000;
const SALT_LENGTH = 16; // 128 bits
const IV_LENGTH = 12; // 96 bits for AES-GCM

/**
 * Encrypted blob structure stored in Supabase
 */
export interface EncryptedBlob {
  ciphertext: string; // base64
  iv: string; // base64
  salt: string; // base64
  kdf: {
    alg: 'pbkdf2';
    iterations: number;
    hash: 'SHA-256';
  };
  alg: {
    name: 'aes-gcm';
  };
}

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
 * Convert base64 string to ArrayBuffer
 */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Generate cryptographically secure random bytes
 */
function getRandomBytes(length: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length));
}

/**
 * Derive an AES-GCM key from a passphrase using PBKDF2
 *
 * @param passphrase - User's passphrase (never stored)
 * @param salt - Random salt for key derivation
 * @param iterations - PBKDF2 iterations (default 100000)
 * @returns CryptoKey for AES-GCM encryption/decryption
 */
export async function deriveKey(
  passphrase: string,
  salt: Uint8Array,
  iterations: number = DEFAULT_ITERATIONS
): Promise<CryptoKey> {
  // Import passphrase as raw key material
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  // Derive AES-GCM key using PBKDF2
  // Cast salt to BufferSource to satisfy TypeScript
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt.buffer as ArrayBuffer,
      iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt an API key with a passphrase
 *
 * @param apiKey - The plaintext API key to encrypt
 * @param passphrase - User's passphrase (never stored)
 * @returns Encrypted blob with all metadata needed for decryption
 */
export async function encryptKey(
  apiKey: string,
  passphrase: string
): Promise<EncryptedBlob> {
  // Generate random salt and IV
  const salt = getRandomBytes(SALT_LENGTH);
  const iv = getRandomBytes(IV_LENGTH);

  // Derive key from passphrase
  const key = await deriveKey(passphrase, salt, DEFAULT_ITERATIONS);

  // Encrypt the API key
  const encoder = new TextEncoder();
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
    key,
    encoder.encode(apiKey)
  );

  return {
    ciphertext: arrayBufferToBase64(ciphertext),
    iv: arrayBufferToBase64(iv.buffer as ArrayBuffer),
    salt: arrayBufferToBase64(salt.buffer as ArrayBuffer),
    kdf: {
      alg: 'pbkdf2',
      iterations: DEFAULT_ITERATIONS,
      hash: 'SHA-256',
    },
    alg: {
      name: 'aes-gcm',
    },
  };
}

/**
 * Decrypt an API key from an encrypted blob
 *
 * @param blob - The encrypted blob from storage
 * @param passphrase - User's passphrase
 * @returns The decrypted API key, or null if decryption fails
 */
export async function decryptKey(
  blob: EncryptedBlob,
  passphrase: string
): Promise<string | null> {
  try {
    // Reconstruct salt and IV from base64
    const salt = new Uint8Array(base64ToArrayBuffer(blob.salt));
    const iv = new Uint8Array(base64ToArrayBuffer(blob.iv));
    const ciphertext = base64ToArrayBuffer(blob.ciphertext);

    // Derive the same key from passphrase
    const key = await deriveKey(passphrase, salt, blob.kdf.iterations);

    // Decrypt
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext
    );

    // Decode to string
    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  } catch {
    // Decryption failed - likely wrong passphrase
    // Don't log any details to avoid leaking info
    return null;
  }
}

/**
 * Encrypt multiple API keys with the same passphrase
 *
 * @param keys - Map of provider to API key
 * @param passphrase - User's passphrase
 * @returns Map of provider to encrypted blob
 */
export async function encryptAllKeys(
  keys: Map<string, string>,
  passphrase: string
): Promise<Map<string, EncryptedBlob>> {
  const result = new Map<string, EncryptedBlob>();

  for (const [provider, apiKey] of keys) {
    if (apiKey) {
      const blob = await encryptKey(apiKey, passphrase);
      result.set(provider, blob);
    }
  }

  return result;
}

/**
 * Decrypt multiple API keys with the same passphrase
 *
 * @param blobs - Map of provider to encrypted blob
 * @param passphrase - User's passphrase
 * @returns Map of provider to decrypted API key (null values excluded)
 */
export async function decryptAllKeys(
  blobs: Map<string, EncryptedBlob>,
  passphrase: string
): Promise<Map<string, string>> {
  const result = new Map<string, string>();

  for (const [provider, blob] of blobs) {
    const decrypted = await decryptKey(blob, passphrase);
    if (decrypted) {
      result.set(provider, decrypted);
    }
  }

  return result;
}

/**
 * Validate that an encrypted blob has the expected structure
 */
export function isValidEncryptedBlob(obj: unknown): obj is EncryptedBlob {
  if (!obj || typeof obj !== 'object') return false;

  const blob = obj as Record<string, unknown>;

  return (
    typeof blob.ciphertext === 'string' &&
    typeof blob.iv === 'string' &&
    typeof blob.salt === 'string' &&
    typeof blob.kdf === 'object' &&
    blob.kdf !== null &&
    (blob.kdf as Record<string, unknown>).alg === 'pbkdf2' &&
    typeof (blob.kdf as Record<string, unknown>).iterations === 'number' &&
    (blob.kdf as Record<string, unknown>).hash === 'SHA-256' &&
    typeof blob.alg === 'object' &&
    blob.alg !== null &&
    (blob.alg as Record<string, unknown>).name === 'aes-gcm'
  );
}
