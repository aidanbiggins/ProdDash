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
import { VelocityMetrics, DecayDataPoint, VelocityInsight, CohortComparison, SuccessFactorComparison, Requisition, Candidate, Event, User, HiringManagerFriction, MetricFilters, CanonicalStage } from '../../types';
import { DashboardConfig } from '../../types/config';
import { PipelineBenchmarkConfig, HistoricalBenchmarkResult } from '../../types/pipelineTypes';
import { ActionItem } from '../../types/actionTypes';
import { AiProviderConfig } from '../../types/aiTypes';
import { useIsMobile } from '../../hooks/useIsMobile';
import { PipelineHealthCard, BenchmarkConfigModal } from '../pipeline-health';
import { VelocityCopilotPanel } from './VelocityCopilotPanel';
import { WhatIfSimulatorPanel } from './WhatIfSimulatorPanel';
import { PageHeader } from '../layout';
import { calculatePipelineHealth, generateHistoricalBenchmarks } from '../../services';
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
} from '../../services/velocityThresholds';

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
      style={{
        background: bg,
        color: text,
        padding: '2px 6px',
        fontSize: '0.6rem',
        fontWeight: 600,
        borderRadius: '2px',
        fontFamily: "'JetBrains Mono', monospace",
        textTransform: 'uppercase'
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
      className="d-flex align-items-center justify-content-between mt-2 px-2 py-1"
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
      className="alert mb-4 d-flex align-items-start gap-2"
      style={{
        background: 'rgba(245, 158, 11, 0.1)',
        border: '1px solid rgba(245, 158, 11, 0.3)',
        borderRadius: '4px',
        color: '#f59e0b'
      }}
    >
      <i className="bi bi-exclamation-triangle-fill mt-1"></i>
      <div>
        <div className="fw-semibold" style={{ fontSize: '0.85rem' }}>Limited Data Available</div>
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
          <i className="bi bi-arrow-up-circle me-2"></i>
          Import daily snapshots to unlock
        </span>
      </div>
    </div>
  );
}

