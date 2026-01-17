// Navigation Structure Definition
// Defines the 4-bucket navigation hierarchy

export interface NavItem {
  id: string;
  label: string;
  route: string;
  icon?: string;
}

export interface NavBucket {
  label: string;
  icon: string;
  route: string;
  submenu: NavItem[] | null;
}

export interface NavStructure {
  [key: string]: NavBucket;
}

export const NAV_STRUCTURE: NavStructure = {
  'control-tower': {
    label: 'Command Center',
    icon: 'bi-bullseye',
    route: '/',
    submenu: null
  },
  'ask': {
    label: 'Ask ProdDash',
    icon: 'bi-chat-dots',
    route: '/ask',
    submenu: null
  },
  'diagnose': {
    label: 'Diagnose',
    icon: 'bi-search',
    route: '/diagnose',
    submenu: [
      { id: 'overview', label: 'Overview', route: '/diagnose/overview' },
      { id: 'recruiter', label: 'Recruiter Performance', route: '/diagnose/recruiter' },
      { id: 'hm-friction', label: 'HM Latency', route: '/diagnose/hm-friction' },
      { id: 'hiring-managers', label: 'HM Scorecard', route: '/diagnose/hiring-managers' },
      { id: 'bottlenecks', label: 'Bottlenecks & SLAs', route: '/diagnose/bottlenecks' },
      { id: 'quality', label: 'Quality Guardrails', route: '/diagnose/quality' },
      { id: 'sources', label: 'Source Effectiveness', route: '/diagnose/sources' },
      { id: 'velocity', label: 'Pipeline Velocity', route: '/diagnose/velocity' }
    ]
  },
  'plan': {
    label: 'Plan',
    icon: 'bi-calendar3',
    route: '/plan',
    submenu: [
      { id: 'capacity', label: 'Capacity Planning', route: '/plan/capacity' },
      { id: 'forecast', label: 'Hiring Forecast', route: '/plan/forecast' },
      { id: 'scenarios', label: 'What-If Scenarios', route: '/plan/scenarios' }
    ]
  },
  'settings': {
    label: 'Settings',
    icon: 'bi-gear',
    route: '/settings',
    submenu: [
      { id: 'data-health', label: 'Data Health', route: '/settings/data-health' },
      { id: 'sla', label: 'SLA Configuration', route: '/settings/sla' },
      { id: 'ai', label: 'AI Configuration', route: '/settings/ai' },
      { id: 'org', label: 'Organization', route: '/settings/org' }
    ]
  }
};

// Get all navigation items flattened for QuickFind
export function getAllNavItems(): NavItem[] {
  const items: NavItem[] = [];

  Object.entries(NAV_STRUCTURE).forEach(([key, bucket]) => {
    if (bucket.submenu) {
      bucket.submenu.forEach(item => {
        items.push({
          ...item,
          icon: bucket.icon
        });
      });
    } else {
      items.push({
        id: key,
        label: bucket.label,
        route: bucket.route,
        icon: bucket.icon
      });
    }
  });

  return items;
}

// Determine which bucket is active based on current path
export function getActiveBucket(pathname: string): string | null {
  if (pathname === '/' || pathname === '/control-tower') {
    return 'control-tower';
  }
  if (pathname === '/ask' || pathname.startsWith('/ask/')) {
    return 'ask';
  }
  if (pathname.startsWith('/diagnose')) {
    return 'diagnose';
  }
  if (pathname.startsWith('/plan')) {
    return 'plan';
  }
  if (pathname.startsWith('/settings')) {
    return 'settings';
  }

  // Legacy route mapping
  const legacyMapping: Record<string, string> = {
    '/overview': 'diagnose',
    '/recruiter': 'diagnose',
    '/hm-friction': 'diagnose',
    '/hiring-managers': 'diagnose',
    '/quality': 'diagnose',
    '/source-mix': 'diagnose',
    '/velocity': 'diagnose',
    '/capacity': 'plan',
    '/forecasting': 'plan',
    '/data-health': 'settings'
  };

  return legacyMapping[pathname] || null;
}

// Determine which submenu item is active
export function getActiveItem(pathname: string): string | null {
  // Direct path matching
  const pathMappings: Record<string, string> = {
    '/diagnose/overview': 'overview',
    '/diagnose/recruiter': 'recruiter',
    '/diagnose/hm-friction': 'hm-friction',
    '/diagnose/hiring-managers': 'hiring-managers',
    '/diagnose/bottlenecks': 'bottlenecks',
    '/diagnose/quality': 'quality',
    '/diagnose/sources': 'sources',
    '/diagnose/velocity': 'velocity',
    '/plan/capacity': 'capacity',
    '/plan/forecast': 'forecast',
    '/plan/scenarios': 'scenarios',
    '/settings/data-health': 'data-health',
    '/settings/sla': 'sla',
    '/settings/ai': 'ai',
    '/settings/org': 'org',
    // Legacy mappings
    '/overview': 'overview',
    '/recruiter': 'recruiter',
    '/hm-friction': 'hm-friction',
    '/hiring-managers': 'hiring-managers',
    '/quality': 'quality',
    '/source-mix': 'sources',
    '/velocity': 'velocity',
    '/capacity': 'capacity',
    '/forecasting': 'forecast',
    '/data-health': 'data-health'
  };

  // Check for exact match first
  if (pathMappings[pathname]) {
    return pathMappings[pathname];
  }

  // Check for path prefix (e.g., /diagnose/recruiter/123)
  for (const [path, item] of Object.entries(pathMappings)) {
    if (pathname.startsWith(path + '/')) {
      return item;
    }
  }

  return null;
}
