// InlineHelp - Davos Glass Design System
// Info icon with tooltip or collapsible help text
import React, { useState } from 'react';

interface InlineHelpProps {
  text: string;
  mode?: 'tooltip' | 'collapse';
  className?: string;
}

export function InlineHelp({
  text,
  mode = 'tooltip',
  className = ''
}: InlineHelpProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (mode === 'tooltip') {
    return (
      <span
        className={`inline-help inline-help-tooltip ${className}`}
        title={text}
      >
        <i className="bi bi-info-circle"></i>
      </span>
    );
  }

  return (
    <span className={`inline-help ${className}`}>
      <button
        type="button"
        className="inline-help-toggle"
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
      >
        <i className={`bi bi-${isExpanded ? 'dash' : 'plus'}-circle`}></i>
      </button>
      {isExpanded && (
        <span className="inline-help-content">
          {text}
        </span>
      )}
    </span>
  );
}
