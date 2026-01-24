// Hook to manage the new navigation feature flag and legacy toggle
import { useState, useEffect, useCallback } from 'react';

const FEATURE_FLAG_KEY = 'platovue_feature_new_nav';
const LEGACY_NAV_KEY = 'platovue_use_legacy_nav';

// Feature flag for new navigation (can be overridden for testing)
const DEFAULT_NEW_NAV_ENABLED = true;

export interface UseNewNavigationResult {
  /** Whether the new navigation feature is enabled */
  isNewNavEnabled: boolean;
  /** Whether the user prefers legacy navigation (overrides feature flag) */
  useLegacyNav: boolean;
  /** Toggle legacy navigation preference */
  toggleLegacyNav: () => void;
  /** Enable/disable new navigation feature */
  setNewNavEnabled: (enabled: boolean) => void;
  /** Whether to show the new navigation (feature enabled AND not using legacy) */
  showNewNav: boolean;
}

export function useNewNavigation(): UseNewNavigationResult {
  // Feature flag state
  const [isNewNavEnabled, setIsNewNavEnabled] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem(FEATURE_FLAG_KEY);
      return stored !== null ? stored === 'true' : DEFAULT_NEW_NAV_ENABLED;
    } catch {
      return DEFAULT_NEW_NAV_ENABLED;
    }
  });

  // User preference for legacy nav
  const [useLegacyNav, setUseLegacyNav] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem(LEGACY_NAV_KEY);
      return stored === 'true';
    } catch {
      return false;
    }
  });

  // Persist feature flag
  useEffect(() => {
    try {
      localStorage.setItem(FEATURE_FLAG_KEY, isNewNavEnabled ? 'true' : 'false');
    } catch {
      // Ignore localStorage errors
    }
  }, [isNewNavEnabled]);

  // Persist legacy preference
  useEffect(() => {
    try {
      localStorage.setItem(LEGACY_NAV_KEY, useLegacyNav ? 'true' : 'false');
    } catch {
      // Ignore localStorage errors
    }
  }, [useLegacyNav]);

  const toggleLegacyNav = useCallback(() => {
    setUseLegacyNav(prev => !prev);
  }, []);

  const setNewNavEnabled = useCallback((enabled: boolean) => {
    setIsNewNavEnabled(enabled);
  }, []);

  // Show new nav only if feature is enabled AND user hasn't opted for legacy
  const showNewNav = isNewNavEnabled && !useLegacyNav;

  return {
    isNewNavEnabled,
    useLegacyNav,
    toggleLegacyNav,
    setNewNavEnabled,
    showNewNav
  };
}

export default useNewNavigation;
