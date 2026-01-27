/**
 * Confidence Card
 *
 * Displays the confidence assessment with sample sizes.
 */

import React from 'react';
import { GlassPanel, SectionHeader } from '../../../common';
import { ConfidenceAssessment } from '../../../../types/scenarioTypes';

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

      <div className="confidence-badge flex items-center mb-3">
        <i className={`bi bi-${config.icon} text-xl mr-2 ${
          config.color === 'success' ? 'text-green-400' :
          config.color === 'warning' ? 'text-yellow-400' :
          'text-red-400'
        }`} />
        <span className={`font-bold ${
          config.color === 'success' ? 'text-green-400' :
          config.color === 'warning' ? 'text-yellow-400' :
          'text-red-400'
        }`}>{config.label}</span>
      </div>

      {confidence.reasons.length > 0 && (
        <div className="confidence-reasons mb-3">
          {confidence.reasons.map((reason, idx) => (
            <div key={idx} className="text-muted-foreground text-sm mb-1">
              <i className="bi bi-info-circle mr-1" />
              {reason}
            </div>
          ))}
        </div>
      )}

      {confidence.sample_sizes.length > 0 && (
        <div className="sample-sizes">
          <small className="text-muted-foreground block mb-2">Sample Sizes:</small>
          <div className="sample-sizes-list">
            {confidence.sample_sizes.map(sample => (
              <div
                key={sample.metric_key}
                className="sample-size-item flex justify-between mb-1"
              >
                <span className="text-muted-foreground text-sm">
                  {formatMetricKey(sample.metric_key)}
                </span>
                <span className={`text-sm ${sample.sufficient ? 'text-green-400' : 'text-red-400'}`}>
                  n={sample.n}
                  {sample.sufficient ? (
                    <i className="bi bi-check ml-1" />
                  ) : (
                    <span className="ml-1">(need {sample.threshold})</span>
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
