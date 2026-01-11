// iCIMS Single-File Parser
// Transforms the 94-column "Submittal Export" format into our normalized data model
// OPTIMIZED: Single-pass column processing for large files

import { parse } from 'papaparse';
import {
  Requisition,
  Candidate,
  Event,
  User,
  RequisitionStatus,
  CandidateDisposition,
  CanonicalStage,
  EventType,
  LocationType,
  LocationRegion,
  HeadcountType,
  UserRole,
  StageTimestamps
} from '../types';

// ===== PARSER OPTIONS =====
export interface ICIMSParserOptions {
  maxRows?: number;           // Limit rows processed (default: 100000)
  generateEvents?: boolean;   // Whether to generate synthetic events (default: false for performance)
  sampleRate?: number;        // Process every Nth row for huge files (default: 1 = all rows)
}

const DEFAULT_OPTIONS: ICIMSParserOptions = {
  maxRows: 100000,
  generateEvents: false,  // Disabled by default - events are expensive
  sampleRate: 1
};

// ===== COLUMN MAPPINGS =====

// Direct source column names to check (in priority order)
const DIRECT_SOURCE_COLUMNS = [
  'Source',
  'Recruiting Source',
  'Source Name',
  'Candidate Source',
  'Source Type',
  'Source/Recruiting Source',
  'Person : Source',
  'Job Source',
  'Applicant Source'
];

// Source columns - the column suffix becomes the source name
const SOURCE_COLUMN_PREFIX = 'Last Resume Submissions:';
const SOURCE_COLUMN_MAP: Record<string, string> = {
  'LinkedIn': 'LinkedIn',
  'Employee Referral': 'Referral',
  'Indeed Apply': 'Indeed',
  'Recruiter': 'Sourced',
  'External Portal': 'Inbound',
  'Internal Portal': 'Internal',
  'Vendor Portal': 'Agency',
  'Initial DNQ': 'Inbound',
  'Candidate Withdrew': 'Unknown'  // Can't determine if they withdrew
};

// Normalize source values from direct source columns
const SOURCE_VALUE_MAP: Record<string, string> = {
  // LinkedIn variants
  'linkedin': 'LinkedIn',
  'linkedin recruiter': 'LinkedIn',
  'linkedin jobs': 'LinkedIn',
  'linkedin (apply)': 'LinkedIn',
  // Indeed variants
  'indeed': 'Indeed',
  'indeed.com': 'Indeed',
  'indeed apply': 'Indeed',
  // Referral variants
  'referral': 'Referral',
  'employee referral': 'Referral',
  'internal referral': 'Referral',
  'referred': 'Referral',
  // Sourced variants
  'sourced': 'Sourced',
  'recruiter': 'Sourced',
  'recruiter sourced': 'Sourced',
  'direct source': 'Sourced',
  'proactive': 'Sourced',
  // Agency variants
  'agency': 'Agency',
  'staffing agency': 'Agency',
  'vendor': 'Agency',
  'vendor portal': 'Agency',
  'search firm': 'Agency',
  'recruiting agency': 'Agency',
  // Internal variants
  'internal': 'Internal',
  'internal portal': 'Internal',
  'internal mobility': 'Internal',
  'internal transfer': 'Internal',
  // Inbound/Career site variants
  'career site': 'Inbound',
  'careers page': 'Inbound',
  'company website': 'Inbound',
  'external portal': 'Inbound',
  'inbound': 'Inbound',
  'direct application': 'Inbound',
  'applied directly': 'Inbound',
  // Job boards
  'glassdoor': 'Glassdoor',
  'ziprecruiter': 'ZipRecruiter',
  'monster': 'Monster',
  'dice': 'Dice',
  'hired': 'Hired.com',
  'angellist': 'AngelList',
  'wellfound': 'AngelList',
  // Campus
  'campus': 'Campus',
  'university': 'Campus',
  'college': 'Campus',
  'campus recruiting': 'Campus',
  // Event
  'event': 'Event',
  'career fair': 'Event',
  'job fair': 'Event',
  'meetup': 'Event',
  'conference': 'Event'
};

