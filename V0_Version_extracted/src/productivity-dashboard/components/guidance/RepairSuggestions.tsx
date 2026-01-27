// Repair Suggestions Components
// Display actionable suggestions to improve data quality and unlock features
// See docs/plans/RESILIENT_IMPORT_AND_GUIDANCE_V1.md

import React, { useState } from 'react';
import { RepairSuggestion, CTAAction } from '../../types/resilientImportTypes';
import './guidance.css';

interface RepairSuggestionsProps {
  suggestions: RepairSuggestion[];
  variant?: 'list' | 'drawer';
  onCtaClick?: (action: CTAAction, suggestion: RepairSuggestion) => void;
}

/**
 * Repair Suggestions List
 */
export function RepairSuggestionsList({
  suggestions,
  variant = 'list',
  onCtaClick,
}: RepairSuggestionsProps) {
  if (suggestions.length === 0) {
    return (
      <div className="repair-suggestions empty">
        <p className="text-muted-foreground">No suggestions at this time.</p>
      </div>
    );
  }

  return (
    <div className={`repair-suggestions ${variant}`}>
      <div className="repair-suggestions-header">
        <h3 className="repair-suggestions-title">
          <i className="bi bi-lightbulb mr-2" />
          Data Improvements
        </h3>
      </div>
      <p className="repair-suggestions-subtitle">
        Optional improvements to unlock more features
      </p>

      <div className="suggestion-list">
        {suggestions.map((suggestion) => (
          <RepairSuggestionCard
            key={suggestion.id}
            suggestion={suggestion}
            onCtaClick={onCtaClick}
          />
        ))}
      </div>

      <p className="unavailable-reassurance mt-3">
        <i className="bi bi-info-circle mr-1" />
        You can keep going without these.
      </p>
    </div>
  );
}

/**
 * Individual Suggestion Card
 */
export function RepairSuggestionCard({
  suggestion,
  onCtaClick,
}: {
  suggestion: RepairSuggestion;
  onCtaClick?: (action: CTAAction, suggestion: RepairSuggestion) => void;
}) {
  const handleCtaClick = () => {
    onCtaClick?.(suggestion.cta.action, suggestion);
  };

  return (
    <div className="suggestion-card">
      <div className={`suggestion-priority ${suggestion.priority}`} />
      <div className="suggestion-content">
        <div className="suggestion-title">{suggestion.title}</div>
        <div className="suggestion-description">{suggestion.description}</div>
        <div className="suggestion-impact">
          <i className="bi bi-unlock mr-1" />
          {suggestion.impact}
        </div>
      </div>
      <div className="suggestion-effort">
        <span className={`effort-badge ${suggestion.estimatedEffort}`}>
          {formatEffort(suggestion.estimatedEffort)}
        </span>
        <button
          className="px-3 py-1 text-sm border border-blue-500 text-blue-500 rounded hover:bg-blue-500/10 suggestion-cta"
          onClick={handleCtaClick}
        >
          {suggestion.cta.label}
        </button>
      </div>
    </div>
  );
}

/**
 * Repairs Chip for Dataset Status Bar
 */
export function RepairsChip({
  count,
  onClick,
}: {
  count: number;
  onClick?: () => void;
}) {
  if (count === 0) return null;

  return (
    <button
      className="repairs-chip"
      onClick={onClick}
      title={`${count} data improvement${count !== 1 ? 's' : ''} available`}
    >
      <i className="bi bi-lightbulb" />
      <span className="repairs-chip-count">{count}</span>
      <span>suggestion{count !== 1 ? 's' : ''}</span>
    </button>
  );
}

/**
 * Repairs Drawer (slides in from right)
 */
export function RepairsDrawer({
  suggestions,
  isOpen,
  onClose,
  onCtaClick,
}: {
  suggestions: RepairSuggestion[];
  isOpen: boolean;
  onClose: () => void;
  onCtaClick?: (action: CTAAction, suggestion: RepairSuggestion) => void;
}) {
  if (!isOpen) return null;

  return (
    <div className="repairs-drawer-overlay" onClick={onClose}>
      <div
        className="repairs-drawer"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="repairs-drawer-header">
          <h3 className="repairs-drawer-title">Data Improvements</h3>
          <button
            className="text-gray-400 hover:text-gray-300 text-sm p-0"
            onClick={onClose}
            aria-label="Close drawer"
          >
            <i className="bi bi-x-lg" />
          </button>
        </div>

        <div className="repairs-drawer-body">
          <p className="text-muted-foreground mb-3">
            These optional improvements can help unlock additional features.
          </p>

          <RepairSuggestionsList
            suggestions={suggestions}
            variant="drawer"
            onCtaClick={onCtaClick}
          />
        </div>
      </div>
    </div>
  );
}

/**
 * Post-import suggestions banner
 */
export function PostImportSuggestions({
  suggestions,
  onViewAll,
  onDismiss,
}: {
  suggestions: RepairSuggestion[];
  onViewAll?: () => void;
  onDismiss?: () => void;
}) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || suggestions.length === 0) return null;

  const topThree = suggestions.slice(0, 3);

  return (
    <div className="post-import-suggestions">
      <div className="post-import-header">
        <h4>
          <i className="bi bi-lightbulb mr-2 text-yellow-500" />
          Quick improvements available
        </h4>
        <button
          className="text-gray-400 hover:text-gray-300 text-sm p-0"
          onClick={() => {
            setDismissed(true);
            onDismiss?.();
          }}
          aria-label="Dismiss"
        >
          <i className="bi bi-x" />
        </button>
      </div>

      <div className="post-import-list">
        {topThree.map((s) => (
          <div key={s.id} className="post-import-item">
            <span className={`priority-dot ${s.priority}`} />
            <span className="item-title">{s.title}</span>
            <span className={`effort-tag ${s.estimatedEffort}`}>
              {formatEffort(s.estimatedEffort)}
            </span>
          </div>
        ))}
      </div>

      {suggestions.length > 3 && onViewAll && (
        <button className="text-blue-500 hover:text-blue-400 text-sm" onClick={onViewAll}>
          View all {suggestions.length} suggestions
        </button>
      )}
    </div>
  );
}

// Helper functions

function formatEffort(effort: string): string {
  switch (effort) {
    case 'one-click':
      return 'Quick fix';
    case 'quick':
      return '~1 min';
    case 'moderate':
      return '~5 min';
    default:
      return effort;
  }
}

export default RepairSuggestionsList;
