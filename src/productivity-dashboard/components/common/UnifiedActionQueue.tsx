// Unified Action Queue Component
// Displays consolidated actions from all sources with filtering and sorting

import React, { useState, useMemo } from 'react';
import {
  ActionItem,
  ActionOwnerType,
  ActionQueueFilter,
  PRIORITY_META,
  OWNER_TYPE_META,
} from '../../types/actionTypes';
import {
  filterActionsByOwner,
  getOpenActions,
  getActionCounts,
} from '../../services/actionQueueService';

interface UnifiedActionQueueProps {
  actions: ActionItem[];
  onActionClick: (action: ActionItem) => void;
  maxDisplay?: number;
}

export function UnifiedActionQueue({
  actions,
  onActionClick,
  maxDisplay = 10,
}: UnifiedActionQueueProps) {
  const [filter, setFilter] = useState<ActionQueueFilter>('ALL');

  // Get counts for tabs
  const counts = useMemo(() => getActionCounts(actions), [actions]);

  // Filter and limit actions
  const displayActions = useMemo(() => {
    const open = getOpenActions(actions);
    const filtered = filterActionsByOwner(open, filter);
    return filtered.slice(0, maxDisplay);
  }, [actions, filter, maxDisplay]);

  const filters: { key: ActionQueueFilter; label: string }[] = [
    { key: 'ALL', label: 'All' },
    { key: 'RECRUITER', label: 'Recruiter' },
    { key: 'HIRING_MANAGER', label: 'HM' },
    { key: 'TA_OPS', label: 'Ops' },
  ];

  return (
    <div className="unified-action-queue">
      {/* Filter Tabs */}
      <div className="d-flex gap-1 mb-3" style={{ flexWrap: 'wrap' }}>
        {filters.map(f => {
          const count = f.key === 'ALL' ? counts.ALL : counts[f.key as ActionOwnerType];
          const isActive = filter === f.key;

          return (
            <button
              key={f.key}
              className={`btn btn-sm ${isActive ? 'active' : ''}`}
              onClick={() => setFilter(f.key)}
              style={{
                backgroundColor: isActive ? 'rgba(45, 212, 191, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                border: `1px solid ${isActive ? 'rgba(45, 212, 191, 0.5)' : 'rgba(255, 255, 255, 0.1)'}`,
                color: isActive ? '#2dd4bf' : 'var(--text-secondary)',
                padding: '0.25rem 0.5rem',
                fontSize: '0.75rem',
              }}
            >
              {f.label}
              {count > 0 && (
                <span
                  className="ms-1 badge"
                  style={{
                    backgroundColor: isActive ? '#2dd4bf' : 'rgba(255, 255, 255, 0.2)',
                    color: isActive ? '#0f172a' : 'var(--text-primary)',
                    fontSize: '0.65rem',
                  }}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Action List */}
      <div className="action-list">
        {displayActions.length === 0 ? (
          <div
            className="text-center py-4"
            style={{ color: 'var(--text-secondary)' }}
          >
            <i className="bi bi-check-circle fs-4 mb-2 d-block" style={{ opacity: 0.5 }}></i>
            <span className="small">No open actions</span>
          </div>
        ) : (
          displayActions.map(action => (
            <ActionRow
              key={action.action_id}
              action={action}
              onClick={() => onActionClick(action)}
            />
          ))
        )}
      </div>

      {/* Show more indicator */}
      {counts[filter === 'ALL' ? 'ALL' : filter as ActionOwnerType] > maxDisplay && (
        <div
          className="text-center mt-2 small"
          style={{ color: 'var(--text-secondary)' }}
        >
          +{counts[filter === 'ALL' ? 'ALL' : filter as ActionOwnerType] - maxDisplay} more actions
        </div>
      )}
    </div>
  );
}

// Individual action row
function ActionRow({
  action,
  onClick,
}: {
  action: ActionItem;
  onClick: () => void;
}) {
  const priorityMeta = PRIORITY_META[action.priority];
  const ownerMeta = OWNER_TYPE_META[action.owner_type];

  // Format due date
  const dueText = action.due_in_days <= 0
    ? 'Overdue'
    : action.due_in_days === 1
    ? '1 day'
    : `${action.due_in_days}d`;

  return (
    <div
      className="action-row d-flex align-items-start gap-2 p-2 rounded mb-2"
      onClick={onClick}
      style={{
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.06)';
        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.03)';
        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
      }}
    >
      {/* Priority indicator */}
      <div
        className="priority-indicator"
        style={{
          width: '4px',
          height: '100%',
          minHeight: '40px',
          backgroundColor: priorityMeta.color,
          borderRadius: '2px',
          flexShrink: 0,
        }}
      />

      {/* Main content */}
      <div className="flex-grow-1 min-width-0">
        {/* Title row */}
        <div className="d-flex align-items-center gap-2 mb-1">
          <span
            className="action-title text-truncate"
            style={{
              color: 'var(--text-primary)',
              fontSize: '0.85rem',
              fontWeight: 500,
            }}
            title={action.title}
          >
            {action.title}
          </span>
        </div>

        {/* Meta row */}
        <div className="d-flex align-items-center gap-2 flex-wrap">
          {/* Owner badge */}
          <span
            className="badge"
            style={{
              backgroundColor: `${ownerMeta.color}20`,
              color: ownerMeta.color,
              fontSize: '0.65rem',
              padding: '0.15rem 0.35rem',
            }}
          >
            {ownerMeta.shortLabel}
          </span>

          {/* Req title */}
          {action.req_title && action.req_id !== 'general' && (
            <span
              className="text-truncate small"
              style={{
                color: 'var(--text-secondary)',
                maxWidth: '120px',
              }}
              title={action.req_title}
            >
              {action.req_title}
            </span>
          )}

          {/* Reason */}
          <span
            className="text-truncate small"
            style={{
              color: 'var(--text-secondary)',
              maxWidth: '150px',
            }}
            title={action.evidence.short_reason}
          >
            {action.evidence.short_reason}
          </span>
        </div>
      </div>

      {/* Right side - priority badge and due */}
      <div className="d-flex flex-column align-items-end gap-1" style={{ flexShrink: 0 }}>
        <span
          className="badge"
          style={{
            backgroundColor: priorityMeta.bgColor,
            color: priorityMeta.color,
            fontSize: '0.6rem',
            textTransform: 'uppercase',
          }}
        >
          {action.priority}
        </span>
        <span
          className="small"
          style={{
            color: action.due_in_days <= 0 ? '#ef4444' : 'var(--text-secondary)',
            fontSize: '0.7rem',
          }}
        >
          {dueText}
        </span>
      </div>
    </div>
  );
}

export default UnifiedActionQueue;
