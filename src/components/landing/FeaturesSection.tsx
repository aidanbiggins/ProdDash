import React, { useState } from 'react';
import {
  Bot,
  ChevronDown,
  Database,
  Gauge,
  MessageSquare,
  Sliders,
  Timer,
  TrendingUp,
  Users,
} from 'lucide-react';
import { useInView } from './hooks/useScrollAnimations';
import { cn } from '../../lib/utils';

interface Feature {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  tagline: string;
  description: string;
  whyItMatters: string;
  example: string;
  iconColor: 'gold' | 'cyan' | 'violet' | 'green';
}

const features: Feature[] = [
  {
    icon: Gauge,
    title: 'Control Tower',
    tagline: 'Your command center',
    description: 'Executive dashboard showing the 5 most critical KPIs with red/yellow/green status, top risks, and a unified action queue.',
    whyItMatters: 'Know in 30 seconds if you\'re on track or if something needs your attention. Stop digging through spreadsheets for answers.',
    example: '"3 offers pending over 7 days - candidates will accept elsewhere if no action today"',
    iconColor: 'gold'
  },
  {
    icon: Timer,
    title: 'Bottlenecks & SLAs',
    tagline: 'Track every delay',
    description: 'SLA breach tracking by stage and owner. See which stages consistently miss targets and who is responsible for the delays.',
    whyItMatters: 'Accountability requires visibility. Know exactly where candidates get stuck, how long they wait, and who needs to take action.',
    example: '"HM Review stage: 43% breach rate, 8.2 day median (SLA: 3 days) - Engineering team is 2x slower than Sales"',
    iconColor: 'cyan'
  },
  {
    icon: Users,
    title: 'HM Friction Analysis',
    tagline: 'Find the bottleneck',
    description: 'Identify which hiring managers are slowing down your pipeline with feedback latency tracking and accountability scorecards.',
    whyItMatters: '80% of preventable candidate drop-off happens while waiting for HM feedback. Now you can see exactly who and how long.',
    example: '"Mike Johnson: 8.2 day avg feedback time (team avg: 2.1 days) - 12 candidates waiting"',
    iconColor: 'cyan'
  },
  {
    icon: Sliders,
    title: 'What-If Simulator',
    tagline: 'Plan before you act',
    description: 'Model scenarios like hiring freezes, recruiter departures, or team expansions. See projected impact before making decisions.',
    whyItMatters: 'Don\'t guess what happens when you lose a recruiter or freeze hiring. Run the simulation and know exactly what to expect.',
    example: '"If we freeze hiring for 60 days: 12 offers at risk, 34 candidates will withdraw, TTF increases 18 days"',
    iconColor: 'violet'
  },
  {
    icon: Database,
    title: 'Data Health',
    tagline: 'Clean metrics, real performance',
    description: 'Automatically detect zombie reqs, ghost candidates, and data quality issues that corrupt your metrics.',
    whyItMatters: 'Your "65 day TTF" is actually 41 days when you exclude zombies. Know your real performance, not inflated garbage.',
    example: '"47 zombie reqs identified (30+ days no activity) - excluded from TTF calculation"',
    iconColor: 'green'
  },
  {
    icon: Bot,
    title: 'AI Copilot',
    tagline: 'Your keys, your data',
    description: 'Bring your own AI key for summaries, explanations, and draft communications. Zero-knowledge encryption keeps your keys safe.',
    whyItMatters: 'Get instant explanations of complex data, draft update emails for stakeholders, and summarize trends without leaving the tool.',
    example: '"Explain why Q3 TTF increased" -> Full breakdown by stage, HM, and req type in seconds',
    iconColor: 'violet'
  },
  {
    icon: MessageSquare,
    title: 'Ask PlatoVue',
    tagline: 'Just ask',
    description: 'Natural language interface to query your recruiting data. Ask questions in plain English, get instant answers with citations.',
    whyItMatters: '"Why did that take so long?" shouldn\'t require a data analyst and 2 weeks. Ask the question, get the answer.',
    example: '"What\'s on fire?" -> Top risks, stalled reqs, and overdue HM actions in one response',
    iconColor: 'cyan'
  },
  {
    icon: TrendingUp,
    title: 'Forecasting',
    tagline: 'Predict, don\'t react',
    description: 'Pipeline-based hiring predictions with confidence scoring. Know your gap to goal before it\'s too late to fix.',
    whyItMatters: 'Counting open reqs isn\'t forecasting. Probability-weighted pipeline tells you what\'s actually going to happen.',
    example: '"25 open reqs, 18.3 expected hires, 6.7 gap to goal - prioritize sourcing for top 7 reqs"',
    iconColor: 'gold'
  }
];

interface FeaturesSectionProps {
  sectionRef: React.MutableRefObject<HTMLElement | null>;
}

