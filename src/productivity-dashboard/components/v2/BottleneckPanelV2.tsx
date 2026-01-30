import React from 'react';
import { AlertTriangle, TrendingUp, User, Building2, FileText, ChevronRight } from 'lucide-react';
import type { BottleneckItem, RiskLevel } from './types';

interface BottleneckPanelV2Props {
  bottlenecks: BottleneckItem[];
  onRiskClick?: (riskId: string) => void;
}

const severityColors: Record<RiskLevel, { bg: string; border: string; text: string; dot: string }> = {
  bad: {
    bg: 'bg-red-500/10',
    border: 'border-l-red-500',
    text: 'text-red-400',
    dot: 'bg-red-500',
  },
  warn: {
    bg: 'bg-amber-500/10',
    border: 'border-l-amber-500',
    text: 'text-amber-400',
    dot: 'bg-amber-500',
  },
  good: {
    bg: 'bg-green-500/10',
    border: 'border-l-green-500',
    text: 'text-green-400',
    dot: 'bg-green-500',
  },
  neutral: {
    bg: 'bg-slate-500/10',
    border: 'border-l-slate-500',
    text: 'text-slate-400',
    dot: 'bg-slate-500',
  },
};

const typeIcons: Record<string, React.ReactNode> = {
  stage: <TrendingUp className="w-4 h-4" />,
  recruiter: <User className="w-4 h-4" />,
  department: <Building2 className="w-4 h-4" />,
  requisition: <FileText className="w-4 h-4" />,
};

export function BottleneckPanelV2({ bottlenecks, onRiskClick }: BottleneckPanelV2Props) {
  const sortedBottlenecks = [...bottlenecks].sort((a, b) => {
    const severityOrder: Record<RiskLevel, number> = { bad: 0, warn: 1, neutral: 2, good: 3 };
    return severityOrder[a.severity] - severityOrder[b.severity];
  });

  return (
    <div className="rounded-lg border border-glass-border bg-bg-glass">
      {/* Bottleneck List */}
      <div className="p-3 space-y-2">
        {sortedBottlenecks.map((bottleneck, index) => {
          const colors = severityColors[bottleneck.severity];
          const isClickable = !!onRiskClick;

          return (
            <button
              key={bottleneck.id}
              type="button"
              onClick={() => onRiskClick?.(bottleneck.id)}
              className={`w-full text-left p-3 rounded-lg border-l-2 ${colors.bg} ${colors.border} transition-colors hover:bg-accent/20 ${isClickable ? 'cursor-pointer' : ''}`}
            >
              {/* Header Row */}
              <div className="flex items-start gap-2 mb-2">
                <div className="flex items-center justify-center w-5 h-5 rounded bg-muted text-muted-foreground shrink-0">
                  <span className="text-xs font-bold">{index + 1}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-muted-foreground">{typeIcons[bottleneck.type]}</span>
                    <span className="text-sm font-medium text-foreground truncate">
                      {bottleneck.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{bottleneck.metric}:</span>
                    <span className={`font-mono font-medium ${colors.text}`}>
                      {bottleneck.value}{bottleneck.metric.includes('Rate') || bottleneck.metric.includes('Utilization') ? '%' : bottleneck.metric.includes('Time') || bottleneck.metric.includes('Days') ? ' days' : ''}
                    </span>
                  </div>
                </div>
                {isClickable && (
                  <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                )}
              </div>

              {/* Impact */}
              <p className="text-xs text-muted-foreground mb-2 pl-7">
                {bottleneck.impact}
              </p>

              {/* Recommendation */}
              <div className="pl-7">
                <p className="text-xs text-primary">
                  {bottleneck.recommendation}
                </p>
              </div>
            </button>
          );
        })}
      </div>

    </div>
  );
}
