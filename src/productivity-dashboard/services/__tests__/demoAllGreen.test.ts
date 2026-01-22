// Demo All Green Test - Diagnostic test to identify disabled capabilities
// This test identifies which capabilities are disabled and why

import { generateUltimateDemo, computeDemoCoverage } from '../ultimateDemoGenerator';
import { DEFAULT_PACK_CONFIG } from '../../types/demoTypes';
import { getAllCapabilityStatuses, CAPABILITY_REGISTRY } from '../capabilityRegistry';

describe('Demo All Green - Diagnostic', () => {
  it('diagnoses disabled capabilities with All Features preset', () => {
    const bundle = generateUltimateDemo('all-green-test', DEFAULT_PACK_CONFIG);
    const coverage = computeDemoCoverage(bundle);
    const capabilities = getAllCapabilityStatuses(coverage);

    console.log('\n=== DEMO DATA COVERAGE ===');
    console.log('Counts:', coverage.counts);
    console.log('Sample Sizes:', coverage.sampleSizes);
    console.log('Flags:', coverage.flags);
    console.log('Field Coverage:', coverage.fieldCoverage);

    console.log('\n=== CAPABILITY STATUS ===');
    const disabled = capabilities.filter(c => !c.enabled);
    const enabled = capabilities.filter(c => c.enabled);

    console.log(`Enabled: ${enabled.length}/${capabilities.length}`);
    console.log(`Disabled: ${disabled.length}/${capabilities.length}`);

    if (disabled.length > 0) {
      console.log('\n=== DISABLED CAPABILITIES ===');
      for (const cap of disabled) {
        console.log(`\n[DISABLED] ${cap.displayName} (${cap.id})`);
        console.log(`  Reason: ${cap.disabledReason}`);
        console.log(`  Requirements:`);
        for (const req of cap.requirements) {
          const status = req.met ? '✓' : '✗';
          console.log(`    ${status} ${req.description} (current: ${req.currentValue}, required: ${req.requiredValue})`);
        }
      }
    }

    // Assert all capabilities are enabled for All Features preset
    if (disabled.length > 0) {
      console.log('\n=== REQUIRED FIXES ===');
      for (const cap of disabled) {
        for (const req of cap.requirements.filter(r => !r.met)) {
          console.log(`- ${cap.displayName}: ${req.description}`);
        }
      }
    }

    // This will fail if there are disabled capabilities, showing diagnostic info
    expect(disabled.length).toBe(0);
  });

  it('checks event from_stage coverage', () => {
    // Use same seed as main diagnostic test for consistency
    const bundle = generateUltimateDemo('all-green-test', DEFAULT_PACK_CONFIG);

    // Check from_stage coverage
    const eventsWithFromStage = bundle.events.filter(e => e.from_stage != null && e.from_stage !== '');
    const totalEvents = bundle.events.length;
    const fromStageCoverage = eventsWithFromStage.length / totalEvents;

    console.log(`\n=== EVENT FROM_STAGE ANALYSIS ===`);
    console.log(`Total events: ${totalEvents}`);
    console.log(`Events with from_stage: ${eventsWithFromStage.length}`);
    console.log(`From_stage coverage: ${(fromStageCoverage * 100).toFixed(1)}%`);
    console.log(`Required coverage: 70%`);

    // Check what events are missing from_stage
    const eventsWithoutFromStage = bundle.events.filter(e => e.from_stage == null || e.from_stage === '');
    if (eventsWithoutFromStage.length > 0) {
      console.log(`\nSample events WITHOUT from_stage:`);
      for (const e of eventsWithoutFromStage.slice(0, 5)) {
        console.log(`  - ${e.event_id}: from=${e.from_stage} to=${e.to_stage}`);
      }
    }

    // This coverage needs to be >= 70% for Bottlenecks & SLAs
    expect(fromStageCoverage).toBeGreaterThanOrEqual(0.7);
  });

  it('checks hired_at coverage for TTF chart', () => {
    // Use same seed as main diagnostic test for consistency
    const bundle = generateUltimateDemo('all-green-test', DEFAULT_PACK_CONFIG);

    const candidatesWithHiredAt = bundle.candidates.filter(c => c.hired_at != null);
    const totalCandidates = bundle.candidates.length;
    const hiredAtCoverage = candidatesWithHiredAt.length / totalCandidates;

    console.log(`\n=== HIRED_AT COVERAGE ANALYSIS ===`);
    console.log(`Total candidates: ${totalCandidates}`);
    console.log(`Candidates with hired_at: ${candidatesWithHiredAt.length}`);
    console.log(`Hired_at coverage: ${(hiredAtCoverage * 100).toFixed(1)}%`);
    console.log(`Required coverage: 10%`);

    // This coverage needs to be >= 10% for TTF chart
    expect(hiredAtCoverage).toBeGreaterThanOrEqual(0.1);
  });
});
