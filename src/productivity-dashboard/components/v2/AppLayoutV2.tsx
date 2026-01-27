'use client';

import React, { useState, useEffect } from 'react';
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
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from '../../../components/ui/sidebar';
import { Separator } from '../../../components/ui/separator';
import { Moon, Sun } from 'lucide-react';

interface AppLayoutV2Props {
  defaultTab?: TabId;
}

export function AppLayoutV2({ defaultTab = 'command-center' }: AppLayoutV2Props) {
  const [activeTab, setActiveTab] = useState<TabId>(defaultTab);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const { state, updateFilters, importCSVs } = useDashboard();
  const { user, signOut } = useAuth();

  // Initialize theme from localStorage or system preference
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.classList.toggle('dark', savedTheme === 'dark');
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setTheme(prefersDark ? 'dark' : 'light');
      document.documentElement.classList.toggle('dark', prefersDark);
    }
  }, []);

  // Toggle theme
  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
  };

  // Check if data is loaded
  const hasData = state.dataStore.requisitions.length > 0;

  // Tab navigation handler for v1 tab names
  const handleNavigateToTab = (tab: string) => {
    // Map v1 tab names to v2 tab structure
    if (tab === 'overview' || tab === 'recruiter' || tab === 'hm-friction' ||
      tab === 'hiring-managers' || tab === 'bottlenecks' || tab === 'quality' ||
      tab === 'source-mix' || tab === 'velocity') {
      setActiveTab('diagnose');
    } else if (tab === 'capacity' || tab === 'capacity-rebalancer' || tab === 'forecasting' || tab === 'scenarios') {
      setActiveTab('plan');
    } else if (tab === 'data-health' || tab === 'sla-settings' || tab === 'ai-settings' || tab === 'org-settings') {
      setActiveTab('settings');
    } else if (tab === 'command-center') {
      setActiveTab('command-center');
    } else if (tab === 'ask-platovue') {
      setActiveTab('ask-platovue');
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'command-center':
        return <CommandCenterV2 onNavigateToTab={handleNavigateToTab} />;
      case 'ask-platovue':
        return <AskPlatoVueV2 onNavigateToTab={handleNavigateToTab} />;
      case 'diagnose':
        return <DiagnoseTabV2 />;
      case 'plan':
        return <PlanTabV2 />;
      case 'settings':
        return <SettingsTabV2 />;
      default:
        return <CommandCenterV2 />;
    }
  };

  // If no data, show upload interface
  if (!hasData) {
    return (
      <CSVUpload
        onUpload={importCSVs}
        isLoading={state.isLoading}
      />
    );
  }

  return (
    <SidebarProvider>
      <AppSidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        userEmail={user?.email}
        onSignOut={signOut}
      />
      <SidebarInset>
        {/* Header with breadcrumb and theme toggle */}
        <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-background px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <div className="flex flex-1 items-center justify-between">
            <h1 className="text-sm font-medium capitalize">
              {activeTab.replace('-', ' ')}
            </h1>
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

        {/* Global Filter Bar */}
        <div className="px-4 md:px-6 pt-4">
          <FilterBar
            filters={state.filters}
            requisitions={state.dataStore.requisitions}
            users={state.dataStore.users}
            onChange={updateFilters}
          />
        </div>

        {/* Main Content */}
        <main className="flex-1 p-4 md:p-6 animate-in fade-in duration-300">
          {renderTabContent()}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

export default AppLayoutV2;

