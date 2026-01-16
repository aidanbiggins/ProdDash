import React from 'react';

interface Feature {
  icon: string;
  title: string;
  description: string;
  iconColor: 'gold' | 'cyan' | 'violet' | 'green';
}

const features: Feature[] = [
  {
    icon: 'bi-speedometer2',
    title: 'Control Tower',
    description: 'Executive command center with real-time KPIs, risk alerts, and unified action queues for recruiters and hiring managers.',
    iconColor: 'gold'
  },
  {
    icon: 'bi-people',
    title: 'HM Friction Analysis',
    description: 'Identify hiring manager bottlenecks with feedback latency tracking. See who is slowing down your pipeline.',
    iconColor: 'cyan'
  },
  {
    icon: 'bi-database-check',
    title: 'Data Health',
    description: 'Clean data for accurate metrics. Automatically detect zombie reqs, ghost candidates, and calculate true time-to-fill.',
    iconColor: 'green'
  },
  {
    icon: 'bi-robot',
    title: 'AI Copilot',
    description: 'Bring your own AI key for summaries, explanations, and draft communications. Your keys, your data, your control.',
    iconColor: 'violet'
  },
  {
    icon: 'bi-chat-dots',
    title: 'Ask ProdDash',
    description: 'Conversational interface to query your recruiting data. Ask questions in plain English, get instant answers.',
    iconColor: 'cyan'
  },
  {
    icon: 'bi-graph-up-arrow',
    title: 'Forecasting',
    description: 'Pipeline-based hiring predictions with confidence scoring. Plan capacity and identify risk before it impacts results.',
    iconColor: 'gold'
  }
];

interface FeaturesSectionProps {
  sectionRef: React.RefObject<HTMLElement | null>;
}

export function FeaturesSection({ sectionRef }: FeaturesSectionProps) {
  return (
    <section className="landing-features" ref={sectionRef}>
      <div className="landing-section-header">
        <h2>Everything You Need to Run Recruiting</h2>
        <p>
          From high-level KPIs to individual candidate tracking, ProdDash gives you
          complete visibility into your recruiting pipeline.
        </p>
      </div>
      <div className="landing-features-grid">
        {features.map((feature) => (
          <div key={feature.title} className="landing-feature-card">
            <div className={`landing-feature-icon ${feature.iconColor}`}>
              <i className={feature.icon} />
            </div>
            <h3>{feature.title}</h3>
            <p>{feature.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
