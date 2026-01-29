// Pipeline Health Summary Card Component (V2)
// Shows ideal vs actual pipeline performance with insights

import React, { useState } from 'react';
import { Info } from 'lucide-react';
import { LogoSpinner } from '../common/LogoSpinner';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell
} from 'recharts';
import {
  PipelineHealthSummary,
  StagePerformance,
  PerformanceStatus,
  PipelineInsight
} from '../../types/pipelineTypes';

interface PipelineHealthCardProps {
  healthSummary: PipelineHealthSummary | null;
  isLoading?: boolean;
  onConfigureClick?: () => void;
  compact?: boolean;  // For overview page
}

const STATUS_COLORS: Record<PerformanceStatus, string> = {
  ahead: 'var(--good)',
  'on-track': 'var(--primary)',
  behind: 'var(--warn)',
  critical: 'var(--bad)'
};

const STATUS_BG_CLASSES: Record<PerformanceStatus, string> = {
  ahead: 'bg-good/10',
  'on-track': 'bg-primary/10',
  behind: 'bg-warn/10',
  critical: 'bg-bad/10'
};

const STATUS_TEXT_CLASSES: Record<PerformanceStatus, string> = {
  ahead: 'text-good',
  'on-track': 'text-primary',
  behind: 'text-warn',
  critical: 'text-bad'
};

const STATUS_LABELS: Record<PerformanceStatus, string> = {
  ahead: 'Ahead',
  'on-track': 'On Track',
  behind: 'Behind',
  critical: 'Critical'
};

function getStatusBadgeClass(status: PerformanceStatus): string {
  const classes: Record<PerformanceStatus, string> = {
    ahead: 'bg-good/20 text-good',
    'on-track': 'bg-primary/20 text-primary',
    behind: 'bg-warn/20 text-warn',
    critical: 'bg-bad/20 text-bad'
  };
  return classes[status];
}

