// Section 5: What happens if we change something?
// Shows 1-2 precomputed scenario previews with impact and decision ask.

import React from 'react';
import { WhatIfSection as WhatIfData, ScenarioId, ScenarioDelta, BottleneckDiagnosis } from '../../types/commandCenterTypes';

interface WhatIfSectionProps {
  data: WhatIfData;
  bottleneckDiagnosis?: BottleneckDiagnosis;
  onExploreScenario?: (scenarioId: ScenarioId) => void;
}

function getRecommendedScenarioId(diagnosis?: BottleneckDiagnosis): ScenarioId | null {
  if (diagnosis === 'CAPACITY_BOUND') return 'recruiter_leaves';
  if (diagnosis === 'PIPELINE_BOUND') return 'spin_up_team';
  return null;
}

export const WhatIfSection: React.FC<WhatIfSectionProps> = ({ data, bottleneckDiagnosis, onExploreScenario }) => {
  const recommendedId = getRecommendedScenarioId(bottleneckDiagnosis);
  if (!data.available || data.scenario_previews.length === 0) {
    return (
      <div className="cc-whatif__empty">
        No relevant scenarios to preview.
      </div>
    );
  }

  const gridClass = data.scenario_previews.length >= 2 ? 'cc-whatif__grid--double' : 'cc-whatif__grid--single';

  return (
    <div className={`cc-whatif__grid ${gridClass}`}>
      {data.scenario_previews.map(scenario => (
        <div
          key={scenario.scenario_id}
          className={`cc-whatif__card ${onExploreScenario ? 'cc-whatif__card--clickable' : ''}`}
          onClick={() => onExploreScenario?.(scenario.scenario_id)}
          role={onExploreScenario ? 'button' : undefined}
          tabIndex={onExploreScenario ? 0 : undefined}
          onKeyDown={onExploreScenario ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onExploreScenario(scenario.scenario_id); } } : undefined}
        >
          <div className="cc-whatif__card-header">
            <span className="cc-whatif__card-title">
              {scenario.title}
            </span>
            {scenario.scenario_id === recommendedId && (
              <span className="cc-whatif__recommended-badge">
                RECOMMENDED
              </span>
            )}
          </div>
          <div className="cc-whatif__card-impact">
            {scenario.impact_summary}
          </div>
          {scenario.deltas && scenario.deltas.length > 0 && (
            <div className="cc-whatif__card-deltas">
              {scenario.deltas.map((delta, dIdx) => (
                <span
                  key={dIdx}
                  className={`cc-whatif__delta cc-whatif__delta--${delta.sentiment}`}
                >
                  {delta.label}
                </span>
              ))}
            </div>
          )}
          <div className="cc-whatif__card-relevance">
            {scenario.relevance_reason}
          </div>
          <div className="cc-whatif__card-ask">
            {scenario.decision_ask}
          </div>
          {onExploreScenario && (
            <div className="cc-whatif__card-explore">
              Explore <i className="bi bi-arrow-right cc-whatif__card-explore-arrow" />
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
