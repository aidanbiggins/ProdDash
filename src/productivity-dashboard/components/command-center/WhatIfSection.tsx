// Section 5: What happens if we change something?
// Shows 1-2 precomputed scenario previews with impact and decision ask.

import React from 'react';
import { WhatIfSection as WhatIfData, ScenarioId } from '../../types/commandCenterTypes';

interface WhatIfSectionProps {
  data: WhatIfData;
  onExploreScenario?: (scenarioId: ScenarioId) => void;
}

export const WhatIfSection: React.FC<WhatIfSectionProps> = ({ data, onExploreScenario }) => {
  if (!data.available || data.scenario_previews.length === 0) {
    return (
      <div style={{ padding: '1rem 0', color: 'rgba(255,255,255,0.5)', fontSize: '0.8125rem' }}>
        No relevant scenarios to preview.
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(data.scenario_previews.length, 2)}, 1fr)`, gap: '0.75rem' }}>
      {data.scenario_previews.map(scenario => (
        <div
          key={scenario.scenario_id}
          style={{
            padding: '1rem',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: '8px',
            cursor: onExploreScenario ? 'pointer' : 'default',
          }}
          onClick={() => onExploreScenario?.(scenario.scenario_id)}
        >
          <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'rgba(255,255,255,0.9)', marginBottom: '0.5rem' }}>
            {scenario.title}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)', marginBottom: '0.5rem', lineHeight: 1.4 }}>
            {scenario.impact_summary}
          </div>
          <div style={{ fontSize: '0.6875rem', color: 'rgba(255,255,255,0.4)', marginBottom: '0.75rem' }}>
            {scenario.relevance_reason}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#06b6d4', fontStyle: 'italic' }}>
            {scenario.decision_ask}
          </div>
          {onExploreScenario && (
            <div style={{ marginTop: '0.75rem', fontSize: '0.6875rem', color: '#06b6d4' }}>
              Explore <i className="bi bi-arrow-right" style={{ fontSize: '0.6rem' }} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
