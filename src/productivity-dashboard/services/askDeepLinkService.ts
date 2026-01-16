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
];

// ─────────────────────────────────────────────────────────────
// Deep Link Resolution
// ─────────────────────────────────────────────────────────────

/**
 * Convert a Fact Pack key path to a deep link
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

  // Default: return control tower if no mapping found
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
