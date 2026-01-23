// Attention Navigation Service
// Single routing utility for Attention V2 bucket CTAs.
// Maps bucket IDs to deterministic destinations (route or focused drawer).

import { AttentionBucketId, AttentionDrilldownData } from '../types/attentionTypes';
import { TabType } from '../routes';

// ============================================
// TYPES
// ============================================

export type AttentionLinkType = 'route' | 'drawer';

export type DrawerFocus = 'recruiters' | 'hiringManagers' | 'reqClusters';

export interface AttentionLink {
  type: AttentionLinkType;
  route?: TabType;
  drawerFocus?: DrawerFocus;
  label: string;
}

export interface AttentionNavigationContext {
  drilldownData: AttentionDrilldownData;
}

export interface AttentionNavigationHelpers {
  navigateToTab: (tab: TabType) => void;
  openDrawerWithFocus: (focus: DrawerFocus) => void;
}

// ============================================
// BUCKET → DESTINATION MAPPING
// ============================================

const BUCKET_DESTINATIONS: Record<AttentionBucketId, { route: TabType; drawerFocus: DrawerFocus; label: string }> = {
  recruiter_throughput: {
    route: 'recruiter',
    drawerFocus: 'recruiters',
    label: 'View recruiters',
  },
  hm_friction: {
    route: 'hm-friction',
    drawerFocus: 'hiringManagers',
    label: 'View HMs',
  },
  pipeline_health: {
    route: 'overview',
    drawerFocus: 'reqClusters',
    label: 'View pipeline',
  },
  aging_stalled: {
    route: 'overview',
    drawerFocus: 'reqClusters',
    label: 'View stalled',
  },
  offer_close_risk: {
    route: 'quality',
    drawerFocus: 'reqClusters',
    label: 'View offers',
  },
};

// ============================================
// PUBLIC API
// ============================================

/**
 * Determines the best navigation destination for a bucket CTA.
 * Prefers deep-linking to an existing tab view.
 * Falls back to opening the drilldown drawer focused on the relevant section
 * if the drilldown has data for that focus area.
 */
export function getAttentionLink(
  bucketId: AttentionBucketId,
  context: AttentionNavigationContext
): AttentionLink {
  const dest = BUCKET_DESTINATIONS[bucketId];
  if (!dest) {
    // Unknown bucket — open drawer generically
    return { type: 'drawer', drawerFocus: 'recruiters', label: 'View details' };
  }

  // Route is always available (tabs always exist), so prefer it.
  // Fallback to drawer only if the route view would show nothing meaningful
  // but the drawer has relevant drilldown data.
  const drawerHasData = hasDrilldownDataForFocus(context.drilldownData, dest.drawerFocus);

  // We always prefer the route since tabs always exist and show useful content.
  // The drawer focus is a secondary option accessible via the "Drilldown" button.
  return {
    type: 'route',
    route: dest.route,
    drawerFocus: dest.drawerFocus,
    label: dest.label,
  };
}

/**
 * Executes the navigation action for a bucket CTA.
 * Routes to the appropriate tab or opens the drawer focused on the right section.
 */
export function navigateToAttentionEvidence(
  bucketId: AttentionBucketId,
  context: AttentionNavigationContext,
  helpers: AttentionNavigationHelpers
): void {
  const link = getAttentionLink(bucketId, context);

  if (link.type === 'route' && link.route) {
    helpers.navigateToTab(link.route);
  } else if (link.drawerFocus) {
    helpers.openDrawerWithFocus(link.drawerFocus);
  }
}

/**
 * Gets all bucket IDs that have valid destinations.
 * Useful for validation and testing.
 */
export function getAllBucketDestinations(): Record<AttentionBucketId, AttentionLink> {
  const allIds: AttentionBucketId[] = [
    'recruiter_throughput',
    'hm_friction',
    'pipeline_health',
    'aging_stalled',
    'offer_close_risk',
  ];

  const emptyDrilldown: AttentionDrilldownData = {
    recruiters: [],
    hiringManagers: [],
    reqClusters: [],
  };

  const result: Record<string, AttentionLink> = {};
  for (const id of allIds) {
    result[id] = getAttentionLink(id, { drilldownData: emptyDrilldown });
  }
  return result as Record<AttentionBucketId, AttentionLink>;
}

