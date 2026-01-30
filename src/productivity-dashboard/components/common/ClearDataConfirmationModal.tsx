import React from 'react';
import { AlertTriangle, X, Calendar, Users, Briefcase, User, Database, XCircle } from 'lucide-react';
import { ClearProgress } from '../../services/dbService';

interface ClearDataConfirmationModalProps {
    isOpen: boolean;
    onConfirm: () => void;
    onCancel: () => void;
    isClearing: boolean;
    clearProgress?: ClearProgress | null;
    error?: string | null;
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
    clearProgress,
    error
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
            case 'Events': return <Calendar className="w-6 h-6" />;
            case 'Candidates': return <Users className="w-6 h-6" />;
            case 'Requisitions': return <Briefcase className="w-6 h-6" />;
            case 'Users': return <User className="w-6 h-6" />;
            default: return <Database className="w-6 h-6" />;
        }
    };

    // Check if error is a timeout
    const isTimeout = error?.toLowerCase().includes('timeout');

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
                onClick={!isClearing ? onCancel : undefined}
            />

            {/* Modal */}
            <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
                <div className="w-full max-w-lg">
                    <div className="glass-panel rounded-xl border border-bad/30 overflow-hidden">
                        {/* Header */}
                        <div className="px-6 py-4 bg-bad text-white flex justify-between items-center">
                            <h5 className="text-lg font-semibold flex items-center gap-2">
                                <AlertTriangle className="w-5 h-5" />
                                {error ? 'Clear Failed' : isClearing ? 'Clearing Data...' : 'Clear All Data?'}
                            </h5>
                            {!isClearing && (
                                <button
                                    type="button"
                                    className="p-1 rounded text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                                    onClick={onCancel}
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            )}
                        </div>

                        {/* Body */}
                        <div className="p-6">
                            {error ? (
                                // Error state
                                <div className="text-center py-4">
                                    <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 rounded-full bg-bad/20">
                                        <XCircle className="w-8 h-8 text-bad" />
                                    </div>
                                    <h5 className="text-foreground mb-3 font-semibold">
                                        {isTimeout ? 'Database Operation Timed Out' : 'Failed to Clear Data'}
                                    </h5>
                                    <p className="text-muted-foreground text-sm mb-4">
                                        {isTimeout ? (
                                            <>
                                                The database didn't respond in time. This can happen with slow connections or large datasets.
                                                <br /><br />
                                                Try again, or contact support if the issue persists.
                                            </>
                                        ) : (
                                            error
                                        )}
                                    </p>
                                    <div className="p-3 rounded-lg bg-bad/10 border border-bad/20">
                                        <p className="text-xs text-bad font-mono break-all">{error}</p>
                                    </div>
                                </div>
                            ) : isClearing && clearProgress ? (
                                // Progress UI
                                <div className="text-center py-3">
                                    {/* Progress ring/animation */}
                                    <div className="mb-4">
                                        <div className="relative w-20 h-20 mx-auto">
                                            {/* Outer ring background */}
                                            <svg width="80" height="80" viewBox="0 0 80 80" className="rotate-[-90deg]">
                                                <circle
                                                    cx="40"
                                                    cy="40"
                                                    r="35"
                                                    fill="none"
                                                    className="stroke-muted/30"
                                                    strokeWidth="6"
                                                />
                                                <circle
                                                    cx="40"
                                                    cy="40"
                                                    r="35"
                                                    fill="none"
                                                    className="stroke-bad"
                                                    strokeWidth="6"
                                                    strokeLinecap="round"
                                                    strokeDasharray={`${progressPercent * 2.2} 220`}
                                                    style={{ transition: 'stroke-dasharray 0.3s ease' }}
                                                />
                                            </svg>
                                            {/* Center icon */}
                                            <div className="absolute inset-0 flex items-center justify-center text-bad">
                                                {getTableIcon(clearProgress.table)}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Step indicator */}
                                    <div className="mb-2 text-muted-foreground text-sm">
                                        Step {clearProgress.step} of {clearProgress.totalSteps}
                                    </div>

                                    {/* Table name */}
                                    <h5 className="mb-2 text-foreground font-medium">
                                        Deleting {clearProgress.table}
                                    </h5>

                                    {/* Rows deleted counter */}
                                    <div className="font-mono text-3xl font-semibold text-bad">
                                        {formatNumber(clearProgress.rowsDeleted)}
                                    </div>
                                    <div className="text-muted-foreground text-sm">
                                        rows deleted
                                    </div>

                                    {/* Step progress dots */}
                                    <div className="flex justify-center gap-2 mt-4">
                                        {[1, 2, 3, 4].map((step) => (
                                            <div
                                                key={step}
                                                className={`w-2 h-2 rounded-full transition-colors ${
                                                    step < clearProgress.step
                                                        ? 'bg-good'
                                                        : step === clearProgress.step
                                                        ? 'bg-bad'
                                                        : 'bg-muted'
                                                }`}
                                            />
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                // Confirmation UI
                                <div className="space-y-4">
                                    <p className="text-bad font-semibold">This action cannot be undone.</p>
                                    <p className="text-foreground">
                                        You are about to <strong>permanently delete</strong> all Requisitions, Candidates, Events, and User data from the database.
                                    </p>
                                    <p className="text-muted-foreground text-sm">
                                        After clearing, you will need to re-import your CSV files or load the demo data again.
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        {(!isClearing || error) && (
                            <div className="px-6 py-4 flex justify-end gap-3 border-t border-border">
                                <button
                                    type="button"
                                    className="px-4 py-2 text-sm font-medium rounded-md bg-muted hover:bg-muted/80 text-foreground border border-border transition-colors"
                                    onClick={onCancel}
                                >
                                    {error ? 'Close' : 'Cancel'}
                                </button>
                                {!error && (
                                    <button
                                        type="button"
                                        className="px-4 py-2 text-sm font-medium rounded-md bg-bad hover:bg-bad/90 text-white transition-colors"
                                        onClick={onConfirm}
                                    >
                                        Yes, Clear Everything
                                    </button>
                                )}
                                {error && (
                                    <button
                                        type="button"
                                        className="px-4 py-2 text-sm font-medium rounded-md bg-bad hover:bg-bad/90 text-white transition-colors"
                                        onClick={onConfirm}
                                    >
                                        Retry
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}
