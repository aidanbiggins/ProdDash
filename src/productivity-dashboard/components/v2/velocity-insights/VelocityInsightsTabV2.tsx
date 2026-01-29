'use client';

/**
 * VelocityInsightsTabV2 - Pipeline Velocity Analysis Tab
 * V2 Version - Uses Tailwind tokens and glass-panel styling
 * Analyzes factors that contribute to fast, successful hires
 * Implements: stage timing gating, evidence drilldowns, dedupe actions, improved narratives
 */

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
import { VelocityCopilotPanelV2 } from './VelocityCopilotPanelV2';
import { SubViewHeader } from '../SubViewHeader';
import { VELOCITY_PAGE_HELP } from '../../_legacy/velocity-insights/velocityHelpContent';
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
import { analyzeLoadVsPerformance, LoadVsPerformanceResult } from '../../../services/loadVsPerformanceService';

interface VelocityInsightsTabV2Props {
  metrics: VelocityMetrics;
  requisitions?: Requisition[];
  candidates?: Candidate[];
  events?: Event[];
  users?: User[];
  hmFriction?: HiringManagerFriction[];
  config?: DashboardConfig;
  filters?: MetricFilters;
  onUpdateConfig?: (config: DashboardConfig) => void;
  onAddToActionQueue?: (action: ActionItem) => void;
  aiConfig?: AiProviderConfig | null;
}

