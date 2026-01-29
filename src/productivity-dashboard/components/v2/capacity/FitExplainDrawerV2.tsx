/**
 * FitExplainDrawerV2
 *
 * Drawer showing detailed fit analysis between a recruiter and segment.
 * V2 version using GlassDrawer and Tailwind tokens.
 * Uses the real FitMatrixCell type from capacityTypes.
 */

import React from 'react';
import { GlassDrawer } from '../../common';
import { CheckCircle, XCircle, AlertTriangle, TrendingUp, BarChart2 } from 'lucide-react';
import { FitMatrixCell, ConfidenceLevel, getFitLabel } from '../../../types/capacityTypes';

interface FitExplainDrawerV2Props {
  isOpen: boolean;
  onClose: () => void;
  cell: FitMatrixCell | null;
  privacyMode?: 'normal' | 'anonymized';
}

export function FitExplainDrawerV2({
  isOpen,
  onClose,
  cell,
  privacyMode = 'normal',
}: FitExplainDrawerV2Props) {
  if (!isOpen || !cell) return null;

  const displayName = privacyMode === 'anonymized' ? 'Recruiter A' : cell.recruiterName;

  const getScoreColor = (residual: number) => {
    if (residual > 0.1) return 'text-good';
    if (residual > -0.1) return 'text-foreground';
    return 'text-bad';
  };

  const getScoreBg = (score: number) => {
    if (score > 0.3) return 'bg-good/20';
    if (score > 0.1) return 'bg-good/10';
    if (score > -0.1) return 'bg-muted';
    if (score > -0.3) return 'bg-warn/20';
    return 'bg-bad/20';
  };

  const getConfidenceBadge = (level: ConfidenceLevel) => {
    const styles: Record<ConfidenceLevel, string> = {
      HIGH: 'bg-good/20 text-good',
      MED: 'bg-warn/20 text-warn',
      LOW: 'bg-muted text-muted-foreground',
      INSUFFICIENT: 'bg-bad/20 text-bad',
    };
    return (
      <span className={`text-xs px-1.5 py-0.5 rounded ${styles[level]}`}>
        {level}
      </span>
    );
  };

  const formatResidual = (residual: number) => {
    const pct = Math.round(residual * 100);
    return pct > 0 ? `+${pct}%` : `${pct}%`;
  };

  const fitLabel = getFitLabel(cell.fitScore);
  const metrics = cell.metrics;

  // Convert fitScore from -1 to 1 range to a display score 0-100
  const displayScore = Math.round((cell.fitScore + 1) * 50);

  return (
    <GlassDrawer
      title="Fit Analysis"
      onClose={onClose}
      width="440px"
    >
      {/* Header */}
      <div className="mb-4">
        <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">
          Recruiter × Segment
        </div>
        <div className="font-semibold text-foreground">
          {displayName}
        </div>
        <div className="text-sm text-muted-foreground">
          {cell.segmentString}
        </div>
      </div>

      {/* Overall Score */}
      <div className={`p-4 rounded-lg mb-4 ${getScoreBg(cell.fitScore)}`}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">Fit Score</span>
            {getConfidenceBadge(cell.confidence)}
          </div>
          <span className={`font-mono text-2xl font-bold ${getScoreColor(cell.fitScore)}`}>
            {displayScore}
          </span>
        </div>
        <div className="text-sm text-foreground">
          <span className={`font-semibold ${getScoreColor(cell.fitScore)}`}>{fitLabel}</span>
          <span className="text-muted-foreground ml-2">• n={cell.sampleSize}</span>
        </div>
        <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              cell.fitScore > 0.1
                ? 'bg-good'
                : cell.fitScore > -0.1
                  ? 'bg-warn'
                  : 'bg-bad'
            }`}
            style={{ width: `${displayScore}%` }}
          />
        </div>
      </div>

      {/* Metric Breakdown */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-3">
          <BarChart2 className="w-4 h-4 text-muted-foreground" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Performance vs Expected
          </span>
        </div>
        <div className="space-y-3">
          {/* Hires per WU */}
          <div className="glass-panel p-3">
            <div className="flex items-start justify-between mb-1">
              <div className="flex items-center gap-2">
                {metrics.hires_per_wu.residual > 0 ? (
                  <CheckCircle className="w-4 h-4 text-good flex-shrink-0" />
                ) : metrics.hires_per_wu.residual > -0.1 ? (
                  <AlertTriangle className="w-4 h-4 text-warn flex-shrink-0" />
                ) : (
                  <XCircle className="w-4 h-4 text-bad flex-shrink-0" />
                )}
                <span className="text-sm font-medium text-foreground">
                  Hires per WU
                </span>
              </div>
              <span className={`font-mono text-sm font-semibold ${getScoreColor(metrics.hires_per_wu.residual)}`}>
                {formatResidual(metrics.hires_per_wu.residual)}
              </span>
            </div>
            <p className="text-xs text-muted-foreground ml-6">
              {metrics.hires_per_wu.value.toFixed(2)} actual (n={metrics.hires_per_wu.n})
            </p>
          </div>

          {/* TTF Days */}
          <div className="glass-panel p-3">
            <div className="flex items-start justify-between mb-1">
              <div className="flex items-center gap-2">
                {metrics.ttf_days.residual > 0 ? (
                  <CheckCircle className="w-4 h-4 text-good flex-shrink-0" />
                ) : metrics.ttf_days.residual > -0.1 ? (
                  <AlertTriangle className="w-4 h-4 text-warn flex-shrink-0" />
                ) : (
                  <XCircle className="w-4 h-4 text-bad flex-shrink-0" />
                )}
                <span className="text-sm font-medium text-foreground">
                  Time to Fill
                </span>
              </div>
              <span className={`font-mono text-sm font-semibold ${getScoreColor(metrics.ttf_days.residual)}`}>
                {formatResidual(metrics.ttf_days.residual)}
              </span>
            </div>
            <p className="text-xs text-muted-foreground ml-6">
              {metrics.ttf_days.value.toFixed(0)} days (n={metrics.ttf_days.n})
            </p>
          </div>

          {/* Offer Accept Rate */}
          <div className="glass-panel p-3">
            <div className="flex items-start justify-between mb-1">
              <div className="flex items-center gap-2">
                {metrics.offer_accept_rate.residual > 0 ? (
                  <CheckCircle className="w-4 h-4 text-good flex-shrink-0" />
                ) : metrics.offer_accept_rate.residual > -0.1 ? (
                  <AlertTriangle className="w-4 h-4 text-warn flex-shrink-0" />
                ) : (
                  <XCircle className="w-4 h-4 text-bad flex-shrink-0" />
                )}
                <span className="text-sm font-medium text-foreground">
                  Offer Accept Rate
                </span>
              </div>
              <span className={`font-mono text-sm font-semibold ${getScoreColor(metrics.offer_accept_rate.residual)}`}>
                {formatResidual(metrics.offer_accept_rate.residual)}
              </span>
            </div>
            <p className="text-xs text-muted-foreground ml-6">
              {(metrics.offer_accept_rate.value * 100).toFixed(0)}% (n={metrics.offer_accept_rate.n})
            </p>
          </div>

          {/* Candidate Throughput */}
          <div className="glass-panel p-3">
            <div className="flex items-start justify-between mb-1">
              <div className="flex items-center gap-2">
                {metrics.candidate_throughput.residual > 0 ? (
                  <CheckCircle className="w-4 h-4 text-good flex-shrink-0" />
                ) : metrics.candidate_throughput.residual > -0.1 ? (
                  <AlertTriangle className="w-4 h-4 text-warn flex-shrink-0" />
                ) : (
                  <XCircle className="w-4 h-4 text-bad flex-shrink-0" />
                )}
                <span className="text-sm font-medium text-foreground">
                  Candidate Throughput
                </span>
              </div>
              <span className={`font-mono text-sm font-semibold ${getScoreColor(metrics.candidate_throughput.residual)}`}>
                {formatResidual(metrics.candidate_throughput.residual)}
              </span>
            </div>
            <p className="text-xs text-muted-foreground ml-6">
              {metrics.candidate_throughput.value.toFixed(1)}/week (n={metrics.candidate_throughput.n})
            </p>
          </div>
        </div>
      </div>

      {/* Interpretation */}
      <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Interpretation</span>
        </div>
        <p className="text-sm text-foreground">
          {cell.fitScore > 0.1
            ? `${displayName} outperforms expectations for ${cell.segmentString} roles. Consider routing similar reqs to this recruiter.`
            : cell.fitScore > -0.1
              ? `${displayName} performs at expected levels for ${cell.segmentString} roles.`
              : `${displayName} underperforms for ${cell.segmentString} roles. Consider alternative assignments or investigate root causes.`}
        </p>
      </div>
    </GlassDrawer>
  );
}

export default FitExplainDrawerV2;
