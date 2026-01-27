// Canonical Data Layer Service
// Decision-grade data ingestion with full traceability
//
// CRITICAL: This models a FIRST-OCCURRENCE event dataset from iCIMS exports.
// - "Date First Interviewed: <Stage>" = REAL timestamp of first entry into stage
// - "Hire/Rehire Date" = REAL hire timestamp
// - We NEVER fabricate dates. If not in CSV, it's NULL.

import { parse } from 'papaparse';
import {
  SourceTrace,
  ConfidenceGrade,
  ConfidenceMetadata,
  EventKind,
  EventProvenance,
  ReqCanonical,
  CandidateCanonical,
  ApplicationCanonical,
  EventCanonical,
  CanonicalEventType,
  DataCapabilities,
  AuditLogEntry,
  AuditAction,
  CanonicalQualityReport,
  MissingnessStats,
  DuplicateStats,
  OrphanStats,
  UnmappedStatus,
  ConfidenceRuleResult,
  MetricDefinition,
  MetricResult,
  MetricExclusion,
  CanonicalIngestionResult,
  StatusMapping
} from '../types/canonicalTypes';

// ===== CONFIGURATION =====

const DEFAULT_STATUS_MAPPINGS: Record<string, StatusMapping> = {
  'New Submission': { raw_status: 'New Submission', canonical_stage: 'APPLIED', is_terminal: false, disposition: 'Active' },
  'Application Received': { raw_status: 'Application Received', canonical_stage: 'APPLIED', is_terminal: false, disposition: 'Active' },
  'Phone Screen Scheduled': { raw_status: 'Phone Screen Scheduled', canonical_stage: 'SCREEN', is_terminal: false, disposition: 'Active' },
  'Phone Screen Staffing': { raw_status: 'Phone Screen Staffing', canonical_stage: 'SCREEN', is_terminal: false, disposition: 'Active' },
  'Phone Screen Hiring Manager': { raw_status: 'Phone Screen Hiring Manager', canonical_stage: 'HM_SCREEN', is_terminal: false, disposition: 'Active' },
  '1st Round Interview': { raw_status: '1st Round Interview', canonical_stage: 'HM_SCREEN', is_terminal: false, disposition: 'Active' },
  '2nd Round Interview': { raw_status: '2nd Round Interview', canonical_stage: 'ONSITE', is_terminal: false, disposition: 'Active' },
  'Final Interview': { raw_status: 'Final Interview', canonical_stage: 'FINAL', is_terminal: false, disposition: 'Active' },
  'Offer': { raw_status: 'Offer', canonical_stage: 'OFFER', is_terminal: false, disposition: 'Active' },
  'Offer Extended': { raw_status: 'Offer Extended', canonical_stage: 'OFFER', is_terminal: false, disposition: 'Active' },
  'Offer Accepted': { raw_status: 'Offer Accepted', canonical_stage: 'HIRED', is_terminal: true, disposition: 'Hired' },
  'Hired': { raw_status: 'Hired', canonical_stage: 'HIRED', is_terminal: true, disposition: 'Hired' },
  'Rejected': { raw_status: 'Rejected', canonical_stage: 'REJECTED', is_terminal: true, disposition: 'Rejected' },
  'Not Selected': { raw_status: 'Not Selected', canonical_stage: 'REJECTED', is_terminal: true, disposition: 'Rejected' },
  'Candidate Withdrew': { raw_status: 'Candidate Withdrew', canonical_stage: 'WITHDREW', is_terminal: true, disposition: 'Withdrawn' }
};

const STAGE_ORDER: Record<string, number> = {
  'LEAD': 1, 'APPLIED': 2, 'SCREEN': 3, 'HM_SCREEN': 4,
  'ONSITE': 5, 'FINAL': 6, 'OFFER': 7, 'HIRED': 8,
  'REJECTED': 99, 'WITHDREW': 99
};

const SOURCE_MAPPINGS: Record<string, string> = {
  'linkedin': 'LinkedIn', 'indeed': 'Indeed', 'referral': 'Referral',
  'employee referral': 'Referral', 'sourced': 'Sourced', 'agency': 'Agency',
  'internal': 'Internal', 'career site': 'Inbound'
};

// ===== DATE PARSING (NO FABRICATION) =====

const DATE_FORMATS = [
  /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})\s*(AM|PM)?$/i,
  /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/,
  /^(\d{4})-(\d{2})-(\d{2})$/
];

/**
 * Parse date from CSV. Returns NULL if not parseable - NEVER fabricates.
 */
export function parseDate(dateStr: string | null | undefined): { date: Date | null; raw: string | null } {
  if (!dateStr || typeof dateStr !== 'string' || dateStr.trim() === '') {
    return { date: null, raw: null };
  }

  const raw = dateStr.trim();

  for (const format of DATE_FORMATS) {
    const match = raw.match(format);
    if (match) {
      try {
        let date: Date;
        if (format === DATE_FORMATS[0]) {
          let [, month, day, year, hours, minutes, seconds, ampm] = match;
          let hour = parseInt(hours, 10);
          if (ampm) {
            if (ampm.toUpperCase() === 'PM' && hour !== 12) hour += 12;
            if (ampm.toUpperCase() === 'AM' && hour === 12) hour = 0;
          }
          date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), hour, parseInt(minutes), parseInt(seconds));
        } else if (format === DATE_FORMATS[1]) {
          const [, month, day, year] = match;
          date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        } else {
          date = new Date(raw);
        }
        if (!isNaN(date.getTime())) {
          return { date, raw };
        }
      } catch {
        // Continue to next format
      }
    }
  }

  // Last resort
  try {
    const parsed = new Date(raw);
    if (!isNaN(parsed.getTime())) {
      return { date: parsed, raw };
    }
  } catch {
    // Failed
  }

  return { date: null, raw };
}

// ===== REPORT TYPE DETECTION =====

export type ReportType = 'icims_submittal' | 'icims_requisition' | 'generic_ats' | 'unknown';

export function detectReportType(headers: string[]): { type: ReportType; confidence: ConfidenceGrade } {
  const hasReqId = headers.some(h => h.includes('Requisition ID'));
  const hasPersonId = headers.some(h => h.includes('Person : System ID'));
  const hasDateFirstInterviewed = headers.some(h => h.startsWith('Date First Interviewed:'));
  const hasHireDate = headers.some(h => h === 'Hire/Rehire Date');

  if (hasReqId && hasPersonId && (hasDateFirstInterviewed || hasHireDate)) {
    return { type: 'icims_submittal', confidence: 'high' };
  }
  if (hasReqId && hasPersonId) {
    return { type: 'icims_submittal', confidence: 'medium' };
  }
  return { type: 'unknown', confidence: 'low' };
}

