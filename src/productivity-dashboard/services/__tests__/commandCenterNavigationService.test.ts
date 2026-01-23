// Contract tests for Command Center Navigation Service
// Ensures: no dead clicks, every intent resolves, correct routing by diagnosis.

import {
  CommandCenterIntent,
  NavigationContext,
  Destination,
  NavigationHelpers,
  getCommandCenterDestination,
  performCommandCenterDestination,
} from '../commandCenterNavigationService';

const ALL_INTENTS: CommandCenterIntent[] = [
  'triage_actions',
  'details_actions',
  'explain_kpi',
  'kpi_details',
  'triage_risks',
  'risk_details',
  'changes_details',
  'model_scenarios',
  'scenario_details',
  'rebalance_capacity',
  'bottleneck_details',
];

const VALID_TAB_TYPES = [
  'command-center', 'control-tower', 'ask', 'overview', 'recruiter',
  'hm-friction', 'hiring-managers', 'bottlenecks', 'capacity',
  'capacity-rebalancer', 'quality', 'source-mix', 'velocity',
  'forecasting', 'scenarios', 'data-health', 'sla-settings',
  'ai-settings', 'org-settings',
];

describe('commandCenterNavigationService', () => {
  describe('getCommandCenterDestination', () => {
    const defaultContext: NavigationContext = {
      bottleneckDiagnosis: 'HEALTHY',
      hasAttentionDrilldown: true,
      hasOnTrackKPIs: true,
      hasRiskGroups: true,
      hasChanges: true,
      hasScenarios: true,
      defaultExplainKPI: 'median_ttf',
    };

    it('returns a Destination with kind and label for every intent', () => {
      for (const intent of ALL_INTENTS) {
        const dest = getCommandCenterDestination(intent, defaultContext);
        expect(dest.kind).toBeDefined();
        expect(['NAVIGATE', 'OPEN_DRAWER']).toContain(dest.kind);
        expect(dest.label).toBeDefined();
        expect(dest.label.length).toBeGreaterThan(0);
      }
    });

    it('NAVIGATE destinations reference a valid TabType', () => {
      for (const intent of ALL_INTENTS) {
        const dest = getCommandCenterDestination(intent, defaultContext);
        if (dest.kind === 'NAVIGATE') {
          expect(VALID_TAB_TYPES).toContain(dest.tab);
        }
      }
    });

    it('OPEN_DRAWER destinations specify drawerSystem', () => {
      for (const intent of ALL_INTENTS) {
        const dest = getCommandCenterDestination(intent, defaultContext);
        if (dest.kind === 'OPEN_DRAWER') {
          expect(['attention', 'explain']).toContain(dest.drawerSystem);
        }
      }
    });

    it('no intent returns NAVIGATE without a tab', () => {
      for (const intent of ALL_INTENTS) {
        const dest = getCommandCenterDestination(intent, defaultContext);
        if (dest.kind === 'NAVIGATE') {
          expect(dest.tab).toBeDefined();
          expect(dest.tab.length).toBeGreaterThan(0);
        }
      }
    });

    it('every destination has a reason string', () => {
      for (const intent of ALL_INTENTS) {
        const dest = getCommandCenterDestination(intent, defaultContext);
        expect(dest.reason).toBeDefined();
        expect(dest.reason.length).toBeGreaterThan(0);
      }
    });

    // ── Attention section ──
    describe('Attention intents', () => {
      it('triage_actions opens attention drawer', () => {
        const dest = getCommandCenterDestination('triage_actions', defaultContext);
        expect(dest.kind).toBe('OPEN_DRAWER');
        if (dest.kind === 'OPEN_DRAWER') {
          expect(dest.drawerSystem).toBe('attention');
        }
      });

      it('details_actions opens attention drawer', () => {
        const dest = getCommandCenterDestination('details_actions', defaultContext);
        expect(dest.kind).toBe('OPEN_DRAWER');
        if (dest.kind === 'OPEN_DRAWER') {
          expect(dest.drawerSystem).toBe('attention');
        }
      });
    });

    // ── On Track section ──
    describe('On Track intents', () => {
      it('explain_kpi opens explain drawer with provider', () => {
        const dest = getCommandCenterDestination('explain_kpi', defaultContext);
        expect(dest.kind).toBe('OPEN_DRAWER');
        if (dest.kind === 'OPEN_DRAWER') {
          expect(dest.drawerSystem).toBe('explain');
          expect(dest.explainProvider).toBe('median_ttf');
        }
      });

      it('explain_kpi uses defaultExplainKPI from context', () => {
        const ctx = { ...defaultContext, defaultExplainKPI: 'hm_latency' };
        const dest = getCommandCenterDestination('explain_kpi', ctx);
        if (dest.kind === 'OPEN_DRAWER') {
          expect(dest.explainProvider).toBe('hm_latency');
        }
      });

      it('explain_kpi defaults to median_ttf when no defaultExplainKPI', () => {
        const ctx = { ...defaultContext, defaultExplainKPI: undefined };
        const dest = getCommandCenterDestination('explain_kpi', ctx);
        if (dest.kind === 'OPEN_DRAWER') {
          expect(dest.explainProvider).toBe('median_ttf');
        }
      });

      it('kpi_details navigates to overview when KPIs present', () => {
        const dest = getCommandCenterDestination('kpi_details', defaultContext);
        expect(dest.kind).toBe('NAVIGATE');
        if (dest.kind === 'NAVIGATE') {
          expect(dest.tab).toBe('overview');
        }
      });

      it('kpi_details falls back to explain drawer when no KPIs', () => {
        const ctx = { ...defaultContext, hasOnTrackKPIs: false };
        const dest = getCommandCenterDestination('kpi_details', ctx);
        expect(dest.kind).toBe('OPEN_DRAWER');
        if (dest.kind === 'OPEN_DRAWER') {
          expect(dest.drawerSystem).toBe('explain');
        }
      });
    });

    // ── Risk section ──
    describe('Risk intents', () => {
      it('triage_risks navigates to data-health', () => {
        const dest = getCommandCenterDestination('triage_risks', defaultContext);
        expect(dest.kind).toBe('NAVIGATE');
        if (dest.kind === 'NAVIGATE') {
          expect(dest.tab).toBe('data-health');
        }
      });

      it('risk_details navigates to data-health', () => {
        const dest = getCommandCenterDestination('risk_details', defaultContext);
        expect(dest.kind).toBe('NAVIGATE');
        if (dest.kind === 'NAVIGATE') {
          expect(dest.tab).toBe('data-health');
        }
      });
    });

    // ── Changes section ──
    describe('Changes intents', () => {
      it('changes_details navigates to overview', () => {
        const dest = getCommandCenterDestination('changes_details', defaultContext);
        expect(dest.kind).toBe('NAVIGATE');
        if (dest.kind === 'NAVIGATE') {
          expect(dest.tab).toBe('overview');
        }
      });
    });

    // ── Scenarios section ──
    describe('Scenario intents', () => {
      it('model_scenarios navigates to scenarios tab', () => {
        const dest = getCommandCenterDestination('model_scenarios', defaultContext);
        expect(dest.kind).toBe('NAVIGATE');
        if (dest.kind === 'NAVIGATE') {
          expect(dest.tab).toBe('scenarios');
        }
      });

      it('scenario_details navigates to scenarios tab', () => {
        const dest = getCommandCenterDestination('scenario_details', defaultContext);
        expect(dest.kind).toBe('NAVIGATE');
        if (dest.kind === 'NAVIGATE') {
          expect(dest.tab).toBe('scenarios');
        }
      });
    });

    // ── Bottleneck section ──
    describe('Bottleneck intents', () => {
      it('rebalance_capacity routes to capacity-rebalancer when CAPACITY_BOUND', () => {
        const ctx = { ...defaultContext, bottleneckDiagnosis: 'CAPACITY_BOUND' as const };
        const dest = getCommandCenterDestination('rebalance_capacity', ctx);
        expect(dest.kind).toBe('NAVIGATE');
        if (dest.kind === 'NAVIGATE') {
          expect(dest.tab).toBe('capacity-rebalancer');
        }
      });

      it('rebalance_capacity routes to capacity-rebalancer when BOTH', () => {
        const ctx = { ...defaultContext, bottleneckDiagnosis: 'BOTH' as const };
        const dest = getCommandCenterDestination('rebalance_capacity', ctx);
        expect(dest.kind).toBe('NAVIGATE');
        if (dest.kind === 'NAVIGATE') {
          expect(dest.tab).toBe('capacity-rebalancer');
        }
      });

      it('rebalance_capacity routes to forecasting when PIPELINE_BOUND', () => {
        const ctx = { ...defaultContext, bottleneckDiagnosis: 'PIPELINE_BOUND' as const };
        const dest = getCommandCenterDestination('rebalance_capacity', ctx);
        expect(dest.kind).toBe('NAVIGATE');
        if (dest.kind === 'NAVIGATE') {
          expect(dest.tab).toBe('forecasting');
        }
      });

      it('rebalance_capacity routes to forecasting when HEALTHY', () => {
        const ctx = { ...defaultContext, bottleneckDiagnosis: 'HEALTHY' as const };
        const dest = getCommandCenterDestination('rebalance_capacity', ctx);
        expect(dest.kind).toBe('NAVIGATE');
        if (dest.kind === 'NAVIGATE') {
          expect(dest.tab).toBe('forecasting');
        }
      });

      it('rebalance_capacity never routes to unrelated tab for CAPACITY_BOUND', () => {
        const ctx = { ...defaultContext, bottleneckDiagnosis: 'CAPACITY_BOUND' as const };
        const dest = getCommandCenterDestination('rebalance_capacity', ctx);
        if (dest.kind === 'NAVIGATE') {
          expect(['capacity-rebalancer', 'capacity', 'forecasting']).toContain(dest.tab);
        }
      });

      it('bottleneck_details routes to capacity-rebalancer for CAPACITY_BOUND', () => {
        const ctx = { ...defaultContext, bottleneckDiagnosis: 'CAPACITY_BOUND' as const };
        const dest = getCommandCenterDestination('bottleneck_details', ctx);
        if (dest.kind === 'NAVIGATE') {
          expect(dest.tab).toBe('capacity-rebalancer');
        }
      });

      it('bottleneck_details routes to source-mix for PIPELINE_BOUND', () => {
        const ctx = { ...defaultContext, bottleneckDiagnosis: 'PIPELINE_BOUND' as const };
        const dest = getCommandCenterDestination('bottleneck_details', ctx);
        if (dest.kind === 'NAVIGATE') {
          expect(dest.tab).toBe('source-mix');
        }
      });

      it('bottleneck_details routes to overview for BOTH', () => {
        const ctx = { ...defaultContext, bottleneckDiagnosis: 'BOTH' as const };
        const dest = getCommandCenterDestination('bottleneck_details', ctx);
        if (dest.kind === 'NAVIGATE') {
          expect(dest.tab).toBe('overview');
        }
      });

      it('bottleneck_details routes to overview for HEALTHY', () => {
        const ctx = { ...defaultContext, bottleneckDiagnosis: 'HEALTHY' as const };
        const dest = getCommandCenterDestination('bottleneck_details', ctx);
        if (dest.kind === 'NAVIGATE') {
          expect(dest.tab).toBe('overview');
        }
      });
    });

    // ── Missing data fallbacks ──
    describe('missing data fallbacks', () => {
      it('attention intents always use drawer (no missing data issue)', () => {
        const ctx: NavigationContext = {};
        const dest = getCommandCenterDestination('triage_actions', ctx);
        expect(dest.kind).toBe('OPEN_DRAWER');
      });

      it('explain_kpi uses drawer even without context', () => {
        const ctx: NavigationContext = {};
        const dest = getCommandCenterDestination('explain_kpi', ctx);
        expect(dest.kind).toBe('OPEN_DRAWER');
        if (dest.kind === 'OPEN_DRAWER') {
          expect(dest.explainProvider).toBe('median_ttf');
        }
      });

      it('bottleneck with undefined diagnosis defaults to forecasting', () => {
        const ctx: NavigationContext = {};
        const dest = getCommandCenterDestination('rebalance_capacity', ctx);
        if (dest.kind === 'NAVIGATE') {
          expect(dest.tab).toBe('forecasting');
        }
      });
    });
  });

  describe('performCommandCenterDestination', () => {
    it('calls onNavigateToTab for NAVIGATE destinations', () => {
      const helpers: NavigationHelpers = {
        onNavigateToTab: jest.fn(),
        openAttentionDrilldown: jest.fn(),
        openExplainDrawer: jest.fn(),
      };
      const dest: Destination = {
        kind: 'NAVIGATE',
        label: 'Test',
        tab: 'overview',
        reason: 'test',
      };
      performCommandCenterDestination(dest, helpers);
      expect(helpers.onNavigateToTab).toHaveBeenCalledWith('overview');
      expect(helpers.openAttentionDrilldown).not.toHaveBeenCalled();
      expect(helpers.openExplainDrawer).not.toHaveBeenCalled();
    });

    it('calls openAttentionDrilldown for attention drawer destinations', () => {
      const helpers: NavigationHelpers = {
        onNavigateToTab: jest.fn(),
        openAttentionDrilldown: jest.fn(),
        openExplainDrawer: jest.fn(),
      };
      const dest: Destination = {
        kind: 'OPEN_DRAWER',
        label: 'Test',
        drawerSystem: 'attention',
        drawerFocus: undefined,
        reason: 'test',
      };
      performCommandCenterDestination(dest, helpers);
      expect(helpers.openAttentionDrilldown).toHaveBeenCalledWith(undefined);
      expect(helpers.onNavigateToTab).not.toHaveBeenCalled();
    });

    it('calls openExplainDrawer for explain drawer destinations', () => {
      const helpers: NavigationHelpers = {
        onNavigateToTab: jest.fn(),
        openAttentionDrilldown: jest.fn(),
        openExplainDrawer: jest.fn(),
      };
      const dest: Destination = {
        kind: 'OPEN_DRAWER',
        label: 'Test',
        drawerSystem: 'explain',
        explainProvider: 'hm_latency',
        reason: 'test',
      };
      performCommandCenterDestination(dest, helpers);
      expect(helpers.openExplainDrawer).toHaveBeenCalledWith('hm_latency');
      expect(helpers.onNavigateToTab).not.toHaveBeenCalled();
    });

    it('does not crash when helpers are undefined', () => {
      const helpers: NavigationHelpers = {};
      const dest: Destination = {
        kind: 'NAVIGATE',
        label: 'Test',
        tab: 'overview',
        reason: 'test',
      };
      expect(() => performCommandCenterDestination(dest, helpers)).not.toThrow();
    });
  });
});
