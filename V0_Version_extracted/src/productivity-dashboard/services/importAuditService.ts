// Import Audit Service
// Tracks all import operations with full audit trail
// See docs/plans/RESILIENT_IMPORT_AND_GUIDANCE_V1.md

import {
  AuditEventType,
  ImportAuditEntry,
  ImportAuditLog,
} from '../types/resilientImportTypes';

/**
 * Create a new audit log for an import operation
 */
export function createAuditLog(sourceFile: string): ImportAuditLog {
  return {
    importId: generateImportId(),
    startedAt: new Date(),
    sourceFile,
    entries: [],
    summary: {
      totalRows: 0,
      importedRows: 0,
      excludedRows: 0,
      warningCount: 0,
      repairsApplied: 0,
      idsSynthesized: 0,
    },
  };
}

/**
 * Add an entry to the audit log
 */
export function logAuditEntry(
  log: ImportAuditLog,
  type: AuditEventType,
  stage: ImportAuditEntry['stage'],
  details: Record<string, unknown>,
  row?: number,
  column?: string
): void {
  log.entries.push({
    timestamp: new Date(),
    type,
    stage,
    row,
    column,
    details,
  });

  // Update summary counters
  switch (type) {
    case 'ROW_EXCLUDED':
      log.summary.excludedRows++;
      break;
    case 'PARSE_FAILED':
      log.summary.warningCount++;
      break;
    case 'REPAIR_APPLIED':
      log.summary.repairsApplied++;
      break;
    case 'ID_SYNTHESIZED':
      log.summary.idsSynthesized++;
      break;
  }
}

/**
 * Finalize the audit log after import completes
 */
export function finalizeAuditLog(
  log: ImportAuditLog,
  totalRows: number,
  importedRows: number
): void {
  log.completedAt = new Date();
  log.summary.totalRows = totalRows;
  log.summary.importedRows = importedRows;

  logAuditEntry(log, 'IMPORT_COMPLETE', 'import', {
    totalRows,
    importedRows,
    excludedRows: log.summary.excludedRows,
    warningCount: log.summary.warningCount,
    repairsApplied: log.summary.repairsApplied,
    idsSynthesized: log.summary.idsSynthesized,
    durationMs: log.completedAt.getTime() - log.startedAt.getTime(),
  });
}

/**
 * Generate a unique import ID
 */
function generateImportId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `imp_${timestamp}_${random}`;
}

/**
 * Get entries filtered by stage
 */
export function getEntriesByStage(
  log: ImportAuditLog,
  stage: ImportAuditEntry['stage']
): ImportAuditEntry[] {
  return log.entries.filter((entry) => entry.stage === stage);
}

/**
 * Get entries filtered by type
 */
export function getEntriesByType(
  log: ImportAuditLog,
  type: AuditEventType
): ImportAuditEntry[] {
  return log.entries.filter((entry) => entry.type === type);
}

/**
 * Get all warnings from the audit log
 */
export function getWarnings(log: ImportAuditLog): ImportAuditEntry[] {
  const warningTypes: AuditEventType[] = [
    'PARSE_FAILED',
    'MAP_UNMAPPED',
    'ID_SYNTHESIS_FAILED',
  ];
  return log.entries.filter((entry) => warningTypes.includes(entry.type));
}

/**
 * Get a summary string for display
 */
export function getAuditSummary(log: ImportAuditLog): string {
  const { summary } = log;
  const parts: string[] = [];

  parts.push(`${summary.importedRows} of ${summary.totalRows} rows imported`);

  if (summary.excludedRows > 0) {
    parts.push(`${summary.excludedRows} rows excluded`);
  }

  if (summary.repairsApplied > 0) {
    parts.push(`${summary.repairsApplied} repairs applied`);
  }

  if (summary.idsSynthesized > 0) {
    parts.push(`${summary.idsSynthesized} IDs synthesized`);
  }

  if (summary.warningCount > 0) {
    parts.push(`${summary.warningCount} warnings`);
  }

  return parts.join(', ');
}

/**
 * Export audit log to JSON for debugging/analysis
 */
export function exportAuditLogToJson(log: ImportAuditLog): string {
  return JSON.stringify(log, null, 2);
}
