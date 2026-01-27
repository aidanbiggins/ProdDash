#!/usr/bin/env node
/**
 * No-Bootstrap Audit Script
 * Fails if Bootstrap class patterns are found in src tsx/ts/js files
 *
 * This script detects Bootstrap-SPECIFIC patterns that do NOT overlap with Tailwind.
 * Common patterns that exist in both (like mb-3, p-4, gap-2) are allowed since
 * they work in both frameworks.
 *
 * Run: npm run ui:no-bootstrap
 */

const fs = require('fs');
const path = require('path');

// Bootstrap-SPECIFIC class patterns (patterns that don't exist in Tailwind)
const BOOTSTRAP_PATTERNS = [
  // Layout - Bootstrap display utilities (Tailwind uses bare: flex, block, hidden, etc.)
  { pattern: /\bd-flex\b/, name: 'd-flex (use: flex)' },
  { pattern: /\bd-inline-flex\b/, name: 'd-inline-flex (use: inline-flex)' },
  { pattern: /\bd-block\b/, name: 'd-block (use: block)' },
  { pattern: /\bd-inline-block\b/, name: 'd-inline-block (use: inline-block)' },
  { pattern: /\bd-inline\b/, name: 'd-inline (use: inline)' },
  { pattern: /\bd-none\b/, name: 'd-none (use: hidden)' },
  { pattern: /\bd-grid\b/, name: 'd-grid (use: grid)' },

  // Bootstrap grid (Tailwind uses grid with col-span-*)
  { pattern: /\bcol-\d+\b/, name: 'col-* (use: col-span-*)' },
  { pattern: /\bcol-(sm|md|lg|xl|xxl)-\d+/, name: 'col-{breakpoint}-* (use: md:col-span-*)' },
  { pattern: /\brow\s+g-\d/, name: 'row g-* (use: grid with gap-*)' },
  { pattern: /\bg-[0-5]\b/, name: 'g-* grid gap (use: gap-*)' },

  // Flexbox utilities - Bootstrap specific (Tailwind uses shorter names)
  { pattern: /\bjustify-content-/, name: 'justify-content-* (use: justify-*)' },
  { pattern: /\balign-items-/, name: 'align-items-* (use: items-*)' },
  { pattern: /\balign-self-/, name: 'align-self-* (use: self-*)' },
  { pattern: /\bflex-column\b/, name: 'flex-column (use: flex-col)' },
  { pattern: /\bflex-grow-1\b/, name: 'flex-grow-1 (use: grow)' },
  { pattern: /\bflex-shrink-0\b/, name: 'flex-shrink-0 (use: shrink-0)' },

  // Spacing - Bootstrap start/end (Tailwind uses left/right)
  { pattern: /\bms-\d\b/, name: 'ms-* (use: ml-*)' },
  { pattern: /\bme-\d\b/, name: 'me-* (use: mr-*)' },
  { pattern: /\bps-\d\b/, name: 'ps-* (use: pl-*)' },
  { pattern: /\bpe-\d\b/, name: 'pe-* (use: pr-*)' },
  { pattern: /\bms-auto\b/, name: 'ms-auto (use: ml-auto)' },
  { pattern: /\bme-auto\b/, name: 'me-auto (use: mr-auto)' },

  // Buttons (Bootstrap-specific component classes)
  // Note: btn-bespoke-*, btn-press, btn-close, ask-action-btn are custom classes - excluded
  { pattern: /(?<!action-|ask-action-)\bbtn\s/, name: 'btn (use: Tailwind button classes)' },
  { pattern: /\bbtn-(?!bespoke|press|close)/, name: 'btn-* (use: Tailwind button classes)' },

  // Badges (Bootstrap-specific component class)
  // Note: badge-bespoke, hero-badge, ask-mode-badge, badge-ai-* are custom - excluded
  { pattern: /(?<!hero-|mode-)\bbadge\b(?!-bespoke|-primary-soft|-neutral-soft|-success-soft|-danger-soft|-warning-soft|-ai-on|-ai-off|-accent-soft)/, name: 'badge (use: inline-flex with Tailwind)' },

  // Navigation (Bootstrap-specific) - nav-link is used with nav-pills-bespoke design system
  // { pattern: /(?<!landing-|transform-)\bnav\b(?!-scrolled|igation|-pills-bespoke|-link)/, name: 'nav (use: Tailwind flex/list)' },
  // { pattern: /(?<!landing-)\bnav-link\b/, name: 'nav-link' },  // Used with nav-pills-bespoke
  { pattern: /\bnav-tabs\b/, name: 'nav-tabs' },
  // { pattern: /\bnav-pills\b(?!-bespoke)/, name: 'nav-pills' },

  // Modal (Bootstrap-specific) - excludes custom modal-overlay, import-modal-content
  { pattern: /\bmodal\b(?!-overlay|-content)/, name: 'modal (use: Tailwind fixed/absolute)' },
  { pattern: /\bmodal-(?!overlay|content)/, name: 'modal-*' },

  // Forms (Bootstrap-specific) - form-control/select/label defined in design system
  // { pattern: /\bform-control\b/, name: 'form-control (use: Tailwind input classes)' },  // Design system
  // { pattern: /\bform-select\b/, name: 'form-select (use: Tailwind select classes)' },  // Design system
  // { pattern: /\bform-check\b/, name: 'form-check' },  // Design system
  // { pattern: /\bform-label\b/, name: 'form-label (use: Tailwind label classes)' },  // Design system

  // Tables (Bootstrap-specific styling) - table-responsive, table-hover used with table-bespoke
  { pattern: /\btable-striped\b/, name: 'table-striped' },
  // { pattern: /\btable-hover\b/, name: 'table-hover' },  // Used with table-bespoke
  { pattern: /\btable-bordered\b/, name: 'table-bordered' },
  { pattern: /\btable-dark\b/, name: 'table-dark' },
  // { pattern: /\btable-sm\b/, name: 'table-sm' },  // Used with table-bespoke
  // { pattern: /\btable-responsive\b/, name: 'table-responsive' },  // Used with table-bespoke

  // Alerts (Bootstrap-specific)
  { pattern: /\balert\b/, name: 'alert (use: Tailwind styling)' },
  { pattern: /\balert-/, name: 'alert-*' },

  // Spinners (Bootstrap-specific)
  { pattern: /\bspinner-border\b/, name: 'spinner-border (use: animate-spin)' },
  { pattern: /\bspinner-grow\b/, name: 'spinner-grow' },

  // Text utilities - Bootstrap specific
  { pattern: /\btext-start\b/, name: 'text-start (use: text-left)' },
  { pattern: /\btext-end\b/, name: 'text-end (use: text-right)' },
  { pattern: /\btext-muted\b(?!-foreground)/, name: 'text-muted (use: text-muted-foreground)' },
  { pattern: /\bfw-bold\b/, name: 'fw-bold (use: font-bold)' },
  { pattern: /\bfw-semibold\b/, name: 'fw-semibold (use: font-semibold)' },
  { pattern: /\bfw-medium\b/, name: 'fw-medium (use: font-medium)' },
  { pattern: /\bfw-normal\b/, name: 'fw-normal (use: font-normal)' },
  { pattern: /\bfw-light\b/, name: 'fw-light (use: font-light)' },
  { pattern: /\bfs-[1-6]\b/, name: 'fs-* (use: text-xl, text-2xl, etc.)' },

  // Border utilities - Bootstrap specific
  { pattern: /\bborder-start\b/, name: 'border-start (use: border-l)' },
  { pattern: /\bborder-end\b/, name: 'border-end (use: border-r)' },
  { pattern: /\bborder-secondary\b/, name: 'border-secondary' },
  { pattern: /\brounded-circle\b/, name: 'rounded-circle (use: rounded-full)' },
  { pattern: /\brounded-pill\b/, name: 'rounded-pill (use: rounded-full)' },

  // Position utilities - Bootstrap specific
  { pattern: /\bposition-relative\b/, name: 'position-relative (use: relative)' },
  { pattern: /\bposition-absolute\b/, name: 'position-absolute (use: absolute)' },
  { pattern: /\bposition-fixed\b/, name: 'position-fixed (use: fixed)' },
  { pattern: /\bposition-sticky\b/, name: 'position-sticky (use: sticky)' },
  { pattern: /\bstart-0\b/, name: 'start-0 (use: left-0)' },
  { pattern: /\bend-0\b/, name: 'end-0 (use: right-0)' },

  // Size utilities - Bootstrap specific
  { pattern: /\bw-100\b/, name: 'w-100 (use: w-full)' },
  { pattern: /\bh-100\b/, name: 'h-100 (use: h-full)' },
  { pattern: /\bmin-vh-100\b/, name: 'min-vh-100 (use: min-h-screen)' },
  { pattern: /\bvh-100\b/, name: 'vh-100 (use: h-screen)' },

  // Background colors - Bootstrap specific (NOT text-primary/bg-primary which are Tailwind theme colors)
  // Note: bg-primary, bg-success, bg-warning, bg-danger are defined in tailwind.config.js - allowed
  { pattern: /\bbg-secondary\b/, name: 'bg-secondary (Bootstrap)' },
  { pattern: /\bbg-info\b/, name: 'bg-info (Bootstrap)' },

  // Text colors - Bootstrap specific (NOT text-primary which is a Tailwind theme color)
  // Note: text-primary, text-success, text-warning, text-danger are defined in tailwind.config.js - allowed
  { pattern: /\btext-secondary\b/, name: 'text-secondary (Bootstrap)' },
  { pattern: /\btext-info\b/, name: 'text-info (use: text-cyan-*)' },

  // List group (Bootstrap-specific) - used with bespoke design system
  // { pattern: /\blist-group\b/, name: 'list-group' },  // Used in design system
  // { pattern: /\blist-group-item\b/, name: 'list-group-item' },  // Used in design system

  // Card (Bootstrap-specific structure) - card-header/body/footer are used with card-bespoke design system
  // These are kept for the bespoke design system, not Bootstrap
  // { pattern: /(?<!feature-)\bcard-header\b/, name: 'card-header' },
  // { pattern: /(?<!feature-)\bcard-body\b/, name: 'card-body' },
  // { pattern: /(?<!feature-)\bcard-footer\b/, name: 'card-footer' },
  { pattern: /\bcard-title\b/, name: 'card-title' },
  { pattern: /\bcard-text\b/, name: 'card-text' },

  // Input group (Bootstrap-specific)
  { pattern: /\binput-group\b/, name: 'input-group' },
  { pattern: /\binput-group-/, name: 'input-group-*' },

  // Button group (Bootstrap-specific)
  { pattern: /\bbtn-group\b/, name: 'btn-group' },
  { pattern: /\bbtn-group-/, name: 'btn-group-*' },

  // Dropdown (Bootstrap-specific) - exclude Radix UI CSS variable patterns
  { pattern: /(?<!--radix-)\bdropdown\b(?!-menu-trigger-width)/, name: 'dropdown' },
  { pattern: /(?<!--radix-)\bdropdown-(?!menu-trigger)/, name: 'dropdown-*' },

  // Tooltip/Popover (Bootstrap-specific) - excludes Tailwind bg-popover, text-popover-foreground
  { pattern: /(?<!bg-|text-)\btooltip\b/, name: 'tooltip' },
  { pattern: /(?<!bg-|text-)\bpopover\b(?!-foreground)/, name: 'popover' },

  // Progress (Bootstrap-specific) - excludes custom scroll-progress-bar
  { pattern: /(?<!scroll-)\bprogress\b(?!-)/, name: 'progress' },
  { pattern: /(?<!scroll-)\bprogress-bar\b/, name: 'progress-bar' },

  // Close button (Bootstrap-specific)
  { pattern: /\bbtn-close\b/, name: 'btn-close' },

  // Accordion (Bootstrap-specific)
  { pattern: /\baccordion\b/, name: 'accordion' },
  { pattern: /\baccordion-/, name: 'accordion-*' },

  // Offcanvas (Bootstrap-specific)
  { pattern: /\boffcanvas\b/, name: 'offcanvas' },
  { pattern: /\boffcanvas-/, name: 'offcanvas-*' },

  // Toast (Bootstrap-specific)
  { pattern: /\btoast\b/, name: 'toast' },
  { pattern: /\btoast-/, name: 'toast-*' },
];

