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
      <div className="flex gap-1 mb-3 flex-wrap">
        {filters.map(f => {
          const count = f.key === 'ALL' ? counts.ALL : counts[f.key as ActionOwnerType];
          const isActive = filter === f.key;

          return (
            <button
              key={f.key}
              className="px-2 py-1 text-xs font-medium rounded-md"
              onClick={() => setFilter(f.key)}
              style={{
                backgroundColor: isActive ? 'rgba(45, 212, 191, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                border: `1px solid ${isActive ? 'rgba(45, 212, 191, 0.5)' : 'rgba(255, 255, 255, 0.1)'}`,
                color: isActive ? '#2dd4bf' : 'var(--text-secondary)',
              }}
            >
              {f.label}
              {count > 0 && (
                <span
                  className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded text-[0.65rem] font-medium"
                  style={{
                    backgroundColor: isActive ? '#2dd4bf' : 'rgba(255, 255, 255, 0.2)',
                    color: isActive ? '#0f172a' : 'var(--text-primary)',
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
          <div className="text-center py-4" style={{ color: 'var(--text-secondary)' }}>
            <i className="bi bi-check-circle text-4xl mb-2 block opacity-50"></i>
            <span className="text-sm">No open actions</span>
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
        <div className="text-center mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
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
  const isGreyedOut = action.matchesFilter === false;

  // Format due date
  const dueText = action.due_in_days <= 0
    ? 'Overdue'
    : action.due_in_days === 1
    ? '1 day'
    : `${action.due_in_days}d`;

  // Colors for greyed-out state
  const greyColor = 'rgba(100, 116, 139, 0.6)';
  const greyBg = 'rgba(100, 116, 139, 0.2)';

  return (
    <div
      className="action-row flex items-start gap-2 p-2 rounded mb-2 cursor-pointer transition-all duration-150 hover:bg-white/[0.06] hover:border-white/[0.15]"
      onClick={onClick}
      style={{
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        opacity: isGreyedOut ? 0.4 : 1,
      }}
    >
      {/* Priority indicator */}
      <div
        className="priority-indicator"
        style={{
          width: '4px',
          height: '100%',
          minHeight: '40px',
          backgroundColor: isGreyedOut ? greyColor : priorityMeta.color,
          borderRadius: '2px',
          flexShrink: 0,
        }}
      />

      {/* Main content */}
      <div className="flex-1 min-w-0">
        {/* Title row */}
        <div className="flex items-center gap-2 mb-1">
          <span
            className="action-title truncate text-[0.85rem] font-medium"
            style={{
              color: isGreyedOut ? 'var(--text-secondary)' : 'var(--text-primary)',
            }}
            title={action.title}
          >
            {action.title}
          </span>
        </div>

        {/* Meta row */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Owner badge */}
          <span
            className="inline-flex items-center px-1.5 py-0.5 rounded text-[0.65rem] font-medium"
            style={{
              backgroundColor: isGreyedOut ? greyBg : `${ownerMeta.color}20`,
              color: isGreyedOut ? greyColor : ownerMeta.color,
            }}
          >
            {ownerMeta.shortLabel}
          </span>

          {/* Req title */}
          {action.req_title && action.req_id !== 'general' && (
            <span
              className="truncate text-sm max-w-[120px]"
              style={{
                color: 'var(--text-secondary)',
              }}
              title={action.req_title}
            >
              {action.req_title}
            </span>
          )}

          {/* Reason */}
          <span
            className="truncate text-sm max-w-[150px]"
            style={{
              color: 'var(--text-secondary)',
            }}
            title={action.evidence.short_reason}
          >
            {action.evidence.short_reason}
          </span>
        </div>
      </div>

      {/* Right side - priority badge and due */}
      <div className="flex flex-col items-end gap-1 shrink-0">
        <span
          className="inline-flex items-center px-2 py-0.5 rounded text-[0.6rem] font-medium uppercase"
          style={{
            backgroundColor: isGreyedOut ? greyBg : priorityMeta.bgColor,
            color: isGreyedOut ? greyColor : priorityMeta.color,
          }}
        >
          {action.priority}
        </span>
        <span
          className="text-[0.7rem]"
          style={{
            color: isGreyedOut ? greyColor : (action.due_in_days <= 0 ? '#ef4444' : 'var(--text-secondary)'),
          }}
        >
          {dueText}
        </span>
      </div>
    </div>
  );
}

export default UnifiedActionQueue;
