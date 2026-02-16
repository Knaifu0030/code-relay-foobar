import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Plus, Trash2, ArrowLeft, Calendar, Flag, Check, Clock, Eye, ListTodo } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || import.meta.env.API_URL || 'http://localhost:5000/api';
const STATUSES = ['todo', 'in_progress', 'review', 'done'];

const statusLabels = { todo: 'To Do', in_progress: 'In Progress', review: 'Review', done: 'Done' };
const statusIcons = { todo: ListTodo, in_progress: Clock, review: Eye, done: Check };
const priorityColors = { low: '#94A3B8', medium: '#3B82F6', high: '#F59E0B', urgent: '#EF4444' };

export default function Tasks() {
    const { projectId } = useParams();
    const navigate = useNavigate();

    const [project, setProject] = useState(null);
    const [tasks, setTasks] = useState([]); // ✅ always array
    const [showForm, setShowForm] = useState(false);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState('board');

    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [priority, setPriority] = useState('medium');
    const [dueDate, setDueDate] = useState('');

    useEffect(() => {
        const token = localStorage.getItem('nexus_token');
        const headers = { Authorization: `Bearer ${token}` };

        setLoading(true);

        Promise.all([
            axios.get(`${API_BASE}/projects/${projectId}`, { headers }),
            axios.get(`${API_BASE}/tasks`, { params: { projectId }, headers }),
        ])
            .then(([projRes, taskRes]) => {
                setProject(projRes.data);
                setTasks(Array.isArray(taskRes.data) ? taskRes.data : []); // ✅ safe
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [projectId]);

    const handleCreate = async (e) => {
        e.preventDefault();
        const token = localStorage.getItem('nexus_token');

        try {
            const response = await axios.post(
                `${API_BASE}/tasks`,
                {
                    title,
                    description,
                    priority,
                    due_date: dueDate || null,
                    project_id: Number(projectId),
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            setTasks((prev) => [...prev, response.data]); // ✅ safe
            setTitle('');
            setDescription('');
            setPriority('medium');
            setDueDate('');
            setShowForm(false);
        } catch (err) {
            console.error(err);
        }
    };

    const handleStatusChange = useCallback(async (taskId, newStatus) => {
        const token = localStorage.getItem('nexus_token');

        try {
            await axios.put(
                `${API_BASE}/tasks/${taskId}`,
                {
                    status: newStatus,
                    completed: newStatus === 'done',
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            setTasks((prev) =>
                prev.map((t) =>
                    t.id === taskId ? { ...t, status: newStatus, completed: newStatus === 'done' } : t
                )
            ); // ✅ no stale tasks
        } catch (err) {
            console.error(err);
        }
    }, []);

    const handleDelete = async (id) => {
        const token = localStorage.getItem('nexus_token');

        try {
            await axios.delete(`${API_BASE}/tasks/${id}`, {
                headers: { Authorization: `Bearer ${token}` },
            });

            setTasks((prev) => prev.filter((t) => t.id !== id)); // ✅ safe
        } catch (err) {
            console.error(err);
        }
    };

    if (loading) {
        return (
            <div className="page-loading">
                <div className="spinner"></div>
                <p>Loading tasks...</p>
            </div>
        );
    }

    const tasksByStatus = STATUSES.reduce((acc, status) => {
        acc[status] = tasks.filter((t) => (t.status || 'todo') === status);
        return acc;
    }, {});

    return (
        <div className="page fade-in">
            <div className="page-header">
                <div>
                    <button className="btn-ghost back-btn" onClick={() => navigate(-1)}>
                        <ArrowLeft size={18} /> Back
                    </button>
                    <h2>{project?.name || 'Project'}</h2>
                </div>

                <div className="header-actions">
                    <div className="view-toggle">
                        <button
                            className={`toggle-btn ${viewMode === 'board' ? 'active' : ''}`}
                            onClick={() => setViewMode('board')}
                        >
                            Board
                        </button>
                        <button
                            className={`toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
                            onClick={() => setViewMode('list')}
                        >
                            List
                        </button>
                    </div>

                    <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
                        <Plus size={18} /> New Task
                    </button>
                </div>
            </div>

            {showForm && (
                <form onSubmit={handleCreate} className="create-form glass fade-in">
                    <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Task title"
                        required
                    />
                    <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Description"
                        rows={3}
                    />

                    <div className="form-row">
                        <div className="form-group">
                            <label>
                                <Flag size={14} /> Priority
                            </label>
                            <select value={priority} onChange={(e) => setPriority(e.target.value)}>
                                <option value="low">Low</option>
                                <option value="medium">Medium</option>
                                <option value="high">High</option>
                                <option value="urgent">Urgent</option>
                            </select>
                        </div>

                        <div className="form-group">
                            <label>
                                <Calendar size={14} /> Due Date
                            </label>
                            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                        </div>
                    </div>

                    <div className="form-actions">
                        <button type="submit" className="btn-primary">
                            Create Task
                        </button>
                        <button type="button" className="btn-ghost" onClick={() => setShowForm(false)}>
                            Cancel
                        </button>
                    </div>
                </form>
            )}

            {viewMode === 'board' ? (
                <div className="kanban-board">
                    {STATUSES.map((status) => {
                        const StatusIcon = statusIcons[status];
                        return (
                            <div key={status} className="kanban-column">
                                <div className="kanban-column-header">
                                    <StatusIcon size={16} />
                                    <span>{statusLabels[status]}</span>
                                    <span className="task-count">{tasksByStatus[status].length}</span>
                                </div>

                                <div className="kanban-cards">
                                    {tasksByStatus[status].map((task) => (
                                        <div key={task.id} className="task-card glass">
                                            <div className="task-card-header">
                                                <span
                                                    className="priority-dot"
                                                    style={{ backgroundColor: priorityColors[task.priority] || priorityColors.medium }}
                                                ></span>

                                                <button className="btn-icon-sm" onClick={() => handleDelete(task.id)}>
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>

                                            <h4>{task.title}</h4>

                                            <div className="task-card-footer">
                                                {task.due_date && (
                                                    <span className="task-due">
                                                        <Calendar size={12} />
                                                        {new Date(task.due_date).toLocaleDateString()}
                                                    </span>
                                                )}

                                                <select
                                                    value={task.status || 'todo'}
                                                    onChange={(e) => handleStatusChange(task.id, e.target.value)}
                                                    className="status-select"
                                                >
                                                    {STATUSES.map((s) => (
                                                        <option key={s} value={s}>
                                                            {statusLabels[s]}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="task-list-view">
                    {tasks.map((task) => (
                        <div key={task.id} className="task-list-row glass">
                            <span className="task-title">{task.title}</span>

                            <span className="priority-badge" style={{ color: priorityColors[task.priority] || priorityColors.medium }}>
                                <Flag size={14} /> {task.priority || 'medium'}
                            </span>

                            <select
                                value={task.status || 'todo'}
                                onChange={(e) => handleStatusChange(task.id, e.target.value)}
                                className="status-select"
                            >
                                {STATUSES.map((s) => (
                                    <option key={s} value={s}>
                                        {statusLabels[s]}
                                    </option>
                                ))}
                            </select>

                            <button className="btn-icon-sm" onClick={() => handleDelete(task.id)}>
                                <Trash2 size={14} />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
