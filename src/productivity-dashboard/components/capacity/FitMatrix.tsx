// Fit Matrix Component
// Heatmap showing recruiter fit scores by segment

import React, { useMemo, useState } from 'react';
import { FitMatrixCell, ConfidenceLevel, getFitLabel, CAPACITY_CONSTANTS } from '../../types/capacityTypes';

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
    <span className="ms-1" style={{ opacity: 0.7 }}>
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
      <td className="text-center" style={{ padding: '8px', color: '#64748b' }}>
        —
      </td>
    );
  }

  const color = getFitColor(cell.fitScore);
  const label = getFitLabel(cell.fitScore);

  return (
    <td
      className="text-center"
      style={{
        padding: '8px',
        cursor: onClick ? 'pointer' : 'default',
        background: `${color}15`,
        borderLeft: '1px solid rgba(255,255,255,0.05)'
      }}
      onClick={onClick}
      title={`${cell.recruiterName} - ${cell.segmentString}\nFitScore: ${cell.fitScore.toFixed(2)}\nConfidence: ${cell.confidence}\nSample: ${cell.sampleSize}`}
    >
      <div style={{ color, fontFamily: "'JetBrains Mono', monospace", fontSize: '0.8rem' }}>
        {cell.fitScore > 0 ? '+' : ''}{cell.fitScore.toFixed(2)}
      </div>
      <div style={{ fontSize: '0.6rem', color: '#64748b' }}>
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
      <div className="card-bespoke">
        <div className="card-header">
          <h6 className="mb-0">
            <i className="bi bi-grid me-2"></i>
            Recruiter Fit by Segment
          </h6>
        </div>
        <div className="card-body text-center py-4 text-muted">
          <i className="bi bi-grid" style={{ fontSize: '2rem' }}></i>
          <div className="mt-2">Insufficient data for fit analysis</div>
          <div className="small">Need at least {CAPACITY_CONSTANTS.MIN_N_FOR_FIT_CELL} observations per segment</div>
        </div>
      </div>
    );
  }

  return (
    <div className="card-bespoke">
      <div className="card-header d-flex justify-content-between align-items-center">
        <h6 className="mb-0">
          <i className="bi bi-grid me-2"></i>
          Recruiter Fit by Segment
        </h6>
        <div className="form-check form-switch">
          <input
            className="form-check-input"
            type="checkbox"
            id="showAllFit"
            checked={showAll}
            onChange={(e) => setShowAll(e.target.checked)}
          />
          <label className="form-check-label small text-muted" htmlFor="showAllFit">
            Show low confidence
          </label>
        </div>
      </div>
      <div className="card-body p-0">
        <div className="table-responsive">
          <table className="table table-sm mb-0" style={{ fontSize: '0.8rem' }}>
            <thead>
              <tr>
                <th style={{ padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                  Recruiter
                </th>
                {segments.map(seg => (
                  <th
                    key={seg}
                    className="text-center"
                    style={{
                      padding: '8px',
                      borderBottom: '1px solid rgba(255,255,255,0.1)',
                      borderLeft: '1px solid rgba(255,255,255,0.05)',
                      maxWidth: '100px',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}
                    title={seg}
                  >
                    {seg.split('/').slice(0, 2).join('/')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recruiters.map(recruiterId => (
                <tr key={recruiterId}>
                  <td style={{ padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
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
      </div>
      <div className="card-footer small text-muted">
        <div className="d-flex justify-content-between align-items-center">
          <div>
            Legend: ●●● HIGH, ●●○ MED, ●○○ LOW, — insufficient
          </div>
          <div className="d-flex gap-3">
            <span><span style={{ color: FIT_COLORS.strong }}>■</span> Strong (+0.3+)</span>
            <span><span style={{ color: FIT_COLORS.good }}>■</span> Good (+0.1)</span>
            <span><span style={{ color: FIT_COLORS.neutral }}>■</span> Neutral</span>
            <span><span style={{ color: FIT_COLORS.weak }}>■</span> Weak</span>
            <span><span style={{ color: FIT_COLORS.poor }}>■</span> Poor</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default FitMatrix;
