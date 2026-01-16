import React from 'react';

interface HeroSectionProps {
  onGetStarted: () => void;
  onLearnMore: () => void;
}

export function HeroSection({ onGetStarted, onLearnMore }: HeroSectionProps) {
  return (
    <section className="landing-hero">
      <div className="landing-hero-content">
        <h1>Recruiting Intelligence for Modern TA Teams</h1>
        <p className="subheadline">
          Turn ATS data into actionable insights. Track time-to-fill, identify bottlenecks,
          and forecast hiring outcomes with AI-powered analytics.
        </p>
        <div className="landing-hero-ctas">
          <button className="landing-cta-primary" onClick={onGetStarted}>
            Get Started Free
            <i className="bi bi-arrow-right" />
          </button>
          <button className="landing-cta-secondary" onClick={onLearnMore}>
            See Features
            <i className="bi bi-chevron-down" />
          </button>
        </div>
      </div>
    </section>
  );
}
