// LegacyToggle - Toggle to switch between new and legacy navigation
import React from 'react';
import { ToggleSwitch } from '../../../components/ui/toggles';
import './navigation.css';

const LEGACY_NAV_KEY = 'platovue_use_legacy_nav';

export interface LegacyToggleProps {
  useLegacyNav: boolean;
  onToggle: () => void;
}

export function LegacyToggle({ useLegacyNav, onToggle }: LegacyToggleProps) {
  return (
    <div className="legacy-toggle-wrapper flex items-center gap-3">
      <ToggleSwitch
        checked={useLegacyNav}
        onChange={onToggle}
        size="sm"
      />
      <span className="text-sm text-white/70">Use Classic Navigation</span>
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
