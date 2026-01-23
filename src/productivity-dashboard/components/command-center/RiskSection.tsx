// Section 3: What's at risk?
// Shows ranked top risks with what/why/so-what/next-move.

import React from 'react';
import { RiskSection as RiskData } from '../../types/commandCenterTypes';

interface RiskSectionProps {
  data: RiskData;
  onRiskClick?: (reqId: string) => void;
}

const SEVERITY_COLORS = {
  critical: '#ef4444',
  high: '#f59e0b',
  medium: '#94a3b8',
};

export const RiskSection: React.FC<RiskSectionProps> = ({ data, onRiskClick }) => {
  if (data.items.length === 0) {
    return (
      <div style={{ padding: '1rem 0', color: 'rgba(255,255,255,0.5)', fontSize: '0.8125rem' }}>
        No high-risk requisitions identified.
      </div>
    );
  }

  return (
    <div>
      {/* Summary bar */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.8125rem', color: 'rgba(255,255,255,0.7)' }}>
          <strong style={{ color: 'rgba(255,255,255,0.9)' }}>{data.total_at_risk}</strong> at risk
        </span>
        {Object.entries(data.by_failure_mode).slice(0, 3).map(([mode, count]) => (
          <span key={mode} style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)' }}>
            {count} {formatMode(mode)}
          </span>
        ))}
      </div>

      {/* Risk items */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {data.items.map((item, i) => (
          <div
            key={item.req_id}
            onClick={() => onRiskClick?.(item.req_id)}
            style={{
              padding: '0.625rem 0.75rem',
              background: 'rgba(255,255,255,0.03)',
              borderRadius: '8px',
              cursor: onRiskClick ? 'pointer' : 'default',
              borderLeft: `3px solid ${SEVERITY_COLORS[item.severity]}`,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <span style={{ fontSize: '0.625rem', fontWeight: 700, color: SEVERITY_COLORS[item.severity], textTransform: 'uppercase' }}>
                {item.severity}
              </span>
              <span style={{ fontSize: '0.8125rem', color: 'rgba(255,255,255,0.9)' }}>
                {item.req_title}
              </span>
              <span style={{ fontSize: '0.6875rem', color: 'rgba(255,255,255,0.4)', marginLeft: 'auto' }}>
                {item.days_open}d open
              </span>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', marginBottom: '0.25rem' }}>
              <span style={{ color: '#f59e0b' }}>{item.failure_mode_label}</span>: {item.why}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#06b6d4' }}>
              → {item.next_move}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

function formatMode(mode: string): string {
  const labels: Record<string, string> = {
    EMPTY_PIPELINE: 'pipeline gap',
    HM_DELAY: 'HM slow',
    OFFER_RISK: 'offer risk',
    AGING_DECAY: 'aging',
    STALLED_PIPELINE: 'stalled',
    COMPLEXITY_MISMATCH: 'complexity',
  };
  return labels[mode] || mode.toLowerCase();
}
