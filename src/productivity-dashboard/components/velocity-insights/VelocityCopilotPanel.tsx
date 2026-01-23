/**
 * Velocity Copilot Panel
 * AI-powered insights panel for the Velocity tab
 * Design aligned with Control Tower tab patterns
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  VelocityFactPack,
  AICopilotInsight,
  AICopilotResponse,
  DeterministicSummary,
  DraftMessage
} from '../../types/velocityCopilotTypes';
import { VelocityMetrics, Requisition, Candidate, Event, MetricFilters, VelocityInsight } from '../../types';
import { AiProviderConfig } from '../../types/aiTypes';
import { ActionItem } from '../../types/actionTypes';
import { SectionHeader } from '../common/SectionHeader';
import { LogoSpinner } from '../common/LogoSpinner';
import {
  buildVelocityFactPack,
  generateAIInsights,
  generateDeterministicSummary,
  generateDraftMessage,
  generateDeterministicDraftMessage
} from '../../services/velocityCopilotService';
import {
  getCitationLabel,
  shouldCollapseCitations,
  getCitationsSummary
} from '../../services/citationLabelService';
import { getChartDataForInsight, ChartData } from '../../services/insightChartService';
import { MiniChart } from './MiniCharts';

interface VelocityCopilotPanelProps {
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
    P0: { bg: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', label: 'Blocking' },
    P1: { bg: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', label: 'Risk' },
    P2: { bg: 'rgba(34, 197, 94, 0.15)', color: '#22c55e', label: 'Optimize' }
  };
  const style = config[severity];

  return (
    <span
      className="badge font-mono"
      style={{ background: style.bg, color: style.color }}
    >
      {severity} · {style.label}
    </span>
  );
}

// Citation badge component - displays human-readable labels
function CitationBadge({ citation }: { citation: string }) {
  const label = getCitationLabel(citation);
  return (
    <span
      className="badge"
      style={{
        background: 'rgba(96, 165, 250, 0.1)',
        color: '#60a5fa',
        fontSize: '0.65rem',
        fontWeight: 500,
        marginRight: '0.25rem',
        marginBottom: '0.25rem'
      }}
      title={citation}  // Show technical path on hover for debugging
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
    // Show collapsed summary with click to expand
    return (
      <button
        className="btn btn-link p-0 ms-2"
        onClick={onViewEvidence}
        style={{
          fontSize: '0.7rem',
          color: '#60a5fa',
          textDecoration: 'none',
          verticalAlign: 'middle'
        }}
        title="Click to see evidence"
      >
        <i className="bi bi-database me-1" style={{ fontSize: '0.6rem' }}></i>
        {getCitationsSummary(citations)}
      </button>
    );
  }

  // Show inline badges for 1-3 citations
  return (
    <span className="ms-2 d-inline-flex flex-wrap align-items-center gap-1">
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
  const borderColor = insight.severity === 'P0' ? 'var(--color-bad)' :
                      insight.severity === 'P1' ? 'var(--color-warn)' : 'var(--color-good)';

  return (
    <div
      className="glass-panel p-3 mb-3"
      style={{ borderLeft: `3px solid ${borderColor}` }}
    >
      {/* Header row with severity, title, and mini chart */}
      <div className="d-flex align-items-start justify-content-between gap-3 mb-2">
        <div className="flex-grow-1">
          <div className="d-flex align-items-center gap-2 mb-1 flex-wrap">
            <SeverityBadge severity={insight.severity} />
            <span className="fw-semibold" style={{ color: 'var(--text-primary)', fontSize: '0.875rem' }}>
              {insight.title}
            </span>
          </div>
          {/* Claim text */}
          <p className="mb-0" style={{ color: 'var(--text-primary)', fontSize: '0.85rem', lineHeight: 1.5 }}>
            {insight.claim}
          </p>
        </div>

        {/* Mini chart on the right */}
        {chartData.type !== 'none' && (
          <div className="flex-shrink-0">
            <MiniChart data={chartData} width={140} height={55} />
          </div>
        )}
      </div>

      {/* Why Now + recommended action */}
      <p className="mb-2" style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
        {insight.why_now}
        {insight.recommended_actions[0] && (
          <span style={{ color: 'var(--accent)', marginLeft: '6px' }}>
            → {insight.recommended_actions[0]}
          </span>
        )}
      </p>

      {/* Action Buttons */}
      <div className="d-flex gap-2 flex-wrap align-items-center">
        <button
          className="btn btn-sm btn-bespoke-secondary"
          onClick={() => onCreateAction(insight)}
          disabled={isActionCreated}
          style={isActionCreated ? { opacity: 0.5 } : {}}
          data-testid="create-action-btn"
        >
          <i className={`bi ${isActionCreated ? 'bi-check-circle' : 'bi-plus-circle'} me-1`}></i>
          {isActionCreated ? 'Added' : 'Action'}
        </button>

        <button
          className="btn btn-sm btn-bespoke-secondary"
          onClick={() => onDraftMessage(insight)}
          data-testid="draft-message-btn"
        >
          <i className="bi bi-chat-text me-1"></i>
          Draft
        </button>

        <button
          className="btn btn-sm btn-bespoke-secondary"
          onClick={() => onViewEvidence(insight)}
          data-testid="view-evidence-btn"
        >
          <i className="bi bi-eye me-1"></i>
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
      className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
      style={{ background: 'rgba(0,0,0,0.7)', zIndex: 1060 }}
      onClick={onClose}
    >
      <div
        className="glass-panel p-4"
        style={{
          width: '500px',
          maxWidth: '90vw',
          maxHeight: '80vh',
          overflow: 'auto'
        }}
        onClick={e => e.stopPropagation()}
      >
        <SectionHeader
          title={<><i className="bi bi-chat-text me-2"></i>Draft Message</>}
          actions={
            <button
              className="btn btn-sm"
              onClick={onClose}
              style={{ color: 'var(--color-text-secondary)' }}
            >
              <i className="bi bi-x-lg"></i>
            </button>
          }
          className="mb-3"
        />

        {isLoading ? (
          <div className="text-center py-4" style={{ color: 'var(--color-text-secondary)' }}>
            <LogoSpinner size={32} message="Generating draft..." layout="stacked" />
          </div>
        ) : draftMessage ? (
          <>
            <div className="mb-3">
              <div className="stat-label mb-1">Channel</div>
              <div style={{ color: 'var(--color-text-primary)', fontSize: '0.85rem' }}>
                {draftMessage.channel === 'slack' ? '💬 Slack' : '📧 Email'}
              </div>
            </div>

            {draftMessage.subject && (
              <div className="mb-3">
                <div className="stat-label mb-1">Subject</div>
                <div style={{ color: 'var(--color-text-primary)', fontSize: '0.85rem' }}>
                  {draftMessage.subject}
                </div>
              </div>
            )}

            <div className="mb-3">
              <div className="stat-label mb-1">Message</div>
              <div
                className="p-3 rounded"
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  color: 'var(--color-text-primary)',
                  fontSize: '0.85rem',
                  whiteSpace: 'pre-wrap',
                  lineHeight: 1.6,
                  border: '1px solid rgba(255, 255, 255, 0.1)'
                }}
              >
                {draftMessage.body}
              </div>
            </div>

            <button
              className="btn btn-bespoke-primary w-100"
              onClick={() => navigator.clipboard.writeText(draftMessage.body)}
            >
              <i className="bi bi-clipboard me-2"></i>
              Copy to Clipboard
            </button>
          </>
        ) : (
          <div className="text-center py-4" style={{ color: 'var(--color-text-secondary)' }}>
            No draft available
          </div>
        )}
      </div>
    </div>
  );
}

