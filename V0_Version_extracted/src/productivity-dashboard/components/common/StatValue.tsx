// StatValue - Typography component for KPI values
// Per DECK_UI_UX_REFACTOR_V1.md Section 2.2
import React from 'react';

// Per plan: good/warn/bad semantic colors
type StatusColor = 'default' | 'good' | 'warn' | 'bad' | 'accent'
  // Legacy aliases for backwards compat
  | 'primary' | 'success' | 'warning' | 'danger';

interface StatValueProps {
  children: React.ReactNode;
  className?: string;
  color?: StatusColor;
  size?: 'sm' | 'md' | 'lg';
  style?: React.CSSProperties;
}

// Map legacy color names to new semantic names
const colorMap: Record<StatusColor, string> = {
  default: '',
  good: 'stat-value-good',
  warn: 'stat-value-warn',
  bad: 'stat-value-bad',
  accent: 'text-accent',
  // Legacy aliases
  primary: 'text-accent',
  success: 'stat-value-good',
  warning: 'stat-value-warn',
  danger: 'stat-value-bad',
};

export function StatValue({
  children,
  className = '',
  color = 'default',
  size = 'md',
  style
}: StatValueProps) {
  const colorClass = colorMap[color] || '';
  const sizeClass = size === 'sm' ? 'stat-value-sm' : size === 'lg' ? 'stat-value-lg' : '';

  return (
    <span className={`stat-value ${colorClass} ${sizeClass} ${className}`.trim()} style={style}>
      {children}
    </span>
  );
}
