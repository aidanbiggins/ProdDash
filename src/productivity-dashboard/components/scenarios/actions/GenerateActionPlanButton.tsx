/**
 * Generate Action Plan Button
 *
 * Adds scenario actions to the unified Action Queue.
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ActionItem } from '../../../types/actionTypes';
import { loadActionStates, mergeScenarioActions } from '../../../services/actionQueueService';

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
      <button className="btn btn-primary" disabled>
        <i className="bi bi-clipboard-plus me-2" />
        No Actions to Add
      </button>
    );
  }

  return (
    <>
      <button
        className="btn btn-primary"
        onClick={handleClick}
        disabled={isLoading}
      >
        {isLoading ? (
          <>
            <span className="spinner-border spinner-border-sm me-2" />
            Adding...
          </>
        ) : (
          <>
            <i className="bi bi-clipboard-plus me-2" />
            Add to Action Queue ({actions.length})
          </>
        )}
      </button>

      {/* Confirmation Modal */}
      {showConfirm && (
        <>
          <div
            className="modal-backdrop show"
            style={{ opacity: 0.5 }}
            onClick={() => setShowConfirm(false)}
          />
          <div
            className="modal show d-block"
            tabIndex={-1}
            role="dialog"
          >
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content bg-dark">
                <div className="modal-header border-secondary">
                  <h5 className="modal-title">Add to Action Queue</h5>
                  <button
                    type="button"
                    className="btn-close btn-close-white"
                    onClick={() => setShowConfirm(false)}
                  />
                </div>
                <div className="modal-body">
                  <p>
                    Add {newActionsCount} actions from this scenario to your Action Queue?
                  </p>
                  <div className="actions-preview">
                    {actions.slice(0, 3).map(action => (
                      <div key={action.action_id} className="d-flex align-items-center mb-2">
                        <span className={`badge bg-${getPriorityColor(action.priority)} me-2`}>
                          {action.priority}
                        </span>
                        <span className="small">{action.title}</span>
                      </div>
                    ))}
                    {actions.length > 3 && (
                      <small className="text-secondary">
                        ...and {actions.length - 3} more
                      </small>
                    )}
                  </div>
                </div>
                <div className="modal-footer border-secondary">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowConfirm(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleConfirm}
                    disabled={isLoading}
                  >
                    {isLoading ? 'Adding...' : 'Add Actions'}
                  </button>
                </div>
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
