// Super Admin Panel Component
// Platform-level administration for super admins

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Organization } from '../types/auth';
import {
  getAllOrganizations,
  deleteOrganization,
  addSuperAdmin,
  removeSuperAdmin
} from '../services/organizationService';
import { supabase } from '../../lib/supabase';

interface SuperAdminPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

interface AuthUserInfo {
  id: string;
  email: string;
  created_at: string;
}

export function SuperAdminPanel({ isOpen, onClose }: SuperAdminPanelProps) {
  const { userRole, switchOrganization } = useAuth();
  const [activeSection, setActiveSection] = useState<'orgs' | 'users'>('orgs');
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Add super admin form
  const [newSuperAdminEmail, setNewSuperAdminEmail] = useState('');

  const isSuperAdmin = userRole === 'super_admin';

  // Load data
  const loadData = useCallback(async () => {
    if (!isSuperAdmin) return;

    setIsLoading(true);
    setError(null);

    try {
      const orgs = await getAllOrganizations();
      setOrganizations(orgs);
    } catch (err: any) {
      setError(err.message || 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  }, [isSuperAdmin]);

  useEffect(() => {
    if (isOpen && isSuperAdmin) {
      loadData();
    }
  }, [isOpen, isSuperAdmin, loadData]);

  const handleDeleteOrg = async (org: Organization) => {
    if (!confirm(`Delete organization "${org.name}"? This cannot be undone.`)) return;

    setIsLoading(true);
    try {
      await deleteOrganization(org.id);
      setOrganizations(organizations.filter(o => o.id !== org.id));
      setSuccess(`Organization "${org.name}" deleted`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to delete organization');
    } finally {
      setIsLoading(false);
    }
  };

  const handleImpersonateOrg = (orgId: string) => {
    switchOrganization(orgId);
    setSuccess('Switched to organization');
    setTimeout(() => {
      setSuccess(null);
      onClose();
    }, 1000);
  };

  const handleAddSuperAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSuperAdminEmail.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      // Look up user by email (this requires querying auth.users which may need special access)
      // For now, we'll just show the concept - in production, you'd need an admin API
      setError('Adding super admins requires the user ID. Please use the Supabase dashboard to add super admins directly.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  if (!isSuperAdmin) {
    return (
      <div className="modal fade show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
        <div className="modal-dialog">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">Access Denied</h5>
              <button type="button" className="btn-close" onClick={onClose}></button>
            </div>
            <div className="modal-body">
              <div className="alert alert-danger">
                You do not have super admin privileges.
              </div>
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

  return (
    <div className="modal fade show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-xl">
        <div className="modal-content">
          <div className="modal-header bg-danger text-white">
            <h5 className="modal-title">Super Admin Panel</h5>
            <button type="button" className="btn-close btn-close-white" onClick={onClose}></button>
          </div>
          <div className="modal-body">
            {/* Error/Success Messages */}
            {error && <div className="alert alert-danger">{error}</div>}
            {success && <div className="alert alert-success">{success}</div>}

            {/* Navigation */}
            <ul className="nav nav-tabs mb-4">
              <li className="nav-item">
                <button
                  className={`nav-link ${activeSection === 'orgs' ? 'active' : ''}`}
                  onClick={() => setActiveSection('orgs')}
                >
                  Organizations ({organizations.length})
                </button>
              </li>
              <li className="nav-item">
                <button
                  className={`nav-link ${activeSection === 'users' ? 'active' : ''}`}
                  onClick={() => setActiveSection('users')}
                >
                  Super Admins
                </button>
              </li>
            </ul>

            {/* Organizations Section */}
            {activeSection === 'orgs' && (
              <div>
                {isLoading ? (
                  <div className="text-center py-4">
                    <div className="spinner-border" role="status">
                      <span className="visually-hidden">Loading...</span>
                    </div>
                  </div>
                ) : organizations.length === 0 ? (
                  <p className="text-muted">No organizations found</p>
                ) : (
                  <div className="table-responsive">
                    <table className="table table-striped">
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Slug</th>
                          <th>Created</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {organizations.map((org) => (
                          <tr key={org.id}>
                            <td>
                              <strong>{org.name}</strong>
                              <br />
                              <code className="small text-muted">{org.id.slice(0, 8)}...</code>
                            </td>
                            <td><code>{org.slug}</code></td>
                            <td className="small text-muted">
                              {new Date(org.created_at).toLocaleDateString()}
                            </td>
                            <td>
                              <div className="btn-group btn-group-sm">
                                <button
                                  className="btn btn-outline-primary"
                                  onClick={() => handleImpersonateOrg(org.id)}
                                  title="Switch to this organization"
                                >
                                  View As
                                </button>
                                <button
                                  className="btn btn-outline-danger"
                                  onClick={() => handleDeleteOrg(org)}
                                  disabled={isLoading}
                                  title="Delete organization"
                                >
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <button
                  className="btn btn-secondary mt-3"
                  onClick={loadData}
                  disabled={isLoading}
                >
                  Refresh
                </button>
              </div>
            )}

            {/* Super Admins Section */}
            {activeSection === 'users' && (
              <div>
                <div className="alert alert-info">
                  <strong>Note:</strong> Super admin management requires direct database access.
                  Use the Supabase dashboard to add/remove entries from the <code>super_admins</code> table.
                </div>

                <h6 style={{ color: '#F8FAFC' }}>How to Add a Super Admin</h6>
                <ol className="mb-4" style={{ color: '#94A3B8' }}>
                  <li>Get the user's UUID from the <code>auth.users</code> table in Supabase</li>
                  <li>Insert into <code>super_admins</code> table:
                    <pre className="p-2 rounded mt-2" style={{ background: 'rgba(30, 41, 59, 0.7)', border: '1px solid rgba(255,255,255,0.1)', color: '#F8FAFC' }}>
{`INSERT INTO super_admins (user_id)
VALUES ('user-uuid-here');`}
                    </pre>
                  </li>
                </ol>

                <h6>Current Super Admins</h6>
                <p className="text-muted small">
                  Query the <code>super_admins</code> table in Supabase to see current super admins.
                </p>
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
