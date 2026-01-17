/**
 * Scenario Selector
 *
 * Grid of scenario type cards for selecting which scenario to configure.
 */

import React from 'react';
import { GlassPanel } from '../common';
import { ScenarioId } from '../../types/scenarioTypes';

interface ScenarioMeta {
  title: string;
  description: string;
  icon: string;
}

interface ScenarioSelectorProps {
  scenarios: Record<ScenarioId, ScenarioMeta>;
  onSelect: (scenarioId: ScenarioId) => void;
}

export default function ScenarioSelector({ scenarios, onSelect }: ScenarioSelectorProps) {
  const scenarioIds = Object.keys(scenarios) as ScenarioId[];

  return (
    <div className="scenario-selector">
      <div className="scenario-grid">
        {scenarioIds.map(scenarioId => (
          <ScenarioCard
            key={scenarioId}
            scenarioId={scenarioId}
            meta={scenarios[scenarioId]}
            onSelect={() => onSelect(scenarioId)}
          />
        ))}
      </div>
    </div>
  );
}

interface ScenarioCardProps {
  scenarioId: ScenarioId;
  meta: ScenarioMeta;
  onSelect: () => void;
}

function ScenarioCard({ scenarioId, meta, onSelect }: ScenarioCardProps) {
  const colorMap: Record<ScenarioId, string> = {
    spin_up_team: 'var(--accent-primary)', // Gold
    hiring_freeze: 'var(--accent-tertiary)', // Violet
    recruiter_leaves: 'var(--accent-secondary)', // Cyan
  };

  const accentColor = colorMap[scenarioId] || 'var(--accent-primary)';

  return (
    <GlassPanel className="scenario-card" onClick={onSelect}>
      <div className="scenario-card-icon" style={{ color: accentColor }}>
        <i className={`bi bi-${meta.icon}`} />
      </div>
      <h4 className="scenario-card-title">{meta.title}</h4>
      <p className="scenario-card-description">{meta.description}</p>
      <div className="scenario-card-cta">
        <span style={{ color: accentColor }}>
          Configure
          <i className="bi bi-arrow-right ms-2" />
        </span>
      </div>
    </GlassPanel>
  );
}
