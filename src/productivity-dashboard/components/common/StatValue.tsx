// StatValue - Davos Glass Design System
// Typography component for KPI values (monospace, large, bold)
import React from 'react';

type StatusColor = 'default' | 'primary' | 'success' | 'warning' | 'danger';

interface StatValueProps {
  children: React.ReactNode;
  className?: string;
  color?: StatusColor;
  size?: 'sm' | 'md' | 'lg';
  style?: React.CSSProperties;
}

export function StatValue({
  children,
  className = '',
  color = 'default',
  size = 'md',
  style
}: StatValueProps) {
  const colorClass = color !== 'default' ? `text-${color}` : '';
  const sizeClass = size === 'sm' ? 'stat-value-sm' : size === 'lg' ? 'stat-value-lg' : '';

  return (
    <span className={`stat-value ${colorClass} ${sizeClass} ${className}`.trim()} style={style}>
      {children}
    </span>
  );
}
