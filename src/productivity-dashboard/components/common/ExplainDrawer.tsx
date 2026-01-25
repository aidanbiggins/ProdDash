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
      lastExplanationId.current = null;
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
        className="fixed top-0 left-0 w-full h-full glass-backdrop transition-opacity duration-300 ease-in-out"
        style={{
          zIndex: 1040,
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? 'auto' : 'none',
        }}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className="fixed top-0 right-0 h-full flex flex-col glass-drawer w-[420px] max-w-[90vw] transition-transform duration-300 ease-in-out"
        style={{
          zIndex: 1050,
          transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-3 glass-drawer-header">
          <div className="flex items-center gap-3">
            {/* Back/Forward Navigation */}
            {(canGoBack || canGoForward) && (
              <div className="flex items-center gap-1">
                <button
                  className="p-1 w-7 h-7 rounded text-sm"
                  onClick={onGoBack}
                  disabled={!canGoBack}
                  style={{
                    color: canGoBack ? 'var(--text-primary)' : 'var(--text-secondary)',
                    opacity: canGoBack ? 1 : 0.4,
                    backgroundColor: canGoBack ? 'rgba(255,255,255,0.1)' : 'transparent',
                  }}
                  title="Previous metric"
                >
                  <i className="bi bi-chevron-left"></i>
                </button>
                <button
                  className="p-1 w-7 h-7 rounded text-sm"
                  onClick={onGoForward}
                  disabled={!canGoForward}
                  style={{
                    color: canGoForward ? 'var(--text-primary)' : 'var(--text-secondary)',
                    opacity: canGoForward ? 1 : 0.4,
                    backgroundColor: canGoForward ? 'rgba(255,255,255,0.1)' : 'transparent',
                  }}
                  title="Next metric"
                >
                  <i className="bi bi-chevron-right"></i>
                </button>
                {currentIndex !== undefined && totalCount !== undefined && totalCount > 1 && (
                  <span className="text-sm ml-1 text-[0.7rem]" style={{ color: 'var(--text-secondary)' }}>
                    {currentIndex + 1}/{totalCount}
                  </span>
                )}
              </div>
            )}
            <div>
              <div className="text-xs text-uppercase" style={{ color: 'var(--text-secondary)', letterSpacing: '0.05em' }}>
                Explain
              </div>
              <div className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                {explanation.metricLabel}
              </div>
            </div>
          </div>
          <button
            className="text-sm"
            onClick={onClose}
            style={{ color: 'var(--text-secondary)' }}
          >
            <i className="bi bi-x-lg"></i>
          </button>
        </div>

        {/* Content */}
        <div className="grow overflow-auto p-3">
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
          className="p-3 text-sm border-t border-white/10"
          style={{
            color: 'var(--text-secondary)',
          }}
        >
          <div className="flex justify-between">
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
        className="p-3 rounded mb-4 bg-red-500/15 border border-red-500/30"
      >
        <div className="flex items-center gap-2 mb-2">
          <i className="bi bi-exclamation-triangle text-[1.25rem]" style={{ color: '#ef4444' }}></i>
          <span className="font-bold" style={{ color: '#ef4444' }}>BLOCKED</span>
        </div>
        <p className="mb-0 text-sm" style={{ color: 'var(--text-primary)' }}>
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
              <code className="text-sm" style={{ color: '#f59e0b' }}>
                {reason.code}
              </code>
              <p className="mb-0 mt-1 text-sm" style={{ color: 'var(--text-primary)' }}>
                {reason.message}
              </p>
              {reason.sampleCount !== undefined && (
                <p className="mb-0 mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
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
        <ul className="mb-0 pl-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
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
          className="inline-block px-4 py-3 rounded bg-teal-400/10 border border-teal-400/30"
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
          <div className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
            vs {explanation.benchmark.label}: {explanation.benchmark.value} {explanation.unit}
          </div>
        )}

        {explanation.status === 'partial' && (
          <div
            className="mt-2 inline-block px-2 py-1 rounded text-sm bg-amber-500/20 text-amber-500"
          >
            <i className="bi bi-exclamation-circle mr-1"></i>
            Partial Data
          </div>
        )}
      </div>

      {/* Formula Section */}
      <div className="mb-4">
        <SectionHeader>Formula</SectionHeader>
        <div
          className="p-2 rounded font-mono text-sm"
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
          <div className="text-sm">
            {explanation.breakdown.map((row, idx) => (
              <div
                key={idx}
                className="flex justify-between py-2 border-b border-white/10"
              >
                <span style={{ color: 'var(--text-secondary)' }}>{row.label}</span>
                <span className="font-mono" style={{ color: 'var(--text-primary)' }}>
                  {row.value !== null ? `${row.value} ${row.unit}` : '--'}
                </span>
              </div>
            ))}
          </div>
          {explanation.mathInvariantValid === false && (
            <div className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
              <i className="bi bi-info-circle mr-1"></i>
              Phase medians may not sum to total — each is calculated independently
            </div>
          )}
        </div>
      )}

      {/* Data Included Section */}
      <div className="mb-4">
        <SectionHeader>Data Included</SectionHeader>
        <div className="flex gap-3 mb-2">
          <div>
            <span className="font-mono font-bold" style={{ color: '#22c55e' }}>
              {explanation.includedCount}
            </span>
            <span className="ml-1 text-sm" style={{ color: 'var(--text-secondary)' }}>included</span>
          </div>
          {explanation.excludedCount > 0 && (
            <div>
              <span className="font-mono font-bold" style={{ color: '#ef4444' }}>
                {explanation.excludedCount}
              </span>
              <span className="ml-1 text-sm" style={{ color: 'var(--text-secondary)' }}>excluded</span>
            </div>
          )}
        </div>

        {explanation.exclusionReasons.length > 0 && (
          <ul className="mb-0 pl-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
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
          <div className="flex items-center gap-2">
            <ConfidenceBadge grade={explanation.confidenceGrade} />
            {explanation.confidenceNote && (
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
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
          <div className="text-sm">
            {explanation.topContributors.map((contrib, idx) => (
              <div
                key={contrib.id}
                className="flex justify-between items-center py-2 border-b border-white/5"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="rounded-full px-2 py-0.5 min-w-[1.5rem] text-center bg-white/10"
                    style={{
                      color: 'var(--text-secondary)',
                    }}
                  >
                    {idx + 1}
                  </span>
                  <span
                    className="truncate max-w-[200px]"
                    style={{ color: 'var(--text-primary)' }}
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
          <div className="text-sm">
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
      className="text-uppercase text-sm mb-2 font-semibold"
      style={{
        color: 'var(--text-secondary)',
        letterSpacing: '0.05em',
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
      className="inline-flex items-center px-2 py-0.5 rounded uppercase text-xs font-medium"
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
      <div className="flex items-start gap-2">
        <i
          className={`bi ${style.icon}`}
          style={{ color: style.iconColor, marginTop: '2px' }}
        ></i>
        <div className="grow">
          <div style={{ color: 'var(--text-primary)' }}>{action.action}</div>
          {action.reason && (
            <div className="mt-1 text-[0.8rem]" style={{ color: 'var(--text-secondary)' }}>
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
      className="mb-4 p-3 rounded bg-violet-500/10 border border-violet-500/30"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <i className="bi bi-stars" style={{ color: '#a78bfa' }}></i>
          <span className="text-sm font-bold" style={{ color: '#a78bfa' }}>AI Summary</span>
        </div>
        {!result && !isLoading && (
          <button
            className="text-sm px-2 py-1 rounded bg-violet-500/20 border border-violet-500/40 text-[0.75rem]"
            onClick={onGenerate}
            style={{
              color: '#a78bfa',
            }}
          >
            <i className="bi bi-lightning-charge mr-1"></i>
            Generate
          </button>
        )}
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center gap-2 py-2">
          <LogoSpinner size={32} message="Generating summary..." />
        </div>
      )}

      {/* Error State */}
      {error && (
        <div
          className="p-2 rounded text-sm bg-red-500/10 border border-red-500/30 text-red-500"
        >
          <i className="bi bi-exclamation-circle mr-1"></i>
          {error}
        </div>
      )}

      {/* Result */}
      {result && !error && (
        <div>
          <p className="mb-2 text-sm" style={{ color: 'var(--text-primary)' }}>
            {result.summary}
          </p>
          {result.bullets.length > 0 && (
            <ul className="mb-0 pl-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
              {result.bullets.map((bullet, idx) => (
                <li key={idx}>{bullet}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Placeholder when not generated - now auto-generates so this is rarely shown */}
      {!result && !isLoading && !error && (
        <div className="flex items-center gap-2 py-1">
          <span className="text-sm ai-generating" style={{ color: 'var(--text-secondary)' }}>
            <i className="bi bi-lightning-charge-fill"></i> Preparing AI analysis...
          </span>
        </div>
      )}
    </div>
  );
}
