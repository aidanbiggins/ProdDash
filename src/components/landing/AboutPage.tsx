import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Gauge, Search, Sliders, Zap } from 'lucide-react';
import { LogoHero } from '../LogoHero';
import { NetworkBackground } from './NetworkBackground';
import { useScrollProgress } from './hooks/useScrollAnimations';

export function AboutPage() {
  const scrollProgress = useScrollProgress();
  const [navScrolled, setNavScrolled] = useState(false);

  useEffect(() => {
    document.title = 'About | PlatoVue';
    return () => {
      document.title = 'PlatoVue';
    };
  }, []);

  useEffect(() => {
    const handleScroll = () => setNavScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="landing-page dark relative min-h-screen overflow-x-hidden bg-background text-white">
      <NetworkBackground scrollProgress={scrollProgress} />

      {/* Scroll progress indicator */}
      <div
        className="fixed top-0 left-0 right-0 h-[2px] z-[200] origin-left bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500"
        style={{ transform: `scaleX(${scrollProgress})` }}
      />

      {/* Navigation */}
      <nav
        className={`
          fixed top-0 left-0 right-0 z-[100]
          px-6 md:px-8 py-4
          transition-all duration-500 ease-out
          ${navScrolled
            ? 'bg-slate-900/90 dark:bg-slate-900/95 backdrop-blur-xl shadow-[0_4px_30px_rgba(0,0,0,0.3)] border-b border-white/[0.08]'
            : 'bg-transparent'
          }
        `}
      >
        <div className="relative max-w-[1200px] mx-auto flex items-center justify-between">
          <Link
            to="/"
            className="flex items-center gap-2 text-white no-underline hover:opacity-90 transition-opacity"
          >
            <LogoHero />
          </Link>

          <div className="hidden md:flex items-center gap-1">
            <Link
              to="/"
              className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white bg-transparent hover:bg-slate-700 rounded-lg transition-all duration-200 no-underline"
            >
              Home
            </Link>
            <span className="px-4 py-2 text-sm font-semibold text-white bg-slate-700/40 rounded-lg">
              About
            </span>
          </div>

          <Link
            to="/login"
            className="
              px-5 py-2.5 text-sm font-semibold
              text-white
              bg-white/[0.08] hover:bg-white/[0.15]
              border border-white/[0.15] hover:border-white/[0.25]
              rounded-lg
              backdrop-blur-sm
              transition-all duration-200
              no-underline
              hover:-translate-y-0.5
            "
          >
            Sign In
          </Link>
        </div>
      </nav>

      <main className="relative z-10 pt-32 pb-24">
        <header className="mx-auto max-w-[1100px] px-6">
          <h1 className="font-display text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight leading-tight">
            Recruiting is not a dashboard problem.
            <br />
            <span className="text-slate-400">It's an operating system problem.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-base md:text-lg leading-relaxed text-slate-300">
            PlatoVue is built for talent teams who need signal, not screenshots.
          </p>
        </header>

        <section className="mx-auto mt-16 max-w-[1100px] px-6">
          <div className="rounded-2xl border border-slate-700/60 bg-slate-800/40 backdrop-blur-xl p-7 md:p-10">
            <p className="text-lg md:text-xl leading-relaxed text-white">
              Most hiring teams aren't failing because they lack effort. They're failing because they lack signal.
            </p>
            <div className="mt-5 space-y-4 text-sm md:text-base leading-relaxed text-slate-300">
              <p>
                Time-to-fill becomes a scoreboard. Pipeline health gets guessed. Hiring managers are "reminded"
                instead of held to a clear process. And every week, someone screenshots charts into a deck and
                calls it strategy.
              </p>
              <p className="font-semibold text-white">
                PlatoVue was built to change that.
              </p>
            </div>
          </div>
        </section>

        <section className="mx-auto mt-12 max-w-[1100px] px-6">
          <div className="rounded-2xl border border-slate-700/60 bg-slate-800/40 backdrop-blur-xl p-7 md:p-10">
            <h2 className="font-display text-2xl md:text-3xl font-bold tracking-tight">
              What PlatoVue is
            </h2>
            <p className="mt-4 text-sm md:text-base leading-relaxed text-slate-300">
              PlatoVue is a recruiting intelligence system that turns messy ATS exports into:
            </p>

            <ul className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <AboutFeature
                icon={Gauge}
                title="A control tower"
                description="for what's on fire right now"
                tone="amber"
              />
              <AboutFeature
                icon={Search}
                title="A diagnosis engine"
                description="that explains why it's happening, with evidence"
                tone="cyan"
              />
              <AboutFeature
                icon={Sliders}
                title="A planning layer"
                description="that models what happens if you change something"
                tone="violet"
              />
              <AboutFeature
                icon={Zap}
                title="An action system"
                description="that turns insight into next steps"
                tone="emerald"
              />
            </ul>

            <p className="mt-6 text-sm md:text-base leading-relaxed text-slate-300">
              If the data is complete, the analysis is deep. If the data is messy, PlatoVue adapts and only shows
              what's defensible.
            </p>
          </div>
        </section>

        <section className="mx-auto mt-12 max-w-[1100px] px-6">
          <h2 className="font-display text-2xl md:text-3xl font-bold tracking-tight">
            What makes it different
          </h2>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-5">
            <AboutCard title="It doesn't guess">
              PlatoVue uses coverage and confidence rules to determine what it can and can't say. When a metric is
              not supported by your data, it's gated -- not faked.
            </AboutCard>
            <AboutCard title="It explains, then it acts">
              Every number can be traced back to underlying drivers. Every insight can create an action. This is built
              for real operations, not reporting.
            </AboutCard>
            <AboutCard title="It handles dirty data on purpose">
              Real ATS data is noisy. Columns are inconsistent. Statuses are messy. Dates are missing. PlatoVue ingests
              what you have, heals what it can, and guides you to unlock deeper capabilities if you want them.
            </AboutCard>
            <AboutCard title="Local-first options for sensitive teams">
              Some teams will never be comfortable uploading recruiting data to a third-party system. PlatoVue supports
              modes that keep data local while still delivering useful analysis.
            </AboutCard>
            <AboutCard title="Optional AI, with guardrails" full>
              If you want AI help, PlatoVue supports bring-your-own-key and multiple providers. AI never computes the
              facts. It helps with summaries, drafts, narratives, and decision framing -- grounded in deterministic outputs.
            </AboutCard>
          </div>
        </section>

        <section className="mx-auto mt-12 max-w-[1100px] px-6">
          <div className="rounded-2xl border border-slate-700/60 bg-slate-800/40 backdrop-blur-xl p-7 md:p-10">
            <h2 className="font-display text-2xl md:text-3xl font-bold tracking-tight">
              Who it's for
            </h2>
            <p className="mt-4 text-sm md:text-base text-slate-300">
              PlatoVue is built for:
            </p>
            <ul className="mt-6 space-y-3 text-sm md:text-base text-slate-300">
              <li><span className="font-semibold text-white">Talent leaders</span> who need to answer "Are we on track?" with confidence</li>
              <li><span className="font-semibold text-white">Recruiting Ops teams</span> who want to find bottlenecks and fix systems</li>
              <li><span className="font-semibold text-white">Recruiters</span> who want clarity and leverage, not more busywork</li>
              <li><span className="font-semibold text-white">Hiring managers</span> who want a clean process and faster outcomes</li>
            </ul>
          </div>
        </section>

        <section className="mx-auto mt-12 max-w-[1100px] px-6">
          <div className="rounded-2xl border border-slate-700/60 bg-slate-800/40 backdrop-blur-xl p-7 md:p-10">
            <h2 className="font-display text-2xl md:text-3xl font-bold tracking-tight">
              What we believe
            </h2>
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <Belief title="Truth beats polish." desc="If it can't be defended, it shouldn't be shown." />
              <Belief title="Work should be measurable." desc="Not just hires, but effort, friction, and constraints." />
              <Belief title="Systems beat heroics." desc="Good recruiting is operational excellence, not hustle." />
              <Belief title="Clarity is kindness." desc="The product should reduce conflict, not create it." />
            </div>
          </div>
        </section>

        <section className="mx-auto mt-12 max-w-[1100px] px-6">
          <div className="rounded-3xl border border-slate-700/60 bg-slate-800/40 backdrop-blur-xl p-8 md:p-12">
            <h2 className="font-display text-2xl md:text-3xl font-bold tracking-tight">
              Where this is going
            </h2>
            <p className="mt-4 text-sm md:text-base leading-relaxed text-slate-300">
              The long-term vision is simple: a recruiting system that can tell you:
            </p>

            <ul className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm md:text-base text-slate-300">
              {['what will happen', 'why it will happen', 'what to do next', 'how confident it is', 'what data would make it smarter'].map((item) => (
                <li key={item} className="rounded-xl border border-slate-700/60 bg-slate-800/20 px-4 py-3">
                  {item}
                </li>
              ))}
            </ul>

            <p className="mt-6 text-sm md:text-base text-slate-300">
              If that sounds like the tool you've always wanted, you're in the right place.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row items-center gap-4">
              <Link
                to="/login"
                className="
                  group relative
                  inline-flex items-center justify-center gap-2
                  px-8 py-4 w-full sm:w-auto
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
                  no-underline
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
                <span className="relative z-10">Get Started Free</span>
                <ArrowRight className="relative z-10 h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Link>

              <Link
                to="/"
                className="
                  inline-flex items-center justify-center gap-2
                  px-8 py-4 w-full sm:w-auto
                  text-base font-semibold
                  text-white
                  bg-white/[0.08]
                  border-2 border-white/[0.2]
                  rounded-xl
                  backdrop-blur-sm
                  hover:bg-white/[0.12]
                  hover:border-white/[0.3]
                  hover:-translate-y-0.5
                  active:translate-y-0
                  transition-all duration-200
                  no-underline
                "
              >
                See How It Works
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="relative py-16 px-6 border-t border-slate-700 bg-slate-800/50">
        <div className="max-w-[1200px] mx-auto text-center">
          <div className="mb-6">
            <LogoHero size="sm" />
          </div>
          <p className="text-sm mb-2 text-slate-300">
            Recruiting Intelligence for Modern TA Teams
          </p>
          <p className="text-xs text-slate-300">
            Built for TA leaders who are tired of spreadsheets.
          </p>
        </div>
      </footer>
    </div>
  );
}

function AboutCard({
  title,
  children,
  full = false,
}: {
  title: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <article
      className={`rounded-2xl border border-slate-700/60 bg-slate-800/40 backdrop-blur-xl p-6 ${full ? 'md:col-span-2' : ''}`}
    >
      <h3 className="font-display text-lg font-semibold tracking-tight text-white">
        {title}
      </h3>
      <p className="mt-3 text-sm leading-relaxed text-slate-300">
        {children}
      </p>
    </article>
  );
}

function AboutFeature({
  icon: Icon,
  title,
  description,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  tone: 'amber' | 'cyan' | 'violet' | 'emerald';
}) {
  const toneClasses =
    tone === 'amber'
      ? { icon: 'text-amber-300', bg: 'bg-amber-500/10', ring: 'ring-1 ring-amber-400/15' }
      : tone === 'cyan'
        ? { icon: 'text-cyan-300', bg: 'bg-cyan-500/10', ring: 'ring-1 ring-cyan-400/15' }
        : tone === 'violet'
          ? { icon: 'text-violet-300', bg: 'bg-violet-500/10', ring: 'ring-1 ring-violet-400/15' }
          : { icon: 'text-emerald-300', bg: 'bg-emerald-500/10', ring: 'ring-1 ring-emerald-400/15' };

  return (
    <li className="rounded-2xl border border-slate-700/60 bg-slate-800/50 p-5">
      <div className="flex items-start gap-3">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] ${toneClasses.bg} ${toneClasses.ring}`}
        >
          <Icon className={`h-5 w-5 ${toneClasses.icon}`} />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-white">
            {title}{' '}
            <span className="font-normal text-slate-300">{description}</span>
          </div>
        </div>
      </div>
    </li>
  );
}

function Belief({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="rounded-xl border border-slate-700/60 bg-slate-800/20 px-5 py-4">
      <div className="font-semibold text-white">{title}</div>
      <div className="mt-1 text-sm text-slate-300">{desc}</div>
    </div>
  );
}

export default AboutPage;