// Evidence Drawer component - shows drilldown details for an insight
function EvidenceDrawer({
  insight,
  isOpen,
  onClose
}: {
  insight: VelocityInsight | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  if (!isOpen || !insight) return null;

  return (
    <div
      className="position-fixed top-0 end-0 h-100"
      style={{
        width: '400px',
        maxWidth: '100vw',
        background: '#1a1a1a',
        borderLeft: '1px solid #3f3f46',
        zIndex: 1050,
        boxShadow: '-4px 0 20px rgba(0,0,0,0.5)',
        display: 'flex',
        flexDirection: 'column'
      }}
      data-testid="evidence-drawer"
    >
      {/* Header */}
      <div
        className="d-flex align-items-center justify-content-between p-3"
        style={{ borderBottom: '1px solid #3f3f46' }}
      >
        <h6 className="mb-0" style={{ color: '#f5f5f5', fontSize: '0.85rem' }}>Evidence Details</h6>
        <button
          className="btn btn-sm"
          onClick={onClose}
          style={{ color: '#94A3B8', padding: '4px 8px' }}
        >
          <i className="bi bi-x-lg"></i>
        </button>
      </div>

      {/* Content */}
      <div className="flex-grow-1 overflow-auto p-3">
        {/* Insight Summary */}
        <div className="mb-4">
          <div className="fw-semibold mb-2" style={{ color: '#f5f5f5', fontSize: '0.9rem' }}>
            {insight.title}
          </div>
          <div style={{ color: '#94A3B8', fontSize: '0.8rem', lineHeight: 1.5 }}>
            {insight.description}
          </div>
        </div>

        {/* Metric Used */}
        <div className="mb-4">
          <div
            className="mb-2"
            style={{ color: '#6b7280', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}
          >
            Metric
          </div>
          <div
            className="p-2 rounded"
            style={{ background: '#27272a', fontSize: '0.8rem' }}
          >
            <div style={{ color: '#f5f5f5', fontWeight: 500 }}>{insight.metric || 'N/A'}</div>
            {insight.evidence && (
              <div style={{ color: '#94A3B8', fontSize: '0.75rem', marginTop: '4px' }}>
                {insight.evidence}
              </div>
            )}
          </div>
        </div>

        {/* Sample Size & Confidence */}
        <div className="mb-4">
          <div
            className="mb-2"
            style={{ color: '#6b7280', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}
          >
            Sample Size & Confidence
          </div>
          <div className="d-flex gap-3">
            <div
              className="p-2 rounded flex-grow-1"
              style={{ background: '#27272a', textAlign: 'center' }}
            >
              <div style={{ color: '#f5f5f5', fontWeight: 600, fontSize: '1.25rem' }}>
                {insight.sampleSize ?? '—'}
              </div>
              <div style={{ color: '#6b7280', fontSize: '0.65rem' }}>Sample (n)</div>
            </div>
            <div
              className="p-2 rounded flex-grow-1"
              style={{ background: '#27272a', textAlign: 'center' }}
            >
              <div style={{
                color: insight.confidence === 'HIGH' ? '#10b981' :
                  insight.confidence === 'MED' ? '#f59e0b' :
                    insight.confidence === 'LOW' ? '#ef4444' : '#6b7280',
                fontWeight: 600,
                fontSize: '0.9rem'
              }}>
                {insight.confidence || 'N/A'}
              </div>
              <div style={{ color: '#6b7280', fontSize: '0.65rem' }}>Confidence</div>
            </div>
          </div>
        </div>

        {/* Cohort Filters */}
        {insight.cohortFilters && Object.keys(insight.cohortFilters).length > 0 && (
          <div className="mb-4">
            <div
              className="mb-2"
              style={{ color: '#6b7280', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}
            >
              Cohort Filters
            </div>
            <div
              className="p-2 rounded"
              style={{ background: '#27272a', fontSize: '0.75rem', color: '#94A3B8' }}
            >
              {Object.entries(insight.cohortFilters).map(([key, value]) => (
                <div key={key}>
                  <span style={{ color: '#6b7280' }}>{key}:</span> {String(value)}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Contributing Items */}
        {insight.contributingItems && insight.contributingItems.length > 0 && (
          <div className="mb-4">
            <div
              className="mb-2"
              style={{ color: '#6b7280', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}
            >
              Top Contributing Items ({insight.contributingItems.length})
            </div>
            <div className="d-flex flex-column gap-2">
              {insight.contributingItems.slice(0, 10).map((item, idx) => (
                <div
                  key={item.id}
                  className="p-2 rounded d-flex justify-content-between align-items-center"
                  style={{ background: '#27272a', fontSize: '0.75rem' }}
                  data-testid="evidence-item"
                >
                  <div>
                    <span style={{ color: '#6b7280', marginRight: '8px' }}>{idx + 1}.</span>
                    <span style={{ color: '#f5f5f5' }}>{item.title || item.id}</span>
                    <span
                      className="ms-2"
                      style={{
                        background: 'rgba(96, 165, 250, 0.1)',
                        color: '#60a5fa',
                        padding: '1px 4px',
                        borderRadius: '2px',
                        fontSize: '0.6rem'
                      }}
                    >
                      {item.type}
                    </span>
                  </div>
                  {item.value !== undefined && (
                    <span style={{ color: '#94A3B8', fontFamily: "'JetBrains Mono', monospace" }}>
                      {item.value}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* No contributing items message */}
        {(!insight.contributingItems || insight.contributingItems.length === 0) && (
          <div
            className="p-3 text-center rounded"
            style={{ background: '#27272a', color: '#6b7280', fontSize: '0.8rem' }}
          >
            No individual items available for this insight.
            <br />
            <span style={{ fontSize: '0.7rem' }}>This insight is based on aggregate metrics.</span>
          </div>
        )}
      </div>
    </div>
  );
}

// Backdrop for drawer
function DrawerBackdrop({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  if (!isOpen) return null;
  return (
    <div
      className="position-fixed top-0 start-0 w-100 h-100"
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
    <div className="d-flex align-items-center justify-content-between mb-3">
      <div className="d-flex align-items-center gap-2">
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
        className="btn btn-sm d-flex align-items-center gap-1"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          background: 'transparent',
          border: 'none',
          color: '#6b7280',
          fontSize: '0.7rem',
          padding: '2px 4px'
        }}
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
    <div className="d-flex align-items-center gap-2">
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
      <div className="d-flex align-items-start justify-content-between gap-2 mb-2">
        <div className="d-flex align-items-center gap-2" style={{ flex: '1 1 auto', minWidth: 0 }}>
          <i className={`bi ${icon}`} style={{ color, fontSize: '0.85rem', flexShrink: 0 }}></i>
          <span className="fw-semibold text-truncate" style={{ color: '#f5f5f5', fontSize: '0.8rem' }}>
            {insight.title}
          </span>
        </div>
        <div className="d-flex align-items-center gap-1 flex-shrink-0">
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
      <div className="d-flex align-items-center gap-2 flex-wrap">
        {onViewEvidence && (
          <button
            className="btn btn-sm"
            onClick={() => onViewEvidence(insight)}
            style={{
              background: 'rgba(96, 165, 250, 0.1)',
              border: '1px solid rgba(96, 165, 250, 0.2)',
              color: '#60a5fa',
              fontSize: '0.6rem',
              padding: '2px 6px',
              borderRadius: '2px'
            }}
            data-testid="view-evidence-btn"
          >
            <i className="bi bi-eye me-1"></i>Evidence
          </button>
        )}
        {onCreateAction && insight.action && (
          <button
            className="btn btn-sm"
            onClick={() => onCreateAction(insight)}
            disabled={isActionCreated}
            style={{
              background: isActionCreated ? 'rgba(107, 114, 128, 0.1)' : 'rgba(212, 163, 115, 0.1)',
              border: `1px solid ${isActionCreated ? 'rgba(107, 114, 128, 0.2)' : 'rgba(212, 163, 115, 0.2)'}`,
              color: isActionCreated ? '#6b7280' : '#d4a373',
              fontSize: '0.6rem',
              padding: '2px 6px',
              borderRadius: '2px',
              opacity: isActionCreated ? 0.7 : 1
            }}
            data-testid="create-action-btn"
          >
            <i className={`bi ${isActionCreated ? 'bi-check' : 'bi-plus-circle'} me-1`}></i>
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
      <PageHeader
        title="Pipeline Velocity"
        description="Analyze pipeline timing, decay patterns, and success factors"
        breadcrumbs={[
          { label: 'Diagnose' },
          { label: 'Pipeline Velocity' }
        ]}
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
      <div className="row g-2 mb-3">
        <div className="col-6 col-md-3">
          <div className="glass-panel p-3 h-100 text-center">
            <div className="stat-label mb-1">Median TTF</div>
            <div className="font-mono fw-bold" style={{ fontSize: '1.5rem', color: 'var(--color-accent)' }}>
              {reqDecay.totalFilled >= MIN_DENOM_FOR_PASS_RATE && reqDecay.medianDaysToFill !== null
                ? `${reqDecay.medianDaysToFill}d`
                : '—'}
            </div>
            <DataChip n={reqDecay.totalFilled} confidence={reqConfidence.level} label="closed" />
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="glass-panel p-3 h-100 text-center">
            <div className="stat-label mb-1">Accept Rate</div>
            <div className="font-mono fw-bold" style={{ fontSize: '1.5rem', color: '#10b981' }}>
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
        </div>
        <div className="col-6 col-md-3">
          <div className="glass-panel p-3 h-100 text-center">
            <div className="stat-label mb-1">Fill Rate</div>
            <div className="font-mono fw-bold" style={{ fontSize: '1.5rem', color: '#6366f1' }}>
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
        </div>
        <div className="col-6 col-md-3">
          <div className="glass-panel p-3 h-100 text-center">
            <div className="stat-label mb-1">Decay Start</div>
            <div className="font-mono fw-bold" style={{ fontSize: '1.5rem', color: '#eab308' }}>
              {candidateDecay.totalOffers >= MIN_OFFERS_FOR_DECAY && candidateDecay.decayStartDay !== null
                ? `Day ${candidateDecay.decayStartDay}`
                : '—'}
            </div>
            <DataChip n={candidateDecay.totalOffers} confidence={offerConfidence.level} label="offers" />
          </div>
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
      <div className="row g-3 mb-3">
        {/* Candidate Decay Curve */}
        <div className="col-12 col-lg-6">
          <div className="glass-panel p-3 h-100">
            <div className="d-flex align-items-center justify-content-between mb-2">
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
        <div className="col-12 col-lg-6">
          <div className="glass-panel p-3 h-100">
            <div className="d-flex align-items-center justify-content-between mb-2">
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
            <div className="table-responsive">
              <table className="table table-sm mb-0" style={{ fontSize: '0.75rem' }}>
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
          <div className="row g-2">
            {insights.map((insight, idx) => (
              <div key={idx} className="col-12 col-md-6">
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

      {/* ===== SECTION 7: What-if Simulator ===== */}
      <WhatIfSimulatorPanel
        velocityMetrics={metrics}
        hmLatencyHours={simulatorContext.hmLatencyHours}
        pipelineDepth={simulatorContext.pipelineDepth}
        timeToOfferDays={simulatorContext.timeToOfferDays}
        expectedHires={simulatorContext.expectedHires}
        pipelineGap={simulatorContext.pipelineGap}
        openReqsCount={simulatorContext.openReqsCount}
        stageConversionRates={simulatorContext.stageConversionRates}
        aiConfig={aiConfig}
      />

      {/* Evidence Drawer and Backdrop */}
      <DrawerBackdrop isOpen={evidenceDrawerOpen} onClose={handleCloseEvidence} />
      <EvidenceDrawer
        insight={selectedInsight}
        isOpen={evidenceDrawerOpen}
        onClose={handleCloseEvidence}
      />
    </div>
  );
}

export default VelocityInsightsTab;
