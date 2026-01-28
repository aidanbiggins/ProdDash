import React from 'react';
import { ArrowRight, TrendingUp, TrendingDown, Target } from 'lucide-react';
import type { PipelineStage } from './types';
import type { PipelineBenchmarkConfig, StageBenchmark } from '../../types/pipelineTypes';
import { CanonicalStage } from '../../types/entities';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../../components/ui/tooltip';

interface PipelineFunnelV2Props {
  stages: PipelineStage[];
  benchmarks?: PipelineBenchmarkConfig | null;
  onStageClick?: (stageName: string, count: number) => void;
}

const stageColors = [
  '#06b6d4', // Cyan
  '#8b5cf6', // Purple
  '#f59e0b', // Amber
  '#3b82f6', // Blue
  '#22c55e', // Green
  '#10b981', // Emerald
];

// Map stage names to canonical stages for benchmark lookup
const stageNameToCanonical: Record<string, CanonicalStage> = {
  'Applied': CanonicalStage.APPLIED,
  'Screen': CanonicalStage.SCREEN,
  'HM Screen': CanonicalStage.HM_SCREEN,
  'Onsite': CanonicalStage.ONSITE,
  'Offer': CanonicalStage.OFFER,
  'Hired': CanonicalStage.HIRED,
};

function getBenchmarkForStage(
  stageName: string,
  benchmarks?: PipelineBenchmarkConfig | null
): StageBenchmark | undefined {
  if (!benchmarks) return undefined;
  const canonical = stageNameToCanonical[stageName];
  if (!canonical) return undefined;
  return benchmarks.stages.find(b => b.stage === canonical);
}

type PTRStatus = 'above' | 'on-track' | 'below' | 'critical';

function getPTRStatus(
  actualRate: number,
  benchmark: StageBenchmark
): PTRStatus {
  const actual = actualRate / 100; // Convert from percentage to decimal
  if (actual >= benchmark.targetPassRate) return 'above';
  if (actual >= (benchmark.targetPassRate + benchmark.minPassRate) / 2) return 'on-track';
  if (actual >= benchmark.minPassRate) return 'below';
  return 'critical';
}

function getPTRStatusConfig(status: PTRStatus): { color: string; bgColor: string; textColor: string } {
  switch (status) {
    case 'above':
      return { color: '#22c55e', bgColor: 'bg-green-500/20', textColor: 'text-green-400' };
    case 'on-track':
      return { color: '#3b82f6', bgColor: 'bg-blue-500/20', textColor: 'text-blue-400' };
    case 'below':
      return { color: '#f59e0b', bgColor: 'bg-amber-500/20', textColor: 'text-amber-400' };
    case 'critical':
      return { color: '#ef4444', bgColor: 'bg-red-500/20', textColor: 'text-red-400' };
  }
}

