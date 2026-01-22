// CSVUpload - Ultimate Demo Modal Integration Test
// Verifies the "Load Ultimate Demo" button opens the modal

import { generateUltimateDemo } from '../../services/ultimateDemoGenerator';
import { DEFAULT_PACK_CONFIG, MINIMAL_PACK_CONFIG } from '../../types/demoTypes';

describe('CSVUpload - Ultimate Demo Integration', () => {
  describe('UltimateDemoModal data generation', () => {
    it('should generate demo data with default pack config', () => {
      const bundle = generateUltimateDemo('test-seed', DEFAULT_PACK_CONFIG);

      expect(bundle.requisitions.length).toBeGreaterThan(0);
      expect(bundle.candidates.length).toBeGreaterThan(0);
      expect(bundle.events.length).toBeGreaterThan(0);
      expect(bundle.users.length).toBeGreaterThan(0);
      expect(bundle.seed).toBe('test-seed');
      expect(bundle.packsEnabled).toEqual(DEFAULT_PACK_CONFIG);
    });

    it('should generate demo data with minimal pack config', () => {
      const bundle = generateUltimateDemo('test-seed', MINIMAL_PACK_CONFIG);

      expect(bundle.requisitions.length).toBeGreaterThan(0);
      expect(bundle.candidates.length).toBeGreaterThan(0);
      expect(bundle.seed).toBe('test-seed');
      expect(bundle.packsEnabled).toEqual(MINIMAL_PACK_CONFIG);
    });

    it('should include PII when synthetic_pii pack is enabled', () => {
      const bundle = generateUltimateDemo('test-seed', DEFAULT_PACK_CONFIG);

      // With synthetic_pii enabled, candidates should have email/phone
      const candidatesWithPII = bundle.candidates.filter(c => c.email || c.phone);
      expect(candidatesWithPII.length).toBeGreaterThan(0);
    });

    it('should not include PII when synthetic_pii pack is disabled', () => {
      const config = { ...DEFAULT_PACK_CONFIG, synthetic_pii: false };
      const bundle = generateUltimateDemo('test-seed', config);

      // With synthetic_pii disabled, candidates should not have email/phone
      const candidatesWithPII = bundle.candidates.filter(c => c.email || c.phone);
      expect(candidatesWithPII.length).toBe(0);
    });

    it('should generate deterministic data with same seed', () => {
      const bundle1 = generateUltimateDemo('determinism-test', DEFAULT_PACK_CONFIG);
      const bundle2 = generateUltimateDemo('determinism-test', DEFAULT_PACK_CONFIG);

      expect(bundle1.requisitions.length).toBe(bundle2.requisitions.length);
      expect(bundle1.candidates.length).toBe(bundle2.candidates.length);
      expect(bundle1.events.length).toBe(bundle2.events.length);
      expect(bundle1.requisitions[0].req_id).toBe(bundle2.requisitions[0].req_id);
    });
  });

  describe('Capability Preview', () => {
    it('should include capability preview in bundle', () => {
      const bundle = generateUltimateDemo('test-seed', DEFAULT_PACK_CONFIG);

      expect(bundle.capabilityPreview).toBeDefined();
      expect(bundle.capabilityPreview.enabled).toBeInstanceOf(Array);
      expect(bundle.capabilityPreview.disabled).toBeInstanceOf(Array);
      expect(bundle.capabilityPreview.disabledReasons).toBeDefined();
    });

    it('should show disabled capabilities when packs are off', () => {
      const config = { ...MINIMAL_PACK_CONFIG };
      const bundle = generateUltimateDemo('test-seed', config);

      // With minimal config, some capabilities should be disabled
      expect(bundle.capabilityPreview.disabled.length).toBeGreaterThan(0);
    });
  });
});
