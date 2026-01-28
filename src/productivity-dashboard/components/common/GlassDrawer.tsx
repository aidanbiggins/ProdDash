/**
 * GlassDrawer
 *
 * A generic reusable drawer component that slides in from the right.
 * Uses the same glass styling as HelpDrawer, ExplainDrawer, etc.
 * but allows custom content instead of structured sections.
 *
 * Mobile-responsive: Full-width on mobile (<md), respects width prop on desktop.
 */

import React from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export interface GlassDrawerProps {
    /** Title displayed in the drawer header */
    title: string;
    /** Optional subtitle displayed below the title */
    subtitle?: string;
    /** Callback when drawer is closed */
    onClose: () => void;
    /** Width of the drawer on desktop (default: 420px). On mobile, drawer is full-width. */
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
                className="fixed inset-0 glass-backdrop transition-opacity duration-300 ease-in-out"
                style={{ zIndex: 1040 }}
                onClick={onClose}
            />

            {/* Drawer - Full width on mobile, respects width prop on md+ */}
            <div
                className="fixed top-0 right-0 h-full w-full md:w-auto md:max-w-[90vw] flex flex-col glass-drawer transition-transform duration-300 ease-in-out"
                style={{
                    zIndex: 1050,
                    // On md+ screens, use the width prop
                    '--drawer-width': width,
                } as React.CSSProperties}
                role="dialog"
                aria-modal="true"
                aria-labelledby="glass-drawer-title"
            >
                {/* Apply width on desktop via inline style override */}
                <style>{`
                    @media (min-width: 768px) {
                        [aria-labelledby="glass-drawer-title"] {
                            width: var(--drawer-width, 420px) !important;
                        }
                    }
                `}</style>

                {/* Header */}
                <div className="flex items-center justify-between p-3 md:p-4 glass-drawer-header border-b border-white/[0.06]">
                    <div className="min-w-0 flex-1">
                        {subtitle && (
                            <div className="text-xs uppercase tracking-wide text-muted-foreground">
                                {subtitle}
                            </div>
                        )}
                        <h5 id="glass-drawer-title" className="mb-0 text-foreground font-semibold truncate">
                            {title}
                        </h5>
                    </div>
                    <button
                        className="flex-shrink-0 ml-3 p-2 rounded-md hover:bg-white/[0.06] text-muted-foreground hover:text-foreground transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                        onClick={onClose}
                        aria-label="Close drawer"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="grow overflow-auto p-3 md:p-4">
                    {children}
                </div>
            </div>
        </>,
        document.body
    );
}

export default GlassDrawer;
