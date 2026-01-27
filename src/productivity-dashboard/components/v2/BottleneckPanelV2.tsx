import React from 'react';
import { AlertTriangle, TrendingUp, User, Building2, FileText } from 'lucide-react';
import type { BottleneckItem, RiskLevel } from './types';

interface BottleneckPanelV2Props {
  bottlenecks: BottleneckItem[];
}

const severityColors: Record<RiskLevel, { bg: string; border: string; text: string; dot: string }> = {
  bad: {
    bg: 'bg-[rgba(239,68,68,0.08)]',
    border: 'border-l-[#ef4444]',
    text: 'text-[#fca5a5]',
    dot: 'bg-[#ef4444]',
  },
  warn: {
    bg: 'bg-[rgba(245,158,11,0.08)]',
    border: 'border-l-[#f59e0b]',
    text: 'text-[#fcd34d]',
    dot: 'bg-[#f59e0b]',
  },
  good: {
    bg: 'bg-[rgba(34,197,94,0.08)]',
    border: 'border-l-[#22c55e]',
    text: 'text-[#86efac]',
    dot: 'bg-[#22c55e]',
  },
  neutral: {
    bg: 'bg-[rgba(100,116,139,0.08)]',
    border: 'border-l-[#64748b]',
    text: 'text-[#94a3b8]',
    dot: 'bg-[#64748b]',
  },
};

const typeIcons: Record<string, React.ReactNode> = {
  stage: <TrendingUp className="w-4 h-4" />,
  recruiter: <User className="w-4 h-4" />,
  department: <Building2 className="w-4 h-4" />,
  requisition: <FileText className="w-4 h-4" />,
};

export function BottleneckPanelV2({ bottlenecks }: BottleneckPanelV2Props) {
  const sortedBottlenecks = [...bottlenecks].sort((a, b) => {
    const severityOrder: Record<RiskLevel, number> = { bad: 0, warn: 1, neutral: 2, good: 3 };
    return severityOrder[a.severity] - severityOrder[b.severity];
  });

  return (
    <div className="glass-panel h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.06]">
        <AlertTriangle className="w-4 h-4 text-[#f59e0b]" />
        <h3 className="text-sm font-semibold text-foreground">Bottlenecks & Risks</h3>
        <span className="ml-auto px-2 py-0.5 rounded text-xs font-medium bg-[rgba(239,68,68,0.15)] text-[#fca5a5]">
          {bottlenecks.filter(b => b.severity === 'bad').length} Critical
        </span>
      </div>

      {/* Bottleneck List */}
      <div className="p-3 space-y-2 max-h-[400px] overflow-y-auto">
        {sortedBottlenecks.map((bottleneck, index) => {
          const colors = severityColors[bottleneck.severity];

          return (
            <div
              key={bottleneck.id}
              className={`p-3 rounded-lg border-l-2 ${colors.bg} ${colors.border} transition-colors hover:bg-white/[0.04]`}
            >
              {/* Header Row */}
              <div className="flex items-start gap-2 mb-2">
                <div className="flex items-center justify-center w-5 h-5 rounded bg-white/[0.06] text-muted-foreground flex-shrink-0">
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
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-white/[0.06]">
        <button
          type="button"
          className="text-xs font-medium text-primary hover:text-primary/80 transition-colors"
        >
          View all bottlenecks
        </button>
      </div>
    </div>
  );
}
