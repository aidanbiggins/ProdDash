/**
 * Dev Bypass Security Tests
 *
 * These tests verify that dev bypass is ONLY possible when:
 * 1. Running on localhost (127.0.0.1 or localhost)
 * 2. REACT_APP_DEV_BYPASS_AUTH env variable is 'true'
 */

import {
  isLocalhost,
  isDevBypassEnvEnabled,
  isDevBypassAllowed,
  getDevBypassSession,
  setDevBypassSession,
  clearDevBypassSession,
  createDevBypassSession,
  activateDevBypass
} from '../devBypass';

// Mock localStorage with proper state management
class LocalStorageMock {
  private store: Record<string, string> = {};

  getItem(key: string): string | null {
    return this.store[key] ?? null;
  }

  setItem(key: string, value: string): void {
    this.store[key] = value;
  }

  removeItem(key: string): void {
    delete this.store[key];
  }

  clear(): void {
    this.store = {};
  }

  // For test inspection
  getStore(): Record<string, string> {
    return { ...this.store };
  }
}

const localStorageMock = new LocalStorageMock();

Object.defineProperty(window, 'localStorage', { value: localStorageMock, writable: true });

// Mock window.location
const originalLocation = window.location;

function mockLocation(hostname: string) {
  delete (window as any).location;
  window.location = {
    ...originalLocation,
    hostname,
    href: '',
  } as Location;
}

function restoreLocation() {
  window.location = originalLocation;
}

