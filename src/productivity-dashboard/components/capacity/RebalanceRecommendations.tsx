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
    <div className="border rounded p-3 mb-2" style={{ borderColor: 'var(--glass-border)' }}>
      <div className="flex justify-between items-start mb-2">
        <div>
          <span className="badge-bespoke badge-primary-soft mr-2">#{rec.rank}</span>
          <strong>{rec.reqTitle}</strong>
          <span className="text-muted-foreground text-sm ml-2">({rec.reqId})</span>
        </div>
        <span className="badge-bespoke badge-neutral-soft">
          {rec.demandImpact.toFixed(0)} WU
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm mb-2">
        <div>
          <div className="text-muted-foreground">From:</div>
          <div>
            {rec.fromRecruiterName}
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-500/15 text-red-400 ml-1">
              {Math.round(rec.fromUtilization * 100)}%
            </span>
          </div>
        </div>
        <div>
          <div className="text-muted-foreground">To:</div>
          <div>
            {rec.toRecruiterName}
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-500/15 text-green-400 ml-1">
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
            className={`ml-1 ${rec.fitScoreImprovement > 0 ? 'text-success' : 'text-danger'}`}
          >
            {rec.fitScoreImprovement > 0 ? '+' : ''}{rec.fitScoreImprovement.toFixed(2)}
          </span>
        </div>
      )}

      {onApply && (
        <div className="text-right">
          <button
            className="px-3 py-1.5 text-sm bg-bg-glass border border-glass-border rounded hover:bg-opacity-80 transition-colors"
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
      <div className="card-bespoke">
        <div className="card-header">
          <h6 className="mb-0">
            <i className="bi bi-arrows-move mr-2"></i>
            Suggested Rebalances
          </h6>
        </div>
        <div className="card-body text-center py-4 text-muted-foreground">
          <i className="bi bi-check-circle text-success" style={{ fontSize: '2rem' }}></i>
          <div className="mt-2">Workload is well distributed</div>
          <div className="text-sm">No rebalancing recommendations at this time</div>
        </div>
      </div>
    );
  }

  return (
    <div className="card-bespoke">
      <div
        className="card-header flex justify-between items-center"
        style={{ cursor: 'pointer' }}
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <h6 className="mb-0">
          <i className="bi bi-arrows-move mr-2"></i>
          Suggested Rebalances
        </h6>
        <div className="flex items-center gap-2">
          <span className="badge-bespoke badge-primary-soft">
            {recommendations.length} moves
          </span>
          <i className={`bi bi-chevron-${isCollapsed ? 'down' : 'up'}`}></i>
        </div>
      </div>

      {!isCollapsed && (
        <div className="card-body">
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
