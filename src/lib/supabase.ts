import { createClient, SupabaseClient, SupabaseClientOptions } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.REACT_APP_SUPABASE_SERVICE_ROLE_KEY;

// Debug logging for dev mode
console.log('[Supabase] URL configured:', !!supabaseUrl);
console.log('[Supabase] Anon key configured:', !!supabaseAnonKey);
console.log('[Supabase] Service role key configured:', !!supabaseServiceRoleKey);

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

// Service role client (bypasses RLS) - ONLY for local development with dev-auth-bypass
// WARNING: Service role key should NEVER be used in production frontend builds
const supabaseAdmin = (supabaseUrl && supabaseServiceRoleKey)
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
 * - In dev bypass mode with service role key: returns admin client (bypasses RLS)
 * - Otherwise: returns regular client (RLS enforced)
 *
 * This allows local development to work without real Supabase auth,
 * while production always uses RLS-protected operations.
 */
export function getSupabaseClient(): SupabaseClient | null {
    const devBypass = isDevBypassMode();
    const hasAdmin = !!supabaseAdmin;
    console.log('[Supabase] getSupabaseClient - devBypass:', devBypass, 'hasAdmin:', hasAdmin);
    if (devBypass && supabaseAdmin) {
        console.log('[Supabase] Using SERVICE ROLE client (RLS bypassed)');
        return supabaseAdmin;
    }
    console.log('[Supabase] Using regular anon client (RLS enforced)');
    return supabase;
}
