// Velocity Insights Tab Component
// Analyzes factors that contribute to fast, successful hires

import React, { useState, useMemo } from 'react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell
} from 'recharts';
import { VelocityMetrics, DecayDataPoint, VelocityInsight, CohortComparison, SuccessFactorComparison, Requisition, Candidate, Event, User, HiringManagerFriction, MetricFilters } from '../../types';
import { DashboardConfig } from '../../types/config';
import { PipelineBenchmarkConfig, HistoricalBenchmarkResult } from '../../types/pipelineTypes';
import { useIsMobile } from '../../hooks/useIsMobile';
import { PipelineHealthCard, BenchmarkConfigModal } from '../pipeline-health';
import { calculatePipelineHealth, generateHistoricalBenchmarks } from '../../services';

interface VelocityInsightsTabProps {
  metrics: VelocityMetrics;
  // Additional props for pipeline health
  requisitions?: Requisition[];
  candidates?: Candidate[];
  events?: Event[];
  users?: User[];
  hmFriction?: HiringManagerFriction[];
  config?: DashboardConfig;
  filters?: MetricFilters;
  onUpdateConfig?: (config: DashboardConfig) => void;
}

// Color scale for decay visualization - Modern Tailwind
function getDecayColor(rate: number): string {
  if (rate >= 0.8) return '#10B981'; // Emerald-500
  if (rate >= 0.6) return '#22C55E'; // Green-500
  if (rate >= 0.4) return '#F59E0B'; // Amber-500
  if (rate >= 0.2) return '#F97316'; // Orange-500
  return '#EF4444'; // Red-500
}

