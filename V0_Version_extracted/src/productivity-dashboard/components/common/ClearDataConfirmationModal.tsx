import React from 'react';
import { ClearProgress } from '../../services/dbService';

interface ClearDataConfirmationModalProps {
    isOpen: boolean;
    onConfirm: () => void;
    onCancel: () => void;
    isClearing: boolean;
    clearProgress?: ClearProgress | null;
}

// Format number with commas
function formatNumber(num: number): string {
    return num.toLocaleString();
}

export function ClearDataConfirmationModal({
    isOpen,
    onConfirm,
    onCancel,
    isClearing,
    clearProgress
}: ClearDataConfirmationModalProps) {
    if (!isOpen) return null;

    // Calculate progress percentage based on step (each step is 25%)
    const progressPercent = clearProgress
        ? ((clearProgress.step - 1) / clearProgress.totalSteps) * 100 +
          (clearProgress.status === 'complete' ? 25 : Math.min(24, clearProgress.rowsDeleted / 100))
        : 0;

    // Get table icon
    const getTableIcon = (table: string) => {
        switch (table) {
            case 'Events': return 'bi-calendar-event';
            case 'Candidates': return 'bi-people';
            case 'Requisitions': return 'bi-briefcase';
            case 'Users': return 'bi-person';
            default: return 'bi-database';
        }
    };

    return (
        <div className="fixed inset-0 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1055 }}>
            <div className="w-full max-w-lg mx-4">
                <div className="bg-[var(--color-bg-surface)] rounded-lg border border-danger overflow-hidden">
                    <div className="px-4 py-3 bg-danger text-white flex justify-between items-center">
                        <h5 className="text-lg font-semibold mb-0">
                            <i className="bi bi-exclamation-triangle-fill mr-2"></i>
                            {isClearing ? 'Clearing Data...' : 'Clear All Data?'}
                        </h5>
                        {!isClearing && (
                            <button
                                type="button"
                                className="text-white opacity-70 hover:opacity-100"
                                onClick={onCancel}
                            >
                                <i className="bi bi-x text-2xl"></i>
                            </button>
                        )}
                    </div>
                    <div className="p-4">
                        {isClearing && clearProgress ? (
                            // Progress UI
                            <div className="text-center py-3">
                                {/* Progress ring/animation */}
                                <div className="mb-4">
                                    <div
                                        style={{
                                            width: 80,
                                            height: 80,
                                            margin: '0 auto',
                                            position: 'relative'
                                        }}
                                    >
                                        {/* Outer ring background */}
                                        <svg width="80" height="80" viewBox="0 0 80 80">
                                            <circle
                                                cx="40"
                                                cy="40"
                                                r="35"
                                                fill="none"
                                                stroke="rgba(255,255,255,0.1)"
                                                strokeWidth="6"
                                            />
                                            <circle
                                                cx="40"
                                                cy="40"
                                                r="35"
                                                fill="none"
                                                stroke="#dc3545"
                                                strokeWidth="6"
                                                strokeLinecap="round"
                                                strokeDasharray={`${progressPercent * 2.2} 220`}
                                                transform="rotate(-90 40 40)"
                                                style={{ transition: 'stroke-dasharray 0.3s ease' }}
                                            />
                                        </svg>
                                        {/* Center icon */}
                                        <div
                                            style={{
                                                position: 'absolute',
                                                top: '50%',
                                                left: '50%',
                                                transform: 'translate(-50%, -50%)'
                                            }}
                                        >
                                            <i
                                                className={`bi ${getTableIcon(clearProgress.table)}`}
                                                style={{ fontSize: '1.5rem', color: '#dc3545' }}
                                            ></i>
                                        </div>
                                    </div>
                                </div>

                                {/* Step indicator */}
                                <div className="mb-2 text-white/60">
                                    Step {clearProgress.step} of {clearProgress.totalSteps}
                                </div>

                                {/* Table name */}
                                <h5 className="mb-2 text-white">
                                    Deleting {clearProgress.table}
                                </h5>

                                {/* Rows deleted counter */}
                                <div
                                    className="font-mono text-[1.75rem] font-semibold"
                                    style={{
                                        color: '#dc3545'
                                    }}
                                >
                                    {formatNumber(clearProgress.rowsDeleted)}
                                </div>
                                <div className="text-white/50 text-sm">
                                    rows deleted
                                </div>

                                {/* Step progress dots */}
                                <div className="flex justify-center gap-2 mt-4">
                                    {[1, 2, 3, 4].map((step) => (
                                        <div
                                            key={step}
                                            style={{
                                                width: 8,
                                                height: 8,
                                                borderRadius: '50%',
                                                backgroundColor:
                                                    step < clearProgress.step
                                                        ? '#28a745'
                                                        : step === clearProgress.step
                                                        ? '#dc3545'
                                                        : 'rgba(255,255,255,0.2)',
                                                transition: 'background-color 0.3s ease'
                                            }}
                                        />
                                    ))}
                                </div>
                            </div>
                        ) : (
                            // Confirmation UI
                            <>
                                <p className="lead text-danger font-bold">This action cannot be undone.</p>
                                <p>
                                    You are about to <strong>permanently delete</strong> all Requisitions, Candidates, Events, and User data from the database.
                                </p>
                                <p className="mb-0 text-muted-foreground text-sm">
                                    After clearing, you will need to re-import your CSV files or load the demo data again.
                                </p>
                            </>
                        )}
                    </div>
                    {!isClearing && (
                        <div className="px-4 py-3 flex justify-end gap-2" style={{ background: 'rgba(30, 41, 59, 0.8)', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                            <button
                                type="button"
                                className="px-4 py-2 text-sm font-medium rounded-md bg-[var(--color-bg-surface)] hover:bg-[var(--color-bg-base)] border border-glass-border"
                                onClick={onCancel}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="px-4 py-2 text-sm font-medium rounded-md bg-danger hover:bg-danger/90 text-white"
                                onClick={onConfirm}
                            >
                                Yes, Clear Everything
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
