// Sample Data Generator for Testing
// Generates realistic recruiting funnel data with proper stage progressions

import { subDays, addDays, format, differenceInDays } from 'date-fns';
import { DataSnapshot, SnapshotEvent, SnapshotEventType, EventConfidence } from '../types/snapshotTypes';
import { CanonicalStage, CandidateDisposition } from '../types/entities';

const FUNCTIONS = ['Engineering', 'Product', 'Sales', 'G&A', 'Marketing'];
const JOB_FAMILIES = ['Backend', 'Frontend', 'Fullstack', 'Security', 'Mobile', 'Data', 'DevOps'];
const LEVELS = ['IC1', 'IC2', 'IC3', 'IC4', 'IC5', 'M1', 'M2', 'M3'];
const LOCATION_TYPES = ['Remote', 'Hybrid', 'Onsite'];
const REGIONS = ['AMER', 'EMEA', 'APAC'];
const SOURCES = ['Referral', 'Inbound', 'Sourced', 'Agency', 'Internal'];

// Realistic funnel stages with conversion rates (percentage that advances)
// Using canonical stage names that match the app's expected values
const FUNNEL_STAGES = [
  { stage: 'Applied', nextStage: 'Screen', conversionRate: 0.45 },           // 45% get screened
  { stage: 'Screen', nextStage: 'HM Screen', conversionRate: 0.70 },         // 70% pass recruiter screen
  { stage: 'HM Screen', nextStage: 'Onsite', conversionRate: 0.60 },         // 60% pass HM review
  { stage: 'Onsite', nextStage: 'Offer', conversionRate: 0.40 },             // 40% get offers after onsite
  { stage: 'Offer', nextStage: 'Hired', conversionRate: 0.85 }               // 85% accept offers
];

const FIRST_NAMES = [
  'Emma', 'Liam', 'Olivia', 'Noah', 'Ava', 'James', 'Sophia', 'William',
  'Isabella', 'Benjamin', 'Mia', 'Lucas', 'Charlotte', 'Henry', 'Amelia',
  'Alexander', 'Harper', 'Michael', 'Evelyn', 'Daniel', 'Abigail', 'Matthew',
  'Emily', 'David', 'Elizabeth', 'Joseph', 'Sofia', 'Samuel', 'Avery', 'Sebastian',
  'Priya', 'Raj', 'Wei', 'Yuki', 'Carlos', 'Maria', 'Ahmed', 'Fatima', 'Chen', 'Aisha'
];

const LAST_NAMES = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
  'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson',
  'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson',
  'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson',
  'Patel', 'Kim', 'Chen', 'Nguyen', 'Kumar', 'Singh', 'Wang', 'Yamamoto', 'Ali', 'Shah'
];

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateName(): { first: string; last: string; full: string } {
  const first = randomItem(FIRST_NAMES);
  const last = randomItem(LAST_NAMES);
  return { first, last, full: `${first} ${last}` };
}

