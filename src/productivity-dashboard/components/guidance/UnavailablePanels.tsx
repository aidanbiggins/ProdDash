// Unavailable Panel Components
// Display helpful messages when features are disabled due to missing data
// See docs/plans/RESILIENT_IMPORT_AND_GUIDANCE_V1.md

import React from 'react';
import { CapabilityStatus, RequirementStatus } from '../../types/resilientImportTypes';

interface UnavailablePanelProps {
  capability: CapabilityStatus;
  onUpgradeClick?: () => void;
}

/**
 * Full-tab replacement panel for disabled tabs
 */
export function UnavailableTabPanel({ capability, onUpgradeClick }: UnavailablePanelProps) {
  return (
    <div className="unavailable-tab-panel">
      <div className="unavailable-tab-content">
        <div className="unavailable-icon">
          <i className="bi bi-bar-chart-fill" />
        </div>

        <h2 className="unavailable-title">{capability.displayName}</h2>

        <p className="unavailable-description">
          {capability.disabledReason || 'This feature is not available with your current data.'}
        </p>

        <div className="unavailable-requirements">
          <p className="requirements-header">What you need:</p>
          <ul className="requirements-list">
            {capability.requirements
              .filter(r => !r.met)
              .map((req, index) => (
                <RequirementItem key={index} requirement={req} />
              ))}
          </ul>
        </div>

        {capability.upgradeHint && onUpgradeClick && (
          <button
            className="btn btn-outline-primary unavailable-cta"
            onClick={onUpgradeClick}
          >
            <i className="bi bi-unlock me-2" />
            How to unlock this feature
          </button>
        )}

        <p className="unavailable-reassurance">
          You can keep going without this feature.
        </p>
      </div>
    </div>
  );
}

/**
 * Compact inline replacement for disabled sections
 */
export function UnavailableSectionPanel({ capability, onUpgradeClick }: UnavailablePanelProps) {
  return (
    <div className="unavailable-section-panel">
      <div className="unavailable-section-header">
        <i className="bi bi-lock me-2" />
        <span className="section-title">{capability.displayName}</span>
      </div>
      <p className="unavailable-section-message">
        {capability.disabledReason || 'Not available with current data'}
      </p>
      {capability.upgradeHint && onUpgradeClick && (
        <button
          className="btn btn-link btn-sm p-0 unavailable-section-cta"
          onClick={onUpgradeClick}
        >
          {capability.upgradeHint}
        </button>
      )}
    </div>
  );
}

/**
 * Metric placeholder for disabled metrics
 */
export function MetricPlaceholder({
  label,
  hint
}: {
  label: string;
  hint?: string;
}) {
  return (
    <div className="metric-placeholder">
      <div className="metric-placeholder-label">{label}</div>
      <div className="metric-placeholder-value">--</div>
      {hint && (
        <div className="metric-placeholder-hint" title={hint}>
          <i className="bi bi-info-circle" />
        </div>
      )}
    </div>
  );
}

/**
 * Individual requirement status item
 */
function RequirementItem({ requirement }: { requirement: RequirementStatus }) {
  const statusIcon = requirement.met ? 'bi-check-circle-fill text-success' : 'bi-circle text-muted';

  let progressText = '';
  if (requirement.currentValue !== undefined && requirement.requiredValue !== undefined) {
    progressText = ` (${requirement.currentValue}% → ${requirement.requiredValue}%)`;
  }

  return (
    <li className={`requirement-item ${requirement.met ? 'met' : 'unmet'}`}>
      <i className={`bi ${statusIcon} me-2`} />
      <span>{requirement.description}</span>
      {progressText && <span className="requirement-progress">{progressText}</span>}
    </li>
  );
}

/**
 * Inline capability badge for showing status
 */
export function CapabilityBadge({
  capability,
  size = 'sm'
}: {
  capability: CapabilityStatus;
  size?: 'sm' | 'md';
}) {
  const colorClass = capability.enabled ? 'bg-success' : 'bg-secondary';
  const icon = capability.enabled ? 'bi-check' : 'bi-lock';

  return (
    <span className={`capability-badge badge ${colorClass} ${size === 'sm' ? 'badge-sm' : ''}`}>
      <i className={`bi ${icon} me-1`} />
      {capability.displayName}
    </span>
  );
}