export function PipelineFunnelV2({ stages, benchmarks, onStageClick }: PipelineFunnelV2Props) {
  const maxCount = Math.max(...stages.map(s => s.count), 1);
  const hasBenchmarks = benchmarks && benchmarks.stages.length > 0;

  return (
    <div className="glass-panel h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Pipeline Funnel</h3>
          <p className="text-xs text-muted-foreground">Candidate flow through stages</p>
        </div>
        {hasBenchmarks && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Target className="w-3 h-3" />
            <span>vs targets</span>
          </div>
        )}
      </div>

      {/* Funnel Visualization */}
      <div className="p-6">
        <div className="space-y-4">
          {stages.map((stage, index) => {
            const barWidth = Math.max((stage.count / maxCount) * 100, 15);
            const color = stageColors[index % stageColors.length];
            const benchmark = getBenchmarkForStage(stage.name, benchmarks);
            const hasConversion = index < stages.length - 1 && stage.conversionRate !== undefined;

            // Calculate PTR status if we have benchmarks
            let ptrStatus: PTRStatus | null = null;
            let statusConfig = null;
            let variance: number | null = null;

            if (hasConversion && benchmark) {
              ptrStatus = getPTRStatus(stage.conversionRate, benchmark);
              statusConfig = getPTRStatusConfig(ptrStatus);
              variance = stage.conversionRate - (benchmark.targetPassRate * 100);
            }

            // Fall back to simple low conversion check if no benchmarks
            const isLowConversion = !benchmark && stage.conversionRate < 40 && index < stages.length - 1;

            return (
              <div key={stage.name}>
                <div className="flex items-center gap-4">
                  {/* Stage Label */}
                  <div className="w-[100px] shrink-0">
                    <p className="text-sm font-medium text-foreground">{stage.name}</p>
                    {stage.avgDays > 0 && (
                      <p className="text-xs text-muted-foreground">{stage.avgDays}d avg</p>
                    )}
                  </div>

                  {/* Bar */}
                  <div className="flex-1 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => onStageClick?.(stage.name, stage.count)}
                      className="h-10 rounded-lg transition-all duration-500 relative overflow-hidden cursor-pointer hover:ring-2 hover:ring-accent/50 focus:outline-none focus:ring-2 focus:ring-accent"
                      style={{
                        width: `${barWidth}%`,
                        backgroundColor: `${color}20`,
                        borderLeft: `3px solid ${color}`,
                      }}
                      title={`View ${stage.count} candidates in ${stage.name}`}
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
                    </button>

                    {/* Conversion Arrow with Target Comparison */}
                    {hasConversion && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className={`flex items-center gap-1.5 text-xs font-medium cursor-help ${
                            statusConfig
                              ? statusConfig.textColor
                              : isLowConversion
                                ? 'text-amber-500'
                                : 'text-muted-foreground'
                          }`}>
                            <ArrowRight className="w-3.5 h-3.5" />
                            <span>{stage.conversionRate}%</span>
                            {variance !== null && (
                              <span className="flex items-center gap-0.5">
                                {variance >= 0 ? (
                                  <TrendingUp className="w-3 h-3" />
                                ) : (
                                  <TrendingDown className="w-3 h-3" />
                                )}
                              </span>
                            )}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="max-w-[200px]">
                          {benchmark ? (
                            <div className="text-xs space-y-1">
                              <div className="flex justify-between gap-4">
                                <span className="text-muted-foreground">Actual:</span>
                                <span className="font-mono">{stage.conversionRate}%</span>
                              </div>
                              <div className="flex justify-between gap-4">
                                <span className="text-muted-foreground">Target:</span>
                                <span className="font-mono">{Math.round(benchmark.targetPassRate * 100)}%</span>
                              </div>
                              <div className="flex justify-between gap-4">
                                <span className="text-muted-foreground">Variance:</span>
                                <span className={`font-mono ${variance! >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                  {variance! >= 0 ? '+' : ''}{Math.round(variance!)}pp
                                </span>
                              </div>
                              <div className="pt-1 mt-1 border-t border-border text-muted-foreground">
                                Min threshold: {Math.round(benchmark.minPassRate * 100)}%
                              </div>
                            </div>
                          ) : (
                            <p className="text-xs">
                              {stage.conversionRate}% pass rate to next stage
                            </p>
                          )}
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Summary Stats */}
        <div className="mt-6 pt-4 border-t border-border grid grid-cols-3 gap-4">
          <button
            type="button"
            onClick={() => stages[0] && onStageClick?.(stages[0].name, stages[0].count)}
            className="text-center p-2 rounded-lg transition-colors hover:bg-accent/10 cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent"
            title={`View ${stages[0]?.count || 0} applied candidates`}
          >
            <p className="font-mono text-2xl font-semibold text-foreground">
              {stages[0]?.count || 0}
            </p>
            <p className="text-xs text-muted-foreground">Total Applied</p>
          </button>
          <button
            type="button"
            onClick={() => stages[stages.length - 1] && onStageClick?.(stages[stages.length - 1].name, stages[stages.length - 1].count)}
            className="text-center p-2 rounded-lg transition-colors hover:bg-accent/10 cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent"
            title={`View ${stages[stages.length - 1]?.count || 0} hired candidates`}
          >
            <p className="font-mono text-2xl font-semibold text-green-500">
              {stages[stages.length - 1]?.count || 0}
            </p>
            <p className="text-xs text-muted-foreground">Total Hired</p>
          </button>
          <div className="text-center p-2">
            <p className="font-mono text-2xl font-semibold text-primary">
              {stages.length > 0 && stages[0].count > 0
                ? Math.round((stages[stages.length - 1].count / stages[0].count) * 100)
                : 0}%
            </p>
            <p className="text-xs text-muted-foreground">Overall Conversion</p>
          </div>
        </div>

        {/* Legend (only show when benchmarks are active) */}
        {hasBenchmarks && (
          <div className="mt-4 pt-4 border-t border-border">
            <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
              <span className="font-medium">PTR vs Target:</span>
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-500" />
                <span>Above</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-blue-500" />
                <span>On Track</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span>Below</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                <span>Critical</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
