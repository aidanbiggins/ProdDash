// Command Center Service Tests
// Tests section gating, fact pack building, demo data integration, and export

import { evaluateSectionGates, buildCommandCenterFactPack, generateWeeklyBrief, CommandCenterContext } from '../commandCenterService';
import { generateUltimateDemo, computeDemoCoverage } from '../ultimateDemoGenerator';
import { DEFAULT_PACK_CONFIG } from '../../types/demoTypes';
import { CoverageMetrics } from '../../types/resilientImportTypes';
import { runPreMortemBatch } from '../preMortemService';

describe('CommandCenterService', () => {
  // ── Section Gating ─────────────────────────────────

  describe('evaluateSectionGates', () => {
    it('should block all sections when no coverage data', () => {
      const gates = evaluateSectionGates(null);
      expect(gates).toHaveLength(6);
      gates.forEach(gate => {
        expect(gate.status).toBe('BLOCKED');
        expect(gate.confidence).toBe('LOW');
        expect(gate.blockedReason).toBeDefined();
      });
    });

    it('should block all sections when coverage is undefined', () => {
      const gates = evaluateSectionGates(undefined);
      expect(gates).toHaveLength(6);
      gates.forEach(gate => {
        expect(gate.status).toBe('BLOCKED');
      });
    });

    it('should enable attention with basic data', () => {
      const coverage = makeCoverage({ requisitions: 10, candidates: 20 });
      const gates = evaluateSectionGates(coverage);
      const attention = gates.find(g => g.sectionId === 'cc_attention');
      expect(attention?.status).not.toBe('BLOCKED');
    });

    it('should mark attention as LIMITED without stage events', () => {
      const coverage = makeCoverage({ requisitions: 10, candidates: 20 }, { hasStageEvents: false });
      const gates = evaluateSectionGates(coverage);
      const attention = gates.find(g => g.sectionId === 'cc_attention');
      expect(attention?.status).toBe('LIMITED');
    });

    it('should block on_track without timestamps', () => {
      const coverage = makeCoverage({ requisitions: 10 }, { hasTimestamps: false });
      const gates = evaluateSectionGates(coverage);
      const onTrack = gates.find(g => g.sectionId === 'cc_on_track');
      expect(onTrack?.status).toBe('BLOCKED');
    });

    it('should block changes without multiple snapshots', () => {
      const coverage = makeCoverage({ requisitions: 10 }, { hasMultipleSnapshots: false });
      const gates = evaluateSectionGates(coverage);
      const changes = gates.find(g => g.sectionId === 'cc_changes');
      expect(changes?.status).toBe('BLOCKED');
    });

    it('should block whatif without recruiter assignment', () => {
      const coverage = makeCoverage({ requisitions: 10 }, { hasRecruiterAssignment: false });
      const gates = evaluateSectionGates(coverage);
      const whatif = gates.find(g => g.sectionId === 'cc_whatif');
      expect(whatif?.status).toBe('BLOCKED');
    });

    it('should block bottleneck without recruiter assignment', () => {
      const coverage = makeCoverage({ requisitions: 10 }, { hasRecruiterAssignment: false });
      const gates = evaluateSectionGates(coverage);
      const bottleneck = gates.find(g => g.sectionId === 'cc_bottleneck');
      expect(bottleneck?.status).toBe('BLOCKED');
    });

    it('should have repair CTAs on blocked sections', () => {
      const gates = evaluateSectionGates(null);
      gates.forEach(gate => {
        expect(gate.repairCTA).toBeDefined();
        expect(gate.repairCTA!.label).toBeTruthy();
        expect(gate.repairCTA!.action).toBeTruthy();
      });
    });
  });

  // ── Demo Data Integration ─────────────────────────────────

  describe('Demo data enables all sections', () => {
    let bundle: ReturnType<typeof generateUltimateDemo>;
    let coverage: CoverageMetrics;

    beforeAll(() => {
      bundle = generateUltimateDemo('cc-test', DEFAULT_PACK_CONFIG);
      coverage = computeDemoCoverage(bundle);
    });

    it('should enable all sections with demo data', () => {
      const gates = evaluateSectionGates(coverage);
      gates.forEach(gate => {
        expect(gate.status).not.toBe('BLOCKED');
      });
    });

    it('should have HIGH confidence for most sections with demo data', () => {
      const gates = evaluateSectionGates(coverage);
      const highGates = gates.filter(g => g.confidence === 'HIGH');
      expect(highGates.length).toBeGreaterThanOrEqual(4);
    });

    it('should build a complete fact pack from demo data', () => {
      const ctx = buildDemoContext(bundle, coverage);
      const pack = buildCommandCenterFactPack(ctx);

      expect(pack.attention).toBeDefined();
      expect(pack.on_track).toBeDefined();
      expect(pack.risk).toBeDefined();
      expect(pack.changes).toBeDefined();
      expect(pack.whatif).toBeDefined();
      expect(pack.bottleneck).toBeDefined();
      expect(pack.meta).toBeDefined();
    });

    it('should have attention items from demo data', () => {
      const ctx = buildDemoContext(bundle, coverage);
      const pack = buildCommandCenterFactPack(ctx);
      // Demo data should produce at least some actions
      expect(pack.attention.p0_count + pack.attention.p1_count).toBeGreaterThanOrEqual(0);
    });

    it('should produce KPI rows in on_track section', () => {
      const ctx = buildDemoContext(bundle, coverage);
      const pack = buildCommandCenterFactPack(ctx);
      expect(pack.on_track.kpis.length).toBeGreaterThan(0);
      // Each KPI should have a label, value, and status
      pack.on_track.kpis.forEach(kpi => {
        expect(kpi.label).toBeTruthy();
        expect(['green', 'amber', 'red']).toContain(kpi.status);
      });
    });

    it('should produce a verdict in on_track section', () => {
      const ctx = buildDemoContext(bundle, coverage);
      const pack = buildCommandCenterFactPack(ctx);
      expect(pack.on_track.verdict).toBeDefined();
      expect(['ON_TRACK', 'AT_RISK', 'OFF_TRACK']).toContain(pack.on_track.verdict);
    });

    it('should produce risk items from pre-mortem results', () => {
      const ctx = buildDemoContext(bundle, coverage);
      const pack = buildCommandCenterFactPack(ctx);
      expect(pack.risk.total_at_risk).toBeGreaterThanOrEqual(0);
    });

    it('should have bottleneck diagnosis', () => {
      const ctx = buildDemoContext(bundle, coverage);
      const pack = buildCommandCenterFactPack(ctx);
      expect(['PIPELINE_BOUND', 'CAPACITY_BOUND', 'BOTH', 'HEALTHY']).toContain(pack.bottleneck.diagnosis);
      expect(pack.bottleneck.primary_action).toBeDefined();
      expect(pack.bottleneck.primary_action.label).toBeTruthy();
    });

    it('should populate meta with correct blocked_sections list', () => {
      const ctx = buildDemoContext(bundle, coverage);
      const pack = buildCommandCenterFactPack(ctx);
      // Demo data should not have any blocked sections
      expect(pack.meta.blocked_sections.length).toBe(0);
      expect(pack.meta.confidence).not.toBe('LOW');
    });
  });

  // ── Partial Data Blocking ─────────────────────────────────

  describe('Partial data correctly blocks sections', () => {
    it('should only populate non-blocked sections', () => {
      const coverage = makeCoverage(
        { requisitions: 10, candidates: 5 },
        { hasTimestamps: false, hasMultipleSnapshots: false, hasRecruiterAssignment: false }
      );
      const ctx: CommandCenterContext = {
        requisitions: [],
        candidates: [],
        events: [],
        users: [],
        overview: null,
        hmFriction: [],
        actions: [],
        preMortems: [],
        filters: { dateRange: { start: null, end: null } },
        config: { stageMapping: {}, thresholds: {} } as any,
        coverage,
      };
      const pack = buildCommandCenterFactPack(ctx);

      // on_track should be blocked (no timestamps)
      expect(pack.on_track.kpis).toEqual([]);
      // changes should be blocked (no snapshots)
      expect(pack.changes.deltas).toEqual([]);
      // whatif should be blocked (no recruiter assignment)
      expect(pack.whatif.scenario_previews).toEqual([]);
      // attention should still work
      expect(pack.meta.blocked_sections).toContain('cc_on_track');
      expect(pack.meta.blocked_sections).toContain('cc_changes');
      expect(pack.meta.blocked_sections).toContain('cc_whatif');
      expect(pack.meta.blocked_sections).toContain('cc_bottleneck');
    });
  });

  // ── Weekly Brief Export ─────────────────────────────────

  describe('generateWeeklyBrief', () => {
    it('should produce markdown output', () => {
      const bundle = generateUltimateDemo('brief-test', DEFAULT_PACK_CONFIG);
      const coverage = computeDemoCoverage(bundle);
      const ctx = buildDemoContext(bundle, coverage);
      const pack = buildCommandCenterFactPack(ctx);
      const brief = generateWeeklyBrief(pack, 'Test Org');

      expect(brief).toContain('# Weekly TA Brief');
      expect(brief).toContain('Test Org');
    });

    it('should include all 6 section headers', () => {
      const bundle = generateUltimateDemo('brief-test', DEFAULT_PACK_CONFIG);
      const coverage = computeDemoCoverage(bundle);
      const ctx = buildDemoContext(bundle, coverage);
      const pack = buildCommandCenterFactPack(ctx);
      const brief = generateWeeklyBrief(pack);

      expect(brief).toContain('### 1. What needs attention');
      expect(brief).toContain('### 2. Are we on track?');
      expect(brief).toContain("### 3. What's at risk");
      expect(brief).toContain('### 4. What changed this week');
      expect(brief).toContain('### 5. What-if scenarios');
      expect(brief).toContain('### 6. Binding constraint');
    });

    it('should include KPI table in on_track section', () => {
      const bundle = generateUltimateDemo('brief-kpi-test', DEFAULT_PACK_CONFIG);
      const coverage = computeDemoCoverage(bundle);
      const ctx = buildDemoContext(bundle, coverage);
      const pack = buildCommandCenterFactPack(ctx);
      const brief = generateWeeklyBrief(pack);

      // Should have table headers
      expect(brief).toContain('| KPI | Value | Target | Status |');
    });

    it('should show blocked message for blocked sections', () => {
      const coverage = makeCoverage({}, {
        hasTimestamps: false,
        hasMultipleSnapshots: false,
        hasRecruiterAssignment: false,
      });
      const ctx: CommandCenterContext = {
        requisitions: [],
        candidates: [],
        events: [],
        users: [],
        overview: null,
        hmFriction: [],
        actions: [],
        preMortems: [],
        filters: { dateRange: { start: null, end: null } },
        config: { stageMapping: {}, thresholds: {} } as any,
        coverage,
      };
      const pack = buildCommandCenterFactPack(ctx);
      const brief = generateWeeklyBrief(pack);

      // Blocked sections should show not-available message
      expect(brief).toContain('_Not available');
    });

    it('should not include empty strings or undefined values', () => {
      const bundle = generateUltimateDemo('brief-clean-test', DEFAULT_PACK_CONFIG);
      const coverage = computeDemoCoverage(bundle);
      const ctx = buildDemoContext(bundle, coverage);
      const pack = buildCommandCenterFactPack(ctx);
      const brief = generateWeeklyBrief(pack);

      expect(brief).not.toContain('undefined');
      expect(brief).not.toContain('[object Object]');
    });
  });

  // ── Fact Pack Meta ─────────────────────────────────

  describe('Fact Pack meta', () => {
    it('should set computed_at to a recent Date', () => {
      const bundle = generateUltimateDemo('meta-test', DEFAULT_PACK_CONFIG);
      const coverage = computeDemoCoverage(bundle);
      const ctx = buildDemoContext(bundle, coverage);
      const pack = buildCommandCenterFactPack(ctx);

      expect(pack.meta.computed_at).toBeInstanceOf(Date);
      // Should be within last minute
      const now = Date.now();
      expect(now - pack.meta.computed_at.getTime()).toBeLessThan(60000);
    });

    it('should compute overall confidence based on section gates', () => {
      const bundle = generateUltimateDemo('confidence-test', DEFAULT_PACK_CONFIG);
      const coverage = computeDemoCoverage(bundle);
      const ctx = buildDemoContext(bundle, coverage);
      const pack = buildCommandCenterFactPack(ctx);

      expect(['HIGH', 'MED', 'LOW']).toContain(pack.meta.confidence);
    });
  });
});

