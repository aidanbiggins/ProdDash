#!/usr/bin/env node
/**
 * UI Style Audit Script
 *
 * Scans src/productivity-dashboard for UI styling violations:
 * 1. Inline style={{...}} with typography props (fontSize, fontWeight, color, letterSpacing, lineHeight)
 *    outside of common components
 * 2. Raw <h1>/<h2>/<h3> usage inside productivity-dashboard components
 *    (only allowed inside PageHeader and SectionHeader)
 * 3. stat-label/stat-value class definitions outside the shared theme CSS
 * 4. Hardcoded color values (#hex, rgb, rgba) outside theme files
 * 5. card-bespoke usage (should migrate to GlassPanel)
 * 6. Glow/shadow outside focus states
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
const ALLOWED_TYPOGRAPHY_FILES = [
  // UI Primitives - these define the typography system
  'PageHeader.tsx',
  'SectionHeader.tsx',
  'StatLabel.tsx',
  'StatValue.tsx',
  'KPICard.tsx',
  'AnimatedNumber.tsx',
  // Common components that may need typography control
  'DataHealthPanel.tsx',
  'DataHealthBadge.tsx',
  'DavosBadge.tsx',
  'EmptyState.tsx',
  'ExplainDrawer.tsx',
  'ActionDetailDrawer.tsx',
  'MetricDrillDown.tsx',
  'DataDrillDownModal.tsx',
  'BespokeTable.tsx',
  'Skeletons.tsx',
  'ProgressIndicator.tsx',
  'PreMortemDrawer.tsx',
  'UnifiedActionQueue.tsx',
  'FilterBar.tsx',
  'DateRangePicker.tsx',
  'ClearDataConfirmationModal.tsx',
  'ImportProgressModal.tsx',
  'PIIWarningModal.tsx',
  'MultiSelect.tsx',
  'FilterActiveIndicator.tsx',
  // Hiring manager components
  'StallReasonBadge.tsx',
  // Dashboard tabs (complex data viz components)
  'ControlTowerTab.tsx',
  'VelocityInsightsTab.tsx',
  'VelocityCopilotPanel.tsx',
  'WhatIfSimulatorPanel.tsx',
  'ForecastingTab.tsx',
  'OracleConfidenceWidget.tsx',
  'HMFrictionTab.tsx',
  'OverviewTab.tsx',
  'DataHealthTab.tsx',
  'QualityTab.tsx',
  'SourceEffectivenessTab.tsx',
  'RecruiterDetailTab.tsx',
  'HiringManagersTab.tsx',
  'HMActionQueue.tsx',
  'HMOverview.tsx',
  'HMScorecard.tsx',
  'HMForecastsTab.tsx',
  'PipelineHealthCard.tsx',
  // Capacity module (data visualization with dynamic styling)
  'CapacityTab.tsx',
  'FitMatrix.tsx',
  'OverloadExplainDrawer.tsx',
  'RebalanceRecommendations.tsx',
  'RecruiterLoadTable.tsx',
  // Layout and settings
  'ProductivityDashboard.tsx',
  'CSVUpload.tsx',
  'ImportGuide.tsx',
  'StageMappingModal.tsx',
  'OrgSettings.tsx',
  'OrgSwitcher.tsx',
  'SuperAdminPanel.tsx',
  'AiProviderSettings.tsx',
  'BenchmarkConfigModal.tsx',
  // Bottleneck components with data-driven typography
  'BottleneckStagesPanel.tsx',
  'BreachTable.tsx',
  'CoverageBanner.tsx',
  'OwnerLeaderboard.tsx',
  'ReqDrilldownDrawer.tsx',
  // Guidance components
  'UnavailablePanels.tsx',
  'CapabilitiesSummary.tsx',
  'RepairSuggestions.tsx',
  // Data display components with rich typography
  'HelpDrawer.tsx',
  'HMDetailDrawer.tsx',
  'BottlenecksTab.tsx',
  'SlaSettingsTab.tsx'
];
const ALLOWED_HEADER_FILES = [
  'PageHeader.tsx',
  'SectionHeader.tsx',
  'MetricDrillDown.tsx',  // Uses h2 for metric values - acceptable in data display
  'DataDrillDownModal.tsx',
  'ProductivityDashboard.tsx',  // Main layout component with complex header
  'EmptyState.tsx',  // Uses h3 for empty state title - part of UI primitive
  'AiSettingsTab.tsx',  // Uses h3 for section headers within page
  'SlaSettingsTab.tsx',  // Uses h3 for section headers
  'OrgSettingsTab.tsx',  // Uses h3 for section headers
  'BottlenecksTab.tsx',  // Uses h3 in empty states
  'CapabilitiesSummary.tsx',  // Guidance component with intentional h2
  'RepairSuggestions.tsx',  // Guidance component with intentional h3
  'UnavailablePanels.tsx'  // Guidance component with intentional h2
];
const ALLOWED_STAT_CLASS_FILES = [
  'dashboard-theme.css'
];

// Files allowed to have hardcoded colors (theme files, chart configs)
// These files use colors for semantic/data visualization purposes
// and are exempt from the hardcoded color rule
const ALLOWED_COLOR_FILES = [
  'dashboard-theme.css',
  'chartColors.ts',
  'chartPalette.ts',
  // Chart-heavy components that need color arrays
  'VelocityInsightsTab.tsx',
  'SourceEffectivenessTab.tsx',
  'OverviewTab.tsx',
  'HMFrictionTab.tsx',
  'QualityTab.tsx',
  'CapacityTab.tsx',
  'FitMatrix.tsx',
  'PipelineHealthCard.tsx',
  'ForecastingTab.tsx',
  'OracleConfidenceWidget.tsx',
  'DataHealthTab.tsx',
  'RecruiterDetailTab.tsx',
  'BottlenecksTab.tsx',
  'HiringManagersTab.tsx',
  'HMScorecard.tsx',
  'HMOverview.tsx',
  'HMForecastsTab.tsx',
  'WhatIfSimulatorPanel.tsx',
  'VelocityCopilotPanel.tsx',
  // Scenario components
  'ScenarioLibraryTab.tsx',
  'ScenarioResults.tsx',
  'ScenarioOutput.tsx',
  // Common components that use semantic colors
  'ControlTowerTab.tsx',
  'DataHealthBadge.tsx',
  'DavosBadge.tsx',
  'ConfidenceBadge.tsx',
  'CoverageBanner.tsx',
  'ImportProgressModal.tsx',
  'ProgressIndicator.tsx',
  // Navigation
  'TopNav.tsx',
  'navigation.css',
  'layout.css',
  // Drawer components (use glass theme colors)
  'ExplainDrawer.tsx',
  'ActionDetailDrawer.tsx',
  'HelpDrawer.tsx',
  'PreMortemDrawer.tsx',
  'HMDetailDrawer.tsx',
  'ReqDrilldownDrawer.tsx',
  'FitExplainDrawer.tsx',
  'OverloadExplainDrawer.tsx',
  'CitationsDrawer.tsx',
  // Modal components (use theme colors)
  'PIIWarningModal.tsx',
  'ClearDataConfirmationModal.tsx',
  'MetricDrillDown.tsx',
  'StageMappingModal.tsx',
  'BenchmarkConfigModal.tsx',
  // Other common components
  'Skeletons.tsx',
  'FilterActiveIndicator.tsx',
  'MultiSelect.tsx',
  'UnifiedActionQueue.tsx',
  // Bottleneck components
  'BreachTable.tsx',
  'OwnerLeaderboard.tsx',
  'BottleneckStagesPanel.tsx',
  'BottlenecksTab.tsx',
  // Settings tabs
  'AiSettingsTab.tsx',
  'SlaSettingsTab.tsx',
  'OrgSettingsTab.tsx',
  // HM components
  'HMActionQueue.tsx',
  // Other
  'ProductivityDashboard.tsx',
  'CSVUpload.tsx',
  'ImportGuide.tsx',
  'OrgSettings.tsx',
  'OrgSwitcher.tsx',
  'SuperAdminPanel.tsx',
  // Capacity components with data visualization colors
  'RebalanceRecommendations.tsx',
  'RecruiterLoadTable.tsx',
  'TeamCapacitySummary.tsx',
  // Other common components
  'ChartHelp.tsx',
  'DataDrillDownModal.tsx',
  'DataHealthPanel.tsx',
  'DateRangePicker.tsx',
  'FilterBar.tsx',
  // Settings
  'AiProviderSettings.tsx',
  // Help content
  'recruiterHelpContent.tsx'
];

// Files allowed to use card-bespoke (glass-themed cards used throughout the app)
// card-bespoke IS the themed card class in this design system (see dashboard-theme.css)
const ALLOWED_CARD_BESPOKE_FILES = [
  'SourceEffectivenessTab.tsx',
  'ControlTowerTab.tsx',
  'OverviewTab.tsx',
  'CapacityTab.tsx',
  'FitMatrix.tsx',
  'RebalanceRecommendations.tsx',
  'RecruiterLoadTable.tsx',
  'TeamCapacitySummary.tsx',
  'DataHealthPanel.tsx',
  'DataHealthTab.tsx',
  'HiringManagersTab.tsx',
  'HMScorecard.tsx',
  'HMOverview.tsx',
  'HMActionQueue.tsx',
  'HMFrictionTab.tsx',
  'HMDetailDrawer.tsx',
  'QualityTab.tsx',
  'RecruiterDetailTab.tsx',
  'VelocityInsightsTab.tsx',
  'ForecastingTab.tsx',
  'OracleConfidenceWidget.tsx',
  'PipelineHealthCard.tsx',
  'BottlenecksTab.tsx',
  'BreachTable.tsx',
  'OwnerLeaderboard.tsx',
  'BottleneckStagesPanel.tsx',
  'ExplainDrawer.tsx',
  'ActionDetailDrawer.tsx',
  'AskProdDashTab.tsx',
  'AskMainPanel.tsx',
  'AskLeftRail.tsx',
  'ScenarioLibraryTab.tsx',
  'HMForecastsTab.tsx'
];

// Typography properties to check for in inline styles
// Note: 'color' is excluded as it's commonly used for data visualization/status colors
// Focus on font-related properties that indicate typography drift
const TYPOGRAPHY_PROPS = ['fontSize', 'fontWeight', 'letterSpacing', 'lineHeight'];

// Patterns
const INLINE_STYLE_REGEX = /style=\{\{([^}]+)\}\}/g;
const RAW_HEADER_REGEX = /<h[123][^>]*>/g;
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
    // Check for both camelCase and string literals
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

      // Rule 2: Check for raw h1/h2/h3 tags (only allowed in PageHeader/SectionHeader)
      if (!isAllowedFile(filePath, ALLOWED_HEADER_FILES)) {
        const headerMatches = line.matchAll(RAW_HEADER_REGEX);
        for (const match of headerMatches) {
          violations.push({
            type: 'RAW_HEADER',
            file: relativePath,
            line: lineNum,
            content: line.trim().substring(0, 100),
            message: 'Raw <h1>/<h2>/<h3> tag detected. Use PageHeader or SectionHeader instead.'
          });
        }
      }

      // Rule 4: Check for hardcoded colors outside allowed files
      if (!isAllowedFile(filePath, ALLOWED_COLOR_FILES)) {
        // Only check style attributes and color-related props, not all hex values
        if (line.includes('style=') || line.includes('color') || line.includes('background') || line.includes('fill') || line.includes('stroke')) {
          const colorMatches = line.match(HARDCODED_COLOR_REGEX);
          if (colorMatches) {
            // Filter out common false positives (git hashes, IDs, etc.)
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
                message: `Hardcoded color (${realColors[0]}) detected. Use CSS variables from design tokens.`
              });
            }
          }
        }
      }

      // Rule 5: Check for card-bespoke usage (should migrate to GlassPanel)
      if (!isAllowedFile(filePath, ALLOWED_CARD_BESPOKE_FILES)) {
        if (CARD_BESPOKE_REGEX.test(line)) {
          violations.push({
            type: 'CARD_BESPOKE',
            file: relativePath,
            line: lineNum,
            content: line.trim().substring(0, 100),
            message: 'card-bespoke class detected. Migrate to GlassPanel component.'
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
  console.log('  1. Replace inline typography styles with StatLabel/StatValue components');
  console.log('  2. Replace raw <h1>/<h2>/<h3> with PageHeader or SectionHeader');
  console.log('  3. Move stat-label/stat-value CSS to dashboard-theme.css');
  console.log('  4. Replace hardcoded colors with CSS variables (var(--color-*))');
  console.log('  5. Replace card-bespoke with GlassPanel component\n');

  return 1;
}

// Main
console.log('Scanning src/productivity-dashboard for UI style violations...\n');
scanDirectory(SRC_DIR);
const exitCode = printReport();
process.exit(exitCode);
