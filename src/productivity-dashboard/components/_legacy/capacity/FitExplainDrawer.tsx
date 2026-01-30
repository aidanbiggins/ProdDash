// Fit Explain Drawer Component
// Shows detailed breakdown of why a recruiter has a certain fit score for a segment

import React from 'react';
import { FitMatrixCell, FitExplanation, ConfidenceLevel, getFitLabel, CAPACITY_CONSTANTS } from '../../../types/capacityTypes';

interface FitExplainDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  cell: FitMatrixCell | null;
}

function ConfidenceBadge({ confidence }: { confidence: ConfidenceLevel }) {
  const classes = {
    HIGH: 'bg-good-bg text-good',
    MED: 'bg-warn-bg text-warn',
    LOW: 'bg-white/10 text-muted-foreground',
    INSUFFICIENT: 'bg-destructive/10 text-bad'
  }[confidence];

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${classes}`}>
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
    <div className="border border-white/10 rounded-lg p-3 mb-2">
      <div className="flex justify-between mb-2">
        <span className="font-medium text-foreground">{label}</span>
        <span className="text-xs text-muted-foreground">weight: {(weight * 100).toFixed(0)}%</span>
      </div>

      <div className="grid grid-cols-3 gap-2 text-sm">
        <div className="text-center">
          <div className="text-xs text-muted-foreground">Observed</div>
          <div className="font-mono font-bold text-foreground">{typeof value === 'number' ? value.toFixed(2) : value}</div>
        </div>
        <div className="text-center">
          <div className="text-xs text-muted-foreground">Expected</div>
          <div className="font-mono text-foreground">{typeof expected === 'number' ? expected.toFixed(2) : expected}</div>
        </div>
        <div className="text-center">
          <div className="text-xs text-muted-foreground">Delta</div>
          <div className={`font-mono ${isPositive ? 'text-good' : 'text-bad'}`}>
            {percentChange > 0 ? '+' : ''}{percentChange.toFixed(0)}%
          </div>
        </div>
      </div>

      <div className="mt-2 pt-2 border-t border-white/5">
        <div className="grid grid-cols-2 text-xs">
          <div>
            <span className="text-muted-foreground">After shrinkage (n={sampleSize}):</span>
            <span className="ml-1 font-mono text-foreground">{residual.toFixed(3)}</span>
          </div>
          <div className="text-right">
            <span className="text-muted-foreground">Contribution:</span>
            <span className={`ml-1 font-mono ${contribution > 0 ? 'text-good' : contribution < 0 ? 'text-bad' : 'text-muted-foreground'}`}>
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

  const fitColorClass = cell.fitScore > 0.1 ? 'text-good' :
                        cell.fitScore > -0.1 ? 'text-muted-foreground' : 'text-bad';
  const fitBgClass = cell.fitScore > 0.1 ? 'bg-good-bg' :
                     cell.fitScore > -0.1 ? 'bg-white/5' : 'bg-destructive/10';

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[1040]"
        onClick={onClose}
      />

      {/* Drawer - Full width on mobile, 450px on desktop */}
      <div
        className="fixed top-0 right-0 h-full w-full md:w-[450px] md:max-w-[90vw] z-[1050] overflow-y-auto bg-card border-l border-border"
      >
        <div className="sticky top-0 bg-card/95 backdrop-blur-sm border-b border-white/10 px-4 py-3">
          <div className="flex justify-between items-start">
            <div>
              <h5 className="text-base font-semibold text-foreground">
                Why is {cell.recruiterName} {fitLabel.toLowerCase()} for this segment?
              </h5>
              <div className="text-sm text-muted-foreground">{cell.segmentString}</div>
            </div>
            <button
              className="text-muted-foreground hover:text-foreground transition-colors p-2 rounded-md hover:bg-white/[0.06] min-w-[44px] min-h-[44px] flex items-center justify-center"
              onClick={onClose}
            >
              <i className="bi bi-x-lg"></i>
            </button>
          </div>
        </div>

        <div className="p-4">
          {/* FitScore Summary */}
          <div className={`text-center p-4 rounded-lg mb-4 ${fitBgClass}`}>
            <div className="text-xs text-muted-foreground uppercase tracking-wider">FitScore</div>
            <div className={`text-4xl font-mono font-bold mt-1 ${fitColorClass}`}>
              {cell.fitScore > 0 ? '+' : ''}{cell.fitScore.toFixed(2)}
            </div>
            <div className="flex justify-center items-center gap-2 mt-2">
              <ConfidenceBadge confidence={cell.confidence} />
              <span className="text-sm text-muted-foreground">n={cell.sampleSize}</span>
            </div>
          </div>

          {/* Metric Breakdown */}
          <h6 className="text-sm font-semibold text-foreground mb-3">
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
          <h6 className="text-sm font-semibold text-foreground mt-6 mb-3">
            <i className="bi bi-info-circle mr-2"></i>
            About Shrinkage
          </h6>
          <div className="p-3 rounded-lg bg-white/5 border border-white/10 text-sm text-muted-foreground">
            <p className="mb-2">
              Shrinkage adjusts raw performance residuals based on sample size.
              With n={cell.sampleSize} observations and k={CAPACITY_CONSTANTS.SHRINKAGE_K}:
            </p>
            <div className="text-center mb-2 font-mono text-foreground">
              shrinkage = n/(n+k) = {cell.sampleSize}/({cell.sampleSize}+{CAPACITY_CONSTANTS.SHRINKAGE_K}) = {(cell.sampleSize / (cell.sampleSize + CAPACITY_CONSTANTS.SHRINKAGE_K)).toFixed(2)}
            </div>
            <p className="mb-0">
              This means {Math.round((1 - cell.sampleSize / (cell.sampleSize + CAPACITY_CONSTANTS.SHRINKAGE_K)) * 100)}% of the raw residual
              is "shrunk" toward zero to account for small sample uncertainty.
            </p>
          </div>

          {/* Confidence Caveat */}
          {cell.confidence !== 'HIGH' && (
            <div className="p-3 rounded-lg bg-warn-bg border border-warn/30 text-warn text-sm mt-4">
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
