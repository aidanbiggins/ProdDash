import React, { useEffect, useMemo, useState } from 'react';
import { cn } from '../../lib/utils';
import { useInView } from './hooks/useScrollAnimations';

export function ScreenshotsSection() {
  const [headerRef, headerInView] = useInView<HTMLDivElement>({ threshold: 0.2 });
  const [mockupRef, mockupInView] = useInView<HTMLDivElement>({ threshold: 0.2 });
  const [barsAnimated, setBarsAnimated] = useState(false);

  const kpis = useMemo(
    () => [
      { label: 'Median TTF', value: '32', unit: 'days', tone: 'amber' as const },
      { label: 'Offers', value: '24', unit: '', tone: 'slate' as const },
      { label: 'Accept Rate', value: '87', unit: '%', tone: 'emerald' as const },
      { label: 'Stalled Reqs', value: '3', unit: '', tone: 'cyan' as const },
    ],
    []
  );

  const barHeights = useMemo(() => [45, 72, 58, 85, 63, 78, 92, 68, 55, 80, 73, 88], []);
  const barColors = useMemo(
    () => [
      '#f59e0b',
      '#06b6d4',
      '#8b5cf6',
      '#22c55e',
      '#f59e0b',
      '#06b6d4',
      '#8b5cf6',
      '#22c55e',
      '#f59e0b',
      '#06b6d4',
      '#8b5cf6',
      '#22c55e',
    ],
    []
  );

  useEffect(() => {
    if (mockupInView && !barsAnimated) {
      const t = window.setTimeout(() => setBarsAnimated(true), 250);
      return () => window.clearTimeout(t);
    }
  }, [mockupInView, barsAnimated]);

  const toneClass: Record<(typeof kpis)[number]['tone'], string> = {
    amber: 'text-amber-200',
    cyan: 'text-cyan-200',
    emerald: 'text-emerald-200',
    slate: 'text-white',
  };

  return (
    <section className="relative py-24 md:py-32">
      <div
        ref={headerRef}
        className={cn('mx-auto max-w-2xl px-6 text-center', 'animate-fade-up', headerInView && 'in-view')}
      >
        <h2 className="font-display text-3xl md:text-4xl font-bold tracking-tight text-white">
          See Your Pipeline at a Glance
        </h2>
        <p className="mt-4 text-base md:text-lg leading-relaxed text-slate-400">
          Real-time dashboards that update as your data changes. No more stale spreadsheets.
        </p>
      </div>

      <div className="mx-auto mt-12 max-w-[1200px] px-6">
        <div
          ref={mockupRef}
          className={cn('animate-scale-up', mockupInView && 'in-view')}
        >
          <div className="rounded-2xl border border-slate-700/60 bg-slate-800/40 backdrop-blur-xl shadow-[0_20px_45px_rgba(0,0,0,0.25)] overflow-hidden">
            {/* Window chrome */}
            <div className="flex items-center gap-2 border-b border-slate-700/60 bg-slate-800/20 px-4 py-3">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-400/80" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-300/80" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
              <span className="ml-3 text-xs font-semibold tracking-widest uppercase text-slate-300">
                PlatoVue Preview
              </span>
            </div>

            <div className="p-5 md:p-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {kpis.map((kpi, index) => (
                  <div
                    key={kpi.label}
                    className={cn(
                      'rounded-xl border border-slate-700/60 bg-slate-800/50 p-4',
                      'animate-fade-up',
                      mockupInView && 'in-view'
                    )}
                    style={{ transitionDelay: `${index * 90 + 180}ms` }}
                  >
                    <div className="text-sm font-semibold uppercase tracking-wide text-slate-300">
                      {kpi.label}
                    </div>
                    <div className={cn('stat-value mt-2 text-2xl', toneClass[kpi.tone])}>
                      {kpi.value}
                      <span className="ml-1 text-sm text-slate-300">{kpi.unit}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div
                className={cn(
                  'mt-5 rounded-xl border border-slate-700/60 bg-slate-800/20 p-4',
                  'animate-fade-up',
                  mockupInView && 'in-view'
                )}
                style={{ transitionDelay: '520ms' }}
              >
                <div className="text-sm font-semibold uppercase tracking-wide text-slate-300">
                  Pipeline Velocity (12 weeks)
                </div>

                <div className="mt-4 flex items-end gap-2 h-32">
                  {barHeights.map((height, index) => (
                    <div
                      key={index}
                      className="flex-1 rounded-md"
                      style={{
                        height: barsAnimated ? `${height}%` : '0%',
                        background: barColors[index],
                        opacity: 0.75,
                        transition: `height 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) ${index * 45}ms`,
                      }}
                    />
                  ))}
                </div>

                <div className="mt-4 flex justify-between text-xs text-slate-300">
                  <span>Week 1</span>
                  <span>Week 12</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

