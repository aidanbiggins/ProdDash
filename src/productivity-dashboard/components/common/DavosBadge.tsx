// DavosBadge - Davos Glass Design System Status Indicators
import React from 'react';

type BadgeVariant = 'success' | 'warning' | 'danger' | 'accent' | 'neutral';

interface DavosBadgeProps {
  variant: BadgeVariant;
  children: React.ReactNode;
  icon?: string;
  className?: string;
}

export function DavosBadge({
  variant,
  children,
  icon,
  className = ''
}: DavosBadgeProps) {
  return (
    <span className={`davos-badge davos-badge-${variant} ${className}`}>
      {icon && <i className={`bi bi-${icon}`}></i>}
      {children}
    </span>
  );
}

// Convenience exports for common status badges
export function SuccessBadge({ children, ...props }: Omit<DavosBadgeProps, 'variant'>) {
  return <DavosBadge variant="success" {...props}>{children}</DavosBadge>;
}

export function WarningBadge({ children, ...props }: Omit<DavosBadgeProps, 'variant'>) {
  return <DavosBadge variant="warning" {...props}>{children}</DavosBadge>;
}

export function DangerBadge({ children, ...props }: Omit<DavosBadgeProps, 'variant'>) {
  return <DavosBadge variant="danger" {...props}>{children}</DavosBadge>;
}

export function AccentBadge({ children, ...props }: Omit<DavosBadgeProps, 'variant'>) {
  return <DavosBadge variant="accent" {...props}>{children}</DavosBadge>;
}

export function NeutralBadge({ children, ...props }: Omit<DavosBadgeProps, 'variant'>) {
  return <DavosBadge variant="neutral" {...props}>{children}</DavosBadge>;
}
