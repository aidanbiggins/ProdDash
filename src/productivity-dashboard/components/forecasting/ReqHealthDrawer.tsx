// ReqHealthDrawer - Unified slide-in drawer showing requisition health, Oracle prediction, and Pre-Mortem analysis
import React from 'react';
import { LogoSpinner } from '../common/LogoSpinner';
import { RoleHealthMetrics } from '../../types/forecastingTypes';
import { ForecastResult, SimulationParameters } from '../../services/probabilisticEngine';
import { PreMortemResult, getRiskBandColor, getFailureModeLabel } from '../../types/preMortemTypes';
import { OracleConfidenceWidget } from './OracleConfidenceWidget';
import { Candidate } from '../../types';

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
    case 'high':
      return { background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' };
    case 'important':
    case 'medium':
      return { background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' };
    default:
      return { background: 'rgba(100, 116, 139, 0.15)', color: '#64748b' };
  }
}

function getRiskBandBadgeStyle(band: string) {
  switch (band) {
    case 'HIGH':
      return { background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' };
    case 'MED':
      return { background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' };
    case 'LOW':
      return { background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' };
    default:
      return { background: 'rgba(100, 116, 139, 0.15)', color: '#64748b' };
  }
}

interface ReqHealthDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  healthData: RoleHealthMetrics | null | undefined;
  forecast: ForecastResult | null;
  preMortem: PreMortemResult | null | undefined;
  simulationParams?: SimulationParameters | null;
  /** Pipeline candidates for this req - required for What-If analysis to work correctly */
  pipelineCandidates?: Candidate[];
  /** Req ID for caching */
  reqId?: string;
}

export function ReqHealthDrawer({
  isOpen,
  onClose,
  healthData,
  forecast,
  preMortem,
  simulationParams,
  pipelineCandidates = [],
  reqId,
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
              Requisition Details
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
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <span
                className="inline-flex items-center rounded-full uppercase"
                style={{ fontSize: '0.65rem', ...healthBadgeStyle }}
              >
                Score: {healthData.healthScore}
              </span>
              <span
                className="inline-flex items-center rounded-full uppercase"
                style={{ fontSize: '0.65rem', ...velocityBadgeStyle }}
              >
                {healthData.velocityTrend}
              </span>
              {preMortem && (
                <span
                  className="inline-flex items-center rounded-full uppercase"
                  style={{ fontSize: '0.65rem', ...getRiskBandBadgeStyle(preMortem.risk_band) }}
                >
                  {preMortem.risk_band} Risk
                </span>
              )}
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
          {/* Oracle Widget - Primary Feature */}
          {forecast ? (
            <div style={{ marginBottom: 'var(--space-4)' }}>
              <OracleConfidenceWidget
                forecast={forecast}
                startDate={new Date()}
                simulationParams={simulationParams || undefined}
                pipelineCandidates={pipelineCandidates}
                reqId={reqId}
              />
            </div>
          ) : (
            <div
              className="glass-panel p-4 text-center mb-4"
              style={{ color: 'var(--text-tertiary)' }}
            >
              <LogoSpinner size={32} message="Running Oracle Simulation..." layout="stacked" />
            </div>
          )}

          {/* Pre-Mortem Risk Analysis */}
          {preMortem && (
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
                Risk Analysis
              </div>

              {/* Risk Score Card */}
              <div
                style={{
                  padding: 'var(--space-3)',
                  background: 'rgba(255, 255, 255, 0.02)',
                  borderRadius: 'var(--radius-md)',
                  marginBottom: 'var(--space-3)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '2.5rem',
                        fontWeight: 'var(--font-bold)',
                        color: getRiskBandColor(preMortem.risk_band),
                        lineHeight: 1,
                      }}
                    >
                      {preMortem.risk_score}
                    </div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                      /100
                    </div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        padding: '8px 12px',
                        background: `${getRiskBandColor(preMortem.risk_band)}15`,
                        borderLeft: `3px solid ${getRiskBandColor(preMortem.risk_band)}`,
                        borderRadius: 'var(--radius-sm)',
                      }}
                    >
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginBottom: '2px' }}>
                        Primary Failure Mode
                      </div>
                      <div style={{ fontWeight: 'var(--font-medium)', color: getRiskBandColor(preMortem.risk_band) }}>
                        {getFailureModeLabel(preMortem.failure_mode)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Risk Drivers */}
              {preMortem.top_drivers && preMortem.top_drivers.length > 0 && (
                <div style={{ marginBottom: 'var(--space-3)' }}>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginBottom: '8px' }}>
                    Risk Drivers
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {preMortem.top_drivers.slice(0, 3).map((driver, i) => {
                      const severityStyle = getPriorityBadgeStyle(driver.severity);
                      return (
                        <div
                          key={i}
                          style={{
                            padding: 'var(--space-3)',
                            background: 'rgba(255, 255, 255, 0.02)',
                            borderRadius: 'var(--radius-sm)',
                            borderLeft: `3px solid ${severityStyle.color}`,
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: 'var(--font-medium)', marginBottom: '4px' }}>
                                {driver.description}
                              </div>
                              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                                {driver.evidence.description}
                              </div>
                            </div>
                            <div style={{ textAlign: 'right', marginLeft: '12px' }}>
                              <span
                                className="inline-flex items-center uppercase"
                                style={{ fontSize: '0.6rem', ...severityStyle }}
                              >
                                {driver.severity}
                              </span>
                              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                                {Math.round(driver.weight)}% weight
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
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

          {/* Recommended Actions - Merged from both sources */}
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

            {/* Health-based actions */}
            {healthData.actionRecommendations && healthData.actionRecommendations.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {healthData.actionRecommendations.map((action, i) => {
                  const priorityStyle = getPriorityBadgeStyle(action.priority);
                  return (
                    <div
                      key={`health-${i}`}
                      style={{
                        padding: 'var(--space-3)',
                        background: 'rgba(255, 255, 255, 0.02)',
                        borderRadius: 'var(--radius-sm)',
                        borderLeft: `3px solid ${priorityStyle.color}`,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                        <span
                          className="inline-flex items-center uppercase"
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

                {/* Pre-Mortem interventions */}
                {preMortem?.recommended_interventions && preMortem.recommended_interventions.length > 0 && (
                  preMortem.recommended_interventions.slice(0, 2).map((intervention, i) => {
                    const priorityStyle = getPriorityBadgeStyle(intervention.priority);
                    return (
                      <div
                        key={`pm-${i}`}
                        style={{
                          padding: 'var(--space-3)',
                          background: 'rgba(255, 255, 255, 0.02)',
                          borderRadius: 'var(--radius-sm)',
                          borderLeft: `3px solid ${priorityStyle.color}`,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                          <span
                            className="inline-flex items-center uppercase"
                            style={{ fontSize: '0.6rem', ...priorityStyle }}
                          >
                            {intervention.priority}
                          </span>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 'var(--font-medium)' }}>
                              {intervention.title}
                            </div>
                            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginTop: '4px' }}>
                              {intervention.description}
                              <span style={{ color: 'var(--color-accent-primary, #d4a373)', marginLeft: '8px' }}>
                                ({intervention.owner_type})
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            ) : preMortem?.recommended_interventions && preMortem.recommended_interventions.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {preMortem.recommended_interventions.map((intervention, i) => {
                  const priorityStyle = getPriorityBadgeStyle(intervention.priority);
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
                          className="inline-flex items-center uppercase"
                          style={{ fontSize: '0.6rem', ...priorityStyle }}
                        >
                          {intervention.priority}
                        </span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 'var(--font-medium)' }}>
                            {intervention.title}
                          </div>
                          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginTop: '4px' }}>
                            {intervention.description}
                            <span style={{ color: 'var(--color-accent-primary, #d4a373)', marginLeft: '8px' }}>
                              ({intervention.owner_type})
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
