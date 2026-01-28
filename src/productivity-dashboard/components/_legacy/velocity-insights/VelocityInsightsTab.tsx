// Velocity Insights Tab Component
// Analyzes factors that contribute to fast, successful hires
// Implements moonshot fix pass: stage timing gating, evidence drilldowns, dedupe actions, improved narratives

import React, { useState, useMemo, useCallback } from 'react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell
} from 'recharts';
import { format } from 'date-fns';
import { VelocityMetrics, DecayDataPoint, VelocityInsight, CohortComparison, SuccessFactorComparison, Requisition, Candidate, Event, User, HiringManagerFriction, MetricFilters, CanonicalStage } from '../../../types';
import { DashboardConfig } from '../../../types/config';
import { PipelineBenchmarkConfig, HistoricalBenchmarkResult } from '../../../types/pipelineTypes';
import { ActionItem } from '../../../types/actionTypes';
import { AiProviderConfig } from '../../../types/aiTypes';
import { useIsMobile } from '../../../hooks/useIsMobile';
import { PipelineHealthCard, BenchmarkConfigModal } from '../../pipeline-health';
import { VelocityCopilotPanel } from './VelocityCopilotPanel';
// Note: WhatIfSimulatorPanel removed per DECK_UI_UX_REFACTOR_V1.md - canonical home is Scenario Library
import { SubViewHeader } from '../../v2/SubViewHeader';
import { VELOCITY_PAGE_HELP } from './velocityHelpContent';
import { calculatePipelineHealth, generateHistoricalBenchmarks } from '../../../services';
import {
  MIN_OFFERS_FOR_DECAY,
  MIN_HIRES_FOR_FAST_VS_SLOW,
  MIN_REQS_FOR_REQ_DECAY,
  MIN_DENOM_FOR_PASS_RATE,
  calculateConfidence,
  ConfidenceLevel,
  detectStageTimingCapability,
  formatRate,
  safeRate
} from '../../../services/velocityThresholds';

interface VelocityInsightsTabProps {
  metrics: VelocityMetrics;
  // Additional props for pipeline health
  requisitions?: Requisition[];
  candidates?: Candidate[];
  events?: Event[];
  users?: User[];
  hmFriction?: HiringManagerFriction[];
  config?: DashboardConfig;
  filters?: MetricFilters;
  onUpdateConfig?: (config: DashboardConfig) => void;
  /** Callback to add insight to action queue */
  onAddToActionQueue?: (action: ActionItem) => void;
  /** AI provider configuration for BYOK copilot */
  aiConfig?: AiProviderConfig | null;
}

// Confidence badge component
function ConfidenceBadge({ level, sampleSize }: { level: ConfidenceLevel; sampleSize: number }) {
  const colors: Record<ConfidenceLevel, { bg: string; text: string }> = {
    HIGH: { bg: 'rgba(16, 185, 129, 0.15)', text: '#10b981' },
    MED: { bg: 'rgba(245, 158, 11, 0.15)', text: '#f59e0b' },
    LOW: { bg: 'rgba(239, 68, 68, 0.15)', text: '#ef4444' },
    INSUFFICIENT: { bg: 'rgba(107, 114, 128, 0.15)', text: '#6b7280' }
  };
  const { bg, text } = colors[level];

  return (
    <span
      className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold uppercase"
      style={{
        background: bg,
        color: text,
        fontSize: '0.6rem',
        fontFamily: "'JetBrains Mono', monospace"
      }}
      title={`Sample size: ${sampleSize}`}
    >
      {level} (n={sampleSize})
    </span>
  );
}

// Chart footer component showing data window and confidence
function ChartFooter({
  dateRange,
  sampleSize,
  sampleLabel,
  threshold,
  context
}: {
  dateRange: { start: Date; end: Date };
  sampleSize: number;
  sampleLabel: string;
  threshold: number;
  context: string;
}) {
  const confidence = calculateConfidence(sampleSize, threshold, context);

  return (
    <div
      className="flex items-center justify-between mt-2 px-2 py-1"
      style={{
        background: 'rgba(0, 0, 0, 0.2)',
        borderRadius: '2px',
        fontSize: '0.65rem',
        color: '#6b7280'
      }}
    >
      <span>
        {format(dateRange.start, 'MMM d, yyyy')} – {format(dateRange.end, 'MMM d, yyyy')}
      </span>
      <span>
        {sampleSize} {sampleLabel}
      </span>
      <ConfidenceBadge level={confidence.level} sampleSize={sampleSize} />
    </div>
  );
}

