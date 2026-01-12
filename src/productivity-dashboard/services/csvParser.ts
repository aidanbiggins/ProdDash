// CSV Parsing Service for the Recruiter Productivity Dashboard

import Papa from 'papaparse';
import { DateTime } from 'luxon';
import {
  Requisition,
  Candidate,
  Event,
  User,
  RawRequisition,
  RawCandidate,
  RawEvent,
  RawUser,
  RequisitionStatus,
  LocationType,
  LocationRegion,
  HeadcountType,
  Priority,
  CandidateSource,
  CandidateDisposition,
  EventType,
  UserRole
} from '../types';

// ===== VALIDATION RESULTS =====

export interface ValidationError {
  row: number;
  field: string;
  message: string;
  value: string;
}

export interface ParseResult<T> {
  data: T[];
  errors: ValidationError[];
  warnings: ValidationError[];
  rowCount: number;
  successCount: number;
}

export interface CsvImportResult {
  requisitions: ParseResult<Requisition>;
  candidates: ParseResult<Candidate>;
  events: ParseResult<Event>;
  users: ParseResult<User>;
  isValid: boolean;
  criticalErrors: string[];
}

// ===== DATE PARSING =====

const TIMEZONE = 'America/Los_Angeles';

function parseDate(value: string | undefined, fieldName: string, row: number): { date: Date | null; error?: ValidationError } {
  if (!value || value.trim() === '') {
    return { date: null };
  }

  // Try various formats
  const formats = [
    'yyyy-MM-dd\'T\'HH:mm:ss.SSSZ',
    'yyyy-MM-dd\'T\'HH:mm:ssZ',
    'yyyy-MM-dd\'T\'HH:mm:ss',
    'yyyy-MM-dd HH:mm:ss',
    'yyyy-MM-dd',
    'MM/dd/yyyy HH:mm:ss',
    'MM/dd/yyyy',
    'M/d/yyyy'
  ];

  for (const fmt of formats) {
    const dt = DateTime.fromFormat(value.trim(), fmt, { zone: 'UTC' });
    if (dt.isValid) {
      return { date: dt.toJSDate() };
    }
  }

  // Try ISO parsing as fallback
  const isoDate = DateTime.fromISO(value.trim(), { zone: 'UTC' });
  if (isoDate.isValid) {
    return { date: isoDate.toJSDate() };
  }

  return {
    date: null,
    error: {
      row,
      field: fieldName,
      message: `Invalid date format`,
      value: value
    }
  };
}

function parseBoolean(value: string | undefined): boolean {
  if (!value) return false;
  const lower = value.toLowerCase().trim();
  return lower === 'true' || lower === 'yes' || lower === '1';
}

function parseNumber(value: string | undefined): number | null {
  if (!value || value.trim() === '') return null;
  const num = parseFloat(value);
  return isNaN(num) ? null : num;
}

// ===== ENUM VALIDATION =====

function validateEnum<T extends string>(
  value: string | undefined,
  validValues: T[],
  fieldName: string,
  row: number,
  defaultValue?: T
): { value: T | string; warning?: ValidationError } {
  if (!value || value.trim() === '') {
    if (defaultValue) {
      return { value: defaultValue };
    }
    return { value: '' };
  }

  const trimmed = value.trim();
  const found = validValues.find(v => v.toLowerCase() === trimmed.toLowerCase());

  if (found) {
    return { value: found };
  }

  // Return the original value but add a warning
  return {
    value: trimmed,
    warning: {
      row,
      field: fieldName,
      message: `Value "${trimmed}" is not a standard value. Valid values: ${validValues.join(', ')}`,
      value: trimmed
    }
  };
}

// ===== COLUMN NAME ALIASES (for different ATS systems like iCIMS) =====

