/**
 * FeasibilityBadgeV2
 *
 * Displays the scenario feasibility status with appropriate styling.
 * V2 version using Tailwind tokens and lucide-react icons.
 */

import React from 'react';
import { CheckCircle, AlertTriangle, XCircle, HelpCircle } from 'lucide-react';
import { Feasibility } from '../../../../types/scenarioTypes';

interface FeasibilityBadgeV2Props {
  feasibility: Feasibility;
  size?: 'sm' | 'md' | 'lg';
}

const FEASIBILITY_CONFIG: Record<
  Feasibility,
  {
    label: string;
    Icon: typeof CheckCircle;
    className: string;
  }
> = {
  ON_TRACK: {
    label: 'On Track',
    Icon: CheckCircle,
    className: 'bg-good text-white',
  },
  AT_RISK: {
    label: 'At Risk',
    Icon: AlertTriangle,
    className: 'bg-warn text-gray-900',
  },
  IMPOSSIBLE: {
    label: 'Unlikely',
    Icon: XCircle,
    className: 'bg-bad text-white',
  },
  NOT_ENOUGH_DATA: {
    label: 'Insufficient Data',
    Icon: HelpCircle,
    className: 'bg-muted text-foreground',
  },
};

export function FeasibilityBadgeV2({ feasibility, size = 'md' }: FeasibilityBadgeV2Props) {
  const config = FEASIBILITY_CONFIG[feasibility];
  const Icon = config.Icon;

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5',
  };

  const iconSizes = {
    sm: 12,
    md: 14,
    lg: 16,
  };

  return (
    <span
      className={`inline-flex items-center rounded font-medium ${config.className} ${sizeClasses[size]}`}
    >
      <Icon size={iconSizes[size]} className="mr-1" />
      {config.label}
    </span>
  );
}

export default FeasibilityBadgeV2;
