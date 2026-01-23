// Ultimate Demo Generator v2 - Coherent Demo Data
// Generates complete synthetic dataset with intentional patterns for teaching PlatoVue
// See docs/plans/ULTIMATE_DEMO_DATA_INTERACTIVE_V1.md

import { subDays, addDays, format, differenceInDays } from 'date-fns';
import {
  Requisition,
  Candidate,
  Event,
  User,
  CanonicalStage,
  CandidateDisposition,
  UserRole,
  LocationType,
  LocationRegion,
  RequisitionStatus,
  HeadcountType,
  Function as FunctionEnum,
  EventType,
  Priority,
} from '../types/entities';
import { DataSnapshot, SnapshotEvent, SnapshotEventType, EventConfidence } from '../types/snapshotTypes';
import {
  DemoPackConfig,
  DEFAULT_PACK_CONFIG,
  DemoCandidate,
  UltimateDemoBundle,
  CapabilityPreview,
  AIStub,
  CalibrationRecord,
  resolvePackDependencies,
} from '../types/demoTypes';
import { getAllCapabilityStatuses } from './capabilityRegistry';
import { CoverageMetrics } from '../types/resilientImportTypes';

// ============================================
// SEEDED RANDOM NUMBER GENERATOR
// ============================================

/**
 * Mulberry32 PRNG - deterministic random number generator
 * Same seed always produces same sequence of numbers
 */
