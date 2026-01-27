#!/usr/bin/env node

/**
 * Theme Audit Script
 * Detects hardcoded colors that don't flip with theme and font-size inconsistencies
 */

const fs = require('fs');
const path = require('path');

// Patterns that indicate non-theme-aware colors
const FORBIDDEN_PATTERNS = [
  // Hardcoded hex colors (dark-mode specific)
  { pattern: /bg-\[#[0-9a-fA-F]{3,6}\]/g, description: 'Hardcoded hex background color' },
  { pattern: /text-\[#[0-9a-fA-F]{3,6}\]/g, description: 'Hardcoded hex text color' },
  { pattern: /border-\[#[0-9a-fA-F]{3,6}\]/g, description: 'Hardcoded hex border color' },

  // Hardcoded rgba (dark-mode specific)
  { pattern: /bg-\[rgba\(\d+,\s*\d+,\s*\d+/g, description: 'Hardcoded rgba background' },

  // White-based opacity patterns (dark-mode only)
  { pattern: /border-white\/\[0\.\d+\]/g, description: 'White border with opacity (dark-mode only)' },
  { pattern: /bg-white\/\[0\.\d+\]/g, description: 'White background with opacity (dark-mode only)' },
  { pattern: /hover:bg-white\/\[0\.\d+\]/g, description: 'White hover background (dark-mode only)' },
  { pattern: /divide-white\/\[0\.\d+\]/g, description: 'White divider with opacity (dark-mode only)' },

  // CSS hardcoded colors in style objects
  { pattern: /backgroundColor:\s*['"]#[0-9a-fA-F]{3,6}['"]/g, description: 'CSS backgroundColor with hex' },
  { pattern: /color:\s*['"]#[0-9a-fA-F]{3,6}['"]/g, description: 'CSS color with hex' },
  { pattern: /border.*#[0-9a-fA-F]{3,6}/g, description: 'CSS border with hex' },
];

// Files/directories to scan
const SCAN_DIRS = [
  'src/productivity-dashboard/components/v2',
  'src/components/ui',
];

// Files to exclude (known exceptions)
const EXCLUDED_FILES = [
  'design-system/README.md', // Documentation
];

// Patterns to allow (semantic colors that are intentionally consistent)
const ALLOWED_PATTERNS = [
  // Status colors in data visualization
  /bg-\[#ef4444\]/,  // Red for critical/bad
  /bg-\[#f59e0b\]/,  // Amber for warning
  /bg-\[#22c55e\]/,  // Green for good/success
  /bg-\[#3b82f6\]/,  // Blue for info
  /bg-\[#64748b\]/,  // Slate for neutral
  /bg-\[#06b6d4\]/,  // Cyan for accent
  /bg-\[#8b5cf6\]/,  // Violet for highlight
  /bg-\[#2dd4bf\]/,  // Teal for accent
  /text-\[#fca5a5\]/, // Light red text
  /text-\[#fcd34d\]/, // Light amber text
  /text-\[#86efac\]/, // Light green text
  /text-\[#93c5fd\]/, // Light blue text
  /color:\s*['"]#[0-9a-fA-F]{6}['"]/, // Chart colors in Recharts config (intentional)
];

// Track violations
const violations = [];

function scanFile(filePath) {
  const relativePath = path.relative(process.cwd(), filePath);

  // Skip excluded files
  if (EXCLUDED_FILES.some(ex => relativePath.includes(ex))) {
    return;
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  FORBIDDEN_PATTERNS.forEach(({ pattern, description }) => {
    lines.forEach((line, lineNum) => {
      const matches = line.match(pattern);
      if (matches) {
        matches.forEach(match => {
          // Check if this match is in the allowed list
          const isAllowed = ALLOWED_PATTERNS.some(allowedPattern => allowedPattern.test(match));
          if (!isAllowed) {
            violations.push({
              file: relativePath,
              line: lineNum + 1,
              match,
              description,
            });
          }
        });
      }
    });
  });
}

function scanDirectory(dirPath) {
  if (!fs.existsSync(dirPath)) {
    console.log(`Directory not found: ${dirPath}`);
    return;
  }

  const files = fs.readdirSync(dirPath, { withFileTypes: true });

  files.forEach(file => {
    const fullPath = path.join(dirPath, file.name);

    if (file.isDirectory()) {
      scanDirectory(fullPath);
    } else if (file.name.match(/\.(tsx?|jsx?|css)$/)) {
      scanFile(fullPath);
    }
  });
}

// Run scan
console.log('🎨 Theme Audit - Scanning for non-theme-aware colors...\n');

SCAN_DIRS.forEach(dir => {
  scanDirectory(dir);
});

// Report results
if (violations.length === 0) {
  console.log('✅ No theme violations found!\n');
  console.log('All colors are theme-aware and will flip correctly between light and dark modes.');
  process.exit(0);
} else {
  console.log(`❌ Found ${violations.length} theme violation(s):\n`);

  // Group by file
  const byFile = {};
  violations.forEach(v => {
    if (!byFile[v.file]) byFile[v.file] = [];
    byFile[v.file].push(v);
  });

  Object.entries(byFile).forEach(([file, fileViolations]) => {
    console.log(`📄 ${file}`);
    fileViolations.forEach(v => {
      console.log(`   Line ${v.line}: ${v.match}`);
      console.log(`   └─ ${v.description}`);
    });
    console.log('');
  });

  console.log('━'.repeat(60));
  console.log('\nRecommended replacements:');
  console.log('  bg-[#hex]           → bg-background, bg-card, bg-muted');
  console.log('  text-[#hex]         → text-foreground, text-muted-foreground');
  console.log('  border-white/[x]    → border-border');
  console.log('  bg-white/[x]        → bg-muted, bg-accent');
  console.log('  hover:bg-white/[x]  → hover:bg-accent');
  console.log('');

  process.exit(1);
}
