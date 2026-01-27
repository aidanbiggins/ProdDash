'use client';

import React, { useState, useMemo } from 'react';
import { Users, TrendingUp, Layers, Scale } from 'lucide-react';
import { useDashboard } from '../../hooks/useDashboardContext';

// Import legacy v1 tab components (embedded until native V2 versions exist)
// @see ../\_legacy/README.md for migration status
import { CapacityTab } from '../_legacy/capacity/CapacityTab';
import { CapacityRebalancerTab } from '../_legacy/capacity-rebalancer/CapacityRebalancerTab';
import { ForecastingTab } from '../_legacy/forecasting/ForecastingTab';
import ScenarioLibraryTab from '../_legacy/scenarios/ScenarioLibraryTab';

// Types
import { ActionItem } from '../../types/actionTypes';
import { buildHMFactTables } from '../../services/hmFactTables';
import { calculatePendingActions } from '../../services/hmMetricsEngine';
import { DEFAULT_HM_RULES } from '../../config/hmRules';

// Sub-view types for Plan tab
export type PlanSubView = 'capacity' | 'rebalancer' | 'forecasting' | 'scenarios';

interface PlanTabV2Props {
  defaultSubView?: PlanSubView;
  onSubViewChange?: (subView: PlanSubView) => void;
  onAddToActionQueue?: (actions: ActionItem[]) => void;
}

const subViews: { id: PlanSubView; label: string; icon: React.ReactNode }[] = [
  { id: 'capacity', label: 'Capacity', icon: <Users className="w-4 h-4" /> },
  { id: 'rebalancer', label: 'Rebalancer', icon: <Scale className="w-4 h-4" /> },
  { id: 'forecasting', label: 'Forecasting', icon: <TrendingUp className="w-4 h-4" /> },
  { id: 'scenarios', label: 'Scenarios', icon: <Layers className="w-4 h-4" /> },
];

export function PlanTabV2({
  defaultSubView = 'capacity',
  onSubViewChange,
  onAddToActionQueue
}: PlanTabV2Props) {
  const [activeSubView, setActiveSubView] = useState<PlanSubView>(defaultSubView);
  const { state } = useDashboard();

  const handleSubViewChange = (subView: PlanSubView) => {
    setActiveSubView(subView);
    onSubViewChange?.(subView);
  };

  // Calculate HM actions for forecasting tab
  const hmActions = useMemo(() => {
    if (!state.dataStore.requisitions.length) return [];

    try {
      const factTables = buildHMFactTables(
        state.dataStore.requisitions,
        state.dataStore.candidates,
        state.dataStore.events,
        state.dataStore.users,
        state.dataStore.config.stageMapping,
        state.dataStore.lastImportAt || new Date()
      );
      return calculatePendingActions(factTables, state.dataStore.users, DEFAULT_HM_RULES);
    } catch {
      return [];
    }
  }, [state.dataStore]);

  const renderContent = () => {
    // No data state
    if (!state.dataStore.requisitions.length) {
      return (
        <div className="glass-panel p-6 text-center">
          <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">No Data Loaded</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Import your recruiting data to view capacity planning, forecasting, and scenario analysis.
          </p>
        </div>
      );
    }

    switch (activeSubView) {
      case 'capacity':
        return <CapacityTab />;
      case 'rebalancer':
        return <CapacityRebalancerTab />;
      case 'forecasting':
        return (
          <ForecastingTab
            requisitions={state.dataStore.requisitions}
            candidates={state.dataStore.candidates}
            events={state.dataStore.events}
            users={state.dataStore.users}
            hmFriction={state.hmFriction || []}
            config={state.dataStore.config}
            hmActions={hmActions}
            onAddToActionQueue={onAddToActionQueue}
          />
        );
      case 'scenarios':
        return <ScenarioLibraryTab />;
      default:
        return <CapacityTab />;
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-[1600px] mx-auto">
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-xl md:text-2xl font-bold text-foreground tracking-tight mb-1">
          Plan
        </h1>
        <p className="text-xs md:text-sm text-muted-foreground">
          Capacity planning, forecasting, and scenario modeling
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

export default PlanTabV2;
