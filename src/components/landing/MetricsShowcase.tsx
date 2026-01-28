import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  ArrowRightCircle,
  CheckCircle2,
  Info,
  Lightbulb,
  Minus,
  Search,
  Sliders,
  Target,
  TrendingDown,
  TrendingUp,
  UserMinus,
  Wand2,
  Zap,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useInView } from './hooks/useScrollAnimations';

type MetricCategory = 'before-after' | 'hidden-insights' | 'scenarios' | 'actions';

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
  icon: React.ComponentType<{ className?: string }>;
}

interface ActionExample {
  priority: 'P0' | 'P1' | 'P2';
  title: string;
  context: string;
  action: string;
}

interface ScenarioExample {
  title: string;
  description: string;
  impacts: { metric: string; change: string; direction: 'up' | 'down' | 'neutral' }[];
  recommendation: string;
}

const beforeAfterData: BeforeAfter[] = [
  {
    metric: 'Time to Fill',
    before: '65 days',
    beforeLabel: 'Raw (with zombies)',
    after: '41 days',
    afterLabel: 'True (clean data)',
    impact: '37% more accurate',
  },
  {
    metric: 'Open Reqs',
    before: '120',
    beforeLabel: 'ATS count',
    after: '86',
    afterLabel: 'Active reqs',
    impact: '34 zombies identified',
  },
  {
    metric: 'Pipeline Health',
    before: '847',
    beforeLabel: 'Candidates in ATS',
    after: '535',
    afterLabel: 'Active candidates',
    impact: '312 ghosts flagged',
  },
];

const hiddenInsights: HiddenInsight[] = [
  {
    question: 'Why is our TTF so high?',
    surface: 'Sourcing is slow',
    reality:
      'HM review takes 11 days (should be 3). Engineering HMs are 4x slower than Sales.',
    icon: Search,
  },
  {
    question: 'Why are candidates dropping off?',
    surface: 'Bad candidate experience',
    reality:
      '67% of withdrawals happen during HM stages when feedback is >5 days late.',
    icon: UserMinus,
  },
  {
    question: 'Why did we miss Q3 goals?',
    surface: 'Not enough sourcing',
    reality:
      '28% of "open" reqs were zombies. Real capacity was 72 reqs, not 100.',
    icon: Target,
  },
];

const actionExamples: ActionExample[] = [
  {
    priority: 'P0',
    title: 'Offer pending 9 days - Jane Smith, Sr. Engineer',
    context: 'Candidate received competing offer on Day 5. Last contact: Day 7.',
    action: 'Call candidate today to close or will lose to competitor',
  },
  {
    priority: 'P0',
    title: 'HM feedback overdue - Mike Johnson (3 candidates)',
    context: 'Interviews completed 1/5, 1/6, 1/7. Team avg feedback time: 1.8 days.',
    action: 'Escalate to HM or their manager - candidates at dropout risk',
  },
  {
    priority: 'P1',
    title: 'Zombie req - REQ-1234, Data Scientist',
    context: 'Open 127 days. Last candidate activity: 47 days ago. No pipeline.',
    action: 'Close req or get sourcing commitment from HM this week',
  },
  {
    priority: 'P1',
    title: 'Pipeline gap - REQ-5678, Product Manager',
    context: 'Priority req (VP-level request). Zero candidates in pipeline.',
    action: 'Prioritize sourcing - need 10+ candidates to hit interview target',
  },
  {
    priority: 'P2',
    title: 'Source underperforming - LinkedIn InMail',
    context: 'Response rate dropped from 18% to 9% over 3 months.',
    action: 'Review messaging templates, consider reallocating budget',
  },
];

const scenarioExamples: ScenarioExample[] = [
  {
    title: 'Hiring Freeze (60 days)',
    description: 'What happens if we pause all new hiring for 2 months?',
    impacts: [
      { metric: 'Offers at Risk', change: '12', direction: 'up' },
      { metric: 'Candidate Withdrawals', change: '+34', direction: 'up' },
      { metric: 'TTF Impact', change: '+18 days', direction: 'up' },
    ],
    recommendation:
      'Consider keeping top 5 critical reqs active to minimize candidate loss',
  },
  {
    title: 'Recruiter Leaves',
    description: 'What if Sarah (top performer, 24 reqs) leaves next month?',
    impacts: [
      { metric: 'Reqs Orphaned', change: '24', direction: 'up' },
      { metric: 'Pipeline at Risk', change: '47 candidates', direction: 'up' },
      { metric: 'Capacity Gap', change: '-18%', direction: 'down' },
    ],
    recommendation:
      'Cross-train backup recruiter now, redistribute 8 critical reqs immediately',
  },
  {
    title: 'Spin Up New Team',
    description: 'Engineering wants to hire 15 people in 90 days. Can we do it?',
    impacts: [
      { metric: 'Sourcing Needed', change: '450+ candidates', direction: 'neutral' },
      { metric: 'Recruiter Load', change: '+40%', direction: 'up' },
      { metric: 'Probability', change: '62%', direction: 'neutral' },
    ],
    recommendation: 'Need 2 contract sourcers or extend timeline to 120 days for 85% confidence',
  },
];

