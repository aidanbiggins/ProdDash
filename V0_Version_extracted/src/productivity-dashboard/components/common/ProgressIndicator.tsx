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
        className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium border-0 ${
          hasError ? 'bg-red-500/15 text-red-400' : 'bg-amber-500/15 text-amber-500'
        }`}
        onClick={() => setIsExpanded(true)}
      >
        {hasError ? (
          <>
            <span className="text-red-500">!</span>
            Error
          </>
        ) : isFullyReady ? (
          <>
            <span className="text-green-500">✓</span>
            Ready
          </>
        ) : (
          <>
            <span className="inline-block w-4 h-4 border-2 border-current border-r-transparent rounded-full animate-spin" />
            {overallProgress}%
          </>
        )}
      </button>
    );
  }

  // Expanded panel view
  return (
    <div
      className="fixed w-[380px] z-[1050] rounded-2xl overflow-hidden"
      style={{
        top: '80px',
        right: '24px',
        boxShadow: '0 20px 40px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.05)',
        background: 'linear-gradient(135deg, #1e1e2e 0%, #2d2d44 100%)'
      }}
    >
      {/* Header */}
      <div className="flex justify-between items-center p-3 pb-2">
        <div className="flex items-center gap-2">
          {!isFullyReady && !hasError && (
            <span className="inline-block w-4 h-4 rounded-full animate-pulse" style={{ backgroundColor: '#818cf8', opacity: 0.75 }} />
          )}
          {isFullyReady && <span className="text-xl">✓</span>}
          {hasError && <span className="text-xl">⚠️</span>}
          <span className="text-white font-medium">
            {isFullyReady ? 'All Done!' : hasError ? 'Error Occurred' : 'Loading Dashboard'}
          </span>
        </div>
        <button
          className="p-1 bg-transparent border-0 text-white/50 hover:text-white/80"
          onClick={() => setIsExpanded(false)}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="18,15 12,9 6,15" />
          </svg>
        </button>
      </div>

      {/* Encouragement message */}
      {!isFullyReady && !hasError && (
        <div className="px-3 pb-2">
          <p className="mb-0 text-sm text-white/60">
            {getLoadingMessage(overallProgress)}
          </p>
        </div>
      )}

      {/* Progress bar */}
      <div className="px-3 pb-2">
        <div className="h-2 bg-white/10 rounded overflow-hidden">
          <div
            className="h-full transition-all duration-300 ease-in-out rounded"
            style={{
              width: `${overallProgress}%`,
              background: hasError
                ? 'linear-gradient(90deg, #ef4444, #dc2626)'
                : isFullyReady
                  ? 'linear-gradient(90deg, #22c55e, #16a34a)'
                  : 'linear-gradient(90deg, #818cf8, #6366f1)'
            }}
          />
        </div>
      </div>

      {/* Operations list */}
      <div className="px-3 pb-3 max-h-[200px] overflow-y-auto">
        {operations.map((op) => (
          <OperationRow key={op.id} operation={op} />
        ))}
      </div>

      {/* Time remaining */}
      {currentOp && !isFullyReady && (
        <div className="px-3 py-2 flex justify-between items-center border-t border-white/10">
          <span className="text-sm text-white/50">
            {currentOp.current.toLocaleString()} / {currentOp.total.toLocaleString()}
          </span>
          <span className="text-sm font-medium" style={{ color: '#818cf8' }}>
            {getTimeRemaining(currentOp)}
          </span>
        </div>
      )}

      {/* Done actions */}
      {isFullyReady && onDismiss && (
        <div className="px-3 pb-3">
          <button
            className="w-full px-4 py-2 text-sm font-medium rounded-md text-white border-0"
            onClick={onDismiss}
            style={{
              background: 'rgba(255,255,255,0.1)'
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
    <div className="flex items-center gap-2 py-1">
      {/* Status icon */}
      <div className="w-5 text-center">
        {status === 'complete' && (
          <span style={{ color: '#22c55e', fontSize: '0.9rem' }}>✓</span>
        )}
        {status === 'running' && (
          <span className="inline-block w-3 h-3 border-2 border-current border-r-transparent rounded-full animate-spin" style={{ color: '#818cf8' }} />
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
        className="flex-1 text-sm"
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
        <span className="text-sm text-white/50">
          {progress}%
        </span>
      )}
    </div>
  );
}

// Compact inline version for header
// Includes debounce to prevent layout shift from brief loading states
export function ProgressPill({ loadingState, onClick }: { loadingState: LoadingState; onClick: () => void }) {
  const { operations, overallProgress, isFullyReady } = loadingState;
  const [showAfterDelay, setShowAfterDelay] = useState(false);

  const hasError = operations.some(op => op.status === 'error');
  const isRunning = operations.some(op => op.status === 'running');

  // Debounce showing the pill - only show after 200ms of loading
  // This prevents layout shift from brief operations
  useEffect(() => {
    if (isRunning && !isFullyReady) {
      const timer = setTimeout(() => setShowAfterDelay(true), 200);
      return () => clearTimeout(timer);
    } else {
      setShowAfterDelay(false);
    }
  }, [isRunning, isFullyReady]);

  if (operations.length === 0) return null;
  if (isFullyReady && !hasError) return null; // Hide when done

  // Don't show until delay has passed (unless there's an error)
  if (!showAfterDelay && !hasError) return null;

  return (
    <button
      className="flex items-center gap-2 border-0 rounded-full px-3.5 py-1.5 text-xs font-semibold"
      onClick={onClick}
      style={{
        background: hasError
          ? 'var(--color-red-100, #fee2e2)'
          : 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
        color: hasError ? 'var(--color-red-700, #b91c1c)' : 'white',
        boxShadow: hasError ? 'none' : '0 2px 8px rgba(99, 102, 241, 0.3)'
      }}
    >
      {hasError ? (
        <>⚠️ Error</>
      ) : (
        <>
          <span className="inline-block w-3 h-3 border-2 border-current border-r-transparent rounded-full animate-spin" />
          Syncing {overallProgress}%
        </>
      )}
    </button>
  );
}
