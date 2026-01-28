import React from 'react';
import { ArrowRight } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useInView } from './hooks/useScrollAnimations';

interface CTASectionProps {
  onGetStarted: () => void;
}

export function CTASection({ onGetStarted }: CTASectionProps) {
  const [ref, isInView] = useInView<HTMLDivElement>({ threshold: 0.3 });

  return (
    <section className="relative py-24 md:py-32">
      <div
        ref={ref}
        className={cn(
          'mx-auto max-w-[900px] px-6',
          'animate-blur-in',
          isInView && 'in-view'
        )}
      >
        <div className="rounded-3xl border border-slate-700/60 bg-slate-800/40 backdrop-blur-xl p-10 md:p-12 text-center shadow-[0_24px_60px_rgba(0,0,0,0.35)]">
          <h2 className="font-display text-3xl md:text-4xl font-bold tracking-tight text-white">
            Ready to Transform Your Recruiting Analytics?
          </h2>
          <p className="mt-4 text-base md:text-lg leading-relaxed text-slate-300">
            Import your ATS data and get insights in minutes. No credit card required.
          </p>

          <div className="mt-8 flex justify-center">
            <button
              type="button"
              onClick={onGetStarted}
              className="
                group relative
                inline-flex items-center justify-center gap-2
                px-8 py-4 min-w-[220px]
                text-base font-semibold
                text-slate-900 dark:text-slate-900
                bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500
                rounded-xl
                shadow-[0_8px_32px_rgba(245,158,11,0.35)]
                hover:shadow-[0_12px_40px_rgba(245,158,11,0.45)]
                hover:-translate-y-0.5
                active:translate-y-0
                transition-all duration-200
                overflow-hidden
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/50
              "
            >
              <div
                className="
                  absolute inset-0
                  bg-gradient-to-r from-transparent via-white/30 to-transparent
                  -translate-x-full group-hover:translate-x-full
                  transition-transform duration-1000 ease-out
                "
              />
              <span className="relative z-10">Start Free Today</span>
              <ArrowRight className="relative z-10 h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

