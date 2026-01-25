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
                className="fixed top-0 left-0 w-full h-full glass-backdrop transition-opacity duration-300 ease-in-out"
                style={{
                    zIndex: 1040,
                    opacity: 1,
                }}
                onClick={onClose}
            />

            {/* Drawer */}
            <div
                className="fixed top-0 right-0 h-full flex flex-col glass-drawer max-w-[90vw] transition-transform duration-300 ease-in-out"
                style={{
                    width,
                    zIndex: 1050,
                    transform: 'translateX(0)',
                }}
                role="dialog"
                aria-modal="true"
                aria-labelledby="glass-drawer-title"
            >
                {/* Header */}
                <div className="flex items-center justify-between p-3 glass-drawer-header">
                    <div>
                        {subtitle && (
                            <div
                                className="text-sm uppercase tracking-wide"
                                style={{ color: 'var(--text-secondary)' }}
                            >
                                {subtitle}
                            </div>
                        )}
                        <h5 id="glass-drawer-title" className="mb-0" style={{ color: 'var(--text-primary)' }}>
                            {title}
                        </h5>
                    </div>
                    <button
                        className="text-sm"
                        onClick={onClose}
                        style={{ color: 'var(--text-secondary)' }}
                        aria-label="Close drawer"
                    >
                        <i className="bi bi-x-lg"></i>
                    </button>
                </div>

                {/* Content */}
                <div className="grow overflow-auto p-3">
                    {children}
                </div>
            </div>
        </>,
        document.body
    );
}

export default GlassDrawer;
