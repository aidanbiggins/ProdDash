'use client';

import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AppSidebar, TabId } from './AppSidebar';
import { CommandCenterV2 } from './CommandCenterV2';
import { DiagnoseTabV2 } from './DiagnoseTabV2';
import { PlanTabV2 } from './PlanTabV2';
import { SettingsTabV2 } from './SettingsTabV2';
import { AskPlatoVueV2 } from './AskPlatoVueV2';
import { FilterBar } from '../common/FilterBar';
import { CSVUpload } from '../CSVUpload';
import { useDashboard } from '../../hooks/useDashboardContext';
import { useAuth } from '../../../contexts/AuthContext';
import { useTheme } from '../../../contexts/ThemeContext';
import { getPathFromTab, getRedirectPath, parseUrl, type TabType } from '../../routes';
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from '../../../components/ui/sidebar';
import { Separator } from '../../../components/ui/separator';
import { Moon, Sun, Sparkles, Zap } from 'lucide-react';

// AI Status Indicator - shows when AI is enabled with a glowing effect
function AiStatusIndicator({
  isEnabled,
  provider,
  onClick
}: {
  isEnabled: boolean;
  provider?: string;
  onClick: () => void;
}) {
  if (!isEnabled) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        title="Configure AI to unlock advanced features"
      >
        <Sparkles className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">AI Off</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-gradient-to-r from-primary/20 to-accent/20 text-primary border border-primary/30 hover:border-primary/50 transition-all"
      title={`AI powered by ${provider || 'configured provider'}`}
    >
      {/* Glow effect */}
      <span className="absolute inset-0 rounded-md bg-primary/10 blur-sm group-hover:bg-primary/20 transition-colors" />

      {/* Pulse ring */}
      <span className="absolute inset-0 rounded-md animate-pulse bg-primary/5" />

      {/* Content */}
      <span className="relative flex items-center gap-1.5">
        <Zap className="w-3.5 h-3.5 text-primary" />
        <span className="hidden sm:inline">AI On</span>
        {provider && (
          <span className="hidden md:inline text-primary/70 font-normal">
            · {provider}
          </span>
        )}
      </span>
    </button>
  );
}
import type { DiagnoseSubView } from './DiagnoseTabV2';
import type { PlanSubView } from './PlanTabV2';
import type { SettingsSubView } from './SettingsTabV2';

interface AppLayoutV2Props {
  defaultTab?: TabId;
}

function normalizePathname(pathname: string): string {
  const stripped = pathname.replace(/\/+$/, '');
  return stripped === '' ? '/' : stripped;
}

function tabTypeToTopLevel(tab: TabType): TabId {
  // Legacy naming: Control Tower is now Command Center in V2.
  if (tab === 'command-center' || tab === 'control-tower') return 'command-center';
  if (tab === 'ask') return 'ask-platovue';

  if (
    tab === 'overview' ||
    tab === 'recruiter' ||
    tab === 'hm-friction' ||
    tab === 'hiring-managers' ||
    tab === 'bottlenecks' ||
    tab === 'quality' ||
    tab === 'source-mix' ||
    tab === 'velocity'
  ) {
    return 'diagnose';
  }

  if (
    tab === 'capacity' ||
    tab === 'capacity-rebalancer' ||
    tab === 'forecasting' ||
    tab === 'scenarios'
  ) {
    return 'plan';
  }

  if (
    tab === 'data-health' ||
    tab === 'sla-settings' ||
    tab === 'pipeline-benchmarks' ||
    tab === 'ai-settings' ||
    tab === 'org-settings'
  ) {
    return 'settings';
  }

  return 'command-center';
}

function tabTypeToDiagnoseSubView(tab: TabType): DiagnoseSubView | null {
  switch (tab) {
    case 'overview':
      return 'overview';
    case 'recruiter':
      return 'recruiter';
    case 'hm-friction':
      return 'hm-friction';
    case 'hiring-managers':
      return 'hiring-managers';
    case 'bottlenecks':
      return 'bottlenecks';
    case 'quality':
      return 'quality';
    case 'source-mix':
      return 'source-mix';
    case 'velocity':
      return 'velocity';
    default:
      return null;
  }
}

