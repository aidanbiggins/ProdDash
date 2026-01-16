// Ask Deep Link Service
// Maps Fact Pack key paths to dashboard deep links

import { DeepLinkSpec, DeepLinkResult } from '../types/askTypes';
import { TabType } from '../routes';

// ─────────────────────────────────────────────────────────────
// Key Path to Tab Mapping
// ─────────────────────────────────────────────────────────────

interface KeyPathMapping {
  pattern: RegExp;
  tab: TabType;
  paramExtractor?: (match: RegExpMatchArray) => Record<string, string>;
  highlightSelector?: (match: RegExpMatchArray) => string;
}

const KEY_PATH_MAPPINGS: KeyPathMapping[] = [
  // Control Tower KPIs
  {
    pattern: /^control_tower\.kpis\.median_ttf/,
    tab: 'control-tower',
    highlightSelector: () => '[data-kpi="median-ttf"]',
  },
  {
    pattern: /^control_tower\.kpis\.offer_count/,
    tab: 'control-tower',
    highlightSelector: () => '[data-kpi="offer-count"]',
  },
  {
    pattern: /^control_tower\.kpis\.accept_rate/,
    tab: 'control-tower',
    highlightSelector: () => '[data-kpi="accept-rate"]',
  },
  {
    pattern: /^control_tower\.kpis\.stalled_reqs/,
    tab: 'data-health',
    highlightSelector: () => '[data-section="stalled-reqs"]',
  },
  {
    pattern: /^control_tower\.kpis\.hm_latency/,
    tab: 'hm-friction',
    highlightSelector: () => '[data-kpi="hm-latency"]',
  },

  // Control Tower Risk Summary
  {
    pattern: /^control_tower\.risk_summary/,
    tab: 'control-tower',
    highlightSelector: () => '[data-section="risks"]',
  },

  // Control Tower Action Summary
  {
    pattern: /^control_tower\.action_summary/,
    tab: 'control-tower',
    highlightSelector: () => '[data-section="actions"]',
  },

  // Risks
  {
    pattern: /^risks\.top_risks\[(\d+)\]/,
    tab: 'control-tower',
    paramExtractor: (match) => ({ riskIndex: match[1] }),
    highlightSelector: (match) => `[data-risk-index="${match[1]}"]`,
  },
  {
    pattern: /^risks\.by_failure_mode\.zombie/,
    tab: 'data-health',
    highlightSelector: () => '[data-section="zombie-reqs"]',
  },
  {
    pattern: /^risks\.by_failure_mode\.stalled/,
    tab: 'data-health',
    highlightSelector: () => '[data-section="stalled-reqs"]',
  },
  {
    pattern: /^risks\./,
    tab: 'control-tower',
    highlightSelector: () => '[data-section="risks"]',
  },

  // Actions
  {
    pattern: /^actions\.top_p0/,
    tab: 'control-tower',
    highlightSelector: () => '[data-section="actions"]',
  },
  {
    pattern: /^actions\.top_p1/,
    tab: 'control-tower',
    highlightSelector: () => '[data-section="actions"]',
  },
  {
    pattern: /^actions\.by_owner_type/,
    tab: 'control-tower',
    highlightSelector: () => '[data-section="actions"]',
  },
  {
    pattern: /^actions\./,
    tab: 'control-tower',
    highlightSelector: () => '[data-section="actions"]',
  },

  // Forecast
  {
    pattern: /^forecast\./,
    tab: 'forecasting',
    highlightSelector: () => '[data-section="forecast"]',
  },

  // Velocity
  {
    pattern: /^velocity\.funnel/,
    tab: 'velocity',
    highlightSelector: () => '[data-section="funnel"]',
  },
  {
    pattern: /^velocity\.bottleneck/,
    tab: 'velocity',
    highlightSelector: () => '[data-section="bottleneck"]',
  },
  {
    pattern: /^velocity\.avg_days/,
    tab: 'velocity',
    highlightSelector: () => '[data-section="velocity-metrics"]',
  },
  {
    pattern: /^velocity\./,
    tab: 'velocity',
    highlightSelector: () => '[data-section="velocity"]',
  },

  // Sources
  {
    pattern: /^sources\./,
    tab: 'source-mix',
    highlightSelector: () => '[data-section="sources"]',
  },

  // Capacity
  {
    pattern: /^capacity\./,
    tab: 'capacity',
    highlightSelector: () => '[data-section="capacity"]',
  },

  // Meta (sample sizes, data window)
  {
    pattern: /^meta\.sample_sizes/,
    tab: 'control-tower',
    highlightSelector: () => '[data-section="dataset-info"]',
  },
  {
    pattern: /^meta\.data_health/,
    tab: 'data-health',
    highlightSelector: () => '[data-section="health-overview"]',
  },
  {
    pattern: /^meta\./,
    tab: 'control-tower',
    highlightSelector: () => '[data-section="dataset-info"]',
  },

  // Hiring Manager Ownership
  {
    pattern: /^hiring_manager_ownership\.open_reqs_by_hm\[(\d+)\]/,
    tab: 'hiring-managers',
    paramExtractor: (match) => ({ hmIndex: match[1] }),
    highlightSelector: (match) => `[data-hm-index="${match[1]}"]`,
  },
  {
    pattern: /^hiring_manager_ownership\.total_hiring_managers/,
    tab: 'hiring-managers',
    highlightSelector: () => '[data-section="hm-overview"]',
  },
  {
    pattern: /^hiring_manager_ownership\.available/,
    tab: 'hiring-managers',
    highlightSelector: () => '[data-section="hm-ownership"]',
  },
  {
    pattern: /^hiring_manager_ownership\./,
    tab: 'hiring-managers',
    highlightSelector: () => '[data-section="hm-ownership"]',
  },

  // Recruiter Performance
  {
    pattern: /^recruiter_performance\.top_by_hires\[(\d+)\]/,
    tab: 'recruiter',
    paramExtractor: (match) => ({ recruiterIndex: match[1], sortBy: 'hires' }),
    highlightSelector: (match) => `[data-recruiter-index="${match[1]}"]`,
  },
  {
    pattern: /^recruiter_performance\.top_by_productivity\[(\d+)\]/,
    tab: 'recruiter',
    paramExtractor: (match) => ({ recruiterIndex: match[1], sortBy: 'productivity' }),
    highlightSelector: (match) => `[data-recruiter-index="${match[1]}"]`,
  },
  {
    pattern: /^recruiter_performance\.bottom_by_productivity\[(\d+)\]/,
    tab: 'recruiter',
    paramExtractor: (match) => ({ recruiterIndex: match[1], sortBy: 'productivity' }),
    highlightSelector: (match) => `[data-recruiter-index="${match[1]}"]`,
  },
  {
    pattern: /^recruiter_performance\.team_avg/,
    tab: 'recruiter',
    highlightSelector: () => '[data-section="recruiter-overview"]',
  },
  {
    pattern: /^recruiter_performance\./,
    tab: 'recruiter',
    highlightSelector: () => '[data-section="recruiter-performance"]',
  },

  // Explain summaries
  {
    pattern: /^explain\.time_to_offer/,
    tab: 'velocity',
    highlightSelector: () => '[data-explain="time-to-offer"]',
  },
  {
    pattern: /^explain\.hm_latency/,
    tab: 'hm-friction',
    highlightSelector: () => '[data-explain="hm-latency"]',
  },
  {
    pattern: /^explain\.accept_rate/,
    tab: 'quality',
    highlightSelector: () => '[data-explain="accept-rate"]',
  },
  {
    pattern: /^explain\.pipeline_health/,
    tab: 'overview',
    highlightSelector: () => '[data-explain="pipeline-health"]',
  },
  {
    pattern: /^explain\.source_effectiveness/,
    tab: 'source-mix',
    highlightSelector: () => '[data-explain="source-effectiveness"]',
  },
  {
    pattern: /^explain\./,
    tab: 'control-tower',
    highlightSelector: () => '[data-section="explain"]',
  },
];

