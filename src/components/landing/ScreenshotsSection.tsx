import React from 'react';

export function ScreenshotsSection() {
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

  return (
    <section className="landing-screenshots">
      <div className="landing-section-header">
        <h2>See Your Pipeline at a Glance</h2>
        <p>
          Real-time dashboards that update as your data changes. No more stale spreadsheets.
        </p>
      </div>
      <div className="landing-screenshot-container">
        <div className="landing-screenshot-wrapper">
          <div className="landing-screenshot-mockup">
            <div className="landing-screenshot-header">
              <span className="landing-screenshot-dot red" />
              <span className="landing-screenshot-dot yellow" />
              <span className="landing-screenshot-dot green" />
            </div>
            <div className="landing-screenshot-content">
              <div className="landing-preview-grid">
                {kpis.map((kpi) => (
                  <div key={kpi.label} className="landing-preview-kpi">
                    <div className="landing-preview-kpi-label">{kpi.label}</div>
                    <div className={`landing-preview-kpi-value ${kpi.color}`}>
                      {kpi.value}{kpi.unit}
                    </div>
                  </div>
                ))}
                <div className="landing-preview-chart">
                  <div className="landing-preview-chart-header">Pipeline Velocity (12 weeks)</div>
                  <div className="landing-preview-bars">
                    {barHeights.map((height, index) => (
                      <div
                        key={index}
                        className="landing-preview-bar"
                        style={{
                          height: `${height}%`,
                          background: barColors[index],
                          opacity: 0.8
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
