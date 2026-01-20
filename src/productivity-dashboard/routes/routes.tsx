// Route Definitions for the new IA structure
// This module maps URL paths to internal tab IDs used by ProductivityDashboard
import React from 'react';

// Tab type definition (matches ProductivityDashboard)
export type TabType = 'control-tower' | 'ask' | 'overview' | 'recruiter' | 'hm-friction' | 'hiring-managers' | 'bottlenecks' | 'capacity' | 'capacity-rebalancer' | 'quality' | 'source-mix' | 'velocity' | 'forecasting' | 'scenarios' | 'data-health' | 'sla-settings' | 'ai-settings' | 'org-settings';

// Route to tab mapping
export interface RouteConfig {
  path: string;
  tab: TabType;
  bucket: 'control-tower' | 'diagnose' | 'plan' | 'settings';
}

// New route structure mapped to existing tab IDs
export const ROUTE_CONFIG: RouteConfig[] = [
  // Control Tower (default)
  { path: '/', tab: 'control-tower', bucket: 'control-tower' },
  { path: '/control-tower', tab: 'control-tower', bucket: 'control-tower' },

  // Ask ProdDash (top-level)
  { path: '/ask', tab: 'ask', bucket: 'control-tower' },

  // Diagnose bucket
  { path: '/diagnose/overview', tab: 'overview', bucket: 'diagnose' },
  { path: '/diagnose/recruiter', tab: 'recruiter', bucket: 'diagnose' },
  { path: '/diagnose/hm-friction', tab: 'hm-friction', bucket: 'diagnose' },
  { path: '/diagnose/hiring-managers', tab: 'hiring-managers', bucket: 'diagnose' },
  { path: '/diagnose/bottlenecks', tab: 'bottlenecks', bucket: 'diagnose' },
  { path: '/diagnose/quality', tab: 'quality', bucket: 'diagnose' },
  { path: '/diagnose/sources', tab: 'source-mix', bucket: 'diagnose' },
  { path: '/diagnose/velocity', tab: 'velocity', bucket: 'diagnose' },

  // Plan bucket
  { path: '/plan/capacity', tab: 'capacity', bucket: 'plan' },
  { path: '/plan/rebalancer', tab: 'capacity-rebalancer', bucket: 'plan' },
  { path: '/plan/forecast', tab: 'forecasting', bucket: 'plan' },
  { path: '/plan/scenarios', tab: 'scenarios', bucket: 'plan' },

  // Settings bucket
  { path: '/settings/data-health', tab: 'data-health', bucket: 'settings' },
  { path: '/settings/sla', tab: 'sla-settings', bucket: 'settings' },
  { path: '/settings/ai', tab: 'ai-settings', bucket: 'settings' },
  { path: '/settings/org', tab: 'org-settings', bucket: 'settings' },
];

// Legacy routes that redirect to new paths
export const LEGACY_REDIRECTS: Record<string, string> = {
  '/overview': '/diagnose/overview',
  '/recruiter': '/diagnose/recruiter',
  '/hm-friction': '/diagnose/hm-friction',
  '/hiring-managers': '/diagnose/hiring-managers',
  '/quality': '/diagnose/quality',
  '/source-mix': '/diagnose/sources',
  '/velocity': '/diagnose/velocity',
  '/capacity': '/plan/capacity',
  '/forecasting': '/plan/forecast',
  '/data-health': '/settings/data-health',
};

// Bucket default routes
export const BUCKET_DEFAULTS: Record<string, string> = {
  '/diagnose': '/diagnose/overview',
  '/plan': '/plan/capacity',
  '/settings': '/settings/data-health',
};

// Get tab from URL path
export function getTabFromPath(pathname: string): TabType {
  // Check for exact match first
  const route = ROUTE_CONFIG.find(r => r.path === pathname);
  if (route) return route.tab;

  // Check for path prefix matches (e.g., /diagnose/recruiter/123)
  for (const r of ROUTE_CONFIG) {
    if (pathname.startsWith(r.path + '/')) {
      return r.tab;
    }
  }

  // Check legacy routes
  const legacyRedirect = LEGACY_REDIRECTS[pathname];
  if (legacyRedirect) {
    return getTabFromPath(legacyRedirect);
  }

  // Default to control tower
  return 'control-tower';
}

// Get new path from tab ID (for URL updates)
export function getPathFromTab(tab: TabType): string {
  const route = ROUTE_CONFIG.find(r => r.tab === tab);
  return route?.path || '/';
}

// Check if a path should redirect
export function getRedirectPath(pathname: string): string | null {
  // Check legacy redirects
  if (LEGACY_REDIRECTS[pathname]) {
    return LEGACY_REDIRECTS[pathname];
  }

  // Check bucket defaults
  if (BUCKET_DEFAULTS[pathname]) {
    return BUCKET_DEFAULTS[pathname];
  }

  return null;
}

// Parse URL and extract tab + params
export function parseUrl(pathname: string, search: string): { tab: TabType; recruiterId?: string } {
  const tab = getTabFromPath(pathname);
  const result: { tab: TabType; recruiterId?: string } = { tab };

  // Extract recruiter ID from path or query params
  const recruiterMatch = pathname.match(/\/diagnose\/recruiter\/([^/]+)/);
  if (recruiterMatch) {
    result.recruiterId = recruiterMatch[1];
  } else {
    const params = new URLSearchParams(search);
    const idParam = params.get('id');
    if (idParam && tab === 'recruiter') {
      result.recruiterId = idParam;
    }
  }

  return result;
}

export default ROUTE_CONFIG;
