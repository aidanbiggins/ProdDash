// Tests for Attention Navigation Service
// Verifies that every bucket CTA routes to a meaningful destination.

import {
  getAttentionLink,
  navigateToAttentionEvidence,
  getAllBucketDestinations,
  formatDrilldownAsText,
  formatDrilldownAsCSV,
  AttentionLink,
  DrawerFocus,
  AttentionNavigationContext,
} from '../attentionNavigationService';
import { AttentionBucketId, AttentionDrilldownData } from '../../types/attentionTypes';
import { TabType } from '../../routes';

// ── Helpers ──────────────────────────────────

const ALL_BUCKET_IDS: AttentionBucketId[] = [
  'recruiter_throughput',
  'hm_friction',
  'pipeline_health',
  'aging_stalled',
  'offer_close_risk',
];

function makeEmptyDrilldown(): AttentionDrilldownData {
  return { recruiters: [], hiringManagers: [], reqClusters: [] };
}

function makeDrilldownWithData(): AttentionDrilldownData {
  return {
    recruiters: [
      {
        recruiterId: 'rec-1',
        recruiterName: 'Alice Smith',
        openReqCount: 14,
        utilizationLabel: '140% capacity (14 reqs)',
        keyLagMetric: '3 stalled reqs',
        suggestedIntervention: 'Rebalance: offload lowest-priority reqs',
        severity: 'blocking',
      },
    ],
    hiringManagers: [
      {
        hmId: 'hm-1',
        hmName: 'Bob Jones',
        feedbackLatencyDays: 6.5,
        decisionLatencyDays: 8.2,
        openItemCount: 3,
        suggestedIntervention: 'Escalate: multiple overdue decisions blocking pipeline',
        severity: 'blocking',
      },
    ],
    reqClusters: [
      {
        clusterLabel: 'Engineering',
        reqCount: 8,
        avgDaysOpen: 65,
        pipelineGap: 5,
        riskLabel: '2 zombie, 1 stalled',
        suggestedIntervention: 'Source additional candidates for thin-pipeline reqs',
        severity: 'at-risk',
      },
    ],
  };
}

function makeContext(drilldown?: AttentionDrilldownData): AttentionNavigationContext {
  return { drilldownData: drilldown || makeEmptyDrilldown() };
}

// ── Tests ──────────────────────────────────

