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
      className="fixed top-0 right-0 h-full glass-drawer w-[480px] flex flex-col"
      style={{
        visibility: 'visible',
      }}
    >
      <div className="glass-drawer-header px-4 py-3 flex justify-between items-start">
        <div>
          <h5 className="text-lg font-semibold mb-1" style={{ color: '#f8fafc' }}>
            Pre-Mortem Analysis
          </h5>
          <div className="text-sm text-white/60">
            {result.req_title}
          </div>
        </div>
        <button
          type="button"
          className="text-white opacity-70 hover:opacity-100"
          onClick={onClose}
        >
          <i className="bi bi-x text-2xl"></i>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {/* Risk Score Header */}
        <div
          className="p-4 rounded-lg mb-4"
          style={{
            background: `linear-gradient(135deg, ${getRiskBandColor(result.risk_band)}20, transparent)`,
            border: `1px solid ${getRiskBandColor(result.risk_band)}40`,
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-sm uppercase mb-1 tracking-wider text-white/50">
                Risk Score
              </div>
              <div className="flex items-baseline gap-2">
                <span
                  className="font-mono text-5xl font-bold leading-none"
                  style={{
                    color: getRiskBandColor(result.risk_band),
                  }}
                >
                  {result.risk_score}
                </span>
                <span className="text-white/50">/100</span>
              </div>
            </div>
            <div className="text-right">
              <span
                className="inline-flex items-center px-3 py-1.5 rounded text-sm font-medium text-white"
                style={{
                  background: getRiskBandColor(result.risk_band),
                }}
              >
                {result.risk_band} RISK
              </span>
            </div>
          </div>

          <div className="flex gap-4 text-sm text-white/70">
            <div>
              <i className="bi bi-calendar mr-1"></i>
              {result.days_open}d open
            </div>
            <div>
              <i className="bi bi-people mr-1"></i>
              {result.active_candidate_count} active
            </div>
            <div>
              <i className="bi bi-shield-exclamation mr-1"></i>
              {getFailureModeLabel(result.failure_mode)}
            </div>
          </div>
        </div>

        {/* Failure Mode */}
        <div className="mb-4">
          <h6 className="text-xs uppercase mb-3 tracking-wider text-white/50">
            Primary Failure Mode
          </h6>
          <div
            className="p-3 rounded"
            style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)' }}
          >
            <div className="flex items-center gap-2">
              <i className="bi bi-exclamation-triangle-fill" style={{ color: '#ef4444' }}></i>
              <span className="text-white font-medium">
                {getFailureModeLabel(result.failure_mode)}
              </span>
            </div>
          </div>
        </div>

        {/* Top Risk Drivers */}
        <div className="mb-4">
          <h6 className="text-xs uppercase mb-3 tracking-wider text-white/50">
            Risk Drivers
          </h6>
          <div className="flex flex-col gap-2">
            {result.top_drivers.map((driver) => (
              <div
                key={driver.driver_key}
                className="p-3 rounded"
                style={{ background: 'rgba(30, 41, 59, 0.8)', border: '1px solid rgba(255,255,255,0.1)' }}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="text-white font-medium">
                    {driver.description}
                  </span>
                  <span
                    className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium uppercase text-white"
                    style={{
                      background: getSeverityColor(driver.severity),
                    }}
                  >
                    {driver.severity}
                  </span>
                </div>
                <div className="flex gap-3 text-sm text-white/60">
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
                <div className="mt-2 h-1 bg-white/10 rounded overflow-hidden">
                  <div
                    className="h-full transition-all duration-300"
                    style={{
                      width: `${driver.weight}%`,
                      background: getSeverityColor(driver.severity),
                    }}
                  />
                </div>
                <div className="text-right text-sm mt-1 text-white/40">
                  {driver.weight}% weight
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recommended Interventions */}
        <div className="mb-4">
          <h6 className="text-xs uppercase mb-3 tracking-wider text-white/50">
            Recommended Interventions
          </h6>
          <div className="flex flex-col gap-3">
            {result.recommended_interventions.map((intervention) => (
              <div
                key={intervention.intervention_id}
                className="p-3 rounded"
                style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)' }}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="text-white font-medium">
                    {intervention.title}
                  </span>
                  <span
                    className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium text-white"
                    style={{
                      background: intervention.priority === 'P0' ? '#ef4444' : intervention.priority === 'P1' ? '#f59e0b' : '#22c55e',
                    }}
                  >
                    {intervention.priority}
                  </span>
                </div>
                <p className="text-sm mb-2 text-white/70">
                  {intervention.description}
                </p>
                <div className="text-sm text-white/50">
                  <i className="bi bi-lightning-charge mr-1"></i>
                  {intervention.estimated_impact}
                </div>
                {intervention.steps.length > 0 && (
                  <ul className="mt-2 mb-0 pl-3 text-sm text-white/60">
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
            <h6 className="text-xs uppercase mb-3 tracking-wider text-white/50">
              Comparable History
            </h6>
            <div className="flex flex-col gap-2">
              {result.comparable_history.map((history, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded flex justify-between items-center"
                  style={{ background: 'rgba(30, 41, 59, 0.8)', border: '1px solid rgba(255,255,255,0.1)' }}
                >
                  <div>
                    <div className="text-white font-medium">{history.cohort_key}</div>
                    <div className="text-sm text-white/60">
                      {history.outcome_summary}
                    </div>
                  </div>
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-white/10 text-white/80">{history.count} reqs</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Confidence */}
        <div className="mb-4">
          <h6 className="text-xs uppercase mb-3 tracking-wider text-white/50">
            Confidence
          </h6>
          <div
            className="p-3 rounded flex items-center gap-3"
            style={{ background: 'rgba(30, 41, 59, 0.8)', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            <span
              className="inline-flex items-center px-3 py-1 rounded text-sm font-medium text-white"
              style={{
                background: getConfidenceColor(result.confidence.level),
              }}
            >
              {result.confidence.level}
            </span>
            <span className="text-sm text-white/70">
              {result.confidence.reason}
            </span>
          </div>
        </div>

        {/* Add to Queue Button */}
        {onAddToQueue && result.recommended_interventions.length > 0 && (
          <button
            type="button"
            className="w-full px-4 py-2 text-sm font-medium rounded-md bg-accent hover:bg-accent/90 text-white"
            onClick={handleAddToQueue}
          >
            <i className="bi bi-plus-circle mr-2"></i>
            Add {result.recommended_interventions.length} Action{result.recommended_interventions.length > 1 ? 's' : ''} to Queue
          </button>
        )}
      </div>

      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 -z-10"
        onClick={onClose}
      />
    </div>
  );
}
