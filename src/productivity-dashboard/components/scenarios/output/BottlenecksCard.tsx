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
        <p className="text-secondary mb-0">
          <i className="bi bi-check-circle me-2 text-success" />
          No major bottlenecks identified
        </p>
      ) : (
        <div className="bottlenecks-list">
          {bottlenecks.map((bottleneck, idx) => {
            const config = SEVERITY_CONFIG[bottleneck.severity] || SEVERITY_CONFIG.MEDIUM;

            return (
              <div key={idx} className="bottleneck-item mb-3">
                <div className="d-flex align-items-start">
                  <span className="bottleneck-rank me-2 text-secondary">#{bottleneck.rank}</span>
                  <div className="flex-grow-1">
                    <div className="d-flex align-items-center mb-1">
                      <i className={`bi bi-${config.icon} text-${config.color} me-2`} />
                      <span className={`badge bg-${config.color}-subtle text-${config.color} me-2`}>
                        {bottleneck.severity}
                      </span>
                      <span className="badge bg-secondary-subtle text-secondary">
                        {CONSTRAINT_LABELS[bottleneck.constraint_type] || bottleneck.constraint_type}
                      </span>
                    </div>
                    <p className="mb-1">{bottleneck.description}</p>
                    <div className="bottleneck-evidence small text-secondary">
                      <i className="bi bi-graph-up me-1" />
                      {bottleneck.evidence.metric_key}: {bottleneck.evidence.current_value}
                      {' '}(threshold: {bottleneck.evidence.threshold})
                    </div>
                    <div className="bottleneck-mitigation mt-2">
                      <i className="bi bi-lightbulb me-1 text-warning" />
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
