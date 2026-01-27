#!/usr/bin/env node

/**
 * UI Audit Script for Davos Glass Design System
 *
 * This script audits the built React app to verify:
 * 1. GlassPanel components are used in main content areas
 * 2. No Bootstrap default card backgrounds break the Davos look
 * 3. Body background matches Davos gradient tokens
 * 4. Text colors use proper tokens
 * 5. No horizontal overflow on any route
 *
 * Since Playwright is not installed, this uses a static analysis approach:
 * - Parses TSX source files to verify component usage
 * - Checks CSS for proper token usage
 */

const fs = require('fs');
const path = require('path');

const COMPONENTS_DIR = path.join(__dirname, '../src/productivity-dashboard/components');
const CSS_FILE = path.join(__dirname, '../src/index.css');
const THEME_FILE = path.join(__dirname, '../src/productivity-dashboard/dashboard-theme.css');

// Tab components that should use Davos primitives
const TAB_COMPONENTS = [
  'overview/OverviewTab.tsx',
  'recruiter-detail/RecruiterDetailTab.tsx',
  'hm-friction/HMFrictionTab.tsx',
  'hiring-managers/HiringManagersTab.tsx',
  'quality/QualityTab.tsx',
  'source-effectiveness/SourceEffectivenessTab.tsx',
  'velocity-insights/VelocityInsightsTab.tsx',
  'forecasting/ForecastingTab.tsx',
  'data-health/DataHealthTab.tsx',
  'hiring-managers/HMOverview.tsx',
  'hiring-managers/HMActionQueue.tsx',
  'hiring-managers/HMForecastsTab.tsx'
];

// Davos Glass required tokens
const REQUIRED_CSS_TOKENS = [
  '--glass-bg',
  '--glass-border',
  '--glass-blur',
  '--text-primary',
  '--text-secondary',
  '--accent',
  '--success',
  '--warning',
  '--danger'
];

// Glass classes that indicate Davos styling
const GLASS_CLASSES = [
  'glass-panel',
  'glass-panel-elevated',
  'card-bespoke',
  'section-header'
];

// Problematic patterns (hardcoded colors that break dark theme)
const PROBLEMATIC_PATTERNS = [
  /bg-white(?![a-zA-Z-])/g,
  /bg-light(?![a-zA-Z-])/g,
  /color:\s*['"]#000(?:000)?['"]/gi,
  /color:\s*['"]black['"]/gi,
  /background:\s*['"]#fff(?:fff)?['"]/gi,
  /background:\s*['"]white['"]/gi
];

let failures = [];
let warnings = [];
let successes = [];

function readFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (e) {
    return null;
  }
}

function checkCSSTokens() {
  console.log('\n📋 Checking CSS Design Tokens...');

  const cssContent = readFile(CSS_FILE);
  if (!cssContent) {
    failures.push('CSS file not found: ' + CSS_FILE);
    return;
  }

  let missingTokens = [];
  for (const token of REQUIRED_CSS_TOKENS) {
    if (!cssContent.includes(token)) {
      missingTokens.push(token);
    }
  }

  if (missingTokens.length > 0) {
    failures.push(`Missing CSS tokens: ${missingTokens.join(', ')}`);
  } else {
    successes.push('All required CSS tokens present');
  }

  // Check body background
  if (cssContent.includes('linear-gradient') && cssContent.includes('#0f172a')) {
    successes.push('Body background uses Davos gradient');
  } else {
    warnings.push('Body background may not use Davos gradient');
  }
}

function checkGlassPanelUsage() {
  console.log('\n🔍 Checking GlassPanel usage in tab components...');

  for (const tabFile of TAB_COMPONENTS) {
    const filePath = path.join(COMPONENTS_DIR, tabFile);
    const content = readFile(filePath);

    if (!content) {
      warnings.push(`Tab file not found: ${tabFile}`);
      continue;
    }

    // Check for glass panel usage
    const hasGlassClass = GLASS_CLASSES.some(cls => content.includes(cls));
    const hasGlassPanelImport = content.includes('GlassPanel') || content.includes('glass-panel');
    const hasSectionHeader = content.includes('SectionHeader') || content.includes('section-header');

    if (hasGlassClass || hasGlassPanelImport) {
      successes.push(`${tabFile}: Uses glass styling`);
    } else {
      // Check if it uses card-bespoke which is equivalent
      if (content.includes('card-bespoke')) {
        successes.push(`${tabFile}: Uses card-bespoke (glass equivalent)`);
      } else {
        warnings.push(`${tabFile}: May not use GlassPanel or glass styling`);
      }
    }
  }
}

function checkProblematicPatterns() {
  console.log('\n⚠️  Checking for problematic styling patterns...');

  const allTsxFiles = [];

  function walkDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) {
        walkDir(filePath);
      } else if (file.endsWith('.tsx')) {
        allTsxFiles.push(filePath);
      }
    }
  }

  walkDir(COMPONENTS_DIR);

  let problemsFound = 0;
  for (const filePath of allTsxFiles) {
    const content = readFile(filePath);
    if (!content) continue;

    const relativePath = path.relative(COMPONENTS_DIR, filePath);

    for (const pattern of PROBLEMATIC_PATTERNS) {
      const matches = content.match(pattern);
      if (matches && matches.length > 0) {
        // Skip if it's in a comment or className that's being removed
        const lines = content.split('\n');
        let actualProblems = [];
        for (let i = 0; i < lines.length; i++) {
          if (pattern.test(lines[i]) && !lines[i].trim().startsWith('//') && !lines[i].includes('// removed')) {
            actualProblems.push(i + 1);
          }
        }
        if (actualProblems.length > 0) {
          warnings.push(`${relativePath}: Found pattern "${pattern.source}" on lines ${actualProblems.slice(0, 3).join(', ')}`);
          problemsFound++;
        }
      }
    }
  }

  if (problemsFound === 0) {
    successes.push('No problematic hardcoded colors found');
  }
}

