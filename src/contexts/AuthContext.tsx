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
    checkIsSuperAdmin
} from '../productivity-dashboard/services/organizationService';

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

    // Load memberships for a user
    const loadMemberships = useCallback(async (userId: string) => {
        console.log('[Auth] Loading memberships for user:', userId);
        try {
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
    }, []);

    // Refresh memberships (called after joining/leaving orgs)
    const refreshMemberships = useCallback(async () => {
        if (user?.id) {
            await loadMemberships(user.id);
        }
    }, [user?.id, loadMemberships]);

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

        // Check for dev bypass first
        const devBypass = localStorage.getItem('dev-auth-bypass');
        if (devBypass) {
            try {
                const fakeSession = JSON.parse(devBypass);
                setSession(fakeSession as Session);
                setUser(fakeSession.user as User);
                // For dev bypass, set a mock org
                setMemberships([{
                    id: 'dev-membership',
                    organization_id: 'dev-org',
                    user_id: fakeSession.user.id,
                    role: 'admin',
                    created_at: new Date().toISOString(),
                    organization: {
                        id: 'dev-org',
                        name: 'Development',
                        slug: 'dev',
                        created_at: new Date().toISOString(),
                        created_by: null,
                        deleted_at: null
                    }
                }]);
                setCurrentOrgId('dev-org');
                setIsSuperAdmin(true); // Dev user is super admin
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

        const initAuth = async () => {
            if (!supabase) return; // TypeScript guard
            console.log('[Auth] initAuth starting');
            try {
                // Get initial session with retry for AbortError
                let session = null;
                let retries = 3;
                while (retries > 0) {
                    try {
                        const { data } = await supabase.auth.getSession();
                        session = data.session;
                        break;
                    } catch (e: any) {
                        if (e?.name === 'AbortError' && retries > 1) {
                            console.log('[Auth] AbortError, retrying...', retries - 1, 'left');
                            retries--;
                            await new Promise(r => setTimeout(r, 500));
                        } else {
                            throw e;
                        }
                    }
                }
                console.log('[Auth] Got session:', session?.user?.email ?? 'no session');

                if (!isMounted) return;

                setSession(session);
                setUser(session?.user ?? null);

                if (session?.user) {
                    try {
                        await loadMemberships(session.user.id);
                    } catch (err) {
                        console.error('[Auth] Failed to load memberships:', err);
                    }
                }
            } catch (err) {
                console.error('[Auth] Init error:', err);
            } finally {
                console.log('[Auth] initAuth complete, setting loading=false');
                if (isMounted) {
                    setLoading(false);
                }
            }
        };

        initAuth();

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
            if (!isMounted) return;

            setSession(session);
            setUser(session?.user ?? null);

            if (session?.user) {
                try {
                    await loadMemberships(session.user.id);
                } catch (err) {
                    console.error('Failed to load memberships on auth change:', err);
                }
            } else {
                setMemberships([]);
                setCurrentOrgId(null);
                setIsSuperAdmin(false);
            }

            setLoading(false);
        });

        return () => {
            isMounted = false;
            clearTimeout(safetyTimeout);
            subscription.unsubscribe();
        };
    }, [loadMemberships]);

    const signOut = async () => {
        localStorage.removeItem('dev-auth-bypass');
        localStorage.removeItem(CURRENT_ORG_KEY);
        if (supabase) await supabase.auth.signOut();
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
