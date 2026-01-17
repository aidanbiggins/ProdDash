// Explain Engine Types
// Types for KPI explanations with full traceability

/**
 * Status of an explanation - determines UI rendering
 */
export type ExplanationStatus = 'ready' | 'blocked' | 'partial';

/**
 * Reason why an explanation is blocked
 */
export interface BlockedReason {
  code: string;           // Machine-readable code (e.g., 'MISSING_HIRED_AT')
  message: string;        // User-friendly message
  field?: string;         // Optional: which field is problematic
  sampleCount?: number;   // Optional: how many records affected
}

/**
 * A single data point contributing to the metric
 */
export interface ContributingRecord {
  id: string;             // Application/candidate ID
  label: string;          // Display label (e.g., req title or candidate name)
  value: number | null;   // The value this record contributed
  included: boolean;      // Whether it was included in calculation
  excludeReason?: string; // If excluded, why
}

/**
 * Breakdown row for time-based metrics
 */
export interface BreakdownRow {
  label: string;          // Phase name (e.g., "Application to First Interview")
  value: number | null;   // Median days
  unit: string;           // Unit (e.g., "days")
}

/**
 * Recommended action based on metric data
 */
export interface RecommendedAction {
  action: string;         // Action description (e.g., "Review zombie reqs for close or revive")
  priority: 'high' | 'medium' | 'low';  // Urgency level
  reason?: string;        // Why this action is recommended (optional)
}

/**
 * Core explanation contract - returned by all providers
 */
export interface Explanation {
  // === Required Fields ===
  metricId: string;                    // Unique metric identifier (e.g., 'time_to_offer')
  metricLabel: string;                 // Human-readable label (e.g., 'Time to Offer')
  status: ExplanationStatus;           // ready | blocked | partial

  // === Value & Formula (required when status !== 'blocked') ===
  value: string | number | null;       // The computed value (null if blocked)
  unit: string;                        // Unit of measurement (e.g., 'days', '%', 'count')
  formula: string;                     // Human-readable formula
  formulaCode?: string;                // Optional: code-level formula for technical users

  // === Date Range (required) ===
  dateRange: {
    start: Date;
    end: Date;
  };

  // === Inclusion/Exclusion Stats (required) ===
  includedCount: number;               // Records included in calculation
  excludedCount: number;               // Records excluded
  exclusionReasons: Array<{
    reason: string;
    count: number;
  }>;

  // === Optional Fields ===
  blockedReasons?: BlockedReason[];    // Why metric is blocked (when status === 'blocked')
  breakdown?: BreakdownRow[];          // Phase breakdown for time metrics
  confidenceGrade?: 'high' | 'medium' | 'low';  // Data confidence
  confidenceNote?: string;             // Explanation of confidence grade
  benchmark?: {
    value: number;
    label: string;                     // e.g., "Target", "Industry Average"
  };
  topContributors?: ContributingRecord[]; // Top N contributing records (max 5)
  mathInvariantValid?: boolean;        // For time breakdowns - do phases sum to total?
  recommendedActions?: RecommendedAction[]; // Deterministic next actions (max 3)

  // === Timestamps ===
  computedAt: Date;                    // When this explanation was generated
}

/**
 * Provider registration type
 */
export type ExplainProviderId =
  | 'median_ttf'
  | 'hm_latency'
  | 'stalled_reqs'
  | 'offer_accept_rate'
  | 'time_to_offer'
  | 'sla_attribution';
