// Organization Settings Tab - Full page for org configuration
import React, { useState, useEffect, useCallback } from 'react';
import { PageShell, PageHeader, GlassPanel, SectionHeader } from '../layout';
import { useAuth } from '../../../contexts/AuthContext';
import {
  getOrganizationMembers,
  getOrganizationInvites,
  updateOrganization,
  createInvite,
  deleteInvite,
  updateMemberRole,
  removeMember,
  getInviteUrl
} from '../../services/organizationService';
import { OrganizationMembership, OrganizationInvite } from '../../types/auth';

interface MemberWithEmail extends OrganizationMembership {
  email?: string;
}

export function OrgSettingsTab() {
  const { currentOrg, user, refreshMemberships, userRole, supabaseUser } = useAuth();
  const [orgName, setOrgName] = useState('');
  const [members, setMembers] = useState<MemberWithEmail[]>([]);
  const [invites, setInvites] = useState<OrganizationInvite[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Invite form state
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'member'>('member');

  const canManage = userRole === 'super_admin' || userRole === 'admin';

  // Load data when org changes
  const loadData = useCallback(async () => {
    if (!currentOrg?.id) return;

    setIsLoading(true);
    setError(null);

    try {
      const [membersData, invitesData] = await Promise.all([
        getOrganizationMembers(currentOrg.id),
        getOrganizationInvites(currentOrg.id)
      ]);
      setMembers(membersData);
      setInvites(invitesData);
      setOrgName(currentOrg.name);
    } catch (err: any) {
      setError(err.message || 'Failed to load organization data');
    } finally {
      setIsLoading(false);
    }
  }, [currentOrg?.id, currentOrg?.name]);

  useEffect(() => {
    if (currentOrg) {
      loadData();
    }
  }, [currentOrg, loadData]);

  // Handlers
  const handleSaveName = async () => {
    if (!currentOrg?.id || !orgName.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      await updateOrganization(currentOrg.id, { name: orgName.trim() });
      await refreshMemberships();
      setSuccess('Organization name updated');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to update organization');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrg?.id || !inviteEmail.trim() || !supabaseUser?.id) return;

    setIsLoading(true);
    setError(null);

    try {
      const invite = await createInvite(currentOrg.id, { email: inviteEmail, role: inviteRole }, supabaseUser.id);
      setInvites([...invites, invite]);
      setInviteEmail('');
      setSuccess('Invite sent successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to send invite');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteInvite = async (inviteId: string) => {
    if (!confirm('Cancel this invite?')) return;

    setIsLoading(true);
    try {
      await deleteInvite(inviteId);
      setInvites(invites.filter(i => i.id !== inviteId));
    } catch (err: any) {
      setError(err.message || 'Failed to cancel invite');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateMemberRole = async (memberId: string, newRole: 'admin' | 'member') => {
    setIsLoading(true);
    try {
      await updateMemberRole(memberId, newRole);
      setMembers(members.map(m => m.id === memberId ? { ...m, role: newRole } : m));
      setSuccess('Member role updated');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to update member role');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm('Remove this member from the organization?')) return;

    setIsLoading(true);
    try {
      await removeMember(memberId);
      setMembers(members.filter(m => m.id !== memberId));
      setSuccess('Member removed');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to remove member');
    } finally {
      setIsLoading(false);
    }
  };

  const copyInviteLink = (token: string) => {
    const url = getInviteUrl(token);
    navigator.clipboard.writeText(url);
    setSuccess('Invite link copied to clipboard');
    setTimeout(() => setSuccess(null), 3000);
  };

  if (!currentOrg) {
    return (
      <PageShell>
        <PageHeader
          title="Organization Settings"
          description="Manage your organization and team members"
          breadcrumbs={[
            { label: 'Settings' },
            { label: 'Organization' }
          ]}
        />
        <GlassPanel>
          <div className="text-center py-5 text-muted">
            <i className="bi bi-building fs-1 mb-3 d-block"></i>
            <p>No organization selected. Please select or create an organization.</p>
          </div>
        </GlassPanel>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader
        title="Organization Settings"
        description="Manage your organization and team members"
        breadcrumbs={[
          { label: 'Settings' },
          { label: 'Organization' }
        ]}
      />

      {/* Error/Success Messages */}
      {error && <div className="alert alert-danger mb-4">{error}</div>}
      {success && <div className="alert alert-success mb-4">{success}</div>}

      {/* General Settings */}
      <SectionHeader title="General">
        <GlassPanel>
          <div className="p-4">
            <h6 className="mb-3">Organization Name</h6>
            <div className="input-group mb-3" style={{ maxWidth: '400px' }}>
              <input
                type="text"
                className="form-control"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                disabled={!canManage || isLoading}
              />
              <button
                className="btn btn-primary"
                onClick={handleSaveName}
                disabled={!canManage || isLoading || orgName === currentOrg?.name}
              >
                Save
              </button>
            </div>
            <p className="text-muted small">
              Slug: <code>{currentOrg?.slug}</code>
            </p>
          </div>
        </GlassPanel>
      </SectionHeader>

      {/* Members */}
      <SectionHeader title={`Members (${members.length})`}>
        <GlassPanel>
          <div className="table-responsive">
            <table className="table table-bespoke mb-0">
              <thead>
                <tr>
                  <th>User ID</th>
                  <th>Role</th>
                  <th>Joined</th>
                  {canManage && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {members.map((member) => (
                  <tr key={member.id}>
                    <td>
                      <code className="small">{member.user_id.slice(0, 8)}...</code>
                      {member.user_id === supabaseUser?.id && (
                        <span className="badge bg-info ms-2">You</span>
                      )}
                    </td>
                    <td>
                      {canManage && member.user_id !== supabaseUser?.id ? (
                        <select
                          className="form-select form-select-sm"
                          value={member.role}
                          onChange={(e) => handleUpdateMemberRole(member.id, e.target.value as 'admin' | 'member')}
                          disabled={isLoading}
                          style={{ width: '100px' }}
                        >
                          <option value="admin">Admin</option>
                          <option value="member">Member</option>
                        </select>
                      ) : (
                        <span className={`badge ${member.role === 'admin' ? 'bg-primary' : 'bg-secondary'}`}>
                          {member.role}
                        </span>
                      )}
                    </td>
                    <td className="small text-muted">
                      {new Date(member.created_at).toLocaleDateString()}
                    </td>
                    {canManage && (
                      <td>
                        {member.user_id !== supabaseUser?.id && (
                          <button
                            className="btn btn-sm btn-outline-danger"
                            onClick={() => handleRemoveMember(member.id)}
                            disabled={isLoading}
                          >
                            Remove
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
                {members.length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-center text-muted py-4">
                      No members found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </GlassPanel>
      </SectionHeader>

      {/* Invites */}
      <SectionHeader title={`Invites (${invites.length})`}>
        <GlassPanel>
          {canManage && (
            <form onSubmit={handleInvite} className="p-4 border-bottom" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
              <h6 className="mb-3">Send Invite</h6>
              <div className="row g-2">
                <div className="col-md-6">
                  <input
                    type="email"
                    className="form-control"
                    placeholder="Email address"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    required
                    disabled={isLoading}
                  />
                </div>
                <div className="col-md-3">
                  <select
                    className="form-select"
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as 'admin' | 'member')}
                    disabled={isLoading}
                  >
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div className="col-md-3">
                  <button
                    type="submit"
                    className="btn btn-primary w-100"
                    disabled={isLoading || !inviteEmail}
                  >
                    Send Invite
                  </button>
                </div>
              </div>
            </form>
          )}

          {invites.length === 0 ? (
            <div className="text-center text-muted py-4">No pending invites</div>
          ) : (
            <div className="table-responsive">
              <table className="table table-bespoke mb-0">
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Expires</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {invites.map((invite) => (
                    <tr key={invite.id}>
                      <td>{invite.email}</td>
                      <td>
                        <span className={`badge ${invite.role === 'admin' ? 'bg-primary' : 'bg-secondary'}`}>
                          {invite.role}
                        </span>
                      </td>
                      <td className="small text-muted">
                        {new Date(invite.expires_at).toLocaleDateString()}
                      </td>
                      <td>
                        <button
                          className="btn btn-sm btn-outline-secondary me-2"
                          onClick={() => copyInviteLink(invite.token)}
                          title="Copy invite link"
                        >
                          Copy Link
                        </button>
                        {canManage && (
                          <button
                            className="btn btn-sm btn-outline-danger"
                            onClick={() => handleDeleteInvite(invite.id)}
                            disabled={isLoading}
                          >
                            Cancel
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </GlassPanel>
      </SectionHeader>
    </PageShell>
  );
}

export default OrgSettingsTab;
