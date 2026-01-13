// Velocity Analysis Types
// For analyzing factors that contribute to fast, successful hires

// ===== DECAY ANALYSIS =====

export interface DecayDataPoint {
  bucket: string;           // e.g., "0-14 days", "15-30 days"
  minDays: number;
  maxDays: number;
  count: number;            // sample size
  rate: number;             // acceptance rate or fill rate (0-1)
  cumulativeRate: number;   // cumulative rate up to this bucket
}

export interface CandidateDecayAnalysis {
  dataPoints: DecayDataPoint[];
  medianDaysToDecision: number | null;
  overallAcceptanceRate: number;
  totalOffers: number;
  totalAccepted: number;
  // Decay rate: how much acceptance drops per day after a threshold
  decayRatePerDay: number | null;
  decayStartDay: number | null;  // day at which decay becomes significant
}

export interface ReqDecayAnalysis {
  dataPoints: DecayDataPoint[];
  medianDaysToFill: number | null;
  overallFillRate: number;
  totalReqs: number;
  totalFilled: number;
  // Decay rate: how much fill probability drops per day
  decayRatePerDay: number | null;
  decayStartDay: number | null;
}

// ===== SUCCESS FACTOR ANALYSIS =====

export interface SuccessFactorComparison {
  factor: string;
  fastHiresValue: number | string;
  slowHiresValue: number | string;
  delta: number | string;
  unit: string;
  impactLevel: 'high' | 'medium' | 'low';
}

export interface CohortComparison {
  fastHires: HireCohortStats;
  slowHires: HireCohortStats;
  allHires: HireCohortStats;
  factors: SuccessFactorComparison[];
}

export interface HireCohortStats {
  count: number;
  avgTimeToFill: number;
  medianTimeToFill: number;
  avgHMLatency: number;
  referralPercent: number;
  avgPipelineDepth: number;
  avgInterviewsPerHire: number;
  avgSubmittalsPerHire: number;
}

// ===== VELOCITY METRICS (Combined) =====

export interface VelocityMetrics {
  candidateDecay: CandidateDecayAnalysis;
  reqDecay: ReqDecayAnalysis;
  cohortComparison: CohortComparison | null;
  // Key insights derived from the data
  insights: VelocityInsight[];
}

export interface VelocityInsight {
  type: 'warning' | 'success' | 'info';
  title: string;
  description: string;
  metric?: string;
  action?: string;
  /** Evidence string showing metric + value for transparency */
  evidence?: string;
  /** Sample size this insight is based on */
  sampleSize?: number;
  /** Optional link target for drilling down */
  linkTarget?: { tab: string; filter?: Record<string, unknown> };
  /** So what - why this matters (1 sentence) */
  soWhat?: string;
  /** Next step - recommended action (1 sentence) */
  nextStep?: string;
  /** Confidence level for this insight */
  confidence?: 'HIGH' | 'MED' | 'LOW' | 'INSUFFICIENT';
  /** Top contributing items for evidence drilldown */
  contributingItems?: Array<{
    id: string;
    title?: string;
    value?: string | number;
    type: 'req' | 'candidate' | 'application';
  }>;
  /** Cohort filters used to generate this insight */
  cohortFilters?: Record<string, unknown>;
}

// ===== RECRUITER-SPECIFIC VELOCITY =====

export interface RecruiterVelocityProfile {
  recruiterId: string;
  recruiterName: string;
  avgTimeToFill: number;
  medianTimeToFill: number;
  fillRate: number;
  referralRate: number;
  hmPartnershipScores: HMPartnershipScore[];
  velocityTrend: 'improving' | 'stable' | 'declining';
}

export interface HMPartnershipScore {
  hmId: string;
  hmName: string;
  calibrationRate: number;  // % of submittals that reach offer
  avgFeedbackLatency: number;
  reqsTogether: number;
  avgTimeToFill: number;
}
