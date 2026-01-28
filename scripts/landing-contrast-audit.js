#!/usr/bin/env node
/**
 * Landing Page Contrast Audit
 *
 * Static analysis to detect forbidden dark-text tokens in landing page components.
 * Dark text is allowed ONLY on light backgrounds (e.g., amber buttons).
 *
 * Fails if dark text tokens appear outside of button/CTA contexts.
 */

const fs = require('fs');
const path = require('path');

// ANSI colors
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';

function log(msg, color = RESET) {
  console.log(`${color}${msg}${RESET}`);
}

const LANDING_DIR = path.join(__dirname, '..', 'src', 'components', 'landing');

// Forbidden dark text patterns (too dark for dark backgrounds)
const FORBIDDEN_PATTERNS = [
  /text-slate-900/g,
  /text-gray-900/g,
  /text-neutral-900/g,
  /text-zinc-900/g,
  /text-stone-900/g,
  /text-black(?![a-zA-Z-])/g, // text-black but not text-black-something
];

// Context patterns that ALLOW dark text (light backgrounds)
const ALLOWED_CONTEXTS = [
  /bg-gradient-to-r\s+from-amber/,
  /bg-amber-/,
  /bg-yellow-/,
  /bg-orange-/,
  /bg-white/,
  /bg-slate-50/,
  /bg-gray-50/,
];

// Inline style dark colors (hex values that are too dark)
const DARK_INLINE_PATTERNS = [
  /style=\{[^}]*color:\s*['"]#[0-2][0-9a-fA-F]{5}['"]/g, // #0xxxxx - #2xxxxx
  /style=\{[^}]*color:\s*['"]rgb\(\s*[0-4]?[0-9],/g, // rgb(0-49, ...
];

function scanFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const violations = [];

  lines.forEach((line, index) => {
    const lineNum = index + 1;

    // Check each forbidden pattern
    for (const pattern of FORBIDDEN_PATTERNS) {
      pattern.lastIndex = 0; // Reset regex state
      if (pattern.test(line)) {
        // Check if this line or surrounding context has allowed background
        const contextStart = Math.max(0, index - 5);
        const contextEnd = Math.min(lines.length, index + 5);
        const context = lines.slice(contextStart, contextEnd).join('\n');

        const hasAllowedContext = ALLOWED_CONTEXTS.some(ctx => ctx.test(context));

        if (!hasAllowedContext) {
          violations.push({
            file: path.relative(LANDING_DIR, filePath),
            line: lineNum,
            content: line.trim(),
            pattern: pattern.source,
          });
        }
      }
    }

    // Check inline style dark colors
    for (const pattern of DARK_INLINE_PATTERNS) {
      pattern.lastIndex = 0;
      if (pattern.test(line)) {
        violations.push({
          file: path.relative(LANDING_DIR, filePath),
          line: lineNum,
          content: line.trim(),
          pattern: 'inline dark color',
        });
      }
    }
  });

  return violations;
}

function scanDirectory(dir) {
  const violations = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      violations.push(...scanDirectory(fullPath));
    } else if (entry.isFile() && (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts') || entry.name.endsWith('.css'))) {
      violations.push(...scanFile(fullPath));
    }
  }

  return violations;
}

function runAudit() {
  log('\nLanding Page Contrast Audit', CYAN);
  log('===========================\n');

  if (!fs.existsSync(LANDING_DIR)) {
    log(`Landing directory not found: ${LANDING_DIR}`, RED);
    process.exit(1);
  }

  log(`Scanning: ${LANDING_DIR}`, YELLOW);

  const violations = scanDirectory(LANDING_DIR);

  if (violations.length === 0) {
    log('\n✓ No contrast violations found', GREEN);
    log('  All dark text tokens are in appropriate contexts (light backgrounds)', GREEN);
    process.exit(0);
  } else {
    log(`\n✗ Found ${violations.length} contrast violation(s):\n`, RED);

    for (const v of violations) {
      log(`  ${v.file}:${v.line}`, RED);
      log(`    Pattern: ${v.pattern}`, YELLOW);
      log(`    Content: ${v.content.substring(0, 80)}${v.content.length > 80 ? '...' : ''}`, RESET);
      log('');
    }

    log('Fix: Use text-foreground or text-muted-foreground for text on dark backgrounds.', YELLOW);
    log('     Dark text (text-slate-900, etc.) is only allowed on light backgrounds (amber buttons).', YELLOW);
    process.exit(1);
  }
}

runAudit();
