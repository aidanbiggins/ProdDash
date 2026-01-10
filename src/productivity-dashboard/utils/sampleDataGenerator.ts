// Sample Data Generator for Testing
// Generates realistic recruiting funnel data with proper stage progressions

import { subDays, addDays, format, differenceInDays } from 'date-fns';

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

function generateId(prefix: string, index: number): string {
  return `${prefix}_${String(index).padStart(4, '0')}`;
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

  const now = new Date();
  const startDate = subDays(now, 120); // 4 months of data

  // Generate Users
  const users: string[] = [];
  users.push('user_id,name,role,team,manager_user_id,email');

  const recruiterNames: { id: string; name: string }[] = [];
  const hmNames: { id: string; name: string }[] = [];

  // Generate recruiter names
  for (let i = 1; i <= recruiterCount; i++) {
    const name = generateName();
    const emailName = `${name.first.toLowerCase()}.${name.last.toLowerCase()}`;
    const id = `recruiter_${i}`;
    recruiterNames.push({ id, name: name.full });
    users.push(`${id},${name.full},Recruiter,TA Team,manager_1,${emailName}@company.com`);
  }

  // Generate hiring manager names
  for (let i = 1; i <= hmCount; i++) {
    const name = generateName();
    const emailName = `${name.first.toLowerCase()}.${name.last.toLowerCase()}`;
    const func = randomItem(FUNCTIONS);
    const id = `hm_${i}`;
    hmNames.push({ id, name: name.full });
    users.push(`${id},${name.full},HiringManager,${func},exec_1,${emailName}@company.com`);
  }

  // Add TA manager and exec
  const managerName = generateName();
  const execName = generateName();
  users.push(`manager_1,${managerName.full},Admin,TA Team,,${managerName.first.toLowerCase()}.${managerName.last.toLowerCase()}@company.com`);
  users.push(`exec_1,${execName.full},HiringManager,Engineering,,${execName.first.toLowerCase()}.${execName.last.toLowerCase()}@company.com`);

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

    reqData.push({ id: `req_${i}`, openedAt, recruiterId, hmId });

    requisitions.push(
      `req_${i},${level} ${jf} Engineer,${func},${jf},${level},${locType},${region},,100000,200000,${formatDate(openedAt)},${closedAt},${status},${hmId},${recruiterId},${func},New,P1,false,false`
    );
  }

  // Generate Candidates with realistic funnel progression
  const candidates: string[] = [];
  candidates.push('candidate_id,req_id,source,applied_at,first_contacted_at,current_stage,current_stage_entered_at,disposition,hired_at,offer_extended_at,offer_accepted_at');

  const events: string[] = [];
  events.push('event_id,candidate_id,req_id,event_type,from_stage,to_stage,actor_user_id,event_at,metadata_json');

  let candidateIndex = 1;
  let eventIndex = 1;

  for (const req of reqData) {
    const candCount = Math.floor(Math.random() * (candidatesPerReq - 5)) + 8;

    for (let c = 0; c < candCount; c++) {
      const candId = `cand_${candidateIndex}`;
      const appliedAt = randomDate(req.openedAt, subDays(now, 3));
      const firstContactAt = addDays(appliedAt, Math.floor(Math.random() * 3) + 1);

      // Simulate the candidate's journey through the funnel
      const journey = simulateCandidateJourney(addDays(appliedAt, 1), now);

      candidates.push(
        `${candId},${req.id},${randomItem(SOURCES)},${formatDate(appliedAt)},${formatDate(firstContactAt)},${journey.finalStage},${formatDate(journey.stages[journey.stages.length - 1].enteredAt)},${journey.disposition},${journey.hiredAt ? formatDate(journey.hiredAt) : ''},${journey.offerExtendedAt ? formatDate(journey.offerExtendedAt) : ''},${journey.offerAcceptedAt ? formatDate(journey.offerAcceptedAt) : ''}`
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
            `evt_${eventIndex},${candId},${req.id},STAGE_CHANGE,${prevStage.stage},${currentStage.stage},${req.recruiterId},${formatDate(currentStage.enteredAt)},`
          );
          eventIndex++;
        }

        // Additional events based on stage
        if (currentStage.stage === 'Screen') {
          events.push(
            `evt_${eventIndex},${candId},${req.id},SCREEN_COMPLETED,,,${req.recruiterId},${formatDate(addDays(currentStage.enteredAt, 1))},`
          );
          eventIndex++;
        }

        if (currentStage.stage === 'HM Screen') {
          // If stalled, we don't submit feedback immediately, triggering "Review Stalled" logic
          // Otherwise, we submit feedback to populate "Review Speed"
          if (stallDays === 0) {
            events.push(
              `evt_${eventIndex},${candId},${req.id},FEEDBACK_SUBMITTED,,,${req.hmId},${formatDate(addDays(currentStage.enteredAt, 2))},`
            );
            eventIndex++;
          }
        }

        if (currentStage.stage === 'Onsite') {
          events.push(
            `evt_${eventIndex},${candId},${req.id},INTERVIEW_SCHEDULED,,,${req.recruiterId},${formatDate(currentStage.enteredAt)},`
          );
          eventIndex++;

          const interviewDate = addDays(currentStage.enteredAt, 1);
          events.push(
            `evt_${eventIndex},${candId},${req.id},INTERVIEW_COMPLETED,,,${req.recruiterId},${formatDate(interviewDate)},`
          );
          eventIndex++;

          // ADDED: Feedback Submitted Event
          // 1-5 days after interview to populate "Feedback Speed" metric
          const feedbackDelay = Math.floor(Math.random() * 5) + 1;
          events.push(
            `evt_${eventIndex},${candId},${req.id},FEEDBACK_SUBMITTED,,,${req.hmId},${formatDate(addDays(interviewDate, feedbackDelay))},`
          );
          eventIndex++;
        }

        if (currentStage.stage === 'Offer') {
          events.push(
            `evt_${eventIndex},${candId},${req.id},OFFER_EXTENDED,,,${req.recruiterId},${formatDate(currentStage.enteredAt)},`
          );
          eventIndex++;
        }

        if (currentStage.stage === 'Hired') {
          events.push(
            `evt_${eventIndex},${candId},${req.id},OFFER_ACCEPTED,,,${req.recruiterId},${formatDate(currentStage.enteredAt)},`
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
            `evt_${eventIndex},${candId},${req.id},STAGE_CHANGE,${finalStage},Rejected,${req.recruiterId},${formatDate(lastEventDate)},`
          );
          eventIndex++;

          // Special case: Offer -> Rejected (should be Offer Decline usually, but if rejected by comp)
          if (finalStage === 'Offer') {
            // Assuming "Rejected" at Offer stage might mean Offer Declined or Rescinded
            // For demo purposes, let's mix it up to ensure Offer -> Decline populates
            if (Math.random() > 0.5) {
              events.push(
                `evt_${eventIndex},${candId},${req.id},OFFER_DECLINED,,,${req.recruiterId},${formatDate(lastEventDate)},`
              );
              eventIndex++;
            }
          }
        } else if (journey.disposition === 'Withdrawn') {
          // Generate CANDIDATE_WITHDREW
          events.push(
            `evt_${eventIndex},${candId},${req.id},CANDIDATE_WITHDREW,,,${req.recruiterId},${formatDate(lastEventDate)},`
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