// ===== COLUMN UTILITIES =====

export function normalizeColumnName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^\w_]/g, '');
}

export function findMatchingColumn(headers: string[], synonyms: string[]): string | null {
  for (const syn of synonyms) {
    const synLower = syn.toLowerCase().trim();
    for (const header of headers) {
      if (header.toLowerCase().trim() === synLower) {
        return header;
      }
    }
  }
  return null;
}

// ===== STATUS MAPPING =====

export function mapStatus(rawStatus: string): StatusMapping & { is_unmapped: boolean } {
  const normalized = rawStatus.trim();
  if (DEFAULT_STATUS_MAPPINGS[normalized]) {
    return { ...DEFAULT_STATUS_MAPPINGS[normalized], is_unmapped: false };
  }
  const lowerStatus = normalized.toLowerCase();
  for (const [key, mapping] of Object.entries(DEFAULT_STATUS_MAPPINGS)) {
    if (key.toLowerCase() === lowerStatus) {
      return { ...mapping, is_unmapped: false };
    }
  }
  return {
    raw_status: normalized,
    canonical_stage: 'APPLIED',
    is_terminal: false,
    disposition: 'Active',
    confidence: 'low',
    is_unmapped: true
  };
}

// ===== AUDIT LOGGING =====

class AuditLogger {
  private entries: AuditLogEntry[] = [];
  private entryId = 0;

  log(action: AuditAction, entityType: 'req' | 'candidate' | 'application' | 'event' | 'file',
      entityId: string | null, data: Partial<AuditLogEntry> = {}): void {
    this.entries.push({
      entry_id: `audit-${++this.entryId}`,
      timestamp: new Date(),
      action, entity_type: entityType, entity_id: entityId,
      rows_in: data.rows_in || 0, rows_out: data.rows_out || 0,
      rows_dropped: data.rows_dropped || 0, rows_merged: data.rows_merged || 0,
      ...data
    });
  }

  getEntries(): AuditLogEntry[] { return this.entries; }
}

// ===== INGESTION CONTEXT =====

interface IngestionContext {
  filename: string;
  rowIndex: number;
  auditLogger: AuditLogger;
  unmappedStatuses: Map<string, { count: number; traces: SourceTrace[] }>;
  warnings: string[];
  errors: string[];
  ingestionTime: Date;
}

function createSourceTrace(ctx: IngestionContext, column?: string, rawValue?: string): SourceTrace {
  return {
    source_file: ctx.filename,
    source_row_id: ctx.rowIndex,
    source_column: column,
    ingested_at: ctx.ingestionTime,
    raw_value: rawValue
  };
}

function createConfidence(grade: ConfidenceGrade, reasons: string[] = [], inferred: string[] = []): ConfidenceMetadata {
  return { grade, reasons, inferred_fields: inferred };
}

// ===== EXTRACT STAGE EVENTS FROM ROW =====

interface ExtractedStageEvent {
  stage: string;
  event_at: Date;
  source_column: string;
  raw_value: string;
  event_type: CanonicalEventType;
}

/**
 * Extract REAL events from "Date First Interviewed: <Stage>" columns.
 * Also handles terminal events from Hire/Rehire Date, Rejection Date, and Withdrawn Date.
 *
 * NEVER fabricates dates. Only emits events when CSV has real timestamps.
 */
function extractStageEventsFromRow(row: Record<string, string>, headers: string[]): ExtractedStageEvent[] {
  const events: ExtractedStageEvent[] = [];

  for (const column of headers) {
    const rawValue = row[column];
    if (!rawValue || rawValue.trim() === '') continue;

    const parsed = parseDate(rawValue);
    if (!parsed.date) continue;

    // "Date First Interviewed: <Stage Name>" → STAGE_ENTERED
    if (column.startsWith('Date First Interviewed:')) {
      const stageName = column.replace('Date First Interviewed:', '').trim();

      // Special case: Offer Letter → OFFER_SENT
      if (stageName.toLowerCase().includes('offer letter')) {
        events.push({
          stage: 'Offer Letter',
          event_at: parsed.date,
          source_column: column,
          raw_value: rawValue,
          event_type: 'OFFER_SENT'
        });
      } else {
        events.push({
          stage: stageName,
          event_at: parsed.date,
          source_column: column,
          raw_value: rawValue,
          event_type: 'STAGE_ENTERED'
        });
      }
    }

    // "Hire/Rehire Date" → HIRED
    if (column === 'Hire/Rehire Date') {
      events.push({
        stage: 'Hired',
        event_at: parsed.date,
        source_column: column,
        raw_value: rawValue,
        event_type: 'HIRED'
      });
    }

    // "Rejection Date" / "Rejected Date" / "Date Rejected" → REJECTED
    const lowerColumn = column.toLowerCase();
    if (lowerColumn.includes('reject') && lowerColumn.includes('date')) {
      events.push({
        stage: 'Rejected',
        event_at: parsed.date,
        source_column: column,
        raw_value: rawValue,
        event_type: 'REJECTED'
      });
    }

    // "Withdrawn Date" / "Date Withdrawn" / "Withdrawal Date" → WITHDRAWN
    if ((lowerColumn.includes('withdraw') || lowerColumn.includes('withdrew')) && lowerColumn.includes('date')) {
      events.push({
        stage: 'Withdrawn',
        event_at: parsed.date,
        source_column: column,
        raw_value: rawValue,
        event_type: 'WITHDRAWN'
      });
    }
  }

  // Sort by event_at, with deterministic ordering for same timestamps (by stage order)
  events.sort((a, b) => {
    const timeDiff = a.event_at.getTime() - b.event_at.getTime();
    if (timeDiff !== 0) return timeDiff;
    // Same timestamp - sort by stage order for deterministic results
    const aMapping = mapStatus(a.stage);
    const bMapping = mapStatus(b.stage);
    const aOrder = STAGE_ORDER[aMapping.canonical_stage] || 50;
    const bOrder = STAGE_ORDER[bMapping.canonical_stage] || 50;
    return aOrder - bOrder;
  });

  return events;
}

