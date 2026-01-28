// HelpButton.tsx
// A small info icon button that triggers the help drawer
// Consistent styling with V2 SubViewHeader

import React from 'react';
import { HelpCircle } from 'lucide-react';

export interface HelpButtonProps {
  onClick: () => void;
  ariaLabel?: string;
}

export function HelpButton({ onClick, ariaLabel = 'Open help' }: HelpButtonProps) {
  return (
    <button
      className="p-1.5 rounded-md border border-border bg-muted/30 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
      onClick={onClick}
      aria-label={ariaLabel}
      type="button"
    >
      <HelpCircle className="w-4 h-4" />
    </button>
  );
}

export default HelpButton;
