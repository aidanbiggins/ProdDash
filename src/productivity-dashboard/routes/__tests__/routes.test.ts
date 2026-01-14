// Route Tests - Verifies URL-to-tab mapping and legacy redirects
import {
  ROUTE_CONFIG,
  LEGACY_REDIRECTS,
  BUCKET_DEFAULTS,
  getTabFromPath,
  getPathFromTab,
  getRedirectPath,
  parseUrl
} from '../routes';

describe('Route Configuration', () => {
  describe('ROUTE_CONFIG', () => {
    it('should have a route for the root path', () => {
      const rootRoute = ROUTE_CONFIG.find(r => r.path === '/');
      expect(rootRoute).toBeDefined();
      expect(rootRoute?.tab).toBe('control-tower');
    });

    it('should have all expected diagnose routes', () => {
      const diagnoseRoutes = ROUTE_CONFIG.filter(r => r.bucket === 'diagnose');
      expect(diagnoseRoutes.length).toBeGreaterThanOrEqual(7);

      // Check specific routes exist
      const expectedPaths = [
        '/diagnose/overview',
        '/diagnose/recruiter',
        '/diagnose/hm-friction',
        '/diagnose/hiring-managers',
        '/diagnose/quality',
        '/diagnose/sources',
        '/diagnose/velocity'
      ];

      expectedPaths.forEach(path => {
        const route = ROUTE_CONFIG.find(r => r.path === path);
        expect(route).toBeDefined();
        expect(route?.bucket).toBe('diagnose');
      });
    });

    it('should have all expected plan routes', () => {
      const planRoutes = ROUTE_CONFIG.filter(r => r.bucket === 'plan');
      expect(planRoutes.length).toBeGreaterThanOrEqual(2);

      const capacityRoute = ROUTE_CONFIG.find(r => r.path === '/plan/capacity');
      expect(capacityRoute).toBeDefined();
      expect(capacityRoute?.tab).toBe('capacity');

      const forecastRoute = ROUTE_CONFIG.find(r => r.path === '/plan/forecast');
      expect(forecastRoute).toBeDefined();
      expect(forecastRoute?.tab).toBe('forecasting');
    });

    it('should have settings routes', () => {
      const settingsRoutes = ROUTE_CONFIG.filter(r => r.bucket === 'settings');
      expect(settingsRoutes.length).toBeGreaterThanOrEqual(3);

      const dataHealthRoute = ROUTE_CONFIG.find(r => r.path === '/settings/data-health');
      expect(dataHealthRoute).toBeDefined();
      expect(dataHealthRoute?.tab).toBe('data-health');

      const aiRoute = ROUTE_CONFIG.find(r => r.path === '/settings/ai');
      expect(aiRoute).toBeDefined();
      expect(aiRoute?.tab).toBe('ai-settings');

      const orgRoute = ROUTE_CONFIG.find(r => r.path === '/settings/org');
      expect(orgRoute).toBeDefined();
      expect(orgRoute?.tab).toBe('org-settings');
    });
  });

  describe('LEGACY_REDIRECTS', () => {
    it('should redirect old top-level paths to new bucket paths', () => {
      expect(LEGACY_REDIRECTS['/overview']).toBe('/diagnose/overview');
      expect(LEGACY_REDIRECTS['/recruiter']).toBe('/diagnose/recruiter');
      expect(LEGACY_REDIRECTS['/hm-friction']).toBe('/diagnose/hm-friction');
      expect(LEGACY_REDIRECTS['/capacity']).toBe('/plan/capacity');
      expect(LEGACY_REDIRECTS['/forecasting']).toBe('/plan/forecast');
      expect(LEGACY_REDIRECTS['/data-health']).toBe('/settings/data-health');
    });
  });

  describe('BUCKET_DEFAULTS', () => {
    it('should have default routes for each bucket', () => {
      expect(BUCKET_DEFAULTS['/diagnose']).toBe('/diagnose/overview');
      expect(BUCKET_DEFAULTS['/plan']).toBe('/plan/capacity');
      expect(BUCKET_DEFAULTS['/settings']).toBe('/settings/data-health');
    });
  });
});

