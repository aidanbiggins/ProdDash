// SectionHeader - Davos Glass Design System
import React from 'react';

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
}

export function SectionHeader({
  title,
  subtitle,
  actions,
  className = ''
}: SectionHeaderProps) {
  return (
    <div className={`section-header ${className}`}>
      <div>
        <h3 className="section-header-title">{title}</h3>
        {subtitle && (
          <p className="section-header-subtitle mb-0">{subtitle}</p>
        )}
      </div>
      {actions && (
        <div className="section-header-actions">
          {actions}
        </div>
      )}
    </div>
  );
}
