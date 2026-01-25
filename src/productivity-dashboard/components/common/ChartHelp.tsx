/**
 * ChartHelp - Collapsible help text for charts
 *
 * A compact, toggleable help component that reduces visual clutter
 * by hiding explanatory text behind a "How to read" button.
 */

import React, { useState } from 'react';

interface ChartHelpProps {
  /** The help text to display when expanded */
  text: string;
  /** Optional: Custom button label when collapsed (default: "How to read") */
  collapsedLabel?: string;
  /** Optional: Custom button label when expanded (default: "Hide help") */
  expandedLabel?: string;
  /** Optional: Additional CSS class for the container */
  className?: string;
}

export function ChartHelp({
  text,
  collapsedLabel = 'How to read',
  expandedLabel = 'Hide help',
  className = ''
}: ChartHelpProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={`chart-help ${className}`}>
      <button
        className="px-1 py-0.5 text-sm flex items-center gap-1"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          background: 'transparent',
          border: 'none',
          color: '#6b7280',
          fontSize: '0.7rem',
          padding: '2px 4px'
        }}
        aria-expanded={isOpen}
        aria-label={isOpen ? expandedLabel : collapsedLabel}
      >
        <i className={`bi ${isOpen ? 'bi-info-circle-fill' : 'bi-info-circle'}`}></i>
        {isOpen ? expandedLabel : collapsedLabel}
      </button>
      {isOpen && (
        <div
          className="mt-1 p-2 rounded"
          style={{
            background: '#141414',
            fontSize: '0.75rem',
            color: '#94A3B8',
            lineHeight: 1.4
          }}
        >
          {text}
        </div>
      )}
    </div>
  );
}

export default ChartHelp;