// ─────────────────────────────────────────────────────────────
// Deep Link Resolution
// ─────────────────────────────────────────────────────────────

/**
 * Check if a key path has a specific deep link mapping
 * Returns true only if there's an explicit mapping (not a fallback)
 */
export function hasDeepLinkMapping(keyPath: string): boolean {
  for (const mapping of KEY_PATH_MAPPINGS) {
    if (mapping.pattern.test(keyPath)) {
      return true;
    }
  }
  return false;
}

/**
 * Convert a Fact Pack key path to a deep link
 * Returns null if no specific mapping exists (use hasDeepLinkMapping for strict validation)
 */
export function keyPathToDeepLink(keyPath: string): DeepLinkResult | null {
  for (const mapping of KEY_PATH_MAPPINGS) {
    const match = keyPath.match(mapping.pattern);
    if (match) {
      const params = mapping.paramExtractor ? mapping.paramExtractor(match) : {};
      const highlightSelector = mapping.highlightSelector ? mapping.highlightSelector(match) : undefined;

      // Build URL path
      const urlPath = tabToUrlPath(mapping.tab);

      return {
        url: urlPath,
        tab: mapping.tab,
        params,
        highlightSelector,
      };
    }
  }

  // Return null if no specific mapping - callers should handle this
  return null;
}

