import React from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { LayoutDashboard, FolderKanban, LogOut, Moon, Sun } from "lucide-react";
import { useAuth } from "./context/AuthContext";
import { useTheme } from "./context/ThemeContext";
import NotificationBell from "../components/notifications/NotificationBell";

export default function Layout() {
  const navigate = useNavigate();
  const auth = useAuth();
  const { theme, toggleTheme } = useTheme();

  const user = auth?.user;
  const logoutFn =
    auth?.logout ||
    (() => {
      localStorage.removeItem("nexus_token");
      navigate("/login");
    });

  return (
    <div className="app-layout">
      <aside className="sidebar glass">
        <div className="sidebar-header">
          <div className="sidebar-header-row">
            <div className="sidebar-logo">
              Task<span className="text-primary">Nexus</span>
            </div>

            <button
              className="theme-toggle-btn"
              onClick={toggleTheme}
              title={theme === "light" ? "Switch to Dark" : "Switch to Light"}
              aria-label="Toggle theme"
              type="button"
            >
              {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
            </button>
          </div>
        </div>

        <nav className="sidebar-nav">
          <NavLink to="/dashboard" end className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}>
            <LayoutDashboard size={18} />
            <span>Dashboard</span>
          </NavLink>

          <NavLink to="/workspaces" className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}>
            <FolderKanban size={18} />
            <span>Workspaces</span>
          </NavLink>
        </nav>

        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-avatar">{(user?.username?.[0] || "U").toUpperCase()}</div>
            <div className="user-details">
              <div className="user-name">{user?.username || "User"}</div>
              <div className="user-email">{user?.email || ""}</div>
            </div>
          </div>

          <button className="btn-ghost logout-btn" onClick={logoutFn} type="button">
            <LogOut size={18} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      <main className="main-content">
        <header className="top-navbar glass">
          <div className="top-navbar-title-group">
            <p className="top-navbar-label">TaskNexus</p>
            <h1 className="top-navbar-title">Command Center</h1>
          </div>
          <div className="top-navbar-actions">
            <NotificationBell />
          </div>
        </header>

        <section className="main-scroll-content">
          <Outlet />
        </section>
      </main>
    </div>
  );
}