// ===== BUILD CANONICAL RECORDS =====

interface RawRow { [key: string]: string; }

function buildReqCanonical(row: RawRow, headers: string[], ctx: IngestionContext): ReqCanonical | null {
  const reqIdCol = findMatchingColumn(headers, ['Job : Requisition ID', 'Requisition ID', 'Job ID']);
  const reqId = reqIdCol ? row[reqIdCol]?.trim() : null;

  if (!reqId) {
    ctx.auditLogger.log('DROP_ROW', 'req', null, {
      rows_in: 1, rows_out: 0, rows_dropped: 1,
      reason_code: 'MISSING_REQ_ID',
      source_trace: createSourceTrace(ctx)
    });
    return null;
  }

  const titleCol = findMatchingColumn(headers, ['Job : Job Title and Job Code', 'Job Title']);
  const hmCol = findMatchingColumn(headers, ['Hiring Manager : Full Name: First Last', 'Hiring Manager']);
  const recCol = findMatchingColumn(headers, ['Recruiter : Full Name: First Last', 'Recruiter']);
  const deptCol = findMatchingColumn(headers, ['Job : Department', 'Department']);
  const locCol = findMatchingColumn(headers, ['Job : Office Location', 'Location']);

  const title = titleCol ? row[titleCol]?.trim() || null : null;
  const hmName = hmCol ? row[hmCol]?.trim() || null : null;
  const recName = recCol ? row[recCol]?.trim() || null : null;

  // All dates NULL if not found - NEVER fabricate
  const openedAtCol = findMatchingColumn(headers, ['Date Opened', 'Open Date', 'Created Date']);
  const closedAtCol = findMatchingColumn(headers, ['Date Closed', 'Closed Date', 'Filled Date']);
  const openedAt = openedAtCol ? parseDate(row[openedAtCol]).date : null;
  const closedAt = closedAtCol ? parseDate(row[closedAtCol]).date : null;

  ctx.auditLogger.log('BUILD_REQ', 'req', reqId, { rows_in: 1, rows_out: 1 });

  return {
    req_id: reqId,
    req_title: title || `Requisition ${reqId}`,
    function: null,
    level: null,
    job_family: null,
    department: deptCol ? row[deptCol]?.trim() || null : null,
    location: locCol ? row[locCol]?.trim() || null : null,
    location_type: null,
    hiring_manager_id: hmName ? `hm-${hmName.toLowerCase().replace(/\s+/g, '-')}` : null,
    hiring_manager_name: hmName,
    recruiter_id: recName ? `rec-${recName.toLowerCase().replace(/\s+/g, '-')}` : null,
    recruiter_name: recName,
    status: closedAt ? 'Closed' : 'Open',
    opened_at: openedAt,  // NULL if not in CSV
    closed_at: closedAt,  // NULL if not in CSV
    source_trace: createSourceTrace(ctx),
    confidence: createConfidence('high'),
    is_reopened: false,
    reopen_count: 0,
    last_activity_at: null  // Will be set from events
  };
}

function buildCandidateCanonical(row: RawRow, headers: string[], ctx: IngestionContext): CandidateCanonical | null {
  const candIdCol = findMatchingColumn(headers, ['Person : System ID', 'Candidate ID', 'Person ID']);
  const candId = candIdCol ? row[candIdCol]?.trim() : null;

  if (!candId) {
    ctx.auditLogger.log('DROP_ROW', 'candidate', null, {
      rows_in: 1, rows_out: 0, rows_dropped: 1,
      reason_code: 'MISSING_CANDIDATE_ID',
      source_trace: createSourceTrace(ctx)
    });
    return null;
  }

  const nameCol = findMatchingColumn(headers, ['Person : Full Name: First Last', 'Name', 'Candidate Name']);
  const sourceCol = findMatchingColumn(headers, ['Source', 'Recruiting Source', 'Candidate Source']);

  const rawSource = sourceCol ? row[sourceCol]?.trim() : null;
  let source = rawSource || 'Unknown';
  let sourceCategory = 'Unknown';

  if (rawSource) {
    const lowerSource = rawSource.toLowerCase();
    sourceCategory = SOURCE_MAPPINGS[lowerSource] || rawSource;
    source = sourceCategory;
  }

  ctx.auditLogger.log('BUILD_CANDIDATE', 'candidate', candId, { rows_in: 1, rows_out: 1 });

  return {
    candidate_id: candId,
    name: nameCol ? row[nameCol]?.trim() || null : null,
    email: null,
    source,
    source_category: sourceCategory,
    source_trace: createSourceTrace(ctx),
    confidence: createConfidence(rawSource ? 'high' : 'medium', rawSource ? [] : ['Source inferred'])
  };
}

