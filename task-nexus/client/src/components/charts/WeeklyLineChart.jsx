import React, { useMemo } from 'react';
import {
    ResponsiveContainer,
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
} from 'recharts';

function WeeklyTooltip({ active, payload, label }) {
    if (!active || !payload || payload.length === 0) return null;

    return (
        <div className="chart-tooltip">
            <p className="chart-tooltip-label">{label}</p>
            <p className="chart-tooltip-value">{payload[0].value} completed</p>
        </div>
    );
}

export default function WeeklyLineChart({ weeklyCompletion }) {
    const chartData = useMemo(
        () =>
            (Array.isArray(weeklyCompletion) ? weeklyCompletion : []).map((item, index) => ({
                week: item?.week || `W${index + 1}`,
                completed: Number(item?.completed || 0),
            })),
        [weeklyCompletion]
    );

    if (chartData.length === 0) {
        return <div className="chart-empty">No weekly completion data available.</div>;
    }

    return (
        <div className="chart-wrapper">
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 8, right: 8, left: -10, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="4 4" stroke="hsla(var(--text), 0.12)" />
                    <XAxis dataKey="week" tick={{ fill: 'hsl(var(--text-muted))', fontSize: 12 }} tickLine={false} axisLine={false} />
                    <YAxis allowDecimals={false} tick={{ fill: 'hsl(var(--text-muted))', fontSize: 12 }} tickLine={false} axisLine={false} />
                    <Tooltip content={<WeeklyTooltip />} />
                    <Legend verticalAlign="bottom" height={30} wrapperStyle={{ color: 'hsl(var(--text-muted))' }} />
                    <Line
                        type="monotone"
                        dataKey="completed"
                        name="Completed Tasks"
                        stroke="hsl(var(--primary))"
                        strokeWidth={3}
                        dot={{ r: 4, fill: 'hsl(var(--primary))', strokeWidth: 0 }}
                        activeDot={{ r: 6, fill: 'hsl(var(--primary))', stroke: 'hsl(var(--card))', strokeWidth: 2 }}
                        animationDuration={700}
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}
