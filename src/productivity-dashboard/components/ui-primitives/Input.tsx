/**
 * Input - UI Primitive
 * Tailwind-based input component matching V0 reference design
 */
import React from 'react';
import { cn } from './utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export function Input({ className, type = 'text', ...props }: InputProps) {
  return (
    <input
      type={type}
      className={cn(
        // Base styles
        'h-9 w-full min-w-0 rounded-md border border-border',
        'bg-card/30 px-3 py-1 text-sm text-foreground',
        'placeholder:text-muted-foreground',
        'shadow-sm transition-all duration-200',
        // Focus styles
        'outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/20',
        // Disabled styles
        'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
        // File input styles
        'file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground',
        className
      )}
      {...props}
    />
  );
}

export default Input;
