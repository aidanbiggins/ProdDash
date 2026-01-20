import React, { useEffect, useState } from 'react';
import { LogoIcon } from '../LogoIcon';

interface HeroSectionProps {
  onGetStarted: () => void;
  onLearnMore: () => void;
}

export function HeroSection({ onGetStarted, onLearnMore }: HeroSectionProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [viewportSize, setViewportSize] = useState(1200);

  // Trigger entrance animations after mount
  useEffect(() => {
    const timer = setTimeout(() => setIsLoaded(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // Track viewport size for responsive dodecahedron
  useEffect(() => {
    const updateSize = () => {
      // Use the larger dimension to ensure it covers the viewport
      setViewportSize(Math.max(window.innerWidth, window.innerHeight) * 1.2);
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  return (
    <section className="landing-hero">
      {/* Massive dodecahedron - scales to fill viewport, with electrical pulse */}
      <div
        className="hero-dodecahedron"
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: 0.25,
          zIndex: 0,
          pointerEvents: 'none',
          filter: 'blur(0.5px)',
        }}
      >
        <LogoIcon size={viewportSize} pulse={true} />
      </div>

      {/* Main hero content - foreground */}
      <div className={`landing-hero-content ${isLoaded ? 'hero-loaded' : ''}`}>
        <div className={`hero-badge hero-animate-item ${isLoaded ? 'visible' : ''}`} style={{ transitionDelay: '0ms' }}>
          <i className="bi bi-lightning-charge-fill" />
          <span>CSV to insights in under 5 minutes</span>
        </div>

        <h1 className={`hero-animate-item ${isLoaded ? 'visible' : ''}`} style={{ transitionDelay: '100ms' }}>
          Stop Guessing.<br />Start Knowing.
        </h1>

        <p className={`subheadline hero-animate-item ${isLoaded ? 'visible' : ''}`} style={{ transitionDelay: '200ms' }}>
          Your ATS has the data. PlatoVue reveals the story - why reqs stall,
          where candidates drop off, and exactly what to do next.
        </p>

        <div className={`hero-value-props hero-animate-item ${isLoaded ? 'visible' : ''}`} style={{ transitionDelay: '300ms' }}>
          <div className="hero-value-prop">
            <i className="bi bi-check-circle-fill" />
            <span>True metrics (zombie reqs excluded)</span>
          </div>
          <div className="hero-value-prop">
            <i className="bi bi-check-circle-fill" />
            <span>SLA tracking & bottleneck detection</span>
          </div>
          <div className="hero-value-prop">
            <i className="bi bi-check-circle-fill" />
            <span>What-if scenario modeling</span>
          </div>
          <div className="hero-value-prop">
            <i className="bi bi-check-circle-fill" />
            <span>Prioritized action queue</span>
          </div>
        </div>

        <div className={`landing-hero-ctas hero-animate-item ${isLoaded ? 'visible' : ''}`} style={{ transitionDelay: '400ms' }}>
          <button className="landing-cta-primary btn-press ripple-effect" onClick={onGetStarted}>
            Get Started Free
            <i className="bi bi-arrow-right cta-arrow" />
          </button>
          <button className="landing-cta-secondary btn-press" onClick={onLearnMore}>
            See How It Works
            <i className="bi bi-chevron-down cta-chevron" />
          </button>
        </div>

        <p className={`hero-no-credit-card hero-animate-item ${isLoaded ? 'visible' : ''}`} style={{ transitionDelay: '500ms' }}>
          <i className="bi bi-shield-check" />
          No credit card required. Import your own data.
        </p>
      </div>
    </section>
  );
}
