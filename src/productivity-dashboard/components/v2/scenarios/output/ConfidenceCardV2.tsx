/**
 * ConfidenceCardV2
 *
 * Displays the confidence assessment with sample sizes.
 * V2 version using glass-panel and Tailwind tokens.
 */

import React from 'react';
import { ShieldCheck, ShieldAlert, ShieldX, Info, Check } from 'lucide-react';
import { SectionHeader } from '../../../common';
import { ConfidenceAssessment } from '../../../../types/scenarioTypes';

interface ConfidenceCardV2Props {
  confidence: ConfidenceAssessment;
  className?: string;
}

const LEVEL_CONFIG: Record<
  string,
  { Icon: typeof ShieldCheck; colorClass: string; label: string }
> = {
  HIGH: { Icon: ShieldCheck, colorClass: 'text-good', label: 'High Confidence' },
  MED: { Icon: ShieldAlert, colorClass: 'text-warn', label: 'Medium Confidence' },
  LOW: { Icon: ShieldX, colorClass: 'text-bad', label: 'Low Confidence' },
};

export function ConfidenceCardV2({ confidence, className = '' }: ConfidenceCardV2Props) {
  const config = LEVEL_CONFIG[confidence.level] || LEVEL_CONFIG.LOW;
  const Icon = config.Icon;

  return (
    <div className={`glass-panel p-4 ${className}`}>
      <SectionHeader title="Confidence" />

      <div className="flex items-center mb-3">
        <Icon size={20} className={`mr-2 ${config.colorClass}`} />
        <span className={`font-bold ${config.colorClass}`}>{config.label}</span>
      </div>

      {confidence.reasons.length > 0 && (
        <div className="mb-3 space-y-1">
          {confidence.reasons.map((reason, idx) => (
            <div key={idx} className="text-muted-foreground text-sm flex items-start">
              <Info size={14} className="mr-1 mt-0.5 shrink-0" />
              {reason}
            </div>
          ))}
        </div>
      )}

      {confidence.sample_sizes.length > 0 && (
        <div>
          <small className="text-muted-foreground block mb-2">Sample Sizes:</small>
          <div className="space-y-1">
            {confidence.sample_sizes.map((sample) => (
              <div key={sample.metric_key} className="flex justify-between items-center">
                <span className="text-muted-foreground text-sm">
                  {formatMetricKey(sample.metric_key)}
                </span>
                <span className={`text-sm ${sample.sufficient ? 'text-good' : 'text-bad'}`}>
                  n={sample.n}
                  {sample.sufficient ? (
                    <Check size={12} className="inline ml-1" />
                  ) : (
                    <span className="ml-1">(need {sample.threshold})</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Format metric key for display
 */
function formatMetricKey(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (l) => l.toUpperCase());
}

export default ConfidenceCardV2;