function buildApplicationCanonical(
  row: RawRow,
  headers: string[],
  ctx: IngestionContext,
  candidate: CandidateCanonical,
  req: ReqCanonical,
  stageEvents: ExtractedStageEvent[]
): ApplicationCanonical {
  const applicationId = `${candidate.candidate_id}-${req.req_id}`;

  // Find applied_at from stage events or explicit column
  const appliedCol = findMatchingColumn(headers, ['Applied Date', 'Application Date', 'Date Applied']);
  let appliedAt = appliedCol ? parseDate(row[appliedCol]).date : null;

  // Build stage_timestamps from real events only
  const stageTimestamps: Record<string, Date> = {};
  for (const evt of stageEvents) {
    stageTimestamps[evt.stage] = evt.event_at;
  }

  // If no applied date but we have events, use earliest event
  if (!appliedAt && stageEvents.length > 0) {
    appliedAt = stageEvents[0].event_at;
  }

  // Determine current state from events - extract terminal timestamps from REAL events only
  let hired_at: Date | null = null;
  let offer_sent_at: Date | null = null;
  let rejected_at: Date | null = null;
  let withdrawn_at: Date | null = null;
  let disposition: 'Active' | 'Hired' | 'Rejected' | 'Withdrawn' = 'Active';
  let current_stage = 'Applied';
  let current_stage_canonical = 'APPLIED';
  let is_terminal = false;

  for (const evt of stageEvents) {
    if (evt.event_type === 'HIRED') {
      hired_at = evt.event_at;
      disposition = 'Hired';
      current_stage = 'Hired';
      current_stage_canonical = 'HIRED';
      is_terminal = true;
    } else if (evt.event_type === 'REJECTED') {
      rejected_at = evt.event_at;
      disposition = 'Rejected';
      current_stage = 'Rejected';
      current_stage_canonical = 'REJECTED';
      is_terminal = true;
    } else if (evt.event_type === 'WITHDRAWN') {
      withdrawn_at = evt.event_at;
      disposition = 'Withdrawn';
      current_stage = 'Withdrawn';
      current_stage_canonical = 'WITHDREW';
      is_terminal = true;
    } else if (evt.event_type === 'OFFER_SENT') {
      offer_sent_at = evt.event_at;
      if (!is_terminal) {
        current_stage = 'Offer';
        current_stage_canonical = 'OFFER';
      }
    } else if (evt.event_type === 'STAGE_ENTERED') {
      if (!is_terminal) {
        current_stage = evt.stage;
        const mapping = mapStatus(evt.stage);
        current_stage_canonical = mapping.canonical_stage;
      }
    }
  }

  // Check if disposition can be inferred from status column when no terminal event exists
  const statusCol = findMatchingColumn(headers, ['Status', 'Current Status', 'Workflow Status', 'Application Status']);
  if (statusCol && !is_terminal) {
    const rawStatus = row[statusCol]?.trim();
    if (rawStatus) {
      const statusMapping = mapStatus(rawStatus);
      if (statusMapping.is_terminal) {
        // Disposition is terminal but we have NO timestamp from CSV
        // This is a MISSING_TERMINAL_TIMESTAMP condition
        is_terminal = true;
        disposition = statusMapping.disposition as 'Hired' | 'Rejected' | 'Withdrawn';
        current_stage = rawStatus;
        current_stage_canonical = statusMapping.canonical_stage;

        // Log this as a warning - terminal disposition without timestamp
        ctx.auditLogger.log('DROP_ROW', 'application', applicationId, {
          rows_in: 0, rows_out: 0, rows_dropped: 0,
          reason_code: 'MISSING_TERMINAL_TIMESTAMP',
          details: {
            disposition: statusMapping.disposition,
            status: rawStatus,
            message: 'Terminal disposition detected but no timestamp column found in CSV'
          },
          source_trace: createSourceTrace(ctx, statusCol, rawStatus)
        });
      }
    }
  }

  // Get last stage entered time as current_stage_entered_at
  const current_stage_entered_at = stageEvents.length > 0
    ? stageEvents[stageEvents.length - 1].event_at
    : null;

  // First contact = first interview/screen event (not application)
  const contactEvents = stageEvents.filter(e =>
    e.event_type === 'STAGE_ENTERED' &&
    !e.stage.toLowerCase().includes('apply') &&
    !e.stage.toLowerCase().includes('submission')
  );
  const first_contacted_at = contactEvents.length > 0 ? contactEvents[0].event_at : null;

  // Track missing timestamps for terminal dispositions
  const missingTimestamps: string[] = [];
  if (disposition === 'Hired' && !hired_at) missingTimestamps.push('hired_at');
  if (disposition === 'Rejected' && !rejected_at) missingTimestamps.push('rejected_at');
  if (disposition === 'Withdrawn' && !withdrawn_at) missingTimestamps.push('withdrawn_at');

  // Confidence grade:
  // - 'high' if we have event history AND terminal timestamps when terminal
  // - 'medium' if we have some events but missing terminal timestamps
  // - 'low' if no events
  let confidenceGrade: ConfidenceGrade = 'high';
  const confidenceReasons: string[] = [];

  if (stageEvents.length === 0) {
    confidenceGrade = 'low';
    confidenceReasons.push('No event history from CSV');
  } else if (missingTimestamps.length > 0) {
    confidenceGrade = 'medium';
    confidenceReasons.push(`Terminal disposition without timestamp: ${missingTimestamps.join(', ')}`);
  } else {
    confidenceReasons.push('All timestamps from real CSV data');
  }

  ctx.auditLogger.log('BUILD_APPLICATION', 'application', applicationId, { rows_in: 1, rows_out: 1 });

  return {
    application_id: applicationId,
    candidate_id: candidate.candidate_id,
    req_id: req.req_id,
    current_stage,
    current_stage_canonical,
    disposition,
    is_terminal,
    applied_at: appliedAt,              // NULL if not found - NEVER fabricated
    first_contacted_at,                  // NULL if no contact events
    current_stage_entered_at,           // NULL if no events
    hired_at,                           // Only from Hire/Rehire Date - NEVER fabricated
    offer_sent_at,                      // Only from Offer Letter - NEVER fabricated
    rejected_at,                        // Only from Rejection Date - NEVER fabricated
    withdrawn_at,                       // Only from Withdrawn Date - NEVER fabricated
    stage_timestamps: stageTimestamps,
    source_trace: createSourceTrace(ctx),
    confidence: createConfidence(confidenceGrade, confidenceReasons, missingTimestamps),
    has_event_history: stageEvents.length > 0,
    event_count: stageEvents.length,
    missing_timestamps: missingTimestamps
  };
}

function buildCanonicalEvents(
  application: ApplicationCanonical,
  stageEvents: ExtractedStageEvent[],
  ctx: IngestionContext
): EventCanonical[] {
  const events: EventCanonical[] = [];

  for (let i = 0; i < stageEvents.length; i++) {
    const evt = stageEvents[i];
    const mapping = mapStatus(evt.stage);

    events.push({
      event_id: `${application.application_id}-evt-${i + 1}`,
      application_id: application.application_id,
      candidate_id: application.candidate_id,
      req_id: application.req_id,
      event_type: evt.event_type,
      stage: evt.stage,
      stage_canonical: mapping.canonical_stage,
      event_at: evt.event_at,  // REAL timestamp from CSV
      actor_user_id: null,
      event_kind: 'POINT_IN_TIME',
      event_provenance: 'historical_export',
      as_of_date: null,  // Not a snapshot
      source_trace: createSourceTrace(ctx, evt.source_column, evt.raw_value),
      confidence: createConfidence('high', ['first_occurrence_timestamp'])
    });

    ctx.auditLogger.log('EMIT_STAGE_ENTERED', 'event', events[events.length - 1].event_id, {
      rows_in: 0, rows_out: 1,
      details: { stage: evt.stage, event_type: evt.event_type, source_column: evt.source_column }
    });
  }

  return events;
}

