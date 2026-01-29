import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  ArrowRightCircle,
  CheckCircle2,
  Clock3,
  Info,
  XCircle,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useInView } from './hooks/useScrollAnimations';

type TransformStage = 'raw' | 'parsed' | 'normalized' | 'cleaned' | 'insights';

interface StageInfo {
  id: TransformStage;
  title: string;
  description: string;
}

const stages: StageInfo[] = [
  {
    id: 'raw',
    title: 'Raw ATS Export',
    description:
      'Messy data with inconsistent columns, duplicate records, and custom field names from your ATS.',
  },
  {
    id: 'parsed',
    title: 'Smart Parsing',
    description:
      'Auto-detect column types, report format, and data structure. No manual mapping required.',
  },
  {
    id: 'normalized',
    title: 'Stage Normalization',
    description:
      '"Phone Screen", "Recruiter Call", "Initial Interview" all map to SCREEN. Your funnel analysis finally works.',
  },
  {
    id: 'cleaned',
    title: 'Data Hygiene',
    description:
      'Zombie reqs flagged. Ghost candidates identified. Duplicates merged. Bad dates corrected.',
  },
  {
    id: 'insights',
    title: 'Actionable Insights',
    description:
      'True metrics, prioritized risks, and specific actions to take - not just charts and numbers.',
  },
];

