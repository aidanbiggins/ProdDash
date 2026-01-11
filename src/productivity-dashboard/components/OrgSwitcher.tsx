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
    <div className="org-switcher dropdown">
      <button
        className="btn btn-outline-secondary dropdown-toggle d-flex align-items-center gap-2"
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
      >
        <i className="bi bi-building"></i>
        <span className="org-name">{currentOrg?.name || 'Select Organization'}</span>
        {userRole && (
          <span className={`badge ${userRole === 'super_admin' ? 'bg-danger' : userRole === 'admin' ? 'bg-primary' : 'bg-secondary'}`}>
            {roleLabel}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div className="dropdown-backdrop" onClick={() => setIsOpen(false)} />
          <ul className="dropdown-menu show">
            {memberships.length === 0 ? (
              <li>
                <span className="dropdown-item-text text-muted">
                  No organizations
                </span>
              </li>
            ) : (
              memberships.map((membership) => (
                <li key={membership.organization_id}>
                  <button
                    className={`dropdown-item d-flex align-items-center justify-content-between ${
                      membership.organization_id === currentOrg?.id ? 'active' : ''
                    }`}
                    onClick={() => handleSelect(membership.organization_id)}
                  >
                    <span>{membership.organization.name}</span>
                    <span className="badge bg-secondary ms-2">
                      {membership.role}
                    </span>
                  </button>
                </li>
              ))
            )}

            {(hasMultipleOrgs || memberships.length > 0) && <li><hr className="dropdown-divider" /></li>}

            {onOrgSettings && currentOrg && (userRole === 'admin' || userRole === 'super_admin') && (
              <li>
                <button
                  className="dropdown-item d-flex align-items-center gap-2"
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
                  className="dropdown-item d-flex align-items-center gap-2"
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
    <div className="modal fade show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Create New Organization</h5>
            <button type="button" className="btn-close" onClick={onClose} disabled={isLoading}></button>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              {error && (
                <div className="alert alert-danger">{error}</div>
              )}
              <div className="mb-3">
                <label htmlFor="orgName" className="form-label">Organization Name</label>
                <input
                  type="text"
                  className="form-control"
                  id="orgName"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Acme Corporation"
                  autoFocus
                  disabled={isLoading}
                />
                <div className="form-text">
                  This is the name that will be shown to all members.
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isLoading}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={isLoading || !name.trim()}>
                {isLoading ? 'Creating...' : 'Create Organization'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
