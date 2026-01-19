// Import Diagnostics Service
// Tracks column mapping and data quality during CSV imports

export interface ColumnMapping {
  originalName: string;
  normalizedName: string;
  mappedTo: string | null;  // Our canonical field name, or null if unmapped
  sampleValues: string[];   // First 3 non-empty values
  nonEmptyCount: number;
  totalCount: number;
  coverage: number;         // Percentage of non-empty values
}

export interface EntityDiagnostics {
  entityType: 'requisitions' | 'candidates' | 'events' | 'users';
  sourceFile?: string;
  rowCount: number;
  columnMappings: ColumnMapping[];
  mappedColumns: string[];      // Columns that mapped to our schema
  unmappedColumns: string[];    // Columns we couldn't map
  missingIdealColumns: string[];// Columns we'd like but didn't find
  synthesizedIds: number;       // How many IDs were auto-generated
  fieldCoverage: Record<string, { filled: number; total: number; coverage: number }>;
}

export interface ImportDiagnostics {
  importedAt: Date;
  requisitions: EntityDiagnostics | null;
  candidates: EntityDiagnostics | null;
  events: EntityDiagnostics | null;
  users: EntityDiagnostics | null;
  overallHealth: {
    totalRecords: number;
    totalMappedColumns: number;
    totalUnmappedColumns: number;
    criticalMissing: string[];  // Fields that are really important but missing
  };
}

// Column aliases from csvParser (duplicated here for diagnostics)
const COLUMN_ALIASES: Record<string, string[]> = {
  // Requisition fields
  'req_id': ['job_id', 'requisition_id', 'job_number', 'position_id', 'icims_id', 'posting_id',
    'job_requisition_id', 'job__requisition_id', 'job_requisition', 'requisition', 'req',
    'id', 'job', 'position', 'opening_id', 'vacancy_id', 'posting', 'job_posting_id'],
  'req_title': ['job_title', 'position_title', 'title', 'job_name', 'position_name',
    'job_job_title_and_job_code', 'job_job_title'],
  'function': ['department', 'business_function', 'org', 'organization', 'dept', 'job_department'],
  'job_family': ['job_category', 'category', 'job_type', 'family', 'role_family'],
  'level': ['job_level', 'grade', 'band', 'career_level', 'seniority', 'type'],
  'location_type': ['work_type', 'remote_status', 'workplace_type', 'work_location_type'],
  'location_region': ['region', 'geo', 'geography', 'area'],
  'location_city': ['city', 'office', 'location', 'office_location', 'job_office_location'],
  'opened_at': ['open_date', 'created_date', 'posted_date', 'start_date', 'date_opened', 'created_at'],
  'closed_at': ['close_date', 'filled_date', 'closed_date', 'date_closed', 'end_date'],
  'status': ['req_status', 'job_status', 'state', 'requisition_status'],
  'hiring_manager_id': ['hiring_manager', 'hm_id', 'manager_id', 'hm', 'manager',
    'hiring_manager_full_name_first_last'],
  'recruiter_id': ['recruiter', 'assigned_recruiter', 'owner', 'owner_id', 'ta_owner',
    'recruiter_full_name_first_last'],
  'headcount_type': ['position_type', 'hc_type', 'requisition_type', 'req_type'],
  'priority': ['urgency', 'req_priority'],
  'business_unit': ['bu', 'division', 'org_unit', 'job_business_unit'],

  // Candidate fields
  'candidate_id': ['person_id', 'applicant_id', 'profile_id', 'candidate', 'person_system_id'],
  'candidate_name': ['person_full_name_first_last', 'applicant_name', 'full_name', 'name'],
  'candidate_email': ['email', 'applicant_email', 'contact_email', 'personal_email'],
  'source': ['candidate_source', 'origin', 'source_type', 'how_found'],
  'current_stage': ['stage', 'status', 'workflow_status', 'pipeline_stage', 'current_status'],
  'disposition': ['outcome', 'result', 'final_status', 'candidate_status'],
  'applied_at': ['application_date', 'apply_date', 'date_applied', 'submitted_date'],
  'hired_at': ['hire_date', 'start_date', 'onboard_date', 'date_hired', 'hire_rehire_date'],

  // Event fields
  'event_type': ['activity_type', 'action_type', 'type', 'action'],
  'event_at': ['activity_date', 'action_date', 'timestamp', 'date', 'created_at'],
  'actor_user_id': ['actor', 'performed_by', 'created_by', 'owner', 'actor_id'],

  // User fields
  'user_id': ['employee_id', 'person_id', 'id', 'icims_user_id'],
  'name': ['full_name', 'display_name', 'employee_name', 'user_name'],
  'role': ['user_role', 'job_role', 'type', 'user_type'],
};

// Ideal columns per entity type
const IDEAL_COLUMNS: Record<string, string[]> = {
  requisitions: ['req_id', 'req_title', 'recruiter_id', 'hiring_manager_id', 'status', 'opened_at'],
  candidates: ['candidate_id', 'req_id', 'candidate_name', 'current_stage', 'applied_at', 'source'],
  events: ['event_type', 'candidate_id', 'req_id', 'event_at'],
  users: ['user_id', 'name', 'role'],
};

