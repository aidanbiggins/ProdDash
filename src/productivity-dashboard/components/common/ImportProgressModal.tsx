import React from 'react';
import { ImportProgress } from '../../services/dbService';

interface ImportProgressModalProps {
    isOpen: boolean;
    progress: ImportProgress | null;
}

// Format number with commas
function formatNumber(num: number): string {
    return num.toLocaleString();
}

export function ImportProgressModal({
    isOpen,
    progress
}: ImportProgressModalProps) {
    if (!isOpen || !progress) return null;

    // Calculate progress percentage
    const getProgressPercent = () => {
        if (progress.phase === 'parsing') {
            return progress.status === 'complete' ? 20 : 10;
        }
        // Persist phase: 20% base + up to 80% based on step and row progress
        const stepBase = 20 + ((progress.step - 1) / progress.totalSteps) * 80;
        const stepProgress = progress.totalRows > 0
            ? (progress.rowsProcessed / progress.totalRows) * (80 / progress.totalSteps)
            : 0;
        return Math.min(100, stepBase + stepProgress);
    };

    const progressPercent = getProgressPercent();

    // Get phase icon and color
    const getPhaseIcon = () => {
        if (progress.phase === 'parsing') {
            return 'bi-file-earmark-text';
        }
        switch (progress.table) {
            case 'Users': return 'bi-person';
            case 'Requisitions': return 'bi-briefcase';
            case 'Candidates': return 'bi-people';
            case 'Events': return 'bi-calendar-event';
            default: return 'bi-database';
        }
    };

    const phaseColor = progress.phase === 'parsing' ? '#3b82f6' : '#10b981';

    return (
        <div className="fixed inset-0 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1055 }}>
            <div className="w-full max-w-lg mx-4">
                <div className="rounded-lg" style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <div className="p-4 rounded-t-lg" style={{ background: 'rgba(59, 130, 246, 0.2)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                        <h5 className="text-lg font-medium" style={{ color: '#ffffff' }}>
                            <i className="bi bi-cloud-upload mr-2" style={{ color: phaseColor }}></i>
                            Importing Data
                        </h5>
                    </div>
                    <div className="p-4">
                        <div className="text-center py-3">
                            {/* Progress ring */}
                            <div className="mb-4">
                                <div
                                    style={{
                                        width: 100,
                                        height: 100,
                                        margin: '0 auto',
                                        position: 'relative'
                                    }}
                                >
                                    {/* Outer ring background */}
                                    <svg width="100" height="100" viewBox="0 0 100 100">
                                        <circle
                                            cx="50"
                                            cy="50"
                                            r="42"
                                            fill="none"
                                            stroke="rgba(255,255,255,0.1)"
                                            strokeWidth="8"
                                        />
                                        <circle
                                            cx="50"
                                            cy="50"
                                            r="42"
                                            fill="none"
                                            stroke={phaseColor}
                                            strokeWidth="8"
                                            strokeLinecap="round"
                                            strokeDasharray={`${progressPercent * 2.64} 264`}
                                            transform="rotate(-90 50 50)"
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
                                            className={`bi ${getPhaseIcon()}`}
                                            style={{ fontSize: '2rem', color: phaseColor }}
                                        ></i>
                                    </div>
                                </div>
                            </div>

                            {/* Phase indicator */}
                            <div className="mb-2" style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.875rem' }}>
                                {progress.phase === 'parsing' ? 'Phase 1 of 2' : `Phase 2 of 2 \u2022 Step ${progress.step} of ${progress.totalSteps}`}
                            </div>

                            {/* Current action */}
                            <h5 className="mb-3" style={{ color: '#ffffff' }}>
                                {progress.phase === 'parsing'
                                    ? 'Processing CSV'
                                    : `Saving ${progress.table}`}
                            </h5>

                            {/* Progress stats */}
                            {progress.phase === 'persisting' && progress.totalRows > 0 && (
                                <>
                                    <div
                                        className="font-monospace"
                                        style={{
                                            fontSize: '2rem',
                                            fontWeight: 600,
                                            color: phaseColor
                                        }}
                                    >
                                        {formatNumber(progress.rowsProcessed)}
                                    </div>
                                    <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.875rem' }}>
                                        of {formatNumber(progress.totalRows)} rows
                                    </div>
                                </>
                            )}

                            {progress.phase === 'parsing' && (
                                <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.875rem' }}>
                                    {progress.status === 'complete'
                                        ? `Parsed ${formatNumber(progress.rowsProcessed)} records`
                                        : 'Reading and parsing CSV data...'}
                                </div>
                            )}

                            {/* Step progress indicators */}
                            {progress.phase === 'persisting' && (
                                <div className="flex justify-center gap-3 mt-4">
                                    {['Users', 'Requisitions', 'Candidates', 'Events'].map((table, idx) => {
                                        const stepNum = idx + 1;
                                        const isComplete = stepNum < progress.step ||
                                            (stepNum === progress.step && progress.status === 'complete');
                                        const isCurrent = stepNum === progress.step && progress.status !== 'complete';

                                        return (
                                            <div
                                                key={table}
                                                className="text-center"
                                                style={{
                                                    opacity: isComplete || isCurrent ? 1 : 0.4
                                                }}
                                            >
                                                <div
                                                    style={{
                                                        width: 32,
                                                        height: 32,
                                                        borderRadius: '50%',
                                                        backgroundColor: isComplete
                                                            ? '#10b981'
                                                            : isCurrent
                                                            ? 'rgba(16, 185, 129, 0.2)'
                                                            : 'rgba(255,255,255,0.1)',
                                                        border: isCurrent ? '2px solid #10b981' : 'none',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        margin: '0 auto 4px',
                                                        transition: 'all 0.3s ease'
                                                    }}
                                                >
                                                    {isComplete ? (
                                                        <i className="bi bi-check" style={{ color: '#fff', fontSize: '1rem' }}></i>
                                                    ) : (
                                                        <span style={{ color: isCurrent ? '#10b981' : 'rgba(255,255,255,0.5)', fontSize: '0.75rem' }}>
                                                            {stepNum}
                                                        </span>
                                                    )}
                                                </div>
                                                <div style={{
                                                    fontSize: '0.625rem',
                                                    color: isComplete ? '#10b981' : isCurrent ? '#ffffff' : 'rgba(255,255,255,0.5)',
                                                    whiteSpace: 'nowrap'
                                                }}>
                                                    {table}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