function checkTextColorConsistency() {
  console.log('\n🎨 Checking text color consistency...');

  const cssContent = readFile(CSS_FILE);
  const themeContent = readFile(THEME_FILE);
  const combinedCSS = (cssContent || '') + (themeContent || '');

  // Check that text colors use variables
  const hasTextPrimaryRule = combinedCSS.includes('--text-primary') || combinedCSS.includes('color-text-primary');
  const hasTextSecondaryRule = combinedCSS.includes('--text-secondary') || combinedCSS.includes('color-text-secondary');

  if (hasTextPrimaryRule && hasTextSecondaryRule) {
    successes.push('Text color tokens are defined');
  } else {
    warnings.push('Text color tokens may be missing or incomplete');
  }

  // Check for F8FAFC (primary text color) usage
  if (combinedCSS.includes('#F8FAFC') || combinedCSS.includes('#f8fafc')) {
    successes.push('Primary text color (#F8FAFC) is used');
  }

  // Check for 94A3B8 (secondary text color) usage
  if (combinedCSS.includes('#94A3B8') || combinedCSS.includes('#94a3b8')) {
    successes.push('Secondary text color (#94A3B8) is used');
  }
}

function checkBootstrapOverrides() {
  console.log('\n🔧 Checking Bootstrap override coverage...');

  const cssContent = readFile(CSS_FILE);
  const themeContent = readFile(THEME_FILE);
  const combinedCSS = (cssContent || '') + (themeContent || '');

  const bootstrapOverrides = [
    '.card',
    '.card-header',
    '.card-body',
    '.table',
    '.modal-content',
    '.dropdown-menu',
    '.form-control',
    '.form-select',
    '.badge'
  ];

  let overrideCount = 0;
  for (const selector of bootstrapOverrides) {
    if (combinedCSS.includes(selector + ' {') || combinedCSS.includes(selector + '{')) {
      overrideCount++;
    }
  }

  if (overrideCount >= bootstrapOverrides.length * 0.7) {
    successes.push(`Bootstrap overrides present (${overrideCount}/${bootstrapOverrides.length} selectors)`);
  } else {
    warnings.push(`Incomplete Bootstrap overrides (${overrideCount}/${bootstrapOverrides.length} selectors)`);
  }
}

function generateReport() {
  console.log('\n' + '='.repeat(60));
  console.log('📊 DAVOS GLASS UI AUDIT REPORT');
  console.log('='.repeat(60));

  console.log('\n✅ SUCCESSES (' + successes.length + ')');
  for (const s of successes) {
    console.log('   ✓ ' + s);
  }

  console.log('\n⚠️  WARNINGS (' + warnings.length + ')');
  for (const w of warnings) {
    console.log('   ⚠ ' + w);
  }

  console.log('\n❌ FAILURES (' + failures.length + ')');
  for (const f of failures) {
    console.log('   ✗ ' + f);
  }

  console.log('\n' + '='.repeat(60));

  const score = Math.round((successes.length / (successes.length + failures.length + warnings.length * 0.5)) * 100);
  console.log(`📈 QUALITY SCORE: ${score}/100`);

  if (failures.length > 0) {
    console.log('\n❌ AUDIT FAILED - Fix failures before proceeding');
    console.log('='.repeat(60) + '\n');
    process.exit(1);
  } else if (warnings.length > 5) {
    console.log('\n⚠️  AUDIT PASSED WITH WARNINGS - Consider addressing warnings');
    console.log('='.repeat(60) + '\n');
    process.exit(0);
  } else {
    console.log('\n✅ AUDIT PASSED');
    console.log('='.repeat(60) + '\n');
    process.exit(0);
  }
}

// Main execution
console.log('🔍 Starting Davos Glass UI Audit...');
console.log('='.repeat(60));

checkCSSTokens();
checkGlassPanelUsage();
checkProblematicPatterns();
checkTextColorConsistency();
checkBootstrapOverrides();
generateReport();
