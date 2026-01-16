import React from 'react';

interface CTASectionProps {
  onGetStarted: () => void;
}

export function CTASection({ onGetStarted }: CTASectionProps) {
  return (
    <section className="landing-final-cta">
      <div className="landing-final-cta-content">
        <h2>Ready to Transform Your Recruiting Analytics?</h2>
        <p>
          Import your ATS data and get insights in minutes. No credit card required.
        </p>
        <button className="landing-cta-primary" onClick={onGetStarted}>
          Start Free Today
          <i className="bi bi-arrow-right" />
        </button>
      </div>
    </section>
  );
}
