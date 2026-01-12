// Data Hygiene Types - For filtering out zombie reqs and ghost candidates

import { Requisition, Candidate, Event, CandidateDisposition, RequisitionStatus } from './entities';

// ===== REQ HEALTH STATUS =====

export enum ReqHealthStatus {
  ACTIVE = 'ACTIVE',           // Normal, healthy req
  STALLED = 'STALLED',         // No activity in 14-30 days (Yellow)
  ZOMBIE = 'ZOMBIE',           // No activity in 30+ days (Red)
  AT_RISK = 'AT_RISK'          // Open 120+ days with <5 candidates
}

export interface ReqHealthAssessment {
  reqId: string;
  status: ReqHealthStatus;
  daysSinceLastActivity: number | null;
  daysOpen: number | null;  // STRICT: null if opened_at is missing
  activeCandidateCount: number;
  lastActivityDate: Date | null;
  reasons: string[];
  excludedFromMetrics: boolean;
}

// ===== GHOST CANDIDATE STATUS =====

export enum GhostCandidateStatus {
  ACTIVE = 'ACTIVE',           // Normal progression
  STAGNANT = 'STAGNANT',       // Stuck 10+ days without action
  ABANDONED = 'ABANDONED'      // Stuck 30+ days without action
}

export interface GhostCandidateAssessment {
  candidateId: string;
  candidateName: string | null;
  reqId: string;
  reqTitle: string;
  currentStage: string;
  status: GhostCandidateStatus;
  daysInCurrentStage: number;
  lastActionDate: Date | null;
  recruiterName: string;
  hiringManagerName: string;
}

// ===== DATA HYGIENE SUMMARY =====

export interface DataHygieneSummary {
  // Req health breakdown
  activeReqCount: number;
  stalledReqCount: number;
  zombieReqCount: number;
  atRiskReqCount: number;

  // Ghost candidates
  stagnantCandidateCount: number;
  abandonedCandidateCount: number;

  // TTF comparison
  rawMedianTTF: number | null;      // All reqs
  trueMedianTTF: number | null;     // Excluding zombies
  ttfDifferencePercent: number | null;

  // Data quality score
  hygieneScore: number;  // 0-100, higher is cleaner
}

// ===== EXCLUSION SETTINGS =====

export interface DataHygieneExclusions {
  excludedReqIds: Set<string>;
  excludeZombiesFromTTF: boolean;
  excludeStalledFromTTF: boolean;
  zombieThresholdDays: number;      // Default: 30
  stalledThresholdDays: number;     // Default: 14
  ghostThresholdDays: number;       // Default: 10
  atRiskDaysOpen: number;           // Default: 120
  atRiskMinCandidates: number;      // Default: 5
}

export const DEFAULT_HYGIENE_SETTINGS: DataHygieneExclusions = {
  excludedReqIds: new Set(),
  excludeZombiesFromTTF: true,
  excludeStalledFromTTF: false,
  zombieThresholdDays: 30,
  stalledThresholdDays: 14,
  ghostThresholdDays: 10,
  atRiskDaysOpen: 120,
  atRiskMinCandidates: 5
};