// Confidence badge component
function ConfidenceBadge({ level, sampleSize }: { level: ConfidenceLevel; sampleSize: number }) {
  const colors: Record<ConfidenceLevel, string> = {
    HIGH: 'bg-good/15 text-good',
    MED: 'bg-warn/15 text-warn',
    LOW: 'bg-bad/15 text-bad',
    INSUFFICIENT: 'bg-muted text-muted-foreground'
  };

  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[0.6rem] font-semibold uppercase font-mono ${colors[level]}`}
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
    <div className="flex items-center justify-between mt-2 px-2 py-1 bg-black/20 rounded-sm text-[0.65rem] text-muted-foreground">
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
    <div className="p-3 rounded mb-4 flex items-start gap-2 bg-warn/10 border border-warn/30 text-warn">
      <i className="bi bi-exclamation-triangle-fill mt-1"></i>
      <div>
        <div className="font-semibold text-sm">Limited Data Available</div>
        <div className="text-xs text-muted-foreground">
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

// Stage Timing EmptyState component
function StageTimingEmptyState({ reason }: { reason: string }) {
  return (
    <div className="glass-panel p-4 text-center">
      <div className="w-12 h-12 mx-auto mb-4 bg-muted/15 rounded-full flex items-center justify-center">
        <i className="bi bi-clock-history text-2xl text-muted-foreground"></i>
      </div>
      <h6 className="text-foreground text-sm font-semibold mb-2">
        Stage timing unavailable
      </h6>
      <p className="text-muted-foreground text-xs mb-4 max-w-[280px] mx-auto">
        {reason}
      </p>
      <div className="inline-block bg-accent/10 border border-accent/20 rounded px-3 py-2">
        <span className="text-accent text-xs">
          <i className="bi bi-arrow-up-circle mr-2"></i>
          Import daily snapshots to unlock
        </span>
      </div>
    </div>
  );
}

// Evidence Drawer component
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

  const evidence = insight.evidence?.toLowerCase() || '';
  const title = insight.title?.toLowerCase() || '';

  const isTTFInsight = evidence.includes('ttf') || evidence.includes('median') || title.includes('time-to-fill');
  const isFillRateInsight = evidence.includes('fill_rate') || title.includes('fill rate');
  const isAcceptanceInsight = evidence.includes('accept') || evidence.includes('offer') || title.includes('acceptance');
  const isDecayInsight = evidence.includes('decay') || title.includes('decay');
  const isCohortInsight = evidence.includes('cohort') || title.includes('fast') || title.includes('slow');

  const extractNumber = (text: string): string | null => {
    const match = text.match(/(\d+\.?\d*)\s*(days?|%|d\b)/i);
    return match ? match[1] + (match[2] === '%' ? '%' : 'd') : null;
  };
  const primaryValue = extractNumber(insight.description || '');

  const getStatusColor = () => {
    if (insight.type === 'warning') return 'text-warn';
    if (insight.type === 'success') return 'text-good';
    return 'text-blue-400';
  };

  return (
    <div
      className="fixed top-0 right-0 h-full flex flex-col w-[440px] max-w-full bg-background border-l border-border z-[1050] shadow-2xl"
      data-testid="evidence-drawer"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${insight.type === 'warning' ? 'bg-warn' : insight.type === 'success' ? 'bg-good' : 'bg-blue-400'}`} />
          <h6 className="mb-0 text-foreground text-sm font-semibold">
            Evidence & Context
          </h6>
        </div>
        <button
          className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
          onClick={onClose}
        >
          <i className="bi bi-x-lg"></i>
        </button>
      </div>

      {/* Content */}
      <div className="grow overflow-auto">
        {/* Hero Section */}
        <div className="p-4 text-center bg-gradient-to-b from-muted/50 to-background border-b border-border">
          <div className="text-muted-foreground text-[0.7rem] uppercase tracking-widest mb-2">
            {insight.title}
          </div>
          {primaryValue ? (
            <div className={`text-4xl font-bold font-mono ${getStatusColor()}`}>
              {primaryValue}
            </div>
          ) : (
            <div className="text-foreground text-base font-medium">
              {insight.description}
            </div>
          )}
          {primaryValue && (
            <div className="text-muted-foreground text-xs mt-1">
              {insight.type === 'warning' ? 'Needs attention' : insight.type === 'success' ? 'Performing well' : 'For your awareness'}
            </div>
          )}
        </div>

        <div className="p-3">
          {/* Why This Matters */}
          {insight.soWhat && (
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <i className="bi bi-lightbulb text-warn text-sm"></i>
                <span className="text-foreground text-xs font-semibold uppercase tracking-wide">
                  Why This Matters
                </span>
              </div>
              <div className="text-muted-foreground text-xs leading-relaxed pl-5">
                {insight.soWhat}
              </div>
            </div>
          )}

          {/* Recommended Action */}
          {insight.nextStep && (
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <i className="bi bi-arrow-right-circle text-good text-sm"></i>
                <span className="text-foreground text-xs font-semibold uppercase tracking-wide">
                  Recommended Action
                </span>
              </div>
              <div className="p-2 rounded bg-good/10 border border-good/20 pl-5">
                <span className="text-good text-xs">{insight.nextStep}</span>
              </div>
            </div>
          )}

          {/* TTF/Fill Rate Insight */}
          {(isTTFInsight || isFillRateInsight) && reqDecay.dataPoints.length > 0 && (
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <i className="bi bi-bar-chart text-blue-400 text-sm"></i>
                <span className="text-foreground text-xs font-semibold uppercase tracking-wide">
                  Fill Rate by Days Open
                </span>
              </div>
              <div className="flex flex-col gap-1">
                {reqDecay.dataPoints.slice(0, 6).map((dp, idx) => {
                  const fillPct = Math.round(dp.rate * 100);
                  const barColorClass = fillPct >= 60 ? 'bg-good' : fillPct >= 40 ? 'bg-warn' : 'bg-bad';
                  return (
                    <div key={idx} className="flex items-center gap-2">
                      <div className="w-20 text-[0.7rem] text-muted-foreground text-right">
                        {dp.bucket}
                      </div>
                      <div className="flex-1 h-4 bg-muted rounded-sm overflow-hidden">
                        <div className={`h-full transition-all ${barColorClass}`} style={{ width: `${fillPct}%` }} />
                      </div>
                      <div className="w-12 text-[0.7rem] text-foreground font-mono">
                        {fillPct}%
                      </div>
                      <div className="w-8 text-[0.65rem] text-muted-foreground">
                        n={dp.count}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="text-[0.65rem] text-muted-foreground mt-2 italic">
                Fill rate drops as reqs stay open longer. Target: close within 45 days.
              </div>
            </div>
          )}

          {/* Acceptance/Decay Insight */}
          {(isAcceptanceInsight || isDecayInsight) && candidateDecay.dataPoints.length > 0 && (
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <i className="bi bi-graph-down text-warn text-sm"></i>
                <span className="text-foreground text-xs font-semibold uppercase tracking-wide">
                  Acceptance Rate by Time in Process
                </span>
              </div>
              <div className="flex flex-col gap-1">
                {candidateDecay.dataPoints.slice(0, 6).map((dp, idx) => {
                  const acceptPct = Math.round(dp.rate * 100);
                  const barColorClass = acceptPct >= 80 ? 'bg-good' : acceptPct >= 60 ? 'bg-warn' : 'bg-bad';
                  const isDecayPoint = candidateDecay.decayStartDay && dp.minDays >= candidateDecay.decayStartDay;
                  return (
                    <div key={idx} className="flex items-center gap-2">
                      <div className={`w-20 text-[0.7rem] text-right ${isDecayPoint ? 'text-warn' : 'text-muted-foreground'}`}>
                        {dp.bucket} {isDecayPoint && '!'}
                      </div>
                      <div className="flex-1 h-4 bg-muted rounded-sm overflow-hidden">
                        <div className={`h-full transition-all ${barColorClass}`} style={{ width: `${acceptPct}%` }} />
                      </div>
                      <div className="w-12 text-[0.7rem] text-foreground font-mono">
                        {acceptPct}%
                      </div>
                      <div className="w-8 text-[0.65rem] text-muted-foreground">
                        n={dp.count}
                      </div>
                    </div>
                  );
                })}
              </div>
              {candidateDecay.decayStartDay && (
                <div className="p-2 mt-2 rounded bg-warn/10 border border-warn/20">
                  <span className="text-warn text-xs">
                    Decay begins after day {candidateDecay.decayStartDay}. Aim to extend offers before this point.
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Cohort Comparison */}
          {isCohortInsight && cohortComparison && (
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <i className="bi bi-people text-purple-400 text-sm"></i>
                <span className="text-foreground text-xs font-semibold uppercase tracking-wide">
                  Fast vs Slow Hire Comparison
                </span>
              </div>
              <div className="flex gap-2 mb-2">
                <div className="grow p-2 rounded text-center bg-good/10 border border-good/20">
                  <div className="text-good text-xl font-bold font-mono">
                    {Math.round(cohortComparison.fastHires.avgTimeToFill)}d
                  </div>
                  <div className="text-muted-foreground text-[0.65rem]">Fast Hires (n={cohortComparison.fastHires.count})</div>
                </div>
                <div className="grow p-2 rounded text-center bg-bad/10 border border-bad/20">
                  <div className="text-bad text-xl font-bold font-mono">
                    {Math.round(cohortComparison.slowHires.avgTimeToFill)}d
                  </div>
                  <div className="text-muted-foreground text-[0.65rem]">Slow Hires (n={cohortComparison.slowHires.count})</div>
                </div>
              </div>
              {cohortComparison.factors.slice(0, 4).map((factor, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 rounded mb-1 bg-muted">
                  <span className="text-muted-foreground text-xs">{factor.factor}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-good text-xs font-mono">
                      {factor.fastHiresValue} {factor.unit}
                    </span>
                    <span className="text-muted-foreground text-[0.7rem]">vs</span>
                    <span className="text-bad text-xs font-mono">
                      {factor.slowHiresValue} {factor.unit}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Contributing Items */}
          {insight.contributingItems && insight.contributingItems.length > 0 && (
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <i className="bi bi-list-check text-blue-400 text-sm"></i>
                <span className="text-foreground text-xs font-semibold uppercase tracking-wide">
                  Contributing Items ({insight.contributingItems.length})
                </span>
              </div>
              <div className="flex flex-col gap-1">
                {insight.contributingItems.slice(0, 8).map((item, idx) => (
                  <div
                    key={item.id}
                    className="p-2 rounded flex justify-between items-center bg-muted text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground w-4">{idx + 1}.</span>
                      <span className="text-foreground">{item.title || item.id}</span>
                    </div>
                    {item.value !== undefined && (
                      <span className="text-muted-foreground font-mono text-[0.7rem]">
                        {item.value}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Data Source */}
          <div className="mt-4 pt-3 border-t border-muted">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-[0.65rem]">
                Based on {insight.sampleSize ?? reqDecay.totalReqs} records
              </span>
              <span className={`px-2 py-0.5 rounded text-[0.6rem] font-semibold uppercase ${
                insight.confidence === 'HIGH' ? 'bg-good/15 text-good' :
                insight.confidence === 'MED' ? 'bg-warn/15 text-warn' : 'bg-muted text-muted-foreground'
              }`}>
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
      className="fixed inset-0 bg-black/50 z-[1040]"
      onClick={onClose}
    />
  );
}

// Color scale for decay visualization
function getDecayColor(rate: number): string {
  if (rate >= 0.8) return '#10B981';
  if (rate >= 0.6) return '#22C55E';
  if (rate >= 0.4) return '#F59E0B';
  if (rate >= 0.2) return '#F97316';
  return '#EF4444';
}

// Section Header component
function SectionHeaderLocal({ icon, title, subtitle, rightContent }: {
  icon: string;
  title: string;
  subtitle?: string;
  rightContent?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <span className="w-7 h-7 bg-accent/15 rounded flex items-center justify-center text-sm">
          {icon}
        </span>
        <div>
          <h6 className="mb-0 text-sm font-semibold text-foreground">{title}</h6>
          {subtitle && <small className="text-muted-foreground text-[0.7rem]">{subtitle}</small>}
        </div>
      </div>
      {rightContent}
    </div>
  );
}

// Collapsible Chart Help component
function ChartHelp({ text }: { text: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="mt-2">
      <button
        className="flex items-center gap-1 bg-transparent border-0 text-muted-foreground px-1 py-0.5 text-xs hover:text-foreground"
        onClick={() => setIsOpen(!isOpen)}
      >
        <i className={`bi ${isOpen ? 'bi-info-circle-fill' : 'bi-info-circle'}`}></i>
        {isOpen ? 'Hide help' : 'How to read'}
      </button>
      {isOpen && (
        <div className="mt-1 p-2 rounded bg-muted/50 text-xs text-muted-foreground leading-relaxed">
          {text}
        </div>
      )}
    </div>
  );
}

// Data chip component
function DataChip({ n, confidence, label }: { n: number; confidence?: ConfidenceLevel; label?: string }) {
  const confColors: Record<ConfidenceLevel, string> = {
    HIGH: 'text-good',
    MED: 'text-warn',
    LOW: 'text-bad',
    INSUFFICIENT: 'text-muted-foreground'
  };

  return (
    <div className="flex items-center gap-2">
      <span className="bg-blue-500/10 text-blue-400 px-1.5 py-0.5 text-[0.6rem] font-mono rounded">
        n={n}{label ? ` ${label}` : ''}
      </span>
      {confidence && (
        <span className={`bg-current/10 px-1.5 py-0.5 text-[0.55rem] font-semibold font-mono rounded uppercase ${confColors[confidence]}`}>
          {confidence}
        </span>
      )}
    </div>
  );
}

// Compact Insight Card
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
  const iconConfig = {
    warning: { icon: 'bi-exclamation-triangle-fill', colorClass: 'text-warn', borderClass: 'border-l-warn' },
    success: { icon: 'bi-check-circle-fill', colorClass: 'text-good', borderClass: 'border-l-good' },
    info: { icon: 'bi-info-circle-fill', colorClass: 'text-blue-400', borderClass: 'border-l-blue-400' }
  };
  const { icon, colorClass, borderClass } = iconConfig[insight.type] || iconConfig.info;

  const confColors: Record<string, string> = {
    HIGH: 'text-good', MED: 'text-warn', LOW: 'text-bad', INSUFFICIENT: 'text-muted-foreground'
  };

  return (
    <div className={`p-3 bg-muted/50 rounded border-l-[3px] ${borderClass}`}>
      {/* Row 1: Icon + Title | Metric chips */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <i className={`bi ${icon} ${colorClass} text-sm shrink-0`}></i>
          <span className="font-semibold truncate text-foreground text-xs">
            {insight.title}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {insight.sampleSize !== undefined && (
            <span className="bg-blue-500/10 text-blue-400 px-1.5 py-0.5 text-[0.55rem] font-mono rounded">
              n={insight.sampleSize}
            </span>
          )}
          {insight.confidence && (
            <span className={`bg-current/10 px-1.5 py-0.5 text-[0.5rem] font-semibold font-mono rounded uppercase ${confColors[insight.confidence]}`}>
              {insight.confidence}
            </span>
          )}
        </div>
      </div>

      {/* Row 2: Claim */}
      <div className="mb-2 text-muted-foreground text-xs leading-relaxed line-clamp-2">
        {insight.description}
      </div>

      {/* Row 3: Action buttons */}
      <div className="flex items-center gap-2 flex-wrap">
        {onViewEvidence && (
          <button
            className="px-1.5 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[0.6rem] hover:bg-blue-500/20 transition-colors"
            onClick={() => onViewEvidence(insight)}
            data-testid="view-evidence-btn"
          >
            <i className="bi bi-eye mr-1"></i>Evidence
          </button>
        )}
        {onCreateAction && insight.action && (
          <button
            className={`px-1.5 py-0.5 rounded text-[0.6rem] transition-colors ${
              isActionCreated
                ? 'bg-muted border border-muted-foreground/20 text-muted-foreground opacity-70'
                : 'bg-accent/10 border border-accent/20 text-accent hover:bg-accent/20'
            }`}
            onClick={() => onCreateAction(insight)}
            disabled={isActionCreated}
            data-testid="create-action-btn"
          >
            <i className={`bi ${isActionCreated ? 'bi-check' : 'bi-plus-circle'} mr-1`}></i>
            {isActionCreated ? 'Added' : 'Action'}
          </button>
        )}
        {insight.metric && (
          <span className="bg-muted text-muted-foreground px-1.5 py-0.5 text-[0.55rem] font-mono rounded">
            {insight.metric}
          </span>
        )}
      </div>
    </div>
  );
}

export function VelocityInsightsTabV2({
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
}: VelocityInsightsTabV2Props) {
  const isMobile = useIsMobile();
  const chartHeight = isMobile ? 250 : 320;

  const { candidateDecay, reqDecay, insights, cohortComparison } = metrics;

  // Evidence drawer state
  const [evidenceDrawerOpen, setEvidenceDrawerOpen] = useState(false);
  const [selectedInsight, setSelectedInsight] = useState<VelocityInsight | null>(null);

  // Track created action IDs to prevent duplicates
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

  // Generate stable action ID for dedupe
  const generateActionId = useCallback((insight: VelocityInsight): string => {
    const sanitizedTitle = insight.title.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    return `velocity_insight_${sanitizedTitle}`;
  }, []);

  // Create action from insight with dedupe check
  const handleCreateAction = useCallback((insight: VelocityInsight) => {
    if (!onAddToActionQueue || !insight.action) return;

    const actionId = generateActionId(insight);

    if (createdActionIds.has(actionId)) {
      console.log(`[VelocityInsightsV2] Action already created: ${actionId}`);
      return;
    }

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

  // Calculate pipeline health
  const pipelineHealth = useMemo(() => {
    if (!requisitions?.length || !candidates?.length || !events || !users || !hmFriction || !config || !filters) {
      return null;
    }
    return calculatePipelineHealth(requisitions, candidates, events, users, hmFriction, config, filters);
  }, [requisitions, candidates, events, users, hmFriction, config, filters]);

  // Load vs Performance analysis - tests "do recruiters hire faster with fewer reqs?"
  const loadVsPerformance = useMemo((): LoadVsPerformanceResult | null => {
    if (!requisitions?.length || !candidates?.length) return null;
    return analyzeLoadVsPerformance(requisitions, candidates);
  }, [requisitions, candidates]);

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

  // Format chart data
  const candidateChartData = candidateDecay.dataPoints
    .filter(dp => dp.count > 0)
    .map(dp => ({
      name: dp.bucket,
      rate: Math.round(dp.rate * 100),
      count: dp.count,
      minDays: dp.minDays
    }));

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

      {/* AI Copilot Panel */}
      {requisitions && candidates && events && filters && (
        <VelocityCopilotPanelV2
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

      {/* Limited Data Banner */}
      <LimitedDataBanner sections={limitedDataSections} />

      {/* SECTION 1: KPIs */}
      <SectionHeaderLocal icon="📊" title="Key Metrics" subtitle="Velocity performance indicators" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
        <div className="glass-panel p-3 h-full text-center">
          <div className="stat-label mb-1">Median TTF</div>
          <div className="font-mono font-bold text-2xl text-accent">
            {reqDecay.totalFilled >= MIN_DENOM_FOR_PASS_RATE && reqDecay.medianDaysToFill !== null
              ? `${reqDecay.medianDaysToFill}d`
              : '—'}
          </div>
          <DataChip n={reqDecay.totalFilled} confidence={reqConfidence.level} label="closed" />
        </div>
        <div className="glass-panel p-3 h-full text-center">
          <div className="stat-label mb-1">Accept Rate</div>
          <div className="font-mono font-bold text-2xl text-good">
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
          <div className="font-mono font-bold text-2xl text-indigo-400">
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
          <div className="font-mono font-bold text-2xl text-yellow-400">
            {candidateDecay.totalOffers >= MIN_OFFERS_FOR_DECAY && candidateDecay.decayStartDay !== null
              ? `Day ${candidateDecay.decayStartDay}`
              : '—'}
          </div>
          <DataChip n={candidateDecay.totalOffers} confidence={offerConfidence.level} label="offers" />
        </div>
      </div>

      {/* SECTION 2: Pipeline Health */}
      {(pipelineHealth || config) && (
        <div className="mb-3">
          <SectionHeaderLocal icon="🔬" title="Pipeline Health" subtitle="Stage-by-stage performance vs benchmarks" />
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

      {/* SECTION 3: Stage Timing (if available) */}
      {stageTimingCapability.capability !== 'NONE' && stageTimingCapability.canShowStageDuration && (
        <div className="mb-3">
          <SectionHeaderLocal icon="⏱️" title="Stage Timing" subtitle="Time spent in each stage" />
          {/* Stage timing visualization would go here */}
        </div>
      )}

      {/* SECTION 4: Decay Curves */}
      <SectionHeaderLocal icon="📉" title="Decay Analysis" subtitle="How time affects outcomes" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-3">
        {/* Candidate Decay Curve */}
        <div className="glass-panel p-3 h-full">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h6 className="mb-0 text-xs text-foreground">Candidate Decay</h6>
              <small className="text-muted-foreground text-[0.65rem]">Acceptance by time in process</small>
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
                    <div className="bg-background border border-border rounded p-2 text-xs shadow-lg">
                      <div className="text-foreground font-semibold">{d.name}</div>
                      <div style={{ color: getDecayColor(d.rate / 100) }}>{d.rate}% accept</div>
                      <div className="text-muted-foreground">{d.count} offers</div>
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
            <div className="text-center py-4 text-muted-foreground text-xs">
              Not enough offer data
            </div>
          )}
          <ChartHelp text="Each bar shows offer acceptance rate by days in process. Declining bars = candidate interest decay. Aim to extend offers before the decay starts." />
        </div>

        {/* Req Decay Curve */}
        <div className="glass-panel p-3 h-full">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h6 className="mb-0 text-xs text-foreground">Requisition Decay</h6>
              <small className="text-muted-foreground text-[0.65rem]">Fill probability by days open</small>
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
                    <div className="bg-background border border-border rounded p-2 text-xs shadow-lg">
                      <div className="text-foreground font-semibold">{d.name}</div>
                      <div className="text-teal-400">{d.rate}% fill rate</div>
                      <div className="text-muted-foreground">{d.count} reqs</div>
                    </div>
                  );
                }} />
                <ReferenceLine y={Math.round(reqDecay.overallFillRate * 100)} stroke="#6b7280" strokeDasharray="3 3" />
                <Area type="monotone" dataKey="rate" stroke="#2dd4bf" strokeWidth={2} fill="url(#fillGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center py-4 text-muted-foreground text-xs">
              Not enough req data
            </div>
          )}
          <ChartHelp text="Shows fill rate by days open. Declining curve = longer-open reqs are harder to fill. Consider interventions for stale reqs." />
        </div>
      </div>

      {/* SECTION 5: Fast vs Slow Cohort */}
      {metrics.cohortComparison && (metrics.cohortComparison.fastHires.count > 0 || metrics.cohortComparison.slowHires.count > 0) && (
        <div className="mb-3">
          <SectionHeaderLocal
            icon="🏆"
            title="Fast vs Slow Hires"
            subtitle={`Top 25% (${metrics.cohortComparison.fastHires.count}) vs bottom 25% (${metrics.cohortComparison.slowHires.count})`}
            rightContent={<DataChip n={metrics.cohortComparison.fastHires.count + metrics.cohortComparison.slowHires.count} confidence={cohortConfidence.level} />}
          />
          <div className="glass-panel p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs mb-0">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="p-2 text-left text-muted-foreground font-medium">Factor</th>
                    <th className="p-2 text-center text-good font-medium">Fast ({Math.round(metrics.cohortComparison.fastHires.avgTimeToFill)}d)</th>
                    <th className="p-2 text-center text-bad font-medium">Slow ({Math.round(metrics.cohortComparison.slowHires.avgTimeToFill)}d)</th>
                    <th className="p-2 text-center text-muted-foreground font-medium">Impact</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.cohortComparison.factors.slice(0, 5).map((factor, idx) => (
                    <tr key={idx} className="border-t border-border">
                      <td className="p-2 text-foreground">{factor.factor}</td>
                      <td className="p-2 text-center text-good">{factor.fastHiresValue} {factor.unit}</td>
                      <td className="p-2 text-center text-bad">{factor.slowHiresValue} {factor.unit}</td>
                      <td className="p-2 text-center">
                        <span className={`px-1.5 py-0.5 rounded text-[0.6rem] ${
                          factor.impactLevel === 'high' ? 'bg-bad/15 text-bad' :
                          factor.impactLevel === 'medium' ? 'bg-warn/15 text-warn' : 'bg-muted text-muted-foreground'
                        }`}>
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

      {/* SECTION 6: Load vs Performance */}
      {loadVsPerformance && loadVsPerformance.sampleSize >= 10 && (
        <div className="mb-3">
          <SectionHeaderLocal
            icon="⚖️"
            title="Workload vs. Hiring Speed"
            subtitle="Does recruiter workload impact time-to-fill?"
            rightContent={<DataChip n={loadVsPerformance.sampleSize} confidence={loadVsPerformance.confidence} />}
          />
          <div className="glass-panel p-4">
            {/* Insight Banner */}
            <div className={`p-3 rounded mb-4 ${
              loadVsPerformance.correlation.direction === 'positive' ? 'bg-warn/10 border border-warn/30' :
              loadVsPerformance.correlation.direction === 'negative' ? 'bg-primary/10 border border-primary/30' :
              'bg-muted/30 border border-border'
            }`}>
              <div className="flex items-start gap-2">
                <span className="text-lg">
                  {loadVsPerformance.correlation.direction === 'positive' ? '⚠️' :
                   loadVsPerformance.correlation.direction === 'negative' ? '🔄' : '➖'}
                </span>
                <div>
                  <div className="font-semibold text-foreground text-sm mb-1">
                    {loadVsPerformance.correlation.direction === 'positive' ? 'Higher workload = slower hiring' :
                     loadVsPerformance.correlation.direction === 'negative' ? 'Unexpected: Higher workload = faster hiring' :
                     'No significant correlation found'}
                  </div>
                  <div className="text-muted-foreground text-xs">
                    {loadVsPerformance.insight}
                  </div>
                </div>
              </div>
            </div>

            {/* Buckets Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border">
                    <th className="p-2 text-left text-muted-foreground font-medium">Concurrent Reqs</th>
                    <th className="p-2 text-center text-muted-foreground font-medium">Median TTF</th>
                    <th className="p-2 text-center text-muted-foreground font-medium">Avg TTF</th>
                    <th className="p-2 text-center text-muted-foreground font-medium">Hires</th>
                    <th className="p-2 text-left text-muted-foreground font-medium">Visual</th>
                  </tr>
                </thead>
                <tbody>
                  {loadVsPerformance.buckets.map((bucket, idx) => (
                    <tr key={idx} className="border-t border-border">
                      <td className="p-2 text-foreground font-medium">{bucket.label}</td>
                      <td className="p-2 text-center font-mono">
                        {bucket.medianTTF !== null ? (
                          <span className={
                            idx === 0 ? 'text-good' :
                            idx === loadVsPerformance.buckets.length - 1 && bucket.medianTTF && loadVsPerformance.buckets[0].medianTTF &&
                            bucket.medianTTF > loadVsPerformance.buckets[0].medianTTF * 1.2 ? 'text-bad' :
                            'text-foreground'
                          }>
                            {bucket.medianTTF.toFixed(0)}d
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="p-2 text-center font-mono text-muted-foreground">
                        {bucket.avgTTF !== null ? `${bucket.avgTTF.toFixed(0)}d` : '—'}
                      </td>
                      <td className="p-2 text-center font-mono text-muted-foreground">
                        {bucket.hireCount > 0 ? bucket.hireCount : '—'}
                      </td>
                      <td className="p-2">
                        {bucket.medianTTF !== null && bucket.hireCount >= 3 && (
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden max-w-[100px]">
                              <div
                                className={`h-full rounded-full ${
                                  idx === 0 ? 'bg-good' :
                                  bucket.medianTTF > (loadVsPerformance.buckets[0].medianTTF || 30) * 1.2 ? 'bg-bad' :
                                  'bg-primary'
                                }`}
                                style={{ width: `${Math.min((bucket.medianTTF / 60) * 100, 100)}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Footer explanation */}
            <div className="mt-3 pt-3 border-t border-border text-xs text-muted-foreground">
              <strong>Method:</strong> For each hire, we count how many reqs the recruiter had open at that time,
              then compare median TTF across workload buckets. A positive correlation suggests overloaded recruiters
              hire slower.
            </div>
          </div>
        </div>
      )}

      {/* SECTION 7: Key Insights */}
      {insights.length > 0 && (
        <div className="mb-3">
          <SectionHeaderLocal
            icon="💡"
            title="Key Insights"
            subtitle={`${insights.length} findings from velocity analysis`}
            rightContent={
              <span className="text-muted-foreground text-[0.65rem]">
                {insights.filter(i => i.type === 'warning').length} warnings
              </span>
            }
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {insights.map((insight, idx) => (
              <CompactInsightCard
                key={idx}
                insight={insight}
                onCreateAction={onAddToActionQueue ? handleCreateAction : undefined}
                onViewEvidence={handleViewEvidence}
                isActionCreated={createdActionIds.has(generateActionId(insight))}
              />
            ))}
          </div>
        </div>
      )}

      {/* SECTION 7: What-if Simulator CTA */}
      <div className="glass-panel p-4 text-center mb-3">
        <div className="text-3xl mb-2">🔮</div>
        <div className="text-sm font-semibold text-foreground mb-2">What-if Analysis</div>
        <p className="text-muted-foreground mb-3 text-xs">
          Run hiring scenarios to understand potential outcomes.
        </p>
        <a
          href="/plan/scenarios"
          className="inline-flex items-center px-4 py-2 bg-accent text-white rounded hover:bg-accent/90 transition-colors text-sm"
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

// Backwards-compatible alias
export const VelocityInsightsTab = VelocityInsightsTabV2;

export default VelocityInsightsTabV2;
