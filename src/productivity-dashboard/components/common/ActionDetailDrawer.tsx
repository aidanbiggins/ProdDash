// Action Detail Drawer Component
// Shows full action details with evidence linking and status actions
// Includes AI Draft Message feature (requires AI provider to be configured)

import React, { useState, useCallback } from 'react';
import { LogoSpinner } from './LogoSpinner';
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
        className="fixed top-0 left-0 w-full h-full glass-backdrop"
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
        className="fixed top-0 right-0 h-full flex flex-col glass-drawer"
        style={{
          width: '420px',
          maxWidth: '90vw',
          zIndex: 1050,
          transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.3s ease-in-out',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-3 glass-drawer-header">
          <div className="flex items-center gap-2">
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
                className="text-xs uppercase"
                style={{ color: 'var(--text-secondary)', letterSpacing: '0.05em' }}
              >
                Action Detail
              </div>
              <div className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                {action.title}
              </div>
            </div>
          </div>
          <button
            className="px-2 py-1 text-sm"
            onClick={onClose}
            style={{ color: 'var(--text-secondary)' }}
          >
            <i className="bi bi-x-lg"></i>
          </button>
        </div>

        {/* Content */}
        <div className="grow overflow-auto p-3">
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
              <i className={`bi ${action.status === 'DONE' ? 'bi-check-circle' : 'bi-x-circle'} mr-1.5`}></i>
              {action.status === 'DONE' ? 'Marked as Done' : 'Dismissed'}
            </div>
          )}

          {/* Priority & Due */}
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <span
                className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                style={{
                  backgroundColor: priorityMeta.bgColor,
                  color: priorityMeta.color,
                }}
              >
                {action.priority} - {priorityMeta.label}
              </span>
              <span
                className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                style={{
                  backgroundColor: `${ownerMeta.color}20`,
                  color: ownerMeta.color,
                }}
              >
                {ownerMeta.label}
              </span>
            </div>
            <div
              className="text-right text-sm"
              style={{
                color: action.due_in_days <= 0 ? '#ef4444' : 'var(--text-secondary)',
              }}
            >
              {action.due_in_days <= 0 ? (
                <span className="font-bold">Overdue</span>
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
            <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
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
                    <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Req: </span>
                    <span style={{ color: 'var(--text-primary)' }}>{action.req_title}</span>
                  </div>
                )}
                {action.candidate_name && (
                  <div>
                    <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Candidate: </span>
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
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>KPI: </span>
              <span style={{ color: 'var(--text-primary)' }}>{action.evidence.kpi_key}</span>
            </div>
            <div>
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Reason: </span>
              <span style={{ color: 'var(--text-primary)' }}>{action.evidence.short_reason}</span>
            </div>
          </div>

          {hasEvidence ? (
            <button
              className="px-2 py-1 text-sm w-full mb-4"
              onClick={() => onViewEvidence(action.evidence.explain_provider_key as ExplainProviderId)}
              style={{
                backgroundColor: 'rgba(45, 212, 191, 0.1)',
                border: '1px solid rgba(45, 212, 191, 0.3)',
                color: '#2dd4bf',
              }}
            >
              <i className="bi bi-graph-up mr-1"></i>
              View Evidence
            </button>
          ) : (
            <div
              className="text-center text-sm mb-4 py-2"
              style={{ color: 'var(--text-secondary)' }}
            >
              <i className="bi bi-info-circle mr-1"></i>
              Evidence unavailable
            </div>
          )}

          {/* Recommended Steps */}
          {action.recommended_steps.length > 0 && (
            <>
              <SectionHeader>Recommended Steps</SectionHeader>
              <ul
                className="mb-4 pl-3"
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
            className="p-3 flex gap-2"
            style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}
          >
            <button
              className="px-2 py-1 text-sm grow"
              onClick={() => onMarkDone(action.action_id)}
              style={{
                backgroundColor: 'rgba(34, 197, 94, 0.15)',
                border: '1px solid rgba(34, 197, 94, 0.3)',
                color: '#22c55e',
              }}
            >
              <i className="bi bi-check-lg mr-1"></i>
              Mark Done
            </button>
            <button
              className="px-2 py-1 text-sm grow"
              onClick={() => onDismiss(action.action_id)}
              style={{
                backgroundColor: 'rgba(107, 114, 128, 0.15)',
                border: '1px solid rgba(107, 114, 128, 0.3)',
                color: '#9ca3af',
              }}
            >
              <i className="bi bi-x-lg mr-1"></i>
              Dismiss
            </button>
          </div>
        )}

        {/* Footer - Timestamps */}
        <div
          className="p-3 text-sm"
          style={{
            borderTop: '1px solid rgba(255,255,255,0.1)',
            color: 'var(--text-secondary)',
          }}
        >
          <div className="flex justify-between">
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
      className="uppercase text-sm mb-2 font-semibold"
      style={{
        color: 'var(--text-secondary)',
        letterSpacing: '0.05em',
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
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <i className="bi bi-chat-left-text" style={{ color: '#a78bfa' }}></i>
          <span className="text-sm font-bold" style={{ color: '#a78bfa' }}>Draft Message</span>
        </div>
      </div>

      {/* Channel Selector */}
      {!result && !isLoading && (
        <div className="flex gap-2 mb-3">
          <button
            className={`px-2 py-1 text-sm grow ${channel === 'slack' ? 'active' : ''}`}
            onClick={() => onChannelChange('slack')}
            style={{
              backgroundColor: channel === 'slack' ? 'rgba(139, 92, 246, 0.3)' : 'transparent',
              border: '1px solid rgba(139, 92, 246, 0.4)',
              color: channel === 'slack' ? '#a78bfa' : 'var(--text-secondary)',
              fontSize: '0.75rem',
            }}
          >
            <i className="bi bi-slack mr-1"></i>
            Slack
          </button>
          <button
            className={`px-2 py-1 text-sm grow ${channel === 'email' ? 'active' : ''}`}
            onClick={() => onChannelChange('email')}
            style={{
              backgroundColor: channel === 'email' ? 'rgba(139, 92, 246, 0.3)' : 'transparent',
              border: '1px solid rgba(139, 92, 246, 0.4)',
              color: channel === 'email' ? '#a78bfa' : 'var(--text-secondary)',
              fontSize: '0.75rem',
            }}
          >
            <i className="bi bi-envelope mr-1"></i>
            Email
          </button>
        </div>
      )}

      {/* Generate Button */}
      {!result && !isLoading && (
        <button
          className="px-2 py-1 text-sm w-full"
          onClick={onGenerate}
          style={{
            backgroundColor: 'rgba(139, 92, 246, 0.2)',
            border: '1px solid rgba(139, 92, 246, 0.4)',
            color: '#a78bfa',
            fontSize: '0.8rem',
          }}
        >
          <i className="bi bi-lightning-charge mr-1"></i>
          Generate {channel === 'slack' ? 'Slack' : 'Email'} Draft
        </button>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center gap-2 py-2">
          <LogoSpinner size={32} message="Drafting message..." />
        </div>
      )}

      {/* Error State */}
      {error && (
        <div
          className="p-2 rounded text-sm"
          style={{
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#ef4444',
          }}
        >
          <i className="bi bi-exclamation-circle mr-1"></i>
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
              className="mb-0 text-sm"
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
            className="px-2 py-1 text-sm w-full"
            onClick={handleCopy}
            style={{
              backgroundColor: copied ? 'rgba(34, 197, 94, 0.2)' : 'rgba(139, 92, 246, 0.2)',
              border: `1px solid ${copied ? 'rgba(34, 197, 94, 0.4)' : 'rgba(139, 92, 246, 0.4)'}`,
              color: copied ? '#22c55e' : '#a78bfa',
              fontSize: '0.8rem',
            }}
          >
            <i className={`bi ${copied ? 'bi-check' : 'bi-clipboard'} mr-1`}></i>
            {copied ? 'Copied!' : 'Copy to Clipboard'}
          </button>
          <p className="mt-2 mb-0 text-sm" style={{ color: 'var(--text-secondary)' }}>
            <i className="bi bi-info-circle mr-1"></i>
            Replace placeholders with actual names before sending.
          </p>
        </div>
      )}
    </div>
  );
}

export default ActionDetailDrawer;
