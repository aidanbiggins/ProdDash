/**
 * BottlenecksCardV2
 *
 * Displays the top constraints blocking or risking scenario success.
 * V2 version using glass-panel, Tailwind tokens, and lucide-react icons.
 */

import React from 'react';
import {
  OctagonAlert,
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  TrendingUp,
  Lightbulb,
} from 'lucide-react';
import { SectionHeader } from '../../../common';
import { Bottleneck } from '../../../../types/scenarioTypes';

interface BottlenecksCardV2Props {
  bottlenecks: Bottleneck[];
  className?: string;
}

const SEVERITY_CONFIG: Record<string, { Icon: typeof OctagonAlert; colorClass: string }> = {
  CRITICAL: { Icon: OctagonAlert, colorClass: 'text-bad' },
  HIGH: { Icon: AlertTriangle, colorClass: 'text-warn' },
  MEDIUM: { Icon: AlertCircle, colorClass: 'text-primary' },
};

const SEVERITY_BADGE_STYLES: Record<string, string> = {
  CRITICAL: 'bg-bad/20 text-bad',
  HIGH: 'bg-warn/20 text-warn',
  MEDIUM: 'bg-primary/20 text-primary',
};

const CONSTRAINT_LABELS: Record<string, string> = {
  CAPACITY_GAP: 'Capacity Gap',
  PIPELINE_DEPTH: 'Pipeline Depth',
  VELOCITY_DECAY: 'Velocity Decay',
  HM_FRICTION: 'HM Friction',
  FORECAST_CONFIDENCE: 'Low Confidence',
  MISSING_DATA: 'Missing Data',
};

export function BottlenecksCardV2({ bottlenecks, className = '' }: BottlenecksCardV2Props) {
  return (
    <div className={`glass-panel p-4 ${className}`}>
      <SectionHeader
        title="Bottlenecks"
        badge={bottlenecks.length > 0 ? `${bottlenecks.length} identified` : undefined}
      />

      {bottlenecks.length === 0 ? (
        <p className="text-muted-foreground mb-0 flex items-center">
          <CheckCircle size={16} className="mr-2 text-good" />
          No major bottlenecks identified
        </p>
      ) : (
        <div className="space-y-3">
          {bottlenecks.map((bottleneck, idx) => {
            const config = SEVERITY_CONFIG[bottleneck.severity] || SEVERITY_CONFIG.MEDIUM;
            const Icon = config.Icon;
            const badgeStyle =
              SEVERITY_BADGE_STYLES[bottleneck.severity] || SEVERITY_BADGE_STYLES.MEDIUM;

            return (
              <div key={idx} className="flex items-start">
                <span className="mr-2 text-muted-foreground text-sm">#{bottleneck.rank}</span>
                <div className="flex-1">
                  <div className="flex items-center flex-wrap gap-2 mb-1">
                    <Icon size={16} className={config.colorClass} />
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${badgeStyle}`}
                    >
                      {bottleneck.severity}
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-muted text-muted-foreground">
                      {CONSTRAINT_LABELS[bottleneck.constraint_type] || bottleneck.constraint_type}
                    </span>
                  </div>
                  <p className="mb-1 text-foreground">{bottleneck.description}</p>
                  <div className="text-sm text-muted-foreground flex items-center">
                    <TrendingUp size={14} className="mr-1" />
                    {bottleneck.evidence.metric_key}: {bottleneck.evidence.current_value}
                    {' '}(threshold: {bottleneck.evidence.threshold})
                  </div>
                  <div className="mt-2 flex items-start">
                    <Lightbulb size={14} className="mr-1 mt-0.5 text-warn shrink-0" />
                    <span>
                      <strong>Mitigation:</strong> {bottleneck.mitigation}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default BottlenecksCardV2;
