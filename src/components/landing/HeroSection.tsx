import React from 'react';

interface HeroSectionProps {
  onGetStarted: () => void;
  onLearnMore: () => void;
}

// Background floating data elements - these create the "data ambient" effect
const floatingElements = [
  // KPI Stats - primary metrics
  { type: 'stat', value: '41d', label: 'TRUE TTF', color: 'green', position: 'top-left-1' },
  { type: 'stat', value: '87%', label: 'ACCEPT RATE', color: 'green', position: 'top-right-1' },
  { type: 'stat', value: '24', label: 'OFFERS', color: 'gold', position: 'mid-right-1' },
  { type: 'stat', value: '2.1d', label: 'HM LATENCY', color: 'cyan', position: 'bottom-right-1' },
  { type: 'stat', value: '86', label: 'ACTIVE REQS', color: 'white', position: 'mid-left-1' },
  { type: 'stat', value: '18.3', label: 'FORECAST', color: 'violet', position: 'bottom-left-2' },

  // Additional stats for depth
  { type: 'stat', value: '4.2x', label: 'PIPELINE RATIO', color: 'cyan', position: 'outer-top-left' },
  { type: 'stat', value: '92%', label: 'INTERVIEW RATE', color: 'green', position: 'outer-top-right' },
  { type: 'stat', value: '3.8d', label: 'AVG STAGE TIME', color: 'gold', position: 'outer-mid-left' },
  { type: 'stat', value: '147', label: 'CANDIDATES', color: 'white', position: 'outer-mid-right' },
  { type: 'stat', value: '8.2d', label: 'FEEDBACK LAG', color: 'red', position: 'outer-bottom-left' },
  { type: 'stat', value: '73%', label: 'SOURCED', color: 'violet', position: 'outer-bottom-right' },

  // Alerts
  { type: 'alert', text: '3 offers at risk', color: 'red', position: 'bottom-left-1' },
  { type: 'alert', text: 'Pipeline gap: 6.7 reqs', color: 'gold', position: 'top-right-2' },
  { type: 'alert', text: 'HM feedback overdue', color: 'gold', position: 'mid-left-2' },
  { type: 'alert', text: 'Zombie req detected', color: 'red', position: 'deep-left-1' },
  { type: 'alert', text: 'Ghost candidate: 12', color: 'gold', position: 'deep-right-1' },

  // Actions
  { type: 'action', text: 'Follow up: Jane Smith', priority: 'P0', position: 'bottom-right-2' },
  { type: 'action', text: 'Source: REQ-5678', priority: 'P1', position: 'top-left-2' },
  { type: 'action', text: 'Review: 5 resumes', priority: 'P1', position: 'deep-left-2' },
  { type: 'action', text: 'Close: REQ-2341', priority: 'P0', position: 'deep-right-2' },

  // Stage badges
  { type: 'stage', text: 'SCREEN', color: 'cyan', position: 'far-left-1' },
  { type: 'stage', text: 'ONSITE', color: 'gold', position: 'far-right-1' },
  { type: 'stage', text: 'OFFER', color: 'green', position: 'far-right-2' },
  { type: 'stage', text: 'HM REVIEW', color: 'violet', position: 'far-left-2' },
  { type: 'stage', text: 'APPLIED', color: 'cyan', position: 'corner-top-left' },
  { type: 'stage', text: 'HIRED', color: 'green', position: 'corner-bottom-right' },

  // Mini charts (represented as bar indicators)
  { type: 'chart', bars: [40, 65, 55, 80, 70], position: 'bottom-mid-1' },
  { type: 'chart', bars: [30, 45, 60, 50, 75, 85], position: 'top-mid-1' },
  { type: 'chart', bars: [55, 70, 45, 85, 60, 75], position: 'mid-mid-left' },
  { type: 'chart', bars: [25, 50, 80, 65, 40], position: 'mid-mid-right' },
];

export function HeroSection({ onGetStarted, onLearnMore }: HeroSectionProps) {
  return (
    <section className="landing-hero">
      {/* Background floating data layer - behind everything */}
      <div className="hero-background-data">
        {floatingElements.map((el, index) => (
          <div
            key={index}
            className={`bg-data-element ${el.type} ${el.position}`}
            style={{ animationDelay: `${index * 0.5}s` }}
          >
            {el.type === 'stat' && (
              <>
                <span className={`bg-stat-value ${el.color}`}>{el.value}</span>
                <span className="bg-stat-label">{el.label}</span>
              </>
            )}
            {el.type === 'alert' && (
              <>
                <span className={`bg-alert-dot ${el.color}`} />
                <span className="bg-alert-text">{el.text}</span>
              </>
            )}
            {el.type === 'action' && (
              <>
                <span className={`bg-action-priority ${el.priority?.toLowerCase()}`}>{el.priority}</span>
                <span className="bg-action-text">{el.text}</span>
              </>
            )}
            {el.type === 'stage' && (
              <span className={`bg-stage-badge ${el.color}`}>{el.text}</span>
            )}
            {el.type === 'chart' && (
              <div className="bg-mini-chart">
                {el.bars?.map((height, i) => (
                  <div key={i} className="bg-chart-bar" style={{ height: `${height}%` }} />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Main hero content - foreground */}
      <div className="landing-hero-content">
        <div className="hero-badge">
          <i className="bi bi-lightning-charge-fill" />
          <span>CSV to insights in under 5 minutes</span>
        </div>

        <h1>Stop Guessing.<br />Start Knowing.</h1>

        <p className="subheadline">
          Your ATS has the data. ProdDash reveals the story - why reqs stall,
          where candidates drop off, and exactly what to do next.
        </p>

        <div className="hero-value-props">
          <div className="hero-value-prop">
            <i className="bi bi-check-circle-fill" />
            <span>True metrics (zombie reqs excluded)</span>
          </div>
          <div className="hero-value-prop">
            <i className="bi bi-check-circle-fill" />
            <span>HM accountability scorecards</span>
          </div>
          <div className="hero-value-prop">
            <i className="bi bi-check-circle-fill" />
            <span>Prioritized action queue</span>
          </div>
        </div>

        <div className="landing-hero-ctas">
          <button className="landing-cta-primary" onClick={onGetStarted}>
            Get Started Free
            <i className="bi bi-arrow-right" />
          </button>
          <button className="landing-cta-secondary" onClick={onLearnMore}>
            See How It Works
            <i className="bi bi-chevron-down" />
          </button>
        </div>

        <p className="hero-no-credit-card">
          <i className="bi bi-shield-check" />
          No credit card required. Import your own data.
        </p>
      </div>
    </section>
  );
}
