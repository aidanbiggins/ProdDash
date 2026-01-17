// HelpButton.tsx
// A small info icon button that triggers the help drawer

import React from 'react';
import './HelpDrawer.css';

export interface HelpButtonProps {
  onClick: () => void;
  ariaLabel?: string;
}

export function HelpButton({ onClick, ariaLabel = 'Open help' }: HelpButtonProps) {
  return (
    <button
      className="help-button"
      onClick={onClick}
      aria-label={ariaLabel}
      type="button"
    >
      <i className="bi bi-info-circle" />
    </button>
  );
}

export default HelpButton;