function tabTypeToPlanSubView(tab: TabType): PlanSubView | null {
  switch (tab) {
    case 'capacity':
      return 'capacity';
    case 'capacity-rebalancer':
      return 'rebalancer';
    case 'forecasting':
      return 'forecasting';
    case 'scenarios':
      return 'scenarios';
    default:
      return null;
  }
}

function tabTypeToSettingsSubView(tab: TabType): SettingsSubView | null {
  switch (tab) {
    case 'data-health':
      return 'data-health';
    case 'sla-settings':
      return 'sla-settings';
    case 'pipeline-benchmarks':
      return 'pipeline-benchmarks';
    case 'ai-settings':
      return 'ai-settings';
    case 'org-settings':
      return 'org-settings';
    default:
      return null;
  }
}

function diagnoseSubViewToTabType(subView: DiagnoseSubView): TabType {
  return subView;
}

function planSubViewToTabType(subView: PlanSubView): TabType {
  switch (subView) {
    case 'capacity':
      return 'capacity';
    case 'rebalancer':
      return 'capacity-rebalancer';
    case 'forecasting':
      return 'forecasting';
    case 'scenarios':
      return 'scenarios';
    default:
      return 'capacity';
  }
}

function settingsSubViewToTabType(subView: SettingsSubView): TabType {
  // NOTE: data-import is an internal Settings subview today and isn't URL-addressable.
  if (subView === 'data-import') return 'data-health';
  return subView;
}

function isDiagnoseSubView(value: string): value is DiagnoseSubView {
  return (
    value === 'overview' ||
    value === 'recruiter' ||
    value === 'hm-friction' ||
    value === 'hiring-managers' ||
    value === 'bottlenecks' ||
    value === 'quality' ||
    value === 'source-mix' ||
    value === 'velocity'
  );
}

function isPlanSubView(value: string): value is PlanSubView {
  return value === 'capacity' || value === 'rebalancer' || value === 'forecasting' || value === 'scenarios';
}

function isSettingsSubView(value: string): value is SettingsSubView {
  return (
    value === 'data-health' ||
    value === 'sla-settings' ||
    value === 'pipeline-benchmarks' ||
    value === 'ai-settings' ||
    value === 'org-settings' ||
    value === 'data-import'
  );
}

