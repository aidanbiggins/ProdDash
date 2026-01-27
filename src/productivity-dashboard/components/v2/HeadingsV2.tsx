/**
 * V2 Heading Components
 *
 * Standardized heading components for the V2 design system.
 * These wrap raw h1/h2/h3 tags with consistent Tailwind styling.
 *
 * Usage:
 *   <PageTitle>Command Center</PageTitle>
 *   <SectionTitle>Health Metrics</SectionTitle>
 *   <PanelTitle>Pipeline Funnel</PanelTitle>
 */

import React from 'react';
import { cn } from '../../../lib/utils';

interface HeadingProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Page-level title (h1)
 * Used for main page headers, typically at the top of a tab/view
 */
export function PageTitle({ children, className }: HeadingProps) {
  return (
    <h1
      className={cn(
        'text-xl md:text-2xl font-bold text-foreground tracking-tight',
        className
      )}
    >
      {children}
    </h1>
  );
}

/**
 * Section-level title (h2)
 * Used for major sections within a page
 */
export function SectionTitle({ children, className }: HeadingProps) {
  return (
    <h2
      className={cn(
        'text-base font-semibold text-foreground',
        className
      )}
    >
      {children}
    </h2>
  );
}

/**
 * Panel/card title (h3)
 * Used for panel headers, card titles, smaller sections
 */
export function PanelTitle({ children, className }: HeadingProps) {
  return (
    <h3
      className={cn(
        'text-sm font-semibold text-foreground',
        className
      )}
    >
      {children}
    </h3>
  );
}

/**
 * Small uppercase label heading (h3)
 * Used for KPI labels, stat categories
 */
export function LabelTitle({ children, className }: HeadingProps) {
  return (
    <h3
      className={cn(
        'text-sm font-semibold text-foreground uppercase tracking-wide',
        className
      )}
    >
      {children}
    </h3>
  );
}

/**
 * Tiny uppercase label (h3)
 * Used for very small section labels
 */
export function TinyLabel({ children, className }: HeadingProps) {
  return (
    <h3
      className={cn(
        'text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground',
        className
      )}
    >
      {children}
    </h3>
  );
}

/**
 * Empty state heading (h3)
 * Used in empty/loading states
 */
export function EmptyStateTitle({ children, className }: HeadingProps) {
  return (
    <h3
      className={cn(
        'text-lg font-semibold text-foreground mb-2',
        className
      )}
    >
      {children}
    </h3>
  );
}

/**
 * NoData state heading (h2)
 * Used when no data is available
 */
export function NoDataTitle({ children, className }: HeadingProps) {
  return (
    <h2
      className={cn(
        'text-xl font-semibold text-foreground mb-2',
        className
      )}
    >
      {children}
    </h2>
  );
}