// Stage columns grouped by canonical stage
const STAGE_COLUMN_PATTERNS: { pattern: RegExp; stage: CanonicalStage; disposition?: CandidateDisposition }[] = [
  // Resume/Application stage
  { pattern: /^Last Resume Submissions:/, stage: CanonicalStage.APPLIED },
  { pattern: /^Last Incomplete:/, stage: CanonicalStage.LEAD },

  // Screen stage
  { pattern: /^Last Interview: Phone Screen Staffing/, stage: CanonicalStage.SCREEN },
  { pattern: /^Last Interview: Phone Screen Scheduled/, stage: CanonicalStage.SCREEN },
  { pattern: /^Last Interview: Phone Screen - Not Qualified/, stage: CanonicalStage.REJECTED, disposition: CandidateDisposition.Rejected },

  // HM Screen stage
  { pattern: /^Last Interview: Phone Screen Hiring Manager/, stage: CanonicalStage.HM_SCREEN },
  { pattern: /^Last Interview: 1st Round Interview/, stage: CanonicalStage.HM_SCREEN },
  { pattern: /^Last Hiring Manager Review:/, stage: CanonicalStage.HM_SCREEN },

  // Onsite/Later rounds
  { pattern: /^Last Interview: 2nd Round Interview/, stage: CanonicalStage.ONSITE },
  { pattern: /^Last Interview: Final Interview/, stage: CanonicalStage.FINAL },
  { pattern: /^Last Interview: Decision Pending/, stage: CanonicalStage.FINAL },

  // Rejections/Withdrawals at interview
  { pattern: /^Last Interview: Interviewed; Not Selected/, stage: CanonicalStage.REJECTED, disposition: CandidateDisposition.Rejected },
  { pattern: /^Last Interview: Candidate Withdrew/, stage: CanonicalStage.WITHDREW, disposition: CandidateDisposition.Withdrawn },
  { pattern: /Not Selected$/, stage: CanonicalStage.REJECTED, disposition: CandidateDisposition.Rejected },

  // Offer stage
  { pattern: /^Last Offer:/, stage: CanonicalStage.OFFER },
  { pattern: /^Last Offer: Offer Declined/, stage: CanonicalStage.REJECTED, disposition: CandidateDisposition.Rejected },
  { pattern: /^Last Offer: Offer Rescinded/, stage: CanonicalStage.REJECTED, disposition: CandidateDisposition.Rejected },

  // Hired stage
  { pattern: /^Last Hired:/, stage: CanonicalStage.HIRED, disposition: CandidateDisposition.Hired },
  { pattern: /^Date First Interviewed:/, stage: CanonicalStage.SCREEN }  // Generic interview dates
];

// Columns that indicate terminal states
const HIRED_COLUMNS = [
  'Last Hired: Closed Requisition',
  'Last Hired: Begin Onboarding - U.S. (Portal)',
  'Last Hired: Begin Onboarding - International',
  'Last Hired: Begin Onboarding - India (Portal)',
  'Last Hired: Begin Onboarding - EMEA (Portal)',
  'Last Hired: Onboarding Completed'
];

const REJECTED_COLUMNS = [
  'Last Interview: Interviewed; Not Selected',
  'Last Interview: Phone Screen - Not Qualified',
  'Last Interview: Phone Screen Staffing; Not Selected',
  'Last Interview: Phone Screen Hiring Manager; Not Selected',
  'Last Offer: Offer Declined/Rejected',
  'Last Offer: Offer Rescinded'
];

const WITHDRAWN_COLUMNS = [
  'Last Interview: Candidate Withdrew',
  'Last Resume Submissions: Candidate Withdrew'
];

// ===== DATE PARSING =====

/**
 * Parse iCIMS date format: "M/D/YYYY h:mm:ss A" or "M/D/YYYY"
 */
function parseICIMSDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr || typeof dateStr !== 'string' || dateStr.trim() === '') {
    return null;
  }

  try {
    // Try parsing "M/D/YYYY h:mm:ss AM/PM" format
    const fullMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})\s*(AM|PM)?$/i);
    if (fullMatch) {
      let [, month, day, year, hours, minutes, seconds, ampm] = fullMatch;
      let hour = parseInt(hours, 10);
      if (ampm) {
        if (ampm.toUpperCase() === 'PM' && hour !== 12) hour += 12;
        if (ampm.toUpperCase() === 'AM' && hour === 12) hour = 0;
      }
      return new Date(
        parseInt(year, 10),
        parseInt(month, 10) - 1,
        parseInt(day, 10),
        hour,
        parseInt(minutes, 10),
        parseInt(seconds, 10)
      );
    }

    // Try simple date format "M/D/YYYY"
    const simpleMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (simpleMatch) {
      const [, month, day, year] = simpleMatch;
      return new Date(
        parseInt(year, 10),
        parseInt(month, 10) - 1,
        parseInt(day, 10)
      );
    }

    // Fallback to Date.parse
    const parsed = new Date(dateStr);
    return isNaN(parsed.getTime()) ? null : parsed;
  } catch {
    return null;
  }
}

// ===== EVENT GENERATION =====

/**
 * Generate synthetic events from all timestamp columns in a row
 */
function generateEventsFromRow(
  row: Record<string, string>,
  candidateId: string,
  reqId: string
): Event[] {
  const events: Event[] = [];
  let eventId = 1;

  // Collect all timestamps with their columns
  const timestamps: { column: string; date: Date; stage: CanonicalStage }[] = [];

  for (const [column, value] of Object.entries(row)) {
    const date = parseICIMSDate(value);
    if (!date) continue;

    // Skip non-stage columns
    if (!column.startsWith('Last ') && !column.startsWith('Date First ')) continue;

    // Find canonical stage
    let stage = CanonicalStage.APPLIED;
    for (const mapping of STAGE_COLUMN_PATTERNS) {
      if (mapping.pattern.test(column)) {
        stage = mapping.stage;
        break;
      }
    }

    timestamps.push({ column, date, stage });
  }

  // Sort by date
  timestamps.sort((a, b) => a.date.getTime() - b.date.getTime());

  // Generate STAGE_CHANGE events
  let previousStage: CanonicalStage | null = null;
  for (const ts of timestamps) {
    if (ts.stage !== previousStage) {
      events.push({
        event_id: `${candidateId}-evt-${eventId++}`,
        candidate_id: candidateId,
        req_id: reqId,
        event_type: EventType.STAGE_CHANGE,
        event_at: ts.date,
        from_stage: previousStage || '',
        to_stage: ts.stage,
        actor_user_id: '',
        metadata_json: JSON.stringify({ derived_from: ts.column })
      });
      previousStage = ts.stage;
    }
  }

  return events;
}

// ===== MAIN PARSER =====

export interface ICIMSParseResult {
  requisitions: Requisition[];
  candidates: Candidate[];
  events: Event[];
  users: User[];
  warnings: string[];
  stats: {
    totalRows: number;
    uniqueRequisitions: number;
    uniqueCandidates: number;
    eventsGenerated: number;
    sourcesInferred: Record<string, number>;
  };
}

/**
 * Detect if a CSV is in iCIMS single-file format
 */
export function isICIMSFormat(headers: string[]): boolean {
  // Check for characteristic iCIMS columns
  const hasReqId = headers.some(h => h.includes('Requisition ID'));
  const hasPersonId = headers.some(h => h.includes('Person : System ID'));
  const hasResumeSubmissions = headers.some(h => h.startsWith('Last Resume Submissions:'));
  const hasInterviews = headers.some(h => h.startsWith('Last Interview:'));

  return hasReqId && hasPersonId && (hasResumeSubmissions || hasInterviews);
}

