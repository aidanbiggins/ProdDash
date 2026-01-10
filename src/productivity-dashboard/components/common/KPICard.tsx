// KPI Card Component

import React from 'react';
import { useIsMobile } from '../../hooks/useIsMobile';

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
  const percentChange = priorPeriod && typeof value === 'number' && priorPeriod.value > 0
    ? ((value - priorPeriod.value) / priorPeriod.value) * 100
    : null;

  // Calculate percentage of total when contextTotal is provided
  const percentOfTotal = contextTotal !== undefined && typeof value === 'number' && typeof contextTotal === 'number' && contextTotal > 0
    ? Math.round((value / contextTotal) * 100)
    : null;

  const hasContext = contextTotal !== undefined;

  return (
    <div
      className={`card-bespoke h-100 position-relative animate-fade-in ${onClick ? 'cursor-pointer' : ''} ${lowConfidence ? 'border-warning' : ''} ${hasContext ? 'border-primary border-opacity-25' : ''}`}
      onClick={onClick}
    >
      <div className={`card-body d-flex flex-column h-100 ${isMobile ? 'p-2' : 'p-4'}`}>
        <div className="d-flex justify-content-between align-items-start mb-1" style={isMobile ? undefined : { minHeight: '3rem' }}>
          <span className="stat-label" title={title} style={{ lineHeight: '1.2' }}>{title}</span>
          {lowConfidence && (
            <span className="text-warning ms-2" title="Low confidence due to data quality">
              <i className="bi bi-exclamation-triangle-fill"></i>
            </span>
          )}
        </div>

        {/* Subtle accent bar - teal when filtered */}
        <div
          className={`stat-accent-line ${isMobile ? 'mb-1' : 'mb-3'}`}
          style={{
            background: hasContext
              ? 'var(--color-primary)'
              : percentChange !== null
                ? (percentChange >= 0 ? 'var(--color-success)' : 'var(--color-danger)')
                : 'var(--color-slate-200)'
          }}
        ></div>

        <div className="d-flex flex-column h-100">
          {/* Value display - shows "filtered / total" when context is provided */}
          {hasContext ? (
            <div className={isMobile ? 'mb-1' : 'mb-2'}>
              <span className="stat-value text-primary">{value}</span>
              <span className="stat-value text-muted opacity-50" style={{ fontSize: isMobile ? '1rem' : '1.25rem' }}> / {contextTotal}</span>
            </div>
          ) : (
            <h3 className={`stat-value ${isMobile ? 'mb-1' : 'mb-2'}`}>{value}</h3>
          )}

          <div className="d-flex align-items-center gap-2 mt-auto" style={{ fontSize: isMobile ? '0.65rem' : '0.75rem', minHeight: isMobile ? 'unset' : '1.2rem' }}>
            {/* Show percentage of total when filtered */}
            {percentOfTotal !== null ? (
              <span className="text-primary fw-medium">
                {percentOfTotal}% of total
              </span>
            ) : percentChange !== null ? (
              <div className="d-flex align-items-center flex-nowrap overflow-hidden">
                <span className={`fw-bold ${isMobile ? '' : 'me-2'} flex-shrink-0 ${percentChange >= 0 ? 'text-success' : 'text-danger'}`}>
                  <i className={`bi bi-arrow-${percentChange >= 0 ? 'up' : 'down'}-short me-0`}></i>
                  {Math.abs(percentChange).toFixed(0)}%
                </span>
                {!isMobile && priorPeriod && (
                  <span className="text-muted text-truncate" title={`vs ${priorPeriod.value} ${priorPeriod.label}`}>
                    vs {priorPeriod.value} {priorPeriod.label || 'prior period'}
                  </span>
                )}
              </div>
            ) : !priorPeriod && trend ? (
              <div className="d-flex align-items-center">
                <span className={`fw-bold me-2 ${trend.isPositive ? 'text-success' : 'text-danger'}`}>
                  <i className={`bi bi-arrow-${trend.isPositive ? 'up' : 'down'}-short me-0`}></i>
                  {Math.abs(trend.value).toFixed(1)}%
                </span>
              </div>
            ) : (
              <span className="text-muted opacity-50">–</span>
            )}
          </div>

          {subtitle && <div className="text-muted small mt-1 opacity-75">{subtitle}</div>}
        </div>
      </div>
    </div>
  );
}

