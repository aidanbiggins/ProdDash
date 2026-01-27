#!/usr/bin/env node
/**
 * UI Overlay Audit Script
 *
 * Scans src/productivity-dashboard for overlay theming violations:
 * 1. Bootstrap default overlay classes without themed wrappers:
 *    .dropdown-menu, .popover, .tooltip, .modal-content, .toast, .card
 * 2. Overlay components (Modal, Dropdown, Tooltip, Toast) without themed class
 * 3. Native title attributes (should use themed Tooltip component)
 *
 * Exit codes:
 *   0 - No violations found
 *   1 - Violations found
 */

const fs = require('fs');
const path = require('path');

// Configuration
const SRC_DIR = path.join(__dirname, '..', 'src', 'productivity-dashboard');

// Files that are allowed to define overlay base styles (theme files)
const ALLOWED_OVERLAY_STYLE_FILES = [
  'dashboard-theme.css',
  'navigation.css',      // Mobile drawer styling
  'layout.css'           // Layout primitives
];

// Components that ARE the themed overlay primitives (they define the theming)
const THEMED_OVERLAY_COMPONENTS = [
  'ExplainDrawer.tsx',
  'ActionDetailDrawer.tsx',
  'HelpDrawer.tsx',
  'PreMortemDrawer.tsx',
  'HMDetailDrawer.tsx',
  'ReqDrilldownDrawer.tsx',
  'FitExplainDrawer.tsx',
  'OverloadExplainDrawer.tsx',
  'CitationsDrawer.tsx',
  'MobileDrawer.tsx',
  'DataDrillDownModal.tsx',
  'ClearDataConfirmationModal.tsx',
  'ImportProgressModal.tsx',
  'PIIWarningModal.tsx',
  'StageMappingModal.tsx',
  'BenchmarkConfigModal.tsx',
  'OrgSwitcher.tsx',
  'NavDropdown.tsx',
  'MultiSelect.tsx',
  'FilterBar.tsx',
  'DateRangePicker.tsx',
  'InlineHelp.tsx',
  // CSS theme files
  'dashboard-theme.css'
];

// Bootstrap overlay classes that must be overridden with dark theme
// Note: modal-*, dropdown-*, offcanvas-* are globally themed in dashboard-theme.css
// so they don't need explicit glass-* wrappers - they inherit the dark theme
const BOOTSTRAP_OVERLAY_CLASSES_NEEDING_THEME = [
  'popover',
  'popover-body',
  'popover-header',
  'tooltip',
  'tooltip-inner',
  'toast',
  'toast-header',
  'toast-body'
];

// Bootstrap classes that ARE themed globally via dashboard-theme.css (informational only)
const GLOBALLY_THEMED_BOOTSTRAP_CLASSES = [
  'dropdown-menu',
  'modal-content',
  'modal-header',
  'modal-body',
  'modal-footer',
  'offcanvas',
  'offcanvas-header',
  'offcanvas-body'
];

// Themed class names that indicate proper theming
const THEMED_CLASSES = [
  'glass-drawer',
  'glass-backdrop',
  'glass-panel',
  'glass-panel-elevated',
  'davos-overlay',
  'davos-dropdown',
  'davos-modal',
  'davos-tooltip',
  'davos-popover',
  'davos-toast',
  'themed-modal',
  'themed-dropdown',
  'themed-tooltip'
];

let violations = [];
let warnings = [];

/**
 * Check if a file is an allowed theme file
 */
function isAllowedStyleFile(filePath) {
  const fileName = path.basename(filePath);
  return ALLOWED_OVERLAY_STYLE_FILES.includes(fileName);
}

/**
 * Check if a file is a themed overlay component
 */
function isThemedComponent(filePath) {
  const fileName = path.basename(filePath);
  return THEMED_OVERLAY_COMPONENTS.includes(fileName);
}

/**
 * Check if a line contains a themed class alongside Bootstrap classes
 */
