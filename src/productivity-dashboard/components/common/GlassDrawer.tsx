/**
 * GlassDrawer
 *
 * A generic reusable drawer component that slides in from the right.
 * Uses the same glass styling as HelpDrawer, ExplainDrawer, etc.
 * but allows custom content instead of structured sections.
 */

import React from 'react';
import { createPortal } from 'react-dom';

export interface GlassDrawerProps {
    /** Title displayed in the drawer header */
    title: string;
    /** Optional subtitle displayed below the title */
    subtitle?: string;
    /** Callback when drawer is closed */
    onClose: () => void;
    /** Width of the drawer (default: 420px) */
    width?: string;
    /** Content to render inside the drawer */
    children: React.ReactNode;
}

export function GlassDrawer({
    title,
    subtitle,
    onClose,
    width = '420px',
    children
}: GlassDrawerProps) {
    // Handle escape key
    React.useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [onClose]);

    return createPortal(
        <>
            {/* Backdrop */}
            <div
                className="position-fixed top-0 start-0 w-100 h-100 glass-backdrop"
                style={{
                    zIndex: 1040,
                    opacity: 1,
                    transition: 'opacity 0.3s ease-in-out',
                }}
                onClick={onClose}
            />

            {/* Drawer */}
            <div
                className="position-fixed top-0 end-0 h-100 d-flex flex-column glass-drawer"
                style={{
                    width,
                    maxWidth: '90vw',
                    zIndex: 1050,
                    transform: 'translateX(0)',
                    transition: 'transform 0.3s ease-in-out',
                }}
                role="dialog"
                aria-modal="true"
                aria-labelledby="glass-drawer-title"
            >
                {/* Header */}
                <div className="d-flex align-items-center justify-content-between p-3 glass-drawer-header">
                    <div>
                        {subtitle && (
                            <div
                                className="small text-uppercase"
                                style={{ color: 'var(--text-secondary)', letterSpacing: '0.05em' }}
                            >
                                {subtitle}
                            </div>
                        )}
                        <h5 id="glass-drawer-title" className="mb-0" style={{ color: 'var(--text-primary)' }}>
                            {title}
                        </h5>
                    </div>
                    <button
                        className="btn btn-sm"
                        onClick={onClose}
                        style={{ color: 'var(--text-secondary)' }}
                        aria-label="Close drawer"
                    >
                        <i className="bi bi-x-lg"></i>
                    </button>
                </div>

                {/* Content */}
                <div className="flex-grow-1 overflow-auto p-3">
                    {children}
                </div>
            </div>
        </>,
        document.body
    );
}

export default GlassDrawer;
