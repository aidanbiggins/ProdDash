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
import { LogoSpinner } from './common/LogoSpinner';

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
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" tabIndex={-1}>
        <div className="w-full max-w-lg mx-4">
          <div className="bg-bg-surface border border-glass-border rounded-lg shadow-glass-elevated">
            <div className="flex items-center justify-between p-4 border-b border-glass-border">
              <h5 className="font-semibold text-foreground">Access Denied</h5>
              <button type="button" className="text-muted-foreground hover:text-foreground" onClick={onClose}>&times;</button>
            </div>
            <div className="p-4">
              <div className="p-3 rounded-lg bg-bad/10 border border-bad/30 text-bad">
                You do not have super admin privileges.
              </div>
            </div>
            <div className="flex justify-end gap-2 p-4 border-t border-glass-border">
              <button type="button" className="px-4 py-2 text-sm font-medium rounded-md bg-bg-elevated text-foreground hover:bg-bg-elevated/80" onClick={onClose}>
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" tabIndex={-1}>
      <div className="w-full max-w-5xl mx-4">
        <div className="bg-bg-surface border border-glass-border rounded-lg shadow-glass-elevated">
          <div className="flex items-center justify-between p-4 bg-bad text-white rounded-t-lg">
            <h5 className="font-semibold">Super Admin Panel</h5>
            <button type="button" className="text-white/70 hover:text-white" onClick={onClose}>&times;</button>
          </div>
          <div className="p-4">
            {/* Error/Success Messages */}
            {error && <div className="p-3 rounded-lg bg-bad/10 border border-bad/30 text-bad mb-4">{error}</div>}
            {success && <div className="p-3 rounded-lg bg-good/10 border border-good/30 text-good mb-4">{success}</div>}

            {/* Navigation */}
            <div className="flex gap-1 mb-4 border-b border-glass-border">
              <button
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeSection === 'orgs' ? 'border-accent text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                onClick={() => setActiveSection('orgs')}
              >
                Organizations ({organizations.length})
              </button>
              <button
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeSection === 'users' ? 'border-accent text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                onClick={() => setActiveSection('users')}
              >
                Super Admins
              </button>
            </div>

            {/* Organizations Section */}
            {activeSection === 'orgs' && (
              <div>
                {isLoading ? (
                  <div className="text-center py-4">
                    <LogoSpinner size={40} layout="stacked" />
                  </div>
                ) : organizations.length === 0 ? (
                  <p className="text-muted-foreground">No organizations found</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-glass-border">
                          <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Name</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Slug</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Created</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {organizations.map((org) => (
                          <tr key={org.id} className="border-b border-glass-border hover:bg-bg-elevated/50">
                            <td className="px-3 py-2">
                              <strong className="text-foreground">{org.name}</strong>
                              <br />
                              <code className="text-xs text-muted-foreground">{org.id.slice(0, 8)}...</code>
                            </td>
                            <td className="px-3 py-2"><code className="text-foreground">{org.slug}</code></td>
                            <td className="px-3 py-2 text-xs text-muted-foreground">
                              {new Date(org.created_at).toLocaleDateString()}
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex gap-1">
                                <button
                                  className="px-2 py-1 text-xs font-medium rounded border border-accent text-accent hover:bg-accent hover:text-bg-base transition-colors"
                                  onClick={() => handleImpersonateOrg(org.id)}
                                  title="Switch to this organization"
                                >
                                  View As
                                </button>
                                <button
                                  className="px-2 py-1 text-xs font-medium rounded border border-bad text-bad hover:bg-bad hover:text-white transition-colors disabled:opacity-50"
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
                  className="mt-3 px-4 py-2 text-sm font-medium rounded-md bg-bg-elevated text-foreground hover:bg-bg-elevated/80 disabled:opacity-50"
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
                <div className="p-3 rounded-lg bg-accent/10 border border-accent/30 text-foreground mb-4">
                  <strong>Note:</strong> Super admin management requires direct database access.
                  Use the Supabase dashboard to add/remove entries from the <code className="text-accent">super_admins</code> table.
                </div>

                <h6 className="font-semibold text-foreground mb-2">How to Add a Super Admin</h6>
                <ol className="mb-4 text-muted-foreground list-decimal list-inside space-y-1">
                  <li>Get the user's UUID from the <code className="text-accent">auth.users</code> table in Supabase</li>
                  <li>Insert into <code className="text-accent">super_admins</code> table:
                    <pre className="p-2 rounded mt-2 bg-bg-elevated border border-glass-border text-foreground text-sm">
{`INSERT INTO super_admins (user_id)
VALUES ('user-uuid-here');`}
                    </pre>
                  </li>
                </ol>

                <h6 className="font-semibold text-foreground mb-2">Current Super Admins</h6>
                <p className="text-muted-foreground text-sm">
                  Query the <code className="text-accent">super_admins</code> table in Supabase to see current super admins.
                </p>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 p-4 border-t border-glass-border">
            <button type="button" className="px-4 py-2 text-sm font-medium rounded-md bg-bg-elevated text-foreground hover:bg-bg-elevated/80" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
