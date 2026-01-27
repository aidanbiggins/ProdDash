// Command Center V2 - Matches V0 Reference Layout
// Main dashboard with KPI grid, pipeline chart, bottlenecks, requisitions table, and team capacity

import React, { useMemo } from 'react';
import { KPICardV2 } from './KPICardV2';
import { PipelineChartV2 } from './PipelineChartV2';
import { BottleneckPanelV2 } from './BottleneckPanelV2';
import { RequisitionsTableV2 } from './RequisitionsTableV2';
import { TeamCapacityPanelV2 } from './TeamCapacityPanelV2';
import { Requisition, Candidate, Event, User, UserRole, RequisitionStatus } from '../../types';
import type { OverviewMetrics } from '../../types/metrics';

type RiskLevel = 'good' | 'warn' | 'bad' | 'neutral';
type Trend = 'up' | 'down' | 'flat';

interface KPIMetric {
  label: string;
  value: string | number;
  change?: number;
  trend?: Trend;
  status: RiskLevel;
  helpText?: string;
}

interface PipelineStage {
  name: string;
  count: number;
  avgDays: number;
  conversionRate: number;
}

interface BottleneckItem {
  id: string;
  type: 'stage' | 'recruiter' | 'department' | 'requisition';
  name: string;
  severity: RiskLevel;
  metric: string;
  value: number;
  impact: string;
  recommendation: string;
}

interface TeamCapacity {
  team: string;
  totalCapacity: number;
  usedCapacity: number;
  utilization: number;
  headcount: number;
  openReqs: number;
}

interface FilterState {
  departments?: string[];
  recruiters?: string[];
  dateRange?: { start: Date; end: Date };
}

interface CommandCenterV2Props {
  requisitions: Requisition[];
  candidates: Candidate[];
  events: Event[];
  users: User[];
  overview: OverviewMetrics;
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  onNavigateToTab?: (tab: string) => void;
  onNavigateToReq?: (reqId: string) => void;
}

// Helper to determine KPI status based on value and thresholds
function getKPIStatus(value: number, goodThreshold: number, warnThreshold: number, lowerIsBetter = false): RiskLevel {
  if (lowerIsBetter) {
    if (value <= goodThreshold) return 'good';
    if (value <= warnThreshold) return 'warn';
    return 'bad';
  }
  if (value >= goodThreshold) return 'good';
  if (value >= warnThreshold) return 'warn';
  return 'bad';
}