// Pre-categorized column info for fast lookup
interface ColumnCategory {
  directSourceColumn: string | null;  // Direct source column (e.g., "Source", "Recruiting Source")
  sourceColumns: string[];      // Columns that indicate source (Last Resume Submissions:X)
  stageColumns: { col: string; stage: CanonicalStage; disposition?: CandidateDisposition }[];
  hiredColumns: string[];
  rejectedColumns: string[];
  withdrawnColumns: string[];
}

/**
 * Pre-categorize columns once for fast lookup during row processing
 */
function categorizeColumns(headers: string[]): ColumnCategory {
  const result: ColumnCategory = {
    directSourceColumn: null,
    sourceColumns: [],
    stageColumns: [],
    hiredColumns: [],
    rejectedColumns: [],
    withdrawnColumns: []
  };

  // Create lowercase header map for case-insensitive matching
  const headerLower = new Map<string, string>();
  for (const h of headers) {
    headerLower.set(h.toLowerCase().trim(), h);
  }

  // Find direct source column (check in priority order)
  for (const directCol of DIRECT_SOURCE_COLUMNS) {
    const found = headerLower.get(directCol.toLowerCase());
    if (found) {
      result.directSourceColumn = found;
      console.log(`[iCIMS Parser] Found direct source column: "${found}"`);
      break;
    }
  }

  for (const col of headers) {
    // Source columns (timestamp-based fallback)
    if (col.startsWith(SOURCE_COLUMN_PREFIX)) {
      result.sourceColumns.push(col);
    }

    // Check against stage patterns
    for (const mapping of STAGE_COLUMN_PATTERNS) {
      if (mapping.pattern.test(col)) {
        result.stageColumns.push({ col, stage: mapping.stage, disposition: mapping.disposition });
        break;
      }
    }

    // Terminal state columns
    if (HIRED_COLUMNS.includes(col)) {
      result.hiredColumns.push(col);
    }
    if (REJECTED_COLUMNS.includes(col)) {
      result.rejectedColumns.push(col);
    }
    if (WITHDRAWN_COLUMNS.includes(col)) {
      result.withdrawnColumns.push(col);
    }
  }

  if (!result.directSourceColumn && result.sourceColumns.length === 0) {
    console.warn('[iCIMS Parser] No source columns found! Sources will default to "Unknown"');
  }

  return result;
}

/**
 * OPTIMIZED: Single-pass row processing
 * Extracts source, stage, and dates in one iteration through relevant columns only
 * Now also extracts ALL stage timestamps for accurate event generation
 */
