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
import {
  buildVelocityFactPack,
  generateAIInsights,
  generateDeterministicSummary,
  generateDraftMessage,
  generateDeterministicDraftMessage
} from '../../services/velocityCopilotService';

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

// Citation badge component
function CitationBadge({ citation }: { citation: string }) {
  return (
    <span
      className="badge font-mono"
      style={{
        background: 'rgba(96, 165, 250, 0.1)',
        color: '#60a5fa',
        fontSize: '0.6rem'
      }}
    >
      {citation}
    </span>
  );
}

// AI Insight Card component - compact design matching Control Tower patterns
function AIInsightCard({
  insight,
  onCreateAction,
  onDraftMessage,
  onViewEvidence,
  createdActionIds
}: {
  insight: AICopilotInsight;
  onCreateAction: (insight: AICopilotInsight) => void;
  onDraftMessage: (insight: AICopilotInsight) => void;
  onViewEvidence: (insight: AICopilotInsight) => void;
  createdActionIds: Set<string>;
}) {
  const isActionCreated = createdActionIds.has(insight.id);
  const borderColor = insight.severity === 'P0' ? '#ef4444' :
                      insight.severity === 'P1' ? '#f59e0b' : '#22c55e';

  return (
    <div
      className="glass-panel p-3 mb-3"
      style={{ borderLeft: `3px solid ${borderColor}` }}
    >
      {/* Header with severity and title */}
      <div className="d-flex align-items-center gap-2 mb-2 flex-wrap">
        <SeverityBadge severity={insight.severity} />
        <span className="fw-semibold" style={{ color: 'var(--color-text-primary)', fontSize: '0.875rem' }}>
          {insight.title}
        </span>
      </div>

      {/* Claim with inline citations */}
      <p className="mb-2" style={{ color: 'var(--color-text-primary)', fontSize: '0.85rem', lineHeight: 1.5 }}>
        {insight.claim}
        {insight.citations.length > 0 && (
          <span className="ms-2">
            {insight.citations.map((citation, idx) => (
              <CitationBadge key={idx} citation={citation} />
            ))}
          </span>
        )}
      </p>

      {/* Why Now + First recommended action inline */}
      <p className="mb-2" style={{ color: 'var(--color-text-secondary)', fontSize: '0.8rem' }}>
        <span style={{ fontStyle: 'italic' }}>{insight.why_now}</span>
        {insight.recommended_actions[0] && (
          <span style={{ color: 'var(--color-accent)', marginLeft: '8px' }}>
            → {insight.recommended_actions[0]}
          </span>
        )}
      </p>

      {/* Action Buttons - compact */}
      <div className="d-flex gap-2 flex-wrap">
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
            <div className="spinner-border spinner-border-sm me-2" role="status"></div>
            Generating draft...
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

    const velocityInsight: VelocityInsight = {
      type: insight.severity === 'P0' ? 'warning' : insight.severity === 'P1' ? 'warning' : 'info',
      title: insight.title,
      description: insight.claim,
      metric: metricName,
      evidence: insight.citations.join(', '),
      sampleSize: insight.deep_link_params?.sample_size as number | undefined,
      soWhat: insight.why_now,
      nextStep: insight.recommended_actions[0],
      confidence: insight.severity === 'P0' ? 'HIGH' : insight.severity === 'P1' ? 'MED' : 'LOW'
    };

    onViewEvidence(velocityInsight);
  }, [onViewEvidence]);

  return (
    <div className="glass-panel p-3 mb-4" data-testid="velocity-copilot-panel">
      {/* Header - matches KEY INSIGHTS section styling */}
      <div className="d-flex align-items-center justify-content-between mb-3">
        <div className="d-flex align-items-center gap-2">
          <span
            className={hasAI && isLoading ? 'ai-enabled-glow' : ''}
            style={{
              width: 28,
              height: 28,
              background: hasAI ? 'rgba(139, 92, 246, 0.15)' : 'rgba(96, 165, 250, 0.15)',
              border: hasAI ? '1px solid rgba(139, 92, 246, 0.3)' : 'none',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.9rem',
            }}
          >
            {hasAI ? '✨' : '📊'}
          </span>
          <div>
            <div className="d-flex align-items-center gap-2">
              <h6 className="mb-0" style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f5f5f5' }}>
                Velocity Copilot
              </h6>
              {hasAI && <span className="ai-powered-badge"><i className="bi bi-stars"></i> AI</span>}
            </div>
            <small style={{ color: '#6b7280', fontSize: '0.7rem' }}>
              {isLoading && source === 'ai'
                ? <span className="ai-generating"><i className="bi bi-lightning-charge-fill"></i> Generating insights...</span>
                : hasAI
                  ? (insights.length > 0 ? `${insights.length} insight${insights.length !== 1 ? 's' : ''} ready` : 'AI-powered analysis')
                  : 'Deterministic analysis'}
            </small>
          </div>
        </div>

        <div className="d-flex gap-2">
          {hasAI && (
            <button
              className="btn btn-sm btn-bespoke-primary"
              onClick={handleGenerateAI}
              disabled={isLoading}
              data-testid="generate-ai-btn"
            >
              {isLoading && source === 'ai' ? (
                <>
                  <span className="spinner-border spinner-border-sm me-1" role="status"></span>
                  Generating...
                </>
              ) : (
                <>
                  <i className="bi bi-stars me-1"></i>
                  AI Insights
                </>
              )}
            </button>
          )}

          <button
            className="btn btn-sm btn-bespoke-secondary"
            onClick={handleGenerateDeterministic}
            disabled={isLoading}
            data-testid="generate-deterministic-btn"
          >
            {isLoading && source === 'deterministic' ? (
              <>
                <span className="spinner-border spinner-border-sm me-1" role="status"></span>
                Generating...
              </>
            ) : (
              <>
                <i className="bi bi-calculator me-1"></i>
                Deterministic
              </>
            )}
          </button>
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
        <div className="text-center py-4" style={{ color: 'var(--color-text-secondary)' }}>
          <i className="bi bi-lightbulb" style={{ fontSize: '2rem', opacity: 0.5 }}></i>
          <p className="mt-2 mb-0" style={{ fontSize: '0.85rem' }}>
            {hasAI
              ? 'Click "AI Insights" or "Deterministic" to analyze your velocity data.'
              : 'Click "Deterministic" to generate insights from your data.'}
          </p>
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="text-center py-4" style={{ color: 'var(--color-text-secondary)' }}>
          <div className="spinner-border spinner-border-sm me-2" role="status"></div>
          Analyzing velocity data...
        </div>
      )}

      {/* Insights */}
      {!isLoading && insights.length > 0 && (
        <>
          <div className="mb-3 d-flex align-items-center gap-2">
            <span
              className="badge"
              style={{
                background: source === 'ai' ? 'rgba(139, 92, 246, 0.15)' : 'rgba(96, 165, 250, 0.15)',
                color: source === 'ai' ? '#8b5cf6' : '#60a5fa'
              }}
            >
              {source === 'ai' ? '✨ AI Generated' : '📊 Deterministic'}
            </span>
            <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.8rem' }}>
              {insights.length} insight{insights.length !== 1 ? 's' : ''} generated
            </span>
          </div>

          {insights.map(insight => (
            <AIInsightCard
              key={insight.id}
              insight={insight}
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
