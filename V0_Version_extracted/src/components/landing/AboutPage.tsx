import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { NetworkBackground } from './NetworkBackground';
import { useScrollProgress } from './hooks/useScrollAnimations';
import { LogoHero } from '../LogoHero';
import './landing-page.css';
import './landing-animations.css';

export function AboutPage() {
  const scrollProgress = useScrollProgress();
  const [navScrolled, setNavScrolled] = useState(false);

  // Set document title
  useEffect(() => {
    document.title = 'About | PlatoVue';
    return () => {
      document.title = 'PlatoVue';
    };
  }, []);

  // Update nav style based on scroll
  useEffect(() => {
    const handleScroll = () => {
      setNavScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="landing-page">
      {/* Network background */}
      <NetworkBackground scrollProgress={scrollProgress} />

      {/* Scroll progress indicator */}
      <div
        className="scroll-progress-bar"
        style={{ transform: `scaleX(${scrollProgress})` }}
      />

      {/* Navigation */}
      <nav className={`landing-nav ${navScrolled ? 'nav-scrolled' : ''}`}>
        <div className="landing-nav-inner">
          <Link to="/" className="landing-logo" style={{ textDecoration: 'none' }}>
            <LogoHero />
          </Link>
          <div className="landing-nav-links">
            <Link to="/" className="landing-nav-link">
              Home
            </Link>
            <Link to="/about" className="landing-nav-link active">
              About
            </Link>
          </div>
          <Link to="/login" className="landing-nav-cta">
            Sign In
          </Link>
        </div>
      </nav>

      {/* About Content */}
      <main className="about-page-content">
        <header className="about-hero">
          <h1>Recruiting is not a dashboard problem.<br />It's an operating system problem.</h1>
        </header>

        <section className="about-section about-intro">
          <div className="about-section-inner">
            <p className="about-lead">
              Most hiring teams aren't failing because they lack effort. They're failing because they lack signal.
            </p>
            <p>
              Time-to-fill becomes a scoreboard. Pipeline health gets guessed. Hiring managers are "reminded" instead of held to a clear process. And every week, someone screenshots charts into a deck and calls it strategy.
            </p>
            <p className="about-emphasis">
              PlatoVue was built to change that.
            </p>
          </div>
        </section>

        <section className="about-section">
          <div className="about-section-inner">
            <h2>What PlatoVue is</h2>
            <p>
              PlatoVue is a recruiting intelligence system that turns messy ATS exports into:
            </p>
            <ul className="about-feature-list">
              <li>
                <i className="bi bi-speedometer2" />
                <span>A <strong>control tower</strong> for what's on fire right now</span>
              </li>
              <li>
                <i className="bi bi-search" />
                <span>A <strong>diagnosis engine</strong> that explains why it's happening, with evidence</span>
              </li>
              <li>
                <i className="bi bi-sliders" />
                <span>A <strong>planning layer</strong> that models what happens if you change something</span>
              </li>
              <li>
                <i className="bi bi-lightning-charge" />
                <span>An <strong>action system</strong> that turns insight into next steps</span>
              </li>
            </ul>
            <p className="about-note">
              If the data is complete, the analysis is deep. If the data is messy, PlatoVue adapts and only shows what's defensible.
            </p>
          </div>
        </section>

        <section className="about-section about-different">
          <div className="about-section-inner">
            <h2>What makes it different</h2>

            <div className="about-diff-grid">
              <article className="about-diff-card glass-card">
                <h3>It doesn't guess</h3>
                <p>
                  PlatoVue doesn't invent precision. It uses coverage and confidence rules to determine what it can and can't say. When a metric is not supported by your data, it's gated — not faked.
                </p>
              </article>

              <article className="about-diff-card glass-card">
                <h3>It explains, then it acts</h3>
                <p>
                  Every number can be traced back to underlying drivers. Every insight can create an action. This is built for real operations, not reporting.
                </p>
              </article>

              <article className="about-diff-card glass-card">
                <h3>It handles dirty data on purpose</h3>
                <p>
                  Real ATS data is noisy. Columns are inconsistent. Statuses are messy. Dates are missing. PlatoVue ingests what you have, heals what it can, and guides you to unlock deeper capabilities if you want them.
                </p>
              </article>

              <article className="about-diff-card glass-card">
                <h3>Local-first options for sensitive teams</h3>
                <p>
                  Some teams will never be comfortable uploading recruiting data to a third-party system. PlatoVue supports modes that keep data local while still delivering useful analysis.
                </p>
              </article>

              <article className="about-diff-card glass-card">
                <h3>Optional AI, with guardrails</h3>
                <p>
                  If you want AI help, PlatoVue supports bring-your-own-key and multiple providers. AI never computes the facts. It helps with summaries, drafts, narratives, and decision framing — grounded in deterministic outputs.
                </p>
              </article>
            </div>
          </div>
        </section>

        <section className="about-section">
          <div className="about-section-inner">
            <h2>Who it's for</h2>
            <p>PlatoVue is built for:</p>
            <ul className="about-audience-list">
              <li>
                <strong>Talent leaders</strong> who need to answer "Are we on track?" with confidence
              </li>
              <li>
                <strong>Recruiting Ops teams</strong> who want to find bottlenecks and fix systems
              </li>
              <li>
                <strong>Recruiters</strong> who want clarity and leverage, not more busywork
              </li>
              <li>
                <strong>Hiring managers</strong> who want a clean process and faster outcomes
              </li>
            </ul>
          </div>
        </section>

        <section className="about-section about-beliefs">
          <div className="about-section-inner">
            <h2>What we believe</h2>
            <ul className="about-beliefs-list">
              <li>
                <span className="belief-title">Truth beats polish.</span>
                <span className="belief-desc">If it can't be defended, it shouldn't be shown.</span>
              </li>
              <li>
                <span className="belief-title">Work should be measurable.</span>
                <span className="belief-desc">Not just hires, but effort, friction, and constraints.</span>
              </li>
              <li>
                <span className="belief-title">Systems beat heroics.</span>
                <span className="belief-desc">Good recruiting is operational excellence, not hustle.</span>
              </li>
              <li>
                <span className="belief-title">Clarity is kindness.</span>
                <span className="belief-desc">The product should reduce conflict, not create it.</span>
              </li>
            </ul>
          </div>
        </section>

        <section className="about-section about-vision">
          <div className="about-section-inner">
            <h2>Where this is going</h2>
            <p>The long-term vision is simple:</p>
            <p className="about-vision-statement">
              A recruiting system that can tell you:
            </p>
            <ul className="about-vision-list">
              <li>what will happen</li>
              <li>why it will happen</li>
              <li>what to do next</li>
              <li>how confident it is</li>
              <li>and what data would make it smarter</li>
            </ul>
            <p className="about-cta-text">
              If that sounds like the tool you've always wanted, you're in the right place.
            </p>
            <div className="about-cta-buttons">
              <Link to="/login" className="landing-cta-primary btn-press ripple-effect">
                Get Started Free
                <i className="bi bi-arrow-right cta-arrow" />
              </Link>
              <Link to="/" className="landing-cta-secondary btn-press">
                See How It Works
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <div className="footer-brand">
            <LogoHero size="sm" />
          </div>
          <p className="footer-tagline">
            Recruiting Intelligence for Modern TA Teams
          </p>
          <p className="footer-copyright">
            Built for TA leaders who are tired of spreadsheets.
          </p>
        </div>
      </footer>
    </div>
  );
}

export default AboutPage;
