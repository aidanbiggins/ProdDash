#!/usr/bin/env node

/**
 * Reconnect Smoke Test
 *
 * Verifies that V0 UI reconnection is complete by simulating user navigation.
 * This is a static analysis test - it doesn't actually render components,
 * but verifies that all routes, imports, and data flows exist.
 */

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const SRC_DIR = path.join(PROJECT_ROOT, 'src/productivity-dashboard');

// Colors for output
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

let errors = [];
let warnings = [];
let passes = [];

function pass(msg) {
  passes.push(msg);
  console.log(`${GREEN}[PASS]${RESET} ${msg}`);
}

function warn(msg) {
  warnings.push(msg);
  console.log(`${YELLOW}[WARN]${RESET} ${msg}`);
}

function fail(msg) {
  errors.push(msg);
  console.log(`${RED}[FAIL]${RESET} ${msg}`);
}

function fileExists(relativePath) {
  const fullPath = path.join(PROJECT_ROOT, relativePath);
  return fs.existsSync(fullPath);
}

function fileContains(relativePath, pattern) {
  const fullPath = path.join(PROJECT_ROOT, relativePath);
  if (!fs.existsSync(fullPath)) return false;
  const content = fs.readFileSync(fullPath, 'utf8');
  return typeof pattern === 'string' ? content.includes(pattern) : pattern.test(content);
}

// ═══════════════════════════════════════════
// TEST: V2 Shell Components Exist
// ═══════════════════════════════════════════

console.log('\n--- V2 Shell Components ---');

const v2Components = [
  'src/productivity-dashboard/components/v2/AppLayoutV2.tsx',
  'src/productivity-dashboard/components/v2/TopNavV2.tsx',
  'src/productivity-dashboard/components/v2/CommandCenterV2.tsx',
  'src/productivity-dashboard/components/v2/AskPlatoVueV2.tsx',
  'src/productivity-dashboard/components/v2/DiagnoseTabV2.tsx',
  'src/productivity-dashboard/components/v2/PlanTabV2.tsx',
  'src/productivity-dashboard/components/v2/SettingsTabV2.tsx',
];

v2Components.forEach(file => {
  if (fileExists(file)) {
    pass(`V2 component exists: ${path.basename(file)}`);
  } else {
    fail(`V2 component missing: ${file}`);
  }
});

// ═══════════════════════════════════════════
// TEST: Baseline Components Are Wired
// ═══════════════════════════════════════════

console.log('\n--- Baseline Components Wired ---');

// PlanTabV2 should import baseline components
if (fileContains('src/productivity-dashboard/components/v2/PlanTabV2.tsx', "from '../capacity/CapacityTab'")) {
  pass('PlanTabV2 imports CapacityTab');
} else {
  fail('PlanTabV2 does NOT import CapacityTab');
}

if (fileContains('src/productivity-dashboard/components/v2/PlanTabV2.tsx', "from '../capacity-rebalancer/CapacityRebalancerTab'")) {
  pass('PlanTabV2 imports CapacityRebalancerTab');
} else {
  fail('PlanTabV2 does NOT import CapacityRebalancerTab');
}

if (fileContains('src/productivity-dashboard/components/v2/PlanTabV2.tsx', "from '../forecasting/ForecastingTab'")) {
  pass('PlanTabV2 imports ForecastingTab');
} else {
  fail('PlanTabV2 does NOT import ForecastingTab');
}

if (fileContains('src/productivity-dashboard/components/v2/PlanTabV2.tsx', "from '../scenarios/ScenarioLibraryTab'")) {
  pass('PlanTabV2 imports ScenarioLibraryTab');
} else {
  fail('PlanTabV2 does NOT import ScenarioLibraryTab');
}

// SettingsTabV2 should import baseline components
if (fileContains('src/productivity-dashboard/components/v2/SettingsTabV2.tsx', "from '../data-health/DataHealthTab'")) {
  pass('SettingsTabV2 imports DataHealthTab');
} else {
  fail('SettingsTabV2 does NOT import DataHealthTab');
}

if (fileContains('src/productivity-dashboard/components/v2/SettingsTabV2.tsx', "from '../settings/SlaSettingsTab'")) {
  pass('SettingsTabV2 imports SlaSettingsTab');
} else {
  fail('SettingsTabV2 does NOT import SlaSettingsTab');
}

if (fileContains('src/productivity-dashboard/components/v2/SettingsTabV2.tsx', "from '../settings/AiSettingsTab'")) {
  pass('SettingsTabV2 imports AiSettingsTab');
} else {
  fail('SettingsTabV2 does NOT import AiSettingsTab');
}

