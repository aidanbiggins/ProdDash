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
    <div className="border rounded p-3 mb-2" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
      <div className="d-flex justify-content-between align-items-start mb-2">
        <div>
          <span className="badge-bespoke badge-primary-soft me-2">#{rec.rank}</span>
          <strong>{rec.reqTitle}</strong>
          <span className="text-muted small ms-2">({rec.reqId})</span>
        </div>
        <span className="badge-bespoke badge-neutral-soft">
          {rec.demandImpact.toFixed(0)} WU
        </span>
      </div>

      <div className="row g-2 small mb-2">
        <div className="col-6">
          <div className="text-muted">From:</div>
          <div>
            {rec.fromRecruiterName}
            <span
              className="badge ms-1"
              style={{
                background: 'rgba(239, 68, 68, 0.15)',
                color: '#f87171',
                fontSize: '0.7rem'
              }}
            >
              {Math.round(rec.fromUtilization * 100)}%
            </span>
          </div>
        </div>
        <div className="col-6">
          <div className="text-muted">To:</div>
          <div>
            {rec.toRecruiterName}
            <span
              className="badge ms-1"
              style={{
                background: 'rgba(34, 197, 94, 0.15)',
                color: '#34d399',
                fontSize: '0.7rem'
              }}
            >
              {Math.round(rec.toUtilization * 100)}%
            </span>
          </div>
        </div>
      </div>

      <div className="small text-muted mb-2">
        <i className="bi bi-info-circle me-1"></i>
        {rec.rationale}
      </div>

      {rec.fitScoreImprovement !== null && (
        <div className="small mb-2">
          <span className="text-muted">Fit improvement:</span>
          <span
            className="ms-1"
            style={{ color: rec.fitScoreImprovement > 0 ? '#34d399' : '#f87171' }}
          >
            {rec.fitScoreImprovement > 0 ? '+' : ''}{rec.fitScoreImprovement.toFixed(2)}
          </span>
        </div>
      )}

      {onApply && (
        <div className="text-end">
          <button
            className="btn btn-sm btn-bespoke-secondary"
            onClick={onApply}
          >
            <i className="bi bi-check2 me-1"></i>
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
            <i className="bi bi-arrows-move me-2"></i>
            Suggested Rebalances
          </h6>
        </div>
        <div className="card-body text-center py-4 text-muted">
          <i className="bi bi-check-circle" style={{ fontSize: '2rem', color: '#34d399' }}></i>
          <div className="mt-2">Workload is well distributed</div>
          <div className="small">No rebalancing recommendations at this time</div>
        </div>
      </div>
    );
  }

  return (
    <div className="card-bespoke">
      <div
        className="card-header d-flex justify-content-between align-items-center"
        style={{ cursor: 'pointer' }}
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <h6 className="mb-0">
          <i className="bi bi-arrows-move me-2"></i>
          Suggested Rebalances
        </h6>
        <div className="d-flex align-items-center gap-2">
          <span className="badge-bespoke badge-primary-soft">
            {recommendations.length} moves
          </span>
          <i className={`bi bi-chevron-${isCollapsed ? 'down' : 'up'}`}></i>
        </div>
      </div>

      {!isCollapsed && (
        <div className="card-body">
          <div className="alert alert-light small mb-3" style={{
            background: 'rgba(59, 130, 246, 0.1)',
            border: '1px solid rgba(59, 130, 246, 0.2)',
            color: '#94a3b8'
          }}>
            <i className="bi bi-lightbulb me-1"></i>
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
