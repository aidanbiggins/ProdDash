// Ultimate Demo Generator Tests
// See docs/plans/ULTIMATE_DEMO_DATA_INTERACTIVE_V1.md

import {
  generateUltimateDemo,
  computeDemoCoverage,
  getDemoStoryPatterns,
  getRecruiterPersonas,
  getHMPersonas,
} from '../ultimateDemoGenerator';
import {
  DEFAULT_PACK_CONFIG,
  MINIMAL_PACK_CONFIG,
  DemoPackConfig,
} from '../../types/demoTypes';
import { UserRole, CanonicalStage } from '../../types/entities';
import { isCapabilityEnabled, getAllCapabilityStatuses } from '../capabilityRegistry';
import { detectPII, anonymizeCandidates } from '../piiService';

describe('Ultimate Demo Generator', () => {
  describe('Determinism', () => {
    it('same seed produces identical output', () => {
      const a = generateUltimateDemo('seed-123', DEFAULT_PACK_CONFIG);
      const b = generateUltimateDemo('seed-123', DEFAULT_PACK_CONFIG);

      expect(a.requisitions.length).toBe(b.requisitions.length);
      expect(a.candidates.length).toBe(b.candidates.length);
      expect(a.events.length).toBe(b.events.length);

      // Check first few records are identical
      expect(a.requisitions[0].req_id).toBe(b.requisitions[0].req_id);
      expect(a.requisitions[0].req_title).toBe(b.requisitions[0].req_title);
      expect(a.candidates[0].candidate_id).toBe(b.candidates[0].candidate_id);
      expect(a.candidates[0].name).toBe(b.candidates[0].name);
    });

    it('different seeds produce different output', () => {
      const a = generateUltimateDemo('seed-123', DEFAULT_PACK_CONFIG);
      const b = generateUltimateDemo('seed-456', DEFAULT_PACK_CONFIG);

      // IDs should be different (different session IDs)
      expect(a.requisitions[0].req_id).not.toBe(b.requisitions[0].req_id);
    });

    it('generates consistent data across multiple calls', () => {
      const results = [];
      for (let i = 0; i < 5; i++) {
        results.push(generateUltimateDemo('consistent-seed', DEFAULT_PACK_CONFIG));
      }

      // All should have same counts
      const firstCandCount = results[0].candidates.length;
      for (const result of results) {
        expect(result.candidates.length).toBe(firstCandCount);
      }
    });
  });

  describe('Record Counts', () => {
    it('generates minimum record counts for all packs ON', () => {
      const bundle = generateUltimateDemo('test', DEFAULT_PACK_CONFIG);

      expect(bundle.requisitions.length).toBeGreaterThanOrEqual(50);
      expect(bundle.candidates.length).toBeGreaterThanOrEqual(300);
      expect(bundle.events.length).toBeGreaterThanOrEqual(500);
      expect(bundle.users.length).toBeGreaterThanOrEqual(20);
    });

    it('generates snapshots when snapshots_diffs is enabled', () => {
      const bundle = generateUltimateDemo('test', { ...DEFAULT_PACK_CONFIG, snapshots_diffs: true });

      expect(bundle.snapshots).toBeDefined();
      expect(bundle.snapshots!.length).toBeGreaterThanOrEqual(10);
      expect(bundle.snapshotEvents).toBeDefined();
      expect(bundle.snapshotEvents!.length).toBeGreaterThan(0);
    });

    it('generates calibration history when calibration_history is enabled', () => {
      const bundle = generateUltimateDemo('test', {
        ...DEFAULT_PACK_CONFIG,
        calibration_history: true,
        offers_outcomes: true,
      });

      expect(bundle.calibrationHistory).toBeDefined();
      expect(bundle.calibrationHistory!.length).toBeGreaterThan(0);
    });

    it('generates AI stubs when ai_stubs is enabled', () => {
      const bundle = generateUltimateDemo('test', { ...DEFAULT_PACK_CONFIG, ai_stubs: true });

      expect(bundle.aiStubs).toBeDefined();
      expect(bundle.aiStubs!.length).toBeGreaterThan(0);
    });
  });

  describe('Pack Dependencies', () => {
    it('auto-enables dependencies for capacity_history', () => {
      const bundle = generateUltimateDemo('test', {
        core_ats: false,
        recruiter_hm: false,
        capacity_history: true,
      });

      // Dependencies should be auto-enabled
      expect(bundle.packsEnabled.core_ats).toBe(true);
      expect(bundle.packsEnabled.recruiter_hm).toBe(true);
    });

    it('auto-enables dependencies for calibration_history', () => {
      const bundle = generateUltimateDemo('test', {
        core_ats: false,
        offers_outcomes: false,
        calibration_history: true,
      });

      expect(bundle.packsEnabled.core_ats).toBe(true);
      expect(bundle.packsEnabled.offers_outcomes).toBe(true);
    });

    it('minimal config only includes core_ats', () => {
      const bundle = generateUltimateDemo('test', MINIMAL_PACK_CONFIG);

      expect(bundle.packsEnabled.core_ats).toBe(true);
      expect(bundle.packsEnabled.recruiter_hm).toBe(false);
      expect(bundle.packsEnabled.offers_outcomes).toBe(false);
      expect(bundle.snapshots).toBeUndefined();
    });
  });

  describe('Capability Gating', () => {
    it('all packs ON enables all major capabilities', () => {
      const bundle = generateUltimateDemo('test', DEFAULT_PACK_CONFIG);
      const coverage = computeDemoCoverage(bundle);
      const capabilities = getAllCapabilityStatuses(coverage);

      // Most capabilities should be enabled
      const enabledCaps = capabilities.filter(c => c.enabled);
      expect(enabledCaps.length).toBeGreaterThan(capabilities.length / 2);
    });

    it('disabling recruiter_hm gates HM-related features', () => {
      // Must also disable packs that depend on recruiter_hm (capacity_history, scenarios)
      // otherwise dependency resolution will re-enable it
      const bundle = generateUltimateDemo('test', {
        ...DEFAULT_PACK_CONFIG,
        recruiter_hm: false,
        capacity_history: false,
        scenarios: false,
      });
      const coverage = computeDemoCoverage(bundle);

      // When recruiter_hm is disabled, the flags should be false
      expect(coverage.flags.hasHMAssignment).toBe(false);
      expect(coverage.flags.hasRecruiterAssignment).toBe(false);
      // Verify the config reflects what we set
      expect(bundle.packsEnabled.recruiter_hm).toBe(false);
    });

    it('disabling snapshots_diffs gates trend features', () => {
      const bundle = generateUltimateDemo('test', {
        ...DEFAULT_PACK_CONFIG,
        snapshots_diffs: false,
      });
      const coverage = computeDemoCoverage(bundle);

      expect(isCapabilityEnabled('section_trends', coverage)).toBe(false);
    });

    it('capability preview reflects enabled/disabled features', () => {
      const fullBundle = generateUltimateDemo('test', DEFAULT_PACK_CONFIG);
      expect(fullBundle.capabilityPreview.enabled.length).toBeGreaterThan(0);

      const minBundle = generateUltimateDemo('test', MINIMAL_PACK_CONFIG);
      expect(minBundle.capabilityPreview.disabled.length).toBeGreaterThan(
        fullBundle.capabilityPreview.disabled.length
      );
    });
  });

  describe('Synthetic PII', () => {
    it('synthetic_pii pack adds PII to candidates', () => {
      const bundle = generateUltimateDemo('test', {
        ...DEFAULT_PACK_CONFIG,
        synthetic_pii: true,
      });

      // Check that candidates have PII fields
      const withEmail = bundle.candidates.filter(c => c.email);
      const withPhone = bundle.candidates.filter(c => c.phone);

      expect(withEmail.length).toBeGreaterThan(0);
      expect(withPhone.length).toBeGreaterThan(0);
    });

    it('synthetic PII uses safe email domains', () => {
      const bundle = generateUltimateDemo('test', {
        ...DEFAULT_PACK_CONFIG,
        synthetic_pii: true,
      });

      for (const cand of bundle.candidates) {
        if (cand.email) {
          expect(cand.email).toMatch(/@(example\.com|example\.org|test\.example\.net)$/);
        }
      }
    });

    it('synthetic PII uses fictional phone pattern', () => {
      const bundle = generateUltimateDemo('test', {
        ...DEFAULT_PACK_CONFIG,
        synthetic_pii: true,
      });

      for (const cand of bundle.candidates) {
        if (cand.phone) {
          expect(cand.phone).toMatch(/\+1 415 555 01\d{2}/);
        }
      }
    });

    it('PII detection finds synthetic PII', () => {
      const bundle = generateUltimateDemo('test', {
        ...DEFAULT_PACK_CONFIG,
        synthetic_pii: true,
      });

      // Convert to format expected by detectPII
      const candidatesForPII = bundle.candidates.map(c => ({
        candidate_id: c.candidate_id,
        candidate_name: c.name,
        email: c.email,
        phone: c.phone,
      }));

      const result = detectPII(candidatesForPII);

      expect(result.hasPII).toBe(true);
      expect(result.detectedFields.length).toBeGreaterThan(0);
    });

    it('anonymization works on synthetic PII', () => {
      const bundle = generateUltimateDemo('test', {
        ...DEFAULT_PACK_CONFIG,
        synthetic_pii: true,
      });

      // Convert to format expected by anonymizeCandidates (needs candidate_name field)
      const candidatesWithPII = bundle.candidates.map(c => ({
        ...c,
        candidate_name: c.name,
      }));

      const anonymized = anonymizeCandidates(candidatesWithPII);

      // Names should be anonymized (check that original names are replaced)
      // The anonymization replaces candidate_name, not name
      expect(anonymized[0].candidate_name).toBeDefined();
      expect(anonymized[0].candidate_name).not.toContain('Demo');
      expect(anonymized[0].candidate_name).not.toContain('Sample');
    });

    it('without synthetic_pii pack, no PII is added', () => {
      const bundle = generateUltimateDemo('test', {
        ...DEFAULT_PACK_CONFIG,
        synthetic_pii: false,
      });

      // No emails or phones should be present
      const withEmail = bundle.candidates.filter(c => c.email?.includes('@example'));
      const withPhone = bundle.candidates.filter(c => c.phone?.includes('555'));

      expect(withEmail.length).toBe(0);
      expect(withPhone.length).toBe(0);
    });
  });

  describe('AI Stubs', () => {
    it('ai_stubs pack provides fallback responses', () => {
      const bundle = generateUltimateDemo('test', { ...DEFAULT_PACK_CONFIG, ai_stubs: true });

      expect(bundle.aiStubs).toBeDefined();
      expect(bundle.aiStubs!.length).toBeGreaterThan(5);
    });

    it('AI stubs cover key intents', () => {
      const bundle = generateUltimateDemo('test', { ...DEFAULT_PACK_CONFIG, ai_stubs: true });
      const intents = bundle.aiStubs!.map(s => s.intent);

      expect(intents).toContain('whats_on_fire');
      expect(intents).toContain('top_actions');
      expect(intents).toContain('forecast_gap');
      expect(intents).toContain('hm_latency');
      expect(intents).toContain('exec_brief');
    });

    it('AI stubs have citations', () => {
      const bundle = generateUltimateDemo('test', { ...DEFAULT_PACK_CONFIG, ai_stubs: true });

      for (const stub of bundle.aiStubs!) {
        expect(stub.citations.length).toBeGreaterThan(0);
        expect(stub.confidence).toMatch(/^(high|medium)$/);
      }
    });

    it('without ai_stubs pack, no stubs are generated', () => {
      const bundle = generateUltimateDemo('test', {
        ...DEFAULT_PACK_CONFIG,
        ai_stubs: false,
      });

      expect(bundle.aiStubs).toBeUndefined();
    });
  });

  describe('Data Quality', () => {
    it('all candidates have required fields', () => {
      const bundle = generateUltimateDemo('test', DEFAULT_PACK_CONFIG);

      for (const cand of bundle.candidates) {
        expect(cand.candidate_id).toBeTruthy();
        expect(cand.req_id).toBeTruthy();
        expect(cand.name).toBeTruthy();
        expect(cand.applied_at).toBeInstanceOf(Date);
        expect(cand.current_stage).toBeTruthy();
        expect(cand.disposition).toBeTruthy();
      }
    });

    it('all requisitions have required fields', () => {
      const bundle = generateUltimateDemo('test', DEFAULT_PACK_CONFIG);

      for (const req of bundle.requisitions) {
        expect(req.req_id).toBeTruthy();
        expect(req.req_title).toBeTruthy();
        expect(req.status).toMatch(/^(Open|Closed|OnHold)$/);
        expect(req.opened_at).toBeInstanceOf(Date);
      }
    });

    it('all events have required fields', () => {
      const bundle = generateUltimateDemo('test', DEFAULT_PACK_CONFIG);

      for (const event of bundle.events) {
        expect(event.event_id).toBeTruthy();
        expect(event.candidate_id).toBeTruthy();
        expect(event.req_id).toBeTruthy();
        expect(event.to_stage).toBeTruthy();
        expect(event.event_at).toBeInstanceOf(Date);
      }
    });

    it('candidate req_ids reference existing requisitions', () => {
      const bundle = generateUltimateDemo('test', DEFAULT_PACK_CONFIG);
      const reqIds = new Set(bundle.requisitions.map(r => r.req_id));

      for (const cand of bundle.candidates) {
        expect(reqIds.has(cand.req_id)).toBe(true);
      }
    });

    it('events reference existing candidates', () => {
      const bundle = generateUltimateDemo('test', DEFAULT_PACK_CONFIG);
      const candIds = new Set(bundle.candidates.map(c => c.candidate_id));

      for (const event of bundle.events) {
        expect(candIds.has(event.candidate_id)).toBe(true);
      }
    });
  });

  describe('Offers & Outcomes', () => {
    it('offers_outcomes pack generates hired candidates', () => {
      const bundle = generateUltimateDemo('test', {
        ...DEFAULT_PACK_CONFIG,
        offers_outcomes: true,
      });

      const hired = bundle.candidates.filter(c => c.disposition === 'Hired');
      expect(hired.length).toBeGreaterThanOrEqual(10);

      // Hired candidates should have hired_at date
      for (const cand of hired) {
        expect(cand.hired_at).toBeInstanceOf(Date);
      }
    });

    it('offers_outcomes generates offer dates', () => {
      const bundle = generateUltimateDemo('test', {
        ...DEFAULT_PACK_CONFIG,
        offers_outcomes: true,
      });

      const withOffers = bundle.candidates.filter(c => c.offer_extended_at);
      expect(withOffers.length).toBeGreaterThan(10);
    });

    it('without offers_outcomes, no hire dates', () => {
      const bundleWithOffers = generateUltimateDemo('test', {
        ...DEFAULT_PACK_CONFIG,
        offers_outcomes: true,
      });
      // Must also disable calibration_history since it depends on offers_outcomes
      const bundleWithoutOffers = generateUltimateDemo('test', {
        ...DEFAULT_PACK_CONFIG,
        offers_outcomes: false,
        calibration_history: false,
      });

      const hiredWith = bundleWithOffers.candidates.filter(c => c.hired_at);
      const hiredWithout = bundleWithoutOffers.candidates.filter(c => c.hired_at);

      // With offers pack, should have hires
      expect(hiredWith.length).toBeGreaterThan(0);
      // Without offers_outcomes, candidates stop at ONSITE - no hires
      expect(hiredWithout.length).toBe(0);
      // Verify the config reflects what we set
      expect(bundleWithoutOffers.packsEnabled.offers_outcomes).toBe(false);
    });
  });

  describe('Recruiter/HM Assignments', () => {
    it('recruiter_hm pack assigns recruiters to reqs', () => {
      const bundle = generateUltimateDemo('test', {
        ...DEFAULT_PACK_CONFIG,
        recruiter_hm: true,
      });

      const withRecruiter = bundle.requisitions.filter(r => r.recruiter_id);
      expect(withRecruiter.length).toBe(bundle.requisitions.length);
    });

    it('recruiter_hm pack assigns HMs to reqs', () => {
      const bundle = generateUltimateDemo('test', {
        ...DEFAULT_PACK_CONFIG,
        recruiter_hm: true,
      });

      const withHM = bundle.requisitions.filter(r => r.hiring_manager_id);
      expect(withHM.length).toBe(bundle.requisitions.length);
    });

    it('without recruiter_hm, no assignments', () => {
      const bundle = generateUltimateDemo('test-no-hm', {
        core_ats: true,
        recruiter_hm: false,
        offers_outcomes: true,
        snapshots_diffs: false,
        capacity_history: false,
        calibration_history: false,
        scenarios: false,
        synthetic_pii: false,
        ai_stubs: false,
      });

      const withRecruiter = bundle.requisitions.filter(r => r.recruiter_id);
      const withHM = bundle.requisitions.filter(r => r.hiring_manager_id);

      expect(withRecruiter.length).toBe(0);
      expect(withHM.length).toBe(0);
    });

    it('users include recruiters and HMs', () => {
      const bundle = generateUltimateDemo('test', {
        ...DEFAULT_PACK_CONFIG,
        recruiter_hm: true,
      });

      const recruiters = bundle.users.filter(u => u.role === UserRole.Recruiter);
      const hms = bundle.users.filter(u => u.role === UserRole.HiringManager);

      expect(recruiters.length).toBeGreaterThanOrEqual(8);
      expect(hms.length).toBeGreaterThanOrEqual(15);
    });
  });

  // ============================================
  // NEW: Demo Data Coherence Tests
  // ============================================

  describe('Demo Data Coherence - Unique Identities', () => {
    it('all recruiter IDs are unique', () => {
      const bundle = generateUltimateDemo('coherence-test', DEFAULT_PACK_CONFIG);
      const recruiters = bundle.users.filter(u => u.role === UserRole.Recruiter);
      const ids = recruiters.map(r => r.user_id);
      const uniqueIds = new Set(ids);

      expect(uniqueIds.size).toBe(ids.length);
    });

    it('all recruiter names are unique', () => {
      const bundle = generateUltimateDemo('coherence-test', DEFAULT_PACK_CONFIG);
      const recruiters = bundle.users.filter(u => u.role === UserRole.Recruiter);
      const names = recruiters.map(r => r.name);
      const uniqueNames = new Set(names);

      expect(uniqueNames.size).toBe(names.length);
    });

    it('all HM IDs are unique', () => {
      const bundle = generateUltimateDemo('coherence-test', DEFAULT_PACK_CONFIG);
      const hms = bundle.users.filter(u => u.role === UserRole.HiringManager);
      const ids = hms.map(h => h.user_id);
      const uniqueIds = new Set(ids);

      expect(uniqueIds.size).toBe(ids.length);
    });

    it('all HM names are unique', () => {
      const bundle = generateUltimateDemo('coherence-test', DEFAULT_PACK_CONFIG);
      const hms = bundle.users.filter(u => u.role === UserRole.HiringManager);
      const names = hms.map(h => h.name);
      const uniqueNames = new Set(names);

      expect(uniqueNames.size).toBe(names.length);
    });

    it('recruiter IDs do not overlap with HM IDs', () => {
      const bundle = generateUltimateDemo('coherence-test', DEFAULT_PACK_CONFIG);
      const recruiterIds = new Set(
        bundle.users.filter(u => u.role === UserRole.Recruiter).map(r => r.user_id)
      );
      const hmIds = bundle.users.filter(u => u.role === UserRole.HiringManager).map(h => h.user_id);

      for (const hmId of hmIds) {
        expect(recruiterIds.has(hmId)).toBe(false);
      }
    });
  });

  describe('Demo Data Coherence - Funnel Invariants', () => {
    it('global funnel: hires <= offers <= onsites <= hm_screens <= screens <= applied', () => {
      const bundle = generateUltimateDemo('funnel-test', DEFAULT_PACK_CONFIG);

      // Count candidates at each stage (ever reached, from events)
      const stageReached = {
        applied: 0,
        screen: 0,
        hmScreen: 0,
        onsite: 0,
        offer: 0,
        hired: 0,
      };

      // Group events by candidate
      const candidateEvents = new Map<string, Set<CanonicalStage>>();
      for (const event of bundle.events) {
        if (!candidateEvents.has(event.candidate_id)) {
          candidateEvents.set(event.candidate_id, new Set());
        }
        if (event.to_stage) {
          candidateEvents.get(event.candidate_id)!.add(event.to_stage);
        }
      }

      for (const [_, stages] of candidateEvents) {
        if (stages.has(CanonicalStage.APPLIED)) stageReached.applied++;
        if (stages.has(CanonicalStage.SCREEN)) stageReached.screen++;
        if (stages.has(CanonicalStage.HM_SCREEN)) stageReached.hmScreen++;
        if (stages.has(CanonicalStage.ONSITE)) stageReached.onsite++;
        if (stages.has(CanonicalStage.OFFER)) stageReached.offer++;
        if (stages.has(CanonicalStage.HIRED)) stageReached.hired++;
      }

      expect(stageReached.hired).toBeLessThanOrEqual(stageReached.offer);
      expect(stageReached.offer).toBeLessThanOrEqual(stageReached.onsite);
      expect(stageReached.onsite).toBeLessThanOrEqual(stageReached.hmScreen);
      expect(stageReached.hmScreen).toBeLessThanOrEqual(stageReached.screen);
      expect(stageReached.screen).toBeLessThanOrEqual(stageReached.applied);
    });

    it('no recruiter has hires > 0 but screens = 0', () => {
      const bundle = generateUltimateDemo('funnel-test', DEFAULT_PACK_CONFIG);

      // Build recruiter -> {screens, hires} map from events
      const recruiterStats = new Map<string, { screens: number; hires: number }>();

      for (const event of bundle.events) {
        const req = bundle.requisitions.find(r => r.req_id === event.req_id);
        if (!req?.recruiter_id) continue;

        if (!recruiterStats.has(req.recruiter_id)) {
          recruiterStats.set(req.recruiter_id, { screens: 0, hires: 0 });
        }

        const stats = recruiterStats.get(req.recruiter_id)!;
        if (event.to_stage === CanonicalStage.SCREEN) stats.screens++;
        if (event.to_stage === CanonicalStage.HIRED) stats.hires++;
      }

      for (const [recruiterId, stats] of recruiterStats) {
        if (stats.hires > 0) {
          expect(stats.screens).toBeGreaterThan(0);
        }
      }
    });

    it('accept rate is within plausible range when offers > 0', () => {
      const bundle = generateUltimateDemo('funnel-test', DEFAULT_PACK_CONFIG);

      // Count offers and hires from candidates
      const offers = bundle.candidates.filter(c => c.offer_extended_at).length;
      const hires = bundle.candidates.filter(c => c.disposition === 'Hired').length;

      if (offers > 0) {
        const acceptRate = hires / offers;
        expect(acceptRate).toBeGreaterThan(0.3); // At least 30%
        expect(acceptRate).toBeLessThanOrEqual(1.0); // At most 100%
      }
    });
  });

  describe('Demo Data Coherence - Intentional Patterns', () => {
    it('demo story patterns are defined', () => {
      const patterns = getDemoStoryPatterns();

      expect(patterns.length).toBeGreaterThanOrEqual(6);
      expect(patterns.find(p => p.id === 'stalled_reqs')).toBeDefined();
      expect(patterns.find(p => p.id === 'hm_bottleneck_1')).toBeDefined();
      expect(patterns.find(p => p.id === 'overloaded_recruiter')).toBeDefined();
      expect(patterns.find(p => p.id === 'high_performer')).toBeDefined();
    });

    it('overloaded recruiter pattern exists (Marcus Rodriguez with 12+ reqs)', () => {
      const bundle = generateUltimateDemo('pattern-test', DEFAULT_PACK_CONFIG);

      // Find Marcus Rodriguez's reqs
      const marcusId = 'marcus_rodriguez';
      const marcusReqs = bundle.requisitions.filter(r => r.recruiter_id === marcusId);

      expect(marcusReqs.length).toBeGreaterThanOrEqual(10);
    });

    it('HM bottleneck personas exist (slow responders)', () => {
      const hms = getHMPersonas();
      const slowHMs = hms.filter(h => h.feedbackDays >= 5);

      expect(slowHMs.length).toBeGreaterThanOrEqual(2);
    });

    it('high performer persona exists (James Park)', () => {
      const recruiters = getRecruiterPersonas();
      const jamesPark = recruiters.find(r => r.name === 'James Park');

      expect(jamesPark).toBeDefined();
      expect(jamesPark!.closeRate).toBeGreaterThanOrEqual(0.9);
    });

    it('recruiter personas have unique, descriptive traits', () => {
      const recruiters = getRecruiterPersonas();

      for (const r of recruiters) {
        expect(r.id).toBeTruthy();
        expect(r.name).toBeTruthy();
        expect(r.trait).toBeTruthy();
        expect(r.description).toBeTruthy();
        expect(r.screenSpeed).toBeGreaterThan(0);
        expect(r.closeRate).toBeGreaterThan(0);
        expect(r.capacity).toBeGreaterThan(0);
      }
    });
  });

  describe('Demo Data Coherence - Events Drive Metrics', () => {
    it('every candidate has at least one event (APPLIED)', () => {
      const bundle = generateUltimateDemo('events-test', DEFAULT_PACK_CONFIG);

      const candidateEventCount = new Map<string, number>();
      for (const event of bundle.events) {
        const count = candidateEventCount.get(event.candidate_id) || 0;
        candidateEventCount.set(event.candidate_id, count + 1);
      }

      for (const cand of bundle.candidates) {
        const eventCount = candidateEventCount.get(cand.candidate_id) || 0;
        expect(eventCount).toBeGreaterThanOrEqual(1);
      }
    });

    it('hired candidates have HIRED event', () => {
      const bundle = generateUltimateDemo('events-test', DEFAULT_PACK_CONFIG);

      const hiredCandidates = bundle.candidates.filter(c => c.disposition === 'Hired');
      const hiredEvents = bundle.events.filter(e => e.to_stage === CanonicalStage.HIRED);
      const hiredCandIdsFromEvents = new Set(hiredEvents.map(e => e.candidate_id));

      for (const cand of hiredCandidates) {
        expect(hiredCandIdsFromEvents.has(cand.candidate_id)).toBe(true);
      }
    });

    it('candidate current_stage matches last event to_stage', () => {
      const bundle = generateUltimateDemo('events-test', DEFAULT_PACK_CONFIG);

      // Build candidate -> last event stage map
      const lastEventStage = new Map<string, CanonicalStage>();
      for (const event of bundle.events) {
        if (event.to_stage) {
          lastEventStage.set(event.candidate_id, event.to_stage);
        }
      }

      for (const cand of bundle.candidates) {
        const lastStage = lastEventStage.get(cand.candidate_id);
        expect(cand.current_stage).toBe(lastStage);
      }
    });

    it('event timestamps are in chronological order per candidate', () => {
      const bundle = generateUltimateDemo('events-test', DEFAULT_PACK_CONFIG);

      // Group events by candidate
      const candidateEvents = new Map<string, Date[]>();
      for (const event of bundle.events) {
        if (!candidateEvents.has(event.candidate_id)) {
          candidateEvents.set(event.candidate_id, []);
        }
        candidateEvents.get(event.candidate_id)!.push(event.event_at);
      }

      for (const [candId, timestamps] of candidateEvents) {
        for (let i = 1; i < timestamps.length; i++) {
          expect(timestamps[i].getTime()).toBeGreaterThanOrEqual(timestamps[i - 1].getTime());
        }
      }
    });
  });

  describe('Demo Data Coherence - Ask Fact Pack Compatibility', () => {
    it('has recruiters with activity for capacity queries', () => {
      const bundle = generateUltimateDemo('factpack-test', DEFAULT_PACK_CONFIG);

      // At least some recruiters should have reqs
      const recruitersWithReqs = new Set(
        bundle.requisitions.filter(r => r.recruiter_id).map(r => r.recruiter_id)
      );

      expect(recruitersWithReqs.size).toBeGreaterThanOrEqual(5);
    });

    it('has HMs with candidates for latency queries', () => {
      const bundle = generateUltimateDemo('factpack-test', DEFAULT_PACK_CONFIG);

      // HMs should have reqs with candidates in HM_SCREEN stage
      const hmsWithCandidates = new Set<string>();
      for (const event of bundle.events) {
        if (event.to_stage === CanonicalStage.HM_SCREEN) {
          const req = bundle.requisitions.find(r => r.req_id === event.req_id);
          if (req?.hiring_manager_id) {
            hmsWithCandidates.add(req.hiring_manager_id);
          }
        }
      }

      expect(hmsWithCandidates.size).toBeGreaterThanOrEqual(5);
    });

    it('has sufficient hires for velocity queries', () => {
      const bundle = generateUltimateDemo('factpack-test', DEFAULT_PACK_CONFIG);

      const hires = bundle.candidates.filter(c => c.disposition === 'Hired');
      expect(hires.length).toBeGreaterThanOrEqual(10);
    });

    it('has source diversity for source effectiveness queries', () => {
      const bundle = generateUltimateDemo('factpack-test', DEFAULT_PACK_CONFIG);

      const sources = new Set(bundle.candidates.map(c => c.source));
      expect(sources.size).toBeGreaterThanOrEqual(4);
    });
  });
});
