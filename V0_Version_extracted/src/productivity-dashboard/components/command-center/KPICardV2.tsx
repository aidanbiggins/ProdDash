/**
 * KPICard V2 - Tailwind Implementation
 * Matches V0 reference design exactly
 */
import React from 'react';
import { cn } from '../ui-primitives/utils';

type RiskLevel = 'good' | 'warn' | 'bad' | 'neutral';
type Trend = 'up' | 'down' | 'flat';

interface KPICardV2Props {
  label: string;
  value: string | number;
  change?: number;
  trend?: Trend;
  status: RiskLevel;
  helpText?: string;
  onClick?: () => void;
}

const statusConfig: Record<RiskLevel, { bg: string; text: string; label: string }> = {
  good: {
    bg: 'bg-good-bg',
    text: 'text-good-text',
    label: 'On Track',
  },
  warn: {
    bg: 'bg-warn-bg',
    text: 'text-warn-text',
    label: 'At Risk',
  },
  bad: {
    bg: 'bg-bad-bg',
    text: 'text-bad-text',
    label: 'Critical',
  },
  neutral: {
    bg: 'bg-[rgba(100,116,139,0.12)]',
    text: 'text-muted-foreground',
    label: 'Neutral',
  },
};

// Inline SVG icons to avoid dependencies
const TrendUpIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
    <polyline points="17 6 23 6 23 12" />
  </svg>
);

const TrendDownIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" />
    <polyline points="17 18 23 18 23 12" />
  </svg>
);

const MinusIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const HelpIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

export function KPICardV2({ label, value, change, trend, status, helpText, onClick }: KPICardV2Props) {
  const config = statusConfig[status];

  const TrendIcon = trend === 'up' ? TrendUpIcon : trend === 'down' ? TrendDownIcon : MinusIcon;

  // Trend color depends on what's good/bad for this metric
  const trendColor = trend === 'up'
    ? (status === 'good' ? 'text-good' : 'text-bad')
    : trend === 'down'
    ? (status === 'good' ? 'text-good' : 'text-bad')
    : 'text-dim';

  return (
    <div
      className={cn(
        'glass-panel p-4 transition-all duration-150',
        onClick && 'cursor-pointer hover:border-white/[0.15] hover:-translate-y-0.5'
      )}
      onClick={onClick}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {/* Label Row */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        {helpText && (
          <span
            className="text-muted-foreground cursor-help"
            title={helpText}
          >
            <HelpIcon />
          </span>
        )}
      </div>

      {/* Value */}
      <div className="stat-value text-3xl font-semibold text-foreground mb-2">
        {value}
      </div>

      {/* Trend & Status */}
      <div className="flex items-center justify-between">
        {change !== undefined && (
          <div className={cn('flex items-center gap-1 text-sm font-medium', trendColor)}>
            <TrendIcon />
            <span>{change > 0 ? '+' : ''}{change}%</span>
          </div>
        )}
        <div className={cn('px-2 py-0.5 rounded text-xs font-medium', config.bg, config.text)}>
          {config.label}
        </div>
      </div>
    </div>
  );
}

export default KPICardV2;