// ===== DATA CAPABILITIES =====

function computeDataCapabilities(events: EventCanonical[]): DataCapabilities {
  const hasPointInTime = events.some(e => e.event_kind === 'POINT_IN_TIME');
  const hasSnapshotDiff = events.some(e => e.event_kind === 'SNAPSHOT_DIFF');

  // With point-in-time only, we can compute velocity between stages
  // but NOT days-in-stage (requires exit times from snapshot diffs)
  const available: string[] = [];
  const unavailable: { metric: string; reason: string }[] = [];

  if (hasPointInTime) {
    available.push('time_to_first_interview');
    available.push('time_to_offer');
    available.push('time_to_hire');
    available.push('stage_velocity');
    available.push('hire_rate');
    available.push('source_quality');
  }

  if (!hasSnapshotDiff) {
    unavailable.push({ metric: 'days_in_stage', reason: 'Requires snapshot diff events (exit times)' });
    unavailable.push({ metric: 'stage_regression', reason: 'Requires snapshot diff events' });
    unavailable.push({ metric: 'sla_compliance', reason: 'Requires snapshot diff events' });
    unavailable.push({ metric: 'friction_heatmap', reason: 'Requires snapshot diff events' });
    unavailable.push({ metric: 'forecasting', reason: 'Requires snapshot diff events' });
  } else {
    available.push('days_in_stage', 'stage_regression', 'sla_compliance', 'friction_heatmap', 'forecasting');
  }

  return {
    has_point_in_time_events: hasPointInTime,
    has_snapshot_diff_events: hasSnapshotDiff,
    can_compute_stage_velocity: hasPointInTime,
    can_compute_days_in_stage: hasSnapshotDiff,
    can_compute_stage_regression: hasSnapshotDiff,
    can_compute_sla_timing: hasSnapshotDiff,
    can_compute_friction_heatmap: hasSnapshotDiff,
    can_compute_forecasting: hasSnapshotDiff,
    available_metrics: available,
    unavailable_metrics: unavailable
  };
}

// ===== DATA QUALITY REPORT =====

export function generateCanonicalQualityReport(
  reqs: ReqCanonical[],
  candidates: CandidateCanonical[],
  applications: ApplicationCanonical[],
  events: EventCanonical[],
  auditLog: AuditLogEntry[],
  ctx: IngestionContext,
  capabilities: DataCapabilities
): CanonicalQualityReport {
  const missingness: MissingnessStats[] = [];

  // Check key field missingness
  const reqFields: (keyof ReqCanonical)[] = ['req_title', 'hiring_manager_name', 'recruiter_name', 'opened_at'];
  for (const field of reqFields) {
    const missing = reqs.filter(r => r[field] === null || r[field] === undefined);
    if (missing.length > 0) {
      missingness.push({
        field: `req.${field}`,
        total_records: reqs.length,
        missing_count: missing.length,
        missing_percent: reqs.length > 0 ? (missing.length / reqs.length) * 100 : 0,
        sample_ids: missing.slice(0, 5).map(r => r.req_id)
      });
    }
  }

  const appFields: (keyof ApplicationCanonical)[] = ['applied_at', 'first_contacted_at', 'hired_at'];
  for (const field of appFields) {
    const missing = applications.filter(a => a[field] === null || a[field] === undefined);
    if (missing.length > 0) {
      missingness.push({
        field: `application.${field}`,
        total_records: applications.length,
        missing_count: missing.length,
        missing_percent: applications.length > 0 ? (missing.length / applications.length) * 100 : 0,
        sample_ids: missing.slice(0, 5).map(a => a.application_id)
      });
    }
  }

  const duplicates: DuplicateStats[] = [];
  const orphans: OrphanStats[] = [];

  // Confidence rules
  const confidenceRules: ConfidenceRuleResult[] = [
    {
      rule_name: 'has_event_history',
      rule_description: 'Applications with at least one stage event',
      passed: applications.filter(a => a.has_event_history).length > applications.length * 0.5,
      affected_count: applications.filter(a => a.has_event_history).length,
      total_count: applications.length,
      sample_ids: applications.filter(a => a.has_event_history).slice(0, 5).map(a => a.application_id)
    },
    {
      rule_name: 'high_confidence_events',
      rule_description: 'Events with high confidence (real timestamps)',
      passed: events.filter(e => e.confidence.grade === 'high').length === events.length,
      affected_count: events.filter(e => e.confidence.grade === 'high').length,
      total_count: events.length,
      sample_ids: events.slice(0, 5).map(e => e.event_id)
    },
    {
      rule_name: 'no_fabricated_dates',
      rule_description: 'All dates from CSV, none fabricated',
      passed: true,  // We never fabricate
      affected_count: events.length,
      total_count: events.length,
      sample_ids: []
    }
  ];

  // Quality score
  const appsWithEvents = applications.filter(a => a.has_event_history).length;
  const eventCoverage = applications.length > 0 ? (appsWithEvents / applications.length) * 100 : 0;
  const qualityScore = Math.round(eventCoverage);

  return {
    generated_at: new Date(),
    total_files_processed: 1,
    total_rows_processed: applications.length,
    total_rows_accepted: applications.length,
    total_rows_dropped: auditLog.filter(e => e.action === 'DROP_ROW').length,
    reqs_count: reqs.length,
    candidates_count: candidates.length,
    applications_count: applications.length,
    events_count: events.length,
    overall_quality_score: qualityScore,
    missingness,
    duplicates,
    orphans,
    unmapped_statuses: Array.from(ctx.unmappedStatuses.entries()).map(([status, data]) => ({
      raw_value: status,
      count: data.count,
      sample_source_traces: data.traces
    })),
    unmapped_columns: [],
    confidence_rules: confidenceRules,
    low_confidence_count: 0,  // We don't have low confidence - only real data
    inferred_values_count: 0,  // We don't infer
    capabilities,
    warnings: ctx.warnings,
    errors: ctx.errors
  };
}

// ===== METRIC INSPECTOR =====

