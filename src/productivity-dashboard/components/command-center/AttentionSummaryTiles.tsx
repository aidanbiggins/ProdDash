// Attention Summary Tiles (Front Layer)
// Shows 3-6 aggregated risk buckets for TA leader decisions.
// Each tile: count, severity, confidence, intervention, CTA.
// CTAs route via the centralized attentionNavigationService.

import React from 'react';
import { AttentionSummaryData, AttentionBucket, AttentionBucketId, BucketSeverity } from '../../types/attentionTypes';
import { PressureBar } from './CCVisualPrimitives';

interface AttentionSummaryTilesProps {
  data: AttentionSummaryData;
  onBucketAction?: (bucketId: AttentionBucketId) => void;
  onOpenDrilldown?: () => void;
}

const SEVERITY_COLORS: Record<BucketSeverity, string> = {
  'blocking': '#ef4444',
  'at-risk': '#f59e0b',
  'watch': '#94a3b8',
};

const BUCKET_ICONS: Record<string, string> = {
  'recruiter_throughput': 'bi-people',
  'hm_friction': 'bi-hourglass-split',
  'pipeline_health': 'bi-funnel',
  'aging_stalled': 'bi-clock-history',
  'offer_close_risk': 'bi-envelope-check',
};

export const AttentionSummaryTiles: React.FC<AttentionSummaryTilesProps> = ({
  data,
  onBucketAction,
  onOpenDrilldown,
}) => {
  if (data.allBlocked) {
    return (
      <div className="cc-attention__blocked">
        <div className="cc-attention__blocked-reason">
          {data.blockedReason}
        </div>
      </div>
    );
  }

  if (data.buckets.length === 0) {
    return (
      <div className="cc-attention__empty">
        No attention items detected. Pipeline is flowing.
      </div>
    );
  }

  return (
    <div>
      {/* Summary header */}
      <div className="cc-attention__summary-header">
        <div className="cc-attention__severity-counts">
          {data.buckets.some(b => b.severity === 'blocking') && (
            <span className="cc-attention__severity-tag" style={{ color: SEVERITY_COLORS['blocking'] }}>
              <span className="cc-attention__severity-dot" style={{ backgroundColor: SEVERITY_COLORS['blocking'] }} />
              {data.buckets.filter(b => b.severity === 'blocking').length} blocking
            </span>
          )}
          {data.buckets.some(b => b.severity === 'at-risk') && (
            <span className="cc-attention__severity-tag" style={{ color: SEVERITY_COLORS['at-risk'] }}>
              <span className="cc-attention__severity-dot" style={{ backgroundColor: SEVERITY_COLORS['at-risk'] }} />
              {data.buckets.filter(b => b.severity === 'at-risk').length} at-risk
            </span>
          )}
        </div>
        {onOpenDrilldown && (
          <button
            onClick={onOpenDrilldown}
            className="cc-attention__drilldown-btn"
          >
            Drilldown <i className="bi bi-arrow-right cc-attention__drilldown-arrow" />
          </button>
        )}
      </div>

      {/* Pressure bar */}
      <PressureBar
        blocking={data.buckets.filter(b => b.severity === 'blocking').length}
        atRisk={data.buckets.filter(b => b.severity === 'at-risk').length}
      />

      {/* Bucket tiles */}
      <div className="cc-tile-grid">
        {data.buckets.map(bucket => (
          <BucketTile
            key={bucket.id}
            bucket={bucket}
            onAction={onBucketAction}
          />
        ))}
      </div>
    </div>
  );
};

interface BucketTileProps {
  bucket: AttentionBucket;
  onAction?: (bucketId: AttentionBucketId) => void;
}

const BucketTile: React.FC<BucketTileProps> = ({ bucket, onAction }) => {
  const severityClass = `cc-tile--${bucket.severity}`;
  const confidenceClass = bucket.confidence === 'HIGH'
    ? 'cc-tile__confidence--high'
    : bucket.confidence === 'MED'
    ? 'cc-tile__confidence--med'
    : 'cc-tile__confidence--low';

  return (
    <div className={`cc-tile ${severityClass}`}>
      {/* Top row: icon + label + severity badge */}
      <div className="cc-tile__top-row">
        <i className={BUCKET_ICONS[bucket.id] || 'bi-exclamation-triangle'} style={{ color: SEVERITY_COLORS[bucket.severity] }} />
        <span className="cc-tile__label">
          {bucket.label}
        </span>
        <span className="cc-tile__severity-badge" style={{ color: SEVERITY_COLORS[bucket.severity] }}>
          {bucket.severity}
        </span>
      </div>

      {/* Count + confidence */}
      <div className="cc-tile__count-row">
        <span className="cc-tile__count">
          {bucket.count}
        </span>
        <span className="cc-tile__count-label">
          impacted
        </span>
        <span
          className={`cc-tile__confidence ${confidenceClass}`}
          title={bucket.confidenceReason}
        >
          Data: {bucket.confidence}
        </span>
      </div>

      {/* Top offender line */}
      {bucket.topOffender && (
        <div className="cc-tile__top-offender">
          {bucket.topOffender}
        </div>
      )}

      {/* Intervention + Accountability */}
      <div className="cc-tile__intervention">
        {bucket.intervention}
      </div>
      {bucket.accountability && (
        <div className="cc-tile__accountability">
          <span className="cc-tile__acct-owner">
            {bucket.accountability.owner}
          </span>
          {bucket.accountability.due && (
            <span className="cc-tile__acct-due" style={{ color: SEVERITY_COLORS[bucket.severity] }}>
              {bucket.accountability.due}
            </span>
          )}
        </div>
      )}

      {/* CTA */}
      {onAction && (
        <button
          onClick={() => onAction(bucket.id)}
          className="cc-tile__cta"
          data-testid={`attention-cta-${bucket.id}`}
        >
          {bucket.navigationLabel} <i className="bi bi-arrow-right cc-tile__cta-arrow" />
        </button>
      )}
    </div>
  );
};
