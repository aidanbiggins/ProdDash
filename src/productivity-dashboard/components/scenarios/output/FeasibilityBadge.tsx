/**
 * Feasibility Badge
 *
 * Displays the scenario feasibility status with appropriate styling.
 */

import React from 'react';
import { Feasibility } from '../../../types/scenarioTypes';

interface FeasibilityBadgeProps {
  feasibility: Feasibility;
  size?: 'sm' | 'md' | 'lg';
}

const FEASIBILITY_CONFIG: Record<Feasibility, {
  label: string;
  icon: string;
  className: string;
}> = {
  ON_TRACK: {
    label: 'On Track',
    icon: 'check-circle-fill',
    className: 'bg-success',
  },
  AT_RISK: {
    label: 'At Risk',
    icon: 'exclamation-triangle-fill',
    className: 'bg-warning text-dark',
  },
  IMPOSSIBLE: {
    label: 'Unlikely',
    icon: 'x-circle-fill',
    className: 'bg-danger',
  },
  NOT_ENOUGH_DATA: {
    label: 'Insufficient Data',
    icon: 'question-circle-fill',
    className: 'bg-secondary',
  },
};

export default function FeasibilityBadge({
  feasibility,
  size = 'md',
}: FeasibilityBadgeProps) {
  const config = FEASIBILITY_CONFIG[feasibility];

  const sizeClasses = {
    sm: 'badge-sm',
    md: '',
    lg: 'badge-lg',
  };

  return (
    <span className={`badge ${config.className} ${sizeClasses[size]} feasibility-badge`}>
      <i className={`bi bi-${config.icon} me-1`} />
      {config.label}
    </span>
  );
}
