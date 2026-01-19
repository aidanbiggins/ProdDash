// Snapshot Date Service
// Infers snapshot dates from filenames and file metadata
// See docs/plans/RESILIENT_IMPORT_AND_GUIDANCE_V1.md

import { SnapshotDateInference, ConfidenceLevel } from '../types/resilientImportTypes';

// ============================================
// DATE PATTERNS
// ============================================

// Pattern definitions with extraction functions
const DATE_PATTERNS: Array<{
  regex: RegExp;
  extract: (match: RegExpMatchArray) => Date | null;
  description: string;
}> = [
  // ISO format: 2026-01-18
  {
    regex: /(\d{4})-(\d{2})-(\d{2})/,
    extract: (m) => new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3])),
    description: 'ISO date (YYYY-MM-DD)',
  },
  // US format: 01-18-2026 or 01/18/2026
  {
    regex: /(\d{2})[-/](\d{2})[-/](\d{4})/,
    extract: (m) => new Date(parseInt(m[3]), parseInt(m[1]) - 1, parseInt(m[2])),
    description: 'US date (MM-DD-YYYY)',
  },
  // Compact ISO: 20260118
  {
    regex: /(\d{4})(\d{2})(\d{2})/,
    extract: (m) => new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3])),
    description: 'Compact date (YYYYMMDD)',
  },
  // Week-of patterns: week_of_2026-01-18
  {
    regex: /week[_-]?of[_-]?(\d{4})-(\d{2})-(\d{2})/i,
    extract: (m) => new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3])),
    description: 'Week-of date',
  },
  // Short week patterns: wk_2026-01-18
  {
    regex: /wk[_-]?(\d{4})-(\d{2})-(\d{2})/i,
    extract: (m) => new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3])),
    description: 'Week abbreviation date',
  },
  // Month name patterns: Jan-18-2026, jan_18_2026
  {
    regex: /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[_-]?(\d{1,2})[_-]?(\d{4})/i,
    extract: (m) => {
      const monthMap: Record<string, number> = {
        jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
        jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
      };
      const month = monthMap[m[1].toLowerCase()];
      return new Date(parseInt(m[3]), month, parseInt(m[2]));
    },
    description: 'Month name date (Mon-DD-YYYY)',
  },
  // European format: 18-01-2026
  {
    regex: /(\d{2})[-/](\d{2})[-/](\d{4})/,
    extract: (m) => {
      // Ambiguous - try to detect by checking if first number > 12
      const first = parseInt(m[1]);
      const second = parseInt(m[2]);
      if (first > 12) {
        // Likely DD-MM-YYYY
        return new Date(parseInt(m[3]), second - 1, first);
      }
      // Assume MM-DD-YYYY (already handled above, but keep as fallback)
      return null;
    },
    description: 'European date (DD-MM-YYYY)',
  },
];

// ============================================
// INFERENCE FUNCTIONS
// ============================================

/**
 * Infer snapshot date from a filename
 */
export function inferSnapshotDateFromFilename(filename: string): SnapshotDateInference | null {
  // Remove file extension for cleaner matching
  const baseName = filename.replace(/\.(csv|xls|xlsx)$/i, '');

  for (const pattern of DATE_PATTERNS) {
    const match = baseName.match(pattern.regex);
    if (match) {
      const date = pattern.extract(match);
      if (date && isValidDate(date)) {
        return {
          date: startOfDay(date),
          source: 'filename',
          confidence: 'high',
        };
      }
    }
  }

  return null;
}

/**
 * Infer snapshot date from file modification time
 */
export function inferSnapshotDateFromFileModified(file: File): SnapshotDateInference | null {
  const modDate = new Date(file.lastModified);

  if (!isValidDate(modDate)) {
    return null;
  }

  // Only use if file was modified within the last 30 days
  const daysSinceModified = daysBetween(modDate, new Date());
  if (daysSinceModified > 30) {
    return null;
  }

  return {
    date: startOfDay(modDate),
    source: 'file_modified',
    confidence: daysSinceModified <= 7 ? 'medium' : 'low',
  };
}

/**
 * Infer snapshot date using all available information
 */
export function inferSnapshotDate(
  file: File,
  userSpecifiedDate?: Date
): SnapshotDateInference {
  // 1. User explicitly set date (highest priority)
  if (userSpecifiedDate && isValidDate(userSpecifiedDate)) {
    return {
      date: startOfDay(userSpecifiedDate),
      source: 'user_specified',
      confidence: 'high',
    };
  }

  // 2. Try to parse from filename
  const fromFilename = inferSnapshotDateFromFilename(file.name);
  if (fromFilename) {
    return fromFilename;
  }

  // 3. Try file modification date
  const fromModified = inferSnapshotDateFromFileModified(file);
  if (fromModified) {
    return fromModified;
  }

  // 4. Default to import date
  return {
    date: startOfDay(new Date()),
    source: 'import_date',
    confidence: 'low',
  };
}

// ============================================
// VALIDATION HELPERS
// ============================================

/**
 * Check if a date is valid (not NaN, not in future, not too old)
 */
function isValidDate(date: Date): boolean {
  if (isNaN(date.getTime())) return false;

  const now = new Date();
  // Don't accept future dates
  if (date > now) return false;

  // Don't accept dates more than 5 years old
  const fiveYearsAgo = new Date();
  fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
  if (date < fiveYearsAgo) return false;

  return true;
}

/**
 * Get the start of day for a date
 */
function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

/**
 * Calculate days between two dates
 */
function daysBetween(from: Date, to: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.floor(Math.abs(to.getTime() - from.getTime()) / msPerDay);
}

// ============================================
// DISPLAY HELPERS
// ============================================

/**
 * Get a human-readable source description
 */
export function getSnapshotDateSourceDescription(
  inference: SnapshotDateInference
): string {
  switch (inference.source) {
    case 'filename':
      return 'Detected from filename';
    case 'file_modified':
      return 'From file modification date';
    case 'user_specified':
      return 'Set by user';
    case 'import_date':
      return 'Using import date (no date found in filename)';
    default:
      return 'Unknown source';
  }
}

/**
 * Get confidence color for display
 */
export function getConfidenceColor(confidence: ConfidenceLevel): string {
  switch (confidence) {
    case 'high':
      return 'success';
    case 'medium':
      return 'warning';
    case 'low':
      return 'secondary';
    default:
      return 'secondary';
  }
}

/**
 * Format date for display
 */
export function formatSnapshotDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
