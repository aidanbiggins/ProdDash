'use client';

/**
 * VelocityCopilotPanelV2 - AI-powered insights panel for the Velocity tab
 * V2 Version - Uses Tailwind tokens and glass-panel styling
 * Design aligned with Control Tower tab patterns
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  VelocityFactPack,
  AICopilotInsight,
  AICopilotResponse,
  DeterministicSummary,
  DraftMessage
} from '../../../types/velocityCopilotTypes';
import { VelocityMetrics, Requisition, Candidate, Event, MetricFilters, VelocityInsight } from '../../../types';
import { AiProviderConfig } from '../../../types/aiTypes';
import { ActionItem } from '../../../types/actionTypes';
import { SectionHeader } from '../../common/SectionHeader';
import { LogoSpinner } from '../../common/LogoSpinner';
import {
  buildVelocityFactPack,
  generateAIInsights,
  generateDeterministicSummary,
  generateDraftMessage,
  generateDeterministicDraftMessage
} from '../../../services/velocityCopilotService';
import {
  getCitationLabel,
  shouldCollapseCitations,
  getCitationsSummary
} from '../../../services/citationLabelService';
import { getChartDataForInsight, ChartData } from '../../../services/insightChartService';
import { MiniChartV2 } from './MiniChartsV2';

interface VelocityCopilotPanelV2Props {
  metrics: VelocityMetrics;
  requisitions: Requisition[];
  candidates: Candidate[];
  events: Event[];
  filters: MetricFilters;
  aiConfig?: AiProviderConfig | null;
  onAddToActionQueue?: (action: ActionItem) => void;
  onViewEvidence?: (insight: VelocityInsight) => void;
}

// Severity badge component - matches Control Tower pattern
function SeverityBadge({ severity }: { severity: 'P0' | 'P1' | 'P2' }) {
  const config = {
    P0: { classes: 'bg-bad/15 text-bad', label: 'Blocking' },
    P1: { classes: 'bg-warn/15 text-warn', label: 'Risk' },
    P2: { classes: 'bg-good/15 text-good', label: 'Optimize' }
  };
  const style = config[severity];

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium font-mono ${style.classes}`}>
      {severity} · {style.label}
    </span>
  );
}

// Citation badge component - displays human-readable labels
function CitationBadge({ citation }: { citation: string }) {
  const label = getCitationLabel(citation);
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-[0.65rem] font-medium mr-1 mb-1 bg-blue-500/10 text-blue-400"
      title={citation}
    >
      {label}
    </span>
  );
}

// Citations display component - handles collapse for many citations
function CitationsDisplay({
  citations,
  onViewEvidence
}: {
  citations: string[];
  onViewEvidence?: () => void;
}) {
  if (citations.length === 0) return null;

  const shouldCollapse = shouldCollapseCitations(citations);

  if (shouldCollapse) {
    return (
      <button
        className="text-blue-400 hover:text-blue-300 underline-offset-2 hover:underline p-0 ml-2 bg-transparent border-0 text-[0.7rem]"
        onClick={onViewEvidence}
        title="Click to see evidence"
      >
        <i className="bi bi-database mr-1 text-[0.6rem]"></i>
        {getCitationsSummary(citations)}
      </button>
    );
  }

  return (
    <span className="ml-2 inline-flex flex-wrap items-center gap-1">
      {citations.map((citation, idx) => (
        <CitationBadge key={idx} citation={citation} />
      ))}
    </span>
  );
}

// AI Insight Card component - with inline visualization
function AIInsightCard({
  insight,
  chartData,
  onCreateAction,
  onDraftMessage,
  onViewEvidence,
  createdActionIds
}: {
  insight: AICopilotInsight;
  chartData: ChartData;
  onCreateAction: (insight: AICopilotInsight) => void;
  onDraftMessage: (insight: AICopilotInsight) => void;
  onViewEvidence: (insight: AICopilotInsight) => void;
  createdActionIds: Set<string>;
}) {
  const isActionCreated = createdActionIds.has(insight.id);
  const borderColorClass = insight.severity === 'P0' ? 'border-l-bad' :
                      insight.severity === 'P1' ? 'border-l-warn' : 'border-l-good';

  return (
    <div className={`glass-panel p-3 mb-3 border-l-[3px] ${borderColorClass}`}>
      {/* Header row with severity, title, and mini chart */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="grow">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <SeverityBadge severity={insight.severity} />
            <span className="font-semibold text-foreground text-sm">
              {insight.title}
            </span>
          </div>
          {/* Claim text */}
          <p className="mb-0 text-foreground text-[0.85rem] leading-relaxed">
            {insight.claim}
          </p>
        </div>

        {/* Mini chart on the right */}
        {chartData.type !== 'none' && (
          <div className="shrink-0">
            <MiniChartV2 data={chartData} width={140} height={55} />
          </div>
        )}
      </div>

      {/* Why Now + recommended action */}
      <p className="mb-2 text-muted-foreground text-xs">
        {insight.why_now}
        {insight.recommended_actions[0] && (
          <span className="text-accent ml-1.5">
            → {insight.recommended_actions[0]}
          </span>
        )}
      </p>

      {/* Action Buttons */}
      <div className="flex gap-2 flex-wrap items-center">
        <button
          className="px-3 py-1.5 text-xs bg-muted/30 border border-border rounded hover:bg-muted/50 text-foreground transition-colors disabled:opacity-50"
          onClick={() => onCreateAction(insight)}
          disabled={isActionCreated}
          data-testid="create-action-btn"
        >
          <i className={`bi ${isActionCreated ? 'bi-check-circle' : 'bi-plus-circle'} mr-1`}></i>
          {isActionCreated ? 'Added' : 'Action'}
        </button>

        <button
          className="px-3 py-1.5 text-xs bg-muted/30 border border-border rounded hover:bg-muted/50 text-foreground transition-colors"
          onClick={() => onDraftMessage(insight)}
          data-testid="draft-message-btn"
        >
          <i className="bi bi-chat-text mr-1"></i>
          Draft
        </button>

        <button
          className="px-3 py-1.5 text-xs bg-muted/30 border border-border rounded hover:bg-muted/50 text-foreground transition-colors"
          onClick={() => onViewEvidence(insight)}
          data-testid="view-evidence-btn"
        >
          <i className="bi bi-eye mr-1"></i>
          Evidence
        </button>

        {/* Collapsed citations link */}
        {insight.citations.length > 0 && (
          <CitationsDisplay
            citations={insight.citations}
            onViewEvidence={() => onViewEvidence(insight)}
          />
        )}
      </div>
    </div>
  );
}

