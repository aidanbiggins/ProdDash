import React from 'react';
import { useInView } from './hooks/useScrollAnimations';

interface CTASectionProps {
  onGetStarted: () => void;
}

export function CTASection({ onGetStarted }: CTASectionProps) {
  const [ref, isInView] = useInView<HTMLDivElement>({ threshold: 0.3 });

  return (
    <section className="landing-final-cta">
      <div
        ref={ref}
        className={`landing-final-cta-content animate-blur-in ${isInView ? 'in-view' : ''}`}
      >
        <h2>Ready to Transform Your Recruiting Analytics?</h2>
        <p>
          Import your ATS data and get insights in minutes. No credit card required.
        </p>
        <button className="landing-cta-primary btn-press ripple-effect" onClick={onGetStarted}>
          Start Free Today
          <i className="bi bi-arrow-right cta-arrow" />
        </button>
      </div>
    </section>
  );
}