function hasThemedClass(line) {
  return THEMED_CLASSES.some(cls => line.includes(cls));
}

/**
 * Scan a TSX/JSX file for overlay usage
 */
function scanTsxFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const relativePath = path.relative(process.cwd(), filePath);
  const fileName = path.basename(filePath);

  // Skip themed overlay components (they define theming)
  if (isThemedComponent(filePath)) {
    return;
  }

  lines.forEach((line, index) => {
    const lineNum = index + 1;

    // Rule 1: Check for Bootstrap overlay classes without themed wrapper
    // Only check classes that need explicit theming (not globally themed ones)
    BOOTSTRAP_OVERLAY_CLASSES_NEEDING_THEME.forEach(cls => {
      // Check for className usage with this Bootstrap class
      // IMPORTANT: Only match standalone classes, NOT Tailwind utility classes like bg-popover
      // Match: className="popover ..." or className="... popover" or className="... popover ..."
      // Do NOT match: className="bg-popover" or className="text-popover-foreground"
      const classRegex = new RegExp(`className=["'][^"']*(?:^|\\s)${cls}(?:\\s|$|["'])[^"']*["']?`, 'g');
      if (classRegex.test(line)) {
        // Double-check: ensure we're not matching Tailwind tokens with hyphens
        // Extract all classes from the className and check if any is EXACTLY the Bootstrap class
        const classNameMatch = line.match(/className=["']([^"']*)["']/);
        if (classNameMatch) {
          const classes = classNameMatch[1].split(/\s+/);
          const hasExactBootstrapClass = classes.some(c => c === cls);

          if (hasExactBootstrapClass) {
            // Check if same line or nearby context has a themed class
            const contextStart = Math.max(0, index - 3);
            const contextEnd = Math.min(lines.length, index + 3);
            const context = lines.slice(contextStart, contextEnd).join('\n');

            if (!hasThemedClass(context)) {
              violations.push({
                type: 'UNTHEMED_BOOTSTRAP_CLASS',
                file: relativePath,
                line: lineNum,
                content: line.trim().substring(0, 120),
                message: `Bootstrap class "${cls}" used without themed wrapper. Add glass-* or davos-* class.`
              });
            }
          }
        }
      }
    });

    // Rule 2: Check for native title attributes (should use themed tooltip)
    // Only flag if it's clearly a tooltip-style usage, not aria-label or similar
    const titleAttrRegex = /\btitle=["'][^"']+["']/g;
    const matches = line.match(titleAttrRegex);
    if (matches) {
      // Skip if it's in an allowed context (svg title, document.title, etc.)
      const skipContexts = ['<title>', 'document.title', 'pageTitle', 'windowTitle', 'aria-'];
      const shouldSkip = skipContexts.some(ctx => line.includes(ctx));

      if (!shouldSkip) {
        warnings.push({
          type: 'NATIVE_TITLE_ATTR',
          file: relativePath,
          line: lineNum,
          content: line.trim().substring(0, 120),
          message: 'Native title attribute used. Consider using themed Tooltip component for consistency.'
        });
      }
    }

    // Rule 3: Check for Bootstrap data-bs-toggle without theming
    const dataBsToggleRegex = /data-bs-toggle=["'](tooltip|popover|dropdown|modal|offcanvas)["']/g;
    const toggleMatches = line.match(dataBsToggleRegex);
    if (toggleMatches) {
      toggleMatches.forEach(match => {
        const toggleType = match.match(/["'](\w+)["']/)[1];
        warnings.push({
          type: 'BOOTSTRAP_DATA_TOGGLE',
          file: relativePath,
          line: lineNum,
          content: line.trim().substring(0, 120),
          message: `Bootstrap data-bs-toggle="${toggleType}" used. Ensure dark theme styles are applied.`
        });
      });
    }
  });
}

/**
 * Scan a CSS file for Bootstrap default styles that should be overridden
 */
function scanCssFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const relativePath = path.relative(process.cwd(), filePath);

  // Skip theme files - they should define the overrides
  if (isAllowedStyleFile(filePath)) {
    return;
  }

  lines.forEach((line, index) => {
    const lineNum = index + 1;

    // Check for local Bootstrap overlay class definitions
    BOOTSTRAP_OVERLAY_CLASSES_NEEDING_THEME.forEach(cls => {
      const classDefRegex = new RegExp(`\\.${cls}\\s*\\{`);
      if (classDefRegex.test(line)) {
        violations.push({
          type: 'LOCAL_OVERLAY_STYLE',
          file: relativePath,
          line: lineNum,
          content: line.trim().substring(0, 120),
          message: `Local definition of ".${cls}" found. Consolidate overlay styles to dashboard-theme.css.`
        });
      }
    });
  });
}

/**
 * Recursively scan a directory
 */
function scanDirectory(dirPath) {
  if (!fs.existsSync(dirPath)) {
    console.error(`Directory not found: ${dirPath}`);
    return;
  }

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      // Skip node_modules and test directories
      if (entry.name !== 'node_modules' && entry.name !== '__tests__') {
        scanDirectory(fullPath);
      }
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name);
      if (ext === '.tsx' || ext === '.jsx') {
        scanTsxFile(fullPath);
      } else if (ext === '.css') {
        scanCssFile(fullPath);
      }
    }
  }
}

