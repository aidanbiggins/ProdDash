import React, { useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { HeroSection } from './HeroSection';
import { FeaturesSection } from './FeaturesSection';
import { ScreenshotsSection } from './ScreenshotsSection';
import { CTASection } from './CTASection';
import './landing-page.css';

export function LandingPage() {
  const navigate = useNavigate();
  const featuresRef = useRef<HTMLElement>(null);

  const handleGetStarted = () => {
    navigate('/login');
  };

  const handleLearnMore = () => {
    featuresRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="landing-page">
      {/* Navigation */}
      <nav className="landing-nav">
        <div className="landing-nav-inner">
          <Link to="/" className="landing-logo">
            <span className="landing-logo-icon">
              <i className="bi bi-speedometer2" />
            </span>
            ProdDash
          </Link>
          <Link to="/login" className="landing-nav-cta">
            Sign In
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <HeroSection onGetStarted={handleGetStarted} onLearnMore={handleLearnMore} />

      {/* Features */}
      <FeaturesSection sectionRef={featuresRef} />

      {/* Screenshots */}
      <ScreenshotsSection />

      {/* Final CTA */}
      <CTASection onGetStarted={handleGetStarted} />

      {/* Footer */}
      <footer className="landing-footer">
        <p>ProdDash - Recruiting Intelligence Platform</p>
      </footer>
    </div>
  );
}

export default LandingPage;
