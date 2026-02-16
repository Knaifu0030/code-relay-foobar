import React from 'react';
import { Link } from 'react-router-dom';
import { Building2, FolderKanban, ShieldCheck } from 'lucide-react';
import Hero from '../components/Hero';

const highlights = [
  {
    title: 'Workspace Collaboration',
    description: 'Keep teams organized with shared workspaces, role clarity, and project-level ownership.',
    icon: Building2,
  },
  {
    title: 'Project Execution',
    description: 'Break work into actionable tasks and track progress through every stage with confidence.',
    icon: FolderKanban,
  },
  {
    title: 'Reliable Workflow',
    description: 'Centralize updates and status in one source of truth for smoother delivery.',
    icon: ShieldCheck,
  },
];

export default function Landing() {
  return (
    <div className="landing-page">
      <div className="landing-container">
        <header className="landing-header fade-in">
          <h2 className="landing-brand">
            Task<span className="text-primary">Nexus</span>
          </h2>

          <div className="landing-header-actions">
            <Link to="/login" className="btn-ghost landing-login-btn">
              Login
            </Link>
            <Link to="/register" className="btn-primary">
              Get Started
            </Link>
          </div>
        </header>

        <Hero />

        <section className="landing-highlights">
          {highlights.map((item, index) => (
            <article key={item.title} className={`landing-highlight-card stat-card glass fade-in landing-delay-${index + 1}`}>
              <div className="landing-highlight-icon">
                <item.icon size={20} />
              </div>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </article>
          ))}
        </section>
      </div>
    </div>
  );
}
