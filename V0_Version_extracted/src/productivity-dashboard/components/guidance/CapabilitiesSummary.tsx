// Capabilities Summary Component
// Shows what features are available with current data and what can be unlocked
// See docs/plans/RESILIENT_IMPORT_AND_GUIDANCE_V1.md

import React from 'react';
import {
  CoverageMetrics,
  CapabilityStatus,
  RepairSuggestion,
} from '../../types/resilientImportTypes';
import {
  getAllCapabilityStatuses,
  getEnabledFeatures,
  getDisabledFeatures,
} from '../../services/capabilityRegistry';
import { getTopSuggestions } from '../../services/repairSuggestionsService';
import './guidance.css';

interface CapabilitiesSummaryProps {
  coverage: CoverageMetrics;
  suggestions?: RepairSuggestion[];
  variant?: 'full' | 'compact' | 'drawer';
  onGoToDashboard?: () => void;
  onImportMore?: () => void;
  onSuggestionClick?: (suggestion: RepairSuggestion) => void;
}

/**
 * Capabilities Summary - shows what's available with current data
 */
export function CapabilitiesSummary({
  coverage,
  suggestions = [],
  variant = 'full',
  onGoToDashboard,
  onImportMore,
  onSuggestionClick,
}: CapabilitiesSummaryProps) {
  const capabilities = getAllCapabilityStatuses(coverage);
  const enabledFeatures = getEnabledFeatures(coverage);
  const disabledFeatures = getDisabledFeatures(coverage);
  const topSuggestions = getTopSuggestions(suggestions, 3);

  // Count by status
  const enabledCount = capabilities.filter(c => c.enabled).length;
  const totalCount = capabilities.length;

  // Find partial features (enabled but with low coverage)
  const partialFeatures = capabilities.filter(c =>
    c.enabled && c.requirements.some(r => r.met && r.currentValue !== undefined && r.currentValue < 80)
  );

  if (variant === 'compact') {
    return (
      <CompactSummary
        enabledCount={enabledCount}
        totalCount={totalCount}
        suggestions={topSuggestions}
      />
    );
  }

  return (
    <div className="capabilities-summary">
      <div className="capabilities-header">
        <h2 className="capabilities-title">
          {variant === 'drawer' ? 'Data Capabilities' : 'Import Complete'}
        </h2>
        <span className="capabilities-count">
          {enabledCount} of {totalCount} features enabled
        </span>
      </div>

      <p className="capabilities-intro">
        With your data, PlatoVue can:
      </p>

      {/* Enabled Features */}
      <div className="capabilities-section">
        <div className="capabilities-section-header">Available Features</div>
        <ul className="feature-list">
          {enabledFeatures.slice(0, 5).map((feature, index) => (
            <li key={index} className="feature-item">
              <span className="feature-icon enabled">
                <i className="bi bi-check-circle-fill" />
              </span>
              <span className="feature-text">{getFeatureDescription(feature, coverage)}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Partial Features */}
      {partialFeatures.length > 0 && (
        <div className="capabilities-section">
          <div className="capabilities-section-header">Partially Available</div>
          <ul className="feature-list">
            {partialFeatures.map((cap, index) => {
              const lowReq = cap.requirements.find(r =>
                r.met && r.currentValue !== undefined && r.currentValue < 80
              );
              return (
                <li key={index} className="feature-item">
                  <span className="feature-icon partial">
                    <i className="bi bi-circle-half" />
                  </span>
                  <span className="feature-text">{cap.displayName}</span>
                  {lowReq?.currentValue !== undefined && (
                    <span className="feature-coverage">
                      ({lowReq.currentValue}% coverage)
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Disabled Features */}
      {disabledFeatures.length > 0 && (
        <div className="capabilities-section">
          <div className="capabilities-section-header">Unlock more features:</div>
          <ul className="feature-list">
            {disabledFeatures.slice(0, 4).map((feature, index) => (
              <li key={index} className="feature-item">
                <span className="feature-icon disabled">
                  <i className="bi bi-circle" />
                </span>
                <span className="feature-text">{feature.name}</span>
                {feature.hint && onSuggestionClick && (
                  <span
                    className="feature-hint"
                    onClick={() => {
                      const relatedSuggestion = suggestions.find(s =>
                        s.affectedCapabilities.some(c => c.includes(feature.name.toLowerCase().replace(/\s+/g, '_')))
                      );
                      if (relatedSuggestion) {
                        onSuggestionClick(relatedSuggestion);
                      }
                    }}
                  >
                    {feature.hint}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Top Suggestions */}
      {topSuggestions.length > 0 && (
        <div className="capabilities-section">
          <div className="capabilities-section-header">Quick wins:</div>
          <div className="suggestion-list">
            {topSuggestions.map(suggestion => (
              <SuggestionCard
                key={suggestion.id}
                suggestion={suggestion}
                onClick={onSuggestionClick}
              />
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      {(onGoToDashboard || onImportMore) && (
        <div className="capabilities-actions">
          {onGoToDashboard && (
            <button
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              onClick={onGoToDashboard}
            >
              Go to Dashboard
            </button>
          )}
          {onImportMore && (
            <button
              className="px-4 py-2 border border-gray-500 text-gray-300 rounded-md hover:bg-gray-700"
              onClick={onImportMore}
            >
              Import More Data
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Compact inline summary for header/status bar
 */
function CompactSummary({
  enabledCount,
  totalCount,
  suggestions,
}: {
  enabledCount: number;
  totalCount: number;
  suggestions: RepairSuggestion[];
}) {
  return (
    <div className="capabilities-compact">
      <span className="compact-status">
        <i className="bi bi-check-circle-fill text-green-500 mr-1" />
        {enabledCount} features enabled
      </span>
      {suggestions.length > 0 && (
        <span className="compact-upgrades">
          {suggestions.length} upgrade{suggestions.length !== 1 ? 's' : ''} available
        </span>
      )}
    </div>
  );
}

/**
 * Suggestion card
 */
function SuggestionCard({
  suggestion,
  onClick,
}: {
  suggestion: RepairSuggestion;
  onClick?: (s: RepairSuggestion) => void;
}) {
  return (
    <div
      className="suggestion-card"
      onClick={() => onClick?.(suggestion)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          onClick?.(suggestion);
        }
      }}
    >
      <div className={`suggestion-priority ${suggestion.priority}`} />
      <div className="suggestion-content">
        <div className="suggestion-title">{suggestion.title}</div>
        <div className="suggestion-description">{suggestion.description}</div>
        <div className="suggestion-impact">{suggestion.impact}</div>
      </div>
      <div className="suggestion-effort">
        <span className={`effort-badge ${suggestion.estimatedEffort}`}>
          {formatEffort(suggestion.estimatedEffort)}
        </span>
        <button className="text-blue-500 hover:text-blue-400 text-sm p-0 suggestion-cta">
          {suggestion.cta.label}
        </button>
      </div>
    </div>
  );
}

/**
 * Get feature description with actual data
 */
function getFeatureDescription(feature: string, coverage: CoverageMetrics): string {
  const { counts } = coverage;

  switch (feature) {
    case 'Control Tower':
      return `Track ${counts.candidates.toLocaleString()} candidates across ${counts.requisitions} requisitions`;
    case 'Data Health':
      return 'Monitor data quality and hygiene metrics';
    case 'Velocity Insights':
      return 'Analyze pipeline velocity and identify bottlenecks';
    case 'HM Friction':
      return 'Track hiring manager responsiveness and feedback times';
    case 'Source Effectiveness':
      return 'Compare candidate sources by conversion rate';
    default:
      return feature;
  }
}

/**
 * Format effort level for display
 */
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

export default CapabilitiesSummary;
