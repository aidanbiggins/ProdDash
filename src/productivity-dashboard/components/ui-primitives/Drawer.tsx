/**
 * Drawer - UI Primitive
 * Tailwind-based drawer/sheet component matching V0 reference design
 * Uses native elements for maximum compatibility without Vaul
 */
import React, { useEffect, useCallback } from 'react';
import { cn } from './utils';

export interface DrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  direction?: 'left' | 'right' | 'top' | 'bottom';
}

export function Drawer({
  open,
  onOpenChange,
  children,
  direction = 'right',
}: DrawerProps) {
  // Handle escape key
  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        onOpenChange(false);
      }
    },
    [open, onOpenChange]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [handleEscape]);

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!open) return null;

  return (
    <div data-drawer-direction={direction}>
      {children}
    </div>
  );
}

export interface DrawerOverlayProps extends React.HTMLAttributes<HTMLDivElement> {
  onClose?: () => void;
}

export function DrawerOverlay({
  className,
  onClose,
  ...props
}: DrawerOverlayProps) {
  return (
    <div
      className={cn(
        'fixed inset-0 z-50 bg-black/50 backdrop-blur-sm',
        'animate-fade-in',
        className
      )}
      onClick={onClose}
      {...props}
    />
  );
}

export interface DrawerContentProps extends React.HTMLAttributes<HTMLDivElement> {
  direction?: 'left' | 'right' | 'top' | 'bottom';
}

export function DrawerContent({
  className,
  direction = 'right',
  children,
  ...props
}: DrawerContentProps) {
  const directionClasses = {
    right: 'inset-y-0 right-0 w-full max-w-md border-l animate-slide-in',
    left: 'inset-y-0 left-0 w-full max-w-md border-r',
    top: 'inset-x-0 top-0 h-auto max-h-[80vh] border-b rounded-b-xl',
    bottom: 'inset-x-0 bottom-0 h-auto max-h-[80vh] border-t rounded-t-xl',
  };

  return (
    <div
      className={cn(
        'fixed z-50 flex flex-col',
        'bg-bg-base border-glass-border shadow-glass-elevated',
        directionClasses[direction],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export interface DrawerHeaderProps extends React.HTMLAttributes<HTMLDivElement> {}

export function DrawerHeader({ className, children, ...props }: DrawerHeaderProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-1.5 p-4 border-b border-glass-border',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export interface DrawerTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {}

export function DrawerTitle({ className, children, ...props }: DrawerTitleProps) {
  return (
    <h2
      className={cn('font-semibold text-foreground', className)}
      {...props}
    >
      {children}
    </h2>
  );
}

export interface DrawerDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {}

export function DrawerDescription({ className, children, ...props }: DrawerDescriptionProps) {
  return (
    <p
      className={cn('text-sm text-muted-foreground', className)}
      {...props}
    >
      {children}
    </p>
  );
}

export interface DrawerBodyProps extends React.HTMLAttributes<HTMLDivElement> {}

export function DrawerBody({ className, children, ...props }: DrawerBodyProps) {
  return (
    <div
      className={cn('flex-1 overflow-y-auto p-4', className)}
      {...props}
    >
      {children}
    </div>
  );
}

export interface DrawerFooterProps extends React.HTMLAttributes<HTMLDivElement> {}

export function DrawerFooter({ className, children, ...props }: DrawerFooterProps) {
  return (
    <div
      className={cn(
        'mt-auto flex flex-col gap-2 p-4 border-t border-glass-border',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export interface DrawerCloseProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {}

export function DrawerClose({ className, children, ...props }: DrawerCloseProps) {
  return (
    <button
      type="button"
      className={cn(
        'absolute right-4 top-4 rounded-sm opacity-70',
        'ring-offset-bg-base transition-opacity',
        'hover:opacity-100',
        'focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2',
        'disabled:pointer-events-none',
        className
      )}
      {...props}
    >
      {children || (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4 text-muted-foreground"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      )}
      <span className="sr-only">Close</span>
    </button>
  );
}

export default Drawer;