export function MetricsShowcase() {
  const [activeCategory, setActiveCategory] = useState<MetricCategory>('before-after');
  const [headerRef, headerInView] = useInView<HTMLDivElement>({ threshold: 0.2 });
  const [tabsRef, tabsInView] = useInView<HTMLDivElement>({ threshold: 0.3 });
  const [contentRef, contentInView] = useInView<HTMLDivElement>({ threshold: 0.1 });

  const tabs = useMemo(
    () =>
      [
        { id: 'before-after', label: 'Before / After' },
        { id: 'hidden-insights', label: 'Hidden Insights' },
        { id: 'scenarios', label: 'Scenarios' },
        { id: 'actions', label: 'Action Queue' },
      ] as const,
    []
  );

  return (
    <section className="relative py-24 md:py-32">
      <div
        ref={headerRef}
        className={cn('mx-auto max-w-2xl px-6 text-center', 'animate-fade-up', headerInView && 'in-view')}
      >
        <span className="inline-flex items-center gap-2 text-xs font-semibold tracking-[0.2em] uppercase text-amber-400/90">
          The Difference
        </span>
        <h2 className="mt-4 font-display text-3xl md:text-4xl font-bold tracking-tight text-white">
          Metrics You Can Actually Trust
        </h2>
        <p className="mt-4 text-base md:text-lg leading-relaxed text-slate-300">
          Stop debating the spreadsheet. Start acting on a single source of truth.
        </p>
      </div>

      <div className="mx-auto mt-12 max-w-[1200px] px-6">
        {/* Tabs */}
        <div
          ref={tabsRef}
          className={cn(
            'flex items-center gap-2 overflow-x-auto pb-1',
            'animate-scale-up',
            tabsInView && 'in-view'
          )}
        >
          {tabs.map((tab) => {
            const active = activeCategory === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                className={cn(
                  'whitespace-nowrap rounded-full border px-4 py-2 text-sm font-semibold',
                  'transition-all duration-200',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60',
                  active
                    ? 'border-amber-400/60 bg-amber-500/25 text-amber-200 ring-1 ring-amber-400/30'
                    : 'border-slate-600/80 bg-slate-800/50 text-slate-300 hover:bg-slate-700/60 hover:border-slate-500'
                )}
                onClick={() => setActiveCategory(tab.id)}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div
          ref={contentRef}
          className={cn(
            'mt-6 rounded-2xl border border-slate-600/70 bg-slate-800/60 backdrop-blur-xl p-6 md:p-8',
            'shadow-[0_20px_45px_rgba(0,0,0,0.35)]',
            'animate-scale-up',
            contentInView && 'in-view'
          )}
        >
          {activeCategory === 'before-after' && <BeforeAfterPanel />}
          {activeCategory === 'hidden-insights' && <HiddenInsightsPanel />}
          {activeCategory === 'scenarios' && <ScenariosPanel />}
          {activeCategory === 'actions' && <ActionsPanel />}
        </div>
      </div>
    </section>
  );
}

function BeforeAfterPanel() {
  return (
    <div>
      <p className="text-sm md:text-base text-slate-300">
        Standard reports inflate metrics with bad data. PlatoVue shows you the truth.
      </p>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        {beforeAfterData.map((item) => (
          <div
            key={item.metric}
            className="rounded-2xl border border-slate-600/70 bg-slate-700/50 p-5"
          >
            <div className="font-display text-base font-semibold text-white">
              {item.metric}
            </div>

            <div className="mt-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="stat-value text-lg text-slate-400 line-through opacity-80">
                  {item.before}
                </div>
                <div className="mt-1 text-xs text-slate-300">
                  {item.beforeLabel}
                </div>
              </div>

              <ArrowRight className="h-4 w-4 flex-shrink-0 text-cyan-400" />

              <div className="min-w-0 text-right">
                <div className="stat-value text-lg text-emerald-300">{item.after}</div>
                <div className="mt-1 text-xs text-slate-300">
                  {item.afterLabel}
                </div>
              </div>
            </div>

            <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-emerald-400/50 bg-emerald-500/20 px-3 py-1.5 text-xs text-emerald-200">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              {item.impact}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function HiddenInsightsPanel() {
  return (
    <div>
      <p className="text-sm md:text-base text-slate-300">
        The real answers are often buried under surface-level explanations.
      </p>

      <div className="mt-6 space-y-4">
        {hiddenInsights.map((insight) => {
          const Icon = insight.icon;

          return (
            <div key={insight.question} className="rounded-2xl border border-slate-600/70 bg-slate-700/50 p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-400/40 bg-amber-500/20">
                  <Icon className="h-5 w-5 text-amber-400" />
                </div>
                <div className="font-display text-base font-semibold text-white">
                  {insight.question}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-xl border border-slate-500/50 bg-slate-700/40 p-4">
                  <div className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                    Surface answer
                  </div>
                  <p className="mt-2 text-sm text-slate-300">{insight.surface}</p>
                </div>
                <div className="rounded-xl border border-amber-400/50 bg-amber-500/20 p-4">
                  <div className="text-sm font-semibold uppercase tracking-wide text-amber-300">
                    PlatoVue reveals
                  </div>
                  <p className="mt-2 text-sm text-white">{insight.reality}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ScenariosPanel() {
  return (
    <div>
      <p className="text-sm md:text-base text-slate-300">
        Model business scenarios before they happen. Know the impact, plan the response.
      </p>

      <div className="mt-6 space-y-4">
        {scenarioExamples.map((scenario) => (
          <div key={scenario.title} className="rounded-2xl border border-slate-600/70 bg-slate-700/50 p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-violet-400/40 bg-violet-500/20">
                <Sliders className="h-5 w-5 text-violet-300" />
              </div>
              <div className="min-w-0">
                <div className="font-display text-base font-semibold text-white">
                  {scenario.title}
                </div>
                <p className="mt-1 text-sm text-slate-300">{scenario.description}</p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
              {scenario.impacts.map((impact) => (
                <ScenarioImpact
                  key={impact.metric}
                  metric={impact.metric}
                  change={impact.change}
                  direction={impact.direction}
                />
              ))}
            </div>

            <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-400/40 bg-amber-500/15 p-4 text-sm text-amber-100">
              <Lightbulb className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-400" />
              <span>{scenario.recommendation}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 flex items-center gap-2 text-sm text-slate-300">
        <Wand2 className="h-4 w-4 text-amber-400" />
        Run unlimited scenarios on your real data. See impact before making decisions.
      </div>
    </div>
  );
}

function ScenarioImpact({
  metric,
  change,
  direction,
}: {
  metric: string;
  change: string;
  direction: 'up' | 'down' | 'neutral';
}) {
  const meta =
    direction === 'up'
      ? { icon: TrendingUp, color: 'text-rose-300', border: 'border-rose-400/50 bg-rose-500/20' }
      : direction === 'down'
        ? { icon: TrendingDown, color: 'text-emerald-300', border: 'border-emerald-400/50 bg-emerald-500/20' }
        : { icon: Minus, color: 'text-cyan-300', border: 'border-cyan-400/50 bg-cyan-500/20' };

  const Icon = meta.icon;

  return (
    <div className={cn('rounded-xl border p-4', meta.border)}>
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-semibold uppercase tracking-wide text-slate-300">
          {metric}
        </div>
        <Icon className={cn('h-4 w-4 flex-shrink-0', meta.color)} />
      </div>
      <div className={cn('stat-value mt-2 text-lg', meta.color)}>{change}</div>
    </div>
  );
}

function ActionsPanel() {
  return (
    <div>
      <p className="text-sm md:text-base text-slate-300">
        Not just dashboards - a prioritized queue of exactly what to do and when.
      </p>

      <div className="mt-6 space-y-3">
        {actionExamples.map((item) => (
          <ActionCard key={item.title} item={item} />
        ))}
      </div>

      <div className="mt-5 flex items-center gap-2 text-sm text-slate-300">
        <Zap className="h-4 w-4 text-amber-400" />
        Actions auto-generate from your data. No manual triage needed.
      </div>
    </div>
  );
}

function ActionCard({ item }: { item: ActionExample }) {
  const priorityTone =
    item.priority === 'P0'
      ? 'border-rose-400/50 bg-rose-500/15'
      : item.priority === 'P1'
        ? 'border-amber-400/50 bg-amber-500/15'
        : 'border-cyan-400/50 bg-cyan-500/15';

  const badgeTone =
    item.priority === 'P0'
      ? 'bg-rose-500/30 text-rose-200 border-rose-400/50'
      : item.priority === 'P1'
        ? 'bg-amber-500/30 text-amber-200 border-amber-400/50'
        : 'bg-cyan-500/30 text-cyan-200 border-cyan-400/50';

  return (
    <div className={cn('rounded-2xl border p-5', priorityTone)}>
      <div className="flex items-start gap-3">
        <span className={cn('inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold', badgeTone)}>
          {item.priority}
        </span>
        <div className="min-w-0">
          <div className="font-display text-base font-semibold text-white">
            {item.title}
          </div>

          <div className="mt-3 flex items-start gap-2 text-xs text-slate-300">
            <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-400" />
            <span>{item.context}</span>
          </div>

          <div className="mt-3 flex items-start gap-2 text-sm text-white">
            <ArrowRightCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-400" />
            <span>
              <span className="font-semibold">Action:</span> {item.action}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

