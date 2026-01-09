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
  'req_id': ['job_id', 'requisition_id', 'job_number', 'position_id', 'icims_id', 'posting_id'],
  'req_title': ['job_title', 'position_title', 'title', 'job_name', 'position_name'],
  'function': ['department', 'business_function', 'org', 'organization', 'dept'],
  'job_family': ['job_category', 'category', 'job_type', 'family', 'role_family'],
  'level': ['job_level', 'grade', 'band', 'career_level', 'seniority'],
  'location_type': ['work_type', 'remote_status', 'workplace_type', 'work_location_type'],
  'location_region': ['region', 'geo', 'geography', 'area'],
  'location_city': ['city', 'office', 'location', 'office_location'],
  'opened_at': ['open_date', 'created_date', 'posted_date', 'start_date', 'date_opened', 'created_at'],
  'closed_at': ['close_date', 'filled_date', 'closed_date', 'date_closed', 'end_date'],
  'status': ['req_status', 'job_status', 'state', 'requisition_status'],
  'hiring_manager_id': ['hiring_manager', 'hm_id', 'manager_id', 'hm', 'manager'],
  'recruiter_id': ['recruiter', 'assigned_recruiter', 'owner', 'owner_id', 'ta_owner'],
  'headcount_type': ['position_type', 'hc_type', 'requisition_type', 'req_type'],
  'priority': ['urgency', 'req_priority'],
  'business_unit': ['bu', 'division', 'org_unit'],

  // Candidate fields
  'candidate_id': ['person_id', 'applicant_id', 'profile_id', 'candidate'],
  'source': ['candidate_source', 'origin', 'source_type', 'how_found'],
  'current_stage': ['stage', 'status', 'workflow_status', 'pipeline_stage', 'current_status'],
  'current_stage_entered_at': ['stage_date', 'status_date', 'stage_entered', 'last_stage_change'],
  'disposition': ['outcome', 'result', 'final_status', 'candidate_status'],
  'applied_at': ['application_date', 'apply_date', 'date_applied', 'submitted_date'],
  'first_contacted_at': ['first_contact', 'contact_date', 'outreach_date', 'first_touch'],
  'hired_at': ['hire_date', 'start_date', 'onboard_date', 'date_hired'],
  'offer_extended_at': ['offer_date', 'offer_sent', 'date_offered'],
  'offer_accepted_at': ['acceptance_date', 'offer_accepted', 'date_accepted'],

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
  'email': ['email_address', 'work_email']
};

function normalizeColumnName(header: string): string {
  const normalized = header.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');

  // Check if it matches a known alias
  for (const [canonical, aliases] of Object.entries(COLUMN_ALIASES)) {
    if (normalized === canonical || aliases.includes(normalized)) {
      return canonical;
    }
  }

  return normalized;
}

// ===== CSV COLUMN VALIDATION =====

