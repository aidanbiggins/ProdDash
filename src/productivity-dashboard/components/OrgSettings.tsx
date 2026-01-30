// Organization Settings Component
// Admin panel for managing organization members and settings

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import {
  Organization,
  OrganizationMembership,
  OrganizationInvite
} from '../types/auth';
import {
  getOrganizationMembers,
  getOrganizationInvites,
  updateOrganization,
  deleteOrganization,
  createInvite,
  deleteInvite,
  updateMemberRole,
  removeMember,
  getInviteUrl
} from '../services/organizationService';

interface OrgSettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

interface MemberWithEmail extends OrganizationMembership {
  email?: string;
}

export function OrgSettings({ isOpen, onClose }: OrgSettingsProps) {
  const { currentOrg, user, refreshMemberships, userRole, supabaseUser } = useAuth();
  const [activeSection, setActiveSection] = useState<'general' | 'members' | 'invites' | 'danger'>('general');
  const [orgName, setOrgName] = useState('');
  const [members, setMembers] = useState<MemberWithEmail[]>([]);
  const [invites, setInvites] = useState<OrganizationInvite[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Invite form state
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'member'>('member');

  // Delete confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

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
      // Filter out spurious "users" table errors - OrgSettings doesn't query that table
      const errMsg = err.message || 'Failed to load organization data';
      if (!errMsg.includes('table users')) {
        setError(errMsg);
      } else {
        console.warn('[OrgSettings] Ignoring spurious users table error:', errMsg);
      }
    } finally {
      setIsLoading(false);
    }
  }, [currentOrg?.id, currentOrg?.name]);

  useEffect(() => {
    if (isOpen && currentOrg) {
      loadData();
    }
  }, [isOpen, currentOrg, loadData]);

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

  const handleDeleteOrg = async () => {
    if (!currentOrg?.id || deleteConfirmText !== currentOrg.name) return;

    setIsLoading(true);
    try {
      await deleteOrganization(currentOrg.id);
      await refreshMemberships();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to delete organization');
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" tabIndex={-1}>
      <div className="w-full max-w-3xl mx-4">
        <div className="bg-card border border-border rounded-lg shadow-lg max-h-[90vh] flex flex-col">
          <div className="flex items-center justify-between p-4 border-b border-border">
            <h5 className="font-semibold text-foreground">Organization Settings</h5>
            <button type="button" className="text-muted-foreground hover:text-foreground" onClick={onClose}>&times;</button>
          </div>
          <div className="p-4 overflow-y-auto flex-1">
            {/* Error/Success Messages */}
            {error && <div className="p-3 rounded-lg bg-bad/10 border border-bad/30 text-bad mb-4">{error}</div>}
            {success && <div className="p-3 rounded-lg bg-good/10 border border-good/30 text-good mb-4">{success}</div>}

            {/* Navigation */}
            <div className="flex gap-1 mb-4 border-b border-border">
              <button
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeSection === 'general' ? 'border-accent text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                onClick={() => setActiveSection('general')}
              >
                General
              </button>
              <button
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeSection === 'members' ? 'border-accent text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                onClick={() => setActiveSection('members')}
              >
                Members ({members.length})
              </button>
              <button
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeSection === 'invites' ? 'border-accent text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                onClick={() => setActiveSection('invites')}
              >
                Invites ({invites.length})
              </button>
              {canManage && (
                <button
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeSection === 'danger' ? 'border-bad text-bad' : 'border-transparent text-bad/70 hover:text-bad'}`}
                  onClick={() => setActiveSection('danger')}
                >
                  Danger Zone
                </button>
              )}
            </div>

            {/* General Settings */}
            {activeSection === 'general' && (
              <div>
                <h6 className="font-semibold text-foreground mb-2">Organization Name</h6>
                <div className="flex gap-2 mb-3">
                  <input
                    type="text"
                    className="flex-1 px-3 py-2 text-sm bg-card/30 border border-border rounded-md text-foreground focus:outline-none focus:border-accent disabled:opacity-50"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    disabled={!canManage || isLoading}
                  />
                  <button
                    className="px-4 py-2 text-sm font-medium rounded-md bg-accent text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                    onClick={handleSaveName}
                    disabled={!canManage || isLoading || orgName === currentOrg?.name}
                  >
                    Save
                  </button>
                </div>
                <p className="text-muted-foreground text-sm">
                  Slug: <code className="text-accent">{currentOrg?.slug}</code>
                </p>
              </div>
            )}

            {/* Members */}
            {activeSection === 'members' && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase">User ID</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Role</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Joined</th>
                      {canManage && <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((member) => (
                      <tr key={member.id} className="border-b border-border">
                        <td className="px-3 py-2">
                          <code className="text-xs text-accent">{member.user_id.slice(0, 8)}...</code>
                          {member.user_id === supabaseUser?.id && (
                            <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded bg-accent/20 text-accent ml-2">You</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {canManage && member.user_id !== supabaseUser?.id ? (
                            <select
                              className="w-[100px] px-2 py-1 text-sm bg-card/30 border border-border rounded text-foreground focus:outline-none focus:border-accent disabled:opacity-50"
                              value={member.role}
                              onChange={(e) => handleUpdateMemberRole(member.id, e.target.value as 'admin' | 'member')}
                              disabled={isLoading}
                            >
                              <option value="admin">Admin</option>
                              <option value="member">Member</option>
                            </select>
                          ) : (
                            <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded ${member.role === 'admin' ? 'bg-accent text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                              {member.role}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">
                          {new Date(member.created_at).toLocaleDateString()}
                        </td>
                        {canManage && (
                          <td className="px-3 py-2">
                            {member.user_id !== supabaseUser?.id && (
                              <button
                                className="px-2 py-1 text-xs font-medium rounded border border-bad text-bad hover:bg-bad hover:text-white transition-colors disabled:opacity-50"
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
                  </tbody>
                </table>
              </div>
            )}

            {/* Invites */}
            {activeSection === 'invites' && (
              <div>
                {canManage && (
                  <form onSubmit={handleInvite} className="mb-4">
                    <h6 className="font-semibold text-foreground mb-2">Send Invite</h6>
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
                      <div className="md:col-span-6">
                        <input
                          type="email"
                          className="w-full px-3 py-2 text-sm bg-card/30 border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-accent disabled:opacity-50"
                          placeholder="Email address"
                          value={inviteEmail}
                          onChange={(e) => setInviteEmail(e.target.value)}
                          required
                          disabled={isLoading}
                        />
                      </div>
                      <div className="md:col-span-3">
                        <select
                          className="w-full px-3 py-2 text-sm bg-card/30 border border-border rounded-md text-foreground focus:outline-none focus:border-accent disabled:opacity-50"
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
                          className="w-full px-4 py-2 text-sm font-medium rounded-md bg-accent text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                          disabled={isLoading || !inviteEmail}
                        >
                          Send Invite
                        </button>
                      </div>
                    </div>
                  </form>
                )}

                {invites.length === 0 ? (
                  <p className="text-muted-foreground">No pending invites</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Email</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Role</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Expires</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {invites.map((invite) => (
                          <tr key={invite.id} className="border-b border-border">
                            <td className="px-3 py-2 text-foreground">{invite.email}</td>
                            <td className="px-3 py-2">
                              <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded ${invite.role === 'admin' ? 'bg-accent text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                                {invite.role}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-xs text-muted-foreground">
                              {new Date(invite.expires_at).toLocaleDateString()}
                            </td>
                            <td className="px-3 py-2">
                              <button
                                className="px-2 py-1 text-xs font-medium rounded border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors mr-2"
                                onClick={() => copyInviteLink(invite.token)}
                                title="Copy invite link"
                              >
                                Copy Link
                              </button>
                              {canManage && (
                                <button
                                  className="px-2 py-1 text-xs font-medium rounded border border-bad text-bad hover:bg-bad hover:text-white transition-colors disabled:opacity-50"
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
              </div>
            )}

            {/* Danger Zone */}
            {activeSection === 'danger' && canManage && (
              <div>
                <div className="border border-bad rounded-lg p-4">
                  <h6 className="text-bad font-semibold">Delete Organization</h6>
                  <p className="text-muted-foreground text-sm mt-1">
                    This action cannot be undone. All data associated with this organization will be deleted.
                  </p>

                  {!showDeleteConfirm ? (
                    <button
                      className="mt-3 px-4 py-2 text-sm font-medium rounded-md border border-bad text-bad hover:bg-bad hover:text-white transition-colors"
                      onClick={() => setShowDeleteConfirm(true)}
                    >
                      Delete Organization
                    </button>
                  ) : (
                    <div className="mt-3">
                      <p className="mb-2 text-foreground">
                        Type <strong>{currentOrg?.name}</strong> to confirm:
                      </p>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          className="flex-1 px-3 py-2 text-sm bg-card/30 border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-accent"
                          value={deleteConfirmText}
                          onChange={(e) => setDeleteConfirmText(e.target.value)}
                          placeholder="Organization name"
                        />
                        <button
                          className="px-4 py-2 text-sm font-medium rounded-md bg-bad text-white hover:bg-bad/90 disabled:opacity-50"
                          onClick={handleDeleteOrg}
                          disabled={deleteConfirmText !== currentOrg?.name || isLoading}
                        >
                          {isLoading ? 'Deleting...' : 'Confirm Delete'}
                        </button>
                        <button
                          className="px-4 py-2 text-sm font-medium rounded-md bg-muted text-foreground hover:bg-muted/80"
                          onClick={() => {
                            setShowDeleteConfirm(false);
                            setDeleteConfirmText('');
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 p-4 border-t border-border">
            <button type="button" className="px-4 py-2 text-sm font-medium rounded-md bg-muted text-foreground hover:bg-muted/80" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default OrgSettings;
