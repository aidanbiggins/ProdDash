'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { Database, Clock, Bot, Building2, Upload } from 'lucide-react';
import { useDashboard } from '../../hooks/useDashboardContext';

// Import legacy v1 tab components (embedded until native V2 versions exist)
// @see ../\_legacy/README.md for migration status
import { DataHealthTab } from '../_legacy/data-health/DataHealthTab';
import { SlaSettingsTab } from '../_legacy/settings/SlaSettingsTab';
import { AiSettingsTab } from '../_legacy/settings/AiSettingsTab';
import { OrgSettingsTab } from '../_legacy/settings/OrgSettingsTab';
import { CSVUpload } from '../CSVUpload';

// Sub-view types for Settings tab
export type SettingsSubView = 'data-health' | 'sla-settings' | 'ai-settings' | 'org-settings' | 'data-import';

interface SettingsTabV2Props {
  defaultSubView?: SettingsSubView;
  onSubViewChange?: (subView: SettingsSubView) => void;
}

const subViews: { id: SettingsSubView; label: string; icon: React.ReactNode }[] = [
  { id: 'data-import', label: 'Data Import', icon: <Upload className="w-4 h-4" /> },
  { id: 'data-health', label: 'Data Health', icon: <Database className="w-4 h-4" /> },
  { id: 'sla-settings', label: 'SLA Settings', icon: <Clock className="w-4 h-4" /> },
  { id: 'ai-settings', label: 'AI Settings', icon: <Bot className="w-4 h-4" /> },
  { id: 'org-settings', label: 'Organization', icon: <Building2 className="w-4 h-4" /> },
];

export function SettingsTabV2({ defaultSubView = 'data-health', onSubViewChange }: SettingsTabV2Props) {
  const [activeSubView, setActiveSubView] = useState<SettingsSubView>(defaultSubView);
  const { state, importCSVs } = useDashboard();

  // State for DataHealthTab exclusions
  const [excludedReqIds, setExcludedReqIds] = useState<Set<string>>(new Set());

  const handleSubViewChange = (subView: SettingsSubView) => {
    setActiveSubView(subView);
    onSubViewChange?.(subView);
  };

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

      {/* Sub-navigation */}
      <div className="flex gap-1 overflow-x-auto pb-2 mb-6 -mx-4 px-4 md:mx-0 md:px-0">
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

      {/* Content */}
      {renderContent()}
    </div>
  );
}

export default SettingsTabV2;
