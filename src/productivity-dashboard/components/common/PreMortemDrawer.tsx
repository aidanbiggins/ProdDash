// Pre-Mortem Detail Drawer Component
// Shows detailed risk analysis for a single requisition

import React from 'react';
import {
  PreMortemResult,
  RiskDriver,
  RecommendedIntervention,
  getRiskBandColor,
  getFailureModeLabel,
} from '../../types/preMortemTypes';
import { ActionItem } from '../../types/actionTypes';
import { convertToActionItems } from '../../services/preMortemService';

interface PreMortemDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  result: PreMortemResult | null;
  onAddToQueue?: (actions: ActionItem[]) => void;
}

export function PreMortemDrawer({
  isOpen,
  onClose,
  result,
  onAddToQueue,
}: PreMortemDrawerProps) {
  if (!isOpen || !result) return null;

  const handleAddToQueue = () => {
    if (result && onAddToQueue) {
      const actions = convertToActionItems([result], false);
      onAddToQueue(actions);
      onClose();
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return '#ef4444';
      case 'high': return '#f97316';
      case 'medium': return '#f59e0b';
      case 'low': return '#22c55e';
      default: return '#64748b';
    }
  };

  const getConfidenceColor = (level: string) => {
    switch (level) {
      case 'HIGH': return '#22c55e';
      case 'MED': return '#f59e0b';
      case 'LOW': return '#ef4444';
      default: return '#64748b';
    }
  };

  return (
    <div
      className="offcanvas offcanvas-end show"
      style={{
        visibility: 'visible',
        width: '480px',
        background: '#1e293b',
        borderLeft: '1px solid rgba(255,255,255,0.1)',
      }}
    >
      <div className="offcanvas-header" style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <div>
          <h5 className="offcanvas-title mb-1" style={{ color: '#f8fafc' }}>
            Pre-Mortem Analysis
          </h5>
          <div className="small" style={{ color: 'rgba(255,255,255,0.6)' }}>
            {result.req_title}
          </div>
        </div>
        <button
          type="button"
          className="btn-close btn-close-white"
          onClick={onClose}
        />
      </div>

      <div className="offcanvas-body" style={{ padding: '1.5rem' }}>
        {/* Risk Score Header */}
        <div
          className="p-4 rounded-3 mb-4"
          style={{
            background: `linear-gradient(135deg, ${getRiskBandColor(result.risk_band)}20, transparent)`,
            border: `1px solid ${getRiskBandColor(result.risk_band)}40`,
          }}
        >
          <div className="d-flex align-items-center justify-content-between mb-3">
            <div>
              <div className="small text-uppercase mb-1" style={{ color: 'rgba(255,255,255,0.5)', letterSpacing: '0.05em' }}>
                Risk Score
              </div>
              <div className="d-flex align-items-baseline gap-2">
                <span
                  className="font-monospace"
                  style={{
                    fontSize: '3rem',
                    fontWeight: 700,
                    color: getRiskBandColor(result.risk_band),
                    lineHeight: 1,
                  }}
                >
                  {result.risk_score}
                </span>
                <span style={{ color: 'rgba(255,255,255,0.5)' }}>/100</span>
              </div>
            </div>
            <div className="text-end">
              <span
                className="badge"
                style={{
                  background: getRiskBandColor(result.risk_band),
                  fontSize: '0.875rem',
                  padding: '0.5rem 1rem',
                }}
              >
                {result.risk_band} RISK
              </span>
            </div>
          </div>

          <div className="d-flex gap-4 small" style={{ color: 'rgba(255,255,255,0.7)' }}>
            <div>
              <i className="bi bi-calendar me-1"></i>
              {result.days_open}d open
            </div>
            <div>
              <i className="bi bi-people me-1"></i>
              {result.active_candidate_count} active
            </div>
            <div>
              <i className="bi bi-shield-exclamation me-1"></i>
              {getFailureModeLabel(result.failure_mode)}
            </div>
          </div>
        </div>

        {/* Failure Mode */}
        <div className="mb-4">
          <h6 className="text-uppercase mb-3" style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem', letterSpacing: '0.05em' }}>
            Primary Failure Mode
          </h6>
          <div
            className="p-3 rounded"
            style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)' }}
          >
            <div className="d-flex align-items-center gap-2">
              <i className="bi bi-exclamation-triangle-fill" style={{ color: '#ef4444' }}></i>
              <span style={{ color: '#f8fafc', fontWeight: 500 }}>
                {getFailureModeLabel(result.failure_mode)}
              </span>
            </div>
          </div>
        </div>

        {/* Top Risk Drivers */}
        <div className="mb-4">
          <h6 className="text-uppercase mb-3" style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem', letterSpacing: '0.05em' }}>
            Risk Drivers
          </h6>
          <div className="d-flex flex-column gap-2">
            {result.top_drivers.map((driver) => (
              <div
                key={driver.driver_key}
                className="p-3 rounded"
                style={{ background: 'rgba(30, 41, 59, 0.8)', border: '1px solid rgba(255,255,255,0.1)' }}
              >
                <div className="d-flex justify-content-between align-items-start mb-2">
                  <span style={{ color: '#f8fafc', fontWeight: 500 }}>
                    {driver.description}
                  </span>
                  <span
                    className="badge"
                    style={{
                      background: getSeverityColor(driver.severity),
                      fontSize: '0.7rem',
                      textTransform: 'uppercase',
                    }}
                  >
                    {driver.severity}
                  </span>
                </div>
                <div className="d-flex gap-3 small" style={{ color: 'rgba(255,255,255,0.6)' }}>
                  <span>
                    <strong>{driver.evidence.actual_value}</strong> {driver.evidence.unit}
                  </span>
                  {driver.evidence.benchmark_value !== undefined && (
                    <span>
                      vs <strong>{driver.evidence.benchmark_value}</strong> benchmark
                    </span>
                  )}
                  {driver.evidence.variance !== undefined && driver.evidence.variance !== 0 && (
                    <span style={{ color: driver.evidence.variance > 0 ? '#ef4444' : '#22c55e' }}>
                      ({driver.evidence.variance > 0 ? '+' : ''}{driver.evidence.variance.toFixed(0)}%)
                    </span>
                  )}
                </div>
                <div
                  className="mt-2"
                  style={{
                    height: '4px',
                    background: 'rgba(255,255,255,0.1)',
                    borderRadius: '2px',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${driver.weight}%`,
                      height: '100%',
                      background: getSeverityColor(driver.severity),
                      transition: 'width 0.3s ease',
                    }}
                  />
                </div>
                <div className="text-end small mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  {driver.weight}% weight
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recommended Interventions */}
        <div className="mb-4">
          <h6 className="text-uppercase mb-3" style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem', letterSpacing: '0.05em' }}>
            Recommended Interventions
          </h6>
          <div className="d-flex flex-column gap-3">
            {result.recommended_interventions.map((intervention) => (
              <div
                key={intervention.intervention_id}
                className="p-3 rounded"
                style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)' }}
              >
                <div className="d-flex justify-content-between align-items-start mb-2">
                  <span style={{ color: '#f8fafc', fontWeight: 500 }}>
                    {intervention.title}
                  </span>
                  <span
                    className="badge"
                    style={{
                      background: intervention.priority === 'P0' ? '#ef4444' : intervention.priority === 'P1' ? '#f59e0b' : '#22c55e',
                      fontSize: '0.7rem',
                    }}
                  >
                    {intervention.priority}
                  </span>
                </div>
                <p className="small mb-2" style={{ color: 'rgba(255,255,255,0.7)' }}>
                  {intervention.description}
                </p>
                <div className="small" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  <i className="bi bi-lightning-charge me-1"></i>
                  {intervention.estimated_impact}
                </div>
                {intervention.steps.length > 0 && (
                  <ul className="mt-2 mb-0 ps-3 small" style={{ color: 'rgba(255,255,255,0.6)' }}>
                    {intervention.steps.slice(0, 3).map((step, idx) => (
                      <li key={idx}>{step}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Comparable History */}
        {result.comparable_history.length > 0 && (
          <div className="mb-4">
            <h6 className="text-uppercase mb-3" style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem', letterSpacing: '0.05em' }}>
              Comparable History
            </h6>
            <div className="d-flex flex-column gap-2">
              {result.comparable_history.map((history, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded d-flex justify-content-between align-items-center"
                  style={{ background: 'rgba(30, 41, 59, 0.8)', border: '1px solid rgba(255,255,255,0.1)' }}
                >
                  <div>
                    <div style={{ color: '#f8fafc', fontWeight: 500 }}>{history.cohort_key}</div>
                    <div className="small" style={{ color: 'rgba(255,255,255,0.6)' }}>
                      {history.outcome_summary}
                    </div>
                  </div>
                  <span className="badge bg-secondary">{history.count} reqs</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Confidence */}
        <div className="mb-4">
          <h6 className="text-uppercase mb-3" style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem', letterSpacing: '0.05em' }}>
            Confidence
          </h6>
          <div
            className="p-3 rounded d-flex align-items-center gap-3"
            style={{ background: 'rgba(30, 41, 59, 0.8)', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            <span
              className="badge"
              style={{
                background: getConfidenceColor(result.confidence.level),
                padding: '0.5rem 0.75rem',
              }}
            >
              {result.confidence.level}
            </span>
            <span className="small" style={{ color: 'rgba(255,255,255,0.7)' }}>
              {result.confidence.reason}
            </span>
          </div>
        </div>

        {/* Add to Queue Button */}
        {onAddToQueue && result.recommended_interventions.length > 0 && (
          <button
            type="button"
            className="btn btn-primary w-100"
            onClick={handleAddToQueue}
          >
            <i className="bi bi-plus-circle me-2"></i>
            Add {result.recommended_interventions.length} Action{result.recommended_interventions.length > 1 ? 's' : ''} to Queue
          </button>
        )}
      </div>

      {/* Backdrop */}
      <div
        className="offcanvas-backdrop fade show"
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: -1 }}
      />
    </div>
  );
}
