// Data Coverage Panel - UI component showing snapshot history and capabilities
// See docs/plans/SNAPSHOT_DIFF_EVENT_STREAM_V1.md for full specification

import React, { useEffect, useState, useCallback } from 'react';
import {
  DataCoverageFlags,
  SnapshotSummary
} from '../../types/snapshotTypes';
import { getSnapshotSummaries } from '../../services/snapshotService';
import {
  computeDataCoverage,
  getUnlockedCapabilities,
  getPendingCapabilities
} from '../../services/dataCoverageService';
import { GlassPanel, SectionHeader, LogoSpinner } from '../common';

interface DataCoveragePanelProps {
  orgId: string;
  onImportClick?: () => void;
}

export const DataCoveragePanel: React.FC<DataCoveragePanelProps> = ({
  orgId,
  onImportClick
}) => {
  const [coverage, setCoverage] = useState<DataCoverageFlags | null>(null);
  const [snapshots, setSnapshots] = useState<SnapshotSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [coverageData, snapshotData] = await Promise.all([
        computeDataCoverage(orgId),
        getSnapshotSummaries(orgId)
      ]);
      setCoverage(coverageData);
      setSnapshots(snapshotData);
    } catch (error) {
      console.error('[DataCoveragePanel] Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <GlassPanel>
        <SectionHeader title="Data Coverage" />
        <div className="text-center py-4">
          <LogoSpinner size={32} layout="stacked" />
        </div>
      </GlassPanel>
    );
  }

  if (!coverage) {
    return (
      <GlassPanel>
        <SectionHeader title="Data Coverage" />
        <p className="text-muted">Unable to load coverage data.</p>
      </GlassPanel>
    );
  }

  const unlockedCapabilities = getUnlockedCapabilities(coverage);
  const pendingCapabilities = getPendingCapabilities(coverage);

  return (
    <GlassPanel>
      <SectionHeader
        title="Data Coverage"
        badge={coverage.snapshotCount > 0 ? `${coverage.snapshotCount} snapshots` : undefined}
      />

      {/* Snapshot History */}
      <div className="mb-4">
        {coverage.snapshotCount === 0 ? (
          <div className="alert alert-info mb-3">
            <strong>No snapshots yet.</strong> Import your first data snapshot to start tracking changes.
          </div>
        ) : (
          <>
            <p className="text-muted small mb-2">
              {coverage.snapshotCount} import{coverage.snapshotCount !== 1 ? 's' : ''} over {coverage.daySpan} days
            </p>

            <div className="snapshot-timeline mb-3">
              {snapshots.slice(-5).map((snapshot, index) => (
                <div
                  key={snapshot.id}
                  className="snapshot-item d-flex justify-content-between align-items-center py-2 border-bottom"
                >
                  <div className="d-flex align-items-center">
                    <span className="snapshot-marker me-2">
                      {index === 0 ? '├─' : index === snapshots.slice(-5).length - 1 ? '└─' : '├─'}
                    </span>
                    <span className="text-muted small">
                      {formatDate(snapshot.snapshot_date)}
                      {index === 0 && snapshots.length <= 5 && (
                        <span className="badge bg-secondary ms-2">baseline</span>
                      )}
                      {snapshot.delta_candidates !== undefined && (
                        <span className={`badge ms-2 ${snapshot.delta_candidates >= 0 ? 'bg-success' : 'bg-warning'}`}>
                          {snapshot.delta_candidates >= 0 ? '+' : ''}{snapshot.delta_candidates}
                        </span>
                      )}
                    </span>
                  </div>
                  <span className="text-muted small">
                    {snapshot.candidate_count.toLocaleString()} candidates
                  </span>
                </div>
              ))}
              {snapshots.length > 5 && (
                <div className="text-muted small mt-2">
                  + {snapshots.length - 5} more snapshots
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Capabilities Unlocked */}
      <div className="mb-4">
        <h6 className="text-muted small mb-2">Capabilities Unlocked:</h6>
        <div className="capabilities-list">
          {unlockedCapabilities.map((cap) => (
            <div key={cap} className="capability-item d-flex align-items-center mb-1">
              <span className="text-success me-2">✓</span>
              <span className="small">{cap}</span>
            </div>
          ))}
          {pendingCapabilities.map((cap) => (
            <div key={cap.name} className="capability-item d-flex align-items-center mb-1">
              <span className="text-warning me-2">○</span>
              <span className="small text-muted">
                {cap.name} <span className="opacity-75">({cap.requirement})</span>
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Import Button */}
      {onImportClick && (
        <div className="d-grid">
          <button
            className="btn btn-outline-primary btn-sm"
            onClick={onImportClick}
          >
            Import New Snapshot
          </button>
        </div>
      )}
    </GlassPanel>
  );
};

// ============================================
// GATED FEATURE WRAPPER
// ============================================

interface GatedFeatureProps {
  coverage: DataCoverageFlags;
  requiredCapability: 'hasTrueDwellTime' | 'hasRegressionDetection' | 'hasSLATracking';
  featureName: string;
  children: React.ReactNode;
  onImportClick?: () => void;
}

export const GatedFeature: React.FC<GatedFeatureProps> = ({
  coverage,
  requiredCapability,
  featureName,
  children,
  onImportClick
}) => {
  const isAvailable = coverage[requiredCapability];

  if (isAvailable) {
    return <>{children}</>;
  }

  return (
    <GlassPanel>
      <div className="text-center py-4">
        <div className="mb-3">
          <span className="empty-state-icon">📊</span>
        </div>
        <h5 className="mb-2">{featureName}</h5>
        <p className="text-muted mb-3">
          This feature requires snapshot history.
        </p>
        <p className="small text-muted mb-3">
          Import at least {coverage.minSnapshotsForDwell} data snapshots to unlock:
        </p>
        <ul className="list-unstyled small text-muted mb-3">
          <li>• True stage duration tracking</li>
          <li>• Regression detection</li>
          <li>• SLA compliance metrics</li>
        </ul>
        <p className="small mb-3">
          <strong>You have:</strong> {coverage.snapshotCount} snapshot{coverage.snapshotCount !== 1 ? 's' : ''}
          <br />
          <strong>Need:</strong> {coverage.minSnapshotsForDwell} snapshots (minimum 7 days apart)
        </p>
        {onImportClick && (
          <div className="d-flex gap-2 justify-content-center">
            <button className="btn btn-primary btn-sm" onClick={onImportClick}>
              Import New Snapshot
            </button>
            <button className="btn btn-outline-secondary btn-sm">
              Learn More
            </button>
          </div>
        )}
      </div>
    </GlassPanel>
  );
};

// ============================================
// HELPERS
// ============================================

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

export default DataCoveragePanel;
