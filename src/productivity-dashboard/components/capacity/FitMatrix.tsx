// Fit Matrix Component
// Heatmap showing recruiter fit scores by segment

import React, { useMemo, useState } from 'react';
import { FitMatrixCell, ConfidenceLevel, getFitLabel, CAPACITY_CONSTANTS } from '../../types/capacityTypes';
import { Checkbox } from '../../../components/ui/toggles';

interface FitMatrixProps {
  cells: FitMatrixCell[];
  onCellClick?: (recruiterId: string, segmentString: string) => void;
}

const FIT_COLORS = {
  strong: '#34d399',   // Green
  good: '#86efac',     // Light green
  neutral: '#94a3b8',  // Gray
  weak: '#fca5a5',     // Light red
  poor: '#f87171'      // Red
};

function getFitColor(fitScore: number): string {
  if (fitScore > CAPACITY_CONSTANTS.FIT_STRONG) return FIT_COLORS.strong;
  if (fitScore > CAPACITY_CONSTANTS.FIT_GOOD) return FIT_COLORS.good;
  if (fitScore > CAPACITY_CONSTANTS.FIT_WEAK) return FIT_COLORS.neutral;
  if (fitScore > CAPACITY_CONSTANTS.FIT_POOR) return FIT_COLORS.weak;
  return FIT_COLORS.poor;
}

function ConfidenceDots({ confidence }: { confidence: ConfidenceLevel }) {
  const dots = {
    HIGH: 3,
    MED: 2,
    LOW: 1,
    INSUFFICIENT: 0
  }[confidence];

  return (
    <span className="ml-1 opacity-70">
      {'●'.repeat(dots)}{'○'.repeat(3 - dots)}
    </span>
  );
}

function FitCell({
  cell,
  onClick
}: {
  cell: FitMatrixCell | null;
  onClick?: () => void;
}) {
  if (!cell || cell.confidence === 'INSUFFICIENT') {
    return (
      <td className="text-center p-2 text-muted-foreground">
        —
      </td>
    );
  }

  const color = getFitColor(cell.fitScore);
  const label = getFitLabel(cell.fitScore);
  const bgClass = cell.fitScore > CAPACITY_CONSTANTS.FIT_STRONG ? 'bg-green-500/10' :
                  cell.fitScore > CAPACITY_CONSTANTS.FIT_GOOD ? 'bg-green-400/10' :
                  cell.fitScore > CAPACITY_CONSTANTS.FIT_WEAK ? 'bg-slate-500/10' :
                  cell.fitScore > CAPACITY_CONSTANTS.FIT_POOR ? 'bg-red-300/10' : 'bg-red-400/10';

  return (
    <td
      className={`text-center p-2 border-l border-white/5 ${bgClass} ${onClick ? 'cursor-pointer hover:bg-white/10' : ''}`}
      onClick={onClick}
      title={`${cell.recruiterName} - ${cell.segmentString}\nFitScore: ${cell.fitScore.toFixed(2)}\nConfidence: ${cell.confidence}\nSample: ${cell.sampleSize}`}
    >
      <div className="font-mono text-xs" style={{ color }}>
        {cell.fitScore > 0 ? '+' : ''}{cell.fitScore.toFixed(2)}
      </div>
      <div className="text-[10px] text-muted-foreground">
        <ConfidenceDots confidence={cell.confidence} />
      </div>
    </td>
  );
}

export function FitMatrix({ cells, onCellClick }: FitMatrixProps) {
  const [showAll, setShowAll] = useState(false);

  // Group cells by recruiter and segment
  const { recruiters, segments, cellMap } = useMemo(() => {
    const recruiterSet = new Set<string>();
    const segmentSet = new Set<string>();
    const map = new Map<string, FitMatrixCell>();

    for (const cell of cells) {
      if (!showAll && cell.confidence === 'INSUFFICIENT') continue;
      recruiterSet.add(cell.recruiterId);
      segmentSet.add(cell.segmentString);
      map.set(`${cell.recruiterId}|${cell.segmentString}`, cell);
    }

    return {
      recruiters: Array.from(recruiterSet),
      segments: Array.from(segmentSet).sort(),
      cellMap: map
    };
  }, [cells, showAll]);

  // Get recruiter names
  const recruiterNames = useMemo(() => {
    const names = new Map<string, string>();
    for (const cell of cells) {
      names.set(cell.recruiterId, cell.recruiterName);
    }
    return names;
  }, [cells]);

  if (cells.length === 0) {
    return (
      <div className="rounded-lg border border-glass-border bg-bg-glass">
        <div className="px-4 py-3 border-b border-white/10">
          <h6 className="text-sm font-semibold text-foreground">
            <i className="bi bi-grid mr-2"></i>
            Recruiter Fit by Segment
          </h6>
        </div>
        <div className="text-center py-8 text-muted-foreground">
          <i className="bi bi-grid text-3xl"></i>
          <div className="mt-2">Insufficient data for fit analysis</div>
          <div className="text-sm">Need at least {CAPACITY_CONSTANTS.MIN_N_FOR_FIT_CELL} observations per segment</div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-glass-border bg-bg-glass">
      <div className="flex justify-between items-center px-4 py-3 border-b border-white/10">
        <h6 className="text-sm font-semibold text-foreground">
          <i className="bi bi-grid mr-2"></i>
          Recruiter Fit by Segment
        </h6>
        <div className="flex items-center gap-2">
          <Checkbox
            checked={showAll}
            onChange={setShowAll}
            id="showAllFit"
          />
          <label className="text-sm text-muted-foreground cursor-pointer" htmlFor="showAllFit">
            Show low confidence
          </label>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium uppercase text-muted-foreground border-b border-white/10">
                Recruiter
              </th>
              {segments.map(seg => (
                <th
                  key={seg}
                  className="text-center px-2 py-2 text-xs font-medium uppercase text-muted-foreground border-b border-white/10 border-l border-white/5 max-w-[100px] whitespace-nowrap overflow-hidden text-ellipsis"
                  title={seg}
                >
                  {seg.split('/').slice(0, 2).join('/')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {recruiters.map(recruiterId => (
              <tr key={recruiterId} className="hover:bg-white/5">
                <td className="px-3 py-2 text-sm text-foreground">
                  {recruiterNames.get(recruiterId) || recruiterId}
                </td>
                {segments.map(seg => {
                  const cell = cellMap.get(`${recruiterId}|${seg}`);
                  return (
                    <FitCell
                      key={seg}
                      cell={cell || null}
                      onClick={cell && onCellClick ? () => onCellClick(recruiterId, seg) : undefined}
                    />
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-3 border-t border-white/10 text-sm text-muted-foreground">
        <div className="flex justify-between items-center flex-wrap gap-2">
          <div>
            Legend: ●●● HIGH, ●●○ MED, ●○○ LOW, — insufficient
          </div>
          <div className="flex gap-3 flex-wrap">
            <span><span className="text-green-400">■</span> Strong (+0.3+)</span>
            <span><span className="text-green-300">■</span> Good (+0.1)</span>
            <span><span className="text-slate-400">■</span> Neutral</span>
            <span><span className="text-red-300">■</span> Weak</span>
            <span><span className="text-red-400">■</span> Poor</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default FitMatrix;
