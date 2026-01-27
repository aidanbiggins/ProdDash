#!/usr/bin/env node
/**
 * UI Style Audit Script
 *
 * Scans src/productivity-dashboard for UI styling violations:
 * 1. Inline style={{...}} with typography props (fontSize, fontWeight, color, letterSpacing, lineHeight)
 *    outside of common components
 * 2. Raw <h1>/<h2>/<h3> usage inside productivity-dashboard components
 *    (only allowed inside designated header components or V2 files with design tokens)
 * 3. stat-label/stat-value class definitions outside the shared theme CSS
 * 4. Hardcoded color values (#hex, rgb, rgba) outside theme files
 * 5. card-bespoke usage (should migrate to GlassPanel)
 *
 * V2 Design System:
 *   V2 components use Tailwind with design tokens (text-foreground, text-muted-foreground,
 *   bg-background, border-border, etc.). Raw h1/h2/h3 are allowed in V2 IF they use
 *   these design tokens. See docs/UI_AUDIT_EXCEPTIONS.md for details.
 *
 * Exit codes:
 *   0 - No violations found
 *   1 - Violations found
 */

const fs = require('fs');
const path = require('path');

// Configuration
const SRC_DIR = path.join(__dirname, '..', 'src', 'productivity-dashboard');
const COMMON_DIR = path.join(SRC_DIR, 'components', 'common');
const V2_DIR = path.join(SRC_DIR, 'components', 'v2');

// V2 design tokens - raw headers using these are compliant
const V2_DESIGN_TOKENS = [
  'text-foreground',
  'text-muted-foreground',
  'bg-background',
  'bg-muted',
  'border-border',
  'border-glass-border'
];

// Typography allowlist - files that legitimately need inline typography
// Common categories:
// 1. UI Primitives that DEFINE the typography system
// 2. Components with tooltip/chart-specific sizing
// 3. Modal/drawer components with complex layouts
//
// All exemptions must be documented in docs/UI_AUDIT_EXCEPTIONS.md
const ALLOWED_TYPOGRAPHY_FILES = [
  // UI Primitives that DEFINE the typography system
  'PageHeader.tsx',
  'SectionHeader.tsx',
  'StatLabel.tsx',
  'StatValue.tsx',
  'KPICard.tsx',
  'AnimatedNumber.tsx',
  'HeadingsV2.tsx',
  // Core components that need dynamic typography
  'EmptyState.tsx',
  'Skeletons.tsx',
  // Components with justified typography exceptions
  'PIIWarningModal.tsx',        // Modal with dense field lists
  'ProgressIndicator.tsx',      // Step indicators with symbols
  'PipelineHealthCard.tsx',     // Chart tooltips
  'DataCoveragePanel.tsx',      // Coverage indicators
  // Drawer components with complex layouts
  'ActionDetailDrawer.tsx',     // Action detail with evidence
  'ExplainDrawer.tsx',          // AI explanations
  'HMDetailDrawer.tsx',         // HM detail view
  'ReqDrilldownDrawer.tsx',     // Requisition drilldown
  'HelpDrawer.tsx',             // Help content
  'PreMortemDrawer.tsx',        // Pre-mortem analysis
  // Modal components
  'ClearDataConfirmationModal.tsx',
  'BenchmarkConfigModal.tsx',
  'StageMappingModal.tsx',
  // Banner/indicator components
  'CoverageBanner.tsx',
  'FilterActiveIndicator.tsx',
  'ConfidenceBadge.tsx',
  'DavosBadge.tsx',
  'DataHealthBadge.tsx',
  // Feature state components
  'FeatureBlockedState.tsx',
  'FeatureLimitedState.tsx',
  // Chart utilities
  'ChartHelp.tsx',
  // Data display components
  'MetricDrillDown.tsx',
  'DataDrillDownModal.tsx',
  'DataHealthPanel.tsx',
  // Date/select controls
  'DateRangePicker.tsx',
  'MultiSelect.tsx',
  // Coverage/progress components
  'CoverageMapPanel.tsx',
  'ImportProgressModal.tsx',
];

