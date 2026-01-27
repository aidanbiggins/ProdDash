import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import {
    Organization,
    OrganizationMembership,
    AuthUser,
    UserRole,
    OrgAuthContextType
} from '../productivity-dashboard/types/auth';
import {
    getUserMemberships,
    checkIsSuperAdmin,
    addSuperAdmin
} from '../productivity-dashboard/services/organizationService';
import {
    isDevBypassAllowed,
    getDevBypassSession,
    clearDevBypassSession
} from '../lib/devBypass';

// Super admin email - always seeded as super admin on sign-in
const SUPER_ADMIN_EMAIL = 'aidanbiggins@gmail.com';

const CURRENT_ORG_KEY = 'current_org_id';

// Combined context type
interface AuthContextType {
    // Legacy - raw Supabase user
    supabaseUser: User | null;
    session: Session | null;
    loading: boolean;
    signOut: () => Promise<void>;
    // Org-aware - enriched user with memberships
    user: AuthUser | null;
    currentOrg: Organization | null;
    userRole: UserRole | null;
    switchOrganization: (orgId: string) => void;
    refreshMemberships: () => Promise<void>;
    canImportData: boolean;
    canManageMembers: boolean;
    canDeleteOrg: boolean;
}

const AuthContext = createContext<AuthContextType>({
    supabaseUser: null,
    session: null,
    loading: true,
    signOut: async () => { },
    user: null,
    currentOrg: null,
    userRole: null,
    switchOrganization: () => { },
    refreshMemberships: async () => { },
    canImportData: false,
    canManageMembers: false,
    canDeleteOrg: false,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    // Legacy state
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);

    // Org-aware state
    const [memberships, setMemberships] = useState<OrganizationMembership[]>([]);
    const [currentOrgId, setCurrentOrgId] = useState<string | null>(null);
    const [isSuperAdmin, setIsSuperAdmin] = useState(false);

    // Derived state
    const currentOrg: Organization | null = currentOrgId
        ? memberships.find(m => m.organization_id === currentOrgId)?.organization ?? null
        : null;

    const userRole: UserRole | null = isSuperAdmin
        ? 'super_admin'
        : currentOrgId
            ? memberships.find(m => m.organization_id === currentOrgId)?.role ?? null
            : null;

    const canImportData = userRole === 'super_admin' || userRole === 'admin';
    const canManageMembers = userRole === 'super_admin' || userRole === 'admin';
    const canDeleteOrg = userRole === 'super_admin' || userRole === 'admin';

    // AuthUser object for new API
    const authUser: AuthUser | null = user ? {
        id: user.id,
        email: user.email ?? '',
        memberships,
        currentOrgId,
        isSuperAdmin
    } : null;

    // Ensure super admin status for designated email
    const ensureSuperAdmin = useCallback(async (userId: string, email: string) => {
        if (email.toLowerCase() !== SUPER_ADMIN_EMAIL) return;

        console.log('[Auth] Checking super admin status for:', email);
        try {
            const isAlreadySuperAdmin = await checkIsSuperAdmin(userId);
            if (!isAlreadySuperAdmin) {
                console.log('[Auth] Auto-seeding super admin for:', email);
                await addSuperAdmin(userId);
            }
        } catch (err) {
            console.error('[Auth] Failed to ensure super admin status:', err);
            // Don't throw - this is a best-effort operation
        }
    }, []);

    // Load memberships for a user
    const loadMemberships = useCallback(async (userId: string, email?: string) => {
        console.log('[Auth] Loading memberships for user:', userId);
        try {
            // Auto-seed super admin if this is the designated email
            if (email) {
                await ensureSuperAdmin(userId, email);
            }

            const [userMemberships, superAdminStatus] = await Promise.all([
                getUserMemberships(userId),
                checkIsSuperAdmin(userId)
            ]);

            console.log('[Auth] Memberships loaded:', userMemberships.length, 'isSuperAdmin:', superAdminStatus);
            setMemberships(userMemberships);
            setIsSuperAdmin(superAdminStatus);

            // Set current org from localStorage or default to first
            const savedOrgId = localStorage.getItem(CURRENT_ORG_KEY);
            if (savedOrgId && userMemberships.some(m => m.organization_id === savedOrgId)) {
                setCurrentOrgId(savedOrgId);
            } else if (userMemberships.length > 0) {
                setCurrentOrgId(userMemberships[0].organization_id);
            }
        } catch (err) {
            console.error('Failed to load memberships:', err);
            setMemberships([]);
            setIsSuperAdmin(false);
        }
    }, [ensureSuperAdmin]);

    // Refresh memberships (called after joining/leaving orgs)
    const refreshMemberships = useCallback(async () => {
        if (user?.id && user?.email) {
            await loadMemberships(user.id, user.email);
        }
    }, [user?.id, user?.email, loadMemberships]);

    // Switch current organization
    const switchOrganization = useCallback((orgId: string) => {
        if (memberships.some(m => m.organization_id === orgId) || isSuperAdmin) {
            setCurrentOrgId(orgId);
            localStorage.setItem(CURRENT_ORG_KEY, orgId);
        }
    }, [memberships, isSuperAdmin]);

    useEffect(() => {
        let isMounted = true;

        // Safety timeout - ensure loading never hangs indefinitely
        const safetyTimeout = setTimeout(() => {
            if (isMounted && loading) {
                console.warn('Auth loading timeout - forcing complete');
                setLoading(false);
            }
        }, 10000); // 10 second timeout

        // Check for dev bypass - ONLY allowed on localhost with env flag
        // Security: getDevBypassSession() returns null if not on localhost or env flag not set
        const devBypassSession = getDevBypassSession();
        if (devBypassSession && isDevBypassAllowed()) {
            try {
                const fakeSession = devBypassSession as { user: { id: string } };
                setSession(fakeSession as unknown as Session);
                setUser(fakeSession.user as unknown as User);
                // For dev bypass, set a mock org (use valid UUID format for Supabase compatibility)
                const devOrgId = '00000000-0000-0000-0000-000000000001';
                setMemberships([{
                    id: '00000000-0000-0000-0000-000000000002',
                    organization_id: devOrgId,
                    user_id: fakeSession.user.id,
                    role: 'admin',
                    created_at: new Date().toISOString(),
                    organization: {
                        id: devOrgId,
                        name: 'Development (localhost)',
                        slug: 'dev',
                        created_at: new Date().toISOString(),
                        created_by: null,
                        deleted_at: null
                    }
                }]);
                setCurrentOrgId(devOrgId);
                setIsSuperAdmin(true); // Dev user is super admin
                setLoading(false);
                console.log('[Auth] Dev bypass activated (localhost only)');
                return;
            } catch (e) {
                // Invalid session, clear it
                clearDevBypassSession();
            }
        } else if (!isDevBypassAllowed()) {
            // Security: Clear any lingering bypass data if we're not on localhost
            clearDevBypassSession();
        }

        if (!supabase) {
            console.warn('Supabase not configured. Auth disabled.');
            setLoading(false);
            return;
        }

        // Use onAuthStateChange as the primary auth mechanism
        console.log('[Auth] Setting up auth listener');

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            console.log('[Auth] Auth state changed:', event, session?.user?.email ?? 'no session');
            if (!isMounted) return;

            setSession(session);
            setUser(session?.user ?? null);

            if (session?.user) {
                try {
                    await loadMemberships(session.user.id, session.user.email ?? undefined);
                } catch (err) {
                    console.error('[Auth] Failed to load memberships:', err);
                }
            } else {
                setMemberships([]);
                setCurrentOrgId(null);
                setIsSuperAdmin(false);
            }

            setLoading(false);
        });

        // Explicitly get session from localStorage to ensure the client is initialized
        // This is critical for RLS - without this, auth.uid() returns NULL
        const initSession = async () => {
            if (!supabase) return; // Already checked above, but TypeScript needs this

            try {
                console.log('[Auth] Getting initial session from storage');
                const { data: { session: initialSession }, error } = await supabase.auth.getSession();

                if (error) {
                    console.error('[Auth] getSession error:', error);
                    if (isMounted) setLoading(false);
                    return;
                }

                if (initialSession && isMounted) {
                    console.log('[Auth] Initial session found:', initialSession.user?.email);
                    setSession(initialSession);
                    setUser(initialSession.user ?? null);

                    if (initialSession.user) {
                        try {
                            await loadMemberships(initialSession.user.id, initialSession.user.email ?? undefined);
                        } catch (err) {
                            console.error('[Auth] Failed to load memberships:', err);
                        }
                    }
                    setLoading(false);
                }
            } catch (err) {
                console.error('[Auth] initSession error:', err);
                if (isMounted) setLoading(false);
            }
        };

        initSession();

        // Fallback: if no auth event fires within 5 seconds, force loading complete
        const fallbackTimeout = setTimeout(() => {
            if (isMounted && loading) {
                console.log('[Auth] No auth event received, completing loading');
                setLoading(false);
            }
        }, 5000);

        return () => {
            isMounted = false;
            clearTimeout(safetyTimeout);
            clearTimeout(fallbackTimeout);
            subscription.unsubscribe();
        };
    }, [loadMemberships]);

    const signOut = async () => {
        console.log('[Auth] Signing out...');

        // Clear dev bypass session
        clearDevBypassSession();
        // Clear other local storage
        localStorage.removeItem(CURRENT_ORG_KEY);
        // Also clear Supabase session storage directly as backup
        localStorage.removeItem('plato-vue-auth');

        // Clear local state immediately to prevent UI flicker
        setUser(null);
        setSession(null);
        setMemberships([]);
        setCurrentOrgId(null);
        setIsSuperAdmin(false);

        // Set up a fallback redirect in case supabase.auth.signOut() hangs
        const redirectTimeout = setTimeout(() => {
            console.log('[Auth] Redirect timeout triggered');
            window.location.href = '/login';
        }, 2000);

        try {
            if (supabase) {
                await supabase.auth.signOut();
            }
        } catch (err) {
            console.error('[Auth] Sign out error:', err);
            // Continue with redirect even if supabase signOut fails
        }

        clearTimeout(redirectTimeout);
        console.log('[Auth] Redirecting to /login');
        // Always redirect to login
        window.location.href = '/login';
    };

    return (
        <AuthContext.Provider value={{
            supabaseUser: user,
            session,
            loading,
            signOut,
            user: authUser,
            currentOrg,
            userRole,
            switchOrganization,
            refreshMemberships,
            canImportData,
            canManageMembers,
            canDeleteOrg,
        }}>
            {children}
        </AuthContext.Provider>
    );
};
