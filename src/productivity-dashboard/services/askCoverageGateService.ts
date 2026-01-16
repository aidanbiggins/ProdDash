// Ask Coverage Gate Service
// Validates minimum Fact Pack capabilities for Ask ProdDash to be enabled

import { AskFactPack } from '../types/askTypes';

// ─────────────────────────────────────────────────────────────
// Coverage Check Types
// ─────────────────────────────────────────────────────────────

export interface CoverageIssue {
  code: string;
  message: string;
  howToFix: string;
}

export interface CoverageGateResult {
  enabled: boolean;
  issues: CoverageIssue[];
}

// ─────────────────────────────────────────────────────────────
// Coverage Check Functions
// ─────────────────────────────────────────────────────────────

/**
 * Check if the Fact Pack has minimum required capabilities for Ask ProdDash
 *
 * Required capabilities:
 * 1. Total requisitions > 0
 * 2. Open requisitions count available
 * 3. recruiter_performance.available = true
 * 4. hiring_manager_ownership.available = true
 */
export function checkAskCoverage(factPack: AskFactPack): CoverageGateResult {
  const issues: CoverageIssue[] = [];

  // Check 1: Total requisitions
  if (factPack.meta.sample_sizes.total_reqs === 0) {
    issues.push({
      code: 'NO_REQUISITIONS',
      message: 'No requisitions found in dataset',
      howToFix: 'Import requisition data with at least req_id and status fields',
    });
  }

  // Check 2: Open requisitions (implicit from forecast.open_reqs or control_tower.kpis.stalled_reqs.n)
  // If we have reqs but no open reqs data, that's a data mapping issue
  if (factPack.meta.sample_sizes.total_reqs > 0) {
    const hasOpenReqsData = factPack.forecast.open_reqs >= 0 || factPack.control_tower.kpis.stalled_reqs.n > 0;
    if (!hasOpenReqsData) {
      issues.push({
        code: 'NO_OPEN_REQS_DATA',
        message: 'Unable to determine open requisitions',
        howToFix: 'Ensure requisitions have a status field mapped to Open/Closed states',
      });
    }
  }

  // Check 3: Recruiter performance available
  if (!factPack.recruiter_performance.available) {
    issues.push({
      code: 'NO_RECRUITER_DATA',
      message: factPack.recruiter_performance.unavailable_reason || 'Recruiter performance data not available',
      howToFix: 'Ensure requisitions have recruiter_id field populated with recruiter assignments',
    });
  }

  // Check 4: Hiring manager ownership available
  if (!factPack.hiring_manager_ownership.available) {
    issues.push({
      code: 'NO_HM_DATA',
      message: factPack.hiring_manager_ownership.unavailable_reason || 'Hiring manager ownership data not available',
      howToFix: 'Ensure requisitions have hiring_manager_id field populated with HM assignments',
    });
  }

  return {
    enabled: issues.length === 0,
    issues,
  };
}

/**
 * Get a human-readable summary of coverage issues
 */
export function getCoverageIssueSummary(result: CoverageGateResult): string {
  if (result.enabled) {
    return 'Ask ProdDash is ready to use.';
  }

  const issueCount = result.issues.length;
  const issueList = result.issues.map(i => `• ${i.message}`).join('\n');

  return `Ask ProdDash requires ${issueCount} data issue${issueCount > 1 ? 's' : ''} to be resolved:\n\n${issueList}`;
}

/**
 * Check if a specific capability is available
 */
export function hasCapability(
  factPack: AskFactPack,
  capability: 'requisitions' | 'recruiter_performance' | 'hiring_manager_ownership' | 'candidates'
): boolean {
  const capabilityChecks: Record<typeof capability, boolean> = {
    requisitions: factPack.meta.sample_sizes.total_reqs > 0,
    recruiter_performance: factPack.recruiter_performance.available,
    hiring_manager_ownership: factPack.hiring_manager_ownership.available,
    candidates: factPack.meta.sample_sizes.total_candidates > 0,
  };

  return capabilityChecks[capability];
}