export function PipelineHealthCard({
  healthSummary,
  isLoading,
  onConfigureClick,
  compact = false
}: PipelineHealthCardProps) {
  if (isLoading) {
    return (
      <div className="glass-panel p-4">
        <div className="text-center py-5">
          <LogoSpinner size={32} message="Calculating pipeline health..." layout="stacked" />
        </div>
      </div>
    );
  }

  if (!healthSummary) {
    return (
      <div className="glass-panel p-4">
        <div className="text-center py-4">
          <i className="bi bi-bar-chart text-muted-foreground text-2xl"></i>
          <div className="mt-2 text-muted-foreground">No pipeline data available</div>
          {onConfigureClick && (
            <button className="px-3 py-1.5 text-xs rounded border border-border text-muted-foreground hover:bg-muted/50 mt-3" onClick={onConfigureClick}>
              <i className="bi bi-gear mr-1"></i>
              Configure Benchmarks
            </button>
          )}
        </div>
      </div>
    );
  }

  // Prepare chart data
  const chartData: Array<{
    name: string;
    target: number;
    actual: number;
    variance: number;
    status: PerformanceStatus;
  }> = healthSummary.stagePerformance.map(stage => ({
    name: stage.stageName,
    target: stage.targetDays,
    actual: stage.actualMedianDays,
    variance: stage.durationVariance,
    status: stage.durationStatus
  }));

  if (compact) {
    return <CompactHealthCard healthSummary={healthSummary} onConfigureClick={onConfigureClick} />;
  }

  return (
    <div className="glass-panel">
      <div className="flex justify-between items-center p-4 border-b border-border">
        <div>
          <h6 className="text-base font-semibold text-foreground flex items-center gap-2">
            <i className="bi bi-speedometer2"></i>
            Pipeline Health
          </h6>
          <span className="text-xs text-muted-foreground">Ideal vs Actual Performance</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getStatusBadgeClass(healthSummary.overallStatus)}`}>
              {STATUS_LABELS[healthSummary.overallStatus]}
            </span>
            <div className="text-xs text-muted-foreground mt-1">Score: {healthSummary.healthScore}/100</div>
          </div>
          {onConfigureClick && (
            <button
              className="px-3 py-1.5 text-xs rounded border border-border text-muted-foreground hover:bg-muted/50 transition-colors"
              onClick={onConfigureClick}
              title="Configure benchmarks"
            >
              <i className="bi bi-gear mr-1"></i>
              Configure
            </button>
          )}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* TTF Summary */}
        <div className="grid grid-cols-3 gap-3">
          <div className={`text-center p-3 rounded ${STATUS_BG_CLASSES[healthSummary.ttfStatus]}`}>
            <div className="text-[0.65rem] uppercase tracking-wider text-muted-foreground mb-1">Target TTF</div>
            <div className="font-mono text-2xl font-bold text-foreground">{healthSummary.targetTTF}d</div>
          </div>
          <div className={`text-center p-3 rounded ${STATUS_BG_CLASSES[healthSummary.ttfStatus]}`}>
            <div className="text-[0.65rem] uppercase tracking-wider text-muted-foreground mb-1">Actual Median TTF</div>
            <div className={`font-mono text-2xl font-bold ${STATUS_TEXT_CLASSES[healthSummary.ttfStatus]}`}>
              {healthSummary.actualMedianTTF.toFixed(0)}d
            </div>
          </div>
          <div className={`text-center p-3 rounded ${STATUS_BG_CLASSES[healthSummary.ttfStatus]}`}>
            <div className="text-[0.65rem] uppercase tracking-wider text-muted-foreground mb-1">Variance</div>
            <div className={`font-mono text-2xl font-bold ${STATUS_TEXT_CLASSES[healthSummary.ttfStatus]}`}>
              {healthSummary.ttfVariance > 0 ? '+' : ''}{healthSummary.ttfVariance.toFixed(0)}d
            </div>
          </div>
        </div>

        {/* Timeline Comparison Chart */}
        <div>
          <div className="text-xs text-muted-foreground mb-3">Stage Duration: Target vs Actual</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} layout="vertical" margin={{ left: 80, right: 20, top: 10, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis type="number" fontSize={11} unit="d" stroke="var(--muted-foreground)" tick={{ fill: 'var(--muted-foreground)', fontFamily: "'JetBrains Mono', monospace" }} />
              <YAxis dataKey="name" type="category" fontSize={11} width={75} stroke="var(--muted-foreground)" tick={{ fill: 'var(--muted-foreground)' }} />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.[0]) return null;
                  const d = payload[0].payload as typeof chartData[0];
                  return (
                    <div className="glass-panel p-3 text-sm">
                      <div className="font-semibold text-foreground">{d.name}</div>
                      <div className="text-muted-foreground">Target: {d.target}d</div>
                      <div className="text-muted-foreground">Actual: {d.actual.toFixed(1)}d</div>
                      <div className={STATUS_TEXT_CLASSES[d.status]}>
                        {d.variance > 0 ? `+${d.variance.toFixed(1)}d behind` : `${Math.abs(d.variance).toFixed(1)}d ahead`}
                      </div>
                    </div>
                  );
                }}
              />
              <Bar dataKey="target" fill="var(--muted)" name="Target" radius={[0, 4, 4, 0]} />
              <Bar dataKey="actual" name="Actual" radius={[0, 4, 4, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.status]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Stage Performance Summary */}
        <div>
          <div className="text-xs text-muted-foreground mb-3">Stage Performance</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {healthSummary.stagePerformance.map(stage => (
              <StageHealthMini key={stage.stage} stage={stage} />
            ))}
          </div>
        </div>

        {/* Top Insights */}
        {healthSummary.topInsights.length > 0 && (
          <div>
            <div className="text-xs text-muted-foreground mb-3 flex items-center gap-1">
              <i className="bi bi-lightbulb"></i>
              Key Insights
            </div>
            <div className="space-y-2">
              {healthSummary.topInsights.slice(0, 3).map((insight, i) => (
                <InsightItem key={i} insight={insight} />
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="px-4 py-3 border-t border-border text-xs text-muted-foreground">
        Based on {healthSummary.sampleSize} hires in selected period
      </div>
    </div>
  );
}

// Compact version for Overview page
function CompactHealthCard({
  healthSummary,
  onConfigureClick
}: {
  healthSummary: PipelineHealthSummary;
  onConfigureClick?: () => void;
}) {
  const [showLegend, setShowLegend] = useState(false);

  return (
    <div className="glass-panel h-full p-4">
      <div className="flex justify-between items-start mb-3">
        <div>
          <div className="text-[0.65rem] uppercase tracking-wider text-muted-foreground">Pipeline Health</div>
          <div className="flex items-center gap-2 mt-1">
            <span className="font-mono text-2xl font-bold text-foreground">{healthSummary.healthScore}</span>
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getStatusBadgeClass(healthSummary.overallStatus)}`}>
              {STATUS_LABELS[healthSummary.overallStatus]}
            </span>
          </div>
        </div>
        {onConfigureClick && (
          <button
            className="p-1 border-0 bg-transparent text-muted-foreground hover:text-foreground transition-colors"
            onClick={onConfigureClick}
            title="Configure Benchmarks"
          >
            <i className="bi bi-gear"></i>
          </button>
        )}
      </div>

      {/* Mini TTF comparison */}
      <div className="flex justify-between text-sm mb-3">
        <span className="text-muted-foreground">TTF:</span>
        <span>
          <span className={STATUS_TEXT_CLASSES[healthSummary.ttfStatus]}>
            {healthSummary.actualMedianTTF.toFixed(0)}d
          </span>
          <span className="text-muted-foreground"> / {healthSummary.targetTTF}d target</span>
        </span>
      </div>

      {/* Stage status dots with legend button */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[0.65rem] uppercase tracking-wider text-muted-foreground">Stage Status</span>
          <button
            onClick={() => setShowLegend(!showLegend)}
            className="text-muted-foreground hover:text-foreground transition-colors"
            title="Show legend"
          >
            <Info className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Legend (collapsible) */}
        {showLegend && (
          <div className="mb-2 p-2 rounded bg-muted/30 border border-border text-[0.65rem]">
            <div className="grid grid-cols-2 gap-1">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-good"></span>
                <span className="text-muted-foreground">Ahead of target</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-primary"></span>
                <span className="text-muted-foreground">On track</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-warn"></span>
                <span className="text-muted-foreground">Behind target</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-bad"></span>
                <span className="text-muted-foreground">Critical</span>
              </div>
            </div>
          </div>
        )}

        {/* Stage dots */}
        <div className="flex gap-2">
          {healthSummary.stagePerformance.map(stage => (
            <div
              key={stage.stage}
              className="grow text-center group cursor-help"
              title={`${stage.stageName}: ${stage.actualMedianDays.toFixed(0)}d actual (target: ${stage.targetDays}d) - ${STATUS_LABELS[stage.durationStatus]}`}
            >
              <div
                className="w-3 h-3 rounded-full mx-auto mb-1 transition-transform group-hover:scale-125"
                style={{ backgroundColor: STATUS_COLORS[stage.durationStatus] }}
              />
              <div className="text-[0.65rem] text-muted-foreground">
                {stage.stageName.split(' ')[0]}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Top insight */}
      {healthSummary.topInsights[0] && (
        <div className="p-2 rounded bg-muted/30 border border-border text-xs text-foreground">
          <i className={`bi ${healthSummary.topInsights[0].severity === 'critical' ? 'bi-exclamation-triangle text-bad' : 'bi-info-circle text-primary'} mr-1`}></i>
          {healthSummary.topInsights[0].message}
        </div>
      )}
    </div>
  );
}

