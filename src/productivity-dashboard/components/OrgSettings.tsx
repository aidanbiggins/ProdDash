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
      setError(err.message || 'Failed to load organization data');
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
    <div className="modal fade show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-lg">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Organization Settings</h5>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>
          <div className="modal-body">
            {/* Error/Success Messages */}
            {error && <div className="alert alert-danger">{error}</div>}
            {success && <div className="alert alert-success">{success}</div>}

            {/* Navigation */}
            <ul className="nav nav-tabs mb-4">
              <li className="nav-item">
                <button
                  className={`nav-link ${activeSection === 'general' ? 'active' : ''}`}
                  onClick={() => setActiveSection('general')}
                >
                  General
                </button>
              </li>
              <li className="nav-item">
                <button
                  className={`nav-link ${activeSection === 'members' ? 'active' : ''}`}
                  onClick={() => setActiveSection('members')}
                >
                  Members ({members.length})
                </button>
              </li>
              <li className="nav-item">
                <button
                  className={`nav-link ${activeSection === 'invites' ? 'active' : ''}`}
                  onClick={() => setActiveSection('invites')}
                >
                  Invites ({invites.length})
                </button>
              </li>
              {canManage && (
                <li className="nav-item">
                  <button
                    className={`nav-link text-danger ${activeSection === 'danger' ? 'active' : ''}`}
                    onClick={() => setActiveSection('danger')}
                  >
                    Danger Zone
                  </button>
                </li>
              )}
            </ul>

            {/* General Settings */}
            {activeSection === 'general' && (
              <div>
                <h6>Organization Name</h6>
                <div className="input-group mb-3">
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
            )}

            {/* Members */}
            {activeSection === 'members' && (
              <div>
                <table className="table">
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
                  </tbody>
                </table>
              </div>
            )}

            {/* Invites */}
            {activeSection === 'invites' && (
              <div>
                {canManage && (
                  <form onSubmit={handleInvite} className="mb-4">
                    <h6>Send Invite</h6>
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
                  <p className="text-muted">No pending invites</p>
                ) : (
                  <table className="table">
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
                )}
              </div>
            )}

            {/* Danger Zone */}
            {activeSection === 'danger' && canManage && (
              <div>
                <div className="border border-danger rounded p-4">
                  <h6 className="text-danger">Delete Organization</h6>
                  <p className="text-muted small">
                    This action cannot be undone. All data associated with this organization will be deleted.
                  </p>

                  {!showDeleteConfirm ? (
                    <button
                      className="btn btn-outline-danger"
                      onClick={() => setShowDeleteConfirm(true)}
                    >
                      Delete Organization
                    </button>
                  ) : (
                    <div>
                      <p className="mb-2">
                        Type <strong>{currentOrg?.name}</strong> to confirm:
                      </p>
                      <div className="input-group">
                        <input
                          type="text"
                          className="form-control"
                          value={deleteConfirmText}
                          onChange={(e) => setDeleteConfirmText(e.target.value)}
                          placeholder="Organization name"
                        />
                        <button
                          className="btn btn-danger"
                          onClick={handleDeleteOrg}
                          disabled={deleteConfirmText !== currentOrg?.name || isLoading}
                        >
                          {isLoading ? 'Deleting...' : 'Confirm Delete'}
                        </button>
                        <button
                          className="btn btn-secondary"
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
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