// Reduced required columns - only truly essential fields
const REQUISITION_REQUIRED_COLS = [
  'req_id', 'opened_at', 'status', 'recruiter_id'
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
      req_id: raw.req_id?.trim() || '',
      source: sourceResult.value as CandidateSource,
      applied_at: appliedAtResult.date,
      first_contacted_at: firstContactResult.date,
      current_stage: raw.current_stage?.trim() || 'Unknown',
      current_stage_entered_at: stageEnteredDate || appliedAtResult.date || new Date(),
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
  const result = Papa.parse<any>(csvContent, {
    header: true,
    skipEmptyLines: true,
    transformHeader: normalizeColumnName
  });

  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  // Data stores
  const requisitionsMap = new Map<string, Requisition>();
  const candidatesMap = new Map<string, Candidate>();
  const usersMap = new Map<string, User>();
  const events: Event[] = [];

  // Helper to get or create user
  const getOrCreateUser = (name: string, role: UserRole): string => {
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

  result.data.forEach((raw, index) => {
    const row = index + 2;

    // 1. Identify IDs
    const reqId = raw.req_id?.trim();
    const candidateId = raw.candidate_id?.trim();

    if (!reqId) return; // Skip rows without Job ID

    // 2. Parse Requisition (if new)
    if (!requisitionsMap.has(reqId)) {
      // Dates
      const openedAtResult = parseDate(raw.opened_at, 'opened_at', row);
      // Fallback: Use applied_at of first candidate if opened_at missing
      const fallbackDate = parseDate(raw.applied_at, 'applied_at', row).date || new Date();

      // Users
      const recruiterId = getOrCreateUser(raw.recruiter_id || raw.recruiter, UserRole.Recruiter);
      const hmId = getOrCreateUser(raw.hiring_manager_id || raw.hiring_manager || raw.manager, UserRole.HiringManager);

      // Enums
      const statusRes = validateEnum(raw.status, Object.values(RequisitionStatus), 'status', row, RequisitionStatus.Open);
      const locTypeRes = validateEnum(raw.location_type, Object.values(LocationType), 'location_type', row, LocationType.Remote);
      const regionRes = validateEnum(raw.location_region, Object.values(LocationRegion), 'location_region', row, LocationRegion.AMER);

      requisitionsMap.set(reqId, {
        req_id: reqId,
        req_title: raw.req_title?.trim() || 'Untitled Requisition',
        function: raw.function?.trim() || 'Other',
        job_family: raw.job_family?.trim() || 'General',
        level: raw.level?.trim() || 'IC',
        location_type: locTypeRes.value as LocationType,
        location_region: regionRes.value as LocationRegion,
        location_city: raw.location_city?.trim() || null,
        comp_band_min: parseNumber(raw.comp_band_min),
        comp_band_max: parseNumber(raw.comp_band_max),
        opened_at: openedAtResult.date || fallbackDate, // Infer date if missing
        closed_at: parseDate(raw.closed_at, 'closed_at', row).date,
        status: statusRes.value as RequisitionStatus,
        hiring_manager_id: hmId,
        recruiter_id: recruiterId,
        business_unit: raw.business_unit?.trim() || null,
        headcount_type: HeadcountType.New, // Default
        priority: Priority.P2, // Default
        candidate_slate_required: false,
        search_firm_used: false
      });
    }

    // 3. Parse Candidate (if present and new)
    if (candidateId && !candidatesMap.has(candidateId)) {
      const appliedAtRes = parseDate(raw.applied_at, 'applied_at', row);
      const appliedDate = appliedAtRes.date || new Date();

      const sourceRes = validateEnum(raw.source, Object.values(CandidateSource), 'source', row, CandidateSource.Other);
      const dispRes = validateEnum(raw.disposition, Object.values(CandidateDisposition), 'disposition', row, CandidateDisposition.Active);

      const currentStage = raw.current_stage?.trim() || 'Applied';
      const enterStageDate = parseDate(raw.current_stage_entered_at, 'current_stage_entered_at', row).date || appliedDate;

      candidatesMap.set(candidateId, {
        candidate_id: candidateId,
        req_id: reqId,
        source: sourceRes.value as CandidateSource,
        applied_at: appliedDate,
        first_contacted_at: parseDate(raw.first_contacted_at, 'first_contacted_at', row).date,
        current_stage: currentStage,
        current_stage_entered_at: enterStageDate,
        disposition: dispRes.value as CandidateDisposition,
        hired_at: parseDate(raw.hired_at, 'hired_at', row).date,
        offer_extended_at: parseDate(raw.offer_extended_at, 'offer_extended_at', row).date,
        offer_accepted_at: parseDate(raw.offer_accepted_at, 'offer_accepted_at', row).date
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
        event_at: appliedDate,
        metadata_json: null
      });

      // Event 2: Current Stage (if different from application)
      if (currentStage.toLowerCase() !== 'application' && currentStage.toLowerCase() !== 'applied') {
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
    }
  });

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

  // DETECT MODE: Universal vs Multi-File
  // We peek at the headers of the first file (requisitionsCsv)
  const preview = Papa.parse(requisitionsCsv, { preview: 1, header: true, transformHeader: normalizeColumnName });
  const headers = preview.meta.fields || [];

  const hasJobId = headers.includes('req_id');
  const hasPersonId = headers.includes('candidate_id');

  // If we have BOTH Job ID and Person ID in the "Requisitions" file, it's likely a Universal Report
  if (hasJobId && hasPersonId && (!candidatesCsv || candidatesCsv.length < 10)) {
    console.log('Detected Universal CSV format');
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