// Main Copilot Panel Component
export function VelocityCopilotPanel({
  metrics,
  requisitions,
  candidates,
  events,
  filters,
  aiConfig,
  onAddToActionQueue,
  onViewEvidence
}: VelocityCopilotPanelProps) {
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

    // Extract metric name from first citation (e.g., "decay_rate:15%" -> "Decay Rate")
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
      <div className="d-flex align-items-center justify-content-between mb-3">
        <div className="d-flex align-items-center gap-2">
          <span
            className={isLoading ? 'ai-enabled-glow' : ''}
            style={{
              width: 24,
              height: 24,
              background: source === 'ai' ? 'rgba(139, 92, 246, 0.15)' : 'rgba(96, 165, 250, 0.15)',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.8rem',
            }}
          >
            {source === 'ai' ? '✨' : '📊'}
          </span>
          <h6 className="mb-0" style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            Velocity Insights
            {insights.length > 0 && !isLoading && (
              <span style={{ fontWeight: 400, color: 'var(--text-muted)', marginLeft: '6px' }}>
                ({insights.length})
              </span>
            )}
          </h6>
        </div>

        <div className="d-flex gap-2">
          {isLoading ? (
            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              <span className="spinner-border spinner-border-sm me-1" role="status" />
              Analyzing...
            </span>
          ) : (
            <>
              <button
                className="btn btn-sm btn-link p-0"
                onClick={handleGenerateAI}
                disabled={!hasAI}
                title={hasAI ? 'Regenerate with AI' : 'Configure AI key in Settings'}
                style={{ color: hasAI ? 'var(--accent)' : 'var(--text-muted)', fontSize: '0.75rem' }}
                data-testid="generate-ai-btn"
              >
                <i className="bi bi-arrow-clockwise me-1"></i>
                Refresh
              </button>
            </>
          )}
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="alert alert-danger mb-3">
          <i className="bi bi-exclamation-triangle me-2"></i>
          {error}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && insights.length === 0 && !error && (
        <div className="text-center py-4" style={{ color: 'var(--text-secondary)' }}>
          <i className="bi bi-graph-up" style={{ fontSize: '1.5rem', opacity: 0.5 }}></i>
          <p className="mt-2 mb-2" style={{ fontSize: '0.85rem' }}>
            Analyze your velocity data
          </p>
          <div className="d-flex gap-2 justify-content-center">
            {hasAI && (
              <button
                className="btn btn-sm btn-bespoke-primary"
                onClick={handleGenerateAI}
                data-testid="generate-ai-empty-btn"
              >
                <i className="bi bi-stars me-1"></i>
                AI Analysis
              </button>
            )}
            <button
              className="btn btn-sm btn-bespoke-secondary"
              onClick={handleGenerateDeterministic}
              data-testid="generate-deterministic-btn"
            >
              <i className="bi bi-calculator me-1"></i>
              Quick Analysis
            </button>
          </div>
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="text-center py-4" style={{ color: 'var(--text-secondary)' }}>
          <LogoSpinner size={32} message="Analyzing velocity data..." layout="stacked" />
        </div>
      )}

      {/* Insights - directly rendered, no intermediate banner */}
      {!isLoading && insights.length > 0 && (
        <>
          {insights.map(insight => (
            <AIInsightCard
              key={insight.id}
              insight={insight}
              chartData={getChartDataForInsight(insight, factPack)}
              onCreateAction={handleCreateAction}
              onDraftMessage={handleDraftMessage}
              onViewEvidence={handleViewEvidence}
              createdActionIds={createdActionIds}
            />
          ))}
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
