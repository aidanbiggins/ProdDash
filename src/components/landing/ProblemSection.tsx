import React, { useState } from 'react';
import { Table2, Clock3, UserX, TrendingDown } from 'lucide-react';
import { useInView } from './hooks/useScrollAnimations';
import { cn } from '../../lib/utils';

interface PainPoint {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  stat: string;
  statLabel: string[];
  accent: 'amber' | 'cyan' | 'violet' | 'rose';
}

const painPoints: PainPoint[] = [
  {
    icon: Table2,
    title: 'Spreadsheet Hell',
    description: 'TA leaders spend hours every week wrestling with ATS exports, building pivot tables, and updating reports that are stale by the time they\'re finished.',
    stat: '4-8',
    statLabel: ['hours/week', 'on manual reporting'],
    accent: 'amber',
  },
  {
    icon: Clock3,
    title: 'Problems Surface Too Late',
    description: 'By the time monthly reports reveal a stalled req or slow hiring manager, candidates have already dropped off and goals have been missed.',
    stat: '4+',
    statLabel: ['weeks before', 'issues are visible'],
    accent: 'cyan',
  },
  {
    icon: UserX,
    title: 'The HM Black Box',
    description: 'The #1 controllable factor in candidate drop-off is hiring manager responsiveness, but most TA teams have zero visibility into which HMs are the bottleneck.',
    stat: '80%',
    statLabel: ['of drop-off', 'during HM stages'],
    accent: 'violet',
  },
  {
    icon: TrendingDown,
    title: 'Garbage Metrics',
    description: 'Zombie reqs, ghost candidates, and data quality issues corrupt every metric you have. Your "real" TTF is hidden under layers of bad data.',
    stat: '15-40%',
    statLabel: ['TTF inflation', 'from data issues'],
    accent: 'rose',
  }
];

export function ProblemSection() {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [headerRef, headerInView] = useInView<HTMLDivElement>({ threshold: 0.2 });
  const [gridRef, gridInView] = useInView<HTMLDivElement>({ threshold: 0.1 });
  const [quoteRef, quoteInView] = useInView<HTMLDivElement>({ threshold: 0.3 });

  const accentClasses: Record<PainPoint['accent'], { ring: string; icon: string; iconBg: string }> = {
    amber: {
      ring: 'ring-1 ring-amber-400/20 border-amber-400/20',
      icon: 'text-amber-400',
      iconBg: 'bg-amber-400/10',
    },
    cyan: {
      ring: 'ring-1 ring-cyan-400/20 border-cyan-400/20',
      icon: 'text-cyan-300',
      iconBg: 'bg-cyan-400/10',
    },
    violet: {
      ring: 'ring-1 ring-violet-400/20 border-violet-400/20',
      icon: 'text-violet-300',
      iconBg: 'bg-violet-400/10',
    },
    rose: {
      ring: 'ring-1 ring-rose-400/20 border-rose-400/20',
      icon: 'text-rose-300',
      iconBg: 'bg-rose-400/10',
    },
  };

  return (
    <section className="relative py-24 md:py-32">
      <div
        ref={headerRef}
        className={cn(
          'mx-auto max-w-2xl px-6 text-center',
          'animate-fade-up',
          headerInView && 'in-view'
        )}
      >
        <span className="inline-flex items-center gap-2 text-xs font-semibold tracking-[0.2em] uppercase text-amber-400/90">
          The Problem
        </span>
        <h2 className="mt-4 font-display text-3xl md:text-4xl font-bold tracking-tight text-white">
          TA Teams Are Flying Blind
        </h2>
        <p className="mt-4 text-base md:text-lg leading-relaxed text-slate-300">
          Standard ATS reports show activity, not outcomes. By the time you see a problem,
          it's already cost you candidates, time, and credibility.
        </p>
      </div>

      <div ref={gridRef} className="mx-auto mt-12 max-w-[1200px] px-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {painPoints.map((point, index) => {
            const isActive = activeIndex === index;
            const Icon = point.icon;
            const accent = accentClasses[point.accent];

            return (
              <div
                key={point.title}
                className={cn(
                  'group relative rounded-2xl border bg-slate-800/50 backdrop-blur-xl p-6',
                  'transition-all duration-300 ease-out',
                  'hover:-translate-y-1 hover:bg-slate-800/70 hover:shadow-[0_20px_45px_rgba(0,0,0,0.35)]',
                  'animate-fade-up',
                  gridInView && 'in-view',
                  isActive ? accent.ring : 'border-slate-700/60 hover:border-slate-700/80'
                )}
                style={{ transitionDelay: `${index * 90}ms` }}
                onMouseEnter={() => setActiveIndex(index)}
                onMouseLeave={() => setActiveIndex(null)}
              >
                <div
                  className={cn(
                    'inline-flex h-11 w-11 items-center justify-center rounded-xl',
                    'border border-white/10 bg-white/[0.04]',
                    'shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]',
                    accent.iconBg
                  )}
                >
                  <Icon className={cn('h-5 w-5', accent.icon)} />
                </div>

                <h3 className="mt-5 font-display text-lg font-semibold tracking-tight text-white">
                  {point.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-300">
                  {point.description}
                </p>

                <div className="mt-5 grid grid-cols-[auto,1fr] items-end gap-4">
                  <div className="stat-value text-2xl text-white tabular-nums min-w-[80px]">
                    {point.stat}
                  </div>
                  <div className="text-xs text-slate-300 text-left leading-snug flex flex-col">
                    {point.statLabel.map((line) => (
                      <span key={line}>{line}</span>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div
        ref={quoteRef}
        className={cn(
          'mx-auto mt-12 max-w-3xl px-6',
          'animate-blur-in',
          quoteInView && 'in-view'
        )}
      >
        <div className="rounded-2xl border border-slate-700/60 bg-slate-800/40 backdrop-blur-xl p-7 md:p-8 shadow-[0_20px_45px_rgba(0,0,0,0.25)]">
          <blockquote className="font-display text-lg md:text-xl font-semibold tracking-tight text-white">
            We have 120 open reqs but keep missing hiring goals. What's going wrong?
          </blockquote>
          <p className="mt-4 text-sm md:text-base leading-relaxed text-slate-300">
            <span className="font-semibold text-white">The answer:</span>{' '}
            34 of those reqs are zombies -- no activity in 45+ days. Real open reqs: 86.
            But you'd never know from standard reports.
          </p>
        </div>
      </div>
    </section>
  );
}