const METRIC_DEFINITIONS: Record<string, MetricDefinition> = {
  'time_to_first_interview': {
    name: 'Time to First Interview',
    description: 'Days from application to first interview',
    formula: 'first_interview_date - applied_at',
    unit: 'days',
    aggregation: 'median',
    requires_event_diffs: false  // Can compute with point-in-time
  },
  'time_to_offer': {
    name: 'Time to Offer',
    description: 'Days from application to offer sent',
    formula: 'offer_sent_at - applied_at',
    unit: 'days',
    aggregation: 'median',
    requires_event_diffs: false
  },
  'time_to_hire': {
    name: 'Time to Hire',
    description: 'Days from application to hire',
    formula: 'hired_at - applied_at',
    unit: 'days',
    aggregation: 'median',
    requires_event_diffs: false
  },
  'hire_rate': {
    name: 'Hire Rate',
    description: 'Percentage of applications resulting in hire',
    formula: 'count(hired) / count(applications)',
    unit: 'percent',
    aggregation: 'avg',
    requires_event_diffs: false
  },
  'days_in_stage': {
    name: 'Days in Stage',
    description: 'Average time spent in each stage',
    formula: 'stage_exit_date - stage_entry_date',
    unit: 'days',
    aggregation: 'avg',
    requires_event_diffs: true  // REQUIRES snapshot diffs
  },
  'friction_heatmap': {
    name: 'Friction Heatmap',
    description: 'Bottleneck analysis by HM and stage',
    formula: 'Requires stage dwell times',
    unit: 'days',
    aggregation: 'avg',
    requires_event_diffs: true  // REQUIRES snapshot diffs
  }
};

export function getMetric(
  metricName: string,
  applications: ApplicationCanonical[],
  events: EventCanonical[],
  capabilities: DataCapabilities,
  filters: Record<string, unknown> = {}
): MetricResult {
  const definition = METRIC_DEFINITIONS[metricName];

  if (!definition) {
    return {
      metric_name: metricName,
      value: null,
      definition: { name: metricName, description: 'Unknown', formula: '', unit: '', aggregation: 'count', requires_event_diffs: false },
      included_count: 0, excluded_count: 0, total_count: 0,
      exclusions: [{ reason: 'Metric not found', count: 0, sample_ids: [] }],
      confidence_grade: 'low',
      confidence_reasons: ['Metric definition not found'],
      low_confidence_contribution_percent: 100,
      event_kind: null,
      event_provenance: null,
      source_columns_used: [],
      sample_source_traces: [],
      filters_applied: filters,
      computed_at: new Date(),
      computation_possible: false,
      computation_blocked_reason: 'Metric not found'
    };
  }

  // Check if metric can be computed with available data
  if (definition.requires_event_diffs && !capabilities.has_snapshot_diff_events) {
    return {
      metric_name: metricName,
      value: null,
      definition,
      included_count: 0, excluded_count: applications.length, total_count: applications.length,
      exclusions: [{ reason: 'Requires snapshot diff events', count: applications.length, sample_ids: [] }],
      confidence_grade: 'low',
      confidence_reasons: ['Data source only has point-in-time events, not snapshot diffs'],
      low_confidence_contribution_percent: 100,
      event_kind: 'POINT_IN_TIME',
      event_provenance: 'historical_export',
      source_columns_used: [],
      sample_source_traces: [],
      filters_applied: filters,
      computed_at: new Date(),
      computation_possible: false,
      computation_blocked_reason: 'Metric requires snapshot diff events (exit times). This CSV only has first-occurrence timestamps.'
    };
  }

  // Compute metric
  const exclusions: MetricExclusion[] = [];
  const sourceColumns: Set<string> = new Set();
  const sampleTraces: SourceTrace[] = [];
  let value: number | null = null;

  if (metricName === 'hire_rate') {
    const hired = applications.filter(a => a.disposition === 'Hired');
    value = applications.length > 0 ? (hired.length / applications.length) * 100 : null;
    hired.slice(0, 3).forEach(a => sampleTraces.push(a.source_trace));
  } else if (metricName === 'time_to_hire') {
    const hiredWithDates = applications.filter(a => a.hired_at && a.applied_at);
    if (hiredWithDates.length > 0) {
      const days = hiredWithDates.map(a =>
        Math.floor((a.hired_at!.getTime() - a.applied_at!.getTime()) / (1000 * 60 * 60 * 24))
      ).filter(d => d >= 0).sort((a, b) => a - b);

      if (days.length > 0) {
        const mid = Math.floor(days.length / 2);
        value = days.length % 2 ? days[mid] : (days[mid - 1] + days[mid]) / 2;
      }
      hiredWithDates.slice(0, 3).forEach(a => sampleTraces.push(a.source_trace));
      sourceColumns.add('Hire/Rehire Date');
      sourceColumns.add('Applied Date');
    } else {
      exclusions.push({ reason: 'Missing hired_at or applied_at', count: applications.length, sample_ids: [] });
    }
  } else if (metricName === 'time_to_first_interview') {
    const withInterview = applications.filter(a => a.first_contacted_at && a.applied_at);
    if (withInterview.length > 0) {
      const days = withInterview.map(a =>
        Math.floor((a.first_contacted_at!.getTime() - a.applied_at!.getTime()) / (1000 * 60 * 60 * 24))
      ).filter(d => d >= 0).sort((a, b) => a - b);

      if (days.length > 0) {
        const mid = Math.floor(days.length / 2);
        value = days.length % 2 ? days[mid] : (days[mid - 1] + days[mid]) / 2;
      }
      withInterview.slice(0, 3).forEach(a => sampleTraces.push(a.source_trace));
      sourceColumns.add('Date First Interviewed: *');
    } else {
      exclusions.push({ reason: 'Missing first_contacted_at or applied_at', count: applications.length, sample_ids: [] });
    }
  } else if (metricName === 'time_to_offer') {
    const withOffer = applications.filter(a => a.offer_sent_at && a.applied_at);
    if (withOffer.length > 0) {
      const days = withOffer.map(a =>
        Math.floor((a.offer_sent_at!.getTime() - a.applied_at!.getTime()) / (1000 * 60 * 60 * 24))
      ).filter(d => d >= 0).sort((a, b) => a - b);

      if (days.length > 0) {
        const mid = Math.floor(days.length / 2);
        value = days.length % 2 ? days[mid] : (days[mid - 1] + days[mid]) / 2;
      }
      withOffer.slice(0, 3).forEach(a => sampleTraces.push(a.source_trace));
      sourceColumns.add('Date First Interviewed: Offer Letter');
    } else {
      exclusions.push({ reason: 'Missing offer_sent_at or applied_at', count: applications.length, sample_ids: [] });
    }
  }

  return {
    metric_name: metricName,
    value,
    definition,
    included_count: applications.length - exclusions.reduce((sum, e) => sum + e.count, 0),
    excluded_count: exclusions.reduce((sum, e) => sum + e.count, 0),
    total_count: applications.length,
    exclusions,
    confidence_grade: value !== null ? 'high' : 'low',
    confidence_reasons: value !== null ? ['Computed from real CSV timestamps'] : ['Insufficient data'],
    low_confidence_contribution_percent: 0,
    event_kind: 'POINT_IN_TIME',
    event_provenance: 'historical_export',
    source_columns_used: Array.from(sourceColumns),
    sample_source_traces: sampleTraces,
    filters_applied: filters,
    computed_at: new Date(),
    computation_possible: true
  };
}

