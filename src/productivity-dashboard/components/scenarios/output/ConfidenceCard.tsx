/**
 * Confidence Card
 *
 * Displays the confidence assessment with sample sizes.
 */

import React from 'react';
import { GlassPanel, SectionHeader } from '../../common';
import { ConfidenceAssessment } from '../../../types/scenarioTypes';

interface ConfidenceCardProps {
  confidence: ConfidenceAssessment;
  className?: string;
}

const LEVEL_CONFIG: Record<string, { icon: string; color: string; label: string }> = {
  HIGH: { icon: 'shield-check', color: 'success', label: 'High Confidence' },
  MED: { icon: 'shield-exclamation', color: 'warning', label: 'Medium Confidence' },
  LOW: { icon: 'shield-x', color: 'danger', label: 'Low Confidence' },
};

export default function ConfidenceCard({ confidence, className = '' }: ConfidenceCardProps) {
  const config = LEVEL_CONFIG[confidence.level] || LEVEL_CONFIG.LOW;

  return (
    <GlassPanel className={className}>
      <SectionHeader title="Confidence" />

      <div className="confidence-badge d-flex align-items-center mb-3">
        <i className={`bi bi-${config.icon} text-${config.color} fs-4 me-2`} />
        <span className={`text-${config.color} fw-bold`}>{config.label}</span>
      </div>

      {confidence.reasons.length > 0 && (
        <div className="confidence-reasons mb-3">
          {confidence.reasons.map((reason, idx) => (
            <div key={idx} className="text-secondary small mb-1">
              <i className="bi bi-info-circle me-1" />
              {reason}
            </div>
          ))}
        </div>
      )}

      {confidence.sample_sizes.length > 0 && (
        <div className="sample-sizes">
          <small className="text-secondary d-block mb-2">Sample Sizes:</small>
          <div className="sample-sizes-list">
            {confidence.sample_sizes.map(sample => (
              <div
                key={sample.metric_key}
                className="sample-size-item d-flex justify-content-between mb-1"
              >
                <span className="text-secondary small">
                  {formatMetricKey(sample.metric_key)}
                </span>
                <span className={`small ${sample.sufficient ? 'text-success' : 'text-danger'}`}>
                  n={sample.n}
                  {sample.sufficient ? (
                    <i className="bi bi-check ms-1" />
                  ) : (
                    <span className="ms-1">(need {sample.threshold})</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </GlassPanel>
  );
}

/**
 * Format metric key for display
 */
function formatMetricKey(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase());
}
