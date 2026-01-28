'use client';

// BottleneckStagesPanelV2.tsx
// Displays top bottleneck stages ranked by impact (V2 version)

import React, { useState } from 'react';
import { StageBottleneck, DEFAULT_SLA_POLICIES } from '../../../types/slaTypes';
import { SectionHeader } from '../../common/SectionHeader';
import { HelpButton, HelpDrawer } from '../../common';
import { BOTTLENECK_STAGES_HELP } from '../../_legacy/bottlenecks/bottlenecksHelpContent';

interface BottleneckStagesPanelV2Props {
  stages: StageBottleneck[];
  onStageClick?: (stageKey: string) => void;
}

function getBreachRateColor(rate: number): string {
  if (rate >= 0.4) return 'text-red-500';
  if (rate >= 0.2) return 'text-amber-500';
  return 'text-green-500';
}

function getBreachRateBg(rate: number): string {
  if (rate >= 0.4) return 'text-red-500';
  if (rate >= 0.2) return 'text-amber-500';
  return 'text-green-500';
}

function formatHours(hours: number): string {
  if (hours < 24) {
    return `${hours.toFixed(0)}h`;
  }
  const days = hours / 24;
  return `${days.toFixed(1)}d`;
}

export function BottleneckStagesPanelV2({ stages, onStageClick }: BottleneckStagesPanelV2Props) {
  const [showHelp, setShowHelp] = useState(false);

  if (stages.length === 0) {
    return (
      <div className="glass-panel p-4">
        <SectionHeader
          title="Top Bottleneck Stages"
          actions={<HelpButton onClick={() => setShowHelp(true)} ariaLabel="Help for bottleneck stages" />}
        />
        <HelpDrawer
          isOpen={showHelp}
          onClose={() => setShowHelp(false)}
          title="Top Bottleneck Stages"
          content={BOTTLENECK_STAGES_HELP}
        />
        <div className="py-6 text-center text-muted-foreground">
          <i className="bi bi-check-circle text-3xl opacity-50" />
          <p className="mt-2">
            No significant bottlenecks detected
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-panel p-4">
      <SectionHeader
        title="Top Bottleneck Stages"
        actions={<HelpButton onClick={() => setShowHelp(true)} ariaLabel="Help for bottleneck stages" />}
      />
      <HelpDrawer
        isOpen={showHelp}
        onClose={() => setShowHelp(false)}
        title="Top Bottleneck Stages"
        content={BOTTLENECK_STAGES_HELP}
      />
      <div className="flex flex-col gap-3">
        {stages.slice(0, 5).map((stage, index) => {
          const policy = DEFAULT_SLA_POLICIES.find((p) => p.stage_key === stage.stage_key);
          const slaHours = policy?.sla_hours ?? 72;
          const breachRatePercent = (stage.breach_rate * 100).toFixed(0);
          const colorClass = getBreachRateColor(stage.breach_rate);

          return (
            <div
              key={stage.stage_key}
              onClick={() => onStageClick?.(stage.stage_key)}
              className={`flex items-center justify-between p-3 bg-white/[0.02] rounded-md transition-colors ${
                onStageClick ? 'cursor-pointer hover:bg-white/[0.05]' : ''
              }`}
            >
              {/* Left: Rank + Stage Name + Breach Rate */}
              <div className="flex items-center gap-3">
                <span className="text-lg font-bold text-muted-foreground/70 w-6">
                  {index + 1}.
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">
                      {stage.display_name}
                    </span>
                    <span className={`text-sm font-semibold ${colorClass}`}>
                      {breachRatePercent}%
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Median: {formatHours(stage.median_dwell_hours)} (SLA: {formatHours(slaHours)})
                  </div>
                </div>
              </div>

              {/* Right: Score + Stats */}
              <div className="text-right">
                <div className="text-xs text-muted-foreground/70 uppercase tracking-wide">
                  Score
                </div>
                <div className={`font-mono font-bold text-lg ${colorClass}`}>
                  {stage.bottleneck_score.toFixed(1)}
                </div>
                <div className="text-xs text-muted-foreground">
                  {stage.breach_count}/{stage.candidate_count} breached
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Methodology note */}
      <div className="mt-4 p-3 bg-teal-500/5 rounded text-xs text-muted-foreground">
        <strong>Score formula:</strong> (median_dwell x breach_rate x ln(volume)) / SLA_hours
      </div>
    </div>
  );
}

export default BottleneckStagesPanelV2;
