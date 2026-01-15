// MobileDrawer - Mobile navigation drawer with collapsible sections
import React, { useState, useEffect, useRef } from 'react';
import { NAV_STRUCTURE, NavBucket } from './navStructure';
import './navigation.css';

export interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activeBucket: string | null;
  activeItem: string | null;
  useLegacyNav: boolean;
  onToggleLegacy: () => void;
  onNavigate?: (route: string) => void;
  userEmail?: string;
  onSignOut?: () => void;
}

export function MobileDrawer({
  isOpen,
  onClose,
  activeBucket,
  activeItem,
  useLegacyNav,
  onToggleLegacy,
  onNavigate,
  userEmail,
  onSignOut
}: MobileDrawerProps) {
  const [expandedBuckets, setExpandedBuckets] = useState<Set<string>>(new Set(['diagnose', 'plan', 'settings']));
  const drawerRef = useRef<HTMLDivElement>(null);

  // Focus trap and escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    // Prevent body scroll when drawer is open
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  const toggleBucket = (bucketKey: string) => {
    setExpandedBuckets(prev => {
      const next = new Set(prev);
      if (next.has(bucketKey)) {
        next.delete(bucketKey);
      } else {
        next.add(bucketKey);
      }
      return next;
    });
  };

  const handleNavigation = (route: string) => {
    if (onNavigate) {
      onNavigate(route);
    }
    onClose();
  };

  const handleBucketClick = (key: string, bucket: NavBucket) => {
    if (bucket.submenu) {
      toggleBucket(key);
    } else {
      handleNavigation(bucket.route);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="mobile-drawer-backdrop"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        className="mobile-drawer"
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
      >
        {/* Header */}
        <div className="mobile-drawer-header">
          <span className="mobile-drawer-title">ProdDash</span>
          <button
            className="mobile-drawer-close"
            onClick={onClose}
            aria-label="Close navigation menu"
          >
            <i className="bi bi-x-lg" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="mobile-drawer-nav">
          {Object.entries(NAV_STRUCTURE).map(([key, bucket]) => (
            <div key={key} className="mobile-nav-bucket">
              <button
                className={`mobile-nav-bucket-header ${activeBucket === key ? 'active' : ''}`}
                onClick={() => handleBucketClick(key, bucket)}
                aria-expanded={bucket.submenu ? expandedBuckets.has(key) : undefined}
              >
                <i className={`bi ${bucket.icon}`} />
                <span>{bucket.label}</span>
                {bucket.submenu && (
                  <i className={`bi bi-chevron-${expandedBuckets.has(key) ? 'down' : 'right'} bucket-chevron`} />
                )}
              </button>

              {bucket.submenu && expandedBuckets.has(key) && (
                <div className="mobile-nav-submenu">
                  {bucket.submenu.map(item => (
                    <button
                      key={item.id}
                      className={`mobile-nav-item ${activeItem === item.id ? 'active' : ''}`}
                      onClick={() => handleNavigation(item.route)}
                    >
                      {activeItem === item.id && <i className="bi bi-check2 item-check" />}
                      <span>{item.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>

        {/* Footer with user info and sign out */}
        <div className="mobile-drawer-footer">
          {userEmail && (
            <div className="mobile-drawer-user">
              <i className="bi bi-person-circle" />
              <span>{userEmail}</span>
            </div>
          )}
          {onSignOut && (
            <button
              className="mobile-drawer-signout"
              onClick={() => {
                onClose();
                onSignOut();
              }}
            >
              <i className="bi bi-box-arrow-right" />
              <span>Sign Out</span>
            </button>
          )}
          <label className="legacy-toggle">
            <input
              type="checkbox"
              checked={useLegacyNav}
              onChange={onToggleLegacy}
            />
            <span>Use Classic Navigation</span>
          </label>
        </div>
      </div>
    </>
  );
}

export default MobileDrawer;
