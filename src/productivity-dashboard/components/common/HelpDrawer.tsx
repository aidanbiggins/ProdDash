// HelpDrawer.tsx
// A reusable drawer that slides in from the right with contextual help content
// Matches the style of ExplainDrawer and ActionDetailDrawer
// Uses React Portal to render at document root for proper z-index stacking

import React from 'react';
import { createPortal } from 'react-dom';

export interface HelpContent {
  /** "What You're Looking At" - paragraph explaining what the section shows */
  whatYouSee: string;
  /** "How It Works" - paragraph explaining the methodology */
  howItWorks: string;
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
        className="position-fixed top-0 start-0 w-100 h-100"
        style={{
          backgroundColor: 'rgba(0,0,0,0.5)',
          zIndex: 1040,
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? 'auto' : 'none',
          transition: 'opacity 0.3s ease-in-out',
        }}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className="position-fixed top-0 end-0 h-100 d-flex flex-column"
        style={{
          width: '420px',
          maxWidth: '90vw',
          backgroundColor: 'var(--surface-elevated, #1e293b)',
          zIndex: 1050,
          boxShadow: '-4px 0 20px rgba(0,0,0,0.3)',
          transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.3s ease-in-out',
          visibility: isOpen ? 'visible' : 'hidden',
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-drawer-title"
      >
        {/* Header */}
        <div
          className="d-flex align-items-center justify-content-between p-3"
          style={{
            borderBottom: '1px solid rgba(255,255,255,0.1)',
            backgroundColor: 'rgba(0,0,0,0.2)',
          }}
        >
          <div>
            <div
              className="small text-uppercase"
              style={{ color: 'var(--text-secondary)', letterSpacing: '0.05em' }}
            >
              Help
            </div>
            <h5 id="help-drawer-title" className="mb-0" style={{ color: 'var(--text-primary)' }}>
              {title}
            </h5>
          </div>
          <button
            className="btn btn-sm"
            onClick={onClose}
            style={{ color: 'var(--text-secondary)' }}
            aria-label="Close help drawer"
          >
            <i className="bi bi-x-lg"></i>
          </button>
        </div>

        {/* Content */}
        <div className="flex-grow-1 overflow-auto p-3">
          {/* What You're Looking At */}
          <div className="mb-4">
            <SectionHeader icon="bi-eye">What You're Looking At</SectionHeader>
            <p className="mb-0 small" style={{ color: 'var(--text-primary)', lineHeight: 1.6 }}>
              {content.whatYouSee}
            </p>
          </div>

          {/* How It Works */}
          <div className="mb-4">
            <SectionHeader icon="bi-gear">How It Works</SectionHeader>
            <p className="mb-0 small" style={{ color: 'var(--text-primary)', lineHeight: 1.6 }}>
              {content.howItWorks}
            </p>
          </div>

          {/* What to Look For */}
          <div className="mb-4">
            <SectionHeader icon="bi-search">What to Look For</SectionHeader>
            <ul className="mb-0 ps-3 small" style={{ color: 'var(--text-primary)' }}>
              {content.whatToLookFor.map((item, index) => (
                <li key={index} className="mb-1">{item}</li>
              ))}
            </ul>
          </div>

          {/* Watch Out For */}
          <div className="mb-4">
            <SectionHeader icon="bi-exclamation-triangle">Watch Out For</SectionHeader>
            <ul className="mb-0 ps-3 small" style={{ color: 'var(--text-primary)' }}>
              {content.watchOutFor.map((item, index) => (
                <li key={index} className="mb-1">{item}</li>
              ))}
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div
          className="p-3 small"
          style={{
            borderTop: '1px solid rgba(255,255,255,0.1)',
            color: 'var(--text-secondary)',
          }}
        >
          <i className="bi bi-lightbulb me-1"></i>
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
      className="text-uppercase small mb-2 d-flex align-items-center gap-2"
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