const COLUMN_ALIASES: Record<string, string[]> = {
  // Requisition fields
  'req_id': ['job_id', 'requisition_id', 'job_number', 'position_id', 'icims_id', 'posting_id',
    // iCIMS specific
    'job_requisition_id', 'job__requisition_id'],
  'req_title': ['job_title', 'position_title', 'title', 'job_name', 'position_name',
    // iCIMS specific
    'job_job_title_and_job_code', 'job_job_title'],
  'function': ['department', 'business_function', 'org', 'organization', 'dept',
    // iCIMS specific
    'job_department'],
  'job_family': ['job_category', 'category', 'job_type', 'family', 'role_family'],
  'level': ['job_level', 'grade', 'band', 'career_level', 'seniority', 'type'],
  'location_type': ['work_type', 'remote_status', 'workplace_type', 'work_location_type'],
  'location_region': ['region', 'geo', 'geography', 'area'],
  'location_city': ['city', 'office', 'location', 'office_location',
    // iCIMS specific
    'job_office_location'],
  'opened_at': ['open_date', 'created_date', 'posted_date', 'start_date', 'date_opened', 'created_at'],
  'closed_at': ['close_date', 'filled_date', 'closed_date', 'date_closed', 'end_date'],
  'status': ['req_status', 'job_status', 'state', 'requisition_status'],
  'hiring_manager_id': ['hiring_manager', 'hm_id', 'manager_id', 'hm', 'manager',
    // iCIMS specific
    'hiring_manager_full_name_first_last'],
  'recruiter_id': ['recruiter', 'assigned_recruiter', 'owner', 'owner_id', 'ta_owner',
    // iCIMS specific
    'recruiter_full_name_first_last'],
  'headcount_type': ['position_type', 'hc_type', 'requisition_type', 'req_type'],
  'priority': ['urgency', 'req_priority'],
  'business_unit': ['bu', 'division', 'org_unit',
    // iCIMS specific
    'job_business_unit'],

  // Candidate fields
  'candidate_id': ['person_id', 'applicant_id', 'profile_id', 'candidate',
    // iCIMS specific
    'person_system_id', 'person_id'],
  'candidate_name': ['person_full_name_first_last', 'applicant_name', 'full_name'],
  'source': ['candidate_source', 'origin', 'source_type', 'how_found'],
  'current_stage': ['stage', 'status', 'workflow_status', 'pipeline_stage', 'current_status'],
  'current_stage_entered_at': ['stage_date', 'status_date', 'stage_entered', 'last_stage_change'],
  'disposition': ['outcome', 'result', 'final_status', 'candidate_status'],
  'applied_at': ['application_date', 'apply_date', 'date_applied', 'submitted_date',
    // iCIMS - use recruiter or external submission timestamp
    'last_resume_submissions_recruiter', 'last_resume_submissions_external_portal'],
  'first_contacted_at': ['first_contact', 'contact_date', 'outreach_date', 'first_touch'],
  'hired_at': ['hire_date', 'start_date', 'onboard_date', 'date_hired',
    // iCIMS specific
    'hire_rehire_date'],
  'offer_extended_at': ['offer_date', 'offer_sent', 'date_offered',
    // iCIMS specific
    'last_offer_offer_routed_for_approval'],
  'offer_accepted_at': ['acceptance_date', 'offer_accepted', 'date_accepted',
    // iCIMS specific
    'last_offer_received_signed_offer_letter'],

  // Event fields
  'event_id': ['activity_id', 'action_id', 'id'],
  'event_type': ['activity_type', 'action_type', 'type', 'action'],
  'event_at': ['activity_date', 'action_date', 'timestamp', 'date', 'created_at'],
  'actor_user_id': ['actor', 'performed_by', 'created_by', 'owner', 'actor_id'],
  'from_stage': ['previous_stage', 'old_stage', 'from_status'],
  'to_stage': ['new_stage', 'next_stage', 'to_status'],

  // User fields
  'user_id': ['employee_id', 'person_id', 'id', 'icims_user_id'],
  'name': ['full_name', 'display_name', 'employee_name', 'user_name'],
  'role': ['user_role', 'job_role', 'type', 'user_type'],
  'team': ['group', 'department', 'org'],
  'manager_user_id': ['manager', 'reports_to', 'supervisor_id'],
  'email': ['email_address', 'work_email',
    // iCIMS specific
    'person_primary_email', 'person_secondary_email']
};

// ===== iCIMS INTERVIEW/STAGE TIMESTAMP COLUMNS =====
// These columns contain timestamps for when candidates reached specific stages
// Used to generate events for HM analytics

const ICIMS_STAGE_COLUMNS: Array<{ column: string; stage: string; eventType?: string }> = [
  // Phone Screen stages
  { column: 'last_interview_phone_screen_scheduled', stage: 'Phone Screen Scheduled' },
  { column: 'last_interview_phone_screen_staffing_qualified_sent_to_hiring_manager_hm', stage: 'Submitted to HM' },
  { column: 'last_interview_phone_screen_staffing_not_selected', stage: 'Phone Screen: Not Selected' },
  { column: 'last_interview_phone_screen_hiring_manager', stage: 'HM Phone Screen' },
  { column: 'last_interview_phone_screen_hiring_manager_not_selected', stage: 'HM Phone Screen: Not Selected' },

  // Interview stages
  { column: 'last_interview_1st_round_interview', stage: '1st Round Interview' },
  { column: 'last_interview_2nd_round_interview', stage: '2nd Round Interview' },
  { column: 'last_interview_final_interview', stage: 'Final Interview' },
  { column: 'last_interview_interviewed_not_selected', stage: 'Interview: Not Selected' },
  { column: 'last_interview_candidate_withdrew', stage: 'Candidate Withdrew' },

  // Offer stages
  { column: 'last_offer_launch_offer_wizard', stage: 'Offer Wizard Started' },
  { column: 'last_offer_offer_details_complete', stage: 'Offer Details Complete' },
  { column: 'last_offer_offer_routed_for_approval', stage: 'Offer Approval' },
  { column: 'last_offer_received_signed_offer_letter', stage: 'Offer Accepted' },
  { column: 'last_offer_offer_declined_rejected', stage: 'Offer Declined' },
  { column: 'last_offer_offer_rescinded', stage: 'Offer Rescinded' },
  { column: 'last_offer_new_hire_onboarding_details_sent', stage: 'Onboarding Started' },
  { column: 'last_offer_background_check_initiated_c', stage: 'Background Check Started' },
  { column: 'last_offer_background_check_completed', stage: 'Background Check Completed' },

  // Hired/Onboarding stages
  { column: 'last_hired_begin_onboarding_u_s_portal', stage: 'Onboarding: US' },
  { column: 'last_hired_begin_onboarding_international', stage: 'Onboarding: International' },
  { column: 'last_hired_onboarding_completed', stage: 'Onboarding Completed' },
  { column: 'last_hired_closed_requisition', stage: 'Hired: Req Closed' },
];

