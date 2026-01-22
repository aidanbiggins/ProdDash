#!/usr/bin/env node
/**
 * Demo Data Verification Script
 * Validates that the Ultimate Demo generator produces correct, consistent data
 *
 * Usage: npm run demo:verify
 *
 * Checks:
 * 1. Determinism - Same seed produces identical output
 * 2. Referential Integrity - All foreign keys reference valid records
 * 3. Required Fields - No missing required fields
 * 4. Data Quality - Reasonable distributions and counts
 * 5. Pack Dependencies - Dependencies are auto-enabled correctly
 */

const path = require('path');
const fs = require('fs');

// Mock Date for deterministic tests
const FIXED_NOW = new Date('2025-01-15T12:00:00Z');

// We need to run this through ts-node or compile first
// For now, we'll validate using Jest tests and this script summarizes

console.log('='.repeat(60));
console.log('  ULTIMATE DEMO DATA VERIFICATION');
console.log('='.repeat(60));
console.log();

// Check if demo tests exist and pass
const testFile = path.join(__dirname, '../src/productivity-dashboard/services/__tests__/ultimateDemoGenerator.test.ts');
if (!fs.existsSync(testFile)) {
  console.error('ERROR: Test file not found at:', testFile);
  process.exit(1);
}

console.log('[CHECK] Test file exists:', testFile);

// Check if types file exists
const typesFile = path.join(__dirname, '../src/productivity-dashboard/types/demoTypes.ts');
if (!fs.existsSync(typesFile)) {
  console.error('ERROR: Types file not found at:', typesFile);
  process.exit(1);
}

console.log('[CHECK] Types file exists:', typesFile);

// Check if generator file exists
const generatorFile = path.join(__dirname, '../src/productivity-dashboard/services/ultimateDemoGenerator.ts');
if (!fs.existsSync(generatorFile)) {
  console.error('ERROR: Generator file not found at:', generatorFile);
  process.exit(1);
}

console.log('[CHECK] Generator file exists:', generatorFile);

// Check if modal file exists
const modalFile = path.join(__dirname, '../src/productivity-dashboard/components/common/UltimateDemoModal.tsx');
if (!fs.existsSync(modalFile)) {
  console.error('ERROR: Modal file not found at:', modalFile);
  process.exit(1);
}

console.log('[CHECK] Modal file exists:', modalFile);

console.log();
console.log('All required files present!');
console.log();
console.log('Running verification tests...');
console.log();

// Run Jest tests for the demo generator
const { execSync } = require('child_process');

// Test 1: Run demo generator tests
console.log('[RUNNING] Demo generator tests...');
let generatorPassed = 0;
let generatorFailed = 0;

try {
  const output = execSync(
    'npm test -- --testPathPattern="ultimateDemoGenerator" --watchAll=false --reporters=default 2>&1',
    {
      cwd: path.join(__dirname, '..'),
      encoding: 'utf8',
      timeout: 60000
    }
  );

  // Parse test results
  const passMatch = output.match(/Tests:\s+(\d+)\s+passed/);
  const failMatch = output.match(/Tests:\s+(\d+)\s+failed/);

  generatorPassed = passMatch ? parseInt(passMatch[1]) : 0;
  generatorFailed = failMatch ? parseInt(failMatch[1]) : 0;

} catch (error) {
  console.error('[ERROR] Generator tests failed:');
  if (error.stdout) console.error(error.stdout);
  process.exit(1);
}

// Test 2: Run "All Green" test to ensure all features are enabled with default config
console.log('[RUNNING] All-features-enabled verification...');
let allGreenPassed = 0;
let allGreenFailed = 0;

try {
  const output = execSync(
    'npm test -- --testPathPattern="demoAllGreen" --watchAll=false --reporters=default 2>&1',
    {
      cwd: path.join(__dirname, '..'),
      encoding: 'utf8',
      timeout: 60000
    }
  );

  // Parse test results
  const passMatch = output.match(/Tests:\s+(\d+)\s+passed/);
  const failMatch = output.match(/Tests:\s+(\d+)\s+failed/);

  allGreenPassed = passMatch ? parseInt(passMatch[1]) : 0;
  allGreenFailed = failMatch ? parseInt(failMatch[1]) : 0;

  // Also check for the "Enabled: 15/15" in output
  const enabledMatch = output.match(/Enabled:\s+(\d+)\/(\d+)/);
  if (enabledMatch) {
    const enabled = parseInt(enabledMatch[1]);
    const total = parseInt(enabledMatch[2]);
    console.log(`  [CHECK] Capabilities enabled: ${enabled}/${total}`);
    if (enabled < total) {
      console.error(`  [ERROR] Not all capabilities are enabled! Expected ${total}/${total}`);
      allGreenFailed++;
    }
  }

} catch (error) {
  console.error('[ERROR] All-green test failed:');
  if (error.stdout) console.error(error.stdout);
  process.exit(1);
}

// Summary
const totalPassed = generatorPassed + allGreenPassed;
const totalFailed = generatorFailed + allGreenFailed;

console.log();
console.log('='.repeat(60));
console.log('  TEST RESULTS');
console.log('='.repeat(60));
console.log();
console.log(`  Generator Tests:   ${generatorPassed} passed, ${generatorFailed} failed`);
console.log(`  All-Green Tests:   ${allGreenPassed} passed, ${allGreenFailed} failed`);
console.log(`  Total:             ${totalPassed} passed, ${totalFailed} failed`);
console.log();

if (totalFailed === 0) {
  console.log('  [SUCCESS] All demo verification tests passed!');
  console.log();
  console.log('  Verification Summary:');
  console.log('  - Determinism: Same seed produces identical output');
  console.log('  - Record Counts: Minimum thresholds met');
  console.log('  - Pack Dependencies: Auto-enabled correctly');
  console.log('  - Capability Gating: Features gate on pack config');
  console.log('  - Synthetic PII: Safe patterns (example.com, 555 phones)');
  console.log('  - AI Stubs: All key intents covered');
  console.log('  - Data Quality: All required fields present');
  console.log('  - Referential Integrity: All FKs valid');
  console.log('  - ALL FEATURES GREEN: All 15 capabilities enabled with default config');
  console.log();
  process.exit(0);
} else {
  console.log('  [FAILURE] Some tests failed!');
  console.log();
  console.log('  Possible issues:');
  if (generatorFailed > 0) {
    console.log('  - Demo generator tests have failures (check ultimateDemoGenerator.test.ts)');
  }
  if (allGreenFailed > 0) {
    console.log('  - All-green verification failed (some capabilities are disabled)');
    console.log('  - Run: npm test -- --testPathPattern="demoAllGreen" --watchAll=false');
    console.log('    to see which capabilities are disabled and why');
  }
  process.exit(1);
}
