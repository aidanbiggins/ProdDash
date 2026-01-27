/**
 * AI Vault Crypto Service Tests
 *
 * Tests for the Edge Function client that requires authenticated users.
 * Verifies that unauthenticated requests are properly rejected.
 */

import {
  encryptApiKey,
  decryptApiKey,
  VaultAuthError,
  isValidEncryptedBlob,
  EncryptedBlob,
} from '../aiVaultCryptoService';

// Mock supabase
const mockGetSession = jest.fn();
jest.mock('../../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: () => mockGetSession(),
    },
  },
}));

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('aiVaultCryptoService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.REACT_APP_SUPABASE_URL = 'https://test.supabase.co';
    process.env.REACT_APP_SUPABASE_ANON_KEY = 'test-anon-key';
  });

  afterEach(() => {
    delete process.env.REACT_APP_SUPABASE_URL;
    delete process.env.REACT_APP_SUPABASE_ANON_KEY;
  });

  describe('isValidEncryptedBlob', () => {
    it('returns true for valid blob', () => {
      const blob: EncryptedBlob = {
        ciphertext: 'abc123',
        iv: 'xyz789',
        version: 1,
      };
      expect(isValidEncryptedBlob(blob)).toBe(true);
    });

    it('returns false for null', () => {
      expect(isValidEncryptedBlob(null)).toBe(false);
    });

    it('returns false for missing fields', () => {
      expect(isValidEncryptedBlob({ ciphertext: 'abc' })).toBe(false);
      expect(isValidEncryptedBlob({ iv: 'xyz' })).toBe(false);
      expect(isValidEncryptedBlob({ version: 1 })).toBe(false);
    });
  });

  describe('VaultAuthError', () => {
    it('has correct name and message', () => {
      const error = new VaultAuthError('Custom message');
      expect(error.name).toBe('VaultAuthError');
      expect(error.message).toBe('Custom message');
    });

    it('has default message', () => {
      const error = new VaultAuthError();
      expect(error.message).toBe('User must be signed in to use vault operations');
    });
  });

  describe('encryptApiKey - Authentication Requirements', () => {
    it('CRITICAL: throws VaultAuthError when user is not signed in', async () => {
      // Simulate no session (user not signed in)
      mockGetSession.mockResolvedValue({
        data: { session: null },
        error: null,
      });

      await expect(encryptApiKey('sk-test-key')).rejects.toThrow(VaultAuthError);
      await expect(encryptApiKey('sk-test-key')).rejects.toThrow(
        'User must be signed in to use vault operations'
      );

      // Verify no network request was made
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('CRITICAL: throws VaultAuthError when session has no access_token', async () => {
      mockGetSession.mockResolvedValue({
        data: { session: { user: { id: 'test' } } }, // Session but no access_token
        error: null,
      });

      await expect(encryptApiKey('sk-test-key')).rejects.toThrow(VaultAuthError);

      // Verify no network request was made
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('CRITICAL: throws VaultAuthError when getSession returns error', async () => {
      mockGetSession.mockResolvedValue({
        data: { session: null },
        error: new Error('Session expired'),
      });

      await expect(encryptApiKey('sk-test-key')).rejects.toThrow(VaultAuthError);
      await expect(encryptApiKey('sk-test-key')).rejects.toThrow(
        'Failed to verify authentication'
      );
    });

    it('sends user JWT (not anon key) when authenticated', async () => {
      const userJwt = 'user-jwt-token-123';

      mockGetSession.mockResolvedValue({
        data: {
          session: {
            access_token: userJwt,
            user: { id: 'user-123' },
          },
        },
        error: null,
      });

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          encrypted_blob: { ciphertext: 'abc', iv: 'xyz', version: 1 },
        }),
      });

      await encryptApiKey('sk-test-key');

      // Verify the Authorization header uses user JWT, not anon key
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': `Bearer ${userJwt}`,
          }),
        })
      );
    });

    it('CRITICAL: throws VaultAuthError when server returns 401', async () => {
      mockGetSession.mockResolvedValue({
        data: {
          session: {
            access_token: 'invalid-token',
            user: { id: 'user-123' },
          },
        },
        error: null,
      });

      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        json: () => Promise.resolve({
          error: { code: 'unauthorized', message: 'Valid user JWT required' },
        }),
      });

      await expect(encryptApiKey('sk-test-key')).rejects.toThrow(VaultAuthError);
      await expect(encryptApiKey('sk-test-key')).rejects.toThrow(
        'Authentication required for vault operations'
      );
    });
  });

  describe('decryptApiKey - Authentication Requirements', () => {
    const validBlob: EncryptedBlob = {
      ciphertext: 'abc123',
      iv: 'xyz789',
      version: 1,
    };

    it('CRITICAL: throws VaultAuthError when user is not signed in', async () => {
      mockGetSession.mockResolvedValue({
        data: { session: null },
        error: null,
      });

      await expect(decryptApiKey(validBlob)).rejects.toThrow(VaultAuthError);
      await expect(decryptApiKey(validBlob)).rejects.toThrow(
        'User must be signed in to use vault operations'
      );

      // Verify no network request was made
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('CRITICAL: throws VaultAuthError when session has no access_token', async () => {
      mockGetSession.mockResolvedValue({
        data: { session: { user: { id: 'test' } } },
        error: null,
      });

      await expect(decryptApiKey(validBlob)).rejects.toThrow(VaultAuthError);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('sends user JWT (not anon key) when authenticated', async () => {
      const userJwt = 'user-jwt-token-456';

      mockGetSession.mockResolvedValue({
        data: {
          session: {
            access_token: userJwt,
            user: { id: 'user-123' },
          },
        },
        error: null,
      });

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ plaintext: 'sk-decrypted-key' }),
      });

      await decryptApiKey(validBlob);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': `Bearer ${userJwt}`,
          }),
        })
      );
    });

    it('CRITICAL: throws VaultAuthError when server returns 401', async () => {
      mockGetSession.mockResolvedValue({
        data: {
          session: {
            access_token: 'invalid-token',
            user: { id: 'user-123' },
          },
        },
        error: null,
      });

      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        json: () => Promise.resolve({
          error: { code: 'unauthorized', message: 'Valid user JWT required' },
        }),
      });

      await expect(decryptApiKey(validBlob)).rejects.toThrow(VaultAuthError);
    });
  });

  describe('Security: No plaintext returned to unauthenticated callers', () => {
    const validBlob: EncryptedBlob = {
      ciphertext: 'abc123',
      iv: 'xyz789',
      version: 1,
    };

    it('CRITICAL: decrypt never returns plaintext when not authenticated', async () => {
      mockGetSession.mockResolvedValue({
        data: { session: null },
        error: null,
      });

      // Even if somehow the fetch happened and returned data,
      // the client should reject before making the request
      let result: string | null = null;
      let errorThrown = false;

      try {
        result = await decryptApiKey(validBlob);
      } catch (e) {
        errorThrown = true;
        expect(e).toBeInstanceOf(VaultAuthError);
      }

      expect(errorThrown).toBe(true);
      expect(result).toBeNull();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('documents security properties', () => {
      // Security guarantees of the authenticated vault:
      //
      // 1. User JWT Required
      //    - Every encrypt/decrypt request requires valid Supabase JWT
      //    - JWT is verified server-side by Edge Function
      //    - Anon key alone is not sufficient
      //
      // 2. Client-Side Validation
      //    - Client checks for session before making request
      //    - Prevents unnecessary network calls for unauthenticated users
      //    - Throws VaultAuthError with clear message
      //
      // 3. Server-Side Enforcement
      //    - Edge Function verifies JWT via supabase.auth.getUser()
      //    - Returns 401 for missing/invalid JWT
      //    - Plaintext is NEVER returned to unauthenticated callers
      //
      // 4. Defense in Depth
      //    - Master encryption key is server-side only
      //    - RLS policies control who can read/write encrypted blobs
      //    - JWT verification adds authentication layer
      //    - All three layers must pass for successful decrypt

      expect(true).toBe(true);
    });
  });
});