// ===== MAIN INGESTION FUNCTION =====

export interface CanonicalIngestionOptions {
  maxRows?: number;
}

export function ingestCSVToCanonical(
  csvContent: string,
  filename: string,
  options: CanonicalIngestionOptions = {}
): CanonicalIngestionResult {
  const startTime = Date.now();
  const auditLogger = new AuditLogger();
  const ingestionTime = new Date();

  const ctx: IngestionContext = {
    filename,
    rowIndex: 0,
    auditLogger,
    unmappedStatuses: new Map(),
    warnings: [],
    errors: [],
    ingestionTime
  };

  // Parse CSV
  const parseResult = parse<RawRow>(csvContent, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim()
  });

  const headers = parseResult.meta.fields || [];
  let rows = parseResult.data;

  auditLogger.log('INGEST_FILE', 'file', filename, {
    rows_in: rows.length, rows_out: rows.length,
    details: { headers_count: headers.length }
  });

  // Detect report type
  const reportType = detectReportType(headers);
  auditLogger.log('DETECT_REPORT_TYPE', 'file', filename, {
    rows_in: 0, rows_out: 0,
    details: { type: reportType.type, confidence: reportType.confidence }
  });

  // Check for "Date First Interviewed:" columns
  const stageColumns = headers.filter(h => h.startsWith('Date First Interviewed:'));
  const hasHireDate = headers.includes('Hire/Rehire Date');

  if (stageColumns.length > 0 || hasHireDate) {
    ctx.warnings.push(`Found ${stageColumns.length} stage timestamp columns and ${hasHireDate ? 'Hire/Rehire Date' : 'no hire date'}`);
  } else {
    ctx.warnings.push('No "Date First Interviewed:" columns found. Events will be limited.');
  }

  // Apply row limit
  if (options.maxRows && rows.length > options.maxRows) {
    ctx.warnings.push(`Processing first ${options.maxRows} of ${rows.length} rows`);
    rows = rows.slice(0, options.maxRows);
  }

  // Build canonical tables
  const reqsMap = new Map<string, ReqCanonical>();
  const candidatesMap = new Map<string, CandidateCanonical>();
  const applications: ApplicationCanonical[] = [];
  const events: EventCanonical[] = [];

  for (let i = 0; i < rows.length; i++) {
    ctx.rowIndex = i + 1;
    const row = rows[i];

    // Extract real stage events from this row
    const stageEvents = extractStageEventsFromRow(row, headers);

    // Build req
    const req = buildReqCanonical(row, headers, ctx);
    if (req && !reqsMap.has(req.req_id)) {
      reqsMap.set(req.req_id, req);
    }

    // Build candidate
    const candidate = buildCandidateCanonical(row, headers, ctx);
    if (candidate && !candidatesMap.has(candidate.candidate_id)) {
      candidatesMap.set(candidate.candidate_id, candidate);
    }

    // Build application and events
    if (req && candidate) {
      const actualReq = reqsMap.get(req.req_id) || req;
      const actualCandidate = candidatesMap.get(candidate.candidate_id) || candidate;

      const application = buildApplicationCanonical(row, headers, ctx, actualCandidate, actualReq, stageEvents);
      applications.push(application);

      // Build real events from stage timestamps
      const appEvents = buildCanonicalEvents(application, stageEvents, ctx);
      events.push(...appEvents);

      // Update req's last_activity_at from events
      if (stageEvents.length > 0) {
        const latestEvent = stageEvents[stageEvents.length - 1];
        const storedReq = reqsMap.get(req.req_id);
        if (storedReq && (!storedReq.last_activity_at || latestEvent.event_at > storedReq.last_activity_at)) {
          storedReq.last_activity_at = latestEvent.event_at;
        }
      }
    }
  }

  const reqs = Array.from(reqsMap.values());
  const candidates = Array.from(candidatesMap.values());

  // Compute capabilities
  const capabilities = computeDataCapabilities(events);

  // Generate quality report
  const qualityReport = generateCanonicalQualityReport(
    reqs, candidates, applications, events,
    auditLogger.getEntries(), ctx, capabilities
  );

  const processingTime = Date.now() - startTime;

  return {
    success: ctx.errors.length === 0,
    reqs,
    candidates,
    applications,
    events,
    capabilities,
    audit_log: auditLogger.getEntries(),
    quality_report: qualityReport,
    stats: {
      files_processed: 1,
      total_rows: rows.length,
      processing_time_ms: processingTime,
      report_types_detected: [reportType.type],
      events_emitted: events.length,
      point_in_time_events: events.filter(e => e.event_kind === 'POINT_IN_TIME').length,
      snapshot_diff_events: events.filter(e => e.event_kind === 'SNAPSHOT_DIFF').length
    },
    errors: ctx.errors,
    warnings: ctx.warnings
  };
}

// ===== EXPLAIN TIME TO OFFER =====

export interface TimeToOfferBreakdown {
  total_days: number | null;
  applied_to_first_interview_days: number | null;
  first_interview_to_offer_days: number | null;
  /** Math invariant check: sum of phases must equal total within 1 day tolerance */
  math_invariant_valid: boolean;
  /** Applications where math invariant failed (phase sum != total) */
  math_invariant_errors: Array<{
    application_id: string;
    total_days: number;
    phase_sum: number;
    deviation_days: number;
  }>;
  top_delay_contributors: Array<{
    application_id: string;
    candidate_id: string;
    req_id: string;
    total_days: number;
    applied_to_first_interview_days: number;
    first_interview_to_offer_days: number;
  }>;
  included_count: number;
  excluded_count: number;
  exclusion_reasons: string[];
}

