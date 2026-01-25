#!/usr/bin/env node
/**
 * Bootstrap Class Audit Script
 *
 * Scans src/ directory for Bootstrap class usage to track migration progress.
 * Run with: npm run audit:bootstrap
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Common Bootstrap class prefixes and patterns
const BOOTSTRAP_PATTERNS = [
  // Layout
  'container', 'container-fluid', 'container-sm', 'container-md', 'container-lg', 'container-xl', 'container-xxl',
  'row', 'col-', 'g-', 'gx-', 'gy-',

  // Flexbox
  'd-flex', 'd-inline-flex', 'd-block', 'd-inline', 'd-none', 'd-grid',
  'flex-row', 'flex-column', 'flex-wrap', 'flex-nowrap', 'flex-grow', 'flex-shrink',
  'justify-content-', 'align-items-', 'align-self-', 'align-content-',

  // Spacing
  'm-', 'mt-', 'mb-', 'ms-', 'me-', 'mx-', 'my-',
  'p-', 'pt-', 'pb-', 'ps-', 'pe-', 'px-', 'py-',

  // Typography
  'text-', 'fw-', 'fst-', 'fs-', 'lh-',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'display-', 'lead', 'small', 'mark',

  // Colors
  'text-primary', 'text-secondary', 'text-success', 'text-danger', 'text-warning', 'text-info',
  'text-light', 'text-dark', 'text-muted', 'text-white',
  'bg-primary', 'bg-secondary', 'bg-success', 'bg-danger', 'bg-warning', 'bg-info',
  'bg-light', 'bg-dark', 'bg-transparent',

  // Borders
  'border', 'border-', 'rounded', 'rounded-',

  // Components
  'btn', 'btn-', 'badge', 'alert', 'alert-',
  'card', 'card-', 'table', 'table-',
  'nav', 'nav-', 'navbar', 'navbar-',
  'dropdown', 'dropdown-',
  'modal', 'modal-', 'offcanvas',
  'toast', 'spinner', 'progress',
  'list-group', 'accordion',
  'breadcrumb', 'pagination',
  'tab-', 'tabs',

  // Form
  'form-', 'input-group', 'form-control', 'form-select', 'form-check',
  'is-valid', 'is-invalid', 'valid-', 'invalid-',

  // Utilities
  'shadow', 'shadow-', 'opacity-', 'overflow-',
  'position-', 'top-', 'bottom-', 'start-', 'end-',
  'w-', 'h-', 'mw-', 'mh-', 'min-', 'max-',
  'visible', 'invisible',
  'float-', 'clearfix',

  // Icons
  'bi-', 'bi ',
];

// Build regex pattern for Bootstrap class detection
function buildBootstrapRegex() {
  const escapedPatterns = BOOTSTRAP_PATTERNS.map(p =>
    p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  );
  // Match className="...", class="...", or template literals with class names
  return new RegExp(
    `(?:className|class)=["'\`][^"'\`]*\\b(${escapedPatterns.join('|')})`,
    'gi'
  );
}

function scanFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const regex = buildBootstrapRegex();
  const matches = [];
  let match;

  // Also check for direct Bootstrap class strings
  const lines = content.split('\n');
  lines.forEach((line, index) => {
    BOOTSTRAP_PATTERNS.forEach(pattern => {
      // Check for the pattern in className or class attributes
      const classRegex = new RegExp(`(?:className|class)=["'\`][^"'\`]*\\b${pattern.replace(/-/g, '\\-')}[\\w-]*`, 'gi');
      if (classRegex.test(line)) {
        matches.push({
          line: index + 1,
          content: line.trim().substring(0, 100),
          pattern
        });
      }
    });
  });

  // Dedupe by line number
  const uniqueMatches = [];
  const seenLines = new Set();
  matches.forEach(m => {
    if (!seenLines.has(m.line)) {
      seenLines.add(m.line);
      uniqueMatches.push(m);
    }
  });

  return uniqueMatches;
}

function scanDirectory(dir, results = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      // Skip node_modules and build directories
      if (entry.name !== 'node_modules' && entry.name !== 'build' && entry.name !== 'coverage') {
        scanDirectory(fullPath, results);
      }
    } else if (entry.isFile() && /\.(jsx?|tsx?|css|scss)$/.test(entry.name)) {
      const matches = scanFile(fullPath);
      if (matches.length > 0) {
        results.push({
          file: fullPath,
          matches
        });
      }
    }
  }

  return results;
}

function main() {
  console.log('🔍 Scanning for Bootstrap class usage...\n');

  const srcDir = path.join(process.cwd(), 'src');
  const results = scanDirectory(srcDir);

  let totalMatches = 0;
  const byDirectory = {};

  results.forEach(({ file, matches }) => {
    totalMatches += matches.length;
    const relPath = path.relative(process.cwd(), file);
    const dir = path.dirname(relPath);
    byDirectory[dir] = (byDirectory[dir] || 0) + matches.length;
  });

  // Summary
  console.log('📊 Bootstrap Class Usage Summary');
  console.log('================================\n');
  console.log(`Total files with Bootstrap classes: ${results.length}`);
  console.log(`Total Bootstrap class usages: ${totalMatches}\n`);

  // By directory
  console.log('By Directory:');
  Object.entries(byDirectory)
    .sort((a, b) => b[1] - a[1])
    .forEach(([dir, count]) => {
      console.log(`  ${dir}: ${count}`);
    });

  console.log('\n');

  // Detailed list (top 20 files)
  console.log('Top 20 Files with Most Bootstrap Classes:');
  console.log('-----------------------------------------');
  results
    .sort((a, b) => b.matches.length - a.matches.length)
    .slice(0, 20)
    .forEach(({ file, matches }) => {
      const relPath = path.relative(process.cwd(), file);
      console.log(`\n📄 ${relPath} (${matches.length} usages)`);
      matches.slice(0, 5).forEach(m => {
        console.log(`   Line ${m.line}: ${m.content.substring(0, 80)}${m.content.length > 80 ? '...' : ''}`);
      });
      if (matches.length > 5) {
        console.log(`   ... and ${matches.length - 5} more`);
      }
    });

  // Exit code based on whether Bootstrap classes exist
  if (totalMatches > 0) {
    console.log(`\n⚠️  Found ${totalMatches} Bootstrap class usages across ${results.length} files.`);
    console.log('   These need to be migrated to Tailwind CSS.\n');
    process.exit(0); // Non-zero would fail CI - use 0 during migration
  } else {
    console.log('\n✅ No Bootstrap class usages found! Migration complete.\n');
    process.exit(0);
  }
}

main();