// Files with explicit header exemptions - must be documented in UI_AUDIT_EXCEPTIONS.md
const ALLOWED_HEADER_FILES = [
  // UI Primitives that define headers
  'PageHeader.tsx',
  'SectionHeader.tsx',
  'HeadingsV2.tsx',
  // Components with documented exceptions
  'MetricDrillDown.tsx',  // Uses h2 for metric values - data display
  'DataDrillDownModal.tsx',
  'EmptyState.tsx',  // Uses h3 for empty state title
  // Command center components (V2 design tokens in non-V2 path)
  'BottleneckPanelV2.tsx',
  'CommandCenterV2.tsx',
  'PipelineChartV2.tsx',
  'RequisitionsTableV2.tsx',
  'SectionCard.tsx',
  'TeamCapacityPanelV2.tsx',
  // Guidance components with intentional headers
  'CapabilitiesSummary.tsx',
  'RepairSuggestions.tsx',
  'UnavailablePanels.tsx',
  // V2 layout
  'AppLayoutV2.tsx',
  // V2 design system components are handled separately via V2_DESIGN_TOKENS check
];

const ALLOWED_STAT_CLASS_FILES = [
  'dashboard-theme.css'
];

// Color allowlist - files that legitimately need raw colors
// Common categories:
// 1. Theme/config files
// 2. Chart-heavy components (data visualization)
// 3. Components with semantic status colors (good/warn/bad)
//
// All exemptions must be documented in docs/UI_AUDIT_EXCEPTIONS.md
const ALLOWED_COLOR_FILES = [
  // Theme and config files
  'dashboard-theme.css',
  'chartColors.ts',
  'chartPalette.ts',
  'navigation.css',
  'layout.css',
  // V2 chart components - data visualization colors
  'HMFrictionTabV2.tsx',        // HM latency charts with category colors
  'HiringManagersTabV2.tsx',    // HM dashboard charts
  'OverviewTabV2.tsx',          // Overview charts
  'RecruiterDetailTabV2.tsx',   // Recruiter performance charts
  'PipelineFunnelV2.tsx',       // Funnel chart colors
  'PipelineChartV2.tsx',        // Pipeline visualization
  // Common components with legitimate color needs
  'ActionDetailDrawer.tsx',     // Status colors (done/overdue)
  'ExplainDrawer.tsx',          // Explanation panels
  'DataHealthBadge.tsx',        // Health status colors
  'DavosBadge.tsx',             // Badge colors
  'ConfidenceBadge.tsx',        // Confidence colors
  'CoverageBanner.tsx',         // Coverage status
  'ImportProgressModal.tsx',    // Progress colors
  'ProgressIndicator.tsx',      // Step indicator colors
  'PIIWarningModal.tsx',        // Warning colors
  'PipelineHealthCard.tsx',     // Pipeline health chart
  'UnifiedActionQueue.tsx',     // Action queue status colors
  'FilterActiveIndicator.tsx',  // Filter state
  'OrgSwitcher.tsx',            // Org selector
  // Skeleton components (loading state styling)
  'Skeletons.tsx',
  // Modal components
  'BenchmarkConfigModal.tsx',
  'StageMappingModal.tsx',
  'ClearDataConfirmationModal.tsx',
  // Data display components
  'DataCoveragePanel.tsx',
  'HelpDrawer.tsx',
  'PreMortemDrawer.tsx',
  'HMDetailDrawer.tsx',
  'ReqDrilldownDrawer.tsx',
  // Common UI components
  'ChartHelp.tsx',
  'DataDrillDownModal.tsx',
  'DataHealthPanel.tsx',
  'MetricDrillDown.tsx',
  'DateRangePicker.tsx',
  'MultiSelect.tsx',
  // Feature state components
  'FeatureBlockedState.tsx',
  'FeatureLimitedState.tsx',
];

// Files allowed to use card-bespoke
// card-bespoke IS part of the V1 design system (defined in dashboard-theme.css)
// Only allow in components where it's being actively used as the standard card style
const ALLOWED_CARD_BESPOKE_FILES = [
  'DataHealthPanel.tsx',        // Data health indicators
  'PipelineHealthCard.tsx',     // Pipeline visualization card
];

// Typography properties to check for in inline styles
const TYPOGRAPHY_PROPS = ['fontSize', 'fontWeight', 'letterSpacing', 'lineHeight'];

