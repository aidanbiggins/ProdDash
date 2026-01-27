import React from 'react';
import { LogoIcon } from './LogoIcon';

interface LogoHeroProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  onClick?: () => void;
}

const SIZE_CONFIG = {
  sm: { icon: 32, text: '1rem', gap: '0.5rem' },
  md: { icon: 48, text: '1.25rem', gap: '0.75rem' },
  lg: { icon: 64, text: '1.5rem', gap: '1rem' },
  xl: { icon: 128, text: '2rem', gap: '1.5rem' },
};

/**
 * LogoHero - Combines the rotating prism LogoIcon with PLATOVUE text
 * Technical Luxury aesthetic with Space Grotesk font
 */
export function LogoHero({ className = '', size = 'md', onClick }: LogoHeroProps) {
  const config = SIZE_CONFIG[size];

  return (
    <div
      className={`logo-hero ${className}`}
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: config.gap,
        cursor: onClick ? 'pointer' : 'default',
        userSelect: 'none',
      }}
    >
      <div style={{ width: config.icon, height: config.icon, flexShrink: 0 }}>
        <LogoIcon size={config.icon} />
      </div>
      <span
        style={{
          fontFamily: "'Space Grotesk', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
          fontWeight: 700,
          fontSize: config.text,
          color: '#ffffff',
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
        }}
      >
        PLATOVUE
      </span>
    </div>
  );
}

export default LogoHero;
