import React from 'react';
import { useInView } from './hooks/useScrollAnimations';

interface Step {
  number: number;
  title: string;
  description: string;
  time: string;
  icon: string;
}

const steps: Step[] = [
  {
    number: 1,
    title: 'Export from Your ATS',
    description: 'Pull a standard CSV export from iCIMS, Greenhouse, Lever, Workday, or any ATS. No special setup required.',
    time: '2 min',
    icon: 'bi-download'
  },
  {
    number: 2,
    title: 'Import to PlatoVue',
    description: 'Drag and drop your file. We auto-detect columns, report type, and date formats. No manual mapping.',
    time: '30 sec',
    icon: 'bi-cloud-upload'
  },
  {
    number: 3,
    title: 'See Your Insights',
    description: 'Immediately see true metrics, prioritized risks, and specific actions. No waiting, no building reports.',
    time: 'Instant',
    icon: 'bi-lightning-charge'
  }
];

export function HowItWorksSection() {
  const [headerRef, headerInView] = useInView<HTMLDivElement>({ threshold: 0.2 });
  const [stepsRef, stepsInView] = useInView<HTMLDivElement>({ threshold: 0.1 });
  const [logosRef, logosInView] = useInView<HTMLDivElement>({ threshold: 0.3 });

  return (
    <section className="landing-how-it-works">
      <div
        ref={headerRef}
        className={`landing-section-header animate-fade-up ${headerInView ? 'in-view' : ''}`}
      >
        <span className="landing-section-eyebrow">How It Works</span>
        <h2>From Export to Insight in Under 5 Minutes</h2>
        <p>
          No integrations to build. No IT tickets to file. Just export, import, and see.
        </p>
      </div>

      <div ref={stepsRef} className="landing-steps">
        {steps.map((step, index) => (
          <React.Fragment key={step.number}>
            <div
              className={`landing-step glass-card glass-card-interactive animate-scale-up ${stepsInView ? 'in-view' : ''}`}
              style={{ transitionDelay: `${index * 150}ms` }}
            >
              <div className="step-icon icon-bounce">
                <i className={step.icon} />
              </div>
              <div className="step-number">{step.number}</div>
              <h3>{step.title}</h3>
              <p>{step.description}</p>
              <div className="step-time">
                <i className="bi bi-clock" />
                {step.time}
              </div>
            </div>
            {index < steps.length - 1 && (
              <div
                className={`step-connector animate-fade-up ${stepsInView ? 'in-view' : ''}`}
                style={{ transitionDelay: `${index * 150 + 75}ms` }}
              >
                <svg
                  className="connector-chevron"
                  viewBox="0 0 48 80"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    className="chevron-bg"
                    d="M4 4L40 40L4 76"
                    stroke="currentColor"
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    className="chevron-glow"
                    d="M4 4L40 40L4 76"
                    stroke="currentColor"
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            )}
          </React.Fragment>
        ))}
      </div>

      <div
        ref={logosRef}
        className={`landing-supported-systems animate-fade-up ${logosInView ? 'in-view' : ''}`}
      >
        <p className="supported-label">Works with exports from:</p>
        <div className="supported-logos">
          {['iCIMS', 'Greenhouse', 'Lever', 'Workday', '+ Any CSV'].map((logo, i) => (
            <span
              key={logo}
              className={`supported-logo hover-lift animate-scale-up ${logosInView ? 'in-view' : ''}`}
              style={{ transitionDelay: `${i * 80}ms` }}
            >
              {logo}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