// Patterns
const INLINE_STYLE_REGEX = /style=\{\{([^}]+)\}\}/g;
const RAW_HEADER_REGEX = /<h([123])([^>]*)>/g;
const STAT_CLASS_DEF_REGEX = /\.stat-(label|value)\s*\{/g;
const HARDCODED_COLOR_REGEX = /#[0-9a-fA-F]{3,8}\b|rgb\s*\(|rgba\s*\(/g;
const CARD_BESPOKE_REGEX = /className=["'][^"']*card-bespoke[^"']*["']/g;

let violations = [];

/**
 * Check if a file is in the allowed list for a specific rule
 */
function isAllowedFile(filePath, allowedFiles) {
  const fileName = path.basename(filePath);
  return allowedFiles.includes(fileName);
}

/**
 * Check if a file is in the V2 components directory
 */
function isV2Component(filePath) {
  return filePath.includes(path.sep + 'v2' + path.sep) || filePath.includes('/v2/');
}

/**
 * Check if a file is in the _legacy directory
 */
function isLegacyComponent(filePath) {
  return filePath.includes(path.sep + '_legacy' + path.sep) || filePath.includes('/_legacy/');
}

/**
 * Check if a header tag uses V2 design tokens
 */
function headerUsesV2Tokens(tagAttributes) {
  return V2_DESIGN_TOKENS.some(token => tagAttributes.includes(token));
}

/**
 * Check if a file is in the common components directory
 */
function isInCommonDir(filePath) {
  return filePath.startsWith(COMMON_DIR);
}

/**
 * Parse inline style and check for typography props
 */
function hasTypographyProps(styleContent) {
  return TYPOGRAPHY_PROPS.some(prop => {
    const camelCaseRegex = new RegExp(`\\b${prop}\\s*:`);
    return camelCaseRegex.test(styleContent);
  });
}

/**
 * Scan a file for violations
 */
function scanFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const relativePath = path.relative(process.cwd(), filePath);
  const fileName = path.basename(filePath);
  const ext = path.extname(filePath);
  const isV2 = isV2Component(filePath);
  const isLegacy = isLegacyComponent(filePath);

  // Skip _legacy components - they're explicitly fenced off
  if (isLegacy) {
    return;
  }

  // Only scan TSX/JSX files for inline styles and headers
  if (ext === '.tsx' || ext === '.jsx') {
    lines.forEach((line, index) => {
      const lineNum = index + 1;

      // Rule 1: Check for inline typography styles (skip allowed files)
      if (!isAllowedFile(filePath, ALLOWED_TYPOGRAPHY_FILES)) {
        const styleMatches = line.matchAll(INLINE_STYLE_REGEX);
        for (const match of styleMatches) {
          const styleContent = match[1];
          if (hasTypographyProps(styleContent)) {
            violations.push({
              type: 'INLINE_TYPOGRAPHY',
              file: relativePath,
              line: lineNum,
              content: line.trim().substring(0, 100),
              message: 'Inline typography styling detected. Use StatLabel/StatValue or CSS classes instead.'
            });
          }
        }
      }

      // Rule 2: Check for raw h1/h2/h3 tags
      // V2 components: Allow if using design tokens
      // Non-V2 components: Only allow in designated files
      if (!isAllowedFile(filePath, ALLOWED_HEADER_FILES)) {
        const headerMatches = [...line.matchAll(RAW_HEADER_REGEX)];
        for (const match of headerMatches) {
          const tagAttributes = match[2] || '';

          // For V2 components, allow headers that use design tokens
          if (isV2 && headerUsesV2Tokens(tagAttributes)) {
            continue; // Compliant V2 header
          }

          // For V2 components with headers NOT using tokens, or non-V2 components
          violations.push({
            type: 'RAW_HEADER',
            file: relativePath,
            line: lineNum,
            content: line.trim().substring(0, 100),
            message: isV2
              ? 'Raw header without design tokens. Use text-foreground/text-muted-foreground classes.'
              : 'Raw <h1>/<h2>/<h3> tag detected. Use PageHeader or SectionHeader instead.'
          });
        }
      }

      // Rule 4: Check for hardcoded colors outside allowed files
      if (!isAllowedFile(filePath, ALLOWED_COLOR_FILES)) {
        // Only check style attributes and color-related props
        if (line.includes('style=') || line.includes('color') || line.includes('background') || line.includes('fill') || line.includes('stroke')) {
          const colorMatches = line.match(HARDCODED_COLOR_REGEX);
          if (colorMatches) {
            // Filter out common false positives
            const realColors = colorMatches.filter(match => {
              // Skip if it looks like an ID or hash (7+ chars without rgb)
              if (match.startsWith('#') && match.length > 8) return false;
              // Skip if in a non-style context
              if (line.includes('id=') && line.includes(match)) return false;
              return true;
            });
            if (realColors.length > 0) {
              violations.push({
                type: 'HARDCODED_COLOR',
                file: relativePath,
                line: lineNum,
                content: line.trim().substring(0, 100),
                message: `Hardcoded color (${realColors[0]}) detected. Use CSS variables or Tailwind tokens.`
              });
            }
          }
        }
      }

      // Rule 5: Check for card-bespoke usage
      if (!isAllowedFile(filePath, ALLOWED_CARD_BESPOKE_FILES)) {
        if (CARD_BESPOKE_REGEX.test(line)) {
          violations.push({
            type: 'CARD_BESPOKE',
            file: relativePath,
            line: lineNum,
            content: line.trim().substring(0, 100),
            message: 'card-bespoke class detected. Migrate to glass-panel or Card component.'
          });
          // Reset regex lastIndex
          CARD_BESPOKE_REGEX.lastIndex = 0;
        }
      }
    });
  }

  // Rule 3: Check for stat-label/stat-value class definitions in CSS
  if (ext === '.css') {
    if (!isAllowedFile(filePath, ALLOWED_STAT_CLASS_FILES)) {
      lines.forEach((line, index) => {
        const lineNum = index + 1;
        const classMatches = line.matchAll(STAT_CLASS_DEF_REGEX);
        for (const match of classMatches) {
          violations.push({
            type: 'STAT_CLASS_DEF',
            file: relativePath,
            line: lineNum,
            content: line.trim().substring(0, 100),
            message: 'stat-label/stat-value class definition outside shared theme. Consolidate to dashboard-theme.css.'
          });
        }
      });
    }
  }
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
      if (['.tsx', '.jsx', '.css'].includes(ext)) {
        scanFile(fullPath);
      }
    }
  }
}

