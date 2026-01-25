/**
 * Select - UI Primitive
 * Tailwind-based select component matching V0 reference design
 * Uses native select element for maximum compatibility without Radix
 */
import React from 'react';
import { cn } from './utils';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  options: Array<{ value: string; label: string; disabled?: boolean }>;
  placeholder?: string;
}

export function Select({
  className,
  options,
  placeholder,
  ...props
}: SelectProps) {
  return (
    <select
      className={cn(
        // Base styles
        'h-9 w-full min-w-0 rounded-md border border-glass-border',
        'bg-bg-surface/30 px-3 py-1 text-sm text-foreground',
        'shadow-sm transition-all duration-200',
        // Focus styles
        'outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/20',
        // Disabled styles
        'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
        // Appearance
        'appearance-none cursor-pointer',
        'bg-[url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'%2394a3b8\' stroke-width=\'2\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' d=\'M19 9l-7 7-7-7\'/%3E%3C/svg%3E")] bg-[length:16px] bg-[right_8px_center] bg-no-repeat pr-8',
        className
      )}
      {...props}
    >
      {placeholder && (
        <option value="" disabled>
          {placeholder}
        </option>
      )}
      {options.map((option) => (
        <option
          key={option.value}
          value={option.value}
          disabled={option.disabled}
        >
          {option.label}
        </option>
      ))}
    </select>
  );
}

export default Select;