if (fileContains('src/productivity-dashboard/components/v2/SettingsTabV2.tsx', "from '../settings/OrgSettingsTab'")) {
  pass('SettingsTabV2 imports OrgSettingsTab');
} else {
  fail('SettingsTabV2 does NOT import OrgSettingsTab');
}

// ═══════════════════════════════════════════
// TEST: No Mock Data in V2 Components
// ═══════════════════════════════════════════

console.log('\n--- No Hardcoded Mock Data ---');

// Check that PlanTabV2 doesn't have sample data
if (!fileContains('src/productivity-dashboard/components/v2/PlanTabV2.tsx', 'sampleTeamCapacity')) {
  pass('PlanTabV2 has no hardcoded sampleTeamCapacity');
} else {
  fail('PlanTabV2 still has hardcoded sampleTeamCapacity');
}

if (!fileContains('src/productivity-dashboard/components/v2/SettingsTabV2.tsx', 'sampleDataHealth')) {
  pass('SettingsTabV2 has no hardcoded sampleDataHealth');
} else {
  fail('SettingsTabV2 still has hardcoded sampleDataHealth');
}

// ═══════════════════════════════════════════
// TEST: Navigation CTAs Are Wired
// ═══════════════════════════════════════════

console.log('\n--- Navigation CTAs Wired ---');

if (fileContains('src/productivity-dashboard/components/v2/CommandCenterV2.tsx', 'onNavigateToTab')) {
  pass('CommandCenterV2 has onNavigateToTab prop');
} else {
  fail('CommandCenterV2 missing onNavigateToTab prop');
}

if (fileContains('src/productivity-dashboard/components/v2/CommandCenterV2.tsx', 'onClick={handleViewHealthDetails}')) {
  pass('CommandCenterV2 Health CTA is wired');
} else {
  fail('CommandCenterV2 Health CTA not wired');
}

if (fileContains('src/productivity-dashboard/components/v2/CommandCenterV2.tsx', 'onClick={handleViewRisks}')) {
  pass('CommandCenterV2 Risks CTA is wired');
} else {
  fail('CommandCenterV2 Risks CTA not wired');
}

if (fileContains('src/productivity-dashboard/components/v2/CommandCenterV2.tsx', 'onClick={handleViewPipeline}')) {
  pass('CommandCenterV2 Pipeline CTA is wired');
} else {
  fail('CommandCenterV2 Pipeline CTA not wired');
}

// AppLayoutV2 should pass navigation callback to CommandCenterV2
if (fileContains('src/productivity-dashboard/components/v2/AppLayoutV2.tsx', '<CommandCenterV2 onNavigateToTab={handleNavigateToTab}')) {
  pass('AppLayoutV2 passes onNavigateToTab to CommandCenterV2');
} else {
  fail('AppLayoutV2 does NOT pass onNavigateToTab to CommandCenterV2');
}

// ═══════════════════════════════════════════
// TEST: Uses useDashboard Hook
// ═══════════════════════════════════════════

console.log('\n--- Data Flow (useDashboard) ---');

if (fileContains('src/productivity-dashboard/components/v2/PlanTabV2.tsx', 'useDashboard')) {
  pass('PlanTabV2 uses useDashboard hook');
} else {
  fail('PlanTabV2 does NOT use useDashboard hook');
}

if (fileContains('src/productivity-dashboard/components/v2/SettingsTabV2.tsx', 'useDashboard')) {
  pass('SettingsTabV2 uses useDashboard hook');
} else {
  fail('SettingsTabV2 does NOT use useDashboard hook');
}

if (fileContains('src/productivity-dashboard/components/v2/CommandCenterV2.tsx', 'useDashboard')) {
  pass('CommandCenterV2 uses useDashboard hook');
} else {
  fail('CommandCenterV2 does NOT use useDashboard hook');
}

// ═══════════════════════════════════════════
// SUMMARY
// ═══════════════════════════════════════════

console.log('\n═══════════════════════════════════════════');
console.log('RECONNECT SMOKE TEST SUMMARY');
console.log('═══════════════════════════════════════════');
console.log(`${GREEN}Passed:${RESET} ${passes.length}`);
console.log(`${YELLOW}Warnings:${RESET} ${warnings.length}`);
console.log(`${RED}Failed:${RESET} ${errors.length}`);

if (errors.length > 0) {
  console.log(`\n${RED}FAIL${RESET} - ${errors.length} critical issues found`);
  process.exit(1);
} else {
  console.log(`\n${GREEN}PASS${RESET} - All critical checks passed`);
  process.exit(0);
}
