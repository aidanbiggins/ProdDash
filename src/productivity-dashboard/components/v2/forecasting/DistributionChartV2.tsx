/**
 * DistributionChartV2
 *
 * Histogram visualization for simulation results showing probability distribution.
 * V2 version using Tailwind tokens and glass-panel styling.
 */

import React, { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { addDays, format, differenceInDays } from 'date-fns';

interface DistributionChartV2Props {
  startDate: Date;
  simulatedDays: number[]; // e.g. [45, 46, 50, ...]
  p10Date: Date;
  p50Date: Date;
  p90Date: Date;
  height?: number;
}

export function DistributionChartV2({
  startDate,
  simulatedDays,
  p10Date,
  p50Date,
  p90Date,
  height = 200,
}: DistributionChartV2Props) {
  // Aggregate data into bins for the histogram
  const chartData = useMemo(() => {
    if (simulatedDays.length === 0) return [];

    const min = Math.min(...simulatedDays);
    const max = Math.max(...simulatedDays);
    const range = max - min;

    // Determine bin size (aim for ~20-30 bins)
    const binSize = Math.max(1, Math.ceil(range / 25));

    // Create bins
    const bins: Record<number, number> = {};
    for (const d of simulatedDays) {
      const binStart = Math.floor(d / binSize) * binSize;
      bins[binStart] = (bins[binStart] || 0) + 1;
    }

    const data = Object.entries(bins)
      .map(([daysStr, count]) => {
        const days = parseInt(daysStr, 10);
        const date = addDays(startDate, days);
        const percentage = (count / simulatedDays.length) * 100;
        return {
          days,
          dateStr: format(date, 'MMM d'),
          count,
          percentage,
          isP50: days === differenceInDays(p50Date, startDate), // Approx
          isWithinBand: date >= p10Date && date <= p90Date,
        };
      })
      .sort((a, b) => a.days - b.days);

    return data;
  }, [simulatedDays, startDate, p10Date, p90Date, p50Date]);

  if (chartData.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-muted-foreground text-sm"
        style={{ height }}
      >
        No simulation data available
      </div>
    );
  }

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer>
        <BarChart
          data={chartData}
          margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
          barCategoryGap={1}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
          <XAxis
            dataKey="dateStr"
            tick={{ fontSize: 11 }}
            className="fill-muted-foreground"
            interval="preserveStartEnd"
          />
          <YAxis hide />
          <Tooltip
            cursor={{ fill: 'transparent' }}
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const data = payload[0].payload;
                return (
                  <div className="glass-panel p-2 text-xs">
                    <div className="font-bold text-foreground">{data.dateStr}</div>
                    <div className="text-muted-foreground">
                      Prob: {data.percentage.toFixed(1)}% ({data.count} sims)
                    </div>
                  </div>
                );
              }
              return null;
            }}
          />

          <Bar dataKey="percentage" radius={[2, 2, 0, 0]}>
            {chartData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                className={entry.isWithinBand ? 'fill-primary' : 'fill-muted-foreground'}
                fillOpacity={entry.isWithinBand ? 0.6 : 0.4}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default DistributionChartV2;