export function DataTransformSection() {
  const [activeStage, setActiveStage] = useState<TransformStage>('raw');
  const [isAnimating, setIsAnimating] = useState(false);
  const [minHeights, setMinHeights] = useState({ visual: 0, description: 0 });
  const [headerRef, headerInView] = useInView<HTMLDivElement>({ threshold: 0.2 });
  const [containerRef, containerInView] = useInView<HTMLDivElement>({ threshold: 0.1 });
  const rightColRef = useRef<HTMLDivElement | null>(null);
  const measureRef = useRef<HTMLDivElement | null>(null);

  // Auto-advance through stages for a subtle demo effect (only when in view).
  useEffect(() => {
    if (!containerInView) return;

    let timeout: number | undefined;

    const interval = window.setInterval(() => {
      setIsAnimating(true);
      timeout = window.setTimeout(() => {
        setActiveStage((current) => {
          const currentIndex = stages.findIndex((s) => s.id === current);
          const nextIndex = (currentIndex + 1) % stages.length;
          return stages[nextIndex].id;
        });
        setIsAnimating(false);
      }, 250);
    }, 4200);

    return () => {
      window.clearInterval(interval);
      if (timeout !== undefined) {
        window.clearTimeout(timeout);
      }
    };
  }, [containerInView]);

  useLayoutEffect(() => {
    if (!rightColRef.current || !measureRef.current) return;

    let rafId: number | null = null;

    const updateHeights = () => {
      const visualBlocks = Array.from(
        measureRef.current?.querySelectorAll<HTMLElement>('[data-measure="visual"]') ?? []
      );
      const descBlocks = Array.from(
        measureRef.current?.querySelectorAll<HTMLElement>('[data-measure="desc"]') ?? []
      );

      const visualMax = visualBlocks.length
        ? Math.max(...visualBlocks.map((el) => el.getBoundingClientRect().height))
        : 0;
      const descMax = descBlocks.length
        ? Math.max(...descBlocks.map((el) => el.getBoundingClientRect().height))
        : 0;

      setMinHeights({
        visual: Math.ceil(visualMax),
        description: Math.ceil(descMax),
      });
    };

    // Debounce ResizeObserver callback with requestAnimationFrame to prevent loop
    const debouncedUpdate = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      rafId = requestAnimationFrame(updateHeights);
    };

    updateHeights();
    const resizeObserver = new ResizeObserver(debouncedUpdate);
    resizeObserver.observe(rightColRef.current);

    const timeoutId = window.setTimeout(updateHeights, 150);

    return () => {
      resizeObserver.disconnect();
      window.clearTimeout(timeoutId);
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
    };
  }, []);

  const activeInfo = useMemo(() => stages.find((s) => s.id === activeStage)!, [activeStage]);

  return (
    <section className="relative py-24 md:py-32">
      <div
        ref={headerRef}
        className={cn('mx-auto max-w-2xl px-6 text-center', 'animate-fade-up', headerInView && 'in-view')}
      >
        <span className="inline-flex items-center gap-2 text-xs font-semibold tracking-[0.2em] uppercase text-amber-400/90">
          The Transformation
        </span>
        <h2 className="mt-4 font-display text-3xl md:text-4xl font-bold tracking-tight text-white">
          From Chaos to Clarity in Seconds
        </h2>
        <p className="mt-4 text-base md:text-lg leading-relaxed text-slate-300">
          Watch how PlatoVue turns a messy ATS export into decision-grade intelligence.
        </p>
      </div>

      <div
        ref={containerRef}
        className={cn(
          'mx-auto mt-12 max-w-[1200px] px-6',
          'animate-scale-up',
          containerInView && 'in-view'
        )}
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Stage navigation */}
          <div className="lg:col-span-4">
            <div className="flex lg:flex-col gap-3 overflow-x-auto pb-1 lg:pb-0">
              {stages.map((stage, index) => {
                const active = activeStage === stage.id;

                return (
                  <button
                    key={stage.id}
                    type="button"
                    className={cn(
                      'flex items-center gap-3 rounded-xl border px-4 py-3 text-left',
                      'bg-slate-800/60 backdrop-blur-xl',
                      'transition-all duration-200',
                      'hover:bg-slate-700/70 hover:border-slate-600',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60',
                      'min-w-[240px] lg:min-w-0',
                      active ? 'border-amber-400/50 ring-1 ring-amber-400/30 bg-amber-500/10' : 'border-slate-600/80'
                    )}
                    onClick={() => setActiveStage(stage.id)}
                  >
                    <span
                      className={cn(
                        'flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold',
                        active
                          ? 'border-amber-400/60 bg-amber-500/20 text-amber-300'
                          : 'border-slate-500/40 bg-slate-700/50 text-slate-300'
                      )}
                    >
                      {index + 1}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-white">
                        {stage.title}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-slate-400 uppercase tracking-wider">
                        {stage.id.toUpperCase()}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Visual + description */}
          <div ref={rightColRef} className="lg:col-span-8 space-y-4 relative">
            <div
              className={cn(
                'rounded-2xl border border-slate-600/70 bg-slate-800/70 backdrop-blur-xl p-6',
                'shadow-[0_20px_45px_rgba(0,0,0,0.35)]',
                'transition-opacity duration-200',
                isAnimating && 'opacity-70'
              )}
              style={minHeights.visual ? { minHeight: `${minHeights.visual}px` } : undefined}
            >
              {activeStage === 'raw' && <RawCSVVisual />}
              {activeStage === 'parsed' && <ParsedVisual />}
              {activeStage === 'normalized' && <NormalizedVisual />}
              {activeStage === 'cleaned' && <CleanedVisual />}
              {activeStage === 'insights' && <InsightsVisual />}
            </div>

            <div
              className="rounded-2xl border border-slate-600/70 bg-slate-800/60 backdrop-blur-xl p-6"
              style={minHeights.description ? { minHeight: `${minHeights.description}px` } : undefined}
            >
              <h3 className="font-display text-xl font-semibold tracking-tight text-white">
                {activeInfo.title}
              </h3>
              <p className="mt-2 text-sm md:text-base leading-relaxed text-slate-300">
                {activeInfo.description}
              </p>
            </div>

            <div
              ref={measureRef}
              aria-hidden
              className="absolute left-0 top-0 w-full opacity-0 pointer-events-none"
            >
              {stages.map((stage) => (
                <div key={`${stage.id}-measure`} className="space-y-4">
                  <div
                    data-measure="visual"
                    className="rounded-2xl border border-slate-600/70 bg-slate-800/70 backdrop-blur-xl p-6"
                  >
                    {stage.id === 'raw' && <RawCSVVisual />}
                    {stage.id === 'parsed' && <ParsedVisual />}
                    {stage.id === 'normalized' && <NormalizedVisual />}
                    {stage.id === 'cleaned' && <CleanedVisual />}
                    {stage.id === 'insights' && <InsightsVisual />}
                  </div>
                  <div
                    data-measure="desc"
                    className="rounded-2xl border border-slate-600/70 bg-slate-800/60 backdrop-blur-xl p-6"
                  >
                    <h3 className="font-display text-xl font-semibold tracking-tight text-white">
                      {stage.title}
                    </h3>
                    <p className="mt-2 text-sm md:text-base leading-relaxed text-slate-300">
                      {stage.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function RawCSVVisual() {
  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-xl border border-slate-600/70">
        <div className="grid grid-cols-5 gap-3 bg-slate-700/50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-300">
          <span>Requisition</span>
          <span>Job Title</span>
          <span>Candidate</span>
          <span>Status</span>
          <span>Updated</span>
        </div>

        <div className="divide-y divide-slate-600/50 text-xs bg-slate-800/40">
          <div className="grid grid-cols-5 gap-3 px-3 py-2">
            <span className="font-mono text-slate-300">REQ-001</span>
            <span className="text-white">Sr. Engineer</span>
            <span className="text-white">John D.</span>
            <span>
              <span className="inline-flex items-center rounded-md border border-rose-400/40 bg-rose-500/20 px-2 py-0.5 text-rose-300">
                Phone Scrn
              </span>
            </span>
            <span className="text-slate-400">1/5/24</span>
          </div>
          <div className="grid grid-cols-5 gap-3 px-3 py-2">
            <span className="font-mono text-slate-300">REQ-001</span>
            <span className="text-white">Sr. Engineer</span>
            <span className="text-white">Jane S.</span>
            <span>
              <span className="inline-flex items-center rounded-md border border-rose-400/40 bg-rose-500/20 px-2 py-0.5 text-rose-300">
                Recruiter Phone
              </span>
            </span>
            <span className="text-slate-400">12/15/23</span>
          </div>
          <div className="grid grid-cols-5 gap-3 px-3 py-2">
            <span className="font-mono text-slate-300">REQ-002</span>
            <span className="text-white">Product Manager</span>
            <span className="text-slate-500">-</span>
            <span>
              <span className="inline-flex items-center rounded-md border border-rose-400/40 bg-rose-500/20 px-2 py-0.5 text-rose-300">
                HM Interview
              </span>
            </span>
            <span className="text-slate-400">11/01/23</span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <span className="inline-flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-500/15 px-3 py-1.5 text-xs text-amber-200">
          <AlertTriangle className="h-4 w-4 text-amber-400" />
          Inconsistent stage names
        </span>
        <span className="inline-flex items-center gap-2 rounded-full border border-rose-400/40 bg-rose-500/15 px-3 py-1.5 text-xs text-rose-200">
          <XCircle className="h-4 w-4 text-rose-400" />
          Missing data
        </span>
        <span className="inline-flex items-center gap-2 rounded-full border border-cyan-400/40 bg-cyan-500/15 px-3 py-1.5 text-xs text-cyan-200">
          <Clock3 className="h-4 w-4 text-cyan-400" />
          Stale records
        </span>
      </div>
    </div>
  );
}

function ParsedVisual() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
      <div className="space-y-2">
        <div className="flex items-center gap-2 rounded-lg border border-emerald-400/40 bg-emerald-500/15 px-3 py-2 text-xs text-white">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          <span>Report type detected: iCIMS Submittal</span>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-emerald-400/40 bg-emerald-500/15 px-3 py-2 text-xs text-white">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          <span>Columns detected: 12/12</span>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-emerald-400/40 bg-emerald-500/15 px-3 py-2 text-xs text-white">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          <span>Date format: MM/DD/YY</span>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-amber-400/40 bg-amber-500/15 px-3 py-2 text-xs text-white">
          <AlertCircle className="h-4 w-4 text-amber-400" />
          <span>3 unmapped stages found</span>
        </div>
      </div>

      <div className="rounded-xl border border-slate-600/70 bg-slate-700/40 p-4">
        <div className="text-sm font-semibold uppercase tracking-wide text-slate-300">
          Example mapping
        </div>
        <div className="mt-3 space-y-3 text-xs">
          <MappingRow source="Requisition ID" target="req_id" />
          <MappingRow source="Candidate Name" target="candidate_name" />
          <MappingRow source="Current Status" target="stage" />
        </div>
      </div>
    </div>
  );
}

function MappingRow({ source, target }: { source: string; target: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="font-mono text-slate-300">"{source}"</span>
      <ArrowRight className="h-4 w-4 flex-shrink-0 text-cyan-400" />
      <span className="font-mono text-cyan-300 font-medium">{target}</span>
    </div>
  );
}

function NormalizedVisual() {
  return (
    <div className="space-y-4">
      <div className="text-sm font-semibold uppercase tracking-wide text-slate-300">
        Stage normalization
      </div>

      <div className="space-y-3">
        <NormalizationRow
          before={['Phone Screen', 'Recruiter Phone', 'Initial Call']}
          after="SCREEN"
          tone="cyan"
        />
        <NormalizationRow
          before={['HM Interview', 'Hiring Mgr Review']}
          after="HM_SCREEN"
          tone="amber"
        />
        <NormalizationRow
          before={['Virtual Onsite', 'Onsite Loop']}
          after="ONSITE"
          tone="violet"
        />
      </div>

      <div className="rounded-xl border border-slate-600/70 bg-slate-700/40 p-4 text-sm text-slate-300">
        Funnel analysis works across time periods, even if stage names drift.
      </div>
    </div>
  );
}

function NormalizationRow({
  before,
  after,
  tone,
}: {
  before: string[];
  after: string;
  tone: 'cyan' | 'amber' | 'violet';
}) {
  const toneStyles =
    tone === 'cyan'
      ? 'border-cyan-400/50 bg-cyan-500/25 text-cyan-300'
      : tone === 'amber'
        ? 'border-amber-400/50 bg-amber-500/25 text-amber-300'
        : 'border-violet-400/50 bg-violet-500/25 text-violet-300';

  return (
    <div className="flex items-center gap-3">
      <div className="flex flex-wrap gap-1.5">
        {before.map((s) => (
          <span
            key={s}
            className="inline-flex items-center rounded-full border border-slate-500/50 bg-slate-700/50 px-2.5 py-1 text-xs font-mono text-slate-300"
          >
            "{s}"
          </span>
        ))}
      </div>

      <ArrowRightCircle className="h-5 w-5 flex-shrink-0 text-slate-400" />

      <span
        className={cn(
          'inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold',
          toneStyles
        )}
      >
        {after}
      </span>
    </div>
  );
}

function CleanedVisual() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
      <div className="md:col-span-8 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <CleanStat value="47" label="Zombie reqs identified" note="Excluded from TTF" tone="amber" />
        <CleanStat value="312" label="Ghost candidates flagged" note="Pipeline adjusted" tone="cyan" />
        <CleanStat value="23" label="Duplicates merged" note="Records consolidated" tone="violet" />
      </div>

      <div className="md:col-span-4 flex items-center justify-center">
        <div className="rounded-2xl border border-emerald-400/50 bg-emerald-500/15 px-6 py-7 text-center w-full">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-emerald-400/50 bg-emerald-500/25">
            <div className="stat-value text-3xl text-emerald-300">87</div>
          </div>
          <div className="mt-3 text-sm font-semibold uppercase tracking-wide text-slate-300">
            Data quality score
          </div>
        </div>
      </div>
    </div>
  );
}

function CleanStat({
  value,
  label,
  note,
  tone,
}: {
  value: string;
  label: string;
  note: string;
  tone: 'amber' | 'cyan' | 'violet';
}) {
  const toneStyles =
    tone === 'amber'
      ? { box: 'border-amber-400/50 bg-amber-500/15', value: 'text-amber-300' }
      : tone === 'cyan'
        ? { box: 'border-cyan-400/50 bg-cyan-500/15', value: 'text-cyan-300' }
        : { box: 'border-violet-400/50 bg-violet-500/15', value: 'text-violet-300' };

  return (
    <div className={cn('rounded-xl border p-4', toneStyles.box)}>
      <div className={cn('stat-value text-2xl', toneStyles.value)}>{value}</div>
      <div className="mt-1 text-xs text-slate-300">{label}</div>
      <div className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
        {note}
      </div>
    </div>
  );
}

function InsightsVisual() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <KpiCard label="True TTF" value="41d" note="vs 65d raw" tone="green" />
        <KpiCard label="Accept Rate" value="87%" note="on target" tone="amber" />
        <KpiCard label="HM Latency" value="4.2d" note="above target" tone="rose" />
      </div>

      <div className="rounded-xl border border-slate-600/70 bg-slate-700/40 p-4">
        <div className="text-sm font-semibold uppercase tracking-wide text-slate-300">
          Action queue preview
        </div>
        <div className="mt-3 space-y-2 text-sm">
          <ActionRow tone="rose" icon="alert-circle" text="Offer pending 9 days - Jane Smith" />
          <ActionRow
            tone="amber"
            icon="alert-triangle"
            text="Mike Johnson: 3 candidates waiting for feedback"
          />
          <ActionRow tone="cyan" icon="info" text="REQ-1234: Consider closing (zombie)" />
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  note,
  tone,
}: {
  label: string;
  value: string;
  note: string;
  tone: 'green' | 'amber' | 'rose';
}) {
  const toneStyles =
    tone === 'green'
      ? { box: 'border-emerald-400/50 bg-emerald-500/15', value: 'text-emerald-300' }
      : tone === 'amber'
        ? { box: 'border-amber-400/50 bg-amber-500/15', value: 'text-amber-300' }
        : { box: 'border-rose-400/50 bg-rose-500/15', value: 'text-rose-300' };

  return (
    <div className={cn('rounded-xl border p-4', toneStyles.box)}>
      <div className="text-sm font-semibold uppercase tracking-wide text-slate-300">
        {label}
      </div>
      <div className={cn('stat-value mt-2 text-2xl', toneStyles.value)}>{value}</div>
      <div className="mt-1 text-xs text-slate-300">{note}</div>
    </div>
  );
}

function ActionRow({
  tone,
  icon,
  text,
}: {
  tone: 'rose' | 'amber' | 'cyan';
  icon: 'alert-circle' | 'alert-triangle' | 'info';
  text: string;
}) {
  const Icon =
    icon === 'alert-circle' ? AlertCircle : icon === 'alert-triangle' ? AlertTriangle : Info;
  const toneStyles =
    tone === 'rose'
      ? 'border-rose-400/50 bg-rose-500/20 text-rose-200'
      : tone === 'amber'
        ? 'border-amber-400/50 bg-amber-500/20 text-amber-200'
        : 'border-cyan-400/50 bg-cyan-500/20 text-cyan-200';

  return (
    <div className={cn('flex items-center gap-2 rounded-lg border px-3 py-2', toneStyles)}>
      <Icon className="h-4 w-4 flex-shrink-0" />
      <span className="text-sm">{text}</span>
    </div>
  );
}
