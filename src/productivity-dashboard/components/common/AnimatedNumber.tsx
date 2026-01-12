// Animated Number Component
// Smoothly transitions between number values to prevent UI jank when filters change

import React, { useEffect, useRef, useState } from 'react';

interface AnimatedNumberProps {
  value: number;
  duration?: number; // Animation duration in ms
  decimals?: number; // Number of decimal places
  prefix?: string; // e.g., "$"
  suffix?: string; // e.g., "%", "d"
  className?: string;
  style?: React.CSSProperties;
  // For layout stability - set minimum width based on expected max digits
  minWidth?: string;
}

export function AnimatedNumber({
  value,
  duration = 400,
  decimals = 0,
  prefix = '',
  suffix = '',
  className = '',
  style = {},
  minWidth,
}: AnimatedNumberProps) {
  const [displayValue, setDisplayValue] = useState(value);
  const previousValue = useRef(value);
  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    // Cancel any ongoing animation
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

    const startValue = previousValue.current;
    const endValue = value;
    const diff = endValue - startValue;

    // Skip animation if no change or if it's the initial render
    if (diff === 0) {
      setDisplayValue(value);
      return;
    }

    startTimeRef.current = null;

    const animate = (timestamp: number) => {
      if (!startTimeRef.current) {
        startTimeRef.current = timestamp;
      }

      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);

      // Easing function (ease-out cubic)
      const easeOut = 1 - Math.pow(1 - progress, 3);

      const currentValue = startValue + diff * easeOut;
      setDisplayValue(currentValue);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        setDisplayValue(endValue);
        previousValue.current = endValue;
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [value, duration]);

  // Update previous value when animation completes
  useEffect(() => {
    previousValue.current = value;
  }, [value]);

  const formattedValue = displayValue.toFixed(decimals);

  return (
    <span
      className={className}
      style={{
        ...style,
        minWidth: minWidth,
        display: 'inline-block',
        fontVariantNumeric: 'tabular-nums', // Monospace numbers for stability
      }}
    >
      {prefix}{formattedValue}{suffix}
    </span>
  );
}

/**
 * Animated stat value with larger display
 * Used for KPI cards and prominent metrics
 */
interface AnimatedStatProps {
  value: number | string | null;
  duration?: number;
  decimals?: number;
  suffix?: string;
  prefix?: string;
  className?: string;
  style?: React.CSSProperties;
  nullDisplay?: string;
}

export function AnimatedStat({
  value,
  duration = 400,
  decimals = 0,
  suffix = '',
  prefix = '',
  className = 'stat-value',
  style = {},
  nullDisplay = '--',
}: AnimatedStatProps) {
  // Handle null/undefined/string values
  if (value === null || value === undefined) {
    return (
      <span className={className} style={style}>
        {nullDisplay}
      </span>
    );
  }

  // Handle string values (like "N/A" or already formatted)
  if (typeof value === 'string') {
    // Try to extract number from string like "45d" or "85%"
    const numMatch = value.match(/^([\d.]+)/);
    if (numMatch) {
      const num = parseFloat(numMatch[1]);
      const extractedSuffix = value.replace(numMatch[1], '');
      return (
        <AnimatedNumber
          value={num}
          duration={duration}
          decimals={decimals}
          prefix={prefix}
          suffix={extractedSuffix || suffix}
          className={className}
          style={style}
        />
      );
    }
    // Return string as-is if no number found
    return (
      <span className={className} style={style}>
        {value}
      </span>
    );
  }

  return (
    <AnimatedNumber
      value={value}
      duration={duration}
      decimals={decimals}
      prefix={prefix}
      suffix={suffix}
      className={className}
      style={style}
    />
  );
}

export default AnimatedNumber;
