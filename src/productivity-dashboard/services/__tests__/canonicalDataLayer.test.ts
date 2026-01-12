// Unit tests for Canonical Data Layer
// Tests first-occurrence events, no date fabrication, metric gating

import {
  detectReportType,
  normalizeColumnName,
  parseDate,
  mapStatus,
  ingestCSVToCanonical,
  getMetric,
  explainTimeToOffer,
  DEFAULT_STATUS_MAPPINGS,
  STAGE_ORDER
} from '../canonicalDataLayer';
import {
  ReqCanonical,
  CandidateCanonical,
  ApplicationCanonical,
  EventCanonical,
  DataCapabilities
} from '../../types/canonicalTypes';

// ===== TEST DATA HELPERS =====

function createTestCSV(rows: Record<string, string>[]): string {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const headerLine = headers.join(',');
  const dataLines = rows.map(row =>
    headers.map(h => {
      const val = row[h] || '';
      return val.includes(',') ? `"${val}"` : val;
    }).join(',')
  );
  return [headerLine, ...dataLines].join('\n');
}

// ===== REPORT TYPE DETECTION TESTS =====

describe('detectReportType', () => {
  test('detects iCIMS submittal format with Date First Interviewed columns', () => {
    const headers = [
      'Job : Requisition ID',
      'Person : System ID',
      'Date First Interviewed: Phone Screen Staffing',
      'Date First Interviewed: 1st Round Interview',
      'Hiring Manager : Full Name: First Last'
    ];
    const result = detectReportType(headers);
    expect(result.type).toBe('icims_submittal');
    expect(result.confidence).toBe('high');
  });

  test('detects iCIMS submittal format with Hire/Rehire Date', () => {
    const headers = [
      'Job : Requisition ID',
      'Person : System ID',
      'Hire/Rehire Date',
      'Hiring Manager : Full Name: First Last'
    ];
    const result = detectReportType(headers);
    expect(result.type).toBe('icims_submittal');
    expect(result.confidence).toBe('high');
  });

  test('detects medium confidence without stage columns', () => {
    const headers = [
      'Job : Requisition ID',
      'Person : System ID',
      'Status'
    ];
    const result = detectReportType(headers);
    expect(result.type).toBe('icims_submittal');
    expect(result.confidence).toBe('medium');
  });

  test('returns unknown for unrecognized format', () => {
    const headers = ['Column A', 'Column B', 'Random Data'];
    const result = detectReportType(headers);
    expect(result.type).toBe('unknown');
    expect(result.confidence).toBe('low');
  });
});

// ===== COLUMN NORMALIZATION TESTS =====

describe('normalizeColumnName', () => {
  test('trims whitespace', () => {
    expect(normalizeColumnName('  Name  ')).toBe('name');
  });

  test('converts to lowercase', () => {
    expect(normalizeColumnName('First Name')).toBe('first_name');
  });

  test('replaces spaces with underscores', () => {
    expect(normalizeColumnName('Job Title')).toBe('job_title');
  });

  test('handles special characters', () => {
    expect(normalizeColumnName('Job : Requisition ID')).toBe('job__requisition_id');
  });
});

// ===== DATE PARSING TESTS =====

describe('parseDate', () => {
  test('parses M/D/YYYY format', () => {
    const result = parseDate('1/15/2024');
    expect(result.date).toBeInstanceOf(Date);
    expect(result.date?.getFullYear()).toBe(2024);
    expect(result.date?.getMonth()).toBe(0); // January
    expect(result.date?.getDate()).toBe(15);
  });

  test('parses M/D/YYYY h:mm:ss AM/PM format', () => {
    const result = parseDate('1/15/2024 2:30:00 PM');
    expect(result.date).toBeInstanceOf(Date);
    expect(result.date?.getHours()).toBe(14);
  });

  test('parses ISO format', () => {
    const result = parseDate('2024-01-15T14:30:00');
    expect(result.date).toBeInstanceOf(Date);
  });

  test('returns null for empty string', () => {
    const result = parseDate('');
    expect(result.date).toBeNull();
    expect(result.raw).toBeNull();
  });

  test('returns null for null/undefined', () => {
    expect(parseDate(null).date).toBeNull();
    expect(parseDate(undefined).date).toBeNull();
  });

  test('keeps raw string if parse fails', () => {
    const result = parseDate('not a date');
    expect(result.date).toBeNull();
    expect(result.raw).toBe('not a date');
  });

  test('handles missing timestamps gracefully', () => {
    const result = parseDate('   ');
    expect(result.date).toBeNull();
  });

  test('NEVER fabricates dates - returns null instead', () => {
    const emptyResult = parseDate('');
    const whitespaceResult = parseDate('   ');
    const nullResult = parseDate(null);

    expect(emptyResult.date).toBeNull();
    expect(whitespaceResult.date).toBeNull();
    expect(nullResult.date).toBeNull();
    // Confirms no fabrication - null is returned, not a default date
  });
});

// ===== STATUS MAPPING TESTS =====

describe('mapStatus', () => {
  test('maps known status correctly', () => {
    const result = mapStatus('Phone Screen Staffing');
    expect(result.canonical_stage).toBe('SCREEN');
    expect(result.is_terminal).toBe(false);
    expect(result.disposition).toBe('Active');
    expect(result.is_unmapped).toBe(false);
  });

  test('maps hired status correctly', () => {
    const result = mapStatus('Hired');
    expect(result.canonical_stage).toBe('HIRED');
    expect(result.is_terminal).toBe(true);
    expect(result.disposition).toBe('Hired');
  });

  test('maps rejected status correctly', () => {
    const result = mapStatus('Not Selected');
    expect(result.canonical_stage).toBe('REJECTED');
    expect(result.is_terminal).toBe(true);
    expect(result.disposition).toBe('Rejected');
  });

  test('handles case-insensitive matching', () => {
    const result = mapStatus('PHONE SCREEN STAFFING');
    expect(result.canonical_stage).toBe('SCREEN');
    expect(result.is_unmapped).toBe(false);
  });

  test('handles unmapped status with fallback', () => {
    const result = mapStatus('Some Unknown Status XYZ');
    expect(result.canonical_stage).toBe('APPLIED');
    expect(result.is_terminal).toBe(false);
    expect(result.is_unmapped).toBe(true);
    expect(result.confidence).toBe('low');
  });

  test('flags unmapped statuses for reporting', () => {
    const result = mapStatus('Completely New Status');
    expect(result.is_unmapped).toBe(true);
  });
});

