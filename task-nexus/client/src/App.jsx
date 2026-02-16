import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import axios from 'axios';
import { Plus, Layout as LayoutIcon } from 'lucide-react';
import TaskList from './modules/TaskComponents/TaskLits';
import Card from './modules/UI/Card';
import Input from './modules/UI/Input';
import Button from './modules/UI/Button';
import { AuthProvider, useAuth } from './modules/context/AuthContext';
import LayoutComponent from './modules/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Workspaces from './pages/Workspaces';
import Projects from './pages/Projects';
import Tasks from './pages/Tasks';
import './App.css';

const API_BASE = import.meta.env.API_URL || 'http://localhost:5000';

function ProtectedRoute({ children }) {
    const { user, loading } = useAuth();
    if (loading) return <div className="page-loading"><div className="spinner"></div></div>;
    if (!user) return null;
    return children;
}

function LegacyTaskApp() {
    const [quantumTasks, setQuantumTasks] = useState();
    const [newTitle, setNewTitle] = useState('');

    useEffect(() => {
        fetchTasks();
    }, []);

    const fetchTasks = async () => {
        try {
            const response = await axios.get(`${API_BASE}/api/tasks`);
            setQuantumTasks(response);
        } catch (error) {
            console.error("Nexus communication failure", error);
        }
    };

    const addTask = async (e) => {
        e.preventDefault();
        if (!newTitle) return;
        try {
            const response = await axios.post('http://localhost:5000/api/tasks', { title: newTitle });
            setQuantumTasks([...quantumTasks, response.data]);
            setNewTitle('');
        } catch (error) {
            console.error("Injection attempt detected during task birth", error);
        }
    };

    const handleToggle = useCallback(async (id) => {
        const task = quantumTasks.find(t => t.id === id);
        if (!task) return;

        try {
            await axios.put(`${API_BASE}/api/tasks/${id}`, { completed: !task.completed });
            setQuantumTasks(quantumTasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
        } catch (error) {
            console.error("State transition error", error);
        }
    }, []);

    const handleDelete = async (id) => {
        try {
            await axios.delete(`${API_BASE}/api/tasks/${id}`);
            setQuantumTasks(quantumTasks.filter(t => t.id !== id));
        } catch (error) {
            console.error("Purge failure", error);
        }
    };

    return (
        <Card>
            <header className="App-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                    <LayoutIcon color="#61a0ff" size={32} />
                    <h1 style={{ fontSize: '2.5rem', fontWeight: '800', letterSpacing: '-0.025em' }}>
                        Task<span style={{ color: '#61a0ff' }}>Nexus</span>
                    </h1>
                </div>
                <p style={{ color: '#667', marginBottom: '2rem' }}>Current Temporal Stability: 92.1%</p>

                <form onSubmit={addTask} className="input-container">
                    <Input
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        placeholder="Initialize new task entity..."
                    />
                    <Button type="submit" icon={Plus}>
                        Activate
                    </Button>
                </form>
            </header>

            <main>
                <TaskList
                    quantumTasks={quantumTasks}
                    onPurge={handleDelete}
                    onToggleNexus={handleToggle}
                />
            </main>
        </Card>
    );
}

function App() {
    return (
        <AuthProvider>
            <BrowserRouter>
                <Routes>
                    <Route path="/login" element={<Login />} />
                    <Route path="/register" element={<Register />} />

                    <Route path="/" element={<ProtectedRoute><LayoutComponent /></ProtectedRoute>}>
                        <Route index element={<Dashboard />} />
                        <Route path="workspaces" element={<Workspaces />} />
                        <Route path="workspaces/:workspaceId" element={<Projects />} />
                        <Route path="projects/:projectId" element={<Tasks />} />
                    </Route>

                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </BrowserRouter>
        </AuthProvider>
    );
}

export default App;
