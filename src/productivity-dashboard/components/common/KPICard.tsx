// KPI Card Component

import React from 'react';
import { useIsMobile } from '../../hooks/useIsMobile';
import { AnimatedStat } from './AnimatedNumber';

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  priorPeriod?: {
    value: number;
    label?: string;  // e.g., "prior 90d"
  };
  /** When set, shows value as "filtered / total" format for contextual comparison */
  contextTotal?: string | number;
  onClick?: () => void;
  lowConfidence?: boolean;
  formula?: string;
  recordCount?: number;
}

export function KPICard({
  title,
  value,
  subtitle,
  trend,
  priorPeriod,
  contextTotal,
  onClick,
  lowConfidence,
  formula,
  recordCount
}: KPICardProps) {
  const isMobile = useIsMobile();

  // Calculate percentage change if we have both current and prior values
  // When prior is 0, we can't calculate a percentage but we can show the comparison
  const percentChange = priorPeriod && typeof value === 'number' && priorPeriod.value > 0
    ? ((value - priorPeriod.value) / priorPeriod.value) * 100
    : null;

  // Flag to show comparison even when prior was 0 (new activity case)
  const showNewComparison = priorPeriod && typeof value === 'number' && priorPeriod.value === 0 && value > 0;

  // Calculate percentage of total when contextTotal is provided
  const percentOfTotal = contextTotal !== undefined && typeof value === 'number' && typeof contextTotal === 'number' && contextTotal > 0
    ? Math.round((value / contextTotal) * 100)
    : null;

  const hasContext = contextTotal !== undefined;

  return (
    <div
      className={`card-bespoke h-full relative animate-fade-in ${onClick ? 'cursor-pointer' : ''} ${lowConfidence ? 'border-warning' : ''} ${hasContext ? 'border-primary border-opacity-25' : ''}`}
      onClick={onClick}
    >
      <div className={`p-4 flex flex-col h-full ${isMobile ? 'p-2' : ''}`}>
        <div className={`flex justify-between items-start mb-1 ${isMobile ? '' : 'min-h-[3rem]'}`}>
          <span className="stat-label leading-tight" title={title}>{title}</span>
          {lowConfidence && (
            <span className="text-warning ml-2" title="Low confidence due to data quality">
              <i className="bi bi-exclamation-triangle-fill"></i>
            </span>
          )}
        </div>

        {/* Subtle accent bar - uses Davos tokens */}
        <div
          className={`stat-accent-line ${isMobile ? 'mb-1' : 'mb-3'}`}
          style={{
            background: hasContext
              ? 'var(--accent)'
              : percentChange !== null
                ? (percentChange >= 0 ? 'var(--success)' : 'var(--danger)')
                : showNewComparison
                  ? 'var(--success)'
                  : 'var(--glass-border)'
          }}
        ></div>

        <div className="flex flex-col h-full">
          {/* Value display - shows "filtered / total" when context is provided */}
          {hasContext ? (
            <div className={isMobile ? 'mb-1' : 'mb-2'} style={{ fontVariantNumeric: 'tabular-nums' }}>
              <AnimatedStat
                value={typeof value === 'number' ? value : value}
                className="stat-value text-primary"
                style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, display: 'inline' }}
              />
              <span style={{ fontSize: isMobile ? '1rem' : '1.25rem', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}> / {contextTotal}</span>
            </div>
          ) : (
            <AnimatedStat
              value={typeof value === 'number' ? value : value}
              className={`stat-value ${isMobile ? 'mb-1' : 'mb-2'}`}
              style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontVariantNumeric: 'tabular-nums', display: 'block' }}
            />
          )}

          <div className={`flex flex-col mt-auto ${isMobile ? 'text-[0.65rem]' : 'text-xs'}`}>
            {/* Show percentage of total when filtered */}
            {percentOfTotal !== null ? (
              <span className="text-primary font-medium">
                {percentOfTotal}% of total
              </span>
            ) : percentChange !== null ? (
              <div className="flex flex-col">
                <span className={`font-bold ${percentChange >= 0 ? 'text-success' : 'text-danger'}`}>
                  <i className={`bi bi-arrow-${percentChange >= 0 ? 'up' : 'down'}-short`}></i>
                  {Math.abs(percentChange).toFixed(0)}%
                </span>
                {priorPeriod && (
                  <span className={`${isMobile ? 'text-[0.7rem]' : 'text-xs'} text-muted-foreground`}>
                    vs {priorPeriod.value} {priorPeriod.label || 'prior period'}
                  </span>
                )}
              </div>
            ) : showNewComparison ? (
              <div className="flex flex-col">
                <span className="font-bold text-success">
                  <i className="bi bi-plus-lg mr-1"></i>
                  {value}
                </span>
                {priorPeriod && (
                  <span className={`${isMobile ? 'text-[0.7rem]' : 'text-xs'} text-muted-foreground`}>
                    vs 0 {priorPeriod.label || 'prior period'}
                  </span>
                )}
              </div>
            ) : !priorPeriod && trend ? (
              <span className={`font-bold ${trend.isPositive ? 'text-success' : 'text-danger'}`}>
                <i className={`bi bi-arrow-${trend.isPositive ? 'up' : 'down'}-short`}></i>
                {Math.abs(trend.value).toFixed(1)}%
              </span>
            ) : (
              <span className="text-muted-foreground">–</span>
            )}
          </div>

          {subtitle && <div className="text-muted-foreground text-xs mt-1">{subtitle}</div>}
        </div>
      </div>
    </div>
  );
}

