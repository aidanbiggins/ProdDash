import React, { useRef, useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { HeroSection } from './HeroSection';
import { ProblemSection } from './ProblemSection';
import { DataTransformSection } from './DataTransformSection';
import { HowItWorksSection } from './HowItWorksSection';
import { FeaturesSection } from './FeaturesSection';
import { MetricsShowcase } from './MetricsShowcase';
import { ScreenshotsSection } from './ScreenshotsSection';
import { CTASection } from './CTASection';
import { NetworkBackground } from './NetworkBackground';
import { useScrollProgress } from './hooks/useScrollAnimations';
import { LogoHero } from '../LogoHero';
import './landing-animations.css';

export function LandingPage() {
  const navigate = useNavigate();
  const problemRef = useRef<HTMLElement>(null);
  const featuresRef = useRef<HTMLElement>(null);
  const scrollProgress = useScrollProgress();
  const [navScrolled, setNavScrolled] = useState(false);

  // Update nav style based on scroll
  useEffect(() => {
    const handleScroll = () => {
      setNavScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleGetStarted = () => {
    navigate('/login');
  };

  const handleLearnMore = () => {
    problemRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="landing-page dark relative min-h-screen overflow-x-hidden bg-background text-white">
      {/* Network background - connects segments as you scroll */}
      <NetworkBackground scrollProgress={scrollProgress} />

      {/* Scroll progress indicator */}
      <div
        className="fixed top-0 left-0 right-0 h-[2px] z-[200] origin-left bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500"
        style={{ transform: `scaleX(${scrollProgress})` }}
      />

      {/* Elite Navigation */}
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
        {/* Subtle shimmer effect on nav */}
        <div
          className={`
            absolute inset-0 pointer-events-none overflow-hidden
            transition-opacity duration-500
            ${navScrolled ? 'opacity-100' : 'opacity-0'}
          `}
        >
          <div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-amber-500/[0.03] to-transparent bg-[length:200%_100%] animate-shimmer"
          />
        </div>

        <div className="relative max-w-[1200px] mx-auto flex items-center justify-between">
          {/* Logo */}
          <Link
            to="/"
            className="flex items-center gap-2 text-white no-underline hover:opacity-90 transition-opacity"
          >
            <LogoHero />
          </Link>

          {/* Nav Links */}
          <div className="hidden md:flex items-center gap-1">
            <button
              onClick={() => problemRef.current?.scrollIntoView({ behavior: 'smooth' })}
              className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white bg-transparent hover:bg-slate-700 rounded-lg transition-all duration-200"
            >
              Why PlatoVue
            </button>
            <button
              onClick={() => featuresRef.current?.scrollIntoView({ behavior: 'smooth' })}
              className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white bg-transparent hover:bg-slate-700 rounded-lg transition-all duration-200"
            >
              Features
            </button>
            <Link
              to="/about"
              className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white bg-transparent hover:bg-slate-700 rounded-lg transition-all duration-200 no-underline"
            >
              About
            </Link>
          </div>

          {/* Sign In CTA */}
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

      {/* Hero - The Hook */}
      <HeroSection onGetStarted={handleGetStarted} onLearnMore={handleLearnMore} />

      {/* Problem - Why This Matters */}
      <section ref={problemRef}>
        <ProblemSection />
      </section>

      {/* Data Transformation - How It Works (Visual) */}
      <DataTransformSection />

      {/* How It Works - The Process (Steps) */}
      <HowItWorksSection />

      {/* Features - What You Get */}
      <FeaturesSection sectionRef={featuresRef} />

      {/* Metrics Showcase - The Difference */}
      <MetricsShowcase />

      {/* Screenshots - See It In Action */}
      <ScreenshotsSection />

      {/* Final CTA */}
      <CTASection onGetStarted={handleGetStarted} />

      {/* Elite Footer */}
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

export default LandingPage;
