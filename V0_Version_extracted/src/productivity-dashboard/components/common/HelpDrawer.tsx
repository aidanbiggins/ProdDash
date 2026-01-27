// HelpDrawer.tsx
// A reusable drawer that slides in from the right with contextual help content
// Matches the style of ExplainDrawer and ActionDetailDrawer
// Uses React Portal to render at document root for proper z-index stacking

import React from 'react';
import { createPortal } from 'react-dom';

export interface HelpContent {
  /** "What You're Looking At" - paragraph explaining what the section shows */
  whatYouSee: string | React.ReactNode;
  /** "How It Works" - paragraph explaining the methodology (can include tables, etc.) */
  howItWorks: string | React.ReactNode;
  /** "What to Look For" - bullet points of key insights */
  whatToLookFor: string[];
  /** "Watch Out For" - bullet points of caveats/gotchas */
  watchOutFor: string[];
}

export interface HelpDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  content: HelpContent;
}

export function HelpDrawer({ isOpen, onClose, title, content }: HelpDrawerProps) {
  // Handle escape key
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className="fixed top-0 left-0 w-full h-full glass-backdrop"
        style={{
          zIndex: 1040,
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? 'auto' : 'none',
          transition: 'opacity 0.3s ease-in-out',
        }}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className="fixed top-0 right-0 h-full flex flex-col glass-drawer"
        style={{
          width: '420px',
          maxWidth: '90vw',
          zIndex: 1050,
          transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.3s ease-in-out',
          visibility: isOpen ? 'visible' : 'hidden',
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-drawer-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-3 glass-drawer-header">
          <div>
            <div
              className="text-sm uppercase"
              style={{ color: 'var(--text-secondary)', letterSpacing: '0.05em' }}
            >
              Help
            </div>
            <h5 id="help-drawer-title" className="mb-0" style={{ color: 'var(--text-primary)' }}>
              {title}
            </h5>
          </div>
          <button
            className="p-1 text-sm rounded hover:bg-white/10"
            onClick={onClose}
            style={{ color: 'var(--text-secondary)' }}
            aria-label="Close help drawer"
          >
            <i className="bi bi-x-lg"></i>
          </button>
        </div>

        {/* Content */}
        <div className="grow overflow-auto p-3">
          {/* What You're Looking At */}
          <div className="mb-4">
            <SectionHeader icon="bi-eye">What You're Looking At</SectionHeader>
            <div className="text-sm" style={{ color: 'var(--text-primary)', lineHeight: 1.6 }}>
              {content.whatYouSee}
            </div>
          </div>

          {/* How It Works */}
          <div className="mb-4">
            <SectionHeader icon="bi-gear">How It Works</SectionHeader>
            <div className="text-sm" style={{ color: 'var(--text-primary)', lineHeight: 1.6 }}>
              {content.howItWorks}
            </div>
          </div>

          {/* What to Look For */}
          <div className="mb-4">
            <SectionHeader icon="bi-search">What to Look For</SectionHeader>
            <ul className="mb-0 pl-3 text-sm" style={{ color: 'var(--text-primary)' }}>
              {content.whatToLookFor.map((item, index) => (
                <li key={index} className="mb-1">{item}</li>
              ))}
            </ul>
          </div>

          {/* Watch Out For */}
          <div className="mb-4">
            <SectionHeader icon="bi-exclamation-triangle">Watch Out For</SectionHeader>
            <ul className="mb-0 pl-3 text-sm" style={{ color: 'var(--text-primary)' }}>
              {content.watchOutFor.map((item, index) => (
                <li key={index} className="mb-1">{item}</li>
              ))}
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 text-sm glass-drawer-footer" style={{ color: 'var(--text-secondary)' }}>
          <i className="bi bi-lightbulb mr-1"></i>
          Tip: Click outside or press Escape to close
        </div>
      </div>
    </>,
    document.body
  );
}

// Helper component matching ExplainDrawer's SectionHeader
function SectionHeader({ children, icon }: { children: React.ReactNode; icon: string }) {
  return (
    <div
      className="uppercase text-sm mb-2 flex items-center gap-2"
      style={{
        color: 'var(--text-secondary)',
        letterSpacing: '0.05em',
        fontWeight: 600,
      }}
    >
      <i className={`bi ${icon}`} style={{ fontSize: '0.875rem' }}></i>
      {children}
    </div>
  );
}

export default HelpDrawer;