// Draft Message Modal - matches theme modal patterns
function DraftMessageModal({
  isOpen,
  onClose,
  draftMessage,
  isLoading
}: {
  isOpen: boolean;
  onClose: () => void;
  draftMessage: DraftMessage | null;
  isLoading: boolean;
}) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-black/70 z-[1060]"
      onClick={onClose}
    >
      <div
        className="glass-panel p-4 w-[500px] max-w-[90vw] max-h-[80vh] overflow-auto"
        onClick={e => e.stopPropagation()}
      >
        <SectionHeader
          title={<><i className="bi bi-chat-text mr-2"></i>Draft Message</>}
          actions={
            <button
              className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
              onClick={onClose}
            >
              <i className="bi bi-x-lg"></i>
            </button>
          }
          className="mb-3"
        />

        {isLoading ? (
          <div className="text-center py-4 text-muted-foreground">
            <LogoSpinner size={32} message="Generating draft..." layout="stacked" />
          </div>
        ) : draftMessage ? (
          <>
            <div className="mb-3">
              <div className="stat-label mb-1">Channel</div>
              <div className="text-foreground text-sm">
                {draftMessage.channel === 'slack' ? '💬 Slack' : '📧 Email'}
              </div>
            </div>

            {draftMessage.subject && (
              <div className="mb-3">
                <div className="stat-label mb-1">Subject</div>
                <div className="text-foreground text-sm">
                  {draftMessage.subject}
                </div>
              </div>
            )}

            <div className="mb-3">
              <div className="stat-label mb-1">Message</div>
              <div className="p-3 rounded bg-white/5 border border-white/10 text-foreground text-sm whitespace-pre-wrap leading-relaxed">
                {draftMessage.body}
              </div>
            </div>

            <button
              className="w-full px-4 py-2 bg-accent text-white rounded hover:bg-accent/90 transition-colors"
              onClick={() => navigator.clipboard.writeText(draftMessage.body)}
            >
              <i className="bi bi-clipboard mr-2"></i>
              Copy to Clipboard
            </button>
          </>
        ) : (
          <div className="text-center py-4 text-muted-foreground">
            No draft available
          </div>
        )}
      </div>
    </div>
  );
}

