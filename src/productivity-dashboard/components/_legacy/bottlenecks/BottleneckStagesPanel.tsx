// BottleneckStagesPanel.tsx
// Displays top bottleneck stages ranked by impact

import React, { useState } from 'react';
import { StageBottleneck, DEFAULT_SLA_POLICIES } from '../../../types/slaTypes';
import { GlassPanel } from '../layout/GlassPanel';
import { SectionHeader } from '../../common/SectionHeader';
import { HelpButton, HelpDrawer } from '../../common';
import { BOTTLENECK_STAGES_HELP } from './bottlenecksHelpContent';

interface BottleneckStagesPanelProps {
  stages: StageBottleneck[];
  onStageClick?: (stageKey: string) => void;
}

function getBreachRateColor(rate: number): string {
  if (rate >= 0.4) return '#ef4444'; // Red
  if (rate >= 0.2) return '#f59e0b'; // Yellow/Amber
  return '#22c55e'; // Green
}

function getBreachRateEmoji(rate: number): string {
  if (rate >= 0.4) return '🔴';
  if (rate >= 0.2) return '🟡';
  return '🟢';
}

function formatHours(hours: number): string {
  if (hours < 24) {
    return `${hours.toFixed(0)}h`;
  }
  const days = hours / 24;
  return `${days.toFixed(1)}d`;
}

export function BottleneckStagesPanel({ stages, onStageClick }: BottleneckStagesPanelProps) {
  const [showHelp, setShowHelp] = useState(false);

  if (stages.length === 0) {
    return (
      <GlassPanel>
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
        <div
          style={{
            padding: 'var(--space-6)',
            textAlign: 'center',
            color: 'var(--text-secondary)',
          }}
        >
          <i className="bi bi-check-circle" style={{ fontSize: '2rem', opacity: 0.5 }} />
          <p style={{ marginTop: 'var(--space-2)' }}>
            No significant bottlenecks detected
          </p>
        </div>
      </GlassPanel>
    );
  }

  return (
    <GlassPanel>
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        {stages.slice(0, 5).map((stage, index) => {
          const policy = DEFAULT_SLA_POLICIES.find((p) => p.stage_key === stage.stage_key);
          const slaHours = policy?.sla_hours ?? 72;
          const breachRatePercent = (stage.breach_rate * 100).toFixed(0);

          return (
            <div
              key={stage.stage_key}
              onClick={() => onStageClick?.(stage.stage_key)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: 'var(--space-3)',
                background: 'rgba(255, 255, 255, 0.02)',
                borderRadius: 'var(--radius-md)',
                cursor: onStageClick ? 'pointer' : 'default',
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => {
                if (onStageClick) {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)';
              }}
            >
              {/* Left: Rank + Stage Name + Breach Rate */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                <span
                  style={{
                    fontSize: 'var(--text-lg)',
                    fontWeight: 'var(--font-bold)',
                    color: 'var(--text-tertiary)',
                    width: '24px',
                  }}
                >
                  {index + 1}.
                </span>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <span style={{ fontWeight: 'var(--font-medium)' }}>
                      {stage.display_name}
                    </span>
                    <span style={{ fontSize: 'var(--text-sm)' }}>
                      {getBreachRateEmoji(stage.breach_rate)}
                    </span>
                    <span
                      style={{
                        fontSize: 'var(--text-sm)',
                        fontWeight: 'var(--font-semibold)',
                        color: getBreachRateColor(stage.breach_rate),
                      }}
                    >
                      {breachRatePercent}%
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: 'var(--text-xs)',
                      color: 'var(--text-secondary)',
                      marginTop: '2px',
                    }}
                  >
                    Median: {formatHours(stage.median_dwell_hours)} (SLA: {formatHours(slaHours)})
                  </div>
                </div>
              </div>

              {/* Right: Score + Stats */}
              <div style={{ textAlign: 'right' }}>
                <div
                  style={{
                    fontSize: 'var(--text-xs)',
                    color: 'var(--text-tertiary)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  Score
                </div>
                <div
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 'var(--font-bold)',
                    fontSize: 'var(--text-lg)',
                    color: getBreachRateColor(stage.breach_rate),
                  }}
                >
                  {stage.bottleneck_score.toFixed(1)}
                </div>
                <div
                  style={{
                    fontSize: 'var(--text-xs)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  {stage.breach_count}/{stage.candidate_count} breached
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Methodology note */}
      <div
        style={{
          marginTop: 'var(--space-4)',
          padding: 'var(--space-3)',
          background: 'rgba(45, 212, 191, 0.05)',
          borderRadius: 'var(--radius-sm)',
          fontSize: 'var(--text-xs)',
          color: 'var(--text-secondary)',
        }}
      >
        <strong>Score formula:</strong> (median_dwell × breach_rate × ln(volume)) / SLA_hours
      </div>
    </GlassPanel>
  );
}

export default BottleneckStagesPanel;
