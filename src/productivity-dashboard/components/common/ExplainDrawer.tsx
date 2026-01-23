// ExplainDrawer Component
// Renders an Explanation object in a slide-over drawer
// Includes optional AI Summary feature (requires AI provider to be configured)

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { LogoSpinner } from './LogoSpinner';
import { format } from 'date-fns';
import { Explanation, RecommendedAction } from '../../types/explainTypes';
import { useDashboard } from '../../hooks/useDashboardContext';
import { useAiSummary, AiSummaryResult } from '../../services/aiCopilotService';

interface ExplainDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  explanation: Explanation | null;
  // Navigation props for back/forward between explain cards
  canGoBack?: boolean;
  canGoForward?: boolean;
  onGoBack?: () => void;
  onGoForward?: () => void;
  currentIndex?: number;
  totalCount?: number;
}

export function ExplainDrawer({
  isOpen,
  onClose,
  explanation,
  canGoBack = false,
  canGoForward = false,
  onGoBack,
  onGoForward,
  currentIndex,
  totalCount
}: ExplainDrawerProps) {
  const { aiConfig, isAiEnabled } = useDashboard();
  const aiSummary = useAiSummary();

  // Generate AI summary handler
  const generateSummary = aiSummary.generate;
  const handleGenerateSummary = useCallback(async () => {
    if (!aiConfig || !explanation) return;
    await generateSummary(aiConfig, explanation);
  }, [aiConfig, explanation, generateSummary]);

  // Reset AI summary when drawer closes
  const resetSummary = aiSummary.reset;
  useEffect(() => {
    if (!isOpen) {
      resetSummary();
    }
  }, [isOpen, resetSummary]);

  // Track last explanation to detect when a new one opens
  const lastExplanationId = useRef<string | null>(null);

  // Auto-generate AI summary when drawer opens with AI enabled
  useEffect(() => {
    const explanationId = explanation ? `${explanation.metricId}-${explanation.computedAt.getTime()}` : null;

    if (isOpen && isAiEnabled && explanation && !aiSummary.result && !aiSummary.isLoading && !aiSummary.error) {
      // Only auto-generate if this is a new explanation (not already processed)
      if (explanationId !== lastExplanationId.current) {
        lastExplanationId.current = explanationId;
        handleGenerateSummary();
      }
    }
  }, [isOpen, isAiEnabled, explanation, aiSummary.result, aiSummary.isLoading, aiSummary.error, handleGenerateSummary]);

  // Don't render anything if we've never had an explanation
  if (!explanation) return null;

  const { status } = explanation;
  const isBlocked = status === 'blocked';

  return (
    <>
      {/* Backdrop */}
      <div
        className="position-fixed top-0 start-0 w-100 h-100 glass-backdrop"
        style={{
          zIndex: 1040,
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? 'auto' : 'none',
          transition: 'opacity 0.3s ease-in-out',
        }}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className="position-fixed top-0 end-0 h-100 d-flex flex-column glass-drawer"
        style={{
          width: '420px',
          maxWidth: '90vw',
          zIndex: 1050,
          transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.3s ease-in-out',
        }}
      >
        {/* Header */}
        <div className="d-flex align-items-center justify-content-between p-3 glass-drawer-header">
          <div className="d-flex align-items-center gap-3">
            {/* Back/Forward Navigation */}
            {(canGoBack || canGoForward) && (
              <div className="d-flex align-items-center gap-1">
                <button
                  className="btn btn-sm p-1"
                  onClick={onGoBack}
                  disabled={!canGoBack}
                  style={{
                    color: canGoBack ? 'var(--text-primary)' : 'var(--text-secondary)',
                    opacity: canGoBack ? 1 : 0.4,
                    width: '28px',
                    height: '28px',
                    borderRadius: '4px',
                    backgroundColor: canGoBack ? 'rgba(255,255,255,0.1)' : 'transparent',
                  }}
                  title="Previous metric"
                >
                  <i className="bi bi-chevron-left"></i>
                </button>
                <button
                  className="btn btn-sm p-1"
                  onClick={onGoForward}
                  disabled={!canGoForward}
                  style={{
                    color: canGoForward ? 'var(--text-primary)' : 'var(--text-secondary)',
                    opacity: canGoForward ? 1 : 0.4,
                    width: '28px',
                    height: '28px',
                    borderRadius: '4px',
                    backgroundColor: canGoForward ? 'rgba(255,255,255,0.1)' : 'transparent',
                  }}
                  title="Next metric"
                >
                  <i className="bi bi-chevron-right"></i>
                </button>
                {currentIndex !== undefined && totalCount !== undefined && totalCount > 1 && (
                  <span className="small ms-1" style={{ color: 'var(--text-secondary)', fontSize: '0.7rem' }}>
                    {currentIndex + 1}/{totalCount}
                  </span>
                )}
              </div>
            )}
            <div>
              <div className="small text-uppercase" style={{ color: 'var(--text-secondary)', letterSpacing: '0.05em' }}>
                Explain
              </div>
              <h5 className="mb-0" style={{ color: 'var(--text-primary)' }}>
                {explanation.metricLabel}
              </h5>
            </div>
          </div>
          <button
            className="btn btn-sm"
            onClick={onClose}
            style={{ color: 'var(--text-secondary)' }}
          >
            <i className="bi bi-x-lg"></i>
          </button>
        </div>

        {/* Content */}
        <div className="flex-grow-1 overflow-auto p-3">
          {/* AI Summary Section */}
          {isAiEnabled && (
            <AiSummarySection
              isLoading={aiSummary.isLoading}
              result={aiSummary.result}
              error={aiSummary.error}
              onGenerate={handleGenerateSummary}
            />
          )}

          {isBlocked ? (
            <BlockedContent explanation={explanation} />
          ) : (
            <ReadyContent explanation={explanation} />
          )}
        </div>

        {/* Footer */}
        <div
          className="p-3 small"
          style={{
            borderTop: '1px solid rgba(255,255,255,0.1)',
            color: 'var(--text-secondary)',
          }}
        >
          <div className="d-flex justify-content-between">
            <span>
              {format(explanation.dateRange.start, 'MMM d, yyyy')} - {format(explanation.dateRange.end, 'MMM d, yyyy')}
            </span>
            <span>
              Computed: {format(explanation.computedAt, 'h:mm a')}
            </span>
          </div>
        </div>
      </div>
    </>
  );
}

