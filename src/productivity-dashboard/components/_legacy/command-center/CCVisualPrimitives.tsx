// Command Center Visual Primitives
// One small visual per section. Pure CSS, no charting libraries.
// Each answers a single leader question faster than text.

import React from 'react';
import { KPIStatus, BottleneckDiagnosis, DeltaItem } from '../../../types/commandCenterTypes';

// ============================================
// 1. PRESSURE BAR -- Attention section
// "Is this a fire or background noise?"
// ============================================

interface PressureBarProps {
  blocking: number;
  atRisk: number;
}

export const PressureBar: React.FC<PressureBarProps> = ({ blocking, atRisk }) => {
  const total = blocking + atRisk;
  if (total === 0) return null;

  const blockingPct = (blocking / total) * 100;
  const atRiskPct = (atRisk / total) * 100;

  return (
    <div
      data-testid="cc-pressure-bar"
      className={`cc-pressure-bar ${blocking > 0 ? 'cc-pressure-bar--hot' : ''}`}
    >
      {blocking > 0 && (
        <div className="cc-pressure-bar__segment cc-pressure-bar__segment--blocking" style={{ width: `${blockingPct}%` }} />
      )}
      {atRisk > 0 && (
        <div className="cc-pressure-bar__segment cc-pressure-bar__segment--at-risk" style={{ width: `${atRiskPct}%` }} />
      )}
    </div>
  );
};

// ============================================
// 2. KPI TARGET BAND -- On Track section
// "How far off are we, really?"
// ============================================

interface KPITargetBandProps {
  value: number | null;
  target: number;
  status: KPIStatus;
}

export const KPITargetBand: React.FC<KPITargetBandProps> = ({ value, target, status }) => {
  if (value === null || target <= 0) return null;

  // Clamp value into [0, 2*target] so outliers don't blow the band
  const maxScale = target * 2;
  const clamped = Math.min(Math.max(value, 0), maxScale);
  const pct = (clamped / maxScale) * 100;
  const exceeds = value > maxScale;

  return (
    <div data-testid="cc-kpi-band" className="cc-kpi-band">
      <div className="cc-kpi-band__target-zone" />
      <div className="cc-kpi-band__target-line" />
      <div className={`cc-kpi-band__dot cc-kpi-band__dot--${status}`} style={{ left: `${pct}%` }} />
      {exceeds && (
        <div className="cc-kpi-band__exceeds" style={{ color: status === 'green' ? 'var(--color-good)' : status === 'amber' ? 'var(--color-warn)' : 'var(--color-bad)' }}>
          &gt;
        </div>
      )}
    </div>
  );
};

// ============================================
// 3. RISK CONCENTRATION SPARK -- Risk section
// "Is this one type of failure repeating?"
// ============================================

interface RiskSparkSegment {
  mode: string;
  count: number;
  severity: 'critical' | 'high' | 'medium';
}

interface RiskConcentrationSparkProps {
  distribution: RiskSparkSegment[];
}

const SPARK_SEVERITY_COLORS: Record<string, string> = {
  critical: 'var(--color-bad)',
  high: 'var(--color-warn)',
  medium: 'var(--text-secondary)',
};

export const RiskConcentrationSpark: React.FC<RiskConcentrationSparkProps> = ({ distribution }) => {
  if (distribution.length === 0) return null;

  // Top 4 modes, roll rest into "other"
  const sorted = [...distribution].sort((a, b) => b.count - a.count);
  const top4 = sorted.slice(0, 4);
  const otherCount = sorted.slice(4).reduce((sum, s) => sum + s.count, 0);
  const segments = otherCount > 0
    ? [...top4, { mode: 'other', count: otherCount, severity: 'medium' as const }]
    : top4;

  const total = segments.reduce((sum, s) => sum + s.count, 0);
  if (total === 0) return null;

  return (
    <div data-testid="cc-risk-spark" className="cc-risk-spark">
      {segments.map((seg) => (
        <div
          key={seg.mode}
          className="cc-risk-spark__segment"
          style={{
            width: `${(seg.count / total) * 100}%`,
            background: SPARK_SEVERITY_COLORS[seg.severity] || 'var(--text-secondary)',
          }}
        />
      ))}
    </div>
  );
};

// ============================================
// 4. NET DIRECTION BADGE -- Changes section
// "Was this a good week or bad week?"
// ============================================

