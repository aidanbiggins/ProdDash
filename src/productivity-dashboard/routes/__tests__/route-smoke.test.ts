// Route Smoke Tests - Verifies all routes are properly configured and map to valid tabs
// This test suite ensures every route in ROUTE_CONFIG has a corresponding tab implementation

import {
  ROUTE_CONFIG,
  LEGACY_REDIRECTS,
  BUCKET_DEFAULTS,
  getTabFromPath,
  getPathFromTab,
  getRedirectPath,
  TabType
} from '../routes';

// All tabs that should be renderable
const ALL_TABS: TabType[] = [
  'command-center',
  'control-tower',
  'ask',
  'overview',
  'recruiter',
  'hm-friction',
  'hiring-managers',
  'bottlenecks',
  'capacity',
  'capacity-rebalancer',
  'quality',
  'source-mix',
  'velocity',
  'forecasting',
  'scenarios',
  'data-health',
  'sla-settings',
  'ai-settings',
  'org-settings'
];

// All routes that should be accessible
const ALL_ROUTES = [
  '/',
  '/command-center',
  '/ops',
  '/ask',
  '/diagnose/overview',
  '/diagnose/recruiter',
  '/diagnose/hm-friction',
  '/diagnose/hiring-managers',
  '/diagnose/bottlenecks',
  '/diagnose/quality',
  '/diagnose/sources',
  '/diagnose/velocity',
  '/plan/capacity',
  '/plan/rebalancer',
  '/plan/forecast',
  '/plan/scenarios',
  '/settings/data-health',
  '/settings/sla',
  '/settings/ai',
  '/settings/org'
];

describe('Route Smoke Tests', () => {
  describe('Route Configuration Completeness', () => {
    it('should have a route for every expected path', () => {
      ALL_ROUTES.forEach(path => {
        const route = ROUTE_CONFIG.find(r => r.path === path);
        expect(route).toBeDefined();
        expect(route?.tab).toBeDefined();
        expect(route?.bucket).toBeDefined();
      });
    });

    it('should have every tab mapped to at least one route', () => {
      ALL_TABS.forEach(tab => {
        const route = ROUTE_CONFIG.find(r => r.tab === tab);
        expect(route).toBeDefined();
      });
    });

    it('should have unique paths (no duplicates)', () => {
      const paths = ROUTE_CONFIG.map(r => r.path);
      const uniquePaths = new Set(paths);
      expect(paths.length).toBe(uniquePaths.size);
    });
  });

  describe('Route Resolution', () => {
    it('should resolve all routes to valid tabs', () => {
      ALL_ROUTES.forEach(path => {
        const tab = getTabFromPath(path);
        expect(ALL_TABS).toContain(tab);
      });
    });

    it('should resolve legacy routes to new paths', () => {
      Object.entries(LEGACY_REDIRECTS).forEach(([legacy, newPath]) => {
        const tab = getTabFromPath(legacy);
        const newTab = getTabFromPath(newPath);
        expect(tab).toBe(newTab);
      });
    });

    it('should have redirects for bucket roots', () => {
      Object.entries(BUCKET_DEFAULTS).forEach(([bucket, defaultPath]) => {
        const redirect = getRedirectPath(bucket);
        expect(redirect).toBe(defaultPath);
      });
    });
  });

  describe('Route Bidirectionality', () => {
    it('should have consistent tab-to-path and path-to-tab mapping', () => {
      ALL_TABS.forEach(tab => {
        const path = getPathFromTab(tab);
        const resolvedTab = getTabFromPath(path);
        expect(resolvedTab).toBe(tab);
      });
    });
  });

  describe('Bucket Coverage', () => {
    it('should have at least one route per bucket', () => {
      const buckets = ['control-tower', 'diagnose', 'plan', 'settings'];
      buckets.forEach(bucket => {
        const routes = ROUTE_CONFIG.filter(r => r.bucket === bucket);
        expect(routes.length).toBeGreaterThan(0);
      });
    });

    it('should have Command Center at root and /command-center', () => {
      expect(getTabFromPath('/')).toBe('command-center');
      expect(getTabFromPath('/command-center')).toBe('command-center');
    });

    it('should have Control Tower at /ops', () => {
      expect(getTabFromPath('/ops')).toBe('control-tower');
    });

    it('should have all Diagnose routes in diagnose bucket', () => {
      const diagnoseRoutes = ROUTE_CONFIG.filter(r => r.bucket === 'diagnose');
      expect(diagnoseRoutes.length).toBe(8);
      diagnoseRoutes.forEach(r => {
        expect(r.path).toMatch(/^\/diagnose\//);
      });
    });

    it('should have all Plan routes in plan bucket', () => {
      const planRoutes = ROUTE_CONFIG.filter(r => r.bucket === 'plan');
      expect(planRoutes.length).toBe(4);
      planRoutes.forEach(r => {
        expect(r.path).toMatch(/^\/plan\//);
      });
    });

    it('should have all Settings routes in settings bucket', () => {
      const settingsRoutes = ROUTE_CONFIG.filter(r => r.bucket === 'settings');
      expect(settingsRoutes.length).toBe(4);
      settingsRoutes.forEach(r => {
        expect(r.path).toMatch(/^\/settings\//);
      });
    });
  });

  describe('Unknown Path Handling', () => {
    it('should default to command-center for unknown paths', () => {
      const unknownPaths = [
        '/unknown',
        '/foo/bar',
        '/diagnose/unknown',
        '/plan/unknown',
        '/settings/unknown'
      ];

      unknownPaths.forEach(path => {
        const tab = getTabFromPath(path);
        expect(tab).toBe('command-center');
      });
    });
  });

  describe('Nested Path Handling', () => {
    it('should handle nested recruiter paths', () => {
      expect(getTabFromPath('/diagnose/recruiter/user123')).toBe('recruiter');
      expect(getTabFromPath('/diagnose/recruiter/abc-def')).toBe('recruiter');
    });
  });

  describe('No Console Errors Simulation', () => {
    // This test simulates what a browser would do when loading routes
    // In a full E2E setup, this would use puppeteer/playwright
    it('should not have any route config that would cause errors', () => {
      // Verify no undefined values
      ROUTE_CONFIG.forEach(route => {
        expect(route.path).toBeTruthy();
        expect(route.tab).toBeTruthy();
        expect(route.bucket).toBeTruthy();
        expect(typeof route.path).toBe('string');
        expect(typeof route.tab).toBe('string');
        expect(typeof route.bucket).toBe('string');
      });

      // Verify no empty strings
      ROUTE_CONFIG.forEach(route => {
        expect(route.path.length).toBeGreaterThan(0);
        expect(route.tab.length).toBeGreaterThan(0);
        expect(route.bucket.length).toBeGreaterThan(0);
      });
    });
  });
});
