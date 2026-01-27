// KPI Card V2 - Matches V0 Reference Design
// Clean glass panel with monospace value, trend arrow, and status badge

import React from 'react';

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

// Status to display label mapping
const statusLabels: Record<RiskLevel, string> = {
  good: 'On Track',
  warn: 'At Risk',
  bad: 'Critical',
  neutral: 'Neutral',
};

export function KPICardV2({
  label,
  value,
  change,
  trend,
  status,
  helpText,
  onClick,
}: KPICardV2Props) {
  // Determine trend color based on trend direction AND status
  // If status is good, trends should show good colors
  // If status is bad, reverse trend might be bad
  const getTrendColor = () => {
    if (!trend || trend === 'flat') return 'kpi-card__trend--flat';
    // For "good" status, up is good, down is good
    // For "bad" status, the direction indicating improvement depends on metric
    // We'll simplify: if status is good, any trend is green; if bad, red
    if (status === 'good') return 'kpi-card__trend--up-good';
    if (status === 'bad') return 'kpi-card__trend--down-bad';
    if (status === 'warn') return trend === 'up' ? 'kpi-card__trend--up-bad' : 'kpi-card__trend--down-bad';
    return 'kpi-card__trend--flat';
  };

  return (
    <div
      className={`glass-panel kpi-card ${onClick ? 'kpi-card--clickable' : ''}`}
      onClick={onClick}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {/* Label Row */}
      <div className="kpi-card__label">
        <span>{label}</span>
        {helpText && (
          <span title={helpText}>
            <svg
              className="kpi-card__label-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </span>
        )}
      </div>

      {/* Value */}
      <div className="kpi-card__value">{value}</div>

      {/* Trend & Status */}
      <div className="kpi-card__footer">
        {change !== undefined && trend && (
          <div className={`kpi-card__trend ${getTrendColor()}`}>
            {trend === 'up' && (
              <svg className="kpi-card__trend-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                <polyline points="17 6 23 6 23 12" />
              </svg>
            )}
            {trend === 'down' && (
              <svg className="kpi-card__trend-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" />
                <polyline points="17 18 23 18 23 12" />
              </svg>
            )}
            {trend === 'flat' && (
              <svg className="kpi-card__trend-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            )}
            <span>{change > 0 ? '+' : ''}{change}%</span>
          </div>
        )}
        <div className={`kpi-card__status kpi-card__status--${status}`}>
          {statusLabels[status]}
        </div>
      </div>
    </div>
  );
}

export default KPICardV2;
