// CoverageMapPanel - Full coverage map showing all features and their status
// Displays feature list grouped by area with ENABLED/LIMITED/BLOCKED badges

import React, { useState } from 'react';
import {
  CapabilityEngineResult,
  FeatureCoverageEntry,
  CapabilityReportEntry,
  CapabilityStatus as CapStatus,
  FeatureArea,
} from '../../types/capabilityTypes';

interface CoverageMapPanelProps {
  result: CapabilityEngineResult | null;
  onClose?: () => void;
  onNavigateToImport?: () => void;
  onNavigateToDemo?: () => void;
}

const AREA_LABELS: Record<FeatureArea, string> = {
  control_tower: 'Control Tower',
  overview: 'Overview',
  recruiter_detail: 'Recruiter Detail',
  hm_friction: 'HM Friction',
  hiring_managers: 'Hiring Managers',
  quality: 'Quality',
  sources: 'Source Effectiveness',
  velocity: 'Velocity Insights',
  forecasting: 'Forecasting',
  data_health: 'Data Health',
  capacity: 'Capacity',
  bottlenecks: 'Bottlenecks & SLA',
  ask: 'Ask ProdDash',
  scenarios: 'Scenarios',
  exports: 'Exports',
  engine: 'Engines',
};

const STATUS_BADGE: Record<CapStatus, { color: string; bg: string; label: string }> = {
  ENABLED: { color: '#22c55e', bg: 'rgba(34, 197, 94, 0.15)', label: 'Enabled' },
  LIMITED: { color: '#eab308', bg: 'rgba(234, 179, 8, 0.15)', label: 'Limited' },
  BLOCKED: { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)', label: 'Blocked' },
};

type FilterType = 'all' | 'blocked' | 'limited' | 'enabled';

