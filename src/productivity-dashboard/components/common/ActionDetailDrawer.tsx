// Action Detail Drawer Component
// Shows full action details with evidence linking and status actions
// Includes AI Draft Message feature (requires AI provider to be configured)

import React, { useState, useCallback } from 'react';
import { format } from 'date-fns';
import {
  ActionItem,
  ActionStatus,
  PRIORITY_META,
  OWNER_TYPE_META,
} from '../../types/actionTypes';
import { ExplainProviderId } from '../../types/explainTypes';
import { useDashboard } from '../../hooks/useDashboardContext';
import { useDraftMessage, MessageChannel, DraftMessageResult } from '../../services/aiCopilotService';

interface ActionDetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  action: ActionItem | null;
  onMarkDone: (actionId: string) => void;
  onDismiss: (actionId: string) => void;
  onViewEvidence: (providerId: ExplainProviderId) => void;
}

export function ActionDetailDrawer({
  isOpen,
  onClose,
  action,
  onMarkDone,
  onDismiss,
  onViewEvidence,
}: ActionDetailDrawerProps) {
  const { aiConfig, isAiEnabled } = useDashboard();
  const draftMessage = useDraftMessage();
  const [selectedChannel, setSelectedChannel] = useState<MessageChannel>('slack');

  // Generate draft message handler
  const generateDraft = draftMessage.generate;
  const handleGenerateDraft = useCallback(async () => {
    if (!aiConfig || !action) return;
    await generateDraft(aiConfig, action, selectedChannel);
  }, [aiConfig, action, selectedChannel, generateDraft]);

  // Reset draft when drawer closes
  const resetDraft = draftMessage.reset;
  React.useEffect(() => {
    if (!isOpen) {
      resetDraft();
    }
  }, [isOpen, resetDraft]);

  if (!action) return null;

  const priorityMeta = PRIORITY_META[action.priority];
  const ownerMeta = OWNER_TYPE_META[action.owner_type];

  // Check if evidence is available
  const hasEvidence = action.evidence.explain_provider_key &&
    ['median_ttf', 'hm_latency', 'stalled_reqs', 'offer_accept_rate', 'time_to_offer'].includes(
      action.evidence.explain_provider_key
    );

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
          <div className="d-flex align-items-center gap-2">
            <div
              style={{
                width: '4px',
                height: '24px',
                backgroundColor: priorityMeta.color,
                borderRadius: '2px',
              }}
            />
            <div>
              <div
                className="small text-uppercase"
                style={{ color: 'var(--text-secondary)', letterSpacing: '0.05em' }}
              >
                Action Detail
              </div>
              <h5 className="mb-0" style={{ color: 'var(--text-primary)' }}>
                {action.title}
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
          {/* Status Banner */}
          {action.status !== 'OPEN' && (
            <div
              className="p-2 rounded mb-3 text-center"
              style={{
                backgroundColor: action.status === 'DONE'
                  ? 'rgba(34, 197, 94, 0.15)'
                  : 'rgba(107, 114, 128, 0.15)',
                border: `1px solid ${action.status === 'DONE' ? '#22c55e' : '#6b7280'}30`,
                color: action.status === 'DONE' ? '#22c55e' : '#6b7280',
              }}
            >
              <i className={`bi ${action.status === 'DONE' ? 'bi-check-circle' : 'bi-x-circle'} me-1`}></i>
              {action.status === 'DONE' ? 'Marked as Done' : 'Dismissed'}
            </div>
          )}

          {/* Priority & Due */}
          <div className="d-flex justify-content-between align-items-center mb-4">
            <div className="d-flex align-items-center gap-2">
              <span
                className="badge"
                style={{
                  backgroundColor: priorityMeta.bgColor,
                  color: priorityMeta.color,
                  fontSize: '0.75rem',
                }}
              >
                {action.priority} - {priorityMeta.label}
              </span>
              <span
                className="badge"
                style={{
                  backgroundColor: `${ownerMeta.color}20`,
                  color: ownerMeta.color,
                  fontSize: '0.75rem',
                }}
              >
                {ownerMeta.label}
              </span>
            </div>
            <div
              className="text-end small"
              style={{
                color: action.due_in_days <= 0 ? '#ef4444' : 'var(--text-secondary)',
              }}
            >
              {action.due_in_days <= 0 ? (
                <span className="fw-bold">Overdue</span>
              ) : (
                <>Due in {action.due_in_days} day{action.due_in_days !== 1 ? 's' : ''}</>
              )}
              <div style={{ fontSize: '0.7rem' }}>
                {format(action.due_date, 'MMM d, yyyy')}
              </div>
            </div>
          </div>

          {/* Owner Section */}
          <SectionHeader>Owner</SectionHeader>
          <div
            className="p-2 rounded mb-4"
            style={{
              backgroundColor: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            <div style={{ color: 'var(--text-primary)' }}>{action.owner_name}</div>
            <div className="small" style={{ color: 'var(--text-secondary)' }}>
              {ownerMeta.label}
            </div>
          </div>

          {/* Context Section */}
          {action.req_id !== 'general' && (
            <>
              <SectionHeader>Context</SectionHeader>
              <div
                className="p-2 rounded mb-4"
                style={{
                  backgroundColor: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                }}
              >
                {action.req_title && (
                  <div className="mb-1">
                    <span className="small" style={{ color: 'var(--text-secondary)' }}>Req: </span>
                    <span style={{ color: 'var(--text-primary)' }}>{action.req_title}</span>
                  </div>
                )}
                {action.candidate_name && (
                  <div>
                    <span className="small" style={{ color: 'var(--text-secondary)' }}>Candidate: </span>
                    <span style={{ color: 'var(--text-primary)' }}>{action.candidate_name}</span>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Evidence Section */}
          <SectionHeader>Evidence</SectionHeader>
          <div
            className="p-2 rounded mb-2"
            style={{
              backgroundColor: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            <div className="mb-1">
              <span className="small" style={{ color: 'var(--text-secondary)' }}>KPI: </span>
              <span style={{ color: 'var(--text-primary)' }}>{action.evidence.kpi_key}</span>
            </div>
            <div>
              <span className="small" style={{ color: 'var(--text-secondary)' }}>Reason: </span>
              <span style={{ color: 'var(--text-primary)' }}>{action.evidence.short_reason}</span>
            </div>
          </div>

          {hasEvidence ? (
            <button
              className="btn btn-sm w-100 mb-4"
              onClick={() => onViewEvidence(action.evidence.explain_provider_key as ExplainProviderId)}
              style={{
                backgroundColor: 'rgba(45, 212, 191, 0.1)',
                border: '1px solid rgba(45, 212, 191, 0.3)',
                color: '#2dd4bf',
              }}
            >
              <i className="bi bi-graph-up me-1"></i>
              View Evidence
            </button>
          ) : (
            <div
              className="text-center small mb-4 py-2"
              style={{ color: 'var(--text-secondary)' }}
            >
              <i className="bi bi-info-circle me-1"></i>
              Evidence unavailable
            </div>
          )}

          {/* Recommended Steps */}
          {action.recommended_steps.length > 0 && (
            <>
              <SectionHeader>Recommended Steps</SectionHeader>
              <ul
                className="mb-4 ps-3"
                style={{ color: 'var(--text-primary)', fontSize: '0.875rem' }}
              >
                {action.recommended_steps.map((step, idx) => (
                  <li key={idx} className="mb-1">{step}</li>
                ))}
              </ul>
            </>
          )}

          {/* AI Draft Message Section */}
          {isAiEnabled && (
            <DraftMessageSection
              isLoading={draftMessage.isLoading}
              result={draftMessage.result}
              error={draftMessage.error}
              channel={selectedChannel}
              onChannelChange={setSelectedChannel}
              onGenerate={handleGenerateDraft}
            />
          )}
        </div>

        {/* Footer Actions */}
        {action.status === 'OPEN' && (
          <div
            className="p-3 d-flex gap-2"
            style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}
          >
            <button
              className="btn btn-sm flex-grow-1"
              onClick={() => onMarkDone(action.action_id)}
              style={{
                backgroundColor: 'rgba(34, 197, 94, 0.15)',
                border: '1px solid rgba(34, 197, 94, 0.3)',
                color: '#22c55e',
              }}
            >
              <i className="bi bi-check-lg me-1"></i>
              Mark Done
            </button>
            <button
              className="btn btn-sm flex-grow-1"
              onClick={() => onDismiss(action.action_id)}
              style={{
                backgroundColor: 'rgba(107, 114, 128, 0.15)',
                border: '1px solid rgba(107, 114, 128, 0.3)',
                color: '#9ca3af',
              }}
            >
              <i className="bi bi-x-lg me-1"></i>
              Dismiss
            </button>
          </div>
        )}

        {/* Footer - Timestamps */}
        <div
          className="p-3 small"
          style={{
            borderTop: '1px solid rgba(255,255,255,0.1)',
            color: 'var(--text-secondary)',
          }}
        >
          <div className="d-flex justify-content-between">
            <span>Created: {format(action.created_at, 'MMM d, yyyy')}</span>
            <span>ID: {action.action_id.slice(0, 12)}</span>
          </div>
        </div>
      </div>
    </>
  );
}

// Helper component
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

// AI Draft Message Section Component
interface DraftMessageSectionProps {
  isLoading: boolean;
  result: DraftMessageResult | null;
  error: string | null;
  channel: MessageChannel;
  onChannelChange: (channel: MessageChannel) => void;
  onGenerate: () => void;
}

function DraftMessageSection({
  isLoading,
  result,
  error,
  channel,
  onChannelChange,
  onGenerate,
}: DraftMessageSectionProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    if (result?.draft) {
      navigator.clipboard.writeText(result.draft);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [result?.draft]);

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
          <i className="bi bi-chat-left-text" style={{ color: '#a78bfa' }}></i>
          <span className="small fw-bold" style={{ color: '#a78bfa' }}>Draft Message</span>
        </div>
      </div>

      {/* Channel Selector */}
      {!result && !isLoading && (
        <div className="d-flex gap-2 mb-3">
          <button
            className={`btn btn-sm flex-grow-1 ${channel === 'slack' ? 'active' : ''}`}
            onClick={() => onChannelChange('slack')}
            style={{
              backgroundColor: channel === 'slack' ? 'rgba(139, 92, 246, 0.3)' : 'transparent',
              border: '1px solid rgba(139, 92, 246, 0.4)',
              color: channel === 'slack' ? '#a78bfa' : 'var(--text-secondary)',
              fontSize: '0.75rem',
            }}
          >
            <i className="bi bi-slack me-1"></i>
            Slack
          </button>
          <button
            className={`btn btn-sm flex-grow-1 ${channel === 'email' ? 'active' : ''}`}
            onClick={() => onChannelChange('email')}
            style={{
              backgroundColor: channel === 'email' ? 'rgba(139, 92, 246, 0.3)' : 'transparent',
              border: '1px solid rgba(139, 92, 246, 0.4)',
              color: channel === 'email' ? '#a78bfa' : 'var(--text-secondary)',
              fontSize: '0.75rem',
            }}
          >
            <i className="bi bi-envelope me-1"></i>
            Email
          </button>
        </div>
      )}

      {/* Generate Button */}
      {!result && !isLoading && (
        <button
          className="btn btn-sm w-100"
          onClick={onGenerate}
          style={{
            backgroundColor: 'rgba(139, 92, 246, 0.2)',
            border: '1px solid rgba(139, 92, 246, 0.4)',
            color: '#a78bfa',
            fontSize: '0.8rem',
          }}
        >
          <i className="bi bi-lightning-charge me-1"></i>
          Generate {channel === 'slack' ? 'Slack' : 'Email'} Draft
        </button>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="d-flex align-items-center gap-2 py-2">
          <div
            className="spinner-border spinner-border-sm"
            role="status"
            style={{ color: '#a78bfa' }}
          >
            <span className="visually-hidden">Loading...</span>
          </div>
          <span className="small" style={{ color: 'var(--text-secondary)' }}>
            Drafting message...
          </span>
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
          <div
            className="p-2 rounded mb-2"
            style={{
              backgroundColor: 'rgba(0,0,0,0.2)',
              border: '1px solid rgba(255,255,255,0.1)',
              maxHeight: '200px',
              overflowY: 'auto',
            }}
          >
            <pre
              className="mb-0 small"
              style={{
                color: 'var(--text-primary)',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                fontFamily: 'inherit',
              }}
            >
              {result.draft}
            </pre>
          </div>
          <button
            className="btn btn-sm w-100"
            onClick={handleCopy}
            style={{
              backgroundColor: copied ? 'rgba(34, 197, 94, 0.2)' : 'rgba(139, 92, 246, 0.2)',
              border: `1px solid ${copied ? 'rgba(34, 197, 94, 0.4)' : 'rgba(139, 92, 246, 0.4)'}`,
              color: copied ? '#22c55e' : '#a78bfa',
              fontSize: '0.8rem',
            }}
          >
            <i className={`bi ${copied ? 'bi-check' : 'bi-clipboard'} me-1`}></i>
            {copied ? 'Copied!' : 'Copy to Clipboard'}
          </button>
          <p className="mt-2 mb-0 small" style={{ color: 'var(--text-secondary)' }}>
            <i className="bi bi-info-circle me-1"></i>
            Replace placeholders with actual names before sending.
          </p>
        </div>
      )}
    </div>
  );
}

export default ActionDetailDrawer;
