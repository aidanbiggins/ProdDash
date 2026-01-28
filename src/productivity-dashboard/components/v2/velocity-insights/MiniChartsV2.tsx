'use client';

/**
 * MiniChartsV2 - Mini Charts for Velocity Copilot Insights
 * Small inline visualizations for insight cards
 * V2 Version - Uses Tailwind tokens and glass-panel styling
 */

import React from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Cell,
  ReferenceLine
} from 'recharts';
import {
  ChartData,
  SparklineData,
  GaugeData,
  ComparisonData,
  BottleneckData,
  ReqHealthData
} from '../../../services/insightChartService';

interface MiniChartProps {
  data: ChartData;
  width?: number;
  height?: number;
}

/**
 * Main MiniChart component - renders appropriate chart based on data type
 */
export function MiniChartV2({ data, width = 160, height = 60 }: MiniChartProps) {
  switch (data.type) {
    case 'decay_sparkline':
      return <DecaySparkline data={data} width={width} height={height} />;
    case 'rate_gauge':
      return <RateGauge data={data} size={height} />;
    case 'comparison_bars':
      return <ComparisonBars data={data} width={width} height={height} />;
    case 'bottleneck_bars':
      return <BottleneckBars data={data} width={width} height={height} />;
    case 'req_health_bars':
      return <ReqHealthBars data={data} width={width} height={height} />;
    default:
      return null;
  }
}

/**
 * Decay Sparkline - shows acceptance rate dropping over time
 */
function DecaySparkline({ data, width, height }: { data: SparklineData; width: number; height: number }) {
  const chartData = data.data.map(d => ({ name: d.label, value: d.value }));

  return (
    <div style={{ width, height }} className="mini-chart-container">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
          {data.threshold && (
            <ReferenceLine
              y={data.threshold}
              stroke="rgb(var(--color-warn))"
              strokeDasharray="3 3"
              strokeOpacity={0.5}
            />
          )}
          <Line
            type="monotone"
            dataKey="value"
            stroke="rgb(var(--color-accent))"
            strokeWidth={2}
            dot={{ r: 3, fill: 'rgb(var(--color-accent))' }}
            activeDot={{ r: 4 }}
          />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 8, fill: 'rgb(var(--color-muted-foreground))' }}
            axisLine={false}
            tickLine={false}
          />
        </LineChart>
      </ResponsiveContainer>
      <div className="text-[10px] text-muted-foreground text-center mt-1">Decay curve</div>
    </div>
  );
}

/**
 * Rate Gauge - circular progress for percentages
 */
function RateGauge({ data, size }: { data: GaugeData; size: number }) {
  const { value, label, thresholds } = data;

  // Determine color based on thresholds
  const getColor = () => {
    if (value < thresholds.bad) return 'rgb(var(--color-bad))';
    if (value < thresholds.warn) return 'rgb(var(--color-warn))';
    return 'rgb(var(--color-good))';
  };
  const color = getColor();

  // SVG arc calculation
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (value / 100) * circumference;
  const dashOffset = circumference - progress;

  return (
    <div
      className="mini-chart-container relative flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgb(var(--color-border))"
          strokeWidth={4}
        />
        {/* Progress arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={4}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={{ transition: 'stroke-dashoffset 0.5s ease' }}
        />
      </svg>
      {/* Center label */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="font-mono text-xs font-semibold" style={{ color }}>
          {label.includes('d') ? label : `${value}%`}
        </span>
      </div>
    </div>
  );
}

/**
 * Comparison Bars - side by side for fast vs slow
 */
function ComparisonBars({ data, width, height }: { data: ComparisonData; width: number; height: number }) {
  const chartData = data.bars.map(b => ({
    name: b.label,
    value: b.value,
    fill: b.color === 'good' ? 'rgb(var(--color-good))' : b.color === 'bad' ? 'rgb(var(--color-bad))' : 'rgb(var(--color-muted-foreground))'
  }));

  return (
    <div style={{ width, height }} className="mini-chart-container">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 30, bottom: 0, left: 30 }}>
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fontSize: 9, fill: 'rgb(var(--color-muted-foreground))' }}
            axisLine={false}
            tickLine={false}
            width={30}
          />
          <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={14}>
            {chartData.map((entry, index) => (
              <Cell key={index} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="flex justify-between px-2 text-[10px] font-mono">
        {data.bars.map((b, i) => (
          <span key={i} className={b.color === 'good' ? 'text-good' : 'text-bad'}>
            {b.value}{data.unit === 'days' ? 'd' : ''}
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * Bottleneck Bars - horizontal bars for stage delays
 */
function BottleneckBars({ data, width, height }: { data: BottleneckData; width: number; height: number }) {
  const maxDays = Math.max(...data.stages.map(s => s.days));
  const chartData = data.stages.map(s => ({
    name: s.stage,
    days: s.days,
    // Color intensity based on severity
    fill: s.days > maxDays * 0.8 ? 'rgb(var(--color-bad))' : s.days > maxDays * 0.5 ? 'rgb(var(--color-warn))' : 'rgb(var(--color-muted-foreground))'
  }));

  return (
    <div style={{ width, height }} className="mini-chart-container">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 25, bottom: 0, left: 5 }}>
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fontSize: 8, fill: 'rgb(var(--color-muted-foreground))' }}
            axisLine={false}
            tickLine={false}
            width={50}
          />
          <Bar dataKey="days" radius={[0, 4, 4, 0]} barSize={10} label={{ position: 'right', fontSize: 8, fill: 'rgb(var(--color-muted-foreground))' }}>
            {chartData.map((entry, index) => (
              <Cell key={index} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Req Health Bars - stacked bar showing zombie/stalled/healthy
 */
function ReqHealthBars({ data, width, height }: { data: ReqHealthData; width: number; height: number }) {
  const { zombie, stalled, total } = data;
  const healthy = Math.max(0, total - zombie - stalled);

  const zombiePercent = total > 0 ? (zombie / total) * 100 : 0;
  const stalledPercent = total > 0 ? (stalled / total) * 100 : 0;
  const healthyPercent = total > 0 ? (healthy / total) * 100 : 0;

  return (
    <div style={{ width, height }} className="mini-chart-container">
      <div className="flex h-3 rounded overflow-hidden bg-muted">
        {zombiePercent > 0 && (
          <div
            className="bg-bad transition-all"
            style={{ width: `${zombiePercent}%` }}
            title={`Zombie: ${zombie}`}
          />
        )}
        {stalledPercent > 0 && (
          <div
            className="bg-warn transition-all"
            style={{ width: `${stalledPercent}%` }}
            title={`Stalled: ${stalled}`}
          />
        )}
        {healthyPercent > 0 && (
          <div
            className="bg-good transition-all"
            style={{ width: `${healthyPercent}%` }}
            title={`Healthy: ${healthy}`}
          />
        )}
      </div>
      <div className="flex gap-2 mt-1 text-[10px]">
        {zombie > 0 && <span className="text-bad">{zombie} zombie</span>}
        {stalled > 0 && <span className="text-warn">{stalled} stalled</span>}
      </div>
    </div>
  );
}

// Backwards-compatible alias
export const MiniChart = MiniChartV2;

export default MiniChartV2;
