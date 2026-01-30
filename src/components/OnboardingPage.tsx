import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  getInvitesForEmail,
  acceptInvite,
  createOrganization
} from '../productivity-dashboard/services/organizationService';
import { OrganizationInvite } from '../productivity-dashboard/types/auth';

// Sanitize returnUrl to prevent open redirect attacks
// Only allows relative paths starting with /
function sanitizeReturnUrl(url: string | null): string {
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
    console.warn('[sanitizeReturnUrl] Blocked potentially malicious returnUrl:', url);
    return '/';
  }
  // Ensure it starts with /
  if (!url.startsWith('/')) {
    return '/' + url;
  }
  return url;
}

const OnboardingPage: React.FC = () => {
  // Get memberships directly from AuthContext - it already loaded them
  const { user, supabaseUser, refreshMemberships, switchOrganization, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnUrl = sanitizeReturnUrl(searchParams.get('returnUrl'));

  const [loadingInvites, setLoadingInvites] = useState(true);
  const [invites, setInvites] = useState<OrganizationInvite[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [creating, setCreating] = useState(false);
  const [accepting, setAccepting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Get memberships from AuthContext (already loaded there)
  const memberships = user?.memberships || [];

  // Auto-redirect if user has memberships
  useEffect(() => {
    if (authLoading) return;

    // If user has memberships, auto-select and redirect
    if (memberships.length > 0) {
      console.log('[Onboarding] User has memberships, auto-redirecting...');
      const storedOrgId = localStorage.getItem('current_org_id');
      const matchingMembership = storedOrgId
        ? memberships.find(m => m.organization_id === storedOrgId)
        : null;
      const orgToSelect = matchingMembership?.organization_id || memberships[0].organization_id;
      switchOrganization(orgToSelect);
      navigate(returnUrl);
    }
  }, [authLoading, memberships, switchOrganization, navigate, returnUrl]);

  // Only load invites - memberships come from AuthContext
  useEffect(() => {
    async function loadInvites() {
      if (!supabaseUser?.email) {
        setLoadingInvites(false);
        return;
      }

      // If user has memberships, skip loading invites (they'll be redirected)
      if (memberships.length > 0) {
        setLoadingInvites(false);
        return;
      }

      try {
        console.log('[Onboarding] Loading invites for:', supabaseUser.email);
        const userInvites = await getInvitesForEmail(supabaseUser.email);
        console.log('[Onboarding] Invites loaded:', userInvites.length);
        setInvites(userInvites);
      } catch (err: any) {
        console.error('[Onboarding] Failed to load invites:', err);
        // Don't show error for invites - just show empty list
        setInvites([]);
      } finally {
        setLoadingInvites(false);
      }
    }

    loadInvites();
  }, [supabaseUser?.email, memberships.length]);

  // Handle selecting an existing organization
  const handleSelectOrg = (orgId: string) => {
    switchOrganization(orgId);
    navigate(returnUrl);
  };

  // Handle accepting an invite
  const handleAcceptInvite = async (invite: OrganizationInvite) => {
    if (!supabaseUser?.id) return;

    setAccepting(invite.id);
    setError(null);

    try {
      const membership = await acceptInvite(invite.token, supabaseUser.id);
      await refreshMemberships();
      switchOrganization(membership.organization_id);
      navigate(returnUrl);
    } catch (err: any) {
      console.error('Failed to accept invite:', err);
      setError(err.message || 'Failed to accept invite');
    } finally {
      setAccepting(null);
    }
  };

  // Handle creating a new organization
  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabaseUser?.id || !newOrgName.trim()) return;

    setCreating(true);
    setError(null);

    try {
      const newOrg = await createOrganization({ name: newOrgName.trim() }, supabaseUser.id);
      await refreshMemberships();
      switchOrganization(newOrg.id);
      navigate(returnUrl);
    } catch (err: any) {
      console.error('Failed to create organization:', err);
      setError(err.message || 'Failed to create organization');
    } finally {
      setCreating(false);
    }
  };

  // Show loading while auth is initializing or invites are loading
  if (authLoading || loadingInvites) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="w-5 h-5 border-2 border-primary border-r-transparent rounded-full animate-spin" role="status">
          <span className="sr-only">Loading...</span>
        </div>
      </div>
    );
  }

  const hasOptions = memberships.length > 0 || invites.length > 0;

  return (
    <div className="max-w-7xl mx-auto px-4 flex flex-col items-center justify-center min-h-screen">
      <div className="bg-card border border-border rounded-lg shadow-sm" style={{ maxWidth: '500px', width: '100%' }}>
        <div className="p-6">
          <h1 className="text-lg font-semibold mb-1 text-center text-foreground">Welcome to PlatoVue</h1>
          <p className="text-muted-foreground text-center mb-4">
            {hasOptions ? 'Select an organization to continue' : 'Create your first organization to get started'}
          </p>

          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive mb-3" role="alert">
              {error}
            </div>
          )}

          {/* Existing Memberships */}
          {memberships.length > 0 && (
            <div className="mb-4">
              <h6 className="text-muted-foreground mb-2 text-sm font-medium">Your Organizations</h6>
              <div className="border border-border rounded-lg overflow-hidden">
                {memberships.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className="w-full flex justify-between items-center px-4 py-3 min-h-[44px] bg-card hover:bg-muted/50 border-b border-border last:border-b-0 text-left"
                    onClick={() => handleSelectOrg(m.organization_id)}
                  >
                    <div>
                      <span className="font-medium text-foreground">{m.organization?.name}</span>
                      <span className="inline-block px-2 py-0.5 text-xs rounded bg-muted text-foreground ml-2 capitalize">{m.role}</span>
                    </div>
                    <span className="text-primary">Select &rarr;</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Pending Invites */}
          {invites.length > 0 && (
            <div className="mb-4">
              <h6 className="text-muted-foreground mb-2 text-sm font-medium">Pending Invites</h6>
              <div className="border border-border rounded-lg overflow-hidden">
                {invites.map((invite) => (
                  <div
                    key={invite.id}
                    className="flex justify-between items-center px-4 py-3 min-h-[44px] bg-card border-b border-border last:border-b-0"
                  >
                    <div>
                      <span className="font-medium text-foreground">{(invite as any).organization?.name || 'Organization'}</span>
                      <span className="inline-block px-2 py-0.5 text-xs rounded bg-primary/20 text-primary ml-2 capitalize">{invite.role}</span>
                    </div>
                    <button
                      type="button"
                      className="inline-flex items-center justify-center px-3 py-1.5 min-h-[44px] text-xs font-medium rounded-md bg-transparent text-success border border-success hover:bg-success/10"
                      onClick={() => handleAcceptInvite(invite)}
                      disabled={accepting === invite.id}
                    >
                      {accepting === invite.id ? 'Accepting...' : 'Accept'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Divider if there are options */}
          {hasOptions && (
            <div className="flex items-center mb-4">
              <hr className="grow border-border" />
              <span className="px-2 text-muted-foreground text-sm">or</span>
              <hr className="grow border-border" />
            </div>
          )}

          {/* Create New Organization */}
          {!showCreateForm && hasOptions ? (
            <button
              type="button"
              className="inline-flex items-center justify-center w-full px-4 py-2 min-h-[44px] text-sm font-medium rounded-md bg-transparent text-primary border border-primary hover:bg-primary/10"
              onClick={() => setShowCreateForm(true)}
            >
              Create New Organization
            </button>
          ) : (
            <form onSubmit={handleCreateOrg}>
              <div className="mb-3">
                <label htmlFor="orgName" className="block text-xs font-medium text-muted-foreground mb-1">
                  Organization Name
                </label>
                <input
                  type="text"
                  id="orgName"
                  className="w-full px-3 py-2 min-h-[44px] text-sm bg-muted border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                  placeholder="e.g., Acme Corp"
                  value={newOrgName}
                  onChange={(e) => setNewOrgName(e.target.value)}
                  required
                  autoFocus={!hasOptions}
                />
                <div className="text-xs text-muted-foreground mt-1">
                  You'll be the admin of this organization.
                </div>
              </div>
              <div className="flex gap-2">
                {hasOptions && (
                  <button
                    type="button"
                    className="inline-flex items-center justify-center grow px-4 py-2 min-h-[44px] text-sm font-medium rounded-md bg-transparent text-foreground border border-border hover:bg-muted/50"
                    onClick={() => setShowCreateForm(false)}
                    disabled={creating}
                  >
                    Cancel
                  </button>
                )}
                <button
                  type="submit"
                  className="inline-flex items-center justify-center grow px-4 py-2 min-h-[44px] text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
                  disabled={creating || !newOrgName.trim()}
                >
                  {creating ? 'Creating...' : 'Create Organization'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default OnboardingPage;
