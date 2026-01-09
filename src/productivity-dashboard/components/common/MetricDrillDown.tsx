// Metric Drill-Down Modal Component

import React from 'react';
import { MetricAudit } from '../../types';
import { format } from 'date-fns';

interface MetricDrillDownProps {
  isOpen: boolean;
  onClose: () => void;
  metricName: string;
  formula: string;
  value: string | number;
  recordCount: number;
  recordIds?: string[];
  computedAt?: Date;
  additionalInfo?: Record<string, string | number>;
}

export function MetricDrillDown({
  isOpen,
  onClose,
  metricName,
  formula,
  value,
  recordCount,
  recordIds = [],
  computedAt,
  additionalInfo
}: MetricDrillDownProps) {
  if (!isOpen) return null;

  return (
    <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-lg">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">{metricName}</h5>
            <button type="button" className="btn-close" onClick={onClose} />
          </div>
          <div className="modal-body">
            {/* Current Value */}
            <div className="row mb-4">
              <div className="col-md-6">
                <div className="card bg-light">
                  <div className="card-body text-center">
                    <h6 className="text-muted mb-1">Current Value</h6>
                    <h2 className="mb-0">{value}</h2>
                  </div>
                </div>
              </div>
              <div className="col-md-6">
                <div className="card bg-light">
                  <div className="card-body text-center">
                    <h6 className="text-muted mb-1">Records Included</h6>
                    <h2 className="mb-0">{recordCount}</h2>
                  </div>
                </div>
              </div>
            </div>

            {/* Formula */}
            <div className="mb-4">
              <h6>Formula</h6>
              <div className="bg-light p-3 rounded font-monospace">
                {formula}
              </div>
            </div>

            {/* Additional Info */}
            {additionalInfo && Object.keys(additionalInfo).length > 0 && (
              <div className="mb-4">
                <h6>Calculation Details</h6>
                <table className="table table-sm">
                  <tbody>
                    {Object.entries(additionalInfo).map(([key, val]) => (
                      <tr key={key}>
                        <td className="text-muted">{key}</td>
                        <td className="fw-bold">{val}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Record IDs */}
            {recordIds.length > 0 && recordIds.length <= 100 && (
              <div className="mb-4">
                <h6>Included Record IDs</h6>
                <div className="bg-light p-3 rounded" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                  <div className="d-flex flex-wrap gap-1">
                    {recordIds.map(id => (
                      <span key={id} className="badge bg-secondary">{id}</span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {recordIds.length > 100 && (
              <div className="mb-4">
                <h6>Included Record IDs</h6>
                <p className="text-muted">
                  {recordIds.length} records included. Export to CSV to see full list.
                </p>
              </div>
            )}

            {/* Computed At */}
            {computedAt && (
              <div className="text-muted small">
                Computed at: {format(computedAt, 'PPpp')}
              </div>
            )}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ===== FORMULA DEFINITIONS =====

export const METRIC_FORMULAS: Record<string, { formula: string; description: string }> = {
  hires: {
    formula: 'COUNT(candidates WHERE disposition = "Hired" AND hired_at IN date_range)',
    description: 'Number of candidates hired within the selected date range'
  },
  weightedHires: {
    formula: 'SUM(complexity_score FOR EACH hire)',
    description: 'Sum of complexity scores for all hires in the date range'
  },
  offersExtended: {
    formula: 'COUNT(candidates WHERE offer_extended_at IN date_range)',
    description: 'Number of offers extended within the selected date range'
  },
  offerAcceptanceRate: {
    formula: 'offers_accepted / offers_extended',
    description: 'Percentage of extended offers that were accepted'
  },
  timeToFill: {
    formula: 'MEDIAN(closed_at - opened_at FOR reqs closed IN date_range)',
    description: 'Median number of days from req open to close'
  },
  productivityIndex: {
    formula: '(weighted_hires + weighted_offers * 0.5) / (active_req_load + 1)',
    description: 'Normalized productivity score accounting for complexity and workload'
  },
  hmWeight: {
    formula: 'CLAMP(hm_decision_latency / p50_all_hm_latency, 0.8, 1.3)',
    description: 'Hiring manager friction multiplier based on relative decision speed'
  },
  complexityScore: {
    formula: 'level_weight × market_weight × niche_weight × hm_weight',
    description: 'Overall complexity multiplier for a requisition'
  },
  screenToHmConversion: {
    formula: 'COUNT(entered HM_SCREEN) / COUNT(entered SCREEN) for candidates entering SCREEN in range',
    description: 'Percentage of screened candidates submitted to hiring manager'
  }
};
