// TopNav - Main navigation component with 4-bucket structure
import React, { useState, useEffect, useRef } from 'react';
import { NavDropdown } from './NavDropdown';
import { MobileDrawer } from './MobileDrawer';
import { QuickFind } from './QuickFind';
import { NAV_STRUCTURE, NavBucket, getActiveBucket, getActiveItem } from './navStructure';
import { getTabFromPath, TabType } from '../../routes';
import { useDataMasking } from '../../contexts/DataMaskingContext';
import { useDashboard } from '../../hooks/useDashboardContext';
import './navigation.css';

export interface TopNavProps {
  useLegacyNav: boolean;
  onToggleLegacy: () => void;
  activeTab?: TabType;
  onNavigate?: (tab: TabType) => void;
  userEmail?: string;
  onSignOut?: () => void;
}

export function TopNav({ useLegacyNav, onToggleLegacy, activeTab, onNavigate, userEmail, onSignOut }: TopNavProps) {
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [quickFindOpen, setQuickFindOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [settingsMenuOpen, setSettingsMenuOpen] = useState(false);
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  const settingsRef = useRef<HTMLDivElement>(null);

  // Get PII masking state and dashboard actions
  const { isMasked, toggleMasking } = useDataMasking();
  const { refetchData, state } = useDashboard();

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
      // Escape to close QuickFind or user menu
      if (e.key === 'Escape') {
        if (quickFindOpen) setQuickFindOpen(false);
        if (userMenuOpen) setUserMenuOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [quickFindOpen, userMenuOpen]);

  // Close user menu when clicking outside
  useEffect(() => {
    if (!userMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.nav-dropdown')) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [userMenuOpen]);

  // Close settings menu when clicking outside
  useEffect(() => {
    if (!settingsMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setSettingsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [settingsMenuOpen]);

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
            {Object.entries(NAV_STRUCTURE).map(([key, bucket]) => {
              // Special handling for Settings - custom dropdown with actions
              if (key === 'settings') {
                return (
                  <div
                    key={key}
                    className={`nav-dropdown ${settingsMenuOpen ? 'open' : ''} ${activeBucket === key ? 'active' : ''}`}
                    ref={settingsRef}
                  >
                    <button
                      className="nav-dropdown-trigger"
                      onClick={() => setSettingsMenuOpen(!settingsMenuOpen)}
                      aria-expanded={settingsMenuOpen}
                      aria-haspopup="true"
                    >
                      <i className={`bi ${bucket.icon}`} />
                      <span>{bucket.label}</span>
                      <i className={`bi bi-chevron-${settingsMenuOpen ? 'up' : 'down'} dropdown-chevron`} />
                    </button>

                    {settingsMenuOpen && (
                      <div className="nav-dropdown-menu" role="menu">
                        {/* Quick Actions */}
                        <button
                          className="nav-dropdown-item"
                          onClick={() => { toggleMasking(); }}
                          role="menuitem"
                        >
                          <i className={`bi bi-${isMasked ? 'eye-slash' : 'eye'}`} style={{ opacity: 0.7, width: '16px' }} />
                          <span>{isMasked ? 'Show Real Names' : 'Mask PII'}</span>
                          {isMasked && <i className="bi bi-check2 item-check" />}
                        </button>
                        <button
                          className="nav-dropdown-item"
                          onClick={() => { refetchData(); setSettingsMenuOpen(false); }}
                          role="menuitem"
                          disabled={state.isLoading}
                        >
                          <i className="bi bi-arrow-clockwise" style={{ opacity: 0.7, width: '16px' }} />
                          <span>{state.isLoading ? 'Refreshing...' : 'Refresh Data'}</span>
                        </button>

                        {/* Divider */}
                        <div className="nav-dropdown-divider" />

                        {/* Navigation Items */}
                        {bucket.submenu?.map((item) => (
                          <button
                            key={item.id}
                            className={`nav-dropdown-item ${activeItem === item.id ? 'active' : ''}`}
                            onClick={() => { handleNavigation(item.route); setSettingsMenuOpen(false); }}
                            role="menuitem"
                          >
                            {activeItem === item.id && <i className="bi bi-check2 item-check" />}
                            <span>{item.label}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              }

              // Regular nav items
              return bucket.submenu ? (
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
              );
            })}
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

            {/* User Menu */}
            {onSignOut && (
              <div className="nav-dropdown">
                <button
                  className={`nav-dropdown-trigger ${userMenuOpen ? 'open' : ''}`}
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  aria-expanded={userMenuOpen}
                  aria-haspopup="true"
                >
                  <i className="bi bi-person-circle" />
                  <i className="bi bi-chevron-down dropdown-chevron" />
                </button>
                {userMenuOpen && (
                  <div className="nav-dropdown-menu" style={{ right: 0, left: 'auto' }}>
                    {userEmail && (
                      <div className="nav-dropdown-item" style={{ cursor: 'default', opacity: 0.7 }}>
                        <i className="bi bi-envelope" />
                        <span className="text-sm">{userEmail}</span>
                      </div>
                    )}
                    <button
                      className="nav-dropdown-item"
                      onClick={() => {
                        setUserMenuOpen(false);
                        onSignOut();
                      }}
                    >
                      <i className="bi bi-box-arrow-right" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                )}
              </div>
            )}
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
        userEmail={userEmail}
        onSignOut={onSignOut}
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