export function CoverageMapPanel({ result, onClose, onNavigateToImport, onNavigateToDemo }: CoverageMapPanelProps) {
  const [filter, setFilter] = useState<FilterType>('all');
  const [expandedCap, setExpandedCap] = useState<string | null>(null);

  if (!result) return null;

  const { summary, feature_coverage, capability_report, repair_suggestions } = result;

  // Group features by area
  const featuresByArea = new Map<FeatureArea, FeatureCoverageEntry[]>();
  for (const [, feat] of feature_coverage) {
    if (filter !== 'all' && feat.status.toLowerCase() !== filter) continue;
    const existing = featuresByArea.get(feat.area) || [];
    existing.push(feat);
    featuresByArea.set(feat.area, existing);
  }

  return (
    <div className="coverage-map-panel" style={{
      backgroundColor: '#1a1a1a',
      border: '1px solid #27272a',
      borderRadius: '4px',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '1rem 1.25rem',
        borderBottom: '1px solid #27272a',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div>
          <h5 style={{ color: '#e2e8f0', margin: 0, fontSize: '1rem' }}>Coverage Map</h5>
          <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>
            {summary.features_enabled} enabled, {summary.features_limited} limited, {summary.features_blocked} blocked
          </span>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {onNavigateToImport && (
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm"
              onClick={onNavigateToImport}
              style={{ fontSize: '0.75rem' }}
            >
              Import Data
            </button>
          )}
          {onNavigateToDemo && (
            <button
              type="button"
              className="btn btn-outline-primary btn-sm"
              onClick={onNavigateToDemo}
              style={{ fontSize: '0.75rem', borderColor: '#2dd4bf', color: '#2dd4bf' }}
            >
              Load Demo
            </button>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '1.25rem' }}
            >
              &times;
            </button>
          )}
        </div>
      </div>

      {/* Filter tabs */}
      <div style={{
        padding: '0.5rem 1.25rem',
        borderBottom: '1px solid #27272a',
        display: 'flex',
        gap: '0.75rem',
      }}>
        {(['all', 'blocked', 'limited', 'enabled'] as FilterType[]).map(f => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            style={{
              background: 'none',
              border: 'none',
              color: filter === f ? '#2dd4bf' : '#64748b',
              fontSize: '0.75rem',
              fontWeight: filter === f ? 600 : 400,
              cursor: 'pointer',
              padding: '0.25rem 0',
              borderBottom: filter === f ? '2px solid #2dd4bf' : '2px solid transparent',
            }}
          >
            {f === 'all' ? `All (${summary.total_features})` :
             f === 'blocked' ? `Blocked (${summary.features_blocked})` :
             f === 'limited' ? `Limited (${summary.features_limited})` :
             `Enabled (${summary.features_enabled})`}
          </button>
        ))}
      </div>

      {/* Feature list by area */}
      <div style={{ maxHeight: '60vh', overflowY: 'auto', padding: '0.5rem 0' }}>
        {Array.from(featuresByArea.entries()).map(([area, features]) => (
          <div key={area} style={{ marginBottom: '0.5rem' }}>
            <div style={{
              padding: '0.375rem 1.25rem',
              color: '#94a3b8',
              fontSize: '0.6875rem',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}>
              {AREA_LABELS[area] || area}
            </div>
            {features.map(feat => (
              <FeatureRow key={feat.feature_key} feature={feat} />
            ))}
          </div>
        ))}
        {featuresByArea.size === 0 && (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b', fontSize: '0.8rem' }}>
            No features match the current filter.
          </div>
        )}
      </div>

      {/* Repair suggestions footer */}
      {repair_suggestions.length > 0 && filter !== 'enabled' && (
        <div style={{
          padding: '0.75rem 1.25rem',
          borderTop: '1px solid #27272a',
          backgroundColor: 'rgba(45, 212, 191, 0.03)',
        }}>
          <div style={{ color: '#2dd4bf', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.5rem' }}>
            Top actions to unlock more features:
          </div>
          {repair_suggestions.slice(0, 3).map((r, i) => (
            <div key={i} style={{ color: '#94a3b8', fontSize: '0.75rem', marginBottom: '0.25rem' }}>
              {i + 1}. <strong>{r.ui_copy.short_title}</strong> — unlocks {r.what_it_unlocks.length} features
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FeatureRow({ feature }: { feature: FeatureCoverageEntry }) {
  const [expanded, setExpanded] = useState(false);
  const badge = STATUS_BADGE[feature.status];

  return (
    <div>
      <div
        onClick={() => feature.status !== 'ENABLED' && setExpanded(!expanded)}
        style={{
          padding: '0.375rem 1.25rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          cursor: feature.status !== 'ENABLED' ? 'pointer' : 'default',
        }}
      >
        <span style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          backgroundColor: badge.color,
          flexShrink: 0,
        }} />
        <span style={{ color: '#e2e8f0', fontSize: '0.8rem', flex: 1 }}>
          {feature.display_name}
        </span>
        <span style={{
          fontSize: '0.65rem',
          padding: '0.125rem 0.375rem',
          borderRadius: '2px',
          color: badge.color,
          backgroundColor: badge.bg,
          fontWeight: 600,
        }}>
          {badge.label}
        </span>
        {feature.status !== 'ENABLED' && (
          <i className={`bi bi-chevron-${expanded ? 'up' : 'down'}`} style={{ color: '#64748b', fontSize: '0.7rem' }}></i>
        )}
      </div>
      {expanded && feature.status !== 'ENABLED' && (
        <div style={{
          padding: '0.375rem 1.25rem 0.5rem 2.5rem',
          fontSize: '0.75rem',
        }}>
          {feature.reasons.length > 0 && (
            <div style={{ color: '#94a3b8', marginBottom: '0.25rem' }}>
              {feature.reasons.map((r, i) => <div key={i}>• {r}</div>)}
            </div>
          )}
          {feature.repair_suggestions.length > 0 && (
            <div style={{ color: '#64748b', marginTop: '0.25rem' }}>
              Fix: {feature.repair_suggestions.map(r => r.ui_copy.short_title).join(', ')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default CoverageMapPanel;