export function FeaturesSection({ sectionRef }: FeaturesSectionProps) {
  const [expandedFeature, setExpandedFeature] = useState<string | null>(null);
  const [headerRef, headerInView] = useInView<HTMLDivElement>({ threshold: 0.2 });
  const [gridRef, gridInView] = useInView<HTMLDivElement>({ threshold: 0.05 });

  const iconTone: Record<Feature['iconColor'], { icon: string; bg: string; ring: string }> = {
    gold: { icon: 'text-amber-400', bg: 'bg-amber-400/10', ring: 'ring-1 ring-amber-400/15 border-amber-400/20' },
    cyan: { icon: 'text-cyan-300', bg: 'bg-cyan-400/10', ring: 'ring-1 ring-cyan-400/15 border-cyan-400/20' },
    violet: { icon: 'text-violet-300', bg: 'bg-violet-400/10', ring: 'ring-1 ring-violet-400/15 border-violet-400/20' },
    green: { icon: 'text-emerald-300', bg: 'bg-emerald-400/10', ring: 'ring-1 ring-emerald-400/15 border-emerald-400/20' },
  };

  return (
    <section ref={sectionRef} className="relative py-24 md:py-32">
      <div
        ref={headerRef}
        className={cn(
          'mx-auto max-w-2xl px-6 text-center',
          'animate-fade-up',
          headerInView && 'in-view'
        )}
      >
        <span className="inline-flex items-center gap-2 text-xs font-semibold tracking-[0.2em] uppercase text-amber-400/90">
          Features
        </span>
        <h2 className="mt-4 font-display text-3xl md:text-4xl font-bold tracking-tight text-white">
          Everything You Need to Run Recruiting
        </h2>
        <p className="mt-4 text-base md:text-lg leading-relaxed text-slate-300">
          From high-level KPIs to individual candidate tracking, PlatoVue gives you
          complete visibility into your recruiting operation.
        </p>
      </div>

      <div ref={gridRef} className="mx-auto mt-12 max-w-[1200px] px-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((feature, index) => {
            const expanded = expandedFeature === feature.title;
            const Icon = feature.icon;
            const tone = iconTone[feature.iconColor];

            return (
              <button
                key={feature.title}
                type="button"
                className={cn(
                  'group w-full text-left',
                  'relative rounded-2xl border bg-slate-800/50 backdrop-blur-xl p-6',
                  'transition-all duration-300 ease-out',
                  'hover:-translate-y-1 hover:bg-slate-800/70 hover:shadow-[0_20px_45px_rgba(0,0,0,0.35)]',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/40',
                  'animate-scale-up',
                  gridInView && 'in-view',
                  expanded ? tone.ring : 'border-slate-700/60 hover:border-slate-700/80'
                )}
                style={{ transitionDelay: `${index * 70}ms` }}
                onClick={() => setExpandedFeature(expanded ? null : feature.title)}
                aria-expanded={expanded}
              >
                <div className="flex items-start gap-4">
                  <div
                    className={cn(
                      'flex h-11 w-11 items-center justify-center rounded-xl',
                      'border border-white/10 bg-white/[0.04]',
                      'shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]',
                      tone.bg
                    )}
                  >
                    <Icon className={cn('h-5 w-5', tone.icon)} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="font-display text-lg font-semibold tracking-tight text-white">
                          {feature.title}
                        </h3>
                        <p className="mt-1 text-sm font-medium tracking-wide text-slate-300">
                          {feature.tagline}
                        </p>
                      </div>

                      <ChevronDown
                        className={cn(
                          'mt-0.5 h-5 w-5 flex-shrink-0 text-slate-400 transition-transform duration-200',
                          expanded && 'rotate-180'
                        )}
                      />
                    </div>

                    <p className="mt-4 text-sm leading-relaxed text-slate-300">
                      {feature.description}
                    </p>

                    <div
                      className={cn(
                        'mt-4 overflow-hidden transition-[max-height,opacity] duration-300 ease-out',
                        expanded ? 'max-h-[240px] opacity-100' : 'max-h-0 opacity-0'
                      )}
                    >
                      <div className="pt-1 space-y-4">
                        <div>
                          <div className="text-sm font-semibold uppercase tracking-wide text-slate-300">
                            Why it matters
                          </div>
                          <p className="mt-2 text-sm leading-relaxed text-slate-300">
                            {feature.whyItMatters}
                          </p>
                        </div>
                        <div className="rounded-xl border border-slate-700/60 bg-slate-800/30 p-4">
                          <div className="text-sm font-semibold uppercase tracking-wide text-slate-300">
                            Example insight
                          </div>
                          <p className="mt-2 text-sm leading-relaxed text-white/90">
                            {feature.example}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 text-sm font-semibold text-amber-400/90">
                      {expanded ? 'Show less' : 'Learn more'}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
