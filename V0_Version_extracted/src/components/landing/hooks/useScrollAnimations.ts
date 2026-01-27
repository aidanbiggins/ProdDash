'use client';

import React from "react"

import { useEffect, useRef, useState, useCallback, RefObject } from 'react';

/**
 * Intersection Observer hook for scroll-triggered animations
 * Returns a ref to attach to the element and whether it's visible
 */
export function useInView<T extends HTMLElement = HTMLElement>(
  options: IntersectionObserverInit = {}
): [RefObject<T | null>, boolean] {
  const ref = useRef<T>(null);
  const [isInView, setIsInView] = useState(false);
  
  const threshold = options.threshold ?? 0.1;
  const rootMargin = options.rootMargin ?? '0px 0px -50px 0px';

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        // Once in view, stay in view (don't re-animate on scroll up)
        if (entry.isIntersecting) {
          setIsInView(true);
        }
      },
      {
        threshold,
        rootMargin,
        root: options.root,
      }
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, [threshold, rootMargin, options.root]);

  return [ref, isInView];
}

/**
 * Staggered animation hook - returns refs and visibility for multiple elements
 */
export function useStaggeredInView<T extends HTMLElement = HTMLElement>(
  count: number,
  staggerDelay: number = 100,
  options: IntersectionObserverInit = {}
): { refs: RefObject<T | null>[]; isVisible: boolean[]; containerRef: RefObject<HTMLElement | null> } {
  const containerRef = useRef<HTMLElement>(null);
  const [visibleItems, setVisibleItems] = useState<boolean[]>(Array(count).fill(false));
  const refs = useRef<RefObject<T | null>[]>(
    Array(count).fill(null).map(() => ({ current: null }))
  ).current;

  const threshold = options.threshold ?? 0.1;
  const rootMargin = options.rootMargin ?? '0px 0px -50px 0px';

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          // Stagger the visibility of each item
          refs.forEach((_, index) => {
            setTimeout(() => {
              setVisibleItems(prev => {
                const next = [...prev];
                next[index] = true;
                return next;
              });
            }, index * staggerDelay);
          });
          observer.disconnect();
        }
      },
      {
        threshold,
        rootMargin,
        root: options.root,
      }
    );

    observer.observe(container);

    return () => observer.disconnect();
  }, [count, staggerDelay, threshold, rootMargin, options.root, refs]);

  return { refs, isVisible: visibleItems, containerRef };
}

/**
 * Parallax hook for creating depth effects on scroll
 * Returns a transform style to apply to the element
 */
export function useParallax(
  speed: number = 0.5,
  direction: 'up' | 'down' = 'up'
): { style: React.CSSProperties; ref: RefObject<HTMLElement | null> } {
  const ref = useRef<HTMLElement>(null);
  const [offset, setOffset] = useState(0);
  const ticking = useRef(false);

  useEffect(() => {
    const handleScroll = () => {
      if (!ticking.current) {
        requestAnimationFrame(() => {
          const element = ref.current;
          if (!element) {
            ticking.current = false;
            return;
          }

          const rect = element.getBoundingClientRect();
          const windowHeight = window.innerHeight;

          // Calculate how far through the viewport the element is
          const scrollProgress = (windowHeight - rect.top) / (windowHeight + rect.height);
          const clampedProgress = Math.max(0, Math.min(1, scrollProgress));

          // Calculate offset based on speed and direction
          const maxOffset = 100 * speed;
          const newOffset = direction === 'up'
            ? (clampedProgress - 0.5) * maxOffset * -1
            : (clampedProgress - 0.5) * maxOffset;

          setOffset(newOffset);
          ticking.current = false;
        });
        ticking.current = true;
      }
    };

    // Use passive listener for better scroll performance
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // Initial calculation

    return () => window.removeEventListener('scroll', handleScroll);
  }, [speed, direction]);

  return {
    ref,
    style: {
      transform: `translateY(${offset}px)`,
      willChange: 'transform',
    },
  };
}

/**
 * Mouse parallax hook for elements that respond to mouse movement
 */
export function useMouseParallax(
  intensity: number = 0.02
): { style: React.CSSProperties; handlers: { onMouseMove: (e: React.MouseEvent) => void; onMouseLeave: () => void } } {
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const x = (e.clientX - centerX) * intensity;
    const y = (e.clientY - centerY) * intensity;

    setPosition({ x, y });
  }, [intensity]);

  const handleMouseLeave = useCallback(() => {
    setPosition({ x: 0, y: 0 });
  }, []);

  return {
    style: {
      transform: `translate(${position.x}px, ${position.y}px)`,
      transition: 'transform 0.3s ease-out',
    },
    handlers: {
      onMouseMove: handleMouseMove,
      onMouseLeave: handleMouseLeave,
    },
  };
}

/**
 * Smooth scroll progress hook
 * Returns a value from 0 to 1 representing page scroll progress
 */
export function useScrollProgress(): number {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          const scrollTop = window.scrollY;
          const docHeight = document.documentElement.scrollHeight - window.innerHeight;
          const scrollProgress = docHeight > 0 ? scrollTop / docHeight : 0;
          setProgress(Math.max(0, Math.min(1, scrollProgress)));
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return progress;
}

/**
 * Scroll velocity hook - returns current scroll speed and direction
 */
export function useScrollVelocity(): { velocity: number; direction: 'up' | 'down' | 'none' } {
  const [velocity, setVelocity] = useState(0);
  const [direction, setDirection] = useState<'up' | 'down' | 'none'>('none');
  const lastScrollY = useRef(0);
  const lastTime = useRef(Date.now());

  useEffect(() => {
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          const currentScrollY = window.scrollY;
          const currentTime = Date.now();
          const timeDelta = currentTime - lastTime.current;

          if (timeDelta > 0) {
            const scrollDelta = currentScrollY - lastScrollY.current;
            const newVelocity = Math.abs(scrollDelta / timeDelta) * 100;

            setVelocity(newVelocity);
            setDirection(scrollDelta > 0 ? 'down' : scrollDelta < 0 ? 'up' : 'none');
          }

          lastScrollY.current = currentScrollY;
          lastTime.current = currentTime;
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return { velocity, direction };
}