/**
 * Convert a Fact Pack key path to a deep link with fallback
 * For UI use where a default is acceptable
 */
export function keyPathToDeepLinkWithFallback(keyPath: string): DeepLinkResult {
  const result = keyPathToDeepLink(keyPath);
  if (result) return result;

  // Default fallback to control tower
  return {
    url: '/control-tower',
    tab: 'control-tower',
    params: {},
  };
}

/**
 * Convert tab ID to URL path
 */
function tabToUrlPath(tab: TabType): string {
  const tabPaths: Record<TabType, string> = {
    'control-tower': '/control-tower',
    'ask': '/ask',
    'overview': '/diagnose/overview',
    'recruiter': '/diagnose/recruiter',
    'hm-friction': '/diagnose/hm-friction',
    'hiring-managers': '/diagnose/hiring-managers',
    'quality': '/diagnose/quality',
    'source-mix': '/diagnose/sources',
    'velocity': '/diagnose/velocity',
    'capacity': '/plan/capacity',
    'forecasting': '/plan/forecast',
    'data-health': '/settings/data-health',
    'ai-settings': '/settings/ai',
    'org-settings': '/settings/org',
  };

  return tabPaths[tab] || '/';
}

/**
 * Build a deep link spec from tab and params
 */
export function buildDeepLinkSpec(
  label: string,
  tab: TabType,
  params: Record<string, string> = {}
): DeepLinkSpec {
  return {
    label,
    tab,
    params,
  };
}

// ─────────────────────────────────────────────────────────────
// Highlight Management
// ─────────────────────────────────────────────────────────────

let highlightTimeout: ReturnType<typeof setTimeout> | null = null;

/**
 * Highlight an element on the page temporarily
 */
export function highlightElement(selector: string): void {
  // Clear any existing highlight
  clearHighlight();

  // Find and highlight the element
  setTimeout(() => {
    const element = document.querySelector(selector);
    if (element) {
      element.classList.add('ask-highlight-target');
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });

      // Remove highlight after 3 seconds
      highlightTimeout = setTimeout(() => {
        element.classList.remove('ask-highlight-target');
      }, 3000);
    }
  }, 100); // Small delay to allow navigation to complete
}

/**
 * Clear any active highlight
 */
export function clearHighlight(): void {
  if (highlightTimeout) {
    clearTimeout(highlightTimeout);
    highlightTimeout = null;
  }

  document.querySelectorAll('.ask-highlight-target').forEach(el => {
    el.classList.remove('ask-highlight-target');
  });
}

// ─────────────────────────────────────────────────────────────
// Navigation Helper
// ─────────────────────────────────────────────────────────────

/**
 * Navigate to a deep link and optionally highlight the target
 */
export function navigateToDeepLink(
  deepLink: DeepLinkResult,
  onNavigate: (tab: TabType) => void
): void {
  // Navigate to the tab
  onNavigate(deepLink.tab as TabType);

  // Highlight the target element if specified
  if (deepLink.highlightSelector) {
    highlightElement(deepLink.highlightSelector);
  }
}
