'use client';

import React, { useState, useMemo } from 'react';
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  TrendingDown,
  Users,
  Target,
  Zap,
  BarChart3,
  RefreshCw,
  ChevronRight,
  Activity,
  UserCheck,
  GitBranch,
  Gauge
} from 'lucide-react';
import { Button } from 'components/ui/button';
import { useDashboard } from '../../hooks/useDashboardContext';

// Import v1 tab components (still used for some views)
import { BottlenecksTab } from '../bottlenecks';
import { QualityTab } from '../quality';
import { SourceEffectivenessTab } from '../source-effectiveness/SourceEffectivenessTab';
import { VelocityInsightsTab } from '../velocity-insights/VelocityInsightsTab';

// Import v2 tab components
import { OverviewTabV2 } from './OverviewTabV2';
import { RecruiterDetailTabV2 } from './RecruiterDetailTabV2';
import { HiringManagersTabV2 } from './HiringManagersTabV2';
import { HMFrictionTabV2 } from './HMFrictionTabV2';

// Import services for computed data
import { calculateSourceEffectiveness, calculateVelocityMetrics, normalizeEventStages } from '../../services';
import {
  assessAllReqHealth,
  calculateDataHygieneSummary
} from '../../services/reqHealthService';
import {
  ReqHealthStatus,
  ReqHealthAssessment,
  DataHygieneSummary,
  DEFAULT_HYGIENE_SETTINGS
} from '../../types/dataHygieneTypes';

// Sub-view types for Diagnose tab
export type DiagnoseSubView =
  | 'overview'
  | 'recruiter'
  | 'hm-friction'
  | 'hiring-managers'
  | 'bottlenecks'
  | 'quality'
  | 'source-mix'
  | 'velocity';

interface DiagnoseTabV2Props {
  defaultSubView?: DiagnoseSubView;
  onSubViewChange?: (subView: DiagnoseSubView) => void;
}

interface DiagnosticItem {
  id: string;
  category: 'critical' | 'warning' | 'info' | 'success';
  title: string;
  description: string;
  metric: string;
  value: string | number;
  benchmark?: string;
  recommendation: string;
  affectedItems: string[];
  linkTo?: DiagnoseSubView;
}

const subViews: { id: DiagnoseSubView; label: string; icon: React.ReactNode }[] = [
  { id: 'overview', label: 'Overview', icon: <Activity className="w-4 h-4" /> },
  { id: 'recruiter', label: 'Recruiter', icon: <UserCheck className="w-4 h-4" /> },
  { id: 'hm-friction', label: 'HM Friction', icon: <Clock className="w-4 h-4" /> },
  { id: 'hiring-managers', label: 'Hiring Managers', icon: <Users className="w-4 h-4" /> },
  { id: 'bottlenecks', label: 'Bottlenecks', icon: <GitBranch className="w-4 h-4" /> },
  { id: 'quality', label: 'Quality', icon: <Target className="w-4 h-4" /> },
  { id: 'source-mix', label: 'Source Mix', icon: <BarChart3 className="w-4 h-4" /> },
  { id: 'velocity', label: 'Velocity', icon: <Gauge className="w-4 h-4" /> },
];

const categoryConfig = {
  critical: {
    icon: <AlertTriangle className="w-5 h-5" />,
    bg: 'bg-bad/10',
    border: 'border-bad/30',
    text: 'text-bad',
    pill: 'bg-bad/20 text-bad',
    label: 'Critical',
  },
  warning: {
    icon: <Clock className="w-5 h-5" />,
    bg: 'bg-warn/10',
    border: 'border-warn/30',
    text: 'text-warn',
    pill: 'bg-warn/20 text-warn',
    label: 'Warning',
  },
  info: {
    icon: <TrendingDown className="w-5 h-5" />,
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
    text: 'text-blue-400',
    pill: 'bg-blue-500/20 text-blue-400',
    label: 'Info',
  },
  success: {
    icon: <CheckCircle className="w-5 h-5" />,
    bg: 'bg-good/10',
    border: 'border-good/30',
    text: 'text-good',
    pill: 'bg-good/20 text-good',
    label: 'Healthy',
  },
};

