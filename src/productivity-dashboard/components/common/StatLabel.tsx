// StatLabel - Davos Glass Design System
// Typography component for KPI labels (uppercase, secondary color)
import React from 'react';

interface StatLabelProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
}

export function StatLabel({
  children,
  className = '',
  title
}: StatLabelProps) {
  return (
    <span className={`stat-label ${className}`} title={title}>
      {children}
    </span>
  );
}