function createSeededRandom(seed: string): () => number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(31, h) + seed.charCodeAt(i) | 0;
  }
  return function() {
    h |= 0;
    h = h + 0x6D2B79F5 | 0;
    let t = Math.imul(h ^ h >>> 15, 1 | h);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// ============================================
// PERSONA DEFINITIONS - Deterministic identities
// ============================================

interface RecruiterPersona {
  id: string;
  name: string;
  trait: 'strong_closer' | 'overloaded' | 'slow_screener' | 'great_offers' | 'balanced' | 'new_hire' | 'senior' | 'average';
  screenSpeed: number;  // 1-5 (1=slow, 5=fast)
  closeRate: number;    // 0-1 (offer acceptance influence)
  capacity: number;     // max comfortable req load
  description: string;
}

interface HMPersona {
  id: string;
  name: string;
  trait: 'fast_responder' | 'slow_responder' | 'very_slow' | 'decisive' | 'indecisive' | 'balanced';
  feedbackDays: number; // average days to give feedback
  decisionSpeed: number; // 1-5 (1=slow, 5=fast)
  description: string;
}

// Fixed recruiter personas - always same IDs and names
const RECRUITER_PERSONAS: RecruiterPersona[] = [
  { id: 'recruiter_alpha', name: 'Sarah Chen', trait: 'strong_closer', screenSpeed: 4, closeRate: 0.92, capacity: 8, description: 'Strong closer, excellent candidate experience' },
  { id: 'recruiter_beta', name: 'Marcus Rodriguez', trait: 'overloaded', screenSpeed: 3, closeRate: 0.78, capacity: 5, description: 'Overloaded with 12 reqs, struggling to keep up' },
  { id: 'recruiter_gamma', name: 'Emily Watson', trait: 'slow_screener', screenSpeed: 2, closeRate: 0.85, capacity: 7, description: 'Thorough but slow at initial screens' },
  { id: 'recruiter_delta', name: 'James Park', trait: 'great_offers', screenSpeed: 3, closeRate: 0.95, capacity: 6, description: 'Excellent at closing offers, top performer' },
  { id: 'recruiter_epsilon', name: 'Priya Sharma', trait: 'balanced', screenSpeed: 3, closeRate: 0.82, capacity: 7, description: 'Solid all-around performer' },
  { id: 'recruiter_zeta', name: 'David Kim', trait: 'new_hire', screenSpeed: 2, closeRate: 0.70, capacity: 4, description: 'New hire, still ramping up' },
  { id: 'recruiter_eta', name: 'Lisa Thompson', trait: 'senior', screenSpeed: 4, closeRate: 0.88, capacity: 9, description: 'Senior recruiter, mentors others' },
  { id: 'recruiter_theta', name: 'Alex Rivera', trait: 'average', screenSpeed: 3, closeRate: 0.80, capacity: 6, description: 'Consistent middle performer' },
];

// Fixed HM personas - always same IDs and names
const HM_PERSONAS: HMPersona[] = [
  { id: 'hm_fast_1', name: 'Michael Chang', trait: 'fast_responder', feedbackDays: 1, decisionSpeed: 5, description: 'Responds within hours, decisive' },
  { id: 'hm_fast_2', name: 'Jennifer Lee', trait: 'fast_responder', feedbackDays: 1, decisionSpeed: 4, description: 'Quick feedback, knows what they want' },
  { id: 'hm_slow_1', name: 'Robert Wilson', trait: 'slow_responder', feedbackDays: 5, decisionSpeed: 2, description: 'Slow to respond, often needs reminders' },
  { id: 'hm_slow_2', name: 'Amanda Foster', trait: 'very_slow', feedbackDays: 8, decisionSpeed: 1, description: 'Very slow feedback, major bottleneck' },
  { id: 'hm_decisive', name: 'Chris Martinez', trait: 'decisive', feedbackDays: 2, decisionSpeed: 5, description: 'Decisive after review, clear feedback' },
  { id: 'hm_indecisive', name: 'Patricia Brown', trait: 'indecisive', feedbackDays: 4, decisionSpeed: 2, description: 'Often changes mind, needs multiple rounds' },
  { id: 'hm_balanced_1', name: 'Daniel Taylor', trait: 'balanced', feedbackDays: 2, decisionSpeed: 3, description: 'Balanced approach, reasonable timelines' },
  { id: 'hm_balanced_2', name: 'Michelle Anderson', trait: 'balanced', feedbackDays: 3, decisionSpeed: 3, description: 'Good partner, meets SLAs' },
  { id: 'hm_balanced_3', name: 'Kevin Patel', trait: 'balanced', feedbackDays: 2, decisionSpeed: 4, description: 'Engaged manager, proactive' },
  { id: 'hm_balanced_4', name: 'Rachel Kim', trait: 'balanced', feedbackDays: 3, decisionSpeed: 3, description: 'Standard response times' },
  { id: 'hm_balanced_5', name: 'Thomas Garcia', trait: 'balanced', feedbackDays: 2, decisionSpeed: 3, description: 'Reliable feedback loop' },
  { id: 'hm_balanced_6', name: 'Nicole Davis', trait: 'balanced', feedbackDays: 2, decisionSpeed: 4, description: 'Active in process' },
  { id: 'hm_balanced_7', name: 'Andrew Miller', trait: 'balanced', feedbackDays: 3, decisionSpeed: 3, description: 'Consistent behavior' },
  { id: 'hm_balanced_8', name: 'Stephanie White', trait: 'balanced', feedbackDays: 2, decisionSpeed: 3, description: 'Good communicator' },
  { id: 'hm_balanced_9', name: 'Brandon Moore', trait: 'balanced', feedbackDays: 3, decisionSpeed: 3, description: 'Standard HM' },
];

// ============================================
// DEMO STORY PATTERNS
// ============================================

export interface DemoStoryPattern {
  id: string;
  name: string;
  description: string;
  whereToFind: string[];
}

export const DEMO_STORY_PATTERNS: DemoStoryPattern[] = [
  {
    id: 'stalled_reqs',
    name: '3 Stalled Requisitions',
    description: 'Reqs with no activity for 14+ days',
    whereToFind: ['Control Tower > Risks', 'Data Health tab', 'Ask: "show stalled reqs"'],
  },
  {
    id: 'hm_bottleneck_1',
    name: 'HM Bottleneck: Robert Wilson',
    description: '5+ day average feedback time',
    whereToFind: ['HM Friction tab', 'Control Tower > Actions', 'Ask: "hm latency"'],
  },
  {
    id: 'hm_bottleneck_2',
    name: 'HM Bottleneck: Amanda Foster',
    description: '8+ day average feedback - major blocker',
    whereToFind: ['HM Friction tab', 'Control Tower > Actions', 'Ask: "worst HM"'],
  },
  {
    id: 'offer_bottleneck',
    name: 'Offer Pending 10+ Days',
    description: 'Candidate stuck in offer stage',
    whereToFind: ['Control Tower > Risks', 'Forecasting > Oracle', 'Ask: "at risk offers"'],
  },
  {
    id: 'overloaded_recruiter',
    name: 'Overloaded: Marcus Rodriguez',
    description: '12 reqs assigned (capacity: 5)',
    whereToFind: ['Capacity tab', 'Recruiter Detail', 'Ask: "overloaded recruiters"'],
  },
  {
    id: 'high_performer',
    name: 'Top Performer: James Park',
    description: '95% offer accept rate, fast cycle times',
    whereToFind: ['Recruiter Detail', 'Overview > Leaderboard', 'Ask: "best recruiter"'],
  },
  {
    id: 'thin_pipeline',
    name: 'Thin Pipeline Gap',
    description: 'Req with only 2 candidates in pipeline',
    whereToFind: ['Control Tower > Risks', 'Forecasting', 'Ask: "pipeline gap"'],
  },
  {
    id: 'zombie_reqs',
    name: '2 Zombie Requisitions',
    description: 'Reqs with 30+ days no activity',
    whereToFind: ['Data Health tab', 'Control Tower > Risks', 'Ask: "zombie reqs"'],
  },
];

// ============================================
// CONSTANTS
// ============================================

const FUNCTIONS = [FunctionEnum.Engineering, FunctionEnum.Product, FunctionEnum.Sales, FunctionEnum.GA, FunctionEnum.Marketing];
const JOB_FAMILIES = ['Backend', 'Frontend', 'Fullstack', 'Security', 'Mobile', 'Data', 'DevOps', 'SRE'];
const LEVELS = ['IC1', 'IC2', 'IC3', 'IC4', 'IC5', 'M1', 'M2'];
const LOCATION_TYPES = [LocationType.Remote, LocationType.Hybrid, LocationType.Onsite];
const REGIONS = [LocationRegion.AMER, LocationRegion.EMEA, LocationRegion.APAC];
const SOURCES = ['Referral', 'Inbound', 'Sourced', 'Agency', 'Internal'];
const HEADCOUNT_TYPES = [HeadcountType.New, HeadcountType.Backfill];

// Safe email domains (reserved for documentation per RFC 2606)
const SAFE_EMAIL_DOMAINS = ['example.com', 'example.org', 'test.example.net'];

// Candidate first names pool
const CANDIDATE_FIRST_NAMES = [
  'Emma', 'Liam', 'Olivia', 'Noah', 'Ava', 'Sophia', 'William', 'Isabella',
  'Benjamin', 'Mia', 'Lucas', 'Charlotte', 'Henry', 'Amelia', 'Harper',
  'Evelyn', 'Daniel', 'Abigail', 'Matthew', 'Emily', 'David', 'Elizabeth',
  'Joseph', 'Sofia', 'Samuel', 'Avery', 'Sebastian', 'Priya', 'Raj', 'Wei',
  'Yuki', 'Carlos', 'Maria', 'Ahmed', 'Fatima', 'Chen', 'Aisha', 'Casey',
  'Jordan', 'Morgan', 'Riley', 'Taylor', 'Quinn', 'Skyler', 'Cameron', 'Drew',
];

// Synthetic PII suffixes (clearly fake)
const PII_SUFFIXES = ['Demo', 'Sample', 'Test', 'Example', 'Synthetic'];

// ============================================
// HELPER FUNCTIONS
// ============================================

function seededItem<T>(arr: T[], random: () => number): T {
  return arr[Math.floor(random() * arr.length)];
}

function seededInt(min: number, max: number, random: () => number): number {
  return Math.floor(random() * (max - min + 1)) + min;
}

function seededDate(start: Date, end: Date, random: () => number): Date {
  const startTime = start.getTime();
  const endTime = end.getTime();
  return new Date(startTime + random() * (endTime - startTime));
}

function formatDate(date: Date): string {
  return format(date, "yyyy-MM-dd'T'HH:mm:ss'Z'");
}

function generateCandidateName(index: number, random: () => number, includePII: boolean): {
  name: string;
  email: string | null;
  phone: string | null;
} {
  const firstName = CANDIDATE_FIRST_NAMES[index % CANDIDATE_FIRST_NAMES.length];
  const suffix = PII_SUFFIXES[index % PII_SUFFIXES.length];

  if (includePII) {
    const domain = SAFE_EMAIL_DOMAINS[index % SAFE_EMAIL_DOMAINS.length];
    const phoneNum = String(index % 100).padStart(2, '0');
    return {
      name: `${firstName} ${suffix}`,
      email: `${firstName.toLowerCase()}.${suffix.toLowerCase()}${index}@${domain}`,
      phone: `+1 415 555 01${phoneNum}`,
    };
  }

  return {
    name: `${firstName} ${suffix}`,
    email: null,
    phone: null,
  };
}

// ============================================
// EVENTS-FIRST ARCHITECTURE
// ============================================

interface CandidateJourney {
  candidateId: string;
  reqId: string;
  stages: { stage: CanonicalStage; enteredAt: Date; actorId: string; fromStage: CanonicalStage | null }[];
  finalStage: CanonicalStage;
  disposition: CandidateDisposition;
  hiredAt: Date | null;
  rejectedAt: Date | null;
  withdrawnAt: Date | null;
  offerExtendedAt: Date | null;
  offerAcceptedAt: Date | null;
}

/**
 * Simulate a candidate journey through the funnel
 * Events are generated first, then candidate record is derived
 */
function simulateCandidateJourney(
  candidateId: string,
  reqId: string,
  appliedAt: Date,
  now: Date,
  recruiter: RecruiterPersona,
  hm: HMPersona | null,
  random: () => number,
  includeOffers: boolean,
  boostHireRate: boolean = false  // When true, increase hire probability
): CandidateJourney {
  const stages: { stage: CanonicalStage; enteredAt: Date; actorId: string; fromStage: CanonicalStage | null }[] = [];
  let currentDate = appliedAt;
  let currentStage = CanonicalStage.APPLIED;

  // Start with LEAD → APPLIED transition (ensures from_stage is populated)
  // This represents the candidate's sourced/lead status before formal application
  const leadDate = subDays(appliedAt, seededInt(0, 2, random));
  stages.push({ stage: CanonicalStage.LEAD, enteredAt: leadDate, actorId: recruiter.id, fromStage: null });
  stages.push({ stage: CanonicalStage.APPLIED, enteredAt: appliedAt, actorId: recruiter.id, fromStage: CanonicalStage.LEAD });

  // Funnel with conversion rates influenced by personas
  // When boostHireRate is true, we increase rates to ensure >= 10% of candidates get hired (for TTF chart)
  const hireBoost = boostHireRate ? 1.6 : 1.0;
  const funnelSteps: { from: CanonicalStage; to: CanonicalStage; baseRate: number; daysMin: number; daysMax: number }[] = [
    { from: CanonicalStage.APPLIED, to: CanonicalStage.SCREEN, baseRate: 0.45 * hireBoost, daysMin: 1, daysMax: 4 },
    { from: CanonicalStage.SCREEN, to: CanonicalStage.HM_SCREEN, baseRate: 0.70 * hireBoost, daysMin: 2, daysMax: 5 },
    { from: CanonicalStage.HM_SCREEN, to: CanonicalStage.ONSITE, baseRate: 0.60 * hireBoost, daysMin: 3, daysMax: 8 },
    { from: CanonicalStage.ONSITE, to: CanonicalStage.OFFER, baseRate: 0.40 * hireBoost, daysMin: 2, daysMax: 5 },
    { from: CanonicalStage.OFFER, to: CanonicalStage.HIRED, baseRate: 0.85 * hireBoost, daysMin: 3, daysMax: 10 },
  ];

  for (const step of funnelSteps) {
    if (currentStage !== step.from) continue;

    // Skip offer/hire if offers pack disabled
    if (!includeOffers && step.to === CanonicalStage.OFFER) break;

    // Adjust conversion rate based on personas
    let conversionRate = step.baseRate;

    // Recruiter speed affects early stages
    if (step.from === CanonicalStage.APPLIED || step.from === CanonicalStage.SCREEN) {
      conversionRate *= (recruiter.screenSpeed / 3); // normalize around 3
    }

    // HM speed affects HM_SCREEN to ONSITE
    if (step.from === CanonicalStage.HM_SCREEN && hm) {
      conversionRate *= (hm.decisionSpeed / 3);
    }

    // Recruiter close rate affects offer acceptance
    if (step.from === CanonicalStage.OFFER) {
      conversionRate = recruiter.closeRate;
    }

    // Cap at reasonable bounds
    conversionRate = Math.min(0.95, Math.max(0.20, conversionRate));

    if (random() < conversionRate) {
      // Calculate days based on personas
      let daysToAdvance = seededInt(step.daysMin, step.daysMax, random);

      // HM latency adds delay at HM_SCREEN stage
      if (step.from === CanonicalStage.HM_SCREEN && hm) {
        daysToAdvance += Math.floor(hm.feedbackDays * random());
      }

      // Slow screener adds delay
      if (step.from === CanonicalStage.SCREEN && recruiter.trait === 'slow_screener') {
        daysToAdvance += seededInt(2, 4, random);
      }

      currentDate = addDays(currentDate, daysToAdvance);
      if (currentDate > now) break;

      const prevStage = currentStage;
      currentStage = step.to;
      const actorId = (step.from === CanonicalStage.HM_SCREEN || step.from === CanonicalStage.ONSITE) && hm
        ? hm.id
        : recruiter.id;
      stages.push({ stage: currentStage, enteredAt: currentDate, actorId, fromStage: prevStage });
    } else {
      // Candidate rejected or withdrew
      break;
    }
  }

  // Determine final disposition
  let disposition: CandidateDisposition = CandidateDisposition.Active;
  let hiredAt: Date | null = null;
  let rejectedAt: Date | null = null;
  let withdrawnAt: Date | null = null;
  let offerExtendedAt: Date | null = null;
  let offerAcceptedAt: Date | null = null;

  if (currentStage === CanonicalStage.HIRED) {
    disposition = CandidateDisposition.Hired;
    hiredAt = stages[stages.length - 1].enteredAt;
    // Find offer stage
    const offerStage = stages.find(s => s.stage === CanonicalStage.OFFER);
    if (offerStage) {
      offerExtendedAt = offerStage.enteredAt;
      offerAcceptedAt = hiredAt;
    }
  } else if (stages.length > 1) {
    // Candidate stopped progressing - determine if rejected or withdrew
    const lastStageDate = stages[stages.length - 1].enteredAt;
    const daysSinceLastStage = differenceInDays(now, lastStageDate);

    if (daysSinceLastStage > 14) {
      // Older candidates are more likely to be rejected
      if (random() > 0.2) {
        disposition = CandidateDisposition.Rejected;
        rejectedAt = addDays(lastStageDate, seededInt(1, 5, random));
      } else {
        disposition = CandidateDisposition.Withdrawn;
        withdrawnAt = addDays(lastStageDate, seededInt(1, 5, random));
      }
    }
    // else remains Active
  }

  // Track offer extended for candidates who got to offer but didn't hire
  if (currentStage === CanonicalStage.OFFER && !hiredAt) {
    offerExtendedAt = stages[stages.length - 1].enteredAt;
  }

  return {
    candidateId,
    reqId,
    stages,
    finalStage: currentStage,
    disposition,
    hiredAt,
    rejectedAt,
    withdrawnAt,
    offerExtendedAt,
    offerAcceptedAt,
  };
}

// ============================================
// INTENTIONAL PATTERN GENERATORS
// ============================================

interface ReqConfig {
  reqId: string;
  title: string;
  func: FunctionEnum;
  jobFamily: string;
  level: string;
  recruiterId: string;
  hmId: string;
  openedAt: Date;
  status: RequisitionStatus;
  closedAt: Date | null;
  priority: Priority | null;
  isStalled?: boolean;
  isZombie?: boolean;
  hasThinPipeline?: boolean;
}

function generateIntentionalReqs(
  sessionId: string,
  now: Date,
  recruiters: RecruiterPersona[],
  hms: HMPersona[],
  random: () => number
): ReqConfig[] {
  const reqs: ReqConfig[] = [];
  let reqIndex = 1;

  // Helper to create a req
  const createReq = (overrides: Partial<ReqConfig> & { recruiterId: string; hmId: string }): ReqConfig => {
    const id = `req_${sessionId}_${String(reqIndex++).padStart(4, '0')}`;
    const func = overrides.func || seededItem(FUNCTIONS, random);
    const jobFamily = overrides.jobFamily || seededItem(JOB_FAMILIES, random);
    const level = overrides.level || seededItem(LEVELS, random);
    const openedAt = overrides.openedAt || seededDate(subDays(now, 90), subDays(now, 10), random);

    return {
      reqId: id,
      title: overrides.title || `${level} ${jobFamily} Engineer`,
      func,
      jobFamily,
      level,
      recruiterId: overrides.recruiterId,
      hmId: overrides.hmId,
      openedAt,
      status: overrides.status || RequisitionStatus.Open,
      closedAt: overrides.closedAt || null,
      priority: overrides.priority || null,
      isStalled: overrides.isStalled,
      isZombie: overrides.isZombie,
      hasThinPipeline: overrides.hasThinPipeline,
    };
  };

  // Pattern: Overloaded recruiter (Marcus Rodriguez - recruiter_beta)
  const overloadedRecruiter = recruiters.find(r => r.id === 'recruiter_beta')!;
  for (let i = 0; i < 12; i++) {
    const hm = seededItem(hms, random);
    reqs.push(createReq({
      recruiterId: overloadedRecruiter.id,
      hmId: hm.id,
      openedAt: seededDate(subDays(now, 60), subDays(now, 10), random),
    }));
  }

  // Pattern: HM bottleneck reqs (Robert Wilson - hm_slow_1, Amanda Foster - hm_slow_2)
  const slowHM1 = hms.find(h => h.id === 'hm_slow_1')!;
  const slowHM2 = hms.find(h => h.id === 'hm_slow_2')!;

  // Reqs for slow HMs
  for (let i = 0; i < 4; i++) {
    const recruiter = recruiters[i % recruiters.length];
    reqs.push(createReq({
      recruiterId: recruiter.id,
      hmId: slowHM1.id,
      priority: Priority.P1,
    }));
  }

  for (let i = 0; i < 3; i++) {
    const recruiter = recruiters[(i + 2) % recruiters.length];
    reqs.push(createReq({
      recruiterId: recruiter.id,
      hmId: slowHM2.id,
      priority: Priority.P0,
    }));
  }

  // Pattern: 3 Stalled reqs (14+ days no activity)
  for (let i = 0; i < 3; i++) {
    const recruiter = recruiters[(i + 3) % recruiters.length];
    const hm = hms[(i + 5) % hms.length];
    reqs.push(createReq({
      recruiterId: recruiter.id,
      hmId: hm.id,
      openedAt: subDays(now, seededInt(45, 60, random)),
      isStalled: true,
    }));
  }

  // Pattern: 2 Zombie reqs (30+ days no activity)
  for (let i = 0; i < 2; i++) {
    const recruiter = recruiters[(i + 5) % recruiters.length];
    const hm = hms[(i + 7) % hms.length];
    reqs.push(createReq({
      recruiterId: recruiter.id,
      hmId: hm.id,
      openedAt: subDays(now, seededInt(60, 90, random)),
      isZombie: true,
    }));
  }

  // Pattern: Thin pipeline req
  const thinPipelineRecruiter = recruiters.find(r => r.id === 'recruiter_gamma')!;
  reqs.push(createReq({
    recruiterId: thinPipelineRecruiter.id,
    hmId: hms[0].id,
    title: 'IC4 Security Engineer',
    level: 'IC4',
    jobFamily: 'Security',
    priority: Priority.P0,
    hasThinPipeline: true,
  }));

  // Pattern: High performer's reqs (James Park - recruiter_delta)
  const highPerformer = recruiters.find(r => r.id === 'recruiter_delta')!;
  for (let i = 0; i < 6; i++) {
    const hm = hms[(i + 1) % hms.length];
    const closedChance = random();
    const isClosed = closedChance < 0.5;
    const openedAt = seededDate(subDays(now, 90), subDays(now, 30), random);
    reqs.push(createReq({
      recruiterId: highPerformer.id,
      hmId: hm.id,
      openedAt,
      status: isClosed ? RequisitionStatus.Closed : RequisitionStatus.Open,
      closedAt: isClosed ? seededDate(addDays(openedAt, 20), now, random) : null,
    }));
  }

  // Fill remaining reqs to reach ~50 total
  const remainingCount = 50 - reqs.length;
  for (let i = 0; i < remainingCount; i++) {
    const recruiter = recruiters[i % recruiters.length];
    const hm = hms[i % hms.length];
    const closedChance = random();
    const statusRoll = random();

    let status = RequisitionStatus.Open;
    let closedAt: Date | null = null;
    const openedAt = seededDate(subDays(now, 90), subDays(now, 15), random);

    if (statusRoll < 0.25) {
      status = RequisitionStatus.Closed;
      closedAt = seededDate(addDays(openedAt, 20), now, random);
    } else if (statusRoll < 0.30) {
      status = RequisitionStatus.OnHold;
    }

    reqs.push(createReq({
      recruiterId: recruiter.id,
      hmId: hm.id,
      openedAt,
      status,
      closedAt,
    }));
  }

  return reqs;
}

// ============================================
// CORE DATA GENERATION
// ============================================

interface CoreATSResult {
  requisitions: Requisition[];
  candidates: DemoCandidate[];
  events: Event[];
  users: User[];
  funnelStats: Map<string, { screens: number; hmScreens: number; onsites: number; offers: number; hires: number }>;
}

function generateCoreATS(
  random: () => number,
  sessionId: string,
  now: Date,
  config: {
    includeRecruiterHM: boolean;
    includePII: boolean;
    includeOffers: boolean;
  }
): CoreATSResult {
  const startDate = subDays(now, 120);
  const requisitions: Requisition[] = [];
  const candidates: DemoCandidate[] = [];
  const events: Event[] = [];
  const users: User[] = [];

  // Track funnel stats per recruiter
  const funnelStats = new Map<string, { screens: number; hmScreens: number; onsites: number; offers: number; hires: number }>();

  // Use fixed personas
  const recruiters = RECRUITER_PERSONAS;
  const hms = HM_PERSONAS;

  // Initialize funnel stats for each recruiter
  for (const r of recruiters) {
    funnelStats.set(r.id, { screens: 0, hmScreens: 0, onsites: 0, offers: 0, hires: 0 });
  }

  // Generate users from personas
  for (const r of recruiters) {
    users.push({
      user_id: r.id,
      name: r.name,
      email: `${r.name.toLowerCase().replace(' ', '.')}@company.internal`,
      role: UserRole.Recruiter,
      team: 'Talent Acquisition',
      manager_user_id: null,
    });
  }

  for (const h of hms) {
    users.push({
      user_id: h.id,
      name: h.name,
      email: `${h.name.toLowerCase().replace(' ', '.')}@company.internal`,
      role: UserRole.HiringManager,
      team: seededItem(FUNCTIONS, random),
      manager_user_id: null,
    });
  }

  // Generate intentional requisitions
  const reqConfigs = generateIntentionalReqs(sessionId, now, recruiters, hms, random);

  let candidateIndex = 1;
  let eventIndex = 1;

  for (const reqConfig of reqConfigs) {
    const recruiter = recruiters.find(r => r.id === reqConfig.recruiterId)!;
    const hm = config.includeRecruiterHM ? hms.find(h => h.id === reqConfig.hmId)! : null;

    requisitions.push({
      req_id: reqConfig.reqId,
      req_title: reqConfig.title,
      function: reqConfig.func,
      job_family: reqConfig.jobFamily,
      level: reqConfig.level,
      location_type: seededItem(LOCATION_TYPES, random),
      location_region: seededItem(REGIONS, random),
      location_city: null,
      comp_band_min: null,
      comp_band_max: null,
      status: reqConfig.status,
      opened_at: reqConfig.openedAt,
      closed_at: reqConfig.closedAt,
      recruiter_id: config.includeRecruiterHM ? recruiter.id : '',
      hiring_manager_id: config.includeRecruiterHM && hm ? hm.id : '',
      business_unit: null,
      headcount_type: seededItem(HEADCOUNT_TYPES, random),
      priority: reqConfig.priority,
      candidate_slate_required: false,
      search_firm_used: false,
    });

    // Determine candidate count based on req patterns
    let candCount: number;
    if (reqConfig.hasThinPipeline) {
      candCount = 2; // Intentionally thin
    } else if (reqConfig.isZombie) {
      candCount = seededInt(1, 3, random); // Few candidates, all old
    } else if (reqConfig.isStalled) {
      candCount = seededInt(3, 6, random);
    } else {
      candCount = seededInt(8, 15, random);
    }

    // Generate candidates
    for (let j = 0; j < candCount; j++) {
      const candId = `cand_${sessionId}_${String(candidateIndex++).padStart(5, '0')}`;
      const candInfo = generateCandidateName(candidateIndex, random, config.includePII);

      // Determine applied date based on req patterns
      let appliedAt: Date;
      if (reqConfig.isZombie) {
        // Old candidates for zombie reqs
        appliedAt = seededDate(reqConfig.openedAt, subDays(now, 35), random);
      } else if (reqConfig.isStalled) {
        // Mix of old and recent for stalled reqs
        appliedAt = seededDate(reqConfig.openedAt, subDays(now, 14), random);
      } else {
        appliedAt = seededDate(reqConfig.openedAt, subDays(now, 5), random);
      }

      // Simulate journey
      // Boost hire rate for most candidates to ensure >= 10% end up hired for TTF chart
      // First 50% of candidates per req get boosted hire rate
      const boostHireRate = j < candCount * 0.5;
      const journey = simulateCandidateJourney(
        candId,
        reqConfig.reqId,
        appliedAt,
        now,
        recruiter,
        hm,
        random,
        config.includeOffers,
        boostHireRate
      );

      // Update funnel stats
      const stats = funnelStats.get(recruiter.id)!;
      for (const stage of journey.stages) {
        if (stage.stage === CanonicalStage.SCREEN) stats.screens++;
        if (stage.stage === CanonicalStage.HM_SCREEN) stats.hmScreens++;
        if (stage.stage === CanonicalStage.ONSITE) stats.onsites++;
        if (stage.stage === CanonicalStage.OFFER) stats.offers++;
        if (stage.stage === CanonicalStage.HIRED) stats.hires++;
      }

      // Determine current_stage: for terminated candidates, reflect terminal state
      let currentStage = journey.finalStage;
      if (journey.disposition === CandidateDisposition.Rejected &&
          (journey.finalStage === CanonicalStage.ONSITE || journey.finalStage === CanonicalStage.OFFER)) {
        currentStage = CanonicalStage.REJECTED;
      } else if (journey.disposition === CandidateDisposition.Withdrawn &&
                 journey.finalStage === CanonicalStage.OFFER) {
        currentStage = CanonicalStage.WITHDREW;
      }

      // Create candidate record
      const candidate: DemoCandidate = {
        candidate_id: candId,
        name: candInfo.name,
        req_id: reqConfig.reqId,
        source: seededItem(SOURCES, random),
        applied_at: appliedAt,
        first_contacted_at: journey.stages.length > 2 ? journey.stages[2]?.enteredAt : null,
        current_stage: currentStage,
        current_stage_entered_at: journey.stages[journey.stages.length - 1]?.enteredAt || appliedAt,
        disposition: journey.disposition,
        hired_at: journey.hiredAt,
        offer_extended_at: journey.offerExtendedAt,
        offer_accepted_at: journey.offerAcceptedAt,
        email: candInfo.email,
        phone: candInfo.phone,
      };

      candidates.push(candidate);

      // Generate events from journey stages (skip the initial LEAD stage as it's just a marker)
      for (let k = 1; k < journey.stages.length; k++) {
        const stage = journey.stages[k];

        events.push({
          event_id: `evt_${sessionId}_${String(eventIndex++).padStart(6, '0')}`,
          candidate_id: candId,
          req_id: reqConfig.reqId,
          event_type: EventType.STAGE_CHANGE,
          from_stage: stage.fromStage,  // Use explicit fromStage from journey
          to_stage: stage.stage,
          event_at: stage.enteredAt,
          actor_user_id: stage.actorId,
          metadata_json: null,
        });

        // Emit OFFER_EXTENDED when candidate reaches OFFER stage (denominator for fallout rates)
        if (stage.stage === CanonicalStage.OFFER) {
          events.push({
            event_id: `evt_${sessionId}_${String(eventIndex++).padStart(6, '0')}`,
            candidate_id: candId,
            req_id: reqConfig.reqId,
            event_type: EventType.OFFER_EXTENDED,
            from_stage: stage.fromStage,
            to_stage: CanonicalStage.OFFER,
            event_at: stage.enteredAt,
            actor_user_id: stage.actorId,
            metadata_json: null,
          });
        }
      }

      // Generate terminal events for late-stage failures (populates Quality Guardrails metrics)
      if (journey.disposition === CandidateDisposition.Rejected || journey.disposition === CandidateDisposition.Withdrawn) {
        const terminalDate = journey.rejectedAt || journey.withdrawnAt || addDays(journey.stages[journey.stages.length - 1].enteredAt, 2);
        const lastStage = journey.finalStage;

        if (lastStage === CanonicalStage.OFFER) {
          // Offer → Decline or Offer → Withdraw
          events.push({
            event_id: `evt_${sessionId}_${String(eventIndex++).padStart(6, '0')}`,
            candidate_id: candId,
            req_id: reqConfig.reqId,
            event_type: journey.disposition === CandidateDisposition.Rejected ? EventType.OFFER_DECLINED : EventType.CANDIDATE_WITHDREW,
            from_stage: CanonicalStage.OFFER,
            to_stage: journey.disposition === CandidateDisposition.Rejected ? CanonicalStage.REJECTED : CanonicalStage.WITHDREW,
            event_at: terminalDate,
            actor_user_id: journey.stages[journey.stages.length - 1].actorId,
            metadata_json: null,
          });
        } else if (lastStage === CanonicalStage.ONSITE && journey.disposition === CandidateDisposition.Rejected) {
          // Onsite → Reject
          events.push({
            event_id: `evt_${sessionId}_${String(eventIndex++).padStart(6, '0')}`,
            candidate_id: candId,
            req_id: reqConfig.reqId,
            event_type: EventType.STAGE_CHANGE,
            from_stage: CanonicalStage.ONSITE,
            to_stage: CanonicalStage.REJECTED,
            event_at: terminalDate,
            actor_user_id: journey.stages[journey.stages.length - 1].actorId,
            metadata_json: null,
          });
        }
      }
    }
  }

  return { requisitions, candidates, events, users, funnelStats };
}

// ============================================
// SNAPSHOTS PACK
// ============================================

function generateSnapshots(
  candidates: Candidate[],
  events: Event[],
  random: () => number,
  sessionId: string,
  now: Date
): { snapshots: DataSnapshot[]; snapshotEvents: SnapshotEvent[] } {
  const snapshots: DataSnapshot[] = [];
  const snapshotEvents: SnapshotEvent[] = [];
  const snapshotCount = 15;
  const daysBetween = 2;

  for (let i = 0; i < snapshotCount; i++) {
    const capturedAt = subDays(now, (snapshotCount - i - 1) * daysBetween);
    const snapshotId = `snap_${sessionId}_${String(i + 1).padStart(3, '0')}`;

    snapshots.push({
      id: snapshotId,
      organization_id: `org_${sessionId}`,
      snapshot_date: capturedAt,
      snapshot_seq: i + 1,
      source_filename: `demo_snapshot_${i + 1}.csv`,
      source_hash: `hash_${sessionId}_${i}`,
      imported_at: capturedAt,
      imported_by: null,
      req_count: Math.floor(candidates.length / 12),
      candidate_count: candidates.length,
      user_count: 23,
      status: 'completed',
      diff_completed_at: capturedAt,
      events_generated: events.filter(e => e.event_at <= capturedAt).length,
      error_message: null,
    });

    // Generate snapshot events
    if (i > 0) {
      const prevSnapshotId = `snap_${sessionId}_${String(i).padStart(3, '0')}`;
      const prevCapturedAt = subDays(capturedAt, daysBetween);
      const eventCount = seededInt(5, 15, random);

      for (let j = 0; j < eventCount; j++) {
        const eventType: SnapshotEventType = random() < 0.1 ? 'STAGE_REGRESSION' : 'STAGE_CHANGE';
        const cand = seededItem(candidates, random);
        const fromStage = seededItem([CanonicalStage.SCREEN, CanonicalStage.HM_SCREEN], random);
        const toStage = seededItem([CanonicalStage.HM_SCREEN, CanonicalStage.ONSITE], random);
        const eventAt = seededDate(prevCapturedAt, capturedAt, random);

        snapshotEvents.push({
          id: `snapevt_${sessionId}_${i * 100 + j}`,
          organization_id: `org_${sessionId}`,
          event_type: eventType,
          candidate_id: cand.candidate_id,
          req_id: cand.req_id,
          from_value: fromStage,
          to_value: toStage,
          from_canonical: fromStage,
          to_canonical: toStage,
          event_at: eventAt,
          from_snapshot_id: prevSnapshotId,
          to_snapshot_id: snapshotId,
          from_snapshot_date: prevCapturedAt,
          to_snapshot_date: capturedAt,
          confidence: seededItem(['high', 'medium', 'low'] as EventConfidence[], random),
          confidence_reasons: ['Inferred from snapshot diff'],
          metadata: null,
          created_at: eventAt,
        });
      }
    }
  }

  return { snapshots, snapshotEvents };
}

// ============================================
// CALIBRATION HISTORY PACK
// ============================================

function generateCalibrationHistory(
  requisitions: Requisition[],
  candidates: Candidate[],
  random: () => number
): CalibrationRecord[] {
  const history: CalibrationRecord[] = [];
  const hiredCandidates = candidates.filter(c => c.disposition === 'Hired' && c.hired_at);

  for (let i = 0; i < Math.min(25, hiredCandidates.length); i++) {
    const cand = hiredCandidates[i];
    const req = requisitions.find(r => r.req_id === cand.req_id);
    if (!req || !cand.hired_at || !req.opened_at) continue;

    const actualDays = Math.floor((cand.hired_at.getTime() - req.opened_at.getTime()) / (1000 * 60 * 60 * 24));
    const bias = seededInt(-10, 10, random);
    const predictedDays = Math.max(10, actualDays + bias);

    history.push({
      reqId: cand.req_id,
      predictedFillDate: addDays(req.opened_at, predictedDays),
      actualFillDate: cand.hired_at,
      deviationDays: bias,
      roleProfile: {
        function: req.function,
        level: req.level,
        locationType: req.location_type,
      },
    });
  }

  return history;
}

// ============================================
// AI STUBS PACK
// ============================================

function generateAIStubs(): AIStub[] {
  return [
    {
      intent: 'whats_on_fire',
      response: `## What's On Fire Right Now

Based on your current data, here are the top risks requiring immediate attention:

1. **5 stalled requisitions** have no candidate activity in 14+ days
2. **2 HM bottlenecks** - Amanda Foster (8d avg) and Robert Wilson (5d avg) are blocking candidates
3. **1 offer at risk** - candidate has been in offer stage for 10+ days

The biggest bottleneck is HM Screen stage with Amanda Foster's candidates averaging 8.2 days waiting for feedback.`,
      citations: ['control_tower.risk_summary', 'control_tower.kpis.stalled_reqs'],
      confidence: 'high',
    },
    {
      intent: 'top_actions',
      response: `## Priority Actions for Today

Here are your top 5 actions ranked by urgency:

1. **Follow up with Amanda Foster** - 3 candidates waiting 8+ days for HM feedback
2. **Follow up with Robert Wilson** - 2 candidates waiting 5+ days for HM feedback
3. **Close offer** for candidate in offer stage 10+ days
4. **Source candidates** for IC4 Security Engineer - only 2 in pipeline
5. **Review stalled reqs** - 3 reqs with no activity 14+ days

Focus on HM follow-ups first as they're blocking pipeline flow.`,
      citations: ['actions.top_p0', 'actions.top_p1', 'control_tower.action_summary'],
      confidence: 'high',
    },
    {
      intent: 'forecast_gap',
      response: `## Hiring Forecast vs Goal

**Expected hires this quarter:** 12 (probability-weighted)
**Open requisitions:** 18
**Gap to goal:** 6 hires at risk

Your pipeline health is at 67% - meaning 1 in 3 open reqs may not fill on time.

To close the gap:
- Source 15 more candidates at Screen stage
- Reduce HM feedback time from 4 days to 2 days
- Convert 2 more offers to accepts`,
      citations: ['forecast.expected_hires', 'forecast.pipeline_gap', 'forecast.confidence'],
      confidence: 'medium',
    },
    {
      intent: 'hm_latency',
      response: `## Hiring Manager Responsiveness

**Average HM feedback time:** 3.2 days
**Target SLA:** 2 days
**HMs over SLA:** 4 out of 15

Top bottlenecks:
1. **Amanda Foster** - 8.0 days avg (major blocker)
2. **Robert Wilson** - 5.2 days avg
3. **Patricia Brown** - 4.0 days avg (indecisive)

Consider escalating Amanda and Robert to their managers - they're blocking 7 candidates total.`,
      citations: ['explain.hm_latency', 'hiring_manager_ownership'],
      confidence: 'high',
    },
    {
      intent: 'velocity_summary',
      response: `## Pipeline Velocity Summary

**Average days to hire:** 38 days
**Median days to hire:** 35 days
**Fastest stage:** Applied → Screen (2 days)
**Slowest stage:** HM Screen → Onsite (5 days)

Your funnel is healthy at the top but bottlenecks at HM Screen.
Candidates spending 5+ days in HM Screen have 40% higher dropout rate.`,
      citations: ['velocity.funnel', 'velocity.bottleneck_stage', 'velocity.avg_days_to_hire'],
      confidence: 'high',
    },
    {
      intent: 'source_effectiveness',
      response: `## Source Effectiveness Analysis

**Best source by conversion:** Referrals (35% to hire)
**Best source by volume:** Inbound (45% of pipeline)
**Worst performing:** Agency (8% to hire, highest cost)

Recommendations:
- Double down on referral program
- Reduce agency spend by 30%
- Sourced candidates show 2x speed to Screen vs Inbound`,
      citations: ['sources.top_by_conversion', 'sources.top_by_volume'],
      confidence: 'high',
    },
    {
      intent: 'capacity_summary',
      response: `## Recruiter Capacity Overview

**Total recruiters:** 8
**Average req load:** 6.25 reqs per recruiter
**Overloaded (8+ reqs):** 1 recruiter

Workload distribution:
- **Marcus Rodriguez: 12 reqs** (overloaded - capacity 5)
- James Park: 6 reqs (healthy)
- Others: 4-7 reqs (healthy)

Marcus needs immediate rebalancing - reassign 7 reqs to lighter-loaded recruiters.`,
      citations: ['capacity.total_recruiters', 'capacity.avg_req_load', 'capacity.overloaded_count'],
      confidence: 'high',
    },
    {
      intent: 'stalled_reqs',
      response: `## Stalled Requisitions Analysis

**Total stalled (14+ days no activity):** 3 reqs
**Zombie reqs (30+ days):** 2 reqs

Stalled requisitions:
1. IC3 Backend Engineer - 21 days, candidates stuck in HM Screen
2. IC2 Frontend - 18 days, pipeline dried up
3. IC4 Data Engineer - 16 days, HM unresponsive

Zombie requisitions:
1. IC2 DevOps - 35 days, should consider closing
2. M1 Product - 42 days, no viable candidates

Root cause: 2 of 3 stalled have HM responsiveness issues (Robert Wilson).`,
      citations: ['risks.by_failure_mode', 'control_tower.kpis.stalled_reqs'],
      confidence: 'high',
    },
    {
      intent: 'exec_brief',
      response: `## Executive Brief

**Pipeline Health Score:** 72/100 (Good)

### Key Metrics This Period
- **Time-to-Fill:** 38 days (target: 45) ✅
- **Offer Accept Rate:** 85% (target: 80%) ✅
- **Pipeline Velocity:** 3.4 candidates/week
- **HM Latency:** 3.2 days (target: 2) ⚠️

### Top Risks
1. 3 stalled + 2 zombie requisitions need intervention
2. HM responsiveness causing pipeline delays (Amanda, Robert)
3. Marcus Rodriguez overloaded with 12 reqs

### Recommended Actions
1. Escalate HM latency to department heads
2. Rebalance 7 reqs from Marcus to lighter recruiters
3. Source candidates for IC4 Security (thin pipeline)`,
      citations: ['control_tower.kpis', 'control_tower.risk_summary', 'explain.hm_latency'],
      confidence: 'high',
    },
    {
      intent: 'worst_recruiter',
      response: `## Lowest Performing Recruiter Analysis

Based on productivity metrics, here's your recruiter needing the most support:

**David Kim** - Performance concerns
- Screens completed: 4 (team avg: 8)
- Time in pipeline: 48 days (team avg: 38)
- Accept rate: 70% (team avg: 82%)

Context:
1. New hire (3 months tenure) - still ramping
2. Assigned 2 difficult IC4+ roles
3. Working with slow HMs (Robert Wilson, Patricia Brown)

Recommendation: Pair with Lisa Thompson (senior) for mentoring, reassign 1 IC4 role.`,
      citations: ['recruiter_performance.bottom_by_productivity', 'capacity.overloaded_count'],
      confidence: 'medium',
    },
  ];
}

// ============================================
// CAPABILITY PREVIEW
// ============================================

function computeCapabilityPreview(bundle: Partial<UltimateDemoBundle>, config: DemoPackConfig): CapabilityPreview {
  const coverage: CoverageMetrics = {
    importId: bundle.seed || 'demo',
    computedAt: new Date(),
    counts: {
      requisitions: bundle.requisitions?.length || 0,
      candidates: bundle.candidates?.length || 0,
      events: bundle.events?.length || 0,
      users: bundle.users?.length || 0,
      snapshots: bundle.snapshots?.length || 0,
    },
    fieldCoverage: {
      'req.recruiter_id': config.recruiter_hm ? 1 : 0,
      'req.hiring_manager_id': config.recruiter_hm ? 1 : 0,
      'req.opened_at': 1,
      'req.closed_at': computeFieldCoverage(bundle.requisitions as unknown as Array<{ [key: string]: unknown }> || [], 'closed_at'),
      'req.status': 1,
      'cand.applied_at': computeFieldCoverage(bundle.candidates as unknown as Array<{ [key: string]: unknown }> || [], 'applied_at'),
      'cand.current_stage': computeFieldCoverage(bundle.candidates as unknown as Array<{ [key: string]: unknown }> || [], 'current_stage'),
      'cand.hired_at': computeFieldCoverage(bundle.candidates as unknown as Array<{ [key: string]: unknown }> || [], 'hired_at'),
      'cand.rejected_at': 0.3,
      'cand.source': computeFieldCoverage(bundle.candidates as unknown as Array<{ [key: string]: unknown }> || [], 'source'),
      'cand.name': computeFieldCoverage(bundle.candidates as unknown as Array<{ [key: string]: unknown }> || [], 'name'),
      'event.from_stage': computeFieldCoverage(bundle.events as unknown as Array<{ [key: string]: unknown }> || [], 'from_stage'),
      'event.to_stage': computeFieldCoverage(bundle.events as unknown as Array<{ [key: string]: unknown }> || [], 'to_stage'),
      'event.actor_user_id': config.recruiter_hm ? 1 : 0,
      'event.event_at': 1,
    },
    flags: {
      hasHMAssignment: config.recruiter_hm,
      hasRecruiterAssignment: config.recruiter_hm,
      hasStageEvents: (bundle.events?.length || 0) > 0,
      hasSourceData: true,
      hasTimestamps: true,
      hasTerminalTimestamps: config.offers_outcomes,
      hasMultipleSnapshots: config.snapshots_diffs,
      hasCapacityHistory: config.capacity_history,
    },
    sampleSizes: {
      hires: bundle.candidates?.filter(c => c.disposition === 'Hired').length || 0,
      offers: bundle.candidates?.filter(c => c.offer_extended_at).length || 0,
      rejections: bundle.candidates?.filter(c => c.disposition === 'Rejected').length || 0,
      activeReqs: bundle.requisitions?.filter(r => r.status === RequisitionStatus.Open).length || 0,
    },
  };

  const capabilities = getAllCapabilityStatuses(coverage);
  const enabled = capabilities.filter(c => c.enabled).map(c => c.displayName);
  const disabled = capabilities.filter(c => !c.enabled).map(c => c.displayName);
  const disabledReasons: Record<string, string> = {};

  for (const cap of capabilities) {
    if (!cap.enabled && cap.disabledReason) {
      disabledReasons[cap.displayName] = cap.disabledReason;
    }
  }

  return { enabled, disabled, disabledReasons };
}

function computeFieldCoverage(items: Array<{ [key: string]: unknown }>, field: string): number {
  if (items.length === 0) return 0;
  const withField = items.filter(item => item[field] != null && item[field] !== '');
  return withField.length / items.length;
}

// ============================================
// MAIN GENERATOR
// ============================================

/**
 * Generate Ultimate Demo data bundle
 *
 * @param seed - Deterministic seed (default: 'ultimate-demo-v1')
 * @param packsEnabled - Which packs to include (partial, will be resolved with dependencies)
 * @returns Complete data bundle ready for import
 */
export function generateUltimateDemo(
  seed: string = 'ultimate-demo-v1',
  packsEnabled: Partial<DemoPackConfig> = {}
): UltimateDemoBundle {
  const config = resolvePackDependencies(packsEnabled);
  const random = createSeededRandom(seed);
  const sessionId = seed.replace(/[^a-z0-9]/gi, '').substring(0, 8) || 'demo';
  const now = new Date();

  let requisitions: Requisition[] = [];
  let candidates: Candidate[] = [];
  let events: Event[] = [];
  let users: User[] = [];
  let snapshots: DataSnapshot[] | undefined;
  let snapshotEvents: SnapshotEvent[] | undefined;
  let calibrationHistory: CalibrationRecord[] | undefined;
  let aiStubs: AIStub[] | undefined;

  // Generate core ATS data
  if (config.core_ats) {
    const core = generateCoreATS(random, sessionId, now, {
      includeRecruiterHM: config.recruiter_hm,
      includePII: config.synthetic_pii,
      includeOffers: config.offers_outcomes,
    });

    requisitions = core.requisitions;
    candidates = core.candidates;
    events = core.events;
    users = core.users;
  }

  // Generate snapshots
  if (config.snapshots_diffs && config.core_ats) {
    const snapshotData = generateSnapshots(candidates, events, random, sessionId, now);
    snapshots = snapshotData.snapshots;
    snapshotEvents = snapshotData.snapshotEvents;
  }

  // Generate calibration history
  if (config.calibration_history && config.offers_outcomes) {
    calibrationHistory = generateCalibrationHistory(requisitions, candidates, random);
  }

  // Generate AI stubs
  if (config.ai_stubs) {
    aiStubs = generateAIStubs();
  }

  const bundle: UltimateDemoBundle = {
    requisitions,
    candidates,
    events,
    users,
    snapshots,
    snapshotEvents,
    calibrationHistory,
    aiStubs,
    seed,
    packsEnabled: config,
    generatedAt: now,
    capabilityPreview: { enabled: [], disabled: [], disabledReasons: {} },
  };

  // Compute capability preview
  bundle.capabilityPreview = computeCapabilityPreview(bundle, config);

  return bundle;
}

/**
 * Get demo coverage metrics for capability gating
 */
export function computeDemoCoverage(bundle: UltimateDemoBundle): CoverageMetrics {
  return {
    importId: bundle.seed,
    computedAt: bundle.generatedAt,
    counts: {
      requisitions: bundle.requisitions.length,
      candidates: bundle.candidates.length,
      events: bundle.events.length,
      users: bundle.users.length,
      snapshots: bundle.snapshots?.length || 0,
    },
    fieldCoverage: {
      'req.recruiter_id': bundle.packsEnabled.recruiter_hm ? 1 : 0,
      'req.hiring_manager_id': bundle.packsEnabled.recruiter_hm ? 1 : 0,
      'req.opened_at': 1,
      'req.closed_at': computeFieldCoverage(bundle.requisitions as unknown as Array<{ [key: string]: unknown }>, 'closed_at'),
      'req.status': 1,
      'cand.applied_at': computeFieldCoverage(bundle.candidates as unknown as Array<{ [key: string]: unknown }>, 'applied_at'),
      'cand.current_stage': computeFieldCoverage(bundle.candidates as unknown as Array<{ [key: string]: unknown }>, 'current_stage'),
      'cand.hired_at': computeFieldCoverage(bundle.candidates as unknown as Array<{ [key: string]: unknown }>, 'hired_at'),
      'cand.rejected_at': 0.3,
      'cand.source': computeFieldCoverage(bundle.candidates as unknown as Array<{ [key: string]: unknown }>, 'source'),
      'cand.name': computeFieldCoverage(bundle.candidates as unknown as Array<{ [key: string]: unknown }>, 'name'),
      'event.from_stage': computeFieldCoverage(bundle.events as unknown as Array<{ [key: string]: unknown }>, 'from_stage'),
      'event.to_stage': computeFieldCoverage(bundle.events as unknown as Array<{ [key: string]: unknown }>, 'to_stage'),
      'event.actor_user_id': bundle.packsEnabled.recruiter_hm ? 1 : 0,
      'event.event_at': 1,
    },
    flags: {
      hasHMAssignment: bundle.packsEnabled.recruiter_hm,
      hasRecruiterAssignment: bundle.packsEnabled.recruiter_hm,
      hasStageEvents: bundle.events.length > 0,
      hasSourceData: true,
      hasTimestamps: true,
      hasTerminalTimestamps: bundle.packsEnabled.offers_outcomes,
      hasMultipleSnapshots: bundle.packsEnabled.snapshots_diffs,
      hasCapacityHistory: bundle.packsEnabled.capacity_history,
    },
    sampleSizes: {
      hires: bundle.candidates.filter(c => c.disposition === 'Hired').length,
      offers: bundle.candidates.filter(c => c.offer_extended_at).length,
      rejections: bundle.candidates.filter(c => c.disposition === 'Rejected').length,
      activeReqs: bundle.requisitions.filter(r => r.status === RequisitionStatus.Open).length,
    },
  };
}

/**
 * Get the demo story patterns for display
 */
export function getDemoStoryPatterns(): DemoStoryPattern[] {
  return DEMO_STORY_PATTERNS;
}

/**
 * Get recruiter personas for display
 */
export function getRecruiterPersonas(): RecruiterPersona[] {
  return RECRUITER_PERSONAS;
}

/**
 * Get HM personas for display
 */
export function getHMPersonas(): HMPersona[] {
  return HM_PERSONAS;
}
