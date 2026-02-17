import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import axios from 'axios';
import { Plus, Layout as LayoutIcon } from 'lucide-react';
import TaskList from './modules/TaskComponents/TaskList';
import Card from './modules/UI/Card';
import Input from './modules/UI/Input';
import Button from './modules/UI/Button';
import { AuthProvider, useAuth } from './modules/context/AuthContext';
import { ThemeProvider } from './modules/context/ThemeContext';
import { NotificationProvider } from './modules/context/NotificationContext';
import LayoutComponent from './modules/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Workspaces from './pages/Workspaces';
import Projects from './pages/Projects';
import Tasks from './pages/Tasks';
import Landing from './pages/Landing';
import './App.css';

const API_BASE = (import.meta.env.VITE_API_URL || import.meta.env.API_URL || '/api').replace(/\/api\/?$/, '');

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="page-loading"><div className="spinner"></div></div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function LandingRoute() {
  const { user, loading } = useAuth();
  if (loading) return <div className="page-loading"><div className="spinner"></div></div>;
  if (user) return <Navigate to="/dashboard" replace />;
  return <Landing />;
}

function LegacyTaskApp() {
  const [quantumTasks, setQuantumTasks] = useState([]);
  const [newTitle, setNewTitle] = useState('');

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    try {
      const response = await axios.get(`${API_BASE}/api/tasks`);
      setQuantumTasks(response.data || []);
    } catch (error) {
      console.error("Nexus communication failure", error);
    }
  };

  const addTask = async (e) => {
    e.preventDefault();
    if (!newTitle) return;
    try {
      const response = await axios.post(`${API_BASE}/api/tasks`, { title: newTitle });
      setQuantumTasks((prev) => [...prev, response.data]);
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
      setQuantumTasks((prev) => prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
    } catch (error) {
      console.error("State transition error", error);
    }
  }, [quantumTasks]);

  const handleDelete = async (id) => {
    try {
      await axios.delete(`${API_BASE}/api/tasks/${id}`);
      setQuantumTasks((prev) => prev.filter(t => t.id !== id));
    } catch (error) {
      console.error("Purge failure", error);
    }
  };

  return (
    <Card>
      <header className="App-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
          <LayoutIcon size={32} />
          <h1 style={{ fontSize: '2.5rem', fontWeight: '800', letterSpacing: '-0.025em' }}>
            Task<span className="text-primary">Nexus</span>
          </h1>
        </div>
        <p style={{ color: 'hsl(var(--text-muted))', marginBottom: '2rem' }}>Current Temporal Stability: 92.1%</p>

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
      <ThemeProvider>
        <BrowserRouter>
          <NotificationProvider>
            <Routes>
              <Route path="/" element={<LandingRoute />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />

              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <LayoutComponent />
                  </ProtectedRoute>
                }
              >
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="workspaces" element={<Workspaces />} />
                <Route path="workspaces/:workspaceId" element={<Projects />} />
                <Route path="projects/:projectId" element={<Tasks />} />
              </Route>

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </NotificationProvider>
        </BrowserRouter>
      </ThemeProvider>
    </AuthProvider>
  );
}

export default App;
