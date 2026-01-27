// Section 6: Pipeline or capacity -- what do we need more of?
// Shows one-sentence diagnosis with evidence and recommended move.

import React from 'react';
import { BottleneckSection as BottleneckData, BottleneckDiagnosis } from '../../../types/commandCenterTypes';
import { getBottleneckAccountability } from '../../../services/priorityArbitrationService';
import { BottleneckDiagram } from './CCVisualPrimitives';

interface BottleneckSectionProps {
  data: BottleneckData;
  onNavigate?: (target: string) => void;
}

const DIAGNOSIS_INFO: Record<BottleneckDiagnosis, { label: string; sentence: string; color: string }> = {
  PIPELINE_BOUND: { label: 'Pipeline-Bound', sentence: 'Your bottleneck is pipeline \u2014 not enough candidates entering the funnel.', color: 'var(--color-warn)' },
  CAPACITY_BOUND: { label: 'Capacity-Bound', sentence: 'Your bottleneck is capacity \u2014 recruiters are overloaded.', color: 'var(--color-bad)' },
  BOTH: { label: 'Pipeline + Capacity', sentence: 'Both pipeline and capacity are constrained \u2014 need more candidates and more bandwidth.', color: 'var(--color-bad)' },
  HEALTHY: { label: 'Healthy', sentence: 'No bottleneck detected \u2014 pipeline and capacity are balanced.', color: 'var(--color-good)' },
};

export const BottleneckSection: React.FC<BottleneckSectionProps> = ({ data, onNavigate }) => {
  const diagInfo = DIAGNOSIS_INFO[data.diagnosis];

  return (
    <div>
      {/* Diagnosis sentence */}
      <div className="cc-bottleneck__diagnosis">
        <div className="cc-bottleneck__sentence" style={{ color: diagInfo.color }}>
          {diagInfo.sentence}
        </div>
      </div>

      {/* Constraint diagram */}
      <BottleneckDiagram diagnosis={data.diagnosis} />

      {/* Evidence bullets */}
      <div className="cc-bottleneck__evidence">
        {data.evidence.map((e, i) => (
          <div key={i} className="cc-bottleneck__evidence-item">
            <span className="cc-bottleneck__evidence-bullet">&bull;</span>
            <span>{e}</span>
          </div>
        ))}
      </div>

      {/* Recommendation + Accountability */}
      <div className="cc-bottleneck__recommendation">
        <div className="cc-bottleneck__rec-content">
          <span className="cc-bottleneck__rec-text">
            {data.recommendation}
          </span>
          {data.diagnosis !== 'HEALTHY' && (() => {
            const acct = data.accountability || getBottleneckAccountability(data.diagnosis);
            return (
              <span className="cc-bottleneck__rec-accountability">
                <span>{acct.owner}</span>
                {acct.due && <span style={{ color: diagInfo.color }}>{acct.due}</span>}
              </span>
            );
          })()}
        </div>
        {data.primary_action.label && onNavigate && (
          <button
            onClick={() => onNavigate(data.primary_action.navigation_target)}
            className="cc-bottleneck__rec-btn"
          >
            {data.primary_action.label} <i className="bi bi-arrow-right cc-bottleneck__rec-btn-arrow" />
          </button>
        )}
      </div>
    </div>
  );
};