// ============================================
// DRILLDOWN EXPORT UTILITIES
// ============================================

/**
 * Formats a drilldown section as copyable plain text.
 */
export function formatDrilldownAsText(
  data: AttentionDrilldownData,
  focus: DrawerFocus
): string {
  const lines: string[] = [];

  if (focus === 'recruiters') {
    lines.push('Top Recruiters to Intervene');
    lines.push('─'.repeat(40));
    for (const r of data.recruiters) {
      lines.push(`${r.recruiterName} | ${r.openReqCount} reqs | ${r.keyLagMetric}`);
      if (r.utilizationLabel) lines.push(`  Utilization: ${r.utilizationLabel}`);
      lines.push(`  → ${r.suggestedIntervention}`);
      lines.push('');
    }
  } else if (focus === 'hiringManagers') {
    lines.push('Top HMs to Escalate');
    lines.push('─'.repeat(40));
    for (const hm of data.hiringManagers) {
      const metrics = [
        hm.feedbackLatencyDays !== null ? `Feedback: ${hm.feedbackLatencyDays}d` : null,
        hm.decisionLatencyDays !== null ? `Decision: ${hm.decisionLatencyDays}d` : null,
        hm.openItemCount > 0 ? `${hm.openItemCount} overdue` : null,
      ].filter(Boolean).join(' | ');
      lines.push(`${hm.hmName} | ${metrics}`);
      lines.push(`  → ${hm.suggestedIntervention}`);
      lines.push('');
    }
  } else if (focus === 'reqClusters') {
    lines.push('At-Risk Req Clusters');
    lines.push('─'.repeat(40));
    for (const c of data.reqClusters) {
      lines.push(`${c.clusterLabel} | ${c.reqCount} reqs | Avg ${c.avgDaysOpen}d open | ${c.riskLabel}`);
      lines.push(`  → ${c.suggestedIntervention}`);
      lines.push('');
    }
  }

  return lines.join('\n').trim();
}

/**
 * Formats a drilldown section as CSV for export.
 */
export function formatDrilldownAsCSV(
  data: AttentionDrilldownData,
  focus: DrawerFocus
): string {
  const rows: string[][] = [];

  if (focus === 'recruiters') {
    rows.push(['Recruiter', 'Open Reqs', 'Utilization', 'Key Lag Metric', 'Severity', 'Suggested Intervention']);
    for (const r of data.recruiters) {
      rows.push([
        r.recruiterName,
        String(r.openReqCount),
        r.utilizationLabel || 'N/A',
        r.keyLagMetric,
        r.severity,
        r.suggestedIntervention,
      ]);
    }
  } else if (focus === 'hiringManagers') {
    rows.push(['Hiring Manager', 'Feedback Latency (d)', 'Decision Latency (d)', 'Overdue Items', 'Severity', 'Suggested Intervention']);
    for (const hm of data.hiringManagers) {
      rows.push([
        hm.hmName,
        hm.feedbackLatencyDays !== null ? String(hm.feedbackLatencyDays) : 'N/A',
        hm.decisionLatencyDays !== null ? String(hm.decisionLatencyDays) : 'N/A',
        String(hm.openItemCount),
        hm.severity,
        hm.suggestedIntervention,
      ]);
    }
  } else if (focus === 'reqClusters') {
    rows.push(['Cluster', 'Req Count', 'Avg Days Open', 'Pipeline Gap', 'Risk Label', 'Severity', 'Suggested Intervention']);
    for (const c of data.reqClusters) {
      rows.push([
        c.clusterLabel,
        String(c.reqCount),
        String(c.avgDaysOpen),
        c.pipelineGap !== null ? String(c.pipelineGap) : 'N/A',
        c.riskLabel,
        c.severity,
        c.suggestedIntervention,
      ]);
    }
  }

  return rows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n');
}

// ============================================
// INTERNAL HELPERS
// ============================================

function hasDrilldownDataForFocus(data: AttentionDrilldownData, focus: DrawerFocus): boolean {
  switch (focus) {
    case 'recruiters': return data.recruiters.length > 0;
    case 'hiringManagers': return data.hiringManagers.length > 0;
    case 'reqClusters': return data.reqClusters.length > 0;
    default: return false;
  }
}
