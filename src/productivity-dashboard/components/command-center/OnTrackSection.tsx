// Section 2: Are we on track?
// Shows goal rows with traffic-light status and verdict.

import React from 'react';
import { OnTrackSection as OnTrackData, KPIStatus, Verdict } from '../../types/commandCenterTypes';

interface OnTrackSectionProps {
  data: OnTrackData;
  onExplainKPI?: (kpiId: string) => void;
}

const STATUS_COLORS: Record<KPIStatus, string> = {
  green: '#10b981',
  amber: '#f59e0b',
  red: '#ef4444',
};

const STATUS_LABELS: Record<KPIStatus, string> = {
  green: 'OK',
  amber: 'WATCH',
  red: 'MISS',
};

const VERDICT_COLORS: Record<Verdict, string> = {
  ON_TRACK: '#10b981',
  AT_RISK: '#f59e0b',
  OFF_TRACK: '#ef4444',
};

export const OnTrackSection: React.FC<OnTrackSectionProps> = ({ data, onExplainKPI }) => {
  return (
    <div>
      {/* KPI rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
        {data.kpis.map(kpi => (
          <div
            key={kpi.id}
            onClick={() => kpi.explain_provider && onExplainKPI?.(kpi.explain_provider)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.5rem 0.75rem',
              background: 'rgba(255,255,255,0.03)',
              borderRadius: '8px',
              cursor: kpi.explain_provider ? 'pointer' : 'default',
            }}
          >
            <span style={{
              display: 'inline-block',
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: STATUS_COLORS[kpi.status],
              flexShrink: 0,
            }} />
            <span style={{ fontSize: '0.8125rem', color: 'rgba(255,255,255,0.6)', minWidth: '100px' }}>
              {kpi.label}
            </span>
            <span style={{ fontSize: '0.875rem', fontFamily: 'Space Mono, monospace', fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>
              {kpi.value !== null ? kpi.value : '—'}{kpi.unit && kpi.value !== null ? ` ${kpi.unit}` : ''}
            </span>
            {kpi.target > 0 && (
              <span style={{ fontSize: '0.6875rem', color: 'rgba(255,255,255,0.4)', marginLeft: 'auto' }}>
                target: {kpi.target}{kpi.unit}
              </span>
            )}
            <span style={{
              fontSize: '0.5625rem',
              textTransform: 'uppercase',
              fontWeight: 700,
              color: STATUS_COLORS[kpi.status],
              letterSpacing: '0.05em',
              minWidth: '2.5rem',
              textAlign: 'right',
            }}>
              {STATUS_LABELS[kpi.status]}
            </span>
          </div>
        ))}
      </div>

      {/* Verdict */}
      {data.verdict && (
        <div style={{
          padding: '0.625rem 0.75rem',
          borderRadius: '8px',
          background: `${VERDICT_COLORS[data.verdict]}11`,
          border: `1px solid ${VERDICT_COLORS[data.verdict]}33`,
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
        }}>
          <span style={{
            fontSize: '0.6875rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            color: VERDICT_COLORS[data.verdict],
            letterSpacing: '0.05em',
          }}>
            {data.verdict.replace('_', ' ')}
          </span>
          <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)' }}>
            — {data.verdict_reason}
          </span>
        </div>
      )}
    </div>
  );
};