function processRowOptimized(
  row: Record<string, string>,
  columnCat: ColumnCategory
): {
  source: string;
  appliedAt: Date | null;
  canonicalStage: CanonicalStage;
  disposition: CandidateDisposition;
  latestActivityAt: Date | null;
  hireDate: Date | null;
  earliestDate: Date | null;
  stageTimestamps: StageTimestamps;
} {
  let source = 'Unknown';
  let appliedAt: Date | null = null;
  let earliestSourceDate: Date | null = null;

  let latestDate: Date | null = null;
  let canonicalStage = CanonicalStage.APPLIED;
  let disposition = CandidateDisposition.Active;

  let hireDate: Date | null = null;
  let earliestDate: Date | null = null;

  // Track ALL stage timestamps (not just latest)
  const stageTimestamps: StageTimestamps = {
    interviews: []
  };
  const stageDates: Map<CanonicalStage, { date: Date; column: string }> = new Map();

  // FIRST: Check direct source column (most reliable)
  if (columnCat.directSourceColumn) {
    const directSourceValue = row[columnCat.directSourceColumn]?.trim();
    if (directSourceValue) {
      const lowerSource = directSourceValue.toLowerCase();
      // Look up normalized source name, or use original with title case
      source = SOURCE_VALUE_MAP[lowerSource] ||
        directSourceValue.charAt(0).toUpperCase() + directSourceValue.slice(1);
    }
  }

  // FALLBACK: Process timestamp-based source columns if direct source wasn't found
  if (source === 'Unknown') {
    for (const col of columnCat.sourceColumns) {
      const val = row[col];
      if (!val) continue;
      const date = parseICIMSDate(val);
      if (!date) continue;

      if (!earliestDate || date < earliestDate) earliestDate = date;
      if (!earliestSourceDate || date < earliestSourceDate) {
        earliestSourceDate = date;
        appliedAt = date;
        const sourceName = col.replace(SOURCE_COLUMN_PREFIX, '').trim();
        source = SOURCE_COLUMN_MAP[sourceName] || sourceName;
      }
    }
  } else {
    // Still process source columns for dates even if we have direct source
    for (const col of columnCat.sourceColumns) {
      const val = row[col];
      if (!val) continue;
      const date = parseICIMSDate(val);
      if (!date) continue;

      if (!earliestDate || date < earliestDate) earliestDate = date;
      if (!earliestSourceDate || date < earliestSourceDate) {
        earliestSourceDate = date;
        appliedAt = date;
      }
    }
  }

  // Process stage columns - find latest for current stage AND collect all timestamps
  for (const { col, stage, disposition: disp } of columnCat.stageColumns) {
    const val = row[col];
    if (!val) continue;
    const date = parseICIMSDate(val);
    if (!date) continue;

    if (!earliestDate || date < earliestDate) earliestDate = date;
    if (!latestDate || date > latestDate) {
      latestDate = date;
      canonicalStage = stage;
      if (disp) disposition = disp;
    }

    // Track this stage timestamp (keep earliest per stage for stage entry time)
    const existing = stageDates.get(stage);
    if (!existing || date < existing.date) {
      stageDates.set(stage, { date, column: col });
    }

    // Add to interviews array for granular tracking
    if (stage !== CanonicalStage.APPLIED && stage !== CanonicalStage.HIRED &&
        stage !== CanonicalStage.REJECTED && stage !== CanonicalStage.WITHDREW) {
      stageTimestamps.interviews!.push({ stage, date, column: col });
    }
  }

  // Populate named stage timestamps from collected data
  const screenDate = stageDates.get(CanonicalStage.SCREEN);
  const hmScreenDate = stageDates.get(CanonicalStage.HM_SCREEN);
  const onsiteDate = stageDates.get(CanonicalStage.ONSITE);
  const finalDate = stageDates.get(CanonicalStage.FINAL);
  const offerDate = stageDates.get(CanonicalStage.OFFER);

  if (screenDate) stageTimestamps.screen_at = screenDate.date;
  if (hmScreenDate) stageTimestamps.hm_screen_at = hmScreenDate.date;
  if (onsiteDate) stageTimestamps.onsite_at = onsiteDate.date;
  if (finalDate) stageTimestamps.final_at = finalDate.date;
  if (offerDate) stageTimestamps.offer_at = offerDate.date;

  // Sort interviews by date
  stageTimestamps.interviews!.sort((a, b) => a.date.getTime() - b.date.getTime());

  // Check for hired (overrides)
  for (const col of columnCat.hiredColumns) {
    const val = row[col];
    if (!val) continue;
    const date = parseICIMSDate(val);
    if (date) {
      disposition = CandidateDisposition.Hired;
      canonicalStage = CanonicalStage.HIRED;
      if (!hireDate || date > hireDate) hireDate = date;
    }
  }

  // Check explicit hire date column
  const explicitHireDate = parseICIMSDate(row['Hire/Rehire Date']);
  if (explicitHireDate) {
    hireDate = explicitHireDate;
    disposition = CandidateDisposition.Hired;
    canonicalStage = CanonicalStage.HIRED;
  }

  // Check for rejected (if not hired)
  if (disposition !== CandidateDisposition.Hired) {
    for (const col of columnCat.rejectedColumns) {
      if (row[col] && parseICIMSDate(row[col])) {
        disposition = CandidateDisposition.Rejected;
        break;
      }
    }
  }

  // Check for withdrawn (if not hired/rejected)
  if (disposition === CandidateDisposition.Active) {
    for (const col of columnCat.withdrawnColumns) {
      if (row[col] && parseICIMSDate(row[col])) {
        disposition = CandidateDisposition.Withdrawn;
        break;
      }
    }
  }

  return {
    source,
    appliedAt,
    canonicalStage,
    disposition,
    latestActivityAt: latestDate,
    hireDate,
    earliestDate,
    stageTimestamps
  };
}

