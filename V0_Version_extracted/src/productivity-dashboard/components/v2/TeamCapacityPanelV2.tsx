import React from 'react';
import { Users } from 'lucide-react';
import type { TeamCapacity } from './types';

interface TeamCapacityPanelV2Props {
  teams: TeamCapacity[];
}

function getUtilizationColor(utilization: number): { bar: string; text: string } {
  if (utilization > 100) {
    return { bar: 'bg-[#ef4444]', text: 'text-[#fca5a5]' };
  }
  if (utilization > 85) {
    return { bar: 'bg-[#f59e0b]', text: 'text-[#fcd34d]' };
  }
  if (utilization > 60) {
    return { bar: 'bg-[#3b82f6]', text: 'text-[#93c5fd]' };
  }
  if (utilization > 40) {
    return { bar: 'bg-[#22c55e]', text: 'text-[#86efac]' };
  }
  return { bar: 'bg-[#64748b]', text: 'text-[#94a3b8]' };
}

function getUtilizationLabel(utilization: number): string {
  if (utilization > 100) return 'Overloaded';
  if (utilization > 85) return 'High';
  if (utilization > 60) return 'Balanced';
  if (utilization > 40) return 'Available';
  return 'Underutilized';
}

export function TeamCapacityPanelV2({ teams }: TeamCapacityPanelV2Props) {
  const totalCapacity = teams.reduce((sum, t) => sum + t.totalCapacity, 0);
  const totalUsed = teams.reduce((sum, t) => sum + t.usedCapacity, 0);
  const overallUtilization = totalCapacity > 0 ? Math.round((totalUsed / totalCapacity) * 100) : 0;

  return (
    <div className="glass-panel h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.06]">
        <Users className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">Team Capacity</h3>
      </div>

      {/* Overall Stats */}
      <div className="p-4 border-b border-white/[0.06]">
        <div className="flex items-baseline justify-between mb-2">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Overall Utilization
          </span>
          <span className={`font-mono text-xl font-semibold ${getUtilizationColor(overallUtilization).text}`}>
            {overallUtilization}%
          </span>
        </div>
        <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${getUtilizationColor(overallUtilization).bar}`}
            style={{ width: `${Math.min(overallUtilization, 100)}%` }}
          />
        </div>
        <div className="flex justify-between mt-2 text-xs text-muted-foreground">
          <span>{totalUsed}h used</span>
          <span>{totalCapacity}h total</span>
        </div>
      </div>

      {/* Team Breakdown */}
      <div className="p-3 space-y-3 max-h-[300px] overflow-y-auto">
        {teams.map((team) => {
          const colors = getUtilizationColor(team.utilization);
          const label = getUtilizationLabel(team.utilization);

          return (
            <div
              key={team.team}
              className="p-3 rounded-lg bg-white/[0.02] hover:bg-white/[0.04] transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-foreground">{team.team}</span>
                <span className={`text-xs font-medium ${colors.text}`}>{label}</span>
              </div>

              {/* Progress Bar */}
              <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden mb-2">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${colors.bar}`}
                  style={{ width: `${Math.min(team.utilization, 100)}%` }}
                />
              </div>

              {/* Stats Row */}
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-3">
                  <span>{team.headcount} recruiter{team.headcount !== 1 ? 's' : ''}</span>
                  <span>{team.openReqs} open reqs</span>
                </div>
                <span className={`font-mono font-medium ${colors.text}`}>
                  {team.utilization}%
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-white/[0.06]">
        <button
          type="button"
          className="text-xs font-medium text-primary hover:text-primary/80 transition-colors"
        >
          View all recruiters
        </button>
      </div>
    </div>
  );
}
