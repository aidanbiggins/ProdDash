import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  getInvitesForEmail,
  acceptInvite,
  createOrganization
} from '../productivity-dashboard/services/organizationService';
import { OrganizationInvite } from '../productivity-dashboard/types/auth';

const OnboardingPage: React.FC = () => {
  // Get memberships directly from AuthContext - it already loaded them
  const { user, supabaseUser, refreshMemberships, switchOrganization, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnUrl = searchParams.get('returnUrl') || '/';

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
      <div className="d-flex justify-content-center align-items-center vh-100">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  const hasOptions = memberships.length > 0 || invites.length > 0;

  return (
    <div className="container d-flex flex-column align-items-center justify-content-center vh-100">
      <div className="card shadow-sm" style={{ maxWidth: '500px', width: '100%' }}>
        <div className="card-body p-4">
          <h1 className="h4 mb-1 text-center">Welcome to PlatoVue</h1>
          <p className="text-muted text-center mb-4">
            {hasOptions ? 'Select an organization to continue' : 'Create your first organization to get started'}
          </p>

          {error && (
            <div className="alert alert-danger mb-3" role="alert">
              {error}
            </div>
          )}

          {/* Existing Memberships */}
          {memberships.length > 0 && (
            <div className="mb-4">
              <h6 className="text-muted mb-2">Your Organizations</h6>
              <div className="list-group">
                {memberships.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className="list-group-item list-group-item-action d-flex justify-content-between align-items-center"
                    onClick={() => handleSelectOrg(m.organization_id)}
                  >
                    <div>
                      <span className="fw-medium">{m.organization?.name}</span>
                      <span className="badge bg-secondary ms-2 text-capitalize">{m.role}</span>
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
              <h6 className="text-muted mb-2">Pending Invites</h6>
              <div className="list-group">
                {invites.map((invite) => (
                  <div
                    key={invite.id}
                    className="list-group-item d-flex justify-content-between align-items-center"
                  >
                    <div>
                      <span className="fw-medium">{(invite as any).organization?.name || 'Organization'}</span>
                      <span className="badge bg-info ms-2 text-capitalize">{invite.role}</span>
                    </div>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-success"
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
            <div className="d-flex align-items-center mb-4">
              <hr className="flex-grow-1" />
              <span className="px-2 text-muted small">or</span>
              <hr className="flex-grow-1" />
            </div>
          )}

          {/* Create New Organization */}
          {!showCreateForm && hasOptions ? (
            <button
              type="button"
              className="btn btn-outline-primary w-100"
              onClick={() => setShowCreateForm(true)}
            >
              Create New Organization
            </button>
          ) : (
            <form onSubmit={handleCreateOrg}>
              <div className="mb-3">
                <label htmlFor="orgName" className="form-label">
                  Organization Name
                </label>
                <input
                  type="text"
                  id="orgName"
                  className="form-control"
                  placeholder="e.g., Acme Corp"
                  value={newOrgName}
                  onChange={(e) => setNewOrgName(e.target.value)}
                  required
                  autoFocus={!hasOptions}
                />
                <div className="form-text">
                  You'll be the admin of this organization.
                </div>
              </div>
              <div className="d-flex gap-2">
                {hasOptions && (
                  <button
                    type="button"
                    className="btn btn-outline-secondary flex-grow-1"
                    onClick={() => setShowCreateForm(false)}
                    disabled={creating}
                  >
                    Cancel
                  </button>
                )}
                <button
                  type="submit"
                  className="btn btn-primary flex-grow-1"
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
