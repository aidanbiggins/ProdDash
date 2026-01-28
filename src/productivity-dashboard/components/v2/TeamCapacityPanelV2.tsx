import React, { useState } from 'react';
import { Users, Info, ChevronRight, AlertTriangle, CheckCircle, TrendingDown } from 'lucide-react';
import type { TeamCapacity } from './types';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../../components/ui/tooltip';

interface RecruiterDetail {
  recruiterId: string;
  recruiterName: string;
  team: string;
  openReqs: number;
  demandWU?: number;
  capacityWU?: number;
  utilization: number; // 0-100 scale (percentage)
}

interface TeamCapacityPanelV2Props {
  teams: TeamCapacity[];
  recruiters?: RecruiterDetail[];
  onViewAll?: () => void;
  isComplexityWeighted?: boolean;
}

type CapacityStatus = 'overloaded' | 'stretched' | 'balanced' | 'available' | 'underutilized';

function getCapacityStatus(utilization: number): CapacityStatus {
  if (utilization > 100) return 'overloaded';
  if (utilization > 85) return 'stretched';
  if (utilization > 60) return 'balanced';
  if (utilization > 30) return 'available';
  return 'underutilized';
}

function getStatusConfig(status: CapacityStatus): {
  label: string;
  color: string;
  bgColor: string;
  icon: React.ReactNode;
  description: string;
} {
  switch (status) {
    case 'overloaded':
      return {
        label: 'Overloaded',
        color: 'text-red-400',
        bgColor: 'bg-red-500/20',
        icon: <AlertTriangle className="w-4 h-4" />,
        description: 'Team is over capacity. Consider reassigning work or adding headcount.'
      };
    case 'stretched':
      return {
        label: 'Stretched',
        color: 'text-amber-400',
        bgColor: 'bg-amber-500/20',
        icon: <AlertTriangle className="w-4 h-4" />,
        description: 'Team is near capacity. Monitor for burnout risk.'
      };
    case 'balanced':
      return {
        label: 'Balanced',
        color: 'text-blue-400',
        bgColor: 'bg-blue-500/20',
        icon: <CheckCircle className="w-4 h-4" />,
        description: 'Healthy utilization with room for unexpected work.'
      };
    case 'available':
      return {
        label: 'Available',
        color: 'text-green-400',
        bgColor: 'bg-green-500/20',
        icon: <CheckCircle className="w-4 h-4" />,
        description: 'Team has capacity for more work.'
      };
    case 'underutilized':
      return {
        label: 'Underutilized',
        color: 'text-slate-400',
        bgColor: 'bg-slate-500/20',
        icon: <TrendingDown className="w-4 h-4" />,
        description: 'Team has significant spare capacity.'
      };
  }
}

function getBarColor(utilization: number): string {
  if (utilization > 100) return 'bg-red-500';
  if (utilization > 85) return 'bg-amber-500';
  if (utilization > 60) return 'bg-blue-500';
  if (utilization > 30) return 'bg-green-500';
  return 'bg-slate-500';
}

