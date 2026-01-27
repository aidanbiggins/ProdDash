// GlassPanel - Standard content container with glass morphism styling
// Per DECK_UI_UX_REFACTOR_V1.md Section 2.2
import React from 'react';
import './layout.css';

export interface GlassPanelProps {
  children: React.ReactNode;
  className?: string;
  elevated?: boolean;               // Higher contrast for modals
  padding?: 'none' | 'sm' | 'md' | 'lg';
  onClick?: () => void;             // Makes panel interactive
}

export function GlassPanel({
  children,
  className = '',
  elevated = false,
  padding = 'md',
  onClick,
}: GlassPanelProps) {
  const paddingClass = padding !== 'none' ? `glass-panel-${padding}` : '';
  const elevatedClass = elevated ? 'glass-panel-elevated' : '';
  const interactiveClass = onClick ? 'interactive' : '';

  return (
    <div
      className={`glass-panel ${paddingClass} ${elevatedClass} ${interactiveClass} ${className}`.trim()}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); } : undefined}
    >
      {children}
    </div>
  );
}

export default GlassPanel;