describe('attentionNavigationService', () => {
  describe('getAttentionLink', () => {
    it('returns a non-empty destination for every bucket ID', () => {
      for (const id of ALL_BUCKET_IDS) {
        const link = getAttentionLink(id, makeContext());
        expect(link).toBeDefined();
        expect(link.type).toBeTruthy();
        expect(link.label).toBeTruthy();
        expect(link.label.length).toBeGreaterThan(0);
      }
    });

    it('returns route type for all standard buckets', () => {
      for (const id of ALL_BUCKET_IDS) {
        const link = getAttentionLink(id, makeContext());
        expect(link.type).toBe('route');
        expect(link.route).toBeDefined();
      }
    });

    it('maps recruiter_throughput to recruiter tab', () => {
      const link = getAttentionLink('recruiter_throughput', makeContext());
      expect(link.route).toBe('recruiter');
      expect(link.drawerFocus).toBe('recruiters');
    });

    it('maps hm_friction to hm-friction tab', () => {
      const link = getAttentionLink('hm_friction', makeContext());
      expect(link.route).toBe('hm-friction');
      expect(link.drawerFocus).toBe('hiringManagers');
    });

    it('maps pipeline_health to overview tab', () => {
      const link = getAttentionLink('pipeline_health', makeContext());
      expect(link.route).toBe('overview');
      expect(link.drawerFocus).toBe('reqClusters');
    });

    it('maps aging_stalled to overview tab', () => {
      const link = getAttentionLink('aging_stalled', makeContext());
      expect(link.route).toBe('overview');
      expect(link.drawerFocus).toBe('reqClusters');
    });

    it('maps offer_close_risk to quality tab', () => {
      const link = getAttentionLink('offer_close_risk', makeContext());
      expect(link.route).toBe('quality');
      expect(link.drawerFocus).toBe('reqClusters');
    });

    it('includes drawerFocus for all buckets as secondary option', () => {
      for (const id of ALL_BUCKET_IDS) {
        const link = getAttentionLink(id, makeContext());
        expect(link.drawerFocus).toBeDefined();
        expect(['recruiters', 'hiringManagers', 'reqClusters']).toContain(link.drawerFocus);
      }
    });
  });

  describe('getAllBucketDestinations', () => {
    it('returns entries for all 5 bucket IDs', () => {
      const destinations = getAllBucketDestinations();
      expect(Object.keys(destinations)).toHaveLength(5);
      for (const id of ALL_BUCKET_IDS) {
        expect(destinations[id]).toBeDefined();
        expect(destinations[id].label).toBeTruthy();
      }
    });

    it('no destination has empty route', () => {
      const destinations = getAllBucketDestinations();
      for (const id of ALL_BUCKET_IDS) {
        const dest = destinations[id];
        expect(dest.route).toBeDefined();
        expect(dest.route!.length).toBeGreaterThan(0);
      }
    });
  });

  describe('navigateToAttentionEvidence', () => {
    it('calls navigateToTab for route-type links', () => {
      const navigateToTab = jest.fn();
      const openDrawerWithFocus = jest.fn();

      navigateToAttentionEvidence(
        'recruiter_throughput',
        makeContext(),
        { navigateToTab, openDrawerWithFocus }
      );

      expect(navigateToTab).toHaveBeenCalledWith('recruiter');
      expect(openDrawerWithFocus).not.toHaveBeenCalled();
    });

    it('routes each bucket to a valid TabType', () => {
      const validTabs: TabType[] = [
        'command-center', 'control-tower', 'ask', 'overview', 'recruiter',
        'hm-friction', 'hiring-managers', 'bottlenecks', 'capacity',
        'capacity-rebalancer', 'quality', 'source-mix', 'velocity',
        'forecasting', 'scenarios', 'data-health', 'sla-settings',
        'ai-settings', 'org-settings',
      ];

      for (const id of ALL_BUCKET_IDS) {
        const navigateToTab = jest.fn();
        navigateToAttentionEvidence(
          id,
          makeContext(),
          { navigateToTab, openDrawerWithFocus: jest.fn() }
        );
        expect(navigateToTab).toHaveBeenCalledTimes(1);
        const calledWith = navigateToTab.mock.calls[0][0];
        expect(validTabs).toContain(calledWith);
      }
    });

    it('every bucket CTA triggers a non-no-op action', () => {
      for (const id of ALL_BUCKET_IDS) {
        const navigateToTab = jest.fn();
        const openDrawerWithFocus = jest.fn();

        navigateToAttentionEvidence(
          id,
          makeContext(),
          { navigateToTab, openDrawerWithFocus }
        );

        // At least one handler must have been called — no dead clicks
        const totalCalls = navigateToTab.mock.calls.length + openDrawerWithFocus.mock.calls.length;
        expect(totalCalls).toBeGreaterThan(0);
      }
    });
  });

  describe('formatDrilldownAsText', () => {
    it('formats recruiters as readable text', () => {
      const data = makeDrilldownWithData();
      const text = formatDrilldownAsText(data, 'recruiters');

      expect(text).toContain('Top Recruiters to Intervene');
      expect(text).toContain('Alice Smith');
      expect(text).toContain('14 reqs');
      expect(text).toContain('3 stalled reqs');
      expect(text).toContain('Rebalance');
    });

    it('formats HMs as readable text', () => {
      const data = makeDrilldownWithData();
      const text = formatDrilldownAsText(data, 'hiringManagers');

      expect(text).toContain('Top HMs to Escalate');
      expect(text).toContain('Bob Jones');
      expect(text).toContain('Feedback: 6.5d');
      expect(text).toContain('Escalate');
    });

    it('formats req clusters as readable text', () => {
      const data = makeDrilldownWithData();
      const text = formatDrilldownAsText(data, 'reqClusters');

      expect(text).toContain('At-Risk Req Clusters');
      expect(text).toContain('Engineering');
      expect(text).toContain('8 reqs');
      expect(text).toContain('65d open');
    });

    it('returns empty string for empty data', () => {
      const data = makeEmptyDrilldown();
      expect(formatDrilldownAsText(data, 'recruiters')).toBe('Top Recruiters to Intervene\n' + '─'.repeat(40));
    });
  });

  describe('formatDrilldownAsCSV', () => {
    it('produces valid CSV for recruiters', () => {
      const data = makeDrilldownWithData();
      const csv = formatDrilldownAsCSV(data, 'recruiters');
      const lines = csv.split('\n');

      // Header row
      expect(lines[0]).toContain('Recruiter');
      expect(lines[0]).toContain('Open Reqs');
      expect(lines[0]).toContain('Key Lag Metric');
      expect(lines[0]).toContain('Suggested Intervention');

      // Data row
      expect(lines[1]).toContain('Alice Smith');
      expect(lines[1]).toContain('14');
    });

    it('produces valid CSV for HMs', () => {
      const data = makeDrilldownWithData();
      const csv = formatDrilldownAsCSV(data, 'hiringManagers');
      const lines = csv.split('\n');

      expect(lines[0]).toContain('Hiring Manager');
      expect(lines[0]).toContain('Feedback Latency');
      expect(lines[1]).toContain('Bob Jones');
    });

    it('produces valid CSV for req clusters', () => {
      const data = makeDrilldownWithData();
      const csv = formatDrilldownAsCSV(data, 'reqClusters');
      const lines = csv.split('\n');

      expect(lines[0]).toContain('Cluster');
      expect(lines[0]).toContain('Avg Days Open');
      expect(lines[1]).toContain('Engineering');
    });

    it('escapes double quotes in CSV', () => {
      const data: AttentionDrilldownData = {
        recruiters: [{
          recruiterId: 'r1',
          recruiterName: 'Quote "Test" User',
          openReqCount: 5,
          utilizationLabel: null,
          keyLagMetric: 'test',
          suggestedIntervention: 'fix "stuff"',
          severity: 'watch',
        }],
        hiringManagers: [],
        reqClusters: [],
      };
      const csv = formatDrilldownAsCSV(data, 'recruiters');
      expect(csv).toContain('""Test""');
      expect(csv).toContain('""stuff""');
    });
  });

  describe('CTA labels match destinations', () => {
    it('recruiter_throughput label mentions recruiters', () => {
      const link = getAttentionLink('recruiter_throughput', makeContext());
      expect(link.label.toLowerCase()).toContain('recruiter');
    });

    it('hm_friction label mentions HMs', () => {
      const link = getAttentionLink('hm_friction', makeContext());
      expect(link.label.toLowerCase()).toContain('hm');
    });

    it('pipeline_health label mentions pipeline', () => {
      const link = getAttentionLink('pipeline_health', makeContext());
      expect(link.label.toLowerCase()).toContain('pipeline');
    });

    it('aging_stalled label mentions stalled', () => {
      const link = getAttentionLink('aging_stalled', makeContext());
      expect(link.label.toLowerCase()).toContain('stalled');
    });

    it('offer_close_risk label mentions offers', () => {
      const link = getAttentionLink('offer_close_risk', makeContext());
      expect(link.label.toLowerCase()).toContain('offer');
    });
  });
});
