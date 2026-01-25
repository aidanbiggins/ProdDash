// CoverageBanner.tsx
// Displays snapshot coverage status for SLA tracking

import React from 'react';
import { SnapshotCoverage } from '../../types/slaTypes';

interface CoverageBannerProps {
  coverage: SnapshotCoverage;
  onImportClick?: () => void;
  onGenerateDemoSnapshots?: () => void;
  isDemo?: boolean;
  hasCandidateData?: boolean;
}

type CoverageStatus = 'sufficient' | 'warning' | 'insufficient' | 'no_data';

function getCoverageStatus(coverage: SnapshotCoverage): CoverageStatus {
  if (coverage.snapshot_count === 0) {
    return 'no_data';
  }
  if (!coverage.is_sufficient) {
    // Check severity
    if (coverage.snapshot_count < 2) {
      return 'insufficient';
    }
    return 'warning';
  }
  return 'sufficient';
}

function getStatusStyles(status: CoverageStatus): {
  bgColor: string;
  borderColor: string;
  textColor: string;
  iconClass: string;
} {
  switch (status) {
    case 'sufficient':
      return {
        bgColor: 'rgba(34, 197, 94, 0.1)',
        borderColor: 'rgba(34, 197, 94, 0.3)',
        textColor: '#22c55e',
        iconClass: 'bi-check-circle-fill',
      };
    case 'warning':
      return {
        bgColor: 'rgba(245, 158, 11, 0.1)',
        borderColor: 'rgba(245, 158, 11, 0.3)',
        textColor: '#f59e0b',
        iconClass: 'bi-exclamation-triangle-fill',
      };
    case 'insufficient':
      return {
        bgColor: 'rgba(239, 68, 68, 0.1)',
        borderColor: 'rgba(239, 68, 68, 0.3)',
        textColor: '#ef4444',
        iconClass: 'bi-x-circle-fill',
      };
    case 'no_data':
    default:
      return {
        bgColor: 'rgba(156, 163, 175, 0.1)',
        borderColor: 'rgba(156, 163, 175, 0.3)',
        textColor: '#9ca3af',
        iconClass: 'bi-info-circle-fill',
      };
  }
}

function formatDate(date: Date | null): string {
  if (!date) return 'N/A';
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function CoverageBanner({ coverage, onImportClick, onGenerateDemoSnapshots, isDemo, hasCandidateData }: CoverageBannerProps) {
  const status = getCoverageStatus(coverage);
  const styles = getStatusStyles(status);

  const getMessage = (): { title: string; details: string } => {
    switch (status) {
      case 'sufficient':
        return {
          title: 'SLA tracking enabled',
          details: `${coverage.coverage_percent.toFixed(0)}% coverage (${coverage.snapshot_count} snapshots over ${coverage.day_span} days)`,
        };
      case 'warning':
        return {
          title: 'Limited SLA data',
          details: coverage.insufficiency_reasons.join('. '),
        };
      case 'insufficient':
        return {
          title: 'Cannot track SLAs',
          details: coverage.insufficiency_reasons.join('. '),
        };
      case 'no_data':
      default:
        return {
          title: 'No snapshot data available',
          details: 'Import data snapshots to enable SLA tracking',
        };
    }
  };

  const { title, details } = getMessage();

  return (
    <div
      className="coverage-banner flex items-center justify-between p-3 mb-4 rounded-lg"
      style={{
        background: styles.bgColor,
        border: `1px solid ${styles.borderColor}`,
      }}
    >
      <div className="flex items-center gap-3">
        <i
          className={`bi ${styles.iconClass}`}
          style={{ color: styles.textColor, fontSize: '1.25rem' }}
        />
        <div>
          <div
            style={{
              fontWeight: 'var(--font-semibold)',
              color: styles.textColor,
              fontSize: 'var(--text-sm)',
            }}
          >
            {title}
          </div>
          <div
            style={{
              fontSize: 'var(--text-xs)',
              color: 'var(--text-secondary)',
              marginTop: '2px',
            }}
          >
            {details}
          </div>
        </div>
      </div>

      {/* Coverage details (right side) */}
      <div className="flex items-center gap-4">
        {coverage.snapshot_count > 0 && (
          <div className="flex gap-4 text-xs" style={{ color: 'var(--text-secondary)' }}>
            <span>
              <strong>{coverage.snapshot_count}</strong> snapshots
            </span>
            <span>
              <strong>{coverage.event_count}</strong> events
            </span>
            <span>
              {formatDate(coverage.oldest_snapshot)} - {formatDate(coverage.newest_snapshot)}
            </span>
          </div>
        )}

        {(status === 'insufficient' || status === 'no_data') && (
          <div className="flex gap-2">
            {hasCandidateData && onGenerateDemoSnapshots && (
              <button
                onClick={onGenerateDemoSnapshots}
                className="px-3 py-1 text-xs rounded cursor-pointer"
                style={{
                  background: '#2dd4bf',
                  color: '#000',
                }}
              >
                Generate Snapshots
              </button>
            )}
            {onImportClick && (
              <button
                onClick={onImportClick}
                className="px-3 py-1 text-xs rounded cursor-pointer text-white"
                style={{
                  background: styles.textColor,
                }}
              >
                Import Data
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default CoverageBanner;
