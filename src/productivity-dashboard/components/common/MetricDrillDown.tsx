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
    <div className="fixed inset-0 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }}>
      <div className="w-full max-w-4xl mx-4 rounded-lg" style={{ background: 'var(--bg-surface)', border: '1px solid var(--glass-border)' }}>
        <div className="flex items-center justify-between p-4 border-b border-glass-border">
          <h5 className="text-lg font-medium" style={{ color: '#F8FAFC' }}>{metricName}</h5>
          <button type="button" className="p-1 rounded hover:bg-white/10 text-white/60 hover:text-white" onClick={onClose}>
            <i className="bi bi-x-lg"></i>
          </button>
        </div>
        <div className="p-4">
          {/* Current Value */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="rounded-lg p-4 text-center" style={{ background: 'rgba(30, 41, 59, 0.7)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <h6 className="mb-1" style={{ color: '#94A3B8' }}>Current Value</h6>
              <h2 className="mb-0 text-2xl font-bold" style={{ color: '#F8FAFC' }}>{value}</h2>
            </div>
            <div className="rounded-lg p-4 text-center" style={{ background: 'rgba(30, 41, 59, 0.7)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <h6 className="mb-1" style={{ color: '#94A3B8' }}>Records Included</h6>
              <h2 className="mb-0 text-2xl font-bold" style={{ color: '#F8FAFC' }}>{recordCount}</h2>
            </div>
          </div>

            {/* Formula */}
            <div className="mb-4">
              <h6 style={{ color: '#F8FAFC' }}>Formula</h6>
              <div className="p-3 rounded font-monospace" style={{ background: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(255,255,255,0.1)', color: '#F8FAFC' }}>
                {formula}
              </div>
            </div>

            {/* Additional Info */}
            {additionalInfo && Object.keys(additionalInfo).length > 0 && (
              <div className="mb-4">
                <h6 style={{ color: '#F8FAFC' }}>Calculation Details</h6>
                <table className="w-full text-sm">
                  <tbody>
                    {Object.entries(additionalInfo).map(([key, val]) => (
                      <tr key={key} className="border-b border-glass-border">
                        <td className="py-2 text-muted-foreground">{key}</td>
                        <td className="py-2 font-bold" style={{ color: '#F8FAFC' }}>{val}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Record IDs */}
            {recordIds.length > 0 && recordIds.length <= 100 && (
              <div className="mb-4">
                <h6 style={{ color: '#F8FAFC' }}>Included Record IDs</h6>
                <div className="p-3 rounded" style={{ maxHeight: '200px', overflowY: 'auto', background: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <div className="flex flex-wrap gap-1">
                    {recordIds.map(id => (
                      <span key={id} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-white/10 text-white/80">{id}</span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {recordIds.length > 100 && (
              <div className="mb-4">
                <h6 style={{ color: '#F8FAFC' }}>Included Record IDs</h6>
                <p className="text-muted-foreground">
                  {recordIds.length} records included. Export to CSV to see full list.
                </p>
              </div>
            )}

            {/* Computed At */}
            {computedAt && (
              <div className="text-muted-foreground text-sm">
                Computed at: {format(computedAt, 'PPpp')}
              </div>
            )}
        </div>
        <div className="flex justify-end p-4 border-t border-glass-border">
          <button
            type="button"
            className="px-4 py-2 text-sm font-medium rounded-md bg-white/10 hover:bg-white/20 text-white"
            onClick={onClose}
          >
            Close
          </button>
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
