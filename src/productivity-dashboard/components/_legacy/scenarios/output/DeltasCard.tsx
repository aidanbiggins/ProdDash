/**
 * Deltas Card
 *
 * Displays the quantified impact deltas from a scenario.
 */

import React from 'react';
import { ScenarioDeltas } from '../../../../types/scenarioTypes';
import { StatValue, StatLabel } from '../../../common';

interface DeltasCardProps {
  deltas: ScenarioDeltas;
  className?: string;
}

interface DeltaMetric {
  key: keyof ScenarioDeltas;
  label: string;
  positiveIsGood: boolean;
  suffix?: string;
}

const DELTA_METRICS: DeltaMetric[] = [
  { key: 'expected_hires_delta', label: 'Expected Hires', positiveIsGood: true },
  { key: 'offers_delta', label: 'Offers', positiveIsGood: true },
  { key: 'pipeline_gap_delta', label: 'Pipeline Gap', positiveIsGood: false },
  { key: 'time_to_offer_delta', label: 'Time to Offer', positiveIsGood: false, suffix: 'd' },
];

export default function DeltasCard({ deltas, className = '' }: DeltasCardProps) {
  const displayedMetrics = DELTA_METRICS.filter(m => deltas[m.key] !== null);

  if (displayedMetrics.length === 0) {
    return null;
  }

  return (
    <div className={`deltas-card ${className}`}>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {displayedMetrics.map(metric => {
          const value = deltas[metric.key];
          if (value === null) return null;

          const isPositive = value > 0;
          const isGood = metric.positiveIsGood ? isPositive : !isPositive;

          return (
            <div key={metric.key}>
              <StatLabel>{metric.label}</StatLabel>
              <StatValue
                size="md"
                color={isGood ? 'success' : value === 0 ? 'default' : 'danger'}
              >
                {isPositive ? '+' : ''}{value}{metric.suffix || ''}
              </StatValue>
            </div>
          );
        })}
      </div>
    </div>
  );
}
