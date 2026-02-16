import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../modules/context/AuthContext';
import { LayoutDashboard, Building2, LogOut, User } from 'lucide-react';

export default function Layout() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <div className="app-layout">
            <aside className="sidebar glass">
                <div className="sidebar-header">
                    <h1 className="sidebar-logo">Task<span className="text-primary">Nexus</span></h1>
                </div>

                <nav className="sidebar-nav">
                    <NavLink to="/" end className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                        <LayoutDashboard size={20} /><span>Dashboard</span>
                    </NavLink>
                    <NavLink to="/workspaces" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                        <Building2 size={20} /><span>Workspaces</span>
                    </NavLink>
                </nav>

                <div className="sidebar-footer">
                    <div className="user-info">
                        <div className="user-avatar"><User size={18} /></div>
                        <div className="user-details">
                            <span className="user-name">{user?.username || user?.data?.username || 'User'}</span>
                            <span className="user-email">{user?.email || user?.data?.email || ''}</span>
                        </div>
                    </div>
                    <button className="btn-ghost logout-btn" onClick={handleLogout}>
                        <LogOut size={18} /><span>Logout</span>
                    </button>
                </div>
            </aside>

            <main className="main-content">
                <Outlet />
            </main>
        </div>
    );
}
