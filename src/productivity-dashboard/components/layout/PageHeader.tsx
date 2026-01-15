// PageHeader - Consistent page header with title, description, and optional actions
import React from 'react';
import { Link } from 'react-router-dom';
import './layout.css';

export interface Breadcrumb {
  label: string;
  href?: string;
}

export interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  breadcrumbs?: Breadcrumb[];
}

export function PageHeader({ title, description, actions, breadcrumbs }: PageHeaderProps) {
  // Only show parent breadcrumbs (exclude the last one since title already shows current page)
  const parentBreadcrumbs = breadcrumbs && breadcrumbs.length > 1
    ? breadcrumbs.slice(0, -1)
    : null;

  return (
    <div className="page-header">
      {parentBreadcrumbs && parentBreadcrumbs.length > 0 && (
        <nav className="page-header-breadcrumbs" aria-label="Breadcrumb">
          {parentBreadcrumbs.map((crumb, index) => (
            <React.Fragment key={index}>
              {index > 0 && <span className="breadcrumb-separator">/</span>}
              {crumb.href ? (
                <Link to={crumb.href} className="breadcrumb-link">
                  {crumb.label}
                </Link>
              ) : (
                <span className="breadcrumb-link">{crumb.label}</span>
              )}
            </React.Fragment>
          ))}
        </nav>
      )}
      <div className="page-header-content">
        <div className="page-header-text">
          <h1 className="page-header-title">{title}</h1>
          {description && (
            <p className="page-header-description">{description}</p>
          )}
        </div>
        {actions && (
          <div className="page-header-actions">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}

export default PageHeader;
