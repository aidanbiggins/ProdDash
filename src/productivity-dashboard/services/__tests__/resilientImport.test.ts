// Resilient Import Tests
// Tests that missing dates and data don't block import
// See docs/plans/RESILIENT_IMPORT_AND_GUIDANCE_V1.md

import { computeCoverageMetrics, createEmptyCoverageMetrics } from '../coverageMetricsService';
import {
  createAuditLog,
  logAuditEntry,
  finalizeAuditLog,
  getAuditSummary,
} from '../importAuditService';
import {
  inferSnapshotDate,
  inferSnapshotDateFromFilename,
} from '../snapshotDateService';
import { Requisition, Candidate, Event, User } from '../../types/entities';
import { CandidateDisposition, CandidateSource, RequisitionStatus, LocationType, LocationRegion, Function as JobFunction, HeadcountType, EventType, UserRole } from '../../types/entities';

describe('Resilient Import - Missing Dates Do Not Block', () => {
  // Helper to create minimal valid entities
  function createRequisition(overrides: Partial<Requisition> = {}): Requisition {
    return {
      req_id: 'REQ-001',
      req_title: 'Software Engineer',
      function: JobFunction.Engineering,
      job_family: 'Engineering',
      level: 'L4',
      location_type: LocationType.Remote,
      location_region: LocationRegion.AMER,
      location_city: null,
      comp_band_min: null,
      comp_band_max: null,
      opened_at: null, // Missing date - should not block
      closed_at: null,
      status: RequisitionStatus.Open,
      hiring_manager_id: 'HM-001',
      recruiter_id: 'REC-001',
      business_unit: 'Engineering',
      headcount_type: HeadcountType.New,
      priority: 'P1',
      candidate_slate_required: false,
      search_firm_used: false,
      ...overrides,
    };
  }

  function createCandidate(overrides: Partial<Candidate> = {}): Candidate {
    return {
      candidate_id: 'CAND-001',
      name: 'John Doe',
      req_id: 'REQ-001',
      source: CandidateSource.Inbound,
      applied_at: null, // Missing date - should not block
      first_contacted_at: null,
      current_stage: 'APPLIED',
      current_stage_entered_at: null,
      disposition: CandidateDisposition.Active,
      hired_at: null,
      offer_extended_at: null,
      offer_accepted_at: null,
      ...overrides,
    };
  }

  function createEvent(overrides: Partial<Event> = {}): Event {
    return {
      event_id: 'EVT-001',
      candidate_id: 'CAND-001',
      req_id: 'REQ-001',
      event_type: EventType.STAGE_CHANGE,
      from_stage: null, // Missing - should not block
      to_stage: 'APPLIED',
      actor_user_id: 'REC-001',
      event_at: new Date(),
      metadata_json: null,
      ...overrides,
    };
  }

  function createUser(overrides: Partial<User> = {}): User {
    return {
      user_id: 'REC-001',
      name: 'Jane Recruiter',
      role: UserRole.Recruiter,
      team: 'Engineering',
      manager_user_id: null,
      email: 'jane@example.com',
      ...overrides,
    };
  }

  describe('Coverage Metrics with Missing Data', () => {
    it('computes coverage with all dates missing', () => {
      const reqs = [createRequisition()];
      const candidates = [createCandidate()];
      const events: Event[] = [];
      const users = [createUser()];

      const coverage = computeCoverageMetrics(reqs, candidates, events, users);

      // Should still compute - not block
      expect(coverage).toBeDefined();
      expect(coverage.counts.requisitions).toBe(1);
      expect(coverage.counts.candidates).toBe(1);

      // Date coverage should be 0 since dates are missing
      expect(coverage.fieldCoverage['req.opened_at']).toBe(0);
      expect(coverage.fieldCoverage['cand.applied_at']).toBe(0);
    });

    it('computes partial coverage correctly', () => {
      const reqs = [
        createRequisition({ opened_at: new Date() }),
        createRequisition({ req_id: 'REQ-002', opened_at: null }),
      ];
      const candidates = [
        createCandidate({ applied_at: new Date() }),
        createCandidate({ candidate_id: 'CAND-002', applied_at: null }),
        createCandidate({ candidate_id: 'CAND-003', applied_at: new Date() }),
      ];

      const coverage = computeCoverageMetrics(reqs, candidates, [], []);

      // 50% of reqs have opened_at
      expect(coverage.fieldCoverage['req.opened_at']).toBe(0.5);

      // 66% of candidates have applied_at (2/3)
      expect(coverage.fieldCoverage['cand.applied_at']).toBeCloseTo(0.666, 2);
    });

    it('computes flags based on coverage thresholds', () => {
      const reqs = Array.from({ length: 10 }, (_, i) =>
        createRequisition({
          req_id: `REQ-${i}`,
          recruiter_id: i < 6 ? 'REC-001' : undefined as any, // 60% coverage
          hiring_manager_id: i < 3 ? 'HM-001' : undefined as any, // 30% coverage
        })
      );

      const coverage = computeCoverageMetrics(reqs, [], [], []);

      // recruiter coverage > 50% threshold
      expect(coverage.flags.hasRecruiterAssignment).toBe(true);

      // HM coverage < 50% threshold
      expect(coverage.flags.hasHMAssignment).toBe(false);
    });
  });

  describe('Audit Log', () => {
    it('creates and finalizes audit log', () => {
      const log = createAuditLog('test.csv');

      expect(log.importId).toBeDefined();
      expect(log.sourceFile).toBe('test.csv');
      expect(log.entries).toHaveLength(0);

      logAuditEntry(log, 'DETECT_FORMAT', 'detect', { format: 'csv' });
      expect(log.entries).toHaveLength(1);

      finalizeAuditLog(log, 100, 95);

      expect(log.completedAt).toBeDefined();
      expect(log.summary.totalRows).toBe(100);
      expect(log.summary.importedRows).toBe(95);
    });

    it('tracks warnings without blocking', () => {
      const log = createAuditLog('test.csv');

      // Log warnings for missing dates
      logAuditEntry(log, 'PARSE_FAILED', 'parse', { field: 'applied_at', reason: 'empty' }, 1);
      logAuditEntry(log, 'PARSE_FAILED', 'parse', { field: 'opened_at', reason: 'invalid format' }, 2);

      expect(log.summary.warningCount).toBe(2);

      // Finalize - import should still succeed
      finalizeAuditLog(log, 10, 10);

      const summary = getAuditSummary(log);
      expect(summary).toContain('10 of 10 rows imported');
      expect(summary).toContain('2 warnings');
    });

    it('tracks repairs without blocking', () => {
      const log = createAuditLog('test.csv');

      logAuditEntry(log, 'REPAIR_APPLIED', 'repair', { repair: 'TRIM_WHITESPACE' }, 1);
      logAuditEntry(log, 'REPAIR_APPLIED', 'repair', { repair: 'NORMALIZE_STAGE' }, 2);

      expect(log.summary.repairsApplied).toBe(2);
    });

    it('tracks ID synthesis without blocking', () => {
      const log = createAuditLog('test.csv');

      logAuditEntry(log, 'ID_SYNTHESIZED', 'canonicalize', {
        method: 'CAND_FROM_EMAIL_REQ',
        synthesizedId: 'synth:abc123',
      }, 1);

      expect(log.summary.idsSynthesized).toBe(1);
    });
  });

  describe('Snapshot Date Inference', () => {
    it('infers date from filename', () => {
      const result = inferSnapshotDateFromFilename('weekly_report_2026-01-18.csv');

      expect(result).not.toBeNull();
      expect(result!.source).toBe('filename');
      expect(result!.confidence).toBe('high');
      expect(result!.date.getFullYear()).toBe(2026);
      expect(result!.date.getMonth()).toBe(0); // January
      expect(result!.date.getDate()).toBe(18);
    });

    it('handles various filename formats', () => {
      const testCases = [
        { filename: 'report_2026-01-18.xlsx', expectedYear: 2026 },
        { filename: 'export_01-18-2026.csv', expectedYear: 2026 },
        { filename: 'data_20260118.csv', expectedYear: 2026 },
        { filename: 'week_of_2026-01-18.xlsx', expectedYear: 2026 },
        { filename: 'Jan-18-2026_export.csv', expectedYear: 2026 },
      ];

      testCases.forEach(({ filename, expectedYear }) => {
        const result = inferSnapshotDateFromFilename(filename);
        expect(result).not.toBeNull();
        expect(result!.date.getFullYear()).toBe(expectedYear);
      });
    });

    it('returns null for filenames without dates', () => {
      const result = inferSnapshotDateFromFilename('candidates.csv');
      expect(result).toBeNull();
    });

    it('uses file modified or import date as fallback', () => {
      const mockFile = new File([''], 'candidates.csv', { type: 'text/csv' });

      const result = inferSnapshotDate(mockFile);

      // Should use either file_modified (if recent) or import_date as fallback
      expect(['file_modified', 'import_date']).toContain(result.source);
      // Both fallback sources have low-to-medium confidence
      expect(['low', 'medium']).toContain(result.confidence);
    });
  });

  describe('Empty Coverage Metrics', () => {
    it('creates valid empty metrics', () => {
      const empty = createEmptyCoverageMetrics();

      expect(empty.counts.requisitions).toBe(0);
      expect(empty.counts.candidates).toBe(0);
      expect(empty.flags.hasStageEvents).toBe(false);
      expect(empty.flags.hasTimestamps).toBe(false);
    });
  });
});
