/**
 * Bottlenecks Card
 *
 * Displays the top constraints blocking or risking scenario success.
 */

import React from 'react';
import { GlassPanel, SectionHeader } from '../../common';
import { Bottleneck } from '../../../types/scenarioTypes';

interface BottlenecksCardProps {
  bottlenecks: Bottleneck[];
  className?: string;
}

const SEVERITY_CONFIG: Record<string, { icon: string; color: string }> = {
  CRITICAL: { icon: 'exclamation-octagon-fill', color: 'danger' },
  HIGH: { icon: 'exclamation-triangle-fill', color: 'warning' },
  MEDIUM: { icon: 'exclamation-circle-fill', color: 'info' },
};

const CONSTRAINT_LABELS: Record<string, string> = {
  CAPACITY_GAP: 'Capacity Gap',
  PIPELINE_DEPTH: 'Pipeline Depth',
  VELOCITY_DECAY: 'Velocity Decay',
  HM_FRICTION: 'HM Friction',
  FORECAST_CONFIDENCE: 'Low Confidence',
  MISSING_DATA: 'Missing Data',
};

export default function BottlenecksCard({ bottlenecks, className = '' }: BottlenecksCardProps) {
  return (
    <GlassPanel className={className}>
      <SectionHeader
        title="Bottlenecks"
        badge={bottlenecks.length > 0 ? `${bottlenecks.length} identified` : undefined}
      />

      {bottlenecks.length === 0 ? (
        <p className="text-muted-foreground mb-0">
          <i className="bi bi-check-circle mr-2 text-green-400" />
          No major bottlenecks identified
        </p>
      ) : (
        <div className="bottlenecks-list">
          {bottlenecks.map((bottleneck, idx) => {
            const config = SEVERITY_CONFIG[bottleneck.severity] || SEVERITY_CONFIG.MEDIUM;

            const colorClasses: Record<string, { text: string; bg: string }> = {
              danger: { text: 'text-red-400', bg: 'bg-red-500/20 text-red-400' },
              warning: { text: 'text-yellow-400', bg: 'bg-yellow-500/20 text-yellow-400' },
              info: { text: 'text-blue-400', bg: 'bg-blue-500/20 text-blue-400' },
            };
            const colors = colorClasses[config.color] || colorClasses.info;

            return (
              <div key={idx} className="bottleneck-item mb-3">
                <div className="flex items-start">
                  <span className="bottleneck-rank mr-2 text-muted-foreground">#{bottleneck.rank}</span>
                  <div className="grow">
                    <div className="flex items-center mb-1">
                      <i className={`bi bi-${config.icon} ${colors.text} mr-2`} />
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colors.bg} mr-2`}>
                        {bottleneck.severity}
                      </span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-500/20 text-muted-foreground">
                        {CONSTRAINT_LABELS[bottleneck.constraint_type] || bottleneck.constraint_type}
                      </span>
                    </div>
                    <p className="mb-1">{bottleneck.description}</p>
                    <div className="bottleneck-evidence text-sm text-muted-foreground">
                      <i className="bi bi-graph-up mr-1" />
                      {bottleneck.evidence.metric_key}: {bottleneck.evidence.current_value}
                      {' '}(threshold: {bottleneck.evidence.threshold})
                    </div>
                    <div className="bottleneck-mitigation mt-2">
                      <i className="bi bi-lightbulb mr-1 text-yellow-400" />
                      <strong>Mitigation:</strong> {bottleneck.mitigation}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </GlassPanel>
  );
}
