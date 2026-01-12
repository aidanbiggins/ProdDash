// EmptyState - Davos Glass Design System
import React from 'react';

type EmptyStateType = 'no-data' | 'blocked' | 'error' | 'loading' | 'success';

interface EmptyStateProps {
  type?: EmptyStateType;
  title: string;
  description?: string;
  icon?: string;
  action?: React.ReactNode;
  className?: string;
}

const defaultIcons: Record<EmptyStateType, string> = {
  'no-data': 'inbox',
  'blocked': 'shield-lock',
  'error': 'exclamation-triangle',
  'loading': 'hourglass-split',
  'success': 'check-circle'
};

export function EmptyState({
  type = 'no-data',
  title,
  description,
  icon,
  action,
  className = ''
}: EmptyStateProps) {
  const iconName = icon || defaultIcons[type];

  return (
    <div className={`empty-state ${className}`}>
      <div className="empty-state-icon">
        <i className={`bi bi-${iconName}`}></i>
      </div>
      <h4 className="empty-state-title">{title}</h4>
      {description && (
        <p className="empty-state-description">{description}</p>
      )}
      {action && (
        <div className="mt-4">
          {action}
        </div>
      )}
    </div>
  );
}
