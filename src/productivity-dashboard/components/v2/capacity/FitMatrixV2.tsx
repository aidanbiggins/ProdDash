/**
 * FitMatrixV2
 *
 * Visual matrix showing recruiter-segment fit based on historical performance.
 * V2 version using glass-panel and Tailwind tokens.
 * Uses the real FitMatrixCell type from capacityTypes.
 */

import React, { useMemo } from 'react';
import { HelpCircle } from 'lucide-react';
import { FitMatrixCell, ConfidenceLevel, getFitLabel } from '../../../types/capacityTypes';

interface FitMatrixV2Props {
  cells: FitMatrixCell[];
  onCellClick?: (recruiterId: string, segmentString: string) => void;
  privacyMode?: 'normal' | 'anonymized';
}

export function FitMatrixV2({
  cells,
  onCellClick,
  privacyMode = 'normal',
}: FitMatrixV2Props) {
  // Extract unique recruiters and segments
  const { recruiters, segments, cellMap } = useMemo(() => {
    const recruiterMap = new Map<string, string>();
    const segmentSet = new Set<string>();
    const map = new Map<string, FitMatrixCell>();

    cells.forEach(cell => {
      recruiterMap.set(cell.recruiterId, cell.recruiterName);
      segmentSet.add(cell.segmentString);
      map.set(`${cell.recruiterId}-${cell.segmentString}`, cell);
    });

    return {
      recruiters: Array.from(recruiterMap.entries()),
      segments: Array.from(segmentSet),
      cellMap: map,
    };
  }, [cells]);

  const getFitColor = (score: number, confidence: ConfidenceLevel) => {
    if (confidence === 'INSUFFICIENT') return 'bg-muted/50 text-muted-foreground';

    // FitScore is typically -1 to +1 range, convert to display
    if (score > 0.3) return 'bg-good/40 text-good';
    if (score > 0.1) return 'bg-good/20 text-good';
    if (score > -0.1) return 'bg-muted text-foreground';
    if (score > -0.3) return 'bg-warn/20 text-warn';
    return 'bg-bad/20 text-bad';
  };

  const formatScore = (score: number, confidence: ConfidenceLevel) => {
    if (confidence === 'INSUFFICIENT') return '—';
    // Convert to percentage-like display
    const pct = Math.round((score + 1) * 50); // -1 to 1 → 0 to 100
    return pct;
  };

  const getDisplayName = (name: string, index: number, type: 'recruiter' | 'segment') => {
    if (privacyMode === 'anonymized' && type === 'recruiter') {
      return `R${index + 1}`;
    }
    // Truncate long names
    return name.length > 15 ? `${name.substring(0, 13)}…` : name;
  };

  if (recruiters.length === 0 || segments.length === 0) {
    return (
      <div className="glass-panel p-6 text-center">
        <HelpCircle className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
        <p className="text-muted-foreground">
          Not enough data to display fit matrix.
          Need recruiters with historical performance across segments.
        </p>
      </div>
    );
  }

  return (
    <div className="glass-panel p-4">
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Recruiter × Segment Fit
        </span>
        {/* Legend */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">Fit:</span>
          <span className="px-2 py-0.5 rounded bg-good/40 text-good">Strong</span>
          <span className="px-2 py-0.5 rounded bg-good/20 text-good">Good</span>
          <span className="px-2 py-0.5 rounded bg-muted text-foreground">Neutral</span>
          <span className="px-2 py-0.5 rounded bg-warn/20 text-warn">Weak</span>
          <span className="px-2 py-0.5 rounded bg-bad/20 text-bad">Poor</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr>
              <th className="px-2 py-2 text-left text-muted-foreground font-medium sticky left-0 bg-card">
                Recruiter
              </th>
              {segments.map((segment, idx) => (
                <th
                  key={segment}
                  className="px-2 py-2 text-center text-muted-foreground font-medium whitespace-nowrap"
                  title={segment}
                >
                  {getDisplayName(segment, idx, 'segment')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {recruiters.map(([recruiterId, recruiterName], rIdx) => (
              <tr key={recruiterId} className="border-t border-border">
                <td className="px-2 py-2 text-sm font-medium text-foreground whitespace-nowrap sticky left-0 bg-card">
                  {getDisplayName(recruiterName, rIdx, 'recruiter')}
                </td>
                {segments.map(segment => {
                  const cell = cellMap.get(`${recruiterId}-${segment}`);
                  const score = cell?.fitScore ?? 0;
                  const confidence = cell?.confidence ?? 'INSUFFICIENT';
                  const label = getFitLabel(score);

                  return (
                    <td
                      key={segment}
                      className={`px-2 py-2 text-center font-mono cursor-pointer transition-all hover:ring-2 hover:ring-primary/50 rounded ${getFitColor(score, confidence)}`}
                      onClick={() => onCellClick?.(recruiterId, segment)}
                      title={`${recruiterName} × ${segment}: ${label} (n=${cell?.sampleSize ?? 0})`}
                    >
                      {formatScore(score, confidence)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 text-xs text-muted-foreground">
        Click a cell to see detailed fit analysis. Scores based on hires/WU, TTF, and accept rate.
      </div>
    </div>
  );
}

export default FitMatrixV2;
