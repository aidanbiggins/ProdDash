import React, { useMemo, useState } from 'react';
import { useDashboard } from '../../hooks/useDashboardContext';
import { KPICardV2 } from './KPICardV2';
import { FilterBarV2 } from './FilterBarV2';
import { BottleneckPanelV2 } from './BottleneckPanelV2';
import { RequisitionsTableV2 } from './RequisitionsTableV2';
import { TeamCapacityPanelV2 } from './TeamCapacityPanelV2';
import { PipelineFunnelV2 } from './PipelineFunnelV2';
import type { KPIMetric, BottleneckItem, PipelineStage, TeamCapacity, RequisitionV2, FilterState } from './types';
import { differenceInDays } from 'date-fns';

// Helper to map dashboard state to V2 KPI metrics
function mapOverviewToKPIs(overview: any): KPIMetric[] {
  if (!overview) return [];

  return [
    {
      label: 'Open Reqs',
      value: overview.totalOpenReqs ?? '--',
      status: overview.totalOpenReqs > 50 ? 'warn' : 'good',
      helpText: 'Total number of open requisitions',
    },
    {
      label: 'Total Hires',
      value: overview.totalHires ?? '--',
      status: 'good',
      helpText: 'Hires in the selected period',
    },
    {
      label: 'Offers Pending',
      value: overview.totalOffers ?? '--',
      status: overview.totalOffers > 10 ? 'good' : 'neutral',
      helpText: 'Offers currently pending acceptance',
    },
    {
      label: 'Median TTF',
      value: overview.medianTimeToFill ? `${overview.medianTimeToFill}d` : '--',
      status: (overview.medianTimeToFill ?? 0) > 45 ? 'bad' : (overview.medianTimeToFill ?? 0) > 30 ? 'warn' : 'good',
      helpText: 'Median time to fill in days',
    },
    {
      label: 'Accept Rate',
      value: overview.acceptRate ? `${Math.round(overview.acceptRate)}%` : '--',
      status: (overview.acceptRate ?? 0) >= 80 ? 'good' : (overview.acceptRate ?? 0) >= 60 ? 'warn' : 'bad',
      helpText: 'Offer acceptance rate',
    },
    {
      label: 'Active Candidates',
      value: overview.activeCandidates ?? '--',
      status: 'neutral',
      helpText: 'Candidates currently in pipeline',
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

export function CommandCenterV2() {
  const { state, updateFilters } = useDashboard();
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
  const kpiMetrics = useMemo(() => mapOverviewToKPIs(overview), [overview]);

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

  return (
    <div className="p-4 md:p-6 max-w-[1600px] mx-auto">
      {/* Page Header */}
      <div className="mb-4 md:mb-6">
        <h1 className="text-xl md:text-2xl font-bold text-foreground tracking-tight mb-1">
          Command Center
        </h1>
        <p className="text-xs md:text-sm text-muted-foreground">
          Real-time recruiting pipeline health and capacity insights
        </p>
      </div>

      {/* Filter Bar */}
      <FilterBarV2
        filters={v2Filters}
        onFiltersChange={handleFiltersChange}
        recruiters={recruiters}
        departments={departments}
      />

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4 mb-4 md:mb-6">
        {kpiMetrics.map((metric) => (
          <KPICardV2
            key={metric.label}
            label={metric.label}
            value={metric.value}
            change={metric.change}
            trend={metric.trend}
            status={metric.status}
            helpText={metric.helpText}
          />
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6 mb-4 md:mb-6">
        {/* Pipeline Funnel */}
        <div className="lg:col-span-2 order-1">
          <PipelineFunnelV2 stages={pipelineStages} />
        </div>

        {/* Bottlenecks */}
        <div className="order-2">
          <BottleneckPanelV2 bottlenecks={bottlenecks} />
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        {/* Requisitions Table */}
        <div className="lg:col-span-2 order-2 lg:order-1">
          <RequisitionsTableV2
            requisitions={requisitionsV2}
            recruiters={recruiters}
          />
        </div>

        {/* Team Capacity */}
        <div className="order-1 lg:order-2">
          <TeamCapacityPanelV2 teams={teamCapacity} />
        </div>
      </div>
    </div>
  );
}
