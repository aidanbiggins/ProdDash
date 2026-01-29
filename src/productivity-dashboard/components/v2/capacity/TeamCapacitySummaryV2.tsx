/**
 * TeamCapacitySummaryV2
 *
 * Cohesive panel showing team-level capacity metrics.
 * V2 design: single glass-panel with status badge, utilization bar, and drivers.
 * Matches TeamCapacityPanelV2 design philosophy.
 */

import React from 'react';
import { Users, Info, AlertTriangle, CheckCircle, TrendingDown, ChevronDown, ChevronUp } from 'lucide-react';
import { TeamCapacitySummary, ConfidenceLevel } from '../../../types/capacityTypes';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../../../components/ui/tooltip';

interface TeamCapacitySummaryV2Props {
  summary: TeamCapacitySummary;
}

type CapacityStatus = 'understaffed' | 'overstaffed' | 'balanced';

function getStatusConfig(status: CapacityStatus, gapPercent: number): {
  label: string;
  color: string;
  bgColor: string;
  icon: React.ReactNode;
  description: string;
} {
  switch (status) {
    case 'understaffed':
      return {
        label: 'Understaffed',
        color: 'text-red-400',
        bgColor: 'bg-red-500/20',
        icon: <AlertTriangle className="w-4 h-4" />,
        description: `Demand exceeds capacity by ${Math.abs(gapPercent)}%. Consider reassigning work or adding headcount.`
      };
    case 'overstaffed':
      return {
        label: 'Overstaffed',
        color: 'text-amber-400',
        bgColor: 'bg-amber-500/20',
        icon: <TrendingDown className="w-4 h-4" />,
        description: `Team has ${Math.abs(gapPercent)}% excess capacity.`
      };
    case 'balanced':
      return {
        label: 'Balanced',
        color: 'text-green-400',
        bgColor: 'bg-green-500/20',
        icon: <CheckCircle className="w-4 h-4" />,
        description: 'Demand and capacity are well-matched.'
      };
  }
}

function getConfidenceLabel(level: ConfidenceLevel): { label: string; color: string } {
  const configs: Record<ConfidenceLevel, { label: string; color: string }> = {
    HIGH: { label: 'High confidence', color: 'text-green-400' },
    MED: { label: 'Medium confidence', color: 'text-amber-400' },
    LOW: { label: 'Low confidence', color: 'text-slate-400' },
    INSUFFICIENT: { label: 'Insufficient data', color: 'text-red-400' },
  };
  return configs[level];
}

function getBarColor(gapPercent: number): string {
  if (gapPercent > 20) return 'bg-red-500';
  if (gapPercent > 10) return 'bg-amber-500';
  if (gapPercent > -10) return 'bg-green-500';
  return 'bg-slate-500';
}

export function TeamCapacitySummaryV2({ summary }: TeamCapacitySummaryV2Props) {
  const {
    teamDemand,
    teamCapacity,
    capacityGap,
    capacityGapPercent,
    confidence,
    topDrivers,
    status,
  } = summary;

  const [showDrivers, setShowDrivers] = React.useState(topDrivers.length > 0);

  const statusConfig = getStatusConfig(status, capacityGapPercent);
  const confidenceConfig = getConfidenceLabel(confidence);

  // Calculate utilization as a percentage (demand / capacity)
  const utilization = teamCapacity > 0 ? Math.round((teamDemand / teamCapacity) * 100) : 0;

  return (
    <div className="glass-panel">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Team Capacity Overview</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs ${confidenceConfig.color}`}>
            {confidenceConfig.label}
          </span>
          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" className="text-muted-foreground hover:text-foreground">
                <Info className="w-4 h-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="left" className="max-w-[280px]">
              <div className="text-xs space-y-1">
                <p className="font-medium">Capacity Analysis</p>
                <p>
                  Uses <strong>Workload Units (WU)</strong> that account for req complexity,
                  pipeline status, req age, and hiring manager friction.
                </p>
              </div>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-4">
        {/* Status Badge */}
        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full ${statusConfig.bgColor} ${statusConfig.color} text-xs font-medium mb-3`}>
          {statusConfig.icon}
          {statusConfig.label}
        </div>

        {/* Capacity Gap - Hero Metric */}
        <div className="mb-4">
          <div className="flex items-baseline justify-between mb-1">
            <span className={`text-3xl font-mono font-bold ${
              capacityGap > 0 ? 'text-red-400' : capacityGap < 0 ? 'text-green-400' : 'text-foreground'
            }`}>
              {capacityGap > 0 ? '+' : ''}{capacityGap} WU
            </span>
            <span className="text-xs text-muted-foreground">capacity gap</span>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            {statusConfig.description}
          </p>
        </div>

        {/* Demand vs Capacity Bars */}
        <div className="space-y-3 mb-4">
          {/* Demand Bar */}
          <div>
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>Team Demand</span>
              <span className="font-mono">{teamDemand} WU</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${getBarColor(capacityGapPercent)}`}
                style={{ width: `${Math.min(utilization, 100)}%` }}
              />
            </div>
          </div>

          {/* Capacity Bar (reference) */}
          <div>
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>Team Capacity</span>
              <span className="font-mono">{teamCapacity} WU</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-green-500/60"
                style={{ width: '100%' }}
              />
            </div>
          </div>
        </div>

        {/* Key Stats */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="font-mono">{utilization}%</span>
          <span>utilization</span>
          <span>•</span>
          <span className={capacityGapPercent > 10 ? 'text-red-400' : capacityGapPercent < -10 ? 'text-amber-400' : 'text-green-400'}>
            {capacityGapPercent > 0 ? '+' : ''}{capacityGapPercent}% gap
          </span>
        </div>
      </div>

      {/* Top Drivers (Expandable) */}
      {topDrivers.length > 0 && (
        <div className="border-t border-border">
          <button
            type="button"
            onClick={() => setShowDrivers(!showDrivers)}
            className="w-full flex items-center justify-between px-4 py-3 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <span>Top Drivers ({topDrivers.length})</span>
            {showDrivers ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showDrivers && (
            <div className="px-4 pb-4 space-y-2">
              {topDrivers.map((driver, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs bg-muted/30 rounded px-3 py-2">
                  <span className="text-foreground">{driver.description}</span>
                  <span className="font-mono text-muted-foreground">+{driver.impactWU} WU</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default TeamCapacitySummaryV2;
