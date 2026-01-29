/**
 * Dev Auth Bypass Utility
 *
 * Security: Dev bypass is ONLY allowed when BOTH conditions are met:
 * 1. Running on localhost (127.0.0.1 or localhost)
 * 2. REACT_APP_DEV_BYPASS_AUTH env variable is 'true'
 *
 * This prevents accidental or malicious bypass in production environments.
 */

const DEV_BYPASS_STORAGE_KEY = 'dev-auth-bypass';

/**
 * Check if the current hostname is localhost
 */
export function isLocalhost(): boolean {
  if (typeof window === 'undefined') return false;
  const hostname = window.location.hostname;
  return hostname === 'localhost' || hostname === '127.0.0.1';
}

/**
 * Check if the dev bypass env flag is enabled
 */
export function isDevBypassEnvEnabled(): boolean {
  return process.env.REACT_APP_DEV_BYPASS_AUTH === 'true';
}

/**
 * Check if dev bypass is allowed (BOTH conditions must be true)
 */
export function isDevBypassAllowed(): boolean {
  return isLocalhost() && isDevBypassEnvEnabled();
}

/**
 * Get the stored dev bypass session, but ONLY if bypass is allowed
 * Returns null if bypass is not allowed or no session exists
 */
export function getDevBypassSession(): object | null {
  if (!isDevBypassAllowed()) {
    // Security: Clear any existing bypass data if we're not on localhost
    // This prevents bypass tokens from persisting to production
    if (typeof window !== 'undefined' && !isLocalhost()) {
      clearDevBypassSession();
    }
    return null;
  }

  try {
    const stored = localStorage.getItem(DEV_BYPASS_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // Invalid JSON, clear it
    clearDevBypassSession();
  }
  return null;
}

/**
 * Set the dev bypass session, but ONLY if bypass is allowed
 * Returns true if successful, false if not allowed
 */
export function setDevBypassSession(session: object): boolean {
  if (!isDevBypassAllowed()) {
    console.warn('[DevBypass] Attempted to set bypass session but bypass is not allowed');
    return false;
  }

  try {
    localStorage.setItem(DEV_BYPASS_STORAGE_KEY, JSON.stringify(session));
    return true;
  } catch {
    return false;
  }
}

/**
 * Clear the dev bypass session
 */
export function clearDevBypassSession(): void {
  try {
    localStorage.removeItem(DEV_BYPASS_STORAGE_KEY);
  } catch {
    // Ignore errors
  }
}

/**
 * Create a mock dev bypass session
 */
export function createDevBypassSession(): object {
  return {
    access_token: 'dev-bypass-token',
    token_type: 'bearer',
    expires_in: 86400,
    expires_at: Math.floor(Date.now() / 1000) + 86400,
    user: {
      id: 'dev-admin-001',
      email: 'dev@localhost',
      role: 'admin',
      user_metadata: { name: 'Dev Admin' }
    }
  };
}

/**
 * Sanitize redirect URL to prevent open redirect attacks
 * Only allows relative paths starting with /
 */
function sanitizeRedirectUrl(url: string): string {
  if (!url) return '/';
  // Block absolute URLs, protocol-relative URLs, and special protocols
  if (
    url.startsWith('//') ||
    url.startsWith('http:') ||
    url.startsWith('https:') ||
    url.includes('://') ||
    url.startsWith('javascript:') ||
    url.startsWith('data:')
  ) {
    console.warn('[DevBypass] Blocked potentially malicious redirect URL:', url);
    return '/';
  }
  // Ensure it starts with /
  if (!url.startsWith('/')) {
    return '/' + url;
  }
  return url;
}

/**
 * Activate dev bypass - creates and stores session, then redirects
 * Returns true if successful, false if not allowed
 */
export function activateDevBypass(redirectUrl: string = '/'): boolean {
  if (!isDevBypassAllowed()) {
    console.warn('[DevBypass] Cannot activate - bypass not allowed');
    return false;
  }

  const session = createDevBypassSession();
  if (setDevBypassSession(session)) {
    const safeUrl = sanitizeRedirectUrl(redirectUrl);
    console.log('[DevBypass] Activated, redirecting to:', safeUrl);
    window.location.href = safeUrl;
    return true;
  }
  return false;
}
