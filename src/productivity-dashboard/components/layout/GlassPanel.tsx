// GlassPanel - Standard content container with glass morphism styling
import React from 'react';
import './layout.css';

export interface GlassPanelProps {
  children: React.ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export function GlassPanel({ children, className = '', padding = 'md' }: GlassPanelProps) {
  const paddingClass = padding !== 'none' ? `glass-panel-${padding}` : '';
  return (
    <div className={`glass-panel ${paddingClass} ${className}`.trim()}>
      {children}
    </div>
  );
}

export default GlassPanel;
