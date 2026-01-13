/**
 * What-if Simulator Panel
 * Interactive panel for modeling intervention impacts on velocity metrics
 * Uses the pure whatIfModel.ts for all calculations
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  runWhatIfModel,
  createBaseline,
  WhatIfInputs,
  WhatIfBaseline,
  WhatIfModelOutput,
  WHATIF_DEFAULT_INPUTS,
  WHATIF_INPUT_BOUNDS,
} from '../../services/whatIfModel';
import { VelocityMetrics } from '../../types/velocityTypes';
import { AiProviderConfig } from '../../types/aiTypes';

interface WhatIfSimulatorPanelProps {
  velocityMetrics: VelocityMetrics;
  hmLatencyHours: number | null;
  pipelineDepth: number | null;
  timeToOfferDays: number | null;
  expectedHires: number | null;
  pipelineGap: number | null;
  openReqsCount: number;
  stageConversionRates: Record<string, number>;
  aiConfig?: AiProviderConfig | null;
}

// ===== LEVER METADATA =====

const LEVER_METADATA = [
  {
    key: 'offer_speed_days_faster' as const,
    label: 'Offer Speed Improvement',
    description: 'Days to reduce time from interview to offer',
    unit: 'days faster',
  },
  {
    key: 'hm_feedback_hours_saved' as const,
    label: 'HM Feedback SLA',
    description: 'Hours to reduce HM feedback latency',
    unit: 'hours saved',
  },
  {
    key: 'pipeline_add_leads_per_req' as const,
    label: 'Pipeline Add',
    description: 'Additional leads to add per open requisition',
    unit: 'leads/req',
  },
];

// ===== CONFIDENCE BADGE =====

function ConfidenceBadge({ confidence, reason }: { confidence: 'HIGH' | 'MED' | 'LOW'; reason: string }) {
  const config = {
    HIGH: { bg: 'rgba(34, 197, 94, 0.15)', color: '#22c55e', label: 'High Confidence' },
    MED: { bg: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', label: 'Medium Confidence' },
    LOW: { bg: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', label: 'Low Confidence' },
  };
  const style = config[confidence];

  return (
    <span
      className="badge font-mono"
      style={{ background: style.bg, color: style.color }}
      title={reason}
    >
      {style.label}
    </span>
  );
}

// ===== METRIC DISPLAY =====

interface MetricDisplayProps {
  label: string;
  baseline: number | null;
  projected: number | null;
  delta: number | null;
  unit: '%' | 'hires' | 'gap' | 'days';
  positiveIsGood: boolean;
  unavailableReason?: string;
}

function MetricDisplay({ label, baseline, projected, delta, unit, positiveIsGood, unavailableReason }: MetricDisplayProps) {
  if (baseline === null || projected === null) {
    return (
      <div className="glass-panel p-2 mb-2" style={{ opacity: 0.6 }}>
        <div className="stat-label mb-1">{label}</div>
        <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.8rem' }}>
          <i className="bi bi-info-circle me-1"></i>
          {unavailableReason || 'Data unavailable'}
        </div>
      </div>
    );
  }

  const formatValue = (val: number): string => {
    if (unit === '%') return `${Math.round(val * 100)}%`;
    if (unit === 'days') return `${Math.round(val)}d`;
    return val.toFixed(1);
  };

  const formatDelta = (val: number | null): string => {
    if (val === null) return '--';
    const sign = val >= 0 ? '+' : '';
    if (unit === '%') return `${sign}${Math.round(val * 100)}%`;
    if (unit === 'days') return `${sign}${Math.round(val)}`;
    return `${sign}${val.toFixed(1)}`;
  };

  const isPositive = delta !== null && delta > 0;
  const isNegative = delta !== null && delta < 0;
  const isGood = positiveIsGood ? isPositive : isNegative;
  const deltaColor = isGood ? '#22c55e' : (isPositive || isNegative) ? '#ef4444' : '#9ca3af';

  return (
    <div className="glass-panel p-2 mb-2">
      <div className="stat-label mb-1">{label}</div>
      <div className="d-flex align-items-baseline gap-2">
        <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>
          {formatValue(baseline)}
        </span>
        <span style={{ color: 'var(--color-text-secondary)' }}>
          <i className="bi bi-arrow-right"></i>
        </span>
        <span className="font-mono fw-bold" style={{ color: 'var(--color-text-primary)', fontSize: '1.1rem' }}>
          {formatValue(projected)}
        </span>
        <span
          className="badge font-mono"
          style={{ background: `${deltaColor}20`, color: deltaColor }}
        >
          {formatDelta(delta)}
        </span>
      </div>
    </div>
  );
}

// ===== LEVER SLIDER =====

function LeverSlider({
  leverKey,
  label,
  description,
  unit,
  value,
  onChange,
}: {
  leverKey: keyof WhatIfInputs;
  label: string;
  description: string;
  unit: string;
  value: number;
  onChange: (value: number) => void;
}) {
  const bounds = WHATIF_INPUT_BOUNDS[leverKey];

  return (
    <div className="mb-3">
      <div className="d-flex justify-content-between align-items-center mb-1">
        <div>
          <span className="stat-label">{label}</span>
          <small className="d-block" style={{ color: 'var(--color-text-secondary)', fontSize: '0.7rem' }}>
            {description}
          </small>
        </div>
        <span className="font-mono fw-bold" style={{ color: 'var(--color-accent)', fontSize: '1rem' }}>
          {value} {unit}
        </span>
      </div>
      <input
        type="range"
        className="form-range"
        min={bounds.min}
        max={bounds.max}
        step={bounds.step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ accentColor: 'var(--color-accent)' }}
        data-testid={`slider-${leverKey}`}
      />
      <div className="d-flex justify-content-between" style={{ fontSize: '0.65rem', color: 'var(--color-text-secondary)' }}>
        <span>{bounds.min}</span>
        <span>{bounds.max}</span>
      </div>
    </div>
  );
}

// ===== NARRATIVE DISPLAY =====

interface NarrativeBullet {
  text: string;
  citation: string;
}

function NarrativeDisplay({
  bullets,
  isLoading,
  error,
}: {
  bullets: NarrativeBullet[] | null;
  isLoading: boolean;
  error: string | null;
}) {
  if (isLoading) {
    return (
      <div className="mt-3 p-3 glass-panel text-center" style={{ color: 'var(--color-text-secondary)' }}>
        <span className="spinner-border spinner-border-sm me-2" role="status"></span>
        Generating narrative...
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-3 p-2 glass-panel" style={{ borderLeft: '3px solid #ef4444' }}>
        <small style={{ color: '#ef4444' }}>
          <i className="bi bi-exclamation-triangle me-1"></i>
          {error}
        </small>
      </div>
    );
  }

  if (!bullets || bullets.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 glass-panel p-3">
      <div className="stat-label mb-2">
        <i className="bi bi-stars me-1"></i>
        AI Analysis
      </div>
      <ul className="mb-0 ps-3" style={{ color: 'var(--color-text-primary)', fontSize: '0.85rem' }}>
        {bullets.map((bullet, idx) => (
          <li key={idx} className="mb-2">
            {bullet.text}
            <small className="d-block" style={{ color: 'var(--color-text-secondary)', fontSize: '0.7rem' }}>
              Source: {bullet.citation}
            </small>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ===== DETERMINISTIC NARRATIVE =====

function generateDeterministicNarrative(output: WhatIfModelOutput): NarrativeBullet[] {
  const bullets: NarrativeBullet[] = [];

  if (output.deltas.accept_rate_delta !== null && output.deltas.accept_rate_delta !== 0) {
    const direction = output.deltas.accept_rate_delta > 0 ? 'improve' : 'decline';
    bullets.push({
      text: `Accept rate projected to ${direction} by ${Math.abs(Math.round(output.deltas.accept_rate_delta * 100))}% based on reduced candidate decay.`,
      citation: 'Offer speed + HM latency interventions',
    });
  }

  if (output.deltas.time_to_offer_delta !== null && output.deltas.time_to_offer_delta !== 0) {
    bullets.push({
      text: `Time to offer would decrease by ${Math.abs(Math.round(output.deltas.time_to_offer_delta))} days, reducing candidate drop-off risk.`,
      citation: 'Process speed improvements',
    });
  }

  if (output.deltas.expected_hires_delta !== null && output.deltas.expected_hires_delta > 0) {
    bullets.push({
      text: `Expected hires could increase by ${output.deltas.expected_hires_delta.toFixed(1)} with additional pipeline sourcing.`,
      citation: 'Pipeline conversion model',
    });
  }

  if (output.deltas.pipeline_gap_delta !== null && output.deltas.pipeline_gap_delta < 0) {
    bullets.push({
      text: `Pipeline gap would narrow by ${Math.abs(output.deltas.pipeline_gap_delta).toFixed(1)}, improving fill probability.`,
      citation: 'Gap analysis',
    });
  }

  if (bullets.length === 0) {
    bullets.push({
      text: 'No interventions selected. Adjust the sliders above to model potential impacts.',
      citation: 'Baseline state',
    });
  }

  return bullets;
}

// ===== MAIN COMPONENT =====

export function WhatIfSimulatorPanel({
  velocityMetrics,
  hmLatencyHours,
  pipelineDepth,
  timeToOfferDays,
  expectedHires,
  pipelineGap,
  openReqsCount,
  stageConversionRates,
  aiConfig,
}: WhatIfSimulatorPanelProps) {
  // Input state - tracks slider positions exactly
  const [inputs, setInputs] = useState<WhatIfInputs>(WHATIF_DEFAULT_INPUTS);

  // AI narrative state
  const [narrativeBullets, setNarrativeBullets] = useState<NarrativeBullet[] | null>(null);
  const [narrativeLoading, setNarrativeLoading] = useState(false);
  const [narrativeError, setNarrativeError] = useState<string | null>(null);

  // Build baseline from props
  const baseline: WhatIfBaseline = useMemo(() => createBaseline({
    currentAcceptRate: velocityMetrics.candidateDecay?.overallAcceptanceRate ?? null,
    currentExpectedHires: expectedHires,
    currentPipelineGap: pipelineGap,
    currentTimeToOfferDays: timeToOfferDays,
    openReqsCount,
    currentHMLatencyHours: hmLatencyHours,
    decayRatePerDay: velocityMetrics.candidateDecay?.decayRatePerDay ?? null,
  }), [velocityMetrics, expectedHires, pipelineGap, timeToOfferDays, openReqsCount, hmLatencyHours]);

  // Run model (pure, deterministic)
  const output = useMemo(() => runWhatIfModel(inputs, baseline), [inputs, baseline]);

  // Update single input
  const handleInputChange = useCallback((key: keyof WhatIfInputs, value: number) => {
    setInputs(prev => ({ ...prev, [key]: value }));
    // Clear narrative on input change
    setNarrativeBullets(null);
    setNarrativeError(null);
  }, []);

  // Reset to defaults
  const handleReset = useCallback(() => {
    setInputs(WHATIF_DEFAULT_INPUTS);
    setNarrativeBullets(null);
    setNarrativeError(null);
  }, []);

  // Generate AI narrative
  const handleGenerateNarrative = useCallback(async () => {
    if (!aiConfig?.apiKey) {
      // Show deterministic narrative if no AI
      setNarrativeBullets(generateDeterministicNarrative(output));
      return;
    }

    setNarrativeLoading(true);
    setNarrativeError(null);

    try {
      const prompt = `Analyze this What-if Simulator result and provide 3-5 bullet points of actionable insights:

INPUTS:
- Offer speed improvement: ${inputs.offer_speed_days_faster} days faster
- HM feedback reduction: ${inputs.hm_feedback_hours_saved} hours saved
- Pipeline add: ${inputs.pipeline_add_leads_per_req} leads per req

BASELINE → PROJECTED:
- Accept rate: ${output.baseline.accept_rate !== null ? Math.round(output.baseline.accept_rate * 100) : 'N/A'}% → ${output.projected.accept_rate !== null ? Math.round(output.projected.accept_rate * 100) : 'N/A'}%
- Expected hires: ${output.baseline.expected_hires ?? 'N/A'} → ${output.projected.expected_hires ?? 'N/A'}
- Pipeline gap: ${output.baseline.pipeline_gap ?? 'N/A'} → ${output.projected.pipeline_gap ?? 'N/A'}
- Time to offer: ${output.baseline.time_to_offer_days ?? 'N/A'}d → ${output.projected.time_to_offer_days ?? 'N/A'}d

CONTEXT:
- Open reqs: ${baseline.open_reqs}
- Confidence: ${output.confidence}

Format each bullet as: • [insight] (Citation: [data source])`;

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': aiConfig.apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: aiConfig.model || 'claude-sonnet-4-20250514',
          max_tokens: 1024,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const rawMessage = errorData.error?.message || '';

        let userMessage: string;
        if (response.status === 401 || rawMessage.includes('api-key') || rawMessage.includes('authentication')) {
          userMessage = 'Invalid API key. Check Settings.';
        } else if (response.status === 429) {
          userMessage = 'Rate limited. Try again shortly.';
        } else if (response.status >= 500) {
          userMessage = 'AI service unavailable.';
        } else {
          userMessage = rawMessage || `Error ${response.status}`;
        }
        throw new Error(userMessage);
      }

      const data = await response.json();
      const content = data.content?.[0]?.text || '';

      // Parse bullets
      const bulletMatches = content.match(/•\s*([^•\n]+)/g) || [];
      const bullets = bulletMatches.map((bullet: string) => {
        const text = bullet.replace(/^•\s*/, '').trim();
        const citationMatch = text.match(/\(Citation:\s*([^)]+)\)/);
        return {
          text: text.replace(/\(Citation:\s*[^)]+\)/, '').trim(),
          citation: citationMatch?.[1] || 'Analysis',
        };
      });

      setNarrativeBullets(bullets.length > 0 ? bullets : generateDeterministicNarrative(output));
    } catch (err) {
      setNarrativeError(err instanceof Error ? err.message : 'Failed to generate');
      // Fall back to deterministic on error
      setNarrativeBullets(generateDeterministicNarrative(output));
    } finally {
      setNarrativeLoading(false);
    }
  }, [inputs, output, baseline, aiConfig]);

  const hasAI = Boolean(aiConfig?.apiKey);

  return (
    <div className="glass-panel p-3 mb-4" data-testid="what-if-simulator-panel">
      {/* Header - matches KEY INSIGHTS section styling */}
      <div className="d-flex align-items-center justify-content-between mb-3">
        <div className="d-flex align-items-center gap-2">
          <span
            style={{
              width: 28,
              height: 28,
              background: 'rgba(45, 212, 191, 0.15)',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.9rem',
            }}
          >
            🎛️
          </span>
          <div>
            <h6 className="mb-0" style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f5f5f5' }}>
              What-if Simulator
            </h6>
            <small style={{ color: '#6b7280', fontSize: '0.7rem' }}>
              Model intervention impacts
            </small>
          </div>
        </div>

        <ConfidenceBadge confidence={output.confidence} reason={output.confidence_reason} />
      </div>

      <div className="row">
        {/* Left: Levers */}
        <div className="col-md-6">
          <div className="stat-label mb-2">
            <i className="bi bi-sliders2 me-1"></i>
            Intervention Levers
          </div>

          {LEVER_METADATA.map((lever) => (
            <LeverSlider
              key={lever.key}
              leverKey={lever.key}
              label={lever.label}
              description={lever.description}
              unit={lever.unit}
              value={inputs[lever.key]}
              onChange={(value) => handleInputChange(lever.key, value)}
            />
          ))}
        </div>

        {/* Right: Outputs */}
        <div className="col-md-6">
          <div className="stat-label mb-2">
            <i className="bi bi-graph-up-arrow me-1"></i>
            Projected Impact
          </div>

          {/* Metrics affected by Offer Speed + HM Feedback sliders */}
          <MetricDisplay
            label="Accept Rate"
            baseline={output.baseline.accept_rate}
            projected={output.projected.accept_rate}
            delta={output.deltas.accept_rate_delta}
            unit="%"
            positiveIsGood={true}
            unavailableReason={output.unavailable_reasons['accept_rate']}
          />

          <MetricDisplay
            label="Time to Offer"
            baseline={output.baseline.time_to_offer_days}
            projected={output.projected.time_to_offer_days}
            delta={output.deltas.time_to_offer_delta}
            unit="days"
            positiveIsGood={false}
            unavailableReason={output.unavailable_reasons['time_to_offer_days']}
          />

          {/* Metrics affected by Pipeline Add slider */}
          <MetricDisplay
            label="Expected Hires"
            baseline={output.baseline.expected_hires}
            projected={output.projected.expected_hires}
            delta={output.deltas.expected_hires_delta}
            unit="hires"
            positiveIsGood={true}
            unavailableReason={output.unavailable_reasons['expected_hires']}
          />

          <MetricDisplay
            label="Pipeline Gap"
            baseline={output.baseline.pipeline_gap}
            projected={output.projected.pipeline_gap}
            delta={output.deltas.pipeline_gap_delta}
            unit="gap"
            positiveIsGood={false}
            unavailableReason={output.unavailable_reasons['pipeline_gap']}
          />

          <small className="d-block mt-2" style={{ color: 'var(--color-text-secondary)', fontSize: '0.75rem' }}>
            <i className="bi bi-info-circle me-1"></i>
            {output.confidence_reason}
          </small>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="d-flex gap-2 mt-3 flex-wrap">
        <button
          className="btn btn-bespoke-secondary"
          onClick={handleGenerateNarrative}
          disabled={narrativeLoading}
          title={hasAI ? 'Generate AI analysis' : 'Generate analysis (deterministic)'}
          data-testid="generate-narrative-btn"
        >
          {narrativeLoading ? (
            <>
              <span className="spinner-border spinner-border-sm me-1" role="status"></span>
              Generating...
            </>
          ) : (
            <>
              <i className={`bi ${hasAI ? 'bi-stars' : 'bi-calculator'} me-1`}></i>
              {hasAI ? 'AI Narration' : 'Analysis'}
            </>
          )}
        </button>

        <button
          className="btn btn-bespoke-secondary"
          onClick={handleReset}
          data-testid="reset-btn"
        >
          <i className="bi bi-arrow-counterclockwise me-1"></i>
          Reset
        </button>
      </div>

      {/* Narrative */}
      <NarrativeDisplay
        bullets={narrativeBullets}
        isLoading={narrativeLoading}
        error={narrativeError}
      />
    </div>
  );
}
