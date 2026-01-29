/**
 * GenerateActionPlanButtonV2
 *
 * Adds scenario actions to the unified Action Queue.
 * V2 version using Tailwind tokens and lucide-react icons.
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardPlus, Loader2, X } from 'lucide-react';
import { ActionItem } from '../../../../types/actionTypes';
import { loadActionStates, mergeScenarioActions } from '../../../../services/actionQueueService';

interface GenerateActionPlanButtonV2Props {
  actions: ActionItem[];
  datasetId: string;
}

const PRIORITY_STYLES: Record<string, string> = {
  P0: 'bg-bad text-white',
  P1: 'bg-warn text-gray-900',
  P2: 'bg-primary text-white',
};

export function GenerateActionPlanButtonV2({ actions, datasetId }: GenerateActionPlanButtonV2Props) {
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
    const newActions = actions.filter((a) => !existingIds.has(a.action_id));

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
          highlightActions: actions.map((a) => a.action_id),
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
      <button
        className="px-4 py-2 min-h-[44px] rounded-md bg-accent text-white font-medium opacity-50 cursor-not-allowed inline-flex items-center"
        disabled
      >
        <ClipboardPlus size={16} className="mr-2" />
        No Actions to Add
      </button>
    );
  }

  return (
    <>
      <button
        className="px-4 py-2 min-h-[44px] rounded-md bg-accent text-white font-medium hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center"
        onClick={handleClick}
        disabled={isLoading}
      >
        {isLoading ? (
          <>
            <Loader2 size={16} className="mr-2 animate-spin" />
            Adding...
          </>
        ) : (
          <>
            <ClipboardPlus size={16} className="mr-2" />
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
            role="dialog"
          >
            <div className="glass-panel max-w-md w-full">
              <div className="flex items-center justify-between p-4 border-b border-border">
                <h5 className="text-lg font-semibold text-foreground">Add to Action Queue</h5>
                <button
                  type="button"
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted transition-colors"
                  onClick={() => setShowConfirm(false)}
                >
                  <X size={16} className="text-muted-foreground" />
                </button>
              </div>
              <div className="p-4">
                <p className="text-foreground mb-4">
                  Add {newActionsCount} actions from this scenario to your Action Queue?
                </p>
                <div className="space-y-2">
                  {actions.slice(0, 3).map((action) => (
                    <div key={action.action_id} className="flex items-center">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium mr-2 ${
                          PRIORITY_STYLES[action.priority] || 'bg-muted text-foreground'
                        }`}
                      >
                        {action.priority}
                      </span>
                      <span className="text-sm text-foreground">{action.title}</span>
                    </div>
                  ))}
                  {actions.length > 3 && (
                    <small className="text-muted-foreground">
                      ...and {actions.length - 3} more
                    </small>
                  )}
                </div>
              </div>
              <div className="flex justify-end gap-2 p-4 border-t border-border">
                <button
                  type="button"
                  className="px-4 py-2 min-h-[44px] rounded-md border border-border bg-transparent text-muted-foreground hover:bg-muted transition-colors"
                  onClick={() => setShowConfirm(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="px-4 py-2 min-h-[44px] rounded-md bg-accent text-white font-medium hover:bg-accent/90 transition-colors disabled:opacity-50"
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

export default GenerateActionPlanButtonV2;
