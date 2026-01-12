// Action Detail Drawer Component
// Shows full action details with evidence linking and status actions

import React from 'react';
import { format } from 'date-fns';
import {
  ActionItem,
  ActionStatus,
  PRIORITY_META,
  OWNER_TYPE_META,
} from '../../types/actionTypes';
import { ExplainProviderId } from '../../types/explainTypes';

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
        className="position-fixed top-0 start-0 w-100 h-100"
        style={{
          backgroundColor: 'rgba(0,0,0,0.5)',
          zIndex: 1040,
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? 'auto' : 'none',
          transition: 'opacity 0.3s ease-in-out',
        }}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className="position-fixed top-0 end-0 h-100 d-flex flex-column"
        style={{
          width: '420px',
          maxWidth: '90vw',
          backgroundColor: 'var(--surface-elevated, #1e293b)',
          zIndex: 1050,
          boxShadow: '-4px 0 20px rgba(0,0,0,0.3)',
          transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.3s ease-in-out',
        }}
      >
        {/* Header */}
        <div
          className="d-flex align-items-center justify-content-between p-3"
          style={{
            borderBottom: '1px solid rgba(255,255,255,0.1)',
            backgroundColor: 'rgba(0,0,0,0.2)',
          }}
        >
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

export default ActionDetailDrawer;
