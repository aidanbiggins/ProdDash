// Source Effectiveness Tab Component
// Analyzes recruiting channel performance (Referral vs Inbound vs Sourced etc)

import React, { JSX, useState } from 'react';
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
    Pie
} from 'recharts';
import { SourceEffectivenessMetrics } from '../../../types';
import { StatLabel, StatValue } from '../../common';
import { SubViewHeader } from '../../v2/SubViewHeader';
import { SOURCE_EFFECTIVENESS_PAGE_HELP } from './sourceEffectivenessHelpContent';

interface SourceEffectivenessTabProps {
    data: SourceEffectivenessMetrics;
}

// Color palette for sources - Modern Tailwind
const SOURCE_COLORS: Record<string, string> = {
    Referral: '#10B981',  // Emerald-500
    Sourced: '#3B82F6',   // Blue-500
    Inbound: '#8B5CF6',   // Violet-500
    Internal: '#06B6D4',  // Cyan-500
    Agency: '#F59E0B',    // Amber-500
    Other: '#64748B'      // Slate-500
};

const STATUS_COLORS = {
    danger: '#EF4444',    // Red-500 (softer)
    success: '#10B981',   // Emerald-500
    neutral: '#64748B'    // Slate-500
} as const;

function getSourceColor(source: string): string {
    return SOURCE_COLORS[source] || SOURCE_COLORS.Other;
}

// Reusable component for source color indicator
interface SourceColorDotProps {
    source: string;
    size?: number;
}

function SourceColorDot({ source, size = 8 }: SourceColorDotProps): JSX.Element {
    return (
        <span
            className="rounded-full inline-block"
            style={{ width: size, height: size, background: getSourceColor(source) }}
        />
    );
}

// Efficiency channel data type
interface EfficiencyChannel {
    source: string;
    candidates: number;
    hires: number;
    candidatesPerHire: number | null;
    efficiencyVsAvg: number | null;
    isMirage: boolean;
    isEfficient: boolean;
    hireRate: number | null;
}

// Channel card for mirage/efficient channels
interface ChannelCardProps {
    title: string;
    subtitle: string;
    channels: EfficiencyChannel[];
    variant: 'danger' | 'success';
}

