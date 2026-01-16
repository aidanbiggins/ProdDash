import React from 'react';

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
    title: 'Import to ProdDash',
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
  return (
    <section className="landing-how-it-works">
      <div className="landing-section-header">
        <span className="landing-section-eyebrow">How It Works</span>
        <h2>From Export to Insight in Under 5 Minutes</h2>
        <p>
          No integrations to build. No IT tickets to file. Just export, import, and see.
        </p>
      </div>

      <div className="landing-steps">
        {steps.map((step, index) => (
          <React.Fragment key={step.number}>
            <div className="landing-step">
              <div className="step-icon">
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
              <div className="step-connector">
                <i className="bi bi-arrow-right" />
              </div>
            )}
          </React.Fragment>
        ))}
      </div>

      <div className="landing-supported-systems">
        <p className="supported-label">Works with exports from:</p>
        <div className="supported-logos">
          <span className="supported-logo">iCIMS</span>
          <span className="supported-logo">Greenhouse</span>
          <span className="supported-logo">Lever</span>
          <span className="supported-logo">Workday</span>
          <span className="supported-logo">+ Any CSV</span>
        </div>
      </div>
    </section>
  );
}
