import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { BarChart3, CheckCircle2, Clock, AlertTriangle, FolderKanban, Building2 } from 'lucide-react';
import { useAuth } from '../modules/context/AuthContext';
import StatusPieChart from '../components/charts/StatusPieChart';
import WeeklyLineChart from '../components/charts/WeeklyLineChart';

const API_BASE = import.meta.env.VITE_API_URL || import.meta.env.API_URL || 'http://localhost:5000/api';

const MOCK_ANALYTICS = {
    statusDistribution: { todo: 4, in_progress: 6, completed: 12, overdue: 2 },
    weeklyCompletion: [
        { week: 'W1', completed: 3 },
        { week: 'W2', completed: 5 },
        { week: 'W3', completed: 8 },
        { week: 'W4', completed: 12 },
    ],
};

const MOCK_STATS = {
    totalTasks: 24,
    completedTasks: 12,
    inProgressTasks: 6,
    overdueTasks: 2,
    totalProjects: 3,
    totalWorkspaces: 2,
};

const parseCount = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

const buildWeeklyFallback = (completedCount) => {
    const safeCompleted = Math.max(parseCount(completedCount), 0);
    if (safeCompleted === 0) return [...MOCK_ANALYTICS.weeklyCompletion];

    return [0.25, 0.5, 0.75, 1].map((ratio, index) => ({
        week: `W${index + 1}`,
        completed: Math.max(0, Math.round(safeCompleted * ratio)),
    }));
};

const normalizeStatusDistribution = (rawPayload) => {
    const defaultDistribution = {
        todo: 0,
        in_progress: 0,
        completed: 0,
        overdue: 0,
    };

    const statusMap = rawPayload?.statusDistribution;
    const legacyArray = rawPayload?.tasksByStatus;

    if (statusMap && typeof statusMap === 'object' && !Array.isArray(statusMap)) {
        return {
            todo: parseCount(statusMap.todo),
            in_progress: parseCount(statusMap.in_progress ?? statusMap.inProgress),
            completed: parseCount(statusMap.completed ?? statusMap.done),
            overdue: parseCount(statusMap.overdue),
        };
    }

    if (Array.isArray(legacyArray)) {
        return legacyArray.reduce((acc, item) => {
            const rawStatus = String(item?.status || '').toLowerCase();
            const count = parseCount(item?.count);
            if (rawStatus === 'todo') acc.todo += count;
            if (rawStatus === 'in_progress') acc.in_progress += count;
            if (rawStatus === 'completed' || rawStatus === 'done') acc.completed += count;
            if (rawStatus === 'overdue') acc.overdue += count;
            return acc;
        }, defaultDistribution);
    }

    return defaultDistribution;
};

const normalizeWeeklyCompletion = (rawPayload, completedFallback) => {
    const rawWeekly = rawPayload?.weeklyCompletion;

    if (Array.isArray(rawWeekly) && rawWeekly.length > 0) {
        return rawWeekly.map((item, index) => ({
            week: item?.week || `W${index + 1}`,
            completed: parseCount(item?.completed),
        }));
    }

    return buildWeeklyFallback(completedFallback);
};

const normalizeStats = (rawStats, statusDistribution) => {
    const totalFromDistribution = Object.values(statusDistribution).reduce((sum, value) => sum + parseCount(value), 0);

    return {
        totalTasks: parseCount(rawStats?.totalTasks ?? totalFromDistribution),
        completedTasks: parseCount(rawStats?.completedTasks ?? statusDistribution.completed),
        inProgressTasks: parseCount(rawStats?.inProgressTasks ?? statusDistribution.in_progress),
        overdueTasks: parseCount(rawStats?.overdueTasks ?? statusDistribution.overdue),
        totalProjects: parseCount(rawStats?.totalProjects),
        totalWorkspaces: parseCount(rawStats?.totalWorkspaces),
    };
};

const fetchEndpoint = async (url, headers) => {
    const response = await axios.get(url, { headers });
    return response.data;
};

export default function Dashboard() {
    const { token } = useAuth();
    const [stats, setStats] = useState(MOCK_STATS);
    const [analytics, setAnalytics] = useState(MOCK_ANALYTICS);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        let active = true;

        const loadDashboard = async () => {
            setLoading(true);
            let errorMessage = '';

            const authToken = token || localStorage.getItem('nexus_token');
            const headers = authToken ? { Authorization: `Bearer ${authToken}` } : {};

            let analyticsPayload = null;
            let statsPayload = null;

            try {
                analyticsPayload = await fetchEndpoint(`${API_BASE}/dashboard/analytics`, headers);
            } catch {
                try {
                    statsPayload = await fetchEndpoint(`${API_BASE}/analytics/dashboard`, headers);
                    analyticsPayload = statsPayload;
                } catch {
                    analyticsPayload = MOCK_ANALYTICS;
                    statsPayload = MOCK_STATS;
                    errorMessage = 'Live analytics are unavailable right now. Showing sample data.';
                }
            }

            if (!statsPayload && analyticsPayload && (analyticsPayload.totalTasks || analyticsPayload.totalProjects || analyticsPayload.totalWorkspaces)) {
                statsPayload = analyticsPayload;
            }

            if (!statsPayload && analyticsPayload && analyticsPayload !== MOCK_ANALYTICS) {
                try {
                    statsPayload = await fetchEndpoint(`${API_BASE}/analytics/dashboard`, headers);
                } catch {
                    statsPayload = null;
                }
            }

            const normalizedStatus = normalizeStatusDistribution(analyticsPayload);
            const normalizedStats = normalizeStats(statsPayload, normalizedStatus);
            const normalizedWeekly = normalizeWeeklyCompletion(analyticsPayload, normalizedStats.completedTasks);

            if (!active) return;

            setAnalytics({
                statusDistribution: normalizedStatus,
                weeklyCompletion: normalizedWeekly,
            });
            setStats(normalizedStats);
            setError(errorMessage);
            setLoading(false);
        };

        loadDashboard();

        return () => {
            active = false;
        };
    }, [token]);

    if (loading) {
        return <div className="page-loading"><div className="spinner"></div><p>Loading dashboard analytics...</p></div>;
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
                <p className="text-muted">Interactive analytics across your workspaces</p>
            </div>

            {error && <div className="dashboard-alert">{error}</div>}

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
                    <h3>Task Distribution by Status</h3>
                    <StatusPieChart statusDistribution={analytics.statusDistribution} />
                </div>

                <div className="chart-card glass">
                    <h3>Weekly Completion Trend</h3>
                    <WeeklyLineChart weeklyCompletion={analytics.weeklyCompletion} />
                </div>
            </div>
        </div>
    );
}
