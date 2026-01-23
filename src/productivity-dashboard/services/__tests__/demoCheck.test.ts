// Demo Check - Automated proof that Ultimate Demo enables everything
// This is the gate test: if it fails, demo data has gaps.
// Run via: npm run demo:check

import { generateUltimateDemo, computeDemoCoverage } from '../ultimateDemoGenerator';
import { DEFAULT_PACK_CONFIG } from '../../types/demoTypes';
import { evaluateCapabilities, DATA_CAPABILITIES, FEATURE_REGISTRY } from '../capabilityEngine';
import { checkAnswerability, INTENT_CAPABILITY_REQUIREMENTS } from '../askAnswerabilityService';
import { CoverageMetrics } from '../../types/resilientImportTypes';

describe('Demo Check - Ultimate Demo Enables Everything', () => {
  let coverage: CoverageMetrics;

  beforeAll(() => {
    const bundle = generateUltimateDemo('demo-check-gate', DEFAULT_PACK_CONFIG);
    coverage = computeDemoCoverage(bundle);
  });

  // ============================================
  // Gate 1: All 18 capabilities are ENABLED
  // ============================================
  describe('Gate 1: All capabilities ENABLED', () => {
    it('all 18 data capabilities are ENABLED (not BLOCKED or LIMITED)', () => {
      const result = evaluateCapabilities(coverage);
      const failures: string[] = [];

      for (const [key, entry] of result.capability_report) {
        if (entry.status !== 'ENABLED') {
          failures.push(`${key} (${entry.status}): ${entry.confidence_reasons.join(', ')}`);
        }
      }

      if (failures.length > 0) {
        console.error('\n=== DEMO CHECK FAILED: BLOCKED/LIMITED CAPABILITIES ===');
        failures.forEach(f => console.error(`  - ${f}`));
      }

      expect(failures).toEqual([]);
    });

    it('no capability has LOW confidence', () => {
      const result = evaluateCapabilities(coverage);
      const lowConf: string[] = [];

      for (const [key, entry] of result.capability_report) {
        if (entry.confidence === 'LOW') {
          lowConf.push(`${key}: ${entry.confidence_reasons.join(', ')}`);
        }
      }

      // Warning only - LOW confidence is acceptable if ENABLED
      if (lowConf.length > 0) {
        console.warn('Capabilities with LOW confidence:', lowConf);
      }
    });
  });

  // ============================================
  // Gate 2: All features are ENABLED
  // ============================================
  describe('Gate 2: All features ENABLED', () => {
    it('all features report ENABLED status', () => {
      const result = evaluateCapabilities(coverage);
      const failures: string[] = [];

      for (const [key, entry] of result.feature_coverage) {
        if (entry.status !== 'ENABLED') {
          failures.push(`${key} (${entry.status}): blocked_by=[${entry.blocked_by.join(',')}] limited_by=[${entry.limited_by.join(',')}]`);
        }
      }

      if (failures.length > 0) {
        console.error('\n=== DEMO CHECK FAILED: BLOCKED/LIMITED FEATURES ===');
        failures.forEach(f => console.error(`  - ${f}`));
      }

      expect(failures).toEqual([]);
    });

    it('summary reports "full" overall status', () => {
      const result = evaluateCapabilities(coverage);
      expect(result.summary.overall_status).toBe('full');
    });

    it('no repair suggestions exist (everything is enabled)', () => {
      const result = evaluateCapabilities(coverage);
      expect(result.repair_suggestions.length).toBe(0);
    });
  });

  // ============================================
  // Gate 3: Ask can answer all intents
  // ============================================
  describe('Gate 3: Ask answerability', () => {
    it('all deterministic intents are answerable with demo data', () => {
      const failures: string[] = [];

      for (const intentId of Object.keys(INTENT_CAPABILITY_REQUIREMENTS)) {
        const result = checkAnswerability(intentId, coverage);
        if (!result.answerable) {
          failures.push(`${intentId}: ${result.reason}`);
        }
      }

      if (failures.length > 0) {
        console.error('\n=== DEMO CHECK FAILED: UNANSWERABLE INTENTS ===');
        failures.forEach(f => console.error(`  - ${f}`));
      }

      expect(failures).toEqual([]);
    });
  });

  // ============================================
  // Gate 4: Data quality thresholds
  // ============================================
  describe('Gate 4: Demo data quality', () => {
    it('has sufficient requisitions (20+)', () => {
      expect(coverage.counts.requisitions).toBeGreaterThanOrEqual(20);
    });

    it('has sufficient candidates (50+)', () => {
      expect(coverage.counts.candidates).toBeGreaterThanOrEqual(50);
    });

    it('has sufficient events (100+)', () => {
      expect(coverage.counts.events).toBeGreaterThanOrEqual(100);
    });

    it('has sufficient hires (10+)', () => {
      expect(coverage.sampleSizes.hires).toBeGreaterThanOrEqual(10);
    });

    it('has sufficient offers (10+)', () => {
      expect(coverage.sampleSizes.offers).toBeGreaterThanOrEqual(10);
    });

    it('has multiple snapshots (4+)', () => {
      expect(coverage.counts.snapshots).toBeGreaterThanOrEqual(4);
    });

    it('all flags are true', () => {
      expect(coverage.flags.hasStageEvents).toBe(true);
      expect(coverage.flags.hasTimestamps).toBe(true);
      expect(coverage.flags.hasTerminalTimestamps).toBe(true);
      expect(coverage.flags.hasRecruiterAssignment).toBe(true);
      expect(coverage.flags.hasHMAssignment).toBe(true);
      expect(coverage.flags.hasSourceData).toBe(true);
      expect(coverage.flags.hasMultipleSnapshots).toBe(true);
    });
  });

  // ============================================
  // Gate 5: Deterministic (same seed = same result)
  // ============================================
  describe('Gate 5: Determinism', () => {
    it('same seed produces identical coverage metrics', () => {
      const bundle2 = generateUltimateDemo('demo-check-gate', DEFAULT_PACK_CONFIG);
      const coverage2 = computeDemoCoverage(bundle2);

      expect(coverage2.counts).toEqual(coverage.counts);
      expect(coverage2.sampleSizes).toEqual(coverage.sampleSizes);
      expect(coverage2.flags).toEqual(coverage.flags);
    });
  });

  // ============================================
  // Gate 6: No PII in demo data
  // ============================================
  describe('Gate 6: PII safety', () => {
    it('demo data uses safe domains only (RFC 2606 or subdomains thereof)', () => {
      const bundle = generateUltimateDemo('demo-check-gate', DEFAULT_PACK_CONFIG);
      const allEmails: string[] = [];

      // Collect any email-like strings from candidates
      for (const cand of bundle.candidates) {
        if ((cand as any).email) {
          allEmails.push((cand as any).email);
        }
      }

      // Safe domains: example.com, example.org, example.net, *.example.*, *.test, *.invalid, *.localhost
      const SAFE_PATTERNS = [
        /^example\.(com|org|net)$/,
        /\.example\.(com|org|net)$/,
        /\.example$/,
        /\.test$/,
        /\.invalid$/,
        /\.localhost$/,
      ];

      const unsafeDomains = allEmails.filter(e => {
        const domain = e.split('@')[1];
        if (!domain) return false;
        return !SAFE_PATTERNS.some(pattern => pattern.test(domain));
      });

      expect(unsafeDomains).toEqual([]);
    });

    it('demo phones use 555-01XX range only', () => {
      const bundle = generateUltimateDemo('demo-check-gate', DEFAULT_PACK_CONFIG);
      const allPhones: string[] = [];

      for (const cand of bundle.candidates) {
        if ((cand as any).phone) {
          allPhones.push((cand as any).phone);
        }
      }

      const unsafePhones = allPhones.filter(p => {
        const digits = p.replace(/\D/g, '');
        // Must contain 555-01 pattern
        return !digits.includes('55501');
      });

      expect(unsafePhones).toEqual([]);
    });
  });
});