// Loading skeleton for tabs
function TabSkeleton() {
  return (
    <div className="glass-panel p-6 animate-pulse">
      <div className="h-6 bg-white/[0.06] rounded w-48 mb-4" />
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-24 bg-white/[0.06] rounded" />
        ))}
      </div>
      <div className="h-64 bg-white/[0.06] rounded" />
    </div>
  );
}

// Empty state when no data is loaded
function EmptyState({ viewLabel }: { viewLabel: string }) {
  return (
    <div className="glass-panel p-8 text-center">
      <Activity className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
      <h3 className="text-lg font-semibold text-foreground mb-2">{viewLabel}</h3>
      <p className="text-sm text-muted-foreground max-w-md mx-auto">
        Import data to view {viewLabel.toLowerCase()} analytics.
      </p>
    </div>
  );
}

// Generate diagnostics from dashboard data
function generateDiagnostics(
  state: ReturnType<typeof useDashboard>['state'],
  hmFriction: ReturnType<typeof useDashboard>['state']['hmFriction'],
  hygieneSummary: DataHygieneSummary | null,
  reqAssessments: ReqHealthAssessment[]
): DiagnosticItem[] {
  const diagnostics: DiagnosticItem[] = [];
  const { overview, dataStore } = state;

  // Data hygiene diagnostics from reqHealthService
  if (hygieneSummary) {
    // Zombie reqs (critical)
    if (hygieneSummary.zombieReqCount > 0) {
      const zombieReqs = reqAssessments.filter(r => r.status === ReqHealthStatus.ZOMBIE);
      const reqsMap = new Map(dataStore.requisitions.map(r => [r.req_id, r]));
      diagnostics.push({
        id: 'zombie-reqs',
        category: 'critical',
        title: 'Zombie Requisitions Detected',
        description: `${hygieneSummary.zombieReqCount} requisitions have no candidate activity in 30+ days`,
        metric: 'Zombie Reqs',
        value: hygieneSummary.zombieReqCount,
        benchmark: 'Target: 0',
        recommendation: 'Review and either revive with fresh sourcing or close these stale requisitions',
        affectedItems: zombieReqs.slice(0, 3).map(a => reqsMap.get(a.reqId)?.req_title || a.reqId),
        linkTo: 'overview',
      });
    }

    // Stalled reqs (warning)
    if (hygieneSummary.stalledReqCount > 0) {
      const stalledReqs = reqAssessments.filter(r => r.status === ReqHealthStatus.STALLED);
      const reqsMap = new Map(dataStore.requisitions.map(r => [r.req_id, r]));
      diagnostics.push({
        id: 'stalled-reqs',
        category: 'warning',
        title: 'Stalled Requisitions',
        description: `${hygieneSummary.stalledReqCount} requisitions have no activity in 14-30 days`,
        metric: 'Stalled Reqs',
        value: hygieneSummary.stalledReqCount,
        benchmark: 'Target: 0',
        recommendation: 'Schedule check-ins with recruiters to unblock these requisitions',
        affectedItems: stalledReqs.slice(0, 3).map(a => reqsMap.get(a.reqId)?.req_title || a.reqId),
        linkTo: 'bottlenecks',
      });
    }
  }

  // HM Friction diagnostics from the HiringManagerFriction array
  if (hmFriction && hmFriction.length > 0) {
    // Calculate average feedback latency across all HMs
    const hmsWithLatency = hmFriction.filter(hm => hm.feedbackLatencyMedian !== null);
    const avgLatencyHours = hmsWithLatency.length > 0
      ? hmsWithLatency.reduce((sum, hm) => sum + (hm.feedbackLatencyMedian || 0), 0) / hmsWithLatency.length
      : 0;
    const avgLatencyDays = avgLatencyHours / 24;

    // Find slow HMs (> 72 hours median feedback latency)
    const slowHMs = hmFriction.filter(hm =>
      hm.feedbackLatencyMedian !== null && hm.feedbackLatencyMedian > 72
    );

    if (slowHMs.length > 0) {
      const criticalHMs = slowHMs.filter(hm => (hm.feedbackLatencyMedian || 0) > 120); // > 5 days

      if (criticalHMs.length > 0) {
        diagnostics.push({
          id: 'hm-overdue',
          category: 'critical',
          title: 'HM Response Time Critical',
          description: `${criticalHMs.length} hiring managers have median feedback time over 5 days`,
          metric: 'Slow HMs',
          value: criticalHMs.length,
          benchmark: 'Target: 0',
          recommendation: 'Escalate to leadership and establish direct feedback workflows',
          affectedItems: criticalHMs.slice(0, 3).map(hm =>
            `${hm.hmName} (${((hm.feedbackLatencyMedian || 0) / 24).toFixed(1)}d)`
          ),
          linkTo: 'hm-friction',
        });
      } else {
        diagnostics.push({
          id: 'hm-slow',
          category: 'warning',
          title: 'HM Response Time Elevated',
          description: `${slowHMs.length} hiring managers have median feedback time over 3 days`,
          metric: 'Slow HMs',
          value: slowHMs.length,
          benchmark: 'Target: 0',
          recommendation: 'Schedule recurring feedback syncs with slow responders',
          affectedItems: slowHMs.slice(0, 3).map(hm =>
            `${hm.hmName} (${((hm.feedbackLatencyMedian || 0) / 24).toFixed(1)}d)`
          ),
          linkTo: 'hm-friction',
        });
      }
    }

    // Overall latency check
    if (avgLatencyDays > 3) {
      diagnostics.push({
        id: 'hm-latency',
        category: 'warning',
        title: 'Elevated Average HM Response Time',
        description: 'Overall hiring manager response time exceeds target',
        metric: 'Avg Response Time',
        value: `${avgLatencyDays.toFixed(1)} days`,
        benchmark: 'Target: < 3 days',
        recommendation: 'Implement SLA reminders or escalation workflows',
        affectedItems: [],
        linkTo: 'hm-friction',
      });
    }
  }

  // Recruiter capacity diagnostics
  if (overview?.recruiterSummaries) {
    const overloaded = overview.recruiterSummaries.filter(r => r.activeReqLoad > 15);
    if (overloaded.length > 0) {
      diagnostics.push({
        id: 'recruiter-overload',
        category: 'critical',
        title: 'Recruiter Capacity Overload',
        description: `${overloaded.length} recruiters are handling more than 15 open requisitions`,
        metric: 'Overloaded Recruiters',
        value: overloaded.length,
        benchmark: 'Target: 0',
        recommendation: 'Redistribute workload or bring on additional recruiting support',
        affectedItems: overloaded.slice(0, 3).map(r => `${r.recruiterName} (${r.activeReqLoad} reqs)`),
        linkTo: 'recruiter',
      });
    }
  }

  // Pipeline health diagnostics
  if (overview) {
    // Accept rate check
    const acceptRate = overview.totalOfferAcceptanceRate;
    if (acceptRate !== null && acceptRate < 80) {
      diagnostics.push({
        id: 'accept-rate',
        category: acceptRate < 60 ? 'critical' : 'warning',
        title: 'Low Offer Accept Rate',
        description: 'Offer acceptance rate is below target threshold',
        metric: 'Accept Rate',
        value: `${acceptRate.toFixed(0)}%`,
        benchmark: 'Target: > 80%',
        recommendation: 'Review compensation competitiveness and candidate experience',
        affectedItems: [],
        linkTo: 'quality',
      });
    } else if (acceptRate !== null && acceptRate >= 85) {
      diagnostics.push({
        id: 'accept-rate-good',
        category: 'success',
        title: 'Strong Offer Accept Rate',
        description: 'Offer acceptance rate exceeds target threshold',
        metric: 'Accept Rate',
        value: `${acceptRate.toFixed(0)}%`,
        benchmark: 'Benchmark: 80%',
        recommendation: 'Continue current approach to offers and candidate experience',
        affectedItems: [],
        linkTo: 'quality',
      });
    }

    // TTF check
    const medianTTF = overview.medianTTF;
    if (medianTTF !== null && medianTTF > 45) {
      diagnostics.push({
        id: 'ttf-slow',
        category: medianTTF > 60 ? 'critical' : 'warning',
        title: 'Elevated Time-to-Fill',
        description: 'Median time-to-fill exceeds target threshold',
        metric: 'Median TTF',
        value: `${medianTTF.toFixed(0)} days`,
        benchmark: 'Target: < 45 days',
        recommendation: 'Identify bottleneck stages and implement process improvements',
        affectedItems: [],
        linkTo: 'velocity',
      });
    } else if (medianTTF !== null && medianTTF <= 35) {
      diagnostics.push({
        id: 'ttf-good',
        category: 'success',
        title: 'Excellent Time-to-Fill',
        description: 'Median time-to-fill is significantly below target',
        metric: 'Median TTF',
        value: `${medianTTF.toFixed(0)} days`,
        benchmark: 'Benchmark: 45 days',
        recommendation: 'Document and share best practices across the team',
        affectedItems: [],
        linkTo: 'velocity',
      });
    }
  }

  // Source mix diagnostics
  const candidates = dataStore.candidates;
  if (candidates.length > 0) {
    const sourceBreakdown = candidates.reduce((acc, c) => {
      const src = c.source || 'Unknown';
      acc[src] = (acc[src] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const referralCount = sourceBreakdown['Referral'] || sourceBreakdown['Employee Referral'] || 0;
    const referralPct = (referralCount / candidates.length) * 100;

    if (referralPct > 25) {
      diagnostics.push({
        id: 'referrals-strong',
        category: 'success',
        title: 'Strong Referral Pipeline',
        description: 'Employee referrals are contributing significantly to the pipeline',
        metric: 'Referral %',
        value: `${referralPct.toFixed(0)}%`,
        benchmark: 'Benchmark: 20%',
        recommendation: 'Consider expanding referral bonus program to capitalize on this channel',
        affectedItems: [],
        linkTo: 'source-mix',
      });
    } else if (referralPct < 10 && candidates.length > 50) {
      diagnostics.push({
        id: 'referrals-low',
        category: 'info',
        title: 'Low Referral Volume',
        description: 'Employee referrals are underrepresented in the pipeline',
        metric: 'Referral %',
        value: `${referralPct.toFixed(0)}%`,
        benchmark: 'Target: > 15%',
        recommendation: 'Review and promote referral program to increase employee participation',
        affectedItems: [],
        linkTo: 'source-mix',
      });
    }
  }

  return diagnostics;
}

export function DiagnoseTabV2({ defaultSubView = 'overview', onSubViewChange }: DiagnoseTabV2Props) {
  const { state, selectRecruiter, updateConfig, aiConfig } = useDashboard();
  const [activeSubView, setActiveSubView] = useState<DiagnoseSubView>(defaultSubView);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isScanning, setIsScanning] = useState(false);

  const handleSubViewChange = (subView: DiagnoseSubView) => {
    setActiveSubView(subView);
    onSubViewChange?.(subView);
  };

  // Compute source effectiveness data
  const sourceEffectiveness = useMemo(() => {
    if (!state.dataStore.candidates.length) return null;
    const normalizedEvents = normalizeEventStages(
      state.dataStore.events,
      state.dataStore.config.stageMapping
    );
    return calculateSourceEffectiveness(
      state.dataStore.candidates,
      state.dataStore.requisitions,
      normalizedEvents,
      state.filters
    );
  }, [state.dataStore.candidates, state.dataStore.requisitions, state.dataStore.events, state.dataStore.config.stageMapping, state.filters]);

  // Compute velocity metrics
  const velocityMetrics = useMemo(() => {
    if (!state.dataStore.requisitions.length) return null;
    return calculateVelocityMetrics(
      state.dataStore.candidates,
      state.dataStore.requisitions,
      state.dataStore.events,
      state.dataStore.users,
      state.filters
    );
  }, [state.dataStore.requisitions, state.dataStore.candidates, state.dataStore.events, state.dataStore.users, state.filters]);

  // Calculate req health assessments for zombie/stalled detection
  const reqAssessments = useMemo(() => {
    if (!state.dataStore.requisitions.length) return [];
    return assessAllReqHealth(
      state.dataStore.requisitions,
      state.dataStore.candidates,
      state.dataStore.events,
      DEFAULT_HYGIENE_SETTINGS
    );
  }, [state.dataStore.requisitions, state.dataStore.candidates, state.dataStore.events]);

  // Calculate data hygiene summary
  const hygieneSummary = useMemo(() => {
    if (!state.dataStore.requisitions.length) return null;
    return calculateDataHygieneSummary(
      state.dataStore.requisitions,
      state.dataStore.candidates,
      state.dataStore.events,
      state.dataStore.users,
      DEFAULT_HYGIENE_SETTINGS
    );
  }, [state.dataStore.requisitions, state.dataStore.candidates, state.dataStore.events, state.dataStore.users]);

  // Generate diagnostics from real data
  const diagnostics = useMemo(() => {
    if (!state.loadingState.hasOverviewMetrics) return [];
    return generateDiagnostics(state, state.hmFriction, hygieneSummary, reqAssessments);
  }, [state, state.hmFriction, hygieneSummary, reqAssessments]);

  const filteredDiagnostics = selectedCategory === 'all'
    ? diagnostics
    : diagnostics.filter(d => d.category === selectedCategory);

  const criticalCount = diagnostics.filter(d => d.category === 'critical').length;
  const warningCount = diagnostics.filter(d => d.category === 'warning').length;
  const healthyCount = diagnostics.filter(d => d.category === 'success').length;
  const infoCount = diagnostics.filter(d => d.category === 'info').length;

  const healthScore = diagnostics.length > 0
    ? Math.round(
        ((healthyCount * 100) + (infoCount * 70) + (warningCount * 40) + (criticalCount * 10)) /
        diagnostics.length
      )
    : 100;

  const handleScan = () => {
    setIsScanning(true);
    setTimeout(() => setIsScanning(false), 2000);
  };

  // Handler for recruiter selection
  const handleSelectRecruiter = (recruiterId: string) => {
    selectRecruiter(recruiterId);
    handleSubViewChange('recruiter');
  };

  // Render the diagnostics overview view
  const renderDiagnosticsView = () => {
    const hasData = state.loadingState.hasOverviewMetrics && state.overview;

    if (!hasData) {
      return <EmptyState viewLabel="Diagnostics" />;
    }

    return (
      <>
        {/* Health Score Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className={`glass-panel p-4 text-left transition-all ${
              selectedCategory === 'all' ? 'ring-1 ring-accent' : ''
            }`}
          >
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
              Health Score
            </div>
            <div className="text-2xl font-bold text-foreground font-mono">{healthScore}%</div>
          </button>

          <button
            type="button"
            onClick={() => setSelectedCategory('critical')}
            className={`glass-panel p-4 text-left transition-all ${
              selectedCategory === 'critical' ? 'ring-1 ring-bad' : ''
            }`}
          >
            <div className="text-xs font-medium text-bad uppercase tracking-wider mb-1">
              Critical
            </div>
            <div className="text-2xl font-bold text-bad font-mono">{criticalCount}</div>
          </button>

          <button
            type="button"
            onClick={() => setSelectedCategory('warning')}
            className={`glass-panel p-4 text-left transition-all ${
              selectedCategory === 'warning' ? 'ring-1 ring-warn' : ''
            }`}
          >
            <div className="text-xs font-medium text-warn uppercase tracking-wider mb-1">
              Warnings
            </div>
            <div className="text-2xl font-bold text-warn font-mono">{warningCount}</div>
          </button>

          <button
            type="button"
            onClick={() => setSelectedCategory('success')}
            className={`glass-panel p-4 text-left transition-all ${
              selectedCategory === 'success' ? 'ring-1 ring-good' : ''
            }`}
          >
            <div className="text-xs font-medium text-good uppercase tracking-wider mb-1">
              Healthy
            </div>
            <div className="text-2xl font-bold text-good font-mono">{healthyCount}</div>
          </button>
        </div>

        {/* Diagnostics List */}
        {filteredDiagnostics.length > 0 ? (
          <div className="space-y-3">
            {filteredDiagnostics.map((diag) => {
              const config = categoryConfig[diag.category];
              return (
                <div
                  key={diag.id}
                  className={`glass-panel p-4 border ${config.border} ${config.bg}`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`${config.text} mt-0.5`}>
                      {config.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${config.pill}`}>
                          {config.label}
                        </span>
                        <h4 className="text-sm font-medium text-foreground">{diag.title}</h4>
                      </div>
                      <p className="text-xs text-muted-foreground mb-2">{diag.description}</p>

                      <div className="flex flex-wrap gap-4 text-xs mb-2">
                        <div>
                          <span className="text-muted-foreground/70">{diag.metric}: </span>
                          <span className="text-foreground font-mono font-medium">{diag.value}</span>
                        </div>
                        {diag.benchmark && (
                          <div className="text-muted-foreground/70">{diag.benchmark}</div>
                        )}
                      </div>

                      <div className="text-xs text-muted-foreground mb-2">
                        <span className="text-muted-foreground/70">Recommendation: </span>
                        {diag.recommendation}
                      </div>

                      {diag.affectedItems.length > 0 && (
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs text-muted-foreground/70">Affected:</span>
                          {diag.affectedItems.slice(0, 3).map((item, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 rounded text-[10px] bg-white/[0.06] text-muted-foreground"
                            >
                              {item}
                            </span>
                          ))}
                          {diag.affectedItems.length > 3 && (
                            <span className="text-[10px] text-muted-foreground/70">
                              +{diag.affectedItems.length - 3} more
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {diag.linkTo && (
                      <button
                        type="button"
                        onClick={() => handleSubViewChange(diag.linkTo!)}
                        className="flex items-center gap-1 px-2 py-1 rounded text-xs text-accent hover:bg-accent/10 transition-colors"
                      >
                        View Details
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="glass-panel p-8 text-center">
            <CheckCircle className="w-12 h-12 text-good mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">All Systems Healthy</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              {selectedCategory === 'all'
                ? 'No issues detected. Your recruiting pipeline is running smoothly.'
                : `No ${selectedCategory} issues found. Try viewing all diagnostics.`}
            </p>
          </div>
        )}
      </>
    );
  };

  // Handler for recruiter selection from OverviewTabV2
  const handleSelectRecruiterFromOverview = (recruiterId: string) => {
    selectRecruiter(recruiterId);
    handleSubViewChange('recruiter');
  };

  // Render the appropriate sub-view content
  const renderContent = () => {
    const hasData = state.loadingState.hasOverviewMetrics && state.overview;

    switch (activeSubView) {
      case 'overview':
        if (!hasData) {
          return <EmptyState viewLabel="Overview" />;
        }
        return <OverviewTabV2 onSelectRecruiter={handleSelectRecruiterFromOverview} />;

      case 'recruiter':
        if (!state.loadingState.hasRecruiterMetrics || !state.overview) {
          return <EmptyState viewLabel="Recruiter Detail" />;
        }
        return (
          <RecruiterDetailTabV2
            onSelectRecruiter={(id) => {
              selectRecruiter(id || '');
            }}
          />
        );

      case 'hm-friction':
        if (!state.loadingState.hasHMMetrics) {
          return <EmptyState viewLabel="HM Friction" />;
        }
        return <HMFrictionTabV2 />;

      case 'hiring-managers':
        if (!state.dataStore.requisitions.length) {
          return <EmptyState viewLabel="Hiring Managers" />;
        }
        return <HiringManagersTabV2 />;

      case 'bottlenecks':
        if (!state.dataStore.requisitions.length) {
          return <EmptyState viewLabel="Bottlenecks" />;
        }
        return (
          <BottlenecksTab
            onNavigate={(path: string) => {
              console.log('[DiagnoseTabV2] Navigate to:', path);
            }}
            onCreateActions={() => {
              console.log('[DiagnoseTabV2] Create actions');
            }}
          />
        );

      case 'quality':
        if (!state.loadingState.hasQualityMetrics || !state.qualityMetrics) {
          return <EmptyState viewLabel="Quality" />;
        }
        return <QualityTab quality={state.qualityMetrics} />;

      case 'source-mix':
        if (!sourceEffectiveness) {
          return <EmptyState viewLabel="Source Mix" />;
        }
        return <SourceEffectivenessTab data={sourceEffectiveness} />;

      case 'velocity':
        if (!velocityMetrics) {
          return <EmptyState viewLabel="Velocity" />;
        }
        return (
          <VelocityInsightsTab
            metrics={velocityMetrics}
            requisitions={state.dataStore.requisitions}
            candidates={state.dataStore.candidates}
            events={state.dataStore.events}
            users={state.dataStore.users}
            hmFriction={state.hmFriction}
            config={state.dataStore.config}
            filters={state.filters}
            onUpdateConfig={updateConfig}
            aiConfig={aiConfig}
          />
        );

      default:
        return <EmptyState viewLabel="Overview" />;
    }
  };

  return (
    <div className="min-h-screen">
      {/* Page Header with Sub-navigation */}
      <div className="sticky top-[52px] z-40 bg-[rgba(15,23,42,0.97)] backdrop-blur-xl border-b border-white/[0.06]">
        <div className="px-4 md:px-6 py-3 max-w-[1600px] mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
            <div>
              <h1 className="text-lg md:text-xl font-bold text-foreground tracking-tight">
                Diagnose
              </h1>
              <p className="text-xs text-muted-foreground">
                System health diagnostics and pipeline analysis
              </p>
            </div>
            {activeSubView === 'overview' && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleScan}
                disabled={isScanning}
                className="bg-transparent border-white/[0.08] text-foreground hover:bg-white/[0.06]"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isScanning ? 'animate-spin' : ''}`} />
                {isScanning ? 'Scanning...' : 'Run Diagnostics'}
              </Button>
            )}
          </div>

          {/* Sub-navigation pills */}
          <div className="flex gap-1 overflow-x-auto pb-1 -mx-4 px-4 md:mx-0 md:px-0 scrollbar-hide">
            {subViews.map((view) => (
              <button
                key={view.id}
                type="button"
                onClick={() => handleSubViewChange(view.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${
                  activeSubView === view.id
                    ? 'bg-accent/10 text-accent'
                    : 'text-muted-foreground hover:bg-white/[0.06] hover:text-foreground'
                }`}
              >
                {view.icon}
                <span>{view.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="p-4 md:p-6 max-w-[1600px] mx-auto">
        {renderContent()}
      </div>
    </div>
  );
}

export default DiagnoseTabV2;
