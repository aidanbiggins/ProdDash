import React from 'react';
import { LogoIcon } from '../../../components/LogoIcon';

interface LogoSpinnerProps {
  /** Size of the spinner in pixels */
  size?: number;
  /** Optional loading message displayed beside/below the spinner */
  message?: string;
  /** Layout direction: 'inline' shows message beside, 'stacked' shows message below */
  layout?: 'inline' | 'stacked';
  /** Additional class name */
  className?: string;
}

/**
 * LogoSpinner - Branded loading indicator using the rotating dodecahedron logo.
 * Adds a visible Y-axis spin animation on top of the logo's internal rotation.
 * Use instead of Bootstrap spinner-border for content-area loading states.
 */
export function LogoSpinner({
  size = 40,
  message,
  layout = 'inline',
  className = '',
}: LogoSpinnerProps) {
  const isStacked = layout === 'stacked';

  return (
    <div
      className={`logo-spinner ${className}`}
      style={{
        display: 'flex',
        flexDirection: isStacked ? 'column' : 'row',
        alignItems: 'center',
        justifyContent: isStacked ? 'center' : 'flex-start',
        gap: isStacked ? '0.75rem' : '0.5rem',
      }}
    >
      <div
        className="logo-spinner-icon"
        style={{
          width: size,
          height: size,
          flexShrink: 0,
          animation: 'logoBreathe 2s ease-in-out infinite',
        }}
      >
        <LogoIcon size={size} />
      </div>
      {message && (
        <span
          className="logo-spinner-message"
          style={{
            fontSize: size <= 28 ? '0.75rem' : '0.85rem',
            color: 'var(--text-secondary)',
            fontWeight: 500,
          }}
        >
          {message}
        </span>
      )}
    </div>
  );
}

export default LogoSpinner;
