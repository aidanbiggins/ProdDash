// ReqHealthDrawer - Slide-in drawer showing requisition health details and Oracle prediction
import React from 'react';
import { RoleHealthMetrics } from '../../types/forecastingTypes';
import { ForecastResult } from '../../services/probabilisticEngine';
import { OracleConfidenceWidget } from './OracleConfidenceWidget';

// Health status badge styling
function getHealthBadgeStyle(status: string) {
  switch (status) {
    case 'on-track':
      return { background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' };
    case 'at-risk':
      return { background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' };
    case 'off-track':
      return { background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' };
    default:
      return { background: 'rgba(100, 116, 139, 0.15)', color: '#64748b' };
  }
}

function getVelocityBadgeStyle(trend: string) {
  switch (trend) {
    case 'improving':
      return { background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' };
    case 'stable':
      return { background: 'rgba(100, 116, 139, 0.15)', color: '#64748b' };
    case 'declining':
      return { background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' };
    case 'stalled':
      return { background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' };
    default:
      return { background: 'rgba(100, 116, 139, 0.15)', color: '#64748b' };
  }
}

function getPriorityBadgeStyle(priority: string) {
  switch (priority) {
    case 'urgent':
      return { background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' };
    case 'important':
      return { background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' };
    default:
      return { background: 'rgba(100, 116, 139, 0.15)', color: '#64748b' };
  }
}

interface ReqHealthDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  healthData: RoleHealthMetrics | null | undefined;
  forecast: ForecastResult | null;
}

export function ReqHealthDrawer({
  isOpen,
  onClose,
  healthData,
  forecast,
}: ReqHealthDrawerProps) {
  if (!isOpen || !healthData) return null;

  const healthBadgeStyle = getHealthBadgeStyle(healthData.healthStatus);
  const velocityBadgeStyle = getVelocityBadgeStyle(healthData.velocityTrend);

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
        className="glass-drawer"
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: '560px',
          maxWidth: '95vw',
          zIndex: 1050,
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
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 'var(--text-xs)',
                color: 'var(--text-tertiary)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: '4px',
              }}
            >
              Requisition Health
            </div>
            <div
              style={{
                fontWeight: 'var(--font-bold)',
                fontSize: 'var(--text-lg)',
                marginBottom: '8px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {healthData.reqTitle}
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span
                className="badge rounded-pill text-uppercase"
                style={{ fontSize: '0.65rem', ...healthBadgeStyle }}
              >
                Score: {healthData.healthScore}
              </span>
              <span
                className="badge rounded-pill text-uppercase"
                style={{ fontSize: '0.65rem', ...velocityBadgeStyle }}
              >
                {healthData.velocityTrend}
              </span>
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
              marginLeft: '8px',
            }}
          >
            <i className="bi bi-x-lg" />
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: 'var(--space-4)' }}>
          {/* Oracle Widget */}
          {forecast ? (
            <div style={{ marginBottom: 'var(--space-4)' }}>
              <OracleConfidenceWidget
                forecast={forecast}
                startDate={new Date()}
              />
            </div>
          ) : (
            <div
              className="glass-panel p-4 text-center mb-4"
              style={{ color: 'var(--text-tertiary)' }}
            >
              <div className="spinner-border spinner-border-sm me-2" />
              Running Oracle Simulation...
            </div>
          )}

          {/* Key Metrics */}
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
              Metrics
            </div>
            <div
              style={{
                padding: 'var(--space-3)',
                background: 'rgba(255, 255, 255, 0.02)',
                borderRadius: 'var(--radius-md)',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Recruiter</span>
                  <span>{healthData.recruiterName || 'Unknown'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Hiring Manager</span>
                  <span>{healthData.hiringManagerName || 'Unknown'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Days Open</span>
                  <span>
                    {healthData.daysOpen}d
                    <span style={{ color: 'var(--text-tertiary)', marginLeft: '4px' }}>
                      (benchmark: {healthData.benchmarkTTF}d)
                    </span>
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Pipeline Depth</span>
                  <span style={{ color: healthData.pipelineGap < 0 ? '#ef4444' : 'inherit' }}>
                    {healthData.currentPipelineDepth}
                    <span style={{ marginLeft: '4px' }}>
                      ({healthData.pipelineGap >= 0 ? '+' : ''}{healthData.pipelineGap} vs benchmark)
                    </span>
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Last Activity</span>
                  <span style={{ color: healthData.daysSinceActivity > 7 ? '#f59e0b' : 'inherit' }}>
                    {healthData.daysSinceActivity}d ago
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Pipeline by Stage */}
          {healthData.candidatesByStage && Object.keys(healthData.candidatesByStage).length > 0 && (
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
                Pipeline by Stage
              </div>
              <div
                style={{
                  display: 'flex',
                  gap: '8px',
                  flexWrap: 'wrap',
                }}
              >
                {Object.entries(healthData.candidatesByStage).map(([stage, count]) => (
                  <div
                    key={stage}
                    style={{
                      padding: '8px 12px',
                      background: 'rgba(255, 255, 255, 0.03)',
                      borderRadius: 'var(--radius-sm)',
                      textAlign: 'center',
                    }}
                  >
                    <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 'var(--font-bold)', fontSize: 'var(--text-lg)' }}>
                      {count}
                    </div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                      {stage}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommended Actions */}
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
              Recommended Actions
            </div>
            {healthData.actionRecommendations && healthData.actionRecommendations.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {healthData.actionRecommendations.map((action, i) => {
                  const priorityStyle = getPriorityBadgeStyle(action.priority);
                  return (
                    <div
                      key={i}
                      style={{
                        padding: 'var(--space-3)',
                        background: 'rgba(255, 255, 255, 0.02)',
                        borderRadius: 'var(--radius-sm)',
                        borderLeft: `3px solid ${priorityStyle.color}`,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                        <span
                          className="badge text-uppercase"
                          style={{ fontSize: '0.6rem', ...priorityStyle }}
                        >
                          {action.priority}
                        </span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 'var(--font-medium)' }}>
                            {action.action}
                          </div>
                          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginTop: '4px' }}>
                            {action.expectedImpact}
                            <span style={{ color: 'var(--color-accent-primary, #d4a373)', marginLeft: '8px' }}>
                              ({action.owner})
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div
                style={{
                  padding: 'var(--space-4)',
                  background: 'rgba(16, 185, 129, 0.05)',
                  borderRadius: 'var(--radius-md)',
                  textAlign: 'center',
                  color: '#10b981',
                }}
              >
                No specific actions recommended - role is on track!
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export default ReqHealthDrawer;
