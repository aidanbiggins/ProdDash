import React from 'react';
import { TrendingUp, TrendingDown, Minus, HelpCircle } from 'lucide-react';
import type { RiskLevel } from './types';
import { Card } from '../../../components/ui/card';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../../../components/ui/tooltip';
import { cn } from '../../../lib/utils';

interface KPICardV2Props {
  label: string;
  value: string | number;
  subtitle?: string;
  change?: number;
  trend?: 'up' | 'down' | 'flat';
  status: RiskLevel;
  helpText?: string;
  onClick?: () => void;
}

const statusStyles: Record<RiskLevel, {
  badge: string;
  border: string;
  label: string;
}> = {
  good: {
    badge: 'bg-success/10 text-success',
    border: 'border-l-success',
    label: 'green',
  },
  warn: {
    badge: 'bg-warning/10 text-warning',
    border: 'border-l-warning',
    label: 'yellow',
  },
  bad: {
    badge: 'bg-destructive/10 text-destructive',
    border: 'border-l-destructive',
    label: 'red',
  },
  neutral: {
    badge: 'bg-muted text-muted-foreground',
    border: 'border-l-muted-foreground',
    label: 'neutral',
  },
};

export function KPICardV2({ label, value, subtitle, change, trend, status, helpText, onClick }: KPICardV2Props) {
  const styles = statusStyles[status];

  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendColor = trend === 'up'
    ? (status === 'good' ? 'text-success' : 'text-destructive')
    : trend === 'down'
      ? (status === 'good' ? 'text-success' : 'text-destructive')
      : 'text-muted-foreground';

  return (
    <Card
      className={cn(
        'group relative overflow-hidden p-4 transition-all duration-200 border-l-[3px]',
        styles.border,
        onClick && 'cursor-pointer hover:bg-accent/50'
      )}
      onClick={onClick}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {/* Label Row */}
      <div className="mb-3 flex items-start justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <div className="flex items-center gap-1.5">
          {helpText && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
                  >
                    <HelpCircle className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[200px]">
                  <p className="text-xs">{helpText}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase', styles.badge)}>
            {styles.label}
          </span>
        </div>
      </div>

      {/* Value */}
      <div className="mb-1 font-mono text-3xl font-semibold tabular-nums text-foreground">
        {value}
      </div>

      {/* Subtitle or Trend */}
      {subtitle ? (
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      ) : change !== undefined ? (
        <div className={cn('flex items-center gap-1 text-xs font-medium', trendColor)}>
          <TrendIcon className="w-3 h-3" />
          <span>{change > 0 ? '+' : ''}{change}%</span>
        </div>
      ) : null}
    </Card>
  );
}