describe('Dev Bypass Security', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Clear the localStorage mock store
    localStorageMock.clear();
    process.env = { ...originalEnv };
    // Reset location to localhost as default
    mockLocation('localhost');
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('isLocalhost', () => {
    it('returns true for localhost', () => {
      mockLocation('localhost');
      expect(isLocalhost()).toBe(true);
    });

    it('returns true for 127.0.0.1', () => {
      mockLocation('127.0.0.1');
      expect(isLocalhost()).toBe(true);
    });

    it('returns false for production domains', () => {
      mockLocation('app.example.com');
      expect(isLocalhost()).toBe(false);
    });

    it('returns false for staging domains', () => {
      mockLocation('staging.example.com');
      expect(isLocalhost()).toBe(false);
    });
  });

  describe('isDevBypassEnvEnabled', () => {
    it('returns true when REACT_APP_DEV_BYPASS_AUTH is "true"', () => {
      process.env.REACT_APP_DEV_BYPASS_AUTH = 'true';
      expect(isDevBypassEnvEnabled()).toBe(true);
    });

    it('returns false when REACT_APP_DEV_BYPASS_AUTH is not set', () => {
      delete process.env.REACT_APP_DEV_BYPASS_AUTH;
      expect(isDevBypassEnvEnabled()).toBe(false);
    });

    it('returns false when REACT_APP_DEV_BYPASS_AUTH is "false"', () => {
      process.env.REACT_APP_DEV_BYPASS_AUTH = 'false';
      expect(isDevBypassEnvEnabled()).toBe(false);
    });

    it('returns false when REACT_APP_DEV_BYPASS_AUTH is empty', () => {
      process.env.REACT_APP_DEV_BYPASS_AUTH = '';
      expect(isDevBypassEnvEnabled()).toBe(false);
    });
  });

  describe('isDevBypassAllowed', () => {
    it('returns true ONLY when both localhost AND env flag are true', () => {
      mockLocation('localhost');
      process.env.REACT_APP_DEV_BYPASS_AUTH = 'true';
      expect(isDevBypassAllowed()).toBe(true);
    });

    it('returns false when on localhost but env flag is not set', () => {
      mockLocation('localhost');
      delete process.env.REACT_APP_DEV_BYPASS_AUTH;
      expect(isDevBypassAllowed()).toBe(false);
    });

    it('returns false when env flag is set but not on localhost', () => {
      mockLocation('app.example.com');
      process.env.REACT_APP_DEV_BYPASS_AUTH = 'true';
      expect(isDevBypassAllowed()).toBe(false);
    });

    it('returns false when neither condition is met', () => {
      mockLocation('app.example.com');
      delete process.env.REACT_APP_DEV_BYPASS_AUTH;
      expect(isDevBypassAllowed()).toBe(false);
    });
  });

  describe('getDevBypassSession', () => {
    it('returns session when bypass is allowed and session exists', () => {
      mockLocation('localhost');
      process.env.REACT_APP_DEV_BYPASS_AUTH = 'true';

      // Verify bypass is allowed
      expect(isDevBypassAllowed()).toBe(true);

      // First set the session using the actual function
      const session = createDevBypassSession();
      const stored = setDevBypassSession(session);
      expect(stored).toBe(true);

      // Verify the data is in localStorage
      const storedValue = localStorage.getItem('dev-auth-bypass');
      expect(storedValue).not.toBeNull();

      // Now retrieve it via our function
      const result = getDevBypassSession();
      expect(result).not.toBeNull();
      expect((result as any).user.id).toBe('dev-admin-001');
    });

    it('returns null when not on localhost (even if session exists)', () => {
      // First set up session while on localhost
      mockLocation('localhost');
      process.env.REACT_APP_DEV_BYPASS_AUTH = 'true';
      localStorage.setItem('dev-auth-bypass', JSON.stringify(createDevBypassSession()));

      // Now switch to production domain
      mockLocation('app.example.com');

      const result = getDevBypassSession();
      expect(result).toBeNull();
    });

    it('returns null when env flag not set (even if on localhost)', () => {
      mockLocation('localhost');
      // Temporarily enable to store, then disable
      process.env.REACT_APP_DEV_BYPASS_AUTH = 'true';
      localStorage.setItem('dev-auth-bypass', JSON.stringify(createDevBypassSession()));

      // Now disable the env flag
      delete process.env.REACT_APP_DEV_BYPASS_AUTH;

      const result = getDevBypassSession();
      expect(result).toBeNull();
    });

    it('clears bypass data when accessed from non-localhost', () => {
      // First set up session while on localhost
      mockLocation('localhost');
      process.env.REACT_APP_DEV_BYPASS_AUTH = 'true';
      localStorage.setItem('dev-auth-bypass', JSON.stringify(createDevBypassSession()));

      // Verify it's stored
      expect(localStorage.getItem('dev-auth-bypass')).not.toBeNull();

      // Now switch to production domain
      mockLocation('app.example.com');

      getDevBypassSession();

      // Should have cleared the invalid bypass data
      expect(localStorage.getItem('dev-auth-bypass')).toBeNull();
    });
  });

  describe('setDevBypassSession', () => {
    it('stores session when bypass is allowed', () => {
      mockLocation('localhost');
      process.env.REACT_APP_DEV_BYPASS_AUTH = 'true';

      const session = createDevBypassSession();
      const result = setDevBypassSession(session);

      expect(result).toBe(true);
      // Verify data was stored
      expect(localStorage.getItem('dev-auth-bypass')).not.toBeNull();
    });

    it('refuses to store session when not on localhost', () => {
      mockLocation('app.example.com');
      process.env.REACT_APP_DEV_BYPASS_AUTH = 'true';

      const session = createDevBypassSession();
      const result = setDevBypassSession(session);

      expect(result).toBe(false);
    });

    it('refuses to store session when env flag not set', () => {
      mockLocation('localhost');
      delete process.env.REACT_APP_DEV_BYPASS_AUTH;

      const session = createDevBypassSession();
      const result = setDevBypassSession(session);

      expect(result).toBe(false);
    });
  });

  describe('activateDevBypass', () => {
    it('activates bypass when allowed and redirects', () => {
      mockLocation('localhost');
      process.env.REACT_APP_DEV_BYPASS_AUTH = 'true';

      const result = activateDevBypass('/dashboard');

      expect(result).toBe(true);
      expect(window.location.href).toBe('/dashboard');
    });

    it('does not activate when not on localhost', () => {
      mockLocation('app.example.com');
      process.env.REACT_APP_DEV_BYPASS_AUTH = 'true';

      const result = activateDevBypass('/dashboard');

      expect(result).toBe(false);
      expect(window.location.href).not.toBe('/dashboard');
    });

    it('does not activate when env flag not set', () => {
      mockLocation('localhost');
      delete process.env.REACT_APP_DEV_BYPASS_AUTH;

      const result = activateDevBypass('/dashboard');

      expect(result).toBe(false);
    });
  });

  describe('Security: Production bypass prevention', () => {
    it('CRITICAL: bypass cannot be activated from production domain', () => {
      // Simulate production environment
      mockLocation('platovue.com');
      process.env.REACT_APP_DEV_BYPASS_AUTH = 'true'; // Even if someone sets this

      // Try all bypass methods
      expect(isDevBypassAllowed()).toBe(false);
      expect(setDevBypassSession(createDevBypassSession())).toBe(false);
      expect(activateDevBypass('/')).toBe(false);
      expect(getDevBypassSession()).toBeNull();
    });

    it('CRITICAL: bypass cannot be activated from staging domain', () => {
      mockLocation('staging.platovue.com');
      process.env.REACT_APP_DEV_BYPASS_AUTH = 'true';

      expect(isDevBypassAllowed()).toBe(false);
      expect(activateDevBypass('/')).toBe(false);
    });

    it('CRITICAL: bypass cannot be activated when env flag is missing', () => {
      mockLocation('localhost');
      delete process.env.REACT_APP_DEV_BYPASS_AUTH;

      expect(isDevBypassAllowed()).toBe(false);
      expect(activateDevBypass('/')).toBe(false);
    });

    it('CRITICAL: lingering bypass data is cleared on non-localhost access', () => {
      // Scenario: User had bypass active on localhost, then accesses from prod
      mockLocation('localhost');
      process.env.REACT_APP_DEV_BYPASS_AUTH = 'true';
      setDevBypassSession(createDevBypassSession());

      // Verify data was stored
      expect(localStorage.getItem('dev-auth-bypass')).not.toBeNull();

      // Now switch to production
      mockLocation('platovue.com');

      // Attempt to get session should fail and clear data
      const result = getDevBypassSession();
      expect(result).toBeNull();
      // Data should have been cleared
      expect(localStorage.getItem('dev-auth-bypass')).toBeNull();
    });
  });
});
