// Team Capacity Summary Component
// Displays team-level capacity overview with demand, capacity, and gap

import React from 'react';
import { TeamCapacitySummary as TeamCapacitySummaryData, ConfidenceLevel } from '../../../types/capacityTypes';

interface TeamCapacitySummaryProps {
  summary: TeamCapacitySummaryData;
}

function ConfidenceBadge({ confidence }: { confidence: ConfidenceLevel }) {
  const badgeClass = {
    HIGH: 'bg-green-500/15 text-green-400',
    MED: 'bg-amber-500/15 text-amber-400',
    LOW: 'bg-slate-500/15 text-slate-400',
    INSUFFICIENT: 'bg-red-500/15 text-red-400'
  }[confidence];

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${badgeClass}`}>
      {confidence} confidence
    </span>
  );
}

function CapacityGauge({ demand, capacity }: { demand: number; capacity: number }) {
  const maxValue = Math.max(demand, capacity) * 1.2;
  const demandPercent = (demand / maxValue) * 100;
  const capacityPercent = (capacity / maxValue) * 100;
  const isOverDemand = demand > capacity;

  return (
    <div className="mb-3">
      <div className="flex justify-between text-sm text-muted-foreground mb-1">
        <span>Team Demand</span>
        <span>{demand} WU</span>
      </div>
      <div className="h-2 bg-card rounded mb-2 capacity-progress-track">
        <div
          className={`h-full rounded ${isOverDemand ? 'bg-red-500' : 'bg-primary'}`}
          style={{ width: `${demandPercent}%` }}
        />
      </div>

      <div className="flex justify-between text-sm text-muted-foreground mb-1">
        <span>Team Capacity</span>
        <span>{capacity} WU</span>
      </div>
      <div className="h-2 bg-card rounded capacity-progress-track">
        <div
          className="h-full rounded bg-green-500"
          style={{ width: `${capacityPercent}%` }}
        />
      </div>
    </div>
  );
}

// Map status to Tailwind classes
const STATUS_CLASS: Record<string, { panel: string; badge: string; label: string }> = {
  understaffed: { panel: 'bg-destructive/10 border border-bad/30', badge: 'bg-destructive/10 text-bad', label: 'Understaffed' },
  overstaffed: { panel: 'bg-warn-bg border border-warn/30', badge: 'bg-warn-bg text-warn', label: 'Overstaffed' },
  balanced: { panel: 'bg-good-bg border border-good/30', badge: 'bg-good-bg text-good', label: 'Balanced' }
};

export function TeamCapacitySummary({ summary }: TeamCapacitySummaryProps) {
  const statusStyle = STATUS_CLASS[summary.status] || STATUS_CLASS.balanced;

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex justify-between items-center px-4 py-3 border-b border-white/10">
        <h6 className="text-sm font-semibold text-foreground">
          <i className="bi bi-people mr-2"></i>
          Team Capacity Overview
        </h6>
        <ConfidenceBadge confidence={summary.confidence} />
      </div>

      <div className="p-4">
        <CapacityGauge demand={summary.teamDemand} capacity={summary.teamCapacity} />

        <div className={`text-center p-3 rounded-lg mb-3 ${statusStyle.panel}`}>
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Capacity Gap</div>
          <div className="font-mono text-3xl font-semibold text-foreground mt-1">
            {summary.capacityGap > 0 ? '+' : ''}{summary.capacityGap} WU
          </div>
          <div className="text-sm mt-2">
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${statusStyle.badge}`}>
              {Math.abs(summary.capacityGapPercent)}% {statusStyle.label}
            </span>
          </div>
        </div>

        {summary.topDrivers.length > 0 && (
          <div>
            <div className="text-sm text-muted-foreground mb-2">Top Drivers:</div>
            <ul className="list-none text-sm space-y-1">
              {summary.topDrivers.map((driver, i) => (
                <li key={i} className="flex justify-between">
                  <span className="text-foreground">
                    <i className="bi bi-dot"></i>
                    {driver.description}
                  </span>
                  <span className="text-muted-foreground font-mono">+{driver.impactWU} WU</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

export default TeamCapacitySummary;