interface NetDirectionBadgeProps {
  deltas: DeltaItem[];
}

type NetDirection = 'positive' | 'negative' | 'mixed';

const NET_STYLES: Record<NetDirection, { symbol: string; color: string }> = {
  positive: { symbol: '\u25B2', color: 'var(--color-good)' },
  negative: { symbol: '\u25BC', color: 'var(--color-bad)' },
  mixed: { symbol: '\u25AC', color: 'var(--text-secondary)' },
};

// Leader semantics: direction meaning depends on the metric
// "up" is good for: hires, offers, pipeline
// "up" is bad for: TTF, latency, stalled, zombie
const NEGATIVE_WHEN_UP = ['ttf', 'latency', 'stalled', 'zombie', 'aging', 'overdue'];

function computeNetDirection(deltas: DeltaItem[]): NetDirection {
  const materialDeltas = deltas.filter(d => d.material);
  if (materialDeltas.length === 0) return 'mixed';

  let positiveCount = 0;
  let negativeCount = 0;

  for (const d of materialDeltas) {
    if (d.direction === 'flat') continue;
    const labelLower = d.label.toLowerCase();
    const isNegativeMetric = NEGATIVE_WHEN_UP.some(kw => labelLower.includes(kw));

    if (d.direction === 'up') {
      if (isNegativeMetric) negativeCount++;
      else positiveCount++;
    } else {
      if (isNegativeMetric) positiveCount++;
      else negativeCount++;
    }
  }

  if (positiveCount > 0 && negativeCount === 0) return 'positive';
  if (negativeCount > 0 && positiveCount === 0) return 'negative';
  return 'mixed';
}

export const NetDirectionBadge: React.FC<NetDirectionBadgeProps> = ({ deltas }) => {
  const materialDeltas = deltas.filter(d => d.material);
  if (materialDeltas.length === 0) return null;

  const direction = computeNetDirection(deltas);
  const netStyle = NET_STYLES[direction];

  return (
    <span
      data-testid="cc-net-direction"
      className="cc-net-direction"
      style={{ color: netStyle.color }}
    >
      {netStyle.symbol}
    </span>
  );
};

// ============================================
// 5. BOTTLENECK DIAGRAM -- Bottleneck section
// "Which lever do we pull?"
// ============================================

interface BottleneckDiagramProps {
  diagnosis: BottleneckDiagnosis;
}

const BLOCK_LABELS: { id: 'pipeline' | 'capacity'; label: string }[] = [
  { id: 'pipeline', label: 'Pipeline' },
  { id: 'capacity', label: 'Capacity' },
];

export const BottleneckDiagram: React.FC<BottleneckDiagramProps> = ({ diagnosis }) => {
  const isPipelineHighlighted = diagnosis === 'PIPELINE_BOUND' || diagnosis === 'BOTH';
  const isCapacityHighlighted = diagnosis === 'CAPACITY_BOUND' || diagnosis === 'BOTH';

  return (
    <div data-testid="cc-bottleneck-diagram" className="cc-bottleneck-diagram">
      {BLOCK_LABELS.map((block, idx) => {
        const isHighlighted = block.id === 'pipeline' ? isPipelineHighlighted : isCapacityHighlighted;
        const borderColor = isHighlighted
          ? (block.id === 'pipeline' ? 'var(--color-warn)' : 'var(--color-bad)')
          : 'var(--glass-border)';
        const bgColor = isHighlighted
          ? (block.id === 'pipeline' ? 'var(--color-warn-bg)' : 'var(--color-bad-bg)')
          : 'transparent';

        return (
          <React.Fragment key={block.id}>
            {idx > 0 && (
              <span className="cc-bottleneck-diagram__arrow">&rarr;</span>
            )}
            <div
              className="cc-bottleneck-diagram__block"
              style={{
                border: `1.5px solid ${borderColor}`,
                background: bgColor,
              }}
            >
              <span className={`cc-bottleneck-diagram__label ${isHighlighted ? 'cc-bottleneck-diagram__label--highlighted' : 'cc-bottleneck-diagram__label--dim'}`}
                style={{ color: isHighlighted ? borderColor : undefined }}
              >
                {block.label}
              </span>
              {diagnosis === 'HEALTHY' && (
                <span className="cc-bottleneck-diagram__healthy-check">&#10003;</span>
              )}
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
};
