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
      <div className="action-priority-summary flex gap-3 mb-3">
        {p0Actions.length > 0 && (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-500 text-white">
            {p0Actions.length} P0
          </span>
        )}
        {p1Actions.length > 0 && (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-500 text-gray-900">
            {p1Actions.length} P1
          </span>
        )}
        {p2Actions.length > 0 && (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-500 text-white">
            {p2Actions.length} P2
          </span>
        )}
      </div>

      {actions.length === 0 ? (
        <p className="text-muted-foreground mb-0">
          <i className="bi bi-check-circle mr-2 text-green-400" />
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
                    className="action-item-header flex items-start cursor-pointer"
                    onClick={() => setExpandedAction(isExpanded ? null : action.action_id)}
                  >
                    <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded text-xs font-medium mr-2 min-w-[28px] ${
                      config.color === 'danger' ? 'bg-red-500 text-white' :
                      config.color === 'warning' ? 'bg-yellow-500 text-gray-900' :
                      'bg-blue-500 text-white'
                    }`}>
                      {action.priority}
                    </span>
                    <div className="grow">
                      <div className="action-title">{action.title}</div>
                      <small className="text-muted-foreground">
                        Due in {action.due_in_days} days
                        {action.owner_name && ` | ${action.owner_name}`}
                      </small>
                    </div>
                    <i className={`bi bi-chevron-${isExpanded ? 'up' : 'down'} text-muted-foreground`} />
                  </div>

                  {isExpanded && (
                    <div className="action-details mt-2 pl-4">
                      {action.evidence && (
                        <div className="mb-2">
                          <small className="text-muted-foreground">Evidence: </small>
                          <small>{action.evidence.short_reason}</small>
                        </div>
                      )}
                      {action.recommended_steps && action.recommended_steps.length > 0 && (
                        <div className="recommended-steps">
                          <small className="text-muted-foreground block mb-1">Recommended Steps:</small>
                          <ol className="text-sm mb-0 pl-3">
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
              className="bg-transparent border-none text-accent-secondary text-sm p-0 mt-2 cursor-pointer hover:underline"
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