/**
 * Parse iCIMS single-file export into our normalized data model
 * OPTIMIZED for large files with single-pass processing
 */
export function parseICIMSSingleFile(csvContent: string, options: ICIMSParserOptions = {}): ICIMSParseResult {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const warnings: string[] = [];
  const sourceCounts: Record<string, number> = {};

  console.log(`[iCIMS Parser] Starting parse with options:`, opts);
  const startTime = Date.now();

  // Parse CSV
  const parseResult = parse<Record<string, string>>(csvContent, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim()
  });

  console.log(`[iCIMS Parser] CSV parsed in ${Date.now() - startTime}ms, ${parseResult.data.length} rows`);

  if (parseResult.errors.length > 0) {
    warnings.push(`CSV parsing warnings: ${parseResult.errors.length} issues`);
  }

  let rows = parseResult.data;
  const totalRowsInFile = rows.length;

  // Apply row limit
  if (opts.maxRows && rows.length > opts.maxRows) {
    warnings.push(`File has ${rows.length} rows, processing first ${opts.maxRows} only`);
    rows = rows.slice(0, opts.maxRows);
  }

  // Apply sampling for huge files
  if (opts.sampleRate && opts.sampleRate > 1) {
    warnings.push(`Sampling every ${opts.sampleRate}th row`);
    rows = rows.filter((_, i) => i % opts.sampleRate! === 0);
  }

  // Pre-categorize columns for fast lookup
  const headers = parseResult.meta.fields || [];
  const columnCat = categorizeColumns(headers);
  console.log(`[iCIMS Parser] Columns categorized: ${columnCat.sourceColumns.length} source, ${columnCat.stageColumns.length} stage`);

  // Maps for deduplication
  const requisitionsMap = new Map<string, Requisition>();
  const candidatesMap = new Map<string, Candidate>();
  const usersMap = new Map<string, User>();
  const allEvents: Event[] = [];

  let processedRows = 0;
  const logInterval = Math.max(1000, Math.floor(rows.length / 10));

  for (const row of rows) {
    processedRows++;
    if (processedRows % logInterval === 0) {
      console.log(`[iCIMS Parser] Processed ${processedRows}/${rows.length} rows...`);
    }

    // Extract IDs
    const reqId = row['Job : Requisition ID']?.trim();
    const personId = row['Person : System ID']?.trim();

    if (!reqId || !personId) {
      continue; // Skip silently - don't spam warnings
    }

    const candidateId = `${reqId}-${personId}`;

    // Single-pass extraction of source, stage, dates
    const extracted = processRowOptimized(row, columnCat);

    // === Extract/Update Requisition ===
    if (!requisitionsMap.has(reqId)) {
      const hmName = row['Hiring Manager : Full Name: First Last']?.trim() || 'Unknown';
      const hmId = `hm-${hmName.toLowerCase().replace(/\s+/g, '-')}`;

      const recruiterName = row['Recruiter : Full Name: First Last']?.trim() || 'Unknown';
      const recruiterId = `rec-${recruiterName.toLowerCase().replace(/\s+/g, '-')}`;

      // Parse job title and extract function/level
      const jobTitle = row['Job : Job Title and Job Code']?.trim() || '';
      const { func, level, jobFamily } = parseJobTitle(jobTitle);

      // Determine location type from office location
      const officeLocation = row['Job : Office Location']?.trim() || '';

      requisitionsMap.set(reqId, {
        req_id: reqId,
        req_title: jobTitle || `Requisition ${reqId}`,
        function: func,
        level: level,
        location_type: inferLocationTypeEnum(officeLocation),
        location_region: LocationRegion.AMER,
        location_city: officeLocation || null,
        job_family: jobFamily,
        comp_band_min: null,
        comp_band_max: null,
        hiring_manager_id: hmId,
        recruiter_id: recruiterId,
        business_unit: row['Job : Business Unit']?.trim() || null,
        headcount_type: HeadcountType.New,
        priority: null,
        candidate_slate_required: false,
        search_firm_used: false,
        status: extracted.hireDate ? RequisitionStatus.Closed : RequisitionStatus.Open,
        opened_at: extracted.earliestDate || new Date(),
        closed_at: extracted.hireDate
      });

      // Add HM to users
      if (!usersMap.has(hmId)) {
        usersMap.set(hmId, {
          user_id: hmId,
          name: hmName,
          email: `${hmName.toLowerCase().replace(/\s+/g, '.')}@company.com`,
          role: UserRole.HiringManager,
          team: row['Job : Department']?.trim() || null,
          manager_user_id: null
        });
      }

      // Add Recruiter to users
      if (!usersMap.has(recruiterId)) {
        usersMap.set(recruiterId, {
          user_id: recruiterId,
          name: recruiterName,
          email: `${recruiterName.toLowerCase().replace(/\s+/g, '.')}@company.com`,
          role: UserRole.Recruiter,
          team: 'Talent Acquisition',
          manager_user_id: null
        });
      }
    } else if (extracted.hireDate) {
      // Update requisition status if this row has a hire
      const req = requisitionsMap.get(reqId)!;
      req.status = RequisitionStatus.Closed;
      req.closed_at = req.closed_at || extracted.hireDate;
    }

    // Track source counts
    sourceCounts[extracted.source] = (sourceCounts[extracted.source] || 0) + 1;

    // === Extract Candidate ===
    candidatesMap.set(candidateId, {
      candidate_id: candidateId,
      req_id: reqId,
      name: row['Person : Full Name: First Last']?.trim() || 'Unknown',
      source: extracted.source,
      current_stage: extracted.canonicalStage,
      current_stage_entered_at: extracted.latestActivityAt || extracted.appliedAt || new Date(),
      disposition: extracted.disposition,
      applied_at: extracted.appliedAt || null,
      // First contacted = earliest screen/interview date (first real touch after application)
      first_contacted_at: extracted.stageTimestamps.screen_at ||
        extracted.stageTimestamps.hm_screen_at ||
        (extracted.stageTimestamps.interviews && extracted.stageTimestamps.interviews.length > 0
          ? extracted.stageTimestamps.interviews[0].date
          : null),
      hired_at: extracted.disposition === CandidateDisposition.Hired ? extracted.hireDate : null,
      offer_extended_at: extracted.stageTimestamps.offer_at || null,
      offer_accepted_at: extracted.disposition === CandidateDisposition.Hired ? extracted.hireDate : null,
      // Include real stage timestamps from iCIMS
      stage_timestamps: extracted.stageTimestamps
    });

    // === Generate Events (optional - expensive!) ===
    if (opts.generateEvents) {
      const events = generateEventsFromRow(row, candidateId, reqId);
      allEvents.push(...events);
    }
  }

  const elapsed = Date.now() - startTime;
  console.log(`[iCIMS Parser] Complete in ${elapsed}ms: ${requisitionsMap.size} reqs, ${candidatesMap.size} candidates`);

  return {
    requisitions: Array.from(requisitionsMap.values()),
    candidates: Array.from(candidatesMap.values()),
    events: allEvents,
    users: Array.from(usersMap.values()),
    warnings,
    stats: {
      totalRows: totalRowsInFile,
      uniqueRequisitions: requisitionsMap.size,
      uniqueCandidates: candidatesMap.size,
      eventsGenerated: allEvents.length,
      sourcesInferred: sourceCounts
    }
  };
}