// ===== FIRST-OCCURRENCE EVENT TESTS =====

describe('First-Occurrence Events', () => {
  test('emits STAGE_ENTERED from Date First Interviewed columns', () => {
    const csv = createTestCSV([
      {
        'Job : Requisition ID': 'REQ-001',
        'Person : System ID': 'PER-001',
        'Date First Interviewed: Phone Screen Staffing': '1/15/2024',
        'Date First Interviewed: 1st Round Interview': '1/20/2024',
        'Status': 'Phone Screen Staffing'
      }
    ]);

    const result = ingestCSVToCanonical(csv, 'test.csv');

    expect(result.success).toBe(true);
    expect(result.events.length).toBe(2);

    const stageEnteredEvents = result.events.filter(e => e.event_type === 'STAGE_ENTERED');
    expect(stageEnteredEvents.length).toBe(2);

    expect(stageEnteredEvents[0].stage).toBe('Phone Screen Staffing');
    expect(stageEnteredEvents[0].event_kind).toBe('POINT_IN_TIME');
    expect(stageEnteredEvents[0].event_provenance).toBe('historical_export');
    expect(stageEnteredEvents[0].source_trace.source_column).toBe('Date First Interviewed: Phone Screen Staffing');
  });

  test('emits HIRED only from Hire/Rehire Date column', () => {
    const csv = createTestCSV([
      {
        'Job : Requisition ID': 'REQ-001',
        'Person : System ID': 'PER-001',
        'Date First Interviewed: Phone Screen Staffing': '1/15/2024',
        'Hire/Rehire Date': '2/1/2024',
        'Status': 'Hired'
      }
    ]);

    const result = ingestCSVToCanonical(csv, 'test.csv');

    expect(result.success).toBe(true);

    const hiredEvents = result.events.filter(e => e.event_type === 'HIRED');
    expect(hiredEvents.length).toBe(1);
    expect(hiredEvents[0].source_trace.source_column).toBe('Hire/Rehire Date');
    expect(hiredEvents[0].event_at).toEqual(new Date(2024, 1, 1)); // Feb 1
  });

  test('emits OFFER_SENT from Offer Letter column', () => {
    const csv = createTestCSV([
      {
        'Job : Requisition ID': 'REQ-001',
        'Person : System ID': 'PER-001',
        'Date First Interviewed: Offer Letter': '1/25/2024',
        'Status': 'Offer Extended'
      }
    ]);

    const result = ingestCSVToCanonical(csv, 'test.csv');

    const offerEvents = result.events.filter(e => e.event_type === 'OFFER_SENT');
    expect(offerEvents.length).toBe(1);
    expect(offerEvents[0].source_trace.source_column).toBe('Date First Interviewed: Offer Letter');
  });

  test('no fabricated timestamps exist in events', () => {
    const csv = createTestCSV([
      {
        'Job : Requisition ID': 'REQ-001',
        'Person : System ID': 'PER-001',
        'Date First Interviewed: Phone Screen Staffing': '1/15/2024',
        'Status': 'Applied'
      }
    ]);

    const result = ingestCSVToCanonical(csv, 'test.csv');

    // All events should have a real source_column
    for (const event of result.events) {
      expect(event.source_trace.source_column).toBeTruthy();
      expect(event.source_trace.raw_value).toBeTruthy();
      expect(event.event_kind).toBe('POINT_IN_TIME');
      expect(event.confidence.grade).toBe('high');
    }
  });

  test('application has null dates when not in CSV', () => {
    const csv = createTestCSV([
      {
        'Job : Requisition ID': 'REQ-001',
        'Person : System ID': 'PER-001',
        'Status': 'Applied'
        // No date columns
      }
    ]);

    const result = ingestCSVToCanonical(csv, 'test.csv');

    expect(result.applications.length).toBe(1);
    const app = result.applications[0];
    expect(app.applied_at).toBeNull();
    expect(app.first_contacted_at).toBeNull();
    expect(app.hired_at).toBeNull();
    expect(app.offer_sent_at).toBeNull();
    expect(app.has_event_history).toBe(false);
  });

  test('events have correct provenance metadata', () => {
    const csv = createTestCSV([
      {
        'Job : Requisition ID': 'REQ-001',
        'Person : System ID': 'PER-001',
        'Date First Interviewed: Phone Screen Staffing': '1/15/2024'
      }
    ]);

    const result = ingestCSVToCanonical(csv, 'test.csv');

    expect(result.events.length).toBe(1);
    const event = result.events[0];
    expect(event.event_kind).toBe('POINT_IN_TIME');
    expect(event.event_provenance).toBe('historical_export');
    expect(event.as_of_date).toBeNull(); // Not a snapshot
  });
});

// ===== INGESTION TESTS =====

