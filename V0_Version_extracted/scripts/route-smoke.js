#!/usr/bin/env node
/**
 * Route Smoke Test Script
 *
 * Runs the route smoke tests via Jest to verify all routes render without crashing.
 * This script:
 * 1. Runs the route smoke test suite
 * 2. Reports pass/fail status for each route
 * 3. Fails if any route has console errors or crashes
 */

const { execSync } = require('child_process');
const path = require('path');

// Configuration
const SMOKE_TEST_PATH = 'src/productivity-dashboard/routes/__tests__/route-smoke.test.ts';

console.log('\n========================================');
console.log('  ROUTE SMOKE TEST');
console.log('========================================\n');

console.log('Running route smoke tests...\n');

try {
  // Run Jest with the specific smoke test file
  const result = execSync(
    `npm test -- --testPathPattern="${SMOKE_TEST_PATH}" --watchAll=false --verbose`,
    {
      cwd: path.join(__dirname, '..'),
      stdio: 'inherit',
      env: { ...process.env, CI: 'true' }
    }
  );

  console.log('\n✅ All route smoke tests passed!\n');
  process.exit(0);
} catch (error) {
  console.error('\n❌ Route smoke tests failed!\n');
  process.exit(1);
}
