// Section 4: What changed since last week?
// Shows summary sentence + 3-5 material deltas that change plans or forecasts.

import React, { useMemo } from 'react';
import { ChangesSection as ChangesData, DeltaDirection } from '../../../types/commandCenterTypes';
import { computeChangesSummary } from '../../../services/priorityArbitrationService';
import { NetDirectionBadge } from './CCVisualPrimitives';

interface ChangesSectionProps {
  data: ChangesData;
}

const DIRECTION_STYLES: Record<DeltaDirection, { color: string; arrow: string }> = {
  up: { color: 'var(--color-good)', arrow: '\u25B2' },
  down: { color: 'var(--color-bad)', arrow: '\u25BC' },
  flat: { color: 'var(--text-secondary)', arrow: '\u2014' },
};

export const ChangesSection: React.FC<ChangesSectionProps> = ({ data }) => {
  if (!data.available || data.deltas.length === 0) {
    return (
      <div className="cc-changes__empty">
        No material changes this week.
      </div>
    );
  }

  const summary = useMemo(() => computeChangesSummary(data), [data]);

  return (
    <div className="cc-changes__list">
      {/* Summary sentence with net direction */}
      {summary.material_count > 0 && (
        <div className="cc-changes__summary">
          <NetDirectionBadge deltas={data.deltas} />
          {summary.sentence}
        </div>
      )}
      {data.deltas.map((delta, i) => {
        const dirStyle = DIRECTION_STYLES[delta.direction];
        return (
          <div
            key={i}
            className={`cc-changes__delta-row ${delta.material ? 'cc-changes__delta-row--material' : ''}`}
          >
            <span className="cc-changes__delta-arrow" style={{ color: dirStyle.color }}>
              {dirStyle.arrow}
            </span>
            <span className={delta.material ? 'cc-changes__delta-label cc-changes__delta-label--material' : 'cc-changes__delta-label cc-changes__delta-label--minor'}>
              {delta.label}
            </span>
          </div>
        );
      })}
    </div>
  );
};
