import React, { useState } from 'react';

type MetricCategory = 'before-after' | 'hidden-insights' | 'actions';

interface BeforeAfter {
  metric: string;
  before: string;
  beforeLabel: string;
  after: string;
  afterLabel: string;
  impact: string;
}

interface HiddenInsight {
  question: string;
  surface: string;
  reality: string;
  icon: string;
}

interface ActionExample {
  priority: 'P0' | 'P1' | 'P2';
  title: string;
  context: string;
  action: string;
}

const beforeAfterData: BeforeAfter[] = [
  {
    metric: 'Time to Fill',
    before: '65 days',
    beforeLabel: 'Raw (with zombies)',
    after: '41 days',
    afterLabel: 'True (clean data)',
    impact: '37% more accurate'
  },
  {
    metric: 'Open Reqs',
    before: '120',
    beforeLabel: 'ATS count',
    after: '86',
    afterLabel: 'Active reqs',
    impact: '34 zombies identified'
  },
  {
    metric: 'Pipeline Health',
    before: '847',
    beforeLabel: 'Candidates in ATS',
    after: '535',
    afterLabel: 'Active candidates',
    impact: '312 ghosts flagged'
  }
];

const hiddenInsights: HiddenInsight[] = [
  {
    question: 'Why is our TTF so high?',
    surface: 'Sourcing is slow',
    reality: 'HM review takes 11 days (should be 3). Engineering HMs are 4x slower than Sales.',
    icon: 'bi-search'
  },
  {
    question: 'Why are candidates dropping off?',
    surface: 'Bad candidate experience',
    reality: '67% of withdrawals happen during HM stages when feedback is >5 days late.',
    icon: 'bi-person-dash'
  },
  {
    question: 'Why did we miss Q3 goals?',
    surface: 'Not enough sourcing',
    reality: '28% of "open" reqs were zombies. Real capacity was 72 reqs, not 100.',
    icon: 'bi-bullseye'
  }
];

const actionExamples: ActionExample[] = [
  {
    priority: 'P0',
    title: 'Offer pending 9 days - Jane Smith, Sr. Engineer',
    context: 'Candidate received competing offer on Day 5. Last contact: Day 7.',
    action: 'Call candidate today to close or will lose to competitor'
  },
  {
    priority: 'P0',
    title: 'HM feedback overdue - Mike Johnson (3 candidates)',
    context: 'Interviews completed 1/5, 1/6, 1/7. Team avg feedback time: 1.8 days.',
    action: 'Escalate to HM or their manager - candidates at dropout risk'
  },
  {
    priority: 'P1',
    title: 'Zombie req - REQ-1234, Data Scientist',
    context: 'Open 127 days. Last candidate activity: 47 days ago. No pipeline.',
    action: 'Close req or get sourcing commitment from HM this week'
  },
  {
    priority: 'P1',
    title: 'Pipeline gap - REQ-5678, Product Manager',
    context: 'Priority req (VP-level request). Zero candidates in pipeline.',
    action: 'Prioritize sourcing - need 10+ candidates to hit interview target'
  },
  {
    priority: 'P2',
    title: 'Source underperforming - LinkedIn InMail',
    context: 'Response rate dropped from 18% to 9% over 3 months.',
    action: 'Review messaging templates, consider reallocating budget'
  }
];

export function MetricsShowcase() {
  const [activeCategory, setActiveCategory] = useState<MetricCategory>('before-after');

  return (
    <section className="landing-metrics">
      <div className="landing-section-header">
        <span className="landing-section-eyebrow">The Difference</span>
        <h2>See What's Really Happening</h2>
        <p>
          ProdDash doesn't just show you numbers - it reveals the story behind them
          and tells you exactly what to do next.
        </p>
      </div>

      {/* Category Tabs */}
      <div className="metrics-tabs">
        <button
          className={`metrics-tab ${activeCategory === 'before-after' ? 'active' : ''}`}
          onClick={() => setActiveCategory('before-after')}
        >
          <i className="bi bi-arrow-left-right" />
          Before vs After
        </button>
        <button
          className={`metrics-tab ${activeCategory === 'hidden-insights' ? 'active' : ''}`}
          onClick={() => setActiveCategory('hidden-insights')}
        >
          <i className="bi bi-lightbulb" />
          Hidden Insights
        </button>
        <button
          className={`metrics-tab ${activeCategory === 'actions' ? 'active' : ''}`}
          onClick={() => setActiveCategory('actions')}
        >
          <i className="bi bi-list-check" />
          Action Queue
        </button>
      </div>

      {/* Content */}
      <div className="metrics-content">
        {activeCategory === 'before-after' && (
          <div className="metrics-before-after">
            <p className="metrics-intro">
              Standard reports inflate metrics with bad data. ProdDash shows you the truth.
            </p>
            <div className="before-after-grid">
              {beforeAfterData.map((item) => (
                <div key={item.metric} className="before-after-card">
                  <h4>{item.metric}</h4>
                  <div className="before-after-comparison">
                    <div className="comparison-before">
                      <span className="comparison-value faded">{item.before}</span>
                      <span className="comparison-label">{item.beforeLabel}</span>
                    </div>
                    <div className="comparison-arrow">
                      <i className="bi bi-arrow-right" />
                    </div>
                    <div className="comparison-after">
                      <span className="comparison-value">{item.after}</span>
                      <span className="comparison-label">{item.afterLabel}</span>
                    </div>
                  </div>
                  <div className="comparison-impact">
                    <i className="bi bi-check-circle-fill" />
                    {item.impact}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeCategory === 'hidden-insights' && (
          <div className="metrics-hidden-insights">
            <p className="metrics-intro">
              The real answers are often buried under surface-level explanations.
            </p>
            <div className="hidden-insights-list">
              {hiddenInsights.map((insight, index) => (
                <div key={index} className="hidden-insight-card">
                  <div className="insight-question">
                    <i className={insight.icon} />
                    <span>{insight.question}</span>
                  </div>
                  <div className="insight-comparison">
                    <div className="insight-surface">
                      <span className="insight-label">Surface answer:</span>
                      <p>{insight.surface}</p>
                    </div>
                    <div className="insight-reality">
                      <span className="insight-label">
                        <i className="bi bi-search" /> ProdDash reveals:
                      </span>
                      <p>{insight.reality}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeCategory === 'actions' && (
          <div className="metrics-actions">
            <p className="metrics-intro">
              Not just dashboards - a prioritized queue of exactly what to do and when.
            </p>
            <div className="actions-list">
              {actionExamples.map((action, index) => (
                <div key={index} className={`action-card priority-${action.priority.toLowerCase()}`}>
                  <div className="action-header">
                    <span className={`action-priority ${action.priority.toLowerCase()}`}>
                      {action.priority}
                    </span>
                    <span className="action-title">{action.title}</span>
                  </div>
                  <div className="action-context">
                    <i className="bi bi-info-circle" />
                    {action.context}
                  </div>
                  <div className="action-recommendation">
                    <i className="bi bi-arrow-right-circle-fill" />
                    <strong>Action:</strong> {action.action}
                  </div>
                </div>
              ))}
            </div>
            <div className="actions-note">
              <i className="bi bi-lightning-charge-fill" />
              Actions auto-generate from your data. No manual triage needed.
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
