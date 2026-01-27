// Organization Switcher Component
// Dropdown in header for switching between organizations

import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Organization } from '../types/auth';

interface OrgSwitcherProps {
  onCreateOrg?: () => void;
  onOrgSettings?: () => void;
}

export function OrgSwitcher({ onCreateOrg, onOrgSettings }: OrgSwitcherProps) {
  const { user, currentOrg, switchOrganization, userRole } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  if (!user) return null;

  const memberships = user.memberships || [];
  const hasMultipleOrgs = memberships.length > 1;

  const handleSelect = (orgId: string) => {
    switchOrganization(orgId);
    setIsOpen(false);
  };

  const roleLabel = userRole === 'super_admin' ? 'Super Admin' : userRole === 'admin' ? 'Admin' : 'Member';

  return (
    <div className="org-switcher relative">
      <button
        className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md border border-glass-border text-foreground hover:bg-bg-elevated transition-colors"
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
      >
        <i className="bi bi-building"></i>
        <span className="org-name max-w-[200px] overflow-hidden text-ellipsis whitespace-nowrap">{currentOrg?.name || 'Select Organization'}</span>
        {userRole && (
          <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded ${userRole === 'super_admin' ? 'bg-bad text-white' : userRole === 'admin' ? 'bg-accent text-bg-base' : 'bg-bg-elevated text-muted-foreground'}`}>
            {roleLabel}
          </span>
        )}
        <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-[1000]" onClick={() => setIsOpen(false)} />
          <ul className="absolute top-full left-0 z-[1001] mt-1 min-w-[250px] py-1 bg-bg-surface border border-glass-border rounded-md shadow-glass-elevated">
            {memberships.length === 0 ? (
              <li className="px-3 py-2 text-sm text-muted-foreground">
                No organizations
              </li>
            ) : (
              memberships.map((membership) => (
                <li key={membership.organization_id}>
                  <button
                    className={`w-full flex items-center justify-between px-3 py-2 text-sm text-left transition-colors ${
                      membership.organization_id === currentOrg?.id ? 'bg-accent text-bg-base' : 'text-foreground hover:bg-bg-elevated'
                    }`}
                    onClick={() => handleSelect(membership.organization_id)}
                  >
                    <span>{membership.organization.name}</span>
                    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded ${membership.organization_id === currentOrg?.id ? 'bg-white/30' : 'bg-bg-elevated text-muted-foreground'}`}>
                      {membership.role}
                    </span>
                  </button>
                </li>
              ))
            )}

            {(hasMultipleOrgs || memberships.length > 0) && <li className="my-1 border-t border-glass-border" />}

            {onOrgSettings && currentOrg && (userRole === 'admin' || userRole === 'super_admin') && (
              <li>
                <button
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-bg-elevated transition-colors"
                  onClick={() => {
                    onOrgSettings();
                    setIsOpen(false);
                  }}
                >
                  <i className="bi bi-gear"></i>
                  Organization Settings
                </button>
              </li>
            )}

            {onCreateOrg && (
              <li>
                <button
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-bg-elevated transition-colors"
                  onClick={() => {
                    onCreateOrg();
                    setIsOpen(false);
                  }}
                >
                  <i className="bi bi-plus-circle"></i>
                  Create New Organization
                </button>
              </li>
            )}
          </ul>
        </>
      )}

      <style>{`
        .org-switcher {
          position: relative;
        }
        .org-switcher .dropdown-backdrop {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          z-index: 1000;
        }
        .org-switcher .dropdown-menu {
          position: absolute;
          top: 100%;
          left: 0;
          z-index: 1001;
          min-width: 250px;
          margin-top: 4px;
        }
        .org-switcher .org-name {
          max-width: 200px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .org-switcher .dropdown-item.active {
          background-color: var(--bs-primary);
          color: white;
        }
        .org-switcher .dropdown-item.active .badge {
          background-color: rgba(255,255,255,0.3) !important;
        }
      `}</style>
    </div>
  );
}

// Create Organization Modal Component
interface CreateOrgModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string) => Promise<void>;
}

export function CreateOrgModal({ isOpen, onClose, onCreate }: CreateOrgModalProps) {
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Organization name is required');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await onCreate(name.trim());
      setName('');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create organization');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" tabIndex={-1}>
      <div className="w-full max-w-md mx-4">
        <div className="bg-bg-surface border border-glass-border rounded-lg shadow-glass-elevated">
          <div className="flex items-center justify-between p-4 border-b border-glass-border">
            <h5 className="font-semibold text-foreground">Create New Organization</h5>
            <button type="button" className="text-muted-foreground hover:text-foreground disabled:opacity-50" onClick={onClose} disabled={isLoading}>&times;</button>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="p-4">
              {error && (
                <div className="p-3 rounded-lg bg-bad/10 border border-bad/30 text-bad mb-4">{error}</div>
              )}
              <div className="mb-3">
                <label htmlFor="orgName" className="block text-xs font-medium text-muted-foreground mb-1">Organization Name</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 text-sm bg-bg-surface/30 border border-glass-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:opacity-50"
                  id="orgName"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Acme Corporation"
                  autoFocus
                  disabled={isLoading}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  This is the name that will be shown to all members.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 p-4 border-t border-glass-border">
              <button type="button" className="px-4 py-2 text-sm font-medium rounded-md bg-bg-elevated text-foreground hover:bg-bg-elevated/80 disabled:opacity-50" onClick={onClose} disabled={isLoading}>
                Cancel
              </button>
              <button type="submit" className="px-4 py-2 text-sm font-medium rounded-md bg-accent text-bg-base hover:bg-accent-hover disabled:opacity-50" disabled={isLoading || !name.trim()}>
                {isLoading ? 'Creating...' : 'Create Organization'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