// ===== HELPER FUNCTIONS =====

/**
 * Parse job title to extract function, level, and job family
 */
function parseJobTitle(jobTitle: string): { func: string; level: string; jobFamily: string } {
  // Default values
  let func = 'General';
  let level = 'IC3';
  let jobFamily = 'General';

  const titleLower = jobTitle.toLowerCase();

  // Infer function
  if (titleLower.includes('engineer') || titleLower.includes('developer') || titleLower.includes('software')) {
    func = 'Engineering';
  } else if (titleLower.includes('product manager') || titleLower.includes('product owner')) {
    func = 'Product';
  } else if (titleLower.includes('design') || titleLower.includes('ux')) {
    func = 'Design';
  } else if (titleLower.includes('sales') || titleLower.includes('account')) {
    func = 'Sales';
  } else if (titleLower.includes('marketing')) {
    func = 'Marketing';
  } else if (titleLower.includes('hr') || titleLower.includes('recruiter') || titleLower.includes('talent')) {
    func = 'People';
  } else if (titleLower.includes('finance') || titleLower.includes('accounting')) {
    func = 'Finance';
  } else if (titleLower.includes('legal')) {
    func = 'Legal';
  } else if (titleLower.includes('operations') || titleLower.includes('ops')) {
    func = 'Operations';
  }

  // Infer level
  if (titleLower.includes('intern')) {
    level = 'Intern';
  } else if (titleLower.includes('junior') || titleLower.includes('jr') || titleLower.includes(' i ') || titleLower.endsWith(' 1')) {
    level = 'IC1';
  } else if (titleLower.includes(' ii ') || titleLower.endsWith(' 2')) {
    level = 'IC2';
  } else if (titleLower.includes('senior') || titleLower.includes('sr') || titleLower.includes(' iii ') || titleLower.endsWith(' 3')) {
    level = 'IC4';
  } else if (titleLower.includes('staff') || titleLower.includes('principal')) {
    level = 'IC5';
  } else if (titleLower.includes('director')) {
    level = 'M3';
  } else if (titleLower.includes('vp') || titleLower.includes('vice president')) {
    level = 'M4';
  } else if (titleLower.includes('manager') || titleLower.includes('lead')) {
    level = 'M1';
  }

  // Infer job family (for engineering)
  if (func === 'Engineering') {
    if (titleLower.includes('backend') || titleLower.includes('back-end') || titleLower.includes('server')) {
      jobFamily = 'Backend';
    } else if (titleLower.includes('frontend') || titleLower.includes('front-end') || titleLower.includes('ui')) {
      jobFamily = 'Frontend';
    } else if (titleLower.includes('fullstack') || titleLower.includes('full-stack') || titleLower.includes('full stack')) {
      jobFamily = 'Fullstack';
    } else if (titleLower.includes('mobile') || titleLower.includes('ios') || titleLower.includes('android')) {
      jobFamily = 'Mobile';
    } else if (titleLower.includes('data') || titleLower.includes('ml') || titleLower.includes('machine learning')) {
      jobFamily = 'Data';
    } else if (titleLower.includes('devops') || titleLower.includes('sre') || titleLower.includes('infrastructure')) {
      jobFamily = 'DevOps';
    } else if (titleLower.includes('security')) {
      jobFamily = 'Security';
    } else if (titleLower.includes('qa') || titleLower.includes('test') || titleLower.includes('quality')) {
      jobFamily = 'QA';
    } else {
      jobFamily = 'Backend';  // Default for engineering
    }
  } else {
    jobFamily = func;  // Use function as job family for non-engineering
  }

  return { func, level, jobFamily };
}

/**
 * Infer location type from office location string (returns LocationType enum)
 */
function inferLocationTypeEnum(officeLocation: string): LocationType {
  const locationLower = officeLocation.toLowerCase();

  if (locationLower.includes('remote') || locationLower.includes('virtual') || locationLower.includes('work from home')) {
    return LocationType.Remote;
  } else if (locationLower.includes('hybrid')) {
    return LocationType.Hybrid;
  } else if (officeLocation.trim() === '') {
    return LocationType.Remote;  // Assume remote if no location specified
  }
  return LocationType.Onsite;
}

// inferReqOpenDate and inferHireDate removed - now handled by processRowOptimized