function ChannelCard({ title, subtitle, channels, variant }: ChannelCardProps): JSX.Element {
    const color = variant === 'danger' ? STATUS_COLORS.danger : STATUS_COLORS.success;
    const bgAlpha = variant === 'danger' ? 'rgba(220, 38, 38, 0.05)' : 'rgba(5, 150, 105, 0.05)';

    return (
        <div className="card-bespoke h-full" style={{ borderLeft: `4px solid ${color}` }}>
            <div className="card-header" style={{ background: bgAlpha }}>
                <h6 style={{ color }}>{title}</h6>
                <small style={{ color: '#94A3B8' }}>{subtitle}</small>
            </div>
            <div className="card-body">
                {channels.map(ch => (
                    <div
                        key={ch.source}
                        className="flex justify-between items-center py-2"
                        style={{ borderBottom: '1px solid var(--color-slate-100)' }}
                    >
                        <div className="flex items-center gap-2">
                            <SourceColorDot source={ch.source} size={10} />
                            <span className="font-medium">{ch.source}</span>
                        </div>
                        <div className="text-right">
                            <ChannelMetric channel={ch} variant={variant} />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

interface ChannelMetricProps {
    channel: EfficiencyChannel;
    variant: 'danger' | 'success';
}

function ChannelMetric({ channel, variant }: ChannelMetricProps): JSX.Element {
    const color = variant === 'danger' ? STATUS_COLORS.danger : STATUS_COLORS.success;

    if (variant === 'danger' && channel.hires === 0) {
        return (
            <div>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-500/20 text-red-300">0 hires</span>
                <div className="text-muted-foreground" style={{ fontSize: '0.75rem' }}>
                    {channel.candidates} candidates processed
                </div>
            </div>
        );
    }

    const comparisonText = variant === 'danger'
        ? `${Math.round(channel.efficiencyVsAvg || 0)}% worse than avg`
        : `${Math.abs(Math.round(channel.efficiencyVsAvg || 0))}% better than avg`;

    return (
        <div>
            <span style={{ color, fontWeight: 600 }}>
                {channel.candidatesPerHire?.toFixed(1)} candidates/hire
            </span>
            <div className="text-muted-foreground" style={{ fontSize: '0.75rem' }}>
                {comparisonText}
            </div>
        </div>
    );
}

// Status badge helper
function getStatusBadge(item: EfficiencyChannel): JSX.Element {
    if (item.isMirage) {
        return (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium" style={{ background: 'rgba(220, 38, 38, 0.1)', color: STATUS_COLORS.danger }}>
                Mirage
            </span>
        );
    }
    if (item.isEfficient) {
        return (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium" style={{ background: 'rgba(5, 150, 105, 0.1)', color: STATUS_COLORS.success }}>
                Efficient
            </span>
        );
    }
    const label = item.hires === 0 ? 'No Hires' : 'Average';
    return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium" style={{ background: 'rgba(100, 116, 139, 0.1)', color: STATUS_COLORS.neutral }}>
            {label}
        </span>
    );
}

// Pass rate styling helper
interface PassRateStyle {
    bgColor: string;
    textColor: string;
}

function getPassRateStyle(passRate: number | null): PassRateStyle {
    if (passRate === null) {
        return { bgColor: 'transparent', textColor: 'var(--color-slate-400)' };
    }
    if (passRate >= 0.7) {
        return { bgColor: 'rgba(5, 150, 105, 0.15)', textColor: STATUS_COLORS.success };
    }
    if (passRate >= 0.4) {
        return { bgColor: 'rgba(217, 119, 6, 0.15)', textColor: '#d97706' };
    }
    return { bgColor: 'rgba(220, 38, 38, 0.15)', textColor: STATUS_COLORS.danger };
}

// Rate badge with configurable thresholds
interface RateBadgeProps {
    rate: number | null;
    thresholds: { high: number; medium: number };
}

function RateBadge({ rate, thresholds }: RateBadgeProps): JSX.Element {
    if (rate === null) {
        return <span className="text-muted-foreground">—</span>;
    }
    let badgeClass = 'badge-warning-soft';
    if (rate >= thresholds.high) {
        badgeClass = 'badge-success-soft';
    } else if (rate >= thresholds.medium) {
        badgeClass = 'badge-neutral-soft';
    }
    return (
        <span className={`badge-bespoke ${badgeClass}`}>
            {Math.round(rate * 100)}%
        </span>
    );
}

export function SourceEffectivenessTab({ data }: SourceEffectivenessTabProps) {

    // Determine minimum threshold based on total data volume
    // Lower threshold when filtered data is small to show meaningful results
    const minCandidatesForChart = data.totalCandidates < 50 ? 1 : 3;

    // Prepare chart data
    const hireRateData = data.bySource
        .filter(s => s.totalCandidates >= minCandidatesForChart)
        .map(s => ({
            source: s.source,
            hireRate: s.hireRate !== null ? Math.round(s.hireRate * 100) : 0,
            total: s.totalCandidates,
            hires: s.hires
        }));

    const distributionData = data.sourceDistribution
        .filter(s => s.percentage >= 0.5) // Lower threshold to show more sources when filtered
        .map(s => ({
            name: s.source,
            value: Math.round(s.percentage * 10) / 10,
            fill: getSourceColor(s.source)
        }));

    // Calculate source efficiency metrics
    const avgCandidatesPerHire = data.totalHires > 0
        ? data.totalCandidates / data.totalHires
        : 0;

    // Sources with efficiency data (only those with hires can have efficiency)
    const efficiencyData = data.bySource
        .filter(s => s.totalCandidates >= minCandidatesForChart)
        .map(s => {
            const candidatesPerHire = s.hires > 0 ? s.totalCandidates / s.hires : null;
            const efficiencyVsAvg = candidatesPerHire && avgCandidatesPerHire > 0
                ? ((candidatesPerHire - avgCandidatesPerHire) / avgCandidatesPerHire) * 100
                : null;
            // A source is a "mirage" if it takes 50%+ more candidates per hire than average
            // OR if it has significant volume but zero hires
            const isMirage = (efficiencyVsAvg !== null && efficiencyVsAvg > 50) ||
                (s.hires === 0 && s.totalCandidates >= 10);
            // A source is "efficient" if it takes 25%+ fewer candidates per hire than average
            const isEfficient = efficiencyVsAvg !== null && efficiencyVsAvg < -25;

            return {
                source: s.source,
                candidates: s.totalCandidates,
                hires: s.hires,
                candidatesPerHire,
                efficiencyVsAvg,
                isMirage,
                isEfficient,
                hireRate: s.hireRate
            };
        })
        .sort((a, b) => {
            // Sort by candidates per hire (worst first, then sources with no hires)
            if (a.candidatesPerHire === null && b.candidatesPerHire === null) return b.candidates - a.candidates;
            if (a.candidatesPerHire === null) return -1; // No hires = worst
            if (b.candidatesPerHire === null) return 1;
            return b.candidatesPerHire - a.candidatesPerHire; // Higher = worse
        });

    const mirageChannels = efficiencyData.filter(s => s.isMirage);
    const efficientChannels = efficiencyData.filter(s => s.isEfficient);

    return (
        <div>
            {/* Page Header */}
            <SubViewHeader
                title="Source Effectiveness"
                subtitle="Analyze recruiting channel performance and ROI"
                helpContent={SOURCE_EFFECTIVENESS_PAGE_HELP}
            />

            {/* Summary Cards */}
            <div className="grid grid-cols-12 gap-4 mb-4">
                {data.bestSource && (
                    <div className="col-span-12 md:col-span-4">
                        <div className="card-bespoke h-full">
                            <div className="card-body text-center py-4">
                                <StatLabel className="mb-2">Top Hiring Source</StatLabel>
                                <StatValue className="block" style={{ color: getSourceColor(data.bestSource.name) }}>
                                    {data.bestSource.name}
                                </StatValue>
                                <div className="mt-2">
                                    <span className="badge-bespoke badge-success-soft">
                                        {Math.round(data.bestSource.hireRate * 100)}% of hires
                                    </span>
                                </div>
                                <span className="text-muted-foreground text-sm block mt-1">
                                    {data.bestSource.hires.toLocaleString()} hires of {data.totalHires?.toLocaleString() || 0} total
                                </span>
                            </div>
                        </div>
                    </div>
                )}

                <div className="col-span-12 md:col-span-4">
                    <div className="card-bespoke h-full">
                        <div className="card-body text-center py-4">
                            <StatLabel className="mb-2">Total Candidates</StatLabel>
                            <StatValue color="primary">
                                {data.totalCandidates.toLocaleString()}
                            </StatValue>
                            <span className="text-muted-foreground text-sm">in selected period</span>
                        </div>
                    </div>
                </div>

                {data.worstSource && (
                    <div className="col-span-12 md:col-span-4">
                        <div className="card-bespoke h-full">
                            <div className="card-body text-center py-4">
                                <StatLabel className="mb-2">Lowest Conversion Rate</StatLabel>
                                <StatValue className="block" style={{ color: getSourceColor(data.worstSource.name) }}>
                                    {data.worstSource.name}
                                </StatValue>
                                <div className="mt-2">
                                    <span className="badge-bespoke badge-warning-soft">
                                        {Math.round(data.worstSource.hireRate * 100)}% conversion
                                    </span>
                                </div>
                                <span className="text-muted-foreground text-sm block mt-1">
                                    {data.worstSource.hires.toLocaleString()} hires from {data.worstSource.totalCandidates.toLocaleString()} candidates
                                </span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-12 gap-4 mb-4">
                {/* Hire Rate Comparison */}
                <div className="col-span-12 md:col-span-7">
                    <div className="card-bespoke h-full">
                        <div className="card-header">
                            <h6>Hire Rate by Source</h6>
                        </div>
                        <div className="card-body">
                            <ResponsiveContainer width="100%" height={280}>
                                <BarChart data={hireRateData} layout="vertical" barSize={18} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#3f3f46" />
                                    <XAxis
                                        type="number"
                                        domain={[0, 'auto']}
                                        unit="%"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: '#94A3B8', fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }}
                                    />
                                    <YAxis
                                        type="category"
                                        dataKey="source"
                                        width={80}
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: '#94A3B8', fontSize: 12 }}
                                    />
                                    <Tooltip
                                        cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                                        contentStyle={{
                                            background: '#0a0a0a',
                                            border: '1px solid #3f3f46',
                                            padding: '8px 12px',
                                            fontFamily: "'JetBrains Mono', monospace",
                                            fontSize: '12px'
                                        }}
                                        labelStyle={{ color: '#94A3B8', marginBottom: '4px' }}
                                        content={({ active, payload }) => {
                                            if (active && payload && payload.length) {
                                                const data = payload[0].payload;
                                                return (
                                                    <div style={{ background: '#0a0a0a', border: '1px solid #3f3f46', borderRadius: '4px', padding: '8px 12px', color: '#94A3B8', fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }}>
                                                        <div style={{ fontWeight: 600, marginBottom: 4 }}>{data.source}</div>
                                                        <div style={{ color: '#f59e0b' }}>{data.hireRate}% hire rate</div>
                                                        <div style={{ fontSize: '0.75rem', color: '#94A3B8' }}>{data.hires} hires / {data.total} candidates</div>
                                                    </div>
                                                );
                                            }
                                            return null;
                                        }}
                                    />
                                    <Bar dataKey="hireRate" radius={[0, 3, 3, 0]}>
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
                <div className="col-span-12 md:col-span-5">
                    <div className="card-bespoke h-full">
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
                                                    <text x={ex + (cos >= 0 ? 1 : -1) * 8} y={ey} textAnchor={textAnchor} fill="#94A3B8" fontSize={11} fontWeight={500} dy={4}>{safeName}</text>
                                                    <text x={ex + (cos >= 0 ? 1 : -1) * 8} y={ey} dy={16} textAnchor={textAnchor} fill="#94A3B8" fontSize={10}>{`${value}%`}</text>
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

            {/* Source Efficiency Analysis - Mirage Channel Detection */}
            {efficiencyData.length > 0 && (
                <div className="grid grid-cols-12 gap-4 mb-4">
                    {mirageChannels.length > 0 && (
                        <div className="col-span-12 md:col-span-6">
                            <ChannelCard
                                title="Mirage Channels"
                                subtitle="High activity, low results - consider reducing investment"
                                channels={mirageChannels}
                                variant="danger"
                            />
                        </div>
                    )}

                    {efficientChannels.length > 0 && (
                        <div className={mirageChannels.length > 0 ? 'col-span-12 md:col-span-6' : 'col-span-12'}>
                            <ChannelCard
                                title="High Efficiency Channels"
                                subtitle="Best ROI - consider increasing investment"
                                channels={efficientChannels}
                                variant="success"
                            />
                        </div>
                    )}

                    <div className="col-span-12">
                        <div className="card-bespoke">
                            <div className="card-header">
                                <h6>Source Efficiency Comparison</h6>
                                <span className="text-sm text-muted-foreground">
                                    Average: {avgCandidatesPerHire.toFixed(1)} candidates per hire
                                </span>
                            </div>
                            <div className="card-body p-0">
                                <div className="overflow-x-auto">
                                    <table className="table table-bespoke mb-0">
                                        <thead>
                                            <tr>
                                                <th>Source</th>
                                                <th className="text-right">Candidates</th>
                                                <th className="text-right">Hires</th>
                                                <th className="text-right">Candidates/Hire</th>
                                                <th className="text-right">vs Average</th>
                                                <th className="text-center">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {efficiencyData.map(s => (
                                                <tr key={s.source}>
                                                    <td>
                                                        <div className="flex items-center gap-2">
                                                            <SourceColorDot source={s.source} />
                                                            {s.source}
                                                        </div>
                                                    </td>
                                                    <td className="text-right">{s.candidates.toLocaleString()}</td>
                                                    <td className="text-right">{s.hires.toLocaleString()}</td>
                                                    <td className="text-right">
                                                        {s.candidatesPerHire !== null ? s.candidatesPerHire.toFixed(1) : '—'}
                                                    </td>
                                                    <td className="text-right">
                                                        {s.efficiencyVsAvg !== null ? (
                                                            <span style={{ color: s.efficiencyVsAvg > 0 ? STATUS_COLORS.danger : STATUS_COLORS.success }}>
                                                                {s.efficiencyVsAvg > 0 ? '+' : ''}{Math.round(s.efficiencyVsAvg)}%
                                                            </span>
                                                        ) : '—'}
                                                    </td>
                                                    <td className="text-center">
                                                        {getStatusBadge(s)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Funnel Comparison by Source */}
            <div className="card-bespoke mb-4">
                <div className="card-header">
                    <h6>Funnel Pass-Through Rates by Source</h6>
                    <span className="text-sm text-muted-foreground">See where candidates from each source drop off</span>
                </div>
                <div className="card-body p-0">
                    <div className="overflow-x-auto">
                        <table className="table table-bespoke mb-0">
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
                                        <td className="font-medium">
                                            <div className="flex items-center gap-2">
                                                <SourceColorDot source={source.source} />
                                                {source.source}
                                            </div>
                                        </td>
                                        {source.funnel.map((stage, idx) => {
                                            const { bgColor, textColor } = getPassRateStyle(stage.passRate);
                                            return (
                                                <td key={idx} className="text-center" style={{ background: bgColor }}>
                                                    {stage.entered > 0 ? (
                                                        <div>
                                                            <div style={{ fontWeight: 600, color: textColor }}>
                                                                {stage.passRate !== null ? `${Math.round(stage.passRate * 100)}%` : '—'}
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
                    <div className="mt-3 p-2 rounded flex gap-4 justify-center" style={{ background: '#141414', fontSize: '0.75rem', color: '#94A3B8' }}>
                        <span><span className="inline-block rounded mr-1" style={{ width: 12, height: 12, background: 'rgba(16, 185, 129, 0.4)' }}></span> ≥70% pass rate</span>
                        <span><span className="inline-block rounded mr-1" style={{ width: 12, height: 12, background: 'rgba(245, 158, 11, 0.4)' }}></span> 40-70%</span>
                        <span><span className="inline-block rounded mr-1" style={{ width: 12, height: 12, background: 'rgba(239, 68, 68, 0.4)' }}></span> &lt;40%</span>
                    </div>
                </div>
            </div>

            {/* Detailed Metrics Table */}
            <div className="card-bespoke">
                <div className="card-header">
                    <h6>Source Performance Details</h6>
                </div>
                <div className="card-body p-0">
                    <div className="overflow-x-auto">
                        <table className="table table-bespoke mb-0">
                            <thead>
                                <tr>
                                    <th>Source</th>
                                    <th className="text-right">Candidates</th>
                                    <th className="text-right">Hires</th>
                                    <th className="text-right">Hire Rate</th>
                                    <th className="text-right">Offers</th>
                                    <th className="text-right">Accept Rate</th>
                                    <th className="text-right">Median TTH</th>
                                    <th className="text-right">Screen Pass</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.bySource.map(s => (
                                    <tr key={s.source}>
                                        <td className="font-medium">
                                            <div className="flex items-center gap-2">
                                                <SourceColorDot source={s.source} />
                                                {s.source}
                                            </div>
                                        </td>
                                        <td className="text-right">{s.totalCandidates}</td>
                                        <td className="text-right">{s.hires}</td>
                                        <td className="text-right">
                                            <RateBadge rate={s.hireRate} thresholds={{ high: 0.15, medium: 0.05 }} />
                                        </td>
                                        <td className="text-right">{s.offers}</td>
                                        <td className="text-right">
                                            <RateBadge rate={s.offerAcceptRate} thresholds={{ high: 0.8, medium: 0.6 }} />
                                        </td>
                                        <td className="text-right text-muted-foreground">
                                            {s.medianTimeToHire !== null ? `${s.medianTimeToHire}d` : '—'}
                                        </td>
                                        <td className="text-right text-muted-foreground">
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
            <div className="mt-4 p-3 rounded" style={{ background: '#141414', border: '1px solid #27272a' }}>
                <div className="flex gap-2">
                    <span>💡</span>
                    <div className="text-sm text-muted-foreground">
                        <strong className="text-muted-foreground">Key Insight:</strong> Compare hire rates and time-to-hire across sources.
                        High-volume sources with low hire rates may be costing recruiter time.
                        Consider investing more in sources with higher conversion rates.
                    </div>
                </div>
            </div>
        </div>
    );
}

export default SourceEffectivenessTab;