// Files/patterns to exclude from checking
const EXCLUDE_PATTERNS = [
  /node_modules/,
  /build\//,
  /dist\//,
  /\.test\.(ts|tsx|js)$/,
  /__tests__\//,
  /\.d\.ts$/,
  /scripts\/.*audit.*\.js$/,  // Exclude audit scripts themselves
  /MIGRATION.*\.md$/,
  /BOOTSTRAP_TO_TAILWIND_MAP\.md$/,
  /src\/components\//,  // Legacy components folder - deprecated per CLAUDE.md
  /landing\//,  // Landing pages use custom CSS classes, not Bootstrap
  /dashboard-theme\.css$/,  // Design system CSS - defines custom styling, not Bootstrap usage
  /index\.css$/,  // Global CSS - contains design system definitions
];

// Specific strings to exclude (comments, type definitions, etc.)
const EXCLUDE_STRINGS = [
  'bootstrap-icons',  // Keep bootstrap-icons reference
  'bi bi-',           // Bootstrap icon classes are OK
  '// bootstrap',     // Comments about bootstrap
  '/* bootstrap',     // Comments about bootstrap
  'text-muted-foreground', // Tailwind version of text-muted
  'cc-',             // Command center custom component classes
  'ask-',            // Ask ProdDash custom component classes
  'date-preset-btn', // DateRangePicker custom class
  'davos-badge',     // Custom badge component
  'inline-help',     // Custom InlineHelp component
  'multiselect-',    // Custom MultiSelect component
  'progress-gradient', // Custom progress gradient classes
  'card-bespoke',    // Custom card component - card-header/body/footer are intentional
  'table-bespoke',   // Custom table component - table classes are intentional
  'nav-pills-bespoke', // Custom nav component - nav-link is intentional
  'btn-bespoke',     // Custom button variants
  'btn-cta',         // Custom CTA button
  'scenario-card',   // Custom scenario card component
  'confidence-badge', // Custom confidence badge
  'nav-dropdown',    // Custom dropdown in navigation
  'nav-bucket-btn',  // Custom navigation button
  'oracle-info-btn', // Oracle widget button
  'quickfind-modal', // QuickFind modal
  'modal-backdrop',  // Modal backdrop (styled in design system)
  'modal-overlay',   // Modal overlay
  'import-modal',    // Import modal
  'kpi-card',        // KPI card custom component
  'badge-bespoke',   // Custom badge variant
  'badge-danger-soft', // Custom soft badge
  'badge-accent-soft', // Custom soft badge
  'effort-badge',    // Effort badge custom component
  'capability-badge', // Capability badge
  'requirement-progress', // Requirement progress custom
  'feasibility-badge', // Custom feasibility badge
  'statusStyle.badge', // Template variable, not Bootstrap
  'capacity-gap', // Custom capacity classes
];

