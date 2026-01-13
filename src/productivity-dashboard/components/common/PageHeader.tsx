// PageHeader - Davos Glass Design System
// Page-level header with title, subtitle, and optional right actions
import React from 'react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  subtitle,
  actions,
  className = ''
}: PageHeaderProps) {
  return (
    <div className={`page-header ${className}`}>
      <div className="page-header-content">
        <h1 className="page-header-title">{title}</h1>
        {subtitle && (
          <p className="page-header-subtitle">{subtitle}</p>
        )}
      </div>
      {actions && (
        <div className="page-header-actions">
          {actions}
        </div>
      )}
    </div>
  );
}
