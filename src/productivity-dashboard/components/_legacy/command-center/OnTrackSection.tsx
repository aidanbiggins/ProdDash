// Section 2: Are we on track?
// Shows KPIs split into Watch (amber/red, expanded) and Outcomes (green, collapsed badge).

import React from 'react';
import { OnTrackSection as OnTrackData, KPIStatus, Verdict } from '../../../types/commandCenterTypes';
import { KPITargetBand } from './CCVisualPrimitives';

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
  const watchKPIs = data.kpis.filter(k => k.status !== 'green');
  const okKPIs = data.kpis.filter(k => k.status === 'green');

  return (
    <div>
      {/* Watch KPIs (amber/red) -- expanded with full detail */}
      {watchKPIs.length > 0 && (
        <div className="cc-ontrack__watch-list">
          {watchKPIs.map(kpi => (
            <div
              key={kpi.id}
              className={`cc-ontrack__kpi-row ${kpi.explain_provider ? 'cc-ontrack__kpi-row--clickable' : ''}`}
              onClick={() => kpi.explain_provider && onExplainKPI?.(kpi.explain_provider)}
              role={kpi.explain_provider ? 'button' : undefined}
              tabIndex={kpi.explain_provider ? 0 : undefined}
              onKeyDown={kpi.explain_provider ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onExplainKPI?.(kpi.explain_provider!); } } : undefined}
            >
              <span className={`cc-ontrack__kpi-dot cc-ontrack__kpi-dot--${kpi.status}`} />
              <span className="cc-ontrack__kpi-label">
                {kpi.label}
              </span>
              <span className="cc-ontrack__kpi-value">
                {kpi.value !== null ? kpi.value : '\u2014'}{kpi.unit && kpi.value !== null ? ` ${kpi.unit}` : ''}
              </span>
              {kpi.value !== null && kpi.target > 0 && (
                <KPITargetBand value={kpi.value} target={kpi.target} status={kpi.status} />
              )}
              {kpi.target > 0 && (
                <span className="cc-ontrack__kpi-target">
                  target: {kpi.target}{kpi.unit}
                </span>
              )}
              <span className="cc-ontrack__kpi-status" style={{ color: STATUS_COLORS[kpi.status] }}>
                {STATUS_LABELS[kpi.status]}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Outcomes badge (green KPIs) -- collapsed count */}
      {okKPIs.length > 0 && (
        <div className="cc-ontrack__ok-badge">
          <span className="cc-ontrack__kpi-dot cc-ontrack__kpi-dot--green" />
          <span className="cc-ontrack__ok-label">
            {okKPIs.length} on target
          </span>
        </div>
      )}

      {/* Verdict */}
      {data.verdict && (
        <div
          className="cc-ontrack__verdict"
          style={{
            background: `${VERDICT_COLORS[data.verdict]}11`,
            border: `1px solid ${VERDICT_COLORS[data.verdict]}33`,
          }}
        >
          <span className="cc-ontrack__verdict-label" style={{ color: VERDICT_COLORS[data.verdict] }}>
            {data.verdict.replace('_', ' ')}
          </span>
          <span className="cc-ontrack__verdict-reason">
            — {data.verdict_reason}
          </span>
        </div>
      )}
    </div>
  );
};
