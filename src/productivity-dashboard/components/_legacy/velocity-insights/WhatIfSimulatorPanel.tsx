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
} from '../../../services/whatIfModel';
import { VelocityMetrics } from '../../../types/velocityTypes';
import { AiProviderConfig } from '../../../types/aiTypes';
import { sendAiRequest } from '../../../services/aiService';

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
      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium font-mono"
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
          <i className="bi bi-info-circle mr-1"></i>
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
      <div className="flex items-baseline gap-2">
        <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>
          {formatValue(baseline)}
        </span>
        <span style={{ color: 'var(--color-text-secondary)' }}>
          <i className="bi bi-arrow-right"></i>
        </span>
        <span className="font-mono font-bold" style={{ color: 'var(--color-text-primary)', fontSize: '1.1rem' }}>
          {formatValue(projected)}
        </span>
        <span
          className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium font-mono"
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
      <div className="flex justify-between items-center mb-1">
        <div>
          <span className="stat-label">{label}</span>
          <small className="block" style={{ color: 'var(--color-text-secondary)', fontSize: '0.7rem' }}>
            {description}
          </small>
        </div>
        <span className="font-mono font-bold" style={{ color: 'var(--color-accent)', fontSize: '1rem' }}>
          {value} {unit}
        </span>
      </div>
      <input
        type="range"
        className="w-full h-2 bg-gray-700 rounded-lg cursor-pointer accent-accent"
        min={bounds.min}
        max={bounds.max}
        step={bounds.step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        data-testid={`slider-${leverKey}`}
      />
      <div className="flex justify-between" style={{ fontSize: '0.65rem', color: 'var(--color-text-secondary)' }}>
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
        <span className="w-4 h-4 border-2 border-current border-r-transparent rounded-full animate-spin inline-block mr-2" role="status"></span>
        Generating narrative...
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-3 p-2 glass-panel" style={{ borderLeft: '3px solid #ef4444' }}>
        <small style={{ color: '#ef4444' }}>
          <i className="bi bi-exclamation-triangle mr-1"></i>
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
        <i className="bi bi-stars mr-1"></i>
        AI Analysis
      </div>
      <ul className="mb-0 pl-3" style={{ color: 'var(--color-text-primary)', fontSize: '0.85rem' }}>
        {bullets.map((bullet, idx) => (
          <li key={idx} className="mb-2">
            {bullet.text}
            <small className="block" style={{ color: 'var(--color-text-secondary)', fontSize: '0.7rem' }}>
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

      // Use the edge function proxy instead of calling Anthropic directly
      const response = await sendAiRequest(
        aiConfig,
        [{ role: 'user', content: prompt }],
        { taskType: 'what-if-simulator' }
      );

      // Handle error response
      if (response.error) {
        let userMessage: string;
        const errorCode = response.error.code || '';
        const errorMessage = response.error.message || '';

        if (errorCode === 'invalid_api_key' || errorMessage.includes('api-key') || errorMessage.includes('authentication') || errorMessage.includes('401')) {
          userMessage = 'Invalid API key. Check Settings.';
        } else if (errorCode === 'rate_limit' || errorMessage.includes('429')) {
          userMessage = 'Rate limited. Try again shortly.';
        } else if (response.error.retryable) {
          userMessage = 'AI service unavailable.';
        } else {
          userMessage = errorMessage || 'AI request failed';
        }
        throw new Error(userMessage);
      }

      const content = response.content || '';

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
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Left: Levers */}
        <div>
          <div className="stat-label mb-2">
            <i className="bi bi-sliders2 mr-1"></i>
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
        <div>
          <div className="stat-label mb-2">
            <i className="bi bi-graph-up-arrow mr-1"></i>
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

          <small className="block mt-2" style={{ color: 'var(--color-text-secondary)', fontSize: '0.75rem' }}>
            <i className="bi bi-info-circle mr-1"></i>
            {output.confidence_reason}
          </small>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2 mt-3 flex-wrap">
        <button
          className="px-3 py-1.5 text-xs bg-card border border-border rounded hover:bg-white/10"
          onClick={handleGenerateNarrative}
          disabled={narrativeLoading}
          title={hasAI ? 'Generate AI analysis' : 'Generate analysis (deterministic)'}
          data-testid="generate-narrative-btn"
        >
          {narrativeLoading ? (
            <>
              <span className="w-4 h-4 border-2 border-current border-r-transparent rounded-full animate-spin inline-block mr-1" role="status"></span>
              Generating...
            </>
          ) : (
            <>
              <i className={`bi ${hasAI ? 'bi-stars' : 'bi-calculator'} mr-1`}></i>
              {hasAI ? 'AI Narration' : 'Analysis'}
            </>
          )}
        </button>

        <button
          className="px-3 py-1.5 text-xs bg-card border border-border rounded hover:bg-white/10"
          onClick={handleReset}
          data-testid="reset-btn"
        >
          <i className="bi bi-arrow-counterclockwise mr-1"></i>
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
