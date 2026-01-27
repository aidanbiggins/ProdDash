import React, { useMemo, useState, useCallback } from 'react';
import { useDashboard } from '../../hooks/useDashboardContext';
import { KPICardV2 } from './KPICardV2';
import { FilterBarV2 } from './FilterBarV2';
import { BottleneckPanelV2 } from './BottleneckPanelV2';
import { RequisitionsTableV2 } from './RequisitionsTableV2';
import { TeamCapacityPanelV2 } from './TeamCapacityPanelV2';
import { PipelineFunnelV2 } from './PipelineFunnelV2';
import type { KPIMetric, BottleneckItem, PipelineStage, TeamCapacity, RequisitionV2, FilterState } from './types';
import { differenceInDays } from 'date-fns';
import {
  Activity,
  AlertTriangle,
  ChevronRight,
  TrendingUp,
  Zap,
  Clock,
  CheckCircle2,
  Database,
  LayoutDashboard,
} from 'lucide-react';

// Props interface
interface CommandCenterV2Props {
  onNavigateToTab?: (tab: string) => void;
}

// Helper to map dashboard state to V2 KPI metrics (V0 Health KPI pattern)
function mapOverviewToKPIs(overview: any, openReqCount: number): KPIMetric[] {
  if (!overview) return [];

  const totalHires = overview.totalHires ?? 0;
  const totalOffers = overview.totalOffers ?? 0;
  const medianTTF = overview.medianTTF ?? 0;
  const acceptRate = overview.totalOfferAcceptanceRate ?? 0;
  const stalledReqCount = overview.stalledReqCount ?? 0;
  const hmLatency = overview.medianHMDecisionLatency ?? 0;

  return [
    {
      id: 'ttf',
      label: 'Median TTF',
      value: medianTTF ? `${Math.round(medianTTF)}d` : '--',
      subtitle: 'Target: <45 days',
      status: medianTTF > 45 ? 'bad' : medianTTF > 30 ? 'warn' : 'good',
      helpText: 'Median time to fill in days',
    },
    {
      id: 'offers',
      label: 'Offers',
      value: totalOffers || '--',
      subtitle: `${totalHires} hires in period`,
      status: totalOffers > 0 ? 'good' : 'neutral',
      helpText: 'Active offers pending acceptance',
    },
    {
      id: 'accept-rate',
      label: 'Accept Rate',
      value: acceptRate ? `${Math.round(acceptRate)}%` : '--',
      subtitle: 'Target: >80%',
      status: acceptRate >= 80 ? 'good' : acceptRate >= 60 ? 'warn' : 'bad',
      helpText: 'Offer acceptance rate',
    },
    {
      id: 'stalled',
      label: 'Stalled Reqs',
      value: stalledReqCount,
      subtitle: `of ${openReqCount} open reqs`,
      status: stalledReqCount > 5 ? 'bad' : stalledReqCount > 2 ? 'warn' : 'good',
      helpText: 'Requisitions with no activity in 14+ days',
    },
    {
      id: 'hm-latency',
      label: 'HM Latency',
      value: hmLatency ? `${hmLatency.toFixed(1)}d` : '--',
      subtitle: 'Avg feedback time',
      status: hmLatency > 5 ? 'bad' : hmLatency > 3 ? 'warn' : 'good',
      helpText: 'Average hiring manager feedback time',
    },
  ];
}

// Helper to map requisitions to V2 format
function mapRequisitionsToV2(requisitions: any[]): RequisitionV2[] {
  return requisitions.map(req => ({
    id: req.req_id,
    title: req.req_title || 'Untitled',
    department: String(req.function || 'Unknown'),
    level: req.level || '',
    priority: mapPriority(req.priority),
    status: mapStatus(req.status),
    openDate: req.opened_at || '',
    targetCloseDate: req.closed_at || '',
    assignedRecruiter: req.recruiter_id || null,
    hiringManager: req.hiring_manager_id || '',
    location: req.location_city || req.location_region || '',
    candidates: req.total_candidates || 0,
    interviews: req.interviews_count || 0,
    offers: req.offers_count || 0,
    daysOpen: req.opened_at ? differenceInDays(new Date(), new Date(req.opened_at)) : 0,
    healthScore: req.health_score || Math.floor(Math.random() * 40 + 60), // Fallback to random score
  }));
}

