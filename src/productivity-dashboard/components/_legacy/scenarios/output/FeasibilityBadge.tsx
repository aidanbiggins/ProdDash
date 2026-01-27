/**
 * Feasibility Badge
 *
 * Displays the scenario feasibility status with appropriate styling.
 */

import React from 'react';
import { Feasibility } from '../../../../types/scenarioTypes';

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

  const bgClasses: Record<string, string> = {
    'bg-success': 'bg-green-500 text-white',
    'bg-warning text-dark': 'bg-yellow-500 text-gray-900',
    'bg-danger': 'bg-red-500 text-white',
    'bg-secondary': 'bg-gray-500 text-white',
  };

  const tailwindBg = bgClasses[config.className] || 'bg-gray-500 text-white';

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${tailwindBg} ${sizeClasses[size]} feasibility-badge`}>
      <i className={`bi bi-${config.icon} mr-1`} />
      {config.label}
    </span>
  );
}
