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
        <div className="page-header-text">
          <div className="page-header-title-row">
            <h1 className="page-header-title">{title}</h1>
            {actions && (
              <div className="page-header-actions">
                {actions}
              </div>
            )}
          </div>
          {subtitle && (
            <p className="page-header-description">{subtitle}</p>
          )}
        </div>
      </div>
    </div>
  );
}
