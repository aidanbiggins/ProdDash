// TopNav - Main navigation component with 4-bucket structure
import React, { useState, useEffect } from 'react';
import { NavDropdown } from './NavDropdown';
import { MobileDrawer } from './MobileDrawer';
import { QuickFind } from './QuickFind';
import { NAV_STRUCTURE, NavBucket, getActiveBucket, getActiveItem } from './navStructure';
import { getTabFromPath, TabType } from '../../routes';
import './navigation.css';

export interface TopNavProps {
  useLegacyNav: boolean;
  onToggleLegacy: () => void;
  activeTab?: TabType;
  onNavigate?: (tab: TabType) => void;
}

export function TopNav({ useLegacyNav, onToggleLegacy, activeTab, onNavigate }: TopNavProps) {
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [quickFindOpen, setQuickFindOpen] = useState(false);
  const [currentPath, setCurrentPath] = useState(window.location.pathname);

  // Update currentPath when URL changes (for back/forward navigation)
  useEffect(() => {
    const handlePopState = () => setCurrentPath(window.location.pathname);
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const activeBucket = getActiveBucket(currentPath);
  const activeItem = getActiveItem(currentPath);

  // Keyboard shortcut for QuickFind
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+K or Ctrl+K to open QuickFind
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setQuickFindOpen(true);
      }
      // Escape to close QuickFind
      if (e.key === 'Escape' && quickFindOpen) {
        setQuickFindOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [quickFindOpen]);

  const handleNavigation = (route: string) => {
    // Update URL without full page reload
    window.history.pushState({}, '', route);
    setCurrentPath(route);

    // Notify parent component to update tab state
    if (onNavigate) {
      const tab = getTabFromPath(route);
      onNavigate(tab);
    }
  };

  const handleNavClick = (bucket: NavBucket) => {
    if (bucket.submenu && bucket.submenu.length > 0) {
      // Navigate to first submenu item
      handleNavigation(bucket.submenu[0].route);
    } else {
      handleNavigation(bucket.route);
    }
  };

  return (
    <>
      <nav className="top-nav" role="navigation" aria-label="Main navigation">
        <div className="top-nav-container">
          {/* Logo / Brand */}
          <div className="top-nav-brand">
            <button
              className="mobile-menu-toggle"
              onClick={() => setMobileDrawerOpen(true)}
              aria-label="Open navigation menu"
            >
              <i className="bi bi-list" />
            </button>
            <span className="top-nav-logo" onClick={() => handleNavigation('/')}>
              ProdDash
            </span>
          </div>

          {/* Desktop Navigation */}
          <div className="top-nav-items">
            {Object.entries(NAV_STRUCTURE).map(([key, bucket]) => (
              bucket.submenu ? (
                <NavDropdown
                  key={key}
                  label={bucket.label}
                  icon={bucket.icon}
                  items={bucket.submenu}
                  isActive={activeBucket === key}
                  activeItem={activeItem}
                  onNavigate={handleNavigation}
                />
              ) : (
                <button
                  key={key}
                  className={`nav-bucket-btn ${activeBucket === key ? 'active' : ''}`}
                  onClick={() => handleNavClick(bucket)}
                >
                  <i className={`bi ${bucket.icon}`} />
                  <span>{bucket.label}</span>
                </button>
              )
            ))}
          </div>

          {/* Right side actions */}
          <div className="top-nav-actions">
            <button
              className="quick-find-btn"
              onClick={() => setQuickFindOpen(true)}
              aria-label="Quick find (Cmd+K)"
              title="Quick find (Cmd+K)"
            >
              <i className="bi bi-search" />
              <span className="quick-find-hint">Cmd+K</span>
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Drawer */}
      <MobileDrawer
        isOpen={mobileDrawerOpen}
        onClose={() => setMobileDrawerOpen(false)}
        activeBucket={activeBucket}
        activeItem={activeItem}
        useLegacyNav={useLegacyNav}
        onToggleLegacy={onToggleLegacy}
        onNavigate={handleNavigation}
      />

      {/* Quick Find Command Palette */}
      <QuickFind
        isOpen={quickFindOpen}
        onClose={() => setQuickFindOpen(false)}
        onNavigate={handleNavigation}
      />
    </>
  );
}

export default TopNav;
