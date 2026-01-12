import React from 'react';

interface ClearDataConfirmationModalProps {
    isOpen: boolean;
    onConfirm: () => void;
    onCancel: () => void;
    isClearing: boolean;
}

export function ClearDataConfirmationModal({
    isOpen,
    onConfirm,
    onCancel,
    isClearing
}: ClearDataConfirmationModalProps) {
    if (!isOpen) return null;

    return (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1055 }}>
            <div className="modal-dialog modal-dialog-centered">
                <div className="modal-content border-danger">
                    <div className="modal-header bg-danger text-white">
                        <h5 className="modal-title">
                            <i className="bi bi-exclamation-triangle-fill me-2"></i>
                            Clear All Data?
                        </h5>
                        <button
                            type="button"
                            className="btn-close btn-close-white"
                            onClick={onCancel}
                            disabled={isClearing}
                        />
                    </div>
                    <div className="modal-body">
                        <p className="lead text-danger fw-bold">This action cannot be undone.</p>
                        <p>
                            You are about to <strong>permanently delete</strong> all Requisitions, Candidates, Events, and User data from the database.
                        </p>
                        <p className="mb-0 text-muted small">
                            After clearing, you will need to re-import your CSV files or load the demo data again.
                        </p>
                    </div>
                    <div className="modal-footer" style={{ background: 'rgba(30, 41, 59, 0.8)', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                        <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={onCancel}
                            disabled={isClearing}
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            className="btn btn-danger"
                            onClick={onConfirm}
                            disabled={isClearing}
                        >
                            {isClearing ? (
                                <>
                                    <span className="spinner-border spinner-border-sm me-2" />
                                    Clearing...
                                </>
                            ) : (
                                'Yes, Clear Everything'
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
