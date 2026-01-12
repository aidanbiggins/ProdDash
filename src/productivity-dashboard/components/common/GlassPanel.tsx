// GlassPanel - Davos Glass Design System Core Container
import React from 'react';

interface GlassPanelProps {
  children: React.ReactNode;
  className?: string;
  elevated?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  onClick?: () => void;
}

export function GlassPanel({
  children,
  className = '',
  elevated = false,
  padding = 'md',
  onClick
}: GlassPanelProps) {
  const paddingClass = {
    none: '',
    sm: 'p-2',
    md: 'p-3',
    lg: 'p-4'
  }[padding];

  const baseClass = elevated ? 'glass-panel-elevated' : 'glass-panel';

  return (
    <div
      className={`${baseClass} ${paddingClass} ${className}`}
      onClick={onClick}
      style={onClick ? { cursor: 'pointer' } : undefined}
    >
      {children}
    </div>
  );
}
