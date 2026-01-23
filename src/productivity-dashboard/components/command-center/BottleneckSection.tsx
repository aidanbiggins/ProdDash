// Section 6: Pipeline or capacity — what do we need more of?
// Shows one-sentence diagnosis with evidence and recommended move.

import React from 'react';
import { BottleneckSection as BottleneckData, BottleneckDiagnosis } from '../../types/commandCenterTypes';

interface BottleneckSectionProps {
  data: BottleneckData;
  onNavigate?: (target: string) => void;
}

const DIAGNOSIS_LABELS: Record<BottleneckDiagnosis, { label: string; color: string }> = {
  PIPELINE_BOUND: { label: 'Pipeline-Bound', color: '#f59e0b' },
  CAPACITY_BOUND: { label: 'Capacity-Bound', color: '#ef4444' },
  BOTH: { label: 'Pipeline + Capacity', color: '#ef4444' },
  HEALTHY: { label: 'Healthy', color: '#10b981' },
};

export const BottleneckSection: React.FC<BottleneckSectionProps> = ({ data, onNavigate }) => {
  const diagInfo = DIAGNOSIS_LABELS[data.diagnosis];

  return (
    <div>
      {/* Diagnosis badge */}
      <div style={{ marginBottom: '0.75rem' }}>
        <span style={{
          display: 'inline-block',
          fontSize: '0.6875rem',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: diagInfo.color,
          background: `${diagInfo.color}1a`,
          border: `1px solid ${diagInfo.color}33`,
          borderRadius: '4px',
          padding: '0.25rem 0.5rem',
        }}>
          {diagInfo.label}
        </span>
      </div>

      {/* Evidence bullets */}
      <div style={{ marginBottom: '0.75rem' }}>
        {data.evidence.map((e, i) => (
          <div key={i} style={{ fontSize: '0.8125rem', color: 'rgba(255,255,255,0.6)', padding: '0.125rem 0', display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
            <span style={{ color: 'rgba(255,255,255,0.3)' }}>•</span>
            <span>{e}</span>
          </div>
        ))}
      </div>

      {/* Recommendation */}
      <div style={{
        padding: '0.625rem 0.75rem',
        background: 'rgba(6, 182, 212, 0.06)',
        border: '1px solid rgba(6, 182, 212, 0.15)',
        borderRadius: '6px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '0.75rem',
      }}>
        <span style={{ fontSize: '0.8125rem', color: 'rgba(255,255,255,0.8)' }}>
          {data.recommendation}
        </span>
        {data.primary_action.label && onNavigate && (
          <button
            onClick={() => onNavigate(data.primary_action.navigation_target)}
            className="btn btn-sm"
            style={{
              fontSize: '0.6875rem',
              color: '#06b6d4',
              border: '1px solid rgba(6, 182, 212, 0.3)',
              borderRadius: '4px',
              whiteSpace: 'nowrap',
              padding: '0.25rem 0.5rem',
              background: 'transparent',
            }}
          >
            {data.primary_action.label} <i className="bi bi-arrow-right" style={{ fontSize: '0.6rem' }} />
          </button>
        )}
      </div>
    </div>
  );
};
