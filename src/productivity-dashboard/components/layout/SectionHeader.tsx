// SectionHeader - Section divider with title and optional expand/collapse
import React, { useState } from 'react';
import './layout.css';

export interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  collapsible?: boolean;
  defaultExpanded?: boolean;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}

export function SectionHeader({
  title,
  subtitle,
  collapsible = false,
  defaultExpanded = true,
  actions,
  children
}: SectionHeaderProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const handleToggle = () => {
    if (collapsible) {
      setIsExpanded(!isExpanded);
    }
  };

  return (
    <div className="section-wrapper">
      <div
        className={`section-header ${collapsible ? 'section-header-collapsible' : ''}`}
        onClick={collapsible ? handleToggle : undefined}
        role={collapsible ? 'button' : undefined}
        aria-expanded={collapsible ? isExpanded : undefined}
        tabIndex={collapsible ? 0 : undefined}
        onKeyDown={collapsible ? (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleToggle();
          }
        } : undefined}
      >
        <div className="section-header-text">
          <h2 className="section-header-title">
            {collapsible && (
              <i className={`bi ${isExpanded ? 'bi-chevron-down' : 'bi-chevron-right'} section-collapse-icon`} />
            )}
            {title}
          </h2>
          {subtitle && (
            <p className="section-header-subtitle">{subtitle}</p>
          )}
        </div>
        {actions && !collapsible && (
          <div className="section-header-actions">
            {actions}
          </div>
        )}
        {actions && collapsible && isExpanded && (
          <div className="section-header-actions" onClick={(e) => e.stopPropagation()}>
            {actions}
          </div>
        )}
      </div>
      {(!collapsible || isExpanded) && children && (
        <div className="section-content">
          {children}
        </div>
      )}
    </div>
  );
}

export default SectionHeader;
