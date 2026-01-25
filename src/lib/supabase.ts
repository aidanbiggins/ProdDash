import { createClient, SupabaseClient, SupabaseClientOptions } from '@supabase/supabase-js';

// =============================================================================
// SECURITY TRIPWIRE: Service role key MUST NEVER be used in production
// =============================================================================

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.REACT_APP_SUPABASE_SERVICE_ROLE_KEY;

const isProd = process.env.NODE_ENV === 'production';
const isLocalhost =
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1');
const devBypassEnabled = process.env.REACT_APP_DEV_BYPASS_AUTH === 'true';

// HARD FAIL: If service role key exists in production, crash immediately
if (isProd && supabaseServiceRoleKey) {
    throw new Error(
        '[SECURITY VIOLATION] REACT_APP_SUPABASE_SERVICE_ROLE_KEY is present in a production build. ' +
        'This key bypasses Row Level Security and MUST NEVER be shipped to production. ' +
        'Remove it from your production environment immediately.'
    );
}

/**
 * ALLOW_SERVICE_ROLE is only true when ALL conditions are met:
 * 1. NOT a production build
 * 2. Running on localhost (localhost or 127.0.0.1)
 * 3. Dev bypass flag is explicitly enabled (REACT_APP_DEV_BYPASS_AUTH=true)
 */
export const ALLOW_SERVICE_ROLE = !isProd && isLocalhost && devBypassEnabled;

// HARD FAIL: If service role key exists but conditions aren't met, crash immediately
if (supabaseServiceRoleKey && !ALLOW_SERVICE_ROLE) {
    throw new Error(
        '[SECURITY VIOLATION] REACT_APP_SUPABASE_SERVICE_ROLE_KEY is present but ALLOW_SERVICE_ROLE is false. ' +
        'Service role key can only be used in local development with dev bypass enabled. ' +
        'Either remove the key or set REACT_APP_DEV_BYPASS_AUTH=true for local dev.'
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