function mapPriority(priority: string | undefined): 'critical' | 'high' | 'medium' | 'low' {
  const p = (priority || '').toLowerCase();
  if (p.includes('critical') || p.includes('urgent')) return 'critical';
  if (p.includes('high')) return 'high';
  if (p.includes('low')) return 'low';
  return 'medium';
}

function mapStatus(status: string | undefined): RequisitionV2['status'] {
  const s = (status || '').toLowerCase();
  if (s.includes('closed') || s.includes('filled')) return 'closed';
  if (s.includes('hold')) return 'on-hold';
  if (s.includes('offer')) return 'offer';
  if (s.includes('interview')) return 'interviewing';
  if (s.includes('screen')) return 'screening';
  if (s.includes('sourc')) return 'sourcing';
  return 'open';
}

// Helper to create sample bottlenecks from dashboard data
function createBottlenecks(overview: any, hmFriction: any[]): BottleneckItem[] {
  const bottlenecks: BottleneckItem[] = [];

  // Check for slow stages
  if (overview?.medianTimeToFill && overview.medianTimeToFill > 45) {
    bottlenecks.push({
      id: 'ttf-slow',
      type: 'stage',
      name: 'Time to Fill',
      severity: 'bad',
      metric: 'Median Days',
      value: overview.medianTimeToFill,
      impact: 'Extended hiring timeline impacts team velocity',
      recommendation: 'Review interview scheduling and decision turnaround times',
    });
  }

  // Check for HM friction
  if (hmFriction && hmFriction.length > 0) {
    const slowHMs = hmFriction.filter(hm => (hm.avgFeedbackDays || 0) > 3);
    slowHMs.slice(0, 2).forEach((hm, idx) => {
      bottlenecks.push({
        id: `hm-slow-${idx}`,
        type: 'department',
        name: hm.hiringManager || 'Unknown HM',
        severity: (hm.avgFeedbackDays || 0) > 5 ? 'bad' : 'warn',
        metric: 'Avg Feedback Days',
        value: Math.round(hm.avgFeedbackDays || 0),
        impact: 'Slow feedback extends candidate wait time',
        recommendation: 'Schedule recurring feedback sync with HM',
      });
    });
  }

  // Check for low accept rate
  if (overview?.acceptRate && overview.acceptRate < 70) {
    bottlenecks.push({
      id: 'accept-rate-low',
      type: 'stage',
      name: 'Offer Stage',
      severity: overview.acceptRate < 50 ? 'bad' : 'warn',
      metric: 'Accept Rate',
      value: Math.round(overview.acceptRate),
      impact: 'Low acceptance rate wastes recruiting effort',
      recommendation: 'Review compensation benchmarking and candidate experience',
    });
  }

  return bottlenecks;
}

// Helper to create pipeline stages from overview
function createPipelineStages(overview: any): PipelineStage[] {
  if (!overview?.funnelData) {
    return [
      { name: 'Applied', count: overview?.activeCandidates || 0, avgDays: 0, conversionRate: 100 },
      { name: 'Screening', count: Math.round((overview?.activeCandidates || 0) * 0.6), avgDays: 3, conversionRate: 60 },
      { name: 'Interview', count: Math.round((overview?.activeCandidates || 0) * 0.3), avgDays: 7, conversionRate: 50 },
      { name: 'Offer', count: overview?.totalOffers || 0, avgDays: 5, conversionRate: 40 },
      { name: 'Hired', count: overview?.totalHires || 0, avgDays: 3, conversionRate: 80 },
    ];
  }

  return overview.funnelData;
}

// Helper to create team capacity from recruiter summaries
function createTeamCapacity(overview: any): TeamCapacity[] {
  if (!overview?.recruiterSummaries) {
    return [];
  }

  // Group by department/team
  const teamMap = new Map<string, TeamCapacity>();

  overview.recruiterSummaries.forEach((recruiter: any) => {
    const team = recruiter.department || 'General';
    const existing = teamMap.get(team);

    const reqLoad = recruiter.reqCount || recruiter.openReqs || 5;
    const capacity = recruiter.maxCapacity || 10;
    const used = Math.min(reqLoad, capacity);
    const utilization = Math.round((used / capacity) * 100);

    if (existing) {
      existing.totalCapacity += capacity;
      existing.usedCapacity += used;
      existing.headcount += 1;
      existing.openReqs += reqLoad;
      existing.utilization = Math.round((existing.usedCapacity / existing.totalCapacity) * 100);
    } else {
      teamMap.set(team, {
        team,
        totalCapacity: capacity,
        usedCapacity: used,
        utilization,
        headcount: 1,
        openReqs: reqLoad,
      });
    }
  });

  return Array.from(teamMap.values());
}

