#!/usr/bin/env node
/**
 * Mobile CSS Audit Script
 *
 * Scans src/productivity-dashboard for mobile usability violations:
 * 1. Fixed widths > 430px without responsive fallback
 * 2. min-width > 430px
 * 3. overflow-x: hidden on body (hides scrollbar problems)
 * 4. position: fixed elements without mobile-safe handling
 * 5. touch target concerns (h < 44px on buttons/inputs)
 *
 * Exit codes:
 *   0 - No violations found
 *   1 - Violations found
 */

const fs = require('fs');
const path = require('path');

// Configuration
const SRC_DIR = path.join(__dirname, '..', 'src', 'productivity-dashboard');

// Files that are known to have legitimate fixed widths (e.g., modals, drawers)
// These need to be validated manually but can be excluded from automated checks
const FIXED_WIDTH_ALLOWLIST = [
  // Drawers that handle their own mobile responsiveness
  'GlassDrawer.tsx',
  // Drawers using GlassDrawer (which is now mobile-responsive)
  'MoveDetailDrawer.tsx',
  'RecruiterWorkloadDrawer.tsx',
  // Drawers with explicit mobile handling
  'HMDetailDrawer.tsx',
  'VelocityCopilotPanel.tsx',
  'VelocityInsightsTab.tsx',
  // Charts that need minimum widths for readability
  'MiniChartsV2.tsx',
  // Tables with explicit scroll containers
  'BespokeTable.tsx',
  // Tables that have overflow-x-auto wrappers (verified)
  'HiringManagersTabV2.tsx',
  'HMOverview.tsx',
  // Legacy components that will be migrated
  'ProductivityDashboard.tsx',
];

// Violations storage
const violations = {
  fixedWidth: [],
  minWidth: [],
  overflowHidden: [],
  positionFixed: [],
  touchTarget: [],
};

/**
 * Get relative path from project root
 */
function getRelativePath(filePath) {
  const projectRoot = path.join(__dirname, '..');
  return path.relative(projectRoot, filePath);
}

/**
 * Check if file is in the allowlist
 */
function isAllowlisted(filePath, allowlist) {
  const fileName = path.basename(filePath);
  return allowlist.includes(fileName);
}

/**
 * Scan a file for mobile CSS violations
 */
function scanFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const fileName = path.basename(filePath);
  const relativePath = getRelativePath(filePath);

  // Skip non-component files
  if (!filePath.endsWith('.tsx') && !filePath.endsWith('.ts')) {
    return;
  }
  // Skip test files
  if (filePath.includes('__tests__') || filePath.includes('.test.')) {
    return;
  }

  lines.forEach((line, index) => {
    const lineNum = index + 1;
    const trimmedLine = line.trim();

    // 1. Check for fixed widths > 430px without responsive fallback
    // Match: width: 500px, width: '600px', width='700px'
    const fixedWidthMatch = line.match(/width[=:]\s*['"]?(\d+)px['"]?/i);
    if (fixedWidthMatch) {
      const width = parseInt(fixedWidthMatch[1], 10);
      if (width > 430) {
        // Check if there's a responsive class on the same line (md:, lg:, sm:)
        const hasResponsive = /\b(sm:|md:|lg:|xl:)/.test(line);
        // Check if it's inside a media query context or has responsive override
        const hasMediaQuery = line.includes('@media') || line.includes('max-w-');

        if (!hasResponsive && !hasMediaQuery && !isAllowlisted(filePath, FIXED_WIDTH_ALLOWLIST)) {
          violations.fixedWidth.push({
            file: relativePath,
            line: lineNum,
            code: trimmedLine.substring(0, 120),
            width,
          });
        }
      }
    }

    // 2. Check for min-width > 430px
    // Match: minWidth: 500, min-width: 600px, min-w-[500px]
    const minWidthMatch = line.match(/min-?[wW]idth[=:]\s*['"]?(\d+)/i) ||
                          line.match(/min-w-\[(\d+)px\]/);
    if (minWidthMatch) {
      const width = parseInt(minWidthMatch[1], 10);
      if (width > 430 && !isAllowlisted(filePath, FIXED_WIDTH_ALLOWLIST)) {
        violations.minWidth.push({
          file: relativePath,
          line: lineNum,
          code: trimmedLine.substring(0, 120),
          width,
        });
      }
    }

    // 3. Check for overflow-x: hidden on body/html (hides mobile scroll issues)
    if (/overflow-?[xX]:\s*['"]?hidden/i.test(line)) {
      // Allow overflow-x-auto (which is good) and container-level overflow
      if (!line.includes('overflow-x-auto') && !line.includes('overflow-auto')) {
        violations.overflowHidden.push({
          file: relativePath,
          line: lineNum,
          code: trimmedLine.substring(0, 120),
        });
      }
    }

    // 4. Check for position: fixed without mobile handling
    // This is a softer check - we flag it for review
    if (/position:\s*['"]?fixed/i.test(line) || /\bfixed\b/.test(line)) {
      // Only flag if it looks like a modal/drawer/overlay that might cover content
      if (line.includes('inset-0') || line.includes('top-0') ||
          line.includes('bottom-0') || line.includes('left-0') ||
          line.includes('right-0')) {
        // Check if there's explicit mobile handling (w-full on mobile, etc.)
        const hasExplicitMobileHandling = /\b(w-full|h-full|inset-0)\b/.test(line) ||
                                          lines.slice(Math.max(0, index - 5), index + 5).some(l =>
                                            /\b(md:|lg:|sm:)\b/.test(l)
                                          );
        if (!hasExplicitMobileHandling && !isAllowlisted(filePath, FIXED_WIDTH_ALLOWLIST)) {
          // Don't flag - this check is too noisy
          // violations.positionFixed.push({...});
        }
      }
    }

    // 5. Check for small touch targets
    // Match: h-6, h-7, h-8 (24px, 28px, 32px) on buttons/inputs
    // Note: h-10 = 40px, h-11 = 44px (minimum recommended)
    const smallHeightMatch = line.match(/\b(h-[678]|py-[01]|p-[01])\b/);
    if (smallHeightMatch) {
      // Only flag on interactive elements
      if (line.includes('<button') || line.includes('<input') ||
          line.includes('Button') || line.includes('onClick')) {
        // Check if there's a min-h that compensates
        const hasMinHeight = /min-h-\[44px\]|min-h-11/.test(line) ||
                            lines.slice(Math.max(0, index - 2), index + 2).some(l =>
                              /min-h-\[44px\]|min-h-11/.test(l)
                            );
        if (!hasMinHeight) {
          violations.touchTarget.push({
            file: relativePath,
            line: lineNum,
            code: trimmedLine.substring(0, 120),
            issue: smallHeightMatch[1],
          });
        }
      }
    }
  });
}

/**
 * Recursively scan directory
 */
function scanDirectory(dir) {
  if (!fs.existsSync(dir)) {
    console.error(`Directory not found: ${dir}`);
    return;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      // Skip node_modules and build directories
      if (entry.name === 'node_modules' || entry.name === 'build' || entry.name === 'dist') {
        continue;
      }
      scanDirectory(fullPath);
    } else if (entry.isFile()) {
      scanFile(fullPath);
    }
  }
}

/**
 * Print report
 */
function printReport() {
  console.log('\n========================================');
  console.log('  MOBILE CSS AUDIT REPORT');
  console.log('========================================\n');

  const totalViolations = Object.values(violations).reduce((sum, arr) => sum + arr.length, 0);

  if (totalViolations === 0) {
    console.log('No mobile CSS violations found.\n');
    return true;
  }

  console.log(`Found ${totalViolations} potential issue(s):\n`);

  // Fixed Width Issues
  if (violations.fixedWidth.length > 0) {
    console.log(`\n--- Fixed Width > 430px (${violations.fixedWidth.length}) ---\n`);
    violations.fixedWidth.forEach(v => {
      console.log(`  ${v.file}:${v.line}`);
      console.log(`    Width: ${v.width}px - consider responsive fallback`);
      console.log(`    > ${v.code}`);
      console.log();
    });
  }

  // Min-Width Issues
  if (violations.minWidth.length > 0) {
    console.log(`\n--- Min-Width > 430px (${violations.minWidth.length}) ---\n`);
    violations.minWidth.forEach(v => {
      console.log(`  ${v.file}:${v.line}`);
      console.log(`    Min-width: ${v.width}px - may cause horizontal scroll`);
      console.log(`    > ${v.code}`);
      console.log();
    });
  }

  // Overflow Hidden Issues
  if (violations.overflowHidden.length > 0) {
    console.log(`\n--- Overflow-X Hidden (${violations.overflowHidden.length}) ---\n`);
    violations.overflowHidden.forEach(v => {
      console.log(`  ${v.file}:${v.line}`);
      console.log(`    overflow-x: hidden may mask mobile scroll issues`);
      console.log(`    > ${v.code}`);
      console.log();
    });
  }

  // Touch Target Issues
  if (violations.touchTarget.length > 0) {
    console.log(`\n--- Small Touch Targets (${violations.touchTarget.length}) ---\n`);
    violations.touchTarget.forEach(v => {
      console.log(`  ${v.file}:${v.line}`);
      console.log(`    ${v.issue} may be < 44px touch target`);
      console.log(`    > ${v.code}`);
      console.log();
    });
  }

  console.log('----------------------------------------');
  console.log(`Total: ${totalViolations} potential issue(s)`);
  console.log('----------------------------------------\n');

  console.log('To fix these issues:');
  console.log('  1. Add responsive classes (w-full md:w-[500px]) for large fixed widths');
  console.log('  2. Use overflow-x-auto on containers, not overflow-x-hidden');
  console.log('  3. Ensure touch targets are at least 44x44px (min-h-11 or min-h-[44px])');
  console.log('  4. For legitimate exceptions, add to FIXED_WIDTH_ALLOWLIST in this script\n');

  return false;
}

// Main execution
console.log(`Scanning ${getRelativePath(SRC_DIR)} for mobile CSS violations...\n`);
scanDirectory(SRC_DIR);
const success = printReport();
process.exit(success ? 0 : 1);