// PII detection keywords for security auditing
const SENSITIVE_PII_KEYWORDS = [
  'ssn', 'social_security', 'dob', 'birth', 'address', 'residential',
  'salary', 'comp_', 'compensation', 'bank', 'routing', 'account_number',
  'passport', 'visa_number', 'phone_number', 'mobile', 'cell'
];

// Source channel mapping for iCIMS
const ICIMS_SOURCE_COLUMNS = [
  { column: 'last_resume_submissions_recruiter', source: 'Recruiter' },
  { column: 'last_resume_submissions_external_portal', source: 'External Portal' },
  { column: 'last_resume_submissions_internal_portal', source: 'Internal' },
  { column: 'last_resume_submissions_employee_referral', source: 'Referral' },
  { column: 'last_resume_submissions_indeed_apply', source: 'Indeed' },
  { column: 'last_resume_submissions_linkedin', source: 'LinkedIn' },
  { column: 'last_resume_submissions_vendor_portal', source: 'Agency' },
];

function normalizeColumnName(header: string): string {
  // Remove BOM and other invisible characters, trim, lowercase
  const normalized = header
    .replace(/[^\x20-\x7E]/g, '') // Remove non-printable characters including BOM
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_') // Replace all special chars with a single underscore
    .replace(/_+/g, '_');      // Collapse multiple underscores to one

  // Check if it matches a known alias
  for (const [canonical, aliases] of Object.entries(COLUMN_ALIASES)) {
    // Check canonical or any alias - normalize the aliases too for perfect matching
    if (normalized === canonical || aliases.some(a => a.replace(/_+/g, '_') === normalized)) {
      return canonical;
    }
  }

  return normalized;
}

/**
 * Helper to find a value in a raw row object, checking prefixes and suffixed versions (e.g. req_id, req_id_1)
 */
function fuzzyGet(raw: any, key: string): string | undefined {
  if (raw[key] && raw[key].trim()) return raw[key].trim();

  // Check common suffixes (Papaparse appends _1, _2 etc for duplicates)
  for (let i = 1; i <= 10; i++) {
    const suffixed = `${key}_${i}`;
    if (raw[suffixed] && raw[suffixed].trim()) return raw[suffixed].trim();
  }

  return undefined;
}

// ===== CSV COLUMN VALIDATION =====

// Reduced required columns - only truly essential fields
const REQUISITION_REQUIRED_COLS = [
  'req_id' // Just the ID is strictly required, others can be inferred or defaulted
];

const CANDIDATE_REQUIRED_COLS = [
  'candidate_id', 'req_id', 'current_stage'
];

const EVENT_REQUIRED_COLS = [
  'event_id', 'req_id', 'event_type', 'event_at'
];

const USER_REQUIRED_COLS = [
  'user_id', 'name'
];

function validateColumns(headers: string[], requiredCols: string[], entityType: string): string[] {
  const missing = requiredCols.filter(col => !headers.includes(col));
  if (missing.length > 0) {
    return [`${entityType}: Missing required columns: ${missing.join(', ')}`];
  }
  return [];
}

// ===== PARSE REQUISITIONS =====

export function parseRequisitions(csvContent: string): ParseResult<Requisition> {
  const result = Papa.parse<RawRequisition>(csvContent, {
    header: true,
    skipEmptyLines: true,
    transformHeader: normalizeColumnName
  });

  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];
  const requisitions: Requisition[] = [];

  // Validate columns
  if (result.meta.fields) {
    const colErrors = validateColumns(result.meta.fields, REQUISITION_REQUIRED_COLS, 'Requisitions');
    if (colErrors.length > 0) {
      return {
        data: [],
        errors: [{ row: 0, field: 'columns', message: colErrors[0], value: '' }],
        warnings: [],
        rowCount: result.data.length,
        successCount: 0
      };
    }
  }

  const seenIds = new Set<string>();

  result.data.forEach((raw, index) => {
    const row = index + 2; // +2 for header and 1-based indexing

    // Validate unique ID
    if (!raw.req_id || raw.req_id.trim() === '') {
      errors.push({ row, field: 'req_id', message: 'Missing required field', value: '' });
      return;
    }
    if (seenIds.has(raw.req_id)) {
      errors.push({ row, field: 'req_id', message: 'Duplicate ID', value: raw.req_id });
      return;
    }
    seenIds.add(raw.req_id);

    // Parse dates
    const openedAtResult = parseDate(raw.opened_at, 'opened_at', row);
    if (openedAtResult.error) {
      errors.push(openedAtResult.error);
      return;
    }
    if (!openedAtResult.date) {
      errors.push({ row, field: 'opened_at', message: 'Required date field is empty', value: '' });
      return;
    }

    const closedAtResult = parseDate(raw.closed_at, 'closed_at', row);
    if (closedAtResult.error) {
      warnings.push(closedAtResult.error);
    }

    // Parse enums
    const statusResult = validateEnum(raw.status, Object.values(RequisitionStatus), 'status', row);
    if (statusResult.warning) warnings.push(statusResult.warning);

    const locationTypeResult = validateEnum(raw.location_type, Object.values(LocationType), 'location_type', row, LocationType.Remote);
    if (locationTypeResult.warning) warnings.push(locationTypeResult.warning);

    const regionResult = validateEnum(raw.location_region, Object.values(LocationRegion), 'location_region', row, LocationRegion.AMER);
    if (regionResult.warning) warnings.push(regionResult.warning);

    const headcountResult = validateEnum(raw.headcount_type, Object.values(HeadcountType), 'headcount_type', row, HeadcountType.New);
    if (headcountResult.warning) warnings.push(headcountResult.warning);

    const priorityResult = validateEnum(raw.priority, Object.values(Priority), 'priority', row);
    if (priorityResult.warning) warnings.push(priorityResult.warning);

    requisitions.push({
      req_id: raw.req_id.trim(),
      req_title: raw.req_title?.trim() || '',
      function: raw.function?.trim() || '',
      job_family: raw.job_family?.trim() || '',
      level: raw.level?.trim() || '',
      location_type: locationTypeResult.value as LocationType,
      location_region: regionResult.value as LocationRegion,
      location_city: raw.location_city?.trim() || null,
      comp_band_min: parseNumber(raw.comp_band_min),
      comp_band_max: parseNumber(raw.comp_band_max),
      opened_at: openedAtResult.date,
      closed_at: closedAtResult.date,
      status: statusResult.value as RequisitionStatus,
      hiring_manager_id: raw.hiring_manager_id?.trim() || '',
      recruiter_id: raw.recruiter_id?.trim() || '',
      business_unit: raw.business_unit?.trim() || null,
      headcount_type: headcountResult.value as HeadcountType,
      priority: priorityResult.value as Priority || null,
      candidate_slate_required: parseBoolean(raw.candidate_slate_required),
      search_firm_used: parseBoolean(raw.search_firm_used)
    });
  });

  return {
    data: requisitions,
    errors,
    warnings,
    rowCount: result.data.length,
    successCount: requisitions.length
  };
}

