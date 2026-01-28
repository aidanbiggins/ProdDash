'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Database, Clock, Bot, Building2, Upload, Target, ChevronDown } from 'lucide-react';
import { useDashboard } from '../../hooks/useDashboardContext';
import { useIsMobile } from '../../hooks/useIsMobile';

// Import legacy v1 tab components (embedded until native V2 versions exist)
// @see ../\_legacy/README.md for migration status
import { DataHealthTab } from '../_legacy/data-health/DataHealthTab';
import { SlaSettingsTab } from '../_legacy/settings/SlaSettingsTab';
import { AiSettingsTab } from '../_legacy/settings/AiSettingsTab';
import { OrgSettingsTab } from '../_legacy/settings/OrgSettingsTab';
import { CSVUpload } from '../CSVUpload';
import { PipelineBenchmarksTab } from './PipelineBenchmarksTab';

// Sub-view types for Settings tab
export type SettingsSubView = 'data-health' | 'sla-settings' | 'pipeline-benchmarks' | 'ai-settings' | 'org-settings' | 'data-import';

interface SettingsTabV2Props {
  defaultSubView?: SettingsSubView;
  onSubViewChange?: (subView: SettingsSubView) => void;
}

const subViews: { id: SettingsSubView; label: string; icon: React.ReactNode }[] = [
  { id: 'data-import', label: 'Data Import', icon: <Upload className="w-4 h-4" /> },
  { id: 'data-health', label: 'Data Health', icon: <Database className="w-4 h-4" /> },
  { id: 'sla-settings', label: 'SLA Settings', icon: <Clock className="w-4 h-4" /> },
  { id: 'pipeline-benchmarks', label: 'Pipeline Targets', icon: <Target className="w-4 h-4" /> },
  { id: 'ai-settings', label: 'AI Settings', icon: <Bot className="w-4 h-4" /> },
  { id: 'org-settings', label: 'Organization', icon: <Building2 className="w-4 h-4" /> },
];

export function SettingsTabV2({ defaultSubView = 'data-health', onSubViewChange }: SettingsTabV2Props) {
  const [activeSubView, setActiveSubView] = useState<SettingsSubView>(defaultSubView);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { state, importCSVs } = useDashboard();
  const isMobile = useIsMobile();

  // Keep internal state in sync with URL-driven parent (deep-link/back-forward support).
  useEffect(() => {
    setActiveSubView(defaultSubView);
  }, [defaultSubView]);

  // State for DataHealthTab exclusions
  const [excludedReqIds, setExcludedReqIds] = useState<Set<string>>(new Set());

  const handleSubViewChange = (subView: SettingsSubView) => {
    setActiveSubView(subView);
    setMobileMenuOpen(false);
    onSubViewChange?.(subView);
  };

  const activeViewConfig = subViews.find(v => v.id === activeSubView) || subViews[0];

  const handleToggleExclusion = useCallback((reqId: string) => {
    setExcludedReqIds(prev => {
      const next = new Set(prev);
      if (next.has(reqId)) {
        next.delete(reqId);
      } else {
        next.add(reqId);
      }
      return next;
    });
  }, []);

  // No data empty state for Data Health
  const renderNoDataState = () => (
    <div className="glass-panel p-6 text-center">
      <Database className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
      <h3 className="text-lg font-semibold text-foreground mb-2">No Data Loaded</h3>
      <p className="text-sm text-muted-foreground max-w-md mx-auto">
        Import your recruiting data to view data health metrics and hygiene analysis.
      </p>
    </div>
  );

  const renderContent = () => {
    switch (activeSubView) {
      case 'data-import':
        return (
          <CSVUpload
            onUpload={importCSVs}
            isLoading={state.isLoading}
          />
        );
      case 'data-health':
        // Data Health needs data
        if (!state.dataStore.requisitions.length) {
          return renderNoDataState();
        }
        return (
          <DataHealthTab
            requisitions={state.dataStore.requisitions}
            candidates={state.dataStore.candidates}
            events={state.dataStore.events}
            users={state.dataStore.users}
            excludedReqIds={excludedReqIds}
            onToggleExclusion={handleToggleExclusion}
          />
        );
      case 'sla-settings':
        return <SlaSettingsTab />;
      case 'pipeline-benchmarks':
        return <PipelineBenchmarksTab />;
      case 'ai-settings':
        return <AiSettingsTab />;
      case 'org-settings':
        return <OrgSettingsTab />;
      default:
        return renderNoDataState();
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-[1600px] mx-auto">
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-xl md:text-2xl font-bold text-foreground tracking-tight mb-1">
          Settings
        </h1>
        <p className="text-xs md:text-sm text-muted-foreground">
          Configure data sources, SLAs, AI integrations, and organization settings
        </p>
      </div>

      {/* Sub-navigation - Mobile dropdown / Desktop tabs */}
      {isMobile ? (
        <div className="relative mb-6">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="w-full flex items-center justify-between gap-2 px-4 py-3 rounded-lg bg-muted/50 border border-border text-foreground"
          >
            <div className="flex items-center gap-3">
              {activeViewConfig.icon}
              <span className="font-medium">{activeViewConfig.label}</span>
            </div>
            <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform ${mobileMenuOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* Mobile dropdown menu */}
          {mobileMenuOpen && (
            <>
              {/* Backdrop */}
              <div
                className="fixed inset-0 z-40"
                onClick={() => setMobileMenuOpen(false)}
              />
              {/* Menu */}
              <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-popover border border-border rounded-lg shadow-xl overflow-hidden">
                {subViews.map((view) => (
                  <button
                    key={view.id}
                    type="button"
                    onClick={() => handleSubViewChange(view.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                      activeSubView === view.id
                        ? 'bg-primary/10 text-primary'
                        : 'text-foreground hover:bg-muted'
                    }`}
                  >
                    {view.icon}
                    <span className="font-medium">{view.label}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="flex gap-1 overflow-x-auto pb-2 mb-6">
          {subViews.map((view) => (
            <button
              key={view.id}
              type="button"
              onClick={() => handleSubViewChange(view.id)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${
                activeSubView === view.id
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              }`}
            >
              {view.icon}
              <span>{view.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      {renderContent()}
    </div>
  );
}

export default SettingsTabV2;
