// SectionCard - Wrapper for each Command Center section
// Handles gating, blocked state, and limited banner display

import React, { useState } from 'react';
import { SectionGateResult, SectionId, SECTION_BLOCKED_COPY } from '../../types/commandCenterTypes';
import { ConfidenceLevel } from '../../types/capabilityTypes';

interface SectionCardProps {
  sectionId: SectionId;
  title: string;
  gate: SectionGateResult;
  confidence?: ConfidenceLevel;
  onExplain?: () => void;
  onViewDetails?: () => void;
  explainLabel?: string;
  detailsLabel?: string;
  children: React.ReactNode;
}

export const SectionCard: React.FC<SectionCardProps> = ({
  sectionId,
  title,
  gate,
  confidence,
  onExplain,
  onViewDetails,
  explainLabel = 'Explain',
  detailsLabel = 'View details',
  children,
}) => {
  const [limitedDismissed, setLimitedDismissed] = useState(false);

  if (gate.status === 'BLOCKED') {
    const copy = SECTION_BLOCKED_COPY[sectionId];
    return (
      <div className="cc-section cc-section--blocked" style={{
        background: 'rgba(30, 41, 59, 0.5)',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        borderRadius: '12px',
        padding: '1.5rem',
        marginBottom: '1rem',
      }}>
        <h3 style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.5)', marginBottom: '1rem' }}>{title}</h3>
        <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
          <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem', opacity: 0.4 }}>
            <i className="bi bi-lock" />
          </div>
          <div style={{ fontWeight: 600, marginBottom: '0.5rem', color: 'rgba(255,255,255,0.7)' }}>{copy.title}</div>
          <div style={{ fontSize: '0.8125rem', color: 'rgba(255,255,255,0.5)', marginBottom: '1rem', maxWidth: '400px', margin: '0 auto 1rem' }}>{copy.whats_needed}</div>
          <button className="btn btn-sm btn-outline-info" style={{ fontSize: '0.75rem' }}>
            {copy.cta_label}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="cc-section" style={{
      background: 'rgba(30, 41, 59, 0.7)',
      border: '1px solid rgba(255, 255, 255, 0.08)',
      borderRadius: '12px',
      padding: '1.5rem',
      marginBottom: '1rem',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.5)', margin: 0 }}>{title}</h3>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          {confidence && (
            <span style={{ fontSize: '0.625rem', textTransform: 'uppercase', color: confidence === 'HIGH' ? '#10b981' : confidence === 'MED' ? '#f59e0b' : '#94a3b8', letterSpacing: '0.05em' }}>
              {confidence}
            </span>
          )}
          {onExplain && (
            <button onClick={onExplain} className="btn btn-link btn-sm p-0" style={{ fontSize: '0.6875rem', color: '#06b6d4', textDecoration: 'none' }}>
              {explainLabel} <i className="bi bi-arrow-right" style={{ fontSize: '0.6rem' }} />
            </button>
          )}
          {onViewDetails && (
            <button onClick={onViewDetails} className="btn btn-link btn-sm p-0" style={{ fontSize: '0.6875rem', color: 'rgba(255,255,255,0.5)', textDecoration: 'none' }}>
              {detailsLabel} <i className="bi bi-arrow-right" style={{ fontSize: '0.6rem' }} />
            </button>
          )}
        </div>
      </div>

      {/* Limited Banner */}
      {gate.status === 'LIMITED' && !limitedDismissed && gate.limitedReason && (
        <div style={{
          background: 'rgba(245, 158, 11, 0.1)',
          border: '1px solid rgba(245, 158, 11, 0.2)',
          borderRadius: '6px',
          padding: '0.5rem 0.75rem',
          marginBottom: '1rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '0.75rem',
          color: '#f59e0b',
        }}>
          <span>Partial data — {gate.limitedReason}</span>
          <button onClick={() => setLimitedDismissed(true)} className="btn btn-link btn-sm p-0" style={{ color: '#f59e0b', fontSize: '0.6875rem', textDecoration: 'none' }}>
            <i className="bi bi-x" />
          </button>
        </div>
      )}

      {/* Content */}
      {children}
    </div>
  );
};