export function TeamCapacityPanelV2({
  teams,
  recruiters = [],
  onViewAll,
  isComplexityWeighted = false
}: TeamCapacityPanelV2Props) {
  const [showRecruiterList, setShowRecruiterList] = useState(false);

  // Aggregate stats
  const totalRecruiters = teams.reduce((sum, t) => sum + t.headcount, 0);
  const totalOpenReqs = teams.reduce((sum, t) => sum + t.openReqs, 0);
  const totalDemandWU = teams.reduce((sum, t) => sum + (t.usedCapacity || 0), 0);
  const totalCapacityWU = teams.reduce((sum, t) => sum + (t.totalCapacity || 0), 0);

  const hasWorkloadData = totalCapacityWU > 0;
  const overallUtilization = hasWorkloadData
    ? Math.round((totalDemandWU / totalCapacityWU) * 100)
    : 0;

  const status = getCapacityStatus(overallUtilization);
  const statusConfig = getStatusConfig(status);

  // Identify recruiters with issues (need to convert utilization to percentage if it's decimal)
  const recruitersWithUtilization = recruiters.map(r => ({
    ...r,
    // Fix: utilization might be 0-1 scale, convert to 0-100
    utilizationPct: r.utilization > 1 ? Math.round(r.utilization) : Math.round(r.utilization * 100)
  }));

  const overloadedRecruiters = recruitersWithUtilization.filter(r => r.utilizationPct > 100);
  const stretchedRecruiters = recruitersWithUtilization.filter(r => r.utilizationPct > 85 && r.utilizationPct <= 100);
  const availableRecruiters = recruitersWithUtilization.filter(r => r.utilizationPct <= 30);

  const hasProblems = overloadedRecruiters.length > 0 || stretchedRecruiters.length > 0;

  return (
    <div className="glass-panel h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Team Capacity</h3>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <button type="button" className="text-muted-foreground hover:text-foreground">
              <Info className="w-4 h-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="left" className="max-w-[280px]">
            {hasWorkloadData ? (
              <div className="text-xs space-y-1">
                <p className="font-medium">Complexity-Weighted Capacity</p>
                <p>
                  Uses <strong>Workload Units (WU)</strong> that account for req complexity
                  (level, market, niche) and hiring manager friction.
                </p>
              </div>
            ) : (
              <p className="text-xs">
                Capacity analysis unavailable. Navigate to Plan → Capacity for setup.
              </p>
            )}
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Main Status */}
      <div className="p-4 flex-1">
        {/* Status Badge */}
        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full ${statusConfig.bgColor} ${statusConfig.color} text-xs font-medium mb-3`}>
          {statusConfig.icon}
          {statusConfig.label}
        </div>

        {/* Utilization Bar */}
        <div className="mb-2">
          <div className="flex items-baseline justify-between mb-1">
            <span className="text-2xl font-mono font-semibold text-foreground">
              {overallUtilization}%
            </span>
            <span className="text-xs text-muted-foreground">utilized</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${getBarColor(overallUtilization)}`}
              style={{ width: `${Math.min(overallUtilization, 100)}%` }}
            />
          </div>
        </div>

        {/* Key Stats */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground mb-4">
          <span>{totalRecruiters} recruiters</span>
          <span>•</span>
          <span>{totalOpenReqs} open reqs</span>
          {hasWorkloadData && (
            <>
              <span>•</span>
              <span>{Math.round(totalDemandWU)}/{Math.round(totalCapacityWU)} WU</span>
            </>
          )}
        </div>

        {/* Alerts (only show if there are problems) */}
        {hasProblems && (
          <div className="space-y-2 mb-4">
            {overloadedRecruiters.length > 0 && (
              <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 rounded px-2 py-1.5">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                <span>
                  <strong>{overloadedRecruiters.length}</strong> recruiter{overloadedRecruiters.length !== 1 ? 's' : ''} overloaded
                  ({overloadedRecruiters.map(r => r.recruiterName.split('_').pop()).join(', ')})
                </span>
              </div>
            )}
            {stretchedRecruiters.length > 0 && (
              <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-500/10 rounded px-2 py-1.5">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                <span>
                  <strong>{stretchedRecruiters.length}</strong> near capacity
                </span>
              </div>
            )}
          </div>
        )}

        {/* Available capacity callout (only if significantly underutilized) */}
        {!hasProblems && availableRecruiters.length >= 3 && (
          <div className="flex items-center gap-2 text-xs text-green-400 bg-green-500/10 rounded px-2 py-1.5 mb-4">
            <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" />
            <span>
              <strong>{availableRecruiters.length}</strong> recruiters have significant availability
            </span>
          </div>
        )}

        {/* Expandable Recruiter List */}
        {showRecruiterList && recruitersWithUtilization.length > 0 && (
          <div className="border-t border-border pt-3 mt-3 max-h-[180px] overflow-y-auto space-y-2">
            {recruitersWithUtilization
              .sort((a, b) => b.utilizationPct - a.utilizationPct)
              .map((r) => {
                const barColor = getBarColor(r.utilizationPct);
                return (
                  <div key={r.recruiterId} className="flex items-center gap-2 text-xs">
                    <span className="text-foreground truncate w-24">{r.recruiterName}</span>
                    <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full ${barColor}`}
                        style={{ width: `${Math.min(r.utilizationPct, 100)}%` }}
                      />
                    </div>
                    <span className={`font-mono w-10 text-right ${
                      r.utilizationPct > 100 ? 'text-red-400' :
                      r.utilizationPct > 85 ? 'text-amber-400' :
                      r.utilizationPct < 30 ? 'text-slate-400' : 'text-foreground'
                    }`}>
                      {Math.round(r.utilizationPct)}%
                    </span>
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-border flex items-center justify-between">
        {recruitersWithUtilization.length > 0 && (
          <button
            type="button"
            onClick={() => setShowRecruiterList(!showRecruiterList)}
            className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
          >
            {showRecruiterList ? 'Hide' : 'Show'} breakdown
            <ChevronRight className={`w-3 h-3 transition-transform ${showRecruiterList ? 'rotate-90' : ''}`} />
          </button>
        )}
        {onViewAll && (
          <button
            type="button"
            onClick={onViewAll}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors ml-auto"
          >
            Capacity planning
            <ChevronRight className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
}
