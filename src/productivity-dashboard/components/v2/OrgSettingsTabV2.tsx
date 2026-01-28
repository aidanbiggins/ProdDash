'use client';

/**
 * Organization Settings Tab V2 - Manage organization and team members
 *
 * V2 component that renders as a sub-view within SettingsTabV2.
 * Uses V2 design patterns: glass-panel, Tailwind tokens, lucide-react icons.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Building2, Link2, Trash2 } from 'lucide-react';
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

export function OrgSettingsTabV2() {
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
      <div className="glass-panel p-6 text-center">
        <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-foreground mb-2">No Organization Selected</h3>
        <p className="text-sm text-muted-foreground">
          Please select or create an organization.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Error/Success Messages */}
      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400">
          {error}
        </div>
      )}
      {success && (
        <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30 text-green-400">
          {success}
        </div>
      )}

      {/* General Settings */}
      <div className="glass-panel p-5">
        <div className="mb-4 pb-3 border-b border-border">
          <h2 className="text-base font-semibold text-foreground">General</h2>
        </div>

        <div className="space-y-3">
          <label className="block text-sm font-medium text-foreground">Organization Name</label>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:max-w-[400px]">
            <input
              type="text"
              className="flex-1 px-3 py-2 text-sm rounded-md sm:rounded-l-md sm:rounded-r-none bg-muted/50 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary min-h-[44px]"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              disabled={!canManage || isLoading}
            />
            <button
              className="px-4 py-2 rounded-md sm:rounded-r-md sm:rounded-l-none font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
              onClick={handleSaveName}
              disabled={!canManage || isLoading || orgName === currentOrg?.name}
            >
              Save
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            Slug: <code className="bg-muted/50 px-1 py-0.5 rounded">{currentOrg?.slug}</code>
          </p>
        </div>
      </div>

      {/* Members */}
      <div className="glass-panel p-5">
        <div className="mb-4 pb-3 border-b border-border">
          <h2 className="text-base font-semibold text-foreground">Members ({members.length})</h2>
        </div>

        <div className="overflow-x-auto -mx-5 px-5">
          <table className="w-full text-sm" style={{ minWidth: '600px' }}>
            <thead>
              <tr className="border-b border-border">
                <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">User ID</th>
                <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Role</th>
                <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Joined</th>
                {canManage && <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {members.map((member) => (
                <tr key={member.id} className="hover:bg-muted/30">
                  <td className="px-3 py-3">
                    <code className="text-xs bg-muted/50 px-1 py-0.5 rounded">{member.user_id.slice(0, 8)}...</code>
                    {member.user_id === supabaseUser?.id && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-500/20 text-blue-400 ml-2">You</span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    {canManage && member.user_id !== supabaseUser?.id ? (
                      <select
                        className="px-2 py-1.5 text-xs rounded-md bg-muted/50 border border-border text-foreground w-[100px] focus:outline-none focus:ring-1 focus:ring-primary"
                        value={member.role}
                        onChange={(e) => handleUpdateMemberRole(member.id, e.target.value as 'admin' | 'member')}
                        disabled={isLoading}
                      >
                        <option value="admin">Admin</option>
                        <option value="member">Member</option>
                      </select>
                    ) : (
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${member.role === 'admin' ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>
                        {member.role}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-xs text-muted-foreground">
                    {new Date(member.created_at).toLocaleDateString()}
                  </td>
                  {canManage && (
                    <td className="px-3 py-3">
                      {member.user_id !== supabaseUser?.id && (
                        <button
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-md border border-red-500/50 text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                          onClick={() => handleRemoveMember(member.id)}
                          disabled={isLoading}
                        >
                          <Trash2 className="w-3 h-3" />
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
      </div>

      {/* Invites */}
      <div className="glass-panel p-5">
        <div className="mb-4 pb-3 border-b border-border">
          <h2 className="text-base font-semibold text-foreground">Invites ({invites.length})</h2>
        </div>

        {canManage && (
          <form onSubmit={handleInvite} className="pb-4 mb-4 border-b border-border">
            <label className="block text-sm font-medium text-foreground mb-3">Send Invite</label>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
              <div className="md:col-span-6">
                <input
                  type="email"
                  className="w-full px-3 py-2 text-sm rounded-md bg-muted/50 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary min-h-[44px]"
                  placeholder="Email address"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  required
                  disabled={isLoading}
                />
              </div>
              <div className="md:col-span-3">
                <select
                  className="w-full px-3 py-2 text-sm rounded-md bg-muted/50 border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary min-h-[44px]"
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
                  className="w-full px-4 py-2 rounded-md font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
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
          <div className="overflow-x-auto -mx-5 px-5">
            <table className="w-full text-sm" style={{ minWidth: '500px' }}>
              <thead>
                <tr className="border-b border-border">
                  <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Email</th>
                  <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Role</th>
                  <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Expires</th>
                  <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {invites.map((invite) => (
                  <tr key={invite.id} className="hover:bg-muted/30">
                    <td className="px-3 py-3 text-foreground">{invite.email}</td>
                    <td className="px-3 py-3">
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${invite.role === 'admin' ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>
                        {invite.role}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-xs text-muted-foreground">
                      {new Date(invite.expires_at).toLocaleDateString()}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex gap-2">
                        <button
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-md border border-border text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                          onClick={() => copyInviteLink(invite.token)}
                          title="Copy invite link"
                        >
                          <Link2 className="w-3 h-3" />
                          Copy Link
                        </button>
                        {canManage && (
                          <button
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-md border border-red-500/50 text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                            onClick={() => handleDeleteInvite(invite.id)}
                            disabled={isLoading}
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default OrgSettingsTabV2;
