/**
 * Action Plan Card
 *
 * Displays the generated actions from a scenario with expand/collapse.
 */

import React, { useState } from 'react';
import { GlassPanel, SectionHeader } from '../../common';
import { ActionItem } from '../../../types/actionTypes';

interface ActionPlanCardProps {
  actions: ActionItem[];
  className?: string;
}

const PRIORITY_CONFIG: Record<string, { color: string; label: string }> = {
  P0: { color: 'danger', label: 'Blocking' },
  P1: { color: 'warning', label: 'Risk' },
  P2: { color: 'info', label: 'Optimize' },
};

export default function ActionPlanCard({ actions, className = '' }: ActionPlanCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [expandedAction, setExpandedAction] = useState<string | null>(null);

  // Group by priority
  const p0Actions = actions.filter(a => a.priority === 'P0');
  const p1Actions = actions.filter(a => a.priority === 'P1');
  const p2Actions = actions.filter(a => a.priority === 'P2');

  const visibleActions = expanded ? actions : actions.slice(0, 5);

  return (
    <GlassPanel className={className}>
      <SectionHeader
        title="Action Plan"
        badge={actions.length > 0 ? `${actions.length} actions` : undefined}
      />

      {/* Priority summary */}
      <div className="action-priority-summary d-flex gap-3 mb-3">
        {p0Actions.length > 0 && (
          <span className="badge bg-danger">
            {p0Actions.length} P0
          </span>
        )}
        {p1Actions.length > 0 && (
          <span className="badge bg-warning text-dark">
            {p1Actions.length} P1
          </span>
        )}
        {p2Actions.length > 0 && (
          <span className="badge bg-info">
            {p2Actions.length} P2
          </span>
        )}
      </div>

      {actions.length === 0 ? (
        <p className="text-secondary mb-0">
          <i className="bi bi-check-circle me-2 text-success" />
          No immediate actions required
        </p>
      ) : (
        <>
          <div className="action-list">
            {visibleActions.map(action => {
              const config = PRIORITY_CONFIG[action.priority] || PRIORITY_CONFIG.P2;
              const isExpanded = expandedAction === action.action_id;

              return (
                <div key={action.action_id} className="action-item mb-2">
                  <div
                    className="action-item-header d-flex align-items-start"
                    onClick={() => setExpandedAction(isExpanded ? null : action.action_id)}
                    style={{ cursor: 'pointer' }}
                  >
                    <span className={`badge bg-${config.color} me-2`} style={{ minWidth: '28px' }}>
                      {action.priority}
                    </span>
                    <div className="flex-grow-1">
                      <div className="action-title">{action.title}</div>
                      <small className="text-secondary">
                        Due in {action.due_in_days} days
                        {action.owner_name && ` | ${action.owner_name}`}
                      </small>
                    </div>
                    <i className={`bi bi-chevron-${isExpanded ? 'up' : 'down'} text-secondary`} />
                  </div>

                  {isExpanded && (
                    <div className="action-details mt-2 ps-4">
                      {action.evidence && (
                        <div className="mb-2">
                          <small className="text-secondary">Evidence: </small>
                          <small>{action.evidence.short_reason}</small>
                        </div>
                      )}
                      {action.recommended_steps && action.recommended_steps.length > 0 && (
                        <div className="recommended-steps">
                          <small className="text-secondary d-block mb-1">Recommended Steps:</small>
                          <ol className="small mb-0 ps-3">
                            {action.recommended_steps.map((step, idx) => (
                              <li key={idx}>{step}</li>
                            ))}
                          </ol>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {actions.length > 5 && (
            <button
              className="btn btn-link btn-sm p-0 mt-2"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? 'Show less' : `Show all ${actions.length} actions`}
            </button>
          )}
        </>
      )}
    </GlassPanel>
  );
}
