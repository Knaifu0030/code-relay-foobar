import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { FolderKanban, Plus, Trash2, ArrowLeft, Users } from 'lucide-react';
import WorkspaceMembersTab from '../modules/workspace/WorkspaceMembersTab';

const API_BASE = import.meta.env.VITE_API_URL || import.meta.env.API_URL || 'http://localhost:5000/api';

export default function Projects() {
    const { workspaceId } = useParams();
    const navigate = useNavigate();
    const [workspace, setWorkspace] = useState(null);
    const [projects, setProjects] = useState([]);
    const [activeTab, setActiveTab] = useState('projects');
    const [showForm, setShowForm] = useState(false);
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [color, setColor] = useState('#3B82F6');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const token = localStorage.getItem('nexus_token');
        const headers = { Authorization: `Bearer ${token}` };

        Promise.all([
            axios.get(`${API_BASE}/workspaces/${workspaceId}`, { headers }),
            axios.get(`${API_BASE}/projects/workspace/${workspaceId}`, { headers }),
        ])
            .then(([wsRes, projRes]) => {
                setWorkspace(wsRes.data);
                setProjects(projRes.data);
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [workspaceId]);

    const handleCreate = async (e) => {
        e.preventDefault();
        const token = localStorage.getItem('nexus_token');

        try {
            const response = await axios.post(`${API_BASE}/projects`, { name, description, color, workspaceId: parseInt(workspaceId) }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setProjects([...projects, response.data]);
            setName('');
            setDescription('');
            setShowForm(false);
        } catch (err) {
            console.error(err);
        }
    };

    const handleDelete = async (id) => {
        const token = localStorage.getItem('nexus_token');
        try {
            await axios.delete(`${API_BASE}/projects/${id}`, { headers: { Authorization: `Bearer ${token}` } });
            setProjects(projects.filter(p => p.id !== id));
        } catch (err) {
            console.error(err);
        }
    };

    if (loading) {
        return <div className="page-loading"><div className="spinner"></div><p>Loading projects...</p></div>;
    }

    return (
        <div className="page fade-in">
            <div className="page-header">
                <div>
                    <button className="btn-ghost back-btn" onClick={() => navigate('/workspaces')}>
                        <ArrowLeft size={18} /> Back to Workspaces
                    </button>
                    <h2>{workspace?.name || 'Workspace'}</h2>
                    <p className="text-muted">
                        {activeTab === 'projects' ? 'Workspace Projects' : 'Workspace Settings - Members'}
                    </p>
                </div>

                <div className="header-actions">
                    <div className="view-toggle">
                        <button
                            type="button"
                            className={`toggle-btn ${activeTab === 'projects' ? 'active' : ''}`}
                            onClick={() => {
                                setActiveTab('projects');
                                setShowForm(false);
                            }}
                        >
                            <FolderKanban size={15} />
                            Projects
                        </button>
                        <button
                            type="button"
                            className={`toggle-btn ${activeTab === 'members' ? 'active' : ''}`}
                            onClick={() => {
                                setActiveTab('members');
                                setShowForm(false);
                            }}
                        >
                            <Users size={15} />
                            Members
                        </button>
                    </div>

                    {activeTab === 'projects' && (
                        <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
                            <Plus size={18} /> New Project
                        </button>
                    )}
                </div>
            </div>

            {activeTab === 'projects' && (
                <>
                    {showForm && (
                        <form onSubmit={handleCreate} className="create-form glass fade-in">
                            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Project name" required />
                            <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" />
                            <div className="form-actions">
                                <button type="submit" className="btn-primary">Create</button>
                                <button type="button" className="btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
                            </div>
                        </form>
                    )}

                    <div className="project-grid">
                        {projects.map(proj => (
                            <div key={proj.id} className="project-card glass" onClick={() => navigate(`/projects/${proj.id}`)} style={{ borderLeft: `4px solid ${proj.color}` }}>
                                <div className="project-card-header">
                                    <FolderKanban size={20} style={{ color: proj.color }} />
                                    <button className="btn-icon-danger" onClick={(e) => { e.stopPropagation(); handleDelete(proj.id); }}>
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                                <h3>{proj.name}</h3>
                                <p className="text-muted">{proj.description || 'No description'}</p>
                                <div className="project-card-footer">
                                    <div className="progress-bar">
                                        <div className="progress-fill" style={{ width: `${proj.task_count ? (proj.completed_count / proj.task_count) * 100 : 0}%`, backgroundColor: proj.color }}></div>
                                    </div>
                                    <span className="text-muted text-sm">{proj.completed_count}/{proj.task_count} tasks</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}

            {activeTab === 'members' && <WorkspaceMembersTab workspaceId={workspaceId} workspaceRole={workspace?.role} />}
        </div>
    );
}