// Insight card component - Clean, minimal design
function InsightCard({ insight }: { insight: VelocityInsight }) {
  // Use subtle, unified styling - no rainbow colors
  const iconMap = {
    warning: '!',
    success: '✓',
    info: 'i'
  };
  const icon = iconMap[insight.type] || 'i';

  // Dark mode icon backgrounds
  const iconBg = insight.type === 'warning' ? 'rgba(245, 158, 11, 0.15)' :
    insight.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(96, 165, 250, 0.15)';
  const iconColor = insight.type === 'warning' ? '#f59e0b' :
    insight.type === 'success' ? '#10b981' : '#60a5fa';

  return (
    <div
      className="p-3 mb-3"
      style={{
        background: '#141414',
        borderLeft: '3px solid #3f3f46',
        borderRadius: '2px'
      }}
    >
      <div className="d-flex align-items-start gap-3">
        <span
          style={{
            width: 24,
            height: 24,
            borderRadius: '2px',
            background: iconBg,
            color: iconColor,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.75rem',
            fontWeight: 700,
            flexShrink: 0
          }}
        >
          {icon}
        </span>
        <div className="flex-grow-1">
          <div className="fw-semibold mb-1" style={{ color: '#f5f5f5', fontSize: '0.875rem' }}>
            {insight.title}
          </div>
          <div className="mb-2" style={{ color: '#94A3B8', fontSize: '0.8rem', lineHeight: 1.4 }}>
            {insight.description}
          </div>
          <div className="d-flex align-items-center gap-2 flex-wrap">
            {insight.metric && (
              <span
                style={{
                  background: '#27272a',
                  color: '#94A3B8',
                  padding: '2px 8px',
                  fontSize: '0.65rem',
                  fontWeight: 600,
                  fontFamily: "'JetBrains Mono', monospace",
                  letterSpacing: '0.02em',
                  borderRadius: '2px'
                }}
              >
                {insight.metric}
              </span>
            )}
            {insight.action && (
              <span style={{ color: '#94A3B8', fontSize: '0.75rem' }}>
                → {insight.action}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function VelocityInsightsTab({
  metrics,
  requisitions,
  candidates,
  events,
  users,
  hmFriction,
  config,
  filters,
  onUpdateConfig
}: VelocityInsightsTabProps) {
  const isMobile = useIsMobile();
  const chartHeight = isMobile ? 250 : 320;

  const { candidateDecay, reqDecay, insights } = metrics;

  // Pipeline Health state
  const [showBenchmarkConfig, setShowBenchmarkConfig] = useState(false);
  const [historicalBenchmarks, setHistoricalBenchmarks] = useState<HistoricalBenchmarkResult | null>(null);
  const [isLoadingHistorical, setIsLoadingHistorical] = useState(false);

  // Calculate pipeline health if we have the required data
  const pipelineHealth = useMemo(() => {
    if (!requisitions?.length || !candidates?.length || !events || !users || !hmFriction || !config || !filters) {
      return null;
    }
    return calculatePipelineHealth(requisitions, candidates, events, users, hmFriction, config, filters);
  }, [requisitions, candidates, events, users, hmFriction, config, filters]);

  // Load historical benchmarks
  const handleLoadHistorical = () => {
    if (!requisitions || !candidates || !events || !config) return;
    setIsLoadingHistorical(true);
    setTimeout(() => {
      const result = generateHistoricalBenchmarks(requisitions, candidates, events, config);
      setHistoricalBenchmarks(result);
      setIsLoadingHistorical(false);
    }, 100);
  };

  // Save benchmark config
  const handleSaveBenchmarks = (newConfig: PipelineBenchmarkConfig) => {
    if (config && onUpdateConfig) {
      onUpdateConfig({
        ...config,
        pipelineBenchmarks: newConfig
      });
    }
  };

  // Format candidate decay data for chart
  const candidateChartData = candidateDecay.dataPoints
    .filter(dp => dp.count > 0)
    .map(dp => ({
      name: dp.bucket,
      rate: Math.round(dp.rate * 100),
      count: dp.count,
      minDays: dp.minDays
    }));

  // Format req decay data for chart
  const reqChartData = reqDecay.dataPoints
    .filter(dp => dp.count > 0)
    .map(dp => ({
      name: dp.bucket,
      rate: Math.round(dp.rate * 100),
      count: dp.count,
      minDays: dp.minDays
    }));

  return (
    <div>
      {/* Header Stats */}
      <div className="row g-3 mb-4">
        <div className="col-6 col-md-3">
          <div className="card-bespoke h-100">
            <div className="card-body text-center py-3">
              <div className="stat-label mb-1">Median Time to Fill</div>
              <div className="stat-value" style={{ color: 'var(--color-accent)' }}>
                {reqDecay.medianDaysToFill !== null ? `${reqDecay.medianDaysToFill}d` : '—'}
              </div>
              <div className="small text-muted">for closed reqs</div>
            </div>
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="card-bespoke h-100">
            <div className="card-body text-center py-3">
              <div className="stat-label mb-1">Offer Accept Rate</div>
              <div className="stat-value" style={{ color: '#059669' }}>
                {Math.round(candidateDecay.overallAcceptanceRate * 100)}%
              </div>
              <div className="small text-muted">{candidateDecay.totalAccepted} of {candidateDecay.totalOffers}</div>
            </div>
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="card-bespoke h-100">
            <div className="card-body text-center py-3">
              <div className="stat-label mb-1">Overall Fill Rate</div>
              <div className="stat-value" style={{ color: '#6366f1' }}>
                {Math.round(reqDecay.overallFillRate * 100)}%
              </div>
              <div className="small text-muted">{reqDecay.totalFilled} of {reqDecay.totalReqs} reqs</div>
            </div>
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="card-bespoke h-100">
            <div className="card-body text-center py-3">
              <div className="stat-label mb-1">Decay Start</div>
              <div className="stat-value" style={{ color: '#eab308' }}>
                {candidateDecay.decayStartDay !== null ? `Day ${candidateDecay.decayStartDay}` : '—'}
              </div>
              <div className="small text-muted">when acceptance drops</div>
            </div>
          </div>
        </div>
      </div>

      {/* Pipeline Health Section - Full Detail */}
      {(pipelineHealth || config) && (
        <div className="mb-4">
          <PipelineHealthCard
            healthSummary={pipelineHealth}
            compact={false}
            onConfigureClick={() => setShowBenchmarkConfig(true)}
          />
        </div>
      )}

      {/* Benchmark Config Modal */}
      {config && (
        <BenchmarkConfigModal
          isOpen={showBenchmarkConfig}
          onClose={() => setShowBenchmarkConfig(false)}
          currentConfig={config.pipelineBenchmarks}
          historicalBenchmarks={historicalBenchmarks}
          onSave={handleSaveBenchmarks}
          onLoadHistorical={handleLoadHistorical}
          isLoadingHistorical={isLoadingHistorical}
        />
      )}

      {/* Decay Curves */}
      <div className="row g-4 mb-4">
        {/* Candidate Decay Curve */}
        <div className="col-12 col-lg-6">
          <div className="card-bespoke h-100">
            <div className="card-header">
              <div className="d-flex align-items-center gap-2">
                <span style={{ fontSize: '1.25rem' }}>📉</span>
                <div>
                  <h6 className="mb-0">Candidate Decay Curve</h6>
                  <small style={{ color: '#94A3B8' }}>Offer acceptance rate by time in process</small>
                </div>
              </div>
            </div>
            <div className="card-body">
              {candidateChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={chartHeight}>
                  <BarChart data={candidateChartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 11, fill: '#94A3B8', fontFamily: "'JetBrains Mono', monospace" }}
                      stroke="#94A3B8"
                      angle={-20}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis
                      domain={[0, 100]}
                      tick={{ fontSize: 11, fill: '#94A3B8', fontFamily: "'JetBrains Mono', monospace" }}
                      stroke="#94A3B8"
                      tickFormatter={(v) => `${v}%`}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload || !payload[0]) return null;
                        const d = payload[0].payload;
                        return (
                          <div style={{ background: '#0a0a0a', border: '1px solid #3f3f46', borderRadius: '4px', padding: '8px 12px' }}>
                            <div style={{ fontWeight: 600, color: '#f5f5f5' }}>{d.name}</div>
                            <div style={{ color: getDecayColor(d.rate / 100) }}>
                              {d.rate}% acceptance rate
                            </div>
                            <div style={{ fontSize: '0.85rem', color: '#94A3B8' }}>{d.count} offers</div>
                          </div>
                        );
                      }}
                    />
                    {candidateDecay.decayStartDay && (
                      <ReferenceLine
                        x={candidateChartData.find(d => d.minDays >= candidateDecay.decayStartDay!)?.name}
                        stroke="#dc2626"
                        strokeDasharray="5 5"
                        label={{ value: 'Decay starts', position: 'top', fontSize: 10, fill: '#dc2626' }}
                      />
                    )}
                    <Bar dataKey="rate" radius={[4, 4, 0, 0]}>
                      {candidateChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={getDecayColor(entry.rate / 100)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center text-muted py-5">
                  <div className="mb-2">📊</div>
                  <div>Not enough offer data to show decay curve</div>
                  <small>Need candidates with offers extended</small>
                </div>
              )}
              <div className="mt-3 p-2 rounded" style={{ background: '#141414', fontSize: '0.8rem', color: '#94A3B8' }}>
                <strong style={{ color: '#94A3B8' }}>Reading this chart:</strong> Each bar shows the offer acceptance rate for candidates
                who received offers after that many days in process. Declining bars indicate candidate
                interest decay — they're getting other offers or losing enthusiasm.
              </div>
            </div>
          </div>
        </div>

        {/* Req Decay Curve */}
        <div className="col-12 col-lg-6">
          <div className="card-bespoke h-100">
            <div className="card-header">
              <div className="d-flex align-items-center gap-2">
                <span style={{ fontSize: '1.25rem' }}>📊</span>
                <div>
                  <h6 className="mb-0">Requisition Decay Curve</h6>
                  <small style={{ color: '#94A3B8' }}>Fill probability by days open</small>
                </div>
              </div>
            </div>
            <div className="card-body">
              {reqChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={chartHeight}>
                  <AreaChart data={reqChartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                    <defs>
                      <linearGradient id="fillGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2dd4bf" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#2dd4bf" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 11, fill: '#94A3B8', fontFamily: "'JetBrains Mono', monospace" }}
                      stroke="#94A3B8"
                      angle={-20}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis
                      domain={[0, 100]}
                      tick={{ fontSize: 11, fill: '#94A3B8', fontFamily: "'JetBrains Mono', monospace" }}
                      stroke="#94A3B8"
                      tickFormatter={(v) => `${v}%`}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload || !payload[0]) return null;
                        const d = payload[0].payload;
                        return (
                          <div style={{ background: '#0a0a0a', border: '1px solid #3f3f46', borderRadius: '4px', padding: '8px 12px' }}>
                            <div style={{ fontWeight: 600, color: '#f5f5f5' }}>{d.name}</div>
                            <div style={{ color: '#2dd4bf' }}>
                              {d.rate}% fill rate
                            </div>
                            <div style={{ fontSize: '0.85rem', color: '#94A3B8' }}>{d.count} reqs in this window</div>
                          </div>
                        );
                      }}
                    />
                    <ReferenceLine
                      y={Math.round(reqDecay.overallFillRate * 100)}
                      stroke="#94a3b8"
                      strokeDasharray="3 3"
                      label={{ value: `Avg: ${Math.round(reqDecay.overallFillRate * 100)}%`, position: 'right', fontSize: 10, fill: '#94a3b8' }}
                    />
                    <Area
                      type="monotone"
                      dataKey="rate"
                      stroke="#2dd4bf"
                      strokeWidth={2}
                      fill="url(#fillGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center text-muted py-5">
                  <div className="mb-2">📊</div>
                  <div>Not enough requisition data</div>
                  <small>Need closed reqs to analyze fill rates</small>
                </div>
              )}
              <div className="mt-3 p-2 rounded" style={{ background: '#141414', fontSize: '0.8rem', color: '#94A3B8' }}>
                <strong style={{ color: '#94A3B8' }}>Reading this chart:</strong> Shows the fill rate for reqs that took X days to close.
                A declining curve indicates that longer-open reqs are less likely to fill — they may have
                unrealistic requirements, poor HM engagement, or market misalignment.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Success Factors Cohort Comparison */}
      {metrics.cohortComparison && (
        <div className="card-bespoke mb-4">
          <div className="card-header">
            <div className="d-flex align-items-center gap-2">
              <span style={{ fontSize: '1.25rem' }}>🏆</span>
              <div>
                <h6 className="mb-0">Success Factors: Fast vs Slow Hires</h6>
                <small className="text-muted">
                  Comparing fastest 25% ({metrics.cohortComparison.fastHires.count} hires) vs slowest 25% ({metrics.cohortComparison.slowHires.count} hires)
                </small>
              </div>
            </div>
          </div>
          <div className="card-body p-0">
            <div className="table-responsive">
              <table className="table table-bespoke mb-0">
                <thead>
                  <tr style={{ background: 'var(--color-slate-50)' }}>
                    <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Factor</th>
                    <th className="text-center" style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#059669' }}>
                      Fast Hires
                      <div className="small fw-normal text-muted">
                        ({Math.round(metrics.cohortComparison.fastHires.avgTimeToFill)}d avg)
                      </div>
                    </th>
                    <th className="text-center" style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#dc2626' }}>
                      Slow Hires
                      <div className="small fw-normal text-muted">
                        ({Math.round(metrics.cohortComparison.slowHires.avgTimeToFill)}d avg)
                      </div>
                    </th>
                    <th className="text-center" style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Delta</th>
                    <th className="text-center" style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Impact</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.cohortComparison.factors.map((factor, idx) => (
                    <tr key={idx}>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <span className="fw-medium">{factor.factor}</span>
                      </td>
                      <td className="text-center" style={{ padding: '0.75rem 1rem', color: '#059669', fontWeight: 500 }}>
                        {factor.fastHiresValue} {factor.unit}
                      </td>
                      <td className="text-center" style={{ padding: '0.75rem 1rem', color: '#dc2626', fontWeight: 500 }}>
                        {factor.slowHiresValue} {factor.unit}
                      </td>
                      <td className="text-center" style={{ padding: '0.75rem 1rem' }}>
                        <span className={`badge ${factor.factor === 'Avg Time to Fill' ? 'bg-secondary' :
                          factor.impactLevel === 'high' ? 'bg-danger' :
                            factor.impactLevel === 'medium' ? 'bg-warning' : 'bg-secondary'
                          }`} style={{ fontWeight: 500 }}>
                          {factor.delta} {factor.unit !== '%' && factor.unit !== 'days' ? '' : ''}
                        </span>
                      </td>
                      <td className="text-center" style={{ padding: '0.75rem 1rem' }}>
                        {factor.factor !== 'Avg Time to Fill' && (
                          <span className={`badge-bespoke ${factor.impactLevel === 'high' ? 'badge-danger-soft' :
                            factor.impactLevel === 'medium' ? 'badge-warning-soft' : 'badge-neutral-soft'
                            }`}>
                            {factor.impactLevel}
                          </span>
                        )}
                        {factor.factor === 'Avg Time to Fill' && (
                          <span className="text-muted small">outcome</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-3" style={{ background: '#141414', borderTop: '1px solid #27272a' }}>
              <div className="row g-3 text-center">
                <div className="col-4">
                  <div style={{ fontSize: '0.65rem', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: '4px' }}>Fast Hires Referral %</div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, fontSize: '1rem', color: '#10B981' }}>
                    {Math.round(metrics.cohortComparison.fastHires.referralPercent)}%
                  </div>
                </div>
                <div className="col-4">
                  <div style={{ fontSize: '0.65rem', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: '4px' }}>All Hires Avg TTF</div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, fontSize: '1rem', color: '#60a5fa' }}>
                    {Math.round(metrics.cohortComparison.allHires.avgTimeToFill)}d
                  </div>
                </div>
                <div className="col-4">
                  <div style={{ fontSize: '0.65rem', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: '4px' }}>Slow Hires Referral %</div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, fontSize: '1rem', color: '#EF4444' }}>
                    {Math.round(metrics.cohortComparison.slowHires.referralPercent)}%
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Insights Section */}
      {insights.length > 0 && (
        <div className="card-bespoke mb-4">
          <div className="card-header">
            <div className="d-flex align-items-center gap-2">
              <span style={{
                width: 24,
                height: 24,
                background: 'rgba(245, 158, 11, 0.15)',
                borderRadius: '2px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.75rem'
              }}>💡</span>
              <h6 className="mb-0" style={{ fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94A3B8' }}>Key Insights</h6>
            </div>
          </div>
          <div className="card-body">
            {insights.map((insight, idx) => (
              <InsightCard key={idx} insight={insight} />
            ))}
          </div>
        </div>
      )}

      {/* Strategic Implications */}
      <div className="card-bespoke">
        <div className="card-header">
          <div className="d-flex align-items-center gap-2">
            <span style={{
              width: 24,
              height: 24,
              background: 'rgba(212, 163, 115, 0.15)',
              borderRadius: '2px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.75rem'
            }}>🎯</span>
            <h6 className="mb-0" style={{ fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94A3B8' }}>Strategic Implications</h6>
          </div>
        </div>
        <div className="card-body">
          <div className="row g-3">
            <div className="col-md-4">
              <div className="p-3 h-100" style={{ background: '#141414', borderRadius: '2px', borderTop: '2px solid #10B981' }}>
                <h6 style={{ color: '#f5f5f5', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.5rem' }}>Speed = Competitive Advantage</h6>
                <p style={{ color: '#94A3B8', fontSize: '0.75rem', lineHeight: 1.5, marginBottom: 0 }}>
                  Every day in process reduces your odds. Top candidates have options.
                  Compress timelines ruthlessly — aim for offers within {candidateDecay.decayStartDay || 21} days.
                </p>
              </div>
            </div>
            <div className="col-md-4">
              <div className="p-3 h-100" style={{ background: '#141414', borderRadius: '2px', borderTop: '2px solid #F59E0B' }}>
                <h6 style={{ color: '#f5f5f5', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.5rem' }}>Stale Reqs Need Intervention</h6>
                <p style={{ color: '#94A3B8', fontSize: '0.75rem', lineHeight: 1.5, marginBottom: 0 }}>
                  Reqs open beyond {reqDecay.decayStartDay || 60} days rarely close without changes.
                  Reassess requirements, HM alignment, or comp band. Don't let them linger.
                </p>
              </div>
            </div>
            <div className="col-md-4">
              <div className="p-3 h-100" style={{ background: '#141414', borderRadius: '2px', borderTop: '2px solid #2dd4bf' }}>
                <h6 style={{ color: '#f5f5f5', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.5rem' }}>Pipeline Momentum Matters</h6>
                <p style={{ color: '#94A3B8', fontSize: '0.75rem', lineHeight: 1.5, marginBottom: 0 }}>
                  The decay curves show urgency is real. Prioritize candidates furthest along,
                  push HMs for faster feedback, and keep multiple candidates moving in parallel.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
