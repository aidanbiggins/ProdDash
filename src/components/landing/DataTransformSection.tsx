import React, { useState, useEffect } from 'react';
import { useInView } from './hooks/useScrollAnimations';

type TransformStage = 'raw' | 'parsed' | 'normalized' | 'cleaned' | 'insights';

interface StageInfo {
  id: TransformStage;
  title: string;
  description: string;
  visual: 'csv' | 'columns' | 'stages' | 'clean' | 'dashboard';
}

const stages: StageInfo[] = [
  {
    id: 'raw',
    title: 'Raw CSV Export',
    description: 'Messy data with inconsistent columns, duplicate records, and custom field names from your ATS.',
    visual: 'csv'
  },
  {
    id: 'parsed',
    title: 'Smart Parsing',
    description: 'Auto-detect column types, report format, and data structure. No manual mapping required.',
    visual: 'columns'
  },
  {
    id: 'normalized',
    title: 'Stage Normalization',
    description: '"Phone Screen", "Recruiter Call", "Initial Interview" all map to SCREEN. Your funnel analysis finally works.',
    visual: 'stages'
  },
  {
    id: 'cleaned',
    title: 'Data Hygiene',
    description: 'Zombie reqs flagged. Ghost candidates identified. Duplicates merged. Bad dates corrected.',
    visual: 'clean'
  },
  {
    id: 'insights',
    title: 'Actionable Insights',
    description: 'True metrics, prioritized risks, and specific actions to take - not just charts and numbers.',
    visual: 'dashboard'
  }
];

export function DataTransformSection() {
  const [activeStage, setActiveStage] = useState<TransformStage>('raw');
  const [isAnimating, setIsAnimating] = useState(false);
  const [headerRef, headerInView] = useInView<HTMLDivElement>({ threshold: 0.2 });
  const [containerRef, containerInView] = useInView<HTMLDivElement>({ threshold: 0.1 });

  // Auto-advance through stages for demo effect (only when in view)
  useEffect(() => {
    if (!containerInView) return;

    const timer = setInterval(() => {
      setIsAnimating(true);
      setTimeout(() => {
        setActiveStage(current => {
          const currentIndex = stages.findIndex(s => s.id === current);
          const nextIndex = (currentIndex + 1) % stages.length;
          return stages[nextIndex].id;
        });
        setIsAnimating(false);
      }, 300);
    }, 4000);

    return () => clearInterval(timer);
  }, [containerInView]);

  const activeInfo = stages.find(s => s.id === activeStage)!;

  return (
    <section className="landing-transform">
      <div
        ref={headerRef}
        className={`landing-section-header animate-fade-up ${headerInView ? 'in-view' : ''}`}
      >
        <span className="landing-section-eyebrow">The Transformation</span>
        <h2>From Chaos to Clarity in Seconds</h2>
        <p>
          Watch how ProdDash transforms a messy ATS export into decision-grade intelligence.
        </p>
      </div>

      <div
        ref={containerRef}
        className={`landing-transform-container animate-scale-up ${containerInView ? 'in-view' : ''}`}
      >
        {/* Stage Navigation */}
        <div className="landing-transform-nav">
          {stages.map((stage, index) => (
            <button
              key={stage.id}
              className={`transform-nav-item btn-press ${activeStage === stage.id ? 'active' : ''}`}
              onClick={() => setActiveStage(stage.id)}
            >
              <span className="transform-nav-number">{index + 1}</span>
              <span className="transform-nav-title">{stage.title}</span>
            </button>
          ))}
        </div>

        {/* Visual Display */}
        <div className={`landing-transform-visual glass-card ${isAnimating ? 'animating' : ''}`}>
          {activeStage === 'raw' && <RawCSVVisual />}
          {activeStage === 'parsed' && <ParsedVisual />}
          {activeStage === 'normalized' && <NormalizedVisual />}
          {activeStage === 'cleaned' && <CleanedVisual />}
          {activeStage === 'insights' && <InsightsVisual />}
        </div>

        {/* Description */}
        <div className="landing-transform-description">
          <h3>{activeInfo.title}</h3>
          <p>{activeInfo.description}</p>
        </div>
      </div>
    </section>
  );
}

// Visual Components for each stage
function RawCSVVisual() {
  return (
    <div className="transform-visual-csv">
      <div className="csv-table">
        <div className="csv-header">
          <span>Requisition ID</span>
          <span>Job Title</span>
          <span>Candidate Name</span>
          <span>Current Status</span>
          <span>Date Updated</span>
        </div>
        <div className="csv-row error">
          <span>REQ-001</span>
          <span>Sr. Engineer</span>
          <span>John D.</span>
          <span className="highlight-bad">Phone Scrn</span>
          <span>1/5/24</span>
        </div>
        <div className="csv-row">
          <span>REQ-001</span>
          <span>Sr. Engineer</span>
          <span>Jane S.</span>
          <span className="highlight-bad">Recruiter Phone</span>
          <span>12/15/23</span>
        </div>
        <div className="csv-row warning">
          <span>REQ-002</span>
          <span>Product Mgr</span>
          <span className="highlight-bad">—</span>
          <span className="highlight-bad">Open</span>
          <span className="highlight-bad">???</span>
        </div>
        <div className="csv-row">
          <span>REQ-003</span>
          <span>Data Scientist</span>
          <span>Mike J.</span>
          <span className="highlight-bad">HM Interview</span>
          <span>11/01/23</span>
        </div>
      </div>
      <div className="csv-problems-summary">
        <span className="csv-problem">
          <i className="bi bi-exclamation-triangle-fill" />
          Inconsistent stage names
        </span>
        <span className="csv-problem">
          <i className="bi bi-x-circle-fill" />
          Missing data
        </span>
        <span className="csv-problem">
          <i className="bi bi-clock-fill" />
          Stale records
        </span>
      </div>
    </div>
  );
}

