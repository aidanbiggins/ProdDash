// SectionHeader - Davos Glass Design System
import React from 'react';

interface SectionHeaderProps {
  /** Title text or ReactNode (for titles with badges) */
  title: React.ReactNode;
  subtitle?: string;
  /** Optional badge to display next to title */
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export function SectionHeader({
  title,
  subtitle,
  badge,
  actions,
  className = ''
}: SectionHeaderProps) {
  return (
    <div className={`section-header ${className}`}>
      <div>
        <h3 className="section-header-title">
          {title}
          {badge && <span className="ms-2">{badge}</span>}
        </h3>
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