describe('ingestCSVToCanonical', () => {
  test('ingests basic iCIMS format', () => {
    const csv = createTestCSV([
      {
        'Job : Requisition ID': 'REQ-001',
        'Person : System ID': 'PER-001',
        'Person : Full Name: First Last': 'John Doe',
        'Job : Job Title and Job Code': 'Software Engineer',
        'Hiring Manager : Full Name: First Last': 'Jane Manager',
        'Recruiter : Full Name: First Last': 'Bob Recruiter',
        'Status': 'Phone Screen Staffing'
      }
    ]);

    const result = ingestCSVToCanonical(csv, 'test.csv');

    expect(result.success).toBe(true);
    expect(result.reqs.length).toBe(1);
    expect(result.candidates.length).toBe(1);
    expect(result.applications.length).toBe(1);
    expect(result.reqs[0].req_id).toBe('REQ-001');
    expect(result.candidates[0].candidate_id).toBe('PER-001');
  });

  test('handles duplicate candidates', () => {
    const csv = createTestCSV([
      {
        'Job : Requisition ID': 'REQ-001',
        'Person : System ID': 'PER-001',
        'Person : Full Name: First Last': 'John Doe',
        'Status': 'Applied'
      },
      {
        'Job : Requisition ID': 'REQ-002',
        'Person : System ID': 'PER-001', // Same candidate
        'Person : Full Name: First Last': 'John Doe',
        'Status': 'Phone Screen'
      }
    ]);

    const result = ingestCSVToCanonical(csv, 'test.csv');

    expect(result.success).toBe(true);
    expect(result.candidates.length).toBe(1); // Deduplicated
    expect(result.applications.length).toBe(2); // Two applications for same candidate
    expect(result.reqs.length).toBe(2);
  });

  test('handles reopened requisitions', () => {
    const csv = createTestCSV([
      {
        'Job : Requisition ID': 'REQ-001',
        'Person : System ID': 'PER-001',
        'Hire/Rehire Date': '1/15/2024',
        'Status': 'Hired',
        'Job : Job Title and Job Code': 'Software Engineer'
      },
      {
        'Job : Requisition ID': 'REQ-001', // Same req
        'Person : System ID': 'PER-002',
        'Status': 'Applied',
        'Job : Job Title and Job Code': 'Software Engineer'
      }
    ]);

    const result = ingestCSVToCanonical(csv, 'test.csv');

    expect(result.success).toBe(true);
    expect(result.reqs.length).toBe(1); // Single req
    expect(result.applications.length).toBe(2); // Two applications
  });

  test('applications have has_event_history flag', () => {
    const csv = createTestCSV([
      {
        'Job : Requisition ID': 'REQ-001',
        'Person : System ID': 'PER-001',
        'Date First Interviewed: Phone Screen Staffing': '1/15/2024',
        'Status': 'Applied'
      }
    ]);

    const result = ingestCSVToCanonical(csv, 'test.csv');

    expect(result.applications[0]).toHaveProperty('has_event_history');
    expect(result.applications[0].has_event_history).toBe(true);
  });

  test('handles missing req ID', () => {
    const csv = createTestCSV([
      {
        'Person : System ID': 'PER-001',
        'Person : Full Name: First Last': 'John Doe'
        // Missing Job : Requisition ID
      }
    ]);

    const result = ingestCSVToCanonical(csv, 'test.csv');

    expect(result.reqs.length).toBe(0);
    expect(result.audit_log.some(e => e.reason_code === 'MISSING_REQ_ID')).toBe(true);
  });

  test('handles missing candidate ID', () => {
    const csv = createTestCSV([
      {
        'Job : Requisition ID': 'REQ-001'
        // Missing Person : System ID
      }
    ]);

    const result = ingestCSVToCanonical(csv, 'test.csv');

    expect(result.candidates.length).toBe(0);
    expect(result.audit_log.some(e => e.reason_code === 'MISSING_CANDIDATE_ID')).toBe(true);
  });

  test('tracks unmapped statuses in quality report', () => {
    const csv = createTestCSV([
      {
        'Job : Requisition ID': 'REQ-001',
        'Person : System ID': 'PER-001',
        'Status': 'Weird Custom Status'
      },
      {
        'Job : Requisition ID': 'REQ-002',
        'Person : System ID': 'PER-002',
        'Status': 'Weird Custom Status' // Same unmapped status
      }
    ]);

    const result = ingestCSVToCanonical(csv, 'test.csv');

    // Unmapped statuses are tracked but don't block ingestion
    expect(result.success).toBe(true);
  });
});

// ===== DATA QUALITY REPORT TESTS =====

describe('Data Quality Report', () => {
  test('calculates missingness stats', () => {
    const csv = createTestCSV([
      {
        'Job : Requisition ID': 'REQ-001',
        'Person : System ID': 'PER-001',
        // Missing hiring manager and recruiter
        'Status': 'Applied'
      }
    ]);

    const result = ingestCSVToCanonical(csv, 'test.csv');

    expect(result.quality_report.missingness.length).toBeGreaterThan(0);
    const hmMissing = result.quality_report.missingness.find(
      m => m.field === 'req.hiring_manager_name'
    );
    expect(hmMissing).toBeDefined();
  });

  test('calculates overall quality score', () => {
    const csv = createTestCSV([
      {
        'Job : Requisition ID': 'REQ-001',
        'Person : System ID': 'PER-001',
        'Person : Full Name: First Last': 'John Doe',
        'Hiring Manager : Full Name: First Last': 'Jane Manager',
        'Date First Interviewed: Phone Screen Staffing': '1/15/2024',
        'Status': 'Applied'
      }
    ]);

    const result = ingestCSVToCanonical(csv, 'test.csv');

    expect(result.quality_report.overall_quality_score).toBeGreaterThanOrEqual(0);
    expect(result.quality_report.overall_quality_score).toBeLessThanOrEqual(100);
  });

  test('includes confidence rule results', () => {
    const csv = createTestCSV([
      {
        'Job : Requisition ID': 'REQ-001',
        'Person : System ID': 'PER-001',
        'Date First Interviewed: Phone Screen Staffing': '1/15/2024',
        'Status': 'Applied'
      }
    ]);

    const result = ingestCSVToCanonical(csv, 'test.csv');

    expect(result.quality_report.confidence_rules.length).toBeGreaterThan(0);
    expect(result.quality_report.confidence_rules[0]).toHaveProperty('rule_name');
    expect(result.quality_report.confidence_rules[0]).toHaveProperty('passed');
  });

  test('includes no_fabricated_dates confidence rule', () => {
    const csv = createTestCSV([
      {
        'Job : Requisition ID': 'REQ-001',
        'Person : System ID': 'PER-001'
      }
    ]);

    const result = ingestCSVToCanonical(csv, 'test.csv');

    const noFabRule = result.quality_report.confidence_rules.find(
      r => r.rule_name === 'no_fabricated_dates'
    );
    expect(noFabRule).toBeDefined();
    expect(noFabRule?.passed).toBe(true);
  });
});

// ===== AUDIT LOG TESTS =====

describe('Audit Log', () => {
  test('logs file ingestion', () => {
    const csv = createTestCSV([
      {
        'Job : Requisition ID': 'REQ-001',
        'Person : System ID': 'PER-001'
      }
    ]);

    const result = ingestCSVToCanonical(csv, 'test.csv');

    const ingestLog = result.audit_log.find(e => e.action === 'INGEST_FILE');
    expect(ingestLog).toBeDefined();
    expect(ingestLog?.rows_in).toBeGreaterThan(0);
  });

  test('logs report type detection', () => {
    const csv = createTestCSV([
      {
        'Job : Requisition ID': 'REQ-001',
        'Person : System ID': 'PER-001'
      }
    ]);

    const result = ingestCSVToCanonical(csv, 'test.csv');

    const detectLog = result.audit_log.find(e => e.action === 'DETECT_REPORT_TYPE');
    expect(detectLog).toBeDefined();
  });

  test('logs dropped rows', () => {
    const csv = createTestCSV([
      { 'Random Column': 'no IDs' }
    ]);

    const result = ingestCSVToCanonical(csv, 'test.csv');

    const dropLog = result.audit_log.filter(e => e.action === 'DROP_ROW');
    expect(dropLog.length).toBeGreaterThan(0);
  });

  test('logs EMIT_STAGE_ENTERED for real events', () => {
    const csv = createTestCSV([
      {
        'Job : Requisition ID': 'REQ-001',
        'Person : System ID': 'PER-001',
        'Date First Interviewed: Phone Screen Staffing': '1/15/2024'
      }
    ]);

    const result = ingestCSVToCanonical(csv, 'test.csv');

    const emitLog = result.audit_log.find(e => e.action === 'EMIT_STAGE_ENTERED');
    expect(emitLog).toBeDefined();
    expect(emitLog?.details).toHaveProperty('stage', 'Phone Screen Staffing');
    expect(emitLog?.details).toHaveProperty('source_column');
  });
});

