// Capability Registry Tests
// Tests for capability gating based on data coverage

import {
  CAPABILITY_REGISTRY,
  checkCapability,
  getAllCapabilityStatuses,
  isCapabilityEnabled,
  getEnabledFeatures,
  getDisabledFeatures,
} from '../capabilityRegistry';
import { CoverageMetrics } from '../../types/resilientImportTypes';
import { createEmptyCoverageMetrics } from '../coverageMetricsService';

describe('CapabilityRegistry', () => {
  // Helper to create coverage metrics with specific values
  function createCoverage(overrides: Partial<CoverageMetrics>): CoverageMetrics {
    const base = createEmptyCoverageMetrics();
    return {
      ...base,
      ...overrides,
      counts: { ...base.counts, ...overrides.counts },
      fieldCoverage: { ...base.fieldCoverage, ...overrides.fieldCoverage },
      flags: { ...base.flags, ...overrides.flags },
      sampleSizes: { ...base.sampleSizes, ...overrides.sampleSizes },
    };
  }

  describe('checkCapability', () => {
    it('enables capability when all requirements are met', () => {
      const coverage = createCoverage({
        counts: { requisitions: 100, candidates: 500, events: 1000, users: 10, snapshots: 1 },
        flags: { hasStageEvents: true, hasTimestamps: true, hasTerminalTimestamps: true, hasRecruiterAssignment: true, hasHMAssignment: true, hasSourceData: true, hasMultipleSnapshots: false },
        fieldCoverage: {
          'req.recruiter_id': 0.9,
          'req.hiring_manager_id': 0.9,
          'req.opened_at': 0.9,
          'req.closed_at': 0.3,
          'req.status': 0.9,
          'cand.applied_at': 0.8,
          'cand.current_stage': 0.9,
          'cand.hired_at': 0.2,
          'cand.rejected_at': 0.3,
          'cand.source': 0.7,
          'cand.name': 0.9,
          'event.from_stage': 0.8,
          'event.to_stage': 0.8,
          'event.actor_user_id': 0.7,
          'event.event_at': 0.9,
        },
      });

      const hmFriction = CAPABILITY_REGISTRY.find(c => c.id === 'tab_hm_friction')!;
      const status = checkCapability(hmFriction, coverage);

      expect(status.enabled).toBe(true);
      expect(status.disabledReason).toBeUndefined();
    });

    it('disables capability when requirements are not met', () => {
      const coverage = createCoverage({
        counts: { requisitions: 10, candidates: 50, events: 10, users: 5, snapshots: 1 },
        flags: { hasStageEvents: false, hasTimestamps: false, hasTerminalTimestamps: false, hasRecruiterAssignment: false, hasHMAssignment: false, hasSourceData: false, hasMultipleSnapshots: false },
      });

      const hmFriction = CAPABILITY_REGISTRY.find(c => c.id === 'tab_hm_friction')!;
      const status = checkCapability(hmFriction, coverage);

      expect(status.enabled).toBe(false);
      expect(status.disabledReason).toBeDefined();
      expect(status.upgradeHint).toBeDefined();
    });

    it('tracks individual requirement status', () => {
      // Create coverage that meets some but not all requirements for HM Friction
      // HM Friction requires: hasHMAssignment, hasStageEvents, events >= 50
      const coverage = createCoverage({
        counts: { requisitions: 10, candidates: 50, events: 30, users: 5, snapshots: 1 }, // events < 50, so this req not met
        flags: { hasStageEvents: true, hasTimestamps: true, hasTerminalTimestamps: false, hasRecruiterAssignment: false, hasHMAssignment: true, hasSourceData: false, hasMultipleSnapshots: false },
      });

      const hmFriction = CAPABILITY_REGISTRY.find(c => c.id === 'tab_hm_friction')!;
      const status = checkCapability(hmFriction, coverage);

      // Should have some met (hasHMAssignment, hasStageEvents) and some unmet (events count)
      const metCount = status.requirements.filter(r => r.met).length;
      const unmetCount = status.requirements.filter(r => !r.met).length;

      expect(metCount).toBeGreaterThan(0);
      expect(unmetCount).toBeGreaterThan(0);
    });
  });

  describe('isCapabilityEnabled', () => {
    it('returns true for unknown capability IDs', () => {
      const coverage = createEmptyCoverageMetrics();
      expect(isCapabilityEnabled('unknown_capability', coverage)).toBe(true);
    });

    it('returns false when requirements not met', () => {
      const coverage = createEmptyCoverageMetrics();
      expect(isCapabilityEnabled('tab_hm_friction', coverage)).toBe(false);
    });

    it('returns true when all requirements met', () => {
      const coverage = createCoverage({
        counts: { requisitions: 100, candidates: 500, events: 100, users: 10, snapshots: 1 },
        flags: { hasStageEvents: true, hasTimestamps: true, hasTerminalTimestamps: true, hasRecruiterAssignment: true, hasHMAssignment: true, hasSourceData: true, hasMultipleSnapshots: false },
      });
      expect(isCapabilityEnabled('tab_control_tower', coverage)).toBe(true);
    });
  });

  describe('getAllCapabilityStatuses', () => {
    it('returns status for all capabilities', () => {
      const coverage = createEmptyCoverageMetrics();
      const statuses = getAllCapabilityStatuses(coverage);

      expect(statuses.length).toBe(CAPABILITY_REGISTRY.length);
      statuses.forEach(status => {
        expect(status.id).toBeDefined();
        expect(status.displayName).toBeDefined();
        expect(typeof status.enabled).toBe('boolean');
      });
    });
  });

  describe('getEnabledFeatures and getDisabledFeatures', () => {
    it('correctly categorizes features', () => {
      const coverage = createCoverage({
        counts: { requisitions: 100, candidates: 500, events: 0, users: 10, snapshots: 1 },
        flags: { hasStageEvents: false, hasTimestamps: true, hasTerminalTimestamps: true, hasRecruiterAssignment: true, hasHMAssignment: false, hasSourceData: false, hasMultipleSnapshots: false },
      });

      const enabled = getEnabledFeatures(coverage);
      const disabled = getDisabledFeatures(coverage);

      // Control Tower should be enabled (just needs requisitions)
      expect(enabled).toContain('Control Tower');

      // HM Friction should be disabled (needs HM assignment and events)
      const hmFrictionDisabled = disabled.find(d => d.name === 'HM Friction');
      expect(hmFrictionDisabled).toBeDefined();
      expect(hmFrictionDisabled?.hint).toBeDefined();
    });
  });

  describe('Capability gating behaves correctly', () => {
    it('tabs use replace behavior when disabled', () => {
      const tabCapabilities = CAPABILITY_REGISTRY.filter(c => c.uiType === 'tab');

      tabCapabilities.forEach(cap => {
        expect(cap.whenDisabled.behavior).toBe('replace');
        expect(cap.whenDisabled.replacementComponent).toBeDefined();
      });
    });

    it('widgets use hide behavior when disabled', () => {
      const widgetCapabilities = CAPABILITY_REGISTRY.filter(c => c.uiType === 'widget');

      widgetCapabilities.forEach(cap => {
        expect(cap.whenDisabled.behavior).toBe('hide');
      });
    });

    it('all capabilities have upgrade hints', () => {
      CAPABILITY_REGISTRY.forEach(cap => {
        expect(cap.whenDisabled.message).toBeDefined();
        expect(cap.whenDisabled.message.length).toBeGreaterThan(0);
      });
    });
  });
});
