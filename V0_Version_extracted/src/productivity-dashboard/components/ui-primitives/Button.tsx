/**
 * Button - UI Primitive
 * Tailwind-based button component matching V0 reference design
 */
import React from 'react';
import { cn } from './utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon' | 'icon-sm' | 'icon-lg';
  asChild?: boolean;
}

const variantClasses: Record<NonNullable<ButtonProps['variant']>, string> = {
  default: 'bg-accent text-bg-base hover:bg-accent-hover',
  destructive: 'bg-bad text-white hover:bg-bad/90',
  outline: 'border border-glass-border bg-transparent hover:bg-bg-surface hover:text-foreground',
  secondary: 'bg-purple text-white hover:bg-purple/80',
  ghost: 'hover:bg-bg-surface hover:text-foreground',
  link: 'text-accent underline-offset-4 hover:underline',
};

const sizeClasses: Record<NonNullable<ButtonProps['size']>, string> = {
  default: 'h-9 px-4 py-2',
  sm: 'h-8 rounded-md px-3 text-sm',
  lg: 'h-10 rounded-md px-6',
  icon: 'h-9 w-9',
  'icon-sm': 'h-8 w-8',
  'icon-lg': 'h-10 w-10',
};

export function Button({
  className,
  variant = 'default',
  size = 'default',
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        // Base styles
        'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium',
        'transition-all duration-200 outline-none',
        'focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-base',
        'disabled:pointer-events-none disabled:opacity-50',
        // Variant styles
        variantClasses[variant],
        // Size styles
        sizeClasses[size],
        className
      )}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}

export default Button;