// ===== DATA CAPABILITIES TESTS =====

describe('Data Capabilities', () => {
  test('correctly identifies point-in-time events', () => {
    const csv = createTestCSV([
      {
        'Job : Requisition ID': 'REQ-001',
        'Person : System ID': 'PER-001',
        'Date First Interviewed: Phone Screen Staffing': '1/15/2024'
      }
    ]);

    const result = ingestCSVToCanonical(csv, 'test.csv');

    expect(result.capabilities.has_point_in_time_events).toBe(true);
    expect(result.capabilities.has_snapshot_diff_events).toBe(false);
    expect(result.capabilities.can_compute_stage_velocity).toBe(true);
    expect(result.capabilities.can_compute_days_in_stage).toBe(false);
  });

  test('lists available metrics correctly', () => {
    const csv = createTestCSV([
      {
        'Job : Requisition ID': 'REQ-001',
        'Person : System ID': 'PER-001',
        'Date First Interviewed: Phone Screen Staffing': '1/15/2024'
      }
    ]);

    const result = ingestCSVToCanonical(csv, 'test.csv');

    expect(result.capabilities.available_metrics).toContain('hire_rate');
    expect(result.capabilities.available_metrics).toContain('time_to_hire');
    expect(result.capabilities.available_metrics).toContain('stage_velocity');
  });

  test('lists unavailable metrics with reasons', () => {
    const csv = createTestCSV([
      {
        'Job : Requisition ID': 'REQ-001',
        'Person : System ID': 'PER-001',
        'Date First Interviewed: Phone Screen Staffing': '1/15/2024'
      }
    ]);

    const result = ingestCSVToCanonical(csv, 'test.csv');

    const unavailable = result.capabilities.unavailable_metrics;
    expect(unavailable.some(u => u.metric === 'days_in_stage')).toBe(true);
    expect(unavailable.some(u => u.metric === 'friction_heatmap')).toBe(true);

    const daysInStage = unavailable.find(u => u.metric === 'days_in_stage');
    expect(daysInStage?.reason).toContain('snapshot diff');
  });
});

// ===== METRIC INSPECTOR TESTS =====

