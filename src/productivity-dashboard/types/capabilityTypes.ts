// Capability Engine Types
// Central types for the unified capability evaluation system
// See docs/plans/CAPABILITY_AND_ULTIMATE_DEMO_PACK_V1.md

import { CoverageMetrics } from './resilientImportTypes';

// ============================================
// STATUS & CONFIDENCE
// ============================================

export type CapabilityStatus = 'ENABLED' | 'LIMITED' | 'BLOCKED';
export type ConfidenceLevel = 'HIGH' | 'MED' | 'LOW';

// ============================================
// CAPABILITY DEFINITIONS (18 data capabilities)
// ============================================

export interface DataCapabilityDef {
  key: string;
  displayName: string;
  description: string;
  /** Rules to evaluate status from coverage metrics */
  evaluate: (coverage: CoverageMetrics) => CapabilityEvalResult;
}

export interface CapabilityEvalResult {
  status: CapabilityStatus;
  confidence: ConfidenceLevel;
  confidence_reasons: string[];
  evidence: CapabilityEvidence;
}

export interface CapabilityEvidence {
  field_coverages: Record<string, number>;
  sample_sizes: Record<string, number>;
  flags_met: string[];
  flags_missing: string[];
  thresholds: ThresholdCheck[];
}

export interface ThresholdCheck {
  field: string;
  required: number;
  actual: number;
  met: boolean;
}

// ============================================
// CAPABILITY REPORT (output of engine)
// ============================================

export interface CapabilityReportEntry {
  capability_key: string;
  display_name: string;
  description: string;
  status: CapabilityStatus;
  confidence: ConfidenceLevel;
  confidence_reasons: string[];
  evidence: CapabilityEvidence;
  repair_suggestions: RepairSuggestionEntry[];
}

export type CapabilityReport = Map<string, CapabilityReportEntry>;

// ============================================
// FEATURE COVERAGE (output of engine)
// ============================================

export interface FeatureDef {
  key: string;
  display_name: string;
  description: string;
  /** Which tab/area this feature belongs to */
  area: FeatureArea;
  /** Capability keys required for this feature */
  required_capabilities: string[];
  /** Optional: capabilities that enhance but don't block */
  optional_capabilities?: string[];
}

export type FeatureArea =
  | 'control_tower'
  | 'overview'
  | 'recruiter_detail'
  | 'hm_friction'
  | 'hiring_managers'
  | 'quality'
  | 'sources'
  | 'velocity'
  | 'forecasting'
  | 'data_health'
  | 'capacity'
  | 'bottlenecks'
  | 'ask'
  | 'scenarios'
  | 'exports'
  | 'engine';

export interface FeatureCoverageEntry {
  feature_key: string;
  display_name: string;
  description: string;
  area: FeatureArea;
  status: CapabilityStatus;
  required_capabilities: string[];
  blocked_by: string[];
  limited_by: string[];
  reasons: string[];
  repair_suggestions: RepairSuggestionEntry[];
  sections: SectionCoverage[];
}

export interface SectionCoverage {
  section_key: string;
  display_name: string;
  status: CapabilityStatus;
  blocked_by: string[];
}

export type FeatureCoverageMap = Map<string, FeatureCoverageEntry>;

// ============================================
// REPAIR SUGGESTIONS
// ============================================

export interface RepairSuggestionEntry {
  capability_key: string;
  what_to_upload: string;
  required_columns: string[];
  column_aliases: string[];
  why_it_matters: string;
  what_it_unlocks: string[];
  ui_copy: RepairUICopy;
}

export interface RepairUICopy {
  short_title: string;
  banner_message: string;
  blocked_message: string;
  cta_label: string;
  cta_action: 'import' | 'demo' | 'settings';
}

// ============================================
// ENGINE OUTPUT (combined)
// ============================================

export interface CapabilityEngineResult {
  /** Timestamp of evaluation */
  evaluated_at: Date;
  /** Overall summary */
  summary: CapabilitySummary;
  /** Per-capability status */
  capability_report: CapabilityReport;
  /** Per-feature coverage */
  feature_coverage: FeatureCoverageMap;
  /** All repair suggestions, deduplicated and prioritized */
  repair_suggestions: RepairSuggestionEntry[];
}

export interface CapabilitySummary {
  total_capabilities: number;
  enabled: number;
  limited: number;
  blocked: number;
  total_features: number;
  features_enabled: number;
  features_limited: number;
  features_blocked: number;
  overall_status: 'full' | 'partial' | 'limited';
  confidence_floor: ConfidenceLevel;
}

// ============================================
// SERIALIZABLE VERSIONS (for state/context)
// ============================================

export interface SerializableCapabilityReport {
  entries: Record<string, CapabilityReportEntry>;
}

export interface SerializableFeatureCoverage {
  entries: Record<string, FeatureCoverageEntry>;
}

export interface SerializableCapabilityEngineResult {
  evaluated_at: string;
  summary: CapabilitySummary;
  capability_report: SerializableCapabilityReport;
  feature_coverage: SerializableFeatureCoverage;
  repair_suggestions: RepairSuggestionEntry[];
}
