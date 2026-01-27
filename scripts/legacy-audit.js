#!/usr/bin/env node
/**
 * Legacy Import Audit Script
 *
 * Scans V2 components for imports from _legacy/ directories and reports
 * unapproved legacy imports. Approved patterns allow specific V2 wrapper
 * components to embed legacy sub-components.
 *
 * Usage: node scripts/legacy-audit.js
 * Exit codes:
 *   0 - All imports are approved
 *   1 - Unapproved legacy imports found
 */

const fs = require('fs');
const path = require('path');

// Configuration
const V2_DIR = path.join(__dirname, '../src/productivity-dashboard/components/v2');
const LEGACY_IMPORT_PATTERN = /from\s+['"]\.\.?\/_legacy\//g;
const LEGACY_IMPORT_EXTRACT = /from\s+['"]([^'"]*_legacy[^'"]*)['"]/g;

// Approved legacy import patterns
// Format: { file: RegExp, allowedImports: string[] }
const APPROVED_PATTERNS = [
  {
    // DiagnoseTabV2 can embed these legacy components
    file: /DiagnoseTabV2\.tsx$/,
    allowedImports: [
      '../_legacy/bottlenecks',
      '../_legacy/quality',
      '../_legacy/source-effectiveness/SourceEffectivenessTab',
      '../_legacy/velocity-insights/VelocityInsightsTab',
    ],
  },
  {
    // PlanTabV2 can embed these legacy components
    file: /PlanTabV2\.tsx$/,
    allowedImports: [
      '../_legacy/capacity/CapacityTab',
      '../_legacy/capacity-rebalancer/CapacityRebalancerTab',
      '../_legacy/forecasting/ForecastingTab',
      '../_legacy/scenarios/ScenarioLibraryTab',
    ],
  },
  {
    // SettingsTabV2 can embed these legacy components
    file: /SettingsTabV2\.tsx$/,
    allowedImports: [
      '../_legacy/data-health/DataHealthTab',
      '../_legacy/settings/SlaSettingsTab',
      '../_legacy/settings/AiSettingsTab',
      '../_legacy/settings/OrgSettingsTab',
    ],
  },
];

function getV2Files() {
  if (!fs.existsSync(V2_DIR)) {
    console.error(`V2 directory not found: ${V2_DIR}`);
    process.exit(1);
  }

  return fs.readdirSync(V2_DIR)
    .filter(f => f.endsWith('.tsx') || f.endsWith('.ts'))
    .map(f => path.join(V2_DIR, f));
}

function findLegacyImports(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const imports = [];
  let match;

  while ((match = LEGACY_IMPORT_EXTRACT.exec(content)) !== null) {
    imports.push({
      path: match[1],
      line: content.substring(0, match.index).split('\n').length,
    });
  }

  return imports;
}

function isApproved(filePath, importPath) {
  const fileName = path.basename(filePath);

  for (const pattern of APPROVED_PATTERNS) {
    if (pattern.file.test(fileName)) {
      // Check if this import is in the allowed list
      return pattern.allowedImports.some(allowed => importPath.includes(allowed));
    }
  }

  // No approved pattern for this file - all legacy imports are violations
  return false;
}

function audit() {
  console.log('Legacy Import Audit');
  console.log('==================');
  console.log(`Scanning: ${V2_DIR}\n`);

  const files = getV2Files();
  const violations = [];
  const approved = [];

  for (const filePath of files) {
    const imports = findLegacyImports(filePath);
    const relativePath = path.relative(process.cwd(), filePath);

    for (const imp of imports) {
      if (isApproved(filePath, imp.path)) {
        approved.push({
          file: relativePath,
          import: imp.path,
          line: imp.line,
        });
      } else {
        violations.push({
          file: relativePath,
          import: imp.path,
          line: imp.line,
        });
      }
    }
  }

  // Report approved imports
  if (approved.length > 0) {
    console.log(`Approved legacy imports (${approved.length}):`);
    for (const a of approved) {
      console.log(`  [OK] ${a.file}:${a.line}`);
      console.log(`       ${a.import}`);
    }
    console.log('');
  }

  // Report violations
  if (violations.length > 0) {
    console.log(`VIOLATIONS (${violations.length}):`);
    for (const v of violations) {
      console.log(`  [ERROR] ${v.file}:${v.line}`);
      console.log(`          ${v.import}`);
    }
    console.log('');
    console.log('To fix violations:');
    console.log('  1. Use V2 components instead of legacy imports');
    console.log('  2. Or add the import to APPROVED_PATTERNS in scripts/legacy-audit.js');
    console.log('');
    process.exit(1);
  }

  console.log('All legacy imports are approved.');
  console.log(`Files scanned: ${files.length}`);
  console.log(`Approved imports: ${approved.length}`);
  console.log(`Violations: ${violations.length}`);
  process.exit(0);
}

audit();
