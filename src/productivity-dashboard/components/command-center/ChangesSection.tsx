// Section 4: What changed since last week?
// Shows 3-5 material deltas that change plans or forecasts.

import React from 'react';
import { ChangesSection as ChangesData, DeltaDirection } from '../../types/commandCenterTypes';

interface ChangesSectionProps {
  data: ChangesData;
}

const DIRECTION_STYLES: Record<DeltaDirection, { color: string; arrow: string }> = {
  up: { color: '#10b981', arrow: '▲' },
  down: { color: '#ef4444', arrow: '▼' },
  flat: { color: '#94a3b8', arrow: '—' },
};

export const ChangesSection: React.FC<ChangesSectionProps> = ({ data }) => {
  if (!data.available || data.deltas.length === 0) {
    return (
      <div style={{ padding: '1rem 0', color: 'rgba(255,255,255,0.5)', fontSize: '0.8125rem' }}>
        No material changes this week.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
      {data.deltas.map((delta, i) => {
        const style = DIRECTION_STYLES[delta.direction];
        return (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.625rem',
              padding: '0.5rem 0.75rem',
              background: delta.material ? 'rgba(255,255,255,0.03)' : 'transparent',
              borderRadius: '6px',
            }}
          >
            <span style={{ color: style.color, fontSize: '0.75rem', width: '1rem', textAlign: 'center' }}>
              {style.arrow}
            </span>
            <span style={{
              fontSize: '0.8125rem',
              color: delta.material ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.6)',
              fontWeight: delta.material ? 500 : 400,
            }}>
              {delta.label}
            </span>
          </div>
        );
      })}
    </div>
  );
};