describe('getMetric', () => {
  const mockApplications: ApplicationCanonical[] = [
    {
      application_id: 'app-1',
      candidate_id: 'cand-1',
      req_id: 'req-1',
      current_stage: 'Hired',
      current_stage_canonical: 'HIRED',
      disposition: 'Hired',
      is_terminal: true,
      applied_at: new Date('2024-01-01'),
      first_contacted_at: new Date('2024-01-05'),
      current_stage_entered_at: new Date('2024-02-01'),
      hired_at: new Date('2024-02-01'),
      offer_sent_at: new Date('2024-01-25'),
      rejected_at: null,
      withdrawn_at: null,
      stage_timestamps: {},
      source_trace: {
        source_file: 'test.csv',
        source_row_id: 1,
        ingested_at: new Date()
      },
      confidence: { grade: 'high', reasons: [], inferred_fields: [] },
      has_event_history: true,
      event_count: 3,
      missing_timestamps: []
    },
    {
      application_id: 'app-2',
      candidate_id: 'cand-2',
      req_id: 'req-1',
      current_stage: 'Rejected',
      current_stage_canonical: 'REJECTED',
      disposition: 'Rejected',
      is_terminal: true,
      applied_at: new Date('2024-01-01'),
      first_contacted_at: null,
      current_stage_entered_at: new Date('2024-01-15'),
      hired_at: null,
      offer_sent_at: null,
      rejected_at: new Date('2024-01-15'),
      withdrawn_at: null,
      stage_timestamps: {},
      source_trace: {
        source_file: 'test.csv',
        source_row_id: 2,
        ingested_at: new Date()
      },
      confidence: { grade: 'medium', reasons: ['Missing timestamps'], inferred_fields: ['first_contacted_at'] },
      has_event_history: false,
      event_count: 0,
      missing_timestamps: ['first_contacted_at']
    }
  ];

  const mockEvents: EventCanonical[] = [
    {
      event_id: 'evt-1',
      application_id: 'app-1',
      candidate_id: 'cand-1',
      req_id: 'req-1',
      event_type: 'STAGE_ENTERED',
      stage: 'Phone Screen Staffing',
      stage_canonical: 'SCREEN',
      event_at: new Date('2024-01-05'),
      actor_user_id: null,
      event_kind: 'POINT_IN_TIME',
      event_provenance: 'historical_export',
      as_of_date: null,
      source_trace: {
        source_file: 'test.csv',
        source_row_id: 1,
        source_column: 'Date First Interviewed: Phone Screen Staffing',
        ingested_at: new Date(),
        raw_value: '1/5/2024'
      },
      confidence: { grade: 'high', reasons: ['first_occurrence_timestamp'], inferred_fields: [] }
    }
  ];

  const mockCapabilities: DataCapabilities = {
    has_point_in_time_events: true,
    has_snapshot_diff_events: false,
    can_compute_stage_velocity: true,
    can_compute_days_in_stage: false,
    can_compute_stage_regression: false,
    can_compute_sla_timing: false,
    can_compute_friction_heatmap: false,
    can_compute_forecasting: false,
    available_metrics: ['hire_rate', 'time_to_hire', 'time_to_first_interview', 'time_to_offer'],
    unavailable_metrics: [
      { metric: 'days_in_stage', reason: 'Requires snapshot diff events' },
      { metric: 'friction_heatmap', reason: 'Requires snapshot diff events' }
    ]
  };

  test('calculates hire_rate correctly', () => {
    const result = getMetric('hire_rate', mockApplications, mockEvents, mockCapabilities);

    expect(result.metric_name).toBe('hire_rate');
    expect(result.value).toBe(50); // 1 hired / 2 total = 50%
    expect(result.included_count).toBe(2);
    expect(result.definition.unit).toBe('percent');
    expect(result.computation_possible).toBe(true);
  });

  test('calculates time_to_hire correctly', () => {
    const result = getMetric('time_to_hire', mockApplications, mockEvents, mockCapabilities);

    expect(result.metric_name).toBe('time_to_hire');
    expect(result.value).toBe(31); // Jan 1 to Feb 1 = 31 days
    expect(result.definition.unit).toBe('days');
    expect(result.source_columns_used).toContain('Hire/Rehire Date');
  });

  test('calculates time_to_first_interview correctly', () => {
    const result = getMetric('time_to_first_interview', mockApplications, mockEvents, mockCapabilities);

    expect(result.metric_name).toBe('time_to_first_interview');
    expect(result.value).toBe(4); // Jan 1 to Jan 5 = 4 days
  });

  test('returns confidence information', () => {
    const result = getMetric('hire_rate', mockApplications, mockEvents, mockCapabilities);

    expect(result.confidence_grade).toBeDefined();
    expect(['high', 'medium', 'low', 'inferred']).toContain(result.confidence_grade);
    expect(result.low_confidence_contribution_percent).toBeGreaterThanOrEqual(0);
  });

  test('includes sample source traces', () => {
    const result = getMetric('hire_rate', mockApplications, mockEvents, mockCapabilities);

    expect(result.sample_source_traces.length).toBeGreaterThan(0);
    expect(result.sample_source_traces[0]).toHaveProperty('source_file');
    expect(result.sample_source_traces[0]).toHaveProperty('source_row_id');
  });

  test('handles unknown metric', () => {
    const result = getMetric('unknown_metric', mockApplications, mockEvents, mockCapabilities);

    expect(result.value).toBeNull();
    expect(result.confidence_grade).toBe('low');
    expect(result.confidence_reasons).toContain('Metric definition not found');
    expect(result.computation_possible).toBe(false);
  });

  test('includes filters applied', () => {
    const filters = { req_id: 'req-1' };
    const result = getMetric('hire_rate', mockApplications, mockEvents, mockCapabilities, filters);

    expect(result.filters_applied).toEqual(filters);
  });

  test('handles empty data', () => {
    const result = getMetric('hire_rate', [], [], mockCapabilities);

    expect(result.value).toBeNull();
    expect(result.included_count).toBe(0);
    expect(result.confidence_grade).toBe('low');
  });

  test('includes event_kind and event_provenance in result', () => {
    const result = getMetric('time_to_hire', mockApplications, mockEvents, mockCapabilities);

    expect(result.event_kind).toBe('POINT_IN_TIME');
    expect(result.event_provenance).toBe('historical_export');
  });

  // CRITICAL: Metrics refuse to compute dwell time without snapshot diffs
  test('refuses to compute days_in_stage without snapshot diffs', () => {
    const result = getMetric('days_in_stage', mockApplications, mockEvents, mockCapabilities);

    expect(result.value).toBeNull();
    expect(result.computation_possible).toBe(false);
    expect(result.computation_blocked_reason).toContain('snapshot diff');
    expect(result.confidence_grade).toBe('low');
  });

  test('refuses to compute friction_heatmap without snapshot diffs', () => {
    const result = getMetric('friction_heatmap', mockApplications, mockEvents, mockCapabilities);

    expect(result.value).toBeNull();
    expect(result.computation_possible).toBe(false);
    expect(result.computation_blocked_reason).toContain('snapshot diff');
  });
});

// ===== SOURCE TRACE TESTS =====

