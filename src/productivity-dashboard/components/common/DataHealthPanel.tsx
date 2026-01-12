// Data Health Panel Component

import React from 'react';
import { DataHealth } from '../../types';

interface DataHealthPanelProps {
  health: DataHealth;
  onConfigureStages?: () => void;
}

function getHealthColor(score: number): string {
  if (score >= 90) return 'success';
  if (score >= 70) return 'warning';
  return 'danger';
}

function getHealthGrade(score: number): string {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

function getGradeClass(grade: string): string {
  return `grade-${grade.toLowerCase()}`;
}

export function DataHealthPanel({ health, onConfigureStages }: DataHealthPanelProps) {
  const healthColor = getHealthColor(health.overallHealthScore);
  const healthGrade = getHealthGrade(health.overallHealthScore);

  const issues = [
    {
      label: 'Candidates missing first contact',
      percentage: health.candidatesMissingFirstContact.percentage,
      count: health.candidatesMissingFirstContact.count,
      threshold: 10
    },
    {
      label: 'Events missing actor',
      percentage: health.eventsMissingActor.percentage,
      count: health.eventsMissingActor.count,
      threshold: 10
    },
    {
      label: 'Reqs missing level',
      percentage: health.reqsMissingLevel.percentage,
      count: health.reqsMissingLevel.count,
      threshold: 10
    },
    {
      label: 'Reqs missing job family',
      percentage: health.reqsMissingJobFamily.percentage,
      count: health.reqsMissingJobFamily.count,
      threshold: 10
    }
  ].filter(issue => issue.percentage > 0);

  return (
    <div className="card-bespoke">
      <div className="card-header d-flex justify-content-between align-items-center">
        <h6 className="mb-0 fw-semibold">Data Health</h6>
        <div className={`health-grade ${getGradeClass(healthGrade)}`}>
          {healthGrade}
        </div>
      </div>
      <div className="card-body">
        {/* Health Score Bar */}
        <div className="mb-4">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <span className="stat-label">Overall Score</span>
            <span className="fw-bold" style={{ color: `var(--color-${healthColor})` }}>
              {health.overallHealthScore}%
            </span>
          </div>
          <div className="progress-bespoke">
            <div
              className={`progress-bar progress-gradient-${healthColor}`}
              style={{ width: `${health.overallHealthScore}%` }}
            />
          </div>
        </div>

        {/* Issues List */}
        {issues.length > 0 && (
          <div className="mb-3">
            <div className="stat-label mb-2">Data Issues</div>
            <div className="d-flex flex-column gap-2">
              {issues.map((issue, i) => (
                <div
                  key={i}
                  className="d-flex justify-content-between align-items-center py-2 px-3 rounded"
                  style={{ background: '#0a0a0a' }}
                >
                  <span className="small text-muted">{issue.label}</span>
                  <span className={`badge-bespoke ${issue.percentage > issue.threshold ? 'badge-warning-soft' : 'badge-neutral-soft'}`}>
                    {issue.percentage}%
                    <span className="opacity-75 ms-1">({issue.count})</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Unmapped Stages */}
        {health.unmappedStagesCount > 0 && (
          <div
            className="d-flex justify-content-between align-items-center py-2 px-3 rounded mb-3"
            style={{ background: 'var(--color-danger-light)' }}
          >
            <span className="small" style={{ color: 'var(--color-danger)' }}>
              Unmapped stages
            </span>
            <div className="d-flex align-items-center gap-2">
              <span className="badge-bespoke badge-danger-soft fw-bold">
                {health.unmappedStagesCount}
              </span>
              {onConfigureStages && (
                <button
                  className="btn btn-sm btn-bespoke-primary py-1 px-2"
                  onClick={onConfigureStages}
                  style={{ fontSize: '0.75rem' }}
                >
                  Configure
                </button>
              )}
            </div>
          </div>
        )}

        {/* Low Confidence Metrics */}
        {health.lowConfidenceMetrics.length > 0 && (
          <div>
            <div className="stat-label mb-2">Low Confidence Metrics</div>
            <div className="d-flex flex-wrap gap-1">
              {health.lowConfidenceMetrics.map((metric, i) => (
                <span key={i} className="badge-bespoke badge-warning-soft">
                  {metric}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* All Good State */}
        {issues.length === 0 && health.unmappedStagesCount === 0 && health.lowConfidenceMetrics.length === 0 && (
          <div className="text-center py-2">
            <span className="small text-muted">✓ All data quality checks passed</span>
          </div>
        )}
      </div>
    </div>
  );
}