export function AppLayoutV2({ defaultTab = 'command-center' }: AppLayoutV2Props) {
  const [activeTab, setActiveTab] = useState<TabId>(defaultTab);
  const [diagnoseSubView, setDiagnoseSubView] = useState<DiagnoseSubView>('overview');
  const [planSubView, setPlanSubView] = useState<PlanSubView>('capacity');
  const [settingsSubView, setSettingsSubView] = useState<SettingsSubView>('data-health');

  const location = useLocation();
  const navigate = useNavigate();

  const { state, selectRecruiter, updateFilters, importCSVs, isAiEnabled, aiConfig } = useDashboard();
  const { user, signOut } = useAuth();
  const { resolvedTheme: theme, setTheme } = useTheme();

  // Toggle theme
  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
  };

  // Check if data is loaded
  const hasData = state.dataStore.requisitions.length > 0;

  // Keep URL redirects (bucket roots + legacy paths) consistent.
  useEffect(() => {
    const normalized = normalizePathname(location.pathname);
    const redirect = getRedirectPath(normalized);
    if (redirect && redirect !== normalized) {
      navigate(redirect + location.search, { replace: true });
    }
  }, [location.pathname, location.search, navigate]);

  // Sync URL -> activeTab/subviews (deep-link correctness)
  useEffect(() => {
    const { tab, recruiterId } = parseUrl(location.pathname, location.search);

    const topLevel = tabTypeToTopLevel(tab);
    setActiveTab(topLevel);

    const diag = tabTypeToDiagnoseSubView(tab);
    if (diag) setDiagnoseSubView(diag);

    const plan = tabTypeToPlanSubView(tab);
    if (plan) setPlanSubView(plan);

    const settings = tabTypeToSettingsSubView(tab);
    if (settings) setSettingsSubView(settings);

    if (tab === 'recruiter' && recruiterId) {
      selectRecruiter(recruiterId);
    }
  }, [location.pathname, location.search, selectRecruiter]);

  // When a recruiter is selected inside the app, keep the URL query param aligned.
  // This enables copy/paste sharing of the current recruiter detail view.
  useEffect(() => {
    if (activeTab !== 'diagnose' || diagnoseSubView !== 'recruiter') return;
    if (!state.selectedRecruiterId) return;

    // If recruiter id is already encoded in the path, don't also force a query param.
    const hasPathId = /\/diagnose\/recruiter\/[^/]+$/.test(location.pathname);
    if (hasPathId) return;

    const params = new URLSearchParams(location.search);
    if (params.get('id') === state.selectedRecruiterId) return;

    params.set('id', state.selectedRecruiterId);
    navigate(`${location.pathname}?${params.toString()}`, { replace: true });
  }, [activeTab, diagnoseSubView, state.selectedRecruiterId, location.pathname, location.search, navigate]);

  const navigateToTabType = (tab: TabType, params?: Record<string, string>) => {
    const basePath = getPathFromTab(tab);

    // Only recruiter supports a nested identifier today; keep everything else as canonical paths.
    if (tab === 'recruiter') {
      const recruiterId = params?.recruiterId || params?.recruiter_id || params?.id;
      if (recruiterId) {
        navigate(`${basePath}/${encodeURIComponent(recruiterId)}`);
        return;
      }
    }

    navigate(basePath);
  };

  // Navigation handler used by CTAs / deep links (supports legacy v1 tab names)
  const handleNavigateToTab = (tab: string, params?: Record<string, string>) => {
    // Top-level tabs (sidebar)
    if (tab === 'command-center' || tab === 'ask-platovue' || tab === 'diagnose' || tab === 'plan' || tab === 'settings') {
      // Support passing a leaf subview via params (used by Ask/command-center deep links)
      const subview = params?.subview;
      if (tab === 'diagnose' && subview && isDiagnoseSubView(subview)) {
        setActiveTab('diagnose');
        setDiagnoseSubView(subview);
        navigateToTabType(diagnoseSubViewToTabType(subview), params);
        return;
      }
      if (tab === 'plan' && subview && isPlanSubView(subview)) {
        setActiveTab('plan');
        setPlanSubView(subview);
        navigateToTabType(planSubViewToTabType(subview), params);
        return;
      }
      if (tab === 'settings' && subview && isSettingsSubView(subview)) {
        setActiveTab('settings');
        setSettingsSubView(subview);
        if (subview !== 'data-import') {
          navigateToTabType(settingsSubViewToTabType(subview), params);
        }
        return;
      }

      handleTopLevelTabChange(tab as TabId);
      return;
    }

    const normalized: string = tab;

    // Leaf tabs from V1/V2 deep links
    const asTabType = normalized as TabType;

    // Update local subview state for smoother transitions (URL effect will also enforce this)
    const topLevel = tabTypeToTopLevel(asTabType);
    setActiveTab(topLevel);

    const diag = tabTypeToDiagnoseSubView(asTabType);
    if (diag) setDiagnoseSubView(diag);

    const plan = tabTypeToPlanSubView(asTabType);
    if (plan) setPlanSubView(plan);

    const settings = tabTypeToSettingsSubView(asTabType);
    if (settings) setSettingsSubView(settings);

    navigateToTabType(asTabType, params);
  };

  const handleTopLevelTabChange = (tab: TabId) => {
    setActiveTab(tab);

    switch (tab) {
      case 'command-center':
        navigate('/');
        return;
      case 'ask-platovue':
        navigate('/ask');
        return;
      case 'diagnose':
        navigate(getPathFromTab(diagnoseSubViewToTabType(diagnoseSubView)));
        return;
      case 'plan':
        navigate(getPathFromTab(planSubViewToTabType(planSubView)));
        return;
      case 'settings':
        navigate(getPathFromTab(settingsSubViewToTabType(settingsSubView)));
        return;
      default:
        navigate('/');
    }
  };

  const handleDiagnoseSubViewChange = (subView: DiagnoseSubView) => {
    setDiagnoseSubView(subView);
    navigate(getPathFromTab(diagnoseSubViewToTabType(subView)));
  };

  const handlePlanSubViewChange = (subView: PlanSubView) => {
    setPlanSubView(subView);
    navigate(getPathFromTab(planSubViewToTabType(subView)));
  };

  const handleSettingsSubViewChange = (subView: SettingsSubView) => {
    setSettingsSubView(subView);
    // data-import isn't URL-addressable yet; keep the current route stable.
    if (subView === 'data-import') return;
    navigate(getPathFromTab(settingsSubViewToTabType(subView)));
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'command-center':
        return <CommandCenterV2 onNavigateToTab={handleNavigateToTab} />;
      case 'ask-platovue':
        return <AskPlatoVueV2 onNavigateToTab={handleNavigateToTab} />;
      case 'diagnose':
        return (
          <DiagnoseTabV2
            defaultSubView={diagnoseSubView}
            onSubViewChange={handleDiagnoseSubViewChange}
          />
        );
      case 'plan':
        return (
          <PlanTabV2
            defaultSubView={planSubView}
            onSubViewChange={handlePlanSubViewChange}
          />
        );
      case 'settings':
        return (
          <SettingsTabV2
            defaultSubView={settingsSubView}
            onSubViewChange={handleSettingsSubViewChange}
          />
        );
      default:
        return <CommandCenterV2 />;
    }
  };

  // If no data, show upload interface with V0 layout wrapper
  if (!hasData) {
    return (
      <div className="min-h-screen bg-background">
        {/* V0 Header for upload state */}
        <header className="sticky top-0 z-50 flex h-14 shrink-0 items-center justify-between border-b border-border bg-background/80 backdrop-blur-xl px-4 md:px-6">
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold text-foreground">PlatoVue</span>
          </div>
          <div className="flex items-center gap-2">
            {/* AI Status Indicator - disabled before data load */}
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-muted-foreground/50 cursor-not-allowed"
              title="Load data to configure AI"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">AI Off</span>
            </span>
            <button
              type="button"
              onClick={toggleTheme}
              className="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? (
                <Sun className="h-5 w-5" />
              ) : (
                <Moon className="h-5 w-5" />
              )}
            </button>
          </div>
        </header>
        <main className="flex-1">
          <CSVUpload
            onUpload={importCSVs}
            isLoading={state.isLoading}
          />
        </main>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <AppSidebar
        activeTab={activeTab}
        onTabChange={handleTopLevelTabChange}
        userEmail={user?.email}
        onSignOut={signOut}
        dataStats={{
          candidateCount: state.dataStore.candidates.length,
          reqCount: state.dataStore.requisitions.length,
          lastUpdated: state.dataStore.lastImportAt,
        }}
        onNavigateToDataImport={() => {
          setActiveTab('settings');
          setSettingsSubView('data-import');
        }}
      />
      <SidebarInset>
        {/* Header with breadcrumb, AI status, and theme toggle */}
        <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-background px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <div className="flex flex-1 items-center justify-between">
            <h1 className="text-sm font-medium capitalize">
              {activeTab.replace('-', ' ')}
            </h1>
            <div className="flex items-center gap-2">
              {/* AI Status Indicator */}
              <AiStatusIndicator
                isEnabled={isAiEnabled}
                provider={aiConfig?.provider}
                onClick={() => {
                  setActiveTab('settings');
                  setSettingsSubView('ai-settings');
                  navigate('/settings/ai');
                }}
              />
              {/* Theme Toggle */}
              <button
                type="button"
                onClick={toggleTheme}
                className="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                aria-label="Toggle theme"
              >
                {theme === 'dark' ? (
                  <Sun className="h-5 w-5" />
                ) : (
                  <Moon className="h-5 w-5" />
                )}
              </button>
            </div>
          </div>
        </header>

        {/* Global Filter Bar - hidden on Settings and Plan pages */}
        {activeTab !== 'settings' && activeTab !== 'plan' && (
          <div className="px-4 md:px-6 pt-4">
            <FilterBar
              filters={state.filters}
              requisitions={state.dataStore.requisitions}
              users={state.dataStore.users}
              onChange={updateFilters}
            />
          </div>
        )}

        {/* Main Content */}
        <main className="flex-1 p-4 md:p-6 animate-in fade-in duration-300">
          {renderTabContent()}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

export default AppLayoutV2;
