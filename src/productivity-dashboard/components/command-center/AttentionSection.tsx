// Section 1: What needs attention right now?
// Shows top 3-5 action-required items with priority, owner, and recommended action.

import React from 'react';
import { AttentionSection as AttentionData } from '../../types/commandCenterTypes';

interface AttentionSectionProps {
  data: AttentionData;
  onActionClick?: (actionId: string) => void;
}

const PRIORITY_COLORS = {
  P0: '#ef4444',
  P1: '#f59e0b',
  P2: '#22c55e',
};

export const AttentionSection: React.FC<AttentionSectionProps> = ({ data, onActionClick }) => {
  if (data.items.length === 0) {
    return (
      <div style={{ padding: '1rem 0', color: 'rgba(255,255,255,0.5)', fontSize: '0.8125rem' }}>
        No blocking actions right now. Pipeline is flowing.
      </div>
    );
  }

  return (
    <div>
      {/* Summary bar */}
      <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1rem' }}>
        {data.p0_count > 0 && (
          <span style={{ fontSize: '0.8125rem' }}>
            <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: PRIORITY_COLORS.P0, marginRight: '0.375rem' }} />
            <strong style={{ color: PRIORITY_COLORS.P0 }}>{data.p0_count}</strong>
            <span style={{ color: 'rgba(255,255,255,0.5)', marginLeft: '0.25rem' }}>blocking</span>
          </span>
        )}
        {data.p1_count > 0 && (
          <span style={{ fontSize: '0.8125rem' }}>
            <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: PRIORITY_COLORS.P1, marginRight: '0.375rem' }} />
            <strong style={{ color: PRIORITY_COLORS.P1 }}>{data.p1_count}</strong>
            <span style={{ color: 'rgba(255,255,255,0.5)', marginLeft: '0.25rem' }}>at-risk</span>
          </span>
        )}
      </div>

      {/* Action items */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {data.items.map((item, i) => (
          <div
            key={item.action_id}
            onClick={() => onActionClick?.(item.action_id)}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.75rem',
              padding: '0.625rem 0.75rem',
              background: 'rgba(255,255,255,0.03)',
              borderRadius: '8px',
              cursor: onActionClick ? 'pointer' : 'default',
              borderLeft: `3px solid ${PRIORITY_COLORS[item.priority]}`,
            }}
          >
            <span style={{ fontSize: '0.625rem', fontFamily: 'Space Mono, monospace', color: PRIORITY_COLORS[item.priority], fontWeight: 700, minWidth: '1.5rem' }}>
              {item.priority}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.8125rem', color: 'rgba(255,255,255,0.9)', marginBottom: '0.25rem' }}>
                {item.title}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)' }}>
                <span style={{ marginRight: '0.75rem' }}>{item.owner_name}</span>
                {item.due_in_days <= 0 ? (
                  <span style={{ color: '#ef4444' }}>Overdue</span>
                ) : (
                  <span>Due in {item.due_in_days}d</span>
                )}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#06b6d4', marginTop: '0.25rem' }}>
                → {item.recommended_action}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
