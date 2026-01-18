// ReqDrilldownDrawer.tsx
// Slide-in drawer showing detailed breach info for a specific requisition

import React from 'react';
import { StageDwellMetric, DEFAULT_SLA_POLICIES } from '../../types/slaTypes';

interface ReqDrilldownDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  reqId: string;
  reqTitle: string;
  recruiterName: string | null;
  hiringManagerName: string | null;
  daysOpen: number;
  dwellMetrics: StageDwellMetric[];
  onViewHMScorecard?: (hmId: string) => void;
  onCreateAction?: (reqId: string) => void;
}

function formatDate(date: Date | null): string {
  if (!date) return 'N/A';
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatHours(hours: number): string {
  if (hours < 24) {
    return `${hours.toFixed(1)}h`;
  }
  const days = hours / 24;
  return `${days.toFixed(1)}d`;
}

function getStageColor(breached: boolean, dwellHours: number, slaHours: number): string {
  if (breached) return '#ef4444'; // Red
  if (dwellHours > slaHours * 0.8) return '#f59e0b'; // Yellow - close to breach
  return '#22c55e'; // Green
}

export function ReqDrilldownDrawer({
  isOpen,
  onClose,
  reqId,
  reqTitle,
  recruiterName,
  hiringManagerName,
  daysOpen,
  dwellMetrics,
  onViewHMScorecard,
  onCreateAction,
}: ReqDrilldownDrawerProps) {
  if (!isOpen) return null;

  // Sort metrics by entered_at
  const sortedMetrics = [...dwellMetrics].sort(
    (a, b) => a.entered_at.getTime() - b.entered_at.getTime()
  );

  // Find the worst breach
  const worstBreach = sortedMetrics
    .filter((m) => m.breached)
    .sort((a, b) => b.breach_hours - a.breach_hours)[0];

  // Aggregate metrics by stage for the timeline visualization
  const stageOrder = ['APPLIED', 'SCREEN', 'HM_SCREEN', 'ONSITE', 'OFFER', 'HIRED'];
  const stageAggregates = sortedMetrics.reduce((acc, metric) => {
    const key = metric.stage_key;
    if (!acc[key]) {
      acc[key] = {
        stage_key: key,
        total_dwell_hours: 0,
        count: 0,
        breach_count: 0,
        attribution_owner_type: metric.attribution_owner_type,
      };
    }
    acc[key].total_dwell_hours += metric.dwell_hours;
    acc[key].count += 1;
    if (metric.breached) acc[key].breach_count += 1;
    return acc;
  }, {} as Record<string, { stage_key: string; total_dwell_hours: number; count: number; breach_count: number; attribution_owner_type: string }>);

  // Sort aggregates by canonical stage order, then alphabetically for unknown stages
  const sortedStageAggregates = Object.values(stageAggregates).sort((a, b) => {
    const aIndex = stageOrder.indexOf(a.stage_key);
    const bIndex = stageOrder.indexOf(b.stage_key);
    if (aIndex === -1 && bIndex === -1) return a.stage_key.localeCompare(b.stage_key);
    if (aIndex === -1) return 1;
    if (bIndex === -1) return -1;
    return aIndex - bIndex;
  });

  return (
    <>
      {/* Backdrop */}
      <div
        className="glass-backdrop"
        onClick={onClose}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 999,
        }}
      />

      {/* Drawer */}
      <div
        className="glass-drawer"
        data-testid="req-drilldown-drawer"
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          width: '500px',
          maxWidth: '90vw',
          height: '100vh',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          className="glass-drawer-header"
          style={{
            padding: 'var(--space-4)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
          }}
        >
          <div>
            <div
              style={{
                fontSize: 'var(--text-xs)',
                color: 'var(--text-tertiary)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: '4px',
              }}
            >
              Req Detail
            </div>
            <div style={{ fontWeight: 'var(--font-bold)', fontSize: 'var(--text-lg)' }}>
              {reqId}
            </div>
            <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>
              {reqTitle}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: '1.25rem',
              padding: '4px',
            }}
          >
            <i className="bi bi-x-lg" />
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: 'var(--space-4)' }}>
          {/* Req Info */}
          <div
            style={{
              display: 'flex',
              gap: 'var(--space-4)',
              marginBottom: 'var(--space-4)',
              fontSize: 'var(--text-sm)',
            }}
          >
            <div>
              <span style={{ color: 'var(--text-tertiary)' }}>Recruiter:</span>{' '}
              {recruiterName ?? 'Unassigned'}
            </div>
            <div>
              <span style={{ color: 'var(--text-tertiary)' }}>HM:</span>{' '}
              {hiringManagerName ?? 'Unassigned'}
            </div>
            <div>
              <span style={{ color: 'var(--text-tertiary)' }}>Days Open:</span> {daysOpen}
            </div>
          </div>

          {/* Stage Timeline (Aggregated by Stage) */}
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <div
              style={{
                fontSize: 'var(--text-xs)',
                color: 'var(--text-tertiary)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: 'var(--space-2)',
              }}
            >
              Stage Summary
            </div>

            <div
              style={{
                display: 'flex',
                gap: '2px',
                overflow: 'auto',
                padding: 'var(--space-2) 0',
              }}
            >
              {sortedStageAggregates.map((agg) => {
                const policy = DEFAULT_SLA_POLICIES.find(
                  (p) => p.stage_key === agg.stage_key
                );
                const slaHours = policy?.sla_hours ?? 72;
                const avgDwellHours = agg.total_dwell_hours / agg.count;
                const hasBreaches = agg.breach_count > 0;
                const color = hasBreaches ? '#ef4444' : avgDwellHours > slaHours * 0.8 ? '#f59e0b' : '#22c55e';

                return (
                  <div
                    key={agg.stage_key}
                    style={{
                      flex: '1 1 0',
                      minWidth: '90px',
                      padding: 'var(--space-2)',
                      background: `${color}15`,
                      borderRadius: 'var(--radius-sm)',
                      borderTop: `3px solid ${color}`,
                      textAlign: 'center',
                    }}
                  >
                    <div
                      style={{
                        fontSize: 'var(--text-xs)',
                        fontWeight: 'var(--font-medium)',
                        marginBottom: '4px',
                      }}
                    >
                      {agg.stage_key}
                    </div>
                    <div
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontWeight: 'var(--font-semibold)',
                        color,
                      }}
                    >
                      {formatHours(avgDwellHours)}
                    </div>
                    <div
                      style={{
                        fontSize: 'var(--text-xs)',
                        color: 'var(--text-tertiary)',
                      }}
                    >
                      {agg.count} candidate{agg.count !== 1 ? 's' : ''}
                      {hasBreaches && (
                        <span style={{ color: '#ef4444', marginLeft: '4px' }}>
                          ({agg.breach_count} breached)
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Worst Breach Details */}
          {worstBreach && (
            <div
              style={{
                padding: 'var(--space-3)',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                borderRadius: 'var(--radius-md)',
                marginBottom: 'var(--space-4)',
              }}
            >
              <div
                style={{
                  fontSize: 'var(--text-xs)',
                  color: 'var(--text-tertiary)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginBottom: 'var(--space-2)',
                }}
              >
                Breach Details
              </div>

              <div style={{ fontSize: 'var(--text-sm)' }}>
                <div style={{ marginBottom: 'var(--space-2)' }}>
                  <strong>Stage:</strong> {worstBreach.stage_key} (SLA:{' '}
                  {worstBreach.sla_policy?.sla_hours ?? 72}h)
                </div>
                <div style={{ marginBottom: 'var(--space-2)' }}>
                  <strong>Entered:</strong> {formatDate(worstBreach.entered_at)}
                </div>
                <div style={{ marginBottom: 'var(--space-2)' }}>
                  <strong>Exited:</strong>{' '}
                  {worstBreach.exited_at ? formatDate(worstBreach.exited_at) : 'Still in stage'}
                </div>
                <div style={{ marginBottom: 'var(--space-2)' }}>
                  <strong>Duration:</strong> {formatHours(worstBreach.dwell_hours)}
                </div>
                <div
                  style={{
                    color: '#ef4444',
                    fontWeight: 'var(--font-semibold)',
                    marginBottom: 'var(--space-2)',
                  }}
                >
                  <strong>Breach:</strong> {formatHours(worstBreach.breach_hours)} over SLA
                </div>
                <div style={{ marginBottom: 'var(--space-2)' }}>
                  <strong>Attribution:</strong> {worstBreach.attribution_owner_type}
                  {worstBreach.attribution_owner_name &&
                    ` (${worstBreach.attribution_owner_name})`}{' '}
                  - {worstBreach.attribution_confidence} confidence
                </div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                  <strong>Reason:</strong> {worstBreach.attribution_reasons.join('; ')}
                </div>
              </div>
            </div>
          )}

          {/* All Dwell Periods */}
          <div>
            <div
              style={{
                fontSize: 'var(--text-xs)',
                color: 'var(--text-tertiary)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: 'var(--space-2)',
              }}
            >
              All Stage Dwell Periods
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {sortedMetrics.map((metric, index) => (
                <div
                  key={`${metric.candidate_id}-${metric.stage_key}-${index}`}
                  style={{
                    padding: 'var(--space-2) var(--space-3)',
                    background: 'rgba(255, 255, 255, 0.02)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: 'var(--text-sm)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div style={{ fontWeight: 'var(--font-medium)' }}>
                      {metric.stage_key}
                      {metric.breached && (
                        <span
                          style={{
                            marginLeft: '8px',
                            color: '#ef4444',
                            fontSize: 'var(--text-xs)',
                          }}
                        >
                          BREACH
                        </span>
                      )}
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)' }}>
                      {formatHours(metric.dwell_hours)}
                    </div>
                  </div>
                  <div
                    style={{
                      fontSize: 'var(--text-xs)',
                      color: 'var(--text-secondary)',
                      marginTop: '4px',
                    }}
                  >
                    Candidate: {metric.candidate_id.slice(0, 8)}... | Owner:{' '}
                    {metric.attribution_owner_type}
                    {metric.is_reentry && ' | Re-entry'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: 'var(--space-3) var(--space-4)',
            borderTop: '1px solid var(--glass-border)',
            display: 'flex',
            gap: 'var(--space-2)',
          }}
        >
          {worstBreach?.attribution_owner_id &&
            worstBreach.attribution_owner_type === 'HM' &&
            onViewHMScorecard && (
              <button
                onClick={() => onViewHMScorecard(worstBreach.attribution_owner_id!)}
                style={{
                  flex: 1,
                  padding: 'var(--space-2)',
                  background: 'rgba(139, 92, 246, 0.1)',
                  border: '1px solid rgba(139, 92, 246, 0.3)',
                  color: '#8b5cf6',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  fontSize: 'var(--text-sm)',
                }}
              >
                <i className="bi bi-person-badge me-1" />
                View HM Scorecard
              </button>
            )}
          {onCreateAction && (
            <button
              onClick={() => onCreateAction(reqId)}
              style={{
                flex: 1,
                padding: 'var(--space-2)',
                background: 'rgba(34, 197, 94, 0.1)',
                border: '1px solid rgba(34, 197, 94, 0.3)',
                color: '#22c55e',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                fontSize: 'var(--text-sm)',
              }}
            >
              <i className="bi bi-plus-circle me-1" />
              Create Action
            </button>
          )}
        </div>
      </div>
    </>
  );
}

export default ReqDrilldownDrawer;
