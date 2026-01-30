// ReqHealthDrawer - Unified slide-in drawer showing requisition health, Oracle prediction, and Pre-Mortem analysis
import React from 'react';
import { X } from 'lucide-react';
import { LogoSpinner } from '../../common/LogoSpinner';
import { RoleHealthMetrics } from '../../../types/forecastingTypes';
import { ForecastResult, SimulationParameters } from '../../../services/probabilisticEngine';
import { PreMortemResult, getRiskBandColor, getFailureModeLabel } from '../../../types/preMortemTypes';
import { OracleConfidenceWidget } from './OracleConfidenceWidget';
import { Candidate } from '../../../types';

// Health status badge styling (Tailwind classes)
function getHealthBadgeClass(status: string) {
  switch (status) {
    case 'on-track':
      return 'bg-good-bg text-good';
    case 'at-risk':
      return 'bg-warn-bg text-warn';
    case 'off-track':
      return 'bg-destructive/10 text-bad';
    default:
      return 'bg-white/10 text-muted-foreground';
  }
}

function getVelocityBadgeClass(trend: string) {
  switch (trend) {
    case 'improving':
      return 'bg-good-bg text-good';
    case 'stable':
      return 'bg-white/10 text-muted-foreground';
    case 'declining':
      return 'bg-warn-bg text-warn';
    case 'stalled':
      return 'bg-destructive/10 text-bad';
    default:
      return 'bg-white/10 text-muted-foreground';
  }
}

// Returns both badge class and border class for priority styling
function getPriorityStyles(priority: string): { badgeClass: string; borderClass: string } {
  switch (priority) {
    case 'urgent':
    case 'high':
    case 'critical':
      return { badgeClass: 'bg-destructive/10 text-bad', borderClass: 'border-l-bad' };
    case 'important':
    case 'medium':
      return { badgeClass: 'bg-warn-bg text-warn', borderClass: 'border-l-warn' };
    default:
      return { badgeClass: 'bg-white/10 text-muted-foreground', borderClass: 'border-l-white/20' };
  }
}

