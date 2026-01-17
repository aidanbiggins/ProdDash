/**
 * Chart Color Palette - Per DECK_UI_UX_REFACTOR_V1.md Section 1.3
 *
 * Centralized chart colors for consistent visualization across all charts.
 * Use these constants instead of hardcoding colors in components.
 */

// Primary categorical palette (6 colors max per plan)
export const CHART_PALETTE = {
  PRIMARY: '#06b6d4',   // Teal - Chart 1
  SECONDARY: '#8b5cf6', // Violet - Chart 2
  TERTIARY: '#f59e0b',  // Amber - Chart 3
  QUATERNARY: '#3b82f6', // Blue - Chart 4
  QUINARY: '#22c55e',   // Green - Chart 5
  SENARY: '#ec4899',    // Pink - Chart 6
  MUTED: '#475569',     // Slate-600 - for "Other"
} as const;

// Array form for easy iteration (in priority order)
export const CHART_COLORS = [
  CHART_PALETTE.PRIMARY,
  CHART_PALETTE.SECONDARY,
  CHART_PALETTE.TERTIARY,
  CHART_PALETTE.QUATERNARY,
  CHART_PALETTE.QUINARY,
  CHART_PALETTE.SENARY,
];

/**
 * Source Channel Colors - ALWAYS use same colors per plan
 * Maps source channels to consistent colors across all source-related charts
 */
export const SOURCE_COLORS: Record<string, string> = {
  Referral: '#22c55e',   // Green - best quality
  Sourced: '#06b6d4',    // Teal - proactive
  Inbound: '#8b5cf6',    // Violet - passive
  Internal: '#3b82f6',   // Blue - internal mobility
  Agency: '#f59e0b',     // Amber - external
  Other: '#475569',      // Muted
  // Aliases
  'Employee Referral': '#22c55e',
  'Direct Sourcing': '#06b6d4',
  'Career Site': '#8b5cf6',
  'Job Board': '#8b5cf6',
  LinkedIn: '#06b6d4',
  Indeed: '#8b5cf6',
};

/**
 * Pipeline Stage Colors - progression from cool to warm per plan
 * Maps canonical stages to consistent colors
 */
export const STAGE_COLORS: Record<string, string> = {
  LEAD: '#64748b',       // Slate
  APPLIED: '#3b82f6',    // Blue
  SCREEN: '#06b6d4',     // Teal
  HM_SCREEN: '#8b5cf6',  // Violet
  ONSITE: '#a855f7',     // Purple
  FINAL: '#ec4899',      // Pink
  OFFER: '#f59e0b',      // Amber
  HIRED: '#22c55e',      // Green
  REJECTED: '#64748b',   // Slate (muted)
  WITHDRAWN: '#64748b',  // Slate (muted)
};

/**
 * Health Status Colors - universal semantic colors
 */
export const STATUS_COLORS = {
  healthy: '#22c55e',    // Green
  good: '#22c55e',       // Alias
  warning: '#f59e0b',    // Amber
  warn: '#f59e0b',       // Alias
  critical: '#ef4444',   // Red
  bad: '#ef4444',        // Alias
  neutral: '#64748b',    // Slate
} as const;

/**
 * Get color for a source channel (case-insensitive, with fallback)
 */
export function getSourceColor(source: string): string {
  // Try exact match first
  if (SOURCE_COLORS[source]) {
    return SOURCE_COLORS[source];
  }

  // Try case-insensitive match
  const normalized = source.toLowerCase();
  const key = Object.keys(SOURCE_COLORS).find(
    k => k.toLowerCase() === normalized
  );

  return key ? SOURCE_COLORS[key] : CHART_PALETTE.MUTED;
}

/**
 * Get color for a pipeline stage (case-insensitive, with fallback)
 */
export function getStageColor(stage: string): string {
  const normalized = stage.toUpperCase().replace(/[^A-Z_]/g, '_');
  return STAGE_COLORS[normalized] || CHART_PALETTE.MUTED;
}

/**
 * Get color for a status value
 */
export function getStatusColor(status: 'healthy' | 'good' | 'warning' | 'warn' | 'critical' | 'bad' | 'neutral'): string {
  return STATUS_COLORS[status] || STATUS_COLORS.neutral;
}

/**
 * Chart styling constants per plan
 */
export const CHART_STYLE = {
  // Axis lines
  axisStroke: 'rgba(255, 255, 255, 0.08)',
  // Grid lines (nearly invisible per plan)
  gridStroke: 'rgba(255, 255, 255, 0.05)',
  // Tooltip background
  tooltipBg: 'rgba(30, 41, 59, 0.85)',
  tooltipBorder: 'rgba(255, 255, 255, 0.12)',
  // Area chart fill opacity
  areaFillOpacity: 0.2,
  // Text colors
  tickColor: '#94a3b8',
  labelColor: '#f8fafc',
} as const;

/**
 * Recharts-specific styling props
 */
export const RECHARTS_THEME = {
  cartesianGrid: {
    stroke: CHART_STYLE.gridStroke,
    strokeDasharray: '3 3',
  },
  xAxis: {
    stroke: CHART_STYLE.axisStroke,
    tick: { fill: CHART_STYLE.tickColor, fontSize: 11 },
    axisLine: { stroke: CHART_STYLE.axisStroke },
  },
  yAxis: {
    stroke: CHART_STYLE.axisStroke,
    tick: { fill: CHART_STYLE.tickColor, fontSize: 11 },
    axisLine: { stroke: CHART_STYLE.axisStroke },
  },
  tooltip: {
    contentStyle: {
      backgroundColor: CHART_STYLE.tooltipBg,
      border: `1px solid ${CHART_STYLE.tooltipBorder}`,
      borderRadius: '6px',
      color: CHART_STYLE.labelColor,
    },
  },
  legend: {
    wrapperStyle: {
      color: CHART_STYLE.tickColor,
      fontSize: '12px',
    },
  },
} as const;