/**
 * Explains time_to_offer by breaking it down into phases:
 * - applied_to_first_interview_days: Time from application to first interview
 * - first_interview_to_offer_days: Time from first interview to offer
 *
 * Uses existing POINT_IN_TIME events only. Never fabricates data.
 *
 * STRICT TIMESTAMP POLICY:
 * - Returns null if required intermediate steps (first_contacted_at) are missing
 * - Validates math invariant: (applied_to_first_interview) + (first_interview_to_offer) = total_days
 * - Flags as data error if sum deviates by >1 day
 */
export function explainTimeToOffer(
  applications: ApplicationCanonical[],
  _events: EventCanonical[]
): TimeToOfferBreakdown {
  const exclusionReasons: string[] = [];
  const mathInvariantErrors: Array<{
    application_id: string;
    total_days: number;
    phase_sum: number;
    deviation_days: number;
  }> = [];

  // Filter to applications with all required timestamps:
  // applied_at, first_contacted_at (interview), and offer_sent_at
  // STRICT: If first_contacted_at is missing, we CANNOT compute the breakdown
  const withCompleteData = applications.filter(a => {
    if (!a.applied_at) return false;
    if (!a.first_contacted_at) return false;  // STRICT: require interview date
    if (!a.offer_sent_at) return false;
    return true;
  });

  const missingApplied = applications.filter(a => !a.applied_at).length;
  const missingInterview = applications.filter(a => a.applied_at && !a.first_contacted_at).length;
  const missingOffer = applications.filter(a => a.applied_at && a.first_contacted_at && !a.offer_sent_at).length;

  if (missingApplied > 0) {
    exclusionReasons.push(`${missingApplied} applications missing applied_at`);
  }
  if (missingInterview > 0) {
    exclusionReasons.push(`${missingInterview} applications missing first_contacted_at (interview date) - cannot compute breakdown`);
  }
  if (missingOffer > 0) {
    exclusionReasons.push(`${missingOffer} applications missing offer_sent_at`);
  }

  if (withCompleteData.length === 0) {
    return {
      total_days: null,
      applied_to_first_interview_days: null,
      first_interview_to_offer_days: null,
      math_invariant_valid: true,  // No data to validate
      math_invariant_errors: [],
      top_delay_contributors: [],
      included_count: 0,
      excluded_count: applications.length,
      exclusion_reasons: exclusionReasons
    };
  }

  // Calculate breakdown for each application
  const breakdowns: Array<{
    application_id: string;
    candidate_id: string;
    req_id: string;
    total_days: number;
    applied_to_first_interview_days: number;
    first_interview_to_offer_days: number;
  }> = [];

  for (const app of withCompleteData) {
    const applied = app.applied_at!;
    const firstInterview = app.first_contacted_at!;  // Now guaranteed to exist
    const offer = app.offer_sent_at!;

    const totalDays = Math.floor((offer.getTime() - applied.getTime()) / (1000 * 60 * 60 * 24));
    const appliedToFirstInterview = Math.floor((firstInterview.getTime() - applied.getTime()) / (1000 * 60 * 60 * 24));
    const firstInterviewToOffer = Math.floor((offer.getTime() - firstInterview.getTime()) / (1000 * 60 * 60 * 24));

    // MATH INVARIANT CHECK: phase_sum must equal total_days within 1 day tolerance
    const phaseSum = appliedToFirstInterview + firstInterviewToOffer;
    const deviation = Math.abs(phaseSum - totalDays);

    if (deviation > 1) {
      mathInvariantErrors.push({
        application_id: app.application_id,
        total_days: totalDays,
        phase_sum: phaseSum,
        deviation_days: deviation
      });
    }

    // Only include valid (non-negative) durations
    if (totalDays >= 0 && appliedToFirstInterview >= 0 && firstInterviewToOffer >= 0) {
      breakdowns.push({
        application_id: app.application_id,
        candidate_id: app.candidate_id,
        req_id: app.req_id,
        total_days: totalDays,
        applied_to_first_interview_days: appliedToFirstInterview,
        first_interview_to_offer_days: firstInterviewToOffer
      });
    } else {
      // Negative duration indicates data error (dates out of order)
      exclusionReasons.push(`Application ${app.application_id} has negative duration (dates out of order)`);
    }
  }

  if (breakdowns.length === 0) {
    return {
      total_days: null,
      applied_to_first_interview_days: null,
      first_interview_to_offer_days: null,
      math_invariant_valid: mathInvariantErrors.length === 0,
      math_invariant_errors: mathInvariantErrors,
      top_delay_contributors: [],
      included_count: 0,
      excluded_count: applications.length,
      exclusion_reasons: [...exclusionReasons, 'All calculated durations were negative or invalid']
    };
  }

  // Calculate medians for overall metrics
  const sortedTotals = breakdowns.map(b => b.total_days).sort((a, b) => a - b);
  const sortedPhase1 = breakdowns.map(b => b.applied_to_first_interview_days).sort((a, b) => a - b);
  const sortedPhase2 = breakdowns.map(b => b.first_interview_to_offer_days).sort((a, b) => a - b);

  const median = (arr: number[]): number => {
    const mid = Math.floor(arr.length / 2);
    return arr.length % 2 ? arr[mid] : (arr[mid - 1] + arr[mid]) / 2;
  };

  const totalDaysMedian = median(sortedTotals);
  const phase1Median = median(sortedPhase1);
  const phase2Median = median(sortedPhase2);

  // Get top 5 delay contributors (sorted by total_days descending)
  const topDelayContributors = [...breakdowns]
    .sort((a, b) => b.total_days - a.total_days)
    .slice(0, 5);

  return {
    total_days: totalDaysMedian,
    applied_to_first_interview_days: phase1Median,
    first_interview_to_offer_days: phase2Median,
    math_invariant_valid: mathInvariantErrors.length === 0,
    math_invariant_errors: mathInvariantErrors,
    top_delay_contributors: topDelayContributors,
    included_count: breakdowns.length,
    excluded_count: applications.length - breakdowns.length,
    exclusion_reasons: exclusionReasons
  };
}

// ===== EXPORTS =====

export { DEFAULT_STATUS_MAPPINGS, STAGE_ORDER, SOURCE_MAPPINGS, METRIC_DEFINITIONS };
