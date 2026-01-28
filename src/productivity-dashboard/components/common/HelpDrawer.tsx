// HelpDrawer.tsx
// A reusable drawer that slides in from the right with contextual help content
// Uses glass-drawer CSS classes for translucent glass effect

import React from 'react';
import { createPortal } from 'react-dom';
import { Eye, Cog, Search, AlertTriangle, Lightbulb, X } from 'lucide-react';

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
        className="fixed inset-0 glass-backdrop"
        style={{
          zIndex: 1040,
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? 'auto' : 'none',
          transition: 'opacity 0.3s ease-in-out',
        }}
        onClick={onClose}
      />

      {/* Drawer - uses glass-drawer class for translucent effect */}
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
        <div className="glass-drawer-header px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-medium uppercase tracking-wider mb-1 text-muted-foreground">
                Help
              </div>
              <div id="help-drawer-title" className="text-lg font-semibold text-foreground">
                {title}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label="Close help"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
          {/* What You're Looking At */}
          <section>
            <div className="flex items-center gap-2 mb-2">
              <Eye className="w-4 h-4 text-muted-foreground" />
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                What You're Looking At
              </div>
            </div>
            <div className="text-sm leading-relaxed text-foreground">
              {content.whatYouSee}
            </div>
          </section>

          {/* How It Works */}
          <section>
            <div className="flex items-center gap-2 mb-2">
              <Cog className="w-4 h-4 text-muted-foreground" />
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                How It Works
              </div>
            </div>
            <div className="text-sm leading-relaxed text-foreground">
              {content.howItWorks}
            </div>
          </section>

          {/* What to Look For */}
          {content.whatToLookFor.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-2">
                <Search className="w-4 h-4 text-muted-foreground" />
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  What To Look For
                </div>
              </div>
              <ul className="space-y-1.5 ml-1">
                {content.whatToLookFor.map((item, index) => (
                  <li
                    key={index}
                    className="text-sm leading-relaxed flex items-start gap-2 text-foreground"
                  >
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-muted-foreground flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Watch Out For */}
          {content.watchOutFor.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-warn" />
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Watch Out For
                </div>
              </div>
              <ul className="space-y-1.5 ml-1">
                {content.watchOutFor.map((item, index) => (
                  <li
                    key={index}
                    className="text-sm leading-relaxed flex items-start gap-2 text-foreground"
                  >
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-warn flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        {/* Footer Tip */}
        <div className="glass-drawer-footer px-4 py-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground/70">
            <Lightbulb className="w-3.5 h-3.5" />
            <span>Tip: Click outside or press Escape to close</span>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}

export default HelpDrawer;