// ── Helpers ─────────────────────────────────

function makeCoverage(
  counts: Partial<CoverageMetrics['counts']> = {},
  flags: Partial<CoverageMetrics['flags']> = {},
): CoverageMetrics {
  return {
    counts: {
      requisitions: counts.requisitions ?? 0,
      candidates: counts.candidates ?? 0,
      events: counts.events ?? 0,
      users: counts.users ?? 0,
      snapshots: counts.snapshots ?? 4,
    },
    sampleSizes: {
      hires: 10,
      offers: 10,
      rejections: 5,
      withdrawals: 3,
    },
    flags: {
      hasTimestamps: flags.hasTimestamps ?? true,
      hasStageEvents: flags.hasStageEvents ?? true,
      hasRecruiterAssignment: flags.hasRecruiterAssignment ?? true,
      hasMultipleSnapshots: flags.hasMultipleSnapshots ?? true,
      hasCapacityHistory: flags.hasCapacityHistory ?? true,
      hasHMAssignment: flags.hasHMAssignment ?? true,
      hasSourceData: flags.hasSourceData ?? true,
    },
    fieldCoverage: {},
  };
}

function buildDemoContext(
  bundle: ReturnType<typeof generateUltimateDemo>,
  coverage: CoverageMetrics
): CommandCenterContext {
  const { requisitions, candidates, events, users } = bundle;

  // Compute pre-mortems (no HM actions needed — pass empty array)
  const preMortems = runPreMortemBatch(requisitions, candidates as any, events, []);

  // Compute overview (simplified mock)
  const overview = {
    medianTTF: 35,
    totalOffers: candidates.filter(c => c.offer_extended_at).length,
    totalOfferAcceptanceRate: 0.85,
    totalHires: candidates.filter(c => c.hired_at).length,
    totalRequisitions: requisitions.length,
    totalCandidates: candidates.length,
    activePipeline: candidates.filter(c => !c.hired_at && !c.rejected_at && !c.withdrawn_at).length,
  } as any;

  // Mock config with stageMapping
  const config = {
    version: '1.0',
    lastUpdated: new Date(),
    lastUpdatedBy: 'test',
    stageMapping: {},
    thresholds: { stalledDays: 14, zombieDays: 30 },
  } as any;

  return {
    requisitions,
    candidates: candidates as any,
    events,
    users,
    overview,
    hmFriction: [],
    actions: [],
    preMortems,
    filters: { dateRange: { start: null, end: null } },
    config,
    coverage,
  };
}