// ===== PARSE CANDIDATES =====

export function parseCandidates(csvContent: string): ParseResult<Candidate> {
  const result = Papa.parse<RawCandidate>(csvContent, {
    header: true,
    skipEmptyLines: true,
    transformHeader: normalizeColumnName
  });

  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];
  const candidates: Candidate[] = [];

  if (result.meta.fields) {
    const colErrors = validateColumns(result.meta.fields, CANDIDATE_REQUIRED_COLS, 'Candidates');
    if (colErrors.length > 0) {
      return {
        data: [],
        errors: [{ row: 0, field: 'columns', message: colErrors[0], value: '' }],
        warnings: [],
        rowCount: result.data.length,
        successCount: 0
      };
    }
  }

  const seenIds = new Set<string>();

  result.data.forEach((raw, index) => {
    const row = index + 2;

    if (!raw.candidate_id || raw.candidate_id.trim() === '') {
      errors.push({ row, field: 'candidate_id', message: 'Missing required field', value: '' });
      return;
    }
    if (seenIds.has(raw.candidate_id)) {
      errors.push({ row, field: 'candidate_id', message: 'Duplicate ID', value: raw.candidate_id });
      return;
    }
    seenIds.add(raw.candidate_id);

    const stageEnteredResult = parseDate(raw.current_stage_entered_at, 'current_stage_entered_at', row);
    if (stageEnteredResult.error) {
      warnings.push(stageEnteredResult.error);
    }
    // Use applied_at, or current date as fallback if stage_entered_at is missing
    const stageEnteredDate = stageEnteredResult.date;

    const appliedAtResult = parseDate(raw.applied_at, 'applied_at', row);
    if (appliedAtResult.error) warnings.push(appliedAtResult.error);

    const firstContactResult = parseDate(raw.first_contacted_at, 'first_contacted_at', row);
    if (firstContactResult.error) warnings.push(firstContactResult.error);

    const hiredAtResult = parseDate(raw.hired_at, 'hired_at', row);
    if (hiredAtResult.error) warnings.push(hiredAtResult.error);

    const offerExtResult = parseDate(raw.offer_extended_at, 'offer_extended_at', row);
    if (offerExtResult.error) warnings.push(offerExtResult.error);

    const offerAccResult = parseDate(raw.offer_accepted_at, 'offer_accepted_at', row);
    if (offerAccResult.error) warnings.push(offerAccResult.error);

    const sourceResult = validateEnum(raw.source, Object.values(CandidateSource), 'source', row, CandidateSource.Other);
    if (sourceResult.warning) warnings.push(sourceResult.warning);

    const dispResult = validateEnum(raw.disposition, Object.values(CandidateDisposition), 'disposition', row, CandidateDisposition.Active);
    if (dispResult.warning) warnings.push(dispResult.warning);

    candidates.push({
      candidate_id: raw.candidate_id.trim(),
      name: raw.candidate_name?.trim() || null,
      req_id: raw.req_id?.trim() || '',
      source: sourceResult.value as CandidateSource,
      applied_at: appliedAtResult.date,
      first_contacted_at: firstContactResult.date,
      current_stage: raw.current_stage?.trim() || 'Unknown',
      current_stage_entered_at: stageEnteredDate || appliedAtResult.date || null,  // STRICT: null if no date, never fabricate
      disposition: dispResult.value as CandidateDisposition,
      hired_at: hiredAtResult.date,
      offer_extended_at: offerExtResult.date,
      offer_accepted_at: offerAccResult.date
    });
  });

  return {
    data: candidates,
    errors,
    warnings,
    rowCount: result.data.length,
    successCount: candidates.length
  };
}

