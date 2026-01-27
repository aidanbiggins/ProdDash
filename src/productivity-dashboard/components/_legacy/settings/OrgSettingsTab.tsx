// Organization Settings Tab - Full page for org configuration
import React, { useState, useEffect, useCallback } from 'react';
import { PageShell, PageHeader, GlassPanel, SectionHeader } from '../layout';
import { useAuth } from '../../../../contexts/AuthContext';
import {
  getOrganizationMembers,
  getOrganizationInvites,
  updateOrganization,
  createInvite,
  deleteInvite,
  updateMemberRole,
  removeMember,
  getInviteUrl
} from '../../../services/organizationService';
import { OrganizationMembership, OrganizationInvite } from '../../../types/auth';

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
        />
        <GlassPanel>
          <div className="text-center py-8 text-muted-foreground">
            <i className="bi bi-building text-4xl mb-3 block"></i>
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
      />

      {/* Error/Success Messages */}
      {error && <div className="p-3 rounded-lg bg-bad-bg border border-bad/30 text-bad mb-4">{error}</div>}
      {success && <div className="p-3 rounded-lg bg-good-bg border border-good/30 text-good mb-4">{success}</div>}

      {/* General Settings */}
      <SectionHeader title="General">
        <GlassPanel>
          <div className="p-4">
            <h6 className="text-sm font-semibold text-foreground mb-3">Organization Name</h6>
            <div className="flex max-w-[400px] mb-3">
              <input
                type="text"
                className="flex-1 px-3 py-2 text-sm rounded-l-md bg-white/5 border border-white/10 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                disabled={!canManage || isLoading}
              />
              <button
                className="px-4 py-2 rounded-r-md font-medium bg-accent text-accent-foreground hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={handleSaveName}
                disabled={!canManage || isLoading || orgName === currentOrg?.name}
              >
                Save
              </button>
            </div>
            <p className="text-muted-foreground text-xs">
              Slug: <code className="bg-white/5 px-1 py-0.5 rounded">{currentOrg?.slug}</code>
            </p>
          </div>
        </GlassPanel>
      </SectionHeader>

      {/* Members */}
      <SectionHeader title={`Members (${members.length})`}>
        <GlassPanel>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">User ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Role</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Joined</th>
                  {canManage && <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {members.map((member) => (
                  <tr key={member.id} className="hover:bg-white/5">
                    <td className="px-4 py-3">
                      <code className="text-xs bg-white/5 px-1 py-0.5 rounded">{member.user_id.slice(0, 8)}...</code>
                      {member.user_id === supabaseUser?.id && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-500/20 text-blue-400 ml-2">You</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {canManage && member.user_id !== supabaseUser?.id ? (
                        <select
                          className="px-2 py-1 text-xs rounded-md bg-white/5 border border-white/10 text-foreground w-[100px] focus:outline-none focus:ring-1 focus:ring-accent"
                          value={member.role}
                          onChange={(e) => handleUpdateMemberRole(member.id, e.target.value as 'admin' | 'member')}
                          disabled={isLoading}
                        >
                          <option value="admin">Admin</option>
                          <option value="member">Member</option>
                        </select>
                      ) : (
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${member.role === 'admin' ? 'bg-accent/20 text-accent' : 'bg-white/10 text-muted-foreground'}`}>
                          {member.role}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {new Date(member.created_at).toLocaleDateString()}
                    </td>
                    {canManage && (
                      <td className="px-4 py-3">
                        {member.user_id !== supabaseUser?.id && (
                          <button
                            className="px-3 py-1 text-xs rounded-md border border-bad text-bad hover:bg-bad/10 transition-colors disabled:opacity-50"
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
                    <td colSpan={4} className="text-center text-muted-foreground py-8">
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
            <form onSubmit={handleInvite} className="p-4 border-b border-white/10">
              <h6 className="text-sm font-semibold text-foreground mb-3">Send Invite</h6>
              <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
                <div className="md:col-span-6">
                  <input
                    type="email"
                    className="w-full px-3 py-2 text-sm rounded-md bg-white/5 border border-white/10 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                    placeholder="Email address"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    required
                    disabled={isLoading}
                  />
                </div>
                <div className="md:col-span-3">
                  <select
                    className="w-full px-3 py-2 text-sm rounded-md bg-white/5 border border-white/10 text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as 'admin' | 'member')}
                    disabled={isLoading}
                  >
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div className="md:col-span-3">
                  <button
                    type="submit"
                    className="w-full px-4 py-2 rounded-md font-medium bg-accent text-accent-foreground hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={isLoading || !inviteEmail}
                  >
                    Send Invite
                  </button>
                </div>
              </div>
            </form>
          )}

          {invites.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">No pending invites</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Email</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Role</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Expires</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {invites.map((invite) => (
                    <tr key={invite.id} className="hover:bg-white/5">
                      <td className="px-4 py-3 text-foreground">{invite.email}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${invite.role === 'admin' ? 'bg-accent/20 text-accent' : 'bg-white/10 text-muted-foreground'}`}>
                          {invite.role}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {new Date(invite.expires_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          className="px-3 py-1 text-xs rounded-md border border-white/10 text-muted-foreground hover:bg-white/5 hover:text-foreground transition-colors mr-2"
                          onClick={() => copyInviteLink(invite.token)}
                          title="Copy invite link"
                        >
                          Copy Link
                        </button>
                        {canManage && (
                          <button
                            className="px-3 py-1 text-xs rounded-md border border-bad text-bad hover:bg-bad/10 transition-colors disabled:opacity-50"
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
