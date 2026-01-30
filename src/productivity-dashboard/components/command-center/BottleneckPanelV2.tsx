/**
 * BottleneckPanel V2 - Tailwind Implementation
 * Matches V0 reference design exactly
 */
import React from 'react';
import { cn } from '../ui-primitives/utils';

type RiskLevel = 'good' | 'warn' | 'bad' | 'neutral';
type BottleneckType = 'stage' | 'recruiter' | 'department' | 'requisition';

interface BottleneckItem {
  id: string;
  type: BottleneckType;
  name: string;
  severity: RiskLevel;
  metric: string;
  value: number;
  impact: string;
  recommendation: string;
}

interface BottleneckPanelV2Props {
  bottlenecks: BottleneckItem[];
  onViewAll?: () => void;
}

const severityConfig: Record<RiskLevel, { bg: string; border: string; text: string }> = {
  bad: {
    bg: 'bg-[rgba(239,68,68,0.08)]',
    border: 'border-l-bad',
    text: 'text-destructive',
  },
  warn: {
    bg: 'bg-[rgba(245,158,11,0.08)]',
    border: 'border-l-warn',
    text: 'text-warn-text',
  },
  good: {
    bg: 'bg-[rgba(34,197,94,0.08)]',
    border: 'border-l-good',
    text: 'text-good-text',
  },
  neutral: {
    bg: 'bg-[rgba(100,116,139,0.08)]',
    border: 'border-l-dim',
    text: 'text-muted-foreground',
  },
};

// Type icons as SVG components
const TypeIcons: Record<BottleneckType, React.ReactNode> = {
  stage: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </svg>
  ),
  recruiter: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  ),
  department: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" />
      <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" />
      <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" />
    </svg>
  ),
  requisition: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  ),
};

// Alert triangle icon
const AlertTriangleIcon = () => (
  <svg className="w-4 h-4 text-warn" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

// Format value with appropriate unit
function formatValue(value: number, metric: string): string {
  if (metric.includes('Rate') || metric.includes('Utilization')) {
    return `${value}%`;
  }
  if (metric.includes('Time') || metric.includes('Days')) {
    return `${value} days`;
  }
  return String(value);
}

export function BottleneckPanelV2({ bottlenecks, onViewAll }: BottleneckPanelV2Props) {
  // Sort by severity: bad first, then warn, then neutral, then good
  const sortedBottlenecks = [...bottlenecks].sort((a, b) => {
    const severityOrder: Record<RiskLevel, number> = { bad: 0, warn: 1, neutral: 2, good: 3 };
    return severityOrder[a.severity] - severityOrder[b.severity];
  });

  const criticalCount = bottlenecks.filter(b => b.severity === 'bad').length;

  return (
    <div className="glass-panel">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.06]">
        <AlertTriangleIcon />
        <h3 className="text-sm font-semibold text-foreground">Bottlenecks &amp; Risks</h3>
        {criticalCount > 0 && (
          <span className="ml-auto px-2 py-0.5 rounded text-xs font-medium bg-destructive/10 text-destructive">
            {criticalCount} Critical
          </span>
        )}
      </div>

      {/* Bottleneck List */}
      <div className="p-3 space-y-2 max-h-[400px] overflow-y-auto">
        {sortedBottlenecks.map((bottleneck, index) => {
          const config = severityConfig[bottleneck.severity];

          return (
            <div
              key={bottleneck.id}
              className={cn(
                'p-3 rounded-lg border-l-2 transition-colors hover:bg-white/[0.04]',
                config.bg,
                config.border
              )}
            >
              {/* Header Row */}
              <div className="flex items-start gap-2 mb-2">
                <div className="flex items-center justify-center w-5 h-5 rounded bg-white/[0.06] text-muted-foreground flex-shrink-0">
                  <span className="text-xs font-bold">{index + 1}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-muted-foreground">{TypeIcons[bottleneck.type]}</span>
                    <span className="text-sm font-medium text-foreground truncate">
                      {bottleneck.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{bottleneck.metric}:</span>
                    <span className={cn('font-mono font-medium', config.text)}>
                      {formatValue(bottleneck.value, bottleneck.metric)}
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
      {onViewAll && (
        <div className="px-4 py-3 border-t border-white/[0.06]">
          <button
            type="button"
            className="text-xs font-medium text-primary hover:text-accent-hover transition-colors"
            onClick={onViewAll}
          >
            View all bottlenecks
          </button>
        </div>
      )}
    </div>
  );
}

export default BottleneckPanelV2;
