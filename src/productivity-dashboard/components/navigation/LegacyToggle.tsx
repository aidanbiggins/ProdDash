// LegacyToggle - Toggle to switch between new and legacy navigation
import React from 'react';
import './navigation.css';

const LEGACY_NAV_KEY = 'platovue_use_legacy_nav';

export interface LegacyToggleProps {
  useLegacyNav: boolean;
  onToggle: () => void;
}

export function LegacyToggle({ useLegacyNav, onToggle }: LegacyToggleProps) {
  return (
    <div className="legacy-toggle-wrapper">
      <label className="legacy-toggle">
        <input
          type="checkbox"
          checked={useLegacyNav}
          onChange={onToggle}
        />
        <span className="legacy-toggle-slider" />
        <span className="legacy-toggle-label">Use Classic Navigation</span>
      </label>
    </div>
  );
}

// Utility functions for localStorage
export function getLegacyNavPreference(): boolean {
  try {
    const stored = localStorage.getItem(LEGACY_NAV_KEY);
    return stored === 'true';
  } catch {
    return false;
  }
}

export function setLegacyNavPreference(value: boolean): void {
  try {
    localStorage.setItem(LEGACY_NAV_KEY, value ? 'true' : 'false');
  } catch {
    // Ignore localStorage errors
  }
}

export default LegacyToggle;
