import React, { useRef, useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { HeroSection } from './HeroSection';
import { ProblemSection } from './ProblemSection';
import { DataTransformSection } from './DataTransformSection';
import { HowItWorksSection } from './HowItWorksSection';
import { FeaturesSection } from './FeaturesSection';
import { MetricsShowcase } from './MetricsShowcase';
import { ScreenshotsSection } from './ScreenshotsSection';
import { CTASection } from './CTASection';
import { useScrollProgress } from './hooks/useScrollAnimations';
import './landing-page.css';
import './landing-animations.css';

export function LandingPage() {
  const navigate = useNavigate();
  const problemRef = useRef<HTMLElement>(null);
  const featuresRef = useRef<HTMLElement>(null);
  const scrollProgress = useScrollProgress();
  const [navScrolled, setNavScrolled] = useState(false);

  // Update nav style based on scroll
  useEffect(() => {
    const handleScroll = () => {
      setNavScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleGetStarted = () => {
    navigate('/login');
  };

  const handleLearnMore = () => {
    problemRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="landing-page">
      {/* Scroll progress indicator */}
      <div
        className="scroll-progress-bar"
        style={{ transform: `scaleX(${scrollProgress})` }}
      />
      {/* Navigation */}
      <nav className={`landing-nav ${navScrolled ? 'nav-scrolled' : ''}`}>
        <div className="landing-nav-inner">
          <Link to="/" className="landing-logo">
            <span className="landing-logo-icon">
              <i className="bi bi-speedometer2" />
            </span>
            ProdDash
          </Link>
          <div className="landing-nav-links">
            <button
              className="landing-nav-link"
              onClick={() => problemRef.current?.scrollIntoView({ behavior: 'smooth' })}
            >
              Why ProdDash
            </button>
            <button
              className="landing-nav-link"
              onClick={() => featuresRef.current?.scrollIntoView({ behavior: 'smooth' })}
            >
              Features
            </button>
          </div>
          <Link to="/login" className="landing-nav-cta">
            Sign In
          </Link>
        </div>
      </nav>

      {/* Hero - The Hook */}
      <HeroSection onGetStarted={handleGetStarted} onLearnMore={handleLearnMore} />

      {/* Problem - Why This Matters */}
      <section ref={problemRef}>
        <ProblemSection />
      </section>

      {/* Data Transformation - How It Works (Visual) */}
      <DataTransformSection />

      {/* How It Works - The Process (Steps) */}
      <HowItWorksSection />

      {/* Features - What You Get */}
      <FeaturesSection sectionRef={featuresRef} />

      {/* Metrics Showcase - The Difference */}
      <MetricsShowcase />

      {/* Screenshots - See It In Action */}
      <ScreenshotsSection />

      {/* Final CTA */}
      <CTASection onGetStarted={handleGetStarted} />

      {/* Footer */}
      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <div className="footer-brand">
            <span className="landing-logo-icon small">
              <i className="bi bi-speedometer2" />
            </span>
            <span>ProdDash</span>
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

export default LandingPage;
