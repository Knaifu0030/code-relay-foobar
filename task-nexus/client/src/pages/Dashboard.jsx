import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { BarChart3, CheckCircle2, Clock, AlertTriangle, FolderKanban, Building2 } from 'lucide-react';

const API_BASE = import.meta.env.API_URL || 'http://localhost:5000/api';

export default function Dashboard() {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const token = localStorage.getItem('nexus_token');
        axios.get(`${API_BASE}/analytics/dashboard`, {
            headers: { Authorization: `Bearer ${token}` }
        })
            .then(response => setStats(response.data))
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return <div className="page-loading"><div className="spinner"></div><p>Loading dashboard...</p></div>;
    }

    const statCards = [
        { label: 'Total Tasks', value: stats?.totalTasks || 0, icon: BarChart3, color: '#3B82F6' },
        { label: 'Completed', value: stats?.completedTasks || 0, icon: CheckCircle2, color: '#10B981' },
        { label: 'In Progress', value: stats?.inProgressTasks || 0, icon: Clock, color: '#F59E0B' },
        { label: 'Overdue', value: stats?.overdueTasks || 0, icon: AlertTriangle, color: '#EF4444' },
        { label: 'Projects', value: stats?.totalProjects || 0, icon: FolderKanban, color: '#8B5CF6' },
        { label: 'Workspaces', value: stats?.totalWorkspaces || 0, icon: Building2, color: '#06B6D4' },
    ];

    return (
        <div className="dashboard-page fade-in">
            <div className="page-header">
                <h2>Dashboard</h2>
                <p className="text-muted">Overview of your task management</p>
            </div>

            <div className="stats-grid">
                {statCards.map((card) => (
                    <div key={card.label} className="stat-card glass">
                        <div className="stat-icon" style={{ backgroundColor: `${card.color}20`, color: card.color }}>
                            <card.icon size={22} />
                        </div>
                        <div className="stat-info">
                            <span className="stat-value">{card.value}</span>
                            <span className="stat-label">{card.label}</span>
                        </div>
                    </div>
                ))}
            </div>

            <div className="dashboard-charts">
                <div className="chart-card glass">
                    <h3>Tasks by Status</h3>
                    <div className="chart-bars">
                        {stats?.tasksByStatus?.map((item) => (
                            <div key={item.status} className="chart-bar-row">
                                <span className="chart-bar-label">{item.status?.replace('_', ' ')}</span>
                                <div className="chart-bar-track">
                                    <div className="chart-bar-fill" style={{
                                        width: `${stats.totalTasks ? (item.count / stats.totalTasks) * 100 : 0}%`,
                                        backgroundColor: '#3B82F6'
                                    }}></div>
                                </div>
                                <span className="chart-bar-value">{item.count}</span>
                            </div>
                        ))}
                        {(!stats?.tasksByStatus || stats.tasksByStatus.length === 0) && (
                            <p className="text-muted" style={{ textAlign: 'center', padding: '2rem' }}>No tasks yet</p>
                        )}
                    </div>
                </div>

                <div className="chart-card glass">
                    <h3>Tasks by Priority</h3>
                    <div className="chart-bars">
                        {stats?.tasksByPriority?.map((item) => (
                            <div key={item.priority} className="chart-bar-row">
                                <span className="chart-bar-label">{item.priority}</span>
                                <div className="chart-bar-track">
                                    <div className="chart-bar-fill" style={{
                                        width: `${stats.totalTasks ? (item.count / stats.totalTasks) * 100 : 0}%`,
                                        backgroundColor: '#F59E0B'
                                    }}></div>
                                </div>
                                <span className="chart-bar-value">{item.count}</span>
                            </div>
                        ))}
                        {(!stats?.tasksByPriority || stats.tasksByPriority.length === 0) && (
                            <p className="text-muted" style={{ textAlign: 'center', padding: '2rem' }}>No tasks yet</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
