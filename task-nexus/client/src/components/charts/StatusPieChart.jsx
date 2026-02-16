import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

const STATUS_META = [
    { key: 'todo', label: 'To Do', color: '#60A5FA' },
    { key: 'in_progress', label: 'In Progress', color: '#F59E0B' },
    { key: 'completed', label: 'Completed', color: '#10B981' },
    { key: 'overdue', label: 'Overdue', color: '#EF4444' },
];

function StatusTooltip({ active, payload }) {
    if (!active || !payload || payload.length === 0) return null;

    const item = payload[0];
    return (
        <div className="chart-tooltip">
            <p className="chart-tooltip-label">{item.name}</p>
            <p className="chart-tooltip-value">{item.value} tasks</p>
        </div>
    );
}

export default function StatusPieChart({ statusDistribution }) {
    const chartData = useMemo(
        () =>
            STATUS_META.map((status) => ({
                name: status.label,
                value: Number(statusDistribution?.[status.key] || 0),
                color: status.color,
            })),
        [statusDistribution]
    );

    const total = chartData.reduce((acc, item) => acc + item.value, 0);

    if (total === 0) {
        return <div className="chart-empty">No task status data available.</div>;
    }

    return (
        <div className="chart-wrapper">
            <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <Pie
                        data={chartData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={70}
                        outerRadius={102}
                        paddingAngle={2}
                        animationDuration={650}
                    >
                        {chartData.map((item) => (
                            <Cell key={item.name} fill={item.color} />
                        ))}
                    </Pie>
                    <Tooltip content={<StatusTooltip />} />
                    <Legend verticalAlign="bottom" height={30} wrapperStyle={{ color: 'hsl(var(--text-muted))' }} />
                </PieChart>
            </ResponsiveContainer>
        </div>
    );
}
