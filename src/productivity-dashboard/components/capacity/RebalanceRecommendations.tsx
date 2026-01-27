// Rebalance Recommendations Component
// Displays suggested req moves to balance workload

import React, { useState } from 'react';
import { RebalanceRecommendation } from '../../types/capacityTypes';

interface RebalanceRecommendationsProps {
  recommendations: RebalanceRecommendation[];
  onApply?: (recommendation: RebalanceRecommendation) => void;
}

function RecommendationCard({
  rec,
  onApply
}: {
  rec: RebalanceRecommendation;
  onApply?: () => void;
}) {
  return (
    <div className="border border-glass-border rounded-lg p-3 mb-2">
      <div className="flex justify-between items-start mb-2">
        <div>
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-accent/15 text-accent mr-2">#{rec.rank}</span>
          <strong className="text-foreground">{rec.reqTitle}</strong>
          <span className="text-muted-foreground text-sm ml-2">({rec.reqId})</span>
        </div>
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-white/10 text-muted-foreground">
          {rec.demandImpact.toFixed(0)} WU
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm mb-2">
        <div>
          <div className="text-muted-foreground">From:</div>
          <div className="text-foreground">
            {rec.fromRecruiterName}
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-bad-bg text-bad ml-1">
              {Math.round(rec.fromUtilization * 100)}%
            </span>
          </div>
        </div>
        <div>
          <div className="text-muted-foreground">To:</div>
          <div className="text-foreground">
            {rec.toRecruiterName}
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-good-bg text-good ml-1">
              {Math.round(rec.toUtilization * 100)}%
            </span>
          </div>
        </div>
      </div>

      <div className="text-sm text-muted-foreground mb-2">
        <i className="bi bi-info-circle mr-1"></i>
        {rec.rationale}
      </div>

      {rec.fitScoreImprovement !== null && (
        <div className="text-sm mb-2">
          <span className="text-muted-foreground">Fit improvement:</span>
          <span
            className={`ml-1 font-mono ${rec.fitScoreImprovement > 0 ? 'text-good' : 'text-bad'}`}
          >
            {rec.fitScoreImprovement > 0 ? '+' : ''}{rec.fitScoreImprovement.toFixed(2)}
          </span>
        </div>
      )}

      {onApply && (
        <div className="text-right">
          <button
            className="px-3 py-1.5 text-sm font-medium rounded-md bg-white/5 border border-glass-border text-foreground hover:bg-white/10 transition-colors"
            onClick={onApply}
          >
            <i className="bi bi-check2 mr-1"></i>
            Apply
          </button>
        </div>
      )}
    </div>
  );
}

export function RebalanceRecommendations({
  recommendations,
  onApply
}: RebalanceRecommendationsProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  if (recommendations.length === 0) {
    return (
      <div className="rounded-lg border border-glass-border bg-bg-glass">
        <div className="px-4 py-3 border-b border-white/10">
          <h6 className="text-sm font-semibold text-foreground">
            <i className="bi bi-arrows-move mr-2"></i>
            Suggested Rebalances
          </h6>
        </div>
        <div className="text-center py-8 text-muted-foreground">
          <i className="bi bi-check-circle text-good text-3xl"></i>
          <div className="mt-2 text-foreground">Workload is well distributed</div>
          <div className="text-sm">No rebalancing recommendations at this time</div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-glass-border bg-bg-glass">
      <div
        className="flex justify-between items-center px-4 py-3 border-b border-white/10 cursor-pointer hover:bg-white/5 transition-colors"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <h6 className="text-sm font-semibold text-foreground">
          <i className="bi bi-arrows-move mr-2"></i>
          Suggested Rebalances
        </h6>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-accent/15 text-accent">
            {recommendations.length} moves
          </span>
          <i className={`bi bi-chevron-${isCollapsed ? 'down' : 'up'} text-muted-foreground`}></i>
        </div>
      </div>

      {!isCollapsed && (
        <div className="p-4">
          <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-400 text-sm mb-3">
            <i className="bi bi-lightbulb mr-1"></i>
            These are suggestions based on workload and fit analysis.
            Apply only after reviewing each move with your team.
          </div>

          {recommendations.map(rec => (
            <RecommendationCard
              key={`${rec.reqId}-${rec.toRecruiterId}`}
              rec={rec}
              onApply={onApply ? () => onApply(rec) : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default RebalanceRecommendations;