function normalizeColumnName(header: string): string {
  return header
    .replace(/[^\x20-\x7E]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_');
}

function findCanonicalMapping(normalizedName: string): string | null {
  // Check if it directly matches a canonical name
  if (COLUMN_ALIASES[normalizedName]) {
    return normalizedName;
  }

  // Check aliases
  for (const [canonical, aliases] of Object.entries(COLUMN_ALIASES)) {
    if (aliases.some(a => normalizeColumnName(a) === normalizedName)) {
      return canonical;
    }
  }

  return null;
}

/**
 * Analyze raw CSV data and generate diagnostics
 */
export function analyzeImportData(
  rawData: any[],
  entityType: 'requisitions' | 'candidates' | 'events' | 'users',
  sourceFile?: string
): EntityDiagnostics {
  if (!rawData || rawData.length === 0) {
    return {
      entityType,
      sourceFile,
      rowCount: 0,
      columnMappings: [],
      mappedColumns: [],
      unmappedColumns: [],
      missingIdealColumns: IDEAL_COLUMNS[entityType] || [],
      synthesizedIds: 0,
      fieldCoverage: {},
    };
  }

  // Get all column names from first row
  const firstRow = rawData[0];
  const originalColumns = Object.keys(firstRow);

  const columnMappings: ColumnMapping[] = [];
  const mappedColumns: string[] = [];
  const unmappedColumns: string[] = [];
  const fieldCoverage: Record<string, { filled: number; total: number; coverage: number }> = {};

  for (const originalName of originalColumns) {
    const normalizedName = normalizeColumnName(originalName);
    const mappedTo = findCanonicalMapping(normalizedName);

    // Count non-empty values and collect samples
    let nonEmptyCount = 0;
    const sampleValues: string[] = [];

    for (const row of rawData) {
      const value = row[originalName];
      if (value && String(value).trim()) {
        nonEmptyCount++;
        if (sampleValues.length < 3) {
          sampleValues.push(String(value).trim().slice(0, 50));
        }
      }
    }

    const coverage = rawData.length > 0 ? (nonEmptyCount / rawData.length) * 100 : 0;

    columnMappings.push({
      originalName,
      normalizedName,
      mappedTo,
      sampleValues,
      nonEmptyCount,
      totalCount: rawData.length,
      coverage,
    });

    if (mappedTo) {
      mappedColumns.push(mappedTo);
      fieldCoverage[mappedTo] = {
        filled: nonEmptyCount,
        total: rawData.length,
        coverage,
      };
    } else {
      unmappedColumns.push(originalName);
    }
  }

  // Find missing ideal columns
  const idealCols = IDEAL_COLUMNS[entityType] || [];
  const missingIdealColumns = idealCols.filter(col => !mappedColumns.includes(col));

  return {
    entityType,
    sourceFile,
    rowCount: rawData.length,
    columnMappings,
    mappedColumns,
    unmappedColumns,
    missingIdealColumns,
    synthesizedIds: 0, // Will be updated by parser
    fieldCoverage,
  };
}

// Storage key for diagnostics
const DIAGNOSTICS_KEY = 'proddash_import_diagnostics';

/**
 * Save import diagnostics to localStorage
 */
export function saveDiagnostics(diagnostics: ImportDiagnostics): void {
  try {
    localStorage.setItem(DIAGNOSTICS_KEY, JSON.stringify(diagnostics));
    console.log('[ImportDiagnostics] Saved diagnostics:', {
      reqs: diagnostics.requisitions?.rowCount || 0,
      cands: diagnostics.candidates?.rowCount || 0,
      events: diagnostics.events?.rowCount || 0,
      users: diagnostics.users?.rowCount || 0,
    });
  } catch (e) {
    console.error('[ImportDiagnostics] Failed to save:', e);
  }
}

/**
 * Load import diagnostics from localStorage
 */
export function loadDiagnostics(): ImportDiagnostics | null {
  try {
    const stored = localStorage.getItem(DIAGNOSTICS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      parsed.importedAt = new Date(parsed.importedAt);
      return parsed;
    }
  } catch (e) {
    console.error('[ImportDiagnostics] Failed to load:', e);
  }
  return null;
}

/**
 * Clear stored diagnostics
 */
export function clearDiagnostics(): void {
  localStorage.removeItem(DIAGNOSTICS_KEY);
}

/**
 * Create a summary of import health
 */
export function createDiagnosticsSummary(diagnostics: ImportDiagnostics): {
  score: number;
  issues: string[];
  warnings: string[];
} {
  const issues: string[] = [];
  const warnings: string[] = [];

  // Check requisitions
  if (!diagnostics.requisitions || diagnostics.requisitions.rowCount === 0) {
    issues.push('No requisitions data imported');
  } else {
    const reqDiag = diagnostics.requisitions;
    if (!reqDiag.mappedColumns.includes('req_id')) {
      warnings.push('Requisition IDs were auto-generated (no req_id column found)');
    }
    if (!reqDiag.mappedColumns.includes('opened_at')) {
      issues.push('Missing opened_at date - time-based filtering will not work');
    }
    if (!reqDiag.mappedColumns.includes('recruiter_id')) {
      warnings.push('No recruiter assignment column found');
    }
    if (reqDiag.unmappedColumns.length > 5) {
      warnings.push(`${reqDiag.unmappedColumns.length} columns could not be mapped`);
    }
  }

  // Check candidates
  if (!diagnostics.candidates || diagnostics.candidates.rowCount === 0) {
    warnings.push('No candidates data imported - pipeline analysis unavailable');
  } else {
    const candDiag = diagnostics.candidates;
    if (!candDiag.mappedColumns.includes('req_id')) {
      issues.push('Candidates missing req_id - cannot link to requisitions');
    }
    if (!candDiag.mappedColumns.includes('current_stage')) {
      warnings.push('No stage/status column found for candidates');
    }
  }

  // Calculate score
  let score = 100;
  score -= issues.length * 20;
  score -= warnings.length * 5;
  score = Math.max(0, Math.min(100, score));

  return { score, issues, warnings };
}
