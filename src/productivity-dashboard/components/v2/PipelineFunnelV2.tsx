import React from 'react';
import { ArrowRight } from 'lucide-react';
import type { PipelineStage } from './types';

interface PipelineFunnelV2Props {
  stages: PipelineStage[];
}

const stageColors = [
  '#06b6d4', // Cyan
  '#8b5cf6', // Purple
  '#f59e0b', // Amber
  '#3b82f6', // Blue
  '#22c55e', // Green
  '#10b981', // Emerald
];

export function PipelineFunnelV2({ stages }: PipelineFunnelV2Props) {
  const maxCount = Math.max(...stages.map(s => s.count), 1);

  return (
    <div className="glass-panel h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Pipeline Funnel</h3>
          <p className="text-xs text-muted-foreground">Candidate flow through stages</p>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#22c55e]" />
            <span>Good conversion</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#f59e0b]" />
            <span>Needs attention</span>
          </div>
        </div>
      </div>

      {/* Funnel Visualization */}
      <div className="p-6">
        <div className="space-y-4">
          {stages.map((stage, index) => {
            const barWidth = Math.max((stage.count / maxCount) * 100, 15);
            const color = stageColors[index % stageColors.length];
            const isLowConversion = stage.conversionRate < 40 && index < stages.length - 1;

            return (
              <div key={stage.name}>
                <div className="flex items-center gap-4">
                  {/* Stage Label */}
                  <div className="w-[100px] shrink-0">
                    <p className="text-sm font-medium text-foreground">{stage.name}</p>
                    <p className="text-xs text-muted-foreground">{stage.avgDays}d avg</p>
                  </div>

                  {/* Bar */}
                  <div className="flex-1 flex items-center gap-3">
                    <div
                      className="h-10 rounded-lg transition-all duration-500 relative overflow-hidden"
                      style={{
                        width: `${barWidth}%`,
                        backgroundColor: `${color}20`,
                        borderLeft: `3px solid ${color}`,
                      }}
                    >
                      <div
                        className="absolute inset-0 opacity-30"
                        style={{
                          background: `linear-gradient(90deg, ${color}40 0%, transparent 100%)`,
                        }}
                      />
                      <div className="absolute inset-0 flex items-center px-3">
                        <span className="font-mono text-lg font-semibold text-foreground">
                          {stage.count}
                        </span>
                      </div>
                    </div>

                    {/* Conversion Arrow */}
                    {index < stages.length - 1 && (
                      <div className={`flex items-center gap-1 text-xs font-medium ${
                        isLowConversion ? 'text-[#f59e0b]' : 'text-muted-foreground'
                      }`}>
                        <ArrowRight className="w-3.5 h-3.5" />
                        <span>{stage.conversionRate}%</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Summary Stats */}
        <div className="mt-6 pt-4 border-t border-white/[0.06] grid grid-cols-3 gap-4">
          <div className="text-center">
            <p className="font-mono text-2xl font-semibold text-foreground">
              {stages[0]?.count || 0}
            </p>
            <p className="text-xs text-muted-foreground">Total Applied</p>
          </div>
          <div className="text-center">
            <p className="font-mono text-2xl font-semibold text-[#22c55e]">
              {stages[stages.length - 1]?.count || 0}
            </p>
            <p className="text-xs text-muted-foreground">Total Hired</p>
          </div>
          <div className="text-center">
            <p className="font-mono text-2xl font-semibold text-primary">
              {stages.length > 0 && stages[0].count > 0
                ? Math.round((stages[stages.length - 1].count / stages[0].count) * 100)
                : 0}%
            </p>
            <p className="text-xs text-muted-foreground">Overall Conversion</p>
          </div>
        </div>
      </div>
    </div>
  );
}
