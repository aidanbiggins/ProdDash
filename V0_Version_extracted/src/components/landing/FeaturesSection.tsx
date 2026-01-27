import React, { useState } from 'react';
import { useInView } from './hooks/useScrollAnimations';

interface Feature {
  icon: string;
  title: string;
  tagline: string;
  description: string;
  whyItMatters: string;
  example: string;
  iconColor: 'gold' | 'cyan' | 'violet' | 'green';
}

const features: Feature[] = [
  {
    icon: 'bi-speedometer2',
    title: 'Control Tower',
    tagline: 'Your command center',
    description: 'Executive dashboard showing the 5 most critical KPIs with red/yellow/green status, top risks, and a unified action queue.',
    whyItMatters: 'Know in 30 seconds if you\'re on track or if something needs your attention. Stop digging through spreadsheets for answers.',
    example: '"3 offers pending over 7 days - candidates will accept elsewhere if no action today"',
    iconColor: 'gold'
  },
  {
    icon: 'bi-stopwatch',
    title: 'Bottlenecks & SLAs',
    tagline: 'Track every delay',
    description: 'SLA breach tracking by stage and owner. See which stages consistently miss targets and who is responsible for the delays.',
    whyItMatters: 'Accountability requires visibility. Know exactly where candidates get stuck, how long they wait, and who needs to take action.',
    example: '"HM Review stage: 43% breach rate, 8.2 day median (SLA: 3 days) - Engineering team is 2x slower than Sales"',
    iconColor: 'cyan'
  },
  {
    icon: 'bi-people',
    title: 'HM Friction Analysis',
    tagline: 'Find the bottleneck',
    description: 'Identify which hiring managers are slowing down your pipeline with feedback latency tracking and accountability scorecards.',
    whyItMatters: '80% of preventable candidate drop-off happens while waiting for HM feedback. Now you can see exactly who and how long.',
    example: '"Mike Johnson: 8.2 day avg feedback time (team avg: 2.1 days) - 12 candidates waiting"',
    iconColor: 'cyan'
  },
  {
    icon: 'bi-sliders',
    title: 'What-If Simulator',
    tagline: 'Plan before you act',
    description: 'Model scenarios like hiring freezes, recruiter departures, or team expansions. See projected impact before making decisions.',
    whyItMatters: 'Don\'t guess what happens when you lose a recruiter or freeze hiring. Run the simulation and know exactly what to expect.',
    example: '"If we freeze hiring for 60 days: 12 offers at risk, 34 candidates will withdraw, TTF increases 18 days"',
    iconColor: 'violet'
  },
  {
    icon: 'bi-database-check',
    title: 'Data Health',
    tagline: 'Clean metrics, real performance',
    description: 'Automatically detect zombie reqs, ghost candidates, and data quality issues that corrupt your metrics.',
    whyItMatters: 'Your "65 day TTF" is actually 41 days when you exclude zombies. Know your real performance, not inflated garbage.',
    example: '"47 zombie reqs identified (30+ days no activity) - excluded from TTF calculation"',
    iconColor: 'green'
  },
  {
    icon: 'bi-robot',
    title: 'AI Copilot',
    tagline: 'Your keys, your data',
    description: 'Bring your own AI key for summaries, explanations, and draft communications. Zero-knowledge encryption keeps your keys safe.',
    whyItMatters: 'Get instant explanations of complex data, draft update emails for stakeholders, and summarize trends without leaving the tool.',
    example: '"Explain why Q3 TTF increased" → Full breakdown by stage, HM, and req type in seconds',
    iconColor: 'violet'
  },
  {
    icon: 'bi-chat-dots',
    title: 'Ask PlatoVue',
    tagline: 'Just ask',
    description: 'Natural language interface to query your recruiting data. Ask questions in plain English, get instant answers with citations.',
    whyItMatters: '"Why did that take so long?" shouldn\'t require a data analyst and 2 weeks. Ask the question, get the answer.',
    example: '"What\'s on fire?" → Top risks, stalled reqs, and overdue HM actions in one response',
    iconColor: 'cyan'
  },
  {
    icon: 'bi-graph-up-arrow',
    title: 'Forecasting',
    tagline: 'Predict, don\'t react',
    description: 'Pipeline-based hiring predictions with confidence scoring. Know your gap to goal before it\'s too late to fix.',
    whyItMatters: 'Counting open reqs isn\'t forecasting. Probability-weighted pipeline tells you what\'s actually going to happen.',
    example: '"25 open reqs, 18.3 expected hires, 6.7 gap to goal - prioritize sourcing for top 7 reqs"',
    iconColor: 'gold'
  }
];

interface FeaturesSectionProps {
  sectionRef: React.RefObject<HTMLElement | null>;
}

export function FeaturesSection({ sectionRef }: FeaturesSectionProps) {
  const [expandedFeature, setExpandedFeature] = useState<string | null>(null);
  const [headerRef, headerInView] = useInView<HTMLDivElement>({ threshold: 0.2 });
  const [gridRef, gridInView] = useInView<HTMLDivElement>({ threshold: 0.05 });

  return (
    <section className="landing-features" ref={sectionRef}>
      <div
        ref={headerRef}
        className={`landing-section-header animate-fade-up ${headerInView ? 'in-view' : ''}`}
      >
        <span className="landing-section-eyebrow">Features</span>
        <h2>Everything You Need to Run Recruiting</h2>
        <p>
          From high-level KPIs to individual candidate tracking, PlatoVue gives you
          complete visibility into your recruiting operation.
        </p>
      </div>

      <div ref={gridRef} className="landing-features-grid">
        {features.map((feature, index) => (
          <div
            key={feature.title}
            className={`landing-feature-card glass-card glass-card-interactive glass-card-glow animate-scale-up ${expandedFeature === feature.title ? 'expanded' : ''} ${gridInView ? 'in-view' : ''}`}
            style={{ transitionDelay: `${index * 80}ms` }}
            onClick={() => setExpandedFeature(
              expandedFeature === feature.title ? null : feature.title
            )}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setExpandedFeature(
                  expandedFeature === feature.title ? null : feature.title
                );
              }
            }}
          >
            <div className="feature-card-header">
              <div className={`landing-feature-icon ${feature.iconColor} icon-bounce`}>
                <i className={feature.icon} />
              </div>
              <div className="feature-title-group">
                <h3>{feature.title}</h3>
                <span className="feature-tagline">{feature.tagline}</span>
              </div>
              <i className={`bi bi-chevron-${expandedFeature === feature.title ? 'up' : 'down'} feature-expand-icon`} />
            </div>

            <p className="feature-description">{feature.description}</p>

            <div className="feature-expanded-content">
              <div className="feature-why">
                <span className="feature-why-label">Why it matters:</span>
                <p>{feature.whyItMatters}</p>
              </div>
              <div className="feature-example">
                <span className="feature-example-label">Example insight:</span>
                <p className="feature-example-text">{feature.example}</p>
              </div>
            </div>

            <div className="feature-card-footer">
              <span className="feature-learn-more">
                {expandedFeature === feature.title ? 'Show less' : 'Learn more'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