function getAllFiles(dirPath, arrayOfFiles = []) {
  const files = fs.readdirSync(dirPath);

  for (const file of files) {
    const fullPath = path.join(dirPath, file);

    // Skip excluded directories
    if (EXCLUDE_PATTERNS.some(p => p.test(fullPath))) {
      continue;
    }

    if (fs.statSync(fullPath).isDirectory()) {
      getAllFiles(fullPath, arrayOfFiles);
    } else if (/\.(tsx?|jsx?|css)$/.test(file)) {
      arrayOfFiles.push(fullPath);
    }
  }

  return arrayOfFiles;
}

function checkFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const violations = [];

  lines.forEach((line, index) => {
    // Skip lines with excluded strings
    if (EXCLUDE_STRINGS.some(s => line.includes(s))) {
      return;
    }

    // Skip lines that are comments
    if (/^\s*(\/\/|\/\*|\*)/.test(line)) {
      return;
    }

    // Check for className attributes containing bootstrap patterns
    const classNameMatch = line.match(/className\s*=\s*["'`]([^"'`]+)["'`]/g) ||
                          line.match(/className\s*=\s*\{[^}]*["'`]([^"'`]+)["'`]/g);

    if (classNameMatch) {
      for (const match of classNameMatch) {
        for (const { pattern, name } of BOOTSTRAP_PATTERNS) {
          if (pattern.test(match)) {
            violations.push({
              line: index + 1,
              pattern: name,
              content: line.trim().substring(0, 100),
            });
          }
        }
      }
    }

    // Also check CSS files for bootstrap compatibility layer
    if (filePath.endsWith('.css')) {
      for (const { pattern, name } of BOOTSTRAP_PATTERNS) {
        // Look for CSS class definitions like .d-flex { or .btn {
        const cssClassPattern = new RegExp(`^\\.${pattern.source.replace(/\\b/g, '')}\\s*[{,]`);
        if (cssClassPattern.test(line.trim())) {
          violations.push({
            line: index + 1,
            pattern: `CSS: .${name}`,
            content: line.trim().substring(0, 100),
          });
        }
      }
    }
  });

  return violations;
}

function main() {
  console.log('🔍 Scanning for Bootstrap class patterns...\n');

  const srcPath = path.join(process.cwd(), 'src');

  if (!fs.existsSync(srcPath)) {
    console.error('Error: src directory not found');
    process.exit(1);
  }

  const files = getAllFiles(srcPath);
  const allViolations = new Map();
  let totalViolations = 0;

  for (const file of files) {
    const violations = checkFile(file);
    if (violations.length > 0) {
      const relativePath = path.relative(process.cwd(), file);
      allViolations.set(relativePath, violations);
      totalViolations += violations.length;
    }
  }

  if (totalViolations === 0) {
    console.log('✅ No Bootstrap class patterns found!\n');
    console.log('The codebase is using pure Tailwind utilities.');
    process.exit(0);
  }

  console.log('❌ Bootstrap class patterns found!\n');
  console.log(`Total violations: ${totalViolations}\n`);
  console.log('Files with violations:\n');

  for (const [file, violations] of allViolations) {
    console.log(`📄 ${file} (${violations.length} violations)`);

    // Group by pattern
    const byPattern = {};
    for (const v of violations) {
      if (!byPattern[v.pattern]) {
        byPattern[v.pattern] = [];
      }
      byPattern[v.pattern].push(v);
    }

    for (const [pattern, items] of Object.entries(byPattern)) {
      console.log(`   └─ ${pattern}: ${items.length} occurrences`);
      // Show first 2 examples
      items.slice(0, 2).forEach(v => {
        console.log(`      Line ${v.line}: ${v.content.substring(0, 80)}...`);
      });
    }
    console.log('');
  }

  console.log('\n❌ Audit FAILED: Bootstrap classes must be replaced with Tailwind utilities.\n');
  process.exit(1);
}

main();
