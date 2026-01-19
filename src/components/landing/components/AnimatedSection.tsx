import React, { ReactNode } from 'react';
import { useInView } from '../hooks/useScrollAnimations';

interface AnimatedSectionProps {
  children: ReactNode;
  className?: string;
  animation?: 'fade-up' | 'fade-left' | 'fade-right' | 'scale-up' | 'blur-in';
  delay?: number;
  threshold?: number;
  as?: React.ElementType;
}

export function AnimatedSection({
  children,
  className = '',
  animation = 'fade-up',
  delay = 0,
  threshold = 0.1,
  as: Component = 'div',
}: AnimatedSectionProps) {
  const [ref, isInView] = useInView<HTMLElement>({ threshold });

  const animationClass = `animate-${animation}`;
  const delayStyle = delay > 0 ? { transitionDelay: `${delay}ms` } : {};

  return (
    <Component
      ref={ref as React.RefObject<any>}
      className={`${animationClass} ${isInView ? 'in-view' : ''} ${className}`}
      style={delayStyle}
    >
      {children}
    </Component>
  );
}

interface AnimatedChildrenProps {
  children: ReactNode[];
  className?: string;
  childClassName?: string;
  animation?: 'fade-up' | 'fade-left' | 'fade-right' | 'scale-up' | 'blur-in';
  staggerDelay?: number;
  threshold?: number;
  as?: React.ElementType;
}

/**
 * Wrapper for staggered child animations
 */
export function AnimatedChildren({
  children,
  className = '',
  childClassName = '',
  animation = 'fade-up',
  staggerDelay = 100,
  threshold = 0.1,
  as: Component = 'div',
}: AnimatedChildrenProps) {
  const [ref, isInView] = useInView<HTMLElement>({ threshold });

  const animationClass = `animate-${animation}`;

  return (
    <Component ref={ref as React.RefObject<any>} className={className}>
      {React.Children.map(children, (child, index) => (
        <div
          className={`${animationClass} ${isInView ? 'in-view' : ''} ${childClassName}`}
          style={{ transitionDelay: `${index * staggerDelay}ms` }}
        >
          {child}
        </div>
      ))}
    </Component>
  );
}

interface ParallaxSectionProps {
  children: ReactNode;
  className?: string;
  speed?: number;
  direction?: 'up' | 'down';
}

/**
 * Wrapper for parallax scroll effect
 */
export function ParallaxSection({
  children,
  className = '',
  speed = 0.3,
  direction = 'up',
}: ParallaxSectionProps) {
  const [scrollY, setScrollY] = React.useState(0);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          if (ref.current) {
            const rect = ref.current.getBoundingClientRect();
            const windowHeight = window.innerHeight;
            const progress = (windowHeight - rect.top) / (windowHeight + rect.height);
            const offset = (progress - 0.5) * 100 * speed;
            setScrollY(direction === 'up' ? -offset : offset);
          }
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => window.removeEventListener('scroll', handleScroll);
  }, [speed, direction]);

  return (
    <div ref={ref} className={className}>
      <div
        style={{
          transform: `translateY(${scrollY}px)`,
          willChange: 'transform',
        }}
      >
        {children}
      </div>
    </div>
  );
}