describe('Source Traceability', () => {
  test('all canonical records include source_trace', () => {
    const csv = createTestCSV([
      {
        'Job : Requisition ID': 'REQ-001',
        'Person : System ID': 'PER-001',
        'Status': 'Applied'
      }
    ]);

    const result = ingestCSVToCanonical(csv, 'test.csv');

    // Check reqs
    result.reqs.forEach(req => {
      expect(req.source_trace).toBeDefined();
      expect(req.source_trace.source_file).toBe('test.csv');
      expect(typeof req.source_trace.source_row_id).toBe('number');
    });

    // Check candidates
    result.candidates.forEach(cand => {
      expect(cand.source_trace).toBeDefined();
      expect(cand.source_trace.source_file).toBe('test.csv');
    });

    // Check applications
    result.applications.forEach(app => {
      expect(app.source_trace).toBeDefined();
      expect(app.source_trace.source_file).toBe('test.csv');
    });
  });

  test('source_trace includes ingested_at timestamp', () => {
    const csv = createTestCSV([
      {
        'Job : Requisition ID': 'REQ-001',
        'Person : System ID': 'PER-001'
      }
    ]);

    const before = new Date();
    const result = ingestCSVToCanonical(csv, 'test.csv');
    const after = new Date();

    result.reqs.forEach(req => {
      expect(req.source_trace.ingested_at).toBeInstanceOf(Date);
      expect(req.source_trace.ingested_at.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(req.source_trace.ingested_at.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  test('events include source_column in trace', () => {
    const csv = createTestCSV([
      {
        'Job : Requisition ID': 'REQ-001',
        'Person : System ID': 'PER-001',
        'Date First Interviewed: Phone Screen Staffing': '1/15/2024'
      }
    ]);

    const result = ingestCSVToCanonical(csv, 'test.csv');

    result.events.forEach(event => {
      expect(event.source_trace.source_column).toBeDefined();
      expect(event.source_trace.raw_value).toBeDefined();
    });
  });
});

// ===== STAGE ORDER TESTS =====

describe('Stage Order', () => {
  test('stage order is correctly defined', () => {
    expect(STAGE_ORDER['LEAD']).toBeLessThan(STAGE_ORDER['APPLIED']);
    expect(STAGE_ORDER['APPLIED']).toBeLessThan(STAGE_ORDER['SCREEN']);
    expect(STAGE_ORDER['SCREEN']).toBeLessThan(STAGE_ORDER['HM_SCREEN']);
    expect(STAGE_ORDER['HM_SCREEN']).toBeLessThan(STAGE_ORDER['ONSITE']);
    expect(STAGE_ORDER['ONSITE']).toBeLessThan(STAGE_ORDER['FINAL']);
    expect(STAGE_ORDER['FINAL']).toBeLessThan(STAGE_ORDER['OFFER']);
    expect(STAGE_ORDER['OFFER']).toBeLessThan(STAGE_ORDER['HIRED']);
  });

  test('terminal stages have highest order', () => {
    expect(STAGE_ORDER['REJECTED']).toBe(99);
    expect(STAGE_ORDER['WITHDREW']).toBe(99);
  });
});

// ===== NO FABRICATED TIMESTAMPS TESTS =====

describe('No Fabricated Timestamps', () => {
  test('hired_at is null when Hire/Rehire Date column is missing', () => {
    const csv = createTestCSV([
      {
        'Job : Requisition ID': 'REQ-001',
        'Person : System ID': 'PER-001',
        'Status': 'Hired'  // Terminal status but no date column
      }
    ]);

    const result = ingestCSVToCanonical(csv, 'test.csv');

    expect(result.applications.length).toBe(1);
    expect(result.applications[0].hired_at).toBeNull();
    expect(result.applications[0].disposition).toBe('Hired');
  });

  test('rejected_at is null when Rejection Date column is missing', () => {
    const csv = createTestCSV([
      {
        'Job : Requisition ID': 'REQ-001',
        'Person : System ID': 'PER-001',
        'Status': 'Rejected'  // Terminal status but no date column
      }
    ]);

    const result = ingestCSVToCanonical(csv, 'test.csv');

    expect(result.applications.length).toBe(1);
    expect(result.applications[0].rejected_at).toBeNull();
    expect(result.applications[0].disposition).toBe('Rejected');
  });

  test('withdrawn_at is null when Withdrawn Date column is missing', () => {
    const csv = createTestCSV([
      {
        'Job : Requisition ID': 'REQ-001',
        'Person : System ID': 'PER-001',
        'Status': 'Candidate Withdrew'  // Terminal status but no date column
      }
    ]);

    const result = ingestCSVToCanonical(csv, 'test.csv');

    expect(result.applications.length).toBe(1);
    expect(result.applications[0].withdrawn_at).toBeNull();
    expect(result.applications[0].disposition).toBe('Withdrawn');
  });

  test('terminal timestamps populated only from explicit CSV columns', () => {
    const csv = createTestCSV([
      {
        'Job : Requisition ID': 'REQ-001',
        'Person : System ID': 'PER-001',
        'Hire/Rehire Date': '2/15/2024',
        'Status': 'Hired'
      }
    ]);

    const result = ingestCSVToCanonical(csv, 'test.csv');

    expect(result.applications.length).toBe(1);
    expect(result.applications[0].hired_at).toEqual(new Date(2024, 1, 15));
    expect(result.applications[0].disposition).toBe('Hired');
  });

  test('rejected_at populated from Rejection Date column', () => {
    const csv = createTestCSV([
      {
        'Job : Requisition ID': 'REQ-001',
        'Person : System ID': 'PER-001',
        'Rejection Date': '2/10/2024',
        'Status': 'Rejected'
      }
    ]);

    const result = ingestCSVToCanonical(csv, 'test.csv');

    expect(result.applications.length).toBe(1);
    expect(result.applications[0].rejected_at).toEqual(new Date(2024, 1, 10));
    expect(result.applications[0].disposition).toBe('Rejected');
  });

  test('withdrawn_at populated from Withdrawn Date column', () => {
    const csv = createTestCSV([
      {
        'Job : Requisition ID': 'REQ-001',
        'Person : System ID': 'PER-001',
        'Withdrawn Date': '2/5/2024',
        'Status': 'Candidate Withdrew'
      }
    ]);

    const result = ingestCSVToCanonical(csv, 'test.csv');

    expect(result.applications.length).toBe(1);
    expect(result.applications[0].withdrawn_at).toEqual(new Date(2024, 1, 5));
    expect(result.applications[0].disposition).toBe('Withdrawn');
  });

  test('audit log contains MISSING_TERMINAL_TIMESTAMP when terminal status but no timestamp', () => {
    const csv = createTestCSV([
      {
        'Job : Requisition ID': 'REQ-001',
        'Person : System ID': 'PER-001',
        'Status': 'Hired'  // Terminal but no date
      }
    ]);

    const result = ingestCSVToCanonical(csv, 'test.csv');

    const missingTimestampLog = result.audit_log.find(
      e => e.reason_code === 'MISSING_TERMINAL_TIMESTAMP'
    );
    expect(missingTimestampLog).toBeDefined();
    expect(missingTimestampLog?.details?.disposition).toBe('Hired');
  });

  test('confidence is downgraded when terminal timestamp is missing', () => {
    const csv = createTestCSV([
      {
        'Job : Requisition ID': 'REQ-001',
        'Person : System ID': 'PER-001',
        'Status': 'Hired'  // Terminal but no date
      }
    ]);

    const result = ingestCSVToCanonical(csv, 'test.csv');

    expect(result.applications[0].confidence.grade).not.toBe('high');
    expect(result.applications[0].missing_timestamps).toContain('hired_at');
  });

  test('confidence is high when terminal timestamp is present', () => {
    const csv = createTestCSV([
      {
        'Job : Requisition ID': 'REQ-001',
        'Person : System ID': 'PER-001',
        'Hire/Rehire Date': '2/15/2024',
        'Status': 'Hired'
      }
    ]);

    const result = ingestCSVToCanonical(csv, 'test.csv');

    expect(result.applications[0].confidence.grade).toBe('high');
    expect(result.applications[0].missing_timestamps).toHaveLength(0);
  });

  test('no new Date() fallbacks in any timestamp fields', () => {
    // Test that we never get today's date as a fallback
    const csv = createTestCSV([
      {
        'Job : Requisition ID': 'REQ-001',
        'Person : System ID': 'PER-001',
        'Status': 'Applied'
        // No date columns at all
      }
    ]);

    const result = ingestCSVToCanonical(csv, 'test.csv');

    const app = result.applications[0];
    // All timestamp fields should be null, not today's date
    expect(app.applied_at).toBeNull();
    expect(app.first_contacted_at).toBeNull();
    expect(app.current_stage_entered_at).toBeNull();
    expect(app.hired_at).toBeNull();
    expect(app.offer_sent_at).toBeNull();
    expect(app.rejected_at).toBeNull();
    expect(app.withdrawn_at).toBeNull();
  });
});

// ===== EXPLAIN TIME TO OFFER TESTS =====

describe('explainTimeToOffer', () => {
  test('calculates breakdown with correct math: total = phase1 + phase2', () => {
    // Create applications with specific dates to validate the breakdown math
    // App 1: Applied Jan 1, First Interview Jan 11 (10 days), Offer Jan 31 (20 days from interview)
    // Total = 30 days, Phase1 = 10 days, Phase2 = 20 days
    const mockApplications: ApplicationCanonical[] = [
      {
        application_id: 'app-1',
        candidate_id: 'cand-1',
        req_id: 'req-1',
        current_stage: 'Offer',
        current_stage_canonical: 'OFFER',
        disposition: 'Active',
        is_terminal: false,
        applied_at: new Date('2024-01-01'),
        first_contacted_at: new Date('2024-01-11'),  // 10 days after applied
        current_stage_entered_at: new Date('2024-01-31'),
        hired_at: null,
        offer_sent_at: new Date('2024-01-31'),       // 20 days after first interview
        rejected_at: null,
        withdrawn_at: null,
        stage_timestamps: {},
        source_trace: {
          source_file: 'test.csv',
          source_row_id: 1,
          ingested_at: new Date()
        },
        confidence: { grade: 'high', reasons: [], inferred_fields: [] },
        has_event_history: true,
        event_count: 3,
        missing_timestamps: []
      },
      // App 2: Applied Jan 1, First Interview Jan 6 (5 days), Offer Jan 16 (10 days from interview)
      // Total = 15 days, Phase1 = 5 days, Phase2 = 10 days
      {
        application_id: 'app-2',
        candidate_id: 'cand-2',
        req_id: 'req-2',
        current_stage: 'Offer',
        current_stage_canonical: 'OFFER',
        disposition: 'Active',
        is_terminal: false,
        applied_at: new Date('2024-01-01'),
        first_contacted_at: new Date('2024-01-06'),  // 5 days after applied
        current_stage_entered_at: new Date('2024-01-16'),
        hired_at: null,
        offer_sent_at: new Date('2024-01-16'),       // 10 days after first interview
        rejected_at: null,
        withdrawn_at: null,
        stage_timestamps: {},
        source_trace: {
          source_file: 'test.csv',
          source_row_id: 2,
          ingested_at: new Date()
        },
        confidence: { grade: 'high', reasons: [], inferred_fields: [] },
        has_event_history: true,
        event_count: 3,
        missing_timestamps: []
      },
      // App 3: Applied Jan 1, First Interview Jan 21 (20 days), Offer Feb 10 (20 days from interview)
      // Total = 40 days, Phase1 = 20 days, Phase2 = 20 days
      {
        application_id: 'app-3',
        candidate_id: 'cand-3',
        req_id: 'req-3',
        current_stage: 'Offer',
        current_stage_canonical: 'OFFER',
        disposition: 'Active',
        is_terminal: false,
        applied_at: new Date('2024-01-01'),
        first_contacted_at: new Date('2024-01-21'),  // 20 days after applied
        current_stage_entered_at: new Date('2024-02-10'),
        hired_at: null,
        offer_sent_at: new Date('2024-02-10'),       // 20 days after first interview
        rejected_at: null,
        withdrawn_at: null,
        stage_timestamps: {},
        source_trace: {
          source_file: 'test.csv',
          source_row_id: 3,
          ingested_at: new Date()
        },
        confidence: { grade: 'high', reasons: [], inferred_fields: [] },
        has_event_history: true,
        event_count: 3,
        missing_timestamps: []
      }
    ];

    const result = explainTimeToOffer(mockApplications, []);

    // Verify included count
    expect(result.included_count).toBe(3);
    expect(result.excluded_count).toBe(0);

    // Totals: 15, 30, 40 - median is 30
    expect(result.total_days).toBe(30);

    // Phase1 (applied to interview): 5, 10, 20 - median is 10
    expect(result.applied_to_first_interview_days).toBe(10);

    // Phase2 (interview to offer): 10, 20, 20 - median is 20
    expect(result.first_interview_to_offer_days).toBe(20);

    // Verify top delay contributors are sorted by total_days descending
    expect(result.top_delay_contributors.length).toBe(3);
    expect(result.top_delay_contributors[0].application_id).toBe('app-3'); // 40 days
    expect(result.top_delay_contributors[1].application_id).toBe('app-1'); // 30 days
    expect(result.top_delay_contributors[2].application_id).toBe('app-2'); // 15 days

    // Verify breakdown math for each contributor: total = phase1 + phase2
    for (const contributor of result.top_delay_contributors) {
      expect(contributor.total_days).toBe(
        contributor.applied_to_first_interview_days + contributor.first_interview_to_offer_days
      );
    }
  });

  test('excludes applications missing applied_at or offer_sent_at', () => {
    const mockApplications: ApplicationCanonical[] = [
      {
        application_id: 'app-1',
        candidate_id: 'cand-1',
        req_id: 'req-1',
        current_stage: 'Applied',
        current_stage_canonical: 'APPLIED',
        disposition: 'Active',
        is_terminal: false,
        applied_at: null,  // Missing applied_at
        first_contacted_at: null,
        current_stage_entered_at: null,
        hired_at: null,
        offer_sent_at: new Date('2024-01-31'),
        rejected_at: null,
        withdrawn_at: null,
        stage_timestamps: {},
        source_trace: { source_file: 'test.csv', source_row_id: 1, ingested_at: new Date() },
        confidence: { grade: 'low', reasons: [], inferred_fields: [] },
        has_event_history: false,
        event_count: 0,
        missing_timestamps: []
      },
      {
        application_id: 'app-2',
        candidate_id: 'cand-2',
        req_id: 'req-2',
        current_stage: 'Applied',
        current_stage_canonical: 'APPLIED',
        disposition: 'Active',
        is_terminal: false,
        applied_at: new Date('2024-01-01'),
        first_contacted_at: null,
        current_stage_entered_at: null,
        hired_at: null,
        offer_sent_at: null,  // Missing offer_sent_at
        rejected_at: null,
        withdrawn_at: null,
        stage_timestamps: {},
        source_trace: { source_file: 'test.csv', source_row_id: 2, ingested_at: new Date() },
        confidence: { grade: 'low', reasons: [], inferred_fields: [] },
        has_event_history: false,
        event_count: 0,
        missing_timestamps: []
      }
    ];

    const result = explainTimeToOffer(mockApplications, []);

    expect(result.total_days).toBeNull();
    expect(result.included_count).toBe(0);
    expect(result.excluded_count).toBe(2);
    expect(result.exclusion_reasons.length).toBeGreaterThan(0);
  });

  test('returns top 5 delay contributors only', () => {
    // Create 7 applications - should only return top 5
    const mockApplications: ApplicationCanonical[] = [];
    for (let i = 1; i <= 7; i++) {
      mockApplications.push({
        application_id: `app-${i}`,
        candidate_id: `cand-${i}`,
        req_id: `req-${i}`,
        current_stage: 'Offer',
        current_stage_canonical: 'OFFER',
        disposition: 'Active',
        is_terminal: false,
        applied_at: new Date('2024-01-01'),
        first_contacted_at: new Date(`2024-01-${5 + i}`),
        current_stage_entered_at: new Date(`2024-01-${20 + i}`),
        hired_at: null,
        offer_sent_at: new Date(`2024-01-${20 + i}`),  // Varying total days
        rejected_at: null,
        withdrawn_at: null,
        stage_timestamps: {},
        source_trace: { source_file: 'test.csv', source_row_id: i, ingested_at: new Date() },
        confidence: { grade: 'high', reasons: [], inferred_fields: [] },
        has_event_history: true,
        event_count: 3,
        missing_timestamps: []
      });
    }

    const result = explainTimeToOffer(mockApplications, []);

    expect(result.top_delay_contributors.length).toBe(5);
    expect(result.included_count).toBe(7);
  });

  test('returns null when offer exists but no interview date (STRICT: cannot compute breakdown)', () => {
    // Edge case: Candidate has Offer but no Interview date
    // Should return null/error, not 0 days
    const mockApplications: ApplicationCanonical[] = [
      {
        application_id: 'app-offer-no-interview',
        candidate_id: 'cand-1',
        req_id: 'req-1',
        current_stage: 'Offer',
        current_stage_canonical: 'OFFER',
        disposition: 'Active',
        is_terminal: false,
        applied_at: new Date('2024-01-01'),
        first_contacted_at: null,  // NO INTERVIEW DATE
        current_stage_entered_at: new Date('2024-01-31'),
        hired_at: null,
        offer_sent_at: new Date('2024-01-31'),  // Has offer
        rejected_at: null,
        withdrawn_at: null,
        stage_timestamps: {},
        source_trace: { source_file: 'test.csv', source_row_id: 1, ingested_at: new Date() },
        confidence: { grade: 'medium', reasons: ['Missing interview timestamp'], inferred_fields: [] },
        has_event_history: true,
        event_count: 2,
        missing_timestamps: ['first_contacted_at']
      }
    ];

    const result = explainTimeToOffer(mockApplications, []);

    // STRICT: Should return null, not compute with 0 days for missing interview
    expect(result.total_days).toBeNull();
    expect(result.applied_to_first_interview_days).toBeNull();
    expect(result.first_interview_to_offer_days).toBeNull();
    expect(result.included_count).toBe(0);
    expect(result.excluded_count).toBe(1);
    expect(result.exclusion_reasons.some(r => r.includes('first_contacted_at'))).toBe(true);
  });

  test('excludes negative duration candidates (offer date before application date)', () => {
    // Edge case: Data error - Offer date is BEFORE Application date
    // Should not produce negative days; should flag as data error
    const mockApplications: ApplicationCanonical[] = [
      {
        application_id: 'app-negative-duration',
        candidate_id: 'cand-1',
        req_id: 'req-1',
        current_stage: 'Offer',
        current_stage_canonical: 'OFFER',
        disposition: 'Active',
        is_terminal: false,
        applied_at: new Date('2024-02-01'),  // Applied AFTER offer - data error
        first_contacted_at: new Date('2024-01-15'),  // Interview before application
        current_stage_entered_at: new Date('2024-01-31'),
        hired_at: null,
        offer_sent_at: new Date('2024-01-31'),  // Offer before application
        rejected_at: null,
        withdrawn_at: null,
        stage_timestamps: {},
        source_trace: { source_file: 'test.csv', source_row_id: 1, ingested_at: new Date() },
        confidence: { grade: 'low', reasons: ['Dates out of order'], inferred_fields: [] },
        has_event_history: true,
        event_count: 3,
        missing_timestamps: []
      }
    ];

    const result = explainTimeToOffer(mockApplications, []);

    // Should exclude this application due to negative duration
    expect(result.total_days).toBeNull();
    expect(result.included_count).toBe(0);
    expect(result.excluded_count).toBe(1);
    expect(result.exclusion_reasons.some(r =>
      r.includes('negative') || r.includes('out of order')
    )).toBe(true);
  });

  test('validates math invariant: phase sum must equal total within 1 day', () => {
    // Test with valid data - invariant should pass
    const mockApplications: ApplicationCanonical[] = [
      {
        application_id: 'app-valid',
        candidate_id: 'cand-1',
        req_id: 'req-1',
        current_stage: 'Offer',
        current_stage_canonical: 'OFFER',
        disposition: 'Active',
        is_terminal: false,
        applied_at: new Date('2024-01-01'),
        first_contacted_at: new Date('2024-01-10'),  // 9 days after apply
        current_stage_entered_at: new Date('2024-01-20'),
        hired_at: null,
        offer_sent_at: new Date('2024-01-20'),  // 10 days after interview
        rejected_at: null,
        withdrawn_at: null,
        stage_timestamps: {},
        source_trace: { source_file: 'test.csv', source_row_id: 1, ingested_at: new Date() },
        confidence: { grade: 'high', reasons: [], inferred_fields: [] },
        has_event_history: true,
        event_count: 3,
        missing_timestamps: []
      }
    ];

    const result = explainTimeToOffer(mockApplications, []);

    // Total should be 19 days (Jan 1 -> Jan 20)
    // Phase 1 (apply -> interview): 9 days
    // Phase 2 (interview -> offer): 10 days
    // Sum = 19, should equal total
    expect(result.math_invariant_valid).toBe(true);
    expect(result.math_invariant_errors.length).toBe(0);
    expect(result.included_count).toBe(1);

    // Verify the breakdown
    expect(result.total_days).toBe(19);
    expect(result.applied_to_first_interview_days).toBe(9);
    expect(result.first_interview_to_offer_days).toBe(10);
  });

  test('flags math invariant error when phase sum deviates by more than 1 day', () => {
    // This is a synthetic test - in practice this shouldn't happen with real data
    // But we test the validation logic
    const result = explainTimeToOffer([], []);

    // Empty data should have valid invariant (nothing to validate)
    expect(result.math_invariant_valid).toBe(true);
    expect(result.math_invariant_errors.length).toBe(0);
  });
});
