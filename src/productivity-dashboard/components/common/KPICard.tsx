// KPI Card Component

import React from 'react';

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
  onClick,
  lowConfidence,
  formula,
  recordCount
}: KPICardProps) {
  // Calculate percentage change if we have both current and prior values
  const percentChange = priorPeriod && typeof value === 'number' && priorPeriod.value > 0
    ? ((value - priorPeriod.value) / priorPeriod.value) * 100
    : null;

  return (
    <div
      className={`card-bespoke h-100 position-relative animate-fade-in ${onClick ? 'cursor-pointer' : ''} ${lowConfidence ? 'border-warning' : ''}`}
      onClick={onClick}
    >
      <div className="card-body p-4 d-flex flex-column h-100">
        <div className="d-flex justify-content-between align-items-start mb-2" style={{ minHeight: '3rem' }}>
          <span className="stat-label" title={title} style={{ lineHeight: '1.2' }}>{title}</span>
          {lowConfidence && (
            <span className="text-warning ms-2" title="Low confidence due to data quality">
              <i className="bi bi-exclamation-triangle-fill"></i>
            </span>
          )}
        </div>

        {/* Subtle accent bar */}
        <div
          className="stat-accent-line mb-3"
          style={{
            background: percentChange !== null
              ? (percentChange >= 0 ? 'var(--color-success)' : 'var(--color-danger)')
              : 'var(--color-slate-200)'
          }}
        ></div>

        <div className="d-flex flex-column h-100">
          <h3 className="stat-value mb-2">{value}</h3>

          <div className="d-flex align-items-center gap-2 mt-auto" style={{ fontSize: '0.75rem', minHeight: '1.2rem' }}>
            {/* Trend & Comparison Grouped */}
            {percentChange !== null ? (
              <div className="d-flex align-items-center flex-nowrap overflow-hidden">
                <span className={`fw-bold me-2 flex-shrink-0 ${percentChange >= 0 ? 'text-success' : 'text-danger'}`}>
                  <i className={`bi bi-arrow-${percentChange >= 0 ? 'up' : 'down'}-short me-0`}></i>
                  {Math.abs(percentChange).toFixed(0)}%
                </span>
                {priorPeriod && (
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