function getRiskBandBadgeClass(band: string) {
  switch (band) {
    case 'HIGH':
      return 'bg-destructive/10 text-bad';
    case 'MED':
      return 'bg-warn-bg text-warn';
    case 'LOW':
      return 'bg-good-bg text-good';
    default:
      return 'bg-white/10 text-muted-foreground';
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

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[1040] bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer - full-width on mobile, 560px on desktop */}
      <div className="fixed top-0 right-0 bottom-0 w-full md:w-[560px] z-[1050] flex flex-col overflow-hidden bg-card border-l border-border">
        {/* Header */}
        <div className="p-4 flex justify-between items-start border-b border-white/10">
          <div className="flex-1 min-w-0">
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
              Requisition Details
            </div>
            <div className="font-bold text-lg mb-2 overflow-hidden text-ellipsis whitespace-nowrap text-foreground">
              {healthData.reqTitle}
            </div>
            <div className="flex gap-2 items-center flex-wrap">
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full uppercase text-[0.65rem] font-medium ${getHealthBadgeClass(healthData.healthStatus)}`}>
                Score: {healthData.healthScore}
              </span>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full uppercase text-[0.65rem] font-medium ${getVelocityBadgeClass(healthData.velocityTrend)}`}>
                {healthData.velocityTrend}
              </span>
              {preMortem && (
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full uppercase text-[0.65rem] font-medium ${getRiskBandBadgeClass(preMortem.risk_band)}`}>
                  {preMortem.risk_band} Risk
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex items-center justify-center w-11 h-11 min-w-[44px] min-h-[44px] bg-transparent border-none text-muted-foreground cursor-pointer hover:text-foreground hover:bg-white/5 rounded-lg transition-colors ml-2"
            aria-label="Close drawer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {/* Oracle Widget - Primary Feature */}
          {forecast ? (
            <div className="mb-4">
              <OracleConfidenceWidget
                forecast={forecast}
                startDate={new Date()}
                simulationParams={simulationParams || undefined}
                pipelineCandidates={pipelineCandidates}
                reqId={reqId}
              />
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-card p-4 text-center mb-4 text-muted-foreground">
              <LogoSpinner size={32} message="Running Oracle Simulation..." layout="stacked" />
            </div>
          )}

          {/* Pre-Mortem Risk Analysis */}
          {preMortem && (
            <div className="mb-4">
              <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
                Risk Analysis
              </div>

              {/* Risk Score Card */}
              <div className="p-3 bg-white/[0.02] rounded-lg mb-3">
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <div
                      className="font-mono text-4xl font-bold leading-none"
                      style={{ color: getRiskBandColor(preMortem.risk_band) }}
                    >
                      {preMortem.risk_score}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      /100
                    </div>
                  </div>
                  <div className="flex-1">
                    <div
                      className="p-3 rounded-sm border-l-[3px]"
                      style={{
                        background: `${getRiskBandColor(preMortem.risk_band)}15`,
                        borderLeftColor: getRiskBandColor(preMortem.risk_band),
                      }}
                    >
                      <div className="text-xs text-muted-foreground mb-0.5">
                        Primary Failure Mode
                      </div>
                      <div
                        className="font-medium"
                        style={{ color: getRiskBandColor(preMortem.risk_band) }}
                      >
                        {getFailureModeLabel(preMortem.failure_mode)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Risk Drivers */}
              {preMortem.top_drivers && preMortem.top_drivers.length > 0 && (
                <div className="mb-3">
                  <div className="text-xs text-muted-foreground mb-2">
                    Risk Drivers
                  </div>
                  <div className="flex flex-col gap-2">
                    {preMortem.top_drivers.slice(0, 3).map((driver, i) => {
                      const { badgeClass, borderClass } = getPriorityStyles(driver.severity);
                      return (
                        <div
                          key={i}
                          className={`p-3 bg-white/[0.02] rounded-sm border-l-[3px] ${borderClass}`}
                        >
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="font-medium text-foreground mb-1">
                                {driver.description}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {driver.evidence.description}
                              </div>
                            </div>
                            <div className="text-right ml-3">
                              <span className={`inline-flex items-center uppercase text-[0.6rem] px-1.5 py-0.5 rounded ${badgeClass}`}>
                                {driver.severity}
                              </span>
                              <div className="text-xs text-muted-foreground mt-1">
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
          <div className="mb-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
              Metrics
            </div>
            <div className="p-3 bg-white/[0.02] rounded-lg">
              <div className="flex flex-col gap-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Recruiter</span>
                  <span className="text-foreground">{healthData.recruiterName || 'Unknown'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Hiring Manager</span>
                  <span className="text-foreground">{healthData.hiringManagerName || 'Unknown'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Days Open</span>
                  <span className="text-foreground">
                    {healthData.daysOpen}d
                    <span className="text-muted-foreground ml-1">
                      (benchmark: {healthData.benchmarkTTF}d)
                    </span>
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Pipeline Depth</span>
                  <span className={healthData.pipelineGap < 0 ? 'text-bad' : 'text-foreground'}>
                    {healthData.currentPipelineDepth}
                    <span className="ml-1">
                      ({healthData.pipelineGap >= 0 ? '+' : ''}{healthData.pipelineGap} vs benchmark)
                    </span>
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Last Activity</span>
                  {healthData.daysSinceActivity !== null ? (
                    <span className={healthData.daysSinceActivity > 7 ? 'text-warn' : 'text-foreground'}>
                      {healthData.daysSinceActivity}d ago
                    </span>
                  ) : (
                    <span className="text-muted-foreground">N/A</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Pipeline by Stage */}
          {healthData.candidatesByStage && Object.keys(healthData.candidatesByStage).length > 0 && (
            <div className="mb-4">
              <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
                Pipeline by Stage
              </div>
              <div className="flex gap-2 flex-wrap">
                {Object.entries(healthData.candidatesByStage).map(([stage, count]) => (
                  <div
                    key={stage}
                    className="px-3 py-2 bg-white/[0.03] rounded-sm text-center"
                  >
                    <div className="font-mono font-bold text-lg text-foreground">
                      {count}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {stage}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommended Actions - Merged from both sources */}
          <div>
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
              Recommended Actions
            </div>

            {/* Health-based actions */}
            {healthData.actionRecommendations && healthData.actionRecommendations.length > 0 ? (
              <div className="flex flex-col gap-2">
                {healthData.actionRecommendations.map((action, i) => {
                  const { badgeClass, borderClass } = getPriorityStyles(action.priority);
                  return (
                    <div
                      key={`health-${i}`}
                      className={`p-3 bg-white/[0.02] rounded-sm border-l-[3px] ${borderClass}`}
                    >
                      <div className="flex items-start gap-2">
                        <span className={`inline-flex items-center uppercase text-[0.6rem] px-1.5 py-0.5 rounded ${badgeClass}`}>
                          {action.priority}
                        </span>
                        <div className="flex-1">
                          <div className="font-medium text-foreground">
                            {action.action}
                          </div>
                          <div className="text-sm text-muted-foreground mt-1">
                            {action.expectedImpact}
                            <span className="text-accent ml-2">
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
                    const { badgeClass, borderClass } = getPriorityStyles(intervention.priority);
                    return (
                      <div
                        key={`pm-${i}`}
                        className={`p-3 bg-white/[0.02] rounded-sm border-l-[3px] ${borderClass}`}
                      >
                        <div className="flex items-start gap-2">
                          <span className={`inline-flex items-center uppercase text-[0.6rem] px-1.5 py-0.5 rounded ${badgeClass}`}>
                            {intervention.priority}
                          </span>
                          <div className="flex-1">
                            <div className="font-medium text-foreground">
                              {intervention.title}
                            </div>
                            <div className="text-sm text-muted-foreground mt-1">
                              {intervention.description}
                              <span className="text-accent ml-2">
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
              <div className="flex flex-col gap-2">
                {preMortem.recommended_interventions.map((intervention, i) => {
                  const { badgeClass, borderClass } = getPriorityStyles(intervention.priority);
                  return (
                    <div
                      key={i}
                      className={`p-3 bg-white/[0.02] rounded-sm border-l-[3px] ${borderClass}`}
                    >
                      <div className="flex items-start gap-2">
                        <span className={`inline-flex items-center uppercase text-[0.6rem] px-1.5 py-0.5 rounded ${badgeClass}`}>
                          {intervention.priority}
                        </span>
                        <div className="flex-1">
                          <div className="font-medium text-foreground">
                            {intervention.title}
                          </div>
                          <div className="text-sm text-muted-foreground mt-1">
                            {intervention.description}
                            <span className="text-accent ml-2">
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
              <div className="p-4 bg-good/5 rounded-lg text-center text-good">
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
