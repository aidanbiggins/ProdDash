import React, { useEffect, useState, useRef } from 'react';
import { LogoIcon } from '../LogoIcon';
import { ArrowRight, ChevronDown, Zap, Shield, CheckCircle2 } from 'lucide-react';

interface HeroSectionProps {
  onGetStarted: () => void;
  onLearnMore: () => void;
}

export function HeroSection({ onGetStarted, onLearnMore }: HeroSectionProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [viewportSize, setViewportSize] = useState(1200);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const heroRef = useRef<HTMLElement>(null);

  // Trigger entrance animations after mount
  useEffect(() => {
    const timer = setTimeout(() => setIsLoaded(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // Track viewport size for responsive dodecahedron
  useEffect(() => {
    const updateSize = () => {
      setViewportSize(Math.max(window.innerWidth, window.innerHeight) * 1.2);
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Track mouse for subtle parallax
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!heroRef.current) return;
      const rect = heroRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left - rect.width / 2) / rect.width;
      const y = (e.clientY - rect.top - rect.height / 2) / rect.height;
      setMousePosition({ x: x * 20, y: y * 20 });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const valueProps = [
    { text: 'True metrics (zombie reqs excluded)', delay: 350 },
    { text: 'SLA tracking & bottleneck detection', delay: 400 },
    { text: 'What-if scenario modeling', delay: 450 },
    { text: 'Prioritized action queue', delay: 500 },
  ];

  return (
    <section
      ref={heroRef}
      className="landing-hero relative min-h-screen flex flex-col justify-center items-center text-center overflow-hidden"
    >
      {/* Ambient gradient orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute w-[800px] h-[800px] rounded-full opacity-30 blur-[120px]"
          style={{
            background: 'radial-gradient(circle, rgba(245,158,11,0.4) 0%, transparent 70%)',
            top: '-20%',
            left: '50%',
            transform: `translate(-50%, 0) translate(${mousePosition.x * 0.5}px, ${mousePosition.y * 0.5}px)`,
            transition: 'transform 0.3s ease-out',
          }}
        />
        <div
          className="absolute w-[600px] h-[600px] rounded-full opacity-20 blur-[100px]"
          style={{
            background: 'radial-gradient(circle, rgba(6,182,212,0.5) 0%, transparent 70%)',
            bottom: '10%',
            right: '-10%',
            transform: `translate(${mousePosition.x * -0.3}px, ${mousePosition.y * -0.3}px)`,
            transition: 'transform 0.3s ease-out',
          }}
        />
        <div
          className="absolute w-[500px] h-[500px] rounded-full opacity-15 blur-[80px]"
          style={{
            background: 'radial-gradient(circle, rgba(139,92,246,0.5) 0%, transparent 70%)',
            bottom: '20%',
            left: '-5%',
            transform: `translate(${mousePosition.x * 0.2}px, ${mousePosition.y * 0.2}px)`,
            transition: 'transform 0.3s ease-out',
          }}
        />
      </div>

      {/* Massive dodecahedron background */}
      <div
        className="absolute inset-0 flex items-center justify-center pointer-events-none"
        style={{
          opacity: isLoaded ? 0.2 : 0,
          transform: `translate(${mousePosition.x * -0.5}px, ${mousePosition.y * -0.5}px)`,
          transition: 'opacity 1.5s ease-out, transform 0.5s ease-out',
          filter: 'blur(1px)',
        }}
      >
        <LogoIcon size={viewportSize} pulse={true} />
      </div>

      {/* Noise texture overlay */}
      <div
        className="absolute inset-0 opacity-[0.015] pointer-events-none mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Main hero content */}
      <div className="relative z-10 max-w-4xl mx-auto px-6 pt-32 pb-16">

        {/* Floating badge with glass effect */}
        <div
          className={`
            inline-flex items-center gap-2.5 mb-8
            px-5 py-2.5 rounded-full
            bg-amber-500/10 dark:bg-amber-500/15
            border border-amber-500/30 dark:border-amber-500/40
            backdrop-blur-md
            shadow-[0_0_30px_rgba(245,158,11,0.15),inset_0_1px_0_rgba(255,255,255,0.1)]
            transition-all duration-700 ease-out
            ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}
          `}
          style={{ transitionDelay: '0ms' }}
        >
          <Zap className="w-4 h-4 text-amber-500 dark:text-amber-400 animate-pulse" />
          <span className="text-sm font-semibold tracking-wide text-amber-600 dark:text-amber-400">
            Data to insights in under 5 minutes
          </span>
        </div>

        {/* Main headline with gradient */}
        <h1
          className={`
            text-5xl sm:text-6xl md:text-7xl lg:text-8xl
            font-display font-bold tracking-tight leading-[0.95]
            mb-8
            transition-all duration-700 ease-out
            ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}
          `}
          style={{ transitionDelay: '100ms' }}
        >
          <span className="block text-white">
            Stop Guessing.
          </span>
          <span
            className="block mt-2 bg-clip-text text-transparent bg-[length:200%_200%] animate-gradient-shift"
            style={{ backgroundImage: 'linear-gradient(135deg, #f59e0b 0%, #fb923c 50%, #f59e0b 100%)' }}
          >
            Start Knowing.
          </span>
        </h1>

        {/* Subheadline */}
        <p
          className={`
            text-lg sm:text-xl md:text-2xl
            max-w-2xl mx-auto mb-8
            leading-relaxed
            text-slate-300
            transition-all duration-700 ease-out
            ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}
          `}
          style={{ transitionDelay: '200ms' }}
        >
          Your ATS has the data. PlatoVue reveals the story -- why reqs stall,
          where candidates drop off, and exactly what to do next.
        </p>

        {/* Value props in a refined grid */}
        <div
          className={`
            grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl mx-auto mb-12
            transition-all duration-700 ease-out
            ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}
          `}
          style={{ transitionDelay: '300ms' }}
        >
          {valueProps.map((prop, idx) => (
            <div
              key={idx}
              className={`
                flex items-center gap-2.5 px-4 py-2.5
                rounded-lg
                bg-slate-800/60 border border-slate-700/50
                backdrop-blur-sm
                transition-all duration-500 ease-out
                ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}
              `}
              style={{ transitionDelay: `${prop.delay}ms` }}
            >
              <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-400" />
              <span className="text-sm text-left text-white">
                {prop.text}
              </span>
            </div>
          ))}
        </div>

        {/* CTA Buttons */}
        <div
          className={`
            flex flex-col sm:flex-row items-center justify-center gap-4 mb-8
            transition-all duration-700 ease-out
            ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}
          `}
          style={{ transitionDelay: '550ms' }}
        >
          {/* Primary CTA with shimmer */}
          <button
            onClick={onGetStarted}
            className="
              group relative
              inline-flex items-center justify-center gap-2
              px-8 py-4 w-full sm:w-auto
              text-base font-semibold
              text-slate-900 dark:text-slate-900
              bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500
              rounded-xl
              shadow-[0_4px_24px_rgba(245,158,11,0.4)]
              hover:shadow-[0_8px_32px_rgba(245,158,11,0.5)]
              hover:-translate-y-0.5
              active:translate-y-0
              transition-all duration-200
              overflow-hidden
            "
          >
            {/* Shimmer effect */}
            <div
              className="
                absolute inset-0
                bg-gradient-to-r from-transparent via-white/30 to-transparent
                -translate-x-full group-hover:translate-x-full
                transition-transform duration-1000 ease-out
              "
            />
            <span className="relative z-10">Get Started Free</span>
            <ArrowRight className="relative z-10 w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>

          {/* Secondary CTA */}
          <button
            onClick={onLearnMore}
            className="
              group
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
            "
          >
            <span>See How It Works</span>
            <ChevronDown className="w-4 h-4 group-hover:translate-y-0.5 transition-transform" />
          </button>
        </div>

        {/* Trust badge */}
        <div
          className={`
            inline-flex items-center gap-2
            text-sm text-slate-300
            transition-all duration-700 ease-out
            ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}
          `}
          style={{ transitionDelay: '650ms' }}
        >
          <Shield className="w-4 h-4 text-emerald-400" />
          <span>No credit card required. Import your own data.</span>
        </div>
      </div>

      {/* Scroll indicator */}
      <div
        className={`
          absolute bottom-8 left-1/2 -translate-x-1/2
          transition-all duration-1000 ease-out
          ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}
        `}
        style={{ transitionDelay: '800ms' }}
      >
        <div className="flex flex-col items-center gap-2 text-slate-300">
          <span className="text-xs uppercase tracking-widest">Scroll</span>
          <div className="w-6 h-10 rounded-full border-2 border-current flex justify-center pt-2">
            <div className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" />
          </div>
        </div>
      </div>

    </section>
  );
}
