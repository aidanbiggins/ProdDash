// Fit Explain Drawer Component
// Shows detailed breakdown of why a recruiter has a certain fit score for a segment

import React from 'react';
import { FitMatrixCell, FitExplanation, ConfidenceLevel, getFitLabel, CAPACITY_CONSTANTS } from '../../types/capacityTypes';

interface FitExplainDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  cell: FitMatrixCell | null;
}

function ConfidenceBadge({ confidence }: { confidence: ConfidenceLevel }) {
  const styles = {
    HIGH: { bg: 'rgba(34, 197, 94, 0.15)', color: '#34d399' },
    MED: { bg: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24' },
    LOW: { bg: 'rgba(148, 163, 184, 0.15)', color: '#94a3b8' },
    INSUFFICIENT: { bg: 'rgba(239, 68, 68, 0.15)', color: '#f87171' }
  }[confidence];

  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium" style={{ background: styles.bg, color: styles.color }}>
      {confidence}
    </span>
  );
}

function MetricRow({
  label,
  value,
  expected,
  residual,
  sampleSize,
  weight,
  inverted = false
}: {
  label: string;
  value: number;
  expected: number;
  residual: number;
  sampleSize: number;
  weight: number;
  inverted?: boolean;
}) {
  const percentChange = expected !== 0 ? ((value - expected) / expected) * 100 : 0;
  const contribution = inverted ? -residual * weight : residual * weight;
  const isPositive = inverted ? residual < 0 : residual > 0;

  return (
    <div className="border rounded p-2 mb-2" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
      <div className="flex justify-between mb-2">
        <span className="font-medium">{label}</span>
        <span className="text-sm text-muted-foreground">weight: {(weight * 100).toFixed(0)}%</span>
      </div>

      <div className="grid grid-cols-3 gap-2 text-sm">
        <div className="text-center">
          <div className="text-muted-foreground">Observed</div>
          <div className="font-bold">{typeof value === 'number' ? value.toFixed(2) : value}</div>
        </div>
        <div className="text-center">
          <div className="text-muted-foreground">Expected</div>
          <div>{typeof expected === 'number' ? expected.toFixed(2) : expected}</div>
        </div>
        <div className="text-center">
          <div className="text-muted-foreground">Delta</div>
          <div style={{ color: isPositive ? '#34d399' : '#f87171' }}>
            {percentChange > 0 ? '+' : ''}{percentChange.toFixed(0)}%
          </div>
        </div>
      </div>

      <div className="mt-2 pt-2 border-t border-glass-border" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
        <div className="grid grid-cols-2 text-sm">
          <div>
            <span className="text-muted-foreground">After shrinkage (n={sampleSize}):</span>
            <span className="ml-1">{residual.toFixed(3)}</span>
          </div>
          <div className="text-right">
            <span className="text-muted-foreground">Contribution:</span>
            <span className="ml-1" style={{ color: contribution > 0 ? '#34d399' : contribution < 0 ? '#f87171' : '#94a3b8' }}>
              {contribution > 0 ? '+' : ''}{contribution.toFixed(3)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function FitExplainDrawer({
  isOpen,
  onClose,
  cell
}: FitExplainDrawerProps) {
  if (!isOpen || !cell) return null;

  const fitLabel = getFitLabel(cell.fitScore);
  const fitColor = cell.fitScore > 0.1 ? '#34d399' :
                   cell.fitScore > -0.1 ? '#94a3b8' : '#f87171';

  // Calculate expected values (would come from cohort benchmarks in real impl)
  // For now, derive from value - residual
  const expectedHires = cell.metrics.hires_per_wu.value - (cell.metrics.hires_per_wu.residual * (cell.sampleSize + CAPACITY_CONSTANTS.SHRINKAGE_K) / cell.sampleSize);
  const expectedTTF = cell.metrics.ttf_days.value - (cell.metrics.ttf_days.residual * (cell.sampleSize + CAPACITY_CONSTANTS.SHRINKAGE_K) / cell.sampleSize);
  const expectedAccept = cell.metrics.offer_accept_rate.value - (cell.metrics.offer_accept_rate.residual * (cell.sampleSize + CAPACITY_CONSTANTS.SHRINKAGE_K) / cell.sampleSize);
  const expectedThroughput = cell.metrics.candidate_throughput.value - (cell.metrics.candidate_throughput.residual * (cell.sampleSize + CAPACITY_CONSTANTS.SHRINKAGE_K) / cell.sampleSize);

  return (
    <>
      {/* Backdrop */}
      <div
        className="glass-backdrop fixed top-0 left-0 w-full h-full"
        style={{ zIndex: 1040 }}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className="glass-drawer fixed top-0 right-0 h-full"
        style={{
          width: '450px',
          maxWidth: '90vw',
          zIndex: 1050,
          overflowY: 'auto'
        }}
      >
        <div className="glass-drawer-header p-3">
          <div className="flex justify-between items-start">
            <div>
              <h5 className="mb-1">
                Why is {cell.recruiterName} {fitLabel.toLowerCase()} for this segment?
              </h5>
              <div className="text-sm text-muted-foreground">{cell.segmentString}</div>
            </div>
            <button
              className="text-sm text-muted-foreground p-0 hover:text-white transition-colors"
              onClick={onClose}
            >
              <i className="bi bi-x-lg"></i>
            </button>
          </div>
        </div>

        <div className="p-3">
          {/* FitScore Summary */}
          <div className="text-center p-3 rounded mb-4" style={{ background: `${fitColor}15` }}>
            <div className="text-sm text-muted-foreground">FitScore</div>
            <div className="text-4xl font-bold" style={{ color: fitColor }}>
              {cell.fitScore > 0 ? '+' : ''}{cell.fitScore.toFixed(2)}
            </div>
            <div className="flex justify-center items-center gap-2 mt-1">
              <ConfidenceBadge confidence={cell.confidence} />
              <span className="text-sm text-muted-foreground">n={cell.sampleSize}</span>
            </div>
          </div>

          {/* Metric Breakdown */}
          <h6 className="mb-3">
            <i className="bi bi-bar-chart mr-2"></i>
            Metric Breakdown
          </h6>

          <MetricRow
            label="Hires per Workload Unit"
            value={cell.metrics.hires_per_wu.value}
            expected={expectedHires}
            residual={cell.metrics.hires_per_wu.residual}
            sampleSize={cell.metrics.hires_per_wu.n}
            weight={CAPACITY_CONSTANTS.METRIC_WEIGHTS.hires_per_wu}
          />

          <MetricRow
            label="Time to Fill (days)"
            value={cell.metrics.ttf_days.value}
            expected={expectedTTF}
            residual={cell.metrics.ttf_days.residual}
            sampleSize={cell.metrics.ttf_days.n}
            weight={CAPACITY_CONSTANTS.METRIC_WEIGHTS.ttf_days}
            inverted={true}
          />

          <MetricRow
            label="Offer Accept Rate"
            value={cell.metrics.offer_accept_rate.value}
            expected={expectedAccept}
            residual={cell.metrics.offer_accept_rate.residual}
            sampleSize={cell.metrics.offer_accept_rate.n}
            weight={CAPACITY_CONSTANTS.METRIC_WEIGHTS.offer_accept_rate}
          />

          <MetricRow
            label="Candidate Throughput (per week)"
            value={cell.metrics.candidate_throughput.value}
            expected={expectedThroughput}
            residual={cell.metrics.candidate_throughput.residual}
            sampleSize={cell.metrics.candidate_throughput.n}
            weight={CAPACITY_CONSTANTS.METRIC_WEIGHTS.candidate_throughput}
          />

          {/* Shrinkage Explanation */}
          <h6 className="mt-4 mb-3">
            <i className="bi bi-info-circle mr-2"></i>
            About Shrinkage
          </h6>
          <div className="p-3 rounded-lg text-sm" style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: '#94a3b8'
          }}>
            <p className="mb-2">
              Shrinkage adjusts raw performance residuals based on sample size.
              With n={cell.sampleSize} observations and k={CAPACITY_CONSTANTS.SHRINKAGE_K}:
            </p>
            <div className="text-center mb-2" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              shrinkage = n/(n+k) = {cell.sampleSize}/({cell.sampleSize}+{CAPACITY_CONSTANTS.SHRINKAGE_K}) = {(cell.sampleSize / (cell.sampleSize + CAPACITY_CONSTANTS.SHRINKAGE_K)).toFixed(2)}
            </div>
            <p className="mb-0">
              This means {Math.round((1 - cell.sampleSize / (cell.sampleSize + CAPACITY_CONSTANTS.SHRINKAGE_K)) * 100)}% of the raw residual
              is "shrunk" toward zero to account for small sample uncertainty.
            </p>
          </div>

          {/* Confidence Caveat */}
          {cell.confidence !== 'HIGH' && (
            <div className="p-3 rounded-lg text-sm" style={{
              background: 'rgba(245, 158, 11, 0.15)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              color: '#fbbf24'
            }}>
              <i className="bi bi-exclamation-triangle mr-1"></i>
              Sample size of {cell.sampleSize} is below HIGH confidence threshold.
              Interpret with appropriate caution.
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default FitExplainDrawer;