function randomDate(start: Date, end: Date): Date {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function formatDate(date: Date): string {
  return format(date, "yyyy-MM-dd'T'HH:mm:ss'Z'");
}

function generateId(prefix: string, index: number, sessionId: string): string {
  return `${prefix}_${sessionId}_${String(index).padStart(4, '0')}`;
}

// Simulate candidate journey through funnel
function simulateCandidateJourney(startDate: Date, now: Date): {
  stages: { stage: string; enteredAt: Date }[];
  finalStage: string;
  disposition: string;
  hiredAt?: Date;
  offerExtendedAt?: Date;
  offerAcceptedAt?: Date;
} {
  const stages: { stage: string; enteredAt: Date }[] = [];
  let currentDate = startDate;
  let finalStage = 'Applied';
  let disposition = 'Active';

  stages.push({ stage: 'Applied', enteredAt: currentDate });

  for (const funnel of FUNNEL_STAGES) {
    if (funnel.stage !== finalStage) continue;

    // Check if candidate advances
    if (Math.random() < funnel.conversionRate) {
      // Advance to next stage after 2-5 days
      currentDate = addDays(currentDate, Math.floor(Math.random() * 4) + 2);
      if (currentDate > now) break; // Don't add future events

      finalStage = funnel.nextStage;
      stages.push({ stage: finalStage, enteredAt: currentDate });
    } else {
      // Candidate rejected or withdrew at this stage
      disposition = Math.random() > 0.2 ? 'Rejected' : 'Withdrawn';
      break;
    }
  }

  if (finalStage === 'Hired') {
    disposition = 'Hired';
  }

  // Find offer and hire dates
  const offerStage = stages.find(s => s.stage === 'Offer');
  const hiredStage = stages.find(s => s.stage === 'Hired');

  return {
    stages,
    finalStage,
    disposition,
    hiredAt: hiredStage?.enteredAt,
    offerExtendedAt: offerStage?.enteredAt,
    offerAcceptedAt: hiredStage ? offerStage?.enteredAt : undefined
  };
}

export function generateSampleData(config: {
  reqCount?: number;
  candidatesPerReq?: number;
  recruiterCount?: number;
  hmCount?: number;
} = {}) {
  const {
    reqCount = 40,
    candidatesPerReq = 12,
    recruiterCount = 6,
    hmCount = 10
  } = config;

  // Generate unique session ID for this demo data generation
  // This ensures each org gets unique IDs that won't conflict with other orgs
  const sessionId = Math.random().toString(36).substring(2, 8);

  const now = new Date();
  const startDate = subDays(now, 120); // 4 months of data

  // Generate Users
  const users: string[] = [];
  users.push('user_id,name,role,team,manager_user_id,email');

  const recruiterNames: { id: string; name: string }[] = [];
  const hmNames: { id: string; name: string }[] = [];

  // Generate recruiter names - use name-based IDs for readability even if users table fails to load
  const managerId = `ta_manager_${sessionId}`;
  const execId = `vp_eng_${sessionId}`;

  for (let i = 1; i <= recruiterCount; i++) {
    const name = generateName();
    const emailName = `${name.first.toLowerCase()}.${name.last.toLowerCase()}`;
    // Use name-based ID so it's readable even if users table doesn't load
    const id = `${name.first.toLowerCase()}_${name.last.toLowerCase()}_${sessionId.substring(0, 4)}`;
    recruiterNames.push({ id, name: name.full });
    users.push(`${id},${name.full},Recruiter,TA Team,${managerId},${emailName}@company.com`);
  }

  // Generate hiring manager names
  for (let i = 1; i <= hmCount; i++) {
    const name = generateName();
    const emailName = `${name.first.toLowerCase()}.${name.last.toLowerCase()}`;
    const func = randomItem(FUNCTIONS);
    // Use name-based ID for readability
    const id = `${name.first.toLowerCase()}_${name.last.toLowerCase()}_${sessionId.substring(0, 4)}`;
    hmNames.push({ id, name: name.full });
    users.push(`${id},${name.full},HiringManager,${func},${execId},${emailName}@company.com`);
  }

  // Add TA manager and exec
  const managerName = generateName();
  const execName = generateName();
  users.push(`${managerId},${managerName.full},Admin,TA Team,,${managerName.first.toLowerCase()}.${managerName.last.toLowerCase()}@company.com`);
  users.push(`${execId},${execName.full},HiringManager,Engineering,,${execName.first.toLowerCase()}.${execName.last.toLowerCase()}@company.com`);

  // Generate Requisitions with varied ages
  const requisitions: string[] = [];
  requisitions.push('req_id,req_title,function,job_family,level,location_type,location_region,location_city,comp_band_min,comp_band_max,opened_at,closed_at,status,hiring_manager_id,recruiter_id,business_unit,headcount_type,priority,candidate_slate_required,search_firm_used');

  const reqData: { id: string; openedAt: Date; recruiterId: string; hmId: string }[] = [];

  for (let i = 1; i <= reqCount; i++) {
    // Spread req ages: some old (90+ days), some mid (30-90), some new (<30)
    const ageCategory = Math.random();
    let openedAt: Date;
    if (ageCategory < 0.3) {
      // Old reqs (90-120 days)
      openedAt = randomDate(subDays(now, 120), subDays(now, 90));
    } else if (ageCategory < 0.6) {
      // Mid-age reqs (30-90 days)
      openedAt = randomDate(subDays(now, 90), subDays(now, 30));
    } else {
      // New reqs (0-30 days)
      openedAt = randomDate(subDays(now, 30), subDays(now, 5));
    }

    // Determine status based on age and hires
    const age = differenceInDays(now, openedAt);
    let status = 'Open';
    let closedAt = '';

    // Older reqs more likely to be closed
    if (age > 60 && Math.random() > 0.4) {
      status = 'Closed';
      closedAt = formatDate(randomDate(addDays(openedAt, 30), now));
    } else if (age > 30 && Math.random() > 0.85) {
      status = 'OnHold';
    }

    const func = randomItem(FUNCTIONS);
    const jf = randomItem(JOB_FAMILIES);
    const level = randomItem(LEVELS);
    const locType = randomItem(LOCATION_TYPES);
    const region = randomItem(REGIONS);
    const recruiterId = recruiterNames[(i - 1) % recruiterCount].id;
    const hmId = hmNames[(i - 1) % hmCount].id;

    const reqId = `req_${sessionId}_${i}`;
    reqData.push({ id: reqId, openedAt, recruiterId, hmId });

    requisitions.push(
      `${reqId},${level} ${jf} Engineer,${func},${jf},${level},${locType},${region},,100000,200000,${formatDate(openedAt)},${closedAt},${status},${hmId},${recruiterId},${func},New,P1,false,false`
    );
  }

  // Generate Candidates with realistic funnel progression
  // Include PII (names, emails, phones) to demonstrate the PII detection/anonymization feature
  const candidates: string[] = [];
  candidates.push('candidate_id,candidate_name,candidate_email,candidate_phone,req_id,source,applied_at,first_contacted_at,current_stage,current_stage_entered_at,disposition,hired_at,offer_extended_at,offer_accepted_at');

  const events: string[] = [];
  events.push('event_id,candidate_id,req_id,event_type,from_stage,to_stage,actor_user_id,event_at,metadata_json');

  let candidateIndex = 1;
  let eventIndex = 1;

  // Email domains for realistic PII
  const EMAIL_DOMAINS = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com', 'proton.me'];

  // Generate realistic phone number
  const generatePhone = (): string => {
    const areaCode = Math.floor(Math.random() * 800) + 200;
    const exchange = Math.floor(Math.random() * 900) + 100;
    const subscriber = Math.floor(Math.random() * 9000) + 1000;
    return `(${areaCode}) ${exchange}-${subscriber}`;
  };

  for (const req of reqData) {
    const candCount = Math.floor(Math.random() * (candidatesPerReq - 5)) + 8;

    for (let c = 0; c < candCount; c++) {
      const candId = `cand_${sessionId}_${candidateIndex}`;
      const appliedAt = randomDate(req.openedAt, subDays(now, 3));
      const firstContactAt = addDays(appliedAt, Math.floor(Math.random() * 3) + 1);

      // Generate candidate PII
      const candName = generateName();
      const emailDomain = randomItem(EMAIL_DOMAINS);
      const candEmail = `${candName.first.toLowerCase()}.${candName.last.toLowerCase()}${Math.floor(Math.random() * 100)}@${emailDomain}`;
      // 60% of candidates have phone numbers
      const candPhone = Math.random() < 0.6 ? generatePhone() : '';

      // Simulate the candidate's journey through the funnel
      const journey = simulateCandidateJourney(addDays(appliedAt, 1), now);

      candidates.push(
        `${candId},"${candName.full}",${candEmail},${candPhone},${req.id},${randomItem(SOURCES)},${formatDate(appliedAt)},${formatDate(firstContactAt)},${journey.finalStage},${formatDate(journey.stages[journey.stages.length - 1].enteredAt)},${journey.disposition},${journey.hiredAt ? formatDate(journey.hiredAt) : ''},${journey.offerExtendedAt ? formatDate(journey.offerExtendedAt) : ''},${journey.offerAcceptedAt ? formatDate(journey.offerAcceptedAt) : ''}`
      );

      // Generate events for each stage transition
      for (let s = 0; s < journey.stages.length; s++) {
        const currentStage = journey.stages[s];
        const prevStage = s > 0 ? journey.stages[s - 1] : null;

        // Intentional Stall: 15% chance to stall in HM Screen or Offer for > 15 days
        // This ensures "Risk Flags" and "Stall Reasons" appear in the demo
        let stallDays = 0;
        if ((currentStage.stage === 'HM Screen' || currentStage.stage === 'Offer') && Math.random() < 0.15) {
          stallDays = Math.floor(Math.random() * 10) + 15; // 15-25 days stall
        }

        if (prevStage) {
          // Stage change event
          events.push(
            `evt_${sessionId}_${eventIndex},${candId},${req.id},STAGE_CHANGE,${prevStage.stage},${currentStage.stage},${req.recruiterId},${formatDate(currentStage.enteredAt)},`
          );
          eventIndex++;
        }

        // Additional events based on stage
        if (currentStage.stage === 'Screen') {
          events.push(
            `evt_${sessionId}_${eventIndex},${candId},${req.id},SCREEN_COMPLETED,,,${req.recruiterId},${formatDate(addDays(currentStage.enteredAt, 1))},`
          );
          eventIndex++;
        }

        if (currentStage.stage === 'HM Screen') {
          // If stalled, we don't submit feedback immediately, triggering "Review Stalled" logic
          // Otherwise, we submit feedback to populate "Review Speed"
          if (stallDays === 0) {
            events.push(
              `evt_${sessionId}_${eventIndex},${candId},${req.id},FEEDBACK_SUBMITTED,,,${req.hmId},${formatDate(addDays(currentStage.enteredAt, 2))},`
            );
            eventIndex++;
          }
        }

        if (currentStage.stage === 'Onsite') {
          events.push(
            `evt_${sessionId}_${eventIndex},${candId},${req.id},INTERVIEW_SCHEDULED,,,${req.recruiterId},${formatDate(currentStage.enteredAt)},`
          );
          eventIndex++;

          const interviewDate = addDays(currentStage.enteredAt, 1);
          events.push(
            `evt_${sessionId}_${eventIndex},${candId},${req.id},INTERVIEW_COMPLETED,,,${req.recruiterId},${formatDate(interviewDate)},`
          );
          eventIndex++;

          // ADDED: Feedback Submitted Event
          // 1-5 days after interview to populate "Feedback Speed" metric
          const feedbackDelay = Math.floor(Math.random() * 5) + 1;
          events.push(
            `evt_${sessionId}_${eventIndex},${candId},${req.id},FEEDBACK_SUBMITTED,,,${req.hmId},${formatDate(addDays(interviewDate, feedbackDelay))},`
          );
          eventIndex++;
        }

        if (currentStage.stage === 'Offer') {
          events.push(
            `evt_${sessionId}_${eventIndex},${candId},${req.id},OFFER_EXTENDED,,,${req.recruiterId},${formatDate(currentStage.enteredAt)},`
          );
          eventIndex++;
        }

        if (currentStage.stage === 'Hired') {
          events.push(
            `evt_${sessionId}_${eventIndex},${candId},${req.id},OFFER_ACCEPTED,,,${req.recruiterId},${formatDate(currentStage.enteredAt)},`
          );
          eventIndex++;
        }
      }

      // Handle Exit Events (Rejection / Withdrawal / Offer Decline)
      // This is crucial for "Late Stage Fallout" metrics in Quality Guardrails
      if (journey.disposition !== 'Active' && journey.disposition !== 'Hired') {
        const finalStage = journey.finalStage;
        const lastEventDate = addDays(journey.stages[journey.stages.length - 1].enteredAt, Math.floor(Math.random() * 5) + 2);

        if (journey.disposition === 'Rejected') {
          // Genereate STAGE_CHANGE -> Rejected
          events.push(
            `evt_${sessionId}_${eventIndex},${candId},${req.id},STAGE_CHANGE,${finalStage},Rejected,${req.recruiterId},${formatDate(lastEventDate)},`
          );
          eventIndex++;

          // Special case: Offer -> Rejected (should be Offer Decline usually, but if rejected by comp)
          if (finalStage === 'Offer') {
            // Assuming "Rejected" at Offer stage might mean Offer Declined or Rescinded
            // For demo purposes, let's mix it up to ensure Offer -> Decline populates
            if (Math.random() > 0.5) {
              events.push(
                `evt_${sessionId}_${eventIndex},${candId},${req.id},OFFER_DECLINED,,,${req.recruiterId},${formatDate(lastEventDate)},`
              );
              eventIndex++;
            }
          }
        } else if (journey.disposition === 'Withdrawn') {
          // Generate CANDIDATE_WITHDREW
          events.push(
            `evt_${sessionId}_${eventIndex},${candId},${req.id},CANDIDATE_WITHDREW,,,${req.recruiterId},${formatDate(lastEventDate)},`
          );
          eventIndex++;
        }
      }

      candidateIndex++;
    }
  }

  return {
    requisitions: requisitions.join('\n'),
    candidates: candidates.join('\n'),
    events: events.join('\n'),
    users: users.join('\n')
  };
}

// Download helper
export function downloadSampleData() {
  const generatedData = generateSampleData();

  const files = [
    { name: 'requisitions.csv', content: generatedData.requisitions },
    { name: 'candidates.csv', content: generatedData.candidates },
    { name: 'events.csv', content: generatedData.events },
    { name: 'users.csv', content: generatedData.users }
  ];

  files.forEach(file => {
    const blob = new Blob([file.content], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    a.click();
    URL.revokeObjectURL(url);
  });
}

// ============================================
// SNAPSHOT DATA GENERATION FOR SLA TRACKING
// ============================================

// Map stage names to canonical stages
const STAGE_TO_CANONICAL: Record<string, CanonicalStage> = {
  'Applied': CanonicalStage.APPLIED,
  'Screen': CanonicalStage.SCREEN,
  'HM Screen': CanonicalStage.HM_SCREEN,
  'Onsite': CanonicalStage.ONSITE,
  'Offer': CanonicalStage.OFFER,
  'Hired': CanonicalStage.HIRED,
  'Rejected': CanonicalStage.REJECTED,
  'Withdrawn': CanonicalStage.WITHDREW,
};

// Map disposition to canonical
const DISPOSITION_TO_CANONICAL: Record<string, CandidateDisposition | null> = {
  'Active': null,
  'Hired': CandidateDisposition.Hired,
  'Rejected': CandidateDisposition.Rejected,
  'Withdrawn': CandidateDisposition.Withdrawn,
};

interface ParsedCandidate {
  candidate_id: string;
  req_id: string;
  applied_at: Date;
  current_stage: string;
  current_stage_entered_at: Date;
  disposition: string;
  hired_at?: Date;
}

interface ParsedEvent {
  event_id: string;
  candidate_id: string;
  req_id: string;
  event_type: string;
  from_stage?: string;
  to_stage?: string;
  event_at: Date;
}

/**
 * Generate snapshot data from demo data for SLA tracking
 * Creates 6 snapshots over 30 days with realistic stage transitions
 */
export function generateDemoSnapshots(
  candidates: ParsedCandidate[],
  events: ParsedEvent[],
  organizationId: string,
  sessionId: string
): { snapshots: DataSnapshot[]; snapshotEvents: SnapshotEvent[] } {
  const now = new Date();
  const snapshots: DataSnapshot[] = [];
  const snapshotEvents: SnapshotEvent[] = [];

  // Generate 15 snapshots over 30 days (one every 2 days) to meet SLA coverage requirements
  // Requirements: gap <3 days, coverage >50%
  const snapshotDates: Date[] = [];
  for (let i = 14; i >= 0; i--) {
    snapshotDates.push(subDays(now, i * 2));
  }

  // Build event timeline per candidate
  const eventsByCandidate = new Map<string, ParsedEvent[]>();
  events.forEach(evt => {
    const list = eventsByCandidate.get(evt.candidate_id) || [];
    list.push(evt);
    eventsByCandidate.set(evt.candidate_id, list);
  });

  // Sort events by date for each candidate
  eventsByCandidate.forEach((evts) => {
    evts.sort((a, b) => a.event_at.getTime() - b.event_at.getTime());
  });

  // Track candidate state at each snapshot
  const candidateStateAtSnapshot = new Map<string, Map<string, { stage: string; disposition: string }>>();

  // Initialize with "Applied" state for all candidates before first snapshot
  candidates.forEach(cand => {
    const stateMap = new Map<string, { stage: string; disposition: string }>();
    candidateStateAtSnapshot.set(cand.candidate_id, stateMap);
  });

  // For each snapshot, determine candidate states
  snapshotDates.forEach((snapshotDate, snapshotIdx) => {
    const snapshotId = `snap_${sessionId}_${snapshotIdx + 1}`;

    // Create snapshot record
    const snapshot: DataSnapshot = {
      id: snapshotId,
      organization_id: organizationId,
      snapshot_date: snapshotDate,
      snapshot_seq: snapshotIdx + 1,
      source_filename: 'demo_data.csv',
      source_hash: `hash_${sessionId}_${snapshotIdx}`,
      imported_at: snapshotDate,
      imported_by: 'demo_system',
      req_count: 40,
      candidate_count: candidates.length,
      user_count: 18,
      status: 'completed',
      diff_completed_at: snapshotDate,
      events_generated: 0,
      error_message: null,
    };
    snapshots.push(snapshot);

    // Determine each candidate's state at this snapshot
    candidates.forEach(cand => {
      // Only include candidates who applied before this snapshot
      if (cand.applied_at > snapshotDate) return;

      const candEvents = eventsByCandidate.get(cand.candidate_id) || [];
      let currentStage = 'Applied';
      let currentDisposition = 'Active';

      // Process events up to this snapshot date
      for (const evt of candEvents) {
        if (evt.event_at > snapshotDate) break;

        if (evt.event_type === 'STAGE_CHANGE' && evt.to_stage) {
          currentStage = evt.to_stage;
          if (evt.to_stage === 'Rejected') {
            currentDisposition = 'Rejected';
          } else if (evt.to_stage === 'Hired') {
            currentDisposition = 'Hired';
          }
        } else if (evt.event_type === 'CANDIDATE_WITHDREW') {
          currentDisposition = 'Withdrawn';
        } else if (evt.event_type === 'OFFER_ACCEPTED') {
          currentStage = 'Hired';
          currentDisposition = 'Hired';
        }
      }

      const stateMap = candidateStateAtSnapshot.get(cand.candidate_id)!;
      stateMap.set(snapshotId, { stage: currentStage, disposition: currentDisposition });
    });
  });

  // Generate snapshot events by comparing consecutive snapshots
  let eventIdx = 1;
  for (let i = 1; i < snapshots.length; i++) {
    const prevSnapshot = snapshots[i - 1];
    const currSnapshot = snapshots[i];

    candidates.forEach(cand => {
      const stateMap = candidateStateAtSnapshot.get(cand.candidate_id)!;
      const prevState = stateMap.get(prevSnapshot.id);
      const currState = stateMap.get(currSnapshot.id);

      // Skip if candidate didn't exist in either snapshot
      if (!currState) return;

      // Check for stage change
      if (prevState && prevState.stage !== currState.stage) {
        const fromCanonical = STAGE_TO_CANONICAL[prevState.stage] || null;
        const toCanonical = STAGE_TO_CANONICAL[currState.stage] || null;

        // Determine if this is a regression (going backwards)
        const fromIdx = FUNNEL_STAGES.findIndex(f => f.stage === prevState.stage);
        const toIdx = FUNNEL_STAGES.findIndex(f => f.stage === currState.stage);
        const isRegression = toIdx < fromIdx && toIdx >= 0 && fromIdx >= 0;

        const eventType: SnapshotEventType = isRegression ? 'STAGE_REGRESSION' : 'STAGE_CHANGE';

        // Calculate event time as midpoint between snapshots
        const eventTime = new Date(
          (prevSnapshot.snapshot_date.getTime() + currSnapshot.snapshot_date.getTime()) / 2
        );

        const snapshotEvent: SnapshotEvent = {
          id: `sevt_${sessionId}_${eventIdx}`,
          organization_id: organizationId,
          event_type: eventType,
          candidate_id: cand.candidate_id,
          req_id: cand.req_id,
          from_value: prevState.stage,
          to_value: currState.stage,
          from_canonical: fromCanonical,
          to_canonical: toCanonical,
          event_at: eventTime,
          from_snapshot_id: prevSnapshot.id,
          to_snapshot_id: currSnapshot.id,
          from_snapshot_date: prevSnapshot.snapshot_date,
          to_snapshot_date: currSnapshot.snapshot_date,
          confidence: 'high' as EventConfidence,
          confidence_reasons: ['Demo data - stage transition detected'],
          metadata: null,
          created_at: new Date(),
        };

        snapshotEvents.push(snapshotEvent);
        eventIdx++;
      }

      // Check for candidate appearing (first time in snapshots)
      if (!prevState && currState) {
        const snapshotEvent: SnapshotEvent = {
          id: `sevt_${sessionId}_${eventIdx}`,
          organization_id: organizationId,
          event_type: 'CANDIDATE_APPEARED',
          candidate_id: cand.candidate_id,
          req_id: cand.req_id,
          from_value: null,
          to_value: currState.stage,
          from_canonical: null,
          to_canonical: STAGE_TO_CANONICAL[currState.stage] || null,
          event_at: currSnapshot.snapshot_date,
          from_snapshot_id: prevSnapshot.id,
          to_snapshot_id: currSnapshot.id,
          from_snapshot_date: prevSnapshot.snapshot_date,
          to_snapshot_date: currSnapshot.snapshot_date,
          confidence: 'high' as EventConfidence,
          confidence_reasons: ['Demo data - new candidate detected'],
          metadata: null,
          created_at: new Date(),
        };

        snapshotEvents.push(snapshotEvent);
        eventIdx++;
      }
    });

    // Update events_generated count
    currSnapshot.events_generated = snapshotEvents.filter(
      e => e.to_snapshot_id === currSnapshot.id
    ).length;
  }

  return { snapshots, snapshotEvents };
}

/**
 * Parse CSV strings back into objects for snapshot generation
 */
export function parseDemoDataForSnapshots(
  candidatesCsv: string,
  eventsCsv: string
): { candidates: ParsedCandidate[]; events: ParsedEvent[] } {
  const parseDate = (str: string): Date => {
    if (!str) return new Date();
    return new Date(str);
  };

  // Parse candidates
  const candidateLines = candidatesCsv.split('\n');
  const candidateHeader = candidateLines[0].split(',');
  const candidates: ParsedCandidate[] = [];

  for (let i = 1; i < candidateLines.length; i++) {
    const line = candidateLines[i];
    if (!line.trim()) continue;

    // Handle quoted fields (names with commas)
    const values: string[] = [];
    let current = '';
    let inQuotes = false;
    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current);

    const row: Record<string, string> = {};
    candidateHeader.forEach((key, idx) => {
      row[key.trim()] = values[idx]?.trim() || '';
    });

    candidates.push({
      candidate_id: row['candidate_id'],
      req_id: row['req_id'],
      applied_at: parseDate(row['applied_at']),
      current_stage: row['current_stage'],
      current_stage_entered_at: parseDate(row['current_stage_entered_at']),
      disposition: row['disposition'] || 'Active',
      hired_at: row['hired_at'] ? parseDate(row['hired_at']) : undefined,
    });
  }

  // Parse events
  const eventLines = eventsCsv.split('\n');
  const eventHeader = eventLines[0].split(',');
  const events: ParsedEvent[] = [];

  for (let i = 1; i < eventLines.length; i++) {
    const line = eventLines[i];
    if (!line.trim()) continue;

    const values = line.split(',');
    const row: Record<string, string> = {};
    eventHeader.forEach((key, idx) => {
      row[key.trim()] = values[idx]?.trim() || '';
    });

    events.push({
      event_id: row['event_id'],
      candidate_id: row['candidate_id'],
      req_id: row['req_id'],
      event_type: row['event_type'],
      from_stage: row['from_stage'] || undefined,
      to_stage: row['to_stage'] || undefined,
      event_at: parseDate(row['event_at']),
    });
  }

  return { candidates, events };
}

/**
 * Generate snapshots from already-loaded data (Candidate[] and Event[] from entities)
 * Use this when reloading demo data from Supabase where we don't have the original CSV
 */
export function generateSnapshotsFromLoadedData(
  candidates: import('../types/entities').Candidate[],
  events: import('../types/entities').Event[],
  organizationId: string
): { snapshots: DataSnapshot[]; snapshotEvents: SnapshotEvent[] } {
  // Convert loaded Candidate[] to ParsedCandidate[]
  const parsedCandidates: ParsedCandidate[] = candidates.map(c => ({
    candidate_id: c.candidate_id,
    req_id: c.req_id,
    applied_at: c.applied_at ? new Date(c.applied_at) : new Date(),
    current_stage: c.current_stage || 'Applied',
    current_stage_entered_at: c.current_stage_entered_at ? new Date(c.current_stage_entered_at) : new Date(),
    disposition: c.disposition || 'Active',
    hired_at: c.hired_at ? new Date(c.hired_at) : undefined,
  }));

  // Convert loaded Event[] to ParsedEvent[]
  const parsedEvents: ParsedEvent[] = events.map(e => ({
    event_id: e.event_id,
    candidate_id: e.candidate_id,
    req_id: e.req_id,
    event_type: e.event_type,
    from_stage: e.from_stage || undefined,
    to_stage: e.to_stage || undefined,
    event_at: e.event_at ? new Date(e.event_at) : new Date(),
  }));

  const sessionId = `reload_${Date.now().toString(36)}`;
  return generateDemoSnapshots(parsedCandidates, parsedEvents, organizationId, sessionId);
}
