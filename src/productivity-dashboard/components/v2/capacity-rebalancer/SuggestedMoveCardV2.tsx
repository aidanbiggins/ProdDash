/**
 * SuggestedMoveCardV2
 *
 * Card showing a suggested req reassignment with impact preview.
 * V2 version using glass-panel and Tailwind tokens.
 */

import React from 'react';
import { ArrowRight, Check, Eye, TrendingDown } from 'lucide-react';
import {
  ReassignmentSuggestion,
  PrivacyMode,
  getRecruiterDisplayName,
  LOAD_STATUS_LABELS
} from '../../../types/rebalancerTypes';

interface SuggestedMoveCardProps {
  suggestion: ReassignmentSuggestion;
  privacyMode: PrivacyMode;
  onViewDetails: () => void;
  isApplied?: boolean;
}

export function SuggestedMoveCardV2({
  suggestion,
  privacyMode,
  onViewDetails,
  isApplied = false,
}: SuggestedMoveCardProps) {
  const fromName = privacyMode === 'anonymized' ? 'Recruiter A' : suggestion.fromRecruiterName;
  const toName = privacyMode === 'anonymized' ? 'Recruiter B' : suggestion.toRecruiterName;

  const totalCandidates = Object.values(suggestion.reqDemand).reduce((a, b) => a + b, 0);

  const getConfidenceStyle = () => {
    switch (suggestion.confidence) {
      case 'HIGH':
        return 'bg-good/20 text-good';
      case 'MED':
        return 'bg-warn/20 text-warn';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div
      className={`glass-panel p-3 transition-all ${isApplied ? 'opacity-60' : 'hover:ring-1 hover:ring-primary/30'}`}
    >
      {/* Header - Req Title and Confidence */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-foreground truncate" title={suggestion.reqTitle}>
            {suggestion.reqTitle}
          </div>
          <div className="text-xs text-muted-foreground">
            {suggestion.reqId} · {totalCandidates} candidates
          </div>
        </div>
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getConfidenceStyle()}`}>
          {suggestion.confidence}
        </span>
      </div>

      {/* Transfer Visualization */}
      <div className="flex items-center justify-between py-2 px-3 rounded-md bg-muted/30 mb-2">
        <div className="text-center flex-1">
          <div className="text-xs text-muted-foreground">From</div>
          <div className="text-sm font-medium text-foreground truncate" title={fromName}>
            {fromName}
          </div>
        </div>
        <ArrowRight className="w-5 h-5 text-primary mx-2 flex-shrink-0" />
        <div className="text-center flex-1">
          <div className="text-xs text-muted-foreground">To</div>
          <div className="text-sm font-medium text-foreground truncate" title={toName}>
            {toName}
          </div>
        </div>
      </div>

      {/* Impact Preview */}
      <div className="flex items-center justify-between text-xs mb-3">
        <div className="flex items-center gap-1 text-good">
          <TrendingDown className="w-3.5 h-3.5" />
          <span>-{suggestion.estimatedImpact.delayReductionDays.toFixed(1)}d delay</span>
        </div>
        <div className="text-muted-foreground truncate" title={suggestion.rationale}>
          {suggestion.rationale}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onViewDetails}
          className="flex-1 px-3 py-2 rounded-md text-sm font-medium border border-border text-foreground hover:bg-muted transition-colors min-h-[40px] flex items-center justify-center gap-1"
        >
          <Eye className="w-4 h-4" />
          View Details
        </button>
        {isApplied && (
          <div className="flex items-center gap-1 px-3 py-2 rounded-md text-sm font-medium bg-good/20 text-good">
            <Check className="w-4 h-4" />
            Applied
          </div>
        )}
      </div>
    </div>
  );
}

export default SuggestedMoveCardV2;
