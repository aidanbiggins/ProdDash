import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface AuthContextType {
    user: User | null;
    session: Session | null;
    loading: boolean;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    session: null,
    loading: true,
    signOut: async () => { },
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // 🔐 Check for dev bypass first
        const devBypass = localStorage.getItem('dev-auth-bypass');
        if (devBypass) {
            try {
                const fakeSession = JSON.parse(devBypass);
                setSession(fakeSession as Session);
                setUser(fakeSession.user as User);
                setLoading(false);
                return;
            } catch (e) {
                localStorage.removeItem('dev-auth-bypass');
            }
        }

        if (!supabase) {
            console.warn('Supabase not configured. Auth disabled.');
            setLoading(false);
            return;
        }

        // 1. Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setUser(session?.user ?? null);
            setLoading(false);
        });

        // 2. Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            setUser(session?.user ?? null);
            setLoading(false);
        });

        return () => subscription.unsubscribe();
    }, []);

    const signOut = async () => {
        // Clear dev bypass if present
        localStorage.removeItem('dev-auth-bypass');
        if (supabase) await supabase.auth.signOut();
        // Force reload to clear state
        window.location.href = '/login';
    };

    return (
        <AuthContext.Provider value={{ user, session, loading, signOut }}>
            {children}
        </AuthContext.Provider>
    );
};