function ParsedVisual() {
  return (
    <div className="transform-visual-parsed">
      <div className="parsed-detection">
        <div className="detection-item success">
          <i className="bi bi-check-circle-fill" />
          <span>Report type: iCIMS Submittal</span>
        </div>
        <div className="detection-item success">
          <i className="bi bi-check-circle-fill" />
          <span>Columns detected: 12/12</span>
        </div>
        <div className="detection-item success">
          <i className="bi bi-check-circle-fill" />
          <span>Date format: MM/DD/YY</span>
        </div>
        <div className="detection-item warning">
          <i className="bi bi-exclamation-circle-fill" />
          <span>3 unmapped stages found</span>
        </div>
      </div>
      <div className="parsed-mapping">
        <div className="mapping-row">
          <span className="mapping-source">"Requisition ID"</span>
          <i className="bi bi-arrow-right" />
          <span className="mapping-target">req_id</span>
        </div>
        <div className="mapping-row">
          <span className="mapping-source">"Candidate Name"</span>
          <i className="bi bi-arrow-right" />
          <span className="mapping-target">candidate_name</span>
        </div>
        <div className="mapping-row">
          <span className="mapping-source">"Current Status"</span>
          <i className="bi bi-arrow-right" />
          <span className="mapping-target">stage</span>
        </div>
      </div>
    </div>
  );
}

function NormalizedVisual() {
  return (
    <div className="transform-visual-normalized">
      <div className="normalization-header">Stage Normalization</div>
      <div className="normalization-list">
        <div className="normalization-row">
          <div className="norm-before">
            <span>"Phone Screen"</span>
            <span>"Recruiter Phone"</span>
            <span>"Initial Call"</span>
          </div>
          <i className="bi bi-arrow-right-circle-fill" />
          <div className="norm-after">
            <span className="canonical-stage screen">SCREEN</span>
          </div>
        </div>
        <div className="normalization-row">
          <div className="norm-before">
            <span>"HM Interview"</span>
            <span>"Hiring Mgr Review"</span>
          </div>
          <i className="bi bi-arrow-right-circle-fill" />
          <div className="norm-after">
            <span className="canonical-stage hm">HM_SCREEN</span>
          </div>
        </div>
        <div className="normalization-row">
          <div className="norm-before">
            <span>"Virtual Onsite"</span>
            <span>"Onsite Loop"</span>
          </div>
          <i className="bi bi-arrow-right-circle-fill" />
          <div className="norm-after">
            <span className="canonical-stage onsite">ONSITE</span>
          </div>
        </div>
      </div>
      <div className="normalization-benefit">
        Now funnel analysis works across time periods, even if you renamed stages
      </div>
    </div>
  );
}

function CleanedVisual() {
  return (
    <div className="transform-visual-cleaned">
      <div className="cleaned-header">Data Quality Report</div>
      <div className="cleaned-stats">
        <div className="cleaned-stat">
          <span className="cleaned-stat-value">47</span>
          <span className="cleaned-stat-label">Zombie reqs identified</span>
          <span className="cleaned-stat-action">Excluded from TTF</span>
        </div>
        <div className="cleaned-stat">
          <span className="cleaned-stat-value">312</span>
          <span className="cleaned-stat-label">Ghost candidates flagged</span>
          <span className="cleaned-stat-action">Pipeline adjusted</span>
        </div>
        <div className="cleaned-stat">
          <span className="cleaned-stat-value">23</span>
          <span className="cleaned-stat-label">Duplicates merged</span>
          <span className="cleaned-stat-action">Records consolidated</span>
        </div>
      </div>
      <div className="cleaned-score">
        <div className="score-ring">
          <span className="score-value">87</span>
        </div>
        <span className="score-label">Data Quality Score</span>
      </div>
    </div>
  );
}

function InsightsVisual() {
  return (
    <div className="transform-visual-insights">
      <div className="insights-kpis">
        <div className="insight-kpi green">
          <span className="kpi-label">True TTF</span>
          <span className="kpi-value">41d</span>
          <span className="kpi-note">vs 65d raw</span>
        </div>
        <div className="insight-kpi gold">
          <span className="kpi-label">Accept Rate</span>
          <span className="kpi-value">87%</span>
          <span className="kpi-note">on target</span>
        </div>
        <div className="insight-kpi red">
          <span className="kpi-label">HM Latency</span>
          <span className="kpi-value">4.2d</span>
          <span className="kpi-note">above target</span>
        </div>
      </div>
      <div className="insights-actions">
        <div className="insight-action critical">
          <i className="bi bi-exclamation-circle-fill" />
          <span>Offer pending 9 days - Jane Smith</span>
        </div>
        <div className="insight-action high">
          <i className="bi bi-exclamation-triangle-fill" />
          <span>Mike Johnson: 3 candidates waiting for feedback</span>
        </div>
        <div className="insight-action medium">
          <i className="bi bi-info-circle-fill" />
          <span>REQ-1234: Consider closing (zombie)</span>
        </div>
      </div>
    </div>
  );
}