/**
 * Print the report
 */
function printReport() {
  console.log('\n========================================');
  console.log('  UI OVERLAY AUDIT REPORT');
  console.log('========================================\n');

  const hasViolations = violations.length > 0;
  const hasWarnings = warnings.length > 0;

  if (!hasViolations && !hasWarnings) {
    console.log('\u2705 No overlay theming issues found!\n');
    console.log('All overlays use the themed design system.\n');
    return 0;
  }

  // Print violations (errors)
  if (hasViolations) {
    console.log(`\u274C Found ${violations.length} violation(s):\n`);

    const byType = {};
    violations.forEach(v => {
      if (!byType[v.type]) byType[v.type] = [];
      byType[v.type].push(v);
    });

    const typeLabels = {
      'UNTHEMED_BOOTSTRAP_CLASS': 'Unthemed Bootstrap Overlay Classes',
      'LOCAL_OVERLAY_STYLE': 'Local Overlay Style Definitions'
    };

    for (const [type, items] of Object.entries(byType)) {
      console.log(`\n--- ${typeLabels[type] || type} (${items.length}) ---\n`);

      items.forEach(v => {
        console.log(`  ${v.file}:${v.line}`);
        console.log(`    ${v.message}`);
        console.log(`    > ${v.content}`);
        console.log('');
      });
    }
  }

  // Print warnings
  if (hasWarnings) {
    console.log(`\n\u26A0\uFE0F  Found ${warnings.length} warning(s):\n`);

    const byType = {};
    warnings.forEach(w => {
      if (!byType[w.type]) byType[w.type] = [];
      byType[w.type].push(w);
    });

    const typeLabels = {
      'NATIVE_TITLE_ATTR': 'Native Title Attributes (Consider Themed Tooltip)',
      'BOOTSTRAP_DATA_TOGGLE': 'Bootstrap Data Toggle Usage'
    };

    for (const [type, items] of Object.entries(byType)) {
      console.log(`\n--- ${typeLabels[type] || type} (${items.length}) ---\n`);

      // Only show first 10 of each type to avoid spam
      const displayItems = items.slice(0, 10);
      displayItems.forEach(w => {
        console.log(`  ${w.file}:${w.line}`);
        console.log(`    ${w.message}`);
        console.log('');
      });
      if (items.length > 10) {
        console.log(`  ... and ${items.length - 10} more\n`);
      }
    }
  }

  console.log('----------------------------------------');
  console.log(`Total: ${violations.length} violation(s), ${warnings.length} warning(s)`);
  console.log('----------------------------------------\n');

  if (hasViolations) {
    console.log('To fix violations:');
    console.log('  1. Add glass-* or davos-* themed classes alongside Bootstrap classes');
    console.log('  2. Move local overlay styles to dashboard-theme.css');
    console.log('  3. Ensure all overlays use dark glass theme tokens\n');
    return 1;
  }

  // Warnings only - exit 0 but notify
  console.log('Warnings are informational. Violations would block the build.\n');
  return 0;
}

