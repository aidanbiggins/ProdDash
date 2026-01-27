// Configuration types for the Recruiter Productivity Dashboard

import { CanonicalStage } from './entities';
import { PipelineBenchmarkConfig, DEFAULT_PIPELINE_BENCHMARKS, RecruiterGoal } from './pipelineTypes';

// ===== STAGE MAPPING =====

export interface StageMapping {
  atsStage: string;
  canonicalStage: CanonicalStage;
}

export interface StageMappingConfig {
  mappings: StageMapping[];
  unmappedStages: string[];
  isComplete: boolean;
}

// ===== COMPLEXITY WEIGHTS CONFIG =====

export interface LevelWeightsConfig {
  [level: string]: number;
}

export interface MarketWeightsConfig {
  Remote: number;
  Hybrid: number;
  Onsite: number;
  hardMarketBonus: number;
  hardMarketsList: string[];  // city names
}

export interface NicheWeightsConfig {
  [jobFamily: string]: number;
}

// ===== THRESHOLDS =====

export interface ThresholdsConfig {
  stalledReqDays: number;
  lowConfidenceThreshold: number;  // percentage
  minLoopsForHMWeight: number;
  offerMultiplier: number;
}

// ===== FULL CONFIG =====

export interface DashboardConfig {
  version: string;
  lastUpdated: Date;
  lastUpdatedBy: string;
  stageMapping: StageMappingConfig;
  levelWeights: LevelWeightsConfig;
  marketWeights: MarketWeightsConfig;
  nicheWeights: NicheWeightsConfig;
  thresholds: ThresholdsConfig;
  pipelineBenchmarks: PipelineBenchmarkConfig;
  recruiterGoals: RecruiterGoal[];
}

// ===== CONFIG CHANGE LOG =====

export interface ConfigChange {
  id: string;
  timestamp: Date;
  userId: string;
  userName: string;
  changeType: 'stageMapping' | 'levelWeights' | 'marketWeights' | 'nicheWeights' | 'thresholds';
  previousValue: string;  // JSON stringified
  newValue: string;  // JSON stringified
}

// ===== DEFAULT CONFIG =====

export const DEFAULT_CONFIG: DashboardConfig = {
  version: '1.0.0',
  lastUpdated: new Date(),
  lastUpdatedBy: 'system',
  stageMapping: {
    mappings: [],
    unmappedStages: [],
    isComplete: false
  },
  levelWeights: {
    'IC1': 0.7,
    'IC2': 0.8,
    'IC3': 1.0,
    'IC4': 1.2,
    'IC5': 1.5,
    'IC6': 1.8,
    'IC7': 2.2,
    'M1': 1.6,
    'M2': 1.9,
    'M3': 2.3,
    'M4': 2.7
  },
  marketWeights: {
    Remote: 1.0,
    Hybrid: 1.1,
    Onsite: 1.2,
    hardMarketBonus: 0.1,
    hardMarketsList: ['San Francisco', 'New York', 'London', 'Singapore', 'Tokyo']
  },
  nicheWeights: {
    'Backend': 1.0,
    'Fullstack': 1.0,
    'Frontend': 1.1,
    'Security': 1.4,
    'Mobile': 1.3,
    'Data': 1.2,
    'Payments': 1.2,
    'ML': 1.3,
    'DevOps': 1.2,
    'SRE': 1.3
  },
  thresholds: {
    stalledReqDays: 14,
    lowConfidenceThreshold: 10,  // percentage
    minLoopsForHMWeight: 3,
    offerMultiplier: 0.6
  },
  pipelineBenchmarks: DEFAULT_PIPELINE_BENCHMARKS,
  recruiterGoals: []
};
