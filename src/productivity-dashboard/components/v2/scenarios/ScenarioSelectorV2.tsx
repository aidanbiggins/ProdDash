/**
 * ScenarioSelectorV2
 *
 * Grid of scenario type cards for selecting which scenario to configure.
 * V2 version using glass-panel and Tailwind tokens.
 */

import React from 'react';
import { Users, PauseCircle, UserMinus, ArrowRight } from 'lucide-react';
import { ScenarioId } from '../../../types/scenarioTypes';

interface ScenarioMeta {
  title: string;
  description: string;
  icon: string;
}

interface ScenarioSelectorV2Props {
  scenarios: Record<ScenarioId, ScenarioMeta>;
  onSelect: (scenarioId: ScenarioId) => void;
}

const ICON_MAP: Record<string, typeof Users> = {
  'people-fill': Users,
  'pause-circle-fill': PauseCircle,
  'person-dash-fill': UserMinus,
};

const COLOR_MAP: Record<ScenarioId, string> = {
  spin_up_team: 'text-accent', // Gold
  hiring_freeze: 'text-[#8b5cf6]', // Violet
  recruiter_leaves: 'text-primary', // Cyan
};

export function ScenarioSelectorV2({ scenarios, onSelect }: ScenarioSelectorV2Props) {
  const scenarioIds = Object.keys(scenarios) as ScenarioId[];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {scenarioIds.map((scenarioId) => (
        <ScenarioCard
          key={scenarioId}
          scenarioId={scenarioId}
          meta={scenarios[scenarioId]}
          onSelect={() => onSelect(scenarioId)}
        />
      ))}
    </div>
  );
}

interface ScenarioCardProps {
  scenarioId: ScenarioId;
  meta: ScenarioMeta;
  onSelect: () => void;
}

function ScenarioCard({ scenarioId, meta, onSelect }: ScenarioCardProps) {
  const Icon = ICON_MAP[meta.icon] || Users;
  const colorClass = COLOR_MAP[scenarioId] || 'text-accent';

  return (
    <button
      className="glass-panel p-6 text-left hover:bg-muted/30 transition-colors cursor-pointer group min-h-[44px]"
      onClick={onSelect}
    >
      <div className={`mb-4 ${colorClass}`}>
        <Icon size={40} />
      </div>
      <h4 className="text-lg font-semibold text-foreground mb-2">{meta.title}</h4>
      <p className="text-muted-foreground text-sm mb-4">{meta.description}</p>
      <div className={`flex items-center ${colorClass} group-hover:translate-x-1 transition-transform`}>
        <span className="text-sm font-medium">Configure</span>
        <ArrowRight size={16} className="ml-2" />
      </div>
    </button>
  );
}

export default ScenarioSelectorV2;
