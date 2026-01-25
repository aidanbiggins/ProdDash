/**
 * Badge - UI Primitive
 * Tailwind-based badge component matching V0 reference design
 */
import React from 'react';
import { cn } from './utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'good' | 'warn' | 'bad';
}

const variantClasses: Record<NonNullable<BadgeProps['variant']>, string> = {
  default: 'border-transparent bg-accent text-bg-base',
  secondary: 'border-transparent bg-purple text-white',
  destructive: 'border-transparent bg-bad text-white',
  outline: 'text-foreground border-glass-border',
  good: 'border-transparent bg-good-bg text-good-text border border-good-border',
  warn: 'border-transparent bg-warn-bg text-warn-text border border-warn-border',
  bad: 'border-transparent bg-bad-bg text-bad-text border border-bad-border',
};

export function Badge({
  className,
  variant = 'default',
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        // Base styles
        'inline-flex items-center justify-center rounded-md border px-2 py-0.5 text-xs font-medium',
        'w-fit whitespace-nowrap transition-colors',
        // Variant styles
        variantClasses[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}

export default Badge;
