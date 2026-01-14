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

  return (
    <div className="mb-3">
      <div className="d-flex justify-content-between small text-muted mb-1">
        <span>Team Demand</span>
        <span>{demand} WU</span>
      </div>
      <div className="progress mb-2" style={{ height: '8px', background: 'rgba(255,255,255,0.1)' }}>
        <div
          className="progress-bar"
          style={{
            width: `${demandPercent}%`,
            background: demand > capacity ? '#f87171' : '#60a5fa'
          }}
        />
      </div>

      <div className="d-flex justify-content-between small text-muted mb-1">
        <span>Team Capacity</span>
        <span>{capacity} WU</span>
      </div>
      <div className="progress" style={{ height: '8px', background: 'rgba(255,255,255,0.1)' }}>
        <div
          className="progress-bar"
          style={{
            width: `${capacityPercent}%`,
            background: '#34d399'
          }}
        />
      </div>
    </div>
  );
}

export function TeamCapacitySummary({ summary }: TeamCapacitySummaryProps) {
  const statusColors = {
    understaffed: '#f87171',
    overstaffed: '#fbbf24',
    balanced: '#34d399'
  };

  const statusLabels = {
    understaffed: 'Understaffed',
    overstaffed: 'Overstaffed',
    balanced: 'Balanced'
  };

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

        <div className="text-center p-3 rounded mb-3" style={{
          background: `${statusColors[summary.status]}15`,
          border: `1px solid ${statusColors[summary.status]}40`
        }}>
          <div className="stat-label text-muted">Capacity Gap</div>
          <div className="stat-value" style={{ color: statusColors[summary.status] }}>
            {summary.capacityGap > 0 ? '+' : ''}{summary.capacityGap} WU
          </div>
          <div className="small mt-1">
            <span className="badge-bespoke" style={{
              background: `${statusColors[summary.status]}20`,
              color: statusColors[summary.status]
            }}>
              {Math.abs(summary.capacityGapPercent)}% {statusLabels[summary.status]}
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