// Mini stage health indicator
function StageHealthMini({ stage }: { stage: StagePerformance }) {
  const worstStatus = stage.durationStatus === 'critical' || stage.passRateStatus === 'critical'
    ? 'critical'
    : stage.durationStatus === 'behind' || stage.passRateStatus === 'behind'
      ? 'behind'
      : stage.durationStatus === 'on-track' || stage.passRateStatus === 'on-track'
        ? 'on-track'
        : 'ahead';

  return (
    <div className={`p-2 rounded text-center ${STATUS_BG_CLASSES[worstStatus]} border border-current/20`}>
      <div className="font-medium text-sm text-foreground">{stage.stageName}</div>
      <div className="flex justify-between mt-1 text-[0.65rem]">
        <span title="Duration" className="flex items-center gap-0.5">
          <i className="bi bi-clock"></i>
          <span className={STATUS_TEXT_CLASSES[stage.durationStatus]}>
            {stage.actualMedianDays.toFixed(0)}d
          </span>
        </span>
        <span title="Pass Rate" className="flex items-center gap-0.5">
          <i className="bi bi-funnel"></i>
          <span className={STATUS_TEXT_CLASSES[stage.passRateStatus]}>
            {(stage.actualPassRate * 100).toFixed(0)}%
          </span>
        </span>
      </div>
    </div>
  );
}

// Insight item
function InsightItem({ insight }: { insight: PipelineInsight }) {
  const severityConfig = {
    critical: { icon: 'bi-exclamation-triangle-fill', class: 'text-bad' },
    warning: { icon: 'bi-exclamation-circle-fill', class: 'text-warn' },
    info: { icon: 'bi-info-circle-fill', class: 'text-primary' }
  }[insight.severity];

  return (
    <div className="p-2 rounded bg-muted/30">
      <div className="flex items-start gap-2">
        <i className={`bi ${severityConfig.icon} ${severityConfig.class} mt-0.5`}></i>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-foreground">{insight.message}</div>
          <div className="text-xs text-muted-foreground">{insight.dataPoint}</div>
          {insight.recommendation && (
            <div className="text-xs text-good mt-1 flex items-center gap-1">
              <i className="bi bi-arrow-right"></i>
              {insight.recommendation}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default PipelineHealthCard;
