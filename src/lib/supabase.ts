import { createClient, SupabaseClientOptions } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

// Custom lock that doesn't use browser Lock API (avoids AbortError)
const noOpLock = async <R>(
    name: string,
    acquireTimeout: number,
    fn: () => Promise<R>
): Promise<R> => {
    return fn();
};

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
