/**
 * Explain For Execs Button
 *
 * Triggers BYOK AI narration for scenario output.
 * Shows deterministic fallback when AI is unavailable.
 */

import React, { useState } from 'react';
import { ScenarioOutput } from '../../../types/scenarioTypes';
import {
  generateExecNarration,
  generateDeterministicNarration,
  isNarrationAvailable,
  ScenarioNarrationOutput,
} from '../../../services/scenarioNarrationService';
import { useDashboard } from '../../../hooks/useDashboardContext';
import { GlassPanel } from '../../common';

interface ExplainForExecsButtonProps {
  output: ScenarioOutput;
}

export default function ExplainForExecsButton({ output }: ExplainForExecsButtonProps) {
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
        className="px-4 py-2 rounded-md border border-glass-border bg-transparent text-muted-foreground hover:bg-surface-elevated hover:text-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        onClick={handleClick}
        disabled={isLoading}
      >
        {isLoading ? (
          <>
            <span className="inline-block w-4 h-4 border-2 border-current border-r-transparent rounded-full animate-spin mr-2" />
            Generating...
          </>
        ) : narration ? (
          <>
            <i className="bi bi-file-text mr-2" />
            {showNarration ? 'Hide Summary' : 'Show Summary'}
          </>
        ) : (
          <>
            <i className="bi bi-magic mr-2" />
            Explain for Execs
            {!aiAvailable && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-500 text-white ml-2">Deterministic</span>
            )}
          </>
        )}
      </button>

      {showNarration && narration && (
        <NarrationPanel
          narration={narration}
          onClose={handleClose}
          usedFallback={usedFallback}
          aiAvailable={aiAvailable}
        />
      )}
    </>
  );
}

interface NarrationPanelProps {
  narration: ScenarioNarrationOutput;
  onClose: () => void;
  usedFallback: boolean;
  aiAvailable: boolean;
}

function NarrationPanel({ narration, onClose, usedFallback, aiAvailable }: NarrationPanelProps) {
  return (
    <GlassPanel className="mt-3 exec-narration-panel">
      {/* Header */}
      <div className="exec-header">
        <button
          className="w-5 h-5 flex items-center justify-center rounded-full bg-surface-elevated hover:bg-glass-border transition-colors float-right"
          onClick={onClose}
          aria-label="Close"
        >
          <i className="bi bi-x text-muted-foreground text-sm" />
        </button>
        <span className="exec-label">Executive Summary</span>
      </div>

      {/* Headline - the bottom line */}
      <div className="exec-headline section-header-title">{narration.headline}</div>

      {/* Key findings - simple bullets, no citations visible */}
      <ul className="exec-bullets">
        {narration.bullets.map((bullet, idx) => (
          <li key={idx}>{bullet.text}</li>
        ))}
      </ul>

      {/* Ask - what decision is needed */}
      {narration.asks.length > 0 && (
        <div className="exec-ask">
          <strong>Decision needed:</strong> {narration.asks[0]}
        </div>
      )}

      {/* Caveat - subtle note at bottom */}
      {narration.caveats.length > 0 && (
        <p className="exec-caveat">{narration.caveats[0]}</p>
      )}
    </GlassPanel>
  );
}
