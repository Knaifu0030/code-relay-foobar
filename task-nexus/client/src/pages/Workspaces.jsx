import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Building2, Plus, Users, Trash2, ChevronRight } from 'lucide-react';

const API_BASE = 'http://localhost:5000/api';

export default function Workspaces() {
    const [workspaces, setWorkspaces] = useState();
    const [showForm, setShowForm] = useState(false);
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        const token = localStorage.getItem('nexus_token');
        axios.get(`${API_BASE}/workspaces`, {
            headers: { Authorization: `Bearer ${token}` }
        })
            .then(response => setWorkspaces(response.data))
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    const handleCreate = async (e) => {
        e.preventDefault();
        if (!name.trim()) return;
        const token = localStorage.getItem('nexus_token');

        try {
            const response = await axios.post(`${API_BASE}/workspaces`, { name, description }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setWorkspaces([...workspaces, response.data]);
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
            await axios.delete(`${API_BASE}/workspaces/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setWorkspaces(workspaces.filter(w => w.id !== id));
        } catch (err) {
            console.error(err);
        }
    };

    if (loading) {
        return <div className="page-loading"><div className="spinner"></div><p>Loading workspaces...</p></div>;
    }

    return (
        <div className="page fade-in">
            <div className="page-header">
                <div>
                    <h2>Workspaces</h2>
                    <p className="text-muted">Organize your team projects</p>
                </div>
                <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
                    <Plus size={18} /> New Workspace
                </button>
            </div>

            {showForm && (
                <form onSubmit={handleCreate} className="create-form glass fade-in">
                    <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Workspace name" required />
                    <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (optional)" />
                    <div className="form-actions">
                        <button type="submit" className="btn-primary">Create</button>
                        <button type="button" className="btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
                    </div>
                </form>
            )}

            <div className="workspace-grid">
                {workspaces?.map(ws => (
                    <div key={ws.id} className="workspace-card glass" onClick={() => navigate(`/workspaces/${ws.id}`)}>
                        <div className="workspace-card-header">
                            <div className="workspace-icon"><Building2 size={24} /></div>
                            <button className="btn-icon-danger" onClick={(e) => { e.stopPropagation(); handleDelete(ws.id); }}>
                                <Trash2 size={16} />
                            </button>
                        </div>
                        <h3>{ws.name}</h3>
                        <p className="text-muted">{ws.description || 'No description'}</p>
                        <div className="workspace-card-footer">
                            <span className="badge"><Users size={14} /> {ws.role}</span>
                            <ChevronRight size={18} className="text-muted" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
