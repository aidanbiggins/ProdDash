// Ask Answerability Gate Tests
// Verifies that Ask fails safely when data is insufficient

import {
  checkAnswerability,
  buildBlockedResponse,
  validateFactPackForIntent,
  INTENT_CAPABILITY_REQUIREMENTS,
} from '../askAnswerabilityService';
import { CoverageMetrics } from '../../types/resilientImportTypes';
import { generateUltimateDemo, computeDemoCoverage } from '../ultimateDemoGenerator';
import { DEFAULT_PACK_CONFIG } from '../../types/demoTypes';

// ============================================
// HELPERS
// ============================================

function buildFullCoverage(): CoverageMetrics {
  return {
    importId: 'test',
    computedAt: new Date(),
    counts: { requisitions: 50, candidates: 200, events: 500, users: 10, snapshots: 6 },
    fieldCoverage: {
      'req.recruiter_id': 0.9, 'req.hiring_manager_id': 0.85, 'req.opened_at': 0.95,
      'req.closed_at': 0.6, 'req.status': 0.98, 'cand.applied_at': 0.92,
      'cand.current_stage': 0.95, 'cand.hired_at': 0.15, 'cand.rejected_at': 0.2,
      'cand.source': 0.7, 'cand.name': 0.99, 'event.from_stage': 0.85,
      'event.to_stage': 0.88, 'event.actor_user_id': 0.75, 'event.event_at': 0.95,
    },
    flags: {
      hasStageEvents: true, hasTimestamps: true, hasTerminalTimestamps: true,
      hasRecruiterAssignment: true, hasHMAssignment: true, hasSourceData: true,
      hasMultipleSnapshots: true,
    },
    sampleSizes: { hires: 25, offers: 30, rejections: 40, activeReqs: 35 },
  };
}

function buildEmptyCoverage(): CoverageMetrics {
  return {
    importId: 'empty',
    computedAt: new Date(),
    counts: { requisitions: 0, candidates: 0, events: 0, users: 0, snapshots: 0 },
    fieldCoverage: {
      'req.recruiter_id': 0, 'req.hiring_manager_id': 0, 'req.opened_at': 0,
      'req.closed_at': 0, 'req.status': 0, 'cand.applied_at': 0,
      'cand.current_stage': 0, 'cand.hired_at': 0, 'cand.rejected_at': 0,
      'cand.source': 0, 'cand.name': 0, 'event.from_stage': 0,
      'event.to_stage': 0, 'event.actor_user_id': 0, 'event.event_at': 0,
    },
    flags: {
      hasStageEvents: false, hasTimestamps: false, hasTerminalTimestamps: false,
      hasRecruiterAssignment: false, hasHMAssignment: false, hasSourceData: false,
      hasMultipleSnapshots: false,
    },
    sampleSizes: { hires: 0, offers: 0, rejections: 0, activeReqs: 0 },
  };
}

function buildNoHMCoverage(): CoverageMetrics {
  const full = buildFullCoverage();
  return {
    ...full,
    fieldCoverage: { ...full.fieldCoverage, 'req.hiring_manager_id': 0 },
    flags: { ...full.flags, hasHMAssignment: false },
  };
}

function buildNoEventsCoverage(): CoverageMetrics {
  const full = buildFullCoverage();
  return {
    ...full,
    counts: { ...full.counts, events: 0 },
    flags: { ...full.flags, hasStageEvents: false },
  };
}

function buildNoOffersCoverage(): CoverageMetrics {
  const full = buildFullCoverage();
  return {
    ...full,
    sampleSizes: { ...full.sampleSizes, offers: 0 },
  };
}

// ============================================
// TESTS
// ============================================

