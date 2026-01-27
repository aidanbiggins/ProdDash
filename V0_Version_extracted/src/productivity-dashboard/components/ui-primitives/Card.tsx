/**
 * Card - UI Primitive
 * Tailwind-based card component matching V0 reference design (glass morphism)
 */
import React from 'react';
import { cn } from './utils';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  elevated?: boolean;
}

export function Card({ className, elevated, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        // Glass panel base
        'flex flex-col gap-4 rounded-xl border border-glass-border',
        'bg-bg-surface backdrop-blur-[12px]',
        elevated ? 'shadow-glass-elevated' : 'shadow-glass',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {}

export function CardHeader({ className, children, ...props }: CardHeaderProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-1.5 px-6 pt-6',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export interface CardTitleProps extends React.HTMLAttributes<HTMLDivElement> {}

export function CardTitle({ className, children, ...props }: CardTitleProps) {
  return (
    <div
      className={cn(
        'font-semibold leading-none text-foreground',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export interface CardDescriptionProps extends React.HTMLAttributes<HTMLDivElement> {}

export function CardDescription({ className, children, ...props }: CardDescriptionProps) {
  return (
    <div
      className={cn(
        'text-sm text-muted-foreground',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export interface CardContentProps extends React.HTMLAttributes<HTMLDivElement> {}

export function CardContent({ className, children, ...props }: CardContentProps) {
  return (
    <div
      className={cn(
        'px-6 pb-6',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export interface CardFooterProps extends React.HTMLAttributes<HTMLDivElement> {}

export function CardFooter({ className, children, ...props }: CardFooterProps) {
  return (
    <div
      className={cn(
        'flex items-center px-6 pb-6 pt-0',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export default Card;
