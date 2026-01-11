// Collapsible Progress Indicator for Background Operations

import React, { useState, useEffect } from 'react';
import {
  LoadingState,
  BackgroundOperation,
  PHASE_LABELS,
  getLoadingMessage,
  getTimeRemaining
} from '../../types/loadingTypes';

interface ProgressIndicatorProps {
  loadingState: LoadingState;
  onDismiss?: () => void;
}

export function ProgressIndicator({ loadingState, onDismiss }: ProgressIndicatorProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { operations, overallProgress, isFullyReady } = loadingState;

  // Auto-expand when operations start
  useEffect(() => {
    if (operations.length > 0 && operations.some(op => op.status === 'running')) {
      setIsExpanded(true);
    }
  }, [operations.length]);

  // Auto-collapse when complete
  useEffect(() => {
    if (isFullyReady && operations.length > 0) {
      const timer = setTimeout(() => setIsExpanded(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [isFullyReady, operations.length]);

  // Don't show if no operations
  if (operations.length === 0) return null;

  const runningOps = operations.filter(op => op.status === 'running');
  const currentOp = runningOps[0];
  const hasError = operations.some(op => op.status === 'error');

  // Minimized pill view
  if (!isExpanded) {
    return (
      <button
        className="btn d-flex align-items-center gap-2"
        onClick={() => setIsExpanded(true)}
        style={{
          background: hasError ? 'var(--color-red-100, #fee2e2)' : 'var(--color-primary-100, #e0e7ff)',
          border: 'none',
          borderRadius: '20px',
          padding: '6px 16px',
          fontSize: '0.85rem',
          fontWeight: 500,
          color: hasError ? 'var(--color-red-700, #b91c1c)' : 'var(--color-primary-700, #4338ca)'
        }}
      >
        {hasError ? (
          <>
            <span style={{ color: 'var(--color-red-500)' }}>!</span>
            Error
          </>
        ) : isFullyReady ? (
          <>
            <span style={{ color: 'var(--color-green-500)' }}>✓</span>
            Ready
          </>
        ) : (
          <>
            <span className="spinner-border spinner-border-sm" />
            {overallProgress}%
          </>
        )}
      </button>
    );
  }

  // Expanded panel view
  return (
    <div
      className="position-fixed"
      style={{
        top: '80px',
        right: '24px',
        width: '380px',
        zIndex: 1050,
        borderRadius: '16px',
        overflow: 'hidden',
        boxShadow: '0 20px 40px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.05)',
        background: 'linear-gradient(135deg, #1e1e2e 0%, #2d2d44 100%)'
      }}
    >
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center p-3 pb-2">
        <div className="d-flex align-items-center gap-2">
          {!isFullyReady && !hasError && (
            <span className="spinner-grow spinner-grow-sm" style={{ color: '#818cf8' }} />
          )}
          {isFullyReady && <span style={{ fontSize: '1.2rem' }}>✓</span>}
          {hasError && <span style={{ fontSize: '1.2rem' }}>⚠️</span>}
          <span className="text-white fw-medium">
            {isFullyReady ? 'All Done!' : hasError ? 'Error Occurred' : 'Loading Dashboard'}
          </span>
        </div>
        <button
          className="btn btn-sm p-1"
          onClick={() => setIsExpanded(false)}
          style={{ color: 'rgba(255,255,255,0.5)', background: 'transparent', border: 'none' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="18,15 12,9 6,15" />
          </svg>
        </button>
      </div>

      {/* Encouragement message */}
      {!isFullyReady && !hasError && (
        <div className="px-3 pb-2">
          <p className="mb-0 small" style={{ color: 'rgba(255,255,255,0.6)' }}>
            {getLoadingMessage(overallProgress)}
          </p>
        </div>
      )}

      {/* Progress bar */}
      <div className="px-3 pb-2">
        <div
          className="progress"
          style={{ height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px' }}
        >
          <div
            className="progress-bar"
            style={{
              width: `${overallProgress}%`,
              background: hasError
                ? 'linear-gradient(90deg, #ef4444, #dc2626)'
                : isFullyReady
                  ? 'linear-gradient(90deg, #22c55e, #16a34a)'
                  : 'linear-gradient(90deg, #818cf8, #6366f1)',
              transition: 'width 0.3s ease',
              borderRadius: '4px'
            }}
          />
        </div>
      </div>

      {/* Operations list */}
      <div className="px-3 pb-3" style={{ maxHeight: '200px', overflowY: 'auto' }}>
        {operations.map((op) => (
          <OperationRow key={op.id} operation={op} />
        ))}
      </div>

      {/* Time remaining */}
      {currentOp && !isFullyReady && (
        <div
          className="px-3 py-2 d-flex justify-content-between align-items-center"
          style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}
        >
          <span className="small" style={{ color: 'rgba(255,255,255,0.5)' }}>
            {currentOp.current.toLocaleString()} / {currentOp.total.toLocaleString()}
          </span>
          <span className="small fw-medium" style={{ color: '#818cf8' }}>
            {getTimeRemaining(currentOp)}
          </span>
        </div>
      )}

      {/* Done actions */}
      {isFullyReady && onDismiss && (
        <div className="px-3 pb-3">
          <button
            className="btn btn-sm w-100"
            onClick={onDismiss}
            style={{
              background: 'rgba(255,255,255,0.1)',
              color: 'white',
              border: 'none'
            }}
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}

function OperationRow({ operation }: { operation: BackgroundOperation }) {
  const { phase, label, current, total, status } = operation;
  const progress = total > 0 ? Math.round((current / total) * 100) : 0;

  return (
    <div className="d-flex align-items-center gap-2 py-1">
      {/* Status icon */}
      <div style={{ width: '20px', textAlign: 'center' }}>
        {status === 'complete' && (
          <span style={{ color: '#22c55e', fontSize: '0.9rem' }}>✓</span>
        )}
        {status === 'running' && (
          <span
            className="spinner-border spinner-border-sm"
            style={{ width: '12px', height: '12px', color: '#818cf8' }}
          />
        )}
        {status === 'pending' && (
          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.8rem' }}>○</span>
        )}
        {status === 'error' && (
          <span style={{ color: '#ef4444', fontSize: '0.9rem' }}>✗</span>
        )}
      </div>

      {/* Label */}
      <span
        className="flex-grow-1 small"
        style={{
          color: status === 'complete' ? 'rgba(255,255,255,0.5)' :
                 status === 'running' ? 'white' :
                 status === 'error' ? '#fca5a5' : 'rgba(255,255,255,0.3)'
        }}
      >
        {label || PHASE_LABELS[phase] || phase}
      </span>

      {/* Progress percentage for running ops */}
      {status === 'running' && total > 0 && (
        <span className="small" style={{ color: 'rgba(255,255,255,0.5)' }}>
          {progress}%
        </span>
      )}
    </div>
  );
}

// Compact inline version for header
export function ProgressPill({ loadingState, onClick }: { loadingState: LoadingState; onClick: () => void }) {
  const { operations, overallProgress, isFullyReady } = loadingState;

  if (operations.length === 0) return null;

  const hasError = operations.some(op => op.status === 'error');
  const isRunning = operations.some(op => op.status === 'running');

  if (isFullyReady && !hasError) return null; // Hide when done

  return (
    <button
      className="btn d-flex align-items-center gap-2"
      onClick={onClick}
      style={{
        background: hasError
          ? 'var(--color-red-100, #fee2e2)'
          : 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
        border: 'none',
        borderRadius: '20px',
        padding: '6px 14px',
        fontSize: '0.8rem',
        fontWeight: 600,
        color: hasError ? 'var(--color-red-700, #b91c1c)' : 'white',
        boxShadow: hasError ? 'none' : '0 2px 8px rgba(99, 102, 241, 0.3)'
      }}
    >
      {hasError ? (
        <>⚠️ Error</>
      ) : (
        <>
          <span
            className="spinner-border spinner-border-sm"
            style={{ width: '12px', height: '12px' }}
          />
          Syncing {overallProgress}%
        </>
      )}
    </button>
  );
}
