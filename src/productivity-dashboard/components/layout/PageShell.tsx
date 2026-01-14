// PageShell - Wrapper component providing consistent page structure
import React from 'react';
import './layout.css';

export interface PageShellProps {
  children: React.ReactNode;
  className?: string;
}

export function PageShell({ children, className = '' }: PageShellProps) {
  return (
    <div className={`page-shell ${className}`.trim()}>
      {children}
    </div>
  );
}

export default PageShell;