// Component for blocked state
function BlockedContent({ explanation }: { explanation: Explanation }) {
  return (
    <div>
      {/* Blocked Alert */}
      <div
        className="p-3 rounded mb-4"
        style={{
          backgroundColor: 'rgba(239, 68, 68, 0.15)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
        }}
      >
        <div className="d-flex align-items-center gap-2 mb-2">
          <i className="bi bi-exclamation-triangle" style={{ color: '#ef4444', fontSize: '1.25rem' }}></i>
          <span className="fw-bold" style={{ color: '#ef4444' }}>BLOCKED</span>
        </div>
        <p className="mb-0 small" style={{ color: 'var(--text-primary)' }}>
          This metric cannot be calculated due to missing data.
        </p>
      </div>

      {/* Blocked Reasons */}
      {explanation.blockedReasons && explanation.blockedReasons.length > 0 && (
        <div className="mb-4">
          <SectionHeader>Reasons</SectionHeader>
          {explanation.blockedReasons.map((reason, idx) => (
            <div
              key={idx}
              className="p-2 rounded mb-2"
              style={{
                backgroundColor: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
              }}
            >
              <code className="small" style={{ color: '#f59e0b' }}>
                {reason.code}
              </code>
              <p className="mb-0 mt-1 small" style={{ color: 'var(--text-primary)' }}>
                {reason.message}
              </p>
              {reason.sampleCount !== undefined && (
                <p className="mb-0 mt-1 small" style={{ color: 'var(--text-secondary)' }}>
                  {reason.sampleCount} record(s) affected
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Resolution Suggestions */}
      <div>
        <SectionHeader>To Resolve</SectionHeader>
        <ul className="mb-0 ps-3 small" style={{ color: 'var(--text-secondary)' }}>
          <li>Expand the date range</li>
          <li>Check if required date fields are being imported</li>
          <li>Verify data mapping in CSV import</li>
        </ul>
      </div>
    </div>
  );
}

// Component for ready/partial state
function ReadyContent({ explanation }: { explanation: Explanation }) {
  return (
    <div>
      {/* Value Section */}
      <div className="text-center mb-4">
        <div
          className="d-inline-block px-4 py-3 rounded"
          style={{
            backgroundColor: 'rgba(45, 212, 191, 0.1)',
            border: '1px solid rgba(45, 212, 191, 0.3)',
          }}
        >
          <div
            className="font-mono"
            style={{
              fontSize: '2.5rem',
              fontWeight: 700,
              color: 'var(--text-primary)',
            }}
          >
            {explanation.value !== null ? formatValueWithUnit(explanation.value, explanation.unit) : '--'}
          </div>
        </div>

        {explanation.benchmark && (
          <div className="mt-2 small" style={{ color: 'var(--text-secondary)' }}>
            vs {explanation.benchmark.label}: {explanation.benchmark.value} {explanation.unit}
          </div>
        )}

        {explanation.status === 'partial' && (
          <div
            className="mt-2 d-inline-block px-2 py-1 rounded small"
            style={{ backgroundColor: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b' }}
          >
            <i className="bi bi-exclamation-circle me-1"></i>
            Partial Data
          </div>
        )}
      </div>

      {/* Formula Section */}
      <div className="mb-4">
        <SectionHeader>Formula</SectionHeader>
        <div
          className="p-2 rounded font-mono small"
          style={{
            backgroundColor: 'rgba(0,0,0,0.3)',
            color: '#2dd4bf',
            wordBreak: 'break-word',
          }}
        >
          {explanation.formula}
        </div>
      </div>

      {/* Breakdown Section (if available) */}
      {explanation.breakdown && explanation.breakdown.length > 0 && (
        <div className="mb-4">
          <SectionHeader>Breakdown</SectionHeader>
          <div className="small">
            {explanation.breakdown.map((row, idx) => (
              <div
                key={idx}
                className="d-flex justify-content-between py-2"
                style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}
              >
                <span style={{ color: 'var(--text-secondary)' }}>{row.label}</span>
                <span className="font-mono" style={{ color: 'var(--text-primary)' }}>
                  {row.value !== null ? `${row.value} ${row.unit}` : '--'}
                </span>
              </div>
            ))}
          </div>
          {explanation.mathInvariantValid === false && (
            <div className="mt-2 small" style={{ color: 'var(--text-secondary)' }}>
              <i className="bi bi-info-circle me-1"></i>
              Phase medians may not sum to total — each is calculated independently
            </div>
          )}
        </div>
      )}

      {/* Data Included Section */}
      <div className="mb-4">
        <SectionHeader>Data Included</SectionHeader>
        <div className="d-flex gap-3 mb-2">
          <div>
            <span className="font-mono fw-bold" style={{ color: '#22c55e' }}>
              {explanation.includedCount}
            </span>
            <span className="ms-1 small" style={{ color: 'var(--text-secondary)' }}>included</span>
          </div>
          {explanation.excludedCount > 0 && (
            <div>
              <span className="font-mono fw-bold" style={{ color: '#ef4444' }}>
                {explanation.excludedCount}
              </span>
              <span className="ms-1 small" style={{ color: 'var(--text-secondary)' }}>excluded</span>
            </div>
          )}
        </div>

        {explanation.exclusionReasons.length > 0 && (
          <ul className="mb-0 ps-3 small" style={{ color: 'var(--text-secondary)' }}>
            {explanation.exclusionReasons.map((er, idx) => (
              <li key={idx}>
                {er.count} {er.reason}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Confidence Section */}
      {explanation.confidenceGrade && (
        <div className="mb-4">
          <SectionHeader>Confidence</SectionHeader>
          <div className="d-flex align-items-center gap-2">
            <ConfidenceBadge grade={explanation.confidenceGrade} />
            {explanation.confidenceNote && (
              <span className="small" style={{ color: 'var(--text-secondary)' }}>
                {explanation.confidenceNote}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Top Contributors Section */}
      {explanation.topContributors && explanation.topContributors.length > 0 && (
        <div className="mb-4">
          <SectionHeader>Top Contributors (Longest)</SectionHeader>
          <div className="small">
            {explanation.topContributors.map((contrib, idx) => (
              <div
                key={contrib.id}
                className="d-flex justify-content-between align-items-center py-2"
                style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
              >
                <div className="d-flex align-items-center gap-2">
                  <span
                    className="badge rounded-pill"
                    style={{
                      backgroundColor: 'rgba(255,255,255,0.1)',
                      color: 'var(--text-secondary)',
                      minWidth: '1.5rem',
                    }}
                  >
                    {idx + 1}
                  </span>
                  <span
                    className="text-truncate"
                    style={{ color: 'var(--text-primary)', maxWidth: '200px' }}
                    title={contrib.label}
                  >
                    {contrib.label}
                  </span>
                </div>
                <span className="font-mono" style={{ color: 'var(--text-primary)' }}>
                  {contrib.value !== null ? `${contrib.value}d` : '--'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommended Actions Section */}
      {explanation.recommendedActions && explanation.recommendedActions.length > 0 && (
        <div>
          <SectionHeader>Recommended Next Actions</SectionHeader>
          <div className="small">
            {explanation.recommendedActions.map((action, idx) => (
              <ActionItem key={idx} action={action} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Helper function to format value with unit, avoiding redundancy like "3d days"
function formatValueWithUnit(value: number | string, unit: string): React.ReactNode {
  const valueStr = String(value);

  // Check if value already has a unit suffix
  const hasDaySuffix = /\d+d$/.test(valueStr);
  const hasHourSuffix = /\d+h$/.test(valueStr);
  const hasPercentSuffix = /%$/.test(valueStr);

  // If value already includes a unit indicator, just show the value
  if (hasDaySuffix || hasHourSuffix || hasPercentSuffix) {
    // Extract number and show with proper formatting
    const num = parseFloat(valueStr);
    if (!isNaN(num)) {
      if (hasDaySuffix) return <>{num}<span style={{ fontSize: '1rem', color: 'var(--text-secondary)', marginLeft: '4px' }}>days</span></>;
      if (hasHourSuffix) return <>{num}<span style={{ fontSize: '1rem', color: 'var(--text-secondary)', marginLeft: '4px' }}>hours</span></>;
      if (hasPercentSuffix) return <>{num}<span style={{ fontSize: '1rem', color: 'var(--text-secondary)', marginLeft: '4px' }}>%</span></>;
    }
    return valueStr;
  }

  // Otherwise show value + unit
  return (
    <>
      {valueStr}
      {unit && <span style={{ fontSize: '1rem', color: 'var(--text-secondary)', marginLeft: '4px' }}>{unit}</span>}
    </>
  );
}

// Helper Components
function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="text-uppercase small mb-2"
      style={{
        color: 'var(--text-secondary)',
        letterSpacing: '0.05em',
        fontWeight: 600,
      }}
    >
      {children}
    </div>
  );
}

function ConfidenceBadge({ grade }: { grade: 'high' | 'medium' | 'low' }) {
  const colors = {
    high: { bg: 'rgba(34, 197, 94, 0.2)', text: '#22c55e' },
    medium: { bg: 'rgba(245, 158, 11, 0.2)', text: '#f59e0b' },
    low: { bg: 'rgba(239, 68, 68, 0.2)', text: '#ef4444' },
  };
  const c = colors[grade];

  return (
    <span
      className="px-2 py-1 rounded text-uppercase small fw-bold"
      style={{ backgroundColor: c.bg, color: c.text }}
    >
      {grade}
    </span>
  );
}

function ActionItem({ action }: { action: RecommendedAction }) {
  const priorityStyles = {
    high: {
      border: '1px solid rgba(239, 68, 68, 0.4)',
      bg: 'rgba(239, 68, 68, 0.1)',
      icon: 'bi-exclamation-circle-fill',
      iconColor: '#ef4444',
    },
    medium: {
      border: '1px solid rgba(245, 158, 11, 0.4)',
      bg: 'rgba(245, 158, 11, 0.1)',
      icon: 'bi-arrow-right-circle-fill',
      iconColor: '#f59e0b',
    },
    low: {
      border: '1px solid rgba(255,255,255,0.2)',
      bg: 'rgba(255,255,255,0.05)',
      icon: 'bi-info-circle-fill',
      iconColor: 'var(--text-secondary)',
    },
  };
  const style = priorityStyles[action.priority];

  return (
    <div
      className="p-2 rounded mb-2"
      style={{
        border: style.border,
        backgroundColor: style.bg,
      }}
    >
      <div className="d-flex align-items-start gap-2">
        <i
          className={`bi ${style.icon}`}
          style={{ color: style.iconColor, marginTop: '2px' }}
        ></i>
        <div className="flex-grow-1">
          <div style={{ color: 'var(--text-primary)' }}>{action.action}</div>
          {action.reason && (
            <div className="mt-1" style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
              {action.reason}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// AI Summary Section Component
interface AiSummarySectionProps {
  isLoading: boolean;
  result: AiSummaryResult | null;
  error: string | null;
  onGenerate: () => void;
}

function AiSummarySection({ isLoading, result, error, onGenerate }: AiSummarySectionProps) {
  return (
    <div
      className="mb-4 p-3 rounded"
      style={{
        backgroundColor: 'rgba(139, 92, 246, 0.1)',
        border: '1px solid rgba(139, 92, 246, 0.3)',
      }}
    >
      <div className="d-flex align-items-center justify-content-between mb-2">
        <div className="d-flex align-items-center gap-2">
          <i className="bi bi-stars" style={{ color: '#a78bfa' }}></i>
          <span className="small fw-bold" style={{ color: '#a78bfa' }}>AI Summary</span>
        </div>
        {!result && !isLoading && (
          <button
            className="btn btn-sm"
            onClick={onGenerate}
            style={{
              backgroundColor: 'rgba(139, 92, 246, 0.2)',
              border: '1px solid rgba(139, 92, 246, 0.4)',
              color: '#a78bfa',
              fontSize: '0.75rem',
            }}
          >
            <i className="bi bi-lightning-charge me-1"></i>
            Generate
          </button>
        )}
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="d-flex align-items-center gap-2 py-2">
          <LogoSpinner size={32} message="Generating summary..." />
        </div>
      )}

      {/* Error State */}
      {error && (
        <div
          className="p-2 rounded small"
          style={{
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#ef4444',
          }}
        >
          <i className="bi bi-exclamation-circle me-1"></i>
          {error}
        </div>
      )}

      {/* Result */}
      {result && !error && (
        <div>
          <p className="mb-2 small" style={{ color: 'var(--text-primary)' }}>
            {result.summary}
          </p>
          {result.bullets.length > 0 && (
            <ul className="mb-0 ps-3 small" style={{ color: 'var(--text-secondary)' }}>
              {result.bullets.map((bullet, idx) => (
                <li key={idx}>{bullet}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Placeholder when not generated - now auto-generates so this is rarely shown */}
      {!result && !isLoading && !error && (
        <div className="d-flex align-items-center gap-2 py-1">
          <span className="small ai-generating" style={{ color: 'var(--text-secondary)' }}>
            <i className="bi bi-lightning-charge-fill"></i> Preparing AI analysis...
          </span>
        </div>
      )}
    </div>
  );
}
