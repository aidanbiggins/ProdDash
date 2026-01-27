import React from 'react';
import { TrendingUp, TrendingDown, Minus, HelpCircle } from 'lucide-react';
import type { RiskLevel } from './types';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../../../components/ui/tooltip';

interface KPICardV2Props {
  label: string;
  value: string | number;
  change?: number;
  trend?: 'up' | 'down' | 'flat';
  status: RiskLevel;
  helpText?: string;
  onClick?: () => void;
}

const statusColors: Record<RiskLevel, { bg: string; border: string; text: string }> = {
  good: {
    bg: 'bg-[rgba(34,197,94,0.12)]',
    border: 'border-[rgba(34,197,94,0.4)]',
    text: 'text-[#86efac]',
  },
  warn: {
    bg: 'bg-[rgba(245,158,11,0.12)]',
    border: 'border-[rgba(245,158,11,0.4)]',
    text: 'text-[#fcd34d]',
  },
  bad: {
    bg: 'bg-[rgba(239,68,68,0.12)]',
    border: 'border-[rgba(239,68,68,0.4)]',
    text: 'text-[#fca5a5]',
  },
  neutral: {
    bg: 'bg-[rgba(100,116,139,0.12)]',
    border: 'border-[rgba(100,116,139,0.4)]',
    text: 'text-[#94a3b8]',
  },
};

export function KPICardV2({ label, value, change, trend, status, helpText, onClick }: KPICardV2Props) {
  const colors = statusColors[status];

  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendColor = trend === 'up'
    ? (status === 'good' ? 'text-[#22c55e]' : 'text-[#ef4444]')
    : trend === 'down'
    ? (status === 'good' ? 'text-[#22c55e]' : 'text-[#ef4444]')
    : 'text-[#64748b]';

  return (
    <div
      className={`glass-panel p-3 md:p-4 transition-all duration-150 ${
        onClick ? 'cursor-pointer hover:border-white/[0.15] hover:translate-y-[-1px]' : ''
      }`}
      onClick={onClick}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {/* Label Row */}
      <div className="flex items-center gap-1.5 md:gap-2 mb-1.5 md:mb-2">
        <span className="text-[10px] md:text-xs font-medium uppercase tracking-wider text-muted-foreground line-clamp-1">
          {label}
        </span>
        {helpText && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="w-3 h-3 text-muted-foreground cursor-help shrink-0 hidden sm:block" />
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[200px]">
                <p className="text-xs">{helpText}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>

      {/* Value */}
      <div className="stat-value text-2xl md:text-3xl font-semibold text-foreground mb-1.5 md:mb-2">
        {value}
      </div>

      {/* Trend & Status */}
      <div className="flex items-center justify-between gap-2">
        {change !== undefined && (
          <div className={`flex items-center gap-1 text-xs md:text-sm font-medium ${trendColor}`}>
            <TrendIcon className="w-3 h-3 md:w-3.5 md:h-3.5" />
            <span>{change > 0 ? '+' : ''}{change}%</span>
          </div>
        )}
        <div className={`px-1.5 md:px-2 py-0.5 rounded text-[10px] md:text-xs font-medium ${colors.bg} ${colors.text} whitespace-nowrap`}>
          {status === 'good' ? 'On Track' : status === 'warn' ? 'At Risk' : status === 'bad' ? 'Critical' : 'Neutral'}
        </div>
      </div>
    </div>
  );
}
