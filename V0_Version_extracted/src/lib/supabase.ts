import { createClient, SupabaseClient, SupabaseClientOptions } from '@supabase/supabase-js';

// =============================================================================
// SECURITY TRIPWIRE: Service role key MUST NEVER be used outside localhost
// =============================================================================

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.REACT_APP_SUPABASE_SERVICE_ROLE_KEY;

const isProd = process.env.NODE_ENV === 'production';

// isLocalhost: true when running in browser on localhost or 127.0.0.1
// This is the ONLY place we allow the service role key to exist (even if disabled)
export const isLocalhost =
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1');

const devBypassEnabled = process.env.REACT_APP_DEV_BYPASS_AUTH === 'true';

// =============================================================================
// HARD FAIL: Service role key on non-localhost - NEVER ALLOWED
// This is the ONLY throw condition. Localhost never crashes, even with prod builds.
// =============================================================================
if (supabaseServiceRoleKey && typeof window !== 'undefined' && !isLocalhost) {
    throw new Error(
        '[SECURITY VIOLATION] Service role key must never be used outside localhost. ' +
        'Current hostname: ' + window.location.hostname + '. ' +
        'Remove REACT_APP_SUPABASE_SERVICE_ROLE_KEY from this environment.'
    );
}

/**
 * ALLOW_SERVICE_ROLE is true when:
 * 1. Running on localhost (localhost or 127.0.0.1)
 * 2. Dev bypass flag is explicitly enabled (REACT_APP_DEV_BYPASS_AUTH=true)
 *
 * Note: NODE_ENV is intentionally NOT checked here. This allows production
 * builds served locally (e.g., `serve -s build`) to use service role when
 * dev bypass is enabled. The security boundary is localhost, not NODE_ENV.
 */
export const ALLOW_SERVICE_ROLE = isLocalhost && devBypassEnabled;

/**
 * SERVICE_ROLE_KEY_PRESENT_BUT_DISABLED: True when the key exists on localhost
 * but ALLOW_SERVICE_ROLE is false (either isProd or !devBypassEnabled).
 * Used for UI warning banner. Only true on localhost - never throws.
 */
export const SERVICE_ROLE_KEY_PRESENT_BUT_DISABLED =
    isLocalhost && !!supabaseServiceRoleKey && !ALLOW_SERVICE_ROLE;

// =============================================================================
// NON-BLOCKING WARNING: Key present on localhost but not usable
// =============================================================================
if (SERVICE_ROLE_KEY_PRESENT_BUT_DISABLED) {
    console.warn(
        '[Supabase] Service role key present but ALLOW_SERVICE_ROLE=false. ' +
        'To enable admin features: set REACT_APP_DEV_BYPASS_AUTH=true in .env and REBUILD (npm run build).'
    );
}

// Debug logging for dev mode
if (!isProd) {
    console.log('[Supabase] URL configured:', !!supabaseUrl);
    console.log('[Supabase] Anon key configured:', !!supabaseAnonKey);
    console.log('[Supabase] Service role key configured:', !!supabaseServiceRoleKey);
    console.log('[Supabase] ALLOW_SERVICE_ROLE:', ALLOW_SERVICE_ROLE);
}

// Custom lock that doesn't use browser Lock API (avoids AbortError)
const noOpLock = async <R>(
    name: string,
    acquireTimeout: number,
    fn: () => Promise<R>
): Promise<R> => {
    return fn();
};

// Regular client with anon key (RLS enforced)
// Fail gracefully if config is missing (so app doesn't crash on load)
export const supabase = (supabaseUrl && supabaseAnonKey)
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: true,
            flowType: 'implicit',
            storageKey: 'plato-vue-auth',
            lock: noOpLock,
        }
    } as SupabaseClientOptions<'public'>)
    : null;

// Service role client (bypasses RLS) - ONLY created when ALLOW_SERVICE_ROLE is true
// The tripwire above guarantees this block only runs in safe local dev conditions
const supabaseAdmin = (ALLOW_SERVICE_ROLE && supabaseUrl && supabaseServiceRoleKey)
    ? createClient(supabaseUrl, supabaseServiceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        }
    })
    : null;

/**
 * Check if we're in dev bypass mode (fake local auth)
 */
export function isDevBypassMode(): boolean {
    try {
        return localStorage.getItem('dev-auth-bypass') !== null;
    } catch {
        return false;
    }
}

/**
 * Get the appropriate Supabase client based on auth mode.
 * - In dev bypass mode with ALLOW_SERVICE_ROLE: returns admin client (bypasses RLS)
 * - Otherwise: returns regular client (RLS enforced)
 *
 * SECURITY: supabaseAdmin is only created when ALLOW_SERVICE_ROLE is true,
 * so this function cannot return a service role client in production.
 */
export function getSupabaseClient(): SupabaseClient | null {
    const devBypass = isDevBypassMode();
    // Double-check: even if supabaseAdmin somehow exists, don't use it unless ALLOW_SERVICE_ROLE
    if (ALLOW_SERVICE_ROLE && devBypass && supabaseAdmin) {
        if (!isProd) {
            console.log('[Supabase] Using SERVICE ROLE client (RLS bypassed)');
        }
        return supabaseAdmin;
    }
    if (!isProd) {
        console.log('[Supabase] Using regular anon client (RLS enforced)');
    }
    return supabase;
}
