/**
 * TeamCapacityPanel V2 - Tailwind Implementation
 * Matches V0 reference design exactly
 */
import React from 'react';
import { cn } from '../ui-primitives/utils';

interface TeamCapacity {
  team: string;
  totalCapacity: number;
  usedCapacity: number;
  utilization: number;
  headcount: number;
  openReqs: number;
}

interface TeamCapacityPanelV2Props {
  teams: TeamCapacity[];
  onViewAll?: () => void;
}

type UtilizationLevel = 'overloaded' | 'high' | 'balanced' | 'available' | 'underutilized';

const utilizationConfig: Record<UtilizationLevel, { bar: string; text: string; label: string }> = {
  overloaded: { bar: 'bg-bad', text: 'text-destructive', label: 'Overloaded' },
  high: { bar: 'bg-warn', text: 'text-warn-text', label: 'High' },
  balanced: { bar: 'bg-[#3b82f6]', text: 'text-[#93c5fd]', label: 'Balanced' },
  available: { bar: 'bg-good', text: 'text-good-text', label: 'Available' },
  underutilized: { bar: 'bg-dim', text: 'text-muted-foreground', label: 'Underutilized' },
};

function getUtilizationLevel(utilization: number): UtilizationLevel {
  if (utilization > 100) return 'overloaded';
  if (utilization > 85) return 'high';
  if (utilization > 60) return 'balanced';
  if (utilization > 40) return 'available';
  return 'underutilized';
}

// Users icon
const UsersIcon = () => (
  <svg className="w-4 h-4 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

export function TeamCapacityPanelV2({ teams, onViewAll }: TeamCapacityPanelV2Props) {
  const totalCapacity = teams.reduce((sum, t) => sum + t.totalCapacity, 0);
  const totalUsed = teams.reduce((sum, t) => sum + t.usedCapacity, 0);
  const overallUtilization = totalCapacity > 0 ? Math.round((totalUsed / totalCapacity) * 100) : 0;
  const overallLevel = getUtilizationLevel(overallUtilization);
  const overallConfig = utilizationConfig[overallLevel];

  return (
    <div className="glass-panel h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.06]">
        <UsersIcon />
        <h3 className="text-sm font-semibold text-foreground">Team Capacity</h3>
      </div>

      {/* Overall Stats */}
      <div className="p-4 border-b border-white/[0.06]">
        <div className="flex items-baseline justify-between mb-2">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Overall Utilization
          </span>
          <span className={cn('font-mono text-xl font-semibold', overallConfig.text)}>
            {overallUtilization}%
          </span>
        </div>
        <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all duration-500', overallConfig.bar)}
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
          const level = getUtilizationLevel(team.utilization);
          const config = utilizationConfig[level];

          return (
            <div
              key={team.team}
              className="p-3 rounded-lg bg-white/[0.02] hover:bg-white/[0.04] transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-foreground">{team.team}</span>
                <span className={cn('text-xs font-medium', config.text)}>{config.label}</span>
              </div>

              {/* Progress Bar */}
              <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden mb-2">
                <div
                  className={cn('h-full rounded-full transition-all duration-500', config.bar)}
                  style={{ width: `${Math.min(team.utilization, 100)}%` }}
                />
              </div>

              {/* Stats Row */}
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-3">
                  <span>{team.headcount} recruiter{team.headcount !== 1 ? 's' : ''}</span>
                  <span>{team.openReqs} open reqs</span>
                </div>
                <span className={cn('font-mono font-medium', config.text)}>
                  {team.utilization}%
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      {onViewAll && (
        <div className="px-4 py-3 border-t border-white/[0.06]">
          <button
            type="button"
            className="text-xs font-medium text-primary hover:text-accent-hover transition-colors"
            onClick={onViewAll}
          >
            View all recruiters
          </button>
        </div>
      )}
    </div>
  );
}

export default TeamCapacityPanelV2;