describe('getTabFromPath', () => {
  it('should return control-tower for root path', () => {
    expect(getTabFromPath('/')).toBe('control-tower');
  });

  it('should return correct tab for new bucket paths', () => {
    expect(getTabFromPath('/diagnose/overview')).toBe('overview');
    expect(getTabFromPath('/diagnose/recruiter')).toBe('recruiter');
    expect(getTabFromPath('/diagnose/hm-friction')).toBe('hm-friction');
    expect(getTabFromPath('/diagnose/hiring-managers')).toBe('hiring-managers');
    expect(getTabFromPath('/diagnose/quality')).toBe('quality');
    expect(getTabFromPath('/diagnose/sources')).toBe('source-mix');
    expect(getTabFromPath('/diagnose/velocity')).toBe('velocity');
    expect(getTabFromPath('/plan/capacity')).toBe('capacity');
    expect(getTabFromPath('/plan/forecast')).toBe('forecasting');
    expect(getTabFromPath('/settings/data-health')).toBe('data-health');
  });

  it('should handle legacy paths by following redirects', () => {
    expect(getTabFromPath('/overview')).toBe('overview');
    expect(getTabFromPath('/recruiter')).toBe('recruiter');
    expect(getTabFromPath('/capacity')).toBe('capacity');
    expect(getTabFromPath('/forecasting')).toBe('forecasting');
    expect(getTabFromPath('/data-health')).toBe('data-health');
  });

  it('should handle nested recruiter paths', () => {
    expect(getTabFromPath('/diagnose/recruiter/user123')).toBe('recruiter');
    expect(getTabFromPath('/diagnose/recruiter/abc-def-ghi')).toBe('recruiter');
  });

  it('should return control-tower for unknown paths', () => {
    expect(getTabFromPath('/unknown')).toBe('control-tower');
    expect(getTabFromPath('/foo/bar/baz')).toBe('control-tower');
  });
});

describe('getPathFromTab', () => {
  it('should return correct path for each tab', () => {
    expect(getPathFromTab('control-tower')).toBe('/');
    expect(getPathFromTab('overview')).toBe('/diagnose/overview');
    expect(getPathFromTab('recruiter')).toBe('/diagnose/recruiter');
    expect(getPathFromTab('hm-friction')).toBe('/diagnose/hm-friction');
    expect(getPathFromTab('hiring-managers')).toBe('/diagnose/hiring-managers');
    expect(getPathFromTab('quality')).toBe('/diagnose/quality');
    expect(getPathFromTab('source-mix')).toBe('/diagnose/sources');
    expect(getPathFromTab('velocity')).toBe('/diagnose/velocity');
    expect(getPathFromTab('capacity')).toBe('/plan/capacity');
    expect(getPathFromTab('forecasting')).toBe('/plan/forecast');
    expect(getPathFromTab('data-health')).toBe('/settings/data-health');
  });

  it('should return root for unknown tab', () => {
    // Cast to any to test unknown tab handling
    expect(getPathFromTab('unknown-tab' as any)).toBe('/');
  });
});

describe('getRedirectPath', () => {
  it('should return redirect path for legacy routes', () => {
    expect(getRedirectPath('/overview')).toBe('/diagnose/overview');
    expect(getRedirectPath('/recruiter')).toBe('/diagnose/recruiter');
    expect(getRedirectPath('/capacity')).toBe('/plan/capacity');
  });

  it('should return redirect path for bucket roots', () => {
    expect(getRedirectPath('/diagnose')).toBe('/diagnose/overview');
    expect(getRedirectPath('/plan')).toBe('/plan/capacity');
    expect(getRedirectPath('/settings')).toBe('/settings/data-health');
  });

  it('should return null for paths that do not need redirect', () => {
    expect(getRedirectPath('/')).toBeNull();
    expect(getRedirectPath('/diagnose/overview')).toBeNull();
    expect(getRedirectPath('/plan/capacity')).toBeNull();
    expect(getRedirectPath('/unknown')).toBeNull();
  });
});

describe('parseUrl', () => {
  it('should extract tab from path', () => {
    expect(parseUrl('/diagnose/overview', '').tab).toBe('overview');
    expect(parseUrl('/plan/forecast', '').tab).toBe('forecasting');
    expect(parseUrl('/', '').tab).toBe('control-tower');
  });

  it('should extract recruiter ID from path', () => {
    const result = parseUrl('/diagnose/recruiter/user123', '');
    expect(result.tab).toBe('recruiter');
    expect(result.recruiterId).toBe('user123');
  });

  it('should extract recruiter ID from query params', () => {
    const result = parseUrl('/diagnose/recruiter', '?id=user456');
    expect(result.tab).toBe('recruiter');
    expect(result.recruiterId).toBe('user456');
  });

  it('should not extract recruiter ID for non-recruiter tabs', () => {
    const result = parseUrl('/diagnose/overview', '?id=user789');
    expect(result.tab).toBe('overview');
    expect(result.recruiterId).toBeUndefined();
  });
});

describe('Route bidirectionality', () => {
  it('should have consistent tab-to-path and path-to-tab mapping', () => {
    const tabs = [
      'control-tower', 'overview', 'recruiter', 'hm-friction',
      'hiring-managers', 'quality', 'source-mix', 'velocity',
      'capacity', 'forecasting', 'data-health'
    ] as const;

    tabs.forEach(tab => {
      const path = getPathFromTab(tab);
      const resultTab = getTabFromPath(path);
      expect(resultTab).toBe(tab);
    });
  });
});
