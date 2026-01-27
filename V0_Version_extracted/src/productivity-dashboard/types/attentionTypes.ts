// Attention V2 Types
// Two-layer design: Summary buckets (front) + Drilldown lists (back)
// Optimized for TA leader decisions, not recruiter task lists.

import { ConfidenceLevel } from './capabilityTypes';
import { Accountability } from './commandCenterTypes';
import { TabType } from '../routes';

// ============================================
// ATTENTION SUMMARY (FRONT LAYER)
// ============================================

export type AttentionBucketId =
  | 'recruiter_throughput'
  | 'hm_friction'
  | 'pipeline_health'
  | 'aging_stalled'
  | 'offer_close_risk';

export type BucketSeverity = 'blocking' | 'at-risk' | 'watch';

export interface AttentionBucket {
  id: AttentionBucketId;
  label: string;
  severity: BucketSeverity;
  count: number;                      // impacted items
  confidence: ConfidenceLevel;
  confidenceReason: string;           // e.g., "Based on 8 recruiters with complete data"
  intervention: string;               // one-line recommended intervention
  navigationTarget: TabType;          // deep link to appendix view
  navigationLabel: string;            // CTA button label
  accountability?: Accountability;    // owner + due for actionable buckets
  topOffender?: string;               // e.g., "Recruiter 2 (14 reqs)" — anonymized, no PII
}

export interface AttentionSummaryData {
  buckets: AttentionBucket[];         // 0-5 buckets (only those supported by data)
  totalImpacted: number;              // sum across all buckets
  overallSeverity: BucketSeverity;    // worst bucket determines this
  allBlocked: boolean;                // true if no buckets can be computed
  blockedReason?: string;             // if allBlocked, why
}

// ============================================
// DRILLDOWN (BACK LAYER)
// ============================================

export interface RecruiterDrilldownItem {
  recruiterId: string;
  recruiterName: string;
  openReqCount: number;
  utilizationLabel: string | null;    // e.g., "120% capacity" or null if unknown
  keyLagMetric: string;               // e.g., "Screen lag: 5.2d avg" or "Stalled: 3 reqs"
  suggestedIntervention: string;      // manager-level action
  severity: BucketSeverity;
}

export interface HMDrilldownItem {
  hmId: string;
  hmName: string;
  feedbackLatencyDays: number | null;
  decisionLatencyDays: number | null;
  openItemCount: number;              // pending actions
  suggestedIntervention: string;
  severity: BucketSeverity;
}

export interface ReqClusterDrilldownItem {
  clusterLabel: string;               // e.g., "Engineering / Senior" or "San Francisco"
  reqCount: number;
  avgDaysOpen: number;
  pipelineGap: number | null;         // missing candidates vs target, or null
  riskLabel: string;                  // e.g., "2 zombie, 1 stalled"
  suggestedIntervention: string;
  severity: BucketSeverity;
}

export interface AttentionDrilldownData {
  recruiters: RecruiterDrilldownItem[];   // max 5
  hiringManagers: HMDrilldownItem[];      // max 5
  reqClusters: ReqClusterDrilldownItem[]; // max 5
}

// ============================================
// COMBINED V2 ATTENTION DATA
// ============================================

export interface AttentionV2Data {
  summary: AttentionSummaryData;
  drilldown: AttentionDrilldownData;
}