// Collapsible Severity Group Component
function SeverityGroup({
  severity,
  insights,
  factPack,
  onCreateAction,
  onDraftMessage,
  onViewEvidence,
  createdActionIds,
  defaultExpanded = false
}: {
  severity: 'P0' | 'P1' | 'P2';
  insights: AICopilotInsight[];
  factPack: VelocityFactPack;
  onCreateAction: (insight: AICopilotInsight) => void;
  onDraftMessage: (insight: AICopilotInsight) => void;
  onViewEvidence: (insight: AICopilotInsight) => void;
  createdActionIds: Set<string>;
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  if (insights.length === 0) return null;

  const config = {
    P0: { label: 'Blocking', bgClass: 'bg-bad/10', borderClass: 'border-bad/30', textClass: 'text-bad' },
    P1: { label: 'Risks', bgClass: 'bg-warn/10', borderClass: 'border-warn/30', textClass: 'text-warn' },
    P2: { label: 'Optimizations', bgClass: 'bg-good/10', borderClass: 'border-good/30', textClass: 'text-good' }
  };
  const style = config[severity];

  return (
    <div className={`rounded-lg border ${style.borderClass} ${style.bgClass} mb-3`}>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-2 text-left"
      >
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium font-mono ${style.bgClass} ${style.textClass}`}>
            {severity}
          </span>
          <span className={`text-sm font-medium ${style.textClass}`}>
            {style.label}
          </span>
          <span className="text-muted-foreground text-xs">
            ({insights.length})
          </span>
        </div>
        <i className={`bi bi-chevron-down ${style.textClass} transition-transform ${expanded ? 'rotate-180' : ''}`}></i>
      </button>

      {expanded && (
        <div className="px-3 pb-3">
          {insights.map(insight => (
            <AIInsightCard
              key={insight.id}
              insight={insight}
              chartData={getChartDataForInsight(insight, factPack)}
              onCreateAction={onCreateAction}
              onDraftMessage={onDraftMessage}
              onViewEvidence={onViewEvidence}
              createdActionIds={createdActionIds}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Main Copilot Panel Component
export function VelocityCopilotPanelV2({
  metrics,
  requisitions,
  candidates,
  events,
  filters,
  aiConfig,
  onAddToActionQueue,
  onViewEvidence
}: VelocityCopilotPanelV2Props) {
  const [isLoading, setIsLoading] = useState(false);
  const [insights, setInsights] = useState<AICopilotInsight[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<'ai' | 'deterministic' | null>(null);
  const [createdActionIds, setCreatedActionIds] = useState<Set<string>>(new Set());

  // Draft message state
  const [draftModalOpen, setDraftModalOpen] = useState(false);
  const [draftMessage, setDraftMessage] = useState<DraftMessage | null>(null);
  const [isDraftLoading, setIsDraftLoading] = useState(false);

  // Build fact pack (memoized)
  const factPack = useMemo(() => {
    return buildVelocityFactPack(metrics, requisitions, candidates, events, filters);
  }, [metrics, requisitions, candidates, events, filters]);

  // Check if AI is available (has config with API key)
  const hasAI = Boolean(aiConfig?.apiKey);

  // Track if we've auto-generated to avoid repeated calls
  const [hasAutoGenerated, setHasAutoGenerated] = useState(false);

  // Generate AI insights
  const handleGenerateAI = useCallback(async () => {
    if (!aiConfig?.apiKey) return;

    setIsLoading(true);
    setError(null);
    setSource('ai');

    try {
      const response = await generateAIInsights(factPack, aiConfig);
      if (response.error) {
        setError(response.error);
        setInsights([]);
      } else {
        setInsights(response.insights);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate insights');
      setInsights([]);
    } finally {
      setIsLoading(false);
    }
  }, [aiConfig, factPack]);

  // Generate deterministic summary
  const handleGenerateDeterministic = useCallback(() => {
    setIsLoading(true);
    setError(null);
    setSource('deterministic');

    try {
      const summary = generateDeterministicSummary(factPack);
      setInsights(summary.insights);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate summary');
      setInsights([]);
    } finally {
      setIsLoading(false);
    }
  }, [factPack]);

  // Auto-generate AI insights when AI is enabled and there's data to analyze
  const hasData = factPack.sample_sizes.total_reqs > 0 || factPack.sample_sizes.total_offers > 0;

  useEffect(() => {
    if (hasAI && !hasAutoGenerated && !isLoading && insights.length === 0 && hasData) {
      setHasAutoGenerated(true);
      handleGenerateAI();
    }
  }, [hasAI, hasAutoGenerated, isLoading, insights.length, hasData, handleGenerateAI]);

  // Create action from AI insight
  const handleCreateAction = useCallback((insight: AICopilotInsight) => {
    if (!onAddToActionQueue) return;
    if (createdActionIds.has(insight.id)) return;

    const actionItem: ActionItem = {
      action_id: `ai_copilot_${insight.id}`,
      action_type: 'PROCESS_OPTIMIZATION',
      owner_type: 'TA_OPS',
      owner_id: 'velocity_copilot',
      owner_name: 'Velocity Copilot',
      req_id: ((insight.deep_link_params?.filter as { req_ids?: string[] })?.req_ids?.[0]) || 'N/A',
      title: insight.title,
      priority: insight.severity,
      due_in_days: insight.severity === 'P0' ? 3 : insight.severity === 'P1' ? 7 : 14,
      due_date: new Date(Date.now() + (insight.severity === 'P0' ? 3 : insight.severity === 'P1' ? 7 : 14) * 24 * 60 * 60 * 1000),
      created_at: new Date(),
      status: 'OPEN',
      evidence: {
        kpi_key: insight.citations[0] || 'velocity_copilot',
        explain_provider_key: 'velocity_copilot',
        short_reason: `${insight.claim} Citations: ${insight.citations.join(', ')}`
      },
      recommended_steps: insight.recommended_actions
    };

    onAddToActionQueue(actionItem);
    setCreatedActionIds(prev => new Set(prev).add(insight.id));
  }, [onAddToActionQueue, createdActionIds]);

  // Draft message
  const handleDraftMessage = useCallback(async (insight: AICopilotInsight) => {
    setDraftModalOpen(true);
    setIsDraftLoading(true);
    setDraftMessage(null);

    try {
      if (aiConfig?.apiKey) {
        const draft = await generateDraftMessage(insight, 'Hiring Manager', 'slack', aiConfig);
        setDraftMessage(draft);
      } else {
        const draft = generateDeterministicDraftMessage(insight, 'Hiring Manager', 'slack');
        setDraftMessage(draft);
      }
    } catch (err) {
      setDraftMessage({
        channel: 'slack',
        recipient_role: 'Hiring Manager',
        body: `[Error generating draft] ${insight.claim}`,
        insight_context: insight.title
      });
    } finally {
      setIsDraftLoading(false);
    }
  }, [aiConfig]);

  // View evidence - convert AI insight to VelocityInsight format
  const handleViewEvidence = useCallback((insight: AICopilotInsight) => {
    if (!onViewEvidence) return;

    // Extract metric name from first citation
    const firstCitation = insight.citations[0] || '';
    const metricName = firstCitation.split(':')[0]
      ?.replace(/_/g, ' ')
      ?.replace(/\b\w/g, c => c.toUpperCase()) || insight.title;

    // Extract contributing items from deep_link_params
    const rawItems = insight.deep_link_params?.contributing_items as
      Array<{ id: string; title?: string; type: string; value?: string }> | undefined;
    const contributingItems = rawItems?.map(item => ({
      id: item.id,
      title: item.title,
      type: item.type,
      value: item.value
    }));

    const velocityInsight: VelocityInsight = {
      type: insight.severity === 'P0' ? 'warning' : insight.severity === 'P1' ? 'warning' : 'info',
      title: insight.title,
      description: insight.claim,
      metric: metricName,
      evidence: insight.citations.join(', '),
      sampleSize: insight.deep_link_params?.sample_size as number | undefined,
      soWhat: insight.why_now,
      nextStep: insight.recommended_actions[0],
      confidence: insight.severity === 'P0' ? 'HIGH' : insight.severity === 'P1' ? 'MED' : 'LOW',
      contributingItems: contributingItems
    };

    onViewEvidence(velocityInsight);
  }, [onViewEvidence]);

  return (
    <div className="glass-panel p-3 mb-4" data-testid="velocity-copilot-panel">
      {/* Simplified Header - one line, no redundancy */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span
            className={`w-6 h-6 rounded flex items-center justify-center text-xs ${isLoading ? 'ai-enabled-glow' : ''} ${source === 'ai' ? 'bg-purple-500/15' : 'bg-blue-500/15'}`}
          >
            {source === 'ai' ? '✨' : '📊'}
          </span>
          <h6 className="mb-0 text-sm font-semibold text-foreground">
            Velocity Insights
            {insights.length > 0 && !isLoading && (
              <span className="font-normal text-muted-foreground ml-1.5">
                ({insights.length})
              </span>
            )}
          </h6>
        </div>

        <div className="flex gap-2">
          {isLoading ? (
            <span className="text-muted-foreground text-xs flex items-center">
              <span className="w-4 h-4 border-2 border-current border-r-transparent rounded-full animate-spin inline-block mr-1" role="status" />
              Analyzing...
            </span>
          ) : (
            <button
              className={`p-0 bg-transparent border-0 hover:underline text-xs ${hasAI ? 'text-accent' : 'text-muted-foreground'}`}
              onClick={handleGenerateAI}
              disabled={!hasAI}
              title={hasAI ? 'Regenerate with AI' : 'Configure AI key in Settings'}
              data-testid="generate-ai-btn"
            >
              <i className="bi bi-arrow-clockwise mr-1"></i>
              Refresh
            </button>
          )}
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-3 rounded-lg bg-bad/10 border border-bad/30 text-bad mb-3">
          <i className="bi bi-exclamation-triangle mr-2"></i>
          {error}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && insights.length === 0 && !error && (
        <div className="text-center py-4 text-muted-foreground">
          <i className="bi bi-graph-up text-2xl opacity-50 block mb-2"></i>
          <p className="mt-2 mb-2 text-sm">
            Analyze your velocity data
          </p>
          <div className="flex gap-2 justify-center">
            {hasAI && (
              <button
                className="px-3 py-1.5 text-xs bg-accent text-white rounded hover:bg-accent/90 transition-colors"
                onClick={handleGenerateAI}
                data-testid="generate-ai-empty-btn"
              >
                <i className="bi bi-stars mr-1"></i>
                AI Analysis
              </button>
            )}
            <button
              className="px-3 py-1.5 text-xs bg-muted/30 border border-border rounded hover:bg-muted/50 text-foreground transition-colors"
              onClick={handleGenerateDeterministic}
              data-testid="generate-deterministic-btn"
            >
              <i className="bi bi-calculator mr-1"></i>
              Quick Analysis
            </button>
          </div>
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="text-center py-4 text-muted-foreground">
          <LogoSpinner size={32} message="Analyzing velocity data..." layout="stacked" />
        </div>
      )}

      {/* Insights - grouped by severity with collapsible sections */}
      {!isLoading && insights.length > 0 && (
        <>
          {/* P0 Blocking - expanded by default */}
          <SeverityGroup
            severity="P0"
            insights={insights.filter(i => i.severity === 'P0')}
            factPack={factPack}
            onCreateAction={handleCreateAction}
            onDraftMessage={handleDraftMessage}
            onViewEvidence={handleViewEvidence}
            createdActionIds={createdActionIds}
            defaultExpanded={true}
          />

          {/* P1 Risks - collapsed by default */}
          <SeverityGroup
            severity="P1"
            insights={insights.filter(i => i.severity === 'P1')}
            factPack={factPack}
            onCreateAction={handleCreateAction}
            onDraftMessage={handleDraftMessage}
            onViewEvidence={handleViewEvidence}
            createdActionIds={createdActionIds}
            defaultExpanded={false}
          />

          {/* P2 Optimizations - collapsed by default */}
          <SeverityGroup
            severity="P2"
            insights={insights.filter(i => i.severity === 'P2')}
            factPack={factPack}
            onCreateAction={handleCreateAction}
            onDraftMessage={handleDraftMessage}
            onViewEvidence={handleViewEvidence}
            createdActionIds={createdActionIds}
            defaultExpanded={false}
          />
        </>
      )}

      {/* Draft Message Modal */}
      <DraftMessageModal
        isOpen={draftModalOpen}
        onClose={() => setDraftModalOpen(false)}
        draftMessage={draftMessage}
        isLoading={isDraftLoading}
      />
    </div>
  );
}

// Backwards-compatible alias
export const VelocityCopilotPanel = VelocityCopilotPanelV2;

export default VelocityCopilotPanelV2;
