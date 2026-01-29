/**
 * ExplainForExecsButtonV2
 *
 * Triggers BYOK AI narration for scenario output.
 * Shows deterministic fallback when AI is unavailable.
 * V2 version using glass-panel and Tailwind tokens.
 */

import React, { useState } from 'react';
import { Sparkles, FileText, Loader2, X } from 'lucide-react';
import { ScenarioOutput } from '../../../../types/scenarioTypes';
import {
  generateExecNarration,
  generateDeterministicNarration,
  isNarrationAvailable,
  ScenarioNarrationOutput,
} from '../../../../services/scenarioNarrationService';
import { useDashboard } from '../../../../hooks/useDashboardContext';

interface ExplainForExecsButtonV2Props {
  output: ScenarioOutput;
}

export function ExplainForExecsButtonV2({ output }: ExplainForExecsButtonV2Props) {
  // Get aiConfig from dashboard context - this has the user's loaded API keys
  const { aiConfig } = useDashboard();
  const [isLoading, setIsLoading] = useState(false);
  const [narration, setNarration] = useState<ScenarioNarrationOutput | null>(null);
  const [showNarration, setShowNarration] = useState(false);
  const [usedFallback, setUsedFallback] = useState(false);

  const aiAvailable = isNarrationAvailable(aiConfig);

  const handleClick = async () => {
    if (narration) {
      // Toggle existing narration
      setShowNarration(!showNarration);
      return;
    }

    setIsLoading(true);
    setUsedFallback(false);

    try {
      if (aiAvailable && aiConfig) {
        // Try AI narration
        const result = await generateExecNarration(output, aiConfig);
        setNarration(result);
      } else {
        // Use deterministic fallback
        const result = generateDeterministicNarration(output);
        setNarration(result);
        setUsedFallback(true);
      }
      setShowNarration(true);
    } catch (error) {
      console.error('Narration error:', error);
      // Fall back to deterministic
      const result = generateDeterministicNarration(output);
      setNarration(result);
      setUsedFallback(true);
      setShowNarration(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setShowNarration(false);
  };

  return (
    <>
      <button
        className="px-4 py-2 min-h-[44px] rounded-md border border-border bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center"
        onClick={handleClick}
        disabled={isLoading}
      >
        {isLoading ? (
          <>
            <Loader2 size={16} className="mr-2 animate-spin" />
            Generating...
          </>
        ) : narration ? (
          <>
            <FileText size={16} className="mr-2" />
            {showNarration ? 'Hide Summary' : 'Show Summary'}
          </>
        ) : (
          <>
            <Sparkles size={16} className="mr-2" />
            Explain for Execs
            {!aiAvailable && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-muted text-muted-foreground ml-2">
                Deterministic
              </span>
            )}
          </>
        )}
      </button>

      {showNarration && narration && (
        <NarrationPanel narration={narration} onClose={handleClose} />
      )}
    </>
  );
}

interface NarrationPanelProps {
  narration: ScenarioNarrationOutput;
  onClose: () => void;
}

function NarrationPanel({ narration, onClose }: NarrationPanelProps) {
  return (
    <div className="glass-panel p-4 mt-3">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">
          Executive Summary
        </span>
        <button
          className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-muted transition-colors"
          onClick={onClose}
          aria-label="Close"
        >
          <X size={14} className="text-muted-foreground" />
        </button>
      </div>

      {/* Headline - the bottom line */}
      <h3 className="text-lg font-semibold text-foreground mb-3">{narration.headline}</h3>

      {/* Key findings - simple bullets, no citations visible */}
      <ul className="list-disc pl-5 space-y-1 mb-3">
        {narration.bullets.map((bullet, idx) => (
          <li key={idx} className="text-foreground">
            {bullet.text}
          </li>
        ))}
      </ul>

      {/* Ask - what decision is needed */}
      {narration.asks.length > 0 && (
        <div className="p-3 rounded-lg bg-accent/10 text-accent mb-3">
          <strong>Decision needed:</strong> {narration.asks[0]}
        </div>
      )}

      {/* Caveat - subtle note at bottom */}
      {narration.caveats.length > 0 && (
        <p className="text-sm text-muted-foreground italic">{narration.caveats[0]}</p>
      )}
    </div>
  );
}

export default ExplainForExecsButtonV2;
