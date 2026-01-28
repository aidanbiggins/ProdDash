import React from 'react';
import { Clock3, Download, UploadCloud, Zap } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useInView } from './hooks/useScrollAnimations';

interface Step {
  number: number;
  title: string;
  description: string;
  time: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: 'amber' | 'cyan' | 'violet';
}

const steps: Step[] = [
  {
    number: 1,
    title: 'Export from Your ATS',
    description:
      'Pull a standard CSV or Excel export from iCIMS, Greenhouse, Lever, Workday, or any ATS. No special setup required.',
    time: '2 min',
    icon: Download,
    accent: 'amber',
  },
  {
    number: 2,
    title: 'Import to PlatoVue',
    description:
      'Drag and drop your file. We auto-detect columns, report type, and date formats. No manual mapping.',
    time: '30 sec',
    icon: UploadCloud,
    accent: 'cyan',
  },
  {
    number: 3,
    title: 'See Your Insights',
    description:
      'Immediately see true metrics, prioritized risks, and specific actions. No waiting, no building reports.',
    time: 'Instant',
    icon: Zap,
    accent: 'violet',
  },
];

export function HowItWorksSection() {
  const [headerRef, headerInView] = useInView<HTMLDivElement>({ threshold: 0.2 });
  const [stepsRef, stepsInView] = useInView<HTMLDivElement>({ threshold: 0.1 });
  const [logosRef, logosInView] = useInView<HTMLDivElement>({ threshold: 0.3 });

  const accents: Record<Step['accent'], { icon: string; bg: string; ring: string }> = {
    amber: { icon: 'text-amber-300', bg: 'bg-amber-500/10', ring: 'ring-1 ring-amber-400/15' },
    cyan: { icon: 'text-cyan-300', bg: 'bg-cyan-500/10', ring: 'ring-1 ring-cyan-400/15' },
    violet: { icon: 'text-violet-300', bg: 'bg-violet-500/10', ring: 'ring-1 ring-violet-400/15' },
  };

  return (
    <section className="relative py-24 md:py-32">
      <div
        ref={headerRef}
        className={cn('mx-auto max-w-2xl px-6 text-center', 'animate-fade-up', headerInView && 'in-view')}
      >
        <span className="inline-flex items-center gap-2 text-xs font-semibold tracking-[0.2em] uppercase text-amber-400/90">
          How It Works
        </span>
        <h2 className="mt-4 font-display text-3xl md:text-4xl font-bold tracking-tight text-white">
          From Export to Insight in Under 5 Minutes
        </h2>
        <p className="mt-4 text-base md:text-lg leading-relaxed text-slate-300">
          No integrations to build. No IT tickets to file. Just export, import, and see.
        </p>
      </div>

      <div ref={stepsRef} className="mx-auto mt-12 max-w-[1200px] px-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {steps.map((step, index) => {
            const Icon = step.icon;
            const accent = accents[step.accent];

            return (
              <div
                key={step.number}
                className={cn(
                  'rounded-2xl border border-slate-700/60 bg-slate-800/50 backdrop-blur-xl p-6',
                  'transition-all duration-300 ease-out',
                  'hover:-translate-y-1 hover:bg-slate-800/70 hover:border-slate-700/80 hover:shadow-[0_20px_45px_rgba(0,0,0,0.35)]',
                  'animate-scale-up',
                  stepsInView && 'in-view'
                )}
                style={{ transitionDelay: `${index * 120}ms` }}
              >
                <div className="flex items-center justify-between">
                  <div
                    className={cn(
                      'flex h-11 w-11 items-center justify-center rounded-xl',
                      'border border-white/10 bg-white/[0.04]',
                      'shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]',
                      accent.bg,
                      accent.ring
                    )}
                  >
                    <Icon className={cn('h-5 w-5', accent.icon)} />
                  </div>

                  <div className="text-sm font-bold text-slate-300">
                    0{step.number}
                  </div>
                </div>

                <h3 className="mt-5 font-display text-lg font-semibold tracking-tight text-white">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-300">
                  {step.description}
                </p>

                <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-slate-700/60 bg-slate-800/20 px-3 py-1.5 text-xs text-slate-300">
                  <Clock3 className="h-4 w-4 text-slate-300" />
                  <span className="font-semibold text-white/80">{step.time}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div
        ref={logosRef}
        className={cn(
          'mx-auto mt-12 max-w-[1000px] px-6 text-center',
          'animate-fade-up',
          logosInView && 'in-view'
        )}
      >
        <p className="text-sm text-slate-300">Works with exports from:</p>
        <div className="mt-5 flex flex-wrap justify-center gap-2.5">
          {['iCIMS', 'Greenhouse', 'Lever', 'Workday', '+ Any Export'].map((logo, i) => (
            <span
              key={logo}
              className={cn(
                'inline-flex items-center rounded-full border border-slate-700/60 bg-slate-800/20 px-4 py-2',
                'text-sm font-semibold text-white/90',
                'transition-all duration-200',
                'hover:-translate-y-0.5 hover:bg-slate-800/30 hover:border-slate-700/80',
                'animate-scale-up',
                logosInView && 'in-view'
              )}
              style={{ transitionDelay: `${i * 70}ms` }}
            >
              {logo}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