// ===== PARSE EVENTS =====

export function parseEvents(csvContent: string): ParseResult<Event> {
  const result = Papa.parse<RawEvent>(csvContent, {
    header: true,
    skipEmptyLines: true,
    transformHeader: normalizeColumnName
  });

  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];
  const events: Event[] = [];

  if (result.meta.fields) {
    const colErrors = validateColumns(result.meta.fields, EVENT_REQUIRED_COLS, 'Events');
    if (colErrors.length > 0) {
      return {
        data: [],
        errors: [{ row: 0, field: 'columns', message: colErrors[0], value: '' }],
        warnings: [],
        rowCount: result.data.length,
        successCount: 0
      };
    }
  }

  const seenIds = new Set<string>();

  result.data.forEach((raw, index) => {
    const row = index + 2;

    if (!raw.event_id || raw.event_id.trim() === '') {
      errors.push({ row, field: 'event_id', message: 'Missing required field', value: '' });
      return;
    }
    if (seenIds.has(raw.event_id)) {
      errors.push({ row, field: 'event_id', message: 'Duplicate ID', value: raw.event_id });
      return;
    }
    seenIds.add(raw.event_id);

    const eventAtResult = parseDate(raw.event_at, 'event_at', row);
    if (eventAtResult.error) {
      errors.push(eventAtResult.error);
      return;
    }
    if (!eventAtResult.date) {
      errors.push({ row, field: 'event_at', message: 'Required date field is empty', value: '' });
      return;
    }

    const eventTypeResult = validateEnum(raw.event_type, Object.values(EventType), 'event_type', row);
    if (eventTypeResult.warning) warnings.push(eventTypeResult.warning);

    events.push({
      event_id: raw.event_id.trim(),
      candidate_id: raw.candidate_id?.trim() || '',
      req_id: raw.req_id?.trim() || '',
      event_type: eventTypeResult.value as EventType,
      from_stage: raw.from_stage?.trim() || null,
      to_stage: raw.to_stage?.trim() || null,
      actor_user_id: raw.actor_user_id?.trim() || '',
      event_at: eventAtResult.date,
      metadata_json: raw.metadata_json || null
    });
  });

  return {
    data: events,
    errors,
    warnings,
    rowCount: result.data.length,
    successCount: events.length
  };
}

// ===== PARSE USERS =====

export function parseUsers(csvContent: string): ParseResult<User> {
  const result = Papa.parse<RawUser>(csvContent, {
    header: true,
    skipEmptyLines: true,
    transformHeader: normalizeColumnName
  });

  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];
  const users: User[] = [];

  if (result.meta.fields) {
    const colErrors = validateColumns(result.meta.fields, USER_REQUIRED_COLS, 'Users');
    if (colErrors.length > 0) {
      return {
        data: [],
        errors: [{ row: 0, field: 'columns', message: colErrors[0], value: '' }],
        warnings: [],
        rowCount: result.data.length,
        successCount: 0
      };
    }
  }

  const seenIds = new Set<string>();

  result.data.forEach((raw, index) => {
    const row = index + 2;

    if (!raw.user_id || raw.user_id.trim() === '') {
      errors.push({ row, field: 'user_id', message: 'Missing required field', value: '' });
      return;
    }
    if (seenIds.has(raw.user_id)) {
      errors.push({ row, field: 'user_id', message: 'Duplicate ID', value: raw.user_id });
      return;
    }
    seenIds.add(raw.user_id);

    const roleResult = validateEnum(raw.role, Object.values(UserRole), 'role', row);
    if (roleResult.warning) warnings.push(roleResult.warning);

    users.push({
      user_id: raw.user_id.trim(),
      name: raw.name?.trim() || '',
      role: roleResult.value as UserRole,
      team: raw.team?.trim() || null,
      manager_user_id: raw.manager_user_id?.trim() || null,
      email: raw.email?.trim() || null
    });
  });

  return {
    data: users,
    errors,
    warnings,
    rowCount: result.data.length,
    successCount: users.length
  };
}

// ===== FULL CSV IMPORT =====

// ===== UNIVERSAL CSV PARSING =====