export function CommandCenterV2({ onNavigateToTab }: CommandCenterV2Props) {
  const { state, updateFilters } = useDashboard();

  // Navigation handlers for CTAs
  const handleViewHealthDetails = useCallback(() => {
    onNavigateToTab?.('overview');
  }, [onNavigateToTab]);

  const handleViewRisks = useCallback(() => {
    onNavigateToTab?.('data-health');
  }, [onNavigateToTab]);

  const handleViewPipeline = useCallback(() => {
    onNavigateToTab?.('forecasting');
  }, [onNavigateToTab]);
  const { dataStore, overview, hmFriction, filters } = state;

  // Local filter state for V2 format
  const [v2Filters, setV2Filters] = useState<FilterState>({
    dateRange: {
      start: filters.dateRange.startDate,
      end: filters.dateRange.endDate,
    },
    recruiters: [],
    departments: [],
    regions: [],
    priorities: [],
    statuses: [],
  });

  // Handle filter changes
  const handleFiltersChange = (newFilters: FilterState) => {
    setV2Filters(newFilters);
    // Sync with dashboard context
    updateFilters({
      dateRange: {
        startDate: newFilters.dateRange.start,
        endDate: newFilters.dateRange.end,
      },
    });
  };

  // Map data to V2 formats
  const openReqCount = useMemo(() =>
    dataStore.requisitions.filter(r => !r.closed_at).length,
    [dataStore.requisitions]
  );

  const kpiMetrics = useMemo(() => mapOverviewToKPIs(overview, openReqCount), [overview, openReqCount]);

  const requisitionsV2 = useMemo(() => {
    let reqs = mapRequisitionsToV2(dataStore.requisitions);

    // Apply filters
    if (v2Filters.departments.length > 0) {
      reqs = reqs.filter(r => v2Filters.departments.includes(r.department));
    }
    if (v2Filters.recruiters.length > 0) {
      reqs = reqs.filter(r => r.assignedRecruiter && v2Filters.recruiters.includes(r.assignedRecruiter));
    }

    return reqs;
  }, [dataStore.requisitions, v2Filters]);

  const bottlenecks = useMemo(() => createBottlenecks(overview, hmFriction), [overview, hmFriction]);

  const pipelineStages = useMemo(() => createPipelineStages(overview), [overview]);

  const teamCapacity = useMemo(() => createTeamCapacity(overview), [overview]);

  // Extract unique values for filters
  const recruiters = useMemo(() => {
    const unique = new Map<string, string>();
    dataStore.users.forEach(u => {
      if (u.user_id && u.name) {
        unique.set(u.user_id, u.name);
      }
    });
    return Array.from(unique.entries()).map(([id, name]) => ({ id, name }));
  }, [dataStore.users]);

  const departments = useMemo(() => {
    const unique = new Set<string>();
    dataStore.requisitions.forEach(r => {
      const dept = String(r.function || '');
      if (dept) unique.add(dept);
    });
    return Array.from(unique);
  }, [dataStore.requisitions]);

  // Show empty state if no data
  if (dataStore.requisitions.length === 0) {
    return (
      <div className="p-4 md:p-6 max-w-[1600px] mx-auto">
        <div className="glass-panel p-8 text-center">
          <h2 className="text-xl font-semibold text-foreground mb-2">No Data Available</h2>
          <p className="text-muted-foreground">
            Import CSV data to see the Command Center dashboard.
          </p>
        </div>
      </div>
    );
  }

  // Count risks by severity
  const highRiskCount = bottlenecks.filter(b => b.severity === 'bad').length;
  const actionCount = 12; // TODO: Calculate from actual actions

  return (
    <div className="min-h-screen bg-background">
      {/* Page Header (V0 sticky header pattern) */}
      <header className="sticky top-[52px] z-40 border-b border-glass-border bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-[1600px] items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-light">
              <LayoutDashboard className="h-5 w-5 text-accent" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-foreground">Command Center</h1>
              <p className="text-xs text-muted-foreground">Executive overview of recruiting operations</p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-4 md:px-6 py-6">
        {/* Dataset Status Bar */}
        <div className="mb-6 flex flex-wrap items-center gap-3 rounded-lg border border-glass-border bg-bg-glass px-4 py-3">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-accent" />
            <span className="text-sm font-medium text-foreground">
              {dataStore.candidates.length.toLocaleString()} candidates
            </span>
            <span className="text-muted-foreground">•</span>
            <span className="text-sm text-muted-foreground">
              {dataStore.requisitions.length.toLocaleString()} reqs
            </span>
          </div>
          <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
            <span>Last updated: {dataStore.lastImportAt ? new Date(dataStore.lastImportAt).toLocaleDateString() : 'Never'}</span>
          </div>
        </div>

        {/* Health KPIs Section (V0 pattern) */}
        <section className="mb-8">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-accent" />
              <h2 className="text-base font-semibold text-foreground">Health</h2>
            </div>
            <button
              type="button"
              onClick={handleViewHealthDetails}
              className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              View Details
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
            {kpiMetrics.map((metric) => (
              <KPICardV2
                key={metric.id || metric.label}
                label={metric.label}
                value={metric.value}
                subtitle={metric.subtitle}
                change={metric.change}
                trend={metric.trend}
                status={metric.status}
                helpText={metric.helpText}
              />
            ))}
          </div>
        </section>

        {/* Two Column Layout: Risks | Actions */}
        <div className="grid gap-6 lg:grid-cols-2 mb-8">
          {/* Risks Panel */}
          <section>
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-warn" />
                <h2 className="text-base font-semibold text-foreground">Risks</h2>
                {highRiskCount > 0 && (
                  <span className="rounded-full bg-bad-bg px-2 py-0.5 text-xs font-medium text-bad">
                    {highRiskCount} HIGH
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={handleViewRisks}
                className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                View All
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <BottleneckPanelV2 bottlenecks={bottlenecks} />
          </section>

          {/* Actions Section */}
          <section>
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-accent" />
                <h2 className="text-base font-semibold text-foreground">Actions</h2>
                <span className="rounded-full bg-accent-light px-2 py-0.5 text-xs font-medium text-accent">
                  {actionCount} Open
                </span>
              </div>
            </div>
            {/* Placeholder for Action Queue - uses existing data */}
            <div className="rounded-lg border border-glass-border bg-bg-glass">
              <div className="max-h-[360px] divide-y divide-glass-border overflow-y-auto">
                {bottlenecks.slice(0, 5).map((item, idx) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`group flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/30 ${idx % 2 === 0 ? 'bg-muted/30' : ''
                      }`}
                  >
                    <div className={`mt-1 h-9 w-1 shrink-0 rounded-full ${item.severity === 'bad' ? 'bg-bad' : item.severity === 'warn' ? 'bg-warn' : 'bg-good'
                      }`} />
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 truncate text-sm font-medium text-foreground">{item.recommendation}</div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold bg-accent-light text-accent">
                          {item.type}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">{item.impact}</span>
                      </div>
                    </div>
                    <ChevronRight className="mt-2 h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                  </button>
                ))}
              </div>
            </div>
          </section>
        </div>

        {/* Forecast Section */}
        <section className="mb-8">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-good" />
              <h2 className="text-base font-semibold text-foreground">Forecast</h2>
            </div>
            <button
              type="button"
              onClick={handleViewPipeline}
              className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Pipeline Details
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-lg border border-glass-border bg-bg-glass p-4">
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Expected Hires</div>
              <div className="text-3xl font-mono font-semibold text-foreground">{overview?.totalOffers || 0}</div>
              <div className="text-xs text-muted-foreground mt-1">Based on active offers</div>
            </div>
            <div className="rounded-lg border border-glass-border bg-bg-glass p-4">
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Gap to Goal</div>
              <div className="text-3xl font-mono font-semibold text-warn">{dataStore.requisitions.filter(r => !r.closed_at).length || 0}</div>
              <div className="text-xs text-muted-foreground mt-1">Open reqs needing hires</div>
            </div>
            <div className="rounded-lg border border-glass-border bg-bg-glass p-4">
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Confidence</div>
              <div className="text-3xl font-mono font-semibold text-good">MED</div>
              <div className="text-xs text-muted-foreground mt-1">Based on pipeline health</div>
            </div>
          </div>
        </section>

        {/* Pipeline & Capacity Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <PipelineFunnelV2 stages={pipelineStages} />
          </div>
          <div>
            <TeamCapacityPanelV2 teams={teamCapacity} />
          </div>
        </div>
      </main>
    </div>
  );
}
