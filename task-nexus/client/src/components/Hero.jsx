import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2 } from 'lucide-react';

export default function Hero() {
  return (
    <section className="landing-hero glass stat-card fade-in">
      <p className="landing-kicker">TaskNexus Workspace OS</p>
      <h1 className="landing-title">Plan. Track. Succeed.</h1>
      <p className="landing-subtitle">
        Keep workspace collaboration aligned with shared projects, clear ownership, and live task visibility across your team.
      </p>

      <div className="landing-cta">
        <Link to="/register" className="btn-primary">
          Get Started
          <ArrowRight size={16} />
        </Link>
        <Link to="/login" className="btn-ghost landing-login-btn">
          Login
        </Link>
      </div>

      <div className="landing-proof text-sm">
        <CheckCircle2 size={16} />
        <span>Built for fast-moving teams that need clarity and accountability.</span>
      </div>
    </section>
  );
}
