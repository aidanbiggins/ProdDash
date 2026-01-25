// FeatureBlockedState - Consistent blocked state component
// Shows what's blocked, why, what to upload, and what it unlocks.
// Used by FeatureGate when a feature is BLOCKED.

import React from 'react';
import { FeatureCoverageEntry, RepairSuggestionEntry } from '../../types/capabilityTypes';

interface FeatureBlockedStateProps {
  featureEntry: FeatureCoverageEntry;
  variant?: 'panel' | 'card' | 'inline';
  displayName?: string;
}

export function FeatureBlockedState({
  featureEntry,
  variant = 'panel',
  displayName,
}: FeatureBlockedStateProps) {
  const name = displayName || featureEntry.display_name;
  const repairs = featureEntry.repair_suggestions;

  if (variant === 'inline') {
    return (
      <span className="feature-blocked-inline text-muted-foreground text-[0.8rem]">
        <i className="bi bi-lock-fill mr-1" style={{ color: 'var(--color-bad)' }}></i>
        {name}: Not enough data
      </span>
    );
  }

  if (variant === 'card') {
    return (
      <div className="feature-blocked-card p-4 rounded border border-[var(--color-bad-bg)] bg-[var(--color-bad-bg)]">
        <div className="flex items-center gap-2 mb-2">
          <i className="bi bi-lock-fill" style={{ color: 'var(--color-bad)' }}></i>
          <strong className="text-[0.875rem]" style={{ color: 'var(--text-heading)' }}>{name}</strong>
        </div>
        <p className="mb-2 text-[0.8rem]" style={{ color: 'var(--text-secondary)' }}>
          {featureEntry.reasons[0] || 'Not enough data to display this feature.'}
        </p>
        {repairs.length > 0 && (
          <RepairList repairs={repairs} compact />
        )}
      </div>
    );
  }

  // Panel variant (default, full-width)
  return (
    <div className="feature-blocked-panel p-6 rounded border border-[var(--color-bad-bg)] bg-[var(--color-bad-bg)] my-2">
      <div className="flex items-center gap-2 mb-3">
        <i className="bi bi-lock-fill text-[1.25rem]" style={{ color: 'var(--color-bad)' }}></i>
        <h5 className="m-0 text-base" style={{ color: 'var(--text-heading)' }}>
          {name} — Not Enough Data
        </h5>
      </div>

      {featureEntry.reasons.length > 0 && (
        <div className="mb-3">
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem', marginBottom: '0.5rem' }}>
            <strong>Why it's blocked:</strong>
          </p>
          <ul style={{ paddingLeft: '1.25rem', margin: 0 }}>
            {featureEntry.reasons.map((reason, i) => (
              <li key={i} style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem', marginBottom: '0.25rem' }}>
                {reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      {repairs.length > 0 && (
        <RepairList repairs={repairs} />
      )}
    </div>
  );
}

// ============================================
// RepairList sub-component
// ============================================

function RepairList({ repairs, compact = false }: { repairs: RepairSuggestionEntry[]; compact?: boolean }) {
  if (compact) {
    return (
      <div>
        <span style={{ color: 'var(--accent)', fontSize: '0.75rem', fontWeight: 600 }}>
          To unlock:
        </span>
        {repairs.slice(0, 2).map((r, i) => (
          <span key={i} style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginLeft: '0.5rem' }}>
            {r.ui_copy.short_title}
            {i < Math.min(repairs.length, 2) - 1 && ','}
          </span>
        ))}
      </div>
    );
  }

  return (
    <div>
      <p style={{ color: 'var(--accent)', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.5rem' }}>
        How to fix:
      </p>
      {repairs.map((repair, i) => (
        <div key={i} className="repair-item mb-2" style={{
          padding: '0.75rem',
          borderRadius: '3px',
          backgroundColor: 'var(--accent-bg)',
          border: '1px solid var(--accent-bg)',
        }}>
          <div style={{ color: 'var(--text-heading)', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.25rem' }}>
            {repair.ui_copy.short_title}
          </div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginBottom: '0.25rem' }}>
            {repair.why_it_matters}
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>
            <strong>Columns needed:</strong> {repair.required_columns.join(', ')}
            {repair.column_aliases.length > 0 && (
              <span> (also accepts: {repair.column_aliases.slice(0, 3).join(', ')})</span>
            )}
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem', marginTop: '0.25rem' }}>
            <strong>Unlocks:</strong> {repair.what_it_unlocks.join(', ')}
          </div>
        </div>
      ))}
    </div>
  );
}

export default FeatureBlockedState;
