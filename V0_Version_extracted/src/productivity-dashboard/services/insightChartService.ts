/**
 * Insight Chart Service
 * Maps AI/deterministic insights to visualization data
 */

import { AICopilotInsight, VelocityFactPack } from '../types/velocityCopilotTypes';

// Chart types that can be rendered
export type ChartType =
  | 'decay_sparkline'
  | 'rate_gauge'
  | 'comparison_bars'
  | 'bottleneck_bars'
  | 'req_health_bars'
  | 'none';

// Data structure for sparkline charts
export interface SparklineData {
  type: 'decay_sparkline';
  data: Array<{ label: string; value: number }>;
  threshold?: number;
}

// Data structure for gauge charts
export interface GaugeData {
  type: 'rate_gauge';
  value: number;  // 0-100
  label: string;
  thresholds: { bad: number; warn: number };  // e.g., { bad: 70, warn: 85 }
}

// Data structure for comparison bars
export interface ComparisonData {
  type: 'comparison_bars';
  bars: Array<{ label: string; value: number; color: 'good' | 'bad' | 'neutral' }>;
  unit: string;
}

// Data structure for bottleneck bars
export interface BottleneckData {
  type: 'bottleneck_bars';
  stages: Array<{ stage: string; days: number }>;
}

// Data structure for req health
export interface ReqHealthData {
  type: 'req_health_bars';
  zombie: number;
  stalled: number;
  total: number;
}

export type ChartData = SparklineData | GaugeData | ComparisonData | BottleneckData | ReqHealthData | { type: 'none' };

/**
 * Determine chart type from insight citations
 */
export function getChartTypeForInsight(insight: AICopilotInsight): ChartType {
  const citations = insight.citations.map(c => c.toLowerCase());

  // Check for decay-related insights
  if (citations.some(c => c.includes('decay') || c.includes('candidate_decay'))) {
    return 'decay_sparkline';
  }

  // Check for offer accept rate
  if (citations.some(c => c.includes('offer_accept_rate') || c.includes('overall_fill_rate'))) {
    return 'rate_gauge';
  }

  // Check for cohort comparison
  if (citations.some(c => c.includes('cohort_comparison') || c.includes('fast_hires') || c.includes('slow_hires'))) {
    return 'comparison_bars';
  }

  // Check for bottleneck stages
  if (citations.some(c => c.includes('bottleneck_stages'))) {
    return 'bottleneck_bars';
  }

  // Check for req health (zombie/stalled)
  if (citations.some(c => c.includes('zombie') || c.includes('stalled') || c.includes('contributing_reqs'))) {
    return 'req_health_bars';
  }

  // Check for TTF without decay data
  if (citations.some(c => c.includes('median_ttf'))) {
    return 'rate_gauge';
  }

  return 'none';
}

/**
 * Extract chart data for an insight from the fact pack
 */
export function getChartDataForInsight(
  insight: AICopilotInsight,
  factPack: VelocityFactPack
): ChartData {
  const chartType = getChartTypeForInsight(insight);

  switch (chartType) {
    case 'decay_sparkline':
      return extractDecaySparkline(factPack);

    case 'rate_gauge':
      return extractRateGauge(insight, factPack);

    case 'comparison_bars':
      return extractCohortComparison(factPack);

    case 'bottleneck_bars':
      return extractBottleneckBars(factPack);

    case 'req_health_bars':
      return extractReqHealth(factPack);

    default:
      return { type: 'none' };
  }
}

function extractDecaySparkline(factPack: VelocityFactPack): SparklineData | { type: 'none' } {
  if (!factPack.candidate_decay.available || factPack.candidate_decay.buckets.length === 0) {
    return { type: 'none' };
  }

  return {
    type: 'decay_sparkline',
    data: factPack.candidate_decay.buckets.map(b => ({
      label: b.label,
      value: Math.round(b.rate * 100)
    })),
    threshold: 80  // Target acceptance rate
  };
}

function extractRateGauge(insight: AICopilotInsight, factPack: VelocityFactPack): GaugeData | { type: 'none' } {
  const citations = insight.citations.map(c => c.toLowerCase());

  // Offer accept rate
  if (citations.some(c => c.includes('offer_accept_rate'))) {
    const rate = factPack.kpis.offer_accept_rate;
    if (rate === null) return { type: 'none' };

    return {
      type: 'rate_gauge',
      value: Math.round(rate * 100),
      label: 'Accept',
      thresholds: { bad: 70, warn: 85 }
    };
  }

  // Fill rate
  if (citations.some(c => c.includes('fill_rate'))) {
    const rate = factPack.kpis.overall_fill_rate;
    if (rate === null) return { type: 'none' };

    return {
      type: 'rate_gauge',
      value: Math.round(rate * 100),
      label: 'Fill',
      thresholds: { bad: 60, warn: 80 }
    };
  }

  // TTF as inverse gauge (lower is better)
  if (citations.some(c => c.includes('median_ttf'))) {
    const ttf = factPack.kpis.median_ttf_days;
    if (ttf === null) return { type: 'none' };

    // Convert TTF to a "health" score (45 days = 100%, 90 days = 0%)
    const health = Math.max(0, Math.min(100, Math.round((1 - (ttf - 45) / 45) * 100)));

    return {
      type: 'rate_gauge',
      value: health,
      label: `${ttf}d`,
      thresholds: { bad: 40, warn: 70 }
    };
  }

  return { type: 'none' };
}

function extractCohortComparison(factPack: VelocityFactPack): ComparisonData | { type: 'none' } {
  if (!factPack.cohort_comparison.available ||
      !factPack.cohort_comparison.fast_hires ||
      !factPack.cohort_comparison.slow_hires) {
    return { type: 'none' };
  }

  const fast = factPack.cohort_comparison.fast_hires;
  const slow = factPack.cohort_comparison.slow_hires;

  return {
    type: 'comparison_bars',
    bars: [
      { label: 'Fast', value: Math.round(fast.avg_ttf), color: 'good' },
      { label: 'Slow', value: Math.round(slow.avg_ttf), color: 'bad' }
    ],
    unit: 'days'
  };
}

function extractBottleneckBars(factPack: VelocityFactPack): BottleneckData | { type: 'none' } {
  if (factPack.bottleneck_stages.length === 0) {
    return { type: 'none' };
  }

  // Take top 3 bottlenecks
  const topStages = factPack.bottleneck_stages
    .slice(0, 3)
    .map(s => ({
      stage: formatStageName(s.stage),
      days: Math.round(s.avg_days)
    }));

  return {
    type: 'bottleneck_bars',
    stages: topStages
  };
}

function extractReqHealth(factPack: VelocityFactPack): ReqHealthData | { type: 'none' } {
  const zombie = factPack.contributing_reqs.zombie_req_ids.length;
  const stalled = factPack.contributing_reqs.stalled_req_ids.length;
  const total = factPack.sample_sizes.total_reqs;

  if (total === 0) {
    return { type: 'none' };
  }

  return {
    type: 'req_health_bars',
    zombie,
    stalled,
    total
  };
}

/**
 * Format stage name for display
 */
function formatStageName(stage: string): string {
  return stage
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
    .replace('Hm ', 'HM ');
}