// Limited data banner component
function LimitedDataBanner({ sections }: { sections: Array<{ name: string; n: number; threshold: number }> }) {
  const limitedSections = sections.filter(s => s.n < s.threshold);
  if (limitedSections.length === 0) return null;

  return (
    <div
      className="p-3 rounded mb-4 flex items-start gap-2"
      style={{
        background: 'rgba(245, 158, 11, 0.1)',
        border: '1px solid rgba(245, 158, 11, 0.3)',
        color: '#f59e0b'
      }}
    >
      <i className="bi bi-exclamation-triangle-fill mt-1"></i>
      <div>
        <div className="font-semibold" style={{ fontSize: '0.85rem' }}>Limited Data Available</div>
        <div style={{ fontSize: '0.75rem', color: '#94A3B8' }}>
          Some sections have insufficient data for reliable analysis:
          {limitedSections.map((s, i) => (
            <span key={s.name}>
              {i > 0 && ', '}
              <strong>{s.name}</strong> (n={s.n}, need {s.threshold})
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// Stage Timing EmptyState component - shows when stage timing data is unavailable
function StageTimingEmptyState({ reason }: { reason: string }) {
  return (
    <div
      className="p-4 text-center"
      style={{
        background: 'linear-gradient(145deg, rgba(39, 39, 42, 0.5), rgba(24, 24, 27, 0.8))',
        borderRadius: '8px',
        border: '1px solid rgba(63, 63, 70, 0.5)'
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          margin: '0 auto 16px',
          background: 'rgba(107, 114, 128, 0.15)',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <i className="bi bi-clock-history" style={{ fontSize: '1.5rem', color: '#6b7280' }}></i>
      </div>
      <h6 style={{ color: '#f5f5f5', fontSize: '0.9rem', fontWeight: 600, marginBottom: '8px' }}>
        Stage timing unavailable
      </h6>
      <p style={{ color: '#94A3B8', fontSize: '0.8rem', marginBottom: '16px', maxWidth: '280px', margin: '0 auto 16px' }}>
        {reason}
      </p>
      <div
        style={{
          background: 'rgba(212, 163, 115, 0.1)',
          border: '1px solid rgba(212, 163, 115, 0.2)',
          borderRadius: '4px',
          padding: '8px 12px',
          display: 'inline-block'
        }}
      >
        <span style={{ color: '#d4a373', fontSize: '0.75rem' }}>
          <i className="bi bi-arrow-up-circle mr-2"></i>
          Import daily snapshots to unlock
        </span>
      </div>
    </div>
  );
}

// Rich Evidence Drawer component - shows contextual, actionable evidence for an insight
function EvidenceDrawer({
  insight,
  metrics,
  isOpen,
  onClose
}: {
  insight: VelocityInsight | null;
  metrics: VelocityMetrics;
  isOpen: boolean;
  onClose: () => void;
}) {
  if (!isOpen || !insight) return null;

  const { candidateDecay, reqDecay, cohortComparison } = metrics;

  // Detect insight type from evidence/citations
  const evidence = insight.evidence?.toLowerCase() || '';
  const title = insight.title?.toLowerCase() || '';

  const isTTFInsight = evidence.includes('ttf') || evidence.includes('median') || title.includes('time-to-fill');
  const isFillRateInsight = evidence.includes('fill_rate') || title.includes('fill rate');
  const isAcceptanceInsight = evidence.includes('accept') || evidence.includes('offer') || title.includes('acceptance');
  const isDecayInsight = evidence.includes('decay') || title.includes('decay');
  const isCohortInsight = evidence.includes('cohort') || title.includes('fast') || title.includes('slow');
  const isZombieInsight = evidence.includes('zombie') || title.includes('zombie');
  const isStalledInsight = evidence.includes('stalled') || title.includes('stalled');

  // Extract the primary metric value from description
  const extractNumber = (text: string): string | null => {
    const match = text.match(/(\d+\.?\d*)\s*(days?|%|d\b)/i);
    return match ? match[1] + (match[2] === '%' ? '%' : 'd') : null;
  };
  const primaryValue = extractNumber(insight.description || '');

  // Determine status color based on insight type
  const getStatusColor = () => {
    if (insight.type === 'warning') return '#f59e0b';
    if (insight.type === 'success') return '#10b981';
    return '#60a5fa';
  };

  return (
    <div
      className="fixed top-0 right-0 h-full flex flex-col"
      style={{
        width: '440px',
        maxWidth: '100vw',
        background: '#1a1a1a',
        borderLeft: '1px solid #3f3f46',
        zIndex: 1050,
        boxShadow: '-4px 0 20px rgba(0,0,0,0.5)'
      }}
      data-testid="evidence-drawer"
    >
      {/* Header */}
      <div
        className="flex items-center justify-between p-3"
        style={{ borderBottom: '1px solid #3f3f46', background: '#141414' }}
      >
        <div className="flex items-center gap-2">
          <span style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: getStatusColor()
          }} />
          <h6 className="mb-0" style={{ color: '#f5f5f5', fontSize: '0.85rem', fontWeight: 600 }}>
            Evidence & Context
          </h6>
        </div>
        <button
          className="px-3 py-1.5 text-sm font-medium rounded"
          onClick={onClose}
          style={{ color: '#94A3B8', padding: '4px 8px' }}
        >
          <i className="bi bi-x-lg"></i>
        </button>
      </div>

      {/* Content */}
      <div className="grow overflow-auto">
        {/* Hero Section - Big Number */}
        <div
          className="p-4 text-center"
          style={{
            background: 'linear-gradient(180deg, rgba(39, 39, 42, 0.8) 0%, rgba(26, 26, 26, 1) 100%)',
            borderBottom: '1px solid #3f3f46'
          }}
        >
          <div style={{ color: '#6b7280', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>
            {insight.title}
          </div>
          {primaryValue ? (
            <div style={{ color: getStatusColor(), fontSize: '2.5rem', fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>
              {primaryValue}
            </div>
          ) : (
            <div style={{ color: '#f5f5f5', fontSize: '1rem', fontWeight: 500 }}>
              {insight.description}
            </div>
          )}
          {primaryValue && (
            <div style={{ color: '#94A3B8', fontSize: '0.75rem', marginTop: '4px' }}>
              {insight.type === 'warning' ? '⚠️ Needs attention' : insight.type === 'success' ? '✓ Performing well' : 'ℹ️ For your awareness'}
            </div>
          )}
        </div>

        <div className="p-3">
          {/* Why This Matters */}
          {insight.soWhat && (
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <i className="bi bi-lightbulb" style={{ color: '#f59e0b', fontSize: '0.85rem' }}></i>
                <span style={{ color: '#f5f5f5', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Why This Matters
                </span>
              </div>
              <div style={{ color: '#d1d5db', fontSize: '0.8rem', lineHeight: 1.6, paddingLeft: '22px' }}>
                {insight.soWhat}
              </div>
            </div>
          )}

          {/* Recommended Action */}
          {insight.nextStep && (
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <i className="bi bi-arrow-right-circle" style={{ color: '#10b981', fontSize: '0.85rem' }}></i>
                <span style={{ color: '#f5f5f5', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Recommended Action
                </span>
              </div>
              <div
                className="p-2 rounded"
                style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', paddingLeft: '22px' }}
              >
                <span style={{ color: '#10b981', fontSize: '0.8rem' }}>{insight.nextStep}</span>
              </div>
            </div>
          )}

          {/* TTF Insight - Show Req Decay Breakdown */}
          {(isTTFInsight || isFillRateInsight) && reqDecay.dataPoints.length > 0 && (
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <i className="bi bi-bar-chart" style={{ color: '#60a5fa', fontSize: '0.85rem' }}></i>
                <span style={{ color: '#f5f5f5', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Fill Rate by Days Open
                </span>
              </div>
              <div className="flex flex-col gap-1">
                {reqDecay.dataPoints.slice(0, 6).map((dp, idx) => {
                  const fillPct = Math.round(dp.rate * 100);
                  const barColor = fillPct >= 60 ? '#10b981' : fillPct >= 40 ? '#f59e0b' : '#ef4444';
                  return (
                    <div key={idx} className="flex items-center gap-2">
                      <div style={{ width: '80px', fontSize: '0.7rem', color: '#94A3B8', textAlign: 'right' }}>
                        {dp.bucket}
                      </div>
                      <div style={{ flex: 1, height: '16px', background: '#27272a', borderRadius: '2px', overflow: 'hidden' }}>
                        <div style={{ width: `${fillPct}%`, height: '100%', background: barColor, transition: 'width 0.3s' }} />
                      </div>
                      <div style={{ width: '50px', fontSize: '0.7rem', color: '#f5f5f5', fontFamily: "'JetBrains Mono', monospace" }}>
                        {fillPct}%
                      </div>
                      <div style={{ width: '30px', fontSize: '0.65rem', color: '#6b7280' }}>
                        n={dp.count}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div style={{ fontSize: '0.65rem', color: '#6b7280', marginTop: '8px', fontStyle: 'italic' }}>
                Fill rate drops as reqs stay open longer. Target: close within 45 days.
              </div>
            </div>
          )}

          {/* Acceptance Rate Insight - Show Candidate Decay */}
          {(isAcceptanceInsight || isDecayInsight) && candidateDecay.dataPoints.length > 0 && (
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <i className="bi bi-graph-down" style={{ color: '#f59e0b', fontSize: '0.85rem' }}></i>
                <span style={{ color: '#f5f5f5', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Acceptance Rate by Time in Process
                </span>
              </div>
              <div className="flex flex-col gap-1">
                {candidateDecay.dataPoints.slice(0, 6).map((dp, idx) => {
                  const acceptPct = Math.round(dp.rate * 100);
                  const barColor = acceptPct >= 80 ? '#10b981' : acceptPct >= 60 ? '#f59e0b' : '#ef4444';
                  const isDecayPoint = candidateDecay.decayStartDay && dp.minDays >= candidateDecay.decayStartDay;
                  return (
                    <div key={idx} className="flex items-center gap-2">
                      <div style={{ width: '80px', fontSize: '0.7rem', color: isDecayPoint ? '#f59e0b' : '#94A3B8', textAlign: 'right' }}>
                        {dp.bucket} {isDecayPoint && '⚠️'}
                      </div>
                      <div style={{ flex: 1, height: '16px', background: '#27272a', borderRadius: '2px', overflow: 'hidden' }}>
                        <div style={{ width: `${acceptPct}%`, height: '100%', background: barColor, transition: 'width 0.3s' }} />
                      </div>
                      <div style={{ width: '50px', fontSize: '0.7rem', color: '#f5f5f5', fontFamily: "'JetBrains Mono', monospace" }}>
                        {acceptPct}%
                      </div>
                      <div style={{ width: '30px', fontSize: '0.65rem', color: '#6b7280' }}>
                        n={dp.count}
                      </div>
                    </div>
                  );
                })}
              </div>
              {candidateDecay.decayStartDay && (
                <div
                  className="p-2 mt-2 rounded"
                  style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.2)' }}
                >
                  <span style={{ color: '#f59e0b', fontSize: '0.75rem' }}>
                    ⚠️ Decay begins after day {candidateDecay.decayStartDay}. Aim to extend offers before this point.
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Cohort Comparison Insight */}
          {isCohortInsight && cohortComparison && (
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <i className="bi bi-people" style={{ color: '#8b5cf6', fontSize: '0.85rem' }}></i>
                <span style={{ color: '#f5f5f5', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Fast vs Slow Hire Comparison
                </span>
              </div>
              <div className="flex gap-2 mb-2">
                <div className="grow p-2 rounded text-center" style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                  <div style={{ color: '#10b981', fontSize: '1.25rem', fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>
                    {Math.round(cohortComparison.fastHires.avgTimeToFill)}d
                  </div>
                  <div style={{ color: '#6b7280', fontSize: '0.65rem' }}>Fast Hires (n={cohortComparison.fastHires.count})</div>
                </div>
                <div className="grow p-2 rounded text-center" style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                  <div style={{ color: '#ef4444', fontSize: '1.25rem', fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>
                    {Math.round(cohortComparison.slowHires.avgTimeToFill)}d
                  </div>
                  <div style={{ color: '#6b7280', fontSize: '0.65rem' }}>Slow Hires (n={cohortComparison.slowHires.count})</div>
                </div>
              </div>
              {cohortComparison.factors.slice(0, 4).map((factor, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 rounded mb-1" style={{ background: '#27272a' }}>
                  <span style={{ color: '#94A3B8', fontSize: '0.75rem' }}>{factor.factor}</span>
                  <div className="flex items-center gap-3">
                    <span style={{ color: '#10b981', fontSize: '0.75rem', fontFamily: "'JetBrains Mono', monospace" }}>
                      {factor.fastHiresValue} {factor.unit}
                    </span>
                    <span style={{ color: '#6b7280', fontSize: '0.7rem' }}>vs</span>
                    <span style={{ color: '#ef4444', fontSize: '0.75rem', fontFamily: "'JetBrains Mono', monospace" }}>
                      {factor.slowHiresValue} {factor.unit}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Contributing Items (if any) */}
          {insight.contributingItems && insight.contributingItems.length > 0 && (
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <i className="bi bi-list-check" style={{ color: '#60a5fa', fontSize: '0.85rem' }}></i>
                <span style={{ color: '#f5f5f5', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Contributing Items ({insight.contributingItems.length})
                </span>
              </div>
              <div className="flex flex-col gap-1">
                {insight.contributingItems.slice(0, 8).map((item, idx) => (
                  <div
                    key={item.id}
                    className="p-2 rounded flex justify-between items-center"
                    style={{ background: '#27272a', fontSize: '0.75rem' }}
                  >
                    <div className="flex items-center gap-2">
                      <span style={{ color: '#6b7280', width: '16px' }}>{idx + 1}.</span>
                      <span style={{ color: '#f5f5f5' }}>{item.title || item.id}</span>
                    </div>
                    {item.value !== undefined && (
                      <span style={{ color: '#94A3B8', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.7rem' }}>
                        {item.value}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Data Source */}
          <div className="mt-4 pt-3" style={{ borderTop: '1px solid #27272a' }}>
            <div className="flex items-center justify-between">
              <span style={{ color: '#6b7280', fontSize: '0.65rem' }}>
                Based on {insight.sampleSize ?? reqDecay.totalReqs} records
              </span>
              <span style={{
                background: insight.confidence === 'HIGH' ? 'rgba(16, 185, 129, 0.15)' :
                  insight.confidence === 'MED' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(107, 114, 128, 0.15)',
                color: insight.confidence === 'HIGH' ? '#10b981' :
                  insight.confidence === 'MED' ? '#f59e0b' : '#6b7280',
                padding: '2px 8px',
                borderRadius: '2px',
                fontSize: '0.6rem',
                fontWeight: 600,
                textTransform: 'uppercase'
              }}>
                {insight.confidence || 'MED'} confidence
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Backdrop for drawer
function DrawerBackdrop({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  if (!isOpen) return null;
  return (
    <div
      className="fixed top-0 left-0 w-full h-full"
      style={{ background: 'rgba(0,0,0,0.5)', zIndex: 1040 }}
      onClick={onClose}
    />
  );
}

// Color scale for decay visualization - Modern Tailwind
function getDecayColor(rate: number): string {
  if (rate >= 0.8) return '#10B981'; // Emerald-500
  if (rate >= 0.6) return '#22C55E'; // Green-500
  if (rate >= 0.4) return '#F59E0B'; // Amber-500
  if (rate >= 0.2) return '#F97316'; // Orange-500
  return '#EF4444'; // Red-500
}

// Section Header component - consistent styling across sections
function SectionHeader({ icon, title, subtitle, rightContent }: {
  icon: string;
  title: string;
  subtitle?: string;
  rightContent?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <span style={{
          width: 28,
          height: 28,
          background: 'rgba(212, 163, 115, 0.15)',
          borderRadius: '4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '0.9rem'
        }}>{icon}</span>
        <div>
          <h6 className="mb-0" style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f5f5f5' }}>{title}</h6>
          {subtitle && <small style={{ color: '#6b7280', fontSize: '0.7rem' }}>{subtitle}</small>}
        </div>
      </div>
      {rightContent}
    </div>
  );
}

// Collapsible Chart Help component - replaces long "Reading this chart" paragraphs
function ChartHelp({ text }: { text: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="mt-2">
      <button
        className="flex items-center gap-1 bg-transparent border-0 text-muted-foreground px-1 py-0.5 text-xs"
        onClick={() => setIsOpen(!isOpen)}
      >
        <i className={`bi ${isOpen ? 'bi-info-circle-fill' : 'bi-info-circle'}`}></i>
        {isOpen ? 'Hide help' : 'How to read'}
      </button>
      {isOpen && (
        <div
          className="mt-1 p-2 rounded"
          style={{ background: '#141414', fontSize: '0.75rem', color: '#94A3B8', lineHeight: 1.4 }}
        >
          {text}
        </div>
      )}
    </div>
  );
}

// Data chip component - consistent n= and confidence display
function DataChip({ n, confidence, label }: { n: number; confidence?: ConfidenceLevel; label?: string }) {
  const confColors: Record<ConfidenceLevel, string> = {
    HIGH: '#10b981',
    MED: '#f59e0b',
    LOW: '#ef4444',
    INSUFFICIENT: '#6b7280'
  };

  return (
    <div className="flex items-center gap-2">
      <span style={{
        background: 'rgba(96, 165, 250, 0.1)',
        color: '#60a5fa',
        padding: '2px 6px',
        fontSize: '0.6rem',
        fontFamily: "'JetBrains Mono', monospace",
        borderRadius: '2px'
      }}>
        n={n}{label ? ` ${label}` : ''}
      </span>
      {confidence && (
        <span style={{
          background: `${confColors[confidence]}20`,
          color: confColors[confidence],
          padding: '2px 6px',
          fontSize: '0.55rem',
          fontWeight: 600,
          fontFamily: "'JetBrains Mono', monospace",
          borderRadius: '2px',
          textTransform: 'uppercase'
        }}>
          {confidence}
        </span>
      )}
    </div>
  );
}

// Compact Insight Card - 2-column grid design
function CompactInsightCard({
  insight,
  onCreateAction,
  onViewEvidence,
  isActionCreated
}: {
  insight: VelocityInsight;
  onCreateAction?: (insight: VelocityInsight) => void;
  onViewEvidence?: (insight: VelocityInsight) => void;
  isActionCreated?: boolean;
}) {
  // Icon and color based on type
  const iconConfig = {
    warning: { icon: 'bi-exclamation-triangle-fill', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)' },
    success: { icon: 'bi-check-circle-fill', color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)' },
    info: { icon: 'bi-info-circle-fill', color: '#60a5fa', bg: 'rgba(96, 165, 250, 0.15)' }
  };
  const { icon, color, bg } = iconConfig[insight.type] || iconConfig.info;

  // Confidence colors
  const confColors: Record<string, string> = {
    HIGH: '#10b981', MED: '#f59e0b', LOW: '#ef4444', INSUFFICIENT: '#6b7280'
  };

  return (
    <div
      className="p-3"
      style={{
        background: '#141414',
        borderRadius: '4px',
        borderLeft: `3px solid ${color}`
      }}
    >
      {/* Row 1: Icon + Title | Metric chips */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2" style={{ flex: '1 1 auto', minWidth: 0 }}>
          <i className={`bi ${icon}`} style={{ color, fontSize: '0.85rem', flexShrink: 0 }}></i>
          <span className="font-semibold truncate" style={{ color: '#f5f5f5', fontSize: '0.8rem' }}>
            {insight.title}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {insight.sampleSize !== undefined && (
            <span style={{
              background: 'rgba(96, 165, 250, 0.1)',
              color: '#60a5fa',
              padding: '1px 5px',
              fontSize: '0.55rem',
              fontFamily: "'JetBrains Mono', monospace",
              borderRadius: '2px'
            }}>
              n={insight.sampleSize}
            </span>
          )}
          {insight.confidence && (
            <span style={{
              background: `${confColors[insight.confidence]}20`,
              color: confColors[insight.confidence],
              padding: '1px 5px',
              fontSize: '0.5rem',
              fontWeight: 600,
              fontFamily: "'JetBrains Mono', monospace",
              borderRadius: '2px',
              textTransform: 'uppercase'
            }}>
              {insight.confidence}
            </span>
          )}
        </div>
      </div>

      {/* Row 2: One-line claim */}
      <div
        className="mb-2"
        style={{
          color: '#94A3B8',
          fontSize: '0.75rem',
          lineHeight: 1.4,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical'
        }}
      >
        {insight.description}
      </div>

      {/* Row 3: Action buttons */}
      <div className="flex items-center gap-2 flex-wrap">
        {onViewEvidence && (
          <button
            className="px-1.5 py-0.5 rounded bg-bg-glass border border-glass-border hover:bg-white/10"
            onClick={() => onViewEvidence(insight)}
            style={{
              background: 'rgba(96, 165, 250, 0.1)',
              borderColor: 'rgba(96, 165, 250, 0.2)',
              color: '#60a5fa',
              fontSize: '0.6rem'
            }}
            data-testid="view-evidence-btn"
          >
            <i className="bi bi-eye mr-1"></i>Evidence
          </button>
        )}
        {onCreateAction && insight.action && (
          <button
            className="px-1.5 py-0.5 rounded"
            onClick={() => onCreateAction(insight)}
            disabled={isActionCreated}
            style={{
              background: isActionCreated ? 'rgba(107, 114, 128, 0.1)' : 'rgba(212, 163, 115, 0.1)',
              border: `1px solid ${isActionCreated ? 'rgba(107, 114, 128, 0.2)' : 'rgba(212, 163, 115, 0.2)'}`,
              color: isActionCreated ? '#6b7280' : '#d4a373',
              fontSize: '0.6rem',
              opacity: isActionCreated ? 0.7 : 1
            }}
            data-testid="create-action-btn"
          >
            <i className={`bi ${isActionCreated ? 'bi-check' : 'bi-plus-circle'} mr-1`}></i>
            {isActionCreated ? 'Added' : 'Action'}
          </button>
        )}
        {insight.metric && (
          <span style={{
            background: '#27272a',
            color: '#6b7280',
            padding: '1px 5px',
            fontSize: '0.55rem',
            fontFamily: "'JetBrains Mono', monospace",
            borderRadius: '2px'
          }}>
            {insight.metric}
          </span>
        )}
      </div>
    </div>
  );
}

export function VelocityInsightsTab({
  metrics,
  requisitions,
  candidates,
  events,
  users,
  hmFriction,
  config,
  filters,
  onUpdateConfig,
  onAddToActionQueue,
  aiConfig
}: VelocityInsightsTabProps) {
  const isMobile = useIsMobile();
  const chartHeight = isMobile ? 250 : 320;

  const { candidateDecay, reqDecay, insights, cohortComparison } = metrics;

  // Evidence drawer state
  const [evidenceDrawerOpen, setEvidenceDrawerOpen] = useState(false);
  const [selectedInsight, setSelectedInsight] = useState<VelocityInsight | null>(null);

  // Track created action IDs to prevent duplicates (dedupe)
  const [createdActionIds, setCreatedActionIds] = useState<Set<string>>(new Set());

  // Date range for chart footers
  const dateRange = useMemo(() => ({
    start: filters?.dateRange?.startDate ?? new Date(),
    end: filters?.dateRange?.endDate ?? new Date()
  }), [filters?.dateRange]);

  // Stage timing capability detection
  const stageTimingCapability = useMemo(() => {
    if (!events || !candidates) {
      return { capability: 'NONE' as const, canShowStageDuration: false, reason: 'No event or candidate data available' };
    }
    return detectStageTimingCapability(
      events.map(e => ({ event_type: e.event_type, from_stage: e.from_stage, to_stage: e.to_stage, event_at: e.event_at })),
      candidates.map(c => ({ current_stage_entered_at: c.current_stage_entered_at }))
    );
  }, [events, candidates]);

  // Data sufficiency checks
  const limitedDataSections = useMemo(() => [
    { name: 'Offer Decay', n: candidateDecay.totalOffers, threshold: MIN_OFFERS_FOR_DECAY },
    { name: 'Req Decay', n: reqDecay.totalReqs, threshold: MIN_REQS_FOR_REQ_DECAY },
    { name: 'Cohort Analysis', n: cohortComparison?.fastHires?.count ?? 0, threshold: MIN_HIRES_FOR_FAST_VS_SLOW }
  ], [candidateDecay.totalOffers, reqDecay.totalReqs, cohortComparison]);

  // Generate stable action ID for dedupe (based on insight title, not timestamp)
  const generateActionId = useCallback((insight: VelocityInsight): string => {
    const sanitizedTitle = insight.title.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    return `velocity_insight_${sanitizedTitle}`;
  }, []);

  // Create action from insight with dedupe check
  const handleCreateAction = useCallback((insight: VelocityInsight) => {
    if (!onAddToActionQueue || !insight.action) return;

    const actionId = generateActionId(insight);

    // Check for duplicate - if already created, don't create again
    if (createdActionIds.has(actionId)) {
      console.log(`[VelocityInsights] Action already created: ${actionId}`);
      return;
    }

    // Determine priority: P0 if warning AND sample size meets threshold, else P1 for warning, P2 otherwise
    const hasStrongEvidence = (insight.sampleSize ?? 0) >= MIN_DENOM_FOR_PASS_RATE;
    const priority = insight.type === 'warning' && hasStrongEvidence ? 'P0' as const :
      insight.type === 'warning' ? 'P1' as const : 'P2' as const;

    const actionItem: ActionItem = {
      action_id: actionId,
      action_type: 'PROCESS_OPTIMIZATION',
      owner_type: 'TA_OPS',
      owner_id: 'velocity_insights',
      owner_name: 'Velocity Insights',
      req_id: 'N/A',
      title: insight.title,
      priority,
      due_in_days: priority === 'P0' ? 3 : priority === 'P1' ? 7 : 14,
      due_date: new Date(Date.now() + (priority === 'P0' ? 3 : priority === 'P1' ? 7 : 14) * 24 * 60 * 60 * 1000),
      created_at: new Date(),
      status: 'OPEN',
      evidence: {
        kpi_key: 'velocity_insight',
        explain_provider_key: 'velocity_analysis',
        short_reason: insight.evidence || insight.metric || insight.description
      },
      recommended_steps: insight.nextStep ? [insight.nextStep] : insight.action ? [insight.action] : []
    };

    onAddToActionQueue(actionItem);

    // Mark as created to prevent duplicates
    setCreatedActionIds(prev => new Set(prev).add(actionId));
  }, [onAddToActionQueue, generateActionId, createdActionIds]);

  // Open evidence drawer
  const handleViewEvidence = useCallback((insight: VelocityInsight) => {
    setSelectedInsight(insight);
    setEvidenceDrawerOpen(true);
  }, []);

  // Close evidence drawer
  const handleCloseEvidence = useCallback(() => {
    setEvidenceDrawerOpen(false);
    setSelectedInsight(null);
  }, []);

  // Pipeline Health state
  const [showBenchmarkConfig, setShowBenchmarkConfig] = useState(false);
  const [historicalBenchmarks, setHistoricalBenchmarks] = useState<HistoricalBenchmarkResult | null>(null);
  const [isLoadingHistorical, setIsLoadingHistorical] = useState(false);

  // Calculate pipeline health if we have the required data
  const pipelineHealth = useMemo(() => {
    if (!requisitions?.length || !candidates?.length || !events || !users || !hmFriction || !config || !filters) {
      return null;
    }
    return calculatePipelineHealth(requisitions, candidates, events, users, hmFriction, config, filters);
  }, [requisitions, candidates, events, users, hmFriction, config, filters]);

  // Compute simulator context values
  const simulatorContext = useMemo(() => {
    // HM latency - median from hmFriction
    const hmLatencyHours = hmFriction?.length
      ? hmFriction.reduce((sum, hm) => sum + (hm.feedbackLatencyMedian || 0), 0) / hmFriction.length
      : null;

    // Pipeline depth - average active candidates per open req
    const openReqs = requisitions?.filter(r => r.status === 'Open') || [];
    const openReqCount = openReqs.length;
    const activeCandidates = candidates?.filter(c =>
      c.disposition === 'Active' && openReqs.some(r => r.req_id === c.req_id)
    ) || [];
    const pipelineDepth = openReqCount > 0 ? activeCandidates.length / openReqCount : null;

    // Time to offer - median days to decision from candidateDecay
    const timeToOfferDays = candidateDecay.medianDaysToDecision;

    // Expected hires - estimate based on pipeline depth and realistic conversion
    // Active candidates are mid-funnel, so use higher conversion rate than top-of-funnel
    // Typical mid-funnel to hire: 15-30% for active candidates
    // Use offer stage pass rate if available, otherwise default to 25%
    const offerStageRate = pipelineHealth?.stagePerformance?.find(
      sp => sp.stage === CanonicalStage.OFFER
    )?.actualPassRate;

    // Active candidates are typically mid-funnel, not top-of-funnel
    // Use ~25% baseline but adjust if we have offer stage data
    const avgMidFunnelConversion = offerStageRate ? Math.min(0.35, offerStageRate * 0.4) : 0.25;

    // Expected hires = active candidates * realistic conversion rate
    // Cap per req to avoid unrealistic numbers
    const rawExpectedHires = activeCandidates.length * avgMidFunnelConversion;
    const expectedHires = openReqCount > 0
      ? Math.round(Math.min(rawExpectedHires, openReqCount * 1.5) * 10) / 10
      : null;

    // Pipeline gap - difference between open reqs and expected hires
    // Positive gap means we need more pipeline
    const pipelineGap = expectedHires !== null && openReqCount > 0
      ? Math.round(Math.max(0, openReqCount - expectedHires) * 10) / 10
      : null;

    // Stage conversion rates - from pipeline health or defaults
    const stageConversionRates = pipelineHealth?.stagePerformance?.reduce((acc, sp) => {
      acc[sp.stage] = sp.actualPassRate;
      return acc;
    }, {} as Record<string, number>) || {};

    return {
      hmLatencyHours,
      pipelineDepth,
      timeToOfferDays,
      expectedHires,
      pipelineGap,
      openReqsCount: openReqCount,
      stageConversionRates,
    };
  }, [requisitions, candidates, hmFriction, candidateDecay, pipelineHealth]);

  // Load historical benchmarks
  const handleLoadHistorical = () => {
    if (!requisitions || !candidates || !events || !config) return;
    setIsLoadingHistorical(true);
    setTimeout(() => {
      const result = generateHistoricalBenchmarks(requisitions, candidates, events, config);
      setHistoricalBenchmarks(result);
      setIsLoadingHistorical(false);
    }, 100);
  };

  // Save benchmark config
  const handleSaveBenchmarks = (newConfig: PipelineBenchmarkConfig) => {
    if (config && onUpdateConfig) {
      onUpdateConfig({
        ...config,
        pipelineBenchmarks: newConfig
      });
    }
  };

  // Format candidate decay data for chart
  const candidateChartData = candidateDecay.dataPoints
    .filter(dp => dp.count > 0)
    .map(dp => ({
      name: dp.bucket,
      rate: Math.round(dp.rate * 100),
      count: dp.count,
      minDays: dp.minDays
    }));

  // Format req decay data for chart
  const reqChartData = reqDecay.dataPoints
    .filter(dp => dp.count > 0)
    .map(dp => ({
      name: dp.bucket,
      rate: Math.round(dp.rate * 100),
      count: dp.count,
      minDays: dp.minDays
    }));

  // Calculate confidence levels
  const offerConfidence = calculateConfidence(candidateDecay.totalOffers, MIN_OFFERS_FOR_DECAY, 'offers');
  const reqConfidence = calculateConfidence(reqDecay.totalReqs, MIN_REQS_FOR_REQ_DECAY, 'reqs');
  const cohortConfidence = calculateConfidence(
    (metrics.cohortComparison?.fastHires?.count ?? 0) + (metrics.cohortComparison?.slowHires?.count ?? 0),
    MIN_HIRES_FOR_FAST_VS_SLOW * 2,
    'hires'
  );

  return (
    <div>
      {/* Page Header */}
      <SubViewHeader
        title="Pipeline Velocity"
        subtitle="Analyze pipeline timing, decay patterns, and success factors"
        helpContent={VELOCITY_PAGE_HELP}
      />

      {/* AI Copilot Panel - shown at top */}
      {requisitions && candidates && events && filters && (
        <VelocityCopilotPanel
          metrics={metrics}
          requisitions={requisitions}
          candidates={candidates}
          events={events}
          filters={filters}
          aiConfig={aiConfig}
          onAddToActionQueue={onAddToActionQueue}
          onViewEvidence={handleViewEvidence}
        />
      )}

      {/* Limited Data Banner - compact */}
      <LimitedDataBanner sections={limitedDataSections} />

      {/* ===== SECTION 1: KPIs ===== */}
      <SectionHeader icon="📊" title="Key Metrics" subtitle="Velocity performance indicators" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
        <div className="glass-panel p-3 h-full text-center">
          <div className="stat-label mb-1">Median TTF</div>
          <div className="font-mono font-bold" style={{ fontSize: '1.5rem', color: 'var(--color-accent)' }}>
            {reqDecay.totalFilled >= MIN_DENOM_FOR_PASS_RATE && reqDecay.medianDaysToFill !== null
              ? `${reqDecay.medianDaysToFill}d`
              : '—'}
          </div>
          <DataChip n={reqDecay.totalFilled} confidence={reqConfidence.level} label="closed" />
        </div>
        <div className="glass-panel p-3 h-full text-center">
          <div className="stat-label mb-1">Accept Rate</div>
          <div className="font-mono font-bold" style={{ fontSize: '1.5rem', color: '#10b981' }}>
            {candidateDecay.totalOffers >= MIN_DENOM_FOR_PASS_RATE
              ? `${Math.round(candidateDecay.overallAcceptanceRate * 100)}%`
              : '—'}
          </div>
          <DataChip
            n={candidateDecay.totalOffers > 0 ? candidateDecay.totalAccepted : 0}
            confidence={offerConfidence.level}
            label={candidateDecay.totalOffers > 0 ? `/${candidateDecay.totalOffers}` : ''}
          />
        </div>
        <div className="glass-panel p-3 h-full text-center">
          <div className="stat-label mb-1">Fill Rate</div>
          <div className="font-mono font-bold" style={{ fontSize: '1.5rem', color: '#6366f1' }}>
            {reqDecay.totalReqs >= MIN_DENOM_FOR_PASS_RATE
              ? `${Math.round(reqDecay.overallFillRate * 100)}%`
              : '—'}
          </div>
          <DataChip
            n={reqDecay.totalReqs > 0 ? reqDecay.totalFilled : 0}
            confidence={reqConfidence.level}
            label={reqDecay.totalReqs > 0 ? `/${reqDecay.totalReqs}` : ''}
          />
        </div>
        <div className="glass-panel p-3 h-full text-center">
          <div className="stat-label mb-1">Decay Start</div>
          <div className="font-mono font-bold" style={{ fontSize: '1.5rem', color: '#eab308' }}>
            {candidateDecay.totalOffers >= MIN_OFFERS_FOR_DECAY && candidateDecay.decayStartDay !== null
              ? `Day ${candidateDecay.decayStartDay}`
              : '—'}
          </div>
          <DataChip n={candidateDecay.totalOffers} confidence={offerConfidence.level} label="offers" />
        </div>
      </div>

      {/* ===== SECTION 2: Pipeline Health ===== */}
      {(pipelineHealth || config) && (
        <div className="mb-3">
          <SectionHeader icon="🔬" title="Pipeline Health" subtitle="Stage-by-stage performance vs benchmarks" />
          <PipelineHealthCard
            healthSummary={pipelineHealth}
            compact={false}
            onConfigureClick={() => setShowBenchmarkConfig(true)}
          />
        </div>
      )}

      {/* Benchmark Config Modal */}
      {config && (
        <BenchmarkConfigModal
          isOpen={showBenchmarkConfig}
          onClose={() => setShowBenchmarkConfig(false)}
          currentConfig={config.pipelineBenchmarks}
          historicalBenchmarks={historicalBenchmarks}
          onSave={handleSaveBenchmarks}
          onLoadHistorical={handleLoadHistorical}
          isLoadingHistorical={isLoadingHistorical}
        />
      )}

      {/* ===== SECTION 3: Stage Timing (if available) ===== */}
      {stageTimingCapability.capability !== 'NONE' && stageTimingCapability.canShowStageDuration && (
        <div className="mb-3">
          <SectionHeader icon="⏱️" title="Stage Timing" subtitle="Time spent in each stage" />
          {/* Stage timing visualization would go here */}
        </div>
      )}

      {/* ===== SECTION 4: Decay Curves ===== */}
      <SectionHeader icon="📉" title="Decay Analysis" subtitle="How time affects outcomes" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-3">
        {/* Candidate Decay Curve */}
        <div>
          <div className="glass-panel p-3 h-full">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h6 className="mb-0" style={{ fontSize: '0.8rem', color: '#f5f5f5' }}>Candidate Decay</h6>
                <small style={{ color: '#6b7280', fontSize: '0.65rem' }}>Acceptance by time in process</small>
              </div>
              <DataChip n={candidateDecay.totalOffers} confidence={offerConfidence.level} />
            </div>
            {candidateChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={candidateChartData} margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
                  <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#6b7280' }} stroke="#3f3f46" angle={-20} textAnchor="end" height={50} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: '#6b7280' }} stroke="#3f3f46" tickFormatter={(v) => `${v}%`} />
                  <Tooltip content={({ active, payload }) => {
                    if (!active || !payload?.[0]) return null;
                    const d = payload[0].payload;
                    return (
                      <div style={{ background: '#0a0a0a', border: '1px solid #3f3f46', borderRadius: '4px', padding: '6px 10px', fontSize: '0.75rem' }}>
                        <div style={{ color: '#f5f5f5', fontWeight: 600 }}>{d.name}</div>
                        <div style={{ color: getDecayColor(d.rate / 100) }}>{d.rate}% accept</div>
                        <div style={{ color: '#6b7280' }}>{d.count} offers</div>
                      </div>
                    );
                  }} />
                  {candidateDecay.decayStartDay && (
                    <ReferenceLine x={candidateChartData.find(d => d.minDays >= candidateDecay.decayStartDay!)?.name} stroke="#dc2626" strokeDasharray="5 5" />
                  )}
                  <Bar dataKey="rate" radius={[2, 2, 0, 0]}>
                    {candidateChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={getDecayColor(entry.rate / 100)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center py-4" style={{ color: '#6b7280', fontSize: '0.8rem' }}>
                Not enough offer data
              </div>
            )}
            <ChartHelp text="Each bar shows offer acceptance rate by days in process. Declining bars = candidate interest decay. Aim to extend offers before the decay starts." />
          </div>
        </div>

        {/* Req Decay Curve */}
        <div>
          <div className="glass-panel p-3 h-full">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h6 className="mb-0" style={{ fontSize: '0.8rem', color: '#f5f5f5' }}>Requisition Decay</h6>
                <small style={{ color: '#6b7280', fontSize: '0.65rem' }}>Fill probability by days open</small>
              </div>
              <DataChip n={reqDecay.totalReqs} confidence={reqConfidence.level} />
            </div>
            {reqChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={reqChartData} margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
                  <defs>
                    <linearGradient id="fillGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2dd4bf" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#2dd4bf" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
                  <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#6b7280' }} stroke="#3f3f46" angle={-20} textAnchor="end" height={50} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: '#6b7280' }} stroke="#3f3f46" tickFormatter={(v) => `${v}%`} />
                  <Tooltip content={({ active, payload }) => {
                    if (!active || !payload?.[0]) return null;
                    const d = payload[0].payload;
                    return (
                      <div style={{ background: '#0a0a0a', border: '1px solid #3f3f46', borderRadius: '4px', padding: '6px 10px', fontSize: '0.75rem' }}>
                        <div style={{ color: '#f5f5f5', fontWeight: 600 }}>{d.name}</div>
                        <div style={{ color: '#2dd4bf' }}>{d.rate}% fill rate</div>
                        <div style={{ color: '#6b7280' }}>{d.count} reqs</div>
                      </div>
                    );
                  }} />
                  <ReferenceLine y={Math.round(reqDecay.overallFillRate * 100)} stroke="#6b7280" strokeDasharray="3 3" />
                  <Area type="monotone" dataKey="rate" stroke="#2dd4bf" strokeWidth={2} fill="url(#fillGradient)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center py-4" style={{ color: '#6b7280', fontSize: '0.8rem' }}>
                Not enough req data
              </div>
            )}
            <ChartHelp text="Shows fill rate by days open. Declining curve = longer-open reqs are harder to fill. Consider interventions for stale reqs." />
          </div>
        </div>
      </div>

      {/* ===== SECTION 5: Fast vs Slow Cohort Comparison ===== */}
      {metrics.cohortComparison && (metrics.cohortComparison.fastHires.count > 0 || metrics.cohortComparison.slowHires.count > 0) && (
        <div className="mb-3">
          <SectionHeader
            icon="🏆"
            title="Fast vs Slow Hires"
            subtitle={`Top 25% (${metrics.cohortComparison.fastHires.count}) vs bottom 25% (${metrics.cohortComparison.slowHires.count})`}
            rightContent={<DataChip n={metrics.cohortComparison.fastHires.count + metrics.cohortComparison.slowHires.count} confidence={cohortConfidence.level} />}
          />
          <div className="glass-panel p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm mb-0" style={{ fontSize: '0.75rem' }}>
                <thead>
                  <tr style={{ background: '#1a1a1a' }}>
                    <th style={{ padding: '0.5rem 0.75rem', color: '#6b7280', fontWeight: 500 }}>Factor</th>
                    <th className="text-center" style={{ padding: '0.5rem', color: '#10b981', fontWeight: 500 }}>Fast ({Math.round(metrics.cohortComparison.fastHires.avgTimeToFill)}d)</th>
                    <th className="text-center" style={{ padding: '0.5rem', color: '#ef4444', fontWeight: 500 }}>Slow ({Math.round(metrics.cohortComparison.slowHires.avgTimeToFill)}d)</th>
                    <th className="text-center" style={{ padding: '0.5rem', color: '#6b7280', fontWeight: 500 }}>Impact</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.cohortComparison.factors.slice(0, 5).map((factor, idx) => (
                    <tr key={idx} style={{ borderColor: '#27272a' }}>
                      <td style={{ padding: '0.5rem 0.75rem', color: '#f5f5f5' }}>{factor.factor}</td>
                      <td className="text-center" style={{ padding: '0.5rem', color: '#10b981' }}>{factor.fastHiresValue} {factor.unit}</td>
                      <td className="text-center" style={{ padding: '0.5rem', color: '#ef4444' }}>{factor.slowHiresValue} {factor.unit}</td>
                      <td className="text-center" style={{ padding: '0.5rem' }}>
                        <span style={{
                          background: factor.impactLevel === 'high' ? 'rgba(239, 68, 68, 0.15)' : factor.impactLevel === 'medium' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(107, 114, 128, 0.15)',
                          color: factor.impactLevel === 'high' ? '#ef4444' : factor.impactLevel === 'medium' ? '#f59e0b' : '#6b7280',
                          padding: '1px 5px',
                          fontSize: '0.6rem',
                          borderRadius: '2px'
                        }}>
                          {factor.impactLevel}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===== SECTION 6: Key Insights (2-column grid) ===== */}
      {insights.length > 0 && (
        <div className="mb-3">
          <SectionHeader
            icon="💡"
            title="Key Insights"
            subtitle={`${insights.length} findings from velocity analysis`}
            rightContent={
              <span style={{ color: '#6b7280', fontSize: '0.65rem' }}>
                {insights.filter(i => i.type === 'warning').length} warnings
              </span>
            }
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {insights.map((insight, idx) => (
              <div key={idx}>
                <CompactInsightCard
                  insight={insight}
                  onCreateAction={onAddToActionQueue ? handleCreateAction : undefined}
                  onViewEvidence={handleViewEvidence}
                  isActionCreated={createdActionIds.has(generateActionId(insight))}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===== SECTION 7: What-if Simulator CTA ===== */}
      {/* Per DECK_UI_UX_REFACTOR_V1.md: Removed duplicate WhatIfSimulatorPanel */}
      {/* Canonical home for What-if scenarios is the Scenario Library */}
      <div className="glass-panel p-4 text-center mb-3">
        <div className="empty-state-icon mb-2">🔮</div>
        <div className="section-header-title mb-2">What-if Analysis</div>
        <p className="text-muted-foreground mb-3" style={{ fontSize: 'var(--text-sm)' }}>
          Run hiring scenarios to understand potential outcomes.
        </p>
        <a
          href="/plan/scenarios"
          className="btn-cta-link"
          style={{ display: 'inline-flex' }}
        >
          Open Scenario Library <i className="bi bi-arrow-right ml-1"></i>
        </a>
      </div>

      {/* Evidence Drawer and Backdrop */}
      <DrawerBackdrop isOpen={evidenceDrawerOpen} onClose={handleCloseEvidence} />
      <EvidenceDrawer
        insight={selectedInsight}
        metrics={metrics}
        isOpen={evidenceDrawerOpen}
        onClose={handleCloseEvidence}
      />
    </div>
  );
}

export default VelocityInsightsTab;
