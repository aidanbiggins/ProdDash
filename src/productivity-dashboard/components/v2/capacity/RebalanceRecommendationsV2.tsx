/**
 * RebalanceRecommendationsV2
 *
 * Shows suggested req reassignments to balance team workload.
 * V2 version using glass-panel and Tailwind tokens.
 * Uses the real RebalanceRecommendation type from capacityTypes.
 */

import React from 'react';
import { ArrowRight, TrendingDown, TrendingUp, CheckCircle, Zap } from 'lucide-react';
import { RebalanceRecommendation } from '../../../types/capacityTypes';

interface RebalanceRecommendationsV2Props {
  recommendations: RebalanceRecommendation[];
  onApply?: (recommendation: RebalanceRecommendation) => void;
  appliedIds?: Set<string>;
  privacyMode?: 'normal' | 'anonymized';
}

export function RebalanceRecommendationsV2({
  recommendations,
  onApply,
  appliedIds = new Set(),
  privacyMode = 'normal',
}: RebalanceRecommendationsV2Props) {
  const getDisplayName = (name: string, type: 'from' | 'to') => {
    if (privacyMode === 'anonymized') {
      return type === 'from' ? 'Recruiter A' : 'Recruiter B';
    }
    return name;
  };

  const formatUtilization = (util: number) => `${Math.round(util * 100)}%`;

  if (recommendations.length === 0) {
    return (
      <div className="glass-panel p-6 text-center">
        <CheckCircle className="w-8 h-8 text-good mx-auto mb-2" />
        <p className="text-sm text-foreground font-medium">Team is Well Balanced</p>
        <p className="text-sm text-muted-foreground mt-1">
          No rebalancing recommendations at this time.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {recommendations.map((rec) => {
        const isApplied = appliedIds.has(rec.reqId);

        return (
          <div
            key={rec.reqId}
            className={`glass-panel p-4 transition-all ${isApplied ? 'opacity-60' : ''}`}
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium px-2 py-0.5 rounded bg-primary/20 text-primary">
                    #{rec.rank}
                  </span>
                  <span className="text-sm font-medium text-foreground truncate max-w-[200px]" title={rec.reqTitle}>
                    {rec.reqTitle}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {rec.rationale}
                </p>
              </div>
              {rec.fitScoreImprovement !== null && rec.fitScoreImprovement > 0 && (
                <div className="flex items-center gap-1 text-xs">
                  <Zap className="w-3 h-3 text-good" />
                  <span className="text-good font-mono">+{Math.round(rec.fitScoreImprovement * 100)}%</span>
                </div>
              )}
            </div>

            {/* Transfer visualization */}
            <div className="flex items-center justify-center gap-4 py-3 px-4 rounded-lg bg-muted/30 mb-3">
              {/* From */}
              <div className="text-center flex-1">
                <div className="text-xs text-muted-foreground mb-1">From</div>
                <div className="text-sm font-medium text-foreground">
                  {getDisplayName(rec.fromRecruiterName, 'from')}
                </div>
                <div className="flex items-center justify-center gap-1 mt-1 text-xs">
                  <span className={`font-mono ${rec.fromUtilization > 1.1 ? 'text-bad' : 'text-foreground'}`}>
                    {formatUtilization(rec.fromUtilization)}
                  </span>
                  <TrendingDown className="w-3 h-3 text-good" />
                </div>
              </div>

              {/* Arrow */}
              <ArrowRight className="w-6 h-6 text-primary flex-shrink-0" />

              {/* To */}
              <div className="text-center flex-1">
                <div className="text-xs text-muted-foreground mb-1">To</div>
                <div className="text-sm font-medium text-foreground">
                  {getDisplayName(rec.toRecruiterName, 'to')}
                </div>
                <div className="flex items-center justify-center gap-1 mt-1 text-xs">
                  <span className={`font-mono ${rec.toUtilization < 0.7 ? 'text-good' : 'text-foreground'}`}>
                    {formatUtilization(rec.toUtilization)}
                  </span>
                  <TrendingUp className="w-3 h-3 text-warn" />
                </div>
              </div>
            </div>

            {/* Demand impact */}
            <div className="text-xs text-muted-foreground mb-3">
              Demand shift: <span className="font-mono">{rec.demandImpact} WU</span>
            </div>

            {/* Actions */}
            {onApply && (
              <button
                type="button"
                onClick={() => onApply(rec)}
                disabled={isApplied}
                className={`w-full px-4 py-2 rounded-md text-sm font-medium transition-colors min-h-[44px] ${
                  isApplied
                    ? 'bg-good/20 text-good cursor-not-allowed'
                    : 'bg-primary text-primary-foreground hover:bg-primary/90'
                }`}
              >
                {isApplied ? (
                  <>
                    <CheckCircle className="w-4 h-4 inline mr-1" />
                    Applied
                  </>
                ) : (
                  'Apply Recommendation'
                )}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default RebalanceRecommendationsV2;
