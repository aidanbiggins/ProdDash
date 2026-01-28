'use client';

// CoverageBannerV2.tsx
// Displays snapshot coverage status for SLA tracking (V2 version)

import React from 'react';
import { SnapshotCoverage } from '../../../types/slaTypes';

interface CoverageBannerV2Props {
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
  bgClass: string;
  borderClass: string;
  textClass: string;
  iconClass: string;
} {
  switch (status) {
    case 'sufficient':
      return {
        bgClass: 'bg-green-500/10',
        borderClass: 'border-green-500/30',
        textClass: 'text-green-500',
        iconClass: 'bi-check-circle-fill',
      };
    case 'warning':
      return {
        bgClass: 'bg-amber-500/10',
        borderClass: 'border-amber-500/30',
        textClass: 'text-amber-500',
        iconClass: 'bi-exclamation-triangle-fill',
      };
    case 'insufficient':
      return {
        bgClass: 'bg-red-500/10',
        borderClass: 'border-red-500/30',
        textClass: 'text-red-500',
        iconClass: 'bi-x-circle-fill',
      };
    case 'no_data':
    default:
      return {
        bgClass: 'bg-gray-400/10',
        borderClass: 'border-gray-400/30',
        textClass: 'text-gray-400',
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

export function CoverageBannerV2({
  coverage,
  onImportClick,
  onGenerateDemoSnapshots,
  isDemo,
  hasCandidateData,
}: CoverageBannerV2Props) {
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
      className={`coverage-banner flex items-center justify-between p-3 mb-4 rounded-lg border ${styles.bgClass} ${styles.borderClass}`}
    >
      <div className="flex items-center gap-3">
        <i className={`bi ${styles.iconClass} ${styles.textClass} text-xl`} />
        <div>
          <div className={`font-semibold text-sm ${styles.textClass}`}>
            {title}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {details}
          </div>
        </div>
      </div>

      {/* Coverage details (right side) */}
      <div className="flex items-center gap-4">
        {coverage.snapshot_count > 0 && (
          <div className="flex gap-4 text-xs text-muted-foreground">
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
                className="px-3 py-1 text-xs rounded cursor-pointer bg-teal-400 text-black hover:bg-teal-300 transition-colors"
              >
                Generate Snapshots
              </button>
            )}
            {onImportClick && (
              <button
                onClick={onImportClick}
                className={`px-3 py-1 text-xs rounded cursor-pointer text-white ${
                  status === 'insufficient' ? 'bg-red-500 hover:bg-red-600' : 'bg-gray-400 hover:bg-gray-500'
                } transition-colors`}
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

export default CoverageBannerV2;
