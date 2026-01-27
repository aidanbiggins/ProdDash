// Data Health Badge Component
// Compact badge that shows health grade, with popover for details

import React, { useState, useRef, useEffect } from 'react';
import { DataHealth } from '../../types';

interface DataHealthBadgeProps {
  health: DataHealth;
  onConfigureStages?: () => void;
  onExportData?: () => void;
  onClearDatabase?: () => void;
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

export function DataHealthBadge({ health, onConfigureStages, onExportData, onClearDatabase }: DataHealthBadgeProps) {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const badgeRef = useRef<HTMLButtonElement>(null);

  const healthColor = getHealthColor(health.overallHealthScore);
  const healthGrade = getHealthGrade(health.overallHealthScore);

  // Close popover when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node) &&
        badgeRef.current &&
        !badgeRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const issues = [
    {
      label: 'Candidates missing first contact',
      percentage: health.candidatesMissingFirstContact.percentage,
      threshold: 10
    },
    {
      label: 'Events missing actor',
      percentage: health.eventsMissingActor.percentage,
      threshold: 10
    },
    {
      label: 'Reqs missing level',
      percentage: health.reqsMissingLevel.percentage,
      threshold: 10
    },
    {
      label: 'Reqs missing job family',
      percentage: health.reqsMissingJobFamily.percentage,
      threshold: 10
    }
  ].filter(issue => issue.percentage > 0);

  const hasIssues = issues.length > 0 || health.unmappedStagesCount > 0 || health.lowConfidenceMetrics.length > 0;

  // Badge background colors
  const badgeBg = healthColor === 'success'
    ? 'var(--color-success)'
    : healthColor === 'warning'
      ? 'var(--color-warning)'
      : 'var(--color-danger)';

  return (
    <div className="relative">
      <button
        ref={badgeRef}
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-center w-[42px] h-[42px] rounded-lg text-white font-bold text-base border-0 cursor-pointer"
        style={{
          backgroundColor: badgeBg
        }}
        title={`Data Health: ${healthGrade} (${health.overallHealthScore}%)`}
      >
        {healthGrade}
      </button>

      {/* Popover */}
      {isOpen && (
        <div
          ref={popoverRef}
          className="absolute shadow-lg w-[280px] z-[1050] overflow-hidden rounded-xl"
          style={{
            top: 'calc(100% + 8px)',
            right: 0,
            background: 'rgba(30, 41, 59, 0.95)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
          }}
        >
          {/* Header */}
          <div className="px-3 py-2 border-b border-white/10" style={{ background: 'rgba(15, 23, 42, 0.8)' }}>
            <div className="flex justify-between items-center">
              <span className="font-semibold text-[0.85rem]">Data Health</span>
              <span className="font-bold text-[0.9rem]" style={{ color: `var(--color-${healthColor})` }}>
                {health.overallHealthScore}%
              </span>
            </div>
            <div className="progress-bespoke mt-2" style={{ height: '4px' }}>
              <div
                className={`progress-bar progress-gradient-${healthColor}`}
                style={{ width: `${health.overallHealthScore}%` }}
              />
            </div>
          </div>

          {/* Content */}
          <div className="p-3">
            {/* Issues */}
            {issues.length > 0 && (
              <div className="mb-3">
                {issues.map((issue, i) => (
                  <div
                    key={i}
                    className="flex justify-between items-center py-1"
                    style={{ fontSize: '0.8rem' }}
                  >
                    <span className="text-muted-foreground">{issue.label}</span>
                    <span className={`badge-bespoke ${issue.percentage > issue.threshold ? 'badge-warning-soft' : 'badge-neutral-soft'}`} style={{ fontSize: '0.7rem' }}>
                      {issue.percentage}%
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Unmapped Stages */}
            {health.unmappedStagesCount > 0 && (
              <div
                className="flex justify-between items-center py-2 px-2 rounded mb-3"
                style={{ background: 'var(--color-danger-light)', fontSize: '0.8rem' }}
              >
                <span style={{ color: 'var(--color-danger)' }}>
                  {health.unmappedStagesCount} unmapped stage{health.unmappedStagesCount > 1 ? 's' : ''}
                </span>
                {onConfigureStages && (
                  <button
                    className="btn btn-sm btn-bespoke-primary py-0 px-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      onConfigureStages();
                      setIsOpen(false);
                    }}
                    style={{ fontSize: '0.7rem' }}
                  >
                    Configure
                  </button>
                )}
              </div>
            )}

            {/* Low Confidence */}
            {health.lowConfidenceMetrics.length > 0 && (
              <div className="mb-2">
                <div className="text-muted-foreground mb-1" style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                  Low Confidence
                </div>
                <div className="flex flex-wrap gap-1">
                  {health.lowConfidenceMetrics.slice(0, 4).map((metric, i) => (
                    <span key={i} className="badge-bespoke badge-warning-soft" style={{ fontSize: '0.65rem' }}>
                      {metric}
                    </span>
                  ))}
                  {health.lowConfidenceMetrics.length > 4 && (
                    <span className="badge-bespoke badge-neutral-soft" style={{ fontSize: '0.65rem' }}>
                      +{health.lowConfidenceMetrics.length - 4} more
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* All Good */}
            {!hasIssues && (
              <div className="text-center py-1">
                <span className="text-muted-foreground text-[0.8rem]">
                  <i className="bi bi-check-circle text-success mr-1"></i>
                  All checks passed
                </span>
              </div>
            )}
          </div>

          {/* Data Actions */}
          <div className="border-t border-white/10">
            {onConfigureStages && (
              <button
                className="w-full text-left px-3 py-2 border-0 bg-transparent flex items-center gap-2 text-[0.85rem] cursor-pointer text-[var(--text-primary)] hover:bg-white/10"
                onClick={() => { onConfigureStages(); setIsOpen(false); }}
              >
                Stage Mapping
              </button>
            )}
            {onExportData && (
              <button
                className="w-full text-left px-3 py-2 border-0 bg-transparent flex items-center gap-2 text-[0.85rem] cursor-pointer text-[var(--text-primary)] hover:bg-white/10"
                onClick={() => { onExportData(); setIsOpen(false); }}
              >
                Export Data
              </button>
            )}
            {onClearDatabase && (
              <button
                className="w-full text-left px-3 py-2 border-0 bg-transparent flex items-center gap-2 text-[0.85rem] cursor-pointer hover:bg-white/10"
                style={{ color: 'var(--danger)' }}
                onClick={() => { onClearDatabase(); setIsOpen(false); }}
              >
                Clear Database
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
