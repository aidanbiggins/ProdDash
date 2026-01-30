// Invite Accept Page
// Handles accepting organization invites via token URL

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  getInviteByToken,
  acceptInvite
} from '../productivity-dashboard/services/organizationService';
import { OrganizationInvite } from '../productivity-dashboard/types/auth';

export function InviteAcceptPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { supabaseUser, loading: authLoading, refreshMemberships } = useAuth();

  const [invite, setInvite] = useState<OrganizationInvite | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);

  // Load invite details
  useEffect(() => {
    async function loadInvite() {
      if (!token) {
        setError('Invalid invite link');
        setLoading(false);
        return;
      }

      try {
        const inviteData = await getInviteByToken(token);
        if (!inviteData) {
          setError('This invite link is invalid or has expired');
        } else {
          setInvite(inviteData);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load invite');
      } finally {
        setLoading(false);
      }
    }

    loadInvite();
  }, [token]);

  // Handle accepting the invite
  const handleAccept = async () => {
    if (!invite || !supabaseUser?.id || !token) return;

    setAccepting(true);
    setError(null);

    try {
      await acceptInvite(token, supabaseUser.id);
      await refreshMemberships();
      // Redirect to dashboard - the new org will be available in the switcher
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Failed to accept invite');
      setAccepting(false);
    }
  };

  // Show loading state
  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="text-center">
          <div className="w-5 h-5 border-2 border-primary border-r-transparent rounded-full animate-spin mb-3 mx-auto" role="status">
            <span className="sr-only">Loading...</span>
          </div>
          <p className="text-muted-foreground">Loading invite...</p>
        </div>
      </div>
    );
  }

  // If not logged in, prompt to log in
  if (!supabaseUser) {
    // Store the invite URL to redirect back after login
    const returnUrl = window.location.pathname;
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="bg-card border border-border rounded-lg shadow-sm" style={{ maxWidth: '400px', width: '100%' }}>
          <div className="text-center p-8">
            <h4 className="mb-4 text-lg font-semibold">Organization Invite</h4>
            {invite ? (
              <>
                <p className="text-muted-foreground mb-4">
                  You've been invited to join <strong>{(invite as any).organization?.name || 'an organization'}</strong>.
                </p>
                <p className="mb-4">Please log in to accept this invite.</p>
                <a
                  href={`/login?returnUrl=${encodeURIComponent(returnUrl)}`}
                  className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-md bg-primary text-background hover:bg-primary/90"
                >
                  Log In to Accept
                </a>
              </>
            ) : (
              <div className="p-3 rounded-lg bg-destructive/10 border border-bad/20 text-destructive">{error || 'Invalid invite'}</div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Show error state
  if (error && !invite) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="bg-card border border-border rounded-lg shadow-sm" style={{ maxWidth: '400px', width: '100%' }}>
          <div className="text-center p-8">
            <div className="text-bad mb-4">
              <i className="bi bi-exclamation-circle" style={{ fontSize: '3rem' }}></i>
            </div>
            <h4 className="mb-3 text-lg font-semibold">Invalid Invite</h4>
            <p className="text-muted-foreground mb-4">{error}</p>
            <button
              className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-md bg-primary text-background hover:bg-primary/90"
              onClick={() => navigate('/')}
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Show invite acceptance form
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface">
      <div className="bg-card border border-border rounded-lg shadow-sm" style={{ maxWidth: '450px', width: '100%' }}>
        <div className="p-8">
          <div className="text-center mb-4">
            <div className="bg-primary/10 rounded-full inline-flex items-center justify-center mb-3" style={{ width: '60px', height: '60px' }}>
              <i className="bi bi-building text-primary" style={{ fontSize: '1.5rem' }}></i>
            </div>
            <h4 className="text-lg font-semibold">Organization Invite</h4>
          </div>

          {error && <div className="p-3 rounded-lg bg-destructive/10 border border-bad/20 text-destructive">{error}</div>}

          <div className="text-center mb-4">
            <p className="mb-2">You've been invited to join:</p>
            <h5 className="text-primary mb-3 font-semibold">
              {(invite as any).organization?.name || 'Organization'}
            </h5>
            <p className="text-muted-foreground text-sm mb-0">
              Role: <span className={`inline-block px-2 py-0.5 text-xs rounded ${invite?.role === 'admin' ? 'bg-primary text-background' : 'bg-white/10 text-foreground'}`}>
                {invite?.role || 'member'}
              </span>
            </p>
          </div>

          <div className="grid gap-2">
            <button
              className="inline-flex items-center justify-center px-6 py-3 text-base font-medium rounded-md bg-primary text-background hover:bg-primary/90"
              onClick={handleAccept}
              disabled={accepting}
            >
              {accepting ? (
                <>
                  <span className="w-4 h-4 border-2 border-current border-r-transparent rounded-full animate-spin mr-2" />
                  Accepting...
                </>
              ) : (
                'Accept Invite'
              )}
            </button>
            <button
              className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-md bg-transparent text-foreground border border-border hover:bg-white/10"
              onClick={() => navigate('/')}
              disabled={accepting}
            >
              Decline
            </button>
          </div>

          <p className="text-muted-foreground text-sm text-center mt-4 mb-0">
            Invited as: {supabaseUser.email}
          </p>
        </div>
      </div>
    </div>
  );
}