export function parseUniversalCsv(csvContent: string): CsvImportResult {
  // Track duplicate headers
  const headerCounts = new Map<string, number>();
  const detectedPiiColumns: string[] = [];

  const result = Papa.parse<any>(csvContent, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header: string) => {
      const normalized = normalizeColumnName(header);

      // Check for unintended PII columns
      if (SENSITIVE_PII_KEYWORDS.some(kw => normalized.includes(kw))) {
        // Only flag if it's NOT a required/allowed column (like comp_band)
        const allowed = ['comp_band_min', 'comp_band_max', 'visa_status'];
        if (!allowed.includes(normalized)) {
          detectedPiiColumns.push(header);
        }
      }

      // Handle duplicates by appending suffix
      const count = headerCounts.get(normalized) || 0;
      headerCounts.set(normalized, count + 1);

      if (count > 0) {
        console.log(`Duplicate header found and renamed: ${header} -> ${normalized}_${count}`);
        return `${normalized}_${count}`;
      }
      return normalized;
    }
  });

  // Log parsed headers for debugging
  console.log('Detected Universal CSV format');
  console.log('Parsed headers:', result.meta.fields?.slice(0, 20), '... and', (result.meta.fields?.length || 0) - 20, 'more');

  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  // Add PII Warning if detected
  if (detectedPiiColumns.length > 0) {
    warnings.push({
      row: 0,
      field: 'security',
      message: `Sensitive PII columns detected: ${detectedPiiColumns.join(', ')}. Ensure this data should be stored according to your privacy policy.`,
      value: ''
    });
    console.warn('PII Warning during import:', detectedPiiColumns);
  }

  // Data stores
  const requisitionsMap = new Map<string, Requisition>();
  const candidatesMap = new Map<string, Candidate>();
  const usersMap = new Map<string, User>();
  const events: Event[] = [];

  // Helper to get or create user
  const getOrCreateUser = (name: string | undefined | null, role: UserRole): string => {
    if (!name || name.trim() === '') return '';
    const userId = name.toLowerCase().replace(/[^a-z0-9]/g, '_');

    if (!usersMap.has(userId)) {
      usersMap.set(userId, {
        user_id: userId,
        name: name.trim(),
        role: role,
        team: null,
        manager_user_id: null,
        email: null
      });
    }
    return userId;
  };

  // Track processing errors
  let processedRows = 0;
  let skippedRows = 0;

  result.data.forEach((raw, index) => {
    const row = index + 2;

    try {
      // 1. Identify IDs (Use fuzzyGet to handle suffixed columns like req_id_1)
      const reqId = fuzzyGet(raw, 'req_id');
      const candidateId = fuzzyGet(raw, 'candidate_id');

      if (!reqId) {
        skippedRows++;
        return; // Skip rows without Job ID
      }

      processedRows++;

      // 2. Parse Requisition (if new)
      if (!requisitionsMap.has(reqId)) {
        // Dates - STRICT: no fabrication, use null if missing
        const openedAtResult = parseDate(fuzzyGet(raw, 'opened_at'), 'opened_at', row);
        // Fallback: Use applied_at of first candidate if opened_at missing, but never fabricate
        const fallbackDate = parseDate(fuzzyGet(raw, 'applied_at'), 'applied_at', row).date;

        // Users
        const recruiterId = getOrCreateUser(fuzzyGet(raw, 'recruiter_id') || fuzzyGet(raw, 'recruiter'), UserRole.Recruiter);
        const hmId = getOrCreateUser(fuzzyGet(raw, 'hiring_manager_id') || fuzzyGet(raw, 'hiring_manager') || fuzzyGet(raw, 'manager'), UserRole.HiringManager);

        // Enums
        const statusRes = validateEnum(fuzzyGet(raw, 'status'), Object.values(RequisitionStatus), 'status', row, RequisitionStatus.Open);
        const locTypeRes = validateEnum(fuzzyGet(raw, 'location_type'), Object.values(LocationType), 'location_type', row, LocationType.Remote);
        const regionRes = validateEnum(fuzzyGet(raw, 'location_region'), Object.values(LocationRegion), 'location_region', row, LocationRegion.AMER);

        requisitionsMap.set(reqId, {
          req_id: reqId,
          req_title: fuzzyGet(raw, 'req_title') || 'Untitled Requisition',
          function: fuzzyGet(raw, 'function') || 'Other',
          job_family: fuzzyGet(raw, 'job_family') || 'General',
          level: fuzzyGet(raw, 'level') || 'IC',
          location_type: locTypeRes.value as LocationType,
          location_region: regionRes.value as LocationRegion,
          location_city: fuzzyGet(raw, 'location_city') || null,
          comp_band_min: parseNumber(fuzzyGet(raw, 'comp_band_min')),
          comp_band_max: parseNumber(fuzzyGet(raw, 'comp_band_max')),
          opened_at: openedAtResult.date || fallbackDate || null, // STRICT: null if missing, never fabricate
          closed_at: parseDate(fuzzyGet(raw, 'closed_at'), 'closed_at', row).date,
          status: statusRes.value as RequisitionStatus,
          hiring_manager_id: hmId,
          recruiter_id: recruiterId,
          business_unit: fuzzyGet(raw, 'business_unit') || null,
          headcount_type: HeadcountType.New, // Default
          priority: Priority.P2, // Default
          candidate_slate_required: false,
          search_firm_used: false
        });
      }

      // 3. Parse Candidate (if present and new)
      if (candidateId && !candidatesMap.has(candidateId)) {
        // Try to find applied date - check iCIMS source columns first
        let appliedDate: Date | null = null;
        let detectedSource: CandidateSource = CandidateSource.Other;

        // Check iCIMS source columns to find earliest submission and source
        for (const srcCol of ICIMS_SOURCE_COLUMNS) {
          const colValue = fuzzyGet(raw, srcCol.column);
          if (colValue) {
            const srcDate = parseDate(colValue, srcCol.column, row).date;
            if (srcDate && (!appliedDate || srcDate < appliedDate)) {
              appliedDate = srcDate;
              // Map source name to enum
              if (srcCol.source === 'Recruiter') detectedSource = CandidateSource.Sourced;
              else if (srcCol.source === 'Referral') detectedSource = CandidateSource.Referral;
              else if (srcCol.source === 'Internal') detectedSource = CandidateSource.Internal;
              else if (srcCol.source === 'LinkedIn') detectedSource = CandidateSource.Sourced;
              else if (srcCol.source === 'Indeed') detectedSource = CandidateSource.Inbound;
              else if (srcCol.source === 'Agency') detectedSource = CandidateSource.Agency;
              else detectedSource = CandidateSource.Inbound;
            }
          }
        }

        // Fallback to applied_at column if no source columns had data
        // STRICT: null if missing, never fabricate dates
        if (!appliedDate) {
          const appliedAtValue = fuzzyGet(raw, 'applied_at');
          const appliedAtRes = parseDate(appliedAtValue, 'applied_at', row);
          appliedDate = appliedAtRes.date || null;
        }

        // If explicit source column exists, use that
        const sourceRes = validateEnum(fuzzyGet(raw, 'source'), Object.values(CandidateSource), 'source', row, detectedSource);
        const dispRes = validateEnum(fuzzyGet(raw, 'disposition'), Object.values(CandidateDisposition), 'disposition', row, CandidateDisposition.Active);

        const currentStage = fuzzyGet(raw, 'current_stage') || 'Applied';
        const enterStageDate = parseDate(fuzzyGet(raw, 'current_stage_entered_at'), 'current_stage_entered_at', row).date || appliedDate;

        candidatesMap.set(candidateId, {
          candidate_id: candidateId,
          name: fuzzyGet(raw, 'candidate_name') || null,
          req_id: reqId,
          source: sourceRes.value as CandidateSource,
          applied_at: appliedDate,
          first_contacted_at: parseDate(fuzzyGet(raw, 'first_contacted_at'), 'first_contacted_at', row).date,
          current_stage: currentStage,
          current_stage_entered_at: enterStageDate,
          disposition: dispRes.value as CandidateDisposition,
          hired_at: parseDate(fuzzyGet(raw, 'hired_at'), 'hired_at', row).date,
          offer_extended_at: parseDate(fuzzyGet(raw, 'offer_extended_at'), 'offer_extended_at', row).date,
          offer_accepted_at: parseDate(fuzzyGet(raw, 'offer_accepted_at'), 'offer_accepted_at', row).date
        });

        // 4. Generate Inferred Events

        // Event 1: Application
        events.push({
          event_id: `evt_app_${candidateId}`,
          candidate_id: candidateId,
          req_id: reqId,
          event_type: EventType.STAGE_CHANGE, // Or a generic 'APPLIED' type if we had one, but STAGE_CHANGE to 'Applied' works
          from_stage: null,
          to_stage: 'Application',
          actor_user_id: 'system',
          event_at: appliedDate!,  // appliedDate checked above in if block
          metadata_json: null
        });

        // Event 2: Current Stage (if different from application)
        if (currentStage.toLowerCase() !== 'application' && currentStage.toLowerCase() !== 'applied' && enterStageDate) {
          events.push({
            event_id: `evt_stage_${candidateId}_curr`,
            candidate_id: candidateId,
            req_id: reqId,
            event_type: EventType.STAGE_CHANGE,
            from_stage: 'Application', // Inferred
            to_stage: currentStage,
            actor_user_id: 'system',
            event_at: enterStageDate,
            metadata_json: null
          });
        }

        // 5. Generate Events from iCIMS timestamp columns
        // Each stage column contains a timestamp for when candidate reached that stage
        const stageEvents: Array<{ stage: string; date: Date }> = [];

        for (const stageCol of ICIMS_STAGE_COLUMNS) {
          const colValue = fuzzyGet(raw, stageCol.column);
          if (colValue) {
            const stageDate = parseDate(colValue, stageCol.column, row).date;
            if (stageDate) {
              stageEvents.push({ stage: stageCol.stage, date: stageDate });
            }
          }
        }

        // Sort stage events by date and generate events
        stageEvents.sort((a, b) => a.date.getTime() - b.date.getTime());

        let previousStage = 'Application';
        stageEvents.forEach((se, idx) => {
          events.push({
            event_id: `evt_icims_${candidateId}_${idx}`,
            candidate_id: candidateId,
            req_id: reqId,
            event_type: EventType.STAGE_CHANGE,
            from_stage: previousStage,
            to_stage: se.stage,
            actor_user_id: 'system',
            event_at: se.date,
            metadata_json: JSON.stringify({ source: 'icims_timestamp' })
          });
          previousStage = se.stage;
        });

        // Update candidate's current stage to the latest stage from timestamps
        if (stageEvents.length > 0) {
          const latestStage = stageEvents[stageEvents.length - 1];
          const candidate = candidatesMap.get(candidateId);
          if (candidate && (!candidate.current_stage_entered_at || latestStage.date > candidate.current_stage_entered_at)) {
            candidate.current_stage = latestStage.stage;
            candidate.current_stage_entered_at = latestStage.date;
          }
        }
      }
    } catch (rowError) {
      console.error(`Error processing row ${row}:`, rowError);
      errors.push({
        row,
        field: 'parsing',
        message: rowError instanceof Error ? rowError.message : 'Unknown parsing error',
        value: ''
      });
    }
  });

  console.log(`CSV Import: Processed ${processedRows} rows, skipped ${skippedRows} rows without req_id`);
  console.log(`Results: ${requisitionsMap.size} reqs, ${candidatesMap.size} candidates, ${usersMap.size} users, ${events.length} events`);


  return {
    requisitions: {
      data: Array.from(requisitionsMap.values()),
      errors: [],
      warnings: [],
      rowCount: result.data.length,
      successCount: requisitionsMap.size
    },
    candidates: {
      data: Array.from(candidatesMap.values()),
      errors: [],
      warnings: [],
      rowCount: result.data.length,
      successCount: candidatesMap.size
    },
    users: {
      data: Array.from(usersMap.values()),
      errors: [],
      warnings: [],
      rowCount: result.data.length,
      successCount: usersMap.size
    },
    events: {
      data: events,
      errors: [],
      warnings: [],
      rowCount: events.length,
      successCount: events.length
    },
    isValid: true,
    criticalErrors: []
  };
}


