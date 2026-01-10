// Velocity Insights Tab Component
// Analyzes factors that contribute to fast, successful hires

import React from 'react';
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
import { VelocityMetrics, DecayDataPoint, VelocityInsight, CohortComparison, SuccessFactorComparison } from '../../types';
import { useIsMobile } from '../../hooks/useIsMobile';

interface VelocityInsightsTabProps {
  metrics: VelocityMetrics;
}

// Color scale for decay visualization (green to red)
function getDecayColor(rate: number): string {
  if (rate >= 0.8) return '#059669'; // green
  if (rate >= 0.6) return '#84cc16'; // lime
  if (rate >= 0.4) return '#eab308'; // yellow
  if (rate >= 0.2) return '#f97316'; // orange
  return '#dc2626'; // red
}

// Insight card component
function InsightCard({ insight }: { insight: VelocityInsight }) {
  const bgColor = insight.type === 'warning' ? 'rgba(234, 179, 8, 0.1)' :
    insight.type === 'success' ? 'rgba(5, 150, 105, 0.1)' :
      'rgba(99, 102, 241, 0.1)';
  const borderColor = insight.type === 'warning' ? '#eab308' :
    insight.type === 'success' ? '#059669' :
      '#6366f1';
  const icon = insight.type === 'warning' ? '⚠️' :
    insight.type === 'success' ? '✓' : 'ℹ️';

  return (
    <div
      className="p-3 rounded-3 mb-3"
      style={{ background: bgColor, borderLeft: `4px solid ${borderColor}` }}
    >
      <div className="d-flex align-items-start gap-2">
        <span style={{ fontSize: '1.1rem' }}>{icon}</span>
        <div className="flex-grow-1">
          <div className="fw-bold mb-1">{insight.title}</div>
          <div className="small text-muted mb-2">{insight.description}</div>
          {insight.metric && (
            <span
              className="badge me-2"
              style={{ background: borderColor, color: 'white' }}
            >
              {insight.metric}
            </span>
          )}
          {insight.action && (
            <span className="small text-muted">
              → {insight.action}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export function VelocityInsightsTab({ metrics }: VelocityInsightsTabProps) {
  const isMobile = useIsMobile();
  const chartHeight = isMobile ? 250 : 320;

  const { candidateDecay, reqDecay, insights } = metrics;

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
                  <small className="text-muted">Offer acceptance rate by time in process</small>
                </div>
              </div>
            </div>
            <div className="card-body">
              {candidateChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={chartHeight}>
                  <BarChart data={candidateChartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 11 }}
                      stroke="#64748b"
                      angle={-20}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis
                      domain={[0, 100]}
                      tick={{ fontSize: 11 }}
                      stroke="#64748b"
                      tickFormatter={(v) => `${v}%`}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload || !payload[0]) return null;
                        const d = payload[0].payload;
                        return (
                          <div className="bg-white border rounded p-2 shadow-sm">
                            <div className="fw-bold">{d.name}</div>
                            <div style={{ color: getDecayColor(d.rate / 100) }}>
                              {d.rate}% acceptance rate
                            </div>
                            <div className="small text-muted">{d.count} offers</div>
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
              <div className="mt-3 p-2 rounded" style={{ background: 'var(--color-slate-50)', fontSize: '0.8rem' }}>
                <strong>Reading this chart:</strong> Each bar shows the offer acceptance rate for candidates
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
                  <small className="text-muted">Fill probability by days open</small>
                </div>
              </div>
            </div>
            <div className="card-body">
              {reqChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={chartHeight}>
                  <AreaChart data={reqChartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                    <defs>
                      <linearGradient id="fillGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 11 }}
                      stroke="#64748b"
                      angle={-20}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis
                      domain={[0, 100]}
                      tick={{ fontSize: 11 }}
                      stroke="#64748b"
                      tickFormatter={(v) => `${v}%`}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload || !payload[0]) return null;
                        const d = payload[0].payload;
                        return (
                          <div className="bg-white border rounded p-2 shadow-sm">
                            <div className="fw-bold">{d.name}</div>
                            <div style={{ color: '#6366f1' }}>
                              {d.rate}% fill rate
                            </div>
                            <div className="small text-muted">{d.count} reqs in this window</div>
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
                      stroke="#6366f1"
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
              <div className="mt-3 p-2 rounded" style={{ background: 'var(--color-slate-50)', fontSize: '0.8rem' }}>
                <strong>Reading this chart:</strong> Shows the fill rate for reqs that took X days to close.
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
                        <span className={`badge ${
                          factor.factor === 'Avg Time to Fill' ? 'bg-secondary' :
                          factor.impactLevel === 'high' ? 'bg-danger' :
                          factor.impactLevel === 'medium' ? 'bg-warning' : 'bg-secondary'
                        }`} style={{ fontWeight: 500 }}>
                          {factor.delta} {factor.unit !== '%' && factor.unit !== 'days' ? '' : ''}
                        </span>
                      </td>
                      <td className="text-center" style={{ padding: '0.75rem 1rem' }}>
                        {factor.factor !== 'Avg Time to Fill' && (
                          <span className={`badge-bespoke ${
                            factor.impactLevel === 'high' ? 'badge-danger-soft' :
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
            <div className="p-3" style={{ background: 'var(--color-slate-50)', borderTop: '1px solid var(--color-slate-200)' }}>
              <div className="row g-3 text-center">
                <div className="col-4">
                  <div className="small text-muted mb-1">Fast Hires Referral %</div>
                  <div className="fw-bold" style={{ color: '#059669' }}>
                    {Math.round(metrics.cohortComparison.fastHires.referralPercent)}%
                  </div>
                </div>
                <div className="col-4">
                  <div className="small text-muted mb-1">All Hires Avg TTF</div>
                  <div className="fw-bold" style={{ color: 'var(--color-accent)' }}>
                    {Math.round(metrics.cohortComparison.allHires.avgTimeToFill)}d
                  </div>
                </div>
                <div className="col-4">
                  <div className="small text-muted mb-1">Slow Hires Referral %</div>
                  <div className="fw-bold" style={{ color: '#dc2626' }}>
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
              <span style={{ fontSize: '1.25rem' }}>💡</span>
              <h6 className="mb-0">Key Insights</h6>
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
            <span style={{ fontSize: '1.25rem' }}>🎯</span>
            <h6 className="mb-0">Strategic Implications</h6>
          </div>
        </div>
        <div className="card-body">
          <div className="row g-4">
            <div className="col-md-4">
              <div className="p-3 rounded-3" style={{ background: 'rgba(5, 150, 105, 0.1)' }}>
                <h6 className="text-success mb-2">Speed = Competitive Advantage</h6>
                <p className="small text-muted mb-0">
                  Every day in process reduces your odds. Top candidates have options.
                  Compress timelines ruthlessly — aim for offers within {candidateDecay.decayStartDay || 21} days.
                </p>
              </div>
            </div>
            <div className="col-md-4">
              <div className="p-3 rounded-3" style={{ background: 'rgba(234, 179, 8, 0.1)' }}>
                <h6 style={{ color: '#b45309' }} className="mb-2">Stale Reqs Need Intervention</h6>
                <p className="small text-muted mb-0">
                  Reqs open beyond {reqDecay.decayStartDay || 60} days rarely close without changes.
                  Reassess requirements, HM alignment, or comp band. Don't let them linger.
                </p>
              </div>
            </div>
            <div className="col-md-4">
              <div className="p-3 rounded-3" style={{ background: 'rgba(99, 102, 241, 0.1)' }}>
                <h6 style={{ color: '#4f46e5' }} className="mb-2">Pipeline Momentum Matters</h6>
                <p className="small text-muted mb-0">
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
