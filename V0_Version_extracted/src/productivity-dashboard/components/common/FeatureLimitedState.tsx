// FeatureLimitedState - Banner for features with partial data
// Shows what's limited and how to get full coverage.
// Used by FeatureGate when a feature is LIMITED.

import React, { useState } from 'react';
import { FeatureCoverageEntry } from '../../types/capabilityTypes';

interface FeatureLimitedStateProps {
  featureEntry: FeatureCoverageEntry;
  displayName?: string;
  /** If true, the banner is dismissible */
  dismissible?: boolean;
}

export function FeatureLimitedState({
  featureEntry,
  displayName,
  dismissible = true,
}: FeatureLimitedStateProps) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  const name = displayName || featureEntry.display_name;
  const repairs = featureEntry.repair_suggestions;
  const limitedReasons = featureEntry.reasons.filter(r => r.length > 0);

  return (
    <div className="feature-limited-banner" style={{
      padding: '0.5rem 0.75rem',
      borderRadius: '3px',
      border: '1px solid var(--color-warn-bg)',
      backgroundColor: 'var(--color-warn-bg)',
      marginBottom: '0.75rem',
      display: 'flex',
      alignItems: 'flex-start',
      gap: '0.5rem',
    }}>
      <i className="bi bi-exclamation-triangle-fill" style={{ color: 'var(--color-warn)', fontSize: '0.875rem', flexShrink: 0, marginTop: '0.1rem' }}></i>
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ color: 'var(--text-heading)', fontSize: '0.8rem', fontWeight: 600 }}>
          {name}: Partial data
        </span>
        {limitedReasons.length > 0 && (
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginLeft: '0.5rem' }}>
            — {limitedReasons[0]}
          </span>
        )}
        {repairs.length > 0 && (
          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'block', marginTop: '0.125rem' }}>
            Fix: {repairs[0].ui_copy.short_title}
          </span>
        )}
      </div>
      {dismissible && (
        <button
          type="button"
          onClick={() => setDismissed(true)}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            fontSize: '1rem',
            padding: 0,
            lineHeight: 1,
          }}
          aria-label="Dismiss"
        >
          &times;
        </button>
      )}
    </div>
  );
}

export default FeatureLimitedState;
