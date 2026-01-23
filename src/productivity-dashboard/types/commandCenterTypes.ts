// Command Center Types
// Types for the leader-first Command Center view
// See docs/plans/COMMAND_CENTER_V1.md

import { ActionItem, ActionType } from './actionTypes';
import { CapabilityStatus, ConfidenceLevel } from './capabilityTypes';
import { TabType } from '../routes';

// ============================================
// CONFIDENCE & ACCOUNTABILITY
// ============================================

export type ConfidenceType = 'data' | 'risk' | 'forecast';

export interface Accountability {
  owner: string;   // Role: "Recruiter", "HM", "TA Ops", "Exec"
  due: string;     // Relative: "24h", "48h", "This week", "Today"
}

// ============================================
// SECTION STATUSES
// ============================================

export type SectionId =
  | 'cc_attention'
  | 'cc_on_track'
  | 'cc_risk'
  | 'cc_changes'
  | 'cc_whatif'
  | 'cc_bottleneck';

export interface SectionGateResult {
  sectionId: SectionId;
  status: CapabilityStatus;
  confidence: ConfidenceLevel;
  blockedReason?: string;
  limitedReason?: string;
  repairCTA?: {
    label: string;
    action: 'import' | 'map_columns' | 'import_snapshot';
  };
}

// ============================================
// SECTION 1: ATTENTION
// ============================================

export interface AttentionItem {
  action_id: string;
  priority: 'P0' | 'P1' | 'P2';
  title: string;
  owner_name: string;
  owner_type: 'RECRUITER' | 'HIRING_MANAGER' | 'TA_OPS';
  due_in_days: number;
  recommended_action: string;
  confidence: ConfidenceLevel;
  req_id?: string;
  explain_kpi?: string;
}

export interface AttentionSection {
  p0_count: number;
  p1_count: number;
  items: AttentionItem[];  // max 5
}

// ============================================
// SECTION 2: ON TRACK
// ============================================

export type KPIStatus = 'green' | 'amber' | 'red';
export type Verdict = 'ON_TRACK' | 'AT_RISK' | 'OFF_TRACK';

export interface KPIRow {
  id: string;
  label: string;
  value: number | null;
  target: number;
  status: KPIStatus;
  unit: string;
  explain_provider?: string;
}

export interface OnTrackSection {
  kpis: KPIRow[];
  verdict: Verdict | null;  // null if insufficient KPIs
  verdict_reason: string;
}

// ============================================
// SECTION 3: RISK
// ============================================

export interface RiskItem {
  req_id: string;
  req_title: string;
  days_open: number;
  failure_mode: string;
  failure_mode_label: string;
  severity: 'critical' | 'high' | 'medium';
  why: string;
  so_what: string;
  next_move: string;
  action_type: ActionType;
  accountability?: Accountability;
}

export interface RiskSection {
  total_at_risk: number;
  by_failure_mode: Record<string, number>;
  items: RiskItem[];  // max 5
}

// ============================================
// SECTION 4: CHANGES
// ============================================

export type DeltaDirection = 'up' | 'down' | 'flat';

export interface DeltaItem {
  direction: DeltaDirection;
  label: string;
  magnitude: string;
  material: boolean;
  action_type?: ActionType;
}

export interface ChangesSection {
  available: boolean;
  deltas: DeltaItem[];  // max 5
}

// ============================================
// SECTION 5: WHAT-IF
// ============================================

export type ScenarioId = 'recruiter_leaves' | 'hiring_freeze' | 'spin_up_team';

export interface ScenarioDelta {
  label: string;           // e.g., "+8 days TTF", "-12% probability"
  direction: 'up' | 'down' | 'neutral';
  sentiment: 'good' | 'bad' | 'neutral';  // up TTF is bad, up hires is good
}

export interface ScenarioPreview {
  scenario_id: ScenarioId;
  title: string;
  impact_summary: string;
  relevance_reason: string;
  decision_ask: string;
  deltas?: ScenarioDelta[];  // 0-3 outcome deltas
}

export interface WhatIfSection {
  available: boolean;
  scenario_previews: ScenarioPreview[];  // max 2
}

// ============================================
// SECTION 6: BOTTLENECK
// ============================================

export type BottleneckDiagnosis = 'PIPELINE_BOUND' | 'CAPACITY_BOUND' | 'BOTH' | 'HEALTHY';

export interface BottleneckSection {
  diagnosis: BottleneckDiagnosis;
  evidence: string[];
  recommendation: string;
  primary_action: {
    label: string;
    navigation_target: string;  // tab ID to navigate to
  };
  accountability?: Accountability;
}

// ============================================
// PRIORITY ARBITRATION
// ============================================

export type PriorityCategory =
  | 'BLOCKING_ATTENTION'
  | 'OFF_TRACK'
  | 'CRITICAL_RISK'
  | 'AT_RISK_ATTENTION'
  | 'CAPACITY_BOUND'
  | 'NONE';

export type PrioritySeverity = 'critical' | 'high' | 'info';

export interface TopPriority {
  category: PriorityCategory;
  severity: PrioritySeverity;
  headline: string;
  cta_label: string;
  cta_target: TabType | 'drilldown';
  source_section: SectionId;
  accountability?: Accountability;  // Present when severity is critical or high
}

export interface ChangesSummary {
  sentence: string;        // e.g. "3 material changes: TTF up, pipeline down, 2 new hires"
  material_count: number;
}

// ============================================
// COMBINED FACT PACK
// ============================================

export interface CommandCenterFactPack {
  attention: AttentionSection;
  on_track: OnTrackSection;
  risk: RiskSection;
  changes: ChangesSection;
  whatif: WhatIfSection;
  bottleneck: BottleneckSection;
  meta: {
    computed_at: Date;
    confidence: ConfidenceLevel;
    blocked_sections: SectionId[];
  };
}

// ============================================
// SECTION BLOCKED COPY
// ============================================

export interface SectionBlockedCopy {
  title: string;
  whats_needed: string;
  cta_label: string;
  cta_action: 'import' | 'map_columns' | 'import_snapshot';
}

export const SECTION_BLOCKED_COPY: Record<SectionId, SectionBlockedCopy> = {
  cc_attention: {
    title: 'No data to surface actions',
    whats_needed: 'Import a CSV with requisition and candidate data to see what needs your attention.',
    cta_label: 'Import Data',
    cta_action: 'import',
  },
  cc_on_track: {
    title: "Can't assess progress",
    whats_needed: "Needs application dates and hire outcomes. Map the 'Applied Date' and 'Hire Date' columns.",
    cta_label: 'Map Columns',
    cta_action: 'map_columns',
  },
  cc_risk: {
    title: 'No requisitions to assess',
    whats_needed: 'Import requisition data to see which roles are at risk.',
    cta_label: 'Import Data',
    cta_action: 'import',
  },
  cc_changes: {
    title: 'Need a prior snapshot',
    whats_needed: 'Import a second data snapshot to see week-over-week changes. PlatoVue compares your latest import against the previous one.',
    cta_label: 'Import Snapshot',
    cta_action: 'import_snapshot',
  },
  cc_whatif: {
    title: "Can't model scenarios",
    whats_needed: "Needs recruiter assignment data. Map the 'Recruiter' column to see what-if analysis.",
    cta_label: 'Map Columns',
    cta_action: 'map_columns',
  },
  cc_bottleneck: {
    title: "Can't diagnose constraints",
    whats_needed: 'Needs recruiter assignment data to distinguish pipeline vs capacity bottlenecks.',
    cta_label: 'Map Columns',
    cta_action: 'map_columns',
  },
};
