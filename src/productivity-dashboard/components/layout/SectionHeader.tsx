// SectionHeader - Section divider with title and optional expand/collapse
import React, { useState } from 'react';
import './layout.css';

export interface SectionHeaderProps {
  /** Title text or ReactNode. If omitted, children string is used as title (backwards compat). */
  title?: React.ReactNode;
  subtitle?: string;
  /** Optional badge to display next to title */
  badge?: React.ReactNode;
  collapsible?: boolean;
  defaultExpanded?: boolean;
  actions?: React.ReactNode;
  /** When title is provided, children render as collapsible content. When title is omitted, children string is used as the title. */
  children?: React.ReactNode;
  className?: string;
}

export function SectionHeader({
  title,
  subtitle,
  badge,
  collapsible = false,
  defaultExpanded = true,
  actions,
  children,
  className = ''
}: SectionHeaderProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const handleToggle = () => {
    if (collapsible) {
      setIsExpanded(!isExpanded);
    }
  };

  // If no title prop but children is a string, use children as title (backwards compat)
  const resolvedTitle = title || (typeof children === 'string' ? children : undefined);
  const hasContent = title ? children : undefined;

  if (!resolvedTitle) return null;

  return (
    <div className={`section-wrapper ${className}`.trim()}>
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
            {resolvedTitle}
            {badge && <span className="ms-2">{badge}</span>}
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
      {(!collapsible || isExpanded) && hasContent && (
        <div className="section-content">
          {hasContent}
        </div>
      )}
    </div>
  );
}

export default SectionHeader;
