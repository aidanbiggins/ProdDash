'use client';

import React, { useState } from 'react';
import { HelpCircle } from 'lucide-react';
import { HelpDrawer, HelpContent } from '../common/HelpDrawer';

/**
 * SubViewHeader helpContent format - accepts either:
 * 1. Legacy V2 format with `description` (backwards compat)
 * 2. HelpContent format with `whatYouSee` (same as HelpDrawer)
 */
export type SubViewHelpContent = HelpContent | {
  description: string;
  howItWorks: string;
  whatToLookFor: string[];
  watchOutFor: string[];
};

interface SubViewHeaderProps {
  title: string;
  subtitle: string;
  helpContent?: SubViewHelpContent;
  actions?: React.ReactNode;
}

/**
 * Standardized sub-view header for all Diagnose tab sub-views.
 * Provides consistent typography, spacing, and help drawer behavior.
 * Uses HelpDrawer internally for the glass translucent effect.
 */
export function SubViewHeader({ title, subtitle, helpContent, actions }: SubViewHeaderProps) {
  const [showHelp, setShowHelp] = useState(false);

  // Normalize helpContent to HelpContent format
  const normalizedHelpContent: HelpContent | undefined = helpContent
    ? 'whatYouSee' in helpContent
      ? helpContent
      : {
          whatYouSee: helpContent.description,
          howItWorks: helpContent.howItWorks,
          whatToLookFor: helpContent.whatToLookFor,
          watchOutFor: helpContent.watchOutFor,
        }
    : undefined;

  return (
    <>
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-foreground tracking-tight">{title}</h2>
            {helpContent && (
              <button
                type="button"
                onClick={() => setShowHelp(true)}
                className="p-1.5 rounded-md border border-border bg-muted/30 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Show help"
              >
                <HelpCircle className="w-4 h-4" />
              </button>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
        </div>

        {actions && (
          <div className="flex items-center gap-2 flex-shrink-0">
            {actions}
          </div>
        )}
      </div>

      {/* Help Drawer with glass effect */}
      {normalizedHelpContent && (
        <HelpDrawer
          isOpen={showHelp}
          onClose={() => setShowHelp(false)}
          title={title}
          content={normalizedHelpContent}
        />
      )}
    </>
  );
}

export default SubViewHeader;
