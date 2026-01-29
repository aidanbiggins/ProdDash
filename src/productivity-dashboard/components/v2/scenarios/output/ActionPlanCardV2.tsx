/**
 * ActionPlanCardV2
 *
 * Displays the generated actions from a scenario with expand/collapse.
 * V2 version using glass-panel, Tailwind tokens, and lucide-react icons.
 */

import React, { useState } from 'react';
import { ChevronUp, ChevronDown, CheckCircle } from 'lucide-react';
import { SectionHeader } from '../../../common';
import { ActionItem } from '../../../../types/actionTypes';

interface ActionPlanCardV2Props {
  actions: ActionItem[];
  className?: string;
}

const PRIORITY_STYLES: Record<string, { badge: string; label: string }> = {
  P0: { badge: 'bg-bad text-white', label: 'Blocking' },
  P1: { badge: 'bg-warn text-gray-900', label: 'Risk' },
  P2: { badge: 'bg-primary text-white', label: 'Optimize' },
};

export function ActionPlanCardV2({ actions, className = '' }: ActionPlanCardV2Props) {
  const [expanded, setExpanded] = useState(false);
  const [expandedAction, setExpandedAction] = useState<string | null>(null);

  // Group by priority
  const p0Actions = actions.filter((a) => a.priority === 'P0');
  const p1Actions = actions.filter((a) => a.priority === 'P1');
  const p2Actions = actions.filter((a) => a.priority === 'P2');

  const visibleActions = expanded ? actions : actions.slice(0, 5);

  return (
    <div className={`glass-panel p-4 ${className}`}>
      <SectionHeader
        title="Action Plan"
        badge={actions.length > 0 ? `${actions.length} actions` : undefined}
      />

      {/* Priority summary */}
      <div className="flex gap-2 flex-wrap mb-3">
        {p0Actions.length > 0 && (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-bad text-white">
            {p0Actions.length} P0
          </span>
        )}
        {p1Actions.length > 0 && (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-warn text-gray-900">
            {p1Actions.length} P1
          </span>
        )}
        {p2Actions.length > 0 && (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary text-white">
            {p2Actions.length} P2
          </span>
        )}
      </div>

      {actions.length === 0 ? (
        <p className="text-muted-foreground mb-0 flex items-center">
          <CheckCircle size={16} className="mr-2 text-good" />
          No immediate actions required
        </p>
      ) : (
        <>
          <div className="space-y-2">
            {visibleActions.map((action) => {
              const config = PRIORITY_STYLES[action.priority] || PRIORITY_STYLES.P2;
              const isExpanded = expandedAction === action.action_id;

              return (
                <div key={action.action_id}>
                  <div
                    className="flex items-start cursor-pointer group"
                    onClick={() => setExpandedAction(isExpanded ? null : action.action_id)}
                  >
                    <span
                      className={`inline-flex items-center justify-center px-2 py-0.5 rounded text-xs font-medium mr-2 min-w-[28px] ${config.badge}`}
                    >
                      {action.priority}
                    </span>
                    <div className="flex-1">
                      <div className="text-foreground group-hover:text-primary transition-colors">
                        {action.title}
                      </div>
                      <small className="text-muted-foreground">
                        Due in {action.due_in_days} days
                        {action.owner_name && ` | ${action.owner_name}`}
                      </small>
                    </div>
                    {isExpanded ? (
                      <ChevronUp size={16} className="text-muted-foreground" />
                    ) : (
                      <ChevronDown size={16} className="text-muted-foreground" />
                    )}
                  </div>

                  {isExpanded && (
                    <div className="mt-2 pl-10 space-y-2">
                      {action.evidence && (
                        <div>
                          <small className="text-muted-foreground">Evidence: </small>
                          <small className="text-foreground">{action.evidence.short_reason}</small>
                        </div>
                      )}
                      {action.recommended_steps && action.recommended_steps.length > 0 && (
                        <div>
                          <small className="text-muted-foreground block mb-1">
                            Recommended Steps:
                          </small>
                          <ol className="text-sm mb-0 pl-4 list-decimal space-y-1">
                            {action.recommended_steps.map((step, idx) => (
                              <li key={idx} className="text-foreground">
                                {step}
                              </li>
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
              className="bg-transparent border-none text-primary text-sm p-0 mt-3 cursor-pointer hover:underline"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? 'Show less' : `Show all ${actions.length} actions`}
            </button>
          )}
        </>
      )}
    </div>
  );
}

export default ActionPlanCardV2;
