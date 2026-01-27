/**
 * Generate Action Plan Button
 *
 * Adds scenario actions to the unified Action Queue.
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ActionItem } from '../../../../types/actionTypes';
import { loadActionStates, mergeScenarioActions } from '../../../../services/actionQueueService';

interface GenerateActionPlanButtonProps {
  actions: ActionItem[];
  datasetId: string;
}

export default function GenerateActionPlanButton({
  actions,
  datasetId,
}: GenerateActionPlanButtonProps) {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [newActionsCount, setNewActionsCount] = useState(0);

  const handleClick = async () => {
    if (actions.length === 0) return;

    // Check for existing actions
    const existingStates = loadActionStates(datasetId);
    const existingIds = existingStates?.actions
      ? new Set(Object.keys(existingStates.actions))
      : new Set<string>();
    const newActions = actions.filter(a => !existingIds.has(a.action_id));

    if (newActions.length === 0) {
      alert('All actions from this scenario are already in your Action Queue.');
      return;
    }

    setNewActionsCount(newActions.length);
    setShowConfirm(true);
  };

  const handleConfirm = async () => {
    setIsLoading(true);
    try {
      // Merge actions into the unified queue
      await mergeScenarioActions(actions, datasetId);

      // Navigate to Control Tower with highlight
      navigate('/control-tower', {
        state: {
          highlightActions: actions.map(a => a.action_id),
          toast: `Added ${newActionsCount} actions to your Action Queue`,
        },
      });
    } catch (error) {
      console.error('Failed to add actions:', error);
      alert('Failed to add actions. Please try again.');
    } finally {
      setIsLoading(false);
      setShowConfirm(false);
    }
  };

  if (actions.length === 0) {
    return (
      <button className="px-4 py-2 rounded-md bg-accent-primary text-white font-medium opacity-50 cursor-not-allowed" disabled>
        <i className="bi bi-clipboard-plus mr-2" />
        No Actions to Add
      </button>
    );
  }

  return (
    <>
      <button
        className="px-4 py-2 rounded-md bg-accent-primary text-white font-medium hover:bg-accent-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        onClick={handleClick}
        disabled={isLoading}
      >
        {isLoading ? (
          <>
            <span className="inline-block w-4 h-4 border-2 border-current border-r-transparent rounded-full animate-spin mr-2" />
            Adding...
          </>
        ) : (
          <>
            <i className="bi bi-clipboard-plus mr-2" />
            Add to Action Queue ({actions.length})
          </>
        )}
      </button>

      {/* Confirmation Modal */}
      {showConfirm && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-[1040]"
            onClick={() => setShowConfirm(false)}
          />
          <div
            className="fixed inset-0 z-[1050] flex items-center justify-center p-4"
            tabIndex={-1}
            role="dialog"
          >
            <div className="bg-surface-base rounded-lg shadow-xl max-w-md w-full">
              <div className="flex items-center justify-between p-4 border-b border-glass-border">
                <h5 className="text-lg font-semibold">Add to Action Queue</h5>
                <button
                  type="button"
                  className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-surface-elevated transition-colors"
                  onClick={() => setShowConfirm(false)}
                >
                  <i className="bi bi-x text-muted-foreground" />
                </button>
              </div>
              <div className="p-4">
                <p>
                  Add {newActionsCount} actions from this scenario to your Action Queue?
                </p>
                <div className="actions-preview">
                  {actions.slice(0, 3).map(action => (
                    <div key={action.action_id} className="flex items-center mb-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium mr-2 ${
                        getPriorityColor(action.priority) === 'danger' ? 'bg-red-500 text-white' :
                        getPriorityColor(action.priority) === 'warning' ? 'bg-yellow-500 text-gray-900' :
                        getPriorityColor(action.priority) === 'info' ? 'bg-blue-500 text-white' :
                        'bg-gray-500 text-white'
                      }`}>
                        {action.priority}
                      </span>
                      <span className="text-sm">{action.title}</span>
                    </div>
                  ))}
                  {actions.length > 3 && (
                    <small className="text-muted-foreground">
                      ...and {actions.length - 3} more
                    </small>
                  )}
                </div>
              </div>
              <div className="flex justify-end gap-2 p-4 border-t border-glass-border">
                <button
                  type="button"
                  className="px-4 py-2 rounded-md border border-glass-border bg-transparent text-muted-foreground hover:bg-surface-elevated transition-colors"
                  onClick={() => setShowConfirm(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="px-4 py-2 rounded-md bg-accent-primary text-white font-medium hover:bg-accent-primary/90 transition-colors disabled:opacity-50"
                  onClick={handleConfirm}
                  disabled={isLoading}
                >
                  {isLoading ? 'Adding...' : 'Add Actions'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}

function getPriorityColor(priority: string): string {
  switch (priority) {
    case 'P0': return 'danger';
    case 'P1': return 'warning';
    case 'P2': return 'info';
    default: return 'secondary';
  }
}
