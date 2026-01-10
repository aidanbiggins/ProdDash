// Source Effectiveness Tab Component
// Analyzes recruiting channel performance (Referral vs Inbound vs Sourced etc)

import React from 'react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell,
    PieChart,
    Pie,
    Legend
} from 'recharts';
import { SourceEffectivenessMetrics } from '../../types';

interface SourceEffectivenessTabProps {
    data: SourceEffectivenessMetrics;
}

// Color palette for sources
const SOURCE_COLORS: Record<string, string> = {
    Referral: '#059669',   // Emerald - best source typically
    Sourced: '#0f766e',    // Teal - proactive sourcing
    Inbound: '#6366f1',    // Indigo - applicants
    Internal: '#8b5cf6',   // Violet - internal mobility
    Agency: '#d97706',     // Amber - expensive
    Other: '#64748b'       // Slate
};

function getSourceColor(source: string): string {
    return SOURCE_COLORS[source] || '#64748b';
}

export function SourceEffectivenessTab({ data }: SourceEffectivenessTabProps) {
    // Prepare chart data
    const hireRateData = data.bySource
        .filter(s => s.totalCandidates >= 3)
        .map(s => ({
            source: s.source,
            hireRate: s.hireRate !== null ? Math.round(s.hireRate * 100) : 0,
            total: s.totalCandidates,
            hires: s.hires
        }));

    const distributionData = data.sourceDistribution
        .filter(s => s.percentage >= 1)
        .map(s => ({
            name: s.source,
            value: Math.round(s.percentage * 10) / 10,
            fill: getSourceColor(s.source)
        }));

    return (
        <div>
            {/* Summary Cards */}
            <div className="row g-4 mb-4">
                {data.bestSource && (
                    <div className="col-md-4">
                        <div className="card-bespoke h-100">
                            <div className="card-body text-center py-4">
                                <div className="stat-label mb-2">Best Performing Source</div>
                                <div className="stat-value" style={{ color: getSourceColor(data.bestSource.name) }}>
                                    {data.bestSource.name}
                                </div>
                                <div className="mt-2">
                                    <span className="badge-bespoke badge-success-soft">
                                        {Math.round(data.bestSource.hireRate * 100)}% hire rate
                                    </span>
                                </div>
                                <small className="text-muted d-block mt-1">
                                    {data.bySource.find(s => s.source === data.bestSource!.name)?.hires || 0} hires from {data.bySource.find(s => s.source === data.bestSource!.name)?.totalCandidates || 0} candidates
                                </small>
                            </div>
                        </div>
                    </div>
                )}

                <div className="col-md-4">
                    <div className="card-bespoke h-100">
                        <div className="card-body text-center py-4">
                            <div className="stat-label mb-2">Total Candidates</div>
                            <div className="stat-value" style={{ color: 'var(--color-accent)' }}>
                                {data.totalCandidates.toLocaleString()}
                            </div>
                            <small className="text-muted">in selected period</small>
                        </div>
                    </div>
                </div>

                {data.worstSource && (
                    <div className="col-md-4">
                        <div className="card-bespoke h-100">
                            <div className="card-body text-center py-4">
                                <div className="stat-label mb-2">Lowest Hire Rate</div>
                                <div className="stat-value" style={{ color: getSourceColor(data.worstSource.name) }}>
                                    {data.worstSource.name}
                                </div>
                                <div className="mt-2">
                                    <span className="badge-bespoke badge-warning-soft">
                                        {Math.round(data.worstSource.hireRate * 100)}% hire rate
                                    </span>
                                </div>
                                <small className="text-muted d-block mt-1">
                                    {data.bySource.find(s => s.source === data.worstSource!.name)?.hires || 0} hires from {data.bySource.find(s => s.source === data.worstSource!.name)?.totalCandidates || 0} candidates
                                </small>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Charts Row */}
            <div className="row g-4 mb-4">
                {/* Hire Rate Comparison */}
                <div className="col-md-7">
                    <div className="card-bespoke h-100">
                        <div className="card-header">
                            <h6>Hire Rate by Source</h6>
                        </div>
                        <div className="card-body">
                            <ResponsiveContainer width="100%" height={280}>
                                <BarChart data={hireRateData} layout="vertical">
                                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                    <XAxis type="number" domain={[0, 'auto']} unit="%" stroke="#64748b" fontSize={12} />
                                    <YAxis type="category" dataKey="source" width={80} stroke="#64748b" fontSize={12} />
                                    <Tooltip
                                        content={({ active, payload }) => {
                                            if (active && payload && payload.length) {
                                                const data = payload[0].payload;
                                                return (
                                                    <div style={{ background: 'white', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '6px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
                                                        <div style={{ fontWeight: 600, marginBottom: 4 }}>{data.source}</div>
                                                        <div style={{ color: getSourceColor(data.source) }}>{data.hireRate}% hire rate</div>
                                                        <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{data.hires} hires / {data.total} candidates</div>
                                                    </div>
                                                );
                                            }
                                            return null;
                                        }}
                                    />
                                    <Bar dataKey="hireRate" radius={[0, 4, 4, 0]}>
                                        {hireRateData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={getSourceColor(entry.source)} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                {/* Source Distribution */}
                <div className="col-md-5">
                    <div className="card-bespoke h-100">
                        <div className="card-header">
                            <h6>Candidate Distribution</h6>
                        </div>
                        <div className="card-body">
                            <ResponsiveContainer width="100%" height={320}>
                                <PieChart>
                                    <Pie
                                        data={distributionData}
                                        dataKey="value"
                                        nameKey="name"
                                        cx="50%"
                                        cy="50%"
                                        outerRadius={70}
                                        innerRadius={45}
                                        paddingAngle={2}
                                        labelLine={false}
                                        label={(props) => {
                                            const { cx, cy, midAngle, innerRadius, outerRadius, value, name } = props;
                                            const RADIAN = Math.PI / 180;
                                            // Safeguards for TS lint errors
                                            const safeMidAngle = midAngle ?? 0;
                                            const safeName = name ?? '';

                                            const sin = Math.sin(-safeMidAngle * RADIAN);
                                            const cos = Math.cos(-safeMidAngle * RADIAN);
                                            const sx = cx + (outerRadius + 5) * cos;
                                            const sy = cy + (outerRadius + 5) * sin;
                                            const mx = cx + (outerRadius + 20) * cos;
                                            const my = cy + (outerRadius + 20) * sin;
                                            const ex = mx + (cos >= 0 ? 1 : -1) * 15;
                                            const ey = my;
                                            const textAnchor = cos >= 0 ? 'start' : 'end';

                                            return (
                                                <g>
                                                    <path d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`} stroke={getSourceColor(safeName)} fill="none" />
                                                    <circle cx={sx} cy={sy} r={2} fill={getSourceColor(safeName)} stroke="none" />
                                                    <text x={ex + (cos >= 0 ? 1 : -1) * 8} y={ey} textAnchor={textAnchor} fill="#333" fontSize={11} fontWeight={500} dy={4}>{safeName}</text>
                                                    <text x={ex + (cos >= 0 ? 1 : -1) * 8} y={ey} dy={16} textAnchor={textAnchor} fill="#64748b" fontSize={10}>{`${value}%`}</text>
                                                </g>
                                            );
                                        }}
                                    >
                                        {distributionData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.fill} />
                                        ))}
                                    </Pie>
                                    <Tooltip formatter={(value) => [`${value ?? 0}%`, 'Share']} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            </div>

            {/* Funnel Comparison by Source */}
            <div className="card-bespoke mb-4">
                <div className="card-header">
                    <h6>Funnel Pass-Through Rates by Source</h6>
                    <small className="text-muted">See where candidates from each source drop off</small>
                </div>
                <div className="card-body p-0">
                    <div className="table-responsive">
                        <table className="table table-bespoke table-hover mb-0">
                            <thead>
                                <tr>
                                    <th>Source</th>
                                    <th className="text-center">Screen</th>
                                    <th className="text-center">HM Screen</th>
                                    <th className="text-center">Onsite</th>
                                    <th className="text-center">Offer</th>
                                    <th className="text-center">Hired</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.bySource.filter(s => s.funnel && s.funnel.length > 0).map(source => (
                                    <tr key={source.source}>
                                        <td className="fw-medium">
                                            <div className="d-flex align-items-center gap-2">
                                                <span
                                                    className="rounded-circle d-inline-block"
                                                    style={{ width: 8, height: 8, background: getSourceColor(source.source) }}
                                                />
                                                {source.source}
                                            </div>
                                        </td>
                                        {source.funnel.map((stage, idx) => {
                                            const passRate = stage.passRate;
                                            const bgColor = passRate === null ? 'transparent' :
                                                passRate >= 0.7 ? 'rgba(5, 150, 105, 0.15)' :
                                                    passRate >= 0.4 ? 'rgba(217, 119, 6, 0.15)' :
                                                        'rgba(220, 38, 38, 0.15)';
                                            const textColor = passRate === null ? 'var(--color-slate-400)' :
                                                passRate >= 0.7 ? '#059669' :
                                                    passRate >= 0.4 ? '#d97706' :
                                                        '#dc2626';

                                            return (
                                                <td
                                                    key={idx}
                                                    className="text-center"
                                                    style={{
                                                        background: bgColor
                                                    }}
                                                >
                                                    {stage.entered > 0 ? (
                                                        <div>
                                                            <div style={{ fontWeight: 600, color: textColor }}>
                                                                {passRate !== null ? `${Math.round(passRate * 100)}%` : '—'}
                                                            </div>
                                                            <div style={{ fontSize: '0.65rem', color: 'var(--color-slate-500)' }}>
                                                                {stage.passed}/{stage.entered}
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <span style={{ color: 'var(--color-slate-400)' }}>—</span>
                                                    )}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="mt-3 p-2 rounded d-flex gap-4 justify-content-center" style={{ background: 'var(--color-slate-50)', fontSize: '0.75rem' }}>
                        <span><span className="d-inline-block rounded me-1" style={{ width: 12, height: 12, background: 'rgba(5, 150, 105, 0.3)' }}></span> ≥70% pass rate</span>
                        <span><span className="d-inline-block rounded me-1" style={{ width: 12, height: 12, background: 'rgba(217, 119, 6, 0.3)' }}></span> 40-70%</span>
                        <span><span className="d-inline-block rounded me-1" style={{ width: 12, height: 12, background: 'rgba(220, 38, 38, 0.3)' }}></span> &lt;40%</span>
                    </div>
                </div>
            </div>

            {/* Detailed Metrics Table */}
            <div className="card-bespoke">
                <div className="card-header">
                    <h6>Source Performance Details</h6>
                </div>
                <div className="card-body p-0">
                    <div className="table-responsive">
                        <table className="table table-bespoke table-hover mb-0">
                            <thead>
                                <tr>
                                    <th>Source</th>
                                    <th className="text-end">Candidates</th>
                                    <th className="text-end">Hires</th>
                                    <th className="text-end">Hire Rate</th>
                                    <th className="text-end">Offers</th>
                                    <th className="text-end">Accept Rate</th>
                                    <th className="text-end">Median TTH</th>
                                    <th className="text-end">Screen Pass</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.bySource.map(s => (
                                    <tr key={s.source}>
                                        <td className="fw-medium">
                                            <div className="d-flex align-items-center gap-2">
                                                <span
                                                    className="rounded-circle d-inline-block"
                                                    style={{ width: 8, height: 8, background: getSourceColor(s.source) }}
                                                />
                                                {s.source}
                                            </div>
                                        </td>
                                        <td className="text-end">
                                            {s.totalCandidates}
                                        </td>
                                        <td className="text-end">
                                            {s.hires}
                                        </td>
                                        <td className="text-end">
                                            {s.hireRate !== null ? (
                                                <span className={`badge-bespoke ${s.hireRate >= 0.15 ? 'badge-success-soft' : s.hireRate >= 0.05 ? 'badge-neutral-soft' : 'badge-warning-soft'}`}>
                                                    {Math.round(s.hireRate * 100)}%
                                                </span>
                                            ) : (
                                                <span className="text-muted">—</span>
                                            )}
                                        </td>
                                        <td className="text-end">
                                            {s.offers}
                                        </td>
                                        <td className="text-end">
                                            {s.offerAcceptRate !== null ? (
                                                <span className={`badge-bespoke ${s.offerAcceptRate >= 0.8 ? 'badge-success-soft' : s.offerAcceptRate >= 0.6 ? 'badge-neutral-soft' : 'badge-warning-soft'}`}>
                                                    {Math.round(s.offerAcceptRate * 100)}%
                                                </span>
                                            ) : (
                                                <span className="text-muted">—</span>
                                            )}
                                        </td>
                                        <td className="text-end text-muted">
                                            {s.medianTimeToHire !== null ? `${s.medianTimeToHire}d` : '—'}
                                        </td>
                                        <td className="text-end text-muted">
                                            {s.screenPassRate !== null ? `${Math.round(s.screenPassRate * 100)}%` : '—'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Insight Box */}
            <div className="mt-4 p-3 rounded" style={{ background: 'var(--color-slate-50)', border: '1px solid var(--color-slate-200)' }}>
                <div className="d-flex gap-2">
                    <span>💡</span>
                    <div className="small" style={{ color: 'var(--color-slate-600)' }}>
                        <strong>Key Insight:</strong> Compare hire rates and time-to-hire across sources.
                        High-volume sources with low hire rates may be costing recruiter time.
                        Consider investing more in sources with higher conversion rates.
                    </div>
                </div>
            </div>
        </div>
    );
}
