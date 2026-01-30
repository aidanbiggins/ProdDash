import React, { useMemo } from 'react';
import {
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
import { addDays, format, differenceInDays } from 'date-fns';

interface DistributionChartProps {
    startDate: Date;
    simulatedDays: number[]; // e.g. [45, 46, 50, ...]
    p10Date: Date;
    p50Date: Date;
    p90Date: Date;
    height?: number;
}

export const DistributionChart: React.FC<DistributionChartProps> = ({
    startDate,
    simulatedDays,
    p10Date,
    p50Date,
    p90Date,
    height = 200
}) => {
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

        const data = Object.entries(bins).map(([daysStr, count]) => {
            const days = parseInt(daysStr, 10);
            const date = addDays(startDate, days);
            const percentage = (count / simulatedDays.length) * 100;
            return {
                days,
                dateStr: format(date, 'MMM d'),
                count,
                percentage,
                isP50: days === differenceInDays(p50Date, startDate), // Approx
                isWithinBand: date >= p10Date && date <= p90Date
            };
        }).sort((a, b) => a.days - b.days);

        return data;
    }, [simulatedDays, startDate, p10Date, p90Date, p50Date]);

    if (chartData.length === 0) {
        return (
            <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }} className="text-muted-foreground text-sm">
                No simulation data available
            </div>
        );
    }

    // Calculate X-Axis lines positions
    const p10Days = differenceInDays(p10Date, startDate);
    const p50Days = differenceInDays(p50Date, startDate);
    const p90Days = differenceInDays(p90Date, startDate);

    return (
        <div style={{ width: '100%', height: height }}>
            <ResponsiveContainer>
                <BarChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }} barCategoryGap={1}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--glass-border)" />
                    <XAxis
                        dataKey="dateStr"
                        tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                        interval="preserveStartEnd"
                    />
                    <YAxis hide />
                    <Tooltip
                        cursor={{ fill: 'transparent' }}
                        content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                                const data = payload[0].payload;
                                return (
                                    <div className="bg-white p-2 border border-border shadow-sm rounded text-xs">
                                        <div className="font-bold">{data.dateStr}</div>
                                        <div>Prob: {data.percentage.toFixed(1)}% ({data.count} sims)</div>
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
                                fill={entry.isWithinBand ? 'var(--accent)' : 'var(--text-muted)'}
                                fillOpacity={entry.isWithinBand ? 0.6 : 0.4}
                            />
                        ))}
                    </Bar>

                    {/* Vertical Lines for P10, P50, P90 */}
                    {/* Note: In categorical/binned charts, direct X value mapping is tricky if XAxis uses dateStr. 
              Ideally we'd use scatter or composed chart with custom X axis type number.
              For simplicity, we visualize these bands via bar color for now, or just use overlay markers in CSS if needed.
              Here we attempt ReferenceLines but need numeric X axis for days. 
              Switching XAxis to 'days' would make ReferenceLines easier but labels harder.
           */}
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
};