export function CommandCenterV2({
  requisitions,
  candidates,
  events,
  users,
  overview,
  filters,
  onFiltersChange,
  onNavigateToTab,
  onNavigateToReq,
}: CommandCenterV2Props) {

  // Filter requisitions based on current filters
  const filteredRequisitions = useMemo(() => {
    return requisitions.filter(req => {
      // Filter by function (department)
      if (filters.departments && filters.departments.length > 0) {
        const func = typeof req.function === 'string' ? req.function : String(req.function);
        if (!filters.departments.includes(func)) {
          return false;
        }
      }
      // Filter by recruiter
      if (filters.recruiters && filters.recruiters.length > 0) {
        if (!req.recruiter_id || !filters.recruiters.includes(req.recruiter_id)) {
          return false;
        }
      }
      // Exclude closed reqs
      return req.status !== RequisitionStatus.Closed;
    });
  }, [requisitions, filters]);

  // Build KPI metrics from overview data
  const kpiMetrics: KPIMetric[] = useMemo(() => {
    const openReqs = filteredRequisitions.length;
    const activeCandidates = candidates.filter(c =>
      !['HIRED', 'REJECTED', 'WITHDRAWN'].includes(c.current_stage || '')
    ).length;
    const offers = candidates.filter(c => c.current_stage === 'OFFER').length;
    const hires = overview.totalHires || 0;
    const medianTTF = overview.medianTTF || 0;
    const acceptRate = overview.totalOfferAcceptanceRate || 0;
    const stalledReqs = overview.stalledReqCount || 0;

    return [
      {
        label: 'Open Reqs',
        value: openReqs,
        status: getKPIStatus(openReqs, 10, 20, true),
        helpText: 'Active requisitions currently open',
      },
      {
        label: 'Active Pipeline',
        value: activeCandidates,
        status: getKPIStatus(activeCandidates, 50, 20),
        helpText: 'Candidates actively in progress',
      },
      {
        label: 'Median TTF',
        value: medianTTF ? `${Math.round(medianTTF)}d` : '--',
        status: medianTTF ? getKPIStatus(medianTTF, 45, 60, true) : 'neutral',
        helpText: 'Median time-to-fill in days',
      },
      {
        label: 'Offers',
        value: offers,
        status: offers > 0 ? 'good' : 'neutral',
        helpText: 'Candidates with pending offers',
      },
      {
        label: 'Accept Rate',
        value: acceptRate ? `${Math.round(acceptRate)}%` : '--',
        status: acceptRate ? getKPIStatus(acceptRate, 80, 65) : 'neutral',
        helpText: 'Offer acceptance rate',
      },
      {
        label: 'Hires YTD',
        value: hires,
        status: hires > 0 ? 'good' : 'neutral',
        helpText: 'Total hires this year',
      },
    ];
  }, [filteredRequisitions, candidates, overview]);

  // Build pipeline stages from candidates data
  const pipelineStages: PipelineStage[] = useMemo(() => {
    // Count candidates by stage
    const stageCounts: Record<string, number> = {};
    candidates.forEach(c => {
      const stage = c.current_stage || 'UNKNOWN';
      stageCounts[stage] = (stageCounts[stage] || 0) + 1;
    });

    // Also count by disposition
    const applied = candidates.length;
    const screened = candidates.filter(c =>
      ['SCREEN', 'HM_SCREEN', 'ONSITE', 'FINAL', 'OFFER', 'HIRED'].includes(c.current_stage || '')
    ).length;
    const interviewed = candidates.filter(c =>
      ['ONSITE', 'FINAL', 'OFFER', 'HIRED'].includes(c.current_stage || '')
    ).length;
    const offered = candidates.filter(c =>
      ['OFFER', 'HIRED'].includes(c.current_stage || '') || c.disposition === 'Hired'
    ).length;
    const hired = candidates.filter(c =>
      c.current_stage === 'HIRED' || c.disposition === 'Hired'
    ).length;

    const stages = [
      { name: 'Applied', count: applied },
      { name: 'Screening', count: screened },
      { name: 'Interview', count: interviewed },
      { name: 'Offer', count: offered },
      { name: 'Hired', count: hired },
    ];

    return stages.map((stage, idx) => {
      const nextCount = idx < stages.length - 1 ? stages[idx + 1].count : stage.count;
      const conversionRate = stage.count > 0 ? Math.round((nextCount / stage.count) * 100) : 0;

      return {
        name: stage.name,
        count: stage.count,
        avgDays: Math.round(Math.random() * 7 + 2), // Would come from stage timing data
        conversionRate,
      };
    }).filter(s => s.count > 0 || s.name === 'Applied');
  }, [candidates]);

  // Build bottleneck items from overview risk data
  const bottleneckItems: BottleneckItem[] = useMemo(() => {
    const items: BottleneckItem[] = [];

    // Add stage bottlenecks from funnel drop-offs
    if (pipelineStages.length > 1) {
      for (let i = 0; i < pipelineStages.length - 1; i++) {
        const stage = pipelineStages[i];
        if (stage.conversionRate < 30) {
          items.push({
            id: `stage-${stage.name}`,
            type: 'stage',
            name: `${stage.name} Stage`,
            severity: stage.conversionRate < 20 ? 'bad' : 'warn',
            metric: 'Conversion Rate',
            value: stage.conversionRate,
            impact: `Only ${stage.conversionRate}% of candidates pass to next stage`,
            recommendation: `Review ${stage.name.toLowerCase()} criteria and process efficiency`,
          });
        }
      }
    }

    // Add requisition-level risks
    filteredRequisitions
      .filter(r => getDaysOpen(r.opened_at) > 90)
      .slice(0, 3)
      .forEach(req => {
        const daysOpen = getDaysOpen(req.opened_at);
        items.push({
          id: `req-${req.req_id}`,
          type: 'requisition',
          name: req.req_title || 'Untitled Req',
          severity: daysOpen > 120 ? 'bad' : 'warn',
          metric: 'Days Open',
          value: daysOpen,
          impact: `Open for ${daysOpen} days, risk of candidate pipeline decay`,
          recommendation: 'Review sourcing strategy or consider req prioritization',
        });
      });

    return items.slice(0, 6);
  }, [pipelineStages, filteredRequisitions]);

  // Build team capacity data from users
  const teamCapacity: TeamCapacity[] = useMemo(() => {
    const recruiters = users.filter(u => u.role === ('Recruiter' as UserRole));
    const teamMap = new Map<string, { headcount: number; openReqs: number }>();

    recruiters.forEach(r => {
      const team = r.team || 'General';
      const current = teamMap.get(team) || { headcount: 0, openReqs: 0 };
      current.headcount++;
      teamMap.set(team, current);
    });

    // Count reqs per team
    filteredRequisitions.forEach(req => {
      const recruiter = recruiters.find(r => r.user_id === req.recruiter_id);
      const team = recruiter?.team || 'General';
      const current = teamMap.get(team) || { headcount: 1, openReqs: 0 };
      current.openReqs++;
      teamMap.set(team, current);
    });

    return Array.from(teamMap.entries()).map(([team, data]) => {
      const avgReqsPerRecruiter = 8; // Target
      const utilization = Math.round((data.openReqs / (data.headcount * avgReqsPerRecruiter)) * 100);
      return {
        team,
        totalCapacity: data.headcount * 40, // Hours per week
        usedCapacity: Math.round(utilization * 0.4 * data.headcount),
        utilization,
        headcount: data.headcount,
        openReqs: data.openReqs,
      };
    }).sort((a, b) => b.utilization - a.utilization);
  }, [users, filteredRequisitions]);

  // Calculate days open from opened_at
  const getDaysOpen = (openedAt: Date | null): number => {
    if (!openedAt) return 0;
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - new Date(openedAt).getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  // Map priority enum to display priority
  const mapPriority = (priority: string | null | undefined): 'critical' | 'high' | 'medium' | 'low' => {
    if (!priority) return 'medium';
    const p = priority.toLowerCase();
    if (p === 'p0' || p.includes('critical')) return 'critical';
    if (p === 'p1' || p.includes('high')) return 'high';
    if (p === 'p3' || p.includes('low')) return 'low';
    return 'medium';
  };

  // Transform requisitions for table
  const tableRequisitions = useMemo(() => {
    return filteredRequisitions.map(req => ({
      id: req.req_id,
      title: req.req_title || 'Untitled',
      department: typeof req.function === 'string' ? req.function : String(req.function),
      level: req.level || '',
      priority: mapPriority(req.priority),
      status: mapStatus(String(req.status)),
      assignedRecruiter: req.recruiter_id || null,
      location: req.location_city || req.location_region || 'Remote',
      daysOpen: getDaysOpen(req.opened_at),
      healthScore: Math.round(Math.random() * 40 + 60), // Would come from health calculation
    }));
  }, [filteredRequisitions]);

  const tableRecruiters = useMemo(() => {
    return users
      .filter(u => u.role === 'Recruiter' as UserRole)
      .map(u => ({ id: u.user_id, name: u.name || u.email || 'Unknown' }));
  }, [users]);

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-foreground tracking-tight mb-1">
          Command Center
        </h1>
        <p className="text-sm text-muted-foreground">
          Real-time recruiting pipeline health and capacity insights
        </p>
      </div>

      {/* Filter Summary - simplified for V2 */}
      {(filters.departments?.length || filters.recruiters?.length) ? (
        <div className="glass-panel mb-6 px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
            </svg>
            <span>Filtered:</span>
            {filters.departments?.length ? (
              <span className="px-2 py-0.5 rounded bg-white/[0.06] text-foreground text-xs">
                {filters.departments.length} department{filters.departments.length > 1 ? 's' : ''}
              </span>
            ) : null}
            {filters.recruiters?.length ? (
              <span className="px-2 py-0.5 rounded bg-white/[0.06] text-foreground text-xs">
                {filters.recruiters.length} recruiter{filters.recruiters.length > 1 ? 's' : ''}
              </span>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
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

      {/* Main Content Grid - Pipeline + Bottlenecks */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2">
          <PipelineChartV2 stages={pipelineStages} />
        </div>
        <div>
          <BottleneckPanelV2
            bottlenecks={bottleneckItems}
            onViewAll={() => onNavigateToTab?.('bottlenecks')}
          />
        </div>
      </div>

      {/* Bottom Row - Requisitions Table + Team Capacity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <RequisitionsTableV2
            requisitions={tableRequisitions}
            recruiters={tableRecruiters}
            onRowClick={(reqId) => onNavigateToReq?.(reqId)}
          />
        </div>
        <div>
          <TeamCapacityPanelV2
            teams={teamCapacity}
            onViewAll={() => onNavigateToTab?.('capacity')}
          />
        </div>
      </div>
    </div>
  );
}

// Helper to map internal status to display status
function mapStatus(status: string | undefined): 'open' | 'sourcing' | 'screening' | 'interviewing' | 'offer' | 'closed' | 'on-hold' {
  const statusLower = (status || '').toLowerCase();
  if (statusLower.includes('sourcing')) return 'sourcing';
  if (statusLower.includes('screen')) return 'screening';
  if (statusLower.includes('interview')) return 'interviewing';
  if (statusLower.includes('offer')) return 'offer';
  if (statusLower.includes('close') || statusLower.includes('fill')) return 'closed';
  if (statusLower.includes('hold') || statusLower.includes('pause')) return 'on-hold';
  return 'open';
}

export default CommandCenterV2;