describe('Ask Answerability Gate', () => {
  describe('checkAnswerability', () => {
    it('returns answerable=true with full data for all intents', () => {
      const coverage = buildFullCoverage();
      for (const intentId of Object.keys(INTENT_CAPABILITY_REQUIREMENTS)) {
        const result = checkAnswerability(intentId, coverage);
        expect(result.answerable).toBe(true);
      }
    });

    it('returns answerable=false with no data', () => {
      const result = checkAnswerability('whats_on_fire', null);
      expect(result.answerable).toBe(false);
      expect(result.reason).toContain('No data imported');
    });

    it('returns answerable=false with empty coverage for all intents', () => {
      const coverage = buildEmptyCoverage();
      for (const intentId of Object.keys(INTENT_CAPABILITY_REQUIREMENTS)) {
        const result = checkAnswerability(intentId, coverage);
        expect(result.answerable).toBe(false);
      }
    });

    it('returns answerable=true for unknown intents', () => {
      const result = checkAnswerability('unknown_intent', buildFullCoverage());
      expect(result.answerable).toBe(true);
    });

    it('HM-dependent intents are blocked when HM data missing', () => {
      const coverage = buildNoHMCoverage();
      const result = checkAnswerability('why_hm_latency', coverage);
      expect(result.answerable).toBe(false);
      expect(result.blocked_capabilities).toContain('cap_hm_assignment');
    });

    it('event-dependent intents are blocked when events missing', () => {
      const coverage = buildNoEventsCoverage();
      const result = checkAnswerability('top_risks', coverage);
      expect(result.answerable).toBe(false);
      expect(result.blocked_capabilities).toContain('cap_stage_events');
    });

    it('whats_on_fire only needs reqs + candidates', () => {
      const coverage = buildNoHMCoverage(); // Has reqs and candidates
      const result = checkAnswerability('whats_on_fire', coverage);
      expect(result.answerable).toBe(true);
    });

    it('source_mix_summary needs source data', () => {
      const coverage = buildFullCoverage();
      coverage.fieldCoverage['cand.source'] = 0;
      coverage.flags.hasSourceData = false;
      const result = checkAnswerability('source_mix_summary', coverage);
      expect(result.answerable).toBe(false);
      expect(result.blocked_capabilities).toContain('cap_source_data');
    });
  });

  describe('unlock_steps', () => {
    it('provides repair suggestions when blocked', () => {
      const coverage = buildEmptyCoverage();
      const result = checkAnswerability('whats_on_fire', coverage);
      expect(result.unlock_steps.length).toBeGreaterThan(0);
    });

    it('unlock steps have ui_copy for display', () => {
      const coverage = buildEmptyCoverage();
      const result = checkAnswerability('whats_on_fire', coverage);
      for (const step of result.unlock_steps) {
        expect(step.ui_copy.short_title).toBeTruthy();
        expect(step.ui_copy.cta_label).toBeTruthy();
      }
    });

    it('unlock steps include required columns', () => {
      const coverage = buildNoHMCoverage();
      const result = checkAnswerability('why_hm_latency', coverage);
      const hmRepair = result.unlock_steps.find(s => s.capability_key === 'cap_hm_assignment');
      expect(hmRepair).toBeDefined();
      expect(hmRepair!.required_columns).toContain('Hiring Manager');
    });
  });

  describe('buildBlockedResponse', () => {
    it('returns markdown with unlock steps', () => {
      const coverage = buildEmptyCoverage();
      const answerability = checkAnswerability('whats_on_fire', coverage);
      const response = buildBlockedResponse(answerability);

      expect(response.answer_markdown).toContain('Not Enough Data');
      expect(response.answer_markdown).toContain('How to unlock');
      expect(response.unlock_steps.length).toBeGreaterThan(0);
    });

    it('unlock steps have title, description, and action', () => {
      const coverage = buildNoHMCoverage();
      const answerability = checkAnswerability('why_hm_latency', coverage);
      const response = buildBlockedResponse(answerability);

      for (const step of response.unlock_steps) {
        expect(step.title).toBeTruthy();
        expect(step.description).toBeTruthy();
        expect(['import', 'demo', 'settings']).toContain(step.action);
      }
    });
  });

  describe('Partial data scenarios', () => {
    it('no-offers: why_time_to_offer blocked (needs hires)', () => {
      // Has timestamps but no hires
      const coverage = buildFullCoverage();
      coverage.sampleSizes.hires = 0;
      coverage.fieldCoverage['cand.hired_at'] = 0;
      const result = checkAnswerability('why_time_to_offer', coverage);
      expect(result.answerable).toBe(false);
    });

    it('no-events: stalled_reqs blocked', () => {
      const result = checkAnswerability('stalled_reqs', buildNoEventsCoverage());
      expect(result.answerable).toBe(false);
    });

    it('no-hm: capacity_summary still works (only needs recruiter)', () => {
      const result = checkAnswerability('capacity_summary', buildNoHMCoverage());
      expect(result.answerable).toBe(true);
    });
  });

  describe('Demo data validates all intents', () => {
    it('all intents are answerable with Ultimate Demo data', () => {
      const bundle = generateUltimateDemo('ask-gate-test', DEFAULT_PACK_CONFIG);
      const coverage = computeDemoCoverage(bundle);

      const failures: string[] = [];
      for (const intentId of Object.keys(INTENT_CAPABILITY_REQUIREMENTS)) {
        const result = checkAnswerability(intentId, coverage);
        if (!result.answerable) {
          failures.push(`${intentId}: ${result.reason}`);
        }
      }

      if (failures.length > 0) {
        console.log('Unanswerable intents with demo data:', failures);
      }
      expect(failures.length).toBe(0);
    });
  });
});
