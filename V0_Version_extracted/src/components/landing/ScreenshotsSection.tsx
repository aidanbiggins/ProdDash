import React, { useState, useEffect } from 'react';
import { useInView } from './hooks/useScrollAnimations';

export function ScreenshotsSection() {
  const [headerRef, headerInView] = useInView<HTMLDivElement>({ threshold: 0.2 });
  const [mockupRef, mockupInView] = useInView<HTMLDivElement>({ threshold: 0.2 });
  const [barsAnimated, setBarsAnimated] = useState(false);

  // Simulated dashboard preview with mock data
  const kpis = [
    { label: 'Median TTF', value: '32', unit: 'days', color: 'gold' },
    { label: 'Offers', value: '24', unit: '', color: '' },
    { label: 'Accept Rate', value: '87', unit: '%', color: 'green' },
    { label: 'Stalled Reqs', value: '3', unit: '', color: 'cyan' }
  ];

  // Bar heights for the chart preview
  const barHeights = [45, 72, 58, 85, 63, 78, 92, 68, 55, 80, 73, 88];
  const barColors = ['#f59e0b', '#06b6d4', '#8b5cf6', '#22c55e', '#f59e0b', '#06b6d4',
                     '#8b5cf6', '#22c55e', '#f59e0b', '#06b6d4', '#8b5cf6', '#22c55e'];

  // Animate bars when section comes into view
  useEffect(() => {
    if (mockupInView && !barsAnimated) {
      setTimeout(() => setBarsAnimated(true), 300);
    }
  }, [mockupInView, barsAnimated]);

  return (
    <section className="landing-screenshots">
      <div
        ref={headerRef}
        className={`landing-section-header animate-fade-up ${headerInView ? 'in-view' : ''}`}
      >
        <h2>See Your Pipeline at a Glance</h2>
        <p>
          Real-time dashboards that update as your data changes. No more stale spreadsheets.
        </p>
      </div>
      <div className="landing-screenshot-container">
        <div
          ref={mockupRef}
          className={`landing-screenshot-wrapper animate-scale-up ${mockupInView ? 'in-view' : ''}`}
        >
          <div className="landing-screenshot-mockup glass-card">
            <div className="landing-screenshot-header">
              <span className="landing-screenshot-dot red" />
              <span className="landing-screenshot-dot yellow" />
              <span className="landing-screenshot-dot green" />
            </div>
            <div className="landing-screenshot-content">
              <div className="landing-preview-grid">
                {kpis.map((kpi, index) => (
                  <div
                    key={kpi.label}
                    className={`landing-preview-kpi animate-fade-up ${mockupInView ? 'in-view' : ''}`}
                    style={{ transitionDelay: `${index * 100 + 200}ms` }}
                  >
                    <div className="landing-preview-kpi-label">{kpi.label}</div>
                    <div className={`landing-preview-kpi-value ${kpi.color}`}>
                      {kpi.value}{kpi.unit}
                    </div>
                  </div>
                ))}
                <div
                  className={`landing-preview-chart animate-fade-up ${mockupInView ? 'in-view' : ''}`}
                  style={{ transitionDelay: '500ms' }}
                >
                  <div className="landing-preview-chart-header">Pipeline Velocity (12 weeks)</div>
                  <div className="landing-preview-bars">
                    {barHeights.map((height, index) => (
                      <div
                        key={index}
                        className="landing-preview-bar"
                        style={{
                          height: barsAnimated ? `${height}%` : '0%',
                          background: barColors[index],
                          opacity: 0.8,
                          transition: `height 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) ${index * 50}ms`
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
