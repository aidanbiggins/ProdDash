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
      <div className="min-vh-100 d-flex align-items-center justify-content-center bg-light">
        <div className="text-center">
          <div className="spinner-border text-primary mb-3" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="text-muted">Loading invite...</p>
        </div>
      </div>
    );
  }

  // If not logged in, prompt to log in
  if (!supabaseUser) {
    // Store the invite URL to redirect back after login
    const returnUrl = window.location.pathname;
    return (
      <div className="min-vh-100 d-flex align-items-center justify-content-center bg-light">
        <div className="card shadow-sm" style={{ maxWidth: '400px', width: '100%' }}>
          <div className="card-body text-center p-5">
            <h4 className="mb-4">Organization Invite</h4>
            {invite ? (
              <>
                <p className="text-muted mb-4">
                  You've been invited to join <strong>{(invite as any).organization?.name || 'an organization'}</strong>.
                </p>
                <p className="mb-4">Please log in to accept this invite.</p>
                <a
                  href={`/login?returnUrl=${encodeURIComponent(returnUrl)}`}
                  className="btn btn-primary"
                >
                  Log In to Accept
                </a>
              </>
            ) : (
              <div className="alert alert-danger">{error || 'Invalid invite'}</div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Show error state
  if (error && !invite) {
    return (
      <div className="min-vh-100 d-flex align-items-center justify-content-center bg-light">
        <div className="card shadow-sm" style={{ maxWidth: '400px', width: '100%' }}>
          <div className="card-body text-center p-5">
            <div className="text-danger mb-4">
              <i className="bi bi-exclamation-circle" style={{ fontSize: '3rem' }}></i>
            </div>
            <h4 className="mb-3">Invalid Invite</h4>
            <p className="text-muted mb-4">{error}</p>
            <button
              className="btn btn-primary"
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
    <div className="min-vh-100 d-flex align-items-center justify-content-center bg-light">
      <div className="card shadow-sm" style={{ maxWidth: '450px', width: '100%' }}>
        <div className="card-body p-5">
          <div className="text-center mb-4">
            <div className="bg-primary bg-opacity-10 rounded-circle d-inline-flex align-items-center justify-content-center mb-3" style={{ width: '60px', height: '60px' }}>
              <i className="bi bi-building text-primary" style={{ fontSize: '1.5rem' }}></i>
            </div>
            <h4>Organization Invite</h4>
          </div>

          {error && <div className="alert alert-danger">{error}</div>}

          <div className="text-center mb-4">
            <p className="mb-2">You've been invited to join:</p>
            <h5 className="text-primary mb-3">
              {(invite as any).organization?.name || 'Organization'}
            </h5>
            <p className="text-muted small mb-0">
              Role: <span className={`badge ${invite?.role === 'admin' ? 'bg-primary' : 'bg-secondary'}`}>
                {invite?.role || 'member'}
              </span>
            </p>
          </div>

          <div className="d-grid gap-2">
            <button
              className="btn btn-primary btn-lg"
              onClick={handleAccept}
              disabled={accepting}
            >
              {accepting ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" />
                  Accepting...
                </>
              ) : (
                'Accept Invite'
              )}
            </button>
            <button
              className="btn btn-outline-secondary"
              onClick={() => navigate('/')}
              disabled={accepting}
            >
              Decline
            </button>
          </div>

          <p className="text-muted small text-center mt-4 mb-0">
            Invited as: {supabaseUser.email}
          </p>
        </div>
      </div>
    </div>
  );
}