// ===== FULL CSV IMPORT =====

export function importCsvData(
  requisitionsCsv: string,
  candidatesCsv?: string,
  eventsCsv?: string,
  usersCsv?: string
): CsvImportResult {

  // DETECT MODE: iCIMS Single-File vs Universal vs Multi-File
  // We peek at the ORIGINAL headers (not normalized) to detect iCIMS format
  const rawPreview = Papa.parse(requisitionsCsv, { preview: 1, header: true });
  const rawHeaders = rawPreview.meta.fields || [];

  // Check for iCIMS Submittal Export format (has characteristic columns like "Last Interview:", "Last Resume Submissions:")
  const hasICIMSColumns = rawHeaders.some(h => h.startsWith('Last Resume Submissions:')) ||
                          rawHeaders.some(h => h.startsWith('Last Interview:')) ||
                          rawHeaders.some(h => h.includes('Job : Requisition ID'));

  if (hasICIMSColumns) {
    console.log(`Detected iCIMS Submittal Export format (${rawHeaders.length} columns)`);
    // Use the specialized iCIMS parser
    const { parseICIMSSingleFile } = require('./icimsParser');
    const icimsResult = parseICIMSSingleFile(requisitionsCsv);

    console.log(`iCIMS Import Stats:`, icimsResult.stats);
    if (icimsResult.warnings.length > 0) {
      console.warn(`iCIMS Import Warnings:`, icimsResult.warnings);
    }

    // Convert iCIMS result to CsvImportResult format
    return {
      requisitions: {
        data: icimsResult.requisitions,
        errors: [],
        warnings: icimsResult.warnings.map((w: string, i: number) => ({ row: i, field: 'general', message: w, value: '' })),
        rowCount: icimsResult.stats.totalRows,
        successCount: icimsResult.requisitions.length
      },
      candidates: {
        data: icimsResult.candidates,
        errors: [],
        warnings: [],
        rowCount: icimsResult.stats.totalRows,
        successCount: icimsResult.candidates.length
      },
      events: {
        data: icimsResult.events,
        errors: [],
        warnings: [],
        rowCount: icimsResult.stats.eventsGenerated,
        successCount: icimsResult.events.length
      },
      users: {
        data: icimsResult.users,
        errors: [],
        warnings: [],
        rowCount: icimsResult.users.length,
        successCount: icimsResult.users.length
      },
      isValid: true,
      criticalErrors: []
    };
  }

  // Continue with normalized headers for other detection
  const preview = Papa.parse(requisitionsCsv, { preview: 1, header: true, transformHeader: normalizeColumnName });
  const headers = preview.meta.fields || [];

  // Look for ID columns in headers, ignoring Papaparse's _1, _2 suffixes
  const hasJobId = headers.some(h => h === 'req_id' || h.startsWith('req_id_'));
  const hasPersonId = headers.some(h => h === 'candidate_id' || h.startsWith('candidate_id_'));
  const columnCount = headers.length;

  // If we have BOTH Job ID and Person ID in the "Requisitions" file, it's likely a Universal Report
  // Also assume it's universal if it has a lot of columns (iCIMS has 90+) and only one file provided
  const isUniversal = (hasJobId && hasPersonId) || (columnCount > 20 && (!candidatesCsv || candidatesCsv.length < 10));

  if (isUniversal) {
    console.log(`Detected Universal CSV format (${columnCount} columns, hasJobId: ${hasJobId}, hasPersonId: ${hasPersonId})`);
    return parseUniversalCsv(requisitionsCsv);
  }

  // FALLBACK: Standard Multi-File Parse
  const requisitions = parseRequisitions(requisitionsCsv);

  // Optional files - parse if present, else empty
  const candidates = candidatesCsv ? parseCandidates(candidatesCsv) : { data: [], errors: [], warnings: [], rowCount: 0, successCount: 0 };
  const events = eventsCsv ? parseEvents(eventsCsv) : { data: [], errors: [], warnings: [], rowCount: 0, successCount: 0 };
  const users = usersCsv ? parseUsers(usersCsv) : { data: [], errors: [], warnings: [], rowCount: 0, successCount: 0 };

  const criticalErrors: string[] = [];

  // Check for critical errors (Requisitions are always required)
  if (requisitions.errors.length > 0 && requisitions.successCount === 0) {
    criticalErrors.push(`Requisitions: ${requisitions.errors[0].message}`);
  }

  // Validation: Just warns now, doesn't block if optional files are missing
  return {
    requisitions,
    candidates,
    events,
    users,
    isValid: criticalErrors.length === 0,
    criticalErrors
  };
}
