/**
 * Citations Drawer
 *
 * Slide-out panel showing all citations for the scenario output.
 */

import React from 'react';
import { Citation } from '../../../types/scenarioTypes';

interface CitationsDrawerProps {
  citations: Citation[];
  show: boolean;
  onClose: () => void;
}

export default function CitationsDrawer({ citations, show, onClose }: CitationsDrawerProps) {
  if (!show) return null;

  // Group citations by source service
  const groupedCitations = citations.reduce((acc, citation) => {
    const source = citation.source_service || 'unknown';
    if (!acc[source]) acc[source] = [];
    acc[source].push(citation);
    return acc;
  }, {} as Record<string, Citation[]>);

  return (
    <>
      {/* Backdrop */}
      <div
        className="citations-backdrop glass-backdrop"
        onClick={onClose}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 1040,
        }}
      />

      {/* Drawer */}
      <div
        className="citations-drawer glass-drawer"
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: '400px',
          maxWidth: '90vw',
          zIndex: 1050,
          overflowY: 'auto',
          padding: '1.5rem',
        }}
      >
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h5 className="mb-0">
            <i className="bi bi-quote me-2" />
            Citations
          </h5>
          <button
            className="btn btn-close"
            onClick={onClose}
            aria-label="Close"
          />
        </div>

        <p className="text-secondary small mb-4">
          Every computed value in this scenario is backed by data from your recruiting system.
          Citations link to the source of each metric.
        </p>

        {Object.entries(groupedCitations).map(([source, sourceCitations]) => (
          <div key={source} className="citation-group mb-4">
            <h6 className="text-secondary text-uppercase small mb-3">
              {formatSourceName(source)}
            </h6>
            <div className="citation-list">
              {sourceCitations.map((citation, idx) => (
                <div
                  key={idx}
                  className="citation-item mb-2"
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.625rem 0.75rem',
                    borderRadius: 'var(--border-radius)',
                    background: 'var(--surface-elevated)',
                    borderLeft: '2px solid var(--accent-secondary)',
                  }}
                >
                  <span className="text-sm">{citation.label}</span>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 600,
                      color: 'var(--accent-secondary)',
                    }}
                  >
                    {formatValue(citation.value)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}

        {citations.length === 0 && (
          <p className="text-secondary">No citations available.</p>
        )}
      </div>
    </>
  );
}

/**
 * Format source service name for display
 */
function formatSourceName(source: string): string {
  const nameMap: Record<string, string> = {
    capacity_fit_engine: 'Capacity Analysis',
    forecasting_service: 'Forecasting',
    velocity_analysis: 'Velocity Metrics',
    scenario_library: 'Scenario Library',
    hm_metrics_engine: 'HM Metrics',
  };
  return nameMap[source] || source.replace(/_/g, ' ');
}

/**
 * Format citation value for display
 */
function formatValue(value: string | number): string {
  if (typeof value === 'number') {
    return value.toLocaleString();
  }
  return value;
}
