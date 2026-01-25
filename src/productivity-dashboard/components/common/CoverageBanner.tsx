// CoverageBanner - Summary banner showing overall data coverage status
// Displays: Full | Partial | Limited with feature counts

import React from 'react';
import { CapabilitySummary } from '../../types/capabilityTypes';

interface CoverageBannerProps {
  summary: CapabilitySummary | null;
  onViewCoverageMap?: () => void;
  onLoadDemo?: () => void;
}

export function CoverageBanner({ summary, onViewCoverageMap, onLoadDemo }: CoverageBannerProps) {
  if (!summary) return null;

  const { overall_status, features_enabled, features_limited, features_blocked, total_features } = summary;

  // Don't show banner if everything is enabled
  if (overall_status === 'full' && features_blocked === 0 && features_limited === 0) {
    return null;
  }

  const statusConfig = {
    full: { icon: 'bi-check-circle-fill', color: '#22c55e', label: 'Full Coverage', bg: 'rgba(34, 197, 94, 0.05)', border: 'rgba(34, 197, 94, 0.2)' },
    partial: { icon: 'bi-exclamation-triangle-fill', color: '#eab308', label: 'Partial Coverage', bg: 'rgba(234, 179, 8, 0.05)', border: 'rgba(234, 179, 8, 0.2)' },
    limited: { icon: 'bi-x-circle-fill', color: '#ef4444', label: 'Limited Coverage', bg: 'rgba(239, 68, 68, 0.05)', border: 'rgba(239, 68, 68, 0.2)' },
  };

  const config = statusConfig[overall_status];

  return (
    <div className="coverage-banner" style={{
      padding: '0.5rem 0.75rem',
      borderRadius: '3px',
      border: `1px solid ${config.border}`,
      backgroundColor: config.bg,
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
      marginBottom: '0.75rem',
    }}>
      <i className={`bi ${config.icon}`} style={{ color: config.color, fontSize: '0.875rem' }}></i>
      <span style={{ color: '#e2e8f0', fontSize: '0.8rem', fontWeight: 600 }}>
        {config.label}
      </span>
      <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>
        {features_enabled}/{total_features} features enabled
        {features_limited > 0 && `, ${features_limited} partial`}
        {features_blocked > 0 && `, ${features_blocked} blocked`}
      </span>
      <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
        {onViewCoverageMap && (
          <button
            type="button"
            className="p-0 no-underline text-sm"
            onClick={onViewCoverageMap}
            style={{ color: '#2dd4bf', fontSize: '0.75rem' }}
          >
            View Coverage Map
          </button>
        )}
        {onLoadDemo && features_blocked > 0 && (
          <button
            type="button"
            className="p-0 no-underline text-sm"
            onClick={onLoadDemo}
            style={{ color: '#d4a373', fontSize: '0.75rem' }}
          >
            Try Demo Data
          </button>
        )}
      </div>
    </div>
  );
}

export default CoverageBanner;
