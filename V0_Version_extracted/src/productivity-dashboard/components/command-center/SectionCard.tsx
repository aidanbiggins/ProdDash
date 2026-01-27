// SectionCard - Wrapper for each Command Center section
// Standardized header: Title (left), Confidence type + 2 links max (right)

import React, { useState } from 'react';
import { SectionGateResult, SectionId, ConfidenceType, SECTION_BLOCKED_COPY } from '../../types/commandCenterTypes';
import { ConfidenceLevel } from '../../types/capabilityTypes';

interface SectionCardProps {
  sectionId: SectionId;
  title: string;
  gate: SectionGateResult;
  confidence?: ConfidenceLevel;
  confidenceType?: ConfidenceType;
  primaryCTA?: { label: string; onClick: () => void };
  detailsCTA?: { label: string; onClick: () => void };
  children: React.ReactNode;
  // Legacy props (mapped internally for backward compat)
  onExplain?: () => void;
  onViewDetails?: () => void;
  explainLabel?: string;
  detailsLabel?: string;
}

const CONFIDENCE_TYPE_LABELS: Record<ConfidenceType, string> = {
  data: 'Data',
  risk: 'Risk',
  forecast: 'Forecast',
};

export const SectionCard: React.FC<SectionCardProps> = ({
  sectionId,
  title,
  gate,
  confidence,
  confidenceType = 'data',
  primaryCTA,
  detailsCTA,
  onExplain,
  onViewDetails,
  explainLabel = 'Explain',
  detailsLabel = 'Details',
  children,
}) => {
  const [limitedDismissed, setLimitedDismissed] = useState(false);

  // Resolve CTAs: prefer explicit primaryCTA/detailsCTA, fall back to legacy props
  const resolvedPrimary = primaryCTA || (onExplain ? { label: explainLabel, onClick: onExplain } : undefined);
  const resolvedDetails = detailsCTA || (onViewDetails ? { label: detailsLabel, onClick: onViewDetails } : undefined);

  if (gate.status === 'BLOCKED') {
    const copy = SECTION_BLOCKED_COPY[sectionId];
    return (
      <div className="cc-section cc-section--blocked" data-testid={`cc-section-${sectionId}`}>
        <h3 className="cc-section__title">{title}</h3>
        <div className="cc-section__blocked-body">
          <div className="cc-section__blocked-icon">
            <i className="bi bi-lock" />
          </div>
          <div className="cc-section__blocked-title">{copy.title}</div>
          <div className="cc-section__blocked-desc">{copy.whats_needed}</div>
          <button className="px-3 py-1.5 text-sm font-medium text-cyan-400 border border-cyan-400/30 rounded-md hover:bg-cyan-400/10 transition-colors cc-section__blocked-cta">
            {copy.cta_label}
          </button>
        </div>
      </div>
    );
  }

  const confidenceClass = confidence === 'HIGH'
    ? 'cc-section__confidence--high'
    : confidence === 'MED'
    ? 'cc-section__confidence--med'
    : 'cc-section__confidence--low';

  return (
    <div className="cc-section" data-testid={`cc-section-${sectionId}`}>
      {/* Header */}
      <div className="cc-section__header">
        <h3 className="cc-section__title">{title}</h3>
        <div className="cc-section__actions">
          {confidence && (
            <span
              className={`cc-section__confidence ${confidenceClass}`}
              title={`${CONFIDENCE_TYPE_LABELS[confidenceType]} confidence based on available data completeness`}
            >
              {CONFIDENCE_TYPE_LABELS[confidenceType]}: {confidence}
            </span>
          )}
          {resolvedPrimary && (
            <button
              onClick={resolvedPrimary.onClick}
              className="cc-section__cta cc-section__cta--primary"
            >
              {resolvedPrimary.label} <i className="bi bi-arrow-right cc-section__cta-arrow" />
            </button>
          )}
          {resolvedDetails && (
            <button
              onClick={resolvedDetails.onClick}
              className="cc-section__cta cc-section__cta--details"
            >
              {resolvedDetails.label} <i className="bi bi-arrow-right cc-section__cta-arrow" />
            </button>
          )}
        </div>
      </div>

      {/* Limited Banner */}
      {gate.status === 'LIMITED' && !limitedDismissed && gate.limitedReason && (
        <div className="cc-section__limited-banner">
          <span>Partial data — {gate.limitedReason}</span>
          <button
            onClick={() => setLimitedDismissed(true)}
            className="cc-section__limited-dismiss"
            aria-label="Dismiss partial data warning"
          >
            <i className="bi bi-x" />
          </button>
        </div>
      )}

      {/* Content */}
      {children}
    </div>
  );
};