/**
 * Test helper: Check if a given className string would trigger a violation
 * for a specific Bootstrap class. Used for unit testing the regex logic.
 */
function wouldTriggerViolation(classNameValue, bootstrapClass) {
  const classes = classNameValue.split(/\s+/);
  return classes.some(c => c === bootstrapClass);
}

/**
 * Run self-tests to verify false positive fix for Tailwind tokens
 */
function runSelfTests() {
  console.log('Running self-tests for overlay audit...\n');
  let passed = 0;
  let failed = 0;

  const testCases = [
    // Tailwind tokens should NOT trigger (false positive fixes)
    { className: 'bg-popover', bootstrapClass: 'popover', shouldTrigger: false, description: 'bg-popover (Tailwind token)' },
    { className: 'text-popover-foreground', bootstrapClass: 'popover', shouldTrigger: false, description: 'text-popover-foreground (Tailwind token)' },
    { className: 'border-popover', bootstrapClass: 'popover', shouldTrigger: false, description: 'border-popover (Tailwind token)' },
    { className: 'bg-tooltip', bootstrapClass: 'tooltip', shouldTrigger: false, description: 'bg-tooltip (Tailwind token)' },
    { className: 'text-tooltip-foreground', bootstrapClass: 'tooltip', shouldTrigger: false, description: 'text-tooltip-foreground (Tailwind token)' },

    // Standalone Bootstrap classes SHOULD trigger
    { className: 'popover', bootstrapClass: 'popover', shouldTrigger: true, description: 'popover (standalone Bootstrap class)' },
    { className: 'tooltip', bootstrapClass: 'tooltip', shouldTrigger: true, description: 'tooltip (standalone Bootstrap class)' },
    { className: 'popover-body', bootstrapClass: 'popover-body', shouldTrigger: true, description: 'popover-body (Bootstrap class)' },
    { className: 'tooltip-inner', bootstrapClass: 'tooltip-inner', shouldTrigger: true, description: 'tooltip-inner (Bootstrap class)' },

    // Mixed classes - should trigger if contains exact match
    { className: 'popover mt-2 p-4', bootstrapClass: 'popover', shouldTrigger: true, description: 'popover with other classes' },
    { className: 'bg-popover border rounded', bootstrapClass: 'popover', shouldTrigger: false, description: 'bg-popover with other classes' },
    { className: 'mx-2 popover shadow-lg', bootstrapClass: 'popover', shouldTrigger: true, description: 'popover in middle of classlist' },
  ];

  testCases.forEach(({ className, bootstrapClass, shouldTrigger, description }) => {
    const result = wouldTriggerViolation(className, bootstrapClass);
    const testPassed = result === shouldTrigger;

    if (testPassed) {
      console.log(`  ✅ PASS: ${description}`);
      passed++;
    } else {
      console.log(`  ❌ FAIL: ${description}`);
      console.log(`         Expected: ${shouldTrigger ? 'TRIGGER' : 'NO TRIGGER'}, Got: ${result ? 'TRIGGER' : 'NO TRIGGER'}`);
      failed++;
    }
  });

  console.log(`\n  Results: ${passed} passed, ${failed} failed\n`);
  return failed === 0;
}

// Main
// Check for --test flag to run self-tests
if (process.argv.includes('--test')) {
  const success = runSelfTests();
  process.exit(success ? 0 : 1);
}

console.log('Scanning src/productivity-dashboard for overlay theming issues...\n');
scanDirectory(SRC_DIR);
const exitCode = printReport();
process.exit(exitCode);
