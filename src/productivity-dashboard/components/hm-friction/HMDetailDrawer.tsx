// HMDetailDrawer - Slide-in drawer showing hiring manager details and requisitions
import React from 'react';
import { HiringManagerFriction, Requisition, User } from '../../types';

// Same thresholds as heatmap in HMFrictionTab for consistency
function getLatencyColor(hours: number | null, type: 'feedback' | 'decision'): string {
  if (hours === null) return '#64748b'; // gray for no data
  const thresholds = type === 'feedback'
    ? { good: 24, warn: 48, bad: 72 }
    : { good: 48, warn: 72, bad: 120 };

  if (hours <= thresholds.good) return '#22c55e'; // green
  if (hours <= thresholds.warn) return '#f59e0b'; // yellow/amber
  if (hours <= thresholds.bad) return '#f97316'; // orange
  return '#ef4444'; // red
}

interface HMDetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  hmData: HiringManagerFriction | null;
  requisitions: Requisition[];
  users: User[];
}

export function HMDetailDrawer({
  isOpen,
  onClose,
  hmData,
  requisitions,
  users,
}: HMDetailDrawerProps) {
  if (!isOpen || !hmData) return null;

  // Get recruiter name helper
  const getRecruiterName = (recruiterId: string | null) => {
    if (!recruiterId) return 'Unassigned';
    const recruiter = users.find(u => u.user_id === recruiterId);
    return recruiter?.name || recruiterId;
  };

  // Calculate total cycle time
  const totalCycleHours = hmData.composition.stageBreakdown.sourcingHours +
    hmData.composition.stageBreakdown.screeningHours +
    hmData.composition.stageBreakdown.hmReviewHours +
    hmData.composition.stageBreakdown.interviewHours +
    hmData.composition.stageBreakdown.feedbackHours +
    hmData.composition.stageBreakdown.decisionHours;

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
          zIndex: 1040,
        }}
      />

      {/* Drawer */}
      <div
        className="glass-drawer fixed top-0 right-0 bottom-0 flex flex-col overflow-hidden"
        style={{
          width: '480px',
          maxWidth: '90vw',
          zIndex: 1050,
        }}
      >
        {/* Header */}
        <div
          className="glass-drawer-header flex justify-between items-start"
          style={{
            padding: 'var(--space-4)',
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
              Hiring Manager Detail
            </div>
            <div style={{ fontWeight: 'var(--font-bold)', fontSize: 'var(--text-lg)' }}>
              {hmData.hmName}
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
        <div className="flex-1 overflow-auto" style={{ padding: 'var(--space-4)' }}>
          {/* Key Metrics Grid */}
          <div
            className="grid grid-cols-3 gap-3 mb-4"
          >
            <div
              style={{
                padding: 'var(--space-3)',
                background: 'rgba(255, 255, 255, 0.03)',
                borderRadius: 'var(--radius-md)',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginBottom: '4px' }}>
                Reqs
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 'var(--font-bold)', fontSize: 'var(--text-xl)' }}>
                {hmData.reqsInRange}
              </div>
            </div>
            <div
              style={{
                padding: 'var(--space-3)',
                background: 'rgba(255, 255, 255, 0.03)',
                borderRadius: 'var(--radius-md)',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginBottom: '4px' }}>
                Interview Loops
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 'var(--font-bold)', fontSize: 'var(--text-xl)' }}>
                {hmData.loopCount}
              </div>
            </div>
            <div
              style={{
                padding: 'var(--space-3)',
                background: hmData.hmWeight > 1.2 ? 'rgba(239, 68, 68, 0.1)' :
                  hmData.hmWeight > 1.0 ? 'rgba(245, 158, 11, 0.1)' :
                    hmData.hmWeight < 0.9 ? 'rgba(34, 197, 94, 0.1)' : 'rgba(255, 255, 255, 0.03)',
                borderRadius: 'var(--radius-md)',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginBottom: '4px' }}>
                HM Weight
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 'var(--font-bold)',
                  fontSize: 'var(--text-xl)',
                  color: hmData.hmWeight > 1.2 ? '#ef4444' :
                    hmData.hmWeight > 1.0 ? '#f59e0b' :
                      hmData.hmWeight < 0.9 ? '#22c55e' : 'inherit',
                }}
              >
                {hmData.hmWeight.toFixed(2)}x
              </div>
            </div>
          </div>

          {/* Latency Breakdown */}
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
              Latency Breakdown
            </div>
            {(() => {
              const feedbackColor = getLatencyColor(hmData.feedbackLatencyMedian, 'feedback');
              const decisionColor = getLatencyColor(hmData.decisionLatencyMedian, 'decision');
              return (
                <div
                  className="grid grid-cols-2 gap-2"
                >
                  <div
                    style={{
                      padding: 'var(--space-3)',
                      background: `${feedbackColor}15`,
                      borderLeft: `3px solid ${feedbackColor}`,
                      borderRadius: 'var(--radius-sm)',
                    }}
                  >
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                      Feedback Latency
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 'var(--font-semibold)', color: feedbackColor }}>
                      {hmData.feedbackLatencyMedian !== null ? `${Math.round(hmData.feedbackLatencyMedian)} hrs` : '-'}
                    </div>
                  </div>
                  <div
                    style={{
                      padding: 'var(--space-3)',
                      background: `${decisionColor}15`,
                      borderLeft: `3px solid ${decisionColor}`,
                      borderRadius: 'var(--radius-sm)',
                    }}
                  >
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                      Decision Latency
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 'var(--font-semibold)', color: decisionColor }}>
                      {hmData.decisionLatencyMedian !== null ? `${Math.round(hmData.decisionLatencyMedian)} hrs` : '-'}
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Time Composition */}
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
              Hiring Cycle Composition
            </div>
            <div
              style={{
                padding: 'var(--space-3)',
                background: 'rgba(255, 255, 255, 0.02)',
                borderRadius: 'var(--radius-md)',
              }}
            >
              {/* Mini stacked bar */}
              <div className="flex h-6 rounded overflow-hidden mb-2">
                {totalCycleHours > 0 && (
                  <>
                    <div style={{ width: `${(hmData.composition.stageBreakdown.sourcingHours / totalCycleHours) * 100}%`, background: '#64748b' }} title="Sourcing" />
                    <div style={{ width: `${(hmData.composition.stageBreakdown.screeningHours / totalCycleHours) * 100}%`, background: '#3b82f6' }} title="Screening" />
                    <div style={{ width: `${(hmData.composition.stageBreakdown.hmReviewHours / totalCycleHours) * 100}%`, background: '#14b8a6' }} title="HM Review" />
                    <div style={{ width: `${(hmData.composition.stageBreakdown.interviewHours / totalCycleHours) * 100}%`, background: '#22c55e' }} title="Interview" />
                    <div style={{ width: `${(hmData.composition.stageBreakdown.feedbackHours / totalCycleHours) * 100}%`, background: '#f59e0b' }} title="Feedback" />
                    <div style={{ width: `${(hmData.composition.stageBreakdown.decisionHours / totalCycleHours) * 100}%`, background: '#dc2626' }} title="Decision" />
                  </>
                )}
              </div>
              <div className="flex justify-between text-xs" style={{ color: 'var(--text-secondary)' }}>
                <span>Total: {Math.round(totalCycleHours)} hrs ({Math.round(totalCycleHours / 24)}d)</span>
                <span
                  style={{
                    color: hmData.composition.timeTaxPercent > 30 ? '#ef4444' :
                      hmData.composition.timeTaxPercent > 15 ? '#f59e0b' : '#22c55e',
                  }}
                >
                  Time Tax: {hmData.composition.timeTaxPercent}%
                </span>
              </div>
            </div>
          </div>

          {/* Offer Stats */}
          {hmData.offerAcceptanceRate !== null && (
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
                Offer Performance
              </div>
              <div
                className="flex justify-between items-center rounded-md"
                style={{
                  padding: 'var(--space-3)',
                  background: 'rgba(34, 197, 94, 0.1)',
                }}
              >
                <span style={{ color: 'var(--text-secondary)' }}>Offer Accept Rate</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 'var(--font-bold)', color: '#22c55e' }}>
                  {Math.round(hmData.offerAcceptanceRate * 100)}%
                </span>
              </div>
            </div>
          )}

          {/* Requisitions */}
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
              Requisitions ({requisitions.length})
            </div>
            <div className="flex flex-col gap-2">
              {requisitions.map(req => (
                <div
                  key={req.req_id}
                  style={{
                    padding: 'var(--space-3)',
                    background: 'rgba(255, 255, 255, 0.02)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: 'var(--text-sm)',
                  }}
                >
                  <div className="flex justify-between items-start mb-1">
                    <div>
                      <div style={{ fontWeight: 'var(--font-medium)' }}>{req.req_title}</div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                        {req.req_id}
                      </div>
                    </div>
                    <span
                      className={`badge-bespoke ${req.status === 'Open' ? 'badge-success-soft' :
                        req.status === 'Closed' ? 'badge-neutral-soft' :
                          req.status === 'OnHold' ? 'badge-warning-soft' : 'badge-danger-soft'
                        }`}
                    >
                      {req.status}
                    </span>
                  </div>
                  <div className="flex gap-3 text-xs" style={{ color: 'var(--text-secondary)' }}>
                    <span>
                      <i className="bi bi-layers mr-1" />
                      {req.level || 'N/A'}
                    </span>
                    <span>
                      <i className="bi bi-person mr-1" />
                      {getRecruiterName(req.recruiter_id)}
                    </span>
                  </div>
                </div>
              ))}
              {requisitions.length === 0 && (
                <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: 'var(--space-4)' }}>
                  No requisitions found for current filters
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default HMDetailDrawer;
