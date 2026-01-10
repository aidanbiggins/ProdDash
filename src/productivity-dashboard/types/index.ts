// Types index - export all types from a single entry point

export * from './entities';
export * from './metrics';
export * from './config';
export * from './hmTypes';
export * from './velocityTypes';

// ===== DATA STORE STATE =====

import { Requisition, Candidate, Event, User } from './entities';
import { DashboardConfig } from './config';
import { MetricFilters, OverviewMetrics, RecruiterSummary, HiringManagerFriction, QualityMetrics, WeeklyTrend } from './metrics';

export interface DataHealth {
  candidatesMissingFirstContact: { count: number; percentage: number };
  eventsMissingActor: { count: number; percentage: number };
  reqsMissingLevel: { count: number; percentage: number };
  reqsMissingJobFamily: { count: number; percentage: number };
  unmappedStagesCount: number;
  overallHealthScore: number;  // 0-100
  lowConfidenceMetrics: string[];
}

export interface DataStore {
  requisitions: Requisition[];
  candidates: Candidate[];
  events: Event[];
  users: User[];
  config: DashboardConfig;
  dataHealth: DataHealth;
  lastImportAt: Date | null;
  importSource: 'csv' | 'api' | 'demo' | null;
}

export interface DashboardState {
  dataStore: DataStore;
  filters: MetricFilters;
  overview: OverviewMetrics | null;
  selectedRecruiterId: string | null;
  recruiterDetail: RecruiterSummary | null;
  hmFriction: HiringManagerFriction[];
  qualityMetrics: QualityMetrics | null;
  weeklyTrends: WeeklyTrend[];
  isLoading: boolean;
  error: string | null;
}

// ===== PERMISSIONS =====

export enum DashboardRole {
  Admin = 'Admin',
  Leader = 'Leader',
  Recruiter = 'Recruiter',
  Analyst = 'Analyst'
}

export interface DashboardPermissions {
  role: DashboardRole;
  userId: string;
  canViewAllRecruiters: boolean;
  canViewPeerBenchmark: boolean;
  canExportRawData: boolean;
  canEditConfig: boolean;
  teamIds: string[];  // for Leaders
}
