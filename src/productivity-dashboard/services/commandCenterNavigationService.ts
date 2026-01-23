// Command Center Navigation Service
// Centralizes all CTA routing logic for the Command Center.
// Every CTA resolves to either a NAVIGATE (tab) or OPEN_DRAWER (in-context).
// No dead clicks allowed.

import { TabType } from '../routes';
import { BottleneckDiagnosis } from '../types/commandCenterTypes';
import { DrawerFocus } from './attentionNavigationService';

// ═══════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════

export type CommandCenterIntent =
  | 'details_actions'
  | 'explain_kpi'
  | 'kpi_details'
  | 'triage_risks'
  | 'risk_details'
  | 'changes_details'
  | 'model_scenarios'
  | 'scenario_details'
  | 'rebalance_capacity'
  | 'bottleneck_details';

export type DrawerSystem = 'attention' | 'explain';

export interface NavigateDestination {
  kind: 'NAVIGATE';
  label: string;
  tab: TabType;
  reason: string;
}

export interface DrawerDestination {
  kind: 'OPEN_DRAWER';
  label: string;
  drawerSystem: DrawerSystem;
  drawerFocus?: DrawerFocus | string;
  explainProvider?: string;
  reason: string;
}

export type Destination = NavigateDestination | DrawerDestination;

export interface NavigationContext {
  bottleneckDiagnosis?: BottleneckDiagnosis;
  hasAttentionDrilldown?: boolean;
  hasOnTrackKPIs?: boolean;
  hasRiskGroups?: boolean;
  hasChanges?: boolean;
  hasScenarios?: boolean;
  defaultExplainKPI?: string;
}

export interface NavigationHelpers {
  onNavigateToTab?: (tab: TabType | string) => void;
  openAttentionDrilldown?: (focus?: DrawerFocus) => void;
  openExplainDrawer?: (providerId: string) => void;
}

// ═══════════════════════════════════════════
// DESTINATION RESOLVER
// ═══════════════════════════════════════════

export function getCommandCenterDestination(
  intent: CommandCenterIntent,
  context: NavigationContext
): Destination {
  switch (intent) {
    // ── Attention section ──
    case 'details_actions':
      return {
        kind: 'OPEN_DRAWER',
        label: 'View details',
        drawerSystem: 'attention',
        drawerFocus: undefined,
        reason: 'Opens attention drilldown for detailed review',
      };

    // ── On Track section ──
    case 'explain_kpi':
      return {
        kind: 'OPEN_DRAWER',
        label: 'Explain KPI',
        drawerSystem: 'explain',
        explainProvider: context.defaultExplainKPI || 'median_ttf',
        reason: `Opens Explain drawer for ${context.defaultExplainKPI || 'median_ttf'}`,
      };

    case 'kpi_details':
      if (context.hasOnTrackKPIs) {
        return {
          kind: 'NAVIGATE',
          label: 'KPI details',
          tab: 'overview',
          reason: 'Overview tab contains full KPI breakdown',
        };
      }
      return {
        kind: 'OPEN_DRAWER',
        label: 'KPI details',
        drawerSystem: 'explain',
        explainProvider: context.defaultExplainKPI || 'median_ttf',
        reason: 'Fallback to Explain drawer when overview not populated',
      };

    // ── Risk section ──
    case 'triage_risks':
      return {
        kind: 'NAVIGATE',
        label: 'Triage risks',
        tab: 'data-health',
        reason: 'Data Health provides risk triage (zombie reqs, stalled pipelines)',
      };

    case 'risk_details':
      return {
        kind: 'OPEN_DRAWER',
        label: 'Risk details',
        drawerSystem: 'explain',
        explainProvider: 'stalled_reqs',
        reason: 'Explain drawer shows why requisitions are at risk',
      };

    // ── Changes section ──
    case 'changes_details':
      return {
        kind: 'NAVIGATE',
        label: 'View changes',
        tab: 'overview',
        reason: 'Overview contains week-over-week metrics comparison',
      };

    // ── What-If / Scenarios section ──
    case 'model_scenarios':
      return {
        kind: 'NAVIGATE',
        label: 'Model scenarios',
        tab: 'scenarios',
        reason: 'Scenarios tab contains full scenario library',
      };

    case 'scenario_details':
      return {
        kind: 'NAVIGATE',
        label: 'Current forecast',
        tab: 'forecasting',
        reason: 'Forecasting tab shows current predictions before modeling changes',
      };

    // ── Bottleneck section ──
    case 'rebalance_capacity':
      return resolveBottleneckPrimary(context.bottleneckDiagnosis);

    case 'bottleneck_details':
      return resolveBottleneckDetails(context.bottleneckDiagnosis);
  }
}

function resolveBottleneckPrimary(diagnosis?: BottleneckDiagnosis): NavigateDestination {
  if (diagnosis === 'CAPACITY_BOUND') {
    return {
      kind: 'NAVIGATE',
      label: 'Rebalance capacity',
      tab: 'capacity-rebalancer',
      reason: 'Capacity-bound: direct to rebalancer for immediate action',
    };
  }
  if (diagnosis === 'BOTH') {
    return {
      kind: 'NAVIGATE',
      label: 'Rebalance capacity',
      tab: 'capacity-rebalancer',
      reason: 'Both bottlenecks: rebalancer addresses capacity side',
    };
  }
  // PIPELINE_BOUND or HEALTHY: forecasting is most actionable
  return {
    kind: 'NAVIGATE',
    label: 'View forecast',
    tab: 'forecasting',
    reason: `${diagnosis === 'PIPELINE_BOUND' ? 'Pipeline-bound' : 'Healthy'}: forecasting shows pipeline projections`,
  };
}

function resolveBottleneckDetails(diagnosis?: BottleneckDiagnosis): NavigateDestination {
  switch (diagnosis) {
    case 'CAPACITY_BOUND':
      return {
        kind: 'NAVIGATE',
        label: 'Capacity details',
        tab: 'capacity-rebalancer',
        reason: 'Capacity-bound evidence lives in rebalancer view',
      };
    case 'PIPELINE_BOUND':
      return {
        kind: 'NAVIGATE',
        label: 'Pipeline details',
        tab: 'source-mix',
        reason: 'Pipeline-bound evidence in source mix analysis',
      };
    case 'BOTH':
      return {
        kind: 'NAVIGATE',
        label: 'Overview',
        tab: 'overview',
        reason: 'Both bottlenecks: overview for holistic picture',
      };
    case 'HEALTHY':
    default:
      return {
        kind: 'NAVIGATE',
        label: 'Overview',
        tab: 'overview',
        reason: 'Healthy: overview for general monitoring',
      };
  }
}

// ═══════════════════════════════════════════
// DESTINATION EXECUTOR
// ═══════════════════════════════════════════

export function performCommandCenterDestination(
  destination: Destination,
  helpers: NavigationHelpers
): void {
  if (destination.kind === 'NAVIGATE') {
    helpers.onNavigateToTab?.(destination.tab);
    return;
  }

  // OPEN_DRAWER
  if (destination.drawerSystem === 'attention') {
    helpers.openAttentionDrilldown?.(destination.drawerFocus as DrawerFocus | undefined);
  } else if (destination.drawerSystem === 'explain') {
    const provider = (destination as DrawerDestination).explainProvider || 'median_ttf';
    helpers.openExplainDrawer?.(provider);
  }
}
