// Sample Data Generator for Testing

import { subDays, addDays, format } from 'date-fns';

const FUNCTIONS = ['Engineering', 'Product', 'Sales', 'G&A', 'Marketing'];
const JOB_FAMILIES = ['Backend', 'Frontend', 'Fullstack', 'Security', 'Mobile', 'Data', 'DevOps'];
const LEVELS = ['IC1', 'IC2', 'IC3', 'IC4', 'IC5', 'M1', 'M2', 'M3'];
const LOCATION_TYPES = ['Remote', 'Hybrid', 'Onsite'];
const REGIONS = ['AMER', 'EMEA', 'APAC'];
const SOURCES = ['Referral', 'Inbound', 'Sourced', 'Agency', 'Internal'];
const STATUSES = ['Open', 'Closed', 'OnHold'];
const DISPOSITIONS = ['Active', 'Rejected', 'Withdrawn', 'Hired'];

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

const STAGES = [
  'Lead', 'Applied', 'Recruiter Screen', 'Hiring Manager Review',
  'Technical Screen', 'Onsite Interview', 'Final Round',
  'Offer Extended', 'Offer Accepted', 'Hired', 'Rejected', 'Withdrawn'
];

const EVENT_TYPES = [
  'STAGE_CHANGE', 'INTERVIEW_SCHEDULED', 'INTERVIEW_COMPLETED',
  'FEEDBACK_SUBMITTED', 'OFFER_REQUESTED', 'OFFER_APPROVED',
  'OFFER_EXTENDED', 'OFFER_ACCEPTED', 'OUTREACH_SENT', 'SCREEN_COMPLETED'
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

export function generateSampleData(config: {
  reqCount?: number;
  candidatesPerReq?: number;
  recruiterCount?: number;
  hmCount?: number;
} = {}) {
  const {
    reqCount = 50,
    candidatesPerReq = 15,
    recruiterCount = 8,
    hmCount = 12
  } = config;

  const now = new Date();
  const startDate = subDays(now, 180);

  // Generate Users
  const users: string[] = [];
  users.push('user_id,name,role,team,manager_user_id,email');

  // Generate recruiter names
  for (let i = 1; i <= recruiterCount; i++) {
    const name = generateName();
    const emailName = `${name.first.toLowerCase()}.${name.last.toLowerCase()}`;
    users.push(`recruiter_${i},${name.full},Recruiter,TA Team,manager_1,${emailName}@company.com`);
  }

  // Generate hiring manager names
  for (let i = 1; i <= hmCount; i++) {
    const name = generateName();
    const emailName = `${name.first.toLowerCase()}.${name.last.toLowerCase()}`;
    users.push(`hm_${i},${name.full},HiringManager,${randomItem(FUNCTIONS)},exec_1,${emailName}@company.com`);
  }

  // Add TA manager and exec
  const managerName = generateName();
  const execName = generateName();
  users.push(`manager_1,${managerName.full},Admin,TA Team,,${managerName.first.toLowerCase()}.${managerName.last.toLowerCase()}@company.com`);
  users.push(`exec_1,${execName.full},HiringManager,Engineering,,${execName.first.toLowerCase()}.${execName.last.toLowerCase()}@company.com`);

  // Generate Requisitions
  const requisitions: string[] = [];
  requisitions.push('req_id,req_title,function,job_family,level,location_type,location_region,location_city,comp_band_min,comp_band_max,opened_at,closed_at,status,hiring_manager_id,recruiter_id,business_unit,headcount_type,priority,candidate_slate_required,search_firm_used');

  for (let i = 1; i <= reqCount; i++) {
    const openedAt = randomDate(startDate, subDays(now, 30));
    const status = randomItem(STATUSES);
    const closedAt = status === 'Closed' ? randomDate(addDays(openedAt, 30), now) : '';
    const func = randomItem(FUNCTIONS);
    const jf = randomItem(JOB_FAMILIES);
    const level = randomItem(LEVELS);
    const locType = randomItem(LOCATION_TYPES);
    const region = randomItem(REGIONS);
    const recruiterId = `recruiter_${(i % recruiterCount) + 1}`;
    const hmId = `hm_${(i % hmCount) + 1}`;

    requisitions.push(
      `req_${i},${level} ${jf} Engineer,${func},${jf},${level},${locType},${region},,100000,200000,${formatDate(openedAt)},${closedAt ? formatDate(closedAt as unknown as Date) : ''},${status},${hmId},${recruiterId},${func},New,P1,false,false`
    );
  }

  // Generate Candidates
  const candidates: string[] = [];
  candidates.push('candidate_id,req_id,source,applied_at,first_contacted_at,current_stage,current_stage_entered_at,disposition,hired_at,offer_extended_at,offer_accepted_at');

  let candidateIndex = 1;
  for (let reqIdx = 1; reqIdx <= reqCount; reqIdx++) {
    const candCount = Math.floor(Math.random() * candidatesPerReq) + 5;
    for (let c = 0; c < candCount; c++) {
      const appliedAt = randomDate(startDate, subDays(now, 7));
      const firstContactAt = addDays(appliedAt, Math.floor(Math.random() * 3) + 1);
      const disposition = randomItem(DISPOSITIONS);
      const currentStage = disposition === 'Hired' ? 'Hired' :
                          disposition === 'Rejected' ? 'Rejected' :
                          disposition === 'Withdrawn' ? 'Withdrawn' :
                          randomItem(STAGES.slice(0, 7));
      const stageEnteredAt = randomDate(firstContactAt, now);

      let hiredAt = '';
      let offerExtendedAt = '';
      let offerAcceptedAt = '';

      if (disposition === 'Hired') {
        offerExtendedAt = formatDate(subDays(stageEnteredAt, 7));
        offerAcceptedAt = formatDate(subDays(stageEnteredAt, 3));
        hiredAt = formatDate(stageEnteredAt);
      }

      candidates.push(
        `cand_${candidateIndex},req_${reqIdx},${randomItem(SOURCES)},${formatDate(appliedAt)},${formatDate(firstContactAt)},${currentStage},${formatDate(stageEnteredAt)},${disposition},${hiredAt},${offerExtendedAt},${offerAcceptedAt}`
      );
      candidateIndex++;
    }
  }

  // Generate Events
  const events: string[] = [];
  events.push('event_id,candidate_id,req_id,event_type,from_stage,to_stage,actor_user_id,event_at,metadata_json');

  let eventIndex = 1;
  for (let reqIdx = 1; reqIdx <= reqCount; reqIdx++) {
    const recruiterId = `recruiter_${(reqIdx % recruiterCount) + 1}`;
    const hmId = `hm_${(reqIdx % hmCount) + 1}`;

    // Events per req
    const eventCount = Math.floor(Math.random() * 30) + 10;
    for (let e = 0; e < eventCount; e++) {
      const eventType = randomItem(EVENT_TYPES);
      const eventAt = randomDate(startDate, now);
      const actor = eventType.includes('FEEDBACK') || eventType.includes('OFFER_APPROVED')
        ? hmId : recruiterId;

      const fromStage = eventType === 'STAGE_CHANGE' ? randomItem(STAGES) : '';
      const toStage = eventType === 'STAGE_CHANGE' ? randomItem(STAGES) : '';

      events.push(
        `evt_${eventIndex},cand_${(reqIdx * 10) + (e % 10)},req_${reqIdx},${eventType},${fromStage},${toStage},${actor},${formatDate(eventAt)},`
      );
      eventIndex++;
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
