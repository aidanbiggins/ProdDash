import React, { useState } from 'react';
import { useInView } from './hooks/useScrollAnimations';

interface PainPoint {
  icon: string;
  title: string;
  description: string;
  stat: string;
  statLabel: string;
}

const painPoints: PainPoint[] = [
  {
    icon: 'bi-table',
    title: 'Spreadsheet Hell',
    description: 'TA leaders spend hours every week wrestling with ATS exports, building pivot tables, and updating reports that are stale by the time they\'re finished.',
    stat: '4-8',
    statLabel: 'hours/week on manual reporting'
  },
  {
    icon: 'bi-clock-history',
    title: 'Problems Surface Too Late',
    description: 'By the time monthly reports reveal a stalled req or slow hiring manager, candidates have already dropped off and goals have been missed.',
    stat: '4+',
    statLabel: 'weeks before issues are visible'
  },
  {
    icon: 'bi-person-x',
    title: 'The HM Black Box',
    description: 'The #1 controllable factor in candidate drop-off is hiring manager responsiveness, but most TA teams have zero visibility into which HMs are the bottleneck.',
    stat: '80%',
    statLabel: 'of drop-off during HM stages'
  },
  {
    icon: 'bi-graph-down',
    title: 'Garbage Metrics',
    description: 'Zombie reqs, ghost candidates, and data quality issues corrupt every metric you have. Your "real" TTF is hidden under layers of bad data.',
    stat: '15-40%',
    statLabel: 'TTF inflation from data issues'
  }
];

export function ProblemSection() {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [headerRef, headerInView] = useInView<HTMLDivElement>({ threshold: 0.2 });
  const [gridRef, gridInView] = useInView<HTMLDivElement>({ threshold: 0.1 });
  const [quoteRef, quoteInView] = useInView<HTMLDivElement>({ threshold: 0.3 });

  return (
    <section className="landing-problem">
      <div
        ref={headerRef}
        className={`landing-section-header animate-fade-up ${headerInView ? 'in-view' : ''}`}
      >
        <span className="landing-section-eyebrow">The Problem</span>
        <h2>TA Teams Are Flying Blind</h2>
        <p>
          Standard ATS reports show activity, not outcomes. By the time you see a problem,
          it's already cost you candidates, time, and credibility.
        </p>
      </div>

      <div ref={gridRef} className="landing-problem-grid">
        {painPoints.map((point, index) => (
          <div
            key={point.title}
            className={`landing-problem-card glass-card glass-card-interactive animate-fade-up ${activeIndex === index ? 'active' : ''} ${gridInView ? 'in-view' : ''}`}
            style={{ transitionDelay: `${index * 100}ms` }}
            onMouseEnter={() => setActiveIndex(index)}
            onMouseLeave={() => setActiveIndex(null)}
          >
            <div className="landing-problem-icon icon-bounce">
              <i className={point.icon} />
            </div>
            <h3>{point.title}</h3>
            <p>{point.description}</p>
            <div className="landing-problem-stat">
              <span className="stat-value">{point.stat}</span>
              <span className="stat-label">{point.statLabel}</span>
            </div>
          </div>
        ))}
      </div>

      <div
        ref={quoteRef}
        className={`landing-problem-quote animate-blur-in ${quoteInView ? 'in-view' : ''}`}
      >
        <blockquote>
          We have 120 open reqs but keep missing hiring goals. What's going wrong?
        </blockquote>
        <p className="landing-problem-answer">
          <strong>The answer:</strong> 34 of those reqs are zombies - no activity in 45+ days.
          Real open reqs: 86. But you'd never know from standard reports.
        </p>
      </div>
    </section>
  );
}
