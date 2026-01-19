// Team Capacity Summary Component
// Displays team-level capacity overview with demand, capacity, and gap

import React from 'react';
import { TeamCapacitySummary as TeamCapacitySummaryData, ConfidenceLevel } from '../../types/capacityTypes';

interface TeamCapacitySummaryProps {
  summary: TeamCapacitySummaryData;
}

function ConfidenceBadge({ confidence }: { confidence: ConfidenceLevel }) {
  const badgeClass = {
    HIGH: 'badge-success-soft',
    MED: 'badge-warning-soft',
    LOW: 'badge-neutral-soft',
    INSUFFICIENT: 'badge-danger-soft'
  }[confidence];

  return (
    <span className={`badge-bespoke ${badgeClass}`}>
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
      <div className="d-flex justify-content-between small text-muted mb-1">
        <span>Team Demand</span>
        <span>{demand} WU</span>
      </div>
      <div className="progress mb-2 capacity-progress-track">
        <div
          className={`progress-bar ${isOverDemand ? 'bg-danger' : 'bg-primary'}`}
          style={{ width: `${demandPercent}%` }}
        />
      </div>

      <div className="d-flex justify-content-between small text-muted mb-1">
        <span>Team Capacity</span>
        <span>{capacity} WU</span>
      </div>
      <div className="progress capacity-progress-track">
        <div
          className="progress-bar bg-success"
          style={{ width: `${capacityPercent}%` }}
        />
      </div>
    </div>
  );
}

// Map status to CSS class
const STATUS_CLASS: Record<string, { panel: string; badge: string; label: string }> = {
  understaffed: { panel: 'capacity-status-understaffed', badge: 'badge-danger-soft', label: 'Understaffed' },
  overstaffed: { panel: 'capacity-status-overstaffed', badge: 'badge-warning-soft', label: 'Overstaffed' },
  balanced: { panel: 'capacity-status-balanced', badge: 'badge-success-soft', label: 'Balanced' }
};

export function TeamCapacitySummary({ summary }: TeamCapacitySummaryProps) {
  const statusStyle = STATUS_CLASS[summary.status] || STATUS_CLASS.balanced;

  return (
    <div className="card-bespoke">
      <div className="card-header d-flex justify-content-between align-items-center">
        <h6 className="mb-0">
          <i className="bi bi-people me-2"></i>
          Team Capacity Overview
        </h6>
        <ConfidenceBadge confidence={summary.confidence} />
      </div>

      <div className="card-body">
        <CapacityGauge demand={summary.teamDemand} capacity={summary.teamCapacity} />

        <div className={`text-center p-3 rounded mb-3 capacity-status-panel ${statusStyle.panel}`}>
          <div className="stat-label text-muted">Capacity Gap</div>
          <div className="stat-value capacity-gap-value">
            {summary.capacityGap > 0 ? '+' : ''}{summary.capacityGap} WU
          </div>
          <div className="small mt-1">
            <span className={`badge ${statusStyle.badge}`}>
              {Math.abs(summary.capacityGapPercent)}% {statusStyle.label}
            </span>
          </div>
        </div>

        {summary.topDrivers.length > 0 && (
          <div>
            <div className="small text-muted mb-2">Top Drivers:</div>
            <ul className="list-unstyled small mb-0">
              {summary.topDrivers.map((driver, i) => (
                <li key={i} className="d-flex justify-content-between mb-1">
                  <span>
                    <i className="bi bi-dot"></i>
                    {driver.description}
                  </span>
                  <span className="text-muted">+{driver.impactWU} WU</span>
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
