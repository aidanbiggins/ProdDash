// Command Center CTA Deep-Link Sanity Check
// Verifies all primary CTAs route to valid TabType destinations.
// No dead clicks: every button resolves to a real route.

import { ROUTE_CONFIG, TabType } from '../../routes/routes';
import { buildCommandCenterFactPack, CommandCenterContext } from '../commandCenterService';
import { generateUltimateDemo, computeDemoCoverage } from '../ultimateDemoGenerator';
import { DEFAULT_PACK_CONFIG } from '../../types/demoTypes';
import { runPreMortemBatch } from '../preMortemService';

// All valid tab IDs from route config
const VALID_TABS = new Set<string>(ROUTE_CONFIG.map(r => r.tab));

// Hardcoded CTA targets used in CommandCenterView.tsx
const COMMAND_CENTER_CTA_TARGETS: string[] = [
  'overview',         // Attention section primary + details, On Track details, Changes details
  'forecasting',      // Risk section primary + details
  'scenarios',        // What-If section primary + details
  'capacity-rebalancer', // Bottleneck section primary + details
];

describe('Command Center CTA Deep Links', () => {
  describe('Hardcoded CTA targets are valid TabTypes', () => {
    COMMAND_CENTER_CTA_TARGETS.forEach(target => {
      it(`"${target}" resolves to a valid route`, () => {
        expect(VALID_TABS.has(target)).toBe(true);
        const route = ROUTE_CONFIG.find(r => r.tab === target);
        expect(route).toBeDefined();
        expect(route!.path).toBeTruthy();
      });
    });

    it('all CTA targets are non-empty strings', () => {
      COMMAND_CENTER_CTA_TARGETS.forEach(target => {
        expect(target).toBeTruthy();
        expect(target.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Bottleneck navigation_target values are valid', () => {
    let bundle: ReturnType<typeof generateUltimateDemo>;

    beforeAll(() => {
      bundle = generateUltimateDemo('deeplink-test', DEFAULT_PACK_CONFIG);
    });

    it('bottleneck primary_action.navigation_target is a valid TabType', () => {
      const coverage = computeDemoCoverage(bundle);
      const ctx = buildDemoContext(bundle, coverage);
      const pack = buildCommandCenterFactPack(ctx);

      const target = pack.bottleneck.primary_action.navigation_target;
      // Empty target means section shows no button (graceful degradation)
      if (target) {
        expect(VALID_TABS.has(target)).toBe(true);
      }
    });

    it('all possible bottleneck navigation targets are valid', () => {
      // These are the targets from commandCenterService.ts bottleneck builder
      const bottleneckTargets = ['capacity-rebalancer', 'overview', 'velocity'];
      bottleneckTargets.forEach(target => {
        expect(VALID_TABS.has(target)).toBe(true);
      });
    });
  });

  describe('No dead-click scenarios', () => {
    it('every CTA target has a corresponding path', () => {
      const allTargets = [...COMMAND_CENTER_CTA_TARGETS, 'capacity-rebalancer', 'overview', 'velocity'];
      const uniqueTargets = [...new Set(allTargets)];

      uniqueTargets.forEach(target => {
        const route = ROUTE_CONFIG.find(r => r.tab === target);
        expect(route).toBeDefined();
        expect(route!.path).not.toBe('/'); // Should not fall back to root
      });
    });

    it('CTA targets cover all expected navigation buckets', () => {
      const allTargets = [...COMMAND_CENTER_CTA_TARGETS, 'velocity'];
      const buckets = new Set(
        allTargets.map(t => ROUTE_CONFIG.find(r => r.tab === t)?.bucket)
      );

      // Command center CTAs should link to diagnose and plan buckets
      expect(buckets.has('diagnose')).toBe(true);
      expect(buckets.has('plan')).toBe(true);
    });
  });
});

// ── Helper ─────────────────────────────────

function buildDemoContext(
  bundle: ReturnType<typeof generateUltimateDemo>,
  coverage: ReturnType<typeof computeDemoCoverage>
): CommandCenterContext {
  const { requisitions, candidates, events, users } = bundle;
  const preMortems = runPreMortemBatch(requisitions, candidates as any, events, []);

  const overview = {
    medianTTF: 35,
    totalOffers: candidates.filter(c => c.offer_extended_at).length,
    totalOfferAcceptanceRate: 0.85,
    totalHires: candidates.filter(c => c.hired_at).length,
    totalRequisitions: requisitions.length,
    totalCandidates: candidates.length,
    activePipeline: candidates.filter(c => !c.hired_at && !c.rejected_at && !c.withdrawn_at).length,
  } as any;

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
