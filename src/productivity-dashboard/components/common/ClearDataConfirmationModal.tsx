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
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1055 }}>
            <div className="modal-dialog modal-dialog-centered">
                <div className="modal-content border-danger">
                    <div className="modal-header bg-danger text-white">
                        <h5 className="modal-title">
                            <i className="bi bi-exclamation-triangle-fill me-2"></i>
                            {isClearing ? 'Clearing Data...' : 'Clear All Data?'}
                        </h5>
                        {!isClearing && (
                            <button
                                type="button"
                                className="btn-close btn-close-white"
                                onClick={onCancel}
                            />
                        )}
                    </div>
                    <div className="modal-body">
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
                                <div className="mb-2" style={{ color: 'rgba(255,255,255,0.6)' }}>
                                    Step {clearProgress.step} of {clearProgress.totalSteps}
                                </div>

                                {/* Table name */}
                                <h5 className="mb-2" style={{ color: '#ffffff' }}>
                                    Deleting {clearProgress.table}
                                </h5>

                                {/* Rows deleted counter */}
                                <div
                                    className="font-monospace"
                                    style={{
                                        fontSize: '1.75rem',
                                        fontWeight: 600,
                                        color: '#dc3545'
                                    }}
                                >
                                    {formatNumber(clearProgress.rowsDeleted)}
                                </div>
                                <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.875rem' }}>
                                    rows deleted
                                </div>

                                {/* Step progress dots */}
                                <div className="d-flex justify-content-center gap-2 mt-4">
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
                                <p className="lead text-danger fw-bold">This action cannot be undone.</p>
                                <p>
                                    You are about to <strong>permanently delete</strong> all Requisitions, Candidates, Events, and User data from the database.
                                </p>
                                <p className="mb-0 text-muted small">
                                    After clearing, you will need to re-import your CSV files or load the demo data again.
                                </p>
                            </>
                        )}
                    </div>
                    {!isClearing && (
                        <div className="modal-footer" style={{ background: 'rgba(30, 41, 59, 0.8)', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                            <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={onCancel}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="btn btn-danger"
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