/**
 * Print the report
 */
function printReport() {
  console.log('\n========================================');
  console.log('  UI STYLE AUDIT REPORT');
  console.log('========================================\n');

  if (violations.length === 0) {
    console.log('\u2705 No violations found!\n');
    console.log('All UI styling follows the design system guidelines.\n');
    console.log('Design Systems:');
    console.log('  - V1 (legacy): Uses PageHeader, SectionHeader, StatLabel, StatValue');
    console.log('  - V2 (current): Uses Tailwind with tokens (text-foreground, etc.)\n');
    return 0;
  }

  console.log(`\u274C Found ${violations.length} violation(s):\n`);

  // Group by type
  const byType = {};
  violations.forEach(v => {
    if (!byType[v.type]) byType[v.type] = [];
    byType[v.type].push(v);
  });

  // Print by type
  const typeLabels = {
    'INLINE_TYPOGRAPHY': 'Inline Typography Styles',
    'RAW_HEADER': 'Raw Header Tags',
    'STAT_CLASS_DEF': 'Stat Class Definitions Outside Theme',
    'HARDCODED_COLOR': 'Hardcoded Color Values',
    'CARD_BESPOKE': 'Legacy card-bespoke Usage'
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

  console.log('----------------------------------------');
  console.log(`Total: ${violations.length} violation(s)`);
  console.log('----------------------------------------\n');
  console.log('To fix these violations:');
  console.log('  1. Replace inline typography styles with StatLabel/StatValue or Tailwind classes');
  console.log('  2. For V2: Use text-foreground/text-muted-foreground on headers');
  console.log('  3. For V1: Use PageHeader or SectionHeader components');
  console.log('  4. Replace hardcoded colors with CSS variables or Tailwind tokens');
  console.log('  5. Replace card-bespoke with glass-panel or Card component\n');
  console.log('See docs/UI_AUDIT_EXCEPTIONS.md for exception documentation.\n');

  return 1;
}

// Main
console.log('Scanning src/productivity-dashboard for UI style violations...\n');
scanDirectory(SRC_DIR);
const exitCode = printReport();
process.exit(exitCode);
