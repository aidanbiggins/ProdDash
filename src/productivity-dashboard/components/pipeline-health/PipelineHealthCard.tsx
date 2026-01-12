// Pipeline Health Summary Card Component
// Shows ideal vs actual pipeline performance with insights

import React, { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, Cell
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
  ahead: '#22c55e',      // Green
  'on-track': '#3b82f6', // Blue
  behind: '#f59e0b',     // Amber
  critical: '#dc2626'    // Red
};

const STATUS_BG_COLORS: Record<PerformanceStatus, string> = {
  ahead: 'rgba(34, 197, 94, 0.1)',
  'on-track': 'rgba(59, 130, 246, 0.1)',
  behind: 'rgba(245, 158, 11, 0.1)',
  critical: 'rgba(220, 38, 38, 0.1)'
};

const STATUS_LABELS: Record<PerformanceStatus, string> = {
  ahead: 'Ahead',
  'on-track': 'On Track',
  behind: 'Behind',
  critical: 'Critical'
};

function getStatusBadgeClass(status: PerformanceStatus): string {
  const classes: Record<PerformanceStatus, string> = {
    ahead: 'badge-success-soft',
    'on-track': 'badge-primary-soft',
    behind: 'badge-warning-soft',
    critical: 'badge-danger-soft'
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
      <div className="card-bespoke">
        <div className="card-body text-center py-5">
          <div className="spinner-border spinner-border-sm text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <div className="mt-2 text-muted small">Calculating pipeline health...</div>
        </div>
      </div>
    );
  }

  if (!healthSummary) {
    return (
      <div className="card-bespoke">
        <div className="card-body text-center py-4">
          <i className="bi bi-bar-chart text-muted" style={{ fontSize: '2rem' }}></i>
          <div className="mt-2 text-muted">No pipeline data available</div>
          {onConfigureClick && (
            <button className="btn btn-sm btn-bespoke-secondary mt-3" onClick={onConfigureClick}>
              <i className="bi bi-gear me-1"></i>
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
    <div className="card-bespoke">
      <div className="card-header d-flex justify-content-between align-items-center">
        <div>
          <h6 className="mb-0">
            <i className="bi bi-speedometer2 me-2"></i>
            Pipeline Health
          </h6>
          <small className="text-muted">Ideal vs Actual Performance</small>
        </div>
        <div className="d-flex align-items-center gap-3">
          <div className="text-end">
            <div className={`badge-bespoke ${getStatusBadgeClass(healthSummary.overallStatus)}`}>
              {STATUS_LABELS[healthSummary.overallStatus]}
            </div>
            <div className="small text-muted mt-1">Score: {healthSummary.healthScore}/100</div>
          </div>
          {onConfigureClick && (
            <button
              className="btn btn-sm btn-bespoke-secondary"
              onClick={onConfigureClick}
              title="Configure benchmarks"
            >
              <i className="bi bi-gear me-1"></i>
              Configure
            </button>
          )}
        </div>
      </div>

      <div className="card-body">
        {/* TTF Summary */}
        <div className="row g-3 mb-4">
          <div className="col-md-4">
            <div className="text-center p-3 rounded" style={{ background: STATUS_BG_COLORS[healthSummary.ttfStatus] }}>
              <div className="stat-label text-muted">Target TTF</div>
              <div className="stat-value">{healthSummary.targetTTF}d</div>
            </div>
          </div>
          <div className="col-md-4">
            <div className="text-center p-3 rounded" style={{ background: STATUS_BG_COLORS[healthSummary.ttfStatus] }}>
              <div className="stat-label text-muted">Actual Median TTF</div>
              <div className="stat-value" style={{ color: STATUS_COLORS[healthSummary.ttfStatus] }}>
                {healthSummary.actualMedianTTF.toFixed(0)}d
              </div>
            </div>
          </div>
          <div className="col-md-4">
            <div className="text-center p-3 rounded" style={{ background: STATUS_BG_COLORS[healthSummary.ttfStatus] }}>
              <div className="stat-label text-muted">Variance</div>
              <div className="stat-value" style={{ color: STATUS_COLORS[healthSummary.ttfStatus] }}>
                {healthSummary.ttfVariance > 0 ? '+' : ''}{healthSummary.ttfVariance.toFixed(0)}d
              </div>
            </div>
          </div>
        </div>

        {/* Timeline Comparison Chart */}
        <div className="mb-4">
          <h6 className="small text-muted mb-3">Stage Duration: Target vs Actual</h6>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} layout="vertical" margin={{ left: 80, right: 20, top: 10, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
              <XAxis type="number" fontSize={11} unit="d" stroke="#94A3B8" tick={{ fill: '#94A3B8', fontFamily: "'JetBrains Mono', monospace" }} />
              <YAxis dataKey="name" type="category" fontSize={11} width={75} stroke="#94A3B8" tick={{ fill: '#94A3B8' }} />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.[0]) return null;
                  const d = payload[0].payload as typeof chartData[0];
                  return (
                    <div style={{ background: '#0a0a0a', border: '1px solid #3f3f46', borderRadius: '4px', padding: '8px 12px' }}>
                      <div style={{ fontWeight: 600, color: '#f5f5f5' }}>{d.name}</div>
                      <div style={{ fontSize: '0.85rem', color: '#94A3B8' }}>Target: {d.target}d</div>
                      <div style={{ fontSize: '0.85rem', color: '#94A3B8' }}>Actual: {d.actual.toFixed(1)}d</div>
                      <div style={{ fontSize: '0.85rem', color: STATUS_COLORS[d.status] }}>
                        {d.variance > 0 ? `+${d.variance.toFixed(1)}d behind` : `${Math.abs(d.variance).toFixed(1)}d ahead`}
                      </div>
                    </div>
                  );
                }}
              />
              <Bar dataKey="target" fill="#3f3f46" name="Target" radius={[0, 4, 4, 0]} />
              <Bar dataKey="actual" name="Actual" radius={[0, 4, 4, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.status]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Stage Performance Summary */}
        <div className="mb-4">
          <h6 className="small text-muted mb-3">Stage Performance</h6>
          <div className="row g-2">
            {healthSummary.stagePerformance.map(stage => (
              <div key={stage.stage} className="col-md-3 col-6">
                <StageHealthMini stage={stage} />
              </div>
            ))}
          </div>
        </div>

        {/* Top Insights */}
        {healthSummary.topInsights.length > 0 && (
          <div>
            <h6 className="small text-muted mb-3">
              <i className="bi bi-lightbulb me-1"></i>
              Key Insights
            </h6>
            <div className="list-group list-group-flush">
              {healthSummary.topInsights.slice(0, 3).map((insight, i) => (
                <InsightItem key={i} insight={insight} />
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="card-footer text-muted small">
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
  return (
    <div className="card-bespoke h-100">
      <div className="card-body">
        <div className="d-flex justify-content-between align-items-start mb-3">
          <div>
            <div className="stat-label text-muted">Pipeline Health</div>
            <div className="d-flex align-items-center gap-2 mt-1">
              <span className="stat-value">{healthSummary.healthScore}</span>
              <span className={`badge-bespoke ${getStatusBadgeClass(healthSummary.overallStatus)}`}>
                {STATUS_LABELS[healthSummary.overallStatus]}
              </span>
            </div>
          </div>
          {onConfigureClick && (
            <button
              className="btn btn-sm btn-link text-muted p-0"
              onClick={onConfigureClick}
              title="Configure"
            >
              <i className="bi bi-gear"></i>
            </button>
          )}
        </div>

        {/* Mini TTF comparison */}
        <div className="d-flex justify-content-between small mb-3">
          <span className="text-muted">TTF:</span>
          <span>
            <span style={{ color: STATUS_COLORS[healthSummary.ttfStatus] }}>
              {healthSummary.actualMedianTTF.toFixed(0)}d
            </span>
            <span className="text-muted"> / {healthSummary.targetTTF}d target</span>
          </span>
        </div>

        {/* Stage status dots */}
        <div className="d-flex gap-2 mb-3">
          {healthSummary.stagePerformance.map(stage => (
            <div
              key={stage.stage}
              className="flex-grow-1 text-center"
              title={`${stage.stageName}: ${stage.actualMedianDays.toFixed(0)}d (target: ${stage.targetDays}d)`}
            >
              <div
                className="rounded-circle mx-auto mb-1"
                style={{
                  width: 12,
                  height: 12,
                  backgroundColor: STATUS_COLORS[stage.durationStatus]
                }}
              />
              <div className="small text-muted" style={{ fontSize: '0.65rem' }}>
                {stage.stageName.split(' ')[0]}
              </div>
            </div>
          ))}
        </div>

        {/* Top insight */}
        {healthSummary.topInsights[0] && (
          <div className="alert alert-light small mb-0 py-2 px-3" style={{ fontSize: '0.75rem' }}>
            <i className={`bi ${healthSummary.topInsights[0].severity === 'critical' ? 'bi-exclamation-triangle text-danger' : 'bi-info-circle text-primary'} me-1`}></i>
            {healthSummary.topInsights[0].message}
          </div>
        )}
      </div>
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
    <div
      className="p-2 rounded text-center"
      style={{ background: STATUS_BG_COLORS[worstStatus], border: `1px solid ${STATUS_COLORS[worstStatus]}20` }}
    >
      <div className="fw-medium small">{stage.stageName}</div>
      <div className="d-flex justify-content-between mt-1" style={{ fontSize: '0.7rem' }}>
        <span title="Duration">
          <i className="bi bi-clock me-1"></i>
          <span style={{ color: STATUS_COLORS[stage.durationStatus] }}>
            {stage.actualMedianDays.toFixed(0)}d
          </span>
        </span>
        <span title="Pass Rate">
          <i className="bi bi-funnel me-1"></i>
          <span style={{ color: STATUS_COLORS[stage.passRateStatus] }}>
            {(stage.actualPassRate * 100).toFixed(0)}%
          </span>
        </span>
      </div>
    </div>
  );
}

// Insight item
function InsightItem({ insight }: { insight: PipelineInsight }) {
  const severityIcon = {
    critical: 'bi-exclamation-triangle-fill text-danger',
    warning: 'bi-exclamation-circle-fill text-warning',
    info: 'bi-info-circle-fill text-primary'
  }[insight.severity];

  return (
    <div className="list-group-item px-0 py-2 border-0">
      <div className="d-flex align-items-start gap-2">
        <i className={`bi ${severityIcon} mt-1`}></i>
        <div className="flex-grow-1">
          <div className="small fw-medium">{insight.message}</div>
          <div className="small text-muted">{insight.dataPoint}</div>
          {insight.recommendation && (
            <div className="small text-success mt-1">
              <i className="bi bi-arrow-right me-1"></i>
              {insight.recommendation}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default PipelineHealthCard;
